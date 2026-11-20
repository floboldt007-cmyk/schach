// G-010 AC-06 (Kann, Auftrag E2-19:35): Design-Proben fuer Flos Auswahlseite, NUR hinter dem Test-Schalter
// ?test&design=w1a.w3a (setzt html[data-design-w1], html[data-design-w3]). Nichts davon ist live.
//   W1 untere Leiste: a Gold-Relief (Spiel-Symbole in Gold) · b Krone + Gold-Linie (Strich-Symbole) · c Wappen (Plakette)
//   W3 Online-Seite:  a Zwei Materialien (Gold/Silber-Blau, Elo-Medaille, Freunde-Karte) · b Buehne · c Ruhig edel
// Geprueft: ohne ?test kein Schalter, mit Schalter die Variante im DOM und in den berechneten Farben, Freunde-Knoepfe
// oeffnen die Formulare.
//   node tests/design-w1-w3.test.mjs
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright.
import http from 'node:http';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..') + path.sep;
let pw = null;
for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(k); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');

let gesamt = 0, ok = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  const d = typeof detail === 'string' ? detail : JSON.stringify(detail);
  console.log(`${gut ? 'ok    ' : 'FEHLER'} ${name}${!gut && d ? ' ' + d : ''}`);
}

const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const p = path.resolve(WURZEL, '.' + decodeURIComponent(new URL(req.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(WURZEL)) { res.writeHead(403); res.end(); return; }
  try { res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p)); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const HOST = `http://127.0.0.1:${PORT}/`;

const sitzung = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: 'u1' })).toString('base64url') + '.x', refresh_token: 'test-r',
  expires_at: 9999999999, user: { id: 'u1', email: 'spieler@example.invalid' } };
const browser = await pw.chromium.launch();
const fehler = [];
async function seite(suche) {
  const k = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, colorScheme: 'dark', locale: 'de-DE' });
  await k.route('**/*.supabase.co/**', (route) => {
    const url = new URL(route.request().url()), rpc = url.pathname.split('/').pop();
    const d = rpc === 'kronen_mein_stand' ? { stufe: 7, kronen: 140, platz: 3, ziel: 120, n: 30, woche: '2026-11-16', elo: 1240 } : [];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  });
  await k.addInitScript(([s]) => {
    localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(s));
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'aus', modus: 'dunkel' }));
  }, [sitzung]);
  const s = await k.newPage();
  s.on('pageerror', (e) => fehler.push(e.message));
  await s.goto(HOST + suche);
  await s.waitForFunction(() => document.querySelector('.screen'), null, { timeout: 20000 });
  return { k, s };
}
const design = (s) => s.evaluate(() => ({ w1: document.documentElement.dataset.designW1 || '', w3: document.documentElement.dataset.designW3 || '' }));
const leiste = (s) => s.evaluate(() => [...document.querySelectorAll('.reiter-leiste .reiter')].map((b) => {
  const sym = b.querySelector('.reiter-sym, .sy'), cs = sym ? getComputedStyle(sym) : null;
  return { reiter: b.dataset.reiter, art: sym ? (sym.classList.contains('reiter-sym') ? 'linie' : 'spiel') : '', farbe: cs ? cs.color : '',
    mitte: cs ? cs.getPropertyValue('--sy-mitte').trim() : '', an: b.classList.contains('an') };
}));

