import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ApartmentEntry, ApartmentSource, DestinationCommute, SavedApartment } from '../types';

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

/** Convert a SavedApartment back to an ApartmentEntry for use in BatchPage. */
function savedToEntry(saved: SavedApartment): ApartmentEntry {
  return {
    id: saved.id,
    inputLabel: saved.inputLabel,
    place: saved.place,
    confirmStatus: 'confirmed',
    source: 'manual' as ApartmentSource,
    resolveError: null,
    candidates: [],
    commuteStatus: saved.destinations.length > 0 ? 'done' : 'idle',
    destinations: saved.destinations,
    averageBestSeconds: saved.averageBestSeconds,
    weightedScore: saved.weightedScore,
    commuteError: null,
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

export interface CommuteSnapshotUpdate {
  destinations: DestinationCommute[];
  averageBestSeconds: number;
  weightedScore: number;
}

interface FavoritesContextValue {
  favorites: Record<string, SavedApartment>;
  /** Favorites sorted by savedAt descending (most recent first). */
  favoritesArray: SavedApartment[];
  /** Apartments currently in the compare tray (session-only, max 5). */
  compareItems: SavedApartment[];
  /**
   * ApartmentEntry objects queued for import into BatchPage.
   * BatchPage consumes and clears this via clearBatchImportQueue.
   */
  batchImportQueue: ApartmentEntry[];

  addFavorite: (apt: ApartmentEntry) => void;
  /** Save directly from a SavedApartment snapshot (e.g. from the compare modal). */
  addFavoriteFromSnapshot: (snap: SavedApartment) => void;
  removeFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  updateNote: (id: string, note: string) => void;
  /** Update commute data for an existing favorite and keep compare in sync. */
  updateFavoriteCommutes: (id: string, snapshot: CommuteSnapshotUpdate, updatedAt: number) => void;

  addToCompare: (apt: ApartmentEntry | SavedApartment) => void;
  removeFromCompare: (id: string) => void;
  clearCompare: () => void;
  isInCompare: (id: string) => boolean;

  /** Queue all supplied favorites as ApartmentEntry objects for BatchPage to pick up. */
  importFavoritesToBatch: (apts: SavedApartment[]) => void;
  clearBatchImportQueue: () => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [favorites, setFavorites] = useState<Record<string, SavedApartment>>(loadFavorites);
  // Session-only — intentionally not persisted.
  const [compareItems, setCompareItems] = useState<SavedApartment[]>([]);
  const [batchImportQueue, setBatchImportQueue] = useState<ApartmentEntry[]>([]);

  // Persist favorites to localStorage on every change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      // localStorage unavailable — ignore
    }
  }, [favorites]);

  // ---------------------------------------------------------------------------
  // Favorites mutations
  // ---------------------------------------------------------------------------

  const addFavorite = useCallback((apt: ApartmentEntry) => {
    setFavorites(prev => {
      const existing = prev[apt.id];
      // Deduplicate by placeId — if this address is already saved under a different entry,
      // update that entry instead of creating a second one.
      const placeId = apt.place?.placeId;
      if (placeId && !existing) {
        const collision = Object.values(prev).find(f => f.place?.placeId === placeId);
        if (collision) {
          // Keep collision's id, note, and savedAt; refresh commute data.
          return {
            ...prev,
            [collision.id]: {
              ...collision,
              destinations: apt.destinations.length > 0 ? apt.destinations : collision.destinations,
              averageBestSeconds: apt.destinations.length > 0 ? apt.averageBestSeconds : collision.averageBestSeconds,
              weightedScore:      apt.destinations.length > 0 ? apt.weightedScore      : collision.weightedScore,
            },
          };
        }
      }
      return { ...prev, [apt.id]: aptToSaved(apt, existing?.note ?? '', existing?.savedAt) };
    });
  }, []);

  const addFavoriteFromSnapshot = useCallback((snap: SavedApartment) => {
    setFavorites(prev => {
      const existing = prev[snap.id];
      return {
        ...prev,
        [snap.id]: {
          ...snap,
          note:    existing?.note    ?? snap.note,
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

  /** Also propagates to compare items so the modal shows the latest note immediately. */
  const updateNote = useCallback((id: string, note: string) => {
    setFavorites(prev => {
      if (!prev[id]) return prev;
      return { ...prev, [id]: { ...prev[id], note } };
    });
    setCompareItems(prev => prev.map(c => c.id === id ? { ...c, note } : c));
  }, []);

  /** Updates commute data for a saved favorite and mirrors the change into compare items. */
  const updateFavoriteCommutes = useCallback((
    id: string,
    snapshot: CommuteSnapshotUpdate,
    updatedAt: number,
  ) => {
    setFavorites(prev => {
      if (!prev[id]) return prev;
      return {
        ...prev,
        [id]: { ...prev[id], ...snapshot, commuteUpdatedAt: updatedAt },
      };
    });
    setCompareItems(prev =>
      prev.map(c => c.id === id ? { ...c, ...snapshot, commuteUpdatedAt: updatedAt } : c)
    );
  }, []);

  // ---------------------------------------------------------------------------
  // Compare tray
  // ---------------------------------------------------------------------------

  const addToCompare = useCallback((apt: ApartmentEntry | SavedApartment) => {
    let snapshot: SavedApartment;
    if ('savedAt' in apt) {
      snapshot = apt as SavedApartment;
    } else {
      const entry = apt as ApartmentEntry;
      snapshot = aptToSaved(entry, favorites[entry.id]?.note ?? '');
    }

    // Merge latest favorites note.
    const favNote = favorites[snapshot.id]?.note;
    if (favNote !== undefined) snapshot = { ...snapshot, note: favNote };

    // Reject empty-data apartments — they'd render all-dashes.
    if (snapshot.destinations.length === 0) return;

    setCompareItems(prev => {
      if (prev.some(c => c.id === snapshot.id)) return prev;
      if (prev.length >= 5) return prev;
      return [...prev, snapshot];
    });
  }, [favorites]);

  const removeFromCompare = useCallback((id: string) => {
    setCompareItems(prev => prev.filter(c => c.id !== id));
  }, []);

  const clearCompare = useCallback(() => setCompareItems([]), []);

  const isInCompare = useCallback(
    (id: string) => compareItems.some(c => c.id === id),
    [compareItems],
  );

  // ---------------------------------------------------------------------------
  // Batch import channel  (FavoritesPage → BatchPage)
  // ---------------------------------------------------------------------------

  const importFavoritesToBatch = useCallback((apts: SavedApartment[]) => {
    setBatchImportQueue(apts.map(savedToEntry));
  }, []);

  const clearBatchImportQueue = useCallback(() => setBatchImportQueue([]), []);

  // ---------------------------------------------------------------------------

  const favoritesArray = useMemo(
    () => Object.values(favorites).sort((a, b) => b.savedAt - a.savedAt),
    [favorites],
  );

  const value: FavoritesContextValue = {
    favorites,
    favoritesArray,
    compareItems,
    batchImportQueue,
    addFavorite,
    addFavoriteFromSnapshot,
    removeFavorite,
    isFavorite,
    updateNote,
    updateFavoriteCommutes,
    addToCompare,
    removeFromCompare,
    clearCompare,
    isInCompare,
    importFavoritesToBatch,
    clearBatchImportQueue,
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
