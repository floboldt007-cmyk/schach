// Kernprobe R15 (Feinschliff 13.11.2026, Flo: "wenn ich suche und auch jemand anders sucht, gleichzeitig online, dass
// man dann direkt gematcht wird und Elo sieht und die Banner sieht"). ZWEI Browser-Sitzungen tippen im selben Moment
// auf "Gegner suchen" und spielen gegen EINEN nachgebauten Server (jede Anfrage an *.supabase.co beantwortet die
// Attrappe unten, nie das echte Projekt). Je Sitzung geprueft:
//   - beide landen ohne Wartezeit in derselben gewerteten Partie (hoechstens SOFORT_MS ab dem Tipp)
//   - Spielerleiste oben: Name, Banner, Titel, Profilbild und "Elo <n> · <Liga>" des Gegners
//   - Duell-Intro: Name, Elo, Liga, Titel, Erfolge und Banner des Gegners
//   - Sondertitel: das Erfinder-Konto meldet seinen Titel (karte_sondertitel_waehle), der Gegner sieht "Der Erfinder";
//     das Pionier-Konto Nr. 7 entsprechend "Pionier Nr. 7" (die Attrappe zeigt ihn nur nach der Meldung, wie das SQL)
//   - zweites Paar ohne Feld elo (karte-elo-schema.sql noch nicht eingespielt): Liga statt Elo
//
//   node tests/online-suche-gleichzeitig.test.mjs        PORT=9640 fuer einen festen Port
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Chess } from '../vendor/chess/chess.js';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
let pw;
for (const p of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
  try { pw = require(p); break; } catch (e) { /* naechster */ }
}
if (!pw) throw new Error('Playwright fehlt');
const root = fileURLToPath(new URL('../', import.meta.url));
const typen = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.resolve(root, '.' + new URL(req.url, 'http://test').pathname.replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try { res.writeHead(200, { 'Content-Type': typen[path.extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p)); }
  catch (e) { res.writeHead(404); res.end(); }
});
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

// Abfragetakt der Suche 1 s (js/gegnersuche.js alleMs): wer zuerst ankommt, findet den anderen beim naechsten Takt
const SOFORT_MS = 2500;
const token = uid => 'a.' + Buffer.from(JSON.stringify({ sub: uid })).toString('base64url') + '.x';
const sitzungVon = uid => ({ access_token: token(uid), refresh_token: 'test-r-' + uid, expires_at: 9999999999, user: { id: uid, email: uid + '@example.invalid' } });
// u1/u2: gewertetes SQL mit Elo, u1 Erfinder, u2 Pionier Nr. 7. u3/u4: ohne Elo im Server (altes SQL), ohne Sondertitel
const KONTEN = {
  u1: { name: 'Erfinderin', elo: 1530, stufe: 9, banner: 'saison-gold', titel: null, stuecke: ['erfinder-titel'], vitrine: [{ familie: 'siege', stufe: 2 }] },
  u2: { name: 'Pionierin', elo: 1210, stufe: 4, banner: 'saison-silber', titel: null, stuecke: ['pionier-007'], vitrine: [{ familie: 'raetsel', stufe: 1 }] },
  u3: { name: 'Ohne_Elo_A', elo: null, stufe: 6, banner: 'saison-bronze', titel: 'erfolg-feuertaufe', stuecke: [], vitrine: [{ familie: 'siege', stufe: 1 }] },
  u4: { name: 'Ohne_Elo_B', elo: null, stufe: 2, banner: 'erfolg-raetselmeister', titel: 'erfolg-feuertaufe', stuecke: [], vitrine: [] },
};
const MIT_ELO = new Set(['u1', 'u2']);
// Hochformat-Handys und Tablet wie gleichheit-ansichten; dort quetschten Banner und Vitrine das Portraet (Kalt-Review)
// u1 kleinstes Handy, u2 iPhone 13 (beide lange Fassung hochkant), u3 hochkant kurze Fassung (Gegner ohne Erfolge),
// u4 quer lange Fassung
const FENSTER = { u1: { width: 360, height: 640 }, u2: { width: 390, height: 844 }, u3: { width: 390, height: 844 }, u4: { width: 1180, height: 820 } };
const START_FEN = new Chess().fen();

