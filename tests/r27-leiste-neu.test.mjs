// Leiste L1 "Figurenlinie" (Flos Wahl 22.11.2026 aus L1/L2/L3, Vault R19-Auswahl/leiste-neu-r27): die normale Reiter-Leiste
// fuer alle, ohne Schalter (css/navigation.css). Geprueft auf iPhone SE (320), iPhone 13 (390), iPad quer (1180) und PC (1280),
// hell und dunkel: Figuren-Masken statt Spiel-Symbol, keine sichtbare Pille, kein Glas, deckender Grund; genau ein aktiver Reiter
// als massive Goldfigur; Symbole mindestens 3:1, Namen mindestens 4,5:1 gegen die Leiste; Tippflaechen mindestens 44 x 44;
// Leiste ganz im Bild, der Screen endet ueber ihr (nichts verdeckt), in der Partie ist sie weg und das Brett frei;
// "Bewegung aus" = Standbild. Funktionsprobe: alle vier Reiter antippen, Zurueck-Weg, Tastatur-Fokus. Ein alter
// ?design=-Wert aendert nichts mehr. Keine Seitenfehler.
//   node tests/r27-leiste-neu.test.mjs            (BROWSER=webkit fuer Safari)
// Playwright: PLAYWRIGHT_PFAD, sonst 'playwright', sonst /opt/node-tools/node_modules/playwright.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, fehler = 0;
function pruefe(name, gut, detail) {
  if (gut) ok++; else fehler++;
  console.log(`${gut ? 'ok    ' : 'FEHLER'} ${name}${!gut && detail !== undefined ? ' ' + JSON.stringify(detail) : ''}`);
}

async function oeffne(browser, { suche = '?test', hash = 'heim', breite, hoehe, modus = 'dunkel', bewegung = 'aus' }) {
  const k = await browser.newContext({ viewport: { width: breite, height: hoehe }, locale: 'de-DE' });
  await k.addInitScript(([m, b]) => {
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: b, modus: m }));
  }, [modus, bewegung]);
  const s = await k.newPage();
  const fehlerListe = [];
  s.on('pageerror', (e) => fehlerListe.push(e.message));
  await s.goto(`http://127.0.0.1:${PORT}/index.html${suche}#${hash}`);
  await s.waitForSelector('.reiter-leiste:not([hidden]) .reiter', { timeout: 20000 });
  await warte(400);
  return { k, s, fehlerListe };
}

