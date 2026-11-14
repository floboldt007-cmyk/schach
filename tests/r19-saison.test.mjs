// R19 Season, App-Seite (Plan docs/superpowers/plans/2026-11-14-saison.md, K2). Was der Server rechnet, prueft
// tests/server-saison.test.mjs; hier geht es um das, was die App daraus zeigt:
//   1. ohne Browser: Abzeichen- und Titeltext de/en, karteVomServer nimmt nur gueltige Season-Werte, karteDerPartie haengt
//      die Season an beide Karten (und ohne Season-SQL bleibt die Karte wie bisher), Datenschutz DE/EN nennt die Season
//   2. im Browser (Server nachgebildet): die Leiste im Profil "Ich", die Titelwahl, das Blatt am Season-Ende genau einmal,
//      und bei Fehlern oder ohne Konto keine Leiste und keine Platzhalterzahlen
//   PORT=9631 node tests/r19-saison.test.mjs   eigener Port (Standard: frei)
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + (typeof detail === 'string' ? detail : JSON.stringify(detail))}`);
}

// ---------- 1. ohne Browser ----------
const speicher = new Map();
const lager = { getItem: (k) => (speicher.has(k) ? speicher.get(k) : null), setItem: (k, v) => speicher.set(k, String(v)),
  removeItem: (k) => speicher.delete(k), key: (i) => [...speicher.keys()][i] ?? null, get length() { return speicher.size; } };
globalThis.localStorage = lager;
const { setzeSpeicher } = await import('../js/storage.js');
setzeSpeicher(lager);
const { setzeSprache } = await import('../js/sprache.js');
const { setzeOnlineFetch } = await import('../js/online.js');
const V = await import('../js/ui/visitenkarte.js');
const K = await import('../js/karte.js');

const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const SITZUNG = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'r1',
  expires_at: 9999999999, user: { id: UID, email: 'probe@example.invalid' } };

for (const [sp, abz, cm, t10] of [['de', 'S1 · Crownmate I', 'Crownmaster Season 1', 'Top 10 Season 2'],
  ['en', 'S1 · Crownmate I', 'Crownmaster Season 1', 'Top 10 Season 2']]) {
  setzeSprache(sp);
  pruefe(`${sp}: Abzeichen S1 Stufe 17 heisst "${abz}"`, V.saisonText({ saison: 1, stufe: 17 }) === abz, V.saisonText({ saison: 1, stufe: 17 }));
  pruefe(`${sp}: Titel crownmaster-s1 und top10-s2`, V.saisonTitelText('crownmaster-s1') === cm && V.saisonTitelText('top10-s2') === t10,
    [V.saisonTitelText('crownmaster-s1'), V.saisonTitelText('top10-s2')]);
  const unsinn = [V.saisonText(null), V.saisonText({ saison: 0, stufe: 3 }), V.saisonText({ saison: 1, stufe: 18 }), V.saisonText({ saison: '1', stufe: 2 }),
    V.saisonTitelText('crownmaster-s0'), V.saisonTitelText('koenig-s1'), V.saisonTitelText('<b>-s1'), V.saisonTitelText(7)];
  pruefe(`${sp}: unpassende Season-Werte ergeben leeren Text`, unsinn.every((x) => x === ''), unsinn);
}
setzeSprache('de');

{
  const k = V.karteVomServer({ name: 'Mia', saison: { abzeichen: { saison: 2, stufe: 15 }, titel: 'top100-s1' } });
  pruefe('karteVomServer: gueltiges Abzeichen und Titel kommen durch', k.saison && k.saison.saison === 2 && k.saison.stufe === 15 && k.saisonTitel === 'top100-s1', k);
  const kaputt = [{ saison: { abzeichen: { saison: 2, stufe: 99 }, titel: 'top100-s1;drop' } }, { saison: 'x' }, {},
    { saison: { abzeichen: [1, 2], titel: { id: 'top10-s1' } } }].map((d) => V.karteVomServer(d));
  pruefe('karteVomServer: kaputte oder fehlende Season ergibt null', kaputt.every((x) => x.saison === null && x.saisonTitel === null), kaputt.map((x) => [x.saison, x.saisonTitel]));
}

{
  let antworten = {};
  setzeOnlineFetch(async (url) => {
    const name = (String(url).match(/\/rest\/v1\/rpc\/([a-z_]+)/) || [])[1];
    const d = antworten[name];
    if (d === undefined) return { ok: false, status: 404, json: async () => ({ message: 'Could not find the function' }) };
    return { ok: true, status: 200, json: async () => d };
  });
  speicher.set('schach-arena:konto:sitzung', JSON.stringify(SITZUNG));
  const karte = { w: { name: 'A', banner: 'start' }, s: { name: 'B', banner: 'start' } };
  antworten = { karte_der_partie: karte };
  const ohne = await K.karteDerPartie('p-1');
  pruefe('karteDerPartie ohne Season-SQL: Karte wie bisher, ohne saison', ohne && ohne.w.name === 'A' && !('saison' in ohne.w) && !('saison' in ohne.s), ohne);
  antworten = { karte_der_partie: karte, saison_karte_der_partie: { w: { abzeichen: { saison: 1, stufe: 17 }, titel: 'crownmaster-s1', du: true },
    s: { abzeichen: null, titel: null, du: false } } };
  const mit = await K.karteDerPartie('p-1');
  pruefe('karteDerPartie mit Season: beide Karten tragen saison { abzeichen, titel }', mit && mit.w.saison.abzeichen.stufe === 17
    && mit.w.saison.titel === 'crownmaster-s1' && mit.s.saison.abzeichen === null && mit.w.name === 'A', mit);
  const vk = V.karteVomServer(mit.w);
  pruefe('Season der Partie wird zur Karte: Abzeichen und Titel', vk.saison?.stufe === 17 && vk.saisonTitel === 'crownmaster-s1', vk);
  antworten = { saison_karte_der_partie: antworten.saison_karte_der_partie };
  pruefe('karteDerPartie: ohne Karte auch keine Season', (await K.karteDerPartie('p-1')) === null);
  speicher.delete('schach-arena:konto:sitzung');
}

for (const [datei, kopf, muss] of [
  ['datenschutz.html', '<h3>Seasons</h3>', ['8 Wochen', '4. Januar 2027', 'Crownmaster', 'Top 10', 'Top 100', 'mindestens 20 Online-Partien mit Kronen',
    'mindestens 4 Halbzügen, höchstens 3 je Gegner und Tag', 'um 3 Stufen', 'Eine Rangliste mit Namen', 'automatisch mitgelöscht', 'Meine Daten herunterladen']],
  ['datenschutz-en.html', '<h3>Seasons</h3>', ['8 weeks', '4 January 2027', 'Crownmaster', 'Top 10', 'Top 100', 'at least 20 online games with crowns',
    'at least 4 half-moves, at most 3 per opponent and day', 'by 3 tiers', 'We do not publish a ranking', 'deleted automatically', 'Download my data']],
]) {
  const html = readFileSync(path.join(WURZEL, datei), 'utf8');
  const i = html.indexOf(kopf);
  // Zeilenumbrueche im HTML zaehlen wie ein Leerzeichen
  const abschnitt = i < 0 ? '' : html.slice(i, html.indexOf('<h3>', i + kopf.length)).replace(/\s+/g, ' ');
  const fehlt = muss.filter((m) => !abschnitt.includes(m));
  pruefe(`${datei}: Abschnitt Seasons nennt Ablauf, Titel, Regel, Sichtbarkeit und Loeschen`, i > 0 && fehlt.length === 0, fehlt);
  const vk = html.slice(html.indexOf(datei === 'datenschutz.html' ? '<h3>Visitenkarte' : '<h3>Player card'), html.indexOf(datei === 'datenschutz.html' ? '<h3>Liga mit' : '<h3>League with'))
    .replace(/\s+/g, ' ');
  const drei = datei === 'datenschutz.html' ? ['Liga-Stufe mit ihrem Symbol', 'bestes Season-Abzeichen', 'Season-Titel, falls du einen ausgewählt hast']
    : ['league tier with its symbol', 'best season badge', 'a season title if you have chosen one'];
  const fehltVk = drei.filter((m) => !vk.includes(m));
  pruefe(`${datei}: Abschnitt Visitenkarte nennt Liga mit Symbol, bestes Abzeichen und gewaehlten Titel`, fehltVk.length === 0, fehltVk);
}

// ---------- 2. im Browser ----------
const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
const root = WURZEL + path.sep;
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + new URL(req.url, 'http://test').pathname.replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p)); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const SUPA = 'https://usaamcqypmvgqmsbfecb.supabase.co';

const LAUF = { saison: 2, start: '2027-03-01', woche: 3, wochen: 8, ende: '2027-04-25', bisher: 11, stufe: 14,
  abzeichen: [{ saison: 1, stufe: 17 }], titel: ['crownmaster-s1', 'top100-s1'], gewaehlt: null };

// stand: Antwort auf saison_mein_stand ('offline' bricht ab, { __status } ist eine Absage); konto: angemeldet
async function neueSeite(browser, { stand, konto = true, titelAbsage = false } = {}) {
  const kontext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const seite = await kontext.newPage();
  const fehler = [];
  const gesendet = [];
  seite.on('pageerror', (e) => fehler.push('pageerror: ' + e.message));
  seite.on('console', (m) => { if (m.type() === 'error' && !/favicon|404|Failed to load resource|ERR_FAILED|Load failed/.test(m.text())) fehler.push('console: ' + m.text()); });
  await seite.route('**/*', (r) => {
    const url = r.request().url();
    if (url.startsWith(`http://127.0.0.1:${PORT}/`)) return r.continue();
    if (!url.startsWith(SUPA)) return r.abort();
    if (url.includes('/rpc/saison_mein_stand')) {
      gesendet.push('saison_mein_stand');
      if (stand === 'offline') return r.abort('failed');
      if (stand && stand.__status) return r.fulfill({ status: stand.__status, contentType: 'application/json', body: JSON.stringify({ message: 'nein' }) });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stand) });
    }
    if (url.includes('/rpc/saison_titel_waehle')) {
      gesendet.push('saison_titel_waehle:' + r.request().postData());
      if (titelAbsage) return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'SAISON_TITEL' }) });
      return r.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await seite.addInitScript(({ sitzung, konto }) => {
    if (sessionStorage.getItem('saison-probe')) return;
    sessionStorage.setItem('saison-probe', '1');
    localStorage.clear();
    localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
    if (konto) localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
  }, { sitzung: SITZUNG, konto });
  await seite.goto(BASIS + '#ich');
  await seite.waitForFunction(() => !!window.__app, null, { timeout: 20000 });
  return { kontext, seite, fehler, gesendet };
}
const leiste = (seite) => seite.evaluate(() => {
  const el = document.querySelector('.ss-leiste');
  const r = el && el.getBoundingClientRect();
  return { da: !!el, sichtbar: !!el && !el.hidden && getComputedStyle(el).display !== 'none' && r.height > 0, text: el ? el.textContent.replace(/\s+/g, ' ').trim() : '',
    knoepfe: el ? [...el.querySelectorAll('.ss-titel')].map((b) => [b.textContent.trim(), b.getAttribute('aria-pressed')]) : [],
    blatt: document.querySelectorAll('.sheet-karte.ss-blatt').length, blattText: document.querySelector('.ss-blatt')?.textContent.replace(/\s+/g, ' ').trim() || '' };
});
const warteLeiste = (seite) => seite.waitForFunction(() => { const el = document.querySelector('.ss-leiste'); return el && !el.hidden; }, null, { timeout: 8000 })
  .then(() => true, () => false);
