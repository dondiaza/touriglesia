"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import MapView from "@/components/MapView";
import PointsList from "@/components/PointsList";
import RouteSummary from "@/components/RouteSummary";
import SearchBox from "@/components/SearchBox";
import { clearAuthCookie } from "@/lib/auth";
import { MAX_POINTS } from "@/lib/constants";
import { buildFallbackPointDraft, reverseGeocode, searchResultToPointDraft } from "@/lib/geo";
import {
  buildRouteSummary,
  buildWalkingMatrix,
  computeLegSummaries,
  fetchFullWalkingRoute
} from "@/lib/route";
import type { SearchResult } from "@/lib/types";
import { buildOrderedStops, nearestNeighborRoute, twoOptImprove } from "@/lib/tsp";
import { buildPointIndexLookup, formatDistance, formatDuration } from "@/lib/utils";
import { useTourStore } from "@/store/useTourStore";

export default function TourPlanner() {
  const router = useRouter();

  const points = useTourStore((state) => state.points);
  const routeSummary = useTourStore((state) => state.routeSummary);
  const mapFocus = useTourStore((state) => state.mapFocus);
  const notice = useTourStore((state) => state.notice);
  const addPoint = useTourStore((state) => state.addPoint);
  const updatePointName = useTourStore((state) => state.updatePointName);
  const removePoint = useTourStore((state) => state.removePoint);
  const clearAll = useTourStore((state) => state.clearAll);
  const focusPoint = useTourStore((state) => state.focusPoint);
  const loadDemoPoints = useTourStore((state) => state.loadDemoPoints);
  const applyRoute = useTourStore((state) => state.applyRoute);
  const setNotice = useTourStore((state) => state.setNotice);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isResolvingClick, setIsResolvingClick] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAddSearchResult(result: SearchResult) {
    setError(null);
    const outcome = addPoint(searchResultToPointDraft(result, "search"));

    if (!outcome.ok) {
      setError(outcome.error || "No se pudo anadir el punto.");
    }
  }

  async function handleMapClick(lat: number, lon: number) {
    if (points.length >= MAX_POINTS) {
      setError(`Has alcanzado el maximo de ${MAX_POINTS} puntos.`);
      return;
    }

    setError(null);
    setIsResolvingClick(true);

    try {
      const reverseResult = await reverseGeocode(lat, lon);
      const draft = reverseResult
        ? searchResultToPointDraft(reverseResult, "map")
        : buildFallbackPointDraft(lat, lon);
      const outcome = addPoint(draft);

      if (!outcome.ok) {
        setError(outcome.error || "No se pudo anadir el punto desde el mapa.");
      }
    } catch (mapError) {
      const message =
        mapError instanceof Error
          ? mapError.message
          : "No se pudo resolver la ubicacion del click.";

      setError(message);
    } finally {
      setIsResolvingClick(false);
    }
  }

  async function handleGenerateRoute() {
    if (points.length < 2) {
      return;
    }

    setIsGenerating(true);
    setError(null);
    setNotice(null);

    try {
      const matrix = await buildWalkingMatrix(points);
      const initialOrder = nearestNeighborRoute(matrix, 0);
      const improvedOrder = twoOptImprove(initialOrder, matrix);
      const orderedPoints = improvedOrder.map((index) => points[index]);
      const orderedStops = buildOrderedStops(improvedOrder, points, matrix);
      const routeResult = await fetchFullWalkingRoute(orderedPoints);
      const pointIndexLookup = buildPointIndexLookup(points);
      const legs = computeLegSummaries(orderedPoints, routeResult.legs, matrix, pointIndexLookup);
      const summary = buildRouteSummary(orderedPoints, routeResult.geometry, legs);
      const preciseStops = orderedStops.map((stop, index) => {
        if (index === 0) {
          return stop;
        }

        const leg = legs[index - 1];

        return {
          ...stop,
          distanceFromPrevious: leg.distanceMeters,
          durationFromPrevious: leg.durationSeconds
        };
      });

      applyRoute(summary, preciseStops);
    } catch (routeError) {
      const message =
        routeError instanceof Error
          ? routeError.message
          : "No se pudo generar el recorrido.";

      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleLogout() {
    clearAuthCookie();
    router.replace("/login");
    router.refresh();
  }

  function handleLoadDemo() {
    setError(null);
    setNotice(null);
    loadDemoPoints();
  }

  function handleClearAll() {
    setError(null);
    setNotice(null);
    clearAll();
  }

  const canGenerate = points.length >= 2 && !isGenerating;
  const routeGeometry = routeSummary?.geometry ?? [];
  const totals = routeSummary
    ? `${formatDistance(routeSummary.totalDistanceMeters)} · ${formatDuration(routeSummary.totalDurationSeconds)}`
    : "Sin ruta generada";

  return (
    <main className="px-4 py-4 lg:px-6 lg:py-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-4 rounded-3xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5 shadow-[var(--shadow)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                TourIglesia
              </p>
              <h1 className="mt-2 font-display text-3xl font-semibold text-slate-900">
                Planificador de recorrido andando
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Anade hasta 25 puntos, genera un orden eficiente para ir a pie y revisa el mapa
                junto al detalle completo de cada tramo.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                  Puntos
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {points.length}/{MAX_POINTS}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                  Estado
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900">{totals}</p>
              </div>
              <button
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                onClick={handleLogout}
                type="button"
              >
                Cerrar sesion
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[390px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <SearchBox disabled={points.length >= MAX_POINTS} onAddResult={handleAddSearchResult} />

            <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 shadow-[var(--shadow)]">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                  Acciones
                </p>
                <h2 className="mt-2 font-display text-xl font-semibold text-slate-900">
                  Acciones rapidas
                </h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Genera la ruta, carga el ejemplo demo o limpia el recorrido actual.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!canGenerate}
                  onClick={() => void handleGenerateRoute()}
                  type="button"
                >
                  {isGenerating ? "Generando..." : "Generar recorrido"}
                </button>
                <button
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                  onClick={handleLoadDemo}
                  type="button"
                >
                  Usar ejemplo demo Sevilla
                </button>
                <button
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[var(--warm)] hover:text-[var(--warm)]"
                  onClick={handleClearAll}
                  type="button"
                >
                  Limpiar
                </button>
              </div>

              <div className="mt-4 space-y-2 text-sm text-[var(--muted)]">
                <p>Haz click en el mapa para anadir un punto manual con reverse geocoding si existe.</p>
                <p>La ruta se desactiva automaticamente cuando cambian los puntos.</p>
                {isResolvingClick ? <p>Resolviendo ubicacion del click...</p> : null}
              </div>

              {notice ? (
                <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {notice}
                </p>
              ) : null}

              {error ? (
                <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </p>
              ) : null}
            </section>

            <PointsList
              onFocusPoint={focusPoint}
              onRemovePoint={removePoint}
              onRenamePoint={updatePointName}
              points={points}
            />

            <RouteSummary points={points} routeSummary={routeSummary} />
          </aside>

          <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3 shadow-[var(--shadow)]">
            <div className="mb-3 flex items-center justify-between px-1 pt-1">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                  Mapa
                </p>
                <h2 className="mt-1 font-display text-lg font-semibold text-slate-900">
                  Vista del recorrido
                </h2>
              </div>
              <p className="text-sm text-[var(--muted)]">Click para anadir puntos</p>
            </div>
            <MapView
              mapFocus={mapFocus}
              onMapClick={handleMapClick}
              points={points}
              routeGeometry={routeGeometry}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
