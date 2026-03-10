const NETWORK_ERROR_PATTERNS = [
  "failed to fetch",
  "fetch failed",
  "networkerror",
  "network request failed",
  "load failed",
  "enotfound",
  "econnrefused",
  "etimedout",
  "timeout"
];

export function isLikelyNetworkError(error: unknown) {
  if (!error) {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  return NETWORK_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function normalizeUserError(
  error: unknown,
  fallbackMessage: string,
  networkMessage?: string
) {
  if (isLikelyNetworkError(error)) {
    return networkMessage || "No se pudo conectar con el servicio externo. Intentalo de nuevo.";
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}
