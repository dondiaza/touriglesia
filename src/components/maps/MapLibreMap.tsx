"use client";

import maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRefs = useRef<maplibregl.Marker[]>([]);
  const mapStyle = process.env.NEXT_PUBLIC_MAPLIBRE_STYLE_URL || FALLBACK_MAPLIBRE_STYLE;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: [center.lng, center.lat],
      zoom
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    return () => {
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [center.lat, center.lng, mapStyle, zoom]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    map.jumpTo({
      center: [center.lng, center.lat],
      zoom
    });
  }, [center.lat, center.lng, zoom]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = [];

    markers.forEach((marker) => {
      const markerElement = document.createElement("span");
      markerElement.textContent = marker.label || "•";
      markerElement.style.display = "inline-flex";
      markerElement.style.alignItems = "center";
      markerElement.style.justifyContent = "center";
      markerElement.style.minWidth = "28px";
      markerElement.style.height = "28px";
      markerElement.style.padding = "0 8px";
      markerElement.style.borderRadius = "999px";
      markerElement.style.background = "#0f766e";
      markerElement.style.color = "#ffffff";
      markerElement.style.fontWeight = "700";
      markerElement.style.fontSize = "12px";
      markerElement.style.boxShadow = "0 3px 8px rgba(15, 23, 42, 0.25)";

      const nextMarker = new maplibregl.Marker({
        element: markerElement,
        anchor: "bottom"
      })
        .setLngLat([marker.lng, marker.lat])
        .addTo(map);

      markerRefs.current.push(nextMarker);
    });
  }, [markers]);

  return (
    <div className={className} style={{ height: resolveMapHeight(height) }}>
      <div className="h-full w-full rounded-2xl" ref={containerRef} />
    </div>
  );
}
