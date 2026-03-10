import { NOMINATIM_BASE_URL } from "@/lib/constants";

const NOMINATIM_FALLBACK_BASE_URLS = [
  NOMINATIM_BASE_URL,
  "https://nominatim.openstreetmap.org",
  "https://nominatim.openstreetmap.fr"
];

type FetchNominatimOptions = {
  path: "search" | "reverse";
  params: URLSearchParams;
  acceptLanguage?: string | null;
};

export async function fetchNominatim<T>({
  path,
  params,
  acceptLanguage
}: FetchNominatimOptions): Promise<T> {
  const baseUrls = Array.from(
    new Set(
      NOMINATIM_FALLBACK_BASE_URLS.map((candidate) => candidate.trim()).filter(Boolean)
    )
  );
  const headers = buildNominatimHeaders(acceptLanguage);
  let lastError = "No se pudo conectar con Nominatim.";

  for (const baseUrl of baseUrls) {
    const endpoint = `${baseUrl}/${path}?${params.toString()}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const response = await fetch(endpoint, {
        cache: "no-store",
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          lastError = "Nominatim esta limitando solicitudes temporalmente. Intenta en unos segundos.";
          continue;
        }

        lastError = `Nominatim devolvio HTTP ${response.status}.`;
        continue;
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "No se pudo conectar con Nominatim.";
    }
  }

  throw new Error(lastError);
}

function buildNominatimHeaders(acceptLanguage?: string | null) {
  return {
    "Accept-Language": acceptLanguage?.trim() || "es",
    "User-Agent":
      process.env.NOMINATIM_USER_AGENT ||
      "touriglesia/1.0 (cofrade planner; contacto local)"
  };
}
