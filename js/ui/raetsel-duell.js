// Screen "raetsel-duell" (Etappe 5, Paket lobby): zwei Spieler loesen gleichzeitig dieselben Raetsel, fest 3 Minuten.
// Einstieg ist die Karte "Raetsel-Duell" unter "Mehr Spielarten" in der Lobby (nur im Labor, wie die Lobby selbst) und der
// Link #raetsel-duell/CODE (Freundschaft). Der Server entscheidet alles (js/raetsel-duell.js); dieser Screen zeigt nur:
// Start (Regeln, Gegner suchen, Einladung, Code), Warten (Suche, Einladung), Duell (beide Staende live, eigene Uhr nach
// Serverzeit, Brett) und Ende (Wertung, Kronen, Nochmal). params: { code } aus dem Link.
//
//   zeige(root, params, app) -> { verlasse() }
// DOM: section.screen.raetsel-duell[data-phase="start"|"konto"|"suche"|"einladung"|"vorlauf"|"laeuft"|"zeit_um"|"beendet"]
//   > header.haupt-kopf, .rd-rumpf > .rd-start | .rd-warten | .rd-spiel (.rd-leiste > .rd-seite[data-wer="ich"|"gegner"],
//   .rd-uhr; .rd-brettzone .rd-brett; .rd-zeile) | .rd-ende. Optik: css/pakete/raetsel-duell.css.
// Tests: window.__duellKiMs verkuerzt die 10 s bis zum KI-Gegner, window.__duellAbfrageMs die Abfrage (Standard 1 s).
import { Brett, zielKarte } from '../board.js';
import { figurenPfad } from '../figurensatz.js';
import { Chess } from '../../vendor/chess/chess.js';
import { hauptKopf, verbindeKopf } from './seite.js';
import { icon } from './icons.js';
import { klang } from '../sounds.js';
import { anim, tempo } from '../bewegung.js';
import { laborFrei } from '../labor.js';
import { ladeEinstellungen } from '../storage.js';
import { kontoFreigeschaltet } from '../konto.js';
import { t } from '../sprache.js';
import { KONST, versatzAus, restMs, uhrText, phaseAus, anteil, stellungAus, duellLink, kronenText } from '../pakete/lobby/raetsel-duell.js';
import * as server from '../raetsel-duell.js';
import '../pakete/lobby/raetsel-duell-texte.js';
import '../sprachen/allgemein.js';

const D = (k, w) => t('p-duell.' + k, w);
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WURZEL = new URL('../../', import.meta.url);
const testZahl = (n, std) => (typeof window !== 'undefined' && Number.isFinite(window[n]) ? window[n] : std);

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

