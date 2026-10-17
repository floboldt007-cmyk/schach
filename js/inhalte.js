// Statische Inhalte der Schach-Arena (Runde 4, W0+a "Spiel-Fundament"): JSON-Dateien unter daten/ (Spielplan,
// spaeter Tagesraetsel-Jahr, Bosse, Lektionen, Bot-Laeufe, Liga-Saisons). Sie liegen im Offline-Cache des Service
// Workers (Liste DATEIEN in sw.js), nie im Speicher des Browsers. Rein bis auf fetch, in Node testbar (setzeHoler).
//
//   import { ladeInhalt, spielplanWoche, funkenWochenendeAktiv } from './inhalte.js';
//   const r = await ladeInhalt('spielplan', { art: 'spielplan' });
//   if (r.ok) spielplanWoche(r.daten, wochenSchluessel());
//
// Jede Datei hat einen Dateikopf:
//   { "kopf": { "art": "spielplan", "format": 1, "rechenstand": 1, "stand": "2026-10-19", "titel": "..." }, ...Inhalt }
//   art          wofuer die Datei ist (muss zur Anfrage passen)
//   format       Aufbau der Datei (die App kennt je Art bestimmte Formate)
//   rechenstand  nach welchen Regeln die Datei gerechnet wurde (Punkte-Formel, Analysetiefe, Bot-Einstellungen).
//                Hoeher als RECHENSTAND der App: abgelehnt ("braucht eine neuere App"). Niedriger: geladen, aber
//                mit veraltet: true (Tafel-Eintraege rechnet die App auf Wunsch neu, SPIELKONZEPT 3.13).
//   stand        Tag der Veroeffentlichung ('JJJJ-MM-TT'); der Spielplan rechnet damit den Vorlauf der Events
//
// API:
//   RECHENSTAND                         Rechenstand dieser App-Version (zaehlt hoch, wenn sich Punkte-Formel,
//                                       Analysetiefe oder Bot-Einstellungen aendern)
//   ladeInhalt(name, { art, neu = false } = {}) -> Promise<Ergebnis>
//       name: Pfad unter daten/ ohne .json, nur [a-z0-9-] mit "/" dazwischen (z. B. 'spielplan', 'beispiel/spielplan').
//       Ergebnis: { ok: true, kopf, daten, veraltet } oder { ok: false, grund, text }
//       grund: 'name' | 'netz' | 'json' | 'kopf' | 'art' | 'format' | 'rechenstand' | 'inhalt'.
//       Einmal geladene Dateien bleiben im Arbeitsspeicher (neu: true laedt erneut). Wirft nie.
//   pruefeKopf(json, { art } = {}) -> { ok, kopf, veraltet, grund?, text? }
//   pruefeInhalt(json, { art } = {}) -> { ok, kopf, veraltet, fehler: [Text] }   Kopf und (falls registriert) Inhalt
//   registriereInhaltsart(art, { formate: [1], pruefe(json) -> [Fehlertext] }) -> abmelden()
//       Pakete melden ihre eigenen Dateiarten an (z. B. 'raetsel-jahr'); 'spielplan' ist eingebaut.
//   setzeHoler(fn | null)               nur Tests: eigenes fetch (url) -> Promise<{ ok, status, text() }>
//   leereZwischenspeicher()             nur Tests
//   SPIELPLAN_NAME = 'boss/spielplan'   Ort der Spielplan-Datei: daten/boss/spielplan.json (legt S1-6 an)
//   ladeSpielplan({ neu = false } = {}) -> wie ladeInhalt(SPIELPLAN_NAME, { art: 'spielplan' }); die beiden Leser
//                                       (S1-6 Boss und Spielplan-Screen, S1-1 Funken-Wochenende) holen ihn nur hierueber.
//                                       Fehlt die Datei (grund 'netz'): kein Wochen-Boss, kein Funken-Wochenende.
//
// Ablage: Inhalte eines Pakets unter daten/<paket>/ (z. B. daten/raetsel/jahr-2027.json, Name 'raetsel/jahr-2027');
// sie kommen wie die Paket-Dateien erst mit dem Eintrag in PAKETE in DATEIEN (sw.js). Dateien direkt unter daten/
// gehoeren keinem Paket und stehen sofort in DATEIEN. daten/beispiel/ wird nie ausgeliefert (tests/sw.test.mjs).
//
// Spielplan (art 'spielplan', format 1), eine Datei je Quartal oder Saison:
//   { "kopf": {...}, "saison": { "id": "vorsaison-2026", "name": "Vorsaison" },
//     "wochen": [ { "montag": "2026-11-16", "boss": "bergwirt", "thema": null, "funkenWochenende": false,
//                   "klassiker": [], "text": "..." }, ... ] }
//   montag            Wochenschluessel (tag.js wochenSchluessel), Wochen lueckenlos und aufsteigend
//   boss              ID des Wochen-Bosses (ein mit registriereBot angemeldeter Boss mit archiv: true)
//   thema             null oder eine der THEMEN (Themen-Woche, beginnt Montag 4:00)
//   funkenWochenende  true: Freitag 16:00 bis Montag 4:00 zaehlen Partie- und Lern-Funken doppelt
//   klassiker         optional, hoechstens 2 Boss-IDs aus dem Archiv im Rampenlicht
//   text              optional, Steckbrief der Woche (hoechstens 140 Zeichen)
//   Regeln (Fairness 19 "Events ohne Druck"): Themen-Wochen und Funken-Wochenenden beginnen mindestens
//   VORLAUF_TAGE nach kopf.stand (mindestens 4 Wochen vorher sichtbar); keine Felder fuer ein Ende ("bis",
//   "verfuegbarBis"), keine Uhrzeit-Countdowns in Texten; eine neue Plan-Datei aendert keine Woche, die schon
//   angekuendigt war (pruefeSpielplanFolge).
//   Hilfen: spielplanWoche(plan, wochenSchluessel), naechsteWochen(plan, datum, n = 4),
//   funkenWochenendeAktiv(plan, datum) -> boolean, funkenWochenendeVon(woche) -> { beginn: Date, ende: Date }
//   pruefeSpielplan(json) -> [Fehlertext], pruefeSpielplanFolge(alt, neu) -> [Fehlertext]
import { istSchluessel, wochentag, addiereTage, tageZwischen, wochenSchluessel, beginnVon } from './tag.js';

