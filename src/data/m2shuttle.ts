// src/data/m2Shuttle.ts

export type M2Direction = "cambridge_to_boston" | "boston_to_cambridge";

export interface M2Stop {
  id: string;
  name: string;
  shortLabel: string;
  lat: number;   // approximate; verify with geocoding if needed
  lng: number;   // approximate; verify with geocoding if needed
  addressHint?: string;
  directionOrder: {
    cambridge_to_boston?: number;
    boston_to_cambridge?: number;
  };
  zone: "cambridge" | "mit" | "fenway" | "longwood";
  isFlagStop?: boolean;
}

export interface M2HeadwayWindow {
  days: ("mon" | "tue" | "wed" | "thu" | "fri")[];
  startMinuteOfDay: number; // local Boston time
  endMinuteOfDay: number;
  headwayMin: number;       // approximate scheduled headway
}

export interface M2TravelSegment {
  fromStopId: string;
  toStopId: string;
  typicalMinutes: number;   // approximate in-vehicle time
  peakMinutes?: number;     // optional morning/evening congestion estimate
}

export interface M2ServiceModel {
  id: "M2";
  name: string;
  operator: string;
  type: "private_shuttle";
  requiresEligibility: boolean;
  eligibilityNote: string;
  realtimeAvailable: boolean;
  realtimeNote: string;
  weekdayOnly: boolean;
  notes: string[];
  stops: M2Stop[];
  headways: Record<M2Direction, M2HeadwayWindow[]>;
  segments: Record<M2Direction, M2TravelSegment[]>;
  walkingRadiusMeters: number;
  lateEveningFlagStopRule: string;
}

