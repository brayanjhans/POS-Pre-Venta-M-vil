import React from 'react';

/*
 * Ilustraciones propias (estilo sticker, inspiradas en los empaques de Olipop) para cada tipo de
 * producto. Contorno grueso y redondeado en verde bosque, cuerpo en el color de la marca y brillos
 * blancos. Pesan casi nada (SVG en código), se ven iguales en todos los celulares y no necesitan
 * subir fotos. Elección: imageUrl "art:<clave>" → palabras del nombre → ilustración de la categoría.
 */

const INK = '#14433d';
const S = { stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const W = '#ffffff';

type Draw = (c: string) => React.ReactNode;

const ART: Record<string, Draw> = {
  caramelo: c => (<>
    <path d="M30 50 L10 36 L15 50 L10 64 Z" fill={c} {...S} />
    <path d="M70 50 L90 36 L85 50 L90 64 Z" fill={c} {...S} />
    <ellipse cx="50" cy="50" rx="23" ry="17" fill={c} {...S} />
    <path d="M40 42 Q46 38 54 40" fill="none" stroke={W} strokeWidth="4" strokeLinecap="round" opacity=".8" />
  </>),
  'caramelo-tira': c => (<>
    <rect x="14" y="34" width="72" height="32" rx="12" fill={c} {...S} />
    <rect x="38" y="34" width="24" height="32" fill={W} {...S} />
    <path d="M22 42 h8" stroke={W} strokeWidth="4" strokeLinecap="round" opacity=".7" />
  </>),
  chupetin: c => (<>
    <rect x="46" y="56" width="8" height="36" rx="4" fill={W} {...S} />
    <circle cx="50" cy="38" r="25" fill={c} {...S} />
    <path d="M50 38 m-12 0 a12 12 0 1 1 12 12 a6 6 0 1 1 -6 -6" fill="none" stroke={W} strokeWidth="4" strokeLinecap="round" />
  </>),
  chicle: c => (<>
    <rect x="20" y="24" width="60" height="52" rx="10" fill={c} {...S} />
    <path d="M20 42 h60 M20 58 h60" stroke={INK} strokeWidth="3" />
    <rect x="30" y="47" width="40" height="6" rx="3" fill={W} />
    <path d="M28 32 h10" stroke={W} strokeWidth="4" strokeLinecap="round" opacity=".8" />
  </>),
  gomita: c => (<>
    <circle cx="36" cy="22" r="8" fill={c} {...S} />
    <circle cx="64" cy="22" r="8" fill={c} {...S} />
    <circle cx="50" cy="34" r="16" fill={c} {...S} />
    <ellipse cx="50" cy="66" rx="22" ry="24" fill={c} {...S} />
    <circle cx="44" cy="32" r="2.5" fill={INK} /><circle cx="56" cy="32" r="2.5" fill={INK} />
    <path d="M40 58 Q44 54 48 56" fill="none" stroke={W} strokeWidth="4" strokeLinecap="round" opacity=".8" />
  </>),
  marshmallow: c => (<>
    <rect x="22" y="52" width="56" height="30" rx="14" fill={c} {...S} />
    <rect x="22" y="22" width="56" height="30" rx="14" fill={W} {...S} />
    <path d="M32 32 h10" stroke={c} strokeWidth="4" strokeLinecap="round" />
  </>),
  chocolate: c => (<>
    <rect x="14" y="28" width="72" height="44" rx="8" fill={c} {...S} />
    <path d="M66 28 L86 28 L86 48 Z" fill="#d9dde0" {...S} />
    <rect x="24" y="40" width="34" height="20" rx="4" fill={W} {...S} />
    <path d="M28 50 h26" stroke={c} strokeWidth="4" strokeLinecap="round" />
  </>),
  bombon: c => (<>
    <path d="M26 56 L32 82 H68 L74 56 Z" fill={W} {...S} />
    <path d="M36 62 v14 M50 62 v14 M64 62 v14" stroke={INK} strokeWidth="2.5" />
    <circle cx="50" cy="46" r="24" fill={c} {...S} />
    <path d="M38 40 Q50 30 62 40" fill="none" stroke={W} strokeWidth="4" strokeLinecap="round" opacity=".8" />
  </>),
  lentejas: c => (<>
    <path d="M26 16 h48 l-4 10 v48 l4 10 h-48 l4 -10 v-48 z" fill={c} {...S} />
    {[['40', '42', '#e5484d'], ['58', '46', '#2b8ad6'], ['46', '60', '#1aa260'], ['60', '64', '#f7c600']].map(([x, y, f]) => (
      <circle key={x + y} cx={x} cy={y} r="7" fill={f} {...S} strokeWidth={3} />
    ))}
  </>),
  galleta: c => (<>
    <circle cx="50" cy="50" r="32" fill={c} {...S} />
    {[[38, 38], [60, 36], [44, 58], [64, 60], [52, 48]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="4" fill={INK} />)}
    <path d="M30 40 Q34 30 44 26" fill="none" stroke={W} strokeWidth="4" strokeLinecap="round" opacity=".7" />
  </>),
  'galleta-paquete': c => (<>
    <rect x="12" y="34" width="76" height="32" rx="12" fill={c} {...S} />
    <path d="M22 34 v32 M78 34 v32" stroke={INK} strokeWidth="3" />
    <ellipse cx="50" cy="50" rx="18" ry="10" fill={W} {...S} strokeWidth={3} />
    <circle cx="50" cy="50" r="4" fill={c} />
  </>),
  wafer: c => (<>
    <rect x="16" y="30" width="68" height="40" rx="6" fill={c} {...S} />
    <path d="M16 43 h68 M16 57 h68" stroke={W} strokeWidth="5" />
    <path d="M30 30 v40 M50 30 v40 M70 30 v40" stroke={INK} strokeWidth="2" opacity=".5" />
  </>),
  papitas: c => (<>
    <path d="M24 14 h52 l-5 11 v50 l5 11 h-52 l5 -11 v-50 z" fill={c} {...S} />
    <circle cx="50" cy="50" r="15" fill={W} {...S} strokeWidth={3} />
    <ellipse cx="50" cy="50" rx="9" ry="6" fill="#f7c600" {...S} strokeWidth={2.5} />
    <path d="M34 22 v12" stroke={W} strokeWidth="4" strokeLinecap="round" opacity=".7" />
  </>),
  'tubo-papas': c => (<>
    <rect x="32" y="16" width="36" height="72" rx="10" fill={c} {...S} />
    <ellipse cx="50" cy="16" rx="18" ry="6" fill="#d9dde0" {...S} />
    <circle cx="50" cy="52" r="11" fill={W} {...S} strokeWidth={3} />
  </>),
  canchita: c => (<>
    <circle cx="38" cy="28" r="10" fill="#fff6d6" {...S} />
    <circle cx="54" cy="22" r="11" fill="#fff6d6" {...S} />
    <circle cx="66" cy="32" r="9" fill="#fff6d6" {...S} />
    <path d="M26 34 h48 l-6 52 h-36 z" fill={W} {...S} />
    <path d="M38 34 l2 52 M50 34 v52 M62 34 l-2 52" stroke={c} strokeWidth="6" />
  </>),
  mani: c => (<>
    <path d="M26 16 h48 l-4 10 v48 l4 10 h-48 l4 -10 v-48 z" fill={c} {...S} />
    <path d="M42 40 a9 9 0 1 1 16 0 a9 9 0 0 1 0 14 a9 9 0 1 1 -16 0 a9 9 0 0 1 0 -14 z" fill="#e8c38f" {...S} strokeWidth={3} />
  </>),
  gaseosa: c => (<>
    <rect x="41" y="8" width="18" height="9" rx="2" fill={c} {...S} />
    <path d="M42 17 h16 v9 c9 4 12 11 12 19 v38 c0 6 -4 9 -10 9 h-20 c-6 0 -10 -3 -10 -9 v-38 c0 -8 3 -15 12 -19 z" fill={c} {...S} />
    <rect x="30" y="52" width="40" height="18" fill={W} {...S} strokeWidth={3} />
    <path d="M38 30 v14" stroke={W} strokeWidth="4" strokeLinecap="round" opacity=".7" />
  </>),
  lata: c => (<>
    <rect x="28" y="16" width="44" height="70" rx="9" fill={c} {...S} />
    <path d="M30 26 h40" stroke={INK} strokeWidth="3" />
    <rect x="28" y="44" width="44" height="18" fill={W} {...S} strokeWidth={3} />
    <path d="M36 30 v8" stroke={W} strokeWidth="4" strokeLinecap="round" opacity=".8" />
  </>),
  agua: c => (<>
    <rect x="42" y="8" width="16" height="9" rx="2" fill={c} {...S} />
    <path d="M42 17 h16 v8 c8 4 10 10 10 17 v42 c0 5 -4 8 -9 8 h-18 c-5 0 -9 -3 -9 -8 v-42 c0 -7 2 -13 10 -17 z" fill="#d9f0ff" {...S} />
    <rect x="32" y="50" width="36" height="20" fill={c} {...S} strokeWidth={3} />
    <path d="M40 30 v14" stroke={W} strokeWidth="4" strokeLinecap="round" />
  </>),
  jugo: c => (<>
    <path d="M62 8 L54 22" stroke={INK} strokeWidth="4" strokeLinecap="round" />
    <path d="M30 26 l10 -10 h20 l10 10 v62 h-40 z" fill={c} {...S} />
    <path d="M30 26 h40" stroke={INK} strokeWidth="3" />
    <circle cx="50" cy="56" r="12" fill={W} {...S} strokeWidth={3} />
  </>),
  energizante: c => (<>
    <rect x="33" y="10" width="34" height="80" rx="7" fill={c} {...S} />
    <path d="M53 26 L42 52 H52 L46 74 L60 44 H50 Z" fill={W} {...S} strokeWidth={2.5} />
  </>),
  deportiva: c => (<>
    <rect x="40" y="6" width="20" height="12" rx="3" fill={W} {...S} />
    <path d="M38 18 h24 v14 c0 4 -4 6 -4 10 s4 6 4 10 v32 c0 5 -3 8 -8 8 h-8 c-5 0 -8 -3 -8 -8 v-32 c0 -4 4 -6 4 -10 s-4 -6 -4 -10 z" fill={c} {...S} />
    <rect x="38" y="58" width="24" height="14" fill={W} {...S} strokeWidth={3} />
  </>),
  yogur: c => (<>
    <rect x="40" y="10" width="20" height="10" rx="3" fill={W} {...S} />
    <path d="M38 20 h24 c8 6 12 14 12 24 v34 c0 6 -4 10 -10 10 h-28 c-6 0 -10 -4 -10 -10 v-34 c0 -10 4 -18 12 -24 z" fill={W} {...S} />
    <path d="M26 54 h48 v24 c0 6 -4 10 -10 10 h-28 c-6 0 -10 -4 -10 -10 z" fill={c} {...S} />
  </>),
  leche: c => (<>
    <rect x="24" y="22" width="52" height="62" rx="8" fill={c} {...S} />
    <ellipse cx="50" cy="22" rx="26" ry="6" fill="#d9dde0" {...S} />
    <rect x="24" y="44" width="52" height="20" fill={W} {...S} strokeWidth={3} />
  </>),
  keke: c => (<>
    <path d="M14 70 L50 26 L86 70 Z" fill="#f3d9a4" {...S} />
    <path d="M14 70 h72 v12 h-72 z" fill={c} {...S} />
    <path d="M26 56 h48" stroke={c} strokeWidth="6" />
    <circle cx="50" cy="24" r="6" fill="#e5484d" {...S} strokeWidth={3} />
  </>),
  pan: c => (<>
    <path d="M14 70 v-18 c0 -14 16 -24 36 -24 s36 10 36 24 v18 c0 6 -4 10 -10 10 h-52 c-6 0 -10 -4 -10 -10 z" fill="#e8b87a" {...S} />
    <rect x="22" y="48" width="56" height="20" rx="4" fill={c} {...S} strokeWidth={3} />
  </>),
  helado: c => (<>
    <rect x="45" y="62" width="10" height="28" rx="5" fill="#e8c38f" {...S} />
    <path d="M28 30 c0 -12 10 -20 22 -20 s22 8 22 20 v34 h-44 z" fill={c} {...S} />
    <path d="M36 26 v20" stroke={W} strokeWidth="4" strokeLinecap="round" opacity=".8" />
  </>),
  cerveza: c => (<>
    <rect x="44" y="6" width="12" height="8" rx="2" fill="#d9dde0" {...S} />
    <path d="M44 14 h12 v16 c6 4 9 10 9 16 v38 c0 5 -3 8 -8 8 h-14 c-5 0 -8 -3 -8 -8 v-38 c0 -6 3 -12 9 -16 z" fill="#8a5a1f" {...S} />
    <rect x="35" y="52" width="30" height="20" rx="3" fill={c} {...S} strokeWidth={3} />
  </>),
  licor: c => (<>
    <rect x="44" y="6" width="12" height="10" rx="2" fill={INK} {...S} />
    <path d="M44 16 h12 v14 c8 4 12 10 12 18 v36 c0 5 -3 8 -8 8 h-20 c-5 0 -8 -3 -8 -8 v-36 c0 -8 4 -14 12 -18 z" fill={c} {...S} />
    <rect x="36" y="54" width="28" height="22" rx="3" fill={W} {...S} strokeWidth={3} />
  </>),
  caja: c => (<>
    <path d="M16 36 L50 22 L84 36 V72 L50 86 L16 72 Z" fill={c} {...S} />
    <path d="M16 36 L50 50 L84 36 M50 50 V86" fill="none" {...S} />
    <path d="M33 29 L67 43" stroke={W} strokeWidth="6" strokeLinecap="round" />
  </>),
};

/** Palabras del nombre que delatan el tipo de producto (para productos creados antes de este cambio). */
const KEYWORDS: [RegExp, string][] = [
  [/chupet|chupa|bon ?bon bum|pop\b/i, 'chupetin'],
  [/chicle|trident|bubbaloo|clorets|adams|topline/i, 'chicle'],
  [/gomit|mogul|frugel|ositos|trolli/i, 'gomita'],
  [/marshmallow|chiquit/i, 'marshmallow'],
  [/halls|mentitas|caramelo.*tira/i, 'caramelo-tira'],
  [/caramelo|toffee|sayon|sayón/i, 'caramelo'],
  [/lenteja|m&m/i, 'lentejas'],
  [/bomb[oó]n|beso de moza|chocoteja|bon o bon/i, 'bombon'],
  [/chocolate|sublime|tri[aá]ngulo|kitkat|snickers|milky|princesa|cofler/i, 'chocolate'],
  [/wafer|cua cua/i, 'wafer'],
  [/soda|ritz|club social|galleta de agua/i, 'galleta-paquete'],
  [/galleta|oreo|casino|morocha|cookie|alfajor/i, 'galleta'],
  [/pringles/i, 'tubo-papas'],
  [/canchita|pop ?corn/i, 'canchita'],
  [/man[ií]|habas|frutos secos|pasas/i, 'mani'],
  [/papa|lay'?s|doritos|cheetos|piqueo|chizito|chifle|tor-?tees|cuates|snack/i, 'papitas'],
  [/agua|bid[oó]n/i, 'agua'],
  [/energ|volt|red bull|monster|220v/i, 'energizante'],
  [/gatorade|sporade|powerade|electrolight/i, 'deportiva'],
  [/cerveza|pilsen|cristal|cusque|corona/i, 'cerveza'],
  [/pisco|ron|vodka|vino|an[ií]s|whisky|licor/i, 'licor'],
  [/yogurt|yogur/i, 'yogur'],
  [/leche/i, 'leche'],
  [/lata/i, 'lata'],
  [/frugos|n[eé]ctar|pulp|jugo|chicha/i, 'jugo'],
  [/gaseosa|cola|kola|inca|sprite|fanta|seven|guaran|pepsi|concordia|crush|cifrut|tampico/i, 'gaseosa'],
  [/helado|peziduri|chupete/i, 'helado'],
  [/keke|panet[oó]n|ping[uü]ino|gansito|brownie/i, 'keke'],
  [/\bpan\b|bimbo/i, 'pan'],
];

/** Ilustración por defecto de cada categoría base (las categorías nuevas traen la suya desde el servidor). */
const CATEGORY_ART: Record<string, string> = {
  Caramelos: 'caramelo', Chupetines: 'chupetin', Chicles: 'chicle', 'Gomitas y marshmallows': 'gomita',
  Golosinas: 'caramelo', Chocolates: 'chocolate', Galletas: 'galleta', Wafers: 'wafer', Snacks: 'papitas',
  'Frutos secos': 'mani', Gaseosas: 'gaseosa', Aguas: 'agua', 'Jugos y néctares': 'jugo', Energizantes: 'energizante',
  Rehidratantes: 'deportiva', Bebidas: 'gaseosa', 'Lácteos y yogures': 'yogur', 'Kekes y panes': 'keke',
  Helados: 'helado', Cervezas: 'cerveza', Licores: 'licor',
};

export const ART_KEYS = Object.keys(ART);

/** Decide qué ilustración usa un producto. */
export function resolveArt(p: { imageUrl?: string | null; name: string; category: string }, categoryArt?: string): string {
  if (p.imageUrl?.startsWith('art:')) {
    const key = p.imageUrl.slice(4);
    if (ART[key]) return key;
  }
  const byName = KEYWORDS.find(([re]) => re.test(p.name))?.[1];
  return byName ?? categoryArt ?? CATEGORY_ART[p.category] ?? 'caja';
}

/** Ilustración del producto en el color de su marca. */
export const ProductArt: React.FC<{ art: string; color?: string; className?: string; title?: string }> = ({ art, color = '#9aa8a3', className = 'h-16 w-16', title }) => (
  <svg viewBox="0 0 100 100" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
    {(ART[art] ?? ART.caja)(color)}
  </svg>
);
