// Feinschliff R19 Uhr (Flo 15.11.2026: "die Uhr lief auch in der Partie nicht"; Befund c, partie.js:95, W0+b nie gebaut).
// Node-Teil: der Uhrkern js/uhr.js ohne DOM und ohne echte Zeit (jede Zeit kommt als Argument).
//   neueUhr({ grund, zuschlag, amZug }) -> { starte(jetzt), zug(jetzt) -> verbraucht ms, halte(jetzt), weiter(jetzt),
//     rest(farbe, jetzt), abgelaufen(jetzt) -> 'w' | 'b' | null, amZug, laeuft }
//   restAusZeiten(tempo, zeiten, { startFarbe, laufVerbraucht?, laufSeit?, jetzt? }) -> { w, b, amZug }
//     zeiten = verbrauchte Zehntelsekunden je Halbzug (Speicherfeld, js/storage.js). laufVerbraucht: im laufenden Zug
//     schon verbraucht (Bot-Partie, die Uhr hielt beim Schliessen an); laufSeit + jetzt: Wanduhr seit Beginn des
//     laufenden Zugs (gewertete KI-Partie, die Uhr laeuft weiter wie online).
//   zeitErgebnis(fen, abgelaufen) -> 'w' | 'b' | 'remis'   Remis, wenn der Gegner kein Mattmaterial hat
// Browser-Teil: Partie mit Bedenkzeit gegen benno, Server nur simuliert (nie Supabase).
// node tests/r19-uhr.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ergebnisse = [];
async function pruefe(name, fn) {
  try { await fn(); ergebnisse.push(true); console.log('ok   ' + name); }
  catch (e) { ergebnisse.push(false); console.error('FEHLER ' + name + ': ' + e.message); }
}

let U = null;
try { U = await import('../js/uhr.js'); } catch (e) { console.error('FEHLER js/uhr.js laesst sich nicht laden: ' + e.message); }

await pruefe('js/uhr.js liefert neueUhr, restAusZeiten, zeitErgebnis', () => {
  assert.ok(U, 'Modul fehlt');
  for (const n of ['neueUhr', 'restAusZeiten', 'zeitErgebnis']) assert.equal(typeof U[n], 'function', n);
});

