// Vorzug-Kette und Pfeil-Tipp (Flo, 23.10.: "Pre-Move, noch ein Pre-Move" und "Pfeile zeichnen"): echte Bedienung in der
// Partie gegen einen Bot, dessen Zuege der Test vorgibt (window.__test.botZug). Keine Engine, kein Netz.
//
//   node tests/vorzuege.test.mjs
//   BILDER=/pfad node tests/vorzuege.test.mjs     Bildschirmfotos (hell und dunkel, iPad quer und Handy hoch)
//
// Geprueft: Kette e2-e4, e4-e5 mit derselben Figur (Nummern 1 und 2, Figur steht auf e5, echte Stellung unveraendert),
// Ausfuehrung ueber zwei Bot-Zuege, ungueltig gewordener Vorzug (er und der Rest fallen leise weg), Tipp ins leere Brett
// und auf eine gegnerische Figur, Grenze 5, Pfeil-Tipp einmal je Geraet (weg nach dem ersten Pfeil, mit "Verstanden").
import http from 'node:http';
import { begrenzt } from './zeitwaechter.mjs';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
const PORT = Number(process.env.PORT || 8891);
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.json': 'application/json', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + new URL(req.url, 'http://test').pathname.replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const inhalt = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(inhalt); }
  catch (e) { res.writeHead(404); res.end(); }
});
await begrenzt('Vorzug-Serverstart', () => new Promise((resolve, reject) => { server.once('error', reject); server.listen(PORT, '127.0.0.1', resolve); }), 10000);
const START = `http://127.0.0.1:${PORT}/index.html?test&kern`;
const MERKER = 'schach-arena:v1:hinweis-pfeile';
let browser, kontext, seite, ok = 0, gesamt = 0;
const fehler = [];
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

