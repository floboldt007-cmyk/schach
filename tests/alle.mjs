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
  { name: 'testserver', datei: 'testserver.test.mjs', args: [], was: 'Gemeinsamer Test-Server der Browser-Suiten: MIME-Typen, 404/301/304, Last ohne Verweigerung' },
  { name: 'konto', datei: 'konto.test.mjs', args: [], was: 'Konto, Anmeldung und Cloud-Spielstand' },
  { name: 'konto-link', datei: 'konto-link.test.mjs', args: [], exklusiv: 'Browser-Zeitfenster (Dialoge, Uhr)', was: 'Anmelde-Link: Rückkehr, Abgleich-Riegel, zwei Tabs (Browser)' },
  { name: 'apple-knopf', datei: 'apple-knopf.test.mjs', args: [], was: 'Anmeldeblatt: abgeschalteter Apple-Weg berechnet unsichtbar, Google und Code-Anmeldung sichtbar (Browser)' },
  { name: 'online', datei: 'online.test.mjs', args: [], was: 'Online gegen Freunde: Einladung, Zuege, Abfrage' },
  { name: 'online-haengt-vertrag', datei: 'online-haengt-vertrag.test.mjs', args: [], was: 'Haengende Online-Partie: Client wartet gewertet ranked_haengt_s + 1 s, sonst 10 Min (Vertrag mit zwei-ligen-schema.sql)' },
  { name: 'online-live-eigene', datei: 'online-live-eigene.test.mjs', args: [], was: 'Online-Live-Bewertung: nur eigene Zuege, kein bester Zug, Ranked nur mit Server-Kontingent' },
  { name: 'freunde', datei: 'freunde.test.mjs', args: [], was: 'Freunde: Anfrage, Antwort, Einladungslink (Server abgefangen)' },
  { name: 'online-ui', datei: 'online-ui.test.mjs', args: [], was: 'Online-Oberflaeche mit abgefangenen Server-Anfragen' },
  { name: 'online-ranked-probe', datei: 'online-ranked-probe.test.mjs', args: [], was: 'Funktionsprobe Ranked: zwei Sitzungen gegen einen nachgebauten Server (harte Befund-Pruefungen nur mit PROBE_STRENG=1)' },
  { name: 'online-suche-gleichzeitig', datei: 'online-suche-gleichzeitig.test.mjs', args: [], was: 'Feinschliff R15: zwei Konten suchen gleichzeitig, sofort gepaart, Visitenkarte, Elo und Sondertitel in Leiste und Duell-Intro (Browser)' },
  { name: 'server-online-zug', datei: 'server-online-zug.test.mjs', args: [], was: 'Online-Zuege: Edge Function prueft Regeln und Ende (Server, Anti-Cheat 1a)' },
  { name: 'zuzweit', datei: 'zuzweit.test.mjs', args: [], was: 'Zu zweit: Namen, Uhr, Ergebnis und neutrale Analyse' },
  { name: 'daten', datei: 'daten.test.mjs', args: [], was: 'Datenfreigabe, Datenauskunft, Konto löschen (DSGVO)' },
  { name: 'konto-loeschen', datei: 'konto-loeschen.test.mjs', args: [], was: 'Löschseite ohne App (Google Play): Anmeldung, zweistufig löschen, Mail-Weg (Browser)' },
  { name: 'server-abo', datei: 'server-abo.test.mjs', args: [], was: 'Abo: Stripe-Webhook und Schema-Vertrag (Server)' },
  { name: 'abo', datei: 'abo.test.mjs', args: [], was: 'Abo „Crownmate Trainer“: Stand, Kauf, Blatt' },
  // server-verwaltung steht wie alle PGlite-Suiten (server-karte*, server-daten*) nicht hier: PGlite gibt es nur im CI-Job
  // sql (.github/workflows/tests.yml), im Browser-Job brach die Suite ab (R17-sammelfix2, Run 43587846003)
  { name: 'verwaltung', datei: 'verwaltung.test.mjs', args: [], was: 'Verwaltung fuer Flo: Recht still pruefen, Aufrufe, Fehlertexte, Ansichten (ohne Browser)' },
  { name: 'verwaltung-browser', datei: 'verwaltung-browser.test.mjs', args: [], was: 'Verwaltung im Browser: still unsichtbar ohne Recht, Menue-Eintrag nach spaeter Antwort (PC und Handy)' },
  { name: 'server-coach', datei: 'server-coach.test.mjs', args: [], was: 'Frag den Coach: Edge Function, Prompt, Tageslimit (Server)' },
  { name: 'coach-ki', datei: 'coach-ki.test.mjs', args: [], was: 'Frag den Coach: Knopf und Antwort in der Analyse' },
  { name: 'server-schule', datei: 'server-schule.test.mjs', args: [], was: 'Schulmodus: Schema-Vertrag, Rechte, Grenzen (Server)' },
  { name: 'schule', datei: 'schule.test.mjs', args: [], was: 'Schulmodus: Lehrkraft-Ansicht, Beitreten, Heute-Karte, Melden' },
  { name: 'server-werkstatt', datei: 'server-werkstatt.test.mjs', args: [], was: 'Limitierte Editionen: Kasse, Webhook, Schema-Vertrag (Server, Testmodus)' },
  { name: 'gegnersuche', datei: 'gegnersuche.test.mjs', args: [], was: 'Sofort-Suche: Wartezeit vom Server, Knopf Jetzt gegen KI, Rueckfall auf altes SQL' },
  { name: 'kronen', datei: 'kronen.test.mjs', args: [], was: 'Liga mit Kronen: reine Rechnung (Stufen, Saison, Boden, Start aus Elo)' },
  { name: 'kronen-vertrag', datei: 'kronen-vertrag.test.mjs', args: [], was: 'Liga mit Kronen: Schema-Vertrag mit js/pakete/liga/kronen.js, Rechte, Rueckweg (Server)' },
  { name: 'besitz', datei: 'besitz.test.mjs', args: [], was: 'Etappe 4b: Erfolge in Stufen, lokales Taler- und Banner-Buch (ohne Konto)' },
  { name: 'karte', datei: 'karte.test.mjs', args: [], was: 'Etappe 4b: js/karte.js gegen einen nachgebildeten Server (Stufen melden, Karte waehlen, Karte der Partie)' },
  { name: 'karte-vertrag', datei: 'karte-vertrag.test.mjs', args: [], was: 'Etappe 4b: Schema-Vertrag Visitenkarte (Zahlen, feste Listen, Rechte, Rueckweg, nie kaeuflich)' },
  { name: 'raetsel-duell', datei: 'raetsel-duell.test.mjs', args: [], was: 'Raetsel-Duell: reine Rechnung (Uhr, Phase, Stand) und Vertrag mit duell_konstanten' },
  { name: 'server-raetsel-duell-zug', datei: 'server-raetsel-duell-zug.test.mjs', args: [], was: 'Raetsel-Duell: Edge Function prueft Zuege (richtig, Matt, illegal, Kennungen; Server)' },
  { name: 'raetsel-duell-ui', datei: 'raetsel-duell-ui.test.mjs', args: [], was: 'Raetsel-Duell: Screen gegen nachgebauten Server (KI-Duell bis zur Wertung, Link, Labor)' },
  { name: 'zaehler', datei: 'zaehler.test.mjs', args: [], was: 'Tageszaehler ohne Personenbezug: Client und SQL-Vertrag (aus bis zur Rechtspruefung)' },
  { name: 'storage', datei: 'storage.test.mjs', args: [], was: 'Speicher, Sterne, Freischaltung' },
  { name: 'liga', datei: 'liga.test.mjs', args: [], was: 'Arena-Wertung, Spielklassen, Saison und Vereinsmeisterschaft' },
  { name: 'sicherung', datei: 'sicherung.test.mjs', args: [], was: 'Export, Import und Sicherungshinweis' },
  { name: 'review', datei: 'review.test.mjs', args: SCHNELL ? ['--nur-node'] : [], was: 'Zug-Klassen, Genauigkeit, Coach' },
  { name: 'analyse-start', datei: 'analyse-start.test.mjs', args: [], was: 'Analyse: Satz der Start-Karte und Zug beim Oeffnen (kurze Partie)' },
  { name: 'online-analyse', datei: 'online-analyse.test.mjs', args: [], was: 'Analyse der Online-Partie: Kennzeichen online, Du gegen Gegner, Ende ohne Ergebnis ehrlich' },
  { name: 'ereignisse', datei: 'ereignisse.test.mjs', args: [], was: 'Ereignis-Bus, Anzeige-Orte, Feier-Budget' },
  { name: 'fairness', datei: 'fairness.test.mjs', args: [], was: 'Fairness-Regeln (Runde 4)' },
  { name: 'spiel', datei: 'spiel.test.mjs', args: [], was: 'Spiel-Fundament: Tag, Inhalte, Spielplan, Bot-Register' },
  { name: 'engine-bots', datei: 'engine-bots.test.mjs', args: ['--schnell'], exklusiv: 'hohe Rechenlast', was: 'Stockfish-Wrapper und Bots' },
  { name: 'board', datei: 'board.test.mjs', args: [], was: 'Brett: Tippen, Ziehen, Effekte' },
  { name: 'vorzuege', datei: 'vorzuege.test.mjs', args: [], was: 'Vorzug-Kette mit Nummern, Pfeil-Tipp' },
  { name: 'partie-figurensatz', datei: 'partie-figurensatz.test.mjs', args: [], was: 'Bot-Partie: Figurensatz wechselt ohne Neuladen (spaeter Erfinder-Status, Wahl in den Einstellungen)' },
  { name: 'zuzweit-lektion-figurensatz', datei: 'zuzweit-lektion-figurensatz.test.mjs', args: [], was: 'Zu zweit und Meisterschule-Lektion: Figurensatz wechselt ohne Neuladen (spaeter Erfinder-Status, Wahl in den Einstellungen)' },
  { name: 'funktion-partie', datei: 'funktion-partie.test.mjs', args: [], was: 'Funktionsprobe Bot-Partie: Start, Zug, Hinweis, Sieg, Aufgeben, Ergebnisblatt (iPhone 13 + PC)' },
  { name: 'ergebnis-einmal', datei: 'ergebnis-einmal.test.mjs', args: [], was: 'Ergebnisblatt der Bot-Partie: Spruch einmal, ein Nochmal-Knopf (Revanche), Knoepfe ab 44 px (iPhone 13 + PC)' },
  { name: 'r17-ende-feinschliff', datei: 'r17-ende-feinschliff.test.mjs', args: [], was: 'R17: Fokus nach Niederlage auf Zur Analyse, Namen auf der Duell-Ende-Karte, kein Streifen unter dem Profilbanner (Browser)' },
  { name: 'liga-kontrast', datei: 'liga-kontrast.test.mjs', args: [], was: 'Kritik R6: Marke "neu" als Chip, Code-Teilen als Knopf, Kontraste Bronze/Gold/Aufstieg/"!", Knoepfe hinter dem Ergebnis-Blatt gesperrt (Browser)' },
  { name: 'liga-wertung-text', datei: 'liga-wertung-text.test.mjs', args: [], was: 'Liga-Texte: die Wertung heisst Liga-Wertung / League rating, nie Arena' },
  { name: 'datenschutz-karte', datei: 'datenschutz-karte.test.mjs', args: [], was: 'Datenschutz Visitenkarte: Online-Elo nur in gewerteten Partien, Erfinder/Pionier nur auf der eigenen Karte' },
  { name: 'datenschutz-verwaltung', datei: 'datenschutz-verwaltung.test.mjs', args: [], was: 'Datenschutz Verwaltung durch den Betreiber: Daten, Aenderungen, Protokoll, lit. b/f, Auskunft, Loeschung' },
  { name: 'partie-hoehe', datei: 'partie-hoehe.test.mjs', args: [], was: 'Bot-Partie ohne Seitenueberlauf und Sieg-Blatt ohne Innen-Scrollen, Brett nicht kleiner (7 Geraete, R7 B8/B10)' },
  { name: 'layout-r8', datei: 'layout-r8.test.mjs', args: [], was: 'Kritik R8: Liga-Platzzahl deckend ueber dem Banner, Sieg-Blatt SE/PC ohne Innen-Scrollen, Fertig im Bereichs-Blatt volle Breite (Browser)' },
  { name: 'funktion-shop-skin', datei: 'funktion-shop-skin.test.mjs', args: [], was: 'Funktionsprobe Shop: Figurensatz waehlen und in jeder Partie-Ansicht pruefen, auch Wechsel bei offener Ansicht' },
  { name: 'funktion-zuzweit-lernen', datei: 'funktion-zuzweit-lernen.test.mjs', args: [], was: 'Funktionsprobe Zu zweit und Meisterschule: alle sechs Lektionsarten bis geschafft' },
  { name: 'gleichheit-ansichten', datei: 'gleichheit-ansichten.test.mjs', args: [], was: 'Gleichheits-Liste: jede Partie-Ansicht gegen die Bot-Partie (Abweichungen nur mit PROBE_STRENG=1 hart)' },
  { name: 'r15-ergebnis-teilen', datei: 'r15-ergebnis-teilen.test.mjs', args: [], was: 'Feinschliff R15: Duell-Nochmal in Suchfarbe, Niederlage mit Liga-Verweis, ein Knopf "Teilen ..." nach dem Sieg (Browser)' },
  { name: 'r15-ich-lektion', datei: 'r15-ich-lektion.test.mjs', args: [], was: 'Feinschliff R15: Vitrine im Banner am PC, Spielerleisten in der Lektion, Zu-zweit-Brett wie die Bot-Partie (Browser)' },
  { name: 'sw', datei: 'sw.test.mjs', args: [], was: 'Cache-Liste, Manifest, Icons' },
  { name: 'sw-update', datei: 'sw-update.test.mjs', args: [], was: 'SW-Update laedt nur geaenderte Dateien (ETag/304)' },
  { name: 'brett-tastatur', datei: 'brett-tastatur.test.mjs', args: [], was: 'Brett per Tastatur, Feldnamen, Bot-Zug in der Zugansage' },
  { name: 'siegblatt-tastatur', datei: 'siegblatt-tastatur.test.mjs', args: [], was: 'Sieg-Blatt per Tastatur: Fokus-Halt, Escape' },
  { name: 'sw-cache', datei: 'sw-cache.test.mjs', args: [], was: 'Versionswechsel: alter Cache kommt nicht wieder' },
  { name: 'thema', datei: 'thema.test.mjs', args: [], was: 'Theme-Fundament: Tokens, hell/dunkel, Schriften, Lesbarkeit' },
  { name: 'info-lizenzen', datei: 'info-lizenzen.test.mjs', args: [], was: 'Info und Lizenzen: jede Fremdlizenz und der eigene Quellcode in DE und EN, Herkunft Kuerbis/Frost/Gold (Browser)' },
  { name: 'klang', datei: 'klang.test.mjs', args: [], was: 'Klangpakete: Katalog, Dateien, Pegel, Abspielen' },
  { name: 'musik', datei: 'musik.test.mjs', args: [], was: 'Lobby-Musik: Standard, Beruehrung, Welten und Freischaltung' },
  { name: 'navigation', datei: 'navigation.test.mjs', args: [], was: 'Reiter-Leiste, Kopf, Bauteile, Training-Hülle' },
  { name: 'arena', datei: 'arena.test.mjs', args: SCHNELL ? ['--ohne-bilder'] : [], exklusiv: 'Animations-Zeitfenster unter CPU-Last', was: 'Arena als Weltkarte, Detail-Panel, Duell-Intro, Porträts' },
  { name: 'ansicht', datei: 'ansicht.test.mjs', args: [], was: 'Ansicht: jeder Bildschirm in 7 Größen (Schrift, Knöpfe, Überlauf, Überlappung)' },
  { name: 'ansicht-befunde', datei: 'ansicht-befunde.test.mjs', args: [], was: 'Ansichts-Befunde an Probe-Seiten: nichts unter [inert] oder unsichtbarem Vorfahren zaehlt, Offenes wird gefunden (Browser)' },
  { name: 'funken', datei: 'funken.test.mjs', args: [], was: 'Paket Funken und Level: Rechnung, Speicher, Orte, Aufstieg' },
  { name: 'punkte', datei: 'punkte.test.mjs', args: SCHNELL ? ['--schnell'] : [], exklusiv: 'Zeitfenster unter CPU-Last', was: 'Paket Punkte und Bestenliste: Formel, Tafeln, Codes, Abrechnung' },
  { name: 'serie', datei: 'serie.test.mjs', args: [], was: 'Paket Serie: Bauernmarsch und Siegeslauf (Tageswerk, Meilensteine, Orte)' },
  { name: 'teilen', datei: 'teilen.test.mjs', args: [], was: 'Paket teilen: Siegesbild (Welle A1)' },
  { name: 'gedaechtnis', datei: 'gedaechtnis.test.mjs', args: [], was: 'Paket gedaechtnis: Bots erinnern sich, Revanche, Erzfeind (Welle A2)' },
  { name: 'emotes', datei: 'emotes.test.mjs', args: [], was: 'Paket Emotes: Rad, Schnell-Chat, Bot-Antwort und Barrierefreiheit' },
  { name: 'sammlung', datei: 'sammlung.test.mjs', args: [], was: 'Paket Sammlung: Reiter Ich, Bereiche mit Schloss, Erfolge' },
  { name: 'lernen', datei: 'lernen.test.mjs', args: [], was: 'Paket lernen: Meisterschule, leicht gratis, Rest im Trainer, Lektionen mit Engine-Verteidigung' },
  { name: 'lobby', datei: 'lobby.test.mjs', args: [], was: 'Paket lobby: Online-Lobby als Vorschau im Labor (Umschalter, Bedenkzeiten, Suche, Partie mit Uhr)' },
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
  { name: 'einfuehrung-rand', datei: 'einfuehrung-rand.test.mjs', args: [], was: 'Einführung: jeder Knopf ohne Scrollen ganz sichtbar, mind. 44 px (SE, 13, iPad, PC), Klartext Bauernmarsch' },
  { name: 'systeme-texte', datei: 'systeme-texte.test.mjs', args: [], was: 'Spielsysteme: Funken, Duell, Liga nennen in DE und EN dieselben Zahlen wie der Code' },
  { name: 'start-befunde', datei: 'start-befunde.test.mjs', args: [], was: 'Feinschliff R6: Serie "1 Tag", Bot-Spruch ohne angeschnittene Zeile, Leiter auf Start quer, ein Begriff fuer Online (Browser)' },
  { name: 'r17-heim-hover', datei: 'r17-heim-hover.test.mjs', args: [], was: 'Feinschliff R17: Knoepfe der Startseite in Ruhe, Zeiger, Fokus, gedrueckt mind. 4,5:1, Zeiger sichtbar (Browser)' },
  { name: 'r17-hover-handy', datei: 'r17-hover-handy.test.mjs', args: [], was: 'Feinschliff R17: Zeiger-Zustand bleibt am Handy nach dem Tippen nicht haengen, am PC unveraendert (Browser)' },
  { name: 'geschmack-r8', datei: 'geschmack-r8.test.mjs', args: [], was: 'Feinschliff R8: Serien-Chip neben dem Gruss auf kurzen Handys, Erfolgs-Fenster nie ueber einem offenen Blatt (Browser)' },
  { name: 'r16-p1', datei: 'r16-p1.test.mjs', args: [], was: 'Feinschliff R16 Paket 1: Konto-Fehlertext, Lobby-Gegnerkarte (VS, Sondertitel-Wappen, Elo), Vitrine, Lektion auf dem iPhone SE (Browser)' },
  { name: 'r17-kopf', datei: 'r17-kopf.test.mjs', args: [], was: 'Feinschliff R17: Kopf-Knoepfe (Premium, rund) in Ruhe, Zeiger, Fokus, gedrueckt lesbar, Zeiger nur bei hover:hover, Handy ohne haengenden Zustand (Browser)' },
];

