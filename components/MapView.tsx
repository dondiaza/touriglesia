"use client";

import dynamic from "next/dynamic";

import type { MapFocus, MapPoint } from "@/lib/types";

type MapViewProps = {
  points: MapPoint[];
  mapFocus: MapFocus | null;
  routeGeometry: Array<[number, number]>;
  onMapClick: (lat: number, lon: number) => void;
};

const DynamicMapView = dynamic(() => import("./MapViewClient"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[420px] items-center justify-center rounded-[28px] bg-white/70 text-sm text-[var(--muted)]">
      Cargando mapa...
    </div>
  )
});

export default function MapView(props: MapViewProps) {
  return <DynamicMapView {...props} />;
}
