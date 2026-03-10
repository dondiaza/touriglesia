"use client";

import { useEffect } from "react";
import { divIcon } from "leaflet";
import {
  MapContainer,
  Marker,
  Popup,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents
} from "react-leaflet";

import { DEFAULT_MAP_ZOOM, SEVILLE_CENTER } from "@/lib/constants";
import type { MapFocus, MapPoint } from "@/lib/types";
import { formatCoordinates } from "@/lib/utils";

type MapViewClientProps = {
  points: MapPoint[];
  mapFocus: MapFocus | null;
  routeGeometry: Array<[number, number]>;
  onMapClick: (lat: number, lon: number) => void;
};

export default function MapViewClient({
  points,
  mapFocus,
  routeGeometry,
  onMapClick
}: MapViewClientProps) {
  return (
    <div className="h-[50vh] min-h-[420px] overflow-hidden rounded-3xl border border-[var(--panel-border)] shadow-[var(--shadow)] lg:h-[calc(100vh-8rem)]">
      <MapContainer center={SEVILLE_CENTER} className="h-full w-full" zoom={DEFAULT_MAP_ZOOM}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler onMapClick={onMapClick} />
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
            icon={createPointIcon(point)}
            key={point.id}
            position={[point.lat, point.lon]}
          >
            <Popup>
              <div className="space-y-1">
                <p className="font-semibold text-slate-900">
                  {point.name || `Punto ${typeof point.routeIndex === "number" ? point.routeIndex + 1 : point.createdOrder}`}
                </p>
                {point.address ? (
                  <p className="text-sm text-slate-700">{point.address}</p>
                ) : null}
                <p className="text-xs text-slate-500">{formatCoordinates(point.lat, point.lon)}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
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
