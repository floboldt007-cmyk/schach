// Gleichheits-Probe der Partie-Ansichten (Feinschliff 12.11.2026, Flo: jede Partie-Ansicht soll aussehen und sich
// anfuehlen wie die Bot-Partie). Misst Bot-Partie, Online-Partie, Raetsel-Duell, Zu zweit und Lektion auf vier Geraeten
// gegen EINEN nachgebauten Server (jede Anfrage an *.supabase.co beantwortet die Attrappe unten, nie das echte Projekt).
// Der Figurensatz (Skin) ist NICHT Teil dieser Probe.
//
//   node tests/gleichheit-ansichten.test.mjs                   Probe: Abweichungen melden sich als ROT-ERWARTET, Exit 0
//   PROBE_STRENG=1 node tests/gleichheit-ansichten.test.mjs    Abweichungen zaehlen als FEHLER (fuer die Reparatur)
//   ... --bilder=<ordner> --tabelle=<datei.md>                 dazu je Geraet und Ansicht ein Bild und die Tabelle
//   PORT=8977 node tests/gleichheit-ansichten.test.mjs         eigener Port (Standard: frei)
//
// Massstab ist die Bot-Partie (ueber die Arena gestartet, wie Flo sie beginnt, damit ihr Duell-Intro mitzaehlt). Je
// Ansicht und Geraet: Brettbreite (aus dem Feldraster), Spielerleisten (Lage zum Brett, Name, Avatar, Uhr), die
// erwarteten Knoepfe ganz im Fenster ohne Scrollen, Duell-Intro vor Partiebeginn, Ergebnis am Ende, Klang beim eigenen
// Zug (Protokoll von js/sounds.js, im Testmodus fuehrt es auch stille Klaenge mit Grund).
// Harte Pruefungen (hart: true) sind die Gleichheits-Punkte; ohne PROBE_STRENG blockieren sie die CI nicht
// (tests/alle.mjs zaehlt nur Zeilen mit "FEHLER" und den Exitcode), wie tests/online-ranked-probe.test.mjs.
// Seit R8 (13.11.2026) zaehlen die Punkte von Online-Partie und Zu zweit immer (ausser dem Duell-Intro vor Zu zweit),
// dazu das Aussehen der Spielerleisten hell und dunkel (messeLeistenStil) und die Lage der Zuege zu den Knoepfen.
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Chess } from '../vendor/chess/chess.js';
import { browserTyp } from './browser.mjs';
import { messeAnsicht, introWeg } from './gleichheit-messung.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');
const STRENG = process.env.PROBE_STRENG === '1';
const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };
const BILDER = arg('bilder');
const TABELLE = arg('tabelle');
if (BILDER) mkdirSync(BILDER, { recursive: true });

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

const GERAETE = [['iPhone 13', 390, 844], ['iPhone SE', 375, 667], ['iPad hoch', 820, 1180], ['PC', 1280, 720]];
const ANSICHTEN = ['bot', 'online', 'duell', 'zuzweit', 'lektion'];
const NAME = { bot: 'Bot-Partie', online: 'Online-Partie', duell: 'Raetsel-Duell', zuzweit: 'Zu zweit', lektion: 'Lektion' };
// Brett: hoechstens 2 px kleiner als in der Bot-Partie. Beide Breiten sind gerundete Summen von acht Feldbreiten mit
// Nachkommastellen (je bis 0,5 px Rundung) plus 1 px fuer Rand und Subpixel-Lage verschiedener Rahmen; ab 3 px fehlt
// jedem Feld sichtbar Flaeche, das ist eine echte Abweichung im Layout.
const TOLERANZ_PX = 2;
// Erwartete Knoepfe je Ansicht. "gewollt" nur mit Beleg im Code, "annahme" ist unsere Lesart von "wo sinnvoll".
const KNOEPFE = {
  bot: { erwartet: ['aufgeben', 'hinweis'], ohne: { remis: 'Massstab: die Bot-Partie hat keinen Remis-Knopf (js/ui/partie.js .spielknoepfe)' } },
  online: { erwartet: ['aufgeben', 'remis'], ohne: { hinweis: 'gewollt: "kein bester Zug" (js/ui/online.js:426)' } },
  duell: { erwartet: [], ohne: { aufgeben: 'annahme: Zeitrennen, endet ueber die Uhr', remis: 'annahme: kein Gegner am Brett', hinweis: 'annahme: Hilfe waere Betrug im Wettlauf' } },
  zuzweit: { erwartet: ['aufgeben', 'remis'], ohne: { hinweis: 'annahme: zwei Menschen, kein Trainer' } },
  lektion: { erwartet: ['hinweis'], ohne: { aufgeben: 'annahme: Lektion hat Neu starten statt Aufgeben', remis: 'annahme: Uebung ohne Gegner' },
    // R8 (13.11.2026): was die Lektion bewusst anders macht, wird nicht gegen die Bot-Partie gemessen, sondern genannt
    // R15 (R6-Leisten B): seit 13.11.2026 hat die Lektion die Leisten der Bot-Partie ("Lektion" gegen den eigenen Namen), nur ohne Uhr
    anders: { uhr: 'gewollt: Uebung ohne Zeitdruck, die Leisten haben keine Uhr (js/ui/lektion.js)',
      intro: 'gewollt: statt des Duell-Intros die Idee-Phase mit dem Knopf Los geht (js/ui/lektion.js phase intro)' } },
};

