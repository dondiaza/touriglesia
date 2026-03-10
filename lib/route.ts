import {
  DEFAULT_TRAVEL_MODE,
  OSRM_DRIVING_BASE_URL,
  OSRM_DRIVING_PROFILE,
  OSRM_ROUTE_CHUNK_SIZE,
  OSRM_WALKING_BASE_URL,
  OSRM_WALKING_FALLBACK_BASE_URL,
  OSRM_WALKING_FALLBACK_PROFILE,
  OSRM_WALKING_LEG_BY_LEG_MAX_POINTS,
  OSRM_WALKING_PROFILE,
  OSRM_WALKING_MAX_PARALLEL_SEGMENTS
} from "./constants";
import { isLikelyNetworkError } from "./errors";
import type {
  LatLngTuple,
  MapPoint,
  MatrixResult,
  OrderedStop,
  RouteLeg,
  RouteStep,
  RouteSummary,
  TravelMode
} from "./types";
import { haversineMeters } from "./utils";

type OsrmTableResponse = {
  code: string;
  durations?: Array<Array<number | null>>;
  distances?: Array<Array<number | null>>;
  message?: string;
};

type OsrmManeuver = {
  type?: string;
  modifier?: string;
};

type OsrmRouteStep = {
  distance: number;
  duration: number;
  name?: string;
  mode?: string;
  maneuver?: OsrmManeuver;
};

type OsrmRouteLeg = {
  distance: number;
  duration: number;
  summary: string;
  steps?: OsrmRouteStep[];
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

type OsrmTripWaypoint = {
  waypoint_index?: number;
};

type OsrmTripResponse = {
  code: string;
  waypoints?: OsrmTripWaypoint[];
  message?: string;
};

type RouteFetchResult = {
  geometry: LatLngTuple[];
  legs: OsrmRouteLeg[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
};

type OsrmCandidate = {
  baseUrl: string;
  profile: string;
  label: string;
};

export async function buildTravelMatrix(
  points: MapPoint[],
  travelMode: TravelMode = DEFAULT_TRAVEL_MODE
): Promise<MatrixResult> {
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
  const candidates = getOsrmCandidates(travelMode);
  const data = await fetchOsrmJson<OsrmTableResponse>(
    candidates,
    (candidate) =>
      `${candidate.baseUrl}/table/v1/${candidate.profile}/${coordinateString}?annotations=duration,distance`,
    (payload) => payload.code === "Ok" && Array.isArray(payload.durations),
    `No se pudo obtener la matriz de tiempos en modo ${travelMode}.`
  );

  if (!data.durations) {
    throw new Error("OSRM no devolvio matriz de duraciones.");
  }

  const durations = sanitizeMatrix(data.durations, 0);
  let distances = data.distances ? sanitizeMatrix(data.distances, 0) : [];

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

export async function buildWalkingMatrix(points: MapPoint[]) {
  return buildTravelMatrix(points, "walking");
}

export async function fetchFullRoute(
  orderedPoints: MapPoint[],
  travelMode: TravelMode = DEFAULT_TRAVEL_MODE
): Promise<RouteFetchResult> {
  if (orderedPoints.length < 2) {
    return {
      geometry: orderedPoints.map((point) => [point.lat, point.lon]),
      legs: [],
      totalDistanceMeters: 0,
      totalDurationSeconds: 0
    };
  }

  const shouldUseLegByLegForWalking =
    travelMode === "walking" &&
    orderedPoints.length <= OSRM_WALKING_LEG_BY_LEG_MAX_POINTS;

  if (shouldUseLegByLegForWalking) {
    return fetchRouteLegByLeg(orderedPoints, travelMode);
  }

  const chunks = createRouteChunks(orderedPoints, OSRM_ROUTE_CHUNK_SIZE);
  let geometry: LatLngTuple[] = [];
  let legs: OsrmRouteLeg[] = [];
  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;

  try {
    for (let index = 0; index < chunks.length; index += 1) {
      const chunkResult = await fetchRouteChunk(chunks[index], travelMode);

      geometry =
        index === 0
          ? chunkResult.geometry
          : [...geometry, ...chunkResult.geometry.slice(1)];

      legs = [...legs, ...chunkResult.legs];
      totalDistanceMeters += chunkResult.totalDistanceMeters;
      totalDurationSeconds += chunkResult.totalDurationSeconds;
    }
  } catch (error) {
    if (travelMode !== "walking") {
      throw error;
    }

    return fetchRouteLegByLeg(orderedPoints, travelMode);
  }

  return {
    geometry,
    legs,
    totalDistanceMeters,
    totalDurationSeconds
  };
}

export async function fetchFullWalkingRoute(orderedPoints: MapPoint[]) {
  return fetchFullRoute(orderedPoints, "walking");
}

export async function fetchTripOptimizedOrder(
  points: MapPoint[],
  travelMode: TravelMode = DEFAULT_TRAVEL_MODE
): Promise<number[] | null> {
  if (points.length < 3) {
    return null;
  }

  const coordinateString = buildCoordinateString(points);
  let data: OsrmTripResponse;

  try {
    data = await fetchOsrmJson<OsrmTripResponse>(
      getOsrmCandidates(travelMode),
      (candidate) =>
        `${candidate.baseUrl}/trip/v1/${candidate.profile}/${coordinateString}?roundtrip=false&source=any&destination=any`,
      (payload) => payload.code === "Ok" && Array.isArray(payload.waypoints),
      "No se pudo obtener una optimizacion adicional del recorrido."
    );
  } catch {
    return null;
  }

  if (!data.waypoints || data.waypoints.length !== points.length) {
    return null;
  }

  const order = new Array<number>(points.length).fill(-1);

  for (let originalIndex = 0; originalIndex < data.waypoints.length; originalIndex += 1) {
    const waypointIndex = data.waypoints[originalIndex]?.waypoint_index;

    if (
      typeof waypointIndex !== "number" ||
      waypointIndex < 0 ||
      waypointIndex >= points.length ||
      order[waypointIndex] !== -1
    ) {
      return null;
    }

    order[waypointIndex] = originalIndex;
  }

  if (order.some((value) => value < 0)) {
    return null;
  }

  return order;
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
      summary: routeLeg?.summary,
      steps: routeLeg?.steps?.map(mapRouteStep) ?? []
    };
  });
}

