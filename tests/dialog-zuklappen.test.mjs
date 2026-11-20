// Rueckfrage-Dialog (app.frage, js/app.js): der zuklappende Dialog (.dialog-ort.weg, 200 ms Ausblenden) darf keinen Klick
// mehr abfangen. Befund Funktionsprobe 12.11.2026: am PC ging der erste Klick aufs Brett bis 300 ms nach "Neue Partie"
// verloren. Geprueft: offener Dialog nimmt Klicks an, Schleier-Tipp schliesst, und 50 ms nach dem Schliessen kommt ein Zug
// auf dem Brett darunter an (Zu zweit, iPhone 13 und PC 1280).
//   node tests/dialog-zuklappen.test.mjs
//   DROSSEL=6 node tests/dialog-zuklappen.test.mjs   CPU per CDP gedrosselt (nur Chromium), Probe fuer Last wie in der CI
//   VERZUG=300 node tests/dialog-zuklappen.test.mjs  haelt den Testlaeufer nach dem Schliessen kuenstlich auf (langsamer Runner)
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');
const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + new URL(req.url, 'http://test').pathname.replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const inhalt = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(inhalt); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}
const { defaultBrowserType: _typ, ...IPHONE } = pw.devices['iPhone 13'];
const { defaultBrowserType: _typSE, ...IPHONE_SE } = pw.devices['iPhone SE'];
const GERAETE = [['iphone13', IPHONE, true], ['iphonese', IPHONE_SE, true], ['pc1280', { viewport: { width: 1280, height: 800 } }, false]];

