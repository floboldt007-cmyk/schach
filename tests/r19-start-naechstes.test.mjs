// Feinschliff R19 Start "Als Naechstes" (Flo 15.11.2026: "sieht gleich und herzlos aus"): jede Zeile bekommt ihr eigenes
// Gesicht (eigene Farbe --ton, eigenes Bildstueck) und sichtbaren, WAHREN Fortschritt:
//   Bauernmarsch  Feld von 6 bis zur Umwandlung (serie/tag.js lage().feld)
//   Tagesraetsel  die letzten 7 Tage, geloest oder nicht (tagesraetsel/logik.js tagStand)
//   Fehler        faellige Karten als Zaehler (kartei)
//   Liga          Stufen-Wappen assets/liga/<liga>.svg; Abstand nur aus ziel (Kronen auf Platz 5, Server) und kronen
// Hoehe: auf dem iPhone SE jede Zeile hoechstens 16 px hoeher als vorher (BASIS_SE), am PC bleibt sichtbar, was vorher im
// ersten Bildschirm stand (BASIS_PC). Beide Grundwerte sind auf e9abb82 gemessen (rot-e9abb82.log).
//   node tests/r19-start-naechstes.test.mjs
//   node tests/r19-start-naechstes.test.mjs --bilder=<ordner> --name=vorher|nachher [--varianten]
//   node tests/r19-start-naechstes.test.mjs --speicher=<datei.js>    Vorlauf fuer design-beweis (Stand wie im Test)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { browserTyp } from './browser.mjs';
import { tagSchluessel, addiereTage } from '../js/tag.js';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : ''; };
const BILDER = arg('bilder');
const NAME = arg('name') || 'nachher';
const VARIANTEN = process.argv.includes('--varianten');
const SPEICHER_DATEI = arg('speicher');
if (BILDER) mkdirSync(BILDER, { recursive: true });
const P = 'schach-arena:v1:';
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

// Grundwerte auf e9abb82 (vor dem Umbau), gemessen mit diesem Test (rot-e9abb82.log, Zeile "MESSUNG")
// (SE zeigt nach css/heim.css bei 667 px Hoehe nur zwei Zeilen; die verborgenen haben keine Hoehe und zaehlen nicht)
const BASIS_SE = { serie: { h: 59 }, tagesraetsel: { h: 60 } };
const ALLE_VIER = { serie: { sichtbar: true }, tagesraetsel: { sichtbar: true }, kartei: { sichtbar: true }, 'heim-liga': { sichtbar: true } };
const BASIS_PC = { pc: ALLE_VIER, pcklein: ALLE_VIER };

const ergebnisse = [];
let gruppe = '';
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name: (gruppe ? gruppe + ': ' : '') + name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FEHLER'} ${gruppe ? gruppe + ': ' : ''}${name}${!ok && detail ? ' (' + detail + ')' : ''}`);
}

function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}

async function warteAufServer(url, ms = 15000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try { const r = await fetch(url); await r.arrayBuffer(); if (r.ok) return; } catch (e) { /* noch nicht da */ }
    await warte(150);
  }
  throw new Error('Server startet nicht: ' + url);
}

// ---------- Stand: ein Spieler mitten in der Woche ----------
const heute = tagSchluessel(new Date());
const tag = (d) => addiereTage(heute, d);
const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const SITZUNG = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'r1',
  expires_at: 9999999999, user: { id: UID, email: 'probe@example.invalid' } };
