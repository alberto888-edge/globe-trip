// Small spherical helpers shared by the UI (camera framing) and the server (sanity checks).

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export interface LatLng { lat: number; lng: number }

export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function routeKm(stops: LatLng[]): number {
  let km = 0;
  for (let i = 0; i < stops.length - 1; i++) km += distanceKm(stops[i], stops[i + 1]);
  return km;
}

/** Spherical centroid: average of unit vectors, projected back to lat/lng. */
export function centroid(points: LatLng[]): LatLng {
  let x = 0, y = 0, z = 0;
  for (const p of points) {
    x += Math.cos(rad(p.lat)) * Math.cos(rad(p.lng));
    y += Math.cos(rad(p.lat)) * Math.sin(rad(p.lng));
    z += Math.sin(rad(p.lat));
  }
  const hyp = Math.hypot(x, y);
  return { lat: deg(Math.atan2(z, hyp)), lng: deg(Math.atan2(y, x)) };
}

/** Largest arc (in degrees) from `center` (default: centroid) to any point. */
export function spreadDeg(points: LatLng[], center: LatLng = centroid(points)): number {
  if (!points.length) return 0;
  return Math.max(...points.map((p) => distanceKm(center, p))) / 111.19;
}

/**
 * View centre and radius that frame a set of points. The plain centroid is
 * pulled toward clusters (three stops around Kioto, one in Tokio), so we
 * centre between the two points furthest apart instead, then widen the
 * radius to cover anything that still falls outside.
 */
export function frame(points: LatLng[]): { center: LatLng; spread: number } {
  if (points.length <= 1) return { center: points[0] ?? { lat: 0, lng: 0 }, spread: 0 };
  const c0 = centroid(points);
  const far = (from: LatLng) => points.reduce((a, p) => (distanceKm(from, p) > distanceKm(from, a) ? p : a), points[0]);
  const a = far(c0), b = far(a);
  const center = centroid([a, b]);
  return { center, spread: spreadDeg(points, center) };
}

/**
 * Camera altitude (globe radii above the surface) so that every point within
 * `spread` degrees of the view centre fits in a half-angle of `halfFov` radians.
 * A point at arc φ sits R·sinφ off-axis and R·cosφ toward the camera, so the
 * camera needs d ≥ R·cosφ + R·sinφ / tan(halfFov).
 */
export function altitudeForSpread(spread: number, halfFov: number, margin = 1.45): number {
  const phi = Math.min(Math.max(spread, 0.6), 75) * (Math.PI / 180);
  const d = Math.cos(phi) + (Math.sin(phi) * margin) / Math.tan(halfFov);
  return Math.max(0.08, d - 1);
}

/** Altitude at which the whole globe fits in a half-angle of `halfFov` radians. */
export function wholeGlobeAltitude(halfFov: number, fill = 0.86): number {
  return 1 / Math.sin(halfFov * fill) - 1;
}

// ---------------------------------------------------------------- stop order

const pathKm = (pts: { lat: number; lng: number }[], order: number[]) => {
  let s = 0;
  for (let i = 1; i < order.length; i++) s += distanceKm(pts[order[i - 1]], pts[order[i]]);
  return s;
};

/** Shortest open path through all points (exact up to 8 points, 2-opt above), optionally starting at `start`. */
function shortestPath(pts: { lat: number; lng: number }[], start?: number): number[] {
  const n = pts.length;
  const idx = [...Array(n).keys()];
  if (n <= 8) {
    let best = idx, bestKm = Infinity;
    const rest = start === undefined ? idx : idx.filter((i) => i !== start);
    const permute = (arr: number[], k: number) => {
      if (k === arr.length) {
        const order = start === undefined ? arr : [start, ...arr];
        const km = pathKm(pts, order);
        if (km < bestKm) { bestKm = km; best = order.slice(); }
        return;
      }
      for (let i = k; i < arr.length; i++) {
        [arr[k], arr[i]] = [arr[i], arr[k]];
        permute(arr, k + 1);
        [arr[k], arr[i]] = [arr[i], arr[k]];
      }
    };
    permute(rest.slice(), 0);
    return best;
  }
  const order = start === undefined ? idx : [start, ...idx.filter((i) => i !== start)];
  for (let improved = true; improved;) {
    improved = false;
    for (let i = start === undefined ? 0 : 1; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const cand = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)];
        if (pathKm(pts, cand) < pathKm(pts, order) - 1) { order.splice(0, n, ...cand); improved = true; }
      }
    }
  }
  return order;
}

/** Does the path cross over itself? (flat lat/lng test, fine at trip scale) */
function selfCrossing(pts: { lat: number; lng: number }[]): boolean {
  const ccw = (a: { lat: number; lng: number }, b: { lat: number; lng: number }, c: { lat: number; lng: number }) =>
    (c.lat - a.lat) * (b.lng - a.lng) > (b.lat - a.lat) * (c.lng - a.lng);
  for (let i = 0; i < pts.length - 1; i++) {
    for (let j = i + 2; j < pts.length - 1; j++) {
      const [a, b, c, d] = [pts[i], pts[i + 1], pts[j], pts[j + 1]];
      if (Math.abs(a.lng - b.lng) > 180 || Math.abs(c.lng - d.lng) > 180) continue;
      if (ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d)) return true;
    }
  }
  return false;
}

/**
 * Reorders stops when the trip zig-zags: the path crosses over itself (like
 * Damasco → Palmira → Alepo → back down to Bosra) or is at least 30% longer
 * than needed. Otherwise the original order is kept, since it may be deliberate
 * (e.g. climbing slowly to altitude in Peru). Starts where the original started
 * (usually the arrival airport) unless starting elsewhere is clearly shorter.
 */
export function orderStops<T extends { lat: number; lng: number }>(stops: T[]): T[] {
  if (stops.length < 3) return stops;
  const idx = [...stops.keys()];
  const original = pathKm(stops, idx);
  const fixed = shortestPath(stops, 0);
  let free = shortestPath(stops);
  if (distanceKm(stops[free[free.length - 1]], stops[0]) < distanceKm(stops[free[0]], stops[0])) free = free.reverse();
  const fixedKm = pathKm(stops, fixed), freeKm = pathKm(stops, free);
  const best = freeKm < fixedKm * 0.85 ? free : fixed;
  const saving = 1 - pathKm(stops, best) / Math.max(1, original);
  if (saving < 0.05 || (!selfCrossing(stops) && saving < 0.3)) return stops;
  return best.map((i) => stops[i]);
}
