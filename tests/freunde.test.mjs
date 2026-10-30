// Freunde (js/freunde.js): Anfragen an die Funktionen aus supabase/freunde-schema.sql mit abgefangenem fetch, Link und
// Code. Die Rechte und Regeln auf dem Server prueft supabase/freunde-rls-test.sql (im Supabase SQL Editor).
//   node tests/freunde.test.mjs            Node-Teil und Browser (Reiter Freunde der Bestenliste, Server abgefangen)
//   node tests/freunde.test.mjs --nur-node
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';
import { setzeSpeicher } from '../js/storage.js';
import { NAME, meldeWochenpunkte, ladeRangliste, ladeFreunde, frageAn, antworte, entferne, einladung, nutzeEinladung, einladungsLink, codeAusLink,
  uebernimmLink, gemerkterCode, vergissCode, setzeFreundeFetch, CODE_SCHLUESSEL } from '../js/freunde.js';
import { SUPABASE_URL } from '../js/konto-config.js';

let ok = 0, gesamt = 0;
function pruefe(name, wert, extra = '') { gesamt++; if (wert) ok++; else console.error('FEHLER ' + name, extra); }
const m = new Map();
globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
  key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; }, clear() { m.clear(); } };
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Test' }, configurable: true });
setzeSpeicher(globalThis.localStorage);

const antworten = []; const calls = [];
setzeFreundeFetch(async (url, opt) => {
  calls.push({ url, ...opt });
  const x = antworten.shift();
  if (x === 'offline') throw new TypeError('Failed to fetch');
  const a = x || { status: 200, body: {} };
  return { ok: a.status < 400, status: a.status, async json() { return a.body; } };
});
const fehlerVon = async (f) => { try { await f(); return null; } catch (e) { return e.grund; } };
const CODE = '0123456789abcdef';

pruefe('ohne Anmeldung: abgemeldet, keine Anfrage', await fehlerVon(() => ladeFreunde()) === 'abgemeldet' && calls.length === 0);
const sitzung = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: 'u1' })).toString('base64url') + '.x', refresh_token: 'r', expires_at: 9999999999,
  user: { id: 'u1', email: 'probe@example.invalid' } };
localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));

antworten.push({ status: 200, body: [{ id: 'b', name: 'lena_spielt', status: 'freunde', seit: '2026-10-30T10:00:00Z' },
  { id: 'c', name: 'Max', status: 'eingehend' }, { id: 'x', name: 'kaputt', status: 'abgelehnt' }, null, { name: 'ohneId', status: 'freunde' }] });
const liste = await ladeFreunde();
const c0 = calls.at(-1);
pruefe('freunde(): POST an rpc/freunde mit Anmeldung', c0.url === SUPABASE_URL + '/rest/v1/rpc/freunde' && c0.method === 'POST'
  && c0.headers.Authorization === 'Bearer ' + sitzung.access_token && !!c0.headers.apikey, c0);
pruefe('freunde(): nur gueltige Zeilen, Status freunde/eingehend/ausgehend', liste.length === 2 && liste[0].name === 'lena_spielt'
  && liste[1].status === 'eingehend' && liste[1].seit === null, liste);

pruefe('Name ungueltig: ohne Anfrage', await frageAn('a') === 'ungueltig' && await frageAn('lena spielt') === 'ungueltig' && await frageAn('Jürgen') === 'ungueltig'
  && calls.length === 1);
antworten.push({ status: 200, body: { ergebnis: 'gesendet' } });
pruefe('frageAn: gesendet, Name getrimmt', await frageAn('  lena_spielt ') === 'gesendet' && JSON.parse(calls.at(-1).body).name === 'lena_spielt'
  && calls.at(-1).url.endsWith('/rpc/freund_anfragen'));
for (const e of ['freunde', 'schon', 'unbekannt', 'selbst', 'kein_name', 'grenze']) {
  antworten.push({ status: 200, body: { ergebnis: e } });
  pruefe('frageAn: ' + e, await frageAn('Max') === e);
}
antworten.push({ status: 200, body: { ergebnis: 'freunde' } });
pruefe('antworte: annehmen', await antworte('c', 1) === 'freunde' && JSON.stringify(JSON.parse(calls.at(-1).body)) === '{"anderer":"c","annehmen":true}'
  && calls.at(-1).url.endsWith('/rpc/freund_antworten'));
