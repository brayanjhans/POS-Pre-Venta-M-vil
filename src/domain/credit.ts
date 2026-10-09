import type { Customer, Order, PaymentTerm } from '../types/pos';
import { round2 } from './money';

export interface CreditCheck {
  allowed: boolean;
  currentDebt: number;
  newTotal: number;
  limit: number;
}

/** Deuda que suma un pedido al cliente (misma regla que pos._customer_exposure). */
export function orderExposure(order: Pick<Order, 'status' | 'paymentTerm' | 'debtAmount' | 'totalAmount'>): number {
  if (order.status === 'FIADO') return order.debtAmount ?? 0;
  if (order.status === 'PENDIENTE_PAGO' && order.paymentTerm && order.paymentTerm !== 'Contado') return order.totalAmount;
  return 0;
}

/**
 * Verificación previa en el celular (también sin internet). El servidor vuelve a validar.
 * customer.debt viene del último catálogo sincronizado; unsyncedOrders son los pedidos
 * de este celular que aún no llegaron al servidor.
 */
export function checkCredit(customer: Customer, amount: number, unsyncedOrders: Order[]): CreditCheck {
  const local = unsyncedOrders
    .filter(o => o.customerId === customer.id && o.syncStatus !== 'synced')
    .reduce((acc, o) => acc + orderExposure(o), 0);
  const currentDebt = round2((customer.debt ?? 0) + local);
  const newTotal = round2(currentDebt + amount);
  return { allowed: newTotal <= customer.creditLimit, currentDebt, newTotal, limit: customer.creditLimit };
}

export const requiresCustomer = (term: PaymentTerm): boolean => term !== 'Contado';

/** Estado inicial del pedido según la condición de pago (misma regla que el servidor). */
export function initialStatus(term: PaymentTerm): Order['status'] {
  if (term === 'Contado') return 'PAGADO';
  if (term === 'Fiado (Libreta)') return 'FIADO';
  return 'PENDIENTE_PAGO';
}

/** ¿El pedido descuenta stock al crearse? (Contado y Fiado sí; Crédito al cobrar en caja). */
export const deductsStockOnCreate = (term: PaymentTerm): boolean => term === 'Contado' || term === 'Fiado (Libreta)';
