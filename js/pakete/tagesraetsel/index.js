// Paket "tagesraetsel" (Welle C, S1-5, SPIELKONZEPT 3.6): jeden Tag ein Raetsel, fuer alle dasselbe, Grenze 4:00.
// Eigene Raetsel aus daten/tagesraetsel/raetsel.json (werkzeuge/raetsel-fabrik.mjs, mit Stockfish geprueft, keine
// fremden Raetsel). Montag leicht, jeden Tag schwerer bis Samstag, Sonntag zwei Teile. Regeln in logik.js.
// - Loesen im Raetsel-Bildschirm (js/ui/raetsel.js, Quelle "tagesraetsel"): app.gehe('raetsel', { quelle: 'tagesraetsel' })
//   heute, mit { archiv: 1 } die offenen Raetsel der letzten 30 Tage (zaehlen fuer Funken und Serie, nicht als
//   Tagesraetsel des Tages). Fehlversuche ohne Abzug, keine Uhr.
// - Danach "Ein Wort" (welches Motiv? drei Woerter, nur bei Raetseln mit Motiv) und "Teilen" (Text ohne Link und
//   ohne Loesung: "Crownmate · Rätsel 12 · Dienstag ●●○○○○○").
//
// Orte:       training:karten (5, grosse Karte .t-held mit Mini-Brett), arena:heute (20, Zeile solange heute offen)
// Ereignisse: sendet raetsel:geloest { id, richtig, versuch, quelle: 'tag' | 'archiv', wertung: null } beim ersten
//             Ergebnis je Aufgabe (id = id der Datei, z. B. 'tr-0012'; Wiederholen eines fertigen Tages sendet nichts)
//             sowie raetsel:wort { tag, richtig } nach gespeicherter Wortwahl, hoechstens einmal je Tag.
// Register:   Raetsel-Quelle "tagesraetsel", Inhaltsart "tagesraetsel" (js/inhalte.js), Icon "tagesraetsel"
// Speicher:   Modul "tagesraetsel" (Budget 4.000, logik.js), bei jedem Zugriff frisch gelesen; ein Modul aus einer
//             neueren App (v > RECHENSTAND) wird gelesen, aber nie ueberschrieben.
// Test:       zustand() -> { geladen, heute, td, modul, letzterTeilText, letztesWort }; mit ?test auch window.__tagesraetsel
// Texte:      t('p-tagesraetsel.x') aus texte.js (Englische Version, Teil 2), erst beim Zeichnen; der Teilen-Text auf
//             Englisch "Crownmate · Puzzle 12 · Tuesday ●●○○○○○" (logik.teilText).
// Ein Fehler im Paket stoppt nie die App: jeder Anbieter liefert im Zweifel null.
import { anbieten } from '../../orte.js';
import { sende } from '../../ereignisse.js';
import { ladeModul, speichereModul } from '../../storage.js';
import { ladeInhalt, registriereInhaltsart } from '../../inhalte.js';
import { icon, registriereIcon } from '../../ui/icons.js';
import { miniBrett } from '../../ui/bauteile.js';
import { tagSchluessel } from '../../tag.js';
import { registriereRaetselQuelle } from '../../ui/raetsel.js';
import { t } from '../../sprache.js';
import * as L from './logik.js';
import './texte.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function sicher(fn, wo) {
  try {
    return fn();
  } catch (e) {
    console.error('tagesraetsel: ' + wo, e);
    return null;
  }
}

// ---------- Daten ----------
let daten = null;
let laden = null;
let fehlschlag = 0;
const NEU_VERSUCH_MS = 30000;
const wartende = new Set();
function ladeDaten() {
  if (!laden) {
    laden = ladeInhalt(L.DATEI, { art: L.ART, neu: true }).then((r) => {
      if (r && r.ok) daten = r.daten;
      else {
        console.warn('tagesraetsel: Rätsel nicht geladen', r && r.grund);
        // naechster Versuch beim naechsten Zeichnen (z. B. wieder online)
        laden = null;
        fehlschlag = Date.now();
      }
      for (const f of wartende) sicher(f, 'Nachladen');
      wartende.clear();
      return daten;
    });
  }
  return laden;
}

// Fuer Orte, die oft neu zeichnen (Arena): nach einem Fehlschlag hoechstens alle NEU_VERSUCH_MS ein neuer Versuch
function ladeSpaeter() {
  if (!daten && !laden && Date.now() - fehlschlag >= NEU_VERSUCH_MS) ladeDaten();
}

