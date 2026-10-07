import React from 'react';
import { Order } from '../types/pos';
import { ExtendedProduct } from '../data/mockProducts';
import { playBarcodeBeep, playSuccessChime } from '../utils/audioBeep';
import { 
  QrCode, 
  DollarSign, 
  CreditCard, 
  Smartphone, 
  CheckCircle2, 
  Clock,
  Search,
  Printer,
  Receipt,
  Coins
} from 'lucide-react';

interface Props {
  orders: Order[];
  onOrderPaid: (orderId: string, paymentMethod: string, paidAmount?: number, debtAmount?: number) => void;
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
  const [paymentMethod, setPaymentMethod] = React.useState<'Efectivo' | 'Yape' | 'Tarjeta' | 'Mixto'>('Efectivo');
  const [cashGiven, setCashGiven] = React.useState<string>('50');
  const [mixedAmounts, setMixedAmounts] = React.useState({ efectivo: 0, yape: 0, tarjeta: 0 });
  const [checkoutComplete, setCheckoutComplete] = React.useState<boolean>(false);
  const [isFiado, setIsFiado] = React.useState<boolean>(false);
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [queueTab, setQueueTab] = React.useState<'PENDIENTE' | 'PAGADO'>('PENDIENTE');

  const pendingOrders = orders.filter(o => o.status === 'PENDIENTE_PAGO');
  const paidOrders = orders.filter(o => o.status === 'PAGADO');

