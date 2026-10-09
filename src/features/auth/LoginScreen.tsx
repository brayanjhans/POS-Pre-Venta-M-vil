import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'motion/react';
import { ArrowLeft, Delete, LifeBuoy, Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { publicApi } from '../../services/api';
import { backendHost, errorMessage, isNetworkError } from '../../services/rpc';
import { KEYS, storage } from '../../services/storage';
import { usePos } from '../../state/PosContext';
import { setScreenTheme } from '../../lib/screenTheme';
import { ROLE_LABELS, type LoginUser, type UserRole } from '../../types/pos';

/*
 * Pantalla "¿Quién trabaja hoy?": cada usuario es su fotocheck (la credencial con cinta que
 * llevan los preventistas). Es el único elemento llamativo; lo demás se mantiene sobrio.
 * Al tocar un fotocheck, este sube a la pantalla del PIN (única animación pensada).
 */

/** Franja inferior y "foto" del fotocheck según el rol. */
const ROLE_BAND: Record<UserRole, { band: string; photo: string }> = {
  vendedor: { band: 'bg-brand-600 text-white', photo: 'bg-brand-50 text-brand-800' },
  cajero: { band: 'bg-tag text-ink', photo: 'bg-[#fff6d1] text-ink' },
  admin: { band: 'bg-ink text-white', photo: 'bg-[#e4e8ea] text-ink' },
};

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';

const greeting = (d: Date) => {
  const h = d.getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
};

const BADGE_SHADOW = 'shadow-[0_1px_0_rgba(31,42,48,0.06),0_14px_28px_-20px_rgba(31,42,48,0.55)]';
const SPRING = { type: 'spring', stiffness: 380, damping: 34 } as const;

/** Fotocheck: ranura de la cinta, "foto" con iniciales, nombre y franja del rol. */
const Badge: React.FC<{ user: LoginUser; compact?: boolean }> = ({ user, compact }) => {
  const style = ROLE_BAND[user.role];
  if (compact) {
    return (
      <motion.div layoutId={`badge-${user.username}`} transition={SPRING}
        className={`flex items-center gap-3 overflow-hidden rounded-2xl border border-ink/10 bg-white pr-4 ${BADGE_SHADOW}`}>
        <div className={`flex h-16 w-16 shrink-0 items-center justify-center font-display text-2xl font-bold ${style.photo}`}>
          {initials(user.fullName)}
        </div>
        <div className="min-w-0 py-2">
          <div className="truncate font-display text-lg font-bold leading-tight text-ink">{user.fullName}</div>
          <div className="text-sm text-ink-soft">{ROLE_LABELS[user.role]}</div>
        </div>
      </motion.div>
    );
  }
  return (
    <motion.div layoutId={`badge-${user.username}`} transition={SPRING}
      className={`relative flex h-full flex-col overflow-hidden rounded-[20px] border border-ink/10 bg-white ${BADGE_SHADOW}`}>
      {/* Ranura de la cinta */}
      <div className="flex justify-center pt-3">
        <span className="h-2.5 w-10 rounded-full bg-paper ring-1 ring-inset ring-ink/15" />
      </div>
      <div className="flex flex-1 flex-col items-center px-3 pb-3 pt-3 text-center">
        <div className={`flex h-[72px] w-[72px] items-center justify-center rounded-2xl font-display text-[34px] font-bold [font-stretch:85%] ${style.photo}`}>
          {initials(user.fullName)}
        </div>
        <div className="mt-3 line-clamp-2 font-display text-[17px] font-bold leading-tight text-ink">{user.fullName}</div>
        <div className="mt-0.5 max-w-full truncate text-sm text-ink-soft">@{user.username}</div>
      </div>
      <div className={`px-3 py-1.5 text-center text-sm font-bold ${style.band}`}>{ROLE_LABELS[user.role]}</div>
    </motion.div>
  );
};

const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const KEY_CLASS = 'h-[68px] rounded-2xl border border-ink/10 bg-white font-display text-[28px] font-semibold text-ink shadow-[0_1px_0_rgba(31,42,48,0.08)] transition active:scale-95 active:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-600';

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
  const [now, setNow] = useState(() => new Date());
  // Acceso de soporte técnico: la cuenta no se lista; se abre tocando 5 veces la marca.
  const [supportMode, setSupportMode] = useState(false);
  const [supportUsername, setSupportUsername] = useState('');
  const logoTaps = useRef<number[]>([]);

  useEffect(() => {
    setScreenTheme('light');
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => { clearInterval(id); setScreenTheme('dark'); };
  }, []);

  const tapLogo = () => {
    const t = Date.now();
    logoTaps.current = [...logoTaps.current.filter(x => t - x < 3000), t];
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
      if (fresh.length === 0) setUsersError('No hay usuarios activos. Pida al administrador que cree su cuenta.');
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
      fail(isNetworkError(e) ? 'Sin conexión. Para entrar se necesita internet.' : errorMessage(e));
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

  const backButton = (label: string, onClick: () => void) => (
    <button type="button" onClick={onClick}
      className="-ml-2 inline-flex h-11 items-center gap-1.5 rounded-xl px-2 text-[15px] font-bold text-ink-soft transition hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-600">
      <ArrowLeft className="h-5 w-5" /> {label}
    </button>
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="h-full overflow-y-auto bg-paper text-ink">
        <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-5 pb-6 pt-5">
          {/* Marca + hora */}
          <header className="flex items-center justify-between">
            <button type="button" onClick={tapLogo} aria-label="Pre-Venta"
              className="flex select-none items-center gap-2.5 rounded-xl focus-visible:outline-2 focus-visible:outline-brand-600">
              <span className="relative flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-600 font-display text-lg font-extrabold text-white">
                P
                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-paper bg-tag" />
              </span>
              <span className="font-display text-xl font-bold tracking-tight text-ink">Pre-Venta</span>
            </button>
            <span className="text-[15px] font-bold tabular-nums text-ink-soft">
              {now.toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' })}
            </span>
          </header>

          {offline && (
            <div className="mt-5 flex items-start gap-3 rounded-2xl bg-[#fff6d1] p-3.5 text-[15px] text-ink ring-1 ring-inset ring-tag">
              <WifiOff className="mt-0.5 h-5 w-5 shrink-0" />
              <span className="flex-1">Sin conexión. Conéctese a internet para entrar.</span>
              <button type="button" onClick={() => void loadUsers()} aria-label="Reintentar" className="rounded-lg p-1 hover:bg-tag/40">
                <RefreshCw className="h-5 w-5" />
              </button>
            </div>
          )}

          <LayoutGroup>
            <AnimatePresence mode="popLayout" initial={false}>
              {supportMode && !selected ? (
                <motion.section key="support" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-6">
                  {backButton('Volver', () => setSupportMode(false))}
                  <form className="mt-4" onSubmit={e => {
                    e.preventDefault();
                    const username = supportUsername.trim().toLowerCase();
                    if (username) choose({ username, fullName: 'Soporte técnico', role: 'admin' });
                  }}>
                    <div className="flex items-center gap-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-white"><LifeBuoy className="h-6 w-6" /></span>
                      <div>
                        <h1 className="font-display text-2xl font-bold leading-tight">Acceso de soporte</h1>
                        <p className="text-[15px] text-ink-soft">Solo para el soporte técnico del sistema.</p>
                      </div>
                    </div>
                    <label className="mt-6 block text-[15px] font-bold" htmlFor="support-user">Usuario</label>
                    <input id="support-user" value={supportUsername} onChange={e => setSupportUsername(e.target.value.replace(/\s/g, ''))}
                      autoCapitalize="none" autoCorrect="off" autoComplete="off" autoFocus
                      className="mt-1.5 h-14 w-full rounded-2xl border border-ink/15 bg-white px-4 text-lg text-ink outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15" />
                    <button type="submit" disabled={!supportUsername.trim()}
                      className="mt-3 h-14 w-full rounded-2xl bg-ink text-base font-bold text-white transition active:scale-[0.99] disabled:opacity-40">
                      Continuar
                    </button>
                  </form>
                </motion.section>
              ) : !selected ? (
                <motion.section key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-8 flex-1">
                  <h1 className="font-display text-[40px] font-bold leading-[1.02] tracking-tight [font-stretch:88%]">
                    {greeting(now)}
                  </h1>
                  <p className="mt-2 text-[17px] text-ink-soft">Toque su credencial para empezar.</p>

                  {loadingUsers && users.length === 0 && (
                    <div aria-label="Cargando usuarios" className="mt-7 grid grid-cols-2 gap-3">
                      {[0, 1].map(i => <div key={i} className="h-[216px] animate-pulse rounded-[20px] bg-ink/[0.06]" />)}
                    </div>
                  )}

                  {!loadingUsers && (usersError || (offline && users.length === 0)) && (
                    <div className="mt-7 rounded-2xl border border-fresa/30 bg-white p-4">
                      {usersError && <p className="text-[15px] font-bold text-fresa">{usersError}</p>}
                      <p className="mt-1 break-all text-sm text-ink-soft">Servidor: {backendHost || 'sin configurar'}</p>
                      <button type="button" onClick={() => void loadUsers()}
                        className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-4 text-[15px] font-bold text-white">
                        <RefreshCw className="h-4 w-4" /> Reintentar
                      </button>
                    </div>
                  )}

                  {users.length > 0 && (
                    <ul className="mt-7 grid grid-cols-2 gap-3">
                      {users.map(u => (
                        <li key={u.username}>
                          <button type="button" onClick={() => choose(u)}
                            className="block h-full w-full rounded-[20px] text-left transition-transform active:scale-[0.97] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
                            <Badge user={u} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.section>
              ) : (
                <motion.section key="pin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-5 flex flex-1 flex-col">
                  {backButton('Cambiar de persona', () => choose(null))}
                  <form className="mt-3 flex flex-1 flex-col" onSubmit={e => { e.preventDefault(); void submit(pin); }}>
                    <Badge user={selected} compact />

                    <p className="mt-7 text-center text-[17px] font-bold">Ingrese su PIN</p>
                    <motion.div key={shake} animate={shake ? { x: [0, -9, 9, -6, 6, -2, 0] } : undefined} transition={{ duration: 0.4 }}
                      className="mt-4 flex justify-center gap-4" role="status" aria-label={`PIN ingresado: ${pin.length} dígitos`}>
                      {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
                        <span key={i} className={`h-4 w-4 rounded-full transition-colors duration-150 ${
                          error ? 'bg-fresa' : i < pin.length ? 'bg-brand-600' : 'bg-transparent ring-2 ring-inset ring-ink/25'}`} />
                      ))}
                    </motion.div>
                    <p className="mt-3 min-h-6 text-center text-[15px] font-bold text-fresa" role="alert">{error}</p>

                    <div className="mt-auto grid grid-cols-3 gap-2.5 pt-4">
                      {KEYPAD.map(d => (
                        <button key={d} type="button" onClick={() => pressDigit(d)} className={KEY_CLASS}>{d}</button>
                      ))}
                      <button type="button" onClick={backspace} aria-label="Borrar"
                        className="flex h-[68px] items-center justify-center rounded-2xl text-ink-soft transition active:scale-95 active:bg-ink/5">
                        <Delete className="h-7 w-7" />
                      </button>
                      <button type="button" onClick={() => pressDigit('0')} className={KEY_CLASS}>0</button>
                      <button type="submit" disabled={pin.length < 4 || loading}
                        className="flex h-[68px] items-center justify-center rounded-2xl bg-brand-600 text-[17px] font-bold text-white transition active:scale-95 disabled:bg-ink/10 disabled:text-ink/35">
                        {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Entrar'}
                      </button>
                    </div>
                  </form>
                </motion.section>
              )}
            </AnimatePresence>
          </LayoutGroup>
        </div>
      </div>
    </MotionConfig>
  );
};
