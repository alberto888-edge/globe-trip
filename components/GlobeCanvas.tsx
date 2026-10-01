"use client";
// The 3D Earth. Full-screen, transparent over the page background.
// Zoom is a real camera dolly (OrbitControls with damping); markers are HTML
// so they stay the same size at any zoom; camera moves are eased flights.
import Globe, { type GlobeMethods } from "react-globe.gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { Pin, Route } from "@/lib/types";
import { altitudeForSpread, distanceKm, wholeGlobeAltitude } from "@/lib/geo";
import { loadMorePlaces, visibleLabels, type PlaceLabel } from "@/lib/labels";
import { MAX_TILE_LEVEL, tileThresholds } from "@/lib/tiles";

// ---------------------------------------------------------------- the ocean
//
// Satellite tiles are the wrong source for water. Mapbox has real detail over land at
// every zoom, but over sea it has almost none: past a certain level the tiles are flat
// blue with JPEG blocks, and those blocks were the patchwork showing up on screen.
//
// So the sea stops being photographed and starts being painted. Two global textures the
// project already ships decide it, sampled by real latitude and longitude so the result
// is identical at any zoom level:
//
//   · earth-water-mask.png — authoritative land/sea. Colour alone can't do this job:
//     shadowed mountain slopes and dark forest also read as blue, which is what used to
//     bleed sea over Kyrgyzstan and the Alps. The mask is coarse (1024×512, ~39 km per
//     texel), so it only decides *regions*, never the shoreline.
//   · earth.jpg — Blue Marble, which carries real bathymetry and, being one smooth
//     global image, has no tile blocks anywhere. It drives the colour of open water.
//
// Within roughly a texel of the coast the tile's own pixels still rule, so shorelines,
// reefs and lagoons stay exactly as sharp as the satellite imagery allows.
const OCEAN_UNIFORMS = `
uniform sampler2D uSeaMask;
uniform sampler2D uSeaRef;
uniform vec2 uSeaMaskTexel;
varying vec3 vGlobePos;
`;

// lat/lng from object space. three-globe places a point at
// x = r·sin(90°−lat)·cos(90°−lng), y = r·cos(90°−lat), z = r·sin(90°−lat)·sin(90°−lng),
// so latitude comes straight off y and longitude off atan(z, −x) minus a quarter turn.
const OCEAN_FRAGMENT = `
#ifdef USE_MAP
{
  float gr = max(length(vGlobePos), 1e-4);
  float lat = degrees(asin(clamp(vGlobePos.y / gr, -1.0, 1.0)));
  float lng = degrees(atan(vGlobePos.z, -vGlobePos.x)) - 90.0;
  lng = mod(lng + 540.0, 360.0) - 180.0;
  vec2 guv = vec2((lng + 180.0) / 360.0, (lat + 90.0) / 180.0);

  float sea = texture2D(uSeaMask, guv).r;
  // Sea here and sea one texel in every direction means open water, far enough from any
  // coast that the painted colour can take over completely.
  float openRaw = min(
    min(texture2D(uSeaMask, guv + vec2(uSeaMaskTexel.x, 0.0)).r,
        texture2D(uSeaMask, guv - vec2(uSeaMaskTexel.x, 0.0)).r),
    min(texture2D(uSeaMask, guv + vec2(0.0, uSeaMaskTexel.y)).r,
        texture2D(uSeaMask, guv - vec2(0.0, uSeaMaskTexel.y)).r)) * sea;
  float open = smoothstep(0.45, 0.95, openRaw);

  vec3 sc = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(1.0 / 2.2));
  float lum = dot(sc, vec3(0.3, 0.59, 0.11));

  // Inside the coastal band the tile decides, by colour, what is water. Gated by the
  // mask, so it can never fire inland.
  float fine = smoothstep(0.012, 0.07, sc.b - sc.r)
             * smoothstep(-0.02, 0.03, sc.b - sc.g)
             * (1.0 - smoothstep(0.32, 0.60, lum))
             * smoothstep(0.25, 0.75, sea);

  vec3 ref = pow(max(texture2D(uSeaRef, guv).rgb, vec3(0.0)), vec3(1.0 / 2.2));
  float depth = smoothstep(0.011, 0.46, dot(ref, vec3(0.3, 0.59, 0.11)));
  vec3 painted = depth < 0.5
    ? mix(vec3(0.050, 0.145, 0.285), vec3(0.095, 0.275, 0.445), depth * 2.0)
    : mix(vec3(0.095, 0.275, 0.445), vec3(0.235, 0.510, 0.635), depth * 2.0 - 1.0);
  // Near the coast, carry the tile's own colour variation into the paint: that is the
  // surf, the reefs and the river plumes, and it is worth keeping.
  painted += (sc - lum) * 0.40 * (1.0 - open);

  float water = max(fine, open);
  sc = mix(sc, clamp(painted, 0.0, 1.0), water);
  diffuseColor.rgb = pow(sc, vec3(2.2));
}
#endif
`;

