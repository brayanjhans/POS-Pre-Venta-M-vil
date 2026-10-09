import React, { useState } from 'react';
import { AlertTriangle, CloudOff, LogOut, Lock, RefreshCw, Wifi } from 'lucide-react';
import { usePos } from '../state/PosContext';
import { useDialog } from './DialogProvider';
import { ShiftCloseModal } from '../features/shift/ShiftCloseModal';
import { ROLE_LABELS } from '../types/pos';

export type MainView = 'preventa' | 'caja' | 'admin';

interface Props {
  view: MainView;
  onChangeView?: (view: MainView) => void;
}

const VIEW_LABELS: Record<MainView, string> = { preventa: 'Pre-Venta', caja: 'Caja', admin: 'Admin' };

/** Barra superior común: usuario, conexión, cola de sincronización, cambio de vista (admin) y salida. */
export const StatusBar: React.FC<Props> = ({ view, onChangeView }) => {
  const { session, online, syncing, outbox, syncNow, retryOp, discardOp, logout } = usePos();
  const dialog = useDialog();
  const [showClose, setShowClose] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  if (!session) return null;

  const failed = outbox.filter(op => op.error);
  const pending = outbox.length;
  const isAdmin = session.user.role === 'admin';

  return (
    <>
      <div className="bg-ink text-white text-xs px-3 py-1.5 flex items-center justify-between gap-2 z-40">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold truncate max-w-[7rem] sm:max-w-none">{session.user.fullName.split(' ')[0]}<span className="hidden sm:inline">{session.user.fullName.slice(session.user.fullName.split(' ')[0].length)}</span></span>
          <span className="text-slate-400 hidden sm:inline">· {ROLE_LABELS[session.user.role]}</span>
          {isAdmin && onChangeView && (
            <div className="flex bg-slate-800 rounded-lg p-0.5 ml-1">
              {(Object.keys(VIEW_LABELS) as MainView[]).map(v => (
                <button key={v} type="button" onClick={() => onChangeView(v)}
                  className={`px-2 py-0.5 rounded-md font-bold whitespace-nowrap ${view === v ? 'bg-brand-600' : 'text-slate-300'}`}>
                  {VIEW_LABELS[v]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" onClick={() => (pending ? setShowQueue(true) : void syncNow())}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-bold ${
              failed.length ? 'bg-red-600' : !online ? 'bg-amber-600' : pending ? 'bg-blue-600' : 'bg-brand-700'}`}
            title="Estado de sincronización">
            {failed.length ? <AlertTriangle className="w-3 h-3" /> : online ? <Wifi className="w-3 h-3" /> : <CloudOff className="w-3 h-3" />}
            <span>
              {failed.length ? `${failed.length} con error` : !online ? `Sin internet${pending ? ` · ${pending} pend.` : ''}`
                : pending ? `${pending} por enviar` : 'En línea'}
            </span>
            {syncing && <RefreshCw className="w-3 h-3 animate-spin" />}
          </button>
          {!isAdmin && session.openShift && (
            <button type="button" onClick={() => setShowClose(true)} className="p-1 rounded hover:bg-slate-700" title="Cerrar turno">
              <Lock className="w-3.5 h-3.5" />
            </button>
          )}
          <button type="button" onClick={async () => {
            if (!pending || await dialog.confirm(
              'Hay operaciones sin sincronizar. Se enviarán cuando vuelva a iniciar sesión con este usuario.',
              { title: '¿Cerrar sesión?', confirmText: 'Salir' })) {
              void logout();
            }
          }} className="p-1 rounded hover:bg-slate-700" title="Cerrar sesión">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showClose && <ShiftCloseModal onClose={() => setShowClose(false)} />}

      {showQueue && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => setShowQueue(false)}>
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-3 text-ink" onClick={e => e.stopPropagation()}>
            <h3 className="font-black  text-sm">Operaciones por sincronizar</h3>
            <p className="text-xs text-ink-soft">
              Se envían solas al recuperar internet. Las marcadas en rojo fueron rechazadas por el servidor.
            </p>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {outbox.map(op => (
                <div key={op.opId} className={`p-3 rounded-xl border text-xs ${op.error ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="font-bold">
                    {op.kind === 'create_order' ? `Ticket ${op.order.code}` : 'Anulación de ticket'}
                  </div>
                  <div className="text-ink-soft">{new Date(op.createdAt).toLocaleString('es-PE')}</div>
                  {op.error && (
                    <>
                      <div className="text-red-700 mt-1">{op.error}</div>
                      <div className="flex gap-2 mt-2">
                        <button type="button" onClick={() => void retryOp(op.opId)}
                          className="flex-1 py-1.5 bg-slate-900 text-white rounded-lg font-bold">Reintentar</button>
                        <button type="button" onClick={async () => {
                          if (await dialog.confirm('Si es un ticket, se eliminará del celular.',
                            { title: '¿Descartar esta operación?', tone: 'danger', confirmText: 'Descartar' })) void discardOp(op.opId);
                        }} className="flex-1 py-1.5 bg-red-600 text-white rounded-lg font-bold">Descartar</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => void syncNow()} className="w-full py-2.5 bg-brand-600 text-white rounded-xl font-bold text-sm">
              Sincronizar ahora
            </button>
          </div>
        </div>
      )}
    </>
  );
};
