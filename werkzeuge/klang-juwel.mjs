// Labor-Klangset "Juwel" (Flo 01.11.2026: "Klaenge brauchen Dopamin und muessen satisfying sein"). Eigene Synthese in
// JavaScript, keine Aufnahme und kein Sample von irgendwoher: Sinus- und Glockentoene, gefiltertes Rauschen, ein kleiner
// Hall (Freeverb-Art). Darum eigene Werke von Flo wie Holz und Arcade (assets/klang/LIZENZEN.md).
//
// Klangidee: Zuege sind kurze, knackige "Pops" (Klick plus Ton, der von oben einrastet), Schlagen hat zusaetzlich einen
// tiefen Rumms und ein Knacken. Belohnungen klingen nach Glas und Edelstein (helle Glocken mit Funkeln), und was sich
// steigert, steigt auch im Ton: Stern 1 bis 3, Combo 1 bis 3, Feier je Zeile. Fehler sind weich und leise, nie
// strafend. Alles in C-Dur bzw. dessen Pentatonik, damit sich Folgen nie beissen.
//
//   node werkzeuge/klang-juwel.mjs        schreibt assets/klang/juwel/*.mp3 (braucht ffmpeg mit libmp3lame)
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const ZIEL = join(WURZEL, 'assets/klang/juwel');
const SR = 44100;

// ---------- Werkzeuge ----------
// fester Zufall, damit jeder Lauf dieselben Dateien schreibt
let saat = 20261101;
const zufall = () => { saat = (saat * 1664525 + 1013904223) >>> 0; return saat / 4294967296; };
const hz = (note) => 440 * 2 ** ((note - 69) / 12);   // MIDI-Note -> Hz
const N = { C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, A4: 69, B4: 71, C5: 72, D5: 74, E5: 76, F5: 77, G5: 79, A5: 81, B5: 83,
  C6: 84, D6: 86, E6: 88, G6: 91, A6: 93, B6: 95, C7: 96, D7: 98, E7: 100, G7: 103 };

const puffer = (s) => new Float32Array(Math.ceil(s * SR));
function mische(ziel, quelle, ab = 0, faktor = 1) {
  const o = Math.round(ab * SR);
  for (let i = 0; i < quelle.length && o + i < ziel.length; i++) if (o + i >= 0) ziel[o + i] += quelle[i] * faktor;
  return ziel;
}

