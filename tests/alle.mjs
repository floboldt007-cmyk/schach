// Startet alle Testsuiten der Schach-Arena nacheinander und gibt am Ende eine Zusammenfassung aus.
//
//   node tests/alle.mjs              alles (wie vor einer Veroeffentlichung)
//   node tests/alle.mjs --schnell    kurze Fassung: ohne Viewport-Runden, Bilder und Browser-Teil von review
//   node tests/alle.mjs --nur=sw,e2e nur diese Suiten (Namen siehe Liste unten)
//   node tests/alle.mjs --laut       Ausgabe jeder Suite vollstaendig zeigen
//
// Jede Suite startet ihren eigenen Server auf ihrem eigenen Port und beendet ihn wieder.
// Exitcode 0 nur, wenn alle Suiten bestehen.
import { prozess } from './zeitwaechter.mjs';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHNELL = process.argv.includes('--schnell');
const LAUT = process.argv.includes('--laut');
const nurArg = process.argv.find((a) => a.startsWith('--nur='));
const NUR = nurArg ? nurArg.slice(6).split(',').map((s) => s.trim()).filter(Boolean) : null;

const SUITEN = [
  { name: 'zeitwaechter', datei: 'zeitwaechter.test.mjs', args: [], was: 'Zeitgrenzen, Fehler und Prozess-Aufraeumen' },
  { name: 'konto', datei: 'konto.test.mjs', args: [], was: 'Konto, Anmeldung und Cloud-Spielstand' },
  { name: 'online', datei: 'online.test.mjs', args: [], was: 'Online gegen Freunde: Einladung, Zuege, Abfrage' },
  { name: 'online-ui', datei: 'online-ui.test.mjs', args: [], was: 'Online-Oberflaeche mit abgefangenen Server-Anfragen' },
  { name: 'server-online-zug', datei: 'server-online-zug.test.mjs', args: [], was: 'Online-Zuege: Edge Function prueft Regeln und Ende (Server, Anti-Cheat 1a)' },
  { name: 'zuzweit', datei: 'zuzweit.test.mjs', args: [], was: 'Zu zweit: Namen, Uhr, Ergebnis und neutrale Analyse' },
  { name: 'daten', datei: 'daten.test.mjs', args: [], was: 'Datenfreigabe, Datenauskunft, Konto löschen (DSGVO)' },
  { name: 'server-abo', datei: 'server-abo.test.mjs', args: [], was: 'Abo: Stripe-Webhook und Schema-Vertrag (Server)' },
  { name: 'abo', datei: 'abo.test.mjs', args: [], was: 'Abo „Crownmate Trainer“: Stand, Kauf, Blatt' },
  { name: 'server-coach', datei: 'server-coach.test.mjs', args: [], was: 'Frag den Coach: Edge Function, Prompt, Tageslimit (Server)' },
  { name: 'coach-ki', datei: 'coach-ki.test.mjs', args: [], was: 'Frag den Coach: Knopf und Antwort in der Analyse' },
  { name: 'server-schule', datei: 'server-schule.test.mjs', args: [], was: 'Schulmodus: Schema-Vertrag, Rechte, Grenzen (Server)' },
  { name: 'schule', datei: 'schule.test.mjs', args: [], was: 'Schulmodus: Lehrkraft-Ansicht, Beitreten, Heute-Karte, Melden' },
  { name: 'server-werkstatt', datei: 'server-werkstatt.test.mjs', args: [], was: 'Limitierte Editionen: Kasse, Webhook, Schema-Vertrag (Server, Testmodus)' },
  { name: 'storage', datei: 'storage.test.mjs', args: [], was: 'Speicher, Sterne, Freischaltung' },
  { name: 'liga', datei: 'liga.test.mjs', args: [], was: 'Arena-Wertung, Spielklassen, Saison und Vereinsmeisterschaft' },
  { name: 'sicherung', datei: 'sicherung.test.mjs', args: [], was: 'Export, Import und Sicherungshinweis' },
  { name: 'review', datei: 'review.test.mjs', args: SCHNELL ? ['--nur-node'] : [], was: 'Zug-Klassen, Genauigkeit, Coach' },
  { name: 'ereignisse', datei: 'ereignisse.test.mjs', args: [], was: 'Ereignis-Bus, Anzeige-Orte, Feier-Budget' },
  { name: 'fairness', datei: 'fairness.test.mjs', args: [], was: 'Fairness-Regeln (Runde 4)' },
  { name: 'spiel', datei: 'spiel.test.mjs', args: [], was: 'Spiel-Fundament: Tag, Inhalte, Spielplan, Bot-Register' },
  { name: 'engine-bots', datei: 'engine-bots.test.mjs', args: ['--schnell'], was: 'Stockfish-Wrapper und Bots' },
  { name: 'board', datei: 'board.test.mjs', args: [], was: 'Brett: Tippen, Ziehen, Effekte' },
  { name: 'vorzuege', datei: 'vorzuege.test.mjs', args: [], was: 'Vorzug-Kette mit Nummern, Pfeil-Tipp' },
  { name: 'sw', datei: 'sw.test.mjs', args: [], was: 'Cache-Liste, Manifest, Icons' },
  { name: 'thema', datei: 'thema.test.mjs', args: [], was: 'Theme-Fundament: Tokens, hell/dunkel, Schriften, Lesbarkeit' },
  { name: 'klang', datei: 'klang.test.mjs', args: [], was: 'Klangpakete: Katalog, Dateien, Pegel, Abspielen' },
  { name: 'navigation', datei: 'navigation.test.mjs', args: [], was: 'Reiter-Leiste, Kopf, Bauteile, Training-Hülle' },
  { name: 'arena', datei: 'arena.test.mjs', args: SCHNELL ? ['--ohne-bilder'] : [], was: 'Arena als Weltkarte, Detail-Panel, Duell-Intro, Porträts' },
  { name: 'funken', datei: 'funken.test.mjs', args: [], was: 'Paket Funken und Level: Rechnung, Speicher, Orte, Aufstieg' },
  { name: 'punkte', datei: 'punkte.test.mjs', args: SCHNELL ? ['--schnell'] : [], was: 'Paket Punkte und Bestenliste: Formel, Tafeln, Codes, Abrechnung' },
  { name: 'serie', datei: 'serie.test.mjs', args: [], was: 'Paket Serie: Bauernmarsch und Siegeslauf (Tageswerk, Meilensteine, Orte)' },
  { name: 'teilen', datei: 'teilen.test.mjs', args: [], was: 'Paket teilen: Siegesbild (Welle A1)' },
  { name: 'gedaechtnis', datei: 'gedaechtnis.test.mjs', args: [], was: 'Paket gedaechtnis: Bots erinnern sich, Revanche, Erzfeind (Welle A2)' },
  { name: 'emotes', datei: 'emotes.test.mjs', args: [], was: 'Paket Emotes: Rad, Schnell-Chat, Bot-Antwort und Barrierefreiheit' },
  { name: 'kartei', datei: 'kartei.test.mjs', args: SCHNELL ? ['--ohne-bilder'] : [], was: 'Paket kartei: Fehler-Kartei und Rätsel-Bildschirm (Welle A3)' },
  { name: 'sprache', datei: 'sprache.test.mjs', args: SCHNELL ? ['--ohne-bilder'] : [], was: 'Sprachen: Deutsch und Englisch (Kern-Screens)' },
  { name: 'sprache-pakete', datei: 'sprache.test.mjs', args: ['--pakete', ...(SCHNELL ? ['--ohne-bilder'] : [])], was: 'Sprachen: Englisch mit allen Paketen' },
  { name: 'tagesraetsel-daten', datei: 'tagesraetsel-daten.test.mjs', args: [], was: 'Tagesrätsel-Datei und Rätsel-Fabrik: legal, eindeutig, Wochenkurve, deterministisch' },
  { name: 'tagesraetsel', datei: 'tagesraetsel.test.mjs', args: SCHNELL ? ['--ohne-bilder'] : [], was: 'Paket tagesraetsel: Rätsel des Tages, Archiv, Ein Wort, Teilen (S1-5)' },
  { name: 'start', datei: 'start.test.mjs', args: SCHNELL ? ['--ohne-bilder'] : [], was: 'Paket start: Willkommen, Regel-Hilfe, Einstufung, Fahrplan (Welle A4)' },
  { name: 'app', datei: 'app.test.mjs', args: SCHNELL ? ['--schnell'] : [], was: 'Arena, Partie, Ergebnis' },
  { name: 'screens', datei: 'screens.test.mjs', args: SCHNELL ? ['--ohne-bilder'] : [], was: 'Analyse, Verlauf, Einstellungen' },
  { name: 'e2e', datei: 'e2e.test.mjs', args: SCHNELL ? ['--ohne-bilder'] : [], was: 'Ganzer Ablauf, offline, Update' },
  { name: 'notfall', datei: 'notfall.test.mjs', args: [], was: 'Notfall-Wächter: Reparieren, wenn die App nicht startet' },
  { name: 'bericht', datei: 'bericht.test.mjs', args: [], was: 'Tester-Bericht: Fehlerprotokoll (nur lokal), Bericht ansehen, kopieren, teilen' },
  { name: 'native', datei: 'native.test.mjs', args: [], was: 'App-Store-Huelle (Capacitor): Konfiguration, Kopie der Web-App' },
];

