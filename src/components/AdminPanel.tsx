import React from 'react';
import { ExtendedProduct } from '../data/mockProducts';
import { Order, PresentationType } from '../types/pos';
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
  Check, 
  Package, 
  Layers, 
  Sparkles, 
  Barcode, 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Tag,
  Eye,
  EyeOff,
  RefreshCw,
  ShoppingBag,
  ArrowLeft
} from 'lucide-react';

interface Props {
  products: ExtendedProduct[];
  onAddProduct: (product: ExtendedProduct) => void;
  onUpdateProduct: (product: ExtendedProduct) => void;
  onDeleteProduct: (productId: string) => void;
  onToggleActive: (productId: string) => void;
  orders: Order[];
  onCloseAdmin: () => void;
}

export const AdminPanel: React.FC<Props> = ({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onToggleActive,
  orders,
  onCloseAdmin,
}) => {
  // Estado de autenticación
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean>(false);
  const [email, setEmail] = React.useState<string>('admin@golosinas.com');
  const [password, setPassword] = React.useState<string>('admin123');
  const [loginError, setLoginError] = React.useState<string | null>(null);

  // Estados del panel
  const [adminTab, setAdminTab] = React.useState<'products' | 'new_product' | 'bulk_upload' | 'orders'>('products');
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('Todos');
  const [feedbackMsg, setFeedbackMsg] = React.useState<string | null>(null);

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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      (email === 'admin@golosinas.com' && password === 'admin123') ||
      password === '1234'
    ) {
      setIsAuthenticated(true);
      setLoginError(null);
    } else {
      setLoginError('Credenciales incorrectas. Usa admin@golosinas.com / admin123 o PIN 1234');
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

    const newProd: ExtendedProduct = {
      id: `prod_${Date.now()}`,
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
          id: `pres_${Date.now()}_u`,
          productId: `prod_${Date.now()}`,
          type: 'unit',
          label: `Unidad (1 ${formData.baseUnitName})`,
          shortLabel: 'UND',
          conversionFactor: 1,
          price: Number(formData.unitPrice),
          isDefault: true,
        },
        half: {
          id: `pres_${Date.now()}_h`,
          productId: `prod_${Date.now()}`,
          type: 'half',
          label: `Medio paquete (${formData.halfFactor} ${formData.baseUnitName}s)`,
          shortLabel: `MED (${formData.halfFactor}u)`,
          conversionFactor: Number(formData.halfFactor),
          price: Number(formData.halfPrice),
        },
        pack: {
          id: `pres_${Date.now()}_p`,
          productId: `prod_${Date.now()}`,
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
              Correo Electrónico
            </label>
            <input
              type="email"
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
            <div>User: <strong>admin@golosinas.com</strong></div>
            <div>Clave: <strong>admin123</strong> (o PIN <strong>1234</strong>)</div>
          </div>
          <button
            type="button"
            onClick={() => {
              setEmail('admin@golosinas.com');
              setPassword('admin123');
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
    <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 animate-in fade-in">
      {/* Top Header del Panel */}
      <div className="bg-[#16a34a] text-white p-4 md:p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white font-black">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg md:text-xl font-black uppercase tracking-tight">
                Panel Administrador · Catálogo & Inventario
              </h2>
              <span className="text-[10px] bg-white text-emerald-950 font-black px-2 py-0.5 rounded-full">
                ADMIN CONECTADO
              </span>
            </div>
            <p className="text-xs text-white/80">
              Gestión centralizada de productos, precios Unidad/Medio/Paquete y stock
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

      {/* Tabs Internas del Admin */}
      <div className="bg-slate-100 border-b border-slate-200 px-4 md:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAdminTab('products')}
            className={`px-3 py-1.5 rounded-lg font-black transition ${
              adminTab === 'products'
                ? 'bg-[#16a34a] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            Catálogo Activo ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setAdminTab('new_product')}
            className={`px-3 py-1.5 rounded-lg font-black transition flex items-center gap-1 ${
              adminTab === 'new_product'
                ? 'bg-[#16a34a] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>+ Nuevo Producto</span>
          </button>
          <button
            type="button"
            onClick={() => setAdminTab('bulk_upload')}
            className={`px-3 py-1.5 rounded-lg font-black transition flex items-center gap-1 ${
              adminTab === 'bulk_upload'
                ? 'bg-[#16a34a] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Carga Masiva (Lotes)</span>
          </button>
          <button
            type="button"
            onClick={() => setAdminTab('orders')}
            className={`px-3 py-1.5 rounded-lg font-black transition ${
              adminTab === 'orders'
                ? 'bg-[#16a34a] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            Pre-Ventas Emitidas ({orders.length})
          </button>
        </div>

        {feedbackMsg && (
          <div className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{feedbackMsg}</span>
          </div>
        )}
      </div>

      {/* CONTENIDO DE LA PESTAÑA SELECCIONADA */}
      <div className="p-4 md:p-6 max-h-[70vh] overflow-y-auto">
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
      </div>
    </div>
  );
};
