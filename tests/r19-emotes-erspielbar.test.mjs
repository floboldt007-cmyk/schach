// Emotes und Finisher erspielbar (Feinschliff R19, G-008 M5, Flos Wahl Variante C vom 18.11.2026): 15 von 19 neuen Stuecken
// kommen aus dem Spiel, die Freigabe wird nur aus dem Spielstand berechnet (kein Server, kein Preis).
//   Welt-Endgegner 1 bis 5: Kreatur Karo, Stups, Zinni, Klippa, Glimm; Welt 1 bis 3 dazu Finisher Krone, Welle, Koenig.
//   Kronli: alle Bots aller Welten besiegt (Flo 18.11.2026, gleiche Zaehlung wie "welten" in sammlung stufenStand).
//   Sticker Krone, Feuer, Herz, Springer, Blitz, Diamant: Funken-Level 12, 18, 24, 30, 36, 42.
//   Kronensturz, Blitzschlag, Goldregen, Schockwelle bleiben "Bald im Shop"; Erspielbares liegt nicht mehr im Shop-Regal.
//
//   node tests/r19-emotes-erspielbar.test.mjs
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { setzeSpeicher, ladeFortschritt } from '../js/storage.js';
import { BOTS, endgegnerDerWelt } from '../js/bots.js';
import { browserTyp } from './browser.mjs';

class Speicher { constructor() { this.m = new Map(); } getItem(k) { return this.m.get(k) ?? null; } setItem(k, v) { this.m.set(k, String(v)); } removeItem(k) { this.m.delete(k); } key(i) { return [...this.m.keys()][i] ?? null; } get length() { return this.m.size; } }
const lager = new Speicher();
setzeSpeicher(lager);

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/r19-emotes-finisher.test.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}
const root = fileURLToPath(new URL('../', import.meta.url));

const K_FORTSCHRITT = 'schach-arena:v1:fortschritt';
const K_FUNKEN = 'schach-arena:v1:modul:funken';
const K_FINISHER = 'schach-arena:v1:einstellungen:finisher';
const siege = (ids) => lager.setItem(K_FORTSCHRITT, JSON.stringify({ bots: Object.fromEntries(ids.map((id) => [id, { sterne: [true, false, false] }])) }));
const level = (n) => lager.setItem(K_FUNKEN, JSON.stringify({ level: n }));
const boss = (nr) => endgegnerDerWelt(nr).id;
const neu = () => { lager.m.clear(); };

const emotes = await import('../js/pakete/emotes/index.js');
const emoteTexte = await import('../js/pakete/emotes/texte.js');
const finisher = await import('../js/pakete/finisher/index.js');
const finTexte = await import('../js/pakete/finisher/texte.js');
const speicher = await import('../js/storage.js');
const L = await import('../js/pakete/funken/level.js');
const funkenTexte = await import('../js/pakete/funken/texte.js');

const WELT_KREATUR = ['karo', 'stups', 'zinni', 'klippa', 'glimm'];
const WELT_FINISHER = ['krone', 'welle', 'koenig'];
const SHOP_FINISHER = ['kronensturz', 'blitzschlag', 'goldregen', 'schockwelle'];
const STICKER_LEVEL = { krone: 12, feuer: 18, herz: 24, springer: 30, blitz: 36, diamant: 42 };
const teil = (liste, id) => liste.find((x) => x.id === id);

// ---------- Neuer Spielstand ----------
neu();
pruefe('Neuer Spielstand: keine Kreatur frei', [...WELT_KREATUR, 'kronli'].every((id) => emotes.kreaturFrei?.(id) === false));
pruefe('Neuer Spielstand: kein neuer Sticker frei', Object.keys(STICKER_LEVEL).every((id) => emotes.stickerFrei?.(id) === false));
pruefe('Neuer Spielstand: kein Finisher frei, die Wahl ist aus', [...WELT_FINISHER, ...SHOP_FINISHER].every((id) => !finisher.istFrei(id)) && finisher.auswahl() === 'aus');
pruefe('Neuer Spielstand: das Rad zeigt die acht Grund-Sticker', emotes.radEintraege(null, emotes.freieSticker?.() ?? ['x']).length === 8);

