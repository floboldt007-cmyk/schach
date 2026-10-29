// Tests fuer die Erweiterungspunkte aus Runde 4: js/ereignisse.js (Ereignis-Bus), js/orte.js
// (Anzeige-Orte), js/feier.js (Feier-Warteschlange mit Budget) und die Register fuer Klaenge
// (js/sounds.js, mit einer Fake-AudioContext), Saetze (js/bots.js) und Icons (js/ui/icons.js).
// Node, ohne Browser: node tests/ereignisse.test.mjs
import { EREIGNISSE, hoere, sende, protokoll, zuruecksetzen } from '../js/ereignisse.js';
import { ORTE, anbieten, fuelle, waehle, angeboten, zuruecksetzen as orteZuruecksetzen } from '../js/orte.js';
import { BUDGET, QUELLEN, BRETT_FEIER, melde, fuerOverlay, nachlese, setzeUhr } from '../js/feier.js';
import { setzeSpeicher, MODUL_BUDGET } from '../js/storage.js';
import { BOTS, botSatz, registriereSaetze, PLATZHALTER } from '../js/bots.js';
import { icon, registriereIcon, iconNamen } from '../js/ui/icons.js';
import { readFileSync } from 'node:fs';

let ok = 0;
let fehler = 0;
function pruefe(name, bedingung, info) {
  if (bedingung) { ok++; console.log('OK     ' + name); } else { fehler++; console.log('FEHLER ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : '')); }
}
function wirft(fn, muster) {
  try { fn(); } catch (e) { return !muster || muster.test(e.message); }
  return false;
}
// console.error/warn waehrend fn mitzaehlen (und nicht ausgeben)
function stillMit(fn) {
  const alt = { error: console.error, warn: console.warn };
  const meldungen = [];
  console.error = (...a) => meldungen.push(['error', a.map(String).join(' ')]);
  console.warn = (...a) => meldungen.push(['warn', a.map(String).join(' ')]);
  try { fn(); } finally { console.error = alt.error; console.warn = alt.warn; }
  return meldungen;
}

// =====================================================================
// Ereignis-Bus
// =====================================================================
const TABELLE = ['app:bereit', 'app:screen', 'app:sichtbar', 'partie:gestartet', 'partie:verlassen', 'zug:gespielt',
  'stellung:analysiert', 'zug:bewertet', 'zug:zurueckgenommen', 'hilfe:genutzt', 'partie:beendet', 'partie:analysiert',
  'analyse:gesehen', 'speicher:fehler', 'training:geloest', 'training:stand', 'uebung:ergebnis', 'bestmarke:neu',
  // P4 Liga (ARCHITEKTUR.md, Tabelle der Ereignisse)
  'liga:geaendert',
  // w0-fix: "Fortschritt zuruecksetzen" meldet sich (Pakete leeren ihren Zustand im Arbeitsspeicher)
  'speicher:zurueckgesetzt',
  // W0+a "Spiel-Fundament" (SPIELKONZEPT 6.2 und 3.18)
  'funken:gebucht', 'level:aufstieg', 'tag:gezaehlt', 'raetsel:geloest', 'raetsel:wort', 'lektion:beendet', 'boss:treffer', 'boss:siegel',
  'rekord:neu', 'uhr:knapp', 'zug:abgelehnt',
  // Paket funken (S1-1): { funken, level, delta, aufstieg } einmal je Ereignis mit Buchungen
  'funken:geaendert',
  // Paket boss (S1-6) nach dem Laden von daten/boss/spielplan.json; funken liest den Spielplan erst danach (P1-Nachbesserung)
  'spielplan:geladen',
  // Paket punkte (S1-3): { punkte, platz, tafel, rekord } je bewerteter Partie
  'punkte:geaendert',
  // Paket serie (P3): { tag, lauf, meilenstein, ... } nach jedem gezaehlten Tag und jeder Aenderung am Siegeslauf
  'serie:geaendert'];
pruefe('EREIGNISSE: genau die Namen aus der Tabelle (BAUPLAN 3.3, dazu speicher:zurueckgesetzt, W0+a, liga:geaendert (P4), funken:geaendert, spielplan:geladen, punkte:geaendert und serie:geaendert)',EREIGNISSE.length === TABELLE.length && TABELLE.every((n) => EREIGNISSE.includes(n)), EREIGNISSE);
pruefe('EREIGNISSE: eingefroren', Object.isFrozen(EREIGNISSE));

zuruecksetzen();
{
  const empfangen = [];
  const ab1 = hoere('zug:bewertet', (d) => empfangen.push(['eins', d.ply]));
  const ab2 = hoere('zug:bewertet', (d) => empfangen.push(['zwei', d.ply]));
  sende('zug:bewertet', { ply: 4 });
  pruefe('hoere/sende: beide Hoerer in Anmelde-Reihenfolge', JSON.stringify(empfangen) === '[["eins",4],["zwei",4]]', empfangen);
  ab1();
  sende('zug:bewertet', { ply: 5 });
  pruefe('abmelden: nur noch der zweite Hoerer', JSON.stringify(empfangen.slice(2)) === '[["zwei",5]]', empfangen);
  ab1();
  ab2();
  ab2();
  sende('zug:bewertet', { ply: 6 });
  pruefe('abmelden ist idempotent, danach kein Hoerer mehr', empfangen.length === 3);
  sende('partie:beendet', { ply: 1 });
  pruefe('anderes Ereignis erreicht die Hoerer nicht', empfangen.length === 3);

  // dieselbe Funktion zweimal angemeldet: zwei Aufrufe, Abmelden trennt sauber
  let n = 0;
  const f = () => { n++; };
  const a = hoere('app:screen', f);
  hoere('app:screen', f);
  sende('app:screen', {});
  a();
  sende('app:screen', {});
  pruefe('gleiche Funktion zweimal: zwei Aufrufe, Abmelden nimmt nur eine', n === 3, n);
}

zuruecksetzen();
pruefe('unbekannter Name in hoere wirft (Tippfehler)', wirft(() => hoere('zug:bewertett', () => {}), /Unbekanntes Ereignis/));
pruefe('unbekannter Name in sende wirft', wirft(() => sende('partie:ende', {}), /Unbekanntes Ereignis/));
pruefe('hoere ohne Funktion wirft', wirft(() => hoere('app:bereit', null)));

{
  zuruecksetzen();
  const original = { laufId: 'l1', liste: [1, 2] };
  let gesehen = null;
  let schreibFehler = false;
  hoere('partie:gestartet', (d) => {
    gesehen = d;
    try { d.laufId = 'boese'; } catch (e) { schreibFehler = true; }
  });
  sende('partie:gestartet', original);
  pruefe('Daten flach eingefroren', Object.isFrozen(gesehen) && gesehen.laufId === 'l1');
  pruefe('Schreiben in die Daten scheitert (strikter Modus)', schreibFehler);
  pruefe('Objekt des Senders bleibt veraenderbar', !Object.isFrozen(original) && gesehen !== original);
  pruefe('flach: innere Objekte sind dieselben (keine teure Kopie)', gesehen.liste === original.liste);
  let leer = null;
  hoere('app:bereit', (d) => { leer = d; });
  sende('app:bereit');
  pruefe('sende ohne Daten: leeres eingefrorenes Objekt', leer && Object.keys(leer).length === 0 && Object.isFrozen(leer));
}

{
  zuruecksetzen();
  const reihe = [];
  hoere('zug:gespielt', () => reihe.push('a'));
  hoere('zug:gespielt', () => { throw new Error('kaputt'); });
  hoere('zug:gespielt', () => reihe.push('c'));
  const meldungen = stillMit(() => sende('zug:gespielt', { ply: 0 }));
  pruefe('Fehler in einem Hoerer stoppt die anderen nicht', reihe.join('') === 'ac', reihe);
  pruefe('Fehler im Hoerer landet als console.error', meldungen.length === 1 && meldungen[0][0] === 'error' && /zug:gespielt/.test(meldungen[0][1]), meldungen);
}

{
  zuruecksetzen();
  const reihe = [];
  hoere('partie:beendet', () => { reihe.push('beendet'); sende('bestmarke:neu', { wert: 1 }); });
  hoere('bestmarke:neu', () => reihe.push('bestmarke'));
  sende('partie:beendet', {});
  pruefe('verschachteltes Senden aus einem Hoerer', reihe.join(',') === 'beendet,bestmarke', reihe);

  // Abmelden waehrend des Sendens: das laufende Ereignis kommt noch an, das naechste nicht
  zuruecksetzen();
  const log = [];
  let abB = null;
  hoere('zug:zurueckgenommen', () => { log.push('A'); if (abB) abB(); });
  abB = hoere('zug:zurueckgenommen', () => log.push('B'));
  sende('zug:zurueckgenommen', {});
  sende('zug:zurueckgenommen', {});
  pruefe('Abmelden waehrend des Sendens: Momentaufnahme der Hoerer', log.join('') === 'ABA', log);
}

{
  zuruecksetzen();
  for (let i = 0; i < 250; i++) sende(i % 2 ? 'zug:gespielt' : 'zug:bewertet', { ply: i });
  const p = protokoll();
  pruefe('Protokoll in Node aktiv, hoechstens 200 Eintraege', p.length === 200, p.length);
  pruefe('Protokoll: Eintraege { name, t }, neuester zuletzt', p[199].name === 'zug:gespielt' && typeof p[0].t === 'number'
    && Object.keys(p[0]).join(',') === 'name,t' && p[0].t <= p[199].t);
  p.length = 0;
  pruefe('protokoll() liefert eine Kopie', protokoll().length === 200);
  let n = 0;
  hoere('app:bereit', () => { n++; });
  zuruecksetzen();
  sende('app:bereit', {});
  pruefe('zuruecksetzen: Protokoll leer bis auf das neue Ereignis, Hoerer weg', protokoll().length === 1 && n === 0);
}

{
  // Messung: sende ohne Hoerer unter 0,05 ms (Ziel BAUPLAN 3.10)
  zuruecksetzen();
  const daten = { laufId: 'l123', ply: 12, uci: 'e2e4', klasse: 'bester', serie: 3 };
  const N = 200000;
  for (let i = 0; i < 2000; i++) sende('zug:bewertet', daten);
  let t0 = performance.now();
  for (let i = 0; i < N; i++) sende('zug:bewertet', daten);
  const ohne = (performance.now() - t0) / N;
  hoere('zug:bewertet', () => {});
  t0 = performance.now();
  for (let i = 0; i < N; i++) sende('zug:bewertet', daten);
  const mit = (performance.now() - t0) / N;
  console.log(`       Messung: sende ohne Hoerer ${(ohne * 1000).toFixed(3)} µs, mit einem Hoerer ${(mit * 1000).toFixed(3)} µs je Aufruf`);
  pruefe('sende ohne Hoerer unter 0,05 ms', ohne < 0.05, ohne);
  pruefe('sende mit einem leeren Hoerer unter 0,05 ms', mit < 0.05, mit);
  zuruecksetzen();
}

// =====================================================================
// Anzeige-Orte
// =====================================================================
// Mini-DOM: Elemente mit nodeType, parentNode, appendChild, removeChild
function el(name) {
  return {
    nodeType: 1, name, parentNode: null, kinder: [],
    appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); this.kinder.push(c); c.parentNode = this; return c; },
    removeChild(c) { const i = this.kinder.indexOf(c); if (i >= 0) this.kinder.splice(i, 1); c.parentNode = null; return c; },
  };
}
const namen = (c) => c.kinder.map((k) => k.name).join(',');

