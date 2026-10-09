import React from 'react';
import { Ban, Receipt, RefreshCw } from 'lucide-react';
import { formatSoles } from '../../domain/money';
import { usePos } from '../../state/PosContext';
import { OrderReceiptModal } from '../shared/OrderReceiptModal';
import type { Order, OrderStatus } from '../../types/pos';

const STATUS_STYLE: Record<OrderStatus, string> = {
  PAGADO: 'bg-emerald-100 text-emerald-800',
  FIADO: 'bg-orange-100 text-orange-800',
  PENDIENTE_PAGO: 'bg-amber-100 text-amber-800',
  CANCELADO: 'bg-slate-200 text-slate-600',
};

/** Historial de boletas/pedidos (últimos 7 días) con filtros y anulación. */
export const OrdersTab: React.FC = () => {
  const { api, orders, refreshOrders, refreshCatalog, upsertOrder, handleError } = usePos();
  const [status, setStatus] = React.useState<OrderStatus | 'TODOS'>('TODOS');
  const [search, setSearch] = React.useState('');
  const [viewOrder, setViewOrder] = React.useState<Order | null>(null);
  const [loading, setLoading] = React.useState(false);

  const reload = async () => {
    setLoading(true);
    await refreshOrders();
    setLoading(false);
  };

  const q = search.toLowerCase().trim();
  const list = orders
    .filter(o => status === 'TODOS' || o.status === status)
    .filter(o => !q || o.code.toLowerCase().includes(q) || (o.customerName ?? '').toLowerCase().includes(q) || o.sellerName.toLowerCase().includes(q));
  const total = list.filter(o => o.status !== 'CANCELADO').reduce((acc, o) => acc + o.totalAmount, 0);

  const cancel = async (order: Order) => {
    if (!api) return;
    const reason = window.prompt(`Anular ${order.code} (${formatSoles(order.totalAmount)}).\nSe devolverá el stock${order.paidAmount ? ' y se registrará la devolución del dinero' : ''}.\n\nMotivo:`);
    if (!reason?.trim()) return;
    try {
      const updated = await api.cancelOrder(order.id, reason.trim());
      upsertOrder(updated);
      setViewOrder(updated);
      void refreshCatalog();
    } catch (e) {
      alert(handleError(e));
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-slate-900 uppercase">Historial de Boletas (últimos 7 días)</h3>
          <p className="text-xs text-slate-500">{list.length} pedidos · {formatSoles(total)} sin contar anulados</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={status} onChange={e => setStatus(e.target.value as OrderStatus | 'TODOS')} className="bg-white border border-slate-300 rounded-xl px-2 py-2 text-xs font-bold">
            <option value="TODOS">Todos</option>
            <option value="PENDIENTE_PAGO">Pendientes</option>
            <option value="PAGADO">Pagados</option>
            <option value="FIADO">Fiados</option>
            <option value="CANCELADO">Anulados</option>
          </select>
          <input type="text" placeholder="Código, cliente o vendedor" value={search} onChange={e => setSearch(e.target.value)}
            className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs" />
          <button type="button" onClick={() => void reload()} className="p-2 bg-white border border-slate-300 rounded-xl" title="Actualizar">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="py-12 text-center text-slate-400">No hay pedidos con ese filtro.</div>
      ) : (
        <div className="space-y-2">
          {list.map(ord => (
            <button key={ord.id} type="button" onClick={() => setViewOrder(ord)}
              className="w-full p-3.5 bg-white rounded-2xl border border-slate-200 hover:border-emerald-400 flex items-center justify-between gap-3 text-xs text-left">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <strong className="text-sm font-mono text-slate-900">{ord.code}</strong>
                  <span className={`px-2 py-0.5 rounded-full font-black text-[10px] ${STATUS_STYLE[ord.status]}`}>{ord.status}</span>
                  <span className="text-[10px] text-slate-400">{ord.paymentTerm}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 truncate">
                  {new Date(ord.createdAt).toLocaleString('es-PE')} · {ord.sellerName} · {ord.customerName || 'Cliente genérico'} · {ord.items.length} productos
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-base font-black font-mono text-emerald-800">{formatSoles(ord.totalAmount)}</div>
                {!!ord.debtAmount && <div className="text-[10px] font-bold text-red-600">Debe {formatSoles(ord.debtAmount)}</div>}
                <Receipt className="w-3.5 h-3.5 text-slate-400 ml-auto" />
              </div>
            </button>
          ))}
        </div>
      )}

      {viewOrder && (
        <OrderReceiptModal order={viewOrder} onClose={() => setViewOrder(null)}>
          {viewOrder.status !== 'CANCELADO' && (
            <button type="button" onClick={() => void cancel(viewOrder)}
              className="w-full py-2 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-1.5">
              <Ban className="w-4 h-4" /> Anular boleta
            </button>
          )}
        </OrderReceiptModal>
      )}
    </div>
  );
};
