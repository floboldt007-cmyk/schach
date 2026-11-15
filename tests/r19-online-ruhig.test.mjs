// Online ruhiger (Feinschliff R19, Flo 14.11.2026: "zu viele Zahlen, zu unuebersichtlich"; Wahl 23:00: Entwurf A). A ist die
// einzige Fassung (js/ui/online.js, css/online.css), die Kennung ?onlineStil gibt es nicht mehr:
//   Lobby genau EINE Zahl (deine Online-Elo vom Server, kronen_mein_stand.elo), Stufe, Platz und Kronen hinter "Mehr";
//   ohne Elo vom Server (Feld fehlt, null, kaputt) KEINE Zahl, gross steht die Liga als Wort ("Deine Liga"), auch wenn das
//   Geraet eine Bot-Liga-Wertung hat (andere Groesse, kein Rueckfall darauf); Spielerleisten: eigene nur der Name, der Gegner
//   mit "Elo N" (Server-Elo der Visitenkarte, Flo 15.11.), ohne sie mit der Liga als Wort;
//   Ergebnis hoechstens eine Zahl (die Kronen-Aenderung). Lobby und Suche matt, Partie und Ergebnisblatt mit dem Schein der
//   Bot-Partie (scheinWieBot, Kaltreview 64 vom 15.11.). iPhone 13, SE und PC, hell und dunkel. Netz nur simuliert.
//
//   node tests/r19-online-ruhig.test.mjs
//   PORT=8976 node tests/r19-online-ruhig.test.mjs   eigener Port (Standard: frei)
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
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/r19-online.test.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}

// ---- Server-Attrappe wie tests/bilder-online.mjs; kronen_mein_stand nennt die Elo (Feld elo), wenn z.elo gesetzt ist ----
const UID = 'u1';
const token = (uid) => 'a.' + Buffer.from(JSON.stringify({ sub: uid })).toString('base64url') + '.x';
const SITZUNG = { access_token: token(UID), refresh_token: 'test-r', expires_at: 9999999999, user: { id: UID, email: 'u1@example.invalid' } };
const NAMEN = { u1: 'Spieler_1', u2: 'Spieler_2' };
const PARTIE = 'ruhig-1';
const ELO = 1240;
const GEGNER_ELO = { u1: 1240, u2: 1310 }; // Visitenkarte mit Elo (vor A zeigte die Leiste "Elo 1310 · Läufer II")
const iso = (ms) => new Date(ms).toISOString();

