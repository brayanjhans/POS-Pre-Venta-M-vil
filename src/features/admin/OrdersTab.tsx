import React from 'react';
import { Ban, ChevronRight, ReceiptText, RefreshCw } from 'lucide-react';
import { formatSoles } from '../../domain/money';
import { usePos } from '../../state/PosContext';
import { useDialog } from '../../app/DialogProvider';
import { Card, EmptyState, PageTitle, PillButton, Pills, SearchField, StatusPill } from '../../app/ui';
import type { Tone } from '../../app/tones';
import { OrderReceiptModal } from '../shared/OrderReceiptModal';
import type { Order, OrderStatus } from '../../types/pos';

const STATUS: Record<OrderStatus, { label: string; tone: Tone | 'fresa' | 'muted' }> = {
  PAGADO: { label: 'Pagado', tone: 'mint' },
  FIADO: { label: 'Fiado', tone: 'pink' },
  PENDIENTE_PAGO: { label: 'Por cobrar', tone: 'sun' },
  CANCELADO: { label: 'Anulado', tone: 'muted' },
};

type Filter = OrderStatus | 'TODOS';

/** Boletas de los últimos 7 días: filtros por estado, búsqueda, detalle y anulación. */
export const OrdersTab: React.FC = () => {
  const { api, orders, refreshOrders, refreshCatalog, upsertOrder, handleError } = usePos();
  const dialog = useDialog();
  const [status, setStatus] = React.useState<Filter>('TODOS');
  const [search, setSearch] = React.useState('');
  const [viewOrder, setViewOrder] = React.useState<Order | null>(null);
  const [loading, setLoading] = React.useState(false);

  const reload = async () => {
    setLoading(true);
    await refreshOrders();
    setLoading(false);
  };

  const q = search.toLowerCase().trim();
  const bySearch = orders.filter(o => !q || o.code.toLowerCase().includes(q) || (o.customerName ?? '').toLowerCase().includes(q) || o.sellerName.toLowerCase().includes(q));
  const list = bySearch.filter(o => status === 'TODOS' || o.status === status);
  const total = list.filter(o => o.status !== 'CANCELADO').reduce((acc, o) => acc + o.totalAmount, 0);
  const count = (s: OrderStatus) => bySearch.filter(o => o.status === s).length;

  const cancel = async (order: Order) => {
    if (!api) return;
    const reason = await dialog.prompt(
      `Total ${formatSoles(order.totalAmount)}. Se devolverá el stock${order.paidAmount ? ' y se registrará la devolución del dinero' : ''}.\n\nEscriba el motivo:`,
      { title: `Anular ${order.code}`, tone: 'danger', placeholder: 'Ej. Cliente canceló el pedido', confirmText: 'Anular', validate: v => (v.trim().length < 3 ? 'Escriba el motivo (mínimo 3 letras).' : null) });
    if (!reason?.trim()) return;
    try {
      const updated = await api.cancelOrder(order.id, reason.trim());
      upsertOrder(updated);
      setViewOrder(updated);
      void refreshCatalog();
    } catch (e) {
      void dialog.alert(handleError(e), { tone: 'danger' });
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 text-ink">
      <PageTitle
        title="Últimos 7 días"
        subtitle={<>{list.length === 1 ? '1 boleta' : `${list.length} boletas`}, <strong className="text-ink">{formatSoles(total)}</strong> sin contar anuladas</>}
        action={
          <PillButton variant="soft" onClick={() => void reload()} aria-label="Actualizar">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </PillButton>
        }
      />
      <SearchField value={search} onChange={setSearch} placeholder="Código, cliente o vendedor" />
      <Pills<Filter>
        value={status}
        onChange={setStatus}
        options={[
          { value: 'TODOS', label: 'Todas', count: bySearch.length },
          { value: 'PENDIENTE_PAGO', label: 'Por cobrar', count: count('PENDIENTE_PAGO') },
          { value: 'PAGADO', label: 'Pagadas', count: count('PAGADO') },
          { value: 'FIADO', label: 'Fiadas', count: count('FIADO') },
          { value: 'CANCELADO', label: 'Anuladas', count: count('CANCELADO') },
        ]}
      />

      {list.length === 0 ? (
        <EmptyState icon={<ReceiptText className="h-6 w-6" />} tone="lilac" title="No hay boletas con este filtro" hint="Pruebe con otro estado o busque por código." />
      ) : (
        <ul className="space-y-2.5">
          {list.map(ord => {
            const st = STATUS[ord.status];
            return (
              <li key={ord.id}>
                <button type="button" onClick={() => setViewOrder(ord)} className="squish w-full text-left">
                  <Card className={`flex items-center gap-3 ${ord.status === 'CANCELADO' ? 'opacity-60' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-[17px] font-bold">{ord.code}</span>
                        <StatusPill tone={st.tone}>{st.label}</StatusPill>
                      </div>
                      <div className="mt-0.5 truncate text-[15px] text-ink">{ord.customerName || 'Cliente sin registrar'}</div>
                      <div className="truncate text-sm text-ink-soft">
                        {new Date(ord.createdAt).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}, {ord.sellerName}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-display text-lg font-bold">{formatSoles(ord.totalAmount)}</div>
                      {!!ord.debtAmount && <div className="text-sm font-bold text-fresa">Debe {formatSoles(ord.debtAmount)}</div>}
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-ink/30" />
                  </Card>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {viewOrder && (
        <OrderReceiptModal order={viewOrder} onClose={() => setViewOrder(null)}>
          {viewOrder.status !== 'CANCELADO' && (
            <PillButton variant="danger" className="w-full" onClick={() => void cancel(viewOrder)}>
              <Ban className="h-4 w-4" /> Anular boleta
            </PillButton>
          )}
        </OrderReceiptModal>
      )}
    </div>
  );
};
