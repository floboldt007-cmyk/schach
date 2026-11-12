// Funktionsprobe Shop plus Skin (Feinschliff 12.11.2026, Auftrag F-shop): ein Konto oeffnet die Sammlung, schaut im Shop
// eine Edition an (Anprobieren, nie kaufen), sieht die Vorschau des Figurensatzes, waehlt ihn aus und findet genau diesen
// Satz danach in JEDER Partie-Ansicht wieder: Bot-Partie, Online-Partie, Zu zweit, Raetsel-Duell, Meisterschule-Lektion.
// Erkennbar am Bildpfad der Figuren im Brett (assets/pieces/<satz>/). Kein Kauf, kein Stripe: der Satz "blaupause" ist
// waehlbar, weil das Konto das Sonderstueck besitzt (Attrappe von /rest/v1/sonderstuecke wie tests/online-ui.test.mjs,
// dazu der gemerkte Stand im Speicher wie tests/raetsel-duell-ui.test.mjs). Netzwerk ausschliesslich simuliert.
//
//   node tests/funktion-shop-skin.test.mjs                      Probe (Zu zweit und Lektion melden sich als ROT-ERWARTET)
//   PROBE_STRENG=1 node tests/funktion-shop-skin.test.mjs       auch die harten Pruefungen zaehlen (fuer die Reparatur R4-skin2)
//   PROBE_SKIN=neon node tests/funktion-shop-skin.test.mjs      ein Labor-Satz (nur Erfinder, js/labor.js) statt Blaupause
//   node tests/funktion-shop-skin.test.mjs --bilder=<ordner>    je Ansicht ein Bild (<ansicht>.png)
//   PORT=9631 node tests/funktion-shop-skin.test.mjs            eigener Port (Standard 8981)
//
// Je Ansicht zwei Pruefungen: der gewaehlte Satz steht im Brett, und ein Wechsel bei offener Ansicht wirkt sofort (spaeter
// Erfinder-Status, R3/R4). Harte Pruefungen (hart: true): Zu zweit und Lektion, dort baut so/R4-skin2 die Reparatur, dazu
// der Wechsel im Raetsel-Duell (Befund F-shop, noch ohne Reparatur). Ohne PROBE_STRENG=1
// erscheinen sie rot als "ROT-ERWARTET" und blockieren nichts (tests/alle.mjs zaehlt nur "FEHLER" und den Exitcode).
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Chess } from '../vendor/chess/chess.js';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
const STRENG = process.env.PROBE_STRENG === '1';
const SKIN = process.env.PROBE_SKIN || 'blaupause';
const bilderArg = process.argv.find((a) => a.startsWith('--bilder='));
const BILDER = bilderArg ? bilderArg.slice(9) : null;
if (BILDER) mkdirSync(BILDER, { recursive: true });
const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + new URL(req.url, 'http://test').pathname.replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p)); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT || 8981);
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const UID = 'u1';
const sitzung = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'test-r', expires_at: 9999999999, user: { id: UID, email: 'spieler@example.invalid' } };
// Blaupause gehoert dem Konto als Sonderstueck; ein Labor-Satz braucht dazu das Erfinder-Konto (erfinder-titel)
const STUECKE = ['erfinder-titel', 'erfinder-figuren-blaupause'];
const EDITION = { produkt_id: 'brett-mitternacht', name: 'Mitternacht & Gold', auflage: 10, status: 'erhaeltlich', restzahl: 9, verkauf_ab: '2026-11-28T10:00:00Z' };

let ok = 0, gesamt = 0, rotErwartet = 0;
const rot = [], fehler = [], ergebnis = [];
function pruefe(name, gut, detail = '', { hart = false } = {}) {
  if (hart && !STRENG && !gut) { rotErwartet++; rot.push(name); console.log(`ROT-ERWARTET ${name} ${JSON.stringify(detail)}`); return gut; }
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
  return gut;
}

// ---- Server-Attrappe: Shop (edition_staende), Online (eine laufende Partie), Raetsel-Duell (KI-Duell) ----
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
const editionAnfragen = [];