function bediener(z) {
  return async (route) => {
    const req = route.request(), url = new URL(req.url());
    let body = {}; try { body = req.postDataJSON() || {}; } catch (e) { body = {}; }
    const antwort = (d, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(d) });
    if (url.pathname.startsWith('/auth/v1/')) return antwort({ id: UID, email: UID + '@example.invalid' });
    if (url.pathname === '/rest/v1/profile') return antwort([{ user_id: UID, benutzername: NAMEN[UID] }]);
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
    const rpc = (url.pathname.match(/\/rest\/v1\/rpc\/([a-z_]+)/) || [])[1];
    if (!rpc) return antwort([]);
    const p = z.partien.get(body.partie);
    const wartet = () => ({ wartet: true, warte_s: 120, ki_ab_s: 60, seit: iso(z.sucheSeit), zeit: '5+3' });
    if (rpc === 'online_suche_start') { z.sucheSeit = Date.now(); return antwort(wartet()); }
    if (rpc === 'online_suche_stand') {
      if (!z.treffer) return antwort(wartet());
      const c = new Chess(), jetzt = iso(Date.now());
      z.partien.set(PARTIE, { id: PARTIE, code: null, weiss: 'u1', schwarz: 'u2', erstellt_von: 'u2', gewertet: true, status: 'laeuft',
        fen: c.fen(), am_zug: 'w', zuege: '', ergebnis: null, grund: null, remis_angebot: null, bedenkzeit_s: 300, inkrement_s: 3,
        uhr_weiss_ms: 300000, uhr_schwarz_ms: 300000, letzter_zug_am: jetzt, erstellt_am: jetzt, aktualisiert_am: jetzt });
      return antwort({ partie: PARTIE });
    }
    if (rpc === 'online_suche_ende') return antwort({});
    if (rpc === 'online_meine') return antwort([...z.partien.values()].filter((q) => q.status !== 'beendet'));
    if (rpc === 'online_live_bewertung_frei') return antwort({ frei: true, rest: 1, unbegrenzt: false });
    if (rpc === 'online_live_bewertung_nutzen') return antwort({ ok: true, frei: true, rest: 0, unbegrenzt: false, gebucht: true });
    if (rpc === 'online_pruefe_zeit' && p) return antwort(p);
    if (rpc === 'online_gib_auf' && p) { Object.assign(p, { status: 'beendet', grund: 'aufgabe', ergebnis: '0-1', aktualisiert_am: iso(Date.now()) }); return antwort(p); }
    if (rpc === 'karte_der_partie') {
      const karte = (u) => ({ name: NAMEN[u], banner: 'saison-silber', titel: 'erfolg-feuertaufe', vitrine: [], motiv: 'Q', grund: 'standard', rahmen: 'ohne', ...(u !== UID && 'karte' in z ? z.karte : { kronen_stufe: 7, elo: GEGNER_ELO[u] }), du: u === UID });
      return antwort(p ? { w: karte(p.weiss), s: karte(p.schwarz) } : {});
    }
    if (rpc === 'kronen_mein_stand' && z.standKaputt) return antwort({ message: 'kaputt' }, 500);
    if (rpc === 'kronen_mein_stand') return antwort({ stufe: 7, kronen: 140, platz: 3, ziel: 120, n: 30, woche: '2026-11-09', ...('elo' in z ? { elo: z.elo } : {}) });
    return antwort(rpc === 'karte_melde_stufen' ? {} : []);
  };
}
function initSkript({ sitzung, liga }) {
  try {
    if (!sessionStorage.getItem('ruhig-start')) {
      sessionStorage.setItem('ruhig-start', '1');
      localStorage.clear();
      if (sitzung) localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
      if (liga) localStorage.setItem('schach-arena:v1:modul:liga', JSON.stringify(liga));
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ haltenAufgeben: false, duellIntro: 'aus' }));
    }
  } catch (e) { /* egal */ }
}
const sichtbar = (s, sel, ms = 15000) => s.waitForFunction((sel) => [...document.querySelectorAll(sel)].some((e) => !e.hidden && e.getClientRects().length > 0), sel, { timeout: ms })
  .then(() => true).catch(() => false);

// Zahlen, die man sieht: Textknoten mit Ziffern (oder ½) unter `wurzel`, sichtbar (checkVisibility: auch zugeklappte
// details und hidden zaehlen nicht), ohne die Teile in `ohne`. Je Knoten die Zahlgruppen ("5 + 3" sind zwei).
const zahlenIn = (s, wurzel, ohne = '') => s.evaluate(([wurzel, ohne]) => {
  const raus = [];
  for (const w of document.querySelectorAll(wurzel)) {
    const gang = document.createTreeWalker(w, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = gang.nextNode())) {
      const el = n.parentElement;
      if (!el || (ohne && el.closest(ohne)) || !el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
      for (const z of n.textContent.match(/\d+(?:[:.,]\d+)*|½/g) || []) raus.push(z);
    }
  }
  return raus;
}, [wurzel, ohne]);

