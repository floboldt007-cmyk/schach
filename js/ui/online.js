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
import { sanAnzeige } from '../review.js';
import { sitzung, ladeProfil, kontoFreigeschaltet } from '../konto.js';
import * as online from '../online.js';

const WURZEL = new URL('../../', import.meta.url);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const andere = f => f === 'w' ? 'b' : 'w';
const TEMPI = { ohne: [null, 0], '5': [300, 0], '10': [600, 0], '15': [900, 10] };
const uhrText = ms => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
// Mit Uhr und vor dem 2. Halbzug beendet der Server eine Partie nach 10 Minuten ohne Zug (online_haengt in
// supabase/online-schema.sql). Danach fragt die Oberflaeche hoechstens einmal je Minute nach (online_pruefe_zeit).
const HAENGT_MS = 10 * 60 * 1000;
const HAENGT_ABFRAGE_MS = 60 * 1000;
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
  s.innerHTML = `<header class="kopf"><button class="knopf" type="button" data-online="training">${esc(O('training'))}</button><h2>${esc(O('titel'))}</h2></header>`
    + `<div class="on-rumpf"><p class="on-meldung" role="status" hidden></p><div class="on-inhalt"></div></div>`;
  root.append(s);
  const inhalt = s.querySelector('.on-inhalt'), status = s.querySelector('.on-meldung');
  // blockiert: abgemeldet oder fremde Partie (nichts mehr senden). widerspruch: die Serverstellung passt nicht zu den
  // Zuegen; keine Zuege und keine Zeit-Reklamation mehr, aber "Strittig melden" und "Aufgeben" bleiben bedienbar.
  // strittigFaellig: der Widerspruch ist neu, die Partie wird gleich einmal von selbst als strittig gemeldet.
  let weg = false, busy = false, blockiert = false, widerspruch = false, beobachter = null, brett = null, p = null, chess = null, wartend = null;
  let strittigFaellig = false;
  let profil = null, uhrTimer = null, zeitPruefung = 0;
  const melde = text => { if (!weg) { status.textContent = text; status.hidden = !text; } };
  const fehler = e => { melde(e?.message || O('fehler')); };
  const oeffne = partie => { if (!weg) { online.vergissEinladung(); app.gehe('online', { partieId: partie.id }); } };
  function sperre() {
    if (weg) return;
    for (const el of inhalt.querySelectorAll('button, input, select')) el.disabled = busy || blockiert;
    const angebot = inhalt.querySelector('[data-online="remis"]');
    if (angebot && p?.remis_angebot === online.meineFarbe(p)) angebot.disabled = true;
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
  function start() {
    if (!sitzung()?.access_token) {
      inhalt.innerHTML = `<section class="on-karte flaeche"><h3>${esc(O('zusammen'))}</h3><p>${esc(O('konto'))}</p>`
        + (online.gemerkteEinladung() ? `<p>${esc(O('merker'))}</p>` : '')
        + `<button class="knopf primaer" type="button" data-online="konto">${esc(O('einstellungen'))}</button></section>`;
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
    inhalt.innerHTML = `<div class="on-start"><form class="on-karte flaeche" data-form="einladen"><h3>${esc(O('einladen'))}</h3>
      <label>${esc(O('farbe'))}<select name="farbe"><option value="w">${esc(O('weiss'))}</option><option value="b">${esc(O('schwarz'))}</option><option value="zufall" selected>${esc(O('zufall'))}</option></select></label>
      <label>${esc(O('bedenkzeit'))}<select name="tempo"><option value="ohne">${esc(O('ohneUhr'))}</option><option value="5">5+0</option><option value="10">10+0</option><option value="15">15+10</option></select></label>
      <button class="knopf primaer" type="submit">${esc(O('erstellen'))}</button></form>
      <form class="on-karte flaeche" data-form="beitreten"><h3>${esc(O('codeEingeben'))}</h3><label>${esc(O('code'))}<input name="code" value="${esc(code)}" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC234" required></label>
      <button class="knopf primaer" type="submit">${esc(O('beitreten'))}</button></form></div>
      <section class="on-karte flaeche"><h3>${esc(O('meine'))}</h3><p class="on-liste">${esc(O('ladeListe'))}</p><button class="knopf" type="button" data-online="liste">${esc(O('aktualisieren'))}</button></section>`;
    inhalt.querySelector('[name="code"]').addEventListener('input', e => { e.target.value = online.normalisiereCode(e.target.value).slice(0, 6); });
    ladeListe();
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
    p = neu; chess = r.chess; widerspruch = !r.passt;
    if (neuerWiderspruch && p.status === 'laeuft') { melde(O('stellungFehler')); strittigFaellig = true; }
    if (p.status === 'offen') {
      inhalt.innerHTML = `<section class="on-karte on-einladung flaeche"><h3>${esc(O('einladungTitel'))}</h3><p class="on-code zahl">${esc(p.code)}</p>
        <label>${esc(O('link'))}<input class="on-link" readonly value="${esc(online.einladungsLink(p.code))}"></label>
        <button class="knopf primaer" type="button" data-online="teilen">${esc(O('teilen'))}</button><p>${esc(O('gueltig'))}</p><p>${esc(O('warte'))}</p>
        <button class="knopf" type="button" data-online="liste-zurueck">${esc(O('meine'))}</button></section>`;
    } else {
      if (!brett) {
        inhalt.innerHTML = `<div class="on-spiel"><div class="on-spieler on-oben"></div><div class="brett-rahmen"><div class="brett on-brett"></div></div><div class="on-spieler on-unten"></div>`
          + `<p class="on-zug" role="status"></p><p class="on-uhr-hinweis"></p><div class="on-aktionen"></div><p class="on-zuege" aria-label="${esc(O('zuege'))}"></p><section class="on-ergebnis on-karte flaeche" hidden></section></div>`;
        const e = app.einstellungen();
        brett = new Brett(inhalt.querySelector('.brett'), { beiZug, figurenPfad: new URL('assets/pieces/', WURZEL).href,
          koordinaten: e.koordinaten !== false, koordLage: e.koordLage, autoDame: e.autoDame !== false, turmRochade: e.turmRochade === true,
          steuerung: e.steuerung, pfeile: e.pfeile !== false });
        brett.setzeAusrichtung(online.meineFarbe(p)); brett.setzeDauer(300);
        uhrTimer = setInterval(tick, 100);
      }
      zeichne();
      if (p.status === 'beendet') { beobachter?.stop(); clearInterval(uhrTimer); }
    }
    sperre();
    meldeStrittigVonSelbst();
  }
  function karten() {
    if (!brett) return;
    const eigen = online.meineFarbe(p);
    for (const [ort, f] of [['oben', andere(eigen)], ['unten', eigen]]) {
      const name = f === eigen ? profil?.benutzername || O('ich') : O('freund');
      inhalt.querySelector('.on-' + ort).innerHTML = `<img src="${new URL(`assets/pieces/${f}K.svg`, WURZEL).href}" alt=""><div><b>${esc(name)}</b><span>${f === 'w' ? O('weiss') : O('schwarz')}</span></div>
        <span class="uhr zahl" data-farbe="${f}"${p.bedenkzeit_s == null ? ' hidden' : ''}></span>`;
    }
    tick();
  }
  function rest(f) {
    const wert = Number(f === 'w' ? p.uhr_weiss_ms : p.uhr_schwarz_ms) || 0;
    const laeuft = p.status === 'laeuft' && p.am_zug === f && online.zuegeListe(p).length >= 2 && p.letzter_zug_am;
    return Math.max(0, wert - (laeuft ? Math.max(0, Date.now() - Date.parse(p.letzter_zug_am)) : 0));
  }
  function tick() {
    if (weg || !brett || !p || p.bedenkzeit_s == null) return;
    for (const el of inhalt.querySelectorAll('.uhr')) {
      const f = el.dataset.farbe;
      el.textContent = uhrText(rest(f)); el.classList.toggle('laeuft', p.status === 'laeuft' && p.am_zug === f && online.zuegeListe(p).length >= 2);
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
    inhalt.querySelector('.on-zug').textContent = p.status === 'beendet' ? O('fertig') : widerspruch ? O('stellung') : busy ? O('bestaetigt') : online.binAmZug(p) ? O('du') : O('gegner');
    inhalt.querySelector('.on-uhr-hinweis').textContent = p.bedenkzeit_s != null && online.zuegeListe(p).length < 2 ? O('uhr') : '';
    inhalt.querySelector('.on-zuege').textContent = chess.history().map((san, i) => `${i % 2 === 0 ? Math.floor(i / 2) + 1 + '. ' : ''}${sanAnzeige(san)}`).join(' ');
    const angebot = p.remis_angebot && p.remis_angebot !== online.meineFarbe(p);
    inhalt.querySelector('.on-aktionen').innerHTML = p.status !== 'laeuft' ? ''
      : widerspruch ? `<button class="knopf primaer" type="button" data-online="strittig">${esc(O('strittigMelden'))}</button><button class="knopf" type="button" data-online="aufgeben">${esc(O('aufgeben'))}</button>`
      : `<button class="knopf" type="button" data-online="${angebot ? 'annehmen' : 'remis'}">${angebot ? O('annehmen') : p.remis_angebot ? O('angeboten') : O('anbieten')}</button><button class="knopf" type="button" data-online="aufgeben">${esc(O('aufgeben'))}</button>`;
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
    if (a === 'training') { app.gehe('training'); return; }
    if (a === 'liste-zurueck') { app.gehe('online'); return; }
    if (a === 'konto') { kontoFreigeschaltet('#konto'); app.gehe('einstellungen'); return; }
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
      const ja = await app.frage({ titel: O('aufgebenTitel'), text: O('freundGewinnt'), knoepfe: [{ text: O('weiter'), wert: false }, { text: O('aufgeben'), wert: true, art: 'gefahr' }], abbrechen: false });
      busy = false;
      if (weg) return;
      if (wartend) { const neu = wartend; wartend = null; uebernehme(neu); }
      if (ja && p.status === 'laeuft') aktion(() => online.gibAuf(p.id)); else sperre();
    }
    if (a === 'revanche') aktion(() => online.erstelleEinladung({ farbe: andere(online.meineFarbe(p)), bedenkzeit: p.bedenkzeit_s, inkrement: p.inkrement_s }), oeffne);
  });
  if (app.test) window.__online = { partie: () => p, chess: () => chess, brett: () => brett, blockiert: () => blockiert, widerspruch: () => widerspruch, busy: () => busy, rest };
  start();
  return { verlasse() { weg = true; beobachter?.stop(); clearInterval(uhrTimer); brett?.zerstoere(); if (app.test) delete window.__online; } };
}
