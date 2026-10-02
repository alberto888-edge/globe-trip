import { test } from "node:test";
import assert from "node:assert/strict";
// No GT_LANG: outside the browser the app defaults to English, as for any non-Spanish browser.
import { searchPlaces, visibleLabels, countryName } from "../lib/labels.ts";
import { DEMO_ROUTES, EXAMPLES } from "../lib/demo.ts";
import { READY_TRIPS, readyRoute } from "../lib/trips.ts";
import { dayLabels } from "../lib/lang.ts";
import { riskLabel, officialAdviceUrl } from "../lib/risk.ts";

test("en inglés el globo usa nombres ingleses y el buscador entiende los dos idiomas", () => {
  const japan = visibleLabels({ lat: 35, lng: 137 }, 0.3).map((l) => l.name);
  assert.ok(japan.includes("Tokyo") && japan.includes("Osaka"), japan.join(","));
  assert.equal(countryName("JP"), "Japan");
  assert.equal(countryName("ES"), "Spain");
  assert.equal(searchPlaces("London")[0]?.name, "London");
  assert.equal(searchPlaces("Londres")[0]?.name, "London", "un nombre en español también encuentra el sitio");
  assert.equal(searchPlaces("Ha Long")[0]?.name, "Ha Long Bay");
});

test("en inglés los ejemplos y los viajes listos están en inglés", () => {
  assert.deepEqual(EXAMPLES.map((e) => e.label), ["Africa", "Japan", "Andes", "Iceland"]);
  assert.equal(DEMO_ROUTES.find((r) => r.id === "demo-japon")?.stops[0].name, "Tokyo");
  const peru = readyRoute("peru", 2)!;
  assert.equal(peru.name, "Peru: Lima to Machu Picchu");
  assert.equal(peru.stops[3].name, "Cusco");
  assert.equal(peru.budget!.breakdown[0].label, "Flights");
  assert.equal(peru.budget!.total, readyRoute("peru", 1)!.budget!.total * 2);
  // Every ready trip has a full English version: same number of stops, budget lines and no Spanish left.
  for (const t of READY_TRIPS) {
    const r = readyRoute(t.id)!;
    assert.ok(!/[ñ¿¡]|\b(días|viaje|playa|ciudad)\b/i.test(JSON.stringify({ n: r.name, s: r.summary, st: r.stops.map((x) => [x.sub, x.note]), b: r.budget, tips: r.tips, risk: r.risks })), `${t.id} still has Spanish`);
  }
});

test("etiquetas de días, riesgo y aviso oficial en inglés", () => {
  assert.deepEqual(dayLabels([1, 3, 2], "en"), ["Day 1", "Days 2–4", "Days 5–6"]);
  assert.deepEqual(dayLabels([1, 3], "es"), ["Día 1", "Días 2–4"]);
  assert.equal(riskLabel(4, "en"), "Do not travel");
  assert.equal(officialAdviceUrl("Bosnia and Herzegovina", "en"), "https://www.gov.uk/foreign-travel-advice/bosnia-and-herzegovina");
});
