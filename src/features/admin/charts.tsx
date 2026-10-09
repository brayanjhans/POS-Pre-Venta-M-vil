import React from 'react';
import { formatSoles } from '../../domain/money';

/*
 * Gráficos del panel (skill dataviz): marcas finas (barras <= 24px, punta redondeada 4px y base
 * recta), líneas guía de 1px recesivas, 2px de separación entre segmentos, tooltip al tocar,
 * texto siempre en tinta (nunca del color de la serie) y leyenda cuando hay más de una serie.
 */

const ACCENT = '#008168';        // menta de marca: la barra que importa
const DEEMPH = '#cfe3da';        // resto en gris verdoso (énfasis)
const GRID = '#f1e7d6';

/** Paleta categórica validada (orden fijo; el color sigue a la categoría, nunca a su posición). */
export const CATEGORY_COLOR: Record<string, string> = {
  Bebidas: '#2a78d6',
  Chocolates: '#eb6834',
  Galletas: '#1baf7a',
  Golosinas: '#eda100',
  Snacks: '#e87ba4',
  Licores: '#008300',
  Otros: '#8a948f',
};

const compact = (n: number) =>
  n >= 1000 ? `S/ ${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `S/ ${Math.round(n)}`;

/** Escala "linda" para el eje: 0, paso, 2·paso… cubriendo el máximo. */
const niceMax = (max: number) => {
  if (max <= 0) return { top: 1, step: 1 };
  const raw = max / 3;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * pow).find(s => s >= raw) ?? raw;
  return { top: step * Math.ceil(max / step), step };
};

interface ColumnDatum { key: string; label: string; value: number; detail?: string }

/** Columnas de una sola serie con énfasis en una columna (ej. hoy) y tooltip al tocar. */
export const ColumnChart: React.FC<{ data: ColumnDatum[]; highlightKey?: string; height?: number; labelEvery?: number }> = ({
  data, highlightKey, height = 176, labelEvery = 1,
}) => {
  const [active, setActive] = React.useState<number | null>(null);
  const { top, step } = niceMax(Math.max(...data.map(d => d.value), 0));
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const shown = active !== null ? data[active] : null;

  return (
    <div className="select-none pt-3">
      <div className="relative flex" style={{ height }}>
        {/* Eje Y + líneas guía */}
        <div className="relative w-12 shrink-0">
          {ticks.map(t => (
            <span key={t} className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-ink-soft" style={{ bottom: `${(t / top) * 100}%` }}>
              {compact(t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1" onMouseLeave={() => setActive(null)}>
          {ticks.map(t => (
            <span key={t} className="absolute inset-x-0 h-px" style={{ bottom: `${(t / top) * 100}%`, background: t === 0 ? '#c3cbc6' : GRID }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {data.map((d, i) => {
              const h = top ? (d.value / top) * 100 : 0;
              const isAccent = highlightKey ? d.key === highlightKey : false;
              return (
                <button
                  key={d.key}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
                  aria-label={`${d.label}: ${formatSoles(d.value)}`}
                  className="relative flex h-full flex-1 items-end justify-center outline-none"
                >
                  <span
                    className="block w-full max-w-6 rounded-t-[4px] transition-opacity"
                    style={{
                      height: `${Math.max(h, d.value > 0 ? 1.5 : 0)}%`,
                      background: isAccent || active === i ? ACCENT : DEEMPH,
                      opacity: active !== null && active !== i ? 0.55 : 1,
                    }}
                  />
                </button>
              );
            })}
          </div>
          {shown && (
            <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 rounded-xl bg-ink px-3 py-2 text-center text-white shadow-lg">
              <div className="text-xs text-white/70">{shown.label}</div>
              <div className="font-display text-base font-bold">{formatSoles(shown.value)}</div>
              {shown.detail && <div className="text-xs text-white/70">{shown.detail}</div>}
            </div>
          )}
        </div>
      </div>
      {/* Eje X */}
      <div className="ml-12 mt-1.5 flex gap-[2px]">
        {data.map((d, i) => (
          <span key={d.key} className="flex-1 truncate text-center text-[11px] text-ink-soft">
            {i % labelEvery === 0 || i === data.length - 1 ? d.label : ''}
          </span>
        ))}
      </div>
    </div>
  );
};

/** Barras horizontales de una serie, con el valor en la punta. */
export const BarList: React.FC<{
  items: { label: string; value: number; sub?: string }[];
  format?: (n: number) => string;
  empty?: string;
}> = ({ items, format = formatSoles, empty = 'Sin datos en este período.' }) => {
  const max = Math.max(...items.map(i => i.value), 0);
  if (items.length === 0) return <p className="text-[15px] text-ink-soft">{empty}</p>;
  return (
    <ul className="space-y-3">
      {items.map((it, idx) => (
        <li key={`${it.label}-${idx}`}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-[15px] font-bold text-ink">{it.label}</span>
            <span className="shrink-0 font-display text-[15px] font-bold tabular-nums text-ink">{format(it.value)}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="h-2.5 rounded-r-[4px]" style={{ width: `${max ? Math.max((it.value / max) * 100, 2) : 0}%`, background: ACCENT }} />
            {it.sub && <span className="shrink-0 text-xs text-ink-soft">{it.sub}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
};

/** Parte del total: una barra apilada (2px de separación) + leyenda con valor y porcentaje. */
export const StackedShare: React.FC<{ items: { label: string; value: number; color: string }[]; format?: (n: number) => string }> = ({
  items, format = formatSoles,
}) => {
  const total = items.reduce((a, i) => a + i.value, 0);
  if (!total) return <p className="text-[15px] text-ink-soft">Sin datos en este período.</p>;
  return (
    <div>
      <div className="flex h-5 w-full gap-[2px] overflow-hidden rounded-[4px]" role="img"
        aria-label={items.map(i => `${i.label} ${Math.round((i.value / total) * 100)}%`).join(', ')}>
        {items.map(i => (
          <span key={i.label} title={`${i.label}: ${format(i.value)}`} style={{ width: `${(i.value / total) * 100}%`, background: i.color }} />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {items.map(i => (
          <li key={i.label} className="flex items-center gap-2 text-[15px]">
            <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: i.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-ink">{i.label}</span>
            <span className="font-display font-bold tabular-nums text-ink">{format(i.value)}</span>
            <span className="w-10 text-right text-sm tabular-nums text-ink-soft">{Math.round((i.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
