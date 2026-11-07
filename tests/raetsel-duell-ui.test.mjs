// Raetsel-Duell (Etappe 5), Browser-Teil: der Screen js/ui/raetsel-duell.js in der vollen App gegen einen
// nachgebauten Server (rpc duell_* und Edge Function raetsel-duell). Spielt ein Duell gegen den KI-Gegner bis zur
// Wertung (richtige Zuege, ein Raetsel mit Gegenantwort, Farbwechsel, ein falscher Zug mit 5 s Abzug, Stand des
// Gegners live), dazu Freundschaft per Link, falscher Code, ohne Konto und ohne Labor.
//   node tests/raetsel-duell-ui.test.mjs                    iPhone 390x844 hell und iPad 820x1180 dunkel
//   node tests/raetsel-duell-ui.test.mjs --bilder=<ordner>  dazu Bilder (iPhone und iPad, je hell und dunkel)
// Die echten Regeln (Zeit, Abzug, Wertung, Kronen) prueft tests/server-raetsel-duell.test.mjs gegen das SQL; hier
// geht es nur darum, dass der Screen zeigt, was der Server sagt.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8944);
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const bilderArg = process.argv.find((a) => a.startsWith('--bilder='));
const BILDER = bilderArg ? bilderArg.slice(9) : null;
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0; let fehler = 0; let gruppe = '';
function pruefe(name, wert, info = '') {
  const n = (gruppe ? gruppe + ': ' : '') + name;
  if (wert) { ok++; console.log('ok   ' + n); } else { fehler++; console.log('FEHLER ' + n + ' ' + (typeof info === 'string' ? info : JSON.stringify(info))); }
}

