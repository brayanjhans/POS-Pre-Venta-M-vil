import React from 'react';
import { AndroidPhoneSimulator } from './components/AndroidPhoneSimulator';
import { AdminPanel } from './components/AdminPanel';
import { SchemaInspector } from './components/SchemaInspector';
import { RoadmapInspector } from './components/RoadmapInspector';
import { FastApiSpec } from './components/FastApiSpec';
import { Step2HookInspector } from './components/Step2HookInspector';
import { CashierCheckoutSimulator } from './components/CashierCheckoutSimulator';
import { DevOpsAndBuildHub } from './components/DevOpsAndBuildHub';
import { INITIAL_PRODUCTS, ExtendedProduct } from './data/mockProducts';
import { Order } from './types/pos';
import { 
  Database, 
  Smartphone, 
  ListOrdered, 
  Server, 
  ShieldCheck,
  Package,
  Plus,
  Radio,
  QrCode,
  FolderGit2
} from 'lucide-react';

export default function App() {
  const [products, setProducts] = React.useState<ExtendedProduct[]>(INITIAL_PRODUCTS);
  const [orders, setOrders] = React.useState<Order[]>([
    {
      id: 'PED-00891',
      createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      sellerId: 'VEND-012',
      sellerName: 'Carlos Mendoza',
      customerName: 'Bodega San Martín',
      customerRuc: '10458921821',
      paymentTerm: 'Contado',
      status: 'PENDIENTE_PAGO',
      items: [
        {
          productId: 'prod_001',
          productName: 'Inka Kola 500ml Pet',
          presentationType: 'pack',
          presentationLabel: 'Paquete fardo cerrado (12 botellas)',
          conversionFactor: 12,
          quantity: 2,
          unitPrice: 38.00,
          subtotal: 76.00,
          baseUnitsDeducted: 24,
        },
        {
          productId: 'prod_002',
          productName: 'Chocolate Sublime Clásico 30g',
          presentationType: 'pack',
          presentationLabel: 'Display cerrado (24 barras)',
          conversionFactor: 24,
          quantity: 1,
          unitPrice: 50.00,
          subtotal: 50.00,
          baseUnitsDeducted: 24,
        }
      ],
      totalAmount: 126.00,
      totalBaseUnits: 48,
      syncStatus: 'synced',
      qrPayload: 'PED-00891',
    }
  ]);
  const [activeTab, setActiveTab] = React.useState<'simulator' | 'cashier' | 'admin' | 'devops' | 'step1' | 'step2' | 'roadmap' | 'api'>('simulator');

  const pendingOrdersCount = orders.filter(o => o.status === 'PENDIENTE_PAGO').length;

  const handleAddProduct = (newProduct: ExtendedProduct) => {
    setProducts(prev => [newProduct, ...prev]);
  };

  const handleUpdateProduct = (updatedProduct: ExtendedProduct) => {
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
  };

  const handleDeleteProduct = (productId: string) => {
    setProducts(prev => prev.filter(p => p.id !== productId));
  };

  const handleToggleActive = (productId: string) => {
    // Implementado para visibilidad
  };

  const handleOrderCreated = (order: Order) => {
    setOrders(prev => [order, ...prev]);
  };

  const handleOrderPaid = (orderId: string, paymentMethod: string) => {
    // Buscar la orden para descontar inventario
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) return;

    // Actualizar estado del pedido a PAGADO
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          status: 'PAGADO',
          paymentMethod,
          paidAt: new Date().toISOString(),
        };
      }
      return o;
    }));

    // Descontar inventario real en base units
    setProducts(prevProducts => {
      return prevProducts.map(prod => {
        const itemInOrder = targetOrder.items.find(i => i.productId === prod.id);
        if (itemInOrder) {
          const newStock = Math.max(0, prod.stockInBaseUnits - itemInOrder.baseUnitsDeducted);
          return {
            ...prod,
            stockInBaseUnits: newStock,
          };
        }
        return prod;
      });
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-[#16a34a] selection:text-white">
      {/* Top Navbar Principal */}
      <header className="sticky top-0 z-40 bg-zinc-900 border-b border-zinc-800 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#16a34a] flex items-center justify-center text-white font-black text-xl shadow-md shadow-emerald-900/30">
              🍬
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-white tracking-wide uppercase">
                  POS Pre-Venta & Kiosk Golosinas
                </h1>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Android & SAT Terminal
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Golosinas & Bebidas · Buscador +500 productos · Panel Admin con Login · ESC/POS QR
              </p>
            </div>
          </div>

          {/* Navegación Superior */}
          <nav className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800 overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-black transition whitespace-nowrap ${
                activeTab === 'simulator'
                  ? 'bg-[#16a34a] text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Terminal POS (Pre-Venta)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('cashier')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-black transition whitespace-nowrap relative ${
                activeTab === 'cashier'
                  ? 'bg-[#15803d] text-white shadow-md'
                  : 'text-amber-300 hover:text-white'
              }`}
            >
              <QrCode className="w-3.5 h-3.5 text-amber-400" />
              <span>Caja Central (Cobro QR)</span>
              {pendingOrdersCount > 0 && (
                <span className="bg-[#ea580c] text-white text-[10px] font-black px-1.5 py-0.2 rounded-full ml-0.5 animate-pulse">
                  {pendingOrdersCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('devops')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-black transition whitespace-nowrap ${
                activeTab === 'devops'
                  ? 'bg-[#15803d] text-white shadow-md'
                  : 'text-amber-300 hover:text-white'
              }`}
            >
              <FolderGit2 className="w-3.5 h-3.5 text-amber-400" />
              <span>BD, Git & APK Hub</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-black transition whitespace-nowrap ${
                activeTab === 'admin'
                  ? 'bg-[#16a34a] text-white shadow-md'
                  : 'text-amber-400 hover:text-amber-300'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Panel Admin (Login & Subir)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('step1')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-black transition whitespace-nowrap ${
                activeTab === 'step1'
                  ? 'bg-[#16a34a] text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Paso 1: Esquema BD</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('step2' as any)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-black transition whitespace-nowrap ${
                (activeTab as any) === 'step2'
                  ? 'bg-[#16a34a] text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Paso 2: Hook Pistola HID</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('roadmap')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-black transition whitespace-nowrap ${
                activeTab === 'roadmap'
                  ? 'bg-[#16a34a] text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Plan de 5 Pasos</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('api')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-black transition whitespace-nowrap ${
                activeTab === 'api'
                  ? 'bg-[#16a34a] text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>FastAPI Backend</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Área de Trabajo Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 flex flex-col items-center">
        {activeTab === 'simulator' && (
          <div className="w-full flex flex-col items-center space-y-4">
            <div className="text-center max-w-2xl mb-1">
              <h2 className="text-lg md:text-xl font-black text-white flex items-center justify-center gap-2">
                <span>Terminal de Toma de Pedidos & Pre-Venta</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Nav bar con pestañas funcionales <strong>CATÁLOGO</strong> y <strong>OFERTAS</strong>, botón lateral ☰ con acceso directo al <strong>Panel Admin</strong>, buscador para cientos de productos, lector láser HID y simulación de cámara.
              </p>
            </div>

            <AndroidPhoneSimulator 
              products={products}
              orders={orders}
              onOrderCreated={handleOrderCreated}
              onOpenAdmin={() => setActiveTab('admin')}
              onGoToCashier={(orderId) => setActiveTab('cashier')}
            />
          </div>
        )}

        {activeTab === 'cashier' && (
          <div className="w-full flex justify-center py-2">
            <CashierCheckoutSimulator
              orders={orders}
              products={products}
              onOrderPaid={handleOrderPaid}
              onOpenMobileTerminal={() => setActiveTab('simulator')}
            />
          </div>
        )}

        {activeTab === 'devops' && (
          <div className="w-full flex justify-center py-2">
            <DevOpsAndBuildHub />
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="w-full flex justify-center py-2">
            <AdminPanel
              products={products}
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleUpdateProduct}
              onDeleteProduct={handleDeleteProduct}
              onToggleActive={handleToggleActive}
              orders={orders}
              onCloseAdmin={() => setActiveTab('simulator')}
            />
          </div>
        )}

        {activeTab === 'step1' && (
          <div className="w-full max-w-5xl space-y-6">
            <SchemaInspector />
          </div>
        )}

        {activeTab === 'step2' && (
          <div className="w-full max-w-5xl space-y-6">
            <Step2HookInspector />
          </div>
        )}

        {activeTab === 'roadmap' && (
          <div className="w-full max-w-5xl space-y-6">
            <RoadmapInspector onSelectStep={(step) => {
              if (step === 1) setActiveTab('step1');
            }} />
          </div>
        )}

        {activeTab === 'api' && (
          <div className="w-full max-w-5xl space-y-6">
            <FastApiSpec />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-zinc-950 border-t border-zinc-800 py-3 px-6 text-center text-xs text-slate-500">
        <p>
          Sistema POS Pre-Venta Golosinas y Bebidas · React Native (Expo) + NativeWind + Panel Admin con Login + ESC/POS QR
        </p>
      </footer>
    </div>
  );
}
