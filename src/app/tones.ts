/*
 * Colores de identidad (estilo Olipop): cada categoría y cada sección tiene su pastel.
 * Pastel para fondos amplios (no cansa la vista) y su tono fuerte para íconos y detalles.
 */

export type Tone = 'sun' | 'mint' | 'pink' | 'peach' | 'sky' | 'lilac' | 'cream';

/** Clases por tono: fondo pastel, fondo suave (≈35%), texto/ícono fuerte y anillo. */
export const TONE: Record<Tone, { bg: string; soft: string; strong: string; hex: string }> = {
  sun: { bg: 'bg-sun', soft: 'bg-sun/45', strong: 'text-sun-strong', hex: '#fdda79' },
  mint: { bg: 'bg-mint', soft: 'bg-mint/45', strong: 'text-mint-strong', hex: '#98e1c3' },
  pink: { bg: 'bg-pink', soft: 'bg-pink/40', strong: 'text-pink-strong', hex: '#ff9ec8' },
  peach: { bg: 'bg-peach', soft: 'bg-peach/45', strong: 'text-peach-strong', hex: '#ffb8b3' },
  sky: { bg: 'bg-sky', soft: 'bg-sky/50', strong: 'text-sky-strong', hex: '#a9d8ff' },
  lilac: { bg: 'bg-lilac', soft: 'bg-lilac/50', strong: 'text-lilac-strong', hex: '#d4c2ff' },
  cream: { bg: 'bg-cream', soft: 'bg-cream', strong: 'text-ink', hex: '#fdf0dc' },
};

export const CATEGORY_TONE: Record<string, Tone> = {
  Bebidas: 'sky',
  Chocolates: 'peach',
  Galletas: 'sun',
  Golosinas: 'pink',
  Snacks: 'lilac',
  Licores: 'mint',
};
export const categoryTone = (category: string): Tone => CATEGORY_TONE[category] ?? 'cream';

/** Tono de cada sección del administrador (y de Caja). */
export const SECTION_TONE: Record<string, Tone> = {
  dashboard: 'mint',
  sales: 'sky',
  inventory: 'peach',
  products: 'sun',
  new_product: 'sun',
  promos: 'pink',
  new_promo: 'pink',
  orders: 'lilac',
  customers: 'sky',
  deudores: 'pink',
  users: 'mint',
  settings: 'cream',
  caja: 'sun',
};

/** Orden de pasteles para listas que alternan color (ej. promociones). */
export const ROTATION: Tone[] = ['sun', 'pink', 'mint', 'sky', 'peach', 'lilac'];
