import { DEFAULT_TRAVEL_MODE, OSRM_BASE_URL, OSRM_ROUTE_CHUNK_SIZE } from "./constants";
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

type RouteFetchResult = {
  geometry: LatLngTuple[];
  legs: OsrmRouteLeg[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
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
  const profile = getOsrmProfile(travelMode);
  const url = `${OSRM_BASE_URL}/table/v1/${profile}/${coordinateString}?annotations=duration,distance`;
  const response = await fetch(url, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`No se pudo obtener la matriz de tiempos en modo ${travelMode}.`);
  }

  const data = (await response.json()) as OsrmTableResponse;

  if (data.code !== "Ok" || !data.durations) {
    throw new Error(data.message || "OSRM no pudo construir la matriz del recorrido.");
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

  const chunks = createRouteChunks(orderedPoints, OSRM_ROUTE_CHUNK_SIZE);
  let geometry: LatLngTuple[] = [];
  let legs: OsrmRouteLeg[] = [];
  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;

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
  const profile = getOsrmProfile(travelMode);
  const url = `${OSRM_BASE_URL}/route/v1/${profile}/${coordinateString}?overview=full&geometries=geojson&steps=true`;
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

function getOsrmProfile(travelMode: TravelMode) {
  return travelMode === "driving" ? "driving" : "foot";
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