let ok = 0, gesamt = 0, rotErwartet = 0;
const rot = [];
function pruefe(name, gut, detail = '', { hart = false } = {}) {
  if (hart && !STRENG && !gut) { rotErwartet++; rot.push(name); console.log(`ROT-ERWARTET ${name} ${JSON.stringify(detail)}`); return gut; }
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
  return gut;
}

// ---- Server-Attrappe (je Seite ein Zustand) ----
const SITZUNG_UID = 'u1';
const token = (uid) => 'a.' + Buffer.from(JSON.stringify({ sub: uid })).toString('base64url') + '.x';
const SITZUNG = { access_token: token(SITZUNG_UID), refresh_token: 'test-r', expires_at: 9999999999, user: { id: SITZUNG_UID, email: 'u1@example.invalid' } };
const NAMEN = { u1: 'Spieler_1', u2: 'Spieler_2' };
// wie tests/lernen.test.mjs: Erfinder-Konto, damit die Meisterschule (Lektionen) offen ist; gilt fuer alle Ansichten gleich
const ERFINDER = ['erfinder-banner-blatt-0', 'erfinder-titel', 'erfinder-figuren-blaupause', 'erfinder-finisher-signatur'];
const RAETSEL = [{ fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', loesung: ['a1a8'], rating: 700 },
  { fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', loesung: ['a1a8'], rating: 760 }];
const DUELL = '7d0c9a52-1b3e-4f6a-9c8d-2e1f0a9b8c7d';

function neuerZustand() {
  const z = { partien: new Map(), duell: { start: null, idx: 0, geloest: 0, fehler: 0, beendet: false }, unerwartet: [] };
  const c = new Chess();
  // gewertete Online-Partie, eben angelegt (das Online-Intro laeuft nur in der ersten Minute, js/ui/online.js intro())
  z.partien.set('gleich-1', { id: 'gleich-1', code: null, weiss: 'u1', schwarz: 'u2', erstellt_von: 'u2', gewertet: true, status: 'laeuft',
    fen: c.fen(), am_zug: 'w', zuege: '', ergebnis: null, grund: null, remis_angebot: null, bedenkzeit_s: 300, inkrement_s: 3,
    uhr_weiss_ms: 300000, uhr_schwarz_ms: 300000, letzter_zug_am: new Date().toISOString(), erstellt_am: new Date().toISOString(),
    aktualisiert_am: new Date().toISOString() });
  return z;
}
const iso = (ms) => new Date(ms).toISOString();
function duellStand(d) {
  if (!d.start) return { fehler: 'DUELL_UNBEKANNT' };
  const r = RAETSEL[d.idx];
  const st = { duell: DUELL, art: 'ki', status: d.beendet ? 'beendet' : 'laeuft', jetzt: iso(Date.now()), start_am: iso(d.start),
    ich: { geloest: d.geloest, fehler: d.fehler, ende_am: iso(d.start + 180000) },
    gegner: { geloest: 0, fehler: 0, ende_am: iso(d.start + 180000), ki: true, elo: 1200 },
    raetsel: d.beendet || !r ? null : { nr: d.idx + 1, fen: r.fen, bisher: [], rating: r.rating } };
  if (d.beendet) { st.ergebnis = d.geloest > 0 ? 'sieg' : 'remis'; st.kronen_delta = d.geloest > 0 ? 20 : 5; }
  return st;
}

function bediener(z) {
  return async (route) => {
    const req = route.request(), url = new URL(req.url());
    let body = {}; try { body = req.postDataJSON() || {}; } catch (e) { body = {}; }
    const antwort = (d, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(d) });
    const uid = SITZUNG_UID;
    if (url.pathname.startsWith('/auth/v1/')) return antwort({ id: uid, email: uid + '@example.invalid' });
    if (url.pathname === '/rest/v1/sonderstuecke') return antwort(ERFINDER.map((stueck_id) => ({ stueck_id })));
    if (url.pathname === '/rest/v1/profile') return antwort([{ user_id: uid, benutzername: NAMEN[uid] }]);
    if (url.pathname === '/rest/v1/partien_online') {
      if (url.searchParams.has('status')) return antwort([...z.partien.values()].filter((p) => p.status === 'beendet'));
      const p = z.partien.get((url.searchParams.get('id') || '').slice(3));
      return antwort(p ? [p] : []);
    }
    if (url.pathname === '/functions/v1/online-zug') {
      const q = z.partien.get(body.partie);
      if (!q || q.status !== 'laeuft') return antwort({ message: 'ONLINE_PARTIE_BEENDET' }, 409);
      const c = new Chess(q.fen);
      let m; try { m = c.move({ from: body.zug.slice(0, 2), to: body.zug.slice(2, 4), promotion: body.zug[4] }); } catch (e) { return antwort({ message: 'ONLINE_ZUG_ILLEGAL' }, 422); }
      Object.assign(q, { zuege: (q.zuege + ' ' + m.lan).trim(), fen: c.fen(), am_zug: c.turn(), letzter_zug_am: iso(Date.now()), aktualisiert_am: iso(Date.now()) });
      return antwort(q);
    }
    if (url.pathname === '/functions/v1/raetsel-duell') {
      const d = z.duell, r = RAETSEL[d.idx];
      if (!d.start || Date.now() < d.start) return antwort({ fehler: 'DUELL_NICHT_GESTARTET' }, 409);
      const richtig = !!r && body.zug === r.loesung[0];
      if (richtig) d.geloest++; else d.fehler++;
      d.idx++;
      const n = RAETSEL[d.idx];
      return antwort({ richtig, fertig: true, idx: d.idx, schritt: 0, geloest: d.geloest, fehler: d.fehler, ende_am: iso(d.start + 180000),
        naechstes: n ? { nr: d.idx + 1, fen: n.fen, bisher: [], rating: n.rating } : null });
    }
    const rpc = (url.pathname.match(/\/rest\/v1\/rpc\/([a-z_]+)/) || [])[1];
    if (rpc) {
      const p = z.partien.get(body.partie);
      if (rpc === 'online_meine') return antwort([...z.partien.values()].filter((q) => q.status !== 'beendet'));
      if (rpc === 'online_suche_stand' || rpc === 'online_suche_start') return antwort({ wartet: false });
      if (rpc === 'online_live_bewertung_frei') return antwort({ frei: true, rest: 1, unbegrenzt: false });
      if (rpc === 'online_pruefe_zeit' && p) return antwort(p);
      if (rpc === 'online_gib_auf' && p) { Object.assign(p, { status: 'beendet', grund: 'aufgabe', ergebnis: '0-1', aktualisiert_am: iso(Date.now()) }); return antwort(p); }
      if (rpc === 'online_biete_remis' && p) { p.remis_angebot = 'w'; return antwort(p); }
      if (rpc === 'karte_der_partie') {
        const karte = (u) => ({ name: NAMEN[u], banner: 'saison-silber', titel: 'erfolg-feuertaufe', vitrine: [], motiv: 'Q', grund: 'standard', rahmen: 'ohne', kronen_stufe: 7, du: u === uid });
        return antwort(p ? { w: karte(p.weiss), s: karte(p.schwarz) } : {});
      }
      if (rpc === 'kronen_mein_stand') return antwort({ stufe: 7, kronen: 140, platz: 3, ziel: 120, n: 30, woche: '2026-11-09' });
      if (rpc === 'duell_suche_start' || rpc === 'duell_suche_stand') return antwort({});
      if (rpc === 'duell_suche_ende') { if (body.ki === true) { z.duell.start = Date.now() + 1200; return antwort({ duell: DUELL }); } return antwort({}); }
      if (rpc === 'duell_stand') return antwort(duellStand(z.duell));
      z.unerwartet.push(rpc);
      return antwort([]);
    }
    return antwort([]);
  };
}

// ---- Messen in der Seite ----
// Brett, Leisten, Knoepfe und Zugstreifen: messeAnsicht aus tests/gleichheit-messung.mjs (eine Messung fuer alle Gleichheits-Proben)

// R8 (13.11.2026, B4): Aussehen der Spielerleisten je Farbmodus, verglichen mit der Bot-Partie. Die Uhr wird fuer die
// Messung kurz eingeblendet (ohne Bedenkzeit ist sie in jeder Ansicht verborgen), danach sofort wieder verborgen.
const messeLeistenStil = (s, screen) => s.evaluate((screen) => {
  const sichtbar = (e) => !!e && !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0;
  const wurzel = document.querySelector(screen) || document;
  const px = (v) => Math.round(parseFloat(v) * 10) / 10;
  // Sprechblase des Bots (quer unter dem Namen): gehoert nur zur Bot-Partie, ihre Hoehe zaehlt beim Vergleich nicht mit
  const blaseAnteil = (e) => { const b = e.querySelector(':scope > .blase-ort');
    return b && sichtbar(b) && getComputedStyle(b).position !== 'absolute' ? Math.round(b.getBoundingClientRect().height + parseFloat(getComputedStyle(b).marginTop)) : 0; };
  return [...wurzel.querySelectorAll('.spieler, .zz-spieler')].filter(sichtbar).map((e) => {
    const c = getComputedStyle(e), r = e.getBoundingClientRect();
    const av = e.querySelector(':scope > .av, :scope > img');
    const avR = av?.getBoundingClientRect(), avC = av && getComputedStyle(av);
    const nameEl = e.querySelector('.name, .zz-name b');
    const nC = nameEl && getComputedStyle(nameEl);
    const uhr = e.querySelector('.uhr');
    let uhrStil = null;
    if (uhr) {
      const war = uhr.hidden; uhr.hidden = false;
      const u = getComputedStyle(uhr), ur = uhr.getBoundingClientRect();
      uhrStil = { hoehe: Math.round(ur.height), breiteMin: px(u.minWidth), schrift: px(u.fontSize), radius: px(u.borderTopLeftRadius), grund: u.backgroundColor, farbe: u.color };
      uhr.hidden = war;
    }
    return { wer: e.classList.contains('ich') || e.classList.contains('zz-unten') ? 'ich' : 'gegner', banner: e.classList.contains('mit-banner'),
      hoehe: Math.round(r.height), radius: px(c.borderTopLeftRadius), grund: c.backgroundColor, polsterL: px(c.paddingLeft),
      av: av ? { breite: Math.round(avR.width), hoehe: Math.round(avR.height), radius: px(avC.borderTopLeftRadius) } : null,
      name: nC ? { schrift: px(nC.fontSize), gewicht: nC.fontWeight, farbe: nC.color } : null,
      unterzeile: !!e.querySelector('.unter'), geschlagen: !!e.querySelector('.geschlagen-ort'), uhr: uhrStil, blase: blaseAnteil(e) };
  });
}, screen);

const klangStand = (s) => s.evaluate(async () => (await import('./js/sounds.js')).klang.protokoll().map((e) => ({ nr: e.nr, name: e.name, aktion: e.aktion || 'spielt', grund: e.grund || '' })));
// Klang des EIGENEN Zugs: hoechstens 800 ms, und das Fenster endet, sobald eine Figur des Gegners auf einem neuen Feld
// steht (R9: der Antwortzug des Bots fiel sonst je nach Zeitpunkt mal hinein, mal nicht). Die Seite schaut in jedem Bild
// und alle 5 ms nach; gezaehlt wird, was beim letzten Blick VOR dem Gegnerzug im Protokoll stand.
async function klangBeimZug(s, brettSel, uci) {
  const vorher = await klangStand(s);
  const letzte = vorher.length ? vorher[vorher.length - 1].nr : 0;
  await s.evaluate(async ([sel, von]) => {
    const { klang } = await import('./js/sounds.js');
    const brett = document.querySelector(`${sel} .feld[data-feld="${von}"]`)?.closest('.brett');
    const ich = brett?.querySelector(`img.figur[data-feld="${von}"]:not(.geht)`)?.dataset.figur?.[0];
    const gegner = () => new Set([...(brett?.querySelectorAll('img.figur:not(.geht)') || [])]
      .filter((f) => ich && f.dataset.figur?.[0] !== ich).map((f) => f.dataset.feld + f.dataset.figur));
    const start = gegner();
    const stand = () => { const p = klang.protokoll(); return p.length ? p[p.length - 1].nr : 0; };
    const w = { bis: stand(), gegnerZog: false, aus: false };
    w.blick = () => {
      if (w.aus) return;
      if ([...gegner()].some((x) => !start.has(x))) { w.gegnerZog = true; w.aus = true; clearInterval(w.takt); return; }
      w.bis = stand();
    };
    const bild = () => { w.blick(); if (!w.aus) requestAnimationFrame(bild); };
    w.takt = setInterval(w.blick, 5);
    window.__klangFenster = w;
    requestAnimationFrame(bild);
  }, [brettSel, uci.slice(0, 2)]);
  await tippe(s, brettSel, uci);
  await warte(800);
  // Schluss im selben Schritt: ein letzter Blick, dann zaehlt der Stand JETZT (ein Bot-Zug zwischen Schluss und Auslesen
  // zaehlt nicht mehr mit)
  const bis = await s.evaluate(() => { const w = window.__klangFenster; w.blick(); w.aus = true; clearInterval(w.takt); return w.bis; });
  return (await klangStand(s)).filter((e) => e.nr > letzte && e.nr <= bis).map((e) => `${e.name}:${e.aktion}${e.grund ? '/' + e.grund : ''}`);
}
async function tippe(s, brettSel, uci) {
  for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) {
    const r = await s.locator(`${brettSel} .feld[data-feld="${f}"]`).first().boundingBox();
    await s.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
    await warte(120);
  }
}
// Rueckfrage (js/app.js frage): der letzte Knopf bestaetigt
async function bestaetige(s) {
  const knoepfe = s.locator('.dialog-ort:not(.weg) .dialog-knoepfe button');
  if (await knoepfe.first().waitFor({ timeout: 3000 }).then(() => true).catch(() => false)) await knoepfe.last().click();
}
const sichtbarDa = (s, sel, ms = 10000) => s.waitForFunction((sel) => [...document.querySelectorAll(sel)].some((e) => !e.hidden && e.getClientRects().length > 0), sel, { timeout: ms })
  .then(() => true).catch(() => false);

// ---- je Ansicht: oeffnen, messen, ziehen, beenden ----
const ABLAUF = {
  async bot(s, ctx) {
    await s.goto(BASIS + '#arena');
    await s.waitForFunction(() => window.__app && document.documentElement.dataset.screen === 'arena', null, { timeout: 30000 });
    await warte(600);
    const spielen = s.locator('[data-aktion="spielen"]').filter({ visible: true }).first();
    let ueberArena = true;
    if (await spielen.count()) await spielen.click(); else { ueberArena = false; await s.evaluate(() => window.__app.gehe('partie', { botId: 'benno' })); }
    await s.waitForFunction(() => window.__partie?.bereit && document.querySelector('.brett-rahmen > .brett .feld'), null, { timeout: 30000 });
    await introWeg(s); await warte(1200);
    const m = await messeK(s, ctx, '.screen.partie');
    m.ueberArena = ueberArena;
    const weiss = await s.evaluate(() => window.__partie.chess().turn() === 'w' && window.__partie.chess().history().length === 0);
    m.klang = weiss ? await klangBeimZug(s, '.brett-rahmen > .brett', 'e2e4') : null;
    await bild(s, m);
    await s.locator('.spielknoepfe > [data-aktion="aufgeben"]').click();
    await bestaetige(s);
    m.ergebnis = await sichtbarDa(s, '.ergebnis-overlay', 15000);
    return m;
  },
  async online(s, ctx) {
    await s.goto(BASIS + '#online');
    await s.waitForFunction(() => window.__app && document.documentElement.dataset.screen, null, { timeout: 30000 });
    await s.evaluate(() => window.__app.gehe('online', { partieId: 'gleich-1' }));
    await s.waitForFunction(() => window.__online?.brett() && !window.__online.busy() && document.querySelectorAll('.screen').length === 1
      && document.querySelector('.on-brett')?.getBoundingClientRect().width > 100, null, { timeout: 20000 });
    await warte(2000); // Visitenkarten, dann (nach hoechstens 1,5 s) das Intro
    await introWeg(s); await warte(800);
    const m = await messeK(s, ctx, '.screen');
    m.klang = await klangBeimZug(s, '.on-brett', 'e2e4');
    await bild(s, m);
    await s.locator('[data-online="aufgeben"]').filter({ visible: true }).first().click();
    await bestaetige(s);
    m.ergebnis = await sichtbarDa(s, '.on-ergebnis');
    return m;
  },
  async duell(s, ctx) {
    await s.goto(BASIS + '#raetsel-duell');
    await s.waitForSelector('.screen.raetsel-duell[data-phase="start"] .rd-suchen', { timeout: 30000 });
    await warte(400);
    await s.locator('.rd-suchen').click();
    await s.waitForSelector('.screen.raetsel-duell[data-phase="laeuft"] .rd-brett .feld', { timeout: 15000 });
    await introWeg(s); await warte(800);
    const m = await messeK(s, ctx, '.screen.raetsel-duell');
    m.klang = await klangBeimZug(s, '.rd-brett', 'a1a8');
    await bild(s, m);
    m.zustand.duell.beendet = true;
    m.ergebnis = await s.waitForSelector('.screen.raetsel-duell[data-phase="beendet"]', { timeout: 10000 }).then(() => true).catch(() => false);
    return m;
  },
  async zuzweit(s, ctx) {
    await s.goto(BASIS + '#arena');
    await s.waitForFunction(() => window.__app && document.documentElement.dataset.screen === 'arena', null, { timeout: 30000 });
    await s.evaluate(() => window.__app.gehe('partie', { modus: 'zuzweit', zuzweit: { weiss: 'Anna', schwarz: 'Ben', drehen: false }, tempo: null }));
    await s.waitForSelector('.zz-brett .feld', { timeout: 20000 });
    await introWeg(s); await warte(1200);
    const m = await messeK(s, ctx, '.screen');
    m.klang = await klangBeimZug(s, '.zz-brett', 'e2e4');
    await bild(s, m);
    await s.locator('[data-zz="aufgeben"]').filter({ visible: true }).first().click();
    await bestaetige(s);
    m.ergebnis = await sichtbarDa(s, '.zz-ergebnis');
    return m;
  },
  async lektion(s, ctx) {
    await s.goto(BASIS + '#training');
    await s.waitForFunction(() => window.__app && document.documentElement.dataset.screen, null, { timeout: 30000 });
    await s.evaluate(() => window.__app.gehe('lektion', { id: 'grundreihe' }));
    await s.waitForSelector('.ls-screen .brett-felder .feld', { timeout: 20000 });
    await introWeg(s); await warte(600);
    const ideePhase = await s.evaluate(() => window.__lektion?.zustand().phase === 'intro');
    await s.locator('.ls-aktionen [data-a="los"]').click();
    await s.waitForFunction(() => window.__lektion?.zustand().phase === 'flo', null, { timeout: 10000 });
    await warte(600);
    const m = await messeK(s, ctx, '.ls-screen');
    m.ideePhase = ideePhase;
    m.klang = await klangBeimZug(s, '.ls-screen .brett-felder', 'a1a8');
    await bild(s, m);
    m.ergebnis = await sichtbarDa(s, '.ls-meldung[data-art="geschafft"]');
    return m;
  },
};
// ctx = { datei, zustand }: Bildname und Server-Zustand (das Duell-Ende setzt der Ablauf am Server)
const messeK = async (s, ctx, screen) => {
  const m = Object.assign(await messeAnsicht(s, screen), ctx);
  if (m.fehlt) return m;
  m.stil = { hell: await messeLeistenStil(s, screen) };
  await s.emulateMedia({ colorScheme: 'dark' }); await warte(1000); // Farbuebergaenge (--d-m) abwarten
  m.stil.dunkel = await messeLeistenStil(s, screen);
  await s.emulateMedia({ colorScheme: 'light' }); await warte(1000);
  return m;
};
async function bild(s, m) { if (BILDER) await s.screenshot({ path: path.join(BILDER, `${m.datei}.png`) }); }

function initSkript({ sitzung, erfinder }) {
  try {
    if (!sessionStorage.getItem('gleich-start')) {
      sessionStorage.setItem('gleich-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
      localStorage.setItem('schach-arena:konto:sonderstuecke', JSON.stringify({ konto: sitzung.user.id, ids: erfinder }));
      // Aufgeben mit Rueckfrage statt 1 s Halten (Einstellung haltenAufgeben); aendert nur den Weg zum Ende
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ haltenAufgeben: false }));
    }
    window.__duellKiMs = 400; window.__duellAbfrageMs = 250;
  } catch (e) { /* egal */ }
  // Duell-Intro (js/ui/duell.js legt .duell an): einmal gesehen merken, auch wenn es vor dem Messen schon weg ist
  new MutationObserver((liste) => {
    for (const r of liste) for (const n of r.addedNodes) if (n.nodeType === 1 && (n.matches('.duell') || n.querySelector('.duell'))) window.__gleichIntro = true;
  }).observe(document, { childList: true, subtree: true });
}

