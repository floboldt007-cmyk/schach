// Klangsets "Polarlicht" und "Donner" (Feinschliff R19, Flo 15.11.2026: "mehr Klaenge, das Gesperrte krasser"). Eigene
// Synthese in JavaScript wie Juwel (werkzeuge/klang-juwel.mjs, dessen Bausteine und 40 Klaenge hier die Grundlage sind),
// keine Aufnahme und kein Sample von irgendwoher. Darum eigene Werke von Flo (assets/klang/LIZENZEN.md).
//
// Polarlicht: alles eine Quinte hoeher, dazu ein leiser Oktav-Schimmer und ein weiter, heller Hall (Glas unter Nordlicht).
// Donner: alles eine Quarte tiefer, Brett-Klaenge mit einem tiefen Rumms darunter, dunkler, grosser Hall (Gewitter).
// Beide Sets sind Labor-Sets (js/labor.js): nur im Erfinder-Konto waehlbar, im Shop mit Schloss; sw.js laedt sie nicht
// vor, sie kommen erst bei Bedarf in den Cache.
//
//   node werkzeuge/klang-sets-r19.mjs     schreibt assets/klang/polarlicht/*.mp3 und assets/klang/donner/*.mp3 (ffmpeg, libmp3lame)
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { SAETZE, SR, mische, puffer, rumms, fertig, wav } from './klang-juwel.mjs';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');

// Tonhoehe aendern durch Neuabtasten (linear): faktor > 1 hoeher und kuerzer, < 1 tiefer und laenger
function umrate(b, faktor) {
  const n = Math.floor(b.length / faktor), aus = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i * faktor, k = Math.floor(x), t = x - k;
    aus[i] = (b[k] || 0) * (1 - t) + (b[k + 1] || 0) * t;
  }
  return aus;
}
const BRETT = new Set(['zug', 'zug-2', 'zug-3', 'schlagen', 'schlagen-2', 'rochade', 'treffer', 'siegel']);

const SETS = {
  polarlicht: (name, mono, art) => {
    const b = umrate(mono, 1.5);
    const schimmer = umrate(mono, 3);
    const raus = puffer(b.length / SR + 0.05);
    mische(raus, b);
    mische(raus, schimmer, 0.012, 0.22);
    return [raus, { ...art, anteil: Math.min(0.32, (art.anteil || 0.1) * 1.5), raum: 0.86, daempf: 0.18, lang: Math.max(0.3, (art.lang || 0.3) * 1.2) }];
  },
  donner: (name, mono, art) => {
    const b = umrate(mono, 0.75);
    const raus = puffer(b.length / SR + 0.1);
    mische(raus, b);
    if (BRETT.has(name)) mische(raus, rumms(110, 38, 0.24, name.startsWith('zug') ? 0.45 : 0.8));
    return [raus, { ...art, anteil: Math.min(0.3, (art.anteil || 0.1) * 1.3), raum: 0.84, daempf: 0.55, lang: Math.min(0.9, (art.lang || 0.3) * 1.1) }];
  },
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const [set, mach] of Object.entries(SETS)) {
    const ziel = join(WURZEL, 'assets/klang', set);
    mkdirSync(ziel, { recursive: true });
    const tmp = mkdtempSync(join(tmpdir(), set + '-'));
    let summe = 0;
    for (const [name, [quelle, artRoh]] of Object.entries(SAETZE)) {
      const { pegel = 1, ...art } = artRoh || {};
      const [mono, hallArt] = mach(name, quelle(), art);
      const w = join(tmp, name + '.wav');
      writeFileSync(w, wav(fertig(mono, { hallArt, pegel })));
      execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', w, '-codec:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', '-ac', '2', join(ziel, name + '.mp3')]);
      summe++;
    }
    rmSync(tmp, { recursive: true, force: true });
    console.log(`${summe} Klaenge geschrieben: assets/klang/${set}/`);
  }
}
export { SETS };
