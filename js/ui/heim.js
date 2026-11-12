// Screen "heim" (Konzept 2026-11-06, Abschnitt 12, Entwuerfe start-ipad-v2 und start-ipad-quer, Flo 07.11.2026 "ja go"):
// die ruhige Startseite. Oben der Kopf mit der Tage-Serie (dezent), darunter Gruss nach Tageszeit und eine dunkle
// Buehne: die laufende Partie als Mini-Brett mit einem Satz zur Lage, Bewertungsbalken und "Weiterspielen", ohne
// Partie der naechste Gegner der Bot-Leiter mit "Spielen". Dann "Als Naechstes" (hoechstens zwei Zeilen nach Rang,
// ohne Daten entfaellt der Abschnitt) und drei schlichte Wege: Online, Lernen, Zu zweit.
// Was es noch nicht gibt (Taler, offene Herausforderungen, Belohnung kurz vor dem Ziel), wird nicht erfunden.
//
//   zeige(root, params, app) -> { verlasse() }
//   zeigeHeim(app, { jetzt }) -> section   baut nur den Screen (ohne einzuhaengen), fuer zeige() und Tests
//   ligaLage() -> { vorhanden, punkte, stufe, naechste, fehlt, anteil }   Liga-Punkte der Arena (nur lesend, nicht angezeigt)
//   kronenLage(stand | null) -> { kronen, stufe, liga, rang, platz, n, ziel, anteil, ohneKonto }   rein
//   (intern) lageSatz(cp, mate, sicht) -> { art, anteil, wert }   Bewertung (Sicht Weiss) als Lage-Art, Balken und Zahl
//
// Ziele: Weiterspielen -> partie (fortsetzen, wie app.js pruefeZiel; Zu zweit wie pakete/zuzweit), Spielen -> partie
// gegen naechsterGegner(); heim-online -> online (fuer alle, Flo 08.11.2026); heim-raetsel (Lernen) -> training (dort steht
// die Meisterschule oben, #150); heim-zuzweit -> partie Zu zweit; Liga-Zeile -> bestenliste.
// Liga-Zeile (Etappe B, Wochen-Gruppen; L 08.11.2026: der fruehere Ring als Zeile unter "Als Naechstes"): Stufe
// ("Läufer II") und "Platz 3 von 30" bzw. "Spiel eine Partie für deine Gruppe", Balken bis Platz 5. Erst der gemerkte
// Stand (Modul kronen, nur fuer dasselbe Konto), dann der Server-Stand (js/kronen.js holeStand), gemerkt. Ohne Konto
// oder ohne jeden Stand entfaellt die Zeile still.
// DOM: section.screen.heim-screen > header.haupt-kopf, .heim-rumpf > .heim-links (.heim-gruss, .heim-buehne[data-art],
// .heim-leiter? ohne Partie), .heim-rechts (.heim-naechstes?, .heim-wege > button.heim-modus[data-aktion]). Optik:
// css/heim.css, nur Tokens.
import { hauptKopf, verbindeKopf, kopfEintritt } from './seite.js';
import { icon } from './icons.js';
import { Brett } from '../board.js';
import { figurenPfad } from '../figurensatz.js';
import { anim, tempo } from '../bewegung.js';
import { ladeModul, speichereModul, ladeLaufendePartie, naechsterGegner, ladeEinstellungen, ladePartien } from '../storage.js';
import { BOTS, botNachId, rufname } from '../bots.js';
import { eigenerName, sitzung } from '../konto.js';
import { holeStand, angemeldet, RANKED_ZEIT } from '../kronen.js';
import { normalisiereStand, ligaStufe, STUFEN } from '../pakete/liga/wertung.js';
import { stufeInfo, kronenSpeicher, AUFSTIEG_PLAETZE, GRUPPE_GROESSE } from '../pakete/liga/kronen.js';
import * as serieStand from '../pakete/serie/stand.js';
import { lage as serieLage } from '../pakete/serie/tag.js';
import { tagSchluessel, tageZwischen, istSchluessel } from '../tag.js';
import { fuelle } from '../orte.js';
import { Chess } from '../../vendor/chess/chess.js';
import { t, zahl, registriereTexte } from '../sprache.js';
import { stufenName } from '../pakete/liga/texte.js';
import '../sprachen/allgemein.js';
import '../sprachen/rahmen.js';
// Art der Online-Partie ("Blitz", online.zeit.*): der Weg Online nennt sie wie die Online-Seite (Feinschliff R6, B26)
import '../sprachen/online.js';

