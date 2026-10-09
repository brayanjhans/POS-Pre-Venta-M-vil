import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { ArrowLeft, ChevronRight, Delete, LifeBuoy, Loader2, LockKeyhole, RefreshCw, ShieldCheck, Store, WifiOff } from 'lucide-react';
import { publicApi } from '../../services/api';
import { backendHost, errorMessage, isNetworkError } from '../../services/rpc';
import { KEYS, storage } from '../../services/storage';
import { usePos } from '../../state/PosContext';
import { ROLE_LABELS, type LoginUser, type UserRole } from '../../types/pos';

/** Colores por rol: degradado del avatar, chip del rol y halo al seleccionar. */
const ROLE_STYLE: Record<UserRole, { avatar: string; chip: string; glow: string }> = {
  admin: {
    avatar: 'from-violet-500 to-indigo-600',
    chip: 'bg-violet-400/10 text-violet-200 ring-violet-400/25',
    glow: 'group-hover:shadow-violet-500/20',
  },
  cajero: {
    avatar: 'from-sky-400 to-blue-600',
    chip: 'bg-sky-400/10 text-sky-200 ring-sky-400/25',
    glow: 'group-hover:shadow-sky-500/20',
  },
  vendedor: {
    avatar: 'from-emerald-400 to-teal-600',
    chip: 'bg-emerald-400/10 text-emerald-200 ring-emerald-400/25',
    glow: 'group-hover:shadow-emerald-500/20',
  },
};

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';

const Avatar: React.FC<{ user: LoginUser; size?: 'md' | 'lg' }> = ({ user, size = 'md' }) => (
  <div
    className={`relative shrink-0 rounded-2xl bg-gradient-to-br ${ROLE_STYLE[user.role].avatar} flex items-center justify-center font-black text-white shadow-lg ring-1 ring-white/20 ${
      size === 'lg' ? 'w-20 h-20 text-2xl rounded-3xl' : 'w-12 h-12 text-base'
    }`}
  >
    <span className="absolute inset-0 rounded-[inherit] bg-gradient-to-b from-white/25 to-transparent" />
    <span className="relative">{initials(user.fullName)}</span>
  </div>
);

/** Reloj en vivo de la cabecera. */
const Clock: React.FC = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-right leading-tight">
      <div className="text-lg font-semibold tabular-nums text-white">
        {now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div className="text-[11px] capitalize text-slate-400">
        {now.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'short' })}
      </div>
    </div>
  );
};

const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

const stepTransition = {
  initial: { opacity: 0, y: 16, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -12, filter: 'blur(6px)' },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
};

