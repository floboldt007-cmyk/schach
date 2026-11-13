// Feinschliff R15 (13.11.2026, Flo hat jeden Punkt nach Empfehlung gewaehlt), im Browser gemessen statt gelesen.
//   R4-Banner A  Ich-Seite am PC: die Vitrine (drei ausgestellte Erfolge, .pr-vitrine) steht rechts IM Banner der Profilkarte
//                (.pr-kopf) statt darunter; Handy und iPad hoch bleiben wie bisher (darunter). Leere Vitrine (R4a: ein
//                schmaler Platz) und eine gefuellte werden beide gemessen.
//   R6-Leisten B Lektion: Spielerleisten "Lektion" (oben, Gegnerseite) gegen den eigenen Namen (ohne Konto "Du", unten) wie in
//                der Bot-Partie (.spieler.gegner / .spieler.ich, js/ui/partie.js); am PC beide in der Seitenspalte.
//   R6-Brett B   Zu zweit am PC (1280 x 800, 1440 x 900): Brett so gross wie in der Bot-Partie, an der das Raetsel-Duell
//                ausgerichtet ist (css/pakete/raetsel-duell.css, R8). Gemessen wie tests/gleichheit-messung.mjs.
// Netzwerk: nur 127.0.0.1, Supabase leer beantwortet.
//
//   node tests/r15-ich-lektion.test.mjs
//   node tests/r15-ich-lektion.test.mjs --bilder=<ordner> --name=vorher|nachher    dazu Bilder je Punkt und Geraet
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';
import { messeAnsicht, introWeg } from './gleichheit-messung.mjs';
import { BOTS } from '../js/bots.js';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');
const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };
const BILDER = arg('bilder');
const NAME = arg('name') || 'bild';
if (BILDER) await mkdir(BILDER, { recursive: true });

const WURZEL = fileURLToPath(new URL('../', import.meta.url));
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (q, r) => {
  const p = path.resolve(WURZEL, '.' + decodeURIComponent(new URL(q.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(WURZEL)) { r.writeHead(403); r.end(); return; }
  try { const d = await readFile(p); r.writeHead(200, { 'Content-Type': TYPEN[path.extname(p)] || 'application/octet-stream' }); r.end(d); }
  catch (e) { r.writeHead(404); r.end(); }
});
await new Promise((r) => server.listen(Number(process.env.PORT || 0), '127.0.0.1', r));
const BASIS = `http://127.0.0.1:${server.address().port}/index.html?test`;
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
  return gut;
}

// erster Sieg gegen den ersten Bot: damit ist "Siegeszug" (stufe-siege) erspielt und darf in die Vitrine
const SIEG = JSON.stringify({ bots: { [BOTS[0].id]: { sterne: [true, false, false] } }, brillanteZuege: [] });
async function seite(browser, viewport, { vitrine = null } = {}) {
  const k = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'de-DE', timezoneId: 'Europe/Berlin', serviceWorkers: 'block' });
  await k.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === '127.0.0.1') return route.continue();
    if (u.hostname.endsWith('.supabase.co')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    return route.abort();
  });
  await k.addInitScript(({ vitrine, sieg }) => {
    try {
      localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' }));
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false }));
      localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
      if (vitrine) {
        localStorage.setItem('schach-arena:v1:fortschritt', sieg);
        localStorage.setItem('schach-arena:v1:einstellungen:sammeln', JSON.stringify({ profil: { vitrine } }));
      }
    } catch (e) { /* egal */ }
  }, { vitrine, sieg: SIEG });
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  const fehler = []; s.on('pageerror', (e) => fehler.push(e.message));
  await s.goto(BASIS + '#heim');
  await s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function' && document.documentElement.dataset.screen, null, { timeout: 30000 });
  return { k, s, fehler };
}
const ruhe = (s) => s.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'
  || a.effect?.getComputedTiming().iterations === Infinity), null, { timeout: 4000 }).catch(() => {});
