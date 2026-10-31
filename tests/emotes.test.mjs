// Paket Emotes: Daten, Takt (SPIELKONZEPT 3.9), Bot-Antworten und Speicher ohne Browser, dazu ein Browser-Teil (Playwright):
//   node tests/emotes.test.mjs            Node und Browser
//   node tests/emotes.test.mjs --nur-node nur der Node-Teil
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { setzeSpeicher, MODUL_BUDGET, speichereModulEinstellungen } from '../js/storage.js';
import {
  EMOTES, KREATUR_EMOTES, kreaturAktiv, radEintraege, SPERRZEIT, EMOTES_MAX, CHAT_ZUEGE, CHAT_JE_MINUTE, ANTWORTEN_MAX, ARTEN, ANTWORT_ART, ANTWORT_JE_ART, SPEICHER, antwortText, einstellungen,
  neuerStand, pruefeStand, imFenster, emoteFrei, chatFrei, nachEmote, nachChat, nachEigenemZug,
} from '../js/pakete/emotes/index.js';
import { DE, EN } from '../js/pakete/emotes/texte.js';
import { KREATUREN, KREATUR_ARTEN, kreaturSvg } from '../js/kreaturen-kunst.js';
import { setzeSprache, t } from '../js/sprache.js';
import { ZUGKLASSEN } from '../js/zugklassen.js';
import { alleBots } from '../js/bots.js';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8913);
// &emotes: seit 31.10.2026 gibt es Emotes nur noch online; die Tests pruefen Rad und Chat weiter in der Bot-Partie
const BASIS = `http://127.0.0.1:${PORT}/index.html?test&kern&erw=pakete/emotes/index&emotes`;
const NUR_NODE = process.argv.includes('--nur-node');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
// laenger als ein Pruef-Takt der Knoepfe (PRUEF_MS 500)
const PRUEF_PAUSE = 800;

let ok = 0; let fehler = 0;
function pruefe(name, wert, info = '') { if (wert) { ok++; console.log('ok   ' + name); } else { fehler++; console.log('FEHLER ' + name + ' ' + (typeof info === 'string' ? info : JSON.stringify(info))); } }
const quelle = readFileSync(new URL('../js/pakete/emotes/index.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../css/pakete/emotes.css', import.meta.url), 'utf8');

// ---------------------------------------------------------------------------
// Node-Teil
// ---------------------------------------------------------------------------
pruefe('Rad hat acht eigene SVG-Emotes', EMOTES.length === 8 && new Set(EMOTES.map((e) => e[0])).size === 8 && EMOTES.every((e) => /<path|<circle/.test(e[1])));
pruefe('Kein Spott-Emote im Rad, Applaus ist dabei, Knopf-Symbol ist nicht mehr das Lachen',
  !EMOTES.some(([id]) => /lach|wein|gaehn/.test(id)) && EMOTES.some(([id]) => id === 'applaus') && !/icon\('lachen'\)/.test(quelle));
pruefe('Schnell-Chat ohne "Oh nein!", dafuer "Ich überlege kurz."', !Object.values({ ...DE, ...EN }).some((v) => /oh nein|oh no/i.test(v)) && DE['chat.2'] === 'Ich überlege kurz.');
pruefe('Takt wie SPIELKONZEPT 3.9: ein Emote je 8 s, 6 je Partie, ein Satz je 3 eigene Zuege, 3 je Minute, 3 Bot-Antworten',
  SPERRZEIT === 8000 && EMOTES_MAX === 6 && CHAT_ZUEGE === 3 && CHAT_JE_MINUTE === 3 && ANTWORTEN_MAX === 3);
pruefe('Sperre lebt nicht mehr im Knopf: Zaehler haengen an der Partie (buehne.gemerkt/merke), Pruefung ueber emoteFrei/chatFrei',
  !/let zuletzt/.test(quelle) && /buehne\.gemerkt\(MODUL\)/.test(quelle) && /buehne\.merke\(MODUL, s\)/.test(quelle)
  && /emoteFrei\(stand\(buehne\), opt\)/.test(quelle) && /chatFrei\(stand\(buehne\), opt\)/.test(quelle));