const ohneUnsinn = (x) => !/NaN|undefined|null|\{[a-z]+\}/.test(x);

const browser = await browserTyp(pw).launch({ headless: true });
try {
  { // laufende Season mit Abzeichen und Titeln, Season 1 gerade vorbei
    const { kontext, seite, fehler, gesendet } = await neueSeite(browser, { stand: LAUF });
    pruefe('Leiste erscheint im Profil "Ich"', await warteLeiste(seite));
    await seite.waitForSelector('.ss-blatt', { timeout: 5000 }).catch(() => {});
    let l = await leiste(seite);
    pruefe('Leiste: Season 2, Woche 3 von 8, Ende 25. April 2027', /Season 2/.test(l.text) && l.text.includes('Woche 3 von 8 · endet am 25. April 2027'), l.text);
    pruefe('Leiste: beste Stufe dieser Season Baron I (11) und Abzeichen S1 · Crownmate I', l.text.includes('Beste Stufe dieser Season: Baron I')
      && l.text.includes('S1 · Crownmate I'), l.text);
    pruefe('Titelwahl: "Keinen zeigen" gedrueckt, dazu Crownmaster und Top 100 Season 1', JSON.stringify(l.knoepfe) === JSON.stringify([
      ['Keinen zeigen', 'true'], ['Crownmaster Season 1', 'false'], ['Top 100 Season 1', 'false']]), l.knoepfe);
    pruefe('Season-Ende: Blatt "Season 1 ist vorbei" mit Abzeichen, neuem Titel und Startstufe', l.blatt === 1 && l.blattText.includes('Season 1 ist vorbei')
      && l.blattText.includes('Dein Abzeichen: Crownmate I') && l.blattText.includes('Neuer Titel: Crownmaster Season 1')
      && l.blattText.includes('Neuer Titel: Top 100 Season 1') && l.blattText.includes('Season 2 startet für dich bei Sovereign I'), l.blattText);
    pruefe('keine Platzhalter oder NaN', ohneUnsinn(l.text) && ohneUnsinn(l.blattText), l.text + ' | ' + l.blattText);
    await seite.click('.ss-blatt .sheet-knoepfe button');
    await seite.waitForFunction(() => !document.querySelector('.ss-blatt'), null, { timeout: 4000 }).catch(() => {});
    await seite.click('.ss-titel[data-titel="crownmaster-s1"]');
    await seite.waitForFunction(() => document.querySelector('.ss-titel[data-titel="crownmaster-s1"]')?.getAttribute('aria-pressed') === 'true', null, { timeout: 4000 }).catch(() => {});
    l = await leiste(seite);
    pruefe('Titelwahl: Tipp auf Crownmaster sendet ihn und drueckt den Knopf', gesendet.includes('saison_titel_waehle:{"titel":"crownmaster-s1"}')
      && l.knoepfe[1][1] === 'true' && l.knoepfe[0][1] === 'false', [gesendet, l.knoepfe]);
    await seite.click('.ss-titel[data-titel=""]');
    await seite.waitForFunction(() => document.querySelector('.ss-titel[data-titel=""]')?.getAttribute('aria-pressed') === 'true', null, { timeout: 4000 }).catch(() => {});
    pruefe('Titelwahl: "Keinen zeigen" sendet titel null', gesendet.includes('saison_titel_waehle:{"titel":null}'), gesendet);
    await seite.reload();
    await seite.waitForFunction(() => !!window.__app, null, { timeout: 20000 });
    pruefe('nach dem Neuladen: Leiste wieder da', await warteLeiste(seite));
    await seite.waitForTimeout(600);
    l = await leiste(seite);
    pruefe('Season-Ende-Blatt kommt je Konto und Season nur einmal', l.blatt === 0, l.blattText);
    pruefe('keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  { // Absage beim Titel: Hinweis, Knopf bleibt wie er war
    const { kontext, seite, fehler } = await neueSeite(browser, { stand: { ...LAUF, abzeichen: [{ saison: 1, stufe: 9 }], titel: ['top10-s1'] }, titelAbsage: true });
    await warteLeiste(seite);
    await seite.waitForTimeout(400);
    if (await seite.$('.ss-blatt')) { await seite.click('.ss-blatt .sheet-knoepfe button'); await seite.waitForTimeout(300); }
    await seite.click('.ss-titel[data-titel="top10-s1"]');
    await seite.waitForFunction(() => !!document.querySelector('.ss-fehler')?.textContent, null, { timeout: 4000 }).catch(() => {});
    const l = await leiste(seite);
    pruefe('Titel-Absage: Fehlerhinweis, "Keinen zeigen" bleibt gedrueckt', l.text.includes('Das hat gerade nicht geklappt') && l.knoepfe[0][1] === 'true'
      && l.knoepfe[1][1] === 'false', [l.text, l.knoepfe]);
    pruefe('Titel-Absage: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  { // Vorsaison: Startdatum, keine Wochen, keine Abzeichen, kein Blatt
    const { kontext, seite } = await neueSeite(browser, { stand: { saison: 0, start: '2027-01-04', woche: null, wochen: 8, ende: null, bisher: null, stufe: 5,
      abzeichen: [], titel: [], gewaehlt: null } });
    pruefe('Vorsaison: Leiste erscheint', await warteLeiste(seite));
    await seite.waitForTimeout(400);
    const l = await leiste(seite);
    pruefe('Vorsaison: "Season 1 beginnt am 4. Januar 2027", keine Titelwahl, kein Blatt', l.text.includes('Season 1 beginnt am 4. Januar 2027')
      && l.knoepfe.length === 0 && l.blatt === 0 && !/Woche \d/.test(l.text), l.text);
    await kontext.close();
  }
  for (const [name, opt] of [['offline', { stand: 'offline' }], ['altes SQL (404)', { stand: { __status: 404 } }], ['kaputte Antwort', { stand: { saison: 'zwei', start: 'morgen' } }],
    ['ohne Konto', { stand: LAUF, konto: false }]]) {
    const { kontext, seite, fehler, gesendet } = await neueSeite(browser, opt);
    await seite.waitForSelector('.ss-leiste', { state: 'attached', timeout: 8000 }).catch(() => {});
    await seite.waitForTimeout(800);
    const l = await leiste(seite);
    pruefe(`${name}: Leiste bleibt verborgen, kein Blatt, keine Zahlen`, l.da && !l.sichtbar && l.blatt === 0 && l.text === '', l);
    if (!opt.konto && opt.konto !== undefined) pruefe('ohne Konto: kein Aufruf saison_mein_stand', !gesendet.includes('saison_mein_stand'), gesendet);
    pruefe(`${name}: keine Konsolenfehler`, fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  { // englisch: dieselbe Leiste in der App-Sprache
    const { kontext, seite } = await neueSeite(browser, { stand: { ...LAUF, abzeichen: [], titel: [] } });
    await warteLeiste(seite);
    const en = await seite.evaluate(async () => {
      const { setzeSprache } = await import('/js/sprache.js');
      setzeSprache('en');
      const { saisonLeiste } = await import('/js/pakete/liga/saison.js');
      const el = saisonLeiste();
      document.body.append(el);
      for (let i = 0; i < 40 && el.hidden; i++) await new Promise((r) => setTimeout(r, 50));
      return el.textContent.replace(/\s+/g, ' ').trim();
    });
    pruefe('en: Week 3 of 8 · ends on 25 April 2027, best tier Baron I', en.includes('Week 3 of 8 · ends on') && en.includes('2027') && en.includes('Best tier this season: Baron I')
      && ohneUnsinn(en), en);
    await kontext.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
