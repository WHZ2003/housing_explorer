import React from 'react';
import { Heart } from 'lucide-react';
import { useFavorites } from '../context/FavoritesContext';
import type { ApartmentEntry } from '../types';

interface Props {
  apartment: ApartmentEntry;
  className?: string;
}

export const FavoriteButton: React.FC<Props> = ({ apartment, className = '' }) => {
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const saved = isFavorite(apartment.id);

  return (
    <button
      onClick={e => {
        e.stopPropagation();
        if (saved) removeFavorite(apartment.id);
        else addFavorite(apartment);
      }}
      title={saved ? 'Remove from favorites' : 'Save to favorites'}
      className={[
        'p-1 rounded transition-colors',
        saved
          ? 'text-rose-500 hover:text-rose-700'
          : 'text-gray-300 hover:text-rose-400',
        className,
      ].join(' ')}
    >
      <Heart className={['w-3.5 h-3.5', saved ? 'fill-current' : ''].join(' ')} />
    </button>
  );
};
