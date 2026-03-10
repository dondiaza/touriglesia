"use client";

import type { MapPoint } from "@/lib/types";
import { formatCoordinates, formatDistance, formatDuration, sortPointsForDisplay } from "@/lib/utils";

type PointsListProps = {
  points: MapPoint[];
  onFocusPoint: (id: string) => void;
  onRemovePoint: (id: string) => void;
  onRenamePoint: (id: string, name: string) => void;
};

export default function PointsList({
  points,
  onFocusPoint,
  onRemovePoint,
  onRenamePoint
}: PointsListProps) {
  const sortedPoints = sortPointsForDisplay(points);

  return (
    <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 shadow-[var(--shadow)]">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          Puntos
        </p>
        <h2 className="mt-2 font-display text-xl font-semibold text-slate-900">
          Paradas
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Edita nombres, centra ubicaciones y elimina puntos desde esta lista.
        </p>
      </div>

      {sortedPoints.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-5 text-sm leading-6 text-[var(--muted)]">
          Todavia no hay puntos. Busca una ubicacion o haz click en el mapa para anadirla.
        </p>
      ) : (
        <ul className="tour-scrollbar max-h-[34rem] space-y-3 overflow-y-auto pr-1">
          {sortedPoints.map((point) => {
            const badge = typeof point.routeIndex === "number" ? point.routeIndex + 1 : point.createdOrder;

            return (
              <li className="rounded-2xl border border-slate-200 bg-slate-50 p-3" key={point.id}>
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] font-semibold text-[var(--accent-strong)]">
                    {badge}
                  </div>

                  <div className="min-w-0 flex-1">
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-900 outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                      onChange={(event) => onRenamePoint(point.id, event.target.value)}
                      placeholder={`Punto ${badge}`}
                      value={point.name}
                    />

                    <div className="mt-3 space-y-1 text-sm leading-5 text-[var(--muted)]">
                      {point.address ? <p>{point.address}</p> : null}
                      <p>Coords: {formatCoordinates(point.lat, point.lon)}</p>
                      {point.placeType ? <p>Tipo: {point.placeType}</p> : null}
                      {typeof point.routeIndex === "number" && point.routeIndex > 0 ? (
                        <p>
                          Desde el punto anterior: {formatDistance(point.distanceFromPrevious)} ·{" "}
                          {formatDuration(point.durationFromPrevious)}
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                        onClick={() => onFocusPoint(point.id)}
                        type="button"
                      >
                        Centrar
                      </button>
                      <button
                        className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                        onClick={() => onRemovePoint(point.id)}
                        type="button"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
