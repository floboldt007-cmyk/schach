// Online Arena (Feinschliff R27, Flo 21.11.2026, O1 aus dem R27-Plan; Bilder R19-Auswahl/online-r27): die Lobby als
// Schmuck-Arena (js/ui/online.js start/zeigeLiga/zeigeHeld/zeigeLetzte/zeigeRang, css/online.css "R27 Online Arena",
// Bauteile .juwel-* in css/premium.css). Geprueft:
//   (a) Kopfkarte: Elo gross, Zeile mit Stufe und Platz; ohne Server-Elo die Liga als Wort (auch r19-online-ruhig)
//   (b) Form "Letzte 5" nur mit beendeten gewerteten Partien, sonst fehlt sie ganz (kein Platzhalter)
//   (c) Weltrangliste nur quer ab 1100 px UND mit Antwort von weltrang_liste: Podest der ersten drei, dein Platz hervorgehoben
//   (d) "Partie suchen" ist der groesste Knopf und der EINZIGE goldene; nur EINE Krone auf der Seite (Flo: "Doppelkrone stoert")
//   (e) jeder Knopf der Lobby und des Blatts "Letzte Partien" mindestens 44 px hoch
//   (g) "Letzte Partien": Tipp auf die Form oeffnet das Blatt (Ergebnis, Gegnername aus karte_der_partie, Datum); der Name
//       oeffnet die Visitenkarte; "Analysieren" oeffnet die Partie und springt in die vorhandene Analyse mit den Zuegen
//   (h) Tipp auf einen Platz der Weltrangliste oeffnet die Visitenkarte
// Netz nur simuliert (Attrappe wie tests/bilder-online.mjs). Kontraste misst design-beweis getrennt.
//
//   node tests/r27-online-arena.test.mjs
//   PORT=8977 node tests/r27-online-arena.test.mjs
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
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
  gesamt++;
  if (gut) { ok++; console.log('OK ' + name); } else console.log('FEHLER ' + name + (detail === '' ? '' : ' ' + JSON.stringify(detail)));
}
const seitenfehler = [];

