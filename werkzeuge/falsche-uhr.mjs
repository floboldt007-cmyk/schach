// Falsche Uhr fuer Testlaeufe (T-072): verschiebt die Zeit in Node UND in jeder Browser-Seite um denselben Abstand,
// ohne einen Test zu aendern. So laesst sich ein Test, der nur zu bestimmten Uhrzeiten scheitert (Tagesgrenze 4 Uhr,
// UTC gegen Wanduhr), jederzeit nachstellen.
//
//   FAKE_ZEIT=2026-11-27T00:30:00Z PLAYWRIGHT_PFAD=... node --import ./werkzeuge/falsche-uhr.mjs tests/heim.test.mjs
//
// Wie die CI (ubuntu, UTC): TZ=UTC davor setzen; die Browser-Kontexte bekommen dann dieselbe Zone (timezoneId).
// Die Uhr laeuft ab FAKE_ZEIT normal weiter (nur verschoben, nicht eingefroren). Node: Date.now() und new Date() ohne
// Argument. Browser: jede Seite aus browser.newContext()/newPage() bekommt per addInitScript dieselbe Verschiebung.
// Gehakt wird das Playwright-Modul aus PLAYWRIGHT_PFAD bzw. 'playwright' (require-Cache: der Test bekommt dasselbe
// Objekt). Ohne FAKE_ZEIT tut das Werkzeug nichts.
import { createRequire } from 'node:module';

const ziel = process.env.FAKE_ZEIT ? Date.parse(process.env.FAKE_ZEIT) : NaN;
if (Number.isFinite(ziel)) {
  const versatz = ziel - Date.now();
  const Echt = Date;
  // Klasse statt Proxy: instanceof, Date.parse/UTC und Prototyp bleiben die echten
  class Verschoben extends Echt {
    constructor(...a) { if (a.length) super(...a); else super(Echt.now() + versatz); }
    static now() { return Echt.now() + versatz; }
  }
  globalThis.Date = Verschoben;

  const seitenSkript = `(() => { const v = ${versatz}; const E = Date;
    class V extends E { constructor(...a) { if (a.length) super(...a); else super(E.now() + v); } static now() { return E.now() + v; } }
    globalThis.Date = V; })();`;
  const require = createRequire(import.meta.url);
  let pw = null;
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { pw = require(k); break; } catch (e) { /* naechster */ }
  }
  const hakeKontext = (k) => { k.addInitScript({ content: seitenSkript }); return k; };
  // Zeitzone: TZ gilt fuer Node, Chromium unter Windows nimmt aber die Zone des Systems. Mit TZ bekommt jeder Kontext
  // dieselbe Zone als timezoneId (eine im Test gesetzte gewinnt), sonst rechnen Node und Seite in verschiedenen Zonen
  const zone = (o = {}) => (process.env.TZ && !o.timezoneId ? { ...o, timezoneId: process.env.TZ } : o);
  const hakeBrowser = (b) => {
    const neuerKontext = b.newContext.bind(b);
    b.newContext = async (o, ...a) => hakeKontext(await neuerKontext(zone(o), ...a));
    const neueSeite = b.newPage.bind(b);
    // newPage legt einen eigenen Kontext an: das Skript haengt an diesem Kontext
    b.newPage = async (o, ...a) => { const s = await neueSeite(zone(o), ...a); await s.context().addInitScript({ content: seitenSkript }); return s; };
    return b;
  };
  for (const name of ['chromium', 'webkit', 'firefox']) {
    const typ = pw && pw[name];
    if (!typ) continue;
    const start = typ.launch.bind(typ);
    typ.launch = async (...a) => hakeBrowser(await start(...a));
  }
  process.stderr.write(`falsche-uhr: ${new Echt(ziel).toISOString()} (Versatz ${Math.round(versatz / 1000)} s)${pw ? '' : ', ohne Playwright'}\n`);
}