let browser;
const seitenfehler = [], unerwartet = new Set();
async function laufMit(ansicht, [geraet, w, h]) {
  const k = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, serviceWorkers: 'block',
    locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const zustand = neuerZustand();
  await k.route('**/*.supabase.co/**', bediener(zustand));
  await k.addInitScript(initSkript, { sitzung: SITZUNG, erfinder: ERFINDER });
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  s.on('pageerror', (e) => seitenfehler.push(`${ansicht}@${geraet}: ${e.message}`));
  const ctx = { datei: `${geraet.replace(/\s+/g, '-').toLowerCase()}-${ansicht}`, zustand };
  const m = await ABLAUF[ansicht](s, ctx).catch((e) => ({ abbruch: e.message.split('\n')[0] }));
  if (!m.abbruch) m.intro = await s.evaluate(() => !!window.__gleichIntro).catch(() => null);
  for (const u of zustand.unerwartet) unerwartet.add(u);
  await k.close().catch(() => {});
  delete m.zustand;
  return m;
}

const ergebnisse = {};
try {
  browser = await browserTyp(pw).launch({ headless: true });
  for (const g of GERAETE) {
    ergebnisse[g[0]] = {};
    for (const a of ANSICHTEN) {
      const m = (ergebnisse[g[0]][a] = await laufMit(a, g));
      console.log(`  ${g[0]} ${NAME[a]}: ${m.abbruch || m.fehlt ? 'ABBRUCH ' + (m.abbruch || m.fehlt) : `Brett ${m.brett} px, Leisten ${m.leisten.map((l) => l.lage + '/' + l.wer).join(' ') || '-'}, `
        + `Intro ${m.intro}, Ergebnis ${m.ergebnis}, Klang ${JSON.stringify(m.klang)}`}`);
    }
  }
} catch (e) { pruefe('Probe laeuft ohne Abbruch', false, e.stack); }
finally { await browser?.close(); await new Promise((r) => server.close(r)); }

