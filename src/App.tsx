import React, { useCallback, useEffect, useState } from 'react';
import { NavBar } from './components/NavBar';
import type { Page } from './components/NavBar';
import { ApiKeyBanner } from './components/ApiKeyBanner';
import { InputCard } from './components/InputCard';
import { EmptyState } from './components/EmptyState';
import { ResultsSection } from './components/ResultsSection';
import { SummaryPanel } from './components/SummaryPanel';
import { MapView } from './components/MapView';
import { TransitPanel } from './components/TransitPanel';
import { TravelModeSelector } from './components/TravelModeSelector';
import { SettingsPage } from './pages/SettingsPage';
import { BatchPage } from './pages/BatchPage';
import { AppProvider, useAppContext } from './context/AppContext';
import { hasApiKey, loadMapsApi } from './services/mapsService';
import { fetchNearbyTransit } from './services/transitService';
import { useCommuteData } from './hooks/useCommuteData';
import type { LayerConfig, SelectedPlace, TransitStop, TransitSummary } from './types';
import { Clock } from 'lucide-react';

const DEFAULT_LAYERS: LayerConfig = {
  housing:      true,
  destinations: true,
  subway:       true,
  bus:          true,
  walkRadius:   true,
};

// ---------------------------------------------------------------------------
// Main page (search + map)
// ---------------------------------------------------------------------------

const MainPage: React.FC<{ mapsLoaded: boolean; apiKeyPresent: boolean }> = ({
  mapsLoaded,
  apiKeyPresent,
}) => {
  const { activeDestinations, enabledModes } = useAppContext();

  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [selectedDestId, setSelectedDestId]   = useState<string | null>(null);
  const [layers, setLayers] = useState<LayerConfig>(DEFAULT_LAYERS);

  const [transitStops,   setTransitStops]   = useState<TransitStop[]>([]);
  const [transitSummary, setTransitSummary] = useState<TransitSummary | null>(null);
  const [isLoadingTransit, setIsLoadingTransit] = useState(false);

  const { status, result, error, calculate, reset } = useCommuteData(
    activeDestinations,
    enabledModes
  );

  const loadTransitData = useCallback(async (place: SelectedPlace) => {
    setIsLoadingTransit(true);
    setTransitStops([]);
    setTransitSummary(null);
    try {
      const { stops, summary } = await fetchNearbyTransit(place.latLng);
      setTransitStops(stops);
      setTransitSummary(summary);
    } catch {
      // non-fatal
    } finally {
      setIsLoadingTransit(false);
    }
  }, []);

  const handlePlaceSelected = useCallback(
    (place: SelectedPlace) => {
      setSelectedPlace(place);
      setSelectedDestId(null);
      if (status === 'success' || status === 'error') reset();
      loadTransitData(place);
    },
    [status, reset, loadTransitData]
  );

  const handleCalculate = () => {
    if (!selectedPlace) return;
    setSelectedDestId(null);
    calculate(selectedPlace);
  };

  const handleReset = () => {
    setSelectedPlace(null);
    setSelectedDestId(null);
    setTransitStops([]);
    setTransitSummary(null);
    reset();
  };

  const showTransitPanel = isLoadingTransit || transitSummary !== null;

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* ── Sidebar ── */}
      <div className="w-[400px] flex-shrink-0 overflow-y-auto border-r border-gray-200 bg-white">
        <div className="p-4 space-y-3">
          {!apiKeyPresent && <ApiKeyBanner />}

          {/* Mode selector + departure note */}
          <div className="space-y-1.5">
            <TravelModeSelector compact />
            <p className="text-[11px] text-amber-600 flex items-center gap-1">
              <Clock className="w-3 h-3 flex-shrink-0" />
              All results use 9:00 AM weekday departure
            </p>
          </div>

          <InputCard
            status={status}
            mapsLoaded={mapsLoaded}
            selectedPlace={selectedPlace}
            onPlaceSelected={handlePlaceSelected}
            onCalculate={handleCalculate}
            onReset={handleReset}
            destinations={activeDestinations}
          />

          {showTransitPanel && (
            <TransitPanel
              summary={transitSummary}
              isLoading={isLoadingTransit}
            />
          )}

          {status === 'idle' && !selectedPlace && <EmptyState />}

          <ResultsSection
            status={status}
            result={result}
            error={error}
            selectedDestinationId={selectedDestId}
            onSelectDestination={setSelectedDestId}
          />

          {status === 'success' && result && (
            <SummaryPanel result={result} />
          )}
        </div>
      </div>

      {/* ── Map (fills all remaining space) ── */}
      <div className="flex-1 min-w-0 min-h-0">
        <MapView
          mapsLoaded={mapsLoaded}
          destinations={activeDestinations}
          result={result}
          selectedPlace={selectedPlace}
          selectedDestinationId={selectedDestId}
          transitStops={transitStops}
          layers={layers}
          onLayersChange={setLayers}
        />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Root app shell
// ---------------------------------------------------------------------------

const AppShell: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('main');
  const [mapsLoaded, setMapsLoaded]   = useState(false);
  const [apiKeyPresent] = useState(hasApiKey);

  useEffect(() => {
    if (!apiKeyPresent) return;
    loadMapsApi().then(ok => setMapsLoaded(ok));
  }, [apiKeyPresent]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <NavBar currentPage={currentPage} onNavigate={setCurrentPage} />

      {currentPage === 'main' && (
        <MainPage mapsLoaded={mapsLoaded} apiKeyPresent={apiKeyPresent} />
      )}

      {currentPage === 'settings' && (
        <div className="flex-1 overflow-y-auto">
          <SettingsPage />
        </div>
      )}

      {currentPage === 'batch' && (
        <div className="flex-1 overflow-y-auto">
          {!apiKeyPresent && (
            <div className="px-6 pt-6">
              <ApiKeyBanner />
            </div>
          )}
          <BatchPage />
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Export — wrap in AppProvider so context is available everywhere
// ---------------------------------------------------------------------------

const App: React.FC = () => (
  <AppProvider>
    <AppShell />
  </AppProvider>
);

export default App;
