import React from 'react';
import { Server, Zap, ShieldCheck, Copy, Check } from 'lucide-react';

export const FastApiSpec: React.FC = () => {
  const [copied, setCopied] = React.useState(false);

  const fastApiCode = `# =====================================================================
# FASTAPI BACKEND - GOLOSINAS & BEBIDAS (CAJA CENTRAL & PRE-VENTA)
# =====================================================================
from fastapi import FastAPI, HTTPException, Depends, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

app = FastAPI(title="POS Central - Golosinas y Bebidas", version="1.0.0")

# 1. SINCRONIZACIÓN DE CATÁLOGO (Para almacenar en SQLite local de Expo)
@app.get("/api/v1/products/sync", response_model=List[ProductSyncResponse])
def get_products_catalog(db: Session = Depends(get_db)):
    """
    Retorna el catálogo completo con presentaciones y factores de conversión.
    Se descarga en la app Android al iniciar turno de venta.
    """
    products = db.query(Product).filter(Product.is_active == True).all()
    return products

# 2. CREACIÓN DE PRE-VENTA DESDE LA APP MÓVIL
@app.post("/api/v1/presale/orders", status_code=status.HTTP_201_CREATED)
def create_presale_order(payload: CreatePreSalePayload, db: Session = Depends(get_db)):
    """
    Crea un pedido con estado 'PENDIENTE_PAGO' y genera el ID PED-XXXXX.
    NO descuenta stock físico aún; solo valida disponibilidad en almacén.
    """
    order_id = generate_next_order_code(db) # Ej: PED-00892
    
    total_amount = 0.0
    total_base_units = 0
    order_items = []

    for item in payload.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Producto {item.product_id} no existe")
        
        pres = db.query(ProductPresentation).filter(
            ProductPresentation.product_id == item.product_id,
            ProductPresentation.presentation_type == item.presentation_type
        ).first()
        
        if not pres:
            raise HTTPException(status_code=400, detail=f"Presentación no válida")

        deducted_units = item.quantity * pres.conversion_factor
        
        # Validación de stock en almacén central
        if product.stock_in_base_units < deducted_units:
            raise HTTPException(
                status_code=400, 
                detail=f"Stock insuficiente para {product.name}. Disponible: {product.stock_in_base_units} {product.base_unit_name}s"
            )

        subtotal = float(pres.sale_price) * item.quantity
        total_amount += subtotal
        total_base_units += deducted_units

        order_items.append(PreSaleItem(
            order_id=order_id,
            product_id=product.id,
            presentation_type=item.presentation_type,
            conversion_factor=pres.conversion_factor,
            quantity=item.quantity,
            unit_price=pres.sale_price,
            subtotal=subtotal,
            base_units_deducted=deducted_units
        ))

    new_order = PreSaleOrder(
        id=order_id,
        seller_id=payload.seller_id,
        seller_name=payload.seller_name,
        status="PENDIENTE_PAGO",
        total_amount=total_amount,
        total_base_units=total_base_units,
        qr_payload=order_id, # El código exacto para el QR térmico
        created_at=datetime.utcnow()
    )

    db.add(new_order)
    db.add_all(order_items)
    db.commit()

    return {
        "order_id": order_id,
        "status": new_order.status,
        "total_amount": total_amount,
        "total_base_units": total_base_units,
        "qr_payload": order_id
    }

# 3. ENDPOINT PARA LA CAJA CENTRAL: AL ESCANEAR EL QR DEL TICKET
@app.get("/api/v1/cashier/orders/{order_id}")
def get_order_for_cashier(order_id: str, db: Session = Depends(get_db)):
    """
    El cajero en mostrador escanea el QR del ticket térmico impreso.
    Este endpoint carga al instante los productos para cobrar.
    """
    order = db.query(PreSaleOrder).filter(PreSaleOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado en Caja")
    if order.status == "PAGADO":
        raise HTTPException(status_code=400, detail="Este pedido ya fue cobrado previamente")
    
    return order

# 4. COBRO FINAL Y DESCUENTO ATÓMICO DE STOCK EN CAJA
@app.post("/api/v1/cashier/orders/{order_id}/checkout")
def checkout_order(order_id: str, payment_method: str, db: Session = Depends(get_db)):
    """
    Caja cobra al cliente (Efectivo/Yape/Plin/Tarjeta) y emite Boleta/Factura.
    Aquí se ejecuta el descuento atómico de stock en base a base_units_deducted.
    """
    order = db.query(PreSaleOrder).filter(PreSaleOrder.id == order_id).first()
    if not order or order.status != "PENDIENTE_PAGO":
        raise HTTPException(status_code=400, detail="Pedido inválido o ya cobrado")

    # Descuento atómico de stock en la unidad base mínima con bloqueo de fila
    for item in order.items:
        product = db.query(Product).filter(Product.id == item.product_id).with_for_update().first()
        product.stock_in_base_units -= item.base_units_deducted
        if product.stock_in_base_units < 0:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Stock insuficiente para {product.name}")

    order.status = "PAGADO"
    order.paid_at = datetime.utcnow()
    db.commit()

    return {"message": "Cobro exitoso y stock descontado", "order_id": order_id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(fastApiCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-stone-900/90 rounded-3xl border border-stone-800 p-6 md:p-8 shadow-2xl space-y-6">
      <div className="flex items-center justify-between border-b border-stone-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-amber-500 to-yellow-400 text-stone-950 rounded-2xl shadow-md shadow-amber-500/20">
            <Server className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="text-xs font-black text-amber-400 uppercase tracking-widest">
              Conectividad Backend Central
            </div>
            <h2 className="text-xl md:text-2xl font-black text-amber-50">
              API REST con FastAPI (Golosinas & Bebidas)
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="px-3.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-amber-200 border border-stone-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-amber-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copiado' : 'Copiar Código'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-stone-300">
        <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 space-y-2">
          <div className="font-black text-amber-400 flex items-center gap-1.5 uppercase tracking-wide">
            <Zap className="w-4 h-4" /> Flujo Pre-Venta Móvil (Android)
          </div>
          <p className="text-stone-400 leading-relaxed">
            El preventista escanea con la pistola láser, selecciona presentaciones (Unidad, Medio, Paquete) y genera el pedido. El backend valida stock y emite el ID <code className="text-amber-300 font-bold">PED-00892</code> en estado <code className="text-rose-300">PENDIENTE_PAGO</code>.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 space-y-2">
          <div className="font-black text-yellow-400 flex items-center gap-1.5 uppercase tracking-wide">
            <ShieldCheck className="w-4 h-4" /> Flujo Caja Central (Mostrador)
          </div>
          <p className="text-stone-400 leading-relaxed">
            El cliente llega a Caja con el ticket térmico impreso o digital. El cajero escanea el Código QR del papel. La orden se abre en segundos y al cobrar, descuenta el stock de almacén con <code className="text-amber-300">with_for_update()</code>.
          </p>
        </div>
      </div>

      <div className="relative p-5 bg-stone-950 rounded-2xl border border-stone-800 overflow-x-auto max-h-[480px]">
        <pre className="font-mono text-xs text-amber-100/90 leading-relaxed">
          <code>{fastApiCode}</code>
        </pre>
      </div>
    </div>
  );
};