// ---------- Modul-Speicher ----------
const roh = () => ladeModul(L.MODUL, L.leeresModul());
const schreibbar = (r = roh()) => !(r && Number.isInteger(r.v) && r.v > L.RECHENSTAND);
function sichere(m) {
  if (!schreibbar()) { console.warn('tagesraetsel: Modul aus einer neueren App, es bleibt unverändert'); return false; }
  const r = speichereModul(L.MODUL, { ...m, v: L.RECHENSTAND });
  if (!r || !r.ok) { console.warn('tagesraetsel: Modul nicht gespeichert', r && r.grund); return false; }
  return true;
}

const heute = () => tagSchluessel();
const heuteDaten = (tag = heute()) => (daten ? L.tagDaten(daten, tag) : null);
const stand = (td) => L.tagStand(roh(), td.tag, td.aufgaben.length);
let letzterTeilText = null;
let letztesWort = null;

export function zustand() {
  const td = heuteDaten();
  return {
    geladen: !!daten, heute: heute(), td: td ? JSON.parse(JSON.stringify(td)) : null,
    modul: JSON.parse(JSON.stringify(L.normalisiereModul(roh()))), letzterTeilText, letztesWort: letztesWort ? { ...letztesWort } : null,
  };
}
if (typeof window !== 'undefined' && typeof location !== 'undefined' && /[?&]test\b/.test(location.search || '')) {
  window.__tagesraetsel = { zustand, geladen: () => ladeDaten() };
}

// ---------- Ein Wort und Teilen ----------
async function einWort(app, td) {
  const a = L.motivAufgabe(td);
  const wahl = L.wortWahl(a, td.aufgaben);
  if (!wahl) return;
  const st = stand(td);
  if (st.wort != null) { app.meldung(t('p-tagesraetsel.wort.war', { motiv: L.motivName(a.motiv) })); return; }
  const wert = await app.frage({
    titel: t('p-tagesraetsel.wort.titel'), text: t('p-tagesraetsel.wort.frage'),
    knoepfe: wahl.map((k) => ({ text: L.motivName(k), wert: k })), abbrechen: null,
  });
  if (!wert || !Object.hasOwn(L.MOTIVE, wert)) return;
  // Waehrend der Frage kann bereits eine andere Wahl gespeichert worden sein.
  if (stand(td).wort != null) return;
  // Sonntag: das Motiv eines der beiden Teile ist richtig
  const richtig = td.aufgaben.some((x) => x.motiv === wert);
  if (sichere(L.merkeWort(roh(), td.tag, richtig))) {
    sicher(() => sende('raetsel:wort', { tag: td.tag, richtig }), 'raetsel:wort');
  }
  letztesWort = { wahl, gewaehlt: wert, richtig };
  app.meldung(richtig ? t('p-tagesraetsel.wort.richtig', { motiv: L.motivName(wert) }) : t('p-tagesraetsel.wort.fast', { motiv: L.motivName(a.motiv) }));
}

async function teile(app, td) {
  const text = L.teilText(td, stand(td));
  letzterTeilText = text;
  const test = typeof location !== 'undefined' && /[?&]test\b/.test(location.search || '');
  try {
    if (!test && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ text });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      app.meldung(t('p-tagesraetsel.teilen.kopiert'));
      return;
    }
  } catch (e) { /* Zwischenablage gesperrt: Text zeigen */ }
  app.frage({ titel: t('p-tagesraetsel.teilen.titel'), text, knoepfe: [{ text: t('allgemein.fertig'), wert: true, art: 'primaer' }], abbrechen: true });
}

function endeKnoepfe(td) {
  const k = [];
  const st = stand(td);
  if (L.wortWahl(L.motivAufgabe(td), td.aufgaben) && st.wort == null) k.push({ text: t('p-tagesraetsel.wort.knopf'), art: 'primaer', beiKlick: (app) => einWort(app, td) });
  k.push({ text: t('allgemein.teilen'), art: k.length ? '' : 'primaer', beiKlick: (app) => teile(app, td) });
  return k;
}

