// Klaenge der Schach-Arena per WebAudio (Premium-Umbau, PLAN 3). Gespielt werden die gemasterten MP3 der
// Klangpakete aus assets/klang/<paket>/ (vorgeladen, dekodiert, iOS-fest). Fehlt eine Datei (erster Start
// offline, Speicher voll, noch nicht dekodiert), springt der eingebaute Synth-Klang ein: die App wird nie
// stumm, und ohne Pakete verhaelt sie sich wie vorher.
//
//   import { klang } from './sounds.js';
//   klang.zug(); klang.schlagen(); klang.ende(true); klang.aus = true;
//
// Reihenfolge beim Abspielen eines Namens: (1) registrierter Klang (Register aus Welle 0) geht vor,
// (2) dekodierte Datei des aktiven Pakets (Variante nach Regel), (3) eingebauter Synth-Klang bzw. der Ersatz
// wie vor dem Umbau (stern -> zug, patzer -> fehler, sieg/niederlage/remis -> ende), sonst still.
//
// Bleibt (Welle 0):
//   export { ton, klick, tock, huelle, rauschen, NOTEN }   Bausteine fuer eigene Synthese (NOTEN eingefroren)
//   registriereKlang(name, fn, { wichtig = true } = {}) -> abmelden()
//       fn(ac, ziel, t, ...args) spielt auf einem beliebigen BaseAudioContext (auch offline). wichtig: true |
//       false | (...args) -> boolean (gilt bei klang.stufe 'wichtig' statt der Spalte im KATALOG).
//   klang.zug() schlagen() schach() rochade() umwandlung() fehler() brillant() ende(gewonnen)
//       ende: true = Sieg, false = Niederlage, sonst Remis (Dateien sieg, niederlage, remis; registriertes
//       'ende' geht vor). Alle nehmen hinten optional Optionen (siehe spiele), z. B. klang.zug({ wann: 0.18 }).
//   klang.spiele(name, ...args)   registrierter Klang, Datei oder Synth (siehe oben)
//   klang.klasse(k, info)         ohne Register 'klasse' (PLAN 3.6): brillant -> brillant; stark/bester ->
//                                 combo ab Serie 2 (Variante: ab 2 combo, ab 5 combo-2, ab 8 combo-3), sonst
//                                 bester (triviale Zuege still); ungenau -> ungenau; fehler und verpasst ->
//                                 fehler; patzer -> patzer; exzellent, gut, buch, erzwungen still.
//                                 info = { serie, serieVorher, trivial, ply } (partie.js)
//   klang.stern(i, neu, opt)      Datei stern, stern-2, stern-3 nach i, auch bei reduzierter Bewegung (Klang ist
//                                 keine Bewegung); ein registrierter 'stern' bekommt (i, neu)
//   klang.aus = false             Klang-Schalter: stumm, die Lautstaerke bleibt
//   klang.stufe = 'alle'          'alle' | 'wichtig' | 'aus' (Flo, D4: Standard alle)
//   klang.lautstaerke = 0.8       0..1, Master = Wert hoch 2 (gehoerrichtig)
//   klang.aktivieren()            entsperren (innerhalb einer Beruehrung aufrufen)
//   klang.zustand()               'aus' | 'nicht-verfuegbar' | 'gesperrt' | 'laedt' | 'bereit'
//                                 ('laedt': Kontext laeuft, die Dateien des Pakets werden noch geholt/dekodiert)
//   klangProbe(name, ...args)     rendert offline und misst: { spitze, dauer, quelle, datei } (auch Dateiklaenge)
//
// Neu (Premium-Umbau):
//   KATALOG                       eingefroren: name -> { gruppe, vorrang, wichtig, varianten, wechselnd, tonhoehe }
//   PAKETE_KLANG                  { holz: { name, pfad }, arcade: { name, pfad } }
//   KLANGGRUPPEN, KLANGSTUFEN     erlaubte Gruppen (Einstellung klanggruppen) und Stufen
//   klassenKlang(k, info)         -> { name, stufe? } | null (rein, die Abbildung von klang.klasse)
//   klang.einstellen(e)           liest klang, klangpaket ('' = Standard der Ansicht, modern: arcade),
//                                 lautstaerke, klangstufe, klanggruppen, thema; plant das Vorladen 1 s spaeter
//   klang.setzePaket(id)          '' | 'holz' | 'arcade'; laedt vor (wenn das Vorladen schon lief) und gibt die
//                                 Puffer des alten Pakets frei -> aktives Paket
//   klang.setzeLautstaerke(v)     0..1, Master = v * v (setTargetAtTime, 15 ms)
//   klang.vorladen()              holt die Dateien des aktiven Pakets (fetch, 4 voraus) und dekodiert sie der
//                                 Reihe nach (Brett, start, brillant, stern, Ergebnis, Rest) -> Promise<vorrat()>
//   klang.probe(id)               kurze Szene (Zug, Schlagen, präziser Zug, Stern) im Paket id, auch wenn es nicht
//                                 aktiv ist -> Promise
//   klang.stille()                alle laufenden Stimmen sanft beenden
//   klang.vorrat()                { paket, gewaehlt, dateien, dekodiert, fehlt, laedt, fremd, stimmen, master,
//                                 kontext } (Zustand fuer Einstellungen und Tests)
//   klang.protokoll()             nur mit ?test (oder klang.protokollieren = true): die letzten 50 Eintraege
//                                 { nr (laufend), name, aktion: 'spielt'|'opfert'|'verworfen'|'still', quelle:
//                                 'register'|'datei'|'synth', datei, paket, grund, vorrang, stimmen, jetzt, start, t }
//
// Optionen (letztes Argument, nur wenn es ausschliesslich diese Schluessel hat):
//   { wann, gain, genau, stufe, paket }
//   wann: Sekunden ab jetzt (WebAudio plant genau, z. B. die Landung der Figur); gain: Faktor (0..2) fuer
//   Sonderfaelle; genau: true = nur die Datei, kein Synth-Rueckfall; stufe: Variante (stern, combo); paket:
//   Datei aus einem anderen Paket (Probe). Ein registrierter Klang bekommt die Argumente unveraendert.
//
// Gruppen (klanggruppen): brett, bewertung, feier, uhr, boss, finisher, bedienung; eine ausgeschaltete Gruppe ist
// still, egal welche Stufe. Die Momente (start, sieg, niederlage, remis, stern) haben keinen eigenen Schalter.
// Mischen: hoechstens 4 Stimmen; Vorrang 3 wird nie abgebrochen, Vorrang 0 zuerst geopfert (aeltestes zuerst).
// iOS: Entsperren auf touchend, click, keydown, pointerup (die Hoerer bleiben angemeldet, weil iOS den Kontext
// nach App-Wechsel oder Anruf unterbricht); zusaetzlich bei visibilitychange (sichtbar). Wo es sie gibt:
// navigator.audioSession.type = 'ambient' (mischt sich mit Musik, folgt dem Stummschalter).
import { standardKlangpaket } from './thema.js';

