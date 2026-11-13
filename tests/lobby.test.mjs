// Tests fuer das Paket lobby (Online-Lobby als Vorschau im Labor, Flo 01.11.2026: "alles optisch so einrichten, als
// wuerde alles funktionieren ... Startseite Blitz, Schnell, Ligen").
//   node tests/lobby.test.mjs              Node-Teil und Browser-Teil (volle App, Erfinder-Konto und normales Konto)
//   node tests/lobby.test.mjs --nur-node   nur der Node-Teil
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setzeSpeicher } from '../js/storage.js';
import { BOTS } from '../js/bots.js';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
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
const lager = new Map();
setzeSpeicher({ getItem: (k) => (lager.has(k) ? lager.get(k) : null), setItem: (k, v) => lager.set(k, String(v)), removeItem: (k) => lager.delete(k),
  key: (i) => [...lager.keys()][i] ?? null, get length() { return lager.size; } });
const lobbyModul = await import('../js/pakete/lobby/index.js');
const { ZEITEN, ARTEN, STANDARD_ZEIT, zeitText, schaetzeWertung, passenderBot, modusLeiste } = lobbyModul;
const { DE, EN } = await import('../js/pakete/lobby/texte.js');

pruefe('Bedenkzeiten: Blitz, Schnellschach, Klassisch; Standard 3 + 2; gueltig fuer die Partie-Uhr',
  ARTEN.join() === 'blitz,schnell,klassisch' && ARTEN.every((a) => ZEITEN.some((z) => z.art === a)) && ZEITEN.some((z) => z.id === STANDARD_ZEIT)
  && ZEITEN.every((z) => Number.isInteger(z.grund) && z.grund >= 60 && z.grund <= 10800 && Number.isInteger(z.zuschlag) && z.zuschlag >= 0 && z.zuschlag <= 600)
  && zeitText(ZEITEN.find((z) => z.id === '3+2')) === '3 + 2' && zeitText(ZEITEN.find((z) => z.id === '15+10')) === '15 + 10');
const leer = { bots: {} };
const sieg = (ids) => ({ bots: Object.fromEntries(ids.map((id) => [id, { sterne: [true, false, false] }])) });
const stark = [...BOTS].sort((a, b) => b.elo - a.elo)[0];
pruefe('Wertung geschaetzt: ohne Sieg 400, sonst der staerkste besiegte Bot (auf 50 gerundet, hoechstens 2800)',
  schaetzeWertung(leer) === 400 && schaetzeWertung(sieg([BOTS[0].id, BOTS[3].id])) === Math.max(400, Math.round(Math.max(BOTS[0].elo, BOTS[3].elo) / 50) * 50)
  && schaetzeWertung(sieg([stark.id])) <= 2800);
const g0 = passenderBot(400, leer);
pruefe('Vorschau-Gegner: ein freier Bot, nie ein Endgegner (ohne Fortschritt der erste)', g0 && !g0.endgegner && g0.id === BOTS[0].id, g0 && g0.id);
// Flo 08.11.2026: die Beispiel-Liga mit erfundenen Namen ist weg (sie widersprach der echten Liga im Liga-Reiter)
pruefe('Keine Beispiel-Liga mehr: weder Tabelle noch erfundene Namen noch "Beispiel"-Text; kein Countdown', !('ligaTabelle' in lobbyModul)
  && !('LIGA_BEISPIEL' in lobbyModul) && !('beispiel' in DE) && !('liga.titel' in DE)
  && !Object.values(DE).some((x) => /Turmfalke|Rochade77|nur noch|endet in|countdown/i.test(x)));
pruefe('Texte: Deutsch und Englisch mit denselben Schluesseln, keine langen Gedankenstriche',
  Object.keys(DE).sort().join() === Object.keys(EN).sort().join() && ![...Object.values(DE), ...Object.values(EN)].some((x) => /[–—]/.test(x)));