export const RECHENSTAND = 1;
export const VORLAUF_TAGE = 28;
// Ort der Spielplan-Datei (daten/boss/spielplan.json, Paket S1-6 boss); gelesen nur ueber ladeSpielplan()
export const SPIELPLAN_NAME = 'boss/spielplan';
export const THEMEN = Object.freeze(['gambit', 'endspiel', 'taktik', 'eroeffnung', 'uhr']);

const NAME_RE = /^[a-z0-9-]+(\/[a-z0-9-]+)*$/;
const ID_RE = /^[a-z][a-z0-9-]{0,39}$/;
// Uhrzeit-Countdowns ("noch 2 h", "3 Std", "10 min") haben in Spielplan und Boss nichts zu suchen
const COUNTDOWN_RE = /\d+\s*(h|Std|min)\b/i;

const standardHoler = (url) => fetch(url);
let holer = standardHoler;
export function setzeHoler(fn) { holer = typeof fn === 'function' ? fn : standardHoler; }

const zwischen = new Map();   // name -> Promise<Ergebnis>
export function leereZwischenspeicher() { zwischen.clear(); }

const arten = new Map();      // art -> { formate: Set, pruefe }
export function registriereInhaltsart(art, { formate = [1], pruefe = null } = {}) {
  if (typeof art !== 'string' || !ID_RE.test(art)) throw new TypeError('registriereInhaltsart: ungültige Art ' + String(art));
  if (arten.has(art)) throw new Error('registriereInhaltsart: Art schon angemeldet: ' + art);
  const eintrag = { formate: new Set(formate.filter(Number.isInteger)), pruefe: typeof pruefe === 'function' ? pruefe : null };
  arten.set(art, eintrag);
  let aktiv = true;
  return function abmelden() {
    if (!aktiv) return;
    aktiv = false;
    if (arten.get(art) === eintrag) arten.delete(art);
  };
}

const istObjekt = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

export function pruefeKopf(json, { art = null } = {}) {
  const nein = (grund, text) => ({ ok: false, grund, text, kopf: null, veraltet: false });
  if (!istObjekt(json) || !istObjekt(json.kopf)) return nein('kopf', 'Dateikopf fehlt');
  const k = json.kopf;
  if (typeof k.art !== 'string' || !ID_RE.test(k.art)) return nein('kopf', 'Dateikopf: art fehlt');
  if (!Number.isInteger(k.format) || k.format < 1) return nein('kopf', 'Dateikopf: format fehlt');
  if (!Number.isInteger(k.rechenstand) || k.rechenstand < 1) return nein('kopf', 'Dateikopf: rechenstand fehlt');
  if (!istSchluessel(k.stand)) return nein('kopf', 'Dateikopf: stand ist kein Datum (JJJJ-MM-TT)');
  if (art && k.art !== art) return nein('art', `Datei ist "${k.art}", erwartet "${art}"`);
  const bekannt = arten.get(k.art);
  if (bekannt && !bekannt.formate.has(k.format)) return nein('format', `Format ${k.format} von "${k.art}" kennt diese App nicht`);
  if (k.rechenstand > RECHENSTAND) return nein('rechenstand', `Datei braucht Rechenstand ${k.rechenstand}, die App kann ${RECHENSTAND}`);
  return { ok: true, kopf: { ...k }, veraltet: k.rechenstand < RECHENSTAND };
}

