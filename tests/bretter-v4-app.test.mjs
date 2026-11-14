// Motiv-Bretter Fassung 4 in der App (Flo 14.11.2026: "ja die Schachbretter sehen gut aus", alle 20 kommen in die App).
// Die 20 Bretter liegen im Labor (js/labor.js MOTIV_BRETTER, nur das Erfinder-Konto), Seltenheit und geplanter Weg stehen
// als eine Liste dort und nur dort (js/brett-motive-v4.js uebernimmt sie). Geprueft wird:
//   Katalog      MOTIV_BRETTER und MOTIVE haben dieselben Ids in derselben Reihenfolge, Farben wie die Gestaltung
//                (feldFarben, rahmen.linie), Seltenheit und Weg kommen aus dem Katalog; Einstellung, Labor und Namen de/en
//   Ansichten    Bot-Partie, Online-Partie, Zu zweit, Raetsel-Duell: Rahmen am Sockel (.brett-rahmen), Feldtextur, Feld- und
//                Koordinatenfarbe wie die Gestaltung; ein Wechsel bei offener Ansicht wirkt sofort (Nacht, dann zurueck)
//   Handy        die Bot-Partie bleibt von Rand zu Rand (Flo 31.10.2026), ohne Rahmen, die Felder tragen das Motiv
//   Sammlung     das Erfinder-Konto sieht die 20 Bretter mit Zeichnung im Sammelbild
//   Gegenprobe   ohne Erfinder-Konto faellt ein gespeichertes v4-Brett auf Nacht, kein Rahmen, kein Eintrag in der Sammlung
// Netzwerk ausschliesslich simuliert (wie tests/funktion-shop-skin.test.mjs).
//   node tests/bretter-v4-app.test.mjs
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Chess } from '../vendor/chess/chess.js';
import { browserTyp } from './browser.mjs';

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
  return gut;
}
const laden = async (p) => { try { return await import(p); } catch (e) { pruefe('Modul ladbar: ' + p, false, e.message); return {}; } };

// ---------- Katalog (ohne Browser)
const { MOTIV_BRETTER = [], LABOR_BRETTER = [], istLabor = () => false } = await laden('../js/labor.js');
const { MOTIVE = [], feldFarben, koordFarben } = await laden('../js/brett-motive-v4.js');
const { EINSTELLUNG_WERTE = { brett: [] } } = await laden('../js/storage.js');
const { t, setzeSprache } = await laden('../js/sprache.js');
await laden('../js/pakete/sammlung/texte.js');
const ids = MOTIV_BRETTER.map((b) => b.id);
pruefe('Katalog: 20 Motiv-Bretter, dieselben Ids und Reihenfolge wie die Gestaltung', ids.length === 20 && ids.join() === MOTIVE.map((m) => m.id).join(), { ids, motive: MOTIVE.map((m) => m.id) });
pruefe('Katalog: keine Id doppelt, auch nicht mit den 65 Labor- und freien Brettern', new Set([...ids, ...LABOR_BRETTER.map((b) => b.id), 'nacht', 'gruen', 'holz']).size === ids.length + LABOR_BRETTER.length + 3);
const farbe = MOTIVE.filter((m) => { const b = MOTIV_BRETTER.find((x) => x.id === m.id), f = feldFarben?.(m); return !b || !f || b.hell !== f.h || b.dunkel !== f.d || b.rand !== m.rahmen.linie; });
pruefe('Katalog: Farben wie die Gestaltung (Felder hell/dunkel, Rand = Rahmenlinie)', MOTIVE.length === 20 && farbe.length === 0, farbe.map((m) => m.id));
const wegAnders = MOTIVE.filter((m) => { const b = MOTIV_BRETTER.find((x) => x.id === m.id); return !b || m.seltenheit !== b.seltenheit || JSON.stringify(m.weg) !== JSON.stringify(b.weg); });
pruefe('Katalog: Seltenheit und Weg der Gestaltung kommen aus MOTIV_BRETTER (eine Liste)', MOTIVE.length === 20 && wegAnders.length === 0, wegAnders.map((m) => m.id));
pruefe('Katalog: jedes Brett ist Labor (nur Erfinder) und in der Einstellung brett erlaubt', ids.length > 0 && ids.every((id) => istLabor('brett', id) && EINSTELLUNG_WERTE.brett.includes(id)),
  ids.filter((id) => !istLabor('brett', id) || !EINSTELLUNG_WERTE.brett.includes(id)));
