import React from 'react';
import { Heart, Loader2 } from 'lucide-react';
import { useFavorites } from '../context/FavoritesContext';
import type { ApartmentEntry } from '../types';

interface Props {
  apartment: ApartmentEntry;
  /**
   * When provided, called instead of the default addFavorite/removeFavorite.
   * Use this to inject async pre-processing (e.g. compute commutes before saving).
   */
  onToggle?: (apt: ApartmentEntry) => Promise<void> | void;
  /** Show a spinner instead of the heart while an async operation is in progress. */
  isSaving?: boolean;
  className?: string;
}

export const FavoriteButton: React.FC<Props> = ({
  apartment, onToggle, isSaving = false, className = '',
}) => {
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const saved = isFavorite(apartment.id);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSaving) return;
    if (onToggle) {
      onToggle(apartment);
    } else {
      if (saved) removeFavorite(apartment.id);
      else addFavorite(apartment);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isSaving}
      title={isSaving ? 'Saving…' : saved ? 'Remove from favorites' : 'Save to favorites'}
      className={[
        'p-1 rounded transition-colors',
        isSaving
          ? 'text-gray-300 cursor-wait'
          : saved
            ? 'text-rose-500 hover:text-rose-700'
            : 'text-gray-300 hover:text-rose-400',
        className,
      ].join(' ')}
    >
      {isSaving
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <Heart className={['w-3.5 h-3.5', saved ? 'fill-current' : ''].join(' ')} />
      }
    </button>
  );
};
