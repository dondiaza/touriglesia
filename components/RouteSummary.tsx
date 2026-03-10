"use client";

import type { MapPoint, RouteSummary as RouteSummaryType, SearchResult } from "@/lib/types";
import { formatDistance, formatDuration, formatTravelMode } from "@/lib/utils";

type RouteSummaryProps = {
  points: MapPoint[];
  routeSummary: RouteSummaryType | null;
  activeStopIndex: number;
  nearbyInterests: SearchResult[];
  isLoadingNearbyInterests: boolean;
  onMarkArrived: () => void;
  onAddNearbyInterest: (result: SearchResult) => void;
};

export default function RouteSummary({
  points,
  routeSummary,
  activeStopIndex,
  nearbyInterests,
  isLoadingNearbyInterests,
  onMarkArrived,
  onAddNearbyInterest
}: RouteSummaryProps) {
  const pointLookup = new Map(points.map((point) => [point.id, point]));

  return (
    <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 shadow-[var(--shadow)]">
      <div className="mb-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          Resumen principal
        </p>
        <h2 className="text-xl font-semibold text-slate-900">Guia del recorrido</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Incluye distancia entre puntos, pasos por calle y seguimiento por llegada.
        </p>
      </div>

      {!routeSummary ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-5 text-sm leading-6 text-[var(--muted)]">
          Genera una ruta para ver la guia completa con tramos y pasos de navegacion.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Puntos
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {routeSummary.pointOrder.length}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Modo
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {formatTravelMode(routeSummary.travelMode)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Distancia total
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {formatDistance(routeSummary.totalDistanceMeters)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Tiempo total
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {formatDuration(routeSummary.totalDurationSeconds)}
              </p>
            </div>
          </div>

          <ArrivalTracker
            activeStopIndex={activeStopIndex}
            onMarkArrived={onMarkArrived}
            pointLookup={pointLookup}
            routeSummary={routeSummary}
          />

          <NearbyInterests
            interests={nearbyInterests}
            isLoading={isLoadingNearbyInterests}
            onAdd={onAddNearbyInterest}
          />

          <p className="mt-4 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            Generada el{" "}
            {new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short" }).format(
              new Date(routeSummary.generatedAt)
            )}
          </p>

          <div className="mt-5">
            <h3 className="text-lg font-semibold text-slate-900">Tramos y pasos</h3>
            <ul className="tour-scrollbar mt-3 max-h-[34rem] space-y-3 overflow-y-auto pr-1">
              {routeSummary.legs.map((leg) => {
                const fromPoint = pointLookup.get(leg.fromPointId);
                const toPoint = pointLookup.get(leg.toPointId);
                const steps = leg.steps ?? [];

                return (
                  <li
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                    key={`${leg.fromPointId}-${leg.toPointId}-${leg.fromIndex}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {leg.fromIndex + 1} -&gt; {leg.toIndex + 1}
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {fromPoint?.name || `Punto ${leg.fromIndex + 1}`} {"->"}{" "}
                          {toPoint?.name || `Punto ${leg.toIndex + 1}`}
                        </p>
                      </div>

                      <div className="text-right text-sm text-slate-700">
                        <p>{formatDistance(leg.distanceMeters)}</p>
                        <p>{formatDuration(leg.durationSeconds)}</p>
                      </div>
                    </div>

                    {steps.length > 0 ? (
                      <ol className="mt-3 space-y-2 border-l-2 border-[var(--accent-soft)] pl-4">
                        {steps.map((step, stepIndex) => (
                          <li className="text-sm text-slate-700" key={`${leg.fromPointId}-${leg.toPointId}-step-${stepIndex}`}>
                            <p>{step.instruction}</p>
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                              {formatDistance(step.distanceMeters)} | {formatDuration(step.durationSeconds)}
                            </p>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="mt-3 text-sm text-[var(--muted)]">
                        No hay pasos detallados para este tramo.
                      </p>
                    )}
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

function ArrivalTracker({
  routeSummary,
  pointLookup,
  activeStopIndex,
  onMarkArrived
}: {
  routeSummary: RouteSummaryType;
  pointLookup: Map<string, MapPoint>;
  activeStopIndex: number;
  onMarkArrived: () => void;
}) {
  const normalizedIndex = Math.max(0, Math.min(activeStopIndex, routeSummary.pointOrder.length - 1));
  const currentPointId = routeSummary.pointOrder[normalizedIndex];
  const nextPointId = routeSummary.pointOrder[normalizedIndex + 1];
  const currentPoint = currentPointId ? pointLookup.get(currentPointId) : undefined;
  const nextPoint = nextPointId ? pointLookup.get(nextPointId) : undefined;
  const hasNextStop = normalizedIndex < routeSummary.pointOrder.length - 1;

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        Seguimiento de llegada
      </p>
      <p className="mt-2 text-sm text-slate-700">
        Actual: {currentPoint?.name || `Punto ${normalizedIndex + 1}`}
      </p>
      <p className="mt-1 text-sm text-slate-700">
        {hasNextStop
          ? `Siguiente destino: ${nextPoint?.name || `Punto ${normalizedIndex + 2}`}`
          : "Ruta completada. Ya no quedan destinos."}
      </p>
      <div className="mt-3">
        <button
          className="rounded-2xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!hasNextStop}
          onClick={onMarkArrived}
          type="button"
        >
          He llegado al destino
        </button>
      </div>
    </div>
  );
}

function NearbyInterests({
  interests,
  isLoading,
  onAdd
}: {
  interests: SearchResult[];
  isLoading: boolean;
  onAdd: (result: SearchResult) => void;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Sitios cercanos sugeridos
        </p>
        {isLoading ? <span className="text-xs text-slate-500">Buscando...</span> : null}
      </div>

      {interests.length === 0 && !isLoading ? (
        <p className="mt-2 text-sm text-[var(--muted)]">
          Marca llegada para recibir sugerencias cercanas al ultimo destino alcanzado.
        </p>
      ) : null}

      {interests.length > 0 ? (
        <ul className="tour-scrollbar mt-2 max-h-52 space-y-2 overflow-y-auto pr-1">
          {interests.map((interest) => (
            <li className="rounded-xl border border-slate-200 bg-white p-2" key={interest.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{interest.name}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{interest.address || interest.displayName}</p>
                </div>
                <button
                  className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                  onClick={() => onAdd(interest)}
                  type="button"
                >
                  Anadir
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
