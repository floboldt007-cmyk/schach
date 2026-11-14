// Zeiger-Zustaende im Raetsel-Duell (R18, 14.11.2026): .rd-los:hover und .rd-los:is(.rd-suchen, .rd-nochmal):hover
// (css/pakete/raetsel-duell.css) standen ausserhalb von @media (hover: hover). Auf dem Handy laesst der Browser den Zeiger
// an der Tippstelle stehen, der Zustand bliebe haengen. Der Test misst JEDEN sichtbaren Knopf im echten Screen
// #raetsel-duell, auf dem Start (Gegner suchen, Einladen, Code eingeben) und am Ende (Nochmal, Fertig):
//   - Handy 390 x 844 und iPad hoch 820 x 1180 (Touch, hover: none), hell und dunkel: nach tap() sieht jeder Knopf aus wie
//     in Ruhe (der Klick wird abgefangen, damit der Screen stehen bleibt), und keine :hover-Regel ausserhalb von
//     @media (hover: hover) trifft einen Knopf (CSSOM)
//   - PC 1440 x 900 (Maus), hell und dunkel: Text gegen die eigene Flaeche in Ruhe, unter dem Zeiger, mit Fokus und gedrueckt
//     mindestens 4,5:1 (Verlauf der Karte: gegen jede Endfarbe, Aufhellung per filter zaehlt mit)
//
//   node tests/r18-rd-hover.test.mjs
//   node tests/r18-rd-hover.test.mjs --pc-gleich=<rev>    dazu: am PC jeder Knopf unter dem Zeiger bildgleich mit <rev>
//   node tests/r18-rd-hover.test.mjs --handy-css=<rev>    Gegenprobe: Handy und iPad mit den css/-Dateien aus <rev>
//                                                         (auf 134afe3 muss das rot werden)
//   PORT=8975 node tests/r18-rd-hover.test.mjs             eigener Port (Standard: frei)
//
// Playwright: Pfad per Umgebungsvariable PLAYWRIGHT_PFAD, sonst 'playwright' oder /opt/node-tools.
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const schalter = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').slice(n.length + 3);
const PC_GLEICH = schalter('pc-gleich');
const HANDY_CSS = schalter('handy-css');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/r18-hover-rest.test.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

// Konto und Server wie in tests/raetsel-duell-ui.test.mjs: angemeldet, die Suche endet sofort im KI-Duell, das Duell ist
// sofort beendet (gewonnen), damit das Ende ohne Spiel erreichbar ist
const SUPA = 'https://usaamcqypmvgqmsbfecb.supabase.co';
const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const token = (sub) => 'a.' + Buffer.from(JSON.stringify({ sub })).toString('base64url') + '.x';
const SITZUNG = { access_token: token(UID), refresh_token: 'r1', expires_at: 9999999999, user: { id: UID, email: 'probe@example.invalid' } };
const DUELL = '7d0c9a52-1b3e-4f6a-9c8d-2e1f0a9b8c7d';
function stand() {
  const iso = (ms) => new Date(ms).toISOString();
  const start = Date.now() - 200000;
  return { duell: DUELL, art: 'ki', status: 'beendet', jetzt: iso(Date.now()), start_am: iso(start),
    ich: { geloest: 3, fehler: 0, ende_am: iso(start + 180000) }, gegner: { geloest: 2, fehler: 0, ende_am: iso(start + 180000), ki: true, elo: 1200 },
    raetsel: null, ergebnis: 'sieg', kronen_delta: 20 };
}

// Ansichten: Ziel = jeder sichtbare Knopf; muss = mindestens einer davon traegt diese Klasse (der Hauptknopf .rd-los)
const ANSICHTEN = [
  { name: 'Start', bereit: '.screen.raetsel-duell[data-phase="start"] .rd-suchen', ziel: '.screen.raetsel-duell .rd-start button', muss: '.rd-los' },
  { name: 'Ende', bereit: '.screen.raetsel-duell[data-phase="beendet"] .rd-ende .rd-nochmal', ziel: '.screen.raetsel-duell .rd-ende button', muss: '.rd-los' },
];