// ---------- Welt-Endgegner ----------
WELT_KREATUR.forEach((id, i) => {
  const nr = i + 1;
  neu(); siege([boss(nr)]);
  pruefe(`Welt ${nr}: Endgegner ${boss(nr)} schaltet Kreatur ${id} frei`, emotes.kreaturFrei?.(id) === true);
  pruefe(`Welt ${nr}: die anderen Kreaturen bleiben zu`, [...WELT_KREATUR, 'kronli'].filter((k) => k !== id).every((k) => emotes.kreaturFrei?.(k) === false));
  const fin = WELT_FINISHER[i];
  pruefe(`Welt ${nr}: Finisher ${fin || '(keiner)'} frei, nur dieser`, [...WELT_FINISHER, ...SHOP_FINISHER].every((f) => finisher.istFrei(f) === (f === fin)));
});
neu(); siege(BOTS.filter((b) => b.welt === 1 && !b.endgegner).map((b) => b.id));
pruefe('Alle Bots von Welt 1 ohne Janine: Karo und Krone bleiben zu', emotes.kreaturFrei?.('karo') === false && !finisher.istFrei('krone'));

// ---------- Kronli ----------
neu(); siege([1, 2, 3, 4, 5].map(boss));
pruefe('Alle 5 Endgegner reichen fuer Kronli nicht', emotes.kreaturFrei?.('kronli') === false && WELT_KREATUR.every((id) => emotes.kreaturFrei?.(id) === true));
const ohneEinen = BOTS.map((b) => b.id).slice(1);
neu(); siege(ohneEinen);
pruefe('Ein Bot fehlt: Kronli bleibt zu', emotes.kreaturFrei?.('kronli') === false && speicher.alleBotsBesiegt?.(ladeFortschritt()) === false);
neu(); siege(BOTS.map((b) => b.id));
pruefe('Alle Bots aller Welten: Kronli frei', emotes.kreaturFrei?.('kronli') === true && speicher.alleBotsBesiegt?.(ladeFortschritt()) === true);
pruefe('endgegnerBesiegt liest den ersten Stern des Endgegners', speicher.endgegnerBesiegt?.(1, { bots: { [boss(1)]: { sterne: [true, false, false] } } }) === true
  && speicher.endgegnerBesiegt?.(1, { bots: { [boss(1)]: { sterne: [false, true, false] } } }) === false && speicher.endgegnerBesiegt?.(9, { bots: {} }) === false);

// ---------- Sticker und Funken-Level ----------
for (const [id, lv] of Object.entries(STICKER_LEVEL)) {
  neu(); level(lv - 1);
  const vorher = emotes.stickerFrei?.(id);
  level(lv);
  pruefe(`Sticker ${id}: frei ab Level ${lv}, nicht davor`, vorher === false && emotes.stickerFrei?.(id) === true);
  const st = L.alleStuecke().filter((s) => s.id === 'emote-' + id);
  pruefe(`Sticker ${id}: steht genau einmal auf Level ${lv} der Leiter und ist nutzbar`, st.length === 1 && st[0].level === lv && st[0].art === 'emote' && L.nutzbar(st[0]), st);
  pruefe(`Sticker ${id}: Name auf Deutsch und Englisch`, !!funkenTexte.DE['stueck.emote-' + id] && !!funkenTexte.EN['stueck.emote-' + id]);
}
neu(); level(18);
const rad = emotes.radEintraege(null, emotes.freieSticker?.() ?? []);
pruefe('Level 18: das Rad zeigt hinter den acht Stickern Krone und Feuer', rad.length === 10 && rad.slice(8).map((e) => e.id).join() === 'krone,feuer'
  && rad.slice(8).every((e) => e.schluessel === 'emote.' + e.id && /emote-premium/.test(e.svg)), rad.map((e) => e.id));
pruefe('Jeder neue Sticker hat eine Art fuer die Bot-Antwort', Object.keys(STICKER_LEVEL).every((id) => emotes.ANTWORT_ART[emotes.ARTEN['emote.' + id]]));

// ---------- Kreatur im Rad ----------
neu();
pruefe('Kreatur nicht frei: das Rad zeigt sie nicht, auch wenn die Einstellung sie nennt', emotes.kreaturAktiv({ kreatur: 'karo' }) === null);
siege([boss(1)]);
pruefe('Kreatur frei: das Rad zeigt sie ohne Erfinder-Konto', emotes.kreaturAktiv({ kreatur: 'karo' }) === 'karo' && emotes.kreaturAktiv({ kreatur: 'stups' }) === null);

