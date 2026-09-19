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
