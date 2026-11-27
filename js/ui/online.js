// Die Datenbank fuehrt Reihenfolge und Uhr; jede Stellung wird hier aus legalen Zuegen rekonstruiert.
// Anti-Cheat Etappe 1a: Ein eigener Zug geht nur noch als UCI an die Edge Function online-zug. Stellung, Seite am Zug und
// das Ende rechnet der Server selbst aus; der Browser meldet kein Ergebnis mehr. Die Pruefungen unten bleiben trotzdem.
// Anti-Cheat Etappe 0: Passt die Stellung des Servers nicht zu den Zuegen (verglichen werden nur Brett und Seite am
// Zug, nicht der ganze FEN-Text), friert die Partie nicht mehr ein: Es erscheint eine Meldung, und der Browser meldet
// die laufende Partie einmal von selbst als strittig (online_strittig, Ende ohne Ergebnis), ohne dass jemand tippen
// muss. Sonst koennte der Schummler einfach warten, bis die Uhr des Opfers ablaeuft (Konzept Anti-Cheat 5.1, L5).
// Scheitert die Meldung (Netz), bleibt der Knopf "Strittig melden" als Rueckfall. Ein gemeldetes Ende (Matt, Patt,
// Remis-Regeln) wird mit chess.js nachgeprueft; stimmt es nicht, steht dort "Ergebnis nicht nachvollziehbar" statt
// Sieg oder Niederlage.
import { ladePaketCss } from '../paket-css.js';
import { Chess } from '../../vendor/chess/chess.js';
import { t } from '../sprache.js';
import '../sprachen/online.js';
import '../sprachen/partie.js';
const O = (k, w) => t('online.' + k, w);
import { Brett, zielKarte } from '../board.js';
import { icon } from './icons.js';
import { figurenPfad, satzPfad } from '../figurensatz.js';
import { meldeEffekte, effekteDerPartie, gegnerEffekteAn } from '../gegner-effekte.js';
import { spieleZugEffekt, eigenerZugEffekt } from '../zug-effekt.js';
import { sanAnzeige, materialBilanz } from '../review.js';
import { sitzung, ladeProfil, kontoFreigeschaltet, bestaetigteNamen, hatHaken, hakenHtml } from '../konto.js';
import * as online from '../online.js';
import { karteDerPartie } from '../karte.js';
import { vorzugZiele as vorzugZieleVon, merkeVorzug as merkeInKette, naechsterVorzug } from '../vorzug.js';
import { fremdeKarte, eigeneKarte, bannerUrl, fremderAvatar } from './visitenkarte.js';
import { zeigeGegnerProfil, profilText } from './gegner-profil.js';
import { hauptKopf, seitenKopf, verbindeKopf } from './seite.js';
import { holeStand, suche as kronenSuche, RANKED_ZEIT } from '../kronen.js';
import { stufenName } from '../pakete/liga/texte.js';
// R27 Online Arena: Medaille und Partie-Symbol als Kronjuwel, Season-Rest und Weltrangliste aus vorhandenen Quellen
import { kronSymbol, duellSchwerter, raetselBlitz } from './icons.js';
import { holeSaison } from '../kronen.js';
import { sheet } from './bauteile.js';
import { paket2Frei } from '../freigaben.js';
import { floAvatar } from '../thema.js';
import { klang, zugKlangName } from '../sounds.js';
import { spieleDuell } from './duell.js';
import { jetzt as serverJetzt, anzeigeJetzt, seit as zeitSeit } from '../serverzeit.js';
import { speicherePartie, ladePartie as ladeGespeichert, aktualisierePartie } from '../storage.js';
import { fuelle } from '../orte.js';
import { BRETT_FEIER } from '../feier.js';
import { tempo } from '../bewegung.js';

const WURZEL = new URL('../../', import.meta.url);
// das CSS steht, bevor app.js zeige() aufruft (js/paket-css.js)
await ladePaketCss('online', { screens: ['online'], href: new URL('css/online.css', WURZEL).href, marke: { online: '' } });
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// neutrales Bild fuer den Gegner, solange keine Karte da ist (die Leiste zieht jedes svg auf 100 %: Rand im Stil)
const GEGNER_STANDARD = icon('person').replace('<svg ', '<svg style="box-sizing:border-box;padding:24%;color:var(--text-3)" ');
const andere = f => f === 'w' ? 'b' : 'w';
const TEMPI = { ohne: [null, 0], '5': [300, 0], '10': [600, 0], '15': [900, 10] };
const uhrText = ms => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
// Mit Uhr und vor dem 2. Halbzug beendet der Server eine Partie ohne Zug (online_haengt in supabase/zwei-ligen-schema.sql):
// gewertet nach ranked_haengt_s (30 s), Freundespartien nach 10 Minuten. Die Oberflaeche fragt erst danach
// (online_pruefe_zeit), gewertet eine Sekunde nach dem Server; meldet er noch nichts (Uhren weichen ab), fragt sie
// gewertet nach 5 s, sonst nach einer Minute erneut. Vertrag: tests/online-haengt-vertrag.test.mjs.
const HAENGT_MS = 10 * 60 * 1000;
const HAENGT_ABFRAGE_MS = 60 * 1000;
const HAENGT_RANKED_MS = (30 + 1) * 1000;
const HAENGT_RANKED_ABFRAGE_MS = 5 * 1000;
const haengtNachMs = p => p.gewertet ? HAENGT_RANKED_MS : HAENGT_MS;
// Erstzug-Frist des Servers (online_haengt: gewertet ranked_haengt_s = 30 s, sonst 10 Minuten), so angezeigt
const erstzugFristMs = p => p.gewertet ? HAENGT_RANKED_MS - 1000 : HAENGT_MS;
// R19: so lange darf ein neuer Stand alt sein, wenn diese Ansicht ihn zum ersten Mal sieht (Abfrage alle 2 s)
const SICHT_SPIEL_MS = 2000;
// R19 (16.11.): so oft reklamiert hoechstens die Seite, die NICHT am Zug ist (still, ohne busy; s. tick)
const WARTEND_ABFRAGE_MS = 30 * 1000;
// Partie-Ansicht wie die Bot-Partie (Flo 11.11.2026: "soll aussehen wie die Bot-Partie"): dasselbe Gerippe wie
// js/ui/partie.js (.partie > .inhalt > .brettzone + .seite, Spielerleisten, .spielknoepfe), damit css/partie.css Brett,
// Leisten, Uhren und Knoepfe gleich setzt. Auf dem Handy rechnet layout() unten die Brettgroesse wie dort.
const BRETT_MIN = 280;
// Brettwahl im Kopf (R7, wie BRETTER in js/ui/partie.js, dort nicht exportiert): id, helles und dunkles Feld des Musters
const BRETTER = Object.freeze([['nacht', '#e4e8f6', '#7c87b6'], ['gruen', '#eeeed2', '#769656'], ['holz', '#f0d9b5', '#b58863']]);
const WERT = { q: 9, r: 5, b: 3, n: 3, p: 1 };
const STREIFEN_AB = 760; // wie js/ui/partie.js
const UHR_SYMBOL = '<svg class="ico uhr-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '
  + 'stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/></svg>';
const REMIS_SYMBOL = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><text x="12" y="18" text-anchor="middle" '
  + 'font-size="17" font-weight="800" fill="currentColor">½</text></svg>';
// Duell-Intro vor gewerteten Partien (js/ui/duell.js) nur einmal je Partie und nur vor dem 2. Halbzug (R19)
const INTRO_SCHLUESSEL = 'schach-arena:online:intro';
// R19 online ruhig (Flo 14.11.2026: "zu viele Zahlen, zu unuebersichtlich", Wahl 23:00: Entwurf A): die Lobby zeigt EINE
// Zahl, deine Online-Elo; Spielerleisten nur den Namen; das Ergebnis nur die Kronen-Aenderung (tests/r19-online-ruhig.test.mjs).
// Die Elo kommt nur vom Server (kronen_mein_stand.elo, supabase/online-elo-schema.sql). Fehlt sie, steht dort die Liga als
// Wort, ohne Zahl; die Liga-Wertung des Geraets ist die Bot-Liga, eine andere Groesse, und erscheint hier nie.
const serverElo = (st) => (Number.isInteger(st.elo) && st.elo >= 100 && st.elo <= 4000 ? st.elo : null);
// neueste laufende Partie zuerst (Befund 2 vom 11.11.: zwei gewertete Partien zugleich, jedes Geraet sass in einer anderen)
const zeitVon = (row) => Date.parse(row?.erstellt_am || row?.aktualisiert_am || '') || 0;
const neuesteLaufende = (liste) => (Array.isArray(liste) ? liste : []).filter((row) => row && row.status === 'laeuft')
  .sort((a, b) => zeitVon(b) - zeitVon(a))[0] || null;
// Ein Ende, das der Ziehende selbst meldet, muss am nachgespielten Brett stimmen. Zeit, Aufgabe, Remis per Angebot,
// Abbruch und "strittig" entscheidet der Server selbst; die gelten, wie sie kommen.
function endePasst(stand, c) {
  const remis = stand.ergebnis === '1/2-1/2';
  switch (stand.grund) {
    case 'matt': return c.isCheckmate() && stand.ergebnis === (c.turn() === 'b' ? '1-0' : '0-1');
    case 'patt': return remis && c.isStalemate();
    case 'material': return remis && c.isInsufficientMaterial();
    case 'wiederholung': return remis && c.isThreefoldRepetition();
    case '50-zuege': return remis && c.isDrawByFiftyMoves();
    default: return true;
  }
}

