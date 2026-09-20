"use client";
// Photo + one-paragraph blurb for a place, from Wikipedia (free, no key, CORS-enabled).
// Results are cached in memory and localStorage so each place is looked up once.
import { useEffect, useState } from "react";

export interface PlaceInfo { image?: string; imageLarge?: string; thumb?: string; extract?: string; url?: string; title?: string }

// Wikimedia only renders thumbnails at standard widths (330, 500, 960, 1280…);
// any other width fails to load. Verified against the live service.
const sized = (thumb: string, w: number) => thumb.replace(/\/\d+px-/, `/${w}px-`);
export interface PlaceQuery { name: string; wiki?: string; country?: string }

const TTL = 30 * 24 * 3600 * 1000;
const mem = new Map<string, Promise<PlaceInfo | null>>();

const keyOf = (q: PlaceQuery) => `gt:wiki2:${(q.wiki || q.name).toLowerCase()}|${(q.country || "").toLowerCase()}`;

async function summary(lang: string, title: string): Promise<PlaceInfo | null> {
  const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}?redirect=true`);
  if (!res.ok) return null;
  const j = await res.json();
  if (j.type === "disambiguation") return null;
  const thumb: string | undefined = j.thumbnail?.source;
  const hasSteps = !!thumb && /\/\d+px-/.test(thumb);
  return {
    title: j.title,
    thumb,
    image: thumb ? (hasSteps ? sized(thumb, 500) : thumb) : j.originalimage?.source,
    imageLarge: thumb ? (hasSteps ? sized(thumb, 960) : thumb) : j.originalimage?.source,
    extract: j.extract,
    url: j.content_urls?.mobile?.page || j.content_urls?.desktop?.page,
  };
}

async function search(lang: string, q: string): Promise<string | null> {
  const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=5&format=json&origin=*`);
  if (!res.ok) return null;
  // skip airports, stations and the like that share the place's name
  const hits: { title: string }[] = (await res.json()).query?.search ?? [];
  return hits.find((h) => !/^(Aeropuerto|Estación|Anexo|Estadio|Club|Batalla)\b/i.test(h.title))?.title ?? null;
}

async function lookup(q: PlaceQuery): Promise<PlaceInfo | null> {
  const attempts: (() => Promise<PlaceInfo | null>)[] = [
    () => (q.wiki ? summary("es", q.wiki) : Promise.resolve(null)),
    () => summary("es", q.name),
    async () => { const t = await search("es", [q.name, q.country].filter(Boolean).join(" ")); return t ? summary("es", t) : null; },
    () => summary("en", q.name),
  ];
  let best: PlaceInfo | null = null;
  for (const a of attempts) {
    const r = await a().catch(() => null);
    if (r?.image) return r;
    best = best || r;
  }
  return best;
}

export function placeInfo(q: PlaceQuery): Promise<PlaceInfo | null> {
  const key = keyOf(q);
  const hit = mem.get(key);
  if (hit) return hit;
  let stored: { at: number; v: PlaceInfo | null } | null = null;
  try { stored = JSON.parse(localStorage.getItem(key) || "null"); } catch { /* ignore */ }
  const p = stored && Date.now() - stored.at < TTL
    ? Promise.resolve(stored.v)
    : lookup(q).then((v) => { try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), v })); } catch { /* full */ } return v; });
  mem.set(key, p);
  return p;
}

export function usePlaceInfo(q: PlaceQuery | null): { info: PlaceInfo | null; loading: boolean } {
  const [state, setState] = useState<{ info: PlaceInfo | null; loading: boolean }>({ info: null, loading: !!q });
  const k = q ? keyOf(q) : "";
  useEffect(() => {
    if (!q) { setState({ info: null, loading: false }); return; }
    let live = true;
    setState((s) => ({ info: s.info, loading: true }));
    placeInfo(q).then((info) => { if (live) setState({ info, loading: false }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);
  return state;
}