// Stufe 2 = Squire I (bauer, Rang I); Platz 9, Platz 5 hat 160 Kronen, der Spieler 64 -> 96 Kronen hinter Platz 5
const STAND = { stufe: 2, kronen: 64, platz: 9, ziel: 160, n: 30, woche: tag(-2) };
// Bauernmarsch: gestern gespielt, 3 Felder gegangen (Feld 3 von 6), heute noch offen
const SERIE = { stand: 1, tage: [tag(-1)], letzter: tag(-1), aktuell: 1, gesamt: 1, best: 1, felder: 3 };
// Tagesraetsel der letzten 7 Tage: vorgestern und gestern geloest, vor 3 Tagen falsch, sonst nichts; heute offen -> 2 von 7
const RAETSEL = { v: 1, tage: { [tag(-3)]: { e: [[2, 0]] }, [tag(-2)]: { e: [[0, 1]] }, [tag(-1)]: { e: [[1, 1]] } } };
const FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
const karte = (i) => ({ id: `pb${i}x:0`, fen: FEN, besterZug: 'f3e5', gespielt: 'a2a3', klasse: 'patzer', partieId: `pb${i}x`, ply: 0,
  botId: 'rudi', farbe: 'w', vor: null, san: 'a3', loesungSan: 'Sxe5', nummer: 3, coach: 'Probe', datum: heute, gewinn: 0.6, verlust: 0.4,
  stufe: 0, faellig: tag(-1), erstellt: tag(-1), geuebt: '', richtig: 0, falsch: 0, rueckfaelle: 0 });
// 4 faellige Fehler-Karten
const KARTEI = { v: 1, karten: [0, 1, 2, 3].map(karte), verarbeitet: [], heute: { tag: '', ids: [] }, zaehler: { erstellt: 4, gemeistert: 0, richtig: 0, falsch: 0 } };
const BOSSE = { v: 1, trophäen: ['bergwirt', 'baron-gambit', 'springerzuechterin', 'festungsbauer'] };
const SPEICHER = {
  [P + 'modul:start']: { gesehen: heute }, [P + 'modul:boss']: BOSSE, [P + 'modul:serie']: SERIE,
  [P + 'modul:tagesraetsel']: RAETSEL, [P + 'modul:kartei']: KARTEI,
  [P + 'modul:kronen']: { konto: UID, stand: STAND, startGemeldet: true },
};

