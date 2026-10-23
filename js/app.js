// Crownmate: App-Rahmen. Routing per location.hash, Screens als Module (js/ui/<name>.js),
// gemeinsame Dienste fuer alle Screens (Engines, Einstellungen, Meldungen, Rueckfragen).
//
// Vertrag (ARCHITEKTUR.md "Runde 2"): jedes Screen-Modul exportiert
//   zeige(root, params, app) -> { verlasse() }
// app = { gehe, zurueck, engine, einstellungen, setzeEinstellungen, meldung, vorab }
// Zusaetze: app.frage({ titel, text, knoepfe: [{ text, wert, art }], abbrechen }) -> Promise<wert>
//           (Rueckfrage-Dialog), app.schliesseDialog() (offene Rueckfrage mit "abbrechen" schliessen),
//           app.test (true bei ?test in der URL).
// Ausserdem exportiert: icon(name, klasse) -> SVG-Text der gemeinsamen Strich-Icons (wohnt in js/ui/icons.js).
// Registriert sw.js (Offline-Cache) und zeigt bei einer neuen Version den Hinweis "Neu laden".
//
// Runde 4 (Erweiterungspunkte, ARCHITEKTUR.md):
//   - laedt die Pakete aus der Liste PAKETE in ./erweiterungen.js per dynamischem import(), nur mit ?test
//     zusaetzlich ?erw=pfad1,pfad2 (relativ zu js/, ohne .js, nur [a-z0-9/-], z. B.
//     ?test&erw=pakete/kartei/index), und zwar bevor app:bereit kommt und der erste Screen erscheint. Ein
//     Paket, das nicht laedt, landet als console.error in der Konsole; die App startet trotzdem (nach
//     hoechstens PAKETE_WARTEN_MS auch dann, wenn ein Paket nie fertig wird). Nur mit ?test&kern laedt die App die
//     Spielpakete aus PAKETE (Pfade unter pakete/) nicht: so pruefen e2e (Block Kern) und die Kern-Gruppen von
//     tests/app.test.mjs, dass der Kern ohne Pakete unveraendert bleibt
//   - Screens 'training' und 'start' gehoeren Paketen: fehlt ihre Datei, geht es still zur Arena (seit U2 ist 'training'
//     Kern-Screen, siehe unten)
//   - sendet app:bereit (einmal vor dem ersten Screen), app:screen (nach zeige() eines Screens) und
//     app:sichtbar (bei visibilitychange; setzt html[data-sichtbar="ja"|"nein"])
//   - Wahl-Ort app:erster-screen? (nur ohne Hash und ohne Verlaufseintrag), kontext { partienZahl }
//   - speicher:fehler: einmal je Sitzung ein Hinweis, dass der Speicher voll ist
//
// W0+a "Spiel-Fundament" (SPIELKONZEPT 6.2):
//   - SCREENS zusaetzlich bestenliste, raetsel, lernen, lektion, ich, spielplan, spielhalle: alle gehoeren Paketen
//     (PAKET_SCREENS); fehlt ihre Datei, geht es wie bei training und start still zur Arena
//   - untere Leiste mit den Reitern Arena, Training, Bestenliste, Ich (nav.reiter-leiste), nur vorbereitet: Sie
//     erscheint erst, wenn REITER in ./erweiterungen.js Screens nennt (das macht die Integration; im Testmodus
//     auch ?reiter=training,ich), und nur auf den Reiter-Screens. Ohne Pakete bleibt sie unsichtbar
//     (hidden, html[data-reiter] fehlt). Die Optik kommt mit dem Premium-Umbau.
//   - beim Start: storage.dauerhaftAnfragen() (navigator.storage.persist, Fehler still) und, kurz nach dem ersten
//     Screen, storage.duenneAnalysenAus() (MAX_REVIEWS 12; aeltere Speicherstaende hatten bis zu 20)
//   - w0plus-a-fix: Screen werkstatt (Werkstatt-Vorschau aus Schub 2b, Paket werkstatt), gehoert zum Reiter Ich.
//     dauerhaftAnfragen fragt nur dort an, wo kein Dialog droht (Firefox ausserhalb der installierten App nicht).
//
// Premium-Umbau U1 (Theme-Fundament): wendeEinstellungenAn(e) ruft zusaetzlich setzeBewegung(e.bewegung) (bewegung.js),
//   wendeThemaAn({ thema, modus }) (thema.js) und, sobald es sie gibt, klang.einstellen(e) (sounds.js, U3). Start:
//   starteDruck() (Druck-Rueckmeldung fuer .dr). Hell/Dunkel wechselt ueber app.setzeEinstellungen({ modus }) ohne Neuladen.
//   Nach ladePakete() gilt die gespeicherte Ansicht noch einmal (Themes aus Paketen kennt thema.js erst dann).
//
// Premium-Umbau U2 (Navigation, PLAN 2.1, 2.10, Flo D2/D5):
//   - Reiter-Leiste als schwebende Glas-Pille mit gleitender .reiter-pille unter dem aktiven Reiter (gemessen; ein
//     ResizeObserver misst bei jeder Groessenaenderung neu). Lage nach D5: Querformat ab 1021 px oben in der Kopfzeile
//     (in .kopf-reiter-platz des Hauptseiten-Kopfs aus js/ui/seite.js; passt sie dort nicht, zuerst enger, sonst
//     unten), sonst unten schwebend. html[data-reiter="oben"|"unten"] (vorher "an"); nur "unten" kuerzt die Screens um
//     --reiter-h. Auf Screens ohne Reiter (Partie, Analyse, Einstellungen) faehrt sie unten weg (bei Tempo 0 sofort).
//     html[data-reiter-wurzel="ja"] auf dem Screen eines Reiters selbst (dort blendet der Kopf seinen Zurueck-Knopf
//     aus), html[data-reiter-liste] nennt die Reiter (ein Reiter Verlauf ersetzt den Verlauf-Knopf im Kopf).
//   - Zwischenreiter Verlauf (D2): REITER darf 'verlauf' nennen (Arena · Verlauf); steht 'ich' in REITER, verschwindet
//     er, und der Verlauf gehoert zum Reiter Ich (reiterVon()).
//   - 'training' ist Kern-Screen (js/ui/training.js, Huelle fuer training:karten), nicht mehr in PAKET_SCREENS.
//   - app.meldung() benutzt toast() aus js/ui/bauteile.js; ein Screen-Wechsel schliesst auch ein offenes Blatt (sheet).
import * as erweiterungen from './erweiterungen.js';
import { Engine } from './engine.js';
import { klang } from './sounds.js';
import { setzeSymbole } from './board.js';
import { SYMBOLE } from './symbole.js';
import {
  ladeEinstellungen, speichereEinstellungen, ladeLaufendePartie, ladePartien, dauerhaftAnfragen, duenneAnalysenAus,
} from './storage.js';
import { icon } from './ui/icons.js';
import { hoere, sende } from './ereignisse.js';
import { waehle } from './orte.js';
import { wendeThemaAn, themaVon, aktuellesThema } from './thema.js';
import { setzeBewegung, starteDruck, anim, tempo } from './bewegung.js';
import { toast, toastLeeren, schliesseSheet } from './ui/bauteile.js';
import './konto.js';