/** Teaches one textured material to paint its own water. Safe to call twice. */
function paintOcean(mat: THREE.Material, mask: THREE.Texture, ref: THREE.Texture) {
  const m = mat as THREE.Material & { __ocean?: boolean };
  if (m.__ocean) return;
  m.__ocean = true;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSeaMask = { value: mask };
    shader.uniforms.uSeaRef = { value: ref };
    shader.uniforms.uSeaMaskTexel = { value: new THREE.Vector2(1 / 1024, 1 / 512) };
    shader.vertexShader = shader.vertexShader
      .replace("void main() {", "varying vec3 vGlobePos;\nvoid main() {")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n  vGlobePos = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", `${OCEAN_UNIFORMS}\nvoid main() {`)
      .replace("#include <map_fragment>", `#include <map_fragment>\n${OCEAN_FRAGMENT}`);
  };
  m.needsUpdate = true;
}

/** Where the camera should fly. `spread` = degrees of arc that must fit on screen; `home` = whole globe. */
export interface Focus { lat: number; lng: number; spread?: number; home?: boolean; key: number; ms?: number }

interface Props {
  pins: Pin[];
  route: Route | null;
  trips?: Route[]; // saved trips, drawn as glowing traces when they aren't the open route
  revealed: number; // how many route stops are visible (staged reveal)
  focus: Focus | null;
  bottomInset: number; // px covered by the bottom UI, so the globe sits above it
  onGlobeTap: (lat: number, lng: number) => void;
  onPinTap: (id: string) => void;
  onStopTap: (index: number) => void;
  onLabelTap: (label: PlaceLabel) => void;
  onTripTap?: (id: string) => void;
  onReady?: () => void;
  onInteract?: () => void;
}

type Marker =
  | { kind: "pin"; id: string; lat: number; lng: number; type: Pin["type"]; name: string }
  | { kind: "stop"; id: string; lat: number; lng: number; index: number; name: string }
  | { kind: "dot"; id: string; lat: number; lng: number; name: string; tripId: string; tripName: string; color: string; first: boolean }
  | PlaceLabel;

// Neon colours for saved trips, one per trip, so overlapping trips stay apart.
const TRIP_COLORS = ["#3ff0ff", "#ff5fd7", "#b8ff3c", "#ffcf3f", "#9d8bff", "#ff8a4c"];
const rgbOf = (hex: string) => { const c = new THREE.Color(hex); return `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`; };

const HOME = { lat: 28, lng: 8 };
const R = 100; // globe.gl radius in scene units
const TOPBAR = 70; // px reserved at the top for the header

// Satellite imagery at every zoom level (one consistent look, sharp up close).
// Either a full XYZ template, or a Mapbox public token to build one. Without
// either, the globe uses the bundled Blue Marble texture.
const CUSTOM_TILES = process.env.NEXT_PUBLIC_SATELLITE_TILES || "";
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
const HAS_TILES = Boolean(CUSTOM_TILES || MAPBOX_TOKEN);

// JPEG quality by zoom level. A wide view needs many tiles and shows each one small,
// so compression artefacts are invisible there and the bytes matter; a close view
// needs few tiles and every pixel is on show. Same pixel count either way, far fewer
// bytes when it counts.
const tileQuality = (z: number) => (z <= 4 ? "jpg70" : z <= 6 ? "jpg80" : "jpg90");

const tileUrl = (x: number, y: number, z: number) =>
  CUSTOM_TILES
    ? CUSTOM_TILES.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y))
    : `https://api.mapbox.com/v4/mapbox.satellite/${z}/${x}/${y}@2x.${tileQuality(z)}?access_token=${MAPBOX_TOKEN}`;

function useViewport() {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const read = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    read();
    window.addEventListener("resize", read);
    window.visualViewport?.addEventListener("resize", read);
    return () => { window.removeEventListener("resize", read); window.visualViewport?.removeEventListener("resize", read); };
  }, []);
  return size;
}

// Satellite tiles arrive as plain textures with no anisotropic filtering, so anything
// seen at an angle — which on a sphere is most of what you look at — turns to mush as
// soon as you zoom in. The tile engine creates them itself, so we walk the scene and
// upgrade whatever is new. Textures are tagged once so repeat passes cost nothing.
type TileEngine = {
  thresholds: number[];
  maxLevel: number;
  __tuned?: boolean;
  add: (...objs: THREE.Object3D[]) => THREE.Object3D;
};

