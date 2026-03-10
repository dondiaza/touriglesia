import { OSRM_BASE_URL, OSRM_ROUTE_CHUNK_SIZE } from "./constants";
import type { LatLngTuple, MapPoint, MatrixResult, RouteLeg, RouteSummary } from "./types";
import { haversineMeters } from "./utils";

type OsrmTableResponse = {
  code: string;
  durations?: Array<Array<number | null>>;
  distances?: Array<Array<number | null>>;
  message?: string;
};

type OsrmRouteLeg = {
  distance: number;
  duration: number;
  summary: string;
};

type OsrmRoute = {
  distance: number;
  duration: number;
  geometry: {
    coordinates: Array<[number, number]>;
  };
  legs: OsrmRouteLeg[];
};

type OsrmRouteResponse = {
  code: string;
  routes?: OsrmRoute[];
  message?: string;
};

type RouteFetchResult = {
  geometry: LatLngTuple[];
  legs: OsrmRouteLeg[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
};

export async function buildWalkingMatrix(points: MapPoint[]): Promise<MatrixResult> {
  if (points.length === 0) {
    return {
      durations: [],
      distances: []
    };
  }

  if (points.length === 1) {
    return {
      durations: [[0]],
      distances: [[0]]
    };
  }

  const coordinateString = buildCoordinateString(points);
  const primaryUrl = `${OSRM_BASE_URL}/table/v1/foot/${coordinateString}?annotations=duration,distance`;
  const primaryResponse = await fetch(primaryUrl, {
    cache: "no-store"
  });

  if (!primaryResponse.ok) {
    throw new Error("No se pudo obtener la matriz de tiempos andando desde OSRM.");
  }

  const primaryData = (await primaryResponse.json()) as OsrmTableResponse;

  if (primaryData.code !== "Ok" || !primaryData.durations) {
    throw new Error(primaryData.message || "OSRM no pudo construir la matriz de recorrido.");
  }

  const durations = sanitizeMatrix(primaryData.durations, 0);
  let distances = primaryData.distances
    ? sanitizeMatrix(primaryData.distances, 0)
    : [];

  if (distances.length === 0) {
    distances = points.map((fromPoint) =>
      points.map((toPoint) => haversineMeters(fromPoint.lat, fromPoint.lon, toPoint.lat, toPoint.lon))
    );
  }

  return {
    durations,
    distances
  };
}

export async function fetchFullWalkingRoute(orderedPoints: MapPoint[]): Promise<RouteFetchResult> {
  if (orderedPoints.length < 2) {
    return {
      geometry: orderedPoints.map((point) => [point.lat, point.lon]),
      legs: [],
      totalDistanceMeters: 0,
      totalDurationSeconds: 0
    };
  }

  const chunks = createRouteChunks(orderedPoints, OSRM_ROUTE_CHUNK_SIZE);
  let geometry: LatLngTuple[] = [];
  let legs: OsrmRouteLeg[] = [];
  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;

  for (let index = 0; index < chunks.length; index += 1) {
    const chunkResult = await fetchRouteChunk(chunks[index]);

    geometry =
      index === 0
        ? chunkResult.geometry
        : [...geometry, ...chunkResult.geometry.slice(1)];

    legs = [...legs, ...chunkResult.legs];
    totalDistanceMeters += chunkResult.totalDistanceMeters;
    totalDurationSeconds += chunkResult.totalDurationSeconds;
  }

  return {
    geometry,
    legs,
    totalDistanceMeters,
    totalDurationSeconds
  };
}

export function computeLegSummaries(
  orderedPoints: MapPoint[],
  routeLegs?: OsrmRouteLeg[],
  matrix?: MatrixResult,
  pointIndexLookup?: Map<string, number>
): RouteLeg[] {
  if (orderedPoints.length < 2) {
    return [];
  }

  return orderedPoints.slice(1).map((point, index) => {
    const previousPoint = orderedPoints[index];
    const routeLeg = routeLegs?.[index];

    let distanceMeters = routeLeg?.distance;
    let durationSeconds = routeLeg?.duration;

    if (
      (typeof distanceMeters !== "number" || typeof durationSeconds !== "number") &&
      matrix &&
      pointIndexLookup
    ) {
      const fromIndex = pointIndexLookup.get(previousPoint.id);
      const toIndex = pointIndexLookup.get(point.id);

      if (typeof fromIndex === "number" && typeof toIndex === "number") {
        distanceMeters = matrix.distances[fromIndex][toIndex];
        durationSeconds = matrix.durations[fromIndex][toIndex];
      }
    }

    return {
      fromPointId: previousPoint.id,
      toPointId: point.id,
      fromIndex: index,
      toIndex: index + 1,
      distanceMeters: distanceMeters ?? 0,
      durationSeconds: durationSeconds ?? 0,
      summary: routeLeg?.summary
    };
  });
}

export function buildRouteSummary(
  orderedPoints: MapPoint[],
  geometry: LatLngTuple[],
  legs: RouteLeg[]
): RouteSummary {
  const totals = legs.reduce(
    (accumulator, leg) => {
      accumulator.distance += leg.distanceMeters;
      accumulator.duration += leg.durationSeconds;
      return accumulator;
    },
    {
      distance: 0,
      duration: 0
    }
  );

  return {
    pointOrder: orderedPoints.map((point) => point.id),
    totalDistanceMeters: totals.distance,
    totalDurationSeconds: totals.duration,
    legs,
    geometry,
    generatedAt: new Date().toISOString()
  };
}

async function fetchRouteChunk(points: MapPoint[]): Promise<RouteFetchResult> {
  const coordinateString = buildCoordinateString(points);
  const url = `${OSRM_BASE_URL}/route/v1/foot/${coordinateString}?overview=full&geometries=geojson&steps=false`;
  const response = await fetch(url, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("OSRM no pudo devolver la geometria de la ruta.");
  }

  const data = (await response.json()) as OsrmRouteResponse;
  const route = data.routes?.[0];

  if (data.code !== "Ok" || !route) {
    throw new Error(data.message || "OSRM no pudo calcular el recorrido completo.");
  }

  return {
    geometry: route.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    legs: route.legs,
    totalDistanceMeters: route.distance,
    totalDurationSeconds: route.duration
  };
}

function buildCoordinateString(points: Array<Pick<MapPoint, "lat" | "lon">>) {
  return points.map((point) => `${point.lon},${point.lat}`).join(";");
}

function sanitizeMatrix(matrix: Array<Array<number | null>>, diagonalValue: number) {
  return matrix.map((row, rowIndex) =>
    row.map((value, columnIndex) => {
      if (rowIndex === columnIndex) {
        return diagonalValue;
      }

      return typeof value === "number" ? value : Number.POSITIVE_INFINITY;
    })
  );
}

function createRouteChunks(points: MapPoint[], chunkSize: number) {
  if (points.length <= chunkSize) {
    return [points];
  }

  const chunks: MapPoint[][] = [];
  let start = 0;

  while (start < points.length) {
    const end =
      start === 0
        ? Math.min(chunkSize, points.length)
        : Math.min(start + chunkSize - 1, points.length);

    const chunk =
      start === 0
        ? points.slice(start, end)
        : points.slice(start - 1, end);

    chunks.push(chunk);

    if (end >= points.length) {
      break;
    }

    start = end;
  }

  return chunks;
}