// Sekunden aus einem seriellen --schnell-Lauf vom 29.10.2026. Unbekannte/neue Suiten
// bekommen den Median, damit sie ohne Aenderung an dieser Tabelle aufgenommen werden koennen.
const DAUERN = new Map([
  ['zeitwaechter', 4], ['konto', 0], ['online', 2], ['online-ui', 13], ['zuzweit', 15],
  ['daten', 12], ['server-abo', 0], ['abo', 33], ['server-coach', 29], ['coach-ki', 30],
  ['server-schule', 0], ['schule', 59], ['storage', 3], ['liga', 53], ['sicherung', 0],
  ['review', 2], ['ereignisse', 1], ['fairness', 1], ['spiel', 15], ['engine-bots', 104],
  ['board', 68], ['vorzuege', 17], ['sw', 0], ['sw-update', 40], ['brett-tastatur', 30], ['sw-cache', 0], ['thema', 55], ['klang', 12],
  ['navigation', 39], ['ansicht', 150], ['arena', 154], ['funken', 124], ['punkte', 167], ['serie', 140],
  ['teilen', 35], ['gedaechtnis', 58], ['kartei', 62], ['sprache', 156], ['sprache-pakete', 225],
  ['tagesraetsel-daten', 2], ['tagesraetsel', 33], ['start', 151], ['app', 569], ['screens', 63],
  ['e2e', 111], ['native', 0], ['gegnersuche', 2],
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

async function lauf(suite) {
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
        // Kein PORT von hier: jede Suite nimmt ohne PORT einen freien Port (tests/freier-port.mjs). Vom Listenplatz
        // abgeleitete Ports (9200 + Platz) stiessen zusammen, sobald zwei Worktrees gleichzeitig alle.mjs liefen.
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
  process.stdout.write(`… ${s.name.padEnd(12)} ${s.was}\n`);
  const e = await lauf(s);
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