export const LoginScreen: React.FC = () => {
  const { login } = usePos();
  const [users, setUsers] = useState<LoginUser[]>([]);
  const [selected, setSelected] = useState<LoginUser | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(0);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState('');
  // Acceso de soporte técnico: la cuenta no se lista; se abre tocando 5 veces el logo.
  const [supportMode, setSupportMode] = useState(false);
  const [supportUsername, setSupportUsername] = useState('');
  const logoTaps = useRef<number[]>([]);

  const tapLogo = () => {
    const now = Date.now();
    logoTaps.current = [...logoTaps.current.filter(t => now - t < 3000), now];
    if (logoTaps.current.length >= 5) {
      logoTaps.current = [];
      setSupportMode(true);
      setSupportUsername('');
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    setUsersError('');
    setOffline(false);
    try {
      const [cached, lastUsername] = await Promise.all([
        storage.get<LoginUser[]>(KEYS.loginUsers),
        storage.get<string>(KEYS.lastUsername),
      ]);
      if (cached) setUsers(cached);
      const fresh = await publicApi.loginUsers();
      setUsers(fresh);
      // Un fallo al guardar la caché no debe impedir el login.
      storage.set(KEYS.loginUsers, fresh).catch(() => {});
      const last = fresh.find(u => u.username === lastUsername);
      if (last) setSelected(last);
      if (fresh.length === 0) setUsersError('No hay usuarios activos registrados en el servidor.');
    } catch (e) {
      if (isNetworkError(e)) setOffline(true);
      else setUsersError(errorMessage(e));
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const fail = (message: string) => {
    setError(message);
    setPin('');
    setShake(s => s + 1);
  };

  const submit = async (value: string) => {
    if (!selected || value.length < 4 || loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await login(selected.username, value);
      if (!result.ok) fail(result.message ?? 'No se pudo iniciar sesión.');
    } catch (e) {
      fail(isNetworkError(e) ? 'Sin conexión. Para iniciar sesión se necesita internet.' : errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const pressDigit = (d: string) => {
    if (loading) return;
    setPin(p => (p.length >= 6 ? p : p + d));
    setError('');
  };
  const backspace = () => setPin(p => p.slice(0, -1));

  const choose = (u: LoginUser | null) => {
    setSupportMode(false);
    setSelected(u);
    setPin('');
    setError('');
  };

  // Teclado físico (lector o PC). No hay campo de texto, así que nunca se abre el teclado del celular.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) pressDigit(e.key);
      else if (e.key === 'Backspace') backspace();
      else if (e.key === 'Enter') void submit(pin);
      else if (e.key === 'Escape') choose(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative h-full overflow-x-hidden overflow-y-auto bg-[#050b18] text-white">
        {/* Fondo: auroras difuminadas + retícula sutil */}
        <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="login-aurora absolute -top-32 -left-24 h-96 w-96 rounded-full bg-emerald-500/25 blur-3xl" />
          <div className="login-aurora login-aurora--slow absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-indigo-600/20 blur-3xl" />
          <div className="login-aurora login-aurora--late absolute -bottom-40 left-1/4 h-96 w-96 rounded-full bg-teal-400/15 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
        </div>

        <div className="relative z-10 mx-auto flex min-h-full w-full max-w-md flex-col px-5 py-6">
          {/* Cabecera de marca */}
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div onClick={tapLogo} className="relative flex h-11 w-11 select-none items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-500/30 ring-1 ring-white/25">
                <Store className="h-5 w-5" strokeWidth={2.4} />
              </div>
              <div className="leading-tight">
                <div className="text-[15px] font-black tracking-tight">Punto de Venta</div>
                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-300/80">Pre-Venta</div>
              </div>
            </div>
            <Clock />
          </header>

          <main className="flex flex-1 flex-col justify-center py-6">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/40 ring-1 ring-inset ring-white/5 backdrop-blur-xl">
              {offline && (
                <div className="mb-4 flex items-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100">
                  <WifiOff className="h-4 w-4 shrink-0 text-amber-300" />
                  <span className="flex-1">Sin conexión. Conéctese a internet para iniciar sesión.</span>
                  <button type="button" onClick={() => void loadUsers()} className="rounded-lg p-1 hover:bg-white/10" aria-label="Reintentar">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              )}

              <AnimatePresence mode="wait" initial={false}>
                {supportMode && !selected ? (
                  <motion.section key="support" {...stepTransition}>
                    <form onSubmit={e => {
                      e.preventDefault();
                      const username = supportUsername.trim().toLowerCase();
                      if (username) choose({ username, fullName: 'Soporte técnico', role: 'admin' });
                    }}>
                      <button
                        type="button"
                        onClick={() => setSupportMode(false)}
                        className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white active:scale-95"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" /> Volver
                      </button>
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 ring-1 ring-white/20">
                          <LifeBuoy className="h-6 w-6" />
                        </div>
                        <div>
                          <h1 className="text-xl font-black tracking-tight">Acceso de soporte</h1>
                          <p className="text-xs text-slate-400">Solo para el soporte técnico del sistema.</p>
                        </div>
                      </div>
                      <input
                        value={supportUsername}
                        onChange={e => setSupportUsername(e.target.value.replace(/\s/g, ''))}
                        placeholder="Usuario de soporte"
                        autoCapitalize="none"
                        autoCorrect="off"
                        autoComplete="off"
                        autoFocus
                        className="mt-5 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 font-mono text-white placeholder:text-slate-500 outline-none focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-400/30"
                      />
                      <button
                        type="submit"
                        disabled={!supportUsername.trim()}
                        className="mt-3 w-full rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 py-3 text-sm font-black uppercase tracking-wider shadow-lg shadow-indigo-500/25 transition active:scale-[0.98] disabled:opacity-40"
                      >
                        Continuar
                      </button>
                    </form>
                  </motion.section>
                ) : !selected ? (
                  <motion.section key="users" {...stepTransition}>
                    <h1 className="text-2xl font-black tracking-tight">¿Quién va a trabajar?</h1>
                    <p className="mt-1 text-sm text-slate-400">Seleccione su perfil para continuar.</p>

                    <div className="-mx-1 mt-5 max-h-[52vh] space-y-2.5 overflow-y-auto px-1 pb-1">
                      {loadingUsers && users.length === 0 && (
                        <div aria-label="Cargando usuarios…" className="space-y-2.5">
                          {[0, 1, 2].map(i => (
                            <div key={i} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                              <div className="login-shimmer h-12 w-12 rounded-2xl" />
                              <div className="flex-1 space-y-2">
                                <div className="login-shimmer h-3.5 w-2/3 rounded-full" />
                                <div className="login-shimmer h-2.5 w-1/3 rounded-full" />
                              </div>
                            </div>
                          ))}
                          <p className="pt-1 text-center text-xs text-slate-500">Cargando usuarios…</p>
                        </div>
                      )}

                      {!loadingUsers && (usersError || (offline && users.length === 0)) && (
                        <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-center">
                          {usersError && <p className="mb-1 text-sm font-medium text-red-200">{usersError}</p>}
                          <p className="mb-3 break-all text-[11px] text-slate-400">Servidor: {backendHost || 'sin configurar'}</p>
                          <button
                            type="button"
                            onClick={() => void loadUsers()}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 active:scale-95"
                          >
                            <RefreshCw className="h-4 w-4" /> Reintentar
                          </button>
                        </div>
                      )}

                      {users.map((u, i) => (
                        <motion.button
                          key={u.username}
                          type="button"
                          onClick={() => choose(u)}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i, 8) * 0.045, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.97 }}
                          className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3 text-left shadow-lg shadow-transparent outline-none transition-[background-color,border-color,box-shadow] duration-200 hover:border-white/20 hover:bg-white/[0.07] focus-visible:border-emerald-400/60 focus-visible:ring-2 focus-visible:ring-emerald-400/40 ${ROLE_STYLE[u.role].glow}`}
                        >
                          {/* Brillo que recorre la tarjeta al pasar el dedo/mouse */}
                          <span aria-hidden className="login-sheen pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
                          <Avatar user={u} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[15px] font-bold text-white">{u.fullName}</div>
                            <div className="mt-1 flex items-center gap-2">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${ROLE_STYLE[u.role].chip}`}>
                                {ROLE_LABELS[u.role]}
                              </span>
                              <span className="truncate text-[11px] text-slate-500">@{u.username}</span>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 shrink-0 text-slate-500 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-white" />
                        </motion.button>
                      ))}
                    </div>
                  </motion.section>
                ) : (
                  <motion.section key="pin" {...stepTransition}>
                    <form onSubmit={e => { e.preventDefault(); void submit(pin); }}>
                      <button
                        type="button"
                        onClick={() => choose(null)}
                        className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white active:scale-95"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" /> Cambiar usuario
                      </button>

                      <div className="flex flex-col items-center text-center">
                        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 22 }}>
                          <Avatar user={selected} size="lg" />
                        </motion.div>
                        <div className="mt-3 text-lg font-black tracking-tight">{selected.fullName}</div>
                        <span className={`mt-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${ROLE_STYLE[selected.role].chip}`}>
                          {ROLE_LABELS[selected.role]}
                        </span>
                        <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-slate-400">
                          <LockKeyhole className="h-3.5 w-3.5" /> Ingrese su PIN
                        </p>
                      </div>

                      {/* Puntos del PIN: se rellenan con un pequeño "pop" y tiemblan si el PIN es incorrecto */}
                      <motion.div
                        key={shake}
                        animate={shake ? { x: [0, -10, 10, -7, 7, -3, 0] } : undefined}
                        transition={{ duration: 0.42 }}
                        className="my-5 flex justify-center gap-3.5"
                        aria-label={`PIN ingresado: ${pin.length} dígitos`}
                        role="status"
                      >
                        {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => {
                          const filled = i < pin.length;
                          return (
                            <motion.span
                              key={i}
                              animate={{ scale: filled ? [1, 1.35, 1] : 1 }}
                              transition={{ duration: 0.22 }}
                              className={`h-3.5 w-3.5 rounded-full transition-colors duration-150 ${
                                error ? 'bg-red-400 shadow-[0_0_12px] shadow-red-400/60'
                                  : filled ? 'bg-emerald-400 shadow-[0_0_12px] shadow-emerald-400/60'
                                  : 'bg-white/10 ring-1 ring-inset ring-white/25'
                              }`}
                            />
                          );
                        })}
                      </motion.div>

                      <div className="mb-3 min-h-5 text-center">
                        <AnimatePresence>
                          {error && (
                            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                              className="text-sm font-medium text-red-300" role="alert">
                              {error}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="grid grid-cols-3 gap-2.5">
                        {KEYPAD.map(d => (
                          <motion.button
                            key={d}
                            type="button"
                            onClick={() => pressDigit(d)}
                            whileTap={{ scale: 0.9 }}
                            className="h-16 rounded-2xl border border-white/[0.07] bg-white/[0.05] text-2xl font-semibold tabular-nums text-white transition-colors hover:bg-white/10 active:bg-white/[0.14]"
                          >
                            {d}
                          </motion.button>
                        ))}
                        <motion.button
                          type="button"
                          onClick={backspace}
                          whileTap={{ scale: 0.9 }}
                          className="flex h-16 items-center justify-center rounded-2xl text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                          aria-label="Borrar"
                        >
                          <Delete className="h-6 w-6" />
                        </motion.button>
                        <motion.button
                          type="button"
                          onClick={() => pressDigit('0')}
                          whileTap={{ scale: 0.9 }}
                          className="h-16 rounded-2xl border border-white/[0.07] bg-white/[0.05] text-2xl font-semibold tabular-nums text-white transition-colors hover:bg-white/10 active:bg-white/[0.14]"
                        >
                          0
                        </motion.button>
                        <motion.button
                          type="submit"
                          disabled={pin.length < 4 || loading}
                          whileTap={{ scale: 0.92 }}
                          className="flex h-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-500/30 ring-1 ring-inset ring-white/20 transition-opacity disabled:opacity-35 disabled:shadow-none"
                        >
                          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Entrar'}
                        </motion.button>
                      </div>
                    </form>
                  </motion.section>
                )}
              </AnimatePresence>
            </div>
          </main>

          <footer className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400/70" />
            Acceso protegido con PIN personal
          </footer>
        </div>
      </div>
    </MotionConfig>
  );
};
