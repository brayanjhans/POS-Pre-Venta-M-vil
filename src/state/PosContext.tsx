import React from 'react';
import { createApi, publicApi, type Api, type LoginResult, type NewOrderPayload } from '../services/api';
import { ApiError, isNetworkError } from '../services/rpc';
import { KEYS, storage } from '../services/storage';
import { flushOutbox, makeOp, type OutboxOp } from '../services/outbox';
import { computeCartTotals, editedPrice } from '../domain/cart';
import { checkCredit, deductsStockOnCreate, initialStatus, requiresCustomer } from '../domain/credit';
import { generateOrderCode } from '../domain/orderCode';
import type { CartItem, Catalog, Customer, Order, PaymentTerm, Session, Shift, User } from '../types/pos';

const SYNC_INTERVAL_MS = 15_000;
const CATALOG_INTERVAL_MS = 120_000;

export interface NewOrderInput {
  cart: CartItem[];
  customer: Customer | null;
  /** Nombre libre para ventas al contado sin cliente registrado. */
  customerName?: string;
  paymentTerm: PaymentTerm;
  discountPercent: number;
  returnedContainers: number;
  replacesOrderId?: string | null;
}

interface PosContextValue {
  ready: boolean;
  online: boolean;
  syncing: boolean;
  session: Session | null;
  api: Api | null;
  catalog: Catalog | null;
  orders: Order[];
  outbox: OutboxOp[];
  login: (username: string, pin: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  setSessionUser: (user: User) => void;
  setOpenShift: (shift: Shift | null) => void;
  refreshCatalog: () => Promise<void>;
  refreshOrders: () => Promise<void>;
  syncNow: () => Promise<void>;
  createOrder: (input: NewOrderInput) => Promise<Order>;
  cancelOrder: (order: Order, reason: string) => Promise<void>;
  upsertOrder: (order: Order) => void;
  retryOp: (opId: string) => Promise<void>;
  discardOp: (opId: string) => Promise<void>;
  /** Traduce un error a mensaje para el usuario y cierra sesión si expiró. */
  handleError: (e: unknown) => string;
}

const PosContext = React.createContext<PosContextValue | null>(null);

export const usePos = (): PosContextValue => {
  const ctx = React.useContext(PosContext);
  if (!ctx) throw new Error('usePos debe usarse dentro de <PosProvider>');
  return ctx;
};

const deviceInfo = () => (typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : 'desconocido');

const daysAgoIso = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

/** Aplica al catálogo local el descuento de stock de un pedido aún no sincronizado. */
function applyLocalStock(catalog: Catalog, cart: CartItem[], sign: 1 | -1): Catalog {
  const delta = new Map<string, number>();
  for (const item of cart) delta.set(item.product.id, (delta.get(item.product.id) ?? 0) + item.deductedBaseUnits);
  return {
    ...catalog,
    products: catalog.products.map(p =>
      delta.has(p.id) ? { ...p, stockInBaseUnits: p.stockInBaseUnits + sign * delta.get(p.id)! } : p),
  };
}

export const PosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = React.useState(false);
  const [online, setOnline] = React.useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [syncing, setSyncing] = React.useState(false);
  const [session, setSession] = React.useState<Session | null>(null);
  const [catalog, setCatalog] = React.useState<Catalog | null>(null);
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [outbox, setOutbox] = React.useState<OutboxOp[]>([]);

  // Refs para usar siempre el valor vigente dentro de timers y callbacks asíncronos.
  const sessionRef = React.useRef(session);
  const outboxRef = React.useRef(outbox);
  const ordersRef = React.useRef(orders);
  const catalogRef = React.useRef(catalog);
  const syncingRef = React.useRef(false);
  sessionRef.current = session;
  outboxRef.current = outbox;
  ordersRef.current = orders;
  catalogRef.current = catalog;

  const api = React.useMemo(() => (session ? createApi(session.token) : null), [session?.token]);

  // ---------- persistencia ----------
  const persistSession = (s: Session | null) => (s ? storage.set(KEYS.session, s) : storage.remove(KEYS.session));

  const saveOutbox = React.useCallback(async (ops: OutboxOp[]) => {
    outboxRef.current = ops;
    setOutbox(ops);
    const userId = sessionRef.current?.user.id;
    if (userId) await storage.set(KEYS.outbox(userId), ops);
  }, []);

  const saveOrders = React.useCallback((updater: (prev: Order[]) => Order[]) => {
    const next = updater(ordersRef.current);
    ordersRef.current = next;
    setOrders(next);
    const userId = sessionRef.current?.user.id;
    if (userId) void storage.set(KEYS.orders(userId), next.slice(0, 300));
  }, []);