// CPU-Drossel per CDP (Emulation.setCPUThrottlingRate), damit Zeitfehler wie in der CI auch lokal auftreten
const DROSSEL = Number(process.env.DROSSEL) || 0;
const VERZUG = Number(process.env.VERZUG) || 0;
async function drossle(k, s) {
  if (!DROSSEL) return;
  const c = await k.newCDPSession(s);
  await c.send('Emulation.setCPUThrottlingRate', { rate: DROSSEL });
}

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  for (const [name, optionen, finger] of GERAETE) {
    const k = await browser.newContext({ ...optionen, serviceWorkers: 'block', locale: 'de-DE' });
    await k.route('**/*.supabase.co/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await k.addInitScript(() => {
      if (!localStorage.getItem('schach-arena:v1:einstellungen')) localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'aus' }));
    });
    const s = await k.newPage(); s.setDefaultTimeout(15000);
    await drossle(k, s);
    const fehler = [];
    s.on('pageerror', e => fehler.push(e.message));
    await s.goto(`http://127.0.0.1:${PORT}/?test#heim`);
    await s.waitForFunction(() => !!window.__app);
    await s.evaluate(() => window.__app.gehe('heim'));
    await s.locator('[data-aktion="heim-zuzweit"]').click();
    await s.getByRole('button', { name: 'Los', exact: true }).click();
    await s.waitForFunction(() => window.__partie?.z?.modus === 'zuzweit' && document.querySelector('.zz-brett')?.getBoundingClientRect().width > 100);
    await s.locator('.zz-brett').scrollIntoViewIfNeeded();
    const mitte = async sel => { const r = await s.locator(sel).first().boundingBox(); return [r.x + r.width / 2, r.y + r.height / 2]; };
    const tipp = async ([x, y]) => (finger ? s.touchscreen.tap(x, y) : s.mouse.click(x, y));
    const frage = () => s.evaluate(() => { window.__antwort = undefined; window.__app.frage({ titel: 'Probe', knoepfe: [{ text: 'OK', wert: 'ok', art: 'primaer' }], abbrechen: 'zu' })
      .then(w => { window.__antwort = w; }); });

    // 1. offener Dialog nimmt den Knopf an (die Reparatur darf ihn nicht klicklos machen)
    await frage(); await s.locator('.dialog-ort:not(.weg) .dialog').waitFor();
    await tipp(await mitte('.dialog-knoepfe .knopf'));
    pruefe(`${name}: offener Dialog nimmt den Knopf an`, await s.waitForFunction(() => window.__antwort === 'ok', null, { timeout: 3000 }).then(() => true, () => false));
    await s.waitForFunction(() => !document.querySelector('.dialog-ort'));

    // 2. Tipp auf den Schleier schliesst mit "abbrechen"; getippt wird genau ueber "Zurueck zum Start"
    const zurueck = await mitte('[data-zz="zurueck"]');
    await frage(); await s.locator('.dialog-ort:not(.weg) .dialog').waitFor();
    await tipp(zurueck);
    pruefe(`${name}: Tipp auf den Schleier schliesst`, await s.waitForFunction(() => window.__antwort === 'zu', null, { timeout: 3000 }).then(() => true, () => false));
    await s.waitForFunction(() => !document.querySelector('.dialog-ort'));
    // 2b. derselbe Tipp loest den Knopf darunter nicht aus (Befund 19.11.2026: die Partie war weg)
    const unter = await s.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('[data-zz]')?.dataset.zz || null, zurueck);
    const lage = await s.evaluate(() => ({ hash: location.hash, brett: !!document.querySelector('.zz-brett .feld'), zuege: window.__partie?.z?.zuege?.join() }));
    pruefe(`${name}: Tipp auf den Schleier drueckt nicht den Knopf darunter (${unter})`, unter === 'zurueck' && lage.hash === '#partie' && lage.brett && lage.zuege === '', lage);
    // ohne Partie gibt es kein Brett fuer 3 und 4: Geraet beenden, die uebrigen Geraete und Blaetter laufen weiter
    if (lage.hash !== '#partie') { pruefe(`${name}: Schritte 3 und 4 (Partie verlassen, nicht geprueft)`, false); await k.close(); continue; }

    // 3. Im Zuklapp-Fenster: Zug auf dem Brett darunter (f2, f3), solange .dialog-ort.weg noch im DOM steht.
    // Das Fenster ist app.frage's setTimeout(() => ort.remove(), 200). Unter Last (CI, 1 von 7 Laeufen) war es vorbei, bevor
    // die Tipps kamen ("Probe lief im Zuklapp-Fenster" rot). Darum haelt die Probe genau diesen einen Timer an: der erste
    // 200-ms-Timer, der gestellt wird, waehrend .dialog-ort.weg steht. Erst nach den Tipps laeuft er ab. Die Pruefung bleibt
    // gleich streng: echte Tipps gehen durch den zuklappenden Dialog aufs Brett.
    const f2 = await mitte('.zz-brett .feld[data-feld="f2"]'), f3 = await mitte('.zz-brett .feld[data-feld="f3"]');
    await frage(); await s.locator('.dialog-ort:not(.weg) .dialog').waitFor();
    await s.evaluate(() => {
      const echt = window.setTimeout;
      window.__zuGehalten = null;
      window.__zuEcht = echt;
      window.setTimeout = function (fn, ms, ...rest) {
        if (ms === 200 && !window.__zuGehalten && document.querySelector('.dialog-ort.weg')) {
          window.__zuGehalten = () => fn(...rest);
          window.setTimeout = echt;
          return 0;
        }
        return echt.call(this, fn, ms, ...rest);
      };
    });
    await tipp(await mitte('.dialog-knoepfe .knopf'));
    const gehalten = await s.waitForFunction(() => !!window.__zuGehalten && !!document.querySelector('.dialog-ort.weg'), null, { timeout: 5000 })
      .then(() => true, () => false);
    if (VERZUG) await s.waitForTimeout(VERZUG);
    await tipp(f2); await tipp(f3);
    const zug = await s.waitForFunction(() => window.__partie.z.zuege.join() === 'f2f3', null, { timeout: 5000 }).then(() => true, () => false);
    const wegNoch = await s.evaluate(() => !!document.querySelector('.dialog-ort.weg'));
    // Timer freigeben (oder, falls er nie kam, die echte Uhr zurueck) und auf das Ende des Dialogs warten
    await s.evaluate(() => { window.setTimeout = window.__zuEcht; window.__zuGehalten?.(); });
    await s.waitForFunction(() => !document.querySelector('.dialog-ort'), null, { timeout: 5000 });
    pruefe(`${name}: Klick im Zuklapp-Fenster kommt auf dem Brett an (f2-f3)`, zug,
      { zuege: await s.evaluate(() => window.__partie.z.zuege.join()), wegNoch, gehalten });
    pruefe(`${name}: Probe lief im Zuklapp-Fenster (.dialog-ort.weg stand noch, 200-ms-Timer gehalten)`, wegNoch && gehalten, { wegNoch, gehalten });

    // 4. Gegenprobe: nach dem Schliessen per Schleier kommt ein spaeterer Tipp (nach der Frist von 600 ms) normal an
    await frage(); await s.locator('.dialog-ort:not(.weg) .dialog').waitFor();
    await tipp(zurueck);
    await s.waitForFunction(() => window.__antwort === 'zu' && !document.querySelector('.dialog-ort'), null, { timeout: 3000 });
    await s.waitForTimeout(700);
    const e7 = await mitte('.zz-brett .feld[data-feld="e7"]'), e5 = await mitte('.zz-brett .feld[data-feld="e5"]');
    await tipp(e7); await tipp(e5);
    pruefe(`${name}: spaeterer Tipp nach dem Schleier kommt an (e7-e5)`,
      await s.waitForFunction(() => window.__partie.z.zuege.join() === 'f2f3,e7e5', null, { timeout: 2000 }).then(() => true, () => false),
      { zuege: await s.evaluate(() => window.__partie.z.zuege.join()), hash: await s.evaluate(() => location.hash) });
    pruefe(`${name}: keine Seitenfehler`, fehler.length === 0, fehler);
    await k.close();
  }

  // 5. Blaetter (.sheet-ort) schliessen ebenso bei pointerdown auf ihren Schleier: Tipp genau ueber "Zurueck zum Start"
  // schliesst nur das Blatt, die Partie bleibt (per Touch, je Blatt eine frische Partie "Zu zweit"). trainer und teilen
  // fuellen auf dem iPhone 13 den Schirm ab 12 px, dort liegt kein Knopf unter freiem Schleier: sie laufen auf dem iPad Mini.
  const { defaultBrowserType: _typPad, ...IPAD } = pw.devices['iPad Mini'];
  const BLAETTER = [
    ['sheet', () => import('/js/ui/bauteile.js').then((m) => { m.sheet({ titel: 'Probe', abbrechen: 'zu' }); })],
    ['trainer', () => import('/js/pakete/abo/trainer.js').then((m) => { m.zeigeTrainer({ app: window.__app }); }), IPAD],
    ['funken', () => import('/js/pakete/funken/ansicht.js').then((m) => { const d = document.createElement('p'); d.textContent = 'Probe'; m.oeffneSpiegel(d); })],
    ['serie', () => import('/js/pakete/serie/ansicht.js').then((m) => { const d = document.createElement('p'); d.textContent = 'Probe'; m.oeffneBlatt(d); })],
    ['teilen', () => import('/js/pakete/teilen/index.js').then((m) => {
      m.oeffneBlatt({ app: window.__app, partie: { ergebnis: 'sieg', modus: 'zuzweit', zuege: ['e2e4', 'e7e5', 'd1h5', 'b8c6', 'f1c4', 'g8f6', 'h5f7'] } });
    }), IPAD],
  ];
  for (const [blatt, oeffne, geraet = IPHONE] of BLAETTER) {
    const k = await browser.newContext({ ...geraet, serviceWorkers: 'block', locale: 'de-DE' });
    await k.route('**/*.supabase.co/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await k.addInitScript(() => localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'aus' })));
    const s = await k.newPage(); s.setDefaultTimeout(15000);
    await drossle(k, s);
    const fehler = [];
    s.on('pageerror', e => fehler.push(e.message));
    await s.goto(`http://127.0.0.1:${PORT}/?test#heim`);
    await s.waitForFunction(() => !!window.__app);
    await s.evaluate(() => window.__app.gehe('heim'));
    await s.locator('[data-aktion="heim-zuzweit"]').click();
    await s.getByRole('button', { name: 'Los', exact: true }).click();
    await s.waitForFunction(() => window.__partie?.z?.modus === 'zuzweit' && document.querySelector('[data-zz="zurueck"]'));
    const r = await s.locator('[data-zz="zurueck"]').boundingBox();
    await s.evaluate(oeffne);
    await s.locator('.sheet-ort:not(.weg) .sheet-schleier').waitFor();
    // auf den Zustand warten statt auf 400 ms: der Schleier liegt an der Stelle von "Zurueck" (Blatt eingefahren)
    const punkt = [r.x + r.width / 2, r.y + r.height / 2];
    await s.waitForFunction(([x, y]) => /sheet-schleier/.test(document.elementFromPoint(x, y)?.className || ''), punkt, { timeout: 5000 })
      .catch(() => {});
    const unter = await s.evaluate(([x, y]) => document.elementFromPoint(x, y)?.className || '', punkt);
    await s.touchscreen.tap(...punkt);
    // erst warten, bis das Blatt zu ist; danach die Frist des Klick-Faengers (600 ms, js/ui/bauteile.js) abwarten, in der
    // ein durchgereichter Klick die Partie verlassen haette (diese Wartezeit ist die Gegenprobe selbst, kein Takt)
    await s.waitForFunction(() => !document.querySelector('.sheet-ort:not(.weg)'), null, { timeout: 5000 }).catch(() => {});
    await s.waitForTimeout(700);
    const lage = await s.evaluate(() => ({ hash: location.hash, offen: !!document.querySelector('.sheet-ort:not(.weg)') }));
    pruefe(`Blatt ${blatt}: Tipp auf den Schleier ueber "Zurueck" schliesst nur das Blatt`,
      /sheet-schleier/.test(unter) && lage.hash === '#partie' && !lage.offen, { unter, ...lage });
    pruefe(`Blatt ${blatt}: keine Seitenfehler`, fehler.length === 0, fehler);
    await k.close();
  }
} catch (e) { pruefe('Ablauf ohne Abbruch', false, e.stack); }
finally { await browser?.close(); await new Promise(r => server.close(r)); }
console.log(`\n${ok}/${gesamt} bestanden`);
process.exitCode = ok === gesamt ? 0 : 1;
