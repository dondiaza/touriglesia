# TourIglesia

Aplicacion web para crear rutas entre iglesias, parroquias, hermandades y otros puntos de interes, visualizarlas en mapa y recalcularlas de forma rapida para ir siempre andando.

## Stack

- Next.js 16 con App Router
- TypeScript
- Tailwind CSS 4
- Leaflet + React Leaflet
- Mapbox GL + react-map-gl
- Google Maps JS API (@vis.gl/react-google-maps)
- MapLibre GL
- OpenLayers
- Zustand con persistencia local y sincronizacion remota opcional (Vercel Postgres/Neon)
- @vercel/postgres para persistencia serverless
- OpenStreetMap tiles
- Nominatim para geocodificacion y busqueda
- OSRM publico para matriz y rutas peatonales
- GDELT publico para la pestaña de sugerencias diarias

## Requisitos

- Node.js 20.9 o superior
- npm 10 o superior
- Conexion a internet

## Instalacion

```bash
npm install
```

## Ejecucion local

```bash
npm run dev
```

Abre `http://localhost:3000`.

## Credenciales demo

- Usuario: `iglesia`
- Clave: `iglesia`

Importante: esta autenticacion es solo para demo. Las credenciales estan hardcodeadas y la sesion usa una cookie simple. No es segura para produccion.

## Estructura principal

```text
app/
  api/
    cofradia-news/route.ts
    geocode/search/route.ts
    geocode/reverse/route.ts
    state/route.ts
  layout.tsx
  page.tsx
  login/page.tsx
components/
  HistoryPanel.tsx
  LoginForm.tsx
  MapView.tsx
  MapViewClient.tsx
  PointsList.tsx
  RouteSummary.tsx
  SearchBox.tsx
  SuggestionsPanel.tsx
  TourPlanner.tsx
lib/
  auth.ts
  constants.ts
  demo.ts
  geo.ts
  news.ts
  planner.ts
  route.ts
  statePersistence.ts
  tsp.ts
  types.ts
  utils.ts
store/
  useTourStore.ts
src/
  components/maps/
    MapboxMap.tsx
    GoogleMapView.tsx
    MapLibreMap.tsx
    LeafletMap.tsx
    OpenLayersMap.tsx
    MapsShowcase.tsx
app/
  maps-demo/page.tsx
```

## Funcionalidades incluidas

- Login demo con una unica pantalla protegida
- Login sin mostrar credenciales en pantalla ni placeholders precompletados
- Busqueda con autocompletar simple y prioridad para resultados cofrades y eclesiasticos
- Foco por defecto en Sevilla cuando no hay geolocalizacion disponible
- Sincronizacion inicial con geolocalizacion del navegador para priorizar resultados de la zona actual
- Geolocalizacion en vivo con actualizacion continua y marcador de posicion sobre el mapa
- Sesgo local en Nominatim (viewbox + pais + limite de area) para evitar resultados de otros paises cuando no toca
- Atajos de busqueda rapida: Iglesia, Parroquia, Hermandad, Capilla y Basilica
- Los atajos de busqueda reemplazan la consulta actual (no acumulan terminos)
- Alta de puntos desde resultados de busqueda
- Alta de puntos tocando o haciendo click en el mapa en desktop y mobile, con confirmacion previa para evitar misclick
- Reverse geocoding para nombrar mejor los puntos anadidos desde el mapa
- Correccion de posicion al anadir por mapa: se conserva exactamente la coordenada tocada
- Edicion de nombre, centrado y eliminacion de puntos
- Limite de 25 puntos
- Modo de ruta fijo: andando
- Generacion de ruta eficiente con matriz OSRM + nearest neighbor + 2-opt
- En modo a pie, la optimizacion prioriza distancia total (tramo mas corto posible entre puntos)
- Reordenacion manual por arrastrar y soltar (desktop + mobile)
- Al regenerar tras reordenar manualmente, se respeta exactamente el orden establecido
- Rutas guardadas en una pestana dedicada, con guardado manual por nombre de ruta y usuario
- Sugerencias clave sobre el mapa (iglesias, interes cofrade y cervecerias) con seleccion y anadido a ruta
- Checks por categoria para mostrar en bloque sugerencias cercanas (radio 200 m desde geolocalizacion)
- Eliminacion de puntos directamente desde la ficha del marcador en el mapa
- Reasignacion de puntos arrastrando marcadores directamente sobre el mapa
- Marcadores renumerados segun el orden final
- Preview flotante al pulsar un marcador del mapa
- Polilinea del recorrido
- Resumen principal con distancia/tiempo y guia por calles (giros, pasos y distancia de cada instruccion)
- Seguimiento de ruta con boton "He llegado al destino" y sugerencias cercanas por cada llegada
- Sitios compartidos por la comunidad con apoyos/votos para dar mas relevancia
- Pestaña de sugerencias con resumen diario de noticias cofrades y navegacion por fechas
- Boton demo Sevilla y boton limpiar

## Como funciona el calculo de ruta