registriereTexte('heim', {
  de: {
    aria: 'Start',
    'gruss.morgen': 'Guten Morgen',
    'gruss.tag': 'Guten Tag',
    'gruss.abend': 'Guten Abend',
    'gruss.name': '{gruss}, {name}',
    'titel.partie': 'Deine Partie wartet.',
    'titel.leer': 'Bereit für die nächste Partie?',
    'serie.eins': '{n:zahl} Tag',
    'serie.mehr': '{n:zahl} Tage',
    'serieTitel.eins': '{n:zahl} Tag in Folge gespielt',
    'serieTitel.mehr': '{n:zahl} Tage in Folge gespielt',
    gegen: 'gegen {name} · Bot {elo}',
    zuzweit: '{weiss} gegen {schwarz} · Zu zweit',
    weiss: 'Weiß',
    schwarz: 'Schwarz',
    'lage.gleich': 'Ausgeglichen',
    'lage.besser': 'Du stehst besser',
    'lage.klarBesser': 'Du stehst klar besser',
    'lage.schlechter': 'Du stehst schlechter',
    'lage.klarSchlechter': 'Es wird eng',
    'lage.wBesser': 'Weiß steht besser',
    'lage.sBesser': 'Schwarz steht besser',
    'zug.du': 'du bist am Zug',
    'zug.bot': '{name} ist am Zug',
    'zug.w': 'Weiß am Zug',
    'zug.s': 'Schwarz am Zug',
    'zug.duGross': 'Du bist am Zug',
    'zug.botGross': '{name} ist am Zug',
    'zug.wGross': 'Weiß am Zug',
    'zug.sGross': 'Schwarz am Zug',
    balken: 'Bewertung {wert}',
    weiter: 'Weiterspielen',
    naechsterGegner: 'Nächster Gegner auf deiner Leiter',
    leiter: 'Deine Leiter',
    spielen: 'Spielen',
    elo: 'Elo {elo}',
    naechstes: 'Als Nächstes',
    'liga.platz': 'Platz {platz} von {n}',
    'liga.ohneGruppe': 'Spiel eine Partie für deine Gruppe',
    'liga.label': '{stufe}, {zeile}, {kronen} Kronen diese Woche',
    'online.titel': 'Online',
    'online.text': '{art} {zeit}',
    'raetsel.titel': 'Lernen',
    'raetsel.text': 'Rätsel und Meisterschule',
    'zuzweit.titel': 'Zu zweit',
    'zuzweit.text': 'An einem Gerät',
    'zurueck.titel': 'Willkommen zurück',
    'zurueck.partie': '{ergebnis} gegen {name} vor {n} Tagen',
    'zurueck.leer': 'Zuletzt vor {n} Tagen hier',
    'zurueck.sieg': 'Sieg',
    'zurueck.niederlage': 'Niederlage',
    'zurueck.remis': 'Remis',
    'zurueck.label': '{titel}. {text}. {knopf}',
  },
  en: {
    aria: 'Home',
    'gruss.morgen': 'Good morning',
    'gruss.tag': 'Hello',
    'gruss.abend': 'Good evening',
    'gruss.name': '{gruss}, {name}',
    'titel.partie': 'Your game is waiting.',
    'titel.leer': 'Ready for the next game?',
    'serie.eins': '{n:zahl} day',
    'serie.mehr': '{n:zahl} days',
    'serieTitel.eins': '{n:zahl} day in a row',
    'serieTitel.mehr': '{n:zahl} days in a row',
    gegen: 'vs {name} · Bot {elo}',
    zuzweit: '{weiss} vs {schwarz} · Two players',
    weiss: 'White',
    schwarz: 'Black',
    'lage.gleich': 'Level position',
    'lage.besser': 'You are better',
    'lage.klarBesser': 'You are clearly better',
    'lage.schlechter': 'You are worse',
    'lage.klarSchlechter': 'It is getting tight',
    'lage.wBesser': 'White is better',
    'lage.sBesser': 'Black is better',
    'zug.du': 'your move',
    'zug.bot': '{name} to move',
    'zug.w': 'White to move',
    'zug.s': 'Black to move',
    'zug.duGross': 'Your move',
    'zug.botGross': '{name} to move',
    'zug.wGross': 'White to move',
    'zug.sGross': 'Black to move',
    balken: 'Evaluation {wert}',
    weiter: 'Continue',
    naechsterGegner: 'Next opponent on your ladder',
    leiter: 'Your ladder',
    spielen: 'Play',
    elo: 'Elo {elo}',
    naechstes: 'Up next',
    'liga.platz': 'Place {platz} of {n}',
    'liga.ohneGruppe': 'Play a game to join your group',
    'liga.label': '{stufe}, {zeile}, {kronen} crowns this week',
    'online.titel': 'Online',
    'online.text': '{art} {zeit}',
    'raetsel.titel': 'Learn',
    'raetsel.text': 'Puzzles and master school',
    'zuzweit.titel': 'Two players',
    'zuzweit.text': 'On one device',
    'zurueck.titel': 'Welcome back',
    'zurueck.partie': '{ergebnis} vs {name}, {n} days ago',
    'zurueck.leer': 'Last here {n} days ago',
    'zurueck.sieg': 'Win',
    'zurueck.niederlage': 'Loss',
    'zurueck.remis': 'Draw',
    'zurueck.label': '{titel}. {text}. {knopf}',
  },
});

