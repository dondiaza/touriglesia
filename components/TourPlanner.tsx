"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import CommunityPanel from "@/components/CommunityPanel";
import HistoryPanel from "@/components/HistoryPanel";
import MapView from "@/components/MapView";
import PointsList from "@/components/PointsList";
import RouteSummary from "@/components/RouteSummary";
import SearchBox from "@/components/SearchBox";
import SuggestionsPanel from "@/components/SuggestionsPanel";
import { clearAuthCookie } from "@/lib/auth";
import { MAX_POINTS, SEVILLE_CENTER } from "@/lib/constants";
import { normalizeUserError } from "@/lib/errors";
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
  rebuildRouteFromManualOrder
} from "@/lib/planner";
import { fetchPersistedTourState, savePersistedTourState } from "@/lib/statePersistence";
import type { MapPoint, PersistedTourState, SearchBias, SearchResult, SuggestedPlace } from "@/lib/types";
import { cn, formatDistance, formatDuration, formatTravelMode, haversineMeters } from "@/lib/utils";
import { useTourStore } from "@/store/useTourStore";

type SideTab = "planner" | "history" | "suggestions";

const SUGGESTION_RADIUS_METERS = 200;

function buildCreatedPointOrder(points: MapPoint[]) {
  return [...points]
    .sort((left, right) => left.createdOrder - right.createdOrder)
    .map((point) => point.id);
}

function normalizePointOrder(candidateOrder: string[], fallbackOrder: string[], points: MapPoint[]) {
  const pointIds = new Set(points.map((point) => point.id));
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const pointId of candidateOrder) {
    if (!pointIds.has(pointId) || seen.has(pointId)) {
      continue;
    }

    seen.add(pointId);
    normalized.push(pointId);
  }

  for (const pointId of fallbackOrder) {
    if (!pointIds.has(pointId) || seen.has(pointId)) {
      continue;
    }

    seen.add(pointId);
    normalized.push(pointId);
  }

  for (const point of points) {
    if (seen.has(point.id)) {
      continue;
    }

    seen.add(point.id);
    normalized.push(point.id);
  }

  return normalized;
}

