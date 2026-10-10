// Sin 0/O, 1/I/L ni U para que el cajero no se confunda al escribir el código a mano.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Código corto del ticket, generado en el celular para poder imprimir el QR sin internet.
 * Formato: <código vendedor>-<5 caracteres aleatorios>, ej. "V01-7K3QM".
 * El servidor rechaza duplicados (CODIGO_DUPLICADO) y la app reintenta con otro código.
 */
export function generateOrderCode(prefix: string | null | undefined): string {
  const clean = (prefix ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'P';
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  const random = Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('');
  return `${clean}-${random}`;
}

export const isValidOrderCode = (code: string): boolean => /^[A-Z0-9-]{4,24}$/.test(code);

/** ¿El texto escaneado es el código/QR de un ticket (ej. "V01-7K3QM") y no un código de barras de producto? */
export const looksLikeOrderCode = (code: string): boolean => /^[A-Z0-9]{1,6}-[A-Z0-9]{5}$/.test(code.trim().toUpperCase());
