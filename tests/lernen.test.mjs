// Paket lernen (Meisterschule, Etappe 1 Mattbilder): Daten und Sterne ohne Browser, dazu ein Browser-Teil (Playwright) in
// der vollen App. Als Erfinder (Sitzung und Sonderstuecke im Speicher, Supabase per page.route gefaelscht): Karte im
// Training, Uebersicht mit 20 Lektionen, Lektion Grundreihe gespielt (Matt in 1, 3 Sterne, gespeichert, Karte zaehlt),
// Lektion Dame mit gefaelschter Verteidigung (window.__test.lektionZug): Hinweis, Neu starten, Gegenzug, Patt-Ende.
// Ohne Labor (anderes Konto): keine Karte, #lernen und #lektion fuehren zur Arena.
//   node tests/lernen.test.mjs            Node und Browser
//   node tests/lernen.test.mjs --nur-node nur der Node-Teil
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Chess } from '../vendor/chess/chess.js';
import { LEKTIONEN, STUFEN, lektion, sterne, grenze, pruefeLektion, stand, merke, summe } from '../js/pakete/lernen/mattbilder.js';
import { DE, EN } from '../js/pakete/lernen/texte.js';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8934);
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const NUR_NODE = process.argv.includes('--nur-node');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0; let fehler = 0;
function pruefe(name, wert, info = '') {
  if (wert) { ok++; console.log('ok   ' + name); } else { fehler++; console.log('FEHLER ' + name + ' ' + (typeof info === 'string' ? info : JSON.stringify(info))); }
}

// ---------------------------------------------------------------------------
// Node-Teil
// ---------------------------------------------------------------------------
pruefe('Mattbilder: 20 Lektionen, ids eindeutig, Stufen von leicht bis Meister', LEKTIONEN.length === 20
  && new Set(LEKTIONEN.map((l) => l.id)).size === 20 && LEKTIONEN[0].stufe === 'leicht' && LEKTIONEN[19].stufe === 'meister'
  && LEKTIONEN.every((l) => STUFEN.includes(l.stufe)));
const pf = LEKTIONEN.flatMap((l) => pruefeLektion(l, Chess));
pruefe('Mattbilder: jede Stellung legal, Weiss am Zug, Schwarz nicht im Schach, nicht schon vorbei, Ziel ganzzahlig', pf.length === 0, pf.join(' | '));
pruefe('Stufen laufen nie rueckwaerts (leicht zuerst, Meister zuletzt)', LEKTIONEN.every((l, i) => i === 0
  || STUFEN.indexOf(l.stufe) >= STUFEN.indexOf(LEKTIONEN[i - 1].stufe) - 1));
const fehltText = LEKTIONEN.flatMap((l) => ['titel.', 'idee.'].flatMap((k) => [DE, EN].filter((d) => !d[k + l.id]).map(() => k + l.id)));
pruefe('Texte: Titel und Idee je Lektion auf Deutsch und Englisch', fehltText.length === 0, fehltText.join(', '));
pruefe('Texte: alle Schluessel in beiden Sprachen, keine langen Gedankenstriche',
  JSON.stringify(Object.keys(DE).sort()) === JSON.stringify(Object.keys(EN).sort())
  && ![...Object.values(DE), ...Object.values(EN)].some((v) => /[–—]/.test(v)));

// Die Muster stimmen: die bekannten Mattfuehrungen enden in diesen Stellungen wirklich matt
function spiele(fen, zuege) {
  const c = new Chess(fen);
  for (const z of zuege) c.move(z);
  return c;
}
pruefe('Grundreihe: Ta8 ist matt', spiele(lektion('grundreihe').fen, ['Ra8']).isCheckmate());
pruefe('Anastasia: Dxh7+ Kxh7 Th3 ist matt', spiele(lektion('anastasia').fen, ['Qxh7+', 'Kxh7', 'Rh3#']).isCheckmate());
const MUSTER = [
  ['pillsbury', ['Rg3#']], ['epaulette', ['Qe6#']], ['todeskuss', ['Qe7#']], ['blackburne', ['Bh7#']],
  ['anderssen', ['Rh1+', 'Kg8', 'Rh8#']], ['lolli', ['Qh6', 'a6', 'Qg7#']], ['damiano', ['Qh6', 'a6', 'Qh7#']],
  ['greco', ['Rxh7+', 'Kxh7', 'Qh5#']], ['oper', ['Qb8+', 'Nxb8', 'Rd8#']], ['boden', ['Qxc6+', 'bxc6', 'Ba6#']],
  ['legal', ['Bxf7+', 'Ke7', 'Nd5#']], ['arabisch', ['Nf6', 'a5', 'Rh7#']],
];
const musterFehler = MUSTER.filter(([id, zuege]) => { try { return !spiele(lektion(id).fen, zuege).isCheckmate(); } catch { return true; } })
  .map(([id]) => id);
