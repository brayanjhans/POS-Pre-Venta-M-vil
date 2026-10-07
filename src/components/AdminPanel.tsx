import React from 'react';
import { ExtendedProduct } from '../data/mockProducts';
import { Order, PresentationType, PromoBanner } from '../types/pos';
import { 
  ShieldCheck, 
  Lock, 
  LogOut, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  Save, 
  X, 
  Upload, 
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  ArrowLeft,
  Star,
  Menu,
  LayoutDashboard,
  TrendingUp,
  Calendar,
  Package,
  Clock,
  Users,
  Receipt
} from 'lucide-react';

interface Props {
  products: ExtendedProduct[];
  promos?: PromoBanner[];
  onAddProduct: (product: ExtendedProduct) => void;
  onUpdateProduct: (product: ExtendedProduct) => void;
  onDeleteProduct: (productId: string) => void;
  onToggleActive: (productId: string) => void;
  onAddPromo: (promo: PromoBanner) => void;
  onUpdatePromo: (promo: PromoBanner) => void;
  onDeletePromo: (promoId: string) => void;
  orders: Order[];
  onCloseAdmin: () => void;
  onPayDebt?: (orderId: string, amount: number) => void;
}

export const AdminPanel: React.FC<Props> = ({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onToggleActive,
  promos = [],
  onAddPromo,
  onUpdatePromo,
  onDeletePromo,
  orders,
  onCloseAdmin,
  onPayDebt,
}) => {
  // Estado de autenticación
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean>(false);
  const [email, setEmail] = React.useState<string>('jhans');
  const [password, setPassword] = React.useState<string>('admin');
  const [loginError, setLoginError] = React.useState<string | null>(null);

  // Estados del panel
  const [isMenuOpen, setIsMenuOpen] = React.useState<boolean>(false);
  const [adminTab, setAdminTab] = React.useState<'dashboard' | 'products' | 'new_product' | 'bulk_upload' | 'orders' | 'promos' | 'new_promo' | 'deudores'>('dashboard');
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('Todos');
  const [feedbackMsg, setFeedbackMsg] = React.useState<string | null>(null);
  const [viewTicketOrder, setViewTicketOrder] = React.useState<Order | null>(null);

  // Formulario de nuevo producto
  const [formData, setFormData] = React.useState<{
    name: string;
    barcode: string;
    category: 'Bebidas' | 'Chocolates' | 'Galletas' | 'Golosinas' | 'Snacks';
    baseUnitName: string;
    stockInBaseUnits: number;
    packagingType: 'Botella Pet' | 'Display Caja' | 'Bolsa Sellada' | 'Fardo Termocontraíble' | 'Lata' | 'Tira Colgante';
    flavorNote: string;
    unitPrice: number;
    halfFactor: number;
    halfPrice: number;
    packFactor: number;
    packPrice: number;
    isPromo: boolean;
  }>({
    name: '',
    barcode: '',
    category: 'Golosinas',
    baseUnitName: 'unidad',
    stockInBaseUnits: 120,
    packagingType: 'Display Caja',
    flavorNote: '',
    unitPrice: 1.00,
    halfFactor: 12,
    halfPrice: 10.50,
    packFactor: 24,
    packPrice: 20.00,
    isPromo: false,
  });

  // Formulario de nueva promoción / combo
  const [promoFormData, setPromoFormData] = React.useState<{
    title: string;
    subtitle: string;
    badgeText: string;
    tag: string;
    discountBadge: string;
    originalPrice: number;
    offerPrice: number;
    savingText: string;
    associatedBarcodes: string;
  }>({
    title: '',
    subtitle: '',
    badgeText: 'PROMOCIÓN DESTACADA',
    tag: 'OFERTA MAYORISTA',
    discountBadge: '',
    originalPrice: 0,
    offerPrice: 0,
    savingText: '¡Ahorras S/ 0.00!',
    associatedBarcodes: '',
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      (email === 'jhans' && password === 'admin') ||
      password === '1234'
    ) {
      setIsAuthenticated(true);
      setLoginError(null);
    } else {
      setLoginError('Credenciales incorrectas. Usa jhans / admin o PIN 1234');
    }
  };

  const generateRandomBarcode = () => {
    const random12 = '775' + Math.floor(100000000 + Math.random() * 900000000).toString();
    setFormData(prev => ({ ...prev, barcode: random12 }));
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.barcode.trim()) {
      alert('Por favor complete el nombre y código de barras.');
      return;
    }

    const timestamp = Date.now();
    const productId = `prod_${timestamp}`;

    const newProd: ExtendedProduct = {
      id: productId,
      barcode: formData.barcode.trim(),
      name: formData.name.trim(),
      category: formData.category,
      baseUnitName: formData.baseUnitName.trim() || 'unidad',
      stockInBaseUnits: Number(formData.stockInBaseUnits) || 0,
      minStockAlert: 24,
      accentColor: formData.category === 'Bebidas' ? '#16a34a' :
                   formData.category === 'Chocolates' ? '#d97706' :
                   formData.category === 'Galletas' ? '#0284c7' :
                   formData.category === 'Golosinas' ? '#f43f5e' : '#eab308',
      gradientBg: 'from-emerald-500/10 to-transparent',
      packagingType: formData.packagingType,
      flavorNote: formData.flavorNote.trim(),
      piecesPerPack: Number(formData.packFactor) || 24,
      isPromo: formData.isPromo,
      presentations: {
        unit: {
          id: `pres_${timestamp}_u`,
          productId,
          type: 'unit',
          label: `Unidad (1 ${formData.baseUnitName})`,
          shortLabel: 'UND',
          conversionFactor: 1,
          price: Number(formData.unitPrice),
          isDefault: true,
        },
        half: {
          id: `pres_${timestamp}_h`,
          productId,
          type: 'half',
          label: `Medio paquete (${formData.halfFactor} ${formData.baseUnitName}s)`,
          shortLabel: `MED (${formData.halfFactor}u)`,
          conversionFactor: Number(formData.halfFactor),
          price: Number(formData.halfPrice),
        },
        pack: {
          id: `pres_${timestamp}_p`,
          productId,
          type: 'pack',
          label: `Paquete completo (${formData.packFactor} ${formData.baseUnitName}s)`,
          shortLabel: `PAQ (${formData.packFactor}u)`,
          conversionFactor: Number(formData.packFactor),
          price: Number(formData.packPrice),
        },
      },
    };

    onAddProduct(newProd);
    setFeedbackMsg(`✓ Producto "${newProd.name}" guardado exitosamente en el catálogo.`);
    setTimeout(() => setFeedbackMsg(null), 3000);
    setAdminTab('products');
    // Reset form
    setFormData({
      name: '',
      barcode: '',
      category: 'Golosinas',
      baseUnitName: 'unidad',
      stockInBaseUnits: 120,
      packagingType: 'Display Caja',
      flavorNote: '',
      unitPrice: 1.00,
      halfFactor: 12,
      halfPrice: 10.50,
      packFactor: 24,
      packPrice: 20.00,
      isPromo: false,
    });
  };

  const handleCreatePromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoFormData.title.trim()) {
      alert('El título de la promoción es obligatorio.');
      return;
    }

    const newPromo: PromoBanner = {
      id: `promo_${Date.now()}`,
      title: promoFormData.title.trim(),
      subtitle: promoFormData.subtitle.trim(),
      badgeText: promoFormData.badgeText.trim() || 'PROMOCIÓN',
      tag: promoFormData.tag.trim(),
      discountBadge: promoFormData.discountBadge.trim(),
      originalPrice: Number(promoFormData.originalPrice) || 0,
      offerPrice: Number(promoFormData.offerPrice) || 0,
      savingText: promoFormData.savingText.trim(),
      associatedBarcodes: promoFormData.associatedBarcodes.split(',').map(bc => bc.trim()).filter(bc => bc !== ''),
    };

    onAddPromo(newPromo);
    setFeedbackMsg(`✓ Promoción "${newPromo.title}" creada exitosamente.`);
    setTimeout(() => setFeedbackMsg(null), 3000);
    setAdminTab('promos');
    setPromoFormData({
      title: '',
      subtitle: '',
      badgeText: 'PROMOCIÓN DESTACADA',
      tag: 'OFERTA MAYORISTA',
      discountBadge: '',
      originalPrice: 0,
      offerPrice: 0,
      savingText: '¡Ahorras S/ 0.00!',
      associatedBarcodes: '',
    });
  };

  const handleBulkLoadPreset = () => {
    // Carga de lote rápido de demostración
    const presetBatch: ExtendedProduct[] = [
      {
        id: `batch_${Date.now()}_1`,
        barcode: '7751234567011',
        name: 'Gomitas Morochitas Dulces 50g',
        category: 'Golosinas',
        baseUnitName: 'bolsita',
        stockInBaseUnits: 200,
        minStockAlert: 20,
        accentColor: '#f43f5e',
        gradientBg: 'from-pink-500/20 to-rose-900/10',
        packagingType: 'Display Caja',
        flavorNote: 'Mora y Fresa con Gelatina Natural',
        piecesPerPack: 20,
        presentations: {
          unit: { id: 'b1_u', productId: 'b1', type: 'unit', label: 'Unidad (1 bolsita)', shortLabel: 'UND (1b)', conversionFactor: 1, price: 1.50, isDefault: true },
          half: { id: 'b1_h', productId: 'b1', type: 'half', label: 'Medio display (10 bolsitas)', shortLabel: 'MED (10b)', conversionFactor: 10, price: 13.50 },
          pack: { id: 'b1_p', productId: 'b1', type: 'pack', label: 'Display sellado (20 bolsitas)', shortLabel: 'PAQ (20b)', conversionFactor: 20, price: 25.00 },
        },
      },
      {
        id: `batch_${Date.now()}_2`,
        barcode: '7751234567022',
        name: 'Cerveza Cusqueña Trigo 330ml Botella',
        category: 'Bebidas',
        baseUnitName: 'botella',
        stockInBaseUnits: 144,
        minStockAlert: 24,
        accentColor: '#d97706',
        gradientBg: 'from-amber-500/20 to-yellow-900/10',
        packagingType: 'Fardo Termocontraíble',
        flavorNote: 'Cerveza de Trigo Selección Especial',
        piecesPerPack: 24,
        isPromo: true,
        presentations: {
          unit: { id: 'b2_u', productId: 'b2', type: 'unit', label: 'Unidad (1 botella)', shortLabel: 'UND (1b)', conversionFactor: 1, price: 6.50, isDefault: true },
          half: { id: 'b2_h', productId: 'b2', type: 'half', label: 'Medio sixpack x2 (12 botellas)', shortLabel: 'MED (12b)', conversionFactor: 12, price: 72.00 },
          pack: { id: 'b2_p', productId: 'b2', type: 'pack', label: 'Caja cerrada (24 botellas)', shortLabel: 'PAQ (24b)', conversionFactor: 24, price: 138.00 },
        },
      },
    ];

    presetBatch.forEach(p => onAddProduct(p));
    setFeedbackMsg(`✓ Se cargó un lote de nuevos productos mayoristas con éxito.`);
    setTimeout(() => setFeedbackMsg(null), 3000);
    setAdminTab('products');
  };

  const filteredProducts = products.filter(p => {
    if (selectedCategory !== 'Todos' && p.category !== selectedCategory) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return p.name.toLowerCase().includes(q) || p.barcode.includes(q) || p.category.toLowerCase().includes(q);
  });

  // SI NO ESTÁ AUTENTICADO: PANTALLA DE LOGIN
  if (!isAuthenticated) {
    return (
      <div className="w-full max-w-md mx-auto bg-white rounded-3xl p-6 md:p-8 shadow-2xl border-2 border-[#16a34a] animate-in fade-in">
        {/* Barra superior con botón volver al sistema */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
          <button
            type="button"
            onClick={onCloseAdmin}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>← Volver a Pre-Venta</span>
          </button>
          <button
            type="button"
            onClick={onCloseAdmin}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            title="Cerrar y volver"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-center space-y-2 mb-6">
          <div className="w-14 h-14 bg-emerald-100 text-[#16a34a] rounded-2xl flex items-center justify-center mx-auto shadow-md">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
            Acceso Administrador
          </h2>
          <p className="text-xs text-slate-500">
            Panel de control para subir y gestionar golosinas, bebidas, precios de paquetes y stock.
          </p>
        </div>

        {loginError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{loginError}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Usuario
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-hidden focus:border-[#16a34a] focus:ring-1 focus:ring-[#16a34a] font-medium"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Contraseña / PIN
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-hidden focus:border-[#16a34a] focus:ring-1 focus:ring-[#16a34a] font-medium"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-[#16a34a] hover:bg-[#15803d] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Lock className="w-4 h-4" />
            Ingresar al Panel Admin
          </button>
        </form>

        {/* Acceso Rápido Demo */}
        <div className="mt-5 pt-4 border-t border-slate-200 text-center">
          <p className="text-[11px] text-slate-400 mb-2">Credenciales demostrativas:</p>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px] font-mono text-slate-600">
            <div>User: <strong>jhans</strong></div>
            <div>Clave: <strong>admin</strong> (o PIN <strong>1234</strong>)</div>
          </div>
          <button
            type="button"
            onClick={() => {
              setEmail('jhans');
              setPassword('admin');
              setIsAuthenticated(true);
            }}
            className="mt-3 text-xs font-bold text-[#16a34a] hover:underline"
          >
            → Ingresar directamente con 1-Click
          </button>
        </div>

        {/* Botón Principal para Volver al Sistema POS */}
        <button
          type="button"
          onClick={onCloseAdmin}
          className="mt-4 w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 border border-slate-300 shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Punto de Venta (Terminal Pre-Venta)</span>
        </button>
      </div>
    );
  }

  // PANEL ADMINISTRADOR AUTENTICADO
  return (
    <div className="w-full h-full max-w-5xl mx-auto bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-slate-800 animate-in fade-in relative">
      {/* Top Header del Panel */}
      <div className="bg-[#16a34a] text-white p-4 md:p-6 flex flex-wrap items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-xl text-white transition active:scale-95 lg:hidden"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="w-10 h-10 bg-white/20 rounded-xl hidden md:flex items-center justify-center text-white font-black">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tight">
                Panel Administrador
              </h2>
              <span className="hidden md:inline text-[10px] bg-white text-emerald-950 font-black px-2 py-0.5 rounded-full">
                ADMIN CONECTADO
              </span>
            </div>
            <p className="text-xs text-white/80 hidden md:block">
              Gestión centralizada de productos, promociones y reportes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCloseAdmin}
            className="px-3.5 py-1.5 bg-white/20 hover:bg-white/30 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Volver a Pre-Venta</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAuthenticated(false);
              onCloseAdmin(); // Salir y volver automáticamente al POS
            }}
            className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Cerrar sesión y volver al sistema"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión & Salir</span>
          </button>
        </div>
      </div>

      {/* Layout Flex (Menú Lateral + Contenido) */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Drawer / Menú Lateral Hamburguesa */}
        <div 
          className={`absolute inset-y-0 left-0 z-30 w-64 bg-slate-900 text-white shadow-2xl transform transition-transform duration-300 lg:relative lg:translate-x-0 ${
            isMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-4 border-b border-slate-800 flex items-center justify-between lg:hidden">
            <span className="font-black text-sm uppercase text-slate-300">Menú Admin</span>
            <button onClick={() => setIsMenuOpen(false)} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="p-4 space-y-2 text-sm font-bold">
            <button
              onClick={() => { setAdminTab('dashboard'); setIsMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${adminTab === 'dashboard' ? 'bg-[#16a34a] text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <LayoutDashboard className="w-5 h-5" /> Dashboard
            </button>
            <button
              onClick={() => { setAdminTab('products'); setIsMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${adminTab === 'products' ? 'bg-[#16a34a] text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <Package className="w-5 h-5" /> Catálogo ({products.length})
            </button>
            <button
              onClick={() => { setAdminTab('promos'); setIsMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${adminTab === 'promos' || adminTab === 'new_promo' ? 'bg-[#16a34a] text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <Star className="w-5 h-5" /> Combos y Promos
            </button>
            <button
              onClick={() => { setAdminTab('new_product'); setIsMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${adminTab === 'new_product' ? 'bg-[#16a34a] text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <Plus className="w-5 h-5 stroke-[3]" /> Nuevo Producto
            </button>
            <button
              onClick={() => { setAdminTab('orders'); setIsMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${adminTab === 'orders' ? 'bg-[#16a34a] text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <ShoppingBag className="w-5 h-5" /> Pre-Ventas ({orders.length})
            </button>
            <button
              onClick={() => { setAdminTab('bulk_upload'); setIsMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${adminTab === 'bulk_upload' ? 'bg-[#16a34a] text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <Upload className="w-5 h-5" /> Carga Masiva
            </button>
            <button
              onClick={() => { setAdminTab('deudores'); setIsMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${adminTab === 'deudores' ? 'bg-[#16a34a] text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <Users className="w-5 h-5" /> Libreta de Fiados
            </button>
          </nav>
        </div>

        {/* Backdrop para móvil */}
        {isMenuOpen && (
          <div 
            className="absolute inset-0 bg-black/60 z-20 lg:hidden"
            onClick={() => setIsMenuOpen(false)}
          />
        )}

        {/* Contenido Principal Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">

        {feedbackMsg && (
          <div className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 mb-4 rounded-lg border border-emerald-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* TAB 0: DASHBOARD */}
        {adminTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in">
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase">Dashboard General</h3>
              <p className="text-xs text-slate-500">Resumen de operaciones y estado del inventario</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <div className="text-slate-500 mb-1 flex items-center gap-2 text-xs font-bold uppercase"><TrendingUp className="w-4 h-4 text-[#16a34a]"/> Ventas del Día</div>
                <div className="text-2xl font-black text-slate-900 font-mono">S/ {(orders.reduce((acc, o) => acc + o.totalAmount, 0)).toFixed(2)}</div>
                <div className="text-[10px] text-[#16a34a] font-bold mt-1">+14.5% vs ayer</div>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <div className="text-slate-500 mb-1 flex items-center gap-2 text-xs font-bold uppercase"><Calendar className="w-4 h-4 text-blue-500"/> Ganancias Mes</div>
                <div className="text-2xl font-black text-slate-900 font-mono">S/ 4,850.00</div>
                <div className="text-[10px] text-blue-600 font-bold mt-1">Semanales: S/ 1,210.00</div>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <div className="text-slate-500 mb-1 flex items-center gap-2 text-xs font-bold uppercase"><Package className="w-4 h-4 text-amber-500"/> Stock Crítico</div>
                <div className="text-2xl font-black text-slate-900 font-mono">{products.filter(p => p.stockInBaseUnits <= (p.minStockAlert || 50)).length}</div>
                <div className="text-[10px] text-amber-600 font-bold mt-1">Productos por reponer</div>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <div className="text-slate-500 mb-1 flex items-center gap-2 text-xs font-bold uppercase"><Clock className="w-4 h-4 text-red-500"/> Vencimientos</div>
                <div className="text-2xl font-black text-slate-900 font-mono">3</div>
                <div className="text-[10px] text-red-600 font-bold mt-1">Vencen en &lt; 30 días</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <h4 className="text-sm font-black text-slate-900 uppercase border-b border-slate-100 pb-2 mb-3">Últimas Ventas Emitidas</h4>
                {orders.slice(0, 3).length > 0 ? (
                  <div className="space-y-3">
                    {orders.slice(0, 3).map(o => (
                      <div key={o.id} className="flex justify-between items-center text-xs">
                        <div>
                          <div className="font-bold text-slate-900 font-mono">{o.id}</div>
                          <div className="text-[10px] text-slate-500">{new Date(o.createdAt).toLocaleTimeString()} · {o.items.length} ítems</div>
                        </div>
                        <div className="font-black text-emerald-700 font-mono">S/ {o.totalAmount.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 py-4 text-center">No hay ventas registradas hoy.</div>
                )}
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <h4 className="text-sm font-black text-slate-900 uppercase border-b border-slate-100 pb-2 mb-3">Alertas de Stock ({products.filter(p => p.stockInBaseUnits <= (p.minStockAlert || 50)).length})</h4>
                <div className="space-y-3">
                  {products.filter(p => p.stockInBaseUnits <= (p.minStockAlert || 50)).slice(0, 3).map(p => (
                    <div key={p.id} className="flex justify-between items-center text-xs">
                      <div className="truncate max-w-[70%]">
                        <div className="font-bold text-slate-900 truncate">{p.name}</div>
                        <div className="text-[10px] text-slate-500">Mínimo sugerido: {p.minStockAlert || 50}</div>
                      </div>
                      <div className="font-black text-amber-600 font-mono px-2 py-1 bg-amber-50 rounded">
                        {p.stockInBaseUnits} {p.baseUnitName}s
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: LISTADO Y GESTIÓN DE PRODUCTOS */}
        {adminTab === 'products' && (
          <div className="space-y-4">
            {/* Buscador & Filtros */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[260px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre, código de barras o categoría..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-[#16a34a] font-medium"
                />
              </div>

              <div className="flex gap-1.5 overflow-x-auto">
                {['Todos', 'Bebidas', 'Chocolates', 'Galletas', 'Golosinas', 'Snacks'].map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      selectedCategory === cat
                        ? 'bg-[#16a34a] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Tabla de Productos */}
            <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3">Código / EAN</th>
                    <th className="p-3">Producto</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3">P. Unidad</th>
                    <th className="p-3">P. Medio</th>
                    <th className="p-3">P. Paquete</th>
                    <th className="p-3">Stock Base</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-mono text-slate-500">{p.barcode}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-[10px] text-slate-500">{p.flavorNote || p.packagingType}</div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {p.category}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-900">
                        S/ {p.presentations.unit.price.toFixed(2)}
                      </td>
                      <td className="p-3 font-mono text-slate-700">
                        S/ {p.presentations.half.price.toFixed(2)}
                        <span className="text-[10px] text-slate-400 block font-normal">
                          (x{p.presentations.half.conversionFactor}u)
                        </span>
                      </td>
                      <td className="p-3 font-mono text-emerald-800 font-bold">
                        S/ {p.presentations.pack.price.toFixed(2)}
                        <span className="text-[10px] text-slate-400 block font-normal">
                          (x{p.presentations.pack.conversionFactor}u)
                        </span>
                      </td>
                      <td className="p-3 font-mono">
                        <strong className="text-slate-900">{p.stockInBaseUnits}</strong> {p.baseUnitName}s
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const newStock = prompt(`Ajustar stock en unidades base para ${p.name}:`, String(p.stockInBaseUnits));
                              if (newStock !== null && !isNaN(Number(newStock))) {
                                onUpdateProduct({ ...p, stockInBaseUnits: Math.max(0, parseInt(newStock)) });
                              }
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs"
                            title="Ajustar Stock"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`¿Eliminar producto "${p.name}"?`)) {
                                onDeleteProduct(p.id);
                              }
                            }}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: FORMULARIO CREAR NUEVO PRODUCTO */}
        {adminTab === 'new_product' && (
          <form onSubmit={handleCreateProduct} className="space-y-5 max-w-3xl mx-auto bg-slate-50 p-6 rounded-3xl border border-slate-200">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-sm font-black text-slate-900 uppercase">
                Registrar Nuevo Producto para Pre-Venta
              </h3>
              <p className="text-xs text-slate-500">
                Define el código de barras y los 3 precios independientes de Unidad, Medio y Paquete.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nombre del Producto *</label>
                <input
                  type="text"
                  placeholder="Ej: Cerveza Cusqueña 330ml / Chicle Bubbaloo..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-[#16a34a]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Código de Barras (EAN-13) *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="775018200..."
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:border-[#16a34a]"
                    required
                  />
                  <button
                    type="button"
                    onClick={generateRandomBarcode}
                    className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    Generar EAN
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Categoría</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-[#16a34a]"
                >
                  <option value="Bebidas">Bebidas</option>
                  <option value="Chocolates">Chocolates</option>
                  <option value="Galletas">Galletas</option>
                  <option value="Golosinas">Golosinas</option>
                  <option value="Snacks">Snacks</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Tipo de Empaque</label>
                <select
                  value={formData.packagingType}
                  onChange={(e) => setFormData({ ...formData, packagingType: e.target.value as any })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-[#16a34a]"
                >
                  <option value="Botella Pet">Botella Pet</option>
                  <option value="Display Caja">Display Caja</option>
                  <option value="Bolsa Sellada">Bolsa Sellada</option>
                  <option value="Fardo Termocontraíble">Fardo Termocontraíble</option>
                  <option value="Lata">Lata</option>
                  <option value="Tira Colgante">Tira Colgante</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Unidad Mínima Base</label>
                <input
                  type="text"
                  placeholder="botella, paquetito, barra, chupetín..."
                  value={formData.baseUnitName}
                  onChange={(e) => setFormData({ ...formData, baseUnitName: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Stock Inicial en Almacén</label>
                <input
                  type="number"
                  min="0"
                  value={formData.stockInBaseUnits}
                  onChange={(e) => setFormData({ ...formData, stockInBaseUnits: parseInt(e.target.value) || 0 })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">Nota de Sabor o Promoción</label>
                <input
                  type="text"
                  placeholder="Ej: Sabor Dorado Original • Bien Helada / Chocolate con Maní..."
                  value={formData.flavorNote}
                  onChange={(e) => setFormData({ ...formData, flavorNote: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
              </div>
            </div>

            {/* Configuración de Precios Independientes (Unidad, Medio, Paquete) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-black text-emerald-800 uppercase tracking-wide">
                Configuración de las 3 Presentaciones & Factores de Conversión
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Unidad */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-bold text-xs text-slate-800">1. Unidad Individual</div>
                  <div className="text-[10px] text-slate-400 mb-2">Factor fijo: x1 base</div>
                  <label className="text-[11px] text-slate-600 block">Precio Venta (S/):</label>
                  <input
                    type="number"
                    step="0.10"
                    min="0"
                    value={formData.unitPrice}
                    onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 mt-1"
                  />
                </div>

                {/* Medio */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-bold text-xs text-slate-800">2. Medio Paquete / Display</div>
                  <div className="flex gap-2 items-center my-1">
                    <span className="text-[10px] text-slate-500">Factor:</span>
                    <input
                      type="number"
                      min="2"
                      value={formData.halfFactor}
                      onChange={(e) => setFormData({ ...formData, halfFactor: parseInt(e.target.value) || 6 })}
                      className="w-16 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs font-mono"
                    />
                    <span className="text-[10px] text-slate-500">unds</span>
                  </div>
                  <label className="text-[11px] text-slate-600 block">Precio Medio (S/):</label>
                  <input
                    type="number"
                    step="0.10"
                    min="0"
                    value={formData.halfPrice}
                    onChange={(e) => setFormData({ ...formData, halfPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 mt-1"
                  />
                </div>

                {/* Paquete */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-bold text-xs text-slate-800">3. Paquete Cerrado / Fardo</div>
                  <div className="flex gap-2 items-center my-1">
                    <span className="text-[10px] text-slate-500">Factor:</span>
                    <input
                      type="number"
                      min="2"
                      value={formData.packFactor}
                      onChange={(e) => setFormData({ ...formData, packFactor: parseInt(e.target.value) || 12 })}
                      className="w-16 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs font-mono"
                    />
                    <span className="text-[10px] text-slate-500">unds</span>
                  </div>
                  <label className="text-[11px] text-slate-600 block">Precio Mayorista (S/):</label>
                  <input
                    type="number"
                    step="0.10"
                    min="0"
                    value={formData.packPrice}
                    onChange={(e) => setFormData({ ...formData, packPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 mt-1"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAdminTab('products')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#16a34a] hover:bg-[#15803d] text-white font-black text-xs uppercase rounded-xl shadow-md transition active:scale-95 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Guardar Producto en Catálogo
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: CARGA MASIVA DE LOTES */}
        {adminTab === 'bulk_upload' && (
          <div className="space-y-4 max-w-2xl mx-auto bg-slate-50 p-6 rounded-3xl border border-slate-200 text-center">
            <div className="w-12 h-12 bg-emerald-100 text-[#16a34a] rounded-2xl flex items-center justify-center mx-auto">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900 uppercase">
              Carga Masiva de Cientos de Golosinas y Bebidas
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
              Permite sincronizar de golpe el catálogo de distribución mayorista con todos sus precios y factores de conversión hacia el servidor y SQLite local.
            </p>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 text-left space-y-2 text-xs">
              <div className="font-bold text-slate-800">Formato admitido: Excel / CSV / JSON REST API</div>
              <p className="text-slate-500 text-[11px]">
                Columnas requeridas: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">barcode, name, category, stock_base, p_unit, half_factor, p_half, pack_factor, p_pack</code>.
              </p>
            </div>

            <button
              type="button"
              onClick={handleBulkLoadPreset}
              className="px-6 py-3 bg-[#16a34a] hover:bg-[#15803d] text-white font-black text-xs uppercase rounded-xl shadow-md transition active:scale-95 inline-flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Cargar Lote de Demostración (+2 Productos Mayoristas)
            </button>
          </div>
        )}

        {/* TAB 4: HISTORIAL DE PRE-VENTAS */}
        {adminTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 uppercase">
                Historial de Pre-Ventas Registradas en Turno
              </h3>
              <span className="text-xs text-slate-500 font-bold">
                Total: {orders.length} pedidos
              </span>
            </div>

            {orders.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                No hay pedidos de pre-venta emitidos en este turno todavía.
              </div>
            ) : (
              <div className="space-y-2">
                {orders.map((ord) => (
                  <div key={ord.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-mono text-slate-900">{ord.id}</strong>
                        <span className="px-2 py-0.5 rounded-full font-black text-[10px] bg-amber-100 text-amber-800">
                          {ord.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {new Date(ord.createdAt).toLocaleTimeString()} · Vendedor: {ord.sellerName} · {ord.items.length} productos ({ord.totalBaseUnits} unds base)
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-black font-mono text-emerald-800">
                        S/ {ord.totalAmount.toFixed(2)}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">QR: {ord.id}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: GESTIÓN DE PROMOCIONES Y COMBOS */}
        {adminTab === 'promos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase">
                  Gestión de Promociones y Combos Activos
                </h3>
                <p className="text-xs text-slate-500">
                  Estas promociones aparecen en la pasarela principal del Catálogo y en la pestaña Ofertas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdminTab('new_promo')}
                className="px-4 py-2 bg-[#059669] hover:bg-[#047857] text-white font-black text-xs uppercase rounded-xl shadow-md transition active:scale-95 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                Crear Nueva Promo
              </button>
            </div>

            {promos.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                No hay promociones configuradas actualmente.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {promos.map((promo) => (
                  <div key={promo.id} className="relative rounded-2xl overflow-hidden shadow-sm border border-slate-200 bg-white p-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase bg-[#10b981] text-white px-2 py-0.5 rounded">
                          {promo.badgeText}
                        </span>
                        {promo.discountBadge && (
                          <span className="text-[10px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded">
                            {promo.discountBadge}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-black text-slate-900 leading-tight uppercase">
                        {promo.title}
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-2">
                        {promo.subtitle}
                      </p>
                      <div className="pt-2 text-[10px] text-slate-400 font-mono">
                        Códigos de barra incluidos: {promo.associatedBarcodes.join(', ')}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 line-through">S/ {promo.originalPrice.toFixed(2)}</span>
                        <span className="text-lg font-black text-amber-600 font-mono leading-none">
                          S/ {promo.offerPrice.toFixed(2)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if(confirm('¿Eliminar esta promoción?')) {
                            onDeletePromo(promo.id);
                          }
                        }}
                        className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
                        title="Eliminar Promo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: CREAR NUEVA PROMOCIÓN */}
        {adminTab === 'new_promo' && (
          <form onSubmit={handleCreatePromo} className="space-y-4 max-w-2xl mx-auto">
            <h3 className="text-sm font-black text-slate-900 uppercase border-b border-slate-200 pb-2">
              Crear Nueva Promoción / Combo
            </h3>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Título Principal (*):</label>
                <input
                  required
                  type="text"
                  placeholder="Ej: COMBO INKA KOLA + SUBLIME"
                  value={promoFormData.title}
                  onChange={(e) => setPromoFormData({...promoFormData, title: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Subtítulo / Descripción:</label>
                <input
                  type="text"
                  placeholder="Ej: Gaseosa helada + display completo..."
                  value={promoFormData.subtitle}
                  onChange={(e) => setPromoFormData({...promoFormData, subtitle: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Etiqueta Principal:</label>
                <input
                  type="text"
                  value={promoFormData.badgeText}
                  onChange={(e) => setPromoFormData({...promoFormData, badgeText: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Tag Secundario:</label>
                <input
                  type="text"
                  value={promoFormData.tag}
                  onChange={(e) => setPromoFormData({...promoFormData, tag: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Etiqueta Descuento (Roja):</label>
                <input
                  type="text"
                  placeholder="Ej: -20% OFF"
                  value={promoFormData.discountBadge}
                  onChange={(e) => setPromoFormData({...promoFormData, discountBadge: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h4 className="text-[11px] font-black uppercase text-slate-500">Precios</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-600 block">Precio Original (S/):</label>
                    <input
                      type="number"
                      step="0.10"
                      min="0"
                      value={promoFormData.originalPrice}
                      onChange={(e) => setPromoFormData({...promoFormData, originalPrice: parseFloat(e.target.value) || 0})}
                      className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-600 block">Precio Oferta (S/):</label>
                    <input
                      required
                      type="number"
                      step="0.10"
                      min="0"
                      value={promoFormData.offerPrice}
                      onChange={(e) => setPromoFormData({...promoFormData, offerPrice: parseFloat(e.target.value) || 0})}
                      className="w-full border border-emerald-500 bg-emerald-50 rounded px-2 py-1 text-xs font-mono font-black text-emerald-800"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-600 block">Texto de ahorro:</label>
                  <input
                    type="text"
                    value={promoFormData.savingText}
                    onChange={(e) => setPromoFormData({...promoFormData, savingText: e.target.value})}
                    className="w-full border border-slate-300 rounded px-2 py-1 text-[10px]"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h4 className="text-[11px] font-black uppercase text-slate-500">Productos del Combo</h4>
                <div>
                  <label className="text-[10px] text-slate-600 block mb-1">
                    Códigos de Barra (separados por comas):
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Ej: 7750182001011, 7750885002012"
                    value={promoFormData.associatedBarcodes}
                    onChange={(e) => setPromoFormData({...promoFormData, associatedBarcodes: e.target.value})}
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-[10px] font-mono resize-none"
                  />
                  <p className="text-[9px] text-slate-400 mt-1">
                    Al tocar "Añadir Combo", estos códigos se escanearán y añadirán al carrito de forma automática.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAdminTab('promos')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#059669] hover:bg-[#047857] text-white font-black text-xs uppercase rounded-xl shadow-md transition active:scale-95 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Guardar Promoción
              </button>
            </div>
          </form>
        )}

        {/* TAB: DEUDORES / FIADOS */}
        {adminTab === 'deudores' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase">Libreta de Fiados (Cuentas por Cobrar)</h3>
                <p className="text-xs text-slate-500">Historial de clientes con deudas pendientes organizados por DNI.</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {orders.filter(o => o.status === 'FIADO' && o.debtAmount && o.debtAmount > 0).length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-300 mb-2" />
                  <p className="font-bold text-sm">No hay cuentas por cobrar</p>
                  <p className="text-xs">Todos los clientes están al día con sus pagos.</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Cliente (DNI/RUC)</th>
                      <th className="px-4 py-3">Ticket / Fecha</th>
                      <th className="px-4 py-3 text-right">Total Pedido</th>
                      <th className="px-4 py-3 text-right">Abonado</th>
                      <th className="px-4 py-3 text-right">Deuda</th>
                      <th className="px-4 py-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {
                      Object.entries(
                        orders.filter(o => o.status === 'FIADO' && o.debtAmount && o.debtAmount > 0)
                              .reduce((acc, order) => {
                                const key = order.customerRuc || order.customerName || 'Desconocido';
                                if (!acc[key]) acc[key] = [];
                                acc[key].push(order);
                                return acc;
                              }, {} as Record<string, typeof orders>)
                      ).flatMap(([key, clientOrders]) => 
                        clientOrders.map((ord, idx) => (
                          <tr key={ord.id} className="hover:bg-slate-50 transition">
                            {idx === 0 && (
                              <td rowSpan={clientOrders.length} className="px-4 py-3 border-r border-slate-100 align-top bg-white">
                                <div className="font-bold text-slate-900">{ord.customerName || 'Sin Nombre'}</div>
                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">{key}</div>
                                <div className="text-xs font-black text-amber-700 mt-2 bg-amber-50 inline-block px-2 py-0.5 rounded">
                                  Deuda Total: S/ {clientOrders.reduce((sum, o) => sum + (o.debtAmount || 0), 0).toFixed(2)}
                                </div>
                              </td>
                            )}
                            <td className="px-4 py-3 text-xs">
                              <span className="font-mono font-bold text-slate-700">{ord.id}</span>
                              <div className="text-[10px] text-slate-400">
                                {new Date(ord.createdAt).toLocaleDateString()} {new Date(ord.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-medium text-slate-600">S/ {ord.totalAmount.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-mono font-medium text-emerald-600">S/ {(ord.paidAmount || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-mono font-black text-red-600">S/ {(ord.debtAmount || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setViewTicketOrder(ord)}
                                  className="p-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition"
                                  title="Ver Ticket"
                                >
                                  <Receipt className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const abonarStr = window.prompt(`Abonar deuda del ticket ${ord.id}\nDeuda actual: S/ ${ord.debtAmount}\n¿Cuánto desea abonar ahora?`, String(ord.debtAmount));
                                    if(abonarStr) {
                                      const abonarNum = parseFloat(abonarStr);
                                      if(!isNaN(abonarNum) && abonarNum > 0 && onPayDebt) {
                                        onPayDebt(ord.id, abonarNum);
                                      } else if(!onPayDebt) {
                                        alert(`Se abonó S/ ${abonarStr} al ticket ${ord.id}. (Backend pendiente)`);
                                      }
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-[10px] uppercase rounded-lg shadow-xs transition"
                                >
                                  Abonar
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )
                    }
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>

    {/* MODAL DE BOLETA ELECTRÓNICA */}
    {viewTicketOrder && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in">
        <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-600" />
              <h3 className="font-black text-sm uppercase text-slate-800">Boleta {viewTicketOrder.id}</h3>
            </div>
            <button onClick={() => setViewTicketOrder(null)} className="p-1 text-slate-400 hover:text-slate-600 bg-slate-200 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          {/* Contenido (Ticket) */}
          <div className="p-5 overflow-y-auto font-mono text-xs text-slate-700 flex-1">
            <div className="text-center mb-4">
              <h2 className="font-black text-base uppercase">Distribuidora POS</h2>
              <p className="text-[10px] text-slate-500">Comprobante de Venta</p>
            </div>
            
            <div className="border-t border-dashed border-slate-300 py-2 mb-2 space-y-1">
              <div className="flex justify-between"><span>Fecha:</span> <span>{new Date(viewTicketOrder.createdAt).toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Cliente:</span> <span>{viewTicketOrder.customerName || '-'}</span></div>
              <div className="flex justify-between"><span>DNI/RUC:</span> <span>{viewTicketOrder.customerRuc || '-'}</span></div>
            </div>

            <table className="w-full mb-3 text-[11px]">
              <thead>
                <tr className="border-b border-dashed border-slate-300">
                  <th className="text-left py-1">CANT</th>
                  <th className="text-left py-1">DESCRIPCIÓN</th>
                  <th className="text-right py-1">IMPORTE</th>
                </tr>
              </thead>
              <tbody>
                {viewTicketOrder.items.map((item, i) => (
                  <tr key={i}>
                    <td className="py-1 align-top">{item.quantity} {item.presentationLabel.split(' ')[0]}</td>
                    <td className="py-1 px-1 align-top break-words max-w-[120px]">{item.productName}</td>
                    <td className="py-1 text-right align-top">S/ {item.subtotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-dashed border-slate-300 pt-2 space-y-1">
              <div className="flex justify-between font-bold">
                <span>TOTAL:</span>
                <span>S/ {viewTicketOrder.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>ABONADO:</span>
                <span>S/ {(viewTicketOrder.paidAmount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-red-600 font-black text-sm pt-1">
                <span>DEUDA ACTUAL:</span>
                <span>S/ {(viewTicketOrder.debtAmount || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-slate-50 rounded-b-2xl">
            <button
              onClick={() => setViewTicketOrder(null)}
              className="w-full py-2 bg-slate-900 text-white rounded-xl font-bold uppercase text-xs"
            >
              Cerrar Boleta
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
  );
};