export function zeige(root, params, app) {
  const s = document.createElement('section');
  s.className = 'screen raetsel-duell';
  s.setAttribute('aria-label', D('name'));
  root.append(s);
  let weg = false;
  if (!laborFrei()) {
    setTimeout(() => { if (!weg) app.gehe('arena', {}, { ersetzen: true }); }, 0);
    return { verlasse() { weg = true; } };
  }
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
  // laufendes Duell
  const d = { id: null, st: null, versatz: 0, chess: null, nr: 0, schritt: -1, wartet: false, meldung: null, abfrage: false };

  const phase = (p) => { s.dataset.phase = p; };
  function aufraeumen() {
    stoppeUhren();
    if (suche) { suche.stopp(); suche = null; }
    if (brett) { try { brett.zerstoere(); } catch (e) { /* egal */ } brett = null; }
  }

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
    rumpf.innerHTML = `<section class="rd-karte rd-regeln" aria-labelledby="rd-regeln-t"><h2 id="rd-regeln-t">${esc(D('regeln.titel'))}</h2>
        <ol class="rd-liste"><li>${esc(D('regeln.1'))}</li><li>${esc(D('regeln.2'))}</li><li>${esc(D('regeln.3'))}</li></ol></section>
      <section class="rd-karte" aria-labelledby="rd-gew-t"><h2 id="rd-gew-t">${esc(D('gewertet.titel'))}</h2><p class="rd-text">${esc(D('gewertet.text'))}</p>
        <button type="button" class="knopf primaer dr rd-suchen">${esc(D('suchen'))}${icon('vor')}</button></section>
      <section class="rd-karte" aria-labelledby="rd-fr-t"><h2 id="rd-fr-t">${esc(D('freund.titel'))}</h2><p class="rd-text">${esc(D('freund.text'))}</p>
        <button type="button" class="knopf dr rd-einladen">${esc(D('einladen'))}</button>
        <form class="rd-code" novalidate><label for="rd-code-feld">${esc(D('code.label'))}</label>
          <div class="rd-code-zeile"><input id="rd-code-feld" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="9"
            inputmode="text" value="${esc(params && params.code ? params.code : '')}">
          <button type="submit" class="knopf dr rd-beitreten">${esc(D('beitreten'))}</button></div></form>
        <p class="rd-fehler" role="alert"${meldung ? '' : ' hidden'}>${esc(meldung || '')}</p></section>`;
    rumpf.querySelector('.rd-suchen').addEventListener('click', starteSuche);
    rumpf.querySelector('.rd-einladen').addEventListener('click', ladeEin);
    rumpf.querySelector('.rd-code').addEventListener('submit', (e) => {
      e.preventDefault();
      tritteBei(rumpf.querySelector('#rd-code-feld').value);
    });
  }
  const startFehler = (e) => { if (!weg) zeigeStart(fehlerText(e)); };

  // ---------- Suche ----------
  function starteSuche() {
    aufraeumen();
    phase('suche');
    rumpf.innerHTML = `<section class="rd-karte rd-warten" aria-live="polite"><div class="rd-radar" aria-hidden="true"><i></i><i></i>${icon('ziel')}</div>
      <h2>${esc(D('suche.titel'))}</h2><p class="rd-text">${esc(D('suche.text'))}</p>
      <button type="button" class="knopf dr rd-abbrechen">${esc(D('abbrechen'))}</button></section>`;
    rumpf.querySelector('.rd-abbrechen').addEventListener('click', () => zeigeStart());
    rumpf.querySelector('.rd-abbrechen').focus();
    suche = server.suche({
      warteMs: testZahl('__duellKiMs', server.KI_ERSATZ_MS),
      beiTreffer: (id) => { suche = null; starteDuell(id); },
      beiKi: (id) => { suche = null; starteDuell(id); },
      beiFehler: (e) => { suche = null; startFehler(e); },
    });
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
  function seiteHtml(wer) {
    return `<div class="rd-seite" data-wer="${wer}"><span class="rd-name"></span>
      <span class="rd-zahlen"><b class="rd-geloest zahl"></b><small class="rd-fehlerzahl"></small></span>
      <span class="rd-balken" aria-hidden="true"><i></i></span></div>`;
  }

  function starteDuell(id) {
    aufraeumen();
    Object.assign(d, { id, st: null, versatz: 0, chess: null, nr: 0, schritt: -1, wartet: false, meldung: null, abfrage: false, gesehen: false });
    phase('vorlauf');
    rumpf.innerHTML = `<div class="rd-spiel">
        <div class="rd-leiste">${seiteHtml('ich')}<div class="rd-uhr zahl" role="timer" aria-live="off">${uhrText(KONST.DAUER_S * 1000)}</div>${seiteHtml('gegner')}</div>
        <div class="rd-brettzone"><div class="brett-rahmen rd-rahmen"><div class="rd-brett" aria-label="${esc(D('brett'))}"></div></div></div>
        <p class="rd-zeile" role="status"><span class="rd-nr"></span><span class="rd-amzug"></span><span class="rd-meldung"></span></p>
      </div>`;
    brett = new Brett(rumpf.querySelector('.rd-brett'), {
      ausrichtung: 'w', figurenPfad: new URL(figurenPfad(einst), WURZEL).href, beiZug, koordinaten: einst.koordinaten !== false, autoDame: einst.autoDame !== false,
    });
    hole();
    tick();
  }

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
    const rest = p === 'vorlauf' ? KONST.DAUER_S * 1000 - d.st.ich.fehler * KONST.STRAFE_S * 1000 : restMs(d.st.ich.ende_am, d.versatz, Date.now());
    uhr.textContent = uhrText(rest);
    uhr.setAttribute('aria-label', D('uhr.aria', { zeit: uhrText(rest) }));
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
      el.querySelector('.rd-geloest').textContent = D('geloest', { n: x.geloest });
      el.querySelector('.rd-fehlerzahl').textContent = D('fehler', { n: x.fehler });
      el.querySelector('.rd-balken > i').style.transform = `scaleX(${anteil(x.geloest, wer === 'ich' ? g.geloest : st.ich.geloest)})`;
    };
    seite('ich', st.ich, D('du'));
    const gName = st.art === 'ki' ? (Number.isInteger(g.elo) ? D('ki.elo', { elo: g.elo }) : D('ki')) : st.art === 'freundschaft' ? D('freund') : D('gegner');
    seite('gegner', g, gName);
    rumpf.querySelector('.rd-seite[data-wer="gegner"]').dataset.ki = st.art === 'ki' ? 'ja' : 'nein';
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
        try { klang.spiele(r.fertig ? 'raetsel-richtig' : 'zug'); } catch (e) { /* ohne Klang */ }
        zeigeMeldung('richtig', r.fertig ? D('richtig') : D('weiter'));
        // die Antwort des Gegners bzw. das naechste Raetsel kurz nach dem eigenen Zug. Ohne neu: hat die Abfrage die
        // Stellung schon gesetzt, bliebe sonst eine Auswahl nicht stehen, die schnell danach getippt wurde
        spaeter(() => setzeRaetsel(d.st.raetsel), r.fertig ? 380 : 260);
        return true;
      }
      try { klang.spiele('raetsel-falsch'); } catch (e) { /* ohne Klang */ }
      zeigeMeldung('falsch', D('falsch'));
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
    rumpf.innerHTML = `<section class="rd-karte rd-ende" data-ergebnis="${esc(erg)}" aria-live="polite">
        <span class="rd-ende-symbol" aria-hidden="true">${icon(erg === 'sieg' ? 'krone' : erg === 'remis' ? 'haken' : 'ziel')}</span>
        <h2>${esc(D('ende.' + erg))}</h2>
        <p class="rd-ende-stand zahl">${esc(D('ende.stand', { ich: st.ich.geloest, gegner: g.geloest }))}</p>
        <p class="rd-text">${esc(kronen)}</p>
        <div class="rd-knoepfe"><button type="button" class="knopf primaer dr rd-nochmal">${esc(D('nochmal'))}</button>
          <button type="button" class="knopf dr rd-lobby">${esc(D('lobby'))}</button></div></section>`;
    rumpf.querySelector('.rd-nochmal').addEventListener('click', () => (st.art === 'freundschaft' ? zeigeStart() : starteSuche()));
    rumpf.querySelector('.rd-lobby').addEventListener('click', () => app.gehe('lobby'));
    rumpf.querySelector('.rd-nochmal').focus();
    if (tempo() > 0) anim(rumpf.querySelector('.rd-ende'), [{ opacity: 0, transform: 'translateY(16px) scale(.97)' }, { opacity: 1, transform: 'none' }], { d: 420, k: 'weich' });
  }

  zeigeStart();
  if (params && params.code && server.angemeldet()) tritteBei(params.code);
  return {
    verlasse() {
      weg = true;
      aufraeumen();
      kopf.verlasse();
    },
  };
}
