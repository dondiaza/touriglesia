"use client";

import maplibregl from "maplibre-gl";
import Map, { Marker, NavigationControl } from "react-map-gl";

import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  resolveMapHeight,
  type BaseMapProps
} from "./types";

const FALLBACK_MAPLIBRE_STYLE = "https://demotiles.maplibre.org/style.json";

export default function MapLibreMap({
  center = DEFAULT_MAP_CENTER,
  zoom = DEFAULT_MAP_ZOOM,
  height = 320,
  markers = [],
  className
}: BaseMapProps) {
  const mapStyle = process.env.NEXT_PUBLIC_MAPLIBRE_STYLE_URL || FALLBACK_MAPLIBRE_STYLE;

  return (
    <div className={className} style={{ height: resolveMapHeight(height) }}>
      <Map
        initialViewState={{
          latitude: center.lat,
          longitude: center.lng,
          zoom
        }}
        mapLib={maplibregl}
        mapStyle={mapStyle}
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
