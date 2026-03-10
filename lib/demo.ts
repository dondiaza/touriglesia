import type { PointDraft } from "./types";

export function buildDemoPointDrafts(): PointDraft[] {
  return [
    {
      id: "demo-catedral",
      name: "Catedral de Sevilla",
      lat: 37.38604,
      lon: -5.99245,
      address: "Avenida de la Constitucion, Sevilla",
      displayName: "Catedral de Sevilla, Avenida de la Constitucion, Sevilla",
      placeType: "cathedral",
      metadata: {
        note: "Demo Sevilla"
      },
      source: "demo"
    },
    {
      id: "demo-salvador",
      name: "Iglesia del Salvador",
      lat: 37.38909,
      lon: -5.99278,
      address: "Plaza del Salvador, Sevilla",
      displayName: "Iglesia del Salvador, Plaza del Salvador, Sevilla",
      placeType: "church",
      metadata: {
        note: "Demo Sevilla"
      },
      source: "demo"
    },
    {
      id: "demo-santa-ana",
      name: "Iglesia de Santa Ana",
      lat: 37.38255,
      lon: -5.99987,
      address: "Calle Pureza, Sevilla",
      displayName: "Iglesia de Santa Ana, Calle Pureza, Sevilla",
      placeType: "church",
      metadata: {
        note: "Demo Sevilla"
      },
      source: "demo"
    },
    {
      id: "demo-gran-poder",
      name: "Basilica del Gran Poder",
      lat: 37.3949,
      lon: -5.99768,
      address: "Plaza de San Lorenzo, Sevilla",
      displayName: "Basilica del Gran Poder, Plaza de San Lorenzo, Sevilla",
      placeType: "church",
      metadata: {
        note: "Demo Sevilla"
      },
      source: "demo"
    },
    {
      id: "demo-macarena",
      name: "Basilica de la Macarena",
      lat: 37.40283,
      lon: -5.98884,
      address: "Calle Becquer, Sevilla",
      displayName: "Basilica de la Macarena, Calle Becquer, Sevilla",
      placeType: "church",
      metadata: {
        note: "Demo Sevilla"
      },
      source: "demo"
    },
    {
      id: "demo-san-luis",
      name: "San Luis de los Franceses",
      lat: 37.3989,
      lon: -5.98815,
      address: "Calle San Luis, Sevilla",
      displayName: "San Luis de los Franceses, Calle San Luis, Sevilla",
      placeType: "church",
      metadata: {
        note: "Demo Sevilla"
      },
      source: "demo"
    },
    {
      id: "demo-santa-marina",
      name: "Iglesia de Santa Marina",
      lat: 37.39759,
      lon: -5.98642,
      address: "Calle San Luis, Sevilla",
      displayName: "Iglesia de Santa Marina, Calle San Luis, Sevilla",
      placeType: "church",
      metadata: {
        note: "Demo Sevilla"
      },
      source: "demo"
    },
    {
      id: "demo-omnium-sanctorum",
      name: "Omnium Sanctorum",
      lat: 37.39972,
      lon: -5.99363,
      address: "Calle Feria, Sevilla",
      displayName: "Omnium Sanctorum, Calle Feria, Sevilla",
      placeType: "church",
      metadata: {
        note: "Demo Sevilla"
      },
      source: "demo"
    }
  ];
}