try {
  browser = await browserTyp(pw).launch({ headless: true });
  kontext = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  const vorbereite = async (k) => {
  await k.route('**/*.supabase.co/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await k.addInitScript(() => {
    if (!localStorage.getItem('schach-arena:v1:einstellungen')) {
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'aus', liveBewertung: false, tiefe: 8, vorzuege: true }));
    }
    // Der Bot zieht nach Plan; ist der Plan leer, haelt er an (botAnhalten) und spielt danach den ersten Zug (sortiert)
    window.__neuerBotPlan = (plan) => {
      const zuege = plan.slice();
      const test = { ...window.__test, botAnhalten: true, maxWarten: 0, botPause: 30 };
      test.botZug = (fen) => {
        // Ein abgebrochener alter Aufruf darf weder den neuen Plan noch dessen Halteschalter aendern.
        if (window.__partie.chess().fen() !== fen) return null;
        const u = zuege.shift();
        if (u) return u;
        test.botAnhalten = true;
        return window.__partie.chess().moves({ verbose: true }).map((m) => m.lan).sort()[0];
      };
      window.__plan = zuege;
      window.__test = test;
    };
    window.__neuerBotPlan([]);
  });
  };
  await vorbereite(kontext);
  seite = await kontext.newPage();
  seite.setDefaultTimeout(45000);   // unter Last (CI, volle Suite) braucht der Partie-Start mit Engine laenger
  seite.on('pageerror', (e) => fehler.push(e.message));
  seite.on('console', (m) => { if (m.type() === 'error') fehler.push(m.text()); });
  await seite.goto(START);
  await seite.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function' && document.querySelector('.screen.arena'));

  const feld = async (f) => {
    const b = await seite.locator(`.screen.partie .brett-felder .feld[data-feld="${f}"]`).boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const bildFertig = () => begrenzt('Vorzug: Render-Schritt', () => seite.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
  const tippe = async (f) => { const p = await feld(f); await seite.touchscreen.tap(p.x, p.y); await bildFertig(); };
  // Unter Last (volle Suite) ging der erste Tipp einer frischen Partie manchmal ins Leere (das Brett lief noch in seine
  // Eintritts-Animation): bis zu dreimal nachtippen, solange nichts ausgewaehlt ist; sonst sagen, was unter dem Finger lag
  const zug = async (uci) => {
    const von = uci.slice(0, 2);
    const gewaehlt = (f) => seite.waitForFunction((x) => !!document.querySelector(`.screen.partie .lage.auswahl[data-feld="${x}"]`), f, { timeout: 6000 })
      .then(() => true, () => false);
    let ok = false;
    for (let i = 0; i < 4 && !ok; i++) {
      if (i) await warte(400);
      await tippe(von);
      ok = await gewaehlt(von);
    }
    if (!ok) {
      const p = await feld(von);
      const unter = await seite.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return e ? e.tagName + '.' + [...e.classList].join('.') : null; }, p);
      throw new Error(`Zug ${uci}: ${von} nicht ausgewaehlt (Phase ${await seite.evaluate(() => window.__partie?.phase())}, unter dem Finger ${unter})`);
    }
    await tippe(uci.slice(2, 4));
    await seite.waitForFunction(() => !document.querySelector('.screen.partie .lage.auswahl'));
  };
  const stand = () => seite.evaluate(() => {
    const p = window.__partie;
    const nummern = {};
    for (const n of document.querySelectorAll('.screen.partie .brett-nummern .nummer')) nummern[n.dataset.feld] = n.textContent;
    return { phase: p.phase(), zuege: p.z.zuege.join(','), vorzuege: p.z.vorzuege.map((v) => v.von + v.nach).join(','), nummern,
      echt: p.chess().fen().split(' ')[0], brett: (f) => null };
  });
  const figur = (f) => seite.evaluate((x) => window.__partie.brett.figurAuf(x), f);
  // Neue Partie mit dem Plan des Bots: er waehlt seinen Zug sofort, haelt aber an, bis der Test ihn loslaesst
  async function neuePartie(plan = []) {
    await seite.evaluate((p) => {
      localStorage.removeItem('schach-arena:v1:laufend');
      window.__neuerBotPlan(p); window.__altesZ = window.__partie ? window.__partie.z : null;
    }, plan);
    await seite.evaluate(() => window.__app.gehe('partie', { botId: 'benno', farbe: 'w' }));
    await seite.waitForFunction(() => window.__partie && window.__partie.z !== window.__altesZ && window.__partie.bereit === true);
    await seite.waitForFunction(() => window.__partie.phase() === 'flo');
  }
  // Flo spielt Sg1-f3, der Bot denkt (haelt an): jetzt sind Vorzuege moeglich
  async function bisBotDenkt() {
    await zug('g1f3');
    await seite.waitForFunction(() => window.__partie.phase() === 'bot');
  }
  const lasBotLos = () => seite.evaluate(() => { window.__test.botAnhalten = false; });

  // ---------- 1. Kette mit derselben Figur ----------
  await neuePartie(['a7a6', 'h7h6']);
  await bisBotDenkt();
  const echtVorher = (await stand()).echt;
  await zug('e2e4');
  await zug('e4e5');
  const k1 = await stand();
  pruefe('Kette e2-e4, e4-e5: zwei Vorzuege vorgemerkt', k1.vorzuege === 'e2e4,e4e5', k1);
  pruefe('Kette: Nummer 1 auf e4, Nummer 2 auf e5', k1.nummern.e4 === '1' && k1.nummern.e5 === '2' && Object.keys(k1.nummern).length === 2, k1.nummern);
  pruefe('Kette: das Brett zeigt den Bauern auf e5 (gedachte Stellung), e2 und e4 sind leer',
    (await figur('e5')) === 'wP' && !(await figur('e2')) && !(await figur('e4')));
  pruefe('Kette: die echte Stellung bleibt unveraendert', k1.echt === echtVorher, [k1.echt, echtVorher]);
  pruefe('Kette: Nummern liegen ueber den Figuren und haben eigene Farben', await seite.evaluate(() => {
    const s = document.querySelector('.screen.partie .brett-nummern .nummer span');
    const c = getComputedStyle(s);
    const lage = getComputedStyle(document.querySelector('.screen.partie .brett-nummern'));
    return Number(lage.zIndex) > 2 && c.backgroundColor !== c.color && c.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.getBoundingClientRect().width > 8;
  }));

  // ---------- 2. Ausfuehrung ueber zwei Bot-Zuege ----------
  // Der dritte Bot-Aufruf wartet sicher noch, wenn gleich danach die naechste Partie beginnt.
  await seite.evaluate(() => { window.__test.botPause = 1000; });
  await lasBotLos();
  await seite.waitForFunction(() => window.__partie.z.zuege.length >= 5);
  await seite.waitForFunction(() => window.__partie.phase() === 'bot' && window.__partie.z.vorzuege.length === 0 && !document.querySelector('.brett-nummern .nummer'));
  const k2 = await stand();
  pruefe('Ausfuehrung: je Bot-Zug der vorderste Vorzug (e2-e4, dann e4-e5)', k2.zuege.startsWith('g1f3,a7a6,e2e4,h7h6,e4e5'), k2.zuege);
  pruefe('Ausfuehrung: danach keine Vorzuege und keine Nummern mehr', k2.vorzuege === '' && !Object.keys(k2.nummern).length, k2);

  // ---------- 3. Ungueltig gewordener Vorzug faellt mit dem Rest weg ----------
  await neuePartie(['e7e5', 'a7a6']);
  await bildFertig();
  pruefe('Partiewechsel: ein abgebrochener alter Bot-Aufruf verbraucht keinen Zug des neuen Plans',
    await seite.evaluate(() => window.__plan.join(',') === 'e7e5,a7a6'));
  await bisBotDenkt();
  await zug('e2e4');
  await zug('e4e5');
  await zug('d2d4');
  await lasBotLos();
  await seite.waitForFunction(() => window.__partie.protokoll.some((e) => e.typ === 'vorzug:verworfen'));
  await seite.waitForFunction(() => window.__partie.phase() === 'flo');
  const k3 = await stand();
  const verworfen = await seite.evaluate(() => window.__partie.protokoll.filter((e) => e.typ === 'vorzug:verworfen').map((e) => e.uci));
  pruefe('Ungueltig: e2-e4 wird gespielt, e4-e5 ist nach ...e5 blockiert', k3.zuege === 'g1f3,e7e5,e2e4,a7a6', k3.zuege);
  pruefe('Ungueltig: er und alle danach (d2-d4) fallen weg, leise (Protokoll, kein Fehlertext)', k3.vorzuege === '' && JSON.stringify(verworfen) === '["e4e5"]'
    && !(await seite.locator('.toast-ort .toast.fehler').count()), { k3, verworfen });
  pruefe('Ungueltig: Flo ist wieder dran, das Brett zeigt die echte Stellung ohne Nummern',
    k3.phase === 'flo' && !Object.keys(k3.nummern).length && (await figur('d2')) === 'wP' && (await figur('e4')) === 'wP');

  // ---------- 4. Abbrechen: Tipp ins leere Brett, Tipp auf eine gegnerische Figur ----------
  await neuePartie();
  await bisBotDenkt();
  await zug('e2e4');
  await zug('d2d4');
  await tippe('a5');
  await seite.waitForFunction(() => window.__partie.z.vorzuege.length === 0);
  const k4 = await stand();
  pruefe('Tipp ins leere Brett loescht die ganze Kette und die Nummern', k4.vorzuege === '' && !Object.keys(k4.nummern).length, k4);
  pruefe('Tipp ins leere Brett: das Brett zeigt wieder die echte Stellung', (await figur('e2')) === 'wP' && (await figur('d2')) === 'wP' && !(await figur('e4')));
  await zug('e2e4');
  await tippe('a7');
  await seite.waitForFunction(() => window.__partie.z.vorzuege.length === 0);
  const k4b = await stand();
  pruefe('Tipp auf eine gegnerische Figur ohne Auswahl loescht die Kette', k4b.vorzuege === '' && (await figur('e2')) === 'wP', k4b);

  // ---------- 5. Grenze 5 ----------
  for (const u of ['a2a3', 'b2b3', 'c2c3', 'd2d3', 'h2h3', 'g2g3']) await zug(u);
  const k5 = await stand();
  pruefe('Grenze: hoechstens 5 Vorzuege, der sechste springt zurueck und die Kette bleibt', k5.vorzuege === 'a2a3,b2b3,c2c3,d2d3,h2h3' && (await figur('g2')) === 'wP', k5.vorzuege);
  pruefe('Grenze: Nummern 1 bis 5', ['a3', 'b3', 'c3', 'd3', 'h3'].map((f) => k5.nummern[f]).join('') === '12345', k5.nummern);
  await tippe('a5');
  await seite.waitForFunction(() => window.__partie.z.vorzuege.length === 0);

  // ---------- 6. Aufgeben loescht die Kette ----------
  await zug('e2e4');
  await seite.evaluate(() => { document.querySelector('.screen.partie .spielknoepfe > [data-aktion="aufgeben"]').focus(); });
  await seite.keyboard.press('Enter');
  const ja = seite.getByRole('alertdialog').getByRole('button', { name: 'Aufgeben', exact: true });
  await ja.click();
  await seite.waitForFunction(() => window.__partie.phase() === 'ende');
  const k6 = await stand();
  pruefe('Aufgeben loescht Vorzuege und Nummern', k6.vorzuege === '' && !Object.keys(k6.nummern).length, k6);

  // ---------- 6b. Zuege ansehen (Flo 31.10.2026: "den letzten Move sehen ... wie bei Chess.com") ----------
  await neuePartie(['e7e5', 'b8c6']);
  await lasBotLos();
  await zug('e2e4');
  await seite.waitForFunction(() => window.__partie.z.zuege.length >= 2 && window.__partie.phase() === 'flo');
  await zug('g1f3');
  await seite.waitForFunction(() => window.__partie.z.zuege.length >= 4 && window.__partie.phase() === 'flo');
  const ansicht = () => seite.evaluate(() => {
    const a = document.querySelector('.screen.partie .zug-ansicht');
    const fig = (f) => a?.querySelector(`img.figur[data-feld="${f}"]`)?.dataset.figur || null;
    return a ? { offen: true, schild: a.querySelector('.za-schild').textContent, e5: fig('e5'), e4: fig('e4'), g1: fig('g1'), f3: fig('f3'),
      zuletzt: [...a.querySelectorAll('.lage.zuletzt')].map((l) => l.dataset.feld).sort().join(),
      zurueckAus: a.querySelector('[data-aktion="zug-zurueck"]').disabled,
      knoepfe: [...a.querySelectorAll('button')].every((b) => b.getBoundingClientRect().height >= 44),
      angesehen: [...document.querySelectorAll('.screen.partie .z.angesehen')].map((z) => z.dataset.ply).join() } : { offen: false };
  });
  await seite.locator('.screen.partie .z[data-ply="1"]').filter({ visible: true }).first().click();
  await seite.waitForSelector('.screen.partie .zug-ansicht');
  const a1 = await ansicht();
  pruefe('Ansehen: Tipp auf 1… e5 zeigt die Stellung danach (Bauer e5, Springer noch g1), Zug markiert, Knoepfe ab 44 px',
    a1.schild === '1… e5' && a1.e5 === 'bP' && a1.g1 === 'wN' && !a1.f3 && a1.zuletzt === 'e5,e7' && /^1(,1)*$/.test(a1.angesehen) && a1.knoepfe, a1);   // Liste und Band (eins davon verborgen)
  pruefe('Ansehen: das Spielbrett bleibt unberuehrt (Springer f3, Laeufer f8 noch zu Hause, Bot-Springer c6)', await seite.evaluate(() =>
    window.__partie.brett.figurAuf('f3') === 'wN' && window.__partie.brett.figurAuf('c6') === 'bN'));
  await seite.locator('.za-steuer [data-aktion="zug-zurueck"]').click();
  await seite.locator('.za-steuer [data-aktion="zug-zurueck"]').click();
  const a2 = await ansicht();
  pruefe('Ansehen: zweimal zurueck bis zur Ausgangsstellung, weiter zurueck geht nicht', a2.schild === 'Start' && !a2.e4 && a2.zurueckAus && a2.zuletzt === '', a2);
  for (let i = 0; i < 3; i++) await seite.locator('.za-steuer [data-aktion="zug-vor"]').click();
  const a3 = await ansicht();
  pruefe('Ansehen: vor bis 2. Sf3', a3.schild === '2. Sf3' && a3.f3 === 'wN', a3);
  await seite.locator('.za-steuer [data-aktion="zug-vor"]').click();
  const a3b = await ansicht();
  await seite.waitForFunction(() => !document.querySelector('.screen.partie .zug-ansicht'), null, { timeout: 5000 }).catch(() => {});
  pruefe('Ansehen: vor auf den letzten Zug zeigt ihn noch einmal (1… Sc6), dann zur Partie (Ansicht zu, keine Markierung)',
    a3b.schild === '2… Sc6' && a3b.zuletzt === 'b8,c6' && !(await ansicht()).offen && !(await seite.locator('.screen.partie .z.angesehen').count()), a3b);
  // Tipp auf den letzten Zug: die Stellung davor, dann zieht der Bot-Springer noch einmal, danach von selbst zur Partie
  await seite.locator('.screen.partie .z[data-ply="3"]').filter({ visible: true }).first().click();
  await seite.waitForSelector('.screen.partie .zug-ansicht');
  const r1 = await ansicht();
  await seite.waitForFunction(() => document.querySelector('.screen.partie .za-schild')?.textContent === '2… Sc6', null, { timeout: 3000 }).catch(() => {});
  const r2 = await ansicht();
  await seite.waitForFunction(() => !document.querySelector('.screen.partie .zug-ansicht'), null, { timeout: 5000 }).catch(() => {});
  pruefe('Ansehen: Tipp auf den letzten Zug spielt ihn noch einmal ab (erst 2. Sf3, dann 2… Sc6) und kehrt von selbst zurueck',
    r1.schild === '2. Sf3' && r2.schild === '2… Sc6' && r2.zuletzt === 'b8,c6' && !(await ansicht()).offen, { r1, r2 });
  await seite.locator('.screen.partie .z[data-ply="0"]').filter({ visible: true }).first().click();
  await seite.waitForSelector('.screen.partie .zug-ansicht');
  const zuegeVor = await seite.evaluate(() => window.__partie.z.zuege.length);
  const mitte = await seite.locator('.screen.partie .zug-ansicht .za-brett').boundingBox();
  await seite.touchscreen.tap(mitte.x + mitte.width / 2, mitte.y + mitte.height / 2);
  await bildFertig();
  pruefe('Ansehen: ein Tipp aufs Ansichts-Brett fuehrt zur Partie, ohne Zug', !(await ansicht()).offen
    && (await seite.evaluate(() => window.__partie.z.zuege.length)) === zuegeVor && (await seite.evaluate(() => window.__partie.phase())) === 'flo');
  await seite.keyboard.press('ArrowLeft');
  const a4 = await ansicht();
  await seite.keyboard.press('Escape');
  pruefe('Ansehen: Tastatur (Pfeil links zeigt den Zug davor, Escape zur Partie)', a4.schild === '2. Sf3' && !(await ansicht()).offen, a4);
  // Der Plan ist leer: nach d2-d4 haelt der Bot an. Waehrenddessen ansehen, dann zieht er: die Ansicht geht zu
  await zug('d2d4');
  await seite.waitForFunction(() => window.__partie.phase() === 'bot');
  await seite.locator('.screen.partie .z[data-ply="2"]').filter({ visible: true }).first().click();
  await seite.waitForSelector('.screen.partie .zug-ansicht');
  await lasBotLos();
  await seite.waitForFunction(() => window.__partie.z.zuege.length >= 6);
  await bildFertig();
  pruefe('Ansehen: ein neuer Zug (der Bot zieht) schliesst die Ansicht', !(await ansicht()).offen);

  // ---------- 7. Pfeil-Tipp: einmal je Geraet, ab der zweiten Partie ----------
  // Am Rechner (Maus, ohne Touch, wie die Rechtsklick-Pruefungen in tests/board.test.mjs: mit Touch kam der Rechtsklick
  // in der CI nicht als Malen an)
  const touchSeite = seite;
  const desktop = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  await vorbereite(desktop);
  seite = await desktop.newPage();
  seite.setDefaultTimeout(45000);
  seite.on('pageerror', (e) => fehler.push(e.message));
  seite.on('console', (m) => { if (m.type() === 'error') fehler.push(m.text()); });
  await seite.goto(START);
  await seite.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function' && document.querySelector('.screen.arena'));
  await seite.evaluate((m) => { localStorage.removeItem(m); window.__test.pfeilTipp = true; }, MERKER);
  await neuePartie();
  const t1 = await seite.evaluate((m) => ({ sichtbar: !document.querySelector('.screen.partie .pfeil-tipp').hidden, merker: localStorage.getItem(m) }), MERKER);
  pruefe('Pfeil-Tipp: in der ersten Partie noch nicht', !t1.sichtbar && JSON.parse(t1.merker).partien === 1, t1);
  await neuePartie();
  const t2 = await seite.evaluate(() => {
    const el = document.querySelector('.screen.partie .pfeil-tipp');
    const r = el.getBoundingClientRect();
    return { sichtbar: !el.hidden && r.height > 0, text: el.querySelector('.pt-text').textContent, knopf: el.querySelector('.pt-ok').getBoundingClientRect().height };
  });
  pruefe('Pfeil-Tipp: in der zweiten Partie eine ruhige Zeile mit "Verstanden", am Rechner mit Rechtsklick', t2.sichtbar && t2.knopf >= 44
    && t2.text === 'Tipp: Rechtsklick und ziehen zeichnet einen Pfeil.', t2);
  // Rechtsklick ziehen zeichnet einen Pfeil: die Zeile geht und kommt nicht wieder
  // langsam zeichnen (CI: zu schnelle Zeiger-Ereignisse kamen nicht als Malen an) und auf den Pfeil warten
  await seite.waitForFunction(() => window.__partie.phase() === 'flo');
  const a = await feld('e2'), b = await feld('e4');
  await seite.bringToFront();
  await seite.mouse.move(a.x, a.y); await bildFertig();
  await seite.mouse.down({ button: 'right' }); await bildFertig();
  for (let i = 1; i <= 10; i++) { await seite.mouse.move(a.x + (b.x - a.x) * i / 10, a.y + (b.y - a.y) * i / 10); await bildFertig(); }
  await seite.mouse.up({ button: 'right' });
  await seite.waitForFunction(() => window.__partie.brett.nutzerPfeile().some((x) => x.art === 'pfeil'), null, { timeout: 8000 }).catch(() => {});
  await seite.waitForFunction(() => document.querySelector('.screen.partie .pfeil-tipp').hidden);
  const t3 = await seite.evaluate((m) => ({ pfeile: window.__partie.brett.nutzerPfeile().filter((x) => x.art === 'pfeil').length,
    sichtbar: !document.querySelector('.screen.partie .pfeil-tipp').hidden, merker: JSON.parse(localStorage.getItem(m)) }), MERKER);
  pruefe('Pfeil-Tipp: nach dem ersten gezeichneten Pfeil weg und erledigt', t3.pfeile === 1 && !t3.sichtbar && t3.merker.erledigt === true, t3);
  await neuePartie();
  pruefe('Pfeil-Tipp: kommt danach nie wieder', await seite.evaluate(() => document.querySelector('.screen.partie .pfeil-tipp').hidden));
  await seite.evaluate((m) => localStorage.setItem(m, JSON.stringify({ partien: 1, erledigt: false })), MERKER);
  await neuePartie();
  await seite.locator('.screen.partie .pfeil-tipp .pt-ok').click();
  pruefe('Pfeil-Tipp: "Verstanden" schliesst ihn fuer immer', await seite.evaluate((m) => document.querySelector('.screen.partie .pfeil-tipp').hidden
    && JSON.parse(localStorage.getItem(m)).erledigt === true, MERKER));

  await desktop.close();
  seite = touchSeite;
  pruefe('Pfeil-Tipp: Merker fuer das iPad zurueckgesetzt', await seite.evaluate((m) => {
    localStorage.setItem(m, JSON.stringify({ partien: 1, erledigt: false })); window.__test.pfeilTipp = true; return true; }, MERKER));
  await neuePartie();
  const tTouch = await seite.evaluate(() => document.querySelector('.screen.partie .pfeil-tipp .pt-text').textContent);
  // Ob Chromium mit Touch "hover: hover" meldet, haengt vom Geraet ab: einer der beiden Texte, nie leer
  pruefe('Pfeil-Tipp: auch am iPad sichtbar, mit einem der beiden Texte', ['Tipp: Finger auf ein Feld halten und ziehen zeichnet einen Pfeil.', 'Tipp: Rechtsklick und ziehen zeichnet einen Pfeil.'].includes(tTouch), tTouch);

  // ---------- 8. Ansichten: iPad quer und Handy hoch, hell und dunkel ----------
  for (const [width, height, name] of [[1180, 820, 'ipad-quer'], [390, 844, 'handy-hoch']]) for (const modus of ['hell', 'dunkel']) {
    await seite.setViewportSize({ width, height });
    await seite.evaluate((m) => window.__app.setzeEinstellungen({ modus: m }), modus);
    await seite.evaluate((m) => localStorage.setItem(m, JSON.stringify({ partien: 1, erledigt: false })), MERKER);
    await neuePartie();
    await bisBotDenkt();
    await zug('e2e4');
    await zug('e4e5');
    await bildFertig();
    const m = await seite.evaluate(() => {
      const brett = document.querySelector('.screen.partie .brett').getBoundingClientRect();
      const nr = [...document.querySelectorAll('.screen.partie .brett-nummern .nummer span')].map((s) => s.getBoundingClientRect());
      const tipp = document.querySelector('.screen.partie .pfeil-tipp').getBoundingClientRect();
      const knoepfe = document.querySelector('.screen.partie .spielknoepfe').getBoundingClientRect();
      return {
        quer: document.documentElement.scrollWidth <= innerWidth,
        nummern: nr.length === 2 && nr.every((r) => r.left >= brett.left - 1 && r.right <= brett.right + 1 && r.top >= brett.top - 1 && r.bottom <= brett.bottom + 1),
        tipp: tipp.height >= 44 && tipp.left >= 0 && tipp.right <= innerWidth + 1,
        knoepfe: knoepfe.bottom <= innerHeight + 1 || getComputedStyle(document.querySelector('.screen.partie .inhalt')).overflowY === 'auto',
      };
    });
    pruefe(`${name} ${modus}: Nummern im Brett, Tipp-Zeile passt, kein Ueberlauf`, Object.values(m).every(Boolean), m);
    if (process.env.BILDER) { mkdirSync(process.env.BILDER, { recursive: true }); await seite.screenshot({ path: path.join(process.env.BILDER, `vorzuege-${name}-${modus}.png`) }); }
  }
  pruefe('Keine Konsolen- oder Seitenfehler', fehler.length === 0, fehler);
} catch (e) {
  const zustand = await begrenzt('Vorzug: Fehlerstand', () => seite.evaluate(() => ({ hash: location.hash,
    screen: document.documentElement.dataset.screen, bereit: window.__partie?.bereit, phase: window.__partie?.phase(),
    plan: window.__plan, zuege: window.__partie?.z.zuege, vorzuege: window.__partie?.z.vorzuege })), 2000).catch(() => null);
  pruefe('Ablauf ohne Abbruch', false, { fehler: e.stack, zustand, konsole: fehler });
}
finally {
  await begrenzt('Vorzug: Browser schliessen', () => browser?.close(), 10000).catch(e => { pruefe('Aufraeumen', false, e.message); });
  server.closeAllConnections();
  await begrenzt('Vorzug: Server schliessen', () => new Promise(r => server.close(r)), 5000).catch(e => { pruefe('Server-Aufraeumen', false, e.message); });
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exitCode = ok === gesamt ? 0 : 1;
