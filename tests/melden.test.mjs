// Namensfilter und Melden, Geraete-Seite. Netzwerk ausschliesslich simuliert: kein Test spricht mit dem echten Server.
//   Node:    js/namen.js (Sperrliste, Lesarten, harmlose Namen) und js/konto.js speichereBenutzername (freundliche
//            Meldung vor dem Absenden, Kennung NAME_GESPERRT vom Server, bestehender Name bleibt)
//   Browser: "Spieler melden" in der Mini-Karte der Liga-Gruppe (nur andere Menschen, nur wenn der Server das Melden
//            kennt), das Blatt mit Grund und Text, Danke, Fehler, Englisch, dunkel, 320 px bis PC
//   node tests/melden.test.mjs [--nur-node]     PORT=9630 fuer einen eigenen Port (Standard 8852)
// Der Server-Teil (SQL wirklich ausgefuehrt, Vergleich der Liste mit js/namen.js): tests/server-melden.test.mjs.
// "Gegner melden" nach einer Online-Partie: tests/online-ui.test.mjs.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';
import { NAMEN_REGELN, nameGesperrt, nameLesarten } from '../js/namen.js';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const PORT = Number(process.env.PORT || 8852);
const ergebnisse = [];
async function pruefe(name, fn) {
  try { await fn(); ergebnisse.push({ name, ok: true }); console.log('ok   ' + name); }
  catch (e) { ergebnisse.push({ name, ok: false }); console.error('FEHLER ' + name + ': ' + e.message); }
}

// ---------- Node: Namensfilter ----------
await pruefe('Filter: reservierte Namen, auch mit Ziffern, Unterstrichen und Ersetzungen', () => {
  for (const n of ['admin', 'Admin', 'ADMIN_1', '4dm1n', 'a_d_m_i_n', 'TheAdmin', 'Administrator', 'Support', '5upp0rt', 'Support_Team',
    'Crownmate', 'Cr0wnm4te', 'crown_mate', 'CrownmateTeam', 'Moderator', 'M0der4tor', 'mod', 'Team', 'T34M', 'Official', '0ff1c14l',
    'System', 'Staff', 'Spieler', 'Gegner', 'Bot']) assert.equal(nameGesperrt(n), 'reserviert', n);
});
await pruefe('Filter: beleidigende Namen DE und EN, auch verschleiert (grosses I statt l)', () => {
  for (const n of ['Hurensohn', 'hur3n50hn', 'H_u_r_e_n_s_o_h_n', 'Wichser99', 'Arschloch', 'Arschl0ch', 'fuck_you', 'f_u_c_k', 'B1tch',
    'Hitler', 'H1tler', 'HitIer', 'SiegHeil', 'Nazi', 'N4z1', 'Schlampe', 'Missgeburt', 'cunt', 'Hure', 'Penis']) assert.equal(nameGesperrt(n), 'anstoessig', n);
});
await pruefe('Filter: harmlose Namen bleiben frei (Scunthorpe-Problem)', () => {
  for (const n of ['Hassan', 'Dickens', 'Analyst', 'Scunthorpe', 'Badminton', 'Essex', 'Therapist', 'Nazir', 'Ashkenazi', 'Absolut',
    'Brochure', 'Penistone', 'Supporter96', 'TeamRocket', 'Ecosystem', 'Botvinnik', 'Modric', 'Admiral', 'Kitten', 'Mittens', 'Popcorn',
    'Benfica', 'Bastian', 'Flo', 'flo_1', 'lena_spielt', 'Magnus2013', 'Spielerin', 'Teamgeist', 'Mate', '123', '___']) assert.equal(nameGesperrt(n), null, n);
});
await pruefe('Filter: zwei Lesarten (mit Ersetzungen, ohne Ziffern), i und l als ein Buchstabe', () => {
  assert.deepEqual(nameLesarten('H1t_L3r'), ['hitier', 'htir']);
  assert.deepEqual(nameLesarten('Lena_2013'), ['ienaoie', 'iena']);
  assert.deepEqual(nameLesarten(null), ['', '']);
});
await pruefe('Filter: die Liste ist kurz und eingefroren', () => {
  assert.ok(Object.isFrozen(NAMEN_REGELN));
  const n = Object.values(NAMEN_REGELN).filter(Array.isArray).flat().length;
  assert.ok(n > 40 && n <= 100, String(n));
});