antworten.push({ status: 200, body: { ergebnis: 'abgelehnt' } });
pruefe('antworte: ablehnen', await antworte('c', false) === 'abgelehnt' && JSON.parse(calls.at(-1).body).annehmen === false);
antworten.push({ status: 200, body: { ergebnis: 'entfernt' } });
pruefe('entferne', await entferne('b') === 'entfernt' && calls.at(-1).url.endsWith('/rpc/freund_entfernen') && JSON.parse(calls.at(-1).body).anderer === 'b');
antworten.push({ status: 200, body: null });
pruefe('kaputte Antwort: unbekannt', await entferne('b') === 'unbekannt');

antworten.push({ status: 200, body: { code: CODE, gueltig_bis: '2026-11-06T10:00:00Z' } });
const ein = await einladung('https://floboldt007-cmyk.github.io/schach/?sprache=en#bestenliste');
pruefe('einladung: Code und Link', ein.code === CODE && ein.link === `https://floboldt007-cmyk.github.io/schach/#freund/${CODE}`, ein);
antworten.push({ status: 200, body: { ergebnis: 'kein_name' } });
pruefe('einladung ohne Namen', (await einladung()).ergebnis === 'kein_name');
antworten.push({ status: 200, body: { ergebnis: 'freunde', name: 'lena_spielt' } });
const n = await nutzeEinladung(`https://x.example/#freund/${CODE.toUpperCase()}`);
pruefe('nutzeEinladung: aus dem Link, Name', n.ergebnis === 'freunde' && n.name === 'lena_spielt' && JSON.parse(calls.at(-1).body).code === CODE, n);
const vorher = calls.length;
pruefe('nutzeEinladung: Unsinn ohne Anfrage', (await nutzeEinladung('#freund/zzz')).ergebnis === 'ungueltig' && calls.length === vorher);

pruefe('Link: Adresse ohne Hash und Suche', einladungsLink(CODE, 'https://a.b/schach/index.html?x=1#arena') === `https://a.b/schach/index.html#freund/${CODE}`);
pruefe('Link: ohne Browser die feste Adresse', einladungsLink(CODE) === `https://floboldt007-cmyk.github.io/schach/#freund/${CODE}`);
pruefe('Link: falscher Code wirft', await fehlerVon(() => einladungsLink('abc')) === 'ungueltig');
pruefe('codeAusLink', codeAusLink(`#freund/${CODE}`) === CODE && codeAusLink(CODE) === CODE && codeAusLink(`#freund/${CODE}x`) === null
  && codeAusLink('#online/ABC234') === null && codeAusLink('') === null);
pruefe('uebernimmLink merkt den Code', uebernimmLink({ hash: `#freund/${CODE}` }) === CODE && gemerkterCode() === CODE && localStorage.getItem(CODE_SCHLUESSEL) === CODE);
vergissCode();
pruefe('vergissCode', gemerkterCode() === null && uebernimmLink({ hash: '#arena' }) === null);

antworten.push({ status: 200, body: { ergebnis: 'ok' } });
pruefe('meldeWochenpunkte', await meldeWochenpunkte({ woche: '2026-10-26', punkte: 280, partien: 9 }) === 'ok'
  && JSON.stringify(JSON.parse(calls.at(-1).body)) === '{"woche":"2026-10-26","punkte":280,"partien":9}' && calls.at(-1).url.endsWith('/rpc/wochenpunkte_melden'));
const vorM = calls.length;
pruefe('meldeWochenpunkte: Unsinn ohne Anfrage', await meldeWochenpunkte({ woche: '26.10.', punkte: 1, partien: 1 }) === 'ungueltig'
  && await meldeWochenpunkte({ woche: '2026-10-26', punkte: -1, partien: 1 }) === 'ungueltig' && await meldeWochenpunkte({ woche: '2026-10-26', punkte: 1.5, partien: 1 }) === 'ungueltig'
  && calls.length === vorM);
