// R19 Liga neu (15.11.2026, Flo: Liga "billig, unclean, viel Text, wenig Symbole, wenig Farbe"; Platz-Karte der
// Weltrangliste "herzlos"; Belohnungs-Satz "Wird gemerkt und mit dem Shop gutgeschrieben" technisch). Massstab:
// Schach-App/Feinschliff 2026-11-11/R19-Design-Leitlinie.md (Bildstueck je Karte, Zahlen mit Symbol und Farbe, Gold-Akzent,
// Belohnung zeigen statt beschreiben). Browser, Netzwerk ausschliesslich simuliert (Attrappe wie tests/bilder-liga-neu.mjs).
//
//   node tests/r19-liga-neu.test.mjs      Exit 0 nur, wenn alle Pruefungen bestehen
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
if (!pw) { console.log('UEBERSPRUNGEN: Playwright fehlt (PLAYWRIGHT_PFAD setzen)'); process.exit(1); }

const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const d = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(d); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT || 8992);
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/r19-saison-abzeichen.test.mjs)
  console.log(`${gut ? 'OK    ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail).slice(0, 400)}`);
}

const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const SITZUNG = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'r1',
  expires_at: 9999999999, user: { id: UID, email: 'probe@example.invalid' } };
// Weltrangliste: du ("flo", Banner saison-silber) auf Platz 7 mit 1.988, Platz 6 hat 2.025 und Platz 8 1.933
const NAMEN = ['bert', 'mira_k', 'jonas', 'SchachLena', 'tim.r', 'koenigin_ida', 'flo', 'paul88', 'zoe', 'Matt_in_3'];
function weltAntwort(ichErster = false, ausserhalb = false) {
  // ausserhalb (Kaltreview df 15.11.): du auf Platz 150, die Liste traegt nur die besten 100; Name und Banner nur in ich
  if (ausserhalb) {
    const liste = Array.from({ length: 100 }, (_, i) => ({ rang: i + 1, name: 'Spieler ' + (i + 1), banner: 'start', elo: 2400 - i * 5, ich: false }));
    return { ab: 15, ab_start: 30, teilnahme: true, liste, ich: { status: 'dabei', rang: 150, elo: 1900, name: 'flo', banner: 'saison-silber' } };
  }
  const liste = NAMEN.map((name, i) => ({ rang: i + 1, name, banner: name === 'flo' ? 'saison-silber' : 'start', elo: 2210 - i * 37 - (i > 6 ? 18 : 0),
    ich: name === 'flo' }));
  if (ichErster) { liste[6].elo = 2300; liste.sort((a, b) => b.elo - a.elo).forEach((z, i) => { z.rang = i + 1; }); }
  const ich = liste.find((z) => z.ich);
  return { ab: 15, ab_start: 30, teilnahme: true, liste, ich: { status: 'dabei', rang: ich.rang, elo: ich.elo } };
}
// Gruppe: du auf Platz 3 von 30 in Stufe 7 (Liga 2 = Silber-Banner)
function gruppe() {
  const mitglieder = [];
  for (let p = 1; p <= 30; p++) mitglieder.push({ platz: p, name: p === 3 ? 'flo' : 'Spieler ' + p, kronen: 420 - p * 13, ki: false, ich: p === 3 });
  return { woche: '2026-11-09', ende: '2026-11-15', stufe: 7, gruppe: 41, platz: 3, n: 30, mitglieder, belohnung: [], offen: [], bot_ki: { genutzt: 0, max: 300 } };
}
const FREUNDE = [['f1', 'mira_k', 18400, 4], [UID, 'flo', 15200, 6], ['f2', 'jonas', 9900, 2], ['f3', 'SchachLena', 4100, 1]]
  .map(([id, name, punkte, partien]) => ({ id, name, punkte, partien, ich: id === UID }));

