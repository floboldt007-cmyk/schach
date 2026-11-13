// Ansichts-Befunde an festen Probe-Seiten (Feinschliff R8, Layout-Kritik): Was unter einem [inert]-Vorfahren liegt (der
// stillgelegte Hintergrund hinter einem offenen Blatt, js/ui/bauteile.js) oder unter einem unsichtbaren Vorfahren
// (opacity 0, visibility hidden, eine geschlossene Ansicht mit display none), sieht und erreicht niemand. Es darf in keiner
// Pruefung zaehlen; vorher zaehlte es ausser bei den Knopfgroessen ueberall mit (Fehlbefunde).
// Gegenprobe: derselbe Inhalt offen wird in jeder Pruefung gefunden, der Filter verschluckt also nichts Sichtbares.
//   node tests/ansicht-befunde.test.mjs
import { createRequire } from 'node:module';
import { browserTyp } from './browser.mjs';
import { befundeDerSeite, untenFrei } from './ansicht-befunde.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

// je ein Befund jeder Art: kleine Schrift, kleiner Knopf, zwei Knoepfe uebereinander, Text abgeschnitten, ueber den
// rechten Rand, unten gekappt, Knopf unter der Reiter-Leiste
const PROBE = `
  <p class="p-klein" style="font-size:9px">winzig</p>
  <button class="p-knopf" style="width:30px;height:30px;padding:0">k</button>
  <div style="position:relative;height:60px"><button style="position:absolute;left:0;top:0;width:60px;height:50px">a</button><button style="position:absolute;left:20px;top:10px;width:60px;height:50px">b</button></div>
  <div class="p-ab" style="width:60px;overflow:hidden;white-space:nowrap">ein sehr langer Text ohne Punkte</div>
  <div class="p-rand" style="position:relative;left:300px;width:200px;height:20px">rechts raus</div>
  <div class="p-gekappt" style="height:130px;overflow:hidden"><div style="height:400px">hoch</div></div>
  <div style="height:700px"></div>
  <button class="p-unten" style="width:200px;height:48px">ganz unten</button>`;
const HUELLEN = {
  offen: (x) => x,
  inert: (x) => `<div inert>${x}</div>`,
  unsichtbar: (x) => `<div style="opacity:0">${x}</div>`,
  'geschlossene Ansicht': (x) => `<section class="screen" style="display:none">${x}</section>`,
};
const seite = (huelle) => `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin:0; font: 16px sans-serif; } .reiter-leiste { position:fixed; left:0; right:0; bottom:0; height:64px; background:#eee; }
  </style></head><body><main class="screen" style="width:400px">${huelle(PROBE)}</main>
  <nav class="reiter-leiste"><button style="width:64px;height:64px">Start</button></nav></body></html>`;
const ARTEN = ['klein', 'knopf', 'ueberlapp', 'abgeschnitten', 'rand', 'gekappt', 'unten'];

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  const k = await browser.newContext({ viewport: { width: 400, height: 600 }, deviceScaleFactor: 1 });
  const s = await k.newPage();
  for (const [name, huelle] of Object.entries(HUELLEN)) {
    await s.setContent(seite(huelle));
    const b = await s.evaluate(befundeDerSeite);
    b.unten = await s.evaluate(untenFrei);
    const zahl = Object.fromEntries(ARTEN.map((a) => [a, b[a].length]));
    if (name === 'offen') {
      for (const a of ARTEN) pruefe(`offen: Befund "${a}" wird gefunden`, zahl[a] > 0, b[a]);
    } else {
      for (const a of ARTEN) pruefe(`${name}: Befund "${a}" zaehlt nicht`, zahl[a] === 0, b[a]);
    }
  }
  await k.close();
} catch (e) { pruefe('Ablauf ohne Abbruch', false, e.stack); }
finally { await browser?.close(); }
console.log(`\n${ok}/${gesamt} bestanden`);
process.exitCode = ok === gesamt ? 0 : 1;