const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
const OAC = typeof window !== 'undefined' ? (window.OfflineAudioContext || window.webkitOfflineAudioContext) : null;
const TEST = typeof location !== 'undefined' && /[?&]test\b/.test(String(location.search || ''));

let kontext = null;
let ausgang = null;
const rauschPuffer = new WeakMap();

// ---------- Bausteine (laufen auf jedem BaseAudioContext, auch offline) ----------

function rauschen(ac) {
  let p = rauschPuffer.get(ac);
  if (!p) {
    p = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.5), ac.sampleRate);
    const d = p.getChannelData(0);
    let zufall = 12345; // fester Startwert, kein Math.random noetig
    for (let i = 0; i < d.length; i++) {
      zufall = (zufall * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (zufall / 0x3fffffff) - 1;
    }
    rauschPuffer.set(ac, p);
  }
  return p;
}

// Huellkurve: schneller Anstieg, exponentielles Abklingen
function huelle(ac, ziel, t, laut, anstieg, dauer) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, laut), t + anstieg);
  g.gain.exponentialRampToValueAtTime(0.0001, t + anstieg + dauer);
  g.connect(ziel);
  return g;
}

function ton(ac, ziel, t0, { f, fEnde = null, typ = 'sine', start = 0, dauer = 0.2, laut = 0.3, anstieg = 0.006 }) {
  const t = t0 + start;
  const o = ac.createOscillator();
  o.type = typ;
  o.frequency.setValueAtTime(f, t);
  if (fEnde) o.frequency.exponentialRampToValueAtTime(fEnde, t + anstieg + dauer);
  o.connect(huelle(ac, ziel, t, laut, anstieg, dauer));
  o.start(t);
  o.stop(t + anstieg + dauer + 0.03);
}

function klick(ac, ziel, t0, { start = 0, dauer = 0.05, laut = 0.5, frequenz = 1800, q = 1.2 }) {
  const t = t0 + start;
  const quelle = ac.createBufferSource();
  quelle.buffer = rauschen(ac);
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = frequenz;
  filter.Q.value = q;
  quelle.connect(filter);
  filter.connect(huelle(ac, ziel, t, laut, 0.002, dauer));
  quelle.start(t, Math.random() * 0.2); // anderer Ausschnitt, damit es nicht mechanisch klingt
  quelle.stop(t + dauer + 0.05);
}

// Holz-"Tock" einer gesetzten Figur
function tock(ac, ziel, t0, start = 0, hoehe = 1, laut = 1) {
  klick(ac, ziel, t0, { start, dauer: 0.045, laut: 0.55 * laut, frequenz: 1900 * hoehe, q: 1.4 });
  ton(ac, ziel, t0, { f: 230 * hoehe, fEnde: 120 * hoehe, start, dauer: 0.07, laut: 0.45 * laut, anstieg: 0.003 });
}

const NOTEN = Object.freeze({ C4: 261.63, Eb4: 311.13, E4: 329.63, G4: 392, Ab4: 415.3, B4: 493.88, C5: 523.25, E5: 659.25,
  G5: 783.99, Gis5: 830.61, B5: 987.77, C6: 1046.5, E6: 1318.51, G6: 1567.98, B6: 1975.53, E7: 2637.02 });

export { ton, klick, tock, huelle, rauschen, NOTEN };