function setupTileEngine(scene: THREE.Object3D, mask: THREE.Texture, ref: THREE.Texture, thresholds: number[]): TileEngine | null {
  let found: TileEngine | null = null;
  scene.traverse((o) => {
    const e = o as unknown as TileEngine;
    if (found || !Array.isArray(e.thresholds) || typeof e.maxLevel !== "number") return;
    found = e;
    if (e.__tuned) return;
    e.__tuned = true;
    e.thresholds = thresholds;
    // Belt and braces: even a malformed ladder can then only ask for a sane level.
    e.maxLevel = Math.min(e.maxLevel, MAX_TILE_LEVEL);
    const add = e.add.bind(e);
    e.add = (...objs: THREE.Object3D[]) => {
      for (const obj of objs) {
        const mat = (obj as THREE.Mesh).material;
        if (mat) for (const m of Array.isArray(mat) ? mat : [mat]) paintOcean(m, mask, ref);
      }
      return add(...objs);
    };
    // Tiles already in place when we get here (the first level loads fast).
    (o as THREE.Object3D).traverse((c) => {
      const mat = (c as THREE.Mesh).material;
      if (mat) for (const m of Array.isArray(mat) ? mat : [mat]) paintOcean(m, mask, ref);
    });
  });
  return found;
}

const SHARPENED = Symbol("sharpened");
function sharpenTextures(scene: THREE.Object3D, renderer: THREE.WebGLRenderer) {
  const max = renderer.capabilities.getMaxAnisotropy();
  if (max <= 1) return;
  scene.traverse((o) => {
    const mats = (o as THREE.Mesh).material;
    if (!mats) return;
    for (const m of Array.isArray(mats) ? mats : [mats]) {
      const tex = (m as THREE.MeshBasicMaterial).map;
      const t = tex as (THREE.Texture & { [SHARPENED]?: boolean }) | null;
      if (!t || t[SHARPENED]) continue;
      t[SHARPENED] = true;
      t.anisotropy = max;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = true;
      t.needsUpdate = true;
    }
  });
}