// ---- Auswertung gegen die Bot-Partie ----
// R8 (B4): Aussehen einer Leiste gegen dieselbe Leiste der Bot-Partie; Liste der Abweichungen (leer = gleich). Gewollt
// anders: die Namensfarbe auf dem Banner der Visitenkarte (Online, css/online.css: helle Schrift mit Schatten) und die
// Sprechblase des Bots: quer haelt die Gegnerkarte ihre groesste Hoehe mit Blase (js/ui/partie.js ruhig), dort ist
// die eigene Leiste der Bot-Partie der Massstab fuer die Hoehe.
function leistenAbweichung(l, v, vIch, { ohneUhr = false } = {}) {
  const a = [];
  const gleich = (n, x, y, tol = 0) => { if (typeof x === 'number' ? !(typeof y === 'number' && Math.abs(x - y) <= tol) : x !== y) a.push(`${n} ${x} statt ${y}`); };
  gleich('Hoehe', l.hoehe, v.blase && vIch ? vIch.hoehe : v.hoehe, 2);
  gleich('Ecke', l.radius, v.radius); gleich('Grund', l.grund, v.grund); gleich('Polster links', l.polsterL, v.polsterL, 0.5);
  gleich('Bild', l.av ? `${l.av.breite}x${l.av.hoehe}/${l.av.radius}` : 'keins', v.av ? `${v.av.breite}x${v.av.hoehe}/${v.av.radius}` : 'keins');
  gleich('Name Schrift', l.name?.schrift, v.name?.schrift); gleich('Name Gewicht', l.name?.gewicht, v.name?.gewicht);
  if (!l.banner) gleich('Name Farbe', l.name?.farbe, v.name?.farbe);
  gleich('Unterzeile', l.unterzeile, v.unterzeile); gleich('geschlagene Figuren', l.geschlagen, v.geschlagen);
  if (ohneUhr) gleich('Uhr', !!l.uhr, false);
  else if (!l.uhr || !v.uhr) gleich('Uhr', !!l.uhr, !!v.uhr);
  else for (const k of ['hoehe', 'breiteMin', 'schrift', 'radius', 'grund', 'farbe']) gleich(`Uhr ${k}`, l.uhr[k], v.uhr[k], k === 'hoehe' ? 1 : 0);
  return a;
}
const leistenMuster = (m) => m.leisten.map((l) => `${l.wer}:${l.lage}`).sort().join(' ');
const zeilen = [];
for (const [geraet, je] of Object.entries(ergebnisse)) {
  const bot = je.bot;
  const botOk = !!bot && !bot.abbruch && !bot.fehlt;
  pruefe(`${geraet}: Bot-Partie (Massstab) gemessen, ueber die Arena gestartet`, botOk && bot.ueberArena, bot);
  for (const a of ANSICHTEN) {
    const m = je[a];
    const lauf = !!m && !m.abbruch && !m.fehlt;
    pruefe(`${geraet} ${NAME[a]}: Ablauf ohne Abbruch, Brett gemessen`, lauf, m);
    if (!lauf || !botOk) { zeilen.push({ geraet, a, m, abw: ['nicht gemessen'] }); continue; }
    const abw = [];
    // R8 (13.11.2026): Online-Partie, Zu zweit und Raetsel-Duell sind angeglichen, ihre Gleichheits-Punkte zaehlen jetzt immer
    // (FEHLER statt ROT-ERWARTET). Seit R8-IntroZuzweit (Vorbau B) zaehlt auch das Intro vor Zu zweit: das Mini-Intro
    // "Weiss beginnt" (js/ui/duell.js spieleMiniIntro) ist ein .duell wie das Duell-Intro.
    // R15 (R6-Leisten B): die Lektion zieht bei den Leisten nach, deren Punkte zaehlen fuer sie ebenfalls immer
    const gezogen = (name) => a === 'online' || a === 'zuzweit' || a === 'duell' || (a === 'lektion' && /Leiste/.test(name));
    const hart = (name, gut, detail) => { if (!pruefe(`${geraet} ${NAME[a]}: ${name}`, gut, detail, { hart: !gezogen(name) })) abw.push(name); };
    pruefe(`${geraet} ${NAME[a]}: Gegenprobe Brett (Feldraster ${m.brett} px gegen .brett-felder ${m.brettRaster} px)`, m.brettRaster != null && Math.abs(m.brett - m.brettRaster) <= 1, m);
    const anders = KNOEPFE[a].anders || {};
    if (a !== 'bot') {
      hart(`Brett mindestens so gross wie in der Bot-Partie (${m.brett} gegen ${bot.brett} px, Toleranz ${TOLERANZ_PX} px)`, m.brett >= bot.brett - TOLERANZ_PX, { brett: m.brett, bot: bot.brett });
      if (anders.leisten) pruefe(`${geraet} ${NAME[a]}: keine Spielerleisten (${anders.leisten})`, m.leisten.length === 0, m.leisten);
      else hart(`Leisten wie in der Bot-Partie (${leistenMuster(m) || 'keine'} gegen ${leistenMuster(bot)})`, leistenMuster(m) === leistenMuster(bot), m.leisten);
      if (anders.intro) pruefe(`${geraet} ${NAME[a]}: Idee-Phase statt Duell-Intro (${anders.intro})`, m.ideePhase === true && !m.intro, { intro: m.intro, ideePhase: m.ideePhase });
      else hart(`Duell-Intro wie in der Bot-Partie (${m.intro ? 'ja' : 'nein'} gegen ${bot.intro ? 'ja' : 'nein'})`, m.intro === bot.intro, { intro: m.intro, ideePhase: m.ideePhase });
    }
    if (a === 'online' || a === 'zuzweit') hart(`Zuege wie in der Bot-Partie (${m.zugStreifen} gegen ${bot.zugStreifen})`, m.zugStreifen === bot.zugStreifen, { hier: m.zugStreifen, bot: bot.zugStreifen });
    if (a === 'online' || a === 'zuzweit' || a === 'lektion') for (const modus of ['hell', 'dunkel']) for (const wer of ['gegner', 'ich']) {
      const v = bot.stil?.[modus]?.find((l) => l.wer === wer), l = m.stil?.[modus]?.find((x) => x.wer === wer);
      const vIch = bot.stil?.[modus]?.find((x) => x.wer === 'ich');
      const diff = v && l ? leistenAbweichung(l, v, vIch, { ohneUhr: !!anders.uhr }) : null;
      hart(`Leiste ${wer} (${modus}) wie in der Bot-Partie`, !!diff && diff.length === 0, diff || { bot: v, hier: l });
    }
    const ohneName = m.leisten.filter((l) => !l.name || !l.avatar);
    if (!anders.leisten) hart('jede Leiste mit Name und Avatar', m.leisten.length > 0 && ohneName.length === 0, m.leisten);
    hart('Leisten ganz im Fenster', m.leisten.every((l) => l.imBild), m.leisten);
    for (const kn of KNOEPFE[a].erwartet) hart(`Knopf ${kn} sichtbar ohne Scrollen`, m.knoepfe[kn].da && m.knoepfe[kn].imBild && !m.seiteScrollt, { knopf: m.knoepfe[kn], seiteScrollt: m.seiteScrollt });
    hart('Ergebnis am Ende sichtbar', m.ergebnis === true, m.ergebnis);
    hart('Klang beim eigenen Zug ausgeloest', Array.isArray(m.klang) && m.klang.length > 0, m.klang);
    zeilen.push({ geraet, a, m, abw });
  }
}
pruefe('Keine Seitenfehler', !seitenfehler.length, seitenfehler.slice(0, 8));
if (unerwartet.size) console.log(`Hinweis: unbeantwortete RPCs der Attrappe (leere Antwort): ${[...unerwartet].join(', ')}`);

