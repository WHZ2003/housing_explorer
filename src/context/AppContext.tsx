import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { AppSettings, Destination, TravelMode } from '../types';
import { DEFAULT_DESTINATIONS, DESTINATION_COLORS } from '../constants/destinations';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface AppContextValue {
  destinations: Destination[];
  enabledModes: TravelMode[];
  /** Active (enabled) destinations — used in calculations and scoring. */
  activeDestinations: Destination[];

  // Destination mutations
  updateDestination: (id: string, patch: Partial<Destination>) => void;
  addDestination: (dest: Omit<Destination, 'id' | 'color'>) => void;
  removeDestination: (id: string) => void;
  resetDestinations: () => void;

  // Mode mutations
  setEnabledModes: (modes: TravelMode[]) => void;
  toggleMode: (mode: TravelMode) => void;

  /** Next unused colour from the palette. */
  nextColor: () => string;
}

const AppContext = createContext<AppContextValue | null>(null);

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'harvard-housing-settings-v2';

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { destinations: DEFAULT_DESTINATIONS, enabledModes: ['driving', 'transit', 'walking'] };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      destinations: parsed.destinations?.length ? parsed.destinations : DEFAULT_DESTINATIONS,
      enabledModes: parsed.enabledModes?.length ? parsed.enabledModes : ['driving', 'transit', 'walking'],
    };
  } catch {
    return { destinations: DEFAULT_DESTINATIONS, enabledModes: ['driving', 'transit', 'walking'] };
  }
}

function saveSettings(settings: AppSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage unavailable — ignore
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  // Persist on every change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const updateDestination = useCallback((id: string, patch: Partial<Destination>) => {
    setSettings(s => ({
      ...s,
      destinations: s.destinations.map(d => d.id === id ? { ...d, ...patch } : d),
    }));
  }, []);

  const addDestination = useCallback((dest: Omit<Destination, 'id' | 'color'>) => {
    setSettings(s => {
      const usedColors = new Set(s.destinations.map(d => d.color));
      const color =
        DESTINATION_COLORS.find(c => !usedColors.has(c)) ??
        DESTINATION_COLORS[s.destinations.length % DESTINATION_COLORS.length];
      const id = `custom-${Date.now()}`;
      return {
        ...s,
        destinations: [...s.destinations, { ...dest, id, color }],
      };
    });
  }, []);

  const removeDestination = useCallback((id: string) => {
    setSettings(s => ({
      ...s,
      destinations: s.destinations.filter(d => d.id !== id),
    }));
  }, []);

  const resetDestinations = useCallback(() => {
    setSettings(s => ({ ...s, destinations: DEFAULT_DESTINATIONS }));
  }, []);

  const setEnabledModes = useCallback((modes: TravelMode[]) => {
    // Always keep at least one mode enabled
    if (modes.length === 0) return;
    setSettings(s => ({ ...s, enabledModes: modes }));
  }, []);

  const toggleMode = useCallback((mode: TravelMode) => {
    setSettings(s => {
      const current = s.enabledModes;
      const next = current.includes(mode)
        ? current.filter(m => m !== mode)
        : [...current, mode];
      if (next.length === 0) return s; // keep at least one
      return { ...s, enabledModes: next as TravelMode[] };
    });
  }, []);

  const nextColor = useCallback((): string => {
    const usedColors = new Set(settings.destinations.map(d => d.color));
    return (
      DESTINATION_COLORS.find(c => !usedColors.has(c)) ??
      DESTINATION_COLORS[settings.destinations.length % DESTINATION_COLORS.length]
    );
  }, [settings.destinations]);

  const activeDestinations = useMemo(
    () => settings.destinations.filter(d => d.enabled),
    [settings.destinations]
  );

  const value: AppContextValue = {
    destinations: settings.destinations,
    enabledModes: settings.enabledModes,
    activeDestinations,
    updateDestination,
    addDestination,
    removeDestination,
    resetDestinations,
    setEnabledModes,
    toggleMode,
    nextColor,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside <AppProvider>');
  return ctx;
}