// ---------- Sammlung Emotes ----------
neu(); siege([boss(1)]); level(12);
const te = emotes.teileEmotes(false);
const DE_E = emoteTexte.DE, EN_E = emoteTexte.EN;
pruefe('Sammlung: 8 Grund-Sticker, 6 neue Sticker, 6 Kreaturen', te.length === 20, te.map((x) => x.id));
pruefe('Sammlung: Karo frei und waehlbar, ohne Schild Labor', teil(te, 'kreatur-karo')?.frei === true && typeof teil(te, 'kreatur-karo')?.wahl === 'function' && !teil(te, 'kreatur-karo')?.labor);
pruefe('Sammlung: Stups gesperrt mit Weg "Besiege Ritter Thorsten"', teil(te, 'kreatur-stups')?.frei === false && teil(te, 'kreatur-stups')?.zeile === 'Besiege Ritter Thorsten', teil(te, 'kreatur-stups')?.zeile);
pruefe('Sammlung: Kronli gesperrt mit Weg "Besiege alle Bots aller Welten"', teil(te, 'kreatur-kronli')?.frei === false && teil(te, 'kreatur-kronli')?.zeile === DE_E['weg.alleWelten'], teil(te, 'kreatur-kronli')?.zeile);
pruefe('Sammlung: gesperrte Kreatur nicht waehlbar', typeof teil(te, 'kreatur-stups')?.wahl !== 'function');
pruefe('Sammlung: Sticker Krone frei, Feuer gesperrt mit "Ab Level 18"', teil(te, 'emote-krone')?.frei === true && !teil(te, 'emote-krone')?.labor
  && teil(te, 'emote-feuer')?.frei === false && teil(te, 'emote-feuer')?.zeile === 'Ab Level 18', teil(te, 'emote-feuer')?.zeile);
pruefe('Texte DE und EN fuer die Wege', ['weg.endgegner', 'weg.level', 'weg.alleWelten'].every((k) => DE_E[k] && EN_E[k]));
pruefe('Kein Preis und kein Kauf in den Wegen', !te.some((x) => /€|preis|kauf|price|buy/i.test(x.zeile || '')));
const erfinderTeile = emotes.teileEmotes(true);
pruefe('Erfinder: alle 20 frei, neue Stuecke mit Schild Labor', erfinderTeile.length === 20 && erfinderTeile.every((x) => x.frei)
  && erfinderTeile.filter((x) => /^kreatur-/.test(x.id)).every((x) => x.labor));

// ---------- Sammlung Finisher ----------
neu(); siege([boss(1)]);
const tf = finisher.teileFinisher?.() ?? [];
pruefe('Finisher-Sammlung: sieben Stuecke, die Signatur bleibt ohne Sonderstueck unsichtbar', tf.length === 7 && !teil(tf, 'finisher-signatur'), tf.map((x) => x.id));
pruefe('Finisher-Sammlung: Krone frei, ohne Schild Labor', teil(tf, 'finisher-krone')?.frei === true && !teil(tf, 'finisher-krone')?.labor);
pruefe('Finisher-Sammlung: Welle gesperrt mit Weg "Besiege Ritter Thorsten"', teil(tf, 'finisher-welle')?.frei === false && teil(tf, 'finisher-welle')?.zeile === 'Besiege Ritter Thorsten', teil(tf, 'finisher-welle')?.zeile);
pruefe('Finisher-Sammlung: die vier Shop-Finisher gesperrt mit "Bald im Shop"', SHOP_FINISHER.every((id) => teil(tf, 'finisher-' + id)?.frei === false && teil(tf, 'finisher-' + id)?.zeile === finTexte.DE.bald)
  && finTexte.DE.bald === 'Bald im Shop' && !!finTexte.EN.bald, tf.map((x) => x.zeile));
pruefe('Finisher: Texte DE und EN fuer den Weg', !!finTexte.DE['weg.endgegner'] && !!finTexte.EN['weg.endgegner']);
neu(); siege(BOTS.map((b) => b.id)); level(100);
pruefe('Shop-Finisher bleiben auch mit allen Siegen und Level 100 zu', SHOP_FINISHER.every((id) => !finisher.istFrei(id)));

// ---------- Wahl des Finishers ----------
neu(); siege([boss(1)]);
pruefe('Nach dem Sieg ueber Janine laeuft die Krone von selbst', finisher.auswahl() === 'krone');
lager.setItem(K_FINISHER, JSON.stringify({ auswahl: 'aus' }));
pruefe('Wer den Finisher abgeschaltet hat, bleibt bei aus', finisher.auswahl() === 'aus');
lager.setItem(K_FINISHER, JSON.stringify({ auswahl: 'welle' }));
pruefe('Eine gesperrte Wahl spielt nicht', finisher.auswahl() === 'aus');