// icon bleibt hier exportiert (Rueckwaertskompatibel fuer die Screens)
export { icon };

// Listen aus erweiterungen.js ueber den Namensraum: fehlt eine (z. B. eine aeltere Datei ohne REITER), startet die
// App trotzdem (ein fehlender benannter Import braeche sonst den ganzen Modulgraphen ab)
const PAKETE = erweiterungen.PAKETE;
const REITER = erweiterungen.REITER;

const SCREENS = ['arena', 'partie', 'analyse', 'verlauf', 'einstellungen', 'training', 'start',
  'bestenliste', 'raetsel', 'lernen', 'lektion', 'ich', 'spielplan', 'spielhalle', 'werkstatt'];
const TITEL = {
  arena: 'Arena', partie: 'Partie', analyse: 'Spielanalyse', verlauf: 'Verlauf', einstellungen: 'Einstellungen',
  training: 'Training', start: 'Willkommen',
  bestenliste: 'Bestenliste', raetsel: 'Rätsel', lernen: 'Lernen', lektion: 'Lektion', ich: 'Ich', spielplan: 'Spielplan',
  spielhalle: 'Spielhalle', werkstatt: 'Werkstatt',
};
// Screens aus Paketen (Runde 4, W0+a): fehlt die Datei, geht es ohne Hinweis zur Arena. Premium-Umbau U2: 'training' ist
// Kern-Screen (Huelle fuer training:karten) und steht deshalb nicht mehr hier.
const PAKET_SCREENS = new Set(['start', 'bestenliste', 'raetsel', 'lernen', 'lektion', 'ich', 'spielplan', 'spielhalle',
  'werkstatt']);
const TEST = typeof location !== 'undefined' && /[?&]test\b/.test(location.search);

// ---------- Einstellungen ----------

function wendeEinstellungenAn(e) {
  klang.aus = !e.klang;
  // Premium-Umbau: Klang-Einstellungen (Paket, Lautstaerke, Stufe, Gruppen), sobald sounds.js sie kennt (U3)
  if (typeof klang.einstellen === 'function') {
    try { klang.einstellen(e); } catch (f) { console.error(f); }
  }
  // Theme (Ansicht, Hell/Dunkel) und Animationstempo; ein Fehler darf die App nie anhalten
  setzeBewegung(e.bewegung);
  wendeThemaAn({ thema: e.thema, modus: e.modus }).catch((f) => console.error(f));
  const html = document.documentElement;
  html.dataset.brett = e.brett;
  html.dataset.koordinaten = e.koordinaten ? 'an' : 'aus';
  html.dataset.balken = e.balken ? 'an' : 'aus';
  html.dataset.live = e.liveBewertung ? 'an' : 'aus';
  window.dispatchEvent(new CustomEvent('schach:einstellungen', { detail: e }));
}

// Themes aus Paketen (registriereThema) kennt thema.js erst nach ladePakete(): die gespeicherte Ansicht dann noch
// einmal anwenden. Nicht abwarten (bremst den Start nicht); wendeThemaAn schaltet erst um, wenn das CSS da ist.
function themaNachPaketen() {
  const e = ladeEinstellungen();
  if (e.thema === aktuellesThema().thema || !themaVon(e.thema)) return;
  wendeThemaAn({ thema: e.thema, modus: e.modus }).catch((f) => console.error(f));
  // Codex-Befund (PR #4): ohne gewaehltes Klangpaket bestimmt das Theme den Standard, der gilt erst jetzt
  if (typeof klang.einstellen === 'function') {
    try { klang.einstellen(e); } catch (f) { console.error(f); }
  }
}

// ---------- Engines (zwei Instanzen, lazy, einmal init) ----------

// Stockfish braucht WebAssembly mit SIMD (Safari ab iOS/iPadOS 16.4). Einmal vorab pruefen:
// Fehlt SIMD oder die Engine-Datei, gibt es sofort eine klare Meldung statt einer stillen
// Wartezeit bei jedem Zug (ein gescheiterter Start im Worker meldet sich nicht von selbst).
// w0c: SIMD prueft ein kleines Test-Modul; die 1,8-MB-.wasm wird nur EINMAL geholt (offline aus dem Cache
// des Service Workers), geprueft und beiden Workern als Blob-URL uebergeben. stockfish.js liest die Adresse
// der .wasm aus dem #-Teil seiner eigenen Adresse; den verliert ein Worker-Skript aus dem Cache des Service
// Workers (seine Adresse ist dann die der Cache-Antwort), deshalb startet auch das Skript (28 KB) als Blob.
// So laden die Worker nichts mehr selbst und haengen offline nicht davon ab, ob das Geraet ihre Anfragen
// ueber den Service Worker leitet. Klappt der Start so nicht, laden die Worker wie bisher selbst. Das merkt
// sich das Geraet (WASM_DIREKT, Zeitpunkt), aber nur bei einem echten Fehler (Fehler-Ereignis, "Aborted(...)"),
// nicht beim Zeitlimit (iPad gesperrt, Speicherdruck), und nur WASM_DIREKT_TAGE lang; danach, nach
// "Fortschritt zuruecksetzen" oder wenn der Wert fehlt, versucht es der naechste Start wieder per Blob.
// Pfade relativ zu diesem Modul (klappt unter / und unter /schach/).
const ENGINE_PFAD = new URL('../vendor/stockfish/stockfish-19-lite-single.js', import.meta.url).href;
const WASM_PFAD = new URL('../vendor/stockfish/stockfish-19-lite-single.wasm', import.meta.url).href;
const WASM_DIREKT = 'schach-arena:v1:wasm-direkt';
const WASM_DIREKT_TAGE = 30;
// kleinstes Modul mit einem SIMD-Befehl (v128)
const SIMD_TEST = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);
const ENGINE_TEXT = {
  'kein-simd': 'Für die Schach-Engine braucht dein iPad iPadOS 16.4 oder neuer (Einstellungen → Allgemein → Softwareupdate). Bis dahin spielen die Bots ohne Engine und es gibt keine Bewertung.',
  'kein-wasm': 'Dieser Browser kann die Schach-Engine nicht starten. Bitte Safari oder einen aktuellen Browser nehmen.',
  'wasm-kaputt': 'Die Datei der Schach-Engine ist beschädigt. Lade die App bitte neu.',
};
let wasmPruefung = null;
let engineGemeldet = false;

