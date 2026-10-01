import { makeEngine, camAt, visibleTiles, pending } from "./coverage";

const W = Number(process.env.W ?? 1919), H = Number(process.env.H ?? 904);
const views: [string, number, number][] = [
  ["Asia Central", 35, 70], ["Turquía", 38, 32], ["Mar Amarillo", 33, 125], ["Europa", 46, 8],
];
console.log(`viewport ${W}x${H}`);
for (const [name, lat, lng] of views) {
  for (const alt of [1.0, 0.6, 0.45, 0.35, 0.25, 0.18, 0.12]) {
    pending.length = 0;
    const m = makeEngine(W, H);
    const cam = camAt(lat, lng, alt, W, H);
    m.updatePov(cam);
    const z = m.level;
    const asked = new Set(pending.map((p) => p.url));
    const { count, px } = visibleTiles(cam, z, W, H);
    let coveredPx = 0, missing = 0;
    for (const [k, n] of count) { if (asked.has(k)) coveredPx += n; else missing++; }
    const wasted = [...asked].filter((k) => !count.has(k)).length;
    console.log(`${name.padEnd(13)} alt ${alt.toFixed(2)}  L${String(z).padEnd(2)} pedidas ${String(asked.size).padStart(3)}  visibles ${String(count.size).padStart(3)}  sin pedir ${String(missing).padStart(3)}  pantalla cubierta ${(100 * coveredPx / px).toFixed(1).padStart(5)}%  pedidas fuera de vista ${wasted}`);
  }
}