// ---- Server-Attrappe ----
const UID = 'u1';
const token = (uid) => 'a.' + Buffer.from(JSON.stringify({ sub: uid })).toString('base64url') + '.x';
const SITZUNG = { access_token: token(UID), refresh_token: 'test-r', expires_at: 9999999999, user: { id: UID, email: 'u1@example.invalid' } };
const NAMEN = { u1: 'Mira', u2: 'Jonas', u3: 'Lena' };
const ELO = 1240;
const iso = (ms) => new Date(ms).toISOString();
// fuenf beendete gewertete Partien, neueste zuerst: S (gegen Jonas), R, S, N (gegen Lena), S; dazu eine ungewertete
function altePartien() {
  const m = new Map();
  [['1-0', 'u1', 'u2'], ['1/2-1/2', 'u1', 'u2'], ['0-1', 'u2', 'u1'], ['1-0', 'u3', 'u1'], ['1-0', 'u1', 'u2']].forEach(([ergebnis, weiss, schwarz], i) => {
    const am = iso(Date.now() - (i + 1) * 3600e3);
    m.set('alt-' + i, { id: 'alt-' + i, code: null, weiss, schwarz, gewertet: true, status: 'beendet', ergebnis, grund: 'aufgabe',
      zuege: 'e2e4 e7e5 g1f3 b8c6', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', am_zug: 'w',
      bedenkzeit_s: 300, inkrement_s: 3, erstellt_am: am, aktualisiert_am: am, letzter_zug_am: am });
  });
  m.set('frei-0', { ...m.get('alt-0'), id: 'frei-0', gewertet: false });
  return m;
}
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
    const rpc = (url.pathname.match(/\/rest\/v1\/rpc\/([a-z_]+)/) || [])[1];
    if (!rpc) return antwort([]);
    const p = z.partien.get(body.partie);
    if (rpc === 'online_meine') return antwort([]);
    if (rpc === 'karte_der_partie') {
      // Lena (u3) schickt Erfinder-Werte: das Blatt "Letzte Partien" zeigt sie als Standard (Review 6e zu #271, Befund 3)
      const karte = (u) => ({ name: NAMEN[u], banner: 'saison-silber', titel: null, vitrine: [], motiv: u === 'u3' ? 'K' : 'Q', grund: 'standard',
        rahmen: u === 'u3' ? 'erfinder-blatt-0' : 'ohne', kronen_stufe: 7,
        elo: u === UID ? ELO : 1310, du: u === UID });
      return antwort(p ? { w: karte(p.weiss), s: karte(p.schwarz) } : {});
    }
    if (rpc === 'saison_mein_stand') return antwort({ saison: 1, start: '2026-11-02', wochen: 6, woche: 3, ende: new Date(Date.now() + 4 * 864e5).toISOString().slice(0, 10),
      abzeichen: [], titel: [], gewaehlt: null, sichtbar: true });
    if (rpc === 'weltrang_liste') {
      if (!z.welt) return antwort({ message: 'fehlt' }, 404);
      const namen = ['Lena', 'Mats', 'Sophie', 'Jonas', 'Ella', 'Tom', 'Mia', 'Ben', 'Lina', 'Paul'];
      const liste = Array.from({ length: 50 }, (_, i) => ({ rang: i + 1, name: i === 40 ? NAMEN[UID] : namen[i % namen.length],
        elo: i === 40 ? ELO : 1980 - i * 18 - (i > 40 ? 20 : 0), banner: 'start', ich: i === 40,
        // mit supabase/weltrang-karte-schema.sql (Vorschlag): das Profilbild; ein kaputter Wert faellt in profilAvatar zurueck
        // Platz 3 schickt Erfinder-Werte (Koenig, Erfinder-Rahmen), die ein fremder Spieler nie zeigen darf -> Standard
        ...(z.bild ? { motiv: i === 1 ? '<img src=x onerror=alert(1)>' : i === 2 ? 'K' : 'karo', grund: 'standard', rahmen: i === 2 ? 'erfinder-blatt-0' : 'ohne' } : {}) }));
      return antwort({ ab: 15, ab_start: 30, teilnahme: true, ich: { status: 'dabei', rang: 41, elo: ELO, name: NAMEN[UID], banner: 'start' }, liste });
    }
    if (rpc === 'kronen_mein_stand') return antwort({ stufe: 7, kronen: 140, platz: 3, ziel: 120, n: 30, woche: '2026-11-09', ...(z.ohneElo ? {} : { elo: ELO }) });
    return antwort(rpc === 'karte_melde_stufen' ? {} : []);
  };
}
function initSkript({ sitzung }) {
  try {
    if (!sessionStorage.getItem('arena-start')) {
      sessionStorage.setItem('arena-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ haltenAufgeben: false, duellIntro: 'aus' }));
    }
  } catch (e) { /* egal */ }
}
const sichtbar = (s, sel, ms = 15000) => s.waitForFunction((sel) => [...document.querySelectorAll(sel)].some((e) => !e.hidden && e.getClientRects().length > 0), sel, { timeout: ms })
  .then(() => true).catch(() => false);
async function seite(browser, [w, h], z, gruppe) {
  const k = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, serviceWorkers: 'block',
    colorScheme: 'dark', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  await k.route('**/*.supabase.co/**', bediener(z));
  await k.addInitScript(initSkript, { sitzung: SITZUNG });
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  s.on('pageerror', (e) => seitenfehler.push(`${gruppe}: ${e.message}`));
  await s.goto(`http://127.0.0.1:${PORT}/index.html?test#online`);
  pruefe(`${gruppe}: Lobby mit Suchknopf`, await sichtbar(s, '[data-online="suchen"]:not([disabled])', 30000));
  await s.waitForFunction(() => !document.querySelector('.on-liga[data-laedt]'), null, { timeout: 10000 }).catch(() => {});
  await warte(700);
  return { k, s };
}
const lobby = (s) => s.evaluate(() => {
  const sicht = (e) => !!e && e.checkVisibility();
  const knoepfe = [...document.querySelectorAll('.online-screen .on-inhalt button')].filter(sicht).map((b) => {
    const r = b.getBoundingClientRect();
    return { a: b.dataset.online || b.className, h: Math.round(r.height), f: Math.round(r.width * r.height), knopf: b.classList.contains('knopf'), gold: b.matches('.juwel-knopf[data-ton="gold"]') };
  });
  return {
    elo: document.querySelector('.on-held .on-gross-wert')?.textContent.trim() ?? null,
    zeile: document.querySelector('.on-held-zeile')?.textContent.replace(/\s+/g, ' ').trim() ?? '',
    form: sicht(document.querySelector('.on-held .on-form')) ? [...document.querySelectorAll('.on-form .juwel-stein')].map((x) => x.dataset.erg).join('') : null,
    formLabel: document.querySelector('.on-held .on-form')?.getAttribute('aria-label') ?? null,
    rang: sicht(document.querySelector('.on-rang')) ? {
      podest: [...document.querySelectorAll('.on-podest-platz')].map((b) => b.dataset.platz).join(','),
      ich: document.querySelector('.on-rang .ich')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
      koepfe: document.querySelectorAll('.on-rang .juwel-kopf').length,
      bilder: [...document.querySelectorAll('.on-rang .juwel-kopf')].filter((k) => k.querySelector('svg')).length,
      img: document.querySelectorAll('.on-rang img[src="x"], .on-rang [onerror]').length,
      erfinder: /wK\.svg|erfinder/.test(document.querySelector('.on-rang')?.innerHTML || '') } : null,
    kronen: [...document.querySelectorAll('.online-screen .on-inhalt svg.kj-liga')].filter(sicht).length,
    knoepfe,
  };
});

async function voll(browser, [geraet, w, h], bild = false) {
  const gruppe = `${geraet} voll${bild ? ' mit Profilbildern' : ''}`;
  const z = { partien: altePartien(), welt: true, bild };
  const { k, s } = await seite(browser, [w, h], z, gruppe);
  try {
    const l = await lobby(s);
    pruefe(`${gruppe}: (a) Elo gross, Zeile mit Stufe, Platz und Season`, l.elo === String(ELO) && /Warden II/.test(l.zeile) && /Platz 3 von 30/.test(l.zeile)
      && /Season noch 4 Tage/.test(l.zeile), l);
    pruefe(`${gruppe}: (b) Form der gewerteten Partien, aelteste links (S N S R S)`, l.form === 'snsrs' && /3 Siege, 1 Niederlagen, 1 Remis/.test(l.formLabel || ''), l);
    const quer = w >= 1100 && w > h;
    pruefe(`${gruppe}: (c) Weltrangliste ${quer ? 'da: Podest 2,1,3, dein Platz hervorgehoben, Koepfe' : 'nicht da (schmal/hoch)'}`,
      quer ? !!l.rang && l.rang.podest === '2,1,3' && /^41\s*Du\s*1240$/.test(l.rang.ich || '') && l.rang.koepfe === 6 : l.rang === null, l.rang);
    // ohne Profilbild vom Server: nur dein Kopf zeigt ein Bild, die anderen Banner und Anfangsbuchstabe; mit: alle sechs, ohne Fremd-HTML
    if (quer) pruefe(`${gruppe}: (c) Koepfe ${bild ? 'mit Profilbild vom Server, kaputter Wert ohne Fremd-HTML' : 'ohne Server-Profilbild: Banner und Buchstabe'}`,
      bild ? l.rang.bilder === 6 && l.rang.img === 0 && !l.rang.erfinder : l.rang.bilder === 1, l.rang);
    const gold = l.knoepfe.filter((b) => b.gold).map((b) => b.a);
    const groesster = l.knoepfe.filter((b) => b.knopf).sort((a, b) => b.f - a.f)[0];
    pruefe(`${gruppe}: (d) genau ein goldener Knopf (Partie suchen), er ist der groesste Knopf`, gold.length === 1 && gold[0] === 'suchen'
      && groesster?.a === 'suchen', { gold, groesster });
    pruefe(`${gruppe}: (d) genau EINE Krone auf der Seite (Medaille)`, l.kronen === 1, l.kronen);
    const klein = l.knoepfe.filter((b) => b.h < 44);
    pruefe(`${gruppe}: (e) jeder Knopf der Lobby mindestens 44 px hoch`, klein.length === 0, klein);

    // (g) Letzte Partien (Flo 21.11.: Eingang nicht gefunden -> sichtbarer Hinweis, die Pillen selbst sind antippbar)
    const alle = await s.evaluate(() => { const e = document.querySelector('.on-form .on-form-alle'); return e && e.checkVisibility() ? e.textContent.trim() : null; });
    pruefe(`${gruppe}: (g) Hinweis "Alle ansehen" an der Form sichtbar`, alle === 'Alle ansehen', alle);
    await s.locator('.on-form .juwel-stein').nth(2).click();
    pruefe(`${gruppe}: (g) Tipp auf eine Pille oeffnet "Letzte Partien"`, await sichtbar(s, '.on-letzte-blatt .on-letzte-zeile'));
    await s.waitForFunction(() => [...document.querySelectorAll('.on-letzte-name')].every((b) => b.textContent.trim() !== 'Gegner'), null, { timeout: 8000 }).catch(() => {});
    // das Blatt faehrt mit einer leichten Skalierung ein: erst nach dem Einfahren messen (sonst 43,x statt 44 px)
    await s.waitForFunction(() => document.getAnimations().every((x) => x.playState !== 'running'), null, { timeout: 5000 }).catch(() => {});
    const blatt = await s.evaluate(() => ({
      zeilen: [...document.querySelectorAll('.on-letzte-zeile')].map((z) => ({ erg: z.querySelector('.juwel-stein')?.dataset.erg,
        name: z.querySelector('.on-letzte-name')?.textContent.trim(), datum: z.querySelector('.on-letzte-datum')?.textContent.trim() })),
      klein: [...document.querySelectorAll('.on-letzte-blatt button')].filter((b) => b.checkVisibility() && !b.classList.contains('on-letzte-name')
        && b.getBoundingClientRect().height < 44).map((b) => `${b.className} ${b.getBoundingClientRect().height}`),
      namenKlein: [...document.querySelectorAll('.on-letzte-name')].filter((b) => b.getBoundingClientRect().height < 24).length,
      koepfe: document.querySelectorAll('.on-letzte-kopf[data-da] svg').length,
      erfinder: /wK\.svg|erfinder/.test(document.querySelector('.on-letzte')?.innerHTML || '') }));
    pruefe(`${gruppe}: (g) fremde Erfinder-Werte (Koenig, Erfinder-Rahmen) erscheinen als Standard`, blatt.erfinder === false, blatt.erfinder);
    pruefe(`${gruppe}: (g) neben jedem Namen der Avatar des Gegners`, blatt.koepfe === 5, blatt.koepfe);
    pruefe(`${gruppe}: (g) fuenf Zeilen, neueste zuerst, Gegner aus karte_der_partie, Datum, nur gewertete`,
      blatt.zeilen.map((z) => z.erg).join('') === 'srsns' && blatt.zeilen.map((z) => z.name).join() === 'Jonas,Jonas,Jonas,Lena,Jonas'
      && blatt.zeilen.every((z) => /\d/.test(z.datum || '')), blatt.zeilen);
    pruefe(`${gruppe}: (e) Knoepfe im Blatt mindestens 44 px, Namen mindestens 24 px`, blatt.klein.length === 0 && blatt.namenKlein === 0, blatt);
    await s.locator('.on-letzte-name').nth(3).click();
    pruefe(`${gruppe}: (g) Tipp auf den Namen zeigt die Visitenkarte von Lena`, await sichtbar(s, '.gegner-profil .vk')
      && /Lena/.test(await s.locator('.gegner-profil').textContent()));
    await s.locator('.gegner-profil [data-knopf="zurueck"]').click();
    await warte(500);
    await s.locator('.on-held .on-form').click();
    await sichtbar(s, '.on-letzte-blatt .on-letzte-zeile');
    await s.locator('.on-letzte-zeile [data-letzte="analyse"]').first().click();
    const analyse = await s.waitForFunction(() => document.querySelector('.an-screen')?.checkVisibility(), null, { timeout: 20000 }).then(() => true).catch(() => false);
    const gespeichert = await s.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const v = localStorage.getItem(localStorage.key(i)) || '';
        if (v.includes('"on-alt-0"')) { try { const d = JSON.parse(v); const p = (Array.isArray(d) ? d : Object.values(d)).flat().find((x) => x && x.id === 'on-alt-0'); if (p) return { zuege: p.zuege, namen: p.zuzweit, ergebnis: p.ergebnis }; } catch (e) { return 'kaputt'; } }
      }
      return null;
    });
    pruefe(`${gruppe}: (g) "Analysieren" oeffnet die vorhandene Analyse mit den Zuegen der Partie`, analyse && !!gespeichert && Array.isArray(gespeichert.zuege)
      && gespeichert.zuege.join(' ') === 'e2e4 e7e5 g1f3 b8c6' && gespeichert.namen?.weiss === 'Mira' && gespeichert.namen?.schwarz === 'Jonas', { analyse, gespeichert, hash: await s.evaluate(() => location.hash) });

    // (h) Weltrangliste: Tipp oeffnet die Visitenkarte
    if (quer) {
      await s.evaluate(() => window.__app.gehe('online'));
      await sichtbar(s, '.on-podest-platz', 20000);
      await s.locator('.on-podest-platz[data-platz="1"]').click();
      pruefe(`${gruppe}: (h) Tipp auf Platz 1 zeigt die Visitenkarte von Lena`, await sichtbar(s, '.gegner-profil .vk') && /Lena/.test(await s.locator('.gegner-profil').textContent()));
    }
  } catch (e) {
    pruefe(`${gruppe}: Ablauf ohne Abbruch`, false, e.message.split('\n')[0]);
  }
  await k.close().catch(() => {});
}

