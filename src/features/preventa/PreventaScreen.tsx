import React from 'react';
import type { CartItem, Customer, Order, PaymentTerm, PresentationType, Product, PromoBanner } from '../../types/pos';
import { PAYMENT_TERMS } from '../../types/pos';
import { BottomSheetPresentation } from './BottomSheetPresentation';
import { TicketModal } from './TicketModal';
import { CustomerPicker } from './CustomerPicker';
import { BarcodeScannerListener } from '../../lib/scannerListener';
import {
  playBarcodeBeep,
  playSuccessChime,
  isScannerSoundActive,
  setScannerSoundEnabled
} from '../../lib/audioBeep';
import { buildCartItem, computeCartTotals, editedPrice, refreshCartWithCatalog } from '../../domain/cart';
import { buildComboItems } from '../../domain/combo';
import { ProductCard } from './ProductCard';
import { StoredPhoto } from '../../app/ProductThumb';
import { checkCredit, requiresCustomer } from '../../domain/credit';
import { KEYS, storage } from '../../services/storage';
import { usePos } from '../../state/PosContext';
import { plural } from '../../lib/text';
import { looksLikeOrderCode } from '../../domain/orderCode';
import { stockStatus } from '../../domain/stock';
import { useCategories } from '../../app/categories';
import { CameraScanner } from '../shared/CameraScanner';
import { MenuButton, ProfileSection } from '../../app/ProfileMenu';
import { useDialog } from '../../app/DialogProvider';
import {
  Barcode,
  Trash2,
  Pencil,
  ShoppingCart,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Search,
  X,
  Menu,
  Flame,
  LayoutGrid,
  List,
  Plus,
  Package,
  Sparkles,
  Volume2,
  VolumeX,
  Camera,
  Receipt,
  UserCheck,
  CloudOff
} from 'lucide-react';

const STATUS_BADGE: Record<Order['status'], { label: string; className: string }> = {
  PAGADO: { label: '✓ PAGADO', className: 'bg-brand-100 text-brand-800' },
  FIADO: { label: 'FIADO', className: 'bg-orange-100 text-orange-800' },
  PENDIENTE_PAGO: { label: 'PENDIENTE', className: 'bg-amber-100 text-amber-800' },
  CANCELADO: { label: 'ANULADO', className: 'bg-ink/10 text-ink-soft line-through' },
};

