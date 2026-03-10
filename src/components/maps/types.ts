export type MapCoordinates = {
  lat: number;
  lng: number;
};

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label?: string;
};

export type BaseMapProps = {
  center?: MapCoordinates;
  zoom?: number;
  height?: number | string;
  markers?: MapMarker[];
  className?: string;
};

export const DEFAULT_MAP_CENTER: MapCoordinates = {
  lat: 37.3891,
  lng: -5.9845
};

export const DEFAULT_MAP_ZOOM = 14;

export function resolveMapHeight(height: BaseMapProps["height"] = 320) {
  return typeof height === "number" ? `${height}px` : height;
}
