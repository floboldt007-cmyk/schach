// Feinschliff R16 Paket 1 (14.11.2026, Kritik R16-Kritik/kritik.md), im Browser gemessen statt gelesen.
//   A1 Konto: Fehlertext dunkel lesbar (>= 4,5:1)        A2 Meldung steht bei "Code senden", vor "oder" und Google
//   A3 "Code senden" und Google gleich breit
//   K1 Lobby "VS" hell >= 4,5:1    K2 Gegner-Sondertitel mit Wappen wie der eigene    K3 Elo des Gegners, wenn der Server sie
//   schickt (ohne Feld keine Zeile)    K4 Liga-Zeile buendig unter dem Namen    K5 Titel auf dem Banner >= 4,5:1 (Pixel)
//   K6 "Labor" >= 12 px, Umschalter Welten/Online am Handy >= 44 px
//   I1 Stufe in der Vitrine >= 12 px    I2 Erklaerung direkt unter der Vitrine, geraeteneutral (de und en)
//   L1 Lektion: Aufgabe ("Matt in einem Zug ...") ganz sichtbar, auch auf dem iPhone SE
// Netzwerk: nur 127.0.0.1, Supabase je Fall beantwortet.
//
//   node tests/r16-p1.test.mjs
//   node tests/r16-p1.test.mjs --bilder=<ordner> --name=vorher|nachher    dazu Bilder je Punkt
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';
import { kontrastBefunde } from './ansicht-befunde.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');
const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };
const BILDER = arg('bilder');
const NAME = arg('name') || 'bild';
if (BILDER) await mkdir(BILDER, { recursive: true });

const WURZEL = fileURLToPath(new URL('../', import.meta.url));
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (q, r) => {
  const p = path.resolve(WURZEL, '.' + decodeURIComponent(new URL(q.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(WURZEL)) { r.writeHead(403); r.end(); return; }
  try { const d = await readFile(p); r.writeHead(200, { 'Content-Type': TYPEN[path.extname(p)] || 'application/octet-stream' }); r.end(d); }
  catch (e) { r.writeHead(404); r.end(); }
});
await new Promise((r) => server.listen(Number(process.env.PORT || 0), '127.0.0.1', r));
const BASIS = `http://127.0.0.1:${server.address().port}/index.html?test`;
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
  return gut;
}

const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const token = (sub) => 'a.' + Buffer.from(JSON.stringify({ sub })).toString('base64url') + '.x';
const SITZUNG = { access_token: token(UID), refresh_token: 'r1', expires_at: 9999999999, user: { id: UID, email: 'probe@example.invalid' }, email: 'probe@example.invalid' };
const SIEG = JSON.stringify({ bots: { benno: { sterne: [true, false, false] } }, brillanteZuege: [] });

async function seite(browser, viewport, { schema = 'hell', touch = false, sitzung = false, erfinder = false, rpc = null, otp = null,
  vitrine = null, hash = 'heim', produktion = false } = {}) {
  const k = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, locale: 'de-DE', timezoneId: 'Europe/Berlin',
    serviceWorkers: 'block', colorScheme: schema === 'dunkel' ? 'dark' : 'light' });
  await k.route('**/*', (route) => {
    const req = route.request(); const u = new URL(req.url());
    if (u.hostname === '127.0.0.1') return route.continue();
    // Kaltreview R16-p1 (A2): ohne ?test laedt die App Turnstile; Nachbau wie tests/screens.test.mjs, nie das echte Skript.
    // render() liefert sofort ein Token, damit "Code senden" die (nachgebaute) Anfrage abschickt
    if (u.hostname === 'challenges.cloudflare.com') return route.fulfill({ status: 200, contentType: 'text/javascript',
      body: 'window.turnstile = { render(el, o) { setTimeout(() => o && o.callback && o.callback("probe-token"), 0); return "w1"; }, reset() {}, remove() {}, getResponse() { return "probe-token"; } };' });
    if (u.hostname.endsWith('.supabase.co')) {
      if (u.pathname.startsWith('/auth/v1/otp') && otp) return route.fulfill({ status: otp.status, contentType: 'application/json', body: JSON.stringify(otp.body) });
      const name = (u.pathname.match(/\/rest\/v1\/rpc\/([a-z_]+)/) || [])[1];
      if (name && rpc) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rpc(name) ?? []) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.pathname.includes('sonderstuecke') && erfinder ? [{ stueck_id: 'erfinder-titel' }] : []) });
    }
    return route.abort();
  });
  await k.addInitScript(({ sitzung, erfinder, uid, vitrine, sieg, modus }) => {
    try {
      if (sessionStorage.getItem('probe-start')) return;
      sessionStorage.setItem('probe-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:v1:modul:start', JSON.stringify({ v: 1, gesehen: '2026-11-01' }));
      localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, modus }));
      localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
      if (sitzung) localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
      if (erfinder) localStorage.setItem('schach-arena:konto:sonderstuecke', JSON.stringify({ konto: uid, ids: ['erfinder-titel'] }));
      if (vitrine) {
        localStorage.setItem('schach-arena:v1:fortschritt', sieg);
        localStorage.setItem('schach-arena:v1:einstellungen:sammeln', JSON.stringify({ profil: { vitrine } }));
      }
    } catch (e) { /* egal */ }
    window.__lobbySuche = 300; window.__lobbyBotMs = 3000;
  }, { sitzung: sitzung ? SITZUNG : null, erfinder, uid: UID, vitrine, sieg: SIEG, modus: schema });
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  const fehler = []; s.on('pageerror', (e) => fehler.push(e.message));
  await s.goto((produktion ? BASIS.replace('?test', '') : BASIS) + '#' + hash);
  // ohne ?test gibt es kein window.__app; dort wartet der Aufrufer auf sein Element
  if (!produktion) await s.waitForFunction(() => window.__app && typeof window.__app.gehe === 'function' && document.documentElement.dataset.screen, null, { timeout: 30000 });
  return { k, s, fehler };
}
const ruhe = (s) => s.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'
  || a.effect?.getComputedTiming().iterations === Infinity), null, { timeout: 4000 }).catch(() => {});
