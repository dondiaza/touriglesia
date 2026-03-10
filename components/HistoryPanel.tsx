"use client";

import type { RouteHistoryEntry } from "@/lib/types";
import { formatDistance, formatDuration, formatTravelMode } from "@/lib/utils";

type HistoryPanelProps = {
  entries: RouteHistoryEntry[];
  onRestore: (id: string) => void;
  onRemove: (id: string) => void;
};

export default function HistoryPanel({ entries, onRestore, onRemove }: HistoryPanelProps) {
  return (
    <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 shadow-[var(--shadow)]">
      <div className="mb-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          Rutas guardadas
        </p>
        <h2 className="text-xl font-semibold text-slate-900">Rutas guardadas</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Guarda manualmente tus rutas con nombre y usuario para recuperarlas cuando lo necesites.
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-5 text-sm leading-6 text-[var(--muted)]">
          Aun no hay rutas guardadas. Genera una ruta y pulsa "Guardar ruta".
        </p>
      ) : (
        <ul className="tour-scrollbar max-h-80 space-y-3 overflow-y-auto pr-1">
          {entries.map((entry) => (
            <li className="rounded-2xl border border-slate-200 bg-slate-50 p-3" key={entry.id}>
              <p className="font-semibold text-slate-900">{entry.routeName || entry.label}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Usuario: <span className="font-medium text-slate-700">{entry.savedBy || "Sin usuario"}</span>
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short" }).format(
                  new Date(entry.createdAt)
                )}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                <span>{formatTravelMode(entry.travelMode || "walking")}</span>
                <span>{entry.routeSummary.pointOrder.length} puntos</span>
                <span>{formatDistance(entry.routeSummary.totalDistanceMeters)}</span>
                <span>{formatDuration(entry.routeSummary.totalDurationSeconds)}</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                  onClick={() => onRestore(entry.id)}
                  type="button"
                >
                  Cargar
                </button>
                <button
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                  onClick={() => onRemove(entry.id)}
                  type="button"
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