function cssColor(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export default function GlobeCanvas(props: Props) {
  const { pins, route, revealed, focus, bottomInset, trips = [] } = props;
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const { w, h } = useViewport();
  const [ready, setReady] = useState(false);
  const [colors, setColors] = useState({ visited: "#2fa36b", wishlist: "#3c82d6", route: "#e0a43a" });
  const [alt, setAlt] = useState(2); // camera altitude, quantised, drives arc thickness
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotion = useRef(false);

  // Half-angle (radians) of the free screen area: the narrow side of a phone,
  // or the space between the header and the bottom panel, whichever is tighter.
  const halfFov = useCallback(() => {
    const cam = globeRef.current?.camera() as THREE.PerspectiveCamera | undefined;
    const vHalf = ((cam?.fov ?? 50) * Math.PI) / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * (w / Math.max(1, h)));
    const usable = Math.max(0.35, (h - bottomInset - TOPBAR) / Math.max(1, h));
    const vUsable = Math.atan(Math.tan(vHalf) * usable);
    return Math.min(hHalf, vUsable);
  }, [w, h, bottomInset]);
  const homeAltitude = useCallback(() => wholeGlobeAltitude(halfFov()), [halfFov]);

  // latest callbacks for DOM markers created once
  const handlers = useRef(props);
  handlers.current = props;

  // Decide once, before the globe appears, whether satellite tiles work. If the
  // source is down or misconfigured the globe uses its texture instead of going blank,
  // and it never swaps imagery while you're looking at it.
  const [tiles, setTiles] = useState<"pending" | "on" | "off">(HAS_TILES ? "pending" : "off");
  useEffect(() => {
    if (!HAS_TILES) return;
    let done = false;
    const finish = (v: "on" | "off") => { if (!done) { done = true; setTiles(v); } };
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => finish("on");
    img.onerror = () => finish("off");
    img.src = tileUrl(0, 0, 1);
    const t = setTimeout(() => finish("off"), 3500);
    return () => clearTimeout(t);
  }, []);

  // Bigger list of towns arrives a moment after start-up; redraw the labels when it does.
  useEffect(() => {
    loadMorePlaces().then((ok) => { if (ok) setView((v) => ({ ...v })); });
  }, []);

  // Country borders.
  //
  // A single white hairline vanishes over bright ground — deserts, snow, the dry
  // mountains of Central Asia — which is where borders matter most, because there is no
  // coastline to read the shape from. The fix is the standard cartographic one: a wider
  // dark line underneath and a thin bright line on top, so the pair carries its own
  // contrast onto any background.
  //
  // That needs real line width, which WebGL does not give plain lines (linewidth is
  // ignored almost everywhere), hence three's instanced fat lines. ~19k segments, two
  // passes, one draw call each.
  const borderRes = useRef(new THREE.Vector2(1, 1));
  useEffect(() => {
    const g = globeRef.current;
    if (!ready || !g) return;
    let live = true;
    const added: THREE.Object3D[] = [];
    const mats: LineMaterial[] = [];
    fetch("/borders.json").then((r) => r.json()).then((data: number[][]) => {
      if (!live) return;
      const pos: number[] = [];
      for (const l of data) {
        let prev = g.getCoords(l[1], l[0], 0.0007);
        for (let i = 2; i < l.length; i += 2) {
          const cur = g.getCoords(l[i + 1], l[i], 0.0007);
          pos.push(prev.x, prev.y, prev.z, cur.x, cur.y, cur.z);
          prev = cur;
        }
      }
      const geo = new LineSegmentsGeometry();
      geo.setPositions(pos);
      // halo first, then the bright core on top of it
      for (const [color, width, opacity, order] of [["#0b1720", 3.4, 0.55, 1], ["#ffffff", 1.25, 0.92, 2]] as const) {
        const mat = new LineMaterial({
          color: new THREE.Color(color).getHex(),
          linewidth: width, // device pixels — worldUnits is off, so zoom doesn't change it
          transparent: true,
          opacity,
          depthWrite: false,
          resolution: borderRes.current,
        });
        const mesh = new LineSegments2(geo, mat);
        mesh.renderOrder = order;
        mesh.frustumCulled = false; // one mesh wrapping the whole globe
        g.scene().add(mesh);
        added.push(mesh);
        mats.push(mat);
      }
    }).catch(() => { /* borders are decoration */ });
    return () => {
      live = false;
      for (const m of added) {
        g.scene().remove(m);
        (m as LineSegments2).geometry.dispose(); // shared, so disposing twice is a no-op
      }
      for (const m of mats) m.dispose();
    };
  }, [ready]);

  // Fat lines need the drawing-buffer size to turn their width into pixels.
  useEffect(() => {
    const dpr = Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, 2);
    borderRes.current.set(Math.max(1, w * dpr), Math.max(1, h * dpr));
  }, [w, h]);

  // Where the camera is looking, updated a few times a second while moving; drives place labels.
  const [view, setView] = useState({ lat: HOME.lat, lng: HOME.lng, alt: 2.3 });
  const viewRef = useRef(view);
  const pendingPov = useRef<{ lat: number; lng: number; altitude: number } | null>(null);
  const viewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackView = useCallback((pov: { lat: number; lng: number; altitude: number }) => {
    pendingPov.current = pov;
    if (viewTimer.current) return;
    viewTimer.current = setTimeout(() => {
      viewTimer.current = null;
      const p = pendingPov.current, v = viewRef.current;
      if (!p) return;
      const moved = distanceKm(v, p) > Math.max(40, p.altitude * 1200);
      const zoomed = Math.abs(p.altitude - v.alt) / Math.max(0.05, v.alt) > 0.08;
      if (moved || zoomed) { viewRef.current = { lat: p.lat, lng: p.lng, alt: p.altitude }; setView(viewRef.current); }
    }, 160);
  }, []);

  // theme colours follow the OS light/dark setting
  useEffect(() => {
    const read = () => setColors({
      visited: cssColor("--visited", "#2fa36b"),
      wishlist: cssColor("--wishlist", "#3c82d6"),
      route: cssColor("--route", "#e0a43a"),
    });
    read();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", read);
    reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return () => mq.removeEventListener("change", read);
  }, []);

  const tileEngine = useRef<TileEngine | null>(null);
  // The zoom ladder depends on the shape of the window, so it is set here and refreshed
  // on rotation or resize rather than baked in once.
  useEffect(() => {
    if (!w || !h) return;
    const e = tileEngine.current;
    if (e) e.thresholds = tileThresholds(w / h);
  }, [w, h, ready]);

  // The two global textures the ocean is painted from. Loaded once, shared by every tile.
  const seaTex = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const mask = loader.load("/textures/earth-water-mask.png");
    const ref = loader.load("/textures/earth.jpg");
    for (const t of [mask, ref]) {
      t.wrapS = THREE.RepeatWrapping;   // longitude wraps round
      t.wrapT = THREE.ClampToEdgeWrapping; // latitude stops at the poles
      t.magFilter = THREE.LinearFilter;
    }
    // The mask is small enough that it never really minifies, and mipmapping it would
    // only soften coastlines. The colour reference does minify when the whole globe is
    // on screen, so it keeps its mipmaps and stays free of shimmer while rotating.
    mask.minFilter = THREE.LinearFilter;
    mask.generateMipmaps = false;
    ref.minFilter = THREE.LinearMipmapLinearFilter;
    ref.generateMipmaps = true;
    ref.colorSpace = THREE.SRGBColorSpace;
    return { mask, ref };
  }, []);

  // Phong material: globe.gl fills in the colour map + bump map; we add ocean glints.
  // Used only when satellite tiles are unavailable, but it paints its water the same way.
  const material = useMemo(() => {
    const m = new THREE.MeshPhongMaterial({ shininess: 16 });
    m.specularMap = seaTex.mask;
    m.specular = new THREE.Color("#3a4c5e");
    paintOcean(m, seaTex.mask, seaTex.ref);
    return m;
  }, [seaTex, w, h]);

  const setAutoRotate = useCallback((on: boolean) => {
    const c = globeRef.current?.controls();
    if (c) c.autoRotate = on && !reduceMotion.current;
  }, []);

  const handleReady = useCallback(() => {
    const g = globeRef.current;
    if (!g) return;
    g.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    sharpenTextures(g.scene(), g.renderer());
    tileEngine.current = setupTileEngine(g.scene(), seaTex.mask, seaTex.ref, tileThresholds(w / Math.max(1, h)));
    const c = g.controls();
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.rotateSpeed = 0.55;
    c.zoomSpeed = 0.8;
    c.minDistance = R * 1.1;
    c.maxDistance = R * (1 + homeAltitude() * 1.6);
    c.autoRotateSpeed = 0.35;
    c.addEventListener("start", () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
      setAutoRotate(false);
      handlers.current.onInteract?.();
    });
    c.addEventListener("end", () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
      resumeTimer.current = setTimeout(() => setAutoRotate(!handlers.current.route), 9000);
    });
    g.pointOfView({ ...HOME, altitude: homeAltitude() }, 0);
    viewRef.current = { ...HOME, alt: homeAltitude() };
    setView(viewRef.current);
    setAutoRotate(true);
    setReady(true);
    handlers.current.onReady?.();
  }, [material, setAutoRotate, homeAltitude, seaTex, w, h]);

  // Keep the zoom-out limit in step with the screen shape (rotation, keyboard, panels).
  useEffect(() => {
    const c = ready ? globeRef.current?.controls() : undefined;
    if (c) c.maxDistance = R * (1 + homeAltitude() * 1.6);
  }, [ready, homeAltitude]);

  // Rotation feels the same at any zoom (slower close to the surface) and
  // route lines thin out as you get closer.
  // New tiles keep arriving for a while after a camera move, so sweep for a few seconds
  // after each one rather than only at the moment it stops.
  const sharpenTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const scheduleSharpen = useCallback(() => {
    const g = globeRef.current;
    if (!g || sharpenTimer.current) return;
    let left = 8;
    sharpenTimer.current = setInterval(() => {
      const gg = globeRef.current;
      if (gg) {
        tileEngine.current = setupTileEngine(gg.scene(), seaTex.mask, seaTex.ref, tileThresholds(w / Math.max(1, h))) ?? tileEngine.current;
        sharpenTextures(gg.scene(), gg.renderer());
      }
      if (--left <= 0 && sharpenTimer.current) { clearInterval(sharpenTimer.current); sharpenTimer.current = null; }
    }, 450);
  }, [seaTex, w, h]);
  useEffect(() => () => { if (sharpenTimer.current) clearInterval(sharpenTimer.current); }, []);

  const handleZoom = useCallback((pov: { lat: number; lng: number; altitude: number }) => {
    const c = globeRef.current?.controls();
    if (c) c.rotateSpeed = Math.min(0.6, 0.06 + pov.altitude * 0.22);
    scheduleSharpen();
    // The relief bump map is a single low-resolution texture for the whole planet. From
    // far away it gives the globe its shape; up close its coarse normals smear exactly
    // the detail the satellite tiles are providing, which is why mountains looked worse
    // the further you zoomed. Fade it out as the camera comes in.
    material.bumpScale = pov.altitude > 0.45 ? 7 : Math.max(0, (pov.altitude - 0.12) * 21);
    const q = Math.round(Math.min(3, Math.max(0.05, pov.altitude)) * 20) / 20;
    setAlt((prev) => (prev === q ? prev : q));
    trackView(pov);
  }, [trackView, scheduleSharpen, material]);

  // Camera flights
  useEffect(() => {
    if (!ready || !focus || !globeRef.current) return;
    setAutoRotate(false);
    // Drop any spin left over from auto-rotation or a flick (OrbitControls keeps it as damped
    // momentum), otherwise the globe keeps drifting after the flight and the route ends off-centre.
    const c = globeRef.current.controls();
    c.enableDamping = false;
    c.update();
    c.enableDamping = true;
    const altitude = focus.home ? homeAltitude() : altitudeForSpread(focus.spread ?? 3, halfFov());
    globeRef.current.pointOfView({ lat: focus.lat, lng: focus.lng, altitude }, reduceMotion.current ? 0 : focus.ms ?? 1600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, focus]);

  useEffect(() => { if (ready && !route) setAutoRotate(true); }, [ready, route, setAutoRotate]);

  // ---------- markers ----------
  // Pins/stops and place labels are memoised separately so moving the camera
  // (which changes labels) never re-creates the pins' DOM elements.
  // Saved trips other than the open one: each gets a neon colour and is drawn as a glowing line.
  const shownTrips = useMemo(() => trips
    .map((t, i) => ({ t, color: TRIP_COLORS[i % TRIP_COLORS.length] }))
    .filter(({ t }) => t.id !== route?.id && t.stops.length > 0), [trips, route?.id]);
  const pinMarkers: Marker[] = useMemo(() => {
    // A place that belongs to a saved trip shows as a small glowing dot on its trace, not a big pin.
    const inTrips = new Set(trips.flatMap((t) => t.stops.map((s) => s.name.toLowerCase())));
    const m: Marker[] = pins.filter((p) => !inTrips.has(p.name.toLowerCase()))
      .map((p) => ({ kind: "pin", id: p.id, lat: p.lat, lng: p.lng, type: p.type, name: p.name }));
    for (const { t, color } of shownTrips) {
      t.stops.forEach((s, i) => m.push({ kind: "dot", id: `${t.id}-d${i}`, lat: s.lat, lng: s.lng, name: s.name, tripId: t.id, tripName: t.name, color, first: i === 0 }));
    }
    if (route) route.stops.slice(0, revealed).forEach((s, i) => m.push({ kind: "stop", id: `${route.id}-${i}`, lat: s.lat, lng: s.lng, index: i, name: s.name }));
    return m;
  }, [pins, trips, shownTrips, route, revealed]);
  // Drop place names that would sit on top of a pin or route stop (e.g. "Luxor" next to stop "Luxor"),
  // then keep only names whose on-screen boxes don't overlap, most important first.
  const labels = useMemo(() => {
    const nearKm = Math.max(8, view.alt * 260);
    const cand = visibleLabels(view, view.alt, 140).filter((l) => !pinMarkers.some((m) =>
      m.name.toLowerCase() === l.name.toLowerCase() || distanceKm(m, l) < nearKm));
    const g = ready ? globeRef.current : undefined;
    if (!g) return cand.slice(0, 40);
    const boxes: { x1: number; x2: number; y1: number; y2: number }[] = [];
    const out: PlaceLabel[] = [];
    for (const l of cand) {
      const p = g.getScreenCoords(l.lat, l.lng, 0.005);
      if (!p || !Number.isFinite(p.x)) continue;
      // Rough text width, in step with the font sizes in globals.css: city names got
      // smaller, so reserving the old width would waste screen and drop good labels.
      const perChar = l.kind === "country" ? (l.tier === 1 ? 10 : 9) : l.tier === 1 ? 6.6 : l.tier >= 4 ? 5.4 : 6;
      const wPx = l.name.length * perChar + (l.kind === "country" ? 0 : 8); // cities carry a dot and a gap
      const b = { x1: p.x - wPx / 2 - 5, x2: p.x + wPx / 2 + 5, y1: p.y - 10, y2: p.y + 10 };
      if (b.x2 < 0 || b.x1 > w || p.y < TOPBAR + 24 || p.y > h - bottomInset) continue; // off screen, or under the header / bottom panel
      if (boxes.some((o) => o.x1 < b.x2 && b.x1 < o.x2 && o.y1 < b.y2 && b.y1 < o.y2)) continue;
      boxes.push(b);
      out.push(l);
      if (out.length >= 40) break;
    }
    return out;
  }, [view, pinMarkers, ready, w, h, bottomInset]);
  const markers = useMemo(() => [...labels, ...pinMarkers], [labels, pinMarkers]);

  // Place names don't take pointer events (so you can start a drag on top of one);
  // a tap on the globe checks whether it landed on a name instead.
  const labelEls = useRef(new Map<HTMLElement, PlaceLabel>());
  const labelAt = useCallback((x: number, y: number): PlaceLabel | null => {
    let best: PlaceLabel | null = null, bestD = Infinity;
    labelEls.current.forEach((lb, el) => {
      if (!el.isConnected) { labelEls.current.delete(el); return; } // label no longer on the globe
      if (el.style.opacity === "0") return;
      const r = el.getBoundingClientRect();
      if (x < r.left - 10 || x > r.right + 10 || y < r.top - 12 || y > r.bottom + 12) return;
      const d = Math.hypot(x - (r.left + r.right) / 2, y - (r.top + r.bottom) / 2);
      if (d < bestD) { bestD = d; best = lb; }
    });
    return best;
  }, []);

  const makeMarker = useCallback((d: object) => {
    if ((d as Marker).kind === "country" || (d as Marker).kind === "city") {
      const lb = d as PlaceLabel;
      const el = document.createElement("div");
      el.className = `lb lb-${lb.kind} lb-t${lb.tier}`;
      el.dataset.label = "1";
      el.textContent = lb.name;
      labelEls.current.set(el, lb);
      return el;
    }
    const mk = d as Exclude<Marker, PlaceLabel>;
    // globe.gl centres this element on the point; children are offset from that centre.
    const el = document.createElement("button");
    el.type = "button";
    el.className = `mk ${mk.kind === "stop" ? "mk-stop" : mk.kind === "dot" ? "mk-dot" : "mk-flagwrap"}`;
    el.setAttribute("aria-label", mk.kind === "stop" ? `Parada ${mk.index + 1}: ${mk.name}` : mk.kind === "dot" ? `${mk.name} · ruta ${mk.tripName}` : mk.name);
    if (mk.kind === "dot") {
      el.style.setProperty("--c", mk.color);
      // the trip's name, once, next to where it starts
      if (mk.first) { const t = document.createElement("span"); t.className = "mk-trip"; t.textContent = mk.tripName; el.append(t); }
    } else if (mk.kind === "pin") {
      el.style.setProperty("--c", mk.type === "visitado" ? "var(--visited)" : "var(--wishlist)");
      // A small pennant on a pole. The pole's foot sits exactly on the coordinate, so
      // the flag reads as planted there rather than floating over it.
      el.innerHTML = `<svg class="mk-flag" viewBox="0 0 24 28" aria-hidden="true">` +
        `<path class="mk-flag-cloth" d="M12.8 3.6 L22 7 L12.8 10.4 Z"/>` +
        `<path class="mk-flag-pole" d="M12 2.8 V24.6"/>` +
        `<circle class="mk-flag-foot" cx="12" cy="26" r="2.1"/></svg>`;
    } else {
      const num = document.createElement("span"); num.className = "mk-num"; num.textContent = String(mk.index + 1);
      const label = document.createElement("span");
      label.className = `mk-label ${mk.index % 2 ? "mk-label--left" : ""}`; // alternate sides so neighbours don't collide
      label.textContent = mk.name;
      el.append(num, label);
    }
    // Stop the tap reaching the globe (which would open "add place")
    el.addEventListener("pointerdown", (e) => e.stopPropagation());
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (mk.kind === "pin") handlers.current.onPinTap(mk.id);
      else if (mk.kind === "dot") handlers.current.onTripTap?.(mk.tripId);
      else handlers.current.onStopTap(mk.index);
    });
    return el;
  }, []);

  // ---------- route arcs: a soft base line plus a light that travels along it ----------
  // Saved trips: a wide faint halo, a thin bright core and a slow light running along it.
  const arcs = useMemo(() => {
    const out: object[] = [];
    for (const { t, color } of shownTrips) {
      const rgb = rgbOf(color);
      for (let i = 0; i < t.stops.length - 1; i++) {
        const a = t.stops[i], b = t.stops[i + 1];
        const seg = { startLat: a.lat, startLng: a.lng, endLat: b.lat, endLng: b.lng, rgb };
        out.push({ ...seg, layer: "glow", key: `${t.id}-g${i}` });
        out.push({ ...seg, layer: "core", key: `${t.id}-c${i}` });
        out.push({ ...seg, layer: "spark", key: `${t.id}-s${i}`, phase: (i * 0.61) % 2 });
      }
    }
    if (!route) return out;
    for (let i = 0; i < Math.min(revealed, route.stops.length) - 1; i++) {
      const a = route.stops[i], b = route.stops[i + 1];
      const seg = { startLat: a.lat, startLng: a.lng, endLat: b.lat, endLng: b.lng };
      out.push({ ...seg, layer: "base", key: `${route.id}-b${i}` });
      out.push({ ...seg, layer: "flow", key: `${route.id}-f${i}` });
    }
    return out;
  }, [route, revealed, shownTrips]);

  const rings = useMemo(() => (route ? route.stops.slice(0, revealed).map((s) => ({ lat: s.lat, lng: s.lng })) : []), [route, revealed]);
  const routeRgb = useMemo(() => new THREE.Color(colors.route), [colors.route]);
  const ringColor = useCallback(() => (t: number) => `rgba(${Math.round(routeRgb.r * 255)},${Math.round(routeRgb.g * 255)},${Math.round(routeRgb.b * 255)},${(1 - t) * 0.8})`, [routeRgb]);

  if (!w || !h || tiles === "pending") return null;
  // Centre the globe in the free space between the header and the bottom panel.
  const offsetY = (TOPBAR - bottomInset) / 2;
  const thin = Math.min(1, Math.max(0.1, alt * 0.8));

  const tilesOn = tiles === "on";
  return (
    <>
    {tilesOn && MAPBOX_TOKEN && !CUSTOM_TILES && (
      <div className="attribution">© Mapbox © Maxar © OpenStreetMap</div>
    )}
    <Globe
      ref={globeRef}
      width={w}
      height={h}
      globeOffset={[0, offsetY]}
      backgroundColor="rgba(0,0,0,0)"
      rendererConfig={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      globeImageUrl="/textures/earth.jpg"
      bumpImageUrl="/textures/earth-bump.png"
      globeTileEngineUrl={tilesOn ? tileUrl : null}
      globeMaterial={material}
      showGraticules
      showAtmosphere
      atmosphereColor="#8fc3ff"
      atmosphereAltitude={0.17}
      animateIn={false}
      onGlobeReady={handleReady}
      onZoom={handleZoom}
      onGlobeClick={({ lat, lng }, ev) => {
        const e = ev as MouseEvent | undefined;
        const lb = e ? labelAt(e.clientX, e.clientY) : null;
        if (lb) handlers.current.onLabelTap(lb);
        else handlers.current.onGlobeTap(lat, lng);
      }}
      htmlElementsData={markers}
      htmlLat="lat"
      htmlLng="lng"
      htmlAltitude={0.005}
      htmlElement={makeMarker}
      htmlTransitionDuration={0}
      htmlElementVisibilityModifier={(el, visible) => {
        el.style.opacity = visible ? "1" : "0";
        if (el.dataset.label) return; // place names never take taps
        el.style.pointerEvents = visible ? "auto" : "none";
        // Put a stop's name on whichever side has room on screen.
        const label = visible ? (el.querySelector(".mk-label, .mk-trip") as HTMLElement | null) : null;
        if (label) {
          const r = el.getBoundingClientRect();
          const x = r.left + r.width / 2;
          if (x > w * 0.62) label.classList.add("mk-label--left");
          else if (x < w * 0.38) label.classList.remove("mk-label--left");
        }
      }}
      arcsData={arcs}
      arcStartLat="startLat" arcStartLng="startLng" arcEndLat="endLat" arcEndLng="endLng"
      arcColor={(d: any) => {
        if (d.layer === "glow") return `rgba(${d.rgb},0.2)`;
        if (d.layer === "core") return `rgba(${d.rgb},0.95)`;
        if (d.layer === "spark") return [`rgba(${d.rgb},0)`, "rgba(255,255,255,0.95)", `rgba(${d.rgb},0)`];
        const rgb = `${Math.round(routeRgb.r * 255)},${Math.round(routeRgb.g * 255)},${Math.round(routeRgb.b * 255)}`;
        return d.layer === "base" ? `rgba(${rgb},0.6)` : [`rgba(${rgb},0)`, `rgba(255,236,196,0.95)`];
      }}
      arcStroke={(d: any) => ({ glow: 1.5, core: 0.34, spark: 0.5, base: 0.45, flow: 0.5 } as Record<string, number>)[d.layer] * thin}
      arcAltitudeAutoScale={(d: any) => (d.layer === "base" || d.layer === "flow" ? 0.32 : 0.14)}
      arcDashLength={(d: any) => (d.layer === "flow" ? 0.18 : d.layer === "spark" ? 0.25 : 1)}
      arcDashGap={(d: any) => (d.layer === "flow" ? 0.82 : d.layer === "spark" ? 1.75 : 0)}
      arcDashInitialGap={(d: any) => (d.layer === "flow" ? 1 : d.layer === "spark" ? d.phase : 0)}
      arcDashAnimateTime={(d: any) => (reduceMotion.current ? 0 : d.layer === "flow" ? 2600 : d.layer === "spark" ? 5200 : 0)}
      arcsTransitionDuration={900}
      ringsData={rings}
      ringColor={ringColor}
      ringMaxRadius={3.2}
      ringPropagationSpeed={2.2}
      ringRepeatPeriod={1500}
      ringAltitude={0.003}
    />
    </>
  );
}
