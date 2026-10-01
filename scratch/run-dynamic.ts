// Dynamic scenario on the REAL engine: a wheel zoom from a wide view down to a country,
// with simulated network latency and, optionally, some failed tiles. At the end we
// measure, for every visible pixel, which level is actually showing there.
import { makeEngine, camAt, visibleTiles, pending } from "./coverage";
import * as THREE from "three";

const W = 1919, H = 904;
const FAIL = Number(process.env.FAIL ?? 0);       // fraction of tiles that error once
const lat = 38, lng = 32;

function run(label: string, fail: number) {
  pending.length = 0;
  const m = makeEngine(W, H);
  const inflight: { req: any; at: number; fail: boolean }[] = [];
  let t = 0, seen = 0, failedUrls: string[] = [];
  const rnd = mulberry(7);
  const pump = () => {
    while (seen < pending.length) {
      const req = pending[seen++];
      inflight.push({ req, at: t + 150 + rnd() * 900, fail: rnd() < fail });
    }
    for (let i = inflight.length - 1; i >= 0; i--) {
      const f = inflight[i];
      if (f.at > t) continue;
      inflight.splice(i, 1);
      if (f.fail) { failedUrls.push(f.req.url); f.req.onError?.(new Error("x")); }
      else f.req.onLoad(new THREE.Texture());
    }
  };
  // zoom 1.0 -> 0.3 over 1.2 s, frame every 16 ms, then wait 5 s with the camera still,
  // then nudge the camera (a tiny pan) and wait again: does anything get retried?
  const path: number[] = [];
  for (let i = 0; i <= 75; i++) path.push(1.0 - (0.7 * i) / 75);
  for (const alt of path) { m.updatePov(camAt(lat, lng, alt, W, H)); pump(); t += 16; }
  for (let i = 0; i < 320; i++) { pump(); t += 16; }
  const before = pending.length;
  for (let i = 0; i < 30; i++) { m.updatePov(camAt(lat + i * 0.01, lng, 0.3, W, H)); pump(); t += 16; }
  for (let i = 0; i < 320; i++) { pump(); t += 16; }
  const retried = pending.slice(before).filter((p) => failedUrls.includes(p.url)).length;

  // What is on screen: for each visible pixel, the highest level whose tile there is loaded.
  const cam = camAt(lat + 0.29, lng, 0.3, W, H);
  const loaded = new Set<string>();
  m.traverse((o: any) => { if (o.isMesh && o.material?.map && o.parent === m && o.__url) loaded.add(o.__url); });
  return { m, failed: failedUrls.length, retried, requests: pending.length };
}

function mulberry(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Tag meshes with their URL so we can see which level covers which pixel.
const origLoad = (THREE.TextureLoader.prototype as any).load;
(THREE.TextureLoader.prototype as any).load = function (url: string, onLoad: any, p: any, onError: any) {
  return origLoad.call(this, url, (tex: THREE.Texture) => { (tex as any).__url = url; onLoad(tex); }, p, onError);
};

for (const fail of [0, FAIL || 0.1]) {
  const { m, failed, retried, requests } = run(`fail ${fail}`, fail);
  const cam = camAt(38.29, 32, 0.3, W, H);
  const byLevel: Record<string, number> = {};
  const urls = new Set<string>();
  m.children.forEach((c: any) => { const u = c.material?.map?.__url; if (u) urls.add(u); });
  // per pixel: best loaded level
  let total = 0;
  for (let z = 12; z >= 0; z--) {} // placeholder
  const levels = [...new Set([...urls].map((u) => +u.split("/")[0]))].sort((a, b) => b - a);
  const vis = new Map<number, Map<string, number>>();
  for (const z of levels) vis.set(z, visibleTiles(cam, z, W, H).count);
  const { px } = visibleTiles(cam, levels[0] ?? 3, W, H);
  // sample pixels again, cheap: reuse counts per level is not per-pixel, so do it directly
  const ray = new THREE.Raycaster(), sph = new THREE.Sphere(new THREE.Vector3(), 100), hit = new THREE.Vector3();
  for (let sy = 0; sy < H; sy += 8) for (let sx = 0; sx < W; sx += 8) {
    ray.setFromCamera(new THREE.Vector2((sx / W) * 2 - 1, -(sy / H) * 2 + 1), cam);
    if (!ray.ray.intersectSphere(sph, hit)) continue;
    total++;
    const la = 90 - Math.acos(hit.y / 100) * 180 / Math.PI;
    const ln = ((90 - Math.atan2(hit.z, hit.x) * 180 / Math.PI) + 540) % 360 - 180;
    let got = "nada";
    for (const z of levels) {
      const n = 2 ** z, x = Math.floor(((ln + 180) / 360) * n), r = la * Math.PI / 180;
      const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
      if (urls.has(`${z}/${x}/${y}`)) { got = `L${z}`; break; }
    }
    byLevel[got] = (byLevel[got] ?? 0) + 1;
  }
  const share = Object.entries(byLevel).sort().map(([k, v]) => `${k} ${(100 * v / total).toFixed(1)}%`).join(" · ");
  console.log(`fallo ${String(fail).padEnd(4)} peticiones ${requests}  fallidas ${failed}  reintentadas tras mover ${retried}  nivel final L${m.level}  pantalla: ${share}`);
}
