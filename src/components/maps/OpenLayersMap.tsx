"use client";

import "ol/ol.css";

import { useEffect, useRef } from "react";
import Feature from "ol/Feature";
import Map from "ol/Map";
import View from "ol/View";
import Point from "ol/geom/Point";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import { fromLonLat } from "ol/proj";
import OSM from "ol/source/OSM";
import VectorSource from "ol/source/Vector";
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from "ol/style";

import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  resolveMapHeight,
  type BaseMapProps
} from "./types";

export default function OpenLayersMap({
  center = DEFAULT_MAP_CENTER,
  zoom = DEFAULT_MAP_ZOOM,
  height = 320,
  markers = [],
  className
}: BaseMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const vectorSourceRef = useRef<VectorSource | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const vectorSource = new VectorSource();
    vectorSourceRef.current = vectorSource;

    const vectorLayer = new VectorLayer({
      source: vectorSource
    });

    const map = new Map({
      target: containerRef.current,
      layers: [
        new TileLayer({
          source: new OSM()
        }),
        vectorLayer
      ],
      view: new View({
        center: fromLonLat([center.lng, center.lat]),
        zoom
      })
    });

    mapRef.current = map;

    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
      vectorSourceRef.current = null;
    };
  }, [center.lat, center.lng, zoom]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    const view = map.getView();
    view.setCenter(fromLonLat([center.lng, center.lat]));
    view.setZoom(zoom);
  }, [center.lat, center.lng, zoom]);

  useEffect(() => {
    const vectorSource = vectorSourceRef.current;

    if (!vectorSource) {
      return;
    }

    vectorSource.clear();

    const features = markers.map((marker) => {
      const feature = new Feature({
        geometry: new Point(fromLonLat([marker.lng, marker.lat]))
      });

      feature.setStyle(
        new Style({
          image: new CircleStyle({
            radius: 8,
            fill: new Fill({
              color: "#0f766e"
            }),
            stroke: new Stroke({
              color: "#ffffff",
              width: 2
            })
          }),
          text: marker.label
            ? new Text({
                text: marker.label,
                offsetY: -18,
                font: "600 12px var(--font-sans)",
                fill: new Fill({
                  color: "#0f172a"
                }),
                stroke: new Stroke({
                  color: "#ffffff",
                  width: 2
                })
              })
            : undefined
        })
      );

      return feature;
    });

    vectorSource.addFeatures(features);
  }, [markers]);

  return (
    <div className={className} style={{ height: resolveMapHeight(height) }}>
      <div className="h-full w-full rounded-2xl" ref={containerRef} />
    </div>
  );
}
