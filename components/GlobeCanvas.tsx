"use client";
// The 3D Earth. Full-screen, transparent over the page background.
// Zoom is a real camera dolly (OrbitControls with damping); markers are HTML
// so they stay the same size at any zoom; camera moves are eased flights.
import Globe, { type GlobeMethods } from "react-globe.gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Pin, Route } from "@/lib/types";
import { altitudeForSpread, distanceKm, wholeGlobeAltitude } from "@/lib/geo";
import { visibleLabels, type PlaceLabel } from "@/lib/labels";

/** Where the camera should fly. `spread` = degrees of arc that must fit on screen; `home` = whole globe. */
export interface Focus { lat: number; lng: number; spread?: number; home?: boolean; key: number; ms?: number }

interface Props {
  pins: Pin[];
  route: Route | null;
  revealed: number; // how many route stops are visible (staged reveal)
  focus: Focus | null;
  bottomInset: number; // px covered by the bottom UI, so the globe sits above it
  onGlobeTap: (lat: number, lng: number) => void;
  onPinTap: (id: string) => void;
  onStopTap: (index: number) => void;
  onReady?: () => void;
  onInteract?: () => void;
}

type Marker =
  | { kind: "pin"; id: string; lat: number; lng: number; type: Pin["type"]; name: string }
  | { kind: "stop"; id: string; lat: number; lng: number; index: number; name: string }
  | PlaceLabel;

const HOME = { lat: 28, lng: 8 };
const R = 100; // globe.gl radius in scene units
const TOPBAR = 70; // px reserved at the top for the header

