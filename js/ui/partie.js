// Partie: Brett gegen einen Bot mit Live-Bewertung jedes eigenen Zugs (Symbol, Lasur, Coach,
// Effekte je Klasse), Bewertungsbalken, Bot-Karte mit Sprechblase, Zugliste, Hinweis,
// Zuruecknehmen, Drehen, Aufgeben, Spielende-Erkennung, Auswertung und Ergebnis-Overlay.
// Params: { botId, farbe: 'w'|'b', fortsetzen?: true, startFen?, modus?: 'normal'|'uebung', ziel? }
// (startFen: Partie ab Stellung, dann ohne Eroeffnungsbuch; modus 'uebung' mit ziel { partieId, ply,
// besterZug, alterZug, alterSanDe, gewinnVorher } startet z. B. "Ab hier nochmal"). Partien, die nicht
// werten (Uebung oder eigene Stellung, storage.wertet), buchen nichts: das Ergebnis zeigt dann keine
// Sterne, den Chip "ÜBUNG" und "Nochmal ab hier" (gleiche Params).
// Test-Hooks (window.__partie, window.__test) nur mit ?test:
// __test = { botAnhalten, botZug(fen) -> uci, botPause, maxWarten (ms, Bot wartet auf die Bewertung),
//            mattHookWarten (ms, Warten des Matt-Hooks auf partie:beendet, sonst MATT_HOOK_WARTEN_MS) }.
//
// Runde 4 (Erweiterungspunkte, ARCHITEKTUR.md): sendet partie:gestartet (mit der Buehne, dazu wertet und der
// Stand von hinweise und zuruecknahmen beim Start), zug:gespielt,
// stellung:analysiert, zug:bewertet, zug:zurueckgenommen, hilfe:genutzt, partie:beendet,
// partie:analysiert und partie:verlassen. laufId = 'l' + gestartet. Wahl-Ort partie:begruessung?,
// DOM-Ort ergebnis:karte, Feier-Zeilen aus feier.fuerOverlay(). Die Buehne (eingefroren):
//   { laufId, bot, farbe, modus, ziel, el, effekte, rahmen, brett (nur lesen), reduziert,
//     feld(feld) -> { x, y } | null           0..7 in der aktuellen Brett-Ausrichtung (wie die Effekte)
//     liveAn() -> boolean, phase() -> 'start' | 'flo' | 'gezogen' | 'bot' | 'ende',
//     coachZusatz(inhalt, { prio = 50, art = 'info', bleibt = false }) -> HTMLElement   Zeile unter dem
//         Coach-Satz (art 'info' | 'gut' | 'leise' | 'gross'; Text oder Element); hoechstens 2, die hoehere
//         prio gewinnt (bei Gleichstand die aeltere); verschwindet mit dem naechsten Coach-Inhalt; im
//         eingeklappten Coach versteckt; bleibt: true haelt den Coach offen, solange die Zeile da ist
//     blase(anlass, { paar, prio = 50, werte }) -> boolean   Sprechblase, eine je Zugpaar (paar:
//         Standard ist Flos letzter Ply), hoehere prio ersetzt eine niedrigere
//     merke(paket, daten) -> boolean, gemerkt(paket) -> Kopie | null   landet in partie.extra (alle
//         Pakete zusammen hoechstens EXTRA_MAX Zeichen als JSON; null loescht den Eintrag)
//     spaeter(fn, ms) -> Timer, den verlasse() abraeumt }
//   Nach partie:verlassen tut die Buehne nichts mehr.
// COMBO: Serie aus Präzise, Goldrichtig und Genial; neutral sind Buch, Pflichtzug und triviale Zuege
// (Zurueckschlagen, erzwungene Schachabwehr), solange sie nichts verschenken. Der Chip traegt
// data-stufe ('' bei 3 bis 4, 'heiss' 5 bis 7, 'ueberladen' 8 bis 11, 'unaufhaltsam' ab 12), der Screen
// data-serie (laufende Serie) und data-serie-stufe.
//
// W0+a "Spiel-Fundament" (SPIELKONZEPT 6.2, ARCHITEKTUR.md "W0+a: Spiel-Fundament"):
//   Params zusaetzlich: modus 'boss' | 'frei' | 'spiel' (werten nie), boss { id, stufe, woche, staerke } (Modus boss),
//   seed (sonst neu gewuerfelt), liga { saison, runde }. Angemeldete Bots (registriereBot) gehen wie Leiter-Bots;
//   ihre startFen gilt, wenn die Params keine nennen. Der Datensatz traegt seed, boss, liga (tempo und zeiten
//   bringt W0+b). Bot-Zuege: zufall = tag.zugZufall(seed, ply), nodes und vorliebe aus dem Bot-Profil.
//   Modus boss: Kopf mit Boss-Name und Stufe, Unterzeile mit der Regel, keine Sterne, im Ergebnis der Chip "BOSS"
//   und "Nochmal" (gleiche Params, neuer Seed). frei/spiel: Chip "FREI"/"SPIELHALLE". boss.staerke (offen angesagte
//   Zahl, z. B. 1080): der Boss spielt mit bots.staerkeFuerElo(staerke), Kopf "Name · Stufe ≈ 1080".
//   DOM-Ort partie:gegner-leiste: .ort-gegner-leiste ueber dem Gegner (quer: erstes Kind von .botbox, hoch: erstes
//   Kind von .botleiste-hoch; das Element wandert beim Drehen des Geraets mit). Einmal beim Start gefuellt,
//   Kontext { app, buehne, bot, farbe, modus, boss, lage() -> 'hoch' | 'quer' }, ohne Anbieter versteckt.
//   Aufruf-Ort partie:matt (Finisher): bei Matt, nach dem Speichern und nach partie:beendet, vor dem Ergebnis.
//   Kontext { app, buehne, laufId, partieId, ergebnis, gewinner: 'flo' | 'bot', koenigFeld, letzterZug { von,
//   nach, san, figur }, fen, reduziert, signal, dauerMs, kurzMs }. Liefert ein Anbieter { fertig: Promise },
//   wartet das Ergebnis darauf, hoechstens feier.BRETT_FEIER.dauerMs (1,8 s); ein Tipp irgendwo auf den Screen
//   bricht ab (signal, gilt schon ab dem Mattzug), danach kommt sofort das Ergebnis. Ohne Anbieter aendert sich am
//   Ablauf nichts. Laeuft ein Finisher, entfaellt der Klassen-Effekt des Mattzugs (der Finisher ersetzt jeden
//   Brett-Effekt); liefern alle Anbieter null, kommt der gemerkte Effekt doch.
//   zug:abgelehnt { laufId, von, nach, art, figur, fen }: aus board.js beiAbgelehnt, nur wenn Flo am Zug ist.
//   ergebnis:karte-Kontext zusaetzlich boss; die Abrechnungs-Huelle (ergebnis:abrechnung) haengt sich dort mit
//   Reihenfolge 3 ein (js/ui/abrechnung.js).
//   Buehne zusaetzlich: boss (eingefroren oder null), seed, zeigt(name) -> boolean fuer die Anzeigen
//   'zaehlwerk' | 'funkenlinie' | 'lebensleiste' | 'balken' (Einstellungen der App), platz(name) -> HTMLElement
//   fuer 'zaehlwerk' (.p-zaehlwerk im Kopf) und 'funkenlinie' (.p-funkenlinie unten am Brett-Rahmen); der Platz
//   ist versteckt, solange die Einstellung aus ist, und folgt ihr. Nach partie:verlassen: platz -> null.
//   Boss-Partie mit einer Gegner-Leiste (Anbieter da) und Anzeige lebensleiste an: kein Bewertungsbalken
//   (.ohne-balken wie bei Balken aus; "Lebensleiste statt Balken", SPIELKONZEPT 3.18).
//
// w0plus-a-fix (Befunde des W0+a-Pruefers):
//   Boss-Staerke: Kopf, Bot-Zeile und Spielanalyse nennen die Elo des Profils, mit dem der Boss wirklich spielt
//   (staerkeFuerElo(boss.staerke).elo, vor der Eichung z. B. "≈ 1000" fuer die Anfrage 1080); boss.staerke bleibt als
//   Anfrage im Datensatz. Partien gegen angemeldete Bots werten nie (storage.wertet mit botId): Chip "GAST" bzw.
//   "BOSS", "Nochmal" statt "Nächster Gegner".
//   Matt-Hook: wartet hoechstens MATT_HOOK_WARTEN_MS (300 ms) auf partie:beendet (vorher bis 3 s); dauert die
//   Live-Bewertung des Mattzugs laenger, kommt partie:beendet waehrend des Finishers.
//   Gegner-Leiste im Hochformat: erstes eigenes Kind von .botleiste-hoch (eigene Zeile ueber Avatar und Namen, bleibt
//   sichtbar, waehrend der Bot spricht; vorher in .info, das auf dem Handy mit der Sprechblase verschwand).
//   DOM-Ort partie:spieler-leiste: .ort-spieler-leiste an Flos Namen (quer in .spieler-quer, hoch in .spieler-hoch,
//   wandert beim Drehen mit), z. B. Flamme des Siegeslaufs oder Level; Kontext wie partie:gegner-leiste. Eine Zeile,
//   nicht hoeher als der Name. Ohne Anbieter versteckt.
//   DOM-Ort partie:aktionen: .ort-aktionen in der Knopfreihe vor "Aufgeben" (z. B. Emote-Rad, Schnell-Chat),
//   hoechstens AKTIONEN_MAX (2) Knoepfe, die Reihe bekommt dafuer Spalten dazu (data-aktionen). Kontext { app,
//   buehne, bot, farbe, modus, boss }. Klicks binden die Pakete selbst. Ohne Anbieter aendert sich nichts.
//   zug:bewertet zusaetzlich gewinnVorigerZug: Flos Gewinnchance nach seinem vorigen eigenen Zug (also vor dem
//   letzten Bot-Zug), null beim ersten eigenen Zug oder ohne Bewertung. Damit rechnet S1-6 boss:treffer.
//   Antippen der Ergebnis-Karte zeigt auch die Abrechnung sofort ganz (.alles an Karte und Huelle).
//
// Premium-Umbau U7 (Look A, PLAN 2.4 bis 2.6, 3.7, 4; Optik in css/partie.css, css/ergebnis.css, Coach-Karte in
// css/bauteile.css):
//   Spielerkarten: eine Komponente .spieler fuer beide Lagen. Gegner: .spieler.gegner (Zusatzklassen .botbox,
//   .botleiste-hoch, .botkarte fuer Tests und Pakete), erstes Kind .ort-gegner-leiste, dann .av (Portraet ueber
//   thema.avatarVon), .info (.bot-name + Unterzeile .bot-meta mit Elo, .denkt-ort, .geschlagen-ort) und .uhr. Flo:
//   .spieler.ich (Zusatzklassen .spielerleiste, .spieler-quer, .spieler-hoch): .av (thema.floAvatar), .name, danach
//   .ort-spieler-leiste, Unterzeile, .uhr. Der Name wird nie mit "..." gekuerzt: passt er nicht in zwei Zeilen, steht
//   der Rufname da (RUFNAME), der volle Name im aria-label der Karte. .av der Karten sind die Ziele des Portraetflugs
//   im Duell-Intro (U5). lage() meldet weiter 'hoch' | 'quer'.
//   Uhr: .uhr in beiden Karten, versteckt ohne Bedenkzeit (z.tempo). fmtUhr(ms) (exportiert) formatiert, uhr.setze(wer,
//   ms, { laeuft }) zeigt an (laufend Tinte, unter 20 s .warn rot mit Uhr-Symbol und Sekundenpuls). Die Logik (Laufen,
//   Zuschlag, Zeitueberschreitung) bringt W0+b; bis dahin steht die Grundzeit still da.
//   Sprechblase: .blase-ort ist das letzte Kind der Gegner-Karte (quer eine Zeile in der Karte unter dem Namen, hoch
//   haengt die kleine Blase unter der Karte ueber dem Brett) und blendet nach BLASE_MS (3,5 s) aus. Einstellung
//   sprueche: 'aus' zeigt keine Blase (buehne.blase() liefert false), 'wenig' nur Begruessung, Ende und hoechstens
//   einen Satz je 5 eigene Zuege.
//   Handy (hoch, bis 600 px): layout() rechnet "Brett zuerst" (PLAN 2.5): g = floor((Breite - 2 x 10 - Sockel) / 8) x 8,
//   der Coach schrumpft bei Platznot auf eine Zeile (.coach-eng, Rest auf Antippen), das Brett erst danach (nie unter
//   280 px); der Zugstreifen steht ab 760 px Hoehe zwischen Coach und Knoepfen, darunter nach den Knoepfen (die Spalte
//   scrollt). Der Bewertungsbalken liegt dort waagrecht ueber dem Brett (Zahl nur auf Antippen).
//   Komfort (Einstellungen, wirken sofort ueber schach:einstellungen): zugBestaetigen ('ohneUhr': nur ohne Bedenkzeit,
//   'immer', 'aus'; nur fuer echte Zuege, nie fuer Vorzuege), haltenAufgeben (Aufgeben ueber bauteile.halteKnopf: 1 s
//   halten; Tastatur und Bedienhilfen bekommen die Rueckfrage app.frage wie bei "aus"), turmRochade, autoDame,
//   steuerung, pfeile, koordinaten, koordLage, brett (Brettwahl im Kopf, nur iPad), klang (Kopf-Schalter), coachStil
//   ('knapp': erster Satz, Rest auf Antippen), sprueche, bewegung (Gleitdauer ueber tempo()).
//   Klang-Takt (PLAN 3.7): der Zugklang sitzt auf der Landung (klang.zug({ wann })), der Bewertungsklang 150 ms danach,
//   nur einer je Moment (Schach und Umwandlung gehen vor Praezise/COMBO). Grosser Moment nur bei Genial: Feld-Puls,
//   Ring, 8 Funken, Lichtstreif, Brett hebt sich 1,2 % (.brett-rahmen.prisma), Klassenwort als Pille, COMBO in der
//   Klassenfarbe (alles in .brett-effekte, nur transform und opacity). Grobe Fehler bleiben ruhig.
//   Duell-Vertrag (U5): steht beim Start html[data-duell="laeuft"], ziehen Bot (und spaeter die Uhr) erst nach dem
//   DOM-Ereignis duell:fertig auf document, hoechstens DUELL_MAX_MS (1,4 s).
//   Ergebnis (2.6): Schleier ohne Weichzeichner, der Screen dahinter tritt zurueck (.mit-ergebnis), "Sieg!" mit
//   goldenem Ausrufezeichen, Sterne als Symbole nacheinander (klang.stern), kein Konfetti, Niederlage ruhig mit
//   Lichtblick-Karte (.erg-lichtblick: Flos bester Zug aus den Live-Klassen, nur wenn ergebnis:karte leer bleibt),
//   Remis gold-neutral.
import { Chess } from '../../vendor/chess/chess.js';
import { Brett, zielKarte, symbolSvg } from '../board.js';
import { BOTS, botNachId, botZug, botSatz, staerkeFuerElo } from '../bots.js';
import { zugZufall } from '../tag.js';
import {
  bewerteZug, analysierePartie, klassifiziere, gewinnChance, sanDeutsch, materialBilanz, seitenGenauigkeit, warKnapp, coachKern,
} from '../review.js';
import { eroeffnung, stellungsSchluessel } from '../openings.js';
import { klang, klassenKlang } from '../sounds.js';
import { anim, tempo, taktFaktor } from '../bewegung.js';
import { halteKnopf } from './bauteile.js';
import {
  speichereLaufendePartie, ladeLaufendePartie, loescheLaufendePartie, speicherePartie, ergaenzeAnalyse, aktualisierePartie,
  ladePartien, GENAUIGKEIT_STERN, MODI, EXTRA_MAX, wertet, pruefeSeed, pruefeBoss, pruefeLiga, pruefeTempo, pruefeZeiten,
} from '../storage.js';
import { sende } from '../ereignisse.js';
import { fuelle, waehle, angeboten } from '../orte.js';
import { fuerOverlay, BRETT_FEIER } from '../feier.js';
import './abrechnung.js';
import { iconNamen } from './icons.js';
import { icon } from '../app.js';
import { botFarbe as themaBotFarbe, avatarVon, floAvatar } from '../thema.js';
import { KLASSEN_NAME, KLASSEN_WORT } from '../zugklassen.js';


const SERIE = new Set(['bester', 'stark', 'brillant']);
const NEUTRAL = new Set(['buch', 'erzwungen']);
const MIT_VERLUST = new Set(['ungenau', 'fehler', 'verpasst', 'patzer']);
const SCHLECHT = new Set(['fehler', 'verpasst', 'patzer']);
const WERT = { q: 9, r: 5, b: 3, n: 3, p: 1 };
const GRUND_TEXT = {
  matt: 'Schachmatt', aufgabe: 'Aufgabe', patt: 'Patt', wiederholung: 'Dreifache Stellungswiederholung',
  '50-zuege': '50-Züge-Regel', material: 'Zu wenig Material zum Mattsetzen',
};
const FARBE_NAME = { w: 'Weiß', b: 'Schwarz' };
// Live-Bewertung: hoechstens so lange je Stellung; warten schon zwei Stellungen (Flo zieht
// zuegig), nur noch kurz rechnen, damit sich nichts staut (die Analyse rechnet genauso)
const LIVE_MAX_MS = 5000;
const LIVE_STAU_MS = 1500;
// So lange wartet das Ergebnis auf die Auswertung, dann erscheint es schon ohne Genauigkeit
const AUSWERTUNG_WARTEN_MS = 2500;

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const jetzt = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const komma = (x, n = 1) => x.toFixed(n).replace('.', ',');
// tiefe Kopie einfacher Daten (Params, extra), sonst null
const kopie = (x) => { try { return x == null ? null : JSON.parse(JSON.stringify(x)); } catch (e) { return null; } };
const ZUSATZ_ARTEN = ['info', 'gut', 'leise', 'gross'];
// W0+a: Chip im Ergebnis nicht wertender Partien je Modus, Name der Boss-Stufe, Anzeigen der Buehne
const MODUS_CHIP = { uebung: 'ÜBUNG', boss: 'BOSS', frei: 'FREI', spiel: 'SPIELHALLE' };
const STUFE_NAME = { standard: 'Standard', meister: 'Meister' };
const ANZEIGEN = ['zaehlwerk', 'funkenlinie', 'lebensleiste', 'balken'];
// neuer Seed fuer die Bot-Zuege einer Partie (32 Bit)
const neuerSeed = () => Math.floor(Math.random() * 4294967296) >>> 0;
const ZUSATZ_MAX = 2;
const PAKET_NAME = /^[a-z][a-z0-9-]{0,30}$/;
// w0plus-a-fix: so lange wartet der Matt-Hook hoechstens auf partie:beendet (die Live-Bewertung des Mattzugs)
const MATT_HOOK_WARTEN_MS = 300;
// w0plus-a-fix: hoechstens so viele Knoepfe der Pakete in der Knopfreihe (Ort partie:aktionen)
const AKTIONEN_MAX = 2;
// U7: Rufnamen fuer sehr lange Namen (Spielerkarte, Kopf auf dem Handy); der volle Name steht im aria-label
const RUFNAME = Object.freeze({
  benno: 'Benno', hilde: 'Hilde', kalle: 'Kalle', lisa: 'Lisa', rudi: 'Rudi', turm: 'Prof. Turm', delia: 'Delia',
  koenig: 'Kommissar', greta: 'Greta', stockfisch: 'Stockfisch',
});
const rufnameVon = (b) => RUFNAME[b && b.id] || (b && b.name) || '';
// U7: Brettwahl im Kopf (Feldfarben wie tokens.css, fest wie die Brettfarben selbst)
const BRETTER = Object.freeze([['nacht', 'Nacht', '#e4e8f6', '#7c87b6'], ['gruen', 'Grün', '#eeeed2', '#769656'], ['holz', 'Holz', '#f0d9b5', '#b58863']]);
// U7: Sprechblase blendet nach 3,5 s aus (Begruessung etwas laenger, sie kommt vor dem ersten Zug)
const BLASE_MS = 3500;
const BEGRUESSUNG_MS = 6000;
// U7: Sprueche "wenig": hoechstens ein Satz je 5 eigene Zuege (10 Halbzuege)
const WENIG_ABSTAND = 10;
// U7: Duell-Intro (U5): so lange wartet die Partie hoechstens auf duell:fertig
const DUELL_MAX_MS = 1400;
// U7: Uhr wird unter 20 s rot (PLAN 2.4)
const UHR_WARN_MS = 20000;
// U7: Bewertungsklang so lange nach der Landung der Figur (PLAN 3.7)
const BEWERTUNG_NACH_MS = 150;
// U7: Gleitdauer der Figuren (--d-zug, mal Tempo ueber brett.gleitDauer())
const ZUG_MS = 300;
// U7: Handy-Layout (PLAN 2.5): Seitenrand neben dem Brett, kleinstes Brett, Hoehe fuer den Zugstreifen
const HANDY_RAND = 10;
const BRETT_MIN = 280;
const STREIFEN_AB = 760;
const UHR_SYMBOL = '<svg class="ico uhr-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '
  + 'stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/></svg>';

