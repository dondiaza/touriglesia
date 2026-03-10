"use client";

import { startTransition, useEffect, useState } from "react";

import { SACRED_SEARCH_PRESETS, SEARCH_DEBOUNCE_MS } from "@/lib/constants";
import { searchLocations } from "@/lib/geo";
import type { SearchResult } from "@/lib/types";
import { cn } from "@/lib/utils";

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

  function handlePresetClick(preset: string) {
    const normalized = query.trim();
    const nextQuery = normalized
      ? normalized.toLowerCase().startsWith(preset.toLowerCase())
        ? normalized
        : `${preset} ${normalized}`
      : `${preset} Sevilla`;

    setQuery(nextQuery);
  }

  function handleEnterShortcut(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || results.length === 0 || isAdding || disabled) {
      return;
    }

    event.preventDefault();
    void handleAdd(results[0]);
  }

  return (
    <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 shadow-[var(--shadow)]">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          Buscador
        </p>
        <h2 className="text-xl font-semibold text-slate-900">Autocompletar de puntos</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Prioriza iglesias, parroquias, hermandades y capillas. Pulsa Enter para anadir el
          primer resultado.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {SACRED_SEARCH_PRESETS.map((preset) => (
          <button
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
            disabled={disabled || isAdding}
            key={preset}
            onClick={() => handlePresetClick(preset)}
            type="button"
          >
            {preset}
          </button>
        ))}
      </div>

      <label className="mt-4 block">
        <span className="sr-only">Buscar ubicacion</span>
        <input
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] disabled:cursor-not-allowed disabled:bg-slate-100"
          disabled={disabled || isAdding}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleEnterShortcut}
          placeholder="Ejemplo: Iglesia del Salvador, Sevilla"
          value={query}
        />
      </label>

      <p className="mt-2 text-xs text-[var(--muted)]">
        El buscador mezcla una consulta normal y otra sesgada al ambito cofrade para mostrar
        primero resultados eclesiasticos.
      </p>

      {isLoading ? (
        <p className="mt-3 rounded-2xl bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--accent-strong)]">
          Buscando sugerencias...
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {query.trim().length >= 3 && results.length === 0 && !isLoading && !error ? (
        <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white/70 px-3 py-3 text-sm text-[var(--muted)]">
          No hay coincidencias todavia. Prueba con un nombre mas concreto o usa un atajo como
          Iglesia, Parroquia o Hermandad.
        </p>
      ) : null}

      {results.length > 0 ? (
        <ul className="tour-scrollbar mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
          {results.map((result, index) => (
            <li key={result.id}>
              <button
                className={cn(
                  "w-full rounded-2xl border px-3 py-3 text-left transition",
                  index === 0
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-slate-200 bg-slate-50 hover:border-[var(--accent)] hover:bg-white"
                )}
                disabled={disabled || isAdding}
                onClick={() => void handleAdd(result)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{result.name}</p>
                      {result.sacredMatch ? (
                        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--warm)]">
                          Prioridad cofrade
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm leading-5 text-[var(--muted)]">
                      {result.address || result.displayName}
                    </p>
                    {result.placeType ? (
                      <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                        {result.placeType}
                      </p>
                    ) : null}
                  </div>

                  <span className="shrink-0 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[var(--accent-strong)]">
                    Anadir
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
