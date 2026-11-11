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
import { Chess } from '../../vendor/chess/chess.js';
import { t } from '../sprache.js';
import '../sprachen/online.js';
const O = (k, w) => t('online.' + k, w);
import { Brett, zielKarte } from '../board.js';
import { icon } from './icons.js';
import { figurenPfad } from '../figurensatz.js';
import { sanAnzeige, materialBilanz } from '../review.js';
import { sitzung, ladeProfil, kontoFreigeschaltet } from '../konto.js';
import * as online from '../online.js';
import { karteDerPartie } from '../karte.js';
import { fremdeKarte, bannerUrl } from './visitenkarte.js';
import { hauptKopf, seitenKopf, verbindeKopf } from './seite.js';
import { holeStand, suche as kronenSuche, RANKED_ZEIT } from '../kronen.js';
import { stufenName } from '../pakete/liga/texte.js';
import { floAvatar } from '../thema.js';
import { klang, zugKlangName } from '../sounds.js';
import { hoere } from '../ereignisse.js';
import { spieleDuell } from './duell.js';

const WURZEL = new URL('../../', import.meta.url);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const andere = f => f === 'w' ? 'b' : 'w';
const TEMPI = { ohne: [null, 0], '5': [300, 0], '10': [600, 0], '15': [900, 10] };
const uhrText = ms => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
// Mit Uhr und vor dem 2. Halbzug beendet der Server eine Partie nach 10 Minuten ohne Zug (online_haengt in
// supabase/online-schema.sql). Danach fragt die Oberflaeche hoechstens einmal je Minute nach (online_pruefe_zeit).
const HAENGT_MS = 10 * 60 * 1000;
const HAENGT_ABFRAGE_MS = 60 * 1000;
// Partie-Ansicht wie die Bot-Partie (Flo 11.11.2026: "soll aussehen wie die Bot-Partie"): dasselbe Gerippe wie
// js/ui/partie.js (.partie > .inhalt > .brettzone + .seite, Spielerleisten, .spielknoepfe), damit css/partie.css Brett,
// Leisten, Uhren und Knoepfe gleich setzt. Auf dem Handy rechnet layout() unten die Brettgroesse wie dort.
const BRETT_MIN = 280;
const WERT = { q: 9, r: 5, b: 3, n: 3, p: 1 };
const UHR_SYMBOL = '<svg class="ico uhr-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '
  + 'stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/></svg>';
const REMIS_SYMBOL = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><text x="12" y="18" text-anchor="middle" '
  + 'font-size="17" font-weight="800" fill="currentColor">½</text></svg>';
