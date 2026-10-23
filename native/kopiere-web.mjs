// Kopiert die Web-App nach native/www, dem webDir von Capacitor (capacitor.config.json). Aufruf aus native/:
//   node kopiere-web.mjs            -> native/www
//   node kopiere-web.mjs <ordner>   -> anderer Zielordner (Tests)
// Kopiert werden die Ordner der App (css, js, assets, vendor, daten) und jede Datei aus der Liste DATEIEN in sw.js
// (dieselbe Liste, die der Service Worker offline vorhaelt). Danach wird geprueft, dass wirklich jede Datei dieser
// Liste im Ziel liegt; fehlt eine, bricht das Skript mit einer klaren Meldung ab. Nicht kopiert werden tests/, design/,
// supabase/ und native/ selbst. native/www ist per .gitignore ausgeschlossen.
import { readFileSync, rmSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
export const WURZEL = path.resolve(HIER, '..');
export const ORDNER = ['css', 'js', 'assets', 'vendor', 'daten'];
export const EINZELN = ['index.html', 'manifest.webmanifest', 'sw.js', 'LICENSE'];

// Liste DATEIEN aus dem Text von sw.js
export function dateienAusSw(text) {
  const m = String(text).match(/const DATEIEN = \[([\s\S]*?)\];/);
  if (!m) throw new Error('In sw.js wurde die Liste DATEIEN nicht gefunden.');
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

export function kopiereWeb(ziel = path.join(HIER, 'www'), { wurzel = WURZEL } = {}) {
  const z = path.resolve(ziel);
  const w = path.resolve(wurzel);
  // Schutz: nie das Repo selbst oder einen Ordner darueber leeren
  if (z === w || w.startsWith(z + path.sep) || z === path.parse(z).root) {
    throw new Error(`Zielordner ${z} ist das Repo selbst oder liegt darueber; abgebrochen.`);
  }
  const liste = dateienAusSw(readFileSync(path.join(w, 'sw.js'), 'utf8'));
  const alle = [...new Set([...EINZELN, ...liste])];
  const fehltQuelle = alle.filter((d) => !existsSync(path.join(w, d)));
  if (fehltQuelle.length) throw new Error(`Diese Dateien aus sw.js gibt es im Repo nicht: ${fehltQuelle.join(', ')}`);
  rmSync(z, { recursive: true, force: true });
  mkdirSync(z, { recursive: true });
  for (const o of ORDNER) {
    if (existsSync(path.join(w, o))) cpSync(path.join(w, o), path.join(z, o), { recursive: true });
  }
  for (const d of alle) {
    mkdirSync(path.dirname(path.join(z, d)), { recursive: true });
    cpSync(path.join(w, d), path.join(z, d));
  }
  const fehlt = alle.filter((d) => !existsSync(path.join(z, d)));
  if (fehlt.length) throw new Error(`Nach dem Kopieren fehlen in ${z}: ${fehlt.join(', ')}`);
  return { ziel: z, dateien: alle.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const r = kopiereWeb(process.argv[2] ? path.resolve(process.argv[2]) : undefined);
    console.log(`Web-App nach ${r.ziel} kopiert (${r.dateien} Dateien aus sw.js geprueft).`);
  } catch (e) {
    console.error('FEHLER: ' + e.message);
    process.exit(1);
  }
}
