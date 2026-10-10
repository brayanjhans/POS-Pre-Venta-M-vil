import { describe, expect, it } from 'vitest';
import { buildCartItem, computeCartTotals, editedPrice, isValidUnitPrice, refreshCartWithCatalog } from './cart';
import { buildComboItems, parseComboEntry } from './combo';
import { checkCredit, initialStatus, orderExposure } from './credit';
import { parseAmount, round2 } from './money';
import { findSameName, formatPhone, isValidPhone, missingContact } from './customer';
import { stockAlerts, stockStatus } from './stock';
import { periodRange } from './period';
import { generateOrderCode, isValidOrderCode, looksLikeOrderCode } from './orderCode';
import type { Customer, Order, Product } from '../types/pos';

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1',
  barcode: '775000',
  name: 'Inka Kola 500ml',
  category: 'Bebidas',
  baseUnitName: 'botella',
  stockInBaseUnits: 100,
  minStockAlert: 10,
  accentColor: '#000',
  gradientBg: '',
  piecesPerPack: 12,
  presentations: {
    unit: { id: 'p1_unit', productId: 'p1', type: 'unit', label: 'Unidad', shortLabel: 'UND', conversionFactor: 1, price: 2.5 },
    pack: { id: 'p1_pack', productId: 'p1', type: 'pack', label: 'Paquete', shortLabel: 'PAQ', conversionFactor: 12, price: 25 },
  },
  ...overrides,
});

const customer = (overrides: Partial<Customer> = {}): Customer => ({
  id: 'c1', name: 'Bodega', docType: 'NINGUNO', creditLimit: 500, isActive: true, debt: 0, ...overrides,
});

describe('money', () => {
  it('redondea a céntimos sin errores de coma flotante', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);
    expect(round2(237.5 * 0.05)).toBe(11.88);
  });

  it('interpreta montos escritos por el usuario', () => {
    expect(parseAmount('12,50')).toBe(12.5);
    expect(parseAmount(' 7 ')).toBe(7);
    expect(parseAmount('-3')).toBeNaN();
    expect(parseAmount('1.234')).toBeNaN();
    expect(parseAmount('abc')).toBeNaN();
  });
});

describe('cart', () => {
  it('calcula totales igual que el servidor (descuento redondeado)', () => {
    const cart = [buildCartItem(product(), 'pack', 8), buildCartItem(product(), 'unit', 3)];
    const totals = computeCartTotals(cart, 5);
    expect(totals.gross).toBe(207.5);
    expect(totals.discount).toBe(10.38);
    expect(totals.total).toBe(197.12);
    expect(totals.baseUnits).toBe(8 * 12 + 3);
  });

  it('recalcula el carrito guardado con los precios vigentes y descarta productos eliminados', () => {
    const old = [buildCartItem(product(), 'unit', 4, 'line-1'), buildCartItem(product({ id: 'gone' }), 'unit', 1)];
    const updated = product({
      presentations: { ...product().presentations, unit: { ...product().presentations.unit, price: 3 } },
    });
    const refreshed = refreshCartWithCatalog(old, [updated]);
    expect(refreshed).toHaveLength(1);
    expect(refreshed[0].cartItemId).toBe('line-1');
    expect(refreshed[0].subtotal).toBe(12);
  });
});

