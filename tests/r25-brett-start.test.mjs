// R25 Brett beim Start (fc-11:00, Fenster 43; Befund von 19 im Aufgabenordner 2026-11-20--fc-0730-online-ende: das
// Online-Brett stand auf dem iPhone 13 ein Bild lang mit 280 px bei x=55 und sprang nach 16 bis 24 ms auf 384 px).
// Je Partie-Ansicht (Bot, Online, Raetsel-Duell, Zu zweit, Lektion) und Geraet (iPhone 13, iPhone SE, iPad hoch, PC):
// ab dem Laden der Seite wird JEDES gemalte Bild gemessen (requestAnimationFrame, dann MessageChannel = nach dem Malen),
// Brett-Rahmen mit und ohne transform, Lage und die Deckkraft der ganzen Kette bis zum Dokument. Pruefung: das erste
// SICHTBARE Bild des Bretts (Deckkraft > 0, Breite > 0) hat schon die Endbreite, und spaeter springt die Breite nicht mehr.
// Je Ansicht zweimal: Bewegung normal und Bewegung aus (Einstellung; "weniger Bewegung" am Geraet setzt dasselbe
// html[data-bewegung="aus"], js/bewegung.js). Ursache des Sprungs (R25): bei "aus" gibt css/tokens.css JEDEM Element
// .01ms Uebergang, auch den Elementen ohne eigenen (transition-property ist dann "all"); flex-grow der Spielflaeche glitt
// so ein Bild lang von 0 auf 1, layout() mass 10 px Hoehe und setzte BRETT_MIN. Bei "aus" gibt es keine gewollte
// Einblend-Bewegung, dort muss das erste Bild auch in der gemalten Breite und Lage dem Ende gleichen.
// Server wie tests/gleichheit-ansichten.test.mjs: eine Attrappe, nie das echte Projekt.
//   node tests/r25-brett-start.test.mjs [--nur=online,bot] [--geraete=iPhone-13] [--bewegung=aus]
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Chess } from '../vendor/chess/chess.js';
import { browserTyp } from './browser.mjs';
import { introWeg } from './gleichheit-messung.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');
const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };

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
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

const ALLE_GERAETE = [['iPhone 13', 390, 844], ['iPhone SE', 375, 667], ['iPad hoch', 820, 1180], ['PC', 1280, 720]];
const GERAETE = arg('geraete') ? ALLE_GERAETE.filter((g) => arg('geraete').split(',').includes(g[0].replace(/\s+/g, '-'))) : ALLE_GERAETE;
// online: Partie direkt geoeffnet; onlineSuche: wie bei 19 aus der Lobby gesucht, die Partie kommt waehrend der Suche
const ALLE_ANSICHTEN = ['bot', 'online', 'onlineSuche', 'duell', 'zuzweit', 'lektion'];
const ANSICHTEN = arg('nur') ? ALLE_ANSICHTEN.filter((a) => arg('nur').split(',').includes(a)) : ALLE_ANSICHTEN;
// Brett je Ansicht (das Element mit der Feldflaeche)
const BEWEGUNGEN = arg('bewegung') ? arg('bewegung').split(',') : ['normal', 'aus'];
const BRETT = { bot: '.screen.partie .brett-rahmen > .brett', online: '.on-brett', onlineSuche: '.on-brett', duell: '.rd-brett', zuzweit: '.zz-brett', lektion: '.ls-screen .brett-felder' };

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') { gesamt++; if (gut) ok++; console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`); }

