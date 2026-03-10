"use client";

import { APIProvider, AdvancedMarker, Map } from "@vis.gl/react-google-maps";

import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  resolveMapHeight,
  type BaseMapProps
} from "./types";

export default function GoogleMapView({
  center = DEFAULT_MAP_CENTER,
  zoom = DEFAULT_MAP_ZOOM,
  height = 320,
  markers = [],
  className
}: BaseMapProps) {
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!googleMapsApiKey) {
    return (
      <div
        className={className}
        style={{ height: resolveMapHeight(height) }}
      >
        <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 text-sm text-amber-800">
          Configura `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` para usar Google Maps.
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ height: resolveMapHeight(height) }}>
      <APIProvider apiKey={googleMapsApiKey}>
        <Map
          defaultCenter={center}
          defaultZoom={zoom}
          disableDefaultUI={false}
          gestureHandling="greedy"
          mapTypeControl={false}
          style={{ width: "100%", height: "100%", borderRadius: "1rem" }}
        >
          {markers.map((marker) => (
            <AdvancedMarker
              key={marker.id}
              position={{
                lat: marker.lat,
                lng: marker.lng
              }}
              title={marker.label}
            >
              <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--accent)] px-2 text-xs font-semibold text-white shadow">
                {marker.label || "•"}
              </span>
            </AdvancedMarker>
          ))}
        </Map>
      </APIProvider>
    </div>
  );
}
