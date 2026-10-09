import React from 'react';
import { Loader2, Receipt, Share2, X } from 'lucide-react';
import { useDialog } from '../../app/DialogProvider';
import { formatSoles } from '../../domain/money';
import { shareTicketImage } from '../../lib/shareTicket';
import { usePos } from '../../state/PosContext';
import type { CustomerPayment, Order } from '../../types/pos';

interface Props {
  order: Order;
  onClose: () => void;
  /** Pagos/abonos de esta boleta (si se conocen), para mostrar cómo se fue pagando. */
  payments?: CustomerPayment[];
  children?: React.ReactNode;
}

const STATUS_STYLE: Record<Order['status'], string> = {
  PENDIENTE_PAGO: 'bg-amber-100 text-amber-800',
  PAGADO: 'bg-brand-100 text-brand-800',
  FIADO: 'bg-orange-100 text-orange-800',
  CANCELADO: 'bg-red-100 text-red-700',
};
const STATUS_LABEL: Record<Order['status'], string> = {
  PENDIENTE_PAGO: 'Pendiente de pago',
  PAGADO: 'Pagado',
  FIADO: 'Fiado',
  CANCELADO: 'Anulado',
};
const KIND_LABEL = { VENTA: 'Pago', ABONO: 'Abono', DEVOLUCION: 'Devolución' } as const;

/** Boleta completa: qué se llevó el cliente, totales, pagos/abonos y saldo. Se puede enviar como imagen. */
export const OrderReceiptModal: React.FC<Props> = ({ order, onClose, payments, children }) => {
  const { catalog } = usePos();
  const dialog = useDialog();
  const [sharing, setSharing] = React.useState(false);
  const units = order.items.reduce((acc, i) => acc + i.quantity, 0);

  const share = async () => {
    setSharing(true);
    try {
      await shareTicketImage(order, catalog?.settings);
    } catch (e) {
      void dialog.alert(e instanceof Error ? e.message : String(e), { tone: 'danger', title: 'No se pudo compartir' });
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 animate-in fade-in" onClick={onClose}>
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
        {/* Cabecera */}
        <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Receipt className="w-5 h-5" /></div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-500">Boleta</div>
              <h3 className="font-mono text-lg font-black text-slate-900 leading-tight">{order.code}</h3>
              <span className={`mt-1 inline-block rounded-md px-1.5 py-0.5 text-xs font-bold ${STATUS_STYLE[order.status]}`}>{STATUS_LABEL[order.status]}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:text-slate-800" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4 text-sm">
          {/* Datos */}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            <dt className="text-slate-500">Fecha</dt><dd className="text-right font-medium">{new Date(order.createdAt).toLocaleString('es-PE')}</dd>
            <dt className="text-slate-500">Cliente</dt><dd className="text-right font-bold">{order.customerName || '—'}{order.customerRuc ? ` · ${order.customerRuc}` : ''}</dd>
            <dt className="text-slate-500">Vendedor</dt><dd className="text-right">{order.sellerName}</dd>
            <dt className="text-slate-500">Condición</dt><dd className="text-right">{order.paymentTerm}</dd>
            {order.cancelReason && (<><dt className="text-red-600">Anulación</dt><dd className="text-right text-red-600">{order.cancelReason}</dd></>)}
          </dl>

          {/* Lo que se llevó */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs font-black uppercase tracking-wide text-slate-500">
              <span>Lo que se llevó</span>
              <span className="normal-case font-bold">{order.items.length} producto(s) · {units} und.</span>
            </div>
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 leading-snug">{item.productName}</div>
                    <div className="text-xs text-slate-500">
                      {item.quantity} × {item.presentationLabel || item.presentationType.toUpperCase()} · {formatSoles(item.unitPrice)} c/u
                    </div>
                  </div>
                  <div className="shrink-0 font-mono font-black text-slate-900">{formatSoles(item.subtotal)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Totales */}
          <div className="space-y-1 rounded-2xl bg-slate-50 p-3 text-xs">
            {!!order.discountAmount && (
              <div className="flex justify-between text-slate-600"><span>Descuento{order.discountPercent ? ` (${order.discountPercent}%)` : ''}</span><span className="font-mono">- {formatSoles(order.discountAmount)}</span></div>
            )}
            <div className="flex justify-between text-base font-black text-slate-900"><span>Total</span><span className="font-mono">{formatSoles(order.totalAmount)}</span></div>
            <div className="flex justify-between text-brand-700 font-bold"><span>Pagado</span><span className="font-mono">{formatSoles(order.paidAmount)}</span></div>
            {(order.debtAmount ?? 0) > 0 && (
              <div className="flex justify-between text-sm font-black text-red-600"><span>Saldo pendiente</span><span className="font-mono">{formatSoles(order.debtAmount)}</span></div>
            )}
            {order.paymentMethod && <div className="text-slate-500">Medio de pago: {order.paymentMethod}</div>}
          </div>

          {/* Pagos y abonos de esta boleta */}
          {payments && payments.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-black uppercase tracking-wide text-slate-500">Pagos y abonos</div>
              <div className="space-y-1.5">
                {payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 text-xs">
                    <div>
                      <div className="font-bold">{KIND_LABEL[p.kind]} · {p.method}</div>
                      <div className="text-slate-500">{new Date(p.createdAt).toLocaleString('es-PE')} · {p.receivedBy}</div>
                    </div>
                    <div className={`font-mono font-black ${p.amount < 0 ? 'text-red-600' : 'text-brand-700'}`}>{formatSoles(p.amount)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-slate-100 p-4">
          <button type="button" onClick={() => void share()} disabled={sharing}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] text-sm font-black text-white shadow-sm transition hover:bg-[#20bd5a] active:scale-[0.98] disabled:opacity-60">
            {sharing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Share2 className="w-5 h-5" />}
            Enviar boleta por WhatsApp (imagen)
          </button>
          {children}
        </div>
      </div>
    </div>
  );
};