// ---------- Raetsel-Quelle ----------
function quelle() {
  let sitzung = { archiv: false, td: null, anzahl: 0 };
  return {
    get titel() { return t('p-tagesraetsel.quelle.titel'); },
    get unter() { return t('p-tagesraetsel.quelle.unter'); },
    liste(p = {}) {
      const tag = heute();
      if (!daten) { ladeDaten(); sitzung = { archiv: false, td: null, anzahl: 0 }; return []; }
      if (p && p.archiv) {
        const m = roh();
        const tage = L.archivTage(daten, tag, m);
        sitzung = { archiv: true, td: null, anzahl: 0 };
        return tage.flatMap((td) => L.alsAufgaben(td, { nur: L.offeneIndizes(m, td) }));
      }
      const td = heuteDaten(tag);
      sitzung = { archiv: false, td, anzahl: 0 };
      return L.alsAufgaben(td, { nur: L.offeneIndizes(roh(), td) });
    },
    ergebnis(aufgabe, erg) {
      const id = L.teileId(aufgabe.id);
      if (!id || !daten) return null;
      const td = L.tagDaten(daten, id.tag);
      const a = td && td.aufgaben[id.index];
      if (!a) return null;
      const richtig = !!erg.richtig;
      const fehlversuche = Number.isInteger(erg.fehlversuche) ? erg.fehlversuche : 0;
      const archiv = id.tag !== heute();
      const r = L.merkeErgebnis(roh(), id.tag, id.index, { fehlversuche, richtig }, { archiv });
      sitzung.anzahl++;
      if (r.neu) {
        sichere(r.modul);
        // Vertrag (ARCHITEKTUR.md, raetsel:geloest): quelle 'tag' | 'archiv'; eigene Raetsel haben keine Wertung
        sicher(() => sende('raetsel:geloest', {
          id: a.id, richtig, versuch: Number.isInteger(erg.versuch) ? erg.versuch : 0, quelle: archiv ? 'archiv' : 'tag', wertung: null,
        }), 'raetsel:geloest');
      }
      return L.rueckmeldung({ richtig, fehlversuche });
    },
    ende() {
      const e = L.endeText({ archiv: sitzung.archiv, anzahl: sitzung.anzahl, td: sitzung.td });
      const td = sitzung.td;
      if (sitzung.archiv || !td || !stand(td).fertig) return e;
      return { ...e, klang: 'stern', knoepfe: endeKnoepfe(td) };
    },
    leer() {
      if (!daten) return { titel: t('p-tagesraetsel.leer.laedtTitel'), text: t('p-tagesraetsel.leer.laedtText') };
      return { titel: t('p-tagesraetsel.leer.archivTitel'), text: t('p-tagesraetsel.leer.archivText') };
    },
  };
}

// ---------- Elemente ----------
function oeffne(app, ev, params = {}) {
  if (ev) ev.stopPropagation();
  sicher(() => app.gehe('raetsel', { quelle: L.PAKET, ...params }), 'Öffnen');
}

// Mini-Brett aus Sicht der Seite am Zug (miniBrett kennt keine Ausrichtung)
function drehe(fen) {
  const teile = fen.trim().split(/\s+/);
  teile[0] = teile[0].split('/').reverse().map((r) => [...r].reverse().join('')).join('/');
  return teile.join(' ');
}
const mini = (fen) => miniBrett(fen.split(/\s+/)[1] === 'b' ? drehe(fen) : fen);

function fuelleKarte(el, app) {
  const td = heuteDaten();
  el.classList.remove('tr-laedt');
  if (!td) {
    el.classList.add('tr-ruhig');
    el.innerHTML = `<span class="ueberzeile">${esc(t('p-tagesraetsel.name'))}</span>
      <span class="tr-symbol" aria-hidden="true">${icon('tagesraetsel')}</span>
      <h2>${esc(t('p-tagesraetsel.karte.baldTitel'))}</h2>
      <p>${esc(t('p-tagesraetsel.karte.baldText'))}</p>`;
    return;
  }
  const st = stand(td);
  // Sonntag halb geloest: Karte zeigt den offenen Teil (den "Lösen" auch oeffnet)
  const i = L.ersteOffene(roh(), td);
  const a = td.aufgaben[i];
  const offen = L.offeneIndizes(roh(), td).length;
  const teilText = td.aufgaben.length < 2 || st.fertig ? '' : offen > 1 ? t('p-tagesraetsel.karte.zweiTeile') : t('p-tagesraetsel.karte.teil', { teil: i + 1 });
  const stufe = Math.max(...td.aufgaben.map((x) => x.stufe));
  const offenArchiv = L.archivTage(daten, td.tag, roh()).length;
  el.dataset.fertig = st.fertig ? '1' : '0';
  el.innerHTML = `<span class="ueberzeile">${esc(t('p-tagesraetsel.karte.ueber', { tag: L.wochentagName(td.wochentag) }))}</span>
    ${mini(a.fen)}
    <div class="tr-kopf"><h2>${esc(t('p-tagesraetsel.karte.nummer', { nummer: td.nummer }))}</h2>
      <span class="tr-punkte" role="img" aria-label="${esc(t('p-tagesraetsel.karte.schwierigkeit', { stufe, max: L.STUFEN }))}">${L.punkte(stufe)}</span></div>
    <p>${st.fertig
      ? esc(st.geloest ? t('p-tagesraetsel.karte.geloest') : t('p-tagesraetsel.karte.geschafft'))
      : esc(t('p-tagesraetsel.karte.text', { amZug: L.amZugText(a.fen), zuege: L.zuegeText(a), teil: teilText }))}</p>
    <div class="t-fuss">
      ${offenArchiv ? `<button class="knopf dr tr-archiv" type="button">${esc(t('p-tagesraetsel.karte.archiv', { n: offenArchiv }))}</button>` : '<span></span>'}
      ${st.fertig
        ? `<button class="knopf dr tr-teilen" type="button">${esc(t('allgemein.teilen'))}</button>`
        : `<button class="knopf dr primaer tr-los" type="button">${esc(t('p-tagesraetsel.karte.loesen'))}${icon('vor')}</button>`}
    </div>`;
  const los = el.querySelector('.tr-los');
  if (los) los.addEventListener('click', (ev) => oeffne(app, ev));
  const tl = el.querySelector('.tr-teilen');
  if (tl) tl.addEventListener('click', (ev) => { ev.stopPropagation(); teile(app, td); });
  const ar = el.querySelector('.tr-archiv');
  if (ar) ar.addEventListener('click', (ev) => oeffne(app, ev, { archiv: 1 }));
}

