// Screen "Raetsel" (Welle A, A3): ein generischer Raetsel-Bildschirm. Heute fuer die Fehler-Kartei (Paket kartei),
// spaeter fuer Tagesraetsel, Lernpfad und Einstufungstest. Look A (Entwurf A, Raetsel-Seite), Brett ueber die
// oeffentliche API der Klasse Brett (js/board.js), Regeln mit chess.js, Bewegung aus js/bewegung.js.
//
//   zeige(root, params, app) -> { verlasse() }
//     params = { quelle: '<name>' }                 Aufgaben einer angemeldeten Quelle (registriereRaetselQuelle)
//            | { liste: [Aufgabe], titel, unter }  Aufgaben direkt (nur Daten, z. B. fuer einen Test)
//     Ohne Quelle und ohne Liste (z. B. #raetsel von Hand, oder die Quelle laedt nicht) geht es still zur Arena, wie
//     bei einem fehlenden Paket-Screen. Die Parameter liegen im Browser-Verlauf: Neuladen fragt die Quelle neu.
//   registriereRaetselQuelle(name, quelle) -> abmelden()   name [a-z][a-z0-9-]*
//     quelle = {
//       titel, unter,                     Kopf des Bildschirms (Standard "Raetsel")
//       liste(params) -> [Aufgabe],       beim Oeffnen (und Neuladen) frisch
//       ergebnis(aufgabe, erg) -> { titel?, text?, klang? } | null   nach jeder Aufgabe; erg = { richtig, versuch,
//                                         fehlversuche, loesungGezeigt }  (versuch: 1 = im ersten Versuch geloest;
//                                         Loesung gezeigt: richtig false, versuch = Fehlversuche davor, 0 = ohne
//                                         eigenen Zug. Wer "geuebte" Aufgaben zaehlt, nimmt nur versuch >= 1.)
//       ende(zusammenfassung) -> { titel?, text?, klang?, knoepfe?: [{ text, art, beiKlick(app) }] } | null
//                                         zusammenfassung = { gesamt, geloest, ergebnisse: [{ id, ...erg, rueck }] }
//       leer() -> { titel, text } | null  keine Aufgabe (z. B. Stapel leer)
//     }
//   Aufgabe = { id, fen, loesung: [uci, ...], titel?, text?, hinweis?, erklaerung?, vorZug?, marke?, klasse? }
//     loesung: Flos Zuege und dazwischen die Antworten des Gegners (gerade Stellen Flo, ungerade der Gegner, der
//     automatisch zieht). pruefeAufgabe() prueft jede Aufgabe mit chess.js; ungueltige fallen still weg.
//   pruefeAufgabe(aufgabe) -> Aufgabe | null
//   zustand() -> { offen, quelle, index, gesamt, schritt, fehlversuche, phase, aufgabe, ergebnisse }   (Tests; mit ?test auch
//     als window.__raetsel.zustand())
//
// Ablauf je Aufgabe: Flo zieht. Richtig: der Gegner antwortet (mehrzuegig), am Ende Feder-Haken am Zielfeld, Klang
// "raetsel-richtig", Rueckmeldung der Quelle, Knopf "Weiter". Falsch: die Figur steht kurz auf dem Feld und schnappt
// zurueck (Klang "raetsel-falsch"), der zweite Versuch zeigt die Figur, mit der es losgeht (markiere 'hinweis'), nach
// dem zweiten Fehlversuch ist das Brett still und "Loesung zeigen" wird die Hauptaktion. "Loesung zeigen" (jederzeit)
// zeichnet den Zug als Pfeil (brett.pfeile) und spielt die Loesung vor. Oben der Fortschritt "3 von 7", am Ende eine
// Zusammenfassung. Brett gedreht, wenn Schwarz am Zug ist. Handy und iPad hoch: eine Spalte. Nach dem Loesen (oder der
// gezeigten Loesung) verschwindet "Weiss am Zug" aus der Statuszeile. "Weiter", "Loesung zeigen" und "Fertig" bekommen
// den Fokus (Tastatur); den Rahmen zeigt nur die Tastatur (section[data-eingabe="zeiger"|"tastatur"]).
// DOM: section.screen.rs-screen > header.haupt-kopf, .rs-rumpf > .rs-inhalt (.rs-fortschritt, .rs-brettzone mit
// .brett-rahmen.rs-rahmen > .brett, .rs-seite mit .rs-status, .rs-meldung[data-art], .rs-aktionen) bzw. .rs-ende.
// Optik: css/pakete/raetsel.css (haengt sich selbst als link[data-screen="raetsel"] ein, nur Tokens).
import { Brett, zielKarte } from '../board.js';
import { Chess } from '../../vendor/chess/chess.js';
import { hauptKopf, verbindeKopf, kopfEintritt } from './seite.js';
import { icon } from './icons.js';
import { klang } from '../sounds.js';
import { anim, staffel, tempo, takt } from '../bewegung.js';
import { ladeEinstellungen } from '../storage.js';
import { t } from '../sprache.js';
import '../sprachen/allgemein.js';
import '../sprachen/raetsel.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const NAME_RE = /^[a-z][a-z0-9-]*$/;
const PIECES = new URL('../../assets/pieces/', import.meta.url).href;
const MAX_AUFGABEN = 60;
const PUNKTE_MAX = 20;

