/**
 * Definiciones de Tipos para Sistema de Pre-Venta POS
 * Especializado en Golosinas y Bebidas con Multi-Presentación y Factor de Conversión
 */

export type PresentationType = 'unit' | 'half' | 'pack';

export interface ProductPresentation {
  id: string;
  productId: string;
  type: PresentationType;
  label: string; // "Unidad", "Medio Paquete (12 unid)", "Paquete (24 unid)"
  shortLabel: string; // "UND", "MED", "PAQ"
  conversionFactor: number; // Factor hacia la unidad mínima base (Ej: 1, 6, 12, 24)
  price: number; // Precio de venta específico e independiente
  barcode?: string; // Código de barras específico si el paquete tiene uno propio
  cost?: number; // Costo referencial para cálculo de margen
  isDefault?: boolean; // Por defecto al escanear (true para 'unit')
}

export interface Product {
  id: string;
  barcode: string; // Código de barras principal (usualmente el de la unidad)
  name: string;
  category: 'Golosinas' | 'Bebidas' | 'Chocolates' | 'Snacks' | 'Galletas' | 'Licores';
  baseUnitName: string; // "unidad", "botella", "lata", "sobre"
  stockInBaseUnits: number; // Stock total expresado en unidades mínimas
  minStockAlert: number;
  imageUrl?: string;
  presentations: Record<PresentationType, ProductPresentation>;
}

export interface CartItem {
  cartItemId: string; // UUID único para la línea del carrito
  product: Product;
  selectedPresentation: PresentationType;
  quantity: number; // Cantidad de esa presentación
  unitPrice: number; // Precio unitario de la presentación seleccionada
  subtotal: number; // quantity * unitPrice
  deductedBaseUnits: number; // quantity * presentation.conversionFactor
}

export type OrderStatus = 'PENDIENTE_PAGO' | 'PAGADO' | 'CANCELADO';

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

export interface Order {
  id: string; // Ej: "PED-00892"
  createdAt: string;
  sellerId: string;
  sellerName: string;
  status: OrderStatus;
  items: OrderItemRecord[];
  totalAmount: number;
  totalBaseUnits: number;
  customerName?: string;
  customerRuc?: string;
  paymentTerm?: 'Contado' | 'Crédito 7 días' | 'Crédito 15 días';
  discountAmount?: number;
  notes?: string;
  syncStatus: 'synced' | 'pending_sync' | 'error';
  qrPayload: string; // String codificado en el QR
  paidAt?: string;
  paymentMethod?: string;
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
}
