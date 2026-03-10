"use client";

import Map, { Marker, NavigationControl } from "react-map-gl";

import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  resolveMapHeight,
  type BaseMapProps
} from "./types";

export default function MapboxMap({
  center = DEFAULT_MAP_CENTER,
  zoom = DEFAULT_MAP_ZOOM,
  height = 320,
  markers = [],
  className
}: BaseMapProps) {
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!mapboxToken) {
    return (
      <div
        className={className}
        style={{ height: resolveMapHeight(height) }}
      >
        <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 text-sm text-amber-800">
          Configura `NEXT_PUBLIC_MAPBOX_TOKEN` para usar Mapbox GL.
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ height: resolveMapHeight(height) }}>
      <Map
        initialViewState={{
          latitude: center.lat,
          longitude: center.lng,
          zoom
        }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        mapboxAccessToken={mapboxToken}
        style={{ width: "100%", height: "100%", borderRadius: "1rem" }}
      >
        <NavigationControl position="top-right" />

        {markers.map((marker) => (
          <Marker
            anchor="bottom"
            key={marker.id}
            latitude={marker.lat}
            longitude={marker.lng}
          >
            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--accent)] px-2 text-xs font-semibold text-white shadow">
              {marker.label || "•"}
            </span>
          </Marker>
        ))}
      </Map>
    </div>
  );
}
