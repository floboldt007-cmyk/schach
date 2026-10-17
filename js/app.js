// Schach-Arena: App-Rahmen. Routing per location.hash, Screens als Module (js/ui/<name>.js),
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
//     hoechstens PAKETE_WARTEN_MS auch dann, wenn ein Paket nie fertig wird)
//   - Screens 'training' und 'start' gehoeren Paketen: fehlt ihre Datei, geht es still zur Arena
//   - sendet app:bereit (einmal vor dem ersten Screen), app:screen (nach zeige() eines Screens) und
//     app:sichtbar (bei visibilitychange; setzt html[data-sichtbar="ja"|"nein"])
//   - Wahl-Ort app:erster-screen? (nur ohne Hash und ohne Verlaufseintrag), kontext { partienZahl }
//   - speicher:fehler: einmal je Sitzung ein Hinweis, dass der Speicher voll ist
import { PAKETE } from './erweiterungen.js';
import { Engine } from './engine.js';
import { klang } from './sounds.js';
import { setzeSymbole } from './board.js';
import { SYMBOLE } from './symbole.js';
import { ladeEinstellungen, speichereEinstellungen, ladeLaufendePartie, ladePartien } from './storage.js';
import { icon } from './ui/icons.js';
import { hoere, sende } from './ereignisse.js';
import { waehle } from './orte.js';

// icon bleibt hier exportiert (Rueckwaertskompatibel fuer die Screens)
export { icon };

const SCREENS = ['arena', 'partie', 'analyse', 'verlauf', 'einstellungen', 'training', 'start'];
const TITEL = {
  arena: 'Arena', partie: 'Partie', analyse: 'Spielanalyse', verlauf: 'Verlauf', einstellungen: 'Einstellungen',
  training: 'Training', start: 'Willkommen',
};
// Screens aus Paketen (Runde 4): fehlt die Datei, geht es ohne Hinweis zur Arena
const PAKET_SCREENS = new Set(['training', 'start']);
const TEST = typeof location !== 'undefined' && /[?&]test\b/.test(location.search);

// ---------- Einstellungen ----------

function wendeEinstellungenAn(e) {
  klang.aus = !e.klang;
  const html = document.documentElement;
  html.dataset.brett = e.brett;
  html.dataset.koordinaten = e.koordinaten ? 'an' : 'aus';
  html.dataset.balken = e.balken ? 'an' : 'aus';
  html.dataset.live = e.liveBewertung ? 'an' : 'aus';
  window.dispatchEvent(new CustomEvent('schach:einstellungen', { detail: e }));
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

let toastOrt = null;
let toastUhr = 0;
function meldung(text, { art = 'info', dauer = 3200 } = {}) {
  if (!toastOrt) {
    toastOrt = document.createElement('div');
    toastOrt.className = 'toast-ort';
    toastOrt.setAttribute('role', 'status');
    toastOrt.setAttribute('aria-live', 'polite');
    document.body.append(toastOrt);
  }
  const t = document.createElement('div');
  t.className = 'toast ' + (art === 'fehler' ? 'fehler' : 'info');
  t.textContent = String(text);
  toastOrt.replaceChildren(t);
  clearTimeout(toastUhr);
  toastUhr = setTimeout(() => {
    t.classList.add('weg');
    toastUhr = setTimeout(() => t.remove(), 320);
  }, dauer);
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
  // Meldungen gehoeren zum alten Screen ("Zug zurückgenommen" nicht in der naechsten Partie)
  if (toastOrt) { clearTimeout(toastUhr); toastOrt.replaceChildren(); }
  const root = document.getElementById('app');
  root.replaceChildren();
  aktuell = { name, params, hash, handle: null };
  document.documentElement.dataset.screen = name;
  document.title = name === 'arena' ? 'Schach-Arena' : `${TITEL[name]} · Schach-Arena`;
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
    return;
  }
  try {
    aktuell.handle = modul.zeige(root, params || {}, app) || { verlasse() {} };
  } catch (e) {
    console.error(e);
    root.replaceChildren();
    aktuell.handle = zeigePlatzhalter(root, name, true);
    return;
  }
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
  if (navigator.standalone === true) {
    // Home-Bildschirm-App: Speicher als dauerhaft markieren (WebKit gewaehrt das)
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* egal */ }
    return;
  }
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
  const liste = Array.isArray(PAKETE) ? PAKETE.filter((p) => typeof p === 'string' && ERW_PFAD.test(p)) : [];
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
  // Pakete zuerst laden (PAKETE, im Testmodus dazu ?erw), dann app:bereit und der erste Screen
  const pakete = ladePakete();
  if (pakete) pakete.then(ersterStart);
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
  // erst nach dem Laden, damit das Vorladen des Caches den Start nicht bremst
  if (document.readyState === 'complete') registriereSW();
  else window.addEventListener('load', registriereSW, { once: true });
}

if (typeof document !== 'undefined' && document.getElementById('app')) starte();
