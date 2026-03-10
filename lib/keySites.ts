import type { SuggestedPlace } from "./types";

export const KEY_SITE_SUGGESTIONS: SuggestedPlace[] = [
  {
    id: "site-catedral-sevilla",
    name: "Catedral de Sevilla",
    category: "iglesia",
    lat: 37.38604,
    lon: -5.99245,
    address: "Avenida de la Constitucion, Sevilla",
    description: "Templo principal y referencia central para recorridos cofrades."
  },
  {
    id: "site-salvador",
    name: "Iglesia del Salvador",
    category: "iglesia",
    lat: 37.38909,
    lon: -5.99278,
    address: "Plaza del Salvador, Sevilla"
  },
  {
    id: "site-macarena",
    name: "Basilica de la Macarena",
    category: "iglesia",
    lat: 37.40283,
    lon: -5.98884,
    address: "Calle Becquer, Sevilla"
  },
  {
    id: "site-gran-poder",
    name: "Basilica del Gran Poder",
    category: "cofrade",
    lat: 37.3949,
    lon: -5.99768,
    address: "Plaza de San Lorenzo, Sevilla",
    description: "Zona de alta actividad de hermandades."
  },
  {
    id: "site-capilla-marineros",
    name: "Capilla de los Marineros",
    category: "cofrade",
    lat: 37.38303,
    lon: -6.00108,
    address: "Calle Pureza, Triana"
  },
  {
    id: "site-casa-hermandad-san-gonzalo",
    name: "Casa Hermandad San Gonzalo",
    category: "cofrade",
    lat: 37.3857,
    lon: -6.0102,
    address: "Barrio de Leon, Sevilla"
  },
  {
    id: "site-cerveceria-internacional",
    name: "Cerveceria Internacional",
    category: "cerveceria",
    lat: 37.38688,
    lon: -5.99352,
    address: "Calle Gamazo, Sevilla"
  },
  {
    id: "site-bodeguita-romero",
    name: "Bodeguita Romero",
    category: "cerveceria",
    lat: 37.38771,
    lon: -5.99636,
    address: "Calle Harinas, Sevilla"
  },
  {
    id: "site-cerveceria-puerta-carne",
    name: "Cerveceria Puerta de la Carne",
    category: "cerveceria",
    lat: 37.38286,
    lon: -5.98617,
    address: "Puerta de la Carne, Sevilla"
  }
];

export const SUGGESTED_CATEGORY_LABELS: Record<SuggestedPlace["category"], string> = {
  iglesia: "Iglesias",
  cofrade: "Interes cofrade",
  cerveceria: "Cervecerias"
};
