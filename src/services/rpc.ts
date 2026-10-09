/**
 * Cliente mínimo para las funciones RPC de Supabase (PostgREST).
 * La app nunca accede a tablas: solo llama a public.pos_* con la anon key.
 */

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '') ?? '';
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

export const isBackendConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    /** true = no hubo respuesta del servidor (sin internet, timeout). Se puede reintentar. */
    public isNetwork = false,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const isNetworkError = (e: unknown): boolean => e instanceof ApiError && e.isNetwork;

export const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : 'Ocurrió un error inesperado.';

export async function rpc<T>(fn: string, args: Record<string, unknown> = {}, timeoutMs = 20000): Promise<T> {
  if (!isBackendConfigured) {
    throw new ApiError('SIN_CONFIGURAR', 'Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
  }

  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };
  // Las claves antiguas (JWT "eyJ...") también deben ir como Bearer; las nuevas "sb_publishable_" no.
  if (SUPABASE_ANON_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(args),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError('RED', 'Sin conexión con el servidor.', true);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let body: { message?: string; hint?: string; code?: string } | null = null;
    try {
      body = await res.json();
    } catch {
      /* respuesta sin JSON */
    }
    // Errores de negocio vienen con "hint" (ver pos._err en la migración).
    if (body?.hint) throw new ApiError(body.hint, body.message ?? 'Error');
    if (res.status >= 500 || res.status === 0) {
      throw new ApiError('SERVIDOR', 'El servidor no respondió correctamente. Reintente.', true);
    }
    throw new ApiError(body?.code ?? `HTTP_${res.status}`, body?.message ?? `Error ${res.status}`);
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