const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WEGE = [['online', 'blitz'], ['raetsel', 'ziel'], ['zuzweit', 'personen']];
// Untertitel des Wegs Online: Art und Bedenkzeit der gewerteten Partie aus RANKED_ZEIT, wie die Online-Seite sie nennt
// ("Bedenkzeit 5 + 3 · Blitz", js/ui/online.js); vorher stand hier "Schnellpartie" (Feinschliff R6, B26)
const wegWerte = () => ({ art: t('online.zeit.' + RANKED_ZEIT.art), zeit: RANKED_ZEIT.id.replace('+', ' + ') });
const BEWERTUNG_TIEFE = 10;

// Punkte und Stufe der laufenden Saison; jeder Fehler ergibt Holz und 0. vorhanden: es gibt einen Liga-Stand
export function ligaLage() {
  let punkte = 0, stufe = 0, vorhanden = false;
  try {
    const roh = ladeModul('liga');
    const st = roh ? normalisiereStand(roh, new Date()) : null;
    if (st && st.saison) {
      vorhanden = true;
      punkte = Number.isFinite(st.saison.punkte) && st.saison.punkte > 0 ? Math.floor(st.saison.punkte) : 0;
      stufe = Number.isInteger(st.saison.stufe) ? Math.min(STUFEN.length - 1, Math.max(0, st.saison.stufe)) : 0;
    }
  } catch (e) { console.error(e); }
  stufe = Math.max(stufe, ligaStufe(punkte));
  const naechste = STUFEN[stufe + 1] || null;
  const von = STUFEN[stufe].schwelle;
  const anteil = naechste ? Math.min(1, Math.max(0, (punkte - von) / (naechste.schwelle - von))) : 1;
  return { vorhanden, punkte, stufe, naechste: naechste ? stufe + 1 : null, fehlt: naechste ? Math.max(0, naechste.schwelle - punkte) : 0, anteil };
}

// Tage in Folge (Paket serie), nur wenn die Serie laeuft und angezeigt werden soll; sonst 0
function serieTage(jetzt) {
  try {
    const einst = serieStand.einstellungen();
    if (einst && einst.anzeigen === false) return 0;
    const l = serieLage(serieStand.lade(), tagSchluessel(jetzt), einst);
    return l && l.art === 'laeuft' && l.aktuell > 0 ? l.aktuell : 0;
  } catch (e) { return 0; }
}

function gruss(jetzt) {
  const h = jetzt.getHours();
  const g = t(h >= 5 && h < 11 ? 'heim.gruss.morgen' : h >= 11 && h < 18 ? 'heim.gruss.tag' : 'heim.gruss.abend');
  let name = '';
  try { name = eigenerName() || ''; } catch (e) { name = ''; }
  return name ? t('heim.gruss.name', { gruss: g, name }) : g;
}

