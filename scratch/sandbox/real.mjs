// Real site, real Chromium, real Mapbox. Logs every tile request and screenshots the result.
import { chromium } from "playwright";
import fs from "node:fs";
const W = 1919, H = 904;
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const t0 = Date.now();
const reqs = new Map();
const key = (u) => u.split("?")[0].replace(/^.*satellite\//, "");
page.on("request", (r) => { if (r.url().includes("api.mapbox.com")) reqs.set(r, { k: key(r.url()), z: +key(r.url()).split("/")[0], t: Date.now() - t0, st: "pendiente", phase: phase }); });
page.on("response", (res) => { const e = reqs.get(res.request()); if (e) { e.st = String(res.status()); e.ms = Date.now() - t0 - e.t; } });
page.on("requestfailed", (r) => { const e = reqs.get(r); if (e) { e.st = "fallo:" + (r.failure()?.errorText ?? "?"); e.ms = Date.now() - t0 - e.t; } });
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("console", m.type(), m.text().slice(0, 160)); });
let phase = "carga";
await page.goto("https://globe-trip-tau.vercel.app/", { waitUntil: "load" });
await page.waitForSelector("canvas", { timeout: 60000 });
await page.waitForTimeout(8000);
await page.screenshot({ path: "/tmp/s0-inicio.png" });
const cx = W / 2, cy = H / 2 - 60;
const zoomTo = async (ticks, name) => {
  phase = name;
  await page.mouse.move(cx, cy);
  for (let i = 0; i < ticks; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(60); }
  await page.waitForTimeout(12000);
  await page.screenshot({ path: `/tmp/s-${name}.png` });
};
const drag = async (dx, dy) => {
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let i = 1; i <= 20; i++) { await page.mouse.move(cx + (dx * i) / 20, cy + (dy * i) / 20); await page.waitForTimeout(16); }
  await page.mouse.up();
};
await zoomTo(Number(process.env.T1 ?? 6), "zoom1");
await zoomTo(Number(process.env.T2 ?? 6), "zoom2");
await zoomTo(Number(process.env.T3 ?? 6), "zoom3");
phase = "girar"; await drag(-300, 0); await page.waitForTimeout(12000); await page.screenshot({ path: "/tmp/s-girar.png" });
// Summary
const rows = {};
for (const e of reqs.values()) {
  const r = (rows[`${e.phase} z${e.z}`] ??= { pedidas: 0 });
  r.pedidas++; r[e.st] = (r[e.st] ?? 0) + 1;
}
console.log(JSON.stringify(rows, null, 1));
const all = [...reqs.values()];
const ok = all.filter((e) => e.st === "200").map((e) => e.ms).sort((a, b) => a - b);
console.log("total", all.length, "ok", ok.length, "mediana ms", ok[ok.length >> 1], "p95 ms", ok[Math.floor(ok.length * 0.95)]);
console.log("no-200:", JSON.stringify(all.filter((e) => e.st !== "200").slice(0, 25)));
fs.writeFileSync("/tmp/reqs.json", JSON.stringify(all));
await browser.close();