if (TABELLE) {
  const jn = (x) => (x == null ? '?' : x ? 'ja' : 'nein');
  const leiste = (m, wer) => {
    const l = m.leisten?.find((x) => x.wer === wer);
    return l ? `${l.lage}${l.name ? '' : ' ohne Name'}${l.avatar ? '' : ' ohne Avatar'}${l.uhr ? ', Uhr' : ''}` : '–';
  };
  const knoepfe = (a, m) => [...KNOEPFE[a].erwartet.map((k) => `${k} ${m.knoepfe?.[k]?.imBild ? '✓' : '✗'}`),
    ...Object.keys(KNOEPFE[a].ohne).map((k) => `${k} ${m.knoepfe?.[k]?.da ? 'da' : '–'}¹`)].join(', ');
  const t = ['# Gleichheits-Probe der Partie-Ansichten', '',
    `Stand: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC, Probe \`tests/gleichheit-ansichten.test.mjs\` (Massstab: Bot-Partie ueber die Arena).`,
    `Brett-Toleranz ${TOLERANZ_PX} px (Rundung von acht Feldbreiten plus Rand). Bilder: \`<geraet>-<ansicht>.png\` daneben.`, ''];
  for (const [geraet] of GERAETE) {
    t.push(`## ${geraet}`, '', '| Ansicht | Brett px | Leiste Gegner | Leiste ich | Knoepfe im Bild | Intro | Ergebnis | Klang | Abweichungen |', '|---|---|---|---|---|---|---|---|---|');
    for (const z of zeilen.filter((x) => x.geraet === geraet)) {
      const m = z.m || {};
      t.push(`| ${NAME[z.a]} | ${m.brett ?? '?'} | ${leiste(m, 'gegner')} | ${leiste(m, 'ich')} | ${knoepfe(z.a, m)} | ${jn(m.intro)}${m.ideePhase ? ' (Idee-Phase)' : ''} | ${jn(m.ergebnis)} | `
        + `${(m.klang || []).join(' ') || 'nein'} | ${z.abw.length ? z.abw.join('; ') : '–'} |`);
    }
    t.push('');
  }
  t.push('¹ Knopf nicht erwartet:', ...ANSICHTEN.flatMap((a) => Object.entries(KNOEPFE[a].ohne).map(([k, g]) => `- ${NAME[a]}, ${k}: ${g}`)), '');
  mkdirSync(path.dirname(TABELLE), { recursive: true });
  writeFileSync(TABELLE, t.join('\n'), 'utf8');
  console.log(`Tabelle: ${TABELLE}`);
}
if (arg('stil')) { writeFileSync(arg('stil'), JSON.stringify(Object.fromEntries(Object.entries(ergebnisse).map(([g, je]) => [g, Object.fromEntries(Object.entries(je).map(([a, m]) => [a, m.stil || null]))])), null, 1), 'utf8'); console.log(`Stil: ${arg('stil')}`); }
if (rotErwartet) console.log(`\n${rotErwartet} harte Pruefung(en) ROT-ERWARTET (zaehlen erst mit PROBE_STRENG=1): ${rot.join(' | ')}`);
console.log(`\n${ok}/${gesamt} bestanden`); process.exitCode = ok === gesamt ? 0 : 1;
