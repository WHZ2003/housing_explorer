import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ApartmentEntry, SavedApartment } from '../types';

const STORAGE_KEY = 'harvard-housing-favorites-v1';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function aptToSaved(apt: ApartmentEntry, existingNote = '', existingSavedAt?: number): SavedApartment {
  return {
    id: apt.id,
    inputLabel: apt.inputLabel,
    place: apt.place,
    destinations: apt.destinations,
    averageBestSeconds: apt.averageBestSeconds,
    weightedScore: apt.weightedScore,
    savedAt: existingSavedAt ?? Date.now(),
    note: existingNote,
  };
}

function loadFavorites(): Record<string, SavedApartment> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, SavedApartment>;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface FavoritesContextValue {
  favorites: Record<string, SavedApartment>;
  /** Favorites sorted by savedAt descending (most recent first). */
  favoritesArray: SavedApartment[];
  /** Apartments currently in the compare tray (session-only, max 5). */
  compareItems: SavedApartment[];

  addFavorite: (apt: ApartmentEntry) => void;
  /** Save directly from a SavedApartment snapshot (e.g. from the compare modal). */
  addFavoriteFromSnapshot: (snap: SavedApartment) => void;
  removeFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  /** Persist a note for a saved apartment (replaces any existing note). */
  updateNote: (id: string, note: string) => void;

  /**
   * Add to compare tray (max 5, no duplicates).
   * - Always merges the latest note from favorites if the apartment is already saved.
   * - Requires commute data (destinations.length > 0); silently rejects empty snapshots.
   */
  addToCompare: (apt: ApartmentEntry | SavedApartment) => void;
  removeFromCompare: (id: string) => void;
  clearCompare: () => void;
  isInCompare: (id: string) => boolean;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [favorites, setFavorites] = useState<Record<string, SavedApartment>>(loadFavorites);
  // Compare list is intentionally session-only — no localStorage sync.
  const [compareItems, setCompareItems] = useState<SavedApartment[]>([]);

  // Sync favorites to localStorage on every change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      // localStorage unavailable — ignore
    }
  }, [favorites]);

  const addFavorite = useCallback((apt: ApartmentEntry) => {
    setFavorites(prev => {
      const existing = prev[apt.id];
      return {
        ...prev,
        [apt.id]: aptToSaved(apt, existing?.note ?? '', existing?.savedAt),
      };
    });
  }, []);

  // Saves a SavedApartment snapshot directly (from compare → favorites flow).
  // Preserves existing note and savedAt if already in favorites.
  const addFavoriteFromSnapshot = useCallback((snap: SavedApartment) => {
    setFavorites(prev => {
      const existing = prev[snap.id];
      return {
        ...prev,
        [snap.id]: {
          ...snap,
          note: existing?.note ?? snap.note,
          savedAt: existing?.savedAt ?? snap.savedAt,
        },
      };
    });
  }, []);

  const removeFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const isFavorite = useCallback((id: string) => id in favorites, [favorites]);

  const updateNote = useCallback((id: string, note: string) => {
    setFavorites(prev => {
      if (!prev[id]) return prev;
      return { ...prev, [id]: { ...prev[id], note } };
    });
  }, []);

  // addToCompare always merges the latest note from favorites and requires destinations.
  const addToCompare = useCallback((apt: ApartmentEntry | SavedApartment) => {
    // Build a full snapshot, merging the latest favorites note.
    let snapshot: SavedApartment;
    if ('savedAt' in apt) {
      snapshot = apt as SavedApartment;
    } else {
      const entry = apt as ApartmentEntry;
      snapshot = aptToSaved(entry, favorites[entry.id]?.note ?? '');
    }

    // Merge latest favorites note (in case it was updated after snapshot was taken).
    const favNote = favorites[snapshot.id]?.note;
    if (favNote !== undefined) {
      snapshot = { ...snapshot, note: favNote };
    }

    // Reject apartments without commute data — they'd show all-dashes.
    if (snapshot.destinations.length === 0) return;

    setCompareItems(prev => {
      if (prev.some(c => c.id === snapshot.id)) return prev; // no duplicates
      if (prev.length >= 5) return prev;                     // max 5
      return [...prev, snapshot];
    });
  }, [favorites]);

  // When a favorites note is updated, also update the matching compare item.
  const updateNote_ = useCallback((id: string, note: string) => {
    setFavorites(prev => {
      if (!prev[id]) return prev;
      return { ...prev, [id]: { ...prev[id], note } };
    });
    // Keep compare item in sync so the modal always shows the current note.
    setCompareItems(prev =>
      prev.map(c => c.id === id ? { ...c, note } : c)
    );
  }, []);

  const removeFromCompare = useCallback((id: string) => {
    setCompareItems(prev => prev.filter(c => c.id !== id));
  }, []);

  const clearCompare = useCallback(() => setCompareItems([]), []);

  const isInCompare = useCallback(
    (id: string) => compareItems.some(c => c.id === id),
    [compareItems],
  );

  const favoritesArray = useMemo(
    () => Object.values(favorites).sort((a, b) => b.savedAt - a.savedAt),
    [favorites],
  );

  const value: FavoritesContextValue = {
    favorites,
    favoritesArray,
    compareItems,
    addFavorite,
    addFavoriteFromSnapshot,
    removeFavorite,
    isFavorite,
    updateNote: updateNote_,
    addToCompare,
    removeFromCompare,
    clearCompare,
    isInCompare,
  };

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used inside <FavoritesProvider>');
  return ctx;
}