try {
  // 1 ohne ?test: der Schalter wirkt nicht (nichts davon ist live)
  {
    const { k, s } = await seite('?design=w1b.w3a');
    pruefe('ohne ?test: kein data-design', JSON.stringify(await design(s)) === '{"w1":"","w3":""}', await design(s));
    await k.close();
  }
  // 2 ohne Schalter: heutiger Stand (Spiel-Symbole, keine Freunde-Karte)
  {
    const { k, s } = await seite('?test');
    await s.evaluate(() => window.__app.gehe('heim'));
    await s.waitForTimeout(600);
    const l = await leiste(s);
    pruefe('heute: vier Spiel-Symbole in der Leiste', l.length === 4 && l.every((x) => x.art === 'spiel'), l);
    pruefe('heute: kein data-design gesetzt', JSON.stringify(await design(s)) === '{"w1":"","w3":""}', await design(s));
    // Online-Seite wie heute: keine Freunde-Karte, die Klapp-Zeile steht, Partie- und Duell-Knopf in derselben Farbe
    await s.evaluate(() => window.__app.gehe('online'));
    await s.waitForFunction(() => document.querySelector('.online-screen .on-tueren'), null, { timeout: 20000 });
    await s.waitForTimeout(800);
    const o = await s.evaluate(() => {
      const knopf = (art) => { const e = document.querySelector(`.on-tuer[data-art="${art}"] .on-tuer-knopf:not([hidden])`), c = e && getComputedStyle(e);
        return c ? `${c.backgroundImage}|${c.backgroundColor}|${c.color}` : ''; };
      return { partie: knopf('partie'), duell: knopf('duell'), karte: !!document.querySelector('.on-freunde-karte'),
        zeile: getComputedStyle(document.querySelector('.on-freunde-zeile')).display };
    });
    pruefe('heute: keine Freunde-Karte, Klapp-Zeile sichtbar, Partie und Duell gleich gefaerbt',
      !o.karte && o.zeile !== 'none' && o.partie && o.partie === o.duell, o);
    await k.close();
  }
  // 3 W1 a/b/c
  for (const v of ['a', 'b', 'c']) {
    const { k, s } = await seite(`?test&design=w1${v}.w3${v}`);
    await s.evaluate(() => window.__app.gehe('heim'));
    await s.waitForTimeout(600);
    const d = await design(s), l = await leiste(s);
    pruefe(`w1${v}: Schalter gesetzt`, d.w1 === v && d.w3 === v, d);
    if (v === 'a') pruefe('w1a: Spiel-Symbole in Gold (--sy-mitte #C8922C)', l.length === 4 && l.every((x) => x.art === 'spiel' && /^#c8922c$/i.test(x.mitte)), l);
    else pruefe(`w1${v}: Strich-Symbole (Krone, Bot, Pokal, Person)`, l.length === 4 && l.every((x) => x.art === 'linie'), l);
    if (v === 'b') {
      const aus = l.find((x) => !x.an), an = l.find((x) => x.an);
      pruefe('w1b: inaktiv #BFA56E, aktiv #F2BE4A', aus && an && aus.farbe === 'rgb(191, 165, 110)' && an.farbe === 'rgb(242, 190, 74)', l);
    }
    if (v === 'c') {
      const platte = await s.evaluate(() => { const e = document.querySelector('.reiter-leiste .reiter .reiter-sym'); const r = e.getBoundingClientRect(); return { b: Math.round(r.width), h: Math.round(r.height) }; });
      pruefe('w1c: Plakette 32 px', platte.b === 32 && platte.h === 32, platte);
    }
    // 4 W3 a/b/c: Online-Seite
    await s.evaluate(() => window.__app.gehe('online'));
    await s.waitForFunction(() => document.querySelector('.online-screen .on-tueren'), null, { timeout: 20000 });
    await s.waitForTimeout(800);
    const o = await s.evaluate(() => {
      const knopf = (art) => { const e = document.querySelector(`.on-tuer[data-art="${art}"] .on-tuer-knopf:not([hidden])`); const c = e && getComputedStyle(e);
        return c ? `${c.backgroundImage}|${c.backgroundColor}|${c.color}` : ''; };
      const karte = document.querySelector('.on-freunde-karte');
      return { partie: knopf('partie'), duell: knopf('duell'), karte: !!karte && getComputedStyle(karte).display !== 'none',
        knoepfe: karte ? [...karte.querySelectorAll('button')].map((b) => b.dataset.online) : [],
        zeile: getComputedStyle(document.querySelector('.on-freunde-zeile')).display };
    });
    pruefe(`w3${v}: Partie und Duell sehen verschieden aus`, o.partie && o.partie !== o.duell, o);
    pruefe(`w3${v}: Freunde als Karte mit zwei Knoepfen, alte Zeile weg`, o.karte && o.knoepfe.join() === 'freunde-einladen,freunde-code' && o.zeile === 'none', o);
    // die Knoepfe oeffnen das jeweilige Formular
    await s.click('[data-online="freunde-code"]');
    await s.waitForTimeout(300);
    const auf = await s.evaluate(() => ({ offen: document.querySelector('.on-freunde').open, fokus: document.activeElement && document.activeElement.name }));
    pruefe(`w3${v}: "Code eingeben" oeffnet das Formular und setzt den Fokus ins Codefeld`, auf.offen && auf.fokus === 'code', auf);
    await k.close();
  }
  pruefe('keine Seitenfehler', fehler.length === 0, fehler);
} finally {
  await browser.close(); server.close();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
