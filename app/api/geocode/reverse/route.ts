import { NextRequest, NextResponse } from "next/server";

import { normalizeUserError } from "@/lib/errors";

import { fetchNominatim } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const lat = request.nextUrl.searchParams.get("lat");
  const lon = request.nextUrl.searchParams.get("lon");

  if (!lat || !lon) {
    return NextResponse.json(
      {
        message: "Faltan lat o lon para la busqueda inversa."
      },
      {
        status: 400
      }
    );
  }

  const params = new URLSearchParams(request.nextUrl.searchParams);
  params.set("lat", lat);
  params.set("lon", lon);
  params.set("format", "jsonv2");
  params.set("addressdetails", "1");
  params.set("extratags", "1");
  params.set("zoom", params.get("zoom") || "18");

  try {
    const payload = await fetchNominatim<Record<string, unknown>>({
      path: "reverse",
      params,
      acceptLanguage: request.headers.get("accept-language")
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: normalizeUserError(
          error,
          "No se pudo consultar Nominatim en modo inverso.",
          "No se pudo conectar con Nominatim. Revisa la conexion e intentalo de nuevo."
        )
      },
      {
        status: 502
      }
    );
  }
}
