# MAPS_SETUP

## Librerias instaladas

- `mapbox-gl`: motor vectorial de Mapbox GL JS.
- `react-map-gl`: capa React para Mapbox/MapLibre.
- `@vis.gl/react-google-maps`: integracion React para Google Maps JS API.
- `maplibre-gl`: alternativa open source compatible con estilos GL.
- `leaflet`: motor ligero clasico.
- `react-leaflet`: bindings React para Leaflet.
- `ol`: OpenLayers para casos GIS avanzados.
- `@types/google.maps` (dev): tipos TypeScript para Google Maps.

## Estructura creada

- `src/components/maps/MapboxMap.tsx`
- `src/components/maps/GoogleMapView.tsx`
- `src/components/maps/MapLibreMap.tsx`
- `src/components/maps/LeafletMap.tsx`
- `src/components/maps/OpenLayersMap.tsx`
- `src/components/maps/types.ts`
- `src/components/maps/index.ts`
- `src/components/maps/MapsShowcase.tsx`
- `app/maps-demo/page.tsx`

## Recomendacion principal para Touriglesia

Prioridad recomendada:
1. Mapbox GL JS
2. Google Maps JavaScript API
3. MapLibre GL JS
4. Leaflet
5. OpenLayers

Recomendacion por defecto:
- Usar `MapboxMap` como principal por equilibrio entre calidad visual, rendimiento y ecosistema.
- Para funcionamiento inmediato sin API key, usar `LeafletMap` o `MapLibreMap` (estilo demo libre).

## Routing libre recomendado (sin API key)

- Provider peatonal por defecto del proyecto: `https://routing.openstreetmap.de/routed-foot`
- Fallback peatonal: `https://router.project-osrm.org` (perfil `foot`)
- Objetivo de Touriglesia: calcular rutas siempre a pie priorizando distancia corta entre puntos.

Variables opcionales en `.env.local`:

```bash
NEXT_PUBLIC_OSRM_WALKING_BASE_URL=https://routing.openstreetmap.de/routed-foot
NEXT_PUBLIC_OSRM_WALKING_PROFILE=driving
NEXT_PUBLIC_OSRM_WALKING_FALLBACK_BASE_URL=https://router.project-osrm.org
NEXT_PUBLIC_OSRM_WALKING_FALLBACK_PROFILE=foot
NEXT_PUBLIC_OSRM_DRIVING_BASE_URL=https://router.project-osrm.org
NEXT_PUBLIC_OSRM_DRIVING_PROFILE=driving
```

## Variables de entorno

Configura en `.env.local`:

```bash
NEXT_PUBLIC_MAPBOX_TOKEN=tu_token_mapbox
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=tu_api_key_google_maps
NEXT_PUBLIC_MAPLIBRE_STYLE_URL=https://demotiles.maplibre.org/style.json
```

Notas:
- No hardcodear claves en componentes.
- Sin clave de Mapbox/Google, los componentes muestran aviso en UI.

## Uso rapido de componentes

Ejemplo base:

```tsx
import { MapboxMap } from "@/src/components/maps";

<MapboxMap
  center={{ lat: 37.3891, lng: -5.9845 }}
  zoom={14}
  height={360}
  markers={[
    { id: "1", lat: 37.38604, lng: -5.99245, label: "Catedral" }
  ]}
/>;
```

Props comunes en todos:
- `center`: `{ lat, lng }`
- `zoom`: numero
- `height`: numero o string (`320`, `"50vh"`, etc.)
- `markers`: array opcional de marcadores

## Demo de comparacion

Ruta creada:
- `/maps-demo`

Muestra los 5 motores en tarjetas separadas para pruebas funcionales y comparativa.

## CSS global requerido

Importado en `app/layout.tsx`:
- `mapbox-gl/dist/mapbox-gl.css`
- `maplibre-gl/dist/maplibre-gl.css`
- `leaflet/dist/leaflet.css`
