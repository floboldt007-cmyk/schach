// Screen "lektion" (Paket lernen, Meisterschule): eine Mattbild-Lektion. Flo setzt matt, die Engine verteidigt mit
// bestem Spiel (app.engine('bewertung'), volle Staerke). Gezaehlt werden Flos Zuege bis zum Matt; die Sterne rechnet
// js/pakete/lernen/mattbilder.js (sterne, grenze). Nur im Labor (js/labor.js laborFrei), sonst still zur Arena.
//
//   zeige(root, params, app) -> { verlasse() }      params { id }  (unbekannte id: zur Uebersicht "lernen")
//   zustand() -> { offen, id, phase, zuege, hinweise, sterne, grund, fen }   (Tests; mit ?test auch window.__lektion)
//
// Ablauf: phase 'intro' (Idee in zwei, drei Saetzen, Knopf "Los geht's", Brett still) -> 'flo' (Flo zieht) -> 'gegner'
// (Engine antwortet) -> ... -> 'ende' (Matt: Sterne, gespeichert im Modul lernen, Ereignis lektion:beendet; sonst ein
// Grund: patt, remis, zuViele, matt). "Hinweis" zeigt den besten Zug als Pfeil (danach hoechstens 2 Sterne), "Neu
// starten" stellt die Ausgangsstellung wieder her. Im Testmodus liefert window.__test.lektionZug(fen) -> uci die Zuege
// der Engine (Verteidigung und Hinweis), damit Tests ohne Stockfish laufen.
// DOM: section.screen.ls-screen > header.haupt-kopf, .ls-rumpf > .ls-inhalt (.ls-brettzone > .brett-rahmen.ls-rahmen >
// .ls-brett; .ls-seite > .ls-status, .ls-meldung[data-art], .ls-aktionen). Optik: css/pakete/lernen.css.
import { Brett, zielKarte } from '../board.js';
import { figurenPfad } from '../figurensatz.js';
import { Chess } from '../../vendor/chess/chess.js';
import { hauptKopf, verbindeKopf, kopfEintritt } from './seite.js';
import { icon } from './icons.js';
import { klang } from '../sounds.js';
import { anim, staffel, tempo, takt } from '../bewegung.js';
import { ladeEinstellungen, ladeModul, speichereModul } from '../storage.js';
import { sende } from '../ereignisse.js';
import { laborFrei } from '../labor.js';
import { t } from '../sprache.js';
import { LEKTIONEN, lektion, sterne, grenze, merke } from '../pakete/lernen/mattbilder.js';
import { ladeLernenCss, PAKET } from '../pakete/lernen/index.js';
import { sterneHtml } from './lernen.js';
import '../sprachen/allgemein.js';
import '../sprachen/rahmen.js';

const S = (k, w) => t('p-lernen.' + k, w);
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WURZEL = new URL('../../', import.meta.url);
const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
// Bedenkzeit der Engine: Verteidigung kurz (Flo soll nicht warten), Hinweis etwas laenger
const ZEIT_GEGNER = 450;
const ZEIT_HINWEIS = 900;
const spielKlang = (name) => { try { klang.spiele(name); } catch (e) { /* Klang ist nie wichtig genug fuer einen Fehler */ } };

let aktiv = null;
export function zustand() {
  return aktiv ? aktiv() : { offen: false };
}
if (typeof window !== 'undefined' && typeof location !== 'undefined' && /[?&]test\b/.test(location.search || '')) window.__lektion = { zustand };