1. Se construye una matriz de tiempos y distancias con OSRM Table Service (`buildTravelMatrix`).
2. Se usa metrica de optimizacion por `distance` para priorizar distancia peatonal minima.
3. Se genera y evalua un orden inicial desde multiples puntos de arranque con nearest neighbor.
4. Se mejora localmente con 2-opt y se selecciona el mejor coste total (`selectBestOpenRoute`).
5. Se solicita la geometria real a OSRM Route Service (`fetchFullRoute`) usando proveedor peatonal libre.
6. Para pocos puntos se calcula tramo a tramo en paralelo para maximizar precision por salto.
7. Para rutas largas se agrupa por bloques para reducir latencia total sin perder detalle por tramo.
8. En tramos peatonales directos (A -> B) se piden alternativas y se escoge la de menor distancia.
9. El trazado permite volver por la misma calle si compensa (`continue_straight=false`).
10. Se calculan tramos y pasos por calle (`computeLegSummaries` + `buildRouteSummary`).
11. Si el usuario reordena manualmente por arrastrar y soltar, al pulsar "Generar recorrido" se recalcula respetando ese orden.

La heuristica busca un recorrido practico y rapido de calcular. No garantiza el TSP matematicamente optimo absoluto.

## Rutas guardadas y persistencia

- Toda la sesion de trabajo (puntos, orden, resumen de ruta, rutas guardadas, comunidad y ubicacion) se guarda en BBDD via `app/api/state` cuando `POSTGRES_URL` o `DATABASE_URL` estan configuradas.
- El cliente mantiene cache local (`localStorage`) para mejorar UX, pero la fuente de verdad remota es la BBDD.
- La sincronizacion usa control de revision monotona para evitar que escrituras antiguas sobrescriban datos nuevos por latencia o reintentos.
- Si la carga inicial de BBDD falla temporalmente, la app no hace sobrescritura remota hasta recuperar conexion (evita borrados accidentales).
- El guardado de rutas sigue siendo manual: tras generar una ruta, pulsa "Guardar ruta" e indica nombre de ruta y usuario.
- Si la base de datos no esta configurada o falla, la aplicacion mantiene persistencia local y muestra un aviso amigable.

## Sugerencias diarias

- La pestaña "Sugerencias" consulta un endpoint interno (`/api/cofradia-news`) que a su vez usa GDELT.
- El objetivo es dar un resumen diario de titulares y contexto, no una agenda oficial exhaustiva.
- Puedes consultar el dia actual, dias anteriores y dias posteriores.

## Limitaciones documentadas

- La autenticacion demo no es segura.
- Depende de servicios publicos externos y de la conectividad online.
- Nominatim, OSRM y GDELT pueden aplicar limites de uso, latencia o respuestas temporales inesperadas.
- La busqueda usa proxy interno para Nominatim (`/api/geocode/*`) para reducir fallos de CORS en cliente.
- La optimizacion usa heuristica local (nearest neighbor + 2-opt) con matriz de red peatonal; sigue siendo aproximada y no garantiza el optimo matematico absoluto.
- Los sitios compartidos y apoyos no tienen moderacion ni control de identidad; en modo sin Postgres quedan locales al navegador.
- La geolocalizacion requiere permiso del navegador; si se deniega, la app usa busqueda general.
- Las sugerencias por check de categoria en mapa solo muestran puntos dentro de 200 m desde la posicion geolocalizada.
- Mapbox y Google requieren API keys en variables de entorno para funcionar.
- El enrutado peatonal por defecto usa `routing.openstreetmap.de/routed-foot` (gratis, sin API key), con fallback configurable.
- La pestaña de sugerencias resume noticias publicas y no sustituye a una agenda oficial de hermandades o cofradias.
- Si los servicios externos fallan, la aplicacion muestra errores amigables, pero no puede completar la busqueda, la ruta o el resumen del dia.

## Mejoras futuras

- Reordenacion por arrastrar y soltar con feedback visual avanzado
- Seleccion explicita del punto inicial y final
- Exportacion GPX o PDF
- Cache propia para Nominatim y OSRM
- Integracion con agenda oficial o feed especializado para eventos cofrades
- Autenticacion real y gestion multiusuario

## Notas de integracion

- Los endpoints de Nominatim, OSRM y GDELT estan centralizados en `lib/constants.ts`.
- Puedes sobreescribir los endpoints/perfiles de routing por variables `NEXT_PUBLIC_OSRM_*` en `.env.local`.
- Para persistencia remota define `POSTGRES_URL` o `DATABASE_URL` (en Vercel se inyecta automaticamente al conectar Postgres).
- La ruta completa se segmenta si el numero de coordenadas crece demasiado para una sola llamada a OSRM.
- La autenticacion es solo para demo y no debe reutilizarse en produccion.
- El proyecto esta pensado para ejecutarse con `npm install` y `npm run dev` sin backend complejo; la base de datos es opcional para persistencia remota.
- Consulta `MAPS_SETUP.md` para comparar motores de mapas y configurar claves.
