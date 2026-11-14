// Screen "raetsel-duell" (Etappe 5, Paket lobby): zwei Spieler loesen gleichzeitig dieselben Raetsel, fest 3 Minuten.
// Seit Flo 08.11.2026 fuer alle (nicht mehr nur Labor): Einstieg ist die Tuer "Raetsel-Duell" auf der Online-Seite
// (params.suchen startet die gewertete Suche sofort), die Lobby-Karte im Labor und der Link #raetsel-duell/CODE
// (Freundschaft). Der Server entscheidet alles (js/raetsel-duell.js); dieser Screen zeigt nur:
// Start (dunkle Buehne "Kopf an Kopf": beide Avatare, 3:00, drei Kacheln, Gegner suchen; darunter Mit einem Freund),
// Warten (Suche mit sichtbarer Restzeit bis zum KI-Gegner, Einladung), Duell (seit R3 12.11.2026 wie die Bot-Partie:
// Gegner-Leiste, Brett, eigene Leiste mit Uhr, darunter die Zeile und die Reihe der eigenen Raetsel: gruen geloest, rot
// Fehler; im Vorlauf das Duell-Intro, waehrend des Spiels ohne Reiter-Leiste) und Ende (Krone ueber dem Sieger,
// grosser Stand, Kronen-Schild, dieselbe Reihe, Nochmal und Fertig). params: { code } aus dem Link, { suchen }.
//
//   zeige(root, params, app) -> { verlasse() }
// DOM: section.screen.raetsel-duell[data-phase="start"|"konto"|"suche"|"einladung"|"vorlauf"|"laeuft"|"zeit_um"|"beendet"]
//   > header.haupt-kopf, .rd-rumpf > .rd-start (.rd-buehne > .rd-regeln li x3, .rd-suchen; .rd-freund) | .rd-warten
//   | .rd-spiel (.spieler.gegner.rd-seite[data-wer="gegner"]; .rd-brettzone .rd-brett; .spieler.ich.rd-seite[data-wer="ich"]
//   mit .rd-uhr; .rd-zeile; .rd-reihe) | .rd-ende. Optik: css/pakete/raetsel-duell.css.
// Tests: window.__duellKiMs verkuerzt die 10 s bis zum KI-Gegner, window.__duellAbfrageMs die Abfrage (Standard 1 s).
// Mit ?test: window.__duell = { brett() -> Brett | null } (nur lesen; z. B. autoDame, das kein DOM-Merkmal hat).
import { Brett, zielKarte } from '../board.js';
import { figurenPfad } from '../figurensatz.js';
import { brettOptionen, wendeBrettEinstellungenAn } from './brett-einstellungen.js';
import { Chess } from '../../vendor/chess/chess.js';
import { hauptKopf, verbindeKopf } from './seite.js';
import { icon } from './icons.js';
import { spieleDuell } from './duell.js';
import { klang, zugKlangName } from '../sounds.js';
import { anim, tempo } from '../bewegung.js';
import { ladeEinstellungen } from '../storage.js';
import { kontoFreigeschaltet } from '../konto.js';
import { avatarVon, floAvatar } from '../thema.js';
import { BOTS } from '../bots.js';
import { t } from '../sprache.js';
import { KONST, versatzAus, restMs, uhrText, phaseAus, anteil, stellungAus, duellLink, kronenText } from '../pakete/lobby/raetsel-duell.js';
import * as server from '../raetsel-duell.js';
import '../pakete/lobby/raetsel-duell-texte.js';
import '../sprachen/allgemein.js';

const D = (k, w) => t('p-duell.' + k, w);
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WURZEL = new URL('../../', import.meta.url);
const testZahl = (n, std) => (typeof window !== 'undefined' && Number.isFinite(window[n]) ? window[n] : std);
const RING = 2 * Math.PI * 44;
const DAUER_MS = KONST.DAUER_S * 1000;

