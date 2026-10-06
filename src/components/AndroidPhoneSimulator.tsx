import React from 'react';
import { CartItem, PresentationType, Order } from '../types/pos';
import { ExtendedProduct } from '../data/mockProducts';
import { BottomSheetPresentation } from './BottomSheetPresentation';
import { TicketModal } from './TicketModal';
import { BarcodeScannerListener } from '../utils/scannerListener';
import { 
  playBarcodeBeep, 
  playSuccessChime, 
  isScannerSoundActive, 
  setScannerSoundEnabled 
} from '../utils/audioBeep';
import { 
  Barcode, 
  Bluetooth, 
  Wifi, 
  WifiOff, 
  Battery, 
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
  Monitor, 
  Smartphone, 
  Lock, 
  ChevronRight, 
  ChevronUp,
  Package, 
  ShieldCheck, 
  Sparkles,
  ArrowRight,
  TrendingUp,
  Volume2,
  VolumeX,
  Camera,
  History,
  Receipt,
  Percent,
  UserCheck
} from 'lucide-react';

interface Props {
  products: ExtendedProduct[];
  orders?: Order[];
  onOrderCreated?: (order: Order) => void;
  onOpenAdmin?: () => void;
  onGoToCashier?: (orderId: string) => void;
}

export const AndroidPhoneSimulator: React.FC<Props> = ({ 
  products,
  orders = [],
  onOrderCreated,
  onOpenAdmin,
  onGoToCashier
}) => {
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [selectedCartItem, setSelectedCartItem] = React.useState<CartItem | null>(null);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = React.useState<boolean>(false);
  const [activeOrder, setActiveOrder] = React.useState<Order | null>(null);
  const [isTicketModalOpen, setIsTicketModalOpen] = React.useState<boolean>(false);
  const [orderCounter, setOrderCounter] = React.useState<number>(892);
  const [isOnline, setIsOnline] = React.useState<boolean>(true);
  const [pendingSyncCount, setPendingSyncCount] = React.useState<number>(0);
  const [lastScannedFeedback, setLastScannedFeedback] = React.useState<{ text: string; error?: boolean } | null>(null);
  
  // Modos de visualización y Drawer
  const [deviceMode, setDeviceMode] = React.useState<'mobile' | 'kiosk'>('mobile');
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

  // Cliente, Ruta y Condiciones de Preventa
  const [selectedCustomer, setSelectedCustomer] = React.useState<{ name: string; ruc?: string; route: string }>({
    name: 'Bodega San Martín',
    ruc: '10458921821',
    route: 'Ruta 1 - Centro',
  });
  const [paymentTerm, setPaymentTerm] = React.useState<'Contado' | 'Crédito 7 días' | 'Crédito 15 días'>('Contado');
  const [discountPercent, setDiscountPercent] = React.useState<number>(0);

  const customersList = [
    { name: 'Bodega San Martín', ruc: '10458921821', route: 'Ruta 1 - Centro' },
    { name: 'Minimarket El Trébol', ruc: '20601234567', route: 'Ruta 2 - Norte' },
    { name: 'Kiosko Escolar María', ruc: '', route: 'Ruta 3 - Colegios' },
    { name: 'Licorería & Snacks 24H', ruc: '10789123456', route: 'Ruta 1 - Centro' },
    { name: 'Cliente Ocasional / Mostrador', ruc: '', route: 'Directo' },
  ];

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

  // Configuración del listener global de pistola de código de barras (HID)
  React.useEffect(() => {
    const scanner = new BarcodeScannerListener({
      maxIntervalMs: 65,
      minBarcodeLength: 3,
      onScan: (barcode) => {
        handleScanBarcode(barcode);
      },
    });

    scanner.start();
    return () => {
      scanner.stop();
    };
  }, [products, cart]);

  const handleScanBarcode = (barcode: string) => {
    const cleanBarcode = barcode.trim();
    const product = products.find(p => p.barcode === cleanBarcode);

    if (!product) {
      setLastScannedFeedback({ text: `Código no registrado: ${cleanBarcode}`, error: true });
      setTimeout(() => setLastScannedFeedback(null), 3000);
      return;
    }

    playBarcodeBeep();

    setCart(prevCart => {
      const existingIdx = prevCart.findIndex(
        item => item.product.id === product.id && item.selectedPresentation === 'unit'
      );

      if (existingIdx >= 0) {
        const item = prevCart[existingIdx];
        const newQty = item.quantity + 1;
        const newDeducted = newQty * item.product.presentations.unit.conversionFactor;

        if (newDeducted > product.stockInBaseUnits) {
          setLastScannedFeedback({ 
            text: `Stock límite alcanzado para ${product.name}`, 
            error: true 
          });
          setTimeout(() => setLastScannedFeedback(null), 3000);
          return prevCart;
        }

        const updated = [...prevCart];
        updated[existingIdx] = {
          ...item,
          quantity: newQty,
          subtotal: newQty * item.unitPrice,
          deductedBaseUnits: newDeducted,
        };
        triggerCartAnimation(product.name, item.unitPrice);
        return updated;
      } else {
        const unitPres = product.presentations.unit;
        const newItem: CartItem = {
          cartItemId: `cart_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          product,
          selectedPresentation: 'unit',
          quantity: 1,
          unitPrice: unitPres.price,
          subtotal: unitPres.price,
          deductedBaseUnits: unitPres.conversionFactor,
        };
        triggerCartAnimation(product.name, unitPres.price);
        return [newItem, ...prevCart];
      }
    });

    setLastScannedFeedback({ text: `✓ ${product.name} (1 UND)`, error: false });
    setTimeout(() => setLastScannedFeedback(null), 2500);
  };

  const handleProductCardClick = (product: ExtendedProduct) => {
    const existing = cart.find(i => i.product.id === product.id);
    if (existing) {
      setSelectedCartItem(existing);
    } else {
      const unitPres = product.presentations.unit;
      const tempItem: CartItem = {
        cartItemId: `cart_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        product,
        selectedPresentation: 'unit',
        quantity: 1,
        unitPrice: unitPres.price,
        subtotal: unitPres.price,
        deductedBaseUnits: unitPres.conversionFactor,
      };
      setCart(prev => [tempItem, ...prev]);
      setSelectedCartItem(tempItem);
      triggerCartAnimation(product.name, unitPres.price);
    }
    setIsBottomSheetOpen(true);
  };

  // Botón directo rápido "+" en la tarjeta
  const handleQuickAddUnit = (e: React.MouseEvent, product: ExtendedProduct) => {
    e.stopPropagation();
    handleScanBarcode(product.barcode);
  };

  const handleUpdatePresentation = (cartItemId: string, presentation: PresentationType, quantity: number) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.cartItemId === cartItemId) {
          const presInfo = item.product.presentations[presentation];
          return {
            ...item,
            selectedPresentation: presentation,
            quantity,
            unitPrice: presInfo.price,
            subtotal: quantity * presInfo.price,
            deductedBaseUnits: quantity * presInfo.conversionFactor,
          };
        }
        return item;
      });
    });
    setIsCartBouncing(true);
    setTimeout(() => setIsCartBouncing(false), 500);
  };

  const handleRemoveItem = (cartItemId: string) => {
    setCart(prev => prev.filter(i => i.cartItemId !== cartItemId));
  };

  const handleClearCart = () => {
    setCart([]);
    setIsCartDrawerOpen(false);
  };

  const grossTotal = cart.reduce((acc, item) => acc + item.subtotal, 0);
  const discountAmount = grossTotal * (discountPercent / 100);
  const totalAmount = Math.max(0, grossTotal - discountAmount);
  const totalBaseUnits = cart.reduce((acc, item) => acc + item.deductedBaseUnits, 0);

  const handleGeneratePreSale = () => {
    if (cart.length === 0) return;

    playSuccessChime();

    const currentId = `PED-${String(orderCounter).padStart(5, '0')}`;
    setOrderCounter(prev => prev + 1);

    const order: Order = {
      id: currentId,
      createdAt: new Date().toISOString(),
      sellerId: 'VEND-012',
      sellerName: 'Carlos Mendoza',
      customerName: selectedCustomer.name,
      customerRuc: selectedCustomer.ruc,
      paymentTerm,
      discountAmount,
      status: 'PENDIENTE_PAGO',
      items: cart.map(i => ({
        productId: i.product.id,
        productName: i.product.name,
        presentationType: i.selectedPresentation,
        presentationLabel: i.product.presentations[i.selectedPresentation].label,
        conversionFactor: i.product.presentations[i.selectedPresentation].conversionFactor,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        subtotal: i.subtotal,
        baseUnitsDeducted: i.deductedBaseUnits,
      })),
      totalAmount,
      totalBaseUnits,
      syncStatus: isOnline ? 'synced' : 'pending_sync',
      qrPayload: currentId,
    };

    if (!isOnline) {
      setPendingSyncCount(prev => prev + 1);
    }

    setActiveOrder(order);
    setIsTicketModalOpen(true);
    setIsCartDrawerOpen(false);
    setCart([]);
    if (onOrderCreated) {
      onOrderCreated(order);
    }
  };

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

  const categoriesList = ['Todos', 'Bebidas', 'Chocolates', 'Galletas', 'Golosinas', 'Snacks'];

  return (
    <div className="w-full flex flex-col items-center">
      {/* Selector de Modo de Dispositivo: Móvil Android vs Pantalla Kiosk SAT (Foto) */}
      <div className="flex items-center gap-2 mb-3 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs font-bold">
        <button
          type="button"
          onClick={() => setDeviceMode('mobile')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
            deviceMode === 'mobile' 
              ? 'bg-[#16a34a] text-white shadow-xs' 
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Móvil Android (1 Mano)</span>
        </button>
        <button
          type="button"
          onClick={() => setDeviceMode('kiosk')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
            deviceMode === 'kiosk' 
              ? 'bg-[#16a34a] text-white shadow-xs' 
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Monitor className="w-3.5 h-3.5" />
          <span>Terminal Kiosk / SAT (Foto)</span>
        </button>
      </div>

      {/* DISPOSITIVO */}
      <div className={`relative bg-white shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden select-none border transition-all duration-300 ${
        deviceMode === 'mobile'
          ? 'w-full max-w-[420px] h-[820px] rounded-[44px] border-8 border-zinc-900'
          : 'w-full max-w-[760px] h-[640px] rounded-[24px] border-[14px] border-zinc-950 ring-2 ring-zinc-800'
      }`}>
        {/* Notch móvil */}
        {deviceMode === 'mobile' ? (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-4 bg-zinc-900 rounded-full z-40 flex items-center justify-center">
            <div className="w-2.5 h-2.5 bg-zinc-800 rounded-full border border-zinc-700" />
          </div>
        ) : null}

        {/* Barra de Estado Android */}
        <div className="pt-2 px-5 pb-1 flex items-center justify-between text-[11px] font-semibold text-white bg-[#15803d] z-30">
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3 text-white/90" />
            <span>10:45 AM</span>
            <span className="hidden sm:inline text-white/70">· Preventista</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] text-emerald-950 bg-white/90 px-2 py-0.2 rounded-full font-bold">
              <Bluetooth className="w-2.5 h-2.5 text-emerald-800" />
              <span>Lector HID + 58mm</span>
            </span>
            <button 
              type="button"
              onClick={handleToggleSound} 
              className="flex items-center text-white/90 hover:text-white"
              title={soundEnabled ? 'Sonido Bip Láser Activo (Click para silenciar)' : 'Sonido Silenciado (Click para activar)'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-amber-200" /> : <VolumeX className="w-3.5 h-3.5 text-white/50" />}
            </button>
            <button 
              type="button"
              onClick={() => setIsOnline(!isOnline)} 
              className="flex items-center text-white"
              title={isOnline ? 'Online (Servidor Central)' : 'Offline (SQLite)'}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5 text-red-200" />}
            </button>
            <div className="flex items-center gap-0.5">
              <span className="text-[10px] font-bold">99%</span>
              <Battery className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* HEADER LIMPIO: Botón ☰, CATÁLOGO, OFERTAS, CÁMARA, MIS PEDIDOS y ADMIN */}
        <div className="bg-[#16a34a] text-white px-3 md:px-4 py-2 flex items-center justify-between shadow-md z-30">
          <div className="flex items-center gap-2 md:gap-3">
            <button 
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition active:scale-95 text-white cursor-pointer"
              title="Abrir menú"
            >
              <Menu className="w-5 h-5 stroke-[2.5]" />
            </button>

            {/* Pestañas CATÁLOGO y OFERTAS */}
            <div className="flex items-center gap-1.5 font-black tracking-wider text-xs md:text-sm uppercase">
              <button
                type="button"
                onClick={() => setActiveScreenTab('catalogo')}
                className={`px-3 py-1 rounded-md transition ${
                  activeScreenTab === 'catalogo' 
                    ? 'bg-white/20 text-white font-black underline decoration-2 underline-offset-4 shadow-2xs' 
                    : 'text-white/80 hover:text-white'
                }`}
              >
                CATÁLOGO
              </button>
              <button
                type="button"
                onClick={() => setActiveScreenTab('ofertas')}
                className={`px-3 py-1 rounded-md transition flex items-center gap-1 ${
                  activeScreenTab === 'ofertas' 
                    ? 'bg-white/20 text-white font-black underline decoration-2 underline-offset-4 shadow-2xs' 
                    : 'text-white/80 hover:text-white'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-amber-300" />
                <span>OFERTAS</span>
              </button>
            </div>
          </div>

          {/* Acciones de la barra superior: Escáner Cámara, Mis Preventas y Admin */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsCameraScannerOpen(true)}
              className="p-1.5 bg-black/20 hover:bg-black/35 text-white rounded-lg transition active:scale-95 border border-white/20 flex items-center gap-1 cursor-pointer"
              title="Simulador de Escaneo por Cámara / Láser"
            >
              <Camera className="w-4 h-4 text-emerald-200" />
              <span className="hidden sm:inline text-[10px] font-black uppercase">CÁMARA</span>
            </button>

            <button
              type="button"
              onClick={() => setIsOrderHistoryOpen(true)}
              className="p-1.5 bg-black/20 hover:bg-black/35 text-white rounded-lg transition active:scale-95 border border-white/20 relative flex items-center gap-1 cursor-pointer"
              title="Mis Preventas de Hoy"
            >
              <Receipt className="w-4 h-4 text-amber-300" />
              {orders.length > 0 && (
                <span className="bg-[#ea580c] text-white font-black text-[9px] px-1 rounded-full border border-white/40">
                  {orders.length}
                </span>
              )}
            </button>

            {onOpenAdmin && (
              <button
                type="button"
                onClick={onOpenAdmin}
                className="px-2.5 py-1.5 bg-black/25 hover:bg-black/40 text-white font-black text-xs rounded-lg transition flex items-center gap-1 border border-white/20 cursor-pointer"
                title="Panel de Administrador (Login & Catálogo)"
              >
                <Lock className="w-3.5 h-3.5 text-amber-300" />
                <span>ADMIN</span>
              </button>
            )}
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
                      <h3 className="font-black text-sm text-slate-900 leading-tight">DULCES & BEBIDAS</h3>
                      <p className="text-[10px] text-slate-400">Distribuidora & Pre-Venta</p>
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
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-50 text-slate-900 hover:text-emerald-800 transition"
                  >
                    <span className="flex items-center gap-2.5">
                      <Package className="w-4 h-4 text-[#16a34a]" />
                      <span>Catálogo de Productos</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{products.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveScreenTab('ofertas');
                      setIsDrawerOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-50 text-slate-900 hover:text-emerald-800 transition"
                  >
                    <span className="flex items-center gap-2.5">
                      <Flame className="w-4 h-4 text-amber-500" />
                      <span>Promociones Destacadas</span>
                    </span>
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-black">TOP</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsDrawerOpen(false);
                      setIsCartDrawerOpen(true);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-50 text-slate-900 hover:text-emerald-800 transition"
                  >
                    <span className="flex items-center gap-2.5">
                      <ShoppingCart className="w-4 h-4 text-emerald-600" />
                      <span>Ver Carrito Abajo</span>
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-black">{cart.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsDrawerOpen(false);
                      setIsOrderHistoryOpen(true);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-50 text-slate-900 hover:text-emerald-800 transition"
                  >
                    <span className="flex items-center gap-2.5">
                      <Receipt className="w-4 h-4 text-amber-500" />
                      <span>Mis Preventas de Hoy</span>
                    </span>
                    <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-black">{orders.length}</span>
                  </button>

                  <div className="my-2 border-t border-slate-200" />

                  <button
                    type="button"
                    onClick={() => {
                      setIsDrawerOpen(false);
                      if (onOpenAdmin) onOpenAdmin();
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition"
                  >
                    <span className="flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-amber-400" />
                      <span>Panel Administrador</span>
                    </span>
                    <span className="text-[10px] bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded font-black uppercase">
                      LOGIN
                    </span>
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3 text-[11px] text-slate-400">
                <div>POS Pre-Venta Android · Versión 2.5</div>
              </div>
            </div>
          </div>
        )}

        {/* BÚSQUEDA Y FILTRADO POTENTE PARA CIENTOS DE PRODUCTOS */}
        <div className="bg-slate-100 p-2.5 md:p-3 border-b border-slate-200 space-y-2 z-20">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar entre cientos de golosinas y bebidas..."
              className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-16 py-2 text-xs md:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#16a34a] focus:ring-1 focus:ring-[#16a34a] font-medium shadow-xs"
            />
            <div className="absolute right-2.5 flex items-center gap-1">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsCameraScannerOpen(true)}
                className="p-1 text-[#16a34a] hover:bg-emerald-50 rounded transition"
                title="Escanear con Cámara / Simulador"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none py-0.5 flex-1">
              {categoriesList.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold uppercase whitespace-nowrap transition ${
                    selectedCategory === cat
                      ? 'bg-[#16a34a] text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-[#16a34a] text-white' : 'text-slate-400'}`}
                title="Vista Cuadrícula Kiosk"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-[#16a34a] text-white' : 'text-slate-400'}`}
                title="Vista Lista Rápida"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* TOAST FLOTANTE ANIMADO CUANDO SE AÑADE UN ÍTEM */}
        {recentlyAddedItem && (
          <div className="absolute top-28 left-4 right-4 z-40 bg-slate-900 text-white p-3 rounded-2xl shadow-2xl border-2 border-[#16a34a] flex items-center justify-between animate-in slide-in-from-top-4 zoom-in-95 duration-200">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#16a34a] flex items-center justify-center animate-bounce text-white">
                <ShoppingCart className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <div className="text-xs font-black flex items-center gap-1.5">
                  <span className="text-emerald-400 font-bold">+1 Agregado al Carrito</span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                </div>
                <div className="text-xs font-bold text-white truncate max-w-[200px]">
                  {recentlyAddedItem.name}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-black text-amber-300">
                S/ {recentlyAddedItem.price.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Feedback de escaneo de pistola */}
        {lastScannedFeedback && (
          <div className={`mx-3 my-1.5 p-2 rounded-xl text-xs flex items-center gap-2 border animate-in slide-in-from-top duration-150 shadow-md ${
            lastScannedFeedback.error 
              ? 'bg-red-50 border-red-300 text-red-700' 
              : 'bg-emerald-50 border-emerald-300 text-emerald-800'
          }`}>
            {lastScannedFeedback.error ? (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span className="truncate font-bold">{lastScannedFeedback.text}</span>
          </div>
        )}

        {/* CATÁLOGO DE PRODUCTOS SCROLLABLE */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 bg-slate-50 pb-28">
          {/* PROMOCIÓN DESTACADA MAYORISTA */}
          {!searchQuery && selectedCategory === 'Todos' && (
            <div className="relative rounded-2xl overflow-hidden shadow-lg border border-slate-800 bg-slate-950 text-white">
              <div className="p-4 md:p-5 relative z-10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black tracking-widest uppercase bg-[#16a34a] text-white px-2.5 py-0.5 rounded-md">
                    PROMOCIÓN DESTACADA
                  </span>
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-600/40">
                    OFERTA MAYORISTA
                  </span>
                </div>

                <h3 className="text-base md:text-xl font-black leading-tight text-white">
                  COMBO INKA KOLA 500ML (12u) + CHOCOLATE SUBLIME (24u)
                </h3>
                <p className="text-xs text-slate-300">
                  Gaseosa helada + display completo de chocolate con maní.
                </p>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">PRECIO ESPECIAL</span>
                    <span className="text-xl md:text-2xl font-black text-amber-400 font-mono">S/ 62.00</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      handleScanBarcode('7750182001011');
                      handleScanBarcode('7750885002012');
                    }}
                    className="px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>AÑADIR COMBO</span>
                  </button>
                </div>
              </div>

              <div className="absolute inset-0 bg-gradient-to-r from-black via-zinc-900/90 to-emerald-950/40 pointer-events-none" />
            </div>
          )}

          {/* Indicador de Catálogo */}
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
            <span>{filteredProducts.length} productos en exhibición</span>
            <span className="text-[11px] text-emerald-700 font-bold">
              Escaneo HID activo en segundo plano
            </span>
          </div>

          {/* GRILLA DE TARJETAS */}
          {viewMode === 'grid' ? (
            <div className={`grid gap-3 ${deviceMode === 'mobile' ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {filteredProducts.map((product) => {
                const minPrice = product.presentations.unit.price;

                return (
                  <div
                    key={product.id}
                    onClick={() => handleProductCardClick(product)}
                    className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-xs hover:shadow-md hover:border-[#16a34a] transition-all cursor-pointer flex flex-col justify-between group active:scale-[0.98]"
                  >
                    {/* Cintillo de Categoría Verde */}
                    <div className="bg-[#16a34a] text-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider flex items-center justify-between">
                      <span className="truncate">{product.category}</span>
                      {product.isPromo && (
                        <span className="bg-amber-400 text-slate-950 text-[9px] px-1 rounded font-black">
                          OFERTA
                        </span>
                      )}
                    </div>

                    {/* Cuerpo de la tarjeta */}
                    <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="h-16 w-full rounded-xl bg-slate-100 flex items-center justify-center p-2 mb-2 relative overflow-hidden group-hover:scale-105 transition-transform">
                          <div className="text-3xl filter drop-shadow">
                            {product.category === 'Bebidas' ? '🥤' :
                             product.category === 'Chocolates' ? '🍫' :
                             product.category === 'Galletas' ? '🍪' :
                             product.category === 'Snacks' ? '🍿' : '🍬'}
                          </div>
                          <span className="absolute bottom-1 right-1.5 text-[9px] font-bold text-slate-500 bg-white/90 px-1 rounded">
                            {product.packagingType}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 leading-tight line-clamp-2">
                          {product.name}
                        </h4>

                        {product.flavorNote && (
                          <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                            {product.flavorNote}
                          </p>
                        )}
                      </div>

                      {/* Pastilla "DESDE S/..." y Botón "+" con animación */}
                      <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold mb-1">
                          <span>Unidad</span>
                          <span className="text-emerald-700">Paq x{product.piecesPerPack}</span>
                        </div>

                        <div className="flex items-center justify-between gap-1">
                          <span className="bg-[#ea580c] text-white px-2 py-0.5 rounded-lg text-xs font-black tracking-tight shadow-xs">
                            DESDE S/ {minPrice.toFixed(2)}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => handleQuickAddUnit(e, product)}
                            className="w-7 h-7 bg-[#16a34a] hover:bg-[#15803d] text-white rounded-lg flex items-center justify-center font-black active:scale-90 transition shadow-xs cursor-pointer group-hover:ring-2 group-hover:ring-emerald-300"
                            title="Añadir 1 Unidad al Carrito"
                          >
                            <Plus className="w-4 h-4 stroke-[3]" />
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
                  className="bg-white rounded-xl p-2.5 border border-slate-200 shadow-2xs hover:border-[#16a34a] transition cursor-pointer flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center text-lg shrink-0">
                      {product.category === 'Bebidas' ? '🥤' :
                       product.category === 'Chocolates' ? '🍫' :
                       product.category === 'Galletas' ? '🍪' :
                       product.category === 'Snacks' ? '🍿' : '🍬'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] text-slate-400 font-mono">{product.barcode}</div>
                      <h4 className="text-xs font-bold text-slate-900 truncate">{product.name}</h4>
                      <div className="text-[10px] text-slate-500">
                        Stock: {product.stockInBaseUnits} {product.baseUnitName}s · Paq: S/ {product.presentations.pack.price.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="bg-[#ea580c] text-white px-2 py-0.5 rounded-md text-[11px] font-black block">
                      DESDE S/ {product.presentations.unit.price.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-[#16a34a] font-bold mt-0.5 block">
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
        <div className="absolute bottom-0 left-0 right-0 z-30">
          {cart.length === 0 ? (
            /* Barra inferior tranquila cuando el carrito está vacío */
            <div className="bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-slate-400" />
                <span className="font-semibold">Carrito vacío · Escanea con la pistola</span>
              </div>
              <span className="text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                Pistola HID lista
              </span>
            </div>
          ) : (
            /* DOCK FLOTANTE ANIMADO DEL CARRITO EN LA PARTE INFERIOR */
            <div 
              onClick={() => setIsCartDrawerOpen(true)}
              className={`mx-3 mb-3 p-3 bg-slate-900 text-white rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] border-2 border-[#16a34a] flex items-center justify-between gap-3 cursor-pointer transition-all duration-300 ${
                isCartBouncing 
                  ? 'scale-105 ring-4 ring-emerald-400 shadow-emerald-900/50 bg-slate-950' 
                  : 'hover:bg-slate-800 active:scale-98'
              }`}
            >
              {/* Ícono de carrito con insignia rebotante animada */}
              <div className="flex items-center gap-3">
                <div className={`relative p-2.5 rounded-xl bg-[#16a34a] text-white shadow-md transition-transform ${
                  isCartBouncing ? 'scale-125' : ''
                }`}>
                  <ShoppingCart className="w-5 h-5 stroke-[2.5]" />
                  {/* Badge contador animado */}
                  <span className={`absolute -top-1.5 -right-1.5 bg-[#dc2626] text-white font-black text-[10px] px-1.5 py-0.2 rounded-full border border-white shadow-xs ${
                    isCartBouncing ? 'animate-ping' : ''
                  }`}>
                    {cart.length}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-300">Total Pre-Venta:</span>
                    <span className="text-base font-black text-amber-400 font-mono">
                      S/ {totalAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <span>{cart.length} productos</span>
                    <span>·</span>
                    <span className="text-emerald-400 font-semibold">{totalBaseUnits} unds base</span>
                  </div>
                </div>
              </div>

              {/* Botón táctil para desplegar y emitir pedido */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCartDrawerOpen(true);
                }}
                className="px-3.5 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center gap-1.5 transition active:scale-95"
              >
                <span>VER PEDIDO</span>
                <ChevronUp className="w-4 h-4 stroke-[3]" />
              </button>
            </div>
          )}

          {/* LOGO SAT AL PIE (Modo Kiosk) */}
          {deviceMode === 'kiosk' && (
            <div className="bg-zinc-950 py-1 text-center text-[10px] font-black text-slate-400 tracking-widest flex items-center justify-center gap-1 border-t border-zinc-800">
              <span>GS</span>
              <span className="text-white font-bold">SAT</span>
              <span className="text-[9px] text-zinc-500 font-normal">POS TERMINAL</span>
            </div>
          )}
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
                  <div className="p-2 bg-emerald-100 text-[#16a34a] rounded-xl">
                    <ShoppingCart className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase">
                      Detalle de Pre-Venta ({cart.length} líneas)
                    </h3>
                    <p className="text-[10px] text-slate-500">
                      Total de inventario a descontar: <strong className="text-emerald-700">{totalBaseUnits}</strong> unidades base
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClearCart}
                    className="text-xs text-red-600 font-bold hover:underline flex items-center gap-1 p-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Vaciar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCartDrawerOpen(false)}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-700 bg-slate-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Lista de productos en el carrito */}
              <div className="flex-1 overflow-y-auto space-y-2 py-1 pr-1 max-h-[46vh]">
                {cart.map((item) => {
                  const pres = item.product.presentations[item.selectedPresentation];
                  return (
                    <div
                      key={item.cartItemId}
                      onClick={() => {
                        setSelectedCartItem(item);
                        setIsBottomSheetOpen(true);
                      }}
                      className="bg-slate-50 rounded-2xl p-3 border border-slate-200 hover:border-[#16a34a] transition cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              {pres.shortLabel}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {item.product.barcode}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-900 mt-1 truncate">
                            {item.product.name}
                          </h4>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Cant: <strong className="text-slate-800">{item.quantity}</strong> × S/ {item.unitPrice.toFixed(2)}
                            <span className="text-emerald-700 ml-1 font-semibold">
                              (Descuenta {item.deductedBaseUnits} unds base)
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-black text-slate-900 font-mono">
                            S/ {item.subtotal.toFixed(2)}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveItem(item.cartItemId);
                            }}
                            className="mt-2 text-slate-400 hover:text-red-600 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 pt-1 border-t border-slate-200 text-[10px] text-emerald-700 font-bold flex justify-between">
                        <span>Tocar para cambiar Unidad / Medio / Paquete</span>
                        <span>Editar ↗</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Configuración de Preventa: Bodega / Cliente, Condición y Descuento Mayorista */}
              <div className="pt-2 border-t border-slate-200 space-y-2 mt-1">
                {/* Selector de Cliente / Bodega */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                    <span className="flex items-center gap-1 text-slate-900">
                      <UserCheck className="w-3.5 h-3.5 text-[#16a34a]" />
                      <span>Cliente / Bodega:</span>
                    </span>
                    <span className="text-[10px] text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded font-semibold">
                      {selectedCustomer.route}
                    </span>
                  </div>

                  <select
                    value={selectedCustomer.name}
                    onChange={(e) => {
                      const found = customersList.find(c => c.name === e.target.value);
                      if (found) setSelectedCustomer(found);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-[#16a34a]"
                  >
                    {customersList.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name} {c.ruc ? `(RUC ${c.ruc})` : ''}
                      </option>
                    ))}
                  </select>

                  {/* Condición de Pago & Descuento en 2 columnas */}
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Condición:</span>
                      <select
                        value={paymentTerm}
                        onChange={(e) => setPaymentTerm(e.target.value as any)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-1 text-[11px] font-bold text-slate-800"
                      >
                        <option value="Contado">Contado</option>
                        <option value="Crédito 7 días">Crédito 7 días</option>
                        <option value="Crédito 15 días">Crédito 15 días</option>
                      </select>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block mb-0.5">Dscto Mayorista:</span>
                      <div className="flex gap-1">
                        {[0, 3, 5, 10].map(pct => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setDiscountPercent(pct)}
                            className={`flex-1 py-1 rounded text-[10px] font-black transition ${
                              discountPercent === pct 
                                ? 'bg-[#16a34a] text-white shadow-2xs' 
                                : 'bg-white text-slate-600 border border-slate-200'
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resumen de totales */}
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 space-y-1">
                  {discountPercent > 0 && (
                    <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
                      <span>Subtotal bruto:</span>
                      <span className="font-mono">S/ {grossTotal.toFixed(2)}</span>
                    </div>
                  )}

                  {discountPercent > 0 && (
                    <div className="flex items-center justify-between text-xs text-emerald-700 font-bold px-1">
                      <span>Descuento aplicado ({discountPercent}%):</span>
                      <span className="font-mono">- S/ {discountAmount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between px-1 pt-0.5">
                    <div>
                      <span className="text-xs font-bold text-slate-600 uppercase">Total Pre-Venta:</span>
                      <div className="text-[10px] text-slate-400">Estado: Pendiente de Pago en Caja</div>
                    </div>
                    <div className="text-2xl font-black text-slate-900 font-mono">
                      S/ {totalAmount.toFixed(2)}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGeneratePreSale}
                  className="w-full py-3.5 px-4 bg-[#16a34a] hover:bg-[#15803d] text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-700/30 transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Barcode className="w-4 h-4 stroke-[2.5]" />
                  <span>Emitir Pre-Venta & Ticket QR</span>
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
          onGoToCashier={onGoToCashier}
        />

        {/* ========================================================================= */}
        {/* MODAL SIMULADOR DE ESCÁNER POR CÁMARA / LÁSER */}
        {/* ========================================================================= */}
        {isCameraScannerOpen && (
          <div 
            className="absolute inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setIsCameraScannerOpen(false)}
          >
            <div 
              className="w-full max-w-sm bg-zinc-950 text-white rounded-3xl p-5 border border-emerald-500/40 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-950 text-emerald-400 rounded-xl border border-emerald-500/30">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase text-white tracking-wide">
                      Escáner por Cámara & Láser
                    </h3>
                    <p className="text-[10px] text-zinc-400">Apunta el visor al código de barras</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCameraScannerOpen(false)}
                  className="p-1 rounded-full text-zinc-400 hover:text-white bg-zinc-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Visor de Cámara con Línea Láser Animada */}
              <div className="relative h-44 bg-zinc-900 rounded-2xl overflow-hidden border-2 border-emerald-500/50 flex flex-col items-center justify-center shadow-inner">
                {/* Cuatro esquinas de enfoque */}
                <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-emerald-400" />
                <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-emerald-400" />
                <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-emerald-400" />
                <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-emerald-400" />

                {/* Haz de Láser Rojo Animado */}
                <div className="absolute left-6 right-6 h-0.5 bg-red-500 shadow-[0_0_12px_#ef4444] animate-pulse" />

                {/* Ícono central de código de barras */}
                <Barcode className="w-16 h-16 text-zinc-600 opacity-60" />
                <span className="text-[10px] text-emerald-400 font-bold mt-2 tracking-wider">
                  VISOR ACTIVO · DISPARO ULTRA RÁPIDO
                </span>
              </div>

              {/* Botones de Escaneo Directo con 1-Click (Golosinas y Bebidas Populares) */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">
                  Simular Lectura de Productos (1-Click):
                </span>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      handleScanBarcode('7750182001011');
                      setIsCameraScannerOpen(false);
                    }}
                    className="p-2 bg-zinc-900 hover:bg-emerald-950 border border-zinc-800 hover:border-emerald-500/50 rounded-xl text-left transition"
                  >
                    <div className="font-bold text-white text-[11px] truncate">🥤 Inka Kola 500ml</div>
                    <div className="text-[9px] text-emerald-400 font-mono">7750182001011</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleScanBarcode('7750885002012');
                      setIsCameraScannerOpen(false);
                    }}
                    className="p-2 bg-zinc-900 hover:bg-emerald-950 border border-zinc-800 hover:border-emerald-500/50 rounded-xl text-left transition"
                  >
                    <div className="font-bold text-white text-[11px] truncate">🍫 Sublime Clásico</div>
                    <div className="text-[9px] text-emerald-400 font-mono">7750885002012</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleScanBarcode('7622300711019');
                      setIsCameraScannerOpen(false);
                    }}
                    className="p-2 bg-zinc-900 hover:bg-emerald-950 border border-zinc-800 hover:border-emerald-500/50 rounded-xl text-left transition"
                  >
                    <div className="font-bold text-white text-[11px] truncate">🍪 Galletas Oreo</div>
                    <div className="text-[9px] text-emerald-400 font-mono">7622300711019</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleScanBarcode('7702011030114');
                      setIsCameraScannerOpen(false);
                    }}
                    className="p-2 bg-zinc-900 hover:bg-emerald-950 border border-zinc-800 hover:border-emerald-500/50 rounded-xl text-left transition"
                  >
                    <div className="font-bold text-white text-[11px] truncate">🍭 Bon Bon Bum</div>
                    <div className="text-[9px] text-emerald-400 font-mono">7702011030114</div>
                  </button>
                </div>
              </div>

              {/* Input manual en el visor */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const input = form.elements.namedItem('barcode') as HTMLInputElement;
                  if (input && input.value) {
                    handleScanBarcode(input.value);
                    setIsCameraScannerOpen(false);
                  }
                }}
                className="flex gap-2"
              >
                <input
                  name="barcode"
                  type="text"
                  placeholder="Código de barras..."
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 font-mono"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#16a34a] hover:bg-[#15803d] text-white font-black text-xs uppercase rounded-xl transition"
                >
                  Disparar
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL HISTORIAL DE PREVENTAS DEL DÍA DEL VENDEDOR */}
        {/* ========================================================================= */}
        {isOrderHistoryOpen && (
          <div 
            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in"
            onClick={() => setIsOrderHistoryOpen(false)}
          >
            <div 
              className="w-full max-w-sm bg-white text-slate-800 rounded-3xl p-5 shadow-2xl space-y-3 max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                    <Receipt className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase">
                      Mis Preventas de Hoy
                    </h3>
                    <p className="text-[10px] text-slate-500">Preventista: Carlos Mendoza</p>
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
                <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 text-center">
                  <span className="text-[10px] font-bold text-emerald-800 block uppercase">Total Emitido Hoy</span>
                  <span className="text-base font-black text-emerald-900 font-mono">
                    S/ {orders.reduce((acc, o) => acc + o.totalAmount, 0).toFixed(2)}
                  </span>
                </div>
                <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-center">
                  <span className="text-[10px] font-bold text-amber-800 block uppercase">Pedidos Generados</span>
                  <span className="text-base font-black text-amber-900 font-mono">
                    {orders.length} pedidos
                  </span>
                </div>
              </div>

              {/* Lista de Pedidos */}
              <div className="flex-1 overflow-y-auto space-y-2 max-h-[50vh] pr-1">
                {orders.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 space-y-2">
                    <Clock className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="font-bold text-xs">No hay pedidos emitidos hoy</p>
                    <p className="text-[10px]">Añade productos y emite una pre-venta para verla aquí.</p>
                  </div>
                ) : (
                  orders.map((ord) => (
                    <div
                      key={ord.id}
                      onClick={() => {
                        setActiveOrder(ord);
                        setIsTicketModalOpen(true);
                        setIsOrderHistoryOpen(false);
                      }}
                      className="p-3 bg-slate-50 rounded-2xl border border-slate-200 hover:border-[#16a34a] transition cursor-pointer flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <strong className="text-xs font-mono text-slate-900">{ord.id}</strong>
                          <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                            ord.status === 'PAGADO' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {ord.status === 'PAGADO' ? '✓ PAGADO' : 'PENDIENTE'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 font-semibold truncate mt-0.5">
                          {ord.customerName || 'Cliente General'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {ord.items.length} productos · {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-black font-mono text-slate-900">
                          S/ {ord.totalAmount.toFixed(2)}
                        </div>
                        <span className="text-[10px] text-emerald-700 font-bold block mt-1">
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
