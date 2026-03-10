import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";

import { normalizeUserError } from "@/lib/errors";
import type { PersistedTourState } from "@/lib/types";

type PersistedStateBody = {
  key?: string;
  data?: PersistedTourState;
};

type PersistedStateRow = {
  state_key: string;
  data: PersistedTourState;
  updated_at: string;
};

const DEFAULT_STATE_KEY = "iglesia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const stateKey = normalizeStateKey(request.nextUrl.searchParams.get("key"));
  const sql = getNeonClient();

  if (!sql) {
    return NextResponse.json(
      {
        message:
          "Persistencia remota no configurada. Define POSTGRES_URL o DATABASE_URL para activarla.",
        data: null
      },
      {
        status: 503
      }
    );
  }

  try {
    await ensureStateTable(sql);
    const result = (await sql`
      SELECT state_key, data, updated_at
      FROM touriglesia_state
      WHERE state_key = ${stateKey}
      LIMIT 1
    `) as PersistedStateRow[];
    const row = result[0];

    return NextResponse.json(
      {
        key: stateKey,
        data: row?.data ?? null,
        updatedAt: row?.updated_at ?? null
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        message: normalizeUserError(
          error,
          "No se pudo recuperar el estado persistente.",
          "No se pudo conectar con la base de datos para cargar el estado."
        )
      },
      {
        status: 500
      }
    );
  }
}

export async function POST(request: NextRequest) {
  const sql = getNeonClient();

  if (!sql) {
    return NextResponse.json(
      {
        message:
          "Persistencia remota no configurada. Define POSTGRES_URL o DATABASE_URL para activarla."
      },
      {
        status: 503
      }
    );
  }

  let body: PersistedStateBody;

  try {
    body = (await request.json()) as PersistedStateBody;
  } catch {
    return NextResponse.json(
      {
        message: "El cuerpo de la solicitud no es JSON valido."
      },
      {
        status: 400
      }
    );
  }

  if (!body.data || typeof body.data !== "object") {
    return NextResponse.json(
      {
        message: "No se recibio un estado valido para guardar."
      },
      {
        status: 400
      }
    );
  }

  const stateKey = normalizeStateKey(body.key);

  try {
    await ensureStateTable(sql);
    const serializedState = JSON.stringify(body.data);

    await sql`
      INSERT INTO touriglesia_state (state_key, data, updated_at)
      VALUES (${stateKey}, ${serializedState}::jsonb, NOW())
      ON CONFLICT (state_key)
      DO UPDATE SET
        data = EXCLUDED.data,
        updated_at = NOW()
    `;

    return NextResponse.json(
      {
        key: stateKey,
        saved: true
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        message: normalizeUserError(
          error,
          "No se pudo guardar el estado en la base de datos.",
          "No se pudo conectar con la base de datos para guardar el estado."
        )
      },
      {
        status: 500
      }
    );
  }
}

function normalizeStateKey(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return DEFAULT_STATE_KEY;
  }

  return trimmed.slice(0, 80);
}

function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    null
  );
}

function getNeonClient() {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    return null;
  }

  return neon(databaseUrl);
}

async function ensureStateTable(sql: any) {
  await sql`
    CREATE TABLE IF NOT EXISTS touriglesia_state (
      state_key TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}