// "Willkommen zurueck" (Feinschliff 09.11., Kundenblick Befund 11): wer mindestens RUECKKEHR_TAGE Tage nicht da war
// (Tagesgrenze 4:00, js/tag.js), bekommt am Tag der Rueckkehr EINE ruhige erste Zeile unter "Als Naechstes": wo er
// stehen geblieben war und ein Knopf zum Weiterspielen. Wer taeglich kommt, sieht nichts davon. Nach dem Antippen
// ist sie fuer diesen Tag weg. Gemerkt im Modul besuch: { tag, zurueck: { tag, pause, erledigt? } | null }.
// Uhr zurueckgestellt (tageZwischen <= 0): keine Rueckkehr, der gemerkte Tag bleibt.
export const RUECKKEHR_TAGE = 2;
export function rueckkehr(jetzt = new Date()) {
  const heute = tagSchluessel(jetzt);
  const alt = ladeModul('besuch', {}) || {};
  let zurueck = alt.zurueck && alt.zurueck.tag === heute ? alt.zurueck : null;
  if (!zurueck && istSchluessel(alt.tag) && alt.tag !== heute) {
    const pause = tageZwischen(alt.tag, heute);
    if (pause >= RUECKKEHR_TAGE) zurueck = { tag: heute, pause };
  }
  const spaeter = !istSchluessel(alt.tag) || tageZwischen(alt.tag, heute) > 0;
  if (spaeter || zurueck !== alt.zurueck) speichereModul('besuch', { tag: spaeter ? heute : alt.tag, zurueck });
  return zurueck && !zurueck.erledigt ? zurueck : null;
}

function rueckkehrErledigt() {
  const alt = ladeModul('besuch', {}) || {};
  if (alt.zurueck) speichereModul('besuch', { ...alt, zurueck: { ...alt.zurueck, erledigt: true } });
}

// Die Zeile selbst: zuletzt gespielte Partie (oder nur die Pause), rechts der Pfeil; der Knopf setzt die laufende
// Partie fort oder startet den naechsten Gegner der Leiter (wie die Buehne)
function rueckkehrZeile(z, partie, bot) {
  let text = t('heim.zurueck.leer', { n: zahl(z.pause) });
  try {
    const p = ladePartien().find((x) => x && x.botId && ['sieg', 'niederlage', 'remis'].includes(x.ergebnis));
    const b = p ? botNachId(p.botId) : null;
    if (b) text = t('heim.zurueck.partie', { n: zahl(z.pause), ergebnis: t('heim.zurueck.' + p.ergebnis), name: rufname(b) });
  } catch (e) { /* nur die Pause */ }
  const knopf = t(partie ? 'heim.weiter' : 'heim.spielen');
  const titel = t('heim.zurueck.titel');
  return `<button class="heim-zeile dr heim-zurueck" type="button" data-aktion="heim-zurueck"${bot ? ` data-bot="${esc(bot.id)}"` : ''}
        aria-label="${esc(t('heim.zurueck.label', { titel, text, knopf }))}">
        <span class="heim-zeile-bild" aria-hidden="true">${icon('haus')}</span>
        <span class="heim-zeile-text"><b>${esc(titel)}</b><span>${esc(text)}</span></span>
        <span class="heim-zurueck-knopf" aria-hidden="true">${esc(knopf)}</span>
      </button>`;
}

// Bewertung (cp/mate aus Sicht von Weiss) aus Sicht sicht ('w' | 'b'): art fuer den Satz, anteil 0..1 fuer den Balken
function lageSatz(cp, mate, sicht = 'w') {
  const vz = sicht === 'b' ? -1 : 1;
  if (Number.isFinite(mate) && mate !== 0) {
    const gut = mate * vz > 0;
    return { art: gut ? 'klarBesser' : 'klarSchlechter', anteil: gut ? 1 : 0, wert: (gut ? '+' : '-') + 'M' + Math.abs(mate) };
  }
  const d = (Number.isFinite(cp) ? cp : 0) * vz;
  const art = Math.abs(d) < 50 ? 'gleich' : d >= 300 ? 'klarBesser' : d > 0 ? 'besser' : d <= -300 ? 'klarSchlechter' : 'schlechter';
  const anteil = 1 / (1 + Math.exp(-d / 250));
  const wert = (d >= 0 ? '+' : '-') + zahl(Math.abs(d) / 100, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return { art, anteil, wert };
}

// Stellung der laufenden Partie: { fen, amZug, zuletzt: [von, nach], schach } oder null (kaputte Daten)
function stellung(laufend) {
  try {
    const c = laufend.startFen ? new Chess(laufend.startFen) : new Chess();
    let letzter = null;
    for (const u of laufend.zuege) {
      const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });
      if (!m) return null;
      letzter = [m.from, m.to];
    }
    return { fen: c.fen(), amZug: c.turn(), zuletzt: letzter || [], schach: c.inCheck() };
  } catch (e) { return null; }
}