async function lauf(suite) {
  if (!existsSync(path.join(WURZEL, 'tests', suite.datei))) {
    return { ...suite, code: 1, sekunden: 0, ok: null, gesamt: null, fehler: [`FEHLER Suite-Datei fehlt: tests/${suite.datei}`], ende: [] };
  }
  let letzte = 'Start';
  const puls = setInterval(() => console.log(`… ${suite.name}: laeuft, zuletzt ${letzte}`), 30000);
  try {
    const e = await prozess(process.execPath, [path.join(WURZEL, 'tests', suite.datei), ...suite.args], {
      cwd: WURZEL,
      // 20 Minuten je Suite, nicht fuer die gesamte Sammlung (der volle Lauf braucht laenger).
      zeitlimitMs: 20 * 60 * 1000,
      ausgabe(s) {
        const zeilen = s.trim().split(/\r?\n/).filter(Boolean);
        if (zeilen.length) letzte = zeilen.at(-1).slice(0, 180);
        if (LAUT) process.stdout.write(s);
      },
    });
    const zeilen = e.text.split(/\r?\n/);
    const zahl = zeilen.map(z => z.match(/(\d+)\s*\/\s*(\d+)\s+bestanden/)).filter(Boolean).pop();
    const fehler = zeilen.filter(z => /^FEHLER/.test(z.trim()));
    if (e.zeitlimit) fehler.push(`FEHLER Suite ${suite.name} ueberschritt ihr Zeitlimit (20 Minuten)`);
    return { ...suite, code: e.code, sekunden: e.dauerMs / 1000, ok: zahl ? +zahl[1] : null,
      gesamt: zahl ? +zahl[2] : null, fehler, ende: zeilen.slice(-15) };
  } finally { clearInterval(puls); }
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