// ---- Server-Attrappe (Ausschnitt aus tests/gleichheit-ansichten.test.mjs: Online-Partie und KI-Raetsel-Duell) ----
const UID = 'u1';
const token = (uid) => 'a.' + Buffer.from(JSON.stringify({ sub: uid })).toString('base64url') + '.x';
const SITZUNG = { access_token: token(UID), refresh_token: 'test-r', expires_at: 9999999999, user: { id: UID, email: 'u1@example.invalid' } };
const ERFINDER = ['erfinder-banner-blatt-0', 'erfinder-titel', 'erfinder-figuren-blaupause', 'erfinder-finisher-signatur'];
const RAETSEL = { fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', rating: 700 };
const DUELL = '7d0c9a52-1b3e-4f6a-9c8d-2e1f0a9b8c7d';
const iso = (ms) => new Date(ms).toISOString();
function neuerZustand() {
  const jetzt = iso(Date.now());
  return { duellStart: null, gesucht: 0, partie: { id: 'brett-1', code: null, weiss: 'u1', schwarz: 'u2', erstellt_von: 'u2', gewertet: true, status: 'laeuft',
    fen: new Chess().fen(), am_zug: 'w', zuege: '', ergebnis: null, grund: null, remis_angebot: null, bedenkzeit_s: 300, inkrement_s: 3,
    uhr_weiss_ms: 300000, uhr_schwarz_ms: 300000, letzter_zug_am: jetzt, erstellt_am: jetzt, aktualisiert_am: jetzt } };
}
function bediener(z) {
  return async (route) => {
    const url = new URL(route.request().url());
    let body = {}; try { body = route.request().postDataJSON() || {}; } catch (e) { body = {}; }
    const antwort = (d, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(d) });
    if (url.pathname.startsWith('/auth/v1/')) return antwort({ id: UID, email: UID + '@example.invalid' });
    if (url.pathname === '/rest/v1/sonderstuecke') return antwort(ERFINDER.map((stueck_id) => ({ stueck_id })));
    if (url.pathname === '/rest/v1/profile') return antwort([{ user_id: UID, benutzername: 'Spieler_1' }]);
    if (url.pathname === '/rest/v1/partien_online') return antwort(url.searchParams.has('status') ? [] : [z.partie]);
    const rpc = (url.pathname.match(/\/rest\/v1\/rpc\/([a-z_]+)/) || [])[1];
    if (rpc === 'online_meine') return antwort(z.suche && !z.gesucht ? [] : [z.partie]);
    // Suche: der Start wartet, die zweite Abfrage danach findet die Partie (wie der erste Sucher bei 19)
    if (rpc === 'online_suche_start') return antwort(z.suche ? { wartet: true } : { wartet: false });
    if (rpc === 'online_suche_stand') return antwort(z.suche && ++z.gesucht >= 2 ? { partie: z.partie.id } : { wartet: !!z.suche });
    if (rpc === 'online_suche_ende') return antwort({});
    if (rpc === 'online_live_bewertung_frei') return antwort({ frei: true, rest: 1, unbegrenzt: false });
    if (rpc === 'online_pruefe_zeit') return antwort(z.partie);
    if (rpc === 'kronen_mein_stand') return antwort({ stufe: 7, kronen: 140, platz: 3, ziel: 120, n: 30, woche: '2026-11-09' });
    if (rpc === 'duell_suche_ende') { if (body.ki === true) { z.duellStart = Date.now() + 1200; return antwort({ duell: DUELL }); } return antwort({}); }
    if (rpc === 'duell_stand') {
      if (!z.duellStart) return antwort({ fehler: 'DUELL_UNBEKANNT' });
      return antwort({ duell: DUELL, art: 'ki', status: 'laeuft', jetzt: iso(Date.now()), start_am: iso(z.duellStart),
        ich: { geloest: 0, fehler: 0, ende_am: iso(z.duellStart + 180000) }, gegner: { geloest: 0, fehler: 0, ende_am: iso(z.duellStart + 180000), ki: true, elo: 1200 },
        raetsel: { nr: 1, fen: RAETSEL.fen, bisher: [], rating: RAETSEL.rating } });
    }
    return antwort(rpc ? {} : []);
  };
}