// U7: Bedenkzeit als Text: ab 20 s "M:SS" (aufgerundet), darunter "0:SS,z" (Zehntel), nie negativ
export function fmtUhr(ms) {
  const t = Math.max(0, Number(ms) || 0);
  if (t < UHR_WARN_MS) {
    const s = Math.floor(t / 1000);
    return `0:${String(s).padStart(2, '0')},${Math.floor((t % 1000) / 100)}`;
  }
  const s = Math.ceil(t / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Stufe der COMBO (Chip data-stufe): leer bei 3 bis 4, dann heiss, ueberladen, unaufhaltsam
function serienStufe(n) {
  if (n >= 12) return 'unaufhaltsam';
  if (n >= 8) return 'ueberladen';
  if (n >= 5) return 'heiss';
  return '';
}

// Bewertung als Text aus Sicht von farbe: "+1,2", "−0,4", "M3", "−M2"
function evalText(ev, farbe) {
  if (!ev) return '';
  if (ev.mate != null) {
    const m = farbe === 'b' ? -ev.mate : ev.mate;
    return (m < 0 ? '−M' : 'M') + Math.abs(m);
  }
  // wie in der Analyse und im Coach-Text gerundet (Betrag auf eine Nachkommastelle)
  const cp = farbe === 'b' ? -ev.cp : ev.cp;
  const w = Math.round(Math.abs(cp) / 10) / 10;
  if (w === 0) return '0,0';
  return (cp > 0 ? '+' : '−') + komma(w);
}

export function zeige(root, params, app) {
  // U7: reduziert = Systemwunsch ODER Einstellung "Bewegung: aus" (PLAN 2.0, Buehne)
  const reduziert = (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) || tempo() === 0;
  const einst = app.einstellungen();

  // ---------- Partie bestimmen ----------
  let laufend = null;
  if (params && params.fortsetzen) {
    laufend = ladeLaufendePartie();
    if (laufend && params.botId && laufend.botId !== params.botId) laufend = null;
  }
  const bot = botNachId(laufend ? laufend.botId : params && params.botId) || null;
  if (!bot) {
    setTimeout(() => app.gehe('arena', {}, { ersetzen: true }), 0);
    return { verlasse() {} };
  }
  const farbe = (laufend ? laufend.spielerFarbe : params.farbe) === 'b' ? 'b' : 'w';
  const botFarbe = farbe === 'w' ? 'b' : 'w';
  let startFen = laufend ? laufend.startFen || null : (params.startFen || null);
  if (startFen) {
    try { new Chess(startFen); } catch (e) { startFen = null; }
  }
  const modus = laufend ? laufend.modus || 'normal' : (MODI.includes(params.modus) ? params.modus : 'normal');
  // W0+a: angemeldete Bots (z. B. ein Boss) bringen ihre Startstellung mit
  if (!laufend && !startFen && bot.stufe == null && bot.startFen) {
    try { new Chess(bot.startFen); startFen = bot.startFen; } catch (e) { /* ungueltig: Grundstellung */ }
  }
  const quelle = laufend || params;

  const z = {
    bot, farbe, startFen, modus,
    ziel: modus === 'uebung' ? kopie(laufend ? laufend.ziel : params.ziel) : null,
    extra: (laufend && kopie(laufend.extra)) || {},
    liveTrivial: [],   // je Ply: selbstverstaendlicher Zug (fuer die COMBO neutral)
    maxSerie: 0,
    blasePrio: 0,
    chess: startFen ? new Chess(startFen) : new Chess(),
    zuege: [], san: [], verbose: [], fens: [],
    live: [],          // je Ply: { marke, status: 'rechnet'|'fertig'|'fehler', erg, fertig: Promise, gezeigtUm }
    liveKlassen: [],
    hinweise: laufend ? laufend.hinweise || 0 : 0,
    zuruecknahmen: laufend ? laufend.zuruecknahmen || 0 : 0,
    gestartet: laufend ? laufend.gestartet : new Date().toISOString(),
    phase: 'start',
    hinweisFen: null, hinweisStufe: 0,
    blasePaar: undefined,
    botCtrl: null,
    ideeAn: null,
    gespeichert: false,
    // W0+a: Seed der Bot-Zuege (alte laufende Partien ohne Seed: Zufall wie vorher), Boss, Liga, Uhr
    seed: laufend ? pruefeSeed(laufend.seed) : (pruefeSeed(params.seed) ?? neuerSeed()),
    boss: modus === 'boss' ? pruefeBoss(quelle.boss) : null,
    liga: pruefeLiga(quelle.liga),
    tempo: pruefeTempo(quelle.tempo),
    zeiten: pruefeZeiten(laufend && laufend.zeiten),
    finisher: false,
    effektGemerkt: null,
    vorzuege: [],
    landung: [],       // U7: je Ply { name (Zugklang), um (Landung, performance.now) } fuer den Klang-Takt
  };
  z.fens.push(z.chess.fen());
  // W0+a: Boss mit offen angesagter Staerke (boss.staerke, z. B. 1080): gespielt wird mit staerkeFuerElo (vor der
  // Eichung der naechstliegende Leiter-Bot). Sonst das Profil des Bots. w0plus-a-fix: Kopf, Bot-Zeile und Analyse
  // nennen die Elo dieses Profils (vor der Eichung z. B. 1000 fuer 1080), nie die Anfrage (Fairness 12).
  const bossStaerke = z.boss && Number.isFinite(z.boss.staerke) ? staerkeFuerElo(z.boss.staerke) : null;
  const zugBot = bossStaerke ? Object.freeze({ ...bot, staerke: bossStaerke.staerke }) : bot;
  const botElo = bossStaerke ? bossStaerke.elo : bot.elo;
  // w0plus-a-fix: wertet nur gegen Leiter-Bots (angemeldete Bots nie, auch im Modus normal)
  const wertetJetzt = () => wertet({ modus: z.modus, startFen, botId: bot.id });
  const laufId = 'l' + z.gestartet;
  const startFarbe = z.chess.turn();
  const startNummer = Number(z.chess.fen().split(' ')[5]) || 1;
  if (laufend) {
    for (const u of laufend.zuege) {
      let m = null;
      try { m = z.chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined }); } catch (e) { m = null; }
      if (!m) break;
      merkeZug(m);
    }
    (laufend.liveKlassen || []).forEach((k, i) => { if (i < z.zuege.length && k) z.liveKlassen[i] = k; });
    (laufend.liveTrivial || []).forEach((t, i) => { if (i < z.zuege.length) z.liveTrivial[i] = t === true; });
  }

  // ---------- Hilfen fuer Plies ----------
  function merkeZug(m) {
    z.zuege.push(m.lan);
    z.san.push(m.san);
    z.verbose.push(m);
    z.fens.push(m.after);
    z.liveKlassen.push(null);
    z.liveTrivial.push(false);
    z.live.push(null);
  }
  const farbeVon = (i) => (i % 2 === 0 ? startFarbe : (startFarbe === 'w' ? 'b' : 'w'));
  const istFlo = (i) => farbeVon(i) === farbe;
  const nummerVon = (i) => startNummer + Math.floor((i + (startFarbe === 'b' ? 1 : 0)) / 2);
  const zugLabel = (i) => `${nummerVon(i)}${farbeVon(i) === 'w' ? '.' : '…'} ${sanDeutsch(z.san[i])}`;
  const letzterFloPly = () => { for (let i = z.zuege.length - 1; i >= 0; i--) if (istFlo(i)) return i; return -1; };
  // w0plus-a-fix: Flos Gewinnchance nach seinem vorigen eigenen Zug (vor dem letzten Bot-Zug), null ohne Bewertung
  const gewinnNachVorigemZug = (ply) => {
    for (let i = ply - 1; i >= 0; i--) {
      if (!istFlo(i)) continue;
      const e = z.live[i];
      return e && e.status === 'fertig' && e.erg && Number.isFinite(e.erg.gewinnNachher) ? e.erg.gewinnNachher : null;
    }
    return null;
  };
  const liveAn = () => app.einstellungen().liveBewertung;
  const tiefe = () => app.einstellungen().tiefe;

  // ---------- Timer, Listener ----------
  const uhren = new Set();
  const spaeter = (fn, ms) => { const u = setTimeout(() => { uhren.delete(u); if (!weg) fn(); }, ms); uhren.add(u); return u; };
  const warte = (ms, signal) => new Promise((resolve) => {
    if (signal && signal.aborted) { resolve(); return; }
    const u = setTimeout(fertig, ms);
    uhren.add(u);
    function fertig() { clearTimeout(u); uhren.delete(u); if (signal) signal.removeEventListener('abort', fertig); resolve(); }
    if (signal) signal.addEventListener('abort', fertig, { once: true });
  });
  let weg = false;
  const endeCtrl = new AbortController();
  const protokoll = [];
  const melde = (eintrag) => { if (app.test) protokoll.push({ t: Math.round(jetzt()), ...eintrag }); };

  // ---------- DOM ----------
  // W0+a: Kopf und Bot-Zeile auch fuer angemeldete Bots (ohne Stufe) und Bosse
  function kopfTitel() {
    if (z.modus === 'boss') {
      if (!z.boss) return bot.name;
      return `${bot.name} · ${STUFE_NAME[z.boss.stufe]}${bossStaerke ? ` ≈ ${bossStaerke.elo}` : ''}`;
    }
    return bot.name;
  }
  // U7: auf dem Handy der Rufname im Kopf (PLAN 2.5 Regel 5), nur fuer Bots mit Rufname und nicht im Boss-Kopf
  const kopfKurz = () => (z.modus !== 'boss' && RUFNAME[bot.id] ? RUFNAME[bot.id] : kopfTitel());
  function botMeta() {
    if (bot.stufe) return `Elo ${bot.elo}`;
    const teile = [bot.titel || (z.modus === 'boss' ? 'Boss' : '')];
    if (bossStaerke) teile.push(`≈ ${bossStaerke.elo}`);
    else if (Number.isFinite(bot.elo)) teile.push(`Elo ${bot.elo}`);
    return teile.filter(Boolean).join(' · ');
  }
  const s = document.createElement('section');
  s.className = 'screen partie';
  s.setAttribute('aria-label', `Partie gegen ${bot.name}`);
  s.style.setProperty('--bf', themaBotFarbe(bot));
  const knopf = (aktion, ico, text, extra = '', label = '') =>
    `<button class="knopf aktion dr ${extra}" type="button" data-aktion="${aktion}"${label ? ` aria-label="${esc(label)}"` : ''}>${icon(ico)}<span>${text}</span></button>`;
  const brettwahl = BRETTER.map(([id, name, h, d]) => `<button class="dr" type="button" role="radio" data-brett="${id}" aria-label="Brett ${name}" `
    + `aria-checked="${einst.brett === id}"><i style="--h:${h};--d:${d}"><b></b><b></b><b></b><b></b></i></button>`).join('');
  const uhrHtml = (wer) => `<div class="uhr zahl" data-wer="${wer}" hidden>${UHR_SYMBOL}<span class="uhr-zeit"></span></div>`;
  s.innerHTML = `
    <header class="kopf p-kopf">
      <button class="icon-knopf dr" type="button" data-aktion="zurueck" aria-label="Zurück zur Arena">${icon('zurueck')}</button>
      <div class="titel"><h2>${esc(kopfTitel())}</h2><div class="unter"><span class="p-eroeffnung"></span>${bot.stufe
    ? `<span class="p-sep" aria-hidden="true"> · </span><span class="p-stufe">Stufe ${bot.stufe}</span>` : ''}<span class="p-sep" aria-hidden="true"> · </span><span class="p-farbe"><span class="p-lang">Du spielst </span>${FARBE_NAME[farbe]}</span></div></div>
      <div class="brettwahl" role="radiogroup" aria-label="Brettfarbe">${brettwahl}</div>
      <button class="icon-knopf knopf-klang dr" type="button" data-aktion="klang" aria-pressed="${einst.klang !== false}" aria-label="Klang">${icon('klang')}</button>
      <button class="icon-knopf dr" type="button" data-aktion="einstellungen" aria-label="Einstellungen">${icon('einst')}</button>
    </header>
    <div class="inhalt">
      <div class="brettzone">
        <div class="evalbalken" role="img" aria-label="Bewertung"><div class="mitte"></div><div class="weiss"></div><span class="wert zahl"></span></div>
        <div class="brett-rahmen"><div class="brett"></div><div class="brett-effekte" aria-hidden="true"></div>
          <button class="knopf primaer ergebnis-zeigen" type="button" data-aktion="ergebnis" hidden>${icon('pokal')} Ergebnis</button></div>
      </div>
      <div class="seite">
        <div class="spieler gegner botbox botleiste-hoch botkarte" aria-label="${esc(bot.name)}">
          <span class="av"><img src="${esc(avatarVon(bot))}" alt=""></span>
          <div class="info"><div class="name bot-name">${esc(bot.name)}</div>
            <div class="unter bot-meta"><span class="p-meta">${esc(botMeta())}</span><span class="denkt-ort"></span><span class="geschlagen-ort" data-wer="bot"></span></div></div>
          ${uhrHtml('bot')}
          <div class="blase-ort" aria-live="polite" data-leer="${esc(bot.kurz || '')}"></div>
        </div>
        <div class="coach coach-karte leer" role="status" aria-live="polite"></div>
        <div class="zugbox"><div class="zugliste" aria-label="Züge"></div></div>
        <div class="zugleiste" aria-label="Züge"></div>
        <div class="spieler ich spielerleiste spieler-quer spieler-hoch" aria-label="Flo">
          <span class="av">${floAvatar(farbe)}</span>
          <div class="name">Flo</div>
          <div class="unter bot-meta"><span class="p-meta">${FARBE_NAME[farbe]}</span><span class="geschlagen-ort" data-wer="flo"></span></div>
          ${uhrHtml('flo')}
        </div>
        <div class="spielknoepfe aktionen">
          ${knopf('hinweis', 'hinweis', 'Hinweis', 'hinweis-k')}${knopf('zuruecknehmen', 'undo', 'Zurück', '', 'Zug zurücknehmen')}
          ${knopf('drehen', 'drehen', 'Drehen')}${knopf('aufgeben', 'flagge', 'Aufgeben', 'aufgeben')}
        </div>
      </div>
    </div>`;
  root.append(s);

  const $ = (sel) => s.querySelector(sel);
  const $$ = (sel) => [...s.querySelectorAll(sel)];
  const rahmen = $('.brett-rahmen');
  const effekteEl = $('.brett-effekte');
  const balken = $('.evalbalken');
  const coachEl = $('.coach');
  const gegnerKarte = $('.spieler.gegner');
  const floKarte = $('.spieler.ich');
  s.classList.toggle('ohne-balken', !einst.balken);
  s.classList.toggle('mit-uhr', !!z.tempo);
  if (bot.stufe) s.classList.add('mit-stufe');

  const brett = new Brett($('.brett'), {
    ausrichtung: farbe, figurenPfad: 'assets/pieces/', beiZug, koordinaten: einst.koordinaten, beiAbgelehnt,
    beiLeer: () => { if (z.phase === 'bot') loescheVorzuege(); }, autoDame: einst.autoDame,
    koordLage: einst.koordLage, steuerung: einst.steuerung, turmRochade: einst.turmRochade === true, pfeile: einst.pfeile !== false,
  });
  brett.setzeDauer(ZUG_MS);
  // W0+a: nicht erlaubter Zugversuch (den Grund rechnet ein Paket mit chess.js aus, SPIELKONZEPT 3.18)
  function beiAbgelehnt(von, nach, art) {
    if (weg || z.phase !== 'flo') return;
    sende('zug:abgelehnt', { laufId, von, nach: nach || null, art, figur: brett.figurAuf(von), fen: z.chess.fen() });
  }
  brett.setzeStellung(z.chess.fen(), { animieren: false, letzterZug: letzterZugFelder(), schach: z.chess.inCheck() ? true : null });
  brett.erlaubeZuege(null);

  // ---------- Knoepfe ----------
  s.addEventListener('click', (e) => {
    const k = e.target.closest('[data-aktion]');
    if (!k || !s.contains(k) || k.disabled
      || k.closest('.c-zusatz, .erg-karte-ort, .erg-feier, .ort-gegner-leiste, .ort-spieler-leiste, .ort-aktionen')) return;   // Pakete binden selbst
    const a = k.dataset.aktion;
    if (a === 'zurueck') zurueckGedrueckt();
    else if (a === 'einstellungen') { speichereLaufend(); app.gehe('einstellungen'); }
    else if (a === 'klang') klangUmschalten(k);
    else if (a === 'hinweis') hinweis();
    else if (a === 'zuruecknehmen') zuruecknehmen();
    else if (a === 'drehen') drehen();
    // U7: mit "Halten zum Aufgeben" entscheidet der Halte-Knopf (Tastatur: Rueckfrage, siehe unten)
    else if (a === 'aufgeben') { if (!halte) aufgebenFragen(); }
    else if (a === 'idee') zeigeIdee(Number(k.dataset.ply));
    else if (a === 'besser') zeigeBesser(Number(k.dataset.ply));
    else if (a === 'ergebnis') zeigeOverlayWieder();
  });
  // U7: Tastatur und Bedienhilfen (Klick ohne Zeiger) bekommen beim Halte-Knopf dieselbe Rueckfrage wie ohne Halten
  // (app.frage), nicht das Blatt des Bauteils: eine Rueckfrage fuer alle Wege
  s.addEventListener('click', (e) => {
    if (!halte || e.detail !== 0 || !e.target || !e.target.closest) return;
    if (e.target.closest('.spielknoepfe > [data-aktion="aufgeben"]') !== halte.el) return;
    e.stopPropagation();
    e.preventDefault();
    if (!halte.el.disabled) aufgebenFragen();
  }, true);
  // U7: Brettwahl im Kopf (wie in den Einstellungen, wirkt sofort)
  $('.brettwahl').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-brett]');
    if (!b) return;
    app.setzeEinstellungen({ brett: b.dataset.brett });
    try { klang.spiele('klick'); } catch (f) { /* still */ }
  });
  s.addEventListener('pointerdown', (e) => {
    if (z.phase === 'bot' && z.vorzuege.length && !e.target.closest('.brett')) loescheVorzuege();
  });
  // Coach antippen: zeigt den Rest (Stil "knapp", Handy), sonst klappt er auf oder ein
  coachEl.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    if (coachEl.classList.contains('hat-rest')) {
      const offen = !coachEl.classList.contains('offen');
      coachEl.classList.toggle('offen', offen);
      if (offen) { coachEl.classList.remove('kompakt'); clearTimeout(z.kompaktUhr); }
      return;
    }
    const p = Number(coachEl.dataset.ply);
    if (!Number.isFinite(p) || !z.live[p] || z.live[p].status !== 'fertig') return;
    coachEl.classList.toggle('kompakt');
  });

  // U7: Klang-Schalter im Kopf (stumm, die Lautstaerke bleibt; wie der Kopf der Hauptseiten)
  function klangUmschalten(k) {
    const an = app.einstellungen().klang === false;
    app.setzeEinstellungen({ klang: an });
    k.setAttribute('aria-pressed', an ? 'true' : 'false');
    const svg = k.querySelector('svg');
    if (svg) anim(svg, [{ transform: 'scale(.7)' }, { transform: 'none' }], { d: 520, k: 'hupf' });
    if (an) { try { klang.spiele('schalter'); } catch (f) { /* still */ } }
    app.meldung(an ? 'Klang an' : 'Klang aus', { dauer: 1600 });
  }

  // U7: Aufgeben ueber den Halte-Knopf (Einstellung haltenAufgeben, Standard an) oder wie bisher mit Rueckfrage
  let halte = null;
  function setzeAufgeben(halten) {
    const alt = $('.spielknoepfe > [data-aktion="aufgeben"]');
    if (!alt || !!halte === !!halten) return;
    if (halte) { halte.verlasse(); halte = null; }
    let neu;
    if (halten) {
      halte = halteKnopf({
        text: 'Aufgeben', icon: icon('flagge'), dauer: 1000, klasse: 'aktion dr aufgeben', label: 'Aufgeben (gedrückt halten)',
        hinweis: 'Zum Aufgeben gedrückt halten',
        beiAusloesen: () => { if (!weg && z.phase !== 'ende') { melde({ typ: 'aufgeben', weg: 'halten' }); ende('niederlage', 'aufgabe'); } },
      });
      neu = halte.el;
    } else {
      const huelle = document.createElement('div');
      huelle.innerHTML = knopf('aufgeben', 'flagge', 'Aufgeben', 'aufgeben');
      neu = huelle.firstElementChild;
    }
    neu.dataset.aktion = 'aufgeben';
    neu.disabled = alt.disabled;
    alt.replaceWith(neu);
  }
  setzeAufgeben(einst.haltenAufgeben !== false);

  // ---------- Darstellung ----------
  function letzterZugFelder() {
    const m = z.verbose[z.verbose.length - 1];
    return m ? [m.from, m.to] : null;
  }

  function zeichneKopf() {
    let name = 'Eigene Stellung';
    if (z.modus === 'boss') name = bot.regel ? `Regel: ${bot.regel}` : 'Boss-Partie';
    else if (z.modus === 'uebung') name = `Übung ab Zug ${startNummer}`;
    else if (!startFen) {
      const er = eroeffnung(z.san);
      name = er.name || (z.san.length ? 'Eröffnung' : 'Grundstellung');
    }
    $('.p-eroeffnung').textContent = name;
  }

  function zeichneGeschlagen() {
    const vonFlo = [];
    const vonBot = [];
    for (const m of z.verbose) if (m.captured) (m.color === farbe ? vonFlo : vonBot).push(m.captured);
    const sortiere = (l) => l.sort((a, b) => WERT[b] - WERT[a]);
    const bilanz = materialBilanz(z.chess.fen()) * (farbe === 'w' ? 1 : -1);
    const html = (liste, figFarbe, plus) => {
      if (!liste.length && plus <= 0) return '<span class="geschlagen leer"></span>';
      let vor = null;
      const imgs = sortiere(liste).map((t) => {
        const neu = vor !== null && vor !== t;
        vor = t;
        return `<img${neu ? ' class="neu-gruppe"' : ''} src="assets/pieces/${figFarbe}${t.toUpperCase()}.svg" alt="">`;
      }).join('');
      return `<span class="geschlagen">${imgs}${plus > 0 ? `<span class="plus zahl">+${plus}</span>` : ''}</span>`;
    };
    for (const ort of $$('.geschlagen-ort')) {
      ort.innerHTML = ort.dataset.wer === 'flo' ? html(vonFlo, botFarbe, bilanz) : html(vonBot, farbe, -bilanz);
    }
  }

  function zeichneZugliste() {
    const letzter = z.zuege.length - 1;
    const zelle = (i) => {
      if (i == null) return '<span class="z leer"></span>';
      let sym = '';
      if (istFlo(i) && liveAn()) {
        const k = z.liveKlassen[i];
        const e = z.live[i];
        if (k) sym = `<span class="z-sym k-${esc(k)}" title="${esc(KLASSEN_WORT[k])}">${symbolSvg(k)}<span class="sr">${esc(KLASSEN_WORT[k])}: </span></span>`;
        else if (e && e.status === 'rechnet') sym = '<i class="z-wartet" aria-hidden="true"></i>';
      }
      return `<span class="z${i === letzter ? ' aktuell' : ''}${istFlo(i) ? ' du' : ''}">${sym}${esc(sanDeutsch(z.san[i]))}</span>`;
    };
    const zeilen = new Map();
    for (let i = 0; i < z.zuege.length; i++) {
      const n = nummerVon(i);
      if (!zeilen.has(n)) zeilen.set(n, { w: null, b: null });
      zeilen.get(n)[farbeVon(i)] = i;
    }
    let liste = '';
    for (const [n, r] of zeilen) {
      liste += `<span class="nr">${n}.</span>${r.w == null && r.b != null ? '<span class="z leer">…</span>' : zelle(r.w)}${zelle(r.b)}`;
    }
    if (!z.zuege.length) liste = '<span class="zugliste-leer">Noch keine Züge</span>';
    const listeEl = $('.zugliste');
    listeEl.innerHTML = liste;
    listeEl.scrollTop = listeEl.scrollHeight;

    let leiste = '';
    for (let i = 0; i < z.zuege.length; i++) {
      if (farbeVon(i) === 'w' || i === 0) leiste += `<span class="nr">${nummerVon(i)}${farbeVon(i) === 'w' ? '.' : '…'}</span>`;
      leiste += zelle(i);
    }
    const leisteEl = $('.zugleiste');
    leisteEl.innerHTML = leiste || '<span class="zugliste-leer">Noch keine Züge</span>';
    leisteEl.scrollLeft = leisteEl.scrollWidth;
  }

  function zeichneKnoepfe() {
    const am = z.phase === 'flo';
    const ende = z.phase === 'ende';
    $('.spielknoepfe > [data-aktion="hinweis"]').disabled = !am;
    $('.spielknoepfe > [data-aktion="zuruecknehmen"]').disabled = ende || letzterFloPly() < 0;
    $('.spielknoepfe > [data-aktion="aufgeben"]').disabled = ende;
    const h = $('.spielknoepfe > [data-aktion="hinweis"]');
    h.classList.toggle('stufe-2', am && z.hinweisFen === z.chess.fen() && z.hinweisStufe >= 1);
  }

  function setzeDenkt(an) {
    for (const ort of $$('.denkt-ort')) {
      ort.innerHTML = an ? '<span class="denkt-text"><span class="denkt-punkt"> · </span>denkt</span><span class="denkt"><i></i><i></i><i></i></span>' : '';
    }
    s.classList.toggle('bot-denkt', !!an);
  }

  // Bewertungsbalken fuer die gerade gezeigte Stellung
  function setzeBalken(a) {
    if (!a || !a.lines || !a.lines.length) return;
    const ev = a.lines[0].eval;
    const w = Math.min(0.97, Math.max(0.03, gewinnChance(ev, 'w')));
    let text;
    let fuehrt;
    if (a.ende === 'matt') { text = a.gewinner === 'w' ? '1-0' : '0-1'; fuehrt = a.gewinner || 'w'; }
    else if (a.ende === 'patt') { text = '½'; fuehrt = 'w'; }
    else if (ev.mate != null) { text = 'M' + Math.abs(ev.mate); fuehrt = ev.mate > 0 ? 'w' : 'b'; }
    else { text = komma(Math.abs(ev.cp) / 100); fuehrt = ev.cp >= 0 ? 'w' : 'b'; }
    balken.style.setProperty('--w', (w * 100).toFixed(1) + '%');
    balken.style.setProperty('--anteil', w.toFixed(3));   // U7: waagrechter Balken auf dem Handy (scaleX)
    balken.dataset.fuehrt = fuehrt;
    $('.evalbalken .wert').textContent = text;
    balken.setAttribute('aria-label', `Bewertung ${evalText(ev, 'w') || text} aus Sicht von Weiß`);
  }
  function balkenAusrichtung() {
    balken.classList.toggle('gedreht', brett.ausrichtung === 'b');
    s.classList.toggle('vertauscht', brett.ausrichtung !== farbe);
  }

  // ---------- Sprechblase ----------
  // Satz zum Anlass; Saetze, die nicht zur Lage passen, fallen weg
  // (Matt-Saetze bei Aufgabe, "ich fang an", wenn Flo anfaengt)
  function satzFuer(anlass, werte = null) {
    const liste = (bot.saetze && bot.saetze[anlass]) || [];
    let passt = null;
    if (anlass === 'gewinnt' && endeDaten && endeDaten.grund !== 'matt') passt = (t) => !/matt/i.test(t);
    if (anlass === 'begruessung' && startFarbe === farbe) passt = (t) => !/ich fang/i.test(t);
    const auswahl = passt ? liste.filter(passt) : liste;
    if (passt && auswahl.length && auswahl.length < liste.length) return auswahl[Math.floor(Math.random() * auswahl.length)];
    return botSatz(bot, anlass, Math.random, werte);
  }
  // Hoechstens eine Blase je Zugpaar; eine hoehere prio ersetzt eine niedrigere (BAUPLAN 3.5:
  // spielerFehler/spielerGut 70, Begruessung 60, schlagen/schach des Bots 50)
  // U7: Einstellung sprueche: 'aus' keine Blase, 'wenig' nur Begruessung ('start'), Ende ('ende') und hoechstens eine
  // weitere je WENIG_ABSTAND Halbzuege. Die Blase blendet nach BLASE_MS aus.
  function blaseErlaubt(paar) {
    const art = app.einstellungen().sprueche;
    if (art === 'aus') return false;
    if (art !== 'wenig' || paar === 'start' || paar === 'ende') return true;
    if (paar !== undefined && paar === z.blasePaar) return true;   // hoehere prio im selben Moment ersetzt
    return z.blaseWenigPly == null || z.zuege.length - z.blaseWenigPly >= WENIG_ABSTAND;
  }
  function zeigeBlase(anlass, paar, { dauer = BLASE_MS, immer = false, prio = 50, werte = null } = {}) {
    const p = Number.isFinite(prio) ? prio : 50;
    if (!immer && paar !== undefined && z.blasePaar === paar && p <= z.blasePrio) return false;
    if (!blaseErlaubt(paar)) return false;
    const text = satzFuer(anlass, werte);
    if (!text) return false;
    if (paar !== 'start' && paar !== 'ende' && paar !== z.blasePaar) z.blaseWenigPly = z.zuege.length;
    z.blasePaar = paar;
    z.blasePrio = p;
    const ort = $('.blase-ort');
    ort.innerHTML = `<div class="sprechblase p-blase${tempo() ? '' : ' still'}">${esc(text)}</div>`;
    s.classList.add('hat-blase');
    melde({ typ: 'blase', anlass, text });
    clearTimeout(z.blaseUhr);
    if (dauer) z.blaseUhr = spaeter(versteckeBlase, dauer);
    return true;
  }
  function versteckeBlase() {
    clearTimeout(z.blaseUhr);
    for (const ort of $$('.blase-ort')) {
      const b = ort.querySelector('.sprechblase');
      if (b) { b.classList.add('weg'); spaeter(() => { if (b.isConnected) b.remove(); }, 220); }
    }
    s.classList.remove('hat-blase');
  }

  // ---------- Coach ----------
  let zusaetze = [];   // Coach-Zusaetze der Pakete: { el, prio, nr }
  let zusatzNr = 0;
  function coachZeige(html, klassen, ply = null) {
    coachEl.className = 'coach coach-karte ' + klassen;
    coachEl.innerHTML = html;
    zusaetze = [];
    if (ply == null) delete coachEl.dataset.ply; else coachEl.dataset.ply = String(ply);
    clearTimeout(z.kompaktUhr);
    pruefeCoachRest();
  }
  // U7: Coach-Stil "knapp": nur der erste Satz, der Rest auf Antippen (.c-rest)
  function coachText(text) {
    const t = String(text || '');
    const m = app.einstellungen().coachStil === 'knapp' ? t.match(/^(.+?[.!?…])(\s+)(\S[\s\S]*)$/) : null;
    if (!m) return esc(t);
    return `<span class="c-satz">${esc(m[1])}</span><span class="c-rest">${esc(m[2] + m[3])}</span>`;
  }
  // U7: hat der Coach etwas, das erst ein Antippen zeigt (Stil knapp; hoch, also iPad hoch und Handy: der Coach hat eine
  // feste Hoehe, Text bei Platznot und die Knoepfe kommen auf Antippen)?
  function pruefeCoachRest() {
    const knapp = !!coachEl.querySelector('.c-rest');
    coachEl.classList.toggle('knapp', knapp);
    const hoch = !!(window.matchMedia && window.matchMedia('(orientation: portrait)').matches);
    const handyRest = hoch && !!coachEl.querySelector('.c-text, .coach-knoepfe');
    coachEl.classList.toggle('hat-rest', knapp || handyRest);
    if (!knapp && !handyRest) coachEl.classList.remove('offen');
  }
  // Zeile unter dem Coach-Satz (Buehne): hoechstens ZUSATZ_MAX, die hoehere prio gewinnt. bleibt: der Coach
  // klappt nicht von selbst ein, solange die Zeile da ist (ein schon eingeklappter klappt wieder auf), z. B.
  // fuer eine Zeile mit Knopf; sonst ist die Zeile im eingeklappten Coach versteckt
  function coachZusatz(inhalt, { prio = 50, art = 'info', bleibt = false } = {}) {
    const el = document.createElement('div');
    el.className = 'c-zusatz';
    el.dataset.art = ZUSATZ_ARTEN.includes(art) ? art : 'info';
    if (inhalt && typeof inhalt === 'object' && inhalt.nodeType) el.append(inhalt);
    else el.textContent = String(inhalt ?? '');
    if (weg) return el;
    zusaetze.push({ el, prio: Number.isFinite(prio) ? prio : 50, nr: zusatzNr++, bleibt: bleibt === true });
    zusaetze.sort((a, b) => b.prio - a.prio || a.nr - b.nr);
    for (const alt of zusaetze.splice(ZUSATZ_MAX)) alt.el.remove();
    // unter dem Coach-Satz, vor den Knoepfen, nach prio geordnet
    const vor = coachEl.querySelector(':scope > .coach-knoepfe');
    for (const x of zusaetze) coachEl.insertBefore(x.el, vor);
    coachEl.classList.add('mit-zusatz');
    if (zusatzBleibt()) {
      clearTimeout(z.kompaktUhr);
      coachEl.classList.remove('kompakt');
    }
    return el;
  }
  const zusatzBleibt = () => zusaetze.some((x) => x.bleibt && x.el.isConnected);
  function coachLeer() {
    if (!liveAn()) {
      coachZeige(`<span class="c-symbol c-icon">${icon('ziel')}</span><div class="c-kopf"><span class="c-klasse">Live-Bewertung aus</span></div>
        <p class="c-text">Die Bewertung jedes Zugs siehst du nach der Partie in der Analyse.</p>`, 'leer');
      return;
    }
    coachZeige(`<span class="c-symbol c-icon">${icon('ziel')}</span><div class="c-kopf"><span class="c-klasse">Dein Coach</span></div>
      <p class="c-text">${z.zuege.length ? 'Weiter geht’s! Ich bewerte jeden deiner Züge.' : 'Ich bewerte jeden deiner Züge, sobald du ziehst.'}</p>`, 'leer');
  }
  function coachRechnet(ply) {
    if (!liveAn()) return;
    coachZeige(`<span class="c-symbol c-warte"><span class="denkt grau"><i></i><i></i><i></i></span></span>
      <div class="c-kopf"><span class="c-klasse">Coach rechnet …</span><span class="c-zug">${esc(zugLabel(ply))}</span></div>
      <p class="c-text">Gleich weißt du, wie gut dein Zug war.</p>`, 'wartet', ply);
  }
  // COMBO: Präzise, Goldrichtig und Genial zaehlen; Buch, Pflichtzug und triviale Zuege
  // (Zurueckschlagen, Schachabwehr) sind neutral, solange sie nichts verschenken
  const neutral = (i) => NEUTRAL.has(z.liveKlassen[i]) || (z.liveTrivial[i] === true && !MIT_VERLUST.has(z.liveKlassen[i]));
  function serieBis(ply) {
    let n = 0;
    for (let i = 0; i <= ply; i++) {
      if (!istFlo(i)) continue;
      const k = z.liveKlassen[i];
      if (!k || neutral(i)) continue;
      n = SERIE.has(k) ? n + 1 : 0;
    }
    return n;
  }
  // laengste Serie der Partie und die laufende Serie am Screen (data-serie, data-serie-stufe)
  function merkeSerie() {
    let n = 0;
    let max = 0;
    for (let i = 0; i < z.zuege.length; i++) {
      if (!istFlo(i)) continue;
      const k = z.liveKlassen[i];
      if (!k || neutral(i)) continue;
      n = SERIE.has(k) ? n + 1 : 0;
      if (n > max) max = n;
    }
    z.maxSerie = max;
    const jetzt = liveAn() ? n : 0;
    s.dataset.serie = String(jetzt);
    const stufe = serienStufe(jetzt);
    if (stufe) s.dataset.serieStufe = stufe;
    else delete s.dataset.serieStufe;
  }
  function coachErgebnis(ply, { neu = true } = {}) {
    const e = z.live[ply];
    if (!e || e.status !== 'fertig' || !liveAn()) return;
    const erg = e.erg;
    const k = erg.klasse;
    const ende = erg.analyseNachher && erg.analyseNachher.ende;
    let evalT = ende === 'matt' ? 'Matt' : ende === 'patt' ? 'Patt' : evalText(erg.evalNachher, farbe);
    if (MIT_VERLUST.has(k) && !ende) evalT = `${evalText(erg.evalVorher, farbe)} → ${evalText(erg.evalNachher, farbe)}`;
    const serie = SERIE.has(k) && !neutral(ply) ? serieBis(ply) : 0;
    const combo = serie >= 3 ? `<span class="combo" data-stufe="${serienStufe(serie)}">${icon('blitz')}COMBO ×${serie}</span>` : '';
    if (k === 'buch') {
      coachZeige(`<span class="c-symbol">${symbolSvg(k)}</span><div class="c-kopf"><span class="c-klasse">${esc(KLASSEN_NAME.buch)}</span><span class="c-zug">${esc(zugLabel(ply))}</span>
        <span class="c-buch">${esc(erg.notiz && erg.notiz !== 'Eröffnungstheorie' ? erg.notiz : (eroeffnung(z.san.slice(0, ply + 1)).name || 'Eröffnungstheorie'))}</span></div>
        <p class="c-text">${coachText('Ein bekannter Eröffnungszug. Genau so spielen ihn auch die Profis.')}</p>`,
      `k-${k} buch${neu ? ' neu' : ''}`, ply);
      coachEl.style.setProperty('--kf', `var(--k-${k})`);
      return;
    }
    const knoepfe = [];
    const anders = erg.besterZug && erg.besterZug !== erg.uci;
    if ((k === 'brillant' || k === 'stark' || k === 'bester') && erg.analyseNachher && erg.analyseNachher.lines && erg.analyseNachher.lines[0] && erg.analyseNachher.lines[0].pv.length) {
      knoepfe.push(`<button class="knopf" type="button" data-aktion="idee" data-ply="${ply}">${icon('pfeil')} Idee zeigen</button>`);
    }
    if (anders && !['brillant', 'stark', 'bester', 'erzwungen', 'buch'].includes(k)) {
      knoepfe.push(`<button class="knopf" type="button" data-aktion="besser" data-ply="${ply}">${icon('ziel')} Besser?</button>`);
    }
    if (SCHLECHT.has(k) && ply === letzterFloPly() && z.phase !== 'ende') {
      knoepfe.push(`<button class="knopf" type="button" data-aktion="zuruecknehmen" title="Kostet den 3. Stern">${icon('undo')} Zurücknehmen</button>`);
    }
    coachZeige(`<span class="c-symbol">${symbolSvg(k)}</span>
      <div class="c-kopf"><span class="c-klasse">${esc(KLASSEN_WORT[k] || k)}</span><span class="c-zug">${esc(zugLabel(ply))}</span><span class="c-eval zahl">${esc(evalT)}</span>${combo}</div>
      <p class="c-text">${coachText(coachKern(erg.coach))}</p>
      ${knoepfe.length ? `<div class="coach-knoepfe">${knoepfe.join('')}</div>` : ''}`,
    `k-${k}${neu ? ' neu' : ''}`, ply);
    coachEl.style.setProperty('--kf', `var(--k-${k})`);
  }

  function zeigeIdee(ply) {
    const e = z.live[ply];
    if (!e || !e.erg) return;
    if (z.ideeAn === 'idee' + ply) { brett.pfeile([]); z.ideeAn = null; return; }
    const pv = (e.erg.analyseNachher.lines[0].pv || []).slice(0, 3);
    const pf = [{ von: e.erg.uci.slice(0, 2), nach: e.erg.uci.slice(2, 4), farbe: e.erg.klasse, deckkraft: 0.9 }];
    pv.forEach((u, i) => pf.push({ von: u.slice(0, 2), nach: u.slice(2, 4), farbe: i % 2 === 0 ? 'schlecht' : 'bester', deckkraft: 0.75 - i * 0.12 }));
    brett.pfeile(pf);
    z.ideeAn = 'idee' + ply;
  }
  function zeigeBesser(ply) {
    const e = z.live[ply];
    if (!e || !e.erg || !e.erg.besterZug) return;
    if (z.ideeAn === 'besser' + ply) { brett.pfeile([]); z.ideeAn = null; return; }
    const b = e.erg.besterZug;
    brett.pfeile([{ von: b.slice(0, 2), nach: b.slice(2, 4), farbe: 'bester' }]);
    z.ideeAn = 'besser' + ply;
    if (e.erg.besterZugSanDe) app.meldung(`Besser war ${e.erg.besterZugSanDe}.`);
  }

  // ---------- Effekte am Brett ----------
  function spalteZeile(feld) {
    const d = feld.charCodeAt(0) - 97;
    const r = Number(feld[1]) - 1;
    return brett.ausrichtung === 'w' ? [d, 7 - r] : [7 - d, r];
  }
  function effekt(feld, klasse) {
    if (reduziert || tempo() === 0) return;
    // W0+a: ein Finisher ersetzt jeden Brett-Effekt. Bis feststeht, ob einer laeuft (ein Anbieter darf null liefern,
    // z. B. "Finisher aus"), wird der Effekt gemerkt; laeuft keiner, holt der Matt-Hook ihn nach
    if (z.finisher) { z.effektGemerkt = [feld, klasse]; return; }
    const [x, y] = spalteZeile(feld);
    const ort = document.createElement('div');
    ort.className = 'effekt-ort k-' + klasse;
    ort.style.setProperty('--x', x);
    ort.style.setProperty('--y', y);
    // U7 (Befund U6): fertige Prozente statt calc(var(--x) * 12.5%), wie die Lagen des Bretts
    ort.style.left = (x * 12.5) + '%';
    ort.style.top = (y * 12.5) + '%';
    if (klasse === 'brillant') {
      // Der eine grosse Moment (PLAN 2.4, Entwurf A): Feld-Puls, Ring, 8 Funken (0,6 bis 0,9 Feldbreiten) in der
      // Klassenfarbe, ein Lichtstreif ueber das ganze Brett, das Brett hebt sich 1,2 % (.prisma am Sockel)
      ort.style.setProperty('--feld', ((effekteEl.clientWidth || 480) / 8).toFixed(1) + 'px');
      ort.innerHTML = '<i class="feld-puls"></i><i class="welle"></i><span class="funken">' + Array.from({ length: 8 }, (_, i) =>
        `<i style="--a:${i * 45 + 22}deg;--r:${(0.6 + (i % 3) * 0.15).toFixed(2)};animation-delay:${60 + (i % 2) * 30}ms"></i>`).join('') + '</span>';
      const streif = document.createElement('div');
      streif.className = 'streif-huelle';
      streif.innerHTML = '<i class="streif"></i>';
      effekteEl.append(streif);
      spaeter(() => streif.remove(), 1500);
      rahmen.classList.remove('prisma');
      void rahmen.offsetWidth;
      rahmen.classList.add('prisma');
      spaeter(() => rahmen.classList.remove('prisma'), 1600);
    } else if (klasse === 'stark') {
      ort.innerHTML = '<i class="ring-puls"></i><i class="ring-puls zwei"></i>';
    } else if (klasse === 'bester') {
      ort.innerHTML = '<i class="ring-ping"></i>';
    }
    // Unscharf, Daneben und Weit daneben bleiben ruhig (nur das Abzeichen, kein Wackeln)
    if (ort.innerHTML) {
      effekteEl.append(ort);
      spaeter(() => ort.remove(), 1700);
    }
  }

  // ---------- Analysen (Bewertungs-Engine) ----------
  const laufendeAnalysen = new Map();
  let engBewertung = null;
  let engBot = null;
  const bewertungsEngine = () => app.engine('bewertung').then((e) => { engBewertung = e; return e; });

  // Jede Stellung nur einmal rechnen (laufendeAnalysen), hoechstens LIVE_MAX_MS lang.
  // { vorne: true } (Hinweis): steht die Stellung schon in der Warteschlange, wird genau diese Suche vor
  // alle anderen geholt (engine.vorziehen), sonst eine neue vorne eingereiht. Nie zwei Suchen derselben
  // Stellung (im Stau waere das doppelte Engine-Arbeit).
  function analysiere(fen, { vorne = false } = {}) {
    const key = stellungsSchluessel(fen);
    const fertig = app.vorab.get(key);
    if (fertig) return Promise.resolve(fertig);
    const da = laufendeAnalysen.get(key);
    if (da) {
      if (vorne) da.vorziehen();
      return da;
    }
    const eintrag = { laeuft: false, vorne, engine: null };
    const stau = laufendeAnalysen.size >= 2;
    const p = bewertungsEngine()
      .then((e) => {
        eintrag.engine = e;
        return e.analyse(fen, {
          depth: tiefe(), multipv: 2, movetime: stau ? LIVE_STAU_MS : LIVE_MAX_MS, prioritaet: eintrag.vorne ? 'vorne' : undefined,
          beiTiefe: () => { eintrag.laeuft = true; },
        });
      })
      .then((a) => {
        if (laufendeAnalysen.get(key) === p) laufendeAnalysen.delete(key);
        if (a && !a.abgebrochen && a.lines && a.lines.length) {
          app.vorab.set(key, a);
          beiAnalyse(fen, a);
        }
        return a;
      }, (err) => { if (laufendeAnalysen.get(key) === p) laufendeAnalysen.delete(key); throw err; });
    Object.defineProperty(p, 'laeuft', { get: () => eintrag.laeuft });
    // noch nicht bei der Engine (startet gerade): mit 'vorne' einreihen; wartet schon: nach vorne holen
    p.vorziehen = () => {
      eintrag.vorne = true;
      if (eintrag.engine && !eintrag.laeuft && typeof eintrag.engine.vorziehen === 'function') eintrag.engine.vorziehen(fen);
    };
    laufendeAnalysen.set(key, p);
    return p;
  }
  // Analyse der aktuellen Stellung: Balken und Ereignis stellung:analysiert (je Stellung einmal)
  function beiAnalyse(fen, a) {
    if (weg) return;
    const key = stellungsSchluessel(fen);
    if (key !== stellungsSchluessel(z.chess.fen())) return;
    setzeBalken(a);
    const marke = z.zuege.length + '|' + key;
    if (z.analyseGesendet === marke || !a || !Array.isArray(a.lines) || !a.lines.length) return;
    z.analyseGesendet = marke;
    sende('stellung:analysiert', {
      laufId, fen: z.chess.fen(), plies: z.zuege.length, amZug: z.chess.turn() === farbe ? 'flo' : 'bot',
      analyse: { depth: a.depth ?? null, lines: a.lines.map((l) => ({ eval: l.eval, pv: Array.isArray(l.pv) ? l.pv.slice() : [] })) },
    });
  }
  function balkenAktualisieren() {
    const a = app.vorab.get(stellungsSchluessel(z.chess.fen()));
    if (a) beiAnalyse(z.chess.fen(), a);
    else analysiere(z.chess.fen()).catch(() => {});
  }

  function buchInfo(ply) {
    if (startFen) return { buch: false, name: null };
    const er = eroeffnung(z.san.slice(0, ply + 1));
    return { buch: !!er.buch[ply], name: er.namen[ply] || er.name };
  }

  // Live-Bewertung eines eigenen Zugs; das Ergebnis ordnet sich ueber die Marke dem Ply zu
  async function bewerte(ply) {
    const eintrag = z.live[ply];
    const marke = eintrag.marke;
    const veraltet = () => weg || z.live[ply] !== eintrag || eintrag.marke !== marke;
    const fenVorher = z.fens[ply];
    const uci = z.zuege[ply];
    try {
      const e = await bewertungsEngine();
      const aV = await analysiere(fenVorher);
      if (veraltet()) return;
      // Gegnerzug davor einordnen (fuer "Verschenkt")
      let gegnerKlasse = null;
      let vorigerZug = null;
      let vorigerSchlag = false;
      if (ply > 0 && !istFlo(ply - 1)) {
        vorigerZug = z.zuege[ply - 1];
        vorigerSchlag = !!(z.verbose[ply - 1] && z.verbose[ply - 1].captured);
        try {
          const aB = await analysiere(z.fens[ply - 1]);
          if (veraltet()) return;
          if (aB && aB.lines && aB.lines.length && aV && aV.lines && aV.lines.length) {
            gegnerKlasse = klassifiziere({ fenVorher: z.fens[ply - 1], uci: vorigerZug, analyseVorher: aB, analyseNachher: aV, du: false }).klasse;
          }
        } catch (err) { /* ohne Gegnerklasse weiter */ }
      }
      // Stellung nach dem Zug ueber dieselbe Warteschlange (wird so nur einmal gerechnet)
      const aN = await analysiere(z.fens[ply + 1]);
      if (veraltet()) return;
      const b = buchInfo(ply);
      const erg = await bewerteZug(e, fenVorher, uci, {
        tiefe: tiefe(), multipv: 2, analyseVorher: aV, analyseNachher: aN, buch: b.buch, eroeffnung: b.name,
        gegnerKlasse, vorigerZug, vorigerSchlag, du: true, ply,
      });
      app.vorab.set(stellungsSchluessel(fenVorher), erg.analyseVorher);
      app.vorab.set(stellungsSchluessel(erg.fenNachher), erg.analyseNachher);
      beiAnalyse(erg.fenNachher, erg.analyseNachher);
      if (veraltet()) return;
      eintrag.status = 'fertig';
      eintrag.erg = erg;
      z.liveKlassen[ply] = erg.klasse;
      z.liveTrivial[ply] = erg.trivial === true;
      merkeSerie();
      speichereLaufend();
      zeigeBewertung(ply);
      if (veraltet()) return;
      sende('zug:bewertet', {
        laufId, ply, uci: erg.uci, sanDe: erg.sanDe, klasse: erg.klasse, verlust: erg.verlust, genauigkeit: erg.genauigkeit,
        gewinnVorher: erg.gewinnVorher, gewinnNachher: erg.gewinnNachher, gewinnZweiter: erg.gewinnZweiter ?? null,
        gewinnVorigerZug: gewinnNachVorigemZug(ply),
        besterZug: erg.besterZug, besterZugSanDe: erg.besterZugSanDe, trivial: erg.trivial === true,
        serie: serieBis(ply), serieVorher: serieBis(ply - 1), letzter: ply === letzterFloPly(), live: liveAn(),
      });
    } catch (err) {
      if (veraltet()) return;
      eintrag.status = 'fehler';
      if (!err || !err.abgebrochen) console.warn('Live-Bewertung fehlgeschlagen', err);
      if (ply === letzterFloPly() && liveAn()) {
        coachZeige(`<span class="c-symbol c-icon">${icon('ziel')}</span><div class="c-kopf"><span class="c-klasse">Coach</span><span class="c-zug">${esc(zugLabel(ply))}</span></div>
          <p class="c-text">Diesen Zug konnte ich gerade nicht bewerten. In der Analyse siehst du ihn trotzdem.</p>`, 'leer', ply);
        brett.markiere(null, 'bewertung');
      }
      zeichneZugliste();
    } finally {
      if (z.live[ply] === eintrag) eintrag.erledigt();
    }
  }

  function zeigeBewertung(ply) {
    const e = z.live[ply];
    const k = e.erg.klasse;
    zeichneZugliste();
    if (ply !== letzterFloPly()) return;   // inzwischen weiter gezogen: nur die Zugliste
    const botHatGezogen = z.zuege.length > ply + 1;
    const an = liveAn();
    if (an) coachErgebnis(ply);
    if (!botHatGezogen && z.phase !== 'ende' || z.phase === 'ende' && z.zuege.length === ply + 1) {
      const nach = e.erg.uci.slice(2, 4);
      brett.markiere(null, 'bewertung');
      if (an) {
        brett.markiere([nach], 'k-' + k);
        brett.zeigeAbzeichen(nach, k);
        effekt(nach, k);
        // Klang zur Klasse (PLAN 3.6, Pakete: registriereKlang('klasse')). U7, Takt (3.7): 150 ms nach der Landung der
        // Figur (kommt die Bewertung spaeter, sofort mit dem Abzeichen) und nur einer je Moment: hat die Landung schon
        // Schach oder Umwandlung gemeldet, bleibt ein Praezise/COMBO-Klang still
        const info = Object.freeze({ serie: serieBis(ply), serieVorher: serieBis(ply - 1), trivial: z.liveTrivial[ply] === true, ply });
        const w = klassenKlang(k, info);
        const lande = z.landung[ply] || null;
        const verdraengt = !!(w && (w.name === 'bester' || w.name === 'combo') && lande && (lande.name === 'schach' || lande.name === 'umwandlung'));
        const ms = Math.max(0, Math.round((lande ? lande.um : 0) + BEWERTUNG_NACH_MS - jetzt()));
        if (!verdraengt) spaeter(() => klang.klasse(k, info), ms);
        melde({ typ: 'bewertungsklang', ply, klasse: k, name: w ? w.name : null, ms, still: verdraengt });
        melde({ typ: 'abzeichen', ply, klasse: k });
      }
    }
    e.gezeigtUm = jetzt();
    if (an && z.phase !== 'ende') {
      if (SCHLECHT.has(k)) zeigeBlase('spielerFehler', ply, { prio: 70 });
      else if (k === 'brillant' || k === 'stark') zeigeBlase('spielerGut', ply, { prio: 70 });
    }
    if (botHatGezogen) planeKompakt();
  }

  function planeKompakt() {
    clearTimeout(z.kompaktUhr);
    z.kompaktUhr = spaeter(() => {
      if (coachEl.classList.contains('wartet') || coachEl.classList.contains('leer') || zusatzBleibt()) return;
      coachEl.classList.add('kompakt');
      coachEl.classList.remove('neu');
    }, 3500);
  }

  // ---------- Eigener Zug ----------
  function vorzugZiele() {
    const karte = {};
    const code = (f) => brett.figurAuf(f);
    const feld = (x, y) => x >= 0 && x < 8 && y >= 1 && y <= 8 ? String.fromCharCode(97 + x) + y : null;
    const fuege = (liste, x, y) => { const f = feld(x, y); if (f && (!code(f) || code(f)[0] !== farbe)) liste.push(f); return f; };
    for (let y = 1; y <= 8; y++) for (let x = 0; x < 8; x++) {
      const von = feld(x, y); const fig = code(von);
      if (!fig || fig[0] !== farbe) continue;
      const liste = [];
      if (fig[1] === 'P') {
        const dy = farbe === 'w' ? 1 : -1;
        const eins = feld(x, y + dy);
        if (eins && !code(eins)) {
          liste.push(eins);
          const zwei = feld(x, y + 2 * dy);
          if (y === (farbe === 'w' ? 2 : 7) && zwei && !code(zwei)) liste.push(zwei);
        }
        fuege(liste, x - 1, y + dy); fuege(liste, x + 1, y + dy);
      } else if (fig[1] === 'N') {
        for (const [dx, dy] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]) fuege(liste, x + dx, y + dy);
      } else if (fig[1] === 'K') {
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) fuege(liste, x + dx, y + dy);
      } else {
        const gerade = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const diagonal = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
        const richtungen = fig[1] === 'B' ? diagonal : fig[1] === 'R' ? gerade : gerade.concat(diagonal);
        for (const [dx, dy] of richtungen) for (let n = 1; n < 8; n++) {
          const ziel = feld(x + dx * n, y + dy * n); if (!ziel) break;
          const dort = code(ziel);
          if (!dort || dort[0] !== farbe) liste.push(ziel);
          if (dort) break;
        }
      }
      if (liste.length) karte[von] = [...new Set(liste)];
    }
    return karte;
  }

  // U7: Flo ist am Zug: Zielkarte (mit Turm-auf-Koenig-Rochade nach Einstellung) und Zug bestaetigen
  function erlaubeFlo() {
    const tr = app.einstellungen().turmRochade === true;
    brett.setzeTurmRochade(tr);
    brett.erlaubeZuege(zielKarte(z.chess, { turmRochade: tr }));
    aktualisiereBestaetigen();
  }
  // Zug bestaetigen (PLAN 4): 'ohneUhr' nur ohne Bedenkzeit, 'immer', 'aus'; nur fuer echte Zuege (nie fuer Vorzuege)
  const bestaetigenAn = () => {
    const w = app.einstellungen().zugBestaetigen;
    return w === 'immer' || (w !== 'aus' && !z.tempo);
  };
  function aktualisiereBestaetigen() {
    brett.setzeBestaetigen(bestaetigenAn() && z.phase === 'flo');
  }

  function zeichneVorzuege() {
    brett.markiere(z.vorzuege.map((v) => v.von), 'vorzug-start');
    brett.markiere(z.vorzuege.map((v) => v.nach), 'vorzug-ziel');
  }

  function loescheVorzuege() {
    const hatte = z.vorzuege.length > 0;
    z.vorzuege.length = 0;
    brett.markiere(null, 'vorzug-start'); brett.markiere(null, 'vorzug-ziel');
    if (!hatte) return;
    brett.setzeStellung(z.chess.fen(), { animieren: false, letzterZug: letzterZugFelder(), schach: z.chess.inCheck() ? true : null });
    if (z.phase === 'bot' && app.einstellungen().vorzuege !== false) brett.erlaubeZuege(vorzugZiele());
  }

  function merkeVorzug(von, nach, umwandlung) {
    if (z.vorzuege.length >= 5) return false;
    z.vorzuege.push({ von, nach, umwandlung: umwandlung || 'q' });
    zeichneVorzuege();
    klang.spiele('klick');
    brett.erlaubeZuege(z.vorzuege.length < 5 ? vorzugZiele() : null);
    return true;
  }

  // info (board.js): { art, landung } - landung: ms, bis die Figur auf dem Ziel steht (0: steht schon dort)
  function beiZug(von, nach, umwandlung, info = null) {
    if (weg) return false;
    if (z.phase === 'bot' && app.einstellungen().vorzuege !== false) return merkeVorzug(von, nach, umwandlung);
    if (z.phase !== 'flo') return false;
    let m = null;
    try { m = z.chess.move({ from: von, to: nach, promotion: umwandlung || 'q' }); } catch (e) { m = null; }
    if (!m) return false;
    spieleEigenenZug(m, info && Number.isFinite(info.landung) ? info.landung : brett.gleitDauer());
    return true;
  }

  function spieleEigenenZug(m, landungMs = 0) {
    const ply = z.zuege.length;
    merkeZug(m);
    neuerLiveEintrag(ply);
    z.phase = 'gezogen';
    aktualisiereBestaetigen();
    queueMicrotask(() => nachEigenemZug(ply, m, landungMs));
  }

  function fuehreVorzugAus() {
    if (!z.vorzuege.length || weg || z.phase === 'ende') return false;
    const v = z.vorzuege.shift();
    let m = null;
    try { m = z.chess.move({ from: v.von, to: v.nach, promotion: v.umwandlung || 'q' }); } catch (e) { m = null; }
    if (!m) { loescheVorzuege(); return false; }
    brett.markiere(null, 'vorzug-start'); brett.markiere(null, 'vorzug-ziel');
    spieleEigenenZug(m, brett.gleitDauer());
    return true;
  }

  function neuerLiveEintrag(ply) {
    let erledigt;
    const fertig = new Promise((r) => { erledigt = r; });
    z.live[ply] = { marke: {}, status: 'rechnet', erg: null, fertig, erledigt, gezeigtUm: 0 };
  }

  function nachEigenemZug(ply, m, landungMs = 0) {
    if (weg) return;
    const an = liveAn();
    brett.entferneAbzeichen();
    brett.markiere(null);
    brett.pfeile([]);
    // U7: Flos eigene Pfeile und Marken gelten bis zu seinem naechsten Zug (ueber Bot-Zuege hinweg bleiben sie)
    brett.loescheNutzerPfeile();
    z.ideeAn = null;
    brett.setzeStellung(z.chess.fen(), {
      animieren: true, letzterZug: an ? [m.from, m.from] : [m.from, m.to], schach: z.chess.inCheck() ? true : null,
    });
    if (an) brett.markiere([m.to], 'bewertung');
    sendeZug(ply, m, 'flo');
    spieleKlang(m, landungMs, ply);
    versteckeBlase();
    z.hinweisFen = null;
    z.hinweisStufe = 0;
    melde({ typ: 'zug', wer: 'flo', uci: m.lan, ply });
    if (an) coachRechnet(ply);
    zeichneKopf();
    zeichneZugliste();
    zeichneGeschlagen();
    speichereLaufend();
    bewerte(ply);
    if (pruefeEnde()) return;
    botAmZug();
  }

  function sendeZug(ply, m, wer) {
    sende('zug:gespielt', {
      laufId, ply, wer, uci: m.lan, san: m.san, fenVorher: m.before, fenNachher: m.after,
      geschlagen: m.captured || null, schach: z.chess.inCheck(), matt: z.chess.isCheckmate(),
      umwandlung: m.promotion || null, rochade: !!(m.isKingsideCastle() || m.isQueensideCastle()),
    });
  }

  // U7, Klang-Takt (PLAN 3.7): der Zugklang sitzt auf der Landung der Figur (landungMs: Gleitdauer des Bretts, 0 =
  // steht schon, z. B. gezogen oder Bewegung aus), WebAudio plant ihn genau (wann). Gemerkt fuer den Bewertungsklang.
  function spieleKlang(m, landungMs = 0, ply = z.zuege.length - 1) {
    const ms = Math.max(0, Number(landungMs) || 0);
    let name = null;
    if (!z.chess.isGameOver()) {  // Ende-Klang kommt mit dem Ergebnis
      if (z.chess.inCheck()) name = 'schach';
      else if (m.promotion) name = 'umwandlung';
      else if (m.isKingsideCastle() || m.isQueensideCastle()) name = 'rochade';
      else if (m.captured) name = 'schlagen';
      else name = 'zug';
    }
    z.landung[ply] = { name, um: jetzt() + ms };
    if (!name) return;
    klang[name]({ wann: ms / 1000 });
    melde({ typ: 'klang', name, ply, wann: ms });
  }

  // ---------- Bot ----------
  function notZug() {
    const liste = z.chess.moves({ verbose: true });
    if (!liste.length) return null;
    const schlag = liste.filter((x) => x.captured);
    const w = (schlag.length ? schlag : liste)[Math.floor(Math.random() * (schlag.length || liste.length))];
    return { uci: w.lan, san: w.san };
  }

  async function botAmZug() {
    if (weg || z.phase === 'ende') return;
    z.phase = 'bot';
    aktualisiereBestaetigen();
    if (z.vorzuege.length) { brett.zeigeVorzuege(z.vorzuege); zeichneVorzuege(); }
    brett.erlaubeZuege(app.einstellungen().vorzuege === false ? null : vorzugZiele());
    setzeDenkt(true);
    zeichneKnoepfe();
    const ctrl = new AbortController();
    z.botCtrl = ctrl;
    const fen = z.chess.fen();
    let zug = null;
    try {
      const test = app.test && window.__test;
      if (test && typeof test.botZug === 'function') {
        await warte(test.botPause ?? 300, ctrl.signal);
        const u = test.botZug(fen);
        if (u) zug = { uci: u };
      }
      if (!zug && !ctrl.signal.aborted) {
        const e = await app.engine('bot');
        engBot = e;
        if (ctrl.signal.aborted) return;
        // W0+a: Zufall aus dem Seed (je Halbzug), feste Knoten und Vorliebe aus dem Bot-Profil
        zug = await botZug(e, fen, zugBot, {
          zugNummer: z.zuege.length + 1, signal: ctrl.signal,
          zufall: z.seed != null ? zugZufall(z.seed, z.zuege.length) : Math.random,
          nodes: bot.nodes || null, vorliebe: bot.vorliebe || null,
        });
      }
    } catch (err) {
      if (ctrl.signal.aborted || weg) return;
      console.warn('Bot-Zug fehlgeschlagen, Ersatzzug', err);
      if (!z.engineGemeldet) app.meldung('Die Engine hakt gerade. Der Bot zieht aus dem Bauch heraus.', { art: 'fehler' });
      z.engineGemeldet = true;
      zug = null;
    }
    if (ctrl.signal.aborted || weg) return;
    if (!zug) zug = notZug();
    if (!zug) return;
    while (app.test && window.__test && window.__test.botAnhalten && !ctrl.signal.aborted && !weg) await warte(80, ctrl.signal);
    // Flo soll sein Bewertungs-Symbol kurz sehen, bevor der Bot zieht
    const fp = letzterFloPly();
    const e = fp >= 0 ? z.live[fp] : null;
    if (e && liveAn() && fp === z.zuege.length - 1) {
      const maxWarten = (app.test && window.__test && window.__test.maxWarten) ?? 2500;
      if (e.status === 'rechnet') await Promise.race([e.fertig, warte(maxWarten, ctrl.signal)]);
      if (e.gezeigtUm && maxWarten > 0) {
        const rest = 650 - (jetzt() - e.gezeigtUm);
        if (rest > 0) await warte(rest, ctrl.signal);
      }
    }
    if (ctrl.signal.aborted || weg || z.chess.fen() !== fen) return;
    fuehreBotZugAus(zug.uci);
  }

  function fuehreBotZugAus(uci) {
    let m = null;
    try { m = z.chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined }); } catch (e) { m = null; }
    if (!m) { const n = notZug(); if (n && n.uci !== uci) fuehreBotZugAus(n.uci); return; }
    const ply = z.zuege.length;
    merkeZug(m);
    z.botCtrl = null;
    setzeDenkt(false);
    brett.entferneAbzeichen();
    brett.markiere(null);
    brett.pfeile([]);
    z.ideeAn = null;
    brett.setzeStellung(z.chess.fen(), { animieren: true, letzterZug: [m.from, m.to], schach: z.chess.inCheck() ? true : null });
    sendeZug(ply, m, 'bot');
    spieleKlang(m, brett.gleitDauer(), ply);
    melde({ typ: 'zug', wer: 'bot', uci: m.lan, ply });
    const paar = ply - 1;
    if (m.captured) zeigeBlase('schlagen', paar, { prio: 50 });
    else if (z.chess.inCheck()) zeigeBlase('schach', paar, { prio: 50 });
    const fp = letzterFloPly();
    if (fp >= 0 && z.live[fp] && z.live[fp].status === 'fertig') planeKompakt();
    zeichneKopf();
    zeichneZugliste();
    zeichneGeschlagen();
    speichereLaufend();
    if (pruefeEnde()) return;
    z.phase = 'flo';
    if (fuehreVorzugAus()) return;
    erlaubeFlo();
    zeichneKnoepfe();
    balkenAktualisieren();
  }

  function abbrechenBot() {
    if (z.botCtrl) { z.botCtrl.abort(); z.botCtrl = null; }
    if (engBot) { try { engBot.stop({ warteschlange: true }); } catch (e) { /* egal */ } }
    setzeDenkt(false);
  }

  // ---------- Hinweis, Zuruecknehmen, Drehen ----------
  async function hinweis() {
    loescheVorzuege();
    if (z.phase !== 'flo' || z.hinweisRechnet) return;   // zweites Tippen waehrend der Rechnung
    const fen = z.chess.fen();
    if (z.hinweisFen !== fen) { z.hinweisFen = fen; z.hinweisStufe = 0; }
    const k = $('.spielknoepfe > [data-aktion="hinweis"]');
    k.classList.add('rechnet');
    z.hinweisRechnet = true;
    let a = null;
    try { a = await analysiere(fen, { vorne: true }); } catch (e) { a = null; }
    z.hinweisRechnet = false;
    k.classList.remove('rechnet');
    if (weg || z.chess.fen() !== fen || z.phase !== 'flo') return;
    const best = a && a.lines && a.lines[0] && (a.lines[0].pv[0] || a.bestmove);
    if (!best) { app.meldung('Gerade kein Hinweis möglich.'); return; }
    if (z.hinweisStufe === 0) {
      z.hinweisStufe = 1;
      z.hinweise++;
      brett.markiere([best.slice(0, 2)], 'hinweis');
      if (z.hinweise === 1) app.meldung('Hinweis: diese Figur. Nochmal tippen zeigt den Zug. Der 3. Stern ist für diese Partie weg.');
      melde({ typ: 'hinweis', stufe: 1, feld: best.slice(0, 2) });
    } else {
      z.hinweisStufe = 2;
      brett.markiere([best.slice(0, 2)], 'hinweis');
      brett.pfeile([{ von: best.slice(0, 2), nach: best.slice(2, 4), farbe: 'hinweis' }]);
      z.ideeAn = 'hinweis';
      melde({ typ: 'hinweis', stufe: 2, zug: best });
    }
    sende('hilfe:genutzt', { laufId, art: 'hinweis', stufe: z.hinweisStufe });
    speichereLaufend();
    zeichneKnoepfe();
  }

  function zuruecknehmen() {
    loescheVorzuege();
    if (z.phase === 'ende' || z.phase === 'start') return;
    const fp = letzterFloPly();
    if (fp < 0) { app.meldung('Es gibt noch keinen eigenen Zug zum Zurücknehmen.'); return; }
    abbrechenBot();
    const anzahl = z.zuege.length - fp;
    for (let i = 0; i < anzahl; i++) {
      z.chess.undo();
      z.zuege.pop(); z.san.pop(); z.verbose.pop(); z.fens.pop(); z.liveKlassen.pop(); z.liveTrivial.pop();
      const e = z.live.pop();
      if (e && e.erledigt) e.erledigt();   // wartende Bot-Pause loesen; Marke ist damit veraltet
    }
    z.zuruecknahmen++;
    merkeSerie();
    sende('zug:zurueckgenommen', { laufId, bisPly: fp, plies: anzahl });
    if (z.zuruecknahmen === 1) app.meldung('Zug zurückgenommen. Der 3. Stern ist für diese Partie weg.');
    brett.entferneAbzeichen();
    brett.markiere(null);
    brett.pfeile([]);
    z.ideeAn = null;
    z.hinweisFen = null;
    z.hinweisStufe = 0;
    brett.setzeStellung(z.chess.fen(), { animieren: true, letzterZug: letzterZugFelder(), schach: z.chess.inCheck() ? true : null });
    versteckeBlase();
    const vorher = letzterFloPly();
    if (vorher >= 0 && z.live[vorher] && z.live[vorher].status === 'fertig') { coachErgebnis(vorher, { neu: false }); coachEl.classList.add('kompakt'); }
    else coachLeer();
    melde({ typ: 'zuruecknahme', plies: anzahl });
    zeichneKopf();
    zeichneZugliste();
    zeichneGeschlagen();
    speichereLaufend();
    if (z.chess.turn() === farbe) {
      z.phase = 'flo';
      erlaubeFlo();
      zeichneKnoepfe();
      balkenAktualisieren();
    } else {
      botAmZug();
    }
  }

  function drehen() {
    loescheVorzuege();
    brett.dreheUm();
    balkenAusrichtung();
    melde({ typ: 'drehen', ausrichtung: brett.ausrichtung });
  }

  async function aufgebenFragen() {
    loescheVorzuege();
    if (z.phase === 'ende') return;
    const ok = await app.frage({
      titel: 'Wirklich aufgeben?',
      text: `Die Partie gegen ${bot.name} zählt dann als Niederlage.`,
      knoepfe: [{ text: 'Weiterspielen', wert: false }, { text: 'Aufgeben', wert: true, art: 'gefahr' }],
      abbrechen: false,
    });
    if (ok && !weg) ende('niederlage', 'aufgabe');
  }

  async function zurueckGedrueckt() {
    if (z.phase === 'ende') { app.gehe('arena'); return; }
    let floZuege = 0;
    for (let i = 0; i < z.zuege.length; i++) if (istFlo(i)) floZuege++;
    if (floZuege === 0) { z.verworfen = true; loescheLaufendePartie(); app.gehe('arena'); return; }
    const w = await app.frage({
      titel: 'Partie unterbrechen?',
      text: 'Pausieren: Die Partie bleibt gespeichert und du setzt sie später in der Arena fort.',
      knoepfe: [{ text: 'Weiterspielen', wert: null }, { text: 'Aufgeben', wert: 'aufgeben', art: 'gefahr' }, { text: 'Pausieren', wert: 'pause', art: 'primaer' }],
      abbrechen: null,
    });
    if (weg) return;
    if (w === 'pause') { speichereLaufend(); app.gehe('arena'); }
    else if (w === 'aufgeben') ende('niederlage', 'aufgabe');
  }

  // ---------- Speichern ----------
  function stand() {
    return {
      botId: bot.id, spielerFarbe: farbe, startFen: startFen || null, zuege: z.zuege.slice(),
      hinweise: z.hinweise, zuruecknahmen: z.zuruecknahmen, liveKlassen: z.liveKlassen.slice(), gestartet: z.gestartet,
      modus: z.modus, ziel: z.ziel, extra: z.extra, maxSerie: z.maxSerie,
      liveTrivial: z.zuege.map((_, i) => z.liveTrivial[i] === true),
      ...spielFelder(),
    };
  }
  // W0+a: seed, boss, liga, tempo, zeiten (nur gesetzte; storage prueft sie)
  function spielFelder() {
    const f = {};
    if (z.seed != null) f.seed = z.seed;
    if (z.boss) f.boss = { ...z.boss };
    if (z.liga) f.liga = { ...z.liga };
    if (z.tempo) f.tempo = { ...z.tempo };
    if (z.zeiten) f.zeiten = z.zeiten.slice();
    return f;
  }
  function speichereLaufend() {
    if (z.phase === 'ende' || z.verworfen || weg) return;
    speichereLaufendePartie(stand());
  }

  // ---------- Spielende ----------
  function pruefeEnde() {
    const c = z.chess;
    if (c.isCheckmate()) { ende(c.turn() === farbe ? 'niederlage' : 'sieg', 'matt'); return true; }
    if (c.isStalemate()) { ende('remis', 'patt'); return true; }
    if (c.isInsufficientMaterial()) { ende('remis', 'material'); return true; }
    if (c.isThreefoldRepetition()) { ende('remis', 'wiederholung'); return true; }
    if (c.isDrawByFiftyMoves()) { ende('remis', '50-zuege'); return true; }
    return false;
  }

  // Genauigkeit aus der Live-Bewertung, nur wenn jeder eigene Zug bewertet ist (sonst null:
  // nach dem Fortsetzen fehlen die Zuege davor, das ergaebe zum Beispiel 100 % aus einem Zug).
  // Gleiches Verfahren wie die Spielanalyse (volatilitaetsgewichtet); der Wert ist vorlaeufig, die erste
  // volle Analyse ersetzt ihn (storage.ergaenzeAnalyse, genauigkeitQuelle 'live').
  function livGenauigkeit() {
    const l = [];
    for (let i = 0; i < z.zuege.length; i++) {
      if (!istFlo(i)) { l.push(null); continue; }
      const e = z.live[i];
      if (!e || !e.erg || !Number.isFinite(e.erg.genauigkeit)) return null;
      l.push(e.erg);
    }
    const g = seitenGenauigkeit(l, farbe, z.zuege.length);
    return Number.isFinite(g) ? g : null;
  }
  const liveKlassenListe = () => z.zuege.map((_, i) => (istFlo(i) ? z.liveKlassen[i] || null : null));

  // Datensatz direkt beim Spielende, noch ohne Analyse (die traegt ergaenzeAnalyse nach)
  function baueDatensatz(ergebnis, grund) {
    return {
      botId: bot.id, botStufe: bot.stufe, spielerFarbe: farbe, startFen: startFen || null,
      zuege: z.zuege.slice(), san: z.san.slice(), ergebnis, grund,
      hinweise: z.hinweise, zuruecknahmen: z.zuruecknahmen,
      liveKlassen: liveKlassenListe(),
      genauigkeit: null, genauigkeitBot: null, spielstaerke: null,
      eroeffnung: startFen ? null : eroeffnung(z.san).name,
      gestartet: z.gestartet,
      modus: z.modus, ziel: z.ziel || undefined, extra: Object.keys(z.extra).length ? z.extra : undefined, maxSerie: z.maxSerie,
      ...spielFelder(),
    };
  }

  let overlay = null;
  let endeDaten = null;
  let aktuellErg = null;
  async function ende(ergebnis, grund) {
    if (z.phase === 'ende') return;
    loescheVorzuege();
    z.phase = 'ende';
    if (app.schliesseDialog) app.schliesseDialog();   // z. B. "Wirklich aufgeben?", wenn der Bot mattsetzt
    abbrechenBot();
    brett.erlaubeZuege(null);
    brett.markiere(null, 'hinweis');
    z.ideeAn = null;
    zeichneKnoepfe();
    clearTimeout(z.kompaktUhr);
    endeDaten = { ergebnis, grund };
    // W0+a: Bietet jemand einen Finisher an, ersetzt er den Klassen-Effekt des Mattzugs
    z.finisher = grund === 'matt' && angeboten('partie:matt') > 0;
    // Ergebnis sofort sichern (Sieg, Sterne 1 und 3, Freischaltung), erst danach die laufende
    // Partie loeschen: Wird die App waehrend der Auswertung beendet, geht nichts verloren.
    speichere(ergebnis, grund);
    planeBeendet();
    // Coach ohne "Zuruecknehmen" neu zeichnen (die Partie ist vorbei)
    const fpEnde = letzterFloPly();
    if (fpEnde >= 0 && z.live[fpEnde] && z.live[fpEnde].status === 'fertig' && liveAn()) {
      const kompakt = coachEl.classList.contains('kompakt');
      coachErgebnis(fpEnde, { neu: false });
      if (kompakt) coachEl.classList.add('kompakt');
    }
    klang.ende(ergebnis === 'sieg' ? true : ergebnis === 'niederlage' ? false : null);
    zeigeBlase(ergebnis === 'sieg' ? 'verliert' : ergebnis === 'niederlage' ? 'gewinnt' : 'remis', 'ende', { dauer: 0, immer: true });
    melde({ typ: 'ende', ergebnis, grund });
    s.classList.add('ist-ende');
    if (grund !== 'aufgabe') balkenAktualisieren();
    const auswertung = werteAus();
    // W0+a: Finisher (Aufruf-Ort partie:matt) nach partie:beendet und vor dem Ergebnis, hoechstens BRETT_FEIER.dauerMs
    const finisher = z.finisher ? mattHook(ergebnis) : null;
    await warte(grund === 'aufgabe' ? 250 : 900);
    if (finisher) await finisher;
    if (weg) return;
    overlay = baueOverlay(ergebnis, grund);
    // Das Ergebnis wartet nur kurz auf die Auswertung (nach dem Fortsetzen kann sie lange
    // dauern): Knoepfe und Sterne kommen sofort, die Genauigkeit wird nachgereicht.
    const frueh = await Promise.race([auswertung, warte(AUSWERTUNG_WARTEN_MS).then(() => undefined)]);
    if (weg) return;
    sendeBeendet();   // spaetestens jetzt, vor den Feier-Zeilen
    if (frueh !== undefined) { overlay.fuelle(frueh || z.gespeichert, frueh ? frueh.review : null); return; }
    overlay.fuelle(z.gespeichert, null, { rechnet: true });
    const spaet = await auswertung;
    if (weg) return;
    overlay.fuelle(spaet || z.gespeichert, spaet ? spaet.review : null, { nachtrag: true });
  }

  function speichere(ergebnis, grund) {
    if (z.gespeichert) return z.gespeichert;
    const erg = speicherePartie(baueDatensatz(ergebnis, grund), null);
    loescheLaufendePartie();
    z.gespeichert = erg;
    melde({ typ: 'gespeichert', id: erg.partie.id });
    z.beendetDaten = { ergebnis, grund, dauerMs: Date.now() - Date.parse(z.gestartet) };
    return erg;
  }

  // partie:beendet: nach dem Speichern, sobald die Live-Bewertung des letzten eigenen Zugs da ist
  // (dann stimmen liveKlassen und maxSerie), hoechstens AUSWERTUNG_WARTEN_MS spaeter, immer vor den
  // Feier-Zeilen des Overlays. Verlaesst Flo den Screen vorher, kommt es in verlasse(). Nur einmal.
  function sendeBeendet() {
    const g = z.gespeichert;
    if (!g || z.beendetGesendet) return;
    z.beendetGesendet = true;
    beendetGemeldet();
    const p = g.partie;
    const d = z.beendetDaten || {};
    sende('partie:beendet', {
      laufId, partieId: p.id, botId: bot.id, botStufe: bot.stufe, farbe, modus: z.modus, wertet: g.wertet !== false,
      ergebnis: d.ergebnis, grund: d.grund, eigeneZuege: z.zuege.filter((_, i) => istFlo(i)).length, liveKlassen: liveKlassenListe(),
      maxSerie: z.maxSerie, hinweise: z.hinweise, zuruecknahmen: z.zuruecknahmen, neueSterne: g.neueSterne.slice(),
      neuFreigeschaltet: g.neuFreigeschaltet ? g.neuFreigeschaltet.id : null, extra: kopie(z.extra) || {},
      datum: p.datum, dauerMs: Number.isFinite(d.dauerMs) ? Math.max(0, d.dauerMs) : null,
      boss: z.boss ? { ...z.boss } : null, seed: z.seed,
    });
  }
  // W0+a: Promise auf partie:beendet (fuer den Matt-Hook)
  let beendetGemeldet = () => {};
  const beendetDa = new Promise((r) => { beendetGemeldet = r; });

  // W0+a: Aufruf-Ort partie:matt. Wartet auf partie:beendet (w0plus-a-fix: hoechstens MATT_HOOK_WARTEN_MS, vorher
  // bis AUSWERTUNG_WARTEN_MS + 500), dann auf die Anbieter mit { fertig }, hoechstens BRETT_FEIER.dauerMs; ein Tipp
  // bricht ab. Kommt partie:beendet spaeter, laeuft der Finisher schon (partieId und Datensatz sind gespeichert).
  let mattOrt = null;
  // w0plus-a-fix: so lange wartet der Hook auf partie:beendet (nur im Testmodus per __test.mattHookWarten anders)
  const mattHookWarten = () => {
    const t = app.test && window.__test ? window.__test.mattHookWarten : undefined;
    return Number.isFinite(t) ? t : MATT_HOOK_WARTEN_MS;
  };
  async function mattHook(ergebnis) {
    // Ein Tipp gilt ab dem Mattzug: auch waehrend noch auf partie:beendet gewartet wird (der Finisher bekommt dann ein
    // schon abgebrochenes signal, zeigt hoechstens sein Endbild, und das Ergebnis wartet nicht)
    const ctrl = new AbortController();
    const tipp = () => ctrl.abort();
    s.addEventListener('pointerdown', tipp, true);
    try {
      await Promise.race([beendetDa, warte(mattHookWarten())]);
      if (weg) return;
      const m = z.verbose[z.verbose.length - 1] || null;
      const matt = z.chess.turn();
      let koenigFeld = null;
      for (const reihe of z.chess.board()) for (const f of reihe) if (f && f.type === 'k' && f.color === matt) koenigFeld = f.square;
      mattOrt = fuelle('partie:matt', null, {
        app, buehne, laufId, partieId: z.gespeichert ? z.gespeichert.partie.id : null, ergebnis,
        gewinner: ergebnis === 'sieg' ? 'flo' : 'bot', koenigFeld, fen: z.chess.fen(), reduziert: !!reduziert,
        letzterZug: m ? Object.freeze({ von: m.from, nach: m.to, san: m.san, figur: m.color + m.piece.toUpperCase() }) : null,
        signal: ctrl.signal, dauerMs: BRETT_FEIER.dauerMs, kurzMs: BRETT_FEIER.kurzMs,
      });
      melde({ typ: 'matt-hook', anzahl: mattOrt.anzahl, wartend: mattOrt.wartend, beendet: !!z.beendetGesendet });
      if (!mattOrt.anzahl) {
        // kein Finisher (alle Anbieter lieferten null): der Klassen-Effekt des Mattzugs kommt doch
        z.finisher = false;
        if (z.effektGemerkt) effekt(...z.effektGemerkt);
      }
      z.effektGemerkt = null;
      if (mattOrt.wartend > 0) await Promise.race([mattOrt.fertig, warte(BRETT_FEIER.dauerMs, ctrl.signal)]);
    } finally {
      melde({ typ: 'matt-hook-ende', abgebrochen: ctrl.signal.aborted });
      ctrl.abort();   // spaetestens jetzt springen die Finisher ans Ende
      s.removeEventListener('pointerdown', tipp, true);
    }
  }
  function planeBeendet() {
    const fp = letzterFloPly();
    const e = fp >= 0 ? z.live[fp] : null;
    if (!e || e.status !== 'rechnet') { sendeBeendet(); return; }
    Promise.race([e.fertig, warte(AUSWERTUNG_WARTEN_MS)]).then(() => { if (!weg) sendeBeendet(); });
  }

  // Spielanalyse rechnen und nachtragen. Liefert { partie, neueSterne, neuFreigeschaltet, review }
  // (Sterne aus dem Speichern und dem Nachtrag zusammen) oder null.
  async function werteAus() {
    // ausstehende Live-Bewertungen abwarten (die Analyse nutzt sie ueber app.vorab)
    const offen = [...z.live.filter((e) => e && e.status === 'rechnet').map((e) => e.fertig), ...laufendeAnalysen.values()];
    if (offen.length) await Promise.race([Promise.allSettled(offen), warte(8000)]);
    if (weg) return null;
    let review = null;
    try {
      const e = await bewertungsEngine();
      // Live-Suchen mit Zeitlimit (LIVE_MAX_MS, im Stau LIVE_STAU_MS) erreichen nicht immer die eingestellte
      // Tiefe: nur ausreichend tiefe wiederverwenden, flachere rechnet die Analyse neu (vorabMinTiefe)
      review = await analysierePartie(e, z.zuege, {
        tiefe: tiefe(), multipv: 2, startFen: startFen || undefined, spielerFarbe: farbe,
        elo: { [botFarbe]: botElo }, vorab: app.vorab, vorabMinTiefe: tiefe(), vorabMerken: true, signal: endeCtrl.signal,
        beiFortschritt: (f, n) => overlay && overlay.fortschritt(n ? f / n : 1),
      });
    } catch (err) {
      if (weg) return null;
      if (!err || !err.abgebrochen) console.warn('Auswertung fehlgeschlagen', err);
      review = null;
    }
    if (weg) return null;
    return nachtragen(review);
  }

  function nachtragen(review) {
    const g = z.gespeichert;
    if (!g || z.nachgetragen) return null;
    z.nachgetragen = true;
    // maxSerie mit: die Live-Bewertung des letzten Zugs kann nach dem Speichern kommen (Codex-Befund)
    aktualisierePartie(g.partie.id, { liveKlassen: liveKlassenListe(), maxSerie: z.maxSerie });
    const nach = review ? ergaenzeAnalyse(g.partie.id, review) : ergaenzeAnalyse(g.partie.id, null, { genauigkeit: livGenauigkeit() });
    if (!nach) return null;
    melde({ typ: 'nachgetragen', id: g.partie.id, mitAnalyse: !!review });
    const neueSterne = g.neueSterne.map((x, i) => x || nach.neueSterne[i]);
    if (review) {
      sendeBeendet();   // Reihenfolge: partie:beendet immer vor partie:analysiert
      sende('partie:analysiert', {
        partieId: g.partie.id, botId: bot.id, modus: nach.partie.modus || 'normal', wertet: nach.wertet !== false,
        partie: nach.partie, review, neueSterne, quelle: 'partie',
      });
    }
    return { partie: nach.partie, review, neueSterne, neuFreigeschaltet: g.neuFreigeschaltet, wertet: nach.wertet !== false };
  }

  // U7: Lichtblick (Ergebnis Niederlage): Flos bester Zug der Partie aus den Live-Klassen, bei Gleichstand der spaetere;
  // "Zug 14 Sf5: Präzise" (Theorie nur, wenn sonst nichts Gutes dabei war). Ohne so einen Zug null (dann keine Karte).
  const LICHTBLICK_RANG = ['brillant', 'stark', 'bester', 'exzellent', 'gut', 'buch'];
  function lichtblick() {
    let best = -1;
    let rang = LICHTBLICK_RANG.length;
    for (let i = 0; i < z.zuege.length; i++) {
      if (!istFlo(i)) continue;
      const r = LICHTBLICK_RANG.indexOf(z.liveKlassen[i]);
      if (r >= 0 && r <= rang) { rang = r; best = i; }
    }
    if (best < 0) return null;
    const k = z.liveKlassen[best];
    return { ply: best, klasse: k, text: `Zug ${nummerVon(best)} ${sanDeutsch(z.san[best])}: ${KLASSEN_NAME[k] || k}` };
  }

  // Chip nicht wertender Partien: je Modus, gegen angemeldete Bots im Modus normal "GAST" (w0plus-a-fix)
  function chipText() {
    if (MODUS_CHIP[z.modus] && z.modus !== 'uebung') return MODUS_CHIP[z.modus];
    if (z.modus === 'normal' && bot.stufe == null && !startFen) return 'GAST';
    return 'ÜBUNG';
  }

  // ---------- Ergebnis-Overlay ----------
  function baueOverlay(ergebnis, grund) {
    const o = document.createElement('div');
    o.className = `ergebnis-overlay ${ergebnis}`;
    o.setAttribute('role', 'dialog');
    o.setAttribute('aria-modal', 'true');
    o.setAttribute('aria-labelledby', 'erg-wort');
    // U7 (PLAN 2.6): "Sieg" mit goldenem Ausrufezeichen, Niederlage ruhig und kleiner, Remis gold-neutral
    const wort = { sieg: 'Sieg<span class="ausruf">!</span>', niederlage: 'Partie verloren', remis: 'Remis' }[ergebnis];
    const nr = nummerVon(Math.max(0, z.zuege.length - 1));
    let unter;
    if (grund === 'matt') unter = ergebnis === 'sieg' ? `Schachmatt im ${nr}. Zug gegen ${bot.name}` : `${bot.name} setzt dich im ${nr}. Zug matt`;
    else if (grund === 'aufgabe') unter = `Aufgegeben gegen ${bot.name}. Nächstes Mal klappt’s!`;
    else unter = `${GRUND_TEXT[grund] || 'Remis'} gegen ${bot.name}`;
    // Nicht wertende Partie (Uebung, eigene Stellung): Chip "ÜBUNG" neben dem Kopfwort, keine Sterne. Kein Konfetti mehr.
    const wertend = z.gespeichert ? z.gespeichert.wertet !== false : wertetJetzt();
    const kopfWort = `<h2 class="erg-wort disp" id="erg-wort">${wort}</h2>`;
    o.innerHTML = `
      <div class="ergebnis-karte">
        <button class="icon-knopf erg-zu" type="button" aria-label="Brett ansehen">${icon('auge')}</button>
        ${wertend ? kopfWort : `<div class="erg-kopf">${kopfWort}<span class="chip uebung" data-modus="${esc(z.modus)}">${chipText()}</span></div>`}
        <p class="erg-unter">${esc(unter)}</p>
        <div class="erg-mitte">
          <div class="erg-rechnet" role="status" aria-live="polite"><span class="c-klasse">Coach wertet die Partie aus</span>
            <span class="denkt grau"><i></i><i></i><i></i></span><div class="erg-balken"><i></i></div></div>
        </div>
        <div class="erg-feier" hidden></div><div class="erg-karte-ort" hidden></div>
        <div class="erg-bot"><span class="av"><img src="${esc(avatarVon(bot))}" alt=""></span><div class="sprechblase links"></div></div>
        <div class="erg-frei-ort"></div>
        <div class="erg-knoepfe"></div>
      </div>`;
    o.querySelector('.erg-bot .sprechblase').textContent = (s.querySelector('.blase-ort .sprechblase') || {}).textContent || botSatz(bot, ergebnis === 'sieg' ? 'verliert' : ergebnis === 'niederlage' ? 'gewinnt' : 'remis') || '';
    // U7: Bot-Sprueche aus: auch kein Spruch im Ergebnis
    o.querySelector('.erg-bot').hidden = app.einstellungen().sprueche === 'aus';
    o.querySelector('.erg-zu').addEventListener('click', () => {
      o.hidden = true;
      s.classList.remove('mit-ergebnis');
      $('.ergebnis-zeigen').hidden = false;
    });
    s.append(o);
    // U7: der Screen dahinter tritt zurueck (scale .975, nur transform), die Karte federt auf
    s.classList.add('mit-ergebnis');
    const karte = o.querySelector('.ergebnis-karte');
    karte.setAttribute('tabindex', '-1');
    karte.focus({ preventScroll: true });

    // ---------- Feier-Zeilen (feier.fuerOverlay) ----------
    // Neue Zeilen gleiten im Abstand von 200 ms ein und spielen ihren Klang (Klangstufe "Nur wichtige":
    // nur grosse). Antippen der Karte zeigt sofort alles. Schon gezeigte Zeilen bleiben ruhig stehen.
    const feierBox = o.querySelector('.erg-feier');
    const feierGezeigt = new Set();
    const feierUhren = new Set();
    karte.addEventListener('click', () => {
      feierBox.classList.add('alles');
      // w0plus-a-fix: auch die Abrechnung (SPIELKONZEPT 3.10 "Antippen zeigt sofort alles"); .alles an der Karte gilt
      // auch fuer eine Huelle, die der Nachtrag neu baut
      karte.classList.add('alles');
      for (const a of karte.querySelectorAll('.abrechnung')) a.classList.add('alles');
      for (const u of feierUhren) clearTimeout(u);
      feierUhren.clear();
    });
    function feierSymbol(symbol) {
      if (!symbol) return '';
      if (iconNamen().includes(symbol)) return `<span class="erg-f-symbol">${icon(symbol)}</span>`;
      return `<span class="erg-f-symbol">${esc(String(symbol).slice(0, 4))}</span>`;
    }
    function zeigeFeier(partieId) {
      let liste = [];
      try { liste = fuerOverlay(partieId); } catch (e) { console.error('Feier', e); liste = []; }
      feierBox.hidden = !liste.length;
      if (!liste.length) { feierBox.replaceChildren(); return; }
      const basis = feierGezeigt.size ? 0 : (ergebnis === 'sieg' && wertend ? 1500 : 700);
      let nr = 0;
      feierBox.replaceChildren(...liste.map((f) => {
        const schl = f.quelle + '|' + f.titel;
        const neu = !feierGezeigt.has(schl);
        const el = document.createElement('div');
        el.className = `erg-f-zeile ${f.art === 'gross' ? 'gross' : 'zeile'}${neu ? ' neu' : ''}`;
        el.dataset.quelle = f.quelle;
        el.innerHTML = `${feierSymbol(f.symbol)}<span class="erg-f-text"><b></b>${f.text ? '<small></small>' : ''}</span>`;
        el.querySelector('b').textContent = f.titel;
        if (f.text) el.querySelector('small').textContent = f.text;
        if (neu) {
          feierGezeigt.add(schl);
          const t = basis + nr * 200;
          const stufe = nr;
          el.style.setProperty('--t', t + 'ms');
          nr++;
          const u = spaeter(() => {
            feierUhren.delete(u);
            if (klang.stufe === 'wichtig' && f.art !== 'gross') return;
            if (f.klang) klang.spiele(f.klang, stufe);
            else klang.spiele('feier', stufe);
          }, t);
          feierUhren.add(u);
        }
        return el;
      }));
    }

    // ---------- Ort ergebnis:karte (bei jedem fuelle neu) ----------
    const karteOrtEl = o.querySelector('.erg-karte-ort');
    let karteOrt = null;
    function fuelleKarte(erg, review, rechnet, nachtrag, wertet) {
      if (karteOrt) karteOrt.verlasse();
      karteOrt = fuelle('ergebnis:karte', karteOrtEl, {
        app, bot, farbe, ergebnis, grund, erg, review, rechnet, nachtrag, wertet, modus: z.modus, ziel: z.ziel,
        boss: z.boss ? Object.freeze({ ...z.boss }) : null,
      });
      karteOrtEl.hidden = karteOrt.anzahl === 0;
      return karteOrt.anzahl;
    }

    return {
      el: o,
      fortschritt(anteil) {
        const b = o.querySelector('.erg-balken i');
        if (b) b.style.width = Math.round(Math.max(0.05, Math.min(1, anteil)) * 100) + '%';
      },
      // erg: { partie, neueSterne, neuFreigeschaltet }. rechnet: Analyse laeuft noch (Genauigkeit
      // folgt), nachtrag: zweiter Aufruf mit Analyse (nur Stern 2, Genauigkeit und Tipp neu).
      // Aufraeumen beim Verlassen des Screens (Fuellung des Orts ergebnis:karte)
      verlasse() { if (karteOrt) karteOrt.verlasse(); karteOrt = null; },
      fuelle(erg, review, { rechnet = false, nachtrag = false } = {}) {
        aktuellErg = erg;
        const p = erg.partie;
        const wertet = erg.wertet !== false && wertend;
        zeigeFeier(p.id);
        const karten = fuelleKarte(erg, review, rechnet, nachtrag, wertet);
        const sterne = p.sterne || [false, false, false];
        const neueSterne = erg.neueSterne || [false, false, false];
        const gen = p.genauigkeit;
        const genText = Number.isFinite(gen) ? komma(gen) + ' %' : '-';
        const hilfe = [];
        if (p.hinweise > 0) hilfe.push(p.hinweise === 1 ? '1 Hinweis' : `${p.hinweise} Hinweise`);
        if (p.zuruecknahmen > 0) hilfe.push(p.zuruecknahmen === 1 ? '1 Zurücknahme' : `${p.zuruecknahmen} Zurücknahmen`);
        const ziele = [
          ['Gewonnen', `${bot.name.split(' ').pop()} besiegt`],
          rechnet ? ['Genauigkeit', 'wird berechnet …']
            : [Number.isFinite(gen) ? `${genText} genau` : 'Genauigkeit', sterne[1] ? `mindestens ${GENAUIGKEIT_STERN} %` : `${GENAUIGKEIT_STERN} % nötig`],
          ['Ohne Hilfe', hilfe.length ? hilfe.join(', ') : 'kein Hinweis, nichts zurückgenommen'],
        ];
        const sternHtml = (i) => {
          const [t, u] = ziele[i];
          const an = sterne[i] && !(rechnet && i === 1);
          return `<div class="erg-stern${an ? ' an' : ' aus'}${an && neueSterne[i] ? ' neu' : ''}${rechnet && i === 1 ? ' wartet' : ''}" style="--i:${i}" data-i="${i}">
              <span class="e-stern" aria-hidden="true">${icon('stern')}</span><b>${esc(t)}</b><small>${esc(u)}</small>
              ${an && neueSterne[i] ? '<span class="e-neu">NEU</span>' : ''}<span class="sr">${rechnet && i === 1 ? 'wird berechnet' : an ? 'erreicht' : 'nicht erreicht'}</span></div>`;
        };
        const rechnetHtml = `<div class="erg-rechnet" role="status" aria-live="polite"><span class="c-klasse">Coach wertet die Partie aus</span>
            <span class="denkt grau"><i></i><i></i><i></i></span><div class="erg-balken"><i></i></div></div>`;
        const mitte = o.querySelector('.erg-mitte');
        const staerke = p.spielstaerke ? ` · spielte wie ≈ ${p.spielstaerke}` : '';
        const genauHtml = (gross) => `<div class="erg-genau${gross ? ' gross' : ''}">Genauigkeit <b class="zahl" data-ziel="${Number.isFinite(gen) ? gen : ''}">${Number.isFinite(gen) ? '0,0 %' : '-'}</b>${gross ? (p.spielstaerke ? `<span>spielte wie ≈ ${p.spielstaerke}</span>` : '') : esc(staerke)}</div>`;
        if (ergebnis === 'sieg' && wertet) {
          if (nachtrag && mitte.querySelector('.erg-sterne')) {
            // nur Stern 2 und die Genauigkeit erneuern (die anderen Sterne nicht neu animieren)
            mitte.querySelector('.erg-stern[data-i="1"]').outerHTML = sternHtml(1);
            const alt = mitte.querySelector('.erg-rechnet, .erg-genau');
            if (alt) alt.outerHTML = genauHtml(false);
          } else {
            mitte.innerHTML = `<div class="erg-sterne">${[0, 1, 2].map(sternHtml).join('')}</div>
            ${rechnet ? rechnetHtml : genauHtml(false)}`;
          }
        } else {
          // "Knapp!" nur, wenn die Partie bis spaet offen war
          const momente = review && review.schluesselmomente ? review.schluesselmomente.length : 0;
          const knapp = review && warKnapp(review.kurve, farbe);
          const anzahl = Math.min(3, momente);
          // Sieg einer nicht wertenden Partie: ohne Tipp
          const tipp = ergebnis === 'niederlage'
            ? (momente
              ? `${knapp ? 'Knapp!' : 'Kopf hoch!'} Schau dir ${anzahl === 1 ? 'den Schlüsselmoment' : `die ${anzahl} Schlüsselmomente`} in der Analyse an.`
              : (knapp ? 'Knapp! In der Analyse siehst du, wo mehr drin war.' : 'Kopf hoch! In der Analyse siehst du, wo die Partie gekippt ist.'))
            : ergebnis === 'remis' ? 'Ein halber Punkt! In der Analyse siehst du, wo mehr drin war.' : '';
          // U7: Niederlage ruhig mit Lichtblick-Karte zuerst (Flos bester Zug aus den Live-Klassen); wie der Tipp nur,
          // wenn kein Paket am Ort ergebnis:karte etwas zeigt
          const lb = ergebnis === 'niederlage' && !karten ? lichtblick() : null;
          const lbHtml = lb ? `<div class="erg-lichtblick k-${esc(lb.klasse)}"><span class="lb-sym">${icon('sonne')}</span>
            <div class="lb-text"><b>Lichtblick</b><span>${esc(lb.text)}</span></div></div>` : '';
          // der Tipp nur, wenn kein Paket am Ort ergebnis:karte etwas zeigt
          mitte.innerHTML = `${lbHtml}${rechnet ? rechnetHtml : genauHtml(true)}
            ${rechnet || !tipp || karten ? '' : `<p class="erg-tipp">${esc(tipp)}</p>`}`;
        }
        const neu = wertet ? erg.neuFreigeschaltet : null;
        if (neu && !nachtrag) {
          o.querySelector('.erg-frei-ort').innerHTML = `<div class="erg-frei" style="--bf:${themaBotFarbe(neu)}">
            <span class="avatar"><img src="${esc(neu.avatar)}" alt=""><span class="schloss offen">${icon('offen')}</span></span>
            <div><div class="ef-titel">NEU FREIGESCHALTET · STUFE ${neu.stufe}</div><div class="ef-name">${esc(neu.name)} <span class="ef-elo zahl">${neu.elo}</span></div></div></div>`;
        }
        if (!nachtrag) {
          const knoepfe = o.querySelector('.erg-knoepfe');
          // w0plus-a-fix: "Nächster Gegner" nur auf der Leiter (angemeldete Bots haben stufe null)
          const naechster = !wertet || bot.stufe == null ? null : neu || (ergebnis === 'sieg' ? BOTS.find((b) => b.stufe === bot.stufe + 1) : null);
          // nicht wertend: "Nochmal ab hier" mit denselben Params (Uebung bzw. eigene Stellung), sonst "Nochmal"
          const abHier = z.modus === 'uebung' || (z.modus === 'normal' && !!startFen);
          knoepfe.innerHTML = `<button class="knopf primaer gross" type="button" data-ziel="analyse">${icon('analyse')} Zur Analyse</button>
          ${!wertet ? `<button class="knopf gross" type="button" data-ziel="ab-hier">${icon('nochmal')} ${abHier ? 'Nochmal ab hier' : 'Nochmal'}</button>`
            : naechster ? `<button class="knopf gross" type="button" data-ziel="weiter">Nächster Gegner ${icon('pfeil')}</button>`
              : `<button class="knopf gross" type="button" data-ziel="nochmal">${icon('nochmal')} Nochmal</button>`}`;
          // aktuellErg: nach dem Nachtrag zaehlt auch ein neuer Stern 2
          knoepfe.querySelector('[data-ziel="analyse"]').addEventListener('click', () => app.gehe('analyse', {
            partieId: p.id, neuFreigeschaltet: neu ? neu.id : undefined, neueSterne: aktuellErg.neueSterne,
          }));
          const w = knoepfe.querySelector('[data-ziel="weiter"]');
          if (w) w.addEventListener('click', () => app.gehe('arena', neu ? { neuFreigeschaltet: neu.id } : { waehle: naechster.id }));
          const n = knoepfe.querySelector('[data-ziel="nochmal"]');
          // Bedenkzeit bleibt beim Wiederholen (eine Liga-Runde nicht: die plant die Liga selbst)
          if (n) n.addEventListener('click', () => app.gehe('partie', { botId: bot.id, farbe, tempo: z.tempo ? { ...z.tempo } : undefined }));
          const ab = knoepfe.querySelector('[data-ziel="ab-hier"]');
          if (ab) {
            // W0+a: Boss mit derselben Stufe und Woche, neuer Seed; Bedenkzeit und Liga wie gehabt
            ab.addEventListener('click', () => app.gehe('partie', {
              botId: bot.id, farbe, startFen: startFen || undefined, modus: z.modus, ziel: z.ziel || undefined,
              boss: z.boss ? { ...z.boss } : undefined, tempo: z.tempo ? { ...z.tempo } : undefined,
              liga: z.liga ? { ...z.liga } : undefined,
            }));
          }
        }
        o.classList.add(rechnet ? 'vorlaeufig' : 'gefuellt');
        if (!rechnet) o.classList.remove('vorlaeufig');
        // Genauigkeit zaehlt hoch
        const zahl = o.querySelector('.erg-genau b');
        const ziel = Number(zahl && zahl.dataset.ziel);
        if (zahl && Number.isFinite(ziel) && zahl.dataset.ziel !== '') {
          if (reduziert) zahl.textContent = komma(ziel) + ' %';
          else {
            const t0 = jetzt();
            const schritt = () => {
              if (weg) return;
              const f = Math.min(1, (jetzt() - t0) / 1200);
              zahl.textContent = komma(ziel * (1 - Math.pow(1 - f, 3))) + ' %';
              if (f < 1) requestAnimationFrame(schritt);
            };
            requestAnimationFrame(schritt);
          }
        }
        // Klang je Stern (Pakete: registriereKlang('stern'), der klingt auch bei reduzierter Bewegung; ohne
        // Register wie vor Runde 4: zug, bei reduzierter Bewegung still)
        // U7, Takt (PLAN 3.7): der Klang sitzt auf der Landung jedes Sterns (360 ms + i x 250 ms, Landung nach 220 ms),
        // Abstaende mit dem Tempo, aber nie unter 0,6 (takt); bei reduzierter Bewegung erklingen alle drei
        if (ergebnis === 'sieg' && wertet) {
          const opt = { reduziert: !!reduziert };
          const f = taktFaktor();
          if (!nachtrag) sterne.forEach((an, i) => { if (an && !(rechnet && i === 1)) spaeter(() => klang.stern(i, !!neueSterne[i], opt), Math.round((580 + i * 250) * f)); });
          else if (sterne[1] && neueSterne[1]) spaeter(() => klang.stern(1, true, opt), Math.round(800 * f));
        }
        melde({ typ: 'overlay', ergebnis, sterne, neu: neu ? neu.id : null, rechnet, nachtrag, wertet, feier: feierBox.children.length, karten });
      },
    };
  }
  function zeigeOverlayWieder() {
    if (!overlay) return;
    overlay.el.hidden = false;
    s.classList.add('mit-ergebnis');
    $('.ergebnis-zeigen').hidden = true;
  }

  // ---------- Begruessung (Wahl-Ort partie:begruessung? -> { anlass, werte }) ----------
  function begruesse() {
    let wahl = null;
    try {
      wahl = waehle('partie:begruessung?', {
        bot, farbe, modus: z.modus, partienGegenBot: ladePartien().filter((p) => p.botId === bot.id),
      });
    } catch (e) { wahl = null; }
    const anlass = wahl && typeof wahl.anlass === 'string' && wahl.anlass ? wahl.anlass : null;
    if (anlass && anlass !== 'begruessung' && zeigeBlase(anlass, 'start', { dauer: BEGRUESSUNG_MS, prio: 60, werte: wahl.werte || null })) return;
    zeigeBlase('begruessung', 'start', { dauer: BEGRUESSUNG_MS, prio: 60, werte: (anlass === 'begruessung' && wahl.werte) || null });
  }

  // ---------- Buehne fuer die Pakete (kommt mit partie:gestartet) ----------
  // W0+a: Plaetze fuer Zaehlwerk (im Kopf) und Funkenlinie (unten am Brett-Rahmen), nur mit Einstellung sichtbar
  const plaetze = new Map();
  const zeigt = (name) => ANZEIGEN.includes(name) && app.einstellungen()[name] === true;
  function platz(name) {
    if (weg || (name !== 'zaehlwerk' && name !== 'funkenlinie')) return null;
    let el = plaetze.get(name);
    if (!el) {
      el = document.createElement('div');
      el.className = name === 'zaehlwerk' ? 'p-zaehlwerk' : 'p-funkenlinie';
      if (name === 'zaehlwerk') $('.kopf').insertBefore(el, $('.kopf [data-aktion="einstellungen"]'));
      else rahmen.append(el);
      plaetze.set(name, el);
    }
    el.hidden = !zeigt(name);
    return el;
  }
  const buehne = Object.freeze({
    laufId, bot, farbe, modus: z.modus, ziel: z.ziel ? Object.freeze({ ...z.ziel }) : null,
    boss: z.boss ? Object.freeze({ ...z.boss }) : null, seed: z.seed,
    zeigt, platz,
    el: s, effekte: effekteEl, rahmen, brett, reduziert: !!reduziert,
    feld(f) {
      if (typeof f !== 'string' || !/^[a-h][1-8]$/.test(f)) return null;
      const [x, y] = spalteZeile(f);
      return { x, y };
    },
    liveAn: () => liveAn(),
    phase: () => z.phase,
    coachZusatz: (inhalt, opt) => coachZusatz(inhalt, opt),
    blase(anlass, { paar, prio = 50, werte = null } = {}) {
      if (weg || typeof anlass !== 'string' || !anlass) return false;
      return zeigeBlase(anlass, paar === undefined ? letzterFloPly() : paar, { prio, werte });
    },
    merke(paket, daten) {
      if (weg || typeof paket !== 'string' || !PAKET_NAME.test(paket)) return false;
      const neu = { ...z.extra };
      if (daten == null) delete neu[paket];
      else {
        const d = kopie(daten);
        if (d == null) return false;
        neu[paket] = d;
      }
      const zeichen = JSON.stringify(neu).length;
      if (zeichen > EXTRA_MAX) {
        console.warn(`Partie: extra von "${paket}" verworfen (${zeichen} Zeichen, höchstens ${EXTRA_MAX})`);
        return false;
      }
      z.extra = neu;
      // nach dem Ende in den gespeicherten Datensatz, sonst in die laufende Partie
      if (z.gespeichert) aktualisierePartie(z.gespeichert.partie.id, { extra: Object.keys(neu).length ? neu : undefined });
      else speichereLaufend();
      return true;
    },
    gemerkt(paket) {
      return Object.prototype.hasOwnProperty.call(z.extra, paket) ? kopie(z.extra[paket]) : null;
    },
    spaeter(fn, ms) {
      if (weg || typeof fn !== 'function') return 0;
      return spaeter(() => {
        try { fn(); } catch (e) { console.error('Buehne: Timer fehlgeschlagen', e); }
      }, Math.max(0, Number(ms) || 0));
    },
  });

  // ---------- W0+a: Ort partie:gegner-leiste (ueber dem Gegner, z. B. die Lebensleiste eines Bosses) ----------
  // U7: eine Spielerkarte fuer beide Lagen: der Behaelter ist immer das erste Kind von .spieler.gegner (die Karte traegt
  // dafuer auch .botbox und .botleiste-hoch); data-lage folgt der Lage des Geraets.
  // w0plus-a-fix: Ort partie:spieler-leiste an Flos Namen (U7: immer direkt nach .spieler.ich > .name)
  const gegnerLeiste = document.createElement('div');
  gegnerLeiste.className = 'ort-gegner-leiste';
  gegnerLeiste.hidden = true;
  const spielerLeiste = document.createElement('div');
  spielerLeiste.className = 'ort-spieler-leiste';
  spielerLeiste.hidden = true;
  const hochMq = window.matchMedia ? window.matchMedia('(orientation: portrait)') : null;
  const lage = () => (hochMq && hochMq.matches ? 'hoch' : 'quer');
  function setzeGegnerLeiste() {
    if (gegnerLeiste.parentNode !== gegnerKarte || gegnerKarte.firstElementChild !== gegnerLeiste) gegnerKarte.insertBefore(gegnerLeiste, gegnerKarte.firstChild);
    gegnerLeiste.dataset.lage = lage();
    const nach = floKarte.querySelector(':scope > .name');
    if (nach && spielerLeiste.previousElementSibling !== nach) nach.after(spielerLeiste);
    spielerLeiste.dataset.lage = lage();
    layout();
  }

  // ---------- U7: Uhr (Anzeige; die Logik bringt W0+b) ----------
  const uhrEl = { bot: gegnerKarte.querySelector('.uhr'), flo: floKarte.querySelector('.uhr') };
  const uhr = Object.freeze({
    // zeigt oder versteckt beide Uhren (ohne Uhr bekommt der Name den Platz)
    zeige(an) {
      for (const el of Object.values(uhrEl)) el.hidden = !an;
      s.classList.toggle('mit-uhr', !!an);
      layout();
    },
    // wer: 'bot' | 'flo'; laufend in Tinte, unter 20 s rot mit Uhr-Symbol und Sekundenpuls
    setze(wer, ms, { laeuft = false } = {}) {
      const el = uhrEl[wer];
      if (!el) return;
      const t = Math.max(0, Number(ms) || 0);
      el.querySelector('.uhr-zeit').textContent = fmtUhr(t);
      const warn = t < UHR_WARN_MS;
      el.classList.toggle('laeuft', !!laeuft);
      el.classList.toggle('warn', warn);
      el.setAttribute('aria-label', `${wer === 'flo' ? 'Deine' : 'Gegnerische'} Bedenkzeit ${fmtUhr(t)}`);
      const sek = Math.floor(t / 1000);
      if (warn && laeuft && el.dataset.sek !== String(sek)) {
        el.dataset.sek = String(sek);
        anim(el, [{ transform: 'scale(1.045)' }, { transform: 'none' }], { d: 380, k: 'sanft' });
      }
    },
  });

  // ---------- U7: Groesse und Lage (Handy: "Brett zuerst", PLAN 2.5) ----------
  const handyMq = window.matchMedia ? window.matchMedia('(orientation: portrait) and (max-width: 600px)') : null;
  const inhaltEl = $('.inhalt');
  const istHandy = () => !!(handyMq && handyMq.matches);
  // Name nie mit "..." kuerzen: passt er nicht in zwei Zeilen (oder ist ein Wort breiter als die Spalte), der Rufname
  function passeNamen() {
    const el = gegnerKarte.querySelector('.name');
    if (!el) return;
    if (el.textContent !== bot.name) el.textContent = bot.name;
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 18;
    const zuGross = el.scrollHeight > lh * 2 + 2 || el.scrollWidth > el.clientWidth + 1;
    if (zuGross && rufnameVon(bot) !== bot.name) el.textContent = rufnameVon(bot);
    el.classList.toggle('ruf', el.textContent !== bot.name);
  }
  function layout() {
    if (weg || !inhaltEl || !s.isConnected) return;
    const handy = istHandy();
    s.classList.toggle('handy', handy);
    const h2 = $('.kopf h2');
    const titel = handy ? kopfKurz() : kopfTitel();
    if (h2 && h2.textContent !== titel) h2.textContent = titel;
    if (!handy) {
      inhaltEl.style.removeProperty('--brett');
      inhaltEl.style.removeProperty('--spalte');
      s.classList.remove('coach-eng', 'streifen-unten');
      passeNamen();
      pruefeCoachRest();
      return;
    }
    // Brett zuerst: volle Breite minus Rand (2 x 10) und Sockel, ein Vielfaches von 8
    const rs = getComputedStyle(rahmen);
    const sockelX = (parseFloat(rs.paddingLeft) || 0) + (parseFloat(rs.paddingRight) || 0);
    const sockelY = (parseFloat(rs.paddingTop) || 0) + (parseFloat(rs.paddingBottom) || 0);
    const breit = Math.floor((inhaltEl.clientWidth - 2 * HANDY_RAND - sockelX) / 8) * 8;
    // Zugstreifen zwischen Coach und Knoepfen erst ab 760 px Hoehe, darunter nach den Knoepfen (die Spalte scrollt)
    s.classList.toggle('streifen-unten', s.clientHeight < STREIFEN_AB);
    const setze = (g) => {
      inhaltEl.style.setProperty('--brett', g + 'px');
      inhaltEl.style.setProperty('--spalte', (g + sockelX) + 'px');
    };
    // Hoehe: alles ausser dem Brett messen (bei der vollen Breite), 4 px Puffer bis zur Unterkante
    const passt = (g) => {
      setze(g);
      const oben = inhaltEl.getBoundingClientRect().top - inhaltEl.scrollTop;
      const unten = $('.spielknoepfe').getBoundingClientRect().bottom - oben + 4;
      return unten <= inhaltEl.clientHeight + 0.5;
    };
    const hoehe = (g) => {
      setze(g);
      const oben = inhaltEl.getBoundingClientRect().top - inhaltEl.scrollTop;
      const rest = $('.spielknoepfe').getBoundingClientRect().bottom - oben + 4 - rahmen.offsetHeight;
      return Math.floor((inhaltEl.clientHeight - rest - sockelY) / 8) * 8;
    };
    s.classList.remove('coach-eng');
    let g = breit;
    if (!passt(g)) {
      // vorher schrumpft der Coach auf eine Zeile (Rest auf Antippen), erst dann das Brett (nie unter 280 px)
      s.classList.add('coach-eng');
      if (!passt(g)) g = Math.max(BRETT_MIN, Math.min(breit, hoehe(g)));
    }
    setze(Math.max(BRETT_MIN, g));
    passeNamen();
    pruefeCoachRest();
  }
  let layoutBild = 0;
  const layoutSpaeter = () => {
    if (layoutBild || weg) return;
    layoutBild = requestAnimationFrame(() => { layoutBild = 0; layout(); });
  };
  const layoutRo = typeof ResizeObserver === 'function' ? new ResizeObserver(layoutSpaeter) : null;
  if (layoutRo) layoutRo.observe(s);
  // Handy: Zahl des waagrechten Balkens nur auf Antippen
  balken.addEventListener('click', () => {
    if (!istHandy()) return;
    balken.classList.add('zeigt-zahl');
    clearTimeout(z.balkenUhr);
    z.balkenUhr = spaeter(() => balken.classList.remove('zeigt-zahl'), 2200);
  });

  // ---------- U7: Duell-Vertrag (U5 baut das Intro) ----------
  // Laeuft beim Start ein Duell-Intro (html[data-duell="laeuft"]), ziehen Bot (und die Uhr, W0+b) erst nach duell:fertig
  // (auf document), hoechstens DUELL_MAX_MS. Ohne Duell sofort.
  let duellAus = null;
  const duellBereit = document.documentElement.dataset.duell === 'laeuft'
    ? new Promise((resolve) => {
      const u = setTimeout(() => fertig('zeit'), DUELL_MAX_MS);
      function fertig(grund) {
        clearTimeout(u);
        document.removeEventListener('duell:fertig', ereignis);
        duellAus = null;
        melde({ typ: 'duell', grund });
        resolve();
      }
      const ereignis = () => fertig('ereignis');
      document.addEventListener('duell:fertig', ereignis);
      duellAus = () => fertig('verlassen');
    })
    : Promise.resolve();

  setzeGegnerLeiste();
  if (hochMq && hochMq.addEventListener) hochMq.addEventListener('change', setzeGegnerLeiste);
  if (handyMq && handyMq.addEventListener) handyMq.addEventListener('change', layout);
  if (z.tempo) {
    uhr.zeige(true);
    uhr.setze('bot', z.tempo.grund * 1000);
    uhr.setze('flo', z.tempo.grund * 1000);
  }
  const gegnerOrt = fuelle('partie:gegner-leiste', gegnerLeiste, {
    app, buehne, bot, farbe, modus: z.modus, boss: buehne.boss, lage,
  });
  gegnerLeiste.hidden = gegnerOrt.anzahl === 0;
  s.classList.toggle('mit-gegner-leiste', gegnerOrt.anzahl > 0);
  const spielerOrt = fuelle('partie:spieler-leiste', spielerLeiste, {
    app, buehne, bot, farbe, modus: z.modus, boss: buehne.boss, lage,
  });
  spielerLeiste.hidden = spielerOrt.anzahl === 0;
  // w0plus-a-fix: Ort partie:aktionen in der Knopfreihe vor "Aufgeben" (display: contents, die Knoepfe der Pakete
  // werden Spalten der Reihe; hoechstens AKTIONEN_MAX)
  const aktionen = document.createElement('div');
  aktionen.className = 'ort-aktionen';
  aktionen.hidden = true;
  $('.spielknoepfe').insertBefore(aktionen, $('.spielknoepfe > [data-aktion="aufgeben"]'));
  const aktionenOrt = fuelle('partie:aktionen', aktionen, { app, buehne, bot, farbe, modus: z.modus, boss: buehne.boss });
  const aktionsKnoepfe = [...aktionen.children];
  for (const el of aktionsKnoepfe.slice(AKTIONEN_MAX)) el.remove();
  if (aktionsKnoepfe.length > AKTIONEN_MAX) console.warn(`Partie: ${aktionsKnoepfe.length} Knöpfe an partie:aktionen, gezeigt werden ${AKTIONEN_MAX}`);
  const aktionenZahl = Math.min(AKTIONEN_MAX, aktionen.children.length);
  aktionen.hidden = aktionenZahl === 0;
  if (aktionenZahl) $('.spielknoepfe').dataset.aktionen = String(aktionenZahl);
  // W0+a: In Boss-Partien ersetzt die Gegner-Leiste eines Pakets (die Lebensleiste) den Bewertungsbalken, solange die
  // Anzeige "lebensleiste" an ist (SPIELKONZEPT 3.17, 3.18). Ohne Anbieter steht der Balken wie eingestellt.
  const ohneBalken = (e) => !e.balken || (z.modus === 'boss' && e.lebensleiste !== false && gegnerOrt.anzahl > 0);
  s.classList.toggle('ohne-balken', ohneBalken(einst));

  // ---------- Start ----------
  balkenAusrichtung();
  merkeSerie();
  zeichneKopf();
  zeichneZugliste();
  zeichneGeschlagen();
  zeichneKnoepfe();
  const fpStart = letzterFloPly();
  // Fortsetzen: lief die Bewertung des letzten eigenen Zugs noch, jetzt nachholen
  const nachholen = !!(laufend && fpStart >= 0 && !z.liveKlassen[fpStart]);
  if (nachholen) neuerLiveEintrag(fpStart);
  if (nachholen && liveAn()) coachRechnet(fpStart);
  else if (laufend && fpStart >= 0 && z.liveKlassen[fpStart] && liveAn()) {
    coachZeige(`<span class="c-symbol">${symbolSvg(z.liveKlassen[fpStart])}</span><div class="c-kopf"><span class="c-klasse">Weiter geht’s</span>
      <span class="c-zug">${esc(zugLabel(fpStart))}</span></div><p class="c-text">Dein letzter Zug: ${esc(KLASSEN_WORT[z.liveKlassen[fpStart]])}.</p>`,
    `k-${z.liveKlassen[fpStart]} kompakt`, null);
    coachEl.style.setProperty('--kf', `var(--k-${z.liveKlassen[fpStart]})`);
  } else coachLeer();
  if (nachholen) bewerte(fpStart);
  setzeBalken({ lines: [{ eval: { cp: 0, mate: null } }] });

  (async () => {
    if (!laufend) {
      app.vorab.clear();
      speichereLaufend();
    }
    // Begruessung nur zum Start, nicht beim Fortsetzen mitten in der Partie
    if (!laufend || z.zuege.length === 0) begruesse();
    // Engines starten (neue Partie: beide newGame)
    try {
      const [eb, ew] = await Promise.all([app.engine('bot'), app.engine('bewertung')]);
      engBot = eb;
      engBewertung = ew;
      if (!laufend) await Promise.all([eb.newGame(), ew.newGame()]);
    } catch (err) {
      // dauerhafte Fehler (z. B. iPadOS zu alt) meldet app.js selbst mit genauem Grund
      if (!weg && !(err && err.dauerhaft)) app.meldung('Die Schach-Engine startet nicht. Der Bot spielt ohne sie, die Bewertung fehlt.', { art: 'fehler' });
      z.engineGemeldet = true;
    }
    if (weg) return;
    if (app.test && window.__partie) window.__partie.bereit = true;
    if (z.phase !== 'start' && z.phase !== 'flo') return;
    balkenAktualisieren();
    if (z.phase === 'flo') return;
    if (pruefeEnde()) return;
    if (z.chess.turn() === farbe) {
      z.phase = 'flo';
      erlaubeFlo();
      zeichneKnoepfe();
    } else {
      // U7: der erste Bot-Zug wartet auf das Duell-Intro (hoechstens 1,4 s)
      await duellBereit;
      if (weg || z.phase !== 'start') return;
      botAmZug();
    }
  })();

  // Flo darf schon ziehen, waehrend die Engines noch laden (sie reihen sich ein)
  if (z.chess.turn() === farbe && !z.chess.isGameOver()) {
    z.phase = 'flo';
    erlaubeFlo();
    zeichneKnoepfe();
  }

  layout();

  // Einstellungen wirken sofort (U7: alle Komfort-Schalter aus PLAN 4, ohne Neuladen)
  const beiEinstellungen = (e) => {
    const d = e.detail || {};
    brett.koordinaten(!!d.koordinaten);
    const lageVorher = brett.koordLage();
    brett.setzeKoordLage(d.koordLage);
    brett.setzeAutoDame(d.autoDame !== false);
    brett.setzeSteuerung(d.steuerung);
    brett.setzePfeileErlaubt(d.pfeile !== false);
    if (d.vorzuege === false) { loescheVorzuege(); if (z.phase === 'bot') brett.erlaubeZuege(null); }
    if (z.phase === 'flo') erlaubeFlo(); else aktualisiereBestaetigen();
    setzeAufgeben(d.haltenAufgeben !== false);
    zeichneKnoepfe();
    s.classList.toggle('ohne-balken', ohneBalken(d));
    for (const [name, el] of plaetze) el.hidden = d[name] !== true;
    const k = $('.kopf [data-aktion="klang"]');
    if (k) k.setAttribute('aria-pressed', d.klang !== false ? 'true' : 'false');
    for (const b of $$('.brettwahl button')) b.setAttribute('aria-checked', String(b.dataset.brett === d.brett));
    if (d.sprueche === 'aus') versteckeBlase();
    // Coach-Stil: den gezeigten Coach neu schreiben (ohne neue Animation)
    const p = Number(coachEl.dataset.ply);
    if (Number.isFinite(p) && z.live[p] && z.live[p].status === 'fertig' && liveAn()) {
      const kompakt = coachEl.classList.contains('kompakt');
      coachErgebnis(p, { neu: false });
      if (kompakt) coachEl.classList.add('kompakt');
    }
    if (lageVorher !== brett.koordLage()) layout();
    else pruefeCoachRest();
  };
  window.addEventListener('schach:einstellungen', beiEinstellungen);

  if (app.test) {
    window.__partie = {
      z, brett, protokoll, bereit: false, buehne, laufId,
      chess: () => z.chess,
      phase: () => z.phase,
      effekt, zeigeBewertung, satzFuer, serieBis, merkeSerie, coachErgebnis, zeigeBlase,
      gegnerLeiste, spielerLeiste, aktionen, mattOrt: () => mattOrt, zugBot: () => zugBot,
      // U7: Uhr-Anzeige (W0+b), Groessenrechnung, Duell-Vertrag
      uhr, fmtUhr, layout, duellBereit, halte: () => halte,
    };
  }

  // hinweise und zuruecknahmen: Stand beim Start (bei einer fortgesetzten Partie die bisherigen)
  sende('partie:gestartet', {
    laufId, botId: bot.id, botStufe: bot.stufe, farbe, startFen: startFen || null, modus: z.modus, ziel: buehne.ziel,
    wertet: wertetJetzt(), fortgesetzt: !!laufend, hinweise: z.hinweise, zuruecknahmen: z.zuruecknahmen, buehne,
    boss: buehne.boss, seed: z.seed,
  });

  return {
    verlasse() {
      if (weg) return;
      // vor dem Abraeumen: Pakete raeumen ihre Buehnen-Sachen ab (danach tut die Buehne nichts mehr)
      sendeBeendet();
      sende('partie:verlassen', { laufId });
      // Beendete Partie ist schon gespeichert; laeuft die Auswertung noch, die Genauigkeit aus der
      // Live-Bewertung nachtragen (nur wenn vollstaendig). Die Analyse rechnet spaeter den Rest.
      if (z.phase === 'ende' && z.gespeichert) {
        try { nachtragen(null); } catch (e) { console.warn(e); }
      } else if (z.phase !== 'ende' && !z.verworfen) {
        speichereLaufendePartie(stand());
      }
      weg = true;
      endeCtrl.abort();
      abbrechenBot();
      if (engBewertung && laufendeAnalysen.size) { try { engBewertung.stop({ warteschlange: true }); } catch (e) { /* egal */ } }
      for (const u of uhren) clearTimeout(u);
      uhren.clear();
      clearTimeout(z.blaseUhr);
      clearTimeout(z.kompaktUhr);
      if (overlay) overlay.verlasse();
      // W0+a: Gegner-Leiste und Finisher abraeumen (w0plus-a-fix: auch Spieler-Leiste und Aktionen)
      gegnerOrt.verlasse();
      spielerOrt.verlasse();
      aktionenOrt.verlasse();
      if (mattOrt) mattOrt.verlasse();
      if (hochMq && hochMq.removeEventListener) hochMq.removeEventListener('change', setzeGegnerLeiste);
      if (handyMq && handyMq.removeEventListener) handyMq.removeEventListener('change', layout);
      if (layoutRo) layoutRo.disconnect();
      if (layoutBild) cancelAnimationFrame(layoutBild);
      if (duellAus) duellAus();
      if (halte) halte.verlasse();
      plaetze.clear();
      window.removeEventListener('schach:einstellungen', beiEinstellungen);
      brett.zerstoere();
      if (app.test && window.__partie && window.__partie.z === z) delete window.__partie;
    },
  };
}
