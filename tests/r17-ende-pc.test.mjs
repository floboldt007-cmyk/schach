// R17 Raetsel-Duell, Ende-Karte am PC (Auswahlseite R17 ende-pc): am PC sass die Ende-Karte oben, darunter bis zu
// 380 px Leere (Bild R17-Bilder/duell/raetsel-duell-pc-1440-hell-4-ende.png). Der Test oeffnet ein beendetes Duell
// direkt (Lauf im sessionStorage, duell_stand meldet "beendet") und misst:
//   - PC 1440x900 und 1920x1080 (Maus, kein Touch), hell und dunkel: Karte ganz im Bild ohne Scrollen, kein Querscrollen,
//     Leere unter der Karte hoechstens 30 % der Rumpfhoehe (Kernprobe; die Basis hatte 47 %)
//   - iPhone 13 (390x844) und iPad hoch/quer (820x1180, 1180x820), Touch, hell und dunkel: alle Masse der Ende-Karte
//     gleich wie mit der Basis-CSS (css/pakete/raetsel-duell.css aus BASIS_REF, im Browser per route eingesetzt)
//   node tests/r17-ende-pc.test.mjs                                  Pruefung
//   node tests/r17-ende-pc.test.mjs --bilder=<ordner> --name=<A|B|C>  dazu PC-Bilder (je Breite und Schema); mit
//     --name=basis werden die Bilder mit der Basis-CSS aufgenommen
//   --css=<commit>   die Variante aus diesem Commit messen (raetsel-duell.css per route), sonst der Arbeitsbaum
//   Dazu je PC-Breite ein Durchgang mit Namenszeile unter den Bildern ("Du", Gegnername): so/R17-ende-feinschliff setzt
//   sie ohne diese CSS, die Karte waechst dort von 431 auf 452 px. Hier nachgestellt (14 px, Zeile 21 px)
//   BASIS_REF=<commit> (Standard dbe3c55, feinschliff-20261111 vor R17 ende-pc)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').slice(n.length + 3) || null;
const BILDER = arg('bilder');
const NAME = arg('name') || 'variante';
const BASIS_REF = process.env.BASIS_REF || 'dbe3c55';
const BASIS_CSS = execFileSync('git', ['show', `${BASIS_REF}:css/pakete/raetsel-duell.css`], { cwd: WURZEL, encoding: 'utf8' });
const CSS_REF = arg('css');
const VARIANTE_CSS = CSS_REF ? execFileSync('git', ['show', `${CSS_REF}:css/pakete/raetsel-duell.css`], { cwd: WURZEL, encoding: 'utf8' }) : null;
if (BILDER) fs.mkdirSync(BILDER, { recursive: true });

let ok = 0; let fehler = 0;
function pruefe(name, wert, info = '') {
  if (wert) { ok++; console.log('ok   ' + name); } else { fehler++; console.log('FEHLER ' + name + ' ' + (typeof info === 'string' ? info : JSON.stringify(info))); }
}
function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}
async function warteAufServer(url, ms = 10000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) { try { if ((await fetch(url)).ok) return; } catch (e) { /* noch nicht */ } await new Promise((r) => setTimeout(r, 150)); }
  throw new Error('Server startet nicht: ' + url);
}

const SUPA = 'https://usaamcqypmvgqmsbfecb.supabase.co';
const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const token = (sub) => 'a.' + Buffer.from(JSON.stringify({ sub })).toString('base64url') + '.x';
const SITZUNG = { access_token: token(UID), refresh_token: 'r1', expires_at: 9999999999, user: { id: UID, email: 'probe@example.invalid' } };
const DUELL = '7d0c9a52-1b3e-4f6a-9c8d-2e1f0a9b8c7d';
const REIHE = ['g', 'g', 'r', 'g', 'g', 'r'];
// beendetes Duell gegen die KI wie duell_stand: 4 zu 2 geloest, +20 Kronen
const STAND = () => ({ duell: DUELL, art: 'ki', status: 'beendet', jetzt: new Date().toISOString(), start_am: new Date(Date.now() - 200000).toISOString(),
  ich: { geloest: 4, fehler: 2, ende_am: new Date(Date.now() - 20000).toISOString() },
  gegner: { geloest: 2, fehler: 0, ende_am: new Date(Date.now() - 20000).toISOString(), ki: true, elo: 1200 },
  raetsel: null, ergebnis: 'sieg', kronen_delta: 20 });

async function ende(browser, { breite, hoehe, schema, touch, basisCss, namen = false }) {
  const k = await browser.newContext({ viewport: { width: breite, height: hoehe }, serviceWorkers: 'block', hasTouch: touch, colorScheme: schema, deviceScaleFactor: 1 });
  const s = await k.newPage();
  const fehlerListe = [];
  s.on('pageerror', (e) => fehlerListe.push(e.message));
  const css = basisCss ? BASIS_CSS : VARIANTE_CSS;
  if (css) await s.route('**/css/pakete/raetsel-duell.css*', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: css }));
  await s.route(SUPA + '/**', (r) => {
    const name = (r.request().url().match(/\/rest\/v1\/rpc\/([a-z_]+)/) || [])[1];
    const body = name === 'duell_stand' ? STAND() : [];
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await s.addInitScript(({ sitzung, lauf }) => {
    try {
      if (sessionStorage.getItem('probe-start')) return;
      sessionStorage.setItem('probe-start', '1');
      localStorage.clear();
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
      sessionStorage.setItem('schach-arena:raetsel-duell:laufend', JSON.stringify({ ...lauf, um: Date.now() }));
    } catch (e) { /* egal */ }
  }, { sitzung: SITZUNG, lauf: { id: DUELL, reihe: REIHE } });
  await s.goto(`${BASIS}#raetsel-duell`);
  await s.waitForSelector('.screen.raetsel-duell[data-phase="beendet"] .rd-ende', { timeout: 8000 });
  // Einblendung der Karte ans Ende springen lassen, dann ruhen lassen (Fokus sitzt auf "Nochmal")
  await s.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) { /* unendlich */ } }));
  if (namen) {
    await s.evaluate(() => document.querySelectorAll('.rd-ende-wer').forEach((w, i) => w.insertAdjacentHTML('beforeend',
      `<span class="probe-name" style="font-size:14px;line-height:21px;font-weight:700">${i ? 'Kira' : 'Du'}</span>`)));
  }
  await s.waitForTimeout(250);
  return { k, s, fehlerListe };
}

