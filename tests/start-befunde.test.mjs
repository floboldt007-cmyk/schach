// Feinschliff R6 (12.11.2026), Start- und Bots-Befunde: B18 Serien-Chip in der Einzahl ("1 Tag"), B20 Bot-Spruch in der
// kompakten Bots-Karte ohne angeschnittene Zeile, B22 Start quer ohne toten Bereich unter der Gegner-Karte ("Deine
// Leiter" steht dort), B26 Start und Online-Seite nennen die Online-Partie gleich (Blitz 5 + 3 aus RANKED_ZEIT).
// R8 (13.11.2026): kein Bot-Name bricht auf der Buehne mitten im Wort, auf keinem Geraet.
//   node tests/start-befunde.test.mjs
//   PORT=8952 node tests/start-befunde.test.mjs
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';
import { tagSchluessel, addiereTage } from '../js/tag.js';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');
// WURZEL=<anderer Arbeitsbaum> prueft dessen Stand (Gegenprobe: rot vor dem Fix)
const root = process.env.WURZEL ? path.resolve(process.env.WURZEL) + path.sep : fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + new URL(req.url, 'http://test').pathname.replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const inhalt = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(inhalt); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT || 8952);
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

const P = 'schach-arena:v1:';
const heute = tagSchluessel(new Date());
// Serie mit n Tagen, heute gezaehlt (Paket serie, normalisiere: tage, letzter, aktuell)
const serie = (n) => ({ stand: 1, tage: Array.from({ length: n }, (_, i) => addiereTage(heute, i - n + 1)), letzter: heute, aktuell: n, gesamt: n, best: n });

