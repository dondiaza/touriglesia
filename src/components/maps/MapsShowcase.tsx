"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";

import type { MapMarker } from "./types";

const MapboxMap = dynamic(() => import("./MapboxMap"), { ssr: false });
const GoogleMapView = dynamic(() => import("./GoogleMapView"), { ssr: false });
const MapLibreMap = dynamic(() => import("./MapLibreMap"), { ssr: false });
const LeafletMap = dynamic(() => import("./LeafletMap"), { ssr: false });
const OpenLayersMap = dynamic(() => import("./OpenLayersMap"), { ssr: false });

const demoMarkers: MapMarker[] = [
  { id: "catedral", lat: 37.38604, lng: -5.99245, label: "Catedral" },
  { id: "salvador", lat: 37.38909, lng: -5.99278, label: "Salvador" },
  { id: "macarena", lat: 37.40283, lng: -5.98884, label: "Macarena" }
];

export default function MapsShowcase() {
  return (
    <section className="space-y-6">
      <MapCard
        description="Mapbox GL JS + react-map-gl (recomendado para Touriglesia)."
        title="Mapbox GL"
      >
        <MapboxMap height={320} markers={demoMarkers} />
      </MapCard>

      <MapCard
        description="Google Maps JavaScript API usando @vis.gl/react-google-maps."
        title="Google Maps"
      >
        <GoogleMapView height={320} markers={demoMarkers} />
      </MapCard>

      <MapCard
        description="MapLibre GL JS + react-map-gl con estilo abierto."
        title="MapLibre GL"
      >
        <MapLibreMap height={320} markers={demoMarkers} />
      </MapCard>

      <MapCard
        description="Leaflet + React Leaflet para escenarios sencillos y ligeros."
        title="Leaflet"
      >
        <LeafletMap height={320} markers={demoMarkers} />
      </MapCard>

      <MapCard
        description="OpenLayers para casos avanzados GIS y capas complejas."
        title="OpenLayers"
      >
        <OpenLayersMap height={320} markers={demoMarkers} />
      </MapCard>
    </section>
  );
}

function MapCard({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <article className="space-y-3 rounded-3xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 shadow-[var(--shadow)]">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{description}</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200">{children}</div>
    </article>
  );
}
