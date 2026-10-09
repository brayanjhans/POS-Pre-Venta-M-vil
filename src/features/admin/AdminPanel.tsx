import React from 'react';
import type { PresentationType, Product, PromoBanner } from '../../types/pos';
import { PRODUCT_CATEGORIES } from '../../types/pos';
import { usePos } from '../../state/PosContext';
import { useDialog } from '../../app/DialogProvider';
import { parseAmount } from '../../domain/money';
import { DashboardTab } from './DashboardTab';
import { OrdersTab } from './OrdersTab';
import { UsersTab } from './UsersTab';
import { CustomersTab } from './CustomersTab';
import { SettingsTab } from './SettingsTab';
import { DebtsPanel } from '../shared/DebtsPanel';
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

export const AdminPanel: React.FC = () => {
  const { api, catalog, orders, refreshCatalog, handleError } = usePos();
  const dialog = useDialog();
  const products = catalog?.products ?? [];
  const promos = catalog?.promos ?? [];

  /** Ejecuta una acción contra el servidor, refresca el catálogo y avisa si falló. */
  const run = async (action: () => Promise<unknown>): Promise<boolean> => {
    if (!api) return false;
    try {
      await action();
      await refreshCatalog();
      return true;
    } catch (e) {
      void dialog.alert(handleError(e), { tone: 'danger' });
      return false;
    }
  };
  const onAddProduct = (product: Partial<Product>) => run(() => api!.saveProduct(product));
  const onDeleteProduct = (product: Product) => run(async () => {
    const res = await api!.deleteProduct(product.id);
    if (res.deactivated) {
      void dialog.alert(`"${product.name}" tiene ventas registradas: se desactivó en lugar de eliminarse (el historial se conserva).`,
        { title: 'Producto desactivado' });
    }
  });
  const onToggleActive = (product: Product) => run(() => api!.setProductActive(product.id, product.isActive === false));
  const onAddPromo = (promo: Partial<PromoBanner>) => run(() => api!.savePromo(promo));
  const onDeletePromo = (promoId: string) => run(() => api!.deletePromo(promoId));
  const onRegularize = async (product: Product) => {
    const cost = await dialog.prompt(
      `Se vendieron ${Math.abs(product.stockInBaseUnits)} ${product.baseUnitName}s sin stock.\n¿Cuánto costó comprarlos en la otra tienda? (S/)`,
      {
        title: `Regularizar ${product.name}`, placeholder: 'Ej. 12.50', inputMode: 'decimal', confirmText: 'Regularizar',
        validate: v => (Number.isNaN(parseAmount(v)) ? 'Ingrese un monto válido (ej. 12.50).' : null),
      });
    if (cost === null) return;
    const costNum = parseAmount(cost);
    const ok = await run(() => api!.regularizeStock(product.id, costNum));
    if (ok) void dialog.alert(`Se regularizó la compra externa por S/ ${costNum.toFixed(2)}. El stock volvió a 0.`, { tone: 'success' });
  };

  // Estados del panel
  const [isMenuOpen, setIsMenuOpen] = React.useState<boolean>(false);
  const [adminTab, setAdminTab] = React.useState<'dashboard' | 'products' | 'new_product' | 'orders' | 'promos' | 'new_promo' | 'deudores' | 'users' | 'customers' | 'settings'>('dashboard');
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('Todos');
  const [feedbackMsg, setFeedbackMsg] = React.useState<string | null>(null);

  // Formulario de nuevo producto
  const [formData, setFormData] = React.useState<{
    name: string;
    barcode: string;
    category: Product['category'];
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
    expirationDate: string;
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
    expirationDate: '',
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
  const [restockProduct, setRestockProduct] = React.useState<Product | null>(null);
  const [restockData, setRestockData] = React.useState({
    addedQuantity: 0,
    presentationKey: 'unit' as PresentationType,
    newExpirationDate: '',
    unitPrice: 0,
  });

  const generateRandomBarcode = () => {
    const random12 = '775' + Math.floor(100000000 + Math.random() * 900000000).toString();
    setFormData(prev => ({ ...prev, barcode: random12 }));
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.barcode.trim()) {
      void dialog.alert('Complete el nombre y el código de barras del producto.', { tone: 'warning' });
      return;
    }

    const timestamp = Date.now();
    const productId = `prod_${timestamp}`;

    // El id definitivo lo asigna el servidor.
    const newProd: Product = {
      id: '',
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
      expirationDate: formData.expirationDate || undefined,
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

    if (!(await onAddProduct({ ...newProd, id: undefined }))) return;
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
      expirationDate: '',
    });
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoFormData.title.trim()) {
      void dialog.alert('El título de la promoción es obligatorio.', { tone: 'warning' });
      return;
    }

    const newPromo: PromoBanner = {
      id: '',
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

    if (!(await onAddPromo({ ...newPromo, id: undefined }))) return;
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

  const filteredProducts = products.filter(p => {
    if (selectedCategory !== 'Todos' && p.category !== selectedCategory) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return p.name.toLowerCase().includes(q) || p.barcode.includes(q) || p.category.toLowerCase().includes(q);
  });

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
              <span className="hidden md:inline text-xs bg-white text-emerald-950 font-black px-2 py-0.5 rounded-full">
                {products.filter(p => p.isActive !== false).length} PRODUCTOS ACTIVOS
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
            onClick={() => void refreshCatalog()}
            className="px-3.5 py-1.5 bg-white/20 hover:bg-white/30 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Actualizar datos</span>
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
              <ShoppingBag className="w-5 h-5" /> Boletas ({orders.length})
            </button>
            <button
              onClick={() => { setAdminTab('customers'); setIsMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${adminTab === 'customers' ? 'bg-[#16a34a] text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <Users className="w-5 h-5" /> Clientes
            </button>
            <button
              onClick={() => { setAdminTab('deudores'); setIsMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${adminTab === 'deudores' ? 'bg-[#16a34a] text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <Receipt className="w-5 h-5" /> Libreta de Fiados
            </button>
            <button
              onClick={() => { setAdminTab('users'); setIsMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${adminTab === 'users' ? 'bg-[#16a34a] text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <ShieldCheck className="w-5 h-5" /> Usuarios
            </button>
            <button
              onClick={() => { setAdminTab('settings'); setIsMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${adminTab === 'settings' ? 'bg-[#16a34a] text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <Lock className="w-5 h-5" /> Configuración
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
        {adminTab === 'dashboard' && <DashboardTab products={products} onRegularize={onRegularize} />}

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
                <thead className="bg-slate-100 text-slate-700 font-black uppercase text-xs tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3">Código / EAN</th>
                    <th className="p-3">Producto</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3">P. Unidad</th>
                    <th className="p-3">P. Medio</th>
                    <th className="p-3">P. Paquete</th>
                    <th className="p-3">Stock Base</th>
                    <th className="p-3">Vencimiento</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className={`hover:bg-slate-50/80 transition ${p.isActive === false ? 'opacity-50' : ''}`}>
                      <td className="p-3 font-mono text-slate-500">{p.barcode}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">
                          {p.name}
                          {p.isActive === false && <span className="ml-1 text-xs bg-slate-200 text-slate-600 px-1 rounded">OCULTO</span>}
                        </div>
                        <div className="text-xs text-slate-500">{p.flavorNote || p.packagingType}</div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {p.category}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-900">
                        S/ {p.presentations.unit.price.toFixed(2)}
                      </td>
                      <td className="p-3 font-mono text-slate-700">
                        {p.presentations.half ? `S/ ${p.presentations.half.price.toFixed(2)}` : '-'}
                        <span className="text-xs text-slate-400 block font-normal">
                          {p.presentations.half ? `(x${p.presentations.half.conversionFactor}u)` : ''}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-emerald-800 font-bold">
                        {p.presentations.pack ? `S/ ${p.presentations.pack.price.toFixed(2)}` : '-'}
                        <span className="text-xs text-slate-400 block font-normal">
                          {p.presentations.pack ? `(x${p.presentations.pack.conversionFactor}u)` : ''}
                        </span>
                      </td>
                      <td className="p-3 font-mono">
                        <strong className="text-slate-900">{p.stockInBaseUnits}</strong> {p.baseUnitName}s
                      </td>
                      <td className="p-3 font-mono text-slate-500">
                        {p.expirationDate ? (
                          <span className={
                            Math.ceil((new Date(p.expirationDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) <= 30
                              ? 'text-red-600 font-bold bg-red-50 px-1 py-0.5 rounded'
                              : ''
                          }>
                            {p.expirationDate}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setRestockProduct(p);
                              setRestockData({
                                addedQuantity: 0,
                                presentationKey: 'unit',
                                newExpirationDate: p.expirationDate || '',
                                unitPrice: p.presentations.unit.price
                              });
                            }}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs"
                            title="Ingreso Rápido (Reabastecer)"
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[3]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`¿Eliminar producto "${p.name}"?`)) {
                                void onDeleteProduct(p);
                              }
                            }}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void onToggleActive(p)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold"
                            title={p.isActive === false ? 'Mostrar en el catálogo de venta' : 'Ocultar del catálogo de venta'}
                          >
                            {p.isActive === false ? 'Mostrar' : 'Ocultar'}
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

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Fecha de Vencimiento</label>
                <input
                  type="date"
                  value={formData.expirationDate}
                  onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900"
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
                  <div className="text-xs text-slate-400 mb-2">Factor fijo: x1 base</div>
                  <label className="text-xs text-slate-600 block">Precio Venta (S/):</label>
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
                    <span className="text-xs text-slate-500">Factor:</span>
                    <input
                      type="number"
                      min="2"
                      value={formData.halfFactor}
                      onChange={(e) => setFormData({ ...formData, halfFactor: parseInt(e.target.value) || 6 })}
                      className="w-16 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs font-mono"
                    />
                    <span className="text-xs text-slate-500">unds</span>
                  </div>
                  <label className="text-xs text-slate-600 block">Precio Medio (S/):</label>
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
                    <span className="text-xs text-slate-500">Factor:</span>
                    <input
                      type="number"
                      min="2"
                      value={formData.packFactor}
                      onChange={(e) => setFormData({ ...formData, packFactor: parseInt(e.target.value) || 12 })}
                      className="w-16 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs font-mono"
                    />
                    <span className="text-xs text-slate-500">unds</span>
                  </div>
                  <label className="text-xs text-slate-600 block">Precio Mayorista (S/):</label>
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

        {/* TAB 4: HISTORIAL DE BOLETAS */}
        {adminTab === 'orders' && <OrdersTab />}

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
                        <span className="text-xs font-black uppercase bg-[#10b981] text-white px-2 py-0.5 rounded">
                          {promo.badgeText}
                        </span>
                        {promo.discountBadge && (
                          <span className="text-xs font-black bg-red-100 text-red-700 px-2 py-0.5 rounded">
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
                      <div className="pt-2 text-xs text-slate-400 font-mono">
                        Códigos de barra incluidos: {promo.associatedBarcodes.join(', ')}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs text-slate-400 line-through">S/ {promo.originalPrice.toFixed(2)}</span>
                        <span className="text-lg font-black text-amber-600 font-mono leading-none">
                          S/ {promo.offerPrice.toFixed(2)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if(confirm('¿Eliminar esta promoción?')) {
                            void onDeletePromo(promo.id);
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
                <h4 className="text-xs font-black uppercase text-slate-500">Precios</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-600 block">Precio Original (S/):</label>
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
                    <label className="text-xs text-slate-600 block">Precio Oferta (S/):</label>
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
                  <label className="text-xs text-slate-600 block">Texto de ahorro:</label>
                  <input
                    type="text"
                    value={promoFormData.savingText}
                    onChange={(e) => setPromoFormData({...promoFormData, savingText: e.target.value})}
                    className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h4 className="text-xs font-black uppercase text-slate-500">Productos del Combo</h4>
                <div>
                  <label className="text-xs text-slate-600 block mb-1">
                    Códigos de Barra (separados por comas):
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Ej: 7750182001011, 7750885002012"
                    value={promoFormData.associatedBarcodes}
                    onChange={(e) => setPromoFormData({...promoFormData, associatedBarcodes: e.target.value})}
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono resize-none"
                  />
                  <p className="text-xs text-slate-400 mt-1">
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
        {adminTab === 'deudores' && <DebtsPanel />}
        {adminTab === 'users' && <UsersTab />}
        {adminTab === 'customers' && <CustomersTab />}
        {adminTab === 'settings' && <SettingsTab />}
      </div>
    </div>

      {/* MODAL DE INGRESO RÁPIDO (REABASTECER) */}
      {restockProduct && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#10b981] p-4 text-white">
              <h3 className="font-black uppercase text-sm flex items-center gap-2">
                <Package className="w-4 h-4" />
                Ingreso Rápido
              </h3>
              <p className="text-emerald-100 text-xs mt-1 truncate">{restockProduct.name}</p>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const product = restockProduct;
                const conversionFactor = product.presentations[restockData.presentationKey]?.conversionFactor || 1;
                const totalAddedBaseUnits = restockData.addedQuantity * conversionFactor;
                // El servidor suma al stock actual (si era negativo, la reposición primero cubre lo vendido sin stock).
                const ok = await run(() => api!.restockProduct({
                  productId: product.id,
                  presentation: restockData.presentationKey,
                  quantity: restockData.addedQuantity,
                  expiration: restockData.newExpirationDate || null,
                  unitPrice: restockData.unitPrice !== product.presentations.unit.price ? restockData.unitPrice : null,
                }));
                if (!ok) return;
                setRestockProduct(null);
                setFeedbackMsg(`✓ Se sumaron ${totalAddedBaseUnits} unidades base a ${product.name}.`);
                setTimeout(() => setFeedbackMsg(null), 3000);
              }}
              className="p-5 space-y-4 text-left"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Cantidad a ingresar
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={restockData.addedQuantity || ''}
                    onChange={(e) => setRestockData({ ...restockData, addedQuantity: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono font-black text-slate-900 focus:outline-hidden focus:border-[#10b981]"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Formato
                  </label>
                  <select
                    value={restockData.presentationKey}
                    onChange={(e) => setRestockData({ ...restockData, presentationKey: e.target.value as PresentationType })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-[#10b981]"
                  >
                    <option value="unit">Unidades</option>
                    {restockProduct.presentations.quarter && (
                      <option value="quarter">Cuartos (x{restockProduct.presentations.quarter.conversionFactor})</option>
                    )}
                    {restockProduct.presentations.half && (
                      <option value="half">Medios/Tiras (x{restockProduct.presentations.half.conversionFactor})</option>
                    )}
                    {restockProduct.presentations.pack && (
                      <option value="pack">Fardos/Paquetes (x{restockProduct.presentations.pack.conversionFactor})</option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nueva Fecha de Venc.
                </label>
                <input
                  type="date"
                  value={restockData.newExpirationDate}
                  onChange={(e) => setRestockData({ ...restockData, newExpirationDate: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono text-slate-900 focus:outline-hidden focus:border-[#10b981]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Precio de Venta (Unidad)
                </label>
                <input
                  required
                  type="number"
                  step="0.10"
                  min="0"
                  value={restockData.unitPrice}
                  onChange={(e) => setRestockData({ ...restockData, unitPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-emerald-300 rounded-xl px-3 py-2 text-sm font-mono font-black text-emerald-800 focus:outline-hidden focus:border-[#10b981]"
                />
                <p className="text-xs text-slate-400 mt-1 leading-tight">Este precio se actualizará para todo el stock acumulado.</p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestockProduct(null)}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#10b981] hover:bg-[#059669] text-white font-black text-xs uppercase rounded-xl shadow-md transition active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
  </div>
  );
};
