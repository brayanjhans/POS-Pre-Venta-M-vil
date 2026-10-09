/** Celular peruano: 9 dígitos que empiezan con 9 (se compara solo con los dígitos). */
export const isValidPhone = (digits: string): boolean => /^9\d{8}$/.test(digits);

/** "987654321" -> "987 654 321" para mostrar. */
export const formatPhone = (phone: string | null | undefined): string =>
  phone && /^\d{9}$/.test(phone) ? `${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}` : phone ?? '';
