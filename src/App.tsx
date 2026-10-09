import React from 'react';
import { PosProvider, usePos } from './state/PosContext';
import { isBackendConfigured } from './services/rpc';
import { LoginScreen } from './features/auth/LoginScreen';
import { ChangePinScreen } from './features/auth/ChangePinScreen';
import { ShiftOpener } from './features/shift/ShiftOpener';
import { PreventaScreen } from './features/preventa/PreventaScreen';
import { CajaScreen } from './features/caja/CajaScreen';
import { AdminPanel } from './features/admin/AdminPanel';
import { StatusBar, type MainView } from './app/StatusBar';
import { DialogProvider } from './app/DialogProvider';

const FullScreenMessage: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div className="min-h-full flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center gap-3">
    <h1 className="text-xl font-black">{title}</h1>
    {children && <div className="text-sm text-slate-300 max-w-sm">{children}</div>}
  </div>
);

const MainShell: React.FC = () => {
  const { session } = usePos();
  const role = session!.user.role;
  const [adminView, setAdminView] = React.useState<MainView>('admin');
  // Cada rol solo ve su pantalla; el admin puede cambiar entre las tres.
  const view: MainView = role === 'admin' ? adminView : role === 'cajero' ? 'caja' : 'preventa';

  return (
    <div className="h-full w-full overflow-hidden bg-slate-900 text-ink flex flex-col font-sans selection:bg-brand-600 selection:text-white">
      <StatusBar view={view} onChangeView={role === 'admin' ? setAdminView : undefined} />
      <div className="flex-1 overflow-hidden">
        {view === 'preventa' && <PreventaScreen />}
        {view === 'caja' && <CajaScreen />}
        {view === 'admin' && <AdminPanel />}
      </div>
    </div>
  );
};

const AppRoutes: React.FC = () => {
  const { ready, session } = usePos();

  if (!isBackendConfigured) {
    return (
      <FullScreenMessage title="Falta configurar el servidor">
        Defina <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> en el archivo <code>.env</code>
        (o en los Secrets de GitHub para el APK) y vuelva a compilar.
      </FullScreenMessage>
    );
  }
  if (!ready) return <FullScreenMessage title="Cargando…" />;
  if (!session) return <LoginScreen />;
  if (session.user.mustChangePin) return <ChangePinScreen />;
  // El admin no maneja caja propia; vendedor y cajero trabajan siempre dentro de un turno.
  if (session.user.role !== 'admin' && !session.openShift) return <ShiftOpener />;
  return <MainShell />;
};

export default function App() {
  return (
    <DialogProvider>
      <PosProvider>
        <AppRoutes />
      </PosProvider>
    </DialogProvider>
  );
}