export function pruefeInhalt(json, { art = null } = {}) {
  const kopf = pruefeKopf(json, { art });
  if (!kopf.ok) return { ok: false, kopf: null, veraltet: false, grund: kopf.grund, fehler: [kopf.text] };
  const eintrag = arten.get(kopf.kopf.art);
  let fehler = [];
  if (eintrag && eintrag.pruefe) {
    try { fehler = eintrag.pruefe(json) || []; } catch (e) { fehler = ['Prüfung abgebrochen: ' + (e && e.message)]; }
  }
  return fehler.length
    ? { ok: false, kopf: kopf.kopf, veraltet: kopf.veraltet, grund: 'inhalt', fehler }
    : { ok: true, kopf: kopf.kopf, veraltet: kopf.veraltet, fehler: [] };
}

export function ladeInhalt(name, { art = null, neu = false } = {}) {
  if (typeof name !== 'string' || !NAME_RE.test(name)) {
    return Promise.resolve({ ok: false, grund: 'name', text: 'Ungültiger Name: ' + String(name) });
  }
  const schluessel = name + '|' + (art || '');
  if (!neu && zwischen.has(schluessel)) return zwischen.get(schluessel);
  const p = (async () => {
    let text;
    try {
      const url = new URL(`../daten/${name}.json`, import.meta.url).href;
      const antwort = await holer(url);
      if (!antwort || !antwort.ok) return { ok: false, grund: 'netz', text: `Datei nicht erreichbar (${antwort ? antwort.status : '?'})` };
      text = await antwort.text();
    } catch (e) {
      return { ok: false, grund: 'netz', text: 'Datei nicht erreichbar: ' + (e && e.message) };
    }
    let json;
    try { json = JSON.parse(text); } catch (e) { return { ok: false, grund: 'json', text: 'Kein gültiges JSON' }; }
    const r = pruefeInhalt(json, { art });
    if (!r.ok) return { ok: false, grund: r.grund, text: r.fehler.join(' · ') };
    return { ok: true, kopf: r.kopf, daten: json, veraltet: r.veraltet };
  })();
  // nur Erfolge merken: ein Netzfehler darf beim naechsten Mal neu versucht werden
  p.then((r) => { if (!r.ok && zwischen.get(schluessel) === p) zwischen.delete(schluessel); });
  zwischen.set(schluessel, p);
  return p;
}

// ---------------------------------------------------------------------------
// Spielplan
// ---------------------------------------------------------------------------
export function ladeSpielplan({ neu = false } = {}) {
  return ladeInhalt(SPIELPLAN_NAME, { art: 'spielplan', neu });
}

const WOCHE_FELDER = new Set(['montag', 'boss', 'thema', 'funkenWochenende', 'klassiker', 'text']);
const PLAN_FELDER = new Set(['kopf', 'saison', 'wochen']);

// Texte einer Datei (fuer Countdown- und Verbots-Pruefung), rekursiv
export function texteVon(x, aus = []) {
  if (typeof x === 'string') aus.push(x);
  else if (Array.isArray(x)) for (const y of x) texteVon(y, aus);
  else if (istObjekt(x)) for (const y of Object.values(x)) texteVon(y, aus);
  return aus;
}

