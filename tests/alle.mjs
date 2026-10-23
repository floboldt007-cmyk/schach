// Startet alle Testsuiten der Schach-Arena nacheinander und gibt am Ende eine Zusammenfassung aus.
//
//   node tests/alle.mjs              alles (wie vor einer Veroeffentlichung)
//   node tests/alle.mjs --schnell    kurze Fassung: ohne Viewport-Runden, Bilder und Browser-Teil von review
//   node tests/alle.mjs --nur=sw,e2e nur diese Suiten (Namen siehe Liste unten)
//   node tests/alle.mjs --laut       Ausgabe jeder Suite vollstaendig zeigen
//
// Jede Suite startet ihren eigenen Server auf ihrem eigenen Port und beendet ihn wieder.
// Exitcode 0 nur, wenn alle Suiten bestehen.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHNELL = process.argv.includes('--schnell');
const LAUT = process.argv.includes('--laut');
const nurArg = process.argv.find((a) => a.startsWith('--nur='));
const NUR = nurArg ? nurArg.slice(6).split(',').map((s) => s.trim()).filter(Boolean) : null;

const SUITEN = [
  { name: 'konto', datei: 'konto.test.mjs', args: [], was: 'Konto, Anmeldung und Cloud-Spielstand' },
  { name: 'storage', datei: 'storage.test.mjs', args: [], was: 'Speicher, Sterne, Freischaltung' },
  { name: 'sicherung', datei: 'sicherung.test.mjs', args: [], was: 'Export, Import und Sicherungshinweis' },
  { name: 'review', datei: 'review.test.mjs', args: SCHNELL ? ['--nur-node'] : [], was: 'Zug-Klassen, Genauigkeit, Coach' },
  { name: 'ereignisse', datei: 'ereignisse.test.mjs', args: [], was: 'Ereignis-Bus, Anzeige-Orte, Feier-Budget' },
  { name: 'fairness', datei: 'fairness.test.mjs', args: [], was: 'Fairness-Regeln (Runde 4)' },
  { name: 'spiel', datei: 'spiel.test.mjs', args: [], was: 'Spiel-Fundament: Tag, Inhalte, Spielplan, Bot-Register' },
  { name: 'engine-bots', datei: 'engine-bots.test.mjs', args: ['--schnell'], was: 'Stockfish-Wrapper und Bots' },
  { name: 'board', datei: 'board.test.mjs', args: [], was: 'Brett: Tippen, Ziehen, Effekte' },
  { name: 'sw', datei: 'sw.test.mjs', args: [], was: 'Cache-Liste, Manifest, Icons' },
  { name: 'thema', datei: 'thema.test.mjs', args: [], was: 'Theme-Fundament: Tokens, hell/dunkel, Schriften, Lesbarkeit' },
  { name: 'klang', datei: 'klang.test.mjs', args: [], was: 'Klangpakete: Katalog, Dateien, Pegel, Abspielen' },
  { name: 'navigation', datei: 'navigation.test.mjs', args: [], was: 'Reiter-Leiste, Kopf, Bauteile, Training-Hülle' },
  { name: 'teilen', datei: 'teilen.test.mjs', args: [], was: 'Paket teilen: Siegesbild (Welle A1)' },
  { name: 'gedaechtnis', datei: 'gedaechtnis.test.mjs', args: [], was: 'Paket gedaechtnis: Bots erinnern sich, Revanche, Erzfeind (Welle A2)' },
  { name: 'app', datei: 'app.test.mjs', args: SCHNELL ? ['--schnell'] : [], was: 'Arena, Partie, Ergebnis' },
  { name: 'screens', datei: 'screens.test.mjs', args: SCHNELL ? ['--ohne-bilder'] : [], was: 'Analyse, Verlauf, Einstellungen' },
  { name: 'e2e', datei: 'e2e.test.mjs', args: SCHNELL ? ['--ohne-bilder'] : [], was: 'Ganzer Ablauf, offline, Update' },
];

function lauf(suite) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    // eine fehlende Suite-Datei ist ein Fehler, nie ein stilles Ueberspringen
    if (!existsSync(path.join(WURZEL, 'tests', suite.datei))) {
      resolve({ ...suite, code: 1, sekunden: 0, ok: null, gesamt: null, fehler: [`FEHLER Suite-Datei fehlt: tests/${suite.datei}`], ende: [] });
      return;
    }
    const kind = spawn(process.execPath, [path.join(WURZEL, 'tests', suite.datei), ...suite.args], {
      cwd: WURZEL, env: process.env, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let text = '';
    const nimm = (d) => {
      const s = d.toString();
      text += s;
      if (LAUT) process.stdout.write(s);
    };
    kind.stdout.on('data', nimm);
    kind.stderr.on('data', nimm);
    kind.on('close', (code) => {
      const zeilen = text.split(/\r?\n/);
      // "123/124 bestanden" (letzte Zahl dieser Art in der Ausgabe)
      const zahl = zeilen.map((z) => z.match(/(\d+)\s*\/\s*(\d+)\s+bestanden/)).filter(Boolean).pop();
      const fehler = zeilen.filter((z) => /^FEHLER/.test(z.trim()));
      resolve({ ...suite, code, sekunden: (Date.now() - t0) / 1000, ok: zahl ? +zahl[1] : null, gesamt: zahl ? +zahl[2] : null, fehler, ende: zeilen.slice(-15) });
    });
  });
}

const auswahl = NUR ? SUITEN.filter((s) => NUR.includes(s.name)) : SUITEN;
if (!auswahl.length) {
  console.log('Keine passende Suite. Namen: ' + SUITEN.map((s) => s.name).join(', '));
  process.exit(2);
}
console.log(`Crownmate: ${auswahl.length} Testsuiten${SCHNELL ? ' (schnell)' : ''}\n`);
const t0 = Date.now();
const ergebnisse = [];
for (const s of auswahl) {
  process.stdout.write(`… ${s.name.padEnd(12)} ${s.was}\n`);
  const e = await lauf(s);
  ergebnisse.push(e);
  const status = e.code === 0 ? 'ok    ' : 'FEHLER';
  const zahl = e.gesamt != null ? `${e.ok}/${e.gesamt}` : '-';
  console.log(`${status} ${s.name.padEnd(12)} ${zahl.padStart(9)}  ${e.sekunden.toFixed(1).padStart(6)} s`);
  if (e.code !== 0 && !LAUT) {
    const zeigen = e.fehler.length ? e.fehler.slice(0, 20) : e.ende;
    for (const z of zeigen) console.log('       ' + z);
  }
}

const schlecht = ergebnisse.filter((e) => e.code !== 0);
const summeOk = ergebnisse.reduce((a, e) => a + (e.ok || 0), 0);
const summe = ergebnisse.reduce((a, e) => a + (e.gesamt || 0), 0);
console.log('\nZusammenfassung');
console.log('Suite         Prüfungen    Zeit   Ergebnis');
for (const e of ergebnisse) {
  const zahl = e.gesamt != null ? `${e.ok}/${e.gesamt}` : '-';
  console.log(`${e.name.padEnd(12)} ${zahl.padStart(10)} ${(e.sekunden.toFixed(0) + ' s').padStart(7)}   ${e.code === 0 ? 'bestanden' : 'FEHLGESCHLAGEN'}`);
}
console.log(`\n${ergebnisse.length - schlecht.length}/${ergebnisse.length} Suiten bestanden, ${summeOk}/${summe} Prüfungen, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exit(schlecht.length ? 1 : 0);