const ORT_TABELLE = {
  'arena:kopf': 'dom', 'arena:panel-oben': 'dom', 'arena:panel-bot': 'dom', 'arena:start': 'aufruf',
  'partie:begruessung?': 'wahl', 'ergebnis:karte': 'dom', 'analyse:coach': 'dom', 'analyse:oben': 'dom',
  'verlauf:seite': 'dom', 'einstellungen:gruppen': 'dom', 'app:erster-screen?': 'wahl',
  // W0+a (SPIELKONZEPT 6.2)
  'arena:heute': 'dom', 'partie:gegner-leiste': 'dom', 'partie:matt': 'aufruf', 'ergebnis:abrechnung': 'dom',
  'bestenliste:reiter': 'dom', 'training:karten': 'dom', 'ich:vitrine': 'dom', 'spielplan:tage': 'dom',
  // w0plus-a-fix: Schub 2b (Flamme an Flos Namen, Emote-Rad und Schnell-Chat in der Knopfreihe)
  'partie:spieler-leiste': 'dom', 'partie:aktionen': 'dom',
  // Premium-Umbau U5: Plaetze auf der Weltkarte (Zelt des Wochen-Boss, Event-Fahne), Host arena.js
  'arena:karte-boss': 'dom', 'arena:karte-event': 'dom',
};
pruefe('ORTE: alle Orte der Tabelle (BAUPLAN 3.4) mit ihrer Art', JSON.stringify(Object.entries(ORTE).sort()) === JSON.stringify(Object.entries(ORT_TABELLE).sort()), ORTE);
pruefe('ORTE: eingefroren', Object.isFrozen(ORTE));
pruefe('ORTE: genau die Wahl-Orte enden auf "?"', Object.entries(ORTE).every(([o, art]) => (art === 'wahl') === o.endsWith('?')));
pruefe('anbieten an unbekanntem Ort wirft', wirft(() => anbieten('arena:kopff', () => null), /Unbekannter Anzeige-Ort/));
pruefe('anbieten ohne Funktion wirft', wirft(() => anbieten('arena:kopf', 'x')));
pruefe('fuelle an unbekanntem Ort wirft', wirft(() => fuelle('nirgends', el('c'), {})));