export const PreventaScreen: React.FC = () => {
  const { session, catalog, orders, createOrder, cancelOrder, online, api, upsertOrder, handleError } = usePos();
  const dialog = useDialog();
  const categoryInfo = useCategories();
  const userId = session!.user.id;
  const products = React.useMemo(() => (catalog?.products ?? []).filter(p => p.isActive !== false), [catalog]);
  const promos = catalog?.promos ?? [];
  const customers = catalog?.customers ?? [];
  const maxDiscount = Number(catalog?.settings.max_discount_percent ?? 10);
  // El vendedor solo ve sus propios pedidos (el admin ve los que emitió desde esta pantalla).
  const myOrders = React.useMemo(() => orders.filter(o => o.sellerId === userId), [orders, userId]);

  // Carrito persistente por usuario (sobrevive a cierres de la app).
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const cartLoaded = React.useRef(false);
  React.useEffect(() => {
    void storage.get<CartItem[]>(KEYS.cart(userId)).then(saved => {
      if (saved?.length) setCart(saved);
      cartLoaded.current = true;
    });
  }, [userId]);
  React.useEffect(() => {
    if (cartLoaded.current) void storage.set(KEYS.cart(userId), cart);
  }, [cart, userId]);
  // Si cambian precios en el catálogo, el carrito se recalcula con los precios vigentes.
  React.useEffect(() => {
    if (products.length) setCart(prev => (prev.length ? refreshCartWithCatalog(prev, products) : prev));
  }, [products]);

  const [selectedCartItem, setSelectedCartItem] = React.useState<CartItem | null>(null);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = React.useState<boolean>(false);
  const [activeOrderId, setActiveOrderId] = React.useState<string | null>(null);
  const activeOrder = orders.find(o => o.id === activeOrderId) ?? null;
  const [isTicketModalOpen, setIsTicketModalOpen] = React.useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [lastScannedFeedback, setLastScannedFeedback] = React.useState<{ text: string; error?: boolean } | null>(null);

  // Modos de visualización y Drawer
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('Todos');
  const [activeScreenTab, setActiveScreenTab] = React.useState<'catalogo' | 'ofertas'>('catalogo');
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [isDrawerOpen, setIsDrawerOpen] = React.useState<boolean>(false);

  // Estados para el Carrito Abajo y Animaciones de Adición
  const [isCartDrawerOpen, setIsCartDrawerOpen] = React.useState<boolean>(false);
  const [isCartBouncing, setIsCartBouncing] = React.useState<boolean>(false);
  const [recentlyAddedItem, setRecentlyAddedItem] = React.useState<{ name: string; price: number } | null>(null);

  // Estados de Audio, Cámara e Historial de Preventas
  const [soundEnabled, setSoundEnabled] = React.useState<boolean>(isScannerSoundActive());
  const [isCameraScannerOpen, setIsCameraScannerOpen] = React.useState<boolean>(false);
  const [isOrderHistoryOpen, setIsOrderHistoryOpen] = React.useState<boolean>(false);

  // Cliente y Condiciones de Preventa
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null);
  const [walkInName, setWalkInName] = React.useState<string>('');
  const [paymentTerm, setPaymentTerm] = React.useState<PaymentTerm>('Contado');
  const [discountPercent, setDiscountPercent] = React.useState<number>(0);
  const [returnedContainers, setReturnedContainers] = React.useState<number>(0);
  // Al modificar un ticket ya sincronizado, el nuevo queda enlazado al anulado.
  const [replacingOrderId, setReplacingOrderId] = React.useState<string | null>(null);

  // Mantener el cliente seleccionado al día (deuda/límite) cuando se refresca el catálogo.
  React.useEffect(() => {
    if (selectedCustomer) setSelectedCustomer(customers.find(c => c.id === selectedCustomer.id) ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers]);

  // Ref para mantener la versión más reciente de handleScanBarcode sin recrear el listener del escáner
  const handleScanBarcodeRef = React.useRef<(barcode: string) => void>(() => {});

  // Ref y Effect para auto-scroll del carrusel de promociones
  const carouselRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (activeScreenTab === 'ofertas') return; // No auto-scroll cuando están en vista de lista vertical

    const interval = setInterval(() => {
      if (carouselRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
        const maxScroll = scrollWidth - clientWidth;

        // Si llegó al final (o muy cerca), regresa al principio, sino avanza 1 tarjeta (aprox)
        if (scrollLeft >= maxScroll - 10) {
          carouselRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          carouselRef.current.scrollTo({ left: scrollLeft + 300, behavior: 'smooth' });
        }
      }
    }, 3500); // Cambia cada 3.5 segundos

    return () => clearInterval(interval);
  }, [activeScreenTab]);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setScannerSoundEnabled(next);
    if (next) playBarcodeBeep();
  };

  // Disparador de animación al añadir al carrito
  const triggerCartAnimation = (name: string, price: number) => {
    setIsCartBouncing(true);
    setRecentlyAddedItem({ name, price });

    setTimeout(() => {
      setIsCartBouncing(false);
    }, 700);

    setTimeout(() => {
      setRecentlyAddedItem(null);
    }, 2200);
  };

  const showFeedback = (text: string, error = false) => {
    setLastScannedFeedback({ text, error });
    setTimeout(() => setLastScannedFeedback(null), error ? 3000 : 2500);
  };

  // Listener único del escáner HID. Usa handleScanBarcodeRef para siempre llamar
  // la versión más reciente del callback sin destruir/recrear el listener en cada render.
  React.useEffect(() => {
    const scanner = new BarcodeScannerListener({
      maxIntervalMs: 65,
      minBarcodeLength: 3,
      onScan: (barcode) => {
        handleScanBarcodeRef.current(barcode);
      },
    });

    scanner.start();
    return () => {
      scanner.stop();
    };
  }, []);

  /** Busca por código principal o por el código propio de una presentación (ej. el del paquete). */
  const findByBarcode = (code: string): { product: Product; presentation: PresentationType } | null => {
    // Un UPC de 12 dígitos es el mismo EAN-13 con un 0 adelante: la cámara puede leer cualquiera de los dos.
    const variants = new Set([code, code.length === 12 ? `0${code}` : code, code.length === 13 && code.startsWith('0') ? code.slice(1) : code]);
    for (const p of products) {
      if (variants.has(p.barcode)) return { product: p, presentation: 'unit' };
      for (const pres of Object.values(p.presentations)) {
        if (pres?.barcode && variants.has(pres.barcode)) return { product: p, presentation: pres.type };
      }
    }
    return null;
  };

  /** Agrega 1 de la presentación indicada. Devuelve el texto de confirmación, o null si no se pudo. */
  const addOne = (product: Product, presentation: PresentationType): string | null => {
    const pres = product.presentations[presentation];
    if (!pres) return null;
    // Las líneas de un combo tienen su propio precio: un producto suelto va en otra línea.
    const existing = cart.find(item => item.product.id === product.id && item.selectedPresentation === presentation && !item.promoId);
    const reservedOther = cart
      .filter(item => item.product.id === product.id && item !== existing)
      .reduce((acc, item) => acc + item.deductedBaseUnits, 0);
    const newQty = (existing?.quantity ?? 0) + 1;

    if (reservedOther + newQty * pres.conversionFactor > product.stockInBaseUnits) {
      showFeedback(`Stock límite alcanzado para ${product.name}`, true);
      return null;
    }

    playBarcodeBeep();
    setCart(prevCart => existing
      ? prevCart.map(item => (item.cartItemId === existing.cartItemId
          ? buildCartItem(product, presentation, newQty, item.cartItemId, editedPrice(item))
          : item))
      : [buildCartItem(product, presentation, 1), ...prevCart]);
    triggerCartAnimation(product.name, pres.price);
    showFeedback(`✓ ${product.name} (1 ${pres.shortLabel})`);
    return `✓ ${product.name} · ${pres.shortLabel}`;
  };

  /** Quita 1 de la presentación (sin tocar las líneas de combos). */
  const removeOne = (product: Product, presentation: PresentationType) => {
    const line = cart.find(item => item.product.id === product.id && item.selectedPresentation === presentation && !item.promoId);
    if (!line) return;
    playBarcodeBeep();
    setCart(prev => line.quantity <= 1
      ? prev.filter(i => i.cartItemId !== line.cartItemId)
      : prev.map(i => (i.cartItemId === line.cartItemId
          ? buildCartItem(product, presentation, line.quantity - 1, line.cartItemId, editedPrice(line))
          : i)));
  };

  /** Cantidad suelta (sin combos) de una presentación en el pedido. */
  const qtyInCart = (productId: string, presentation: PresentationType) =>
    cart.find(i => i.product.id === productId && i.selectedPresentation === presentation && !i.promoId)?.quantity ?? 0;

  /** Agrega 1 unidad del código escaneado. Devuelve el texto de confirmación, o null si no se pudo. */
  const handleScanBarcode = (barcode: string): string | null => {
    const cleanBarcode = barcode.trim();
    const found = findByBarcode(cleanBarcode);
    if (!found) {
      showFeedback(`Código no registrado: ${cleanBarcode}`, true);
      return null;
    }
    return addOne(found.product, found.presentation);
  };

  const renderCard = (product: Product, layout: 'grid' | 'list') => {
    const packType: PresentationType | null = product.presentations.pack ? 'pack' : product.presentations.half ? 'half' : null;
    return (
      <ProductCard
        key={product.id}
        product={product}
        layout={layout}
        status={stockStatus(product)}
        unitQty={qtyInCart(product.id, 'unit')}
        packQty={packType ? qtyInCart(product.id, packType) : 0}
        onOpen={() => handleProductCardClick(product)}
        onAddUnit={() => { addOne(product, 'unit'); }}
        onRemoveUnit={() => removeOne(product, 'unit')}
        onAddPack={() => { if (packType) addOne(product, packType); }}
      />
    );
  };

  /** Agrega un combo completo cobrando su precio de oferta. */
  const handleAddCombo = (promo: PromoBanner) => {
    const result = buildComboItems(promo, findByBarcode, productId =>
      cart.filter(i => i.product.id === productId).reduce((acc, i) => acc + i.deductedBaseUnits, 0));
    if (!result.ok) {
      showFeedback(result.error, true);
      return;
    }
    playBarcodeBeep();
    setCart(prev => [...result.items, ...prev]);
    triggerCartAnimation(promo.title, promo.offerPrice);
    showFeedback(`✓ ${promo.title}`);
  };

  // Sincronizar ref con la versión más reciente de handleScanBarcode en cada render
  /**
   * Abre un ticket ya emitido a partir de su código o QR (para revisarlo o reimprimirlo).
   * Primero busca en los pedidos del celular; si no está, lo pide al servidor.
   */
  const openTicketByCode = async (raw: string) => {
    const code = raw.trim().toUpperCase();
    let order = orders.find(o => o.code === code || o.qrPayload === code);
    if (!order && api) {
      try {
        order = await api.getOrder(code);
        upsertOrder(order);
      } catch (e) {
        void dialog.alert(handleError(e), { tone: 'danger', title: 'No se encontró el ticket' });
        return;
      }
    }
    if (!order) {
      void dialog.alert(`No hay un ticket con el código ${code} en este celular. Conéctese a internet para buscarlo.`, { tone: 'warning', title: 'Ticket no encontrado' });
      return;
    }
    playBarcodeBeep();
    setActiveOrderId(order.id);
    setIsTicketModalOpen(true);
  };

  // La pistola lectora puede leer tanto productos como el QR de un ticket.
  handleScanBarcodeRef.current = (code: string) => {
    if (looksLikeOrderCode(code)) void openTicketByCode(code);
    else handleScanBarcode(code);
  };

  const handleProductCardClick = (product: Product) => {
    const existing = cart.find(i => i.product.id === product.id);
    if (existing) {
      setSelectedCartItem(existing);
    } else {
      const tempItem = buildCartItem(product, 'unit', 1);
      setCart(prev => [tempItem, ...prev]);
      setSelectedCartItem(tempItem);
      triggerCartAnimation(product.name, tempItem.unitPrice);
    }
    setIsBottomSheetOpen(true);
  };

  const handleUpdatePresentation = (cartItemId: string, presentation: PresentationType, quantity: number, unitPrice: number) => {
    setCart(prevCart => prevCart.map(item =>
      item.cartItemId === cartItemId ? buildCartItem(item.product, presentation, quantity, cartItemId, unitPrice) : item));
    setIsCartBouncing(true);
    setTimeout(() => setIsCartBouncing(false), 500);
  };

  const handleRemoveItem = (cartItemId: string) => {
    setCart(prev => prev.filter(i => i.cartItemId !== cartItemId));
  };

  const resetSaleForm = () => {
    setCart([]);
    setReturnedContainers(0);
    setDiscountPercent(0);
    setPaymentTerm('Contado');
    setSelectedCustomer(null);
    setWalkInName('');
    setReplacingOrderId(null);
  };

  const handleClearCart = () => {
    resetSaleForm();
    setIsCartDrawerOpen(false);
  };

  const { gross: grossTotal, discount: discountAmount, total: totalAmount, baseUnits: totalBaseUnits } =
    computeCartTotals(cart, discountPercent);

  const handleGeneratePreSale = async () => {
    if (cart.length === 0 || isSubmitting) return;

    if (requiresCustomer(paymentTerm) && !selectedCustomer) {
      void dialog.alert('Para vender al fiado o a crédito, seleccione o registre al cliente (basta con el nombre).', { tone: 'warning', title: 'Falta el cliente' });
      return;
    }
    if (selectedCustomer && requiresCustomer(paymentTerm)) {
      const credit = checkCredit(selectedCustomer, totalAmount, orders);
      if (credit.allowed && credit.currentDebt > 0 &&
          !(await dialog.confirm(
            `"${selectedCustomer.name}" ya debe S/ ${credit.currentDebt.toFixed(2)}.\n\n¿Emitir un NUEVO ${paymentTerm.toUpperCase()} por S/ ${totalAmount.toFixed(2)}?`,
            { title: '¡Alerta de deuda!', confirmText: 'Sí, emitir' }))) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const order = await createOrder({
        cart,
        customer: selectedCustomer,
        customerName: walkInName,
        paymentTerm,
        discountPercent,
        returnedContainers,
        replacesOrderId: replacingOrderId,
      });
      playSuccessChime();
      setActiveOrderId(order.id);
      setIsTicketModalOpen(true);
      setIsCartDrawerOpen(false);
      resetSaleForm();
    } catch (e) {
      void dialog.alert(e instanceof Error ? e.message : String(e), { tone: 'danger', title: 'No se pudo emitir el ticket' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditOrder = async (order: Order) => {
    const newCart: CartItem[] = [];
    order.items.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      if (product && product.presentations[item.presentationType]) {
        newCart.push(buildCartItem(product, item.presentationType, item.quantity, undefined, item.unitPrice));
      }
    });

    try {
      await cancelOrder(order, 'Modificación de ticket');
    } catch (e) {
      void dialog.alert(e instanceof Error ? e.message : String(e), { tone: 'danger', title: 'No se pudo anular el ticket' });
      return;
    }

    setCart(newCart);
    if (order.paymentTerm) setPaymentTerm(order.paymentTerm);
    setSelectedCustomer(customers.find(c => c.id === order.customerId) ?? null);
    setWalkInName(order.customerId ? '' : order.customerName ?? '');
    setDiscountPercent(order.discountPercent ?? 0);
    setReturnedContainers(order.returnedContainers || 0);
    // Si el ticket nunca llegó al servidor, simplemente se descartó: no hay nada que enlazar.
    setReplacingOrderId(order.syncStatus === 'synced' ? order.id : null);

    setIsTicketModalOpen(false);
    setIsOrderHistoryOpen(false);
    setIsCartDrawerOpen(true);
  };

  // Ventas de hoy (no anuladas) para el contador del encabezado y el historial.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todaysOrders = myOrders.filter(o => new Date(o.createdAt) >= startOfToday);
  const todaysTotal = todaysOrders.filter(o => o.status !== 'CANCELADO').reduce((acc, o) => acc + o.totalAmount, 0);

  // Filtrado de cientos de productos
  const filteredProducts = products.filter(p => {
    const matchesCategory =
      activeScreenTab === 'ofertas' ? p.isPromo :
      selectedCategory === 'Todos' ? true : p.category === selectedCategory;

    if (!matchesCategory) return false;

    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase().trim();
    return (
      p.name.toLowerCase().includes(query) ||
      p.barcode.includes(query) ||
      p.category.toLowerCase().includes(query) ||
      (p.flavorNote && p.flavorNote.toLowerCase().includes(query))
    );
  });

  // Solo las categorías que tienen productos (el catálogo puede tener muchas categorías vacías).
  const categoriesList = ['Todos', ...categoryInfo.map(c => c.name).filter(name => products.some(p => p.category === name))];

  return (
    <div className="w-full h-full flex flex-col items-center bg-white">
      {/* DISPOSITIVO NATIVO FULL SCREEN */}
      <div className="w-full h-full flex flex-col overflow-hidden select-none bg-white relative">

        {/* Cabecera clara (mismo estilo que Ventas): menú, título y lo vendido hoy */}
        <div className="z-30 flex items-center gap-3 bg-paper px-4 pb-2 pt-3 text-ink">
          <MenuButton onClick={() => setIsDrawerOpen(true)} className="border border-ink/10 bg-white text-ink" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-[26px] font-bold leading-none tracking-tight">
              {activeScreenTab === 'ofertas' ? 'Ofertas' : 'Pre-Venta'}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setIsOrderHistoryOpen(true)}
            className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-ink/10 bg-white pl-3 pr-4 transition active:scale-95"
          >
            <span className="text-sm text-ink-soft">Hoy</span>
            <span className="whitespace-nowrap font-display text-base font-bold">S/ {todaysTotal.toFixed(2)}</span>
          </button>
        </div>

        {/* DRAWER / MENÚ LATERAL */}
        {isDrawerOpen && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex animate-in fade-in" onClick={() => setIsDrawerOpen(false)}>
            <div 
              className="w-[19rem] max-w-[85%] bg-white h-full shadow-2xl p-4 flex flex-col gap-4 overflow-y-auto animate-in slide-in-from-left duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <div className="flex items-center justify-between border-b border-ink/10 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <div>
                      <h3 className="font-display text-lg font-bold text-ink leading-tight">{catalog?.settings.store_name || 'Pre-Venta'}</h3>
                      <p className="text-sm text-ink-soft">Pre-Venta</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    className="p-1 text-ink/45 hover:text-ink"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-1 text-[15px] font-bold text-ink">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveScreenTab('catalogo');
                      setIsDrawerOpen(false);
                    }}
                    className="w-full flex h-12 items-center justify-between px-3 rounded-xl hover:bg-ink/5 text-ink transition"
                  >
                    <span className="flex items-center gap-3">
                      <Package className="w-4 h-4 text-brand-600" />
                      <span>Catálogo</span>
                    </span>
                    <span className="text-xs font-display text-ink/45">{products.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveScreenTab('ofertas');
                      setIsDrawerOpen(false);
                    }}
                    className="w-full flex h-12 items-center justify-between px-3 rounded-xl hover:bg-ink/5 text-ink transition"
                  >
                    <span className="flex items-center gap-3">
                      <Flame className="w-4 h-4 text-amber-500" />
                      <span>Ofertas</span>
                    </span>
                    <span className="text-sm text-ink-soft">{promos.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsDrawerOpen(false);
                      setIsCartDrawerOpen(true);
                    }}
                    className="w-full flex h-12 items-center justify-between px-3 rounded-xl hover:bg-ink/5 text-ink transition"
                  >
                    <span className="flex items-center gap-3">
                      <ShoppingCart className="w-4 h-4 text-brand-600" />
                      <span>Ver pedido</span>
                    </span>
                    <span className="text-xs bg-brand-100 text-brand-800 px-1.5 py-0.2 rounded font-black">{cart.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsDrawerOpen(false);
                      setIsOrderHistoryOpen(true);
                    }}
                    className="w-full flex h-12 items-center justify-between px-3 rounded-xl hover:bg-ink/5 text-ink transition"
                  >
                    <span className="flex items-center gap-3">
                      <Receipt className="w-4 h-4 text-amber-500" />
                      <span>Mis ventas de hoy</span>
                    </span>
                    <span className="text-xs bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-black">{todaysOrders.length}</span>
                  </button>

                  <div className="my-2 border-t border-ink/10" />

                  <button
                    type="button"
                    onClick={handleToggleSound}
                    className="w-full flex h-12 items-center justify-between px-3 rounded-xl hover:bg-ink/5 text-ink transition"
                  >
                    <span className="flex items-center gap-3">
                      {soundEnabled ? <Volume2 className="w-4 h-4 text-brand-600" /> : <VolumeX className="w-4 h-4 text-ink/45" />}
                      <span>Sonido del escáner</span>
                    </span>
                    <span className="text-sm text-ink-soft">{soundEnabled ? 'Activado' : 'Apagado'}</span>
                  </button>
                </div>
              </div>

              <ProfileSection onDone={() => setIsDrawerOpen(false)} />
            </div>
          </div>
        )}

        {/* Buscador, Catálogo/Ofertas y categorías */}
        <div className="sticky top-0 z-20 space-y-3 bg-paper px-4 pb-3 pt-1">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-soft" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar producto o código"
                className="h-12 w-full rounded-full border border-ink/10 bg-white pl-11 pr-10 text-[15px] text-ink outline-none placeholder:text-ink/40 focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} aria-label="Borrar búsqueda"
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-ink/5 text-ink-soft">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button type="button" onClick={() => setIsCameraScannerOpen(true)} aria-label="Escanear con la cámara"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink text-white transition active:scale-95">
              <Camera className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="no-scrollbar -mx-1 flex flex-1 gap-2 overflow-x-auto px-1">
              {(['catalogo', 'ofertas'] as const).map(tab => (
                <button key={tab} type="button" onClick={() => setActiveScreenTab(tab)} aria-pressed={activeScreenTab === tab}
                  className={`h-10 shrink-0 rounded-full px-4 text-[15px] font-bold transition ${
                    activeScreenTab === tab ? 'bg-ink text-white' : 'border border-ink/15 bg-white text-ink'}`}>
                  {tab === 'catalogo' ? 'Todo' : 'Ofertas'}
                </button>
              ))}
              <span className="my-2 w-px shrink-0 bg-ink/15" aria-hidden />
              {categoriesList.filter(c => c !== 'Todos').map(cat => (
                <button key={cat} type="button" aria-pressed={selectedCategory === cat}
                  onClick={() => { setActiveScreenTab('catalogo'); setSelectedCategory(selectedCategory === cat ? 'Todos' : cat); }}
                  className={`h-10 shrink-0 rounded-full px-4 text-[15px] font-bold transition ${
                    selectedCategory === cat ? 'bg-brand-600 text-white' : 'border border-ink/15 bg-white text-ink'}`}>
                  {cat}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              aria-label={viewMode === 'grid' ? 'Ver como lista' : 'Ver como cuadrícula'}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink/15 bg-white text-ink">
              {viewMode === 'grid' ? <List className="h-5 w-5" /> : <LayoutGrid className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Aviso flotante sobre la barra del pedido: producto agregado o error de escaneo */}
        {(lastScannedFeedback?.error || recentlyAddedItem) && (
          <div className="pointer-events-none absolute inset-x-4 bottom-[100px] z-40 flex justify-center animate-in slide-in-from-bottom-4 fade-in duration-200" role="status">
            {lastScannedFeedback?.error ? (
              <div className="flex max-w-full items-center gap-2.5 rounded-full bg-fresa py-2.5 pl-3 pr-4 text-white shadow-lg">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span className="truncate text-[15px] font-bold">{lastScannedFeedback.text}</span>
              </div>
            ) : recentlyAddedItem && (
              <div className="flex max-w-full items-center gap-2.5 rounded-full bg-ink py-2 pl-2 pr-4 text-white shadow-lg">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500"><CheckCircle2 className="h-5 w-5" /></span>
                <span className="truncate text-[15px] font-bold">{recentlyAddedItem.name}</span>
                <span className="shrink-0 font-display text-[15px] font-bold text-tag">S/ {recentlyAddedItem.price.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {/* CATÁLOGO DE PRODUCTOS SCROLLABLE */}
        <div className="flex-1 overflow-y-auto px-4 pt-1 space-y-5 bg-paper pb-32">
          {/* SECCIÓN DE PROMOCIONES DINÁMICAS (CARRUSEL O LISTA COMPLETA) */}
          {!searchQuery && promos.length > 0 && (activeScreenTab === 'ofertas' || selectedCategory === 'Todos') && (
            <div ref={carouselRef} className={activeScreenTab === 'ofertas' ? "flex flex-col gap-4" : "flex overflow-x-auto gap-3 snap-x snap-mandatory scrollbar-none pb-2 transition-all"}>
              {promos.map(promo => (
                <div key={promo.id} className={`relative overflow-hidden rounded-3xl bg-ink text-white shadow-[0_14px_28px_-18px_rgba(20,67,61,0.9)] ${activeScreenTab === 'ofertas' ? 'w-full' : 'w-[85%] max-w-[340px] sm:w-[320px] snap-center shrink-0'}`}>
                  {/* Perforación de la etiqueta de precio */}
                  {promo.imageUrl ? (
                    <div className="relative aspect-[16/9] w-full overflow-hidden bg-white/10">
                      <StoredPhoto imageUrl={promo.imageUrl} alt={promo.title} />
                      {promo.discountBadge && (
                        <span className="absolute left-3 top-3 rounded-md bg-fresa px-2 py-0.5 text-sm font-extrabold text-white">{promo.discountBadge}</span>
                      )}
                    </div>
                  ) : (
                    <span className="absolute right-4 top-4 h-3.5 w-3.5 rounded-full bg-paper" />
                  )}
                  <div className={`flex flex-col justify-between p-4 ${promo.imageUrl ? '' : 'h-full pr-10'}`}>
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                        <span className="text-tag">{promo.badgeText}</span>
                        {promo.tag && <span className="rounded-md bg-white/12 px-1.5 text-white/85">{promo.tag}</span>}
                        {promo.discountBadge && !promo.imageUrl && <span className="rounded-md bg-fresa px-1.5 text-white">{promo.discountBadge}</span>}
                      </div>
                      <h3 className="mt-1.5 font-display text-lg font-bold leading-tight line-clamp-2">{promo.title}</h3>
                      <p className="mt-1 text-sm leading-snug text-white/70 line-clamp-2">{promo.subtitle}</p>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-tag">{promo.savingText}</div>
                        <div className="text-sm text-white/55 line-through">Antes S/ {promo.originalPrice.toFixed(2)}</div>
                        <div className="font-display text-[32px] font-bold leading-none [font-stretch:85%]">S/ {promo.offerPrice.toFixed(2)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddCombo(promo)}
                        className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-tag px-4 text-sm font-bold text-ink transition active:scale-95"
                      >
                        <Plus className="h-4 w-4" /> Agregar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Título de la sección */}
          <div className="flex items-baseline justify-between gap-3 px-1 pt-1">
            <h2 className="font-display text-[22px] font-bold leading-tight text-ink">
              {searchQuery ? 'Resultados' : selectedCategory !== 'Todos' ? selectedCategory : 'Todos los productos'}
            </h2>
            <span className="text-[15px] text-ink-soft">{plural(filteredProducts.length, 'producto')}</span>
          </div>

          {filteredProducts.length === 0 && (
            <div className="rounded-3xl bg-white p-6 text-center">
              <p className="font-display text-lg font-bold">No encontramos ese producto</p>
              <p className="mt-1 text-[15px] text-ink-soft">Pruebe con otro nombre o escanee su código.</p>
            </div>
          )}

          {viewMode === 'grid' ? (
            /* Cuadrícula: imagen, precio y cantidad en la misma tarjeta */
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {filteredProducts.map(product => renderCard(product, 'grid'))}
            </div>
          ) : (
            /* Lista rápida */
            <ul className="space-y-2">
              {filteredProducts.map(product => renderCard(product, 'list'))}
            </ul>
          )}
        </div>

        {/* ========================================================================= */}
        {/* EL CARRITO UBICADO ABAJO (ZONA ERGONÓMICA DE PULGAR) CON ANIMACIÓN */}
        {/* ========================================================================= */}
        <div className="absolute inset-x-0 bottom-0 z-30 px-3 pb-3">
          <div
            onClick={() => setIsCartDrawerOpen(true)}
            className={`flex cursor-pointer items-center gap-3 rounded-[28px] bg-white p-2.5 pl-4 shadow-[0_18px_40px_-18px_rgba(31,42,48,0.55)] ring-1 ring-ink/5 transition ${isCartBouncing ? 'scale-[1.02]' : ''}`}
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm text-ink-soft">
                {cart.length === 0 ? 'Pedido vacío' : `${plural(cart.length, 'producto')}, ${plural(totalBaseUnits, 'unidad', 'unidades')}`}
              </div>
              <div className="font-display text-[22px] font-bold leading-tight text-ink">S/ {totalAmount.toFixed(2)}</div>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsCartDrawerOpen(true); }}
              className="relative flex h-14 shrink-0 items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-bold text-white transition active:scale-95"
            >
              <ShoppingCart className={`h-5 w-5 ${isCartBouncing ? 'animate-bounce' : ''}`} />
              Ver pedido
              {cart.length > 0 && (
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-tag px-1.5 text-sm font-bold text-ink">{cart.length}</span>
              )}
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* DRAWER DESLIZABLE COMPLETO DEL CARRITO DESDE ABAJO */}
        {/* ========================================================================= */}
        {isCartDrawerOpen && (
          <div 
            className="absolute inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end justify-center animate-in fade-in"
            onClick={() => setIsCartDrawerOpen(false)}
          >
            <div 
              className="w-full bg-white rounded-t-3xl max-h-[92dvh] flex flex-col shadow-2xl px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle bar superior */}
              <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-2" />

              {/* Header del carrito */}
              <div className="flex items-center justify-between border-b border-ink/10 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-brand-100 text-brand-600 rounded-xl">
                    <ShoppingCart className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-ink">
                      Pedido · {plural(cart.length, 'producto')}
                    </h3>
                    <p className="text-xs text-ink-soft">
                      Saldrán <strong className="text-brand-700">{plural(totalBaseUnits, 'unidad', 'unidades')}</strong> del almacén
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (cart.length === 0 || await dialog.confirm('Se quitarán todos los productos del pedido.',
                        { title: '¿Vaciar el carrito?', tone: 'danger', confirmText: 'Vaciar' })) handleClearCart();
                    }}
                    className="h-10 px-2 text-xs text-red-600 font-bold hover:bg-red-50 rounded-xl flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Vaciar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCartDrawerOpen(false)}
                    aria-label="Cerrar"
                    className="h-10 w-10 flex items-center justify-center rounded-full text-ink-soft hover:text-ink bg-cream"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Todo el contenido se desliza; el botón de emitir queda fijo abajo */}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
              {/* Lista de productos en el carrito */}
              <div className="space-y-2 py-1">
                {cart.map((item) => {
                  const pres = item.product.presentations[item.selectedPresentation]!;
                  return (
                    <div
                      key={item.cartItemId}
                      className="bg-white rounded-2xl p-3 border border-ink/10"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black  px-2 py-0.5 rounded bg-brand-100 text-brand-800">
                              {pres.shortLabel}
                            </span>
                            {item.promoId && (
                              <span className="text-xs font-black px-2 py-0.5 rounded bg-fresa text-white truncate max-w-[160px]" title={item.promoTitle}>
                                Combo{item.promoTitle ? `: ${item.promoTitle}` : ''}
                              </span>
                            )}
                            <span className="text-xs text-ink/45 font-display">
                              {item.product.barcode}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-ink mt-1 truncate">
                            {item.product.name}
                          </h4>
                          <div className="text-xs text-ink-soft mt-0.5">
                            Cant: <strong className="text-ink">{item.quantity}</strong> × S/ {item.unitPrice.toFixed(2)}
                            {editedPrice(item) !== undefined && !item.promoId && (
                              <span className="ml-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1">
                                editado (lista S/ {item.listPrice.toFixed(2)})
                              </span>
                            )}

                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-black text-ink font-display">
                            S/ {item.subtotal.toFixed(2)}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveItem(item.cartItemId);
                            }}
                            aria-label="Quitar del pedido"
                            className="mt-1 h-9 w-9 inline-flex items-center justify-center rounded-lg text-ink/45 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Solo este botón abre la edición: deslizar la lista no debe abrirla por accidente. */}
                      <div className="mt-2 flex items-center justify-between gap-2 border-t border-ink/10 pt-2">
                        <span className="text-sm text-ink-soft">Presentación, cantidad o precio</span>
                        <button
                          type="button"
                          onClick={() => { setSelectedCartItem(item); setIsBottomSheetOpen(true); }}
                          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-brand-50 px-3 text-sm font-bold text-brand-800 transition active:scale-95"
                        >
                          <Pencil className="h-4 w-4" /> Editar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Datos del pedido: cliente, cómo paga, descuento, envases y total */}
              <div className="mt-2 space-y-5 border-t border-ink/10 pt-4">
                <section>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h4 className="font-display text-lg font-bold text-ink">Cliente</h4>
                    {selectedCustomer?.route && <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-sm font-bold text-brand-800">{selectedCustomer.route}</span>}
                  </div>
                  <CustomerPicker
                    customers={customers}
                    selected={selectedCustomer}
                    onSelect={setSelectedCustomer}
                    walkInName={walkInName}
                    onWalkInNameChange={setWalkInName}
                    allowWalkIn={!requiresCustomer(paymentTerm)}
                  />
                </section>

                <section>
                  <h4 className="mb-2 font-display text-lg font-bold text-ink">Cómo paga</h4>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_TERMS.map(term => (
                      <button key={term} type="button" onClick={() => setPaymentTerm(term)} aria-pressed={paymentTerm === term}
                        className={`h-10 rounded-full px-4 text-[15px] font-bold transition ${paymentTerm === term ? 'bg-ink text-white' : 'border border-ink/15 bg-white text-ink'}`}>
                        {term === 'Fiado (Libreta)' ? 'Fiado' : term}
                      </button>
                    ))}
                  </div>
                </section>

                {maxDiscount > 0 && (
                  <section>
                    <h4 className="mb-2 font-display text-lg font-bold text-ink">Descuento</h4>
                    <div className="flex gap-2">
                      {[0, 3, 5, 10].filter(pct => pct <= maxDiscount).map(pct => (
                        <button key={pct} type="button" onClick={() => setDiscountPercent(pct)} aria-pressed={discountPercent === pct}
                          className={`h-10 flex-1 rounded-full text-[15px] font-bold transition ${discountPercent === pct ? 'bg-brand-600 text-white' : 'border border-ink/15 bg-white text-ink'}`}>
                          {pct === 0 ? 'Sin' : `${pct}%`}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                <section className="flex items-center justify-between gap-3 rounded-2xl bg-paper p-3">
                  <div className="min-w-0">
                    <h4 className="font-display text-base font-bold text-ink">Envases devueltos</h4>
                    <p className="text-sm text-ink-soft">Botellas o cajas vacías que deja el cliente</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 rounded-full bg-white p-1">
                    <button type="button" onClick={() => setReturnedContainers(Math.max(0, returnedContainers - 1))} aria-label="Uno menos"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/5 text-lg font-bold text-ink">−</button>
                    <input type="number" min="0" value={returnedContainers || ''} aria-label="Envases devueltos"
                      onChange={(e) => setReturnedContainers(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-10 bg-transparent text-center font-display text-lg font-bold text-ink outline-none" placeholder="0" />
                    <button type="button" onClick={() => setReturnedContainers(returnedContainers + 1)} aria-label="Uno más"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-lg font-bold text-white">+</button>
                  </div>
                </section>

                <section>
                  {discountPercent > 0 && (
                    <>
                      <div className="flex justify-between text-[15px] text-ink-soft"><span>Subtotal</span><span className="font-display">S/ {grossTotal.toFixed(2)}</span></div>
                      <div className="flex justify-between text-[15px] font-bold text-brand-700"><span>Descuento {discountPercent}%</span><span className="font-display">− S/ {discountAmount.toFixed(2)}</span></div>
                    </>
                  )}
                  <div className="mt-1 flex items-end justify-between gap-3">
                    <div>
                      <div className="font-display text-lg font-bold text-ink">Total</div>
                      <div className="text-sm text-ink-soft">
                        {paymentTerm === 'Contado' ? 'Lo cobra usted al entregar' : paymentTerm === 'Fiado (Libreta)' ? 'Queda como deuda del cliente' : 'Se paga en caja'}
                      </div>
                    </div>
                    <div className="font-display text-[34px] font-bold leading-none text-ink">S/ {totalAmount.toFixed(2)}</div>
                  </div>
                </section>

                {replacingOrderId && (
                  <div className="rounded-2xl bg-[#e3eefb] p-3 text-sm text-[#1d4f8f]">
                    Está modificando un ticket anulado: el nuevo quedará enlazado al anterior.
                  </div>
                )}
                {!online && (
                  <div className="flex items-center gap-2 rounded-2xl bg-[#fff3d6] p-3 text-sm text-[#7a5200]">
                    <CloudOff className="h-4 w-4 shrink-0" />
                    Sin internet: el ticket se guarda en el celular y se envía al reconectar.
                  </div>
                )}
              </div>
              </div>
              <div className="shrink-0 border-t border-ink/10 pt-3">
                <button
                  type="button"
                  onClick={() => void handleGeneratePreSale()}
                  disabled={isSubmitting || cart.length === 0}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-brand-600 text-base font-bold text-white transition active:scale-[0.99] disabled:opacity-50"
                >
                  <Barcode className="h-5 w-5" />
                  Emitir ticket
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Sheet Modal para Selección de Presentación (Unidad, Medio, Paquete) */}
        <BottomSheetPresentation
          item={selectedCartItem}
          isOpen={isBottomSheetOpen}
          onClose={() => setIsBottomSheetOpen(false)}
          onUpdatePresentation={handleUpdatePresentation}
        />

        {/* Modal de Impresión Térmica ESC/POS y Código QR para Caja */}
        <TicketModal
          order={activeOrder}
          isOpen={isTicketModalOpen}
          onClose={() => setIsTicketModalOpen(false)}
          onEditOrder={(order) => void handleEditOrder(order)}
          settings={catalog?.settings}
        />

        {/* ========================================================================= */}
        {/* ESCÁNER CON LA CÁMARA DEL CELULAR */}
        {/* ========================================================================= */}
        <CameraScanner
          open={isCameraScannerOpen}
          onClose={() => setIsCameraScannerOpen(false)}
          onDetected={code => {
            // QR de un ticket: se abre el ticket con sus productos para reimprimirlo.
            if (looksLikeOrderCode(code)) {
              setIsCameraScannerOpen(false);
              void openTicketByCode(code);
              return `Ticket ${code.toUpperCase()}`;
            }
            const added = handleScanBarcode(code);
            if (added) return added;
            return findByBarcode(code)
              ? { error: 'No hay stock suficiente de este producto' }
              : { error: `El código ${code} no está en el catálogo` };
          }}
          kind="any"
          title="Escanear producto o ticket"
          continuous
        />

        {/* ========================================================================= */}
        {/* MODAL HISTORIAL DE PREVENTAS DEL DÍA DEL VENDEDOR */}
        {/* ========================================================================= */}
        {isOrderHistoryOpen && (
          <div 
            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in"
            onClick={() => setIsOrderHistoryOpen(false)}
          >
            <div 
              className="w-full max-w-sm bg-white text-ink rounded-3xl p-5 shadow-2xl space-y-3 max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-ink/10 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                    <Receipt className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-ink ">
                      Mis Preventas de Hoy
                    </h3>
                    <p className="text-xs text-ink-soft">Preventista: {session!.user.fullName}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOrderHistoryOpen(false)}
                  className="p-1 rounded-full text-ink/45 hover:text-ink bg-cream"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Resumen de Métricas */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-brand-50 p-2.5 rounded-xl border border-brand-200 text-center">
                  <span className="text-xs font-bold text-brand-800 block ">Total Emitido Hoy</span>
                  <span className="text-base font-black text-brand-900 font-display">
                    S/ {todaysTotal.toFixed(2)}
                  </span>
                </div>
                <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-center">
                  <span className="text-xs font-bold text-amber-800 block ">Pedidos Generados</span>
                  <span className="text-base font-black text-amber-900 font-display">
                    {todaysOrders.length} pedidos
                  </span>
                </div>
              </div>

              {/* Lista de Pedidos */}
              <div className="flex-1 overflow-y-auto space-y-2 max-h-[50vh] pr-1">
                {todaysOrders.length === 0 ? (
                  <div className="p-6 text-center text-ink/45 space-y-2">
                    <Clock className="w-8 h-8 mx-auto text-ink/45" />
                    <p className="font-bold text-xs">No hay pedidos emitidos hoy</p>
                    <p className="text-xs">Añade productos y emite una pre-venta para verla aquí.</p>
                  </div>
                ) : (
                  todaysOrders.map((ord) => (
                    <div
                      key={ord.id}
                      onClick={() => {
                        setActiveOrderId(ord.id);
                        setIsTicketModalOpen(true);
                        setIsOrderHistoryOpen(false);
                      }}
                      className="p-3 bg-cream/60 rounded-2xl border border-ink/10 hover:border-brand-600 transition cursor-pointer flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <strong className="text-xs font-display text-ink">{ord.code}</strong>
                          <span className={`text-xs font-black px-1.5 py-0.2 rounded ${STATUS_BADGE[ord.status].className}`}>
                            {STATUS_BADGE[ord.status].label}
                          </span>
                          {ord.syncStatus === 'pending_sync' && (
                            <span className="text-xs font-black px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">Sin enviar</span>
                          )}
                          {ord.syncStatus === 'error' && (
                            <span className="text-xs font-black px-1.5 py-0.2 rounded bg-red-100 text-red-700" title={ord.syncError}>Rechazado</span>
                          )}
                        </div>
                        <div className="text-xs text-ink-soft font-semibold truncate mt-0.5">
                          {ord.customerName || 'Cliente General'}
                        </div>
                        <div className="text-xs text-ink/45">
                          {ord.items.length} productos · {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-black font-display text-ink">
                          S/ {ord.totalAmount.toFixed(2)}
                        </div>
                        <span className="text-xs text-brand-700 font-bold block mt-1">
                          Ver Ticket ↗
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
