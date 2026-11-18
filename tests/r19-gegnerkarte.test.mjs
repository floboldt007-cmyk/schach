// Feinschliff R19, M6 Gegnerkarte (Flo 15.11.2026: "ein Tipp auf den Gegner oeffnet sein Profil"): Funktionsprobe mit
// ZWEI Browser-Sitzungen (u1, u2) gegen EINEN nachgebauten Server wie tests/online-ranked-probe.test.mjs. Kein Test
// schreibt ins echte Supabase-Projekt; jede Anfrage an *.supabase.co beantwortet die Attrappe unten.
//
//   Partie: beide suchen Ranked, Partie startet; Schwarz tippt auf die Gegnerleiste, das Profil (Visitenkarte gross mit
//   Name, Liga, Elo) liegt ueber der Partie; Weiss zieht, waehrend es offen ist; Schwarz schliesst, ist in derselben
//   Partie, sieht den Zug und zieht selbst. Danach das Ganze per Tastatur.
//   Verlauf: nach dem Ende traegt die Zeile der Online-Partie einen Profil-Knopf, der dasselbe Profil oeffnet; ohne
//   Antwort vom Server zeigt das Blatt den Namen aus der Partie und einen Satz.
//
//   node tests/r19-gegnerkarte.test.mjs     BILDER=<ordner> fuer Bilder (iPhone 13, iPad, PC; hell und dunkel)
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
const BILDER = process.env.BILDER || null;
if (BILDER) mkdirSync(BILDER, { recursive: true });
const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + new URL(req.url, 'http://test').pathname.replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p)); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const token = uid => 'a.' + Buffer.from(JSON.stringify({ sub: uid })).toString('base64url') + '.x';
const sitzungVon = uid => ({ access_token: token(uid), refresh_token: 'test-r-' + uid, expires_at: 9999999999, user: { id: uid, email: uid + '@example.invalid' } });
const NAMEN = { u1: 'Spieler_1', u2: 'Spieler_2' };
const ELO = { u1: 1480, u2: 1520 };
const START_FEN = new Chess().fen();

let ok = 0, gesamt = 0, stamp = Date.now(), nummer = 0, karteAus = false;
const partien = new Map(), schlange = new Map(), fehler = [], karteRufe = [];
const aktualisieren = p => { p.aktualisiert_am = new Date(Math.max(++stamp, Date.now())).toISOString(); stamp = Date.parse(p.aktualisiert_am); return p; };
const farbeVon = (p, uid) => (p.weiss === uid ? 'w' : p.schwarz === uid ? 'b' : null);
const chessVon = p => { const c = new Chess(); for (const m of p.zuege.split(' ').filter(Boolean)) c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] }); return c; };
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
  return gut;
}