// ---------- Node: js/konto.js speichereBenutzername ----------
{
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } };
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Test' }, configurable: true });
  const { setzeSpeicher } = await import('../js/storage.js');
  setzeSpeicher(globalThis.localStorage);
  const K = await import('../js/konto.js');
  const { setzeSprache } = await import('../js/sprache.js');
  const sitzung = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: 'u1' })).toString('base64url') + '.x', refresh_token: 'r',
    expires_at: 9999999999, user: { id: 'u1', email: 'a@b.de' } };
  localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
  const rufe = [];
  let antwort = { status: 201, body: null };
  K.setzeKontoFetch(async (url, opt) => { rufe.push({ url, ...opt }); return { ok: antwort.status < 400, status: antwort.status, async json() { return antwort.body; } }; });
  const versuch = async (name) => { try { await K.speichereBenutzername(name); return null; } catch (e) { return e.message; } };

  await pruefe('Konto: reservierter Name wird freundlich abgelehnt, ohne Anfrage an den Server', async () => {
    assert.match(await versuch('Admin_Tom'), /klingt nach Crownmate oder dem Hilfe-Team/);
    assert.match(await versuch('Cr0wnmate'), /klingt nach Crownmate/);
    assert.equal(rufe.length, 0);
  });
  await pruefe('Konto: beleidigender Name wird freundlich abgelehnt, ohne das Wort zu wiederholen', async () => {
    const f = await versuch('Hurensohn');
    assert.match(f, /Dieser Name geht leider nicht/);
    assert.ok(!/hurensohn/i.test(f));
    assert.equal(rufe.length, 0);
  });
  await pruefe('Konto: harmlose Namen gehen an den Server (Hassan, Dickens, Analyst, Scunthorpe)', async () => {
    for (const n of ['Hassan', 'Dickens', 'Analyst', 'Scunthorpe']) assert.equal(await versuch(n), null, n);
    assert.equal(rufe.length, 4);
    assert.equal(JSON.parse(rufe.at(-1).body).benutzername, 'Scunthorpe');
  });
  await pruefe('Konto: lehnt der Server ab (NAME_GESPERRT), kommt derselbe freundliche Satz statt "Serverfehler"', async () => {
    antwort = { status: 400, body: { code: 'P0001', message: 'NAME_GESPERRT', hint: 'reserviert' } };
    assert.match(await versuch('Harmlos_1'), /klingt nach Crownmate/);
    antwort = { status: 400, body: { code: 'P0001', message: 'NAME_GESPERRT', hint: 'anstoessig' } };
    assert.match(await versuch('Harmlos_2'), /Dieser Name geht leider nicht/);
    antwort = { status: 201, body: null };
  });
  await pruefe('Konto: ein Name, den das Konto schon traegt, bleibt speicherbar (bestehende Namen aendert der Filter nicht)', async () => {
    localStorage.setItem(K.NAME_SCHLUESSEL, JSON.stringify({ konto: 'u1', name: 'Admin_Alt' }));
    const vorher = rufe.length;
    assert.equal(await versuch('Admin_Alt'), null);
    assert.equal(await versuch('admin_alt'), null);
    assert.equal(rufe.length, vorher + 2);
    assert.match(await versuch('Admin_Neu'), /klingt nach Crownmate/);
  });
  await pruefe('Konto: englische Meldungen', async () => {
    setzeSprache('en');
    assert.match(await versuch('Support_1'), /sounds like Crownmate or the help team/);
    assert.match(await versuch('fuck_you'), /this name is not possible/);
    setzeSprache('de');
  });
  K.setzeKontoFetch(null);
}