async function seite(browser, { w, h, speicher = {}, hash = '#heim', touch = false }) {
  const k = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, serviceWorkers: 'block', locale: 'de-DE' });
  await k.route('**/*.supabase.co/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await k.addInitScript(({ speicher }) => {
    if (sessionStorage.getItem('probe')) return;
    sessionStorage.setItem('probe', '1');
    localStorage.clear();
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'aus' }));
    for (const [s, v] of Object.entries(speicher)) localStorage.setItem(s, JSON.stringify(v));
  }, { speicher });
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  const fehler = [];
  s.on('pageerror', e => fehler.push(e.message));
  await s.goto(`http://127.0.0.1:${PORT}/index.html?test${hash}`);
  const screen = hash.slice(1);
  await s.waitForFunction((n) => document.documentElement.dataset.screen === n && !!document.querySelector('#app > .screen:not(.lade-screen)'), screen);
  return { k, s, fehler };
}
const gesehen = { [P + 'modul:start']: { gesehen: heute } };

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });

  // ---------- B18: Serien-Chip in Einzahl und Mehrzahl ----------
  for (const n of [1, 3]) {
    const { k, s, fehler } = await seite(browser, { w: 390, h: 844, touch: true, speicher: { ...gesehen, [P + 'modul:serie']: serie(n) } });
    const chip = await s.evaluate(() => { const c = document.querySelector('.heim-serie'); return c ? { text: c.textContent.trim(), titel: c.title } : null; });
    const soll = n === 1 ? { text: '1 Tag', titel: '1 Tag in Folge gespielt' } : { text: '3 Tage', titel: '3 Tage in Folge gespielt' };
    pruefe(`B18: Serien-Chip bei ${n} ${n === 1 ? 'Tag' : 'Tagen'}: "${soll.text}", title "${soll.titel}"`, chip && chip.text === soll.text && chip.titel === soll.titel, chip);
    if (n === 1) {
      const en = await s.evaluate(async () => {
        const sp = await import('/js/sprache.js');
        sp.setzeSprache('en');
        const r = [sp.t('heim.serie', { n: 1 }), sp.t('heim.serie', { n: 4 }), sp.t('heim.serieTitel', { n: 1 }), sp.t('heim.serieTitel', { n: 4 })];
        sp.setzeSprache('de');
        return r;
      });
      pruefe('B18: Englisch "1 day" / "4 days", "1 day in a row" / "4 days in a row"', en.join('|') === '1 day|4 days|1 day in a row|4 days in a row', en);
    }
    pruefe(`B18 (${n}): keine Seitenfehler`, fehler.length === 0, fehler);
    await k.close();
  }

  // ---------- B26: ein Begriff fuer die Online-Partie (Start und Online-Seite) ----------
  {
    const { k, s, fehler } = await seite(browser, { w: 1280, h: 720, speicher: gesehen });
    const r = await s.evaluate(async () => {
      const { RANKED_ZEIT } = await import('/js/kronen.js');
      const sp = await import('/js/sprache.js');
      const art = sp.t('online.zeit.' + RANKED_ZEIT.art);
      const start = document.querySelector('[data-weg="online"] .heim-text span')?.textContent.trim();
      sp.setzeSprache('en');
      const startEn = sp.t('heim.online.text', { art: sp.t('online.zeit.' + RANKED_ZEIT.art), zeit: RANKED_ZEIT.id.replace('+', ' + ') });
      const artEn = sp.t('online.zeit.' + RANKED_ZEIT.art);
      sp.setzeSprache('de');
      return { start, art, zeit: RANKED_ZEIT.id.replace('+', ' + '), startEn, artEn };
    });
    pruefe('B26: Start nennt die Online-Partie wie die Online-Seite (Art und Bedenkzeit aus RANKED_ZEIT)',
      r.start === `${r.art} ${r.zeit}` && !/schnell/i.test(r.start), r);
    pruefe('B26: Englisch ebenso (kein "Quick game")', r.startEn === `${r.artEn} ${r.zeit}`, r);
    // die Online-Seite zeigt die Zeile nur angemeldet; sie baut sie aus derselben Quelle (RANKED_ZEIT, online.zeit.*)
    const online = readFileSync(path.join(root, 'js/ui/online.js'), 'utf8');
    pruefe('B26: Online-Seite nennt Art und Bedenkzeit aus derselben Quelle',
      online.includes("O('zeit.' + RANKED_ZEIT.art)") && online.includes("RANKED_ZEIT.id.replace('+', ' + ')"));
    pruefe('B26: keine Seitenfehler', fehler.length === 0, fehler);
    await k.close();
  }

  // ---------- B20: Bot-Spruch in der kompakten Karte (iPhone 13, SE) ohne angeschnittene Zeile ----------
  for (const [name, w, h] of [['iPhone 13', 390, 844], ['iPhone 13 Safari', 390, 664], ['iPhone SE', 375, 667]]) {
    const { k, s, fehler } = await seite(browser, { w, h, touch: true, speicher: gesehen, hash: '#arena' });
    await s.waitForFunction(() => !!document.querySelector('.arena.karte-kompakt .detail .sprechblase'));
    const SATZ = 'Ein neuer Name auf meiner Route! Schön, dich kennenzulernen. Ich hab’s immer ein bisschen eilig, also los, bevor die Post wartet.';
    await s.waitForTimeout(1200);
    // ein langer besonderer Satz (wie die Begruessung eines neuen Bots), danach die Karte neu legen lassen
    await s.evaluate((satz) => {
      const b = document.querySelector('.arena .detail .sprechblase');
      b.classList.add('besonders');
      (b.querySelector('.spruch-text') || b).textContent = '„' + satz + '“';
    }, SATZ);
    await s.waitForTimeout(600);
    const m = await s.evaluate(() => {
      const b = document.querySelector('.arena .detail .sprechblase');
      const alle = [b, ...b.querySelectorAll('*')];
      // das Element, das auf zwei Zeilen kuerzt: es darf keinen Innenabstand unten haben (sonst ragt die dritte Zeile
      // in den Abstand hinein und ist halb zu sehen) und muss genau ganze Zeilen hoch sein
      const kuerzt = alle.filter((e) => { const cs = getComputedStyle(e); return cs.webkitLineClamp && cs.webkitLineClamp !== 'none'; });
      const z = kuerzt.map((e) => { const cs = getComputedStyle(e); const lh = parseFloat(cs.lineHeight);
        return { unten: parseFloat(cs.paddingBottom), oben: parseFloat(cs.paddingTop), hoch: e.clientHeight, zeilen: (e.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / lh, mehr: e.scrollHeight > e.clientHeight + 1 }; });
      const br = b.getBoundingClientRect(), cta = document.querySelector('.arena .cta-platz')?.getBoundingClientRect();
      const ziele = document.querySelector('.arena .ziel-sterne')?.getBoundingClientRect();
      const kb = document.querySelector('.arena .karte').getBoundingClientRect();
      return { z, text: b.textContent, sichtbar: getComputedStyle(b).display !== 'none', blaseUnten: br.bottom, ctaOben: cta?.top, zieleOben: ziele?.top,
        karteHoch: Math.round(kb.height) };
    });
    pruefe(`B20 ${name}: Karte bleibt mindestens 300 px hoch (Stationen ueberdecken einander sonst)`, m.karteHoch >= 300, m);
    if (h < 720) {
      // kurze Handys: kein Platz ueber dem klebenden Knopf, der Satz tritt zurueck (statt halb darunter zu liegen)
      pruefe(`B20 ${name}: besonderer Satz tritt zurueck (liegt nicht unter dem Spielen-Knopf)`, !m.sichtbar, m);
      pruefe(`B20 ${name}: keine Seitenfehler`, fehler.length === 0, fehler);
      await k.close();
      continue;
    }
    pruefe(`B20 ${name}: genau ein Element kuerzt den Spruch`, m.z.length === 1 && m.sichtbar, m);
    const z = m.z[0] || {};
    pruefe(`B20 ${name}: gekuerzt auf ganze Zeilen ohne Innenabstand unten (keine halbe Zeile sichtbar)`,
      z.unten === 0 && z.oben === 0 && Math.abs(z.zeilen - Math.round(z.zeilen)) < 0.05 && Math.round(z.zeilen) === 2, z);
    pruefe(`B20 ${name}: der volle Satz steht im Text (Vorlesen)`, m.text.includes(SATZ), m.text);
    pruefe(`B20 ${name}: Sprechblase liegt ueber dem Spielen-Knopf und den Zielen, nicht darunter`,
      m.blaseUnten <= m.ctaOben + 0.5 && m.blaseUnten <= m.zieleOben + 0.5, m);
    pruefe(`B20 ${name}: keine Seitenfehler`, fehler.length === 0, fehler);
    await k.close();
  }

  // ---------- B22: Start quer ohne toten Bereich unter der Gegner-Karte ----------
  for (const [w, h] of [[1280, 720], [1440, 900], [1180, 820], [1024, 768]]) {
    const { k, s, fehler } = await seite(browser, { w, h, speicher: gesehen });
    const m = await s.evaluate(() => {
      const sicht = (e) => e && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0;
      const unterkante = (sp) => Math.max(...[...sp.querySelectorAll(':scope > *')].filter(sicht).map((e) => e.getBoundingClientRect().bottom));
      const links = document.querySelector('.heim-links'), rechts = document.querySelector('.heim-rechts');
      const leiter = document.querySelector('.heim-leiter');
      const rumpf = document.querySelector('.heim-rumpf');
      const gekuerzt = [...document.querySelectorAll('.heim-leiter-bot b')].filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent);
      return { leiter: sicht(leiter), leiterLinks: !!leiter && links.contains(leiter), bots: document.querySelectorAll('.heim-leiter-bot').length, gekuerzt,
        links: Math.round(unterkante(links)), rechts: Math.round(unterkante(rechts)), ueber: rumpf.scrollHeight - rumpf.clientHeight };
    });
    pruefe(`B22 ${w}x${h}: "Deine Leiter" steht unter der Gegner-Karte (links, drei Bots)`, m.leiter && m.leiterLinks && m.bots === 3, m);
    pruefe(`B22 ${w}x${h}: kein Name in der Leiter gekuerzt`, m.gekuerzt.length === 0, m.gekuerzt);
    // toter Bereich hiess: links endet weit vor rechts (PC 384 gegen 548); laenger als rechts ist kein toter Bereich
    pruefe(`B22 ${w}x${h}: linke Spalte endet nicht weit vor der rechten (hoechstens 96 px)`, m.links >= m.rechts - 96, m);
    pruefe(`B22 ${w}x${h}: nichts scrollt`, m.ueber <= 0, m);
    pruefe(`B22 ${w}x${h}: keine Seitenfehler`, fehler.length === 0, fehler);
    await k.close();
  }

  // ---------- R8: Name des Gegners auf der Buehne bricht nie mitten im Wort ("Vogelscheu|che Willi" auf 1024 x 768) ----------
  // alle Bot-Namen nacheinander in die Buehne gesetzt; je Wort darf es nur eine Zeile geben, nichts laeuft ueber
  for (const [w, h] of [[1024, 768], [1180, 820], [1280, 720], [1440, 900], [820, 1180], [768, 1024], [390, 844], [375, 667], [320, 568]]) {
    const { k, s, fehler } = await seite(browser, { w, h, speicher: gesehen });
    const m = await s.evaluate(async () => {
      const { BOTS } = await import('/js/bots.js');
      const g = document.querySelector('.heim-buehne .heim-gegner');
      if (!g) return null;
      const kaputt = [];
      for (const b of BOTS) {
        g.textContent = b.name;
        let i = 0;
        for (const wort of b.name.split(' ')) {
          const rg = document.createRange(); rg.setStart(g.firstChild, i); rg.setEnd(g.firstChild, i + wort.length); i += wort.length + 1;
          if (new Set([...rg.getClientRects()].map((r) => Math.round(r.top))).size > 1) kaputt.push(b.name + ': ' + wort);
        }
        if (g.scrollWidth > g.clientWidth + 1) kaputt.push(b.name + ' (laeuft ueber)');
      }
      return { n: BOTS.length, kaputt, schrift: getComputedStyle(g).fontSize, spalte: g.clientWidth };
    });
    pruefe(`R8 ${w}x${h}: kein Bot-Name bricht mitten im Wort`, m && m.n >= 30 && m.kaputt.length === 0, m);
    // L8: dasselbe fuer die Namen in "Deine Leiter" (dort, wo sie zu sehen ist): nichts gekuerzt, kein Wort zerrissen
    const l = await s.evaluate(async () => {
      const { BOTS } = await import('/js/bots.js');
      const namen = [...document.querySelectorAll('.heim-leiter-bot b')].filter((b) => b.getBoundingClientRect().width > 0);
      if (!namen.length) return { sichtbar: false };
      const kaputt = [];
      for (const b of BOTS) for (const el of namen) {
        el.textContent = b.name;
        let i = 0;
        for (const wort of b.name.split(' ')) {
          const rg = document.createRange(); rg.setStart(el.firstChild, i); rg.setEnd(el.firstChild, i + wort.length); i += wort.length + 1;
          if (new Set([...rg.getClientRects()].map((r) => Math.round(r.top))).size > 1) kaputt.push(b.name + ': ' + wort);
        }
        if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) kaputt.push(b.name + ' (gekuerzt, ' + Math.round(el.clientWidth) + ' px)');
      }
      return { sichtbar: true, kaputt: [...new Set(kaputt)] };
    });
    if (l.sichtbar) pruefe(`L8 ${w}x${h}: kein Name in "Deine Leiter" gekuerzt oder mitten im Wort getrennt`, l.kaputt.length === 0, l);
    pruefe(`R8 ${w}x${h}: keine Seitenfehler`, fehler.length === 0, fehler);
    await k.close();
  }
} catch (e) { pruefe('Ablauf ohne Abbruch', false, e.stack); }
finally { await browser?.close(); await new Promise(r => server.close(r)); }
console.log(`\n${ok}/${gesamt} bestanden`);
process.exitCode = ok === gesamt ? 0 : 1;
