"use client";

import { startTransition, useDeferredValue, useEffect, useState } from "react";

import type { DailyNewsDigest } from "@/lib/types";
import { formatDateLabel, shiftIsoDate, toIsoDate } from "@/lib/utils";

type ApiError = {
  message?: string;
};

export default function SuggestionsPanel() {
  const [selectedDate, setSelectedDate] = useState(() => toIsoDate(new Date()));
  const [digest, setDigest] = useState<DailyNewsDigest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deferredDate = useDeferredValue(selectedDate);

  useEffect(() => {
    let ignore = false;

    async function loadDigest() {
      setIsLoading(true);

      try {
        const response = await fetch(`/api/cofradia-news?date=${deferredDate}`, {
          cache: "no-store"
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as ApiError;
          throw new Error(body.message || "No se pudo cargar el resumen de sugerencias.");
        }

        const nextDigest = (await response.json()) as DailyNewsDigest;

        if (!ignore) {
          setDigest(nextDigest);
          setError(null);
        }
      } catch (requestError) {
        if (!ignore) {
          setDigest(null);
          setError(
            requestError instanceof Error
              ? requestError.message
              : "No se pudo cargar el resumen de sugerencias."
          );
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadDigest();

    return () => {
      ignore = true;
    };
  }, [deferredDate]);

  function updateDate(nextDate: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) {
      return;
    }

    startTransition(() => {
      setSelectedDate(nextDate);
    });
  }

  return (
    <section className="space-y-4">
      <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 shadow-[var(--shadow)]">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
            Sugerencias
          </p>
          <h2 className="text-xl font-semibold text-slate-900">Resumen cofrade por fecha</h2>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Consulta un resumen diario de noticias sobre Semana Santa, hermandades y agenda
            eclesiastica. Puedes moverte por dias anteriores y posteriores.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
            onClick={() => updateDate(shiftIsoDate(selectedDate, -1))}
            type="button"
          >
            Dia anterior
          </button>
          <button
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
            onClick={() => updateDate(toIsoDate(new Date()))}
            type="button"
          >
            Hoy
          </button>
          <button
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
            onClick={() => updateDate(shiftIsoDate(selectedDate, 1))}
            type="button"
          >
            Dia siguiente
          </button>
          <input
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
            onChange={(event) => updateDate(event.target.value)}
            type="date"
            value={selectedDate}
          />
        </div>

        <p className="mt-4 text-sm font-medium text-slate-700">
          Fecha consultada: <span className="text-slate-900">{formatDateLabel(selectedDate)}</span>
        </p>

        {isLoading ? (
          <p className="mt-4 rounded-2xl bg-[var(--accent-soft)] px-3 py-3 text-sm text-[var(--accent-strong)]">
            Cargando resumen del dia...
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        {digest ? (
          <>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Resumen del dia
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                {digest.summary.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-500">
                Fuente: {digest.sourceLabel}
              </p>
            </div>

            <div className="mt-4">
              <h3 className="text-lg font-semibold text-slate-900">Titulares y enlaces</h3>
              <ul className="tour-scrollbar mt-3 max-h-[34rem] space-y-3 overflow-y-auto pr-1">
                {digest.articles.map((article) => (
                  <li className="rounded-2xl border border-slate-200 bg-[var(--panel-bg)] p-3" key={article.id}>
                    <a
                      className="block transition hover:text-[var(--accent-strong)]"
                      href={article.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <p className="font-semibold text-slate-900">{article.title}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                        <span>{article.source}</span>
                        <span>{formatDateLabel(article.publishedAt)}</span>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : null}
      </section>
    </section>
  );
}