function dauerhafterFehler(code) {
  const f = new Error(ENGINE_TEXT[code] || code);
  f.code = code;
  f.dauerhaft = true;
  return f;
}

// -> Promise<string|null>: Blob-URL der geprueften .wasm fuer die Worker (null: ohne fetch/Blob, dann
// laden die Worker selbst). Wirft dauerhafte Fehler (kein-wasm, kein-simd, wasm-kaputt) oder, wenn die
// Datei nicht erreichbar ist, einen voruebergehenden (dann beim naechsten Mal neu versuchen).
export function pruefeWasm({ simdTest = SIMD_TEST, pfad = WASM_PFAD } = {}) {
  if (!wasmPruefung) {
    const p = (async () => {
      if (typeof WebAssembly !== 'object' || typeof WebAssembly.validate !== 'function') throw dauerhafterFehler('kein-wasm');
      if (!WebAssembly.validate(simdTest)) throw dauerhafterFehler('kein-simd');
      if (typeof fetch !== 'function') return null;
      const antwort = await fetch(pfad);   // kommt offline aus dem Cache des Service Workers
      if (!antwort.ok) throw new Error('Engine-Datei nicht erreichbar (' + antwort.status + ')');
      const bytes = new Uint8Array(await antwort.arrayBuffer());
      if (!WebAssembly.validate(bytes)) throw dauerhafterFehler('wasm-kaputt');
      // Geraet laedt direkt (Blob-Start scheiterte einmal): die Bytes nicht als Blob festhalten
      if (direktLaden() || typeof Blob !== 'function' || typeof URL.createObjectURL !== 'function') return null;
      // Typ application/wasm: der Worker kompiliert per instantiateStreaming
      return URL.createObjectURL(new Blob([bytes], { type: 'application/wasm' }));
    })();
    // nur dauerhafte Fehler merken, sonst beim naechsten Mal neu versuchen
    p.catch((e) => { if (!(e && e.dauerhaft) && wasmPruefung === p) wasmPruefung = null; });
    wasmPruefung = p;
  }
  return wasmPruefung;
}

function meldeEngineFehler(e) {
  if (!e || !e.dauerhaft || engineGemeldet) return;
  engineGemeldet = true;
  frage({ titel: 'Schach-Engine startet nicht', text: e.message, knoepfe: [{ text: 'OK', wert: true, art: 'primaer' }], abbrechen: true });
}

// Die Worker bekommen Skript und gepruefte Bytes als Blob-URL. Hat das nicht geklappt (der Worker
// startet dann nicht), laden sie wie bisher selbst; das merkt sich das Geraet WASM_DIREKT_TAGE lang
// (WASM_DIREKT = Zeitpunkt in ms).
function direktLaden() {
  try {
    const t = Number(localStorage.getItem(WASM_DIREKT));
    const alter = Date.now() - t;
    return t > 0 && alter >= 0 && alter < WASM_DIREKT_TAGE * 86400000;
  } catch (e) { return false; }
}
function merkeDirekt() {
  try { localStorage.setItem(WASM_DIREKT, String(Date.now())); } catch (e) { /* egal */ }
}
// Laedt der Worker die .wasm nicht (z. B. Blob-Adresse dort ungueltig), endet das bei stockfish.js still in einem
// unbehandelten Promise-Fehler. Der Vorspann meldet ihn als Zeile "Aborted(...)" wie ein Emscripten-Abbruch;
// dann sagt engine.init() sofort ab und der Rueckfall kommt gleich, nicht erst nach dem Zeitlimit.
const SKRIPT_VORSPANN = "self.addEventListener('unhandledrejection', function (e) { var r = e && e.reason; "
  + "postMessage('Aborted(' + String(r && r.message || r) + ')'); });\n";
let skriptBlob = null;
function engineSkript() {
  if (!skriptBlob) {
    const p = fetch(ENGINE_PFAD).then((r) => {
      if (!r.ok) throw new Error('Engine-Skript nicht erreichbar (' + r.status + ')');
      return r.blob();
    }).then((b) => URL.createObjectURL(new Blob([SKRIPT_VORSPANN, b], { type: 'text/javascript' })));
    p.catch(() => { if (skriptBlob === p) skriptBlob = null; });
    skriptBlob = p;
  }
  return skriptBlob;
}
async function starteEngine(wasmUrl, merke) {
  let skript = null;
  if (wasmUrl && !direktLaden()) {
    try { skript = await engineSkript(); } catch (f) { skript = null; }
  }
  // nur Tests: kuerzeres Zeitlimit fuer den Engine-Start (?test, window.__test.engineZeitlimit in ms)
  const testZeit = TEST && window.__test && Number(window.__test.engineZeitlimit);
  const opt = testZeit > 0 ? { zeitlimitMs: testZeit } : {};
  if (skript) {
    const e = new Engine(skript + '#' + encodeURIComponent(wasmUrl), opt);
    merke(e);
    try {
      await e.init();
      return e;
    } catch (f) {
      try { e.terminate(); } catch (g) { /* egal */ }
      console.warn('Engine mit Blob-URL startet nicht, lade die .wasm direkt', f);
      // ein Zeitlimit (gesperrtes iPad, Speicherdruck) ist kein Grund, es nie wieder per Blob zu versuchen
      if (!(f && f.zeitlimit)) merkeDirekt();
    }
  }
  const e = new Engine(ENGINE_PFAD, opt);
  merke(e);
  await e.init();
  return e;
}

const engines = new Map();
function engine(name) {
  const schluessel = name === 'bot' ? 'bot' : 'bewertung';
  let p = engines.get(schluessel);
  if (!p) {
    let e = null;
    p = pruefeWasm().then((wasmUrl) => starteEngine(wasmUrl, (x) => { e = x; }));
    p.catch((f) => {
      meldeEngineFehler(f);
      // dauerhafte Fehler bleiben stehen (sofortige Absage statt neuer Versuche je Zug)
      if (!(f && f.dauerhaft) && engines.get(schluessel) === p) engines.delete(schluessel);
      try { if (e) e.terminate(); } catch (g) { /* egal */ }
    });
    engines.set(schluessel, p);
  }
  return p;
}

// ---------- Meldungen (Toast) ----------

// Premium-Umbau U2: die Meldung ist das Bauteil toast() (js/ui/bauteile.js), gleiche Elemente wie vorher
function meldung(text, opt = {}) {
  toast(text, opt);
}

// Speicher voll (storage.js sendet speicher:fehler): einmal je Sitzung Bescheid sagen
let speicherGemeldet = false;
hoere('speicher:fehler', () => {
  if (speicherGemeldet || typeof document === 'undefined' || !document.body) return;
  speicherGemeldet = true;
  meldung('Speichern hat nicht geklappt: Der Speicher des Geräts ist voll.', { art: 'fehler', dauer: 6000 });
});

// ---------- Rueckfrage-Dialog ----------

