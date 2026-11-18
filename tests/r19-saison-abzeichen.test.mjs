// R19 Season-Abzeichen (Flo 15.11.2026 13:45: "das Abzeichen und Symbol kann schon etwas groesser sein ... hat ja Bedeutung"
// und "man muss auch irgendwo die Ligen nachschlagen koennen"). Prueft im Browser (Server nachgebildet wie tests/r19-saison):
//   1. Saison-Karte: Fortschrittsbalken "Woche 3 von 8", grosses Wappen der besten Stufe, Abzeichen-Kacheln mit Mindestgroesse,
//      Hilfetext lesbar (Fliesstextgroesse, Kontrast >= 4,5:1) und kurz, Titelwahl mit Haken und Vorschau auf der Karte
//   2. "Alle Ligen": per Tastatur vom eigenen Wappen erreichbar, 18 Stufen von Crownmate I bis Squire III mit Symbol, die
//      aktuelle Stufe markiert, Season-Regel; Escape schliesst; dasselbe ueber das Abzeichen und den Link in der Liga
//   3. Fenster "Season 1 ist vorbei": Abzeichen gross oben, Titel als Chips, Startstufe kleiner, am PC breit genug,
//      Auftritt nur ohne "reduzierte Bewegung"
//   4. Gegnerkarte: Abzeichen mit Symbol gut lesbar, leere Vitrine nur auf der eigenen Karte
//   PORT=9632 node tests/r19-saison-abzeichen.test.mjs
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

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
const root = WURZEL + path.sep;
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png' };
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
const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const SITZUNG = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'r1',
  expires_at: 9999999999, user: { id: UID, email: 'probe@example.invalid' } };

// Season 2, Woche 3 von 8, aktuell Stufe 14 (Sovereign I), Season 1 mit Crownmate I beendet
const LAUF = { saison: 2, start: '2027-03-01', woche: 3, wochen: 8, ende: '2027-04-25', bisher: 11, stufe: 14,
  abzeichen: [{ saison: 1, stufe: 17 }], titel: ['crownmaster-s1', 'top100-s1'], gewaehlt: null };
const STUFEN = ['Crownmate', 'Sovereign', 'Baron', 'Warden', 'Knight', 'Squire'].flatMap((n) => ['I', 'II', 'III'].map((r) => `${n} ${r}`));

async function neueSeite(browser, { stand = LAUF, konto = true, hash = '#ich', breite = 390, hoehe = 844, bewegung = 'no-preference', gesehen = false } = {}) {
  const kontext = await browser.newContext({ viewport: { width: breite, height: hoehe }, serviceWorkers: 'block', reducedMotion: bewegung });
  const seite = await kontext.newPage();
  const fehler = [];
  seite.on('pageerror', (e) => fehler.push('pageerror: ' + e.message));
  seite.on('console', (m) => { if (m.type() === 'error' && !/favicon|404|Failed to load resource|ERR_FAILED|Load failed/.test(m.text())) fehler.push('console: ' + m.text()); });
  await seite.route('**/*', (r) => {
    const url = r.request().url();
    if (url.startsWith(`http://127.0.0.1:${PORT}/`)) return r.continue();
    if (!url.startsWith(SUPA)) return r.abort();
    if (url.includes('/rpc/saison_mein_stand')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stand) });
    if (url.includes('/rpc/saison_titel_waehle')) return r.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await seite.addInitScript(({ sitzung, konto, uid, gesehen }) => {
    if (sessionStorage.getItem('abz-probe')) return;
    sessionStorage.setItem('abz-probe', '1');
    localStorage.clear();
    localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
    if (gesehen) localStorage.setItem('schach-arena:v1:season-gesehen', JSON.stringify({ [uid]: 1 }));
    if (konto) localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
  }, { sitzung: SITZUNG, konto, uid: UID, gesehen });
  await seite.goto(BASIS + hash);
  await seite.waitForFunction(() => !!window.__app, null, { timeout: 20000 });
  return { kontext, seite, fehler };
}
const warteLeiste = (seite) => seite.waitForFunction(() => { const el = document.querySelector('.ss-leiste'); return el && !el.hidden; }, null, { timeout: 8000 })
  .then(() => true, () => false);