async function oeffne(browser, { w, h, schema, touch, css }) {
  const kontext = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: schema, deviceScaleFactor: 1,
    hasTouch: touch, isMobile: touch, serviceWorkers: 'block', reducedMotion: 'reduce' });
  for (const [datei, inhalt] of css || []) {
    await kontext.route((u) => new URL(u).pathname.endsWith('/' + datei), (r) => r.fulfill({ status: 200, contentType: 'text/css', body: inhalt }));
  }
  await kontext.route(SUPA + '/**', (r) => {
    const name = (r.request().url().match(/\/rest\/v1\/rpc\/([a-z_]+)/) || [])[1];
    let antwort = [];
    if (name === 'duell_suche_start' || name === 'duell_suche_stand') antwort = {};
    if (name === 'duell_suche_ende') antwort = { duell: DUELL };
    if (name === 'duell_stand') antwort = stand();
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(antwort) });
  });
  const s = await kontext.newPage();
  const fehler = [];
  s.on('pageerror', (e) => fehler.push(e.message));
  await s.addInitScript(({ sitzung, schema }) => {
    if (!location.protocol.startsWith('http')) return; // about:blank hat keinen Speicher
    window.__duellKiMs = 300;
    window.__duellAbfrageMs = 250;
    if (sessionStorage.getItem('rd-probe')) return;
    sessionStorage.setItem('rd-probe', '1');
    localStorage.clear();
    const d = new Date(); if (d.getHours() < 4) d.setDate(d.getDate() - 1);
    const z = (n) => String(n).padStart(2, '0');
    localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ gesehen: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}` }));
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ sprache: 'de', spracheGewaehlt: true, modus: schema === 'dark' ? 'dunkel' : 'hell', klang: false }));
    localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
    localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
  }, { sitzung: SITZUNG, schema });
  return { kontext, s, fehler };
}

// Ansicht herstellen; liefert alle sichtbaren Knoepfe (leer, wenn sie nicht erscheint)
async function zeige(s, a) {
  if (a.name === 'Start') await s.goto(`${BASIS}#raetsel-duell`);
  else {
    await s.goto(`${BASIS}#raetsel-duell`);
    await s.waitForSelector('.screen.raetsel-duell[data-phase="start"] .rd-suchen', { timeout: 30000 }).catch(() => {});
    await s.evaluate(() => window.__app.gehe('raetsel-duell', { suchen: true }));
  }
  await s.waitForSelector(a.bereit, { timeout: 30000 }).catch(() => {});
  await s.mouse.move(1, 1).catch(() => {});
  await s.evaluate(() => document.activeElement && document.activeElement.blur());
  await warte(500);
  return s.locator(a.ziel).filter({ visible: true }).all();
}
const deckt = async (a, els) => els.length > 0 && (await Promise.all(els.map((e) => e.evaluate((x, m) => x.matches(m), a.muss)))).some(Boolean);
const kennung = (el) => el.evaluate((x) => `${x.tagName.toLowerCase()}.${[...x.classList].join('.')}`);

// Aussehen: Farbe, Flaeche, Rand, Schatten, Filter, Verschiebung, Umriss des Knopfs und seiner Nachfahren
// je Element auch ::before und ::after: eine Zeiger-Regel auf einem Pseudo-Element (Overlay) bliebe sonst ungesehen
// (Kaltreview R18 rd-los-hover, Befund 1)
const aussehen = (el) => el.evaluate((x) => [x, ...x.querySelectorAll('*')].flatMap((k) => [null, '::before', '::after'].map((p) => {
  const st = getComputedStyle(k, p);
  return [st.content, st.color, st.backgroundColor, st.borderTopColor, st.boxShadow, st.filter, st.transform, st.opacity, st.outlineStyle, st.outlineColor].join(' | ');
})).join(' || '));

