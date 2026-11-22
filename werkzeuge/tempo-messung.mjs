// Tempo-Messung (R27, 22.11.2026, Flo: "alles muss smooth auf- und zugehen, nicht zeitverzoegert, nichts buggen"):
// faehrt eine feste Runde durch die App (Kaltstart, Leiste, Shop-Blatt, Online-Start, Einstellungen, Partie: Zug, Aufgeben-
// Dialog, Ergebnisblatt, Analyse) und misst je Schritt IM BROWSER:
//   erste  = Tipp bis zum ersten Bild, in dem sich das DOM geaendert hat (MutationObserver + naechstes Bild)
//   inp    = Event Timing: laengste Dauer des Tipps bis zum naechsten Bild (wie INP)
//   fertig = Tipp bis Ziel sichtbar UND keine laufende endliche Animation mehr UND 2 ruhige Bilder
//   lang   = lange Frames > 50 ms (long-animation-frame, sonst longtask) im Fenster, ihre Summe und das laengste
//   ruckler= Bildabstaende > 34 ms (bei 60 Hz mindestens ein verlorenes Bild)
//   cls    = Summe der Layout-Spruenge im Fenster (auch die kurz nach dem Tipp, die zaehlt CLS sonst nicht)
//   anim   = welche Animationen/Uebergaenge liefen (Name und Ziel), also ob es heute ein Auf-/Zugehen gibt
// Geraete: iphone13 (390 x 844, Touch, CPU 4x gedrosselt per CDP) und pc (1280 x 800). Netz zu *.supabase.co nachgebaut.
// Jeder Schritt hat eine Frist; was nicht erreicht wird, steht als "nicht erreicht" mit Grund im Ergebnis (nie still).
//
//   node werkzeuge/tempo-messung.mjs --wurzel=<app-ordner> --aus=<ordner> [--runden=3] [--nur=iphone13,pc] [--trace]
//   Ausgabe: <aus>/tempo-<geraet>.json und <aus>/tempo.md (Tabelle je Geraet, Rangliste nach fertig)
//   Ausgang 0 = alle Schritte gemessen, 1 = mindestens ein Schritt nicht erreicht, 2 = Werkzeugfehler
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export const GERAETE = {
  iphone13: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, cpu: 4 },
  pc: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, cpu: 1 },
};
export const LANG_MS = 50;
export const RUCKLER_MS = 34;

export function median(werte) {
  const w = werte.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!w.length) return null;
  const m = Math.floor(w.length / 2);
  return w.length % 2 ? w[m] : (w[m - 1] + w[m]) / 2;
}

// Einordnung nach den bekannten Schwellen: unter 100 ms wirkt sofort, bis 300 ms spuerbar, darueber zaeh
export function urteil(ms) {
  if (!Number.isFinite(ms)) return 'nicht erreicht';
  return ms < 100 ? 'sofort' : ms < 300 ? 'spuerbar' : ms < 1000 ? 'zaeh' : 'sehr zaeh';
}

// je Schritt Median ueber die Runden; Animationsnamen vereinigt; nicht erreicht, wenn es in KEINER Runde ging
export function fasseZusammen(runden) {
  const namen = [...new Set(runden.flat().map((s) => s.name))];
  return namen.map((name) => {
    const alle = runden.map((r) => r.find((s) => s.name === name)).filter(Boolean);
    const gut = alle.filter((s) => !s.fehler);
    const m = (k) => median(gut.map((s) => s[k]));
    return {
      name, wie: alle[0]?.wie || '', runden: gut.length, von: alle.length,
      erste: m('erste'), inp: m('inp'), fertig: m('fertig'), lang: m('lang'), langSumme: m('langSumme'), langMax: m('langMax'),
      ruckler: m('ruckler'), cls: m('cls'),
      anim: [...new Set(gut.flatMap((s) => s.anim || []))].slice(0, 6),
      fehler: gut.length ? '' : (alle.find((s) => s.fehler)?.fehler || 'nicht gemessen'),
    };
  });
}

export function rangliste(zusammen) {
  return [...zusammen].sort((a, b) => (b.fertig ?? Infinity) - (a.fertig ?? Infinity));
}