// ---- Messung in der Seite: jedes gemalte Bild, solange __brettSel gesetzt ist ----
function initSkript({ sitzung, erfinder, einstellungen }) {
  try {
    if (!sessionStorage.getItem('brett-start')) {
      sessionStorage.setItem('brett-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
      localStorage.setItem('schach-arena:konto:sonderstuecke', JSON.stringify({ konto: sitzung.user.id, ids: erfinder }));
      if (einstellungen) localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify(einstellungen));
    }
    window.__duellKiMs = 400; window.__duellAbfrageMs = 250;
  } catch (e) { /* egal */ }
  const mc = new MessageChannel();
  window.__brettBilder = [];
  const deckkraft = (e) => { let o = 1; for (let x = e; x && x.nodeType === 1; x = x.parentElement) { const c = getComputedStyle(x); if (c.display === 'none' || c.visibility === 'hidden') return 0; o *= Number(c.opacity); } return o; };
  mc.port1.onmessage = () => {
    const sel = window.__brettSel;
    if (!sel) return;
    const el = [...document.querySelectorAll(sel)].find((e) => e.getClientRects().length > 0);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const b = { t: Math.round(performance.now()), w: Math.round(r.width * 10) / 10, lw: el.offsetWidth, x: Math.round(r.x), y: Math.round(r.y), o: Math.round(deckkraft(el) * 100) / 100 };
    const l = window.__brettBilder, v = l[l.length - 1];
    if (!v || v.w !== b.w || v.lw !== b.lw || v.x !== b.x || v.o !== b.o || v.y !== b.y) l.push(b);
  };
  const bild = () => { mc.port2.postMessage(0); requestAnimationFrame(bild); };
  requestAnimationFrame(bild);
}

const ABLAUF = {
  async bot(s) {
    await s.goto(BASIS + '#arena');
    await s.waitForFunction(() => window.__app && document.documentElement.dataset.screen === 'arena', null, { timeout: 30000 });
    await warte(600);
    await s.evaluate((sel) => { window.__brettSel = sel; window.__app.gehe('partie', { botId: 'benno' }); }, BRETT.bot);
  },
  async online(s) {
    await s.goto(BASIS + '#online');
    await s.waitForFunction(() => window.__app && document.documentElement.dataset.screen, null, { timeout: 30000 });
    await warte(600);
    await s.evaluate((sel) => { window.__brettSel = sel; window.__app.gehe('online', { partieId: 'brett-1' }); }, BRETT.online);
  },
  async onlineSuche(s) {
    await s.goto(BASIS + '#online');
    await s.waitForFunction(() => ['bereit', 'laufend'].includes(document.querySelector('.on-art[data-art="partie"]')?.dataset.zustand), null, { timeout: 30000 });
    await warte(400);
    await s.evaluate((sel) => { window.__brettSel = sel; }, BRETT.onlineSuche);
    await s.locator('[data-online="suchen"]').filter({ visible: true }).first().click();
  },
  async duell(s) {
    await s.goto(BASIS + '#raetsel-duell');
    await s.waitForSelector('.screen.raetsel-duell[data-phase="start"] .rd-suchen', { timeout: 30000 });
    await warte(400);
    await s.evaluate((sel) => { window.__brettSel = sel; }, BRETT.duell);
    await s.locator('.rd-suchen').click();
  },
  async zuzweit(s) {
    await s.goto(BASIS + '#arena');
    await s.waitForFunction(() => window.__app && document.documentElement.dataset.screen === 'arena', null, { timeout: 30000 });
    await warte(600);
    await s.evaluate((sel) => { window.__brettSel = sel; window.__app.gehe('partie', { modus: 'zuzweit', zuzweit: { weiss: 'Anna', schwarz: 'Ben', drehen: false }, tempo: null }); }, BRETT.zuzweit);
  },
  async lektion(s) {
    await s.goto(BASIS + '#training');
    await s.waitForFunction(() => window.__app && document.documentElement.dataset.screen, null, { timeout: 30000 });
    await warte(600);
    await s.evaluate((sel) => { window.__brettSel = sel; window.__app.gehe('lektion', { id: 'grundreihe' }); }, BRETT.lektion);
  },
};

