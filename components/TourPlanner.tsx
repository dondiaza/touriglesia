"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import HistoryPanel from "@/components/HistoryPanel";
import MapView from "@/components/MapView";
import PointsList from "@/components/PointsList";
import RouteSummary from "@/components/RouteSummary";
import SearchBox from "@/components/SearchBox";
import SuggestionsPanel from "@/components/SuggestionsPanel";
import { clearAuthCookie } from "@/lib/auth";
import { MAX_POINTS } from "@/lib/constants";
import { buildFallbackPointDraft, reverseGeocode, searchResultToPointDraft } from "@/lib/geo";
import {
  buildRouteHistoryEntry,
  generateOptimizedRoute,
  moveRouteStop,
  rebuildRouteFromManualOrder
} from "@/lib/planner";
import type { SearchResult, TravelMode } from "@/lib/types";
import { cn, formatDistance, formatDuration, formatTravelMode } from "@/lib/utils";
import { useTourStore } from "@/store/useTourStore";

type SideTab = "planner" | "suggestions";

const TRAVEL_MODE_OPTIONS: TravelMode[] = ["walking", "driving"];

export default function TourPlanner() {
  const router = useRouter();

  const points = useTourStore((state) => state.points);
  const routeSummary = useTourStore((state) => state.routeSummary);
  const routeHistory = useTourStore((state) => state.routeHistory);
  const travelMode = useTourStore((state) => state.travelMode);
  const mapFocus = useTourStore((state) => state.mapFocus);
  const notice = useTourStore((state) => state.notice);
  const addPoint = useTourStore((state) => state.addPoint);
  const updatePointName = useTourStore((state) => state.updatePointName);
  const removePoint = useTourStore((state) => state.removePoint);
  const clearAll = useTourStore((state) => state.clearAll);
  const clearRoute = useTourStore((state) => state.clearRoute);
  const focusPoint = useTourStore((state) => state.focusPoint);
  const loadDemoPoints = useTourStore((state) => state.loadDemoPoints);
  const applyRoute = useTourStore((state) => state.applyRoute);
  const setNotice = useTourStore((state) => state.setNotice);
  const setTravelMode = useTourStore((state) => state.setTravelMode);
  const saveRouteToHistory = useTourStore((state) => state.saveRouteToHistory);
  const restoreRouteFromHistory = useTourStore((state) => state.restoreRouteFromHistory);
  const removeHistoryEntry = useTourStore((state) => state.removeHistoryEntry);

  const [activeTab, setActiveTab] = useState<SideTab>("planner");
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
      const result = await generateOptimizedRoute(points, travelMode);
      applyRoute(result.routeSummary, result.orderedStops, result.pointsSnapshot);
      saveRouteToHistory(
        buildRouteHistoryEntry(result.pointsSnapshot, result.orderedStops, result.routeSummary)
      );
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

  async function handleMovePoint(pointId: string, direction: "up" | "down") {
    if (!routeSummary) {
      return;
    }

    const nextOrder = moveRouteStop(routeSummary.pointOrder, pointId, direction);

    if (nextOrder.join("|") === routeSummary.pointOrder.join("|")) {
      return;
    }

    setIsGenerating(true);
    setError(null);
    setNotice("Recalculando la ruta con el orden manual...");

    try {
      const result = await rebuildRouteFromManualOrder(points, nextOrder, travelMode);
      applyRoute(result.routeSummary, result.orderedStops, result.pointsSnapshot);
      saveRouteToHistory(
        buildRouteHistoryEntry(result.pointsSnapshot, result.orderedStops, result.routeSummary)
      );
    } catch (routeError) {
      setError(
        routeError instanceof Error
          ? routeError.message
          : "No se pudo aplicar el nuevo orden manual."
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function handleTravelModeChange(nextMode: TravelMode) {
    if (nextMode === travelMode) {
      return;
    }

    setTravelMode(nextMode);
    setError(null);

    if (routeSummary) {
      clearRoute(
        `Modo cambiado a ${formatTravelMode(nextMode)}. Genera de nuevo la ruta para recalcularla.`
      );
      return;
    }

    setNotice(`Modo de ruta seleccionado: ${formatTravelMode(nextMode)}.`);
  }

  function handleRestoreHistory(routeId: string) {
    setActiveTab("planner");
    setError(null);
    restoreRouteFromHistory(routeId);
  }

  function handleLogout() {
    clearAuthCookie();
    router.replace("/login");
    router.refresh();
  }

  function handleLoadDemo() {
    setActiveTab("planner");
    setError(null);
    setNotice(null);
    loadDemoPoints();
  }

  function handleClearAll() {
    setError(null);
    setNotice(null);
    clearAll();
  }

  const isBusy = isGenerating || isResolvingClick;
  const canGenerate = points.length >= 2 && !isBusy;
  const routeGeometry = routeSummary?.geometry ?? [];
  const totals = routeSummary
    ? `${formatTravelMode(routeSummary.travelMode)} · ${formatDistance(routeSummary.totalDistanceMeters)} · ${formatDuration(routeSummary.totalDurationSeconds)}`
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
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">
                Rutas cofrades y eclesiasticas
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Busca puntos, anadelos tocando el mapa y genera recorridos eficientes a pie o en
                coche. El lateral prioriza un uso rapido y claro.
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

        <div className="grid gap-4 lg:grid-cols-[410px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-2 shadow-[var(--shadow)]">
              <div className="grid grid-cols-2 gap-2">
                <button
                  className={cn(
                    "rounded-2xl px-4 py-3 text-sm font-semibold transition",
                    activeTab === "planner"
                      ? "bg-[var(--accent)] text-white"
                      : "bg-white text-slate-700 hover:text-[var(--accent-strong)]"
                  )}
                  onClick={() => setActiveTab("planner")}
                  type="button"
                >
                  Planificador
                </button>
                <button
                  className={cn(
                    "rounded-2xl px-4 py-3 text-sm font-semibold transition",
                    activeTab === "suggestions"
                      ? "bg-[var(--accent)] text-white"
                      : "bg-white text-slate-700 hover:text-[var(--accent-strong)]"
                  )}
                  onClick={() => setActiveTab("suggestions")}
                  type="button"
                >
                  Sugerencias
                </button>
              </div>
            </section>

            {activeTab === "planner" ? (
              <>
                <SearchBox
                  disabled={points.length >= MAX_POINTS || isBusy}
                  onAddResult={handleAddSearchResult}
                />

                <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 shadow-[var(--shadow)]">
                  <div className="mb-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                      Acciones
                    </p>
                    <h2 className="text-xl font-semibold text-slate-900">Modo y controles</h2>
                    <p className="text-sm leading-6 text-[var(--muted)]">
                      El modo por defecto es a pie. Si cambias a coche, la siguiente ruta se
                      recalculara con ese perfil.
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {TRAVEL_MODE_OPTIONS.map((mode) => (
                      <button
                        className={cn(
                          "rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                          travelMode === mode
                            ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                            : "border-slate-200 bg-white text-slate-700 hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                        )}
                        key={mode}
                        onClick={() => handleTravelModeChange(mode)}
                        type="button"
                      >
                        {formatTravelMode(mode)}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
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
                    <p>Toca o haz click en el mapa para anadir puntos desde desktop y mobile.</p>
                    <p>Al cambiar puntos o modo de viaje, la ruta anterior se invalida.</p>
                    {isResolvingClick ? <p>Resolviendo ubicacion del punto tocado...</p> : null}
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
                  canReorder={Boolean(routeSummary)}
                  isReordering={isGenerating}
                  onFocusPoint={focusPoint}
                  onMovePoint={handleMovePoint}
                  onRemovePoint={removePoint}
                  onRenamePoint={updatePointName}
                  orderedPointIds={routeSummary?.pointOrder ?? []}
                  points={points}
                />

                <RouteSummary points={points} routeSummary={routeSummary} />

                <HistoryPanel
                  entries={routeHistory}
                  onRemove={removeHistoryEntry}
                  onRestore={handleRestoreHistory}
                />
              </>
            ) : (
              <SuggestionsPanel />
            )}
          </aside>

          <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3 shadow-[var(--shadow)]">
            <div className="mb-3 flex items-center justify-between px-1 pt-1">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                  Mapa
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">Vista del recorrido</h2>
              </div>
              <p className="text-sm text-[var(--muted)]">Tocar o click para anadir</p>
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