  const saveCatalog = React.useCallback((next: Catalog) => {
    catalogRef.current = next;
    setCatalog(next);
    void storage.set(KEYS.catalog, next);
  }, []);

  const clearSession = React.useCallback(async () => {
    setSession(null);
    sessionRef.current = null;
    setOrders([]);
    setOutbox([]);
    await persistSession(null);
  }, []);

  const handleError = React.useCallback((e: unknown): string => {
    if (isNetworkError(e)) setOnline(false);
    if (e instanceof ApiError && e.code === 'SESION_INVALIDA') void clearSession();
    return e instanceof Error ? e.message : 'Ocurrió un error inesperado.';
  }, [clearSession]);

  // ---------- carga de datos ----------
  const loadUserData = React.useCallback(async (userId: string) => {
    const [cachedOrders, cachedOutbox] = await Promise.all([
      storage.get<Order[]>(KEYS.orders(userId)),
      storage.get<OutboxOp[]>(KEYS.outbox(userId)),
    ]);
    ordersRef.current = cachedOrders ?? [];
    setOrders(ordersRef.current);
    outboxRef.current = cachedOutbox ?? [];
    setOutbox(outboxRef.current);
  }, []);

  const refreshCatalog = React.useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return;
    try {
      const fresh = await createApi(s.token).catalog(s.user.role === 'admin');
      setOnline(true);
      // Mantener el descuento optimista de pedidos que aún no llegaron al servidor.
      let next = fresh;
      for (const op of outboxRef.current) {
        if (op.kind !== 'create_order' || !deductsStockOnCreate(op.order.paymentTerm)) continue;
        const local = ordersRef.current.find(o => o.id === op.order.id);
        if (!local) continue;
        next = {
          ...next,
          products: next.products.map(p => {
            const units = local.items.filter(i => i.productId === p.id).reduce((a, i) => a + i.baseUnitsDeducted, 0);
            return units ? { ...p, stockInBaseUnits: p.stockInBaseUnits - units } : p;
          }),
        };
      }
      saveCatalog(next);
    } catch (e) {
      handleError(e);
    }
  }, [handleError, saveCatalog]);

  const refreshOrders = React.useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return;
    try {
      const since = daysAgoIso(s.user.role === 'vendedor' ? 2 : 7);
      const server = await createApi(s.token).listOrders({ since });
      setOnline(true);
      // Conservar los pedidos locales que todavía están en la cola.
      const pendingIds = new Set(outboxRef.current.flatMap(op => (op.kind === 'create_order' ? [op.order.id] : [])));
      const cancelIds = new Set(outboxRef.current.flatMap(op => (op.kind === 'cancel_order' ? [op.orderId] : [])));
      const local = ordersRef.current.filter(o => pendingIds.has(o.id));
      const merged = server.map(o => (cancelIds.has(o.id) ? ordersRef.current.find(l => l.id === o.id) ?? o : o));
      saveOrders(() => [...local, ...merged.filter(o => !pendingIds.has(o.id))]);
    } catch (e) {
      handleError(e);
    }
  }, [handleError, saveOrders]);

  // ---------- sincronización ----------
  const syncNow = React.useCallback(async () => {
    const s = sessionRef.current;
    if (!s || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      if (outboxRef.current.some(op => !op.error)) {
        const result = await flushOutbox(createApi(s.token), outboxRef.current);
        await saveOutbox(result.remaining);
        if (result.synced.length) {
          const byId = new Map(result.synced.map(o => [o.id, o]));
          saveOrders(prev => prev.map(o => byId.get(o.id) ?? o));
        }
        // Marcar en la lista los pedidos rechazados por el servidor.
        const failed = new Map(result.remaining.flatMap(op =>
          op.error && op.kind === 'create_order' ? [[op.order.id, op.error] as const] : []));
        if (failed.size) {
          saveOrders(prev => prev.map(o => (failed.has(o.id) ? { ...o, syncStatus: 'error', syncError: failed.get(o.id) } : o)));
        }
        if (result.offline) {
          setOnline(false);
          return;
        }
        if (result.sessionExpired) {
          await clearSession();
          return;
        }
      }
      await Promise.all([refreshOrders(), refreshCatalog()]);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [clearSession, refreshCatalog, refreshOrders, saveOrders, saveOutbox]);

  // ---------- arranque ----------
  React.useEffect(() => {
    (async () => {
      const [cachedSession, cachedCatalog] = await Promise.all([
        storage.get<Session>(KEYS.session),
        storage.get<Catalog>(KEYS.catalog),
      ]);
      if (cachedCatalog) {
        catalogRef.current = cachedCatalog;
        setCatalog(cachedCatalog);
      }
      if (cachedSession) {
        sessionRef.current = cachedSession;
        setSession(cachedSession);
        await loadUserData(cachedSession.user.id);
        try {
          const me = await createApi(cachedSession.token).me();
          const updated = { ...cachedSession, user: me.user, openShift: me.openShift };
          setSession(updated);
          sessionRef.current = updated;
          await persistSession(updated);
        } catch (e) {
          // Sin internet: se sigue con la sesión guardada y se valida al reconectar.
          if (e instanceof ApiError && e.code === 'SESION_INVALIDA') await clearSession();
          else if (isNetworkError(e)) setOnline(false);
        }
      }
      setReady(true);
    })();
  }, [clearSession, loadUserData]);

  // Al tener sesión: sincronizar y programar reintentos periódicos.
  React.useEffect(() => {
    if (!session?.token || session.user.mustChangePin) return;
    void syncNow();
    const syncTimer = setInterval(() => void syncNow(), SYNC_INTERVAL_MS);
    const catalogTimer = setInterval(() => void refreshCatalog(), CATALOG_INTERVAL_MS);
    return () => {
      clearInterval(syncTimer);
      clearInterval(catalogTimer);
    };
  }, [session?.token, session?.user.mustChangePin, syncNow, refreshCatalog]);

  React.useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      void syncNow();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [syncNow]);

  // ---------- sesión ----------
  const login = React.useCallback(async (username: string, pin: string): Promise<LoginResult> => {
    const result = await publicApi.login(username, pin, deviceInfo());
    setOnline(true);
    if (result.ok && result.token && result.user) {
      const s: Session = { token: result.token, user: result.user, openShift: result.openShift ?? null };
      sessionRef.current = s;
      setSession(s);
      await persistSession(s);
      await storage.set(KEYS.lastUsername, result.user.username);
      await loadUserData(result.user.id);
    }
    return result;
  }, [loadUserData]);

  const logout = React.useCallback(async () => {
    const s = sessionRef.current;
    if (s) {
      try {
        await createApi(s.token).logout();
      } catch {
        /* sin red: la sesión expira sola en el servidor */
      }
    }
    await clearSession();
  }, [clearSession]);

  const updateSession = React.useCallback((patch: Partial<Session>) => {
    const s = sessionRef.current;
    if (!s) return;
    const next = { ...s, ...patch };
    sessionRef.current = next;
    setSession(next);
    void persistSession(next);
  }, []);

  const setSessionUser = React.useCallback((user: User) => updateSession({ user }), [updateSession]);
  const setOpenShift = React.useCallback((openShift: Shift | null) => updateSession({ openShift }), [updateSession]);

  // ---------- pedidos ----------
  const createOrder = React.useCallback(async (input: NewOrderInput): Promise<Order> => {
    const s = sessionRef.current;
    if (!s) throw new Error('Sesión no iniciada.');
    if (input.cart.length === 0) throw new Error('El carrito está vacío.');
    if (requiresCustomer(input.paymentTerm) && !input.customer) {
      throw new Error('Para fiar o dar crédito seleccione un cliente registrado.');
    }

    const totals = computeCartTotals(input.cart, input.discountPercent);
    if (input.customer && requiresCustomer(input.paymentTerm)) {
      const credit = checkCredit(input.customer, totals.total, ordersRef.current);
      if (!credit.allowed) {
        throw new Error(
          `Límite de crédito superado: ${input.customer.name} debe S/ ${credit.currentDebt.toFixed(2)} y llegaría a ` +
          `S/ ${credit.newTotal.toFixed(2)}. Tope: S/ ${credit.limit.toFixed(2)}.`);
      }
    }

    const payload: NewOrderPayload = {
      id: crypto.randomUUID(),
      code: generateOrderCode(s.user.sellerCode ?? (s.user.role === 'admin' ? 'ADM' : 'P')),
      customerId: input.customer?.id ?? null,
      customerName: input.customer?.name ?? (input.customerName?.trim() || null),
      paymentTerm: input.paymentTerm,
      discountPercent: input.discountPercent,
      returnedContainers: input.returnedContainers,
      clientCreatedAt: new Date().toISOString(),
      shiftId: s.openShift?.id ?? null,
      replacesOrderId: input.replacesOrderId ?? null,
      items: input.cart.map(i => ({
        productId: i.product.id,
        presentationType: i.selectedPresentation,
        quantity: i.quantity,
        unitPrice: editedPrice(i),
      })),
    };

    const status = initialStatus(input.paymentTerm);
    const localOrder: Order = {
      id: payload.id,
      code: payload.code,
      qrPayload: payload.code,
      createdAt: payload.clientCreatedAt,
      sellerId: s.user.id,
      sellerName: s.user.fullName,
      shiftId: payload.shiftId,
      customerId: payload.customerId,
      customerName: payload.customerName,
      customerRuc: input.customer?.docNumber ?? null,
      paymentTerm: input.paymentTerm,
      status,
      grossAmount: totals.gross,
      discountPercent: input.discountPercent,
      discountAmount: totals.discount,
      totalAmount: totals.total,
      totalBaseUnits: totals.baseUnits,
      paidAmount: status === 'PAGADO' ? totals.total : 0,
      debtAmount: status === 'FIADO' ? totals.total : 0,
      returnedContainers: input.returnedContainers,
      replacesOrderId: payload.replacesOrderId,
      syncStatus: 'pending_sync',
      items: input.cart.map(i => ({
        productId: i.product.id,
        productName: i.product.name,
        presentationType: i.selectedPresentation,
        presentationLabel: i.product.presentations[i.selectedPresentation]!.label,
        conversionFactor: i.product.presentations[i.selectedPresentation]!.conversionFactor,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        subtotal: i.subtotal,
        baseUnitsDeducted: i.deductedBaseUnits,
      })),
    };

    await saveOutbox([...outboxRef.current, makeOp({ kind: 'create_order', order: payload })]);
    saveOrders(prev => [localOrder, ...prev]);
    if (catalogRef.current && deductsStockOnCreate(input.paymentTerm)) {
      saveCatalog(applyLocalStock(catalogRef.current, input.cart, -1));
    }
    void syncNow();
    return localOrder;
  }, [saveCatalog, saveOrders, saveOutbox, syncNow]);

  const cancelOrder = React.useCallback(async (order: Order, reason: string) => {
    const pendingCreate = outboxRef.current.find(op => op.kind === 'create_order' && op.order.id === order.id);
    if (pendingCreate) {
      // Nunca llegó al servidor: basta con sacarlo de la cola y revertir el stock local.
      await saveOutbox(outboxRef.current.filter(op => op !== pendingCreate));
      saveOrders(prev => prev.filter(o => o.id !== order.id));
      if (catalogRef.current && order.paymentTerm && deductsStockOnCreate(order.paymentTerm)) {
        const products = catalogRef.current.products;
        saveCatalog({
          ...catalogRef.current,
          products: products.map(p => {
            const units = order.items.filter(i => i.productId === p.id).reduce((a, i) => a + i.baseUnitsDeducted, 0);
            return units ? { ...p, stockInBaseUnits: p.stockInBaseUnits + units } : p;
          }),
        });
      }
      return;
    }
    await saveOutbox([...outboxRef.current, makeOp({ kind: 'cancel_order', orderId: order.id, reason })]);
    saveOrders(prev => prev.map(o => (o.id === order.id ? { ...o, status: 'CANCELADO', syncStatus: 'pending_sync' } : o)));
    void syncNow();
  }, [saveCatalog, saveOrders, saveOutbox, syncNow]);

  const upsertOrder = React.useCallback((order: Order) => {
    saveOrders(prev => (prev.some(o => o.id === order.id) ? prev.map(o => (o.id === order.id ? order : o)) : [order, ...prev]));
  }, [saveOrders]);

  const retryOp = React.useCallback(async (opId: string) => {
    await saveOutbox(outboxRef.current.map(op => (op.opId === opId ? { ...op, error: undefined } : op)));
    await syncNow();
  }, [saveOutbox, syncNow]);

  const discardOp = React.useCallback(async (opId: string) => {
    const op = outboxRef.current.find(o => o.opId === opId);
    if (!op) return;
    await saveOutbox(outboxRef.current.filter(o => o.opId !== opId));
    if (op.kind === 'create_order') saveOrders(prev => prev.filter(o => o.id !== op.order.id));
    await refreshCatalog();
    await refreshOrders();
  }, [refreshCatalog, refreshOrders, saveOrders, saveOutbox]);

  const value: PosContextValue = {
    ready, online, syncing, session, api, catalog, orders, outbox,
    login, logout, setSessionUser, setOpenShift, refreshCatalog, refreshOrders, syncNow,
    createOrder, cancelOrder, upsertOrder, retryOp, discardOp, handleError,
  };

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
};
