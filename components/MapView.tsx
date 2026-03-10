"use client";

import dynamic from "next/dynamic";

import type { MapFocus, MapPoint, SuggestedPlace, UserLocation } from "@/lib/types";

type MapViewProps = {
  points: MapPoint[];
  mapFocus: MapFocus | null;
  routeGeometry: Array<[number, number]>;
  isResolvingMapPoint?: boolean;
  suggestionPoints?: SuggestedPlace[];
  userLocation?: UserLocation | null;
  onAddSuggestionToRoute?: (suggestedPlace: SuggestedPlace) => void;
  onRemovePoint?: (pointId: string) => void;
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
