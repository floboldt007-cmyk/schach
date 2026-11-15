// Feinschliff R19 online-weg (Flo 15.11.2026, 00:47: "zwei verschiedene Online-Dinge", kein Ladebildschirm mit
// Bannern, Zahlen unten rechts verbuggt). Der KI-Ersatz ist eine gewertete Liga-Partie und sieht so aus:
//   a) Duell-Intro (anlass 'liga') vor der Partie, aus der Online-Seite und aus der Labor-Lobby (js/ui/ki-ersatz.js)
//   b) eigene Spielerleiste ohne Visitenkarten-Streifen, nichts abgeschnitten (15 und 20 Zeichen, vier Geraete)
//   d) Gegnerkarte ohne Streifen, das Abzeichen "KI-Gegner" reicht
//   e) Kopf "Online · gewertet · 5 + 3 · Du spielst ..." ohne Stufe (DE und EN)
//   Umleitung: der Umschalter "Online" auf der Bots-Seite fuehrt zur echten Seite (#online), nicht in die Labor-Lobby
// Server nur simuliert (online_suche_* wie tests/lobby.test.mjs), nie Supabase.
//   node tests/r19-online-weg.test.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0; let fehler = 0;
function pruefe(name, wert, info = '') {
  if (wert) { ok++; console.log('ok   ' + name); } else { fehler++; console.log('FEHLER ' + name + ' ' + (typeof info === 'string' ? info : JSON.stringify(info))); }
}
function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}
async function warteAufServer(url, ms = 10000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try { const r = await fetch(url); await r.arrayBuffer(); if (r.ok) return; } catch (e) { /* noch nicht da */ }
    await warte(150);
  }
  throw new Error('Server startet nicht: ' + url);
}

const SUPA = 'https://usaamcqypmvgqmsbfecb.supabase.co';
const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const token = (sub) => 'a.' + Buffer.from(JSON.stringify({ sub })).toString('base64url') + '.x';
const SITZUNG = { access_token: token(UID), refresh_token: 'r1', expires_at: 9999999999, user: { id: UID, email: 'probe@example.invalid' } };
const KI_REF = '11111111-2222-4333-8444-555555555555';
// neuesSql: die Suche nennt Wartezeit und Beginn (SQL #213, lage().vomServer), erst dann kommt der Hinweis "Verlassen zaehlt"
function rpcAntwort(name, daten, neuesSql = false) {
  if (name === 'online_suche_ende') return daten && daten.ki ? { ki_ref: KI_REF } : {};
  if (name === 'online_suche_start' || name === 'online_suche_stand') {
    return neuesSql ? { wartet: true, zeit: '5+3', warte_s: 1, ki_ab_s: 0, seit: new Date().toISOString() } : { wartet: true, zeit: '5+3' };
  }
  return [];
}

async function seite(browser, { breite = 1280, hoehe = 800, mobil = false, hash = 'heim', sprache = 'de', name = 'Bigbananajoe007', neuesSql = false } = {}) {
  const k = await browser.newContext({ viewport: { width: breite, height: hoehe }, deviceScaleFactor: 1, hasTouch: mobil, isMobile: mobil, serviceWorkers: 'block' });
  const s = await k.newPage();
  const fehlerListe = [];
  s.on('pageerror', (e) => fehlerListe.push(e.message));
  await s.route(SUPA + '/**', (r) => {
    const n = (r.request().url().match(/\/rest\/v1\/rpc\/([a-z_]+)/) || [])[1];
    let d = null; try { d = r.request().postDataJSON(); } catch (e) { /* ohne Rumpf */ }
    const body = n ? rpcAntwort(n, d, neuesSql) : (r.request().url().includes('sonderstuecke') ? [{ stueck_id: 'erfinder-titel' }] : []);
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body ?? []) });
  });
  await s.addInitScript(({ sitzung, uid, sprache, name }) => {
    window.__lobbySuche = 300; window.__lobbyBotMs = 600; window.__onlineBotMs = 600;
    if (sessionStorage.getItem('probe-start')) return;
    sessionStorage.setItem('probe-start', '1');
    localStorage.clear();
    localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
    localStorage.setItem('schach-arena:konto:sonderstuecke', JSON.stringify({ konto: uid, ids: ['erfinder-titel'] }));
    localStorage.setItem('schach-arena:konto:name', JSON.stringify({ konto: uid, name }));
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ sprache, spracheGewaehlt: true }));
  }, { sitzung: SITZUNG, uid: UID, sprache, name });
  await s.goto(`${BASIS}#${hash}`);
  return { k, s, fehlerListe };
}