let offenerDialog = null;
function frage({ titel = '', text = '', knoepfe = [{ text: 'OK', wert: true, art: 'primaer' }], abbrechen = null } = {}) {
  schliesseDialog();
  return new Promise((resolve) => {
    const ort = document.createElement('div');
    ort.className = 'dialog-ort';
    const id = 'dlg' + Date.now().toString(36);
    ort.innerHTML = `<div class="dialog flaeche" role="alertdialog" aria-modal="true" aria-labelledby="${id}-t" aria-describedby="${id}-x">
      <h2 id="${id}-t"></h2><p id="${id}-x"></p><div class="dialog-knoepfe"></div></div>`;
    ort.querySelector('h2').textContent = titel;
    const p = ort.querySelector('p');
    if (text) p.textContent = text; else p.remove();
    const leiste = ort.querySelector('.dialog-knoepfe');
    const vorherFokus = document.activeElement;
    let fertig = false;
    const ende = (wert) => {
      if (fertig) return;
      fertig = true;
      document.removeEventListener('keydown', taste, true);
      ort.classList.add('weg');
      setTimeout(() => ort.remove(), 200);
      if (offenerDialog && offenerDialog.ort === ort) offenerDialog = null;
      // Fokus zurueck, wo er vorher war
      if (vorherFokus && vorherFokus.isConnected && typeof vorherFokus.focus === 'function') {
        try { vorherFokus.focus({ preventScroll: true }); } catch (e) { /* egal */ }
      }
      resolve(wert);
    };
    const taste = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); ende(abbrechen); return; }
      // Tab bleibt im Dialog (aria-modal): vom letzten Knopf zum ersten und umgekehrt
      if (e.key === 'Tab') {
        const k = [...leiste.querySelectorAll('button')];
        if (!k.length) return;
        const i = k.indexOf(document.activeElement);
        const naechster = e.shiftKey ? (i <= 0 ? k[k.length - 1] : k[i - 1]) : (i < 0 || i === k.length - 1 ? k[0] : k[i + 1]);
        e.preventDefault();
        naechster.focus();
      }
    };
    for (const k of knoepfe) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'knopf' + (k.art ? ' ' + k.art : '');
      b.textContent = k.text;
      b.addEventListener('click', () => ende(k.wert));
      leiste.append(b);
    }
    ort.addEventListener('pointerdown', (e) => { if (e.target === ort) ende(abbrechen); });
    document.addEventListener('keydown', taste, true);
    document.body.append(ort);
    offenerDialog = { ort, ende: () => ende(abbrechen) };
    const erster = leiste.querySelector('.primaer') || leiste.querySelector('button');
    if (erster) erster.focus({ preventScroll: true });
  });
}

function schliesseDialog() {
  if (offenerDialog) offenerDialog.ende();
  offenerDialog = null;
}

// ---------- Reiter-Leiste (W0+a vorbereitet; Premium-Umbau U2: Glas-Pille aus Entwurf A, Lage nach Flo D5) ----------
// Reiter -> Screen. Arena ist immer dabei, die anderen nur, wenn REITER (erweiterungen.js) sie nennt. 'verlauf' ist der
// Zwischenreiter bis S1 (Flo D2: "Arena · Verlauf"); steht 'ich' dabei, verschwindet er (der Verlauf gehoert dann zu Ich).
const REITER_ALLE = [['arena', 'Arena', 'pokal'], ['training', 'Training', 'ziel'], ['verlauf', 'Verlauf', 'verlauf'],
  ['bestenliste', 'Bestenliste', 'podest'], ['ich', 'Ich', 'person']];
// Screens, die zu einem Reiter gehoeren (dort ist die Leiste sichtbar, wenn es sie gibt); verlauf: reiterVon()
const REITER_VON = { arena: 'arena', training: 'training', raetsel: 'training', lernen: 'training', bestenliste: 'bestenliste', ich: 'ich',
  werkstatt: 'ich' };
// Querformat ab 1021 px (iPad quer): die Leiste sitzt oben in der Kopfzeile, sonst schwebt sie unten (D5)
const OBEN_MQ = '(min-width: 1021px) and (orientation: landscape)';

export function reiterListe(suche = typeof location !== 'undefined' ? location.search : '') {
  const erlaubt = new Set(REITER_ALLE.map(([n]) => n).filter((n) => n !== 'arena'));
  const aus = new Set((Array.isArray(REITER) ? REITER : []).filter((n) => erlaubt.has(n)));
  if (TEST) {
    let test = null;
    try { test = new URLSearchParams(suche || '').get('reiter'); } catch (e) { test = null; }
    if (test) for (const n of test.split(',')) if (erlaubt.has(n.trim())) aus.add(n.trim());
  }
  if (aus.has('ich')) aus.delete('verlauf');
  return aus.size ? REITER_ALLE.filter(([n]) => n === 'arena' || aus.has(n)).map(([n]) => n) : [];
}

// Reiter, zu dem ein Screen gehoert (null: keiner, dort ist die Leiste weg)
export function reiterVon(screen, liste = reiterListe()) {
  if (screen === 'verlauf') return liste.includes('verlauf') ? 'verlauf' : liste.includes('ich') ? 'ich' : null;
  return Object.prototype.hasOwnProperty.call(REITER_VON, screen) ? REITER_VON[screen] : null;
}

const leiste = { el: null, pille: null, lage: null, sichtbar: false, gezeigt: false, wegAnim: null, pilleX: null, pilleB: null,
  ro: null, mo: null, rahmen: 0, fokusFolgt: false };

function baueReiter(liste) {
  if (leiste.el) return;
  const nav = document.createElement('nav');
  nav.className = 'reiter-leiste';
  nav.setAttribute('aria-label', 'Bereiche');
  nav.hidden = true;
  nav.innerHTML = '<span class="reiter-pille" aria-hidden="true"></span>' + REITER_ALLE.filter(([n]) => liste.includes(n)).map(([n, t, ic]) =>
    `<button type="button" class="reiter dr" data-reiter="${n}">${icon(ic)}<span>${t}</span></button>`).join('');
  nav.addEventListener('click', (e) => {
    const k = e.target.closest('[data-reiter]');
    if (!k) return;
    const ziel = k.dataset.reiter;
    if (aktuell && aktuell.name === ziel && reiterVon(aktuell.name) === ziel) return;
    try { klang.spiele('wechsel'); } catch (f) { /* still */ }
    // Tastatur (Klick ohne Zeiger): der Fokus folgt auf den neuen Reiter (oben zieht die Leiste in einen neuen Kopf um)
    leiste.fokusFolgt = e.detail === 0;
    gehe(ziel, {}, { ersetzen: true });
  });
  leiste.el = nav;
  leiste.pille = nav.querySelector('.reiter-pille');
  document.body.append(nav);
  // Neu messen, sobald sich die Leiste (Schrift geladen, enger) oder das Fenster (Drehen) aendert; im naechsten Bild,
  // damit die Messung selbst keine Schleife ausloest
  const spaeter = () => {
    if (leiste.rahmen) return;
    leiste.rahmen = requestAnimationFrame(() => { leiste.rahmen = 0; if (leiste.sichtbar) platziereReiter(); });
  };
  if (typeof ResizeObserver === 'function') {
    leiste.ro = new ResizeObserver(spaeter);
    leiste.ro.observe(nav);
    leiste.ro.observe(document.documentElement);
  } else {
    window.addEventListener('resize', spaeter);
  }
  try {
    const mq = matchMedia(OBEN_MQ);
    if (mq.addEventListener) mq.addEventListener('change', spaeter);
    else if (mq.addListener) mq.addListener(spaeter);
  } catch (e) { /* egal */ }
  // Oben: zeichnet ein Screen seinen Kopf neu (z. B. der Verlauf nach dem Loeschen), kommt die Leiste wieder hinein
  if (typeof MutationObserver === 'function') {
    leiste.mo = new MutationObserver(() => {
      if (leiste.sichtbar && leiste.lage === 'oben' && !nav.isConnected) platziereReiter();
    });
  }
}