describe('precio editable', () => {
  it('cobra el precio editado y recuerda el de lista', () => {
    const listPrice = product().presentations.pack!.price;
    const item = buildCartItem(product(), 'pack', 2, 'l1', listPrice + 1);
    expect(item.unitPrice).toBe(listPrice + 1);
    expect(item.listPrice).toBe(listPrice);
    expect(item.subtotal).toBe(round2((listPrice + 1) * 2));
    expect(editedPrice(item)).toBe(listPrice + 1);
    expect(editedPrice(buildCartItem(product(), 'pack', 2))).toBeUndefined();
  });

  it('ignora precios inválidos y usa el de lista', () => {
    for (const bad of [0, -5, Number.NaN, 1.234]) {
      expect(buildCartItem(product(), 'unit', 1, undefined, bad).unitPrice).toBe(product().presentations.unit.price);
    }
    expect(isValidUnitPrice(31)).toBe(true);
    expect(isValidUnitPrice(0.5)).toBe(true);
  });

  it('al refrescar con el catálogo conserva el precio editado', () => {
    const edited = buildCartItem(product(), 'unit', 4, 'line-1', 9.9);
    const updated = product({
      presentations: { ...product().presentations, unit: { ...product().presentations.unit, price: 3 } },
    });
    const [refreshed] = refreshCartWithCatalog([edited], [updated]);
    expect(refreshed.unitPrice).toBe(9.9);
    expect(refreshed.listPrice).toBe(3);
    expect(computeCartTotals([refreshed], 0).total).toBe(39.6);
  });
});

describe('credit', () => {
  const pendingFiado = (amount: number): Order => ({
    id: 'o', code: 'V01-AAAAA', qrPayload: 'V01-AAAAA', createdAt: '', sellerId: 's', sellerName: 'S',
    status: 'FIADO', paymentTerm: 'Fiado (Libreta)', items: [], totalAmount: amount, totalBaseUnits: 0,
    debtAmount: amount, customerId: 'c1', syncStatus: 'pending_sync',
  });

  it('bloquea si la deuda nueva supera el límite', () => {
    expect(checkCredit(customer({ debt: 440 }), 75, []).allowed).toBe(false);
    expect(checkCredit(customer({ debt: 440 }), 60, []).allowed).toBe(true);
  });

  it('suma los fiados emitidos sin internet que el servidor todavía no conoce', () => {
    const result = checkCredit(customer({ debt: 300 }), 100, [pendingFiado(150)]);
    expect(result.currentDebt).toBe(450);
    expect(result.allowed).toBe(false);
  });

  it('el crédito pendiente cuenta por el total; contado no cuenta', () => {
    expect(orderExposure({ status: 'PENDIENTE_PAGO', paymentTerm: 'Crédito 7 días', totalAmount: 80, debtAmount: 0 })).toBe(80);
    expect(orderExposure({ status: 'PAGADO', paymentTerm: 'Contado', totalAmount: 80, debtAmount: 0 })).toBe(0);
  });

  it('estado inicial según condición de pago', () => {
    expect(initialStatus('Contado')).toBe('PAGADO');
    expect(initialStatus('Fiado (Libreta)')).toBe('FIADO');
    expect(initialStatus('Crédito 15 días')).toBe('PENDIENTE_PAGO');
  });
});

describe('orderCode', () => {
  it('genera códigos válidos con el prefijo del vendedor y sin caracteres ambiguos', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateOrderCode('v01');
      expect(code).toMatch(/^V01-[2-9A-HJKMNP-TV-Z]{5}$/);
      expect(isValidOrderCode(code)).toBe(true);
    }
    expect(generateOrderCode(null)).toMatch(/^P-/);
  });
});

describe('celular del cliente', () => {
  it('acepta solo 9 dígitos que empiezan con 9', () => {
    expect(isValidPhone('987654321')).toBe(true);
    expect(isValidPhone('887654321')).toBe(false);
    expect(isValidPhone('98765432')).toBe(false);
    expect(isValidPhone('9876543210')).toBe(false);
    expect(isValidPhone('')).toBe(false);
  });

  it('formatea el celular para mostrar', () => {
    expect(formatPhone('987654321')).toBe('987 654 321');
    expect(formatPhone(null)).toBe('');
  });
});