// Jeder Tuertext (js/ui/online.js tuer()): sichtbar an der Tuer oder als Punkt in "Mehr" (Kaltreview 15.11., Befund 1).
const leseTuerTexte = (s) => s.evaluate(() => {
  const mehr = [...document.querySelectorAll('.online-screen details.on-mehr li')].map((li) => li.textContent.trim());
  return [...document.querySelectorAll('.online-screen .on-tuer-text p')].map((p) => ({ text: p.textContent.trim(),
    sichtbar: p.checkVisibility({ visibilityProperty: true, opacityProperty: true }), inMehr: mehr.includes(p.textContent.trim()) }));
});

// Spielerleisten: Name, sichtbare Unterzeile (.p-meta), Chips und Titel, Hoehe und Ueberlauf (Flo 15.11. 12:50: "die elo
// soll man schon sehen koennen" - die Gegnerleiste zeigt wieder die Server-Elo, sonst die Liga als Wort)
const leseLeisten = (s) => s.evaluate(() => [...document.querySelectorAll('.online-screen .on-spieler')].map((e) => ({
  ort: e.classList.contains('on-oben') ? 'oben' : 'unten',
  name: e.querySelector('.name b')?.textContent.trim() || '',
  zeile: e.querySelector('.p-meta')?.checkVisibility() ? e.querySelector('.p-meta').textContent.trim() : null,
  label: e.getAttribute('aria-label'),
  chips: e.querySelectorAll('.on-chip, .on-abzeichen, .on-titel').length,
  hoehe: Math.round(e.getBoundingClientRect().height),
  ueberlauf: [...e.querySelectorAll('.info, .name, .unter, .p-meta')].filter((x) => x.checkVisibility() && x.scrollWidth > x.clientWidth + 1)
    .map((x) => x.className) })));
