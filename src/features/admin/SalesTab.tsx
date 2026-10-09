import React from 'react';
import { CircleDollarSign, FileDown, HandCoins, Loader2, Package, Receipt, Table2, TrendingUp, Wallet } from 'lucide-react';
import { useDialog } from '../../app/DialogProvider';
import { formatSoles } from '../../domain/money';
import { PERIODS, periodLabel, periodRange, type PeriodKey } from '../../domain/period';
import { shareFile } from '../../lib/shareFile';
import { usePos } from '../../state/PosContext';
import type { SalesReport } from '../../types/pos';
import { BarList, CATEGORY_COLOR, ColumnChart, StackedShare } from './charts';
import { TONE } from '../../app/tones';

/*
 * Ventas por período (día, semana o mes): una cifra protagonista, indicadores, la serie en el
 * tiempo y los desgloses. Exporta el reporte en PDF.
 */

const TILES = [
  { key: 'orders', label: 'Pedidos', icon: Receipt, tone: 'sky' },
  { key: 'avgTicket', label: 'Ticket promedio', icon: TrendingUp, tone: 'sun' },
  { key: 'collected', label: 'Cobrado', icon: Wallet, tone: 'mint' },
  { key: 'fiado', label: 'Fiado y crédito', icon: HandCoins, tone: 'pink' },
  { key: 'profit', label: 'Ganancia', icon: CircleDollarSign, tone: 'lilac' },
  { key: 'units', label: 'Unidades', icon: Package, tone: 'peach' },
] as const;

const Panel: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, action, children }) => (
  <section className="rounded-3xl bg-white p-5">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="font-display text-xl font-bold text-ink">{title}</h3>
      {action}
    </div>
    {children}
  </section>
);