const quellen = new Map();
let aktiv = null;

export function registriereRaetselQuelle(name, quelle) {
  if (typeof name !== 'string' || !NAME_RE.test(name)) throw new TypeError('registriereRaetselQuelle: Name ungültig');
  if (!quelle || typeof quelle.liste !== 'function') throw new TypeError('registriereRaetselQuelle: liste() fehlt');
  quellen.set(name, quelle);
  return function abmelden() {
    if (quellen.get(name) === quelle) quellen.delete(name);
  };
}

export function zustand() {
  return aktiv ? aktiv() : { offen: false };
}
// Testmodus (?test): Zustand auch synchron fuer Playwright (waitForFunction wartet nicht auf Promises)
if (typeof window !== 'undefined' && typeof location !== 'undefined' && /[?&]test\b/.test(location.search || '')) window.__raetsel = { zustand };

const kurz = (t, max) => (typeof t === 'string' ? t.slice(0, max) : '');

export function pruefeAufgabe(a) {
  if (!a || typeof a !== 'object' || typeof a.fen !== 'string' || !Array.isArray(a.loesung) || !a.loesung.length || a.loesung.length > 40) return null;
  let c = null;
  try { c = new Chess(a.fen); } catch (e) { return null; }
  for (const u of a.loesung) {
    if (typeof u !== 'string' || !UCI_RE.test(u)) return null;
    let m = null;
    try { m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch (e) { m = null; }
    if (!m) return null;
  }
  const vorZug = typeof a.vorZug === 'string' && UCI_RE.test(a.vorZug) ? a.vorZug : null;
  return {
    id: String(a.id ?? '').slice(0, 80),
    fen: a.fen,
    loesung: a.loesung.slice(),
    titel: kurz(a.titel, 80) || t('raetsel.aufgabeTitel'),
    text: kurz(a.text, 240),
    hinweis: kurz(a.hinweis, 200),
    erklaerung: kurz(a.erklaerung, 240),
    vorZug,
    marke: kurz(a.marke, 40),
    klasse: typeof a.klasse === 'string' && /^[a-z]+$/.test(a.klasse) ? a.klasse : '',
  };
}

function ladeCss() {
  try {
    if (typeof document === 'undefined' || document.querySelector('link[data-screen="raetsel"]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL('../../css/pakete/raetsel.css', import.meta.url).href;
    l.dataset.screen = 'raetsel';
    document.head.append(l);
  } catch (e) { /* ohne eigenes CSS bleibt alles bedienbar */ }
}

const spielKlang = (name, ...a) => { try { klang.spiele(name, ...a); } catch (e) { /* Klang ist nie wichtig genug fuer einen Fehler */ } };

export function zeige(root, params, app) {
  const p = params && typeof params === 'object' ? params : {};
  const quelle = typeof p.quelle === 'string' ? quellen.get(p.quelle) || null : null;
  let roh = null;
  if (quelle) {
    try { roh = quelle.liste(p); } catch (e) { console.error('Rätsel-Quelle ' + p.quelle, e); roh = []; }
  } else if (!p.quelle && Array.isArray(p.liste)) roh = p.liste;

  const s = document.createElement('section');
  s.className = 'screen rs-screen';
  s.setAttribute('aria-label', t('raetsel.titel'));
  root.append(s);

  // nichts zu zeigen: still zur Arena (wie ein Paket-Screen ohne Paket)
  if (roh == null) {
    let weg = false;
    setTimeout(() => { if (!weg) app.gehe('arena', {}, { ersetzen: true }); }, 0);
    return { verlasse() { weg = true; } };
  }

  ladeCss();
  const aufgaben = (Array.isArray(roh) ? roh : []).slice(0, MAX_AUFGABEN).map(pruefeAufgabe).filter(Boolean);
  if (Array.isArray(roh) && aufgaben.length < Math.min(roh.length, MAX_AUFGABEN)) console.warn('Rätsel: ungültige Aufgaben übersprungen');
  const titel = kurz(quelle ? quelle.titel : p.titel, 60) || t('raetsel.titel');
  const unter = kurz(quelle ? quelle.unter : p.unter, 60);
  const einst = (() => { try { return app && typeof app.einstellungen === 'function' ? app.einstellungen() : ladeEinstellungen(); } catch (e) { return {}; } })();

  s.innerHTML = `${hauptKopf({ titel, unter, zurueck: true, chips: '', marke: false })}
    <div class="rs-rumpf">
      <div class="rs-inhalt" hidden>
        <div class="rs-fortschritt" aria-live="polite">
          <span class="rs-zaehler zahl"></span>
          <span class="rs-punkte" aria-hidden="true"></span>
        </div>
        <div class="rs-brettzone"><div class="brett-rahmen rs-rahmen"><div class="rs-brett" aria-label="${t('raetsel.brett')}"></div></div></div>
        <div class="rs-seite">
          <div class="rs-status">
            <div class="rs-statuszeile"><span class="rs-amzug"><i></i><span></span></span><span class="rs-marke" hidden><i></i><span></span></span></div>
            <h2></h2>
            <p></p>
          </div>
          <div class="rs-meldung" role="status" hidden></div>
          <div class="rs-aktionen">
            <button class="knopf dr rs-zeigen" type="button" data-r="zeigen">${icon('auge')}${t('raetsel.zeigen')}</button>
            <button class="knopf primaer dr rs-weiter" type="button" data-r="weiter" hidden>${t('allgemein.weiter')}${icon('vor')}</button>
          </div>
        </div>
      </div>
      <div class="rs-ende" hidden></div>
    </div>`;

  const $ = (sel) => s.querySelector(sel);
  const inhalt = $('.rs-inhalt');
  const endeEl = $('.rs-ende');
  const meldungEl = $('.rs-meldung');
  const zeigenK = $('.rs-zeigen');
  const weiterK = $('.rs-weiter');
  const kopf = verbindeKopf(s, app, { beiZurueck: () => app.zurueck(), beiEinstellungen: () => app.gehe('einstellungen') });

  let weg = false;
  const timer = new Set();
  const spaeter = (fn, ms) => {
    const t = setTimeout(() => { timer.delete(t); if (!weg) fn(); }, Math.max(0, ms));
    timer.add(t);
    return t;
  };
  const taktPause = (ms) => takt(ms).then(() => { if (weg) throw new Error('weg'); });

  const st = {
    i: 0, schritt: 0, fehl: 0, phase: 'start', chess: null, gezeigt: false, ergebnisse: [], striche: null,
  };
  aktiv = () => ({
    offen: true, quelle: quelle ? p.quelle : null, index: st.i, gesamt: aufgaben.length, schritt: st.schritt,
    fehlversuche: st.fehl, phase: st.phase, aufgabe: aufgaben[st.i] ? aufgaben[st.i].id : null,
    ergebnisse: st.ergebnisse.map((e) => ({ ...e })),
  });

  // Fokus-Rahmen nur fuer die Tastatur: Chromium zeigt ihn sonst auch nach einem Mausklick, wenn der Fokus per Skript
  // auf "Weiter" wandert (focus({ focusVisible }) kennt Chromium nicht); css/pakete/raetsel.css liest data-eingabe
  s.addEventListener('pointerdown', () => { s.dataset.eingabe = 'zeiger'; }, true);
  s.addEventListener('keydown', () => { s.dataset.eingabe = 'tastatur'; }, true);

  let brett = null;
  s.addEventListener('click', (e) => {
    const b = e.target.closest('[data-r]');
    if (!b || !s.contains(b) || b.disabled) return;
    const r = b.dataset.r;
    if (r === 'zeigen') zeigeLoesung();
    else if (r === 'weiter') weiter();
    else if (r === 'fertig') app.zurueck();
  });

  // ---------- leer ----------
  if (!aufgaben.length) {
    let l = null;
    try { l = quelle && typeof quelle.leer === 'function' ? quelle.leer() : null; } catch (e) { l = null; }
    zeigeAbschluss({
      art: 'leer', titel: (l && l.titel) || t('raetsel.leerTitel'), text: (l && l.text) || t('raetsel.leerText'),
    });
    return handle();
  }

  // ---------- Brett ----------
  brett = new Brett($('.rs-brett'), {
    ausrichtung: 'w', figurenPfad: PIECES, beiZug, koordinaten: einst.koordinaten !== false, autoDame: einst.autoDame !== false,
  });
  inhalt.hidden = false;
  const zaehlerEl = $('.rs-zaehler');
  const punkteEl = $('.rs-punkte');
  punkteEl.innerHTML = aufgaben.length <= PUNKTE_MAX ? aufgaben.map(() => '<i></i>').join('') : '<b class="rs-balken"><i></i></b>';

  function zeichneFortschritt() {
    zaehlerEl.innerHTML = t('raetsel.fortschritt', { jetzt: `<b>${Math.min(st.i + 1, aufgaben.length)}</b>`, gesamt: `<b>${aufgaben.length}</b>` });
    if (aufgaben.length <= PUNKTE_MAX) {
      [...punkteEl.children].forEach((el, n) => {
        const e = st.ergebnisse[n];
        el.className = e ? (e.richtig && e.versuch === 1 ? 'gut' : 'durch') : n === st.i ? 'jetzt' : '';
      });
    } else {
      const b = punkteEl.querySelector('.rs-balken > i');
      if (b) b.style.transform = `scaleX(${(st.ergebnisse.length / aufgaben.length).toFixed(4)})`;
    }
  }

  function setzeStatus(a) {
    const amZug = st.chess.turn();
    const zug = $('.rs-amzug');
    zug.hidden = false;
    zug.querySelector('i').dataset.farbe = amZug;
    zug.querySelector('span').textContent = amZug === 'w' ? t('allgemein.weissAmZug') : t('allgemein.schwarzAmZug');
    const marke = $('.rs-marke');
    marke.hidden = !a.marke;
    marke.dataset.klasse = a.klasse || '';
    marke.querySelector('span').textContent = a.marke || '';
    $('.rs-status h2').textContent = a.titel;
    const pEl = $('.rs-status p');
    pEl.textContent = a.text || '';
    pEl.hidden = !a.text;
  }

  // nach dem Loesungszug (und nach einem Matt) stimmt "Weiss am Zug" nicht mehr: die Zeile ruht bis zur naechsten Aufgabe
  function statusFertig() {
    $('.rs-amzug').hidden = true;
  }

  function meldung(art, kopfText, text, { symbol = null, feder = false } = {}) {
    meldungEl.hidden = false;
    meldungEl.dataset.art = art;
    const sym = symbol || (art === 'richtig' ? 'haken' : art === 'loesung' ? 'auge' : art === 'hinweis' ? 'hinweis' : 'kreuz');
    meldungEl.innerHTML = `<span class="rs-symbol">${icon(sym)}</span><div><b></b><span></span></div>`;
    meldungEl.querySelector(':scope > div > b').textContent = kopfText;
    const sp = meldungEl.querySelector(':scope > div > span');
    sp.textContent = text || '';
    sp.hidden = !text;
    anim(meldungEl, [{ opacity: 0, transform: 'translateY(10px) scale(.97)' }, { opacity: 1, transform: 'none' }], { d: 520, k: 'weich' });
    if (feder) anim(meldungEl.querySelector('.rs-symbol'), [{ transform: 'scale(0) rotate(-40deg)' }, { transform: 'none' }], { d: 640, v: 60, k: 'hupf' });
  }

  function erlaube() {
    brett.erlaubeZuege(st.phase === 'flo' ? zielKarte(st.chess) : null);
  }

  function schachFeld() {
    return st.chess.inCheck() ? true : null;
  }

  function zugKlang(m) {
    if (st.chess.isCheckmate() || st.chess.inCheck()) spielKlang('schach');
    else if (m && m.captured) spielKlang('schlagen');
    else spielKlang('zug');
  }

  function zeigeAufgabe(i, { erste = false } = {}) {
    const a = aufgaben[i];
    st.i = i;
    st.schritt = 0;
    st.fehl = 0;
    st.gezeigt = false;
    st.chess = new Chess(a.fen);
    if (st.striche) { st.striche.entferne(); st.striche = null; }
    brett.pfeile([]);
    brett.markiere(null);
    brett.setzeAusrichtung(st.chess.turn());
    brett.setzeStellung(a.fen, { animieren: false, letzterZug: a.vorZug ? [a.vorZug.slice(0, 2), a.vorZug.slice(2, 4)] : null, schach: schachFeld() });
    s.dataset.ausrichtung = st.chess.turn();
    setzeStatus(a);
    meldungEl.hidden = true;
    meldungEl.innerHTML = '';
    zeigenK.hidden = false;
    zeigenK.disabled = false;
    zeigenK.classList.remove('primaer');
    weiterK.hidden = true;
    weiterK.innerHTML = `${i + 1 < aufgaben.length ? t('allgemein.weiter') : t('raetsel.zumAbschluss')}${icon('vor')}`;
    st.phase = 'flo';
    erlaube();
    zeichneFortschritt();
    if (!erste && tempo() > 0) {
      anim($('.rs-brettzone'), [{ opacity: 0, transform: 'translateX(36px)' }, { opacity: 1, transform: 'none' }], { d: 520, k: 'gleiten' });
      anim($('.rs-seite'), [{ opacity: 0, transform: 'translateX(24px)' }, { opacity: 1, transform: 'none' }], { d: 520, v: 60, k: 'gleiten' });
    }
  }

  // Zug von Flo (Brett): true = angenommen, Promise<false> = schnappt zurueck
  function beiZug(von, nach, umw) {
    if (weg || st.phase !== 'flo') return false;
    const a = aufgaben[st.i];
    const soll = a.loesung[st.schritt];
    let m = null;
    try { m = st.chess.move({ from: von, to: nach, promotion: umw || 'q' }); } catch (e) { m = null; }
    if (!m) return false;
    const uci = von + nach + (m.promotion || '');
    if (uci === soll) {
      st.schritt++;
      st.phase = 'gezogen';
      spaeter(() => nachRichtigemZug(m), 0);
      return true;
    }
    // falsch: kurz stehen lassen, dann zurueck
    st.chess.undo();
    st.phase = 'falsch';
    st.fehl++;
    return new Promise((r) => spaeter(() => { r(false); spaeter(nachFalschemZug, 40); }, 380 * Math.max(tempo(), 0.35)));
  }

  function nachRichtigemZug(m) {
    const a = aufgaben[st.i];
    brett.markiere(null, 'hinweis');
    brett.setzeStellung(st.chess.fen(), { animieren: false, letzterZug: [m.from, m.to], schach: schachFeld() });
    if (st.schritt >= a.loesung.length) { geloest(m); return; }
    zugKlang(m);
    st.phase = 'gegner';
    erlaube();
    gegnerZieht().catch(() => {});
  }

  async function gegnerZieht() {
    const a = aufgaben[st.i];
    await taktPause(520);
    const u = a.loesung[st.schritt];
    const m = st.chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    st.schritt++;
    brett.setzeStellung(st.chess.fen(), { animieren: true, letzterZug: [m.from, m.to], schach: schachFeld() });
    zugKlang(m);
    if (st.schritt >= a.loesung.length) { geloest(m); return; }
    st.phase = 'flo';
    erlaube();
  }

  function nachFalschemZug() {
    const a = aufgaben[st.i];
    spielKlang('raetsel-falsch');
    const von = a.loesung[st.schritt].slice(0, 2);
    if (st.fehl === 1) {
      brett.markiere([von], 'hinweis');
      meldung('hinweis', t('raetsel.hinweisKopf'), a.hinweis || t('raetsel.hinweisFigur', { feld: von }));
      st.phase = 'flo';
      erlaube();
      return;
    }
    // zweiter Fehlversuch: das Brett ruht, die Loesung ist die naechste Aktion
    st.phase = 'aus';
    erlaube();
    meldung('falsch', t('raetsel.falschKopf'), t('raetsel.falschText'));
    zeigenK.classList.add('primaer');
    try { zeigenK.focus({ preventScroll: true }); } catch (e) { /* egal */ }
  }

  function melde(erg) {
    const a = aufgaben[st.i];
    let rueck = null;
    try { rueck = quelle && typeof quelle.ergebnis === 'function' ? quelle.ergebnis(a, { ...erg }) : null; } catch (e) { console.error('Rätsel-Quelle', e); }
    st.ergebnisse.push({ id: a.id, ...erg, rueck: rueck && typeof rueck === 'object' ? { ...rueck } : null });
    zeichneFortschritt();
    return rueck && typeof rueck === 'object' ? rueck : {};
  }

  function geloest(m) {
    st.phase = 'geloest';
    erlaube();
    statusFertig();
    const rueck = melde({ richtig: true, versuch: st.fehl + 1, fehlversuche: st.fehl, loesungGezeigt: false });
    if (st.striche) st.striche.entferne();
    // Feder-Haken am Zielfeld: das Feld in der Farbe "Praezise", darueber der Haken (federt ueber board.css ein)
    brett.markiere([m.to], 'k-bester');
    st.striche = brett.striche([{ art: 'haken', von: m.to, nach: m.to, farbe: 'bester', breite: 0.11 }], { animieren: tempo() > 0 });
    spielKlang(typeof rueck.klang === 'string' ? rueck.klang : 'raetsel-richtig');
    meldung('richtig', rueck.titel || (st.fehl ? t('raetsel.geloest') : t('raetsel.richtig')), rueck.text || (aufgaben[st.i].erklaerung || ''), { feder: true });
    fertigKnoepfe();
  }

  async function zeigeLoesung() {
    if (!['flo', 'aus'].includes(st.phase) || st.gezeigt) return;
    st.gezeigt = true;
    st.phase = 'zeigt';
    erlaube();
    zeigenK.disabled = true;
    brett.markiere(null, 'hinweis');
    const a = aufgaben[st.i];
    let letzter = null;
    try {
      while (st.schritt < a.loesung.length) {
        const u = a.loesung[st.schritt];
        const floZug = st.schritt % 2 === 0;
        if (floZug) brett.pfeile([{ von: u.slice(0, 2), nach: u.slice(2, 4), farbe: 'bester' }]);
        await taktPause(floZug ? 760 : 420);
        const m = st.chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
        st.schritt++;
        brett.setzeStellung(st.chess.fen(), { animieren: true, letzterZug: [m.from, m.to], schach: schachFeld() });
        zugKlang(m);
        if (floZug) letzter = u;
        if (st.schritt < a.loesung.length) await taktPause(380);
      }
    } catch (e) {
      return;   // Screen verlassen
    }
    // der Pfeil bleibt als Beleg stehen (Flos letzter Zug der Loesung)
    if (letzter) brett.pfeile([{ von: letzter.slice(0, 2), nach: letzter.slice(2, 4), farbe: 'bester' }]);
    st.phase = 'gezeigt';
    statusFertig();
    const rueck = melde({ richtig: false, versuch: st.fehl, fehlversuche: st.fehl, loesungGezeigt: true });
    meldung('loesung', rueck.titel || t('raetsel.soGehtEs'), [a.erklaerung, rueck.text].filter(Boolean).join(' '));
    fertigKnoepfe();
  }

  function fertigKnoepfe() {
    zeigenK.hidden = true;
    weiterK.hidden = false;
    anim(weiterK, [{ opacity: 0, transform: 'translateY(8px) scale(.96)' }, { opacity: 1, transform: 'none' }], { d: 420, k: 'feder' });
    try { weiterK.focus({ preventScroll: true }); } catch (e) { /* egal */ }
  }

  function weiter() {
    if (!['geloest', 'gezeigt'].includes(st.phase)) return;
    spielKlang('wechsel');
    if (st.i + 1 < aufgaben.length) {
      st.phase = 'wechsel';
      if (tempo() > 0) {
        const raus = anim(inhalt, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-28px)' }], { d: 200, k: 'sanft', fill: 'forwards' });
        raus.finished.then(() => { if (weg) return; zeigeAufgabe(st.i + 1); raus.cancel(); }, () => {});
      } else zeigeAufgabe(st.i + 1);
      return;
    }
    ende();
  }

  function ende() {
    st.phase = 'ende';
    erlaube();
    const zus = {
      gesamt: aufgaben.length,
      geloest: st.ergebnisse.filter((e) => e.richtig).length,
      ergebnisse: st.ergebnisse.map((e) => ({ ...e })),
    };
    let e = null;
    try { e = quelle && typeof quelle.ende === 'function' ? quelle.ende(zus) : null; } catch (f) { console.error('Rätsel-Quelle', f); }
    e = e && typeof e === 'object' ? e : {};
    if (typeof e.klang === 'string') spielKlang(e.klang);
    zeigeAbschluss({
      art: 'ende', titel: e.titel || (zus.geloest === zus.gesamt ? t('raetsel.allesGeloest') : t('raetsel.geschafft')),
      text: e.text || '', knoepfe: Array.isArray(e.knoepfe) ? e.knoepfe : [], zahl: zus,
    });
  }

  function zeigeAbschluss({ art, titel: kopfTitel, text, knoepfe = [], zahl = null }) {
    inhalt.hidden = true;
    endeEl.hidden = false;
    endeEl.dataset.art = art;
    const punkte = zahl && zahl.gesamt <= PUNKTE_MAX
      ? `<div class="rs-punkte rs-ende-punkte" aria-hidden="true">${zahl.ergebnisse.map((x) => `<i class="${x.richtig && x.versuch === 1 ? 'gut' : 'durch'}"></i>`).join('')}</div>` : '';
    const eigene = knoepfe.filter((k) => k && typeof k.text === 'string' && typeof k.beiKlick === 'function').slice(0, 2);
    endeEl.innerHTML = `<div class="rs-ende-karte">
        <span class="rs-ende-symbol" data-art="${esc(art)}">${icon(art === 'ende' ? 'haken' : 'ziel')}</span>
        ${art === 'ende' ? `<div class="ueberzeile">${t('raetsel.fertigFuerJetzt')}</div>` : ''}
        <h2 class="disp">${esc(kopfTitel)}</h2>
        ${zahl ? `<div class="rs-ende-zahl zahl"><b>${zahl.geloest}</b> <small>${t('raetsel.vonGeloest', { gesamt: zahl.gesamt })}</small></div>` : ''}
        ${punkte}
        ${text ? `<p>${esc(text)}</p>` : ''}
        <div class="rs-ende-knoepfe">
          ${eigene.map((k, n) => `<button class="knopf dr${k.art === 'primaer' ? ' primaer' : ''}" type="button" data-eigen="${n}">${esc(k.text)}</button>`).join('')}
          <button class="knopf dr${eigene.some((k) => k.art === 'primaer') ? '' : ' primaer'} rs-fertig" type="button" data-r="fertig">${art === 'ende' ? t('allgemein.fertig') : t('allgemein.zurueck')}</button>
        </div>
      </div>`;
    endeEl.querySelectorAll('[data-eigen]').forEach((b) => b.addEventListener('click', () => {
      try { eigene[Number(b.dataset.eigen)].beiKlick(app); } catch (f) { console.error(f); }
    }));
    if (tempo() > 0) {
      const karte = endeEl.querySelector('.rs-ende-karte');
      anim(karte, [{ opacity: 0, transform: 'translateY(26px) scale(.97)' }, { opacity: 1, transform: 'none' }], { d: 620, k: 'weich' });
      anim(endeEl.querySelector('.rs-ende-symbol'), [{ transform: 'scale(0) rotate(-30deg)' }, { transform: 'none' }], { d: 700, v: 160, k: 'hupf' });
      staffel(endeEl.querySelectorAll('.rs-ende-punkte > i'), { d: 420, v: 260, abstand: 50, von: 'scale(0)', k: 'hupf' });
    }
    try { endeEl.querySelector('.rs-fertig').focus({ preventScroll: true }); } catch (f) { /* egal */ }
  }

  zeigeAufgabe(0, { erste: true });
  if (tempo() > 0) {
    kopfEintritt(s);
    anim($('.rs-brettzone'), [{ opacity: 0, transform: 'translateY(24px) scale(.98)' }, { opacity: 1, transform: 'none' }], { d: 640, k: 'weich' });
    staffel(s.querySelectorAll('.rs-fortschritt, .rs-seite > *'), { d: 560, v: 90, abstand: 60 });
  }
  return handle();

  function handle() {
    return {
      verlasse() {
        weg = true;
        aktiv = null;
        for (const t of timer) clearTimeout(t);
        timer.clear();
        try { kopf.verlasse(); } catch (e) { /* egal */ }
        if (brett) { try { brett.zerstoere(); } catch (e) { /* egal */ } }
      },
    };
  }
}