// ---- Server-Attrappe (ein Zustand fuer beide Konten), Regeln wie tests/online-ranked-probe.test.mjs ----
function paaren(uid) {
  const g = [...schlange.keys()].find(u => u !== uid);
  if (!g || !schlange.has(uid)) return null;
  const p = aktualisieren({ id: 'ranked-' + ++nummer, code: null, weiss: g, schwarz: uid, erstellt_von: g, gewertet: true, status: 'laeuft',
    fen: START_FEN, am_zug: 'w', zuege: '', ergebnis: null, grund: null, remis_angebot: null, bedenkzeit_s: 300, inkrement_s: 3,
    uhr_weiss_ms: 300000, uhr_schwarz_ms: 300000, letzter_zug_am: new Date().toISOString(), erstellt_am: new Date().toISOString() });
  partien.set(p.id, p); schlange.delete(uid); schlange.delete(g);
  return p;
}
const laufendeVon = uid => [...partien.values()].find(p => p.status === 'laeuft' && farbeVon(p, uid)) || null;
async function bediene(route) {
  const req = route.request(), url = new URL(req.url());
  let body = {}; try { body = req.postDataJSON() || {}; } catch (e) { body = {}; }
  const auth = (req.headers().authorization || '').replace(/^Bearer\s+/, '');
  let uid = null; try { uid = JSON.parse(Buffer.from(auth.split('.')[1] || '', 'base64url').toString()).sub || null; } catch (e) { uid = null; }
  const antwort = (d, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(d) });
  const absage = (status, message) => antwort({ message, fehler: message }, status);
  if (url.pathname.startsWith('/auth/v1/')) return antwort(uid ? { id: uid, email: uid + '@example.invalid' } : {});
  if (url.pathname === '/rest/v1/spielstaende' || url.pathname === '/rest/v1/sonderstuecke' || /freigabe/.test(url.pathname)) return antwort([]);
  if (url.pathname === '/rest/v1/profile') return antwort(uid ? [{ user_id: uid, benutzername: NAMEN[uid] }] : []);
  if (url.pathname === '/rest/v1/partien_online') {
    if (url.searchParams.has('status')) return antwort([...partien.values()].filter(p => p.status === 'beendet' && farbeVon(p, uid)));
    const p = partien.get((url.searchParams.get('id') || '').slice(3));
    const seit = (url.searchParams.get('aktualisiert_am') || '').slice(3);
    return antwort(p && farbeVon(p, uid) && (!seit || p.aktualisiert_am > seit) ? [p] : []);
  }
  if (!uid) return absage(401, 'KRONEN_ANMELDUNG');
  const rpc = url.pathname.split('/').at(-1), p = partien.get(body.partie);
  if (rpc === 'kronen_mein_stand') return antwort({ stufe: 7, kronen: 140, platz: 3, ziel: 120, n: 30, woche: '2026-11-09' });
  if (rpc === 'online_suche_start' || rpc === 'online_suche_stand') {
    const lauf = laufendeVon(uid); if (lauf) return antwort({ partie: lauf.id });
    if (rpc === 'online_suche_start') schlange.set(uid, { seit: schlange.get(uid)?.seit || Date.now() });
    const neu = paaren(uid); if (neu) return antwort({ partie: neu.id });
    const q = schlange.get(uid);
    return antwort(q ? { wartet: true, seit: new Date(q.seit).toISOString(), warte_s: 30, ki_ab_s: 1, zeit: '5+3' } : { wartet: true });
  }
  if (rpc === 'online_suche_ende') { schlange.delete(uid); return antwort({}); }
  if (rpc === 'online_live_bewertung_frei') return antwort({ frei: true, rest: 1, unbegrenzt: false });
  if (rpc === 'online_live_bewertung_nutzen') return antwort({ ok: true, frei: true, rest: 0, unbegrenzt: false, gebucht: true });
  if (rpc === 'online_meine') return antwort([...partien.values()].filter(q => q.status !== 'beendet' && farbeVon(q, uid)));
  if (url.pathname === '/functions/v1/online-zug') {
    const q = partien.get(body.partie);
    if (!q || q.status !== 'laeuft') return absage(409, 'ONLINE_PARTIE_BEENDET');
    if (farbeVon(q, uid) !== q.am_zug) return absage(409, 'ONLINE_NICHT_DEIN_ZUG');
    const c = chessVon(q); let m;
    try { m = c.move({ from: body.zug.slice(0, 2), to: body.zug.slice(2, 4), promotion: body.zug[4] }); } catch (e) { return absage(422, 'ONLINE_ZUG_ILLEGAL'); }
    q.zuege = (q.zuege + ' ' + m.lan).trim(); q.fen = c.fen(); q.am_zug = c.turn(); q.letzter_zug_am = new Date().toISOString(); q.remis_angebot = null;
    return antwort(aktualisieren(q));
  }
  if (rpc === 'online_gib_auf' && p && p.status === 'laeuft') {
    Object.assign(p, { status: 'beendet', grund: 'aufgabe', ergebnis: farbeVon(p, uid) === 'w' ? '0-1' : '1-0' }); return antwort(aktualisieren(p));
  }
  if (rpc === 'online_pruefe_zeit' && p) return antwort(p);
  if (rpc === 'karte_melde_stufen' || rpc === 'karte_waehle') return antwort({ taler: 0, stufen: {}, banner: ['start'], wahl: { banner: 'start' } });
  if (rpc === 'karte_der_partie') {
    // wie supabase/karte-elo-schema.sql: nur fuer Teilnehmer, elo nur in gewerteten Partien; karteAus spielt "keine Antwort"
    karteRufe.push({ uid, partie: body.partie });
    if (karteAus) return absage(500, 'KARTE_KEINE_PARTIE');
    if (!p || !farbeVon(p, uid)) return absage(400, 'KARTE_KEINE_PARTIE');
    const karte = u => ({ name: NAMEN[u], banner: 'saison-silber', titel: null, vitrine: [], motiv: 'Q', grund: 'standard', rahmen: 'ohne',
      kronen_stufe: 7, du: u === uid, ...(p.gewertet ? { elo: ELO[u] } : {}) });
    return antwort({ w: karte(p.weiss), s: karte(p.schwarz) });
  }
  return antwort([]);
}