let browser;
const fehlerSeite = [];
async function lauf(ansicht, [geraet, w, h], bewegung) {
  const k = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, serviceWorkers: 'block',
    locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const zustand = neuerZustand();
  zustand.suche = ansicht === 'onlineSuche';
  await k.route('**/*.supabase.co/**', bediener(zustand));
  await k.addInitScript(initSkript, { sitzung: SITZUNG, erfinder: ERFINDER, einstellungen: { bewegung } });
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  s.on('pageerror', (e) => fehlerSeite.push(`${ansicht}@${geraet}: ${e.message}`));
  try {
    await ABLAUF[ansicht](s);
    await s.waitForFunction((sel) => [...document.querySelectorAll(sel)].some((e) => e.getClientRects().length > 0), BRETT[ansicht], { timeout: 20000 });
    await warte(2500); await introWeg(s); await warte(500);
    return { bilder: await s.evaluate(() => window.__brettBilder) };
  } catch (e) {
    return { abbruch: e.message.split('\n')[0] };
  } finally {
    await k.close().catch(() => {});
  }
}

try {
  browser = await browserTyp(pw).launch({ headless: true });
  for (const g of GERAETE) for (const a of ANSICHTEN) {
    const endeJe = {};
    for (const bew of BEWEGUNGEN) {
      const tag = `${g[0]} ${a} (Bewegung ${bew})`;
      const m = await lauf(a, g, bew);
      if (m.abbruch) { pruefe(`${tag}: Messung laeuft`, false, m.abbruch); continue; }
      const sichtbar = m.bilder.filter((b) => b.o > 0 && b.w > 0);
      const ende = m.bilder[m.bilder.length - 1];
      console.log(`  ${tag}: ${JSON.stringify(m.bilder.map((b) => [b.t - m.bilder[0].t, b.w, b.lw, b.x, b.o]))}`);
      if (!sichtbar.length || !ende) { pruefe(`${tag}: Brett sichtbar gemessen`, false, m.bilder); continue; }
      // Massstab ist die Layout-Breite: gewollte Einblend-Animationen (transform, Lektion waechst von 98 %, Duell rutscht)
      // aendern nur die gemalte Breite, nicht die Endlage. Sie stehen in der Zeile darueber (w gegen lw).
      const erstes = sichtbar[0];
      pruefe(`${tag}: erstes sichtbares Bild hat die Endbreite (${erstes.lw} px, Ende ${ende.lw} px)`, erstes.lw === ende.lw, erstes);
      const breiten = [...new Set(sichtbar.map((b) => b.lw))];
      pruefe(`${tag}: Layout-Breite springt nach dem Erscheinen nicht (${breiten.join(' -> ')})`, breiten.length === 1, breiten);
      if (bew === 'aus') pruefe(`${tag}: erstes sichtbares Bild steht gemalt schon in der Endlage (${erstes.w}x${erstes.x},${erstes.y} gegen ${ende.w}x${ende.x},${ende.y})`,
        erstes.w === ende.w && erstes.x === ende.x && erstes.y === ende.y, { erstes, ende });
      endeJe[bew] = ende.lw;
      console.log(`ENDE ${g[0]} ${a} ${bew} ${ende.lw}`);
    }
    if (endeJe.normal != null && endeJe.aus != null) pruefe(`${g[0]} ${a}: Endbreite gleich mit und ohne Bewegung (${endeJe.normal} / ${endeJe.aus})`, endeJe.normal === endeJe.aus);
  }
} catch (e) { pruefe('Probe laeuft ohne Abbruch', false, e.stack); }
finally { await browser?.close(); await new Promise((r) => server.close(r)); }
pruefe('keine Seitenfehler', !fehlerSeite.length, fehlerSeite);
console.log(`${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
