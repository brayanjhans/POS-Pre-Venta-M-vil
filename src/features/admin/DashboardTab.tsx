import React from 'react';
import { AlertTriangle, ChevronRight, RefreshCw } from 'lucide-react';
import { stockAlerts } from '../../domain/stock';
import { formatSoles } from '../../domain/money';
import { usePos } from '../../state/PosContext';
import type { Dashboard, Product } from '../../types/pos';

interface Props {
  products: Product[];
  onRegularize: (product: Product) => void;
  onOpenInventory?: () => void;
}

const daysUntil = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
const time = (iso: string) => new Date(iso).toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' });

/** Fila de la cinta: concepto a la izquierda, monto a la derecha. */
const TapeRow: React.FC<{ label: string; hint?: string; value: React.ReactNode; tone?: 'fresa' | 'muted' }> = ({ label, hint, value, tone }) => (
  <div className="flex items-baseline justify-between gap-4 py-2">
    <div className="min-w-0">
      <div className="text-[15px] text-ink">{label}</div>
      {hint && <div className="text-sm text-ink-soft">{hint}</div>}
    </div>
    <div className={`shrink-0 font-display text-lg font-bold ${tone === 'fresa' ? 'text-fresa' : tone === 'muted' ? 'text-ink-soft' : 'text-ink'}`}>{value}</div>
  </div>
);

/** Encabezado de sección: título y, si hace falta, una cifra al costado. */
const Section: React.FC<{ title: string; count?: number; children: React.ReactNode }> = ({ title, count, children }) => (
  <section>
    <h3 className="flex items-baseline gap-2 font-display text-xl font-bold text-ink">
      {title}
      {count !== undefined && count > 0 && <span className="text-base font-semibold text-ink-soft">{count}</span>}
    </h3>
    <div className="mt-2">{children}</div>
  </section>
);

/**
 * Resumen del dueño. El día se presenta como la cinta del cierre de caja (ticket térmico):
 * lo vendido arriba, en grande; debajo cobrado, fiado y el mes. El resto son listas simples.
 */