// ---------- Shop ----------
const AUSLAGE = JSON.parse(readFileSync(path.join(root, 'assets/shop/auslage.json'), 'utf8'));
pruefe('Shop: kein erspielbarer Sticker mehr im Regal', (AUSLAGE.regale.emote || []).length === 0, AUSLAGE.regale.emote);
pruefe('Shop: im Finisher-Regal nur Blitzschlag, Goldregen, Schockwelle', AUSLAGE.regale.finisher.map((x) => x.id).join() === 'blitzschlag,goldregen,schockwelle', AUSLAGE.regale.finisher);
pruefe('Shop: Kronensturz bleibt auf dem festen Platz', AUSLAGE.plaetze.find((p) => p.art === 'finisher')?.id === 'kronensturz');

// ---------- Browser: das volle Rad passt aufs iPhone 13 ----------
const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt (PLAYWRIGHT_PFAD setzen)');
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (q, r) => {
  const p = path.resolve(root, '.' + decodeURIComponent(new URL(q.url, 'http://test').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(path.resolve(root))) { r.writeHead(403); r.end(); return; }
  try { const d = await readFile(p); r.writeHead(200, { 'Content-Type': TYPEN[path.extname(p)] || 'application/octet-stream' }); r.end(d); }
  catch (e) { r.writeHead(404); r.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASIS = `http://127.0.0.1:${server.address().port}/index.html?test&kern&erw=pakete/emotes/index&emotes`;
const browser = await browserTyp(pw).launch({ headless: true });
try {
  const k = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Europe/Berlin' });
  await k.route(/supabase\.co/, (r) => r.abort());
  await k.addInitScript(([schluessel, wert]) => { localStorage.setItem(schluessel, wert); }, [K_FUNKEN, JSON.stringify({ level: 42 })]);
  const s = await k.newPage();
  const fehler = [];
  s.on('pageerror', (e) => fehler.push(e.message));
  await s.goto(BASIS + '#arena');
  await s.waitForFunction(() => !!window.__app && !!document.querySelector('link[data-paket="emotes"]') && !!document.documentElement.dataset.screen, null, { timeout: 30000 });
  await s.evaluate(() => { window.__test = { botPause: 30, maxWarten: 0, botZug: () => window.__partie.chess().moves({ verbose: true }).map((m) => m.lan).sort()[0] }; });
  await s.evaluate(() => window.__app.gehe('partie', { botId: 'benno' }));
  await s.waitForFunction(() => window.__partie && window.__partie.phase() === 'flo' && document.querySelectorAll('.em-aktion').length === 2, null, { timeout: 30000 });
  await s.locator('.em-aktion[data-emote-aktion="emotes"]').click({ timeout: 5000 });
  await s.waitForSelector('.em-popup .em-wahl', { timeout: 5000 });
  const m = await s.evaluate(() => {
    const p = document.querySelector('.em-popup'), r = p.getBoundingClientRect();
    const w = [...p.querySelectorAll('.em-wahl')];
    return { zahl: w.length, ids: w.map((x) => x.dataset.wert), innen: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
      scrollt: p.scrollHeight > p.clientHeight + 1, klein: w.filter((x) => { const b = x.getBoundingClientRect(); return b.height < 44 || b.width < 44; }).length };
  });
  pruefe('iPhone 13, Level 42: das Rad zeigt alle 14 Sticker', m.zahl === 14 && m.ids.slice(8).join() === 'krone,feuer,herz,springer,blitz,diamant', m.ids);
  pruefe('iPhone 13: das Rad steht ganz im Bild und scrollt nicht', m.innen && !m.scrollt, m);
  pruefe('iPhone 13: jeder Eintrag mindestens 44 px', m.klein === 0, m);
  await s.locator('.em-popup .em-wahl[data-wert="diamant"]').click({ timeout: 5000 });
  await s.waitForSelector('.em-blase.em-eigen svg.emote-premium', { timeout: 5000 }).catch(() => {});
  const blase = await s.evaluate(() => { const b = document.querySelector('.em-blase.em-eigen'); return b ? { sticker: b.querySelector('svg.emote-premium')?.dataset.emote, text: b.textContent.trim() } : null; });
  pruefe('iPhone 13: ein freigespielter Sticker laesst sich senden und erscheint in der Blase', blase?.sticker === 'diamant', blase);
  pruefe('iPhone 13: keine Seitenfehler', fehler.length === 0, fehler.slice(0, 2));
  await k.close();
} finally {
  await browser.close();
  server.close();
}

console.log(`\nr19-emotes-erspielbar: ${ok} von ${gesamt} ok`);
process.exit(ok === gesamt ? 0 : 1);
