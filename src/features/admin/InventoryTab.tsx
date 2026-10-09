import React from 'react';
import { AlertTriangle, CheckCircle2, FileDown, Loader2, PackageMinus, PackagePlus, PackageX } from 'lucide-react';
import { useDialog } from '../../app/DialogProvider';
import { stockAlerts } from '../../domain/stock';
import { shareFile } from '../../lib/shareFile';
import { usePos } from '../../state/PosContext';
import type { Product } from '../../types/pos';

interface Props {
  products: Product[];
  onRestock: (product: Product) => void;
}

type View = 'out' | 'low';

/** Medidor de stock frente al mínimo: la barra lleva la gravedad; el carril es un tono claro del mismo color. */
const StockMeter: React.FC<{ product: Product; tone: View }> = ({ product, tone }) => {
  const ratio = product.minStockAlert > 0 ? Math.max(0, Math.min(product.stockInBaseUnits / (product.minStockAlert * 2), 1)) : 0;
  const color = tone === 'out' ? { fill: '#d93a55', track: '#f8dce2' } : { fill: '#d18f00', track: '#fbecc4' };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: color.track }} role="img"
      aria-label={`${product.stockInBaseUnits} de ${product.minStockAlert} mínimo`}>
      <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, background: color.fill }} />
    </div>
  );
};

/** Inventario: productos agotados y por agotarse, con reposición rápida y reporte en PDF. */
export const InventoryTab: React.FC<Props> = ({ products, onRestock }) => {
  const { catalog } = usePos();
  const dialog = useDialog();
  const { out, low } = React.useMemo(() => stockAlerts(products), [products]);
  const [view, setView] = React.useState<View>(out.length > 0 ? 'out' : 'low');
  const [exporting, setExporting] = React.useState(false);
  const list = view === 'out' ? out : low;

  const exportPdf = async () => {
    setExporting(true);
    try {
      const { buildStockPdf } = await import('../../lib/reportPdf');
      const blob = await buildStockPdf(out, low, catalog?.settings.store_name || 'Pre-Venta');
      const today = new Date().toISOString().slice(0, 10);
      await shareFile(blob, `inventario-por-reponer-${today}.pdf`, 'Productos por reponer');
    } catch (e) {
      void dialog.alert(e instanceof Error ? e.message : String(e), { tone: 'danger', title: 'No se pudo crear el PDF' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 text-ink">
      {/* Resumen con los dos estados como selector */}
      <div className="grid grid-cols-2 gap-3">
        {([
          ['out', 'Agotados', out.length, PackageX, 'bg-fresa text-white', 'bg-white text-ink'],
          ['low', 'Por agotarse', low.length, PackageMinus, 'bg-tag text-ink', 'bg-white text-ink'],
        ] as const).map(([key, label, count, Icon, on, offCls]) => (
          <button key={key} type="button" onClick={() => setView(key)} aria-pressed={view === key}
            className={`rounded-3xl p-4 text-left transition active:scale-[0.98] ${view === key ? on : offCls}`}>
            <Icon className="h-6 w-6" />
            <div className="mt-3 font-display text-[40px] font-bold leading-none">{count}</div>
            <div className="mt-1 text-[15px] font-bold">{label}</div>
          </button>
        ))}
      </div>

      <button type="button" onClick={() => void exportPdf()} disabled={exporting || (out.length === 0 && low.length === 0)}
        className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-bold text-white transition active:scale-95 disabled:opacity-40">
        {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileDown className="h-5 w-5" />} Descargar reporte PDF
      </button>

      <section>
        <h3 className="font-display text-xl font-bold">{view === 'out' ? 'Agotados' : 'Por agotarse'}</h3>
        <p className="text-[15px] text-ink-soft">
          {view === 'out' ? 'Sin stock. Las ventas de estos productos quedan en negativo.' : 'Quedan igual o menos unidades que el mínimo configurado.'}
        </p>

        {list.length === 0 ? (
          <div className="mt-4 flex items-center gap-3 rounded-3xl bg-white p-5">
            <CheckCircle2 className="h-7 w-7 shrink-0 text-brand-600" />
            <p className="text-[15px] font-bold">{view === 'out' ? 'No hay productos agotados.' : 'Ningún producto está por agotarse.'}</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {list.map(p => (
              <li key={p.id} className="rounded-3xl bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display text-[17px] font-bold leading-tight">{p.name}</div>
                    <div className="text-sm text-ink-soft">{p.category}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={`font-display text-2xl font-bold leading-none ${view === 'out' ? 'text-fresa' : 'text-[#9a6a00]'}`}>{p.stockInBaseUnits}</div>
                    <div className="text-xs text-ink-soft">{p.baseUnitName}s</div>
                  </div>
                </div>
                <div className="mt-3"><StockMeter product={p} tone={view} /></div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-sm text-ink-soft">
                    {view === 'out' && <AlertTriangle className="h-4 w-4 text-fresa" />} Mínimo {p.minStockAlert}
                  </span>
                  <button type="button" onClick={() => onRestock(p)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-600 px-4 text-sm font-bold text-white active:scale-95">
                    <PackagePlus className="h-4 w-4" /> Reponer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
