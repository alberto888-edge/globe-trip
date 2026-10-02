import type { Pin, Route } from "./types";
import { currentLang } from "./lang";

// Hand-written example routes. They power the example buttons under the link box,
// so people can see the whole flow without spending an analysis. One set per language.
const ES_ROUTES: Route[] = [
  {
    id: "demo-africa", name: "Aventura en África", days: 8,
    stops: [
      { name: "Marrakech", sub: "Medina y zocos", when: "Días 1–2", note: "Medina, palacio Bahía y atardecer en la plaza Jemaa el-Fna.", lat: 31.63, lng: -7.99 },
      { name: "Serengeti", sub: "Safari al amanecer", when: "Días 3–5", note: "Safari en 4x4 siguiendo la gran migración y noche de acampada.", lat: -2.33, lng: 34.83 },
      { name: "Zanzíbar", sub: "Stone Town y playa", when: "Días 6–7", note: "Callejones de Stone Town, tour de especias y playa en Nungwi.", lat: -6.16, lng: 39.19 },
      { name: "Ciudad del Cabo", sub: "Table Mountain", when: "Día 8", note: "Subida a Table Mountain y Cabo de Buena Esperanza.", lat: -33.92, lng: 18.42 },
    ],
  },
  {
    id: "demo-japon", name: "Japón en 10 días", days: 10,
    stops: [
      { name: "Tokio", sub: "Shibuya y Asakusa", when: "Días 1–3", note: "Cruce de Shibuya, templo Senso-ji y noche en Shinjuku.", lat: 35.68, lng: 139.69 },
      { name: "Hakone", sub: "Vistas al Fuji", when: "Día 4", note: "Onsen y crucero por el lago Ashi con el Fuji al fondo.", lat: 35.23, lng: 139.11 },
      { name: "Kioto", sub: "Templos y geishas", when: "Días 5–7", note: "Fushimi Inari al amanecer y paseo por Gion al atardecer.", lat: 35.01, lng: 135.77 },
      { name: "Nara", sub: "Ciervos y Todai-ji", when: "Día 8", note: "Excursión de un día al parque de Nara y el gran Buda.", lat: 34.69, lng: 135.8 },
      { name: "Osaka", sub: "Comer en Dotonbori", when: "Días 9–10", note: "Takoyaki y okonomiyaki en Dotonbori, castillo de Osaka.", lat: 34.69, lng: 135.5 },
    ],
  },
  {
    id: "demo-andes", name: "Andes y Patagonia", days: 12,
    stops: [
      { name: "Lima", sub: "Barranco y ceviche", when: "Días 1–2", note: "Barranco, Miraflores y el mejor ceviche de tu vida.", lat: -12.05, lng: -77.04 },
      { name: "Cusco", sub: "Machu Picchu", when: "Días 3–6", note: "Valle Sagrado, Montaña de Colores y Machu Picchu.", lat: -13.53, lng: -71.97 },
      { name: "Salar de Uyuni", sub: "El espejo del cielo", when: "Días 7–9", note: "Tour 4x4 de tres días por el salar y las lagunas de colores.", lat: -20.13, lng: -67.49 },
      { name: "El Chaltén", sub: "Fitz Roy", when: "Días 10–12", note: "Trekking a la Laguna de los Tres con vistas al Fitz Roy.", lat: -49.33, lng: -72.89 },
    ],
  },
  {
    id: "demo-islandia", name: "Islandia en ruta", days: 6,
    stops: [
      { name: "Reikiavik", sub: "Círculo Dorado", when: "Día 1", note: "Hallgrímskirkja y el Círculo Dorado: Þingvellir, Geysir y Gullfoss.", lat: 64.15, lng: -21.94 },
      { name: "Vík", sub: "Playa negra", when: "Días 2–3", note: "Cascadas de Seljalandsfoss y Skógafoss, playa de Reynisfjara.", lat: 63.42, lng: -19.01 },
      { name: "Jökulsárlón", sub: "Laguna glaciar", when: "Día 4", note: "Laguna glaciar entre icebergs y la Diamond Beach.", lat: 64.05, lng: -16.18 },
      { name: "Akureyri", sub: "Capital del norte", when: "Días 5–6", note: "Lago Mývatn, cascada de Goðafoss y avistamiento de ballenas.", lat: 65.68, lng: -18.09 },
    ],
  },
];

