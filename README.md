# TourIglesia

Aplicacion web MVP para buscar hasta 25 ubicaciones, mostrarlas en un mapa, calcular un recorrido andando razonablemente eficiente y visualizar tanto la geometria como el detalle de las paradas.

## Stack

- Next.js 16 con App Router
- TypeScript
- Tailwind CSS 4
- Leaflet + React Leaflet
- Zustand
- OpenStreetMap tiles
- Nominatim para geocodificacion
- OSRM publico para matriz y rutas a pie

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
  layout.tsx
  page.tsx
  login/page.tsx
components/
  LoginForm.tsx
  MapView.tsx
  MapViewClient.tsx
  PointsList.tsx
  RouteSummary.tsx
  SearchBox.tsx
  TourPlanner.tsx
lib/
  auth.ts
  constants.ts
  demo.ts
  geo.ts
  route.ts
  tsp.ts
  types.ts
  utils.ts
store/
  useTourStore.ts
```

## Como funciona el calculo de ruta

1. Se construye una matriz andando con OSRM Table Service (`buildWalkingMatrix`).
2. Se genera un orden inicial con nearest neighbor (`nearestNeighborRoute`).
3. Se mejora localmente con 2-opt (`twoOptImprove`).
4. Se convierten los indices a paradas ordenadas (`buildOrderedStops`).
5. Se solicita la geometria real andando a OSRM Route Service (`fetchFullWalkingRoute`).
6. Se calculan los tramos y totales (`computeLegSummaries` + `buildRouteSummary`).

La heuristica busca un recorrido practico y rapido de calcular. No garantiza el TSP matematicamente optimo absoluto.

## Funcionalidades incluidas

- Login demo con pantalla protegida
- Mapa online centrado en Sevilla
- Busqueda por texto con debounce usando Nominatim
- Alta de puntos desde busqueda
- Alta de puntos haciendo click en el mapa con reverse geocoding
- Edicion de nombre
- Eliminacion de puntos
- Limite de 25 puntos
- Boton para cargar demo Sevilla
- Boton para limpiar todo
- Generacion de recorrido andando
- Marcadores renumerados segun el orden final
- Polilinea del recorrido
- Resumen total de distancia y tiempo
- Detalle de cada tramo
- Metadatos basicos por punto cuando existen

## Limitaciones documentadas

- La autenticacion demo no es segura.
- Depende de servicios publicos externos y de la conectividad online.
- Nominatim y OSRM pueden aplicar limites de uso, latencia o respuestas temporales inesperadas.
- La optimizacion es heuristica: nearest neighbor + 2-opt. Es muy util para MVP, pero no garantiza el optimo matematico.
- Si los servicios externos fallan, la aplicacion muestra errores amigables, pero no puede completar la ruta real.

## Mejoras futuras

- Reordenacion manual drag and drop
- Persistencia local o en base de datos
- Exportacion GPX o PDF
- Seleccion explicita del punto inicial
- Cache y rate limiting propios
- Autenticacion real

## Notas de integracion

- Los endpoints de Nominatim y OSRM estan centralizados en `lib/constants.ts`.
- La ruta completa se segmenta si el numero de coordenadas crece demasiado para una sola llamada a OSRM.
- El proyecto esta pensado para ejecutarse con `npm install` y `npm run dev` sin backend adicional.
- La version desplegada puede quedar enlazada a un dominio personalizado en Vercel sin cambiar el codigo.