{
  orteZuruecksetzen();
  const c = el('kopf-chips');
  c.appendChild(el('sterne'));
  c.appendChild(el('pokal'));
  anbieten('arena:kopf', () => el('training'), { reihenfolge: 30, paket: '1C' });
  anbieten('arena:kopf', () => el('rang'), { reihenfolge: 10, paket: '2A' });
  anbieten('arena:kopf', () => el('kette'), { reihenfolge: 20, paket: '1D' });
  anbieten('arena:kopf', () => el('kette-b'), { reihenfolge: 20, paket: '1D-b' });
  anbieten('arena:kopf', () => null, { reihenfolge: 5 });
  const r = fuelle('arena:kopf', c, { fortschritt: {} });
  pruefe('fuelle: Reihenfolge nach Zahl, bei Gleichstand nach Anmeldung', namen(c) === 'sterne,pokal,rang,kette,kette-b,training', namen(c));
  pruefe('fuelle: null zaehlt nicht, anzahl stimmt', r.anzahl === 4, r.anzahl);
  r.verlasse();
  pruefe('verlasse: angehaengte Elemente wieder heraus, vorhandene bleiben', namen(c) === 'sterne,pokal', namen(c));
  r.verlasse();
  pruefe('verlasse: idempotent', namen(c) === 'sterne,pokal');
}

{
  orteZuruecksetzen();
  const c = el('detail');
  let verlassen = 0;
  let kontextGesehen = null;
  const meldungen = stillMit(() => {
    anbieten('arena:panel-oben', (k) => { kontextGesehen = k; return { el: el('heute'), verlasse() { verlassen++; } }; }, { reihenfolge: 20 });
    anbieten('arena:panel-oben', () => { throw new Error('Anbieter kaputt'); }, { reihenfolge: 10, paket: 'kaputt' });
    anbieten('arena:panel-oben', () => 'kein Element', { reihenfolge: 15, paket: 'falsch' });
    anbieten('arena:panel-oben', () => el('tipp'), { reihenfolge: 90 });
    const kontext = { app: { name: 'app' }, bot: { id: 'rudi' } };
    const r = fuelle('arena:panel-oben', c, kontext);
    pruefe('werfender Anbieter macht den Host nicht kaputt', namen(c) === 'heute,tipp' && r.anzahl === 2, namen(c));
    pruefe('Kontext flach eingefroren, Original nicht', Object.isFrozen(kontextGesehen) && !Object.isFrozen(kontext) && kontextGesehen.app === kontext.app);
    r.verlasse();
    pruefe('verlasse ruft verlasse() des Anbieters und raeumt auf', verlassen === 1 && c.kinder.length === 0, { verlassen, n: c.kinder.length });
  });
  pruefe('Fehler der Anbieter landen als console.error (mit Paketname)', meldungen.filter((m) => m[0] === 'error').length === 2
    && meldungen.some((m) => /kaputt/.test(m[1]) && /arena:panel-oben/.test(m[1])), meldungen);
}

{
  orteZuruecksetzen();
  const ab = anbieten('verlauf:seite', () => el('kartei'), { reihenfolge: 30 });
  const c = el('vl-seite');
  fuelle('verlauf:seite', c, {});
  ab();
  ab();
  const c2 = el('vl-seite-2');
  fuelle('verlauf:seite', c2, {});
  pruefe('abmelden: Anbieter erscheint danach nicht mehr', namen(c) === 'kartei' && c2.kinder.length === 0);
  pruefe('fuelle ohne Anbieter: anzahl 0', fuelle('analyse:oben', el('x'), {}).anzahl === 0);
  pruefe('fuelle an einem Wahl-Ort wirft', wirft(() => fuelle('partie:begruessung?', el('x'), {})));
  pruefe('waehle an einem DOM-Ort wirft', wirft(() => waehle('arena:kopf', {})));
}