pruefe('Gesperrt heisst sichtbar gesperrt: aria-disabled, Grund fuer Vorleser, Meldung beim Antippen, gedimmt im CSS',
  /setAttribute\('aria-disabled', 'true'\)/.test(quelle) && /aria-describedby/.test(quelle) && /k\.app\.meldung\(grundText/.test(quelle)
  && !/\.disabled = /.test(quelle) && /\.em-aktion\[aria-disabled="true"\] \{[^}]*opacity/.test(css));
pruefe('Bot antwortet verzoegert ueber die Partie-Buehne', /buehne\.spaeter/.test(quelle) && /em-botantwort/.test(quelle));
pruefe('Aus blendet beide Aktionsknoepfe aus', /if \(!einstellungen\(\)\.an\) return null/.test(quelle));
pruefe('Tastatur, Dialog und Vorlesen sind angebunden', /aria-haspopup/.test(quelle) && /aria-live/.test(quelle) && /e\.key === 'Escape'/.test(quelle));
pruefe('Vorlese-Text nutzt die Klasse sr aus app.css und wird wieder geleert',
  /className = 'em-live sr'/.test(quelle) && !/sr-only/.test(quelle) && /\.sr \{[^}]*width: 1px/.test(readFileSync(path.join(WURZEL, 'css/app.css'), 'utf8'))
  && /live\.textContent = ''/.test(quelle));
pruefe('Deutsch und Englisch sind vollstaendig', Object.keys(DE).length === Object.keys(EN).length && Object.keys(DE).every((k) => typeof EN[k] === 'string'));
pruefe('Kein freier Texteingang', !/<input[^>]+type=["']text|textarea/i.test(quelle));
pruefe('Handy und reduzierte Bewegung sind gestaltet', /max-width: 420px/.test(css) && /prefers-reduced-motion/.test(css) && /calc\(100% - 20px\)/.test(css));

// Emote-Kreaturen (Flo 30.10. abends: "verschiedene Figuren oder Kreaturen, eben in meinem Stil"; zuerst: "Alle")
{
  const svgs = KREATUREN.flatMap((k) => KREATUR_ARTEN.map((a) => kreaturSvg(k.id, a)));
  pruefe('Sechs Kreaturen: je Welt eine, dazu Kronli; jede in fuenf Ausdruecken als eigenes SVG',
    KREATUREN.length === 6 && new Set(KREATUREN.map((k) => k.id)).size === 6 && KREATUREN.filter((k) => k.welt).length === 5
    && KREATUREN.some((k) => k.id === 'kronli' && k.welt === null)
    && KREATUREN.filter((k) => k.welt).every((k) => typeof t(`bots.welten.${k.welt}.kurz`) === 'string' && !/^bots\./.test(t(`bots.welten.${k.welt}.kurz`)))
    && svgs.every((x) => /^<svg viewBox="0 0 120 120"/.test(x) && !/undefined|NaN/.test(x)) && new Set(svgs).size === svgs.length);
  const ids = (x) => [...x.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  const a = kreaturSvg('glimm', 'normal'); const b = kreaturSvg('glimm', 'normal');
  pruefe('Jedes Bild hat eigene Verlaufs-Ids (zwei Glimm auf einer Seite stoeren sich nicht)', ids(a).length === 2 && ids(a).every((i) => !ids(b).includes(i)) && ids(a).every((i) => a.includes(`url(#${i})`)));
  pruefe('Kein Spott-Ausdruck bei den Kreaturen, unbekannte Kreatur ergibt kein Bild', !KREATUR_ARTEN.some((x) => /lach|wein|gaehn|spott/.test(x)) && kreaturSvg('drache') === '');
  pruefe('Kreatur zeigt Hallo, Staunen, Nachdenken und Gut gespielt; Id, Text und Bot-Antwort bleiben die des Emotes',
    Object.keys(KREATUR_EMOTES).join() === 'hallo,staunen,denken,gut' && Object.keys(KREATUR_EMOTES).every((id) => EMOTES.some(([e]) => e === id) && ARTEN['emote.' + id])
    && Object.values(KREATUR_EMOTES).every((x) => KREATUR_ARTEN.includes(x)));
  pruefe('Labor: nur das Erfinder-Konto bekommt die Kreatur', kreaturAktiv({ kreatur: 'karo' }, true) === 'karo' && kreaturAktiv({ kreatur: 'karo' }, false) === null && kreaturAktiv({ kreatur: null }, true) === null);
  const rad = radEintraege('glimm');
  pruefe('Rad mit Kreatur: acht Eintraege, die Kreatur vorn (Hallo, Staunen, Nachdenken, Gut gespielt), danach die Strichsymbole',
    rad.length === 8 && rad.slice(0, 4).map((e) => e.id).join() === 'hallo,staunen,denken,gut' && rad.slice(0, 4).every((e) => e.kreatur && /data-kreatur="glimm"/.test(e.svg))
    && rad.slice(4).every((e) => !e.kreatur && !/kreatur/.test(e.svg)) && rad.every((e) => e.schluessel === 'emote.' + e.id && e.text === t('p-emotes.emote.' + e.id)), rad.map((e) => e.id));
  pruefe('Rad ohne Kreatur wie bisher', radEintraege(null).map((e) => e.id).join() === EMOTES.map((e) => e[0]).join() && radEintraege(null).every((e) => !e.kreatur));
  pruefe('Kreaturen bewegen sich nur, wo es passt: still bei reduzierter Bewegung und gedaempft, im Rad erst beim Zeigen',
    /prefers-reduced-motion: reduce\) \{ \.kreatur, \.kreatur \* \{ animation: none !important/.test(css) && /\.em-blase\.still \.kreatur/.test(css)
    && /\.em-wahl\.em-kreatur:not\(:hover\):not\(:focus-visible\) \.kreatur/.test(css) && /@keyframes kr-wink/.test(css));
  pruefe('Namen der Kreaturen auf Deutsch und Englisch', KREATUREN.every((k) => DE['kreatur.' + k.id] && EN['kreatur.' + k.id]));
}

// Speicher: das reservierte Budget 'ausdruck', beide Schalter kommen nach dem Laden zurueck
{
  const daten = new Map();
  setzeSpeicher({ getItem: (k) => (daten.has(k) ? daten.get(k) : null), setItem: (k, v) => daten.set(k, String(v)), removeItem: (k) => daten.delete(k), key: (i) => [...daten.keys()][i] ?? null, get length() { return daten.size; } });
  pruefe('Einstellungen liegen im Modul ausdruck (MODUL_BUDGET)', SPEICHER === 'ausdruck' && Object.hasOwn(MODUL_BUDGET, SPEICHER));
  pruefe('Standard: an, nicht gedaempft', einstellungen().an === true && einstellungen().daempfen === false);
  const r = speichereModulEinstellungen(SPEICHER, { an: false, daempfen: true });
  pruefe('Speichern gelingt', r.ok === true, r);
  pruefe('Beide Schalter gelten nach dem Laden', einstellungen().an === false && einstellungen().daempfen === true);
  pruefe('Schluessel steht im Speicher', [...daten.keys()].some((k) => /einstellungen:ausdruck$/.test(k)), [...daten.keys()]);
  speichereModulEinstellungen(SPEICHER, { an: true, daempfen: false, kreatur: 'drache' });
  const fremd = einstellungen().kreatur;
  speichereModulEinstellungen(SPEICHER, { an: true, daempfen: false, kreatur: 'kronli' });
  pruefe('Gewaehlte Kreatur kommt zurueck, eine unbekannte faellt auf keine zurueck', fremd === null && einstellungen().kreatur === 'kronli', fremd);
}

// Takt (rein, mit vorgestellter Uhr statt Warten)
{
  const frei = (st, phase, jetzt, fortgesetzt = false) => emoteFrei(st, { phase, jetzt, fortgesetzt });
  const e1 = nachEmote(neuerStand(), 1000);
  const knapp = frei(e1, 'flo', 8999);
  pruefe('8-s-Sperre: das erste Emote ist frei, 7,999 s danach gesperrt (Grund takt, 1 ms Rest), nach 8 s wieder frei',
    frei(neuerStand(), 'flo', 0).frei && !knapp.frei && knapp.grund === 'takt' && knapp.ms === 1 && frei(e1, 'flo', 9000).frei, knapp);
  let voll = neuerStand();
  for (let i = 0; i < EMOTES_MAX; i++) voll = nachEmote(voll, i * 8000);
  const gespeichert = pruefeStand(JSON.parse(JSON.stringify(voll)));
  pruefe('Hoechstens 6 Emotes je Partie: das siebte bleibt gesperrt (eine Stunde spaeter, nach der Partie, aus dem Speicher)',
    ['flo', 'ende', 'start'].every((p) => frei(voll, p, 3600000).grund === 'voll') && frei(gespeichert, 'flo', 3600000).grund === 'voll'
    && frei(nachEmote(neuerStand(), 0), 'flo', 3600000).frei);
  const fenster = Object.fromEntries(['start', 'flo', 'gezogen', 'bot', 'ende'].map((p) => [p, frei(neuerStand(), p, 0).frei ? 'frei' : frei(neuerStand(), p, 0).grund]));
  pruefe('Zeitfenster: frei vor dem ersten Zug (start, flo), nach einem Bot-Zug (flo) und nach der Partie (ende); zu, solange der Gegner nachdenkt',
    JSON.stringify(fenster) === JSON.stringify({ start: 'frei', flo: 'frei', gezogen: 'fenster', bot: 'fenster', ende: 'frei' }), fenster);
  pruefe('Zeitfenster: eine fortgesetzte Partie, in der der Bot am Zug ist (start), bleibt zu bis zu seinem Zug',
    !imFenster('start', true) && frei(neuerStand(), 'start', 0, true).grund === 'fenster' && imFenster('flo', true));
  pruefe('Uhr des Geraets laeuft zurueck: keine Dauersperre (weder Emote noch Chat)',
    frei(nachEmote(neuerStand(), 100000), 'flo', 50000).frei && chatFrei({ ...neuerStand(), c: [90000, 95000, 99000] }, { phase: 'flo', jetzt: 1000 }).frei);
  // Schnell-Chat: ein Satz je 3 eigene Zuege
  const c0 = nachChat(neuerStand(), 0);
  const reste = [];
  let c = c0;
  for (let i = 0; i < 3; i++) { const z = chatFrei(c, { phase: 'flo', jetzt: 1000 }); reste.push(z.frei ? 'frei' : `${z.grund}${z.n}`); c = nachEigenemZug(c); }
  reste.push(chatFrei(c, { phase: 'flo', jetzt: 1000 }).frei ? 'frei' : 'zu');
  pruefe('Chat: nach einem Satz gesperrt, bis 3 eigene Zuege gespielt sind (Rest 3, 2, 1, dann frei)', reste.join() === 'zuege3,zuege2,zuege1,frei', reste);
  pruefe('Chat: nach der Partie ohne die 3 Zuege gesperrt (Grund zuegeEnde), Bot-Zuege zaehlen nicht',
    chatFrei(c0, { phase: 'ende', jetzt: 1000 }).grund === 'zuegeEnde' && nachEigenemZug(neuerStand()).w === 0);
  // Schnell-Chat: hoechstens 3 je Minute (Saetze bei 0, 10 und 20 s, je 3 eigene Zuege dazwischen)
  let m = neuerStand();
  for (const ms of [0, 10000, 20000]) { m = nachChat(m, ms); for (let i = 0; i < 3; i++) m = nachEigenemZug(m); }
  const vierter = chatFrei(m, { phase: 'flo', jetzt: 30000 });
  pruefe('Chat: hoechstens 3 Saetze je Minute, der vierte wartet, bis der erste eine Minute alt ist',
    vierter.grund === 'minute' && vierter.ms === 30000 && chatFrei(m, { phase: 'flo', jetzt: 59999 }).grund === 'minute'
    && chatFrei(m, { phase: 'flo', jetzt: 60000 }).frei && nachChat(m, 60000).c.length === 3, vierter);
  const kaputt = pruefeStand({ n: 99, t: 'x', a: -3, w: 7.5, c: [1, 2, 'y', 3, 4] });
  pruefe('Stand aus partie.extra wird geprueft (Grenzen, Zahlen, hoechstens 3 Zeiten)',
    kaputt.n === EMOTES_MAX && kaputt.t === null && kaputt.a === 0 && kaputt.w === CHAT_ZUEGE && kaputt.c.join() === '2,3,4'
    && JSON.stringify(pruefeStand(null)) === JSON.stringify(neuerStand()), kaputt);
  const gross = { n: 6, t: 1761830000000, a: 3, w: 3, c: [1761830000000, 1761830000001, 1761830000002] };
  pruefe('Voller Stand passt klein in partie.extra (hoechstens 100 von EXTRA_MAX Zeichen)', JSON.stringify({ emotes: gross }).length <= 100, JSON.stringify(gross).length);
  const grundKeys = ['grund.voll', 'grund.fenster', 'grund.takt', 'grund.zuege.eins', 'grund.zuege.mehr', 'grund.zuegeEnde', 'grund.minute'];
  pruefe('Jeder Sperr-Grund hat einen Text in DE und EN', grundKeys.every((k) => DE[k] && EN[k]), grundKeys.filter((k) => !DE[k] || !EN[k]));
  setzeSprache('de');
  pruefe('Sperr-Texte: Einzahl und Mehrzahl, Platzhalter gefuellt', t('p-emotes.grund.zuege', { n: 1 }) === DE['grund.zuege.eins']
    && t('p-emotes.grund.zuege', { n: 2 }) === 'Der nächste Satz geht nach 2 eigenen Zügen.' && t('p-emotes.grund.takt', { s: 8 }).includes('8 Sekunden'));
}

// Bot-Antworten: feste Paare Eingabe -> erlaubte Antworten (DE und EN), fuer alle Bots; nie Lob auf ein Missgeschick,
// nie der Name einer Zugklasse, hoechstens 3 je Partie
{
  const eingaben = [...EMOTES.map(([id]) => 'emote.' + id), ...Array.from({ length: 6 }, (_, i) => 'chat.' + i)];
  pruefe('Jede Eingabe hat eine Art mit eigenem Antwort-Topf', eingaben.every((e) => ARTEN[e] && ANTWORT_ART[ARTEN[e]]), eingaben.filter((e) => !ARTEN[e]));
  pruefe('Uff ist ein Missgeschick und bekommt Trost', ARTEN['emote.uff'] === 'missgeschick' && ANTWORT_ART.missgeschick === 'trost');
  pruefe('Hoechstens drei Antworten je Partie', ANTWORTEN_MAX === 3 && /const antwortet = !!bot && nr < ANTWORTEN_MAX;/.test(quelle));
  for (const art of new Set(Object.values(ANTWORT_ART))) {
    pruefe(`Antworten "${art}" in DE und EN vorhanden`, Array.from({ length: ANTWORT_JE_ART }, (_, i) => `antwort.${art}.${i}`).every((k) => DE[k] && EN[k]));
  }
  const LOB_ANTWORT = { de: ['Danke!', 'Danke, das freut mich.', 'Danke, sehr nett von dir.'], en: ['Thanks!', 'Thanks, glad you think so.', 'Thank you, that’s kind.'] };
  const DENKEN = { de: ['Lass dir Zeit.', 'Nur keine Eile.', 'Ich warte gern.'], en: ['Take your time.', 'No rush.', 'Happy to wait.'] };
  const PAARE = {
    'emote.hallo': { de: ['Hallo!', 'Schön, dass du da bist!', 'Viel Spaß dir!'], en: ['Hello!', 'Good to see you!', 'Have fun!'] },
    'chat.0': { de: ['Danke, dir auch!', 'Dir auch, viel Spaß!', 'Gleichfalls!'], en: ['Thanks, you too!', 'You too, have fun!', 'Same to you!'] },
    'emote.daumen': LOB_ANTWORT, 'emote.applaus': LOB_ANTWORT, 'emote.respekt': LOB_ANTWORT, 'emote.gut': LOB_ANTWORT, 'chat.1': LOB_ANTWORT, 'chat.3': LOB_ANTWORT,
    'chat.4': { de: ['Gern!', 'Gern geschehen!', 'Sehr gern.'], en: ['You’re welcome!', 'My pleasure!', 'Anytime!'] },
    'emote.uff': { de: ['Passiert jedem.', 'Kopf hoch, weiter geht’s.', 'Ruhig bleiben, das wird.'], en: ['Happens to everyone.', 'Chin up, on we go.', 'Stay calm, you’ve got this.'] },
    'emote.denken': DENKEN, 'chat.2': DENKEN,
    'emote.staunen': { de: ['Eine spannende Partie!', 'Spannend, oder?', 'Da ist was los!'], en: ['An exciting game!', 'Exciting, isn’t it?', 'Lots going on!'] },
    'chat.5': { de: ['Gern, jederzeit!', 'Ich bin dabei!', 'Sehr gern, noch eine!'], en: ['Sure, anytime!', 'Count me in!', 'Gladly, one more!'] },
  };
  pruefe('Feste Paare decken jede Eingabe ab', eingaben.every((e) => PAARE[e]) && Object.keys(PAARE).length === eingaben.length, eingaben.filter((e) => !PAARE[e]));
  pruefe('Viel Glück bekommt nie "Hallo!", Noch eine? nie "Ich denke auch nach …"',
    !PAARE['chat.0'].de.includes('Hallo!') && !PAARE['chat.0'].en.includes('Hello!') && !PAARE['chat.5'].de.some((x) => /denke/.test(x)) && !PAARE['chat.5'].en.some((x) => /think/.test(x)));
  // Namen der Zugklassen in beiden Sprachen (Lob sieht sonst wie eine Bewertung aus)
  const klassen = [];
  for (const sp of ['de', 'en']) { setzeSprache(sp); for (const k of ZUGKLASSEN) klassen.push(k.name.toLowerCase()); }
  setzeSprache('de');
  const LOB = /gut|guter|stark|sauber|präzise|toll|super|nice|good|great|clean|strong|precise|well played|respekt|respect/i;
  const fehlerListe = [];
  const gesehen = new Map();
  for (const sp of ['de', 'en']) {
    setzeSprache(sp);
    for (const bot of alleBots()) {
      for (const e of eingaben) {
        for (let nr = 0; nr < ANTWORTEN_MAX; nr++) {
          const text = antwortText(e, bot, nr);
          if (!text || text.startsWith('p-emotes.')) fehlerListe.push(`${sp} ${bot.id} ${e}: fehlt`);
          const klein = text.toLowerCase();
          if (klassen.some((k) => klein.includes(k))) fehlerListe.push(`${sp} ${bot.id} ${e}: Zugklasse "${text}"`);
          if (ARTEN[e] === 'missgeschick' && LOB.test(text)) fehlerListe.push(`${sp} ${bot.id} ${e}: Lob "${text}"`);
          if (!PAARE[e] || !PAARE[e][sp].includes(text)) fehlerListe.push(`${sp} ${bot.id} ${e}: passt nicht "${text}"`);
          const k = `${sp} ${e}`;
          if (!gesehen.has(k)) gesehen.set(k, new Set());
          gesehen.get(k).add(text);
        }
      }
    }
  }
  setzeSprache('de');
  pruefe(`Antworten aller ${alleBots().length} Bots in DE und EN stehen in den festen Paaren, ohne Lob auf ein Missgeschick und ohne Zugklasse`,
    alleBots().length === 30 && fehlerListe.length === 0, fehlerListe.slice(0, 5));
  const fehlt = [...gesehen].filter(([k, menge]) => menge.size !== 3).map(([k]) => k);
  pruefe('Jede der drei erlaubten Antworten kommt bei den Bots auch vor (Abwechslung)', fehlt.length === 0, fehlt);
}

// ---------------------------------------------------------------------------
// Browser-Teil
// ---------------------------------------------------------------------------
function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}
async function warteAufServer(url, ms = 10000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try { const r = await fetch(url); if (r.ok) return; } catch (e) { /* noch nicht da */ }
    await warte(150);
  }
  throw new Error('Server startet nicht: ' + url);
}
async function oeffne(seite, hash) {
  await seite.goto(BASIS + hash);
  await seite.waitForFunction(() => !!window.__app && !!document.querySelector('link[data-paket="emotes"]') && !!document.querySelector('.screen'), null, { timeout: 20000 });
}
async function partie(seite, params = { botId: 'benno' }) {
  await seite.evaluate((p) => window.__app.gehe('partie', p), params);
  await seite.waitForSelector('.partie .ort-aktionen, .partie', { timeout: 20000 });
  await warte(400);
}
// Bot zieht sofort und vorhersehbar (erster Zug in Sortierung), Flo wartet nie auf die Bewertung
const SCHNELLER_BOT = () => { window.__test = { botPause: 30, maxWarten: 0, botZug: () => window.__partie.chess().moves({ verbose: true }).map((m) => m.lan).sort()[0] }; };
async function warteFlo(seite) {
  await seite.waitForFunction(() => window.__partie && window.__partie.phase() === 'flo' && document.querySelectorAll('.em-aktion').length === 2, null, { timeout: 30000 });
}
async function waehle(seite, art, wert) {
  await seite.locator(`.em-aktion[data-emote-aktion="${art}"]`).click({ timeout: 5000 });
  await seite.locator(`.em-popup .em-wahl[data-wert="${wert}"]`).click({ timeout: 5000 });
}
// Zustand eines Aktionsknopfs: gesperrt (aria-disabled), Grund, Text fuer Vorleser, Deckkraft, fokussierbar
const knopf = (seite, art) => seite.evaluate((a) => {
  const b = document.querySelector(`.em-aktion[data-emote-aktion="${a}"]`);
  if (!b) return null;
  const id = b.getAttribute('aria-describedby');
  return { gesperrt: b.getAttribute('aria-disabled') === 'true', grund: b.dataset.emGrund || '', text: id ? (document.getElementById(id) || {}).textContent || '' : '',
    deckkraft: Number(getComputedStyle(b).opacity), fokus: !b.disabled && b.tabIndex >= 0 };
}, art);
async function warteKnopf(seite, art, gesperrt, ms = 3000) {
  try {
    await seite.waitForFunction(([a, g]) => { const b = document.querySelector(`.em-aktion[data-emote-aktion="${a}"]`); return !!b && (b.getAttribute('aria-disabled') === 'true') === g; }, [art, gesperrt], { timeout: ms });
  } catch (e) { /* die Pruefung danach meldet den Stand */ }
  return knopf(seite, art);
}
// Uhr der Seite vorstellen statt zu warten (Date.now springt, die Zeit laeuft danach normal weiter)
async function uhrVor(seite, ms) { const jetzt = await seite.evaluate(() => Date.now()); await seite.clock.setSystemTime(jetzt + ms); }
async function beobachte(seite) {
  await seite.evaluate(() => {
    window.__emAntworten = [];
    if (window.__emBeobachter) return;
    window.__emBeobachter = new MutationObserver((liste) => { for (const m of liste) for (const n of m.addedNodes) if (n.classList && n.classList.contains('em-botantwort')) window.__emAntworten.push(n.textContent); });
    window.__emBeobachter.observe(document.body, { childList: true, subtree: true });
  });
}
const antworten = (seite) => seite.evaluate(() => window.__emAntworten.slice());
const toast = (seite) => seite.evaluate(() => (document.querySelector('.toast-ort .toast') || {}).textContent || '');
const popupOffen = (seite) => seite.evaluate(() => !!document.querySelector('.em-popup'));
// Antippen wie ein Finger (ohne Playwrights Warten auf "enabled": aria-disabled zaehlt dort als gesperrt)
async function tippe(seite, art) {
  const r = await seite.locator(`.em-aktion[data-emote-aktion="${art}"]`).boundingBox();
  await seite.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  await warte(150);
}
async function taste(seite, art, key = 'Enter') {
  await seite.locator(`.em-aktion[data-emote-aktion="${art}"]`).focus();
  await seite.keyboard.press(key);
  await warte(150);
  return seite.evaluate((a) => document.activeElement === document.querySelector(`.em-aktion[data-emote-aktion="${a}"]`), art);
}
async function zieh(seite, von, nach) {
  const ok = await seite.evaluate(([a, b]) => window.__partie.brett.beiZug(a, b, null, { landung: 0 }), [von, nach]);
  if (!ok) throw new Error('Zug nicht moeglich: ' + von + nach);
}
const artVon = (text) => (Object.keys(DE).find((k) => /^antwort\./.test(k) && DE[k] === text) || '').split('.')[1] || '';

async function browserTeil(browser) {
  const kontext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', timezoneId: 'Europe/Berlin' });
  const seite = await kontext.newPage();
  const warnungen = [];
  const seitenfehler = [];
  seite.on('console', (m) => { if (/unbekanntes Modul/.test(m.text())) warnungen.push(m.text()); });
  seite.on('pageerror', (e) => seitenfehler.push(e.message));
  await oeffne(seite, '#arena');
  await seite.evaluate(() => localStorage.clear());

  // 1) Emote senden: der Vorlese-Text ist visuell versteckt, die Antwort ist Trost, der Text leert sich wieder
  await oeffne(seite, '#arena');
  await seite.evaluate(SCHNELLER_BOT);
  await partie(seite);
  await warteFlo(seite);
  pruefe('Browser: Partie zeigt beide Knoepfe', await seite.locator('.em-aktion').count() === 2);
  const start = { emotes: await knopf(seite, 'emotes'), chat: await knopf(seite, 'chat') };
  pruefe('Browser: vor dem ersten Zug sind Emote-Rad und Schnell-Chat frei', !start.emotes.gesperrt && !start.chat.gesperrt && start.emotes.deckkraft === 1, start);
  await beobachte(seite);
  await waehle(seite, 'emotes', 'uff');
  const live = await seite.evaluate(() => {
    const e = document.querySelector('.em-live');
    if (!e) return null;
    const r = e.getBoundingClientRect();
    const st = getComputedStyle(e);
    return { text: e.textContent, klasse: e.className, w: r.width, h: r.height, pos: st.position, ueberlauf: st.overflow };
  });
  pruefe('Browser: .em-live ist visuell versteckt (1 px, abgeschnitten) und traegt den Text fuer Vorleser',
    !!live && live.w <= 1 && live.h <= 1 && live.pos === 'absolute' && live.ueberlauf === 'hidden' && /gesendet/.test(live.text), live);

  // 2) 8-s-Sperre: sichtbar gesperrt, fokussierbar, Grund vorgelesen; Tippen und Tastatur melden den Grund statt zu schlucken
  const takt = await knopf(seite, 'emotes');
  pruefe('Browser: nach einem Emote ist das Rad sichtbar gesperrt (aria-disabled, gedimmt, Grund "8 Sekunden" fuer Vorleser, bleibt fokussierbar)',
    takt.gesperrt && takt.grund === 'takt' && /8 Sekunden/.test(takt.text) && takt.deckkraft < 0.6 && takt.fokus, takt);
  pruefe('Browser: der Schnell-Chat bleibt dabei frei', !(await knopf(seite, 'chat')).gesperrt);
  await tippe(seite, 'emotes');
  const getippt = { popup: await popupOffen(seite), toast: await toast(seite) };
  pruefe('Browser: Antippen des gesperrten Rads oeffnet nichts und meldet den Grund', !getippt.popup && /8 Sekunden/.test(getippt.toast), getippt);
  await seite.evaluate(() => document.querySelector('.toast-ort')?.replaceChildren());
  const fokusBleibt = await taste(seite, 'emotes', 'Enter');
  const getastet = { popup: await popupOffen(seite), toast: await toast(seite), fokusBleibt };
  pruefe('Browser: Tastatur (Enter) am gesperrten Rad meldet den Grund, der Fokus bleibt am Knopf', !getastet.popup && /8 Sekunden/.test(getastet.toast) && fokusBleibt, getastet);
  await warte(1300);
  const trost = Array.from({ length: ANTWORT_JE_ART }, (_, i) => DE[`antwort.trost.${i}`]);
  const erste = await antworten(seite);
  pruefe('Browser: Antwort auf "Uff" ist Trost', erste.length === 1 && trost.includes(erste[0]), erste);
  await uhrVor(seite, SPERRZEIT + 100);
  const nach8 = await warteKnopf(seite, 'emotes', false);
  pruefe('Browser: Uhr 8 s vorgestellt: das Rad ist ohne Warten wieder frei', !nach8.gesperrt && nach8.text === '' && nach8.deckkraft === 1, nach8);

  // 3) Schnell-Chat: ein Satz, dann gesperrt bis 3 eigene Zuege; Zeitfenster: zu, solange der Bot nachdenkt
  await waehle(seite, 'chat', '0');
  await warte(1300);
  const zweite = await antworten(seite);
  pruefe('Browser: "Viel Glück!" bekommt eine passende Antwort ("Danke, dir auch!" usw., nie "Hallo!")', zweite.length === 2 && artVon(zweite[1]) === 'gleichfalls', zweite);
  const chat3 = await knopf(seite, 'chat');
  pruefe('Browser: nach einem Satz ist der Chat gesperrt bis 3 eigene Zuege', chat3.gesperrt && chat3.grund === 'zuege' && /nach 3 eigenen Zügen/.test(chat3.text), chat3);
  await taste(seite, 'chat', 'Space');
  pruefe('Browser: Leertaste am gesperrten Chat meldet den Grund', !(await popupOffen(seite)) && /3 eigenen Zügen/.test(await toast(seite)));
  await seite.evaluate(() => { window.__test.botAnhalten = true; });
  await zieh(seite, 'e2', 'e4');
  const denkt = await warteKnopf(seite, 'emotes', true);
  pruefe('Browser: Zeitfenster: waehrend der Bot nachdenkt, ist das Rad gesperrt (Grund fenster)', denkt.gesperrt && denkt.grund === 'fenster'
    && /direkt nach einem Zug von Bauer Lukas/.test(denkt.text) && ['gezogen', 'bot'].includes(await seite.evaluate(() => window.__partie.phase())), denkt);
  await taste(seite, 'emotes', 'Enter');
  pruefe('Browser: gesperrtes Zeitfenster meldet sich bei Tastatur, kein Popup', !(await popupOffen(seite)) && /nach der Partie/.test(await toast(seite)));
  const chat2 = await warteKnopf(seite, 'chat', true);
  pruefe('Browser: ein eigener Zug zaehlt (noch 2)', chat2.grund === 'zuege' && /nach 2 eigenen Zügen/.test(chat2.text), chat2);
  await seite.evaluate(() => { window.__test.botAnhalten = false; });
  await warteFlo(seite);
  const nachBot = await warteKnopf(seite, 'emotes', false);
  pruefe('Browser: direkt nach dem Bot-Zug ist das Rad wieder frei', !nachBot.gesperrt, nachBot);
  await zieh(seite, 'd2', 'd4');
  await warteFlo(seite);
  const chat1 = await warteKnopf(seite, 'chat', true);
  pruefe('Browser: nach dem zweiten eigenen Zug heisst es "nach deinem nächsten Zug"', chat1.gesperrt && chat1.text === DE['grund.zuege.eins'], chat1);
  await zieh(seite, 'g1', 'f3');
  await warteFlo(seite);
  const chat0 = await warteKnopf(seite, 'chat', false);
  pruefe('Browser: nach 3 eigenen Zuegen ist der Chat wieder frei', !chat0.gesperrt, chat0);

  // 4) Grenzen haengen an der Partie: Einstellungen und zurueck, dann Neuladen
  await waehle(seite, 'emotes', 'hallo');
  await warte(1300);
  const dritte = await antworten(seite);
  pruefe('Browser: dritte Antwort, Gruss ergibt Gruss', dritte.length === ANTWORTEN_MAX && artVon(dritte[2]) === 'gruss', dritte);
  await seite.locator('.partie .kopf [data-aktion="einstellungen"]').click();
  await seite.waitForSelector('.screen [data-aktion="zurueck"]', { timeout: 20000 });
  await seite.locator('.screen [data-aktion="zurueck"]').first().click();
  await warteFlo(seite);
  const zurueck = await knopf(seite, 'emotes');
  pruefe('Browser: nach "Einstellungen und zurueck" gilt die 8-s-Sperre weiter (Knopf neu gebaut, Stand aus der Partie)', zurueck.gesperrt && zurueck.grund === 'takt', zurueck);
  await beobachte(seite);
  await uhrVor(seite, SPERRZEIT + 100);
  await warteKnopf(seite, 'emotes', false);
  await waehle(seite, 'emotes', 'daumen');
  await warte(1600);
  pruefe('Browser: nach "Einstellungen und zurueck" antwortet der Bot nicht ein viertes Mal', (await antworten(seite)).length === 0, await antworten(seite));
  for (const id of ['applaus', 'respekt']) {
    await uhrVor(seite, SPERRZEIT + 100);
    await warteKnopf(seite, 'emotes', false);
    await waehle(seite, 'emotes', id);
  }
  await seite.reload();
  await seite.waitForFunction(() => !!window.__app && !!document.querySelector('link[data-paket="emotes"]'), null, { timeout: 20000 });
  await warteFlo(seite);
  await beobachte(seite);
  const geladen = await knopf(seite, 'emotes');
  pruefe('Browser: nach dem Neuladen gilt die 8-s-Sperre weiter', geladen.gesperrt && geladen.grund === 'takt', geladen);
  await uhrVor(seite, SPERRZEIT + 100);
  await warteKnopf(seite, 'emotes', false);
  await waehle(seite, 'emotes', 'staunen');
  await warte(1600);
  pruefe('Browser: nach dem Neuladen antwortet der Bot nicht ein viertes Mal', (await antworten(seite)).length === 0, await antworten(seite));
  await uhrVor(seite, SPERRZEIT + 100);
  await warte(PRUEF_PAUSE);
  const sechs = await knopf(seite, 'emotes');
  pruefe('Browser: nach 6 Emotes (verteilt ueber Einstellungen und Neuladen) bleibt das Rad gesperrt, auch nach 8 s',
    sechs.gesperrt && sechs.grund === 'voll' && /alle 6 Emotes/.test(sechs.text), sechs);
  await tippe(seite, 'emotes');
  pruefe('Browser: Antippen nach 6 Emotes meldet die Grenze', !(await popupOffen(seite)) && /alle 6 Emotes/.test(await toast(seite)));
  const extra = await seite.evaluate(() => (JSON.parse(localStorage.getItem('schach-arena:v1:laufend') || 'null') || {}).extra || null);
  pruefe('Browser: die Zaehler stehen in der laufenden Partie (extra.emotes: 6 Emotes, 3 Antworten)', !!extra && extra.emotes && extra.emotes.n === 6 && extra.emotes.a === 3, extra);

  // 5) Nach der Partie: Rad frei; Chat bleibt bis 3 eigene Zuege gesperrt (es kommen keine mehr)
  await seite.evaluate(SCHNELLER_BOT);
  await partie(seite);
  await warteFlo(seite);
  await beobachte(seite);
  await waehle(seite, 'chat', '0');
  await zieh(seite, 'e2', 'e4');
  await warteFlo(seite);
  await seite.locator('.spielknoepfe > [data-aktion="aufgeben"]').focus();
  await seite.keyboard.press('Enter');
  await seite.waitForSelector('.dialog-ort .dialog', { timeout: 10000 });
  await seite.locator('.dialog-knoepfe .knopf.gefahr').click();
  await seite.waitForSelector('.ergebnis-overlay', { timeout: 30000 });
  await seite.locator('.ergebnis-overlay .erg-zu').click();
  const nachEnde = { emotes: await warteKnopf(seite, 'emotes', false), chat: await knopf(seite, 'chat'), phase: await seite.evaluate(() => window.__partie.phase()) };
  pruefe('Browser: nach der Partie ist das Rad frei, der Chat ohne 3 eigene Zuege gesperrt (Grund zuegeEnde)', nachEnde.phase === 'ende' && !nachEnde.emotes.gesperrt
    && nachEnde.chat.gesperrt && nachEnde.chat.grund === 'zuegeEnde' && /keiner mehr/.test(nachEnde.chat.text), nachEnde);
  await waehle(seite, 'emotes', 'gut');
  await warte(1300);
  const ende = await antworten(seite);
  pruefe('Browser: Emote nach der Partie geht, "Gut gespielt" bekommt Dank', ende.length === 2 && artVon(ende[0]) === 'gleichfalls' && artVon(ende[1]) === 'dank', ende);
  await warte(4500);
  const leer = await seite.evaluate(() => (document.querySelector('.em-live') || {}).textContent);
  pruefe('Browser: Vorlese-Text ist nach kurzer Zeit wieder leer', leer === '', leer);

  // 6) Schalter aus, neu laden: bleibt aus, Partie ohne Emote-Knoepfe und ohne Vorlese-Zeile
  await oeffne(seite, '#einstellungen');
  await seite.waitForSelector('.em-einstellungen input[data-em-einst="an"]', { timeout: 20000 });
  await seite.locator('.em-einstellungen input[data-em-einst="an"]').uncheck();
  await seite.locator('.em-einstellungen input[data-em-einst="daempfen"]').check();
  const schluessel = await seite.evaluate(() => Object.keys(localStorage).filter((k) => /ausdruck|emotes/.test(k)).map((k) => k + '=' + localStorage.getItem(k)));
  pruefe('Browser: Schalter werden unter ausdruck gespeichert', schluessel.length === 1 && /einstellungen:ausdruck=/.test(schluessel[0]) && /"an":false/.test(schluessel[0]) && /"daempfen":true/.test(schluessel[0]), schluessel);
  await seite.reload();
  await seite.waitForSelector('.em-einstellungen input[data-em-einst="an"]', { timeout: 20000 });
  const nachher = await seite.evaluate(() => ({ an: document.querySelector('.em-einstellungen input[data-em-einst="an"]').checked, daempfen: document.querySelector('.em-einstellungen input[data-em-einst="daempfen"]').checked }));
  pruefe('Browser: nach dem Neuladen bleibt "Emotes und Schnell-Chat" aus und "dämpfen" an', nachher.an === false && nachher.daempfen === true, nachher);
  await partie(seite);
  const inPartie = await seite.evaluate(() => ({ knoepfe: document.querySelectorAll('.em-aktion, [data-emote-aktion]').length, live: document.querySelectorAll('.em-live').length, partie: !!document.querySelector('.partie') }));
  pruefe('Browser: Partie ohne Emote-Knoepfe und ohne Vorlese-Zeile', inPartie.partie && inPartie.knoepfe === 0 && inPartie.live === 0, inPartie);
  pruefe('Browser: keine Warnung "unbekanntes Modul"', warnungen.length === 0, warnungen.slice(0, 2));
  pruefe('Browser: keine Seitenfehler', seitenfehler.length === 0, seitenfehler.slice(0, 2));
  await kontext.close();
}

// Labor: Emote-Kreaturen nur fuer das Erfinder-Konto (Merker der Sonderstuecke wie in finisher.test.mjs, Server gesperrt)
async function kreaturTeil(browser) {
  const kontext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', timezoneId: 'Europe/Berlin' });
  await kontext.route(/supabase\.co/, (r) => r.abort());
  const seite = await kontext.newPage();
  const seitenfehler = [];
  seite.on('pageerror', (e) => seitenfehler.push(e.message));
  await oeffne(seite, '#arena');
  const anmelden = (erfinder) => seite.evaluate((e) => {
    localStorage.clear();
    if (!e) return;
    const tok = 'a.' + btoa(JSON.stringify({ sub: 'u-flo' })).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_') + '.x';
    localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify({ access_token: tok, refresh_token: 'r', expires_at: 9999999999 }));
    localStorage.setItem('schach-arena:konto:sonderstuecke', JSON.stringify({ konto: 'u-flo', ids: ['erfinder-titel'] }));
  }, erfinder);
  await anmelden(true);
  await oeffne(seite, '#einstellungen');
  await seite.waitForSelector('.em-einstellungen', { timeout: 20000 });
  const wahl = await seite.evaluate(() => [...document.querySelectorAll('.em-kreaturen input[name="em-kreatur"]')].map((x) => x.value + (x.checked ? '*' : '')));
  pruefe('Browser Labor: Erfinder waehlt die Emote-Kreatur in den Einstellungen (Keine und sechs Kreaturen)', wahl.join() === 'keine*,karo,stups,zinni,klippa,glimm,kronli', wahl);
  await seite.locator('.em-kreaturen input[value="kronli"]').check({ force: true });
  const gespeichert = await seite.evaluate(() => Object.keys(localStorage).filter((k) => /einstellungen:ausdruck$/.test(k)).map((k) => localStorage.getItem(k)).join());
  pruefe('Browser Labor: Wahl steht unter ausdruck', /"kreatur":"kronli"/.test(gespeichert), gespeichert);
  await seite.evaluate(SCHNELLER_BOT);
  await partie(seite);
  await warteFlo(seite);
  await seite.locator('.em-aktion[data-emote-aktion="emotes"]').click({ timeout: 5000 });
  const rad = await seite.evaluate(() => [...document.querySelectorAll('.em-popup .em-wahl')].map((b) => b.dataset.wert + (b.classList.contains('em-kreatur') ? ':' + (b.querySelector('svg.kreatur') || { dataset: {} }).dataset.art : '')));
  pruefe('Browser Labor: im Rad steht Kronli vorn (winken, staunen, denken, verbeugen), danach die Strichsymbole',
    rad.slice(0, 4).join() === 'hallo:winken,staunen:staunen,denken:denken,gut:verbeugen' && rad.length === 8 && rad.slice(4).every((x) => !x.includes(':')), rad);
  await seite.locator('.em-popup .em-wahl[data-wert="hallo"]').click({ timeout: 5000 });
  await warte(200);
  const blase = await seite.evaluate(() => { const k = document.querySelector('.em-blase.em-eigen svg.kreatur'); return k ? { art: k.dataset.art, anim: getComputedStyle(k).animationName, b: Math.round(k.getBoundingClientRect().width) } : null; });
  pruefe('Browser Labor: die Blase zeigt die winkende Kreatur, sie huepft', !!blase && blase.art === 'winken' && blase.anim === 'kr-hops' && blase.b >= 30, blase);
  // Ohne Erfinder (abgemeldet): keine Wahl, das Rad wie bisher, auch wenn die Einstellung noch kronli sagt
  await seite.evaluate(() => localStorage.removeItem('schach-arena:konto:sitzung'));
  await oeffne(seite, '#einstellungen');
  await seite.waitForSelector('.em-einstellungen', { timeout: 20000 });
  const ohne = await seite.evaluate(() => document.querySelectorAll('.em-kreaturen').length);
  await seite.evaluate(SCHNELLER_BOT);
  await partie(seite);
  await warteFlo(seite);
  await seite.locator('.em-aktion[data-emote-aktion="emotes"]').click({ timeout: 5000 });
  const radOhne = await seite.evaluate(() => document.querySelectorAll('.em-popup .em-wahl.em-kreatur, .em-popup svg.kreatur').length);
  pruefe('Browser Labor: abgemeldet keine Kreaturen-Wahl und keine Kreatur im Rad', ohne === 0 && radOhne === 0, { ohne, radOhne });
  pruefe('Browser Labor: keine Seitenfehler', seitenfehler.length === 0, seitenfehler.slice(0, 2));
  await kontext.close();
}

// Darstellung (Flo 30.10.): Beschriftungen im Rad brechen nie mitten im Wort; das eigene Emote und die Bot-Antwort stehen
// ganz im Bild an der eigenen bzw. der Bot-Karte, ohne Knopf, Kopfzeile oder Uhr zu verdecken. Handy, iPad hoch und quer;
// Deutsch ohne Uhr, Englisch (laengere Texte) mit Bedenkzeit, damit beide Uhren in den Karten stehen.
async function messeBlase(seite, sel) {
  return seite.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const box = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
    const schnitt = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0.5 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0.5;
    const innen = (a, b) => a.l >= b.l - 0.5 && a.t >= b.t - 0.5 && a.r <= b.r + 0.5 && a.b <= b.b + 0.5;
    const r = box(el);
    const karte = el.closest('.spieler');
    const text = el.querySelector('.em-text');
    const knoepfe = [...document.querySelectorAll('.spielknoepfe .knopf, .ort-aktionen .knopf')].filter((k) => k.getClientRects().length);
    const frei = [...knoepfe, ...document.querySelectorAll('.p-kopf, .spieler > .av, .spieler > .uhr:not([hidden])')];
    return {
      box: r, imBild: r.l >= 0 && r.t >= 0 && r.r <= innerWidth && r.b <= innerHeight && r.r - r.l > 20,
      inKarte: !!karte && innen(r, box(karte)), karte: karte ? karte.className.split(' ').slice(0, 2).join('.') : '',
      verdeckt: frei.filter((k) => schnitt(r, box(k))).map((k) => k.className || k.tagName),
      ganzerText: !!text && text.scrollHeight <= text.clientHeight + 1 && text.scrollWidth <= text.clientWidth + 1, text: el.textContent,
    };
  }, sel);
}
async function layoutTeil(browser) {
  for (const [w, h] of [[390, 844], [820, 1180], [1180, 820]]) {
    for (const sprache of ['de', 'en']) {
      const name = `${w}x${h} ${sprache}`;
      const kontext = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', timezoneId: 'Europe/Berlin' });
      const seite = await kontext.newPage();
      await seite.goto(BASIS + (sprache === 'en' ? '&sprache=en' : '') + '#arena');
      await seite.waitForFunction(() => !!window.__app && !!document.querySelector('link[data-paket="emotes"]') && !!document.querySelector('.screen'), null, { timeout: 20000 });
      await seite.evaluate(SCHNELLER_BOT);
      await partie(seite, sprache === 'en' ? { botId: 'benno', tempo: { grund: 600, zuschlag: 0 } } : { botId: 'benno' });
      await warteFlo(seite);
      if (sprache === 'en') {
        const uhren = await seite.evaluate(() => document.querySelectorAll('.spieler > .uhr:not([hidden])').length);
        pruefe(`Layout ${name}: Partie mit Bedenkzeit zeigt beide Uhren in den Karten`, uhren === 2, uhren);
      }
      await seite.locator('.em-aktion[data-emote-aktion="emotes"]').click({ timeout: 5000 });
      await warte(300);
      const rad = await seite.evaluate(() => [...document.querySelectorAll('.em-popup .em-wahl span')].map((sp) => {
        const knoten = sp.firstChild;
        const zerrissen = [];
        if (knoten && knoten.nodeType === 3) {
          const text = knoten.textContent;
          for (const m of text.matchAll(/\S+/g)) {
            const rg = document.createRange(); rg.setStart(knoten, m.index); rg.setEnd(knoten, m.index + m[0].length);
            const zeilen = new Set([...rg.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top)));
            if (zeilen.size > 1) zerrissen.push(m[0]);
          }
        }
        return { text: sp.textContent, zerrissen, ueber: sp.scrollWidth > sp.clientWidth + 1 || sp.getBoundingClientRect().right > sp.parentElement.getBoundingClientRect().right + 0.5 };
      }));
      const schlecht = rad.filter((x) => x.zerrissen.length || x.ueber);
      pruefe(`Layout ${name}: Beschriftungen im Rad brechen nie mitten im Wort und ragen nicht aus dem Feld (${rad.length} Emotes)`, rad.length === 8 && schlecht.length === 0, schlecht);
      await seite.locator('.em-popup .em-wahl[data-wert="uff"]').click();
      await warte(350);
      const eigen = await messeBlase(seite, '.em-blase.em-eigen');
      pruefe(`Layout ${name}: eigenes Emote ganz im Bild an Flos Karte, verdeckt keinen Knopf, keine Kopfzeile, kein Portraet, keine Uhr`,
        !!eigen && eigen.imBild && eigen.inKarte && /spieler\.ich/.test(eigen.karte) && eigen.verdeckt.length === 0 && eigen.ganzerText, eigen);
      await warte(1000);
      const antwort = await messeBlase(seite, '.em-blase.em-botantwort');
      pruefe(`Layout ${name}: Bot-Antwort ganz im Bild an der Bot-Karte, ohne Kopfzeile, Rand oder Knopf zu verdecken`,
        !!antwort && antwort.imBild && antwort.inKarte && /spieler\.gegner/.test(antwort.karte) && antwort.verdeckt.length === 0 && antwort.ganzerText, antwort);
      await warte(1200);
      await waehle(seite, 'chat', '2');
      await warte(350);
      const satz = await messeBlase(seite, '.em-blase.em-eigen');
      pruefe(`Layout ${name}: eigener Chat-Satz ("${satz && satz.text}") ganz zu sehen, an Flos Karte, nichts verdeckt`,
        !!satz && satz.imBild && satz.inKarte && satz.verdeckt.length === 0 && satz.ganzerText, satz);
      await warte(1000);
      const satzAntwort = await messeBlase(seite, '.em-blase.em-botantwort');
      pruefe(`Layout ${name}: Antwort auf den Chat-Satz ganz zu sehen`, !!satzAntwort && satzAntwort.imBild && satzAntwort.inKarte && satzAntwort.verdeckt.length === 0 && satzAntwort.ganzerText, satzAntwort);
      await kontext.close();
    }
  }
}

let code = 1;
let server = null;
let browser = null;
try {
  if (!NUR_NODE) {
    server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
    await warteAufServer(`http://127.0.0.1:${PORT}/index.html`);
    browser = await browserTyp(ladePlaywright()).launch();
    await browserTeil(browser);
    await kreaturTeil(browser);
    await layoutTeil(browser);
  }
  code = fehler ? 1 : 0;
} catch (e) {
  console.error(e);
  code = 1;
} finally {
  if (browser) await browser.close();
  if (server) server.kill();
}
console.log(`\n${ok}/${ok + fehler} bestanden`);
process.exit(code);
