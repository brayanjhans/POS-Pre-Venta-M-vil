/**
 * Definiciones de Tipos para Sistema de Pre-Venta POS
 * Especializado en Golosinas y Bebidas con Multi-Presentación y Factor de Conversión.
 * Las formas coinciden con el JSON que devuelven las funciones pos_* de Supabase.
 */

export type PresentationType = 'unit' | 'quarter' | 'half' | 'pack';

export type ProductCategory = 'Golosinas' | 'Bebidas' | 'Chocolates' | 'Snacks' | 'Galletas' | 'Licores';

export const PRODUCT_CATEGORIES: ProductCategory[] = ['Bebidas', 'Chocolates', 'Galletas', 'Golosinas', 'Snacks', 'Licores'];

export interface ProductPresentation {
  id: string;
  productId: string;
  type: PresentationType;
  label: string; // "Unidad", "Medio Paquete (12 unid)", "Paquete (24 unid)"
  shortLabel: string; // "UND", "MED", "PAQ"
  conversionFactor: number; // Factor hacia la unidad mínima base (Ej: 1, 6, 12, 24)
  price: number; // Precio de venta específico e independiente
  barcode?: string | null; // Código de barras específico si el paquete tiene uno propio
  cost?: number | null; // Costo referencial para cálculo de margen
  isDefault?: boolean; // Por defecto al escanear (true para 'unit')
}

export type PackagingType = 'Botella Pet' | 'Display Caja' | 'Bolsa Sellada' | 'Fardo Termocontraíble' | 'Lata' | 'Tira Colgante';

export interface Product {
  id: string;
  barcode: string; // Código de barras principal (usualmente el de la unidad)
  name: string;
  category: ProductCategory;
  baseUnitName: string; // "unidad", "botella", "lata", "sobre"
  stockInBaseUnits: number; // Stock total expresado en unidades mínimas (puede ser negativo)
  minStockAlert: number;
  expirationDate?: string | null; // Fecha de vencimiento (YYYY-MM-DD)
  imageUrl?: string | null;
  isActive?: boolean;
  isPromo?: boolean;
  promoTag?: string | null;
  packagingType?: PackagingType | string | null;
  flavorNote?: string | null;
  accentColor: string;
  gradientBg: string;
  piecesPerPack: number;
  presentations: Partial<Record<PresentationType, ProductPresentation>> & { unit: ProductPresentation };
}

export interface CartItem {
  cartItemId: string; // UUID único para la línea del carrito
  product: Product;
  selectedPresentation: PresentationType;
  quantity: number; // Cantidad de esa presentación
  unitPrice: number; // Precio unitario cobrado (el de catálogo o el editado en la venta)
  listPrice: number; // Precio de catálogo de la presentación, para saber si se editó
  subtotal: number; // quantity * unitPrice
  deductedBaseUnits: number; // quantity * presentation.conversionFactor
}

export type OrderStatus = 'PENDIENTE_PAGO' | 'PAGADO' | 'CANCELADO' | 'FIADO';

export type PaymentTerm = 'Contado' | 'Fiado (Libreta)' | 'Crédito 7 días' | 'Crédito 15 días';

export const PAYMENT_TERMS: PaymentTerm[] = ['Contado', 'Fiado (Libreta)', 'Crédito 7 días', 'Crédito 15 días'];

export type PaymentMethod = 'Efectivo' | 'Yape' | 'Plin' | 'Tarjeta' | 'Transferencia';

export const PAYMENT_METHODS: PaymentMethod[] = ['Efectivo', 'Yape', 'Plin', 'Tarjeta', 'Transferencia'];

export interface OrderItemRecord {
  productId: string;
  productName: string;
  presentationType: PresentationType;
  presentationLabel: string;
  conversionFactor: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  baseUnitsDeducted: number;
}

export type SyncStatus = 'synced' | 'pending_sync' | 'error';

