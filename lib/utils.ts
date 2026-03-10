import { DEFAULT_FOCUS_ZOOM, TRAVEL_MODE_LABELS } from "./constants";
import type {
  MapFocus,
  MapPoint,
  OrderedStop,
  RouteSummary,
  TravelMode
} from "./types";

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function clampPointName(name: string, fallback = "Punto sin nombre") {
  const trimmed = name.trim();
  return trimmed ? trimmed.slice(0, 80) : fallback;
}

export function formatDistance(meters?: number | null) {
  if (typeof meters !== "number" || Number.isNaN(meters)) {
    return "--";
  }

  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : km.toFixed(0)} km`;
}

export function formatDuration(seconds?: number | null) {
  if (typeof seconds !== "number" || Number.isNaN(seconds)) {
    return "--";
  }

  const totalMinutes = Math.max(1, Math.round(seconds / 60));

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${minutes} min`;
}

export function formatCoordinates(lat: number, lon: number) {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

export function formatTravelMode(travelMode: TravelMode) {
  return TRAVEL_MODE_LABELS[travelMode];
}

export function buildFocusTarget(lat: number, lon: number, zoom = DEFAULT_FOCUS_ZOOM): MapFocus {
  return {
    lat,
    lon,
    zoom,
    nonce: Date.now()
  };
}

export function stripRouteMetadata(point: MapPoint): MapPoint {
  return {
    ...point,
    routeIndex: undefined,
    distanceFromPrevious: undefined,
    durationFromPrevious: undefined
  };
}

export function sortPointsForDisplay(points: MapPoint[]) {
  return [...points].sort((left, right) => {
    const leftRank = typeof left.routeIndex === "number" ? left.routeIndex : Number.MAX_SAFE_INTEGER;
    const rightRank = typeof right.routeIndex === "number" ? right.routeIndex : Number.MAX_SAFE_INTEGER;

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return left.createdOrder - right.createdOrder;
  });
}

export function buildPointIndexLookup(points: MapPoint[]) {
  return new Map(points.map((point, index) => [point.id, index]));
}

export function applyStopsToPoints(points: MapPoint[], orderedStops: OrderedStop[]) {
  const stopLookup = new Map(orderedStops.map((stop) => [stop.pointId, stop]));

  return points.map((point) => {
    const stop = stopLookup.get(point.id);

    if (!stop) {
      return stripRouteMetadata(point);
    }

    return {
      ...point,
      routeIndex: stop.routeIndex,
      distanceFromPrevious: stop.distanceFromPrevious,
      durationFromPrevious: stop.durationFromPrevious
    };
  });
}

export function reorderItems<T>(items: T[], fromIndex: number, toIndex: number) {
  const nextItems = items.slice();
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

export function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function shiftIsoDate(isoDate: string, days: number) {
  const baseDate = new Date(`${isoDate}T00:00:00`);
  baseDate.setDate(baseDate.getDate() + days);
  return toIsoDate(baseDate);
}

export function formatDateLabel(isoDate: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date(`${isoDate}T00:00:00`));
}

export function getPointDisplayName(point: MapPoint) {
  return point.name || `Punto ${typeof point.routeIndex === "number" ? point.routeIndex + 1 : point.createdOrder}`;
}

export function createStableId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildHistoryLabel(points: MapPoint[], summary: RouteSummary) {
  const orderedPoints = summary.pointOrder
    .map((pointId) => points.find((point) => point.id === pointId))
    .filter(Boolean) as MapPoint[];

  const firstPoint = orderedPoints[0];
  const lastPoint = orderedPoints[orderedPoints.length - 1];
  const routeMode = formatTravelMode(summary.travelMode);

  if (!firstPoint || !lastPoint) {
    return `Ruta ${routeMode}`;
  }

  return `${firstPoint.name || "Inicio"} -> ${lastPoint.name || "Fin"} (${routeMode})`;
}

export function haversineMeters(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number
) {
  const earthRadius = 6371000;
  const dLat = degreesToRadians(toLat - fromLat);
  const dLon = degreesToRadians(toLon - fromLon);
  const lat1 = degreesToRadians(fromLat);
  const lat2 = degreesToRadians(toLat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}
