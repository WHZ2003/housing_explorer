/**
 * English UI strings.
 * Structured for future bilingual support — swap this object with a zh.ts
 * counterpart and pass it via React context or a simple hook.
 */
export const en = {
  app: {
    title: 'Harvard Housing Commute Explorer',
    subtitle: 'Compare commute convenience from any candidate address',
  },
  input: {
    label: 'Candidate Housing Address',
    placeholder: 'e.g. 100 Charles St, Boston, MA 02114',
    calculate: 'Calculate Commute',
    calculating: 'Calculating...',
    reset: 'Reset',
    hint: 'Start typing to search — pick a result from the dropdown to confirm your location',
  },
  travel: {
    driving: 'Driving',
    transit: 'Transit',
    walking: 'Walking',
    na: 'N/A',
    notAvailable: 'Route not available',
  },
  scores: {
    excellent: 'Excellent',
    good: 'Good',
    acceptable: 'Acceptable',
    far: 'Far',
  },
  summary: {
    title: 'Summary',
    overallScore: 'Overall Score',
    averageCommute: 'Avg. Best Commute',
    fastest: 'Fastest Destination',
    slowest: 'Slowest Destination',
    weightedScore: 'Weighted Score',
    exportCsv: 'Export CSV',
  },
  map: {
    yourLocation: 'Your Location',
    legend: 'Destinations',
    loadingMap: 'Loading map…',
  },
  errors: {
    noApiKey: 'Google Maps API key not configured',
    noApiKeyDetail:
      'Add VITE_GOOGLE_MAPS_API_KEY to your .env file and restart the dev server to enable routing and autocomplete.',
    geocodingFailed:
      'Could not find that address. Please check the spelling and try again.',
    routingFailed:
      'Could not retrieve commute times. The routing service may be temporarily unavailable.',
    networkError: 'Network error — please check your connection and try again.',
    generic: 'Something went wrong. Please try again.',
  },
  empty: {
    title: 'Enter an address to get started',
    subtitle:
      "We'll calculate driving, transit, and walking times to all four Harvard and MIT destinations.",
    destinations: 'Fixed destinations',
  },
};

export type UIStrings = typeof en;
