// Startet alle Testsuiten der Schach-Arena nacheinander und gibt am Ende eine Zusammenfassung aus.
//
//   node tests/alle.mjs              alles (wie vor einer Veroeffentlichung)
//   node tests/alle.mjs --schnell    kurze Fassung: ohne Viewport-Runden, Bilder und Browser-Teil von review
//   node tests/alle.mjs --nur=sw,e2e nur diese Suiten (Namen siehe Liste unten)
//   node tests/alle.mjs --parallel=3  bis zu drei geeignete Suiten gleichzeitig
//   node tests/alle.mjs --teil=2/3    fester, nach gemessener Dauer verteilter Teil
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
const parallelArg = process.argv.find((a) => a.startsWith('--parallel='));
const PARALLEL = parallelArg ? Number(parallelArg.slice(11)) : 1;
const teilArg = process.argv.find((a) => a.startsWith('--teil='));
const TEIL = teilArg?.slice(7).match(/^(\d+)\/(\d+)$/)?.slice(1).map(Number) || null;

if (!Number.isInteger(PARALLEL) || PARALLEL < 1 || (teilArg && !TEIL)
    || (TEIL && (TEIL[0] < 1 || TEIL[1] < 1 || TEIL[0] > TEIL[1]))) {
  console.error('Ungueltige Option. Erwartet: --parallel=N (N >= 1), --teil=k/n (1 <= k <= n).');
  process.exit(2);
}