async function warteAufServer(url, ms = 10000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    // den Rumpf ganz lesen: ein offen gelassener Rumpf bringt undici unter Windows zum Absturz (assert !this.paused)
    try { const r = await fetch(url); await r.arrayBuffer(); if (r.ok) return; } catch (e) { /* noch nicht da */ }
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
const DUELL = '7d0c9a52-1b3e-4f6a-9c8d-2e1f0a9b8c7d';

// Raetsel wie duell_raetsel_anzeige: fen vor dem eigenen Zug, loesung im UCI-Format (eigener Zug, Antwort, eigener Zug ...)
const RAETSEL = [
  { fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', loesung: ['a1a8'], rating: 700 },              // Grundreihenmatt
  { fen: '1r4k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1', loesung: ['b8b1'], rating: 760 },             // Schwarz am Zug
  { fen: '7k/8/R7/1R6/8/8/8/K7 w - - 0 1', loesung: ['b5b7', 'h8g8', 'a6a8'], rating: 820 },    // mit Gegenantwort
  { fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', loesung: ['a1a8'], rating: 880 },              // hier faellt der Fehler
  { fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', loesung: ['a1a8'], rating: 940 },
];

// Nachgebauter Server: ein Duell, Zeit nach der Uhr dieses Prozesses (die Seite rechnet den Versatz selbst aus)
function neuerServer({ art = 'ki', vorlaufMs = 1200 } = {}) {
  const srv = { art, start: null, idx: 0, schritt: 0, geloest: 0, fehler: 0, zuege: 0, beendet: false, aufrufe: [] };
  const iso = (ms) => new Date(ms).toISOString();
  srv.anlegen = () => { srv.start = Date.now() + vorlaufMs; };
  const endeAm = () => srv.start + 180000 - srv.fehler * 5000;
  const anzeige = () => {
    const r = RAETSEL[srv.idx];
    return r ? { nr: srv.idx + 1, fen: r.fen, bisher: r.loesung.slice(0, srv.schritt), rating: r.rating } : null;
  };
  // der KI-Gegner loest alle 1,5 s eins (der echte Verlauf kommt aus duell_ki_verlauf)
  const kiGeloest = () => Math.max(0, Math.floor((Date.now() - srv.start) / 1500));
  srv.stand = () => {
    if (!srv.start) return { fehler: 'DUELL_UNBEKANNT' };
    const g = srv.art === 'ki' ? Math.min(2, kiGeloest()) : 1;
    const st = {
      duell: DUELL, art: srv.art, status: srv.beendet ? 'beendet' : 'laeuft', jetzt: iso(Date.now()), start_am: iso(srv.start),
      ich: { geloest: srv.geloest, fehler: srv.fehler, ende_am: iso(endeAm()) },
      gegner: { geloest: g, fehler: 0, ende_am: iso(srv.start + 180000), ki: srv.art === 'ki', elo: srv.art === 'ki' ? 1200 : null },
      raetsel: srv.beendet ? null : anzeige(),
    };
    if (srv.beendet) {
      st.ergebnis = srv.geloest > g ? 'sieg' : srv.geloest < g ? 'niederlage' : 'remis';
      st.kronen_delta = srv.art === 'freundschaft' ? null : { sieg: 20, remis: 5, niederlage: -10 }[st.ergebnis];
    }
    return st;
  };
  srv.zug = (zug) => {
    if (Date.now() < srv.start) return { status: 409, body: { fehler: 'DUELL_NICHT_GESTARTET', detail: 'DUELL_NICHT_GESTARTET' } };
    const r = RAETSEL[srv.idx];
    srv.zuege++;
    const richtig = zug === r.loesung[srv.schritt];
    let fertig = false;
    if (richtig) {
      srv.schritt += 2;
      if (srv.schritt >= r.loesung.length) { fertig = true; srv.geloest++; srv.idx++; srv.schritt = 0; }
    } else { srv.fehler++; srv.idx++; srv.schritt = 0; }
    return { status: 200, body: { richtig, fertig, idx: srv.idx, schritt: srv.schritt, geloest: srv.geloest, fehler: srv.fehler, ende_am: iso(endeAm()), naechstes: anzeige() } };
  };
  return srv;
}

// rpc(name, daten) beantwortet /rest/v1/rpc/<name>; Edge Function /functions/v1/raetsel-duell geht an srv.zug
async function seite(browser, { breite, hoehe, schema = 'light', hash = 'raetsel-duell', angemeldet = true, erfinder = true, srv = null, rpc = null }) {
  const k = await browser.newContext({ viewport: { width: breite, height: hoehe }, serviceWorkers: 'block', hasTouch: true, colorScheme: schema, deviceScaleFactor: 1 });
  const s = await k.newPage();
  const fehlerListe = [];
  const aufrufe = [];
  s.on('pageerror', (e) => fehlerListe.push(e.message));
  s.on('console', (m) => { if (m.type() === 'error' && !/status of 409/.test(m.text())) fehlerListe.push('konsole: ' + m.text()); });
  await s.route(SUPA + '/**', (r) => {
    const url = r.request().url();
    let daten = null;
    try { daten = r.request().postDataJSON(); } catch (e) { /* ohne Rumpf */ }
    if (url.includes('/functions/v1/raetsel-duell')) {
      aufrufe.push({ name: 'zug', daten, um: Date.now() });
      const a = srv.zug(daten && daten.zug);
      return r.fulfill({ status: a.status, contentType: 'application/json', body: JSON.stringify(a.body) });
    }
    const name = (url.match(/\/rest\/v1\/rpc\/([a-z_]+)/) || [])[1];
    if (name) {
      aufrufe.push({ name, daten, um: Date.now() });
      const antwort = rpc ? rpc(name, daten) : undefined;
      if (antwort !== undefined) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(antwort) });
      if (name === 'duell_stand' && srv) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(srv.stand()) });
      return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    return r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(url.includes('sonderstuecke') && erfinder ? [{ stueck_id: 'erfinder-titel' }] : []) });
  });
  await s.addInitScript(({ sitzung, uid, erfinder, angemeldet }) => {
    try {
      window.__duellKiMs = 400;
      window.__duellAbfrageMs = 250;
      if (sessionStorage.getItem('probe-start')) return;
      sessionStorage.setItem('probe-start', '1');
      localStorage.clear();
      if (angemeldet) localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
      if (erfinder) localStorage.setItem('schach-arena:konto:sonderstuecke', JSON.stringify({ konto: uid, ids: ['erfinder-titel'] }));
    } catch (e) { /* egal */ }
  }, { sitzung: SITZUNG, uid: UID, erfinder, angemeldet });
  await s.goto(`${BASIS}#${hash}`);
  return { k, s, fehlerListe, aufrufe };
}

