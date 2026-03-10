import { normalizeUserError } from "./errors";
import type { PersistedTourState } from "./types";

type PersistedStateApiResponse = {
  message?: string;
  data?: PersistedTourState | null;
};

const DEFAULT_STATE_KEY = "iglesia";

export async function fetchPersistedTourState(
  key = DEFAULT_STATE_KEY
): Promise<PersistedTourState | null> {
  const params = new URLSearchParams({
    key
  });
  const response = await fetch(`/api/state?${params.toString()}`, {
    cache: "no-store"
  });
  const body = (await response.json().catch(() => ({}))) as PersistedStateApiResponse;

  if (!response.ok) {
    throw new Error(
      body.message ||
        normalizeUserError(
          null,
          "No se pudo cargar el estado guardado.",
          "No se pudo conectar con el servicio de persistencia."
        )
    );
  }

  return body.data || null;
}

export async function savePersistedTourState(
  data: PersistedTourState,
  key = DEFAULT_STATE_KEY
): Promise<void> {
  const response = await fetch("/api/state", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store",
    body: JSON.stringify({
      key,
      data
    })
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as PersistedStateApiResponse;

    throw new Error(
      body.message ||
        normalizeUserError(
          null,
          "No se pudo guardar el estado.",
          "No se pudo conectar con el servicio de persistencia."
        )
    );
  }
}
