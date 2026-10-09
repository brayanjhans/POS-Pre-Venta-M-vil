import React from 'react';
import type { CartItem, Customer, Order, PaymentTerm, PresentationType, Product } from '../../types/pos';
import { PAYMENT_TERMS, PRODUCT_CATEGORIES } from '../../types/pos';
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
import { checkCredit, requiresCustomer } from '../../domain/credit';
import { KEYS, storage } from '../../services/storage';
import { usePos } from '../../state/PosContext';
import { plural } from '../../lib/text';
import { CameraScanner } from '../shared/CameraScanner';
import { useDialog } from '../../app/DialogProvider';
import {
  Barcode,
  Trash2,
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
  CANCELADO: { label: 'ANULADO', className: 'bg-slate-200 text-ink-soft line-through' },
};

export const PreventaScreen: React.FC = () => {
  const { session, catalog, orders, createOrder, cancelOrder, online } = usePos();
  const dialog = useDialog();
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
    for (const p of products) {
      if (p.barcode === code) return { product: p, presentation: 'unit' };
      for (const pres of Object.values(p.presentations)) {
        if (pres?.barcode === code) return { product: p, presentation: pres.type };
      }
    }
    return null;
  };

  /** Agrega 1 unidad del código escaneado. Devuelve el texto de confirmación, o null si no se pudo. */
  const handleScanBarcode = (barcode: string): string | null => {
    const cleanBarcode = barcode.trim();
    const found = findByBarcode(cleanBarcode);

    if (!found) {
      showFeedback(`Código no registrado: ${cleanBarcode}`, true);
      return null;
    }

    const { product, presentation } = found;
    const pres = product.presentations[presentation]!;
    const existing = cart.find(item => item.product.id === product.id && item.selectedPresentation === presentation);
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

  // Sincronizar ref con la versión más reciente de handleScanBarcode en cada render
  handleScanBarcodeRef.current = handleScanBarcode;

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

  // Botón directo rápido "+" en la tarjeta
  const handleQuickAddUnit = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    handleScanBarcode(product.barcode);
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

  const categoriesList = ['Todos', ...PRODUCT_CATEGORIES];

  return (
    <div className="w-full h-full flex flex-col items-center bg-white">
      {/* DISPOSITIVO NATIVO FULL SCREEN */}
      <div className="w-full h-full flex flex-col overflow-hidden select-none bg-white relative">

        {/* HEADER LIMPIO: Botón ☰, CATÁLOGO, OFERTAS, CÁMARA, MIS PEDIDOS y ADMIN */}
        <div className="bg-brand-600 text-white px-3 md:px-4 py-2 flex items-center justify-between gap-2 shadow-md z-30">
          <div className="flex items-center gap-2 min-w-0">
            <button 
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition active:scale-95 text-white cursor-pointer"
              title="Abrir menú"
            >
              <Menu className="w-5 h-5 stroke-[2.5]" />
            </button>

            {/* Pestañas estilo Pill */}
            <div className="flex items-center bg-white rounded-full p-1 shadow-inner overflow-hidden whitespace-nowrap">
              <button
                type="button"
                onClick={() => setActiveScreenTab('catalogo')}
                className={`px-3 py-1 rounded-full font-black text-xs  flex items-center gap-1 transition ${
                  activeScreenTab === 'catalogo' 
                    ? 'text-ink bg-slate-100 shadow-sm' 
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Catálogo
              </button>
              <button
                type="button"
                onClick={() => setActiveScreenTab('ofertas')}
                aria-label="Ofertas"
                className={`px-2.5 sm:px-3 py-1 rounded-full font-black text-xs  flex items-center gap-1 transition ${
                  activeScreenTab === 'ofertas' 
                    ? 'text-amber-600 bg-amber-50 shadow-sm' 
                    : 'text-ink-soft hover:text-amber-600'
                }`}
              >
                🔥<span className="hidden sm:inline">Ofertas</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCameraScannerOpen(true)}
                aria-label="Escanear con cámara"
                className="px-2.5 sm:px-3 py-1 rounded-full font-black text-xs  text-ink-soft hover:text-ink flex items-center gap-1 transition"
              >
                <Camera className="w-4 h-4" />
                <span className="hidden sm:inline">Cámara</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Botón VENTAS S/ 0.00 (Historial de Pre-ventas) */}
            <button
              type="button"
              onClick={() => setIsOrderHistoryOpen(true)}
              className="px-3 py-1 bg-brand-900 hover:bg-brand-950 rounded-xl flex items-center gap-1.5 transition border border-brand-700"
            >
              <div className="text-[11px] font-black  leading-tight text-brand-100 text-right whitespace-nowrap">Mis ventas<br/>
                <span className="text-white text-xs">S/ {todaysTotal.toFixed(2)}</span>
              </div>
            </button>
          </div>
        </div>

        {/* DRAWER / MENÚ LATERAL */}
        {isDrawerOpen && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xs flex animate-in fade-in">
            <div 
              className="w-72 bg-white h-full shadow-2xl p-4 flex flex-col justify-between animate-in slide-in-from-left duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🍬</span>
                    <div>
                      <h3 className="font-black text-sm text-ink leading-tight">DULCES & BEBIDAS</h3>
                      <p className="text-xs text-slate-400">Distribuidora & Pre-Venta</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-1 text-xs font-bold text-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveScreenTab('catalogo');
                      setIsDrawerOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-brand-50 text-ink hover:text-brand-800 transition"
                  >
                    <span className="flex items-center gap-2.5">
                      <Package className="w-4 h-4 text-brand-600" />
                      <span>Catálogo de Productos</span>
                    </span>
                    <span className="text-xs font-display text-slate-400">{products.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveScreenTab('ofertas');
                      setIsDrawerOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-brand-50 text-ink hover:text-brand-800 transition"
                  >
                    <span className="flex items-center gap-2.5">
                      <Flame className="w-4 h-4 text-amber-500" />
                      <span>Promociones Destacadas</span>
                    </span>
                    <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-black">TOP</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsDrawerOpen(false);
                      setIsCartDrawerOpen(true);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-brand-50 text-ink hover:text-brand-800 transition"
                  >
                    <span className="flex items-center gap-2.5">
                      <ShoppingCart className="w-4 h-4 text-brand-600" />
                      <span>Ver Carrito Abajo</span>
                    </span>
                    <span className="text-xs bg-brand-100 text-brand-800 px-1.5 py-0.2 rounded font-black">{cart.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsDrawerOpen(false);
                      setIsOrderHistoryOpen(true);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-brand-50 text-ink hover:text-brand-800 transition"
                  >
                    <span className="flex items-center gap-2.5">
                      <Receipt className="w-4 h-4 text-amber-500" />
                      <span>Mis Preventas de Hoy</span>
                    </span>
                    <span className="text-xs bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-black">{todaysOrders.length}</span>
                  </button>

                  <div className="my-2 border-t border-slate-200" />

                  <button
                    type="button"
                    onClick={handleToggleSound}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-brand-50 text-ink transition"
                  >
                    <span className="flex items-center gap-2.5">
                      {soundEnabled ? <Volume2 className="w-4 h-4 text-brand-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
                      <span>Sonido del escáner</span>
                    </span>
                    <span className="text-xs font-black text-ink-soft">{soundEnabled ? 'ON' : 'OFF'}</span>
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3 text-xs text-slate-400">
                <div>{catalog?.settings.store_name ?? 'POS Pre-Venta'} · {online ? 'En línea' : 'Modo sin internet'}</div>
              </div>
            </div>
          </div>
        )}

        {/* BÚSQUEDA Y FILTRADO POTENTE PARA CIENTOS DE PRODUCTOS */}
        <div className="sticky top-0 bg-white/85 backdrop-blur-xl p-3 border-b border-slate-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.03)] space-y-3 z-20 transition-all duration-300">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-brand-600 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar entre cientos de productos..."
              className="w-full bg-slate-100/80 border-transparent rounded-2xl pl-10 pr-16 py-2.5 text-sm text-ink placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 font-semibold shadow-inner transition-all duration-200"
            />
            <div className="absolute right-2.5 flex items-center gap-1">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1.5 bg-slate-200 text-ink-soft hover:bg-slate-300 hover:text-slate-700 rounded-full transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsCameraScannerOpen(true)}
                className="p-1.5 text-brand-600 hover:bg-brand-100 rounded-xl transition"
                title="Escanear con Cámara"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-2 overflow-x-auto scrollbar-none py-0.5 flex-1 pr-2">
              {categoriesList.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-xs font-black  whitespace-nowrap transition-all duration-200 ${
                    selectedCategory === cat
                      ? 'bg-brand-600 text-white shadow-[0_4px_12px_rgba(5,150,105,0.3)] scale-105'
                      : 'bg-white text-ink-soft border border-slate-200 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200/50 shrink-0 shadow-inner">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400 hover:text-ink-soft'}`}
                title="Vista Cuadrícula Kiosk"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400 hover:text-ink-soft'}`}
                title="Vista Lista Rápida"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* TOAST FLOTANTE ANIMADO CUANDO SE AÑADE UN ÍTEM */}
        {recentlyAddedItem && (
          <div className="absolute top-36 left-4 right-4 z-40 bg-slate-900/90 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] border border-white/10 flex items-center justify-between animate-in slide-in-from-top-6 zoom-in-95 fade-in duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-500 to-brand-400 flex items-center justify-center animate-bounce text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]">
                <ShoppingCart className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="flex flex-col">
                <div className="text-xs font-black   flex items-center gap-1.5 text-brand-400">
                  <span>Añadido al Carrito</span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                </div>
                <div className="text-[13px] font-bold text-white truncate max-w-[180px] leading-tight">
                  {recentlyAddedItem.name}
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[13px] font-display font-black text-amber-300 bg-amber-400/10 px-2 py-1 rounded-lg">
                S/ {recentlyAddedItem.price.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Feedback de escaneo de pistola */}
        {lastScannedFeedback && (
          <div className={`mx-3 my-1.5 p-2 rounded-xl text-xs flex items-center gap-2 border animate-in slide-in-from-top duration-150 shadow-md ${
            lastScannedFeedback.error 
              ? 'bg-red-50 border-red-300 text-red-700' 
              : 'bg-brand-50 border-brand-300 text-brand-800'
          }`}>
            {lastScannedFeedback.error ? (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
            )}
            <span className="truncate font-bold">{lastScannedFeedback.text}</span>
          </div>
        )}

        {/* CATÁLOGO DE PRODUCTOS SCROLLABLE */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 bg-paper pb-28">
          {/* SECCIÓN DE PROMOCIONES DINÁMICAS (CARRUSEL O LISTA COMPLETA) */}
          {!searchQuery && promos.length > 0 && (activeScreenTab === 'ofertas' || selectedCategory === 'Todos') && (
            <div ref={carouselRef} className={activeScreenTab === 'ofertas' ? "flex flex-col gap-4" : "flex overflow-x-auto gap-3 snap-x snap-mandatory scrollbar-none pb-2 transition-all"}>
              {promos.map((promo) => (
                <div key={promo.id} className={`relative overflow-hidden rounded-2xl bg-tag text-ink shadow-[0_1px_0_rgba(31,42,48,0.08),0_12px_24px_-18px_rgba(31,42,48,0.6)] ${activeScreenTab === 'ofertas' ? 'w-full' : 'w-[85%] max-w-[340px] sm:w-[320px] snap-center shrink-0'}`}>
                  {/* Perforación de la etiqueta de precio */}
                  <span className="absolute right-4 top-4 h-3.5 w-3.5 rounded-full bg-paper ring-2 ring-ink/10" />
                  <div className="flex h-full flex-col justify-between p-4 pr-10">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                        <span>{promo.badgeText}</span>
                        {promo.tag && <span className="rounded-md bg-ink/10 px-1.5">{promo.tag}</span>}
                        {promo.discountBadge && <span className="rounded-md bg-fresa px-1.5 text-white">{promo.discountBadge}</span>}
                      </div>
                      <h3 className="mt-1.5 font-display text-lg font-bold leading-tight line-clamp-2">{promo.title}</h3>
                      <p className="mt-1 text-sm leading-snug text-ink/75 line-clamp-2">{promo.subtitle}</p>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold">{promo.savingText}</div>
                        <div className="text-sm text-ink/60 line-through">Antes S/ {promo.originalPrice.toFixed(2)}</div>
                        <div className="font-display text-[32px] font-bold leading-none [font-stretch:85%]">S/ {promo.offerPrice.toFixed(2)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { promo.associatedBarcodes.forEach(bc => handleScanBarcode(bc)); }}
                        className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-ink px-4 text-sm font-bold text-white transition active:scale-95"
                      >
                        <Plus className="h-4 w-4" /> Agregar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Indicador de Catálogo */}
          <div className="flex items-center justify-between text-xs text-ink-soft font-semibold px-1">
            <span>{plural(filteredProducts.length, 'producto')}</span>
            <span className="inline-flex items-center gap-1 text-xs text-brand-700 font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> Lector de códigos listo
            </span>
          </div>

          {/* GRILLA DE TARJETAS */}
          {viewMode === 'grid' ? (
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {filteredProducts.map((product) => {
                const minPrice = product.presentations.unit.price;

                return (
                  <div
                    key={product.id}
                    onClick={() => handleProductCardClick(product)}
                    className="bg-white rounded-[20px] overflow-hidden border border-slate-200 shadow-sm cursor-pointer flex flex-col justify-between group active:scale-[0.98]"
                  >
                    {/* Cuerpo de la tarjeta */}
                    <div className="p-3 space-y-3 flex-1 flex flex-col justify-between">
                      <div>
                        <div
                          className="h-28 w-full rounded-2xl border border-slate-200/70 shadow-inner flex flex-col items-center justify-center p-2 relative"
                          style={{ background: `radial-gradient(circle at 30% 25%, ${product.accentColor}33, ${product.accentColor}0d 60%, #f8fafc)` }}
                        >
                          <span className="absolute left-2 top-2 text-xs font-bold text-ink-soft">{product.category}</span>
                          {product.isPromo && <span className="absolute right-2 top-2 rounded-md bg-tag px-1.5 py-0.5 text-xs font-bold text-ink">Oferta</span>}
                          <div className="text-5xl filter drop-shadow-xl mb-1">
                            {product.category === 'Bebidas' ? '🥤' :
                             product.category === 'Chocolates' ? '🍫' :
                             product.category === 'Galletas' ? '🍪' :
                             product.category === 'Snacks' ? '🍿' : '🍬'}
                          </div>
                          <span className="absolute bottom-2 bg-white/90 backdrop-blur-xs border border-white shadow-xs px-2.5 py-0.5 rounded-full text-xs font-black  text-slate-700 ">
                            {product.packagingType}
                          </span>
                        </div>

                        <div className="mt-2 text-center">
                          <h4 className="text-xs font-black text-ink leading-tight line-clamp-2">
                            {product.name}
                          </h4>
                          {product.flavorNote && (
                            <p className="text-xs text-ink-soft line-clamp-1 mt-0.5">
                              {product.flavorNote}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-center gap-1 text-xs font-bold text-ink-soft mb-2">
                          <span className="border border-slate-200 rounded px-1.5 py-0.5">Unidad</span>
                          <span className="text-slate-300">|</span>
                          <span className="text-slate-400">Paq x{product.piecesPerPack}</span>
                        </div>

                        <div className="flex items-center justify-between gap-1 bg-gradient-to-r from-brand-50/50 to-brand-50/50 rounded-2xl px-3 py-2 border border-brand-100/60 shadow-inner">
                          <div className="flex flex-col">
                            <span className="text-xs text-brand-700 font-black  ">Precio</span>
                            <span className="text-brand-950 text-sm font-black tracking-tight font-display">
                              S/ {minPrice.toFixed(2)}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => handleQuickAddUnit(e, product)}
                            className="w-9 h-9 bg-brand-600 hover:bg-brand-500 text-white rounded-xl flex items-center justify-center font-black active:scale-90 transition-all duration-200 shadow-[0_4px_12px_rgba(5,150,105,0.4)] cursor-pointer group-hover:scale-110"
                            title="Añadir 1 Unidad al Carrito"
                          >
                            <Plus className="w-5 h-5 stroke-[3]" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* VISTA LISTA RÁPIDA */
            <div className="space-y-2">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => handleProductCardClick(product)}
                  className="bg-white rounded-xl p-2.5 border border-slate-200 shadow-2xs hover:border-brand-600 transition cursor-pointer flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 font-bold flex items-center justify-center text-lg shrink-0">
                      {product.category === 'Bebidas' ? '🥤' :
                       product.category === 'Chocolates' ? '🍫' :
                       product.category === 'Galletas' ? '🍪' :
                       product.category === 'Snacks' ? '🍿' : '🍬'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs text-slate-400 font-display">{product.barcode}</div>
                      <h4 className="text-xs font-bold text-ink truncate">{product.name}</h4>
                      <div className="text-xs text-ink-soft">
                        Stock: {product.stockInBaseUnits} {product.baseUnitName}s {product.presentations.pack ? `· Paq: S/ ${product.presentations.pack.price.toFixed(2)}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="bg-[#ea580c] text-white px-2 py-0.5 rounded-md text-xs font-black block">
                      DESDE S/ {product.presentations.unit.price.toFixed(2)}
                    </span>
                    <span className="text-xs text-brand-600 font-bold mt-0.5 block">
                      Elegir pres. ↗
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* EL CARRITO UBICADO ABAJO (ZONA ERGONÓMICA DE PULGAR) CON ANIMACIÓN */}
        {/* ========================================================================= */}
        <div className="absolute bottom-0 left-0 right-0 z-30 bg-white/80 backdrop-blur-xl shadow-[0_-15px_40px_rgba(0,0,0,0.08)] border-t border-white/60">
          <div 
            onClick={() => setIsCartDrawerOpen(true)}
            className={`p-4 pb-6 flex items-center justify-between gap-3 cursor-pointer transition-all duration-300 ${
              isCartBouncing ? 'scale-[1.02] bg-brand-50/80' : 'hover:bg-slate-50/80'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="relative w-12 h-12 bg-gradient-to-tr from-brand-100 to-brand-50 text-brand-600 rounded-2xl flex items-center justify-center shadow-inner border border-brand-200/50">
                <ShoppingCart className={`w-5 h-5 ${isCartBouncing ? 'animate-bounce text-brand-500' : ''}`} />
                <span className="absolute -top-1.5 -right-1.5 bg-slate-800 text-white font-black text-xs w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm transition-transform duration-300">
                  {cart.length}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-sm font-black text-ink leading-tight">
                  {cart.length === 0 ? 'Carrito vacío' : plural(cart.length, 'producto')}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full shadow-xs ${cart.length === 0 ? 'bg-slate-300' : 'bg-brand-500 animate-pulse'}`} />
                  <span className="text-xs text-ink-soft font-bold">
                    {cart.length === 0 ? 'Toque o escanee para añadir' : plural(totalBaseUnits, 'unidad', 'unidades')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-xs font-black  text-slate-400 ">
                  Total
                </span>
                <span className="text-lg font-black text-ink font-display leading-none tracking-tight whitespace-nowrap">
                  S/ {totalAmount.toFixed(2)}
                </span>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCartDrawerOpen(true);
                }}
                className="px-4 py-3.5 bg-gradient-to-r from-brand-500 to-brand-500 hover:from-brand-400 hover:to-brand-400 text-white font-black text-xs   rounded-2xl shadow-[0_8px_20px_rgba(16,185,129,0.3)] transition-all active:scale-95 flex items-center gap-1.5 border border-brand-400/30"
              >
                <span>Ver Pedido</span>
                <span className="text-xs font-bold">❯</span>
              </button>
            </div>
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
              className="w-full bg-white rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl p-4 animate-in slide-in-from-bottom duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle bar superior */}
              <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-2" />

              {/* Header del carrito */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
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
                    className="h-10 w-10 flex items-center justify-center rounded-full text-ink-soft hover:text-ink bg-slate-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Lista de productos en el carrito */}
              <div className="flex-1 overflow-y-auto space-y-2 py-1 pr-1 max-h-[46vh]">
                {cart.map((item) => {
                  const pres = item.product.presentations[item.selectedPresentation]!;
                  return (
                    <div
                      key={item.cartItemId}
                      onClick={() => {
                        setSelectedCartItem(item);
                        setIsBottomSheetOpen(true);
                      }}
                      className="bg-slate-50 rounded-2xl p-3 border border-slate-200 hover:border-brand-600 transition cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black  px-2 py-0.5 rounded bg-brand-100 text-brand-800">
                              {pres.shortLabel}
                            </span>
                            <span className="text-xs text-slate-400 font-display">
                              {item.product.barcode}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-ink mt-1 truncate">
                            {item.product.name}
                          </h4>
                          <div className="text-xs text-ink-soft mt-0.5">
                            Cant: <strong className="text-ink">{item.quantity}</strong> × S/ {item.unitPrice.toFixed(2)}
                            {editedPrice(item) !== undefined && (
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
                            className="mt-1 h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 pt-1 border-t border-slate-200 text-xs text-brand-700 font-bold flex justify-between">
                        <span>Cambiar presentación, cantidad o precio</span>
                        <span>Editar ›</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Configuración de Preventa: Bodega / Cliente, Condición y Descuento Mayorista */}
              <div className="pt-2 border-t border-slate-200 space-y-2 mt-1">
                {/* Selector de Cliente / Bodega */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1 text-ink">
                      <UserCheck className="w-3.5 h-3.5 text-brand-600" />
                      <span>Cliente / Bodega:</span>
                    </span>
                    {selectedCustomer?.route && (
                      <span className="text-xs text-brand-800 bg-brand-100 px-1.5 py-0.2 rounded font-semibold">
                        {selectedCustomer.route}
                      </span>
                    )}
                  </div>

                  <CustomerPicker
                    customers={customers}
                    selected={selectedCustomer}
                    onSelect={setSelectedCustomer}
                    walkInName={walkInName}
                    onWalkInNameChange={setWalkInName}
                    allowWalkIn={!requiresCustomer(paymentTerm)}
                  />

                  {/* Condición de Pago & Descuento en 2 columnas */}
                  <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                    <div>
                      <span className="text-xs text-ink-soft font-bold block mb-0.5">Condición:</span>
                      <select
                        value={paymentTerm}
                        onChange={(e) => setPaymentTerm(e.target.value as PaymentTerm)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-1 text-xs font-bold text-ink"
                      >
                        {PAYMENT_TERMS.map(term => <option key={term} value={term}>{term}</option>)}
                      </select>
                    </div>

                    <div>
                      <span className="text-xs text-ink-soft font-bold block mb-0.5">Dscto Mayorista:</span>
                      <div className="flex gap-1">
                        {[0, 3, 5, 10].filter(pct => pct <= maxDiscount).map(pct => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setDiscountPercent(pct)}
                            className={`flex-1 py-1 rounded text-xs font-black transition ${
                              discountPercent === pct 
                                ? 'bg-brand-600 text-white shadow-2xs' 
                                : 'bg-white text-ink-soft border border-slate-200'
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Registro rápido de Envases Retornables */}
                <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🍾</span>
                    <div>
                      <span className="text-xs font-bold text-amber-900 block">Envases Devueltos</span>
                      <span className="text-xs text-amber-700 leading-tight block">Si el cliente deja botellas<br/>o cajas vacías, anótalas aquí.</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-amber-300">
                    <button
                      type="button"
                      onClick={() => setReturnedContainers(Math.max(0, returnedContainers - 1))}
                      className="w-7 h-7 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-black text-lg flex items-center justify-center transition cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={returnedContainers || ''}
                      onChange={(e) => setReturnedContainers(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-10 text-center font-black text-amber-900 text-base focus:outline-hidden bg-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setReturnedContainers(returnedContainers + 1)}
                      className="w-7 h-7 bg-amber-500 hover:bg-amber-600 text-white rounded font-black text-lg flex items-center justify-center transition cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Resumen de totales */}
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 space-y-1">
                  {discountPercent > 0 && (
                    <div className="flex items-center justify-between text-xs text-ink-soft font-medium px-1">
                      <span>Subtotal bruto:</span>
                      <span className="font-display">S/ {grossTotal.toFixed(2)}</span>
                    </div>
                  )}

                  {discountPercent > 0 && (
                    <div className="flex items-center justify-between text-xs text-brand-700 font-bold px-1">
                      <span>Descuento aplicado ({discountPercent}%):</span>
                      <span className="font-display">- S/ {discountAmount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between px-1 pt-0.5">
                    <div>
                      <span className="text-xs font-bold text-ink-soft ">Total Pre-Venta:</span>
                      <div className="text-xs text-slate-400">
                        {paymentTerm === 'Contado' ? 'Cobrado por el vendedor' : paymentTerm === 'Fiado (Libreta)' ? 'Queda como deuda del cliente' : 'Pendiente de pago en caja'}
                      </div>
                    </div>
                    <div className="text-2xl font-black text-ink font-display">
                      S/ {totalAmount.toFixed(2)}
                    </div>
                  </div>
                </div>

                {replacingOrderId && (
                  <div className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg p-2">
                    Modificando un ticket anulado: el nuevo ticket quedará enlazado al anterior.
                  </div>
                )}
                {!online && (
                  <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center gap-1.5">
                    <CloudOff className="w-3.5 h-3.5 shrink-0" />
                    Sin internet: el ticket se guarda en el celular y se envía al reconectar.
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void handleGeneratePreSale()}
                  disabled={isSubmitting}
                  className="w-full disabled:opacity-60 py-3.5 px-4 bg-brand-600 hover:bg-brand-700 text-white font-black text-sm   rounded-xl shadow-lg shadow-brand-700/30 transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Barcode className="w-4 h-4 stroke-[2.5]" />
                  <span>Emitir ticket</span>
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
          onDetected={code => handleScanBarcode(code)}
          kind="barcode"
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
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
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
                  className="p-1 rounded-full text-slate-400 hover:text-slate-700 bg-slate-100"
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
                  <div className="p-6 text-center text-slate-400 space-y-2">
                    <Clock className="w-8 h-8 mx-auto text-slate-300" />
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
                      className="p-3 bg-slate-50 rounded-2xl border border-slate-200 hover:border-brand-600 transition cursor-pointer flex items-center justify-between gap-2"
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
                        <div className="text-xs text-slate-400">
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
