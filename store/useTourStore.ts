import { create } from "zustand";

import { MAX_POINTS } from "@/lib/constants";
import { buildDemoPointDrafts } from "@/lib/demo";
import type { MapFocus, MapPoint, OrderedStop, PointDraft, RouteSummary } from "@/lib/types";
import { buildFocusTarget, clampPointName, stripRouteMetadata } from "@/lib/utils";

type AddPointResult = {
  ok: boolean;
  error?: string;
};

type TourState = {
  points: MapPoint[];
  orderedStops: OrderedStop[];
  routeSummary: RouteSummary | null;
  mapFocus: MapFocus | null;
  notice: string | null;
  nextPointOrder: number;
  setNotice: (notice: string | null) => void;
  addPoint: (point: PointDraft) => AddPointResult;
  updatePointName: (id: string, name: string) => void;
  removePoint: (id: string) => void;
  clearAll: () => void;
  clearRoute: () => void;
  focusPoint: (id: string) => void;
  focusCoordinates: (lat: number, lon: number, zoom?: number) => void;
  loadDemoPoints: () => void;
  applyRoute: (summary: RouteSummary, orderedStops: OrderedStop[]) => void;
};

export const useTourStore = create<TourState>((set, get) => ({
  points: [],
  orderedStops: [],
  routeSummary: null,
  mapFocus: null,
  notice: null,
  nextPointOrder: 1,

  setNotice(notice) {
    set({
      notice
    });
  },

  addPoint(point) {
    const { points, nextPointOrder } = get();

    if (points.length >= MAX_POINTS) {
      const error = `Has alcanzado el maximo de ${MAX_POINTS} puntos.`;
      set({
        notice: error
      });

      return {
        ok: false,
        error
      };
    }

    const nextPoint: MapPoint = {
      ...point,
      name: clampPointName(point.name, `Punto ${nextPointOrder}`),
      createdOrder: nextPointOrder
    };

    set({
      points: [...points.map(stripRouteMetadata), nextPoint],
      orderedStops: [],
      routeSummary: null,
      mapFocus: buildFocusTarget(nextPoint.lat, nextPoint.lon),
      notice: null,
      nextPointOrder: nextPointOrder + 1
    });

    return {
      ok: true
    };
  },

  updatePointName(id, name) {
    set((state) => ({
      points: state.points.map((point) =>
        point.id === id
          ? {
              ...point,
              name: name.slice(0, 80)
            }
          : point
      )
    }));
  },

  removePoint(id) {
    set((state) => ({
      points: state.points
        .filter((point) => point.id !== id)
        .map(stripRouteMetadata),
      orderedStops: [],
      routeSummary: null,
      notice: null
    }));
  },

  clearAll() {
    set({
      points: [],
      orderedStops: [],
      routeSummary: null,
      mapFocus: null,
      notice: null,
      nextPointOrder: 1
    });
  },

  clearRoute() {
    set((state) => ({
      points: state.points.map(stripRouteMetadata),
      orderedStops: [],
      routeSummary: null
    }));
  },

  focusPoint(id) {
    const targetPoint = get().points.find((point) => point.id === id);

    if (!targetPoint) {
      return;
    }

    set({
      mapFocus: buildFocusTarget(targetPoint.lat, targetPoint.lon)
    });
  },

  focusCoordinates(lat, lon, zoom) {
    set({
      mapFocus: buildFocusTarget(lat, lon, zoom)
    });
  },

  loadDemoPoints() {
    const drafts = buildDemoPointDrafts();

    set(() => ({
      points: drafts.map((point, index) => ({
        ...point,
        createdOrder: index + 1
      })),
      orderedStops: [],
      routeSummary: null,
      mapFocus: buildFocusTarget(drafts[0].lat, drafts[0].lon),
      notice: null,
      nextPointOrder: drafts.length + 1
    }));
  },

  applyRoute(summary, orderedStops) {
    const stopLookup = new Map(orderedStops.map((stop) => [stop.pointId, stop]));

    set((state) => ({
      points: state.points.map((point) => {
        const stop = stopLookup.get(point.id);

        if (!stop) {
          return stripRouteMetadata(point);
        }

        return {
          ...point,
          routeIndex: stop.routeIndex,
          distanceFromPrevious: stop.distanceFromPrevious,
          durationFromPrevious: stop.durationFromPrevious
        };
      }),
      orderedStops,
      routeSummary: summary,
      notice: null
    }));
  }
}));