{
  orteZuruecksetzen();
  pruefe('waehle ohne Anbieter: null', waehle('partie:begruessung?', {}) === null);
  const reihe = [];
  stillMit(() => {
    anbieten('partie:begruessung?', () => { reihe.push('b'); return { anlass: 'revanche' }; }, { reihenfolge: 20 });
    anbieten('partie:begruessung?', () => { reihe.push('a'); return null; }, { reihenfolge: 10 });
    anbieten('partie:begruessung?', () => { reihe.push('kaputt'); throw new Error('x'); }, { reihenfolge: 5 });
    anbieten('partie:begruessung?', () => { reihe.push('c'); return { anlass: 'kennenlernen' }; }, { reihenfolge: 30 });
    const w = waehle('partie:begruessung?', { bot: { id: 'hilde' }, partienGegenBot: [] });
    pruefe('waehle: erster Wert != null in der Reihenfolge', w && w.anlass === 'revanche' && reihe.join(',') === 'kaputt,a,b', { w, reihe });
  });
  anbieten('app:erster-screen?', () => false, { reihenfolge: 10 });
  anbieten('app:erster-screen?', () => 'start', { reihenfolge: 20 });
  pruefe('waehle: auch false ist ein Wert (nur null/undefined wird uebersprungen)', waehle('app:erster-screen?', { partienZahl: 0 }) === false);
  let kontextGesehen = null;
  orteZuruecksetzen();
  anbieten('app:erster-screen?', (k) => { kontextGesehen = k; return 'start'; });
  pruefe('waehle: Kontext eingefroren', waehle('app:erster-screen?', { partienZahl: 0 }) === 'start' && Object.isFrozen(kontextGesehen));
}

{
  orteZuruecksetzen();
  let gefahren = 0;
  let abgebrochen = 0;
  anbieten('arena:start', (k) => { gefahren += k.neuId === 'benno' ? 1 : 100; return { verlasse() { abgebrochen++; } }; }, { reihenfolge: 10, paket: '2D' });
  anbieten('arena:start', () => null);
  const r = fuelle('arena:start', null, { neuId: 'benno', scrolleZu() {} });
  pruefe('Aufruf-Ort: Anbieter laufen ohne Container', gefahren === 1 && r.anzahl === 1, { gefahren, n: r.anzahl });
  r.verlasse();
  r.verlasse();
  pruefe('Aufruf-Ort: verlasse() des Anbieters genau einmal', abgebrochen === 1);
  orteZuruecksetzen();
}

// =====================================================================
// Feier-Warteschlange
// =====================================================================
function fakeSpeicher() {
  const m = new Map();
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
}
const FEIER_KEY = 'schach-arena:v1:modul:feier';

pruefe('BUDGET = { gross: 1, zeilen: 3, nachlese: 3 }, eingefroren', JSON.stringify(BUDGET) === '{"gross":1,"zeilen":3,"nachlese":3}' && Object.isFrozen(BUDGET));
pruefe('QUELLEN: feste Prioritaeten aus BAUPLAN 3.6 (W0+a: 21 Quellen aus SPIELKONZEPT 3.10 plus die alten Namen rang und kette)',
  QUELLEN['erster-sieg'].prio === 95 && QUELLEN.rang.art === 'gross' && QUELLEN.karten.prio === 30
  && QUELLEN['serie-rekord'].art === 'zeile' && Object.keys(QUELLEN).length === 23 && Object.isFrozen(QUELLEN));
{
  // SPIELKONZEPT 3.10, Tabelle "Feste Feier-Prioritaeten"
  const TAB = {
    'erster-sieg': ['gross', 95], klasse: ['gross', 90], 'boss-siegel': ['gross', 88], erzfeind: ['gross', 85], 'liga-saison': ['gross', 82],
    'bot-rekord': ['gross', 78], 'medaille-gold': ['gross', 76], 'level-titel': ['gross', 75], meilenstein: ['gross', 72], bestmarke: ['gross', 70],
    umwandlung: ['gross', 66], 'serie-rekord': ['zeile', 60], rekord: ['zeile', 58], level: ['zeile', 55], marsch: ['zeile', 50], liga: ['zeile', 45],
    siegeslauf: ['zeile', 44], medaille: ['zeile', 40], tageskrone: ['zeile', 38], tagesdreier: ['zeile', 35], karten: ['zeile', 30],
  };
  const falsch = Object.entries(TAB).filter(([q, [art, prio]]) => !QUELLEN[q] || QUELLEN[q].art !== art || QUELLEN[q].prio !== prio || !Object.isFrozen(QUELLEN[q]));
  pruefe('QUELLEN (W0+a): alle 21 Quellen aus SPIELKONZEPT 3.10 mit Art und Prioritaet', falsch.length === 0, falsch.map(([q]) => q));
  pruefe('QUELLEN (W0+a): rang und kette sind die alten Namen von klasse und marsch (gleiche Werte)',
    JSON.stringify(QUELLEN.rang) === JSON.stringify(QUELLEN.klasse) && JSON.stringify(QUELLEN.kette) === JSON.stringify(QUELLEN.marsch));
  pruefe('QUELLEN (W0+a): tageskrone ist jetzt eine Zeile (38)', QUELLEN.tageskrone.art === 'zeile' && QUELLEN.tageskrone.prio === 38);
  pruefe('BRETT_FEIER = { dauerMs: 1800, kurzMs: 800 }, eingefroren', JSON.stringify(BRETT_FEIER) === '{"dauerMs":1800,"kurzMs":800}' && Object.isFrozen(BRETT_FEIER));
}

