import React from 'react';
import type { PresentationType, Product, PromoBanner } from '../../types/pos';
import { PRODUCT_CATEGORIES } from '../../types/pos';
import { usePos } from '../../state/PosContext';
import { HeaderButton, ScreenHeader } from '../../app/ScreenHeader';
import { MenuButton, ProfileSection } from '../../app/ProfileMenu';
import { useDialog } from '../../app/DialogProvider';
import { parseAmount } from '../../domain/money';
import { DashboardTab } from './DashboardTab';
import { CatalogTab } from './CatalogTab';
import { ROTATION, SECTION_TONE, TONE } from '../../app/tones';
import { EmptyState, PageTitle, PillButton } from '../../app/ui';
import { formatSoles } from '../../domain/money';
import { SalesTab } from './SalesTab';
import { InventoryTab } from './InventoryTab';
import { stockAlerts } from '../../domain/stock';
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
  ChartColumnBig,
  Warehouse,
  RefreshCw,
  LayoutDashboard,
  TrendingUp,
  Calendar,
  Package,
  Clock,
  Users,
  Receipt
} from 'lucide-react';

/** Ícono de cada sección en la cabecera (el mismo del menú). */
const SECTION_ICON: Record<string, React.ReactNode> = {
  dashboard: <LayoutDashboard className="w-5 h-5" />,
  sales: <ChartColumnBig className="w-5 h-5" />,
  inventory: <Warehouse className="w-5 h-5" />,
  products: <Package className="w-5 h-5" />,
  new_product: <Plus className="w-5 h-5" />,
  promos: <Star className="w-5 h-5" />,
  new_promo: <Star className="w-5 h-5" />,
  orders: <ShoppingBag className="w-5 h-5" />,
  customers: <Users className="w-5 h-5" />,
  deudores: <Receipt className="w-5 h-5" />,
  users: <ShieldCheck className="w-5 h-5" />,
  settings: <Lock className="w-5 h-5" />,
};