  const currentList = queueTab === 'PENDIENTE' ? pendingOrders : paidOrders;
  const filteredList = currentList.filter(o => 
    o.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (o.customerName || '').toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Buscar orden por ID o código escaneado del QR
  const handleScanOrSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = scannedCode.trim().toUpperCase();
    const found = orders.find(o => o.id.toUpperCase() === cleanId || o.qrPayload.toUpperCase() === cleanId);

    if (found) {
      playBarcodeBeep();
      setSelectedOrder(found);
      setScannedCode('');
      setCheckoutComplete(found.status === 'PAGADO');
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
    setCheckoutComplete(order.status === 'PAGADO');
    const nextRounded = Math.ceil(order.totalAmount / 10) * 10;
    setCashGiven(String(Math.max(order.totalAmount, nextRounded)));
    setMixedAmounts({ efectivo: order.totalAmount, yape: 0, tarjeta: 0 });
  };

  const cashGivenNum = parseFloat(cashGiven) || 0;
  
  // Para pago mixto:
  const mixedTotal = mixedAmounts.efectivo + mixedAmounts.yape + mixedAmounts.tarjeta;
  const changeDue = paymentMethod === 'Mixto' 
    ? Math.max(0, mixedTotal - (selectedOrder?.totalAmount || 0))
    : (selectedOrder ? Math.max(0, cashGivenNum - selectedOrder.totalAmount) : 0);
    
  const isCashSufficient = paymentMethod === 'Mixto' 
    ? mixedTotal >= (selectedOrder?.totalAmount || 0)
    : (selectedOrder ? cashGivenNum >= selectedOrder.totalAmount : true);
    
  const missingAmount = selectedOrder ? Math.max(0, selectedOrder.totalAmount - (paymentMethod === 'Mixto' ? mixedTotal : cashGivenNum)) : 0;

  const handleExecuteCheckout = () => {
    if (!selectedOrder) return;
    if (selectedOrder.status === 'PAGADO') {
      alert('Este pedido ya fue pagado previamente.');
      return;
    }
    
    if (!isCashSufficient && !isFiado) {
      alert('El monto ingresado es menor al total a pagar. Si deseas dar fiado, activa el interruptor de Crédito.');
      return;
    }
    
    if (isFiado && (!selectedOrder.customerRuc && !selectedOrder.customerName)) {
       // Ideally we check for RUC but name works as fallback
    }

    playSuccessChime();
    const finalMethod = paymentMethod === 'Mixto' 
      ? `Mixto (Ef: ${mixedAmounts.efectivo}, Yp: ${mixedAmounts.yape}, Tj: ${mixedAmounts.tarjeta})` 
      : paymentMethod;
      
    const paidAmt = paymentMethod === 'Mixto' ? mixedTotal : (isFiado ? cashGivenNum : selectedOrder.totalAmount);
    const debtAmt = isFiado ? missingAmount : 0;
    
    onOrderPaid(selectedOrder.id, finalMethod, paidAmt, debtAmt);
    setCheckoutComplete(true);
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-slate-50 md:p-6 animate-in fade-in text-slate-800 flex justify-center">
      <div className="w-full h-max max-w-5xl bg-white md:rounded-3xl border-0 md:border border-slate-200 md:shadow-2xl overflow-hidden flex flex-col">
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

          {/* Lista de Pre-Ventas y Pestañas */}
          <div className="space-y-2">
            <div className="flex bg-slate-200 p-1 rounded-xl mb-3">
              <button
                type="button"
                onClick={() => setQueueTab('PENDIENTE')}
                className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition ${
                  queueTab === 'PENDIENTE' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Por Cobrar ({pendingOrders.length})
              </button>
              <button
                type="button"
                onClick={() => setQueueTab('PAGADO')}
                className={`flex-1 py-1.5 text-[11px] font-black uppercase rounded-lg transition ${
                  queueTab === 'PAGADO' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Historial ({paidOrders.length})
              </button>
            </div>

            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-black text-slate-700 uppercase">
                {queueTab === 'PENDIENTE' ? 'Pedidos en Cola' : 'Tickets Completados'} ({filteredList.length})
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${queueTab === 'PENDIENTE' ? 'text-amber-700 bg-amber-100' : 'text-emerald-700 bg-emerald-100'}`}>
                {queueTab === 'PENDIENTE' ? 'Pendientes de Pago' : 'Ya Pagados'}
              </span>
            </div>
            
            {/* Buscador de Clientes / Pedidos */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input 
                type="text"
                placeholder="Buscar por cliente o código de pedido..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:border-[#16a34a] focus:outline-hidden"
              />
            </div>

            {filteredList.length === 0 ? (
              <div className="p-6 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 space-y-2">
                <Clock className="w-8 h-8 mx-auto text-slate-300" />
                <p className="font-bold text-xs">No hay tickets {queueTab === 'PENDIENTE' ? 'pendientes' : 'pagados'}</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {filteredList.map((ord) => (
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
                      <div className="text-[11px] font-bold text-slate-700 mt-1 flex items-center justify-between gap-2">
                        <span className="truncate">{ord.customerName || 'Cliente Genérico'}</span>
                        <span className="text-[9px] font-mono font-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                          {new Date(ord.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {ord.sellerName} · {ord.items.length} productos ({ord.totalBaseUnits} unds)
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-black font-mono text-slate-900">
                        S/ {ord.totalAmount.toFixed(2)}
                      </div>
                      <span className={`text-[10px] font-bold ${ord.status === 'PAGADO' ? 'text-blue-600' : 'text-emerald-700'}`}>
                        {ord.status === 'PAGADO' ? 'Ver Boleta ➔' : 'Cobrar ➔'}
                      </span>
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
                  <div className="pt-2 flex flex-col md:flex-row justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const printWindow = window.open('', '_blank');
                        if (printWindow) {
                          printWindow.document.write(`
                            <html><head><title>Boleta de Venta - ${selectedOrder.id}</title>
                            <style>
                              body { font-family: monospace; width: 300px; margin: 0 auto; padding: 20px; color: black; }
                              h2, h3 { text-align: center; margin: 5px 0; }
                              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                              th, td { text-align: left; padding: 4px 0; border-bottom: 1px dashed #ccc; font-size: 12px; }
                              .right { text-align: right; }
                              .total { font-weight: bold; font-size: 14px; }
                            </style>
                            </head><body>
                              <h2>DULCES & BEBIDAS</h2>
                              <h3>RUC: 20123456789</h3>
                              <p style="text-align:center; font-size: 12px;">Comprobante de Pago Electrónico<br>Ticket: ${selectedOrder.id}</p>
                              <hr style="border: 1px dashed black;" />
                              <p style="font-size: 12px;">
                                Cliente: ${selectedOrder.customerName || 'Cliente Genérico'}<br>
                                Fecha: ${new Date().toLocaleString()}<br>
                                Pago: ${paymentMethod}
                              </p>
                              <table>
                                <tr><th>Cant</th><th>Descripción</th><th class="right">Importe</th></tr>
                                ${selectedOrder.items.map(item => `
                                  <tr>
                                    <td>${item.quantity}</td>
                                    <td>${item.productName.substring(0, 15)}...</td>
                                    <td class="right">S/ ${item.subtotal.toFixed(2)}</td>
                                  </tr>
                                `).join('')}
                              </table>
                              <p class="right total">TOTAL: S/ ${selectedOrder.totalAmount.toFixed(2)}</p>
                              <hr style="border: 1px dashed black;" />
                              <p style="text-align:center; font-size: 11px;">¡Gracias por su compra!</p>
                            </body></html>
                          `);
                          printWindow.document.close();
                          printWindow.print();
                        }
                      }}
                      className="px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-xs uppercase rounded-xl shadow-md flex items-center justify-center gap-2 transition"
                    >
                      <Printer className="w-4 h-4" />
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { id: 'Efectivo', icon: <DollarSign className="w-4 h-4" />, label: 'Efectivo' },
                        { id: 'Yape', icon: <Smartphone className="w-4 h-4" />, label: 'Yape / Plin' },
                        { id: 'Tarjeta', icon: <CreditCard className="w-4 h-4" />, label: 'Tarjeta' },
                        { id: 'Mixto', icon: <Coins className="w-4 h-4" />, label: 'Mixto' },
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
                      <div className="flex gap-2 pt-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setCashGiven(String(selectedOrder.totalAmount))}
                          className="px-2.5 py-1 bg-[#16a34a] text-white border border-[#16a34a] rounded-lg text-xs font-bold font-mono shadow-sm"
                        >
                          Exacto
                        </button>
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

                  {/* Cálculo Pago Mixto */}
                  {paymentMethod === 'Mixto' && (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Efectivo S/</label>
                          <input type="number" value={mixedAmounts.efectivo} onChange={(e) => setMixedAmounts({...mixedAmounts, efectivo: parseFloat(e.target.value) || 0})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-mono focus:border-[#16a34a] focus:outline-hidden" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Yape/Plin S/</label>
                          <input type="number" value={mixedAmounts.yape} onChange={(e) => setMixedAmounts({...mixedAmounts, yape: parseFloat(e.target.value) || 0})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-mono focus:border-[#16a34a] focus:outline-hidden" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Tarjeta S/</label>
                          <input type="number" value={mixedAmounts.tarjeta} onChange={(e) => setMixedAmounts({...mixedAmounts, tarjeta: parseFloat(e.target.value) || 0})} className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-mono focus:border-[#16a34a] focus:outline-hidden" />
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                        <span className="text-[11px] font-bold text-slate-600 uppercase">Suma Ingresada: S/ {mixedTotal.toFixed(2)}</span>
                        <div className={`text-sm font-black font-mono py-1 px-3 rounded-lg border ${
                          isCashSufficient
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : (isFiado ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200')
                        }`}>
                          {changeDue > 0 ? `Vuelto: S/ ${changeDue.toFixed(2)}` : (missingAmount > 0 ? (isFiado ? `Deuda: S/ ${missingAmount.toFixed(2)}` : `Falta: S/ ${missingAmount.toFixed(2)}`) : 'Suma Exacta')}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Toggle para FIADO si falta dinero */}
                  {(!isCashSufficient) && (
                    <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-xl flex items-center justify-between animate-in zoom-in-95">
                      <div className="space-y-0.5">
                        <label className="text-xs font-black text-amber-900 uppercase">Falta S/ {missingAmount.toFixed(2)}</label>
                        <p className="text-[10px] text-amber-700 font-bold">¿Registrar esta falta como Crédito / Fiado?</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={isFiado} onChange={(e) => setIsFiado(e.target.checked)} />
                        <div className="w-11 h-6 bg-amber-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-amber-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                      </label>
                    </div>
                  )}

                  {/* Botón de Ejecución del Cobro */}
                  <button
                    type="button"
                    disabled={!isCashSufficient && !isFiado}
                    onClick={handleExecuteCheckout}
                    className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition active:scale-98 ${
                      !isCashSufficient && !isFiado
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
    </div>
  );
};
