// Sofort-Suche (Punkt 40, Konzept "Zwei Ligen" Abschnitt 3 und 4 "Suchen"): gemeinsamer Ablauf js/gegnersuche.js mit
// einem Ersatz fuer die Server-Funktionen. Beide Faelle: neues SQL (warte_s, ki_ab_s, seit, zeit) und altes SQL
// (nur { wartet: true }, dann gilt die bisherige Logik mit 10 s). Ohne DOM, kurze echte Wartezeiten.
// node tests/gegnersuche.test.mjs
import assert from 'node:assert/strict';
import { gegnersuche, lageAus, WARTE_ALT_S } from '../js/gegnersuche.js';

const ergebnisse = [];
async function pruefe(name, fn) {
  try { await fn(); ergebnisse.push({ name, ok: true }); console.log('ok   ' + name); }
  catch (e) { ergebnisse.push({ name, ok: false }); console.error('FEHLER ' + name + ': ' + e.message); }
}
const warte = (ms) => new Promise((ok) => setTimeout(ok, ms));
const NAMEN = { start: 's', stand: 'st', ende: 'e' };

// Ersatz-Server: antworten[name] ist ein Wert oder eine Funktion (daten, n) -> Wert; Fehler-Objekte werden geworfen
function server(antworten) {
  const rufe = [];
  return {
    rufe,
    aufruf: async (name, daten) => {
      rufe.push({ name, daten });
      const a = antworten[name];
      const w = typeof a === 'function' ? a(daten, rufe.filter((r) => r.name === name).length) : a;
      if (w instanceof Error) throw w;
      return w;
    },
    zahl: (name, pruef = () => true) => rufe.filter((r) => r.name === name && pruef(r.daten)).length,
  };
}
function suche(srv, mehr = {}) {
  const log = { treffer: [], ki: [], fehler: [], lage: [] };
  const h = gegnersuche({ rufe: srv.aufruf, namen: NAMEN, startDaten: { zeit: '5+3' }, alleMs: 20,
    idVon: (d) => (d && typeof d.id === 'string' ? d.id : null), belegVon: (d) => (d && typeof d.beleg === 'string' ? d.beleg : null),
    beiTreffer: (id) => log.treffer.push(id), beiKi: (x) => log.ki.push(x), beiFehler: (e) => log.fehler.push(e), beiLage: (l) => log.lage.push(l), ...mehr });
  return { h, log };
}
const neu = (o = {}) => ({ wartet: true, seit: new Date().toISOString(), warte_s: 0.3, ki_ab_s: 0.1, zeit: '5+3', ...o });

await pruefe('lageAus: neue Felder lesen, altes SQL und Unsinn ergeben null', () => {
  const jetzt = Date.parse('2026-11-10T12:00:30Z');
  assert.deepEqual(lageAus({ wartet: true, seit: '2026-11-10T12:00:18Z', warte_s: 30, ki_ab_s: 10, zeit: '5+3' }, jetzt),
    { warteMs: 30000, kiAbMs: 10000, vergangenMs: 12000, zeit: '5+3' });
  assert.equal(lageAus({ wartet: true }, jetzt), null, 'altes SQL');
  assert.equal(lageAus({ partie: 'p' }, jetzt), null);
  assert.equal(lageAus(null, jetzt), null);
  assert.equal(lageAus({ wartet: true, warte_s: '30' }, jetzt), null, 'Text statt Zahl');
  assert.equal(lageAus({ wartet: true, warte_s: 0 }, jetzt), null);
  assert.equal(lageAus({ wartet: true, warte_s: 3600 }, jetzt), null, 'unplausibel lang');
  // ki_ab_s fehlt oder liegt hinter warte_s: KI erst nach der ganzen Wartezeit
  assert.equal(lageAus({ wartet: true, warte_s: 30 }, jetzt).kiAbMs, 30000);
  assert.equal(lageAus({ wartet: true, warte_s: 30, ki_ab_s: 40 }, jetzt).kiAbMs, 30000);
  // seit fehlt oder liegt weit weg (Geraeteuhr falsch): keine Angabe, die App zaehlt ab dem Start
  assert.equal(lageAus({ wartet: true, warte_s: 30 }, jetzt).vergangenMs, null);
  assert.equal(lageAus({ wartet: true, warte_s: 30, seit: '2026-11-10T11:00:00Z' }, jetzt).vergangenMs, null);
  assert.equal(lageAus({ wartet: true, warte_s: 30, seit: '2026-11-10T12:01:00Z' }, jetzt).vergangenMs, null);
  assert.equal(lageAus({ wartet: true, warte_s: 30, seit: '2026-11-10T12:00:31Z' }, jetzt).vergangenMs, 0, 'kleiner Vorlauf: 0');
  assert.equal(lageAus({ wartet: true, warte_s: 30, zeit: '5 Minuten' }, jetzt).zeit, null);
});

