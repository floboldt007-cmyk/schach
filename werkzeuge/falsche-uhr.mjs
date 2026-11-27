// Falsche Uhr fuer Testlaeufe (T-072): verschiebt die Zeit in Node UND in jeder Browser-Seite um denselben Abstand,
// ohne einen Test zu aendern. So laesst sich ein Test, der nur zu bestimmten Uhrzeiten scheitert (Tagesgrenze 4 Uhr,
// UTC gegen Wanduhr), jederzeit nachstellen.
//
//   FAKE_ZEIT=2026-11-27T00:30:00Z PLAYWRIGHT_PFAD=... node --import ./werkzeuge/falsche-uhr.mjs tests/heim.test.mjs
//
// Wie die CI (ubuntu, UTC): TZ=UTC davor setzen; die Browser-Kontexte bekommen dann dieselbe Zone (timezoneId).
// Die Uhr laeuft ab FAKE_ZEIT normal weiter (nur verschoben, nicht eingefroren). Node: Date.now() und new Date() ohne
// Argument. Browser: jeder Kontext aus browser.newContext() (auch der von browser.newPage()) bekommt per addInitScript
// dieselbe Verschiebung, genau einmal. Gehakt wird das Playwright-Modul aus PLAYWRIGHT_PFAD bzw. 'playwright'
// (require-Cache: der Test bekommt dasselbe Objekt). Ohne FAKE_ZEIT (oder leer) tut das Werkzeug nichts und schweigt.
// Ist FAKE_ZEIT gesetzt, aber keine gueltige Zeit (Kaltreview I zu #305: "2026-13-99" lief still mit der echten Uhr,
// eine vertippte Rot-Probe sah dann gruen aus), bricht der Lauf mit Ausgang 2 ab. Gueltig ist nur ISO 8601
// (JJJJ-MM-TT, optional THH:MM[:SS[.sss]] und Z oder +HH:MM); Tage, die es nicht gibt (2026-02-30), zaehlen als ungueltig.
import { createRequire } from 'node:module';

const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;
// null = unlesbar. Date.parse allein reicht nicht: es rollt 2026-02-30 still auf den 2. Maerz weiter
export function leseFakeZeit(text) {
  const m = ISO.exec(String(text).trim());
  if (!m) return null;
  const [j, mo, t, h = 0, mi = 0, s = 0] = m.slice(1, 7).map((x) => (x === undefined ? undefined : Number(x)));
  const probe = new Date(Date.UTC(j, mo - 1, t, h, mi, s));
  if (probe.getUTCFullYear() !== j || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== t
    || probe.getUTCHours() !== h || probe.getUTCMinutes() !== mi || probe.getUTCSeconds() !== s) return null;
  const ms = Date.parse(String(text).trim());
  return Number.isFinite(ms) ? ms : null;
}

const roh = process.env.FAKE_ZEIT;
const ziel = roh ? leseFakeZeit(roh) : null;
if (roh && ziel === null) {
  process.stderr.write(`falsche-uhr: FAKE_ZEIT "${roh}" ist keine gueltige Zeit (erwartet ISO 8601, z. B. 2026-11-27T00:30:00Z);`
    + ' Abbruch, damit der Lauf nicht still mit der echten Uhr laeuft\n');
  process.exit(2);
}
if (ziel !== null) {
  const versatz = ziel - Date.now();
  const Echt = Date;
  // Klasse statt Proxy: instanceof, Date.parse/UTC und Prototyp bleiben die echten
  class Verschoben extends Echt {
    constructor(...a) { if (a.length) super(...a); else super(Echt.now() + versatz); }
    static now() { return Echt.now() + versatz; }
  }
  globalThis.Date = Verschoben;

  // in der Seite hoechstens einmal je Dokument (ein zweiter Einschub wuerde den Versatz verdoppeln)
  const seitenSkript = `(() => { if (globalThis.__falscheUhr) return; globalThis.__falscheUhr = true; const v = ${versatz}; const E = Date;
    class V extends E { constructor(...a) { if (a.length) super(...a); else super(E.now() + v); } static now() { return E.now() + v; } }
    globalThis.Date = V; })();`;
  const require = createRequire(import.meta.url);
  let pw = null;
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { pw = require(k); break; } catch (e) { /* naechster */ }
  }
  const GEHAKT = Symbol('falsche-uhr');
  // awaitet: newContext kommt erst zurueck, wenn der Einschub am Kontext haengt (Kaltreview I, Befund b). Gemessen hat
  // auch die alte Form ohne await nie gefehlt (0 von 80 Seiten direkt nach newContext); belegt ist es erst so.
  const hakeKontext = async (k) => {
    if (!k[GEHAKT]) { k[GEHAKT] = true; await k.addInitScript({ content: seitenSkript }); }
    return k;
  };
  // Zeitzone: TZ gilt fuer Node, Chromium unter Windows nimmt aber die Zone des Systems. Mit TZ bekommt jeder Kontext
  // dieselbe Zone als timezoneId (eine im Test gesetzte gewinnt), sonst rechnen Node und Seite in verschiedenen Zonen
  const zone = (o = {}) => (process.env.TZ && !o.timezoneId ? { ...o, timezoneId: process.env.TZ } : o);
  const hakeBrowser = (b) => {
    const neuerKontext = b.newContext.bind(b);
    b.newContext = async (o, ...a) => hakeKontext(await neuerKontext(zone(o), ...a));
    // browser.newPage() baut seinen Kontext ueber this.newContext (oben gehakt). Vorher kam hier ein zweiter Einschub
    // dazu und verdoppelte den Versatz nach der ersten Navigation (gemessen 27.11.: -27647 s statt 0). Der Haken bleibt
    // nur als Netz, falls eine Playwright-Fassung newContext umgeht; GEHAKT verhindert den zweiten Einschub.
    const neueSeite = b.newPage.bind(b);
    b.newPage = async (o, ...a) => { const s = await neueSeite(zone(o), ...a); await hakeKontext(s.context()); return s; };
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
