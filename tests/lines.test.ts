import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

// The country borders are drawn with three's instanced fat lines, whose width is in
// drawing-buffer pixels and therefore depends on `resolution` being right. Getting it
// wrong doesn't throw and doesn't fail the build: it just draws the borders hundreds of
// times too thick, which is what shipped on 2026-10-01.

test("LineMaterial copia el vector de resolución: mutarlo después no llega al uniform", () => {
  const shared = new THREE.Vector2(1, 1);
  const m = new LineMaterial({ resolution: shared });
  shared.set(780, 1688); // lo que hacía el código roto
  assert.equal(m.resolution.x, 1, "si esto cambia, three ya guarda la referencia");
  assert.equal(m.resolution.y, 1);
  m.dispose();
});

test("escribir sobre el uniform vivo sí cambia el ancho efectivo", () => {
  const m = new LineMaterial({ linewidth: 1.8 });
  m.resolution.set(780, 1688);
  assert.equal(m.resolution.x, 780);
  assert.equal(m.resolution.y, 1688);
  // El shader divide el desplazamiento por resolution.y, así que dejarlo en 1 multiplica
  // el grosor por la altura del lienzo entera.
  assert.ok(m.resolution.y > 100, "una resolución sin fijar dibuja líneas gigantes");
  m.dispose();
});
