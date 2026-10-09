import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { CloudOff, LayoutDashboard, Lock, LogOut, Menu, QrCode, RefreshCw, ShoppingBag, UserRound, Wifi } from 'lucide-react';
import { usePos } from '../state/PosContext';
import { ShiftCloseModal } from '../features/shift/ShiftCloseModal';
import { ROLE_LABELS } from '../types/pos';
import { useDialog } from './DialogProvider';

/*
 * "Mi perfil" dentro del menú ☰ de cada pantalla (reemplaza la barra superior):
 * usuario, conexión, operaciones por enviar, cambio de pantalla (admin), cerrar caja y salir.
 */

export type MainView = 'preventa' | 'caja' | 'admin';

const VIEWS: { view: MainView; label: string; icon: React.ReactNode }[] = [
  { view: 'preventa', label: 'Pre-Venta', icon: <ShoppingBag className="h-5 w-5" /> },
  { view: 'caja', label: 'Caja', icon: <QrCode className="h-5 w-5" /> },
  { view: 'admin', label: 'Administración', icon: <LayoutDashboard className="h-5 w-5" /> },
];

interface Shell {
  view: MainView;
  /** Solo el admin cambia de pantalla; para los demás es undefined. */
  setView?: (view: MainView) => void;
}
const ShellContext = React.createContext<Shell>({ view: 'preventa' });
export const ShellProvider = ShellContext.Provider;

/** Estado de sincronización para el puntito del botón ☰. */
const useSyncState = () => {
  const { online, outbox, syncing } = usePos();
  const failed = outbox.filter(op => op.error).length;
  return { online, syncing, pending: outbox.length, failed, alert: !online || outbox.length > 0 };
};