const SUITEN = [
  { name: 'zeitwaechter', datei: 'zeitwaechter.test.mjs', args: [], was: 'Zeitgrenzen, Fehler und Prozess-Aufraeumen' },
  { name: 'konto', datei: 'konto.test.mjs', args: [], was: 'Konto, Anmeldung und Cloud-Spielstand' },
  { name: 'konto-link', datei: 'konto-link.test.mjs', args: [], exklusiv: 'Browser-Zeitfenster (Dialoge, Uhr)', was: 'Anmelde-Link: Rückkehr, Abgleich-Riegel, zwei Tabs (Browser)' },
  { name: 'online', datei: 'online.test.mjs', args: [], was: 'Online gegen Freunde: Einladung, Zuege, Abfrage' },
  { name: 'freunde', datei: 'freunde.test.mjs', args: [], was: 'Freunde: Anfrage, Antwort, Einladungslink (Server abgefangen)' },
  // Fester Port: zuzweit wertet PORT noch nicht aus und bleibt deshalb exklusiv (online-ui sicherheitshalber auch).
  { name: 'online-ui', datei: 'online-ui.test.mjs', args: [], exklusiv: 'fester Port 8887', was: 'Online-Oberflaeche mit abgefangenen Server-Anfragen' },
  { name: 'server-online-zug', datei: 'server-online-zug.test.mjs', args: [], was: 'Online-Zuege: Edge Function prueft Regeln und Ende (Server, Anti-Cheat 1a)' },
  { name: 'zuzweit', datei: 'zuzweit.test.mjs', args: [], exklusiv: 'fester Port 8886', was: 'Zu zweit: Namen, Uhr, Ergebnis und neutrale Analyse' },
  { name: 'daten', datei: 'daten.test.mjs', args: [], was: 'Datenfreigabe, Datenauskunft, Konto löschen (DSGVO)' },
  { name: 'server-abo', datei: 'server-abo.test.mjs', args: [], was: 'Abo: Stripe-Webhook und Schema-Vertrag (Server)' },
  { name: 'abo', datei: 'abo.test.mjs', args: [], was: 'Abo „Crownmate Trainer“: Stand, Kauf, Blatt' },
  { name: 'server-coach', datei: 'server-coach.test.mjs', args: [], was: 'Frag den Coach: Edge Function, Prompt, Tageslimit (Server)' },
  { name: 'coach-ki', datei: 'coach-ki.test.mjs', args: [], was: 'Frag den Coach: Knopf und Antwort in der Analyse' },
  { name: 'server-schule', datei: 'server-schule.test.mjs', args: [], was: 'Schulmodus: Schema-Vertrag, Rechte, Grenzen (Server)' },
  { name: 'schule', datei: 'schule.test.mjs', args: [], was: 'Schulmodus: Lehrkraft-Ansicht, Beitreten, Heute-Karte, Melden' },
  { name: 'server-werkstatt', datei: 'server-werkstatt.test.mjs', args: [], was: 'Limitierte Editionen: Kasse, Webhook, Schema-Vertrag (Server, Testmodus)' },
  { name: 'storage', datei: 'storage.test.mjs', args: [], was: 'Speicher, Sterne, Freischaltung' },
  { name: 'liga', datei: 'liga.test.mjs', args: [], exklusiv: 'fester Port 8847', was: 'Arena-Wertung, Spielklassen, Saison und Vereinsmeisterschaft' },
  { name: 'sicherung', datei: 'sicherung.test.mjs', args: [], was: 'Export, Import und Sicherungshinweis' },
  { name: 'review', datei: 'review.test.mjs', args: SCHNELL ? ['--nur-node'] : [], was: 'Zug-Klassen, Genauigkeit, Coach' },
  { name: 'ereignisse', datei: 'ereignisse.test.mjs', args: [], was: 'Ereignis-Bus, Anzeige-Orte, Feier-Budget' },
  { name: 'fairness', datei: 'fairness.test.mjs', args: [], was: 'Fairness-Regeln (Runde 4)' },
  { name: 'spiel', datei: 'spiel.test.mjs', args: [], was: 'Spiel-Fundament: Tag, Inhalte, Spielplan, Bot-Register' },
  { name: 'engine-bots', datei: 'engine-bots.test.mjs', args: ['--schnell'], exklusiv: 'hohe Rechenlast', was: 'Stockfish-Wrapper und Bots' },
  { name: 'board', datei: 'board.test.mjs', args: [], was: 'Brett: Tippen, Ziehen, Effekte' },
  { name: 'vorzuege', datei: 'vorzuege.test.mjs', args: [], was: 'Vorzug-Kette mit Nummern, Pfeil-Tipp' },
  { name: 'sw', datei: 'sw.test.mjs', args: [], was: 'Cache-Liste, Manifest, Icons' },
  { name: 'thema', datei: 'thema.test.mjs', args: [], was: 'Theme-Fundament: Tokens, hell/dunkel, Schriften, Lesbarkeit' },
  { name: 'klang', datei: 'klang.test.mjs', args: [], was: 'Klangpakete: Katalog, Dateien, Pegel, Abspielen' },
  { name: 'musik', datei: 'musik.test.mjs', args: [], was: 'Lobby-Musik: Standard, Beruehrung, Welten und Freischaltung' },
  { name: 'navigation', datei: 'navigation.test.mjs', args: [], was: 'Reiter-Leiste, Kopf, Bauteile, Training-Hülle' },
  { name: 'ansicht', datei: 'ansicht.test.mjs', args: [], was: 'Ansicht: jeder Bildschirm in 5 Größen (Schrift, Knöpfe, Überlauf, Überlappung)' },
  { name: 'arena', datei: 'arena.test.mjs', args: SCHNELL ? ['--ohne-bilder'] : [], exklusiv: 'Animations-Zeitfenster unter CPU-Last', was: 'Arena als Weltkarte, Detail-Panel, Duell-Intro, Porträts' },
  { name: 'funken', datei: 'funken.test.mjs', args: [], was: 'Paket Funken und Level: Rechnung, Speicher, Orte, Aufstieg' },
  { name: 'punkte', datei: 'punkte.test.mjs', args: SCHNELL ? ['--schnell'] : [], exklusiv: 'Zeitfenster unter CPU-Last', was: 'Paket Punkte und Bestenliste: Formel, Tafeln, Codes, Abrechnung' },
  { name: 'serie', datei: 'serie.test.mjs', args: [], was: 'Paket Serie: Bauernmarsch und Siegeslauf (Tageswerk, Meilensteine, Orte)' },
  { name: 'teilen', datei: 'teilen.test.mjs', args: [], was: 'Paket teilen: Siegesbild (Welle A1)' },
  { name: 'gedaechtnis', datei: 'gedaechtnis.test.mjs', args: [], was: 'Paket gedaechtnis: Bots erinnern sich, Revanche, Erzfeind (Welle A2)' },
  { name: 'emotes', datei: 'emotes.test.mjs', args: [], was: 'Paket Emotes: Rad, Schnell-Chat, Bot-Antwort und Barrierefreiheit' },
  { name: 'sammlung', datei: 'sammlung.test.mjs', args: [], was: 'Paket Sammlung: Reiter Ich, Bereiche mit Schloss, Erfolge' },
  { name: 'finisher', datei: 'finisher.test.mjs', args: [], was: 'Paket Finisher: Freischaltung und sichere Standardwahl' },
  { name: 'boss', datei: 'boss.test.mjs', args: [], was: 'Wochen-Boss und Funken-Wochenende: Spielplan und Logik' },
  { name: 'kartei', datei: 'kartei.test.mjs', args: SCHNELL ? ['--ohne-bilder'] : [], was: 'Paket kartei: Fehler-Kartei und Rätsel-Bildschirm (Welle A3)' },
  { name: 'sprache', datei: 'sprache.test.mjs', args: SCHNELL ? ['--ohne-bilder'] : [], was: 'Sprachen: Deutsch und Englisch (Kern-Screens)' },
  { name: 'sprache-pakete', datei: 'sprache.test.mjs', args: ['--pakete', ...(SCHNELL ? ['--ohne-bilder'] : [])], was: 'Sprachen: Englisch mit allen Paketen' },
  { name: 'tagesraetsel-daten', datei: 'tagesraetsel-daten.test.mjs', args: [], was: 'Tagesrätsel-Datei und Rätsel-Fabrik: legal, eindeutig, Wochenkurve, deterministisch' },
  { name: 'tagesraetsel', datei: 'tagesraetsel.test.mjs', args: SCHNELL ? ['--ohne-bilder'] : [], was: 'Paket tagesraetsel: Rätsel des Tages, Archiv, Ein Wort, Teilen (S1-5)' },
  { name: 'start', datei: 'start.test.mjs', args: SCHNELL ? ['--ohne-bilder'] : [], exklusiv: 'Rechenzeit-Grenze der Einstufung', was: 'Paket start: Willkommen, Regel-Hilfe, Einstufung, Fahrplan (Welle A4)' },
  { name: 'app', datei: 'app.test.mjs', args: SCHNELL ? ['--schnell'] : [], was: 'Arena, Partie, Ergebnis' },
  { name: 'screens', datei: 'screens.test.mjs', args: SCHNELL ? ['--ohne-bilder'] : [], was: 'Analyse, Verlauf, Einstellungen' },
  { name: 'e2e', datei: 'e2e.test.mjs', args: SCHNELL ? ['--ohne-bilder'] : [], exklusiv: 'Browser-Zeitfenster unter CPU-Last', was: 'Ganzer Ablauf, offline, Update' },
  { name: 'notfall', datei: 'notfall.test.mjs', args: [], exklusiv: 'Zeitgrenzen 3 s und 15 s', was: 'Notfall-Wächter: Reparieren, wenn die App nicht startet' },
  { name: 'bericht', datei: 'bericht.test.mjs', args: [], exklusiv: 'Browser-Zeitfenster unter CPU-Last', was: 'Tester-Bericht: Fehlerprotokoll (nur lokal), Bericht ansehen, kopieren, teilen' },
  { name: 'native', datei: 'native.test.mjs', args: [], was: 'App-Store-Huelle (Capacitor): Konfiguration, Kopie der Web-App' },
];