const ZUGWORTE = /brilliant|great move|blunder|inaccuracy|mistake|best move|excellent|book move/i;
pruefe('Englisch ohne Zugklassen-Woerter', !Object.values(EN).some((x) => ZUGWORTE.test(x)));
pruefe('Umschalter ohne Labor: nichts (null)', modusLeiste({ gehe() {} }, 'welten') === null);
{
  const { BOT_ERSATZ_MS } = await import('../js/kronen.js');
  const quelle = (await import('node:fs')).readFileSync(path.join(WURZEL, 'js/ui/lobby.js'), 'utf8');
  // Punkt 40: die Wartezeit nennt der Server (warte_s), ohne neues SQL gelten die 10 s aus js/gegnersuche.js
  pruefe('KI-Gegner: BOT_ERSATZ_MS 10000 (altes SQL), die Lobby nimmt ohne Testschalter die Wartezeit des Servers',
    BOT_ERSATZ_MS === 10000 && /window\.__lobbyBotMs : undefined;/.test(quelle));
  const kern = (await import('node:fs')).readFileSync(path.join(WURZEL, 'js/sprachen/partie.js'), 'utf8');
  // das Abzeichen steht in den Kern-Texten (partie.kiGegner): der Kern laedt ohne Pakete keine Paket-Datei
  pruefe('Texte fuer die Gegnersuche: KI-Gegner (Kern) und Anmelde-Hinweis', /kiGegner: 'KI-Gegner'/.test(kern) && /kiGegner: 'AI opponent'/.test(kern) && !('ki' in DE)
    && DE['suche.anmelden'] === 'Zum Suchen anmelden');
}

// ---------------------------------------------------------------------------
// Browser-Teil
// ---------------------------------------------------------------------------
async function warteAufServer(url, ms = 10000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
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

// rpc(name, daten) beantwortet abgefangene Aufrufe von /rest/v1/rpc/<name> (Etappe B: Gegnersuche); jeder Aufruf
// landet in aufrufe. botMs verkuerzt die Wartezeit bis zum KI-Gegner (window.__lobbyBotMs, sonst 10 s).
async function seite(browser, { erfinder, breite = 390, hoehe = 844, hash = 'arena', rpc = null, botMs = null }) {
  const k = await browser.newContext({ viewport: { width: breite, height: hoehe }, serviceWorkers: 'block', hasTouch: true });
  const s = await k.newPage();
  const fehlerListe = [];
  const aufrufe = [];
  s.on('pageerror', (e) => fehlerListe.push(e.message));
  s.on('console', (m) => { if (m.type() === 'error') fehlerListe.push('konsole: ' + m.text()); });
  await s.route(SUPA + '/**', (r) => {
    const name = (r.request().url().match(/\/rest\/v1\/rpc\/([a-z_]+)/) || [])[1];
    if (name && rpc) {
      let daten = null;
      try { daten = r.request().postDataJSON(); } catch (e) { /* ohne Rumpf */ }
      aufrufe.push({ name, daten, um: Date.now() });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rpc(name, daten) ?? []) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(r.request().url().includes('sonderstuecke') && erfinder ? [{ stueck_id: 'erfinder-titel' }] : []) });
  });
  await s.addInitScript(({ sitzung, uid, erfinder, botMs }) => {
    try {
      window.__lobbySuche = 300;
      if (botMs != null) window.__lobbyBotMs = botMs;
      if (sessionStorage.getItem('probe-start')) return;
      sessionStorage.setItem('probe-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
      if (erfinder) localStorage.setItem('schach-arena:konto:sonderstuecke', JSON.stringify({ konto: uid, ids: ['erfinder-titel'] }));
    } catch (e) { /* egal */ }
  }, { sitzung: SITZUNG, uid: UID, erfinder, botMs });
  await s.goto(`${BASIS}#${hash}`);
  return { k, s, fehlerListe, aufrufe };
}