// Matt (Flo 15.11. ca. 12:15: "Symbole leuchten zu viel. Cleaner und matt machen"): unter `wurzel` kein farbiger Schein
// (Schatten mit Farbe), kein Glanzlicht (heller inset-Schatten), kein Textschatten, kein drop-shadow und kein Verlauf. Ausgenommen
// ist das Mini-Brett (.on-bild: die Felder SIND ein Muster) und die Visitenkarten-Leisten der Partie (.mit-banner, Banner-Bild).
const glanzIn = (s, wurzel) => s.evaluate((wurzel) => {
  const raus = [];
  // je Schatten: Farbe (rgb() oder color(srgb ...)), Versatz, Unschaerfe. Ein Ring (0 0 0 Npx) ist ein Rahmen, kein Schein;
  // die warm-neutralen Theme-Schatten (48,36,20 bei 4-6 %) sind keine Farbe. Schein = gesaettigt (Spanne > 60 von 255) und
  // ab 10 % Deckung; Glanzlicht = heller inset-Schatten ab 10 % Deckung.
  const schatten = (t) => (t === 'none' ? [] : t.split(/,(?![^(]*\))/)).map((x) => {
    const m = /rgba?\(([^)]+)\)/.exec(x), q = /color\(srgb ([^)]+)\)/.exec(x);
    const f = m ? m[1].split(/[\s,/]+/).filter(Boolean).map(Number)
      : q ? q[1].split(/[\s/]+/).filter(Boolean).map((v, i) => (i < 3 ? Number(v) * 255 : Number(v))) : [0, 0, 0, 1];
    const [r, g, b, a = 1] = f;
    const px = [...x.replace(/(rgba?|color)\([^)]*\)/g, '').matchAll(/(-?[\d.]+)px/g)].map((n) => Number(n[1]));
    return { r, g, b, a, inset: /inset/.test(x), ring: px.length >= 3 && px[0] === 0 && px[1] === 0 && px[2] === 0, text: x.trim() };
  });
  for (const w of document.querySelectorAll(wurzel)) {
    for (const e of [w, ...w.querySelectorAll('*')]) {
      if (!e.checkVisibility() || e.closest('.on-bild, .mit-banner')) continue;
      const c = getComputedStyle(e);
      const name = `${e.tagName.toLowerCase()}.${[...e.classList].join('.')}`;
      for (const x of schatten(c.boxShadow)) {
        if (x.ring || x.a < 0.1) continue;
        if (Math.max(x.r, x.g, x.b) - Math.min(x.r, x.g, x.b) > 60) raus.push(`${name}: farbiger Schein ${x.text}`);
        else if (x.inset && Math.min(x.r, x.g, x.b) > 200) raus.push(`${name}: Glanzlicht ${x.text}`);
      }
      if (c.textShadow !== 'none') raus.push(`${name}: Textschatten ${c.textShadow}`);
      if (/drop-shadow/.test(c.filter)) raus.push(`${name}: drop-shadow ${c.filter}`);
      if (/gradient/.test(c.backgroundImage)) raus.push(`${name}: Verlauf`);
    }
  }
  return [...new Set(raus)];
}, wurzel);
// box-shadow eines Hauptknopfs im Online-Bildschirm gegen denselben Knopf ausserhalb (so wie die Bot-Partie ihn zeigt).
// echte: Selektor der echten Knoepfe; ohne ihn wird ein Probeknopf mit den Klassen von "Zur Partie" eingesetzt.
// huelle: 'a|b' baut die Huelle des Bezugsknopfs (z. B. ergebnis-overlay > ergebnis-karte) ausserhalb von .online-screen
const scheinWieBot = (s, wurzel, echte, huelle) => s.evaluate(({ wurzel, echte, huelle }) => {
  const KLASSEN = 'knopf primaer za-live dr';
  let aussen = document.body;
  const weg = [];
  for (const k of huelle ? huelle.split('|') : []) { const d = document.createElement('div'); d.className = k; aussen.append(d); if (aussen === document.body) weg.push(d); aussen = d; }
  const ref = document.createElement('button');
  ref.className = echte ? 'knopf primaer' : KLASSEN;
  ref.textContent = 'x';
  aussen.append(ref);
  if (!weg.length) weg.push(ref);
  const soll = getComputedStyle(ref).boxShadow;
  weg.forEach((e) => e.remove());
  const ort = document.querySelector(wurzel);
  if (!ort) return { soll, ist: [], fehlt: wurzel };
  if (echte) return { soll, ist: [...document.querySelectorAll(echte)].map((b) => getComputedStyle(b).boxShadow) };
  const probe = document.createElement('button');
  probe.className = KLASSEN;
  probe.textContent = 'x';
  ort.append(probe);
  const ist = [getComputedStyle(probe).boxShadow];
  probe.remove();
  return { soll, ist };
}, { wurzel, echte, huelle });
async function partieOffen(s, z, gruppe, beiSuche = null) {
  await s.locator('[data-online="suchen"]').filter({ visible: true }).first().click();
  await sichtbar(s, '.on-suche');
  if (beiSuche) await beiSuche();
  z.treffer = true;
  const offen = await s.waitForFunction(() => window.__online?.brett() && !window.__online.busy()
    && document.querySelector('.on-brett')?.getBoundingClientRect().width > 100, null, { timeout: 20000 }).then(() => true).catch(() => false);
  pruefe(`${gruppe}: Partie offen`, offen);
  await s.waitForFunction(() => document.querySelectorAll('.on-spieler .on-banner').length === 2, null, { timeout: 10000 }).catch(() => {});
  await s.waitForFunction(() => !document.querySelector('.duell'), null, { timeout: 12000 }).catch(() => {});
}

async function tippe(s, uci) {
  for (const f of [uci.slice(0, 2), uci.slice(2, 4)]) {
    const r = await s.locator(`.on-brett .feld[data-feld="${f}"]`).first().boundingBox();
    await s.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
    await warte(120);
  }
}

const GERAETE = [['iPhone 13', 390, 844], ['iPhone SE', 375, 667], ['PC', 1280, 720]];
const seitenfehler = [];

