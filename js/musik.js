// Generative Menue-Musik: ein kleiner Web-Audio-Abspieler (nur Oszillatoren, keine Samples). Der Code steht wie
// die ganze App unter der GPL-3.0. Die Melodien selbst (Tempo, Grundton, Klangfarbe, Tonfolge) liegen getrennt in
// assets/klang/melodien.json; sie sind eigene Werke von Flo mit eigenem Vorbehalt (assets/LIZENZ-KUNST.md).
//
// API: musik.aktivieren() (erste Geste), einstellen({ an, laut, welt }), partie(an), sichtbarkeit(ja),
//      zustand(), stop(); ladeMelodien() holt die Datei (offline aus dem Cache von sw.js), setzeMelodien(daten)
//      prueft und uebernimmt sie (Tests).
export const MUSIK_WELTEN = Object.freeze(['karofelder', 'springerforst', 'turmstadt', 'gezeitenkueste', 'stockfisch-tiefe']
  .map((id) => Object.freeze({ id })));

const QUELLE = 'assets/klang/melodien.json';
const TYPEN = ['sine', 'triangle', 'square', 'sawtooth'];

let ac = null;
let master = null;
let timer = null;
let schlafUhr = null;
let schritt = 0;
let entsperrt = false;
let aktiv = false;
let sichtbar = true;
let lautstaerke = .35;
let welt = MUSIK_WELTEN[0].id;
let melodien = null;
let laden = null;

function audioKlasse() {
  return typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext || null) : null;
}
function gueltig(m) {
  return !!m && Number(m.bpm) > 0 && Number(m.grund) > 0 && TYPEN.includes(m.typ)
    && Array.isArray(m.folge) && m.folge.length > 0 && m.folge.every((n) => Number.isFinite(n));
}
// Nimmt { melodien: { <welt-id>: { bpm, grund, typ, folge } } }; Karofelder muss dabei sein (Rueckfall)
export function setzeMelodien(daten) {
  const roh = daten && daten.melodien;
  if (!roh || !gueltig(roh[MUSIK_WELTEN[0].id])) return false;
  const neu = {};
  for (const { id } of MUSIK_WELTEN) if (gueltig(roh[id])) neu[id] = Object.freeze({ ...roh[id], folge: Object.freeze([...roh[id].folge]) });
  melodien = Object.freeze(neu);
  return true;
}
export function ladeMelodien() {
  if (melodien) return Promise.resolve(true);
  if (!laden) {
    let url = QUELLE;
    try { url = new URL('../' + QUELLE, import.meta.url).href; } catch (e) { /* relativ lassen */ }
    laden = (typeof fetch === 'function' ? fetch(url) : Promise.reject(new Error('kein fetch')))
      .then((r) => (r.ok ? r.json() : null)).then(setzeMelodien).catch(() => false)
      .then((ok) => { if (!ok) laden = null; return ok; });
  }
  return laden;
}
function melodie() { return melodien ? (melodien[welt] || melodien[MUSIK_WELTEN[0].id]) : null; }

function audioSession() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) { /* nicht unterstuetzt */ }
}
function kontext() {
  const AC = audioKlasse();
  if (!AC) return null;
  if (!ac) {
    ac = new AC(); master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination); audioSession();
  }
  return ac;
}
function wecke(c) {
  if (!c || c.state === 'running') return;
  try { const p = c.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ohne Geste abgelehnt */ }
}
function note(m, halbton, start, dauer, leise = false) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = m.typ; o.frequency.value = m.grund * Math.pow(2, halbton / 12);
  g.gain.setValueAtTime(.0001, start);
  g.gain.exponentialRampToValueAtTime(leise ? .025 : .055, start + .08);
  g.gain.exponentialRampToValueAtTime(.0001, start + dauer);
  o.connect(g); g.connect(master); o.start(start); o.stop(start + dauer + .03);
}
function plane() {
  const m = melodie();
  if (!aktiv || !entsperrt || !sichtbar || !ac || !master || !m) return;
  const takt = 60 / m.bpm;
  // Verpasste Takte (Partie, Hintergrund) nicht nachholen, sondern ab jetzt weiterspielen
  if (schritt < ac.currentTime) schritt = ac.currentTime + .05;
  while (schritt < ac.currentTime + 1.5) {
    const i = Math.round(schritt / takt);
    const n = m.folge[i % m.folge.length];
    note(m, n, schritt, takt * 1.8);
    if (i % 3 === 0) note(m, n - 12, schritt, takt * 2.7, true);
    schritt += takt;
  }
}
function haltePlaner() { if (timer) clearInterval(timer); timer = null; }
function startePlaner() {
  if (!aktiv || !entsperrt || !sichtbar) return;
  const c = kontext(); if (!c) return;
  wecke(c);
  if (!melodien) { ladeMelodien().then((ok) => { if (ok) startePlaner(); }); return; }
  plane();
  if (!timer) timer = setInterval(plane, 500);
}
function fade(ziel, sekunden = .8) {
  if (!master || !ac) return;
  master.gain.cancelScheduledValues(ac.currentTime);
  master.gain.setTargetAtTime(Math.max(.0001, ziel), ac.currentTime, Math.max(.01, sekunden / 4));
}
// Hintergrund: Planer aus, kurz ausblenden, dann den Kontext anhalten (spart Akku, nichts laeuft weiter)
function schlafe() {
  haltePlaner();
  fade(0, .2);
  clearTimeout(schlafUhr);
  schlafUhr = setTimeout(() => {
    schlafUhr = null;
    if (sichtbar || !ac || ac.state !== 'running') return;
    try { const p = ac.suspend(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* egal */ }
  }, 250);
}

export const musik = Object.freeze({
  // Bei jeder Geste: Kontext freischalten bzw. nach App-Wechsel wieder wecken (iOS braucht dafuer eine Geste)
  aktivieren() { entsperrt = true; startePlaner(); },
  einstellen({ an, laut = lautstaerke, welt: w = welt } = {}) {
    lautstaerke = Math.max(0, Math.min(1, Number(laut) || 0));
    welt = MUSIK_WELTEN.some((m) => m.id === w) ? w : MUSIK_WELTEN[0].id;
    aktiv = !!an;
    if (aktiv && sichtbar) { startePlaner(); fade(lautstaerke * lautstaerke); }
    else fade(0);
  },
  partie(an) { if (an) fade(0, 1.2); else if (aktiv && sichtbar) { startePlaner(); fade(lautstaerke * lautstaerke, 1.2); } },
  sichtbarkeit(ja) {
    if (sichtbar === !!ja) return;
    sichtbar = !!ja;
    if (!sichtbar) { schlafe(); return; }
    clearTimeout(schlafUhr); schlafUhr = null;
    if (aktiv) { startePlaner(); fade(lautstaerke * lautstaerke); }
  },
  zustand() {
    return { entsperrt, aktiv, sichtbar, lautstaerke, melodie: welt, planer: !!timer, melodien: !!melodien, kontext: ac ? ac.state : 'fehlt' };
  },
  stop() { aktiv = false; fade(0); haltePlaner(); clearTimeout(schlafUhr); schlafUhr = null; },
});
