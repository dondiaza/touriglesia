"use client";

import { useEffect, useMemo, useState } from "react";
import { divIcon, type Marker as LeafletMarker } from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents
} from "react-leaflet";

import { DEFAULT_MAP_ZOOM, SEVILLE_CENTER } from "@/lib/constants";
import type { MapFocus, MapPoint, SuggestedPlace, UserLocation } from "@/lib/types";
import {
  formatCoordinates,
  formatDistance,
  formatDuration,
  getPointDisplayName
} from "@/lib/utils";

type MapViewClientProps = {
  points: MapPoint[];
  mapFocus: MapFocus | null;
  routeGeometry: Array<[number, number]>;
  isResolvingMapPoint?: boolean;
  suggestionPoints?: SuggestedPlace[];
  userLocation?: UserLocation | null;
  onAddSuggestionToRoute?: (suggestedPlace: SuggestedPlace) => void;
  onRemovePoint?: (pointId: string) => void;
  onMovePoint?: (pointId: string, lat: number, lon: number) => void;
  onMapClick: (lat: number, lon: number) => void;
};

type PendingMapPoint = {
  lat: number;
  lon: number;
};

export default function MapViewClient({
  points,
  mapFocus,
  routeGeometry,
  isResolvingMapPoint = false,
  suggestionPoints = [],
  userLocation = null,
  onAddSuggestionToRoute,
  onRemovePoint,
  onMovePoint,
  onMapClick
}: MapViewClientProps) {
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);
  const [pendingMapPoint, setPendingMapPoint] = useState<PendingMapPoint | null>(null);

  const selectedPoint = useMemo(
    () => points.find((point) => point.id === selectedPointId) ?? null,
    [points, selectedPointId]
  );

  const selectedSuggestion = useMemo(
    () => suggestionPoints.find((suggestion) => suggestion.id === selectedSuggestionId) ?? null,
    [suggestionPoints, selectedSuggestionId]
  );

  useEffect(() => {
    if (selectedPointId && !points.some((point) => point.id === selectedPointId)) {
      setSelectedPointId(null);
    }
  }, [points, selectedPointId]);

  useEffect(() => {
    if (selectedSuggestionId && !suggestionPoints.some((item) => item.id === selectedSuggestionId)) {
      setSelectedSuggestionId(null);
    }
  }, [selectedSuggestionId, suggestionPoints]);

  function handleMapSelect(lat: number, lon: number) {
    setSelectedPointId(null);
    setSelectedSuggestionId(null);
    setPendingMapPoint({ lat, lon });
  }

  function confirmAddPoint() {
    if (!pendingMapPoint) {
      return;
    }

    onMapClick(pendingMapPoint.lat, pendingMapPoint.lon);
    setPendingMapPoint(null);
  }

  function handleDeleteSelectedPoint() {
    if (!selectedPoint || !onRemovePoint) {
      return;
    }

    const shouldDelete = window.confirm(`Eliminar "${getPointDisplayName(selectedPoint)}"?`);

    if (!shouldDelete) {
      return;
    }

    onRemovePoint(selectedPoint.id);
    setSelectedPointId(null);
  }

  function handleAddSuggestion() {
    if (!selectedSuggestion || !onAddSuggestionToRoute) {
      return;
    }

    onAddSuggestionToRoute(selectedSuggestion);
  }

  const suggestionAlreadyInRoute = selectedSuggestion
    ? points.some(
        (point) =>
          Math.abs(point.lat - selectedSuggestion.lat) < 0.00005 &&
          Math.abs(point.lon - selectedSuggestion.lon) < 0.00005
      )
    : false;

  return (
    <div className="relative h-[50vh] min-h-[420px] overflow-hidden rounded-3xl border border-[var(--panel-border)] shadow-[var(--shadow)] lg:h-[calc(100vh-8rem)]">
      <MapContainer center={SEVILLE_CENTER} className="h-full w-full" zoom={DEFAULT_MAP_ZOOM}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapSizeInvalidator />
        <MapClickHandler onMapClick={handleMapSelect} />
        <AutoBounds points={points} routeGeometry={routeGeometry} userLocation={userLocation} />
        <FocusController mapFocus={mapFocus} />

        {routeGeometry.length > 1 ? (
          <Polyline
            pathOptions={{
              color: "#0f766e",
              opacity: 0.9,
              weight: 5
            }}
            positions={routeGeometry}
          />
        ) : null}

        {points.map((point) => (
          <Marker
            draggable={Boolean(onMovePoint)}
            eventHandlers={{
              click() {
                setSelectedPointId(point.id);
                setSelectedSuggestionId(null);
                setPendingMapPoint(null);
              },
              dragend(event) {
                if (!onMovePoint) {
                  return;
                }

                const marker = event.target as LeafletMarker;
                const { lat, lng } = marker.getLatLng();
                onMovePoint(point.id, lat, lng);
              }
            }}
            icon={createPointIcon(point)}
            key={point.id}
            position={[point.lat, point.lon]}
          />
        ))}

        {suggestionPoints.map((suggestion) => (
          <Marker
            eventHandlers={{
              click() {
                setSelectedSuggestionId(suggestion.id);
                setSelectedPointId(null);
                setPendingMapPoint(null);
              }
            }}
            icon={createSuggestionIcon(suggestion)}
            key={suggestion.id}
            position={[suggestion.lat, suggestion.lon]}
          />
        ))}

        {userLocation ? (
          <CircleMarker
            center={[userLocation.lat, userLocation.lon]}
            pathOptions={{
              color: "#1d4ed8",
              fillColor: "#3b82f6",
              fillOpacity: 0.85,
              opacity: 1,
              weight: 2
            }}
            radius={8}
          />
        ) : null}
      </MapContainer>

      <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-[500] flex justify-center sm:justify-start">
        <div className="pointer-events-auto rounded-2xl border border-white/80 bg-white/92 px-4 py-3 text-sm text-slate-700 shadow-lg backdrop-blur">
          Toca o haz clic en el mapa para seleccionar una ubicacion. Se pedira confirmacion antes
          de anadir el punto.
        </div>
      </div>

      {pendingMapPoint ? (
        <div className="pointer-events-none absolute bottom-20 left-4 right-4 z-[520] flex justify-center sm:justify-start">
          <div className="pointer-events-auto w-full max-w-md rounded-3xl border border-white/80 bg-white/95 p-4 shadow-xl backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              Confirmar punto
            </p>
            <p className="mt-2 text-sm text-slate-700">
              Coordenadas seleccionadas: {formatCoordinates(pendingMapPoint.lat, pendingMapPoint.lon)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="rounded-2xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isResolvingMapPoint}
                onClick={confirmAddPoint}
                type="button"
              >
                {isResolvingMapPoint ? "Anadiendo..." : "Anadir punto"}
              </button>
              <button
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                onClick={() => setPendingMapPoint(null)}
                type="button"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedPoint ? (
        <div className="pointer-events-none absolute left-4 top-4 z-[500] max-w-sm">
          <div className="pointer-events-auto rounded-3xl border border-white/80 bg-white/95 p-4 shadow-xl backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                  Punto de ruta
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  {getPointDisplayName(selectedPoint)}
                </h3>
              </div>
              <button
                className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                onClick={() => setSelectedPointId(null)}
                type="button"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              {selectedPoint.address ? <p>{selectedPoint.address}</p> : null}
              <p>Coordenadas: {formatCoordinates(selectedPoint.lat, selectedPoint.lon)}</p>
              {selectedPoint.placeType ? <p>Tipo: {selectedPoint.placeType}</p> : null}
              <p>Origen: {formatPointSourceLabel(selectedPoint.source)}</p>
              {typeof selectedPoint.routeIndex === "number" ? (
                <p>Orden actual: {selectedPoint.routeIndex + 1}</p>
              ) : null}
              {typeof selectedPoint.routeIndex === "number" && selectedPoint.routeIndex > 0 ? (
                <p>
                  Tramo anterior: {formatDistance(selectedPoint.distanceFromPrevious)} ·{" "}
                  {formatDuration(selectedPoint.durationFromPrevious)}
                </p>
              ) : null}
            </div>

            {onRemovePoint ? (
              <div className="mt-3">
                <button
                  className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                  onClick={handleDeleteSelectedPoint}
                  type="button"
                >
                  Eliminar punto
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {selectedSuggestion ? (
        <div className="pointer-events-none absolute right-4 top-4 z-[500] max-w-sm">
          <div className="pointer-events-auto rounded-3xl border border-white/80 bg-white/95 p-4 shadow-xl backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--warm)]">
                  Sugerencia
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">{selectedSuggestion.name}</h3>
              </div>
              <button
                className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                onClick={() => setSelectedSuggestionId(null)}
                type="button"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              {selectedSuggestion.address ? <p>{selectedSuggestion.address}</p> : null}
              {selectedSuggestion.description ? <p>{selectedSuggestion.description}</p> : null}
              <p>Coordenadas: {formatCoordinates(selectedSuggestion.lat, selectedSuggestion.lon)}</p>
            </div>

            {onAddSuggestionToRoute ? (
              <div className="mt-3">
                <button
                  className="rounded-2xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={suggestionAlreadyInRoute}
                  onClick={handleAddSuggestion}
                  type="button"
                >
                  {suggestionAlreadyInRoute ? "Ya esta en ruta" : "Anadir a ruta"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(event) {
      onMapClick(event.latlng.lat, event.latlng.lng);
    }
  });

  return null;
}

function FocusController({ mapFocus }: { mapFocus: MapFocus | null }) {
  const map = useMap();

  useEffect(() => {
    if (!mapFocus) {
      return;
    }

    map.flyTo([mapFocus.lat, mapFocus.lon], mapFocus.zoom ?? map.getZoom(), {
      duration: 0.7
    });
  }, [map, mapFocus]);

  return null;
}

function MapSizeInvalidator() {
  const map = useMap();

  useEffect(() => {
    let frameId: number | null = null;
    const refreshMapSize = () => {
      map.invalidateSize({
        pan: false,
        animate: false
      });
    };

    const mountTimeoutId = window.setTimeout(refreshMapSize, 0);
    const onResize = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        refreshMapSize();
        frameId = null;
      });
    };

    window.addEventListener("resize", onResize);

    return () => {
      window.clearTimeout(mountTimeoutId);
      window.removeEventListener("resize", onResize);

      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [map]);

  return null;
}

function AutoBounds({
  points,
  routeGeometry,
  userLocation
}: {
  points: MapPoint[];
  routeGeometry: Array<[number, number]>;
  userLocation: UserLocation | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (routeGeometry.length > 1) {
      map.fitBounds(routeGeometry, {
        padding: [36, 36]
      });
      return;
    }

    if (points.length > 1) {
      map.fitBounds(
        points.map((point) => [point.lat, point.lon] as [number, number]),
        {
          padding: [36, 36]
        }
      );
      return;
    }

    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lon], 16);
      return;
    }

    if (userLocation) {
      map.setView([userLocation.lat, userLocation.lon], 15);
      return;
    }

    map.setView(SEVILLE_CENTER, DEFAULT_MAP_ZOOM);
  }, [map, points, routeGeometry, userLocation]);

  return null;
}

function createPointIcon(point: MapPoint) {
  const ordered = typeof point.routeIndex === "number";
  const label =
    ordered && typeof point.routeIndex === "number"
      ? String(point.routeIndex + 1)
      : "";

  return divIcon({
    className: "tour-marker",
    html: ordered
      ? `<span class="tour-marker__bubble tour-marker__bubble--ordered">${label}</span>`
      : '<span class="tour-marker__bubble tour-marker__bubble--plain"></span>',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -14]
  });
}

function createSuggestionIcon(suggestion: SuggestedPlace) {
  const categoryLetter =
    suggestion.category === "iglesia" ? "I" : suggestion.category === "cofrade" ? "C" : "B";

  return divIcon({
    className: "tour-marker",
    html: `<span class="tour-marker__bubble tour-marker__bubble--suggested">${categoryLetter}</span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -14]
  });
}

function formatPointSourceLabel(source: MapPoint["source"]) {
  switch (source) {
    case "search":
      return "Buscador";
    case "map":
      return "Mapa";
    case "demo":
      return "Ejemplo";
    default:
      return source;
  }
}