// ---- Browser ----
let browser;
async function neuerKontext(uid) {
  const k = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, serviceWorkers: 'block', locale: 'de-DE', timezoneId: 'Europe/Berlin', colorScheme: 'light' });
  await k.route('**/*.supabase.co/**', bediene);
  await k.addInitScript(s => {
    localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(s));
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'aus' }));
  }, sitzungVon(uid));
  const seite = await k.newPage(); seite.setDefaultTimeout(15000);
  seite.on('pageerror', e => fehler.push(`${uid}: ${e.message}`));
  return seite;
}
const START = () => `http://127.0.0.1:${PORT}/?test&kern&erw=pakete/online/index`;
const bereit = s => s.waitForFunction(() => window.__online?.brett() && !window.__online.busy()
  && document.querySelectorAll('.screen').length === 1 && document.querySelector('.on-brett')?.getBoundingClientRect().width > 100, null, { timeout: 15000 });
const sucheBereit = s => s.waitForFunction(() => ['bereit', 'laufend'].includes(document.querySelector('.on-art[data-art="partie"]')?.dataset.zustand), null, { timeout: 15000 });
async function tippe(s, uci) {
  for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) {
    const r = await s.locator(`.on-brett .feld[data-feld="${f}"]`).boundingBox();
    await s.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
  }
}
const sieht = (s, uci) => s.waitForFunction(u => (window.__online?.partie()?.zuege || '').split(' ').includes(u), uci, { timeout: 10000 }).then(() => true).catch(() => false);
// das offene Profil-Blatt: Name, Liga-Zeile, Elo, Leer-Satz; null ohne Blatt
const blatt = s => s.evaluate(() => {
  const k = document.querySelector('.sheet-ort:not(.weg) .sheet-karte.gegner-profil');
  if (!k) return null;
  return { name: k.querySelector('.vk-name, .gp-name')?.textContent.trim() || null, krone: k.querySelector('.vk-krone')?.textContent.trim() || null,
    gross: !!k.querySelector('.vk[data-groesse="gross"]'), leer: k.querySelector('.gp-leer')?.textContent.trim() || null,
    laedt: !!k.querySelector('.gp-laedt'), knopf: k.querySelector('[data-knopf="zurueck"]')?.textContent.trim() || null };
});
const blattDa = (s, mitKarte = true) => s.waitForFunction(m => {
  const k = document.querySelector('.sheet-ort:not(.weg) .sheet-karte.gegner-profil');
  return !!k && (m ? !!k.querySelector('.vk[data-groesse="gross"]') : !!k.querySelector('.gp-leer'));
}, mitKarte, { timeout: 10000 }).then(() => true).catch(() => false);
const blattZu = s => s.waitForFunction(() => !document.querySelector('.sheet-ort .sheet-karte.gegner-profil'), null, { timeout: 5000 }).then(() => true).catch(() => false);
async function bilder(s, name) {
  if (!BILDER) return;
  const alt = s.viewportSize();
  for (const [geraet, width, height] of [['iphone13', 390, 844], ['ipad', 820, 1180], ['pc', 1280, 720]]) {
    for (const schema of ['light', 'dark']) {
      await s.setViewportSize({ width, height }); await s.emulateMedia({ colorScheme: schema });
      await s.waitForTimeout(400);
      await s.screenshot({ path: path.join(BILDER, `${geraet}-${schema === 'light' ? 'hell' : 'dunkel'}-${name}.png`) }).catch(e => console.log(`Bild ${name}: ${e.message}`));
    }
  }
  await s.setViewportSize(alt); await s.emulateMedia({ colorScheme: 'light' });
  await s.waitForTimeout(300);
}

