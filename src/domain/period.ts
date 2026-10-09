/** Períodos de reporte en fechas locales del celular (YYYY-MM-DD). */

export type PeriodKey = 'today' | 'yesterday' | 'week' | 'month' | 'lastMonth';

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'yesterday', label: 'Ayer' },
  { key: 'week', label: '7 días' },
  { key: 'month', label: 'Este mes' },
  { key: 'lastMonth', label: 'Mes pasado' },
];

export const isoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export function periodRange(key: PeriodKey, now = new Date()): { from: string; to: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (key) {
    case 'today': return { from: isoDate(today), to: isoDate(today) };
    case 'yesterday': { const y = addDays(today, -1); return { from: isoDate(y), to: isoDate(y) }; }
    case 'week': return { from: isoDate(addDays(today, -6)), to: isoDate(today) };
    case 'month': return { from: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: isoDate(today) };
    case 'lastMonth': {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: isoDate(first), to: isoDate(last) };
    }
  }
}

/** "9 de octubre", "3 – 9 de octubre", "1 sept. – 30 sept." */
export function periodLabel(from: string, to: string): string {
  const f = new Date(`${from}T12:00:00`);
  const t = new Date(`${to}T12:00:00`);
  const long = (d: Date) => d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
  if (from === to) return long(f);
  if (f.getMonth() === t.getMonth() && f.getFullYear() === t.getFullYear()) return `${f.getDate()} – ${long(t)}`;
  return `${f.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })} – ${long(t)}`;
}
