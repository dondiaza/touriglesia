"use client";

import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip,
  useMap
} from "react-leaflet";

import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  resolveMapHeight,
  type BaseMapProps
} from "./types";

export default function LeafletMap({
  center = DEFAULT_MAP_CENTER,
  zoom = DEFAULT_MAP_ZOOM,
  height = 320,
  markers = [],
  className
}: BaseMapProps) {
  return (
    <div className={className} style={{ height: resolveMapHeight(height) }}>
      <MapContainer
        center={[center.lat, center.lng]}
        className="h-full w-full rounded-2xl"
        zoom={zoom}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ViewUpdater center={center} zoom={zoom} />

        {markers.map((marker) => (
          <CircleMarker
            center={[marker.lat, marker.lng]}
            key={marker.id}
            pathOptions={{
              color: "#0f766e",
              fillColor: "#0f766e",
              fillOpacity: 0.8
            }}
            radius={8}
          >
            {marker.label ? <Tooltip>{marker.label}</Tooltip> : null}
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

function ViewUpdater({
  center,
  zoom
}: {
  center: { lat: number; lng: number };
  zoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    map.setView([center.lat, center.lng], zoom, {
      animate: false
    });
  }, [center.lat, center.lng, map, zoom]);

  return null;
}
