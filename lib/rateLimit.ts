// Best-effort per-visitor limit so a public link can't burn through the API key.
// In-memory: each serverless instance keeps its own window, which is enough to
// stop casual abuse. For hard guarantees, swap for Vercel KV / Upstash.

const WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, number[]>();

export function allow(key: string): boolean {
  const limit = Number(process.env.RATE_LIMIT_PER_10_MIN || 10);
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) { hits.set(key, recent); return false; }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return true;
}