if (U) {
  const T = { grund: 300, zuschlag: 3 };

  await pruefe('neue Uhr: beide 5:00, steht, Weiss am Zug', () => {
    const u = U.neueUhr({ ...T, amZug: 'w' });
    assert.equal(u.laeuft, false); assert.equal(u.amZug, 'w');
    assert.equal(u.rest('w', 99999), 300000); assert.equal(u.rest('b', 99999), 300000);
    assert.equal(u.abgelaufen(99999), null);
  });

  await pruefe('laeuft nur fuer die Seite am Zug, ab dem Start', () => {
    const u = U.neueUhr({ ...T, amZug: 'w' });
    u.starte(1000);
    assert.equal(u.laeuft, true);
    assert.equal(u.rest('w', 2500), 298500);
    assert.equal(u.rest('b', 2500), 300000);
  });

  await pruefe('Zug: Abzug, Zuschlag fuer den Ziehenden, Wechsel', () => {
    const u = U.neueUhr({ ...T, amZug: 'w' });
    u.starte(0);
    assert.equal(u.zug(2000), 2000);
    assert.equal(u.amZug, 'b');
    assert.equal(u.rest('w', 2500), 301000);
    assert.equal(u.rest('b', 2500), 299500);
    assert.equal(u.zug(4000), 2000);
    assert.equal(u.rest('b', 9000), 301000);
    assert.equal(u.rest('w', 5000), 300000);
  });

  await pruefe('halte/weiter: die Pause zaehlt nicht (Bot-Partie im Hintergrund)', () => {
    const u = U.neueUhr({ ...T, amZug: 'w' });
    u.starte(0); u.zug(2000);
    u.halte(3000);
    assert.equal(u.laeuft, false);
    assert.equal(u.rest('b', 9000), 299000);
    u.weiter(10000);
    assert.equal(u.rest('b', 11000), 298000);
  });

  await pruefe('Zeitende: genau bei 0, Rest nie negativ', () => {
    const u = U.neueUhr({ grund: 1, zuschlag: 0, amZug: 'w' });
    u.starte(0);
    assert.equal(u.abgelaufen(999), null);
    assert.equal(u.abgelaufen(1000), 'w');
    assert.equal(u.rest('w', 5000), 0);
  });

  // Kaltreview F3: der Takt kann haengen, ein spaeter Zug darf die Zeit nicht mit dem Zuschlag wiederbeleben
  await pruefe('Zug nach Ablauf: kein Zuschlag, kein Wechsel, bleibt abgelaufen', () => {
    const u = U.neueUhr({ grund: 1, zuschlag: 5, amZug: 'w' });
    u.starte(0);
    u.zug(1500);
    assert.equal(u.amZug, 'w', 'kein Wechsel');
    assert.equal(u.rest('w', 2000), 0, 'kein Zuschlag');
    assert.equal(u.abgelaufen(2000), 'w');
    assert.equal(u.rest('b', 2000), 1000, 'Gegneruhr unberuehrt');
  });

  await pruefe('Fortsetzen aus zeiten: Abzug je Seite, Zuschlag je eigenem Zug, Seite am Zug', () => {
    const zeiten = [20, 35, 100];
    const r = U.restAusZeiten(T, zeiten, { startFarbe: 'w' });
    assert.deepEqual(r, { w: 294000, b: 299500, amZug: 'b' });
    assert.deepEqual(zeiten, [20, 35, 100], 'zeiten unveraendert');
    assert.deepEqual(U.restAusZeiten(T, [], { startFarbe: 'b' }), { w: 300000, b: 300000, amZug: 'b' });
  });

  await pruefe('Fortsetzen Bot-Partie: nur die vor dem Schliessen verbrauchte Zeit des laufenden Zugs', () => {
    assert.equal(U.restAusZeiten(T, [20, 35, 100], { startFarbe: 'w', laufVerbraucht: 4000 }).b, 295500);
  });

  await pruefe('Fortsetzen gewertet: Wanduhr seit Beginn des laufenden Zugs (auch waehrend die App zu war)', () => {
    const r = U.restAusZeiten(T, [20, 35, 100], { startFarbe: 'w', laufSeit: 1000, jetzt: 61000 });
    assert.equal(r.b, 239500); assert.equal(r.w, 294000);
    assert.equal(U.restAusZeiten({ grund: 60, zuschlag: 0 }, [], { startFarbe: 'w', laufSeit: 0, jetzt: 999999 }).w, 0);
  });

  await pruefe('neueUhr uebernimmt den Rest beim Fortsetzen (w, b)', () => {
    const u = U.neueUhr({ ...T, amZug: 'b', w: 294000, b: 239500 });
    u.starte(0);
    assert.equal(u.rest('b', 500), 239000); assert.equal(u.rest('w', 500), 294000);
  });

  // Fix-Review 07 (ab98f60): nach dem Fortsetzen fehlte der Teil des laufenden Zugs vor dem Schliessen in imZug, zug und
  // damit in uhr.verbraucht/seit und zeiten; zweimal zu und auf brachte ihn zurueck
  await pruefe('neueUhr mit imZug: der schon verbrauchte Teil des Zugs zaehlt in rest, imZug und zug', () => {
    const u = U.neueUhr({ ...T, amZug: 'w', imZug: 8000 });
    assert.equal(u.rest('w', 0), 292000, 'vor dem Start schon abgezogen');
    assert.equal(u.imZug(0), 8000);
    u.starte(1000);
    assert.equal(u.imZug(4000), 11000);
    assert.equal(u.zug(4000), 11000, 'der Zug bucht den ganzen Zug');
    assert.equal(u.rest('w', 5000), 292000, '300 - 11 + 3 Zuschlag');
    for (const kaputt of [-5, NaN, Infinity, undefined]) assert.equal(U.neueUhr({ ...T, amZug: 'w', imZug: kaputt }).imZug(0), 0, String(kaputt));
  });

  await pruefe('laufAnteil: verbraucht vor Wanduhr, nie negativ, Zukunft zaehlt 0', () => {
    assert.equal(typeof U.laufAnteil, 'function', 'laufAnteil fehlt');
    assert.equal(U.laufAnteil({ laufVerbraucht: 4000 }), 4000);
    assert.equal(U.laufAnteil({ laufVerbraucht: -4000 }), 0);
    assert.equal(U.laufAnteil({ laufSeit: 1000, jetzt: 61000 }), 60000);
    assert.equal(U.laufAnteil({ laufSeit: 9000, jetzt: 1000 }), 0);
    assert.equal(U.laufAnteil({}), 0);
  });

  const K_GEGEN = (schwarz) => `${schwarz}/8/8/8/8/8/8/4K3 w - - 0 1`;
  await pruefe('Zeitergebnis: Gegner mit Mattmaterial gewinnt', () => {
    assert.equal(U.zeitErgebnis(K_GEGEN('3qk3'), 'w'), 'b');
    assert.equal(U.zeitErgebnis('4k3/8/8/8/8/8/4P3/4K3 b - - 0 1', 'b'), 'w', 'Bauer reicht');
    assert.equal(U.zeitErgebnis(K_GEGEN('2b1kb2'), 'w'), 'b', 'zwei Laeufer');
  });
  await pruefe('Zeitergebnis: Remis, wenn der Gegner nur Koenig oder Koenig und eine Leichtfigur hat', () => {
    assert.equal(U.zeitErgebnis('3qk3/8/8/8/8/8/8/4K3 b - - 0 1', 'b'), 'remis', 'Weiss nur Koenig');
    assert.equal(U.zeitErgebnis(K_GEGEN('4kb2'), 'w'), 'remis', 'Koenig und Laeufer');
    assert.equal(U.zeitErgebnis(K_GEGEN('4kn2'), 'w'), 'remis', 'Koenig und Springer');
  });
}

// ---------- Browser-Teil: die Uhr in der Partie (js/ui/partie.js) ----------
// Vertrag: laeuft erst nach dem Intro und nur fuer die Seite am Zug (auch waehrend der Bot denkt), Zuschlag nach dem
// Zug, Zeitende = Niederlage/Sieg (Remis ohne Mattmaterial des Gegners), gewertete KI-Partie (kiRef) laeuft im
// Hintergrund und beim Fortsetzen nach der Wanduhr weiter, die Bot-Partie haelt an, der Bot-Zug haengt nicht an der Uhr.
const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const SUPA_MUSTER = '**/*.supabase.co/**';
const KI_REF = '11111111-2222-4333-8444-555555555555';
const SCREEN = '.screen.partie';
let BASIS = null;

