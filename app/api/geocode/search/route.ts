import { NextRequest, NextResponse } from "next/server";

import { normalizeUserError } from "@/lib/errors";

import { fetchNominatim } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json(
      {
        message: "Falta el parametro q para la busqueda."
      },
      {
        status: 400
      }
    );
  }

  const params = new URLSearchParams(request.nextUrl.searchParams);
  params.set("q", query);
  params.set("format", "jsonv2");
  params.set("addressdetails", "1");
  params.set("extratags", "1");
  params.set("namedetails", "1");

  try {
    const payload = await fetchNominatim<unknown[]>({
      path: "search",
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
          "No se pudo consultar Nominatim.",
          "No se pudo conectar con Nominatim. Revisa la conexion e intentalo de nuevo."
        )
      },
      {
        status: 502
      }
    );
  }
}