const EN_ROUTES: Route[] = [
  {
    id: "demo-africa", name: "African Adventure", days: 8,
    stops: [
      { name: "Marrakesh", sub: "Medina and souks", when: "Days 1–2", note: "The medina, Bahia Palace and sunset over Jemaa el-Fnaa square.", lat: 31.63, lng: -7.99 },
      { name: "Serengeti", sub: "Sunrise safari", when: "Days 3–5", note: "4x4 safari following the Great Migration and a night under canvas.", lat: -2.33, lng: 34.83 },
      { name: "Zanzibar", sub: "Stone Town and beaches", when: "Days 6–7", note: "Stone Town's alleys, a spice tour and the beach at Nungwi.", lat: -6.16, lng: 39.19 },
      { name: "Cape Town", sub: "Table Mountain", when: "Day 8", note: "Up Table Mountain and out to the Cape of Good Hope.", lat: -33.92, lng: 18.42 },
    ],
  },
  {
    id: "demo-japon", name: "Japan in 10 Days", days: 10,
    stops: [
      { name: "Tokyo", sub: "Shibuya and Asakusa", when: "Days 1–3", note: "Shibuya Crossing, Senso-ji temple and a night in Shinjuku.", lat: 35.68, lng: 139.69 },
      { name: "Hakone", sub: "Mount Fuji views", when: "Day 4", note: "Hot springs and a cruise on Lake Ashi with Fuji behind.", lat: 35.23, lng: 139.11 },
      { name: "Kyoto", sub: "Temples and geishas", when: "Days 5–7", note: "Fushimi Inari at dawn and a stroll through Gion at dusk.", lat: 35.01, lng: 135.77 },
      { name: "Nara", sub: "Deer and Todai-ji", when: "Day 8", note: "A day trip to Nara Park and the Great Buddha.", lat: 34.69, lng: 135.8 },
      { name: "Osaka", sub: "Eat in Dotonbori", when: "Days 9–10", note: "Takoyaki and okonomiyaki in Dotonbori, then Osaka Castle.", lat: 34.69, lng: 135.5 },
    ],
  },
  {
    id: "demo-andes", name: "Andes and Patagonia", days: 12,
    stops: [
      { name: "Lima", sub: "Barranco and ceviche", when: "Days 1–2", note: "Barranco, Miraflores and the best ceviche of your life.", lat: -12.05, lng: -77.04 },
      { name: "Cusco", sub: "Machu Picchu", when: "Days 3–6", note: "The Sacred Valley, Rainbow Mountain and Machu Picchu.", lat: -13.53, lng: -71.97 },
      { name: "Uyuni Salt Flat", sub: "The mirror of the sky", when: "Days 7–9", note: "A three-day 4x4 tour across the salt flat and its coloured lagoons.", lat: -20.13, lng: -67.49 },
      { name: "El Chaltén", sub: "Fitz Roy", when: "Days 10–12", note: "Trek to Laguna de los Tres with Fitz Roy towering above.", lat: -49.33, lng: -72.89 },
    ],
  },
  {
    id: "demo-islandia", name: "Iceland by Road", days: 6,
    stops: [
      { name: "Reykjavík", sub: "Golden Circle", when: "Day 1", note: "Hallgrímskirkja and the Golden Circle: Þingvellir, Geysir and Gullfoss.", lat: 64.15, lng: -21.94 },
      { name: "Vík", sub: "Black sand beach", when: "Days 2–3", note: "Seljalandsfoss and Skógafoss waterfalls, Reynisfjara beach.", lat: 63.42, lng: -19.01 },
      { name: "Jökulsárlón", sub: "Glacier lagoon", when: "Day 4", note: "A glacier lagoon full of icebergs and Diamond Beach.", lat: 64.05, lng: -16.18 },
      { name: "Akureyri", sub: "Capital of the north", when: "Days 5–6", note: "Lake Mývatn, Goðafoss waterfall and whale watching.", lat: 65.68, lng: -18.09 },
    ],
  },
];

const EN = currentLang() === "en";
export const DEMO_ROUTES: Route[] = EN ? EN_ROUTES : ES_ROUTES;

export const EXAMPLES = EN
  ? [{ label: "Africa", routeId: "demo-africa" }, { label: "Japan", routeId: "demo-japon" }, { label: "Andes", routeId: "demo-andes" }, { label: "Iceland", routeId: "demo-islandia" }]
  : [{ label: "África", routeId: "demo-africa" }, { label: "Japón", routeId: "demo-japon" }, { label: "Andes", routeId: "demo-andes" }, { label: "Islandia", routeId: "demo-islandia" }];

export const SEED_PINS: Pin[] = [
  { id: "s1", name: EN ? "Lisbon" : "Lisboa", lat: 38.72, lng: -9.14, type: "visitado" },
  { id: "s2", name: EN ? "Rome" : "Roma", lat: 41.9, lng: 12.5, type: "visitado" },
  { id: "s3", name: EN ? "New York" : "Nueva York", lat: 40.71, lng: -74.0, type: "visitado" },
  { id: "s4", name: EN ? "Kyoto" : "Kioto", lat: 35.01, lng: 135.77, type: "wishlist" },
  { id: "s5", name: EN ? "Mexico City" : "Ciudad de México", lat: 19.43, lng: -99.13, type: "wishlist" },
];
