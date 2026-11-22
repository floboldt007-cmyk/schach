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
  { name: 'dialog-zuklappen', datei: 'dialog-zuklappen.test.mjs', args: [], exklusiv: 'Browser-Zeitfenster (Dialoge, Uhr)', was: 'Rueckfrage-Dialog: Tipp auf den Schleier loest nichts darunter aus, Klick 50 ms nach dem Schliessen kommt an (iPhone 13, SE, PC)' },
  { name: 'apple-knopf', datei: 'apple-knopf.test.mjs', args: [], was: 'Anmeldeblatt: abgeschalteter Apple-Weg berechnet unsichtbar, Google und Code-Anmeldung sichtbar (Browser)' },
  { name: 'online', datei: 'online.test.mjs', args: [], was: 'Online gegen Freunde: Einladung, Zuege, Abfrage' },
  { name: 'online-haengt-vertrag', datei: 'online-haengt-vertrag.test.mjs', args: [], was: 'Haengende Online-Partie: Client wartet gewertet ranked_haengt_s + 1 s, sonst 10 Min (Vertrag mit zwei-ligen-schema.sql)' },
  { name: 'serverzeit', datei: 'serverzeit.test.mjs', args: [], was: 'Serveruhr minus Geraeteuhr fuer Online-Uhr, Erstzug-Frist und Intro (R19)' },
  { name: 'online-start', datei: 'online-start.test.mjs', args: [], was: 'Online-Start mit zwei Spielern: Intro sperrt nie, Erstzug-Frist auf beiden Seiten, Uhr trotz falscher Geraeteuhr (R19)' },
  { name: 'online-live-eigene', datei: 'online-live-eigene.test.mjs', args: [], was: 'Online-Live-Bewertung: nur eigene Zuege, kein bester Zug, Ranked nur mit Server-Kontingent' },
  { name: 'freunde', datei: 'freunde.test.mjs', args: [], was: 'Freunde: Anfrage, Antwort, Einladungslink (Server abgefangen)' },
  { name: 'online-ui', datei: 'online-ui.test.mjs', args: [], was: 'Online-Oberflaeche mit abgefangenen Server-Anfragen' },
  { name: 'alt-browser', datei: 'alt-browser.test.mjs', args: [], was: 'R26: alter Browser ohne at/Object.hasOwn (Chrome unter 92): Online-Zug geht an den Server, Zu zweit zieht (js/ersatz.js)' },
  { name: 'online-ranked-probe', datei: 'online-ranked-probe.test.mjs', args: [], was: 'Funktionsprobe Ranked: zwei Sitzungen gegen einen nachgebauten Server (harte Befund-Pruefungen nur mit PROBE_STRENG=1)' },
  { name: 'online-suche-gleichzeitig', datei: 'online-suche-gleichzeitig.test.mjs', args: [], was: 'Feinschliff R15: zwei Konten suchen gleichzeitig, sofort gepaart, Visitenkarte, Elo und Sondertitel in Leiste und Duell-Intro (Browser)' },
  { name: 'server-online-zug', datei: 'server-online-zug.test.mjs', args: [], was: 'Online-Zuege: Edge Function prueft Regeln und Ende (Server, Anti-Cheat 1a)' },
  { name: 'zuzweit', datei: 'zuzweit.test.mjs', args: [], was: 'Zu zweit: Namen, Uhr, Ergebnis und neutrale Analyse' },
  { name: 'daten', datei: 'daten.test.mjs', args: [], was: 'Datenfreigabe, Datenauskunft, Konto löschen (DSGVO)' },
  { name: 'konto-loeschen', datei: 'konto-loeschen.test.mjs', args: [], was: 'Löschseite ohne App (Google Play): Anmeldung, zweistufig löschen, Mail-Weg (Browser)' },
  { name: 'r19-bots-se', datei: 'r19-bots-se.test.mjs', args: [], was: 'Bots: klebender Spielen-Knopf verdeckt kein Fokusziel (7 Größen, in Ruhe bildgleich); Löschseite: Sprunglink zu "Selbst löschen" (Browser)' },
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
  { name: 'r19-liga-namen', datei: 'r19-liga-namen.test.mjs', args: [], was: 'Liga-Namen Satz A (Squire bis Crownmate, auch deutsch), Figuren und IDs unverändert, alte Spielklassen nie angezeigt' },
  { name: 'r19-liga-neu', datei: 'r19-liga-neu.test.mjs', args: [], was: 'Liga neu: Reiter mit Bildstueck, Welt-Platzkarte mit Banner und Abstand (auch ausserhalb der Liste), Belohnungs-Karte ohne Technik-Satz, DE/EN' },
  { name: 'r19-saison', datei: 'r19-saison.test.mjs', args: [], was: 'R19 Season: Leiste im Profil, Titelwahl, Blatt am Season-Ende einmal, Karte, Datenschutz' },
  { name: 'r19-saison-abzeichen', datei: 'r19-saison-abzeichen.test.mjs', args: [], was: 'R19 Season-Abzeichen: grosse Wappen, Alle Ligen (18 Stufen, Tastatur), Balken, Titel-Vorschau, Ende-Fenster, Vitrine nur eigen' },
  { name: 'r19-ligen-satz', datei: 'r19-ligen-satz.test.mjs', args: [], was: 'R19 Alle Ligen: Satz je Liga nennt Auf- und Abstieg wie zoneVon (Abstieg ueberall ausser Squire III), DE/EN' },
  { name: 'r19-paket2-schalter', datei: 'r19-paket2-schalter.test.mjs', args: [], was: 'R19 Schalter Paket 2: Weltrangliste und Seasons aus, keine Server-Aufrufe, Datenschutz ohne die ungeprueften Abschnitte' },
  { name: 'r19-weltrang', datei: 'r19-weltrang.test.mjs', args: [], was: 'R19 Weltrangliste: Texte DE/EN, Satz unter der Liste, ab_start nie erfunden, Datenschutz DE/EN' },
  { name: 'r19-titel-erfolge', datei: 'r19-titel-erfolge.test.mjs', args: [], was: 'R19: Taten-Titel und lokale Erfolgs-Familien (ohne Taler, ohne Server)' },
  { name: 'r19-profil-ich', datei: 'r19-profil-ich.test.mjs', args: [], was: 'Profil Ich: Vitrine mit grossen Orden und sanftem Glanz, Liga-Symbol an der Stufe, Figuren gross, Banner Erster Zug neu, Banner bleiben in ihrer Kachel, DE/EN (Browser)' },
  { name: 'r19-lobby-farbe', datei: 'r19-lobby-farbe.test.mjs', args: [], was: 'Spiel-Symbole: gefuellt und farbig in Lobby, Startseite und Leiste, je Symbol mind. 3:1 an Pixeln hell und dunkel, Startseite scrollt nicht (Browser)' },
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
  { name: 'r20-analyse-matt', datei: 'r20-analyse-matt.test.mjs', args: [], was: 'Matt-Angaben der Analyse: 50-Zuege-Zaehler im Vorrat, Perspektive, ungenuegendes Material, Patt (Node, echter Stockfish)' },
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
  { name: 'r19-lektionen-probe', datei: 'r19-lektionen-probe.mjs', args: [], was: 'Funktionsprobe Meisterschule: jede der 65 Lektionen Start, Zug per Klick, Ergebnisblatt (iPhone 13 + PC, hell + dunkel)' },
  { name: 'r19-lektionen-besser', datei: 'r19-lektionen-besser.test.mjs', args: [], was: 'Feinschliff R19: 13 lange Lektionen mit drei Runden, jede Stellung, jedes Ziel und jede Textbehauptung mit Stockfish nachgerechnet (Node)' },
  { name: 'r19-lektionen-runden', datei: 'r19-lektionen-runden.test.mjs', args: [], was: 'Feinschliff R19: Rundenknoepfe, Runde fuer Runde geschafft, Meisterprobe ohne Hinweis, alter Spielstand, iPhone SE (Browser)' },
  { name: 'ergebnis-einmal', datei: 'ergebnis-einmal.test.mjs', args: [], was: 'Ergebnisblatt der Bot-Partie: Spruch einmal, ein Nochmal-Knopf (Revanche), Knoepfe ab 44 px (iPhone 13 + PC)' },
  { name: 'r17-ende-feinschliff', datei: 'r17-ende-feinschliff.test.mjs', args: [], was: 'R17: Fokus nach Niederlage auf Zur Analyse, Namen auf der Duell-Ende-Karte, kein Streifen unter dem Profilbanner (Browser)' },
  { name: 'liga-kontrast', datei: 'liga-kontrast.test.mjs', args: [], was: 'Kritik R6: Marke "neu" als Chip, Code-Teilen als Knopf, Kontraste Bronze/Gold/Aufstieg/"!", Knoepfe hinter dem Ergebnis-Blatt gesperrt (Browser)' },
  { name: 'liga-wertung-text', datei: 'liga-wertung-text.test.mjs', args: [], was: 'Liga-Texte: die Wertung heisst Liga-Wertung / League rating, nie Arena' },
  { name: 'r19-mail-datenschutz', datei: 'r19-mail-datenschutz.test.mjs', args: [], was: 'Kontakt kontakt@crownmate.de überall, kein Entwurfs-Kasten, Löschliste mit Abo, Coach und Klassen der Leitung (DE/EN), Sprunglink Löschseite EN' },
  { name: 'datenschutz-karte', datei: 'datenschutz-karte.test.mjs', args: [], was: 'Datenschutz Visitenkarte: Online-Elo nur in gewerteten Partien, Erfinder/Pionier nur auf der eigenen Karte' },
  { name: 'datenschutz-verwaltung', datei: 'datenschutz-verwaltung.test.mjs', args: [], was: 'Datenschutz Verwaltung durch den Betreiber: Daten, Aenderungen, Protokoll, lit. b/f, Auskunft, Loeschung' },
  { name: 'datenschutz-paket2', datei: 'datenschutz-paket2.test.mjs', args: [], was: 'Datenschutz Paket 2: Weltrangliste, Seasons, Altersbestaetigung, Season-Schalter, Konto ab 13' },
  { name: 'partie-hoehe', datei: 'partie-hoehe.test.mjs', args: [], was: 'Bot-Partie ohne Seitenueberlauf und Sieg-Blatt ohne Innen-Scrollen, Brett nicht kleiner (7 Geraete, R7 B8/B10)' },
  { name: 'layout-r8', datei: 'layout-r8.test.mjs', args: [], was: 'Kritik R8: Liga-Platzzahl deckend ueber dem Banner, Sieg-Blatt SE/PC ohne Innen-Scrollen, Fertig im Bereichs-Blatt volle Breite (Browser)' },
  { name: 'funktion-shop-skin', datei: 'funktion-shop-skin.test.mjs', args: [], was: 'Funktionsprobe Shop: Figurensatz waehlen und in jeder Partie-Ansicht pruefen, auch Wechsel bei offener Ansicht' },
  { name: 'r19-exklusiv-kontrast', datei: 'r19-exklusiv-kontrast.test.mjs', args: [], was: 'Feinschliff R19: Seltenheits-Marken im Shop A (Exklusiv in Gold) mind. 4,5:1 auf ihrer Karte, hell und dunkel, Ruhe/Zeiger/Fokus (Browser)' },
  { name: 'r19-shop-fortnite', datei: 'r19-shop-fortnite.test.mjs', args: [], was: 'R19 Shop A als Standard (?shopStil=alt alter Shop): fuenf feste Plaetze aus assets/shop/auslage.json, ohne Kauf-Weg Schloss und Bald, kein Druck, Vorschau je Art ohne Kaufknopf und ohne Serveranfrage' },
  { name: 'r19-emotes-finisher', datei: 'r19-emotes-finisher.test.mjs', args: [], was: 'R19 Emotes, Finisher, Klaenge: sechs neue Sticker, drei Finisher unter 1,5 s, Klangsets Polarlicht und Donner (Labor), Shop-A-Regale mit Schloss und Bald' },
  { name: 'r19-emotes-erspielbar', datei: 'r19-emotes-erspielbar.test.mjs', args: [], was: 'R19 Emotes und Finisher erspielbar (Variante C): Kreaturen und drei Finisher ueber die Welt-Endgegner, sechs Sticker ueber das Funken-Level, vier Finisher bald im Shop, volles Rad auf dem iPhone 13 (Browser)' },
  { name: 'funktion-emotes-finisher', datei: 'funktion-emotes-finisher.test.mjs', args: [], was: 'Funktionsprobe Emotes, Finisher, Klaenge: Sticker senden, Blitzschlag mit Polarlicht (Erfinder), Shop Anhoeren laedt bei Bedarf (iPhone 13 + PC)' },
  { name: 'r19-emotes-online', datei: 'r19-emotes-online.test.mjs', args: [], was: 'R19 Emotes und Finisher online: Knoepfe im KI-Ersatz ohne ?emotes, nicht gegen Bots und zu zweit; eigenes Matt in der Online-Partie startet den Finisher (Server simuliert)' },
  { name: 'funktion-zuzweit-lernen', datei: 'funktion-zuzweit-lernen.test.mjs', args: [], env: { PROBE_STRENG: '1' }, was: 'Funktionsprobe Zu zweit und Meisterschule: alle sechs Lektionsarten bis geschafft' },
  { name: 'funktion-funken-aufgeben', datei: 'funktion-funken-aufgeben.test.mjs', args: [], kommtMit: 'so/R20-proben', was: 'Funktionsprobe Funken und Aufgeben (Browser)' },
  { name: 'funktion-einstellungen-season', datei: 'funktion-einstellungen-season.test.mjs', args: [], kommtMit: 'so/R20-proben', was: 'Funktionsprobe Einstellungen und Season mit ?test&paket2 (Browser)' },
  { name: 'gleichheit-ansichten', datei: 'gleichheit-ansichten.test.mjs', args: [], was: 'Gleichheits-Liste: jede Partie-Ansicht gegen die Bot-Partie (Abweichungen nur mit PROBE_STRENG=1 hart)' },
  { name: 'r15-ergebnis-teilen', datei: 'r15-ergebnis-teilen.test.mjs', args: [], was: 'Feinschliff R15: Duell-Nochmal in Suchfarbe, Niederlage mit Liga-Verweis, ein Knopf "Teilen ..." nach dem Sieg (Browser)' },
  { name: 'r15-ich-lektion', datei: 'r15-ich-lektion.test.mjs', args: [], was: 'Feinschliff R15: Vitrine im Banner am PC, Spielerleisten in der Lektion, Zu-zweit-Brett wie die Bot-Partie (Browser)' },
  { name: 'sw', datei: 'sw.test.mjs', args: [], was: 'Cache-Liste, Manifest, Icons' },
  { name: 'sheet-knoepfe', datei: 'sheet-knoepfe.test.mjs', args: [], was: 'Blaetter: ein Knopf volle Breite und mittig, zwei Knoepfe wie bisher (Browser)' },
  { name: 'sw-update', datei: 'sw-update.test.mjs', args: [], was: 'SW-Update laedt nur geaenderte Dateien (ETag/304)' },
  { name: 'offline-ladeprobe', datei: 'offline-ladeprobe.test.mjs', args: [], kommtMit: 'so/R20-offline', was: 'Offline: die App startet ohne Netz aus dem Service Worker (?test&sw, Browser)' },
  { name: 'sw-wechsel', datei: 'sw-wechsel.test.mjs', args: [], was: 'Wechsel des Service Workers: hoechstens einmal neu laden, nie im Spiel' },
  { name: 'brett-tastatur', datei: 'brett-tastatur.test.mjs', args: [], was: 'Brett per Tastatur, Feldnamen, Bot-Zug in der Zugansage' },
  { name: 'siegblatt-tastatur', datei: 'siegblatt-tastatur.test.mjs', args: [], was: 'Sieg-Blatt per Tastatur: Fokus-Halt, Escape' },
  { name: 'sw-cache', datei: 'sw-cache.test.mjs', args: [], was: 'Versionswechsel: alter Cache kommt nicht wieder' },
  // R23-erstbesuch (fc-06:00, 20.11.2026): install legt nur den KERN ab, der Rest kommt in Haeppchen; WebKit beendet install nach etwa 30 s
  { name: 'sw-erstbesuch', datei: 'sw-erstbesuch.test.mjs', args: [], exklusiv: 'Zeitgrenze der Installation', was: 'Erstbesuch Slow 4G (Chromium): Worker aktiv, Kern im Cache, Nachladen setzt fort' },
  { name: 'sw-erstbesuch-webkit', datei: 'sw-erstbesuch.test.mjs', args: [], env: { BROWSER: 'webkit', NETZ: 'fast3g' }, exklusiv: 'Zeitgrenze der Installation', was: 'Erstbesuch Fast 3G (WebKit): Installation unter 28 s, danach offline' },
  { name: 'sw-kern', datei: 'sw-kern.mjs', args: [], was: 'KERN in sw.js deckt jede Datei, die ohne Netz gebraucht wird' },
  { name: 'alle-auswahl', datei: 'alle-auswahl.test.mjs', args: [], was: 'alle.mjs: unbekannter Name in --nur bricht ab, "kommt noch" sichtbar, keine verwaiste Testdatei' },
  // bis 19.11.2026 verwaist (lief in keiner Suite, Inventur fc-18:11 Zusatz 11)
  { name: 'heim', datei: 'heim.test.mjs', args: [], was: 'Startseite heim: Buehne, Als Naechstes, drei Wege, ohne Scrollen auf dem iPad, hell und dunkel (Browser)' },
  { name: 'brettgroesse', datei: 'brettgroesse.test.mjs', args: [], was: 'Brettbreite in Analyse und Partie ueber festen Untergrenzen (Browser)' },
  { name: 'seitenfehler-stelle', datei: 'seitenfehler-stelle.test.mjs', args: [], was: 'Seitenfehler nennen die erste Code-Stelle; Worker-Wechsel-Abbruch nur fuer die eigene Adresse still' },
  { name: 'thema', datei: 'thema.test.mjs', args: [], was: 'Theme-Fundament: Tokens, hell/dunkel, Schriften, Lesbarkeit' },
  { name: 'info-lizenzen', datei: 'info-lizenzen.test.mjs', args: [], was: 'Info und Lizenzen: jede Fremdlizenz und der eigene Quellcode in DE und EN, Herkunft Kuerbis/Frost/Gold, jeder Figurensatz mit Herkunftszeile (Teil 1b), Gold und Elfenbein als bearbeitetes cburnett (Browser)' },
  // kommtMit: die Datei kommt erst mit diesem Zweig; bis dahin steht die Suite sichtbar als "kommt noch" da (fc-18:11, Punkt 4)
  { name: 'r20-start-befunde', datei: 'r20-start-befunde.test.mjs', args: [], kommtMit: 'so/R20-start-befunde', was: 'Feinschliff R20: Einfuehrung zaehlt alle Seiten, Befunde 1 und 2 aus dem fable-check 19.11. (Browser)' },
  { name: 'r20-fable-rest', datei: 'r20-fable-rest.test.mjs', args: [], kommtMit: 'so/R20-fable-rest', was: 'fable-check 19.11.: Befunde 10, 11, 14 und 15 (Analyse am Handy u. a., Browser)' },
  { name: 'en-rest', datei: 'en-rest.test.mjs', args: [], kommtMit: 'so/R20-en-rest', exklusiv: 'Browser-Durchgang (iPhone 13 + PC, 32 Seiten)', was: 'Gast mit Sprache EN: keine deutschen Reste, Umlaute, Schluessel, undefined oder abgeschnittenen Zeilen auf Heim, Partie, Ergebnis, Analyse, Zu zweit, Duell, Lektionen, Erste Schritte 1 und 6, Liga, Einstellungen; Premium/Shop nur melden' },
  { name: 'r20-kurs-zurueck', datei: 'r20-kurs-zurueck.test.mjs', args: [], kommtMit: 'so/R20-fable-rest', was: 'Feinschliff R20 (7b): Zurueck im Kurs' },
  { name: 'r20-coach-buch', datei: 'r20-coach-buch.test.mjs', args: [], kommtMit: 'so/R20-coach-buch', was: 'Feinschliff R20 (43): Coach-Buch' },
  { name: 'r20-buch-luecken', datei: 'r20-buch-luecken.test.mjs', args: [], was: 'Feinschliff R20 (43): 41 bekannte Linien aus lichess im Eroeffnungsbuch, deutsch und englisch benannt' },
  { name: 'r20-lernen-gegner', datei: 'r20-lernen-gegner.test.mjs', args: [], was: 'Feinschliff R20: Lektionen mit Gegner gelten nach einem ruhigen falschen Zug nicht als geschafft (Halten-Regeln nur fuer halten)' },
  { name: 'r20-sieg-frei-genau', datei: 'r20-sieg-frei-genau.test.mjs', args: [], was: 'Feinschliff R20: Sieg ohne Sterne (freie Partie, Kurs Kapitel 6) zeigt die Genauigkeit statt eines leeren Rahmens' },
  { name: 'r23-ipad-blatt', datei: 'r23-ipad-blatt.test.mjs', args: [], was: 'Feinschliff R23: Knopf Fertig im Sammlungs-Blatt ganz sichtbar ueber der Unterkante (iPad, Handy, PC)' },
  { name: 'r22-tastatur', datei: 'r22-tastatur.test.mjs', args: [], was: 'Tastatur/Vorleser: Fokus nach Ich-Blatt zurueck, Coach aufklappbar, Knoepfe benannt (PC + iPhone 13)' },
  { name: 'r24-coach-verloren', datei: 'r24-coach-verloren.test.mjs', args: [], was: 'Flos Ja R24: Coach in klar verlorener Lage hoechstens Ungenau, Patzer beim Kippen bleibt' },
  { name: 'r24-koord-kontrast', datei: 'r24-koord-kontrast.test.mjs', args: [], was: 'Flos Ja R24: Brett-Koordinaten mindestens 4,5:1 auf allen Brettern, hell und dunkel, mit Schatten' },
  { name: 'r24-raetsel-tr0101', datei: 'r24-raetsel-tr0101.test.mjs', args: [], was: 'Flos Ja R24: tr-0101 hat genau eine gewinnende Loesung' },
  { name: 'r24-mattbilder-tablebase', datei: 'r24-mattbilder-tablebase.test.mjs', args: [], was: 'Flos Ja R24: Matt in N der Mattbilder gleich der Tablebase (offline)' },
  { name: 'r25-paket2-grenzen', datei: 'r25-paket2-grenzen.test.mjs', args: [], was: 'Paket 2 unter Extremdaten: Season-Chips der Visitenkarte nie abgeschnitten (Ich, Lobby 320/641 px), kurze Titel einzeilig' },
  { name: 'r26-antworten-b', datei: 'r26-antworten-b.test.mjs', args: [], was: 'Flos Antworten 6-9 (20.11.): Shop-Namen eigen, Google offline gesperrt, iPad quer gefuellt (Handy/PC gleich), Auge nach dem Startfokus' },
  { name: 'r26-konto-rest', datei: 'r26-konto-rest.test.mjs', args: [], was: 'Konto-Rest R26: Loeschseite Google offline gesperrt mit Hinweis, online frei; Einstellungen stapeln keine Netz-Listener (Browser)' },
  { name: 'r26-antworten-a', datei: 'r26-antworten-a.test.mjs', args: [], was: 'Flos Antworten 20.11.: Revanche nach Niederlage, freie Partie ohne Punktezeile, Lernen ein Hauptknopf, lange Grundmatts als Frage, Engine-Text ohne Internet (DE/EN)' },
  { name: 'r20-shop-gast', datei: 'r20-shop-gast.test.mjs', args: [], kommtMit: 'so/R20-fable-rest', was: 'Feinschliff R20 (7b): Shop-Gastkarte' },
  { name: 'r20-vorrat-en', datei: 'r20-vorrat-en.test.mjs', args: [], kommtMit: 'so/R20-fable-rest', was: 'Feinschliff R20 (7b): jedes Vorrat-Stueck hat name_en' },
  { name: 'r20-kurs-sterne', datei: 'r20-kurs-sterne.test.mjs', args: [], kommtMit: 'so/R20-fable-rest', was: 'Feinschliff R20 (7b): Sterne im Kurs' },
  { name: 'bot-grenze', datei: 'bot-grenze.test.mjs', args: [], kommtMit: 'so/R19-bot-grenze', was: 'Bots 1600 bis 2100: Grenze gegen grobe Fehler (Engine-Attrappe, feste Seeds)' },
  { name: 'r19-figuren-gold', datei: 'r19-figuren-gold.test.mjs', args: [], was: 'Labor-Figuren Gold und Elfenbein: 12 eigene Dateien mit fester Pruefsumme, Eintraege und Herkunft, auf jedem Brett Kante ab 3:1 und Weiss/Schwarz ab 25 L* (Browser)' },
  { name: 'r18-botschutz-link', datei: 'r18-botschutz-link.test.mjs', args: [], was: 'Bot-Schutz-Hinweis der Anmeldung: Link "Mehr dazu" >= 44 px und an 9 Punkten genau getroffen, 7 Groessen hell und dunkel (Browser)' },
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
  { name: 'bretter-65', datei: 'bretter-65.test.mjs', args: [], was: '65 Bretter: Katalog, Gleichlauf mit tokens.css, Kontrast und Figuren-Lesbarkeit, Glanz nur ohne weniger Bewegung' },
  { name: 'bretter-oberflaechen', datei: 'bretter-oberflaechen.test.mjs', args: [], was: 'Brett-Oberflaechen: Seltenheit gewoehnlich, Oberflaeche je seltenem Brett, Farbabstand, Kontrast mit Oberflaeche, Feldausschnitt im Browser' },
  { name: 'bretter-v3', datei: 'bretter-v3.test.mjs', args: [], was: 'Motiv-Bretter Fassung 3 (Entwurf): 20 Motive, Helligkeitsbaender, Kontrast am echten Brett, Bewegung nur ohne weniger Bewegung' },
  { name: 'bretter-v4', datei: 'bretter-v4.test.mjs', args: [], was: 'Motiv-Bretter Fassung 4: 20 Motive, Textur je Feld, Feld 3,0, Textur 1,15, Koordinaten 3,0, Bewegung nur am Rahmen' },
  { name: 'bretter-v4-app', datei: 'bretter-v4-app.test.mjs', args: [], was: 'Motiv-Bretter in der App: Katalog nur Erfinder, Rahmen in Bot/Online/Zu zweit/Raetsel-Duell, Handy ohne Rahmen, Sammlung' },
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
  // ersetzt tests/webkit.test.mjs (fc-18:11 Zusatz 12): dieselbe Partie wie e2e auf dem iPhone 13, in CI auch unter WebKit
  { name: 'e2e-iphone', datei: 'e2e.test.mjs', args: ['--iphone', '--ohne-bilder'], exklusiv: 'Browser-Zeitfenster unter CPU-Last', was: 'Sieg gegen Lukas, Analyse, Verlauf, Einstellungen auf dem iPhone 390' },
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
  { name: 'r19-online', datei: 'r19-online.test.mjs', args: [], was: 'Feinschliff R19: Online abgemeldet Konto-Hinweis unter den Tueren und ungestreckt, angemeldet Liga, Tueren, Freunde, Tueren-Ueberzeile mind. 12 px (Browser)' },
  { name: 'r19-online-weg', datei: 'r19-online-weg.test.mjs', args: [], was: 'Feinschliff R19: KI-Ersatz mit Duell-Intro (Online-Seite und Labor-Lobby), Kopf Online gewertet 5 + 3, Spielerleisten ohne Streifen und ohne Abschneiden (4 Geraete), Umschalter Online fuehrt zur echten Seite (Browser)' },
  { name: 'r19-online-ruhig', datei: 'r19-online-ruhig.test.mjs', args: [], was: 'Feinschliff R19: Online ruhiger (Entwurf A einzig), eine Zahl (Server-Elo) oder Liga als Wort, Tuertexte sichtbar oder in Mehr, Leisten nur Name (Browser)' },
  { name: 'r20-online-handy', datei: 'r20-online-handy.test.mjs', args: [], was: 'Feinschliff R20 B1: Online abgemeldet am iPhone 13 ohne leere Mittelreihe zwischen den Tueren, sonst Fingerabdruck gleich der Basis (Browser)' },
  { name: 'r19-welten-sehen', datei: 'r19-welten-sehen.test.mjs', args: [], was: 'Feinschliff R19: alle Bot-Welten zu sehen, noch nicht offene Welt ohne Schloss und nicht startbar, spielbar nach dem Endgegner davor (4 Geraete, hell/dunkel, Browser)' },
  { name: 'r19-avatar-modern', datei: 'r19-avatar-modern.test.mjs', args: [], was: 'Feinschliff R19: jeder Bot zeigt in jeder Ansicht das moderne Portraet (Zuordnung ueber avatarVon, Node)' },
  { name: 'r19-uhr', datei: 'r19-uhr.test.mjs', args: [], was: 'Feinschliff R19: Schachuhr in Bot- und KI-Partie (Kern: Abzug, Zuschlag, Pause, Zeitende, Fortsetzen aus zeiten, Wanduhr gewertet, Remis ohne Mattmaterial)' },
  { name: 'r19-arena-figur', datei: 'r19-arena-figur.test.mjs', args: [], was: 'Feinschliff R19: eigene Figur in der Bot-Welt bei jeder Stufe und fertiger Welt frei neben ihrer Station (iPhone 13, iPad, PC, Browser)' },
  { name: 'r19-botwelt-leben', datei: 'r19-botwelt-leben.test.mjs', args: [], was: 'Bot-Welt lebendig: Handy B (ganze Welt, Gegner als Leiste), Weltname als Plakette mit Wappen, je Welt ein ruhiges Element (reduced-motion still)' },
  { name: 'r19-arena-karte-klein', datei: 'r19-arena-karte-klein.test.mjs', args: [], was: 'Arena kleine Handys: Spielen-Knopf zu und offen ganz sichtbar (SE 320/375, iPhone 13), Groessenwechsel 1280/1024 -> 375 -> zurueck stellt die Lage richtig' },
  { name: 'r19-sterne', datei: 'r19-sterne.test.mjs', args: [], was: 'Bewertungs-Sterne app-weit: verdient >= 3:1 und golden, nicht verdient als Umriss >= 3:1 (Arena, Steckbrief, Ziele, Lernen, Verlauf, Analyse, Ergebnisblatt), SE/iPhone 13/iPad/PC hell und dunkel' },
  { name: 'r17-kopf', datei: 'r17-kopf.test.mjs', args: [], was: 'Feinschliff R17: Kopf-Knoepfe (Premium, rund) in Ruhe, Zeiger, Fokus, gedrueckt lesbar, Zeiger nur bei hover:hover, Handy ohne haengenden Zustand (Browser)' },
  { name: 'r18-hover-rest', datei: 'r18-hover-rest.test.mjs', args: [], was: 'Feinschliff R18: Einstellungen-Navigation und Kopf-Chips am Handy nach dem Tippen wie in Ruhe, Zeiger nur bei hover:hover (Browser)' },
  { name: 'r18-rd-hover', datei: 'r18-rd-hover.test.mjs', args: [], was: 'Feinschliff R18: Knoepfe des Raetsel-Duells (Start, Ende) am Handy nach dem Tippen wie in Ruhe, Zeiger nur bei hover:hover, Kontrast in vier Zustaenden mind. 4,5:1 (Browser)' },
  { name: 'r19-gegnerkarte', datei: 'r19-gegnerkarte.test.mjs', args: [], was: 'Feinschliff R19 M6: Tipp auf den Gegner oeffnet sein Profil (zwei Sitzungen, Partie laeuft weiter, Verlauf, ohne Karte)' },
  { name: 'r19-rand-handy', datei: 'r19-rand-handy.mjs', args: [], was: 'Feinschliff R19: Brett mit Koordinaten am Rand ragt auf 6 Geraeten nicht ueber Sockel oder Seite, auch nach Brettwechsel in der Partie (<= 0,5 px) (Browser)' },
  { name: 'r19-effekt-ebene', datei: 'r19-effekt-ebene.mjs', args: [], was: 'Feinschliff R19: mit jedem Motiv-Brett deckt sich die Effekt-Ebene auf 5 Geraeten (ecke/rand) auf 0,5 px mit dem Brett, nie breiter, kein Ueberlauf (Browser)' },
  { name: 'r19-start-naechstes', datei: 'r19-start-naechstes.test.mjs', args: [], was: 'Feinschliff R19: Start "Als Naechstes" mit eigenem Gesicht je Zeile (Farbe, Bildstueck) und wahrem Fortschritt (Marsch, Raetsel-Tage, faellige Fehler, Liga-Wappen und Abstand), Hoehe SE und PC (Browser)' },
  { name: 'r19-benutzername', datei: 'r19-benutzername.test.mjs', args: [], was: 'Feinschliff R19: gemerkter Benutzername wird einmal je Start mit dem Server abgeglichen, ohne Server bleibt er (Browser)' },
  { name: 'r27-name-haken', datei: 'r27-name-haken.test.mjs', args: [], was: 'Feinschliff R27: Benutzername beim Tippen pruefen, Rueckfrage in der App, gruener Haken, 30-Tage-Sperre grau mit Tagen, ohne SQL wie vorher (Browser)' },
  { name: 'r19-analyse-neu', datei: 'r19-analyse-neu.test.mjs', args: [], was: 'Feinschliff R19: Analyse neu (Schluesselmomente als Karten oben, Symbole gross, Verlauf ohne Kleintext, Ergebnis-Karte, Tempo, Auto-Abspielen) (Browser)' },
  { name: 'r19-verlauf-neu', datei: 'r19-verlauf-neu.test.mjs', args: [], was: 'Feinschliff R19: Verlauf neu (Partien ohne Zug als eine Zeile, Ergebniszeichen, Zu-zweit-Bild, leiser Muelleimer, eine Staerke-Zahl, Level-Karte im Rahmen)' },
  { name: 'r20-kopf-chip', datei: 'r20-kopf-chip.test.mjs', args: [], was: 'Feinschliff R20 B3: Kopf-Chips ganz da oder ganz weg, nie ein Stummel; / max nur am PC' },
  { name: 'r20-blatt-fokus', datei: 'r20-blatt-fokus.test.mjs', args: [], was: 'Feinschliff R20 B7: Blatt per Tipp ohne Fokusring, per Tastatur mit; Rueckfrage fokussiert den sicheren Knopf' },
  { name: 'r20-effekt-vorschau', datei: 'r20-effekt-vorschau.test.mjs', args: [], was: 'Feinschliff R20: Regal Effekte im Shop, Vorschau einmal auf dem echten Brett an der richtigen Stelle, Standbild bei weniger Bewegung' },
  { name: 'r20-erste-schritte', datei: 'r20-erste-schritte.test.mjs', args: [], was: 'Feinschliff R20: Kurs Erste Schritte fuer Anfaenger (Stufe A): Sterne sammeln mit Umwandlungs-Falle, gut anfangen, Einstieg ueber "Nein", 10 Funken je Aufgabe' },
  { name: 'r25-leistung', datei: 'r25-leistung.test.mjs', args: [], was: 'Feinschliff R25 Leistung: Fokus und Messen beim Oeffnen im naechsten Bild, Pille nach dem Drehen, schnelles Enter oder Leerzeichen im ersten Bild gibt nicht auf (Browser)' },
  { name: 'online-ende', datei: 'online-ende.test.mjs', args: [], was: 'Funktionsprobe Online-Ende: Revanche, Aufgeben, Remis, Neu laden (Browser)' },
  { name: 'r25-brett-fokus', datei: 'r25-brett-fokus.test.mjs', args: [], was: 'R25 Tastatur-Fokus auf dem Brett sichtbar, Rahmen und Koordinaten (Browser)' },
  { name: 'r25-brett-start', datei: 'r25-brett-start.test.mjs', args: [], was: 'R25 Brett beim Start der Partie sofort in voller Groesse (Browser)' },
  { name: 'r25-coach-kopf-offen', datei: 'r25-coach-kopf-offen.test.mjs', args: [], was: 'R25 Coach-Kopf als Schalter: Tippflaeche zu und offen mindestens 44 px (Browser)' },
  { name: 'r25-datenschutz-tippflaeche', datei: 'r25-datenschutz-tippflaeche.test.mjs', args: [], was: 'R25 Link Datenschutzerklaerung vor dem Alters-Haken gross genug (Browser)' },
  { name: 'r25-eroeffnung-index', datei: 'r25-eroeffnung-index.test.mjs', args: [], was: 'R25 F1 Leistung: Eroeffnungs-Index beim Start der Bot-Partie nur einmal' },
  { name: 'r25-offline-rueckfall', datei: 'r25-offline-rueckfall.test.mjs', args: [], was: 'R25 Offline-Rueckfall: ohne Netz direkt nach einem Update startet die App (Browser)' },
  { name: 'r25-paket-css', datei: 'r25-paket-css.test.mjs', args: [], was: 'R25 Paket-CSS vor dem Aufbau des Screens geladen (Browser)' },
  { name: 'r25-zugliste', datei: 'r25-zugliste.test.mjs', args: [], was: 'R25 F4 Leistung: Zugliste nur geaenderte Zeilen neu bauen' },
];