{
  let s = fakeSpeicher();
  setzeSpeicher(s);
  let uhr = Date.UTC(2026, 9, 16, 12, 0, 0);
  setzeUhr(() => uhr);
  const P1 = 'pabc01';
  const meldungen = [
    { quelle: 'karten', titel: '2 neue Karten in deiner Kartei' },
    { quelle: 'kette', titel: 'Lichterkette: Tag 13' },
    { quelle: 'tageskrone', titel: 'Tageskrone! 3 von 3' },
    { quelle: 'serie-rekord', titel: 'Längste Serie: ×7', text: '(vorher ×5)', klang: 'rekord' },
    { quelle: 'bestmarke', titel: 'NEUE BESTMARKE', text: '14 Züge ohne Fehler (vorher 9)' },
    { quelle: 'tagesdreier', titel: 'Tagesdreier 2 von 3' },
  ];
  const neu = meldungen.map((m) => { uhr += 10; return melde({ partieId: P1, ...m }); });
  pruefe('6 Meldungen angenommen', neu.every((x) => x === true), neu);
  pruefe('doppelte Meldung (gleiche partieId, quelle, titel) zaehlt einmal', melde({ partieId: P1, quelle: 'kette', titel: 'Lichterkette: Tag 13' }) === false);
  const o = fuerOverlay(P1);
  pruefe('Overlay: hoechstens 3 Eintraege', o.length === 3, o.map((x) => x.quelle));
  pruefe('Overlay: hoechstens 1 grosser (der mit der hoechsten prio)', o.filter((x) => x.art === 'gross').length === 1 && o[0].quelle === 'bestmarke', o.map((x) => x.quelle));
  pruefe('Overlay: nach prio (bestmarke, serie-rekord, kette)', o.map((x) => x.quelle).join(',') === 'bestmarke,serie-rekord,kette', o.map((x) => x.quelle));
  pruefe('Overlay: Eintraege eingefroren mit allen Feldern', Object.isFrozen(o[0]) && o[1].text === '(vorher ×5)' && o[1].klang === 'rekord' && o[1].prio === 60 && typeof o[1].zeit === 'number');
  const o2 = fuerOverlay(P1);
  pruefe('Overlay erneut (Nachtrag): dieselben Eintraege', JSON.stringify(o2) === JSON.stringify(o));
  pruefe('Overlay fuer eine andere Partie: leer', fuerOverlay('pandere').length === 0 && fuerOverlay(null).length === 0);
  const n = nachlese();
  pruefe('Nachlese: der Rest (hoechstens 3, nach prio)', n.map((x) => x.quelle).join(',') === 'tageskrone,tagesdreier,karten', n.map((x) => x.quelle));
  pruefe('Nachlese: danach leer', nachlese().length === 0);
  pruefe('Overlay nach der Nachlese: weiter dieselben drei', fuerOverlay(P1).length === 3);
  pruefe('nach der Nachlese: doppelte Meldung zaehlt weiter nicht', melde({ partieId: P1, quelle: 'karten', titel: '2 neue Karten in deiner Kartei' }) === false && nachlese().length === 0);

  // Nachtrag: erste Anzeige mit zwei Zeilen, dann kommt (nach der Analyse) ein grosser Moment dazu
  const P2 = 'pabc02';
  melde({ partieId: P2, quelle: 'kette', titel: 'Lichterkette: Tag 14' });
  melde({ partieId: P2, quelle: 'karten', titel: '1 neue Karte' });
  pruefe('Nachtrag: zuerst zwei Zeilen', fuerOverlay(P2).length === 2);
  melde({ partieId: P2, quelle: 'bestmarke', titel: 'NEUE BESTMARKE: 91,2 %' });
  // W0+a: tageskrone ist seit SPIELKONZEPT 3.10 eine Zeile; der zweite grosse Moment ist hier die Umwandlung
  melde({ partieId: P2, quelle: 'umwandlung', titel: 'Umwandlung!' });
  const o3 = fuerOverlay(P2);
  pruefe('Nachtrag: alte bleiben, ein grosser kommt dazu, Budget 3', o3.length === 3 && o3[0].quelle === 'bestmarke'
    && o3.filter((x) => x.art === 'gross').length === 1 && o3.some((x) => x.quelle === 'kette') && o3.some((x) => x.quelle === 'karten'), o3.map((x) => x.quelle));
  pruefe('Nachtrag: der zweite grosse wandert in die Nachlese', nachlese().map((x) => x.quelle).join(',') === 'umwandlung');

  // feste Tabelle schlaegt die Angaben des Pakets; unbekannte Quelle nimmt die Angaben
  melde({ partieId: 'p3', quelle: 'kette', titel: 'Lichterkette: Tag 2', art: 'gross', prio: 99 });
  melde({ partieId: 'p3', quelle: 'eigenes-paket', titel: 'Etwas Neues', art: 'zeile', prio: 55 });
  const o4 = fuerOverlay('p3');
  pruefe('feste Prioritaeten gelten fuer bekannte Quellen', o4.find((x) => x.quelle === 'kette').art === 'zeile' && o4.find((x) => x.quelle === 'kette').prio === 50);
  pruefe('unbekannte Quelle: eigene prio und art', o4[0].quelle === 'eigenes-paket' && o4[0].prio === 55, o4.map((x) => [x.quelle, x.prio]));
  pruefe('melde ohne titel wirft', wirft(() => melde({ partieId: 'p4', quelle: 'kette' })));
  pruefe('melde ohne quelle wirft', wirft(() => melde({ partieId: 'p4', titel: 'x' })));
  pruefe('melde mit falscher art wirft', wirft(() => melde({ partieId: 'p4', quelle: 'neu', titel: 'x', art: 'riesig' })));

  // ohne partieId: nur Nachlese; Nachlese hoechstens 3 und nur juenger als 7 Tage
  s = fakeSpeicher();
  setzeSpeicher(s);
  uhr = Date.UTC(2026, 9, 1, 12, 0, 0);
  melde({ quelle: 'karten', titel: 'Alt: 1 neue Karte' });
  uhr += 7 * 24 * 3600 * 1000 + 1000;
  melde({ quelle: 'karten', titel: 'Neu: 2 neue Karten' });
  melde({ partieId: 'p9', quelle: 'kette', titel: 'Kette 1' });
  melde({ partieId: 'p9', quelle: 'tagesdreier', titel: 'Dreier 1' });
  melde({ partieId: 'p9', quelle: 'serie-rekord', titel: 'Rekord 1' });
  pruefe('ohne partieId: nie im Overlay', fuerOverlay(undefined).length === 0);
  const n2 = nachlese();
  pruefe('Nachlese: hoechstens 3, aelter als 7 Tage nicht dabei', n2.length === 3 && !n2.some((x) => /Alt/.test(x.titel))
    && n2.map((x) => x.quelle).join(',') === 'serie-rekord,kette,tagesdreier', n2.map((x) => x.titel));
  pruefe('Nachlese: danach leer (auch der Ueberhang)', nachlese().length === 0);

  // Speicher: Modul feier bleibt unter 6.000 Zeichen, auch nach vielen Meldungen
  s = fakeSpeicher();
  setzeSpeicher(s);
  for (let i = 0; i < 120; i++) {
    uhr += 60000;
    melde({ partieId: 'q' + i, quelle: i % 2 ? 'kette' : 'serie-rekord', titel: 'Feier Nummer ' + i + ' ' + 'x'.repeat(60), text: 'y'.repeat(150) });
    if (i % 3 === 0) fuerOverlay('q' + i);
  }
  const groesse = (s.m.get(FEIER_KEY) || '').length;
  pruefe('Speicher: modul:feier hoechstens 6.000 Zeichen', groesse > 0 && groesse <= MODUL_BUDGET.feier, groesse);
  pruefe('Speicher: idempotent auch nach dem Ausduennen (letzte Meldung)', melde({ partieId: 'q119', quelle: 'kette', titel: 'Feier Nummer 119 ' + 'x'.repeat(60) }) === false);
  pruefe('Speicher: lange Texte gekuerzt', JSON.parse(s.m.get(FEIER_KEY)).eintraege.every((e) => e.titel.length <= 80 && e.text.length <= 200));
  // kaputter Speicher: leer statt Absturz
  s.m.set(FEIER_KEY, '{kaputt');
  pruefe('kaputter Speicher: leere Nachlese, melde geht weiter', nachlese().length === 0 && melde({ partieId: 'z', quelle: 'kette', titel: 'neu' }) === true);
  setzeUhr(null);
  setzeSpeicher(null);
}

