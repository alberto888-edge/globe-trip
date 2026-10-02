"use client";
// Photo + one-paragraph blurb for a place, from Wikipedia (free, no key, CORS-enabled).
// Results are cached in memory and localStorage so each place is looked up once.
import { useEffect, useState } from "react";

import { fileOf, lookupPlace, type PlaceInfo, type PlaceQuery } from "./wikiPhoto";
export type { PlaceInfo, PlaceQuery } from "./wikiPhoto";

const TTL = 30 * 24 * 3600 * 1000;
const mem = new Map<string, Promise<PlaceInfo | null>>();
// Which place showed each photo first, so two stops never share one (see lib/wikiPhoto.ts).
const claimed = new Map<string, string>();

// v4: earlier versions could cache a map as a place's picture.
const keyOf = (q: PlaceQuery) => `gt:wiki4:${(q.wiki || q.name).toLowerCase()}|${(q.country || "").toLowerCase()}`;
const owner = (q: PlaceQuery) => (q.wiki || q.name).toLowerCase();

const fresh = (q: PlaceQuery) => lookupPlace(q, (u) => fetch(u), claimed, owner(q));

export function placeInfo(q: PlaceQuery): Promise<PlaceInfo | null> {
  const key = keyOf(q);
  const hit = mem.get(key);
  if (hit) return hit;
  let stored: { at: number; v: PlaceInfo | null } | null = null;
  try { stored = JSON.parse(localStorage.getItem(key) || "null"); } catch { /* ignore */ }
  const save = (v: PlaceInfo | null) => { try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), v })); } catch { /* full */ } return v; };
  let p: Promise<PlaceInfo | null>;
  if (stored && Date.now() - stored.at < TTL) {
    // A cached photo another stop already shows: look again for a different one.
    const f = stored.v?.image ? fileOf(stored.v.image) : "";
    const by = f ? claimed.get(f) : undefined;
    if (f && by && by !== owner(q)) p = fresh(q).then(save);
    else { if (f) claimed.set(f, owner(q)); p = Promise.resolve(stored.v); }
  } else p = fresh(q).then(save);
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
