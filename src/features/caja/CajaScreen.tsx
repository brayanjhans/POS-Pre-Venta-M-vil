import React from 'react';
import type { Order, PaymentMethod } from '../../types/pos';
import { playBarcodeBeep, playSuccessChime } from '../../lib/audioBeep';
import { escapeHtml } from '../../lib/html';
import { parseAmount, round2 } from '../../domain/money';
import { usePos } from '../../state/PosContext';
import { useDialog } from '../../app/DialogProvider';
import { DebtsPanel } from '../shared/DebtsPanel';
import { HeaderButton, ScreenHeader } from '../../app/ScreenHeader';
import { MenuButton, ProfileSection } from '../../app/ProfileMenu';
import { CameraScanner } from '../shared/CameraScanner';
import {
  QrCode,
  Camera,
  DollarSign,
  CreditCard,
  Smartphone,
  CheckCircle2,
  Clock,
  Search,
  Printer,
  Coins,
  Ban,
  CloudOff,
  HandCoins,
  X
} from 'lucide-react';

type CashierMethod = 'Efectivo' | 'Yape' | 'Tarjeta' | 'Mixto';

const roundUpBill = (total: number) => Math.max(total, Math.ceil(total / 10) * 10);

export const CajaScreen: React.FC = () => {
  const { api, orders, catalog, online, session, upsertOrder, handleError, refreshOrders } = usePos();
  const dialog = useDialog();
  const settings = catalog?.settings;
  const [scannedCode, setScannedCode] = React.useState<string>('');
  const [cameraOpen, setCameraOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const checkoutRef = React.useRef<HTMLDivElement>(null);
  const [selectedOrderId, setSelectedOrderId] = React.useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = React.useState<CashierMethod>('Efectivo');
  const [amountGiven, setAmountGiven] = React.useState<string>('');
  const [mixedAmounts, setMixedAmounts] = React.useState({ efectivo: '', yape: '', tarjeta: '' });
  const [lastChange, setLastChange] = React.useState<number>(0);
  const [isFiado, setIsFiado] = React.useState<boolean>(false);
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [queueTab, setQueueTab] = React.useState<'PENDIENTE' | 'PAGADO'>('PENDIENTE');
  const [showDebts, setShowDebts] = React.useState<boolean>(false);

  const selectedOrder = orders.find(o => o.id === selectedOrderId) ?? null;
  const checkoutComplete = selectedOrder !== null && selectedOrder.status !== 'PENDIENTE_PAGO';

  const pendingOrders = orders.filter(o => o.status === 'PENDIENTE_PAGO');
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  // Historial: lo cobrado o fiado hoy.
  const paidOrders = orders.filter(o => (o.status === 'PAGADO' || o.status === 'FIADO') && o.paidAt && new Date(o.paidAt) >= startOfToday);

  const currentList = queueTab === 'PENDIENTE' ? pendingOrders : paidOrders;
  const filteredList = currentList.filter(o =>
    o.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.customerName || '').toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  /** Prepara el formulario de cobro desde cero para cada pedido (evita arrastrar "fiado" del anterior). */
  const loadOrder = (order: Order) => {
    playBarcodeBeep();
    // En el celular el cobro está debajo de la lista: llevar la vista hasta allí.
    setTimeout(() => checkoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    setSelectedOrderId(order.id);
    setIsFiado(false);
    setLastChange(0);
    setPaymentMethod('Efectivo');
    setAmountGiven(String(roundUpBill(order.totalAmount)));
    setMixedAmounts({ efectivo: String(order.totalAmount), yape: '', tarjeta: '' });
  };

  // Buscar orden por código escaneado del QR (primero en la cola local, luego en el servidor)
  const handleScanOrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await lookupCode(scannedCode);
  };

  const lookupCode = async (code: string) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;
    let found = orders.find(o => o.code === cleanCode || o.qrPayload === cleanCode);
    if (!found && api) {
      try {
        found = await api.getOrder(cleanCode);
        upsertOrder(found);
      } catch (err) {
        void dialog.alert(handleError(err), { tone: 'danger', title: 'Pedido no encontrado' });
        return;
      }
    }
    if (found) {
      loadOrder(found);
      setScannedCode('');
    } else {
      void dialog.alert(`No se encontró ningún pedido con el código ${cleanCode}.`, { tone: 'warning', title: 'Pedido no encontrado' });
    }
  };

  const handleSelectOrder = (order: Order) => loadOrder(order);

  // ---- cálculo de montos ----
  const num = (text: string) => {
    const n = parseAmount(text || '0');
    return Number.isNaN(n) ? 0 : n;
  };
  const total = selectedOrder?.totalAmount ?? 0;
  const payments: { method: PaymentMethod; amount: number }[] = paymentMethod === 'Mixto'
    ? [
        { method: 'Efectivo' as PaymentMethod, amount: num(mixedAmounts.efectivo) },
        { method: 'Yape' as PaymentMethod, amount: num(mixedAmounts.yape) },
        { method: 'Tarjeta' as PaymentMethod, amount: num(mixedAmounts.tarjeta) },
      ].filter(p => p.amount > 0)
    : [{ method: paymentMethod, amount: num(amountGiven) }];
  const received = round2(payments.reduce((acc, p) => acc + p.amount, 0));
  const cashReceived = payments.filter(p => p.method === 'Efectivo').reduce((acc, p) => acc + p.amount, 0);
  const changeDue = round2(Math.max(0, received - total));
  const isCashSufficient = received >= total;
  const missingAmount = round2(Math.max(0, total - received));
  // El vuelto solo se puede entregar en efectivo.
  const invalidChange = changeDue > cashReceived;

  const handleExecuteCheckout = async () => {
    if (!selectedOrder || !api || isProcessing) return;
    if (invalidChange) {
      void dialog.alert('Los pagos con Yape o Tarjeta no pueden superar el total: el vuelto solo se entrega en efectivo.', { tone: 'warning' });
      return;
    }
    if (!isCashSufficient && !isFiado) {
      void dialog.alert('El monto ingresado es menor al total a pagar. Si desea dar fiado, active el interruptor de Crédito.', { tone: 'warning', title: 'Falta dinero' });
      return;
    }
    if (isFiado && !isCashSufficient && !selectedOrder.customerId) {
      void dialog.alert('Para fiar, el pedido debe tener un cliente registrado. Pida al vendedor que lo asigne.', { tone: 'warning', title: 'Falta el cliente' });
      return;
    }

    setIsProcessing(true);
    try {
      const result = await api.checkout(selectedOrder.id, payments, isFiado && !isCashSufficient);
      playSuccessChime();
      setLastChange(result.change);
      const { change: _change, ...order } = result;
      upsertOrder(order);
    } catch (err) {
      void dialog.alert(handleError(err), { tone: 'danger', title: 'No se pudo cobrar' });
      void refreshOrders();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelPending = async () => {
    if (!selectedOrder || !api) return;
    const reason = await dialog.prompt('Escriba el motivo de la anulación:',
      { title: `Anular ${selectedOrder.code}`, tone: 'danger', placeholder: 'Ej. Cliente canceló el pedido', confirmText: 'Anular', validate: v => (v.trim().length < 3 ? 'Escriba el motivo (mínimo 3 letras).' : null) });
    if (!reason?.trim()) return;
    try {
      upsertOrder(await api.cancelOrder(selectedOrder.id, reason.trim()));
      setSelectedOrderId(null);
    } catch (err) {
      void dialog.alert(handleError(err), { tone: 'danger' });
    }
  };

  /** Nota de venta (no es comprobante SUNAT). Todo texto se escapa antes de insertarlo en el HTML. */
  const printSaleNote = (order: Order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const e = escapeHtml;
    printWindow.document.write(`
      <html><head><title>Nota de Venta - ${e(order.code)}</title>
      <style>
        body { font-family: monospace; width: 300px; margin: 0 auto; padding: 20px; color: black; }
        h2, h3 { text-align: center; margin: 5px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { text-align: left; padding: 4px 0; border-bottom: 1px dashed #ccc; font-size: 12px; }
        .right { text-align: right; }
        .total { font-weight: bold; font-size: 14px; }
      </style>
      </head><body>
        <h2>${e(settings?.store_name || 'DULCES & BEBIDAS')}</h2>
        ${settings?.store_ruc ? `<h3>RUC: ${e(settings.store_ruc)}</h3>` : ''}
        <p style="text-align:center; font-size: 12px;">Nota de Venta (no válida como comprobante fiscal)<br>Ticket: ${e(order.code)}</p>
        <hr style="border: 1px dashed black;" />
        <p style="font-size: 12px;">
          Cliente: ${e(order.customerName || 'Cliente Genérico')}<br>
          Fecha: ${e(new Date(order.paidAt ?? Date.now()).toLocaleString('es-PE'))}<br>
          Pago: ${e(order.paymentMethod || '-')}<br>
          Cajero: ${e(order.settledByName || session?.user.fullName || '')}
        </p>
        <table>
          <tr><th>Cant</th><th>Descripción</th><th class="right">Importe</th></tr>
          ${order.items.map(item => `
            <tr>
              <td>${item.quantity}</td>
              <td>${e(item.productName.substring(0, 18))}</td>
              <td class="right">S/ ${item.subtotal.toFixed(2)}</td>
            </tr>
          `).join('')}
        </table>
        ${order.discountAmount ? `<p class="right">Descuento: -S/ ${order.discountAmount.toFixed(2)}</p>` : ''}
        <p class="right total">TOTAL: S/ ${order.totalAmount.toFixed(2)}</p>
        ${order.debtAmount ? `<p class="right">Pagado: S/ ${(order.paidAmount ?? 0).toFixed(2)}<br>Saldo fiado: S/ ${order.debtAmount.toFixed(2)}</p>` : ''}
        <hr style="border: 1px dashed black;" />
        <p style="text-align:center; font-size: 11px;">¡Gracias por su compra!</p>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-paper md:p-6 animate-in fade-in text-ink flex justify-center">
      <div className="w-full h-max max-w-5xl bg-white md:rounded-3xl border-0 md:border border-ink/10 md:shadow-2xl overflow-hidden flex flex-col">
      {/* Cabecera */}
      <ScreenHeader
        icon={<QrCode className="w-5 h-5" />}
        tone="sun"
        title="Caja"
        leading={<MenuButton onClick={() => setMenuOpen(true)} className="border border-ink/10 bg-white text-ink" />}
        subtitle={online ? `Cobro de pre-ventas · ${session?.user.fullName ?? ''}` : 'Sin internet: el cobro requiere conexión'}
        actions={
          <>
            {!online && (
              <span className="inline-flex h-10 items-center gap-1 rounded-xl bg-amber-400 px-2.5 text-xs font-black text-slate-950">
                <CloudOff className="w-4 h-4" />
              </span>
            )}
            <HeaderButton onClick={() => setShowDebts(true)} disabled={!online}>
              <HandCoins className="w-4 h-4" /> Fiados
            </HeaderButton>
          </>
        }
      />

      {menuOpen && (
        <div className="fixed inset-0 z-50 flex bg-black/50" onClick={() => setMenuOpen(false)}>
          <div className="flex h-full w-[19rem] max-w-[85%] flex-col gap-4 overflow-y-auto bg-white p-4 shadow-2xl animate-in slide-in-from-left duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-ink">Caja</h2>
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft hover:bg-ink/5">
                <X className="h-5 w-5" />
              </button>
            </div>
            <button type="button" disabled={!online} onClick={() => { setMenuOpen(false); setShowDebts(true); }}
              className="flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-bold text-ink hover:bg-ink/5 disabled:opacity-40">
              <HandCoins className="h-5 w-5 text-brand-600" /> Libreta de fiados
            </button>
            <div className="mt-auto">
              <ProfileSection onDone={() => setMenuOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {showDebts && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3" onClick={() => setShowDebts(false)}>
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-cream/60 rounded-3xl p-4 md:p-6 relative" onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setShowDebts(false)} className="absolute top-3 right-3 p-1.5 bg-white rounded-full shadow" aria-label="Cerrar">
              <X className="w-5 h-5" />
            </button>
            <DebtsPanel />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-ink/10">
        {/* Columna Izquierda: Escaneo y Lista de Pre-Ventas Pendientes */}
        <div className="lg:col-span-5 p-5 space-y-4 bg-cream/60">
          {/* Lector de QR de Mostrador */}
          <div className="bg-white p-4 rounded-2xl border-2 border-brand-500 shadow-sm space-y-2">
            <label className="text-xs font-black text-ink   flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-brand-600" />
              <span>Escanear el QR del ticket</span>
            </label>
            <form onSubmit={e => void handleScanOrSubmit(e)} className="flex gap-2">
              <input
                type="text"
                placeholder="Código del ticket, ej. V01-7K3QM"
                value={scannedCode}
                onChange={(e) => setScannedCode(e.target.value)}
                className="flex-1 bg-cream/60 border border-ink/15 rounded-xl px-3 py-2 text-xs font-display font-bold text-ink focus:outline-hidden focus:border-brand-600"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-black text-xs  rounded-xl shadow-xs transition"
              >
                Cargar
              </button>
            </form>
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="w-full h-12 rounded-xl border-2 border-dashed border-brand-300 bg-brand-50 text-brand-800 font-black text-sm flex items-center justify-center gap-2 hover:bg-brand-100 active:scale-[0.99] transition"
            >
              <Camera className="w-5 h-5" /> Escanear QR con la cámara
            </button>
            <CameraScanner
              open={cameraOpen}
              onClose={() => setCameraOpen(false)}
              onDetected={code => { void lookupCode(code); }}
              kind="qr"
            />
            <p className="text-xs text-ink-soft">
              El cliente entrega el ticket que le dio el vendedor.
            </p>
          </div>

          {/* Lista de Pre-Ventas y Pestañas */}
          <div className="space-y-2">
            <div className="flex bg-ink/10 p-1 rounded-xl mb-3">
              <button
                type="button"
                onClick={() => setQueueTab('PENDIENTE')}
                className={`flex-1 py-1.5 text-xs font-black  rounded-lg transition ${
                  queueTab === 'PENDIENTE' ? 'bg-white text-brand-700 shadow-xs' : 'text-ink-soft hover:text-ink'
                }`}
              >
                Por cobrar ({pendingOrders.length})
              </button>
              <button
                type="button"
                onClick={() => setQueueTab('PAGADO')}
                className={`flex-1 py-1.5 text-xs font-black  rounded-lg transition ${
                  queueTab === 'PAGADO' ? 'bg-white text-brand-700 shadow-xs' : 'text-ink-soft hover:text-ink'
                }`}
              >
                Historial ({paidOrders.length})
              </button>
            </div>

            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-black text-ink ">
                {queueTab === 'PENDIENTE' ? 'Pedidos en cola' : 'Tickets Completados'} ({filteredList.length})
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${queueTab === 'PENDIENTE' ? 'text-amber-700 bg-amber-100' : 'text-brand-700 bg-brand-100'}`}>
                {queueTab === 'PENDIENTE' ? 'Pendientes de pago' : 'Ya Pagados'}
              </span>
            </div>
            
            {/* Buscador de Clientes / Pedidos */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-ink/45 absolute left-3 top-2.5" />
              <input 
                type="text"
                placeholder="Buscar por cliente o código de pedido..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-ink/15 rounded-xl text-xs focus:border-brand-600 focus:outline-hidden"
              />
            </div>

            {filteredList.length === 0 ? (
              <div className="p-6 bg-white rounded-2xl border border-ink/10 text-center text-ink/45 space-y-2">
                <Clock className="w-8 h-8 mx-auto text-ink/45" />
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
                        ? 'bg-brand-50 border-brand-500 ring-2 ring-brand-500/30 shadow-md'
                        : 'bg-white border-ink/10 hover:border-ink/15'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-display text-ink">{ord.code}</strong>
                        <span className="text-xs font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                          {ord.status}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-ink mt-1 flex items-center justify-between gap-2">
                        <span className="truncate">{ord.customerName || 'Cliente Genérico'}</span>
                        <span className="text-xs font-display font-normal text-ink/45 bg-cream px-1.5 py-0.5 rounded shrink-0">
                          {new Date(ord.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      <div className="text-xs text-ink-soft mt-0.5">
                        {ord.sellerName} · {ord.items.length} productos ({ord.totalBaseUnits} unds)
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-black font-display text-ink">
                        S/ {ord.totalAmount.toFixed(2)}
                      </div>
                      <span className={`text-xs font-bold ${ord.status === 'PAGADO' ? 'text-blue-600' : 'text-brand-700'}`}>
                        {ord.status === 'PENDIENTE_PAGO' ? 'Cobrar ➔' : 'Ver Boleta ➔'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: Pantalla de Cobro, Medios de Pago y Emisión de Comprobante */}
        <div ref={checkoutRef} className="lg:col-span-7 p-6 space-y-5 bg-white scroll-mt-2">
          {selectedOrder ? (
            <div className="space-y-5">
              {/* Resumen del Pedido Cargado */}
              <div className="bg-cream/60 p-4 rounded-2xl border border-ink/10 space-y-3">
                <div className="flex items-center justify-between border-b border-ink/10 pb-2">
                  <div>
                    <span className="text-xs text-ink/45  font-bold">Cuenta Cargada:</span>
                    <h3 className="text-lg font-black text-ink font-display">
                      {selectedOrder.code}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-ink/45  font-bold">Total Cuenta:</span>
                    <div className="text-2xl font-black text-brand-600 font-display">
                      S/ {selectedOrder.totalAmount.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Ítems */}
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 text-xs">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1 border-b border-ink/5">
                      <div>
                        <strong className="text-ink">
                          {item.quantity}x [{item.presentationType.toUpperCase()}] {item.productName}
                        </strong>
                        <span className="text-xs text-ink-soft ml-1">
                          (x{item.conversionFactor} = {item.baseUnitsDeducted} base)
                        </span>
                      </div>
                      <span className="font-display font-bold text-ink">
                        S/ {item.subtotal.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {checkoutComplete ? (
                /* Estado Exitoso de Cobro Finalizado */
                <div className="p-6 bg-brand-50 rounded-2xl border-2 border-brand-500 text-center space-y-3 animate-in zoom-in-95 duration-200">
                  <div className="w-16 h-16 bg-brand-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-brand-500/25">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h3 className="text-lg font-black text-brand-950 ">
                    {selectedOrder.status === 'CANCELADO' ? 'Pedido anulado' : selectedOrder.status === 'FIADO' ? 'Cobro registrado con saldo fiado' : '¡Cobro exitoso!'}
                  </h3>
                  <p className="text-xs text-brand-800 max-w-md mx-auto">
                    El pedido <strong className="font-display">{selectedOrder.code}</strong> está en estado <strong className="font-display">{selectedOrder.status}</strong>
                    {selectedOrder.paidAt && <> (cobrado por {selectedOrder.settledByName ?? '—'} el {new Date(selectedOrder.paidAt).toLocaleString('es-PE')})</>}.
                    {selectedOrder.status === 'FIADO' && <> Saldo pendiente: <strong>S/ {(selectedOrder.debtAmount ?? 0).toFixed(2)}</strong>.</>}
                  </p>
                  {lastChange > 0 && (
                    <div className="text-2xl font-black text-brand-900 font-display">Vuelto: S/ {lastChange.toFixed(2)}</div>
                  )}
                  <div className="pt-2 flex flex-col md:flex-row justify-center gap-3">
                    {selectedOrder.status !== 'CANCELADO' && (
                      <button
                        type="button"
                        onClick={() => printSaleNote(selectedOrder)}
                        className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs  rounded-xl shadow-md flex items-center justify-center gap-2 transition"
                      >
                        <Printer className="w-4 h-4" />
                        Imprimir Nota de Venta
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedOrderId(null)}
                      className="px-4 py-2 bg-ink/10 text-ink font-bold text-xs  rounded-xl"
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
                    <label className="text-xs font-black text-ink   block mb-2">
                      Seleccionar Medio de Pago
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { id: 'Efectivo', icon: <DollarSign className="w-4 h-4" />, label: 'Efectivo' },
                        { id: 'Yape', icon: <Smartphone className="w-4 h-4" />, label: 'Yape' },
                        { id: 'Tarjeta', icon: <CreditCard className="w-4 h-4" />, label: 'Tarjeta' },
                        { id: 'Mixto', icon: <Coins className="w-4 h-4" />, label: 'Mixto' },
                      ].map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setPaymentMethod(m.id as CashierMethod);
                            // Yape/Tarjeta: por defecto el monto exacto (no hay vuelto electrónico).
                            setAmountGiven(String(m.id === 'Efectivo' ? roundUpBill(selectedOrder.totalAmount) : selectedOrder.totalAmount));
                          }}
                          className={`p-3 rounded-xl border text-xs font-black flex items-center justify-center gap-2 transition ${
                            paymentMethod === m.id
                              ? 'bg-brand-600 text-white border-brand-600 shadow-md'
                              : 'bg-cream/60 border-ink/10 text-ink hover:bg-cream'
                          }`}
                        >
                          {m.icon}
                          <span>{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cálculo de Efectivo y Vuelto */}
                  {paymentMethod !== 'Mixto' && (
                    <div className="p-4 bg-cream/60 rounded-2xl border border-ink/10 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-ink-soft  block mb-1">
                            {paymentMethod === 'Efectivo' ? 'Efectivo Recibido (S/):' : `Monto por ${paymentMethod} (S/):`}
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={amountGiven}
                            onChange={(e) => setAmountGiven(e.target.value)}
                            className="w-full bg-white border border-ink/15 rounded-xl px-3 py-2 text-base font-black font-display text-ink focus:outline-hidden focus:border-brand-600"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-ink-soft  block mb-1">
                            Vuelto a Entregar:
                          </label>
                          <div className={`text-xl font-black font-display py-1.5 px-3 rounded-xl border ${
                            isCashSufficient && !invalidChange
                              ? 'bg-brand-50 text-brand-800 border-brand-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {invalidChange ? 'Sin vuelto' : `S/ ${changeDue.toFixed(2)}`}
                          </div>
                        </div>
                      </div>

                      {/* Botones de billetes rápidos */}
                      <div className="flex gap-2 pt-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setAmountGiven(String(selectedOrder.totalAmount))}
                          className="px-2.5 py-1 bg-brand-600 text-white border border-brand-600 rounded-lg text-xs font-bold font-display shadow-sm"
                        >
                          Exacto
                        </button>
                        {paymentMethod === 'Efectivo' && [20, 50, 100, 200].map(bill => (
                          <button
                            key={bill}
                            type="button"
                            onClick={() => setAmountGiven(String(bill))}
                            className="px-2.5 py-1 bg-white hover:bg-cream text-ink border border-ink/10 rounded-lg text-xs font-bold font-display"
                          >
                            S/ {bill}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cálculo Pago Mixto */}
                  {paymentMethod === 'Mixto' && (
                    <div className="p-4 bg-cream/60 rounded-2xl border border-ink/10 space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs font-bold text-ink-soft  block mb-1">Efectivo S/</label>
                          <input type="text" inputMode="decimal" value={mixedAmounts.efectivo} onChange={(e) => setMixedAmounts({...mixedAmounts, efectivo: e.target.value})} className="w-full border border-ink/15 rounded-lg px-2 py-1.5 text-sm font-display focus:border-brand-600 focus:outline-hidden" />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-ink-soft  block mb-1">Yape S/</label>
                          <input type="text" inputMode="decimal" value={mixedAmounts.yape} onChange={(e) => setMixedAmounts({...mixedAmounts, yape: e.target.value})} className="w-full border border-ink/15 rounded-lg px-2 py-1.5 text-sm font-display focus:border-brand-600 focus:outline-hidden" />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-ink-soft  block mb-1">Tarjeta S/</label>
                          <input type="text" inputMode="decimal" value={mixedAmounts.tarjeta} onChange={(e) => setMixedAmounts({...mixedAmounts, tarjeta: e.target.value})} className="w-full border border-ink/15 rounded-lg px-2 py-1.5 text-sm font-display focus:border-brand-600 focus:outline-hidden" />
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2 border-t border-ink/10">
                        <span className="text-xs font-bold text-ink-soft ">Suma Ingresada: S/ {received.toFixed(2)}</span>
                        <div className={`text-sm font-black font-display py-1 px-3 rounded-lg border ${
                          isCashSufficient
                            ? 'bg-brand-50 text-brand-800 border-brand-200'
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
                        <label className="text-xs font-black text-amber-900 ">Falta S/ {missingAmount.toFixed(2)}</label>
                        <p className="text-xs text-amber-700 font-bold">¿Registrar esta falta como Crédito / Fiado?</p>
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
                    disabled={(!isCashSufficient && !isFiado) || invalidChange || isProcessing || !online}
                    onClick={() => void handleExecuteCheckout()}
                    className={`w-full py-4 rounded-xl font-black text-sm   shadow-lg flex items-center justify-center gap-2 transition active:scale-98 ${
                      (!isCashSufficient && !isFiado) || invalidChange || isProcessing || !online
                        ? 'bg-slate-300 text-ink-soft cursor-not-allowed'
                        : 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand-700/30 cursor-pointer'
                    }`}
                  >
                    <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                    <span>{isProcessing ? 'Procesando…' : `Realizar Cobro Final (S/ ${selectedOrder.totalAmount.toFixed(2)}) & Descontar Stock`}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCancelPending()}
                    disabled={!online}
                    className="w-full py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-40"
                  >
                    <Ban className="w-3.5 h-3.5" /> Anular este pedido
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="py-20 text-center text-ink/45 space-y-3">
              <QrCode className="w-16 h-16 mx-auto text-ink/45 stroke-[1.5]" />
              <h3 className="text-base font-black text-ink">Escanee un ticket para cobrar</h3>
              <p className="text-xs text-ink-soft max-w-sm mx-auto">
                Elija un pedido de la lista o escanee el QR del ticket con la cámara o la pistola lectora.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
};
