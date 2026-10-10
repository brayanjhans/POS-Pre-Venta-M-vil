import React from 'react';
import type { Api } from '../services/api';

/**
 * Fotos de productos: se piden al servidor una sola vez y se guardan en el celular
 * (IndexedDB). Una foto nunca cambia de contenido: si el producto cambia de foto, cambia
 * su referencia "img:<id>", así que no hay que invalidar nada.
 */

const DB_NAME = 'pos-images';
const STORE = 'images';
const memory = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = new Promise(resolve => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

async function readStored(id: string): Promise<string | undefined> {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise(resolve => {
    try {
      const req = db.transaction(STORE).objectStore(STORE).get(id);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : undefined);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

async function writeStored(entries: Record<string, string>) {
  const db = await openDb();
  if (!db) return;
  try {
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
    for (const [id, data] of Object.entries(entries)) store.put(data, id);
  } catch {
    /* sin espacio: la foto se volverá a pedir la próxima vez */
  }
}

function publish(id: string, data: string) {
  memory.set(id, data);
  listeners.get(id)?.forEach(fn => fn());
}

/** Id de la foto a partir de image_url ("img:<id>"), o null si el producto no tiene foto. */
export const photoId = (imageUrl?: string | null): string | null =>
  imageUrl?.startsWith('img:') ? imageUrl.slice(4) : null;

/** Guarda en el celular una foto recién subida, para no volver a descargarla. */
export function rememberPhoto(imageUrl: string, dataUrl: string) {
  const id = photoId(imageUrl);
  if (!id) return;
  publish(id, dataUrl);
  void writeStored({ [id]: dataUrl });
}

// Las tarjetas que aparecen juntas se piden en un solo viaje al servidor.
const pending = new Set<string>();
const requested = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
let currentApi: Api | null = null;

function flush() {
  timer = null;
  const ids = [...pending];
  pending.clear();
  if (!currentApi || !ids.length) return;
  const api = currentApi;
  for (let i = 0; i < ids.length; i += 60) {
    const chunk = ids.slice(i, i + 60);
    api.productImages(chunk)
      .then(found => {
        for (const [id, data] of Object.entries(found ?? {})) publish(id, data);
        void writeStored(found ?? {});
      })
      .catch(() => chunk.forEach(id => requested.delete(id))); // sin internet: se reintenta luego
  }
}

async function load(id: string, api: Api | null) {
  if (memory.has(id) || requested.has(id)) return;
  requested.add(id);
  const stored = await readStored(id);
  if (stored) {
    publish(id, stored);
    return;
  }
  if (!api) {
    requested.delete(id);
    return;
  }
  currentApi = api;
  pending.add(id);
  if (!timer) timer = setTimeout(flush, 30);
}

/** Devuelve la foto del producto (data URL) o null mientras no esté disponible. */
export function useProductPhoto(imageUrl: string | null | undefined, api: Api | null): string | null {
  const id = photoId(imageUrl);
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    if (!id) return;
    let set = listeners.get(id);
    if (!set) listeners.set(id, (set = new Set()));
    set.add(force);
    void load(id, api);
    return () => { set!.delete(force); };
  }, [id, api]);
  return id ? memory.get(id) ?? null : null;
}