antworten.push({ status: 200, body: [{ id: 'b', name: 'lena_spielt', punkte: 340, partien: 12, ich: false }, { id: 'a', name: null, punkte: '280', partien: 9, ich: true }, { name: 'x' }] });
const rl = await ladeRangliste('monat');
pruefe('ladeRangliste: Fenster, Zahlen, ich', JSON.parse(calls.at(-1).body).fenster === 'monat' && rl.length === 2 && rl[1].punkte === 280 && rl[1].ich === true
  && rl[1].name === null, rl);
antworten.push({ status: 200, body: [] });
await ladeRangliste('quatsch');
pruefe('ladeRangliste: unbekanntes Fenster wird Woche', JSON.parse(calls.at(-1).body).fenster === 'woche');

antworten.push('offline');
pruefe('offline', await fehlerVon(() => ladeFreunde()) === 'offline');
antworten.push({ status: 401, body: {} });
pruefe('401: abgemeldet', await fehlerVon(() => ladeFreunde()) === 'abgemeldet');
antworten.push({ status: 500, body: { message: 'intern' } });
pruefe('500: server, kein Rohtext', await fehlerVon(() => frageAn('Max')) === 'server');
pruefe('NAME wie im Schema', NAME.test('Flo_2026') && !NAME.test('ab') && !NAME.test('a'.repeat(21)));
pruefe('keine E-Mail in Anfragen', !calls.some((c) => String(c.body || '').includes('@')));

// ---------------------------------------------------------------------------
// Browser: Reiter Freunde der Bestenliste mit abgefangenem Supabase
// ---------------------------------------------------------------------------
const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8931);
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const SUPA = 'https://usaamcqypmvgqmsbfecb.supabase.co';
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden');
}
const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const SITZUNG_B = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'r1', expires_at: 9999999999,
  user: { id: UID, email: 'probe@example.invalid' } };

async function seiteMit(browser, { sitzung = null, server = {}, hash = '#bestenliste', vorher = {} } = {}) {
  const k = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', timezoneId: 'Europe/Berlin' });
  const s = await k.newPage();
  const srv = { profil: [{ user_id: UID, benutzername: 'Flo' }], liste: [{ id: 'b', name: 'lena_spielt', punkte: 340, partien: 12, ich: false },
    { id: UID, name: 'Flo', punkte: 280, partien: 9, ich: true }], freunde: [{ id: 'c', name: 'Max', status: 'eingehend' }], status: 200, ...server };
  const anfragen = [];
  const fehlerListe = [];
  s.on('pageerror', (e) => fehlerListe.push(e.message));
  await s.route(SUPA + '/**', async (r) => {
    const u = r.request().url();
    const body = r.request().postData();
    anfragen.push({ url: u, body });
    if (srv.status !== 200 && u.includes('/rpc/')) return r.fulfill({ status: srv.status, contentType: 'application/json', body: '{"message":"x"}' });
    const antwort = u.includes('/rest/v1/profile') ? srv.profil
      : u.includes('/rpc/freunde_rangliste') ? srv.liste
      : u.includes('/rpc/freunde') ? srv.freunde
      : u.includes('/rpc/freund_anfragen') ? { ergebnis: 'gesendet' }
      : u.includes('/rpc/freund_antworten') ? { ergebnis: JSON.parse(body || '{}').annehmen ? 'freunde' : 'abgelehnt' }
      : u.includes('/rpc/freund_einladung_nutzen') ? { ergebnis: 'freunde', name: 'lena_spielt' }
      : u.includes('/rpc/freund_einladung') ? { code: 'abcdef0123456789', gueltig_bis: '2026-11-06T10:00:00Z' }
      : u.includes('/rpc/wochenpunkte_melden') ? { ergebnis: 'ok' } : {};
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(antwort) });
  });
  await s.addInitScript(({ sitzung, vorher }) => {
    try {
      if (sessionStorage.getItem('probe-start')) return;
      sessionStorage.setItem('probe-start', '1');
      localStorage.clear();
      if (sitzung) localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
      for (const [k, v] of Object.entries(vorher)) localStorage.setItem(k, v);
    } catch (e) { /* egal */ }
  }, { sitzung, vorher });
  await s.goto(BASIS + hash);
  await s.waitForSelector('.bl-steuer', { timeout: 30000 });
  if (hash === '#bestenliste') await s.locator('.bl-steuer .seg[data-wert="freunde"]').click();
  await s.waitForSelector('.bl-fr', { timeout: 15000 });
  await warte(600);
  return { k, s, srv, anfragen, fehlerListe };
}

