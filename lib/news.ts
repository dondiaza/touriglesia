import { COFRADE_NEWS_QUERY, GDELT_BASE_URL } from "./constants";
import { normalizeUserError } from "./errors";
import type { DailyNewsDigest, NewsArticle } from "./types";
import { formatDateLabel } from "./utils";

type GdeltArticle = {
  url: string;
  title: string;
  seendate?: string;
  socialimage?: string;
  domain?: string;
};

export async function fetchDailyCofradiaDigest(isoDate: string): Promise<DailyNewsDigest> {
  const compactDate = isoDate.replaceAll("-", "");
  const query = encodeURIComponent(`(${COFRADE_NEWS_QUERY}) sourceCountry:ES`);
  const url = `${GDELT_BASE_URL}?query=${query}&mode=ArtList&format=json&maxrecords=10&sort=datedesc&startdatetime=${compactDate}000000&enddatetime=${compactDate}235959`;
  let response: Response;

  try {
    response = await fetch(url, {
      cache: "no-store"
    });
  } catch (error) {
    throw new Error(
      normalizeUserError(
        error,
        "No se pudieron cargar las noticias cofrades del dia seleccionado.",
        "No se pudo conectar con el servicio publico de noticias."
      )
    );
  }

  if (!response.ok) {
    throw new Error("No se pudieron cargar las noticias cofrades del dia seleccionado.");
  }

  const rawBody = await response.text();
  let data: { articles?: GdeltArticle[] };

  try {
    data = JSON.parse(rawBody) as { articles?: GdeltArticle[] };
  } catch {
    throw new Error("El servicio publico de noticias no ha devuelto un JSON valido.");
  }

  const articles = (data.articles ?? []).map((article, index) => mapGdeltArticle(article, isoDate, index));

  return {
    date: isoDate,
    summary: buildNewsSummary(articles, isoDate),
    articles,
    sourceLabel: "Resumen publico a partir de GDELT"
  };
}

function mapGdeltArticle(article: GdeltArticle, isoDate: string, index: number): NewsArticle {
  return {
    id: `news-${isoDate}-${index}`,
    title: article.title || "Titular sin titulo",
    url: article.url,
    source: article.domain || "Fuente publica",
    publishedAt: normalizeGdeltDate(article.seendate, isoDate),
    imageUrl: article.socialimage
  };
}

function buildNewsSummary(articles: NewsArticle[], isoDate: string) {
  if (articles.length === 0) {
    return [
      `No se han encontrado titulares cofrades o eclesiasticos para ${formatDateLabel(isoDate)}.`,
      "Prueba a revisar el dia anterior o el siguiente desde los controles de fecha.",
      "La pestaña se alimenta de un servicio publico y puede variar segun la cobertura del dia."
    ];
  }

  const themeCounts = [
    { label: "hermandades y cofradias", count: countMatches(articles, /(hermandad|cofradia)/i) },
    { label: "procesiones y recorridos", count: countMatches(articles, /(procesion|recorrido|estacion)/i) },
    { label: "cultos y agenda parroquial", count: countMatches(articles, /(culto|parroquia|iglesia|basilica)/i) },
    { label: "avisos y horarios", count: countMatches(articles, /(horario|cambio|aviso|corte)/i) }
  ]
    .sort((left, right) => right.count - left.count)
    .filter((theme) => theme.count > 0)
    .slice(0, 3)
    .map((theme) => theme.label);

  const topSources = Array.from(new Set(articles.map((article) => article.source))).slice(0, 3);

  return [
    `Se han localizado ${articles.length} titulares para ${formatDateLabel(isoDate)}.`,
    themeCounts.length > 0
      ? `Temas mas repetidos: ${themeCounts.join(", ")}.`
      : "No se han podido extraer temas dominantes del conjunto de titulares.",
    topSources.length > 0
      ? `Fuentes destacadas del dia: ${topSources.join(", ")}.`
      : "No hay fuentes destacadas disponibles para esta fecha."
  ];
}

function countMatches(articles: NewsArticle[], pattern: RegExp) {
  return articles.filter((article) => pattern.test(article.title)).length;
}

function normalizeGdeltDate(rawDate: string | undefined, fallbackDate: string) {
  if (!rawDate || rawDate.length < 8) {
    return fallbackDate;
  }

  const year = rawDate.slice(0, 4);
  const month = rawDate.slice(4, 6);
  const day = rawDate.slice(6, 8);
  return `${year}-${month}-${day}`;
}
