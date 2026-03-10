export type PointSource = "search" | "map" | "demo";

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
};

export type RouteSummary = {
  pointOrder: string[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  legs: RouteLeg[];
  geometry: LatLngTuple[];
  generatedAt: string;
};

export type MapFocus = {
  lat: number;
  lon: number;
  zoom?: number;
  nonce: number;
};
