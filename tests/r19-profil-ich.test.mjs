// R19 Profil Ich (15.11.2026, Flo zum Reiter "Ich": Vitrine "herzlos, kleine Symbole, unclean"; Liga-Stufe "Squire ..." ohne
// Symbol; Banner "Erster Zug" "richtig haesslich"; Figuren-Auswahl: "das Logo ist zu gross, man sieht die Figuren nicht").
// Massstab: Schach-App/Feinschliff 2026-11-11/R19-Design-Leitlinie.md (Bildstueck je Karte, ein lebendiges Element je
// Flaeche, bei reduzierter Bewegung Standbild, Gold als Akzent). Browser, Netzwerk ausschliesslich simuliert.
//
//   node tests/r19-profil-ich.test.mjs      Exit 0 nur, wenn alle Pruefungen bestehen
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync, mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
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
// alle Namen, die eine Vitrine-Kachel tragen kann: Familien und Stufen-Namen (js/pakete/sammlung/karte-texte.js, taten.js)
const VITRINE_NAMEN = [...new Set(['karte-texte.js', 'taten.js'].flatMap((d) =>
  [...readFileSync(path.join(root, 'js', 'pakete', 'sammlung', d), 'utf8').matchAll(/'((?:fam|sn)\.[a-z0-9.]+)'/g)].map((m) => m[1])))];
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { const d = readFileSync(p); res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(d); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT || 8997);
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/r19-liga-neu.test.mjs)
  console.log(`${gut ? 'OK    ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail).slice(0, 400)}`);
}

const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const SITZUNG = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'r1',
  expires_at: 9999999999, user: { id: UID, email: 'probe@example.invalid' } };