export function buildOrderedStopsFromLegs(orderedPoints: MapPoint[], legs: RouteLeg[]): OrderedStop[] {
  return orderedPoints.map((point, index) => {
    if (index === 0) {
      return {
        pointId: point.id,
        routeIndex: 0,
        distanceFromPrevious: 0,
        durationFromPrevious: 0
      };
    }

    const leg = legs[index - 1];

    return {
      pointId: point.id,
      routeIndex: index,
      distanceFromPrevious: leg?.distanceMeters ?? 0,
      durationFromPrevious: leg?.durationSeconds ?? 0
    };
  });
}

export function buildRouteSummary(
  orderedPoints: MapPoint[],
  geometry: LatLngTuple[],
  legs: RouteLeg[],
  travelMode: TravelMode = DEFAULT_TRAVEL_MODE
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
    generatedAt: new Date().toISOString(),
    travelMode
  };
}

async function fetchRouteChunk(
  points: MapPoint[],
  travelMode: TravelMode
): Promise<RouteFetchResult> {
  const coordinateString = buildCoordinateString(points);
  const enableAlternatives = travelMode === "walking" && points.length <= 2;
  const params = new URLSearchParams({
    overview: "full",
    geometries: "geojson",
    steps: "true",
    continue_straight: "false",
    alternatives: enableAlternatives ? "true" : "false"
  });
  const data = await fetchOsrmJson<OsrmRouteResponse>(
    getOsrmCandidates(travelMode),
    (candidate) =>
      `${candidate.baseUrl}/route/v1/${candidate.profile}/${coordinateString}?${params.toString()}`,
    (payload) => payload.code === "Ok" && Array.isArray(payload.routes) && payload.routes.length > 0,
    "OSRM no pudo calcular el recorrido completo."
  );
  const routes = data.routes ?? [];

  const route = selectBestRoute(routes, travelMode);

  return {
    geometry: route.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    legs: route.legs,
    totalDistanceMeters: route.distance,
    totalDurationSeconds: route.duration
  };
}