const sichtVon = (laufend) => (laufend.modus !== 'zuzweit' && laufend.spielerFarbe === 'b' ? 'b' : 'w');

// "Du bist am Zug" (gross = Satzanfang); in Zu zweit "Weiss am Zug"
function zugText(laufend, st, bot, gross) {
  const g = gross ? 'Gross' : '';
  if (laufend.modus === 'zuzweit') return t('heim.zug.' + (st.amZug === 'w' ? 'w' : 's') + g);
  if (st.amZug === sichtVon(laufend)) return t('heim.zug.du' + g);
  return t('heim.zug.bot' + g, { name: bot ? bot.name : '' });
}

function buehnePartie(laufend, st) {
  const zuzweit = laufend.modus === 'zuzweit';
  const bot = zuzweit ? null : botNachId(laufend.botId);
  const namen = laufend.zuzweit || {};
  const ueber = zuzweit
    ? t('heim.zuzweit', { weiss: namen.weiss || t('heim.weiss'), schwarz: namen.schwarz || t('heim.schwarz') })
    : t('heim.gegen', { name: bot ? bot.name : '', elo: bot ? zahl(bot.elo) : '' });
  // das Brett selbst baut zeigeHeim (echtes Brett der App, nur zum Ansehen)
  return `<div class="heim-brett"><div class="heim-mini"></div></div>
    <div class="heim-buehne-text">
      <small class="heim-ueber">${esc(ueber)}</small>
      <h2 class="heim-lage" aria-live="polite">${esc(zugText(laufend, st, bot, true))}</h2>
      <div class="heim-balken" hidden><span class="heim-balken-spur"><span class="heim-balken-wert"></span></span><span class="heim-balken-zahl zahl"></span></div>
      <button class="heim-los dr" type="button" data-aktion="heim-weiter">${icon('play')}<span>${esc(t('heim.weiter'))}</span></button>
    </div>`;
}

function buehneGegner(bot) {
  return `<div class="heim-portraet" style="--bot-farbe: var(--bot-${esc(bot.id)}, var(--gold))"><img src="${esc(bot.avatar)}" alt="" draggable="false"></div>
    <div class="heim-buehne-text">
      <small class="heim-ueber">${esc(t('heim.naechsterGegner'))}</small>
      <div class="heim-name"><h2 class="heim-gegner">${esc(bot.name)}</h2>
        <small class="heim-elo zahl">${esc(t('heim.elo', { elo: zahl(bot.elo) }))}</small></div>
      ${bot.kurz ? `<p class="heim-spielweise">${esc(bot.kurz)}</p>` : ''}
      <button class="heim-los dr" type="button" data-aktion="heim-spielen" data-bot="${esc(bot.id)}">${icon('play')}<span>${esc(t('heim.spielen'))}</span></button>
    </div>`;
}

// "Deine Leiter" (nur ohne laufende Partie): die drei Bots nach dem naechsten Gegner, nur aus BOTS; danach keiner -> weg
function leiterZeile(bot) {
  const danach = [...BOTS].sort((a, c) => a.stufe - c.stufe).filter((b) => b.stufe > bot.stufe).slice(0, 3);
  if (!danach.length) return '';
  return `<section class="heim-leiter" aria-labelledby="heim-leiter-titel">
      <h3 id="heim-leiter-titel">${esc(t('heim.leiter'))}</h3>
      <button class="heim-leiter-liste dr" type="button" data-aktion="heim-leiter">
        ${danach.map((b) => `<span class="heim-leiter-bot" style="--bot-farbe: var(--bot-${esc(b.id)}, var(--gold))">
          <img src="${esc(b.avatar)}" alt="" draggable="false"><span><b>${esc(b.name)}</b><small class="zahl">${esc(zahl(b.elo))}</small></span>
        </span>`).join('')}
      </button>
    </section>`;
}