pruefe('Neue Mattbilder: jede bekannte Mattfuehrung endet wirklich matt', musterFehler.length === 0, musterFehler.join(', '));
pruefe('Mattbilder: kein Muster doppelt (jede Stellung einmal)', new Set(LEKTIONEN.map((l) => l.fen)).size === LEKTIONEN.length);
const kaputt = pruefeLektion({ id: 'probe', stufe: 'leicht', fen: '3rk3/3p1p2/8/8/7Q/8/5PPP/4R1K1 w - - 0 1', ziel: 1 }, Chess);
pruefe('Pruefung erkennt eine Stellung, in der Schwarz schon im Schach steht', kaputt.some((f) => /im Schach/.test(f)), kaputt);
pruefe('Ersticktes Matt: Sf7+ Kg8 Sh6+ Kh8 Dg8+ Txg8 Sf7 ist matt',
  spiele(lektion('erstickt').fen, ['Nf7+', 'Kg8', 'Nh6+', 'Kh8', 'Qg8+', 'Rxg8', 'Nf7#']).isCheckmate());

pruefe('Sterne: Ziel 7, mit 7 oder 8 Zuegen drei, bis 13 zwei, danach einer',
  sterne({ ziel: 7, zuege: 7 }) === 3 && sterne({ ziel: 7, zuege: 8 }) === 3 && sterne({ ziel: 7, zuege: 9 }) === 2
  && sterne({ ziel: 7, zuege: 13 }) === 2 && sterne({ ziel: 7, zuege: 14 }) === 1);
pruefe('Sterne: Matt in 1 nur mit einem Zug drei Sterne', sterne({ ziel: 1, zuege: 1 }) === 3 && sterne({ ziel: 1, zuege: 2 }) === 2
  && sterne({ ziel: 1, zuege: 5 }) === 1);
pruefe('Sterne: mit Hinweis hoechstens zwei', sterne({ ziel: 7, zuege: 7, hinweise: 1 }) === 2 && sterne({ ziel: 7, zuege: 20, hinweise: 2 }) === 1);
pruefe('Grenze: doppeltes Ziel plus 10 Zuege', grenze(7) === 24 && grenze(1) === 12 && grenze(25) === 60);
let st = merke({}, 'dame', { sterne: 2, zuege: 11 });
st = merke(st, 'dame', { sterne: 1, zuege: 9 });
st = merke(st, 'gibtsnicht', { sterne: 3, zuege: 1 });
pruefe('Speicher: bessere Sterne und weniger Zuege bleiben, unbekannte Lektion faellt weg',
  JSON.stringify(st) === '{"lek":{"dame":{"s":2,"z":9}}}');
pruefe('Speicher: kaputte Eintraege fallen still weg', JSON.stringify(stand({ lek: { dame: { s: 7, z: 3 }, turm: 'x', grundreihe: { s: 3, z: 1 } } }))
  === '{"lek":{"grundreihe":{"s":3,"z":1}}}' && JSON.stringify(stand(null)) === '{"lek":{}}');
pruefe('Summe: Sterne, Hoechstzahl 60, geschafft', JSON.stringify(summe(merke(st, 'grundreihe', { sterne: 3, zuege: 1 })))
  === '{"sterne":5,"max":60,"geschafft":2}');

// ---------------------------------------------------------------------------
// Browser-Teil (volle App, alle Pakete)
// ---------------------------------------------------------------------------
async function warteAufServer(url, ms = 10000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try { const r = await fetch(url); if (r.ok) return; } catch (e) { /* noch nicht da */ }
    await warte(150);
  }
  throw new Error('Server startet nicht: ' + url);
}
function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}

