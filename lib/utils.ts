import { DEFAULT_FOCUS_ZOOM } from "./constants";
import type { MapFocus, MapPoint } from "./types";

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
