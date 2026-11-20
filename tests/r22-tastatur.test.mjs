// fc-05:45 Tastatur und Vorleser, die zwei Befunde des Durchgangs (Bericht: Vault R20-Kritik/tastatur/bericht.md):
//   A) Ich: nach jedem Sammlungs-Blatt (Escape oder "Fertig") steht der Fokus wieder auf dem Knopf mit demselben
//      data-bereich. Bis 20.11. zeichnete js/ui/ich.js die Plaetze nach dem Schliessen neu, der Ausloeser war weg und der
//      Fokus fiel auf body. Ebenso nach "Zur Sammlung" aus den Einstellungen (dort wird das Blatt auf Ich geoeffnet).
//   B) Coach: eingeklappt (PC nach dem Bot-Zug "kompakt", Handy hoch "hat-rest") ist die Kopfzeile ein Schalter
//      (role=button, aria-expanded), Tab erreicht ihn, Enter klappt auf und zu, die Coach-Knoepfe sind dann per Tab da.
//   C) je Hauptseite: kein sichtbarer Knopf ohne Namen.
// PC 1280 und iPhone 13.
//
//   node tests/r22-tastatur.test.mjs
//   PORT=9796 node tests/r22-tastatur.test.mjs    Port des Testservers (sonst: frei)
//
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright.
import http from 'node:http';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { browserTyp } from './browser.mjs';

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
  console.log(`${gut ? 'ok    ' : 'FEHLER'} ${name}${!gut && d ? ' ' + d.slice(0, 400) : ''}`);
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
const P = 'schach-arena:v1:';
const PS = '.screen.partie:not(.online-screen)';
const { defaultBrowserType: _x, ...IPHONE } = pw.devices['iPhone 13'];
const GERAETE = [['PC', { viewport: { width: 1280, height: 800 } }], ['iPhone 13', IPHONE]];

const browser = await browserTyp(pw).launch();
const fehler = [];
async function seite(geraet, einst = {}) {
  const k = await browser.newContext({ ...geraet, locale: 'de-DE' });
  await k.route('**/*', (r) => {
    const u = new URL(r.request().url());
    if (u.hostname === '127.0.0.1') return r.continue();
    return /supabase\.co$/.test(u.hostname) ? r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }) : r.abort();
  });
  await k.addInitScript((sp) => {
    if (sessionStorage.getItem('vorbelegt')) return; sessionStorage.setItem('vorbelegt', '1');
    for (const [s, w] of Object.entries(sp)) localStorage.setItem(s, typeof w === 'string' ? w : JSON.stringify(w));
  }, { [P + 'modul:start']: { v: 1, gesehen: '2026-11-01' }, [P + 'hinweis-installieren']: '1',
    [P + 'einstellungen']: { klang: false, sprache: 'de', spracheGewaehlt: true, ...einst } });
  const s = await k.newPage();
  s.on('pageerror', (e) => fehler.push(e.message));
  await s.goto(HOST + 'index.html?test');
  await s.waitForFunction(() => !!window.__app, null, { timeout: 30000 });
  await s.waitForTimeout(2500);
  return { k, s };
}
const offenesBlatt = (s) => s.evaluate(() => !!document.querySelector('.sheet-karte'));
const fokus = (s) => s.evaluate(() => { const e = document.activeElement;
  return { body: !e || e === document.body, bereich: e?.closest('[data-bereich]')?.dataset.bereich || null, text: (e?.getAttribute('aria-label') || e?.textContent || '').trim().slice(0, 40) }; });

