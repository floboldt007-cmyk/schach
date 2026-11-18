// Ansichts-Befunde an festen Probe-Seiten (Feinschliff R8, Layout-Kritik): Was unter einem [inert]-Vorfahren liegt (der
// stillgelegte Hintergrund hinter einem offenen Blatt, js/ui/bauteile.js) oder unter einem unsichtbaren Vorfahren
// (opacity 0, visibility hidden, eine geschlossene Ansicht mit display none), sieht und erreicht niemand. Es darf in keiner
// Pruefung zaehlen; vorher zaehlte es ausser bei den Knopfgroessen ueberall mit (Fehlbefunde).
// Gegenprobe: derselbe Inhalt offen wird in jeder Pruefung gefunden, der Filter verschluckt also nichts Sichtbares.
// Kontrast (Feinschliff R9): wo der Hintergrund nicht aus den Vorfahren folgt (Geschwister-Ebene darunter, Verlauf oder
// Bild, teiltransparenter Grund), misst kontrastBefunde per Pixel; vorher meldete weisse Schrift auf einem dunklen Banner
// 1,0:1 (R8: 49 von 49 Kontrast-Befunden so).
//   node tests/ansicht-befunde.test.mjs
import { createRequire } from 'node:module';
import { browserTyp } from './browser.mjs';
import { befundeDerSeite, untenFrei, kontrastBefunde } from './ansicht-befunde.mjs';

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

  // Kontrast: je Fall ein eindeutiger Text; erwartet = Befund ja/nein
  const ebene = (farbe, grund, text, extra = '') => `<div style="position:relative;width:300px;height:44px;margin:6px 0${extra}">
    <div style="position:absolute;inset:0;background:${grund}"></div><p style="position:relative;margin:0;padding:10px;color:${farbe};font-size:15px">${text}</p></div>`;
  const KONTRAST = [
    ['weiss auf dunklem Geschwister-Banner', ebene('#fff', '#1c1b19', 'Banner Weiss'), 'Banner Weiss', false],
    ['grau auf grauem Geschwister-Banner (Positivkontrolle)', ebene('#888', '#777', 'Banner Grau'), 'Banner Grau', true],
    ['hellgrau auf weissem Vorfahren (eindeutig)', '<p style="color:#bbb;background:#fff;font-size:15px">Eindeutig Grau</p>', 'Eindeutig Grau', true],
    ['schwarz auf weissem Vorfahren (eindeutig)', '<p style="color:#222;background:#fff;font-size:15px">Eindeutig Schwarz</p>', 'Eindeutig Schwarz', false],
    ['weiss auf dunklem Verlauf', '<p style="color:#fff;background:linear-gradient(90deg,#111,#333);font-size:15px;padding:8px">Verlauf Weiss</p>', 'Verlauf Weiss', false],
    ['weiss auf teiltransparentem Grund ueber dunkler Ebene', ebene('#fff', '#101010', '<span style="background:rgba(255,255,255,.08)">Halb Weiss</span>'), 'Halb Weiss', false],
    // die App blendet Farben weich um (transition): das Ausblenden des Texts muss sofort wirken, sonst misst das Bild die
    // Schrift selbst als Hintergrund (R9: "Zum Konto" 1,08:1)
    ['weiss mit Farb-Uebergang auf dunklem Banner', ebene('#fff', '#1c1b19', '<span style="transition:color .6s">Weich Weiss</span>'), 'Weich Weiss', false],
    ['weiss auf dunklem ::before-Banner', '<style>.vb{position:relative}.vb::before{content:"";position:absolute;inset:0;background:#15151a}</style><p class="vb" style="color:#fff;font-size:15px;padding:8px"><span style="position:relative">Pseudo Weiss</span></p>', 'Pseudo Weiss', false],
  ];
  await s.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:8px;font:15px sans-serif;background:#fff}</style></head><body>
    ${KONTRAST.map((x) => x[1]).join('\n')}
    <div style="position:absolute;top:3000px">${ebene('#fff', '#1c1b19', 'Ausserhalb Weiss')}</div></body></html>`);
  const kb = await kontrastBefunde(s);
  for (const [name, , text, erwartet] of KONTRAST) {
    const da = kb.befunde.some((b) => b.text === text);
    pruefe(`Kontrast ${name}: ${erwartet ? 'Befund' : 'kein Befund'}`, da === erwartet, kb.befunde.filter((b) => b.text === text));
  }
  // von einer halb durchsichtigen Leiste VERDECKT (R9: "Zum Konto" unter der Reiter-Leiste, gemessen 1,08:1): das ist keine
  // Kontrastfrage (das prueft "unten frei"), sondern unklar
  await s.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#f4f1ec">
    <button style="margin:20px;width:200px;height:44px;border:0;background:#c8501e;color:#fff;font-size:16px">Verdeckt Weiss</button>
    <style>.vd{position:relative;margin:0 20px}.vd::before{content:"";position:absolute;inset:0;background:#15151a}</style>
    <p class="vd" style="color:#fff;font-size:16px;padding:8px"><span style="position:relative">Verdeckt Pseudo</span></p>
    <nav style="position:fixed;left:0;right:0;top:0;height:160px;background:rgba(250,248,244,.72)"></nav></body></html>`);
  const kv = await kontrastBefunde(s);
  pruefe('Kontrast verdeckt von einer Leiste: unklar, kein Befund', !kv.befunde.some((b) => b.text === 'Verdeckt Weiss')
    && kv.unklar.some((b) => b.text === 'Verdeckt Weiss' && b.grund === 'verdeckt'), kv);
  // verdeckt geht vor dem Vorfahren-Grund (R9: Arena-Zitat auf ::before unter dem weissen .cta-platz, gemessen 3,7:1)
  pruefe('Kontrast verdeckt trotz ::before-Grund: unklar, kein Befund', !kv.befunde.some((b) => b.text === 'Verdeckt Pseudo')
    && kv.unklar.some((b) => b.text === 'Verdeckt Pseudo' && b.grund === 'verdeckt'), kv);
  // ausserhalb des Bildes laesst sich nicht per Pixel messen: "unklar", kein Befund
  pruefe('Kontrast ausserhalb des Bildes: unklar, kein Befund', !kb.befunde.some((b) => b.text === 'Ausserhalb Weiss')
    && (kb.unklar || []).some((b) => b.text === 'Ausserhalb Weiss'), { befunde: kb.befunde, unklar: kb.unklar });
  pruefe('Kontrast: eindeutige Faelle bleiben beim Vorfahren-Weg', kb.befunde.find((b) => b.text === 'Eindeutig Grau')?.weg === 'vorfahren', kb.befunde);
  await k.close();
} catch (e) { pruefe('Ablauf ohne Abbruch', false, e.stack); }
finally { await browser?.close(); }
console.log(`\n${ok}/${gesamt} bestanden`);
process.exitCode = ok === gesamt ? 0 : 1;
