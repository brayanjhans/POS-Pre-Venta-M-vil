import React from 'react';
import { usePos } from '../state/PosContext';
import { PRODUCT_CATEGORIES, type CategoryInfo } from '../types/pos';

/**
 * Categorías disponibles: las del servidor (pos.categories) más cualquiera que ya use un producto.
 * Si el servidor aún no envía la lista (migración pendiente), se usan las categorías base.
 */
export function useCategories(): CategoryInfo[] {
  const { catalog } = usePos();
  return React.useMemo(() => {
    const list: CategoryInfo[] = catalog?.categories?.length
      ? [...catalog.categories]
      : PRODUCT_CATEGORIES.map(name => ({ name, art: '', color: '' }));
    for (const p of catalog?.products ?? []) {
      if (!list.some(c => c.name === p.category)) list.push({ name: p.category, art: '', color: '' });
    }
    return list;
  }, [catalog]);
}

/** Ilustración configurada para una categoría (o undefined para usar la de por defecto). */
export const categoryArtOf = (categories: CategoryInfo[], name: string): string | undefined =>
  categories.find(c => c.name === name)?.art || undefined;