const ADMIN_SECTION_LABELS = {
  dashboard: 'Resumen',
  sales: 'Ventas',
  inventory: 'Inventario',
  products: 'Catálogo',
  new_product: 'Nuevo producto',
  orders: 'Boletas',
  promos: 'Combos y promociones',
  new_promo: 'Nueva promoción',
  deudores: 'Libreta de fiados',
  users: 'Usuarios',
  customers: 'Clientes',
  settings: 'Configuración',
} as const;

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
  const [adminTab, setAdminTab] = React.useState<'dashboard' | 'sales' | 'inventory' | 'products' | 'new_product' | 'orders' | 'promos' | 'new_promo' | 'deudores' | 'users' | 'customers' | 'settings'>('dashboard');
  const [feedbackMsg, setFeedbackMsg] = React.useState<string | null>(null);

  // Formulario de nuevo producto

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

  const alerts = stockAlerts(products);
  const stockCount = alerts.out.length + alerts.low.length;

  const openRestock = (p: Product) => {
    setRestockProduct(p);
    setRestockData({ addedQuantity: 0, presentationKey: 'unit', newExpirationDate: p.expirationDate || '', unitPrice: p.presentations.unit.price });
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

  return (
    <div className="w-full h-full max-w-5xl mx-auto bg-white md:rounded-3xl md:shadow-2xl md:border md:border-ink/10 flex flex-col overflow-hidden text-ink animate-in fade-in relative">
      {/* Cabecera: muestra la sección actual */}
      <ScreenHeader
        tone={SECTION_TONE[adminTab] ?? 'mint'}
        icon={SECTION_ICON[adminTab] ?? <ShieldCheck className="w-5 h-5" />}
        title={ADMIN_SECTION_LABELS[adminTab]}
        subtitle={`Administración · ${products.filter(p => p.isActive !== false).length} productos activos`}
        leading={
          <MenuButton onClick={() => setIsMenuOpen(true)} className="border border-ink/10 bg-white text-ink lg:hidden" />
        }
        actions={
          <HeaderButton onClick={() => void refreshCatalog()} aria-label="Actualizar datos">
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Actualizar</span>
          </HeaderButton>
        }
      />

      {/* Layout Flex (Menú Lateral + Contenido) */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Drawer / Menú Lateral Hamburguesa */}
        <div 
          className={`absolute inset-y-0 left-0 z-30 flex w-72 flex-col overflow-y-auto bg-ink text-white shadow-2xl transform transition-transform duration-300 lg:relative lg:translate-x-0 ${
            isMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-4 border-b border-white/10 flex items-center justify-between lg:hidden">
            <span className="font-display text-lg font-bold text-white">Administración</span>
            <button onClick={() => setIsMenuOpen(false)} className="p-1 rounded-lg hover:bg-ink text-ink/45">
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="p-3 space-y-1 text-sm font-bold">
            <button
              onClick={() => { setAdminTab('dashboard'); setIsMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-2xl text-[15px] transition ${adminTab === 'dashboard' ? 'bg-white/12 text-white ring-1 ring-white/15' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink ${TONE[SECTION_TONE.dashboard].bg}`}><LayoutDashboard className="w-5 h-5" /></span> Resumen
            </button>
            <button
              onClick={() => { setAdminTab('sales'); setIsMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-2xl text-[15px] transition ${adminTab === 'sales' ? 'bg-white/12 text-white ring-1 ring-white/15' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink ${TONE[SECTION_TONE.sales].bg}`}><ChartColumnBig className="w-5 h-5" /></span> Ventas y reportes
            </button>
            <button
              onClick={() => { setAdminTab('inventory'); setIsMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-2xl text-[15px] transition ${adminTab === 'inventory' ? 'bg-white/12 text-white ring-1 ring-white/15' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink ${TONE[SECTION_TONE.inventory].bg}`}><Warehouse className="w-5 h-5" /></span> Inventario
              {stockCount > 0 && (
                <span className="ml-auto min-w-6 rounded-full bg-fresa px-1.5 py-0.5 text-center text-xs font-bold text-white" aria-label={`${stockCount} por reponer`}>
                  {stockCount}
                </span>
              )}
            </button>
            <button
              onClick={() => { setAdminTab('products'); setIsMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-2xl text-[15px] transition ${adminTab === 'products' ? 'bg-white/12 text-white ring-1 ring-white/15' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink ${TONE[SECTION_TONE.products].bg}`}><Package className="w-5 h-5" /></span> Catálogo ({products.length})
            </button>
            <button
              onClick={() => { setAdminTab('promos'); setIsMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-2xl text-[15px] transition ${adminTab === 'promos' || adminTab === 'new_promo' ? 'bg-white/12 text-white ring-1 ring-white/15' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink ${TONE[SECTION_TONE.promos].bg}`}><Star className="w-5 h-5" /></span> Combos y promociones
            </button>
            <button
              onClick={() => { setAdminTab('new_product'); setIsMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-2xl text-[15px] transition ${adminTab === 'new_product' ? 'bg-white/12 text-white ring-1 ring-white/15' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink ${TONE[SECTION_TONE.new_product].bg}`}><Plus className="w-5 h-5 stroke-[3]" /></span> Nuevo producto
            </button>
            <button
              onClick={() => { setAdminTab('orders'); setIsMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-2xl text-[15px] transition ${adminTab === 'orders' ? 'bg-white/12 text-white ring-1 ring-white/15' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink ${TONE[SECTION_TONE.orders].bg}`}><ShoppingBag className="w-5 h-5" /></span> Boletas ({orders.length})
            </button>
            <button
              onClick={() => { setAdminTab('customers'); setIsMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-2xl text-[15px] transition ${adminTab === 'customers' ? 'bg-white/12 text-white ring-1 ring-white/15' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink ${TONE[SECTION_TONE.customers].bg}`}><Users className="w-5 h-5" /></span> Clientes
            </button>
            <button
              onClick={() => { setAdminTab('deudores'); setIsMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-2xl text-[15px] transition ${adminTab === 'deudores' ? 'bg-white/12 text-white ring-1 ring-white/15' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink ${TONE[SECTION_TONE.deudores].bg}`}><Receipt className="w-5 h-5" /></span> Libreta de fiados
            </button>
            <button
              onClick={() => { setAdminTab('users'); setIsMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-2xl text-[15px] transition ${adminTab === 'users' ? 'bg-white/12 text-white ring-1 ring-white/15' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink ${TONE[SECTION_TONE.users].bg}`}><ShieldCheck className="w-5 h-5" /></span> Usuarios
            </button>
            <button
              onClick={() => { setAdminTab('settings'); setIsMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-2xl text-[15px] transition ${adminTab === 'settings' ? 'bg-white/12 text-white ring-1 ring-white/15' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink ${TONE[SECTION_TONE.settings].bg}`}><Lock className="w-5 h-5" /></span> Configuración
            </button>
          </nav>
          <div className="mt-auto p-4">
            <ProfileSection tone="dark" onDone={() => setIsMenuOpen(false)} />
          </div>
        </div>

        {/* Backdrop para móvil */}
        {isMenuOpen && (
          <div 
            className="absolute inset-0 bg-black/60 z-20 lg:hidden"
            onClick={() => setIsMenuOpen(false)}
          />
        )}

        {/* Contenido Principal Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-paper">

        {feedbackMsg && (
          <div className="text-xs font-bold text-brand-800 bg-brand-50 px-3 py-1 mb-4 rounded-lg border border-brand-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-brand-600" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* TAB 0: DASHBOARD */}
        {adminTab === 'dashboard' && (
          <DashboardTab products={products} onRegularize={onRegularize} onOpenInventory={() => setAdminTab('inventory')} />
        )}
        {adminTab === 'sales' && <SalesTab />}
        {adminTab === 'inventory' && <InventoryTab products={products} onRestock={openRestock} />}

        {/* TAB 1: LISTADO Y GESTIÓN DE PRODUCTOS */}
        {(adminTab === 'products' || adminTab === 'new_product') && (
          <CatalogTab
            products={products}
            onSave={onAddProduct}
            onDelete={onDeleteProduct}
            onToggleActive={onToggleActive}
            onRestock={openRestock}
            startCreating={adminTab === 'new_product'}
            onCreatingDone={() => { if (adminTab === 'new_product') setAdminTab('products'); }}
          />
        )}

        {adminTab === 'orders' && <OrdersTab />}

        {/* TAB 5: GESTIÓN DE PROMOCIONES Y COMBOS */}
        {adminTab === 'promos' && (
          <div className="mx-auto max-w-3xl space-y-4">
            <PageTitle
              title="Combos activos"
              subtitle="Aparecen arriba en el catálogo de Pre-Venta y en Ofertas."
              action={<PillButton onClick={() => setAdminTab('new_promo')}><Plus className="h-5 w-5" /> Nueva</PillButton>}
            />
            {promos.length === 0 ? (
              <EmptyState icon={<Star className="h-6 w-6" />} tone="pink" title="No hay promociones"
                hint="Cree un combo para que los vendedores lo ofrezcan." action={<PillButton onClick={() => setAdminTab('new_promo')}><Plus className="h-5 w-5" /> Nueva promoción</PillButton>} />
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {promos.map((promo, i) => (
                  <li key={promo.id} className={`relative flex flex-col justify-between overflow-hidden rounded-3xl p-5 text-ink ${TONE[ROTATION[i % ROTATION.length]].bg}`}>
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                        <span>{promo.badgeText}</span>
                        {promo.discountBadge && <span className="rounded-full bg-fresa px-2 text-white">{promo.discountBadge}</span>}
                      </div>
                      <h4 className="mt-1.5 font-display text-xl font-bold leading-tight">{promo.title}</h4>
                      <p className="mt-1 text-[15px] text-ink/75 line-clamp-2">{promo.subtitle}</p>
                      <p className="mt-2 text-sm text-ink/60">{promo.associatedBarcodes.length === 1 ? '1 producto' : `${promo.associatedBarcodes.length} productos`} en el combo</p>
                    </div>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <div className="text-sm text-ink/60 line-through">Antes {formatSoles(promo.originalPrice)}</div>
                        <div className="font-display text-[30px] font-bold leading-none">{formatSoles(promo.offerPrice)}</div>
                      </div>
                      <button type="button" aria-label="Eliminar promoción"
                        onClick={async () => {
                          if (await dialog.confirm(`Se quitará del catálogo de los vendedores.`, { title: `¿Eliminar «${promo.title}»?`, tone: 'danger', confirmText: 'Eliminar' })) {
                            void onDeletePromo(promo.id);
                          }
                        }}
                        className="squish flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-fresa">
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* TAB 6: CREAR NUEVA PROMOCIÓN */}
        {adminTab === 'new_promo' && (
          <form onSubmit={handleCreatePromo} className="mx-auto max-w-2xl space-y-4 rounded-3xl bg-white p-5">
            <h3 className="font-display text-[26px] font-bold leading-tight">Nueva promoción</h3>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-bold text-ink">Título Principal (*):</label>
                <input
                  required
                  type="text"
                  placeholder="Ej: COMBO INKA KOLA + SUBLIME"
                  value={promoFormData.title}
                  onChange={(e) => setPromoFormData({...promoFormData, title: e.target.value})}
                  className="h-12 w-full rounded-2xl border-2 border-ink/10 bg-white px-3 text-[15px] font-semibold text-ink outline-none focus:border-brand-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-bold text-ink">Subtítulo / Descripción:</label>
                <input
                  type="text"
                  placeholder="Ej: Gaseosa helada + display completo..."
                  value={promoFormData.subtitle}
                  onChange={(e) => setPromoFormData({...promoFormData, subtitle: e.target.value})}
                  className="h-12 w-full rounded-2xl border-2 border-ink/10 bg-white px-3 text-[15px] text-ink outline-none focus:border-brand-600"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-sm font-bold text-ink">Etiqueta Principal:</label>
                <input
                  type="text"
                  value={promoFormData.badgeText}
                  onChange={(e) => setPromoFormData({...promoFormData, badgeText: e.target.value})}
                  className="h-12 w-full rounded-2xl border-2 border-ink/10 bg-white px-3 text-[15px] text-ink outline-none focus:border-brand-600"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-ink">Tag Secundario:</label>
                <input
                  type="text"
                  value={promoFormData.tag}
                  onChange={(e) => setPromoFormData({...promoFormData, tag: e.target.value})}
                  className="h-12 w-full rounded-2xl border-2 border-ink/10 bg-white px-3 text-[15px] text-ink outline-none focus:border-brand-600"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-ink">Etiqueta Descuento (Roja):</label>
                <input
                  type="text"
                  placeholder="Ej: -20% OFF"
                  value={promoFormData.discountBadge}
                  onChange={(e) => setPromoFormData({...promoFormData, discountBadge: e.target.value})}
                  className="h-12 w-full rounded-2xl border-2 border-ink/10 bg-white px-3 text-[15px] text-ink outline-none focus:border-brand-600"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-3 rounded-2xl bg-pink/30 p-4">
                <h4 className="font-display text-lg font-bold text-ink">Precios</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-bold text-ink">Precio Original (S/):</label>
                    <input
                      type="number"
                      step="0.10"
                      min="0"
                      value={promoFormData.originalPrice}
                      onChange={(e) => setPromoFormData({...promoFormData, originalPrice: parseFloat(e.target.value) || 0})}
                      className="h-11 w-full rounded-2xl border-2 border-ink/10 bg-white px-3 font-display text-[15px] font-bold outline-none focus:border-brand-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-ink">Precio Oferta (S/):</label>
                    <input
                      required
                      type="number"
                      step="0.10"
                      min="0"
                      value={promoFormData.offerPrice}
                      onChange={(e) => setPromoFormData({...promoFormData, offerPrice: parseFloat(e.target.value) || 0})}
                      className="h-11 w-full rounded-2xl border-2 border-brand-600 bg-white px-3 font-display text-[15px] font-bold text-ink outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-ink">Texto de ahorro:</label>
                  <input
                    type="text"
                    value={promoFormData.savingText}
                    onChange={(e) => setPromoFormData({...promoFormData, savingText: e.target.value})}
                    className="h-11 w-full rounded-2xl border-2 border-ink/10 bg-white px-3 text-[15px] outline-none focus:border-brand-600"
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-2xl bg-pink/30 p-4">
                <h4 className="font-display text-lg font-bold text-ink">Productos del Combo</h4>
                <div>
                  <label className="mb-1 block text-sm font-bold text-ink">
                    Códigos de Barra (separados por comas):
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Ej: 7750182001011, 7750885002012"
                    value={promoFormData.associatedBarcodes}
                    onChange={(e) => setPromoFormData({...promoFormData, associatedBarcodes: e.target.value})}
                    className="w-full resize-none rounded-2xl border-2 border-ink/10 bg-white px-3 py-2 font-display text-[15px] outline-none focus:border-brand-600"
                  />
                  <p className="mt-1 text-sm text-ink-soft">
                    Al tocar "Añadir Combo", estos códigos se escanearán y añadirán al carrito de forma automática.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAdminTab('promos')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-ink-soft hover:text-ink"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="squish flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-bold text-white"
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
      {restockProduct && (() => {
        const product = restockProduct;
        const factor = product.presentations[restockData.presentationKey]?.conversionFactor || 1;
        const added = restockData.addedQuantity * factor;
        const PRES = [['unit', 'Unidades'], ['quarter', 'Cuartos'], ['half', 'Medios'], ['pack', 'Paquetes']] as const;
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setRestockProduct(null)}>
            <form
              onClick={e => e.stopPropagation()}
              onSubmit={async (e) => {
                e.preventDefault();
                if (restockData.addedQuantity < 1) return;
                // El servidor suma al stock actual (si era negativo, la reposición primero cubre lo vendido sin stock).
                const ok = await run(() => api!.restockProduct({
                  productId: product.id,
                  presentation: restockData.presentationKey,
                  quantity: restockData.addedQuantity,
                  expiration: restockData.newExpirationDate || null,
                  unitPrice: null,
                }));
                if (!ok) return;
                setRestockProduct(null);
                setFeedbackMsg(`Se sumaron ${added} ${product.baseUnitName}s a ${product.name}.`);
                setTimeout(() => setFeedbackMsg(null), 3000);
              }}
              className="w-full max-w-md rounded-t-3xl bg-paper p-5 text-ink shadow-2xl sm:rounded-3xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-[22px] font-bold leading-tight">Reponer stock</h2>
                  <p className="truncate text-[15px] text-ink-soft">{product.name}</p>
                </div>
                <button type="button" onClick={() => setRestockProduct(null)} aria-label="Cerrar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-soft hover:bg-ink/5">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-5">
                <span className="mb-1.5 block text-sm font-bold">Llegó en</span>
                <div className="flex flex-wrap gap-2">
                  {PRES.filter(([k]) => product.presentations[k]).map(([k, name]) => {
                    const f = product.presentations[k]!.conversionFactor;
                    return (
                      <button key={k} type="button" aria-pressed={restockData.presentationKey === k}
                        onClick={() => setRestockData({ ...restockData, presentationKey: k })}
                        className={`h-11 rounded-xl px-3.5 text-sm font-bold transition ${restockData.presentationKey === k ? 'bg-ink text-white' : 'border border-ink/15 bg-white'}`}>
                        {name}{f > 1 ? ` de ${f}` : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-bold" htmlFor="rs-qty">Cantidad</label>
                  <input id="rs-qty" required inputMode="numeric" autoFocus value={restockData.addedQuantity || ''}
                    onChange={e => setRestockData({ ...restockData, addedQuantity: parseInt(e.target.value.replace(/\D/g, ''), 10) || 0 })}
                    className="h-12 w-full rounded-xl border border-ink/15 bg-white px-3 font-display text-lg font-bold outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-bold" htmlFor="rs-exp">Vence <span className="font-normal text-ink-soft">(opcional)</span></label>
                  <input id="rs-exp" type="date" value={restockData.newExpirationDate}
                    onChange={e => setRestockData({ ...restockData, newExpirationDate: e.target.value })}
                    className="h-12 w-full rounded-xl border border-ink/15 bg-white px-3 text-[15px] outline-none focus:border-brand-600" />
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-white p-3 text-[15px]">
                <div className="flex justify-between"><span className="text-ink-soft">Hay ahora</span><span className="font-display font-bold">{product.stockInBaseUnits} {product.baseUnitName}s</span></div>
                <div className="flex justify-between"><span className="text-ink-soft">Entran</span><span className="font-display font-bold text-brand-700">+ {added}</span></div>
                <div className="mt-1 flex justify-between border-t border-ink/10 pt-1"><span className="font-bold">Quedarán</span><span className="font-display text-lg font-bold">{product.stockInBaseUnits + added} {product.baseUnitName}s</span></div>
              </div>

              <button type="submit" disabled={restockData.addedQuantity < 1}
                className="mt-4 h-14 w-full rounded-2xl bg-brand-600 text-base font-bold text-white transition active:scale-[0.99] disabled:opacity-40">
                Sumar al stock
              </button>
            </form>
          </div>
        );
      })()}
  </div>
  );
};