async function tippe(s, feld) {
  const b = await s.locator(`.screen.raetsel-duell .rd-brett .feld[data-feld="${feld}"]`).boundingBox();
  await s.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await warte(120);
}
async function zieh(s, uci) { await tippe(s, uci.slice(0, 2)); await tippe(s, uci.slice(2, 4)); }
const geloest = (s, wer) => s.locator(`.rd-seite[data-wer="${wer}"] .rd-geloest`).innerText();
async function warteBis(s, fn, arg, ms = 6000) { await s.waitForFunction(fn, arg, { timeout: ms }); }
const bildName = (geraet, schema, teil) => `raetsel-duell-${geraet}-${schema === 'dark' ? 'dunkel' : 'hell'}-${teil}`;
async function bild(s, name) { if (BILDER) await s.screenshot({ path: path.join(BILDER, name + '.png') }); }

// Geometrie, die in jedem Zustand gelten muss: nichts breiter als das Fenster, Tippflaechen ab 44 px
const geometrie = (s) => s.evaluate(() => ({
  breit: document.documentElement.scrollWidth <= innerWidth + 1,
  klein: [...document.querySelectorAll('.screen.raetsel-duell .rd-rumpf button, .screen.raetsel-duell .rd-rumpf input')]
    .filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44).map((e) => e.className),
}));