function ladeCss() {
  try {
    if (document.querySelector('link[data-paket="raetsel-duell"]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL('../../css/pakete/raetsel-duell.css', import.meta.url).href;
    l.dataset.paket = 'raetsel-duell';
    document.head.append(l);
  } catch (e) { /* ohne eigenes CSS bleibt alles bedienbar */ }
}

function fehlerText(e) {
  const k = e && (e.kennung || e.detail);
  const s = k ? D('fehler.' + k) : '';
  return s && s !== 'p-duell.fehler.' + k ? s : D('fehler.allgemein');
}

// Bild des KI-Gegners: der Leiter-Bot mit der naechsten Staerke (nur das Gesicht, die Staerke steht als Zahl daneben)
function kiBot(elo) {
  const leiter = BOTS.filter((b) => !b.endgegner && Number.isFinite(Number(b.elo)));
  if (!leiter.length) return null;
  const ziel = Number.isInteger(elo) ? elo : 1200;
  return leiter.reduce((a, b) => (Math.abs(b.elo - ziel) < Math.abs(a.elo - ziel) ? b : a));
}
function kiBild(elo) {
  const bot = kiBot(elo);
  return bot ? `<img src="${esc(avatarVon(bot))}" alt="">` : '';
}
// Intro nur einmal je Duell (auch nach Neuladen in derselben Sitzung), wie die Online-Partie
const INTRO_SCHLUESSEL = 'schach-arena:raetsel-duell:intro';
// Laufendes Duell ueber Neuladen (R7 12.11.2026, B6): nur die Kennung und die Reihe (reine Anzeige) in diesem Tab. Stand,
// Aufgabe und Uhr kommen nach dem Neuladen wieder vom Server (duell_stand: ende_am, raetsel.bisher), die Zeit laeuft dort
// weiter. Nach dem gezeigten Ergebnis oder einem unbekannten Duell wird der Eintrag vergessen.
const LAUF_SCHLUESSEL = 'schach-arena:raetsel-duell:laufend';
const LAUF_MAX_MS = 15 * 60 * 1000;
const LAUF_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function merkeLauf(id, reihe) {
  try { sessionStorage.setItem(LAUF_SCHLUESSEL, JSON.stringify({ id, reihe, um: Date.now() })); } catch (e) { /* nur Komfort */ }
}
function ladeLauf() {
  let x = null;
  try { x = JSON.parse(sessionStorage.getItem(LAUF_SCHLUESSEL) || 'null'); } catch (e) { x = null; }
  if (!x || typeof x.id !== 'string' || !LAUF_UUID.test(x.id) || !(Date.now() - Number(x.um) < LAUF_MAX_MS)) return null;
  const reihe = Array.isArray(x.reihe) ? x.reihe.filter((r) => r === 'g' || r === 'r').slice(0, 60) : [];
  return { id: x.id, reihe };
}
function vergissLauf(id) {
  try { const x = JSON.parse(sessionStorage.getItem(LAUF_SCHLUESSEL) || 'null'); if (!id || !x || x.id === id) sessionStorage.removeItem(LAUF_SCHLUESSEL); } catch (e) { /* egal */ }
}
const ringSvg = (klasse) => `<svg class="${klasse}" viewBox="0 0 100 100" aria-hidden="true"><circle class="rd-ring-spur" cx="50" cy="50" r="44"/>`
  + `<circle class="rd-ring-rest" cx="50" cy="50" r="44" stroke-dasharray="${RING.toFixed(2)}" stroke-dashoffset="0"/></svg>`;

export function zeige(root, params, app) {
  const s = document.createElement('section');
  s.className = 'screen raetsel-duell';
  s.setAttribute('aria-label', D('name'));
  root.append(s);
  let weg = false;
  ladeCss();
  const einst = (() => { try { return app && typeof app.einstellungen === 'function' ? app.einstellungen() : ladeEinstellungen(); } catch (e) { return {}; } })();
  s.innerHTML = `${hauptKopf({ titel: D('name'), unter: D('unter'), zurueck: true, chips: '', marke: false })}<div class="rd-rumpf"></div>`;
  const rumpf = s.querySelector('.rd-rumpf');
  const kopf = verbindeKopf(s, app, { beiZurueck: () => app.zurueck(), beiEinstellungen: () => app.gehe('einstellungen') });

  const uhren = new Set();
  const spaeter = (fn, ms) => { const u = setTimeout(() => { uhren.delete(u); if (!weg) fn(); }, Math.max(0, ms)); uhren.add(u); return u; };
  const stoppeUhren = () => { for (const u of uhren) clearTimeout(u); uhren.clear(); };
  let suche = null;
  let brett = null;
  // Brett-Einstellungen wirken sofort wie in der Bot-Partie (F-duell Figurensatz, F-duell2 Koordinaten und Auto-Dame,
  // F-einst alle): kommt der Erfinder-Status erst nach dem Aufbau (js/app.js pruefeSonderstuecke wendet die Einstellungen
  // dann neu an) oder stellt der Spieler etwas um, folgt das stehende Brett ohne Neubau (js/ui/brett-einstellungen.js); das
  // naechste Duell auf diesem Bildschirm baut sein Brett mit brettEinst. Ohne detail bleibt alles, wie es ist.
  let brettEinst = einst;
  const beiEinstellungen = (e) => {
    if (!e.detail) return;
    brettEinst = e.detail;
    wendeBrettEinstellungenAn(brett, e.detail, WURZEL);
  };
  window.addEventListener('schach:einstellungen', beiEinstellungen);
  const testHaken = app && app.test ? { brett: () => brett } : null;
  if (testHaken) window.__duell = testHaken;
  // laufendes Duell; reihe: eigene Raetsel in Reihenfolge, 'g' geloest, 'r' Fehler (nur dieses Geraet, nur Anzeige)
  const d = { id: null, st: null, versatz: 0, chess: null, nr: 0, schritt: -1, wartet: false, meldung: null, abfrage: false, reihe: [] };

  const phase = (p) => { s.dataset.phase = p; };
  const endeIntro = () => { if (d.intro) { try { d.intro.ueberspringe(); } catch (e) { /* schon fertig */ } d.intro = null; } };
  function aufraeumen() {
    endeIntro();
    stoppeUhren();
    if (suche) { suche.stopp(); suche = null; }
    if (brett) { try { brett.zerstoere(); } catch (e) { /* egal */ } brett = null; }
  }
  const ichBild = () => `<span class="rd-av" aria-hidden="true">${floAvatar('w')}</span>`;
  const reiheHtml = () => {
    const felder = [...d.reihe, ...Array(Math.max(0, 8 - d.reihe.length)).fill('')];
    const geloest = d.reihe.filter((x) => x === 'g').length;
    return `<ol class="rd-reihe" aria-label="${esc(D('reihe.aria', { geloest, fehler: d.reihe.length - geloest }))}">${felder.map((x) => `<li${x ? ` data-art="${x}"` : ''}></li>`).join('')}</ol>`;
  };

  // ---------- Start ----------
  function zeigeStart(meldung) {
    aufraeumen();
    d.id = null;
    if (!server.angemeldet()) {
      phase('konto');
      rumpf.innerHTML = `<section class="rd-karte"><h2>${esc(D('konto.titel'))}</h2><p class="rd-text">${esc(D('konto.text'))}</p>
        <button type="button" class="knopf primaer dr rd-konto">${esc(D('konto'))}${icon('vor')}</button></section>`;
      rumpf.querySelector('.rd-konto').addEventListener('click', () => { kontoFreigeschaltet('#konto'); app.gehe('einstellungen', { seite: 'konto' }); });
      return;
    }
    phase('start');
    const codeOffen = !!(meldung || (params && params.code));
    rumpf.innerHTML = `<div class="rd-start">
      <section class="rd-buehne" aria-labelledby="rd-regeln-t"><h2 id="rd-regeln-t" class="sr">${esc(D('regeln.titel'))}</h2>
        <div class="rd-paar">${ichBild()}<b class="rd-vs" aria-label="${esc(D('vs'))}">VS</b><span class="rd-av rd-av-frage" aria-hidden="true">?</span></div>
        <b class="rd-gross zahl" aria-hidden="true">${uhrText(DAUER_MS)}</b>
        <ul class="rd-regeln">
          <li><span class="rd-kachel-bild" aria-hidden="true">${icon('ziel')}</span><span aria-hidden="true">${esc(D('kachel.gleich'))}</span><span class="sr">${esc(D('regeln.1'))}</span></li>
          <li><span class="rd-kachel-bild" aria-hidden="true">${icon('verlauf')}</span><span aria-hidden="true">${esc(D('kachel.zeit'))}</span><span class="sr">${esc(D('regeln.2'))}</span></li>
          <li><b class="rd-kachel-bild zahl" aria-hidden="true">${esc(D('kachel.strafe'))}</b><span aria-hidden="true">${esc(D('kachel.fehler'))}</span><span class="sr">${esc(D('regeln.3'))}</span></li>
        </ul>
        <button type="button" class="rd-los dr rd-suchen">${esc(D('suchen.gewertet'))}</button>
      </section>
      <section class="rd-karte rd-freund" aria-labelledby="rd-fr-t"><h2 id="rd-fr-t">${esc(D('freund.titel'))}</h2><p class="rd-text">${esc(D('freund.text'))}</p>
        <div class="rd-knoepfe"><button type="button" class="knopf dr rd-einladen">${esc(D('einladen.kurz'))}</button>
          <button type="button" class="knopf dr rd-code-zeigen" aria-expanded="${codeOffen}" aria-controls="rd-code-form">${esc(D('code.zeigen'))}</button></div>
        <form class="rd-code" id="rd-code-form" novalidate${codeOffen ? '' : ' hidden'}><label for="rd-code-feld">${esc(D('code.label'))}</label>
          <div class="rd-code-zeile"><input id="rd-code-feld" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="9"
            inputmode="text" value="${esc(params && params.code ? params.code : '')}">
          <button type="submit" class="knopf dr rd-beitreten">${esc(D('beitreten'))}</button></div></form>
        <p class="rd-fehler" role="alert"${meldung ? '' : ' hidden'}>${esc(meldung || '')}</p></section></div>`;
    rumpf.querySelector('.rd-suchen').addEventListener('click', starteSuche);
    rumpf.querySelector('.rd-einladen').addEventListener('click', ladeEin);
    rumpf.querySelector('.rd-code-zeigen').addEventListener('click', (e) => {
      const form = rumpf.querySelector('.rd-code');
      form.hidden = !form.hidden;
      e.currentTarget.setAttribute('aria-expanded', String(!form.hidden));
      if (!form.hidden) rumpf.querySelector('#rd-code-feld').focus();
    });
    rumpf.querySelector('.rd-code').addEventListener('submit', (e) => {
      e.preventDefault();
      tritteBei(rumpf.querySelector('#rd-code-feld').value);
    });
  }
  const startFehler = (e) => { if (!weg) zeigeStart(fehlerText(e)); };

  // ---------- Suche ----------
  // Restzeit bis zum KI-Gegner sichtbar (Flo 08.11.2026, Frage 2 c): Ring, Satz und Suchdauer "0:12"; Wartezeit und Beginn
  // nennt der Server (js/gegnersuche.js, ohne neues SQL 10 s). "Jetzt gegen KI" gibt es nur, wenn der Server eine
  // KI-Grenze vor dem Ende nennt (neues SQL), und erst ab da: vorher legt er kein KI-Duell an.
  function starteSuche() {
    aufraeumen();
    phase('suche');
    rumpf.innerHTML = `<section class="rd-karte rd-warten" aria-live="polite"><div class="rd-radar">${ringSvg('rd-ring-bild')}${ichBild()}</div>
      <h2>${esc(D('suche.titel'))} <span class="rd-uhr zahl" aria-hidden="true">0:00</span></h2><p class="rd-text rd-rest"></p>
      <button type="button" class="knopf primaer dr rd-ki-jetzt" hidden disabled>${esc(D('suche.kiJetzt'))}</button>
      <button type="button" class="knopf dr rd-abbrechen">${esc(D('abbrechen'))}</button></section>`;
    const restEl = rumpf.querySelector('.rd-rest');
    const ringEl = rumpf.querySelector('.rd-ring-rest');
    const uhrEl = rumpf.querySelector('.rd-uhr');
    const kiEl = rumpf.querySelector('.rd-ki-jetzt');
    const zeigeRest = () => {
      if (s.dataset.phase !== 'suche' || !suche) return;
      const l = suche.lage();
      const rest = Math.max(0, l.warteMs - l.vergangenMs);
      const sek = Math.floor(l.vergangenMs / 1000);
      uhrEl.textContent = `${Math.floor(sek / 60)}:${String(sek % 60).padStart(2, '0')}`;
      restEl.textContent = D('suche.rest', { s: Math.ceil(rest / 1000) });
      ringEl.setAttribute('stroke-dashoffset', (RING * (1 - rest / l.warteMs)).toFixed(2));
      kiEl.hidden = !(l.vomServer && l.kiAbMs < l.warteMs);
      kiEl.disabled = l.vergangenMs < l.kiAbMs;
      kiEl.textContent = kiEl.disabled ? D('suche.kiAb', { s: Math.ceil((l.kiAbMs - l.vergangenMs) / 1000) }) : D('suche.kiJetzt');
      if (rest > 0) spaeter(zeigeRest, 250);
    };
    rumpf.querySelector('.rd-abbrechen').addEventListener('click', () => zeigeStart());
    kiEl.addEventListener('click', () => { if (suche) suche.jetztKi(); });
    rumpf.querySelector('.rd-abbrechen').focus();
    suche = server.suche({
      warteMs: testZahl('__duellKiMs', undefined),
      beiTreffer: (id) => { suche = null; starteDuell(id); },
      beiKi: (id) => { suche = null; starteDuell(id); },
      beiFehler: (e) => { suche = null; startFehler(e); },
    });
    zeigeRest();
  }

  // ---------- Freundschaft ----------
  async function ladeEin() {
    let r;
    try { r = await server.einladen(); } catch (e) { startFehler(e); return; }
    if (weg) return;
    aufraeumen();
    phase('einladung');
    const link = duellLink(r.code, /^https?:/.test(String(location.origin || '')) ? location.origin + location.pathname : '');
    rumpf.innerHTML = `<section class="rd-karte rd-warten"><h2>${esc(D('einladung.titel'))}</h2><p class="rd-text">${esc(D('einladung.text'))}</p>
      <b class="rd-code-gross zahl" aria-label="${esc(r.code.split('').join(' '))}">${esc(r.code.slice(0, 3))} ${esc(r.code.slice(3))}</b>
      <button type="button" class="knopf primaer dr rd-kopieren">${icon('person')}${esc(D('einladung.kopieren'))}</button>
      <p class="rd-text rd-warte-zeile" aria-live="polite">${esc(D('einladung.warten'))}</p>
      <button type="button" class="knopf dr rd-abbrechen">${esc(D('abbrechen'))}</button></section>`;
    rumpf.querySelector('.rd-kopieren').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(link); rumpf.querySelector('.rd-warte-zeile').textContent = D('einladung.kopiert'); } catch (e) { /* ohne Zwischenablage: Code steht da */ }
    });
    rumpf.querySelector('.rd-abbrechen').addEventListener('click', () => zeigeStart());
    d.id = r.duell;
    const warte = async () => {
      if (weg || d.id !== r.duell) return;
      let st = null;
      try { st = await server.stand(r.duell); } catch (e) { /* naechster Versuch */ }
      if (weg || d.id !== r.duell) return;
      if (st && st.status !== 'offen') { starteDuell(r.duell); return; }
      spaeter(warte, testZahl('__duellAbfrageMs', 1500));
    };
    spaeter(warte, testZahl('__duellAbfrageMs', 1500));
  }

  async function tritteBei(code) {
    let r;
    try { r = await server.beitreten(code); } catch (e) { startFehler(e); return; }
    if (!weg) starteDuell(r.duell);
  }

  // ---------- Duell ----------
  // Gerippe der Bot-Partie (R3, Gleichheits-Liste): Gegner-Leiste ueber dem Brett, eigene Leiste darunter (mit der
  // eigenen Uhr, die Fehler-Strafe trifft nur sie), Klassen .spieler.gegner/.ich und .av wie in der Partie, damit das
  // Duell-Intro (js/ui/duell.js) die Portraets hierher fliegen kann. Je Leiste: Avatar, Name und Fehler, die Zahl der
  // geloesten Raetsel gross ("gelöst" nur fuer Vorleser), unten ein duenner Balken (Anteil am gemeinsamen Stand).
  function seiteHtml(wer) {
    const ich = wer === 'ich';
    const bild = ich ? floAvatar('w') : '<span class="rd-frage">?</span>';
    return `<div class="spieler ${ich ? 'ich' : 'gegner'} rd-seite" data-wer="${wer}" role="group">
      <span class="av rd-av" aria-hidden="true">${bild}</span>
      <span class="rd-info"><span class="rd-name"></span><small class="rd-fehlerzahl"></small></span>
      <b class="rd-geloest zahl"></b>${ich ? `<span class="rd-uhr zahl" role="timer" aria-live="off">${uhrText(DAUER_MS)}</span>` : ''}
      <span class="rd-balken" aria-hidden="true"><i></i></span></div>`;
  }

  function starteDuell(id) {
    aufraeumen();
    // dasselbe Duell nach dem Neuladen (oder Link): die Reihe dieses Tabs bleibt, ein neues Duell beginnt leer
    const alt = ladeLauf();
    const reihe = alt && alt.id === id ? alt.reihe : [];
    Object.assign(d, { id, st: null, versatz: 0, chess: null, nr: 0, schritt: -1, wartet: false, meldung: null, abfrage: false, reihe, gesehen: false });
    merkeLauf(id, reihe);
    phase('vorlauf');
    rumpf.innerHTML = `<div class="rd-spiel">
        ${seiteHtml('gegner')}
        <div class="rd-brettzone"><div class="brett-rahmen rd-rahmen"><div class="rd-brett" aria-label="${esc(D('brett'))}"></div></div></div>
        ${seiteHtml('ich')}
        <p class="rd-zeile" role="status"><span class="rd-nr"></span><span class="rd-amzug"></span><span class="rd-meldung"></span></p>
        <div class="rd-reihe-ort">${reiheHtml()}</div>
      </div>`;
    brett = new Brett(rumpf.querySelector('.rd-brett'), {
      ausrichtung: 'w', figurenPfad: new URL(figurenPfad(brettEinst), WURZEL).href, beiZug, ...brettOptionen(brettEinst),
    });
    hole();
    tick();
  }
  // nach dem gezeigten Ende (eine spaete Zug-Antwort) nicht wieder merken, sonst kaeme das Ergebnis beim Neuladen erneut
  const zeichneReihe = () => { if (d.id && s.dataset.phase !== 'beendet') merkeLauf(d.id, d.reihe); const ort = rumpf.querySelector('.rd-reihe-ort'); if (ort) ort.innerHTML = reiheHtml(); };

  // Abfrage alle 1 s: Gegner live, Ende; das eigene Raetsel nur, wenn gerade kein Zug unterwegs ist
  async function hole() {
    if (weg || !d.id || d.abfrage) return;
    d.abfrage = true;
    const id = d.id;
    let st = null;
    try { st = await server.stand(id); } catch (e) { st = null; }
    d.abfrage = false;
    if (weg || d.id !== id) return;
    if (st) {
      d.versatz = versatzAus(st.jetzt, Date.now());
      d.st = st;
      if (st.status === 'beendet' || st.status === 'abgebrochen') { zeigeEnde(st); return; }
      // Sobald das Duell zum ersten Mal laeuft (Gegner gefunden, Einladung angenommen): Intro wie vor einer Partie
      if (!d.gesehen) { d.gesehen = true; intro(st); }
      if (!d.wartet) setzeRaetsel(st.raetsel);
      zeichneLeiste();
    }
    spaeter(hole, testZahl('__duellAbfrageMs', 1000));
  }

  // Duell-Intro (js/ui/duell.js, wie vor einer Bot- oder Online-Partie): nur solange das Duell frisch ist (Vorlauf)
  // und einmal je Duell; es spielt den Start-Klang selbst (bei Intro "aus" nur den Klang). Ein altes, schon laufendes
  // Duell bekommt wie bisher nur den Klang. Gewertet zaehlt als Liga-Anlass (Vollfassung), Freundschaft nicht.
  function intro(st) {
    const startKlang = () => { try { klang.spiele('start'); } catch (e) { /* ohne Klang */ } };
    let gesehen = [];
    try { gesehen = JSON.parse(sessionStorage.getItem(INTRO_SCHLUESSEL) || '[]'); } catch (e) { gesehen = []; }
    if (!Array.isArray(gesehen)) gesehen = [];
    if (phaseAus(st, d.versatz, Date.now()) !== 'vorlauf' || gesehen.includes(d.id)) { startKlang(); return; }
    try { sessionStorage.setItem(INTRO_SCHLUESSEL, JSON.stringify([...gesehen, d.id].slice(-20))); } catch (e) { /* nur Komfort */ }
    const g = st.gegner || {};
    const ki = st.art === 'ki' ? kiBot(g.elo) : null;
    const bot = { id: 'raetsel-duell', name: ki ? D('ki') : st.art === 'freundschaft' ? D('freund') : D('gegner'),
      elo: ki && Number.isInteger(g.elo) ? g.elo : null, avatar: ki ? avatarVon(ki) : '', farbe: ki ? ki.farbe : undefined };
    try {
      // ohne Vitrine (nie die lange Fassung), damit es in den Vorlauf passt; tick() beendet es spaetestens beim Start
      d.intro = spieleDuell({ bot, farbe: 'w', anlass: st.art === 'freundschaft' ? null : 'liga', einstellung: einst.duellIntro || 'besondere',
        bildschirm: 'raetsel-duell', mitFarbe: false, mitVitrine: false });
    } catch (e) { startKlang(); }
  }

  function tick() {
    if (weg || !d.id || !d.st) { if (!weg && d.id) spaeter(tick, 250); return; }
    const p = phaseAus(d.st, d.versatz, Date.now());
    const uhr = rumpf.querySelector('.rd-uhr');
    if (!uhr) return;
    const rest = p === 'vorlauf' ? DAUER_MS - d.st.ich.fehler * KONST.STRAFE_S * 1000 : restMs(d.st.ich.ende_am, d.versatz, Date.now());
    uhr.textContent = uhrText(rest);
    uhr.setAttribute('aria-label', D('uhr.aria', { zeit: uhrText(rest) }));
    // wie die Partie-Uhr: dunkel, solange sie laeuft, Warnfarbe in den letzten 30 Sekunden
    uhr.classList.toggle('laeuft', p === 'laeuft');
    uhr.classList.toggle('warn', p === 'laeuft' && rest <= 30000);
    if (s.dataset.phase !== p) {
      phase(p);
      if (p !== 'vorlauf') endeIntro();
      if (p === 'laeuft' && !d.wartet) setzeRaetsel(d.st.raetsel, { neu: true });
      if (p === 'zeit_um') { brett.erlaubeZuege(null); zeigeMeldung('', D('zeit.um')); }
      if (p === 'vorlauf') zeigeMeldung('', D('vorlauf'));
    }
    spaeter(tick, 250);
  }

  function zeichneLeiste() {
    const st = d.st;
    const g = st.gegner || { geloest: 0, fehler: 0 };
    const seite = (wer, x, name) => {
      const el = rumpf.querySelector(`.rd-seite[data-wer="${wer}"]`);
      if (!el) return;
      el.querySelector('.rd-name').textContent = name;
      // sichtbar nur die Zahl; "gelöst" fuer Vorleser (der Text bleibt "2 gelöst")
      el.querySelector('.rd-geloest').innerHTML = `${esc(String(x.geloest))}<span class="sr">${esc(D('geloest', { n: x.geloest }).slice(String(x.geloest).length))}</span>`;
      el.querySelector('.rd-fehlerzahl').textContent = x.fehler ? D('fehler', { n: x.fehler }) : '';
      el.querySelector('.rd-balken > i').style.transform = `scaleX(${anteil(x.geloest, wer === 'ich' ? g.geloest : st.ich.geloest)})`;
    };
    seite('ich', st.ich, D('du'));
    const gName = st.art === 'ki' ? (Number.isInteger(g.elo) ? D('ki.elo', { elo: g.elo }) : D('ki')) : st.art === 'freundschaft' ? D('freund') : D('gegner');
    seite('gegner', g, gName);
    const gs = rumpf.querySelector('.rd-seite[data-wer="gegner"]');
    const ki = st.art === 'ki' ? 'ja' : 'nein';
    if (gs.dataset.ki !== ki) {
      gs.dataset.ki = ki;
      const av = gs.querySelector('.rd-av');
      av.innerHTML = st.art === 'ki' ? kiBild(g.elo) : icon('person');
    }
  }

  function zeigeMeldung(art, text) {
    const el = rumpf.querySelector('.rd-meldung');
    if (!el) return;
    el.dataset.art = art || '';
    el.textContent = text || '';
    if (text && tempo() > 0) anim(el, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { d: 280, k: 'weich' });
  }

  // Stellung des aktuellen Raetsels aufs Brett (nur wenn es sich geaendert hat)
  function setzeRaetsel(r, { neu = false } = {}) {
    if (!brett) return;
    const p = phaseAus(d.st, d.versatz, Date.now());
    if (!r || p !== 'laeuft') {
      brett.erlaubeZuege(null);
      if (!r && p === 'laeuft') zeigeMeldung('', D('alle'));
      return;
    }
    if (!neu && r.nr === d.nr && r.bisher.length === d.schritt) return;
    const lage = stellungAus(Chess, r);
    if (!lage) return;
    const anderes = r.nr !== d.nr;
    d.chess = lage.chess;
    d.nr = r.nr;
    d.schritt = r.bisher.length;
    if (anderes) brett.setzeAusrichtung(lage.seite);
    brett.setzeStellung(d.chess.fen(), { animieren: !anderes, letzterZug: lage.letzterZug, schach: d.chess.inCheck() ? true : null });
    brett.erlaubeZuege(zielKarte(d.chess));
    rumpf.querySelector('.rd-nr').textContent = D('nr', { n: r.nr });
    rumpf.querySelector('.rd-amzug').textContent = D('amzug.' + d.chess.turn());
    s.dataset.seite = lage.seite;
    if (anderes && tempo() > 0) anim(rumpf.querySelector('.rd-brettzone'), [{ opacity: 0.4, transform: 'translateX(18px)' }, { opacity: 1, transform: 'none' }], { d: 300, k: 'gleiten' });
  }

  // Zug vom Brett: der Server sagt, ob er richtig war. true = Figur bleibt (danach kommt die neue Stellung), false = zurueck
  function beiZug(von, nach, umw) {
    if (weg || d.wartet || !d.chess || phaseAus(d.st, d.versatz, Date.now()) !== 'laeuft') return false;
    let m = null;
    try { m = d.chess.move({ from: von, to: nach, promotion: umw || 'q' }); } catch (e) { m = null; }
    if (!m) return false;
    const uci = von + nach + (m.promotion || '');
    d.wartet = true;
    brett.erlaubeZuege(null);
    const id = d.id;
    return server.zug(id, uci).then((r) => {
      if (weg || d.id !== id) return false;
      d.wartet = false;
      d.st = { ...d.st, ich: { geloest: r.geloest, fehler: r.fehler, ende_am: r.ende_am }, raetsel: r.naechstes || null };
      zeichneLeiste();
      if (r.richtig) {
        // Zwischenzug wie im Raetsel-Bildschirm: Schlagen, Schach, Umwandlung klingen als solche
        try { klang.spiele(r.fertig ? 'raetsel-richtig' : zugKlangName(m, d.chess.inCheck())); } catch (e) { /* ohne Klang */ }
        zeigeMeldung('richtig', r.fertig ? D('richtig') : D('weiter'));
        if (r.fertig) { d.reihe.push('g'); zeichneReihe(); }
        // die Antwort des Gegners bzw. das naechste Raetsel kurz nach dem eigenen Zug. Ohne neu: hat die Abfrage die
        // Stellung schon gesetzt, bliebe sonst eine Auswahl nicht stehen, die schnell danach getippt wurde
        spaeter(() => setzeRaetsel(d.st.raetsel), r.fertig ? 380 : 260);
        return true;
      }
      try { klang.spiele('raetsel-falsch'); } catch (e) { /* ohne Klang */ }
      zeigeMeldung('falsch', D('falsch'));
      d.reihe.push('r'); zeichneReihe();
      spaeter(() => setzeRaetsel(d.st.raetsel), 420);
      return false;
    }, (e) => {
      if (weg || d.id !== id) return false;
      d.wartet = false;
      if (e && e.kennung === 'DUELL_ZEIT_UM') { brett.erlaubeZuege(null); zeigeMeldung('', D('zeit.um')); }
      else { d.schritt = -1; hole(); }
      return false;
    });
  }

  // ---------- Ende ----------
  function zeigeEnde(st) {
    aufraeumen();
    // das Ergebnis ist gezeigt: ein weiteres Neuladen fuehrt zum Start
    vergissLauf(d.id);
    phase('beendet');
    const g = st.gegner || { geloest: 0 };
    const erg = st.ergebnis || 'remis';
    // Ende-Klang nur, wenn das Duell hier gelaufen ist (nicht beim Oeffnen eines alten Duells) und nicht abgebrochen wurde
    if (d.gesehen && st.status === 'beendet') {
      try { klang.ende(erg === 'sieg' ? true : erg === 'niederlage' ? false : null); } catch (e) { /* ohne Klang */ }
    }
    let kronen = D('ende.ohne');
    if (st.art !== 'freundschaft') kronen = st.kronen_delta ? D('ende.kronen', { delta: kronenText(st.kronen_delta) }) : D('ende.keinekronen');
    const gegnerBild = st.art === 'ki' ? kiBild(g.elo) : icon('person');
    const krone = `<span class="rd-krone" aria-hidden="true">${icon('krone')}</span>`;
    rumpf.innerHTML = `<section class="rd-ende" data-ergebnis="${esc(erg)}" aria-live="polite">
        <div class="rd-paar rd-ende-paar">
          <span class="rd-ende-wer" data-sieger="${erg === 'sieg'}">${erg === 'sieg' ? krone : ''}${ichBild()}</span>
          <b class="rd-vs" aria-hidden="true">VS</b>
          <span class="rd-ende-wer" data-sieger="${erg === 'niederlage'}">${erg === 'niederlage' ? krone : ''}<span class="rd-av" aria-hidden="true">${gegnerBild}</span></span>
        </div>
        <h2>${esc(D('ende.' + erg))}</h2>
        <b class="rd-gross zahl" aria-hidden="true">${esc(String(st.ich.geloest))} : ${esc(String(g.geloest))}</b>
        <p class="rd-ende-stand sr">${esc(D('ende.stand', { ich: st.ich.geloest, gegner: g.geloest }))}</p>
        <p class="rd-text rd-kronen">${esc(kronen)}</p>
        ${reiheHtml()}
        <div class="rd-knoepfe"><button type="button" class="rd-los dr rd-nochmal">${esc(D('nochmal'))}</button>
          <button type="button" class="knopf dr rd-fertig">${esc(D('fertig'))}</button></div></section>`;
    rumpf.querySelector('.rd-nochmal').addEventListener('click', () => (st.art === 'freundschaft' ? zeigeStart() : starteSuche()));
    rumpf.querySelector('.rd-fertig').addEventListener('click', () => app.gehe('online'));
    rumpf.querySelector('.rd-nochmal').focus();
    if (tempo() > 0) anim(rumpf.querySelector('.rd-ende'), [{ opacity: 0, transform: 'translateY(16px) scale(.97)' }, { opacity: 1, transform: 'none' }], { d: 420, k: 'weich' });
  }

  // Beim Oeffnen (auch nach dem Neuladen): ein Code-Link tritt bei (der Server gibt einem Teilnehmer sein Duell zurueck);
  // sonst geht ein in diesem Tab laufendes Duell vor, auch vor params.suchen aus dem Verlaufseintrag, das sonst eine neue
  // Suche startete. Kennt der Server das Duell nicht (mehr) oder ist es noch offen, gilt der Start wie bisher; ohne
  // Antwort (offline) bleibt es beim Duell, die Abfrage versucht es weiter.
  const lauf = server.angemeldet() && !(params && params.code) ? ladeLauf() : null;
  // Die Online-Tuer startet ihre Suche genau einmal: danach traegt der Verlaufseintrag kein suchen mehr, sonst startete
  // ein Neuladen nach dem gezeigten Ergebnis (der Lauf ist dann vergessen) eine neue Suche ohne Klick (wie js/ui/lobby.js)
  const suchenVerbraucht = () => {
    try {
      const h = history.state;
      if (!h || !h.schach || h.name !== 'raetsel-duell' || !h.params || !h.params.suchen) return;
      const rest = { ...h.params };
      delete rest.suchen;
      history.replaceState({ ...h, params: rest }, '', location.hash);
    } catch (e) { /* egal */ }
  };
  const oeffne = () => {
    zeigeStart();
    if (params && params.code && server.angemeldet()) tritteBei(params.code);
    else if (params && params.suchen && server.angemeldet()) { suchenVerbraucht(); starteSuche(); }
  };
  if (lauf) {
    (async () => {
      let st;
      try { st = await server.stand(lauf.id); } catch (e) { st = undefined; }
      if (weg) return;
      if (st === undefined || (st && st.status !== 'offen')) starteDuell(lauf.id);
      else { vergissLauf(lauf.id); oeffne(); }
    })();
  } else oeffne();
  return {
    verlasse() {
      weg = true;
      window.removeEventListener('schach:einstellungen', beiEinstellungen);
      if (testHaken && window.__duell === testHaken) delete window.__duell;
      aufraeumen();
      kopf.verlasse();
    },
  };
}
