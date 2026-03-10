import {
  buildRouteSummary,
  buildTravelMatrix,
  buildOrderedStopsFromLegs,
  computeLegSummaries,
  fetchTripOptimizedOrder,
  fetchFullRoute
} from "./route";
import {
  buildOrderedStops,
  getOpenPathCost,
  selectBestOpenRoute,
  twoOptImprove,
  type OptimizationMetric
} from "./tsp";
import type { MapPoint, OrderedStop, RouteHistoryEntry, RouteSummary, TravelMode } from "./types";
import {
  applyStopsToPoints,
  buildHistoryLabel,
  buildPointIndexLookup,
  createStableId,
  reorderItems
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
  const candidateOrders: number[][] = [];
  const heuristicOrder = selectBestOpenRoute(matrix, optimizationMetric);
  candidateOrders.push(heuristicOrder);

  const tripOrder = await fetchTripOptimizedOrder(points, effectiveTravelMode);

  if (tripOrder && tripOrder.length === points.length) {
    candidateOrders.push(
      twoOptImprove(tripOrder, matrix, {
        keepStart: false,
        metric: optimizationMetric
      })
    );
  }

  const improvedOrder = candidateOrders.reduce((bestOrder, candidateOrder) => {
    const bestCost = getOpenPathCost(bestOrder, matrix, optimizationMetric);
    const candidateCost = getOpenPathCost(candidateOrder, matrix, optimizationMetric);
    return candidateCost < bestCost
      ? candidateOrder
      : bestOrder;
  }, heuristicOrder);
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

export function moveRouteStop(pointOrder: string[], pointId: string, direction: "up" | "down") {
  const currentIndex = pointOrder.indexOf(pointId);

  if (currentIndex === -1) {
    return pointOrder;
  }

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (targetIndex < 0 || targetIndex >= pointOrder.length) {
    return pointOrder;
  }

  return reorderItems(pointOrder, currentIndex, targetIndex);
}

export function buildRouteHistoryEntry(
  pointsSnapshot: MapPoint[],
  orderedStops: OrderedStop[],
  routeSummary: RouteSummary
): RouteHistoryEntry {
  return {
    id: createStableId("route"),
    label: buildHistoryLabel(pointsSnapshot, routeSummary),
    createdAt: routeSummary.generatedAt,
    travelMode: routeSummary.travelMode,
    orderedStops,
    routeSummary,
    pointsSnapshot
  };
}
