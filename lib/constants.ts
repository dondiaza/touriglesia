import type { LatLngTuple } from "./types";

export const AUTH_COOKIE_NAME = "touriglesia_auth";
export const AUTH_COOKIE_VALUE = "1";

export const DEMO_USERNAME = "iglesia";
export const DEMO_PASSWORD = "iglesia";

export const MAX_POINTS = 25;
export const SEARCH_DEBOUNCE_MS = 400;
export const DEMO_SESSION_MAX_AGE = 60 * 60 * 8;

export const DEFAULT_MAP_ZOOM = 13;
export const DEFAULT_FOCUS_ZOOM = 16;
export const SEVILLE_CENTER: LatLngTuple = [37.3891, -5.9845];

export const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
export const OSRM_BASE_URL = "https://router.project-osrm.org";
export const OSRM_ROUTE_CHUNK_SIZE = 10;
