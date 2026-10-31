// Screen "lektion" (Paket lernen, Meisterschule): eine Lektion aus einem Bereich (Mattbilder, Endspiele). Flo spielt
// Weiss, die Engine spielt die Gegenseite mit bestem Spiel (app.engine('bewertung'), volle Staerke). Ob das Ziel der
// Lektion erreicht ist (Matt, neue Dame, Gewinn, Halten), entscheidet pruefeZiel in js/pakete/lernen/mattbilder.js, dort
// auch Sterne und Grenze. Nur im Labor (js/labor.js laborFrei), sonst still zur Arena.
//
//   zeige(root, params, app) -> { verlasse() }      params { id }  (unbekannte id: zur Uebersicht "lernen")
//   zustand() -> { offen, id, phase, zuege, hinweise, sterne, grund, fen }   (Tests; mit ?test auch window.__lektion)
//
// Zugfolge (art 'folge', Eroeffnungen): Flo spielt seine Seite (l.farbe, Brett passend gedreht), der Computer antwortet mit
// dem naechsten Zug der Folge, ohne Engine. Ein anderer Zug springt zurueck und wird gezaehlt (fehler); beim zweiten
// Fehler am selben Zug zeigt ein Pfeil den Zug der Eroeffnung. Nach jedem richtigen Zug sagt ein Satz, warum man ihn
// spielt (zug.<id>.<k>). Geschafft am Ende der Folge, Sterne nach Fehlern und Hinweisen (sterneFolge).
// Zwei Wege (Flo 31.10.2026: "bei den Eroeffnungen muss man immer auf Hinweis klicken?"): "Zeig sie mir" (modus 'zeigen')
// zeigt vor jedem eigenen Zug Pfeil und Grund, Flo zieht nach; am Ende ein Stern (gelernt) und "Ohne Hilfe spielen".
// "Selbst spielen" (modus 'selbst', Knopf data-a="los") ist der Pruefweg ohne Pfeile, bis zu drei Sterne. Vorgewaehlt ist
// "Zeig sie mir", solange die Lektion noch keinen Stern hat.
// Ablauf: phase 'intro' (Idee in zwei, drei Saetzen, Knopf "Los geht's", Brett still) -> 'flo' (Flo zieht) -> 'gegner'
// (Engine antwortet) -> ... -> 'ende' (geschafft: Sterne, gespeichert im Modul lernen, Ereignis lektion:beendet mit id
// '<bereich>-<id>'; sonst ein Grund: patt, remis, zuViele, matt, verloren, bauerWeg). "Hinweis" zeigt den besten Zug
// als Pfeil (danach hoechstens 2 Sterne), "Neu
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
import { lektion, sterne, sterneFolge, grenze, merke, artVon, bereichVon, bilanz, pruefeZiel, stand } from '../pakete/lernen/mattbilder.js';
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
  const ber = bereichVon(l);
  const art = artVon(l);
  const nr = ber.lektionen.indexOf(l) + 1;
  const naechste = ber.lektionen[nr] || null;
  const folge = art === 'folge';
  const flo = folge && l.farbe === 'b' ? 'b' : 'w';
  const zielText = folge ? S('zielFolge', { n: l.ziel }) : art === 'umwandeln' ? S('zielUmwandeln', { n: l.ziel }) : art === 'gewinnen' ? S('zielGewinnen', { n: l.ziel })
    : art === 'taktik' ? S('zielTaktik', { n: l.ziel, p: l.gewinn })
    : art === 'halten' ? S('zielHalten', { n: l.ziel }) : l.ziel === 1 ? S('zielEins') : S('ziel', { n: l.ziel });
  const titel = S('titel.' + l.id);
  const einst = (() => { try { return typeof app.einstellungen === 'function' ? app.einstellungen() : ladeEinstellungen(); } catch (e) { return {}; } })();
  s.setAttribute('aria-label', titel);
  s.innerHTML = `${hauptKopf({ titel: S('name'), unter: S('bereich.' + ber.id), zurueck: true, chips: '', marke: false })}
    <div class="ls-rumpf">
      <div class="ls-inhalt">
        <div class="ls-brettzone"><div class="brett-rahmen ls-rahmen"><div class="ls-brett" aria-label="${esc(titel)}"></div></div></div>
        <div class="ls-seite">
          <div class="ls-status">
            <div class="ls-zeile"><span class="ms-marken"><span class="ms-stufe" data-stufe="${l.stufe}">${esc(S('stufe.' + l.stufe))}</span>${art !== 'matt'
              ? `<span class="ms-art" data-art="${art}">${esc(S('art.' + art))}</span>` : ''}</span>
              <span class="ls-nr">${esc(S('lektionNr', { nr, gesamt: ber.lektionen.length }))}</span></div>
            <h2>${esc(titel)}</h2>
            <p class="ls-idee">${esc(S('idee.' + l.id))}</p>
            <div class="ls-zaehler"><b class="ls-zug zahl"></b><span>${esc(zielText)}</span></div>
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
  const st = { phase: 'intro', chess: new Chess(l.fen), zuege: 0, hinweise: 0, sterne: 0, grund: null, lauf: 0, start: null,
    schritt: 0, fehler: 0, fehlerHier: 0, modus: 'selbst' };
  aktiv = () => ({ offen: true, id: l.id, phase: st.phase, zuege: st.zuege, hinweise: st.hinweise, sterne: st.sterne, grund: st.grund,
    fen: st.chess.fen(), schritt: st.schritt, fehler: st.fehler, modus: st.modus });

  const brett = new Brett($('.ls-brett'), {
    ausrichtung: flo, figurenPfad: new URL(figurenPfad(einst), WURZEL).href, beiZug,
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
    ...(st.modus === 'zeigen' ? [] : [{ a: 'hinweis', text: S('hinweis'), icon: 'hinweis', aus: st.phase !== 'flo' }]),
    { a: 'neu', text: S('neu'), icon: 'nochmal' },
  ]);
  // schon ein Stern fuer diese Lektion? Dann ist "Selbst spielen" vorgewaehlt, sonst "Zeig sie mir"
  const gelernt = () => { try { return !!stand(ladeModul(PAKET, {})).lek[l.id]; } catch (e) { return false; } };

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

  function starte({ intro = false, modus = 'selbst' } = {}) {
    st.lauf++;
    st.modus = folge && modus === 'zeigen' ? 'zeigen' : 'selbst';
    st.chess = new Chess(l.fen);
    st.start = bilanz(st.chess);
    st.zuege = 0;
    st.hinweise = 0;
    st.sterne = 0;
    st.grund = null;
    st.schritt = 0;
    st.fehler = 0;
    st.fehlerHier = 0;
    st.phase = intro ? 'intro' : 'flo';
    s.dataset.phase = st.phase;
    brett.pfeile([]);
    brett.markiere(null);
    zeichne(null);
    zaehler();
    leiseMeldung();
    if (intro && folge) {
      const g = gelernt();
      knoepfe([{ a: 'zeigen', text: S('folge.zeigen'), icon: 'hinweis', primaer: !g }, { a: 'los', text: S('folge.selbst'), primaer: g, vor: true }]);
    } else if (intro) knoepfe([{ a: 'los', text: S('los'), primaer: true, vor: true }]);
    else spielKnoepfe();
    // Zugfolge mit Schwarz: der Computer eroeffnet mit dem ersten Zug der Folge
    if (folge && !intro && st.chess.turn() !== flo) {
      st.phase = 'gegner';
      s.dataset.phase = st.phase;
      spielKnoepfe();
      const lauf = st.lauf;
      spaeter(() => { if (lauf === st.lauf) folgeGegner(); }, 450);
    }
    erlaube();
    zeigeZug();
  }

  // ---------- Zugfolge (Eroeffnungen) ----------
  const ohneZeichen = (san) => String(san || '').replace(/[+#]$/, '');
  // der erwartete Zug der Folge als { from, to } (fuer Pfeil und Erklaerung)
  function erwartet() {
    const san = l.folge[st.schritt];
    if (!san) return null;
    try { const c = new Chess(st.chess.fen()); const m = c.move(san); return m ? { von: m.from, nach: m.to, san: m.san } : null; } catch (e) { return null; }
  }
  // Zug in deutscher Kurzschrift fuer die Anzeige (Springer S, Laeufer L, Turm T, Dame D, Koenig K)
  const sanDe = (san) => String(san || '').replace(/[NBRQK]/g, (x) => (S('figur.' + x) || x));
  // "Zeig sie mir": vor Flos Zug Pfeil und Grund des naechsten Zugs der Eroeffnung
  function zeigeZug() {
    if (!folge || st.modus !== 'zeigen' || st.phase !== 'flo') return;
    const e = erwartet();
    if (!e) return;
    brett.pfeile([{ von: e.von, nach: e.nach, farbe: 'bester' }]);
    meldung('zeigen', S('folge.spiele', { zug: sanDe(e.san) }), S(`zug.${l.id}.${st.zuege}`), `<span class="ls-symbol">${icon('hinweis')}</span>`);
  }
  function folgeFloZug(von, nach, umw) {
    let m = null;
    try { m = st.chess.move({ from: von, to: nach, promotion: umw || 'q' }); } catch (e) { m = null; }
    if (!m) return false;
    if (ohneZeichen(m.san) !== ohneZeichen(l.folge[st.schritt])) {
      // nicht der Zug dieser Eroeffnung: zuruecknehmen, zaehlen, erklaeren (beim zweiten Mal mit Pfeil)
      st.chess.undo();
      st.fehler++;
      st.fehlerHier++;
      spielKlang('raetsel-falsch');
      const e = erwartet();
      if (st.modus === 'zeigen' && e) {
        brett.pfeile([{ von: e.von, nach: e.nach, farbe: 'bester' }]);
        meldung('fehler', S('folge.pfeil', { zug: sanDe(e.san) }), S('folge.pfeilText'), `<span class="ls-symbol">${icon('kreuz')}</span>`);
      } else if (st.fehlerHier >= 2 && e) {
        brett.pfeile([{ von: e.von, nach: e.nach, farbe: 'bester' }]);
        meldung('hinweis', S('folge.zeig', { zug: sanDe(e.san) }), S('folge.zeigText'), `<span class="ls-symbol">${icon('hinweis')}</span>`);
      } else meldung('fehler', S('folge.anders'), S('folge.andersText'), `<span class="ls-symbol">${icon('kreuz')}</span>`);
      return false;
    }
    st.zuege++;
    st.schritt++;
    st.fehlerHier = 0;
    st.phase = 'gezogen';
    const k = st.zuege - 1;
    spaeter(() => {
      brett.pfeile([]);
      zeichne(m);
      zugKlang(m);
      zaehler();
      // warum dieser Zug (eigener Satz je Zug der Eroeffnung); bei "Zeig sie mir" stand er schon vor dem Zug da
      if (st.modus !== 'zeigen') meldung('info', sanDe(m.san), S(`zug.${l.id}.${k}`));
      if (st.schritt >= l.folge.length) { geschafft(); return; }
      st.phase = 'gegner';
      s.dataset.phase = st.phase;
      erlaube();
      spielKnoepfe();
      const lauf = st.lauf;
      spaeter(() => { if (lauf === st.lauf) folgeGegner(); }, 650);
    }, 0);
    return true;
  }
  function folgeGegner() {
    if (weg || st.phase === 'ende') return;
    let m = null;
    try { m = st.chess.move(l.folge[st.schritt]); } catch (e) { m = null; }
    if (!m) return;
    st.schritt++;
    zeichne(m, tempo() > 0);
    zugKlang(m);
    st.phase = 'flo';
    s.dataset.phase = st.phase;
    erlaube();
    spielKnoepfe();
    zeigeZug();
  }

  // Zug von Flo (Brett): true = angenommen
  function beiZug(von, nach, umw) {
    if (weg || st.phase !== 'flo') return false;
    if (folge) return folgeFloZug(von, nach, umw);
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
    const r = pruefeZiel(l, st.start, st.chess, { wann: 'flo', zuege: st.zuege });
    if (r === 'geschafft') { geschafft(); return; }
    if (r) { gescheitert(r); return; }
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
    const r = pruefeZiel(l, st.start, st.chess, { wann: 'gegner', zuege: st.zuege });
    if (r === 'geschafft') { geschafft(); return; }
    if (r) { gescheitert(r); return; }
    st.phase = 'flo';
    s.dataset.phase = st.phase;
    erlaube();
    spielKnoepfe();
  }

  async function hinweis() {
    if (st.phase !== 'flo') return;
    if (folge) {
      const e = erwartet();
      st.hinweise++;
      if (e) brett.pfeile([{ von: e.von, nach: e.nach, farbe: 'bester' }]);
      meldung('hinweis', S('folge.zeig', { zug: sanDe(e ? e.san : '') }), S('hinweisSterne'), `<span class="ls-symbol">${icon('hinweis')}</span>`);
      return;
    }
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
    // Halten: geschafft ist geschafft, Sterne nur nach Hinweisen
    const gezeigt = folge && st.modus === 'zeigen';
    st.sterne = gezeigt ? 1 : folge ? sterneFolge({ fehler: st.fehler, hinweise: st.hinweise })
      : sterne({ ziel: l.ziel, zuege: art === 'halten' ? Math.min(st.zuege, l.ziel) : st.zuege, hinweise: st.hinweise });
    erlaube();
    try { speichereModul(PAKET, merke(ladeModul(PAKET, {}), l.id, { sterne: st.sterne, zuege: st.zuege })); } catch (e) { console.error(e); }
    try {
      sende('lektion:beendet', { id: ber.id + '-' + l.id, ringe: { gelernt: true, sicher: st.sterne >= 2, gemeistert: st.sterne >= 3 } });
    } catch (e) { console.error(e); }
    spielKlang('raetsel-richtig');
    const matt = st.chess.isCheckmate();
    const kopfText = gezeigt ? S('geschafft.gezeigt') : folge ? S('geschafft.folge') : matt || art === 'matt' ? S('geschafft') : S('geschafft.' + art);
    const text = gezeigt ? S('geschafftText.gezeigt') : folge ? (st.fehler === 0 ? S('geschafftText.folge0') : st.fehler === 1 ? S('geschafftText.folge1') : S('geschafftText.folge', { n: st.fehler }))
      : art === 'halten' ? S('geschafftText.halten')
      : !(matt || art === 'matt') ? S('geschafftText.' + art, { n: st.zuege, ziel: l.ziel })
        : st.zuege === 1 ? S('geschafftEins') : S('geschafftText', { n: st.zuege, ziel: l.ziel });
    meldung('geschafft', kopfText, text, sterneHtml(st.sterne));
    if (tempo() > 0) staffel(meldungEl.querySelectorAll('.ms-sterne > i.an'), { d: 460, v: 120, abstand: 110, von: 'scale(0) rotate(-30deg)', k: 'hupf' });
    knoepfe(gezeigt ? [
      { a: 'los', text: S('folge.ohneHilfe'), primaer: true, vor: true },
      { a: 'zeigen', text: S('folge.nochmalZeigen'), icon: 'nochmal' },
      { a: 'uebersicht', text: S('uebersicht') },
    ] : [
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
    else if (a === 'zeigen') starte({ modus: 'zeigen' });
    else if (a === 'hinweis') hinweis().catch((f) => console.error(f));
    else if (a === 'neu' || a === 'nochmal') starte({ modus: st.modus });
    else if (a === 'weiter' && naechste) app.gehe('lektion', { id: naechste.id }, { ersetzen: true });
    else if (a === 'uebersicht') app.gehe('lernen', { bereich: ber.id }, { ersetzen: true });
  });

  starte({ intro: true });
  if (tempo() > 0) {
    kopfEintritt(s);
    anim($('.ls-brettzone'), [{ opacity: 0, transform: 'translateY(24px) scale(.98)' }, { opacity: 1, transform: 'none' }], { d: 640, k: 'weich' });
    staffel(s.querySelectorAll('.ls-seite > *:not([hidden])'), { d: 560, v: 90, abstand: 60 });
  }
  // Engine schon jetzt starten, damit der erste Gegenzug nicht auf den Start wartet (Zugfolge braucht keine)
  if (!folge && !(app.test && typeof window !== 'undefined' && window.__test && window.__test.lektionZug)) {
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
