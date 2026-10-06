import React from 'react';
import { Order } from '../types/pos';
import { ExtendedProduct } from '../data/mockProducts';
import { playBarcodeBeep, playSuccessChime } from '../utils/audioBeep';
import { 
  QrCode, 
  Search, 
  DollarSign, 
  CreditCard, 
  Smartphone, 
  CheckCircle2, 
  Printer, 
  Clock, 
  AlertCircle, 
  RotateCcw,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface Props {
  orders: Order[];
  onOrderPaid: (orderId: string, paymentMethod: string) => void;
  products: ExtendedProduct[];
  onOpenMobileTerminal: () => void;
}

export const CashierCheckoutSimulator: React.FC<Props> = ({
  orders,
  onOrderPaid,
  products,
  onOpenMobileTerminal,
}) => {
  const [scannedCode, setScannedCode] = React.useState<string>('');
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = React.useState<'Efectivo' | 'Yape' | 'Tarjeta'>('Efectivo');
  const [cashGiven, setCashGiven] = React.useState<string>('50');
  const [checkoutComplete, setCheckoutComplete] = React.useState<boolean>(false);
  const [searchFilter, setSearchFilter] = React.useState<string>('');

  const pendingOrders = orders.filter(o => o.status === 'PENDIENTE_PAGO');
  const paidOrders = orders.filter(o => o.status === 'PAGADO');

  // Buscar orden por ID o código escaneado del QR
  const handleScanOrSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = scannedCode.trim().toUpperCase();
    const found = orders.find(o => o.id.toUpperCase() === cleanId || o.qrPayload.toUpperCase() === cleanId);

    if (found) {
      playBarcodeBeep();
      setSelectedOrder(found);
      setScannedCode('');
      setCheckoutComplete(false);
      if (paymentMethod === 'Efectivo') {
        const nextRounded = Math.ceil(found.totalAmount / 10) * 10;
        setCashGiven(String(Math.max(found.totalAmount, nextRounded)));
      }
    } else {
      alert(`No se encontró ningún pedido con el código: ${cleanId}`);
    }
  };

  const handleSelectOrder = (order: Order) => {
    playBarcodeBeep();
    setSelectedOrder(order);
    setCheckoutComplete(false);
    const nextRounded = Math.ceil(order.totalAmount / 10) * 10;
    setCashGiven(String(Math.max(order.totalAmount, nextRounded)));
  };

  const cashGivenNum = parseFloat(cashGiven) || 0;
  const changeDue = selectedOrder ? Math.max(0, cashGivenNum - selectedOrder.totalAmount) : 0;
  const isCashSufficient = selectedOrder ? cashGivenNum >= selectedOrder.totalAmount : true;

  const handleExecuteCheckout = () => {
    if (!selectedOrder) return;
    if (selectedOrder.status === 'PAGADO') {
      alert('Este pedido ya fue pagado previamente.');
      return;
    }
    if (paymentMethod === 'Efectivo' && !isCashSufficient) {
      alert('El monto en efectivo entregado es menor al total a pagar.');
      return;
    }

    playSuccessChime();
    onOrderPaid(selectedOrder.id, paymentMethod);
    setCheckoutComplete(true);
  };

  return (
    <div className="w-full max-w-5xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in text-slate-800">
      {/* Header Caja Mostrador */}
      <div className="bg-[#15803d] text-white p-5 md:p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white shadow-md">
            <QrCode className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight">
                Caja Principal de Cobro (Mostrador Escritorio)
              </h2>
              <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase">
                CAJERO 01
              </span>
            </div>
            <p className="text-xs text-white/80">
              Escanea el Código QR del ticket de pre-venta traído por el cliente para cobrar y descargar stock
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenMobileTerminal}
          className="px-4 py-2 bg-white text-emerald-900 hover:bg-slate-100 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md flex items-center gap-1.5"
        >
          <Smartphone className="w-4 h-4 text-emerald-700" />
          <span>Ir a Terminal Pre-Venta</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        {/* Columna Izquierda: Escaneo y Lista de Pre-Ventas Pendientes */}
        <div className="lg:col-span-5 p-5 space-y-4 bg-slate-50">
          {/* Lector de QR de Mostrador */}
          <div className="bg-white p-4 rounded-2xl border-2 border-emerald-500 shadow-sm space-y-2">
            <label className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-[#16a34a]" />
              <span>Escanear Código QR del Ticket Térmico</span>
            </label>
            <form onSubmit={handleScanOrSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="Disparar lector o escribir PED-00892..."
                value={scannedCode}
                onChange={(e) => setScannedCode(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:border-[#16a34a]"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white font-black text-xs uppercase rounded-xl shadow-xs transition"
              >
                Cargar
              </button>
            </form>
            <p className="text-[10px] text-slate-500">
              El cliente entrega el papel con el QR que generó el preventista en la app móvil.
            </p>
          </div>

          {/* Lista de Pre-Ventas Pendientes en Espera de Pago */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black text-slate-700 uppercase">
                Pedidos en Cola de Cobro ({pendingOrders.length})
              </span>
              <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded-full">
                Pendientes de Pago
              </span>
            </div>

            {pendingOrders.length === 0 ? (
              <div className="p-6 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 space-y-2">
                <Clock className="w-8 h-8 mx-auto text-slate-300" />
                <p className="font-bold text-xs">No hay tickets pendientes en caja</p>
                <p className="text-[11px]">Genera una pre-venta desde la terminal móvil para probar el cobro en mostrador.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {pendingOrders.map((ord) => (
                  <div
                    key={ord.id}
                    onClick={() => handleSelectOrder(ord)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                      selectedOrder?.id === ord.id
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/30 shadow-md'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-mono text-slate-900">{ord.id}</strong>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                          {ord.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {ord.sellerName} · {ord.items.length} productos ({ord.totalBaseUnits} unds)
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-black font-mono text-slate-900">
                        S/ {ord.totalAmount.toFixed(2)}
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700">Cobrar ➔</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: Pantalla de Cobro, Medios de Pago y Emisión de Comprobante */}
        <div className="lg:col-span-7 p-6 space-y-5 bg-white">
          {selectedOrder ? (
            <div className="space-y-5">
              {/* Resumen del Pedido Cargado */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Cuenta Cargada:</span>
                    <h3 className="text-lg font-black text-slate-900 font-mono">
                      {selectedOrder.id}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Total Cuenta:</span>
                    <div className="text-2xl font-black text-[#16a34a] font-mono">
                      S/ {selectedOrder.totalAmount.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Ítems */}
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 text-xs">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-100">
                      <div>
                        <strong className="text-slate-800">
                          {item.quantity}x [{item.presentationType.toUpperCase()}] {item.productName}
                        </strong>
                        <span className="text-[10px] text-slate-500 ml-1">
                          (x{item.conversionFactor} = {item.baseUnitsDeducted} base)
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slate-800">
                        S/ {item.subtotal.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {checkoutComplete ? (
                /* Estado Exitoso de Cobro Finalizado */
                <div className="p-6 bg-emerald-50 rounded-2xl border-2 border-emerald-500 text-center space-y-3 animate-in zoom-in-95 duration-200">
                  <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/25">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h3 className="text-lg font-black text-emerald-950 uppercase">
                    ¡Cobro Exitoso & Boleta Electrónica Emitida!
                  </h3>
                  <p className="text-xs text-emerald-800 max-w-md mx-auto">
                    El pedido <strong className="font-mono">{selectedOrder.id}</strong> pasó a estado <strong className="font-mono">PAGADO</strong>. Se descontaron automáticamente <strong>{selectedOrder.totalBaseUnits} unidades base</strong> del almacén central.
                  </p>
                  <div className="pt-2 flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => alert(`Imprimiendo comprobante fiscal final para pedido ${selectedOrder.id}...`)}
                      className="px-4 py-2 bg-[#16a34a] text-white font-bold text-xs uppercase rounded-xl shadow-xs"
                    >
                      Imprimir Boleta / Factura
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(null)}
                      className="px-4 py-2 bg-slate-200 text-slate-700 font-bold text-xs uppercase rounded-xl"
                    >
                      Siguiente Cobro
                    </button>
                  </div>
                </div>
              ) : (
                /* Formulario de Cobro en Mostrador */
                <div className="space-y-4">
                  {/* Selector de Métodos de Pago */}
                  <div>
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wide block mb-2">
                      Seleccionar Medio de Pago
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'Efectivo', icon: <DollarSign className="w-4 h-4" />, label: 'Efectivo' },
                        { id: 'Yape', icon: <Smartphone className="w-4 h-4" />, label: 'Yape / Plin' },
                        { id: 'Tarjeta', icon: <CreditCard className="w-4 h-4" />, label: 'Tarjeta' },
                      ].map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPaymentMethod(m.id as any)}
                          className={`p-3 rounded-xl border text-xs font-black flex items-center justify-center gap-2 transition ${
                            paymentMethod === m.id
                              ? 'bg-[#16a34a] text-white border-[#16a34a] shadow-md'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {m.icon}
                          <span>{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cálculo de Efectivo y Vuelto */}
                  {paymentMethod === 'Efectivo' && (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                            Efectivo Recibido (S/):
                          </label>
                          <input
                            type="number"
                            step="1"
                            value={cashGiven}
                            onChange={(e) => setCashGiven(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-base font-black font-mono text-slate-900 focus:outline-hidden focus:border-[#16a34a]"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                            Vuelto a Entregar:
                          </label>
                          <div className={`text-xl font-black font-mono py-1.5 px-3 rounded-xl border ${
                            isCashSufficient
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            S/ {changeDue.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Botones de billetes rápidos */}
                      <div className="flex gap-2 pt-1">
                        {[20, 50, 100, 200].map(bill => (
                          <button
                            key={bill}
                            type="button"
                            onClick={() => setCashGiven(String(bill))}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold font-mono"
                          >
                            S/ {bill}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Botón de Ejecución del Cobro */}
                  <button
                    type="button"
                    disabled={paymentMethod === 'Efectivo' && !isCashSufficient}
                    onClick={handleExecuteCheckout}
                    className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition active:scale-98 ${
                      paymentMethod === 'Efectivo' && !isCashSufficient
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        : 'bg-[#16a34a] hover:bg-[#15803d] text-white shadow-emerald-700/30 cursor-pointer'
                    }`}
                  >
                    <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                    <span>Realizar Cobro Final (S/ {selectedOrder.totalAmount.toFixed(2)}) & Descontar Stock</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="py-20 text-center text-slate-400 space-y-3">
              <QrCode className="w-16 h-16 mx-auto text-slate-300 stroke-[1.5]" />
              <h3 className="text-base font-black text-slate-700">Esperando Escaneo de Ticket Térmico</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Selecciona una orden de la lista izquierda o simula el escaneo del Código QR impreso para cargar los productos y realizar el cobro.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