const seitenfehler = [];
async function seite(browser, { breite = 390, hoehe = 844, sprache = 'de', bewegung = false } = {}) {
  const k = await browser.newContext({ viewport: { width: breite, height: hoehe }, deviceScaleFactor: 1, hasTouch: breite < 700, isMobile: breite < 700,
    serviceWorkers: 'block', colorScheme: 'dark', reducedMotion: bewegung ? 'no-preference' : 'reduce', locale: sprache === 'de' ? 'de-DE' : 'en-GB',
    timezoneId: 'Europe/Berlin' });
  await k.route('**/*.supabase.co/**', (r) => {
    const name = (r.request().url().match(/\/rpc\/([a-z_]+)/) || [])[1];
    const antwort = (d) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (r.request().url().includes('/auth/v1/')) return antwort({ id: UID, email: 'probe@example.invalid' });
    if (r.request().url().includes('/rest/v1/profile')) return antwort([{ id: UID, benutzername: 'flo' }]);
    if (name === 'kronen_mein_stand') return antwort({ stufe: 7, kronen: 381, platz: 3, n: 30, ziel: 355 });
    return antwort([]);
  });
  await k.addInitScript(({ sitzung, sprache, bewegung }) => {
    if (sessionStorage.getItem('profil-test')) return;
    sessionStorage.setItem('profil-test', '1');
    localStorage.clear();
    localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ modus: 'dunkel', sprache, spracheGewaehlt: true,
      bewegung: bewegung ? 'normal' : 'aus', klang: false, duellIntro: 'aus' }));
    localStorage.setItem('schach-arena:v1:hinweis-installieren', '1');
  }, { sitzung: SITZUNG, sprache, bewegung });
  const s = await k.newPage();
  s.setDefaultTimeout(15000);
  s.on('pageerror', (e) => seitenfehler.push(e.message));
  await s.goto(`http://127.0.0.1:${PORT}/index.html?test#start`);
  await s.waitForSelector('.screen', { timeout: 30000 });
  await s.waitForFunction(() => !!window.__punkte, null, { timeout: 15000 });
  // Spielstand: vier Siege, Vitrine mit zwei Erfolgs-Familien (Siege, Liga)
  await s.evaluate(async (uid) => {
    const st = await import('/js/storage.js');
    // Liga-Stand wie nach kronen_mein_stand (js/pakete/liga/kronen.js kronenSpeicher): Stufe 7 = Knight II
    st.speichereModul('kronen', { konto: uid, stand: { stufe: 7, kronen: 381, platz: 3, n: 30, ziel: 355 } });
    const profil = await import('/js/profil.js');
    const jetzt = Date.now();
    const gegner = [['fridolin', 'sieg'], ['benno', 'sieg'], ['paula', 'remis'], ['gustav', 'sieg'], ['hilde', 'niederlage'], ['janine', 'sieg']];
    const fortschritt = { bots: {}, brillanteZuege: [] };
    gegner.forEach(([botId, ergebnis], i) => {
      st.speicherePartie({ botId, modus: 'normal', ergebnis, grund: ergebnis === 'remis' ? 'remis' : 'matt', spielerFarbe: 'w',
        datum: new Date(jetzt - (i + 1) * 3600e3).toISOString(), zuege: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'd2d3', 'f8c5'],
        genauigkeit: 70 + i, genauigkeitQuelle: 'analyse', spielstaerke: 1350 + i * 40 });
      fortschritt.bots[botId] = { sterne: [ergebnis === 'sieg', false, false], partien: 1, siege: ergebnis === 'sieg' ? 1 : 0,
        remis: ergebnis === 'remis' ? 1 : 0, niederlagen: ergebnis === 'niederlage' ? 1 : 0, besteGenauigkeit: 70 + i };
    });
    localStorage.setItem('schach-arena:v1:fortschritt', JSON.stringify(fortschritt));
    const pk = window.__punkte;
    if (pk) pk.speichere({ ...pk.stand(), level: 12, umzug: true });
    profil.setzeProfilWahl({ vitrine: ['stufe-siege', 'stufe-liga', null] });
  }, UID);
  await s.goto(`http://127.0.0.1:${PORT}/index.html?test#ich`);
  // erst neu laden, wenn der Verlaufseintrag umgestellt ist (js/app.js ausVerlauf, siehe tests/bilder-liga-neu.mjs)
  await s.waitForFunction(() => history.state && history.state.name === 'ich', null, { timeout: 15000 });
  await s.reload();
  await s.waitForSelector('.pr-karte', { timeout: 30000 });
  // der Liga-Stand schaltet Erfolge frei: deren Momente legen sich ueber die Seite (wie tests/funktion-shop-skin.test.mjs)
  await s.waitForSelector('.st-moment', { timeout: 2500 }).catch(() => {});
  for (let i = 0; i < 12 && await s.locator('.st-moment .st-weiter').count(); i++) { await s.locator('.st-moment .st-weiter').first().click(); await warte(250); }
  // die Rang-Stufe kommt vom (nachgebauten) Server: warten, bis der Chip steht
  await s.waitForSelector('.pr-chip-krone', { timeout: 10000 }).catch(() => {});
  await s.waitForFunction(() => [...document.querySelectorAll('img')].every((i) => i.complete), null, { timeout: 10000 }).catch(() => {});
  await warte(400);
  return { k, s };
}

