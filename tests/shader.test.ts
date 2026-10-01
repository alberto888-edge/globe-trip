import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { parser } from "@shaderfrog/glsl-parser";

// The ocean is written as GLSL inside GlobeCanvas.tsx and injected into three's own
// shaders at runtime, so a typo there is invisible to TypeScript and only shows up as a
// black globe in the browser. These tests read the real strings out of the component.

const src = readFileSync("components/GlobeCanvas.tsx", "utf8");
function glslConst(name: string): string {
  const head = src.indexOf(`const ${name} = \``);
  assert.ok(head >= 0, `${name} no está en GlobeCanvas.tsx`);
  const from = src.indexOf("`", head) + 1;
  return src.slice(from, src.indexOf("`", from));
}

test("el GLSL del océano es sintácticamente válido", () => {
  // Wrapped in the smallest shader that provides everything it touches. three's own
  // lambert/phong sources can't be parsed without a preprocessor, so the snippet is
  // checked on its own rather than inside them.
  const code = [
    "precision highp float;",
    "#define USE_MAP",
    "uniform sampler2D map;",
    "varying vec2 vMapUv;",
    glslConst("OCEAN_UNIFORMS"),
    "void main() {",
    "  vec4 diffuseColor = texture2D(map, vMapUv);",
    glslConst("OCEAN_FRAGMENT"),
    "  gl_FragColor = diffuseColor;",
    "}",
  ].join("\n");
  parser.parse(code); // throws on a syntax error
});

test("los puntos de injerto siguen existiendo en los shaders de three", () => {
  // If three ever renames these, the replaces below fail silently and the ocean just
  // never appears. Better to fail here.
  for (const name of ["lambert", "phong", "basic"] as const) {
    const { vertexShader: vs, fragmentShader: fs } = THREE.ShaderLib[name];
    assert.ok(vs.includes("void main() {"), `${name}: falta el ancla del vertex`);
    assert.ok(vs.includes("#include <begin_vertex>"), `${name}: falta begin_vertex`);
    assert.ok(fs.includes("void main() {"), `${name}: falta el ancla del fragment`);
    assert.ok(fs.includes("#include <map_fragment>"), `${name}: falta map_fragment`);
  }
});

test("la conversión de posición a lat/lng coincide con la geometría real de las teselas", () => {
  // Mirrors how three-slippy-map-globe builds a tile, then runs the shader's formula on
  // the resulting vertices. A quarter-turn error here would paint ocean over land.
  const R = 100, deg = (d: number) => (d * Math.PI) / 180;
  const latLng = (x: number, y: number, z: number) => {
    const r = Math.hypot(x, y, z);
    const lat = (Math.asin(Math.max(-1, Math.min(1, y / r))) * 180) / Math.PI;
    let lng = (Math.atan2(z, -x) * 180) / Math.PI - 90;
    lng = ((lng + 540) % 360) - 180;
    return { lat, lng };
  };
  for (const [lngC, latC] of [[0, 0], [90, 0], [-90, 0], [180, 0], [0, 45], [0, -45], [139.7, 35.7], [-3.7, 40.4], [-58, -34.6]]) {
    const g = new THREE.SphereGeometry(R, 8, 8, deg(90 - 1) + deg(lngC), deg(2), deg(90 - 1) + deg(-latC), deg(2));
    const p = g.attributes.position, i = Math.floor(p.count / 2);
    const { lat, lng } = latLng(p.getX(i), p.getY(i), p.getZ(i));
    assert.ok(Math.abs(lat - latC) < 1e-4, `lat ${lat} != ${latC}`);
    assert.ok(Math.min(Math.abs(lng - lngC), 360 - Math.abs(lng - lngC)) < 1e-4, `lng ${lng} != ${lngC}`);
  }
});
