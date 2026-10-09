import React from 'react';
import { Search, X } from 'lucide-react';
import { TONE, type Tone } from './tones';

/*
 * Piezas del diseño "Dulce" (Ventas/Pre-Venta) para que todas las secciones se vean iguales:
 * título grande, filtros redondos, buscador redondo, tarjetas blancas, estados con color,
 * vacíos que invitan a actuar y botones tipo píldora.
 */

/** Título de sección: grande (Fraunces) con una línea de contexto. */
export const PageTitle: React.FC<{ title: string; subtitle?: React.ReactNode; action?: React.ReactNode }> = ({ title, subtitle, action }) => (
  <div className="flex flex-wrap items-end justify-between gap-3">
    <div className="min-w-0">
      <h2 className="font-display text-[28px] font-bold leading-tight text-ink">{title}</h2>
      {subtitle && <p className="mt-0.5 text-[15px] text-ink-soft">{subtitle}</p>}
    </div>
    {action}
  </div>
);

/** Filtros redondos deslizables; el activo va en verde bosque. */
export function Pills<T extends string>({ options, value, onChange }: {
  options: { value: T; label: React.ReactNode; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={value === o.value}
          className={`squish inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[15px] font-bold transition ${
            value === o.value ? 'bg-ink text-white' : 'border border-ink/15 bg-white text-ink'}`}>
          {o.label}
          {o.count !== undefined && (
            <span className={`rounded-full px-1.5 text-xs ${value === o.value ? 'bg-white/20' : 'bg-ink/8 text-ink-soft'}`}>{o.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Buscador redondo con botón para borrar. */
export const SearchField: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string }> = ({ value, onChange, placeholder }) => (
  <div className="relative">
    <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-soft" />
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="h-12 w-full rounded-full border border-ink/10 bg-white pl-11 pr-10 text-[15px] text-ink outline-none placeholder:text-ink/40 focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15" />
    {value && (
      <button type="button" onClick={() => onChange('')} aria-label="Borrar búsqueda"
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-ink/5 text-ink-soft">
        <X className="h-4 w-4" />
      </button>
    )}
  </div>
);

/** Tarjeta blanca de la lista (sin borde, sobre fondo crema). */
export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { as?: 'div' | 'li' }> = ({ as = 'div', className = '', ...rest }) =>
  React.createElement(as, { ...rest, className: `rounded-3xl bg-white p-4 ${className}` });

/** Etiqueta de estado con color pastel. */
export const StatusPill: React.FC<{ tone: Tone | 'fresa' | 'muted'; children: React.ReactNode }> = ({ tone, children }) => {
  const cls = tone === 'fresa' ? 'bg-fresa text-white' : tone === 'muted' ? 'bg-ink/10 text-ink-soft' : `${TONE[tone].bg} text-ink`;
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>{children}</span>;
};

/** Burbuja de ícono con color pastel. */
export const IconBubble: React.FC<{ tone: Tone; children: React.ReactNode; size?: 'sm' | 'md' }> = ({ tone, children, size = 'md' }) => (
  <span className={`flex shrink-0 items-center justify-center rounded-2xl text-ink ${TONE[tone].bg} ${size === 'sm' ? 'h-9 w-9' : 'h-12 w-12'}`}>{children}</span>
);

/** Estado vacío: dice qué pasa y qué hacer. */
export const EmptyState: React.FC<{ icon: React.ReactNode; title: string; hint?: string; tone?: Tone; action?: React.ReactNode }> = ({ icon, title, hint, tone = 'mint', action }) => (
  <div className="flex flex-col items-center rounded-3xl bg-white px-6 py-8 text-center">
    <IconBubble tone={tone}>{icon}</IconBubble>
    <p className="mt-3 font-display text-lg font-bold text-ink">{title}</p>
    {hint && <p className="mt-1 max-w-xs text-[15px] text-ink-soft">{hint}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

/** Botón píldora: primario (verde bosque), suave o peligro. */
export const PillButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'soft' | 'danger' | 'brand'; size?: 'md' | 'lg' }> = ({
  variant = 'primary', size = 'md', className = '', ...rest
}) => {
  const v = variant === 'primary' ? 'bg-ink text-white'
    : variant === 'brand' ? 'bg-brand-600 text-white'
    : variant === 'danger' ? 'bg-fresa/10 text-fresa'
    : 'border border-ink/15 bg-white text-ink';
  return (
    <button type="button" {...rest}
      className={`squish inline-flex items-center justify-center gap-1.5 rounded-full font-bold transition disabled:opacity-40 ${size === 'lg' ? 'h-14 px-6 text-base' : 'h-11 px-4 text-[15px]'} ${v} ${className}`} />
  );
};