async function kontoSeite(browser, { stand = STAND, w = 390, h = 844, schema = 'light', speicher = SPEICHER, bewegung = 'reduce' } = {}) {
  const kontext = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: schema, deviceScaleFactor: 1, hasTouch: w < 900,
    serviceWorkers: 'block', reducedMotion: bewegung, locale: 'de-DE' });
  const seite = await kontext.newPage();
  const fehler = [];
  seite.on('pageerror', (e) => fehler.push('pageerror: ' + e.message));
  seite.on('console', (m) => { if (m.type() === 'error' && !/favicon|404|Failed to load resource/.test(m.text())) fehler.push('console: ' + m.text()); });
  await seite.route('**/*.supabase.co/**', (r) => {
    if (r.request().url().includes('/rpc/kronen_mein_stand')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stand) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await seite.addInitScript(({ sitzung, speicher }) => {
    if (sessionStorage.getItem('sn-probe')) return;
    sessionStorage.setItem('sn-probe', '1');
    localStorage.clear();
    localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
    for (const [k, v] of Object.entries(speicher)) localStorage.setItem(k, JSON.stringify(v));
  }, { sitzung: SITZUNG, speicher });
  await seite.goto(BASIS + '#heim');
  await seite.waitForFunction(() => document.documentElement.dataset.screen === 'heim', null, { timeout: 20000 });
  // alle vier Zeilen da (das Tagesraetsel laedt seine Daten nach, die Liga kommt vom Server)
  await seite.waitForFunction(() => ['serie', 'tagesraetsel', 'kartei'].every((p) => document.querySelector(`.heim-naechstes [data-paket="${p}"]`))
    && document.querySelector('.heim-naechstes [data-aktion="heim-liga"]'), null, { timeout: 10000 }).catch(() => {});
  await warte(300);
  return { kontext, seite, fehler };
}

// Messung der Spalte: je Zeile Gesicht, Fortschritt, Hoehe, Lage
const messe = (seite) => seite.evaluate(() => {
  const zeilen = [...document.querySelectorAll('.heim-naechstes .heim-zeile')];
  const schluessel = (z) => z.dataset.paket || z.dataset.aktion;
  const r = {};
  for (const z of zeilen) {
    const cs = getComputedStyle(z);
    const bild = z.querySelector('.heim-zeile-bild');
    const bcs = bild ? getComputedStyle(bild) : null;
    const f = z.querySelector('.heim-zeile-fortschritt');
    const b = z.getBoundingClientRect();
    r[schluessel(z)] = {
      ton: cs.getPropertyValue('--ton').trim(),
      bildGrund: bcs ? bcs.backgroundImage + ' ' + bcs.backgroundColor : '',
      img: bild && bild.querySelector('img') ? bild.querySelector('img').getAttribute('src') : null,
      art: f ? f.dataset.art : null,
      schritte: f ? f.querySelectorAll('.heim-schritt').length : 0,
      an: f ? f.querySelectorAll('.heim-schritt.an').length : 0,
      ftext: f ? f.textContent.replace(/\s+/g, ' ').trim() : '',
      text: [...z.querySelectorAll('.heim-zeile-text > *')].map((e) => e.textContent.trim()).join(' | '),
      aria: z.getAttribute('aria-label') || '',
      h: Math.round(b.height), oben: Math.round(b.top), unten: Math.round(b.bottom),
    };
  }
  return { zeilen: r, reihe: zeilen.map(schluessel), ih: innerHeight, iw: innerWidth, scrollW: document.documentElement.scrollWidth };
});

async function testeGesichter(browser) {
  gruppe = 'Gesichter';
  const { kontext, seite, fehler } = await kontoSeite(browser);
  const m = await messe(seite);
  const z = m.zeilen;
  pruefe('vier Zeilen: Bauernmarsch, Tagesraetsel, Fehler, Liga', ['serie', 'tagesraetsel', 'kartei', 'heim-liga'].every((k) => z[k]), m.reihe.join());
  const toene = ['serie', 'tagesraetsel', 'kartei', 'heim-liga'].map((k) => z[k]?.ton || '');
  pruefe('jede Zeile hat ihre eigene Farbe (--ton, vier verschiedene)', toene.every(Boolean) && new Set(toene).size === 4, toene.join(' / '));
  const gruende = ['serie', 'tagesraetsel', 'kartei'].map((k) => z[k]?.bildGrund || '');
  pruefe('jedes Bildstueck hat seinen eigenen Grund (nicht dreimal derselbe Kreis)', new Set(gruende).size === 3, gruende.join(' / '));

  gruppe = 'Bauernmarsch';
  pruefe('Fortschritt: 6 Felder, 3 gegangen', z.serie?.art === 'schritte' && z.serie.schritte === 6 && z.serie.an === 3, JSON.stringify(z.serie));
  pruefe('Beschriftung nennt den Weg: "noch 3 Felder bis zur Umwandlung"', /noch 3 Felder bis zur Umwandlung/.test(z.serie?.aria || ''), z.serie?.aria);

  gruppe = 'Tagesraetsel';
  pruefe('Fortschritt: die letzten 7 Tage, 2 geloest', z.tagesraetsel?.art === 'schritte' && z.tagesraetsel.schritte === 7 && z.tagesraetsel.an === 2,
    JSON.stringify(z.tagesraetsel));
  pruefe('Beschriftung: "2 der letzten 7 Tage gelöst"', /2 der letzten 7 Tage gelöst/.test(z.tagesraetsel?.aria || ''), z.tagesraetsel?.aria);

  gruppe = 'Fehler';
  pruefe('Zaehler zeigt 4 faellige Fehler', z.kartei?.art === 'zaehler' && z.kartei.ftext === '4', JSON.stringify(z.kartei));

  gruppe = 'Liga';
  pruefe('Bildstueck ist das Stufen-Wappen assets/liga/bauer.svg', /assets\/liga\/bauer\.svg$/.test(z['heim-liga']?.img || ''), z['heim-liga']?.img);
  pruefe('Stufe und Platz bleiben: "Squire I | Platz 9 von 30"', z['heim-liga']?.text === 'Squire I | Platz 9 von 30', z['heim-liga']?.text);
  pruefe('Abstand aus ziel und kronen: 96 Kronen hinter Platz 5', z['heim-liga']?.art === 'abstand' && /^96\b/.test(z['heim-liga'].ftext)
    && /96 Kronen hinter Platz 5/.test(z['heim-liga'].aria), JSON.stringify(z['heim-liga']));
  pruefe('keine Seitenfehler', fehler.length === 0, fehler.join(' | '));
  await kontext.close();

  // Aufstiegsplatz: keine Abstands-Zahl, sondern "Aufstiegsplatz"
  const auf = await kontoSeite(browser, { stand: { ...STAND, platz: 4, kronen: 180 } });
  const a = (await messe(auf.seite)).zeilen['heim-liga'];
  pruefe('Platz 4: "Aufstiegsplatz", keine Zahl', a?.art === 'abstand' && a.ftext === 'Aufstiegsplatz' && /Aufstiegsplatz/.test(a.aria), JSON.stringify(a));
  await auf.kontext.close();
  // ohne Gruppe (ziel und platz null): keine Zahl, die man nicht kennt
  const ohne = await kontoSeite(browser, { stand: { ...STAND, platz: null, ziel: null, kronen: 0 },
    speicher: { ...SPEICHER, [P + 'modul:kronen']: { konto: UID, stand: { ...STAND, platz: null, ziel: null, kronen: 0 }, startGemeldet: true } } });
  const o = (await messe(ohne.seite)).zeilen['heim-liga'];
  pruefe('ohne Gruppe: Wappen ja, keine Abstands-Zahl', o && /assets\/liga\/bauer\.svg$/.test(o.img || '') && !o.art && !/\d+ Kronen hinter/.test(o.aria), JSON.stringify(o));
  await ohne.kontext.close();
  // Bauernmarsch mit offener Umwandlung: alle 6 Felder gegangen
  const wahl = await kontoSeite(browser, { speicher: { ...SPEICHER, [P + 'modul:serie']: { ...SERIE, felder: 6, figuren: '?' } } });
  const w = (await messe(wahl.seite)).zeilen.serie;
  pruefe('Bauernmarsch mit offener Umwandlung: 6 von 6 Feldern', w?.schritte === 6 && w.an === 6, JSON.stringify(w));
  await wahl.kontext.close();
}

// Hoehe: SE je Zeile hoechstens +16 px, PC alles weiter im ersten Bildschirm
async function testeHoehe(browser) {
  gruppe = 'Hoehe';
  const geraete = { se: [375, 667], pc: [1440, 900], pcklein: [1280, 720] };
  const mess = {};
  for (const [n, [w, h]] of Object.entries(geraete)) {
    const { kontext, seite } = await kontoSeite(browser, { w, h });
    const m = await messe(seite);
    mess[n] = Object.fromEntries(Object.entries(m.zeilen).map(([k, v]) => [k, { h: v.h, sichtbar: v.h > 0 && v.unten <= m.ih }]));
    pruefe(`${n}: kein waagerechter Ueberlauf`, m.scrollW <= m.iw, `${m.scrollW} > ${m.iw}`);
    await kontext.close();
  }
  console.log('MESSUNG ' + JSON.stringify(mess));
  if (!BASIS_SE || !BASIS_PC) { pruefe('Grundwerte BASIS_SE und BASIS_PC aus e9abb82 eingetragen', false, 'erst messen'); return; }
  for (const [k, v] of Object.entries(BASIS_SE)) {
    pruefe(`SE ${k}: hoechstens 16 px hoeher (vorher ${v.h})`, mess.se[k] && mess.se[k].h > 0 && mess.se[k].h <= v.h + 16, JSON.stringify(mess.se[k]));
  }
  pruefe('SE: dieselben zwei Zeilen sichtbar wie vorher', Object.keys(mess.se).filter((k) => mess.se[k].h > 0).join() === Object.keys(BASIS_SE).join(),
    JSON.stringify(mess.se));
  for (const n of ['pc', 'pcklein']) {
    for (const [k, v] of Object.entries(BASIS_PC[n])) {
      if (v.sichtbar) pruefe(`${n} ${k}: bleibt im ersten Bildschirm`, mess[n][k]?.sichtbar === true, JSON.stringify(mess[n][k]));
    }
  }
}

// ---------- Bilder (vorher/nachher, Varianten) ----------
const GERAETE = [['iphone13', 390, 844], ['se', 375, 667], ['ipad-hoch', 820, 1180], ['ipad-quer', 1180, 820], ['pc', 1440, 900]];
// Varianten nur fuers Bild (Flo waehlt): B kraeftiger Farbgrund je Zeile, C grosse Kacheln
const VARIANTE = {
  b: `.heim-naechstes .heim-zeile { background: linear-gradient(90deg, color-mix(in srgb, var(--ton) 22%, transparent), transparent 70%); }`,
  c: `.heim-naechstes .heim-zeile-bild { width: 52px; height: 52px; border-radius: 14px; } .heim-naechstes .heim-zeile-bild svg { width: 28px; height: 28px; }
      .heim-naechstes .heim-zeile-bild img { width: 46px; height: 46px; } .heim-naechstes .heim-zeile { padding-block: 10px; }`,
};
async function machBilder(browser) {
  let n = 0;
  for (const [g, w, h] of GERAETE) {
    for (const schema of ['light', 'dark']) {
      const { kontext, seite } = await kontoSeite(browser, { w, h, schema });
      const datei = (zusatz) => path.join(BILDER, `${zusatz}-${g}-${schema === 'light' ? 'hell' : 'dunkel'}.png`);
      await seite.screenshot({ path: datei(NAME) }); n++;
      if (VARIANTEN) {
        for (const [v, css] of Object.entries(VARIANTE)) {
          const tag = await seite.addStyleTag({ content: css });
          await warte(150);
          await seite.screenshot({ path: datei(`variante-${v}`) }); n++;
          await tag.evaluate((e) => e.remove());
        }
      }
      await kontext.close();
    }
  }
  pruefe(`Bilder geschrieben (${n})`, n === GERAETE.length * 2 * (VARIANTEN ? 3 : 1), BILDER);
}

// Vorlauf fuer design-beweis: derselbe Stand ohne Netz (kronen_mein_stand antwortet lokal)
function schreibeVorlauf() {
  const js = `// erzeugt von tests/r19-start-naechstes.test.mjs --speicher
(() => {
  if (!sessionStorage.getItem('sn-vorlauf')) {
    sessionStorage.setItem('sn-vorlauf', '1');
    localStorage.clear();
    localStorage.setItem('schach-arena:konto:sitzung', ${JSON.stringify(JSON.stringify(SITZUNG))});
    for (const [k, v] of ${JSON.stringify(Object.entries(SPEICHER).map(([k, v]) => [k, JSON.stringify(v)]))}) localStorage.setItem(k, v);
  }
  document.documentElement.dataset.modus = 'system';
  const echt = window.fetch.bind(window);
  window.fetch = (u, o) => {
    const url = String(u && u.url ? u.url : u);
    if (!url.includes('.supabase.co')) return echt(u, o);
    const body = url.includes('/rpc/kronen_mein_stand') ? ${JSON.stringify(JSON.stringify(STAND))} : '[]';
    return Promise.resolve(new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } }));
  };
})();
`;
  writeFileSync(SPEICHER_DATEI, js);
  pruefe('Vorlauf geschrieben', true, SPEICHER_DATEI);
}

// ---------- Ablauf ----------
const server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
let browser;
let code = 1;
const t0 = Date.now();
try {
  await warteAufServer(`http://127.0.0.1:${PORT}/index.html`);
  browser = await browserTyp(ladePlaywright()).launch({ headless: true });
  if (SPEICHER_DATEI) schreibeVorlauf();
  if (BILDER) await machBilder(browser);
  else { await testeGesichter(browser); await testeHoehe(browser); }
  code = 0;
} catch (e) {
  pruefe('Ablauf ohne Abbruch', false, e.stack);
} finally {
  await browser?.close();
  server.kill();
}
const fehlend = ergebnisse.filter((e) => !e.ok);
console.log(`\n${ergebnisse.length - fehlend.length}/${ergebnisse.length} bestanden in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
for (const f of fehlend) console.log('FEHLER: ' + f.name + (f.detail ? ' (' + f.detail + ')' : ''));
process.exitCode = code === 0 && fehlend.length === 0 ? 0 : 1;
