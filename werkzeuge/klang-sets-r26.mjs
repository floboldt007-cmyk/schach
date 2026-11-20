// Klangset "Seide" (Feinschliff R26, AC-08, Flo 20.11.2026: "Ein paar neue Klaenge, satisfying und clean"). Eigene
// Synthese in JavaScript wie Juwel (werkzeuge/klang-juwel.mjs, dessen Bausteine hier die Grundlage sind), keine Aufnahme
// und kein Sample von irgendwoher. Darum eigene Werke von Flo (assets/klang/LIZENZEN.md).
//
// Seide: weich, warm und trocken. Die Brett-Klaenge (Zug, Schlagen, Rochade), Schach und Sieg sind neu gebaut: ein runder
// Holz-Tock mit kurzem, gedaempftem Anschlag, beim Schlagen tiefer mit kleinem Rumms, Schach als zwei Marimba-Toene, Sieg
// als warmer Dreiklang. Alle anderen Klaenge kommen aus Juwel, eine kleine Terz tiefer, mit Tiefpass und weniger Hall.
// Seide ist ein Labor-Set (js/labor.js): nur im Erfinder-Konto waehlbar, im Shop nicht ausgelegt; sw.js laedt es nicht
// vor, es kommt erst bei Bedarf in den Cache.
//
//   node werkzeuge/klang-sets-r26.mjs     schreibt assets/klang/seide/*.mp3 (ffmpeg, libmp3lame)
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { SAETZE, SR, N, mische, puffer, ton, rumms, rauschen, funkeln, fertig, wav } from './klang-juwel.mjs';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const hz = (note) => 440 * 2 ** ((note - 69) / 12);

// Tonhoehe aendern durch Neuabtasten (linear), wie klang-sets-r19.mjs
function umrate(b, faktor) {
  const n = Math.floor(b.length / faktor), aus = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i * faktor, k = Math.floor(x), t = x - k;
    aus[i] = (b[k] || 0) * (1 - t) + (b[k + 1] || 0) * t;
  }
  return aus;
}
// einpoliger Tiefpass (nimmt die Schaerfe aus Klick und Glas)
function tiefpass(b, grenze) {
  const a = 1 - Math.exp((-2 * Math.PI * grenze) / SR);
  let y = 0;
  for (let i = 0; i < b.length; i++) { y += a * (b[i] - y); b[i] = y; }
  return b;
}
// Marimba-artig: Grundton plus der typische vierfache Oberton, kurz
const MARIMBA = [[1, 1, 1], [4, 0.22, 3.2], [10, 0.04, 6]];
const holz = (note, dauer, pegel, abkling) => ton({ f: hz(note), dauer, abkling, pegel, angriff: 0.002, teile: MARIMBA });

// Zug: runder Tock (Ton mit leichtem Einrasten von oben) und ein gedaempftes Wischen
function zug(note) {
  const f0 = hz(note);
  const b = puffer(0.16);
  mische(b, ton({ f: (t) => f0 * (1 + 0.35 * Math.exp(-t / 0.006)), dauer: 0.14, abkling: 0.032, pegel: 0.7, teile: [[1, 1, 1], [2.4, 0.22, 2.2], [4.1, 0.06, 3]] }));
  mische(b, rauschen({ dauer: 0.025, f0: 1400, q: 1.6, abkling: 0.006, pegel: 0.22 }));
  return tiefpass(b, 3800);
}
// Schlagen: tiefer Tock, kleiner Rumms darunter, kurzes Knacken
function schlagen(note) {
  const b = puffer(0.3);
  mische(b, rumms(140, 62, 0.18, 0.55));
  mische(b, rauschen({ dauer: 0.05, f0: 2400, f1: 900, q: 1.3, abkling: 0.012, pegel: 0.4 }));
  mische(b, zug(note), 0.003);
  return tiefpass(b, 3200);
}
const KLEIN = { anteil: 0.05, raum: 0.7, daempf: 0.5, lang: 0.2 };
const MITTEL = { anteil: 0.12, raum: 0.74, daempf: 0.5, lang: 0.5 };
const GROSS = { anteil: 0.18, raum: 0.8, daempf: 0.45, lang: 0.9 };

const NEU = {
  zug: [() => zug(N.E4), KLEIN],
  'zug-2': [() => zug(N.D4), KLEIN],
  'zug-3': [() => zug(N.G4), KLEIN],
  schlagen: [() => schlagen(N.C4), KLEIN],
  'schlagen-2': [() => schlagen(N.D4), KLEIN],
  rochade: [() => { const b = puffer(0.32); mische(b, zug(N.G4)); mische(b, zug(N.C5), 0.09); return b; }, KLEIN],
  schach: [() => { const b = puffer(0.7); mische(b, holz(N.A5, 0.6, 0.55, 0.22)); mische(b, holz(N.E6, 0.65, 0.5, 0.26), 0.11); return tiefpass(b, 6000); }, MITTEL],
  sieg: [() => {
    const b = puffer(2.4);
    [N.C5, N.E5, N.G5].forEach((n, i) => mische(b, holz(n, 0.7, 0.45, 0.28), i * 0.1));
    for (const n of [N.C5, N.E5, N.G5, N.C6]) mische(b, holz(n, 1.8, 0.32, 0.7), 0.34);
    mische(b, rumms(100, 48, 0.5, 0.35), 0.34);
    mische(b, funkeln(0.6, 16, 0.05, 1), 0.42);
    return tiefpass(b, 5200);
  }, GROSS],
};

// Seide-Fassung eines Juwel-Klangs: kleine Terz tiefer, Tiefpass, weniger Hall
function aus_juwel(mono, art) {
  const b = tiefpass(umrate(mono, 0.84), 4200);
  return [b, { ...art, anteil: (art.anteil || 0.1) * 0.65, daempf: 0.5, lang: Math.min(0.8, art.lang || 0.3) }];
}

// Pegel in dB je Klang: MP3 schiesst nach dem Kodieren ueber die -1,5 dBFS aus fertig() hinaus (Juwel bis +1 dBFS),
// darum alles etwas leiser; Schach so, dass es so laut wirkt wie Holz, Arcade und Juwel im Mittel (tests/r26-effekte.test.mjs)
const DB = { schach: -7, zug: -3.5, 'zug-2': -3.5, 'zug-3': -3.5 };
const pegelVon = (name) => 10 ** ((DB[name] ?? -3) / 20);

function seide(name, mono, art) {
  if (Object.hasOwn(NEU, name)) {
    const [mach, hallArt] = NEU[name];
    return [mach(), hallArt];
  }
  return aus_juwel(mono, art);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const ziel = join(WURZEL, 'assets/klang/seide');
  mkdirSync(ziel, { recursive: true });
  const tmp = mkdtempSync(join(tmpdir(), 'seide-'));
  let summe = 0;
  for (const [name, [quelle, artRoh]] of Object.entries(SAETZE)) {
    const { pegel = 1, ...art } = artRoh || {};
    const [mono, hallArt] = seide(name, quelle(), art);
    const w = join(tmp, name + '.wav');
    writeFileSync(w, wav(fertig(mono, { hallArt, pegel: pegel * pegelVon(name) })));
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', w, '-codec:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', '-ac', '2', join(ziel, name + '.mp3')]);
    summe++;
  }
  rmSync(tmp, { recursive: true, force: true });
  console.log(`${summe} Klaenge geschrieben: assets/klang/seide/`);
}
export { seide };