for (const [g, geraet] of GERAETE) {
  // ---------- A) Ich: Fokus nach jedem Blatt zurueck ----------
  {
    const { k, s } = await seite(geraet);
    await s.evaluate(() => window.__app.gehe('ich'));
    await s.waitForSelector('.sa-plaetze [data-bereich]', { timeout: 15000 });
    await s.waitForTimeout(800);
    const bereiche = await s.$$eval('.sa-plaetze [data-bereich]', (l) => l.map((e) => e.dataset.bereich));
    pruefe(`${g} Ich: Sammlungs-Plaetze da`, bereiche.length >= 8, bereiche);
    const verloren = [];
    let geoeffnet = 0;
    for (const [i, b] of bereiche.entries()) {
      const weg = i % 2 ? 'fertig' : 'escape';   // abwechselnd Escape und der Knopf "Fertig" (per Enter)
      await s.locator(`.sa-plaetze [data-bereich="${b}"]`).first().focus();
      await s.keyboard.press('Enter');
      await s.waitForSelector('.sheet-karte', { timeout: 5000 }).catch(() => {});
      if (!(await offenesBlatt(s))) { verloren.push([b, 'kein Blatt']); continue; }
      geoeffnet++;
      if (weg === 'escape') await s.keyboard.press('Escape');
      else { await s.locator('.sheet-karte .sheet-knoepfe button').last().focus(); await s.keyboard.press('Enter'); }
      await s.waitForFunction(() => !document.querySelector('.sheet-karte'), null, { timeout: 5000 }).catch(() => {});
      await s.waitForTimeout(400);
      const f = await fokus(s);
      if (f.bereich !== b) verloren.push([b, weg, f]);
    }
    pruefe(`${g} Ich: jedes Blatt (${geoeffnet}) gibt den Fokus an den Knopf mit gleichem data-bereich zurueck`,
      geoeffnet === bereiche.length && verloren.length === 0, verloren);
    // Profil oben: "Profilbild ändern" und der erste Vitrinen-Platz; nach dem Blatt zeichnet profil.js den ganzen Bildschirm neu
    const profil = [];
    for (const sel of ['.pr-aendern', '.pr-orden[data-platz="0"]']) {
      await s.locator(sel).first().focus().catch(() => {});
      await s.keyboard.press('Enter');
      const auf = await s.waitForSelector('.sheet-karte', { timeout: 5000 }).then(() => true, () => false);
      await s.keyboard.press('Escape');
      await s.waitForFunction(() => !document.querySelector('.sheet-karte'), null, { timeout: 5000 }).catch(() => {});
      await s.waitForTimeout(1200);
      const da = await s.evaluate((q) => !!document.activeElement && document.activeElement.matches(q), sel);
      if (!auf || !da) profil.push([sel, { auf, da, f: await fokus(s) }]);
    }
    pruefe(`${g} Ich: "Profilbild ändern" und Vitrine geben den Fokus nach dem Blatt an ihren Nachfolger`, profil.length === 0, profil);
    await k.close();
  }
  // ---------- A2) Einstellungen "Zur Sammlung": Blatt Bretter auf Ich, danach Fokus auf dem Platz ----------
  {
    const { k, s } = await seite(geraet);
    await s.evaluate(() => window.__app.gehe('einstellungen'));
    await s.waitForTimeout(1000);
    const knopf = s.getByRole('button', { name: 'Zur Sammlung', exact: true }).first();
    // Handy: die Einstellungen zeigen erst die Bereiche, der Knopf steht unter "Anzeige" (per Tastatur geoeffnet)
    if (!(await knopf.isVisible().catch(() => false))) {
      await s.locator('.es-nav-punkt', { hasText: 'Anzeige' }).first().focus().catch(() => {});
      await s.keyboard.press('Enter');
      await s.waitForTimeout(800);
    }
    await knopf.waitFor({ timeout: 15000 }).catch(() => {});
    await knopf.focus().catch(() => {});
    await s.keyboard.press('Enter');
    await s.waitForSelector('.sheet-karte', { timeout: 8000 }).catch(() => {});
    const blatt = await offenesBlatt(s);
    await s.keyboard.press('Escape');
    await s.waitForFunction(() => !document.querySelector('.sheet-karte'), null, { timeout: 5000 }).catch(() => {});
    await s.waitForTimeout(400);
    const f = await fokus(s);
    pruefe(`${g} Zur Sammlung: Blatt auf, Escape, Fokus auf dem Platz "bretter"`, blatt && f.bereich === 'bretter', { blatt, f });
    await k.close();
  }
  // ---------- B) Coach per Tastatur aufklappen ----------
  {
    const { k, s } = await seite(geraet, { liveBewertung: true });
    await s.evaluate(() => { const p = { e2e4: 'e7e5', f1a6: 'b8c6' };
      window.__test = { ...(window.__test || {}), botZug: () => { const v = window.__partie.chess().history({ verbose: true }); return p[v[v.length - 1].lan] || null; } }; });
    await s.evaluate(() => window.__app.gehe('partie', { botId: 'fridolin', farbe: 'w' }));
    await s.waitForFunction(() => window.__partie && window.__partie.bereit === true && window.__partie.phase() === 'flo', null, { timeout: 40000 });
    for (const uci of ['e2e4', 'f1a6']) {
      await s.waitForFunction(() => window.__partie.phase() === 'flo', null, { timeout: 40000 });
      for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) await s.locator(`${PS} .brett-felder .feld[data-feld="${f}"]`).click();
      if (await s.locator(`${PS} .brett .lage.vorschau`).count()) await s.locator(`${PS} .brett-felder .feld[data-feld="${uci.slice(2, 4)}"]`).click();
    }
    // eingeklappt: PC nach dem Bot-Zug kompakt (3,5 s), Handy hoch hat-rest ohne offen
    const zu = await s.waitForFunction(() => { const c = document.querySelector('.coach');
      return c && c.querySelector('[data-aktion="besser"]') && (c.classList.contains('kompakt') || (c.classList.contains('hat-rest') && !c.classList.contains('offen'))); },
    null, { timeout: 45000 }).then(() => true, () => false);
    const knopfVorher = await s.evaluate(() => { const b = document.querySelector('.coach [data-aktion="besser"]'); return !!b && b.getClientRects().length > 0; });
    pruefe(`${g} Coach: nach dem Patzer 2.La6 eingeklappt, "Besserer Zug" verborgen`, zu && !knopfVorher, { zu, knopfVorher });
    // Tab bis zum Coach-Schalter
    await s.evaluate(() => { document.activeElement?.blur?.(); });
    let erreicht = false;
    for (let i = 0; i < 40 && !erreicht; i++) {
      await s.keyboard.press('Tab');
      erreicht = await s.evaluate(() => !!document.activeElement?.closest('.coach .c-kopf'));
    }
    const schalter = await s.evaluate(() => { const e = document.activeElement;
      return { rolle: e?.getAttribute('role'), offen: e?.getAttribute('aria-expanded'), name: (e?.textContent || '').trim().slice(0, 40) }; });
    pruefe(`${g} Coach: Tab erreicht den Kopf als Schalter (role=button, aria-expanded=false)`, erreicht && schalter.rolle === 'button' && schalter.offen === 'false', { erreicht, schalter });
    await s.keyboard.press('Enter');
    await s.waitForTimeout(400);
    const auf = await s.evaluate(() => { const c = document.querySelector('.coach'); const b = c.querySelector('[data-aktion="besser"]');
      return { offen: document.activeElement?.getAttribute('aria-expanded'), knopf: !!b && b.getClientRects().length > 0,
        text: !!c.querySelector('.c-text') && c.querySelector('.c-text').getClientRects().length > 0 }; });
    await s.keyboard.press('Tab');
    const naechster = await s.evaluate(() => document.activeElement?.dataset.aktion || '');
    pruefe(`${g} Coach: Enter klappt auf (aria-expanded=true, Text und "Besserer Zug" sichtbar, Tab erreicht den Knopf)`,
      auf.offen === 'true' && auf.knopf && auf.text && naechster === 'besser', { auf, naechster });
    await s.keyboard.press('Shift+Tab');
    await s.keyboard.press(' ');
    await s.waitForTimeout(400);
    const wiederZu = await s.evaluate(() => { const b = document.querySelector('.coach [data-aktion="besser"]');
      return { offen: document.activeElement?.getAttribute('aria-expanded'), knopf: !!b && b.getClientRects().length > 0 }; });
    pruefe(`${g} Coach: Leertaste klappt wieder zu`, wiederZu.offen === 'false' && !wiederZu.knopf, wiederZu);
    await k.close();
  }
  // ---------- B2) nach dem Verlassen der Partie ist der Coach-Beobachter getrennt (Kaltreview 7b, fc-05:45) ----------
  {
    const { k, s } = await seite(geraet);
    await s.evaluate(() => window.__app.gehe('partie', { botId: 'fridolin', farbe: 'w' }));
    await s.waitForFunction(() => window.__partie && window.__partie.bereit === true && !!document.querySelector('.coach'), null, { timeout: 40000 });
    await s.evaluate(() => { window.__alterCoach = document.querySelector('.coach'); });
    await s.evaluate(() => window.__app.gehe('heim'));
    await s.waitForFunction(() => !window.__alterCoach.isConnected, null, { timeout: 10000 }).catch(() => {});
    // am abgehaengten Coach: neue Kopfzeile und "hat-rest"; ein noch verbundener Beobachter machte daraus einen Schalter
    const still = await s.evaluate(async () => {
      const c = window.__alterCoach;
      c.innerHTML = '<div class="c-kopf"></div>';
      c.classList.add('hat-rest');
      await new Promise((r) => setTimeout(r, 50));
      return { getrennt: !c.isConnected, rolle: c.querySelector('.c-kopf').getAttribute('role') };
    });
    pruefe(`${g} Coach: nach dem Verlassen der Partie reagiert der Beobachter nicht mehr`, still.getrennt && still.rolle === null, still);
    await k.close();
  }
  // ---------- C) kein sichtbarer Knopf ohne Namen ----------
  {
    const { k, s } = await seite(geraet);
    const ohne = [];
    for (const [ziel, p] of [['heim', {}], ['lernen', {}], ['lernen', { bereich: 'erste' }], ['bestenliste', {}], ['ich', {}], ['einstellungen', {}], ['online', {}],
      ['partie', { botId: 'fridolin', farbe: 'w' }]]) {
      await s.evaluate(([z, q]) => window.__app.gehe(z, q), [ziel, p]);
      await s.waitForTimeout(1500);
      const l = await s.evaluate(() => [...document.querySelectorAll('button, a[href], [role="button"], [role="switch"], [role="tab"], [role="radio"]')]
        .filter((e) => e.getClientRects().length && !e.closest('[inert], [aria-hidden="true"]') && !e.closest('.brett-felder'))
        .filter((e) => { const lb = e.getAttribute('aria-labelledby');
          return !((e.getAttribute('aria-label') || (lb && document.getElementById(lb)?.textContent) || e.innerText || e.getAttribute('title') || '').trim()); })
        .map((e) => (e.className || e.tagName).toString().slice(0, 50)));
      for (const x of l) ohne.push(`${ziel}: ${x}`);
    }
    pruefe(`${g}: auf 8 Hauptseiten kein sichtbarer Knopf ohne Namen`, ohne.length === 0, ohne);
    await k.close();
  }
}

pruefe('keine Seitenfehler', fehler.length === 0, fehler);
await browser.close(); server.close();
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