// Ton mit Huellkurve: frequenz als Zahl oder Funktion der Zeit, Teiltoene [Verhaeltnis, Pegel, Abklingfaktor]
function ton({ f, dauer, angriff = 0.002, abkling = 0.25, teile = [[1, 1, 1]], start = 0, pegel = 1 }) {
  const b = puffer(dauer);
  const phasen = teile.map(() => start);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const fr = typeof f === 'function' ? f(t) : f;
    const an = t < angriff ? t / angriff : 1;
    let s = 0;
    teile.forEach(([r, a, k], j) => {
      phasen[j] += (2 * Math.PI * fr * r) / SR;
      s += a * Math.sin(phasen[j]) * Math.exp(-t / (abkling / k));
    });
    b[i] = s * an * pegel;
  }
  return ausblenden(b);
}
// letzte 12 ms weich auf null (ein hart abgeschnittener Ton knackt)
function ausblenden(b, ms = 12) {
  const n = Math.min(b.length, Math.round((ms / 1000) * SR));
  for (let i = 0; i < n; i++) b[b.length - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / n);
  return b;
}
// Glas-Glocke (Edelstein): leicht unharmonische Teiltoene, die hohen klingen schneller ab
const GLAS = [[1, 1, 1], [2.0, 0.42, 1.6], [3.01, 0.22, 2.4], [4.17, 0.16, 3.4], [5.43, 0.1, 4.6]];
const glocke = (note, dauer = 0.8, pegel = 0.5, abkling = 0.35) => ton({ f: hz(note), dauer, abkling, teile: GLAS, pegel, angriff: 0.0015 });
// Pop: Ton, der von oben einrastet (kurzer Tonhoehensturz), dazu ein Klick
function pop(note, { dauer = 0.12, pegel = 0.55, sturz = 2.2, zeit = 0.014, abkling = 0.045 } = {}) {
  const f0 = hz(note);
  const b = ton({ f: (t) => f0 * (1 + (sturz - 1) * Math.exp(-t / zeit)), dauer, abkling, pegel, teile: [[1, 1, 1], [2, 0.18, 2]] });
  return mische(b, klick(0.008, 0.35, 5200));
}
// Rauschen, Bandpass (zwei Pol-Paare) mit gleitender Mittenfrequenz
function rauschen({ dauer, f0 = 2000, f1 = f0, q = 1.2, angriff = 0.001, abkling = 0.05, pegel = 0.3 }) {
  const b = puffer(dauer);
  let y1 = 0, y2 = 0, x1 = 0, x2 = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const fc = f0 * (f1 / f0) ** (t / dauer);
    const w = (2 * Math.PI * fc) / SR, al = Math.sin(w) / (2 * q);
    const b0 = al, a0 = 1 + al, a1 = -2 * Math.cos(w), a2 = 1 - al;
    const x = zufall() * 2 - 1;
    const y = (b0 * x - b0 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    b[i] = y * (t < angriff ? t / angriff : 1) * Math.exp(-t / abkling) * pegel;
  }
  return ausblenden(b, 4);
}
const klick = (dauer = 0.006, pegel = 0.4, f = 4000) => rauschen({ dauer, f0: f, q: 0.9, abkling: dauer / 3, pegel });
// tiefer Rumms: Sinus mit fallender Tonhoehe
const rumms = (von = 150, bis = 52, dauer = 0.18, pegel = 0.8) => ton({ f: (t) => bis + (von - bis) * Math.exp(-t / 0.03), dauer, abkling: dauer / 3, pegel, angriff: 0.001 });
// Funkeln: viele kurze hohe Glaspunkte
function funkeln(dauer = 0.4, dichte = 26, pegel = 0.12, hoch = 1) {
  const b = puffer(dauer + 0.12);
  for (let k = 0; k < dichte; k++) {
    const ab = zufall() * dauer;
    const note = [N.C7, N.D7, N.E7, N.G7][Math.floor(zufall() * 4)] + (hoch > 1 ? 0 : -12 * (zufall() < 0.3 ? 1 : 0));
    mische(b, ton({ f: hz(note) * (0.995 + zufall() * 0.01), dauer: 0.1, abkling: 0.03, pegel: pegel * (0.5 + zufall() * 0.5), angriff: 0.0008 }), ab);
  }
  return b;
}

// Hall (Freeverb-Art): vier Kammfilter mit Daempfung, zwei Allpaesse; rechts leicht versetzt fuer Breite
function hall(x, { anteil = 0.22, raum = 0.78, daempf = 0.3, lang = 0.6 } = {}) {
  const aus = [new Float32Array(x.length + Math.round(lang * SR)), new Float32Array(x.length + Math.round(lang * SR))];
  for (const [k, versatz] of [[0, 0], [1, 23]]) {
    const kamm = [1116, 1188, 1277, 1356].map((d) => ({ d: d + versatz, buf: new Float32Array(d + versatz), i: 0, f: 0 }));
    const allp = [556, 441].map((d) => ({ d: d + versatz, buf: new Float32Array(d + versatz), i: 0 }));
    for (let n = 0; n < aus[k].length; n++) {
      const ein = n < x.length ? x[n] * 0.015 : 0;
      let s = 0;
      for (const c of kamm) {
        const y = c.buf[c.i];
        c.f = y * (1 - daempf) + c.f * daempf;
        c.buf[c.i] = ein + c.f * raum;
        c.i = (c.i + 1) % c.d;
        s += y;
      }
      for (const a of allp) { const y = a.buf[a.i]; a.buf[a.i] = s + y * 0.5; a.i = (a.i + 1) % a.d; s = y - s; }
      aus[k][n] = (n < x.length ? x[n] : 0) + s * anteil * 18;
    }
  }
  return aus;
}

