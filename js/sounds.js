// Klaenge per WebAudio, ohne Audiodateien. Kurz und weich, damit sie nicht nerven.
// iOS: der AudioContext entsteht erst bei der ersten Beruehrung (vorher sind alle Aufrufe stumm).
//
//   import { klang } from './sounds.js';
//   klang.zug(); klang.schlagen(); klang.ende(true); klang.aus = true;
//
// Zusatz: klang.lautstaerke (0..1), klang.aktivieren() (manuell entsperren),
// klang.zustand() -> 'aus' | 'gesperrt' | 'bereit' | 'nicht-verfuegbar',
// klangProbe(name, ...args) rendert einen Klang offline (fuer Tests: Spitze und Dauer), auch
// registrierte Klaenge.
//
// Register (Runde 4, fuer Pakete):
//   export { ton, klick, tock, huelle, rauschen, NOTEN }   Bausteine fuer eigene Synthese
//       (ton(ac, ziel, t0, { f, fEnde, typ, start, dauer, laut, anstieg }), klick(ac, ziel, t0, { start,
//       dauer, laut, frequenz, q }), tock(ac, ziel, t0, start, hoehe, laut), huelle(ac, ziel, t, laut,
//       anstieg, dauer) -> GainNode, rauschen(ac) -> AudioBuffer, NOTEN: Name -> Hz, eingefroren)
//   registriereKlang(name, fn, { wichtig = true } = {}) -> abmelden()
//       fn(ac, ziel, t, ...args) spielt auf einem beliebigen BaseAudioContext (auch offline).
//       Ein registrierter Klang geht vor einen eingebauten gleichen Namens. wichtig: true | false |
//       (...args) -> boolean (bei klang.stufe 'wichtig' spielen nur wichtige Klaenge).
//   klang.spiele(name, ...args)   registrierter oder eingebauter Klang
//   klang.klasse(k, ...args)      Klang zur Zugklasse; ohne Register 'klasse' wie bisher: brillant spielt
//                                 brillant(), fehler und patzer spielen fehler(), sonst still
//   klang.stern(i, neu)           Klang je Stern im Ergebnis; ohne Register 'stern' wie bisher zug()
//   klang.stufe = 'alle'          'alle' | 'wichtig' (eingebaute Klaenge gelten als wichtig)
//   Eingebaut zusaetzlich 'feier' (stufe): leiser Tick je Feier-Zeile im Ergebnis, Tonhoehe steigt.

const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
const OAC = typeof window !== 'undefined' ? (window.OfflineAudioContext || window.webkitOfflineAudioContext) : null;

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

// ---------- Live-Kontext ----------

function erzeuge() {
  if (!AC) return null;
  if (!kontext) {
    try {
      kontext = new AC();
      ausgang = kontext.createGain();
      ausgang.gain.value = klang.lautstaerke;
      // sanfter Begrenzer gegen Uebersteuern, wenn Klaenge sich ueberlagern
      const begrenzer = kontext.createDynamicsCompressor();
      begrenzer.threshold.value = -10;
      begrenzer.ratio.value = 6;
      ausgang.connect(begrenzer);
      begrenzer.connect(kontext.destination);
    } catch (e) {
      kontext = null;
      return null;
    }
  }
  return kontext;
}

function entsperre() {
  const ac = erzeuge();
  if (!ac) return;
  if (ac.state !== 'running') {
    const p = ac.resume();
    if (p && p.catch) p.catch(() => {});
    // iOS: ein stiller Puffer innerhalb der Geste schaltet die Ausgabe frei
    try {
      const q = ac.createBufferSource();
      q.buffer = ac.createBuffer(1, 1, 22050);
      q.connect(ac.destination);
      q.start(0);
    } catch (e) { /* egal */ }
  }
}

if (typeof document !== 'undefined') {
  // Bleibt angemeldet: iOS unterbricht den Kontext z. B. nach dem Wechsel in eine andere App.
  for (const typ of ['pointerdown', 'pointerup', 'touchend', 'mousedown', 'keydown', 'click']) {
    document.addEventListener(typ, () => {
      if (!klang.aus && (!kontext || kontext.state !== 'running')) entsperre();
    }, { capture: true, passive: true });
  }
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

function klangFn(name) {
  const r = REGISTER.get(name);
  if (r) return r.fn;
  return Object.prototype.hasOwnProperty.call(KLAENGE, name) ? KLAENGE[name] : null;
}

function istWichtig(name, args) {
  const r = REGISTER.get(name);
  if (!r) return true;
  if (typeof r.wichtig === 'function') {
    try { return !!r.wichtig(...args); } catch (e) { return true; }
  }
  return r.wichtig !== false;
}

function spiele(name, ...args) {
  if (klang.aus || !kontext) return;
  const fn = klangFn(name);
  if (!fn) return;
  if (klang.stufe === 'wichtig' && !istWichtig(name, args)) return;
  if (kontext.state !== 'running') {
    const p = kontext.resume();
    if (p && p.catch) p.catch(() => {});
    if (kontext.state !== 'running') return;
  }
  try {
    ausgang.gain.value = Math.max(0, Math.min(1, Number(klang.lautstaerke) || 0));
    fn(kontext, ausgang, kontext.currentTime + 0.005, ...args);
  } catch (e) { /* Klang ist nie wichtig genug fuer einen Fehler */ }
}

export const klang = {
  aus: false,
  lautstaerke: 0.7,
  zug() { spiele('zug'); },
  schlagen() { spiele('schlagen'); },
  schach() { spiele('schach'); },
  rochade() { spiele('rochade'); },
  umwandlung() { spiele('umwandlung'); },
  ende(gewonnen) { spiele('ende', gewonnen); },  // true = Sieg, false = Niederlage, sonst Remis
  fehler() { spiele('fehler'); },
  brillant() { spiele('brillant'); },
  stufe: 'alle',   // 'alle' | 'wichtig'
  spiele(name, ...args) { spiele(name, ...args); },
  // Klang zur Zugklasse (Standard wie bisher in der Partie)
  klasse(k, ...args) {
    if (REGISTER.has('klasse')) spiele('klasse', k, ...args);
    else if (k === 'brillant') spiele('brillant');
    else if (k === 'fehler' || k === 'patzer') spiele('fehler');
  },
  // Klang je Stern im Ergebnis (Standard wie bisher: zug)
  stern(i, neu) {
    if (REGISTER.has('stern')) spiele('stern', i, neu);
    else spiele('zug');
  },
  aktivieren() { if (!this.aus) entsperre(); },
  zustand() {
    if (this.aus) return 'aus';
    if (!AC) return 'nicht-verfuegbar';
    return kontext && kontext.state === 'running' ? 'bereit' : 'gesperrt';
  },
};

// Rendert einen Klang offline und misst ihn (fuer Tests): { spitze, dauer } in 0..1 bzw. Sekunden
export async function klangProbe(name, ...args) {
  const fn = klangFn(name);
  if (!OAC || !fn) return null;
  const rate = 22050;
  const ac = new OAC(1, Math.floor(rate * 2), rate);
  fn(ac, ac.destination, 0.01, ...args);
  const puffer = await ac.startRendering();
  const d = puffer.getChannelData(0);
  let spitze = 0;
  let letzte = 0;
  for (let i = 0; i < d.length; i++) {
    const a = Math.abs(d[i]);
    if (a > spitze) spitze = a;
    if (a > 0.003) letzte = i;
  }
  return { spitze, dauer: letzte / rate };
}