let browser;
try {
  browser = await browserTyp(pw).launch({ headless: true });

  // ---------- Banner "Erster Zug": neu gezeichnet, edel statt Sonne und Streifen ----------
  const start = readFileSync(new URL('../assets/banner/start.svg', import.meta.url), 'utf8');
  pruefe('Banner Erster Zug: Format 1200x300 bleibt', /viewBox="0 0 1200 300"/.test(start));
  pruefe('Banner Erster Zug: alte Sonne und Streifen sind weg', !/id="so"/.test(start) && !/rgba\(255,255,255,\.1\)/.test(start));
  pruefe('Banner Erster Zug: Brett als Muster', /<pattern\b/.test(start));
  pruefe('Banner Erster Zug: Gold-Akzent der App (#E0A22B)', /#E0A22B/i.test(start));
  pruefe('Banner Erster Zug: dunkler, matter Grund', /stop-color="#1[0-9A-F]{5}"/i.test(start));

  // ---------- Banner-Werkzeug: ein Lauf verliert keinen Eintrag (der Umbau von "Erster Zug" strich 11 von 21) ----------
  // Lauf in einer Wegwerf-Kopie, damit der Test nichts im Baum ueberschreibt; Massstab ist der eingecheckte Vorrat
  {
    const tmp = mkdtempSync(path.join(tmpdir(), 'banner-vorrat-'));
    mkdirSync(path.join(tmp, 'werkzeuge'));
    copyFileSync(path.join(root, 'werkzeuge', 'banner-vorrat.mjs'), path.join(tmp, 'werkzeuge', 'banner-vorrat.mjs'));
    const lauf = spawnSync(process.execPath, [path.join(tmp, 'werkzeuge', 'banner-vorrat.mjs')], { encoding: 'utf8' });
    const vorher = JSON.parse(readFileSync(path.join(root, 'assets', 'banner', 'vorrat.json'), 'utf8')).banner.map((b) => b.id);
    let nachher = [];
    try { nachher = JSON.parse(readFileSync(path.join(tmp, 'assets', 'banner', 'vorrat.json'), 'utf8')).banner.map((b) => b.id); } catch (e) { /* bleibt leer */ }
    const fehlt = vorher.filter((id) => !nachher.includes(id));
    pruefe('Banner-Werkzeug: Lauf endet ohne Fehler', lauf.status === 0, lauf.stderr || lauf.stdout);
    pruefe(`Banner-Werkzeug: alle ${vorher.length} eingecheckten Banner bleiben im Vorrat`, vorher.length > 0 && fehlt.length === 0, { fehlt, nachher: nachher.length });
    // die App zeigt Bot-Banner fest (js/ui/visitenkarte.js BOT_BANNER): jedes davon muss das Werkzeug erzeugen
    const botListe = (readFileSync(path.join(root, 'js', 'ui', 'visitenkarte.js'), 'utf8').match(/BOT_BANNER = Object\.freeze\(\[([^\]]*)\]/) || [])[1] || '';
    const botBanner = [...botListe.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
    pruefe('Banner-Werkzeug: jedes Bot-Banner der App entsteht im Lauf', botBanner.length > 0 && botBanner.every((id) => nachher.includes(id)), { botBanner, nachher });
    // nur "Erster Zug" wurde neu gezeichnet: jedes andere Banner kommt Byte fuer Byte wie eingecheckt heraus
    const anders = nachher.filter((id) => id !== 'start' && existsSync(path.join(tmp, 'assets', 'banner', `${id}.svg`))
      && readFileSync(path.join(tmp, 'assets', 'banner', `${id}.svg`), 'utf8') !== readFileSync(path.join(root, 'assets', 'banner', `${id}.svg`), 'utf8'));
    pruefe('Banner-Werkzeug: die uebrigen Banner unveraendert', nachher.length > 1 && anders.length === 0, anders);
    rmSync(tmp, { recursive: true, force: true });
  }

  // Vitrine und Rang in drei Breiten (iPhone, iPhone SE 1, iPad hoch), Figuren-Auswahl nur in der ersten
  for (const [sprache, breite, hoehe] of [['de', 390, 844], ['en', 390, 844], ['de', 320, 568], ['en', 320, 568], ['de', 768, 1024], ['en', 768, 1024]]) {
    const { k, s } = await seite(browser, { sprache, breite, hoehe });
    const L = `${sprache.toUpperCase()} ${breite}x${hoehe}`;
    // ---------- Vitrine: grosse Orden mit Bild ----------
    const orden = await s.$$eval('.pr-vitrine .pr-orden:not(.leer)', (xs) => xs.map((x) => {
      const b = x.querySelector('.pr-orden-bild');
      const svg = b && b.querySelector('svg');
      const rb = b ? b.getBoundingClientRect() : { width: 0 };
      const rs = svg ? svg.getBoundingClientRect() : { width: 0 };
      return { bild: Math.round(rb.width), svg: Math.round(rs.width), stufe: x.dataset.stufe || '' };
    }));
    pruefe(`${L} Vitrine: zwei ausgestellte Orden`, orden.length === 2, orden);
    pruefe(`${L} Vitrine: jeder Orden mit grossem Bild (mind. 64 px, Abzeichen mind. 56 px)`, orden.length === 2 && orden.every((o) => o.bild >= 64 && o.svg >= 56), orden);
    pruefe(`${L} Vitrine: Stufe am Orden`, orden.every((o) => /^[1-5]$/.test(o.stufe)), orden);
    // reduzierte Bewegung: das lebendige Element steht still
    const stillAni = await s.$$eval('.pr-vitrine .pr-orden:not(.leer) .pr-orden-bild', (xs) => xs.map((x) => getComputedStyle(x, '::after').animationName));
    pruefe(`${L} Vitrine: bei reduzierter Bewegung ohne Animation`, stillAni.length === 2 && stillAni.every((a) => a === 'none'), stillAni);

    // ---------- Rang-Symbol an der Liga-Stufe ----------
    const rang = await s.evaluate(() => {
      const chip = document.querySelector('.pr-chip-krone');
      const img = chip && chip.querySelector('img.pr-rang');
      const r = img ? img.getBoundingClientRect() : null;
      return { chip: !!chip, text: chip ? chip.textContent.trim() : '', src: img ? img.getAttribute('src') : '', geladen: !!img && img.complete && img.naturalWidth > 0,
        b: r ? Math.round(r.width) : 0, h: r ? Math.round(r.height) : 0, alt: img ? img.getAttribute('alt') : null };
    });
    pruefe(`${L} Rang: Liga-Stufe als Chip`, rang.chip && /\b(I|II|III)$/.test(rang.text), rang);
    pruefe(`${L} Rang: Liga-Symbol am Chip (assets/liga/<liga>.svg, geladen)`, /assets\/liga\/(bauer|springer|laeufer|turm|dame|koenig)\.svg$/.test(rang.src) && rang.geladen, rang);
    pruefe(`${L} Rang: Symbol gross genug (mind. 22 px)`, rang.b >= 22 && rang.h >= 22, rang);
    pruefe(`${L} Rang: Symbol ist Schmuck (alt leer, der Text nennt die Stufe)`, rang.alt === '', rang);
    // nichts abgeschnitten: Orden, Chip und Symbol liegen im Fenster und in ihrem Eltern-Kasten, die Seite ist nicht breiter
    const raus = await s.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const aus = [];
      for (const el of document.querySelectorAll('.pr-vitrine .pr-orden, .pr-vitrine .pr-orden-bild, .pr-chip-krone, .pr-chip-krone img.pr-rang')) {
        const r = el.getBoundingClientRect(), e = el.parentElement.getBoundingClientRect();
        if (!r.width) continue;
        if (r.left < -0.5 || r.right > vw + 0.5) aus.push(`${el.className} Fenster ${Math.round(r.left)}..${Math.round(r.right)} von ${vw}`);
        else if (r.left < e.left - 1 || r.right > e.right + 1) aus.push(`${el.className} Eltern ${Math.round(r.left)}..${Math.round(r.right)} in ${Math.round(e.left)}..${Math.round(e.right)}`);
        if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth && getComputedStyle(el).overflow !== 'visible') aus.push(`${el.className} Text abgeschnitten`);
      }
      if (document.documentElement.scrollWidth > vw + 1) aus.push(`Seite ${document.documentElement.scrollWidth} breiter als ${vw}`);
      return aus;
    });
    pruefe(`${L} Vitrine und Rang: nichts ragt aus Fenster oder Kasten`, raus.length === 0, raus);
    // Wortbruch (Fix-Review 17.11.: "Ligaaufstie|g" auf dem SE): jeder Name, der in der Vitrine stehen kann, bricht nur an
    // Leerzeichen, Bindestrich oder weicher Trennstelle und passt in seine Kachel. Rechtecke allein sehen das nicht.
    const brueche = await s.evaluate(async (schluessel) => {
      const { t } = await import('/js/sprache.js');
      await import('/js/pakete/sammlung/karte-texte.js');
      await import('/js/pakete/sammlung/taten.js');
      const b = document.querySelector('.pr-vitrine .pr-orden:not(.leer) b');
      if (!b) return ['keine Kachel'];
      const vorher = b.textContent, kachel = b.closest('.pr-orden').getBoundingClientRect(), aus = [];
      for (const k of schluessel) {
        const name = t('p-karte.' + k);
        b.textContent = name;
        const tn = b.firstChild;
        // nur Zeichen mit Breite zaehlen (eine ungenutzte Trennstelle hat keine; das erste Zeichen einer neuen Zeile meldet
        // in Chromium zusaetzlich ein leeres Rechteck am Ende der Zeile davor), der Bruch liegt zwischen vor und i
        let oben = null, vor = 0;
        for (let i = 0; i < name.length; i++) {
          const r = document.createRange(); r.setStart(tn, i); r.setEnd(tn, i + 1);
          const q = [...r.getClientRects()].filter((x) => x.width > 0).pop();
          if (!q) continue;
          const top = q.top;
          if (oben !== null && top > oben + 2 && !/[\s\u00AD-]/.test(name.slice(vor, i))) aus.push(`${k} "${name.slice(0, i)}|${name.slice(i)}"`);
          oben = top; vor = i;
        }
        const bb = b.getBoundingClientRect();
        if (b.scrollWidth > b.clientWidth + 1 || bb.left < kachel.left - 0.5 || bb.right > kachel.right + 0.5) aus.push(`${k} "${name}" ragt aus der Kachel`);
      }
      b.textContent = vorher;
      return aus;
    }, VITRINE_NAMEN);
    pruefe(`${L} Vitrine: alle ${VITRINE_NAMEN.length} Namen brechen nur an Wortgrenzen oder weicher Trennung und passen in die Kachel`, brueche.length === 0, brueche);
    if (breite !== 390) { await k.close(); continue; }

    // ---------- Figuren-Auswahl: die Figuren gross, keine Scheibe als "Logo" ----------
    // in drei Blattbreiten (SE-Blatt 320 bis iPhone 390, drei Spalten): auf dem SE schnitt die Kachel die aeusseren Figuren ab
    const figs = await s.evaluate(async () => {
      const { bereich } = await import('/js/ui/ich.js');
      const { teileFiguren } = await import('/js/pakete/sammlung/index.js');
      const aus = [];
      for (const blattB of [320, 343, 390]) {
        const sek = bereich({ id: 'figuren-probe', name: 'Probe', teile: teileFiguren() });
        const huelle = document.createElement('div');
        huelle.className = 'sheet-karte sa-blatt';
        huelle.style.cssText = `position:fixed;left:0;top:0;width:${blattB}px;z-index:99`;
        huelle.append(sek);
        document.body.append(huelle);
        await Promise.all([...huelle.querySelectorAll('img')].map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; }))));
        const bild = huelle.querySelector('.sa-bild');
        const imgs = [...bild.querySelectorAll('.sk-figuren img')];
        const rb = bild.getBoundingClientRect();
        const ri = imgs.map((i) => i.getBoundingClientRect());
        const breite = ri.reduce((s, r) => s + r.width, 0);
        aus.push({ blattB, n: imgs.length, hoehe: ri.map((r) => Math.round(r.height)), anteil: Math.round((breite / rb.width) * 100) / 100,
          bildB: Math.round(rb.width), drin: ri.every((r) => r.left >= rb.left - 1 && r.right <= rb.right + 1 && r.top >= rb.top - 1 && r.bottom <= rb.bottom + 1),
          scheibe: getComputedStyle(bild.querySelector('.sk-figuren')).borderRadius });
        huelle.remove();
      }
      return aus;
    });
    pruefe(`${L} Figuren: drei Figuren des Satzes`, figs.every((f) => f.n === 3), figs);
    pruefe(`${L} Figuren: keine Figur ragt aus der Kachel (Blatt 320, 343, 390 px)`, figs.every((f) => f.drin), figs);
    pruefe(`${L} Figuren: die mittlere Figur mind. 30 px hoch, auch im schmalsten Blatt`, figs.every((f) => f.hoehe.length === 3 && f.hoehe[1] >= 30), figs);
    pruefe(`${L} Figuren: die Figuren fuellen das Bild (mind. 70 % der Breite)`, figs.every((f) => f.anteil >= 0.7), figs);
    pruefe(`${L} Figuren: keine runde Scheibe mehr`, figs.every((f) => !/50%/.test(f.scheibe)), figs);
    await k.close();
  }

  // ---------- ein lebendiges Element bei erlaubter Bewegung ----------
  {
    const { k, s } = await seite(browser, { bewegung: true });
    const ani = await s.$$eval('.pr-vitrine .pr-orden:not(.leer) .pr-orden-bild', (xs) => xs.map((x) => getComputedStyle(x, '::after').animationName));
    pruefe('Vitrine: sanfter Glanz laeuft bei erlaubter Bewegung', ani.length === 2 && ani.every((a) => a && a !== 'none'), ani);
    // die Banner im Blatt bleiben in ihrer Kachel (das Bild schneidet ab)
    await s.locator('.sa-platz[data-bereich="banner"]').first().click();
    await s.waitForSelector('.sheet-karte .sa-bereich[data-bereich="banner"]', { timeout: 10000 });
    await warte(400);
    const raus = await s.$$eval('.sheet-karte .sa-teil', (xs) => xs.map((t) => {
      const b = t.querySelector('.sa-bild').getBoundingClientRect();
      const i = t.querySelector('img.sk-banner');
      if (!i) return null;
      const r = i.getBoundingClientRect();
      const sichtbar = getComputedStyle(t.querySelector('.sa-bild')).overflow;
      return { id: t.dataset.teil, ueber: r.left < b.left - 1 || r.right > b.right + 1, sichtbar };
    }).filter((x) => x && x.ueber && x.sichtbar === 'visible'));
    pruefe('Banner-Blatt: kein Banner ragt sichtbar aus seiner Kachel', raus.length === 0, raus);
    await s.keyboard.press('Escape');

    // ---------- Gegner-Portraets als Profilbild (eigener Commit, frei mit dem ersten Sieg gegen den Bot) ----------
    const bp = await s.evaluate(async () => {
      const profil = await import('/js/profil.js');
      const thema = await import('/js/thema.js');
      const { portraetTeile } = await import('/js/pakete/sammlung/profil.js');
      const { KARTE_MOTIVE } = await import('/js/karte.js');
      const teile = portraetTeile();
      const fri = teile.find((x) => x.id === 'bot-fridolin'), lisa = teile.find((x) => x.id === 'bot-lisa');
      profil.setzeProfilWahl({ figur: 'bot-lisa' });
      const gesperrtWahl = profil.profilWahl().figur;
      profil.setzeProfilWahl({ figur: 'bot-fridolin' });
      const freiWahl = profil.profilWahl().figur;
      profil.setzeProfilWahl({ vitrine: ['stufe-siege', 'stufe-liga', null] });
      const bleibt = profil.profilWahl().figur;
      const bild = thema.profilAvatar({ figur: 'bot-fridolin' }, 'w');
      const fremd = ['bot-../x', 'bot-niemand', 'bot-FRIDOLIN', 'bot-'].map((f) => thema.profilAvatar({ figur: f }, 'w'));
      const gegner = thema.avatarVon({ id: 'fridolin', avatar: 'x.svg' });
      // zwei Portraets desselben Gegners in einem Dokument (Karte und Auswahl-Blatt): jede Ausschnitt-Kennung genau einmal
      const zwei = document.createElement('div');
      zwei.innerHTML = thema.profilAvatar({ figur: 'bot-fridolin' }, 'w') + thema.profilAvatar({ figur: 'bot-fridolin' }, 'b');
      document.body.append(zwei);
      const kennungen = [...document.querySelectorAll('clipPath[id]')].map((c) => c.id);
      const doppelt = kennungen.filter((id, i) => kennungen.indexOf(id) !== i);
      const verweise = [...zwei.querySelectorAll('image[clip-path]')].map((i) => (i.getAttribute('clip-path').match(/url\(#([^)]+)\)/) || [])[1]);
      const eigen = verweise.length === 2 && verweise[0] !== verweise[1] && verweise.every((v) => zwei.querySelector(`clipPath[id="${v}"]`));
      zwei.remove();
      profil.setzeProfilWahl({ figur: 'P' });
      return { n: teile.length, fri, lisa, gesperrtWahl, freiWahl, bleibt, bild: /assets\/avatare\/modern\/fridolin\.svg/.test(bild),
        fremd: fremd.map((x) => (x.match(/data-figur="([^"]*)"/) || [])[1]), fremdOhneBild: fremd.every((x) => !/avatare/.test(x)),
        gegner, karte: KARTE_MOTIVE.includes('bot-fridolin'), doppelt, eigen, verweise };
    });
    pruefe('Portraets: dreissig Gegner zur Wahl', bp.n === 30, bp.n);
    pruefe('Portraets: Fridolin (besiegt) frei, Lisa (nie gespielt) gesperrt mit Weg "Erster Sieg: <Name>" (Namen tragen teils ihren Artikel, "Besiege Der Stockfisch")', !!(bp.fri && bp.fri.frei && bp.lisa && !bp.lisa.frei && /^Erster Sieg: Lisa/.test(bp.lisa.weg)), { fri: bp.fri, lisa: bp.lisa });
    pruefe('Portraets: gesperrtes Portraet laesst sich nicht setzen (Standard bleibt)', bp.gesperrtWahl === 'P', bp.gesperrtWahl);
    pruefe('Portraets: freies Portraet wird Profilbild und bleibt beim Speichern der Vitrine', bp.freiWahl === 'bot-fridolin' && bp.bleibt === 'bot-fridolin', bp);
    pruefe('Portraets: Profilbild zeichnet das Portraet aus dem festen Ordner', bp.bild);
    pruefe('Portraets: fremde Werte fallen auf den Standard, kein Bild', bp.fremd.every((f) => f === 'P') && bp.fremdOhneBild, bp.fremd);
    pruefe('Portraets: Gegner-Avatar unveraendert, Karte fuer andere ohne Portraet-Motiv', bp.gegner === 'assets/avatare/modern/fridolin.svg' && !bp.karte, bp);
    pruefe('Portraets: zwei Portraets im selben Dokument, keine Ausschnitt-Kennung doppelt', bp.doppelt.length === 0, bp.doppelt);
    pruefe('Portraets: jedes Portraet schneidet mit seinem eigenen Ausschnitt', bp.eigen, bp.verweise);
    await k.close();
  }
} finally {
  if (browser) await browser.close().catch(() => {});
  server.close();
}
pruefe('keine Seitenfehler', seitenfehler.length === 0, seitenfehler);
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
