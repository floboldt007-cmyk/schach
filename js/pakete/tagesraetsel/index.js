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
// Ereignisse: sendet raetsel:geloest { id, richtig, versuch, quelle: 'tagesraetsel' | 'tagesraetsel-archiv' } je
//             Aufgabe (id = id der Datei, z. B. 'tr-0012'; Funken und Serie zaehlen jede id einmal)
// Register:   Raetsel-Quelle "tagesraetsel", Inhaltsart "tagesraetsel" (js/inhalte.js), Icon "tagesraetsel"
// Speicher:   Modul "tagesraetsel" (Budget 4.000, logik.js), bei jedem Zugriff frisch gelesen; ein Modul aus einer
//             neueren App (v > RECHENSTAND) wird gelesen, aber nie ueberschrieben.
// Test:       zustand() -> { geladen, heute, td, modul, letzterTeilText, letztesWort }; mit ?test auch window.__tagesraetsel
// Ein Fehler im Paket stoppt nie die App: jeder Anbieter liefert im Zweifel null.
import { anbieten } from '../../orte.js';
import { sende } from '../../ereignisse.js';
import { ladeModul, speichereModul } from '../../storage.js';
import { ladeInhalt, registriereInhaltsart } from '../../inhalte.js';
import { icon, registriereIcon } from '../../ui/icons.js';
import { miniBrett } from '../../ui/bauteile.js';
import { tagSchluessel } from '../../tag.js';
import { registriereRaetselQuelle } from '../../ui/raetsel.js';
import * as L from './logik.js';

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
const wartende = new Set();
function ladeDaten() {
  if (!laden) {
    laden = ladeInhalt(L.DATEI, { art: L.ART, neu: true }).then((r) => {
      if (r && r.ok) daten = r.daten;
      else {
        console.warn('tagesraetsel: Rätsel nicht geladen', r && r.grund);
        // naechster Versuch beim naechsten Zeichnen (z. B. wieder online)
        laden = null;
      }
      for (const f of wartende) sicher(f, 'Nachladen');
      wartende.clear();
      return daten;
    });
  }
  return laden;
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
  const wahl = L.wortWahl(a);
  if (!wahl) return;
  const st = stand(td);
  if (st.wort != null) { app.meldung(`Das Motiv war: ${L.MOTIVE[a.motiv]}.`); return; }
  const wert = await app.frage({
    titel: 'Ein Wort', text: 'Welches Motiv steckte im Rätsel?',
    knoepfe: wahl.map((k) => ({ text: L.MOTIVE[k], wert: k })), abbrechen: null,
  });
  if (!wert || !Object.hasOwn(L.MOTIVE, wert)) return;
  const richtig = wert === a.motiv;
  sichere(L.merkeWort(roh(), td.tag, richtig));
  letztesWort = { wahl, gewaehlt: wert, richtig };
  app.meldung(richtig ? `Richtig: ${L.MOTIVE[a.motiv]}.` : `Fast. Es war: ${L.MOTIVE[a.motiv]}.`);
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
      app.meldung('Text kopiert. Ohne Link und ohne Lösung.');
      return;
    }
  } catch (e) { /* Zwischenablage gesperrt: Text zeigen */ }
  app.frage({ titel: 'Zum Teilen', text, knoepfe: [{ text: 'Fertig', wert: true, art: 'primaer' }], abbrechen: true });
}

function endeKnoepfe(td) {
  const k = [];
  const st = stand(td);
  if (L.wortWahl(L.motivAufgabe(td)) && st.wort == null) k.push({ text: 'Ein Wort', art: 'primaer', beiKlick: (app) => einWort(app, td) });
  k.push({ text: 'Teilen', art: k.length ? '' : 'primaer', beiKlick: (app) => teile(app, td) });
  return k;
}

