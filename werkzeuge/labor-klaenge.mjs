// Labor-Klaenge (Flo 31.10.2026: "bei den Klaengen genau so ... ich kann die benutzen, die anderen nicht"): zwei
// Klangsets nur fuer das Erfinder-Konto, abgeleitet aus Flos eigenem Paket "Holz" (assets/klang/holz/) mit ffmpeg.
// Kein fremdes Material: nur Tonhoehe, Hall und Klangfarbe veraendert, darum gelten dieselben Rechte wie fuer Holz
// (assets/klang/LIZENZEN.md).
//
//   Grusel   (Halloween): drei Halbtoene tiefer, leises Zittern, hohler Nachhall
//   Kristall (Winter):    fuenf Halbtoene hoeher, Chor und funkelndes Echo
//
// Lautheit: je Datei auf die mittlere Lautheit des Originals gebracht, Spitze hoechstens -1,5 dB. Stille am Ende
// (nach dem Nachhall) wird abgeschnitten, damit die Dateien klein bleiben.
// Aufruf: node werkzeuge/labor-klaenge.mjs   (braucht ffmpeg mit libmp3lame)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const QUELLE = join(WURZEL, 'assets/klang/holz');

const ENDE = ',areverse,silenceremove=start_periods=1:start_threshold=-60dB,areverse';
export const SAETZE = {
  grusel: 'apad=pad_dur=0.3,asetrate=44100*0.8409,aresample=44100,vibrato=f=5.5:d=0.12,'
    + 'aecho=0.8:0.5:110|230:0.32|0.16,lowpass=f=6500' + ENDE,
  kristall: 'apad=pad_dur=0.25,asetrate=44100*1.3348,aresample=44100,chorus=0.6:0.9:45|60:0.35|0.28:0.25|0.4:2|2.6,'
    + 'aecho=0.8:0.45:55|120:0.22|0.1,highpass=f=180' + ENDE,
};

// Mittlere Lautheit und Spitze in dB (volumedetect schreibt nach stderr)
function messe(datei, filter = '') {
  const aus = execFileSync('sh', ['-c', 'ffmpeg -hide_banner -i "$1" -af "$2" -f null - 2>&1', 'sh', datei,
    (filter ? filter + ',' : '') + 'volumedetect'], { encoding: 'utf8' });
  return { mittel: Number((/mean_volume: (-?[\d.]+) dB/.exec(aus) || [])[1]), spitze: Number((/max_volume: (-?[\d.]+) dB/.exec(aus) || [])[1]) };
}

for (const [satz, filter] of Object.entries(SAETZE)) {
  const ziel = join(WURZEL, 'assets/klang', satz);
  mkdirSync(ziel, { recursive: true });
  for (const name of readdirSync(QUELLE).filter((d) => d.endsWith('.mp3')).sort()) {
    const ein = join(QUELLE, name);
    const alt = messe(ein);
    const neu = messe(ein, filter);
    const db = Math.min(alt.mittel - neu.mittel, -1.5 - neu.spitze);
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', ein, '-af', `${filter},volume=${db.toFixed(2)}dB`,
      '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', '-ac', '2', join(ziel, name)]);
  }
  console.log(`${satz}: fertig`);
}