// Satellite imagery at every zoom level (one consistent look, sharp up close).
// Either a full XYZ template, or a Mapbox public token to build one. Without
// either, the globe uses the bundled Blue Marble texture.
const TILE_TEMPLATE =
  process.env.NEXT_PUBLIC_SATELLITE_TILES ||
  (process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    ? `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
    : "");
const tileUrl = (x: number, y: number, z: number) =>
  TILE_TEMPLATE.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));

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

function cssColor(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export default function GlobeCanvas(props: Props) {
  const { pins, route, revealed, focus, bottomInset } = props;
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
  const [tiles, setTiles] = useState<"pending" | "on" | "off">(TILE_TEMPLATE ? "pending" : "off");
  useEffect(() => {
    if (!TILE_TEMPLATE) return;
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

  // Phong material: globe.gl fills in the colour map + bump map; we add ocean glints.
  const material = useMemo(() => {
    const m = new THREE.MeshPhongMaterial({ shininess: 16 });
    new THREE.TextureLoader().load("/textures/earth-water-mask.png", (t) => {
      m.specularMap = t;
      m.specular = new THREE.Color("#3a4c5e");
      m.needsUpdate = true;
    });
    return m;
  }, []);

  const setAutoRotate = useCallback((on: boolean) => {
    const c = globeRef.current?.controls();
    if (c) c.autoRotate = on && !reduceMotion.current;
  }, []);

  const handleReady = useCallback(() => {
    const g = globeRef.current;
    if (!g) return;
    g.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    material.bumpScale = 7;
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
  }, [material, setAutoRotate, homeAltitude]);

  // Keep the zoom-out limit in step with the screen shape (rotation, keyboard, panels).
  useEffect(() => {
    const c = ready ? globeRef.current?.controls() : undefined;
    if (c) c.maxDistance = R * (1 + homeAltitude() * 1.6);
  }, [ready, homeAltitude]);

  // Rotation feels the same at any zoom (slower close to the surface) and
  // route lines thin out as you get closer.
  const handleZoom = useCallback((pov: { lat: number; lng: number; altitude: number }) => {
    const c = globeRef.current?.controls();
    if (c) c.rotateSpeed = Math.min(0.6, 0.06 + pov.altitude * 0.22);
    const q = Math.round(Math.min(3, Math.max(0.05, pov.altitude)) * 20) / 20;
    setAlt((prev) => (prev === q ? prev : q));
    trackView(pov);
  }, [trackView]);

  // Camera flights
  useEffect(() => {
    if (!ready || !focus || !globeRef.current) return;
    setAutoRotate(false);
    const altitude = focus.home ? homeAltitude() : altitudeForSpread(focus.spread ?? 3, halfFov());
    globeRef.current.pointOfView({ lat: focus.lat, lng: focus.lng, altitude }, reduceMotion.current ? 0 : focus.ms ?? 1600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, focus]);

  useEffect(() => { if (ready && !route) setAutoRotate(true); }, [ready, route, setAutoRotate]);

  // ---------- markers ----------
  // Pins/stops and place labels are memoised separately so moving the camera
  // (which changes labels) never re-creates the pins' DOM elements.
  const pinMarkers: Marker[] = useMemo(() => {
    const m: Marker[] = pins.map((p) => ({ kind: "pin", id: p.id, lat: p.lat, lng: p.lng, type: p.type, name: p.name }));
    if (route) route.stops.slice(0, revealed).forEach((s, i) => m.push({ kind: "stop", id: `${route.id}-${i}`, lat: s.lat, lng: s.lng, index: i, name: s.name }));
    return m;
  }, [pins, route, revealed]);
  // Drop place names that would sit on top of a pin or route stop (e.g. "Luxor" next to stop "Luxor").
  const labels = useMemo(() => {
    const nearKm = Math.max(8, view.alt * 260);
    return visibleLabels(view, view.alt).filter((l) => !pinMarkers.some((m) =>
      m.name.toLowerCase() === l.name.toLowerCase() || distanceKm(m, l) < nearKm));
  }, [view, pinMarkers]);
  const markers = useMemo(() => [...labels, ...pinMarkers], [labels, pinMarkers]);

  const makeMarker = useCallback((d: object) => {
    if ((d as Marker).kind === "country" || (d as Marker).kind === "city") {
      const lb = d as PlaceLabel;
      const el = document.createElement("div");
      el.className = `lb lb-${lb.kind} lb-t${lb.tier}`;
      el.dataset.label = "1";
      el.textContent = lb.name;
      return el;
    }
    const mk = d as Exclude<Marker, PlaceLabel>;
    // globe.gl centres this element on the point; children are offset from that centre.
    const el = document.createElement("button");
    el.type = "button";
    el.className = `mk ${mk.kind === "stop" ? "mk-stop" : "mk-pinwrap"}`;
    el.setAttribute("aria-label", mk.kind === "stop" ? `Parada ${mk.index + 1}: ${mk.name}` : mk.name);
    if (mk.kind === "pin") {
      el.style.setProperty("--c", mk.type === "visitado" ? "var(--visited)" : "var(--wishlist)");
      el.innerHTML = `<svg class="mk-pin" viewBox="0 0 22 30" aria-hidden="true"><path d="M11 1C5.5 1 1 5.4 1 10.8 1 18 11 29 11 29s10-11 10-18.2C21 5.4 16.5 1 11 1Z"/><circle cx="11" cy="10.8" r="3.6"/></svg>`;
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
      else handlers.current.onStopTap(mk.index);
    });
    return el;
  }, []);

  // ---------- route arcs: a soft base line plus a light that travels along it ----------
  const arcs = useMemo(() => {
    if (!route) return [];
    const out: object[] = [];
    for (let i = 0; i < Math.min(revealed, route.stops.length) - 1; i++) {
      const a = route.stops[i], b = route.stops[i + 1];
      const seg = { startLat: a.lat, startLng: a.lng, endLat: b.lat, endLng: b.lng };
      out.push({ ...seg, layer: "base", key: `${route.id}-b${i}` });
      out.push({ ...seg, layer: "flow", key: `${route.id}-f${i}` });
    }
    return out;
  }, [route, revealed]);

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
    {tilesOn && process.env.NEXT_PUBLIC_MAPBOX_TOKEN && !process.env.NEXT_PUBLIC_SATELLITE_TILES && (
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
      onGlobeClick={({ lat, lng }) => handlers.current.onGlobeTap(lat, lng)}
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
        const label = visible ? (el.querySelector(".mk-label") as HTMLElement | null) : null;
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
        const rgb = `${Math.round(routeRgb.r * 255)},${Math.round(routeRgb.g * 255)},${Math.round(routeRgb.b * 255)}`;
        return d.layer === "base" ? `rgba(${rgb},0.6)` : [`rgba(${rgb},0)`, `rgba(255,236,196,0.95)`];
      }}
      arcStroke={(d: any) => (d.layer === "base" ? 0.45 : 0.5) * thin}
      arcAltitudeAutoScale={0.32}
      arcDashLength={(d: any) => (d.layer === "base" ? 1 : 0.18)}
      arcDashGap={(d: any) => (d.layer === "base" ? 0 : 0.82)}
      arcDashInitialGap={(d: any) => (d.layer === "base" ? 0 : 1)}
      arcDashAnimateTime={(d: any) => (d.layer === "base" ? 0 : reduceMotion.current ? 0 : 2600)}
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
