import type { CartItem, PresentationType, Product, PromoBanner } from '../types/pos';
import { buildCartItem } from './cart';
import { round2 } from './money';

export interface ComboEntry {
  barcode: string;
  quantity: number;
}

/**
 * Lee un código del combo. Acepta "7750182002346" (1 unidad) o "7750182002346 x 12"
 * (también "*12" o "×12") para indicar la cantidad de esa presentación.
 */
export function parseComboEntry(raw: string): ComboEntry | null {
  const text = raw.trim();
  if (!text) return null;
  const m = text.match(/^(.+?)\s*[x*×]\s*(\d{1,4})$/i);
  if (m) {
    const quantity = Number(m[2]);
    return quantity > 0 ? { barcode: m[1].trim(), quantity } : null;
  }
  return { barcode: text, quantity: 1 };
}

export type ComboResult =
  | { ok: true; items: CartItem[] }
  | { ok: false; error: string };

type Finder = (barcode: string) => { product: Product; presentation: PresentationType } | null;

/**
 * Arma las líneas del carrito de un combo cobrando exactamente su precio de oferta:
 * el precio se reparte entre los productos según su precio de lista y los centavos
 * que sobran por redondeo van a una línea de 1 unidad.
 */
export function buildComboItems(promo: PromoBanner, find: Finder, reservedBaseUnits: (productId: string) => number): ComboResult {
  // Juntar códigos repetidos ("A, A" = 2 de A).
  const merged = new Map<string, { product: Product; presentation: PresentationType; quantity: number }>();
  for (const raw of promo.associatedBarcodes) {
    const entry = parseComboEntry(raw);
    if (!entry) continue;
    const found = find(entry.barcode);
    if (!found) return { ok: false, error: `El combo tiene un código no registrado: ${entry.barcode}` };
    const key = `${found.product.id}:${found.presentation}`;
    const prev = merged.get(key);
    merged.set(key, { ...found, quantity: (prev?.quantity ?? 0) + entry.quantity });
  }
  const lines = [...merged.values()];
  if (!lines.length) return { ok: false, error: 'Este combo no tiene productos.' };

  // Stock: lo que ya está en el carrito más lo del combo.
  const need = new Map<string, number>();
  for (const l of lines) {
    const factor = l.product.presentations[l.presentation]!.conversionFactor;
    need.set(l.product.id, (need.get(l.product.id) ?? 0) + l.quantity * factor);
  }
  for (const l of lines) {
    const total = (need.get(l.product.id) ?? 0) + reservedBaseUnits(l.product.id);
    if (total > l.product.stockInBaseUnits) return { ok: false, error: `No hay stock suficiente de ${l.product.name} para el combo.` };
  }

  const offer = round2(promo.offerPrice);
  const listTotal = lines.reduce((acc, l) => acc + l.quantity * l.product.presentations[l.presentation]!.price, 0);
  if (!(offer > 0) || !(listTotal > 0)) return { ok: false, error: 'El precio del combo no es válido.' };

  const ratio = offer / listTotal;
  const priced = lines.map(l => ({ ...l, unitPrice: Math.max(0.01, round2(l.product.presentations[l.presentation]!.price * ratio)) }));
  let diff = round2(offer - priced.reduce((acc, l) => acc + round2(l.unitPrice * l.quantity), 0));

  if (diff !== 0) {
    // Los centavos de diferencia van a una línea de 1 unidad; si no hay, se separa una unidad.
    let target = priced.find(l => l.quantity === 1 && l.unitPrice + diff > 0);
    if (!target) {
      const big = [...priced].sort((a, b) => b.unitPrice - a.unitPrice)[0];
      if (big.unitPrice + diff > 0) {
        big.quantity -= 1;
        target = { ...big, quantity: 1 };
        priced.push(target);
      }
    }
    if (target) {
      target.unitPrice = round2(target.unitPrice + diff);
      diff = 0;
    }
  }

  const items = priced
    .filter(l => l.quantity > 0)
    .map(l => ({ ...buildCartItem(l.product, l.presentation, l.quantity, undefined, l.unitPrice), promoId: promo.id, promoTitle: promo.title }));
  return { ok: true, items };
}