async function bild(s, datei) { if (BILDER) await s.screenshot({ path: path.join(BILDER, `${datei}-${NAME}.png`) }); }

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });

  // ---------- R4-Banner A: Vitrine im Banner am PC ----------
  const GERAETE_ICH = [['PC', 1280, 800, 'quer'], ['PC 1440', 1440, 900, 'quer'], ['iPad quer', 1180, 820, 'quer'],
    ['iPhone 13', 390, 844, 'unter'], ['iPad hoch', 820, 1180, 'unter']];
  for (const [geraet, width, height, soll] of GERAETE_ICH) {
    for (const fall of ['leer', 'voll']) {
      const { k, s, fehler } = await seite(browser, { width, height }, { vitrine: fall === 'voll' ? ['stufe-siege', null, null] : null });
      await s.evaluate(() => window.__app.gehe('ich'));
      await s.waitForSelector('.pr-karte .pr-vitrine', { timeout: 15000 }).catch(() => {});
      // der Freischalt-Moment des ersten Siegs legt sich beim Oeffnen kurz darueber; weg damit, dann messen
      for (let n = 0; n < 6; n++) {
        await warte(700);
        const weiter = s.locator('.st-moment .st-weiter');
        if (!(await weiter.count())) break;
        await weiter.first().click().catch(() => {});
      }
      await ruhe(s);
      const m = await s.evaluate(() => {
        const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect();
          return { l: Math.round(b.left), r: Math.round(b.right), o: Math.round(b.top), u: Math.round(b.bottom), b: Math.round(b.width), h: Math.round(b.height) }; };
        const karte = document.querySelector('.pr-karte');
        const orden = [...document.querySelectorAll('.pr-vitrine .pr-orden')].map((o) => Math.round(o.getBoundingClientRect().height));
        const titel = document.querySelector('.pr-vitrine-titel');
        return { kopf: r('.pr-kopf'), vitrine: r('.pr-vitrine'), titel: r('.pr-vitrine-titel'), name: r('.pr-name'), av: r('.pr-av'),
          knoepfe: r('.pr-knoepfe'), plaetze: orden, leer: document.querySelector('.pr-vitrine')?.hasAttribute('data-leer'),
          titelFarbe: titel ? getComputedStyle(titel).color : null,
          karteQuer: karte ? karte.scrollWidth - karte.clientWidth : null, seiteQuer: document.documentElement.scrollWidth - innerWidth };
      });
      const v = m.vitrine, kp = m.kopf;
      const da = !!(v && kp && m.titel && m.name);
      pruefe(`Ich ${geraet} (${fall}): Profilkarte mit Vitrine gemessen`, da && (fall === 'leer' ? m.leer && m.plaetze.length === 1 : !m.leer && m.plaetze.length === 3), m);
      if (da && soll === 'quer') {
        const drin = (x) => x.o >= kp.o - 1 && x.u <= kp.u + 1 && x.l >= kp.l - 1 && x.r <= kp.r + 1;
        pruefe(`Ich ${geraet} (${fall}): Vitrine samt Titel rechts im Banner (R4-Banner A)`, drin(v) && drin(m.titel) && v.l >= m.name.r + 8
          && v.r >= kp.r - 40, { kopf: kp, vitrine: v, titel: m.titel, name: m.name });
        pruefe(`Ich ${geraet} (${fall}): Plaetze mindestens 44 px hoch, nichts laeuft quer ueber`, m.plaetze.every((h) => h >= 44)
          && m.karteQuer <= 2 && m.seiteQuer <= 1, m);
        pruefe(`Ich ${geraet} (${fall}): Vitrinen-Titel auf dem Banner in heller Schrift`, /^rgb\((2[0-9][0-9]|1[6-9][0-9]), (2[0-9][0-9]|1[6-9][0-9]), (2[0-9][0-9]|1[6-9][0-9])\)/.test(m.titelFarbe || ''), m.titelFarbe);
      } else if (da) {
        pruefe(`Ich ${geraet} (${fall}): Vitrine bleibt unter dem Banner (wie bisher)`, v.o >= kp.u - 1 && m.titel.o >= kp.u - 1, { kopf: kp, vitrine: v });
        // nur die Seite: die Karte selbst meldet am Handy schon vorher 2 px Inhaltsbreite ueber (Banner mit negativem Rand), unsichtbar
        pruefe(`Ich ${geraet} (${fall}): nichts laeuft quer ueber`, m.seiteQuer <= 1, m);
      }
      if (geraet === 'PC' || geraet === 'iPhone 13') await bild(s, `R4-banner-${geraet.replace(/\s+/g, '').toLowerCase()}-${fall}`);
      pruefe(`Ich ${geraet} (${fall}): keine Seitenfehler`, !fehler.length, fehler);
      await k.close();
    }
  }

  // ---------- R6-Leisten B: Lektion mit Spielerleisten wie die Bot-Partie ----------
  const GERAETE_LS = [['PC', 1280, 800], ['PC 720', 1280, 720], ['iPad quer', 1180, 820], ['iPhone 13', 390, 844], ['iPhone SE', 375, 667],
    ['iPad hoch', 820, 1180]];
  for (const [geraet, width, height] of GERAETE_LS) {
    const { k, s, fehler } = await seite(browser, { width, height });
    // Massstab: die Bot-Partie auf demselben Geraet (wo stehen ihre Leisten)
    await s.evaluate(() => window.__app.gehe('partie', { botId: 'benno' }));
    await s.waitForFunction(() => window.__partie?.bereit && document.querySelector('.brett-rahmen > .brett .feld'), null, { timeout: 30000 }).catch(() => {});
    await introWeg(s); await warte(1200);
    const bot = await messeAnsicht(s, '.screen.partie');
    await s.evaluate(() => window.__app.gehe('lektion', { id: 'grundreihe' }));
    await s.waitForFunction(() => window.__lektion?.zustand().phase === 'intro', null, { timeout: 15000 }).catch(() => {});
    await ruhe(s);
    const vorStart = await messeAnsicht(s, '.ls-screen');
    await s.locator('.ls-aktionen [data-a="los"]').click();
    await s.waitForFunction(() => window.__lektion?.zustand().phase === 'flo', null, { timeout: 10000 }).catch(() => {});
    await warte(600); await ruhe(s);
    const m = await messeAnsicht(s, '.ls-screen');
    const platz = await s.evaluate(() => {
      const r = document.querySelector('.ls-screen .ls-rumpf'), d = document.documentElement;
      const a = document.querySelector('.ls-screen .ls-aktionen')?.getBoundingClientRect();
      // nichts aus der Spalte liegt unter den Knoepfen (die Karte rollt bei Platznot in sich, Meldung und Leisten stehen darueber)
      const zu = [...document.querySelectorAll('.ls-screen .ls-status, .ls-screen .ls-meldung, .ls-screen .spieler')]
        .filter((e) => !e.hidden && e.getClientRects().length && a && e.getBoundingClientRect().bottom > a.top + 1
          && e.getBoundingClientRect().top < a.bottom - 1).map((e) => e.className.split(' ').slice(0, 2).join('.'));
      return { rumpfRollt: r ? r.scrollHeight - r.clientHeight : null, quer: d.scrollWidth - innerWidth, unterKnoepfen: zu,
        knoepfeImBild: !!a && a.top >= 0 && a.bottom <= innerHeight + 0.5 };
    });
    const muster = (x) => (x.leisten || []).map((l) => `${l.wer}:${l.lage}`).sort().join(' ');
    const g = m.leisten?.find((l) => l.wer === 'gegner'), i = m.leisten?.find((l) => l.wer === 'ich');
    pruefe(`Lektion ${geraet}: Leisten "Lektion" (Gegnerseite) und "Du" (R6-Leisten B)`, !m.fehlt && g?.name === 'Lektion' && i?.name === 'Du'
      && g.avatar && i.avatar, m.leisten || m.fehlt);
    pruefe(`Lektion ${geraet}: Leisten liegen wie in der Bot-Partie (${muster(m) || 'keine'} gegen ${muster(bot)})`, !bot.fehlt && muster(m) === muster(bot),
      { lektion: m.leisten, bot: bot.leisten });
    pruefe(`Lektion ${geraet}: Leisten schon vor dem Start da`, muster(vorStart) === muster(m), vorStart.leisten);
    pruefe(`Lektion ${geraet}: Brett mindestens so gross wie in der Bot-Partie (${m.brett} gegen ${bot.brett} px)`, !m.fehlt && m.brett >= bot.brett - 2,
      { lektion: m.brett, bot: bot.brett });
    pruefe(`Lektion ${geraet}: Leisten und Knoepfe ganz im Bild, nichts rollt oder liegt unter den Knoepfen`, (m.leisten || []).every((l) => l.imBild)
      && m.knoepfe?.hinweis?.imBild && platz.knoepfeImBild && platz.rumpfRollt <= 1 && platz.quer <= 1 && !m.seiteScrollt && !platz.unterKnoepfen.length,
      { platz, knoepfe: m.knoepfe, seiteScrollt: m.seiteScrollt });
    if (geraet === 'PC' || geraet === 'iPhone 13') await bild(s, `R6-leisten-${geraet.replace(/\s+/g, '').toLowerCase()}`);
    pruefe(`Lektion ${geraet}: keine Seitenfehler`, !fehler.length, fehler);
    await k.close();
  }

  // ---------- R6-Brett B: Zu zweit am PC so gross wie die Bot-Partie ----------
  for (const [geraet, width, height] of [['PC 1280x800', 1280, 800], ['PC 1440x900', 1440, 900], ['PC 1280x720', 1280, 720]]) {
    const { k, s, fehler } = await seite(browser, { width, height });
    await s.evaluate(() => window.__app.gehe('partie', { botId: 'benno' }));
    await s.waitForFunction(() => window.__partie?.bereit && document.querySelector('.brett-rahmen > .brett .feld'), null, { timeout: 30000 }).catch(() => {});
    await introWeg(s); await warte(1200);
    const bot = await messeAnsicht(s, '.screen.partie');
    await s.evaluate(() => window.__app.gehe('partie', { modus: 'zuzweit', zuzweit: { weiss: 'Anna', schwarz: 'Ben', drehen: false }, tempo: null }));
    await s.waitForSelector('.zz-brett .feld', { timeout: 20000 });
    await introWeg(s); await warte(1200);
    const zz = await messeAnsicht(s, '.zz-screen');
    console.log(`  Messung ${geraet}: Zu zweit ${zz.brett ?? zz.fehlt} px, Bot-Partie ${bot.brett ?? bot.fehlt} px`);
    pruefe(`Zu zweit ${geraet}: Brett mindestens so gross wie in der Bot-Partie (${zz.brett} gegen ${bot.brett} px, R6-Brett B)`,
      !zz.fehlt && !bot.fehlt && zz.brett >= bot.brett - 2, { zz: zz.brett ?? zz.fehlt, bot: bot.brett ?? bot.fehlt });
    if (geraet === 'PC 1280x800') await bild(s, 'R6-brett-zuzweit-pc');
    pruefe(`Zu zweit ${geraet}: keine Seitenfehler`, !fehler.length, fehler);
    await k.close();
  }
} catch (e) { pruefe('Probe laeuft ohne Abbruch', false, e.stack); }
finally { await browser?.close(); await new Promise((r) => server.close(r)); }
console.log(`\n${ok}/${gesamt} bestanden`); process.exitCode = ok === gesamt ? 0 : 1;
