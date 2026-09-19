// Link helpers safe to use in the browser and on the server.

export type Platform = "tiktok" | "instagram";

export function toUrl(raw: string): URL | null {
  const s = raw.trim();
  if (!s || /\s/.test(s)) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return u.hostname.includes(".") ? u : null;
  } catch {
    return null;
  }
}

export function detectPlatform(raw: string): Platform | null {
  const url = toUrl(raw);
  if (!url) return null;
  const host = url.hostname.replace(/^www\.|^m\./, "");
  if (/(^|\.)tiktok\.com$/.test(host)) return "tiktok";
  if (/(^|\.)instagram\.com$/.test(host) || host === "instagr.am") return "instagram";
  return null;
}
