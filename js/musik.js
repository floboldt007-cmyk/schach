// Eigene, generative Menue-Musik. Es werden ausschliesslich Web-Audio-Oszillatoren verwendet.
// Die kurzen Motive sind fuer Crownmate komponiert; alle Rechte vorbehalten, Nutzung nur in dieser App.
const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;

export const MUSIK_WELTEN = Object.freeze([
  { id: 'karofelder', name: 'Karofelder', bpm: 66, grund: 220, typ: 'sine', folge: [0, 4, 7, 11, 7, 4] },
  { id: 'springerforst', name: 'Springerforst', bpm: 58, grund: 196, typ: 'triangle', folge: [0, 3, 7, 10, 7, 3] },
  { id: 'turmstadt', name: 'Turmstadt', bpm: 72, grund: 174.61, typ: 'triangle', folge: [0, 7, 5, 12, 10, 7] },
  { id: 'gezeitenkueste', name: 'Gezeitenküste', bpm: 54, grund: 233.08, typ: 'sine', folge: [0, 2, 7, 9, 7, 2] },
  { id: 'stockfisch-tiefe', name: 'Stockfisch-Tiefe', bpm: 48, grund: 164.81, typ: 'sine', folge: [0, 6, 10, 13, 10, 6] },
]);

let ac = null;
let master = null;
let timer = null;
let schritt = 0;
let entsperrt = false;
let aktiv = false;
let lautstaerke = .35;
let melodie = MUSIK_WELTEN[0];

function audioSession() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) { /* nicht unterstuetzt */ }
}
function kontext() {
  if (!AC) return null;
  if (!ac) {
    ac = new AC(); master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination); audioSession();
  }
  return ac;
}
function note(halbton, start, dauer, leise = false) {
  const c = kontext();
  if (!c || !master) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = melodie.typ; o.frequency.value = melodie.grund * Math.pow(2, halbton / 12);
  g.gain.setValueAtTime(.0001, start);
  g.gain.exponentialRampToValueAtTime(leise ? .025 : .055, start + .08);
  g.gain.exponentialRampToValueAtTime(.0001, start + dauer);
  o.connect(g); g.connect(master); o.start(start); o.stop(start + dauer + .03);
}
function plane() {
  if (!aktiv || !entsperrt || !ac) return;
  const takt = 60 / melodie.bpm;
  while (schritt < ac.currentTime + 1.5) {
    const i = Math.round(schritt / takt);
    const n = melodie.folge[i % melodie.folge.length];
    note(n, schritt, takt * 1.8);
    if (i % 3 === 0) note(n - 12, schritt, takt * 2.7, true);
    schritt += takt;
  }
}
function startePlaner() {
  if (timer || !aktiv || !entsperrt) return;
  const c = kontext(); if (!c) return;
  c.resume(); schritt = Math.max(schritt, c.currentTime + .05); plane(); timer = setInterval(plane, 500);
}
function fade(ziel, sekunden = .8) {
  if (!master || !ac) return;
  master.gain.cancelScheduledValues(ac.currentTime);
  master.gain.setTargetAtTime(Math.max(.0001, ziel), ac.currentTime, Math.max(.01, sekunden / 4));
}

export const musik = Object.freeze({
  aktivieren() { entsperrt = true; startePlaner(); },
  einstellen({ an, laut = lautstaerke, welt = melodie.id } = {}) {
    lautstaerke = Math.max(0, Math.min(1, Number(laut) || 0));
    melodie = MUSIK_WELTEN.find((m) => m.id === welt) || MUSIK_WELTEN[0];
    aktiv = !!an;
    if (aktiv) { startePlaner(); fade(lautstaerke * lautstaerke); }
    else fade(0);
  },
  partie(an) { if (an) fade(0, 1.2); else if (aktiv) { startePlaner(); fade(lautstaerke * lautstaerke, 1.2); } },
  zustand() { return { entsperrt, aktiv, lautstaerke, melodie: melodie.id, kontext: ac ? ac.state : 'fehlt' }; },
  stop() { aktiv = false; fade(0); if (timer) clearInterval(timer); timer = null; },
});