export interface Order {
  id: string; // UUID generado en el celular
  code: string; // Código corto del ticket / QR. Ej: "V01-7K3QM"
  createdAt: string;
  sellerId: string;
  sellerName: string;
  shiftId?: string | null;
  status: OrderStatus;
  items: OrderItemRecord[];
  grossAmount?: number;
  totalAmount: number;
  totalBaseUnits: number;
  customerId?: string | null;
  customerName?: string | null;
  customerRuc?: string | null;
  paymentTerm?: PaymentTerm;
  discountPercent?: number;
  discountAmount?: number;
  notes?: string | null;
  syncStatus: SyncStatus;
  syncError?: string;
  qrPayload: string; // String codificado en el QR (= code)
  paidAt?: string | null;
  paymentMethod?: string | null;
  paidAmount?: number;
  debtAmount?: number;
  returnedContainers?: number;
  settledByName?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  replacesOrderId?: string | null;
}

export interface PromoBanner {
  id: string;
  badgeText: string;
  tag: string;
  discountBadge: string;
  title: string;
  subtitle: string;
  originalPrice: number;
  offerPrice: number;
  savingText: string;
  associatedBarcodes: string[]; // Barcodes of the products to add to cart when "AÑADIR COMBO" is clicked
  isActive?: boolean;
}

export type DocType = 'DNI' | 'RUC' | 'OTRO' | 'NINGUNO';

export interface Customer {
  id: string;
  name: string;
  docType: DocType;
  docNumber?: string | null;
  route?: string | null;
  phone?: string | null;
  address?: string | null;
  creditLimit: number; // límite efectivo (propio o por defecto)
  customCreditLimit?: number | null; // null = usa el límite por defecto
  isActive: boolean;
  debt: number; // fiados con saldo + créditos aún no cobrados
}

export interface DebtorSummary extends Customer {
  fiadoDebt: number;
  openOrders: number;
  oldestDebtAt: string;
}

export interface CustomerPayment {
  id: string;
  orderId: string;
  orderCode: string;
  kind: 'VENTA' | 'ABONO' | 'DEVOLUCION';
  method: PaymentMethod;
  amount: number;
  groupId?: string | null;
  receivedBy: string;
  notes?: string | null;
  createdAt: string;
}

export interface CustomerStatement {
  customer: Customer;
  orders: Order[];
  payments: CustomerPayment[];
}

export type UserRole = 'admin' | 'vendedor' | 'cajero';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  vendedor: 'Vendedor',
  cajero: 'Cajero(a)',
};

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  sellerCode?: string | null;
  isActive: boolean;
  mustChangePin: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
  lockedUntil?: string | null;
}

export interface LoginUser {
  username: string;
  fullName: string;
  role: UserRole;
}

export interface Shift {
  id: string;
  userId: string;
  userName: string;
  openedAt: string;
  openingCash: number;
  closedAt?: string | null;
  expectedCash?: number | null;
  countedCash?: number | null;
  difference?: number | null;
  notes?: string | null;
  byMethod: Partial<Record<PaymentMethod, number>>;
  byKind: Partial<Record<'VENTA' | 'ABONO' | 'DEVOLUCION', number>>;
  ordersCreated: number;
  expectedCashNow: number;
}

export interface Session {
  token: string;
  user: User;
  openShift: Shift | null;
}

export interface StoreSettings {
  store_name?: string;
  store_ruc?: string;
  store_address?: string;
  default_credit_limit?: number;
  max_discount_percent?: number;
  session_hours?: number;
}

export interface Catalog {
  serverTime: string;
  products: Product[];
  promos: PromoBanner[];
  customers: Customer[];
  settings: StoreSettings;
}

export interface Dashboard {
  salesToday: number;
  ordersToday: number;
  collectedToday: number;
  salesYesterday: number;
  salesMonth: number;
  profitMonth: number | null;
  pendingOrders: number;
  totalDebt: number;
  debtors: number;
  openShifts: Shift[];
}