async function neueSeite(browser, [w, h], z, { liga = null, gruppe, sitzung = SITZUNG, farbe = 'light' }) {
  const k = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, serviceWorkers: 'block',
    colorScheme: farbe, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  await k.route('**/*.supabase.co/**', bediener(z));
  await k.addInitScript(initSkript, { sitzung, liga });
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  s.on('pageerror', (e) => seitenfehler.push(`${gruppe}: ${e.message}`));
  return { k, s };
}
async function lobbyBereit(s, gruppe, kennung = '') {
  await s.goto(`http://127.0.0.1:${PORT}/index.html?test${kennung}#online`);
  pruefe(`${gruppe}: Lobby mit Suchknopf`, await sichtbar(s, '[data-online="suchen"]:not([disabled])', 30000));
  await s.waitForFunction(() => !document.querySelector('.on-liga[data-laedt]'), null, { timeout: 10000 }).catch(() => {});
  await warte(300);
}

// A mit Elo vom Server: Lobby, Partie, Ergebnis. `kennung` prueft, dass eine alte Kennung nichts mehr umschaltet.
async function lauf(browser, [geraet, w, h], kennung = '', farbe = 'light') {
  const gruppe = `${geraet}${farbe === 'dark' ? ' dunkel' : ''}${kennung ? ' mit alter Kennung ' + kennung : ''}`;
  const z = { partien: new Map(), treffer: false, sucheSeit: null, elo: ELO };
  const { k, s } = await neueSeite(browser, [w, h], z, { gruppe, farbe });
  try {
    await lobbyBereit(s, gruppe, kennung);
    const glanzLobby = await glanzIn(s, '.online-screen .on-inhalt');
    pruefe(`${gruppe}: Lobby matt (kein Schein, Glanz, Verlauf)`, glanzLobby.length === 0, glanzLobby);
    const attr = await s.evaluate(() => document.querySelector('.online-screen')?.dataset.onlineStil ?? null);
    pruefe(`${gruppe}: keine Stil-Kennung am Bildschirm`, attr === null, attr);
    const lobby = await zahlenIn(s, '.online-screen .on-inhalt', '.on-bild img');
    pruefe(`${gruppe}: Lobby zeigt genau eine Zahl, die Elo`, lobby.length === 1 && lobby[0] === String(ELO), lobby);
    const gross = await s.evaluate(() => {
      const l = document.querySelector('.online-screen .on-liga');
      return l ? { wert: l.querySelector('.on-gross-wert')?.textContent.trim(), text: l.querySelector('.on-gross-text')?.textContent.trim(),
        label: l.getAttribute('aria-label'), sichtbar: l.checkVisibility() } : null;
    });
    pruefe(`${gruppe}: gross die Elo mit "Deine Elo", vorgelesen wie zu sehen`, !!gross && gross.sichtbar && gross.wert === String(ELO)
      && gross.text === 'Deine Elo' && gross.label === `Deine Elo: ${ELO}`, gross);
    const mehr = await s.evaluate(() => {
      const d = document.querySelector('.online-screen details.on-mehr');
      return d ? { offen: d.open, text: d.textContent.replace(/\s+/g, ' ') } : null;
    });
    pruefe(`${gruppe}: Stufe, Platz und Kronen hinter "Mehr" (zu)`, !!mehr && !mehr.offen && /Platz 3 von 30/.test(mehr.text) && /140/.test(mehr.text), mehr);
    const tuerTexte = await leseTuerTexte(s);
    pruefe(`${gruppe}: jeder Tuertext sichtbar oder in "Mehr" (auch das Duell)`, tuerTexte.length >= 2
      && tuerTexte.every((t) => t.sichtbar || t.inMehr) && tuerTexte.some((t) => t.text === 'Gleiche Rätsel für beide, live'), tuerTexte);
    const alt = await s.evaluate(() => document.querySelectorAll('.online-screen :is(.on-rk, .on-ich-leiste, .on-abzeichen, .on-chip)').length);
    pruefe(`${gruppe}: keine Bausteine der Entwuerfe B und C`, alt === 0, alt);
    const duell = await s.evaluate(() => document.querySelector('#on-duell-t')?.textContent.trim() ?? null);
    pruefe(`${gruppe}: Duell-Tuer heisst "Rätsel gegen einen Menschen"`, duell === 'Rätsel gegen einen Menschen', duell);

    // Partie
    await partieOffen(s, z, gruppe, async () => {
      const g = await glanzIn(s, '.online-screen .on-suche');
      pruefe(`${gruppe}: Suche matt`, g.length === 0, g);
    });
    await tippe(s, 'e2e4');
    await warte(600);
    // Zahlen in den Spielerleisten ohne die Uhren (die braucht man zum Spielen) und ohne die Namen (Spieler_2 ist ein Name)
    const leisten = await zahlenIn(s, '.online-screen .on-spieler', '.uhr, .name');
    const meta = await leseLeisten(s);
    const oben = meta.find((m) => m.ort === 'oben'), unten = meta.find((m) => m.ort === 'unten');
    pruefe(`${gruppe}: Gegnerleiste mit "Elo ${GEGNER_ELO.u2}" (Server-Elo), ohne Chips und Titel`, !!oben && oben.name === NAMEN.u2
      && oben.zeile === `Elo ${GEGNER_ELO.u2}` && !oben.chips && oben.label === `${NAMEN.u2}, Elo ${GEGNER_ELO.u2}`, oben);
    pruefe(`${gruppe}: eigene Leiste nur mit Namen (keine Elo-Zeile, keine Chips)`, !!unten && unten.name && unten.zeile === null && !unten.chips, unten);
    pruefe(`${gruppe}: in den Spielerleisten ausser der Uhr nur die Gegner-Elo als Zahl`, leisten.length === 1 && leisten[0] === String(GEGNER_ELO.u2), leisten);
    pruefe(`${gruppe}: Gegnerleiste nicht hoeher als die eigene, kein Ueberlauf`, !!oben && !!unten && oben.hoehe <= Math.max(unten.hoehe, 58)
      && !oben.ueberlauf.length, meta);
    // "Zur Partie" (online.js za-live), Remis annehmen und Strittig stehen in .on-inhalt der Partie: Schein wie in der Bot-Partie
    const partieSchein = await scheinWieBot(s, '.online-screen.online-partie .on-inhalt', null, '');
    pruefe(`${gruppe}: Partie: Hauptknopf (za-live) mit Schein wie in der Bot-Partie`, partieSchein.ist.length === 1 && partieSchein.ist[0] === partieSchein.soll
      && partieSchein.soll !== 'none', partieSchein);

    // Ergebnis
    await s.locator('[data-online="aufgeben"]').filter({ visible: true }).first().click();
    const knoepfe = s.locator('.dialog-ort:not(.weg) .dialog-knoepfe button');
    if (await knoepfe.first().waitFor({ timeout: 3000 }).then(() => true).catch(() => false)) await knoepfe.last().click();
    pruefe(`${gruppe}: Ergebnisblatt`, await sichtbar(s, '.on-erg .ergebnis-karte'));
    await s.waitForFunction(() => { const k = document.querySelector('.on-erg-kronen'); return k && !k.hidden; }, null, { timeout: 8000 }).catch(() => {});
    await warte(300);
    const blatt = await zahlenIn(s, '.on-erg .ergebnis-karte');
    const kronen = await s.evaluate(() => document.querySelector('.on-erg-kronen')?.checkVisibility()
      ? document.querySelector('.on-erg-kronen').textContent.replace(/\s+/g, ' ').trim() : null);
    pruefe(`${gruppe}: Ergebnis hoechstens eine Zahl, ohne Wochenstand`, blatt.length <= 1 && !/140/.test(kronen || ''), { blatt, kronen });
    // Kaltreview 64 (15.11.): die Partie samt Ergebnisblatt bleibt gleich der Bot-Partie, matt ist nur die Seite davor
    const ergSchein = await scheinWieBot(s, '.on-erg', '.on-erg .knopf.primaer', 'ergebnis-overlay|ergebnis-karte');
    pruefe(`${gruppe}: Ergebnisblatt: Hauptknopf mit Schein wie in der Bot-Partie`, ergSchein.ist.length > 0 && ergSchein.ist.every((x) => x === ergSchein.soll)
      && ergSchein.soll !== 'none', ergSchein);
    const altErg = await s.evaluate(() => document.querySelectorAll('.on-erg :is(.on-erg-spieler, .on-rk)').length);
    pruefe(`${gruppe}: Ergebnis ohne Leisten und Karten der Entwuerfe`, altErg === 0, altErg);
  } catch (e) {
    pruefe(`${gruppe}: Ablauf ohne Abbruch`, false, e.message.split('\n')[0]);
  }
  await k.close().catch(() => {});
}