export const DashboardTab: React.FC<Props> = ({ products, onRegularize, onOpenInventory }) => {
  const { api, handleError } = usePos();
  const [data, setData] = React.useState<Dashboard | null>(null);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!api) return;
    setLoading(true);
    try {
      setData(await api.dashboard());
      setError('');
    } catch (e) {
      setError(handleError(e));
    } finally {
      setLoading(false);
    }
  }, [api, handleError]);

  React.useEffect(() => { void load(); }, [load]);

  const active = products.filter(p => p.isActive !== false);
  const stock = stockAlerts(products);
  const lowStock = active.filter(p => p.stockInBaseUnits <= p.minStockAlert).sort((a, b) => a.stockInBaseUnits - b.stockInBaseUnits);
  const expiring = active
    .filter(p => p.expirationDate && daysUntil(p.expirationDate) <= 30)
    .sort((a, b) => daysUntil(a.expirationDate!) - daysUntil(b.expirationDate!));
  const vsYesterday = data && data.salesYesterday > 0 ? ((data.salesToday - data.salesYesterday) / data.salesYesterday) * 100 : null;
  const todayRaw = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
  const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);

  return (
    <div className="mx-auto max-w-2xl space-y-8 text-ink">
      {/* Aviso: productos que se están acabando */}
      {(stock.out.length > 0 || stock.low.length > 0) && (
        <button type="button" onClick={onOpenInventory}
          className={`flex w-full items-center gap-3 rounded-3xl p-4 text-left transition active:scale-[0.99] ${stock.out.length ? 'bg-fresa text-white' : 'bg-tag text-ink'}`}>
          <AlertTriangle className="h-7 w-7 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg font-bold leading-tight">
              {[stock.out.length && `${stock.out.length} ${stock.out.length === 1 ? 'agotado' : 'agotados'}`,
                stock.low.length && `${stock.low.length} por agotarse`].filter(Boolean).join(' y ')}
            </span>
            <span className="block text-sm opacity-85">Toque para ver qué reponer</span>
          </span>
          <ChevronRight className="h-6 w-6 shrink-0" />
        </button>
      )}

      {/* La cinta del día */}
      <div>
        <button type="button" onClick={() => void load()} aria-label="Actualizar cifras"
          className="inline-flex h-10 items-center gap-2 rounded-xl text-[15px] font-bold text-ink-soft transition hover:text-ink">
          {today}
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : 'opacity-60'}`} />
        </button>
        {error && <p className="mt-2 text-[15px] font-bold text-fresa">{error}</p>}

        <div className="tape relative mt-2 bg-white px-5 pb-7 pt-5 shadow-[0_1px_0_rgba(31,42,48,0.06),0_18px_30px_-24px_rgba(31,42,48,0.6)]">
          <div className="text-[15px] text-ink-soft">Vendido hoy</div>
          <div className="mt-1 font-display text-[52px] font-bold leading-none tracking-tight [font-stretch:85%]">
            {data ? formatSoles(data.salesToday) : '—'}
          </div>
          {data && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[15px]">
              <span className="text-ink-soft">{data.ordersToday === 1 ? '1 pedido' : `${data.ordersToday} pedidos`}</span>
              {vsYesterday !== null && (
                <span className={`rounded-md px-2 py-0.5 text-sm font-bold ${vsYesterday >= 0 ? 'bg-tag text-ink' : 'bg-fresa/10 text-fresa'}`}>
                  {vsYesterday >= 0 ? '+' : ''}{vsYesterday.toFixed(0)}% que ayer
                </span>
              )}
            </div>
          )}

          <div className="my-4 border-t-2 border-dashed border-ink/15" />

          <TapeRow label="Cobrado en caja" hint="Ventas y abonos, menos devoluciones" value={data ? formatSoles(data.collectedToday) : '—'} />
          <TapeRow
            label="Por cobrar (fiado)"
            hint={data ? (data.debtors === 1 ? '1 cliente' : `${data.debtors} clientes`) : undefined}
            value={data ? formatSoles(data.totalDebt) : '—'}
            tone={data && data.totalDebt > 0 ? 'fresa' : undefined}
          />
          <TapeRow label="Pedidos sin cobrar" value={data ? data.pendingOrders : '—'} tone={data && data.pendingOrders === 0 ? 'muted' : undefined} />

          <div className="my-3 border-t-2 border-dashed border-ink/15" />

          <TapeRow label="Vendido este mes" value={data ? formatSoles(data.salesMonth) : '—'} />
          <TapeRow
            label="Ganancia del mes"
            hint={data && data.profitMonth === null ? 'Cargue el costo de los productos para calcularla' : undefined}
            value={data && data.profitMonth !== null ? formatSoles(data.profitMonth) : '—'}
            tone={data && data.profitMonth === null ? 'muted' : undefined}
          />
        </div>
      </div>

      <Section title="Trabajando ahora" count={data?.openShifts.length}>
        {data && data.openShifts.length === 0 && <p className="text-[15px] text-ink-soft">Nadie tiene la caja abierta.</p>}
        <ul className="divide-y divide-ink/10">
          {data?.openShifts.map(s => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="truncate text-[15px] font-bold">{s.userName}</div>
                <div className="text-sm text-ink-soft">Desde las {time(s.openedAt)}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-display text-lg font-bold">{formatSoles(s.expectedCashNow)}</div>
                <div className="text-sm text-ink-soft">en efectivo</div>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Por reponer" count={lowStock.length}>
        {lowStock.length === 0 && <p className="text-[15px] text-ink-soft">Ningún producto bajo el mínimo.</p>}
        <ul className="divide-y divide-ink/10">
          {lowStock.map(p => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="truncate text-[15px] font-bold">{p.name}</div>
                {p.stockInBaseUnits < 0 ? (
                  <button type="button" onClick={() => onRegularize(p)} className="mt-0.5 text-sm font-bold text-brand-700 underline underline-offset-2">
                    Registrar la compra a otra tienda
                  </button>
                ) : (
                  <div className="text-sm text-ink-soft">Mínimo {p.minStockAlert} {p.baseUnitName}s</div>
                )}
              </div>
              <div className={`shrink-0 font-display text-lg font-bold ${p.stockInBaseUnits < 0 ? 'text-fresa' : 'text-ink'}`}>
                {p.stockInBaseUnits} <span className="text-sm font-semibold text-ink-soft">{p.baseUnitName}s</span>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Por vencer" count={expiring.length}>
        {expiring.length === 0 && <p className="text-[15px] text-ink-soft">Nada vence en los próximos 30 días.</p>}
        <ul className="divide-y divide-ink/10">
          {expiring.map(p => {
            const d = daysUntil(p.expirationDate!);
            return (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-bold">{p.name}</div>
                  <div className="text-sm text-ink-soft">
                    {new Date(`${p.expirationDate}T12:00:00`).toLocaleDateString('es-PE', { day: 'numeric', month: 'long' })}
                  </div>
                </div>
                <span className={`shrink-0 rounded-md px-2 py-1 text-sm font-bold ${d < 0 ? 'bg-fresa text-white' : d <= 7 ? 'bg-tag text-ink' : 'bg-ink/5 text-ink-soft'}`}>
                  {d < 0 ? 'Vencido' : d === 0 ? 'Vence hoy' : d === 1 ? 'Mañana' : `En ${d} días`}
                </span>
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
};