// ---------- Browser: Melden in der Liga-Gruppe ----------
const SUPA = 'https://usaamcqypmvgqmsbfecb.supabase.co';
const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const SITZUNG = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'r1',
  expires_at: 9999999999, user: { id: UID, email: 'probe@example.invalid' } };
// Gruppe mit 30 Plaetzen: du auf Platz 3 ("flo"), Platz 2 "Lena_99" und Platz 4 "Dickens" sind Menschen mit Benutzernamen,
// Platz 5 ein Mensch ohne Benutzernamen (Platzhalter des Servers), Platz 6 ein KI-Mitspieler
function gruppe() {
  const mitglieder = [];
  for (let p = 1; p <= 30; p++) {
    const ki = p === 6;
    mitglieder.push({ platz: p, name: p === 3 ? 'flo' : p === 2 ? 'Lena_99' : p === 4 ? 'Dickens' : ki ? 'Rosa' : p === 5 ? '' : 'Spieler_' + p,
      kronen: 400 - p * 12, ki, ich: p === 3 });
  }
  return { woche: '2026-11-02', ende: '2026-11-08', stufe: 7, gruppe: 41, platz: 3, n: 30, mitglieder, belohnung: [], offen: [], bot_ki: { genutzt: 0, max: 300 } };
}

// melden: 'da' (Server kennt das Melden), 'fehlt' (melden-schema.sql nicht eingespielt: 404 wie PostgREST), 'netz' (500)
async function seite(browser, { melden = 'da', antwort = { ok: true, rest: 4 }, w = 390, h = 844, modus = 'hell', sprache = 'de' } = {}) {
  const kontext = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: w < 700, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const page = await kontext.newPage();
  page.setDefaultTimeout(15000);
  const fehler = [];
  const rufe = [];
  const lage = { antwort };
  page.on('pageerror', (e) => fehler.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) fehler.push(m.text()); });
  await page.route(SUPA + '/**', (r) => {
    const name = (r.request().url().match(/\/rpc\/([a-z_]+)/) || [])[1];
    const json = (d, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(d) });
    if (name === 'liga_meine_gruppe') return json(gruppe());
    if (name === 'melde_stand' || name === 'melde_spieler') {
      rufe.push({ name, body: r.request().postDataJSON() });
      if (melden === 'fehlt') return json({ code: 'PGRST202', message: 'Could not find the function public.' + name }, 404);
      if (melden === 'netz') return json({ message: 'kaputt' }, 500);
      return json(name === 'melde_stand' ? { max: 5, rest: 5, notiz_max: 300 } : lage.antwort);
    }
    return json([]);
  });
  await kontext.addInitScript(({ sitzung, modus, sprache }) => {
    if (sessionStorage.getItem('melden-probe')) return;
    sessionStorage.setItem('melden-probe', '1');
    localStorage.clear();
    localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ modus, sprache, spracheGewaehlt: true, bewegung: 'aus', klang: false, duellIntro: 'aus' }));
  }, { sitzung: SITZUNG, modus, sprache });
  await page.goto(`http://127.0.0.1:${PORT}/index.html?test#bestenliste`);
  await page.waitForSelector('.lg-gr[data-zustand="gruppe"]');
  const oeffne = async (platz) => {
    await page.locator(`.lg-gr-zeile[data-platz="${platz}"] .lg-gr-wer`).click();
    await page.waitForSelector('.lg-mini-blatt');
  };
  const zu = async () => {
    await page.locator('.lg-mini-blatt .sheet-knoepfe button').click();
    await page.waitForSelector('.lg-mini-blatt', { state: 'detached' });
  };
  return { kontext, page, fehler, rufe, lage, oeffne, zu };
}