// Ohne Elo vom Server: keine Zahl, gross die Liga als Wort. Auch eine Bot-Liga-Wertung des Geraets (andere Groesse) erscheint
// nicht (Gegenprobe zum frueheren Rueckfall auf ladeModul('liga').wertung).
const OHNE = [
  ['Feld elo fehlt', {}],
  ['elo null', { elo: null }],
  ['elo kaputt "x"', { elo: 'x' }],
  ['elo ausserhalb 99999', { elo: 99999 }],
  ['Feld fehlt, Geraet mit Bot-Liga-Wertung 1555', {}, { wertung: { n: 12, wert: 1555, blitz: { n: 0, wert: 800 } } }],
];
async function ohneElo(browser, [name, felder, liga]) {
  const gruppe = `ohne Server-Elo (${name})`;
  const z = { partien: new Map(), treffer: false, sucheSeit: null, ...felder };
  const { k, s } = await neueSeite(browser, [390, 844], z, { liga, gruppe });
  try {
    await lobbyBereit(s, gruppe);
    const lobby = await zahlenIn(s, '.online-screen .on-inhalt', '.on-bild img');
    const l = await s.evaluate(() => {
      const e = document.querySelector('.online-screen .on-liga');
      return e ? { wert: e.querySelector('.on-gross-wert')?.textContent.trim(), text: e.querySelector('.on-gross-text')?.textContent.trim(),
        label: e.getAttribute('aria-label') } : null;
    });
    pruefe(`${gruppe}: keine Zahl, gross "Warden II" mit "Deine Liga"`, lobby.length === 0 && !!l && l.wert === 'Warden II'
      && l.text === 'Deine Liga' && l.label === 'Deine Liga: Warden II', { lobby, l });
    const text = await s.evaluate(() => document.querySelector('.online-screen .on-inhalt')?.textContent || '');
    pruefe(`${gruppe}: kein undefined, null oder NaN im Text`, !/undefined|null|NaN/.test(text), text.match(/undefined|null|NaN/g));
  } catch (e) {
    pruefe(`${gruppe}: Ablauf ohne Abbruch`, false, e.message.split('\n')[0]);
  }
  await k.close().catch(() => {});
}