// (b)(c) ohne beendete Partien und ohne Weltrangliste: Form und Rang fehlen ganz; (a) ohne Server-Elo die Liga als Wort
async function leer(browser, [geraet, w, h], ohneElo) {
  const gruppe = `${geraet} ohne Partien und Rangliste${ohneElo ? ', ohne Elo' : ''}`;
  const { k, s } = await seite(browser, [w, h], { partien: new Map(), welt: false, ohneElo }, gruppe);
  try {
    const l = await lobby(s);
    pruefe(`${gruppe}: (b) keine Form, kein Platzhalter`, l.form === null, l.form);
    pruefe(`${gruppe}: (c) keine Weltrangliste`, l.rang === null, l.rang);
    if (ohneElo) pruefe(`${gruppe}: (a) gross die Liga als Wort, keine leere Zahl`, l.elo === 'Warden II' && !/undefined|null|NaN/.test(l.zeile), l);
  } catch (e) {
    pruefe(`${gruppe}: Ablauf ohne Abbruch`, false, e.message.split('\n')[0]);
  }
  await k.close().catch(() => {});
}

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });
  for (const g of [['iPhone 13', 390, 844], ['iPhone SE', 375, 667], ['iPad quer', 1180, 820], ['PC', 1280, 720]]) await voll(browser, g);
  await voll(browser, ['PC', 1280, 720], true);
  await leer(browser, ['PC', 1280, 720], false);
  await leer(browser, ['iPhone 13', 390, 844], true);
} finally {
  if (browser) await browser.close().catch(() => {});
  server.close();
}
pruefe('keine Seitenfehler', seitenfehler.length === 0, seitenfehler);
console.log(`\n${ok}/${gesamt} Pruefungen bestanden`);
process.exit(ok === gesamt ? 0 : 1);
