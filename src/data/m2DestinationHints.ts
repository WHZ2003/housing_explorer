// src/data/m2DestinationHints.ts

export const M2_DESTINATION_HINTS = {
  HMS: {
    nearestStopId: "vanderbilt_hall",
    extraWalkMinutes: 2, // Vanderbilt Hall 到 HMS 核心区域可再步行几分钟
  },
  MIT_CSAIL: {
    nearestStopId: "mit",
    extraWalkMinutes: 6,
  },
  HARVARD_SEAS: {
    nearestStopId: "lamont_library",
    extraWalkMinutes: 8, // 视 Oxford/Allston 实际去向再调
  },
  HARVARD_SQUARE: {
    nearestStopId: "lamont_library",
    extraWalkMinutes: 3,
  },
};