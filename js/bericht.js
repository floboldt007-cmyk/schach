// "Bericht fuer die Testphase" (Luecken-Check 10, BAUPLAN 2D Punkt 8, Gesamtschau T7). Klartext NUR mit Zaehlern und
// Geraete-Fakten, damit Flo auf dem iPad (ohne Mac, also ohne Web-Inspektor) sehen und weitergeben kann, was die Testphase
// braucht. Der ganze Text steht vorher im Blatt; Kopieren und Teilen loest nur Flo aus. Die App sendet selbst nie etwas:
// kein fetch, kein Beacon, keine Adresse (tests/bericht.test.mjs prueft den Quelltext).
// Nie im Bericht: E-Mail, Konto-ID, Token, Namen aus "Zu zweit" oder andere freie Texte, Zuege oder FEN.
//
// Einstieg: Gruppe "Info und Lizenzen" in js/ui/einstellungen.js laedt diese Datei erst beim Tipp (import()), damit ein
// Fehler hier nie den Einstellungs-Screen stoppt.
//
// API:
//   zeigeBericht(app) -> Promise   sammelt die Fakten, oeffnet das Blatt (sheet aus js/ui/bauteile.js) mit dem Text und den
//       Knoepfen Kopieren, Teilen (nur mit navigator.share), Fehlerliste leeren und Schliessen
//   sammleFakten() -> Promise<Fakten>   App-Version und Stand (Nachricht 'version' an den Service Worker, sonst null),
//       Sprache, Home-Bildschirm, persisted(), estimate(), speicherStand(), WASM-SIMD, letzte Engine-Startzeit
//       (js/protokoll.js), Klang (klang.zustand(), vorrat()), System und Browser (nur Familie und Hauptversion),
//       Bildschirm-Klasse, Spielzaehler und das Fehlerprotokoll
//   berichtText(fakten) -> Text   rein, ohne DOM, in der Sprache der App (t())
//   spielZaehler(partien, { heute, raetsel, kartei, botName }) -> Zaehler   rein; Tage aus js/tag.js (Grenze 4:00)
//   systemAus(userAgent, { touch }) -> { system, browser }   rein, z. B. { system: 'iPadOS 18', browser: 'Safari 18' }
//   groesseVon(breite, hoehe) -> { klasse: 'klein' | 'mittel' | 'gross', lage: 'quer' | 'hoch' }   rein
//   kopiere(text) -> Promise<'zwischenablage' | 'auswahl'>   navigator.clipboard, sonst Textfeld + execCommand('copy')
//
// Klassen: Blatt .sheet-karte.bericht-blatt, Text pre.bericht-text, Status .bericht-status, Knoepfe
// [data-knopf="kopieren" | "teilen" | "leeren" | "schliessen"] (Stil in css/einstellungen.css).
import { ladePartien, ladeModul, speicherStand, dauerhaftStatus } from './storage.js';
import { botNachId } from './bots.js';
import { tagSchluessel, tageZwischen, istSchluessel } from './tag.js';
import { eintraege, leere, engineStart, bereinige, dateiName } from './protokoll.js';
import { klang } from './sounds.js';
import { sheet } from './ui/bauteile.js';
import { t, sprache, datum, zahl } from './sprache.js';
import './sprachen/allgemein.js';
import './sprachen/bericht.js';

const B = (k, w) => t('bericht.' + k, w);
// kleinstes Modul mit einem SIMD-Befehl (v128), gleich SIMD_TEST in js/app.js
const SIMD_TEST = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);
const FRIST_MS = 1200;