// wartet auf die laufende KI-Partie und das Ende des Intros, liest Kopf, Intro-Protokoll und beide Karten
async function lesePartie(s) {
  await s.waitForFunction(() => window.__partie && window.__partie.z && window.__partie.z.ki, null, { timeout: 30000 });
  await s.waitForFunction(() => (window.__duellProtokoll || []).length > 0 && !document.documentElement.dataset.duell, null, { timeout: 15000 }).catch(() => {});
  return s.evaluate(() => {
    const sichtbar = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
    const stufe = document.querySelector('.screen.partie .p-stufe');
    return {
      prot: (window.__duellProtokoll || []).map((e) => e.anlass),
      kopf: document.querySelector('.screen.partie .p-eroeffnung')?.textContent.trim(),
      stufe: sichtbar(stufe),
      unter: document.querySelector('.screen.partie .titel .unter')?.textContent.replace(/\s+/g, ' ').trim(),
      vk: document.querySelectorAll('.screen.partie .ort-spieler-leiste .vk, .screen.partie .ort-gegner-leiste .vk').length,
      kiAbzeichen: document.querySelectorAll('.screen.partie .ki-abzeichen').length,
    };
  });
}

// misst die eigene Karte: Leiste schneidet nichts ab, jedes Kind (Level-Chip) ganz in der Leiste, Leiste und Name
// ganz in der Karte, die Seite nicht breiter als das Fenster
async function messeLeiste(s) {
  return s.evaluate(() => {
    const ich = [...document.querySelectorAll('.screen.partie .spieler.ich')].find((e) => e.getClientRects().length);
    if (!ich) return { fehlt: true };
    const r = (e) => e.getBoundingClientRect();
    const drin = (a, b) => r(a).left >= r(b).left - 1 && r(a).right <= r(b).right + 1;
    const leiste = ich.querySelector('.ort-spieler-leiste');
    const name = ich.querySelector('.name');
    const kinder = leiste ? [...leiste.children].filter((e) => e.getClientRects().length && r(e).width > 0) : [];
    const chip = ich.querySelector('.fk-spieler');
    return {
      leisteAb: leiste ? leiste.scrollWidth > leiste.clientWidth + 1 : null,
      masse: leiste ? [Math.round(r(leiste).left), Math.round(r(leiste).right), leiste.scrollWidth, leiste.clientWidth,
        ...kinder.map((e) => `${e.className}:${Math.round(r(e).left)}-${Math.round(r(e).right)}`)] : null,
      kinderDrin: kinder.every((e) => drin(e, leiste)),
      chip: chip ? { b: Math.round(r(chip).width), voll: chip.scrollWidth <= chip.clientWidth + 1, drin: drin(chip, ich) } : null,
      leisteDrin: leiste ? drin(leiste, ich) : null,
      nameDrin: name ? drin(name, ich) && name.scrollWidth <= name.clientWidth + 1 : null,
      karteAb: ich.scrollWidth > ich.clientWidth + 1,
      seiteBreit: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
}

const pw = ladePlaywright();
const server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
let browser;
try {
  await warteAufServer(`http://127.0.0.1:${PORT}/index.html`);
  browser = await browserTyp(pw).launch();

  // Umleitung: Bots -> Umschalter "Online" fuehrt zur echten Seite
  {
    const p = await seite(browser, { hash: 'arena' });
    await p.s.waitForSelector('.screen.arena .lb-modus', { timeout: 30000 });
    await p.s.locator('.lb-modus [data-modus="online"]').click();
    await p.s.waitForFunction(() => document.querySelector('.screen.online-screen, .screen.lobby'), null, { timeout: 10000 });
    await warte(400);
    const wo = await p.s.evaluate(() => ({ screen: document.documentElement.dataset.screen, hash: location.hash, lobby: !!document.querySelector('.screen.lobby .lb-rumpf') }));
    pruefe('Umschalter Online auf der Bots-Seite fuehrt zur Seite online (nicht in die Labor-Lobby)', wo.screen === 'online' && !wo.lobby && /^#online/.test(wo.hash), wo);
    pruefe('Umleitung: keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
    await p.k.close();
  }

  // KI-Ersatz aus der Online-Seite (DE und EN)
  for (const [sprache, erwartet] of [['de', 'Online · gewertet · 5 + 3'], ['en', 'Online · rated · 5 + 3']]) {
    const p = await seite(browser, { hash: 'online', sprache });
    await p.s.waitForSelector('[data-online="suchen"]:not([disabled])', { timeout: 30000 });
    await p.s.locator('[data-online="suchen"]').click();
    const g = await lesePartie(p.s);
    pruefe(`Online-Seite (${sprache}): Duell-Intro mit anlass liga vor dem KI-Ersatz`, g.prot.includes('liga'), g);
    pruefe(`Online-Seite (${sprache}): Kopf "${erwartet}", keine Stufe`, g.kopf === erwartet && !g.stufe, g);
    pruefe(`Online-Seite (${sprache}): kein Visitenkarten-Streifen in den Leisten, genau ein Abzeichen KI-Gegner`, g.vk === 0 && g.kiAbzeichen === 1, g);
    pruefe(`Online-Seite (${sprache}): keine Seitenfehler`, p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
    await p.k.close();
  }

  // KI-Ersatz aus der Labor-Lobby (direkt per #lobby, nur Erfinder): derselbe Weg
  {
    const p = await seite(browser, { hash: 'lobby' });
    await p.s.waitForSelector('.screen.lobby .lb-suchen', { timeout: 30000 });
    await warte(400);
    await p.s.locator('.lb-suchen').click();
    const g = await lesePartie(p.s);
    pruefe('Labor-Lobby: Duell-Intro mit anlass liga vor dem KI-Ersatz', g.prot.includes('liga'), g);
    pruefe('Labor-Lobby: Kopf "Online · gewertet · 5 + 3", keine Stufe, kein Streifen', g.kopf === 'Online · gewertet · 5 + 3' && !g.stufe && g.vk === 0, g);
    pruefe('Labor-Lobby: keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
    await p.k.close();
  }

  // Kaltreview f1 Befund 2: der Hinweis "Verlassen zaehlt als Niederlage" gehoert nur in die KI-Partie, die ihn ausloest.
  // Wer waehrend des Intros die Online-Seite verlaesst, bekommt ihn nicht in der naechsten fremden Partie.
  const meldungenMitschreiben = (s) => s.evaluate(() => {
    window.__meldungen = [];
    const alt = window.__app.meldung;
    window.__app.meldung = function (text, opt) { window.__meldungen.push(String(text)); return alt.call(this, text, opt); };
  });
  const VERLASSEN = 'Verlassen zählt als Niederlage';
  {
    const p = await seite(browser, { hash: 'online', neuesSql: true });
    await p.s.waitForSelector('[data-online="suchen"]:not([disabled])', { timeout: 30000 });
    await meldungenMitschreiben(p.s);
    await p.s.locator('[data-online="suchen"]').click();
    await lesePartie(p.s);
    await warte(600);
    const m = await p.s.evaluate(() => window.__meldungen);
    pruefe('Online-Seite, neues SQL: der Hinweis "Verlassen zaehlt" kommt in der KI-Partie', m.filter((x) => x === VERLASSEN).length === 1, m);
    await p.k.close();
  }
  {
    const p = await seite(browser, { hash: 'online', neuesSql: true });
    await p.s.waitForSelector('[data-online="suchen"]:not([disabled])', { timeout: 30000 });
    await meldungenMitschreiben(p.s);
    await p.s.locator('[data-online="suchen"]').click();
    await p.s.waitForFunction(() => document.documentElement.dataset.duell === 'laeuft', null, { timeout: 15000 });
    await p.s.evaluate(() => window.__app.gehe('arena'));
    await warte(3000);
    const kiPartie = await p.s.evaluate(() => !!(window.__partie && window.__partie.z && window.__partie.z.ki));
    await p.s.evaluate(() => window.__app.gehe('partie', { botId: 'benno', farbe: 'w' }));
    await p.s.waitForFunction(() => window.__partie && window.__partie.bereit === true, null, { timeout: 30000 });
    await warte(800);
    const m = await p.s.evaluate(() => window.__meldungen);
    pruefe('Online-Seite: waehrend des Intros verlassen -> keine KI-Partie', !kiPartie, { kiPartie });
    pruefe('Online-Seite: waehrend des Intros verlassen -> kein Hinweis "Verlassen zaehlt" in der naechsten Bot-Partie', !m.includes(VERLASSEN), m);
    pruefe('Online-Seite verlassen: keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
    await p.k.close();
  }
  // Labor-Lobby: nach "Gegner gefunden" fuehrt Wegnavigieren bewusst trotzdem in die Partie (js/ui/lobby.js verlasse:
  // der Beleg ist ausgestellt, sonst zaehlt die Vorab-Niederlage ohne Partie); das gilt auch waehrend des Intros
  {
    const p = await seite(browser, { hash: 'lobby', neuesSql: true });
    await p.s.waitForSelector('.screen.lobby .lb-suchen', { timeout: 30000 });
    await warte(400);
    await meldungenMitschreiben(p.s);
    await p.s.locator('.lb-suchen').click();
    await p.s.waitForFunction(() => document.documentElement.dataset.duell === 'laeuft', null, { timeout: 15000 });
    await p.s.evaluate(() => window.__app.gehe('arena'));
    await p.s.waitForFunction(() => window.__partie && window.__partie.z && window.__partie.z.ki, null, { timeout: 30000 });
    await warte(800);
    const m = await p.s.evaluate(() => window.__meldungen);
    pruefe('Labor-Lobby: waehrend des Intros verlassen -> die KI-Partie startet trotzdem, mit Hinweis "Verlassen zaehlt"', m.filter((x) => x === VERLASSEN).length === 1, m);
    await p.k.close();
  }

  // Spielerleiste: lange Namen (15 = Flos Name, 20 = Hoechstlaenge laut js/konto.js NAME) auf vier Geraeten
  const GERAETE = [['pc', 1920, 1080, false], ['ipad-quer', 1180, 820, true], ['iphone13', 390, 844, true], ['iphone-se', 375, 667, true]];
  for (const name of ['Bigbananajoe007', 'Bigbananajoe00712345']) {
    for (const [g, w, h, mobil] of GERAETE) {
      // erst die Bots-Seite fertig, sonst ueberholt die Erststart-Umleitung (#heim -> #arena) den Partiestart
      const p = await seite(browser, { breite: w, hoehe: h, mobil, hash: 'arena', name });
      try {
      await p.s.waitForSelector('.screen.arena .lb-modus', { timeout: 30000 });
      await warte(300);
      await p.s.evaluate(() => window.__app.gehe('partie', { botId: 'fridolin', farbe: 'w', tempo: { grund: 300, zuschlag: 3 }, ki: true }));
      await p.s.waitForFunction(() => window.__partie && window.__partie.z && document.querySelector('.screen.partie .spieler.ich'), null, { timeout: 30000 });
      await warte(600);
      const m = await messeLeiste(p.s);
      pruefe(`Leiste ${g} (${name.length} Zeichen): nichts abgeschnitten, Level-Chip ganz, Name und Leiste in der Karte`,
        !m.fehlt && m.leisteAb === false && m.kinderDrin && m.chip && m.chip.voll && m.chip.drin && m.chip.b >= 20 && m.leisteDrin && m.nameDrin && !m.karteAb && !m.seiteBreit, m);
      } catch (e) {
        pruefe(`Leiste ${g} (${name.length} Zeichen): Partie steht`, false, e.message.split(String.fromCharCode(10))[0] + ' ' + JSON.stringify(await p.s.evaluate(() => ({ screen: document.documentElement.dataset.screen, partie: !!window.__partie })).catch(() => null)));
      }
      await p.k.close();
    }
  }
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill();
}
console.log(`\n${ok} ok, ${fehler} Fehler`);
process.exit(fehler ? 1 : 0);