// Kontrast Text gegen die erste deckende Flaeche darunter (WCAG-Formel), im Browser gerechnet
const KONTRAST = `(el) => {
  const rgb = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const v = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number);
    return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
  const lum = (c) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  let grund = null;
  for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c && c.a >= 0.99) { grund = c; break; } }
  grund = grund || { r: 255, g: 255, b: 255 };
  const t = rgb(getComputedStyle(el).color);
  const a = lum(t), b = lum(grund);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}`;

const blattLigen = (seite) => seite.evaluate(() => {
  const b = document.querySelector('.sheet-karte.ss-ligen-blatt');
  if (!b) return null;
  const st = [...b.querySelectorAll('.ss-ligen-stufe')];
  return { titel: b.querySelector('h3')?.textContent.trim(), namen: st.map((x) => x.querySelector('.ss-ligen-name')?.textContent.trim()),
    symbole: st.map((x) => { const i = x.closest('.ss-ligen-liga')?.querySelector('img'); return i ? Math.round(i.getBoundingClientRect().width) : 0; }),
    aktuell: st.filter((x) => x.getAttribute('aria-current') === 'true').map((x) => x.querySelector('.ss-ligen-name')?.textContent.trim()),
    saetze: [...b.querySelectorAll('.ss-ligen-satz')].map((x) => x.textContent.trim()).filter(Boolean).length,
    regel: b.querySelector('.ss-ligen-regel')?.textContent.replace(/\s+/g, ' ').trim() || '', fokusDrin: b.contains(document.activeElement) };
});

