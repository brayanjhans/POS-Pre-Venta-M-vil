/** Celular peruano: 9 dígitos que empiezan con 9 (se compara solo con los dígitos). */
export const isValidPhone = (digits: string): boolean => /^9\d{8}$/.test(digits);

/** "987654321" -> "987 654 321" para mostrar. */
export const formatPhone = (phone: string | null | undefined): string =>
  phone && /^\d{9}$/.test(phone) ? `${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}` : phone ?? '';

/** Normaliza un nombre para comparar: minúsculas, sin tildes y espacios simples. */
export const normalizeName = (name: string): string =>
  name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Clientes con el mismo nombre (ignorando mayúsculas, tildes y espacios). */
export const findSameName = <T extends { id: string; name: string }>(customers: T[], name: string, exceptId?: string): T[] => {
  const target = normalizeName(name);
  return target ? customers.filter(c => c.id !== exceptId && normalizeName(c.name) === target) : [];
};

/** Al cliente le faltan datos de contacto (se registró solo con el nombre). */
export const missingContact = (c: { phone?: string | null }): boolean => !c.phone;