const STOPS: M2Stop[] = [
  // Cambridge / Harvard end
  {
    id: "lamont_library",
    name: "Lamont Library",
    shortLabel: "Lamont",
    lat: 42.3729,
    lng: -71.1157,
    addressHint: "Lamont Library, Harvard University, Cambridge, MA",
    directionOrder: { cambridge_to_boston: 0 },
    zone: "cambridge",
  },
  {
    id: "mass_ave_holyoke_center",
    name: "Mass Ave @ Holyoke Center",
    shortLabel: "Holyoke",
    lat: 42.3733,
    lng: -71.1180,
    addressHint: "Massachusetts Ave & Holyoke St, Cambridge, MA",
    directionOrder: { boston_to_cambridge: 0 },
    zone: "cambridge",
  },
  {
    id: "mt_auburn_putnam",
    name: "Mt. Auburn St & Putnam Ave",
    shortLabel: "Putnam",
    lat: 42.3712,
    lng: -71.1213,
    addressHint: "Mt Auburn St & Putnam Ave, Cambridge, MA",
    directionOrder: { cambridge_to_boston: 1 },
    zone: "cambridge",
  },
  {
    id: "mass_ave_trowbridge",
    name: "Mass Ave & Trowbridge St",
    shortLabel: "Trowbridge",
    lat: 42.3710,
    lng: -71.1187,
    addressHint: "Massachusetts Ave & Trowbridge St, Cambridge, MA",
    directionOrder: { boston_to_cambridge: 1 },
    zone: "cambridge",
  },
  {
    id: "mass_ave_bay_st",
    name: "Mass Ave & Bay St",
    shortLabel: "Bay St",
    lat: 42.3690,
    lng: -71.1096,
    addressHint: "Massachusetts Ave & Bay St, Cambridge, MA",
    directionOrder: { cambridge_to_boston: 2 },
    zone: "cambridge",
  },
  {
    id: "mass_ave_dana_st",
    name: "Mass Ave & Dana St",
    shortLabel: "Dana St",
    lat: 42.3685,
    lng: -71.1083,
    addressHint: "Massachusetts Ave & Dana St, Cambridge, MA",
    directionOrder: { boston_to_cambridge: 2 },
    zone: "cambridge",
  },
  {
    id: "central_square",
    name: "Central Square",
    shortLabel: "Central",
    lat: 42.3655,
    lng: -71.1036,
    addressHint: "Central Square, Cambridge, MA",
    directionOrder: {
      cambridge_to_boston: 3,
      boston_to_cambridge: 3,
    },
    zone: "cambridge",
  },

  // MIT
  {
    id: "mit",
    name: "MIT",
    shortLabel: "MIT",
    lat: 42.3593,
    lng: -71.0935,
    addressHint: "77 Massachusetts Ave, Cambridge, MA",
    directionOrder: {
      cambridge_to_boston: 4,
      boston_to_cambridge: 4,
    },
    zone: "mit",
  },

  // Fenway / Kenmore
  {
    id: "mass_ave_beacon",
    name: "Mass Ave & Beacon St",
    shortLabel: "Beacon",
    lat: 42.3508,
    lng: -71.0892,
    addressHint: "Massachusetts Ave & Beacon St, Boston, MA",
    directionOrder: { cambridge_to_boston: 5 },
    zone: "fenway",
  },
  {
    id: "kenmore",
    name: "Kenmore",
    shortLabel: "Kenmore",
    lat: 42.3489,
    lng: -71.0951,
    addressHint: "Kenmore Square, Boston, MA",
    directionOrder: { boston_to_cambridge: 5 },
    zone: "fenway",
    isFlagStop: true,
  },
  {
    id: "brookline_ave_jersey",
    name: "Brookline Ave & Jersey St",
    shortLabel: "Jersey",
    lat: 42.3454,
    lng: -71.0974,
    addressHint: "Brookline Ave & Jersey St, Boston, MA",
    directionOrder: {
      cambridge_to_boston: 6,
      boston_to_cambridge: 6,
    },
    zone: "fenway",
  },
  {
    id: "landmark_building",
    name: "Landmark Building",
    shortLabel: "Landmark",
    lat: 42.3441,
    lng: -71.1026,
    addressHint: "401 Park Dr / Landmark Center area, Boston, MA",
    directionOrder: {
      cambridge_to_boston: 7,
      boston_to_cambridge: 7,
    },
    zone: "fenway",
  },

  // Longwood end
  {
    id: "simmons_emmanuel",
    name: "Simmons & Emmanuel",
    shortLabel: "Simmons",
    lat: 42.3408,
    lng: -71.1048,
    addressHint: "Simmons University / Emmanuel College area, Boston, MA",
    directionOrder: {
      cambridge_to_boston: 8,
      boston_to_cambridge: 8,
    },
    zone: "longwood",
  },
  {
    id: "vanderbilt_hall",
    name: "Vanderbilt Hall",
    shortLabel: "Vanderbilt",
    lat: 42.3366,
    lng: -71.1037,
    addressHint: "Vanderbilt Hall, 107 Avenue Louis Pasteur, Boston, MA",
    directionOrder: {
      cambridge_to_boston: 9,
      boston_to_cambridge: 9,
    },
    zone: "longwood",
  },
];