function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  return null;
}
async function warteAufServer(url, ms = 10000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try { const r = await fetch(url); await r.arrayBuffer(); if (r.ok) return; } catch (e) { /* noch nicht da */ }
    await warte(150);
  }
  throw new Error('Server startet nicht: ' + url);
}
// "2:59" -> 179000, "0:07,4" -> 7400
function uhrMs(text) {
  const m = String(text || '').match(/^(\d+):(\d{2})(?:[.,](\d))?$/);
  return m ? (Number(m[1]) * 60 + Number(m[2])) * 1000 + Number(m[3] || 0) * 100 : NaN;
}
const leseUhr = (s, wer) => s.evaluate((w) => {
  const el = document.querySelector(`.screen.partie .uhr[data-wer="${w}"]`);
  return el ? { text: el.querySelector('.uhr-zeit').textContent.trim(), laeuft: el.classList.contains('laeuft'), da: !el.hidden } : null;
}, wer).then((u) => (u ? { ...u, ms: uhrMs(u.text) } : null));

async function neueSeite(browser) {
  const k = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'de-DE', serviceWorkers: 'block' });
  await k.route(SUPA_MUSTER, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  const s = await k.newPage();
  const fehlerListe = [];
  s.on('pageerror', (e) => fehlerListe.push(e.message));
  await s.addInitScript(() => {
    if (sessionStorage.getItem('probe-start')) return;
    sessionStorage.setItem('probe-start', '1');
    localStorage.clear();
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ sprache: 'de', spracheGewaehlt: true, duellIntro: 'aus' }));
  });
  await s.goto(`${BASIS}#arena`);
  await s.waitForSelector('.screen.arena', { timeout: 20000 }); await warte(300);
  return { k, s, fehlerListe };
}
// startet eine Partie; test: Inhalt von window.__test (null = echter Bot), intro: html[data-duell="laeuft"] vorher
async function starte(s, params, { test = 'schnell', intro = false } = {}) {
  await s.evaluate(({ params, test, intro }) => {
    localStorage.removeItem('schach-arena:v1:laufend');
    window.__test = test === 'schnell'
      ? { maxWarten: 0, botPause: 30, botZug: () => window.__partie.chess().moves({ verbose: true }).map((m) => m.lan).sort()[0] }
      : (test || { maxWarten: 0 });
    if (intro) { document.documentElement.dataset.duell = 'laeuft'; document.documentElement.dataset.duellMax = '6000'; }
    window.__app.gehe('partie', params);
  }, { params, test, intro });
  await s.waitForFunction(() => window.__partie && window.__partie.bereit === true && window.__partie.z.tempo, null, { timeout: 30000 });
}
async function zug(s, uci) {
  await s.waitForFunction(() => window.__partie.phase() === 'flo', null, { timeout: 30000 });
  for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) await s.locator(`${SCREEN} .brett-felder .feld[data-feld="${f}"]`).click();
  if (await s.locator(`${SCREEN} .brett .lage.vorschau`).count()) await s.locator(`${SCREEN} .brett-felder .feld[data-feld="${uci.slice(2, 4)}"]`).click();
}
const letztePartie = (s) => s.evaluate(async () => (await import('./js/storage.js')).ladePartien()[0] || null);
const warteEnde = (s, ms) => s.waitForFunction(() => window.__partie && window.__partie.phase() === 'ende', null, { timeout: ms });
// simuliert das Verlassen und Zurueckkommen der App (Tab im Hintergrund)
const sichtbar = (s, an) => s.evaluate((an) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (an ? 'visible' : 'hidden') });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => !an });
  document.dispatchEvent(new Event('visibilitychange'));
}, an);