// alle Kaesten der Ende-Karte samt Schriftgroesse, ganzzahlig gerundet
const masse = (s) => s.evaluate(() => {
  const r = (e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
  const karte = document.querySelector('.rd-ende');
  return [document.querySelector('.rd-rumpf'), karte, ...karte.querySelectorAll('*')]
    .map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')} ${r(e).join(',')} ${getComputedStyle(e).fontSize}`);
});

const pw = ladePlaywright();
const server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
let browser;
try {
  await warteAufServer(`http://127.0.0.1:${PORT}/index.html`);
  browser = await browserTyp(pw).launch({ headless: true });

  // 1. PC: Karte im Bild, keine Leere-Wueste darunter
  for (const [breite, hoehe] of [[1440, 900], [1920, 1080]]) {
    for (const [schema, namen] of [['light', false], ['dark', false], ['light', true]]) {
      const g = `PC ${breite}x${hoehe} ${schema === 'dark' ? 'dunkel' : 'hell'}${namen ? ' mit Namenszeile' : ''}`;
      const { k, s, fehlerListe } = await ende(browser, { breite, hoehe, schema, touch: false, basisCss: NAME === 'basis', namen });
      const m = await s.evaluate(() => {
        const rumpf = document.querySelector('.rd-rumpf').getBoundingClientRect();
        const karte = document.querySelector('.rd-ende').getBoundingClientRect();
        const knoepfe = [...document.querySelectorAll('.rd-ende .rd-knoepfe > *')].map((e) => e.getBoundingClientRect());
        const sc = document.querySelector('.rd-rumpf');
        return { kartenH: karte.height, rumpfOben: rumpf.top, rumpfH: rumpf.height, oben: karte.top, unten: karte.bottom, links: karte.left, rechts: karte.right,
          leereUnten: rumpf.bottom - karte.bottom, knoepfeImBild: knoepfe.every((b) => b.bottom <= innerHeight && b.top >= 0),
          scrollt: sc.scrollHeight > sc.clientHeight + 1, quer: document.documentElement.scrollWidth > innerWidth,
          maus: matchMedia('(hover: hover) and (pointer: fine)').matches };
      });
      pruefe(`${g}: Maus erkannt (hover und pointer fine)`, m.maus, m);
      pruefe(`${g}: Karte ganz im Bild, Knoepfe sichtbar, kein Scrollen, kein Querscrollen`,
        m.oben >= m.rumpfOben && m.unten <= hoehe && m.knoepfeImBild && !m.scrollt && !m.quer, m);
      if (NAME !== 'basis') {
        pruefe(`${g}: Leere unter der Karte hoechstens 30 % der Rumpfhoehe (${Math.round(m.leereUnten)} von ${Math.round(m.rumpfH)} px)`,
          m.leereUnten <= m.rumpfH * 0.3, m);
      }
      pruefe(`${g}: keine Seitenfehler`, fehlerListe.length === 0, fehlerListe);
      if (namen) pruefe(`${g}: Namenszeile macht die Karte hoeher (${Math.round(m.kartenH)} px)`, m.kartenH > 440, m);
      if (BILDER) await s.screenshot({ path: path.join(BILDER, `raetsel-duell-ende-${NAME}-pc-${breite}-${schema === 'dark' ? 'dunkel' : 'hell'}${namen ? '-namen' : ''}.png`) });
      await k.close();
    }
  }

  // 2. iPhone 13 und iPad: Masse gleich wie mit der Basis-CSS
  for (const [geraet, breite, hoehe] of [['iPhone 13', 390, 844], ['iPad hoch', 820, 1180], ['iPad quer', 1180, 820]]) {
    for (const schema of ['light', 'dark']) {
      const g = `${geraet} ${schema === 'dark' ? 'dunkel' : 'hell'}`;
      const neu = await ende(browser, { breite, hoehe, schema, touch: true, basisCss: false });
      const alt = await ende(browser, { breite, hoehe, schema, touch: true, basisCss: true });
      const [a, b] = [await masse(neu.s), await masse(alt.s)];
      const anders = a.map((z, i) => (z === b[i] ? null : `${z}  statt  ${b[i]}`)).filter(Boolean);
      pruefe(`${g}: Ende-Karte gleich wie die Basis ${BASIS_REF} (${a.length} Kaesten)`, a.length === b.length && anders.length === 0 && a.length > 10,
        { neu: a.length, basis: b.length, anders: anders.slice(0, 4) });
      await neu.k.close(); await alt.k.close();
    }
  }
} finally {
  if (browser) await browser.close();
  server.kill();
}
console.log(`\n${fehler} FEHLER | ${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