async function bediene(route) {
  const req = route.request(), url = new URL(req.url());
  let body = {}; try { body = req.postDataJSON() || {}; } catch (e) { body = {}; }
  const antwort = d => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
  if (url.pathname.startsWith('/auth/v1/')) return antwort({ id: UID, email: 'spieler@example.invalid' });
  if (url.pathname === '/rest/v1/sonderstuecke') return antwort(STUECKE.map(stueck_id => ({ stueck_id })));
  if (url.pathname === '/rest/v1/altersangaben') return antwort([{ ab18: true }]);
  if (url.pathname === '/rest/v1/profile') return antwort([{ user_id: UID, benutzername: 'Spieler_1' }]);
  if (url.pathname === '/rest/v1/partien_online') {
    if (url.searchParams.has('status')) return antwort([]);
    return antwort((url.searchParams.get('id') || '').slice(3) === ONLINE.id ? [ONLINE] : []);
  }
  const rpc = url.pathname.split('/').at(-1);
  if (rpc === 'edition_staende') { editionAnfragen.push(body); return antwort([EDITION]); }
  if (rpc === 'online_meine') return antwort([ONLINE]);
  if (rpc === 'kronen_mein_stand') return antwort({ stufe: 7, kronen: 140, platz: 3, ziel: 120, n: 30, woche: '2026-11-09' });
  if (rpc === 'online_live_bewertung_frei') return antwort({ frei: true, rest: 1, unbegrenzt: false });
  if (rpc === 'karte_melde_stufen' || rpc === 'karte_waehle') return antwort({ taler: 0, stufen: {}, banner: ['start'], wahl: { banner: 'start' } });
  if (rpc === 'karte_der_partie') {
    const karte = (name, du) => ({ name, banner: 'saison-silber', titel: 'erfolg-feuertaufe', vitrine: [], motiv: 'Q', grund: 'standard', rahmen: 'ohne', kronen_stufe: 7, du });
    return antwort({ w: karte('Spieler_1', true), s: karte('Gegner_2', false) });
  }
  // Raetsel-Duell wie tests/raetsel-duell-ui.test.mjs: niemand da, nach der Wartezeit legt der Server ein KI-Duell an
  if (rpc === 'duell_suche_start' || rpc === 'duell_suche_stand') return antwort({});
  if (rpc === 'duell_suche_ende') { if (body.ki === true) { duellStart = Date.now() + 1200; return antwort({ duell: DUELL }); } return antwort({}); }
  if (rpc === 'duell_stand') return antwort(duellStand());
  return antwort([]);
}

