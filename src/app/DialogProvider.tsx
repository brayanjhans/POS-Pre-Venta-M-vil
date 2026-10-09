import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, HelpCircle, Info, XCircle } from 'lucide-react';

/**
 * Diálogos propios de la app en lugar de window.alert / confirm / prompt
 * (que en el APK aparecen como "localhost dice" y rompen el diseño).
 *
 *   const dialog = useDialog();
 *   await dialog.alert('Guardado', { tone: 'success' });
 *   if (await dialog.confirm('¿Anular el ticket?', { tone: 'danger' })) { … }
 *   const motivo = await dialog.prompt('Motivo de anulación');  // null si cancela
 */

export type DialogTone = 'info' | 'success' | 'warning' | 'danger';

interface BaseOptions {
  title?: string;
  tone?: DialogTone;
}
export interface AlertOptions extends BaseOptions {
  okText?: string;
}
export interface ConfirmOptions extends BaseOptions {
  confirmText?: string;
  cancelText?: string;
}
export interface PromptOptions extends ConfirmOptions {
  placeholder?: string;
  defaultValue?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  /** Devuelve un mensaje de error para impedir aceptar, o null si el valor es válido. */
  validate?: (value: string) => string | null;
}

interface DialogApi {
  alert: (message: string, options?: AlertOptions) => Promise<void>;
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  prompt: (message: string, options?: PromptOptions) => Promise<string | null>;
}

type Request =
  | { id: number; kind: 'alert'; message: string; options: AlertOptions; resolve: (v: void) => void }
  | { id: number; kind: 'confirm'; message: string; options: ConfirmOptions; resolve: (v: boolean) => void }
  | { id: number; kind: 'prompt'; message: string; options: PromptOptions; resolve: (v: string | null) => void };

const DialogContext = React.createContext<DialogApi | null>(null);

export const useDialog = (): DialogApi => {
  const ctx = React.useContext(DialogContext);
  if (!ctx) throw new Error('useDialog debe usarse dentro de <DialogProvider>');
  return ctx;
};

const TONE: Record<DialogTone, { icon: React.ReactNode; ring: string; button: string }> = {
  info: { icon: <Info className="h-6 w-6 text-sky-600" />, ring: 'bg-sky-50 ring-sky-100', button: 'bg-ink hover:bg-ink' },
  success: { icon: <CheckCircle2 className="h-6 w-6 text-brand-600" />, ring: 'bg-brand-50 ring-brand-100', button: 'bg-brand-600 hover:bg-brand-500' },
  warning: { icon: <AlertTriangle className="h-6 w-6 text-amber-600" />, ring: 'bg-amber-50 ring-amber-100', button: 'bg-amber-500 hover:bg-amber-400' },
  danger: { icon: <XCircle className="h-6 w-6 text-red-600" />, ring: 'bg-red-50 ring-red-100', button: 'bg-red-600 hover:bg-red-500' },
};

const DEFAULT_TITLE: Record<Request['kind'], Record<DialogTone, string>> = {
  alert: { info: 'Aviso', success: 'Listo', warning: 'Atención', danger: 'No se pudo completar' },
  confirm: { info: 'Confirmar', success: 'Confirmar', warning: '¿Está seguro?', danger: '¿Está seguro?' },
  prompt: { info: 'Ingrese un dato', success: 'Ingrese un dato', warning: 'Ingrese un dato', danger: 'Ingrese un dato' },
};

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = React.useState<Request[]>([]);
  const nextId = React.useRef(1);

  const api = React.useMemo<DialogApi>(() => {
    const push = (req: Omit<Request, 'id'>) => setQueue(q => [...q, { ...req, id: nextId.current++ } as Request]);
    return {
      alert: (message, options = {}) => new Promise(resolve => push({ kind: 'alert', message, options, resolve })),
      confirm: (message, options = {}) => new Promise(resolve => push({ kind: 'confirm', message, options, resolve })),
      prompt: (message, options = {}) => new Promise(resolve => push({ kind: 'prompt', message, options, resolve })),
    };
  }, []);

  const current = queue[0];
  const close = () => setQueue(q => q.slice(1));

  return (
    <DialogContext.Provider value={api}>
      {children}
      <AnimatePresence>
        {current && <DialogView key={current.id} request={current} onDone={close} />}
      </AnimatePresence>
    </DialogContext.Provider>
  );
};

const DialogView: React.FC<{ request: Request; onDone: () => void }> = ({ request, onDone }) => {
  const tone = request.options.tone ?? (request.kind === 'confirm' ? 'warning' : 'info');
  const style = TONE[tone];
  const [value, setValue] = React.useState(request.kind === 'prompt' ? request.options.defaultValue ?? '' : '');
  const [error, setError] = React.useState('');

  const cancel = () => {
    if (request.kind === 'alert') request.resolve();
    else if (request.kind === 'confirm') request.resolve(false);
    else request.resolve(null);
    onDone();
  };

  const accept = () => {
    if (request.kind === 'alert') request.resolve();
    else if (request.kind === 'confirm') request.resolve(true);
    else {
      const problem = request.options.validate?.(value) ?? null;
      if (problem) {
        setError(problem);
        return;
      }
      request.resolve(value);
    }
    onDone();
  };

  const okText = request.kind === 'alert'
    ? request.options.okText ?? 'Entendido'
    : request.options.confirmText ?? 'Aceptar';
  const cancelText = request.kind === 'alert' ? null : request.options.cancelText ?? 'Cancelar';

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/55 p-4 backdrop-blur-sm sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={cancel}
    >
      <motion.form
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={e => e.stopPropagation()}
        onSubmit={e => { e.preventDefault(); accept(); }}
        onKeyDown={e => { if (e.key === 'Escape') cancel(); }}
        className="w-full max-w-sm rounded-3xl bg-white p-5 text-ink shadow-2xl ring-1 ring-slate-900/5"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      >
        <div className="flex items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-4 ${style.ring}`}>
            {request.kind === 'prompt' ? <HelpCircle className="h-6 w-6 text-ink-soft" /> : style.icon}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id="dialog-title" className="text-base font-black text-ink">
              {request.options.title ?? DEFAULT_TITLE[request.kind][tone]}
            </h2>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{request.message}</p>
          </div>
        </div>

        {request.kind === 'prompt' && (
          <div className="mt-4">
            <input
              autoFocus
              value={value}
              inputMode={request.options.inputMode}
              placeholder={request.options.placeholder}
              onChange={e => { setValue(e.target.value); setError(''); }}
              className="w-full rounded-xl border border-ink/15 bg-cream/60 px-3 py-3 text-base text-ink outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
            />
            {error && <p className="mt-1.5 text-sm font-medium text-red-600">{error}</p>}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          {cancelText && (
            <button type="button" onClick={cancel}
              className="h-12 flex-1 rounded-xl border border-ink/10 bg-white text-sm font-bold text-ink transition hover:bg-cream/60 active:scale-[0.98]">
              {cancelText}
            </button>
          )}
          <button type="submit" autoFocus={request.kind !== 'prompt'}
            className={`h-12 flex-1 rounded-xl text-sm font-black text-white shadow-sm transition active:scale-[0.98] ${style.button}`}>
            {okText}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
};