async function duellGegenKi(browser, { geraet, breite, hoehe, schema }) {
  gruppe = `KI-Duell ${geraet} ${schema === 'dark' ? 'dunkel' : 'hell'}`;
  const srv = neuerServer();
  const p = await seite(browser, { breite, hoehe, schema, srv, rpc: (name, daten) => {
    if (name === 'duell_suche_start' || name === 'duell_suche_stand') return {};
    if (name === 'duell_suche_ende') { if (daten && daten.ki === true) { srv.anlegen(); return { duell: DUELL }; } return {}; }
    return undefined;
  } });
  const { s } = p;
  try {
    await s.waitForSelector('.screen.raetsel-duell[data-phase="start"] .rd-suchen', { timeout: 30000 });
    await warte(400);
    const start = await s.evaluate(() => ({
      titel: document.querySelector('.screen.raetsel-duell .haupt-kopf')?.textContent || '',
      regeln: document.querySelectorAll('.rd-regeln li').length, hash: location.hash,
      reiter: document.querySelector('.reiter-leiste .reiter[aria-current="page"]')?.dataset.reiter || null,
    }));
    const g0 = await geometrie(s);
    pruefe('Start: Titel, drei Regeln, Hash #raetsel-duell, Reiter Heim, nichts breiter, Tippflaechen ab 44 px',
      /Rätsel-Duell/.test(start.titel) && start.regeln === 3 && start.hash === '#raetsel-duell' && g0.breit && g0.klein.length === 0, { ...start, ...g0 });
    await bild(s, bildName(geraet, schema, '1-start'));

    await s.locator('.rd-suchen').click();
    await s.waitForSelector('.screen.raetsel-duell[data-phase="suche"] .rd-abbrechen', { timeout: 3000 });
    pruefe('Suche: Radar und Abbrechen, Fokus auf Abbrechen', await s.evaluate(() => !!document.querySelector('.rd-radar') && document.activeElement?.classList.contains('rd-abbrechen')));
    await bild(s, bildName(geraet, schema, '2-suche'));

    // nach der (verkuerzten) Wartezeit legt der Server das KI-Duell an; vorher Vorlauf ohne Zuege
    await s.waitForSelector('.screen.raetsel-duell[data-phase="vorlauf"] .rd-brett .feld', { timeout: 5000 });
    // nur die Duell-Aufrufe: andere Pakete (Sammlung: karte_melde_stufen) melden beim Start eigenes
    const namen = p.aufrufe.map((a) => a.name).filter((n) => /^duell_/.test(n));
    pruefe('Suche: erst duell_suche_start, dann nach der Wartezeit duell_suche_ende mit ki true',
      namen[0] === 'duell_suche_start' && p.aufrufe.some((a) => a.name === 'duell_suche_ende' && a.daten && a.daten.ki === true), namen.slice(0, 6));
    await warteBis(s, () => document.querySelector('.rd-seite[data-wer="gegner"] .rd-name')?.textContent.length > 0);
    const kopf = await s.evaluate(() => ({ name: document.querySelector('.rd-seite[data-wer="gegner"] .rd-name').textContent,
      ki: document.querySelector('.rd-seite[data-wer="gegner"]').dataset.ki, uhr: document.querySelector('.rd-uhr').textContent,
      ganz: (() => { const n = document.querySelector('.rd-seite[data-wer="gegner"] .rd-name'); return n.scrollWidth <= n.clientWidth + 1; })() }));
    pruefe('Vorlauf: Gegner klar als KI-Gegner markiert (mit Staerke, nicht abgeschnitten), Uhr steht bei 3:00',
      kopf.name === 'KI-Gegner · 1200' && kopf.ki === 'ja' && kopf.ganz && kopf.uhr === '3:00', kopf);

    await s.waitForSelector('.screen.raetsel-duell[data-phase="laeuft"]', { timeout: 5000 });
    await warteBis(s, () => document.querySelector('.rd-nr')?.textContent.length > 0);
    pruefe('Laeuft: Raetsel 1, Weiss am Zug, Brett von Weiss aus', await s.evaluate(() => document.querySelector('.screen.raetsel-duell').dataset.seite === 'w'
      && /1/.test(document.querySelector('.rd-nr').textContent) && /Weiß/.test(document.querySelector('.rd-amzug').textContent)));

    // 1: richtig (Matt in einem)
    await zieh(s, 'a1a8');
    await warteBis(s, () => /^1 /.test(document.querySelector('.rd-seite[data-wer="ich"] .rd-geloest').textContent));
    pruefe('Raetsel 1 geloest: Zaehler 1, Meldung richtig', await s.locator('.rd-meldung').getAttribute('data-art') === 'richtig');

    // 2: Schwarz am Zug, das Brett dreht sich
    await warteBis(s, () => document.querySelector('.screen.raetsel-duell').dataset.seite === 'b');
    pruefe('Raetsel 2: Schwarz am Zug, Brett von Schwarz aus', /Schwarz/.test(await s.locator('.rd-amzug').innerText()));
    await zieh(s, 'b8b1');
    await warteBis(s, () => /^2 /.test(document.querySelector('.rd-seite[data-wer="ich"] .rd-geloest').textContent));

    // 3: mit Gegenantwort (erst Turm nach b7, der Server antwortet Kg8, dann Matt)
    await warteBis(s, () => document.querySelector('.screen.raetsel-duell').dataset.seite === 'w' && /3/.test(document.querySelector('.rd-nr').textContent));
    await zieh(s, 'b5b7');
    await warteBis(s, () => document.querySelector('.rd-meldung')?.dataset.art === 'richtig' && !!document.querySelector('.rd-brett img.figur[data-feld="g8"]'));
    pruefe('Raetsel 3: Zwischenzug richtig, Gegenantwort Kg8 steht, noch nicht geloest',
      /^2 /.test(await geloest(s, 'ich')) && await s.locator('.rd-meldung').innerText() === 'Gut, weiter so');
    await bild(s, bildName(geraet, schema, '3-duell'));
    await zieh(s, 'a6a8');
    await warteBis(s, () => /^3 /.test(document.querySelector('.rd-seite[data-wer="ich"] .rd-geloest').textContent));

    // 4: falscher Zug kostet 5 s und fuehrt zum naechsten Raetsel
    await warteBis(s, () => /4/.test(document.querySelector('.rd-nr').textContent));
    const vorher = await s.evaluate(() => { const [m, x] = document.querySelector('.rd-uhr').textContent.split(':').map(Number); return m * 60 + x; });
    await zieh(s, 'a1a2');
    await warteBis(s, () => document.querySelector('.rd-meldung')?.dataset.art === 'falsch');
    await warte(400);
    const nachFehler = await s.evaluate(() => {
      const [m, x] = document.querySelector('.rd-uhr').textContent.split(':').map(Number);
      return { sek: m * 60 + x, fehler: document.querySelector('.rd-seite[data-wer="ich"] .rd-fehlerzahl').textContent,
        text: document.querySelector('.rd-meldung').textContent, nr: document.querySelector('.rd-nr').textContent };
    });
    pruefe('Falscher Zug: 1 Fehler, Uhr springt um 5 s zurueck, Meldung nennt den Abzug, Raetsel 5 kommt',
      nachFehler.fehler === '1 Fehler' && vorher - nachFehler.sek >= 5 && vorher - nachFehler.sek <= 7 && /5 Sekunden/.test(nachFehler.text) && /5/.test(nachFehler.nr), { vorher, ...nachFehler });
    pruefe('Zuege an die Edge Function: nur { duell, zug }, nie Zeit oder Ergebnis vom Geraet',
      p.aufrufe.filter((a) => a.name === 'zug').every((a) => Object.keys(a.daten).sort().join() === 'duell,zug' && a.daten.duell === DUELL)
      && p.aufrufe.filter((a) => a.name === 'zug').map((a) => a.daten.zug).join() === 'a1a8,b8b1,b5b7,a6a8,a1a2', p.aufrufe.filter((a) => a.name === 'zug').map((a) => a.daten.zug));

    // Gegner live: der KI-Gegner hat inzwischen geloest, sein Balken waechst
    await warteBis(s, () => /^2 /.test(document.querySelector('.rd-seite[data-wer="gegner"] .rd-geloest').textContent));
    const live = await s.evaluate(() => {
      const t = (w) => getComputedStyle(document.querySelector(`.rd-seite[data-wer="${w}"] .rd-balken > i`)).transform;
      return { ich: t('ich'), gegner: t('gegner') };
    });
    pruefe('Gegner live: Stand des KI-Gegners kommt an, beide Balken gefuellt', live.ich !== 'none' && live.gegner !== 'none', live);
    const g1 = await geometrie(s);
    const brett = await s.evaluate(() => {
      const b = document.querySelector('.rd-brett').getBoundingClientRect();
      const l = document.querySelector('.rd-leiste').getBoundingClientRect();
      const z = document.querySelector('.rd-zeile').getBoundingClientRect();
      return { b: Math.round(b.width), quadrat: Math.abs(b.width - b.height) < 2, unterLeiste: b.top >= l.bottom - 1, zeileSichtbar: z.bottom <= innerHeight + 1 };
    });
    pruefe('Duell: Brett quadratisch unter der Leiste, Zeile sichtbar ohne Scrollen, nichts breiter',
      brett.quadrat && brett.unterLeiste && brett.zeileSichtbar && brett.b >= Math.min(breite - 40, 300) && g1.breit, { ...brett, ...g1 });

    // Ende: der Server wertet aus
    srv.beendet = true;
    await s.waitForSelector('.screen.raetsel-duell[data-phase="beendet"] .rd-ende', { timeout: 5000 });
    await warte(500);
    const ende = await s.evaluate(() => ({ erg: document.querySelector('.rd-ende').dataset.ergebnis, titel: document.querySelector('.rd-ende h2').textContent,
      stand: document.querySelector('.rd-ende-stand').textContent, kronen: document.querySelector('.rd-ende .rd-text').textContent,
      fokus: document.activeElement?.classList.contains('rd-nochmal') }));
    pruefe('Ende: Gewonnen 3 zu 2, +20 Kronen, Fokus auf Nochmal', ende.erg === 'sieg' && ende.titel === 'Gewonnen' && ende.stand === '3 zu 2 gelöst'
      && ende.kronen === '+20 Kronen' && ende.fokus, ende);
    const g2 = await geometrie(s);
    pruefe('Ende: nichts breiter, Tippflaechen ab 44 px', g2.breit && g2.klein.length === 0, g2);
    await bild(s, bildName(geraet, schema, '4-ende'));
    const nachEnde = p.aufrufe.length;
    await warte(900);
    pruefe('Nach dem Ende keine weiteren Abfragen', p.aufrufe.length === nachEnde, p.aufrufe.slice(nachEnde).map((a) => a.name));
    pruefe('Keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
  } catch (e) {
    // fuer die Fehlersuche: was beim Server ankam und was der Screen zeigt
    console.log('  Zuege: ' + p.aufrufe.filter((a) => a.name === 'zug').map((a) => a.daten && a.daten.zug).join() + ' | Seitenfehler: ' + p.fehlerListe.join(' | '));
    console.log('  Screen: ' + await s.evaluate(() => JSON.stringify({ phase: document.querySelector('.screen.raetsel-duell')?.dataset.phase,
      zeile: document.querySelector('.rd-zeile')?.textContent, ich: document.querySelector('.rd-seite[data-wer="ich"]')?.textContent })).catch(() => '?'));
    throw e;
  } finally { await p.k.close(); }
}

async function nebenwege(browser) {
  // Freundschaft per Link: #raetsel-duell/CODE tritt von selbst bei, Gegner heisst Freund, Ende ohne Kronen
  {
    gruppe = 'Freundschaft per Link';
    const srv = neuerServer({ art: 'freundschaft', vorlaufMs: 300 });
    const p = await seite(browser, { breite: 390, hoehe: 844, hash: 'raetsel-duell/ABC234', srv, rpc: (name, daten) => {
      if (name === 'duell_beitreten') { if (daten && daten.code === 'ABC234') { srv.anlegen(); return { duell: DUELL }; } return { fehler: 'DUELL_CODE' }; }
      return undefined;
    } });
    try {
      await p.s.waitForSelector('.screen.raetsel-duell[data-phase="laeuft"]', { timeout: 30000 });
      await warteBis(p.s, () => document.querySelector('.rd-seite[data-wer="gegner"] .rd-name')?.textContent.length > 0);
      const x = await p.s.evaluate(() => ({ name: document.querySelector('.rd-seite[data-wer="gegner"] .rd-name').textContent,
        ki: document.querySelector('.rd-seite[data-wer="gegner"]').dataset.ki }));
      pruefe('Link tritt mit dem Code bei, Gegner heisst Freund, kein KI-Schild',
        p.aufrufe.some((a) => a.name === 'duell_beitreten' && a.daten.code === 'ABC234') && x.name === 'Freund' && x.ki === 'nein', x);
      await zieh(p.s, 'a1a8');
      await warteBis(p.s, () => /^1 /.test(document.querySelector('.rd-seite[data-wer="ich"] .rd-geloest').textContent));
      srv.beendet = true;
      await p.s.waitForSelector('.rd-ende', { timeout: 5000 });
      const e = await p.s.evaluate(() => ({ erg: document.querySelector('.rd-ende').dataset.ergebnis, kronen: document.querySelector('.rd-ende .rd-text').textContent }));
      pruefe('Ende der Freundschaft: Unentschieden 1 zu 1, ohne Wertung', e.erg === 'remis' && e.kronen === 'Freundschaft, ohne Wertung', e);
      await p.s.locator('.rd-nochmal').click();
      await p.s.waitForSelector('.screen.raetsel-duell[data-phase="start"]', { timeout: 3000 });
      pruefe('Nochmal nach Freundschaft fuehrt zum Start, nicht in die gewertete Suche', !p.aufrufe.some((a) => a.name === 'duell_suche_start'));
      pruefe('Keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
    } finally { await p.k.close(); }
  }
  // Falscher Code: verstaendliche Meldung, Eingabe bleibt
  {
    gruppe = 'Falscher Code';
    const p = await seite(browser, { breite: 390, hoehe: 844, srv: neuerServer(), rpc: (name) => (name === 'duell_beitreten' ? { fehler: 'DUELL_CODE' } : undefined) });
    try {
      await p.s.waitForSelector('.screen.raetsel-duell[data-phase="start"] #rd-code-feld', { timeout: 30000 });
      await p.s.locator('#rd-code-feld').fill('ZZZ999');
      await p.s.locator('.rd-beitreten').click();
      await p.s.waitForSelector('.rd-fehler:not([hidden])', { timeout: 3000 });
      pruefe('Meldung: Code passt zu keinem offenen Duell', /passt zu keinem offenen Duell/.test(await p.s.locator('.rd-fehler').innerText()));
      pruefe('Keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
    } finally { await p.k.close(); }
  }
  // Ohne Konto: Hinweis und Weg zum Konto, keine Serveraufrufe
  {
    gruppe = 'Ohne Konto';
    const p = await seite(browser, { breite: 390, hoehe: 844, angemeldet: false, erfinder: true });
    try {
      // Solange das Duell im Labor steckt, ist es ohne Konto nie frei (das Labor braucht das Erfinder-Konto). Die
      // Ansicht "konto" (Hinweis mit Knopf) greift erst, wenn das Duell aus dem Labor kommt.
      await p.s.waitForSelector('.screen.arena', { timeout: 30000 });
      await warte(500);
      pruefe('Ohne Konto: Labor zu, also zur Arena, kein Duell-Screen, keine duell-Aufrufe', await p.s.locator('.screen.raetsel-duell .rd-rumpf > *').count() === 0
        && p.aufrufe.every((a) => !/^duell_/.test(a.name)));
      pruefe('Keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
    } finally { await p.k.close(); }
  }
  // Ohne Labor: das Duell ist noch nicht freigegeben und fuehrt zur Arena
  {
    gruppe = 'Ohne Labor';
    const p = await seite(browser, { breite: 390, hoehe: 844, erfinder: false });
    try {
      await p.s.waitForSelector('.screen.arena', { timeout: 30000 });
      await warte(500);
      pruefe('Ohne Labor: zur Arena, kein Duell-Screen, keine duell-Aufrufe', await p.s.locator('.screen.raetsel-duell .rd-rumpf > *').count() === 0
        && p.aufrufe.every((a) => !/^duell_/.test(a.name)));
      pruefe('Keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
    } finally { await p.k.close(); }
  }
  // Lobby-Karte fuehrt zum Duell
  {
    gruppe = 'Lobby-Karte';
    const p = await seite(browser, { breite: 390, hoehe: 844, hash: 'lobby', srv: neuerServer() });
    try {
      await p.s.waitForSelector('.screen.lobby .lb-modus-karte[data-ziel="duell"]', { timeout: 30000 });
      await warte(500);
      await p.s.locator('.lb-modus-karte[data-ziel="duell"]').click();
      await p.s.waitForSelector('.screen.raetsel-duell[data-phase="start"]', { timeout: 5000 });
      pruefe('Karte Raetsel-Duell ist aktiv und oeffnet den Duell-Screen', await p.s.evaluate(() => location.hash === '#raetsel-duell'));
      pruefe('Keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
    } finally { await p.k.close(); }
  }
}

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
let browser;
try {
  if (BILDER) fs.mkdirSync(BILDER, { recursive: true });
  await warteAufServer(`http://127.0.0.1:${PORT}/index.html`);
  browser = await browserTyp(ladePlaywright()).launch();
  const laeufe = [
    { geraet: 'iphone', breite: 390, hoehe: 844, schema: 'light' },
    { geraet: 'ipad', breite: 820, hoehe: 1180, schema: 'dark' },
  ];
  if (BILDER) laeufe.push({ geraet: 'iphone', breite: 390, hoehe: 844, schema: 'dark' }, { geraet: 'ipad', breite: 820, hoehe: 1180, schema: 'light' });
  for (const l of laeufe) await duellGegenKi(browser, l);
  await nebenwege(browser);
} catch (e) {
  fehler++;
  console.log('FEHLER Ablauf ' + (gruppe ? '(' + gruppe + ') ' : '') + (e && e.stack || e));
} finally {
  if (browser) await browser.close();
  server.kill();
}
console.log(`\n${ok} ok, ${fehler} Fehler${BILDER ? '; Bilder in ' + BILDER : ''}`);
process.exit(fehler ? 1 : 0);
