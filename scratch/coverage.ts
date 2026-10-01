// Measures the REAL engine against an independent ground truth.
// Ground truth: raycast a grid of screen pixels onto the sphere and compute which tile
// at the engine's chosen level each visible pixel falls in. Then compare with the tiles
// the engine actually asked for. No app logic is used for the ground truth.
import * as THREE from "three";
import SlippyMap from "three-slippy-map-globe";
import { tileThresholds } from "../lib/tiles";

const R = 100, D2R = Math.PI / 180;
const polar = (lat: number, lng: number, alt: number) => {
  const phi = (90 - lat) * D2R, th = (90 - lng) * D2R, r = R * (1 + alt);
  return new THREE.Vector3(r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
};

type Req = { url: string; onLoad: (t: THREE.Texture) => void; onError?: (e: unknown) => void };
export const pending: Req[] = [];
(THREE.TextureLoader.prototype as any).load = function (url: string, onLoad: any, _p: any, onError: any) {
  pending.push({ url, onLoad, onError });
  return new THREE.Texture();
};

export function makeEngine(w: number, h: number) {
  const m = new SlippyMap(R) as any;
  m.thresholds = tileThresholds(w / h);
  m.maxLevel = 12;
  m.tileUrl = (x: number, y: number, z: number) => `${z}/${x}/${y}`;
  m.updateMatrixWorld(true);
  return m;
}

export function camAt(lat: number, lng: number, alt: number, w: number, h: number) {
  const cam = new THREE.PerspectiveCamera(50, w / h, 0.1, 10000);
  cam.position.copy(polar(lat, lng, alt));
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  return cam;
}

// Web Mercator tile for a lat/lng at level z (what Mapbox serves).
function tileOf(lat: number, lng: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latR = Math.max(-85.0511, Math.min(85.0511, lat)) * D2R;
  const y = Math.floor(((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n);
  return `${z}/${Math.min(n - 1, Math.max(0, x))}/${Math.min(n - 1, Math.max(0, y))}`;
}

export function visibleTiles(cam: THREE.PerspectiveCamera, z: number, w: number, h: number, step = 8) {
  const ray = new THREE.Raycaster();
  const sphere = new THREE.Sphere(new THREE.Vector3(), R);
  const hit = new THREE.Vector3();
  const count = new Map<string, number>();
  let px = 0;
  for (let sy = 0; sy < h; sy += step) for (let sx = 0; sx < w; sx += step) {
    ray.setFromCamera(new THREE.Vector2((sx / w) * 2 - 1, -(sy / h) * 2 + 1), cam);
    if (!ray.ray.intersectSphere(sphere, hit)) continue;
    px++;
    // three-globe convention (inverse of polar above)
    const lat = 90 - Math.acos(hit.y / R) / D2R;
    const lng = 90 - Math.atan2(hit.z, hit.x) / D2R;
    const k = tileOf(lat, ((lng + 540) % 360) - 180, z);
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  return { count, px };
}
