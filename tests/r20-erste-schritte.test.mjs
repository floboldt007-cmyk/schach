// Feinschliff R20, Erste Schritte Stufe A (Auftrag N-09:40, Vorlage im Vault R19-Auswahl/erste-schritte.md): ein Kurs fuer
// ganz frische Anfaenger vor der Meisterschule. Kapitel 1 (Art 'sammeln': Sterne mit einer Figur einsammeln, kein Gegner)
// und Kapitel 5 (Art 'folge': gut anfangen). Der Kurs ist ein eigener Bereich (KURS, Anzeige ANSICHT vorn); BEREICHE und
// ALLE bleiben die Meisterschule (65 Lektionen, je Bereich eine Probe, Sammlung zaehlt nur sie).
// Umwandlungs-Falle (in Node belegt, 19.11.2026): chess.js liefert ohne Koenige mit skipValidation die Zuege, und auch die
// Umwandlung e7-e8=D geht. moves({ verbose: true }) stuerzt aber ab ("Cannot mix BigInt"), wenn ein Bauer AUF Reihe 1 oder
// 8 steht. Im Spiel kommt das nicht vor, weil jeder Zug mit promotion 'q' laeuft. Die Vorlage hatte die Ursache zuerst
// falsch der Umwandlung zugeschrieben. Auftrag N-09:40: Sammel-Bauer nur bis Reihe 6, kein Stern auf Reihe 7/8 (die Umwandlung
// gehoert zu Kapitel 4), dazu kein Bauer auf Reihe 1/8.
//   node tests/r20-erste-schritte.test.mjs            Node- und Browser-Teil (BILDER=<ordner> legt Bilder ab)
//   node tests/r20-erste-schritte.test.mjs --nur-node nur der Node-Teil
import { Chess } from '../vendor/chess/chess.js';
import * as M from '../js/pakete/lernen/mattbilder.js';
import * as R from '../js/pakete/funken/rechnung.js';
import { DE, EN } from '../js/pakete/lernen/texte.js';

let ok = 0; let fehler = 0;
function pruefe(name, wert, info = '') {
  if (wert) { ok++; console.log('ok   ' + name); } else { fehler++; console.log('FEHLER ' + name + ' ' + (typeof info === 'string' ? info : JSON.stringify(info))); }
}
const versuche = (fn) => { try { return fn(); } catch (e) { return { fehler: e.message }; } };

// ---------- Aufbau ----------
const kurs = M.KURS;
pruefe('KURS: Bereich erste mit 9 Aufgaben, Ids mit es-, eindeutig, alle leicht',
  !!kurs && kurs.id === 'erste' && kurs.lektionen.length === 9 && kurs.lektionen.every((l) => /^es-[a-z-]+$/.test(l.id) && l.stufe === 'leicht')
  && new Set(kurs.lektionen.map((l) => l.id)).size === 9, kurs && kurs.lektionen && kurs.lektionen.map((l) => l.id));
pruefe('ANSICHT: Kurs vorn, dann die vier Meisterschul-Bereiche', Array.isArray(M.ANSICHT)
  && M.ANSICHT.map((b) => b.id).join() === 'erste,matt,taktik,end,eroeffnung');
pruefe('Meisterschule unberuehrt: BEREICHE 4, ALLE 65, keine Kurs-Id darin', M.BEREICHE.length === 4 && M.ALLE.length === 65
  && !M.ALLE.some((l) => /^es-/.test(l.id)));
pruefe('Kurs-Ids kollidieren nicht mit der Meisterschule', !!kurs && kurs.lektionen.every((l) => !M.ALLE.some((x) => x.id === l.id)));
const kap = (n) => (kurs ? kurs.lektionen.filter((l) => l.kapitel === n) : []);
pruefe('Kapitel 1 = 5 Sammel-Aufgaben (Turm, Laeufer, Springer, Dame, Koenig), Kapitel 5 = 4 Zugfolgen',
  kap(1).map((l) => l.id).join() === 'es-turm,es-laeufer,es-springer,es-dame,es-koenig' && kap(1).every((l) => l.art === 'sammeln')
  && kap(5).map((l) => l.id).join() === 'es-mitte,es-figuren,es-rochade,es-dame-frueh' && kap(5).every((l) => l.art === 'folge'));