// :hover-Regeln ausserhalb von @media (hover: hover), die den Knopf oder ein Kind treffen (Muster aus tests/r18-hover-rest.test.mjs)
const zeigerAusserhalb = (el) => el.evaluate((x) => {
  const knoten = [x, ...x.querySelectorAll('*')];
  const funde = [];
  // nur an Kommas der obersten Ebene trennen: .rd-los:is(.rd-suchen, .rd-nochmal):hover ist EIN Selektor
  const teile = (sel) => {
    const aus = []; let tiefe = 0, an = 0;
    for (let i = 0; i < sel.length; i++) {
      if (sel[i] === '(') tiefe++;
      else if (sel[i] === ')') tiefe--;
      else if (sel[i] === ',' && tiefe === 0) { aus.push(sel.slice(an, i)); an = i + 1; }
    }
    return aus.concat(sel.slice(an));
  };
  const geh = (regeln, unterHover) => {
    for (const r of regeln) {
      if (r.cssRules && r.media) { geh(r.cssRules, unterHover || /\(\s*hover\s*:\s*hover\s*\)/.test(r.media.mediaText)); continue; }
      if (r.cssRules && !r.selectorText) { geh(r.cssRules, unterHover); continue; }
      if (!r.selectorText || !r.selectorText.includes(':hover') || unterHover) continue;
      for (const teil of teile(r.selectorText)) {
        if (!teil.includes(':hover')) continue;
        // Pseudo-Elemente (::after, auch mit Zustand dahinter) gehoeren zu ihrem Element: abschneiden, dann dem Element
        // zuordnen (Kaltreview R18 rd-los-hover, Befund 1). Was matches() danach nicht versteht, zaehlt als Fund statt
        // still durchzurutschen. :not(:hover) haengt ebenso am Zeiger und faellt mit weg (sonst bliebe ein leeres :not())
        const ohne = teil.replace(/::[\w-]+(\([^)]*\))?(:[\w-]+(\([^)]*\))?)*/g, '').replace(/:not\(\s*:hover\s*\)/g, '')
          .replace(/:hover/g, '').trim() || '*';
        let trifft;
        try { trifft = knoten.some((k) => k.matches(ohne)); } catch (e) { funde.push(`nicht pruefbar: ${teil.trim()}`); continue; }
        if (trifft) funde.push(teil.trim());
      }
    }
  };
  // ein unlesbares Blatt koennte eine Zeiger-Regel verstecken: es zaehlt als Fund statt still uebersprungen
  for (const blatt of document.styleSheets) { try { geh(blatt.cssRules, false); } catch (e) { funde.push(`Blatt nicht lesbar: ${blatt.href}`); } }
  return [...new Set(funde)];
});

