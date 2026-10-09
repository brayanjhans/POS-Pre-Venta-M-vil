import React from 'react';
import { KeyRound, LifeBuoy, Lock, Pencil, Plus, RotateCcw, ShieldCheck, Unlock, UserX, X } from 'lucide-react';
import { usePos } from '../../state/PosContext';
import { useDialog } from '../../app/DialogProvider';
import { ROLE_LABELS, type User, type UserRole } from '../../types/pos';

interface FormState {
  username: string;
  fullName: string;
  role: UserRole;
  sellerCode: string;
  pin: string;
}

const EMPTY_FORM: FormState = { username: '', fullName: '', role: 'vendedor', sellerCode: '', pin: '' };

/**
 * Gestión de usuarios: crear, editar rol/nombre, restablecer PIN, bloquear/desbloquear y desactivar.
 * El PIN se asigna al crear el usuario; después solo el admin puede restablecerlo (nadie el suyo propio).
 * La cuenta de soporte técnico se muestra protegida: solo la administra soporte.
 */
export const UsersTab: React.FC = () => {
  const { api, session, handleError } = usePos();
  const dialog = useDialog();
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState<User | 'new' | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [resetting, setResetting] = React.useState<User | null>(null);
  const [newPin, setNewPin] = React.useState('');
  const [newPin2, setNewPin2] = React.useState('');
  const [resetError, setResetError] = React.useState('');
  const [resetDone, setResetDone] = React.useState('');
  const amSupport = session?.user.isSupport === true;

  const load = React.useCallback(async () => {
    if (!api) return;
    setLoading(true);
    try {
      setUsers(await api.users());
    } catch (e) {
      setError(handleError(e));
    } finally {
      setLoading(false);
    }
  }, [api, handleError]);

  React.useEffect(() => { void load(); }, [load]);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setError('');
    setEditing('new');
  };

  const openEdit = (u: User) => {
    setForm({ username: u.username, fullName: u.fullName, role: u.role, sellerCode: u.sellerCode ?? '', pin: '' });
    setError('');
    setEditing(u);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!api) return;
    setSaving(true);
    setError('');
    try {
      if (editing === 'new') {
        await api.createUser({
          username: form.username.trim().toLowerCase(),
          fullName: form.fullName.trim(),
          role: form.role,
          pin: form.pin,
          sellerCode: form.sellerCode.trim().toUpperCase() || undefined,
          mustChangePin: false,
        });
      } else if (editing) {
        await api.updateUser(editing.id, {
          fullName: form.fullName.trim(),
          role: form.role,
          sellerCode: form.sellerCode.trim().toUpperCase(),
        });
      }
      setEditing(null);
      await load();
    } catch (err) {
      setError(handleError(err));
    } finally {
      setSaving(false);
    }
  };

  const quickUpdate = async (u: User, patch: Parameters<NonNullable<typeof api>['updateUser']>[1], confirmText?: string) => {
    if (!api || (confirmText && !(await dialog.confirm(confirmText, { tone: 'danger', confirmText: 'Sí, continuar' })))) return;
    try {
      await api.updateUser(u.id, patch);
      await load();
    } catch (err) {
      void dialog.alert(handleError(err), { tone: 'danger' });
    }
  };

  const openReset = (u: User) => {
    setResetting(u);
    setNewPin('');
    setNewPin2('');
    setResetError('');
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!api || !resetting) return;
    if (!/^\d{4,6}$/.test(newPin)) {
      setResetError('El PIN debe tener entre 4 y 6 dígitos.');
      return;
    }
    if (newPin !== newPin2) {
      setResetError('Los dos PIN no coinciden.');
      return;
    }
    setSaving(true);
    setResetError('');
    try {
      await api.resetUserPin(resetting.id, newPin);
      setResetDone(`✓ PIN de ${resetting.fullName} restablecido. Entrégueselo: ya puede ingresar con el nuevo PIN.`);
      setResetting(null);
      await load();
    } catch (err) {
      setResetError(handleError(err));
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full bg-white border border-ink/15 rounded-xl p-2.5 text-sm focus:outline-hidden focus:border-brand-600';

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-ink ">Usuarios y Accesos</h3>
          <p className="text-xs text-ink-soft">
            Cree cuentas para vendedores y cajeros. Cada persona entra con su usuario y el PIN que usted le asigne.
            Si alguien olvida su PIN, use <strong>Restablecer PIN</strong>: conserva su cuenta y su historial.
          </p>
        </div>
        <button type="button" onClick={openNew}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-black text-xs  rounded-xl flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Nuevo usuario
        </button>
      </div>

      {error && !editing && <p className="text-sm text-red-600">{error}</p>}

      {resetDone && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5 text-sm font-bold text-brand-800">
          {resetDone}
          <button type="button" onClick={() => setResetDone('')} aria-label="Cerrar" className="p-1"><X className="w-4 h-4" /></button>
        </div>
      )}

      {loading && <p className="p-6 text-center text-ink/45">Cargando…</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {!loading && users.map(u => {
          const isMe = u.id === session?.user.id;
          // La cuenta de soporte solo la puede tocar soporte.
          const isProtected = u.isSupport === true && !amSupport;
          const action = 'inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition active:scale-95';
          return (
            <div key={u.id} className={`rounded-2xl border border-ink/10 bg-white p-4 shadow-sm ${u.isActive ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-black text-ink">
                    {u.fullName} {isMe && <span className="text-xs font-bold text-brand-700">(usted)</span>}
                  </div>
                  <div className="mt-0.5 font-display text-sm text-ink-soft">@{u.username}{u.sellerCode ? ` · ${u.sellerCode}` : ''}</div>
                </div>
                <span className={`shrink-0 text-xs font-black px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-ink text-white' : u.role === 'cajero' ? 'bg-blue-100 text-blue-800' : 'bg-brand-100 text-brand-800'}`}>
                  {ROLE_LABELS[u.role]}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {!u.isActive && <span className="text-xs font-bold bg-ink/10 px-1.5 rounded">Inactivo</span>}
                {u.lockedUntil && <span className="text-xs font-bold bg-red-100 text-red-700 px-1.5 rounded">Bloqueado</span>}
                {u.mustChangePin && u.isActive && <span className="text-xs font-bold bg-amber-100 text-amber-800 px-1.5 rounded">PIN temporal</span>}
                {u.isSupport && (
                  <span className="inline-flex items-center gap-0.5 text-xs font-bold bg-indigo-100 text-indigo-800 px-1.5 rounded">
                    <LifeBuoy className="w-3 h-3" /> Soporte técnico (protegido)
                  </span>
                )}
                <span className="text-xs text-ink-soft">
                  Último ingreso: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('es-PE') : 'nunca'}
                </span>
              </div>

              {isProtected ? (
                <div className="mt-3 flex items-center gap-1 text-xs text-ink/45"><Lock className="w-3.5 h-3.5" /> Protegido: solo lo administra soporte.</div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-ink/5 pt-3">
                  <button type="button" onClick={() => openEdit(u)} className={`${action} bg-cream text-ink hover:bg-ink/10`}>
                    <Pencil className="w-4 h-4" /> Editar
                  </button>
                  {!isMe && (
                    <button type="button" onClick={() => openReset(u)} className={`${action} bg-indigo-50 text-indigo-700 hover:bg-indigo-100`}>
                      <RotateCcw className="w-4 h-4" /> Restablecer PIN
                    </button>
                  )}
                  {u.lockedUntil && (
                    <button type="button" onClick={() => void quickUpdate(u, { unlock: true })} className={`${action} bg-amber-50 text-amber-700 hover:bg-amber-100`}>
                      <Unlock className="w-4 h-4" /> Desbloquear
                    </button>
                  )}
                  {!isMe && (u.isActive ? (
                    <button type="button"
                      onClick={() => void quickUpdate(u, { isActive: false }, `¿Desactivar a ${u.fullName}? No podrá ingresar y se cerrarán sus sesiones abiertas.`)}
                      className={`${action} bg-red-50 text-red-600 hover:bg-red-100`}>
                      <UserX className="w-4 h-4" /> Desactivar
                    </button>
                  ) : (
                    <button type="button" onClick={() => void quickUpdate(u, { isActive: true })} className={`${action} bg-brand-50 text-brand-700 hover:bg-brand-100`}>
                      <ShieldCheck className="w-4 h-4" /> Reactivar
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <form onSubmit={submit} onClick={e => e.stopPropagation()} className="w-full max-w-sm bg-white rounded-3xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-black  text-sm">{editing === 'new' ? 'Nuevo usuario' : `Editar: ${editing.fullName}`}</h3>
              <button type="button" onClick={() => setEditing(null)} aria-label="Cerrar"><X className="w-5 h-5 text-ink/45" /></button>
            </div>
            <input className={field} placeholder="Nombre completo *" value={form.fullName} required minLength={2}
              onChange={e => setForm({ ...form, fullName: e.target.value })} />
            <input className={`${field} font-display`} placeholder="usuario (ej. carlos.m)" value={form.username} required
              disabled={editing !== 'new'} pattern="[a-z0-9._\-]{3,30}" title="3 a 30 caracteres: letras minúsculas, números, punto, guion"
              onChange={e => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, '') })} />
            <div className="grid grid-cols-2 gap-2">
              <select className={field} value={form.role} onChange={e => setForm({ ...form, role: e.target.value as UserRole })}>
                <option value="vendedor">Vendedor</option>
                <option value="cajero">Cajero(a)</option>
                <option value="admin">Administrador</option>
              </select>
              <input className={`${field} font-display `} placeholder="Cód. (V01)" value={form.sellerCode} maxLength={6}
                title="Prefijo de los tickets de este vendedor (2-6 letras/números)"
                onChange={e => setForm({ ...form, sellerCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
            </div>
            {editing === 'new' ? (
              <label className="block text-xs font-bold text-ink-soft">
                <span className="flex items-center gap-1"><KeyRound className="w-3.5 h-3.5" /> PIN de acceso (4-6 dígitos) *</span>
                <input className={`${field} mt-1 font-display tracking-[0.3em]`} type="password" inputMode="numeric" autoComplete="new-password"
                  value={form.pin} required pattern="[0-9]{4,6}"
                  onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })} />
                <span className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-700">
                  <Lock className="w-3 h-3" /> Anótelo y entrégueselo. El usuario no podrá cambiarlo; solo usted puede restablecerlo.
                </span>
              </label>
            ) : (
              <div className="text-xs font-bold text-ink-soft">
                <span className="flex items-center gap-1"><KeyRound className="w-3.5 h-3.5" /> PIN de acceso</span>
                <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-ink/10 bg-cream p-2 text-ink-soft"
                  aria-readonly="true">
                  <span className="font-display tracking-[0.3em]">••••</span>
                  <span className="flex items-center gap-1 text-xs"><Lock className="w-3 h-3" /> Bloqueado</span>
                </div>
                <span className="mt-1 block text-xs font-medium">Aquí no se edita el PIN. Si lo olvidó, use el botón «Restablecer PIN» de la lista.</span>
              </div>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button type="submit" disabled={saving} className="w-full py-3 bg-brand-600 text-white font-black rounded-xl disabled:opacity-50">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </form>
        </div>
      )}

      {resetting && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setResetting(null)}>
          <form onSubmit={submitReset} onClick={e => e.stopPropagation()} className="w-full max-w-sm bg-white rounded-3xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-black  text-sm flex items-center gap-1.5"><RotateCcw className="w-4 h-4" /> Restablecer PIN</h3>
              <button type="button" onClick={() => setResetting(null)} aria-label="Cerrar"><X className="w-5 h-5 text-ink/45" /></button>
            </div>
            <p className="text-xs text-ink-soft">
              Nuevo PIN para <strong>{resetting.fullName}</strong> (@{resetting.username}). Conserva su cuenta y su historial;
              se cerrarán sus sesiones abiertas.
            </p>
            <input className={`${field} font-display tracking-[0.3em]`} type="password" inputMode="numeric" autoComplete="new-password"
              placeholder="Nuevo PIN (4-6 dígitos)" value={newPin} required autoFocus
              onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            <input className={`${field} font-display tracking-[0.3em]`} type="password" inputMode="numeric" autoComplete="new-password"
              placeholder="Repita el nuevo PIN" value={newPin2} required
              onChange={e => setNewPin2(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            {resetError && <p className="text-xs text-red-600">{resetError}</p>}
            <button type="submit" disabled={saving} className="w-full py-3 bg-indigo-600 text-white font-black rounded-xl disabled:opacity-50">
              {saving ? 'Guardando…' : 'Restablecer PIN'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
