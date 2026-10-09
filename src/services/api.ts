import { rpc } from './rpc';
import type {
  Catalog, Customer, CustomerStatement, Dashboard, DebtorSummary, LoginUser, Order, PaymentMethod,
  PaymentTerm, PresentationType, Product, PromoBanner, Shift, StoreSettings, User, UserRole,
} from '../types/pos';

export interface LoginResult {
  ok: boolean;
  error?: string;
  message?: string;
  token?: string;
  user?: User;
  openShift?: Shift | null;
}

/** Lo que el celular envía para crear un pedido. Los precios los pone el servidor. */
export interface NewOrderPayload {
  id: string;
  code: string;
  customerId?: string | null;
  customerName?: string | null;
  paymentTerm: PaymentTerm;
  discountPercent: number;
  returnedContainers: number;
  notes?: string | null;
  clientCreatedAt: string;
  shiftId?: string | null;
  replacesOrderId?: string | null;
  /** unitPrice solo viaja si el vendedor editó el precio; si no, el servidor usa el de catálogo. */
  items: { productId: string; presentationType: PresentationType; quantity: number; unitPrice?: number }[];
}

export interface CheckoutResult extends Order {
  change: number;
}

export interface AbonoResult {
  groupId: string;
  applied: { orderId: string; orderCode: string; amount: number; remaining: number }[];
  remainingDebt: number;
}

export interface NewUserPayload {
  username: string;
  fullName: string;
  role: UserRole;
  pin: string;
  sellerCode?: string;
  mustChangePin?: boolean;
}

export type UserPatch = Partial<{
  fullName: string;
  role: UserRole;
  isActive: boolean;
  sellerCode: string;
  pin: string;
  unlock: boolean;
}>;

/** Funciones públicas (sin sesión). */
export const publicApi = {
  loginUsers: () => rpc<LoginUser[]>('pos_login_users'),
  login: (username: string, pin: string, device: string) =>
    rpc<LoginResult>('pos_login', { p_username: username, p_pin: pin, p_device: device }),
};

/** Funciones que requieren el token de sesión. */
export function createApi(token: string) {
  const t = { p_token: token };
  return {
    logout: () => rpc<void>('pos_logout', t),
    me: () => rpc<{ user: User; openShift: Shift | null }>('pos_me', t),
    changePin: (currentPin: string, newPin: string) =>
      rpc<User>('pos_change_pin', { ...t, p_current_pin: currentPin, p_new_pin: newPin }),

    catalog: (includeInactive = false) => rpc<Catalog>('pos_catalog', { ...t, p_include_inactive: includeInactive }),
    saveProduct: (product: Partial<Product>) => rpc<Product>('pos_product_save', { ...t, p_product: product }),
    deleteProduct: (productId: string) =>
      rpc<{ deleted: boolean; deactivated: boolean }>('pos_product_delete', { ...t, p_product_id: productId }),
    setProductActive: (productId: string, active: boolean) =>
      rpc<Product>('pos_product_set_active', { ...t, p_product_id: productId, p_active: active }),
    restockProduct: (args: {
      productId: string; presentation: PresentationType; quantity: number;
      unitCost?: number | null; expiration?: string | null; unitPrice?: number | null;
    }) => rpc<Product>('pos_product_restock', {
      ...t, p_product_id: args.productId, p_presentation: args.presentation, p_quantity: args.quantity,
      p_unit_cost: args.unitCost ?? null, p_expiration: args.expiration || null, p_unit_price: args.unitPrice ?? null,
    }),
    regularizeStock: (productId: string, externalCost: number) =>
      rpc<Product>('pos_stock_regularize', { ...t, p_product_id: productId, p_external_cost: externalCost }),
    savePromo: (promo: Partial<PromoBanner>) => rpc<PromoBanner>('pos_promo_save', { ...t, p_promo: promo }),
    deletePromo: (promoId: string) => rpc<void>('pos_promo_delete', { ...t, p_promo_id: promoId }),

    saveCustomer: (customer: Partial<Customer>) => rpc<Customer>('pos_customer_save', { ...t, p_customer: customer }),
    debts: () => rpc<DebtorSummary[]>('pos_debts_list', t),
    customerStatement: (customerId: string) =>
      rpc<CustomerStatement>('pos_customer_statement', { ...t, p_customer_id: customerId }),
    registerAbono: (args: { customerId: string; amount: number; method: PaymentMethod; orderId?: string | null; notes?: string }) =>
      rpc<AbonoResult>('pos_abono_register', {
        ...t, p_customer_id: args.customerId, p_amount: args.amount, p_method: args.method,
        p_order_id: args.orderId ?? null, p_notes: args.notes ?? null,
      }),

    users: () => rpc<User[]>('pos_users_list', t),
    createUser: (user: NewUserPayload) => rpc<User>('pos_user_create', { ...t, p_user: user }),
    updateUser: (userId: string, patch: UserPatch) =>
      rpc<User>('pos_user_update', { ...t, p_user_id: userId, p_patch: patch }),

    currentShift: () => rpc<Shift | null>('pos_shift_current', t),
    openShift: (openingCash: number) => rpc<Shift>('pos_shift_open', { ...t, p_opening_cash: openingCash }),
    closeShift: (countedCash: number, notes?: string) =>
      rpc<Shift>('pos_shift_close', { ...t, p_counted_cash: countedCash, p_notes: notes ?? null }),

    createOrder: (order: NewOrderPayload) => rpc<Order>('pos_order_create', { ...t, p_order: order }),
    getOrder: (code: string) => rpc<Order>('pos_order_get', { ...t, p_code: code }),
    listOrders: (args: { statuses?: string[]; since?: string; limit?: number } = {}) =>
      rpc<Order[]>('pos_orders_list', {
        ...t, p_statuses: args.statuses ?? null, p_since: args.since ?? null, p_limit: args.limit ?? 300,
      }),
    checkout: (orderId: string, payments: { method: PaymentMethod; amount: number }[], asFiado: boolean) =>
      rpc<CheckoutResult>('pos_order_checkout', { ...t, p_order_id: orderId, p_payments: payments, p_as_fiado: asFiado }),
    cancelOrder: (orderId: string, reason: string) =>
      rpc<Order>('pos_order_cancel', { ...t, p_order_id: orderId, p_reason: reason }),

    dashboard: () => rpc<Dashboard>('pos_dashboard', t),
    saveSettings: (settings: StoreSettings) => rpc<StoreSettings>('pos_settings_save', { ...t, p_settings: settings }),
  };
}

export type Api = ReturnType<typeof createApi>;