// Laeuft der Kopf ueber (Leiste und rechte Seite passen nicht) oder werden die Chips gequetscht?
// Gequetscht heisst: die ersten zwei Chips (Sterne, besiegte Bots) passen nicht ganz; weitere Chips der Pakete duerfen
// waagrecht scrollen. Gemessen mit sichtbaren Chips (.ohne-chips setzt js/ui/seite.js danach selbst neu).
function kopfZuEng(kopf) {
  if (!kopf) return true;
  const ohne = kopf.classList.contains('ohne-chips');
  if (ohne) kopf.classList.remove('ohne-chips');
  let eng = kopf.scrollWidth > kopf.clientWidth + 1;
  const chips = kopf.querySelector('.kopf-chips');
  if (!eng && chips) {
    const kinder = [...chips.children].filter((c) => c.offsetWidth > 0).slice(0, 2);
    const bedarf = kinder.length ? kinder[kinder.length - 1].offsetLeft + kinder[kinder.length - 1].offsetWidth - kinder[0].offsetLeft : 0;
    eng = chips.clientWidth + 1 < bedarf;
  }
  if (ohne) kopf.classList.add('ohne-chips');
  return eng;
}

function platziereReiter() {
  const nav = leiste.el;
  if (!nav) return;
  const screenEl = document.querySelector('#app > .screen');
  const platz = screenEl ? screenEl.querySelector('.kopf-reiter-platz') : null;
  let oben = false;
  try { oben = !!platz && matchMedia(OBEN_MQ).matches; } catch (e) { oben = false; }
  nav.classList.remove('eng', 'enger');
  for (const k of document.querySelectorAll('.haupt-kopf.mit-reiter')) {
    if (!platz || k !== platz.closest('.haupt-kopf')) k.classList.remove('mit-reiter', 'reiter-frei');
  }
  if (oben) {
    const kopf = platz.closest('.kopf');
    if (nav.parentNode !== platz) platz.append(nav);
    nav.dataset.lage = 'oben';
    if (kopf) { kopf.classList.add('mit-reiter'); kopf.classList.remove('reiter-frei'); }
    // passt sie nicht: erst engere Reiter, dann ohne Symbole, dann nicht mehr genau mittig, sonst unten
    const stufen = [() => nav.classList.add('eng'), () => nav.classList.add('enger'), () => kopf && kopf.classList.add('reiter-frei')];
    let i = 0;
    while (kopfZuEng(kopf) && i < stufen.length) stufen[i++]();
    if (kopfZuEng(kopf)) oben = false;
    if (!oben) {
      nav.classList.remove('eng', 'enger');
      if (kopf) kopf.classList.remove('mit-reiter', 'reiter-frei');
    }
  }
  let gestapelt = false;
  if (!oben) {
    if (nav.parentNode !== document.body) document.body.append(nav);
    nav.dataset.lage = 'unten';
    nav.classList.remove('gestapelt');
    // zu breit fuer eine Zeile (Handy mit vielen Reitern): volle Breite, Symbol ueber dem Wort
    if (nav.scrollWidth > nav.clientWidth + 1) { nav.classList.add('gestapelt'); gestapelt = true; }
  } else {
    nav.classList.remove('gestapelt');
  }
  leiste.lage = oben ? 'oben' : 'unten';
  const html = document.documentElement;
  html.dataset.reiter = leiste.lage;
  if (gestapelt) html.dataset.reiterForm = 'gestapelt';
  else delete html.dataset.reiterForm;
  if (leiste.mo) {
    leiste.mo.disconnect();
    const app0 = document.getElementById('app');
    if (oben && app0) leiste.mo.observe(app0, { childList: true, subtree: true });
  }
  setzePille();
}

// Pille unter den aktiven Reiter; gleitet mit der weichen Feder vom alten Platz (auch nach einem Screen-Wechsel, bei dem
// die Leiste in einen neuen Kopf umzieht und CSS-Uebergaenge nicht greifen)
function setzePille() {
  const nav = leiste.el;
  const p = leiste.pille;
  if (!nav || !p || !nav.isConnected || nav.hidden) return;
  const k = nav.querySelector('[aria-current="page"]');
  if (!k || !k.offsetWidth) { p.style.opacity = '0'; return; }
  const x = k.offsetLeft;
  const b = k.offsetWidth;
  p.style.opacity = '';
  if (leiste.pilleX != null && (leiste.pilleX !== x || leiste.pilleB !== b) && tempo() > 0) {
    anim(p, [{ transform: `translateX(${leiste.pilleX}px)`, width: `${leiste.pilleB}px` }, { transform: `translateX(${x}px)`, width: `${b}px` }],
      { d: 520, k: 'weich' });
  }
  p.style.transform = `translateX(${x}px)`;
  p.style.width = `${b}px`;
  leiste.pilleX = x;
  leiste.pilleB = b;
}