async function browserTeil(browser) {
  {
    const s = await seite(browser);
    const { page, rufe } = s;
    try {
      await pruefe('Melden: Mini-Karte eines anderen Spielers zeigt "Spieler melden" (mind. 44 px hoch)', async () => {
        await s.oeffne(2);
        const b = page.locator('.lg-mini-melden');
        await b.waitFor();
        assert.equal((await b.innerText()).trim(), 'Spieler melden');
        assert.ok((await b.boundingBox()).height >= 44);
        assert.equal(rufe.filter((r) => r.name === 'melde_stand').length, 1);
      });
      await pruefe('Melden: Tipp oeffnet das Blatt mit Name, drei Gruenden, freiwilligem Text; Senden erst mit Grund', async () => {
        await page.locator('.lg-mini-melden').click();
        await page.waitForSelector('.melden-blatt');
        assert.equal(await page.locator('.lg-mini-blatt').count(), 0);
        assert.equal((await page.locator('.melden-blatt h3').innerText()).trim(), 'Lena_99 melden');
        assert.match(await page.locator('.melden-blatt > p').first().innerText(), /liest nur Crownmate[\s\S]*erfährt nicht, wer gemeldet hat/);
        assert.deepEqual((await page.locator('.melden-grund').allInnerTexts()).map((x) => x.trim()), ['Name', 'Verhalten im Spiel', 'Etwas anderes']);
        assert.equal(await page.locator('.melden-notiz').getAttribute('maxlength'), '300');
        assert.ok(await page.locator('.melden-blatt [data-knopf="senden"]').isDisabled());
        assert.equal(await page.getByRole('alertdialog').count(), 1);
        const masse = await page.evaluate(() => ({ b: document.documentElement.scrollWidth <= innerWidth,
          h: [...document.querySelectorAll('.melden-grund, .melden-blatt .sheet-knoepfe button')].map((x) => x.getBoundingClientRect().height),
          unten: document.querySelector('.melden-blatt').getBoundingClientRect().bottom <= innerHeight + 1,
          oben: document.querySelector('.melden-blatt').getBoundingClientRect().top >= 0 }));
        assert.ok(masse.b && masse.unten && masse.oben && masse.h.every((x) => x >= 44), JSON.stringify(masse));
      });
      await pruefe('Melden: Grund waehlen (aria-pressed), Text schreiben, senden: der Server bekommt Name, Grund und Text', async () => {
        await page.locator('.melden-grund[data-grund="verhalten"]').click();
        await page.locator('.melden-grund[data-grund="name"]').click();
        assert.deepEqual(await page.locator('.melden-grund').evaluateAll((l) => l.map((b) => b.getAttribute('aria-pressed'))), ['true', 'false', 'false']);
        await page.locator('.melden-notiz').fill('  beleidigender Name  ');
        const senden = page.locator('.melden-blatt [data-knopf="senden"]');
        assert.ok(await senden.isEnabled());
        await senden.click();
        await page.waitForSelector('.melden-blatt', { state: 'detached' });
        const r = rufe.filter((x) => x.name === 'melde_spieler');
        assert.equal(r.length, 1);
        assert.deepEqual(r[0].body, { name: 'Lena_99', grund: 'name', notiz: 'beleidigender Name', partie: null });
      });
      await pruefe('Melden: danach die Bestaetigung "Danke, wir schauen es uns an."', async () => {
        await page.waitForFunction(() => /Danke, wir schauen es uns an\./.test(document.querySelector('.toast-ort')?.textContent || ''));
      });
      await pruefe('Melden: nie in der eigenen Karte, nie bei einem KI-Mitspieler, nie ohne Benutzernamen', async () => {
        for (const platz of [3, 6, 5]) {
          await s.oeffne(platz);
          await page.waitForTimeout(250);
          assert.equal(await page.locator('.lg-mini-melden').count(), 0, 'Platz ' + platz);
          await s.zu();
        }
      });
      await pruefe('Melden: Tagesgrenze erreicht: ruhiger Satz im Blatt, das Blatt bleibt, Abbrechen schliesst', async () => {
        s.lage.antwort = { fehler: 'MELDEN_GRENZE' };
        await s.oeffne(4);
        await page.locator('.lg-mini-melden').click();
        await page.waitForSelector('.melden-blatt');
        await page.locator('.melden-grund[data-grund="sonstiges"]').click();
        await page.locator('.melden-blatt [data-knopf="senden"]').click();
        await page.waitForFunction(() => document.querySelector('.melden-status')?.dataset.fehler === 'ja');
        assert.equal(await page.locator('.melden-status').innerText(), 'Für heute sind es genug Meldungen. Morgen geht es wieder.');
        assert.equal(rufe.filter((x) => x.name === 'melde_spieler').at(-1).body.notiz, null);
        await page.locator('.melden-blatt [data-knopf="abbrechen"]').click();
        await page.waitForSelector('.melden-blatt', { state: 'detached' });
      });
      await pruefe('Melden: heute schon gemeldet: freundlicher Satz mit Namen', async () => {
        s.lage.antwort = { ok: true, schon: true };
        await s.oeffne(4);
        await page.locator('.lg-mini-melden').click();
        await page.locator('.melden-grund[data-grund="name"]').click();
        await page.locator('.melden-blatt [data-knopf="senden"]').click();
        await page.waitForSelector('.melden-blatt', { state: 'detached' });
        await page.waitForFunction(() => /Du hast Dickens heute schon gemeldet/.test(document.querySelector('.toast-ort')?.textContent || ''));
      });
      await pruefe('Melden: unbekannte Antwort des Servers: allgemeiner Satz, zweiter Versuch moeglich, kein roher Text', async () => {
        s.lage.antwort = { fehler: 'ETWAS_NEUES <b>' };
        await s.oeffne(4);
        await page.locator('.lg-mini-melden').click();
        await page.locator('.melden-grund[data-grund="name"]').click();
        await page.locator('.melden-blatt [data-knopf="senden"]').click();
        await page.waitForFunction(() => document.querySelector('.melden-status')?.dataset.fehler === 'ja');
        assert.equal(await page.locator('.melden-status').innerText(), 'Das hat gerade nicht geklappt. Versuch es später noch einmal.');
        assert.ok(await page.locator('.melden-blatt [data-knopf="senden"]').isEnabled());
        await page.keyboard.press('Escape');
        await page.waitForSelector('.melden-blatt', { state: 'detached' });
      });
      await pruefe('Melden: keine Konsolenfehler', async () => assert.deepEqual(s.fehler, []));
    } finally { await s.kontext.close(); }
  }
  // VOR dem Einspielen von melden-schema.sql: der Server kennt die Funktion nicht, die App bleibt wie bisher
  for (const melden of ['fehlt', 'netz']) {
    const s = await seite(browser, { melden });
    try {
      await pruefe(`Ohne Melden auf dem Server (${melden === 'fehlt' ? '404, Datei nicht eingespielt' : 'Serverfehler'}): kein Knopf, Mini-Karte wie bisher, kein Fehler`, async () => {
        await s.oeffne(2);
        await s.page.waitForTimeout(400);
        assert.equal(s.rufe.filter((r) => r.name === 'melde_stand').length, 1);
        assert.equal(await s.page.locator('.lg-mini-melden').count(), 0);
        assert.match(await s.page.locator('.lg-mini-satz').innerText(), /Mehr zeigt die Liga nicht/);
        await s.zu();
        assert.deepEqual(s.fehler, []);
      });
    } finally { await s.kontext.close(); }
  }
  // Englisch, dunkel, kleinstes und groesstes Format
  for (const [w, h] of [[320, 568], [1280, 800]]) {
    const s = await seite(browser, { w, h, modus: 'dunkel', sprache: 'en' });
    const { page } = s;
    try {
      await pruefe(`Melden ${w}x${h}, dunkel, Englisch: Texte, Platz im Bild, Knoepfe mind. 44 px, lesbarer Kontrast`, async () => {
        await s.oeffne(2);
        await page.locator('.lg-mini-melden').waitFor();
        assert.equal((await page.locator('.lg-mini-melden').innerText()).trim(), 'Report player');
        await page.locator('.lg-mini-melden').click();
        await page.waitForSelector('.melden-blatt');
        assert.equal((await page.locator('.melden-blatt h3').innerText()).trim(), 'Report Lena_99');
        assert.deepEqual((await page.locator('.melden-grund').allInnerTexts()).map((x) => x.trim()), ['Name', 'Behaviour in the game', 'Something else']);
        assert.deepEqual((await page.locator('.melden-blatt .sheet-knoepfe button').allInnerTexts()).map((x) => x.trim()).sort(), ['Cancel', 'Report']);
        await page.locator('.melden-grund[data-grund="verhalten"]').click();
        const m = await page.evaluate(() => {
          const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
          const kontrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
          const blatt = document.querySelector('.melden-blatt');
          const r = blatt.getBoundingClientRect();
          const g = document.querySelector('.melden-grund[aria-pressed="true"]');
          return { breit: document.documentElement.scrollWidth <= innerWidth, imBild: r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth,
            ueberlauf: [...blatt.querySelectorAll('button, h3, p, span')].filter((e) => e.scrollWidth > e.clientWidth + 1).length,
            hoehen: [...blatt.querySelectorAll('.melden-grund, .sheet-knoepfe button')].map((x) => Math.round(x.getBoundingClientRect().height)),
            kontrast: kontrast(getComputedStyle(g).color, getComputedStyle(g).backgroundColor),
            schrift: parseFloat(getComputedStyle(document.querySelector('.melden-notiz')).fontSize) };
        });
        assert.ok(m.breit && m.imBild && m.ueberlauf === 0 && m.hoehen.every((x) => x >= 44) && m.kontrast >= 4.5 && m.schrift >= 16, JSON.stringify(m));
        if (process.env.BILDER) {
          mkdirSync(process.env.BILDER, { recursive: true });
          await page.screenshot({ path: path.join(process.env.BILDER, `melden-${w}-dunkel-en.png`) });
        }
        await page.locator('.melden-blatt [data-knopf="senden"]').click();
        await page.waitForFunction(() => /Thank you, we will look into it\./.test(document.querySelector('.toast-ort')?.textContent || ''));
        assert.deepEqual(s.fehler, []);
      });
    } finally { await s.kontext.close(); }
  }
}