// ---------- reine Teile ----------
export function systemAus(userAgent = '', { touch = 0 } = {}) {
  const s = String(userAgent || '');
  let m;
  // Safari auf iPhone und iPad: "Version/<n>" ist die Version des Systems (ab iOS 26 bleibt "OS 18_6" im Agenten stehen);
  // in der Home-Bildschirm-App fehlt "Version/", dann gilt "OS <n>_"
  const version = (m = /\bVersion\/(\d+)/.exec(s)) ? m[1] : ((m = /\bOS (\d+)[_.]/.exec(s)) ? m[1] : '');
  let system = '';
  if (/\biPad\b/.test(s) || (/Macintosh/.test(s) && Number(touch) > 1)) system = 'iPadOS' + (version ? ' ' + version : '');
  else if (/\b(?:iPhone|iPod)\b/.test(s)) system = 'iOS' + (version ? ' ' + version : '');
  else if ((m = /\bAndroid (\d+)/.exec(s))) system = 'Android ' + m[1];
  else if (/\bCrOS\b/.test(s)) system = 'ChromeOS';
  else if (/\bWindows\b/.test(s)) system = 'Windows';
  else if (/Macintosh|Mac OS X/.test(s)) system = 'macOS';
  else if (/\bLinux\b/.test(s)) system = 'Linux';
  let browser = '';
  if ((m = /\bEdg(?:e|A|iOS)?\/(\d+)/.exec(s))) browser = 'Edge ' + m[1];
  else if ((m = /(?:CriOS|Chrome)\/(\d+)/.exec(s))) browser = 'Chrome ' + m[1];   // auch "HeadlessChrome"
  else if ((m = /\b(?:FxiOS|Firefox)\/(\d+)/.exec(s))) browser = 'Firefox ' + m[1];
  else if ((m = /\bVersion\/(\d+)[^ ]* .*Safari\//.exec(s))) browser = 'Safari ' + m[1];
  else if (/AppleWebKit/.test(s)) browser = 'WebKit';
  return { system, browser };
}

export function groesseVon(breite, hoehe) {
  const b = Number(breite) || 0;
  const h = Number(hoehe) || 0;
  const kurz = Math.min(b, h);
  return { klasse: kurz < 600 ? 'klein' : kurz < 1100 ? 'mittel' : 'gross', lage: b > h ? 'quer' : 'hoch' };
}

const runde = (x, stellen = 1) => Math.round(x * 10 ** stellen) / 10 ** stellen;
const ERGEBNISSE = new Set(['sieg', 'remis', 'niederlage']);

// Zaehler aus dem, was die App ohnehin lokal speichert. Nur Zahlen und der Name eines Bots, nie Spielernamen (Zu zweit),
// Zuege oder Stellungen.
export function spielZaehler(partien, { heute = tagSchluessel(), raetsel = null, kartei = null, botName = (id) => botNachId(id)?.name || '' } = {}) {
  const liste = (Array.isArray(partien) ? partien : []).filter((p) => p && typeof p === 'object')
    .map((p) => ({ p, ms: Date.parse(p.datum) })).filter((x) => Number.isFinite(x.ms)).sort((a, b) => b.ms - a.ms);
  const abstand = (tag) => { try { return tageZwischen(tag, heute); } catch (e) { return -1; } };
  const tage7 = new Set();
  const tage28 = new Set();
  let partien28 = 0;
  let uebungen28 = 0;
  let hinweise = 0;
  for (const { p, ms } of liste) {
    const tag = tagSchluessel(ms);
    const d = abstand(tag);
    if (d < 0 || d >= 28) continue;
    tage28.add(tag);
    if (d < 7) tage7.add(tag);
    partien28++;
    if (p.modus === 'uebung') uebungen28++;
    const h = Number(p.hinweise);
    if (Number.isFinite(h) && h > 0) hinweise += h;
  }
  // Partien gegen Bots ohne Uebungen (Zu zweit hat keinen botId): letzter Sieg und Niederlagen in Folge, neueste zuerst
  const gegenBots = liste.map((x) => x.p).filter((p) => typeof p.botId === 'string' && p.botId && ERGEBNISSE.has(p.ergebnis)
    && p.modus !== 'zuzweit' && p.modus !== 'uebung');
  let letzterSieg = '';
  for (const p of gegenBots) {
    if (p.ergebnis !== 'sieg') continue;
    letzterSieg = String(botName(p.botId) || '');
    if (letzterSieg) break;
  }
  let folge = 0;
  for (const p of gegenBots) {
    if (p.ergebnis !== 'niederlage') break;
    folge++;
  }
  // Tagesraetsel: Modul { tage: { 'JJJJ-MM-TT': { e: [[fehlversuche, richtig 0|1] | null, ...] } } }
  let raetsel28 = null;
  if (raetsel && typeof raetsel === 'object' && raetsel.tage && typeof raetsel.tage === 'object') {
    raetsel28 = { geloest: 0, versucht: 0 };
    for (const [tag, eintrag] of Object.entries(raetsel.tage)) {
      if (!istSchluessel(tag) || !eintrag || !Array.isArray(eintrag.e)) continue;
      const d = abstand(tag);
      if (d < 0 || d >= 28) continue;
      for (const x of eintrag.e) {
        if (!Array.isArray(x)) continue;
        raetsel28.versucht++;
        if (x[1] === 1) raetsel28.geloest++;
      }
    }
  }
  // Fehler-Kartei: Modul { karten: [{ geuebt: 'JJJJ-MM-TT' | '' }] }
  let karten = null;
  if (kartei && typeof kartei === 'object' && Array.isArray(kartei.karten)) {
    const geuebt = kartei.karten.filter((k) => k && istSchluessel(k.geuebt) && abstand(k.geuebt) >= 0 && abstand(k.geuebt) < 28).length;
    karten = { geuebt28: geuebt, gesamt: kartei.karten.length };
  }
  return {
    tage7: tage7.size,
    tage28: tage28.size,
    partien28,
    uebungen28,
    jeSpieltag: tage28.size ? runde(partien28 / tage28.size) : 0,
    hinweiseJePartie: partien28 ? runde(hinweise / partien28) : null,
    letzterSieg,
    niederlagenFolge: folge,
    raetsel28,
    karten,
  };
}

const jaNein = (w) => (w === true ? B('ja') : w === false ? B('nein') : B('unbekannt'));
const SPRACHNAME = { de: 'Deutsch', en: 'English' };

function fehlerZeile(e) {
  const zeit = Number.isFinite(e.z) ? datum(new Date(e.z), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  // noch einmal bereinigt (das Protokoll speichert schon bereinigt; doppelt haelt besser, falls Fremdes hineinkommt)
  const datei = dateiName(e.datei);
  const ort = datei ? datei + (Number.isInteger(e.zeile) && e.zeile > 0 ? ':' + e.zeile : '') : '';
  const art = ['fehler', 'promise', 'skript', 'paket', 'engine', 'speicher'].includes(e.art) ? B('art.' + e.art) : B('art.fehler');
  const teile = [zeit, art, ort, bereinige(e.text), Number.isInteger(e.n) && e.n > 1 ? B('fehler.mal', { n: e.n }) : ''].filter(Boolean);
  return '- ' + teile.join(' · ');
}

export function berichtText(f = {}) {
  const app = f.app || {};
  const g = f.geraet || {};
  const s = f.speicher || {};
  const sp = f.spiel || null;
  const fehler = Array.isArray(f.fehler) ? f.fehler : [];
  const z = [];
  z.push(B('titel'));
  z.push(B('erstellt', { zeit: datum(new Date(Number(f.erstellt) || Date.now()), { dateStyle: 'medium', timeStyle: 'short' }) }));
  z.push(B('hinweis'));
  z.push('', B('k.app'));
  z.push('- ' + (app.version != null ? B('app.version', { version: app.version, stand: app.stand || B('unbekannt') }) : B('app.ohneSw')));
  z.push('- ' + B('app.sprache', { sprache: SPRACHNAME[app.sprache] || B('unbekannt') }));
  z.push('- ' + B('app.homescreen', { wert: jaNein(g.homescreen) }));
  z.push('', B('k.geraet'));
  z.push('- ' + B('geraet.system', { system: g.system || B('unbekannt') }));
  z.push('- ' + B('geraet.browser', { browser: g.browser || B('unbekannt') }));
  if (g.groesse) z.push('- ' + B('geraet.bildschirm', { klasse: B('geraet.' + g.groesse.klasse), lage: B('geraet.' + g.groesse.lage) }));
  z.push('- ' + B('geraet.simd', { wert: jaNein(g.simd) }));
  z.push('- ' + (Number.isFinite(g.engineMs) ? B('geraet.engine', { ms: zahl(g.engineMs) }) : B('geraet.engineNie')));
  if (g.klang && g.klang.zustand) {
    const zustand = B('klang.' + g.klang.zustand);
    z.push('- ' + (g.klang.dateien ? B('geraet.klang', { zustand, paket: g.klang.paket || '-', geladen: zahl(g.klang.geladen || 0),
      dateien: zahl(g.klang.dateien), fehlt: zahl(g.klang.fehlt || 0) }) : B('geraet.klangKurz', { zustand })));
  }
  z.push('', B('k.speicher'));
  z.push('- ' + B('speicher.dauerhaft', { wert: jaNein(s.dauerhaft) }));
  z.push('- ' + (Number.isFinite(s.belegtMb) && Number.isFinite(s.quoteMb)
    ? B('speicher.schaetzung', { belegt: zahl(s.belegtMb, { maximumFractionDigits: 1 }), quote: zahl(s.quoteMb, { maximumFractionDigits: 0 }) })
    : B('speicher.schaetzungFehlt')));
  if (Number.isFinite(s.zeichen)) {
    const prozent = s.grenze > 0 ? Math.round((s.zeichen / s.grenze) * 100) : 0;
    z.push('- ' + B('speicher.spielstand', { kb: zahl(s.zeichen / 1024, { maximumFractionDigits: 1 }), prozent: zahl(prozent) }));
  }
  if (sp) {
    z.push('', B('k.spielen'));
    z.push('- ' + B('spiel.tage', { t7: zahl(sp.tage7), t28: zahl(sp.tage28) }));
    z.push('- ' + B('spiel.partien', { n: zahl(sp.partien28), je: zahl(sp.jeSpieltag, { maximumFractionDigits: 1 }), uebungen: zahl(sp.uebungen28) }));
    if (sp.hinweiseJePartie != null) z.push('- ' + B('spiel.hinweise', { wert: zahl(sp.hinweiseJePartie, { maximumFractionDigits: 1 }) }));
    z.push('- ' + (sp.letzterSieg ? B('spiel.sieg', { name: sp.letzterSieg }) : B('spiel.keinSieg')));
    z.push('- ' + B('spiel.folge', { n: zahl(sp.niederlagenFolge) }));
    if (sp.raetsel28) z.push('- ' + B('spiel.raetsel', { geloest: zahl(sp.raetsel28.geloest), versucht: zahl(sp.raetsel28.versucht) }));
    if (sp.karten) z.push('- ' + B('spiel.karten', { geuebt: zahl(sp.karten.geuebt28), gesamt: zahl(sp.karten.gesamt) }));
  }
  z.push('', B('k.fehler', { n: zahl(fehler.length) }));
  if (!fehler.length) z.push(B('fehler.keine'));
  for (const e of fehler) z.push(fehlerZeile(e));
  return z.join('\n');
}

// ---------- Fakten sammeln (Browser) ----------
function mitFrist(versprechen, ms = FRIST_MS, ersatz = null) {
  return new Promise((fertig) => {
    const u = setTimeout(() => fertig(ersatz), ms);
    Promise.resolve(versprechen).then((w) => { clearTimeout(u); fertig(w); }, () => { clearTimeout(u); fertig(ersatz); });
  });
}

// Version und Stand fragt die App beim Service Worker nach (Nachricht 'version', sw.js); ohne ihn: null
function swVersion() {
  return new Promise((fertig) => {
    try {
      const sw = globalThis.navigator && globalThis.navigator.serviceWorker;
      if (!sw || !sw.controller || typeof sw.addEventListener !== 'function') { fertig(null); return; }
      let uhr = null;
      const an = (e) => {
        const d = e && e.data;
        if (!d || d.typ !== 'version') return;
        clearTimeout(uhr);
        sw.removeEventListener('message', an);
        const version = Number(d.version);
        fertig(Number.isInteger(version) ? { version, stand: /^[0-9a-f]{6,16}$/.test(String(d.stand)) ? String(d.stand) : null } : null);
      };
      uhr = setTimeout(() => { sw.removeEventListener('message', an); fertig(null); }, FRIST_MS);
      sw.addEventListener('message', an);
      sw.controller.postMessage({ typ: 'version' });
    } catch (e) { fertig(null); }
  });
}

function homescreen() {
  try {
    if (globalThis.navigator && globalThis.navigator.standalone === true) return true;
    const mq = typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia('(display-mode: standalone)') : null;
    return !!(mq && mq.matches);
  } catch (e) { return null; }
}

function simd() {
  try { return typeof WebAssembly === 'object' && typeof WebAssembly.validate === 'function' ? WebAssembly.validate(SIMD_TEST) : false; }
  catch (e) { return null; }
}

async function speicherFakten() {
  const st = globalThis.navigator && globalThis.navigator.storage;
  let dauerhaft = dauerhaftStatus();
  if (st && typeof st.persisted === 'function') {
    const p = await mitFrist(st.persisted().catch(() => null));
    if (typeof p === 'boolean') dauerhaft = p;
  }
  let belegtMb = null;
  let quoteMb = null;
  if (st && typeof st.estimate === 'function') {
    const e = await mitFrist(st.estimate().catch(() => null));
    if (e && Number.isFinite(e.usage) && Number.isFinite(e.quota)) {
      belegtMb = e.usage / 1048576;
      quoteMb = e.quota / 1048576;
    }
  }
  let zeichen = null;
  let grenze = null;
  try { const s = speicherStand(); zeichen = s.zeichen; grenze = s.grenze; } catch (e) { /* egal */ }
  return { dauerhaft: typeof dauerhaft === 'boolean' ? dauerhaft : null, belegtMb, quoteMb, zeichen, grenze };
}

function klangFakten() {
  try {
    const v = typeof klang.vorrat === 'function' ? klang.vorrat() : {};
    return { zustand: klang.zustand(), paket: typeof v.paket === 'string' ? v.paket : '', geladen: Number(v.dekodiert) || 0,
      dateien: Number(v.dateien) || 0, fehlt: Number(v.fehlt) || 0 };
  } catch (e) { return null; }
}

export async function sammleFakten() {
  const nav = globalThis.navigator || {};
  const [sw, speicher] = await Promise.all([swVersion(), speicherFakten()]);
  let spiel = null;
  try {
    spiel = spielZaehler(ladePartien(), { raetsel: ladeModul('tagesraetsel', null), kartei: ladeModul('kartei', null) });
  } catch (e) { spiel = null; }
  const engine = engineStart();
  let groesse = null;
  try { if (typeof window !== 'undefined') groesse = groesseVon(window.innerWidth, window.innerHeight); } catch (e) { /* egal */ }
  const { system, browser } = systemAus(nav.userAgent, { touch: nav.maxTouchPoints });
  return {
    erstellt: Date.now(),
    app: { version: sw ? sw.version : null, stand: sw ? sw.stand : null, sprache: sprache() },
    geraet: { system, browser, homescreen: homescreen(), groesse, simd: simd(), engineMs: engine ? engine.ms : null, klang: klangFakten() },
    speicher,
    spiel,
    fehler: eintraege(),
  };
}

// ---------- Kopieren und Teilen ----------
export async function kopiere(text) {
  const nav = globalThis.navigator;
  if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
    try { await nav.clipboard.writeText(text); return 'zwischenablage'; } catch (e) { /* Rueckfall unten */ }
  }
  // Rueckfall (aelteres Safari, keine Berechtigung): unsichtbares Textfeld markieren und kopieren
  const feld = document.createElement('textarea');
  feld.value = text;
  feld.setAttribute('readonly', '');
  feld.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
  const vorher = document.activeElement;
  document.body.append(feld);
  try {
    feld.focus({ preventScroll: true });
    feld.select();
    feld.setSelectionRange(0, text.length);
    if (!document.execCommand || !document.execCommand('copy')) throw new Error('kopieren');
    return 'auswahl';
  } finally {
    feld.remove();
    // Fokus zurueck (sonst laege er nach dem Entfernen ausserhalb des Blatts)
    try { if (vorher && vorher.isConnected && typeof vorher.focus === 'function') vorher.focus({ preventScroll: true }); } catch (e) { /* egal */ }
  }
}

// ---------- Blatt ----------
let offen = false;
export async function zeigeBericht(app = null) {
  if (offen || typeof document === 'undefined') return;
  offen = true;
  try {
    let fakten;
    try { fakten = await sammleFakten(); } catch (e) {
      try { app?.meldung?.(B('erstellenFehler'), { art: 'fehler' }); } catch (f) { /* egal */ }
      return;
    }
    let text = berichtText(fakten);
    const inhalt = document.createElement('div');
    inhalt.className = 'bericht-inhalt';
    inhalt.innerHTML = '<pre class="bericht-text" tabindex="0"></pre><p class="bericht-status" role="status" aria-live="polite"></p>';
    const pre = inhalt.querySelector('.bericht-text');
    const status = inhalt.querySelector('.bericht-status');
    pre.setAttribute('aria-label', B('textLabel'));
    pre.textContent = text;
    const melde = (x) => { status.textContent = x; };
    const knoepfe = [{ text: B('kopieren'), art: 'primaer', name: 'kopieren', bleibt: true, beiKlick: async () => {
      try { await kopiere(text); melde(B('kopiert')); } catch (e) { melde(B('kopierenFehler')); }
    } }];
    if (globalThis.navigator && typeof globalThis.navigator.share === 'function') {
      knoepfe.push({ text: B('teilen'), name: 'teilen', bleibt: true, beiKlick: async () => {
        try { await globalThis.navigator.share({ title: B('titel'), text }); melde(B('geteilt')); }
        catch (e) { if (!e || e.name !== 'AbortError') melde(B('teilenFehler')); }
      } });
    }
    knoepfe.push({ text: B('leeren'), name: 'leeren', bleibt: true, aus: !fakten.fehler.length, beiKlick: (knopf) => {
      leere();
      fakten = { ...fakten, fehler: eintraege() };
      text = berichtText(fakten);
      pre.textContent = text;
      knopf.disabled = true;
      // der Knopf ist jetzt aus: Fokus auf den Text, damit er im Blatt bleibt
      try { pre.focus({ preventScroll: true }); } catch (e) { /* egal */ }
      melde(B('geleert'));
    } });
    knoepfe.push({ text: t('allgemein.schliessen'), name: 'schliessen', wert: true });
    await sheet({ titel: B('eintrag'), text: B('blattText'), inhalt, klasse: 'bericht-blatt', knoepfe, abbrechen: false });
  } finally {
    offen = false;
  }
}