const zahl = (x, n = 0) => (Number.isFinite(x) ? x.toFixed(n) : '-');
export function tabelle(geraet, zusammen) {
  const z = [`### ${geraet}`, '', '| Schritt | erste Aenderung ms | INP ms | fertig ms | Urteil | lange Frames (Summe/max ms) | Ruckler | CLS | Animation |',
    '|---|---|---|---|---|---|---|---|---|'];
  for (const s of rangliste(zusammen)) {
    z.push(`| ${s.name}${s.wie ? ' (' + s.wie + ')' : ''} | ${zahl(s.erste)} | ${zahl(s.inp)} | ${zahl(s.fertig)} | ${s.fehler ? 'nicht erreicht: ' + s.fehler : urteil(s.fertig)}`
      + ` | ${zahl(s.lang)} (${zahl(s.langSumme)}/${zahl(s.langMax)}) | ${zahl(s.ruckler)} | ${zahl(s.cls, 3)} | ${s.anim.length ? s.anim.join(', ') : 'keine'} |`);
  }
  return z.join('\n');
}

// ---------- im Browser (addInitScript): Beobachter und Messfenster ----------
function sonde({ einstellungen, sitzung }) {
  try {
    if (!sessionStorage.getItem('tempo-start')) {
      sessionStorage.setItem('tempo-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify(einstellungen));
      localStorage.setItem('schach-arena:konto:sichtbar', '1');
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
    }
  } catch (e) { /* privater Modus: dann ohne Vorgaben */ }
  const T = { eingabe: null, mutation: null, events: [], lang: [], shifts: [], bilder: [] };
  window.__tempo = T;
  for (const typ of ['pointerdown', 'keydown', 'click']) {
    addEventListener(typ, (e) => { if (T.offen && T.eingabe == null) T.eingabe = e.timeStamp; }, { capture: true });
  }
  new MutationObserver(() => { if (T.offen && T.eingabe != null && T.mutation == null) T.mutation = performance.now(); })
    .observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  const beob = (typ, f, extra = {}) => { try { new PerformanceObserver((l) => l.getEntries().forEach(f)).observe({ type: typ, buffered: false, ...extra }); return true; } catch (e) { return false; } };
  beob('event', (e) => T.events.push({ start: e.startTime, dauer: e.duration, id: e.interactionId, name: e.name }), { durationThreshold: 16 });
  // Ursachen: je langem Frame die drei teuersten Skripte (Datei:Funktion, Ausloeser, ms), je Sprung die springenden Elemente
  const kurz = (u) => String(u || '').replace(/^.*\/(js|css)\//, '$1/').replace(/[?#].*$/, '');
  T.loaf = beob('long-animation-frame', (e) => T.lang.push({ start: e.startTime, dauer: e.duration,
    skripte: (e.scripts || []).slice().sort((a, b) => b.duration - a.duration).slice(0, 3)
      .map((x) => `${kurz(x.sourceURL)}:${x.sourceFunctionName || '?'} [${x.invoker || x.invokerType || ''}] ${Math.round(x.duration)}ms`),
    stil: Math.round(e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0) }));
  if (!T.loaf) beob('longtask', (e) => T.lang.push({ start: e.startTime, dauer: e.duration }));
  const wer = (n) => { if (!n || !n.nodeType) return '?'; const el = n.nodeType === 1 ? n : n.parentElement; return el ? el.tagName.toLowerCase() + (el.classList[0] ? '.' + el.classList[0] : '') : '?'; };
  beob('layout-shift', (e) => T.shifts.push({ start: e.startTime, wert: e.value, quellen: (e.sources || []).map((q) => wer(q.node)) }));
  T.beginne = () => { T.offen = true; T.eingabe = null; T.mutation = null; T.erste = null; T.events.length = 0; T.lang.length = 0; T.shifts.length = 0; T.bilder.length = 0; T.anim = new Map(); T.t0 = performance.now(); };
  // ohne Tipp (Kaltstart, Aufruf per app.gehe): Startzeit selbst setzen
  T.setzeStart = (t) => { T.eingabe = t; };
  T.warteFertig = (ziel, frist) => new Promise((ok) => {
    let alt = performance.now();
    // "!sel" = fertig, wenn sel verschwunden ist (Schliessen: gemessen ab dem Tipp, mit der Weg-Animation)
    const sichtbar = () => {
      if (ziel && ziel.startsWith('!')) return !document.querySelector(ziel.slice(1));
      const el = ziel ? document.querySelector(ziel) : document.body;
      if (!el) return false;
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    };
    // getAnimations() ist teuer (im Profil bis 224 ms je Schritt am gedrosselten iPhone, 22.11.): darum nur alle 100 ms
    // fragen und das Ende jeder Animation aus ihrer Startzeit rechnen, statt in jedem Bild auf "keine laeuft mehr" zu warten.
    let sichtbarAb = null; let probeAm = -Infinity; let spaetestesEnde = 0;
    const schritt = (jetzt) => {
      T.bilder.push(jetzt - alt); alt = jetzt;
      if (T.mutation != null && T.erste == null) T.erste = jetzt;
      if (sichtbarAb == null && sichtbar()) sichtbarAb = jetzt;
      const start = T.eingabe ?? T.t0;
      if (jetzt - probeAm >= 100) {
        probeAm = jetzt;
        let laeuft = 0;
        for (const a of document.getAnimations()) {
          if (a.playState !== 'running' && a.playState !== 'pending') continue;
          const t = a.effect?.getComputedTiming?.();
          if (!t || !Number.isFinite(t.endTime)) continue;   // endlos (Schimmer, Puls): zaehlt nicht
          laeuft++;
          if (a.startTime != null) spaetestesEnde = Math.max(spaetestesEnde, a.startTime + t.endTime / (a.playbackRate || 1));
          const n = a.animationName || (a.transitionProperty ? 'uebergang:' + a.transitionProperty : 'animation');
          const zielEl = a.effect?.target;
          // mit Laenge (Verzoegerung + Dauer): daran sieht man, welche Animation das "fertig" bestimmt
          const k = n + (zielEl?.classList?.[0] ? ' @' + zielEl.classList[0] : '');
          T.anim.set(k, Math.max(T.anim.get(k) || 0, t.endTime));
        }
        if (sichtbarAb != null && !laeuft) { ok({ ok: true, fertig: Math.max(sichtbarAb, spaetestesEnde) - start }); return; }
      }
      if (jetzt - T.t0 > frist) { ok({ ok: false, grund: sichtbar() ? 'Animation endet nicht' : 'Ziel nicht sichtbar: ' + ziel }); return; }
      requestAnimationFrame(schritt);
    };
    requestAnimationFrame(schritt);
  }).then((r) => {
    T.offen = false;
    const start = T.eingabe ?? T.t0;
    const imFenster = (x) => x.start >= start - 5;
    const lang = T.lang.filter(imFenster).filter((x) => x.dauer > 50);
    const ev = T.events.filter(imFenster);
    return {
      ...r,
      erste: T.erste != null ? T.erste - start : null,
      inp: ev.length ? Math.max(...ev.map((x) => x.dauer)) : null,
      lang: lang.length, langSumme: lang.reduce((s, x) => s + x.dauer, 0), langMax: lang.length ? Math.max(...lang.map((x) => x.dauer)) : 0,
      ruckler: T.bilder.slice(1).filter((d) => d > 34).length,
      cls: T.shifts.filter(imFenster).reduce((s, x) => s + x.wert, 0),
      ursachen: { frames: lang.map((x) => ({ ms: Math.round(x.dauer), stilLayoutMs: x.stil, skripte: x.skripte || [] })),
        spruenge: T.shifts.filter(imFenster).filter((x) => x.wert > 0.01).map((x) => ({ wert: +x.wert.toFixed(3), quellen: x.quellen })) },
      anim: [...T.anim].sort((x, y) => y[1] - x[1]).map(([n, d]) => `${n} ${Math.round(d)}ms`), quelle: T.loaf ? 'long-animation-frame' : 'longtask',
    };
  });
}

const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const SITZUNG = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'r1',
  expires_at: 9999999999, user: { id: UID, email: 'tempo@example.invalid' } };
// Klang aus (kein Audio im Kopflos-Browser), Bewegung wie Standard, Aufgeben mit Rueckfrage (misst den Dialog)
const EINSTELLUNGEN = { klang: false, bewegung: 'normal', figuren: 'cburnett', haltenAufgeben: false, zugBestaetigen: false };

// ---------- die Runde ----------
// Schritt: { name, wie, tun(seite, h) (der Tipp), ziel (Selektor fuer "fertig"), vorher?(seite, h) }
export function schritte() {
  const reiter = (r) => ({ tun: (s, h) => h.tippe(`.reiter-leiste [data-reiter="${r}"]`) });
  return [
    { name: 'Leiste: Bots', wie: 'Reiter', ...reiter('arena'), ziel: '.screen.arena' },
    { name: 'Leiste: Liga', wie: 'Reiter', ...reiter('bestenliste'), ziel: '.screen.bl-screen' },
    { name: 'Leiste: Ich', wie: 'Reiter', ...reiter('ich'), ziel: '.screen.sa-screen' },
    { name: 'Shop-Blatt oeffnen', wie: 'Tipp in Ich', vorher: (s, h) => h.ueberspringeMomente(),
      tun: (s, h) => h.tippe('.sa-platz[data-bereich="shop"], .sa-gross[data-bereich="shop"]'), ziel: '.sheet-karte.sa-blatt [data-bereich="shop"]' },
    { name: 'Shop-Blatt schliessen', wie: 'Escape', tun: (s) => s.keyboard.press('Escape'), ziel: '!.sheet-karte.sa-blatt' },
    { name: 'Leiste: Start', wie: 'Reiter', ...reiter('heim'), ziel: '.screen.heim-screen' },
    { name: 'Online-Start', wie: 'Karte auf Start', tun: (s, h) => h.tippe('[data-aktion="heim-online"]'), ziel: '.screen.online-screen' },
    { name: 'Einstellungen oeffnen', wie: 'Kopf', tun: (s, h) => h.tippe('.haupt-kopf [data-aktion="einstellungen"]'), ziel: '.screen.es-screen' },
    { name: 'Einstellungen zurueck', wie: 'Zurueck', tun: (s) => s.goBack(), ziel: '.screen.online-screen' },
    { name: 'Partie oeffnen', wie: 'app.gehe', tun: (s) => s.evaluate(() => { window.__tempo.setzeStart(performance.now()); window.__app.gehe('partie', { botId: 'benno', farbe: 'w' }); }),
      ziel: '.screen.partie .brett-felder .feld[data-feld="e2"]' },
    { name: 'Zug ziehen e2-e4', wie: 'zwei Tipps', vorher: (s, h) => h.tippeFeld('e2'), tun: (s, h) => h.tippeFeld('e4'), ziel: '.screen.partie .brett-lagen .lage.zuletzt' },   // irgendein letzter Zug: der Bot antwortet sofort, die Markierung wandert
    { name: 'Aufgeben-Dialog oeffnen', wie: 'Knopf', vorher: (s) => s.waitForTimeout(2500), tun: (s, h) => h.tippe('.spielknoepfe > [data-aktion="aufgeben"]'), ziel: '.dialog-ort .dialog' },
    { name: 'Dialog bestaetigen -> Ergebnisblatt', wie: 'Knopf', tun: (s, h) => h.tippe('.dialog-ort .dialog-knoepfe button:last-child'), ziel: '[data-ziel="analyse"]' },
    { name: 'Analyse oeffnen', wie: 'Ergebnisblatt', tun: (s, h) => h.tippe('[data-ziel="analyse"]'), ziel: '.screen.an-screen' },
  ];
}

async function laufeRunde(pw, browser, geraet, basis, { frist = 12000, trace = null } = {}) {
  const g = GERAETE[geraet];
  const k = await browser.newContext({ viewport: g.viewport, deviceScaleFactor: g.deviceScaleFactor, isMobile: g.isMobile, hasTouch: g.hasTouch,
    serviceWorkers: 'block', colorScheme: 'light', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  await k.route('**/*.supabase.co/**', (route) => {
    const url = new URL(route.request().url());
    const a = (d) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (url.pathname.startsWith('/auth/v1/')) return a({ id: UID, email: 'tempo@example.invalid' });
    if (url.pathname === '/rest/v1/altersangaben') return a([{ ab18: true }]);
    if (url.pathname === '/rest/v1/profile') return a([{ user_id: UID, benutzername: 'Mira' }]);
    return a([]);
  });
  await k.addInitScript(sonde, { einstellungen: EINSTELLUNGEN, sitzung: SITZUNG });
  const s = await k.newPage();
  const cdp = await k.newCDPSession(s);
  if (g.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: g.cpu });
  if (trace) await browser.startTracing(s, { path: trace, screenshots: true });
  const seitenfehler = [];
  s.on('pageerror', (e) => seitenfehler.push(e.message));
  const h = {
    async tippe(sel) {
      const el = s.locator(sel).first();
      await el.waitFor({ state: 'visible', timeout: frist });
      // ein Tipp ausserhalb des Bildes trifft am Telefon nichts (Shop-Knopf unten in Ich)
      await el.scrollIntoViewIfNeeded();
      if (g.hasTouch) { const b = await el.boundingBox(); await s.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); } else await el.click();
    },
    async tippeFeld(feld) { await h.tippe(`.screen.partie .brett-felder .feld[data-feld="${feld}"]`); },
    async ueberspringeMomente() {
      for (let i = 0; i < 12 && await s.locator('.st-moment .st-weiter').count(); i++) { await s.locator('.st-moment .st-weiter').first().click(); await s.waitForTimeout(250); }
    },
  };
  const ergebnis = [];
  const lastVor = await leerlauf(s);
  // Kaltstart: von der Navigation bis die Leiste und der Start-Screen ruhig stehen
  await s.goto(`${basis}/index.html?test#heim`);
  const kalt = await s.evaluate((f) => { window.__tempo.beginne(); window.__tempo.setzeStart(0); return window.__tempo.warteFertig('.reiter-leiste:not([hidden])', f); }, frist * 2);
  ergebnis.push({ name: 'Kaltstart bis Start ruhig', wie: 'Seitenaufruf', ...kalt, erste: null, inp: null, fehler: kalt.ok ? '' : kalt.grund });
  await s.waitForTimeout(800);
  for (const st of schritte()) {
    try {
      if (st.vorher) await st.vorher(s, h);
      await s.waitForTimeout(400);
      await s.evaluate(() => window.__tempo.beginne());
      // --profil=<Teil des Schrittnamens>: CPU-Profil genau dieses Schritts, Eigenzeit je Funktion (Ursachen langer Frames)
      const profil = !!PROFIL && PROFIL.split('|').some((p) => st.name.includes(p));
      if (profil) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start'); }
      await st.tun(s, h);
      const r = await s.evaluate(([z, f]) => window.__tempo.warteFertig(z, f), [st.ziel, frist]);
      if (profil) r.profil = eigenzeit((await cdp.send('Profiler.stop')).profile);
      ergebnis.push({ name: st.name, wie: st.wie, ...r, fehler: r.ok ? '' : r.grund });
    } catch (e) {
      ergebnis.push({ name: st.name, wie: st.wie, fehler: String(e.message || e).split('\n')[0].slice(0, 120) });
    }
  }
  if (trace) await browser.stopTracing();
  const lastNach = await leerlauf(s);
  await k.close();
  return { ergebnis, seitenfehler, last: { vor: lastVor, nach: lastNach } };
}

const PROFIL = (process.argv.find((x) => x.startsWith('--profil=')) || '').slice(9);
// Eigenzeit je Funktion aus einem CDP-Profil (ms, die 15 teuersten; Leerlauf und Programm weggelassen)
export function eigenzeit(profil) {
  const knoten = new Map(profil.nodes.map((n) => [n.id, n]));
  const zeit = new Map();
  const dt = profil.timeDeltas || [];
  (profil.samples || []).forEach((id, i) => {
    const n = knoten.get(id); const f = n.callFrame;
    if (['(idle)', '(program)', '(root)'].includes(f.functionName)) return;
    const k = (f.functionName || '(anonym)') + ' ' + String(f.url).replace(/^.*\/(js|css)\//, '$1/') + ':' + (f.lineNumber + 1);
    zeit.set(k, (zeit.get(k) || 0) + (dt[i + 1] || 0) / 1000);
  });
  return [...zeit].sort((x, y) => y[1] - x[1]).slice(0, 15).map(([k, v]) => `${Math.round(v)}ms ${k}`);
}
// Last-Probe: 1 s auf einer leeren Seite (gleiche Drosselung). Ein unbelasteter Rechner haelt dort jedes Bild; stockt schon
// die leere Seite, lief nebenher etwas anderes, und die Zahlen dieser Runde sind unter Last gemessen.
export const LAST_GRENZE = 2;
async function leerlauf(s) {
  await s.goto('about:blank');
  return s.evaluate(() => new Promise((ok) => {
    const d = []; let alt = performance.now(); const t0 = alt;
    const f = (j) => {
      d.push(j - alt); alt = j;
      if (j - t0 < 1000) requestAnimationFrame(f);
      else ok({ bilder: d.length, ruckler: d.slice(1).filter((x) => x > 34).length, max: Math.round(Math.max(...d.slice(1))) });
    };
    requestAnimationFrame(f);
  }));
}
export function lastText(lasten) {
  const unter = lasten.filter((l) => l.vor.ruckler > LAST_GRENZE || l.nach.ruckler > LAST_GRENZE).length;
  return `Last-Probe (leere Seite, 1 s, Ruckler vor/nach je Runde): ${lasten.map((l) => l.vor.ruckler + '/' + l.nach.ruckler).join(', ')}`
    + (unter ? ` - ACHTUNG: ${unter} von ${lasten.length} Runden unter Last (mehr als ${LAST_GRENZE} Ruckler auf der leeren Seite)` : ' - ohne fremde Last');
}

function server(wurzel) {
  const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
    '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
  const root = path.resolve(wurzel) + path.sep;
  return http.createServer((req, res) => {
    const p = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
    if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
    try { const d = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(d); }
    catch (e) { res.writeHead(404); res.end(); }
  });
}

export async function miss({ wurzel, aus, runden = 3, geraete = Object.keys(GERAETE), trace = false, playwright }) {
  const require = createRequire(import.meta.url);
  let pw = playwright;
  for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright'].filter(Boolean)) { if (pw) break; try { pw = require(p); } catch (e) { /* naechster */ } }
  if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');
  if (!existsSync(path.join(wurzel, 'index.html'))) throw new Error('--wurzel: keine index.html in ' + wurzel);
  mkdirSync(aus, { recursive: true });
  const srv = server(wurzel);
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const basis = `http://127.0.0.1:${srv.address().port}`;
  const browser = await pw.chromium.launch();
  const bericht = {};
  try {
    for (const g of geraete) {
      const alle = []; const fehler = []; const lasten = [];
      for (let i = 0; i < runden; i++) {
        const r = await laufeRunde(pw, browser, g, basis, { trace: trace && i === 0 ? path.join(aus, `trace-${g}.json`) : null });
        alle.push(r.ergebnis); fehler.push(...r.seitenfehler); lasten.push(r.last);
      }
      const zusammen = fasseZusammen(alle);
      bericht[g] = { zusammen, seitenfehler: [...new Set(fehler)].slice(0, 10), last: lasten, roh: alle };
      writeFileSync(path.join(aus, `tempo-${g}.json`), JSON.stringify(bericht[g], null, 2));
    }
  } finally {
    await browser.close();
    srv.close();
  }
  const md = Object.entries(bericht).map(([g, b]) => tabelle(g + (GERAETE[g].cpu > 1 ? ` (CPU ${GERAETE[g].cpu}x gedrosselt)` : ''), b.zusammen)
    + '\n\n' + lastText(b.last)
    + (b.seitenfehler.length ? '\n\nSeitenfehler: ' + b.seitenfehler.join(' | ') : '')).join('\n\n');
  writeFileSync(path.join(aus, 'tempo.md'), `# Tempo-Messung\n\nMedian aus ${runden} Runden, Zeiten in ms ab dem Tipp.\n\n${md}\n`);
  const ok = Object.values(bericht).every((b) => b.zusammen.every((s) => !s.fehler));
  return { ok, bericht };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };
  const wurzel = arg('wurzel') || path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const aus = arg('aus');
  if (!aus) { console.error('--aus=<ordner> fehlt'); process.exit(2); }
  const nur = arg('nur') ? arg('nur').split(',') : Object.keys(GERAETE);
  if (nur.some((g) => !GERAETE[g])) { console.error('--nur: ' + Object.keys(GERAETE).join(',')); process.exit(2); }
  try {
    const e = await miss({ wurzel, aus, runden: Number(arg('runden') || 3), geraete: nur, trace: process.argv.includes('--trace') });
    console.log(readFileSync(path.join(aus, 'tempo.md'), 'utf8'));
    process.exitCode = e.ok ? 0 : 1;
  } catch (e) {
    console.error('Werkzeugfehler: ' + (e.message || e));
    process.exitCode = 2;
  }
}
