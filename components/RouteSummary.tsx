"use client";

import type { MapPoint, RouteSummary as RouteSummaryType } from "@/lib/types";
import { formatDistance, formatDuration } from "@/lib/utils";

type RouteSummaryProps = {
  points: MapPoint[];
  routeSummary: RouteSummaryType | null;
};

export default function RouteSummary({ points, routeSummary }: RouteSummaryProps) {
  const pointLookup = new Map(points.map((point) => [point.id, point]));

  return (
    <section className="rounded-[24px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 shadow-[var(--shadow)] backdrop-blur">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          Resumen
        </p>
        <h2 className="mt-2 font-display text-xl font-semibold text-slate-900">
          Recorrido generado
        </h2>
      </div>

      {!routeSummary ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-5 text-sm leading-6 text-[var(--muted)]">
          Cuando tengas al menos 2 puntos, pulsa "Generar recorrido" para calcular el orden de
          visita, los tramos andando y la polilinea final.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/80 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Puntos
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {routeSummary.pointOrder.length}
              </p>
            </div>
            <div className="rounded-2xl bg-white/80 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Distancia total
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {formatDistance(routeSummary.totalDistanceMeters)}
              </p>
            </div>
            <div className="rounded-2xl bg-white/80 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Tiempo total
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {formatDuration(routeSummary.totalDurationSeconds)}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <h3 className="font-display text-lg font-semibold text-slate-900">Tramos</h3>
            <ul className="tour-scrollbar mt-3 max-h-72 space-y-3 overflow-y-auto pr-1">
              {routeSummary.legs.map((leg) => {
                const fromPoint = pointLookup.get(leg.fromPointId);
                const toPoint = pointLookup.get(leg.toPointId);

                return (
                  <li
                    className="rounded-2xl border border-slate-200 bg-white/80 p-3"
                    key={`${leg.fromPointId}-${leg.toPointId}-${leg.fromIndex}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {leg.fromIndex + 1} -&gt; {leg.toIndex + 1}
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {fromPoint?.name || `Punto ${leg.fromIndex + 1}`} ->{" "}
                          {toPoint?.name || `Punto ${leg.toIndex + 1}`}
                        </p>
                      </div>

                      <div className="text-right text-sm text-slate-700">
                        <p>{formatDistance(leg.distanceMeters)}</p>
                        <p>{formatDuration(leg.durationSeconds)}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