// Eingebaute Synth-Klaenge (Rueckfall, wenn keine Datei da ist)
const KLAENGE = {
  zug(ac, z, t) { tock(ac, z, t); },
  schlagen(ac, z, t) {
    klick(ac, z, t, { dauer: 0.08, laut: 0.8, frequenz: 1150, q: 0.9 });
    ton(ac, z, t, { f: 170, fEnde: 80, dauer: 0.11, laut: 0.6, anstieg: 0.003 });
    klick(ac, z, t, { start: 0.028, dauer: 0.035, laut: 0.35, frequenz: 2600, q: 1.6 });
  },
  rochade(ac, z, t) { tock(ac, z, t, 0, 1); tock(ac, z, t, 0.105, 0.86, 0.85); },
  schach(ac, z, t) {
    tock(ac, z, t);
    ton(ac, z, t, { f: NOTEN.B5, typ: 'triangle', start: 0.02, dauer: 0.16, laut: 0.2 });
    ton(ac, z, t, { f: NOTEN.E6, typ: 'triangle', start: 0.11, dauer: 0.22, laut: 0.18 });
  },
  umwandlung(ac, z, t) {
    tock(ac, z, t);
    ton(ac, z, t, { f: NOTEN.C5, fEnde: NOTEN.C6, start: 0.03, dauer: 0.24, laut: 0.16 });
    ton(ac, z, t, { f: NOTEN.G6, typ: 'triangle', start: 0.22, dauer: 0.2, laut: 0.1 });
  },
  fehler(ac, z, t) {
    ton(ac, z, t, { f: 330, fEnde: 250, typ: 'triangle', dauer: 0.14, laut: 0.24 });
    ton(ac, z, t, { f: 247, fEnde: 175, typ: 'triangle', start: 0.13, dauer: 0.22, laut: 0.22 });
  },
  brillant(ac, z, t) {
    [NOTEN.E5, NOTEN.Gis5, NOTEN.B5, NOTEN.E6].forEach((f, i) => {
      ton(ac, z, t, { f, start: i * 0.065, dauer: 0.32, laut: 0.26 });
      ton(ac, z, t, { f: f * 2, typ: 'triangle', start: i * 0.065, dauer: 0.18, laut: 0.06 });
    });
    ton(ac, z, t, { f: NOTEN.B6, start: 0.3, dauer: 0.35, laut: 0.09 });
    ton(ac, z, t, { f: NOTEN.E7, start: 0.36, dauer: 0.3, laut: 0.06 });
  },
  // Feier-Zeile im Ergebnis (Runde 4): leiser Tick, je Zeile etwas hoeher (stufe 0, 1, 2, ...)
  feier(ac, z, t, stufe = 0) {
    const h = Math.pow(2, (Math.min(6, Math.max(0, Number(stufe) || 0)) * 2) / 12);
    ton(ac, z, t, { f: NOTEN.E6 * h, typ: 'triangle', dauer: 0.08, laut: 0.12, anstieg: 0.003 });
    klick(ac, z, t, { dauer: 0.03, laut: 0.16, frequenz: 3200 * h, q: 2 });
  },
  ende(ac, z, t, gewonnen) {
    if (gewonnen === true) {
      [NOTEN.C5, NOTEN.E5, NOTEN.G5].forEach((f, i) => ton(ac, z, t, { f, typ: 'triangle', start: i * 0.11, dauer: 0.22, laut: 0.18 }));
      [NOTEN.C5, NOTEN.E5, NOTEN.G5, NOTEN.C6].forEach((f) => ton(ac, z, t, { f, typ: 'triangle', start: 0.36, dauer: 0.7, laut: 0.1 }));
    } else if (gewonnen === false) {
      [NOTEN.G4, NOTEN.Eb4, NOTEN.C4].forEach((f, i) => ton(ac, z, t, { f, typ: 'triangle', start: i * 0.17, dauer: i === 2 ? 0.6 : 0.24, laut: 0.24 }));
    } else {
      ton(ac, z, t, { f: NOTEN.C5, typ: 'triangle', dauer: 0.24, laut: 0.22 });
      ton(ac, z, t, { f: NOTEN.G4, typ: 'triangle', start: 0.16, dauer: 0.45, laut: 0.2 });
    }
  },
};
// ungefaehre Laenge der Synth-Klaenge (fuer das Mischen der Stimmen), Sekunden
const SYNTH_DAUER = { zug: 0.15, schlagen: 0.2, rochade: 0.25, schach: 0.4, umwandlung: 0.5, fehler: 0.4, brillant: 0.75, feier: 0.15, ende: 1.15 };
// Ersatz wie vor dem Umbau, wenn weder Register noch Datei da sind: [name, ...args]
const ERSATZ = Object.freeze({
  stern: ['zug'], patzer: ['fehler'], sieg: ['ende', true], niederlage: ['ende', false], remis: ['ende', null],
});

// ---------- Katalog (PLAN 3.2) ----------