let ok = 0, gesamt = 0, stamp = Date.now(), nummer = 0;
const partien = new Map(), schlange = new Map(), sondertitel = new Map(), fehler = [], unerwartet = [];
const jetzt = () => Date.now();
const aktualisieren = p => { p.aktualisiert_am = new Date(Math.max(++stamp, jetzt())).toISOString(); stamp = Date.parse(p.aktualisiert_am); return p; };
const farbeVon = (p, uid) => (p.weiss === uid ? 'w' : p.schwarz === uid ? 'b' : null);
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  console.log(`${gut ? 'OK' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
  return gut;
}

// ---- Server-Attrappe (wie supabase/zwei-ligen-schema.sql: Paaren in der Ranked-Zeit, laufende Partie geht vor) ----
const laufende = uid => [...partien.values()].filter(p => p.gewertet && p.status === 'laeuft' && farbeVon(p, uid)).sort((a, b) => Date.parse(b.erstellt_am) - Date.parse(a.erstellt_am))[0] || null;
function paaren(uid) {
  const ich = schlange.get(uid); if (!ich) return null;
  const g = [...schlange.entries()].filter(([u, q]) => u !== uid && q.zeit === ich.zeit && !laufende(u)).sort((a, b) => a[1].seit - b[1].seit)[0];
  if (!g) return null;
  const [w, s] = Math.random() < 0.5 ? [uid, g[0]] : [g[0], uid];
  const p = aktualisieren({ id: 'gleich-' + ++nummer, code: null, weiss: w, schwarz: s, erstellt_von: g[0], gewertet: true, status: 'laeuft',
    fen: START_FEN, am_zug: 'w', zuege: '', ergebnis: null, grund: null, remis_angebot: null, bedenkzeit_s: 300, inkrement_s: 3,
    uhr_weiss_ms: 300000, uhr_schwarz_ms: 300000, letzter_zug_am: new Date().toISOString(), erstellt_am: new Date().toISOString() });
  partien.set(p.id, p); schlange.delete(uid); schlange.delete(g[0]);
  return p;
}
const warten = uid => { const q = schlange.get(uid); return q ? { wartet: true, seit: new Date(q.seit).toISOString(), warte_s: 30, ki_ab_s: 10, zeit: '5+3' } : null; };
// wie karte_von mit supabase/karte-sondertitel-schema.sql: ein gewaehlter Titel geht vor; sonst der gemeldete
// Sondertitel, solange das Konto das Stueck besitzt
function titelVon(u) {
  const k = KONTEN[u];
  if (k.titel) return k.titel;
  const s = sondertitel.get(u);
  if (s === 'erfinder' && k.stuecke.includes('erfinder-titel')) return 'erfinder';
  const pi = k.stuecke.find(x => /^pionier-\d{3}$/.test(x));
  if (s === 'pionier' && pi) return pi;
  return null;
}
function karte(u, uid, p) {
  const k = KONTEN[u];
  const d = { name: k.name, banner: k.banner, titel: titelVon(u), vitrine: k.vitrine, motiv: 'Q', grund: 'standard', rahmen: 'ohne', kronen_stufe: k.stufe, du: u === uid };
  if (p.gewertet && MIT_ELO.has(u)) d.elo = k.elo;
  return d;
}

async function bediene(route) {
  const req = route.request(), url = new URL(req.url());
  let body = {}; try { body = req.postDataJSON() || {}; } catch (e) { body = {}; }
  const auth = (req.headers().authorization || '').replace(/^Bearer\s+/, '');
  let uid = null; try { uid = JSON.parse(Buffer.from(auth.split('.')[1] || '', 'base64url').toString()).sub || null; } catch (e) { uid = null; }
  const antwort = (d, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(d) });
  const absage = (status, message) => antwort({ message, fehler: message }, status);
  if (url.pathname.startsWith('/auth/v1/')) return antwort(uid ? { id: uid, email: uid + '@example.invalid' } : {});
  if (url.pathname === '/rest/v1/spielstaende') return antwort([]);
  if (url.pathname === '/rest/v1/sonderstuecke') {
    // die Erfinderin bekommt ihre Stuecke langsam (3 s): die Meldung des Sondertitels darf dabei nicht verloren gehen
    if (uid === 'u1') await new Promise(r => setTimeout(r, 3000));
    return antwort(uid ? KONTEN[uid].stuecke.map(stueck_id => ({ stueck_id })) : []);
  }
  if (url.pathname === '/rest/v1/profile') return antwort(uid ? [{ user_id: uid, benutzername: KONTEN[uid].name }] : []);
  if (/freigabe/.test(url.pathname)) return antwort([]);
  if (url.pathname === '/rest/v1/partien_online') {
    if (url.searchParams.has('status')) return antwort([...partien.values()].filter(p => p.status === 'beendet' && farbeVon(p, uid)));
    const p = partien.get((url.searchParams.get('id') || '').slice(3));
    const seit = (url.searchParams.get('aktualisiert_am') || '').slice(3);
    return antwort(p && farbeVon(p, uid) && (!seit || p.aktualisiert_am > seit) ? [p] : []);
  }
  if (!uid) return absage(401, 'KRONEN_ANMELDUNG');
  const rpc = url.pathname.split('/').at(-1), p = partien.get(body.partie);
  if (rpc === 'kronen_mein_stand') return antwort({ stufe: KONTEN[uid].stufe, kronen: 140, platz: 3, ziel: 120, n: 30, woche: '2026-11-09' });
  if (rpc === 'online_suche_start') {
    const lauf = laufende(uid); if (lauf) return antwort({ partie: lauf.id });
    const alt = schlange.get(uid); schlange.set(uid, { zeit: '5+3', seit: alt ? alt.seit : jetzt() });
    const neu = paaren(uid); if (neu) return antwort({ partie: neu.id });
    return antwort(warten(uid));
  }
  if (rpc === 'online_suche_stand') {
    const lauf = laufende(uid) || paaren(uid); if (lauf) return antwort({ partie: lauf.id });
    return antwort(warten(uid) || { wartet: true });
  }
  if (rpc === 'online_suche_ende') { schlange.delete(uid); return antwort({}); }
  if (rpc === 'online_live_bewertung_frei') return antwort({ frei: true, rest: 1, unbegrenzt: false });
  if (rpc === 'online_meine') return antwort([...partien.values()].filter(q => q.status !== 'beendet' && farbeVon(q, uid)));
  if (rpc === 'online_pruefe_zeit' && p) return antwort(p);
  if (rpc === 'karte_melde_stufen' || rpc === 'karte_waehle') return antwort({ taler: 0, stufen: {}, banner: ['start'], wahl: { banner: 'start' } });
  if (rpc === 'karte_sondertitel_waehle') {
    const t = body.titel ?? null, st = KONTEN[uid].stuecke;
    if (t !== null && !(t === 'erfinder' && st.includes('erfinder-titel')) && !(t === 'pionier' && st.some(x => /^pionier-\d{3}$/.test(x)))) return absage(400, 'KARTE_TITEL');
    if (t === null) sondertitel.delete(uid); else sondertitel.set(uid, t);
    return antwort({ titel: t });
  }
  if (rpc === 'karte_der_partie') return antwort(p && farbeVon(p, uid) ? { w: karte(p.weiss, uid, p), s: karte(p.schwarz, uid, p) } : {});
  unerwartet.push(`${uid} ${req.method()} ${url.pathname}`); return antwort([]);
}

// ---- Browser ----
let browser;
async function neuerKontext(uid) {
  const k = await browser.newContext({ viewport: FENSTER[uid], hasTouch: true, serviceWorkers: 'block', locale: 'de-DE', timezoneId: 'Europe/Berlin', colorScheme: 'light' });
  await k.route('**/*.supabase.co/**', bediene);
  await k.addInitScript(({ s }) => {
    localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(s));
    // Intro immer und mit Bewegung, sonst gaebe es nichts zu sehen; Klang aus
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'normal', duellIntro: 'immer' }));
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    // Duell-Intro festhalten: es legt sich nur Sekunden ueber die Partie
    window.__intros = [];
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) {
        if (!(n instanceof HTMLElement) || !n.classList.contains('duell')) continue;
        const bot = n.querySelector('.duell-seite.bot');
        const rec = {
          art: n.dataset.art, html: n.innerHTML,
          name: bot?.querySelector('.duell-name')?.textContent.trim() || '',
          unter: bot?.querySelector('.duell-unter')?.textContent.trim() || '',
          chip: n.querySelector('.duell-chip')?.textContent.trim() || '',
          titel: bot?.querySelector('.duell-titel')?.textContent.trim() || '',
          orden: [...(bot?.querySelectorAll('.duell-orden') || [])].map(o => o.textContent.trim()),
          banner: [...(bot ? [bot, ...bot.querySelectorAll('*')] : [])].map(e => e.getAttribute('style') || '').join(' '),
          lang: n.classList.contains('lang'), av: null,
        };
        window.__intros.push(rec);
        // Hoehe des Gegner-Portraets, wenn das Layout steht (offsetHeight ohne die Flug-Transformation)
        setTimeout(() => {
          rec.av = n.querySelector('.duell-av[data-rolle="bot"]')?.offsetHeight ?? null;
          rec.avFlo = n.querySelector('.duell-av[data-rolle="flo"]')?.offsetHeight ?? null;
          // Lage ohne die Flug-Transformation: Abstand zur Seitenoberkante ueber die offsetParent-Kette
          const oben = (e) => { let y = 0; for (; e; e = e.offsetParent) y += e.offsetTop; return y; };
          const av = n.querySelector('.duell-av[data-rolle="bot"]'), chip = n.querySelector('.duell-chip');
          rec.avOben = av ? oben(av) : null;
          rec.chipUnten = chip ? oben(chip) + chip.offsetHeight : null;
          rec.bannerSichtbar = (n.querySelector('.duell-seite.bot .duell-banner')?.offsetHeight || 0) > 0;
        }, 1200);
      }
    }).observe(document, { childList: true, subtree: true });
  }, { s: sitzungVon(uid) });
  const seite = await k.newPage(); seite.setDefaultTimeout(15000);
  seite.on('pageerror', e => fehler.push(`${uid}: ${e.message}`));
  seite.uid = uid;
  return { k, seite };
}
// wie live: alle Pakete (ohne kern), damit die Sammlung die Titel und Erfolge des Gegners benennt
const START = () => `http://127.0.0.1:${PORT}/?test`;
const sucheBereit = s => s.waitForFunction(() => ['bereit', 'laufend'].includes(document.querySelector('.on-art[data-art="partie"]')?.dataset.zustand), null, { timeout: 15000 });
const imSpiel = s => s.waitForFunction(() => window.__online?.brett() && window.__online.partie()?.status === 'laeuft' && window.__online.partie().id, null, { timeout: 12000 })
  .then(h => h.jsonValue()).catch(() => null);

// Was eine Sitzung vom Gegner in der oberen Leiste sieht
const leisteOben = s => s.evaluate(() => {
  const el = document.querySelector('.on-oben');
  return {
    name: el?.querySelector('.name b')?.textContent.trim() || '',
    titel: el?.querySelector('.on-titel')?.textContent.trim() || '',
    meta: el?.querySelector('.p-meta')?.textContent.trim() || '',
    banner: el?.querySelector('.on-banner')?.getAttribute('style') || '',
    avatar: !!el?.querySelector('.av svg, .av img'),
  };
});

async function paar(ua, ub, { elo }) {
  const a = await neuerKontext(ua), b = await neuerKontext(ub);
  await Promise.all([a, b].map(async ({ seite }) => { await seite.goto(START() + '#online'); await sucheBereit(seite); }));
  // die Karte meldet sich beim Start (app:bereit); erst danach suchen, wie ein Spieler, der die Seite offen hat
  await Promise.all([a, b].map(({ seite }) => seite.waitForTimeout(800)));
  // Besitzer melden ihren Sondertitel; bei u1 kommen die Stuecke erst nach 3 s (laenger als die 1,5 s, die der Abgleich
  // wartet): die Meldung muss trotzdem ankommen, bevor gesucht wird
  for (let i = 0; i < 80 && [a, b].some(({ seite }) => KONTEN[seite.uid].stuecke.length && !sondertitel.has(seite.uid)); i++) await new Promise(r => setTimeout(r, 100));
  const t0 = Date.now();
  await Promise.all([a, b].map(({ seite }) => seite.locator('[data-online="suchen"]').click()));
  const ids = await Promise.all([a, b].map(({ seite }) => imSpiel(seite).then(id => ({ id, ms: Date.now() - t0 }))));
  const gleich = ids[0].id && ids[0].id === ids[1].id;
  pruefe(`${ua}+${ub}: beide suchen gleichzeitig und landen in derselben gewerteten Partie`, gleich, ids);
  pruefe(`${ua}+${ub}: ohne Wartezeit gepaart (hoechstens ${SOFORT_MS} ms ab dem Tipp)`, gleich && Math.max(ids[0].ms, ids[1].ms) <= SOFORT_MS, ids);
  if (!gleich) return [a, b];

  for (const [ich, du] of [[a, ub], [b, ua]]) {
    const g = KONTEN[du];
    // Leiste: warten, bis die Visitenkarte da ist (Name des Gegners steht oben)
    await ich.seite.waitForFunction(n => document.querySelector('.on-oben .name b')?.textContent.trim() === n, g.name, { timeout: 9000 }).catch(() => {});
    const l = await leisteOben(ich.seite);
    const erwartTitel = du === 'u1' ? 'Der Erfinder' : du === 'u2' ? 'Pionier Nr. 7' : 'Feuertaufe';
    pruefe(`${ich.seite.uid} sieht in der Leiste Name, Banner und Profilbild von ${du}`, l.name === g.name && l.banner.includes(g.banner + '.svg') && l.avatar, l);
    pruefe(`${ich.seite.uid} sieht in der Leiste den Titel von ${du} ("${erwartTitel}")`, l.titel.includes(erwartTitel), l);
    if (elo) pruefe(`${ich.seite.uid} sieht in der Leiste "Elo ${g.elo}" und die Liga von ${du}`, l.meta.startsWith(`Elo ${g.elo} · `) && l.meta.length > `Elo ${g.elo} · `.length, l);
    else pruefe(`${ich.seite.uid} sieht ohne Elo vom Server die Liga von ${du}, keine Elo`, !/Elo/.test(l.meta) && l.meta.length > 0 && !/^(Weiß|Schwarz)$/.test(l.meta), l);

    await ich.seite.waitForFunction(() => window.__intros.length > 0, null, { timeout: 9000 }).catch(() => {});
    const intro = (await ich.seite.evaluate(() => window.__intros))[0] || null;
    pruefe(`${ich.seite.uid}: Duell-Intro in voller Fassung mit Name und Liga von ${du}`, intro && intro.art === 'voll' && intro.name === g.name && intro.chip.length > 0, intro && { art: intro.art, name: intro.name, chip: intro.chip });
    if (!intro) continue;
    if (elo) pruefe(`${ich.seite.uid}: Intro zeigt "Elo ${g.elo}" von ${du}`, intro.unter.includes(`Elo ${g.elo}`), intro.unter);
    else pruefe(`${ich.seite.uid}: Intro ohne Elo vom Server zeigt keine Elo von ${du}`, !/Elo/.test(intro.unter), intro.unter);
    pruefe(`${ich.seite.uid}: Intro zeigt den Titel von ${du} ("${erwartTitel}")`, intro.titel.includes(erwartTitel), intro.titel);
    if (g.vitrine.length) pruefe(`${ich.seite.uid}: Intro zeigt die Erfolge von ${du}`, intro.orden.length === g.vitrine.length && intro.orden.every(Boolean), intro.orden);
    pruefe(`${ich.seite.uid}: Intro zeigt das Banner von ${du}`, intro.banner.includes(g.banner + '.svg'), intro.banner.slice(0, 300));
    // ein Titel allein (fast jeder Gegner traegt einen Level-Titel) macht keine lange Fassung, die die Uhr aufhaelt
    if (!g.vitrine.length) pruefe(`${ich.seite.uid}: ohne Erfolge von ${du} keine lange Fassung`, !intro.lang, { lang: intro.lang });
    const av = await ich.seite.waitForFunction(() => window.__intros[0]?.av, null, { timeout: 4000 }).then(h => h.jsonValue()).catch(() => null);
    const f = FENSTER[ich.seite.uid];
    // zum Ansehen: R15_BILDER=<ordner> legt je Konto ein Bild des stehenden Intros ab
    if (process.env.R15_BILDER) await ich.seite.screenshot({ path: path.join(process.env.R15_BILDER, `intro-${ich.seite.uid}-${f.width}x${f.height}.png`) });
    pruefe(`${ich.seite.uid} (${f.width}x${f.height}): Portraet von ${du} im Intro nicht gequetscht (mind. 56 px)`, av >= 56, { av });
    const m = await ich.seite.evaluate(() => window.__intros[0]);
    pruefe(`${ich.seite.uid} (${f.width}x${f.height}): Portraet von ${du} im Bild und unter dem Liga-Chip`, m.avOben >= 0 && m.avOben >= m.chipUnten, { avOben: m.avOben, chipUnten: m.chipUnten });
    // kurze Fassung: das Portraet des Gegners so gross wie das eigene (die Verkleinerung gilt nur der langen hochkant)
    if (!m.lang) pruefe(`${ich.seite.uid}: kurze Fassung, Portraet von ${du} so gross wie das eigene`, m.av >= m.avFlo * 0.9, { av: m.av, avFlo: m.avFlo });
    // Banner im Intro: immer, nur in der langen Fassung hochkant zeigt es allein die Leiste (oben geprueft)
    const quer = f.width > f.height;
    const erwartet = quer || !m.lang;
    pruefe(`${ich.seite.uid} (${quer ? 'quer' : 'hochkant'}, ${m.lang ? 'lang' : 'kurz'}): Banner von ${du} im Intro ${erwartet ? 'sichtbar' : 'ausgeblendet'}`, m.bannerSichtbar === erwartet, { sichtbar: m.bannerSichtbar });
  }
  return [a, b];
}

try {
  browser = await browserTyp(pw).launch({ headless: true });
  await paar('u1', 'u2', { elo: true });
  pruefe('Erfinder und Pionier haben ihren Sondertitel beim Server gemeldet', sondertitel.get('u1') === 'erfinder' && sondertitel.get('u2') === 'pionier', Object.fromEntries(sondertitel));
  await paar('u3', 'u4', { elo: false });
  pruefe('Konten ohne Sondertitel melden keinen', !sondertitel.has('u3') && !sondertitel.has('u4'), Object.fromEntries(sondertitel));
  pruefe('Keine Seitenfehler oder unerwarteten API-Aufrufe', !fehler.length && !unerwartet.length, { fehler, unerwartet: [...new Set(unerwartet)] });
} catch (e) { pruefe('Ablauf ohne Abbruch', false, e.stack); }
finally {
  if (browser) await browser.close().catch(() => {});
  server.close();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