await pruefe('altes SQL: 10 s wie bisher, kein frueher Wechsel, vomServer false', async () => {
  const srv = server({ s: { wartet: true }, st: { wartet: true }, e: {} });
  const { h, log } = suche(srv);
  await warte(60);
  const l = h.lage();
  assert.equal(WARTE_ALT_S, 10);
  assert.equal(l.warteMs, 10000); assert.equal(l.kiAbMs, 10000); assert.equal(l.vomServer, false); assert.equal(l.zeit, null); assert.equal(l.laeuft, true);
  assert.equal(log.lage.length, 0);
  assert.equal(h.jetztKi(), false, 'vor 10 s kein Wechsel ueber den Server');
  assert.equal(srv.zahl('e'), 0);
  h.stopp(); h.stopp();
  assert.equal(srv.zahl('e', (d) => d.ki === false), 1, 'genau ein ende(false)');
  assert.deepEqual(srv.rufe[0], { name: 's', daten: { zeit: '5+3' } });
});

await pruefe('altes SQL: nach der Wartezeit ende(true), Beleg geht an beiKi', async () => {
  const srv = server({ s: { wartet: true }, st: { wartet: true }, e: (d) => (d.ki ? { beleg: 'r1' } : {}) });
  const { log } = suche(srv, { warteMs: 80 });
  await warte(200);
  assert.deepEqual(log.ki, [{ beleg: 'r1', fehler: null }]);
  assert.equal(srv.zahl('e', (d) => d.ki === true), 1);
  assert.equal(log.treffer.length, 0);
});

await pruefe('neues SQL: Wartezeit und KI-Grenze vom Server, Knopf erst ab ki_ab_s', async () => {
  const srv = server({ s: neu(), st: neu(), e: (d) => (d.ki ? { beleg: 'r2' } : {}) });
  const { h, log } = suche(srv);
  await warte(30);
  const l = h.lage();
  assert.equal(l.vomServer, true); assert.equal(l.warteMs, 300); assert.equal(l.kiAbMs, 100); assert.equal(l.zeit, '5+3');
  assert.equal(log.lage.length, 1, 'beiLage genau einmal');
  assert.equal(h.jetztKi(), false, 'vor ki_ab_s');
  await warte(110);
  assert.equal(h.jetztKi(), true, 'ab ki_ab_s');
  assert.equal(h.jetztKi(), false, 'nur einmal');
  assert.equal(h.lage().laeuft, false, 'nach dem Wechsel laeuft die Suche nicht mehr');
  await warte(30);
  assert.deepEqual(log.ki, [{ beleg: 'r2', fehler: null }]);
  assert.equal(srv.zahl('e'), 1);
  await warte(250);
  assert.equal(log.ki.length, 1, 'die Uhr feuert danach nicht noch einmal');
});

await pruefe('neues SQL: ohne Knopf nach warte_s von selbst zur KI', async () => {
  const srv = server({ s: neu({ warte_s: 0.15 }), st: neu({ warte_s: 0.15 }), e: (d) => (d.ki ? { beleg: 'r3' } : {}) });
  const { log } = suche(srv);
  await warte(100);
  assert.equal(log.ki.length, 0);
  await warte(150);
  assert.deepEqual(log.ki, [{ beleg: 'r3', fehler: null }]);
});