// =====================================================================
// Satz-Register (js/bots.js)
// =====================================================================
{
  const hilde = BOTS.find((b) => b.id === 'hilde');
  const rudi = BOTS.find((b) => b.id === 'rudi');
  // ohne werte wie bisher: Satz aus bot.saetze, keine direkte Wiederholung
  const s1 = botSatz(hilde, 'begruessung', () => 0);
  const s2 = botSatz(hilde, 'begruessung', () => 0);
  pruefe('botSatz ohne werte: wie bisher (aus der Liste, keine direkte Wiederholung)', hilde.saetze.begruessung.includes(s1) && s1 !== s2
    && s1 === hilde.saetze.begruessung[0] && s2 === hilde.saetze.begruessung[1]);
  pruefe('botSatz: unbekannter Anlass und fehlender Bot -> null', botSatz(hilde, 'rueckkampf') === null && botSatz(null, 'schach') === null);
  pruefe('PLATZHALTER: zuege, genauigkeit, name, tage', JSON.stringify(PLATZHALTER) === '["zuege","genauigkeit","name","tage"]' && Object.isFrozen(PLATZHALTER));
  const ab = registriereSaetze('rueckkampf', {
    hilde: ['Nach {zuege} Zügen hast du mich erwischt.', 'Schon wieder du, {name}?', 'Du warst {tage} Tage weg und {unbekannt}.'],
    rudi: ['Thorsten grüßt mit {genauigkeit} %.'],
  });
  pruefe('Register: Satz mit Platzhalter gefuellt', botSatz(hilde, 'rueckkampf', () => 0, { zuege: 31 }) === 'Nach 31 Zügen hast du mich erwischt.');
  pruefe('Register: fehlt ein Wert, wird der Satz uebersprungen', [0, 0.4, 0.9].every((z) => botSatz(hilde, 'rueckkampf', () => z, { zuege: 7 }) === 'Nach 7 Zügen hast du mich erwischt.'));
  pruefe('Register: unbekannter Platzhalter wird nie gezeigt', [0, 0.5, 0.99].every((z) => !/weg und/.test(botSatz(hilde, 'rueckkampf', () => z, { zuege: 1, name: 'Flo', tage: 4, unbekannt: 'x' }) || '')));
  pruefe('Register: Kommazahl mit Komma', botSatz(rudi, 'rueckkampf', () => 0, { genauigkeit: 81.44 }) === 'Thorsten grüßt mit 81,4 %.');
  pruefe('Register: ohne werte kein Satz mit Platzhalter', botSatz(hilde, 'rueckkampf', () => 0) === null && botSatz(rudi, 'rueckkampf') === null);
  pruefe('Register: anderer Bot ohne Saetze -> null', botSatz(BOTS.find((b) => b.id === 'greta'), 'rueckkampf', () => 0, { zuege: 3 }) === null);
  // zuerst bot.saetze, dann das Register
  const ab2 = registriereSaetze('begruessung', { hilde: ['Registrierter Gruss'] });
  pruefe('botSatz: bot.saetze geht vor das Register', [0, 0.5, 0.99].every((z) => hilde.saetze.begruessung.includes(botSatz(hilde, 'begruessung', () => z))));
  ab2();
  ab();
  ab();
  pruefe('Register: abmelden nimmt die Saetze heraus (idempotent)', botSatz(hilde, 'rueckkampf', () => 0, { zuege: 3, name: 'Flo' }) === null);
  pruefe('registriereSaetze: falsche Eingaben werfen', wirft(() => registriereSaetze('', {})) && wirft(() => registriereSaetze('x', { hilde: 'kein Array' })));
}

// =====================================================================
// Icon-Register (js/ui/icons.js)
// =====================================================================
{
  // app.js nicht in Node laden (DOM): Weiterexport am Quelltext pruefen
  const appText = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  pruefe('icon: wie bisher, app.js importiert aus ui/icons.js und exportiert weiter', icon('stern').startsWith('<svg class="ico"')
    && icon('stern', 'gross').includes('class="ico gross"') && /<path/.test(icon('pokal'))
    && /import \{ icon \} from '\.\/ui\/icons\.js';/.test(appText) && /export \{ icon \};/.test(appText) && !/const ICONS/.test(appText));
  pruefe('icon: unbekannter Name -> leeres SVG', /^<svg[^>]*><\/svg>$/.test(icon('gibtsnicht')) && icon('constructor').endsWith('"false"></svg>'));
  const vorher = iconNamen().length;
  pruefe('registriereIcon: neues Icon', registriereIcon('perle', '<circle cx="12" cy="12" r="5"/>') === true && icon('perle').includes('<circle cx="12"')
    && iconNamen().length === vorher + 1);
  pruefe('registriereIcon: vorhandene Namen bleiben', registriereIcon('stern', '<path d="M0 0"/>') === false && registriereIcon('perle', '<path/>') === false
    && !icon('stern').includes('M0 0'));
  pruefe('registriereIcon: Skript und Ereignis-Attribute abgelehnt', registriereIcon('boese', '<script>x()</script>') === false
    && registriereIcon('boese2', '<path onload="x()"/>') === false && registriereIcon('boese3', '<a href="javascript:x()"/>') === false
    && registriereIcon('Gross', '<path/>') === false && registriereIcon('leer', '  ') === false);
}

