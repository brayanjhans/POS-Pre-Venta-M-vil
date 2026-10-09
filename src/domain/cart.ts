import type { CartItem, PresentationType, Product } from '../types/pos';
import { round2 } from './money';

export interface CartTotals {
  gross: number;
  discount: number;
  total: number;
  baseUnits: number;
}

/** Mismo cálculo que pos_order_create: subtotal por línea redondeado, descuento redondeado. */
export function computeCartTotals(cart: CartItem[], discountPercent: number): CartTotals {
  const gross = round2(cart.reduce((acc, item) => acc + round2(item.unitPrice * item.quantity), 0));
  const discount = round2((gross * discountPercent) / 100);
  return {
    gross,
    discount,
    total: round2(gross - discount),
    baseUnits: cart.reduce((acc, item) => acc + item.deductedBaseUnits, 0),
  };
}

export function buildCartItem(product: Product, presentation: PresentationType, quantity: number, cartItemId?: string): CartItem {
  const pres = product.presentations[presentation] ?? product.presentations.unit;
  return {
    cartItemId: cartItemId ?? crypto.randomUUID(),
    product,
    selectedPresentation: pres.type,
    quantity,
    unitPrice: pres.price,
    subtotal: round2(quantity * pres.price),
    deductedBaseUnits: quantity * pres.conversionFactor,
  };
}

/**
 * El carrito guardado puede tener precios viejos. Se vuelve a armar con el catálogo
 * vigente; las líneas de productos que ya no existen se descartan.
 */
export function refreshCartWithCatalog(cart: CartItem[], products: Product[]): CartItem[] {
  const byId = new Map(products.map(p => [p.id, p]));
  const result: CartItem[] = [];
  for (const item of cart) {
    const product = byId.get(item.product.id);
    if (!product || !product.presentations[item.selectedPresentation]) continue;
    result.push(buildCartItem(product, item.selectedPresentation, item.quantity, item.cartItemId));
  }
  return result;
}
