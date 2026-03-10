import type { MapPoint, MatrixResult, OrderedStop } from "./types";

export type OptimizationMetric = "duration" | "distance";

type TwoOptOptions = {
  keepStart?: boolean;
  metric?: OptimizationMetric;
};

export function nearestNeighborRoute(
  matrix: MatrixResult,
  startIndex = 0,
  metric: OptimizationMetric = "duration"
) {
  const size = matrix.durations.length;

  if (size === 0) {
    return [];
  }

  const normalizedStart = Math.min(Math.max(startIndex, 0), size - 1);
  const order = [normalizedStart];
  const remaining = new Set<number>(Array.from({ length: size }, (_, index) => index));
  remaining.delete(normalizedStart);

  while (remaining.size > 0) {
    const current = order[order.length - 1];
    let bestCandidate = -1;
    let bestPrimaryCost = Number.POSITIVE_INFINITY;
    let bestSecondaryCost = Number.POSITIVE_INFINITY;

    for (const candidate of remaining) {
      const primaryCost = getEdgeCost(matrix, current, candidate, metric);
      const secondaryCost = getEdgeCost(
        matrix,
        current,
        candidate,
        metric === "distance" ? "duration" : "distance"
      );

      const isBetter =
        primaryCost < bestPrimaryCost ||
        (primaryCost === bestPrimaryCost && secondaryCost < bestSecondaryCost);

      if (isBetter) {
        bestCandidate = candidate;
        bestPrimaryCost = primaryCost;
        bestSecondaryCost = secondaryCost;
      }
    }

    if (bestCandidate === -1) {
      break;
    }

    order.push(bestCandidate);
    remaining.delete(bestCandidate);
  }

  return order;
}

export function twoOptImprove(order: number[], matrix: MatrixResult, options?: TwoOptOptions) {
  if (order.length < 4) {
    return order.slice();
  }

  const keepStart = options?.keepStart ?? true;
  const metric = options?.metric ?? "duration";
  const firstMutableIndex = keepStart ? 1 : 0;
  let bestOrder = order.slice();
  let bestCost = getOpenPathCost(bestOrder, matrix, metric);
  let improved = true;

  while (improved) {
    improved = false;

    for (let start = firstMutableIndex; start < bestOrder.length - 1; start += 1) {
      for (let end = start + 1; end < bestOrder.length; end += 1) {
        const candidate = swapSegment(bestOrder, start, end);
        const candidateCost = getOpenPathCost(candidate, matrix, metric);

        if (candidateCost + 1e-6 < bestCost) {
          bestOrder = candidate;
          bestCost = candidateCost;
          improved = true;
          break;
        }
      }

      if (improved) {
        break;
      }
    }
  }

  return bestOrder;
}

export function selectBestOpenRoute(
  matrix: MatrixResult,
  metric: OptimizationMetric = "duration"
) {
  const size = matrix.durations.length;

  if (size === 0) {
    return [];
  }

  let bestOrder: number[] = [];
  let bestCost = Number.POSITIVE_INFINITY;

  for (let startIndex = 0; startIndex < size; startIndex += 1) {
    const seedOrder = nearestNeighborRoute(matrix, startIndex, metric);
    const improvedOrder = twoOptImprove(seedOrder, matrix, { keepStart: true, metric });
    const normalizedOrder = twoOptImprove(improvedOrder, matrix, {
      keepStart: false,
      metric
    });
    const candidateCost = getOpenPathCost(normalizedOrder, matrix, metric);

    if (candidateCost < bestCost) {
      bestCost = candidateCost;
      bestOrder = normalizedOrder;
    }
  }

  return bestOrder;
}

export function buildOrderedStops(order: number[], points: MapPoint[], matrix: MatrixResult): OrderedStop[] {
  return order.map((pointIndex, routeIndex) => {
    if (routeIndex === 0) {
      return {
        pointId: points[pointIndex].id,
        routeIndex,
        distanceFromPrevious: 0,
        durationFromPrevious: 0
      };
    }

    const previousIndex = order[routeIndex - 1];

    return {
      pointId: points[pointIndex].id,
      routeIndex,
      distanceFromPrevious: matrix.distances[previousIndex][pointIndex] ?? 0,
      durationFromPrevious: matrix.durations[previousIndex][pointIndex] ?? 0
    };
  });
}

export function getOpenPathCost(
  order: number[],
  matrix: MatrixResult,
  metric: OptimizationMetric = "duration"
) {
  let total = 0;

  for (let index = 1; index < order.length; index += 1) {
    total += getEdgeCost(matrix, order[index - 1], order[index], metric);
  }

  return total;
}

function swapSegment(order: number[], start: number, end: number) {
  return [
    ...order.slice(0, start),
    ...order.slice(start, end + 1).reverse(),
    ...order.slice(end + 1)
  ];
}

function getEdgeCost(
  matrix: MatrixResult,
  fromIndex: number,
  toIndex: number,
  metric: OptimizationMetric
) {
  if (metric === "distance") {
    return matrix.distances[fromIndex]?.[toIndex] ?? Number.POSITIVE_INFINITY;
  }

  return matrix.durations[fromIndex]?.[toIndex] ?? Number.POSITIVE_INFINITY;
}
