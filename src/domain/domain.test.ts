import { describe, expect, it } from 'vitest';
import { buildCartItem, computeCartTotals, refreshCartWithCatalog } from './cart';
import { checkCredit, initialStatus, orderExposure } from './credit';
import { parseAmount, round2 } from './money';
import { generateOrderCode, isValidOrderCode } from './orderCode';
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
