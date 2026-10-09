import type { Product } from '../types/pos';

export type StockStatus = 'out' | 'low' | 'ok';

/** Agotado: sin stock (o negativo, vendido sin stock). Por agotarse: igual o menos que el mínimo. */
export const stockStatus = (p: Pick<Product, 'stockInBaseUnits' | 'minStockAlert'>): StockStatus =>
  p.stockInBaseUnits <= 0 ? 'out' : p.stockInBaseUnits <= p.minStockAlert ? 'low' : 'ok';

/** Productos activos agrupados por estado de stock, los más urgentes primero. */
export function stockAlerts(products: Product[]): { out: Product[]; low: Product[] } {
  const active = products.filter(p => p.isActive !== false);
  const byStock = (a: Product, b: Product) => a.stockInBaseUnits - b.stockInBaseUnits;
  return {
    out: active.filter(p => stockStatus(p) === 'out').sort(byStock),
    low: active.filter(p => stockStatus(p) === 'low').sort((a, b) => a.stockInBaseUnits / Math.max(a.minStockAlert, 1) - b.stockInBaseUnits / Math.max(b.minStockAlert, 1)),
  };
}