// =====================================================================
// Klang-Register (js/sounds.js) mit einer Fake-AudioContext
// =====================================================================
{
  const aufrufe = [];
  class FakeParam { constructor() { this.value = 0; } setValueAtTime() {} exponentialRampToValueAtTime() {} }
  class FakeKnoten { constructor() { this.gain = new FakeParam(); this.frequency = new FakeParam(); this.threshold = new FakeParam(); this.ratio = new FakeParam(); this.Q = new FakeParam(); } connect() {} start() {} stop() {} }
  // Die Uhr laeuft (wie ein echter Kontext): sonst blieben die Stimmen ewig belegt und das Mischen nach Vorrang
  // (hoechstens 4 Stimmen, Premium-Umbau U3) verwuerfe spaetere Klaenge
  class FakeAC {
    constructor() { this.state = 'running'; this.uhr = 1; this.destination = new FakeKnoten(); this.sampleRate = 22050; }
    get currentTime() { this.uhr += 5; return this.uhr; }
    resume() { return Promise.resolve(); }
    createGain() { return new FakeKnoten(); }
    createDynamicsCompressor() { return new FakeKnoten(); }
    createOscillator() { aufrufe.push('oszillator'); return new FakeKnoten(); }
    createBiquadFilter() { return new FakeKnoten(); }
    createBufferSource() { return new FakeKnoten(); }
    createBuffer(k, n) { return { getChannelData: () => new Float32Array(n) }; }
  }
  class FakeOAC extends FakeAC {
    constructor(k, laenge) { super(); this.laenge = laenge; this.destination = { echt: true }; }
    async startRendering() { const d = new Float32Array(this.laenge); d[100] = 0.5; d[2000] = 0.01; return { getChannelData: () => d }; }
  }
  globalThis.window = { AudioContext: FakeAC, OfflineAudioContext: FakeOAC };
  const sounds = await import('../js/sounds.js?register-test');
  delete globalThis.window;
  const { klang, registriereKlang, klangProbe, ton, klick, tock, huelle, rauschen, NOTEN } = sounds;
  pruefe('Bausteine exportiert (ton, klick, tock, huelle, rauschen, NOTEN eingefroren)', [ton, klick, tock, huelle, rauschen].every((f) => typeof f === 'function')
    && NOTEN.C5 === 523.25 && Object.isFrozen(NOTEN));
  klang.aktivieren();
  pruefe('Fake-Kontext bereit', klang.zustand() === 'bereit');
  const log = [];
  const spion = (name) => (ac, ziel, t, ...args) => log.push([name, ...args]);
  // Standard ohne Register 'klasse' und ohne Dateien (PLAN 3.6): brillant -> brillant, fehler und verpasst -> fehler,
  // patzer -> Datei patzer, ohne Datei Rueckfall wie vor dem Umbau auf fehler; sonst kein registrierter Klang
  const abB = registriereKlang('brillant', spion('brillant'));
  const abF = registriereKlang('fehler', spion('fehler'));
  const abZ = registriereKlang('zug', spion('zug'));
  for (const k of ['brillant', 'stark', 'bester', 'exzellent', 'gut', 'buch', 'ungenau', 'fehler', 'verpasst', 'patzer', 'erzwungen']) klang.klasse(k);
  pruefe('klang.klasse Standard (PLAN 3.6): brillant -> brillant, fehler/verpasst/patzer -> fehler (ohne Dateien), sonst still', JSON.stringify(log) === '[["brillant"],["fehler"],["fehler"],["fehler"]]', log);
  log.length = 0;
  klang.stern(0, true);
  klang.stern(2, false);
  pruefe('klang.stern Standard: zug()', JSON.stringify(log) === '[["zug"],["zug"]]', log);
  // registrierte Klaenge fuer klasse und stern bekommen die Argumente
  log.length = 0;
  const abK = registriereKlang('klasse', spion('klasse'), { wichtig: (k) => ['brillant', 'stark', 'fehler', 'patzer'].includes(k) });
  const abS = registriereKlang('stern', spion('stern'));
  klang.klasse('gut', { serie: 2 });
  klang.stern(1, true);
  pruefe('klang.klasse/stern mit Register: Argumente kommen an', JSON.stringify(log) === '[["klasse","gut",{"serie":2}],["stern",1,true]]', log);
  // Klangstufe
  log.length = 0;
  const abL = registriereKlang('leise', spion('leise'), { wichtig: false });
  klang.stufe = 'wichtig';
  klang.klasse('gut');
  klang.klasse('stark');
  klang.spiele('leise');
  klang.zug();
  klang.stufe = 'alle';
  klang.spiele('leise');
  pruefe('klang.stufe "wichtig": nur wichtige Klaenge, eingebaute bleiben', JSON.stringify(log) === '[["klasse","stark"],["zug"],["leise"]]', log);
  // spiele: registrierter vor eingebautem, unbekannter Name still
  log.length = 0;
  klang.spiele('zug');
  klang.spiele('gibtsnicht');
  abZ();
  const vor = aufrufe.length;
  klang.spiele('zug');
  pruefe('klang.spiele: registriert vor eingebaut, nach abmelden wieder eingebaut', JSON.stringify(log) === '[["zug"]]' && aufrufe.length > vor);
  klang.aus = true;
  klang.spiele('leise');
  klang.aus = false;
  pruefe('klang.aus: nichts spielt', log.length === 1);
  const werfend = registriereKlang('kaputt', () => { throw new Error('x'); });
  let ruhig = true;
  try { klang.spiele('kaputt'); } catch (e) { ruhig = false; }
  pruefe('Fehler im Klang wird geschluckt', ruhig);
  // klangProbe auch fuer registrierte Klaenge
  const probe = await klangProbe('leise');
  const probeEingebaut = await klangProbe('brillant');
  pruefe('klangProbe fuer registrierte Klaenge', probe && probe.spitze === 0.5 && probeEingebaut && typeof probeEingebaut.dauer === 'number');
  pruefe('klangProbe: unbekannter Klang -> null', (await klangProbe('gibtsnicht')) === null);
  pruefe('registriereKlang: falsche Eingaben werfen', wirft(() => registriereKlang('', () => {})) && wirft(() => registriereKlang('x', 'y')));
  [abB, abF, abK, abS, abL, werfend].forEach((f) => f());
  log.length = 0;
  klang.klasse('gut');
  pruefe('nach dem Abmelden: Standard wieder aktiv', log.length === 0);
}