async function fetchRouteLegByLeg(
  orderedPoints: MapPoint[],
  travelMode: TravelMode
): Promise<RouteFetchResult> {
  const segments = orderedPoints
    .slice(1)
    .map((toPoint, index) => [orderedPoints[index], toPoint]);
  const segmentRoutes = await mapWithConcurrency(
    segments,
    OSRM_WALKING_MAX_PARALLEL_SEGMENTS,
    (segment) => fetchRouteChunk(segment, travelMode)
  );

  let geometry: LatLngTuple[] = [];
  let legs: OsrmRouteLeg[] = [];
  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;

  for (let index = 0; index < segmentRoutes.length; index += 1) {
    const legRoute = segmentRoutes[index];
    geometry =
      index === 0
        ? legRoute.geometry
        : [...geometry, ...legRoute.geometry.slice(1)];
    legs = [...legs, ...legRoute.legs];
    totalDistanceMeters += legRoute.totalDistanceMeters;
    totalDurationSeconds += legRoute.totalDurationSeconds;
  }

  return {
    geometry,
    legs,
    totalDistanceMeters,
    totalDurationSeconds
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

function getOsrmCandidates(travelMode: TravelMode) {
  const candidates: OsrmCandidate[] =
    travelMode === "walking"
      ? [
          {
            baseUrl: OSRM_WALKING_BASE_URL,
            profile: OSRM_WALKING_PROFILE,
            label: "OSRM Foot Primary"
          },
          {
            baseUrl: OSRM_WALKING_FALLBACK_BASE_URL,
            profile: OSRM_WALKING_FALLBACK_PROFILE,
            label: "OSRM Foot Fallback"
          }
        ]
      : [
          {
            baseUrl: OSRM_DRIVING_BASE_URL,
            profile: OSRM_DRIVING_PROFILE,
            label: "OSRM Driving"
          }
        ];

  const dedupedCandidates: OsrmCandidate[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const key = `${candidate.baseUrl}|${candidate.profile}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    dedupedCandidates.push(candidate);
  }

  return dedupedCandidates;
}

async function fetchOsrmJson<T extends { code?: string; message?: string }>(
  candidates: OsrmCandidate[],
  buildUrl: (candidate: OsrmCandidate) => string,
  validate: (payload: T) => boolean,
  fallbackErrorMessage: string
) {
  let lastError: string | null = null;

  for (const candidate of candidates) {
    const url = buildUrl(candidate);

    try {
      const response = await fetch(url, {
        cache: "no-store"
      });

      if (!response.ok) {
        lastError = `${candidate.label}: HTTP ${response.status}`;
        continue;
      }

      const payload = (await response.json()) as T;

      if (validate(payload)) {
        return payload;
      }

      lastError =
        payload.message ||
        `${candidate.label}: respuesta invalida del servicio de rutas.`;
    } catch (error) {
      if (isLikelyNetworkError(error)) {
        lastError = `${candidate.label}: no se pudo conectar con el servicio de rutas.`;
      } else {
        lastError = error instanceof Error ? error.message : `${candidate.label}: error desconocido`;
      }
    }
  }

  throw new Error(lastError || fallbackErrorMessage);
}

function mapRouteStep(step: OsrmRouteStep): RouteStep {
  const maneuverType = step.maneuver?.type;
  const maneuverModifier = step.maneuver?.modifier;
  const streetName = step.name?.trim() ? step.name.trim() : undefined;

  return {
    distanceMeters: step.distance,
    durationSeconds: step.duration,
    streetName,
    instruction: buildInstruction(maneuverType, maneuverModifier, streetName),
    maneuverType,
    maneuverModifier
  };
}

function selectBestRoute(routes: OsrmRoute[], travelMode: TravelMode) {
  if (routes.length === 1) {
    return routes[0];
  }

  return routes.reduce((best, current) => {
    if (travelMode === "walking") {
      if (current.distance !== best.distance) {
        return current.distance < best.distance ? current : best;
      }

      return current.duration < best.duration ? current : best;
    }

    if (current.duration !== best.duration) {
      return current.duration < best.duration ? current : best;
    }

    return current.distance < best.distance ? current : best;
  });
}

function buildInstruction(
  maneuverType?: string,
  maneuverModifier?: string,
  streetName?: string
) {
  const viaStreet = streetName ? ` por ${streetName}` : "";

  switch (maneuverType) {
    case "depart":
      return `Sal de tu posicion${viaStreet}.`;
    case "arrive":
      return "Llegas al siguiente punto.";
    case "turn":
      return `Gira ${translateModifier(maneuverModifier)}${viaStreet}.`;
    case "merge":
      return `Incorporate ${translateModifier(maneuverModifier)}${viaStreet}.`;
    case "fork":
      return `Mantente ${translateModifier(maneuverModifier)} en la bifurcacion${viaStreet}.`;
    case "end of road":
      return `Al final de la via, gira ${translateModifier(maneuverModifier)}${viaStreet}.`;
    case "new name":
      return `Continua${viaStreet}.`;
    case "continue":
      return `Sigue recto${viaStreet}.`;
    case "roundabout":
    case "rotary":
      return `En la rotonda, toma la salida indicada${viaStreet}.`;
    case "on ramp":
      return `Toma la rampa${viaStreet}.`;
    case "off ramp":
      return `Sal por la rampa${viaStreet}.`;
    default:
      return streetName ? `Avanza por ${streetName}.` : "Avanza al siguiente tramo.";
  }
}

function translateModifier(modifier?: string) {
  switch (modifier) {
    case "left":
      return "a la izquierda";
    case "right":
      return "a la derecha";
    case "slight left":
      return "ligeramente a la izquierda";
    case "slight right":
      return "ligeramente a la derecha";
    case "sharp left":
      return "bruscamente a la izquierda";
    case "sharp right":
      return "bruscamente a la derecha";
    case "straight":
      return "recto";
    case "uturn":
      return "en sentido contrario";
    default:
      return "segun la via";
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
) {
  if (items.length === 0) {
    return [] as R[];
  }

  const results = new Array<R>(items.length);
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  let cursor = 0;

  async function runWorker() {
    while (true) {
      const index = cursor;
      cursor += 1;

      if (index >= items.length) {
        break;
      }

      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}
