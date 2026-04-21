# Harvard Housing Commute Explorer

A multi-page decision tool for comparing commute convenience from candidate
housing addresses to configurable destinations near Harvard and MIT.

## Pages

| Page | Purpose |
|------|---------|
| **Search** | Enter one address, see commute times on an interactive map |
| **Batch** | Paste a list of apartments and compare them side-by-side in a table |
| **Settings** | Configure destinations, weights, and enabled travel modes |

## Destinations

Default destinations (fully configurable in Settings):

| Label | Name | Address |
|-------|------|---------|
| HMS   | Harvard Medical School | 25 Shattuck St, Boston, MA 02115 |
| SEAS  | Harvard SEAS           | 29 Oxford St, Cambridge, MA 02138 |
| SEC   | Harvard SEC            | 150 Western Ave, Allston, MA 02134 |
| CSAIL | MIT CSAIL              | 32 Vassar St, Cambridge, MA 02139 |

## Features

- **9:00 AM departure** — all results assume next weekday 9 AM, not "leave now"
- **Travel mode selector** — enable/disable Driving, Transit, Walking per session
- **Dynamic destinations** — add, remove, edit, re-weight via Settings
- **Configurable weights** — priority sliders; weights normalised automatically
- **Search page** — real commute times + interactive map with markers and route overlay
- **Batch comparison** — resolve many apartments at once; sortable table; CSV export
- **Transit overlay** — nearby MBTA subway and bus stops with line names (via MBTA API)
- **Scoring** — 0–100 weighted score; Excellent / Good / Acceptable / Far labels
- **Persisted settings** — destinations, modes, and weights saved to `localStorage`

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Google Maps API key

```bash
cp .env.example .env
```

Open `.env` and replace the placeholder with a real key.

**Required Google Cloud APIs** (enable all five in your project):
- Maps JavaScript API
- Places API **(New)** — the app uses `AutocompleteSuggestion`, `Place.fetchFields`, `Place.searchByText`, and `Place.searchNearby`; the legacy Places API alone is not sufficient
- Distance Matrix API
- Directions API
- Geocoding API

Get a key → https://developers.google.com/maps/get-started

> **Note on map styling:** The map uses `mapId: 'DEMO_MAP_ID'` to support `AdvancedMarkerElement`. Custom map styles require creating a Cloud Map ID in Google Cloud Console → Google Maps Platform → Map Management, then setting it as `mapId` in `MapView.tsx`.

### 3. Start the development server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### 4. Build for production

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
├── context/
│   └── AppContext.tsx        # Centralized state: destinations, modes (localStorage-backed)
├── components/
│   ├── ApiKeyBanner.tsx      # Setup notice when key is missing
│   ├── EmptyState.tsx        # Pre-search idle state
│   ├── InputCard.tsx         # Address search + autocomplete
│   ├── MapView.tsx           # Google Map, AdvancedMarkerElement, route overlay
│   ├── NavBar.tsx            # Top navigation (Search / Batch / Settings)
│   ├── ResultCard.tsx        # Per-destination commute card
│   ├── ResultsSection.tsx    # Results list with loading/error states
│   ├── SummaryPanel.tsx      # Aggregated stats + CSV export
│   ├── TransitPanel.tsx      # Nearby MBTA transit summary
│   └── TravelModeSelector.tsx # Driving / Transit / Walking chip toggles
├── constants/
│   └── destinations.ts      # Default destinations + color palette
├── hooks/
│   └── useCommuteData.ts    # Commute calculation state (context-aware)
├── i18n/
│   └── en.ts                # English UI strings
├── pages/
│   ├── SettingsPage.tsx     # Destination config, weight sliders, mode selector
│   └── BatchPage.tsx        # Multi-apartment input, resolution, sortable table, CSV
├── services/
│   ├── mapsService.ts       # Maps loader; AutocompleteSuggestion, Place, Distance Matrix,
│   │                        #   route renderer layer, nextWeekday9AM()
│   └── transitService.ts   # Nearby transit via Place.searchNearby + MBTA enrichment
├── types/
│   └── index.ts             # TypeScript interfaces (Destination, BatchRow, AppSettings…)
├── utils/
│   └── scoring.ts           # Commute scoring, formatting helpers
├── App.tsx                  # Root: AppProvider + 3-page router + layout
└── index.css                # Tailwind base + component utilities
```

## Architecture

### Centralized State (`AppContext`)

All mutable user preferences live in `AppContext` and persist to `localStorage`:

```typescript
interface AppSettings {
  destinations: Destination[];  // enabled flag + raw weight per dest
  enabledModes: TravelMode[];   // 'driving' | 'transit' | 'walking'
}
```

Components read from context via `useAppContext()`. The `activeDestinations`
derived value (filtered to `enabled === true`) is pre-computed in the provider.

### 9:00 AM Departure

`nextWeekday9AM()` in `mapsService.ts` returns the next weekday at 9 AM.
This is used for both the DistanceMatrix `transitOptions.departureTime` and
for `DirectionsService` transit routing, giving schedule-based results
representative of a real morning commute.

### Travel Modes

`calculateCommuteTimes()` accepts a `modes` parameter. Only selected modes are
fetched. `useCommuteData` passes `enabledModes` from context. Batch processing
does the same.

### Scoring

`calculateWeightedScore()` normalises raw `weight` values across enabled
destinations before computing the 0–100 score, so users can set arbitrary
integer priority values without worrying about percentages summing to 100.

### Layout

The Search page uses a **fixed 400 px sidebar + `flex-1` map** layout:

```
NavBar (48px)
└── flex row (remaining height)
    ├── Sidebar (400px, overflow-y-auto)
    └── Map    (flex-1, min-h-0)
```

Settings and Batch pages use a centered `max-w-2xl` / full-width scrollable layout.

## Adjusting Destination Weights

Open **Settings → Destinations** and drag the Priority sliders (1–100).
Weights are normalised automatically — you can set HMS=50, SEAS=30, SEC=10,
CSAIL=10 without worrying about fractions.

To add a custom destination: click **Add destination**, enter a name and address.
The app resolves coordinates the next time you calculate commutes.

## Scoring

| Average best commute | Label |
|---------------------|-------|
| < 20 min | Excellent |
| 20–35 min | Good |
| 35–50 min | Acceptable |
| > 50 min | Far |

**Best commute** per destination = minimum of OK legs among enabled modes.
Driving and transit are preferred over walking for "best" calculation.

**Weighted score** (0–100) = weighted average of best commute times across all
enabled destinations, normalised so 0 min → 100 and 60 min → 0.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | React 18 + Vite |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Icons | lucide-react |
| Maps | Google Maps JS API (new Places, AdvancedMarkerElement) |
| Loader | @googlemaps/js-api-loader |
| State | React Context + localStorage |
