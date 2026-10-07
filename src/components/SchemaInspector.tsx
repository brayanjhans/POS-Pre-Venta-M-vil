import React from 'react';
import { 
  Database, 
  Layers, 
  Calculator, 
  Copy, 
  Check, 
  FileCode, 
  Sparkles,
  TrendingUp,
  Cpu,
  Package,
  Wine,
  Candy,
  Flame
} from 'lucide-react';
import { INITIAL_PRODUCTS, ExtendedProduct } from '../data/mockProducts';
import { PresentationType } from '../types/pos';
import { ProductVisualBadge } from './ProductVisualBadge';

export const SchemaInspector: React.FC = () => {
  const [activeSchemaTab, setActiveSchemaTab] = React.useState<'sql' | 'pydantic' | 'typescript' | 'json'>('sql');
  const [copied, setCopied] = React.useState<string | null>(null);

  // Estados para la calculadora interactiva del factor de conversión
  const [selectedProductId, setSelectedProductId] = React.useState<string>(INITIAL_PRODUCTS[0].id);
  const [selectedPresType, setSelectedPresType] = React.useState<PresentationType>('pack');
  const [testQuantity, setTestQuantity] = React.useState<number>(3);

  const selectedProduct = INITIAL_PRODUCTS.find(p => p.id === selectedProductId) || INITIAL_PRODUCTS[0];
  const selectedPres = selectedProduct.presentations[selectedPresType]!;

  const totalDeduction = testQuantity * selectedPres.conversionFactor;
  const remainingStock = selectedProduct.stockInBaseUnits - totalDeduction;
  const isStockOk = remainingStock >= 0;

  // Desglose mixto amigable (Paquetes, Medios, Unidades)
  const packFactor = selectedProduct.presentations.pack?.conversionFactor || 24;
  const halfFactor = selectedProduct.presentations.half?.conversionFactor || 12;
  const remainingPacks = Math.floor(Math.max(0, remainingStock) / packFactor);
  const remainingAfterPacks = Math.max(0, remainingStock) % packFactor;
  const remainingHalves = Math.floor(remainingAfterPacks / halfFactor);
  const remainingUnits = remainingAfterPacks % halfFactor;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const sqlDDL = `-- =====================================================================
-- ESQUEMA DE BASE DE DATOS RELACIONAL (PostgreSQL / SQLite)
-- Pre-Venta & POS Golosinas y Bebidas con Multi-Presentación
-- =====================================================================

-- 1. TABLA MAESTRA DE PRODUCTOS
-- El stock vive ÚNICAMENTE en la unidad base indivisible (botellas, chupetines, barras)
CREATE TABLE products (
    id VARCHAR(36) PRIMARY KEY,
    barcode VARCHAR(50) UNIQUE NOT NULL,      -- Código de barras de la unidad suelta (EAN-13)
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,            -- 'Bebidas', 'Chocolates', 'Golosinas', 'Galletas'
    base_unit_name VARCHAR(30) NOT NULL,      -- 'botella', 'paquetito', 'barra', 'lata'
    stock_in_base_units INTEGER NOT NULL DEFAULT 0 CHECK (stock_in_base_units >= 0),
    min_stock_alert INTEGER NOT NULL DEFAULT 12,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_category ON products(category);

-- 2. TABLA DE PRESENTACIONES Y FACTORES DE CONVERSIÓN
-- Permite precios totalmente independientes (descuento mayorista no lineal)
CREATE TABLE product_presentations (
    id VARCHAR(36) PRIMARY KEY,
    product_id VARCHAR(36) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    presentation_type VARCHAR(20) NOT NULL CHECK (presentation_type IN ('unit', 'half', 'pack')),
    label VARCHAR(80) NOT NULL,               -- Ej: "Paquete completo (12 botellas)"
    short_label VARCHAR(20) NOT NULL,         -- Ej: "PAQ (12b)"
    
    -- FACTOR CLAVE: ¿Cuántas unidades base mínimas descuenta 1 unidad vendida?
    -- Unidad = 1, Medio = 6 o 12, Paquete = 12 o 24
    conversion_factor INTEGER NOT NULL CHECK (conversion_factor >= 1),
    
    -- PRECIO INDEPENDIENTE (No calculado proporcionalmente, fijado por margen de negocio)
    sale_price DECIMAL(10, 2) NOT NULL CHECK (sale_price >= 0),
    cost_price DECIMAL(10, 2) DEFAULT 0,
    
    barcode_override VARCHAR(50),             -- Opcional: Código propio del fardo o display sellado
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(product_id, presentation_type)
);

CREATE INDEX idx_pres_product_type ON product_presentations(product_id, presentation_type);
CREATE INDEX idx_pres_barcode_override ON product_presentations(barcode_override);

-- 3. CABECERA DE PRE-VENTA (Generada por la app móvil en campo)
CREATE TABLE pre_sale_orders (
    id VARCHAR(30) PRIMARY KEY,               -- Formato correlativo: 'PED-00892'
    seller_id VARCHAR(36) NOT NULL,
    seller_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE_PAGO' 
        CHECK (status IN ('PENDIENTE_PAGO', 'PAGADO', 'CANCELADO')),
    total_amount DECIMAL(10, 2) NOT NULL,
    total_base_units INTEGER NOT NULL,        -- Total de unidades base comprometidas
    qr_payload TEXT NOT NULL,                 -- Cadena codificada en el QR térmico para Caja
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP WITH TIME ZONE,
    cashier_id VARCHAR(36)
);

-- 4. DETALLE DE PRE-VENTA (Líneas con congelamiento del factor de conversión)
CREATE TABLE pre_sale_items (
    id VARCHAR(36) PRIMARY KEY,
    order_id VARCHAR(30) NOT NULL REFERENCES pre_sale_orders(id) ON DELETE CASCADE,
    product_id VARCHAR(36) NOT NULL REFERENCES products(id),
    presentation_id VARCHAR(36) NOT NULL REFERENCES product_presentations(id),
    presentation_type VARCHAR(20) NOT NULL,
    conversion_factor INTEGER NOT NULL,       -- Guardado históricamente por inmutabilidad
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL,       -- Precio unitario de la presentación
    subtotal DECIMAL(10, 2) NOT NULL,         -- quantity * unit_price
    base_units_deducted INTEGER NOT NULL      -- quantity * conversion_factor
);`;

  const pydanticModel = `# =====================================================================
# MODELOS PYDANTIC PARA FASTAPI (Backend Central de Caja & Almacén)
# =====================================================================
from pydantic import BaseModel, Field, conint, condecimal
from typing import List, Optional, Literal, Dict
from datetime import datetime

PresentationType = Literal['unit', 'half', 'pack']

class PresentationSchema(BaseModel):
    id: str
    type: PresentationType
    label: str                                # "Medio display (12 barras)"
    short_label: str                          # "MED (12u)"
    conversion_factor: conint(ge=1) = Field(
        ..., description="Factor multiplicador hacia la unidad mínima (Ej: 1, 6, 12, 24)"
    )
    sale_price: condecimal(ge=0, decimal_places=2) # Precio fijado independiente
    cost_price: Optional[condecimal(ge=0, decimal_places=2)] = None
    barcode_override: Optional[str] = None
    is_default: bool = False

class ProductSyncResponse(BaseModel):
    id: str
    barcode: str
    name: str
    category: str
    base_unit_name: str                       # 'botella', 'barra', 'sobre', 'paquetito'
    stock_in_base_units: int
    min_stock_alert: int
    presentations: Dict[PresentationType, PresentationSchema]

class CreateOrderItemPayload(BaseModel):
    product_id: str
    presentation_type: PresentationType
    quantity: conint(ge=1)

class CreatePreSalePayload(BaseModel):
    seller_id: str
    seller_name: str
    items: List[CreateOrderItemPayload]

class PreSaleOrderResponse(BaseModel):
    order_id: str                             # Ej: "PED-00892"
    status: Literal['PENDIENTE_PAGO', 'PAGADO', 'CANCELADO']
    total_amount: float
    total_base_units: int
    qr_payload: str                           # "PED-00892" para el escáner de caja
    created_at: datetime
    items: List[dict]`;

  const typeScriptModels = `/**
 * MODELOS TYPESCRIPT PARA REACT NATIVE / EXPO
 */
export type PresentationType = 'unit' | 'half' | 'pack';

export interface ProductPresentation {
  id: string;
  productId: string;
  type: PresentationType;
  label: string;            // "Paquete completo (12 botellas)"
  shortLabel: string;       // "PAQ (12u)"
  conversionFactor: number; // Ej: 12 (descuenta 12 unidades base por cada 1 vendido)
  price: number;            // Precio independiente (Ej: S/ 25.00)
  barcode?: string;
  isDefault?: boolean;
}

export interface Product {
  id: string;
  barcode: string;          // Código de barras del escáner HID
  name: string;
  category: string;
  baseUnitName: string;     // 'botella', 'paquetito', 'barra'
  stockInBaseUnits: number; // Stock total en almacén
  presentations: Record<PresentationType, ProductPresentation>;
}

export interface CartItem {
  cartItemId: string;
  product: Product;
  selectedPresentation: PresentationType;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  deductedBaseUnits: number; // quantity * conversionFactor
}`;

  const jsonSample = `{
  "id": "prod_001",
  "barcode": "7750182001011",
  "name": "Inka Kola 500ml Pet",
  "category": "Bebidas",
  "baseUnitName": "botella",
  "stockInBaseUnits": 240,
  "presentations": {
    "unit": {
      "id": "pres_001_u",
      "type": "unit",
      "label": "Unidad individual (1 botella)",
      "shortLabel": "UND (1b)",
      "conversionFactor": 1,
      "price": 2.50,
      "isDefault": true
    },
    "half": {
      "id": "pres_001_h",
      "type": "half",
      "label": "Medio paquete (6 botellas)",
      "shortLabel": "MED (6b)",
      "conversionFactor": 6,
      "price": 13.50
    },
    "pack": {
      "id": "pres_001_p",
      "type": "pack",
      "label": "Paquete completo (12 botellas)",
      "shortLabel": "PAQ (12b)",
      "conversionFactor": 12,
      "price": 25.00
    }
  }
}`;

  return (
    <div className="space-y-6">
      {/* Banner Principal de Arquitectura Premium */}
      <div className="relative bg-gradient-to-br from-stone-900 via-stone-950 to-stone-900 rounded-3xl border border-amber-500/30 p-6 md:p-8 shadow-2xl overflow-hidden">
        {/* Glow dorado ambiental */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-gradient-to-tr from-amber-500 to-yellow-400 text-stone-950 font-black rounded-2xl shadow-lg shadow-amber-500/20">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-amber-400 uppercase tracking-widest">
                  Paso 1 · Arquitectura Especializada
                </span>
                <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold">
                  Golosinas & Bebidas
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-amber-50 mt-0.5">
                Esquema de Datos, Precios Independientes & Descuento de Stock
              </h2>
            </div>
          </div>

          <p className="text-sm text-stone-300 leading-relaxed max-w-3xl">
            Diseño arquitectónico para tiendas y distribuidoras de golosinas y bebidas con venta dual (menudeo y fardos mayoristas). Resuelve el desacople entre las unidades vendidas en campo y el stock físico central.
          </p>

          {/* 3 Pilares Arquitectónicos Gourmet */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="p-4 rounded-2xl bg-stone-900/90 border border-stone-800 flex flex-col justify-between shadow-lg">
              <div>
                <div className="text-amber-400 font-black text-xs flex items-center gap-1.5 mb-1.5 uppercase tracking-wider">
                  <Wine className="w-4 h-4" />
                  1. Stock en Unidad Mínima
                </div>
                <p className="text-xs text-stone-400 leading-relaxed">
                  El inventario se almacena <strong>siempre</strong> como un entero de la unidad física indivisible (botellas, chupetines sueltos, tabletas). Abrir un fardo de 12 botellas no corrompe el conteo global.
                </p>
              </div>
              <div className="mt-3 text-[11px] font-mono text-amber-300 bg-amber-950/40 px-2.5 py-1.5 rounded-xl border border-amber-900/60 font-bold">
                stock_restante = stock - (cant * factor)
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-stone-900/90 border border-stone-800 flex flex-col justify-between shadow-lg">
              <div>
                <div className="text-rose-400 font-black text-xs flex items-center gap-1.5 mb-1.5 uppercase tracking-wider">
                  <Candy className="w-4 h-4" />
                  2. Precios Independientes
                </div>
                <p className="text-xs text-stone-400 leading-relaxed">
                  El precio de un display no es proporcional: 1 barra cuesta S/ 2.00, pero el display de 24 cuesta S/ 41.00 (S/ 1.70 c/u). Por eso cada presentación tiene su propio campo <code className="text-amber-200">sale_price</code> independiente.
                </p>
              </div>
              <div className="mt-3 text-[11px] font-mono text-rose-300 bg-rose-950/40 px-2.5 py-1.5 rounded-xl border border-rose-900/60 font-bold">
                subtotal = cant * pres.sale_price
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-stone-900/90 border border-stone-800 flex flex-col justify-between shadow-lg">
              <div>
                <div className="text-yellow-400 font-black text-xs flex items-center gap-1.5 mb-1.5 uppercase tracking-wider">
                  <Layers className="w-4 h-4" />
                  3. Factor de Conversión Fijo
                </div>
                <p className="text-xs text-stone-400 leading-relaxed">
                  Cada presentación fija su multiplicador: <strong className="text-stone-200">Unidad (factor 1)</strong>, <strong className="text-stone-200">Medio (factor 6 o 12)</strong>, <strong className="text-stone-200">Paquete (factor 12 o 24)</strong>. El backend almacena este factor históricamente en el ticket.
                </p>
              </div>
              <div className="mt-3 text-[11px] font-mono text-yellow-300 bg-yellow-950/40 px-2.5 py-1.5 rounded-xl border border-yellow-900/60 font-bold">
                factor ∈ [1, 6, 9, 12, 15, 18, 24]
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Laboratorio Interactivo de Conversión de Stock */}
      <div className="bg-stone-900/90 rounded-3xl border border-stone-800 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <Calculator className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-black text-amber-50">
              Laboratorio del Motor de Conversión de Golosinas y Bebidas
            </h3>
          </div>
          <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full font-mono font-bold">
            Simulador de Stock en Tiempo Real
          </span>
        </div>

        {/* Controles interactivos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          {/* Selector de Producto */}
          <div>
            <label className="text-[11px] font-bold text-stone-300 uppercase tracking-wider block mb-1.5">
              Producto (Catálogo)
            </label>
            <div className="relative">
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-sm text-amber-100 focus:outline-hidden focus:border-amber-500 font-bold"
              >
                {INITIAL_PRODUCTS.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.stockInBaseUnits} {p.baseUnitName}s)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Selector de Presentación */}
          <div>
            <label className="text-[11px] font-bold text-stone-300 uppercase tracking-wider block mb-1.5">
              Presentación de Venta
            </label>
            <div className="grid grid-cols-3 gap-1 bg-stone-950 p-1 rounded-xl border border-stone-800">
              {(['unit', 'half', 'pack'] as PresentationType[]).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedPresType(type)}
                  className={`py-1.5 text-xs font-black rounded-lg uppercase transition ${
                    selectedPresType === type 
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-stone-950 shadow-md' 
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {type === 'unit' ? 'UND' : type === 'half' ? 'MEDIO' : 'PAQUETE'}
                </button>
              ))}
            </div>
          </div>

          {/* Selector de Cantidad */}
          <div>
            <label className="text-[11px] font-bold text-stone-300 uppercase tracking-wider block mb-1.5">
              Cantidad a Vender
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="50"
                value={testQuantity}
                onChange={(e) => setTestQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-amber-100 font-mono font-black focus:outline-hidden focus:border-amber-500"
              />
              <span className="text-xs text-stone-400 font-bold whitespace-nowrap">
                {selectedPres.shortLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Visualización de Cálculos Matemáticos */}
        <div className="bg-stone-950 rounded-2xl border border-stone-800 p-5 shadow-inner">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-center sm:text-left">
            {/* Subtotal */}
            <div className="p-3.5 rounded-xl bg-stone-900 border border-stone-800">
              <div className="text-[10px] text-stone-400 uppercase font-bold tracking-wider">Subtotal Venta</div>
              <div className="text-2xl font-black text-amber-400 font-mono mt-1">
                S/ {(testQuantity * selectedPres.price).toFixed(2)}
              </div>
              <div className="text-[10px] text-stone-500 mt-0.5">
                {testQuantity} x S/ {selectedPres.price.toFixed(2)}
              </div>
            </div>

            {/* Factor de Conversión */}
            <div className="p-3.5 rounded-xl bg-stone-900 border border-stone-800">
              <div className="text-[10px] text-stone-400 uppercase font-bold tracking-wider">Factor Conversión</div>
              <div className="text-2xl font-black text-yellow-300 font-mono mt-1">
                x{selectedPres.conversionFactor} {selectedProduct.baseUnitName}s
              </div>
              <div className="text-[10px] text-stone-500 mt-0.5">
                Por cada 1 {selectedPresType}
              </div>
            </div>

            {/* Unidades a Descontar */}
            <div className="p-3.5 rounded-xl bg-stone-900 border border-stone-800">
              <div className="text-[10px] text-stone-400 uppercase font-bold tracking-wider">Descuento de Stock</div>
              <div className="text-2xl font-black text-rose-400 font-mono mt-1">
                -{totalDeduction} {selectedProduct.baseUnitName}s
              </div>
              <div className="text-[10px] text-stone-500 mt-0.5">
                {testQuantity} x {selectedPres.conversionFactor} unidades base
              </div>
            </div>

            {/* Stock Resultante */}
            <div className={`p-3.5 rounded-xl border ${
              isStockOk 
                ? 'bg-stone-900 border-stone-800' 
                : 'bg-rose-950/60 border-rose-500/60'
            }`}>
              <div className="text-[10px] text-stone-400 uppercase font-bold tracking-wider">Stock Restante</div>
              <div className={`text-2xl font-black font-mono mt-1 ${isStockOk ? 'text-stone-100' : 'text-rose-400'}`}>
                {remainingStock} {selectedProduct.baseUnitName}s
              </div>
              <div className={`text-[10px] mt-0.5 ${isStockOk ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-bold'}`}>
                {isStockOk ? '✓ Stock disponible' : '⚠ ¡Stock insuficiente!'}
              </div>
            </div>
          </div>

          {/* Desglose mixto para el personal de despacho */}
          <div className="mt-4 pt-4 border-t border-stone-800 flex items-center justify-between flex-wrap gap-2 text-xs">
            <span className="text-stone-400">
              Equivalencia física del inventario restante ({Math.max(0, remainingStock)} {selectedProduct.baseUnitName}s):
            </span>
            <div className="flex items-center gap-2 font-mono text-amber-300 bg-stone-900 px-3.5 py-1.5 rounded-xl border border-stone-800 shadow-xs font-bold">
              <span><strong>{remainingPacks}</strong> Paquetes</span>
              <span className="text-stone-600">·</span>
              <span><strong>{remainingHalves}</strong> Medios</span>
              <span className="text-stone-600">·</span>
              <span><strong>{remainingUnits}</strong> Sueltas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Visor de Código / Esquema Listo para Copiar */}
      <div className="bg-stone-900/90 rounded-3xl border border-stone-800 overflow-hidden shadow-2xl">
        <div className="p-4 md:p-5 border-b border-stone-800 flex flex-wrap items-center justify-between gap-3 bg-stone-900">
          <div className="flex items-center gap-2.5">
            <FileCode className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-black text-amber-50">
              Especificación Técnica del Esquema
            </h3>
          </div>

          <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-xl border border-stone-800">
            <button
              type="button"
              onClick={() => setActiveSchemaTab('sql')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeSchemaTab === 'sql' 
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-stone-950 font-black' 
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              SQL (Postgres / SQLite)
            </button>
            <button
              type="button"
              onClick={() => setActiveSchemaTab('pydantic')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeSchemaTab === 'pydantic' 
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-stone-950 font-black' 
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              FastAPI (Python)
            </button>
            <button
              type="button"
              onClick={() => setActiveSchemaTab('typescript')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeSchemaTab === 'typescript' 
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-stone-950 font-black' 
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              TypeScript (React Native)
            </button>
            <button
              type="button"
              onClick={() => setActiveSchemaTab('json')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeSchemaTab === 'json' 
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-stone-950 font-black' 
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              JSON Payload
            </button>
          </div>
        </div>

        {/* Visor de Código */}
        <div className="relative p-5 bg-stone-950 overflow-x-auto max-h-[480px]">
          <button
            type="button"
            onClick={() => {
              const text = 
                activeSchemaTab === 'sql' ? sqlDDL :
                activeSchemaTab === 'pydantic' ? pydanticModel :
                activeSchemaTab === 'typescript' ? typeScriptModels : jsonSample;
              copyToClipboard(text, activeSchemaTab);
            }}
            className="absolute top-4 right-4 z-10 px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-amber-200 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-lg"
          >
            {copied === activeSchemaTab ? (
              <>
                <Check className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-400">Copiado</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Código</span>
              </>
            )}
          </button>

          <pre className="font-mono text-xs text-amber-100/90 leading-relaxed pr-24 selection:bg-amber-500 selection:text-stone-950">
            <code>
              {activeSchemaTab === 'sql' && sqlDDL}
              {activeSchemaTab === 'pydantic' && pydanticModel}
              {activeSchemaTab === 'typescript' && typeScriptModels}
              {activeSchemaTab === 'json' && jsonSample}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
};