export function pruefeSpielplan(json) {
  const f = [];
  if (!istObjekt(json)) return ['Spielplan ist kein Objekt'];
  for (const k of Object.keys(json)) if (!PLAN_FELDER.has(k)) f.push(`unbekanntes Feld "${k}"`);
  const stand = json.kopf && json.kopf.stand;
  if (json.saison != null) {
    if (!istObjekt(json.saison) || typeof json.saison.id !== 'string' || !ID_RE.test(json.saison.id) || typeof json.saison.name !== 'string' || !json.saison.name.trim()) {
      f.push('saison braucht id und name');
    }
  }
  const w = json.wochen;
  if (!Array.isArray(w) || !w.length) return [...f, 'wochen fehlt oder ist leer'];
  if (w.length > 26) f.push('höchstens 26 Wochen je Datei');
  let vorher = null;
  w.forEach((x, i) => {
    const wo = `Woche ${i + 1}`;
    if (!istObjekt(x)) { f.push(`${wo}: kein Objekt`); return; }
    for (const k of Object.keys(x)) if (!WOCHE_FELDER.has(k)) f.push(`${wo}: unbekanntes Feld "${k}"`);
    if (!istSchluessel(x.montag) || wochentag(x.montag) !== 0) { f.push(`${wo}: montag ist kein Montag (JJJJ-MM-TT)`); return; }
    if (vorher && addiereTage(vorher, 7) !== x.montag) f.push(`${wo}: Wochen müssen lückenlos aufeinander folgen (${vorher} → ${x.montag})`);
    vorher = x.montag;
    if (typeof x.boss !== 'string' || !ID_RE.test(x.boss)) f.push(`${wo}: boss fehlt`);
    if (x.thema != null && !THEMEN.includes(x.thema)) f.push(`${wo}: unbekanntes thema "${x.thema}"`);
    if (typeof x.funkenWochenende !== 'boolean') f.push(`${wo}: funkenWochenende muss true oder false sein`);
    if (x.klassiker != null && (!Array.isArray(x.klassiker) || x.klassiker.length > 2 || !x.klassiker.every((b) => typeof b === 'string' && ID_RE.test(b)))) {
      f.push(`${wo}: klassiker höchstens 2 Boss-IDs`);
    }
    if (x.text != null && (typeof x.text !== 'string' || x.text.length > 140)) f.push(`${wo}: text höchstens 140 Zeichen`);
    // Vorlauf: Events stehen mindestens 4 Wochen vorher im Plan
    if (istSchluessel(stand)) {
      if (x.thema != null && tageZwischen(stand, x.montag) < VORLAUF_TAGE) f.push(`${wo}: Themen-Woche weniger als ${VORLAUF_TAGE} Tage nach dem Stand ${stand}`);
      if (x.funkenWochenende === true && tageZwischen(stand, addiereTage(x.montag, 4)) < VORLAUF_TAGE) {
        f.push(`${wo}: Funken-Wochenende weniger als ${VORLAUF_TAGE} Tage nach dem Stand ${stand}`);
      }
    }
  });
  const countdown = texteVon({ saison: json.saison, wochen: w }).filter((t) => COUNTDOWN_RE.test(t));
  if (countdown.length) f.push('Uhrzeit-Countdown im Text: ' + countdown.join(' | '));
  return f;
}
registriereInhaltsart('spielplan', { formate: [1], pruefe: pruefeSpielplan });

// Eine neue Plan-Datei darf keine Woche aendern, die in der alten schon angekuendigt war: alles vor
// neu.kopf.stand + VORLAUF_TAGE war sichtbar und bleibt, wie es war (nie kurzfristig verschoben).
export function pruefeSpielplanFolge(alt, neu) {
  const f = [];
  const stand = neu && neu.kopf && neu.kopf.stand;
  if (!istSchluessel(stand) || !alt || !Array.isArray(alt.wochen) || !neu || !Array.isArray(neu.wochen)) return ['Pläne unvollständig'];
  const grenze = addiereTage(stand, VORLAUF_TAGE);
  for (const a of alt.wochen) {
    if (!a || !istSchluessel(a.montag) || tageZwischen(a.montag, grenze) <= 0) continue;
    const n = neu.wochen.find((x) => x && x.montag === a.montag);
    if (n && JSON.stringify(normWoche(a)) !== JSON.stringify(normWoche(n))) f.push(`Woche ${a.montag} war schon angekündigt und wurde geändert`);
  }
  return f;
}
// Vergleich ohne den Steckbrief-Text (Tippfehler duerfen korrigiert werden)
function normWoche(x) {
  return { montag: x.montag, boss: x.boss, thema: x.thema ?? null, funkenWochenende: x.funkenWochenende === true, klassiker: x.klassiker || [] };
}

export function spielplanWoche(plan, schluessel) {
  if (!plan || !Array.isArray(plan.wochen)) return null;
  return plan.wochen.find((w) => w && w.montag === schluessel) || null;
}

export function naechsteWochen(plan, datum = new Date(), n = 4) {
  if (!plan || !Array.isArray(plan.wochen)) return [];
  const jetzt = wochenSchluessel(datum);
  return plan.wochen.filter((w) => w && istSchluessel(w.montag) && tageZwischen(jetzt, w.montag) >= 0).slice(0, n);
}

// Funken-Wochenende einer Woche: Freitag 16:00 bis Montag 4:00 (lokal)
export function funkenWochenendeVon(woche) {
  if (!woche || woche.funkenWochenende !== true || !istSchluessel(woche.montag)) return null;
  const freitag = beginnVon(addiereTage(woche.montag, 4));
  const beginn = new Date(freitag.getFullYear(), freitag.getMonth(), freitag.getDate(), 16, 0, 0, 0);
  return { beginn, ende: beginnVon(addiereTage(woche.montag, 7)) };
}

export function funkenWochenendeAktiv(plan, datum = new Date()) {
  const d = datum instanceof Date ? datum : new Date(datum);
  const zeit = funkenWochenendeVon(spielplanWoche(plan, wochenSchluessel(d)));
  return !!zeit && d >= zeit.beginn && d < zeit.ende;
}