// Kronen-Stand vom Server (oder gemerkt) als Lage der Liga-Zeile; null heisst ohne Konto. Jeder kaputte Wert gilt als 0
// bzw. als "ohne Gruppe" (platz null). anteil: Weg bis zu den Kronen auf Platz 5 (ziel, der letzte Aufstiegsplatz), auf
// Platz 1 bis 5 voll.
const ganz = (v, min, max) => { const x = Number(v); return Number.isFinite(x) ? Math.min(max, Math.max(min, Math.floor(x))) : null; };
export function kronenLage(stand) {
  const o = stand && typeof stand === 'object' && !Array.isArray(stand) ? stand : {};
  const kronen = ganz(o.kronen, 0, Number.MAX_SAFE_INTEGER) ?? 0;
  const s = stufeInfo(ganz(o.stufe, 0, 17) ?? 0);
  const n = ganz(o.n, 1, 1000) ?? GRUPPE_GROESSE;
  const platz = o.platz == null ? null : ganz(o.platz, 1, n);
  const ziel = o.ziel == null ? null : ganz(o.ziel, 0, Number.MAX_SAFE_INTEGER);
  let anteil = 0;
  if (platz != null && platz <= AUFSTIEG_PLAETZE) anteil = 1;
  else if (platz != null && ziel > 0) anteil = Math.min(1, kronen / ziel);
  return { kronen, stufe: s.index, liga: s.liga, rang: s.rang, platz, n, ziel, anteil, ohneKonto: stand == null };
}

// Erste Lage ohne Netz: der gemerkte Stand dieses Kontos; ohne Konto oder ohne gemerkten Stand null (Zeile entfaellt)
function ersteLage() {
  if (!angemeldet()) return null;
  const m = kronenSpeicher(ladeModul('kronen'));
  const uid = sitzung()?.user?.id;
  return m.stand && uid && m.konto === uid ? kronenLage(m.stand) : null;
}

function merke(stand) {
  const uid = sitzung()?.user?.id;
  if (!uid) return;
  const alt = kronenSpeicher(ladeModul('kronen'));
  const st = { kronen: stand.kronen, stufe: stand.stufe, platz: stand.platz ?? null, ziel: stand.ziel ?? null, n: stand.n };
  speichereModul('kronen', { konto: uid, stand: st, startGemeldet: alt.konto === uid ? alt.startGemeldet : false });
}

// "Als Naechstes" (Variante A, Flo 08.11.2026: die Tagesziele ziehen aus dem Bots-Panel hierher, unter die Wege): zuerst
// die Zeilen der Pakete am Ort heim:naechstes (Klassen-Aufgabe 5, Wochen-Boss 6, Funken-Wochenende 7, Neu fuer dich 8,
// Tageswerk 10, Tagesraetsel 20, Kartei 25, je nur solange etwas ansteht; die Reihenfolge ist die Prioritaet), dann
// der Liga-Platz (Kronen der Wochen-Gruppe, Etappe B). Wie viele Zeilen sichtbar sind, entscheidet css/heim.css nach der
// Fensterhoehe (auf dem Handy scrollt nichts). Ruhig: kein Countdown, kein roter Punkt. Ohne Zeile entfaellt der Abschnitt.
function ligaZeile(lg) {
  if (!lg || lg.ohneKonto) return '';
  const stufe = stufenName(lg.stufe);
  const text = lg.platz != null ? t('heim.liga.platz', { platz: zahl(lg.platz), n: zahl(lg.n) }) : t('heim.liga.ohneGruppe');
  const label = t('heim.liga.label', { stufe, zeile: text, kronen: zahl(lg.kronen) });
  return `<button class="heim-zeile dr" type="button" data-aktion="heim-liga" aria-label="${esc(label)}">
        <span class="heim-zeile-bild" aria-hidden="true">${icon('liga')}</span>
        <span class="heim-zeile-text"><b>${esc(stufe)}</b><span>${esc(text)}</span></span>
        <span class="heim-zeile-balken" aria-hidden="true"><span style="width: ${Math.round(lg.anteil * 100)}%"></span></span>
      </button>`;
}

// Zeile fuer die Pakete (Kontext zeile() am Ort heim:naechstes): dieselbe Form wie die Liga-Zeile, rechts ein Pfeil
function paketZeile({ symbol = '', titel = '', text = '', label = '', beiTipp, paket = '' } = {}) {
  const k = document.createElement('button');
  k.type = 'button';
  k.className = 'heim-zeile dr';
  if (paket) k.dataset.paket = paket;
  if (label) k.setAttribute('aria-label', label);
  k.innerHTML = `<span class="heim-zeile-bild" aria-hidden="true">${symbol}</span>
      <span class="heim-zeile-text"><b>${esc(titel)}</b><span>${esc(text)}</span></span>
      <span class="heim-zeile-pfeil" aria-hidden="true">${icon('vor')}</span>`;
  if (typeof beiTipp === 'function') k.addEventListener('click', (e) => { e.stopPropagation(); beiTipp(e); });
  return k;
}

