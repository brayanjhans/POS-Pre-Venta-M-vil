import React from 'react';
import type { Order, PaymentMethod } from '../../types/pos';
import { playBarcodeBeep, playSuccessChime } from '../../lib/audioBeep';
import { escapeHtml } from '../../lib/html';
import { formatSoles, parseAmount, round2 } from '../../domain/money';
import { usePos } from '../../state/PosContext';
import { useDialog } from '../../app/DialogProvider';
import { DebtsPanel } from '../shared/DebtsPanel';
import { HeaderButton, ScreenHeader } from '../../app/ScreenHeader';
import { MenuButton, ProfileSection } from '../../app/ProfileMenu';
import { CameraScanner } from '../shared/CameraScanner';
import { EmptyState, PillButton, Pills, SearchField } from '../../app/ui';
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
        {/* Columna izquierda: escanear el ticket y la cola de pedidos */}
        <div className="space-y-4 bg-paper p-4 lg:col-span-5 lg:p-5">
          {/* Escanear: la acción principal de la caja */}
          <div className="space-y-3 rounded-3xl bg-sun/50 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80"><QrCode className="h-6 w-6" /></span>
              <div>
                <h3 className="font-display text-xl font-bold leading-tight">Cobrar un ticket</h3>
                <p className="text-sm text-ink/75">El cliente entrega el ticket que le dio el vendedor.</p>
              </div>
            </div>
            <button type="button" onClick={() => setCameraOpen(true)}
              className="squish flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ink text-base font-bold text-white">
              <Camera className="h-5 w-5" /> Escanear QR con la cámara
            </button>
            <form onSubmit={e => void handleScanOrSubmit(e)} className="flex gap-2">
              <input type="text" placeholder="O escriba el código, ej. V01-7K3QM" value={scannedCode}
                onChange={(e) => setScannedCode(e.target.value)}
                className="h-12 min-w-0 flex-1 rounded-full border border-ink/10 bg-white px-4 font-display text-[15px] font-bold text-ink outline-none placeholder:font-sans placeholder:font-normal placeholder:text-ink/40 focus:border-brand-600" />
              <button type="submit" className="squish h-12 shrink-0 rounded-full bg-white px-5 text-[15px] font-bold text-ink">Cargar</button>
            </form>
            <CameraScanner open={cameraOpen} onClose={() => setCameraOpen(false)} onDetected={code => { void lookupCode(code); }} kind="qr" />
          </div>

          <Pills<'PENDIENTE' | 'PAGADO'>
            value={queueTab}
            onChange={setQueueTab}
            options={[
              { value: 'PENDIENTE', label: 'Por cobrar', count: pendingOrders.length },
              { value: 'PAGADO', label: 'Cobrados', count: paidOrders.length },
            ]}
          />
          <SearchField value={searchTerm} onChange={setSearchTerm} placeholder="Cliente o código de pedido" />

          {filteredList.length === 0 ? (
            <EmptyState icon={<Clock className="h-6 w-6" />} tone={queueTab === 'PENDIENTE' ? 'sun' : 'mint'}
              title={queueTab === 'PENDIENTE' ? 'No hay tickets por cobrar' : 'Aún no hay cobros'}
              hint={queueTab === 'PENDIENTE' ? 'Los pedidos de los vendedores aparecerán aquí.' : undefined} />
          ) : (
            <ul className="max-h-[420px] space-y-2.5 overflow-y-auto pr-1">
              {filteredList.map((ord) => {
                const active = selectedOrder?.id === ord.id;
                return (
                  <li key={ord.id}>
                    <button type="button" onClick={() => handleSelectOrder(ord)}
                      className={`squish flex w-full items-center gap-3 rounded-3xl p-4 text-left transition ${active ? 'bg-ink text-white' : 'bg-white text-ink'}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-[17px] font-bold">{ord.code}</span>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${active ? 'bg-white/15' : ord.status === 'PENDIENTE_PAGO' ? 'bg-sun' : 'bg-mint'}`}>
                            {ord.status === 'PENDIENTE_PAGO' ? 'Por cobrar' : ord.status === 'FIADO' ? 'Fiado' : 'Cobrado'}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-[15px] font-bold">{ord.customerName || 'Cliente sin registrar'}</div>
                        <div className={`truncate text-sm ${active ? 'text-white/70' : 'text-ink-soft'}`}>
                          {ord.sellerName}, {new Date(ord.createdAt).toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-display text-xl font-bold">S/ {ord.totalAmount.toFixed(2)}</div>
                        <div className={`text-sm font-bold ${active ? 'text-tag' : 'text-brand-700'}`}>{ord.status === 'PENDIENTE_PAGO' ? 'Cobrar ›' : 'Ver ›'}</div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Columna derecha: el cobro del pedido elegido */}
        <div ref={checkoutRef} className="scroll-mt-2 space-y-4 bg-paper p-4 lg:col-span-7 lg:p-5">
          {selectedOrder ? (
            <div className="space-y-4">
              {/* Pedido cargado */}
              <div className="rounded-3xl bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-ink-soft">Pedido</div>
                    <h3 className="font-display text-2xl font-bold leading-tight">{selectedOrder.code}</h3>
                    <div className="truncate text-[15px]">{selectedOrder.customerName || 'Cliente sin registrar'}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold text-ink-soft">Total</div>
                    <div className="font-display text-[36px] font-bold leading-none">{formatSoles(selectedOrder.totalAmount)}</div>
                  </div>
                </div>
                <ul className="mt-4 max-h-[180px] divide-y divide-ink/5 overflow-y-auto pr-1">
                  {selectedOrder.items.map((item, idx) => (
                    <li key={idx} className="flex items-center justify-between gap-3 py-2 text-[15px]">
                      <span className="min-w-0">
                        <span className="font-bold">{item.quantity} ×</span> {item.productName}
                        <span className="block text-sm text-ink-soft">{item.presentationLabel || item.presentationType}</span>
                      </span>
                      <span className="shrink-0 font-display font-bold">{formatSoles(item.subtotal)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {checkoutComplete ? (
                /* Cobro terminado */
                <div className="space-y-3 rounded-3xl bg-mint/60 p-6 text-center animate-in zoom-in-95 duration-200">
                  <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white"><CheckCircle2 className="h-10 w-10 text-brand-600" /></span>
                  <h3 className="font-display text-2xl font-bold">
                    {selectedOrder.status === 'CANCELADO' ? 'Pedido anulado' : selectedOrder.status === 'FIADO' ? 'Cobrado con saldo fiado' : '¡Cobro listo!'}
                  </h3>
                  {selectedOrder.status === 'FIADO' && (
                    <p className="text-[15px]">Queda debiendo <strong className="font-display">{formatSoles(selectedOrder.debtAmount)}</strong>.</p>
                  )}
                  {selectedOrder.paidAt && (
                    <p className="text-sm text-ink/75">Cobró {selectedOrder.settledByName ?? '—'}, {new Date(selectedOrder.paidAt).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</p>
                  )}
                  {lastChange > 0 && (
                    <div className="mx-auto w-fit rounded-3xl bg-white px-6 py-3">
                      <div className="text-sm font-bold text-ink-soft">Vuelto</div>
                      <div className="font-display text-[40px] font-bold leading-none">{formatSoles(lastChange)}</div>
                    </div>
                  )}
                  <div className="flex flex-col justify-center gap-2 pt-2 sm:flex-row">
                    {selectedOrder.status !== 'CANCELADO' && (
                      <PillButton variant="soft" onClick={() => printSaleNote(selectedOrder)}><Printer className="h-5 w-5" /> Imprimir nota de venta</PillButton>
                    )}
                    <PillButton onClick={() => setSelectedOrderId(null)}>Siguiente cobro</PillButton>
                  </div>
                </div>
              ) : (
                /* Formulario de cobro */
                <div className="space-y-4 rounded-3xl bg-white p-5">
                  <div>
                    <span className="mb-2 block font-display text-lg font-bold">Cómo paga</span>
                    <div className="grid grid-cols-4 gap-2">
                      {([
                        { id: 'Efectivo', icon: <DollarSign className="h-5 w-5" />, label: 'Efectivo', tone: 'bg-mint/45' },
                        { id: 'Yape', icon: <Smartphone className="h-5 w-5" />, label: 'Yape', tone: 'bg-lilac/50' },
                        { id: 'Tarjeta', icon: <CreditCard className="h-5 w-5" />, label: 'Tarjeta', tone: 'bg-sky/50' },
                        { id: 'Mixto', icon: <Coins className="h-5 w-5" />, label: 'Mixto', tone: 'bg-sun/45' },
                      ] as const).map(m => (
                        <button key={m.id} type="button" aria-pressed={paymentMethod === m.id}
                          onClick={() => {
                            setPaymentMethod(m.id as CashierMethod);
                            // Yape/Tarjeta: por defecto el monto exacto (no hay vuelto electrónico).
                            setAmountGiven(String(m.id === 'Efectivo' ? roundUpBill(selectedOrder.totalAmount) : selectedOrder.totalAmount));
                          }}
                          className={`squish flex flex-col items-center gap-1.5 rounded-2xl p-3 text-sm font-bold transition ${paymentMethod === m.id ? 'bg-ink text-white' : `${m.tone} text-ink`}`}>
                          <span className={`flex h-9 w-9 items-center justify-center rounded-full ${paymentMethod === m.id ? 'bg-white/15' : 'bg-white/70'}`}>{m.icon}</span>
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {paymentMethod !== 'Mixto' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                          <span className="mb-1.5 block text-sm font-bold">{paymentMethod === 'Efectivo' ? 'Recibe' : `Monto por ${paymentMethod}`}</span>
                          <div className="relative">
                            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display font-bold text-ink-soft">S/</span>
                            <input type="text" inputMode="decimal" value={amountGiven} onChange={(e) => setAmountGiven(e.target.value)}
                              className="h-14 w-full rounded-2xl border-2 border-ink/10 bg-white pl-11 pr-3 font-display text-2xl font-bold outline-none focus:border-brand-600" />
                          </div>
                        </label>
                        <div>
                          <span className="mb-1.5 block text-sm font-bold">Vuelto</span>
                          <div className={`flex h-14 items-center rounded-2xl px-4 font-display text-2xl font-bold ${isCashSufficient && !invalidChange ? 'bg-mint/50' : 'bg-fresa/10 text-fresa'}`}>
                            {invalidChange ? 'Sin vuelto' : formatSoles(changeDue)}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setAmountGiven(String(selectedOrder.totalAmount))}
                          className="squish h-10 rounded-full bg-ink px-4 text-[15px] font-bold text-white">Exacto</button>
                        {paymentMethod === 'Efectivo' && [20, 50, 100, 200].map(bill => (
                          <button key={bill} type="button" onClick={() => setAmountGiven(String(bill))}
                            className="squish h-10 rounded-full border border-ink/15 bg-white px-4 font-display text-[15px] font-bold">S/ {bill}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'Mixto' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        {([['efectivo', 'Efectivo'], ['yape', 'Yape'], ['tarjeta', 'Tarjeta']] as const).map(([k, label]) => (
                          <label key={k} className="block">
                            <span className="mb-1 block text-sm font-bold">{label}</span>
                            <input type="text" inputMode="decimal" value={mixedAmounts[k]} placeholder="0.00"
                              onChange={(e) => setMixedAmounts({ ...mixedAmounts, [k]: e.target.value })}
                              className="h-12 w-full rounded-2xl border-2 border-ink/10 bg-white px-3 font-display text-lg font-bold outline-none focus:border-brand-600" />
                          </label>
                        ))}
                      </div>
                      <div className="flex items-center justify-between rounded-2xl bg-cream px-4 py-3">
                        <span className="text-[15px]">Suma: <strong className="font-display">{formatSoles(received)}</strong></span>
                        <span className={`font-display text-lg font-bold ${isCashSufficient ? 'text-brand-700' : isFiado ? 'text-sun-strong' : 'text-fresa'}`}>
                          {changeDue > 0 ? `Vuelto ${formatSoles(changeDue)}` : missingAmount > 0 ? (isFiado ? `Deuda ${formatSoles(missingAmount)}` : `Falta ${formatSoles(missingAmount)}`) : 'Exacto'}
                        </span>
                      </div>
                    </div>
                  )}

                  {!isCashSufficient && (
                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-sun/50 p-4">
                      <span>
                        <span className="block font-display text-lg font-bold">Falta {formatSoles(missingAmount)}</span>
                        <span className="block text-sm text-ink/75">¿Dejar la diferencia como fiado?</span>
                      </span>
                      <span className="relative inline-flex">
                        <input type="checkbox" className="peer sr-only" checked={isFiado} onChange={(e) => setIsFiado(e.target.checked)} />
                        <span className="h-8 w-14 rounded-full bg-white transition peer-checked:bg-ink" />
                        <span className="absolute left-1 top-1 h-6 w-6 rounded-full bg-ink transition peer-checked:translate-x-6 peer-checked:bg-white" />
                      </span>
                    </label>
                  )}

                  <button type="button" disabled={(!isCashSufficient && !isFiado) || invalidChange || isProcessing || !online}
                    onClick={() => void handleExecuteCheckout()}
                    className="squish flex h-14 w-full items-center justify-center gap-2 rounded-full bg-brand-600 text-base font-bold text-white transition disabled:bg-ink/10 disabled:text-ink/40">
                    <CheckCircle2 className="h-5 w-5" />
                    {isProcessing ? 'Cobrando…' : `Cobrar ${formatSoles(selectedOrder.totalAmount)}`}
                  </button>
                  <button type="button" onClick={() => void handleCancelPending()} disabled={!online}
                    className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full text-[15px] font-bold text-fresa hover:bg-fresa/5 disabled:opacity-40">
                    <Ban className="h-4 w-4" /> Anular este pedido
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden lg:block">
              <EmptyState icon={<QrCode className="h-6 w-6" />} tone="sun" title="Elija un pedido para cobrar"
                hint="Escanee el QR del ticket o toque un pedido de la lista." />
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
};