for (const sp of ['de', 'en']) {
  setzeSprache?.(sp);
  const fehlt = ids.filter((id) => { const n = t?.('p-sammlung.brett.' + id); return !n || n === 'p-sammlung.brett.' + id; });
  pruefe(`Name je Motiv-Brett (${sp})`, ids.length > 0 && fehlt.length === 0, fehlt);
}
setzeSprache?.('de');
const alleNamen = [...LABOR_BRETTER.map((b) => b.id), 'nacht', 'gruen', 'holz', ...ids].map((id) => t?.('p-sammlung.brett.' + id));
pruefe('Deutsche Namen verschieden ueber alle Bretter', new Set(alleNamen).size === alleNamen.length, alleNamen.filter((n, i, a) => a.indexOf(n) !== i));

// ---------- Browser
const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + new URL(req.url, 'http://test').pathname.replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p)); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const UID = 'u1';
const sitzung = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'test-r', expires_at: 9999999999, user: { id: UID, email: 'spieler@example.invalid' } };
const START_FEN = new Chess().fen();
const ONLINE = { id: 'partie-1', code: 'ABC234', weiss: UID, schwarz: 'u2', erstellt_von: UID, status: 'laeuft', fen: START_FEN, am_zug: 'w', zuege: '',
  ergebnis: null, grund: null, remis_angebot: null, bedenkzeit_s: null, inkrement_s: 0, uhr_weiss_ms: null, uhr_schwarz_ms: null,
  letzter_zug_am: new Date().toISOString(), erstellt_am: new Date().toISOString(), aktualisiert_am: new Date().toISOString(), gewertet: false };
