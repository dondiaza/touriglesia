"use client";

import { useEffect, useMemo, useState } from "react";
import { divIcon } from "leaflet";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents
} from "react-leaflet";

import { DEFAULT_MAP_ZOOM, SEVILLE_CENTER } from "@/lib/constants";
import type { MapFocus, MapPoint } from "@/lib/types";
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
  onMapClick
}: MapViewClientProps) {
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [pendingMapPoint, setPendingMapPoint] = useState<PendingMapPoint | null>(null);

  const selectedPoint = useMemo(
    () => points.find((point) => point.id === selectedPointId) ?? null,
    [points, selectedPointId]
  );

  useEffect(() => {
    if (selectedPointId && !points.some((point) => point.id === selectedPointId)) {
      setSelectedPointId(null);
    }
  }, [points, selectedPointId]);

  function handleMapSelect(lat: number, lon: number) {
    setSelectedPointId(null);
    setPendingMapPoint({ lat, lon });
  }

  function confirmAddPoint() {
    if (!pendingMapPoint) {
      return;
    }

    onMapClick(pendingMapPoint.lat, pendingMapPoint.lon);
    setPendingMapPoint(null);
  }

  return (
    <div className="relative h-[50vh] min-h-[420px] overflow-hidden rounded-3xl border border-[var(--panel-border)] shadow-[var(--shadow)] lg:h-[calc(100vh-8rem)]">
      <MapContainer center={SEVILLE_CENTER} className="h-full w-full" zoom={DEFAULT_MAP_ZOOM}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler onMapClick={handleMapSelect} />
        <AutoBounds points={points} routeGeometry={routeGeometry} />
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
            eventHandlers={{
              click() {
                setSelectedPointId(point.id);
                setPendingMapPoint(null);
              }
            }}
            icon={createPointIcon(point)}
            key={point.id}
            position={[point.lat, point.lon]}
          />
        ))}
      </MapContainer>

      <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-[500] flex justify-center sm:justify-start">
        <div className="pointer-events-auto rounded-2xl border border-white/80 bg-white/92 px-4 py-3 text-sm text-slate-700 shadow-lg backdrop-blur">
          Toca o haz click en el mapa para seleccionar una ubicacion. Se pedira confirmacion antes
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
                  Preview del punto
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
              <p>Coords: {formatCoordinates(selectedPoint.lat, selectedPoint.lon)}</p>
              {selectedPoint.placeType ? <p>Tipo: {selectedPoint.placeType}</p> : null}
              <p>Origen: {selectedPoint.source}</p>
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

function AutoBounds({
  points,
  routeGeometry
}: {
  points: MapPoint[];
  routeGeometry: Array<[number, number]>;
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

    map.setView(SEVILLE_CENTER, DEFAULT_MAP_ZOOM);
  }, [map, points, routeGeometry]);

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
