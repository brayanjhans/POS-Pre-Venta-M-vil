/** Redondeo a céntimos igual al de PostgreSQL round(x, 2) para montos positivos. */
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export const formatSoles = (n: number | null | undefined): string => `S/ ${(Number(n) || 0).toFixed(2)}`;

/** Convierte texto del usuario ("12,50", " 7 ") a número; NaN si no es válido. */
export const parseAmount = (text: string): number => {
  const clean = text.trim().replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return NaN;
  return Number(clean);
};
