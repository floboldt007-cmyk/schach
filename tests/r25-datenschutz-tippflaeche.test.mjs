// R25 Kleinkram (fc, 20.11.2026): der Link "Datenschutzerklaerung" vor dem Alters-Haken (Weltrangliste und Season) war nur
// 19 bis 21 px hoch. Seine Tippflaeche soll mindestens 44 px hoch sein, ohne den rechtlich abgestimmten Text oder das Bild zu
// aendern und ohne den Haken zu ueberdecken. Geprueft je Engine auf iPhone SE, iPhone 13 und PC, DE und EN:
//   (1) jede Zeile des Links trifft man auf mindestens 44 px Hoehe (elementFromPoint von der Zeilenmitte nach oben und unten)
//   (2) der Haken und sein Label bleiben ganz der Haken: elementFromPoint auf der oberen Kante trifft nie den Link
//   (3) das Bild ist pixelgleich mit dem Stand ohne die Vergroesserung (Polster per Stil auf 0 gesetzt)
//   node tests/r25-datenschutz-tippflaeche.test.mjs     beide Engines (PLAYWRIGHT_PFAD); BROWSER=webkit nur eine
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { freierPort } from './freier-port.mjs';

let ok = 0; let fehler = 0;
function pruefe(name, wert, info = '') { // INTENTIONAL-SLOP[T4]: die Konsole ist der Ausgabeweg der Probe (tests/alle.mjs liest sie)
  if (wert) { ok++; console.log('ok   ' + name); } else { fehler++; console.log('FEHLER ' + name + ' ' + (typeof info === 'string' ? info : JSON.stringify(info))); }
}
const require = createRequire(import.meta.url);
let pw = null;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ } // INTENTIONAL-SLOP[F1]: Fehlschlag heisst naechster Kandidat
}
if (!pw) { pruefe('Playwright gefunden', false); console.log(`${ok}/${ok + fehler} bestanden`); process.exit(1); } // INTENTIONAL-SLOP[T4]: Ausgabeweg

const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const pfad = path.join(root, decodeURIComponent(new URL(req.url, 'http://test').pathname));
  if (!pfad.startsWith(root)) { res.writeHead(403); return res.end(); }
  try { const d = readFileSync(pfad); res.writeHead(200, { 'Content-Type': typen[path.extname(pfad)] || 'application/octet-stream' }); res.end(d); }
  catch (e) { res.writeHead(404); res.end(); }
});
const port = await freierPort();
await new Promise((r) => server.listen(port, '127.0.0.1', r));
const H = `http://127.0.0.1:${port}`;

// Supabase als Attrappe in der Form der RPCs: nicht in der Weltrangliste, Season ohne Sichtbarkeit (der Haken erscheint)
const WELT = { ab: 15, ab_start: 30, teilnahme: false, liste: [], ich: { status: 'nicht_dabei' } };
const SAISON = { saison: 3, start: '2026-11-16', woche: 1, wochen: 8, ende: '2027-01-10', bisher: 0, stufe: 0, abzeichen: [], titel: [], gewaehlt: null, sichtbar: false };
const ORTE = {
  welt: { link: '.lg-welt-einwilligung a', haken: '.lg-welt-alter input', bild: '.lg-welt-teilnahme' },
  season: { link: '.ss-einwilligung a', haken: '.ss-alter input', bild: '.ss-einwilligung' },
};
const ohneGeraeteBrowser = (g) => { const { defaultBrowserType: _x, ...rest } = g; return rest; };