// Gegner ohne gueltige Server-Elo in der Visitenkarte: die Leiste zeigt die Liga als Wort (kronen_stufe 7 = Warden II), nie
// eine Zahl; ohne Liga steht dort nichts (keine erfundene Zeile).
const GEGNER_OHNE = [
  ['Feld elo fehlt', { kronen_stufe: 7 }, 'Warden II'],
  ['elo null', { kronen_stufe: 7, elo: null }, 'Warden II'],
  ['elo kaputt "x"', { kronen_stufe: 7, elo: 'x' }, 'Warden II'],
  ['elo ausserhalb 99999', { kronen_stufe: 7, elo: 99999 }, 'Warden II'],
  ['weder Elo noch Liga', {}, null],
];
async function gegnerOhneElo(browser, [name, karte, erwartet]) {
  const gruppe = `Gegner ohne Server-Elo (${name})`;
  const z = { partien: new Map(), treffer: false, sucheSeit: null, elo: ELO, karte };
  const { k, s } = await neueSeite(browser, [375, 667], z, { gruppe });
  try {
    await lobbyBereit(s, gruppe);
    await partieOffen(s, z, gruppe);
    await warte(400);
    const meta = await leseLeisten(s);
    const oben = meta.find((m) => m.ort === 'oben');
    const zahlen = await zahlenIn(s, '.online-screen .on-spieler', '.uhr, .name');
    pruefe(`${gruppe}: Gegnerleiste ${erwartet ? `"${erwartet}"` : 'ohne Unterzeile'}, keine Zahl ausser der Uhr`, !!oben
      && oben.zeile === erwartet && zahlen.length === 0 && !oben.ueberlauf.length, { oben, zahlen });
    const text = await s.evaluate(() => document.querySelector('.online-screen .on-oben')?.textContent || '');
    pruefe(`${gruppe}: kein undefined, null oder NaN in der Leiste`, !/undefined|null|NaN/.test(text), text);
  } catch (e) {
    pruefe(`${gruppe}: Ablauf ohne Abbruch`, false, e.message.split('\n')[0]);
  }
  await k.close().catch(() => {});
}