const seitenfehler = [];
async function seite(browser, { breite = 390, hoehe = 844, sprache = 'de', ichErster = false, ausserhalb = false } = {}) {
  const k = await browser.newContext({ viewport: { width: breite, height: hoehe }, deviceScaleFactor: 1, hasTouch: breite < 700, isMobile: breite < 700,
    serviceWorkers: 'block', colorScheme: 'dark', reducedMotion: 'reduce', locale: sprache === 'de' ? 'de-DE' : 'en-GB', timezoneId: 'Europe/Berlin' });
  await k.route('**/*.supabase.co/**', (r) => {
    const name = (r.request().url().match(/\/rpc\/([a-z_]+)/) || [])[1];
    const antwort = (d) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    const url = r.request().url();
    if (url.includes('/auth/v1/')) return antwort({ id: UID, email: 'probe@example.invalid' });
    if (url.includes('/rest/v1/profile')) return antwort([{ id: UID, benutzername: 'flo' }]);
    if (name === 'liga_meine_gruppe') return antwort(gruppe());
    if (name === 'weltrang_liste') return antwort(weltAntwort(ichErster, ausserhalb));
    if (name === 'kronen_mein_stand') return antwort({ stufe: 7, kronen: 381, platz: 3, n: 30, ziel: 355 });
    if (name === 'freunde_rangliste') return antwort(FREUNDE);
    return antwort([]);
  });
  await k.addInitScript(({ sitzung, sprache }) => {
    if (sessionStorage.getItem('liga-neu')) return;
    sessionStorage.setItem('liga-neu', '1');
    localStorage.clear();
    localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ modus: 'dunkel', sprache, spracheGewaehlt: true, bewegung: 'aus', klang: false,
      duellIntro: 'aus' }));
    localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
  }, { sitzung: SITZUNG, sprache });
  const s = await k.newPage(); s.setDefaultTimeout(15000);
  s.on('pageerror', (e) => seitenfehler.push(e.message));
  await s.goto(`http://127.0.0.1:${PORT}/index.html?test#start`);
  await s.waitForFunction(() => !!window.__punkte, null, { timeout: 30000 });
  // Spielstand: sechs Partien gegen die ersten Bots, je ein Eintrag auf der Tafel (wie tests/bilder-liga-neu.mjs)
  await s.evaluate(async () => {
    const st = await import('/js/storage.js');
    const tag = await import('/js/tag.js');
    const jetzt = Date.now();
    const zuege = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'd2d3', 'f8c5', 'e1g1', 'd7d6', 'c2c3', 'e8g8', 'b1d2', 'a7a6',
      'a2a4', 'c8e6', 'c4e6', 'f7e6', 'd2c4', 'd8e8', 'c1g5', 'h7h6', 'g5h4', 'g7g5'];
    const tafeln = {};
    [['fridolin', 'sieg', 82], ['benno', 'sieg', 76], ['paula', 'remis', 71], ['gustav', 'sieg', 79], ['hilde', 'niederlage', 64], ['janine', 'sieg', 74]]
      .forEach(([botId, ergebnis, gen], i) => {
        const t = jetzt - (i + 1) * 3600e3;
        const { partie: p } = st.speicherePartie({ botId, modus: 'normal', ergebnis, grund: 'matt', spielerFarbe: 'w', datum: new Date(t).toISOString(),
          zuege, genauigkeit: gen, genauigkeitQuelle: 'analyse', spielstaerke: 1350 + i * 40 });
        tafeln['bot:' + botId] = { id: 'bot:' + botId, eintraege: [{ id: p.id, w: 9200 - i * 900, t, tag: tag.tagSchluessel(new Date(t)),
          wo: tag.wochenSchluessel(new Date(t)), f: 'w', z: 12, e: ergebnis === 'sieg' ? 's' : ergebnis === 'remis' ? 'r' : 'n', g: gen }], chronik: { w: [], m: [] } };
      });
    window.__punkte.speichere({ ...window.__punkte.stand(), tafeln, umzug: true });
  });
  await s.goto(`http://127.0.0.1:${PORT}/index.html?test#bestenliste`);
  // erst neu laden, wenn der Verlaufseintrag umgestellt ist (history.state gilt beim Laden vor dem Hash, js/app.js ausVerlauf)
  await s.waitForFunction(() => history.state && history.state.name === 'bestenliste', null, { timeout: 15000 });
  await s.reload();
  await s.waitForSelector('.bl-steuer-reiter', { timeout: 30000 });
  return { k, s };
}
const reiter = async (s, text, fertig) => {
  await s.locator('.bl-steuer-reiter :is([role="radio"], button)', { hasText: text }).first().click();
  await s.waitForSelector(fertig, { timeout: 15000 });
  await s.waitForFunction(() => [...document.querySelectorAll('img')].every((i) => i.complete), null, { timeout: 10000 }).catch(() => {});
  await warte(300);
};
// Farbe des Gold-Tokens im aktuellen Thema als rgb(...)
const gold = (s) => s.evaluate(() => { const d = document.createElement('i'); d.style.color = 'var(--gold)'; document.body.append(d);
  const c = getComputedStyle(d).color; d.remove(); return c; });

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });

  // ---------- Gruppe: Belohnungs-Karte ----------
  {
    const { k, s } = await seite(browser);
    await reiter(s, 'Gruppe', '.lg-gr:not([hidden]) .lg-gr-zeile');
    const G = await gold(s);
    await s.locator('.lg-gr-zeile[data-platz="1"] .lg-gr-lohn').click();
    const eins = await s.evaluate(() => {
      const k = document.querySelector('.lg-gr-zeile[data-platz="1"] .lg-gr-preis');
      if (!k || k.hidden) return null;
      const img = k.querySelector('img'); const r = img ? img.getBoundingClientRect() : null; const cs = getComputedStyle(k);
      return { src: img ? img.getAttribute('src') : null, h: r ? Math.round(r.height) : 0, w: r ? Math.round(r.width) : 0, text: k.innerText.replace(/\s+/g, ' '),
        rahmen: cs.boxShadow + ' ' + cs.borderColor + ' ' + cs.outlineColor };
    });
    pruefe('Gruppe Platz 1: Belohnungs-Karte .lg-gr-preis klappt auf', !!eins, eins);
    pruefe('Gruppe Platz 1: zeigt das echte Liga-Banner (Stufe 7 = saison-silber) gross, mindestens 64 px hoch', !!eins && /banner\/saison-silber\.svg/.test(eins.src || '')
      && eins.h >= 64, eins);
    pruefe('Gruppe Platz 1: Gold-Rahmen', !!eins && eins.rahmen.includes(G), { eins, G });
    pruefe('Gruppe Platz 1: kein Technik-Satz (Shop, gutgeschrieben, gemerkt)', !!eins && !/Shop|gutgeschrieben|gemerkt/i.test(eins.text), eins && eins.text);
    pruefe('Gruppe Platz 1: warmer, wahrer Satz (Banner, Sammlung, Sonntag)', !!eins && /Banner/.test(eins.text) && /Sammlung/.test(eins.text) && /Sonntag/.test(eins.text), eins && eins.text);
    await s.locator('.lg-gr-zeile[data-platz="3"] .lg-gr-lohn').click();
    const drei = await s.evaluate(() => {
      const k = document.querySelector('.lg-gr-zeile[data-platz="3"] .lg-gr-preis');
      if (!k || k.hidden) return null;
      const bild = k.querySelector('.lg-gr-preis-bild svg, .lg-gr-preis-bild img'); const r = bild ? bild.getBoundingClientRect() : null;
      return { h: r ? Math.round(r.height) : 0, text: k.innerText.replace(/\s+/g, ' '), art: k.dataset.art };
    });
    pruefe('Gruppe Platz 3: Taler-Karte mit grossem Taler-Bild (mindestens 56 px) und der Menge 100', !!drei && drei.art === 'taler' && drei.h >= 56 && /100/.test(drei.text), drei);
    pruefe('Gruppe Platz 3: Satz ohne Shop, sagt, dass die Taler dir gehoeren', !!drei && !/Shop|gutgeschrieben|gemerkt/i.test(drei.text) && /gehören dir/.test(drei.text), drei && drei.text);
    pruefe('Gruppe: Belohnungs-Knopf meldet aria-expanded', await s.locator('.lg-gr-zeile[data-platz="3"] .lg-gr-lohn').getAttribute('aria-expanded') === 'true');

    // ---------- Welt: Platz-Karte A ----------
    await reiter(s, 'Welt', '.lg-welt[data-zustand="dabei"]');
    const welt = await s.evaluate(() => {
      const k = document.querySelector('.lg-welt-platz');
      if (!k) return null;
      const b = k.querySelector('.lg-welt-platz-banner');
      const rang = k.querySelector('.lg-welt-platz-rang');
      const balken = k.querySelector('[role="progressbar"]');
      return { banner: b ? getComputedStyle(b).backgroundImage : '', rang: rang ? rang.textContent.trim() : '', rangFarbe: rang ? getComputedStyle(rang).color : '',
        rangPx: rang ? parseFloat(getComputedStyle(rang).fontSize) : 0, text: k.innerText.replace(/\s+/g, ' '),
        balken: balken ? { jetzt: Number(balken.getAttribute('aria-valuenow')), text: balken.getAttribute('aria-valuetext') } : null,
        austreten: !!document.querySelector('.lg-welt-austreten') };
    });
    const GW = await gold(s);
    pruefe('Welt: Platz-Karte .lg-welt-platz statt Textzeile', !!welt, welt);
    pruefe('Welt: Karte mit deinem Banner (saison-silber)', !!welt && /banner\/saison-silber\.svg/.test(welt.banner), welt && welt.banner);
    pruefe('Welt: "#7" gross in Gold', !!welt && welt.rang === '#7' && welt.rangFarbe === GW && welt.rangPx >= 32, { welt, GW });
    pruefe('Welt: "Noch 37 Elo bis Platz 6" mit Balken', !!welt && /Noch 37 Elo bis Platz 6/.test(welt.text) && !!welt.balken && welt.balken.jetzt > 0 && welt.balken.jetzt < 100
      && /37/.test(welt.balken.text || ''), welt);
    pruefe('Welt: Name und Elo stehen in der Karte', !!welt && /flo/.test(welt.text) && /1\.988/.test(welt.text), welt && welt.text);
    pruefe('Welt: "Nicht mehr zeigen" bleibt erreichbar', !!welt && welt.austreten);

    // ---------- Ich: jede Karte mit Bildstueck, Zahlen mit Symbol ----------
    await reiter(s, 'Ich', '[data-reiter="ich"]:not([hidden]) .bl-kronen:not([hidden])');
    const ich = await s.evaluate(() => {
      const r = document.querySelector('section.bl-reiter[data-reiter="ich"]');
      const karten = [...r.querySelectorAll(':scope > .bl-karte:not([hidden])')].map((k) => ({ klasse: k.className, bild: !!k.querySelector('img, svg') }));
      const werte = [...r.querySelectorAll('.bl-bilanz-werte > div')].map((d) => ({ ico: !!d.querySelector('svg'), farbe: getComputedStyle(d.querySelector('dd')).color }));
      const av = r.querySelector('.bl-ib-bild'); const ar = av ? av.getBoundingClientRect() : null;
      return { karten, werte, avatar: ar ? Math.round(ar.width) : 0, botBild: !!av && av.tagName === 'IMG' && /assets\/avatare\//.test(av.getAttribute('src') || '') };
    });
    pruefe('Ich: jede Karte hat ein Bildstueck (Wappen, Bot-Bild, Symbol)', ich.karten.length >= 3 && ich.karten.every((k) => k.bild), ich.karten);
    pruefe('Ich: Bilanz, jede Zahl mit Symbol', ich.werte.length === 4 && ich.werte.every((w) => w.ico), ich.werte);
    pruefe('Ich: Bilanz-Zahlen in mindestens zwei Farben (nicht alles grau)', new Set(ich.werte.map((w) => w.farbe)).size >= 2, ich.werte);
    pruefe('Ich: beste Partie mit Bot-Bild ab 56 px', ich.avatar >= 56, ich.avatar);
    pruefe('Ich: beste Partie zeigt das Bild des Bots (nicht das Podest)', ich.botBild, ich);

    // ---------- Bots: Platz als Medaille, Zahl mit Symbol ----------
    await reiter(s, 'Bots', '[data-reiter="bots"]:not([hidden]) .bl-gegner-zeile');
    const bots = await s.evaluate(() => [...document.querySelectorAll('.bl-gegner-zeile.mit-eintrag')].map((z) => ({
      platz: z.querySelector('.bl-g-platz')?.textContent.trim(), medaille: z.querySelector('.bl-g-platz')?.dataset.medaille || '',
      wert: !!z.querySelector('.bl-g-wert svg'), label: z.getAttribute('aria-label') || '' })));
    pruefe('Bots: Zeilen mit Eintrag zeigen den Platz als Medaille (.bl-g-platz)', bots.length === 6 && bots.every((b) => /^#?\d+$/.test(b.platz || '')), bots);
    pruefe('Bots: Platz 1 ist eine Gold-Medaille', bots.some((b) => (b.platz || '').replace('#', '') === '1' && b.medaille === 'gold'), bots);
    pruefe('Bots: Punkte mit Symbol', bots.every((b) => b.wert), bots);
    pruefe('Bots: Vorleser hoert Platz und Punkte als Satz', bots.every((b) => /Platz \d+/.test(b.label) && /Punkte/.test(b.label)), bots);
    await k.close();
  }

  // ---------- Bots am PC: rechte Tafel mit grossem Bot-Bild ----------
  {
    const { k, s } = await seite(browser, { breite: 1920, hoehe: 1080 });
    await reiter(s, 'Bots', '[data-reiter="bots"]:not([hidden]) .bl-tafel');
    const held = await s.evaluate(() => {
      const img = document.querySelector('.bl-tafel .bl-k-kopf .bl-t-bild img'); const r = img ? img.getBoundingClientRect() : null;
      return { px: r ? Math.round(r.width) : 0, bilanz: document.querySelectorAll('.bl-tafel .bl-bot-bilanz .bl-t-chip').length === 3 };
    });
    pruefe('Bots PC: Tafel mit grossem Bot-Bild (mindestens 88 px)', held.px >= 88, held);
    pruefe('Bots PC: Bilanz gegen den Bot als farbige Chips', held.bilanz, held);

    // ---------- Freunde: Medaillen und farbige Bilder ----------
    await reiter(s, 'Freunde', '.bl-fr-liste');
    const fr = await s.evaluate(() => [...document.querySelectorAll('.bl-fr-zeile')].map((z) => ({ medaille: z.querySelector('.bl-fr-platz')?.dataset.medaille || '',
      grund: getComputedStyle(z.querySelector('.bl-fr-av')).backgroundColor, du: z.classList.contains('du'), text: z.innerText.replace(/\s+/g, ' ') })));
    pruefe('Freunde: Platz 1 bis 3 als Medaille', fr.length === 4 && fr[0].medaille === 'gold' && fr[1].medaille === 'silber' && fr[2].medaille === 'bronze' && !fr[3].medaille, fr);
    const fremde = fr.filter((z) => !z.du);
    pruefe('Freunde: jeder Freund mit eigener Farbe im Bild', new Set(fremde.map((z) => z.grund)).size === fremde.length, fremde);
    pruefe('Freunde: Punkte und Partien bleiben in der Zeile', /15\.200/.test(fr[1].text) && /6 gewertete Partien/.test(fr[1].text), fr[1]);
    await k.close();
  }

  // ---------- Welt Platz 1 und Englisch ----------
  {
    const { k, s } = await seite(browser, { ichErster: true });
    await reiter(s, 'Welt', '.lg-welt[data-zustand="dabei"]');
    const t = await s.locator('.lg-welt-platz').innerText().catch(() => '');
    pruefe('Welt Platz 1: "#1" und ein Satz ohne Abstand', /#1/.test(t) && /führst/.test(t) && !/Noch \d+ Elo/.test(t), t);
    await k.close();
  }
  {
    const { k, s } = await seite(browser, { ausserhalb: true });
    await reiter(s, 'Welt', '.lg-welt[data-zustand="dabei"]');
    const w = await s.evaluate(() => {
      const k = document.querySelector('.lg-welt-platz');
      return k && { text: k.innerText, banner: k.querySelector('.lg-welt-platz-banner')?.style.backgroundImage || '',
        balken: !!k.querySelector('.lg-welt-platz-balken') };
    });
    pruefe('Welt ausserhalb der Liste: Name und eigenes Banner aus "ich"', !!w && /flo/.test(w.text) && /banner\/saison-silber\.svg/.test(w.banner), w);
    pruefe('Welt ausserhalb der Liste: kein Balken ohne den Platz direkt ueber dir', !!w && !w.balken && /#150/.test(w.text), w);
    await k.close();
  }
  {
    const { k, s } = await seite(browser, { sprache: 'en' });
    await reiter(s, 'Group', '.lg-gr:not([hidden]) .lg-gr-zeile');
    await s.locator('.lg-gr-zeile[data-platz="1"] .lg-gr-lohn').click();
    const t = await s.locator('.lg-gr-zeile[data-platz="1"] .lg-gr-preis').innerText().catch(() => '');
    pruefe('EN Gruppe: Banner-Satz englisch, ohne Shop', /banner/i.test(t) && /Sunday/.test(t) && !/shop|credited/i.test(t), t);
    await reiter(s, 'World', '.lg-welt[data-zustand="dabei"]');
    const w = await s.locator('.lg-welt-platz').innerText().catch(() => '');
    pruefe('EN Welt: "37 Elo to place 6"', /37 Elo to place 6/.test(w), w);
    await k.close();
  }
} finally {
  if (browser) await browser.close().catch(() => {});
  server.close();
}
pruefe('keine Seitenfehler', seitenfehler.length === 0, seitenfehler);
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