function versteckeReiter() {
  const html = document.documentElement;
  delete html.dataset.reiter;
  delete html.dataset.reiterWurzel;
  delete html.dataset.reiterListe;
  delete html.dataset.reiterForm;
  if (leiste.mo) leiste.mo.disconnect();
  const nav = leiste.el;
  if (!nav) return;
  const war = leiste.sichtbar;
  leiste.sichtbar = false;
  for (const k of document.querySelectorAll('.haupt-kopf.mit-reiter')) k.classList.remove('mit-reiter', 'reiter-frei');
  // oben ging die Leiste mit dem alten Kopf; unten faehrt sie weg (Partie, Analyse, Einstellungen)
  if (war && leiste.lage === 'unten' && nav.isConnected && !nav.hidden && tempo() > 0) {
    nav.classList.add('weg');
    const a = anim(nav, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(160%)', opacity: 0 }], { d: 420, k: 'gleiten', fill: 'forwards' });
    leiste.wegAnim = a;
    Promise.resolve(a.finished).catch(() => {}).then(() => {
      if (leiste.wegAnim !== a) return;
      leiste.wegAnim = null;
      nav.hidden = true;
      nav.classList.remove('weg');
      try { a.cancel(); } catch (e) { /* egal */ }
    });
  } else {
    nav.hidden = true;
    nav.classList.remove('weg');
  }
  if (nav.parentNode !== document.body) document.body.append(nav);
}

function zeigeReiter(screen) {
  const liste = reiterListe();
  const aktiv = screen ? reiterVon(screen, liste) : null;
  if (!liste.length || !aktiv) {
    versteckeReiter();
    return;
  }
  baueReiter(liste);
  const nav = leiste.el;
  const html = document.documentElement;
  for (const k of nav.querySelectorAll('[data-reiter]')) {
    if (k.dataset.reiter === aktiv) k.setAttribute('aria-current', 'page');
    else k.removeAttribute('aria-current');
  }
  html.dataset.reiterWurzel = aktiv === screen ? 'ja' : 'nein';
  html.dataset.reiterListe = liste.join(' ');
  const warWeg = leiste.gezeigt && (!leiste.sichtbar || !!leiste.wegAnim);
  if (leiste.wegAnim) { try { leiste.wegAnim.cancel(); } catch (e) { /* egal */ } leiste.wegAnim = null; }
  nav.classList.remove('weg');
  nav.hidden = false;
  leiste.sichtbar = true;
  platziereReiter();
  // zurueck aus Partie, Analyse oder Einstellungen: unten wieder einfahren
  if (warWeg && leiste.lage === 'unten') {
    anim(nav, [{ transform: 'translateY(160%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { d: 520, k: 'gleiten' });
  }
  leiste.gezeigt = true;
  if (leiste.fokusFolgt) {
    leiste.fokusFolgt = false;
    const a = nav.querySelector('[aria-current="page"]');
    if (a) { try { a.focus({ preventScroll: true }); } catch (e) { /* egal */ } }
  }
}

// ---------- Routing ----------

let aktuell = null;    // { name, params, hash, handle }
let ladeNr = 0;
let tiefe = 0;         // Anzahl eigener Eintraege im Browser-Verlauf vor dem aktuellen

function hashFuer(name, params) {
  if (name === 'analyse' && params && params.partieId) return '#analyse/' + encodeURIComponent(params.partieId);
  return '#' + name;
}

function ausHash(hash) {
  const h = String(hash || '').replace(/^#\/?/, '');
  const [name, rest] = h.split('/');
  if (name === 'analyse') return rest ? { name, params: { partieId: decodeURIComponent(rest) } } : { name: 'verlauf', params: {} };
  if (SCREENS.includes(name)) return { name, params: {} };
  return { name: 'arena', params: {} };
}

// Nur einfache Werte in den Verlauf (structured clone)
function sauber(params) {
  try { return JSON.parse(JSON.stringify(params || {})); } catch (e) { return {}; }
}

// Einmal-Effekte nicht im Browser-Verlauf ablegen: Zurueck oder Neuladen wuerden die
// Freischalt-Animation sonst erneut abspielen. Der neue Bot bleibt ueber waehle vorgewaehlt.
function fuerVerlauf(name, params) {
  const p = sauber(params);
  if (name === 'arena' && p.neuFreigeschaltet) {
    if (!p.waehle) p.waehle = p.neuFreigeschaltet;
    delete p.neuFreigeschaltet;
  }
  return p;
}

// Partie ueber Verlauf/Neuladen: nur fortsetzen, wenn eine laufende Partie gespeichert ist
function pruefeZiel(ziel) {
  if (ziel.name !== 'partie') return ziel;
  const laufend = ladeLaufendePartie();
  if (laufend) return { name: 'partie', params: { botId: laufend.botId, farbe: laufend.spielerFarbe, fortsetzen: true } };
  return { name: 'arena', params: {} };
}

function gehe(name, params = {}, { ersetzen = null } = {}) {
  if (!SCREENS.includes(name)) name = 'arena';
  // Eine (beendete oder pausierte) Partie bleibt nicht im Verlauf stehen, ausser fuer die Einstellungen
  const weg = ersetzen != null ? ersetzen : !!(aktuell && aktuell.name === 'partie' && name !== 'einstellungen');
  const hash = hashFuer(name, params);
  const neueTiefe = weg ? tiefe : tiefe + 1;
  const zustand = { schach: true, name, params: fuerVerlauf(name, params), tiefe: neueTiefe };
  try {
    if (weg) history.replaceState(zustand, '', hash);
    else history.pushState(zustand, '', hash);
  } catch (e) { /* z. B. file:// */ }
  tiefe = neueTiefe;
  zeigeScreen(name, params, hash);
}

function zurueck() {
  if (tiefe > 0) history.back();
  else gehe('arena', {}, { ersetzen: true });
}

function ausVerlauf() {
  const s = history.state;
  if (s && s.schach && SCREENS.includes(s.name)) {
    tiefe = Number(s.tiefe) || 0;
    let ziel = { name: s.name, params: s.params || {} };
    // Partie aus dem Verlauf: immer die gespeicherte laufende Partie fortsetzen
    return pruefeZiel(ziel);
  }
  tiefe = 0;
  return pruefeZiel(ausHash(location.hash));
}

// Wahl-Ort app:erster-screen? (z. B. ein Willkommens-Screen beim allerersten Start): nur ohne Hash
// und ohne eigenen Verlaufseintrag, also beim frischen Oeffnen der App
function ersterScreen() {
  if (String(location.hash || '').replace(/^#\/?/, '') || (history.state && history.state.schach)) return null;
  let wahl = null;
  try { wahl = waehle('app:erster-screen?', { partienZahl: ladePartien().length }); } catch (e) { wahl = null; }
  return typeof wahl === 'string' && SCREENS.includes(wahl) ? pruefeZiel({ name: wahl, params: {} }) : null;
}

function beiVerlauf() {
  const ziel = ersterScreen() || ausVerlauf();
  const hash = hashFuer(ziel.name, ziel.params);
  if (aktuell && aktuell.hash === hash && aktuell.name === ziel.name && ziel.name !== 'partie') return;
  if (hash !== location.hash || !(history.state && history.state.schach)) {
    try { history.replaceState({ schach: true, name: ziel.name, params: sauber(ziel.params), tiefe }, '', hash); } catch (e) { /* egal */ }
  }
  zeigeScreen(ziel.name, ziel.params, hash);
}

async function zeigeScreen(name, params, hash) {
  const nr = ++ladeNr;
  schliesseDialog();
  let modul = null;
  let ladeFehler = null;
  try {
    modul = await import(`./ui/${name}.js`);
    if (typeof modul.zeige !== 'function') throw new Error('zeige() fehlt in ui/' + name + '.js');
  } catch (e) {
    ladeFehler = e;
    modul = null;
  }
  if (nr !== ladeNr) return;  // inzwischen woanders hin
  if (aktuell && aktuell.handle) {
    try { aktuell.handle.verlasse(); } catch (e) { console.error(e); }
  }
  // Meldungen und ein offenes Blatt gehoeren zum alten Screen ("Zug zurückgenommen" nicht in der naechsten Partie)
  toastLeeren();
  schliesseSheet();
  const root = document.getElementById('app');
  root.replaceChildren();
  aktuell = { name, params, hash, handle: null };
  document.documentElement.dataset.screen = name;
  document.title = name === 'arena' ? 'Crownmate' : `${TITEL[name]} · Crownmate`;
  window.scrollTo(0, 0);
  if (!modul) {
    if (TEST) console.info('Screen nicht geladen: ' + name, ladeFehler && ladeFehler.message);
    // Screen eines Pakets, das (noch) nicht da ist: still zur Arena
    if (PAKET_SCREENS.has(name)) {
      aktuell.handle = { verlasse() {} };
      try { history.replaceState({ schach: true, name: 'arena', params: {}, tiefe }, '', '#arena'); } catch (e) { /* egal */ }
      zeigeScreen('arena', {}, '#arena');
      return;
    }
    aktuell.handle = zeigePlatzhalter(root, name);
    zeigeReiter(null);
    return;
  }
  try {
    aktuell.handle = modul.zeige(root, params || {}, app) || { verlasse() {} };
  } catch (e) {
    console.error(e);
    root.replaceChildren();
    aktuell.handle = zeigePlatzhalter(root, name, true);
    zeigeReiter(null);
    return;
  }
  zeigeReiter(name);
  sende('app:screen', { name, params: params || {} });
}

// Freundlicher Ersatz, wenn ein Screen-Modul nicht laedt (Netz) oder abstuerzt. Ein gescheiterter
// Modul-Import bleibt bis zum Neuladen im Browser haengen, deshalb der Knopf "Neu laden".
function zeigePlatzhalter(root, name, kaputt = false) {
  const s = document.createElement('section');
  s.className = 'screen platzhalter';
  s.setAttribute('aria-label', TITEL[name] || 'Bereich');
  s.innerHTML = `
    <header class="kopf">
      <button class="icon-knopf" type="button" data-aktion="zurueck" aria-label="Zurück">${icon('zurueck')}</button>
      <div class="titel"><h2></h2></div>
    </header>
    <div class="platzhalter-inhalt">
      <div class="platzhalter-karte flaeche">
        <div class="platzhalter-icon">${icon('ziel')}</div>
        <div class="logo">HOPPLA</div>
        <p></p>
        <button class="knopf primaer gross" type="button" data-aktion="neu-laden">${icon('nochmal')} Neu laden</button>
        <button class="knopf gross" type="button" data-aktion="arena">${icon('zurueck')} Zur Arena</button>
      </div>
    </div>`;
  s.querySelector('h2').textContent = TITEL[name] || 'Bereich';
  s.querySelector('p').textContent = kaputt
    ? 'Hier ist etwas schiefgegangen. Versuch es gleich noch einmal.'
    : `Der Bereich „${TITEL[name] || name}“ konnte nicht geladen werden. Prüfe die Internetverbindung und lade die App neu.`;
  s.querySelector('[data-aktion="zurueck"]').addEventListener('click', () => zurueck());
  s.querySelector('[data-aktion="neu-laden"]').addEventListener('click', () => location.reload());
  s.querySelector('[data-aktion="arena"]').addEventListener('click', () => gehe('arena', {}, { ersetzen: true }));
  root.append(s);
  return { verlasse() {} };
}

// ---------- App-Objekt ----------

export const app = {
  gehe,
  zurueck,
  engine,
  einstellungen: () => ladeEinstellungen(),
  setzeEinstellungen(teil) {
    const e = speichereEinstellungen(teil);
    wendeEinstellungenAn(e);
    return e;
  },
  meldung,
  frage,
  schliesseDialog,
  vorab: new Map(),
  test: TEST,
};

// ---------- Service Worker (offline, Updates; Bau C) ----------
// Nur ueber https oder localhost, Fehler bleiben still. Mit ?test nur zusammen mit ?sw, weil
// die Browser-Tests Anfragen abfangen (route), die sonst der Cache beantworten wuerde.
// Update: Die neue Version wartet. Liegt sie schon beim Start bereit, uebernimmt sie sofort
// (einmal neu laden), sonst erscheint der Hinweis "Neue Version" mit "Neu laden".
const SW_MERKER = 'schach-arena:sw-wechsel';
let updateHinweis = null;

function registriereSW() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const lokal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if (location.protocol !== 'https:' && !lokal) return;
  if (TEST && !/[?&]sw\b/.test(location.search)) return;
  const sw = navigator.serviceWorker;
  let wechsel = false;
  sw.addEventListener('controllerchange', () => {
    if (!wechsel) return;
    wechsel = false;
    location.reload();
  });
  const aktiviere = (w) => {
    wechsel = true;
    try { sessionStorage.setItem(SW_MERKER, String(Date.now())); } catch (e) { /* egal */ }
    // laufende Partie sichern (verlasse speichert den Stand), dann uebernimmt die neue Version
    if (aktuell && aktuell.handle) { try { aktuell.handle.verlasse(); } catch (e) { /* egal */ } aktuell.handle = null; }
    w.postMessage('aktivieren');
    setTimeout(() => location.reload(), 4000);   // falls controllerchange ausbleibt
  };
  const kuerzlich = () => {
    try { return Date.now() - Number(sessionStorage.getItem(SW_MERKER) || 0) < 15000; } catch (e) { return true; }
  };
  sw.register('sw.js').then((reg) => {
    if (reg.waiting && sw.controller) {
      const inPartie = (aktuell && aktuell.name === 'partie') || /^#partie/.test(location.hash);
      if (!kuerzlich() && !inPartie) aktiviere(reg.waiting);
      else zeigeUpdateHinweis(() => aktiviere(reg.waiting));
    }
    reg.addEventListener('updatefound', () => {
      const neu = reg.installing;
      if (!neu) return;
      neu.addEventListener('statechange', () => {
        if (neu.state === 'installed' && sw.controller) zeigeUpdateHinweis(() => aktiviere(neu));
      });
    });
    // Home-Bildschirm-Apps bleiben lange offen: beim Zurueckkehren hoechstens stuendlich nachsehen
    let geprueft = Date.now();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || Date.now() - geprueft < 3600000) return;
      geprueft = Date.now();
      reg.update().catch(() => {});
    });
  }).catch(() => { /* ohne Service Worker geht es auch, nur nicht offline */ });
}

function zeigeUpdateHinweis(neuLaden) {
  if (updateHinweis) updateHinweis.remove();
  const h = document.createElement('div');
  h.className = 'update-hinweis';
  h.setAttribute('role', 'status');
  h.setAttribute('aria-live', 'polite');
  h.innerHTML = `<span class="u-text">Neue Version<span class="u-lang"> verfügbar</span></span>
    <button class="knopf primaer" type="button" data-aktion="neu-laden">${icon('nochmal')} Neu laden</button>
    <button class="icon-knopf" type="button" data-aktion="spaeter" aria-label="Später">${icon('kreuz')}</button>`;
  h.querySelector('[data-aktion="neu-laden"]').addEventListener('click', () => { h.remove(); neuLaden(); });
  h.querySelector('[data-aktion="spaeter"]').addEventListener('click', () => { h.remove(); updateHinweis = null; });
  document.body.append(h);
  updateHinweis = h;
}

// ---------- iPad: Safari-Tab oder Home-Bildschirm ----------
// Auf iOS hat die App vom Home-Bildschirm einen eigenen Speicher, der Fortschritt aus dem
// Safari-Tab wird nicht uebernommen (und Safari loescht Tab-Daten nach 7 Tagen ohne Besuch).
// navigator.standalone gibt es nur auf iOS: false = Safari-Tab, true = Home-Bildschirm.
const HINWEIS_MERKER = 'schach-arena:v1:hinweis-installieren';
function pruefeInstallation() {
  if (typeof navigator === 'undefined') return;
  // Home-Bildschirm-App: dauerhaften Speicher fragt starte() an (W0+a: storage.dauerhaftAnfragen, fuer alle)
  if (navigator.standalone === true) return;
  if (navigator.standalone !== false) return;
  try {
    if (localStorage.getItem(HINWEIS_MERKER)) return;
    localStorage.setItem(HINWEIS_MERKER, '1');
  } catch (e) { return; }
  setTimeout(() => frage({
    titel: 'Tipp: Als App speichern',
    text: 'Tippe auf Teilen und dann auf „Zum Home-Bildschirm“. Als App bleibt dein Fortschritt dauerhaft erhalten. Was du hier im Safari-Tab spielst, wird nicht in die App übernommen.',
    knoepfe: [{ text: 'Verstanden', wert: true, art: 'primaer' }],
    abbrechen: true,
  }), 1200);
}

// ---------- Pakete (PAKETE aus erweiterungen.js, im Testmodus dazu ?test&erw=pakete/x/index) ----------
// Pfade relativ zu js/, ohne Endung, nur Kleinbuchstaben, Ziffern, "-" und "/" (kein "..", kein
// fremder Server). Alles andere wird ignoriert. Ohne ?test gibt es den Weg ueber ?erw nicht.
const ERW_PFAD = /^[a-z0-9-]+(\/[a-z0-9-]+)*$/;
// So lange wartet der Start hoechstens auf die Pakete (ein Paket, das nie fertig wird, haelt die App nicht auf)
const PAKETE_WARTEN_MS = 10000;
export function erwPfade(suche) {
  let wert = null;
  try { wert = new URLSearchParams(suche || '').get('erw'); } catch (e) { wert = null; }
  if (!wert) return [];
  return [...new Set(wert.split(',').map((t) => t.trim()).filter((t) => ERW_PFAD.test(t)))];
}

// Jedes Paket einzeln per import(): ein Fehler in einem Paket stoppt weder die anderen noch die App
function ladePakete() {
  const kern = TEST && new URLSearchParams(location.search).has('kern');
  const liste = Array.isArray(PAKETE) ? PAKETE.filter((p) => typeof p === 'string' && ERW_PFAD.test(p) && !(kern && p.startsWith('pakete/'))) : [];
  const pfade = [...new Set([...liste, ...(TEST ? erwPfade(location.search) : [])])];
  if (!pfade.length) return null;
  const alle = Promise.all(pfade.map((p) => import(`./${p}.js`).catch((e) => {
    console.error('Paket nicht geladen: ' + p, e);
  })));
  let uhr = 0;
  const zeit = new Promise((r) => {
    uhr = setTimeout(() => { console.error('Pakete laden zu lange, die App startet ohne zu warten'); r(); }, PAKETE_WARTEN_MS);
  });
  return Promise.race([alle, zeit]).then(() => clearTimeout(uhr));
}

// ---------- Sichtbarkeit (Tab im Hintergrund, iPad gesperrt) ----------
function setzeSichtbar() {
  const sichtbar = document.visibilityState !== 'hidden';
  document.documentElement.dataset.sichtbar = sichtbar ? 'ja' : 'nein';
  return sichtbar;
}

// ---------- Start ----------

function starte() {
  setzeSymbole(SYMBOLE);
  wendeEinstellungenAn(ladeEinstellungen());
  starteDruck();
  setzeSichtbar();
  document.addEventListener('visibilitychange', () => sende('app:sichtbar', { sichtbar: setzeSichtbar() }));
  // Klang: der AudioContext darf auf iOS erst nach der ersten Beruehrung starten
  const entsperren = () => {
    klang.aktivieren();
    if (klang.zustand() === 'bereit') {
      for (const t of ['pointerup', 'touchend', 'keydown']) document.removeEventListener(t, entsperren, true);
    }
  };
  for (const t of ['pointerup', 'touchend', 'keydown']) document.addEventListener(t, entsperren, true);
  if (TEST) window.__app = app;
  // W0+a: dauerhaften Speicher anfragen (Safari loescht Web-App-Speicher sonst nach Tagen ohne Nutzung)
  dauerhaftAnfragen();
  // Pakete zuerst laden (PAKETE, im Testmodus dazu ?erw), dann app:bereit und der erste Screen
  const pakete = ladePakete();
  if (pakete) pakete.then(() => { themaNachPaketen(); ersterStart(); });
  else ersterStart();
}

function ersterStart() {
  window.addEventListener('popstate', beiVerlauf);
  window.addEventListener('hashchange', () => {
    if (aktuell && location.hash === aktuell.hash) return;  // schon ueber popstate erledigt
    beiVerlauf();
  });
  sende('app:bereit', { app });
  beiVerlauf();
  pruefeInstallation();
  // W0+a: Analysen ueber MAX_REVIEWS still entfernen (nach dem ersten Screen, bremst den Start nicht)
  setTimeout(() => { try { duenneAnalysenAus(); } catch (e) { /* egal */ } }, 0);
  // erst nach dem Laden, damit das Vorladen des Caches den Start nicht bremst
  if (document.readyState === 'complete') registriereSW();
  else window.addEventListener('load', registriereSW, { once: true });
}

if (typeof document !== 'undefined' && document.getElementById('app')) starte();