export function zeige(root, params, app) {
  const GRUND = { matt: O('matt'), patt: O('patt'), material: O('material'), wiederholung: O('wiederholung'),
    '50-zuege': O('fuenfzig'), zeit: O('zeit'), 'zeit-material': O('zeitMaterial'), aufgabe: O('aufgabe'), remis: O('remis'),
    abgebrochen: O('zurueckgezogen'), strittig: O('strittig') };
  const STATUS = { offen: O('offen'), laeuft: O('laeuft'), beendet: O('beendet') };

  const s = document.createElement('section'); s.className = 'screen online-screen'; s.setAttribute('aria-label', O('titel'));
  // Handy-Runde 08.11.: Kopf wie Lernen und Ich (Zurueck = woher man kam, Titel "Online"); ohne laufende Partie bleibt
  // die Leiste unten stehen (js/app.js reiterVon)
  s.innerHTML = `${hauptKopf({ zurueck: true, titelElement: 'div', chips: '', seite: O('titel') })}`
    + `<div class="on-rumpf"><p class="on-meldung" role="status" hidden></p><div class="on-inhalt"></div></div>`;
  root.append(s);
  const kopf = verbindeKopf(s, app, { beiZurueck: () => app.zurueck(), beiEinstellungen: () => app.gehe('einstellungen') });
  let suche = null;
  const inhalt = s.querySelector('.on-inhalt'), status = s.querySelector('.on-meldung');
  // blockiert: abgemeldet oder fremde Partie (nichts mehr senden). widerspruch: die Serverstellung passt nicht zu den
  // Zuegen; keine Zuege und keine Zeit-Reklamation mehr, aber "Strittig melden" und "Aufgeben" bleiben bedienbar.
  // strittigFaellig: der Widerspruch ist neu, die Partie wird gleich einmal von selbst als strittig gemeldet.
  let weg = false, busy = false, blockiert = false, widerspruch = false, beobachter = null, brett = null, p = null, chess = null, wartend = null;
  let strittigFaellig = false;
  let profil = null, uhrTimer = null, zeitPruefung = 0, fremdPruefung = 0;
  let kartenDaten = null, kartenPartie = null;
  // R28 (Flo 22.11.2026 mit Opa: "kein Bild" beim Gegner): eine gescheiterte Karte wird nachgeholt, hoechstens KARTE_NACH.length mal
  let kartenVersuch = 0, kartenVersuchFuer = null, kartenUhr = null;
  const KARTE_NACH = [1500, 4000, 10000];
  // R28 Vorzuege (Flo 22.11.2026 "Premoves gehen?"): wie in der Bot-Partie (js/vorzug.js), nur lokal, nie an den Server
  const vorzuege = [];
  // introGelaufen: Duell-Intro dieser Ansicht schon entschieden; neuerGeprueft: Partie, fuer die nach einer neueren gefragt wurde
  let introGelaufen = false, introUhr = null, neuerGeprueft = null, layoutRo = null, layoutBild = 0;
  // R19: wann diese Ansicht den jetzigen letzter_zug_am zuerst sah (Schranke fuer die Erstzug-Frist)
  let ersteSicht = { stand: null, am: 0 };
  let live = null, liveFuer = null;
  // R7 Ergebnisblatt: blattFuer = Partie, fuer die das Blatt gebaut ist; kronenVor/kronenNach = kronen_mein_stand waehrend
  // der laufenden Partie und nach dem gesehenen Ende (nur gewertet; daraus die Aenderung, sonst keine Kronen-Zeile)
  let blattFuer = null, kronenFuer = null, kronenVor = null, kronenNach = null;
  const handyMq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(orientation: portrait) and (max-width: 600px)') : null;
  // Klang: gehoert = Halbzuege, die schon geklungen haben; uhrGewarnt = Uhr-Warnung dieser Partie gespielt
  let gehoert = 0, uhrGewarnt = false;
  const ton = name => { try { klang.spiele(name); } catch (e) { /* Klang ist nie wichtig genug fuer einen Fehler */ } };
  const melde = text => { if (!weg) { status.textContent = text; status.hidden = !text; } };
  // ohne laufende Partie spricht der Offline-Hinweis nicht von "der Partie" (fc-03:30)
  const fehler = e => {
    const text = e?.message || O('fehler');
    melde(text === O('offline') && !p && !params.partieId ? O('offline.ohnePartie') : text);
  };
  // ohne Netz ist "Duell suchen" gesperrt und sagt warum; das online-Ereignis gibt ihn ohne Neuladen frei (fc-03:30)
  function netzStand() {
    if (weg) return;
    const k = inhalt.querySelector('[data-online="duell"]');
    if (!k) return;
    const aus = navigator.onLine === false;
    k.disabled = aus || busy || blockiert;
    if (aus) k.setAttribute('aria-disabled', 'true'); else k.removeAttribute('aria-disabled');
    const h = inhalt.querySelector('.on-netz-hinweis');
    if (h) h.hidden = !aus;
  }
  const oeffne = partie => { if (!weg) { online.vergissEinladung(); app.gehe('online', { partieId: partie.id }); } };
  function sperre() {
    if (weg) return;
    for (const el of inhalt.querySelectorAll('button, input, select')) el.disabled = busy || blockiert;
    // T-070: "Partie suchen" gibt nur pruefeSuche frei (Zustand 'bereit'). Sonst gab das Ende von "Meine Partien" den Knopf
    // frei, waehrend die Liga-Pruefung noch lief, und deren spaete Antwort versteckte eine schon laufende Suche
    const such = sucheKarte()?.querySelector('[data-online="suchen"]');
    if (such) such.disabled = busy || blockiert || sucheKarte().dataset.zustand !== 'bereit';
    const angebot = inhalt.querySelector('[data-online="angeboten"]');
    if (angebot) angebot.disabled = true;
    netzStand();
    // Blaettern aendert nichts an der Partie und bleibt auch waehrend einer Server-Antwort frei
    zeigeZugNav();
    brett?.erlaubeZuege(!busy && !blockiert && !widerspruch && online.binAmZug(p) ? zielKarte(chess, { turmRochade: app.einstellungen().turmRochade === true })
      : kannVormerken() ? vorzugZiele() : null);
  }
  async function aktion(fn, danach = uebernehme, beiFehler = fehler) {
    if (busy || weg || blockiert) return;
    busy = true; melde(''); sperre();
    try { const ergebnis = await fn(); if (!weg) danach(ergebnis); }
    catch (e) {
      if (weg) return;
      beiFehler(e);
      // Eine verlorene Antwort kann trotzdem einen verbuchten Zug bedeuten. Serverstand nachladen.
      if (p) try { const neu = await online.ladePartie(p.id); if (!weg) uebernehme(neu); } catch (x) { /* Abfrage versucht es weiter */ }
    } finally {
      busy = false;
      if (!weg) {
        if (wartend) { const neu = wartend; wartend = null; uebernehme(neu); }
        if (p && !blockiert) { try { const r = nachspielen(p); chess = r.chess; widerspruch = !r.passt; } catch (e) { /* bleibt beim letzten Stand */ } zeichne(); }
        sperre();
        meldeStrittigVonSelbst();
      }
    }
  }
  // Ein neuer Widerspruch in einer laufenden Partie wird genau einmal von selbst als strittig gemeldet (laeuft gerade
  // eine andere Aktion, danach). Scheitert das, bleibt der Knopf "Strittig melden" stehen, und die Meldung sagt es.
  function meldeStrittigVonSelbst() {
    if (!strittigFaellig || busy || weg || blockiert) return;
    strittigFaellig = false;
    if (!widerspruch || p?.status !== 'laeuft') return;
    // Ist die Partie inzwischen schon beendet (etwa weil der Gegner gerade die Zeit reklamiert hat), gibt es keinen
    // Knopf mehr: dann nur die Meldung des Servers, die Ergebniskarte zeigt das Ende ("nicht nachvollziehbar").
    aktion(() => online.meldeStrittig(p.id), neu => { uebernehme(neu); melde(O('stellungStrittig')); },
      e => melde(e?.kennung === 'ONLINE_PARTIE_BEENDET' ? e.message : `${e?.message || O('fehler')} ${O('strittigVonHand')}`));
    melde(O('stellungFehler')); // aktion leert die Zeile beim Start; waehrend der Meldung bleibt der Grund sichtbar
  }
  // Online-Seite "Zwei Tueren" (Flo 08.11.2026, Konzept 1 A mit den Woertern von B), seit R27 "Arena" (Flo 21.11.2026: O1 aus
  // dem R27-Plan, Look wie die Premium-Seite, Bauteile .juwel-* in css/bauteile.css): oben die Kopfkarte (der Liga-Knopf als
  // Schmuck-Karte mit Medaille, Elo in Gold, Liga, Platz, Season-Rest und der Form der letzten fuenf gewerteten Partien),
  // darunter Partie (Gold) und Raetsel-Duell (Saphir), die Freunde-Karte mit zwei Knoepfen (klappt Einladen, Code und Meine
  // Partien darunter auf), quer ab 1100 px rechts die Weltrangliste um den eigenen Platz. Jeder Block ohne Daten fehlt ganz,
  // nie ein Platzhalter. Passt ohne Scrollen auf das iPhone 13 (tests/online-ui.test.mjs). Ohne Konto sind die Karten nur
  // Erklaerung, ohne Knopf und ohne Schatten, damit nichts tippbar aussieht; der einzige Knopf ist "Zum Konto".
  // Partie in Gold mit Schwertern, Raetsel-Duell in Nachtblau mit Blitz; die einzige Krone der Seite traegt die Medaille oben
  const symbol = art => `<span class="juwel-plakette on-symbol" data-ton="${art === 'duell' ? 'nacht' : 'gold'}" aria-hidden="true">`
    + `${art === 'duell' ? raetselBlitz() : duellSchwerter()}</span>`;
  const tuer = (art, rumpf) => `<section class="on-art on-tuer juwel-karte" data-art="${art}" data-ton="${art === 'duell' ? 'nacht' : 'gold'}" aria-labelledby="on-${art}-t">
      <div class="on-tuer-kopf">${symbol(art)}<div class="on-tuer-text"><span class="on-tuer-ueber">${esc(O(`tuer.${art}.ueber`))}</span>
        <h2 id="on-${art}-t">${esc(O(art === 'duell' ? 'ruhig.duellTitel' : `tuer.${art}.titel`))}</h2><p>${esc(O(`tuer.${art}.text`))}</p></div></div>${rumpf}</section>`;
  const freundeKarte = () => `<section class="on-freunde-karte juwel-karte" data-ton="ruhig" aria-labelledby="on-freunde-t">`
    + `<span class="on-freunde-paar" aria-hidden="true">${['wK', 'bK'].map((f) => `<img src="${new URL(`assets/pieces/${f}.svg`, WURZEL).href}" alt="">`).join('')}</span>`
    + `<div class="on-freunde-text"><h2 id="on-freunde-t">${esc(O('freunde.titel'))}</h2><p>${esc(O('freunde.zeileText'))}</p></div>`
    + `<div class="on-freunde-knoepfe"><button class="knopf juwel-knopf dr" data-ton="ruhig" type="button" data-online="freunde-einladen">${esc(O('einladen'))}</button>`
    + `<button class="knopf juwel-knopf dr" data-ton="ruhig" type="button" data-online="freunde-code">${esc(O('codeEingeben'))}</button></div></section>`;
  const RING = 2 * Math.PI * 44;
  function start() {
    const kopfHtml = seitenKopf({ titel: O('titel'), text: O('kurz') });
    if (!sitzung()?.access_token) {
      const hinweis = `<p class="on-tuer-hinweis">${esc(O('tuer.ohneKonto'))}</p>`;
      inhalt.innerHTML = `${kopfHtml}<div class="on-tueren" data-zustand="ohne">${tuer('partie', hinweis)}${tuer('duell', hinweis)}</div>
        <section class="t-karte on-konto"><h2>${esc(O('konto.titel'))}</h2><p>${esc(O('konto.erklaert'))} ${esc(O('konto'))}</p>`
        + (online.gemerkteEinladung() ? `<p>${esc(O('merker'))}</p>` : '')
        + `<div class="t-fuss"><button class="knopf primaer dr" type="button" data-online="konto">${esc(O('konto.knopf'))} ${icon('vor')}</button></div></section>`;
      return;
    }
    if (params.partieId) {
      inhalt.innerHTML = `<p>${esc(O('ladePartie'))}</p>`;
      aktion(() => online.ladePartie(params.partieId), neu => {
        uebernehme(neu);
        if (params.analyse && neu.status === 'beendet') {
          karteDerPartie(neu.id).then((d) => { if (d && !weg) kartenDaten = d; }).catch(() => {}).finally(() => { if (!weg) zurAnalyse(); });
        }
        if (!blockiert && neu.status !== 'beendet') beobachter = online.beobachte(neu.id, {
          seit: neu.aktualisiert_am, partie: neu,
          beiAenderung: stand => { if (busy) wartend = stand; else uebernehme(stand); },
          beiFehler: e => { fehler(e); if (e.abgemeldet) { blockiert = true; sperre(); } },
        });
      });
      ladeProfil().then(d => { if (!weg) { profil = d; if (p) karten(); } }).catch(() => {});
      return;
    }
    const code = online.gemerkteEinladung() || '';
    // Gegnersuche fuer die Liga (dieselbe Suche wie die Lobby, js/kronen.js): erst zeigen, wenn der Server die Liga kennt
    // (kronen_mein_stand antwortet); sonst ein ruhiger Hinweis "kommt bald", kein Fehler.
    // Kein Springen beim Laden (G-005 AC-06): Liga-Streifen, feste Bedenkzeit und Suchknopf stehen schon waehrend der Pruefung
    // in voller Hoehe da, Streifen als leerer Platzhalter, Knopf gesperrt; "kommt bald" blendet den Platzhalter aus
    inhalt.innerHTML = `${kopfHtml}
      <div class="on-held juwel-karte"><button class="on-liga on-held-knopf dr" type="button" data-online="liga" data-laedt disabled aria-hidden="true"><span class="on-liga-schild juwel-medaille">${kronSymbol('liga')}</span>
        <span class="on-liga-text on-held-stand"><b></b><span></span></span></button><button class="on-form dr" type="button" data-online="form" hidden></button></div>
      <div class="on-tueren" data-zustand="konto">
      ${tuer('partie', `<p class="on-suche-text" hidden>${esc(O('suche.pruefen'))}</p>
        <p class="on-zeit-fest">${esc(O('suche.zeitFest', { zeit: RANKED_ZEIT.id.replace('+', ' + '), art: O('zeit.' + RANKED_ZEIT.art) }))}</p>
        <button class="knopf primaer juwel-knopf dr on-tuer-knopf" data-ton="gold" type="button" data-online="suchen" disabled>${esc(O('tuer.partie.knopf'))}</button>
        <button class="knopf primaer juwel-knopf dr on-tuer-knopf" data-ton="gold" type="button" data-online="fortsetzen" hidden>${esc(O('laufend.knopf'))}</button>
        <div class="on-suche" hidden>
          <div class="on-ring" aria-hidden="true"><svg viewBox="0 0 100 100"><circle class="on-ring-spur" cx="50" cy="50" r="44"/>
            <circle class="on-ring-rest" cx="50" cy="50" r="44" stroke-dasharray="${RING.toFixed(2)}" stroke-dashoffset="0"/></svg>
            <span class="on-ring-ich">${floAvatar('w')}</span></div>
          <h3>${esc(O('suche.ring'))} <span class="on-uhr zahl" aria-hidden="true">0:00</span></h3><p class="on-rest" role="status"></p>
          <button class="knopf primaer dr" type="button" data-online="ki-jetzt">${esc(O('suche.kiJetzt'))}</button>
          <small class="on-ki-hinweis">${esc(O('suche.kiHinweis'))}</small>
          <button class="knopf dr" type="button" data-online="suche-stopp">${esc(O('suche.abbrechen'))}</button>
        </div>`)}
      ${tuer('duell', `<button class="knopf primaer juwel-knopf dr on-tuer-knopf" data-ton="nacht" type="button" data-online="duell">${esc(O('tuer.duell.knopf'))}</button>
        <p class="on-tuer-hinweis on-netz-hinweis" hidden>${esc(O('netz.fehlt'))}</p>`)}
      </div>${freundeKarte()}
      <details class="on-freunde"${code || params.freunde ? ' open' : ''}>
        <summary class="on-freunde-zeile dr"><span class="on-freunde-symbol" aria-hidden="true">${icon('person')}</span>
          <span><b>${esc(O('freunde.zeile'))}</b><small>${esc(O('freunde.zeileText'))}</small></span></summary>
        <div class="on-start"><form class="on-karte flaeche" data-form="einladen"><h3>${esc(O('einladen'))}</h3>
        <label>${esc(O('farbe'))}<select name="farbe"><option value="w">${esc(O('weiss'))}</option><option value="b">${esc(O('schwarz'))}</option><option value="zufall" selected>${esc(O('zufall'))}</option></select></label>
        <label>${esc(O('bedenkzeit'))}<select name="tempo"><option value="ohne">${esc(O('ohneUhr'))}</option><option value="5">5+0</option><option value="10">10+0</option><option value="15">15+10</option></select></label>
        <button class="knopf primaer" type="submit">${esc(O('erstellen'))}</button></form>
        <form class="on-karte flaeche" data-form="beitreten"><h3>${esc(O('codeEingeben'))}</h3><label>${esc(O('code'))}<input name="code" value="${esc(code)}" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC234" required></label>
        <button class="knopf primaer" type="submit">${esc(O('beitreten'))}</button></form></div>
        <section class="on-karte flaeche"><h3>${esc(O('meine'))}</h3><p class="on-liste">${esc(O('ladeListe'))}</p><button class="knopf" type="button" data-online="liste">${esc(O('aktualisieren'))}</button></section>
      </details>
      <aside class="on-rang juwel-karte" data-ton="ruhig" aria-labelledby="on-rang-t" hidden></aside>`;
    inhalt.querySelector('[name="code"]').addEventListener('input', e => { e.target.value = online.normalisiereCode(e.target.value).slice(0, 6); });
    netzStand();
    ladeListe();
    pruefeSuche();
    ladeSaison();
    zeigeRang();
  }
  const sucheKarte = () => inhalt.querySelector('.on-art[data-art="partie"]');
  let restUhr = null;
  function sucheZustand(zustand, text) {
    const k = sucheKarte(); if (!k || weg) return;
    k.dataset.zustand = zustand;
    const zeile = k.querySelector('.on-suche-text');
    zeile.textContent = text; zeile.hidden = zustand === 'bereit' || zustand === 'sucht';
    k.querySelector('.on-tuer-kopf').hidden = zustand === 'sucht';
    k.querySelector('.on-zeit-fest').hidden = zustand !== 'bereit';
    k.querySelector('[data-online="suchen"]').hidden = zustand !== 'bereit';
    k.querySelector('[data-online="suchen"]').disabled = zustand !== 'bereit';
    k.querySelector('[data-online="fortsetzen"]').hidden = zustand !== 'laufend';
    if (zustand === 'bald') { const l = inhalt.querySelector('.on-liga[data-laedt]'); if (l) { l.hidden = true; l.closest('.on-held').hidden = true; } }
    k.querySelector('.on-suche').hidden = zustand !== 'sucht';
    if (zustand !== 'sucht') { clearInterval(restUhr); restUhr = null; }
  }
  // Restzeit bis zum KI-Gegner als Ring und Satz (Konzept 3 A), dazu die Suchdauer "0:12"; Wartezeit und Beginn nennt
  // der Server (js/gegnersuche.js, ohne neues SQL 10 s). Ab ki_ab_s zaehlt "Jetzt gegen KI" fuer die Liga.
  function zeigeRest() {
    const k = sucheKarte(); if (!k || weg || !suche) return;
    const l = suche.lage();
    const rest = Math.max(0, l.warteMs - l.vergangenMs);
    const sek = Math.floor(l.vergangenMs / 1000);
    k.querySelector('.on-uhr').textContent = `${Math.floor(sek / 60)}:${String(sek % 60).padStart(2, '0')}`;
    k.querySelector('.on-rest').textContent = O('suche.rest', { s: Math.ceil(rest / 1000) });
    k.querySelector('.on-ring-rest').setAttribute('stroke-dashoffset', (RING * (1 - rest / l.warteMs)).toFixed(2));
    const gewertet = l.vergangenMs >= l.kiAbMs;
    const hinweis = k.querySelector('.on-ki-hinweis');
    if (hinweis.dataset.gewertet !== String(gewertet)) {
      hinweis.dataset.gewertet = String(gewertet);
      hinweis.textContent = O(gewertet ? 'suche.kiGewertet' : 'suche.kiHinweis');
    }
  }
  // Kopfkarte aus kronen_mein_stand (R27 Arena; vorher R19 "eine Zahl" mit "Mehr"): gross die Elo vom Server in Gold, ohne
  // sie die Liga als Wort; darunter Liga, Platz in der Wochen-Gruppe und der Season-Rest (saison_mein_stand, kommt einzeln),
  // rechts die Form der letzten fuenf gewerteten Partien (aus der Liste "Meine Partien", die die Lobby ohnehin laedt). Der
  // Knopf fuehrt wie bisher zur Liga (data-online="liga"). Unbrauchbare Antwort: keine Karte.
  let held = null; // { elo, stufe, platz } der gezeigten Kopfkarte, fuer Zeile, Vorlesen und Nachtraege
  let saisonRest = null, formZeichen = null;
  function zeigeLiga(d) {
    const st = Array.isArray(d) ? d[0] : d;
    const el = inhalt.querySelector('.on-liga');
    if (!el) return;
    if (!st || typeof st !== 'object' || !Number.isFinite(Number(st.kronen))) { el.hidden = true; el.closest('.on-held').hidden = true; return; }
    delete el.dataset.laedt; el.disabled = false; el.removeAttribute('aria-hidden');
    const stufe = stufenName(Math.min(17, Math.max(0, Math.trunc(Number(st.stufe)) || 0)));
    const n = Number.isInteger(st.n) && st.n > 0 ? st.n : 30;
    const platz = Number.isInteger(st.platz) && st.platz > 0 ? O('liga.platz', { platz: st.platz, n }) : O('liga.ohneGruppe');
    const elo = serverElo(st);
    held = { elo, stufe, platz };
    el.innerHTML = `<span class="on-liga-schild juwel-medaille" aria-hidden="true">${kronSymbol('liga')}</span>`
      + `<span class="on-held-stand"><span class="on-gross">${elo != null
        ? `<b class="on-gross-wert juwel-zahl zahl">${esc(String(elo))}</b><small class="on-gross-text">${esc(O('held.elo'))}</small>`
        : `<b class="on-gross-wert on-held-wort">${esc(stufe)}</b><small class="on-gross-text">${esc(O('ruhig.deineLiga'))}</small>`}</span>`
      + '<span class="on-held-zeile"></span></span>';
    el.hidden = false;
    zeigeHeld();
  }
  // Zeile, Form und Vorlesetext der Kopfkarte; laeuft nach jeder der drei Antworten (Stand, Season, Partien) erneut
  function zeigeHeld() {
    const el = inhalt.querySelector('.on-liga.on-held-knopf');
    if (!el || !held || weg) return;
    const teile = [held.elo != null ? held.stufe : null, held.platz, saisonRest].filter(Boolean);
    // jeder Teil bricht nur als Ganzes um (css/online.css .on-held-zeile > span)
    el.querySelector('.on-held-zeile').innerHTML = teile.map((x) => `<span>${esc(x)}</span>`).join(' · ');
    const form = inhalt.querySelector('.on-held .on-form');
    const zahl = (z) => (formZeichen || []).filter((x) => x === z).length;
    const formText = formZeichen?.length ? O('form.label', { n: formZeichen.length, s: zahl('s'), nn: zahl('n'), r: zahl('r') }) : '';
    form.hidden = !formZeichen?.length;
    // Flo 21.11.: den Eingang zu "Letzte Partien" nicht gefunden, darum die ganze Flaeche (Pillen samt Titel) als Knopf und
    // darunter ein deutlicher Hinweis "Alle ansehen" mit Pfeil
    form.innerHTML = formZeichen?.length ? `<small aria-hidden="true">${esc(O('form.titel'))}</small><span class="on-form-steine" aria-hidden="true">`
      + formZeichen.map((z) => `<i class="juwel-stein" data-erg="${z}">${esc(O('form.' + z))}</i>`).join('') + '</span>'
      + `<span class="on-form-alle" aria-hidden="true">${esc(O('form.alle'))}${icon('vor')}</span>` : '';
    if (formText) form.setAttribute('aria-label', `${formText}. ${O('form.oeffnen')}`);
    const gross = held.elo != null ? `${O('ruhig.elo')}: ${held.elo}` : `${O('ruhig.deineLiga')}: ${held.stufe}`;
    el.setAttribute('aria-label', [gross, ...teile].filter(Boolean).join(', '));
  }
  // Season-Rest (Paket 2, supabase/saison-schema.sql): "Season endet in 4 Tagen", nur waehrend einer laufenden Season
  async function ladeSaison() {
    const s0 = await holeSaison().catch(() => null);
    if (weg || !s0 || !s0.ende) return;
    const [j, m, t0] = s0.ende.split('-').map(Number);
    const h = new Date();
    const tage = Math.round((Date.UTC(j, m - 1, t0) - Date.UTC(h.getFullYear(), h.getMonth(), h.getDate())) / 864e5);
    if (!(tage >= 0)) return;
    saisonRest = tage === 0 ? O('held.seasonHeute') : tage === 1 ? O('held.seasonMorgen') : O('held.seasonTage', { n: tage });
    zeigeHeld();
  }
  // Form: die letzten fuenf beendeten gewerteten Partien mit gueltigem Ergebnis, aelteste links (s/n/r aus eigener Sicht)
  const ergVon = (r) => (r.ergebnis === '1/2-1/2' ? 'r' : (r.ergebnis === '1-0') === (online.meineFarbe(r) === 'w') ? 's' : 'n');
  let letzte = [];
  function formAus(liste) {
    letzte = (Array.isArray(liste) ? liste : [])
      .filter((r) => r && r.status === 'beendet' && r.gewertet === true && ['1-0', '0-1', '1/2-1/2'].includes(r.ergebnis) && online.meineFarbe(r))
      .slice(0, 5);
    return letzte.map(ergVon).reverse();
  }
  // Letzte Partien (Tipp auf die Form): Ergebnis, Gegner (Tipp: seine Visitenkarte), Datum, "Analysieren" oeffnet die Partie
  // und von dort die vorhandene Analyse (params.analyse). Namen und Karten aus karte_der_partie, nur fuer die eigenen Partien.
  function zeigeLetzte() {
    if (!letzte.length) return;
    const zeilen = letzte.slice();
    const karten = new Array(zeilen.length).fill(null);
    const datum = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(document.documentElement.lang === 'en' ? 'en-GB' : 'de-DE', { day: 'numeric', month: 'short' }); };
    const ort = document.createElement('ol');
    ort.className = 'on-letzte';
    ort.innerHTML = zeilen.map((r, n) => `<li class="on-letzte-zeile"><i class="juwel-stein" data-erg="${ergVon(r)}" aria-hidden="true">${esc(O('form.' + ergVon(r)))}</i>`
      + `<span class="juwel-kopf on-letzte-kopf" style="--k:36px" aria-hidden="true"></span><span class="on-letzte-wer"><button class="on-letzte-name" type="button" data-n="${n}">${esc(O('letzte.gegner'))}</button>`
      + `<span class="on-letzte-datum">${esc(datum(r.aktualisiert_am))}</span></span>`
      + `<button class="knopf juwel-knopf dr" data-ton="ruhig" type="button" data-n="${n}" data-letzte="analyse">${icon('analyse')} ${esc(O('letzte.analyse'))}</button></li>`).join('');
    let ziel = null;
    ort.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-n]');
      if (!b) return;
      const n = Number(b.dataset.n), r = zeilen[n];
      if (!r) return;
      if (b.dataset.letzte === 'analyse') { ziel = r.id; ort.closest('.sheet-karte')?.querySelector('[data-knopf="zu"]')?.click(); return; }
      zeigeGegnerProfil({ karte: karten[n], name: b.textContent });
    });
    zeilen.forEach((r, n) => {
      const f = andere(online.meineFarbe(r));
      karteDerPartie(r.id).then((d) => {
        const roh = d && (f === 'w' ? d.w : d.s);
        const k = roh ? fremdeKarte(roh) : null;
        if (!k || !ort.isConnected) return;
        karten[n] = k;
        const b = ort.querySelector(`.on-letzte-name[data-n="${n}"]`);
        if (b && k.name) { b.textContent = k.name; b.setAttribute('aria-label', profilText('oeffnen', { name: k.name })); }
        // Avatar des Gegners aus karte_der_partie (fremdeKarte: SVG aus Motiv, Grund, Rahmen; nur gepruefte Werte)
        const kopf = ort.querySelectorAll('.on-letzte-kopf')[n];
        if (kopf && k.avatar) { kopf.innerHTML = k.avatar; kopf.dataset.da = ''; }
      }).catch(() => {});
    });
    sheet({ titel: O('letzte.titel'), inhalt: ort, klasse: 'on-letzte-blatt', abbrechen: null,
      knoepfe: [{ text: O('letzte.zu'), wert: null, name: 'zu' }] })
      .then(() => { if (ziel && !weg) app.gehe('online', { partieId: ziel, analyse: true }); });
  }
  // Weltrangliste rechts (nur quer ab 1100 px, nur mit Paket 2 und nur, wenn das Konto in der Liste steht): fuenf Plaetze um
  // den eigenen, der eigene in Gold; der Knopf oeffnet die ganze Weltrangliste. Ohne Antwort bleibt die Karte weg.
  let rangZeilen = [];
  async function zeigeRang() {
    const el = inhalt.querySelector('.on-rang');
    if (!el || !paket2Frei() || !matchMedia('(min-width: 1100px) and (orientation: landscape)').matches) return;
    try {
      const [{ weltLage }, d] = await Promise.all([import('../pakete/liga/welt.js'), online.rpc('weltrang_liste', { grenze: 100 })]);
      const l = weltLage(Array.isArray(d) ? d[0] : d);
      if (weg || !l || l.ich.status !== 'dabei') return;
      const i = l.liste.findIndex((z) => z.ich);
      if (i < 0) return;
      // Podest der ersten drei (2 | 1 | 3, mit Kopf und Metallring), darunter dein Platz mit je einem Nachbarn; stehst du
      // selbst oben, schliessen die Plaetze 4 bis 6 an
      const um = i <= 2 ? l.liste.slice(3, 6) : l.liste.slice(i - 1, i + 2);
      rangZeilen = [...l.liste.slice(0, 3), ...um];
      const name = (z) => (z.ich ? O('rang.du') : z.name);
      const kopf = (z, k) => (z.ich ? `<span class="juwel-kopf" data-ich style="--k:${k}px"${z.rang <= 3 ? ` data-platz="${z.rang}"` : ''}>${floAvatar('w')}</span>`
        // Profilbild nur mit supabase/weltrang-karte-schema.sql (motiv/grund/rahmen; fremderAvatar prueft jeden Wert gegen die
        // festen Listen), sonst Banner mit Schleier und Anfangsbuchstabe
        : typeof z.motiv === 'string'
          ? `<span class="juwel-kopf"${z.rang <= 3 ? ` data-platz="${z.rang}"` : ''} style="--k:${k}px">${fremderAvatar(z)}</span>`
          : `<span class="juwel-kopf mit-banner"${z.rang <= 3 ? ` data-platz="${z.rang}"` : ''} style="--k:${k}px;--banner:url('${bannerUrl(z.banner)}')">${esc((z.name[0] || '?').toUpperCase())}</span>`);
      const label = (z) => ` aria-label="${esc(profilText('oeffnen', { name: name(z) }))}"`;
      const podest = [1, 0, 2].filter((n) => rangZeilen[n]).map((n) => { const z = rangZeilen[n];
        return `<button class="on-podest-platz${z.ich ? ' ich' : ''}" type="button" data-online="rang-profil" data-n="${n}" data-platz="${z.rang}"${label(z)}>`
          + `${kopf(z, n === 0 ? 56 : 46)}<span class="juwel-rang zahl" data-platz="${z.rang}">${z.rang}</span>`
          + `<span class="on-podest-name">${esc(name(z))}</span><b class="zahl">${esc(String(z.elo))}</b></button>`; }).join('');
      el.innerHTML = `<h2 id="on-rang-t">${esc(O('rang.titel'))}</h2><div class="on-podest">${podest}</div><ol class="on-rang-liste">`
        + um.map((z, n) => `<li><button class="on-rang-zeile${z.ich ? ' ich' : ''}" type="button" data-online="rang-profil" data-n="${n + 3}"${label(z)}>`
          + `<span class="on-rang-platz zahl">${esc(String(z.rang))}</span>${kopf(z, 34)}<span class="on-rang-name">${esc(name(z))}</span>`
          + `<b class="zahl">${esc(String(z.elo))}</b></button></li>`).join('')
        + `</ol><button class="knopf juwel-knopf dr" data-ton="ruhig" type="button" data-online="rang">${esc(O('rang.knopf'))}</button>`;
      el.hidden = false;
    } catch (e) { /* ohne Rangliste fehlt die Karte */ }
  }
  // Laeuft fuer das Konto eine Partie (online_meine), wird die Partie-Tuer zur Karte "Laufende Partie fortsetzen" und
  // oeffnet die NEUESTE laufende (Befund 3 vom 11.11.: kein Weg zurueck; Befund 2: zwei laufende zugleich). Solange eine
  // laeuft, gibt es dort keinen Suchknopf, damit keine zweite gewertete Partie entsteht. Der Platz ist derselbe wie fuer
  // Zeile und Suchknopf (kein Springen beim Laden, G-005 AC-06).
  async function pruefeSuche() {
    const laufend = online.meinePartien().then(neuesteLaufende, () => null);
    let liga = true;
    try { const d = await holeStand(); if (weg) return; zeigeLiga(d); } catch (e) { liga = false; }
    const lp = await laufend;
    if (weg) return;
    // T-070: laeuft inzwischen eine Suche, gehoert die Karte ihr (sonst verschwaende sie, und `suche` liefe unsichtbar weiter)
    if (suche) return;
    if (lp) {
      sucheZustand('laufend', O(online.binAmZug(lp) ? 'laufend.du' : 'laufend.gegner'));
      sucheKarte().querySelector('[data-online="fortsetzen"]').dataset.partie = lp.id;
      if (!liga) { const l = inhalt.querySelector('.on-liga[data-laedt]'); if (l) { l.hidden = true; l.closest('.on-held').hidden = true; } }
    } else if (liga) sucheZustand('bereit', O('suche.erklaert'));
    else sucheZustand('bald', O('suche.bald'));
  }
  async function botFuerMich() {
    try { const l = await import('../pakete/lobby/index.js'); return l.passenderBot(l.schaetzeWertung()); } catch (e) { return null; }
  }
  function starteSuche() {
    const k = sucheKarte(); if (!k || suche) return;
    // Ranked hat eine feste Bedenkzeit (RANKED_ZEIT); die Wartezeit nennt der Server, __onlineBotMs nur im Test
    const warteMs = typeof window !== 'undefined' && Number.isFinite(window.__onlineBotMs) ? window.__onlineBotMs : undefined;
    sucheZustand('sucht', O('suche.laeuft'));
    k.querySelector('.on-ki-hinweis').removeAttribute('data-gewertet');
    k.querySelector('[data-online="ki-jetzt"]').focus();
    suche = kronenSuche(RANKED_ZEIT.id, {
      warteMs,
      beiTreffer: (partieId) => { suche = null; if (!weg) { ton('start'); app.gehe('online', { partieId }); } },
      // nach der Wartezeit des Servers (oder Jetzt gegen KI) ein KI-Gegner in passender Staerke, wie in der Lobby (dort steht die Wahl des Bots)
      beiBot: async ({ kiRef }) => {
        suche = null;
        clearInterval(restUhr); restUhr = null;
        if (weg) return;
        const bot = await botFuerMich();
        if (weg) return;
        if (!bot) { sucheZustand('bereit', O('suche.erklaert')); melde(O('fehler')); return; }
        // gewertet mit Beleg und neuem SQL (#213: Vorab-Niederlage, ein offener Beleg): Verlassen zaehlt als Niederlage.
        // Mit altem SQL stimmt der Satz nicht, dort kein Hinweis.
        // die Meldung zeigt starteKiErsatz erst, wenn die Partie wirklich startet (nicht nach dem Verlassen)
        const hinweis = kiRef && lage().vomServer ? O('suche.kiVerlassen') : null;
        import('./ki-ersatz.js').then((m) => m.starteKiErsatz(app, { bot, tempo: tempoWahl(lage), kiRef, weg: () => weg, hinweis })).catch((e) => { console.error(e); sucheZustand('bereit', O('suche.erklaert')); melde(O('fehler')); });
      },
      beiFehler: (e) => { suche = null; sucheZustand('bereit', O('suche.erklaert')); melde(e?.message || O('fehler')); },
    });
    const lage = suche.lage;
    zeigeRest(); restUhr = setInterval(zeigeRest, 250);
  }
  // Uhr der KI-Partie: die Zeit, die der Server nennt (ranked_zeit), sonst die feste der App
  function tempoWahl(lage) {
    const z = /^(\d{1,3})\+(\d{1,2})$/.exec(lage?.().zeit || RANKED_ZEIT.id);
    return { grund: Number(z[1]) * 60, zuschlag: Number(z[2]) };
  }
  function stoppeSuche() {
    if (!suche) return;
    try { suche.stopp(); } catch (e) { /* egal */ }
    suche = null;
    sucheZustand('bereit', O('suche.erklaert'));
  }
  // "Jetzt gegen KI": ab ki_ab_s beendet der Server die Suche mit Beleg (gewertet, weiter in beiBot). Davor wie bisher
  // (Konzept 3 A, ohne Server): Suche beenden und eine Uebungspartie gegen den passenden Bot mit derselben Uhr. Uebung
  // wertet nie (storage.wertet), also keine Kronen und kein Liga-Punkt, wie der Hinweis sagt.
  async function kiJetzt() {
    // laeuft der Wechsel zur KI schon (Uhr oder erster Druck), nichts doppelt starten
    if (!suche || !suche.lage().laeuft) return;
    if (suche.jetztKi()) { clearInterval(restUhr); restUhr = null; return; }
    const tempo = tempoWahl(suche.lage);
    stoppeSuche();
    const bot = await botFuerMich();
    if (weg) return;
    if (!bot) { melde(O('fehler')); return; }
    app.gehe('partie', { botId: bot.id, farbe: Math.random() < 0.5 ? 'w' : 'b', tempo, modus: 'uebung' });
  }
  async function ladeListe() {
    await aktion(() => online.meinePartien({ beendete: true }), liste => {
      formZeichen = formAus(liste);
      zeigeHeld();
      const el = inhalt.querySelector('.on-liste');
      el.innerHTML = liste.length ? liste.map(row => `<button class="knopf on-listeneintrag" type="button" data-partie="${esc(row.id)}"><span>${esc(STATUS[row.status] || O('partie'))} · ${esc(row.code)}</span><span>${row.bedenkzeit_s == null ? O('ohneUhr') : `${Math.round(row.bedenkzeit_s / 60)}+${row.inkrement_s || 0}`}${row.ergebnis ? ' · ' + esc(row.ergebnis) : ''}</span></button>`).join('') : O('keine');
    });
  }
  // Zuege nachspielen und mit dem Server vergleichen. Verglichen werden nur das Brett und die Seite am Zug (am_zug und
  // das Feld im FEN-Text), nicht Rochaderechte, en-passant-Feld und Zaehler: die schreiben chess.js-Fassungen
  // verschieden, und eine ehrliche Partie soll nach einem Update nicht haengen bleiben. Ein illegaler Zug in der Liste
  // beendet das Nachspielen; chess zeigt dann den letzten stimmigen Stand. Wirft nur bei einer fremden Partie.
  function nachspielen(stand) {
    if (!online.meineFarbe(stand)) throw new Error(O('fremd'));
    const c = new Chess();
    let passt = true;
    for (const uci of online.zuegeListe(stand)) {
      try { c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }); } catch (e) { passt = false; break; }
    }
    const [brettServer, seiteServer] = String(stand.fen || '').split(' ');
    if (passt && (c.fen().split(' ')[0] !== brettServer || c.turn() !== stand.am_zug || seiteServer !== stand.am_zug)) passt = false;
    return { chess: c, passt };
  }
  function uebernehme(neu) {
    if (weg || blockiert) return;
    if (p && (neu.id !== p.id || neu.aktualisiert_am < p.aktualisiert_am)) return;
    beobachter?.kenne?.(neu); // R28: nach dem eigenen Zug sofort im kurzen Takt auf die Antwort warten
    let r;
    try { r = nachspielen(neu); } catch (e) {
      blockiert = true; beobachter?.stop();
      melde(e.message);
      sperre(); return;
    }
    const neuerWiderspruch = !r.passt && !widerspruch;
    const alt = p;
    p = neu; chess = r.chess; widerspruch = !r.passt;
    // R26 AC-04: eine wartende Einladung ist noch keine Partie und klingt wie die Lobby (arcade), sonst das gewaehlte Set
    try { klang.setzeOrt(p.status === 'offen' ? 'lobby' : 'spiel'); } catch (e) { /* ohne Klang */ }
    klingt(alt);
    merkeKronen(alt);
    holeGegnerFx();
    if (neuerWiderspruch && p.status === 'laeuft') { melde(O('stellungFehler')); strittigFaellig = true; }
    if (p.status === 'offen') {
      inhalt.innerHTML = `<section class="on-karte on-einladung flaeche"><h3>${esc(O('einladungTitel'))}</h3><p class="on-code zahl">${esc(p.code)}</p>
        <label>${esc(O('link'))}<input class="on-link" readonly value="${esc(online.einladungsLink(p.code))}"></label>
        <button class="knopf primaer" type="button" data-online="teilen">${esc(O('teilen'))}</button><p>${esc(O('gueltig'))}</p><p>${esc(O('warte'))}</p>
        <button class="knopf" type="button" data-online="liste-zurueck">${esc(O('meine'))}</button></section>`;
    } else {
      if (!brett) {
        // Gerippe der Bot-Partie (js/ui/partie.js): Brett ohne Bewertungsbalken, rechts bzw. darunter die Spalte mit den
        // Spielerleisten (Name, Elo oder Liga, Uhr, geschlagene Figuren) und den Knoepfen. Das Symbol der Live-Bewertung
        // eigener Zuege setzt das Brett selbst (zeigeAbzeichen), .on-live nennt das Tageskontingent.
        // R7 (B12): Zugliste und Zugstreifen mit Pfeilen wie dort (.zugbox quer, .zugleiste hoch, css/partie.css). Der
        // Bewertungsbalken fehlt bewusst: gegen einen Menschen waere eine Engine-Bewertung waehrend der Partie Hilfe von
        // aussen (Fairness, gewertet ein Muss); nach dem Ende bewertet "Zur Analyse" jeden Zug.
        s.classList.add('partie', 'online-partie', 'im-spiel', 'ohne-balken');
        s.classList.toggle('mit-uhr', p.bedenkzeit_s != null);
        inhalt.innerHTML = `<div class="inhalt on-spiel">
          <div class="brettzone"><div class="brett-rahmen"><div class="brett on-brett"></div><div class="brett-effekte on-effekte" aria-hidden="true"></div></div></div>
          <div class="seite">
            <div class="spieler gegner on-spieler on-oben" role="group"></div>
            <div class="on-hinweise"><p class="on-angebot" role="alert" hidden></p><p class="on-neuer" hidden></p>
              <p class="on-zug" role="status"><span class="on-zug-text"></span><span class="on-frist" aria-hidden="true" hidden><img class="on-frist-figur" alt="" decoding="sync"><span class="on-frist-zeit zahl"></span><span class="on-frist-balken"><i></i></span></span></p><p class="on-uhr-hinweis"></p><p class="on-live" hidden></p></div>
            <div class="zugbox"><div class="zb-kopf">${pfeil('zug-zurueck', 'icon-knopf zl-zurueck dr')}<span class="zb-titel">${esc(O('zuege'))}</span>${pfeil('zug-vor', 'icon-knopf zl-vor dr')}</div>
              <div class="zugliste" role="region" tabindex="0" aria-label="${esc(O('zuege'))}"></div></div>
            <div class="zugleiste" role="region" tabindex="0" aria-label="${esc(O('zuege'))}"></div>
            <section class="on-ergebnis on-karte flaeche" hidden></section>
            <div class="spieler ich on-spieler on-unten" role="group"></div>
            <div class="spielknoepfe aktionen on-aktionen"></div>
          </div></div>`;
        spielKopf();
        bauBrett();
        uhrTimer = setInterval(tick, 100);
        beobachteLayout();
        introUhr = setTimeout(intro, 1500);
      }
      zeichne();
      pruefeNeuere();
      starteLive();
      if (p.status === 'beendet') { beobachter?.stop(); clearInterval(uhrTimer); live?.stop(); zeigeLiveHinweis(); }
    }
    sperre();
    meldeStrittigVonSelbst();
    // R28: ist jetzt der eigene Zug dran, laeuft der erste Vorzug; erst nach dem laufenden Ereignis (aktion setzt im
    // finally die Stellung noch einmal aus dem Serverstand), damit der Zug nicht zwischen Ziehen und Senden verloren geht
    if (vorzuege.length) queueMicrotask(fuehreVorzugAus);
  }
  // Brett mit dem eigenen Figurensatz (figurenPfad(e) wie alle anderen Ansichten; Befund 4 vom 11.11.: ohne
  // Einstellungen). Aendert sich der Satz waehrend der Partie (Erfinder-Status kommt erst nach dem Aufbau vom Server,
  // js/app.js pruefeSonderstuecke, oder Wahl in den Einstellungen), wird das Brett mit der Stellung neu gebaut.
  const skinPfad = (e = app.einstellungen()) => new URL(figurenPfad(e), WURZEL).href;
  // R26 Effekte vom Gegner (js/gegner-effekte.js): seine Figuren in seinem Satz, wenn der Server ihn belegt (sonst der
  // Standard); ohne Antwort des Servers oder mit Schalter aus alles im eigenen Satz wie bisher
  let gegnerFx = null, gegnerFxFuer = null;
  const fremdAn = (e = app.einstellungen()) => gegnerEffekteAn(e) && !!gegnerFx;
  const fremdePfade = (e) => {
    if (!fremdAn(e)) return null;
    const ich = online.meineFarbe(p), er = andere(ich);
    return { [ich]: skinPfad(e), [er]: new URL(satzPfad(gegnerFx[er]?.figuren) || satzPfad('cburnett'), WURZEL).href };
  };
  // die Bilder je Farbe, die das Brett zeigen wuerde: neu gebaut wird nur, wenn sich eines aendert (ein Neubau mitten im
  // Tipp liesse den Zug ins Leere gehen)
  const brettStil = (e) => { const je = fremdePfade(e) || {}, eigen = skinPfad(e); return (je.w || eigen) + '|' + (je.b || eigen); };
  let gebautMit = null;
  // Kaltreview ad (21.11.): kein Neubau, nur die Bilder tauschen, sonst verliert ein laufender Tipp seine Auswahl
  function tauscheSaetze(e) {
    const stil = brettStil(e);
    if (stil === gebautMit) return;
    gebautMit = stil;
    brett.setzeFigurenPfade(skinPfad(e), fremdePfade(e));
  }
  function holeGegnerFx() {
    if (!p || p.status === 'offen' || !p.weiss || !p.schwarz || gegnerFxFuer === p.id) return;
    const id = gegnerFxFuer = p.id;
    gegnerFx = null;
    meldeEffekte(app.einstellungen());
    // zweimal: meldet der Gegner seine Wahl erst beim Oeffnen derselben Partie, steht sie beim zweiten Mal da
    const frage = () => effekteDerPartie(id).then((fx) => {
      if (weg || !p || p.id !== id || !fx) return;
      gegnerFx = fx;
      if (brett && !blockiert) tauscheSaetze(app.einstellungen());
    });
    frage().then(() => { if (!weg && p && p.id === id && p.status === 'laeuft') setTimeout(() => { if (!weg) frage(); }, 6000); });
  }
  function zugFx(m) {
    if (!m || !brett) return;
    const e = app.einstellungen();
    const id = m.color === online.meineFarbe(p) ? eigenerZugEffekt(e) : (fremdAn(e) ? gegnerFx[m.color]?.zug : null);
    if (id && id !== 'aus') spieleZugEffekt({ ebene: inhalt.querySelector('.on-effekte'), brett, id, von: m.from, nach: m.to }).catch(() => {});
  }
  function bauBrett() {
    const e = app.einstellungen();
    brett?.zerstoere();
    gebautMit = brettStil(e);
    brett = new Brett(inhalt.querySelector('.on-brett'), { beiZug, beiLeer: () => { if (vorzuege.length) loescheVorzuege(); }, figurenPfad: skinPfad(e), figurenPfadJe: fremdePfade(e),
      koordinaten: e.koordinaten !== false, koordLage: e.koordLage, autoDame: e.autoDame !== false, turmRochade: e.turmRochade === true,
      steuerung: e.steuerung, pfeile: e.pfeile !== false });
    brett.setzeAusrichtung(online.meineFarbe(p)); brett.setzeDauer(300);
  }
  // R7 (B12): Kopf wie in der Bot-Partie: der Gegner als Titel, darunter die eigene Farbe, rechts die Brettwahl (quer;
  // css/partie.css blendet sie auf dem Handy aus). Der Kopf bleibt derselbe Knoten (verbindeKopf haengt am Screen).
  function spielKopf() {
    const kopfEl = s.querySelector('.haupt-kopf');
    if (!kopfEl || kopfEl.dataset.spiel) return;
    kopfEl.dataset.spiel = '';
    kopfEl.classList.remove('mit-seite', 'mit-marke');
    kopfEl.querySelector('.kopf-seite')?.remove();
    kopfEl.querySelector('.marke-zeichen')?.remove();
    const unter = document.createElement('div');
    unter.className = 'unter logo-unter';
    unter.textContent = t('partie.kopf.duSpielst') + (online.meineFarbe(p) === 'w' ? O('weiss') : O('schwarz'));
    kopfEl.querySelector('.marke-text').append(unter);
    const gewaehlt = app.einstellungen().brett;
    // hinter die (leeren) Chips: die schieben mit margin-left: auto alles Folgende an den rechten Rand
    kopfEl.querySelector('.kopf-chips').insertAdjacentHTML('afterend', `<div class="brettwahl" role="radiogroup" aria-label="${esc(t('partie.kopf.brettfarbe'))}">`
      + BRETTER.map(([id, h, d]) => `<button class="dr" type="button" role="radio" data-brett="${id}" aria-label="${esc(t('partie.kopf.brett', { name: t('partie.brett.' + id) }))}" `
        + `aria-checked="${gewaehlt === id}"><i style="--h:${h};--d:${d}"><b></b><b></b><b></b><b></b></i></button>`).join('') + '</div>');
    zeigeKopfTitel();
  }
  function zeigeKopfTitel() {
    const el = s.querySelector('.haupt-kopf[data-spiel] .marke-titel');
    const name = p && spielerDaten(andere(online.meineFarbe(p))).name;
    if (el && name && el.textContent !== name) el.textContent = name;
  }
  // ---------- Zuege ansehen (wie zeigeAnsicht in js/ui/partie.js): ansehen.ply = Stellung nach diesem Halbzug (-1 =
  // Ausgangsstellung), null = die Partie selbst. Ein eigenes kleineres Brett liegt ueber dem Spielbrett, das selbst
  // unberuehrt bleibt; "Zur Partie", ein Tipp aufs Ansichts-Brett, Escape oder ein neuer Zug fuehren zur Partie zurueck.
  const ansehen = { ply: null, el: null, brett: null, n: 0 };
  const pfeil = (a, klasse) => `<button class="${klasse}" type="button" data-online="${a}" aria-label="${esc(t(a === 'zug-vor' ? 'partie.zuege.vor' : 'partie.zuege.zurueck'))}">${icon(a === 'zug-vor' ? 'vor' : 'zurueck')}</button>`;
  const zugLabel = (i) => `${Math.floor(i / 2) + 1}${i % 2 === 0 ? '.' : '…'} ${sanAnzeige(chess.history()[i])}`;
  function zeichneZugliste() {
    const san = chess.history(), eigen = online.meineFarbe(p), letzter = san.length - 1;
    const zelle = (i) => (i == null ? '<span class="z leer"></span>'
      : `<span class="z${i === letzter ? ' aktuell' : ''}${(i % 2 === 0 ? 'w' : 'b') === eigen ? ' du' : ''}${i === ansehen.ply ? ' angesehen' : ''}" data-ply="${i}">${esc(sanAnzeige(san[i]))}</span>`);
    let liste = '', leiste = '';
    for (let i = 0; i < san.length; i += 2) liste += `<span class="nr">${i / 2 + 1}.</span>${zelle(i)}${zelle(i + 1 < san.length ? i + 1 : null)}`;
    for (let i = 0; i < san.length; i++) leiste += `${i % 2 === 0 ? `<span class="nr">${i / 2 + 1}.</span>` : ''}${zelle(i)}`;
    const leer = `<span class="zugliste-leer">${esc(t('partie.zuege.leer'))}</span>`;
    const listeEl = inhalt.querySelector('.zugliste'), leisteEl = inhalt.querySelector('.zugleiste');
    const html = liste || leer;
    if (listeEl._html !== html) { listeEl._html = html; listeEl.innerHTML = html; listeEl.scrollTop = listeEl.scrollHeight; }
    const streifen = pfeil('zug-zurueck', 'zl-pfeil zl-zurueck dr') + `<span class="zl-zuege">${leiste || leer}</span>` + pfeil('zug-vor', 'zl-pfeil zl-vor dr');
    if (leisteEl._html !== streifen) { leisteEl._html = streifen; leisteEl.innerHTML = streifen; leisteEl.scrollLeft = leisteEl.scrollWidth; }
    zeigeZugNav();
  }
  function zeigeZugNav() {
    if (!chess || !inhalt.querySelector('.zugbox')) return;
    const n = chess.history().length;
    for (const x of inhalt.querySelectorAll('.zugliste .z[data-ply], .zugleiste .z[data-ply]')) x.classList.toggle('angesehen', Number(x.dataset.ply) === ansehen.ply);
    for (const b of inhalt.querySelectorAll('.zugbox .zl-zurueck, .zugleiste .zl-zurueck, .spielknoepfe .zl-zurueck')) b.disabled = !n || ansehen.ply === -1;
    for (const b of inhalt.querySelectorAll('.zugbox .zl-vor, .zugleiste .zl-vor, .spielknoepfe .zl-vor')) b.disabled = ansehen.ply == null;
    const an = inhalt.querySelector('.zugleiste .z.angesehen');
    if (an) { const zl = an.closest('.zugleiste'); zl.scrollLeft = an.offsetLeft - zl.clientWidth / 2 + an.offsetWidth / 2; }
    if (ansehen.el) ansehen.el.querySelector('[data-online="zug-zurueck"]').disabled = ansehen.ply === -1;
  }
  function zeigeAnsicht(ply) {
    const verlauf = chess ? chess.history({ verbose: true }) : [];
    const n = verlauf.length;
    if (weg || !brett || !n || !Number.isFinite(ply)) return;
    const z = Math.max(-1, Math.min(Math.trunc(ply), n - 1));
    if (z === n - 1) {
      // vor auf den letzten Zug: er laeuft noch einmal sichtbar, dann geht es zur Partie (wie in der Bot-Partie)
      if (!ansehen.el || ansehen.ply !== n - 2) { schliesseAnsicht(); return; }
      const el = ansehen.el, m = verlauf[z];
      ansehen.ply = z;
      ansehen.brett.setzeStellung(m.after, { animieren: true, letzterZug: [m.from, m.to], schach: /[+#]$/.test(m.san) ? true : null });
      el.querySelector('.za-schild').textContent = zugLabel(z);
      el.querySelector('[data-online="zug-vor"]').disabled = true;
      setTimeout(() => { if (ansehen.el === el && ansehen.ply === z) schliesseAnsicht(); }, 1100);
      return;
    }
    if (!ansehen.el) {
      const e = app.einstellungen();
      const el = document.createElement('div');
      el.className = 'zug-ansicht';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-label', t('partie.zuege.blaettern'));
      el.innerHTML = '<div class="za-brett"><div class="brett"></div></div><div class="za-steuer">'
        + pfeil('zug-zurueck', 'icon-knopf dr') + '<span class="za-schild zahl" aria-live="polite"></span>' + pfeil('zug-vor', 'icon-knopf dr')
        + `<button class="knopf primaer za-live dr" type="button" data-online="zug-live">${icon('play')} ${esc(t('partie.zuege.zurPartie'))}</button></div>`;
      inhalt.querySelector('.brett-rahmen').append(el);
      ansehen.el = el; ansehen.n = n;
      ansehen.brett = new Brett(el.querySelector('.brett'), { ausrichtung: brett.ausrichtung, figurenPfad: skinPfad(e),
        koordinaten: e.koordinaten !== false, koordLage: e.koordLage, pfeile: false });
      ansehen.brett.setzeDauer(300);
      // ein Tipp aufs Ansichts-Brett: zurueck zur Partie (nie ein Zug auf einer alten Stellung)
      el.querySelector('.za-brett').addEventListener('pointerdown', (ev) => { ev.preventDefault(); schliesseAnsicht(); });
    }
    const vorher = ansehen.ply;
    ansehen.ply = z;
    const m = z >= 0 ? verlauf[z] : null;
    const schritt = vorher != null ? Math.abs(vorher - z) === 1 : z === n - 2;
    ansehen.brett.setzeStellung(m ? m.after : verlauf[0].before, { animieren: schritt, letzterZug: m ? [m.from, m.to] : null, schach: m && /[+#]$/.test(m.san) ? true : null });
    const schild = ansehen.el.querySelector('.za-schild');
    schild.textContent = m ? zugLabel(z) : t('partie.zuege.start');
    schild.setAttribute('aria-label', m ? t('partie.zuege.ansicht', { zug: zugLabel(z) }) : t('partie.zuege.start'));
    zeigeZugNav();
  }
  function schliesseAnsicht() {
    if (!ansehen.el) return;
    try { ansehen.brett.zerstoere(); } catch (e) { /* egal */ }
    ansehen.el.remove();
    ansehen.el = null; ansehen.brett = null; ansehen.ply = null;
    zeigeZugNav();
  }
  // Tastatur (Rechner, iPad mit Tastatur): Pfeil links blaettert zurueck, rechts vor, Escape zur Partie
  const zugTasten = (e) => {
    if (weg || e.altKey || e.ctrlKey || e.metaKey || !s.isConnected || !brett || !chess) return;
    if (e.target && e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]:not(.zug-ansicht)')) return;
    if (document.querySelector('.ergebnis-overlay:not([hidden])')) return;
    const n = chess.history().length;
    if (e.key === 'ArrowLeft' && n) { e.preventDefault(); zeigeAnsicht((ansehen.ply ?? n - 1) - 1); }
    else if (e.key === 'ArrowRight' && ansehen.ply != null) { e.preventDefault(); zeigeAnsicht(ansehen.ply + 1); }
    else if (e.key === 'Escape' && ansehen.ply != null) { e.preventDefault(); schliesseAnsicht(); }
  };
  document.addEventListener('keydown', zugTasten);
  // Ein Zug in der Liste oder im Streifen: diese Stellung ansehen; der letzte Zug zeigt die Stellung davor und laeuft
  // dann noch einmal (wie in der Bot-Partie)
  s.addEventListener('click', (e) => {
    const zelle = e.target.closest && e.target.closest('.zugliste .z[data-ply], .zugleiste .z[data-ply]');
    if (!zelle || !s.contains(zelle) || weg || !chess) return;
    const ply = Number(zelle.dataset.ply), n = chess.history().length;
    if (ply === n - 1) {
      zeigeAnsicht(ply - 1);
      const el = ansehen.el;
      setTimeout(() => { if (el && ansehen.el === el && ansehen.ply === ply - 1) zeigeAnsicht(ply); }, 450);
    } else zeigeAnsicht(ply);
  });
  // Live-Bewertung eigener Zuege (js/pakete/online/live-eigene.js, Flo 11.11.2026): nach dem eigenen Zug das Symbol am
  // Zielfeld wie in der Bot-Partie, kein Balken, kein bester Zug, nichts zum Gegner. Gewertet fragt das Modul das
  // Tageskontingent beim Start und bucht erst beim ersten eigenen Zug; Freundespartien ohne Kontingent.
  function starteLive() {
    if (!p || p.status !== 'laeuft' || widerspruch || liveFuer === p.id) return;
    liveFuer = p.id;
    const id = p.id;
    const test = app.test && typeof window.__onlineLiveEngine === 'function' ? { engine: window.__onlineLiveEngine } : {};
    import('../pakete/online/live-eigene.js')
      .then(({ erstelle }) => erstelle({ modus: p.gewertet ? 'ranked' : 'freund', partieId: id, meineFarbe: online.meineFarbe(p), app, ...test }))
      .then((l) => { if (weg || !p || p.id !== id) { l.stop(); return; } live = l; zeigeLiveHinweis(); })
      .catch(() => { /* ohne Modul keine Live-Bewertung, die Partie laeuft weiter */ });
  }
  // Hinweis nur ohne Premium: "heute noch 1 frei" vor dem ersten Zug, danach "diese Partie ist deine freie",
  // aufgebraucht "morgen wieder". rest 0 bei freiem Stand heisst: diese Partie ist heute schon gebucht (Neuladen).
  function zeigeLiveHinweis() {
    const el = inhalt.querySelector('.on-live');
    if (!el) return;
    const k = live && live.kontingent;
    const text = !k || k.unbegrenzt || !p || p.status !== 'laeuft' ? ''
      : live.grund === 'kontingent' ? O('live.genutzt')
        : !live.an ? '' : k.gebucht || k.rest === 0 ? O('live.diese') : k.rest != null ? O('live.frei', { n: k.rest }) : '';
    el.textContent = text;
    el.hidden = !text;
  }
  function bewerteLive(fenVorher, m) {
    if (!live || !live.an || app.einstellungen().liveBewertung === false) return;
    const id = p.id, n = chess.history().length;
    // das Symbol nur, wenn der Zug noch steht: lehnt der Server ihn ab, ist er bis zur Antwort der Engine zurueckgenommen
    const steht = () => chess.history().length >= n && chess.history({ verbose: true })[n - 1]?.lan === m.lan;
    live.bewerteEigenenZug(fenVorher, m.lan)
      .then((erg) => { if (!weg && brett && p && p.id === id && erg && erg.klasse && steht()) brett.zeigeAbzeichen(m.to, erg.klasse); })
      .catch(() => { /* aus, abgebrochen oder Engine-Fehler: dann eben ohne Symbol */ })
      .finally(() => { if (!weg) zeigeLiveHinweis(); });
  }
  function beiEinstellungen(ev) {
    if (weg) return;
    const e = ev?.detail || app.einstellungen();
    for (const b of s.querySelectorAll('.brettwahl button[data-brett]')) b.setAttribute('aria-checked', String(b.dataset.brett === e.brett));
    if (!brett || blockiert) return;
    tauscheSaetze(e);
  }
  window.addEventListener('schach:einstellungen', beiEinstellungen);
  window.addEventListener('online', netzStand); window.addEventListener('offline', netzStand);
  // Handy hoch: Brett von Rand zu Rand, ein Vielfaches von 8; passt die Spalte bis zu den Knoepfen nicht, wird es
  // kleiner, nie unter BRETT_MIN (wie layout() in js/ui/partie.js, dort ausserdem Coach und Zugstreifen)
  function layout() {
    const spiel = inhalt.querySelector('.on-spiel');
    if (weg || !spiel || !s.isConnected) return;
    const handy = !!(handyMq && handyMq.matches);
    s.classList.toggle('handy', handy);
    s.classList.remove('eng');
    // R8 (L3): Zugstreifen wie in der Bot-Partie (js/ui/partie.js STREIFEN_AB): ab 760 px Hoehe ueber den Knoepfen, darunter
    // entfaellt er und die Pfeile stehen in der Knopfreihe (css/partie.css .streifen-unten, css/online.css)
    s.classList.toggle('streifen-unten', handy && s.clientHeight < STREIFEN_AB);
    if (!handy) { spiel.style.removeProperty('--brett'); spiel.style.removeProperty('--spalte'); return; }
    const rahmen = spiel.querySelector('.brett-rahmen');
    const rs = getComputedStyle(rahmen);
    const sockelX = (parseFloat(rs.paddingLeft) || 0) + (parseFloat(rs.paddingRight) || 0);
    const sockelY = (parseFloat(rs.paddingTop) || 0) + (parseFloat(rs.paddingBottom) || 0);
    const breit = Math.floor((spiel.clientWidth - sockelX) / 8) * 8;
    const setze = (g) => { spiel.style.setProperty('--brett', g + 'px'); spiel.style.setProperty('--spalte', (g + sockelX) + 'px'); };
    // unterstes Element, das sichtbar bleiben soll: die Knoepfe, nach dem Ende die Ergebniskarte
    // R7 (B3): nach dem Ende das unterste von eigener Leiste und Ergebniskarte (hoch steht die Karte unter der Leiste)
    const knoepfe = spiel.querySelector('.spielknoepfe');
    const erg = spiel.querySelector('.on-ergebnis');
    const ziele = knoepfe.childElementCount ? [knoepfe] : [spiel.querySelector('.on-unten'), ...(erg && !erg.hidden ? [erg] : [])];
    const untenVon = (el) => { let y = el.offsetHeight, x = el; while (x && x !== spiel) { y += x.offsetTop; x = x.offsetParent; } return y; };
    const unten = () => Math.max(...ziele.map(untenVon));
    const passt = () => unten() + 4 <= spiel.clientHeight + 0.5;
    setze(breit);
    if (!passt()) s.classList.add('eng');
    if (!passt()) {
      const rest = unten() + 4 - rahmen.offsetHeight;
      setze(Math.max(BRETT_MIN, Math.min(breit, Math.floor((spiel.clientHeight - rest - sockelY) / 8) * 8)));
    }
  }
  function beobachteLayout() {
    if (typeof ResizeObserver !== 'function' || layoutRo) { layout(); return; }
    layoutRo = new ResizeObserver(() => {
      if (layoutBild || weg) return;
      layoutBild = requestAnimationFrame(() => { layoutBild = 0; layout(); });
    });
    layoutRo.observe(s);
    for (const k of inhalt.querySelector('.seite').children) layoutRo.observe(k);
    layout();
  }
  // Gegner fuer Leiste und Intro: Name und Liga aus der Visitenkarte (karte_der_partie), Elo nur, wenn der Server sie
  // mitschickt (Feld elo, heute noch nicht); sonst Liga, sonst die Farbe
  function spielerDaten(f) {
    const eigen = online.meineFarbe(p);
    const roh = kartenDaten && (f === 'w' ? kartenDaten.w : kartenDaten.s);
    const k = roh ? fremdeKarte(roh) : null;
    // Sondertitel (supabase/karte-sondertitel-schema.sql, nur mit Besitz im Server): die Sammlung kennt sie nur fuer
    // das eigene Konto, deshalb hier benannt
    const pionier = k && !k.titel && typeof roh.titel === 'string' ? /^pionier-(\d{3})$/.exec(roh.titel) : null;
    if (k && !k.titel && roh.titel === 'erfinder') k.titel = { name: O('titel.erfinder') };
    else if (pionier && Number(pionier[1]) >= 1 && Number(pionier[1]) <= 100) k.titel = { name: O('titel.pionier', { n: Number(pionier[1]) }) };
    const name = k && roh.name ? k.name : f === eigen ? profil?.benutzername || O('ich') : p.gewertet ? O('gegnerName') : O('freund');
    const elo = roh && Number.isInteger(roh.elo) && roh.elo >= 100 && roh.elo <= 4000 ? roh.elo : null;
    const liga = k && Number.isInteger(k.kronenStufe) ? stufenName(k.kronenStufe) : '';
    // echter Benutzername (nicht "Ich"/"Freund"): nur der kann den gruenen Haken tragen
    const echt = !!(k && roh.name) || (f === eigen && !!profil?.benutzername);
    return { k, name, elo, liga, echt };
  }
  // Duell-Intro vor gewerteten Partien (Flo 11.11.: "Intro wie bei den Bots", Gegnername, Elo, Liga): einmal je Partie,
  // nur vor dem 2. Halbzug, sobald die Visitenkarten da sind (oder nach 1,5 s ohne sie). R19 (15.11., Flo gegen Opa:
  // "bei ihm kam das Intro nicht"): ohne Vergleich mit der Geraeteuhr, eine falsch gehende Uhr nahm es einer Seite weg.
  // Das Intro ist Schmuck: es sperrt nichts (sperre() fragt es nicht)
  function intro() {
    clearTimeout(introUhr); introUhr = null;
    if (introGelaufen || weg || !brett || !p || p.gewertet !== true || p.status !== 'laeuft' || blockiert) return;
    introGelaufen = true;
    if (online.zuegeListe(p).length >= 2) return;
    let gesehen = [];
    try { gesehen = JSON.parse(sessionStorage.getItem(INTRO_SCHLUESSEL) || '[]'); } catch (e) { gesehen = []; }
    if (!Array.isArray(gesehen)) gesehen = [];
    if (gesehen.includes(p.id)) return;
    try { sessionStorage.setItem(INTRO_SCHLUESSEL, JSON.stringify([...gesehen, p.id].slice(-20))); } catch (e) { /* nur Komfort */ }
    const eigen = online.meineFarbe(p);
    const g = spielerDaten(andere(eigen));
    const avatar = g.k?.avatar ? 'data:image/svg+xml,' + encodeURIComponent(g.k.avatar) : '';
    // R15: Titel, Erfolge und Banner des Gegners auch im Intro (nur mit Visitenkarte vom Server)
    const karte = g.k ? { titel: g.k.titel, orden: g.k.orden, bannerBild: bannerUrl(g.k.banner) } : null;
    try {
      spieleDuell({ bot: { id: 'online', name: g.name, elo: g.elo, liga: g.liga, avatar, karte }, farbe: eigen, anlass: 'liga',
        einstellung: app.einstellungen().duellIntro || 'besondere', bildschirm: 'online' });
    } catch (e) { /* das Intro ist Schmuck, nie ein Grund fuer einen Fehler */ }
  }
  // Befund 2 (11.11.): Gibt es fuer das Konto eine NEUERE laufende Partie als die gezeigte, nennt ein Streifen sie und
  // fuehrt hin. Einmal je geoeffneter Partie, eine Anfrage (online_meine).
  function pruefeNeuere() {
    if (!p || p.status !== 'laeuft' || neuerGeprueft === p.id) return;
    neuerGeprueft = p.id;
    const id = p.id;
    online.meinePartien().then((liste) => {
      const neu = neuesteLaufende(liste);
      const el = inhalt.querySelector('.on-neuer');
      if (weg || !el || !p || p.id !== id || !neu || neu.id === id || zeitVon(neu) <= zeitVon(p)) return;
      el.innerHTML = `<span>${esc(O('neuere'))}</span><button class="knopf primaer dr" type="button" data-partie="${esc(neu.id)}">${esc(O('neuereKnopf'))}</button>`;
      el.hidden = false;
    }).catch(() => { /* ohne Antwort bleibt der Streifen weg */ });
  }
  // Klaenge wie in der Partie (js/sounds.js zugKlangName): der Zug des Freundes, sobald er ankommt (der eigene klang
  // schon in beiZug); das Ende einmal beim Wechsel von "laeuft" auf "beendet" (Sieg, Niederlage, Remis; strittig und
  // nicht nachvollziehbar bleiben still); Start, wenn der Freund der offenen Einladung beitritt. Beim Laden still.
  function klingt(alt) {
    const n = chess.history().length;
    if (!alt || alt.id !== p.id) { gehoert = n; return; }
    if (alt.status === 'offen' && p.status === 'laeuft') ton('start');
    if (n > gehoert && p.status === 'laeuft' && !widerspruch) {
      const verlauf = chess.history({ verbose: true }), m = verlauf[verlauf.length - 1];
      ton(zugKlangName(m, chess.inCheck()));
      zugFx(m);
    }
    gehoert = n;
    if (alt.status !== 'laeuft' || p.status !== 'beendet' || !p.ergebnis || p.grund === 'strittig') return;
    if (widerspruch || !endePasst(p, chess)) return;
    try { klang.ende(p.ergebnis === '1/2-1/2' ? null : (p.ergebnis === '1-0' ? 'w' : 'b') === online.meineFarbe(p)); } catch (e) { /* still */ }
    const sieger = p.ergebnis === '1-0' ? 'w' : 'b';
    if (p.grund === 'matt' && sieger === online.meineFarbe(p)) finisher();
    // R26: gewinnt der Gegner per Matt, sein Finisher (vom Server belegt), nie bei Schalter aus oder weniger Bewegung
    else if (p.grund === 'matt' && fremdAn() && gegnerFx[sieger]?.finisher && gegnerFx[sieger].finisher !== 'aus') finisher(gegnerFx[sieger].finisher);
  }
  // Matt-Finisher wie in der Bot-Partie (Ort partie:matt, js/pakete/finisher): nur beim eigenen Matt, das diese Ansicht
  // selbst erlebt hat (klingt oben); ein Tipp oder das Verlassen beendet ihn. Die Buehne ist nur, was der Finisher braucht:
  // das Feld in Brett-Lage (wie partie.js spalteZeile) und die Effekt-Ebene ueber den Feldern (Kaltreview 6b 17.11.2026).
  // feier: solange ein Finisher laeuft, wartet das Ergebnisblatt darauf (baueBlatt), hoechstens BRETT_FEIER.dauerMs, ein Tipp
  // beendet beides sofort; wie die Bot-Partie (partie.js: erst der Finisher, dann das Blatt; Kaltreview de 17.11.2026)
  let mattOrt = null, feier = null;
  function finisher(fremd) {
    const effekte = inhalt.querySelector('.on-effekte');
    if (!effekte || !brett) return;
    if (fremd !== undefined && (!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || tempo() === 0)) return;
    const verbose = chess.history({ verbose: true }), m = verbose[verbose.length - 1] || null;
    let koenigFeld = null;
    for (const reihe of chess.board()) for (const f of reihe) if (f && f.type === 'k' && f.color === chess.turn()) koenigFeld = f.square;
    const buehne = Object.freeze({ el: s, effekte, brett, feld(f) {
      if (typeof f !== 'string' || !/^[a-h][1-8]$/.test(f)) return null;
      const d = f.charCodeAt(0) - 97, r = Number(f[1]) - 1;
      return brett.ausrichtung === 'w' ? { x: d, y: 7 - r } : { x: 7 - d, y: r };
    } });
    const ctrl = new AbortController();
    s.addEventListener('pointerdown', () => ctrl.abort(), { capture: true, once: true });
    const reduziert = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || tempo() === 0;
    mattOrt?.verlasse();
    mattOrt = fuelle('partie:matt', null, {
      app, buehne, partieId: p.id, ergebnis: 'sieg', gewinner: 'flo', koenigFeld, fen: chess.fen(), reduziert,
      letzterZug: m ? Object.freeze({ von: m.from, nach: m.to, san: m.san, figur: m.color + m.piece.toUpperCase() }) : null,
      signal: ctrl.signal, dauerMs: BRETT_FEIER.dauerMs, kurzMs: BRETT_FEIER.kurzMs, ...(fremd === undefined ? {} : { fremd }),
    });
    const tipp = new Promise((r) => ctrl.signal.addEventListener('abort', r, { once: true }));
    feier = mattOrt.wartend > 0 ? Promise.race([mattOrt.fertig, tipp, new Promise((r) => setTimeout(r, BRETT_FEIER.dauerMs))]) : null;
  }
  // R7: Kronen-Aenderung einer gewerteten Partie, nur aus dem, was der Server schon liefert. Die Online-Antworten tragen
  // keine Kronen; die Buchung macht der Trigger am Partie-Ende (supabase/kronen-schema.sql). Darum: kronen_mein_stand
  // waehrend die Partie laeuft und noch einmal nach dem Ende, das diese Ansicht selbst gesehen hat; die Differenz ist die
  // Aenderung. Andere Woche, unbrauchbare Antwort oder ein schon beendet geoeffnetes Spiel: keine Kronen-Zeile.
  const kronenStand = d => { const st = Array.isArray(d) ? d[0] : d;
    return st && Number.isFinite(Number(st.kronen)) ? { kronen: Math.trunc(Number(st.kronen)), woche: String(st.woche ?? '') } : null; };
  function merkeKronen(alt) {
    if (!p.gewertet) return;
    const id = p.id;
    if (p.status === 'laeuft' && kronenFuer !== id) {
      kronenFuer = id;
      holeStand().then(d => { const st = kronenStand(d); if (st && !weg && p && p.id === id && p.status === 'laeuft') kronenVor = { id, ...st }; }).catch(() => {});
    }
    if (alt && alt.id === id && alt.status === 'laeuft' && p.status === 'beendet') {
      holeStand().then(d => { const st = kronenStand(d); if (st && !weg && p && p.id === id) { kronenNach = { id, ...st }; zeigeKronen(); } }).catch(() => {});
    }
  }
  function zeigeKronen() {
    const el = s.querySelector('.on-erg-kronen');
    if (!el || !p) return;
    const ok = p.gewertet && kronenVor?.id === p.id && kronenNach?.id === p.id && kronenVor.woche === kronenNach.woche;
    el.hidden = !ok;
    if (!ok) { el.textContent = ''; return; }
    const d = kronenNach.kronen - kronenVor.kronen;
    const aenderung = d > 0 ? '+' + d : d < 0 ? '−' + Math.abs(d) : '±0';
    // nur die Aenderung dieser Partie (R19 online ruhig), der Wochenstand steht in der Lobby hinter "Mehr"
    el.innerHTML = `${icon('krone')}<b class="zahl">${aenderung}</b><span>${esc(O('ruhig.kronen'))}</span>`;
  }
  // R7 (Gleichheits-Liste R6, B2): das Ende zeigt das Ergebnisblatt der Bot-Partie (css/ergebnis.css, Aufbau wie baueOverlay
  // in js/ui/partie.js): Kopfwort, Grund, bei gewerteten Partien die Kronen-Aenderung, "Zur Analyse", Revanche und Meine
  // Partien. Das Auge zeigt das Brett, "Ergebnis" in der Spalte holt das Blatt zurueck. Ohne Spruch (die Bot-Partie hat dort
  // den Satz des Bots, online gibt es keinen).
  const ANALYSE_GRUND = { matt: 'matt', aufgabe: 'aufgabe', patt: 'patt', material: 'material', wiederholung: 'wiederholung',
    '50-zuege': '50-zuege', zeit: 'zeit', remis: 'vereinbart' };
  // zaehlt: das Ende hat ein Ergebnis, das am Brett stimmt (wie endeTexte); nur dann Sieg/Niederlage/Remis
  const endeZaehlt = () => !!p && !!p.ergebnis && p.grund !== 'strittig' && !widerspruch && endePasst(p, chess);
  // W-online-analyse (Flo 13.11.: "beim 1 gegen 1 fehlt die Analyse"): Analyse bei JEDEM Ende mit mindestens einem Zug,
  // auch abgebrochen, strittig oder nicht nachvollziehbar. chess ist immer der nachgespielte, legale Stand (bei einem
  // Widerspruch der letzte stimmige), die Analyse rechnet also nur echte Zuege. Waehrend die Partie laeuft: nie. Nur fuer
  // die beiden Spieler (abgemeldet oder fremde Partie: keine eigene Farbe, nichts ablegen).
  const kannAnalyse = () => !!p && p.status === 'beendet' && chess.history().length > 0 && !!online.meineFarbe(p);
  const blattEl = () => s.querySelector(':scope > .ergebnis-overlay');
  function zeigeBlatt(an) {
    const o = blattEl(); if (!o) return;
    delete o.dataset.feier;
    o.hidden = !an;
    for (const e of s.children) if (e !== o) e.inert = an;
    if (an) o.querySelector('.ergebnis-karte').focus({ preventScroll: true });
    else s.querySelector('[data-online="ergebnis-zeigen"]')?.focus({ preventScroll: true });
  }
  function baueBlatt() {
    if (blattFuer === p.id) return;
    blattFuer = p.id;
    blattEl()?.remove();
    const [titel, grund] = endeTexte();
    const eigen = online.meineFarbe(p);
    const art = !endeZaehlt() ? '' : p.ergebnis === '1/2-1/2' ? 'remis' : (p.ergebnis === '1-0' ? 'w' : 'b') === eigen ? 'sieg' : 'niederlage';
    const wort = esc(titel) + (art === 'sieg' ? '<span class="ausruf">!</span>' : '');
    const analyse = kannAnalyse();
    // beim Ende sofort auf dem Geraet ablegen (W-online-analyse); scheitert der Speicher, bleibt "Zur Analyse" der zweite Versuch
    if (analyse) { try { sichereFuerAnalyse(); } catch (e) { /* voller Speicher: Zur Analyse meldet es */ } }
    const o = document.createElement('div');
    o.className = `ergebnis-overlay on-erg ${art}`.trim();
    o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-labelledby', 'on-erg-wort');
    o.innerHTML = `<div class="ergebnis-karte" tabindex="-1">
        <button class="icon-knopf erg-zu" type="button" data-online="brett" aria-label="${esc(t('partie.erg.brettAnsehen'))}">${icon('auge')}</button>
        <div class="erg-rumpf"><h2 class="erg-wort disp" id="on-erg-wort">${wort}</h2><p class="erg-unter">${esc(grund)}</p>
          ${p.gewertet ? '<p class="on-erg-kronen" hidden></p>' : ''}</div>
        <div class="erg-aktionen"><div class="erg-knoepfe">
          ${analyse ? `<button class="knopf primaer gross" type="button" data-online="analyse">${icon('analyse')} ${esc(t('partie.erg.zurAnalyse'))}</button>` : ''}
          <button class="knopf gross${analyse ? '' : ' primaer'}" type="button" data-online="revanche">${icon('nochmal')} ${esc(O('revanche'))}</button></div>
          <button class="erg-lobby" type="button" data-online="liste-zurueck">${icon('verlauf')}<span>${esc(O('meine'))}</span></button></div>
      </div>`;
    // wie das Blatt der Bot-Partie: Tab kreist im Blatt, Escape zeigt das Brett
    o.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); zeigeBlatt(false); return; }
      if (e.key !== 'Tab') return;
      const ziele = [...o.querySelectorAll('button')].filter(x => !x.disabled && x.getClientRects().length);
      if (!ziele.length) return;
      const jetzt = document.activeElement;
      if (e.shiftKey && (jetzt === ziele[0] || !ziele.includes(jetzt))) { e.preventDefault(); ziele.at(-1).focus(); }
      else if (!e.shiftKey && (jetzt === ziele.at(-1) || !ziele.includes(jetzt))) { e.preventDefault(); ziele[0].focus(); }
    });
    s.append(o);
    zeigeKronen();
    if (feier) {
      // Finisher laeuft: das Blatt steht bereit, oeffnet aber erst nach ihm (oder nach einem Tipp)
      o.hidden = true; o.dataset.feier = '';
      const f = feier; feier = null;
      // nur, wenn es niemand inzwischen selbst geoeffnet (und vielleicht wieder geschlossen) hat
      f.then(() => { if (!weg && blattEl() === o && 'feier' in o.dataset) zeigeBlatt(true); });
    } else zeigeBlatt(true);
  }
  // Ablage fuer die Analyse: die Spielanalyse (js/ui/analyse.js) und "Meine Partien" (js/ui/verlauf.js) lesen nur Partien vom
  // Geraet. W-online-analyse: jede beendete Online-Partie mit mindestens einem Zug wird beim Ende von selbst abgelegt (auch
  // wer das Blatt nur schliesst, findet sie dort), als Partie zweier Menschen (modus 'zuzweit': wertet nie, kein Bot) mit dem
  // Kennzeichen online, aus Sicht der eigenen Farbe. Feste ID je Online-Partie und genau einmal: steht sie schon auf dem
  // Geraet (Neuladen, zweites Oeffnen, Klick auf "Zur Analyse"), bleibt der Eintrag samt Analyse stehen; nur die Namen
  // werden nachgetragen, sobald die Visitenkarten da sind. Ein Ende ohne gueltiges Ergebnis hat kein ergebnis und einen
  // ehrlichen Grund (abgebrochen, strittig, unklar).
  const analyseId = () => 'on-' + p.id;
  const namenDerPartie = () => ({ weiss: spielerDaten('w').name, schwarz: spielerDaten('b').name, drehen: false });
  function sichereFuerAnalyse() {
    if (!kannAnalyse()) return null;
    const id = analyseId();
    const da = ladeGespeichert(id);
    if (da) {
      const namen = namenDerPartie(), alt = da.zuzweit || {};
      const teil = {};
      if (kartenDaten && (alt.weiss !== namen.weiss || alt.schwarz !== namen.schwarz)) teil.zuzweit = namen;
      // vor dem 13.11. per "Zur Analyse" abgelegt: damals ohne Kennzeichen, die Analyse zeigte sie als "Zu zweit"
      if (!da.online) teil.online = { gewertet: p.gewertet === true };
      if (Object.keys(teil).length) aktualisierePartie(id, teil);
      return id;
    }
    const zuege = chess.history({ verbose: true });
    const eigen = online.meineFarbe(p);
    const zaehlt = endeZaehlt();
    const ergebnis = !zaehlt ? null : p.ergebnis === '1/2-1/2' ? 'remis' : (p.ergebnis === '1-0' ? 'w' : 'b') === eigen ? 'sieg' : 'niederlage';
    const grund = zaehlt ? ANALYSE_GRUND[p.grund] || null : p.grund === 'strittig' || p.grund === 'abgebrochen' ? p.grund : 'unklar';
    const tempo = p.bedenkzeit_s == null ? null : { grund: p.bedenkzeit_s, zuschlag: p.inkrement_s || 0 };
    speicherePartie({ id, modus: 'zuzweit', botId: null, spielerFarbe: eigen, zuzweit: namenDerPartie(),
      online: { gewertet: p.gewertet === true },
      zuege: zuege.map(m => m.lan), san: zuege.map(m => m.san), tempo, ergebnis, grund,
      datum: p.aktualisiert_am || undefined, hinweise: 0, zuruecknahmen: 0, liveKlassen: [], genauigkeit: null, genauigkeitBot: null });
    return id;
  }
  function zurAnalyse() {
    if (!kannAnalyse()) return;
    let id;
    try { id = sichereFuerAnalyse(); } catch (e) { id = null; }
    if (!id) { melde(O('fehler')); return; }
    app.gehe('analyse', { partieId: id });
  }
  // Etappe 4b: die Visitenkarten beider Spieler (js/karte.js, nur fuer die Teilnehmer dieser Partie) bringen Banner, Name
  // und Titel in die Spielerleisten; bis sie da sind (oder ohne Antwort) bleibt es bei "Ich" und "Freund"
  function karten() {
    if (!brett) return;
    if (p.id && kartenPartie !== p.id) {
      kartenPartie = p.id;
      kartenDaten = null;
      const id = p.id;
      clearTimeout(kartenUhr); kartenUhr = null;
      if (kartenVersuchFuer !== id) { kartenVersuchFuer = id; kartenVersuch = 0; }
      karteDerPartie(id, { frist: 8000 }).then((d) => {
        if (weg || !p || p.id !== id) return;
        if (!d) {
          // gescheitert (Netz, Serverfehler, Frist): spaeter neu fragen, statt die ganze Partie mit Platzhalter zu bleiben
          if (kartenVersuch < KARTE_NACH.length) kartenUhr = setTimeout(() => { kartenUhr = null; if (!weg && p && p.id === id && !kartenDaten) { kartenPartie = null; karten(); } }, KARTE_NACH[kartenVersuch++]);
          return;
        }
        // Name des Gegners auch in der Zeile "<Name> beginnt" (R19)
        kartenDaten = d; karten(); zeichneZugZeile(); intro();
        // gruener Haken (supabase/benutzername-bestaetigt-schema.sql): einmal fragen, dann die Leisten neu zeichnen
        bestaetigteNamen(['w', 'b'].map((f) => spielerDaten(f)).filter((x) => x.echt).map((x) => x.name))
          .then(() => { if (!weg && p && p.id === id) karten(); }, () => {});
        // die Namen kamen erst nach dem Ende: in der Ablage fuer die Analyse nachtragen
        if (p.status === 'beendet') { try { sichereFuerAnalyse(); } catch (e) { /* bleibt bei den alten Namen */ } }
      });
    }
    const eigen = online.meineFarbe(p);
    for (const [ort, f] of [['oben', andere(eigen)], ['unten', eigen]]) {
      const { k, name, elo, liga, echt } = spielerDaten(f);
      const haken = echt && hatHaken(name) ? hakenHtml() : '';
      const banner = k ? `<span class="on-banner" aria-hidden="true" style="background-image:url('${bannerUrl(k.banner)}')"></span>` : '';
      // R26 (Flo 21.11.2026: "Mein Rahmen wird nicht angezeigt, wenn die Runde gestartet wird"): die eigene Leiste zeigt
      // das eigene Bild (Wahl mit Erfinder-Rahmen und Koenig), nicht das der Server-Karte; die zeigt beides nur mit Stueck
      // und erst mit supabase/karte-besitz-sicht-schema.sql (R30). Was der Gegner sieht, bleibt die Server-Karte.
      // Gegner ohne Karte (noch nicht geladen oder kein Profil): neutrales Bild statt kurz des eigenen (Altbefund 6e, 21.11.)
      const avatar = ort === 'oben' ? (k?.avatar || GEGNER_STANDARD) : floAvatar(f);
      // R19 online ruhig (Flos Wahl A): die Leiste zeigt den Namen, ohne Titel; unter dem Namen die geschlagenen Figuren.
      // Flo 15.11. 12:50 ("die elo soll man schon sehen koennen"): beim GEGNER davor seine Elo, nur die vom Server
      // (spielerDaten, 100 bis 4000), ohne sie die Liga als Wort, ohne beides nichts. Die eigene Elo steht in der Lobby.
      const meta = ort === 'oben' ? (elo != null ? `Elo ${elo}` : liga) : '';
      const unter = `<div class="unter bot-meta">${meta ? `<span class="p-meta">${esc(meta)}</span>` : ''}<span class="geschlagen-ort" data-wer="${f}"></span></div>`;
      const uhr = `<div class="uhr zahl" data-farbe="${f}"${p.bedenkzeit_s == null ? ' hidden' : ''}>${UHR_SYMBOL}<span class="uhr-zeit"></span></div>`;
      const el = inhalt.querySelector('.on-' + ort);
      el.classList.toggle('mit-banner', !!banner);
      el.setAttribute('aria-label', meta ? `${name}, ${meta}` : name);
      // Gegner: Bild, Feld info (Name, Unterzeile), Uhr; eigene Leiste: Bild, Name, Unterzeile, Uhr (Gitter aus css/partie.css).
      // R19 M6: ueber der Gegnerleiste liegt ein durchsichtiger Knopf, ein Tipp oeffnet sein Profil (js/ui/gegner-profil.js)
      const profil = `<button class="on-gegner-knopf" type="button" data-online="gegner" aria-label="${esc(profilText('oeffnen', { name }))}"></button>`;
      el.innerHTML = ort === 'oben'
        ? `${banner}<span class="av">${avatar}</span><div class="info"><div class="name"><b>${esc(name)}</b>${haken}</div>${unter}</div>${uhr}${profil}`
        : `${banner}<span class="av">${avatar}</span><div class="name"><b>${esc(name)}</b>${haken}</div>${unter}${uhr}`;
    }
    zeichneGeschlagen();
    zeigeKopfTitel();
    tick();
  }
  // R19 M6: Profil des Gegners ueber der laufenden Partie (die Abfrage laeuft weiter, Zuege kommen an); ist die Karte noch
  // nicht da, holt das Blatt sie einmal nach, ohne Antwort zeigt es den Namen aus der Leiste
  function zeigeGegner() {
    if (!p) return;
    const f = andere(online.meineFarbe(p)), id = p.id;
    const { k, name } = spielerDaten(f);
    zeigeGegnerProfil({ karte: k, name, partie: true,
      laden: k || !id ? null : () => karteDerPartie(id).then((d) => (d ? (f === 'w' ? d.w : d.s) : null)) })
      .then(() => {
        // kam bei offenem Blatt ein Zug, hat karten() die Leiste samt Knopf neu gebaut; das Blatt findet den alten Knopf
        // nicht mehr, der Fokus fiele auf body (Kaltreview 6b, F1): dann auf den neuen Knopf. Mit Animation steht er beim
        // resolve noch im schliessenden Blatt (.sheet-ort.weg, 260 ms im DOM) und faellt erst danach auf body
        const a = document.activeElement;
        if (!weg && (!a || a === document.body || a.closest('.sheet-ort.weg'))) inhalt.querySelector('.on-oben .on-gegner-knopf')?.focus({ preventScroll: true });
      });
  }
  // geschlagene Figuren je Seite und Materialvorsprung "+n" (wie zeichneGeschlagen in js/ui/partie.js)
  function zeichneGeschlagen() {
    if (!chess) return;
    const von = { w: [], b: [] };
    for (const m of chess.history({ verbose: true })) if (m.captured) von[m.color].push(m.captured);
    const bilanz = materialBilanz(chess.fen());
    for (const ort of inhalt.querySelectorAll('.geschlagen-ort')) {
      const f = ort.dataset.wer;
      const plus = bilanz * (f === 'w' ? 1 : -1);
      const liste = von[f].sort((a, b) => WERT[b] - WERT[a]);
      let vor = null;
      const imgs = liste.map((x) => { const neu = vor !== null && vor !== x; vor = x;
        return `<img${neu ? ' class="neu-gruppe"' : ''} src="${new URL(`assets/pieces/${andere(f)}${x.toUpperCase()}.svg`, WURZEL).href}" alt="" decoding="sync">`; }).join('');
      const html = !liste.length && plus <= 0 ? '<span class="geschlagen leer"></span>'
        : `<span class="geschlagen">${imgs}${plus > 0 ? `<span class="plus zahl">+${plus}</span>` : ''}</span>`;
      if (ort._html !== html) { ort._html = html; ort.innerHTML = html; }
    }
  }
  // verbraucht: Zeit seit dem letzten Zug fuer die Ausloesung der Zeitpruefung (vorlaufMs, mit Schranke); ohne die
  // Angabe zeigt die Uhr die Zeit nach der Serveruhr
  function rest(f, verbraucht = null) {
    const wert = Number(f === 'w' ? p.uhr_weiss_ms : p.uhr_schwarz_ms) || 0;
    const laeuft = p.status === 'laeuft' && p.am_zug === f && online.zuegeListe(p).length >= 2 && p.letzter_zug_am;
    if (!laeuft) return Math.max(0, wert);
    return Math.max(0, wert - (verbraucht ?? serverSeitMs()));
  }
  // R19: Zeit seit dem letzten Zug nach der Serveruhr (js/serverzeit.js seit), ohne frische Probe nie mehr als seit diese
  // Ansicht den Stand zuerst sah plus SICHT_SPIEL_MS: eine vorgehende Geraeteuhr beendet so weder Frist noch Uhr
  // vorzeitig (jede Reklamation setzt busy und schluckt Tipps, Flo gegen Opa 15.11.)
  function vorlaufMs() {
    const s = Date.parse(p.letzter_zug_am || '');
    if (!Number.isFinite(s)) return 0;
    if (ersteSicht.stand !== p.letzter_zug_am) ersteSicht = { stand: p.letzter_zug_am, am: Date.now() };
    return zeitSeit(s, ersteSicht.am, SICHT_SPIEL_MS);
  }
  // Zeit seit dem letzten Zug nach der Serveruhr, ohne Schranke: so zeigen Uhr und Frist dieselbe Zeit wie beim Gegner.
  // Die Anzeige rechnet ohne frische Probe mit dem gemerkten Versatz (online-frist 18.11.), die Zeitpruefung nicht
  function serverSeitMs({ anzeige = true } = {}) {
    const s = Date.parse(p.letzter_zug_am || '');
    return Number.isFinite(s) ? Math.max(0, (anzeige ? anzeigeJetzt() : serverJetzt()) - s) : 0;
  }
  // Ausloesung der Zeitpruefung: die Schranke nur am eigenen Zug, denn nur dort schluckt eine Reklamation Tipps. Ist der
  // Gegner am Zug, zaehlt die Serveruhr, sonst kaeme die faellige Pruefung nach Neuladen bis zu seiner ganzen Restzeit
  // zu spaet (Fix-Review 84, 16.11.: 298 s bei 5 min). vorlaufMs laeuft immer mit, damit die erste Sicht stimmt
  function ausloeserMs() {
    const geschuetzt = vorlaufMs();
    return p.am_zug === online.meineFarbe(p) ? geschuetzt : serverSeitMs({ anzeige: false });
  }
  // R19 (Flo 15.11., e7: "Opa beginnt, er hat noch 0:25"): vor dem 2. Halbzug steht die Uhr, es laeuft aber die
  // Erstzug-Frist des Servers. Beide Seiten sehen sie als Zahl und als schmalen Gold-Balken, der schrumpft (matt, ohne Schein)
  function zeichneFrist() {
    const el = inhalt.querySelector('.on-frist');
    if (!el) return;
    const an = p.status === 'laeuft' && p.bedenkzeit_s != null && online.zuegeListe(p).length < 2 && !widerspruch && !!p.letzter_zug_am;
    if (el.hidden === an) el.hidden = !an;
    if (!an) return;
    const frist = erstzugFristMs(p), r = Math.max(0, frist - serverSeitMs()), zeit = uhrText(r);
    const z = el.querySelector('.on-frist-zeit');
    if (z.textContent !== zeit) z.textContent = zeit;
    // Bildstueck (Leitlinie R19): der Koenig der Farbe, die jetzt ziehen muss
    const bild = new URL(`assets/pieces/${p.am_zug === 'b' ? 'b' : 'w'}K.svg`, WURZEL).href, img = el.querySelector('.on-frist-figur');
    if (img.getAttribute('src') !== bild) img.setAttribute('src', bild);
    el.querySelector('.on-frist-balken i').style.transform = `scaleX(${(r / frist).toFixed(3)})`;
    el.classList.toggle('knapp', r <= 10000);
  }
  function tick() {
    if (weg || !brett || !p || p.bedenkzeit_s == null) return;
    for (const el of inhalt.querySelectorAll('.uhr[data-farbe]')) {
      const f = el.dataset.farbe, r = rest(f), zeit = el.querySelector('.uhr-zeit');
      if (zeit) zeit.textContent = uhrText(r);
      el.classList.toggle('laeuft', p.status === 'laeuft' && p.am_zug === f && online.zuegeListe(p).length >= 2);
      // R8 (B4): die Uhr dessen am Zug ist dunkel wie in der Bot-Partie (js/ui/partie.js zeichneKnoepfe), auch vor dem
      // 2. Halbzug, wenn sie noch steht
      el.classList.toggle('am-zug', p.status === 'laeuft' && p.am_zug === f);
      el.classList.toggle('warn', p.status === 'laeuft' && r < 20000);
    }
    zeichneFrist();
    // Uhr-Warnung einmal je Partie, sobald die eigene laufende Uhr unter 20 s faellt (wie in der Partie)
    if (!uhrGewarnt && p.status === 'laeuft' && online.binAmZug(p) && online.zuegeListe(p).length >= 2 && rest(online.meineFarbe(p)) < 20000) {
      uhrGewarnt = true; ton('uhr-warnung');
    }
    if (blockiert || busy || widerspruch || p.status !== 'laeuft') return;
    const halbzuege = online.zuegeListe(p).length, eigen = p.am_zug === online.meineFarbe(p);
    if (Date.now() < (eigen ? zeitPruefung : fremdPruefung)) return;
    let pause;
    if (halbzuege >= 2 && rest(p.am_zug, ausloeserMs()) === 0) pause = 5000;
    // vor dem 2. Halbzug laeuft keine Uhr: der Server beendet die Partie ohne Zug als abgebrochen (gewertet 30 s,
    // sonst 10 Minuten)
    else if (halbzuege < 2 && p.letzter_zug_am && ausloeserMs() >= haengtNachMs(p)) pause = p.gewertet ? HAENGT_RANKED_ABFRAGE_MS : HAENGT_ABFRAGE_MS;
    else return;
    if (eigen) { zeitPruefung = Date.now() + pause; aktion(() => online.pruefeZeit(p.id)); return; }
    // die wartende Seite rechnet nach der Serveruhr; geht ihr Geraet vor, ist die Reklamation zu frueh und aendert nichts.
    // Darum still (ohne busy: kein Zug des Gegners und kein eigener Tipp danach geht verloren, Flo gegen Opa 15.11.) und
    // hoechstens eine je WARTEND_ABFRAGE_MS
    fremdPruefung = Date.now() + Math.max(pause, WARTEND_ABFRAGE_MS);
    pruefeLeise();
  }
  function pruefeLeise() {
    online.pruefeZeit(p.id).then((neu) => {
      if (weg || !neu || neu.id !== p?.id) return;
      if (!busy) uebernehme(neu);
      else if (!wartend || neu.aktualisiert_am > wartend.aktualisiert_am) wartend = neu;
    }, () => { /* naechste Abfrage, der Beobachter bringt den Stand ohnehin */ });
  }
  // Zeile ueber den Hinweisen; R19: vor dem ersten Zug sagt sie auf beiden Seiten, wer beginnt, dahinter die Frist
  function zeichneZugZeile() {
    if (!brett || weg || !p || blockiert) return;
    const gegnerZug = p.gewertet ? O('gegnerAmZug') : O('gegner');
    const beginn = p.status === 'laeuft' && online.zuegeListe(p).length === 0;
    const amZugText = beginn ? (online.binAmZug(p) ? O('beginnstDu') : O('beginnt', { name: spielerDaten('w').name }))
      : online.binAmZug(p) ? O('du') : gegnerZug;
    inhalt.querySelector('.on-zug-text').textContent = p.status === 'beendet' ? O('fertig') : widerspruch ? O('stellung') : busy ? O('bestaetigt') : amZugText;
    zeichneFrist();
  }
  function zeichne() {
    if (!brett || weg || blockiert) return;
    const verlauf = chess.history({ verbose: true }), m = verlauf[verlauf.length - 1];
    brett.setzeStellung(chess.fen(), { letzterZug: m ? [m.from, m.to] : null, schach: chess.inCheck() ? true : null });
    // Ende, Widerspruch oder Schalter aus: die Kette faellt weg (sonst bleibt sie fuer den eigenen Zug stehen)
    if (vorzuege.length && (p.status !== 'laeuft' || widerspruch || app.einstellungen().vorzuege === false)) loescheVorzuege(false);
    if (vorzuege.length) { brett.zeigeVorzuege(vorzuege); zeigeVorzugMarken(); }
    karten();
    zeichneGeschlagen();
    zeichneZugZeile();
    inhalt.querySelector('.on-uhr-hinweis').textContent = p.bedenkzeit_s != null && online.zuegeListe(p).length < 2 ? O('uhr') : '';
    // ein neuer Zug fuehrt aus der Ansicht einer frueheren Stellung zur Partie zurueck
    if (ansehen.el && chess.history().length !== ansehen.n) schliesseAnsicht();
    zeichneZugliste();
    const angebot = p.status === 'laeuft' && !widerspruch && p.remis_angebot && p.remis_angebot !== online.meineFarbe(p);
    // Remis-Angebot des Gegners deutlich als eigener Streifen ueber den Knoepfen (Flo 11.11.: sonst uebersehen)
    const angebotEl = inhalt.querySelector('.on-angebot');
    angebotEl.hidden = !angebot;
    angebotEl.textContent = angebot ? O('angebotText', { name: spielerDaten(andere(online.meineFarbe(p))).name }) : '';
    // Knoepfe wie in der Bot-Partie sichtbar unter dem Brett (Flo 11.11.: "Remis und Aufgeben hinter der Fahne fand ich
    // nicht"): Remis anbieten (oder annehmen, oder "angeboten") und Aufgeben; im Widerspruch Strittig melden und Aufgeben
    const k = (a, ico, text, extra = '', zu = false) => `<button class="knopf aktion dr ${extra}" type="button" data-online="${a}"${zu ? ' disabled' : ''}>${ico}<span>${esc(text)}</span></button>`;
    const aufgeben = k('aufgeben', icon('flagge'), O('aufgeben'), 'aufgeben');
    const remis = angebot ? k('annehmen', icon('haken'), O('annehmen'), 'primaer')
      : p.remis_angebot ? k('angeboten', REMIS_SYMBOL, O('angeboten'), '', true) : k('remis', REMIS_SYMBOL, O('anbieten'));
    const knoepfe = inhalt.querySelector('.spielknoepfe');
    // R7 (B12): links und rechts die Pfeile zum Blaettern (nur hoch sichtbar, css/online.css), wie .sk-pfeil der Bot-Partie
    const mitte = widerspruch ? k('strittig', icon('hinweis'), O('strittigMelden'), 'primaer') + aufgeben : remis + aufgeben;
    const html = p.status !== 'laeuft' ? '' : pfeil('zug-zurueck', 'knopf aktion dr sk-pfeil zl-zurueck') + mitte + pfeil('zug-vor', 'knopf aktion dr sk-pfeil zl-vor');
    if (knoepfe._html !== html) { knoepfe._html = html; knoepfe.innerHTML = html; }
    const ergebnis = inhalt.querySelector('.on-ergebnis');
    ergebnis.hidden = p.status !== 'beendet';
    if (!ergebnis.hidden) {
      const [titel, text] = endeTexte();
      // R7: Revanche, Meine Partien und Zur Analyse stehen im Ergebnisblatt; hier nur das Ergebnis und der Weg zurueck dorthin
      const html = `<h3>${esc(titel)}</h3><p>${esc(text)}</p><div class="on-aktionen"><button class="knopf primaer" type="button" data-online="ergebnis-zeigen">${icon('pokal')} ${esc(t('partie.knopf.ergebnis'))}</button></div>`;
      if (ergebnis._html !== html) { ergebnis._html = html; ergebnis.innerHTML = html; }
      baueBlatt();
    }
    sperre();
  }
  // Titel und Text der Ergebniskarte. "strittig" hat kein Ergebnis. Ein Ergebnis auf einer Stellung, die nicht zu den
  // Zuegen passt, oder ein gemeldetes Ende, das am Brett nicht stimmt, zaehlt nicht als Sieg oder Niederlage.
  function endeTexte() {
    if (p.grund === 'strittig') return [O('strittigTitel'), O('strittig')];
    if (p.ergebnis && (widerspruch || !endePasst(p, chess))) return [O('nichtNachvollziehbar'), O('nichtNachvollziehbarText')];
    const titel = p.ergebnis === '1/2-1/2' ? O('remisKurz') : !p.ergebnis ? O('fertig')
      : (p.ergebnis === '1-0' ? 'w' : 'b') === online.meineFarbe(p) ? O('sieg') : O('niederlage');
    // abgebrochen: vor dem Beitritt eine zurueckgezogene Einladung, danach eine Partie ohne Zug (Server-Regel)
    const grund = p.grund === 'abgebrochen' && p.weiss && p.schwarz ? O('abgebrochen') : GRUND[p.grund] || O('fertig');
    return [titel, grund];
  }
  // ---------- R28 Vorzuege ----------
  // Vormerken geht, solange die Partie laeuft und in der eigenen Stellung (chess, auch waehrend der eigene Zug noch
  // unterwegs ist) der Gegner dran ist. Die Zielkarte gilt auf der gedachten Stellung des Bretts; ob ein Vorzug gilt,
  // entscheidet erst die echte Stellung, wenn der eigene Zug dran ist.
  function kannVormerken() {
    return !!brett && !!p && !!chess && !weg && !blockiert && !widerspruch && p.status === 'laeuft'
      && app.einstellungen().vorzuege !== false && chess.turn() !== online.meineFarbe(p) && !chess.isGameOver();
  }
  function vorzugZiele() { return vorzugZieleVon((f) => brett.figurAuf(f), online.meineFarbe(p)); }
  function zeigeVorzugMarken() {
    brett.markiere(vorzuege.map((v) => v.von), 'vorzug-start');
    brett.markiere(vorzuege.map((v) => v.nach), 'vorzug-ziel');
    brett.nummern(vorzuege.map((v, i) => ({ feld: v.nach, text: i + 1 })));
  }
  function wischeVorzugMarken() {
    if (!brett) return;
    brett.markiere(null, 'vorzug-start'); brett.markiere(null, 'vorzug-ziel'); brett.nummern([]);
  }
  // neu zeichnen: die echte Stellung zurueck aufs Brett (false: der Aufrufer zeichnet gerade selbst)
  function loescheVorzuege(neuZeichnen = true) {
    const hatte = vorzuege.length > 0;
    vorzuege.length = 0;
    wischeVorzugMarken();
    if (hatte && neuZeichnen && brett && chess && !weg) {
      const verlauf = chess.history({ verbose: true }), m = verlauf[verlauf.length - 1];
      brett.setzeStellung(chess.fen(), { animieren: false, letzterZug: m ? [m.from, m.to] : null, schach: chess.inCheck() ? true : null });
      sperre();
    }
  }
  function merkeVorzug(von, nach, umwandlung) {
    if (!merkeInKette(vorzuege, von, nach, umwandlung)) { ton('zurueck'); return false; }
    zeigeVorzugMarken();
    ton('klick');
    brett.erlaubeZuege(vorzugZiele());
    return true;
  }
  function fuehreVorzugAus() {
    if (!vorzuege.length || weg || busy || blockiert || widerspruch || !p || p.status !== 'laeuft' || !online.binAmZug(p)
      || chess.turn() !== online.meineFarbe(p)) return false;
    const fenVorher = chess.fen();
    const r = naechsterVorzug(vorzuege, chess);
    // Der Gegner hat etwas geaendert: dieser Vorzug und alle danach fallen leise weg (kein Fehlertext, wie gegen den Bot)
    // naechsterVorzug hat den ersten schon herausgenommen: die echte Stellung IMMER neu zeichnen (sonst bliebe beim letzten
    // Vorzug die gedachte Figur stehen)
    if (!r || r.verworfen) { vorzuege.length = 0; wischeVorzugMarken(); zeichne(); sperre(); ton('zurueck'); return false; }
    wischeVorzugMarken();
    zieheEigenen(r.zug, fenVorher);
    return true;
  }
  function beiZug(von, nach, umwandlung) {
    if (weg) return false;
    if (kannVormerken()) return merkeVorzug(von, nach, umwandlung);
    if (busy || blockiert || widerspruch || !online.binAmZug(p)) return false;
    let m;
    const fenVorher = chess.fen();
    try { m = chess.move({ from: von, to: nach, promotion: umwandlung || 'q' }); } catch (e) { return false; }
    zieheEigenen(m, fenVorher);
    return true;
  }
  // der Zug steht schon in chess: bewerten, klingen, zeichnen, an den Server
  function zieheEigenen(m, fenVorher) {
    // R26 (altes Tablet): Bewertung, Klang und Zeichnen duerfen den Zug nie aufhalten; er steht schon in chess und muss
    // an den Server, sonst nimmt das Brett ihn zurueck oder die naechste Abfrage setzt ihn zurueck
    try { bewerteLive(fenVorher, m); } catch (e) { console.error(e); }
    // Nur der Zug geht an den Server; ob er gilt und wie die Partie danach steht, entscheidet er (Etappe 1a)
    const daten = { uci: m.lan };
    // der eigene Zug klingt sofort; endet die Partie mit ihm, kommt nur der Ende-Klang, sobald der Server bestaetigt
    gehoert = chess.history().length;
    if (!chess.isGameOver()) ton(zugKlangName(m, chess.inCheck()));
    try { zugFx(m); } catch (e) { console.error(e); }
    queueMicrotask(() => {
      if (weg) return;
      try { zeichne(); } catch (e) { console.error(e); }
      aktion(() => online.sendeZug(p.id, daten));
    });
    // Sofort sperren, damit auch im selben Ereignis kein zweiter Zug durchkommt (Vorzuege gibt sperre() danach frei).
    brett.erlaubeZuege(null);
  }
  s.addEventListener('submit', e => {
    const form = e.target.closest('form[data-form]'); if (!form) return; e.preventDefault();
    if (form.dataset.form === 'einladen') {
      const [bedenkzeit, inkrement] = TEMPI[form.elements.tempo.value] || TEMPI.ohne;
      aktion(() => online.erstelleEinladung({ farbe: form.elements.farbe.value, bedenkzeit, inkrement }), oeffne);
    } else aktion(() => online.tritteBei(online.normalisiereCode(form.elements.code.value)), oeffne);
  });
  s.addEventListener('click', async e => {
    const knopf = e.target.closest('button'); if (!knopf || weg) return;
    if (knopf.dataset.partie) { app.gehe('online', { partieId: knopf.dataset.partie }); return; }
    const a = knopf.dataset.online;
    if (a === 'gegner') { zeigeGegner(); return; }
    if (knopf.dataset.zeit) {
      for (const z of knopf.parentNode.querySelectorAll('[data-zeit]')) z.setAttribute('aria-checked', String(z === knopf));
      return;
    }
    if (a === 'suchen') { starteSuche(); return; }
    if (a === 'suche-stopp') { stoppeSuche(); return; }
    if (a === 'ki-jetzt') { kiJetzt(); return; }
    // Raetsel-Duell fuer alle (Flo 08.11.2026): die Tuer startet die gewertete Duell-Suche direkt
    if (a === 'duell') { app.gehe('raetsel-duell', { suchen: true }); return; }
    if (a === 'liga') { app.gehe('bestenliste'); return; }
    if (a === 'rang') { app.gehe('bestenliste', { reiter: 'welt' }); return; }
    if (a === 'form') { zeigeLetzte(); return; }
    // R27: eine Zeile der Weltrangliste zeigt die vorhandene Visitenkarte (Name, Banner aus der Liste; die eigene aus dem Profil),
    // ohne neue Server-Abfrage; der Fokus kehrt danach auf die Zeile zurueck
    if (a === 'rang-profil') {
      const z = rangZeilen[Number(knopf.dataset.n)];
      if (!z) return;
      zeigeGegnerProfil({ karte: z.ich ? eigeneKarte() : { name: z.name, banner: z.banner, titel: null, ki: false, kronenStufe: null, orden: [],
        ...(typeof z.motiv === 'string' ? { avatar: fremderAvatar(z) } : {}) } })
        .then(() => { if (!weg && knopf.isConnected) knopf.focus({ preventScroll: true }); });
      return;
    }
    // R27: die Freunde-Karte oeffnet das passende Formular darunter und setzt den Fokus hinein
    if (a === 'freunde-einladen' || a === 'freunde-code') {
      const fr = s.querySelector('.on-freunde');
      if (!fr) return;
      fr.open = true;
      const ziel = fr.querySelector(a === 'freunde-code' ? '[data-form="beitreten"] [name="code"]' : '[data-form="einladen"] select');
      ziel?.scrollIntoView({ block: 'center' });
      ziel?.focus();
      return;
    }
    if (a === 'liste-zurueck') { app.gehe('online', { freunde: true }); return; }
    if (a === 'konto') { kontoFreigeschaltet('#konto'); app.gehe('einstellungen', { seite: 'konto' }); return; }
    if (a === 'liste') { ladeListe(); return; }
    if (a === 'brett') { zeigeBlatt(false); return; }
    // R7 (B12): Blaettern in den Zuegen und Brettwahl im Kopf (aendern nichts an der Partie, darum vor der Sperre unten)
    if (a === 'zug-zurueck' && chess) { zeigeAnsicht((ansehen.ply ?? chess.history().length - 1) - 1); return; }
    if (a === 'zug-vor') { if (ansehen.ply != null) zeigeAnsicht(ansehen.ply + 1); return; }
    if (a === 'zug-live') { schliesseAnsicht(); return; }
    if (knopf.dataset.brett && knopf.closest('.brettwahl')) {
      app.setzeEinstellungen({ brett: knopf.dataset.brett });
      ton('klick');
      return;
    }
    if (a === 'ergebnis-zeigen') { zeigeBlatt(true); return; }
    if (a === 'analyse') { zurAnalyse(); return; }
    if (a === 'teilen' && p) {
      const url = online.einladungsLink(p.code);
      try {
        if (navigator.share) await navigator.share({ title: O('teilenTitel'), url });
        else { await navigator.clipboard.writeText(url); melde(O('kopiert')); }
      } catch (f) { if (f.name !== 'AbortError') { inhalt.querySelector('.on-link')?.select(); melde(O('kopieren')); } }
      return;
    }
    if (busy || blockiert || !p) return;
    if (a === 'remis') aktion(() => online.bieteRemis(p.id));
    if (a === 'annehmen') aktion(() => online.nimmRemisAn(p.id));
    if (a === 'strittig') aktion(() => online.meldeStrittig(p.id));
    if (a === 'aufgeben') {
      busy = true; sperre();
      // Aufgeben mit Rueckfrage (Remis anbieten hat seit dem 11.11. einen eigenen Knopf daneben)
      const wahl = await app.frage({ titel: O('aufgebenTitel'), text: O(p.gewertet ? 'gegnerGewinnt' : 'freundGewinnt'),
        knoepfe: [{ text: O('weiter'), wert: false }, { text: O('aufgeben'), wert: true, art: 'gefahr' }], abbrechen: false });
      busy = false;
      if (weg) return;
      if (wartend) { const neu = wartend; wartend = null; uebernehme(neu); }
      if (wahl === true && p.status === 'laeuft') aktion(() => online.gibAuf(p.id)); else sperre();
    }
    if (a === 'revanche') aktion(() => online.erstelleEinladung({ farbe: andere(online.meineFarbe(p)), bedenkzeit: p.bedenkzeit_s, inkrement: p.inkrement_s }), oeffne);
  });
  if (app.test) window.__online = { partie: () => p, chess: () => chess, brett: () => brett, blockiert: () => blockiert, widerspruch: () => widerspruch, busy: () => busy, rest };
  start();
  return { verlasse() { weg = true; mattOrt?.verlasse(); live?.stop(); clearInterval(restUhr); clearTimeout(introUhr); clearTimeout(kartenUhr); layoutRo?.disconnect(); cancelAnimationFrame(layoutBild);
    window.removeEventListener('online', netzStand); window.removeEventListener('offline', netzStand);
    window.removeEventListener('schach:einstellungen', beiEinstellungen); document.removeEventListener('keydown', zugTasten); schliesseAnsicht(); if (suche) { try { suche.stopp(); } catch (e) { /* egal */ } suche = null; } kopf.verlasse(); beobachter?.stop(); clearInterval(uhrTimer); brett?.zerstoere(); if (app.test) delete window.__online; } };
}