pruefe('ARTEN kennt sammeln', M.ARTEN.includes('sammeln'));
pruefe('lektion() und bereichVon() finden Kurs-Aufgaben', !!M.lektion('es-turm') && M.bereichVon(M.lektion('es-turm')).id === 'erste'
  && M.bereichVon(M.lektion('grundreihe')).id === 'matt');

// ---------- Daten gueltig ----------
const pf = kurs ? kurs.lektionen.flatMap((l) => M.pruefeLektion(l, Chess)) : ['kein KURS'];
pruefe('jede Kurs-Aufgabe besteht pruefeLektion', pf.length === 0, pf.join(' | '));

// kleinste Zugzahl ueber alle Reihenfolgen (Breitensuche je Strecke) muss ziel sein
function zuegeVon(fen) { return new Chess(fen, { skipValidation: true }).moves({ verbose: true }).map((m) => m.to); }
function fenMit(typ, feld) {
  const b = Array.from({ length: 8 }, () => Array(8).fill(''));
  b[8 - Number(feld[1])][feld.charCodeAt(0) - 97] = typ;
  return b.map((z) => { let s = ''; let n = 0; for (const x of z) { if (!x) n++; else { if (n) s += n; n = 0; s += x; } } return s + (n ? n : ''); }).join('/') + ' w - - 0 1';
}
function abstand(typ, a, b) {
  const q = [[a, 0]]; const ges = new Set([a]);
  while (q.length) { const [f, d] = q.shift(); if (f === b) return d; for (const t of zuegeVon(fenMit(typ, f))) if (!ges.has(t)) { ges.add(t); q.push([t, d + 1]); } }
  return Infinity;
}
const perm = (a) => (a.length < 2 ? [a] : a.flatMap((x, i) => perm([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
function kleinste(l) {
  const brett = new Chess(l.fen, { skipValidation: true }).board().flat().filter(Boolean);
  const fig = brett[0];
  const typ = fig.type.toUpperCase();
  return Math.min(...perm([...l.sterne]).map((p) => { let f = fig.square; let s = 0; for (const z of p) { s += abstand(typ, f, z); f = z; } return s; }));
}
for (const l of kap(1)) pruefe(`${l.id}: ziel ${l.ziel} ist die kleinste Zugzahl (gerechnet)`, kleinste(l) === l.ziel, { gerechnet: kleinste(l) });

// ---------- Umwandlungs-Falle ----------
const falle = versuche(() => new Chess('4P3/8/8/8/8/8/8/8 w - - 0 1', { skipValidation: true }).moves({ verbose: true }).length);
const umw = versuche(() => { const c = new Chess('8/4P3/8/8/8/8/8/8 w - - 0 1', { skipValidation: true }); c.move({ from: 'e7', to: 'e8', promotion: 'q' }); return c.fen(); });
pruefe('Falle belegt: ohne Koenige stuerzt moves({ verbose: true }) mit einem Bauern AUF Reihe 8 ab; die Umwandlung e7-e8=D selbst geht (aendert sich chess.js, faellt das hier auf)',
  !!falle && typeof falle === 'object' && /BigInt/.test(falle.fehler || '') && umw === '4Q3/8/8/8/8/8/8/8 b - - 0 1', { falle, umw });
const probe = (fen, sterne) => ({ id: 'probe', stufe: 'leicht', art: 'sammeln', kapitel: 1, fen, sterne, ziel: 1 });
const bauer6 = M.pruefeLektion(probe('8/8/4P3/8/8/8/8/8 w - - 0 1', ['e7']), Chess);
const stern7 = M.pruefeLektion(probe('8/8/8/8/8/8/4P3/8 w - - 0 1', ['e7']), Chess);
const turm8 = M.pruefeLektion(probe('8/8/8/8/8/8/8/R7 w - - 0 1', ['a8']), Chess);
const bauerGut = M.pruefeLektion(probe('8/8/8/8/8/8/4P3/8 w - - 0 1', ['e4', 'e6']), Chess);
const bauer8 = M.pruefeLektion(probe('4P3/8/8/8/8/8/8/8 w - - 0 1', ['e4']), Chess);
const bauer1 = M.pruefeLektion(probe('8/8/8/8/8/8/8/4P3 w - - 0 1', ['e4']), Chess);
pruefe('pruefeLektion weist Bauer ab Reihe 6, auf Reihe 1 oder 8 und Bauer mit Stern auf Reihe 7 ab, laesst Bauer bis Reihe 6 und Turm auf Reihe 8 zu',
  bauer6.length > 0 && stern7.length > 0 && bauer8.length > 0 && bauer1.length > 0 && turm8.length === 0 && bauerGut.length === 0,
  { bauer6, stern7, bauer8, bauer1, turm8, bauerGut });
const zwei = M.pruefeLektion(probe('8/8/8/8/8/8/8/R6R w - - 0 1', ['a8']), Chess);
const schwarz = M.pruefeLektion(probe('8/8/8/8/8/8/8/r7 w - - 0 1', ['a8']), Chess);
const besetzt = M.pruefeLektion(probe('8/8/8/8/8/8/8/R7 w - - 0 1', ['a1']), Chess);
const keine = M.pruefeLektion(probe('8/8/8/8/8/8/8/R7 w - - 0 1', []), Chess);
pruefe('pruefeLektion sammeln: genau eine weisse Figur, Sterne auf freien Feldern, mindestens einer',
  zwei.length > 0 && schwarz.length > 0 && besetzt.length > 0 && keine.length > 0, { zwei, schwarz, besetzt, keine });

// ---------- Ablauf sammeln (rein) ----------
const turm = M.lektion('es-turm');
const ablauf = versuche(() => {
  const c = M.ladeSammeln(turm.fen);
  let rest = [...turm.sterne];
  const schritte = [];
  for (const [von, nach] of [['a1', 'a8'], ['a8', 'h8'], ['h8', 'h1']]) {
    c.move({ from: von, to: nach });
    M.weissWieder(c);
    rest = M.sternGeschafft(rest, nach);
    schritte.push({ dran: c.turn(), rest: rest.length, ziel: M.pruefeZiel(turm, null, c, { wann: 'flo', zuege: schritte.length + 1, rest }) });
  }
  return schritte;
});
pruefe('sammeln: nach jedem Zug wieder Weiss am Zug, Stern weg, geschafft erst ohne Sterne', Array.isArray(ablauf)
  && ablauf.every((s) => s.dran === 'w') && ablauf.map((s) => s.rest).join() === '2,1,0' && ablauf.map((s) => String(s.ziel)).join() === 'null,null,geschafft', ablauf);
const zuViel = versuche(() => M.pruefeZiel(turm, null, M.ladeSammeln(turm.fen), { wann: 'flo', zuege: M.grenze(turm.ziel), rest: ['h1'] }));
pruefe('sammeln: ab der Grenze zuViele', zuViel === 'zuViele', zuViel);
pruefe('sammeln: ladeSammeln laedt ohne Koenig, Turm hat 14 Zuege', versuche(() => M.ladeSammeln(turm.fen).moves().length) === 14);
pruefe('Sterne sammeln (sterneSammeln, eigene Regel; sterne() der Mattbilder bleibt): 3 bei kleinster Zahl, 2 bei bis zu 2 mehr, sonst 1',
  typeof M.sterneSammeln === 'function' && M.sterneSammeln({ ziel: 3, zuege: 3 }) === 3 && M.sterneSammeln({ ziel: 3, zuege: 5 }) === 2
  && M.sterneSammeln({ ziel: 3, zuege: 6 }) === 1 && M.sterneSammeln({ ziel: 4, zuege: 6 }) === 2 && M.sterneSammeln({ ziel: 4, zuege: 7 }) === 1
  && M.sterne({ ziel: 3, zuege: 5 }) === 2 && M.sterne({ ziel: 3, zuege: 6 }) === 2);

// ---------- Speicher und Summen ----------
let st = M.merke({}, 'es-turm', { sterne: 3, zuege: 3 });
st = M.merke(st, 'grundreihe', { sterne: 2, zuege: 1 });
pruefe('Kurs-Sterne werden gespeichert, zaehlen in summe(st, "erste"), aber nicht in der Meisterschul-Summe',
  M.stand(st).lek['es-turm'] && M.summe(st, 'erste').sterne === 3 && M.summe(st, 'erste').max === 27 && M.summe(st).sterne === 2
  && M.summe(st).max === 65 * 3, { erste: M.summe(st, 'erste'), schule: M.summe(st) });

// ---------- Funken ----------
const kursF = [R.lektionFunken({ id: 'erste-es-turm', alt: '', ringe: { gelernt: true, sicher: true, gemeistert: true } })];
kursF.push(R.lektionFunken({ id: 'erste-es-turm', alt: kursF[0].neu, ringe: { gelernt: true, sicher: true, gemeistert: true } }));
const schulF = R.lektionFunken({ id: 'matt-grundreihe', alt: '', ringe: { gelernt: true, sicher: true, gemeistert: true } });
pruefe('Funken: Kurs-Aufgabe 10 einmal (keine Ring-Boni), Meisterschule weiter 40+20+40', kursF[0].funken === 10 && kursF[1].funken === 0
  && schulF.funken === 100 && R.LERN.kurs === 10, { kursF, schulF });

// ---------- Texte ----------
const schluessel = ['bereich.erste', 'text.erste', 'kurz.erste', 'art.sammeln', 'kapitel.1', 'kapitel.5', 'zielSammeln', 'geschafft.sammeln',
  'geschafftText.sammeln', ...(kurs ? kurs.lektionen.flatMap((l) => ['titel.' + l.id, 'idee.' + l.id,
    ...(l.art === 'folge' ? Array.from({ length: l.ziel }, (_, k) => `zug.${l.id}.${k}`) : [])]) : [])];
const fehltDE = schluessel.filter((k) => typeof DE[k] !== 'string' || !DE[k]);
const fehltEN = schluessel.filter((k) => typeof EN[k] !== 'string' || !EN[k]);
pruefe('Texte DE und EN fuer Kurs, Kapitel, Art sammeln und jede Aufgabe (je Folgezug ein Satz)', fehltDE.length === 0 && fehltEN.length === 0,
  { fehltDE, fehltEN });
const verboten = /Season|Saison|Weltrangliste|Crownmaster/i;
pruefe('keine Texte mit Season/Saison/Weltrangliste/Crownmaster', schluessel.every((k) => !verboten.test(DE[k] || '') && !verboten.test(EN[k] || '')));

// ---------- N-13:10: Kopf im Kurs, Vorschaubild der Sammel-Aufgaben ----------
pruefe('Text "kursUeber" (Zeile ueber dem Kurs-Titel statt "Meisterschule") in DE und EN',
  typeof DE.kursUeber === 'string' && !!DE.kursUeber && typeof EN.kursUeber === 'string' && !!EN.kursUeber && !/Meisterschule|Master/i.test(DE.kursUeber + EN.kursUeber),
  { de: DE.kursUeber, en: EN.kursUeber });
const B = await import('../js/ui/bauteile.js').catch((e) => ({ fehler: e.message }));
const vorschau = B.miniBrett ? B.miniBrett('8/8/8/8/8/8/8/R7 w - - 0 1', { sterne: ['a8', 'h8', 'h1'], gross: true }) : '';
const zellen = vorschau.match(/<i class="[^"]*"/g) || [];
const zelle = (feld) => zellen['abcdefgh'.indexOf(feld[0]) + (8 - Number(feld[1])) * 8] || '';
pruefe('miniBrett mit Sternen: die drei Sternfelder tragen die Klasse s, sonst keines', ['a8', 'h8', 'h1'].every((f) => / s[ "]/.test(zelle(f)))
  && zellen.filter((z) => / s[ "]/.test(z)).length === 3, { fehler: B.fehler, a8: zelle('a8') });
pruefe('miniBrett gross: Wurzel mit Klasse mini-gross, die Figur als grosses Bild am Rand verankert (nicht abgeschnitten)',
  /class="mini mini-gross/.test(vorschau) && /<img class="g"[^>]*transform-origin:\s*left bottom/.test(vorschau), vorschau.slice(0, 200));
const ohne = B.miniBrett ? B.miniBrett('8/8/8/8/8/8/8/R7 w - - 0 1') : '';
pruefe('miniBrett ohne Optionen bleibt wie bisher (kein s, kein mini-gross, kein g)', !!ohne && !/ s[ "]|mini-gross|class="g"/.test(ohne));

// ---------------------------------------------------------------------------
// Browser-Teil: Uebersicht mit Kurs-Karte vorn, es-turm ganz gespielt (Sterne verschwinden einzeln), Folge es-mitte;
// iPhone 390 und PC 1440, hell und dunkel. BILDER=<ordner> legt je Lage vier Bilder ab.
// ---------------------------------------------------------------------------
async function browserTeil() {
  const { createRequire } = await import('node:module');
  const http = await import('node:http');
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const path = (await import('node:path')).default;
  const { browserTyp } = await import('./browser.mjs');
  const require = createRequire(import.meta.url);
  let pw = null;
  for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { pw = require(p); break; } catch (e) { /* naechster */ }
  }
  if (!pw) { pruefe('Playwright gefunden', false); return; }
  const root = fileURLToPath(new URL('../', import.meta.url));
  const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
    '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
  const server = http.createServer((req, res) => {
    const p = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
    if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
    try { const d = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(d); }
    catch (e) { res.writeHead(404); res.end(); }
  });
  const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  const warte = (ms) => new Promise((r) => setTimeout(r, ms));
  const browser = await browserTyp(pw).launch();
  const lz = (s) => s.evaluate(() => (window.__lektion ? window.__lektion.zustand() : { offen: false }));
  const warteLz = (s, b, ms = 10000) => s.waitForFunction((x) => { const z = window.__lektion ? window.__lektion.zustand() : { offen: false };
    return new Function('z', 'return ' + x)(z); }, b, { timeout: ms }).catch(() => {});
  async function ziehe(s, uci) {
    for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) {
      const b = await s.locator(`.ls-screen .brett-felder .feld[data-feld="${f}"]`).boundingBox();
      await s.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await warte(90);
    }
  }
  // geschafft heisst phase 'ende' ohne grund (grund traegt nur das Scheitern, js/ui/lektion.js gescheitert)
  const bild = async (s, name) => { if (process.env.BILDER) await s.screenshot({ path: path.join(process.env.BILDER, name + '.png') }); };
  try {
    for (const [w, h, geraet] of [[390, 844, 'iphone'], [1440, 900, 'pc']]) {
      for (const farbe of ['hell', 'dunkel']) {
        const lage = `${geraet} ${farbe}`;
        const k = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 700, serviceWorkers: 'block',
          colorScheme: farbe === 'dunkel' ? 'dark' : 'light', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
        await k.route('**/*.supabase.co/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
        await k.addInitScript(() => { try { if (sessionStorage.getItem('es-start')) return; sessionStorage.setItem('es-start', '1'); localStorage.clear();
          localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'normal', figuren: 'cburnett' })); } catch (e) { /* egal */ } });
        const s = await k.newPage();
        const fehlerListe = [];
        s.on('pageerror', (e) => fehlerListe.push(e.message));
        await s.goto(`http://127.0.0.1:${PORT}/index.html?test#training`);
        await s.waitForFunction(() => !!window.__app && !!document.documentElement.dataset.screen, null, { timeout: 45000 });
        await s.evaluate(() => window.__app.gehe('lernen', { bereich: 'erste' }));
        await s.waitForSelector('.ms-screen .ms-lektion[data-id="es-turm"]', { timeout: 20000 }).catch(() => {});
        await warte(400);
        const ue = await s.evaluate(() => ({ karte1: document.querySelector('.ms-bkarte')?.dataset.bereich,
          gewaehlt: document.querySelector('.ms-bkarte[aria-pressed="true"]')?.dataset.bereich, karten: document.querySelectorAll('.ms-bkarte').length,
          gratis: document.querySelectorAll('.ms-bkarte[data-bereich="erste"] .ms-bk-gratis').length,
          kapitel: [...document.querySelectorAll('.ms-gruppe > h2')].map((x) => x.textContent).join('|'),
          ids: [...document.querySelectorAll('.ms-lektion')].map((x) => x.dataset.id).join(),
          schloss: document.querySelectorAll('.ms-lektion[data-gesperrt]').length,
          quer: document.documentElement.scrollWidth > window.innerWidth + 1, bald: !!document.querySelector('.ms-bald')?.offsetParent,
          kopf: document.querySelector('.ms-screen .kopf-seite')?.textContent || '', ueber: document.querySelector('.ms-screen .ms-bereich .ueber, .ms-screen .ms-bereich [class*="ueber"]')?.textContent || '',
          sterneMini: document.querySelectorAll('.ms-lektion[data-id="es-turm"] .mini.mini-gross i.s').length }));
        pruefe(`${lage}: N-13:10 Kopf "Erste Schritte" statt "Meisterschule", Vorschaubild es-turm gross mit 3 Sternen`,
          ue.kopf === 'Erste Schritte' && !/Meisterschule/.test(ue.ueber) && ue.sterneMini === 3, ue);
        pruefe(`${lage}: Uebersicht Kurs-Karte vorn und gewaehlt, fuenf Karten, ohne "gratis", Kapitel 1 und 5, 9 Aufgaben offen, kein Querscrollen`,
          ue.karte1 === 'erste' && ue.gewaehlt === 'erste' && ue.karten === 5 && ue.gratis === 0 && ue.kapitel === 'Kapitel 1: Brett und Figuren|Kapitel 5: Gut anfangen'
          && ue.ids === kurs.lektionen.map((l) => l.id).join() && ue.schloss === 0 && !ue.quer && !ue.bald, ue);
        await bild(s, `uebersicht-${geraet}-${farbe}`);

        // es-turm: a1 -> a8 -> h8 -> h1, jeder Stern verschwindet einzeln, 3 Zuege = 3 Sterne
        await s.locator('.ms-lektion[data-id="es-turm"]').click();
        await s.waitForSelector('.ls-aktionen [data-a="los"]', { timeout: 15000 }).catch(() => {});
        await s.locator('.ls-aktionen [data-a="los"]').click();
        await warteLz(s, 'z.phase === "flo"');
        const vorher = await s.evaluate(() => ({ marken: document.querySelectorAll('.ls-screen .lage.mark-stern').length,
          oben: getComputedStyle(document.querySelector('.ls-screen .ls-oben')).visibility, hinweis: document.querySelectorAll('.ls-aktionen [data-a="hinweis"]').length,
          titel: document.querySelector('.ls-screen .marke-titel')?.textContent || '', unter: document.querySelector('.ls-screen .logo-unter')?.textContent || '' }));
        pruefe(`${lage}: N-13:10 Aufgabe zeigt oben "Erste Schritte", darunter das Kapitel`,
          vorher.titel === 'Erste Schritte' && vorher.unter === 'Kapitel 1: Brett und Figuren', vorher);
        pruefe(`${lage}: es-turm startet mit 3 Stern-Marken, ohne Gegner-Leiste und ohne Hinweis-Knopf`, vorher.marken === 3 && vorher.oben === 'hidden' && vorher.hinweis === 0, vorher);
        const reste = [];
        for (const zug of ['a1a8', 'a8h8', 'h8h1']) {
          await ziehe(s, zug);
          await warteLz(s, `z.zuege === ${reste.length + 1} && z.phase !== "gezogen"`);
          const z = await lz(s);
          reste.push({ rest: (z.rest || []).join(), marken: await s.locator('.ls-screen .lage.mark-stern').count(), phase: z.phase });
          if (reste.length === 1) await bild(s, `turm-mitte-${geraet}-${farbe}`);
        }
        await s.waitForSelector('.ls-screen > .ergebnis-overlay:not([hidden]) .ergebnis-karte', { timeout: 8000 }).catch(() => {});
        const ende = await lz(s);
        pruefe(`${lage}: Sterne verschwinden einzeln (h8,h1 / h1 / leer), am Ende geschafft mit 3 Sternen`,
          reste[0].rest === 'h8,h1' && reste[0].marken === 2 && reste[1].rest === 'h1' && reste[1].marken === 1 && reste[2].marken === 0
          && ende.phase === 'ende' && ende.grund === null && ende.sterne === 3, { reste, ende });
        await bild(s, `turm-geschafft-${geraet}-${farbe}`);

        // Folge es-mitte: e4 (Antwort e5) d4
        await s.evaluate(() => window.__app.gehe('lektion', { id: 'es-mitte' }));
        await s.waitForSelector('.ls-aktionen [data-a="los"]', { timeout: 15000 }).catch(() => {});
        await s.locator('.ls-aktionen [data-a="los"]').click();
        await warteLz(s, 'z.id === "es-mitte" && z.phase === "flo"');
        await ziehe(s, 'e2e4');
        await warteLz(s, 'z.schritt >= 2 && z.phase === "flo"', 15000);
        await bild(s, `folge-${geraet}-${farbe}`);
        await ziehe(s, 'd2d4');
        await warteLz(s, 'z.phase === "ende"', 15000);
        const f = await lz(s);
        pruefe(`${lage}: Folge es-mitte (e4 e5 d4) geschafft, 3 Sterne`, f.id === 'es-mitte' && f.phase === 'ende' && f.grund === null && f.sterne === 3, f);
        pruefe(`${lage}: keine Seitenfehler`, fehlerListe.length === 0, fehlerListe);
        await k.close();
      }
    }
  } catch (e) {
    pruefe('Browser-Teil laeuft durch', false, e.message);
  } finally {
    await browser.close();
    server.close();
  }
}
if (!process.argv.includes('--nur-node')) await browserTeil();

console.log(`${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
