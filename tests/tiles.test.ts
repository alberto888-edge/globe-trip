import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
// The vendored engine the app actually ships (next.config.ts aliases the package to it).
import SlippyMap from "../lib/vendor/three-slippy-map-globe.mjs";
import { tileThresholds } from "../lib/tiles";

// The zoom ladder in GlobeCanvas was measured against this very engine. These tests run
// the real thing so the numbers can't quietly rot: a regression here means whole regions
// go blurry on a phone, which is invisible to TypeScript and to the build.

// The engine loads each tile it decides it needs; here we only want to count them.
(THREE.TextureLoader.prototype as unknown as { load: () => THREE.Texture }).load = () => new THREE.Texture();

const R = 100, D2R = Math.PI / 180;
const BUDGET = 70;

// three-globe's own placement, so the camera sits exactly where the app puts it.
const polar = (lat: number, lng: number, alt: number) => {
  const phi = (90 - lat) * D2R, th = (90 - lng) * D2R, r = R * (1 + alt);
  return new THREE.Vector3(r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
};

function probe(alt: number, w: number, h: number, lat = 40, lng = 5) {
  const m = new SlippyMap(R) as unknown as { thresholds: number[]; level: number; tileUrl: unknown; updatePov: (c: THREE.Camera) => void };
  m.thresholds = tileThresholds(w / h);
  let tiles = 0;
  m.tileUrl = () => { tiles++; return "t"; };
  const cam = new THREE.PerspectiveCamera(50, w / h, 0.1, 10000);
  cam.position.copy(polar(lat, lng, alt));
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  m.updatePov(cam);
  return { level: m.level, tiles };
}

test("la escalera está completa y es estrictamente decreciente", () => {
  for (const aspect of [0.3, 0.462, 0.695, 1.6, 2.4]) {
    const t = tileThresholds(aspect);
    assert.equal(t.length, 30);
    for (let i = 3; i < 30; i++) {
      assert.ok(Number.isFinite(t[i]) && t[i] > 0, `aspecto ${aspect}: hueco en el nivel ${i}`);
      assert.ok(t[i] < t[i - 1], `aspecto ${aspect}: el nivel ${i} no baja respecto al ${i - 1}`);
    }
    // The engine's own lookup must always resolve: findIndex returning -1 is read as
    // "maximum level", which would request thousands of tiles at once.
    for (const alt of [5, 2, 1, 0.6, 0.3, 0.15, 0.1]) {
      assert.ok(t.findIndex((x) => x && x <= alt) >= 0, `aspecto ${aspect}, altura ${alt}: la escalera no resuelve`);
    }
  }
});

test("ninguna vista se pasa del presupuesto de teselas", () => {
  // Altitudes from the whole globe down to the closest the controls allow (minDistance
  // = 1.1 radii), on the two viewport shapes that matter.
  for (const [w, h] of [[390, 844], [1440, 900]] as const) {
    for (const alt of [4.5, 3, 2, 1.4, 1.0, 0.85, 0.78, 0.6, 0.45, 0.3, 0.2, 0.15, 0.1]) {
      for (const [lat, lng] of [[40, 5], [5, 118], [30, 69]] as const) {
        const { level, tiles } = probe(alt, w, h, lat, lng);
        assert.ok(tiles <= BUDGET * 1.5, `${w}x${h} altura ${alt} (${lat},${lng}): nivel ${level} pide ${tiles} teselas`);
        assert.ok(level >= 2 && level <= 12, `${w}x${h} altura ${alt}: nivel ${level} fuera de rango`);
      }
    }
  }
});

test("al acercarse nunca se pierde detalle", () => {
  // Level must never drop as the camera comes in, or zooming in would make the map worse.
  let prev = -1;
  for (const alt of [4.5, 3, 2, 1.4, 1.0, 0.85, 0.78, 0.6, 0.45, 0.3, 0.2, 0.15, 0.1]) {
    const { level } = probe(alt, 390, 844);
    assert.ok(level >= prev, `altura ${alt}: el nivel bajó de ${prev} a ${level} al acercarse`);
    prev = level;
  }
  assert.ok(prev >= 9, `al máximo zoom sólo se llega al nivel ${prev}`);
});

// Ground truth that does not use the engine: cast a ray from every few screen pixels to the
// sphere and take the Web Mercator tile under each hit. Every one of those tiles must have
// been requested. This is what caught the engine skipping tiles bigger than the view
// (69 % of a phone screen at medium distance) and requesting nothing near the poles.
function coverage(alt: number, w: number, h: number, lat: number, lng: number) {
  const m = new SlippyMap(R) as unknown as { thresholds: number[]; level: number; tileUrl: unknown; updatePov: (c: THREE.Camera) => void };
  m.thresholds = tileThresholds(w / h);
  const asked = new Set<string>();
  m.tileUrl = (x: number, y: number, z: number) => { asked.add(`${z}/${x}/${y}`); return "t"; };
  const cam = new THREE.PerspectiveCamera(50, w / h, 0.1, 10000);
  cam.position.copy(polar(lat, lng, alt));
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  m.updatePov(cam);
  const z = m.level, n = 2 ** z;
  const ray = new THREE.Raycaster(), sphere = new THREE.Sphere(new THREE.Vector3(), R), hit = new THREE.Vector3();
  let px = 0, covered = 0;
  for (let sy = 0; sy < h; sy += 10) for (let sx = 0; sx < w; sx += 10) {
    ray.setFromCamera(new THREE.Vector2((sx / w) * 2 - 1, -(sy / h) * 2 + 1), cam);
    if (!ray.ray.intersectSphere(sphere, hit)) continue;
    px++;
    const la = Math.max(-85.05, Math.min(85.05, 90 - Math.acos(hit.y / R) / D2R)) * D2R;
    const ln = ((90 - Math.atan2(hit.z, hit.x) / D2R + 540) % 360) - 180;
    const x = Math.min(n - 1, Math.floor(((ln + 180) / 360) * n));
    const y = Math.min(n - 1, Math.floor(((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n));
    if (asked.has(`${z}/${x}/${y}`)) covered++;
  }
  return { level: z, pct: (100 * covered) / Math.max(1, px) };
}

test("todo lo que se ve en pantalla tiene su tesela pedida", () => {
  for (const [w, h] of [[390, 844], [1440, 900]] as const) {
    for (const [lat, lng] of [[12, 122], [-15, -70], [64, -18], [70, 20], [40, 5]] as const) {
      for (const alt of [3, 1.4, 1.0, 0.85, 0.6, 0.45, 0.3, 0.2, 0.12]) {
        const { level, pct } = coverage(alt, w, h, lat, lng);
        assert.ok(pct >= 99.5, `${w}x${h} (${lat},${lng}) altura ${alt}, nivel ${level}: sólo ${pct.toFixed(1)} % de la pantalla tiene tesela`);
      }
    }
  }
});

test("la cara oculta del globo no se pide", () => {
  // Whole globe on a phone: the near hemisphere at level 3 is 32 tiles at most.
  assert.ok(probe(3, 390, 844).tiles <= 36, `globo entero: ${probe(3, 390, 844).tiles} teselas`);
});