function k(gruppe, vorrang, wichtig, varianten, extra = {}) {
  return Object.freeze({ gruppe, vorrang, wichtig, varianten: Object.freeze(varianten), wechselnd: false, tonhoehe: false, ...extra });
}
export const KATALOG = Object.freeze({
  zug: k('brett', 1, true, ['zug', 'zug-2', 'zug-3'], { wechselnd: true }),
  schlagen: k('brett', 1, true, ['schlagen', 'schlagen-2'], { wechselnd: true }),
  rochade: k('brett', 1, true, ['rochade']),
  schach: k('brett', 2, true, ['schach']),
  umwandlung: k('brett', 2, true, ['umwandlung']),
  start: k('moment', 3, true, ['start']),
  sieg: k('moment', 3, true, ['sieg']),
  niederlage: k('moment', 3, true, ['niederlage']),
  remis: k('moment', 3, true, ['remis']),
  stern: k('moment', 3, true, ['stern', 'stern-2', 'stern-3']),
  brillant: k('bewertung', 3, true, ['brillant']),
  bester: k('bewertung', 2, false, ['bester']),
  combo: k('bewertung', 2, false, ['combo', 'combo-2', 'combo-3']),
  gut: k('bewertung', 1, false, ['gut']),
  ungenau: k('bewertung', 2, false, ['ungenau']),
  fehler: k('bewertung', 2, true, ['fehler']),
  patzer: k('bewertung', 2, true, ['patzer']),
  'uhr-warnung': k('uhr', 2, true, ['uhr-warnung']),
  'raetsel-richtig': k('uhr', 3, true, ['raetsel-richtig']),
  'raetsel-falsch': k('uhr', 2, false, ['raetsel-falsch']),
  klick: k('bedienung', 0, false, ['klick']),
  zurueck: k('bedienung', 0, false, ['zurueck']),
  schalter: k('bedienung', 0, false, ['schalter']),
  wechsel: k('bedienung', 0, false, ['wechsel']),
  'finisher-tinte': k('finisher', 3, true, ['finisher-tinte']),
  'finisher-kreide': k('finisher', 3, true, ['finisher-kreide']),
  'finisher-glocke': k('finisher', 3, true, ['finisher-glocke']),
  treffer: k('boss', 2, false, ['treffer']),
  level: k('feier', 3, true, ['level']),
  rekord: k('feier', 3, false, ['rekord']),
  siegel: k('feier', 3, true, ['siegel']),
  bauer: k('feier', 3, false, ['bauer']),
  // Feier-Zeile im Ergebnis: Tonhoehe steigt je Zeile (playbackRate 2^(2*stufe/12)). Gilt als wichtig, weil
  // partie.js bei der Stufe 'wichtig' schon selbst nur die grossen Zeilen durchlaesst (PLAN 3.5, wie heute).
  feier: k('feier', 1, true, ['feier'], { tonhoehe: true }),
});
export const PAKETE_KLANG = Object.freeze({
  holz: Object.freeze({ name: 'Holz', pfad: 'assets/klang/holz/' }),
  arcade: Object.freeze({ name: 'Arcade', pfad: 'assets/klang/arcade/' }),
});
// Labor-Klangsets (js/labor.js, nur der Erfinder): app.js reicht sie nur fuer ihn durch (klangWahl), sonst wie Holz/Arcade
export const PAKETE_LABOR = Object.freeze({
  grusel: Object.freeze({ name: 'Grusel', pfad: 'assets/klang/grusel/' }),
  kristall: Object.freeze({ name: 'Kristall', pfad: 'assets/klang/kristall/' }),
});
const paketVon = (p) => (Object.hasOwn(PAKETE_KLANG, p) ? PAKETE_KLANG[p] : Object.hasOwn(PAKETE_LABOR, p) ? PAKETE_LABOR[p] : null);
export const KLANGGRUPPEN = Object.freeze(['brett', 'bewertung', 'feier', 'uhr', 'boss', 'finisher', 'bedienung']);
export const KLANGSTUFEN = Object.freeze(['alle', 'wichtig', 'aus']);
const STIMMEN = 4;
// Gruppe und Vorrang fuer Namen ausserhalb des Katalogs (Register aus Welle 0)
const ZUSATZ = Object.freeze({ klasse: { gruppe: 'bewertung', vorrang: 2 }, ende: { gruppe: 'moment', vorrang: 3 } });
// Vorladen in dieser Reihenfolge (PLAN 3.4), danach der Rest des Katalogs
const VORN = ['zug', 'schlagen', 'rochade', 'schach', 'umwandlung', 'start', 'brillant', 'stern', 'sieg', 'niederlage', 'remis'];
const DATEIEN = Object.freeze([...new Set([...VORN, ...Object.keys(KATALOG)])].flatMap((n) => KATALOG[n].varianten));

// ---------- Klasse -> Klang (rein) ----------

export function klassenKlang(k, info = {}) {
  const i = info && typeof info === 'object' ? info : {};
  switch (k) {
    case 'brillant': return { name: 'brillant' };
    case 'stark':
    case 'bester': {
      if (i.trivial === true) return null;
      const serie = Number(i.serie) || 0;
      if (serie >= 2) return { name: 'combo', stufe: serie >= 8 ? 2 : serie >= 5 ? 1 : 0 };
      return { name: 'bester' };
    }
    case 'ungenau': return { name: 'ungenau' };
    case 'fehler':
    case 'verpasst': return { name: 'fehler' };
    case 'patzer': return { name: 'patzer' };
    default: return null;   // exzellent, gut, buch, erzwungen und Unbekanntes bleiben still
  }
}

// ---------- Zustand ----------

let paket = null;          // aktives Paket (null: noch nicht eingestellt, nur Synth)
let gewaehlt = '';         // Wahl in den Einstellungen ('' = Standard der Ansicht)
let thema = 'modern';
const puffer = new Map();  // datei -> AudioBuffer (nur das aktive Paket)
const fehlt = new Set();   // Dateien des aktiven Pakets, die nicht zu holen oder zu dekodieren waren
const fremd = new Map();   // 'paket/datei' -> AudioBuffer | null (Probe eines anderen Pakets)
const fremdLaden = new Map(); // 'paket/datei' -> Promise
let generation = 0;
let ladeLauf = null;       // { gen, promise }
let vorladenAn = false;
let vorladenGeplant = false;
let dekoder = null;        // OfflineAudioContext zum Dekodieren, solange es noch keinen Live-Kontext gibt
let pegelGesetzt = null;   // zuletzt an den Master gegebene Lautstaerke
const gruppen = Object.fromEntries(KLANGGRUPPEN.map((g) => [g, true]));
const aktiv = [];          // laufende Stimmen { name, vorrang, stimme, quelle, ende }
const zaehler = Object.create(null);
const protokollListe = [];

function umgebung() {
  return typeof document !== 'undefined' && typeof fetch === 'function';
}

function url(p, datei) {
  return new URL('../' + paketVon(p).pfad + datei + '.mp3', import.meta.url).href;
}