// Sekunden aus einem seriellen --schnell-Lauf vom 29.10.2026. Unbekannte/neue Suiten
// bekommen den Median, damit sie ohne Aenderung an dieser Tabelle aufgenommen werden koennen.
const DAUERN = new Map([
  ['zeitwaechter', 4], ['konto', 0], ['online', 2], ['online-ui', 13], ['zuzweit', 15],
  ['daten', 12], ['server-abo', 0], ['abo', 33], ['server-coach', 29], ['coach-ki', 30],
  ['server-schule', 0], ['schule', 59], ['storage', 3], ['liga', 53], ['sicherung', 0],
  ['review', 2], ['ereignisse', 1], ['fairness', 1], ['spiel', 15], ['engine-bots', 104],
  ['board', 68], ['vorzuege', 17], ['sw', 0], ['sw-update', 40], ['brett-tastatur', 30], ['sw-cache', 0], ['sw-erstbesuch', 69], ['sw-erstbesuch-webkit', 145], ['sw-kern', 19], ['thema', 55], ['klang', 12],
  ['navigation', 39], ['ansicht', 150], ['arena', 154], ['funken', 124], ['punkte', 167], ['serie', 140],
  ['teilen', 35], ['gedaechtnis', 58], ['kartei', 62], ['sprache', 156], ['sprache-pakete', 225],
  ['tagesraetsel-daten', 2], ['tagesraetsel', 33], ['start', 151], ['app', 569], ['screens', 63],
  ['e2e', 111], ['native', 0], ['gegnersuche', 2],
  ['r19-lektionen-probe', 360], ['r19-lektionen-besser', 570], ['r19-lektionen-runden', 60], ['bot-grenze', 8],
  ['heim', 60], ['brettgroesse', 49], ['e2e-iphone', 24], ['offline-ladeprobe', 28], ['funktion-funken-aufgeben', 45], ['funktion-einstellungen-season', 10],
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
    if (suite.kommtMit) return { ...suite, code: 0, kommtNoch: true, sekunden: 0, ok: null, gesamt: null, fehler: [], ende: [] };
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
        // Eigene Umgebung je Eintrag (env:), z. B. PROBE_STRENG fuer eine Probe, deren harte Pruefungen schon zaehlen sollen
        ...(suite.env || {}),
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

// ein unbekannter Name in --nur ist ein Fehler, nie still uebergangen (fc-18:11, Punkt 5: "--nur=bot-grenze,spiel" meldete "1/1")
const unbekannt = NUR ? NUR.filter((n) => !SUITEN.some((s) => s.name === n)) : [];
if (unbekannt.length) {
  console.log(`Unbekannte Suite in --nur: ${unbekannt.join(', ')}. Namen: ` + SUITEN.map((s) => s.name).join(', '));
  process.exit(2);
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
  const status = e.kommtNoch ? 'NOCH  ' : e.code === 0 ? 'ok    ' : 'FEHLER';
  const zahl = e.gesamt != null ? `${e.ok}/${e.gesamt}` : '-';
  console.log(`${status} ${s.name.padEnd(12)} ${zahl.padStart(9)}  ${e.sekunden.toFixed(1).padStart(6)} s${e.kommtNoch ? `   kommt noch mit ${e.kommtMit} (tests/${e.datei} fehlt)` : ''}`);
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
const noch = ergebnisse.filter((e) => e.kommtNoch);
const gelaufen = ergebnisse.length - noch.length;
const summeOk = ergebnisse.reduce((a, e) => a + (e.ok || 0), 0);
const summe = ergebnisse.reduce((a, e) => a + (e.gesamt || 0), 0);
console.log('\nZusammenfassung');
console.log('Suite         Prüfungen    Zeit   Ergebnis');
for (const e of ergebnisse) {
  const zahl = e.gesamt != null ? `${e.ok}/${e.gesamt}` : '-';
  const ergebnis = e.kommtNoch ? `kommt noch mit ${e.kommtMit}` : e.code === 0 ? 'bestanden' : 'FEHLGESCHLAGEN';
  console.log(`${e.name.padEnd(12)} ${zahl.padStart(10)} ${(e.sekunden.toFixed(0) + ' s').padStart(7)}   ${ergebnis}`);
}
console.log(`\n${gelaufen - schlecht.length}/${gelaufen} Suiten bestanden${noch.length ? `, ${noch.length} kommt noch` : ''}, ${summeOk}/${summe} Prüfungen, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exit(schlecht.length ? 1 : 0);