// Text gegen die eigene Flaeche: Knopf-Flaeche ueber den Vorfahren zusammengesetzt bis zur ersten deckenden Flaeche oder
// einem Verlauf (dann gegen jede Endfarbe, der kleinste Wert zaehlt); filter: brightness() wirkt auf Text und Flaeche
const kontrast = (el) => el.evaluate((x) => {
  const farbe = (c) => { const p = (c.match(/rgba?\(([^)]+)\)/) || [, '0,0,0,0'])[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const ueber = (o, u) => [0, 1, 2].map((i) => o[i] * o[3] + u[i] * (1 - o[3])).concat(1);
  const lum = (f) => f.slice(0, 3).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  const verh = (a, b) => { const p = lum(a), q = lum(b); return (Math.max(p, q) + 0.05) / (Math.min(p, q) + 0.05); };
  const schichten = [];
  let unten = null;
  for (let e = x; e; e = e.parentElement) {
    const st = getComputedStyle(e);
    const stopps = (st.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(farbe);
    if (stopps.length) { unten = stopps.map((f) => ueber(f, [255, 255, 255, 1])); schichten.push(farbe(st.backgroundColor)); break; }
    const f = farbe(st.backgroundColor);
    schichten.push(f);
    if (f[3] >= 1) { unten = [f]; break; }
  }
  if (!unten) unten = [[255, 255, 255, 1]];
  const st = getComputedStyle(x);
  const hell = Number((/brightness\(([\d.]+)\)/.exec(st.filter) || [, 1])[1]);
  const auf = (f) => f.map((v, i) => (i < 3 ? Math.min(255, v * hell) : v));
  const werte = unten.map((u) => {
    let g = u;
    for (let i = schichten.length - 1; i >= 0; i--) g = ueber(schichten[i], g);
    return verh(auf(ueber(farbe(st.color), g)), auf(g));
  });
  return Math.round(Math.min(...werte) * 100) / 100;
});

async function beruehrung(browser, { geraet, w, h, schema, css }) {
  const name = `${geraet} ${w} x ${h} ${schema === 'dark' ? 'dunkel' : 'hell'}`;
  const { kontext, s, fehler } = await oeffne(browser, { w, h, schema, touch: true, css });
  pruefe(`${name}: Geraet ohne Zeiger (hover: none)`, await s.evaluate(() => matchMedia('(hover: none)').matches));
  for (const a of ANSICHTEN) {
    const els = await zeige(s, a);
    if (!(await deckt(a, els))) { pruefe(`${name} ${a.name}: Knoepfe sichtbar, darunter ${a.muss}`, false, `${els.length} gefunden`); continue; }
    // tap() wie ein Finger, der Klick wird abgefangen: der Screen bleibt stehen, der Zeiger bleibt an der Tippstelle
    await s.evaluate(() => { window.__rdKlickSperre = (e) => { e.preventDefault(); e.stopImmediatePropagation(); }; window.addEventListener('click', window.__rdKlickSperre, true); });
    const haengt = [], funde = new Set();
    for (const el of els) {
      await el.scrollIntoViewIfNeeded();
      await s.evaluate(() => document.activeElement && document.activeElement.blur());
      const ruhe = await aussehen(el);
      await el.tap(); await warte(500);
      await s.evaluate(() => document.activeElement && document.activeElement.blur());
      const nach = await aussehen(el);
      if (nach !== ruhe) haengt.push({ el: await kennung(el), ruhe, nach });
      for (const f of await zeigerAusserhalb(el)) funde.add(f);
    }
    await s.evaluate(() => window.removeEventListener('click', window.__rdKlickSperre, true));
    const namen = (await Promise.all(els.map(kennung))).join(', ');
    pruefe(`${name} ${a.name} (${els.length} Knoepfe: ${namen}): nach tap() wie in Ruhe`, haengt.length === 0, haengt);
    pruefe(`${name} ${a.name}: keine :hover-Regel ausserhalb von @media (hover: hover)`, funde.size === 0, [...funde]);
  }
  pruefe(`${name}: keine Seitenfehler`, fehler.length === 0, fehler);
  await kontext.close();
}

// PC: Kontrast in vier Zustaenden je Knopf; Bilder unter dem Zeiger fuer --pc-gleich
async function pc(browser, schema, css = null) {
  const { kontext, s, fehler } = await oeffne(browser, { w: 1440, h: 900, schema, touch: false, css });
  const erg = [];
  for (const a of ANSICHTEN) {
    const els = await zeige(s, a);
    if (!(await deckt(a, els))) { erg.push(null); continue; }
    const je = [];
    for (const el of els) {
      await el.scrollIntoViewIfNeeded();
      const k = {};
      await s.mouse.move(1, 1); await s.evaluate(() => document.activeElement && document.activeElement.blur()); await warte(300);
      k.ruhe = await kontrast(el);
      await el.hover(); await warte(400);
      k.zeiger = await kontrast(el);
      const bild = await el.screenshot();
      await s.mouse.move(1, 1); await warte(200);
      await el.focus(); await warte(300);
      k.fokus = await kontrast(el);
      await s.evaluate(() => document.activeElement && document.activeElement.blur());
      // gedrueckt: Zeiger vor dem Loslassen wegziehen, damit kein Klick ausgeloest wird
      await el.hover(); await s.mouse.down(); await warte(300);
      k.gedrueckt = await kontrast(el);
      await s.mouse.move(1, 1); await s.mouse.up(); await warte(300);
      je.push({ el: await kennung(el), k, bild });
    }
    erg.push(je);
  }
  await kontext.close();
  return { erg, fehler };
}

let pw;
try { pw = require(process.env.PLAYWRIGHT_PFAD || 'playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
let browser = null;
try {
  let bereit = false, letzter = null;
  for (let i = 0; i < 60 && !bereit; i++) {
    try { const r = await fetch(BASIS); await r.arrayBuffer(); bereit = r.ok; } catch (e) { letzter = e; }
    if (!bereit) await warte(150);
  }
  if (!bereit) throw new Error(`Testserver nicht erreichbar: ${letzter?.message || 'keine 200-Antwort'}`);
  browser = await browserTyp(pw).launch({ headless: true });
  // geaenderte Stylesheets im Stand <rev> (nur mit --pc-gleich bzw. --handy-css)
  const cssAus = (rev, name) => {
    const git = (...a) => execFileSync('git', a, { cwd: WURZEL, encoding: 'utf8' });
    const dateien = git('diff', '--name-only', rev, '--', 'css').split(/\r?\n/).filter(Boolean);
    pruefe(`--${name}=${rev}: geaenderte Stylesheets gefunden (${dateien.join(', ')})`, dateien.length > 0, dateien);
    return dateien.map((d) => [d, git('show', `${rev}:${d}`)]);
  };
  const pcCss = PC_GLEICH ? cssAus(PC_GLEICH, 'pc-gleich') : null;
  const handyCss = HANDY_CSS ? cssAus(HANDY_CSS, 'handy-css') : null;
  for (const schema of ['light', 'dark']) {
    await beruehrung(browser, { geraet: 'Handy', w: 390, h: 844, schema, css: handyCss });
    await beruehrung(browser, { geraet: 'iPad hoch', w: 820, h: 1180, schema, css: handyCss });
    const name = `PC 1440 x 900 ${schema === 'dark' ? 'dunkel' : 'hell'}`;
    const jetzt = await pc(browser, schema);
    pruefe(`${name}: keine Seitenfehler`, jetzt.fehler.length === 0, jetzt.fehler);
    ANSICHTEN.forEach((a, i) => {
      const je = jetzt.erg[i];
      const zuWenig = je ? je.filter((x) => Math.min(...Object.values(x.k)) < 4.5).map((x) => ({ el: x.el, ...x.k })) : 'nicht gefunden';
      pruefe(`${name} ${a.name} (${je ? je.length : 0} Knoepfe): Text in Ruhe, unter dem Zeiger, mit Fokus und gedrueckt mindestens 4,5:1`,
        !!je && zuWenig.length === 0, je ? { zuWenig, alle: je.map((x) => ({ el: x.el, ...x.k })) } : zuWenig);
    });
    if (pcCss) {
      const vorher = await pc(browser, schema, pcCss);
      ANSICHTEN.forEach((a, i) => {
        const v = vorher.erg[i], j = jetzt.erg[i];
        pruefe(`${name} ${a.name}: jeder Knopf unter dem Zeiger bildgleich mit ${PC_GLEICH}`,
          !!(v && j && v.length === j.length && v.every((x, n) => x.el === j[n].el && x.bild.equals(j[n].bild))),
          { anzahl: [v?.length, j?.length], ungleich: v && j ? j.filter((x, n) => !v[n] || !v[n].bild.equals(x.bild)).map((x) => x.el) : null });
      });
    }
  }
} catch (e) {
  pruefe('Lauf ohne Ausnahme', false, String(e && e.stack || e));
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill();
}
// INTENTIONAL-SLOP[T4]: Summenzeile, die tests/alle.mjs auswertet
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