const SUPA = 'https://usaamcqypmvgqmsbfecb.supabase.co';
const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const token = (sub) => 'a.' + Buffer.from(JSON.stringify({ sub })).toString('base64url') + '.x';
const SITZUNG = { access_token: token(UID), refresh_token: 'r1', expires_at: 9999999999, user: { id: UID, email: 'probe@example.invalid' } };
const ERFINDER_ZEILEN = ['erfinder-banner-blatt-0', 'erfinder-titel', 'erfinder-figuren-blaupause', 'erfinder-finisher-signatur']
  .map((stueck_id) => ({ stueck_id }));

async function seite(browser, { erfinder = true, groesse = { width: 1180, height: 820 }, hash = '#training' } = {}) {
  const k = await browser.newContext({ viewport: groesse, serviceWorkers: 'block', timezoneId: 'Europe/Berlin' });
  const s = await k.newPage();
  const fehlerListe = [];
  s.on('pageerror', (e) => fehlerListe.push(e.message));
  s.on('console', (m) => { if (m.type() === 'error') fehlerListe.push(m.text()); });
  await s.route(SUPA + '/**', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify(r.request().url().includes('/rest/v1/sonderstuecke') && erfinder ? ERFINDER_ZEILEN : []) }));
  await s.addInitScript(({ sitzung, erfinder, uid }) => {
    try {
      if (sessionStorage.getItem('probe-start')) return;
      sessionStorage.setItem('probe-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
      if (erfinder) localStorage.setItem('schach-arena:konto:sonderstuecke', JSON.stringify({ konto: uid, ids: ['erfinder-titel'] }));
    } catch (e) { /* egal */ }
  }, { sitzung: SITZUNG, erfinder, uid: UID });
  await s.goto(BASIS + hash);
  await s.waitForFunction(() => !!window.__app && !!document.querySelector('.screen'), null, { timeout: 30000 });
  await warte(600);
  return { k, s, fehlerListe };
}

const lz = (s) => s.evaluate(() => (window.__lektion ? window.__lektion.zustand() : { offen: false }));
async function warteLz(s, bedingung, ms = 10000) {
  await s.waitForFunction((b) => {
    const z = window.__lektion ? window.__lektion.zustand() : { offen: false };
    return new Function('z', 'return ' + b)(z);
  }, bedingung, { timeout: ms }).catch(() => {});
}
async function ziehe(s, uci) {
  for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) {
    const b = await s.locator(`.ls-screen .brett-felder .feld[data-feld="${f}"]`).boundingBox();
    await s.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await warte(90);
  }
}
// gefaelschte Verteidigung: der erste legale Zug (chess.js im Browser), damit der Test ohne Stockfish laeuft
const setzeVerteidigung = (s) => s.evaluate(async () => {
  const { Chess: C } = await import('/vendor/chess/chess.js');
  window.__test = window.__test || {};
  window.__test.lektionPause = 30;
  window.__test.lektionZug = (fen) => { const m = new C(fen).moves({ verbose: true })[0]; return m ? m.from + m.to + (m.promotion || '') : null; };
});