export const SalesTab: React.FC = () => {
  const { api, catalog, handleError } = usePos();
  const dialog = useDialog();
  const [period, setPeriod] = React.useState<PeriodKey>('today');
  const [report, setReport] = React.useState<SalesReport | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [asTable, setAsTable] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const range = periodRange(period);

  React.useEffect(() => {
    if (!api) return;
    let alive = true;
    setLoading(true);
    setError('');
    api.salesReport(range.from, range.to)
      .then(r => { if (alive) setReport(r); })
      .catch(e => {
        if (!alive) return;
        const msg = handleError(e);
        // La función del servidor llega con la migración de reportes.
        setError(/pos_sales_report|PGRST202|could not find the function/i.test(`${msg} ${(e as { code?: string })?.code ?? ''}`)
          ? 'Falta activar los reportes en el servidor: ejecute la migración 20261010050000_reportes.sql en Supabase.'
          : msg);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [api, handleError, range.from, range.to]);

  const t = report?.totals;
  const delta = t && t.previousSales > 0 ? ((t.sales - t.previousSales) / t.previousSales) * 100 : null;
  const label = periodLabel(range.from, range.to);
  const hourly = report?.granularity === 'hour';
  const series = (report?.series ?? []).map(s => ({
    key: s.key,
    label: hourly ? `${Number(s.key)}h` : new Date(`${s.key}T12:00:00`).toLocaleDateString('es-PE', report && report.series.length <= 7 ? { weekday: 'short' } : { day: 'numeric' }),
    value: s.sales,
    detail: `${s.orders === 1 ? '1 pedido' : `${s.orders} pedidos`}`,
  }));
  const nowKey = hourly ? String(new Date().getHours()).padStart(2, '0') : range.to;
  const tileValue = (key: (typeof TILES)[number]['key']) => {
    if (!t) return '—';
    if (key === 'orders' || key === 'units') return String(t[key]);
    if (key === 'profit') return t.profit === null ? '—' : formatSoles(t.profit);
    return formatSoles(t[key]);
  };

  const exportPdf = async () => {
    if (!report) return;
    setExporting(true);
    try {
      const { buildSalesPdf } = await import('../../lib/reportPdf');
      const blob = await buildSalesPdf(report, catalog?.settings.store_name || 'Pre-Venta', label);
      await shareFile(blob, `ventas-${range.from}${range.to !== range.from ? `_${range.to}` : ''}.pdf`, 'Reporte de ventas', `Ventas · ${label}`);
    } catch (e) {
      void dialog.alert(e instanceof Error ? e.message : String(e), { tone: 'danger', title: 'No se pudo crear el PDF' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 text-ink">
      {/* Período */}
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {PERIODS.map(p => (
          <button key={p.key} type="button" onClick={() => setPeriod(p.key)} aria-pressed={period === p.key}
            className={`squish h-11 shrink-0 rounded-full px-4 text-[15px] font-bold transition ${period === p.key ? 'bg-ink text-white' : 'border border-ink/15 bg-white text-ink'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Cifra protagonista */}
      <div>
        <p className="text-[15px] font-bold text-ink-soft">Vendido</p>
        <div className="mt-1 flex flex-wrap items-end gap-x-4 gap-y-2">
          <span className="font-display text-[56px] font-bold leading-none tracking-tight [font-stretch:85%]">
            {t ? formatSoles(t.sales) : '—'}
          </span>
          {loading && <Loader2 className="mb-2 h-6 w-6 animate-spin text-ink-soft" />}
          {delta !== null && !loading && (
            <span className={`mb-1.5 rounded-full px-3 py-1 text-sm font-bold ${delta >= 0 ? 'bg-tag text-ink' : 'bg-fresa text-white'}`}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}% vs. período anterior
            </span>
          )}
        </div>
        <p className="mt-2 text-[15px] text-ink-soft">{label}</p>
        {error && <p className="mt-2 text-[15px] font-bold text-fresa">{error}</p>}
        <button type="button" onClick={() => void exportPdf()} disabled={!report || exporting}
          className="mt-4 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-bold text-white transition active:scale-95 disabled:opacity-40">
          {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileDown className="h-5 w-5" />} Descargar reporte PDF
        </button>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {TILES.map(({ key, label: l, icon: Icon, tone }) => (
          <div key={key} className={`rounded-3xl p-4 ${TONE[tone].soft}`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-ink"><Icon className="h-5 w-5" /></span>
            <div className="mt-3 text-sm font-semibold text-ink/75">{l}</div>
            <div className="font-display text-xl font-bold leading-tight">{tileValue(key)}</div>
            {key === 'profit' && t?.profit === null && <div className="text-xs text-ink-soft">Cargue costos en el catálogo</div>}
          </div>
        ))}
      </div>

      <Panel
        title={hourly ? 'Ventas por hora' : 'Ventas por día'}
        action={
          <button type="button" onClick={() => setAsTable(v => !v)} aria-pressed={asTable}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-ink/15 px-3 text-sm font-bold">
            <Table2 className="h-4 w-4" /> {asTable ? 'Ver gráfico' : 'Ver tabla'}
          </button>
        }
      >
        {asTable ? (
          <table className="w-full text-[15px]">
            <thead><tr className="text-left text-sm text-ink-soft"><th className="pb-2 font-semibold">{hourly ? 'Hora' : 'Día'}</th><th className="pb-2 text-right font-semibold">Pedidos</th><th className="pb-2 text-right font-semibold">Vendido</th></tr></thead>
            <tbody className="divide-y divide-ink/10">
              {(report?.series ?? []).filter(s => !hourly || s.orders > 0).map(s => (
                <tr key={s.key}>
                  <td className="py-2">{hourly ? `${s.key}:00` : new Date(`${s.key}T12:00:00`).toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                  <td className="py-2 text-right tabular-nums">{s.orders}</td>
                  <td className="py-2 text-right font-display font-bold tabular-nums">{formatSoles(s.sales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <ColumnChart data={series} highlightKey={period === 'today' || period === 'week' || period === 'month' ? nowKey : undefined}
            labelEvery={hourly ? 3 : series.length > 10 ? 5 : 1} />
        )}
      </Panel>

      <Panel title="Lo más vendido">
        <BarList items={(report?.topProducts ?? []).map(p => ({ label: p.name, value: p.revenue, sub: `${p.units} und.` }))} />
      </Panel>

      <Panel title="Por categoría">
        <StackedShare items={(report?.byCategory ?? []).map(c => ({ label: c.category, value: c.revenue, color: CATEGORY_COLOR[c.category] ?? CATEGORY_COLOR.Otros }))} />
      </Panel>

      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="Por vendedor">
          <BarList items={(report?.bySeller ?? []).map(s => ({ label: s.name, value: s.sales, sub: s.orders === 1 ? '1 pedido' : `${s.orders} pedidos` }))} />
        </Panel>
        <Panel title="Cobros por medio de pago">
          <BarList items={(report?.byPayment ?? []).map(p => ({ label: p.method, value: p.amount }))} />
        </Panel>
      </div>
    </div>
  );
};