function isSameOrder(left: string[] | null, right: string[]) {
  if (!left || left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

export default function TourPlanner() {
  const router = useRouter();

  const points = useTourStore((state) => state.points);
  const orderedStops = useTourStore((state) => state.orderedStops);
  const routeSummary = useTourStore((state) => state.routeSummary);
  const routeHistory = useTourStore((state) => state.routeHistory);
  const travelMode = useTourStore((state) => state.travelMode);
  const userLocation = useTourStore((state) => state.userLocation);
  const communityPlaces = useTourStore((state) => state.communityPlaces);
  const activeStopIndex = useTourStore((state) => state.activeStopIndex);
  const nextPointOrder = useTourStore((state) => state.nextPointOrder);
  const mapFocus = useTourStore((state) => state.mapFocus);
  const notice = useTourStore((state) => state.notice);
  const addPoint = useTourStore((state) => state.addPoint);
  const updatePointName = useTourStore((state) => state.updatePointName);
  const movePoint = useTourStore((state) => state.movePoint);
  const removePoint = useTourStore((state) => state.removePoint);
  const clearAll = useTourStore((state) => state.clearAll);
  const clearRoute = useTourStore((state) => state.clearRoute);
  const focusPoint = useTourStore((state) => state.focusPoint);
  const loadDemoPoints = useTourStore((state) => state.loadDemoPoints);
  const applyRoute = useTourStore((state) => state.applyRoute);
  const setNotice = useTourStore((state) => state.setNotice);
  const setUserLocation = useTourStore((state) => state.setUserLocation);
  const setActiveStopIndex = useTourStore((state) => state.setActiveStopIndex);
  const shareCommunityPlace = useTourStore((state) => state.shareCommunityPlace);
  const supportCommunityPlace = useTourStore((state) => state.supportCommunityPlace);
  const saveRouteToHistory = useTourStore((state) => state.saveRouteToHistory);
  const restoreRouteFromHistory = useTourStore((state) => state.restoreRouteFromHistory);
  const removeHistoryEntry = useTourStore((state) => state.removeHistoryEntry);
  const hydratePersistedState = useTourStore((state) => state.hydratePersistedState);

  const [activeTab, setActiveTab] = useState<SideTab>("planner");
  const [enabledSuggestionCategories, setEnabledSuggestionCategories] = useState<
    Record<SuggestedPlace["category"], boolean>
  >({
    iglesia: false,
    cofrade: false,
    cerveceria: false
  });
  const [nearbyInterests, setNearbyInterests] = useState<SearchResult[]>([]);
  const [isLoadingNearbyInterests, setIsLoadingNearbyInterests] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isResolvingClick, setIsResolvingClick] = useState(false);
  const [manualPointOrder, setManualPointOrder] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRemoteStateReady, setIsRemoteStateReady] = useState(false);
  const [remoteLoadNonce, setRemoteLoadNonce] = useState(0);
  const hasSyncErrorNoticeRef = useRef(false);
  const isRemoteSyncDisabledRef = useRef(false);
  const lastSyncedSnapshotRef = useRef<string | null>(null);
  const remoteRevisionRef = useRef(0);
  const reverseLookupRef = useRef<{
    lat: number;
    lon: number;
    at: number;
    pending: boolean;
  } | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const currentLocation = useTourStore.getState().userLocation;
        const now = Date.now();

        setUserLocation({
          lat,
          lon,
          areaLabel: currentLocation?.areaLabel,
          countryCode: currentLocation?.countryCode,
          syncedAt: new Date().toISOString()
        });

        const previousLookup = reverseLookupRef.current;
        const shouldRefreshArea =
          !currentLocation?.areaLabel ||
          !currentLocation?.countryCode ||
          !previousLookup ||
          haversineMeters(previousLookup.lat, previousLookup.lon, lat, lon) > 1200 ||
          now - previousLookup.at > 1000 * 60 * 20;

        if (!shouldRefreshArea || previousLookup?.pending) {
          return;
        }

        reverseLookupRef.current = {
          lat,
          lon,
          at: now,
          pending: true
        };

        void (async () => {
          try {
            const reverseResult = await reverseGeocode(lat, lon);
            const latestLocation = useTourStore.getState().userLocation;
            const areaLabel =
              reverseResult?.metadata?.cityLabel || reverseResult?.displayName?.split(",")[0];
            const countryCode = reverseResult?.metadata?.countryCode;

            if (!latestLocation) {
              return;
            }

            setUserLocation({
              lat: latestLocation.lat,
              lon: latestLocation.lon,
              areaLabel: areaLabel || latestLocation.areaLabel,
              countryCode: countryCode || latestLocation.countryCode,
              syncedAt: new Date().toISOString()
            });
          } catch {
            // Keep current location even if reverse geocoding fails.
          } finally {
            reverseLookupRef.current = {
              lat,
              lon,
              at: Date.now(),
              pending: false
            };
          }
        })();

      },
      () => {
        setNotice("No se pudo sincronizar la ubicacion. Se usara busqueda general.");
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 1000 * 20
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [setNotice, setUserLocation]);

  const persistedSnapshot = useMemo<PersistedTourState>(
    () => ({
      points,
      orderedStops,
      routeSummary,
      routeHistory,
      travelMode,
      userLocation,
      communityPlaces,
      activeStopIndex,
      nextPointOrder
    }),
    [
      activeStopIndex,
      communityPlaces,
      nextPointOrder,
      orderedStops,
      points,
      routeHistory,
      routeSummary,
      travelMode,
      userLocation
    ]
  );

  useEffect(() => {
    let ignore = false;
    let retryTimeoutId: number | null = null;

    async function loadRemoteState() {
      try {
        const remoteSnapshot = await fetchPersistedTourState();

        if (ignore) {
          return;
        }

        remoteRevisionRef.current = Math.max(
          remoteRevisionRef.current,
          remoteSnapshot.revision
        );

        if (remoteSnapshot.data) {
          hydratePersistedState(remoteSnapshot.data);
          lastSyncedSnapshotRef.current = JSON.stringify(remoteSnapshot.data);
        } else {
          lastSyncedSnapshotRef.current = null;
        }

        hasSyncErrorNoticeRef.current = false;
        setIsRemoteStateReady(true);
      } catch (requestError) {
        if (ignore) {
          return;
        }

        const message = normalizeUserError(
          requestError,
          "No se pudo sincronizar el estado persistente.",
          "No se pudo conectar con la base de datos para cargar tus datos."
        );

        if (message.toLowerCase().includes("persistencia remota no configurada")) {
          isRemoteSyncDisabledRef.current = true;
          setIsRemoteStateReady(true);
          return;
        }

        setIsRemoteStateReady(false);
        setNotice(message);
        retryTimeoutId = window.setTimeout(() => {
          setRemoteLoadNonce((current) => current + 1);
        }, 6000);
      }
    }

    void loadRemoteState();

    return () => {
      ignore = true;

      if (retryTimeoutId) {
        window.clearTimeout(retryTimeoutId);
      }
    };
  }, [hydratePersistedState, remoteLoadNonce, setNotice]);

  useEffect(() => {
    if (!isRemoteStateReady || isRemoteSyncDisabledRef.current) {
      return;
    }

    const serializedSnapshot = JSON.stringify(persistedSnapshot);

    if (lastSyncedSnapshotRef.current === serializedSnapshot) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const nextRevision = remoteRevisionRef.current + 1;
          const saveResult = await savePersistedTourState(
            persistedSnapshot,
            undefined,
            nextRevision
          );
          remoteRevisionRef.current = Math.max(
            remoteRevisionRef.current,
            nextRevision,
            saveResult.revision
          );

          if (!saveResult.applied) {
            setRemoteLoadNonce((current) => current + 1);
            return;
          }

          lastSyncedSnapshotRef.current = serializedSnapshot;
          hasSyncErrorNoticeRef.current = false;
        } catch (saveError) {
          const message = normalizeUserError(
            saveError,
            "No se pudo sincronizar cambios en la base de datos.",
            "No se pudo guardar los cambios en la base de datos."
          );

          if (message.toLowerCase().includes("persistencia remota no configurada")) {
            isRemoteSyncDisabledRef.current = true;
            return;
          }

          if (hasSyncErrorNoticeRef.current) {
            return;
          }

          hasSyncErrorNoticeRef.current = true;
          setNotice(message);
        }
      })();
    }, 900);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isRemoteStateReady, persistedSnapshot, setNotice]);

  useEffect(() => {
    if (!routeSummary) {
      setNearbyInterests([]);
    }
  }, [routeSummary]);

  useEffect(() => {
    setManualPointOrder((currentOrder) => {
      if (!currentOrder) {
        return currentOrder;
      }

      const normalizedOrder = normalizePointOrder(
        currentOrder,
        buildCreatedPointOrder(points),
        points
      );

      return isSameOrder(currentOrder, normalizedOrder) ? currentOrder : normalizedOrder;
    });
  }, [points]);

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
      } else if (!reverseResult) {
        setNotice("Punto anadido por coordenadas. No se pudo resolver direccion en este momento.");
      }
    } catch (mapError) {
      const draft = buildMapPointDraftFromReverse(lat, lon, null);
      const outcome = addPoint(draft);

      if (!outcome.ok) {
        const message = normalizeUserError(
          mapError,
          "No se pudo anadir el punto desde el mapa.",
          "No se pudo conectar al geocodificador, y tampoco fue posible anadir el punto."
        );

        setError(message);
      } else {
        setNotice("Punto anadido con fallback por coordenadas. Nominatim no respondio.");
      }
    } finally {
      setIsResolvingClick(false);
    }
  }

  async function handleMovePointOnMap(pointId: string, lat: number, lon: number) {
    setError(null);
    movePoint(pointId, lat, lon);

    try {
      const reverseResult = await reverseGeocode(lat, lon);

      if (!reverseResult) {
        return;
      }

      updatePointName(pointId, reverseResult.name);
    } catch {
      // Keep coordinates updated even if reverse geocode fails.
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
      const shouldRespectManualOrder =
        manualPointOrder !== null && effectivePointOrder.length === points.length;
      const result = shouldRespectManualOrder
        ? await rebuildRouteFromManualOrder(points, effectivePointOrder, "walking")
        : await generateOptimizedRoute(points, "walking");
      applyRoute(result.routeSummary, result.orderedStops, result.pointsSnapshot);

      if (shouldRespectManualOrder) {
        setManualPointOrder(result.routeSummary.pointOrder);
        setNotice("Ruta generada respetando tu orden manual.");
      } else {
        setManualPointOrder(null);
      }
    } catch (routeError) {
      const message = normalizeUserError(
        routeError,
        "No se pudo generar el recorrido.",
        "No se pudo conectar con el servicio de rutas. Intentalo de nuevo."
      );

      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleSaveCurrentRoute() {
    if (!routeSummary || orderedStops.length === 0) {
      setError("Primero genera una ruta para poder guardarla.");
      return;
    }

    const routeNameInput = window.prompt("Nombre de la ruta a guardar:");

    if (routeNameInput === null) {
      return;
    }

    const routeName = routeNameInput.trim();

    if (!routeName) {
      setError("El nombre de ruta es obligatorio.");
      return;
    }

    const userNameInput = window.prompt("Nombre de usuario:");

    if (userNameInput === null) {
      return;
    }

    const userName = userNameInput.trim();

    if (!userName) {
      setError("El nombre de usuario es obligatorio.");
      return;
    }

    const entry = buildRouteHistoryEntry(points, orderedStops, routeSummary, routeName, userName);
    saveRouteToHistory(entry);
    setError(null);
    setNotice(`Ruta guardada: "${routeName}" por ${userName}.`);
    setActiveTab("history");
  }

  function handleReorderPointOrder(nextOrder: string[]) {
    const normalizedOrder = normalizePointOrder(nextOrder, effectivePointOrder, points);

    if (isSameOrder(manualPointOrder, normalizedOrder)) {
      return;
    }

    setManualPointOrder(normalizedOrder);
    setError(null);

    if (routeSummary) {
      clearRoute("Orden manual actualizado. Pulsa Generar recorrido para recalcular.");
      return;
    }

    setNotice("Orden manual actualizado.");
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
        normalizeUserError(
          nearbyError,
          "No se pudieron cargar sugerencias cercanas.",
          "No se pudo conectar para cargar sugerencias cercanas."
        )
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

  function handleRestoreHistory(routeId: string) {
    setActiveTab("planner");
    setError(null);
    setManualPointOrder(null);
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
    setManualPointOrder(null);
    loadDemoPoints();
  }

  function handleClearAll() {
    setError(null);
    setNotice(null);
    setManualPointOrder(null);
    clearAll();
  }

  function handleToggleSuggestionCategory(category: SuggestedPlace["category"]) {
    setEnabledSuggestionCategories((current) => ({
      ...current,
      [category]: !current[category]
    }));
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

  const nearbySuggestions = userLocation
    ? allSuggestions.filter(
        (site) =>
          haversineMeters(userLocation.lat, userLocation.lon, site.lat, site.lon) <=
          SUGGESTION_RADIUS_METERS
      )
    : [];
  const visibleSuggestions = nearbySuggestions.filter(
    (site) => enabledSuggestionCategories[site.category]
  );
  const suggestionCounts = nearbySuggestions.reduce(
    (accumulator, site) => {
      accumulator[site.category] += 1;
      return accumulator;
    },
    {
      iglesia: 0,
      cofrade: 0,
      cerveceria: 0
    } as Record<SuggestedPlace["category"], number>
  );

  const createdPointOrder = buildCreatedPointOrder(points);
  const basePointOrder = routeSummary
    ? normalizePointOrder(routeSummary.pointOrder, createdPointOrder, points)
    : createdPointOrder;
  const effectivePointOrder = manualPointOrder
    ? normalizePointOrder(manualPointOrder, basePointOrder, points)
    : basePointOrder;

  const isBusy = isGenerating || isResolvingClick;
  const canGenerate = points.length >= 2 && !isBusy;
  const routeGeometry = routeSummary?.geometry ?? [];
  const totals = routeSummary
    ? `${formatTravelMode(routeSummary.travelMode)} | ${formatDistance(routeSummary.totalDistanceMeters)} | ${formatDuration(routeSummary.totalDurationSeconds)}`
    : "Sin ruta generada";

  const searchBias: SearchBias = userLocation
    ? {
        lat: userLocation.lat,
        lon: userLocation.lon,
        radiusKm: 12,
        bounded: true,
        countryCode: userLocation.countryCode || "ES"
      }
    : {
        lat: SEVILLE_CENTER[0],
        lon: SEVILLE_CENTER[1],
        radiusKm: 10,
        bounded: true,
        countryCode: "ES"
      };

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
                Busca puntos cofrades en tu zona, con prioridad Sevilla cuando no haya
                geolocalizacion, anadelos con confirmacion, marca llegadas y descubre sitios
                cercanos compartidos por la comunidad.
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
                  Rutas guardadas
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
                  defaultAreaLabel={userLocation?.areaLabel || "Sevilla"}
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

                  <div className="rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--accent-strong)]">
                    Modo fijo: A pie. El calculo siempre prioriza el camino peatonal mas corto.
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
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!routeSummary || isBusy}
                      onClick={handleSaveCurrentRoute}
                      type="button"
                    >
                      Guardar ruta
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
                  canReorder={points.length > 1}
                  isReordering={isGenerating || isResolvingClick}
                  onFocusPoint={focusPoint}
                  onReorderPointOrder={handleReorderPointOrder}
                  onRemovePoint={removePoint}
                  onRenamePoint={updatePointName}
                  onSharePoint={handleSharePoint}
                  orderedPointIds={effectivePointOrder}
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
                  Activa casillas por categoria para mostrar en el mapa todos los puntos cercanos
                  (200 m a la redonda) de tu zona geolocalizada.
                </p>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {(Object.keys(SUGGESTED_CATEGORY_LABELS) as SuggestedPlace["category"][]).map((category) => {
                  const isEnabled = enabledSuggestionCategories[category];
                  const categoryCount = suggestionCounts[category];

                  return (
                    <button
                      className={cn(
                        "rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition",
                        isEnabled
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                          : "border-slate-200 bg-white text-slate-700 hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                      )}
                      key={category}
                      onClick={() => handleToggleSuggestionCategory(category)}
                      type="button"
                    >
                      <span className="block">{SUGGESTED_CATEGORY_LABELS[category]}</span>
                      <span className="mt-1 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                        {categoryCount} en 200m
                      </span>
                    </button>
                  );
                })}
              </div>

              {!userLocation ? (
                <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Activa geolocalizacion para cargar puntos cercanos en un radio de 200 metros.
                </p>
              ) : null}

              {userLocation && nearbySuggestions.length === 0 ? (
                <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white/70 px-3 py-2 text-sm text-[var(--muted)]">
                  No hay sugerencias de estas categorias en 200 metros a la redonda.
                </p>
              ) : null}

              {nearbySuggestions.length > 0 ? (
                <ul className="tour-scrollbar mt-3 max-h-44 space-y-2 overflow-y-auto pr-1">
                  {nearbySuggestions.map((suggestion) => {
                    const meters = userLocation
                      ? Math.round(haversineMeters(userLocation.lat, userLocation.lon, suggestion.lat, suggestion.lon))
                      : null;

                    return (
                      <li className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" key={suggestion.id}>
                        <p className="font-semibold text-slate-900">
                          {suggestion.name} {suggestion.votes ? `(${suggestion.votes})` : ""}
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted)]">{suggestion.address}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
                          {SUGGESTED_CATEGORY_LABELS[suggestion.category]} {meters !== null ? `| ${meters} m` : ""}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </section>

            <CommunityPanel onSupport={supportCommunityPlace} places={communityPlaces} />

            <section className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3 shadow-[var(--shadow)]">
              <div className="mb-3 flex items-center justify-between px-1 pt-1">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                    Mapa
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">Vista del recorrido</h2>
                </div>
                <p className="text-sm text-[var(--muted)]">
                  Toca o haz clic para anadir y arrastra el marcador para mover el punto
                </p>
              </div>
              <MapView
                isResolvingMapPoint={isResolvingClick}
                mapFocus={mapFocus}
                onAddSuggestionToRoute={handleAddSuggestedPlaceToRoute}
                onMapClick={handleMapClick}
                onMovePoint={handleMovePointOnMap}
                onRemovePoint={removePoint}
                points={points}
                routeGeometry={routeGeometry}
                suggestionPoints={visibleSuggestions}
                userLocation={userLocation}
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
