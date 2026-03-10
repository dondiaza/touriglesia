"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  DEFAULT_TRAVEL_MODE,
  MAX_POINTS,
  ROUTE_HISTORY_LIMIT
} from "@/lib/constants";
import { buildDemoPointDrafts } from "@/lib/demo";
import type {
  MapFocus,
  MapPoint,
  OrderedStop,
  PointDraft,
  RouteHistoryEntry,
  RouteSummary,
  TravelMode
} from "@/lib/types";
import {
  applyStopsToPoints,
  buildFocusTarget,
  clampPointName,
  sortPointsForDisplay,
  stripRouteMetadata
} from "@/lib/utils";

type AddPointResult = {
  ok: boolean;
  error?: string;
};

type TourState = {
  points: MapPoint[];
  orderedStops: OrderedStop[];
  routeSummary: RouteSummary | null;
  routeHistory: RouteHistoryEntry[];
  travelMode: TravelMode;
  mapFocus: MapFocus | null;
  notice: string | null;
  nextPointOrder: number;
  setNotice: (notice: string | null) => void;
  setTravelMode: (travelMode: TravelMode) => void;
  addPoint: (point: PointDraft) => AddPointResult;
  updatePointName: (id: string, name: string) => void;
  removePoint: (id: string) => void;
  clearAll: () => void;
  clearRoute: (notice?: string | null) => void;
  focusPoint: (id: string) => void;
  focusCoordinates: (lat: number, lon: number, zoom?: number) => void;
  loadDemoPoints: () => void;
  applyRoute: (
    summary: RouteSummary,
    orderedStops: OrderedStop[],
    pointsSnapshot?: MapPoint[]
  ) => void;
  saveRouteToHistory: (entry: RouteHistoryEntry) => void;
  removeHistoryEntry: (id: string) => void;
  restoreRouteFromHistory: (id: string) => void;
};

export const useTourStore = create<TourState>()(
  persist(
    (set, get) => ({
      points: [],
      orderedStops: [],
      routeSummary: null,
      routeHistory: [],
      travelMode: DEFAULT_TRAVEL_MODE,
      mapFocus: null,
      notice: null,
      nextPointOrder: 1,

      setNotice(notice) {
        set({
          notice
        });
      },

      setTravelMode(travelMode) {
        set({
          travelMode
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
          id: point.id,
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
                  name: clampPointName(name, `Punto ${point.createdOrder}`)
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
        set((state) => ({
          points: [],
          orderedStops: [],
          routeSummary: null,
          mapFocus: null,
          notice: null,
          nextPointOrder: 1,
          travelMode: state.travelMode
        }));
      },

      clearRoute(notice = null) {
        set((state) => ({
          points: state.points.map(stripRouteMetadata),
          orderedStops: [],
          routeSummary: null,
          notice
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

      applyRoute(summary, orderedStops, pointsSnapshot) {
        set((state) => ({
          points: pointsSnapshot ?? applyStopsToPoints(state.points, orderedStops),
          orderedStops,
          routeSummary: summary,
          notice: null
        }));
      },

      saveRouteToHistory(entry) {
        set((state) => ({
          routeHistory: [entry, ...state.routeHistory.filter((item) => item.id !== entry.id)].slice(
            0,
            ROUTE_HISTORY_LIMIT
          )
        }));
      },

      removeHistoryEntry(id) {
        set((state) => ({
          routeHistory: state.routeHistory.filter((entry) => entry.id !== id)
        }));
      },

      restoreRouteFromHistory(id) {
        const entry = get().routeHistory.find((historyEntry) => historyEntry.id === id);

        if (!entry) {
          return;
        }

        const orderedPoints = sortPointsForDisplay(entry.pointsSnapshot);
        const firstPoint = orderedPoints[0];
        const restoredTravelMode = entry.routeSummary.travelMode || entry.travelMode || DEFAULT_TRAVEL_MODE;
        const nextPointOrder =
          entry.pointsSnapshot.reduce((highestOrder, point) => Math.max(highestOrder, point.createdOrder), 0) + 1;

        set({
          points: entry.pointsSnapshot,
          orderedStops: entry.orderedStops,
          routeSummary: {
            ...entry.routeSummary,
            travelMode: restoredTravelMode
          },
          travelMode: restoredTravelMode,
          mapFocus: firstPoint ? buildFocusTarget(firstPoint.lat, firstPoint.lon) : null,
          notice: "Ruta recuperada desde el historico.",
          nextPointOrder
        });
      }
    }),
    {
      name: "touriglesia-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        routeHistory: state.routeHistory,
        travelMode: state.travelMode
      })
    }
  )
);