// Ohne "Mehr" (kronen_mein_stand 500, oder ohne Konto) bleiben die Tuertexte an der Tuer stehen (Kaltreview 15.11.,
// Befund 2): ausgeblendet wird nur, was "Mehr" auch zeigt.
async function ohneMehr(browser, [name, felder, sitzung]) {
  const gruppe = `ohne "Mehr" (${name})`;
  const z = { partien: new Map(), treffer: false, sucheSeit: null, ...felder };
  const { k, s } = await neueSeite(browser, [390, 844], z, { gruppe, sitzung });
  try {
    await s.goto(`http://127.0.0.1:${PORT}/index.html?test#online`);
    const da = await s.waitForFunction((konto) => konto ? document.querySelector('.on-suche-text:not([hidden])')
      : document.querySelector('.on-tueren[data-zustand="ohne"]'), !!sitzung, { timeout: 30000 }).then(() => true).catch(() => false);
    pruefe(`${gruppe}: Lobby geladen`, da);
    await warte(300);
    const mehr = await s.evaluate(() => document.querySelectorAll('.online-screen details.on-mehr').length);
    const texte = await leseTuerTexte(s);
    pruefe(`${gruppe}: kein "Mehr", beide Tuertexte sichtbar`, mehr === 0 && texte.length === 2 && texte.every((t) => t.sichtbar), { mehr, texte });
  } catch (e) {
    pruefe(`${gruppe}: Ablauf ohne Abbruch`, false, e.message.split('\n')[0]);
  }
  await k.close().catch(() => {});
}

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  for (const g of GERAETE) await lauf(browser, g);
  for (const g of [GERAETE[0], GERAETE[2]]) await lauf(browser, g, '', 'dark');
  await lauf(browser, GERAETE[0], '&onlineStil=b'); // alte Kennung: schaltet nichts mehr um
  for (const fall of OHNE) await ohneElo(browser, fall);
  for (const fall of GEGNER_OHNE) await gegnerOhneElo(browser, fall);
  await ohneMehr(browser, ['kronen_mein_stand 500', { standKaputt: true }, SITZUNG]);
  await ohneMehr(browser, ['ohne Konto', {}, null]);
} finally {
  if (browser) await browser.close().catch(() => {});
  server.close();
}
pruefe('keine Seitenfehler', seitenfehler.length === 0, seitenfehler);
console.log(`\n${ok}/${gesamt} Pruefungen bestanden`);
process.exit(ok === gesamt ? 0 : 1);