await pruefe('neues SQL: Uhr zaehlt ab seit des Servers (Suche lief schon 0,2 s)', async () => {
  const seit = new Date(Date.now() - 200).toISOString();
  const srv = server({ s: neu({ seit, warte_s: 0.3 }), st: neu({ seit, warte_s: 0.3 }), e: { beleg: 'r4' } });
  const { h, log } = suche(srv);
  await warte(20);
  assert.ok(h.lage().vergangenMs >= 200, 'vergangen ' + h.lage().vergangenMs);
  await warte(130);
  assert.equal(log.ki.length, 1, 'nach rund 0,1 s Rest zur KI');
});

await pruefe('Treffer beim Abfragen: beiTreffer, nie zur KI', async () => {
  const srv = server({ s: neu(), st: (d, n) => (n >= 2 ? { id: 'partie-1' } : neu()), e: { beleg: 'x' } });
  const { h, log } = suche(srv);
  await warte(120);
  assert.deepEqual(log.treffer, ['partie-1']);
  assert.equal(h.jetztKi(), false);
  await warte(300);
  assert.equal(log.ki.length, 0); assert.equal(srv.zahl('e'), 0);
});

await pruefe('Treffer gleich beim Start', async () => {
  const srv = server({ s: { id: 'p0' }, st: neu(), e: {} });
  const { log } = suche(srv);
  await warte(40);
  assert.deepEqual(log.treffer, ['p0']); assert.equal(srv.zahl('st'), 0);
});

await pruefe('kein Beleg, aber die Paarung kam gerade noch: zum Menschen', async () => {
  const srv = server({ s: neu(), st: (d, n) => (srv.zahl('e') ? { id: 'spaet' } : neu()), e: {} });
  const { h, log } = suche(srv);
  await warte(120);
  h.jetztKi();
  await warte(40);
  assert.deepEqual(log.treffer, ['spaet']); assert.equal(log.ki.length, 0);
});

await pruefe('kein Beleg und keine Paarung: beiKi ohne Beleg; offline: beiKi mit Fehler', async () => {
  const a = server({ s: neu(), st: neu(), e: {} });
  const x = suche(a);
  await warte(120); x.h.jetztKi(); await warte(40);
  assert.deepEqual(x.log.ki, [{ beleg: null, fehler: null }]);
  const fehler = new Error('offline');
  const b = server({ s: neu(), st: neu(), e: fehler });
  const y = suche(b);
  await warte(120); y.h.jetztKi(); await warte(40);
  assert.equal(y.log.ki.length, 1); assert.equal(y.log.ki[0].beleg, null); assert.equal(y.log.ki[0].fehler, fehler);
});

await pruefe('Start scheitert: beiFehler, keine KI, keine Abfrage', async () => {
  const srv = server({ s: new Error('abgemeldet'), st: neu(), e: {} });
  const { h, log } = suche(srv, { warteMs: 60 });
  await warte(150);
  assert.equal(log.fehler.length, 1); assert.equal(log.ki.length, 0); assert.equal(srv.zahl('st'), 0);
  assert.equal(h.jetztKi(), false);
});

await pruefe('stopp waehrend der Suche: nichts kommt mehr', async () => {
  const srv = server({ s: neu(), st: neu(), e: {} });
  const { h, log } = suche(srv);
  await warte(50);
  h.stopp();
  await warte(350);
  assert.equal(log.ki.length + log.treffer.length + log.fehler.length, 0);
  assert.equal(srv.zahl('e', (d) => d.ki === true), 0); assert.equal(srv.zahl('e', (d) => d.ki === false), 1);
});

await pruefe('Test-Wartezeit (warteMs) schlaegt warte_s, KI-Grenze hoechstens so lang', async () => {
  const srv = server({ s: neu({ warte_s: 30, ki_ab_s: 10 }), st: neu({ warte_s: 30, ki_ab_s: 10 }), e: { beleg: 'f' } });
  const { h, log } = suche(srv, { warteMs: 90 });
  await warte(20);
  assert.equal(h.lage().warteMs, 90); assert.equal(h.lage().kiAbMs, 90);
  await warte(120);
  assert.equal(log.ki.length, 1);
});

const fehler = ergebnisse.filter((e) => !e.ok).length;
console.log(`\n${ergebnisse.length - fehler} von ${ergebnisse.length} ok`);
if (fehler) process.exitCode = 1;
