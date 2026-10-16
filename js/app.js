// Schach-Arena: App-Rahmen. Routing per location.hash, Screens als Module (js/ui/<name>.js),
// gemeinsame Dienste fuer alle Screens (Engines, Einstellungen, Meldungen, Rueckfragen).
//
// Vertrag (ARCHITEKTUR.md "Runde 2"): jedes Screen-Modul exportiert
//   zeige(root, params, app) -> { verlasse() }
// app = { gehe, zurueck, engine, einstellungen, setzeEinstellungen, meldung, vorab }
// Zusaetze: app.frage({ titel, text, knoepfe: [{ text, wert, art }], abbrechen }) -> Promise<wert>
//           (Rueckfrage-Dialog), app.schliesseDialog() (offene Rueckfrage mit "abbrechen" schliessen),
//           app.test (true bei ?test in der URL).
// Ausserdem exportiert: icon(name, klasse) -> SVG-Text der gemeinsamen Strich-Icons.
// Registriert sw.js (Offline-Cache) und zeigt bei einer neuen Version den Hinweis "Neu laden".
import { Engine } from './engine.js';
import { klang } from './sounds.js';
import { setzeSymbole } from './board.js';
import { SYMBOLE } from './symbole.js';
import { ladeEinstellungen, speichereEinstellungen, ladeLaufendePartie } from './storage.js';

const SCREENS = ['arena', 'partie', 'analyse', 'verlauf', 'einstellungen'];
const TITEL = { arena: 'Arena', partie: 'Partie', analyse: 'Spielanalyse', verlauf: 'Verlauf', einstellungen: 'Einstellungen' };
const TEST = typeof location !== 'undefined' && /[?&]test\b/.test(location.search);

// ---------- Icons (24er Raster, Strich; Quelle design/neon/werkzeug/baue-mockup.mjs) ----------
const ICONS = {
  zurueck: '<path d="M15 5 8 12l7 7"/>',
  vor: '<path d="M9 5l7 7-7 7"/>',
  einst: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
  verlauf: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  hinweis: '<path d="M9.2 17.5h5.6M10.2 20.5h3.6M12 3.2a6.2 6.2 0 0 0-3.7 11.2c.6.5 .9 1.2.9 2h5.6c0-.8.3-1.5.9-2A6.2 6.2 0 0 0 12 3.2z"/>',
  undo: '<path d="M9 5 4 10l5 5M4 10h10.5a5 5 0 0 1 0 10H11"/>',
  drehen: '<path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5"/>',
  flagge: '<path d="M5.5 21V4M5.5 4.5h11l-2.2 4 2.2 4h-11"/>',
  schloss: '<rect x="5" y="11" width="14" height="9.5" rx="2.2"/><path d="M8.2 11V8.2a3.8 3.8 0 0 1 7.6 0V11"/>',
  offen: '<rect x="5" y="11" width="14" height="9.5" rx="2.2"/><path d="M8.2 11V8.2a3.8 3.8 0 0 1 7.3-1.4"/>',
  pokal: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5.2a3 3 0 0 0 3 4M16 6h2.8a3 3 0 0 1-3 4M12 13v4M8.5 20.5h7M10 17h4v3.5h-4z"/>',
  pfeil: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  nochmal: '<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5"/>',
  ziel: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  blitz: '<path d="M13 3 5 13.5h6L10 21l9-11h-6.2z" fill="currentColor" stroke="none"/>',
  analyse: '<path d="M4 19h16M6 15l4-5 3 3 5-7"/>',
  auge: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  kreuz: '<path d="M6 6l12 12M18 6 6 18"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  stern: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" fill="currentColor" stroke="none"/>',
  baustelle: '<path d="M3 20h18M5 20l3.5-12h7L19 20M7.2 14h9.6M12 8V4"/>',
};

export function icon(name, klasse = '') {
  const inhalt = ICONS[name] || '';
  return `<svg class="ico${klasse ? ' ' + klasse : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inhalt}</svg>`;
}

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
const WASM_PFAD = 'vendor/stockfish/stockfish-19-lite-single.wasm';
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

export function pruefeWasm({ simdTest = SIMD_TEST, pfad = WASM_PFAD } = {}) {
  if (!wasmPruefung) {
    const p = (async () => {
      if (typeof WebAssembly !== 'object' || typeof WebAssembly.validate !== 'function') throw dauerhafterFehler('kein-wasm');
      if (!WebAssembly.validate(simdTest)) throw dauerhafterFehler('kein-simd');
      if (typeof fetch !== 'function') return;
      const antwort = await fetch(pfad);   // kommt offline aus dem Cache des Service Workers
      if (!antwort.ok) throw new Error('Engine-Datei nicht erreichbar (' + antwort.status + ')');
      if (!WebAssembly.validate(new Uint8Array(await antwort.arrayBuffer()))) throw dauerhafterFehler('wasm-kaputt');
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

const engines = new Map();
function engine(name) {
  const schluessel = name === 'bot' ? 'bot' : 'bewertung';
  let p = engines.get(schluessel);
  if (!p) {
    const e = new Engine();
    p = pruefeWasm().then(() => e.init()).then(() => e);
    p.catch((f) => {
      meldeEngineFehler(f);
      // dauerhafte Fehler bleiben stehen (sofortige Absage statt neuer Versuche je Zug)
      if (!(f && f.dauerhaft) && engines.get(schluessel) === p) engines.delete(schluessel);
      try { e.terminate(); } catch (g) { /* egal */ }
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

function beiVerlauf() {
  const ziel = ausVerlauf();
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
    aktuell.handle = zeigePlatzhalter(root, name);
    return;
  }
  try {
    aktuell.handle = modul.zeige(root, params || {}, app) || { verlasse() {} };
  } catch (e) {
    console.error(e);
    root.replaceChildren();
    aktuell.handle = zeigePlatzhalter(root, name, true);
  }
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

// ---------- Start ----------

function starte() {
  setzeSymbole(SYMBOLE);
  wendeEinstellungenAn(ladeEinstellungen());
  // Klang: der AudioContext darf auf iOS erst nach der ersten Beruehrung starten
  const entsperren = () => {
    klang.aktivieren();
    if (klang.zustand() === 'bereit') {
      for (const t of ['pointerup', 'touchend', 'keydown']) document.removeEventListener(t, entsperren, true);
    }
  };
  for (const t of ['pointerup', 'touchend', 'keydown']) document.addEventListener(t, entsperren, true);

  window.addEventListener('popstate', beiVerlauf);
  window.addEventListener('hashchange', () => {
    if (aktuell && location.hash === aktuell.hash) return;  // schon ueber popstate erledigt
    beiVerlauf();
  });
  if (TEST) window.__app = app;
  beiVerlauf();
  pruefeInstallation();
  // erst nach dem Laden, damit das Vorladen des Caches den Start nicht bremst
  if (document.readyState === 'complete') registriereSW();
  else window.addEventListener('load', registriereSW, { once: true });
}

if (typeof document !== 'undefined' && document.getElementById('app')) starte();
