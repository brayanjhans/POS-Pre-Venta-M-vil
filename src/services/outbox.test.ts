import { describe, expect, it, vi } from 'vitest';
import { flushOutbox, makeOp } from './outbox';
import { ApiError } from './rpc';
import type { Api, NewOrderPayload } from './api';

const payload = (code: string): NewOrderPayload => ({
  id: crypto.randomUUID(), code, paymentTerm: 'Contado', discountPercent: 0, returnedContainers: 0,
  clientCreatedAt: new Date().toISOString(), items: [{ productId: 'p', presentationType: 'unit', quantity: 1 }],
});

const fakeApi = (impl: Partial<Api>) => impl as Api;

describe('flushOutbox', () => {
  it('envía en orden y vacía la cola', async () => {
    const sent: string[] = [];
    const api = fakeApi({
      createOrder: vi.fn(async (o: NewOrderPayload) => { sent.push(o.code); return { id: o.id } as never; }),
      cancelOrder: vi.fn(async (id: string) => { sent.push(`cancel:${id}`); return { id } as never; }),
    });
    const ops = [makeOp({ kind: 'create_order', order: payload('V01-AAAA1') }), makeOp({ kind: 'cancel_order', orderId: 'x', reason: 'r' })];
    const result = await flushOutbox(api, ops);
    expect(sent).toEqual(['V01-AAAA1', 'cancel:x']);
    expect(result.remaining).toHaveLength(0);
    expect(result.synced).toHaveLength(2);
  });

  it('sin internet se detiene y conserva todo para reintentar', async () => {
    const api = fakeApi({ createOrder: vi.fn(async () => { throw new ApiError('RED', 'sin red', true); }) });
    const ops = [makeOp({ kind: 'create_order', order: payload('V01-AAAA1') }), makeOp({ kind: 'create_order', order: payload('V01-AAAA2') })];
    const result = await flushOutbox(api, ops);
    expect(result.offline).toBe(true);
    expect(result.remaining).toHaveLength(2);
    expect(api.createOrder).toHaveBeenCalledTimes(1);
    expect(result.remaining.every(op => !op.error)).toBe(true);
  });

  it('un rechazo de negocio marca la operación y sigue con las demás', async () => {
    const api = fakeApi({
      createOrder: vi.fn(async (o: NewOrderPayload) => {
        if (o.code === 'V01-AAAA1') throw new ApiError('LIMITE_CREDITO', 'Límite superado');
        return { id: o.id } as never;
      }),
    });
    const ops = [makeOp({ kind: 'create_order', order: payload('V01-AAAA1') }), makeOp({ kind: 'create_order', order: payload('V01-AAAA2') })];
    const result = await flushOutbox(api, ops);
    expect(result.remaining).toHaveLength(1);
    expect(result.remaining[0].error).toBe('Límite superado');
    expect(result.synced).toHaveLength(1);
  });

  it('si el código de ticket choca, reintenta con otro código del mismo vendedor', async () => {
    let calls = 0;
    const api = fakeApi({
      createOrder: vi.fn(async (o: NewOrderPayload) => {
        calls++;
        if (calls === 1) throw new ApiError('CODIGO_DUPLICADO', 'dup');
        return { id: o.id, code: o.code } as never;
      }),
    });
    const result = await flushOutbox(api, [makeOp({ kind: 'create_order', order: payload('V01-AAAA1') })]);
    expect(result.remaining).toHaveLength(0);
    expect((result.synced[0] as { code: string }).code).toMatch(/^V01-/);
    expect((result.synced[0] as { code: string }).code).not.toBe('V01-AAAA1');
  });

  it('sesión vencida: conserva la cola sin marcar error', async () => {
    const api = fakeApi({ createOrder: vi.fn(async () => { throw new ApiError('SESION_INVALIDA', 'expiró'); }) });
    const result = await flushOutbox(api, [makeOp({ kind: 'create_order', order: payload('V01-AAAA1') })]);
    expect(result.sessionExpired).toBe(true);
    expect(result.remaining[0].error).toBeUndefined();
  });
});