const messe = (s) => s.evaluate(() => {
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  // color-mix() liefert color(srgb 0..1), rgb() 0..255
  const farbe = (t) => { const f = /^color\(srgb /.test(t) ? 255 : 1; const m = (t.match(/[\d.]+/g) || [0, 0, 0]).map(Number); return { r: m[0] * f, g: m[1] * f, b: m[2] * f, a: m.length > 3 ? m[3] : 1 }; };
  const L = (f) => 0.2126 * lin(f.r) + 0.7152 * lin(f.g) + 0.0722 * lin(f.b);
  const kr = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const box = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const nav = document.querySelector('.reiter-leiste');
  const ns = getComputedStyle(nav);
  const grund = farbe(ns.backgroundColor);
  const pille = nav.querySelector('.reiter-pille');
  const screen = document.querySelector('#app > .screen');
  return { lage: nav.dataset.lage, grundDeckend: grund.a === 1, glas: (ns.backdropFilter || ns.webkitBackdropFilter || 'none') !== 'none',
    pilleSichtbar: !!pille && getComputedStyle(pille).visibility !== 'hidden' && getComputedStyle(pille).display !== 'none',
    nav: box(nav), screen: box(screen), iw: innerWidth, ih: innerHeight, doc: document.scrollingElement.scrollWidth - innerWidth,
    reiter: [...nav.querySelectorAll('.reiter')].map((r) => {
      const vor = getComputedStyle(r, '::before');
      const sy = r.querySelector(':scope > .sy');
      const maske = vor.maskImage || vor.webkitMaskImage || 'none';
      const name = r.querySelector(':scope > span');
      return { name: r.dataset.reiter, an: r.classList.contains('an'), aktuell: r.getAttribute('aria-current') === 'page',
        sy: !!sy && getComputedStyle(sy).display !== 'none', maske: /url\(/.test(maske) ? maske.length + ':' + maske.slice(-40) : null,
        symbol: Math.round(kr(farbe(vor.backgroundColor), grund) * 10) / 10, schrift: Math.round(kr(farbe(getComputedStyle(r).color), grund) * 10) / 10,
        box: box(r), wortVoll: !!name && name.scrollWidth <= name.clientWidth + 0.5, uebergang: vor.transitionDuration + ',' + getComputedStyle(r).transitionDuration };
    }) };
});

const server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
let browser;
try {
  const ende = Date.now() + 10000;
  for (;;) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/index.html`); await r.arrayBuffer(); if (r.ok) break; } catch (e) { /* noch nicht da */ }
    if (Date.now() > ende) throw new Error('Server startet nicht');
    await warte(150);
  }
  browser = await browserTyp(pw).launch({ headless: true });

  const GERAETE = [['iPhone SE', 320, 568, 'unten'], ['iPhone 13', 390, 844, 'unten'], ['iPad quer', 1180, 820, 'seite'], ['PC', 1280, 800, 'seite']];
  for (const [geraet, breite, hoehe, sollLage] of GERAETE) for (const modus of ['hell', 'dunkel']) {
    const wer = `${geraet} ${modus}`;
    const { k, s, fehlerListe } = await oeffne(browser, { breite, hoehe, modus });
    const l = await messe(s);
    pruefe(`${wer}: Lage ${sollLage}`, l.lage === sollLage, l.lage);
    pruefe(`${wer}: vier Figuren-Masken statt Spiel-Symbol, Pille unsichtbar, kein Glas, Grund deckend`, l.reiter.length === 4
      && l.reiter.every((r) => r.maske && !r.sy) && !l.pilleSichtbar && !l.glas && l.grundDeckend, l);
    const an = l.reiter.filter((r) => r.an);
    const aus = l.reiter.filter((r) => !r.an);
    pruefe(`${wer}: genau ein aktiver Reiter (Start), als massive Figur (andere Maske als die Linien)`, an.length === 1 && l.reiter[0].an
      && l.reiter[0].aktuell && aus.every((r) => r.maske !== an[0].maske), l.reiter.map((r) => [r.name, r.an, r.maske]));
    pruefe(`${wer}: Symbole mindestens 3:1, Namen mindestens 4,5:1 gegen die Leiste`, l.reiter.every((r) => r.symbol >= 3 && r.schrift >= 4.5),
      l.reiter.map((r) => [r.name, r.symbol, r.schrift]));
    pruefe(`${wer}: Tippflaechen mindestens 44 x 44, Namen nicht abgeschnitten`, l.reiter.every((r) => r.box.w >= 44 && r.box.h >= 44 && r.wortVoll),
      l.reiter.map((r) => [r.name, Math.round(r.box.w), Math.round(r.box.h), r.wortVoll]));
    pruefe(`${wer}: Leiste ganz im Bild, kein waagrechter Ueberlauf`, l.nav.l >= 0 && l.nav.r <= l.iw && l.nav.t >= 0 && l.nav.b <= l.ih && l.doc <= 0, { nav: l.nav, doc: l.doc });
    pruefe(`${wer}: nichts verdeckt Inhalt (Screen endet ueber bzw. beginnt rechts der Leiste)`, sollLage === 'unten'
      ? l.screen.b <= l.nav.t + 0.5 : l.screen.l >= l.nav.r - 0.5, { s: l.screen, n: l.nav });
    if (sollLage === 'unten') pruefe(`${wer}: schmal und mittig (hoechstens 340 px)`, l.nav.w <= 340.5 && Math.abs(l.nav.l - (l.iw - l.nav.r)) <= 1, l.nav);
    // "Bewegung aus" setzt jede Dauer auf .01 ms (css/tokens.css html[data-bewegung="aus"])
    pruefe(`${wer}: Bewegung aus, Standbild (hoechstens 0,01 ms)`,
      l.reiter.every((r) => r.uebergang.split(',').every((d) => parseFloat(d) <= 0.00001)), l.reiter.map((r) => r.uebergang));
    pruefe(`${wer}: keine Seitenfehler`, fehlerListe.length === 0, fehlerListe);
    await k.close();
  }

  // Ein alter Probe-Wert aendert nichts mehr: dieselbe Leiste wie ohne
  {
    const a = await oeffne(browser, { breite: 390, hoehe: 844 });
    const b = await oeffne(browser, { suche: '?test&design=l2,l3', breite: 390, hoehe: 844 });
    const [la, lb] = [await messe(a.s), await messe(b.s)];
    pruefe('?test&design=l2,l3: Leiste gleich wie ohne Wert (Masken, Lage, Breite)', JSON.stringify(la.reiter.map((r) => r.maske)) === JSON.stringify(lb.reiter.map((r) => r.maske))
      && Math.round(la.nav.w) === Math.round(lb.nav.w) && la.lage === lb.lage, { a: la.nav, b: lb.nav });
    await a.k.close(); await b.k.close();
  }

  // Funktionsprobe iPhone 13: alle vier Reiter antippen, Zurueck-Weg; Partie: Leiste weg, Brett frei
  {
    const { k, s, fehlerListe } = await oeffne(browser, { breite: 390, hoehe: 844, modus: 'hell' });
    const weg = [];
    for (const [reiter, hash] of [['arena', '#arena'], ['bestenliste', '#bestenliste'], ['ich', '#ich'], ['heim', '#heim']]) {
      await s.locator(`.reiter-leiste [data-reiter="${reiter}"]`).click();
      await s.waitForFunction((h) => location.hash.startsWith(h), hash, { timeout: 10000 }).catch(() => {});
      await warte(300);
      const l = await messe(s);
      const an = l.reiter.filter((r) => r.an).map((r) => r.name);
      weg.push(`${reiter}:${an.join()}`);
      pruefe(`Antippen ${reiter}: ${hash}, genau dieser Reiter aktiv`, an.length === 1 && an[0] === reiter
        && (await s.evaluate(() => location.hash)).startsWith(hash), { an, hash: await s.evaluate(() => location.hash) });
    }
    // Zurueck-Weg: die Reiter sind Wurzeln; zurueck fuehrt der Knopf im Kopf aus einer Unterseite (Verlauf gehoert zu Ich)
    await s.locator('.reiter-leiste [data-reiter="ich"]').click();
    await s.waitForFunction(() => location.hash.startsWith('#ich'), null, { timeout: 10000 }).catch(() => {});
    await s.evaluate(() => window.__app.gehe('verlauf'));
    await s.waitForSelector('.screen.vl-screen');
    await warte(300);
    const u = await messe(s);
    pruefe('Unterseite Verlauf: Ich bleibt aktiv', u.reiter.find((r) => r.an)?.name === 'ich', u.reiter.filter((r) => r.an).map((r) => r.name));
    await s.locator('.vl-screen .kopf-zurueck').click();
    await s.waitForFunction(() => location.hash.startsWith('#ich') && !document.querySelector('.screen.vl-screen'), null, { timeout: 5000 }).catch(() => {});
    await warte(300);
    const z = await messe(s);
    pruefe('Zurueck-Knopf: wieder #ich, Ich aktiv', (await s.evaluate(() => location.hash)).startsWith('#ich') && z.reiter.find((r) => r.an)?.name === 'ich',
      { hash: await s.evaluate(() => location.hash), an: z.reiter.filter((r) => r.an).map((r) => r.name) });
    await s.evaluate(() => window.__app.gehe('partie', { botId: 'fridolin', farbe: 'w' }));
    await s.waitForSelector('.screen.partie .brett');
    await s.waitForFunction(() => document.querySelector('.reiter-leiste').hidden, null, { timeout: 3000 }).catch(() => {});
    const p = await s.evaluate(() => { const b = document.querySelector('.screen.partie .brett').getBoundingClientRect(); const n = document.querySelector('.reiter-leiste');
      return { weg: n.hidden, brettUnten: b.bottom, ih: innerHeight }; });
    pruefe('Partie: Leiste weg, Brett ganz im Bild', p.weg && p.brettUnten <= p.ih, p);
    pruefe('Funktionsprobe: keine Seitenfehler', fehlerListe.length === 0, fehlerListe);
    await k.close();
  }

  // Tastatur: Tab erreicht die Reiter, Fokusring sichtbar, Enter wechselt, der Fokus bleibt auf dem neuen aktiven Reiter
  for (const [breite, hoehe] of [[390, 844], [1180, 820]]) {
    const { k, s, fehlerListe } = await oeffne(browser, { breite, hoehe });
    await s.locator('.reiter-leiste [data-reiter="bestenliste"]').focus();
    await s.keyboard.press('Shift+Tab');
    await s.keyboard.press('Tab');
    const f = await s.evaluate(() => { const a = document.activeElement; const st = getComputedStyle(a);
      return { reiter: a.dataset.reiter || null, ring: st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) >= 2, sichtbar: a.matches(':focus-visible') }; });
    pruefe(`Tastatur ${breite}: Fokus auf Liga mit sichtbarem Ring`, f.reiter === 'bestenliste' && f.ring && f.sichtbar, f);
    await s.keyboard.press('Enter');
    await s.waitForFunction(() => location.hash.startsWith('#bestenliste'), null, { timeout: 10000 }).catch(() => {});
    await warte(200);
    pruefe(`Tastatur ${breite}: Enter oeffnet Liga, Fokus auf dem neuen aktiven Reiter`, await s.evaluate(() => {
      const a = document.activeElement; return !!a && a.matches('.reiter-leiste [data-reiter="bestenliste"].an[aria-current="page"]'); }));
    pruefe(`Tastatur ${breite}: keine Seitenfehler`, fehlerListe.length === 0, fehlerListe);
    await k.close();
  }
} finally {
  if (browser) await browser.close();
  server.kill();
}
console.log(`\n${ok}/${ok + fehler} Pruefungen bestanden`);
process.exit(fehler === 0 && ok > 0 ? 0 : 1);
