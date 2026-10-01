# three-slippy-map-globe (vendored)

Copy of `three-slippy-map-globe@1.0.6` (`dist/three-slippy-map-globe.mjs`, MIT, see
`three-slippy-map-globe.LICENSE`), used by `three-globe` to load the satellite tiles.
`next.config.ts` points every import of the package here.

Three changes, all marked `Globe Trip patch` in the file. Each one was found by measuring
the real engine against a ground truth that does not use the engine (a raycast from every
screen pixel to the sphere, then the Web Mercator tile under it):

1. **Horizon culling.** The engine kept every tile inside the view frustum, including the
   far side of the globe. Wide views asked for twice the tiles they show.
2. **Bounding-sphere visibility.** A tile counted as visible only if its centre or one of
   its four corners was on screen. A tile bigger than the view has all five off screen
   while covering it, so it was never requested and the low-res base texture showed
   through. On a phone at medium distance only 69 % of the screen got a tile.
3. **No search past the poles.** On levels above 7 the search box could pass ±90°, the
   tile lookup returned NaN and nothing at all was requested (0 % of the screen over
   Iceland at level 8).

Known and not fixed here: a tile whose request fails is never requested again.

To upgrade the package, copy the new `dist/*.mjs` here and re-apply the three changes;
`tests/tiles.test.ts` fails if any of them is lost.
