"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import CommunityPanel from "@/components/CommunityPanel";
import HistoryPanel from "@/components/HistoryPanel";
import MapView from "@/components/MapView";
import PointsList from "@/components/PointsList";
import RouteSummary from "@/components/RouteSummary";
import SearchBox from "@/components/SearchBox";
import SuggestionsPanel from "@/components/SuggestionsPanel";
import { clearAuthCookie } from "@/lib/auth";
import { MAX_POINTS } from "@/lib/constants";
import {
  buildMapPointDraftFromReverse,
  fetchNearbyInterest,
  reverseGeocode,
  searchResultToPointDraft
} from "@/lib/geo";
import { KEY_SITE_SUGGESTIONS, SUGGESTED_CATEGORY_LABELS } from "@/lib/keySites";
import {
  buildRouteHistoryEntry,
  generateOptimizedRoute,
  moveRouteStop,
  rebuildRouteFromManualOrder
} from "@/lib/planner";
import type { SearchBias, SearchResult, SuggestedPlace, TravelMode } from "@/lib/types";
import { cn, formatDistance, formatDuration, formatTravelMode } from "@/lib/utils";
import { useTourStore } from "@/store/useTourStore";

type SideTab = "planner" | "history" | "suggestions";

const TRAVEL_MODE_OPTIONS: TravelMode[] = ["walking", "driving"];

