export type PointSource = "search" | "map" | "demo";
export type TravelMode = "walking" | "driving";
export type SuggestedPlaceCategory = "iglesia" | "cofrade" | "cerveceria";

export type LatLngTuple = [number, number];

export type PointDraft = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  address?: string;
  displayName?: string;
  placeType?: string;
  metadata?: Record<string, string>;
  source: PointSource;
};

export type MapPoint = PointDraft & {
  createdOrder: number;
  routeIndex?: number;
  distanceFromPrevious?: number;
  durationFromPrevious?: number;
};

export type SearchResult = {
  id: string;
  name: string;
  displayName: string;
  address?: string;
  lat: number;
  lon: number;
  placeType?: string;
  metadata?: Record<string, string>;
  sacredMatch?: boolean;
  priorityScore?: number;
};

export type MatrixResult = {
  durations: number[][];
  distances: number[][];
};

export type OrderedStop = {
  pointId: string;
  routeIndex: number;
  distanceFromPrevious: number;
  durationFromPrevious: number;
};

export type RouteLeg = {
  fromPointId: string;
  toPointId: string;
  fromIndex: number;
  toIndex: number;
  distanceMeters: number;
  durationSeconds: number;
  summary?: string;
  steps?: RouteStep[];
};

export type RouteStep = {
  distanceMeters: number;
  durationSeconds: number;
  streetName?: string;
  instruction: string;
  maneuverType?: string;
  maneuverModifier?: string;
};

export type RouteSummary = {
  pointOrder: string[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  legs: RouteLeg[];
  geometry: LatLngTuple[];
  generatedAt: string;
  travelMode: TravelMode;
};

export type RouteHistoryEntry = {
  id: string;
  label: string;
  routeName?: string;
  savedBy?: string;
  createdAt: string;
  travelMode: TravelMode;
  orderedStops: OrderedStop[];
  routeSummary: RouteSummary;
  pointsSnapshot: MapPoint[];
};

export type MapFocus = {
  lat: number;
  lon: number;
  zoom?: number;
  nonce: number;
};

export type NewsArticle = {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  imageUrl?: string;
};

export type DailyNewsDigest = {
  date: string;
  summary: string[];
  articles: NewsArticle[];
  sourceLabel: string;
};

export type SuggestedPlace = {
  id: string;
  name: string;
  category: SuggestedPlaceCategory;
  lat: number;
  lon: number;
  address?: string;
  description?: string;
  votes?: number;
  isCommunity?: boolean;
};

export type SearchBias = {
  lat: number;
  lon: number;
  radiusKm?: number;
  bounded?: boolean;
  countryCode?: string;
};

export type UserLocation = {
  lat: number;
  lon: number;
  areaLabel?: string;
  countryCode?: string;
  syncedAt: string;
};

export type CommunityPlace = {
  id: string;
  name: string;
  category: SuggestedPlaceCategory;
  lat: number;
  lon: number;
  address?: string;
  description?: string;
  votes: number;
  createdAt: string;
};