let protokollNr = 0;
function merke(eintrag) {
  if (!(TEST || klang.protokollieren)) return;
  protokollListe.push({ nr: ++protokollNr, ...eintrag, t: typeof performance !== 'undefined' ? Math.round(performance.now()) : Date.now() });
  if (protokollListe.length > 50) protokollListe.shift();
}

// ---------- Live-Kontext ----------

function master(v) {
  return Math.max(0, Math.min(1, Number(v) || 0)) ** 2;
}

function erzeuge() {
  if (!AC) return null;
  if (kontext && kontext.state === 'closed') { kontext = null; ausgang = null; }
  if (!kontext) {
    try {
      // Safari 17+: mischt sich mit Flos Musik und folgt dem Stummschalter
      try { if (typeof navigator !== 'undefined' && navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) { /* egal */ }
      kontext = new AC();
      ausgang = kontext.createGain();
      pegelGesetzt = klang.lautstaerke;
      ausgang.gain.value = master(klang.lautstaerke);
      // sanfter Begrenzer, weil sich bis zu 4 Stimmen ueberlagern
      const begrenzer = kontext.createDynamicsCompressor();
      begrenzer.threshold.value = -6;
      begrenzer.ratio.value = 4;
      ausgang.connect(begrenzer);
      begrenzer.connect(kontext.destination);
      dekoder = null;   // ab jetzt dekodiert der Live-Kontext
    } catch (e) {
      kontext = null;
      ausgang = null;
      return null;
    }
  }
  return kontext;
}

function entsperre() {
  const ac = erzeuge();
  if (!ac) return;
  if (ac.state !== 'running') {
    try {
      const p = ac.resume();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* egal */ }
    // iOS: ein stiller Puffer innerhalb der Geste schaltet die Ausgabe frei
    try {
      const q = ac.createBufferSource();
      q.buffer = ac.createBuffer(1, 1, 22050);
      q.connect(ac.destination);
      q.start(0);
    } catch (e) { /* egal */ }
  }
}

if (typeof document !== 'undefined' && document.addEventListener) {
  // Den Kontext beim Aufsetzen vorbereiten; die Freigabe bleibt auf Loslassen/Klick. Gerade Safari braucht
  // fuer den ersten Live-Kontext Zeit, die sonst erst nach der vollstaendigen Beruehrung beginnt.
  document.addEventListener('pointerdown', () => { if (!klang.aus) erzeuge(); }, { capture: true, passive: true });
  // Bleibt angemeldet: iOS unterbricht den Kontext nach App-Wechsel oder Anruf ('interrupted', 'suspended').
  // pointerdown zaehlt in WebKit nicht sicher als Geste, deshalb nicht in der Liste.
  for (const typ of ['touchend', 'click', 'keydown', 'pointerup']) {
    document.addEventListener(typ, () => {
      if (!klang.aus && (!kontext || kontext.state !== 'running')) entsperre();
    }, { capture: true, passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' || klang.aus || !kontext || kontext.state === 'running') return;
    try {
      const p = kontext.resume();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* egal */ }
  });
}

function setzePegel(sofort = false) {
  pegelGesetzt = klang.lautstaerke;
  if (!ausgang || !kontext) return;
  const ziel = master(klang.lautstaerke);
  try {
    if (sofort) ausgang.gain.value = ziel;
    else {
      ausgang.gain.cancelScheduledValues(kontext.currentTime);
      ausgang.gain.setTargetAtTime(ziel, kontext.currentTime, 0.015);
    }
  } catch (e) {
    ausgang.gain.value = ziel;
  }
}

// ---------- Laden und Dekodieren ----------

function hole(adresse) {
  return fetch(adresse).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
}

function dekodierKontext() {
  if (kontext) return kontext;
  if (!dekoder && OAC) {
    try { dekoder = new OAC(2, 1, 44100); } catch (e) { dekoder = null; }
  }
  return dekoder;
}

// Callback- und Promise-Form (aeltere Safari kennen nur Callbacks); Safari entwertet den Puffer, daher slice(0)
function dekodiere(daten) {
  const ac = dekodierKontext();
  if (!ac || !daten) return Promise.resolve(null);
  return new Promise((fertig) => {
    let erledigt = false;
    const ende = (b) => {
      if (erledigt) return;
      erledigt = true;
      fertig(b || null);
    };
    try {
      const p = ac.decodeAudioData(daten.slice(0), ende, () => ende(null));
      if (p && typeof p.then === 'function') p.then(ende, () => ende(null));
    } catch (e) {
      ende(null);
    }
  });
}

const pause = () => new Promise((r) => setTimeout(r, 0));
// Timer, der in Node das Beenden des Prozesses nicht aufhaelt (Tests)
function spaeter(fn, ms) {
  const h = setTimeout(fn, ms);
  if (h && typeof h.unref === 'function') h.unref();
  return h;
}

function vorladen() {
  vorladenAn = true;
  if (!paket || !umgebung()) return Promise.resolve(vorrat());
  if (ladeLauf && ladeLauf.gen === generation) return ladeLauf.promise;
  const gen = generation;
  const p = paket;
  const offen = DATEIEN.filter((d) => !puffer.has(d) && !fehlt.has(d));
  const lauf = { gen, promise: null };
  lauf.promise = (async () => {
    const versprechen = [];
    const starte = (i) => {
      if (i < offen.length && !versprechen[i]) versprechen[i] = hole(url(p, offen[i]));
    };
    for (let i = 0; i < 4; i++) starte(i);
    for (let i = 0; i < offen.length; i++) {
      starte(i + 4);
      const daten = await versprechen[i];
      versprechen[i] = null;
      if (gen !== generation) return vorrat();
      const b = daten ? await dekodiere(daten) : null;
      if (gen !== generation) return vorrat();
      if (b) puffer.set(offen[i], b);
      else fehlt.add(offen[i]);
      await pause();   // in kleinen Bloecken, damit die Arena nicht ruckelt
    }
    if (ladeLauf === lauf) ladeLauf = null;
    return vorrat();
  })();
  ladeLauf = lauf;
  return lauf.promise;
}

// eine Datei bei Bedarf holen (Probe, klangProbe); das aktive Paket landet im normalen Vorrat
function ladeEine(p, datei) {
  if (!paketVon(p) || !umgebung()) return Promise.resolve(null);
  if (p === paket && puffer.has(datei)) return Promise.resolve(puffer.get(datei));
  const schl = p + '/' + datei;
  if (p !== paket && fremd.has(schl)) return Promise.resolve(fremd.get(schl));
  if (fremdLaden.has(schl)) return fremdLaden.get(schl);
  const gen = generation;
  const pr = hole(url(p, datei)).then((d) => (d ? dekodiere(d) : null)).then((b) => {
    fremdLaden.delete(schl);
    if (p === paket && gen === generation) {
      if (b) puffer.set(datei, b);
    } else if (p !== paket) {
      fremd.set(schl, b);
    }
    return b;
  });
  fremdLaden.set(schl, pr);
  return pr;
}

function setzePaket(id) {
  gewaehlt = paketVon(id) ? id : '';
  const neu = gewaehlt || (PAKETE_KLANG[standardKlangpaket(thema)] ? standardKlangpaket(thema) : 'arcade');
  if (neu === paket) return paket;
  generation++;
  ladeLauf = null;
  // die Puffer des alten Pakets freigeben; schon fuer eine Probe dekodierte des neuen uebernehmen
  puffer.clear();
  fehlt.clear();
  for (const [schl, b] of fremd) if (b && schl.startsWith(neu + '/')) puffer.set(schl.slice(neu.length + 1), b);
  fremd.clear();
  fremdLaden.clear();
  paket = neu;
  if (vorladenAn) vorladen();
  return paket;
}

function vorrat() {
  return {
    paket, gewaehlt, dateien: DATEIEN.length, dekodiert: puffer.size, fehlt: fehlt.size,
    laedt: !!(ladeLauf && ladeLauf.gen === generation), fremd: fremd.size,
    stimmen: aktiv.length, master: ausgang ? ausgang.gain.value : null, kontext: kontext ? kontext.state : null,
  };
}

// ---------- Abspielen ----------

const OPTIONEN = new Set(['wann', 'gain', 'genau', 'stufe', 'paket']);
function trenne(args) {
  const letzt = args.length ? args[args.length - 1] : null;
  if (letzt && typeof letzt === 'object' && Object.getPrototypeOf(letzt) === Object.prototype) {
    const schl = Object.keys(letzt);
    if (schl.length && schl.every((s) => OPTIONEN.has(s))) return { args: args.slice(0, -1), opt: letzt };
  }
  return { args, opt: {} };
}

function infoVon(name) {
  return KATALOG[name] || ZUSATZ[name] || null;
}

function istWichtig(name, args) {
  const r = REGISTER.get(name);
  if (r) {
    if (typeof r.wichtig === 'function') {
      try { return !!r.wichtig(...args); } catch (e) { return true; }
    }
    return r.wichtig !== false;
  }
  const i = KATALOG[name];
  return i ? i.wichtig !== false : true;   // Synth-Namen ausserhalb des Katalogs (ende) gelten als wichtig
}

function variante(name, info, opt, weiter = true) {
  const v = info.varianten;
  if (v.length === 1) return v[0];
  if (opt.stufe != null && Number.isFinite(Number(opt.stufe))) return v[Math.max(0, Math.min(v.length - 1, Math.floor(Number(opt.stufe))))];
  if (!info.wechselnd) return v[0];
  const n = ((zaehler[name] ?? -1) + 1) % v.length;
  if (weiter) zaehler[name] = n;
  return v[n];
}

// -> { art: 'register' | 'datei' | 'synth', fn?, args?, buffer?, datei?, paket?, rate?, ersatz? } oder null
function quelle(name, args, opt, { weiter = true, tiefe = 0 } = {}) {
  const r = REGISTER.get(name);
  if (r) return { art: 'register', fn: r.fn, args };
  const info = KATALOG[name];
  if (info) {
    const p = opt.paket && paketVon(opt.paket) ? opt.paket : paket;
    if (p) {
      const datei = variante(name, info, opt, weiter);
      const b = p === paket ? puffer.get(datei) : fremd.get(p + '/' + datei);
      if (b) {
        const stufe = info.tonhoehe ? Math.min(6, Math.max(0, Number(args[0]) || 0)) : 0;
        return { art: 'datei', buffer: b, datei, paket: p, rate: Math.pow(2, (2 * stufe) / 12) };
      }
    }
    if (opt.genau) return null;
  }
  if (Object.prototype.hasOwnProperty.call(KLAENGE, name)) return { art: 'synth', fn: KLAENGE[name], args };
  const e = ERSATZ[name];
  if (e && tiefe < 2) {
    const q = quelle(e[0], e.slice(1), {}, { weiter, tiefe: tiefe + 1 });
    return q ? { ...q, ersatz: e[0] } : null;
  }
  return null;
}

function still(name, grund) {
  merke({ name, aktion: 'still', grund });
}

function aufraeumen(jetzt) {
  for (let i = aktiv.length - 1; i >= 0; i--) if (aktiv[i].ende <= jetzt) aktiv.splice(i, 1);
}

function beende(s, jetzt) {
  try {
    s.stimme.gain.cancelScheduledValues(jetzt);
    s.stimme.gain.setTargetAtTime(0, jetzt, 0.012);
  } catch (e) { /* egal */ }
  try { if (s.src) s.src.stop(jetzt + 0.06); } catch (e) { /* egal */ }
  spaeter(() => { try { s.stimme.disconnect(); } catch (e) { /* egal */ } }, 200);
}

// Platz schaffen (Entwurf A): nie eine Stimme mit hoeherem Vorrang abbrechen; Vorrang 3 darf ueberziehen
function platz(name, vorrang, jetzt) {
  aufraeumen(jetzt);
  if (aktiv.length < STIMMEN) return true;
  let opfer = -1;
  aktiv.forEach((a, i) => {
    if (a.vorrang >= 3 || a.vorrang > vorrang) return;
    if (opfer < 0 || a.vorrang < aktiv[opfer].vorrang) opfer = i;   // aeltestes mit niedrigstem Vorrang
  });
  if (opfer < 0) return vorrang >= 3;
  const alt = aktiv.splice(opfer, 1)[0];
  beende(alt, jetzt);
  merke({ name: alt.name, aktion: 'opfert', fuer: name, vorrang: alt.vorrang, stimmen: aktiv.length });
  return true;
}

function spiele(name, ...rest) {
  const { args, opt } = trenne(rest);
  if (klang.aus) return still(name, 'aus');
  if (klang.stufe === 'aus') return still(name, 'stufe');
  const info = infoVon(name);
  if (info && info.gruppe && gruppen[info.gruppe] === false) return still(name, 'gruppe');
  if (klang.stufe === 'wichtig' && !istWichtig(name, args)) return still(name, 'stufe');
  if (!kontext) return still(name, 'gesperrt');
  if (kontext.state !== 'running') {
    try {
      const p = kontext.resume();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* egal */ }
    if (kontext.state !== 'running') return still(name, 'gesperrt');
  }
  const q = quelle(name, args, opt);
  if (!q) return still(name, 'keine-quelle');
  if (q.art === 'register' && !q.ersatz) q.args = rest;   // ein registrierter Klang bekommt alles unveraendert
  const vorrang = info ? info.vorrang : 1;
  const jetzt = kontext.currentTime;
  if (!platz(name, vorrang, jetzt)) {
    merke({ name, aktion: 'verworfen', vorrang, stimmen: aktiv.length });
    return undefined;
  }
  try {
    if (pegelGesetzt !== klang.lautstaerke) setzePegel();
    const wann = Math.max(0, Number(opt.wann) || 0);
    const t = jetzt + 0.005 + wann;
    const stimme = kontext.createGain();
    stimme.gain.value = opt.gain != null && Number.isFinite(Number(opt.gain)) ? Math.max(0, Math.min(2, Number(opt.gain))) : 1;
    stimme.connect(ausgang);
    const s = { name, vorrang, stimme, src: null, quelle: q.art, ende: 0 };
    if (q.art === 'datei') {
      const src = kontext.createBufferSource();
      src.buffer = q.buffer;
      if (q.rate !== 1) src.playbackRate.value = q.rate;
      src.connect(stimme);
      src.onended = () => {
        const i = aktiv.indexOf(s);
        if (i >= 0) aktiv.splice(i, 1);
        try { stimme.disconnect(); } catch (e) { /* egal */ }
      };
      s.src = src;
      s.ende = t + q.buffer.duration / q.rate;
      src.start(t);
    } else {
      q.fn(kontext, stimme, t, ...q.args);
      const n = q.ersatz || name;
      s.ende = t + (q.art === 'synth' ? (SYNTH_DAUER[n] ?? 0.5) : 0.6);
      // Synth-Knoten enden von selbst; die Stimme danach abhaengen (registrierte Klaenge duerfen laenger sein)
      spaeter(() => { try { stimme.disconnect(); } catch (e) { /* egal */ } }, (s.ende - jetzt) * 1000 + (q.art === 'synth' ? 1500 : 4000));
    }
    aktiv.push(s);
    merke({ name, aktion: 'spielt', quelle: q.art, datei: q.datei || null, paket: q.paket || null, ersatz: q.ersatz || null,
      vorrang, stimmen: aktiv.length, jetzt, start: t, rate: q.rate || 1 });
  } catch (e) { /* Klang ist nie wichtig genug fuer einen Fehler */ }
  return undefined;
}

// ---------- Register (Pakete) ----------

const REGISTER = new Map();   // name -> { fn, wichtig }

export function registriereKlang(name, fn, { wichtig = true } = {}) {
  if (typeof name !== 'string' || !name) throw new TypeError('registriereKlang: name fehlt');
  if (typeof fn !== 'function') throw new TypeError('registriereKlang(' + name + '): fn ist keine Funktion');
  const eintrag = { fn, wichtig };
  REGISTER.set(name, eintrag);
  return function abmelden() {
    if (REGISTER.get(name) === eintrag) REGISTER.delete(name);
  };
}

// ---------- API ----------

export const klang = {
  aus: false,
  lautstaerke: 0.8,
  stufe: 'alle',   // 'alle' | 'wichtig' | 'aus'
  protokollieren: false,
  zug(...a) { spiele('zug', ...a); },
  schlagen(...a) { spiele('schlagen', ...a); },
  schach(...a) { spiele('schach', ...a); },
  rochade(...a) { spiele('rochade', ...a); },
  umwandlung(...a) { spiele('umwandlung', ...a); },
  // true = Sieg, false = Niederlage, sonst Remis
  ende(gewonnen, ...a) {
    if (REGISTER.has('ende')) spiele('ende', gewonnen, ...a);
    else spiele(gewonnen === true ? 'sieg' : gewonnen === false ? 'niederlage' : 'remis', ...a);
  },
  fehler(...a) { spiele('fehler', ...a); },
  brillant(...a) { spiele('brillant', ...a); },
  spiele(name, ...args) { spiele(name, ...args); },
  // Klang zur Zugklasse (PLAN 3.6); ein registrierter Klang 'klasse' bekommt (k, ...args) und geht vor
  klasse(k, ...args) {
    if (REGISTER.has('klasse')) return spiele('klasse', k, ...args);
    const w = klassenKlang(k, args[0]);
    if (!w) return undefined;
    return w.stufe != null ? spiele(w.name, { stufe: w.stufe }) : spiele(w.name);
  },
  // Klang je Stern im Ergebnis; klingt auch bei reduzierter Bewegung (PLAN 3.6)
  stern(i, neu) {
    if (REGISTER.has('stern')) return spiele('stern', i, neu);
    return spiele('stern', { stufe: Math.max(0, Math.min(2, Math.floor(Number(i) || 0))) });
  },
  aktivieren() { if (!this.aus) entsperre(); },
  zustand() {
    if (this.aus || this.stufe === 'aus') return 'aus';
    if (!AC) return 'nicht-verfuegbar';
    if (!kontext || kontext.state !== 'running') return 'gesperrt';
    return ladeLauf && ladeLauf.gen === generation ? 'laedt' : 'bereit';
  },
  einstellen(e = {}) {
    if (!e || typeof e !== 'object') return;
    if (typeof e.klang === 'boolean') this.aus = !e.klang;
    if (KLANGSTUFEN.includes(e.klangstufe)) this.stufe = e.klangstufe;
    if (e.klanggruppen && typeof e.klanggruppen === 'object') for (const g of KLANGGRUPPEN) gruppen[g] = e.klanggruppen[g] !== false;
    if (typeof e.lautstaerke === 'number' && Number.isFinite(e.lautstaerke)) this.setzeLautstaerke(e.lautstaerke);
    if (typeof e.thema === 'string') thema = e.thema;
    setzePaket(typeof e.klangpaket === 'string' ? e.klangpaket : '');
    // 1 s nach dem ersten Screen vorladen (die App ruft einstellen() direkt vor dem ersten Screen)
    if (!vorladenGeplant && umgebung()) {
      vorladenGeplant = true;
      spaeter(() => { try { vorladen(); } catch (f) { /* egal */ } }, 1000);
    }
  },
  setzePaket(id) { return setzePaket(id); },
  setzeLautstaerke(v) {
    this.lautstaerke = Math.max(0, Math.min(1, Number(v) || 0));
    setzePegel();
    return this.lautstaerke;
  },
  vorladen() { return vorladen(); },
  async probe(id) {
    const p = paketVon(id) ? id : (paket || 'arcade');
    this.aktivieren();
    const szene = [['zug', 0], ['schlagen', 0.34], ['bester', 0.72], ['stern', 1.2]];
    if (p !== paket || puffer.size === 0) await Promise.all(szene.map(([n]) => ladeEine(p, KATALOG[n].varianten[0])));
    for (const [n, wann] of szene) spiele(n, { paket: p, wann, stufe: 0 });
  },
  stille() {
    if (!kontext) return;
    const jetzt = kontext.currentTime;
    while (aktiv.length) beende(aktiv.pop(), jetzt);
  },
  vorrat() { return vorrat(); },
  get gruppen() { return { ...gruppen }; },
  protokoll() { return protokollListe.map((e) => ({ ...e })); },
};

// Rendert einen Klang offline und misst ihn (fuer Tests): { spitze (0..1), dauer (s), quelle, datei }.
// Reihenfolge wie beim Abspielen; die Datei des Pakets wird bei Bedarf geholt (Optionen wie bei spiele).
export async function klangProbe(name, ...rest) {
  const { args, opt } = trenne(rest);
  const info = KATALOG[name];
  if (info && !REGISTER.has(name)) {
    const p = opt.paket && paketVon(opt.paket) ? opt.paket : paket;
    if (p) await ladeEine(p, variante(name, info, opt, false));
  }
  const q = quelle(name, args, opt, { weiter: false });
  if (!OAC || !q) return null;
  const rate = 22050;
  const kanaele = q.art === 'datei' ? Math.min(2, q.buffer.numberOfChannels || 1) : 1;
  const sek = q.art === 'datei' ? Math.max(2, q.buffer.duration / q.rate + 0.3) : 2;
  const ac = new OAC(kanaele, Math.floor(rate * sek), rate);
  if (q.art === 'datei') {
    const src = ac.createBufferSource();
    src.buffer = q.buffer;
    if (q.rate !== 1) src.playbackRate.value = q.rate;
    src.connect(ac.destination);
    src.start(0.01);
  } else {
    q.fn(ac, ac.destination, 0.01, ...q.args);
  }
  const ergebnis = await ac.startRendering();
  let spitze = 0;
  let letzte = 0;
  for (let c = 0; c < (ergebnis.numberOfChannels || 1); c++) {
    const d = ergebnis.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i]);
      if (a > spitze) spitze = a;
      if (a > 0.003 && i > letzte) letzte = i;
    }
  }
  return { spitze, dauer: letzte / rate, quelle: q.art, datei: q.datei || null };
}