async function bild(s, datei) { if (BILDER) await s.screenshot({ path: path.join(BILDER, `${datei}-${NAME}.png`) }); }
const kontrastVon = (kb, anfang) => (kb.befunde || []).filter((b) => anfang.some((a) => b.text.startsWith(a)));

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });

  // ---------- A: Konto-Fehler ----------
  // Die Durchgaenge "mit Bot-Schutz" laufen ohne ?test (Produktionsweg: Turnstile-Nachbau, Hinweis zum Bot-Schutz)
  for (const [geraet, width, height, touch, schemata, produktion] of [['iPhone 13', 390, 844, true, ['hell', 'dunkel'], false],
    ['PC 1440', 1440, 900, false, ['hell', 'dunkel'], false], ['iPhone 13 mit Bot-Schutz', 390, 844, true, ['hell'], true],
    ['PC 1440 mit Bot-Schutz', 1440, 900, false, ['hell'], true]]) {
    for (const schema of schemata) {
      const { k, s, fehler } = await seite(browser, { width, height }, { schema, touch, hash: 'einstellungen/konto', produktion,
        otp: { status: 422, body: { code: 422, error_code: 'signup_disabled', msg: 'Signups not allowed for otp' } } });
      await s.waitForSelector('.konto-gruppe .konto-email', { timeout: 15000 });
      await s.locator('.konto-gruppe .konto-email').fill('neu@example.invalid');
      await s.locator('.konto-gruppe [data-konto="code"]').click();
      await s.waitForFunction(() => document.querySelector('.konto-gruppe .konto-status')?.dataset.fehler === 'ja', null, { timeout: 8000 }).catch(() => {});
      await s.locator('.konto-gruppe [data-konto="code"]').scrollIntoViewIfNeeded();
      await ruhe(s);
      const m = await s.evaluate(() => {
        const r = (sel) => { const e = document.querySelector(sel); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect();
          return { o: Math.round(b.top), u: Math.round(b.bottom), b: Math.round(b.width) }; };
        return { status: r('.konto-gruppe .konto-status'), text: document.querySelector('.konto-gruppe .konto-status')?.textContent.trim() || '',
          code: r('.konto-gruppe [data-konto="code"]'), google: r('.konto-gruppe .konto-google'), oder: r('.konto-gruppe .konto-oder'),
          hinweis: r('.konto-gruppe .konto-botschutz-hinweis') };
      });
      const kb = await kontrastBefunde(s);
      pruefe(`A1 Konto ${geraet} ${schema}: Fehlertext da und lesbar (>= 4,5:1)`, !!m.text && !kontrastVon(kb, [m.text.slice(0, 30)]).length,
        { text: m.text, befunde: kontrastVon(kb, [m.text.slice(0, 30)]) });
      pruefe(`A2 Konto ${geraet} ${schema}: Meldung direkt unter "Code senden", vor "oder" und Google`, !!(m.status && m.code && m.google)
        && m.status.o >= m.code.u - 1 && m.status.o - m.code.u <= 16 && m.status.u <= m.google.o + 1 && (!m.oder || m.status.u <= m.oder.o + 1)
        && (!produktion || (!!m.hinweis && m.hinweis.u <= m.code.o + 1)), m);
      pruefe(`A3 Konto ${geraet} ${schema}: "Code senden" und Google gleich breit (${m.code?.b} / ${m.google?.b} px)`,
        !!(m.code && m.google) && Math.abs(m.code.b - m.google.b) <= 2, m);
      if (produktion) {
        // Hinweis 80 (R18-info-links): der Link im Bot-Schutz-Hinweis hat 13 px Polster; Mitte und Raender muessen ihn treffen
        const link = await s.evaluate(() => {
          const a = document.querySelector('.konto-gruppe .konto-botschutz-hinweis a');
          if (!a) return { fehlt: true };
          a.scrollIntoView({ block: 'center' });
          const falsch = [];
          for (const r of a.getClientRects()) {
            const punkte = [[0.5, 0.5], [0.25, 0], [0.5, 0], [0.75, 0], [0.25, 1], [0.5, 1], [0.75, 1], [0, 0.5], [1, 0.5]];
            for (const [fx, fy] of punkte) {
              const x = Math.min(r.right - 1, Math.max(r.left + 1, r.left + r.width * fx));
              const y = Math.min(r.bottom - 1, Math.max(r.top + 1, r.top + r.height * fy));
              const z = document.elementFromPoint(x, y);
              if (z !== a) falsch.push(`${Math.round(x)},${Math.round(y)} -> ${z?.className || z?.tagName}`);
            }
          }
          return { falsch, hoehe: Math.round(a.getBoundingClientRect().height) };
        });
        pruefe(`A2 Konto ${geraet}: Link im Bot-Schutz-Hinweis in Mitte und an allen Raendern getroffen (${link.hoehe} px hoch)`,
          !link.fehlt && link.falsch.length === 0 && link.hoehe >= 44, link);
      }
      if (schema === 'dunkel') await bild(s, `A-konto-${geraet.replace(/\s+/g, '').toLowerCase()}-${schema}`);
      pruefe(`Konto ${geraet} ${schema}: keine Seitenfehler`, !fehler.length, fehler);
      await k.close();
    }
  }

  // ---------- K: Lobby-Karte des Gegners ----------
  const FAELLE = [['pionier', { name: 'Rivale', titel: 'pionier-007', banner: 'start', elo: 1234, kronen_stufe: 6, vitrine: [{ familie: 'siege', stufe: 1 }] }],
    ['erfinder', { name: 'Maximilianus_2026', titel: 'erfinder', banner: 'start', kronen_stufe: 14 }]];
  for (const [geraet, width, height, touch] of [['iPhone SE', 375, 667, true], ['iPad hoch', 820, 1180, true], ['PC 1440', 1440, 900, false]]) {
    for (const schema of ['hell', 'dunkel']) {
      for (const [fall, roh] of FAELLE) {
        let start = 0;
        const rpc = (name) => {
          if (name === 'karte_der_partie') return { w: { du: true, name: 'Ich', banner: 'start' }, s: roh };
          if (name === 'online_suche_stand' && start && Date.now() - start > 500) return { partie: 'p1' };
          if (name === 'online_suche_start' || name === 'online_suche_stand') return { wartet: true };
          if (name === 'online_suche_ende') return {};
          return [];
        };
        const { k, s, fehler } = await seite(browser, { width, height }, { schema, touch, sitzung: true, erfinder: true, hash: 'lobby', rpc });
        await s.waitForSelector('.screen.lobby .lb-spielen', { timeout: 30000 });
        await warte(500);
        if (fall === 'pionier') {
          const v = await s.evaluate(() => {
            const l = document.querySelector('.lb-labor'), kn = [...document.querySelectorAll('.lb-modus-knopf')].filter((e) => e.getClientRects().length);
            const band = document.querySelector('.lb-modus')?.getBoundingClientRect();
            return { labor: l ? parseFloat(getComputedStyle(l).fontSize) : null, knoepfe: kn.map((e) => Math.round(e.getBoundingClientRect().height)),
              imBand: !!band && kn.every((e) => { const r = e.getBoundingClientRect(); return r.top >= band.top - 0.5 && r.bottom <= band.bottom + 0.5; }) };
          });
          pruefe(`K6 Lobby ${geraet} ${schema}: "Labor" mindestens 12 px (${v.labor})`, v.labor === null || v.labor >= 12, v);
          pruefe(`K6 Lobby ${geraet} ${schema}: Umschalter Welten/Online mindestens 44 px hoch (${v.knoepfe.join('/')})`, !touch || v.knoepfe.every((h) => h >= 44), v);
          pruefe(`K6 Lobby ${geraet} ${schema}: Knoepfe liegen ganz im Umschalter-Band`, v.imBand, v);
        }
        await s.evaluate(() => { window.__lobbyGefundenMs = 60000; });
        start = Date.now();
        await s.locator('.lb-suchen').click();
        await s.waitForFunction((n) => (document.querySelector('.lb-karte-gegner .vk-namenszeile')?.textContent || '').includes(n), roh.name, { timeout: 15000 }).catch(() => {});
        await warte(700); await ruhe(s);
        const m = await s.evaluate(() => {
          const g = document.querySelector('.lb-karte-gegner'); if (!g) return null;
          const lx = (e) => (e ? Math.round(e.getBoundingClientRect().left) : null);
          const t = g.querySelector('.vk-titel > span:last-child'); const st = t ? getComputedStyle(t) : null;
          return { text: g.textContent.replace(/\s+/g, ' ').trim(), wappen: !!g.querySelector('.vk-titel .vk-wappen, .vk-titel svg'),
            name: lx(g.querySelector('.vk-name')), krone: lx(g.querySelector('.vk-krone')), titel: t ? t.textContent.trim() : '',
            titelPx: st ? parseFloat(st.fontSize) : null, titelGewicht: st ? st.fontWeight : null };
        });
        const kb = await kontrastBefunde(s);
        const vs = kontrastVon(kb, ['VS']);
        pruefe(`K1 Lobby ${geraet} ${schema} (${fall}): "VS" lesbar (>= 4,5:1)`, !vs.length, vs);
        pruefe(`K2 Lobby ${geraet} ${schema} (${fall}): Sondertitel des Gegners mit Wappen`, !!m && m.wappen, m);
        const elo = /Elo\s*\d/.test(m?.text || '');
        pruefe(`K3 Lobby ${geraet} ${schema} (${fall}): Elo ${roh.elo ? 'des Gegners zu sehen' : 'fehlt ohne Server-Feld'}`,
          !!m && (roh.elo ? new RegExp(`Elo\\s*${roh.elo}`).test(m.text) : !elo), m?.text);
        pruefe(`K4 Lobby ${geraet} ${schema} (${fall}): Liga-Zeile buendig unter dem Namen`, !!m && m.krone !== null && Math.abs(m.krone - m.name) <= 1, m);
        const ti = kontrastVon(kb, [m?.titel || '\u0000', 'Der Erfinder']);
        pruefe(`K5 Lobby ${geraet} ${schema} (${fall}): Titel auf dem Banner lesbar (${m?.titelPx} px, Gewicht ${m?.titelGewicht})`, !ti.length, ti);
        await bild(s, `K-lobby-${fall}-${geraet.replace(/\s+/g, '').toLowerCase()}-${schema}`);
        pruefe(`Lobby ${geraet} ${schema} (${fall}): keine Seitenfehler`, !fehler.length, fehler);
        await k.close();
      }
    }
  }

  // ---------- I: Vitrine auf der Ich-Seite ----------
  for (const [geraet, width, height, touch] of [['PC 1440', 1440, 900, false], ['iPad quer', 1180, 820, true], ['iPad hoch', 820, 1180, true],
    ['iPhone 13', 390, 844, true]]) {
    for (const schema of ['hell', 'dunkel']) {
      const { k, s, fehler } = await seite(browser, { width, height }, { schema, touch, vitrine: ['stufe-siege', null, null] });
      await s.evaluate(() => window.__app.gehe('ich'));
      await s.waitForSelector('.pr-karte .pr-vitrine', { timeout: 15000 }).catch(() => {});
      for (let n = 0; n < 6; n++) {
        await warte(600);
        const w = s.locator('.st-moment .st-weiter');
        if (!(await w.count())) break;
        await w.first().click().catch(() => {});
      }
      await ruhe(s);
      const m = await s.evaluate(() => {
        const st = document.querySelector('.pr-vitrine .pr-orden-stufe'), h = document.querySelector('.pr-karte .pr-hilfe');
        const v = document.querySelector('.pr-vitrine')?.getBoundingClientRect(), hb = h && h.getClientRects().length ? h.getBoundingClientRect() : null;
        return { stufePx: st ? parseFloat(getComputedStyle(st).fontSize) : null, hilfe: h ? h.textContent.trim() : null,
          abstand: v && hb ? Math.round(hb.top - v.bottom) : null, sichtbar: !!hb };
      });
      const kb = await kontrastBefunde(s);
      pruefe(`I1 Ich ${geraet} ${schema}: Stufe in der Vitrine mindestens 12 px (${m.stufePx})`, m.stufePx !== null && m.stufePx >= 12, m);
      pruefe(`I2 Ich ${geraet} ${schema}: Erklaerung geraeteneutral`, !!m.hilfe && !/antippen|anklicken|tap\b|click/i.test(m.hilfe), m.hilfe);
      if (m.sichtbar) {
        pruefe(`I2 Ich ${geraet} ${schema}: Erklaerung direkt unter der Vitrine (${m.abstand} px)`, m.abstand !== null && m.abstand >= 0 && m.abstand <= 16, m);
        const h = kontrastVon(kb, [m.hilfe.slice(0, 30)]);
        pruefe(`I2 Ich ${geraet} ${schema}: Erklaerung lesbar`, !h.length, h);
      }
      if (schema === 'dunkel' && (geraet === 'PC 1440' || geraet === 'iPad hoch')) await bild(s, `I-ich-${geraet.replace(/\s+/g, '').toLowerCase()}-${schema}`);
      pruefe(`Ich ${geraet} ${schema}: keine Seitenfehler`, !fehler.length, fehler);
      await k.close();
    }
  }
  // en-Text der Erklaerung ebenso geraeteneutral (die App laeuft im Test deutsch)
  const texte = await readFile(new URL('../js/pakete/sammlung/texte.js', import.meta.url), 'utf8');
  const hilfen = [...texte.matchAll(/'profil\.vitrineHilfe': '([^']*)'/g)].map((x) => x[1]);
  pruefe(`I2 Erklaerung de und en geraeteneutral`, hilfen.length === 2 && hilfen.every((x) => !/antippen|anklicken|tap\b|click/i.test(x)), hilfen);

  // ---------- L1: Lektion, Aufgabe ganz sichtbar ----------
  for (const [geraet, width, height, touch] of [['iPhone SE', 375, 667, true], ['iPhone 13', 390, 844, true], ['iPad hoch', 820, 1180, true],
    ['PC', 1280, 800, false]]) {
    const { k, s, fehler } = await seite(browser, { width, height }, { touch });
    await s.evaluate(() => window.__app.gehe('lektion', { id: 'grundreihe' }));
    await s.waitForFunction(() => window.__lektion?.zustand().phase === 'intro', null, { timeout: 15000 }).catch(() => {});
    await ruhe(s);
    await s.locator('.ls-aktionen [data-a="los"]').click();
    await s.waitForFunction(() => window.__lektion?.zustand().phase === 'flo', null, { timeout: 10000 }).catch(() => {});
    await warte(600); await ruhe(s);
    const m = await s.evaluate(() => {
      const r = (e) => { if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return { o: b.top, u: b.bottom }; };
      const st = document.querySelector('.ls-screen .ls-status');
      const ziel = document.querySelector('.ls-screen .ls-zaehler > span'), h2 = document.querySelector('.ls-screen .ls-status h2');
      const a = r(document.querySelector('.ls-screen .ls-aktionen')), rumpf = r(document.querySelector('.ls-screen .ls-rumpf'));
      const sichtbar = (x) => { const b = r(x); const s = r(st); return !!(b && s && a && rumpf) && b.o >= s.o - 0.5 && b.u <= s.u + 0.5
        && b.u <= a.o + 0.5 && b.o >= rumpf.o - 0.5 && b.u <= innerHeight + 0.5; };
      return { ziel: ziel?.textContent.trim(), zielSichtbar: sichtbar(ziel), titelSichtbar: sichtbar(h2),
        karteRollt: st ? st.scrollHeight - st.clientHeight : null, polster: st ? parseFloat(getComputedStyle(st).paddingBottom) : 0, ziel_r: r(ziel), status_r: r(st), aktionen_r: a };
    });
    // die Karte darf nur um ihr unteres Polster rollen (iPad hoch schon vor R16: 8 px), der Text steht ganz im Bild
    pruefe(`L1 Lektion ${geraet}: Aufgabe "${m.ziel}" und Titel ganz sichtbar (Karte rollt ${m.karteRollt} px)`, m.zielSichtbar && m.titelSichtbar
      && m.karteRollt !== null && m.karteRollt <= m.polster + 1, m);
    await bild(s, `L-lektion-${geraet.replace(/\s+/g, '').toLowerCase()}`);
    pruefe(`Lektion ${geraet}: keine Seitenfehler`, !fehler.length, fehler);
    await k.close();
  }
} catch (e) { pruefe('Probe laeuft ohne Abbruch', false, e.stack); }
finally { await browser?.close(); await new Promise((r) => server.close(r)); }
console.log(`\n${ok}/${gesamt} bestanden`); process.exitCode = ok === gesamt ? 0 : 1;