describe('clientes con solo el nombre', () => {
  const list = [{ id: '1', name: 'José  Pérez' }, { id: '2', name: 'Bodega San Martín' }];

  it('detecta nombres repetidos sin importar mayúsculas, tildes ni espacios', () => {
    expect(findSameName(list, 'jose perez')).toHaveLength(1);
    expect(findSameName(list, ' BODEGA san martin ')).toHaveLength(1);
    expect(findSameName(list, 'Jose Perez Rojas')).toHaveLength(0);
    expect(findSameName(list, 'José Pérez', '1')).toHaveLength(0);
  });

  it('marca a quien le falta el celular', () => {
    expect(missingContact({ phone: null })).toBe(true);
    expect(missingContact({ phone: '987654321' })).toBe(false);
  });
});

describe('alertas de stock', () => {
  const p = (stock: number, min: number, isActive = true) => ({ ...product(), id: `${stock}-${min}`, stockInBaseUnits: stock, minStockAlert: min, isActive });

  it('clasifica agotado, por agotarse y normal', () => {
    expect(stockStatus(p(0, 10))).toBe('out');
    expect(stockStatus(p(-3, 10))).toBe('out');
    expect(stockStatus(p(10, 10))).toBe('low');
    expect(stockStatus(p(11, 10))).toBe('ok');
  });

  it('agrupa solo productos activos, los más urgentes primero', () => {
    const { out, low } = stockAlerts([p(5, 10), p(-2, 10), p(1, 10), p(50, 10), p(0, 10, false)]);
    expect(out.map(x => x.stockInBaseUnits)).toEqual([-2]);
    expect(low.map(x => x.stockInBaseUnits)).toEqual([1, 5]);
  });
});

describe('períodos de reporte', () => {
  const now = new Date(2026, 9, 9, 15, 0); // 9 oct 2026
  it('calcula los rangos', () => {
    expect(periodRange('today', now)).toEqual({ from: '2026-10-09', to: '2026-10-09' });
    expect(periodRange('week', now)).toEqual({ from: '2026-10-03', to: '2026-10-09' });
    expect(periodRange('month', now)).toEqual({ from: '2026-10-01', to: '2026-10-09' });
    expect(periodRange('lastMonth', now)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });
});

describe('código de ticket escaneado', () => {
  it('distingue el QR de un ticket de un código de barras de producto', () => {
    expect(looksLikeOrderCode('V01-7K3QM')).toBe(true);
    expect(looksLikeOrderCode('adm-sgvk3')).toBe(true);
    expect(looksLikeOrderCode('7750182002346')).toBe(false);
    expect(looksLikeOrderCode('V01-7K3')).toBe(false);
  });
});

describe('combos', () => {
  const promo = (barcodes: string[], offerPrice: number) => ({
    id: 'pr1', badgeText: '', tag: '', discountBadge: '', title: 'Combo', subtitle: '',
    originalPrice: 0, offerPrice, savingText: '', associatedBarcodes: barcodes,
  });
  const a = product();
  const b = { ...product(), id: 'p2', barcode: '222' };
  const find = (code: string) => (code === a.barcode ? { product: a, presentation: 'unit' as const } : code === '222' ? { product: b, presentation: 'unit' as const } : null);

  it('lee la cantidad del código', () => {
    expect(parseComboEntry('775 x 12')).toEqual({ barcode: '775', quantity: 12 });
    expect(parseComboEntry('775*3')).toEqual({ barcode: '775', quantity: 3 });
    expect(parseComboEntry('775')).toEqual({ barcode: '775', quantity: 1 });
  });

  it('cobra exactamente el precio de la oferta', () => {
    for (const [codes, offer] of [[[`${a.barcode} x 3`, '222'], 7.33], [[`${a.barcode} x 4`, '222 x 6'], 9.99], [[a.barcode, '222'], 62]] as const) {
      const r = buildComboItems(promo([...codes], offer), find, () => 0);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(computeCartTotals(r.items, 0).total).toBe(offer);
        expect(r.items.every(i => i.promoId === 'pr1')).toBe(true);
      }
    }
  });

  it('avisa si un código no existe', () => {
    expect(buildComboItems(promo(['999'], 5), find, () => 0).ok).toBe(false);
  });
});
