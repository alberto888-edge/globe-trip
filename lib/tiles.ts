// How sharp the satellite imagery is at each zoom, and what that costs.
//
// three-slippy-map-globe picks the tile level from a fixed ladder: level 0 at 8 globe
// radii, stepping up every time the camera halves its distance. That ladder is badly
// calibrated for this app, and the engine has no occlusion culling — it also fetches
// tiles on the far side of the globe that fall inside the view frustum — so the cost of
// one more level is nothing like the "four times" the geometry suggests.
//
// Measured against the real engine (tests/tiles.test.ts keeps these numbers honest):
//
//   altitude 1.0   default L3 =  40 tiles    one level up = 133    two up = 490
//   altitude 0.1   default L7 =   6 tiles    one level up =  15    two up =  55
//
// So a constant boost is the wrong shape: far too timid up close, where a sharp level
// costs almost nothing, and ruinous on a wide view, where it asks for hundreds of tiles
// that never finish arriving — which is exactly what left whole regions blurry.
//
// This ladder is the measured answer: for each level, the altitude below which it still
// fits a budget of ~70 tiles per view. Taken on a 390x844 phone.
const TILE_LADDER: Readonly<Record<number, number>> = {
  3: 0.8922, 4: 0.8185, 5: 0.7509, 6: 0.4108, 7: 0.2247, 8: 0.1128, 9: 0.0871,
};
const LADDER_ASPECT = 390 / 844;
export const MAX_TILE_LEVEL = 12;

/**
 * The ladder for a given viewport shape. Tile cost scales with the solid angle on
 * screen, so a wider window needs each level to start closer in; measured across phone,
 * tablet and desktop, that correction is sqrt(reference / aspect) to within a few percent.
 *
 * `tilePx` is the provider's tile size. The ladder above was measured with Mapbox @2x
 * (512 px). Standard XYZ tiles such as Esri World Imagery are 256 px: half the detail per
 * level. Up close that still looks good, but level 3 held from the whole globe down to
 * ~0.89 radii, and at medium distance islands came out smeared (Alberto's screen
 * recording, 01/10). For 256-px tiles level 3 is kept only for the farthest views.
 * Measured on the vendored engine over six regions: that band goes from ~35 to 80-130
 * tiles per view, still under what close views already cost (~200), and close views are
 * untouched.
 *
 * Every slot is filled and strictly decreasing on purpose. The engine resolves a level
 * with findIndex, and a gap makes that return -1, which it reads as "maximum level" —
 * thousands of tiles at once.
 */
export function tileThresholds(aspect: number, tilePx: 256 | 512 = 512): number[] {
  const scale = Math.sqrt(LADDER_ASPECT / Math.min(4, Math.max(0.2, aspect)));
  const out: number[] = new Array(30).fill(Infinity);
  let prev = Infinity;
  for (let L = 3; L < 30; L++) {
    const base = TILE_LADDER[L] !== undefined ? TILE_LADDER[L] * scale : prev / 2;
    out[L] = Math.min(base, prev * 0.98);
    prev = out[L];
  }
  if (tilePx === 256) out[3] = Math.max(out[3], 4 * scale);
  return out;
}

/**
 * Finds the tile engine inside the scene and sets it up once: a sharper level ladder,
 * and water painting applied to every tile the moment it is added, before it can be
 * rendered unpainted for a frame.
 */
