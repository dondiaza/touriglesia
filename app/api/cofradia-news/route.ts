import { NextRequest, NextResponse } from "next/server";

import { fetchDailyCofradiaDigest } from "@/lib/news";
import { toIsoDate } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const dateParam = request.nextUrl.searchParams.get("date");
  const isoDate = isValidIsoDate(dateParam) ? dateParam : toIsoDate(new Date());

  try {
    const digest = await fetchDailyCofradiaDigest(isoDate);

    return NextResponse.json(digest, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las sugerencias para la fecha seleccionada."
      },
      {
        status: 500
      }
    );
  }
}

function isValidIsoDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}