// Sekunden aus einem seriellen --schnell-Lauf vom 29.10.2026. Unbekannte/neue Suiten
// bekommen den Median, damit sie ohne Aenderung an dieser Tabelle aufgenommen werden koennen.
const DAUERN = new Map([
  ['zeitwaechter', 4], ['konto', 0], ['online', 2], ['online-ui', 13], ['zuzweit', 15],
  ['daten', 12], ['server-abo', 0], ['abo', 33], ['server-coach', 29], ['coach-ki', 30],
  ['server-schule', 0], ['schule', 59], ['storage', 3], ['liga', 53], ['sicherung', 0],
  ['review', 2], ['ereignisse', 1], ['fairness', 1], ['spiel', 15], ['engine-bots', 104],
  ['board', 68], ['vorzuege', 17], ['sw', 0], ['thema', 55], ['klang', 12],
  ['navigation', 39], ['ansicht', 150], ['arena', 154], ['funken', 124], ['punkte', 167], ['serie', 140],
  ['teilen', 35], ['gedaechtnis', 58], ['kartei', 62], ['sprache', 156], ['sprache-pakete', 225],
  ['tagesraetsel-daten', 2], ['tagesraetsel', 33], ['start', 151], ['app', 569], ['screens', 63],
  ['e2e', 111], ['native', 0],
]);

function teile(suiten, anzahl) {
  const median = 12;
  const gruppen = Array.from({ length: anzahl }, () => ({ dauer: 0, suiten: [] }));
  for (const suite of [...suiten].sort((a, b) => (DAUERN.get(b.name) ?? median) - (DAUERN.get(a.name) ?? median))) {
    const gruppe = gruppen.reduce((a, b) => a.dauer <= b.dauer ? a : b);
    gruppe.suiten.push(suite);
    gruppe.dauer += DAUERN.get(suite.name) ?? median;
  }
  return gruppen;
}