export function zeige(root, params, app) {
  const s = document.createElement('section');
  s.className = 'screen ls-screen';
  root.append(s);
  const l = lektion(params && params.id);
  if (!laborFrei() || !l) {
    let weg = false;
    setTimeout(() => { if (!weg) app.gehe(laborFrei() ? 'lernen' : 'arena', {}, { ersetzen: true }); }, 0);
    return { verlasse() { weg = true; } };
  }
  ladeLernenCss();
  const nr = LEKTIONEN.indexOf(l) + 1;
  const naechste = LEKTIONEN[nr] || null;
  const titel = S('titel.' + l.id);
  const einst = (() => { try { return typeof app.einstellungen === 'function' ? app.einstellungen() : ladeEinstellungen(); } catch (e) { return {}; } })();
  s.setAttribute('aria-label', titel);
  s.innerHTML = `${hauptKopf({ titel: S('name'), unter: S('bereich'), zurueck: true, chips: '', marke: false })}
    <div class="ls-rumpf">
      <div class="ls-inhalt">
        <div class="ls-brettzone"><div class="brett-rahmen ls-rahmen"><div class="ls-brett" aria-label="${esc(titel)}"></div></div></div>
        <div class="ls-seite">
          <div class="ls-status">
            <div class="ls-zeile"><span class="ms-stufe" data-stufe="${l.stufe}">${esc(S('stufe.' + l.stufe))}</span>
              <span class="ls-nr">${esc(S('lektionNr', { nr, gesamt: LEKTIONEN.length }))}</span></div>
            <h2>${esc(titel)}</h2>
            <p class="ls-idee">${esc(S('idee.' + l.id))}</p>
            <div class="ls-zaehler"><b class="ls-zug zahl"></b><span>${esc(l.ziel === 1 ? S('zielEins') : S('ziel', { n: l.ziel }))}</span></div>
          </div>
          <div class="ls-meldung" role="status" hidden></div>
          <div class="ls-aktionen"></div>
        </div>
      </div>
    </div>`;
  const $ = (sel) => s.querySelector(sel);
  const meldungEl = $('.ls-meldung');
  const aktionenEl = $('.ls-aktionen');
  const zugEl = $('.ls-zug');
  const kopf = verbindeKopf(s, app, { beiZurueck: () => app.zurueck(), beiEinstellungen: () => app.gehe('einstellungen') });

  let weg = false;
  const timer = new Set();
  const spaeter = (fn, ms) => {
    const id = setTimeout(() => { timer.delete(id); if (!weg) fn(); }, Math.max(0, ms));
    timer.add(id);
  };
  const st = { phase: 'intro', chess: new Chess(l.fen), zuege: 0, hinweise: 0, sterne: 0, grund: null, lauf: 0 };
  aktiv = () => ({ offen: true, id: l.id, phase: st.phase, zuege: st.zuege, hinweise: st.hinweise, sterne: st.sterne, grund: st.grund,
    fen: st.chess.fen() });

  const brett = new Brett($('.ls-brett'), {
    ausrichtung: 'w', figurenPfad: new URL(figurenPfad(einst), WURZEL).href, beiZug,
    koordinaten: einst.koordinaten !== false, autoDame: einst.autoDame !== false,
  });
  const schach = () => (st.chess.inCheck() ? true : null);
  const zeichne = (m, animieren = false) => brett.setzeStellung(st.chess.fen(), { animieren, letzterZug: m ? [m.from, m.to] : null, schach: schach() });
  const erlaube = () => brett.erlaubeZuege(st.phase === 'flo' ? zielKarte(st.chess) : null);
  const zaehler = () => { zugEl.textContent = S('zug', { n: st.zuege }); };

  function knoepfe(liste) {
    aktionenEl.innerHTML = liste.map((k) => `<button class="knopf dr${k.primaer ? ' primaer' : ''}" type="button" data-a="${k.a}"${k.aus ? ' disabled' : ''}>`
      + `${k.icon ? icon(k.icon) : ''}${esc(k.text)}${k.vor ? icon('vor') : ''}</button>`).join('');
  }
  const spielKnoepfe = () => knoepfe([
    { a: 'hinweis', text: S('hinweis'), icon: 'hinweis', aus: st.phase !== 'flo' },
    { a: 'neu', text: S('neu'), icon: 'nochmal' },
  ]);

  function meldung(art, kopfText, text = '', extra = '') {
    meldungEl.hidden = false;
    meldungEl.dataset.art = art;
    meldungEl.innerHTML = `${extra}<div><b></b><span></span></div>`;
    meldungEl.querySelector(':scope > div > b').textContent = kopfText;
    const sp = meldungEl.querySelector(':scope > div > span');
    sp.textContent = text;
    sp.hidden = !text;
    if (tempo() > 0) anim(meldungEl, [{ opacity: 0, transform: 'translateY(10px) scale(.97)' }, { opacity: 1, transform: 'none' }], { d: 520, k: 'weich' });
  }
  const leiseMeldung = () => { meldungEl.hidden = true; meldungEl.innerHTML = ''; };

  function zugKlang(m) {
    if (st.chess.isCheckmate() || st.chess.inCheck()) spielKlang('schach');
    else if (m && m.captured) spielKlang('schlagen');
    else spielKlang('zug');
  }

  // Engine-Zug fuer die Stellung (Verteidigung oder Hinweis); im Testmodus aus window.__test.lektionZug
  async function engineZug(fen, ms) {
    const test = app.test && typeof window !== 'undefined' && window.__test;
    if (test && typeof test.lektionZug === 'function') {
      await takt(test.lektionPause ?? 120);
      const u = test.lektionZug(fen);
      return typeof u === 'string' && UCI_RE.test(u) ? u : null;
    }
    const e = await app.engine('bewertung');
    const a = await e.analyse(fen, { movetime: ms, prioritaet: 'sofort' });
    return a && typeof a.bestmove === 'string' && UCI_RE.test(a.bestmove) ? a.bestmove : null;
  }

  function starte({ intro = false } = {}) {
    st.lauf++;
    st.chess = new Chess(l.fen);
    st.zuege = 0;
    st.hinweise = 0;
    st.sterne = 0;
    st.grund = null;
    st.phase = intro ? 'intro' : 'flo';
    s.dataset.phase = st.phase;
    brett.pfeile([]);
    brett.markiere(null);
    zeichne(null);
    zaehler();
    leiseMeldung();
    if (intro) knoepfe([{ a: 'los', text: S('los'), primaer: true, vor: true }]);
    else spielKnoepfe();
    erlaube();
  }

  // Zug von Flo (Brett): true = angenommen
  function beiZug(von, nach, umw) {
    if (weg || st.phase !== 'flo') return false;
    let m = null;
    try { m = st.chess.move({ from: von, to: nach, promotion: umw || 'q' }); } catch (e) { m = null; }
    if (!m) return false;
    st.zuege++;
    st.phase = 'gezogen';
    spaeter(() => nachFloZug(m), 0);
    return true;
  }

  function nachFloZug(m) {
    brett.pfeile([]);
    zeichne(m);
    zugKlang(m);
    zaehler();
    if (st.chess.isCheckmate()) { geschafft(); return; }
    if (st.chess.isStalemate()) { gescheitert('patt'); return; }
    if (st.chess.isDraw()) { gescheitert('remis'); return; }
    if (st.zuege >= grenze(l.ziel)) { gescheitert('zuViele'); return; }
    st.phase = 'gegner';
    s.dataset.phase = st.phase;
    erlaube();
    spielKnoepfe();
    meldung('denkt', S('denkt'));
    gegnerZieht().catch((f) => { if (!weg) console.error(f); });
  }

  async function gegnerZieht() {
    const lauf = st.lauf;
    const fen = st.chess.fen();
    let u = null;
    try { u = await engineZug(fen, ZEIT_GEGNER); } catch (e) { u = null; }
    if (weg || lauf !== st.lauf) return;
    let m = null;
    if (u) { try { m = st.chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch (e) { m = null; } }
    // Engine hakt: irgendein legaler Zug, damit die Lektion weitergeht
    if (!m) {
      const alle = st.chess.moves({ verbose: true });
      if (!alle.length) return;
      const z = alle[Math.floor(Math.random() * alle.length)];
      m = st.chess.move({ from: z.from, to: z.to, promotion: z.promotion });
    }
    zeichne(m, tempo() > 0);
    zugKlang(m);
    leiseMeldung();
    if (st.chess.isCheckmate()) { gescheitert('matt'); return; }
    if (st.chess.isStalemate() || st.chess.isDraw()) { gescheitert('remis'); return; }
    st.phase = 'flo';
    s.dataset.phase = st.phase;
    erlaube();
    spielKnoepfe();
  }

  async function hinweis() {
    if (st.phase !== 'flo') return;
    const lauf = st.lauf;
    const fen = st.chess.fen();
    st.hinweise++;
    let u = null;
    try { u = await engineZug(fen, ZEIT_HINWEIS); } catch (e) { u = null; }
    if (weg || lauf !== st.lauf || st.chess.fen() !== fen) return;
    if (u) brett.pfeile([{ von: u.slice(0, 2), nach: u.slice(2, 4), farbe: 'bester' }]);
    meldung('hinweis', S('hinweisDa'), S('hinweisSterne'), `<span class="ls-symbol">${icon('hinweis')}</span>`);
  }

  function geschafft() {
    st.phase = 'ende';
    s.dataset.phase = st.phase;
    st.sterne = sterne({ ziel: l.ziel, zuege: st.zuege, hinweise: st.hinweise });
    erlaube();
    try { speichereModul(PAKET, merke(ladeModul(PAKET, {}), l.id, { sterne: st.sterne, zuege: st.zuege })); } catch (e) { console.error(e); }
    try {
      sende('lektion:beendet', { id: 'matt-' + l.id, ringe: { gelernt: true, sicher: st.sterne >= 2, gemeistert: st.sterne >= 3 } });
    } catch (e) { console.error(e); }
    spielKlang('raetsel-richtig');
    const text = st.zuege === 1 ? S('geschafftEins') : S('geschafftText', { n: st.zuege, ziel: l.ziel });
    meldung('geschafft', S('geschafft'), text, sterneHtml(st.sterne));
    if (tempo() > 0) staffel(meldungEl.querySelectorAll('.ms-sterne > i.an'), { d: 460, v: 120, abstand: 110, von: 'scale(0) rotate(-30deg)', k: 'hupf' });
    knoepfe([
      ...(naechste ? [{ a: 'weiter', text: S('weiter'), primaer: true, vor: true }] : []),
      { a: 'nochmal', text: S('nochmal'), icon: 'nochmal', primaer: !naechste },
      { a: 'uebersicht', text: S('uebersicht') },
    ]);
  }

  function gescheitert(grund) {
    st.phase = 'ende';
    st.grund = grund;
    s.dataset.phase = st.phase;
    erlaube();
    spielKlang('raetsel-falsch');
    meldung('fehler', S('fehler.' + grund), S('fehler.' + grund + 'Text', { n: grenze(l.ziel) }), `<span class="ls-symbol">${icon('kreuz')}</span>`);
    knoepfe([{ a: 'nochmal', text: S('nochmal'), icon: 'nochmal', primaer: true }, { a: 'uebersicht', text: S('uebersicht') }]);
  }

  aktionenEl.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-a]');
    if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'los') starte();
    else if (a === 'hinweis') hinweis().catch((f) => console.error(f));
    else if (a === 'neu' || a === 'nochmal') starte();
    else if (a === 'weiter' && naechste) app.gehe('lektion', { id: naechste.id }, { ersetzen: true });
    else if (a === 'uebersicht') app.gehe('lernen', {}, { ersetzen: true });
  });

  starte({ intro: true });
  if (tempo() > 0) {
    kopfEintritt(s);
    anim($('.ls-brettzone'), [{ opacity: 0, transform: 'translateY(24px) scale(.98)' }, { opacity: 1, transform: 'none' }], { d: 640, k: 'weich' });
    staffel(s.querySelectorAll('.ls-seite > *:not([hidden])'), { d: 560, v: 90, abstand: 60 });
  }
  // Engine schon jetzt starten, damit der erste Gegenzug nicht auf den Start wartet
  if (!(app.test && typeof window !== 'undefined' && window.__test && window.__test.lektionZug)) {
    try { app.engine('bewertung').catch(() => {}); } catch (e) { /* egal */ }
  }

  return {
    verlasse() {
      weg = true;
      aktiv = null;
      for (const id of timer) clearTimeout(id);
      timer.clear();
      try { kopf.verlasse(); } catch (e) { /* egal */ }
      try { brett.zerstoere(); } catch (e) { /* egal */ }
    },
  };
}