// Figurensatz auf einem Brett: Bildpfade der Figuren (img.figur), wie viele im Satz, wie viele geladen
const satzAuf = (s, sel) => s.evaluate(({ sel, skin }) => {
  const b = document.querySelector(sel); if (!b) return { da: false, n: 0, imSatz: 0, geladen: 0, beispiel: [] };
  const bilder = [...b.querySelectorAll('img.figur')];
  const pfade = bilder.map(i => i.getAttribute('src') || '');
  return { da: true, n: bilder.length, imSatz: pfade.filter(p => p.includes('/pieces/' + skin + '/')).length,
    geladen: bilder.filter(i => i.complete && i.naturalWidth > 0).length, beispiel: [...new Set(pfade.map(p => p.replace(/[^/]+\.svg$/, '')))].slice(0, 3) };
}, { sel, skin: SKIN });
const imSatz = r => r.da && r.n > 0 && r.imSatz === r.n && r.geladen === r.n;
async function bild(s, name) { if (BILDER) await s.screenshot({ path: path.join(BILDER, name + '.png') }).catch(e => console.log('Bild ' + name + ': ' + e.message)); }
// hartWechsel: nur die Wechsel-Pruefung ist hart (Raetsel-Duell, Befund F-shop 12.11.: der Satz folgt dort nicht, solange
// das Duell offen ist; noch ohne Reparatur, nicht Teil von so/R4-skin2)
async function ansicht(s, name, sel, { hart = false, hartWechsel = hart } = {}) {
  // Figuren erscheinen, sobald das Brett steht; der Satz kann noch nachkommen (Einstellungen spaet), darum bis 4 s warten
  await s.waitForFunction(({ sel, skin }) => {
    const i = [...document.querySelectorAll(sel + ' img.figur')];
    return i.length > 0 && i.every(x => (x.getAttribute('src') || '').includes('/pieces/' + skin + '/') && x.complete && x.naturalWidth > 0);
  }, { sel, skin: SKIN }, { timeout: 4000 }).catch(() => {});
  const r = await satzAuf(s, sel);
  await bild(s, name);
  const gut = imSatz(r);
  ergebnis.push({ ansicht: name, geht: gut, ...r });
  pruefe(`${name}: das Brett zeigt den gewaehlten Satz "${SKIN}" (alle Figuren, Bilder geladen)`, gut, r, { hart });
  // Wechsel bei offener Ansicht (spaeter Erfinder-Status oder neue Wahl, R3/R4): Standard und zurueck, ohne Neuladen
  await s.evaluate(() => window.__app.setzeEinstellungen({ figuren: 'cburnett' }));
  await s.waitForTimeout(150);
  const standard = await satzAuf(s, sel);
  await s.evaluate((skin) => window.__app.setzeEinstellungen({ figuren: skin }), SKIN);
  await s.waitForTimeout(150);
  const zurueck = await satzAuf(s, sel);
  pruefe(`${name}: ein Wechsel bei offener Ansicht wirkt sofort (Standard, dann wieder "${SKIN}")`,
    standard.n > 0 && standard.imSatz === 0 && imSatz(zurueck), { standard, zurueck }, { hart: hartWechsel });
  ergebnis.at(-1).wechsel = standard.n > 0 && standard.imSatz === 0 && imSatz(zurueck);
  return r;
}
// "Ich" zeigt beim Start gebuchte Stufen als Freischalt-Moment; wegtippen wie ein Spieler (tests/sammlung.test.mjs)
async function momenteWeg(s) {
  for (let i = 0; i < 12 && await s.locator('.st-moment .st-weiter').count(); i++) { await s.locator('.st-moment .st-weiter').first().click(); await s.waitForTimeout(250); }
}
async function blattZu(s) {
  if (!await s.locator('.sa-blatt').count()) return;
  await s.locator('.sa-blatt .sheet-knoepfe button').first().click();
  await s.waitForSelector('.sa-blatt', { state: 'detached', timeout: 10000 }).catch(() => {});
}
async function oeffneBereich(s, id) {
  await blattZu(s);
  await s.locator(`.sa-platz[data-bereich="${id}"], .sa-gross[data-bereich="${id}"]`).first().click();
  await s.waitForSelector(`.sa-blatt .sa-bereich[data-bereich="${id}"]:not([hidden])`, { timeout: 10000 });
  await s.waitForTimeout(300);
}
const BOT = '.screen.partie:not(.online-screen) .brett-rahmen > .brett';
// Erster Aufbau eines Screens (Pakete, Engine) dauert unter Last laenger: am 12.11. lief der erste Bot-Aufbau bei 41
// parallelen Browser-/Node-Prozessen ueber 20 s
const AUFBAU_MS = 45000;

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  const kontext = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, serviceWorkers: 'block', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  await kontext.route('**/*.supabase.co/**', bediene);
  await kontext.addInitScript(({ s, uid, stuecke }) => {
    // nur beim ersten Laden: danach gilt, was die Oberflaeche gespeichert hat (die Wahl im Shop)
    if (!sessionStorage.getItem('probe-start')) {
      sessionStorage.setItem('probe-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'aus', liveBewertung: false, tiefe: 8, figuren: 'cburnett' }));
      localStorage.setItem('schach-arena:konto:sichtbar', '1');
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(s));
      localStorage.setItem('schach-arena:konto:sonderstuecke', JSON.stringify({ konto: uid, ids: stuecke }));
    }
    // Bot haelt an (Stellung bleibt stehen), Raetsel-Duell sucht kurz (wie tests/raetsel-duell-ui.test.mjs)
    window.__test = { ...window.__test, botAnhalten: true, maxWarten: 0 };
    window.__duellKiMs = 400; window.__duellAbfrageMs = 250;
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  }, { s: sitzung, uid: UID, stuecke: STUECKE });
  const s = await kontext.newPage(); s.setDefaultTimeout(15000);
  s.on('pageerror', e => fehler.push(e.message));
  await s.goto(`http://127.0.0.1:${PORT}/index.html?test#heim`);
  await s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function');

  // 0) Gegenprobe vor der Wahl: mit dem Standardsatz zeigt das Bot-Brett KEINE Figur aus dem Satz (sonst misst die Probe nichts)
  await s.evaluate(() => window.__app.gehe('partie', { botId: 'benno', farbe: 'w' }));
  await s.waitForFunction((sel) => document.querySelectorAll(sel + ' img.figur').length === 32, BOT, { timeout: AUFBAU_MS });
  const vorher = await satzAuf(s, BOT);
  pruefe(`Gegenprobe: vor der Wahl steht im Bot-Brett der Standardsatz, keine Figur aus "${SKIN}"`, vorher.n === 32 && vorher.imSatz === 0, vorher);

  // 1) Shop: Sammlung auf "Ich", Shop-Bereich, Edition anprobieren (Vorschau), nichts kaufen
  await s.evaluate(() => window.__app.gehe('ich'));
  await s.waitForSelector('.sa-screen', { timeout: 30000 });
  await s.waitForTimeout(400); await momenteWeg(s);
  await oeffneBereich(s, 'shop');
  await s.waitForSelector('.sa-blatt .sh-karte', { timeout: 15000 }).catch(() => {});
  const karte = await s.evaluate(() => { const k = document.querySelector('.sa-blatt .sh-karte'); const kauf = k?.querySelector('.sh-kaufen');
    return k ? { produkt: k.dataset.produkt, kaufAus: !!kauf && kauf.disabled } : null; });
  pruefe('Shop: die Edition steht im Shop, der Kaufknopf ist abgeschaltet (kein Kauf moeglich)', !!karte && karte.produkt === EDITION.produkt_id && karte.kaufAus, karte);
  await bild(s, '0-shop');
  await s.locator('.sa-blatt .sh-anprobieren').click();
  const anprobe = await s.waitForSelector('.sheet-karte .sh-brett.gross', { timeout: 5000 }).then(() => true).catch(() => false);
  pruefe('Shop: Anprobieren zeigt die Vorschau im Blatt', anprobe);
  await bild(s, '1-shop-vorschau');
  await s.locator('.sheet-karte .sheet-knoepfe button').first().click();
  await s.waitForSelector('.sh-anprobe', { state: 'detached', timeout: 5000 }).catch(() => {});

  // 2) Figurensatz: Vorschau (Springer und Koenig des Satzes) ansehen, dann auswaehlen
  await oeffneBereich(s, 'figuren');
  const teil = `.sa-blatt .sa-teil[data-teil="figuren-${SKIN}"]`;
  const vorschau = await s.evaluate((sel) => { const t = document.querySelector(sel);
    return t ? { zustand: t.dataset.zustand, bilder: [...t.querySelectorAll('.sk-figuren img')].map(i => ({ src: i.getAttribute('src'), geladen: i.complete && i.naturalWidth > 0 })) } : null; }, teil);
  pruefe(`Figurensatz-Vorschau: "${SKIN}" steht in der Sammlung, noch nicht ausgeruestet, Bilder aus dem Satz geladen`, !!vorschau && vorschau.zustand === 'frei'
    && vorschau.bilder.length === 2 && vorschau.bilder.every(b => b.src.includes('/pieces/' + SKIN + '/') && b.geladen), vorschau);
  await bild(s, '2-figuren-vorschau');
  await s.locator(teil + ' .sa-wahl').click();
  await s.waitForFunction((sel) => document.querySelector(sel)?.dataset.zustand === 'an', teil, { timeout: 10000 }).catch(() => {});
  const gewaehlt = await s.evaluate((sel) => ({ zustand: document.querySelector(sel)?.dataset.zustand,
    figuren: JSON.parse(localStorage.getItem('schach-arena:v1:einstellungen') || '{}').figuren }), teil);
  pruefe(`Auswahl: "${SKIN}" ist ausgeruestet und gespeichert`, gewaehlt.zustand === 'an' && gewaehlt.figuren === SKIN, gewaehlt);
  await blattZu(s);

  // 3) Bot-Partie
  await s.evaluate(() => window.__app.gehe('partie', { botId: 'benno', farbe: 'w' }));
  await s.waitForFunction((sel) => document.querySelectorAll(sel + ' img.figur').length === 32, BOT, { timeout: AUFBAU_MS }).catch(() => {});
  await ansicht(s, 'bot-partie', BOT);

  // 4) Online-Partie (laufende Partie aus der Attrappe, direkt geoeffnet wie tests/online-ui.test.mjs)
  await s.evaluate(id => window.__app.gehe('online', { partieId: id }), ONLINE.id);
  await s.waitForFunction(() => window.__online?.brett() && document.querySelectorAll('.screen').length === 1
    && document.querySelector('.on-brett')?.getBoundingClientRect().width > 100, null, { timeout: 15000 }).catch(() => {});
  await ansicht(s, 'online-partie', '.on-brett');

  // 5) Zu zweit (Einstieg Startseite, Los)
  await s.evaluate(() => window.__app.gehe('heim'));
  await s.locator('[data-aktion="heim-zuzweit"]').click();
  await s.getByRole('button', { name: 'Los', exact: true }).click();
  if (await s.getByRole('button', { name: 'Neue Partie', exact: true }).isVisible().catch(() => false)) await s.getByRole('button', { name: 'Neue Partie', exact: true }).click();
  await s.waitForFunction(() => window.__partie?.z?.modus === 'zuzweit' && document.querySelectorAll('.zz-brett img.figur').length === 32, null, { timeout: 15000 }).catch(() => {});
  await ansicht(s, 'zu-zweit', '.zz-brett', { hart: true });

  // 6) Raetsel-Duell (KI-Duell nach kurzer Suche, Brett im Vorlauf)
  await s.evaluate(() => window.__app.gehe('raetsel-duell'));
  await s.waitForSelector('.screen.raetsel-duell[data-phase="start"] .rd-suchen', { timeout: 30000 });
  await s.locator('.rd-suchen').click();
  await s.waitForFunction(() => document.querySelectorAll('.screen.raetsel-duell .rd-brett img.figur').length > 0, null, { timeout: 15000 }).catch(() => {});
  await ansicht(s, 'raetsel-duell', '.screen.raetsel-duell .rd-brett', { hartWechsel: true });

  // 7) Meisterschule-Lektion
  await s.evaluate(() => window.__app.gehe('lektion', { id: 'skandinavisch' }));
  await s.waitForFunction(() => document.querySelectorAll('.ls-brett img.figur').length > 0, null, { timeout: AUFBAU_MS }).catch(() => {});
  await ansicht(s, 'lektion', '.ls-brett', { hart: true });

  pruefe('Kein Kauf: der Shop hat nur Editionen gelesen, keine Kauf-Anfrage', !editionAnfragen.some(b => Object.keys(b).length));
  pruefe('Keine Seitenfehler', fehler.length === 0, fehler);
} catch (e) { pruefe('Ablauf ohne Abbruch', false, e.stack); }
finally { await browser?.close(); await new Promise(r => server.close(r)); }
console.log('\nJe Ansicht (Satz ' + SKIN + '):');
for (const r of ergebnis) console.log(`  ${r.geht ? 'geht      ' : 'geht nicht'}  ${r.ansicht}  (${r.imSatz}/${r.n} im Satz, ${r.geladen} geladen, Pfade ${r.beispiel.join(' ')}; Wechsel bei offener Ansicht ${r.wechsel ? 'geht' : 'geht nicht'})`);
if (rotErwartet) console.log(`\n${rotErwartet} harte Pruefung(en) ROT-ERWARTET (zaehlen erst mit PROBE_STRENG=1): ${rot.join(' | ')}`);
console.log(`\n${ok}/${gesamt} bestanden`); process.exitCode = ok === gesamt ? 0 : 1;