// Abschnitt sichtbar, sobald eine Zeile drinsteht
function zeigeNaechstes(s) {
  const n = s.querySelector('.heim-naechstes');
  n.hidden = !n.querySelector('.heim-zeile');
}

// Liga-Zeile neu zeichnen (Server-Stand kam nach dem ersten Zeichnen); die Zeilen der Pakete bleiben stehen
function zeichneLiga(s, lg) {
  const alt = s.querySelector('.heim-liste [data-aktion="heim-liga"]');
  if (alt) alt.remove();
  const html = ligaZeile(lg);
  if (html) s.querySelector('.heim-liste').insertAdjacentHTML('beforeend', html);
  zeigeNaechstes(s);
}

export function zeigeHeim(app, { jetzt = new Date() } = {}) {
  const laufend = ladeLaufendePartie();
  const st = laufend ? stellung(laufend) : null;
  const partie = !!(laufend && st);
  const bot = partie ? null : naechsterGegner();
  const tage = serieTage(jetzt);
  const chips = tage > 0
    ? `<span class="chip zahl heim-serie" title="${esc(t('heim.serieTitel', { n: tage }))}"><i class="heim-punkt" aria-hidden="true"></i>${esc(t('heim.serie', { n: tage }))}</span>`
    : '';
  const s = document.createElement('section');
  s.className = 'screen heim-screen';
  s.setAttribute('aria-label', t('heim.aria'));
  s.innerHTML = `${hauptKopf({ titelElement: 'div', premium: true, klang: false, chips })}
    <div class="heim-rumpf">
      <div class="heim-links">
        <div class="heim-gruss"><small>${esc(gruss(jetzt))}</small><h1>${esc(t(partie ? 'heim.titel.partie' : 'heim.titel.leer'))}</h1></div>
        <div class="heim-buehne" data-art="${partie ? 'partie' : 'gegner'}">${partie ? buehnePartie(laufend, st) : buehneGegner(bot)}</div>
        ${partie ? '' : leiterZeile(bot)}
      </div>
      <div class="heim-rechts">
        <div class="heim-wege">
          ${WEGE.map(([id, ic]) => `<button class="heim-modus dr" type="button" data-aktion="heim-${id}" data-weg="${id}">
            <span class="heim-symbol" aria-hidden="true">${icon(ic)}</span>
            <span class="heim-text"><b>${esc(t('heim.' + id + '.titel'))}</b><span>${esc(t('heim.' + id + '.text', wegWerte()))}</span></span>
          </button>`).join('')}
        </div>
        <section class="heim-naechstes" aria-labelledby="heim-naechstes-titel" hidden>
          <h3 id="heim-naechstes-titel">${esc(t('heim.naechstes'))}</h3>
          <div class="heim-liste"></div>
        </section>
      </div>
    </div>`;
  s._orte = fuelle('heim:naechstes', s.querySelector('.heim-liste'), { app, tag: tagSchluessel(jetzt), zeile: paketZeile });
  zeichneLiga(s, ersteLage());
  // Rueckkehr nach einer Pause: als erste Zeile (die Reihenfolge ist die Prioritaet, css/heim.css blendet von unten aus)
  let zurueck = null;
  try { zurueck = rueckkehr(jetzt); } catch (e) { zurueck = null; }
  if (zurueck) {
    s.querySelector('.heim-liste').insertAdjacentHTML('afterbegin', rueckkehrZeile(zurueck, partie, bot));
    zeigeNaechstes(s);
  }
  s.querySelector('.heim-rumpf').addEventListener('click', (e) => {
    const k = e.target.closest('[data-aktion]');
    if (!k) return;
    let a = k.dataset.aktion;
    if (a === 'heim-zurueck') {
      rueckkehrErledigt();
      a = partie ? 'heim-weiter' : 'heim-spielen';
    }
    if (a === 'heim-weiter' && laufend) {
      if (laufend.modus === 'zuzweit') app.gehe('partie', { modus: 'zuzweit', fortsetzen: true });
      else app.gehe('partie', { botId: laufend.botId, farbe: laufend.spielerFarbe, fortsetzen: true });
    } else if (a === 'heim-spielen') app.gehe('partie', { botId: k.dataset.bot });
    else if (a === 'heim-liga') app.gehe('bestenliste');
    else if (a === 'heim-leiter') app.gehe('arena');
    // Flo 08.11.2026: die neue Online-Seite (Partie und Raetsel-Duell) fuer alle; die Lobby bleibt Labor-Vorschau
    else if (a === 'heim-online') app.gehe('online');
    else if (a === 'heim-raetsel') app.gehe('training');
    else if (a === 'heim-zuzweit') app.gehe('partie', { modus: 'zuzweit' });
  });
  if (partie) {
    // dasselbe Brett wie in der Partie (Figurensatz, Brettfarben, Koordinaten aus den Einstellungen), nur zum Ansehen:
    // keine Zuege, keine Pfeile, Tipps gehen durch (pointer-events in heim.css)
    const e = ladeEinstellungen();
    s._brett = new Brett(s.querySelector('.heim-mini'), { ausrichtung: sichtVon(laufend), figurenPfad: figurenPfad(e),
      koordinaten: e.koordinaten, koordLage: e.koordLage, pfeile: false });
    s._brett.setzeStellung(st.fen, { animieren: false, letzterZug: st.zuletzt.length ? st.zuletzt : null, schach: st.schach ? true : null });
    s._bewertung = { fen: st.fen, sicht: sichtVon(laufend), laufend, st };
  }
  return s;
}