async function lauf(suite, index) {
  if (!existsSync(path.join(WURZEL, 'tests', suite.datei))) {
    return { ...suite, code: 1, sekunden: 0, ok: null, gesamt: null, fehler: [`FEHLER Suite-Datei fehlt: tests/${suite.datei}`], ende: [] };
  }
  let letzte = 'Start';
  const puls = setInterval(() => console.log(`… ${suite.name}: laeuft, zuletzt ${letzte}`), 30000);
  try {
    const e = await prozess(process.execPath, [path.join(WURZEL, 'tests', suite.datei), ...suite.args], {
      cwd: WURZEL,
      env: {
        ...process.env,
        // Seriell bleiben die bewaehrten Standardports erhalten. Nur gleichzeitig
        // laufende Suiten brauchen einen vom Listenplatz abgeleiteten eigenen Port.
        ...(PARALLEL > 1 && !suite.exklusiv ? { PORT: String(9200 + index) } : {}),
        ...(process.env.BILDER ? { BILDER: path.join(process.env.BILDER, suite.name) } : {}),
      },
      // 20 Minuten je Suite, nicht fuer die gesamte Sammlung (der volle Lauf braucht laenger).
      zeitlimitMs: 20 * 60 * 1000,
      ausgabe(s) {
        const zeilen = s.trim().split(/\r?\n/).filter(Boolean);
        if (zeilen.length) letzte = zeilen.at(-1).slice(0, 180);
      },
    });
    const zeilen = e.text.split(/\r?\n/);
    const zahl = zeilen.map(z => z.match(/(\d+)\s*\/\s*(\d+)\s+bestanden/)).filter(Boolean).pop();
    const fehler = zeilen.filter(z => /^FEHLER/.test(z.trim()));
    if (e.zeitlimit) fehler.push(`FEHLER Suite ${suite.name} ueberschritt ihr Zeitlimit (20 Minuten)`);
    return { ...suite, code: e.code, sekunden: e.dauerMs / 1000, ok: zahl ? +zahl[1] : null,
      gesamt: zahl ? +zahl[2] : null, fehler, ende: zeilen.slice(-15), ausgabe: e.text };
  } finally { clearInterval(puls); }
}

let auswahl = NUR ? SUITEN.filter((s) => NUR.includes(s.name)) : SUITEN;
if (TEIL) auswahl = teile(auswahl, TEIL[1])[TEIL[0] - 1].suiten;
if (!auswahl.length) {
  console.log('Keine passende Suite. Namen: ' + SUITEN.map((s) => s.name).join(', '));
  process.exit(2);
}
console.log(`Crownmate: ${auswahl.length} Testsuiten${SCHNELL ? ' (schnell)' : ''}, parallel ${PARALLEL}${TEIL ? `, Teil ${TEIL.join('/')}` : ''}\n`);
const t0 = Date.now();
const ergebnisse = [];
async function starte(s) {
  const index = SUITEN.indexOf(s);
  process.stdout.write(`… ${s.name.padEnd(12)} ${s.was}\n`);
  const e = await lauf(s, index);
  ergebnisse.push(e);
  if (LAUT && e.ende) {
    console.log(`\n--- ${s.name}: Ausgabe ---`);
    process.stdout.write(e.ausgabe || '');
    if (e.ausgabe && !e.ausgabe.endsWith('\n')) process.stdout.write('\n');
    console.log(`--- ${s.name}: Ende ---`);
  }
  const status = e.code === 0 ? 'ok    ' : 'FEHLER';
  const zahl = e.gesamt != null ? `${e.ok}/${e.gesamt}` : '-';
  console.log(`${status} ${s.name.padEnd(12)} ${zahl.padStart(9)}  ${e.sekunden.toFixed(1).padStart(6)} s`);
  if (e.code !== 0 && !LAUT) {
    const zeigen = e.fehler.length ? e.fehler.slice(0, 20) : e.ende;
    for (const z of zeigen) console.log('       ' + z);
  }
  return e;
}

let laufend = [];
for (const s of auswahl) {
  if (s.exklusiv) {
    await Promise.all(laufend);
    laufend = [];
    if (PARALLEL > 1) console.log(`  ${s.name}: seriell (${s.exklusiv})`);
    await starte(s);
    continue;
  }
  const arbeit = starte(s).finally(() => { laufend = laufend.filter((p) => p !== arbeit); });
  laufend.push(arbeit);
  if (laufend.length >= PARALLEL) await Promise.race(laufend);
}
await Promise.all(laufend);

ergebnisse.sort((a, b) => SUITEN.indexOf(a) - SUITEN.indexOf(b));
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