// Duell-Intro vor gewerteten Partien (js/ui/duell.js) nur einmal je Partie und nur in der ersten Minute
const INTRO_SCHLUESSEL = 'schach-arena:online:intro';
const INTRO_FRIST_MS = 60 * 1000;
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

  if (!document.querySelector('link[data-online]')) {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = new URL('css/online.css', WURZEL).href;
    link.dataset.online = ''; document.head.append(link);
  }
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
  let profil = null, uhrTimer = null, zeitPruefung = 0;
  let kartenDaten = null, kartenPartie = null;
  // introGelaufen: Duell-Intro dieser Ansicht schon entschieden; neuerGeprueft: Partie, fuer die nach einer neueren gefragt wurde
  let introGelaufen = false, introUhr = null, neuerGeprueft = null, layoutRo = null, layoutBild = 0;
  const handyMq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(orientation: portrait) and (max-width: 600px)') : null;
  // Klang: gehoert = Halbzuege, die schon geklungen haben; uhrGewarnt = Uhr-Warnung dieser Partie gespielt
  let gehoert = 0, uhrGewarnt = false;
  const ton = name => { try { klang.spiele(name); } catch (e) { /* Klang ist nie wichtig genug fuer einen Fehler */ } };
  const melde = text => { if (!weg) { status.textContent = text; status.hidden = !text; } };
  const fehler = e => { melde(e?.message || O('fehler')); };
  const oeffne = partie => { if (!weg) { online.vergissEinladung(); app.gehe('online', { partieId: partie.id }); } };
  function sperre() {
    if (weg) return;
    for (const el of inhalt.querySelectorAll('button, input, select')) el.disabled = busy || blockiert;
    const angebot = inhalt.querySelector('[data-online="angeboten"]');
    if (angebot) angebot.disabled = true;
    brett?.erlaubeZuege(!busy && !blockiert && !widerspruch && online.binAmZug(p) ? zielKarte(chess, { turmRochade: app.einstellungen().turmRochade === true }) : null);
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
  // Online-Seite "Zwei Tueren" (Flo 08.11.2026, Konzept 1 A mit den Woertern von B): oben der Liga-Streifen, darunter
  // zwei gleich gebaute Karten Partie und Raetsel-Duell (jeder Suchen-Knopf traegt "gewertet"), unten die Zeile
  // "Freund einladen oder Code eingeben" als lockerer Weg (klappt Einladen, Code und Meine Partien auf). Passt ohne
  // Scrollen auf das iPhone 13 (tests/online-ui.test.mjs). Ohne Konto sind die Karten nur Erklaerung, ohne Knopf und
  // ohne Schatten, damit nichts tippbar aussieht; der einzige Knopf ist "Zum Konto" (wie ueberall in der App).
  const FIGUREN = { partie: 'bKe8 bQd8 bPd7 bPe5 bPf7 bNc6 wPd2 wPe4 wNf3 wQd1 wKe1', duell: 'bKg8 bPf7 bPg7 bPh7 wRa1 wKg1 wPf2 wPg2 wPh2' };
  const bild = art => `<span class="on-bild" aria-hidden="true">${FIGUREN[art].split(' ').map(x =>
    `<img src="${new URL(`assets/pieces/${x[0]}${x[1]}.svg`, WURZEL).href}" alt="" style="grid-area:${9 - Number(x[3])}/${x.charCodeAt(2) - 96}">`).join('')}`
    + `${art === 'duell' ? '<b class="on-bild-uhr zahl">3:00</b>' : ''}</span>`;
  const tuer = (art, rumpf) => `<section class="on-art on-tuer" data-art="${art}" aria-labelledby="on-${art}-t">
      <div class="on-tuer-kopf">${bild(art)}<div class="on-tuer-text"><span class="on-tuer-ueber">${esc(O(`tuer.${art}.ueber`))}</span>
        <h2 id="on-${art}-t">${esc(O(`tuer.${art}.titel`))}</h2><p>${esc(O(`tuer.${art}.text`))}</p></div></div>${rumpf}</section>`;
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
        if (!blockiert && neu.status !== 'beendet') beobachter = online.beobachte(neu.id, {
          seit: neu.aktualisiert_am,
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
      <button class="on-liga dr" type="button" data-online="liga" data-laedt disabled aria-hidden="true"><span class="on-liga-schild">${icon('liga')}</span>
        <span class="on-liga-text"><b></b><span></span></span></button>
      <div class="on-tueren" data-zustand="konto">
      ${tuer('partie', `<p class="on-suche-text" hidden>${esc(O('suche.pruefen'))}</p>
        <p class="on-zeit-fest">${esc(O('suche.zeitFest', { zeit: RANKED_ZEIT.id.replace('+', ' + '), art: O('zeit.' + RANKED_ZEIT.art) }))}</p>
        <button class="knopf primaer dr on-tuer-knopf" type="button" data-online="suchen" disabled>${esc(O('tuer.partie.knopf'))}</button>
        <button class="knopf primaer dr on-tuer-knopf" type="button" data-online="fortsetzen" hidden>${esc(O('laufend.knopf'))}</button>
        <div class="on-suche" hidden>
          <div class="on-ring" aria-hidden="true"><svg viewBox="0 0 100 100"><circle class="on-ring-spur" cx="50" cy="50" r="44"/>
            <circle class="on-ring-rest" cx="50" cy="50" r="44" stroke-dasharray="${RING.toFixed(2)}" stroke-dashoffset="0"/></svg>
            <span class="on-ring-ich">${floAvatar('w')}</span></div>
          <h3>${esc(O('suche.ring'))} <span class="on-uhr zahl" aria-hidden="true">0:00</span></h3><p class="on-rest" role="status"></p>
          <button class="knopf primaer dr" type="button" data-online="ki-jetzt">${esc(O('suche.kiJetzt'))}</button>
          <small class="on-ki-hinweis">${esc(O('suche.kiHinweis'))}</small>
          <button class="knopf dr" type="button" data-online="suche-stopp">${esc(O('suche.abbrechen'))}</button>
        </div>`)}
      ${tuer('duell', `<button class="knopf primaer dr on-tuer-knopf" type="button" data-online="duell">${esc(O('tuer.duell.knopf'))}</button>`)}
      </div>
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
      </details>`;
    inhalt.querySelector('[name="code"]').addEventListener('input', e => { e.target.value = online.normalisiereCode(e.target.value).slice(0, 6); });
    ladeListe();
    pruefeSuche();
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
    if (zustand === 'bald') { const l = inhalt.querySelector('.on-liga[data-laedt]'); if (l) l.hidden = true; }
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
  // Liga-Streifen: Stufe, Platz in der Wochen-Gruppe und Kronen (kronen_mein_stand); unbrauchbare Antwort: kein Streifen
  function zeigeLiga(d) {
    const st = Array.isArray(d) ? d[0] : d;
    const el = inhalt.querySelector('.on-liga');
    if (!el) return;
    if (!st || typeof st !== 'object' || !Number.isFinite(Number(st.kronen))) { el.hidden = true; return; }
    delete el.dataset.laedt; el.disabled = false; el.removeAttribute('aria-hidden');
    const stufe = stufenName(Math.min(17, Math.max(0, Math.trunc(Number(st.stufe)) || 0)));
    const n = Number.isInteger(st.n) && st.n > 0 ? st.n : 30;
    const zeile = Number.isInteger(st.platz) && st.platz > 0 ? O('liga.platz', { platz: st.platz, n }) : O('liga.ohneGruppe');
    const zahlKronen = Math.max(0, Math.trunc(Number(st.kronen)));
    el.innerHTML = `<span class="on-liga-schild" aria-hidden="true">${icon('liga')}</span><span class="on-liga-text"><b>${esc(stufe)}</b><span>${esc(zeile)}</span></span>`
      + `<span class="on-liga-kronen zahl" aria-hidden="true">${icon('krone')}${esc(String(zahlKronen))}</span>`;
    el.setAttribute('aria-label', O('liga.label', { stufe, zeile, kronen: O('liga.kronen', { n: zahlKronen }) }));
    el.hidden = false;
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
    if (lp) {
      sucheZustand('laufend', O(online.binAmZug(lp) ? 'laufend.du' : 'laufend.gegner'));
      sucheKarte().querySelector('[data-online="fortsetzen"]').dataset.partie = lp.id;
      if (!liga) { const l = inhalt.querySelector('.on-liga[data-laedt]'); if (l) l.hidden = true; }
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
        // erst wenn die Partie steht: der Seitenwechsel leert die Meldungen (js/app.js zeigeScreen)
        if (kiRef && lage().vomServer) { const ab = hoere('app:screen', (d) => { if (d.name !== 'partie') return; ab(); app.meldung(O('suche.kiVerlassen'), { dauer: 4500 }); }); }
        app.gehe('partie', { botId: bot.id, farbe: Math.random() < 0.5 ? 'w' : 'b', tempo: tempoWahl(lage), ki: true, ...(kiRef ? { kiRef } : {}) });
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
    let r;
    try { r = nachspielen(neu); } catch (e) {
      blockiert = true; beobachter?.stop();
      melde(e.message);
      sperre(); return;
    }
    const neuerWiderspruch = !r.passt && !widerspruch;
    const alt = p;
    p = neu; chess = r.chess; widerspruch = !r.passt;
    klingt(alt);
    if (neuerWiderspruch && p.status === 'laeuft') { melde(O('stellungFehler')); strittigFaellig = true; }
    if (p.status === 'offen') {
      inhalt.innerHTML = `<section class="on-karte on-einladung flaeche"><h3>${esc(O('einladungTitel'))}</h3><p class="on-code zahl">${esc(p.code)}</p>
        <label>${esc(O('link'))}<input class="on-link" readonly value="${esc(online.einladungsLink(p.code))}"></label>
        <button class="knopf primaer" type="button" data-online="teilen">${esc(O('teilen'))}</button><p>${esc(O('gueltig'))}</p><p>${esc(O('warte'))}</p>
        <button class="knopf" type="button" data-online="liste-zurueck">${esc(O('meine'))}</button></section>`;
    } else {
      if (!brett) {
        // Gerippe der Bot-Partie (js/ui/partie.js): Brett ohne Bewertungsbalken, rechts bzw. darunter die Spalte mit den
        // Spielerleisten (Name, Elo oder Liga, Uhr, geschlagene Figuren) und den Knoepfen. .on-symbol-ort haelt den Platz
        // fuer das Zug-Symbol der Live-Bewertung eigener Zuege (js/pakete/online/live-eigene.js, Einbau in R2).
        s.classList.add('partie', 'online-partie', 'im-spiel', 'ohne-balken');
        s.classList.toggle('mit-uhr', p.bedenkzeit_s != null);
        inhalt.innerHTML = `<div class="inhalt on-spiel">
          <div class="brettzone"><div class="brett-rahmen"><div class="brett on-brett"></div><div class="on-symbol-ort" aria-hidden="true"></div></div></div>
          <div class="seite">
            <div class="spieler gegner on-spieler on-oben" role="group"></div>
            <div class="on-hinweise"><p class="on-angebot" role="alert" hidden></p><p class="on-neuer" hidden></p>
              <p class="on-zug" role="status"></p><p class="on-uhr-hinweis"></p></div>
            <p class="on-zuege" aria-label="${esc(O('zuege'))}"></p>
            <section class="on-ergebnis on-karte flaeche" hidden></section>
            <div class="spieler ich on-spieler on-unten" role="group"></div>
            <div class="spielknoepfe aktionen on-aktionen"></div>
          </div></div>`;
        bauBrett();
        uhrTimer = setInterval(tick, 100);
        beobachteLayout();
        introUhr = setTimeout(intro, 1500);
      }
      zeichne();
      pruefeNeuere();
      if (p.status === 'beendet') { beobachter?.stop(); clearInterval(uhrTimer); }
    }
    sperre();
    meldeStrittigVonSelbst();
  }
  // Brett mit dem eigenen Figurensatz (figurenPfad(e) wie alle anderen Ansichten; Befund 4 vom 11.11.: ohne
  // Einstellungen). Aendert sich der Satz waehrend der Partie (Erfinder-Status kommt erst nach dem Aufbau vom Server,
  // js/app.js pruefeSonderstuecke, oder Wahl in den Einstellungen), wird das Brett mit der Stellung neu gebaut.
  const skinPfad = (e = app.einstellungen()) => new URL(figurenPfad(e), WURZEL).href;
  function bauBrett() {
    const e = app.einstellungen();
    brett?.zerstoere();
    brett = new Brett(inhalt.querySelector('.on-brett'), { beiZug, figurenPfad: skinPfad(e),
      koordinaten: e.koordinaten !== false, koordLage: e.koordLage, autoDame: e.autoDame !== false, turmRochade: e.turmRochade === true,
      steuerung: e.steuerung, pfeile: e.pfeile !== false });
    brett.setzeAusrichtung(online.meineFarbe(p)); brett.setzeDauer(300);
  }
  function beiEinstellungen(ev) {
    if (weg || !brett || blockiert) return;
    const e = ev?.detail || app.einstellungen();
    if (skinPfad(e) === brett.figurenPfad) return;
    bauBrett(); zeichne();
  }
  window.addEventListener('schach:einstellungen', beiEinstellungen);
  // Handy hoch: Brett von Rand zu Rand, ein Vielfaches von 8; passt die Spalte bis zu den Knoepfen nicht, wird es
  // kleiner, nie unter BRETT_MIN (wie layout() in js/ui/partie.js, dort ausserdem Coach und Zugstreifen)
  function layout() {
    const spiel = inhalt.querySelector('.on-spiel');
    if (weg || !spiel || !s.isConnected) return;
    const handy = !!(handyMq && handyMq.matches);
    s.classList.toggle('handy', handy);
    s.classList.remove('eng');
    if (!handy) { spiel.style.removeProperty('--brett'); spiel.style.removeProperty('--spalte'); return; }
    const rahmen = spiel.querySelector('.brett-rahmen');
    const rs = getComputedStyle(rahmen);
    const sockelX = (parseFloat(rs.paddingLeft) || 0) + (parseFloat(rs.paddingRight) || 0);
    const sockelY = (parseFloat(rs.paddingTop) || 0) + (parseFloat(rs.paddingBottom) || 0);
    const breit = Math.floor((spiel.clientWidth - sockelX) / 8) * 8;
    const setze = (g) => { spiel.style.setProperty('--brett', g + 'px'); spiel.style.setProperty('--spalte', (g + sockelX) + 'px'); };
    // unterstes Element, das sichtbar bleiben soll: die Knoepfe, nach dem Ende die Ergebniskarte
    const knoepfe = spiel.querySelector('.spielknoepfe');
    const ziel = knoepfe.childElementCount ? knoepfe : spiel.querySelector('.on-unten');
    const untenVon = (el) => { let y = el.offsetHeight, x = el; while (x && x !== spiel) { y += x.offsetTop; x = x.offsetParent; } return y; };
    const passt = () => untenVon(ziel) + 4 <= spiel.clientHeight + 0.5;
    setze(breit);
    if (!passt()) s.classList.add('eng');
    if (!passt()) {
      const rest = untenVon(ziel) + 4 - rahmen.offsetHeight;
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
    const name = k && roh.name ? k.name : f === eigen ? profil?.benutzername || O('ich') : p.gewertet ? O('gegnerName') : O('freund');
    const elo = roh && Number.isInteger(roh.elo) && roh.elo >= 100 && roh.elo <= 4000 ? roh.elo : null;
    const liga = k && Number.isInteger(k.kronenStufe) ? stufenName(k.kronenStufe) : '';
    return { k, name, elo, liga };
  }
  // Duell-Intro vor gewerteten Partien (Flo 11.11.: "Intro wie bei den Bots", Gegnername, Elo, Liga): einmal je Partie,
  // nur in der ersten Minute nach dem Anlegen, sobald die Visitenkarten da sind (oder nach 1,5 s ohne sie)
  function intro() {
    clearTimeout(introUhr); introUhr = null;
    if (introGelaufen || weg || !brett || !p || p.gewertet !== true || p.status !== 'laeuft' || blockiert) return;
    introGelaufen = true;
    const alter = Date.now() - zeitVon(p);
    if (!(alter > -5000 && alter < INTRO_FRIST_MS)) return;
    let gesehen = [];
    try { gesehen = JSON.parse(sessionStorage.getItem(INTRO_SCHLUESSEL) || '[]'); } catch (e) { gesehen = []; }
    if (!Array.isArray(gesehen)) gesehen = [];
    if (gesehen.includes(p.id)) return;
    try { sessionStorage.setItem(INTRO_SCHLUESSEL, JSON.stringify([...gesehen, p.id].slice(-20))); } catch (e) { /* nur Komfort */ }
    const eigen = online.meineFarbe(p);
    const g = spielerDaten(andere(eigen));
    const avatar = g.k?.avatar ? 'data:image/svg+xml,' + encodeURIComponent(g.k.avatar) : '';
    try {
      spieleDuell({ bot: { id: 'online', name: g.name, elo: g.elo, liga: g.liga, avatar }, farbe: eigen, anlass: 'liga',
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
      const m = chess.history({ verbose: true }).at(-1);
      ton(zugKlangName(m, chess.inCheck()));
    }
    gehoert = n;
    if (alt.status !== 'laeuft' || p.status !== 'beendet' || !p.ergebnis || p.grund === 'strittig') return;
    if (widerspruch || !endePasst(p, chess)) return;
    try { klang.ende(p.ergebnis === '1/2-1/2' ? null : (p.ergebnis === '1-0' ? 'w' : 'b') === online.meineFarbe(p)); } catch (e) { /* still */ }
  }
  // Etappe 4b: die Visitenkarten beider Spieler (js/karte.js, nur fuer die Teilnehmer dieser Partie) bringen Banner, Name
  // und Titel in die Spielerleisten; bis sie da sind (oder ohne Antwort) bleibt es bei "Ich" und "Freund"
  function karten() {
    if (!brett) return;
    if (p.id && kartenPartie !== p.id) {
      kartenPartie = p.id;
      kartenDaten = null;
      const id = p.id;
      karteDerPartie(id, { frist: 8000 }).then((d) => { if (d && !weg && p && p.id === id) { kartenDaten = d; karten(); intro(); } });
    }
    const eigen = online.meineFarbe(p);
    for (const [ort, f] of [['oben', andere(eigen)], ['unten', eigen]]) {
      const { k, name, elo, liga } = spielerDaten(f);
      const banner = k ? `<span class="on-banner" aria-hidden="true" style="background-image:url('${bannerUrl(k.banner)}')"></span>` : '';
      const titel = k && k.titel ? `<small class="on-titel">${esc(k.titel.name)}</small>` : '';
      // Unterzeile wie in der Bot-Partie: Elo (wenn bekannt) und Liga, sonst die Farbe; dahinter die geschlagenen Figuren
      const meta = [elo != null ? `Elo ${elo}` : '', liga].filter(Boolean).join(' · ') || (f === 'w' ? O('weiss') : O('schwarz'));
      const avatar = k?.avatar || floAvatar(f);
      const unter = `<div class="unter bot-meta">${titel}<span class="p-meta">${esc(meta)}</span><span class="geschlagen-ort" data-wer="${f}"></span></div>`;
      const uhr = `<div class="uhr zahl" data-farbe="${f}"${p.bedenkzeit_s == null ? ' hidden' : ''}>${UHR_SYMBOL}<span class="uhr-zeit"></span></div>`;
      const el = inhalt.querySelector('.on-' + ort);
      el.classList.toggle('mit-banner', !!banner);
      el.setAttribute('aria-label', name);
      // Gegner: Bild, Feld info (Name, Unterzeile), Uhr; eigene Leiste: Bild, Name, Unterzeile, Uhr (Gitter aus css/partie.css)
      el.innerHTML = ort === 'oben'
        ? `${banner}<span class="av">${avatar}</span><div class="info"><div class="name"><b>${esc(name)}</b></div>${unter}</div>${uhr}`
        : `${banner}<span class="av">${avatar}</span><div class="name"><b>${esc(name)}</b></div>${unter}${uhr}`;
    }
    zeichneGeschlagen();
    tick();
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
  function rest(f) {
    const wert = Number(f === 'w' ? p.uhr_weiss_ms : p.uhr_schwarz_ms) || 0;
    const laeuft = p.status === 'laeuft' && p.am_zug === f && online.zuegeListe(p).length >= 2 && p.letzter_zug_am;
    return Math.max(0, wert - (laeuft ? Math.max(0, Date.now() - Date.parse(p.letzter_zug_am)) : 0));
  }
  function tick() {
    if (weg || !brett || !p || p.bedenkzeit_s == null) return;
    for (const el of inhalt.querySelectorAll('.uhr[data-farbe]')) {
      const f = el.dataset.farbe, r = rest(f), zeit = el.querySelector('.uhr-zeit');
      if (zeit) zeit.textContent = uhrText(r);
      el.classList.toggle('laeuft', p.status === 'laeuft' && p.am_zug === f && online.zuegeListe(p).length >= 2);
      el.classList.toggle('warn', p.status === 'laeuft' && r < 20000);
    }
    // Uhr-Warnung einmal je Partie, sobald die eigene laufende Uhr unter 20 s faellt (wie in der Partie)
    if (!uhrGewarnt && p.status === 'laeuft' && online.binAmZug(p) && online.zuegeListe(p).length >= 2 && rest(online.meineFarbe(p)) < 20000) {
      uhrGewarnt = true; ton('uhr-warnung');
    }
    if (blockiert || busy || widerspruch || p.status !== 'laeuft' || Date.now() < zeitPruefung) return;
    const halbzuege = online.zuegeListe(p).length;
    if (halbzuege >= 2 && rest(p.am_zug) === 0) {
      zeitPruefung = Date.now() + 5000;
      aktion(() => online.pruefeZeit(p.id));
    } else if (halbzuege < 2 && p.letzter_zug_am && Date.now() - Date.parse(p.letzter_zug_am) >= HAENGT_MS) {
      // vor dem 2. Halbzug laeuft keine Uhr: der Server beendet die Partie nach 10 Minuten ohne Zug als abgebrochen
      zeitPruefung = Date.now() + HAENGT_ABFRAGE_MS;
      aktion(() => online.pruefeZeit(p.id));
    }
  }
  function zeichne() {
    if (!brett || weg || blockiert) return;
    const m = chess.history({ verbose: true }).at(-1);
    brett.setzeStellung(chess.fen(), { letzterZug: m ? [m.from, m.to] : null, schach: chess.inCheck() ? true : null });
    karten();
    zeichneGeschlagen();
    const gegnerZug = p.gewertet ? O('gegnerAmZug') : O('gegner');
    inhalt.querySelector('.on-zug').textContent = p.status === 'beendet' ? O('fertig') : widerspruch ? O('stellung') : busy ? O('bestaetigt') : online.binAmZug(p) ? O('du') : gegnerZug;
    inhalt.querySelector('.on-uhr-hinweis').textContent = p.bedenkzeit_s != null && online.zuegeListe(p).length < 2 ? O('uhr') : '';
    inhalt.querySelector('.on-zuege').textContent = chess.history().map((san, i) => `${i % 2 === 0 ? Math.floor(i / 2) + 1 + '. ' : ''}${sanAnzeige(san)}`).join(' ');
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
    const html = p.status !== 'laeuft' ? '' : widerspruch ? k('strittig', icon('hinweis'), O('strittigMelden'), 'primaer') + aufgeben : remis + aufgeben;
    if (knoepfe._html !== html) { knoepfe._html = html; knoepfe.innerHTML = html; }
    const ergebnis = inhalt.querySelector('.on-ergebnis');
    ergebnis.hidden = p.status !== 'beendet';
    if (!ergebnis.hidden) {
      const [titel, text] = endeTexte();
      ergebnis.innerHTML = `<h3>${esc(titel)}</h3><p>${esc(text)}</p><div class="on-aktionen"><button class="knopf primaer" type="button" data-online="revanche">${esc(O('revanche'))}</button><button class="knopf" type="button" data-online="liste-zurueck">${esc(O('meine'))}</button></div>`;
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
  function beiZug(von, nach, umwandlung) {
    if (busy || blockiert || widerspruch || weg || !online.binAmZug(p)) return false;
    let m;
    try { m = chess.move({ from: von, to: nach, promotion: umwandlung || 'q' }); } catch (e) { return false; }
    // Nur der Zug geht an den Server; ob er gilt und wie die Partie danach steht, entscheidet er (Etappe 1a)
    const daten = { uci: m.lan };
    // der eigene Zug klingt sofort; endet die Partie mit ihm, kommt nur der Ende-Klang, sobald der Server bestaetigt
    gehoert = chess.history().length;
    if (!chess.isGameOver()) ton(zugKlangName(m, chess.inCheck()));
    queueMicrotask(() => { if (!weg) { zeichne(); aktion(() => online.sendeZug(p.id, daten)); } });
    // Sofort sperren, damit auch im selben Ereignis kein zweiter Zug durchkommt.
    brett.erlaubeZuege(null);
    return true;
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
    if (a === 'liste-zurueck') { app.gehe('online', { freunde: true }); return; }
    if (a === 'konto') { kontoFreigeschaltet('#konto'); app.gehe('einstellungen', { seite: 'konto' }); return; }
    if (a === 'liste') { ladeListe(); return; }
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
  return { verlasse() { weg = true; clearInterval(restUhr); clearTimeout(introUhr); layoutRo?.disconnect(); cancelAnimationFrame(layoutBild);
    window.removeEventListener('schach:einstellungen', beiEinstellungen); if (suche) { try { suche.stopp(); } catch (e) { /* egal */ } suche = null; } kopf.verlasse(); beobachter?.stop(); clearInterval(uhrTimer); brett?.zerstoere(); if (app.test) delete window.__online; } };
}