// =====================================================================
// W0+a: angeboten() und Aufruf-Orte mit { fertig }
// =====================================================================
{
  orteZuruecksetzen();
  pruefe('angeboten: 0 ohne Anbieter, unbekannter Ort wirft', angeboten('partie:matt') === 0 && wirft(() => angeboten('partie:gibtsnicht')));
  const leer = fuelle('partie:matt', null, {});
  let sofort = false;
  await leer.fertig.then(() => { sofort = true; });
  pruefe('Aufruf-Ort ohne Anbieter: wartend 0, fertig sofort erfuellt', leer.anzahl === 0 && leer.wartend === 0 && sofort);
  let erfuelle;
  let verlassen = 0;
  const ab1 = anbieten('partie:matt', () => ({ fertig: new Promise((r) => { erfuelle = r; }), verlasse() { verlassen++; } }), { paket: 'finisher' });
  const ab2 = anbieten('partie:matt', () => ({ verlasse() { verlassen++; } }), { paket: 'ohne-warten' });
  const ab3 = anbieten('partie:matt', () => ({ fertig: Promise.reject(new Error('kaputt')) }), { paket: 'kaputt' });
  pruefe('angeboten zaehlt die Anbieter', angeboten('partie:matt') === 3);
  const altError = console.error;
  const fehlerLog = [];
  console.error = (...a) => fehlerLog.push(a.map(String).join(' '));
  const g = fuelle('partie:matt', null, { x: 1 });
  let fertig = false;
  g.fertig.then(() => { fertig = true; });
  await new Promise((r) => setTimeout(r, 10));
  pruefe('Aufruf-Ort: wartend zaehlt nur Anbieter mit fertig', g.anzahl === 3 && g.wartend === 2);
  pruefe('Aufruf-Ort: fertig wartet auf alle Promises (ein kaputtes zaehlt als fertig)', fertig === false);
  erfuelle();
  await new Promise((r) => setTimeout(r, 10));
  pruefe('Aufruf-Ort: fertig nach dem letzten Promise', fertig === true);
  console.error = altError;
  pruefe('Aufruf-Ort: abgelehntes fertig landet als Fehler mit Paketname in der Konsole', fehlerLog.some((t) => /"kaputt" an partie:matt/.test(t)), fehlerLog);
  g.verlasse();
  pruefe('Aufruf-Ort: verlasse ruft die Anbieter', verlassen === 2);
  [ab1, ab2, ab3].forEach((f) => f());
  pruefe('angeboten nach dem Abmelden: 0', angeboten('partie:matt') === 0);
  // DOM-Orte der W0+a mit Mini-DOM: Reihenfolge der Abrechnung (Punkte 10, Funken 20, Wertung 30, Serie 40)
  const c = el('huelle');
  anbieten('ergebnis:abrechnung', () => el('serie'), { reihenfolge: 40, paket: 'alltag' });
  anbieten('ergebnis:abrechnung', () => el('punkte'), { reihenfolge: 10, paket: 'punkte' });
  anbieten('ergebnis:abrechnung', () => el('wertung'), { reihenfolge: 30, paket: 'wertung' });
  anbieten('ergebnis:abrechnung', () => el('funken'), { reihenfolge: 20, paket: 'funken' });
  const gef = fuelle('ergebnis:abrechnung', c, {});
  pruefe('ergebnis:abrechnung: Zeilen in der Reihenfolge Punkte, Funken, Wertung, Serie', namen(c) === 'punkte,funken,wertung,serie' && gef.fertig instanceof Promise && gef.wartend === 0, namen(c));
  gef.verlasse();
  // Test-Huelle der Screen-Orte (die Hosts kommen mit den Screens der Pakete): Reihenfolge und Abraeumen
  const falsch = [];
  for (const ort of ['bestenliste:reiter', 'training:karten', 'ich:vitrine', 'spielplan:tage', 'arena:heute', 'partie:gegner-leiste',
    'partie:spieler-leiste', 'partie:aktionen', 'arena:karte-boss', 'arena:karte-event']) {
    const h = el('host');
    const ab1 = anbieten(ort, () => el('zweiter'), { reihenfolge: 20, paket: 'b' });
    const ab2 = anbieten(ort, (k) => (k.leer ? null : el('erster')), { reihenfolge: 10, paket: 'a' });
    const g = fuelle(ort, h, {});
    const ok1 = namen(h) === 'erster,zweiter' && g.anzahl === 2 && angeboten(ort) === 2;
    g.verlasse();
    const g2 = fuelle(ort, h, { leer: true });
    const ok2 = namen(h) === 'zweiter' && g2.anzahl === 1;
    g2.verlasse();
    ab1();
    ab2();
    if (!ok1 || !ok2 || namen(h) !== '' || angeboten(ort) !== 0) falsch.push(ort);
  }
  pruefe('Test-Huelle der W0+a-DOM-Orte: Reihenfolge, null-Anbieter, Abraeumen', falsch.length === 0, falsch);
  orteZuruecksetzen();
}

console.log(`\n${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