// Lage-Satz und Balken nachtragen, sobald die Engine eine kurze Bewertung hat; ohne Engine bleibt "Du bist am Zug"
async function bewerte(s, app, istWeg) {
  const b = s._bewertung;
  if (!b || !app || typeof app.engine !== 'function') return;
  try {
    const engine = await app.engine('bewertung');
    if (istWeg()) return;
    const r = await engine.analyse(b.fen, { depth: BEWERTUNG_TIEFE });
    if (istWeg() || !r || !r.lines || !r.lines[0]) return;
    const ev = r.lines[0].eval || {};
    const l = lageSatz(ev.cp, ev.mate, b.sicht);
    const zz = b.laufend.modus === 'zuzweit';
    const bot = zz ? null : botNachId(b.laufend.botId);
    let satz;
    if (zz) satz = l.art === 'gleich' ? t('heim.lage.gleich') : t(l.anteil > 0.5 ? 'heim.lage.wBesser' : 'heim.lage.sBesser');
    else satz = t('heim.lage.' + l.art);
    s.querySelector('.heim-lage').textContent = `${satz}, ${zugText(b.laufend, b.st, bot, false)}`;
    const balken = s.querySelector('.heim-balken');
    balken.querySelector('.heim-balken-wert').style.width = Math.round(l.anteil * 100) + '%';
    balken.querySelector('.heim-balken-zahl').textContent = l.wert;
    balken.setAttribute('role', 'img');
    balken.setAttribute('aria-label', t('heim.balken', { wert: l.wert }));
    balken.hidden = false;
  } catch (e) { /* ohne Bewertung bleibt der Zug-Satz */ }
}

export function zeige(root, params, app) {
  const s = zeigeHeim(app);
  root.append(s);
  let weg = false;
  const kopf = verbindeKopf(s, app, {
    beiZurueck: () => app.zurueck(),
    beiEinstellungen: () => app.gehe('einstellungen'),
  });
  // Ruhe: nur die Buehne gleitet einmal sanft herein (tempo() ist 0 bei reduzierter Bewegung)
  if (tempo() > 0) {
    kopfEintritt(s);
    anim(s.querySelector('.heim-buehne'), [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { d: 620 });
  }
  bewerte(s, app, () => weg);
  // Kronen-Stand nachladen; offline oder bei einer unbrauchbaren Antwort bleibt der gemerkte Stand (oder keine Zeile)
  if (angemeldet()) {
    holeStand().then((d) => {
      const stand = Array.isArray(d) ? d[0] : d;
      if (!stand || typeof stand !== 'object' || !Number.isFinite(Number(stand.kronen))) return;
      merke(stand);
      if (!weg && s.isConnected) zeichneLiga(s, kronenLage(stand));
    }, () => {});
  }
  return {
    verlasse() {
      weg = true;
      try { kopf.verlasse(); } catch (e) { /* egal */ }
      try { s._orte.verlasse(); } catch (e) { /* egal */ }
      if (s._brett) s._brett.zerstoere();
    },
  };
}