let server = null;
let browser = null;
try {
  if (!process.argv.includes('--nur-node')) {
    let pw;
    for (const kandidat of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
      try { pw = require(kandidat); break; } catch (e) { /* naechster Installationspfad */ }
    }
    if (!pw) throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
    const typen = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.wasm': 'application/wasm',
      '.woff2': 'font/woff2', '.json': 'application/json', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
    server = createServer((req, res) => {
      const rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const voll = path.resolve(WURZEL, '.' + (rel === '/' ? '/index.html' : rel));
      if (!voll.startsWith(WURZEL + path.sep)) { res.writeHead(403).end(); return; }
      try {
        const daten = readFileSync(voll);
        res.writeHead(200, { 'Content-Type': typen[path.extname(voll)] || 'application/octet-stream' }); res.end(daten);
      } catch (e) { res.writeHead(404).end(); }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(PORT, '127.0.0.1', resolve); });
    browser = await browserTyp(pw).launch();
    await browserTeil(browser);
  }
} catch (e) {
  ergebnisse.push({ name: 'Testlauf', ok: false }); console.error('FEHLER Testlauf: ' + e.stack);
} finally {
  if (browser) await browser.close();
  if (server?.listening) await new Promise((r) => server.close(r));
}
const falsch = ergebnisse.filter((r) => !r.ok);
console.log(`\n${ergebnisse.length - falsch.length}/${ergebnisse.length} bestanden`);
process.exit(falsch.length ? 1 : 0);