const DUELL = '7d0c9a52-1b3e-4f6a-9c8d-2e1f0a9b8c7d';
const RAETSEL = { fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', loesung: ['a1a8'], rating: 700 };
let duellStart = null;
const duellStand = () => (duellStart ? { duell: DUELL, art: 'ki', status: 'laeuft', jetzt: new Date().toISOString(), start_am: new Date(duellStart).toISOString(),
  ich: { geloest: 0, fehler: 0, ende_am: new Date(duellStart + 180000).toISOString() },
  gegner: { geloest: 0, fehler: 0, ende_am: new Date(duellStart + 180000).toISOString(), ki: true, elo: 1200 },
  raetsel: { nr: 1, fen: RAETSEL.fen, bisher: [], rating: RAETSEL.rating } } : { fehler: 'DUELL_UNBEKANNT' });
const bediene = (stuecke) => async (route) => {
  const req = route.request(), url = new URL(req.url());
  let body = {}; try { body = req.postDataJSON() || {}; } catch (e) { body = {}; }
  const antwort = d => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (url.pathname.startsWith('/auth/v1/')) return antwort({ id: UID, email: 'spieler@example.invalid' });
  if (url.pathname === '/rest/v1/sonderstuecke') return antwort(stuecke.map(stueck_id => ({ stueck_id })));
  if (url.pathname === '/rest/v1/altersangaben') return antwort([{ ab18: true }]);
  if (url.pathname === '/rest/v1/profile') return antwort([{ user_id: UID, benutzername: 'Spieler_1' }]);
  if (url.pathname === '/rest/v1/partien_online') {
    if (url.searchParams.has('status')) return antwort([]);
    return antwort((url.searchParams.get('id') || '').slice(3) === ONLINE.id ? [ONLINE] : []);
  }
  const rpc = url.pathname.split('/').at(-1);
  if (rpc === 'online_meine') return antwort([ONLINE]);
  if (rpc === 'kronen_mein_stand') return antwort({ stufe: 7, kronen: 140, platz: 3, ziel: 120, n: 30, woche: '2026-11-09' });
  if (rpc === 'online_live_bewertung_frei') return antwort({ frei: true, rest: 1, unbegrenzt: false });
  if (rpc === 'karte_melde_stufen' || rpc === 'karte_waehle') return antwort({ taler: 0, stufen: {}, banner: ['start'], wahl: { banner: 'start' } });
  if (rpc === 'karte_der_partie') {
    const karte = (name, du) => ({ name, banner: 'saison-silber', titel: 'erfolg-feuertaufe', vitrine: [], motiv: 'Q', grund: 'standard', rahmen: 'ohne', kronen_stufe: 7, du });
    return antwort({ w: karte('Spieler_1', true), s: karte('Gegner_2', false) });
  }
  if (rpc === 'duell_suche_start' || rpc === 'duell_suche_stand') return antwort({});
  if (rpc === 'duell_suche_ende') { if (body.ki === true) { duellStart = Date.now() + 1200; return antwort({ duell: DUELL }); } return antwort({}); }
  if (rpc === 'duell_stand') return antwort(duellStand());
  return antwort([]);
};

const MOTIV = 'kirchenfenster';
const m = MOTIVE.find((x) => x.id === MOTIV);
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };
const SOLL = m ? { feld: rgb(feldFarben(m).h), koord: rgb(koordFarben(m).h) } : {};
// Messung am Brett einer Ansicht: Sockel (.brett-rahmen) mit Rahmenbild und Polster, erstes helles Feld mit Textur und Farbe,
// Koordinate auf einem hellen Feld
const miss = (s, sel) => s.evaluate((sel) => {
  const b = document.querySelector(sel); if (!b) return null;
  const r = b.closest('.brett-rahmen'), cs = r && getComputedStyle(r);
  const h = b.querySelector('.feld.h'), hc = h && getComputedStyle(h), k = b.querySelector('.feld.h .koord');
  return { brett: document.documentElement.dataset.brett, rahmenBild: !!cs && cs.backgroundImage.includes('data:image/svg'), polster: cs ? parseFloat(cs.paddingTop) : -1,
    feldBild: !!hc && hc.backgroundImage.includes('data:image/svg'), feld: hc ? hc.backgroundColor : null, koord: k ? getComputedStyle(k).color : null };
}, sel);
const istMotiv = (r) => !!r && r.brett === MOTIV && r.rahmenBild && r.polster > 0 && r.feldBild && r.feld === SOLL.feld && r.koord === SOLL.koord;
async function warteMotiv(s, sel, an = true) {
  await s.waitForFunction(({ sel, an }) => {
    const r = document.querySelector(sel)?.closest('.brett-rahmen');
    return !!r && getComputedStyle(r).backgroundImage.includes('data:image/svg') === an;
  }, { sel, an }, { timeout: 8000 }).catch(() => {});
}
async function ansicht(s, name, sel) {
  await warteMotiv(s, sel);
  const r = await miss(s, sel);
  pruefe(`${name}: Rahmen, Feldtextur, Feld- und Koordinatenfarbe von "${MOTIV}"`, istMotiv(r), { ist: r, soll: SOLL });
  await s.evaluate(() => window.__app.setzeEinstellungen({ brett: 'nacht' }));
  await warteMotiv(s, sel, false);
  const nacht = await miss(s, sel);
  await s.evaluate((id) => window.__app.setzeEinstellungen({ brett: id }), MOTIV);
  await warteMotiv(s, sel);
  const zurueck = await miss(s, sel);
  pruefe(`${name}: Wechsel bei offener Ansicht wirkt sofort (Nacht ohne Rahmen, dann wieder "${MOTIV}")`,
    !!nacht && nacht.brett === 'nacht' && !nacht.rahmenBild && istMotiv(zurueck), { nacht, zurueck });
}
async function kontextMit(browser, stuecke, viewport, mobil = false) {
  const k = await browser.newContext({ viewport, hasTouch: true, isMobile: mobil, serviceWorkers: 'block', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  await k.route('**/*.supabase.co/**', bediene(stuecke));
  await k.addInitScript(({ s, uid, stuecke, brett }) => {
    if (!sessionStorage.getItem('probe-start')) {
      sessionStorage.setItem('probe-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'aus', liveBewertung: false, tiefe: 8, brett }));
      localStorage.setItem('schach-arena:konto:sichtbar', '1');
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(s));
      localStorage.setItem('schach-arena:konto:sonderstuecke', JSON.stringify({ konto: uid, ids: stuecke }));
    }
    window.__test = { ...window.__test, botAnhalten: true, maxWarten: 0 };
    window.__duellKiMs = 400; window.__duellAbfrageMs = 250;
  }, { s: sitzung, uid: UID, stuecke, brett: MOTIV });
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  const fehler = [];
  s.on('pageerror', e => fehler.push(e.message));
  await s.goto(`http://127.0.0.1:${PORT}/index.html?test#heim`);
  await s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function' && document.querySelector('.screen.heim-screen'), null, { timeout: AUFBAU_MS });
  return { k, s, fehler };
}
async function momenteWeg(s) {
  for (let i = 0; i < 12 && await s.locator('.st-moment .st-weiter').count(); i++) { await s.locator('.st-moment .st-weiter').first().click(); await s.waitForTimeout(250); }
}
async function sammlungBretter(s) {
  await s.evaluate(() => window.__app.gehe('ich'));
  await s.waitForSelector('.sa-screen', { timeout: 30000 });
  await s.waitForTimeout(400); await momenteWeg(s);
  await s.locator('.sa-platz[data-bereich="bretter"], .sa-gross[data-bereich="bretter"]').first().click();
  await s.waitForSelector('.sa-blatt .sa-bereich[data-bereich="bretter"]:not([hidden])', { timeout: 10000 });
  // die Zeichnung kommt mit js/brett-motive-v4.js nach (wie die Oberflaechen), darum kurz warten
  await s.waitForFunction((id) => document.querySelector(`.sa-blatt .sa-teil[data-teil="brett-${id}"] .sk-muster`), MOTIV, { timeout: 8000 }).catch(() => {});
  return s.evaluate((ids) => ids.map((id) => { const t = document.querySelector(`.sa-blatt .sa-teil[data-teil="brett-${id}"]`); return { id, da: !!t, muster: !!t?.querySelector('.sk-muster') }; }), ids);
}
const BOT = '.screen.partie:not(.online-screen) .brett-rahmen > .brett';
const AUFBAU_MS = 45000;

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  // 1) Erfinder am PC: vier Partie-Ansichten
  {
    const { k, s, fehler } = await kontextMit(browser, ['erfinder-titel'], { width: 1180, height: 820 });
    await s.evaluate(() => window.__app.gehe('partie', { botId: 'benno', farbe: 'w' }));
    await s.waitForFunction((sel) => document.querySelectorAll(sel + ' .feld').length === 64, BOT, { timeout: AUFBAU_MS }).catch(() => {});
    await ansicht(s, 'bot-partie', BOT);

    await s.evaluate(id => window.__app.gehe('online', { partieId: id }), ONLINE.id);
    await s.waitForFunction(() => window.__online?.brett() && document.querySelectorAll('.screen').length === 1
      && document.querySelector('.on-brett')?.getBoundingClientRect().width > 100, null, { timeout: 15000 }).catch(() => {});
    await ansicht(s, 'online-partie', '.on-brett');

    await s.evaluate(() => window.__app.gehe('heim'));
    await s.locator('[data-aktion="heim-zuzweit"]').click();
    await s.getByRole('button', { name: 'Los', exact: true }).click();
    if (await s.getByRole('button', { name: 'Neue Partie', exact: true }).isVisible().catch(() => false)) await s.getByRole('button', { name: 'Neue Partie', exact: true }).click();
    await s.waitForFunction(() => window.__partie?.z?.modus === 'zuzweit' && document.querySelectorAll('.zz-brett .feld').length === 64, null, { timeout: 15000 }).catch(() => {});
    await ansicht(s, 'zu-zweit', '.zz-brett');

    await s.evaluate(() => window.__app.gehe('raetsel-duell'));
    await s.waitForSelector('.screen.raetsel-duell[data-phase="start"] .rd-suchen', { timeout: 30000 });
    await s.locator('.rd-suchen').click();
    await s.waitForFunction(() => document.querySelectorAll('.screen.raetsel-duell .rd-brett .feld').length === 64, null, { timeout: 15000 }).catch(() => {});
    await ansicht(s, 'raetsel-duell', '.screen.raetsel-duell .rd-brett');

    const samm = await sammlungBretter(s);
    pruefe('Sammlung (Erfinder): alle 20 Motiv-Bretter mit Zeichnung im Sammelbild', samm.length === 20 && samm.every((x) => x.da && x.muster), samm.filter((x) => !x.da || !x.muster));
    pruefe('Erfinder: keine Seitenfehler', fehler.length === 0, fehler);
    await k.close();
  }
  // 2) Erfinder am Handy hochkant: Bot-Partie von Rand zu Rand, Felder mit Motiv
  {
    const { k, s, fehler } = await kontextMit(browser, ['erfinder-titel'], { width: 390, height: 844 }, true);
    await s.evaluate(() => window.__app.gehe('partie', { botId: 'benno', farbe: 'w' }));
    await s.waitForFunction((sel) => document.querySelectorAll(sel + ' .feld').length === 64, BOT, { timeout: AUFBAU_MS }).catch(() => {});
    await s.waitForFunction((sel) => getComputedStyle(document.querySelector(sel + ' .feld.h')).backgroundImage.includes('data:image/svg'), BOT, { timeout: 8000 }).catch(() => {});
    const r = await miss(s, BOT);
    pruefe('Handy: Bot-Partie ohne Rahmen von Rand zu Rand, Felder mit Textur und Farbe des Motivs',
      !!r && r.brett === MOTIV && !r.rahmenBild && r.polster === 0 && r.feldBild && r.feld === SOLL.feld, { ist: r, soll: SOLL });
    pruefe('Handy: keine Seitenfehler', fehler.length === 0, fehler);
    await k.close();
  }
  // 3) Gegenprobe ohne Erfinder: gespeichertes v4-Brett faellt auf Nacht, nichts in der Sammlung
  {
    const { k, s, fehler } = await kontextMit(browser, [], { width: 1180, height: 820 });
    await s.evaluate(() => window.__app.gehe('partie', { botId: 'benno', farbe: 'w' }));
    await s.waitForFunction((sel) => document.querySelectorAll(sel + ' .feld').length === 64, BOT, { timeout: AUFBAU_MS }).catch(() => {});
    await s.waitForTimeout(600);
    const r = await miss(s, BOT);
    pruefe('Gegenprobe ohne Erfinder: Brett faellt auf Nacht, kein Rahmen, keine Textur', !!r && r.brett === 'nacht' && !r.rahmenBild && !r.feldBild, r);
    const samm = await sammlungBretter(s);
    pruefe('Gegenprobe ohne Erfinder: kein Motiv-Brett in der Sammlung', samm.length === 20 && samm.every((x) => !x.da), samm.filter((x) => x.da));
    pruefe('Gegenprobe: keine Seitenfehler', fehler.length === 0, fehler);
    await k.close();
  }
} catch (e) { pruefe('Ablauf ohne Abbruch', false, e.stack); }
finally { await browser?.close(); await new Promise(r => server.close(r)); }
console.log(`\n${ok}/${gesamt} bestanden`); process.exitCode = ok === gesamt ? 0 : 1;
