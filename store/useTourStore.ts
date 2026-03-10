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
  CommunityPlace,
  MapFocus,
  MapPoint,
  OrderedStop,
  PointDraft,
  RouteHistoryEntry,
  RouteSummary,
  SuggestedPlaceCategory,
  TravelMode,
  UserLocation
} from "@/lib/types";
import {
  applyStopsToPoints,
  buildFocusTarget,
  clampPointName,
  createStableId,
  sortPointsForDisplay,
  stripRouteMetadata
} from "@/lib/utils";

type AddPointResult = {
  ok: boolean;
  error?: string;
};

type ShareCommunityPlaceInput = {
  name: string;
  lat: number;
  lon: number;
  address?: string;
  description?: string;
  category?: SuggestedPlaceCategory;
};

type TourState = {
  points: MapPoint[];
  orderedStops: OrderedStop[];
  routeSummary: RouteSummary | null;
  routeHistory: RouteHistoryEntry[];
  travelMode: TravelMode;
  userLocation: UserLocation | null;
  communityPlaces: CommunityPlace[];
  activeStopIndex: number;
  mapFocus: MapFocus | null;
  notice: string | null;
  nextPointOrder: number;
  setNotice: (notice: string | null) => void;
  setTravelMode: (travelMode: TravelMode) => void;
  setUserLocation: (location: UserLocation) => void;
  setActiveStopIndex: (index: number) => void;
  addPoint: (point: PointDraft) => AddPointResult;
  movePoint: (id: string, lat: number, lon: number) => void;
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
  shareCommunityPlace: (input: ShareCommunityPlaceInput) => void;
  supportCommunityPlace: (id: string) => void;
};

export const useTourStore = create<TourState>()(
  persist(
    (set, get) => ({
      points: [],
      orderedStops: [],
      routeSummary: null,
      routeHistory: [],
      travelMode: DEFAULT_TRAVEL_MODE,
      userLocation: null,
      communityPlaces: [],
      activeStopIndex: 0,
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
          travelMode: "walking",
          notice:
            travelMode === "walking"
              ? null
              : "El planificador esta configurado en modo fijo a pie."
        });
      },

      setUserLocation(userLocation) {
        set((state) => {
          if (state.points.length > 0 || state.routeSummary) {
            return { userLocation };
          }

          return {
            userLocation,
            mapFocus: buildFocusTarget(userLocation.lat, userLocation.lon, 14)
          };
        });
      },

      setActiveStopIndex(activeStopIndex) {
        set({
          activeStopIndex
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
          activeStopIndex: 0,
          mapFocus: buildFocusTarget(nextPoint.lat, nextPoint.lon),
          notice: null,
          nextPointOrder: nextPointOrder + 1
        });

        return {
          ok: true
        };
      },

      movePoint(id, lat, lon) {
        set((state) => ({
          points: state.points.map((point) =>
            point.id === id
              ? {
                  ...stripRouteMetadata(point),
                  lat,
                  lon,
                  address: `Ubicacion aproximada (${lat.toFixed(5)}, ${lon.toFixed(5)})`,
                  displayName: `Ubicacion ajustada (${lat.toFixed(5)}, ${lon.toFixed(5)})`
                }
              : stripRouteMetadata(point)
          ),
          orderedStops: [],
          routeSummary: null,
          activeStopIndex: 0,
          mapFocus: buildFocusTarget(lat, lon),
          notice: "Punto movido en mapa. Pulsa Generar recorrido para recalcular."
        }));
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
          activeStopIndex: 0,
          notice: null
        }));
      },

      clearAll() {
        set((state) => ({
          points: [],
          orderedStops: [],
          routeSummary: null,
          activeStopIndex: 0,
          mapFocus: state.userLocation ? buildFocusTarget(state.userLocation.lat, state.userLocation.lon, 14) : null,
          notice: null,
          nextPointOrder: 1,
          travelMode: "walking"
        }));
      },

      clearRoute(notice = null) {
        set((state) => ({
          points: state.points.map(stripRouteMetadata),
          orderedStops: [],
          routeSummary: null,
          activeStopIndex: 0,
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
          activeStopIndex: 0,
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
          activeStopIndex: 0,
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
        const restoredTravelMode: TravelMode = "walking";
        const nextPointOrder =
          entry.pointsSnapshot.reduce((highestOrder, point) => Math.max(highestOrder, point.createdOrder), 0) + 1;

        set({
          points: entry.pointsSnapshot,
          orderedStops: entry.orderedStops,
          routeSummary: {
            ...entry.routeSummary,
            travelMode: restoredTravelMode
          },
          activeStopIndex: 0,
          travelMode: restoredTravelMode,
          mapFocus: firstPoint ? buildFocusTarget(firstPoint.lat, firstPoint.lon) : null,
          notice: "Ruta recuperada desde Rutas guardadas.",
          nextPointOrder
        });
      },

      shareCommunityPlace(input) {
        set((state) => {
          const match = state.communityPlaces.find(
            (place) =>
              place.name.toLowerCase() === input.name.toLowerCase() &&
              Math.abs(place.lat - input.lat) < 0.00005 &&
              Math.abs(place.lon - input.lon) < 0.00005
          );

          if (match) {
            return {
              communityPlaces: state.communityPlaces.map((place) =>
                place.id === match.id
                  ? {
                      ...place,
                      votes: place.votes + 1
                    }
                  : place
              ),
              notice: "El sitio ya existia en comunidad. Se ha sumado un apoyo."
            };
          }

          const nextPlace: CommunityPlace = {
            id: createStableId("community"),
            name: clampPointName(input.name, "Sitio compartido"),
            category: input.category || "cofrade",
            lat: input.lat,
            lon: input.lon,
            address: input.address,
            description: input.description,
            votes: 1,
            createdAt: new Date().toISOString()
          };

          return {
            communityPlaces: [nextPlace, ...state.communityPlaces],
            notice: "Sitio compartido en comunidad."
          };
        });
      },

      supportCommunityPlace(id) {
        set((state) => ({
          communityPlaces: state.communityPlaces
            .map((place) =>
              place.id === id
                ? {
                    ...place,
                    votes: place.votes + 1
                  }
                : place
            )
            .sort((left, right) => right.votes - left.votes)
        }));
      }
    }),
    {
      name: "touriglesia-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        routeHistory: state.routeHistory,
        travelMode: state.travelMode,
        userLocation: state.userLocation,
        communityPlaces: state.communityPlaces
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<TourState>),
        travelMode: "walking"
      })
    }
  )
);
