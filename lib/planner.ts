import {
  buildRouteSummary,
  buildTravelMatrix,
  buildOrderedStopsFromLegs,
  computeLegSummaries,
  fetchFullRoute
} from "./route";
import {
  buildOrderedStops,
  selectBestOpenRoute,
  type OptimizationMetric
} from "./tsp";
import type { MapPoint, OrderedStop, RouteHistoryEntry, RouteSummary, TravelMode } from "./types";
import {
  applyStopsToPoints,
  buildHistoryLabel,
  buildPointIndexLookup,
  createStableId
} from "./utils";

type PlannerResult = {
  routeSummary: RouteSummary;
  orderedStops: OrderedStop[];
  pointsSnapshot: MapPoint[];
};

export async function generateOptimizedRoute(points: MapPoint[], _travelMode: TravelMode): Promise<PlannerResult> {
  const effectiveTravelMode: TravelMode = "walking";
  const matrix = await buildTravelMatrix(points, effectiveTravelMode);
  const optimizationMetric: OptimizationMetric = "distance";
  const improvedOrder = selectBestOpenRoute(matrix, optimizationMetric);
  const orderedPoints = improvedOrder.map((index) => points[index]);
  const routeResult = await fetchFullRoute(orderedPoints, effectiveTravelMode);
  const pointIndexLookup = buildPointIndexLookup(points);
  const legs = computeLegSummaries(orderedPoints, routeResult.legs, matrix, pointIndexLookup);
  const orderedStops = buildOrderedStops(improvedOrder, points, matrix).map((stop, index) => {
    if (index === 0) {
      return stop;
    }

    const leg = legs[index - 1];

    return {
      ...stop,
      distanceFromPrevious: leg.distanceMeters,
      durationFromPrevious: leg.durationSeconds
    };
  });

  const routeSummary = buildRouteSummary(orderedPoints, routeResult.geometry, legs, effectiveTravelMode);

  return {
    routeSummary,
    orderedStops,
    pointsSnapshot: applyStopsToPoints(points, orderedStops)
  };
}

export async function rebuildRouteFromManualOrder(
  points: MapPoint[],
  pointOrder: string[],
  _travelMode: TravelMode
): Promise<PlannerResult> {
  const effectiveTravelMode: TravelMode = "walking";
  const orderedPoints = pointOrder
    .map((pointId) => points.find((point) => point.id === pointId))
    .filter(Boolean) as MapPoint[];

  const routeResult = await fetchFullRoute(orderedPoints, effectiveTravelMode);
  const legs = computeLegSummaries(orderedPoints, routeResult.legs);
  const orderedStops = buildOrderedStopsFromLegs(orderedPoints, legs);
  const routeSummary = buildRouteSummary(orderedPoints, routeResult.geometry, legs, effectiveTravelMode);

  return {
    routeSummary,
    orderedStops,
    pointsSnapshot: applyStopsToPoints(points, orderedStops)
  };
}

export function buildRouteHistoryEntry(
  pointsSnapshot: MapPoint[],
  orderedStops: OrderedStop[],
  routeSummary: RouteSummary,
  routeName?: string,
  savedBy?: string
): RouteHistoryEntry {
  const normalizedRouteName = routeName?.trim();
  const normalizedSavedBy = savedBy?.trim();
  const fallbackLabel = buildHistoryLabel(pointsSnapshot, routeSummary);
  const label =
    normalizedRouteName && normalizedSavedBy
      ? `${normalizedRouteName} (${normalizedSavedBy})`
      : normalizedRouteName
        ? normalizedRouteName
        : fallbackLabel;

  return {
    id: createStableId("route"),
    label,
    routeName: normalizedRouteName,
    savedBy: normalizedSavedBy,
    createdAt: new Date().toISOString(),
    travelMode: routeSummary.travelMode,
    orderedStops,
    routeSummary,
    pointsSnapshot
  };
}
