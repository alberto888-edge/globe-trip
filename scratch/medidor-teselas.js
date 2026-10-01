// Globe Trip — medidor de teselas. Pegar en la consola de DevTools con la web abierta,
// moverse por el globo ~30 s (acercar, alejar, girar) y luego ejecutar: gtReport()
(() => {
  const log = (window.__gt = { reqs: [] });
  const desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  Object.defineProperty(HTMLImageElement.prototype, "src", {
    configurable: true,
    get() { return desc.get.call(this); },
    set(v) {
      if (typeof v === "string" && v.includes("api.mapbox.com")) {
        const z = +(v.match(/satellite\/(\d+)\//) || [])[1];
        const r = { z, url: v.split("?")[0], t0: performance.now(), state: "pendiente" };
        log.reqs.push(r);
        this.addEventListener("load", () => { r.state = "ok"; r.ms = Math.round(performance.now() - r.t0); }, { once: true });
        this.addEventListener("error", () => { r.state = "error"; r.ms = Math.round(performance.now() - r.t0); }, { once: true });
      }
      desc.set.call(this, v);
    },
  });
  window.gtReport = () => {
    const now = performance.now();
    const res = performance.getEntriesByType("resource").filter((e) => e.name.includes("api.mapbox.com"));
    const byUrl = new Map(res.map((e) => [e.name.split("?")[0], e]));
    const rows = {};
    for (const r of log.reqs) {
      const k = "z" + r.z;
      rows[k] ??= { pedidas: 0, ok: 0, error: 0, pendientes: 0, "pend >5s": 0, "ms medio ok": 0 };
      const row = rows[k];
      row.pedidas++;
      if (r.state === "ok") { row.ok++; row["ms medio ok"] += r.ms; }
      else if (r.state === "error") row.error++;
      else { row.pendientes++; if (now - r.t0 > 5000) row["pend >5s"]++; }
    }
    for (const row of Object.values(rows)) row["ms medio ok"] = row.ok ? Math.round(row["ms medio ok"] / row.ok) : 0;
    console.table(rows);
    const errs = log.reqs.filter((r) => r.state === "error").slice(0, 15).map((r) => {
      const e = byUrl.get(r.url);
      return { url: r.url.replace(/^.*satellite\//, ""), ms: r.ms, http: e?.responseStatus ?? "?", bytes: e?.transferSize ?? "?" };
    });
    if (errs.length) { console.log("Primeros errores:"); console.table(errs); }
    const protos = {};
    for (const e of res) protos[e.nextHopProtocol || "?"] = (protos[e.nextHopProtocol || "?"] || 0) + 1;
    const statuses = {};
    for (const e of res) statuses[e.responseStatus ?? "?"] = (statuses[e.responseStatus ?? "?"] || 0) + 1;
    console.log("Protocolo:", JSON.stringify(protos), " · Estados HTTP:", JSON.stringify(statuses));
    return "Copia estas tablas y pégaselas a Claude.";
  };
  console.log("Medidor de teselas activo. Muévete por el globo ~30 s y ejecuta gtReport()");
})();