try {
  browser = await browserTyp(pw).launch({ headless: true });
  const a = await neuerKontext('u1'), b = await neuerKontext('u2');
  await Promise.all([a, b].map(async s => { await s.goto(START() + '#online'); await sucheBereit(s); }));

  // 1. Suche bis zur Partie (u1 sucht zuerst und wird Weiss)
  await a.locator('[data-online="suchen"]').click();
  await a.locator('.on-suche:not([hidden])').waitFor();
  await b.locator('[data-online="suchen"]').click();
  const ids = await Promise.all([a, b].map(s => s.waitForFunction(() => window.__online?.brett() && window.__online.partie()?.status === 'laeuft'
    && window.__online.partie().id, null, { timeout: 12000 }).then(h => h.jsonValue()).catch(() => null)));
  const id = ids[0] && ids[0] === ids[1] ? ids[0] : null;
  pruefe('Suche: beide landen in derselben gewerteten Partie', !!id, ids);
  if (!id) throw new Error('ohne Partie kein weiterer Ablauf');
  const weiss = a, schwarz = b;
  await Promise.all([weiss, schwarz].map(bereit));
  // die Karten kommen ueber karte_der_partie; bis sie da sind, zeigt die Leiste nur den Namen
  await schwarz.waitForFunction(() => document.querySelector('.on-oben .p-meta')?.textContent.includes('Elo'), null, { timeout: 10000 }).catch(() => {});

  // 2. Tipp auf den Gegner oeffnet sein Profil
  const knopf = await schwarz.evaluate(() => {
    const k = document.querySelector('.on-oben button[data-online="gegner"]');
    if (!k) return null;
    const r = k.getBoundingClientRect(), l = document.querySelector('.on-oben').getBoundingClientRect();
    return { label: k.getAttribute('aria-label'), deckt: r.width >= l.width - 1 && r.height >= l.height - 1 };
  });
  pruefe('Gegnerleiste traegt einen Knopf ueber die ganze Leiste mit Vorlese-Namen "Profil von Spieler_1"', !!knopf && knopf.deckt
    && /Spieler_1/.test(knopf.label || ''), knopf);
  const leiste = await schwarz.locator('.on-oben').boundingBox();
  await schwarz.touchscreen.tap(leiste.x + leiste.width * 0.3, leiste.y + leiste.height / 2);
  const offen = await blattDa(schwarz);
  const b1 = await blatt(schwarz);
  pruefe('Tipp auf die Gegnerleiste oeffnet sein Profil: Visitenkarte gross mit Name, Liga und Elo vom Server', offen && b1?.gross
    && b1.name === 'Spieler_1' && /Elo 1480/.test(b1.krone || '') && !/Ohne Liga/.test(b1.krone || ''), b1);
  pruefe('Profil-Blatt hat "Zurück zur Partie"', b1?.knopf === 'Zurück zur Partie', b1);
  await bilder(schwarz, '1-profil-partie');

  // 3. Waehrend das Profil offen ist, zieht Weiss; der Zug kommt an
  await bereit(weiss); await tippe(weiss, 'e2e4');
  pruefe('Profil offen: der Zug des Gegners (e2-e4) kommt trotzdem an', await sieht(schwarz, 'e2e4'), await schwarz.evaluate(() => window.__online?.partie()?.zuege));

  // 4. Zurueck zur Partie, ohne Zugverlust; Schwarz zieht selbst
  await schwarz.locator('.sheet-karte.gegner-profil [data-knopf="zurueck"]').click();
  const zu = await blattZu(schwarz);
  const nach = await schwarz.evaluate(() => ({ id: window.__online?.partie()?.id, zuege: window.__online?.partie()?.zuege, brett: !!window.__online?.brett(),
    screen: location.hash }));
  pruefe('Zurück zur Partie: Blatt zu, dieselbe Partie, Zug e2-e4 steht noch', zu && nach.id === id && nach.zuege === 'e2e4' && nach.brett, nach);
  await bereit(schwarz); await tippe(schwarz, 'e7e5');
  pruefe('Nach dem Profil zieht Schwarz e7-e5, Weiss sieht den Zug', await sieht(weiss, 'e7e5'), partien.get(id)?.zuege);

  // 5. Tastatur: Fokus auf den Knopf, Enter oeffnet, Escape schliesst und gibt den Fokus zurueck
  await weiss.locator('.on-oben button[data-online="gegner"]').focus();
  await weiss.keyboard.press('Enter');
  const tOffen = await blattDa(weiss);
  const b2 = await blatt(weiss);
  pruefe('Tastatur: Enter auf der Gegnerleiste oeffnet das Profil von Spieler_2 (Elo 1520)', tOffen && b2?.name === 'Spieler_2' && /Elo 1520/.test(b2.krone || ''), b2);
  await weiss.keyboard.press('Escape');
  const tZu = await blattZu(weiss);
  pruefe('Tastatur: Escape schliesst, der Fokus steht wieder auf der Gegnerleiste', tZu && await weiss.evaluate(() =>
    document.activeElement?.matches('.on-oben button[data-online="gegner"]')), await weiss.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)));
  pruefe('Das Profil fragt keine neuen Server-Daten an (nur karte_der_partie, einmal je Sitzung und Partie)', karteRufe.every(r => r.partie === id)
    && karteRufe.filter(r => r.uid === 'u2').length === 1, karteRufe);

  // 6. Ende (Weiss gibt auf), dann der Verlauf
  await bereit(weiss);
  await weiss.locator('[data-online="aufgeben"]').click();
  const ja = weiss.locator('.dialog-ort:not(.weg) .dialog-knoepfe button');
  await ja.first().waitFor(); await ja.last().click();
  const ende = await schwarz.waitForFunction(() => window.__online?.partie()?.status === 'beendet', null, { timeout: 10000 }).then(() => true).catch(() => false);
  pruefe('Ende: Weiss gibt auf, Schwarz sieht das Ende', ende && partien.get(id)?.status === 'beendet', partien.get(id));
  await schwarz.waitForFunction(i => !!JSON.parse(localStorage.getItem('schach-arena:v1:partien') || '[]').find?.(p => p.id === 'on-' + i)
    || Object.keys(localStorage).some(k => localStorage.getItem(k)?.includes('on-' + i)), id, { timeout: 8000 }).catch(() => {});
  // dazu eine Bot-Partie, damit "nur Online-Zeilen" etwas zu vergleichen hat
  await schwarz.evaluate(async () => {
    const sp = await import('./js/storage.js');
    sp.speicherePartie({ id: sp.neueId(new Date()), datum: new Date().toISOString(), modus: 'normal', botId: 'benno', spielerFarbe: 'w', hinweise: 0,
      zuruecknahmen: 0, zuege: ['e2e4', 'e7e5'], san: ['e4', 'e5'], liveKlassen: [null, null], ergebnis: 'sieg', grund: 'aufgabe' });
  });
  await schwarz.evaluate(() => { document.querySelector('.sheet-ort .sheet-karte button')?.click(); window.__app.gehe('verlauf'); });
  const zeile = `.vl-zeile[data-id="on-${id}"]`;
  const da = await schwarz.locator(zeile).waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  const vk = da ? await schwarz.evaluate(z => {
    const k = document.querySelector(z + ' [data-aktion="gegner"]');
    return k ? { label: k.getAttribute('aria-label'), w: k.getBoundingClientRect().width, h: k.getBoundingClientRect().height } : null;
  }, zeile) : null;
  pruefe('Verlauf: die Online-Partie hat einen Profil-Knopf "Profil von Spieler_1" (mind. 24 px)', !!vk && /Spieler_1/.test(vk.label || '') && vk.w >= 24 && vk.h >= 24, { da, vk });
  const botZeilen = await schwarz.evaluate(() => {
    const bot = [...document.querySelectorAll('.vl-zeile')].filter(z => !z.dataset.id.startsWith('on-'));
    return { n: bot.length, mitKnopf: bot.filter(z => z.querySelector('[data-aktion="gegner"]')).length };
  });
  pruefe('Verlauf: die Bot-Partie steht da und hat keinen Profil-Knopf, nur die Online-Zeile', botZeilen.n >= 1 && botZeilen.mitKnopf === 0, botZeilen);
  if (vk) {
    const r = await schwarz.locator(zeile + ' [data-aktion="gegner"]').boundingBox();
    await schwarz.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
    const vOffen = await blattDa(schwarz);
    const b3 = await blatt(schwarz);
    pruefe('Verlauf: Tipp oeffnet dasselbe Profil (Spieler_1, Elo 1480), die Analyse oeffnet sich nicht', vOffen && b3?.name === 'Spieler_1'
      && /Elo 1480/.test(b3.krone || '') && await schwarz.evaluate(() => location.hash.includes('verlauf')), { b3, hash: await schwarz.evaluate(() => location.hash) });
    pruefe('Verlauf: das Blatt heisst "Schließen", nicht "Zurück zur Partie"', b3?.knopf === 'Schließen', b3);
    await bilder(schwarz, '2-profil-verlauf');
    await schwarz.locator('.sheet-karte.gegner-profil [data-knopf="zurueck"]').click();
    await blattZu(schwarz);

    // 7. Ohne Antwort vom Server: Name aus der Partie und ein Satz
    karteAus = true;
    await schwarz.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
    const lOffen = await blattDa(schwarz, false);
    const b4 = await blatt(schwarz);
    pruefe('Ohne Karte vom Server: Blatt zeigt den Namen aus der Partie und einen Satz', lOffen && b4?.name === 'Spieler_1' && !!b4.leer && !b4.gross, b4);
    await bilder(schwarz, '3-profil-ohne-karte');
    await schwarz.keyboard.press('Escape');
    karteAus = false;
  }
  pruefe('Keine Seitenfehler in beiden Sitzungen', fehler.length === 0, fehler);
} catch (e) {
  pruefe('Ablauf ohne Abbruch', false, e.message);
} finally {
  await browser?.close();
  server.close();
}
console.log(`${ok}/${gesamt} gruen`);
process.exit(ok === gesamt && gesamt > 0 ? 0 : 1);