// Stereo, Schluss abschneiden (unter -60 dB), sanft ausblenden, Spitze auf -1,5 dBFS (Echtspitze bleibt unter -1)
function fertig(mono, { hallArt = {}, pegel = 1 } = {}) {
  let [l, r] = hall(ausblenden(mono, 30), hallArt);
  let max = 0;
  for (let i = 0; i < l.length; i++) max = Math.max(max, Math.abs(l[i]), Math.abs(r[i]));
  let ende = l.length;
  while (ende > 1 && Math.abs(l[ende - 1]) < max * 0.003 && Math.abs(r[ende - 1]) < max * 0.003) ende--;
  ende = Math.min(l.length, ende + Math.round(0.01 * SR));
  l = l.slice(0, ende); r = r.slice(0, ende);
  const aus = Math.min(Math.round(0.04 * SR), ende);
  for (let i = 0; i < aus; i++) { const g = i / aus; l[ende - 1 - i] *= g; r[ende - 1 - i] *= g; }
  const ziel = 10 ** (-1.5 / 20) * pegel;
  const g = max > 0 ? ziel / max : 1;
  for (let i = 0; i < ende; i++) { l[i] *= g; r[i] *= g; }
  return [l, r];
}

function wav([l, r]) {
  const n = l.length, b = Buffer.alloc(44 + n * 4);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32);
  b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(l[i] * 32767))), 44 + i * 4);
    b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(r[i] * 32767))), 46 + i * 4);
  }
  return b;
}

// ---------- Die 40 Klaenge ----------
const leer = (s) => puffer(s);
const folge = (noten, abstand, mach) => { const b = leer(abstand * noten.length + 2.0); noten.forEach((no, i) => mische(b, mach(no, i), i * abstand)); return b; };
const KLEIN = { anteil: 0.08, lang: 0.25 };
const MITTEL = { anteil: 0.18, lang: 0.6 };
const GROSS = { anteil: 0.26, raum: 0.82, lang: 1.0 };