/** Botón ☰ con un puntito cuando no hay internet o hay operaciones por enviar. */
export const MenuButton: React.FC<{ onClick: () => void; className?: string }> = ({ onClick, className = '' }) => {
  const { online, pending, failed, alert } = useSyncState();
  const dot = failed ? 'bg-fresa' : !online ? 'bg-tag' : pending ? 'bg-sky-500' : '';
  return (
    <button type="button" onClick={onClick} aria-label={alert ? 'Abrir menú (hay avisos)' : 'Abrir menú'}
      className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition active:scale-95 ${className}`}>
      <Menu className="h-5 w-5" />
      {alert && <span className={`absolute right-1.5 top-1.5 h-3 w-3 rounded-full ring-2 ring-white ${dot}`} />}
    </button>
  );
};

interface SectionProps {
  /** Fondo del menú donde se muestra (claro u oscuro). */
  tone?: 'light' | 'dark';
  /** Se llama tras elegir una opción, para cerrar el menú. */
  onDone?: () => void;
}

export const ProfileSection: React.FC<SectionProps> = ({ tone = 'light', onDone }) => {
  const { session, syncNow, retryOp, discardOp, outbox, logout } = usePos();
  const { view, setView } = React.useContext(ShellContext);
  const { online, syncing, pending, failed } = useSyncState();
  const dialog = useDialog();
  const [showClose, setShowClose] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  if (!session) return null;

  const dark = tone === 'dark';
  const muted = dark ? 'text-white/60' : 'text-ink-soft';
  const itemBase = 'flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-bold transition';
  const item = `${itemBase} ${dark ? 'text-white/85 hover:bg-white/10' : 'text-ink hover:bg-ink/5'}`;
  const danger = `${itemBase} ${dark ? 'text-[#ff8da0] hover:bg-white/10' : 'text-fresa hover:bg-fresa/5'}`;
  const isAdmin = session.user.role === 'admin';

  const status = failed
    ? { icon: <CloudOff className="h-5 w-5 text-fresa" />, text: `${failed} con error`, hint: 'Toque para revisar' }
    : !online
      ? { icon: <CloudOff className={`h-5 w-5 ${dark ? 'text-tag' : 'text-amber-600'}`} />, text: 'Sin internet', hint: pending ? `${pending} por enviar` : 'Puede seguir vendiendo' }
      : pending
        ? { icon: <RefreshCw className={`h-5 w-5 text-sky-500 ${syncing ? 'animate-spin' : ''}`} />, text: `${pending} por enviar`, hint: 'Toque para enviar ahora' }
        : { icon: <Wifi className="h-5 w-5 text-brand-500" />, text: 'En línea', hint: 'Todo enviado' };

  const logoutFlow = async () => {
    if (pending && !(await dialog.confirm(
      'Hay operaciones sin enviar. Se enviarán cuando vuelva a entrar con este usuario.',
      { title: '¿Cerrar sesión?', confirmText: 'Salir' }))) return;
    onDone?.();
    void logout();
  };

  return (
    <section aria-label="Mi perfil" className={`border-t pt-4 ${dark ? 'border-white/10' : 'border-ink/10'}`}>
      <div className={`px-1 text-sm font-bold ${muted}`}>Mi perfil</div>
      <div className="mt-2 flex items-center gap-3 px-1">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${dark ? 'bg-white/10 text-white' : 'bg-brand-50 text-brand-800'}`}>
          <UserRound className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className={`truncate font-display text-lg font-bold leading-tight ${dark ? 'text-white' : 'text-ink'}`}>{session.user.fullName}</div>
          <div className={`text-sm ${muted}`}>{ROLE_LABELS[session.user.role]}</div>
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <button type="button" className={item} onClick={() => (pending ? setShowQueue(true) : void syncNow())}>
          {status.icon}
          <span className="min-w-0 flex-1">
            <span className="block leading-tight">{status.text}</span>
            <span className={`block text-sm font-normal ${muted}`}>{status.hint}</span>
          </span>
        </button>

        {isAdmin && setView && VIEWS.filter(v => v.view !== view).map(v => (
          <button key={v.view} type="button" className={item} onClick={() => { onDone?.(); setView(v.view); }}>
            {v.icon} Ir a {v.label}
          </button>
        ))}

        {!isAdmin && session.openShift && (
          <button type="button" className={item} onClick={() => setShowClose(true)}>
            <Lock className="h-5 w-5" /> Cerrar caja
          </button>
        )}

        <button type="button" className={danger} onClick={() => void logoutFlow()}>
          <LogOut className="h-5 w-5" /> Cerrar sesión
        </button>
      </div>

      {/* Los modales van al <body>: el menú puede estar dentro de un contenedor con transform. */}
      {showClose && createPortal(<ShiftCloseModal onClose={() => setShowClose(false)} />, document.body)}
      {showQueue && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowQueue(false)}>
          <div className="w-full max-w-sm space-y-3 rounded-3xl bg-white p-5 text-ink" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-xl font-bold">Por enviar</h3>
            <p className="text-[15px] text-ink-soft">Se envían solas al volver el internet. Las marcadas en rojo las rechazó el servidor.</p>
            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {outbox.map(op => (
                <div key={op.opId} className={`rounded-xl border p-3 text-sm ${op.error ? 'border-fresa/40 bg-fresa/5' : 'border-ink/10 bg-paper'}`}>
                  <div className="font-bold">{op.kind === 'create_order' ? `Ticket ${op.order.code}` : 'Anulación de ticket'}</div>
                  <div className="text-ink-soft">{new Date(op.createdAt).toLocaleString('es-PE')}</div>
                  {op.error && (
                    <>
                      <div className="mt-1 text-fresa">{op.error}</div>
                      <div className="mt-2 flex gap-2">
                        <button type="button" onClick={() => void retryOp(op.opId)} className="h-10 flex-1 rounded-lg bg-ink font-bold text-white">Reintentar</button>
                        <button type="button" onClick={async () => {
                          if (await dialog.confirm('Si es un ticket, se eliminará del celular.',
                            { title: '¿Descartar esta operación?', tone: 'danger', confirmText: 'Descartar' })) void discardOp(op.opId);
                        }} className="h-10 flex-1 rounded-lg bg-fresa font-bold text-white">Descartar</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => void syncNow()} className="h-12 w-full rounded-xl bg-brand-600 font-bold text-white">
              Enviar ahora
            </button>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
};
