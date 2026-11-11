// Screen "raetsel-duell" (Etappe 5, Paket lobby): zwei Spieler loesen gleichzeitig dieselben Raetsel, fest 3 Minuten.
// Seit Flo 08.11.2026 fuer alle (nicht mehr nur Labor): Einstieg ist die Tuer "Raetsel-Duell" auf der Online-Seite
// (params.suchen startet die gewertete Suche sofort), die Lobby-Karte im Labor und der Link #raetsel-duell/CODE
// (Freundschaft). Der Server entscheidet alles (js/raetsel-duell.js); dieser Screen zeigt nur:
// Start (dunkle Buehne "Kopf an Kopf": beide Avatare, 3:00, drei Kacheln, Gegner suchen; darunter Mit einem Freund),
// Warten (Suche mit sichtbarer Restzeit bis zum KI-Gegner, Einladung), Duell (Avatar, Zahl, Uhr als Ring, Zahl, Avatar;
// darunter das Brett und die Reihe der eigenen Raetsel: gruen geloest, rot Fehler) und Ende (Krone ueber dem Sieger,
// grosser Stand, Kronen-Schild, dieselbe Reihe, Nochmal und Fertig). params: { code } aus dem Link, { suchen }.
//
//   zeige(root, params, app) -> { verlasse() }
// DOM: section.screen.raetsel-duell[data-phase="start"|"konto"|"suche"|"einladung"|"vorlauf"|"laeuft"|"zeit_um"|"beendet"]
//   > header.haupt-kopf, .rd-rumpf > .rd-start (.rd-buehne > .rd-regeln li x3, .rd-suchen; .rd-freund) | .rd-warten
//   | .rd-spiel (.rd-leiste > .rd-seite[data-wer="ich"|"gegner"], .rd-ring > .rd-uhr; .rd-brettzone .rd-brett; .rd-zeile;
//   .rd-reihe) | .rd-ende. Optik: css/pakete/raetsel-duell.css.
// Tests: window.__duellKiMs verkuerzt die 10 s bis zum KI-Gegner, window.__duellAbfrageMs die Abfrage (Standard 1 s).
import { Brett, zielKarte } from '../board.js';
import { figurenPfad } from '../figurensatz.js';
import { Chess } from '../../vendor/chess/chess.js';
import { hauptKopf, verbindeKopf } from './seite.js';
import { icon } from './icons.js';
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
function kiBild(elo) {
  const leiter = BOTS.filter((b) => !b.endgegner && Number.isFinite(Number(b.elo)));
  if (!leiter.length) return '';
  const ziel = Number.isInteger(elo) ? elo : 1200;
  const bot = leiter.reduce((a, b) => (Math.abs(b.elo - ziel) < Math.abs(a.elo - ziel) ? b : a));
  return `<img src="${esc(avatarVon(bot))}" alt="">`;
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
  // laufendes Duell; reihe: eigene Raetsel in Reihenfolge, 'g' geloest, 'r' Fehler (nur dieses Geraet, nur Anzeige)
  const d = { id: null, st: null, versatz: 0, chess: null, nr: 0, schritt: -1, wartet: false, meldung: null, abfrage: false, reihe: [] };

  const phase = (p) => { s.dataset.phase = p; };
  function aufraeumen() {
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
  // Kopf an Kopf: Avatar, Zahl (gross, "gelöst" nur fuer Vorleser), Name und Fehler klein, duenner Balken
  function seiteHtml(wer) {
    const bild = wer === 'ich' ? ichBild() : '<span class="rd-av rd-av-frage" aria-hidden="true">?</span>';
    return `<div class="rd-seite" data-wer="${wer}">${bild}<span class="rd-zahlen"><b class="rd-geloest zahl"></b>
      <span class="rd-name"></span><small class="rd-fehlerzahl"></small></span>
      <span class="rd-balken" aria-hidden="true"><i></i></span></div>`;
  }

  function starteDuell(id) {
    aufraeumen();
    Object.assign(d, { id, st: null, versatz: 0, chess: null, nr: 0, schritt: -1, wartet: false, meldung: null, abfrage: false, reihe: [], gesehen: false });
    phase('vorlauf');
    rumpf.innerHTML = `<div class="rd-spiel">
        <div class="rd-leiste">${seiteHtml('ich')}<div class="rd-ring">${ringSvg('rd-ring-bild')}<span class="rd-uhr zahl" role="timer" aria-live="off">${uhrText(DAUER_MS)}</span></div>${seiteHtml('gegner')}</div>
        <div class="rd-brettzone"><div class="brett-rahmen rd-rahmen"><div class="rd-brett" aria-label="${esc(D('brett'))}"></div></div></div>
        <p class="rd-zeile" role="status"><span class="rd-nr"></span><span class="rd-amzug"></span><span class="rd-meldung"></span></p>
        <div class="rd-reihe-ort">${reiheHtml()}</div>
      </div>`;
    brett = new Brett(rumpf.querySelector('.rd-brett'), {
      ausrichtung: 'w', figurenPfad: new URL(figurenPfad(einst), WURZEL).href, beiZug, koordinaten: einst.koordinaten !== false, autoDame: einst.autoDame !== false,
    });
    hole();
    tick();
  }
  const zeichneReihe = () => { const ort = rumpf.querySelector('.rd-reihe-ort'); if (ort) ort.innerHTML = reiheHtml(); };

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
      // Start-Klang, sobald das Duell zum ersten Mal laeuft (Gegner gefunden, Einladung angenommen), wie vor einer Partie
      if (!d.gesehen) { d.gesehen = true; try { klang.spiele('start'); } catch (e) { /* ohne Klang */ } }
      if (!d.wartet) setzeRaetsel(st.raetsel);
      zeichneLeiste();
    }
    spaeter(hole, testZahl('__duellAbfrageMs', 1000));
  }

  function tick() {
    if (weg || !d.id || !d.st) { if (!weg && d.id) spaeter(tick, 250); return; }
    const p = phaseAus(d.st, d.versatz, Date.now());
    const uhr = rumpf.querySelector('.rd-uhr');
    if (!uhr) return;
    const rest = p === 'vorlauf' ? DAUER_MS - d.st.ich.fehler * KONST.STRAFE_S * 1000 : restMs(d.st.ich.ende_am, d.versatz, Date.now());
    uhr.textContent = uhrText(rest);
    uhr.setAttribute('aria-label', D('uhr.aria', { zeit: uhrText(rest) }));
    const ring = rumpf.querySelector('.rd-ring .rd-ring-rest');
    if (ring) ring.setAttribute('stroke-dashoffset', (RING * (1 - Math.min(1, rest / DAUER_MS))).toFixed(2));
    if (s.dataset.phase !== p) {
      phase(p);
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
      av.classList.remove('rd-av-frage');
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
        <p class="rd-text rd-kronen">${esc(kronen)}</p>
        <p class="rd-ende-stand">${esc(D('ende.stand', { ich: st.ich.geloest, gegner: g.geloest }))}</p>
        ${reiheHtml()}
        <div class="rd-knoepfe"><button type="button" class="rd-los dr rd-nochmal">${esc(D('nochmal'))}</button>
          <button type="button" class="knopf dr rd-fertig">${esc(D('fertig'))}</button></div></section>`;
    rumpf.querySelector('.rd-nochmal').addEventListener('click', () => (st.art === 'freundschaft' ? zeigeStart() : starteSuche()));
    rumpf.querySelector('.rd-fertig').addEventListener('click', () => app.gehe('online'));
    rumpf.querySelector('.rd-nochmal').focus();
    if (tempo() > 0) anim(rumpf.querySelector('.rd-ende'), [{ opacity: 0, transform: 'translateY(16px) scale(.97)' }, { opacity: 1, transform: 'none' }], { d: 420, k: 'weich' });
  }

  zeigeStart();
  if (params && params.code && server.angemeldet()) tritteBei(params.code);
  else if (params && params.suchen && server.angemeldet()) starteSuche();
  return {
    verlasse() {
      weg = true;
      aufraeumen();
      kopf.verlasse();
    },
  };
}