async function erfinderTeil(browser) {
  const p = await seite(browser);
  await p.s.waitForSelector('.ms-karte', { timeout: 15000 }).catch(() => {});
  const karte = await p.s.evaluate(() => {
    const k = document.querySelector('.ms-karte');
    return k && { text: k.innerText, erste: document.querySelector('.training-gitter > *')?.classList.contains('ms-karte') };
  });
  pruefe('Erfinder: Karte „Meisterschule · Mattbilder“ im Training mit Labor-Schild und 0 von 60 Sternen und 20 Lektionen', !!karte
    && /Mattbilder/.test(karte.text) && /Labor/i.test(karte.text) && /0 von 60 Sternen/.test(karte.text) && /20 Lektionen/.test(karte.text), karte);
  await p.s.locator('.ms-karte .ms-oeffnen').click();
  await p.s.waitForSelector('.ms-screen .ms-lektion', { timeout: 15000 }).catch(() => {});
  const liste = await p.s.evaluate(() => [...document.querySelectorAll('.ms-lektion')].map((b) => b.dataset.id).join());
  pruefe('Übersicht: 20 Lektionen in der Reihenfolge der Daten', liste === LEKTIONEN_IDS, liste);
  pruefe('Übersicht: kein waagrechtes Scrollen', await p.s.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

  // Lektion 1: Grundreihenmatt in einem Zug
  await p.s.locator('.ms-lektion[data-id="grundreihe"]').click();
  await p.s.waitForSelector('.ls-screen .brett-felder .feld', { timeout: 15000 }).catch(() => {});
  let z = await lz(p.s);
  pruefe('Lektion: beginnt mit der Idee (Phase intro), Titel und Ziel sichtbar', z.phase === 'intro'
    && /Grundreihenmatt/.test(await p.s.locator('.ls-status').innerText()) && /Matt in einem Zug ist möglich/.test(await p.s.locator('.ls-status').innerText()), z);
  await ziehe(p.s, 'a1a8');
  z = await lz(p.s);
  pruefe('Lektion: vor „Los geht’s“ nimmt das Brett keinen Zug an', z.phase === 'intro' && z.zuege === 0, z);
  await p.s.locator('.ls-aktionen [data-a="los"]').click();
  await warteLz(p.s, "z.phase === 'flo'");
  await ziehe(p.s, 'a1a8');
  await warteLz(p.s, "z.phase === 'ende'");
  z = await lz(p.s);
  pruefe('Grundreihe: Ta8 matt, ein Zug, drei Sterne', z.phase === 'ende' && z.zuege === 1 && z.sterne === 3 && !z.grund, z);
  pruefe('Ergebnis: „Matt!“ mit drei leuchtenden Sternen und „Nächste Lektion“', await p.s.evaluate(() => {
    const m = document.querySelector('.ls-meldung[data-art="geschafft"]');
    return !!m && m.querySelectorAll('.ms-sterne > i.an').length === 3 && !!document.querySelector('.ls-aktionen [data-a="weiter"]');
  }), await p.s.evaluate(() => document.querySelector('.ls-meldung')?.outerHTML.slice(0, 400) + ' | ' + document.querySelector('.ls-aktionen')?.innerHTML.slice(0, 300)));
  const gespeichert = await p.s.evaluate(() => JSON.parse(localStorage.getItem('schach-arena:v1:modul:lernen') || 'null'));
  pruefe('Speicher: Modul lernen hält 3 Sterne und 1 Zug', gespeichert && gespeichert.lek && gespeichert.lek.grundreihe
    && gespeichert.lek.grundreihe.s === 3 && gespeichert.lek.grundreihe.z === 1, gespeichert);

  // weiter zur naechsten Lektion, dann ueber die Uebersicht zur Dame
  await p.s.locator('.ls-aktionen [data-a="weiter"]').click();
  await warteLz(p.s, `z.id === '${LEKTIONEN[1].id}' && z.phase === 'intro'`);
  pruefe('„Nächste Lektion“ öffnet die zweite Lektion', (await lz(p.s)).id === LEKTIONEN[1].id);
  await p.s.evaluate(() => window.__app.gehe('lernen'));
  await p.s.waitForSelector('.ms-lektion[data-id="grundreihe"][data-geschafft]', { timeout: 10000 }).catch(() => {});
  pruefe('Übersicht: Grundreihe geschafft mit drei Sternen und „Dein Bestes: 1 Zug“', await p.s.evaluate(() => {
    const b = document.querySelector('.ms-lektion[data-id="grundreihe"]');
    return !!b && b.hasAttribute('data-geschafft') && b.querySelectorAll('.ms-sterne > i.an').length === 3 && /Dein Bestes: 1 Zug/.test(b.innerText);
  }));
  pruefe('Übersicht: Gesamt 3 von 60 Sternen', /3 von 60 Sternen/.test(await p.s.locator('.ms-gesamt').innerText()));

  await setzeVerteidigung(p.s);
  await p.s.locator('.ms-lektion[data-id="dame"]').click();
  await warteLz(p.s, "z.id === 'dame' && z.phase === 'intro'");
  await p.s.locator('.ls-aktionen [data-a="los"]').click();
  await warteLz(p.s, "z.phase === 'flo'");
  await p.s.locator('.ls-aktionen [data-a="hinweis"]').click();
  await p.s.waitForSelector('.ls-meldung[data-art="hinweis"]', { timeout: 8000 }).catch(() => {});
  z = await lz(p.s);
  pruefe('Hinweis: Pfeil und Satz „höchstens 2 Sterne“, zählt mit', z.hinweise === 1
    && /höchstens 2 Sterne/.test(await p.s.locator('.ls-meldung').innerText()), z);
  await ziehe(p.s, 'd1d7');
  await warteLz(p.s, "z.phase === 'flo' && z.zuege === 1");
  z = await lz(p.s);
  pruefe('Dame: nach Flos Zug antwortet die Verteidigung, dann ist Flo wieder dran', z.phase === 'flo' && z.zuege === 1
    && new Chess(z.fen).turn() === 'w', z);
  pruefe('Zähler zeigt „Zug 1“', /Zug 1/.test(await p.s.locator('.ls-zug').innerText()));
  await p.s.locator('.ls-aktionen [data-a="neu"]').click();
  await warteLz(p.s, "z.phase === 'flo' && z.zuege === 0 && z.hinweise === 0");
  z = await lz(p.s);
  pruefe('Neu starten: Ausgangsstellung, Zähler und Hinweise auf null', z.zuege === 0 && z.hinweise === 0 && z.fen === lektion('dame').fen, z);
  pruefe('Erfinder: keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
  await p.k.close();

  // Handy: Uebersicht und Lektion passen, unbekannte Lektion fuehrt zur Uebersicht
  const q = await seite(browser, { groesse: { width: 390, height: 844 }, hash: '#lernen' });
  await q.s.waitForSelector('.ms-lektion', { timeout: 15000 }).catch(() => {});
  pruefe('Handy: Übersicht ohne waagrechtes Scrollen', await q.s.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await q.s.evaluate(() => window.__app.gehe('lektion', { id: 'turm' }));
  await q.s.waitForSelector('.ls-screen .brett-felder .feld', { timeout: 15000 }).catch(() => {});
  pruefe('Handy: Lektion ohne waagrechtes Scrollen, Knöpfe mindestens 44 px hoch', await q.s.evaluate(() => {
    const k = [...document.querySelectorAll('.ls-aktionen .knopf')];
    return document.documentElement.scrollWidth <= window.innerWidth + 1 && k.length > 0 && k.every((x) => x.getBoundingClientRect().height >= 44);
  }));
  await q.s.evaluate(() => window.__app.gehe('lektion', { id: 'gibtsnicht' }));
  await q.s.waitForSelector('.ms-screen', { timeout: 10000 }).catch(() => {});
  pruefe('Unbekannte Lektion führt zur Übersicht', await q.s.locator('.ms-screen').count() === 1);
  pruefe('Handy: keine Seitenfehler', q.fehlerListe.length === 0, q.fehlerListe.join(' | '));
  await q.k.close();
}

async function ohneLaborTeil(browser) {
  const p = await seite(browser, { erfinder: false });
  await warte(600);
  pruefe('Ohne Labor: keine Meisterschule-Karte im Training', await p.s.locator('.ms-karte').count() === 0);
  await p.s.evaluate(() => window.__app.gehe('lernen'));
  await p.s.waitForSelector('.arena', { timeout: 10000 }).catch(() => {});
  pruefe('Ohne Labor: #lernen führt zur Arena', await p.s.evaluate(() => location.hash.startsWith('#arena') || !!document.querySelector('.screen.arena, .arena')));
  await p.s.evaluate(() => window.__app.gehe('lektion', { id: 'grundreihe' }));
  await warte(600);
  pruefe('Ohne Labor: #lektion führt zur Arena, kein Lektions-Bildschirm', await p.s.locator('.ls-screen .brett').count() === 0);
  pruefe('Ohne Labor: keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
  await p.k.close();
}

const LEKTIONEN_IDS = LEKTIONEN.map((l) => l.id).join();

async function browserTeil() {
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
  let browser = null;
  try {
    await warteAufServer(`http://127.0.0.1:${PORT}/index.html`);
    browser = await browserTyp(ladePlaywright()).launch();
    await erfinderTeil(browser);
    await ohneLaborTeil(browser);
  } catch (e) {
    pruefe('Browser-Teil läuft durch', false, e.message);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

if (!NUR_NODE) await browserTeil();
console.log(`${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