const browser = await browserTyp(pw).launch({ headless: true });
try {
  { // 1 + 2: Saison-Karte und "Alle Ligen" per Tastatur
    const { kontext, seite, fehler } = await neueSeite(browser, { gesehen: true });
    pruefe('Saison-Karte erscheint', await warteLeiste(seite));
    const karte = await seite.evaluate(`(() => {
      const k = ${KONTRAST};
      const el = document.querySelector('.ss-leiste');
      const balken = el.querySelector('.ss-fortschritt');
      const fuell = balken && balken.firstElementChild;
      const bisher = el.querySelector('.ss-bisher img');
      const abz = [...el.querySelectorAll('.ss-abzeichen img')];
      const hilfe = el.querySelector('.ss-hilfe');
      return {
        balken: balken ? [balken.getAttribute('role'), balken.getAttribute('aria-valuenow'), balken.getAttribute('aria-valuemax'), balken.getAttribute('aria-valuetext')] : null,
        anteil: balken && fuell ? fuell.getBoundingClientRect().width / balken.getBoundingClientRect().width : 0,
        bisher: bisher ? Math.round(bisher.getBoundingClientRect().width) : 0,
        abz: abz.map((i) => Math.round(i.getBoundingClientRect().width)),
        hilfe: hilfe ? { px: parseFloat(getComputedStyle(hilfe).fontSize), kontrast: k(hilfe), laenge: hilfe.textContent.trim().length, text: hilfe.textContent.trim() } : null,
      };
    })()`);
    pruefe('Fortschrittsbalken: progressbar 3 von 8 mit Text "Woche 3 von 8 · endet am 25. April 2027"', karte.balken && karte.balken[0] === 'progressbar' && karte.balken[1] === '3'
      && karte.balken[2] === '8' && karte.balken[3] === 'Woche 3 von 8 · endet am 25. April 2027', karte.balken);
    pruefe('Fortschrittsbalken fuellt etwa 3/8', Math.abs(karte.anteil - 3 / 8) < 0.04, karte.anteil);
    pruefe('Wappen der besten Stufe mindestens 48 px', karte.bisher >= 48, karte.bisher);
    pruefe('Abzeichen-Kacheln: Wappen mindestens 40 px', karte.abz.length === 1 && karte.abz.every((w) => w >= 40), karte.abz);
    pruefe('Hilfetext: mindestens 15 px, Kontrast >= 4,5:1, hoechstens 170 Zeichen', karte.hilfe && karte.hilfe.px >= 15 && karte.hilfe.kontrast >= 4.5
      && karte.hilfe.laenge <= 170, karte.hilfe);

    // Titelwahl mit Haken und Vorschau
    const wahl = () => seite.evaluate(() => ({ haken: [...document.querySelectorAll('.ss-titel')].map((b) => !!b.querySelector('.ss-haken') && getComputedStyle(b.querySelector('.ss-haken')).visibility !== 'hidden'
      && getComputedStyle(b.querySelector('.ss-haken')).opacity !== '0'),
    vorschau: !!document.querySelector('.ss-vorschau .vk'), titel: document.querySelector('.ss-vorschau .vk-season-titel')?.textContent.trim() || '',
    abz: document.querySelector('.ss-vorschau .vk-season-abz')?.textContent.trim() || '' }));
    let w = await wahl();
    pruefe('Titelwahl: Haken nur an "Keinen zeigen", Vorschau ohne Titel mit bestem Abzeichen', JSON.stringify(w.haken) === '[true,false,false]' && w.vorschau
      && w.titel === '' && w.abz.includes('Crownmate I'), w);
    await seite.click('.ss-titel[data-titel="crownmaster-s1"]', { timeout: 4000 }).catch(() => {});
    await seite.waitForFunction(() => document.querySelector('.ss-titel[data-titel="crownmaster-s1"]')?.getAttribute('aria-pressed') === 'true', null, { timeout: 4000 }).catch(() => {});
    w = await wahl();
    pruefe('Titelwahl: nach Tipp Haken an Crownmaster, Vorschau zeigt "Crownmaster Season 1"', JSON.stringify(w.haken) === '[false,true,false]' && w.titel === 'Crownmaster Season 1', w);

    // per Tastatur zum eigenen Wappen und Enter
    await seite.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
    let gefunden = false;
    for (let i = 0; i < 80 && !gefunden; i++) {
      await seite.keyboard.press('Tab');
      gefunden = await seite.evaluate(() => !!document.activeElement?.matches('.ss-bisher .ss-ligen-knopf'));
    }
    pruefe('Tastatur: Tab erreicht das Wappen der Saison-Karte', gefunden);
    // --fokus ist eine ganze outline-Angabe; "3px solid var(--fokus)" loeschte den Ring (design-beweis 15.11.)
    const ring = await seite.evaluate(() => { const s = getComputedStyle(document.activeElement); return { stil: s.outlineStyle, breite: parseFloat(s.outlineWidth) }; });
    pruefe('Tastatur: Fokusring am Wappen sichtbar', ring.stil !== 'none' && ring.breite >= 2, ring);
    await seite.keyboard.press('Enter');
    await seite.waitForSelector('.sheet-karte.ss-ligen-blatt', { timeout: 4000 }).catch(() => {});
    let b = await blattLigen(seite);
    pruefe('Alle Ligen: Fenster offen, Fokus darin', b && b.titel === 'Alle Ligen' && b.fokusDrin, b);
    pruefe('Alle Ligen: 18 Stufen von Crownmate I bis Squire III', b && JSON.stringify(b.namen) === JSON.stringify(STUFEN), b && b.namen);
    pruefe('Alle Ligen: jede Liga mit Symbol ab 36 px, je ein Satz zum Aufsteigen', b && b.symbole.every((x) => x >= 36) && b.saetze === 6, b && [b.symbole, b.saetze]);
    pruefe('Alle Ligen: aktuelle Stufe Sovereign I markiert', b && JSON.stringify(b.aktuell) === '["Sovereign I"]', b && b.aktuell);
    pruefe('Alle Ligen: Season-Regel 8 Wochen, bestes Abzeichen bleibt, 3 Stufen zurueck, nie unter Squire III', b && /8 Wochen/.test(b.regel)
      && /Abzeichen/.test(b.regel) && /3 Stufen/.test(b.regel) && /Squire III/.test(b.regel), b && b.regel);
    await seite.keyboard.press('Escape');
    await seite.waitForFunction(() => !document.querySelector('.ss-ligen-blatt'), null, { timeout: 4000 }).catch(() => {});
    pruefe('Alle Ligen: Escape schliesst', !(await seite.$('.ss-ligen-blatt')));
    await seite.click('.ss-abzeichen .ss-ligen-knopf', { timeout: 4000 }).catch(() => {});
    await seite.waitForSelector('.sheet-karte.ss-ligen-blatt', { timeout: 4000 }).catch(() => {});
    b = await blattLigen(seite);
    pruefe('Alle Ligen: auch ueber das Abzeichen erreichbar', b && b.namen.length === 18, b);
    pruefe('Saison-Karte: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  { // englisch: Uebersicht mit denselben Namen und englischer Regel
    const { kontext, seite } = await neueSeite(browser, { gesehen: true });
    await warteLeiste(seite);
    const en = await seite.evaluate(async () => {
      const { setzeSprache } = await import('/js/sprache.js');
      setzeSprache('en');
      const { zeigeLigen } = await import('/js/pakete/liga/saison.js');
      zeigeLigen(0);
      await new Promise((r) => setTimeout(r, 100));
      const b = document.querySelector('.ss-ligen-blatt');
      return { titel: b?.querySelector('h3')?.textContent.trim(), regel: b?.querySelector('.ss-ligen-regel')?.textContent.replace(/\s+/g, ' ').trim() || '',
        aktuell: [...(b?.querySelectorAll('[aria-current="true"] .ss-ligen-name') || [])].map((x) => x.textContent.trim()) };
    });
    pruefe('en: "All leagues", Squire III markiert, Regel "8 weeks"', en.titel === 'All leagues' && JSON.stringify(en.aktuell) === '["Squire III"]' && /8 weeks/.test(en.regel), en);
    await kontext.close();
  }
  { // Link in der Liga (ohne Konto, damit kein Gruppen-Server noetig ist): Uebersicht ohne Markierung
    const { kontext, seite, fehler } = await neueSeite(browser, { konto: false, hash: '#bestenliste' });
    await seite.waitForSelector('.lg-gr[data-zustand="ohne-konto"]', { timeout: 8000 }).catch(() => {});
    const link = await seite.$('.lg-gr .lg-alle-ligen');
    pruefe('Liga: Link "Alle Ligen" sichtbar', !!link && await link.isVisible());
    if (link) await link.click();
    await seite.waitForSelector('.sheet-karte.ss-ligen-blatt', { timeout: 4000 }).catch(() => {});
    const b = await blattLigen(seite);
    pruefe('Liga: Uebersicht mit 18 Stufen, ohne Konto keine Markierung', b && b.namen.length === 18 && b.aktuell.length === 0, b);
    pruefe('Liga: keine Konsolenfehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }
  for (const [name, breite, hoehe, bewegung] of [['iPhone 13', 390, 844, 'no-preference'], ['PC', 1280, 800, 'no-preference'], ['PC reduziert', 1280, 800, 'reduce']]) {
    const { kontext, seite } = await neueSeite(browser, { breite, hoehe, bewegung });
    await warteLeiste(seite);
    await seite.waitForSelector('.ss-blatt', { timeout: 5000 }).catch(() => {});
    await seite.waitForTimeout(1200);
    const e = await seite.evaluate(() => {
      const b = document.querySelector('.sheet-karte.ss-blatt');
      if (!b) return null;
      const held = b.querySelector('.ss-ende-held img');
      const chips = [...b.querySelectorAll('.ss-ende-chips .ss-chip')];
      const neu = b.querySelector('.ss-ende-neu');
      const reihe = [held, chips[0], neu].map((x) => (x ? x.getBoundingClientRect().top : -1));
      return { breite: Math.round(b.getBoundingClientRect().width), held: held ? Math.round(held.getBoundingClientRect().width) : 0,
        chips: chips.map((c) => c.textContent.trim()), chipPx: chips[0] ? parseFloat(getComputedStyle(chips[0]).fontSize) : 0,
        neuPx: neu ? parseFloat(getComputedStyle(neu).fontSize) : 0, reihe,
        anim: held ? getComputedStyle(held.parentElement).animationName : '', knopf: b.querySelector('.sheet-knoepfe button')?.textContent.trim() };
    });
    pruefe(`${name}: Fenster Season-Ende mit grossem Abzeichen (>= 88 px)`, e && e.held >= 88, e);
    pruefe(`${name}: Titel als Chips, Startstufe darunter und kleiner, dann Weiter`, e && JSON.stringify(e.chips) === JSON.stringify(['Crownmaster Season 1', 'Top 100 Season 1'])
      && e.reihe[0] < e.reihe[1] && e.reihe[1] < e.reihe[2] && e.neuPx < e.chipPx + 0.01 && e.neuPx <= 14 && e.knopf === 'Weiter', e);
    if (breite >= 1000) pruefe(`${name}: Fenster am PC mindestens 440 px breit`, e && e.breite >= 440, e && e.breite);
    pruefe(`${name}: Auftritt ${bewegung === 'reduce' ? 'aus bei reduzierter Bewegung' : 'eingeblendet'}`, e && (bewegung === 'reduce' ? e.anim === 'none' : e.anim !== 'none' && e.anim !== ''), e && e.anim);
    await kontext.close();
  }
  { // 4: Gegnerkarte
    const { kontext, seite } = await neueSeite(browser, { konto: false, hash: '#heim' });
    const vk = await seite.evaluate(async () => {
      const V = await import('/js/ui/visitenkarte.js');
      const fremd = V.visitenkarte(V.karteVomServer({ name: 'Mia', kronen_stufe: 9, saison: { abzeichen: { saison: 1, stufe: 17 } }, vitrine: [] }));
      const eigen = V.visitenkarte(V.eigeneKarte());
      document.body.append(fremd, eigen);
      const abz = fremd.querySelector('.vk-season-abz');
      const img = abz?.querySelector('img');
      const mitTitel = V.visitenkarte(V.karteVomServer({ name: 'Mia', kronen_stufe: 13, elo: 1412, saison: { abzeichen: { saison: 1, stufe: 17 }, titel: 'crownmaster-s1' },
        vitrine: [] }));
      mitTitel.style.width = '360px';
      document.body.append(mitTitel);
      const bannerUnten = mitTitel.querySelector('.vk-banner').getBoundingClientRect().bottom;
      const chipsUnten = Math.max(...[...mitTitel.querySelectorAll('.vk-season > *')].map((c) => c.getBoundingClientRect().bottom));
      return { bannerDeckt: bannerUnten + 0.5 >= chipsUnten, bannerUnten, chipsUnten,
        fremdOrden: !!fremd.querySelector('.vk-orden'), eigenLeer: !!eigen.querySelector('.vk-orden li.leer'),
        abzPx: abz ? parseFloat(getComputedStyle(abz).fontSize) : 0, abzImg: img ? Math.round(img.getBoundingClientRect().width) : 0,
        abzText: abz?.textContent.trim() || '' };
    });
    pruefe('Gegnerkarte: leere Vitrine auf fremder Karte ausgeblendet', vk.fremdOrden === false, vk);
    pruefe('Eigene Karte: leere Vitrine bleibt', vk.eigenLeer === true, vk);
    pruefe('Gegnerkarte: Banner deckt Abzeichen und Titel ganz ab', vk.bannerDeckt === true, vk);
    pruefe('Gegnerkarte: Abzeichen mit Wappen ab 18 px und Schrift ab 13 px', vk.abzImg >= 18 && vk.abzPx >= 13 && vk.abzText === 'S1 · Crownmate I', vk);
    await kontext.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