export const M2_SHUTTLE: M2ServiceModel = {
  id: "M2",
  name: "M2 Harvard–MIT–Longwood Shuttle",
  operator: "Longwood Collective",
  type: "private_shuttle",
  requiresEligibility: true,
  eligibilityNote:
    "Harvard ID or pre-purchased ticket required for the M2 shuttle.",
  realtimeAvailable: true,
  realtimeNote:
    "Official materials point riders to the Passio Go app for live bus tracking and predictions.",
  weekdayOnly: true,
  notes: [
    "M2 is a Longwood Collective shuttle, not a standard MBTA bus route.",
    "Service is primarily weekday-only; 2026 Longwood materials describe weekday operation with limited Saturday M2 service and reduced summer service.",
    "After 6 PM, shuttles will stop at any MBTA stop in Cambridge upon request.",
    "Coordinates in this model are approximate and should be validated via geocoding before production use.",
  ],
  walkingRadiusMeters: 800,
  lateEveningFlagStopRule:
    "After 18:00, allow drop-off at MBTA stops in Cambridge upon request.",
  headways: {
    cambridge_to_boston: [
      // Approximate engineering model tuned for commute planning
      { days: ["mon", "tue", "wed", "thu", "fri"], startMinuteOfDay: 390, endMinuteOfDay: 570, headwayMin: 10 }, // 6:30-9:30
      { days: ["mon", "tue", "wed", "thu", "fri"], startMinuteOfDay: 570, endMinuteOfDay: 930, headwayMin: 20 }, // 9:30-15:30
      { days: ["mon", "tue", "wed", "thu", "fri"], startMinuteOfDay: 930, endMinuteOfDay: 1140, headwayMin: 10 }, // 15:30-19:00
      { days: ["mon", "tue", "wed", "thu", "fri"], startMinuteOfDay: 1140, endMinuteOfDay: 1410, headwayMin: 30 }, // 19:00-23:30
    ],
    boston_to_cambridge: [
      { days: ["mon", "tue", "wed", "thu", "fri"], startMinuteOfDay: 390, endMinuteOfDay: 570, headwayMin: 10 },
      { days: ["mon", "tue", "wed", "thu", "fri"], startMinuteOfDay: 570, endMinuteOfDay: 930, headwayMin: 20 },
      { days: ["mon", "tue", "wed", "thu", "fri"], startMinuteOfDay: 930, endMinuteOfDay: 1140, headwayMin: 10 },
      { days: ["mon", "tue", "wed", "thu", "fri"], startMinuteOfDay: 1140, endMinuteOfDay: 1410, headwayMin: 30 },
    ],
  },
  segments: {
    cambridge_to_boston: [
      { fromStopId: "lamont_library", toStopId: "mt_auburn_putnam", typicalMinutes: 3, peakMinutes: 4 },
      { fromStopId: "mt_auburn_putnam", toStopId: "mass_ave_bay_st", typicalMinutes: 3, peakMinutes: 4 },
      { fromStopId: "mass_ave_bay_st", toStopId: "central_square", typicalMinutes: 4, peakMinutes: 5 },
      { fromStopId: "central_square", toStopId: "mit", typicalMinutes: 5, peakMinutes: 7 },
      { fromStopId: "mit", toStopId: "mass_ave_beacon", typicalMinutes: 8, peakMinutes: 10 },
      { fromStopId: "mass_ave_beacon", toStopId: "brookline_ave_jersey", typicalMinutes: 4, peakMinutes: 5 },
      { fromStopId: "brookline_ave_jersey", toStopId: "landmark_building", typicalMinutes: 3, peakMinutes: 4 },
      { fromStopId: "landmark_building", toStopId: "simmons_emmanuel", typicalMinutes: 3, peakMinutes: 4 },
      { fromStopId: "simmons_emmanuel", toStopId: "vanderbilt_hall", typicalMinutes: 3, peakMinutes: 4 },
    ],
    boston_to_cambridge: [
      { fromStopId: "vanderbilt_hall", toStopId: "simmons_emmanuel", typicalMinutes: 3, peakMinutes: 4 },
      { fromStopId: "simmons_emmanuel", toStopId: "landmark_building", typicalMinutes: 3, peakMinutes: 4 },
      { fromStopId: "landmark_building", toStopId: "brookline_ave_jersey", typicalMinutes: 3, peakMinutes: 4 },
      { fromStopId: "brookline_ave_jersey", toStopId: "kenmore", typicalMinutes: 4, peakMinutes: 5 },
      { fromStopId: "kenmore", toStopId: "mass_ave_holyoke_center", typicalMinutes: 11, peakMinutes: 14 },
      { fromStopId: "mass_ave_holyoke_center", toStopId: "mass_ave_trowbridge", typicalMinutes: 2, peakMinutes: 3 },
      { fromStopId: "mass_ave_trowbridge", toStopId: "mass_ave_dana_st", typicalMinutes: 2, peakMinutes: 3 },
      { fromStopId: "mass_ave_dana_st", toStopId: "central_square", typicalMinutes: 4, peakMinutes: 5 },
      { fromStopId: "central_square", toStopId: "mit", typicalMinutes: 5, peakMinutes: 7 },
    ],
  },
  stops: STOPS,
};