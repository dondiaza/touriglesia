import type { MapPoint, MatrixResult, OrderedStop } from "./types";

type TwoOptOptions = {
  keepStart?: boolean;
};

export function nearestNeighborRoute(matrix: MatrixResult, startIndex = 0) {
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
    let bestDuration = Number.POSITIVE_INFINITY;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const candidate of remaining) {
      const duration = matrix.durations[current]?.[candidate] ?? Number.POSITIVE_INFINITY;
      const distance = matrix.distances[current]?.[candidate] ?? Number.POSITIVE_INFINITY;

      const isBetter =
        duration < bestDuration ||
        (duration === bestDuration && distance < bestDistance);

      if (isBetter) {
        bestCandidate = candidate;
        bestDuration = duration;
        bestDistance = distance;
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
  const firstMutableIndex = keepStart ? 1 : 0;
  let bestOrder = order.slice();
  let bestCost = getOpenPathCost(bestOrder, matrix);
  let improved = true;

  while (improved) {
    improved = false;

    for (let start = firstMutableIndex; start < bestOrder.length - 1; start += 1) {
      for (let end = start + 1; end < bestOrder.length; end += 1) {
        const candidate = swapSegment(bestOrder, start, end);
        const candidateCost = getOpenPathCost(candidate, matrix);

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

export function selectBestOpenRoute(matrix: MatrixResult) {
  const size = matrix.durations.length;

  if (size === 0) {
    return [];
  }

  let bestOrder: number[] = [];
  let bestCost = Number.POSITIVE_INFINITY;

  for (let startIndex = 0; startIndex < size; startIndex += 1) {
    const seedOrder = nearestNeighborRoute(matrix, startIndex);
    const improvedOrder = twoOptImprove(seedOrder, matrix, { keepStart: true });
    const normalizedOrder = twoOptImprove(improvedOrder, matrix, { keepStart: false });
    const candidateCost = getOpenPathCost(normalizedOrder, matrix);

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

export function getOpenPathCost(order: number[], matrix: MatrixResult) {
  let total = 0;

  for (let index = 1; index < order.length; index += 1) {
    total += matrix.durations[order[index - 1]][order[index]] ?? Number.POSITIVE_INFINITY;
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
