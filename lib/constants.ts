import type { LatLngTuple, TravelMode } from "./types";

export const AUTH_COOKIE_NAME = "touriglesia_auth";
export const AUTH_COOKIE_VALUE = "1";

export const DEMO_USERNAME = "iglesia";
export const DEMO_PASSWORD = "iglesia";

export const MAX_POINTS = 25;
export const SEARCH_DEBOUNCE_MS = 400;
export const DEMO_SESSION_MAX_AGE = 60 * 60 * 8;
export const ROUTE_HISTORY_LIMIT = 12;

export const DEFAULT_MAP_ZOOM = 13;
export const DEFAULT_FOCUS_ZOOM = 16;
export const SEVILLE_CENTER: LatLngTuple = [37.3891, -5.9845];

export const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
export const OSRM_BASE_URL = "https://router.project-osrm.org";
export const OSRM_ROUTE_CHUNK_SIZE = 10;
export const GDELT_BASE_URL = "https://api.gdeltproject.org/api/v2/doc/doc";

export const SACRED_SEARCH_PRESETS = [
  "Iglesia",
  "Parroquia",
  "Hermandad",
  "Capilla",
  "Basilica"
] as const;

export const DEFAULT_TRAVEL_MODE: TravelMode = "walking";

export const TRAVEL_MODE_LABELS: Record<TravelMode, string> = {
  walking: "A pie",
  driving: "Coche"
};

export const COFRADE_NEWS_QUERY =
  "\"semana santa\" OR cofradia OR cofradias OR hermandad OR hermandades OR parroquia OR iglesia OR basilica OR procesion";
