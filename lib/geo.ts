import { NOMINATIM_BASE_URL, SACRED_SEARCH_PRESETS } from "./constants";
import type { PointDraft, SearchBias, SearchResult } from "./types";
import { clampPointName, createStableId } from "./utils";

type NominatimResult = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  class?: string;
  type?: string;
  addresstype?: string;
  address?: Record<string, string>;
  extratags?: Record<string, string>;
};

type SearchLocationsOptions = {
  bias?: SearchBias | null;
};

const SACRED_KEYWORDS = /(iglesia|parroquia|hermandad|cofradia|capilla|basilica|ermita|santuario|convento|templo|colegiata|catedral|church|chapel|cathedral|parish)/i;
const SACRED_TYPES = new Set([
  "church",
  "chapel",
  "cathedral",
  "place_of_worship",
  "religious",
  "monastery",
  "shrine"
]);

export async function searchLocations(
  query: string,
  limit = 6,
  options?: SearchLocationsOptions
): Promise<SearchResult[]> {
  const normalized = query.trim();

  if (normalized.length < 3) {
    return [];
  }

  const queries = buildSearchVariants(normalized);
  const responses = await Promise.all(
    queries.map((searchQuery, index) =>
      fetchSearchVariant(searchQuery, limit, index, options?.bias || null)
    )
  );

  const rankedResults = responses
    .flatMap((response) =>
      response.items.map((item, itemIndex) =>
        rankSearchResult(mapNominatimResult(item), normalized, response.rank, itemIndex, options?.bias || null)
      )
    )
    .sort((left, right) => {
      if ((right.priorityScore ?? 0) !== (left.priorityScore ?? 0)) {
        return (right.priorityScore ?? 0) - (left.priorityScore ?? 0);
      }

      return left.name.localeCompare(right.name, "es");
    });

  const dedupedResults: SearchResult[] = [];
  const seenIds = new Set<string>();

  for (const result of rankedResults) {
    if (seenIds.has(result.id)) {
      continue;
    }

    seenIds.add(result.id);
    dedupedResults.push(result);

    if (dedupedResults.length >= limit) {
      break;
    }
  }

  return dedupedResults;
}

export async function fetchNearbyInterest(
  lat: number,
  lon: number,
  limit = 8
): Promise<SearchResult[]> {
  const queries = [
    "iglesia",
    "hermandad",
    "cofradia",
    "capilla",
    "cerveceria"
  ];

  const responses = await Promise.all(
    queries.map((query, index) =>
      fetchSearchVariant(
        query,
        Math.max(3, Math.ceil(limit / 2)),
        index,
        {
          lat,
          lon,
          radiusKm: 3.5,
          bounded: true
        }
      )
    )
  );

  const flattened = responses
    .flatMap((response) =>
      response.items.map((item, itemIndex) =>
        rankSearchResult(mapNominatimResult(item), queries[response.rank] || "", response.rank, itemIndex, {
          lat,
          lon,
          radiusKm: 3.5,
          bounded: true
        })
      )
    )
    .sort((left, right) => (right.priorityScore ?? 0) - (left.priorityScore ?? 0));

  const dedupedResults: SearchResult[] = [];
  const seenIds = new Set<string>();

  for (const result of flattened) {
    if (seenIds.has(result.id)) {
      continue;
    }

    seenIds.add(result.id);
    dedupedResults.push(result);

    if (dedupedResults.length >= limit) {
      break;
    }
  }

  return dedupedResults;
}

