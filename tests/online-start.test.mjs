// Online-Start mit zwei Spielern (Flo 15.11.2026, live gegen seinen Opa: "Bei mir kam das Intro, bei ihm kam das Intro
// nicht. Die Zeit hat nicht angefangen zu laufen und ich konnte meine Figuren noch nicht bewegen."). Zwei Browser-Kontexte
// (u1 und u2, je eigenes Konto) an EINEM simulierten Server: die Partie liegt einmal in der Attrappe, beide Seiten lesen
// und ziehen dort. Nie gegen Supabase live.
//
// Flo (u1) hat Weiss und das Intro (Korrektur Flo: er hat begonnen). Je Modus (Ranked Blitz 5+3, gewertet; Freundes-
// Partie 5+3, ungewertet) und je Lage beim Gegner (u2, Schwarz):
//   beide       beide Seiten mit Intro (Bewegung an)
//   reduziert   der Gegner ohne Intro (Bewegung reduziert, wie "Bewegung reduzieren" am Handy)
//   spaet       die Uhr des Gegners geht 70 s vor (fuer ihn ist die Partie aelter als die Intro-Frist)
//   uhr-nach    die Uhr des Gegners geht 10 s nach
//   neu-laden   Flo laedt mitten im Intro neu
// wird gemessen: Weiss kann den ersten Zug spaetestens kurz nach dem Intro setzen, der Zustand (busy, blockiert,
// widerspruch, am Zug, Zielkarte, Intro-Ebene) alle 150 ms, Schwarz sieht den Zug und antwortet, danach laeuft die Uhr
// auf beiden Seiten. Dazu: Weiss zieht gar nicht (Uhr, Erstzug-Frist, Hinweise).
//   node tests/online-start.test.mjs        PORT=9640 fuer einen festen Port
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
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
const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.json': 'application/json',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const d = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(d); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') { gesamt++; if (gut) ok++; console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`); }

const sitzungVon = (uid) => ({ access_token: 'a.' + Buffer.from(JSON.stringify({ sub: uid })).toString('base64url') + '.x', refresh_token: 'r-' + uid,
  expires_at: 9999999999, user: { id: uid, email: uid + '@example.invalid' } });
const NAME = { u1: 'flo', u2: 'opa' };

// ---------- simulierter Server (eine Partie fuer beide) ----------
const partien = new Map();
let stamp = Date.now(), nummer = 0;
const unerwartet = [], reklamiert = [];
// wie der Trigger setze_aktualisiert_am (now()): echte Zeit, streng steigend (Serveruhr fuer js/serverzeit.js)
const aktualisieren = (p) => { stamp = Math.max(Date.now(), stamp + 1); p.aktualisiert_am = new Date(stamp).toISOString(); return p; };
function neuePartie({ gewertet, alterMs = 0 }) {
  const jetzt = new Date(Date.now() - alterMs).toISOString();
  const p = aktualisieren({ id: 'partie-' + ++nummer, code: 'OPA' + nummer + 'X2', weiss: 'u1', schwarz: 'u2', erstellt_von: gewertet ? null : 'u1',
    status: 'laeuft', fen: new Chess().fen(), am_zug: 'w', zuege: '', ergebnis: null, grund: null, remis_angebot: null,
    bedenkzeit_s: 300, inkrement_s: 3, uhr_weiss_ms: 300000, uhr_schwarz_ms: 300000, letzter_zug_am: jetzt, erstellt_am: jetzt, gewertet });
  partien.set(p.id, p);
  return p;
}
async function bediene(route, uid) {
  const req = route.request(), url = new URL(req.url()), body = req.postDataJSON() || {};
  const antwort = (d, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(d) });
  const rpc = url.pathname.split('/').at(-1), p = partien.get(body.partie);
  if (url.pathname.startsWith('/auth/v1/')) return antwort({ id: uid, email: uid + '@example.invalid' });
  if (url.pathname === '/rest/v1/profile') return antwort([{ user_id: uid, benutzername: NAME[uid] }]);
  if (url.pathname === '/rest/v1/sonderstuecke' || url.pathname === '/rest/v1/spielstaende') return antwort([]);
  if (url.pathname === '/rest/v1/partien_online') {
    const q = partien.get((url.searchParams.get('id') || '').slice(3));
    const seit = (url.searchParams.get('aktualisiert_am') || '').slice(3);
    if (url.searchParams.has('status')) return antwort([]);
    return antwort(q && (!seit || q.aktualisiert_am > seit) ? [q] : []);
  }
  if (rpc === 'online_meine') return antwort([...partien.values()].filter((q) => q.status !== 'beendet' && (q.weiss === uid || q.schwarz === uid)));
  if (url.pathname === '/functions/v1/online-zug') {
    const q = partien.get(body.partie);
    const farbe = q && (q.weiss === uid ? 'w' : q.schwarz === uid ? 'b' : null);
    if (!q || q.status !== 'laeuft' || q.am_zug !== farbe) return antwort({ fehler: 'ONLINE_NICHT_DEIN_ZUG' }, 409);
    const c = new Chess();
    for (const m of q.zuege.split(' ').filter(Boolean)) c.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
    let m;
    try { m = c.move({ from: body.zug.slice(0, 2), to: body.zug.slice(2, 4), promotion: body.zug[4] }); } catch (e) { return antwort({ fehler: 'ONLINE_ZUG_ILLEGAL' }, 422); }
    q.zuege = (q.zuege + ' ' + m.lan).trim(); q.fen = c.fen(); q.am_zug = c.turn(); q.letzter_zug_am = new Date().toISOString();
    return antwort(aktualisieren(q));
  }
  if (rpc === 'karte_der_partie') {
    const karte = (u) => ({ name: NAME[u], banner: 'saison-silber', titel: 'erfolg-feuertaufe', vitrine: [], motiv: 'Q', grund: 'standard', rahmen: 'ohne',
      kronen_stufe: 7, du: u === uid });
    return antwort(p ? { w: karte(p.weiss), s: karte(p.schwarz) } : {});
  }
  if (rpc === 'karte_melde_stufen' || rpc === 'karte_waehle') return antwort({ taler: 0, stufen: {}, banner: ['start'], wahl: { banner: 'start' } });
  if (rpc === 'kronen_mein_stand') return antwort({ stufe: 7, kronen: 140, platz: 3, ziel: 120, n: 30, woche: '2026-11-09' });
  if (rpc === 'online_live_bewertung_frei') return antwort({ frei: false, rest: 0, unbegrenzt: false });
  // wie der Server (online_haengt mit eigener Uhr): vor dem 2. Halbzug bricht die Reklamation erst ab, wenn seit dem
  // letzten Zug ranked_haengt_s (30 s) bzw. bei der Freundes-Partie 10 Minuten vergangen sind; frueher aendert sie nichts
  if (rpc === 'online_pruefe_zeit' && p && p.zuege.split(' ').filter(Boolean).length < 2
    && Date.now() - Date.parse(p.letzter_zug_am) >= (p.gewertet ? 30000 : 600000)) {
    reklamiert.push({ uid, nachMs: Date.now() - Date.parse(p.erstellt_am) });
    Object.assign(p, { status: 'beendet', grund: 'abgebrochen', ergebnis: null }); return antwort(aktualisieren(p));
  }
  // fruehe Reklamation: der Server aendert nichts; Antwort mit Mobilfunk-Laufzeit, falls die Partie sie verlangt
  if (rpc === 'online_pruefe_zeit' && p) { (p.fruehReklamiert ||= []).push(uid); if (p.laufzeitMs) await warte(p.laufzeitMs); return antwort(p); }
  if (rpc === 'online_strittig' || rpc === 'online_gib_auf') { unerwartet.push(uid + ':' + rpc); return antwort(p || {}); }
  if (/freigabe/.test(url.pathname)) return antwort([]);
  return antwort([]);
}

// ---------- ein Spieler = ein Kontext ----------
async function spieler(browser, uid, { bewegung = true, versatz = 0, geraet = null, schema = 'light' } = {}) {
  const g = geraet || { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true };
  const k = await browser.newContext({ ...g, serviceWorkers: 'block', colorScheme: schema,
    reducedMotion: bewegung ? 'no-preference' : 'reduce', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  await k.route('**/*.supabase.co/**', (r) => bediene(r, uid));
  await k.addInitScript(({ sitzung, bewegung, versatz }) => {
    if (!sessionStorage.getItem('online-start')) {
      sessionStorage.setItem('online-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ sprache: 'de', spracheGewaehlt: true, klang: false,
        ...(bewegung ? {} : { bewegung: 'aus' }) }));
      localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
    }
    const zeit = Date.now.bind(Date); Date.now = () => zeit() + versatz;
  }, { sitzung: sitzungVon(uid), bewegung, versatz });
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  const fehler = [];
  s.on('pageerror', (e) => fehler.push(e.message));
  return { k, s, fehler, uid };
}
const START = (port) => `http://127.0.0.1:${port}/?test&kern&erw=pakete/online/index`;
async function oeffne(sp, p) {
  await sp.s.goto(START(PORT) + '#start');
  await sp.s.waitForFunction(() => !!window.__app, null, { timeout: 30000 });
  const t0 = Date.now();
  await sp.s.evaluate((id) => window.__app.gehe('online', { partieId: id }), p.id);
  await sp.s.waitForFunction((id) => window.__online?.brett() && window.__online.partie()?.id === id
    && document.querySelector('.on-brett')?.getBoundingClientRect().width > 100, p.id, { timeout: 20000 });
  return t0;
}
// tippt einen Zug wie ein Mensch (Feld an, Feld hin) und wartet, bis der Server ihn kennt; gibt die Dauer zurueck oder null
async function ziehe(sp, p, uci, frist = 8000) {
  const t0 = Date.now(), vorher = partien.get(p.id).zuege;
  while (Date.now() - t0 < frist) {
    for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) {
      const r = await sp.s.locator(`.on-brett .feld[data-feld="${f}"]`).boundingBox().catch(() => null);
      if (r) await sp.s.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2).catch(() => {});
      await warte(60);
    }
    await warte(250);
    if (partien.get(p.id).zuege !== vorher) return Date.now() - t0;
  }
  return null;
}
const introVon = (sp) => sp.s.evaluate(() => (window.__duellProtokoll || []).filter((e) => e.bot === 'online').map((e) => e.art));
const uhrLaeuft = async (sp) => {
  const a = await sp.s.locator('.on-spieler .uhr-zeit').allInnerTexts().catch(() => []);
  await warte(1300);
  const b = await sp.s.locator('.on-spieler .uhr-zeit').allInnerTexts().catch(() => []);
  return { a, b, laeuft: a.join('|') !== b.join('|') };
};

