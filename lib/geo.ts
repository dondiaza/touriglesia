import { NOMINATIM_BASE_URL } from "./constants";
import type { PointDraft, SearchResult } from "./types";
import { clampPointName } from "./utils";

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

export async function searchLocations(query: string, limit = 5): Promise<SearchResult[]> {
  const normalized = query.trim();

  if (normalized.length < 3) {
    return [];
  }

  const params = new URLSearchParams({
    q: normalized,
    format: "jsonv2",
    addressdetails: "1",
    extratags: "1",
    namedetails: "1",
    limit: String(limit)
  });

  const response = await fetch(`${NOMINATIM_BASE_URL}/search?${params.toString()}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("No se pudo consultar Nominatim. Intentalo de nuevo en unos segundos.");
  }

  const data = (await response.json()) as NominatimResult[];
  return data.map(mapNominatimResult);
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

  return mapNominatimResult(data);
}

export function searchResultToPointDraft(result: SearchResult, source: PointDraft["source"]): PointDraft {
  return {
    id: createPointId(),
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

export function buildFallbackPointDraft(lat: number, lon: number): PointDraft {
  return {
    id: createPointId(),
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

function createPointId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `point-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