try {
  for (const engine of ['chromium', 'webkit'].filter((e) => !process.env.BROWSER || process.env.BROWSER === e)) {
    const browser = await pw[engine].launch();
    const GERAETE = {
      se: ohneGeraeteBrowser(pw.devices['iPhone SE']),
      iphone13: ohneGeraeteBrowser(pw.devices['iPhone 13']),
      pc: { viewport: { width: 1280, height: 800 } },
    };
    // WebKit unter Windows kennt isMobile nicht
    if (engine === 'webkit') for (const g of Object.values(GERAETE)) delete g.isMobile;
    try {
      for (const [gn, geraet] of Object.entries(GERAETE)) for (const spr of ['de', 'en']) for (const [ort, sel] of Object.entries(ORTE)) {
        const tag = `${engine} ${gn} ${spr} ${ort}`;
        const k = await browser.newContext({ ...geraet, serviceWorkers: 'block' });
        await k.route('**/*', (r) => {
          const u = r.request().url();
          if (u.startsWith(H)) return r.continue();
          if (!/supabase/.test(u)) return r.abort();
          return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.includes('weltrang_liste') ? WELT : u.includes('saison_mein_stand') ? SAISON : []) });
        });
        await k.addInitScript((spr) => {
          localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ sprache: spr, spracheGewaehlt: true, klang: false }));
          localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify({ access_token: 'a.e30.x', refresh_token: 'r', expires_at: 9999999999, user: { id: 'u1' } }));
          localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' }));
          localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
          localStorage.setItem('schach-arena:v1:season-gesehen', JSON.stringify({ u1: 99999 }));
        }, spr);
        const s = await k.newPage();
        try {
          if (ort === 'welt') {
            await s.goto(`${H}/index.html?test&paket2#bestenliste`);
            await s.waitForSelector('.bl-steuer-reiter', { timeout: 30000 });
            await s.locator('.bl-steuer-reiter :is([role="radio"], button)').filter({ hasText: spr === 'de' ? /^\s*Welt\s*$/ : /^\s*World\s*$/ }).first().click();
          } else {
            await s.goto(`${H}/index.html?test&paket2#einstellungen`);
            await s.waitForSelector('#app > .screen', { timeout: 30000 });
            await s.waitForTimeout(1200);
            // Handy: Season hat eine eigene Seite
            if (!(await s.locator(sel.link + ':visible').count())) await s.evaluate(() => window.__app.gehe('einstellungen', { seite: 'season' }));
          }
          await s.locator(sel.link + ':visible').first().waitFor({ timeout: 15000 });
          await s.evaluate((l) => document.querySelector(l).scrollIntoView({ block: 'center' }), sel.link);
          await s.waitForTimeout(300);
          const m = await s.evaluate(([l, h]) => {
            const a = document.querySelector(l); const haken = document.querySelector(h); const label = haken.closest('label');
            const trifftLink = (x, y) => { const e = document.elementFromPoint(x, y); return !!e && (e === a || a.contains(e)); };
            // je Zeile des Links: von der Mitte senkrecht so weit, wie elementFromPoint den Link trifft
            const zeilen = [...a.getClientRects()].map((q) => {
              const x = q.left + q.width / 2; const y0 = q.top + q.height / 2; let oben = y0, unten = y0;
              while (oben > y0 - 60 && trifftLink(x, oben - 1)) oben--;
              while (unten < y0 + 60 && trifftLink(x, unten + 1)) unten++;
              return Math.round(unten - oben + 1);
            });
            // obere Kante und Mitte von Haken und Label, ueber die ganze Breite des Labels
            const lr = label.getBoundingClientRect(); const hr = haken.getBoundingClientRect(); const daneben = [];
            const punkte = [[hr.left + hr.width / 2, hr.top + hr.height / 2], [hr.left + 1, hr.top + 1], [hr.right - 1, hr.top + 1]];
            for (let x = lr.left + 1; x < lr.right - 1; x += 8) punkte.push([x, lr.top + 1]);
            for (const [x, y] of punkte) { const e = document.elementFromPoint(x, y); if (!(e === haken || (e && label.contains(e)))) daneben.push([Math.round(x), Math.round(y), e ? e.tagName + '.' + e.className : null]); }
            return { zeilen, daneben, text: a.textContent.trim() };
          }, [sel.link, sel.haken]);
          pruefe(`${tag}: (1) Tippflaeche je Zeile mindestens 44 px`, m.zeilen.length > 0 && m.zeilen.every((z) => z >= 44), m);
          pruefe(`${tag}: (2) Haken und Label treffen weiter den Haken`, m.daneben.length === 0, m.daneben.slice(0, 4));
          const flaeche = s.locator(sel.bild).first();
          const mit = await flaeche.screenshot({ animations: 'disabled' });
          const stil = await s.addStyleTag({ content: `${sel.link} { padding: 0 !important; margin: 0 !important; }` });
          await s.waitForTimeout(100);
          const ohne = await flaeche.screenshot({ animations: 'disabled' });
          await stil.evaluate((e) => e.remove());
          pruefe(`${tag}: (3) Bild pixelgleich mit dem Stand ohne Vergroesserung`, mit.equals(ohne), `${mit.length} gegen ${ohne.length} Byte`);
        } catch (e) {
          pruefe(`${tag}: Ablauf`, false, e.message.split('\n')[0]);
        }
        await k.close();
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  server.close();
}
console.log(`${ok}/${ok + fehler} bestanden`); // INTENTIONAL-SLOP[T4]: die Konsole ist der Ausgabeweg der Probe (tests/alle.mjs liest sie)
process.exit(fehler ? 1 : 0);