// ---------- Bilder (node tests/online-start.test.mjs --bilder=<ordner>): Start auf beiden Seiten, Varianten A B C ----------
// A (Empfehlung): Koenig der Farbe am Zug, Zahl, schmaler Gold-Balken · B: nur Koenig und Zahl · C: voller neutraler Balken
const BILDER = (process.argv.find((a) => a.startsWith('--bilder=')) || '').slice(9);
const VARIANTEN = { A: '', B: '.on-frist-balken{display:none!important}',
  C: '.on-frist-figur{display:none!important}.on-frist-balken{width:100%!important;height:3px!important}.on-frist-balken i{background:var(--text-2)!important}' };
const GERAETE = { iphone13: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  pc: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } };
async function machBilder(browser) {
  const { mkdirSync } = await import('node:fs');
  mkdirSync(BILDER, { recursive: true });
  const n = { ok: 0 };
  const foto = async (sp, datei, css) => {
    if (css) await sp.s.addStyleTag({ content: css });
    await warte(250);
    await sp.s.screenshot({ path: `${BILDER}/${datei}.png` });
    n.ok++;
  };
  for (const [gname, geraet] of Object.entries(GERAETE)) for (const [sname, schema] of [['hell', 'light'], ['dunkel', 'dark']]) {
    const p = neuePartie({ gewertet: true });
    const flo = await spieler(browser, 'u1', { geraet, schema }), opa = await spieler(browser, 'u2', { geraet, schema });
    try {
      await Promise.all([oeffne(flo, p), oeffne(opa, p)]);
      await warte(2500);
      for (const [v, css] of Object.entries(VARIANTEN)) {
        await foto(flo, `start-${v}-${gname}-${sname}-weiss`, css);
        await foto(opa, `start-${v}-${gname}-${sname}-schwarz`, css);
        // Variante zuruecknehmen: Seite neu laden waere ein neuer Stand, darum nur die Regel leeren
        for (const sp of [flo, opa]) await sp.s.evaluate(() => document.querySelectorAll('style').forEach((x) => { if (/on-frist/.test(x.textContent)) x.remove(); }));
      }
      if (gname === 'iphone13') {
        // die letzten 10 s (Warnfarbe): echte Zeit abwarten, die Frist zaehlt ab der ersten Sicht
        await warte(19000);
        await foto(flo, `start-A-${gname}-${sname}-weiss-knapp`);
        await foto(opa, `start-A-${gname}-${sname}-schwarz-knapp`);
      }
    } finally { await flo.k.close().catch(() => {}); await opa.k.close().catch(() => {}); }
  }
  console.log(`BILDER ${n.ok} in ${BILDER}`);
}

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  if (BILDER) await machBilder(browser); else {
  for (const [modus, gewertet] of [['Ranked 5+3', true], ['Freundes-Partie 5+3', false]]) {
    for (const lage of ['beide', 'reduziert', 'spaet', 'uhr-nach', 'neu-laden', 'flo-uhr-vor']) {
      const name = `${modus}, ${lage}`;
      const p = neuePartie({ gewertet });
      // flo-uhr-vor: Flos Geraeteuhr geht 40 s vor, Antworten auf die Zeit-Reklamation brauchen 800 ms (Mobilfunk)
      if (lage === 'flo-uhr-vor') p.laufzeitMs = 800;
      // Flo (u1) hat Weiss und Bewegung an; Opa (u2) hat Schwarz, je nach Lage ohne Intro
      const flo = await spieler(browser, 'u1', { versatz: lage === 'flo-uhr-vor' ? 40000 : 0 });
      const opa = await spieler(browser, 'u2', { bewegung: lage !== 'reduziert', versatz: lage === 'spaet' ? 70000 : lage === 'uhr-nach' ? -10000 : 0 });
      try {
        const [t0] = await Promise.all([oeffne(flo, p), oeffne(opa, p)]);
        // Zustand bei Flo alle 150 ms: busy, blockiert, widerspruch, am Zug, Zielkarte des Bretts, Intro-Ebene
        const probe = () => flo.s.evaluate(() => {
          window.__probe = [];
          const t0 = performance.now();
          const id = setInterval(() => {
            const o = window.__online, d = document.querySelector('.duell');
            window.__probe.push({ t: Math.round(performance.now() - t0), busy: o?.busy(), blockiert: o?.blockiert(), widerspruch: o?.widerspruch(),
              amZug: o?.partie()?.am_zug, karte: !!o?.brett()?._karte, duell: d ? getComputedStyle(d).pointerEvents : null });
            if (window.__probe.length > 60) clearInterval(id);
          }, 150);
        });
        await probe();
        if (lage === 'neu-laden') {
          await warte(500);
          await flo.s.reload();
          await flo.s.waitForFunction((id) => window.__online?.brett() && window.__online.partie()?.id === id
            && document.querySelector('.on-brett')?.getBoundingClientRect().width > 100, p.id, { timeout: 20000 });
          await probe();
        }
        // Weiss (Flo) zieht sofort und versucht es so lange, bis der Server den Zug kennt (hoechstens 10 s)
        const dw = await ziehe(flo, p, 'e2e4', 10000);
        const intro = await introVon(flo);
        const dauer = await flo.s.evaluate(() => (window.__duellProtokoll || []).filter((e) => e.bot === 'online').map((e) => e.dauer));
        const verlauf = await flo.s.evaluate(() => window.__probe || []);
        const kurz = verlauf.filter((x, i) => i === 0 || JSON.stringify({ ...x, t: 0 }) !== JSON.stringify({ ...verlauf[i - 1], t: 0 }));
        console.log(`   ${name}: Intro Flo ${JSON.stringify(intro)} ${JSON.stringify(dauer)} · Opa ${JSON.stringify(await introVon(opa))} · Zug nach ${dw} ms`);
        console.log(`   ${name}: Zustand Flo ${JSON.stringify(kurz)}`);
        pruefe(`${name}: Weiss mit Intro kann ziehen, spaetestens 1,5 s nach dem Intro`, dw != null && dw <= (dauer[0] || 0) + 1500, { dw, dauer });
        // nur Proben vor dem eigenen Zug, in denen Flo am Zug und nichts unterwegs ist (busy waehrend des Tipps ist richtig)
        const frei = verlauf.filter((x) => x.amZug === 'w' && !x.busy && x.t <= (dw ?? Infinity));
        // leer ist erlaubt: zog Flo vor der ersten Probe, gibt es keine freie Probe vor dem Zug
        pruefe(`${name}: Zielkarte steht, sobald das Brett da ist (kein Riegel am Intro)`, frei.every((x) => x.karte), kurz);
        if (p.fruehReklamiert?.length) console.log(`   ${name}: fruehe Reklamation ohne Wirkung von ${JSON.stringify(p.fruehReklamiert)}`);
        // eine falsch gehende Geraeteuhr loest keine Reklamation vor der Frist aus (jede setzt busy und schluckt Tipps)
        if (lage === 'flo-uhr-vor' || lage === 'spaet') pruefe(`${name}: keine Reklamation vor der Frist trotz falscher Geraeteuhr`, !(p.fruehReklamiert || []).length, p.fruehReklamiert);
        // Schwarz (Opa, ohne Intro) sieht den Zug und antwortet
        const sieht = await opa.s.waitForFunction(() => (window.__online?.partie()?.zuege || '').startsWith('e2e4'), null, { timeout: 8000 }).then(() => true, () => false);
        pruefe(`${name}: Schwarz sieht den ersten Zug`, sieht);
        const ds = sieht ? await ziehe(opa, p, 'e7e5') : null;
        pruefe(`${name}: Schwarz kann antworten`, ds != null && ds < 6000, { ds });
        await warte(600);
        const uf = await uhrLaeuft(flo), uo = await uhrLaeuft(opa);
        pruefe(`${name}: Uhr laeuft bei Flo`, uf.laeuft, uf);
        pruefe(`${name}: Uhr laeuft beim Gegner`, uo.laeuft, uo);
        // Flo 15.11.: "bei ihm kam das Intro nicht" - Schwarz mit Bewegung bekommt im Ranked sein Intro, auch wenn Weiss sofort zieht
        const introOpa = await introVon(opa);
        console.log(`   ${name}: Intro Opa nach seinem Zug ${JSON.stringify(introOpa)}`);
        if (gewertet && lage !== 'reduziert') pruefe(`${name}: Schwarz bekommt sein Intro`, introOpa.length === 1 && introOpa[0] !== 'aus', introOpa);
        pruefe(`${name}: keine Seitenfehler`, !flo.fehler.length && !opa.fehler.length, [...flo.fehler, ...opa.fehler]);
      } catch (e) {
        pruefe(`${name}: Ablauf ohne Abbruch`, false, e.message.split(String.fromCharCode(10))[0]);
      }
      await flo.k.close().catch(() => {}); await opa.k.close().catch(() => {});
    }
  }
  // ---------- Weiss zieht nicht (e7: steht die Uhr, gibt es eine Erstzug-Frist, sieht man sie?) ----------
  for (const [modus, gewertet] of [['Ranked 5+3', true]]) {
    const name = `${modus}, Weiss zieht nicht`;
    const p = neuePartie({ gewertet });
    const flo = await spieler(browser, 'u1'), opa = await spieler(browser, 'u2');
    try {
      await Promise.all([oeffne(flo, p), oeffne(opa, p)]);
      await warte(1500);
      const u = await uhrLaeuft(flo);
      const hinweis = async (sp) => sp.s.locator('.on-hinweise').innerText().catch(() => '');
      const [hw, hs] = [await hinweis(flo), await hinweis(opa)];
      console.log(`   ${name}: Uhr Weiss ${JSON.stringify(u)} · Hinweis Weiss "${hw.replace(/\s+/g, ' ')}" · Hinweis Schwarz "${hs.replace(/\s+/g, ' ')}"`);
      // Frist als Zahl, die sinkt (e7 15.11.: "Opa beginnt, er hat noch 0:25"), auf BEIDEN Seiten mit dem Namen
      const frist = (s) => { const m = /0:(\d\d)/.exec(s); return m ? Number(m[1]) : null; };
      await warte(2100);
      const [hw2, hs2] = [await hinweis(flo), await hinweis(opa)];
      pruefe(`${name}: Weiss sieht eine laufende Frist fuer den ersten Zug`, /Du beginnst/.test(hw) && frist(hw) != null && frist(hw2) < frist(hw), { hw, hw2 });
      pruefe(`${name}: Schwarz sieht, dass der Gegner beginnt und wie lange er hat`, /flo beginnt/i.test(hs) && frist(hs) != null && frist(hs2) < frist(hs), { hs, hs2 });
      pruefe(`${name}: Frist stimmt mit dem Server (30 s ab Anlage, hoechstens 2 s daneben)`,
        Math.abs(frist(hw) - (30 - (Date.now() - 2100 - Date.parse(p.erstellt_am)) / 1000)) <= 2.5, { hw, alterS: (Date.now() - Date.parse(p.erstellt_am)) / 1000 });
      const t0 = Date.now();
      while (Date.now() - t0 < 45000 && partien.get(p.id).status === 'laeuft') await warte(500);
      console.log(`   ${name}: Ende nach ${Math.round((Date.now() - Date.parse(p.erstellt_am)) / 1000)} s, Grund ${partien.get(p.id).grund}, reklamiert ${JSON.stringify(reklamiert)}`);
      pruefe(`${name}: Erstzug-Frist beendet die Partie ohne Ergebnis`, partien.get(p.id).grund === 'abgebrochen');
    } catch (e) {
      pruefe(`${name}: Ablauf ohne Abbruch`, false, e.message.split(String.fromCharCode(10))[0]);
    }
    await flo.k.close().catch(() => {}); await opa.k.close().catch(() => {});
  }
  }
} finally {
  if (browser) await browser.close().catch(() => {});
  server.close();
}
if (BILDER) process.exit(0);
pruefe('keine unerwarteten Server-Aufrufe (Zeit, strittig, Aufgabe)', unerwartet.length === 0, unerwartet);
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
