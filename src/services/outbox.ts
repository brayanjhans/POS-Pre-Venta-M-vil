/**
 * Cola de operaciones pendientes (patrón "outbox") para trabajar sin internet.
 *
 * Cuando el vendedor emite o anula un ticket, la operación se guarda primero en el
 * celular y luego se envía al servidor en orden. Cada pedido lleva un UUID generado
 * en el celular, así que reenviar la misma operación nunca lo duplica (el servidor
 * es idempotente). Si el servidor rechaza una operación por una regla de negocio
 * (ej. límite de crédito), queda marcada con error para que el vendedor decida.
 */
import type { Api, NewOrderPayload } from './api';
import { ApiError, isNetworkError } from './rpc';
import { generateOrderCode } from '../domain/orderCode';
import type { Order } from '../types/pos';

interface OpBase {
  opId: string;
  createdAt: string;
  attempts: number;
  /** Error de negocio devuelto por el servidor. La op queda en espera hasta reintentar o descartar. */
  error?: string;
}

export type OutboxOp =
  | (OpBase & { kind: 'create_order'; order: NewOrderPayload })
  | (OpBase & { kind: 'cancel_order'; orderId: string; reason: string });

export type NewOutboxOp =
  | { kind: 'create_order'; order: NewOrderPayload }
  | { kind: 'cancel_order'; orderId: string; reason: string };

export const makeOp = (op: NewOutboxOp): OutboxOp =>
  ({ ...op, opId: crypto.randomUUID(), createdAt: new Date().toISOString(), attempts: 0 }) as OutboxOp;

export interface FlushResult {
  remaining: OutboxOp[];
  synced: Order[];
  /** Se cortó por falta de red: reintentar más tarde. */
  offline: boolean;
  /** La sesión venció: hay que volver a iniciar sesión (la cola se conserva). */
  sessionExpired: boolean;
}

export async function flushOutbox(api: Api, ops: OutboxOp[]): Promise<FlushResult> {
  const remaining: OutboxOp[] = [];
  const synced: Order[] = [];
  let offline = false;
  let sessionExpired = false;

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (offline || sessionExpired || op.error) {
      remaining.push(op);
      continue;
    }
    try {
      synced.push(await sendOp(api, op));
    } catch (e) {
      if (isNetworkError(e)) {
        offline = true;
        remaining.push({ ...op, attempts: op.attempts + 1 });
      } else if (e instanceof ApiError && e.code === 'SESION_INVALIDA') {
        sessionExpired = true;
        remaining.push(op);
      } else {
        remaining.push({ ...op, attempts: op.attempts + 1, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }
  return { remaining, synced, offline, sessionExpired };
}

async function sendOp(api: Api, op: OutboxOp): Promise<Order> {
  if (op.kind === 'cancel_order') return api.cancelOrder(op.orderId, op.reason);
  try {
    return await api.createOrder(op.order);
  } catch (e) {
    // Choque de código (muy improbable): se reintenta una vez con otro código.
    if (e instanceof ApiError && e.code === 'CODIGO_DUPLICADO') {
      const prefix = op.order.code.split('-')[0];
      op.order = { ...op.order, code: generateOrderCode(prefix) };
      return api.createOrder(op.order);
    }
    throw e;
  }
}