async function browserTeil() {
  const pw = ladePlaywright();
  const server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
  let browser;
  try {
    await warteAufServer(`http://127.0.0.1:${PORT}/index.html`);
    browser = await browserTyp(pw).launch();
    // normales Konto: kein Umschalter, #lobby fuehrt still zur Arena
    {
      const p = await seite(browser, { erfinder: false });
      await p.s.waitForSelector('.screen.arena .knoten', { timeout: 30000 });
      await warte(600);
      pruefe('Ohne Labor: kein Umschalter auf der Startseite', await p.s.locator('.lb-modus').count() === 0
        && await p.s.locator('.ort-arena-modus').evaluate((e) => e.hidden));
      await p.s.evaluate(() => window.__app.gehe('lobby'));
      await warte(800);
      pruefe('Ohne Labor: die Lobby fuehrt zur Arena', await p.s.locator('.screen.lobby .lb-rumpf').count() === 0
        && await p.s.locator('.screen.arena').count() === 1);
      pruefe('Ohne Labor: keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
      await p.k.close();
    }
    // Erfinder: Umschalter, Lobby, Suche, Partie mit derselben Uhr
    {
      const p = await seite(browser, { erfinder: true });
      await p.s.waitForSelector('.screen.arena .lb-modus', { timeout: 30000 });
      const leiste = await p.s.evaluate(() => {
        const l = document.querySelector('.lb-modus');
        const r = l.getBoundingClientRect();
        const k = document.querySelector('.screen.arena .karte').getBoundingClientRect();
        return { aktiv: l.dataset.aktiv, hoehe: Math.round(r.height), ueberKarte: r.bottom <= k.top + 1,
          labor: !!l.querySelector('[data-modus="online"] .lb-labor'), knoepfe: [...l.querySelectorAll('[data-modus]')].map((b) => Math.round(b.getBoundingClientRect().height)) };
      });
      pruefe('Erfinder: Umschalter Welten | Online ueber der Karte, Welten aktiv, Online mit Labor-Schild, Knoepfe mindestens 38 px im 44-px-Band',
        leiste.aktiv === 'welten' && leiste.hoehe >= 44 && leiste.ueberKarte && leiste.labor && leiste.knoepfe.every((h) => h >= 38), leiste);
      await p.s.locator('.lb-modus [data-modus="online"]').click();
      await p.s.waitForSelector('.screen.lobby .lb-spielen', { timeout: 10000 });
      await warte(700);
      const lobby = await p.s.evaluate(() => ({
        aktiv: document.querySelector('.screen.lobby .lb-modus')?.dataset.aktiv,
        zeiten: [...document.querySelectorAll('.lb-zeit')].map((b) => b.dataset.zeit + (b.getAttribute('aria-checked') === 'true' ? '*' : '')),
        werte: [...document.querySelectorAll('.lb-wert')].map((w) => w.dataset.art + ':' + w.querySelector('b').textContent),
        liga: document.querySelectorAll('.lb-liga, .lb-tabelle li').length, beispiel: /Beispiel|Turmfalke/.test(document.querySelector('.screen.lobby').textContent), mehr: [...document.querySelectorAll('.lb-modus-karte')].map((b) => b.dataset.ziel + (b.disabled ? '-' : '+')),
        reiter: document.querySelector('.reiter-leiste .reiter[aria-current="page"], .reiter-leiste .reiter.aktiv')?.dataset.reiter || null,
        hash: location.hash, breit: document.documentElement.scrollWidth <= innerWidth + 1, zeitenZu: document.querySelector('.lb-zeiten').hidden,
        klein: [...document.querySelectorAll('.lb-zeit, .lb-suchen, .lb-modus-karte')].filter((e) => e.getClientRects().length && e.getBoundingClientRect().height < 44).length,
      }));
      pruefe('Lobby: Online aktiv, sechs Bedenkzeiten (3 + 2 gewaehlt), drei Wertungen (400), keine Beispiel-Liga (Flo 08.11.2026)',
        lobby.aktiv === 'online' && lobby.zeiten.join() === '3+0,3+2*,5+0,10+0,15+10,30+0' && lobby.werte.join() === 'blitz:400,schnell:400,klassisch:400'
        && lobby.liga === 0 && !lobby.beispiel, lobby);
      // Punkt 40: Ranked (gewertet) hat die feste Zeit 5 + 3, die Wahl gibt es nur fuer Freundschaft
      pruefe('Lobby: gewertet ohne Bedenkzeit-Wahl (feste Zeit), Freundschaft zeigt sie', lobby.zeitenZu, lobby);
      pruefe('Lobby: Gegen Freunde und Raetsel-Duell offen, Turniere bald; Hash #lobby; nichts breiter als das Handy; Tippflaechen ab 44 px',
        lobby.mehr.join() === 'online+,turniere-,duell+' && lobby.hash === '#lobby' && lobby.breit && lobby.klein === 0, lobby);
      // Etappe B Task 4: gewertet sucht jetzt echt auf dem Server; die Vorschau mit Bot bleibt bei Freundschaft
      await p.s.locator('.lb-spielen [data-wert="freundschaft"]').click();
      await p.s.locator('.lb-zeit[data-zeit="10+0"]').click();
      const zeile = await p.s.locator('.lb-zeile').innerText();
      pruefe('Bedenkzeit 10 + 0 waehlen: Haken wandert, Zeile nennt Schnellschach', await p.s.locator('.lb-zeit[aria-checked="true"]').getAttribute('data-zeit') === '10+0'
        && /Schnellschach/.test(zeile), zeile);
      await p.s.locator('.lb-suchen').click();
      await p.s.waitForSelector('.lb-suche[data-phase="suche"]', { timeout: 3000 });
      pruefe('Gegner suchen: Radar und Abbrechen, deckt die Reiter-Leiste ab', await p.s.evaluate(() => {
        const el = document.querySelector('.lb-suche');
        const r = document.querySelector('.reiter-leiste');
        const oben = r && !r.hidden ? document.elementFromPoint(innerWidth / 2, r.getBoundingClientRect().top + 10) : null;
        return el.parentElement === document.body && !!el.querySelector('.lb-radar') && !!el.querySelector('.lb-abbrechen') && (!oben || !!oben.closest('.lb-suche'));
      }));
      await p.s.waitForSelector('.lb-suche[data-phase="gefunden"]', { timeout: 3000 });
      const gef = await p.s.evaluate(() => ({ titel: document.querySelector('.lb-suche-titel').textContent, text: document.querySelector('.lb-gefunden-text').textContent,
        knopf: document.querySelector('.lb-spielen-bot').textContent, sichtbar: !document.querySelector('.lb-spielen-bot').hidden }));
      pruefe('Gefunden: ehrlich als Vorschau, Gegner ist ein Bot mit Namen und Staerke', gef.titel === 'Gegner gefunden' && /Vorschau/.test(gef.text)
        && gef.sichtbar && gef.knopf.startsWith('Gegen '), gef);
      await p.s.keyboard.press('Escape');
      await warte(200);
      pruefe('Escape schliesst die Suche', await p.s.locator('.lb-suche').count() === 0);
      // Flo 01.11.2026 (Handy): "Bin auf Gegner suchen gegangen, konnte danach nichts mehr anklicken". Mit dem Finger wie
      // auf dem Handy: Suche, Zurueck, danach reagiert die Lobby; Suche, Spielen, danach reagiert die Partie (auch in WebKit)
      await p.s.tap('.lb-suchen');
      await p.s.waitForSelector('.lb-suche[data-phase="gefunden"]', { timeout: 3000 });
      await p.s.tap('.lb-abbrechen');
      await warte(250);
      await p.s.tap('.lb-zeit[data-zeit="5+0"]');
      await warte(150);
      const nachZurueck = await p.s.evaluate(() => ({ suche: document.querySelectorAll('.lb-suche').length, zeit: document.querySelector('.lb-zeit[aria-checked="true"]')?.dataset.zeit,
        oben: (() => { const k = document.querySelector('.lb-suchen').getBoundingClientRect(); const e = document.elementFromPoint(k.left + k.width / 2, k.top + k.height / 2); return !!(e && e.closest('.lb-suchen')); })() }));
      pruefe('Getippt: Zurueck schliesst die Suche, danach reagiert die Lobby (Bedenkzeit 5 + 0, Gegner suchen wieder oben)',
        nachZurueck.suche === 0 && nachZurueck.zeit === '5+0' && nachZurueck.oben, nachZurueck);
      await p.s.locator('.lb-zeit[data-zeit="10+0"]').click();
      await p.s.tap('.lb-suchen');
      await p.s.waitForSelector('.lb-suche[data-phase="gefunden"]', { timeout: 3000 });
      await p.s.tap('.lb-spielen-bot');
      await p.s.waitForFunction(() => window.__partie && window.__partie.z, null, { timeout: 15000 });
      const partie = await p.s.evaluate(() => ({ screen: document.documentElement.dataset.screen, tempo: window.__partie.z.tempo, suche: !!document.querySelector('.lb-suche') }));
      pruefe('Gegen den Bot spielen: echte Partie mit derselben Uhr (10 + 0), die Suche ist weg',
        partie.screen === 'partie' && partie.tempo && partie.tempo.grund === 600 && partie.tempo.zuschlag === 0 && !partie.suche, partie);
      await p.s.waitForFunction(() => window.__partie && window.__partie.bereit, null, { timeout: 15000 }).catch(() => {});
      await warte(400);
      const brett = await p.s.evaluate(() => {
        const b = document.querySelector('.screen.partie .brett').getBoundingClientRect();
        const e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return { mitte: !!(e && e.closest('.screen.partie .brett')), ueber: [...document.body.children].filter((x) => x.id !== 'app' && getComputedStyle(x).position === 'fixed'
          && getComputedStyle(x).pointerEvents !== 'none' && x.getBoundingClientRect().height > innerHeight / 2).map((x) => x.className) };
      });
      pruefe('In der Partie liegt nichts ueber dem Brett (keine Ueberlagerung faengt Tipps ab)', brett.mitte && brett.ueber.length === 0, brett);
      await p.s.tap('.screen.partie [data-aktion="zurueck"]');
      await warte(600);
      const raus = await p.s.evaluate(() => ({ screen: document.documentElement.dataset.screen, dialog: !!document.querySelector('.dialog-ort [role="dialog"], .dialog-ort [role="alertdialog"], .dialog-ort .dialog, .sheet') }));
      pruefe('Getippt: der Zurueck-Knopf der Partie reagiert (Rueckfrage oder zurueck)', raus.dialog || raus.screen !== 'partie', raus);
      pruefe('Erfinder: keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
      await p.k.close();
    }
    // Etappe B Task 4: gewertete Gegnersuche ueber den (abgefangenen) Server, KI-Gegner nach der Wartezeit
    {
      const KI = '11111111-2222-4333-8444-555555555555';
      // die Suche fragt den Server je Sekunde (alleMs 1000): erst 1 s nach der Start-Antwort kommt online_suche_stand
      const BOT_MS = 3000;
      const antwort = (treffer) => (name, daten) => {
        if (name === 'online_suche_ende') return daten && daten.ki ? { ki_ref: KI } : {};
        if (name === 'online_suche_stand' && treffer && treffer()) return { partie: 'p1' };
        if (name === 'online_suche_start' || name === 'online_suche_stand') return { wartet: true };
        return [];
      };
      const zurLobby = async (p) => { await p.s.waitForSelector('.screen.lobby .lb-spielen', { timeout: 30000 }); await warte(500); };
      const screen = (p) => p.s.evaluate(() => document.documentElement.dataset.screen);

      // Bot erst nach der Wartezeit
      {
        const p = await seite(browser, { erfinder: true, hash: 'lobby', botMs: BOT_MS, rpc: antwort(null) });
        await zurLobby(p);
        await p.s.locator('.lb-suchen').click();
        await warte(BOT_MS - 800);
        const frueh = { suche: await p.s.locator('.lb-suche[data-phase="suche"]').count(), screen: await screen(p), namen: p.aufrufe.map((a) => a.name),
          kiKnopf: await p.s.evaluate(() => document.querySelector('.lb-ki-jetzt')?.hidden) };
        // nur die Suche zaehlt: der Karten-Abgleich (karte_melde_stufen, Etappe 4b) darf beim Start davor laufen
        const sucheAufrufe = p.aufrufe.filter((a) => a.name.startsWith('online_suche'));
        pruefe('suche: Bot erst nach der Wartezeit (vorher Suche beim Server, kein Bot)', frueh.suche === 1 && frueh.screen === 'lobby'
          && sucheAufrufe[0]?.name === 'online_suche_start' && sucheAufrufe[0].daten?.zeit === '5+3' && frueh.namen.includes('online_suche_stand')
          && !frueh.namen.includes('online_suche_ende') && frueh.kiKnopf === true, frueh);
        await p.s.waitForFunction(() => window.__partie && window.__partie.z, null, { timeout: 15000 });
        const ki = await p.s.evaluate(() => ({ abz: document.querySelector('.screen.partie .ki-abzeichen')?.textContent, ki: window.__partie.z.ki,
          ref: window.__partie.z.kiRef, tempo: window.__partie.z.tempo, suche: !!document.querySelector('.lb-suche') }));
        const enden = p.aufrufe.filter((a) => a.name === 'online_suche_ende');
        pruefe('suche: danach Partie mit Abzeichen "KI-Gegner", Beleg gemerkt, feste Ranked-Uhr 5 + 3, genau ein Ende mit ki',
          ki.abz === 'KI-Gegner' && ki.ki === true && ki.ref === KI && ki.tempo?.grund === 300 && ki.tempo?.zuschlag === 3 && !ki.suche
          && enden.length === 1 && enden[0].daten?.ki === true, { ki, enden });
        pruefe('suche: keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
        await p.k.close();
      }
      // Treffer schlaegt Bot
      {
        let start = 0;
        const p = await seite(browser, { erfinder: true, hash: 'lobby', botMs: BOT_MS, rpc: antwort(() => start && Date.now() - start > 500) });
        await zurLobby(p);
        start = Date.now();
        await p.s.locator('.lb-suchen').click();
        await warte(BOT_MS + 1200);
        const st = { screen: await screen(p), partie: await p.s.evaluate(() => !!(window.__partie && window.__partie.z && window.__partie.z.ki)),
          namen: p.aufrufe.map((a) => a.name) };
        pruefe('suche: Treffer schlaegt Bot (Online-Partie offen, kein KI-Gegner, kein Ende-Aufruf)', st.screen === 'online' && !st.partie
          && !st.namen.includes('online_suche_ende'), st);
        await p.k.close();
      }
      // Abbruch
      {
        const p = await seite(browser, { erfinder: true, hash: 'lobby', botMs: BOT_MS, rpc: antwort(null) });
        await zurLobby(p);
        await p.s.locator('.lb-suchen').click();
        await warte(300);
        await p.s.locator('.lb-abbrechen').click();
        await warte(BOT_MS + 800);
        const enden = p.aufrufe.filter((a) => a.name === 'online_suche_ende');
        pruefe('suche: Abbruch ruft genau einmal online_suche_ende (ohne ki), danach kein Bot',
          enden.length === 1 && enden[0].daten?.ki === false && (await screen(p)) === 'lobby' && await p.s.locator('.lb-suche').count() === 0, enden);
        await p.k.close();
      }
      // ohne Konto
      {
        const p = await seite(browser, { erfinder: true, hash: 'lobby', botMs: BOT_MS, rpc: antwort(null) });
        await zurLobby(p);
        await p.s.evaluate(() => localStorage.removeItem('schach-arena:konto:sitzung'));
        await p.s.locator('.lb-suchen').click();
        await warte(BOT_MS + 500);
        const st = await p.s.evaluate(() => ({ phase: document.querySelector('.lb-suche')?.dataset.phase,
          titel: document.querySelector('.lb-suche-titel')?.textContent, screen: document.documentElement.dataset.screen }));
        pruefe('suche: ohne Konto Hinweis "Zum Suchen anmelden", kein Aufruf beim Server, kein Bot',
          st.phase === 'anmelden' && st.titel === 'Zum Suchen anmelden' && st.screen === 'lobby'
          && !p.aufrufe.some((a) => a.name.startsWith('online_suche')), { st, aufrufe: p.aufrufe.map((a) => a.name) });
        await p.k.close();
      }
    }
    // iPad quer: zwei Spalten, Welten fuehrt zurueck zur Karte
    {
      const p = await seite(browser, { erfinder: true, breite: 1180, hoehe: 820, hash: 'lobby' });
      await p.s.waitForSelector('.screen.lobby .lb-spielen', { timeout: 30000 });
      await warte(700);
      const lage = await p.s.evaluate(() => {
        const a = document.querySelector('.lb-spielen').getBoundingClientRect();
        const b = document.querySelector('.lb-wertungen').getBoundingClientRect();
        return { nebeneinander: b.left >= a.right - 1 && Math.abs(a.top - b.top) < 4, breit: document.documentElement.scrollWidth <= innerWidth + 1 };
      });
      pruefe('iPad quer: Spielen links, Wertungen rechts daneben', lage.nebeneinander && lage.breit, lage);
      // am Rand gewischt rollt die Lobby (vorher nur die 1040-px-Spalte in der Mitte, Flo 01.11.2026 bei Premium und Lektionen)
      // seit der Seitenleiste (Etappe A) beginnt der Rand des Screens rechts neben ihr
      // seit die Beispiel-Liga weg ist (Flo 08.11.2026) passt die Lobby auf 820 px Hoehe: zum Rollen-Test niedriger machen
      await p.s.setViewportSize({ width: 1180, height: 520 });
      await warte(300);
      await p.s.mouse.move(await p.s.evaluate(() => (document.querySelector('.reiter-leiste[data-lage="seite"]')?.getBoundingClientRect().right ?? 0) + 20), 400);
      await p.s.mouse.wheel(0, 4000);
      await warte(500);
      const rollen = await p.s.evaluate(() => { const r = document.querySelector('.lb-rumpf'); return { st: Math.round(r.scrollTop), max: r.scrollHeight - r.clientHeight }; });
      pruefe('iPad quer: am Rand gewischt rollt die Lobby bis ganz unten', rollen.max > 0 && rollen.st >= rollen.max - 1, rollen);
      await p.s.locator('.screen.lobby .lb-modus [data-modus="welten"]').click();
      await p.s.waitForSelector('.screen.arena .knoten', { timeout: 10000 });
      pruefe('Welten fuehrt zur Karte zurueck', await p.s.evaluate(() => location.hash === '#arena' && document.querySelector('.screen.arena .lb-modus')?.dataset.aktiv === 'welten'));
      pruefe('iPad: keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
      await p.k.close();
    }
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

if (!NUR_NODE) await browserTeil();
console.log(`${ok}/${ok + fehler} bestanden`);
if (fehler) { console.log(`FEHLER: ${fehler} Pruefung(en)`); process.exit(1); }