export default function TourPlanner() {
  const router = useRouter();

  const points = useTourStore((state) => state.points);
  const routeSummary = useTourStore((state) => state.routeSummary);
  const routeHistory = useTourStore((state) => state.routeHistory);
  const travelMode = useTourStore((state) => state.travelMode);
  const userLocation = useTourStore((state) => state.userLocation);
  const communityPlaces = useTourStore((state) => state.communityPlaces);
  const activeStopIndex = useTourStore((state) => state.activeStopIndex);
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
  const setUserLocation = useTourStore((state) => state.setUserLocation);
  const setActiveStopIndex = useTourStore((state) => state.setActiveStopIndex);
  const shareCommunityPlace = useTourStore((state) => state.shareCommunityPlace);
  const supportCommunityPlace = useTourStore((state) => state.supportCommunityPlace);
  const saveRouteToHistory = useTourStore((state) => state.saveRouteToHistory);
  const restoreRouteFromHistory = useTourStore((state) => state.restoreRouteFromHistory);
  const removeHistoryEntry = useTourStore((state) => state.removeHistoryEntry);

  const [activeTab, setActiveTab] = useState<SideTab>("planner");
  const [activeSuggestionCategory, setActiveSuggestionCategory] = useState<SuggestedPlace["category"] | "all">("all");
  const [visibleSuggestionIds, setVisibleSuggestionIds] = useState<string[]>([]);
  const [nearbyInterests, setNearbyInterests] = useState<SearchResult[]>([]);
  const [isLoadingNearbyInterests, setIsLoadingNearbyInterests] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isResolvingClick, setIsResolvingClick] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSyncedLocation, setHasSyncedLocation] = useState(false);

  useEffect(() => {
    if (hasSyncedLocation || typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }

    setHasSyncedLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        let areaLabel: string | undefined;
        let countryCode: string | undefined;

        try {
          const reverseResult = await reverseGeocode(lat, lon);
          areaLabel =
            reverseResult?.metadata?.cityLabel ||
            reverseResult?.displayName?.split(",")[0];
          countryCode = reverseResult?.metadata?.countryCode;
        } catch {
          areaLabel = undefined;
          countryCode = undefined;
        }

        setUserLocation({
          lat,
          lon,
          areaLabel,
          countryCode,
          syncedAt: new Date().toISOString()
        });
      },
      () => {
        setNotice("No se pudo sincronizar la ubicacion. Se usara busqueda general.");
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 1000 * 60 * 15
      }
    );
  }, [hasSyncedLocation, setNotice, setUserLocation]);

  useEffect(() => {
    if (!routeSummary) {
      setNearbyInterests([]);
    }
  }, [routeSummary]);

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
      const draft = buildMapPointDraftFromReverse(lat, lon, reverseResult);
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

  async function handleMarkArrived() {
    if (!routeSummary) {
      return;
    }

    const nextIndex = Math.min(activeStopIndex + 1, routeSummary.pointOrder.length - 1);

    if (nextIndex === activeStopIndex) {
      return;
    }

    setActiveStopIndex(nextIndex);
    const destinationPointId = routeSummary.pointOrder[nextIndex];
    const destinationPoint = points.find((point) => point.id === destinationPointId);

    if (!destinationPoint) {
      return;
    }

    setIsLoadingNearbyInterests(true);

    try {
      const nearbyResults = await fetchNearbyInterest(destinationPoint.lat, destinationPoint.lon, 6);
      const filtered = nearbyResults.filter(
        (result) =>
          !points.some(
            (point) =>
              Math.abs(point.lat - result.lat) < 0.00005 &&
              Math.abs(point.lon - result.lon) < 0.00005
          )
      );
      setNearbyInterests(filtered);
      setNotice("Llegada registrada. Tienes nuevas sugerencias cercanas.");
    } catch (nearbyError) {
      setError(
        nearbyError instanceof Error
          ? nearbyError.message
          : "No se pudieron cargar sugerencias cercanas."
      );
    } finally {
      setIsLoadingNearbyInterests(false);
    }
  }

  async function handleAddNearbyInterest(result: SearchResult) {
    const outcome = addPoint(searchResultToPointDraft(result, "search"));

    if (!outcome.ok) {
      setError(outcome.error || "No se pudo anadir el sitio cercano.");
      return;
    }

    setNearbyInterests((current) => current.filter((item) => item.id !== result.id));
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

  function handleToggleSuggestionVisibility(suggestionId: string) {
    setVisibleSuggestionIds((current) => {
      if (current.includes(suggestionId)) {
        return current.filter((id) => id !== suggestionId);
      }

      return [...current, suggestionId];
    });
  }

  async function handleAddSuggestedPlaceToRoute(suggestion: SuggestedPlace) {
    if (points.length >= MAX_POINTS) {
      setError(`Has alcanzado el maximo de ${MAX_POINTS} puntos.`);
      return;
    }

    const alreadyAdded = points.some(
      (point) =>
        Math.abs(point.lat - suggestion.lat) < 0.00005 &&
        Math.abs(point.lon - suggestion.lon) < 0.00005
    );

    if (alreadyAdded) {
      setNotice("Ese sitio ya esta incluido en la ruta.");
      return;
    }

    const outcome = addPoint({
      id: `suggested-${suggestion.id}-${Date.now()}`,
      name: suggestion.name,
      lat: suggestion.lat,
      lon: suggestion.lon,
      address: suggestion.address,
      displayName: suggestion.name,
      placeType: suggestion.category,
      metadata: suggestion.description ? { description: suggestion.description } : undefined,
      source: "demo"
    });

    if (!outcome.ok) {
      setError(outcome.error || "No se pudo anadir la sugerencia a la ruta.");
    }
  }

  function handleSharePoint(pointId: string) {
    const targetPoint = points.find((point) => point.id === pointId);

    if (!targetPoint) {
      return;
    }

    shareCommunityPlace({
      name: targetPoint.name,
      lat: targetPoint.lat,
      lon: targetPoint.lon,
      address: targetPoint.address,
      description: targetPoint.displayName,
      category: "cofrade"
    });
  }

  const communitySuggestions: SuggestedPlace[] = communityPlaces.map((place) => ({
    id: place.id,
    name: place.name,
    category: place.category,
    lat: place.lat,
    lon: place.lon,
    address: place.address,
    description: place.description,
    votes: place.votes,
    isCommunity: true
  }));

  const allSuggestions = [...KEY_SITE_SUGGESTIONS, ...communitySuggestions].sort(
    (left, right) => (right.votes ?? 0) - (left.votes ?? 0)
  );

  const filteredSuggestions = allSuggestions.filter((site) => {
    if (activeSuggestionCategory === "all") {
      return true;
    }

    return site.category === activeSuggestionCategory;
  });

  const visibleSuggestions = allSuggestions.filter((site) => visibleSuggestionIds.includes(site.id));

  const isBusy = isGenerating || isResolvingClick;
  const canGenerate = points.length >= 2 && !isBusy;
  const routeGeometry = routeSummary?.geometry ?? [];
  const totals = routeSummary
    ? `${formatTravelMode(routeSummary.travelMode)} | ${formatDistance(routeSummary.totalDistanceMeters)} | ${formatDuration(routeSummary.totalDurationSeconds)}`
    : "Sin ruta generada";

  const searchBias: SearchBias | null = userLocation
    ? {
        lat: userLocation.lat,
        lon: userLocation.lon,
        radiusKm: 12,
        bounded: true,
        countryCode: userLocation.countryCode
      }
    : null;

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
                Busca puntos en tu zona, anadelos con confirmacion, marca llegadas y descubre
                sitios cercanos y compartidos por la comunidad.
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
                  Zona activa
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {userLocation?.areaLabel || "Sin sincronizar"}
                </p>
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
              <div className="grid grid-cols-3 gap-2">
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
                    activeTab === "history"
                      ? "bg-[var(--accent)] text-white"
                      : "bg-white text-slate-700 hover:text-[var(--accent-strong)]"
                  )}
                  onClick={() => setActiveTab("history")}
                  type="button"
                >
                  Historico
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
                  defaultAreaLabel={userLocation?.areaLabel}
                  disabled={points.length >= MAX_POINTS || isBusy}
                  onAddResult={handleAddSearchResult}
                  searchBias={searchBias}
                />

                <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 shadow-[var(--shadow)]">
                  <div className="mb-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                      Acciones
                    </p>
                    <h2 className="text-xl font-semibold text-slate-900">Modo y controles</h2>
                    <p className="text-sm leading-6 text-[var(--muted)]">
                      Estado actual: {totals}
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
                    <p>
                      Al tocar/click en el mapa no se anade al instante: primero pide confirmacion.
                    </p>
                    {isResolvingClick ? <p>Resolviendo ubicacion del punto confirmado...</p> : null}
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
                  onSharePoint={handleSharePoint}
                  orderedPointIds={routeSummary?.pointOrder ?? []}
                  points={points}
                />
              </>
            ) : null}

            {activeTab === "history" ? (
              <HistoryPanel
                entries={routeHistory}
                onRemove={removeHistoryEntry}
                onRestore={handleRestoreHistory}
              />
            ) : null}

            {activeTab === "suggestions" ? <SuggestionsPanel /> : null}
          </aside>

          <section className="space-y-4">
            <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 shadow-[var(--shadow)]">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                  Sugerencias sobre mapa
                </p>
                <h2 className="text-lg font-semibold text-slate-900">
                  Iglesias, interes cofrade y cervecerias
                </h2>
                <p className="text-sm leading-6 text-[var(--muted)]">
                  Marca una sugerencia para pintarla en el mapa. Puedes seleccionarla y anadirla a
                  la ruta desde su ficha.
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className={cn(
                    "rounded-full border px-3 py-2 text-sm font-semibold transition",
                    activeSuggestionCategory === "all"
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                      : "border-slate-200 bg-white text-slate-700 hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                  )}
                  onClick={() => setActiveSuggestionCategory("all")}
                  type="button"
                >
                  Todas
                </button>
                {(Object.keys(SUGGESTED_CATEGORY_LABELS) as SuggestedPlace["category"][]).map((category) => (
                  <button
                    className={cn(
                      "rounded-full border px-3 py-2 text-sm font-semibold transition",
                      activeSuggestionCategory === category
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                        : "border-slate-200 bg-white text-slate-700 hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                    )}
                    key={category}
                    onClick={() => setActiveSuggestionCategory(category)}
                    type="button"
                  >
                    {SUGGESTED_CATEGORY_LABELS[category]}
                  </button>
                ))}
              </div>

              <ul className="tour-scrollbar mt-3 max-h-44 space-y-2 overflow-y-auto pr-1">
                {filteredSuggestions.map((suggestion) => {
                  const isVisible = visibleSuggestionIds.includes(suggestion.id);
                  return (
                    <li className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" key={suggestion.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">
                            {suggestion.name} {suggestion.votes ? `(${suggestion.votes})` : ""}
                          </p>
                          <p className="mt-1 text-sm text-[var(--muted)]">{suggestion.address}</p>
                        </div>
                        <button
                          className={cn(
                            "shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold transition",
                            isVisible
                              ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                              : "border-slate-200 bg-white text-slate-700 hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                          )}
                          onClick={() => handleToggleSuggestionVisibility(suggestion.id)}
                          type="button"
                        >
                          {isVisible ? "Ocultar" : "Mostrar"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <CommunityPanel
              onShowOnMap={handleToggleSuggestionVisibility}
              onSupport={supportCommunityPlace}
              places={communityPlaces}
              visibleIds={visibleSuggestionIds}
            />

            <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3 shadow-[var(--shadow)]">
              <div className="mb-3 flex items-center justify-between px-1 pt-1">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                    Mapa
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">Vista del recorrido</h2>
                </div>
                <p className="text-sm text-[var(--muted)]">Tocar o click para seleccionar punto</p>
              </div>
              <MapView
                isResolvingMapPoint={isResolvingClick}
                mapFocus={mapFocus}
                onAddSuggestionToRoute={handleAddSuggestedPlaceToRoute}
                onMapClick={handleMapClick}
                onRemovePoint={removePoint}
                points={points}
                routeGeometry={routeGeometry}
                suggestionPoints={visibleSuggestions}
              />
            </section>

            <RouteSummary
              activeStopIndex={activeStopIndex}
              isLoadingNearbyInterests={isLoadingNearbyInterests}
              nearbyInterests={nearbyInterests}
              onAddNearbyInterest={handleAddNearbyInterest}
              onMarkArrived={handleMarkArrived}
              points={points}
              routeSummary={routeSummary}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