async function browserTeil() {
  const pw = ladePlaywright();
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
  let browser;
  try {
    for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/index.html`); if (r.ok) break; } catch (e) { /* noch nicht */ } await warte(150); }
    browser = await browserTyp(pw).launch();
    // abgemeldet: Satz, Weg zum Konto, Codes offen, keine Anfrage
    let p = await seiteMit(browser);
    let text = await p.s.locator('.bl-fr').innerText();
    pruefe('abgemeldet: Satz und „Zum Konto“, Codes offen, keine Server-Anfrage', /Mit einem Konto/.test(text) && /Zum Konto/.test(text)
      && await p.s.locator('details.bl-fr-codes[open]').count() === 1 && !p.anfragen.some((a) => a.url.includes('/rpc/'))
      && await p.s.locator('.bl-steuer-fenster').isHidden(), text);
    pruefe('abgemeldet: keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
    await p.k.close();

    // angemeldet mit Namen: Rangliste, du-Zeile, Anfragen-Hinweis, Wochenwertung gemeldet
    p = await seiteMit(browser, { sitzung: SITZUNG_B });
    await p.s.waitForSelector('.bl-fr-liste', { timeout: 15000 }).catch(() => {});
    const z = await p.s.evaluate(() => [...document.querySelectorAll('.bl-fr-zeile')].map((x) => ({ text: x.innerText.replace(/\s+/g, ' '), du: x.classList.contains('du'), av: !!x.querySelector('.bl-fr-av svg') })));
    pruefe('Rangliste: Lena vor dir, du-Zeile mit Profilbild, Punkte und Partien', z.length === 2 && /lena_spielt/.test(z[0].text) && /340/.test(z[0].text)
      && z[1].du && z[1].av && /Flo \(du\)/.test(z[1].text) && /9 gewertete Partien/.test(z[1].text), z);
    pruefe('Hinweis „Anfragen an dich: 1“, Codes zu, Zeitfenster sichtbar', /Anfragen an dich: 1/.test(await p.s.locator('.bl-fr').innerText())
      && await p.s.locator('details.bl-fr-codes[open]').count() === 0 && await p.s.locator('.bl-steuer-fenster').isVisible());
    const melden = p.anfragen.find((a) => a.url.includes('/rpc/wochenpunkte_melden'));
    const mb = melden && JSON.parse(melden.body);
    pruefe('Wochenwertung gemeldet: Montag dieser Woche, ganze Zahlen', !!mb && /^\d{4}-\d{2}-\d{2}$/.test(mb.woche) && new Date(mb.woche + 'T12:00:00Z').getUTCDay() === 1
      && Number.isInteger(mb.punkte) && Number.isInteger(mb.partien), mb);
    const rl = p.anfragen.find((a) => a.url.includes('/rpc/freunde_rangliste'));
    pruefe('Rangliste fuer das gewaehlte Fenster (Woche)', !!rl && JSON.parse(rl.body).fenster === 'woche');
    pruefe('Keine E-Mail in Anfragen an die Freunde-Funktionen', !p.anfragen.filter((a) => /rpc\/(freund|wochen)/.test(a.url)).some((a) => String(a.body || '').includes('@')));
    // Blatt: Anfrage schicken und Max annehmen
    await p.s.locator('.bl-fr-plus').click();
    await p.s.waitForSelector('.bl-fr-blatt .bl-fr-name-ein', { timeout: 5000 });
    await p.s.locator('.bl-fr-name-ein').fill('lena_spielt');
    await p.s.locator('.bl-fr-senden').click();
    await p.s.waitForFunction(() => /geschickt/.test(document.querySelector('.bl-fr-status')?.textContent || ''), null, { timeout: 5000 }).catch(() => {});
    const anfr = p.anfragen.find((a) => a.url.includes('/rpc/freund_anfragen'));
    pruefe('Blatt: Anfrage an lena_spielt geschickt', !!anfr && JSON.parse(anfr.body).name === 'lena_spielt'
      && /Anfrage an lena_spielt geschickt/.test(await p.s.locator('.bl-fr-status').innerText()));
    await p.s.waitForSelector('.bl-fr-anfragen [data-aktion="annehmen"]', { timeout: 5000 }).catch(() => {});
    await p.s.locator('.bl-fr-anfragen [data-aktion="annehmen"]').first().click();
    await p.s.waitForFunction(() => /Angenommen/.test(document.querySelector('.bl-fr-status')?.textContent || ''), null, { timeout: 5000 }).catch(() => {});
    const antw = p.anfragen.find((a) => a.url.includes('/rpc/freund_antworten'));
    pruefe('Blatt: Max angenommen', !!antw && JSON.parse(antw.body).anderer === 'c' && JSON.parse(antw.body).annehmen === true);
    await p.s.locator('.bl-fr-link').click();
    await p.s.waitForFunction(() => /7 Tage/.test(document.querySelector('.bl-fr-status')?.textContent || ''), null, { timeout: 5000 }).catch(() => {});
    const linkWert = await p.s.locator('.bl-fr-link-feld').inputValue().catch(() => '');
    pruefe('Blatt: Einladungslink mit #freund/<code>', /#freund\/abcdef0123456789$/.test(linkWert) || /7 Tage/.test(await p.s.locator('.bl-fr-status').innerText()), linkWert);
    pruefe('Blatt passt aufs Handy', await p.s.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    pruefe('angemeldet: keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
    await p.k.close();

    // Freundes-Link: die App merkt den Code, zeigt den Reiter Freunde und fragt einmal
    p = await seiteMit(browser, { sitzung: SITZUNG_B, hash: '#freund/abcdef0123456789' });
    await p.s.waitForSelector('.sheet-karte', { timeout: 10000 }).catch(() => {});
    pruefe('Link: Frage „Einladung annehmen?“', /Einladung annehmen/.test(await p.s.locator('.sheet-karte').innerText().catch(() => '')));
    await p.s.locator('.sheet-knoepfe button', { hasText: 'Annehmen' }).click();
    await p.s.waitForFunction(() => [...document.querySelectorAll('.toast, [role="status"]')].some((x) => /lena_spielt/.test(x.textContent)), null, { timeout: 5000 }).catch(() => {});
    const nutz = p.anfragen.find((a) => a.url.includes('/rpc/freund_einladung_nutzen'));
    pruefe('Link: Einladung mit dem Code eingeloest, Code vergessen', !!nutz && JSON.parse(nutz.body).code === 'abcdef0123456789'
      && await p.s.evaluate(() => localStorage.getItem('schach-arena:konto:freund-einladung')) === null);
    await p.k.close();

    // ohne Benutzername: Name waehlen; Server nicht erreichbar: ruhiger Satz
    p = await seiteMit(browser, { sitzung: SITZUNG_B, server: { profil: [] } });
    await p.s.waitForSelector('.bl-fr-eigen', { timeout: 10000 }).catch(() => {});
    pruefe('ohne Benutzername: Feld und „Namen speichern“', await p.s.locator('.bl-fr-eigen').count() === 1 && /Benutzernamen/.test(await p.s.locator('.bl-fr').innerText()));
    await p.k.close();
    p = await seiteMit(browser, { sitzung: SITZUNG_B, server: { status: 404 } });
    await p.s.waitForFunction(() => /nicht erreichbar/.test(document.querySelector('.bl-fr')?.textContent || ''), null, { timeout: 10000 }).catch(() => {});
    pruefe('Server ohne Freunde-Funktionen (404): ruhiger Satz, keine Seitenfehler', /nicht erreichbar/.test(await p.s.locator('.bl-fr').innerText()) && p.fehlerListe.length === 0,
      await p.s.locator('.bl-fr').innerText());
    await p.k.close();
  } catch (e) {
    pruefe('Browser-Teil laeuft durch', false, e.message);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}
if (!process.argv.includes('--nur-node')) await browserTeil();

console.log(`${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
