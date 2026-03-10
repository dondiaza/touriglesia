"use client";

import { startTransition, useEffect, useState } from "react";

import { SEARCH_DEBOUNCE_MS } from "@/lib/constants";
import { searchLocations } from "@/lib/geo";
import type { SearchResult } from "@/lib/types";

type SearchBoxProps = {
  disabled?: boolean;
  onAddResult: (result: SearchResult) => Promise<void> | void;
};

export default function SearchBox({ disabled = false, onAddResult }: SearchBoxProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const normalized = query.trim();
    let isActive = true;

    if (normalized.length < 3) {
      setResults([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);

      try {
        const nextResults = await searchLocations(normalized);

        if (!isActive) {
          return;
        }

        startTransition(() => {
          setResults(nextResults);
        });
        setError(null);
      } catch (searchError) {
        if (!isActive) {
          return;
        }

        const message =
          searchError instanceof Error
            ? searchError.message
            : "No se pudo buscar la ubicacion.";

        startTransition(() => {
          setResults([]);
        });
        setError(message);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  async function handleAdd(result: SearchResult) {
    setIsAdding(true);

    try {
      await onAddResult(result);
      setQuery("");
      setResults([]);
      setError(null);
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 shadow-[var(--shadow)]">
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          Busqueda
        </p>
        <h2 className="mt-2 font-display text-xl font-semibold text-slate-900">
          Buscar ubicacion
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Busca una iglesia, direccion o punto de interes y anadelo al recorrido.
        </p>
      </div>

      <label className="block">
        <span className="sr-only">Buscar ubicacion</span>
        <input
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] disabled:cursor-not-allowed disabled:bg-slate-100"
          disabled={disabled || isAdding}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ejemplo: Iglesia del Salvador, Sevilla"
          value={query}
        />
      </label>

      <p className="mt-2 text-xs text-[var(--muted)]">
        Escribe al menos 3 caracteres. Los resultados se consultan en Nominatim.
      </p>

      {isLoading ? (
        <p className="mt-3 rounded-2xl bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--accent-strong)]">
          Buscando ubicaciones...
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {results.length > 0 ? (
        <ul className="tour-scrollbar mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
          {results.map((result) => (
            <li className="rounded-2xl border border-slate-200 bg-slate-50 p-3" key={result.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{result.name}</p>
                  <p className="mt-1 text-sm leading-5 text-[var(--muted)]">
                    {result.address || result.displayName}
                  </p>
                  {result.placeType ? (
                    <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--warm)]">
                      {result.placeType}
                    </p>
                  ) : null}
                </div>

                <button
                  className="shrink-0 rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={disabled || isAdding}
                  onClick={() => void handleAdd(result)}
                  type="button"
                >
                  Anadir
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