const pw = ladePlaywright();
if (!pw) {
  ergebnisse.push(false);
  console.error('FEHLER Browser-Teil: Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
} else {
  const { browserTyp } = await import('./browser.mjs');
  const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
  BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
  const server = spawn(process.execPath, [path.join(WURZEL, 'tests', 'testserver.mjs'), String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
  let browser = null;
  try {
    await warteAufServer(`http://127.0.0.1:${PORT}/index.html`);
    browser = await browserTyp(pw).launch({ headless: true });
    const T3 = { grund: 180, zuschlag: 10 };

    await pruefe('Uhr steht waehrend des Intros, laeuft danach fuer die Seite am Zug', async () => {
      const { k, s } = await neueSeite(browser);
      try {
        await starte(s, { botId: 'benno', farbe: 'w', tempo: T3 }, { intro: true });
        await warte(1500);
        const vor = await leseUhr(s, 'flo');
        assert.ok(vor && vor.da, 'Uhr sichtbar');
        assert.equal(vor.text, '3:00', 'waehrend des Intros unveraendert');
        assert.equal(vor.laeuft, false, 'waehrend des Intros nicht laufend');
        await s.evaluate(() => { delete document.documentElement.dataset.duell; document.dispatchEvent(new Event('duell:fertig')); });
        await warte(2200);
        const nach = await leseUhr(s, 'flo');
        const bot = await leseUhr(s, 'bot');
        assert.equal(nach.laeuft, true, 'nach dem Intro laufend');
        assert.ok(nach.ms <= 178000, 'Zeit nimmt ab: ' + nach.text);
        assert.equal(bot.laeuft, false, 'Bot-Uhr steht');
        assert.equal(bot.text, '3:00');
      } finally { await k.close(); }
    });

    await pruefe('Zug: Zuschlag fuer den Ziehenden, danach laeuft die Bot-Uhr, solange der Bot denkt', async () => {
      const { k, s } = await neueSeite(browser);
      try {
        await starte(s, { botId: 'benno', farbe: 'w', tempo: T3 }, { test: { maxWarten: 0, botAnhalten: true } });
        await warte(1200);
        await zug(s, 'e2e4');
        await warte(1600);
        const flo = await leseUhr(s, 'flo');
        const bot = await leseUhr(s, 'bot');
        assert.ok(flo.ms >= 186000 && flo.ms <= 190000, 'Zuschlag 10 s: ' + flo.text);
        assert.equal(flo.laeuft, false, 'eigene Uhr steht nach dem Zug');
        assert.equal(bot.laeuft, true, 'Bot-Uhr laeuft beim Nachdenken');
        assert.ok(bot.ms <= 179000, 'Bot-Zeit nimmt ab: ' + bot.text);
      } finally { await k.close(); }
    });

    await pruefe('Zeitende: eigene Zeit abgelaufen = Niederlage, Grund zeit, Text nennt die Zeit', async () => {
      const { k, s, fehlerListe } = await neueSeite(browser);
      try {
        await starte(s, { botId: 'benno', farbe: 'w', tempo: { grund: 3, zuschlag: 0 } });
        await warteEnde(s, 10000);
        const p = await letztePartie(s);
        assert.ok(p, 'Partie gespeichert');
        assert.equal(p.ergebnis, 'niederlage'); assert.equal(p.grund, 'zeit');
        const text = await s.locator('.ergebnis-overlay').first().textContent();
        assert.match(text, /Zeit/, 'Ergebnistext: ' + text.slice(0, 120));
        assert.deepEqual(fehlerListe, []);
      } finally { await k.close(); }
    });

    await pruefe('Zeitende des Bots = Sieg', async () => {
      const { k, s } = await neueSeite(browser);
      try {
        await starte(s, { botId: 'benno', farbe: 'w', tempo: { grund: 3, zuschlag: 0 } }, { test: { maxWarten: 0, botAnhalten: true } });
        await zug(s, 'e2e4');
        await warteEnde(s, 10000);
        const p = await letztePartie(s);
        assert.equal(p.ergebnis, 'sieg'); assert.equal(p.grund, 'zeit');
      } finally { await k.close(); }
    });

    await pruefe('Zeitende: Remis, wenn der Gegner kein Mattmaterial hat (Koenig und Laeufer)', async () => {
      const { k, s } = await neueSeite(browser);
      try {
        await starte(s, { botId: 'benno', farbe: 'w', tempo: { grund: 3, zuschlag: 0 }, startFen: '4kb2/8/8/8/8/8/8/3QK3 w - - 0 1' });
        await warteEnde(s, 10000);
        const p = await letztePartie(s);
        assert.equal(p.ergebnis, 'remis'); assert.equal(p.grund, 'zeit');
      } finally { await k.close(); }
    });

    for (const [name, params, laeuftWeiter] of [
      ['Hintergrund: Bot-Partie haelt die Uhr an', { botId: 'benno', farbe: 'w', tempo: T3 }, false],
      ['Hintergrund: gewertete KI-Partie laeuft weiter wie online', { botId: 'benno', farbe: 'w', tempo: T3, ki: true, kiRef: KI_REF }, true],
    ]) {
      await pruefe(name, async () => {
        const { k, s } = await neueSeite(browser);
        try {
          await starte(s, params);
          await warte(800);
          const a = await leseUhr(s, 'flo');
          await sichtbar(s, false);
          await warte(3500);
          await sichtbar(s, true);
          await warte(300);
          const b = await leseUhr(s, 'flo');
          const weg = a.ms - b.ms;
          if (laeuftWeiter) assert.ok(weg >= 3000, `weiter gelaufen: ${a.text} -> ${b.text}`);
          else assert.ok(weg <= 1500, `angehalten: ${a.text} -> ${b.text}`);
          assert.equal(b.laeuft, true, 'laeuft nach der Rueckkehr');
        } finally { await k.close(); }
      });
    }

    for (const [name, params, wanduhr] of [
      ['Fortsetzen Bot-Partie: die Zeit, in der die App zu war, zaehlt nicht', { botId: 'benno', farbe: 'w', tempo: T3 }, false],
      ['Fortsetzen gewertete KI-Partie: die Zeit, in der die App zu war, zaehlt (Wanduhr)', { botId: 'benno', farbe: 'w', tempo: T3, ki: true, kiRef: KI_REF }, true],
    ]) {
      await pruefe(name, async () => {
        const { k, s } = await neueSeite(browser);
        try {
          await starte(s, params);
          await zug(s, 'e2e4');
          await s.waitForFunction(() => window.__partie.phase() === 'flo' && window.__partie.chess().history().length === 2, null, { timeout: 15000 });
          await warte(1500);
          const a = await leseUhr(s, 'flo');
          const zu = Date.now();
          await s.goto('about:blank');
          await warte(4000);
          await s.goto(`${BASIS}#arena`);
          await s.waitForSelector('.screen.arena', { timeout: 20000 }); await warte(300);
          await s.evaluate(() => { window.__test = { maxWarten: 0, botPause: 30 }; window.__app.gehe('partie', { fortsetzen: true }); });
          await s.waitForFunction(() => window.__partie && window.__partie.bereit === true && window.__partie.chess().history().length === 2, null, { timeout: 30000 });
          await warte(300);
          const b = await leseUhr(s, 'flo');
          const zuMs = Date.now() - zu;
          const weg = a.ms - b.ms;
          assert.equal(b.laeuft, true, 'eigene Uhr laeuft nach dem Fortsetzen');
          if (wanduhr) assert.ok(weg >= zuMs - 1500, `Wanduhr: ${a.text} -> ${b.text}, zu ${zuMs} ms`);
          else assert.ok(weg <= 2500, `angehalten: ${a.text} -> ${b.text}, zu ${zuMs} ms`);
          const bot = await leseUhr(s, 'bot');
          assert.ok(bot.ms >= 180000, 'Bot-Uhr mit Zuschlag nach seinem Zug: ' + bot.text);
        } finally { await k.close(); }
      });
    }

    // Kaltreview F3: Hauptfaden bis nach dem Ablauf belegt (kein Takt), dann der Zug im selben Abschnitt
    await pruefe('Zug nach Ablauf ohne Takt: nicht gebucht, Niederlage mit Grund zeit', async () => {
      const { k, s } = await neueSeite(browser);
      try {
        await starte(s, { botId: 'benno', farbe: 'w', tempo: { grund: 2, zuschlag: 10 } });
        await s.waitForFunction(() => window.__partie.phase() === 'flo', null, { timeout: 15000 });
        await s.waitForFunction(() => document.querySelector('.screen.partie .uhr[data-wer="flo"]')?.classList.contains('laeuft'), null, { timeout: 10000 });
        const angenommen = await s.evaluate(() => {
          const bis = Date.now() + 2600;
          while (Date.now() < bis) { /* Hauptfaden belegt */ }
          return window.__partie.brett.beiZug('e2', 'e4');
        });
        assert.equal(angenommen, false, 'Zug nach Ablauf angenommen');
        await warteEnde(s, 5000);
        assert.equal(await s.evaluate(() => window.__partie?.chess().history().length ?? 0), 0, 'kein Zug gebucht');
        const p = await letztePartie(s);
        assert.equal(p.ergebnis, 'niederlage'); assert.equal(p.grund, 'zeit');
      } finally { await k.close(); }
    });

    // Kaltreview F1/F2: veraenderter oder alter Speicherstand der gewerteten Partie bringt keine Zeit zurueck
    // Flo laesst sich 7 s Zeit fuer den ersten Zug, bei 3+2 also 5 s mehr als der Zuschlag: ein verlorener Wert, der als
    // Zuschlag zaehlt, braechte genau diese 5 s zurueck (Fix-Review f1, mit 3+10 und 4 s war das unsichtbar). Die Wanduhr
    // laeuft in der gewerteten Partie weiter, also muss die Zeit mindestens um die geschlossene Zeit sinken
    const T32 = { grund: 180, zuschlag: 2 };
    for (const [name, aendere, ungewertet] of [
      ['Fortsetzen gewertet, ein zeiten-Wert ungueltig: kein Zeitgewinn', (l) => { l.zeiten[0] = -1; }],
      ['Fortsetzen gewertet, zeiten fehlen: kein Zeitgewinn', (l) => { delete l.zeiten; }],
      ['Fortsetzen gewertet, uhr fehlt: der laufende Zug zaehlt trotzdem (Wanduhr)', (l) => { delete l.uhr; }],
      // Kaltreview 64 Befund 1: zeiten verworfen, aber kein unbekannter Eintrag von Flo, der den Rest aufnimmt
      ['Fortsetzen gewertet, ein zeiten-Eintrag zu viel und uhr fehlt: kein Zeitgewinn', (l) => { l.zeiten.push(0); delete l.uhr; }],
      ['Fortsetzen gewertet, Bot-Eintrag ungueltig und uhr fehlt: kein Zeitgewinn', (l) => { l.zeiten[1] = -1; delete l.uhr; }],
      // Fix-Review 64 (e99973a): uhr.seit in der Zukunft liess den laufenden Zug nichts kosten (Probe E) bzw. buchte Flo mit
      // einem unbekannten Eintrag die ganze Spanne bis dorthin (Probe F)
      ['Fortsetzen gewertet, uhr.seit in der Zukunft: kein Zeitgewinn', (l) => { l.uhr.seit = Date.now() + 3600e3; }],
      ['Fortsetzen gewertet, uhr.seit in der Zukunft und ein zeiten-Wert ungueltig: kein Zeitgewinn',
        (l) => { l.uhr.seit = Date.now() + 3600e3; l.zeiten[0] = -1; }],
      // Fix-Review 64 (c76e18e): uhr.seit zwischen Start und Zugbeginn buchte die gebuchten Zuege noch einmal (Probe H, 11 s
      // Abzug bei 3,7 s Pause); die Obergrenze unten faengt das
      ['Fortsetzen gewertet, uhr.seit = Start der Partie: kein Abzug ueber die Pause', (l) => { l.uhr.seit = Date.parse(l.gestartet); }],
      // Fix-Review 64 (c76e18e), Proben I/J: ungewertet ohne gueltiges uhr.verbraucht zaehlte der laufende Zug 0 (Zeitgewinn)
      ['Fortsetzen ungewertet, uhr fehlt: kein Zeitgewinn', (l) => { delete l.uhr; }, true],
      ['Fortsetzen ungewertet, uhr.verbraucht negativ: kein Zeitgewinn', (l) => { l.uhr.verbraucht = -999999; }, true],
      // Fix-Review 07 (ab98f60), Entscheid Hauptfenster 16.11.: auch ungewertet zaehlte ein kaputter Eintrag 0 (Zeitgewinn)
      ['Fortsetzen ungewertet, ein zeiten-Wert ungueltig: kein Zeitgewinn', (l) => { l.zeiten[0] = -1; }, true],
    ]) {
      await pruefe(name, async () => {
        const { k, s } = await neueSeite(browser);
        try {
          await starte(s, ungewertet ? { botId: 'benno', farbe: 'w', tempo: T32 } : { botId: 'benno', farbe: 'w', tempo: T32, ki: true, kiRef: KI_REF });
          await warte(7000);
          await zug(s, 'e2e4');
          await s.waitForFunction(() => window.__partie.phase() === 'flo' && window.__partie.chess().history().length === 2, null, { timeout: 15000 });
          await warte(1500);
          const a = await leseUhr(s, 'flo');
          const zu = Date.now();
          await s.goto('about:blank');
          await s.goto(`${BASIS}#arena`);
          await s.waitForSelector('.screen.arena', { timeout: 20000 });
          await s.evaluate((quelle) => {
            const l = JSON.parse(localStorage.getItem('schach-arena:v1:laufend'));
            (0, eval)(quelle)(l);
            localStorage.setItem('schach-arena:v1:laufend', JSON.stringify(l));
          }, String(aendere));
          await warte(3000);
          await s.evaluate(() => { window.__test = { maxWarten: 0, botPause: 30 }; window.__app.gehe('partie', { fortsetzen: true }); });
          await s.waitForFunction(() => window.__partie && window.__partie.bereit === true && window.__partie.chess().history().length === 2, null, { timeout: 30000 });
          await warte(300);
          const b = await leseUhr(s, 'flo');
          const zuMs = Date.now() - zu;
          // ungewertet steht die Uhr, solange die App zu ist: kein Gewinn heisst hier nur, die Zeit steigt nicht
          if (ungewertet) assert.ok(a.ms - b.ms >= -300, `ungewertet kein Gewinn: ${a.text} -> ${b.text}`);
          else assert.ok(a.ms - b.ms >= zuMs - 1500, `kein Gewinn: ${a.text} -> ${b.text}, zu ${zuMs} ms`);
          // und nicht weit mehr als die geschlossene Zeit (Fix-Review 64, Probe F: 172 s weg; Probe H: 11 s bei 3,7 s)
          assert.ok(a.ms - b.ms <= zuMs + 5000, `kein Verlust weit ueber die Pause: ${a.text} -> ${b.text}, zu ${zuMs} ms`);
        } finally { await k.close(); }
      });
    }

    // Fix-Review c8 (ce3d308): Geraeteuhr eine Stunde zurueck (gestartet und uhr.seit in der Zukunft) plus ein unbekannter
    // Eintrag von Flo. js/storage.js setzt gestartet dann auf jetzt, die Wanduhr seit Start ist 0, und der laufende Zug
    // verlor sein gueltiges uhr.verbraucht: die ganze Denkzeit kam zurueck (Probe c8: 2:45 -> 3:02, +17 s).
    // Vertrag (Entscheid Hauptfenster 16.11.2026, rueckholbar): der verlorene Eintrag kostet genau den Zuschlag (netto 0,
    // seinen echten Wert kennt nach dem Rueckschritt niemand), verbraucht bleibt verbraucht, sonst kein Gewinn und keine
    // Strafe. Erwartet ist also: Flos Uhr steigt genau um den echten Wert des verlorenen Eintrags minus den Zuschlag.
    // die Aenderung laeuft als Quelltext in der Seite (String(aendere)), darum steht der Rueckschritt in jeder Zeile selbst
    for (const [name, aendere, ungewertet] of [
      ['Uhr zurueck, ungewertet, alle Eintraege gueltig: Rest bleibt',
        (l) => { l.gestartet = new Date(Date.now() + 3600e3).toISOString(); l.uhr.seit = Date.now() + 3600e3; }, true],
      ['Uhr zurueck, ungewertet, zeiten[0] ungueltig: der laufende Zug behaelt verbraucht',
        (l) => { l.gestartet = new Date(Date.now() + 3600e3).toISOString(); l.uhr.seit = Date.now() + 3600e3; l.zeiten[0] = -1; }, true],
      ['Uhr zurueck, ungewertet, zeiten fehlen: der laufende Zug behaelt verbraucht',
        (l) => { l.gestartet = new Date(Date.now() + 3600e3).toISOString(); l.uhr.seit = Date.now() + 3600e3; delete l.zeiten; }, true],
      ['Uhr zurueck, gewertet, zeiten[0] ungueltig: der laufende Zug behaelt verbraucht',
        (l) => { l.gestartet = new Date(Date.now() + 3600e3).toISOString(); l.uhr.seit = Date.now() + 3600e3; l.zeiten[0] = -1; }, false],
    ]) {
      await pruefe(name, async () => {
        const { k, s } = await neueSeite(browser);
        try {
          await starte(s, ungewertet ? { botId: 'benno', farbe: 'w', tempo: T32 } : { botId: 'benno', farbe: 'w', tempo: T32, ki: true, kiRef: KI_REF });
          await warte(7000);
          await zug(s, 'e2e4');
          await s.waitForFunction(() => window.__partie.phase() === 'flo' && window.__partie.chess().history().length === 2, null, { timeout: 15000 });
          await warte(5000);
          const a = await leseUhr(s, 'flo');
          await s.goto('about:blank');
          await s.goto(`${BASIS}#arena`);
          await s.waitForSelector('.screen.arena', { timeout: 20000 });
          const vorher = await s.evaluate((quelle) => {
            const l = JSON.parse(localStorage.getItem('schach-arena:v1:laufend'));
            const v = { zeit0: l.zeiten[0], verbraucht: l.uhr.verbraucht };
            (0, eval)(quelle)(l);
            localStorage.setItem('schach-arena:v1:laufend', JSON.stringify(l));
            return v;
          }, String(aendere));
          await s.evaluate(() => { window.__test = { maxWarten: 0, botPause: 30 }; window.__app.gehe('partie', { fortsetzen: true }); });
          await s.waitForFunction(() => window.__partie && window.__partie.bereit === true && window.__partie.chess().history().length === 2, null, { timeout: 30000 });
          await warte(300);
          const b = await leseUhr(s, 'flo');
          const verloren = /ungueltig|fehlen/.test(name);
          // erwartet: verlorener Eintrag netto 0 (also + echter Wert - Zuschlag), alles andere wie vor dem Schliessen
          const erwartet = verloren ? vorher.zeit0 * 100 - T32.zuschlag * 1000 : 0;
          assert.ok(vorher.verbraucht >= 4000, `Probe braucht einen laufenden Zug mit verbraucht: ${JSON.stringify(vorher)}`);
          assert.ok(Math.abs((b.ms - a.ms) - erwartet) <= 1300,
            `${a.text} -> ${b.text}: Differenz ${b.ms - a.ms} ms, erwartet ${erwartet} ms (gespeichert ${JSON.stringify(vorher)})`);
        } finally { await k.close(); }
      });
    }

    // Fix-Review 07 (ab98f60): nach dem Fortsetzen fehlte der Teil des Zugs vor dem Schliessen im gespeicherten Stand; zweimal
    // zu und auf brachte ihn zurueck (Probe: 2:52 -> 2:56, zeiten[0] 1 s bei 12 s Denkzeit)
    const zuUndFort = async (s) => {
      await s.goto('about:blank');
      await s.goto(`${BASIS}#arena`);
      await s.waitForSelector('.screen.arena', { timeout: 20000 }); await warte(300);
      await s.evaluate(() => {
        window.__test = { maxWarten: 0, botPause: 30, botZug: () => window.__partie.chess().moves({ verbose: true }).map((m) => m.lan).sort()[0] };
        window.__app.gehe('partie', { fortsetzen: true });
      });
      await s.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 });
      await warte(400);
    };
    for (const [name, params] of [
      ['Zweimal fortsetzen, Bot-Partie: keine Zeit zurueck, der Zug bucht die ganze Denkzeit', { botId: 'benno', farbe: 'w', tempo: { grund: 180, zuschlag: 0 } }],
      ['Zweimal fortsetzen, gewertete KI-Partie: keine Zeit zurueck, der Zug bucht die ganze Denkzeit',
        { botId: 'benno', farbe: 'w', tempo: { grund: 180, zuschlag: 0 }, ki: true, kiRef: KI_REF }],
    ]) {
      await pruefe(name, async () => {
        const { k, s } = await neueSeite(browser);
        try {
          await starte(s, params);
          const t0 = Date.now();
          await warte(6000);
          await zuUndFort(s);
          const a1 = await leseUhr(s, 'flo');
          await warte(3000);
          await zuUndFort(s);
          const a2 = await leseUhr(s, 'flo');
          assert.ok(a2.ms <= a1.ms + 300, `ohne Zug kein Gewinn: ${a1.text} -> ${a2.text}`);
          assert.ok(a2.ms <= 180000 - 8500, `mindestens die gedachten 9 s weg: ${a2.text}`);
          await zug(s, 'e2e4');
          const gedacht = Date.now() - t0;
          await s.waitForFunction(() => window.__partie.phase() === 'flo' && window.__partie.chess().history().length === 2, null, { timeout: 15000 });
          const zeiten = await s.evaluate(() => window.__partie.z.zeiten.slice());
          assert.ok(zeiten[0] * 100 >= 8500, `zeiten[0] bucht die Denkzeit vor dem Fortsetzen: ${zeiten[0]} Zehntel`);
          assert.ok(zeiten[0] * 100 <= gedacht + 1000, `zeiten[0] nicht mehr als die Zeit seit dem Start: ${zeiten[0]} Zehntel, ${gedacht} ms`);
          await warte(500);
          const a3 = await leseUhr(s, 'flo');
          await zuUndFort(s);
          const a4 = await leseUhr(s, 'flo');
          assert.ok(a4.ms <= a3.ms + 300, `nach dem Zug kein Gewinn: ${a3.text} -> ${a4.text}`);
        } finally { await k.close(); }
      });
    }

    // Fix-Review 07 (ab98f60): gewertet lief die Wanduhr auch fuer den Bot, der bei geschlossener App nicht ziehen kann ->
    // Schliessen waehrend der Bot denkt gewann die Partie auf Zeit
    await pruefe('Gewertet, App zu waehrend der Bot denkt: kein Sieg auf Zeit, die Bot-Uhr stand', async () => {
      const { k, s } = await neueSeite(browser);
      try {
        await starte(s, { botId: 'benno', farbe: 'w', tempo: { grund: 10, zuschlag: 0 }, ki: true, kiRef: KI_REF }, { test: { maxWarten: 0, botAnhalten: true } });
        await zug(s, 'e2e4');
        await warte(500);
        const bot0 = await leseUhr(s, 'bot');
        await s.goto('about:blank');
        await warte(11000);
        await s.goto(`${BASIS}#arena`);
        await s.waitForSelector('.screen.arena', { timeout: 20000 }); await warte(300);
        await s.evaluate(() => { window.__test = { maxWarten: 0, botAnhalten: true }; window.__app.gehe('partie', { fortsetzen: true }); });
        await s.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 });
        await warte(800);
        assert.notEqual(await s.evaluate(() => window.__partie.phase()), 'ende', 'Partie endete beim Fortsetzen');
        const bot1 = await leseUhr(s, 'bot');
        assert.ok(bot1.ms >= bot0.ms - 2500, `Bot-Uhr lief nicht, solange die App zu war: ${bot0.text} -> ${bot1.text}`);
      } finally { await k.close(); }
    });

    await pruefe('Gewertet verdeckt: die Bot-Uhr steht, zieht der Bot verdeckt, laeuft Flos Uhr sofort weiter', async () => {
      const { k, s } = await neueSeite(browser);
      try {
        await starte(s, { botId: 'benno', farbe: 'w', tempo: { grund: 180, zuschlag: 0 }, ki: true, kiRef: KI_REF }, { test: { maxWarten: 0, botAnhalten: true } });
        await zug(s, 'e2e4');
        await warte(500);
        const bot0 = await leseUhr(s, 'bot');
        await sichtbar(s, false);
        await warte(3000);
        await sichtbar(s, true);
        await warte(300);
        const bot1 = await leseUhr(s, 'bot');
        assert.ok(bot0.ms - bot1.ms <= 1200, `Bot-Uhr stand verdeckt: ${bot0.text} -> ${bot1.text}`);
        assert.equal(bot1.laeuft, true, 'Bot-Uhr laeuft nach der Rueckkehr');
        // der Bot zieht verdeckt: Flos gewertete Uhr laeuft ab seinem Zug, auch verdeckt
        await sichtbar(s, false);
        // botAnhalten weg = der wartende Bot zieht (partie.js, Schleife vor dem Bot-Zug)
        await s.evaluate(() => {
          window.__test = { maxWarten: 0, botPause: 30, botZug: () => window.__partie.chess().moves({ verbose: true }).map((m) => m.lan).sort()[0] };
        });
        await s.waitForFunction(() => window.__partie.chess().history().length === 2, null, { timeout: 8000 });
        const f0 = await leseUhr(s, 'flo');
        await warte(3000);
        await sichtbar(s, true);
        await warte(300);
        const f1 = await leseUhr(s, 'flo');
        assert.ok(f0.ms - f1.ms >= 2500, `Flos Uhr lief verdeckt nach dem Bot-Zug: ${f0.text} -> ${f1.text}`);
      } finally { await k.close(); }
    });

    await pruefe('Bot-Zug haengt nicht an der Uhr (gleicher Seed, 3+2, 15+10, ohne Uhr)', async () => {
      const antworten = [];
      for (const tempo of [{ grund: 180, zuschlag: 2 }, { grund: 900, zuschlag: 10 }, undefined]) {
        const { k, s } = await neueSeite(browser);
        try {
          await s.evaluate(({ tempo }) => {
            localStorage.removeItem('schach-arena:v1:laufend');
            window.__test = { maxWarten: 0 };
            window.__app.gehe('partie', { botId: 'benno', farbe: 'w', seed: 4242, ...(tempo ? { tempo } : {}) });
          }, { tempo });
          await s.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 });
          await zug(s, 'e2e4');
          await s.waitForFunction(() => window.__partie.chess().history().length === 2, null, { timeout: 30000 });
          antworten.push(await s.evaluate(() => window.__partie.chess().history()[1]));
        } finally { await k.close(); }
      }
      assert.equal(new Set(antworten).size, 1, 'Antworten: ' + antworten.join(', '));
    });
  } catch (e) {
    ergebnisse.push(false); console.error('FEHLER Browser-Teil: ' + e.message);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

const ok = ergebnisse.filter(Boolean).length;
console.log(`\n${ok}/${ergebnisse.length + (U ? 0 : 1)} bestanden`);
process.exit(U && ok === ergebnisse.length ? 0 : 1);
