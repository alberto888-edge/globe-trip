// Builds public/borders.json: land borders between countries (Natural Earth 1:50m via world-atlas),
// as a list of polylines [lng, lat, lng, lat, …] rounded to ~1 km. Drawn as thin lines on the globe.
// Run once (output is committed):  cd scripts && npm i world-atlas topojson-client && node build-borders.mjs
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const topo = require("world-atlas/countries-50m.json");
const { mesh } = require("topojson-client");

const lines = mesh(topo, topo.objects.countries, (a, b) => a !== b).coordinates;
const r = (n) => Math.round(n * 100) / 100;
const out = lines
  .map((l) => {
    const flat = [];
    for (const [lng, lat] of l) {
      const x = r(lng), y = r(lat);
      if (flat.length && flat[flat.length - 2] === x && flat[flat.length - 1] === y) continue; // same point after rounding
      flat.push(x, y);
    }
    return flat;
  })
  .filter((l) => l.length >= 4);
writeFileSync(new URL("../public/borders.json", import.meta.url), JSON.stringify(out));
console.log(`${out.length} border lines, ${out.reduce((s, l) => s + l.length / 2, 0)} points`);