function trainingKarte(app) {
  const el = document.createElement('section');
  el.className = 't-karte t-held tr-karte';
  el.dataset.paket = L.PAKET;
  el.setAttribute('aria-label', t('p-tagesraetsel.name'));
  if (daten) fuelleKarte(el, app);
  else {
    // Daten kommen gleich (Offline-Cache): bis dahin eine ruhige Karte, dann fuellen
    el.classList.add('tr-laedt');
    el.innerHTML = `<span class="ueberzeile">${esc(t('p-tagesraetsel.name'))}</span><h2>${esc(t('p-tagesraetsel.karte.laedtTitel'))}</h2><p>${esc(t('p-tagesraetsel.karte.laedt'))}</p>`;
    wartende.add(() => { if (el.isConnected) fuelleKarte(el, app); });
    ladeDaten();
  }
  return el;
}

function heuteZeile(app, tag) {
  if (!daten) { ladeSpaeter(); return null; }
  const td = heuteDaten(tag);
  if (!td || stand(td).fertig) return null;
  const a = td.aufgaben[L.ersteOffene(roh(), td)];
  const el = document.createElement('div');
  el.className = 'tr-heute';
  el.dataset.paket = L.PAKET;
  el.innerHTML = `<span class="tr-heute-symbol" aria-hidden="true">${icon('tagesraetsel')}</span>
    <span class="tr-heute-text"><b>${esc(t('p-tagesraetsel.name'))}</b> · ${esc(t('p-tagesraetsel.heute.text', { nummer: td.nummer, zuege: L.zuegeText(a) }))}</span>
    <button class="knopf dr tr-heute-los" type="button">${esc(t('p-tagesraetsel.karte.loesen'))}</button>`;
  el.querySelector('.tr-heute-los').addEventListener('click', (ev) => oeffne(app, ev));
  return el;
}

// ---------- Einhaengen (defensiv) ----------
function ladeCss() {
  try {
    if (typeof document === 'undefined' || document.querySelector('link[data-paket="tagesraetsel"]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL('../../../css/pakete/tagesraetsel.css', import.meta.url).href;
    l.dataset.paket = L.PAKET;
    document.head.append(l);
  } catch (e) { /* ohne eigenes CSS bleibt alles lesbar */ }
}

function registriere() {
  ladeCss();
  // Kalenderblatt mit Springer-Haken
  registriereIcon('tagesraetsel', '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M4 10h16"/><path d="m9 15 2 2 4-4"/>');
  registriereInhaltsart(L.ART, { formate: [1], pruefe: L.pruefeDatei });
  registriereRaetselQuelle(L.PAKET, quelle());
  anbieten('training:karten', (k) => sicher(() => (k && k.app ? trainingKarte(k.app) : null), 'Training'), { reihenfolge: 5, paket: L.PAKET });
  anbieten('arena:heute', (k) => sicher(() => (k && k.app ? heuteZeile(k.app, typeof k.tag === 'string' ? k.tag : heute()) : null), 'Heute'),
    { reihenfolge: 20, paket: L.PAKET });
  ladeDaten();
}

sicher(registriere, 'Laden');
// Raetsel vor dem ersten Screen laden (die App wartet auf ihre Pakete; die Datei kommt aus dem Offline-Cache), aber
// hoechstens LADE_WARTEN_MS: danach fuellt sich die Training-Karte von selbst, die Zeile in der Arena kommt beim
// naechsten Zeichnen.
const LADE_WARTEN_MS = 1500;
await Promise.race([ladeDaten().catch(() => null), new Promise((r) => { setTimeout(r, LADE_WARTEN_MS); })]);