// Zug: Pop in drei leicht verschiedenen Tonhoehen (Abwechslung, ohne dass es klimpert)
const zug = (note) => { const b = pop(note, { dauer: 0.11, pegel: 0.6 }); return mische(b, rauschen({ dauer: 0.03, f0: 1800, q: 2, abkling: 0.008, pegel: 0.25 })); };
// Schlagen: Rumms plus Knacken plus Pop, deutlich saftiger als ein Zug
function schlagen(note) {
  const b = leer(0.3);
  mische(b, rumms(160, 55, 0.2, 0.7));
  mische(b, rauschen({ dauer: 0.06, f0: 3200, f1: 1400, q: 1.4, abkling: 0.014, pegel: 0.55 }));
  mische(b, pop(note, { dauer: 0.16, pegel: 0.5, sturz: 2.8 }), 0.004);
  return b;
}
const SAETZE = {
  zug: [() => zug(N.E6), KLEIN],
  'zug-2': [() => zug(N.D6), KLEIN],
  'zug-3': [() => zug(N.G6), KLEIN],
  schlagen: [() => schlagen(N.C6), KLEIN],
  'schlagen-2': [() => schlagen(N.D6), KLEIN],
  rochade: [() => { const b = leer(0.4); mische(b, zug(N.G5)); mische(b, zug(N.C6), 0.085); return b; }, KLEIN],
  schach: [() => { const b = leer(0.6); mische(b, glocke(N.B5, 0.5, 0.5, 0.18)); mische(b, glocke(N.E6, 0.5, 0.55, 0.2), 0.09); mische(b, klick(0.01, 0.4, 3000)); return b; }, MITTEL],
  umwandlung: [() => { const b = folge([N.C6, N.E6, N.G6, N.C7], 0.065, (n) => glocke(n, 0.7, 0.45, 0.25)); return mische(b, funkeln(0.5, 22, 0.1), 0.2); }, GROSS],
  start: [() => { const b = leer(1.3); mische(b, rauschen({ dauer: 0.35, f0: 350, f1: 4500, q: 1.1, angriff: 0.25, abkling: 0.5, pegel: 0.35 }));
    for (const n of [N.C5, N.E5, N.G5, N.C6]) mische(b, glocke(n, 0.9, 0.22, 0.4), 0.3); return b; }, GROSS],
  // Bewertung: Brillant am lautesten (Funkelregen und Tiefe), Patzer am leisesten
  brillant: [() => { const b = folge([N.C6, N.E6, N.G6, N.C7, N.E7], 0.05, (n) => glocke(n, 0.9, 0.5, 0.35));
    mische(b, rumms(120, 48, 0.4, 0.55)); return mische(b, funkeln(0.6, 36, 0.14, 2), 0.18); }, { ...GROSS, pegel: 1 }],
  bester: [() => { const b = leer(0.8); mische(b, glocke(N.G6, 0.6, 0.5, 0.28)); return mische(b, glocke(N.C7, 0.7, 0.55, 0.32), 0.08); }, { ...MITTEL, pegel: 0.9 }],
  gut: [() => glocke(N.E6, 0.5, 0.5, 0.22), { ...MITTEL, pegel: 0.75 }],
  ungenau: [() => ton({ f: (t) => hz(N.A5) * (1 - 0.06 * t / 0.2), dauer: 0.22, abkling: 0.06, pegel: 0.4, teile: [[1, 1, 1], [3, 0.08, 2]] }), { ...KLEIN, pegel: 0.6 }],
  fehler: [() => { const b = leer(0.5); mische(b, ton({ f: hz(N.E5), dauer: 0.25, abkling: 0.08, pegel: 0.4, teile: [[1, 1, 1], [3, 0.15, 2]] }));
    return mische(b, ton({ f: hz(N.C5), dauer: 0.3, abkling: 0.1, pegel: 0.4, teile: [[1, 1, 1], [3, 0.15, 2]] }), 0.11); }, { ...KLEIN, pegel: 0.55 }],
  patzer: [() => ton({ f: (t) => 210 - 70 * Math.min(1, t / 0.25), dauer: 0.32, abkling: 0.1, pegel: 0.5, teile: [[1, 1, 1], [2, 0.2, 1.5]] }), { ...KLEIN, pegel: 0.42 }],
  // Steigerung: Combo und Stern steigen im Ton
  combo: [() => { const b = pop(N.E6, { dauer: 0.12 }); return mische(b, glocke(N.E7, 0.35, 0.3, 0.12), 0.03); }, MITTEL],
  'combo-2': [() => { const b = pop(N.G6, { dauer: 0.12 }); mische(b, glocke(N.G7, 0.35, 0.3, 0.12), 0.03); return mische(b, funkeln(0.15, 6, 0.08), 0.05); }, MITTEL],
  'combo-3': [() => { const b = folge([N.C7, N.E7, N.G7], 0.04, (n) => glocke(n, 0.4, 0.32, 0.14)); mische(b, pop(N.C7, { dauer: 0.1 })); return mische(b, funkeln(0.3, 14, 0.1), 0.06); }, MITTEL],
  stern: [() => { const b = leer(0.8); mische(b, glocke(N.E6, 0.4, 0.45, 0.15)); return mische(b, glocke(N.A6, 0.6, 0.5, 0.25), 0.07); }, MITTEL],
  'stern-2': [() => { const b = leer(0.8); mische(b, glocke(N.G6, 0.4, 0.45, 0.15)); return mische(b, glocke(N.C7, 0.6, 0.5, 0.25), 0.07); }, MITTEL],
  'stern-3': [() => { const b = leer(1.0); mische(b, glocke(N.A6, 0.4, 0.45, 0.15)); mische(b, glocke(N.E7, 0.7, 0.55, 0.3), 0.07); return mische(b, funkeln(0.4, 18, 0.1, 2), 0.1); }, GROSS],
  sieg: [() => { const b = folge([N.C5, N.E5, N.G5, N.C6], 0.09, (n) => glocke(n, 0.8, 0.4, 0.3));
    for (const n of [N.C6, N.E6, N.G6]) mische(b, glocke(n, 1.4, 0.3, 0.6), 0.36);
    mische(b, rumms(110, 45, 0.5, 0.5), 0.36); return mische(b, funkeln(0.7, 30, 0.1, 2), 0.4); }, GROSS],
  niederlage: [() => folge([N.A4, N.F4, N.D4], 0.18, (n) => ton({ f: hz(n), dauer: 0.7, abkling: 0.28, pegel: 0.35, teile: [[1, 1, 1], [2, 0.25, 1.6], [3, 0.08, 2.5]] })), { ...MITTEL, pegel: 0.6 }],
  remis: [() => { const b = leer(1.0); mische(b, glocke(N.G5, 0.8, 0.4, 0.35)); return mische(b, glocke(N.D6, 0.8, 0.4, 0.35), 0.16); }, { ...MITTEL, pegel: 0.75 }],
  // Uhr und Raetsel
  'uhr-warnung': [() => { const b = leer(0.35); mische(b, zug(N.A6)); return mische(b, zug(N.E6), 0.16); }, KLEIN],
  'raetsel-richtig': [() => { const b = leer(0.9); mische(b, glocke(N.C6, 0.6, 0.4, 0.25)); mische(b, glocke(N.G6, 0.6, 0.4, 0.25)); mische(b, glocke(N.C7, 0.7, 0.5, 0.3), 0.09);
    return mische(b, funkeln(0.3, 14, 0.09), 0.1); }, MITTEL],
  'raetsel-falsch': [() => ton({ f: 180, dauer: 0.26, abkling: 0.09, pegel: 0.35, teile: [[1, 1, 1], [3, 0.3, 1.5], [5, 0.15, 2]] }), { ...KLEIN, pegel: 0.5 }],
  // Bedienung: winzig und trocken
  klick: [() => pop(N.C7, { dauer: 0.05, pegel: 0.4, sturz: 1.6, abkling: 0.015 }), { anteil: 0.03, lang: 0.1, pegel: 0.45 }],
  zurueck: [() => ton({ f: (t) => hz(N.G6) * (1 - 0.3 * Math.min(1, t / 0.06)), dauer: 0.08, abkling: 0.025, pegel: 0.4 }), { anteil: 0.03, lang: 0.1, pegel: 0.45 }],
  schalter: [() => { const b = leer(0.12); mische(b, pop(N.E7, { dauer: 0.04, pegel: 0.35, abkling: 0.012 })); return mische(b, pop(N.A6, { dauer: 0.05, pegel: 0.35, abkling: 0.014 }), 0.045); }, { anteil: 0.03, lang: 0.1, pegel: 0.45 }],
  wechsel: [() => { const b = leer(0.2); mische(b, rauschen({ dauer: 0.12, f0: 1200, f1: 5000, q: 1.2, angriff: 0.04, abkling: 0.06, pegel: 0.25 })); return mische(b, pop(N.G6, { dauer: 0.07, pegel: 0.35 }), 0.06); }, { anteil: 0.05, lang: 0.15, pegel: 0.5 }],
  // Finisher (hoechstens 1,6 bzw. 1,8 s)
  'finisher-tinte': [() => { const b = leer(1.2); mische(b, ton({ f: (t) => 260 + 1100 * Math.min(1, t / 0.09), dauer: 0.22, abkling: 0.08, pegel: 0.5 }));
    mische(b, glocke(N.G6, 0.6, 0.3, 0.25), 0.1); return mische(b, ton({ f: (t) => 500 + 900 * Math.min(1, t / 0.07), dauer: 0.15, abkling: 0.05, pegel: 0.25 }), 0.32); }, GROSS],
  'finisher-kreide': [() => { const b = leer(0.9); mische(b, rauschen({ dauer: 0.5, f0: 2600, f1: 4200, q: 3, angriff: 0.03, abkling: 0.4, pegel: 0.4 }));
    return mische(b, glocke(N.C7, 0.5, 0.25, 0.2), 0.45); }, MITTEL],
  'finisher-glocke': [() => { const b = leer(1.5); mische(b, ton({ f: hz(N.C5), dauer: 1.4, abkling: 0.7, pegel: 0.4, teile: [[1, 1, 1], [2.01, 0.6, 1.4], [2.76, 0.45, 1.8], [5.4, 0.25, 3], [8.93, 0.12, 4]] }));
    return mische(b, funkeln(0.6, 20, 0.08), 0.15); }, { ...GROSS, lang: 0.4 }],
  // Feier und Fortschritt
  treffer: [() => { const b = leer(0.35); mische(b, rumms(180, 60, 0.25, 0.8)); return mische(b, rauschen({ dauer: 0.08, f0: 2500, f1: 900, q: 1.2, abkling: 0.02, pegel: 0.5 })); }, { ...KLEIN, lang: 0.1 }],
  level: [() => { const b = leer(1.15); mische(b, rauschen({ dauer: 0.25, f0: 500, f1: 6000, q: 1.2, angriff: 0.2, abkling: 0.3, pegel: 0.25 }));
    folge([N.C6, N.E6, N.G6, N.C7], 0.05, (n) => glocke(n, 0.6, 0.4, 0.25)).forEach((v, i) => { const o = i + Math.round(0.2 * SR); if (o < b.length) b[o] += v; });
    return mische(b, funkeln(0.4, 20, 0.1, 2), 0.3); }, { ...GROSS, lang: 0.5 }],
  rekord: [() => { const b = leer(0.95); folge([N.G5, N.C6, N.E6, N.G6], 0.06, (n) => glocke(n, 0.6, 0.4, 0.25)).forEach((v, i) => { if (i < b.length) b[i] += v; });
    return mische(b, funkeln(0.3, 14, 0.09), 0.2); }, { ...MITTEL, lang: 0.4 }],
  siegel: [() => { const b = leer(1.1); mische(b, rumms(140, 50, 0.22, 0.8)); mische(b, rauschen({ dauer: 0.05, f0: 1800, q: 1, abkling: 0.015, pegel: 0.4 }));
    for (const n of [N.C6, N.G6, N.E7]) mische(b, glocke(n, 0.8, 0.3, 0.3), 0.08); return b; }, { ...GROSS, lang: 0.4 }],
  bauer: [() => { const b = leer(0.45); mische(b, pop(N.G6, { dauer: 0.1 })); return mische(b, glocke(N.D7, 0.35, 0.3, 0.12), 0.05); }, { ...KLEIN, lang: 0.15 }],
  // Feier-Zeile: ein heller Punkt, die App hebt ihn je Zeile an (playbackRate)
  feier: [() => glocke(N.C7, 0.13, 0.5, 0.05), { anteil: 0.02, lang: 0.02 }],
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(ZIEL, { recursive: true });
  const tmp = mkdtempSync(join(tmpdir(), 'juwel-'));
  let summe = 0;
  for (const [name, [mach, art]] of Object.entries(SAETZE)) {
    const { pegel = 1, ...hallArt } = art || {};
    const w = join(tmp, name + '.wav');
    writeFileSync(w, wav(fertig(mach(), { hallArt, pegel })));
    const aus = join(ZIEL, name + '.mp3');
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', w, '-codec:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', '-ac', '2', aus]);
    summe++;
  }
  rmSync(tmp, { recursive: true, force: true });
  console.log(`${summe} Klaenge geschrieben: assets/klang/juwel/`);
}
export { SAETZE };