// ---------- Raetsel-Quelle ----------
function quelle() {
  let sitzung = { archiv: false, td: null, anzahl: 0 };
  return {
    titel: 'Tagesrätsel',
    unter: 'Für alle dasselbe',
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
      const t = L.teileId(aufgabe.id);
      if (!t || !daten) return null;
      const td = L.tagDaten(daten, t.tag);
      const a = td && td.aufgaben[t.index];
      if (!a) return null;
      const richtig = !!erg.richtig;
      const fehlversuche = Number.isInteger(erg.fehlversuche) ? erg.fehlversuche : 0;
      const archiv = t.tag !== heute();
      const r = L.merkeErgebnis(roh(), t.tag, t.index, { fehlversuche, richtig }, { archiv });
      if (r.neu) sichere(r.modul);
      sitzung.anzahl++;
      sicher(() => sende('raetsel:geloest', {
        id: a.id, richtig, versuch: Number.isInteger(erg.versuch) ? erg.versuch : 0, quelle: archiv ? 'tagesraetsel-archiv' : 'tagesraetsel',
      }), 'raetsel:geloest');
      return L.rueckmeldung({ richtig, fehlversuche });
    },
    ende() {
      const t = L.endeText({ archiv: sitzung.archiv, anzahl: sitzung.anzahl, td: sitzung.td });
      const td = sitzung.td;
      if (sitzung.archiv || !td || !stand(td).fertig) return t;
      return { ...t, klang: 'stern', knoepfe: endeKnoepfe(td) };
    },
    leer() {
      if (!daten) return { titel: 'Das Rätsel lädt noch', text: 'Gleich noch einmal öffnen.' };
      return { titel: 'Archiv erledigt', text: 'Alle Rätsel der letzten 30 Tage sind gelöst.' };
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
  const t = fen.trim().split(/\s+/);
  t[0] = t[0].split('/').reverse().map((r) => [...r].reverse().join('')).join('/');
  return t.join(' ');
}
const mini = (fen) => miniBrett(fen.split(/\s+/)[1] === 'b' ? drehe(fen) : fen);

function fuelleKarte(el, app) {
  const td = heuteDaten();
  el.classList.remove('tr-laedt');
  if (!td) {
    el.classList.add('tr-ruhig');
    el.innerHTML = `<span class="ueberzeile">Tagesrätsel</span>
      <span class="tr-symbol" aria-hidden="true">${icon('tagesraetsel')}</span>
      <h2>Bald gibt es hier jeden Tag ein Rätsel</h2>
      <p>Für alle dasselbe, montags leicht, samstags knifflig.</p>`;
    return;
  }
  const a = td.aufgaben[0];
  const st = stand(td);
  const stufe = Math.max(...td.aufgaben.map((x) => x.stufe));
  const offenArchiv = L.archivTage(daten, td.tag, roh()).length;
  el.dataset.fertig = st.fertig ? '1' : '0';
  el.innerHTML = `<span class="ueberzeile">Tagesrätsel · ${esc(L.WOCHENTAG[td.wochentag])}</span>
    ${mini(a.fen)}
    <div class="tr-kopf"><h2>Rätsel ${td.nummer}</h2>
      <span class="tr-punkte" role="img" aria-label="Schwierigkeit ${stufe} von ${L.STUFEN}">${L.punkte(stufe)}</span></div>
    <p>${st.fertig
      ? (st.geloest ? 'Gelöst. Morgen kommt das nächste.' : 'Geschafft. Morgen kommt das nächste.')
      : `${esc(L.amZugText(a.fen))}, ${esc(L.zuegeText(a))}${td.aufgaben.length > 1 ? ', in zwei Teilen' : ''}. Für alle dasselbe.`}</p>
    <div class="t-fuss">
      ${offenArchiv ? `<button class="knopf dr tr-archiv" type="button">Archiv · ${offenArchiv}</button>` : '<span></span>'}
      ${st.fertig
        ? `<button class="knopf dr tr-teilen" type="button">Teilen</button>`
        : `<button class="knopf dr primaer tr-los" type="button">Lösen${icon('vor')}</button>`}
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
  el.setAttribute('aria-label', 'Tagesrätsel');
  if (daten) fuelleKarte(el, app);
  else {
    // Daten kommen gleich (Offline-Cache): bis dahin eine ruhige Karte, dann fuellen
    el.classList.add('tr-laedt');
    el.innerHTML = '<span class="ueberzeile">Tagesrätsel</span><h2>Rätsel des Tages</h2><p>Lädt …</p>';
    wartende.add(() => { if (el.isConnected) fuelleKarte(el, app); });
    ladeDaten();
  }
  return el;
}

function heuteZeile(app, tag) {
  const td = heuteDaten(tag);
  if (!td || stand(td).fertig) return null;
  const el = document.createElement('div');
  el.className = 'tr-heute';
  el.dataset.paket = L.PAKET;
  el.innerHTML = `<span class="tr-heute-symbol" aria-hidden="true">${icon('tagesraetsel')}</span>
    <span class="tr-heute-text"><b>Tagesrätsel</b> · Rätsel ${td.nummer}, ${esc(L.zuegeText(td.aufgaben[0]))}</span>
    <button class="knopf dr tr-heute-los" type="button">Lösen</button>`;
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