export async function reverseGeocode(lat: number, lon: number): Promise<SearchResult | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: "jsonv2",
    addressdetails: "1",
    extratags: "1",
    zoom: "18"
  });

  try {
    const response = await fetch(`${NOMINATIM_BASE_URL}/reverse?${params.toString()}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as NominatimResult & { error?: string };

    if (data.error) {
      return null;
    }

    return rankSearchResult(mapNominatimResult(data), data.display_name, 0, 0, null);
  } catch {
    return null;
  }
}

export function searchResultToPointDraft(result: SearchResult, source: PointDraft["source"]): PointDraft {
  return {
    id: createStableId("point"),
    name: clampPointName(result.name, "Punto"),
    lat: result.lat,
    lon: result.lon,
    address: result.address,
    displayName: result.displayName,
    placeType: result.placeType,
    metadata: result.metadata,
    source
  };
}

export function buildMapPointDraftFromReverse(
  lat: number,
  lon: number,
  reverseResult: SearchResult | null
): PointDraft {
  if (!reverseResult) {
    return buildFallbackPointDraft(lat, lon);
  }

  return {
    id: createStableId("point"),
    name: clampPointName(reverseResult.name, "Punto en mapa"),
    lat,
    lon,
    address: reverseResult.address || reverseResult.displayName || "Ubicacion aproximada",
    displayName: reverseResult.displayName,
    placeType: reverseResult.placeType,
    metadata: reverseResult.metadata,
    source: "map"
  };
}

export function buildFallbackPointDraft(lat: number, lon: number): PointDraft {
  return {
    id: createStableId("point"),
    name: "Punto manual",
    lat,
    lon,
    address: "Ubicacion aproximada",
    displayName: `Ubicacion aproximada (${lat.toFixed(5)}, ${lon.toFixed(5)})`,
    source: "map"
  };
}

function mapNominatimResult(result: NominatimResult): SearchResult {
  const displayName = result.display_name;
  const primaryName =
    result.name ||
    result.address?.amenity ||
    result.address?.building ||
    result.address?.tourism ||
    result.address?.road ||
    displayName.split(",")[0] ||
    "Punto";

  const metadata: Record<string, string> = {};

  if (result.class) {
    metadata.class = result.class;
  }

  if (result.type) {
    metadata.type = result.type;
  }

  if (result.addresstype) {
    metadata.addressType = result.addresstype;
  }

  if (result.extratags?.religion) {
    metadata.religion = result.extratags.religion;
  }

  if (result.extratags?.website) {
    metadata.website = result.extratags.website;
  }

  if (result.address?.country_code) {
    metadata.countryCode = result.address.country_code.toUpperCase();
  }

  if (result.address?.city || result.address?.town || result.address?.village) {
    metadata.cityLabel = result.address.city || result.address.town || result.address.village;
  }

  return {
    id: `nominatim-${result.place_id}`,
    name: clampPointName(primaryName, "Punto"),
    displayName,
    address: displayName,
    lat: Number(result.lat),
    lon: Number(result.lon),
    placeType: result.addresstype || result.type || result.class,
    metadata
  };
}

async function fetchSearchVariant(
  query: string,
  limit: number,
  rank: number,
  bias: SearchBias | null
) {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    extratags: "1",
    namedetails: "1",
    limit: String(limit)
  });

  if (bias) {
    applyBiasParams(params, bias);
  }

  const response = await fetch(`${NOMINATIM_BASE_URL}/search?${params.toString()}`, {
    cache: "no-store",
    headers: {
      "Accept-Language": "es"
    }
  });

  if (!response.ok) {
    throw new Error("No se pudo consultar Nominatim. Intentalo de nuevo en unos segundos.");
  }

  const items = (await response.json()) as NominatimResult[];
  return {
    rank,
    items
  };
}

function applyBiasParams(params: URLSearchParams, bias: SearchBias) {
  const radiusKm = Math.min(20, Math.max(2, bias.radiusKm || 8));
  const [left, top, right, bottom] = getViewBox(bias.lat, bias.lon, radiusKm);
  params.set("viewbox", `${left},${top},${right},${bottom}`);

  if (bias.bounded) {
    params.set("bounded", "1");
  }

  if (bias.countryCode) {
    params.set("countrycodes", bias.countryCode.toLowerCase());
  }
}

function getViewBox(lat: number, lon: number, radiusKm: number) {
  const latDelta = radiusKm / 111.32;
  const lonDelta = radiusKm / (111.32 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const left = lon - lonDelta;
  const right = lon + lonDelta;
  const top = lat + latDelta;
  const bottom = lat - latDelta;
  return [left, top, right, bottom];
}

function buildSearchVariants(query: string) {
  const normalized = query.trim();
  const variants = [normalized];

  if (!SACRED_KEYWORDS.test(normalized)) {
    variants.unshift(
      `${SACRED_SEARCH_PRESETS[0]} ${normalized}`,
      `${SACRED_SEARCH_PRESETS[1]} ${normalized}`,
      `${SACRED_SEARCH_PRESETS[2]} ${normalized}`
    );
  }

  return Array.from(new Set(variants)).slice(0, 4);
}

function rankSearchResult(
  result: SearchResult,
  rawQuery: string,
  queryRank: number,
  itemIndex: number,
  bias: SearchBias | null
): SearchResult {
  const normalizedQuery = rawQuery.toLowerCase();
  const haystack = [
    result.name,
    result.displayName,
    result.address,
    result.placeType,
    ...(result.metadata ? Object.values(result.metadata) : [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const sacredMatch = isSacredResult(result, haystack);
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

  let priorityScore = sacredMatch ? 120 : 0;
  priorityScore += Math.max(0, 24 - queryRank * 8);
  priorityScore += Math.max(0, 10 - itemIndex);

  for (const token of queryTokens) {
    if (token && haystack.includes(token)) {
      priorityScore += 8;
    }
  }

  if (result.name.toLowerCase() === normalizedQuery) {
    priorityScore += 20;
  } else if (result.name.toLowerCase().startsWith(normalizedQuery)) {
    priorityScore += 12;
  }

  if (bias?.countryCode) {
    const resultCountryCode = result.metadata?.countryCode?.toUpperCase();
    if (resultCountryCode === bias.countryCode.toUpperCase()) {
      priorityScore += 16;
    }
  }

  if (bias) {
    const distancePenalty = distanceBiasPenalty(result.lat, result.lon, bias.lat, bias.lon);
    priorityScore -= distancePenalty;
  }

  return {
    ...result,
    sacredMatch,
    priorityScore
  };
}

function distanceBiasPenalty(resultLat: number, resultLon: number, biasLat: number, biasLon: number) {
  const dLat = resultLat - biasLat;
  const dLon = resultLon - biasLon;
  const approxKm = Math.sqrt(dLat * dLat + dLon * dLon) * 111;

  if (approxKm <= 3) {
    return 0;
  }

  if (approxKm <= 10) {
    return 8;
  }

  if (approxKm <= 40) {
    return 25;
  }

  return 70;
}

function isSacredResult(result: SearchResult, haystack: string) {
  if (SACRED_KEYWORDS.test(haystack)) {
    return true;
  }

  const placeType = result.placeType?.toLowerCase();

  if (placeType && SACRED_TYPES.has(placeType)) {
    return true;
  }

  const religion = result.metadata?.religion?.toLowerCase();
  return religion === "christian";
}
