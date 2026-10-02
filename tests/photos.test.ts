import { test } from "node:test";
import assert from "node:assert/strict";
import { fileOf, isPhoto, lookupPlace } from "../lib/wikiPhoto.ts";

const T = (file: string) => `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${file}/330px-${file}${file.endsWith(".svg") ? ".png" : ""}`;

test("sólo cuentan como foto los JPEG que no se llaman como un mapa", () => {
  assert.equal(fileOf(T("Wat_Xieng_Thong.jpg")), "Wat Xieng Thong.jpg");
  assert.ok(isPhoto(T("Wat_Xieng_Thong.jpg")));
  // The case from Alberto's screenshot: a province map that the old filter let through.
  assert.ok(!isPhoto(T("LuangPrabang.png")));
  assert.ok(!isPhoto(T("Laos_-_Luang_Prabang.svg")));
  assert.ok(!isPhoto(T("Luang_Prabang_location_map.jpg")));
  assert.ok(!isPhoto(T("Flag_of_Laos.jpg")));
  assert.ok(!isPhoto(undefined));
});

// A tiny fake of the three Wikipedia endpoints the picker uses.
function wiki(pages: Record<string, { thumb?: string; coords?: [number, number]; extract?: string; media?: string[] }>, searches: Record<string, string> = {}) {
  return async (url: string) => {
    const u = new URL(url);
    const ok = (j: unknown) => ({ ok: true, json: async () => j });
    const miss = { ok: false, json: async () => ({}) };
    if (u.pathname.includes("/page/summary/")) {
      const t = decodeURIComponent(u.pathname.split("/page/summary/")[1]).replace(/_/g, " ");
      const p = pages[t];
      return p ? ok({ title: t, extract: p.extract ?? `${t}.`, thumbnail: p.thumb ? { source: p.thumb } : undefined, coordinates: p.coords ? { lat: p.coords[0], lon: p.coords[1] } : undefined }) : miss;
    }
    if (u.pathname.includes("/page/media-list/")) {
      const t = decodeURIComponent(u.pathname.split("/page/media-list/")[1]).replace(/_/g, " ");
      return ok({ items: (pages[t]?.media ?? []).map((m) => ({ type: "image", srcset: [{ src: m.replace("https:", ""), scale: "1x" }] })) });
    }
    if (u.pathname.endsWith("/w/api.php")) {
      const q = `${u.hostname.slice(0, 2)}:${u.searchParams.get("srsearch") || ""}`;
      const hit = Object.entries(searches).find(([k]) => q.startsWith(k));
      return ok({ query: { search: hit ? [{ title: hit[1] }] : [] } });
    }
    return miss;
  };
}

test("si la imagen principal es un mapa, busca una foto dentro del artículo", async () => {
  const get = wiki({ "Luang Prabang": { thumb: T("LuangPrabang.png"), coords: [19.89, 102.13], media: [T("Laos_location_map.svg"), T("Wat_Xieng_Thong.jpg")] } });
  const r = await lookupPlace({ name: "Luang Prabang", country: "Laos", lat: 19.885, lng: 102.135 }, get as any);
  assert.equal(fileOf(r!.image!), "Wat Xieng Thong.jpg");
  assert.match(r!.extract!, /Luang Prabang/);
});

test("nunca devuelve un mapa: sin foto, sin imagen", async () => {
  const get = wiki({ "Pueblo": { thumb: T("Pueblo.png"), media: [T("Pueblo_map.svg")] } });
  const r = await lookupPlace({ name: "Pueblo" }, get as any);
  assert.equal(r?.image, undefined);
  assert.ok(r?.extract, "el texto sí se usa");
});

test("un artículo de otro sitio cercano no presta su foto", async () => {
  // A waterfall 29 km from town: the search lands on the town's article.
  const get = wiki({
    "Luang Prabang": { thumb: T("Wat_Xieng_Thong.jpg"), coords: [19.89, 102.13] },
    "Kuang Si Falls": { thumb: T("Kuang_Si_Falls.jpg"), coords: [19.749, 101.993] },
  }, { "es:Cataratas de Kuang Si": "Luang Prabang", "en:Cataratas de Kuang Si": "Kuang Si Falls" });
  const r = await lookupPlace({ name: "Cataratas de Kuang Si", country: "Laos", lat: 19.749, lng: 101.993 }, get as any);
  assert.equal(fileOf(r!.image!), "Kuang Si Falls.jpg");
});

test("dos paradas no comparten foto", async () => {
  const get = wiki({
    "Siem Reap": { thumb: T("Angkor_Wat.jpg"), media: [T("Angkor_Wat.jpg"), T("Pub_Street_Siem_Reap.jpg")] },
    "Angkor": { thumb: T("Angkor_Wat.jpg") },
  });
  const claimed = new Map<string, string>();
  const a = await lookupPlace({ name: "Angkor" }, get as any, claimed);
  const b = await lookupPlace({ name: "Siem Reap" }, get as any, claimed);
  assert.equal(fileOf(a!.image!), "Angkor Wat.jpg");
  assert.equal(fileOf(b!.image!), "Pub Street Siem Reap.jpg");
});
