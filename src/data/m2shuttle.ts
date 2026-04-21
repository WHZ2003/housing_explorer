// src/data/m2shuttle.ts

export type M2Direction = "cambridge_to_boston" | "boston_to_cambridge";

export interface M2Stop {
  id: string;
  name: string;
  shortLabel: string;
  lat: number;
  lng: number;
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
  startMinuteOfDay: number;
  endMinuteOfDay: number;
  headwayMin: number;
}

export interface M2TravelSegment {
  fromStopId: string;
  toStopId: string;
  typicalMinutes: number;
  peakMinutes?: number;
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
  {
    id: "lamont_library",
    name: "Harvard Square at Lamont Library",
    shortLabel: "Lamont",
    lat: 42.3729,
    lng: -71.1157,
    addressHint: "Lamont Library, Harvard University, Cambridge, MA",
    directionOrder: { cambridge_to_boston: 0 },
    zone: "cambridge",
  },
  {
    id: "mass_ave_holyoke_center",
    name: "Mass Ave at Holyoke Center",
    shortLabel: "Holyoke",
    lat: 42.3733,
    lng: -71.1180,
    addressHint: "Massachusetts Ave & Holyoke St, Cambridge, MA",
    directionOrder: { boston_to_cambridge: 9 },
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
    directionOrder: { boston_to_cambridge: 8 },
    zone: "cambridge",
  },
  {
    id: "mass_ave_bay_st",
    name: "Bay St & Mass Ave",
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
    directionOrder: { boston_to_cambridge: 7 },
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
      boston_to_cambridge: 6,
    },
    zone: "cambridge",
  },
  {
    id: "mit",
    name: "Mass Ave at MIT",
    shortLabel: "MIT",
    lat: 42.3593,
    lng: -71.0935,
    addressHint: "77 Massachusetts Ave, Cambridge, MA",
    directionOrder: {
      cambridge_to_boston: 4,
      boston_to_cambridge: 5,
    },
    zone: "mit",
  },
  {
    id: "mass_ave_beacon",
    name: "Mass Ave & Beacon St",
    shortLabel: "Beacon",
    lat: 42.3508,
    lng: -71.0892,
    addressHint: "Massachusetts Ave & Beacon St, Boston, MA",
    directionOrder: {
      cambridge_to_boston: 5,
      boston_to_cambridge: 4,
    },
    zone: "fenway",
  },
  {
    id: "kenmore",
    name: "Kenmore Square",
    shortLabel: "Kenmore",
    lat: 42.3489,
    lng: -71.0951,
    addressHint: "Kenmore Square, Boston, MA",
    directionOrder: {
      cambridge_to_boston: 6,
      boston_to_cambridge: 3,
    },
    zone: "fenway",
  },
  {
    id: "brookline_ave_fullerton",
    name: "Brookline Ave & Fullerton St",
    shortLabel: "Fullerton",
    lat: 42.3446,
    lng: -71.1004,
    addressHint: "Brookline Ave & Fullerton St, Boston, MA",
    directionOrder: { boston_to_cambridge: 1 },
    zone: "fenway",
  },
  {
    id: "brookline_ave_jersey",
    name: "Brookline Ave & Jersey St",
    shortLabel: "Jersey",
    lat: 42.3454,
    lng: -71.0974,
    addressHint: "Brookline Ave & Jersey St, Boston, MA",
    directionOrder: {
      cambridge_to_boston: 7,
      boston_to_cambridge: 2,
    },
    zone: "fenway",
  },
  {
    id: "landmark_building",
    name: "Landmark Building",
    shortLabel: "Landmark",
    lat: 42.3441,
    lng: -71.1026,
    addressHint: "Landmark Center area, Boston, MA",
    directionOrder: { cambridge_to_boston: 8 },
    zone: "fenway",
  },
  {
    id: "simmons_emmanuel",
    name: "Simmons & Emmanuel",
    shortLabel: "Simmons",
    lat: 42.3408,
    lng: -71.1048,
    addressHint: "Simmons University / Emmanuel College area, Boston, MA",
    directionOrder: { cambridge_to_boston: 9 },
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
      cambridge_to_boston: 10,
      boston_to_cambridge: 0,
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
  eligibilityNote: "Harvard ID or pre-purchased ticket required for the M2 shuttle.",
  realtimeAvailable: true,
  realtimeNote: "Official materials point riders to the Passio Go app for live bus tracking and predictions.",
  weekdayOnly: true,
  notes: [
    "M2 is a Longwood Collective shuttle, not a standard MBTA bus route.",
    "The printed schedules show weekday service.",
    "After 6 PM, shuttles will stop at any MBTA stop in Cambridge upon request.",
    "Boston→Cambridge order and timing are based on the official M2 Boston schedule PDF.",
    "Cambridge→Boston order and timing are based on the official M2 Harvard schedule PDF.",
  ],
  walkingRadiusMeters: 800,
  lateEveningFlagStopRule: "After 18:00, allow drop-off at any MBTA stop in Cambridge upon request.",
  headways: {
    cambridge_to_boston: [
      { days: ["mon", "tue", "wed", "thu", "fri"], startMinuteOfDay: 400, endMinuteOfDay: 600, headwayMin: 10 }, // 6:40-10:00
      { days: ["mon", "tue", "wed", "thu", "fri"], startMinuteOfDay: 600, endMinuteOfDay: 950, headwayMin: 25 }, // sparse / mixed service
      { days: ["mon", "tue", "wed", "thu", "fri"], startMinuteOfDay: 950, endMinuteOfDay: 1080, headwayMin: 10 }, // 15:50-18:00-ish strong PM service
      { days: ["mon", "tue", "wed", "thu", "fri"], startMinuteOfDay: 1080, endMinuteOfDay: 1380, headwayMin: 30 }, // evening
    ],
    boston_to_cambridge: [
      { days: ["mon", "tue", "wed", "thu", "fri"], startMinuteOfDay: 430, endMinuteOfDay: 570, headwayMin: 10 }, // 7:10-9:30
      { days: ["mon", "tue", "wed", "thu", "fri"], startMinuteOfDay: 570, endMinuteOfDay: 945, headwayMin: 25 }, // mixed midday pattern
      { days: ["mon", "tue", "wed", "thu", "fri"], startMinuteOfDay: 945, endMinuteOfDay: 1090, headwayMin: 10 }, // 15:45-18:10-ish
      { days: ["mon", "tue", "wed", "thu", "fri"], startMinuteOfDay: 1090, endMinuteOfDay: 1410, headwayMin: 30 }, // evening
    ],
  },
  segments: {
    cambridge_to_boston: [
      { fromStopId: "lamont_library",        toStopId: "mt_auburn_putnam",    typicalMinutes: 2, peakMinutes: 2 },
      { fromStopId: "mt_auburn_putnam",      toStopId: "mass_ave_bay_st",     typicalMinutes: 1, peakMinutes: 2 },
      { fromStopId: "mass_ave_bay_st",       toStopId: "central_square",      typicalMinutes: 2, peakMinutes: 3 },
      { fromStopId: "central_square",        toStopId: "mit",                 typicalMinutes: 4, peakMinutes: 5 },
      { fromStopId: "mit",                   toStopId: "mass_ave_beacon",     typicalMinutes: 5, peakMinutes: 6 },
      { fromStopId: "mass_ave_beacon",       toStopId: "kenmore",             typicalMinutes: 1, peakMinutes: 1 },
      { fromStopId: "kenmore",               toStopId: "brookline_ave_jersey",typicalMinutes: 2, peakMinutes: 3 },
      { fromStopId: "brookline_ave_jersey",  toStopId: "landmark_building",   typicalMinutes: 2, peakMinutes: 2 },
      { fromStopId: "landmark_building",     toStopId: "simmons_emmanuel",    typicalMinutes: 2, peakMinutes: 2 },
      { fromStopId: "simmons_emmanuel",      toStopId: "vanderbilt_hall",     typicalMinutes: 2, peakMinutes: 2 },
    ],
    boston_to_cambridge: [
      { fromStopId: "vanderbilt_hall",           toStopId: "brookline_ave_fullerton", typicalMinutes: 2, peakMinutes: 2 },
      { fromStopId: "brookline_ave_fullerton",   toStopId: "brookline_ave_jersey",    typicalMinutes: 1, peakMinutes: 2 },
      { fromStopId: "brookline_ave_jersey",      toStopId: "kenmore",                 typicalMinutes: 2, peakMinutes: 3 },
      { fromStopId: "kenmore",                   toStopId: "mass_ave_beacon",         typicalMinutes: 1, peakMinutes: 1 },
      { fromStopId: "mass_ave_beacon",           toStopId: "mit",                     typicalMinutes: 5, peakMinutes: 6 },
      { fromStopId: "mit",                       toStopId: "central_square",          typicalMinutes: 4, peakMinutes: 5 },
      { fromStopId: "central_square",            toStopId: "mass_ave_dana_st",        typicalMinutes: 2, peakMinutes: 2 },
      { fromStopId: "mass_ave_dana_st",          toStopId: "mass_ave_trowbridge",     typicalMinutes: 2, peakMinutes: 2 },
      { fromStopId: "mass_ave_trowbridge",       toStopId: "mass_ave_holyoke_center", typicalMinutes: 2, peakMinutes: 2 },
    ],
  },
  stops: STOPS,
};