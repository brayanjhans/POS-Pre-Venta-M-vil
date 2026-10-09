const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa texto antes de insertarlo en HTML generado a mano (document.write, plantillas). */
export const escapeHtml = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, ch => ENTITIES[ch]);
