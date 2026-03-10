import { normalizeUserError } from "./errors";
import type {
  PersistedStateEnvelope,
  PersistedStateSaveResult,
  PersistedTourState
} from "./types";

type PersistedStateApiResponse = {
  message?: string;
  key?: string;
  data?: PersistedTourState | null;
  revision?: number;
  updatedAt?: string | null;
  saved?: boolean;
  applied?: boolean;
};

const DEFAULT_STATE_KEY = "iglesia";

export async function fetchPersistedTourState(
  key = DEFAULT_STATE_KEY
): Promise<PersistedStateEnvelope> {
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

  return {
    key: body.key || key,
    data: body.data || null,
    revision: normalizeRevision(body.revision),
    updatedAt: body.updatedAt || null
  };
}

export async function savePersistedTourState(
  data: PersistedTourState,
  key = DEFAULT_STATE_KEY,
  revision = 0
): Promise<PersistedStateSaveResult> {
  const response = await fetch("/api/state", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store",
    body: JSON.stringify({
      key,
      data,
      revision
    })
  });

  const body = (await response.json().catch(() => ({}))) as PersistedStateApiResponse;

  if (!response.ok) {
    throw new Error(
      body.message ||
        normalizeUserError(
          null,
          "No se pudo guardar el estado.",
          "No se pudo conectar con el servicio de persistencia."
        )
    );
  }

  return {
    key: body.key || key,
    saved: body.saved ?? true,
    applied: body.applied ?? true,
    revision: normalizeRevision(body.revision),
    updatedAt: body.updatedAt || null
  };
}

function normalizeRevision(value: number | undefined) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.trunc(value);
  }

  return 0;
}
