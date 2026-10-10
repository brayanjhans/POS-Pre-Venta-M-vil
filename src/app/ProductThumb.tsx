import React from 'react';
import { usePos } from '../state/PosContext';
import { useProductPhoto } from '../lib/productImages';
import { ProductArt, resolveArt } from './ProductArt';
import { categoryArtOf, useCategories } from './categories';

interface Props {
  product: { imageUrl?: string | null; name: string; category: string; accentColor?: string | null };
  /** Tamaño de la ilustración de respaldo dentro del recuadro. */
  artClassName?: string;
  /** Foto local aún no subida (vista previa del formulario). */
  previewUrl?: string | null;
}

/**
 * Imagen del producto: la foto si tiene una (se descarga una vez y queda en el celular);
 * si no, la ilustración según su nombre o categoría. Ocupa todo el recuadro que la contiene.
 */
export const ProductThumb: React.FC<Props> = ({ product, artClassName = 'h-[72%] w-[72%]', previewUrl }) => {
  const { api } = usePos();
  const categories = useCategories();
  const photo = useProductPhoto(previewUrl ? null : product.imageUrl, api);
  const src = previewUrl ?? photo;
  if (src) {
    return <img src={src} alt={product.name} loading="lazy" decoding="async" draggable={false} className="h-full w-full object-cover" />;
  }
  return (
    <ProductArt
      art={resolveArt(product, categoryArtOf(categories, product.category))}
      color={product.accentColor ?? undefined}
      className={artClassName}
    />
  );
};
