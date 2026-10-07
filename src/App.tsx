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
import { INITIAL_PROMOS } from './data/mockPromos';
import { Order, PromoBanner } from './types/pos';
import { 
  Database, 
  Smartphone, 
  ListOrdered, 
  Server, 
  ShieldCheck,
  Radio,
  QrCode,
  FolderGit2
} from 'lucide-react';

export default function App() {
  const [products, setProducts] = React.useState<ExtendedProduct[]>(INITIAL_PRODUCTS);
  const [promos, setPromos] = React.useState<PromoBanner[]>(INITIAL_PROMOS);
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
          productId: 'prod_008',
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

  const handleToggleActive = (_productId: string) => {
    // TODO: Implementar toggle de visibilidad
  };

  const handleAddPromo = (newPromo: PromoBanner) => {
    setPromos(prev => [newPromo, ...prev]);
  };

  const handleUpdatePromo = (updatedPromo: PromoBanner) => {
    setPromos(prev => prev.map(p => p.id === updatedPromo.id ? updatedPromo : p));
  };

  const handleDeletePromo = (promoId: string) => {
    setPromos(prev => prev.filter(p => p.id !== promoId));
  };

  const handleOrderCreated = (order: Order) => {
    setOrders(prev => [order, ...prev]);
  };

  const handleOrderPaid = (orderId: string, paymentMethod: string, paidAmount?: number, debtAmount?: number) => {
    // Buscar la orden para descontar inventario
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) return;

    const isFiado = debtAmount && debtAmount > 0;

    // Actualizar estado del pedido
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          status: isFiado ? 'FIADO' : 'PAGADO',
          paymentMethod,
          paidAt: new Date().toISOString(),
          paidAmount,
          debtAmount
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

  const handlePayDebt = (orderId: string, amount: number) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId && o.status === 'FIADO' && o.debtAmount !== undefined) {
        const newPaidAmount = (o.paidAmount || 0) + amount;
        const newDebt = Math.max(0, o.debtAmount - amount);
        
        return {
          ...o,
          paidAmount: newPaidAmount,
          debtAmount: newDebt,
          status: newDebt === 0 ? 'PAGADO' : 'FIADO',
          paidAt: newDebt === 0 ? new Date().toISOString() : o.paidAt,
        };
      }
      return o;
    }));
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-white text-slate-900 flex flex-col font-sans selection:bg-[#16a34a] selection:text-white">
      {activeTab === 'simulator' && (
        <AndroidPhoneSimulator 
          products={products}
          promos={promos}
          orders={orders}
          onOrderCreated={handleOrderCreated}
          onOpenAdmin={() => setActiveTab('admin')}
          onGoToCashier={(orderId) => setActiveTab('cashier')}
        />
      )}

      {activeTab === 'cashier' && (
        <CashierCheckoutSimulator
          orders={orders}
          products={products}
          onOrderPaid={handleOrderPaid}
          onOpenMobileTerminal={() => setActiveTab('simulator')}
        />
      )}

      {activeTab === 'admin' && (
        <AdminPanel
          products={products}
          promos={promos}
          onAddProduct={handleAddProduct}
          onUpdateProduct={handleUpdateProduct}
          onDeleteProduct={handleDeleteProduct}
          onToggleActive={handleToggleActive}
          onAddPromo={handleAddPromo}
          onUpdatePromo={handleUpdatePromo}
          onDeletePromo={handleDeletePromo}
          orders={orders}
          onCloseAdmin={() => setActiveTab('simulator')}
          onPayDebt={handlePayDebt}
        />
      )}
    </div>
  );
}
