// Paket Sammlung (Reiter "Ich"): Bereiche und Erfolge aus dem Spielstand ohne Browser, dazu ein Browser-Teil (Playwright)
// in der vollen App: Reiter, sieben Bereiche, Schloss und Weg dahin, Zaehler, Handy ohne waagrechtes Scrollen, Englisch.
// Shop (Editionen) mit gefaelschtem Supabase-Server ueber page.route: abgemeldet, ohne Altersangabe, mit Edition.
// Erfinder-Profil (Sonderstuecke vom Server): Bereich, Blaupause in der Partie, Signatur bei den Finishern; ohne Zeilen nichts.
//   node tests/sammlung.test.mjs            Node und Browser
//   node tests/sammlung.test.mjs --nur-node nur der Node-Teil
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { setzeSpeicher } from '../js/storage.js';
import { teileBretter, teileKlaenge, teileErfolge, partienStand, schulStand, SIEGE_ZIELE } from '../js/pakete/sammlung/index.js';
import { standText, produktName } from '../js/pakete/sammlung/shop.js';
import { setzeSprache } from '../js/sprache.js';
import { rahmenTeile, motivTeile, grundTeile, titelTeile, duellProfil } from '../js/pakete/sammlung/profil.js';
import { titelListe, aktuellerTitel, ERFOLGS_TITEL, KOENNEN_TITEL, koennenFrei } from '../js/pakete/sammlung/titel.js';
import { erspielteTitel, merkeErspielteTitel, erspielteErfolge } from '../js/profil.js';
import { ALLE as SCHUL_LEKTIONEN } from '../js/pakete/lernen/mattbilder.js';
import { TITEL_ZEICHEN, titelWappen } from '../js/titel-kunst.js';
import { TITEL as LEVEL_TITEL } from '../js/pakete/funken/level.js';
import { profilWahl, setzeProfilWahl } from '../js/profil.js';
import { floAvatar } from '../js/thema.js';
import { finisherKunst } from '../js/sammlung-kunst.js';
import { BOTS } from '../js/bots.js';
import { browserTyp } from './browser.mjs';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8917);
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const NUR_NODE = process.argv.includes('--nur-node');
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0; let fehler = 0;
function pruefe(name, wert, info = '') {
  if (wert) { ok++; console.log('ok   ' + name); } else { fehler++; console.log('FEHLER ' + name + ' ' + (typeof info === 'string' ? info : JSON.stringify(info))); }
}

// ---------------------------------------------------------------------------
// Node-Teil
// ---------------------------------------------------------------------------
const lager = new Map();
setzeSpeicher({ getItem: (k) => (lager.has(k) ? lager.get(k) : null), setItem: (k, v) => lager.set(k, String(v)), removeItem: (k) => lager.delete(k),
  key: (i) => [...lager.keys()][i] ?? null, get length() { return lager.size; } });

const bretter = teileBretter({ brett: 'holz', klangpaket: '' });
pruefe('Bretter: drei, alle frei, das gewählte ausgerüstet', bretter.length === 3 && bretter.every((x) => x.frei)
  && bretter.filter((x) => x.an).map((x) => x.id).join() === 'brett-holz');
const klaenge = teileKlaenge({ brett: 'nacht', klangpaket: '' });
pruefe('Klänge: Holz und Arcade frei, ohne Wahl gilt Arcade (Standard)', klaenge.length === 2 && klaenge.every((x) => x.frei)
  && klaenge.filter((x) => x.an).map((x) => x.id).join() === 'klang-arcade');

// Flo 30.10.: "Merk dir sowas, braucht auch ein besseres Design" (Klangsets mit demselben Lautsprecher). Jedes Stueck
// hat ein eigenes Bild; Verlauf-Ids (rk...) unterscheiden sich je Aufruf und zaehlen nicht
const ohneIds = (s) => String(s).replace(/rk[a-z]\d+/g, '');
pruefe('Eigenes Bild: Klangsets verschieden', new Set(klaenge.map((x) => ohneIds(x.bild))).size === klaenge.length);
pruefe('Eigenes Bild: Bretter verschieden und mit Figuren', new Set(bretter.map((x) => x.bild)).size === bretter.length
  && bretter.every((x) => /class="sk-brett"/.test(x.bild)));
// Flo 31.10. (Foto der Brett-Auswahl): "der Koenig sieht ganz anders aus". Die Vorschau zeigt die echten Figuren des
// ausgeruesteten Satzes, keine gezeichneten Ersatzfiguren
const figurenIn = (x) => [...x.bild.matchAll(/<image href="([^"]+)"/g)].map((m) => m[1]);
pruefe('Brett-Vorschau: echte Figuren aus assets/pieces/ (Koenige und Bauern beider Farben), keine gezeichneten',
  bretter.every((x) => { const f = figurenIn(x); return f.length === 4 && f.every((q) => /\/assets\/pieces\/[wb][KP]\.svg$/.test(q))
    && ['wK', 'bK', 'wP', 'bP'].every((n) => f.some((q) => q.endsWith('/' + n + '.svg'))) && !/<path /.test(x.bild); }), figurenIn(bretter[0]));

// Flo 31.10. (Foto der Finisher: Krone und Signatur zeigten denselben Koenig): jeder Finisher hat ein eigenes Szenenbild,
// die drei Stufen-Finisher mit den echten Figuren des Satzes
{
  const fig = 'https://x.test/assets/pieces/';
  const bilder = ['krone', 'welle', 'koenig', 'signatur'].map((f) => finisherKunst(f, fig));
  const quellen = (b) => [...String(b).matchAll(/<image href="([^"]+)"/g)].map((m) => m[1].replace(fig, ''));
  pruefe('Finisher-Bilder: vier verschieden, alle mit sk-finisher', bilder.every((b) => /class="sk-finisher /.test(b || ''))
    && new Set(bilder.map(ohneIds)).size === 4);
  pruefe('Finisher-Bilder: Krone mit weissem Koenig, Welle mit Springer, Fallender Koenig mit schwarzem Koenig (echte Figuren)',
    quellen(bilder[0]).join() === 'wK.svg' && quellen(bilder[1]).join() === 'wN.svg' && quellen(bilder[2]).join() === 'bK.svg', bilder.map(quellen));
  pruefe('Finisher-Bilder: unbekannte Id ohne Bild', finisherKunst('gibtsnicht') === null);
}
// Welten-Bretter (Labor, 31.10.): dieselbe Zeichnung je Feld im Spiel (css/tokens.css) und im Sammelbild (js/labor.js)
{
  const { LABOR_BRETTER } = await import('../js/labor.js');
  const { brettKunst } = await import('../js/sammlung-kunst.js');
  const css = readFileSync(path.join(WURZEL, 'css/tokens.css'), 'utf8');
  const innen = (url) => decodeURIComponent(url).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const welten = LABOR_BRETTER.filter((b) => b.welt);
  const abweichend = welten.filter((b) => {
    const block = new RegExp(`html\\[data-brett="${b.id}"\\] \\{([^}]*)\\}`).exec(css);
    const url = (n) => (block && new RegExp(`--feld-muster-${n}: url\\("data:image/svg\\+xml,([^"]+)"\\)`).exec(block[1]) || [])[1] || '';
    return !block || innen(url('hell')) !== b.muster.h || innen(url('dunkel')) !== b.muster.d;
  }).map((b) => b.id);
  pruefe('Welten-Bretter: fünf (Welt 1 bis 5), Zeichnung im Spiel und im Sammelbild gleich', welten.map((b) => b.welt).join() === '1,2,3,4,5'
    && abweichend.length === 0, abweichend);
  pruefe('Welten-Bretter: das Sammelbild trägt die Zeichnung je Feld, die Themen-Bretter ohne', (brettKunst('#fff', '#000', '#111', '', welten[0].muster).match(/class="sk-muster"/g) || []).length === 9
    && !/sk-muster/.test(brettKunst('#fff', '#000', '#111', '')));
}

const leer = { bots: {} };
const NULL_STAND = { ligaBest: 0, serieBest: 0, level: 1 };
const e0 = teileErfolge(leer, NULL_STAND);
// Saison-Liga beendet (Flo 08.11.2026, "Unerreichte ausblenden"): Liga-Erfolge zeigt die Sammlung nur, wenn erspielt
const eL = teileErfolge(leer, { ...NULL_STAND, ligaBest: 6 });
pruefe('Eigenes Bild: alle 28 Erfolge verschieden (mit erspielter Liga), keiner mit dem alten Sammel-Stern', eL.length === 28
  && new Set(eL.map((x) => ohneIds(x.bild))).size === eL.length && eL.every((x) => /class="sk-erfolg"/.test(x.bild)));
const rang = { frei: 0, selten: 1, episch: 2, legende: 3 };
const sel = (id) => rang[eL.find((x) => x.id === 'erfolg-' + id).seltenheit];
pruefe('Erfolge gestaffelt: je schwerer, desto seltener (erster Sieg < Welt 1 < Welt 3 < Welt 5, Liga 1 < 3 < 6, Serie 7 < 30 < 100)',
  sel('erster-sieg') < sel('welt-1') && sel('welt-1') < sel('welt-3') && sel('welt-3') < sel('welt-5')
  && sel('liga-1') < sel('liga-3') && sel('liga-3') < sel('liga-6') && sel('serie-7') < sel('serie-30') && sel('serie-30') < sel('serie-100'));
pruefe('Erfolge ohne Partie: 22 (Bots, Serie, Level, Partien), keine unerreichte Liga, ohne Labor keine Meisterschule, alle gesperrt, mit Weg dahin', e0.length === 22
  && !e0.some((x) => /^erfolg-(schule|liga)-/.test(x.id)) && e0.every((x) => !x.frei && x.zeile)
  && e0.find((x) => x.id === 'erfolg-alle-bots').zeile === '0 von 30 besiegt');
const welt1 = BOTS.filter((b) => b.welt === 1);
const f1 = { bots: Object.fromEntries(welt1.map((b, i) => [b.id, { sterne: [true, i === 0, i === 0] }])) };
const e1 = teileErfolge(f1, { ligaBest: 2, serieBest: 7, level: 12 });
const frei = (id) => e1.find((x) => x.id === id).frei;
pruefe('Erfolge nach Welt 1: erster Sieg, drei Sterne, Welt 1 frei; Welt 2 und alle Bots nicht',
  frei('erfolg-erster-sieg') && frei('erfolg-drei-sterne') && frei('erfolg-welt-1') && !frei('erfolg-welt-2') && !frei('erfolg-alle-bots'));
const alle = e1.find((x) => x.id === 'erfolg-alle-bots');
pruefe('Fortschritt ehrlich: 6 von 30 Bots (0,2), Sterne nach Zahl', alle.zeile === '6 von 30 besiegt' && Math.abs(alle.fortschritt - 0.2) < 1e-9
  && e1.find((x) => x.id === 'erfolg-alle-sterne').zeile === `8 von ${BOTS.length * 3} Sternen`);
pruefe('Erfolge Liga, Serie, Level: Bronze und Silber, 7 Tage, Level 10 frei; Gold gar nicht da (Saison-Liga beendet); 30 Tage, Level 20 mit Weg',
  frei('erfolg-liga-1') && frei('erfolg-liga-2') && !e1.some((x) => x.id === 'erfolg-liga-3') && frei('erfolg-serie-7') && !frei('erfolg-serie-30')
  && frei('erfolg-level-10') && !frei('erfolg-level-20') && e1.find((x) => x.id === 'erfolg-serie-30').zeile === 'Längste Serie: 7 von 30 Tagen');
// Rahmen: frei ueber denselben Erfolg; ohne und Holz immer, Blatt 0 nur mit Sonderstueck
const r1 = rahmenTeile(e1);
const rf = (id) => r1.find((r) => r.id === id);
pruefe('Rahmen: Kein Rahmen und Holz frei, Liga Silber und Karofelder frei, Liga Gold ausgeblendet, kein Blatt 0 ohne Sonderstueck',
  rf('ohne').frei && rf('holz').frei && rf('liga-2').frei && rf('welt-1').frei && !rf('liga-3')
  && !rf('welt-2').frei && !r1.some((r) => r.id === 'erfinder-blatt-0'), r1.map((r) => r.id + (r.frei ? '+' : '-')).join());
pruefe('Profil: Standard Bauer (der Koenig gehoert dem Erfinder), Standard-Hintergrund, ohne Rahmen, leere Vitrine',
  JSON.stringify(profilWahl()) === JSON.stringify({ figur: 'P', grund: 'standard', rahmen: 'ohne', vitrine: [null, null, null], titel: null, banner: 'start' })
  && /wP\.svg/.test(floAvatar('w')) && !/stroke-width="8"/.test(floAvatar('w')));
setzeProfilWahl({ figur: 'Q', rahmen: 'liga-2', vitrine: ['erfolg-welt-1', 'kaputt!', 'erfolg-liga-2', 'zuviel'] });
pruefe('Profil: Figur Dame, Rahmen Silber, Vitrine hoechstens drei Plaetze, Unsinn faellt raus', profilWahl().figur === 'Q' && profilWahl().rahmen === 'liga-2'
  && JSON.stringify(profilWahl().vitrine) === JSON.stringify(['erfolg-welt-1', null, 'erfolg-liga-2']) && /wQ\.svg/.test(floAvatar('w')) && /#A9B2BE/.test(floAvatar('w')) && /rk-glanz/.test(floAvatar('w')));
setzeProfilWahl({ figur: 'X', rahmen: 'gibts-nicht', grund: 'mond' });
pruefe('Profil: unbekannte Figur, Rahmen oder Hintergrund fallen auf den Standard', profilWahl().figur === 'P' && profilWahl().rahmen === 'ohne' && profilWahl().grund === 'standard');
// Flo 31.10.: "mehr Optionen ... nur ich der Erschaffer kann den Koenig waehlen"
setzeProfilWahl({ figur: 'K' });
pruefe('Profil: ohne Erfinder-Konto kein Koenig und kein Kronli (fallen auf den Bauern)', profilWahl().figur === 'P'
  && (setzeProfilWahl({ figur: 'kronli' }), profilWahl().figur === 'P'));
setzeProfilWahl({ figur: 'glimm', grund: 'welt-5' });
const glimm = floAvatar('w');
pruefe('Profil: Kreatur als Motiv, still (ohne Bewegungs-Klassen), auf dem Hintergrund der Stockfisch-Tiefe',
  profilWahl().figur === 'glimm' && profilWahl().grund === 'welt-5' && /data-figur="glimm"/.test(glimm) && /data-kreatur="glimm"/.test(glimm)
  && !/class="kr-|kreatur kr-/.test(glimm) && /#24305A/.test(glimm) && !/\.svg"/.test(glimm) && !/undefined|NaN/.test(glimm));
const m0 = motivTeile(e0, false);
const m1 = motivTeile(e1, false);
const mf = (l, id) => l.find((m) => m.id === id);
pruefe('Motive ohne Erfinder: fuenf Figuren ohne Koenig, fuenf Kreaturen ohne Kronli; Karo erst mit Welt 1 gemeistert, sonst mit Weg',
  m0.filter((m) => m.art === 'figur').map((m) => m.id).join() === 'Q,R,B,N,P' && m0.filter((m) => m.art === 'kreatur').map((m) => m.id).join() === 'karo,stups,zinni,klippa,glimm'
  && !mf(m0, 'karo').frei && mf(m0, 'karo').weg === 'Karofelder: 0 von 6 Bots besiegt' && mf(m1, 'karo').frei && !mf(m1, 'stups').frei, m0.map((m) => m.id + (m.frei ? '+' : '-')).join());
const mE = motivTeile(e0, true);
pruefe('Motive als Erfinder: Koenig und Kronli dabei und markiert, alles frei', mf(mE, 'K') && mf(mE, 'K').erfinder && mf(mE, 'kronli') && mf(mE, 'kronli').erfinder
  && mE.every((m) => m.frei) && mE.length === 12);
const g0 = grundTeile(false);
pruefe('Hintergruende: Standard immer frei, Welt 1 erreicht, Welt 2 mit Weg', g0.length === 6 && g0[0].id === 'standard' && g0[0].frei
  && g0.find((g) => g.id === 'welt-1').frei && !g0.find((g) => g.id === 'welt-2').frei && g0.find((g) => g.id === 'welt-2').weg === 'Erreiche Springerforst',
  g0.map((g) => g.id + (g.frei ? '+' : '-') + g.weg).join());
setzeProfilWahl({ figur: 'P', grund: 'standard' });
pruefe('Nichts zum Kaufen: kein Preis, kein Shop, keine Restzahl in den Erfolgen',
  !e1.some((x) => /€|kauf|shop|verfügbar|nur noch/i.test(x.name + ' ' + x.zeile)));

// Neue Errungenschaften (Flo 01.11.2026: "denk dir neue Errungenschaften aus, zum Beispiel wenn man alle Lektionen fertig hat")
{
  const bosse = BOTS.filter((b) => b.endgegner);
  const f2 = { bots: Object.fromEntries(BOTS.map((b) => [b.id, { sterne: [b.id === bosse[0].id, false, false], siege: 2 }])) };
  const e2 = teileErfolge(f2, NULL_STAND, { beste: 3, frei: ['schwarz-sieg'] }, null);
  const fr = (id) => e2.find((x) => x.id === 'erfolg-' + id);
  pruefe(`Partien: Siege aus dem Zaehler je Bot (${BOTS.length * 2}: 10 und 50 frei, 100 mit Weg), Sieg mit Schwarz, erster Endgegner, Folge 3 von 5`,
    fr('siege-10').frei && fr('siege-50').frei && !fr('siege-100').frei && fr('siege-100').zeile === `${BOTS.length * 2} von 100 Siegen`
    && fr('schwarz-sieg').frei && fr('endgegner').frei && !fr('alle-endgegner').frei && fr('alle-endgegner').zeile === `1 von ${bosse.length} Endgegnern besiegt`
    && !fr('siegesserie-5').frei && fr('siegesserie-5').zeile === 'Beste Folge: 3 von 5' && Math.abs(fr('siegesserie-5').fortschritt - 0.6) < 1e-9
    && SIEGE_ZIELE.join() === '10,50,100' && e2.filter((x) => x.gruppe === 'Partien').length === 7, e2.slice(21).map((x) => x.id + (x.frei ? '+' : '-') + x.zeile).join(' | '));
  const st = schulStand({ lek: { [SCHUL_LEKTIONEN[0].id]: { s: 3, z: 2 } } });
  const eS = teileErfolge(f2, NULL_STAND, { beste: 0, frei: [] }, st);
  const sch = eS.filter((x) => /^erfolg-schule-/.test(x.id));
  pruefe('Meisterschule (nur im Labor): je Bereich, alle Lektionen und alle Sterne, mit Labor-Marke und ehrlichem Stand',
    sch.map((x) => x.id.slice(14)).join() === 'matt,taktik,end,eroeffnung,alle,sterne' && sch.every((x) => x.labor && !x.frei && x.gruppe === 'Meisterschule')
    && sch.find((x) => x.id === 'erfolg-schule-alle').zeile === `1 von ${SCHUL_LEKTIONEN.length} Lektionen geschafft` && schulStand() === null, sch.map((x) => x.id + ':' + x.zeile).join(' | '));
  const voll = {};
  for (const l of SCHUL_LEKTIONEN) voll[l.id] = { s: 3, z: 1 };
  const eV = teileErfolge(f2, NULL_STAND, { beste: 0, frei: [] }, schulStand({ lek: voll }));
  pruefe('Meisterschule: alle Lektionen mit drei Sternen schaltet alle sechs frei', eV.filter((x) => /^erfolg-schule-/.test(x.id)).every((x) => x.frei));
  const alleBilder = [...e2, ...sch];
  pruefe('Neue Errungenschaften: jede mit eigenem Abzeichen, keine doppelt', alleBilder.every((x) => /class="sk-erfolg"/.test(x.bild))
    && new Set(alleBilder.map((x) => ohneIds(x.bild))).size === alleBilder.length);
  // Archiv: neueste zuerst; die Folge zaehlt in Zeitfolge, eine Niederlage oder ein Remis bricht sie
  const p = (tag, ergebnis, farbe = 'w') => ({ id: 'p' + tag, datum: `2026-10-${String(tag).padStart(2, '0')}T10:00:00Z`, ergebnis, spielerFarbe: farbe, modus: 'normal', botId: BOTS[0].id });
  const archiv = [p(9, 'sieg'), p(8, 'sieg', 'b'), p(7, 'sieg'), p(6, 'sieg'), p(5, 'sieg'), p(4, 'remis'), p(3, 'sieg'), p(2, 'sieg'), p(1, 'niederlage')];
  const vorher = erspielteErfolge();
  const ps = partienStand(archiv);
  pruefe('Partien-Archiv: beste Folge 5 (das Remis bricht), Sieg mit Schwarz; beides wird gemerkt und bleibt ohne Archiv',
    vorher.length === 0 && ps.beste === 5 && ps.frei.includes('schwarz-sieg') && ps.frei.includes('siegesserie-5')
    && erspielteErfolge().includes('siegesserie-5') && partienStand([]).frei.includes('schwarz-sieg'), { vorher, ps });
  setzeProfilWahl({ vitrine: ['erfolg-schwarz-sieg', null, null] });
  const dp = duellProfil();
  pruefe('Matchbeginn: die gewaehlte Errungenschaft kommt mit Abzeichen und Seltenheit', dp && dp.orden.length === 1 && dp.orden[0].name === 'Sieg mit Schwarz'
    && /^<svg viewBox="0 0 120 120" class="sk-erfolg"/.test(dp.orden[0].bild) && dp.orden[0].seltenheit === 'frei', dp);
  setzeProfilWahl({ vitrine: [null, null, null] });
  pruefe('Partien-Archiv: Uebungs- und Zu-zweit-Partien zaehlen nicht', partienStand([{ ...p(20, 'sieg', 'b'), modus: 'uebung' }]).beste === 0);
  const titelNeu = ERFOLGS_TITEL.filter((x) => /^(schwarz-sieg|siegesserie-5|endgegner|siege-100|alle-endgegner|schule-)/.test(x.erfolg));
  pruefe('Neue Titel zu den neuen Errungenschaften (Schattenkoenig, Siegeszug, Bezwinger ...), die der Meisterschule nur im Labor',
    titelNeu.length === 7 && titelListe({ erfolge: e2 }).filter((x) => x.art === 'erfolg').length === ERFOLGS_TITEL.length - 3
    && titelListe({ erfolge: [...e2, ...sch] }).filter((x) => x.art === 'erfolg').length === ERFOLGS_TITEL.length - 1
    && titelListe({ erfolge: e2 }).find((x) => x.id === 'erfolg-schattenkoenig').frei);
}

// Shop: Stand einer Edition als ruhiger Satz, die Zahl nur, wenn der Server sie schickt (nur bei erhaeltlich)
pruefe('Shop: Restzahl sieht bei 9 und bei 1 gleich aus', standText({ status: 'erhaeltlich', restzahl: 9, auflage: 10 }) === '9 von 10 verfügbar'
  && standText({ status: 'erhaeltlich', restzahl: 1, auflage: 10 }) === '1 von 10 verfügbar');
pruefe('Shop: ohne Restzahl vom Server keine Zahl', standText({ status: 'erhaeltlich', restzahl: null, auflage: 10 }) === 'Erhältlich');
pruefe('Shop: angekündigt mit Datum, ausverkauft, pausiert, beendet', standText({ status: 'angekuendigt', verkauf_ab: '2026-12-01T10:00:00Z', auflage: 10 }) === 'Verkauf ab 01.12.2026'
  && standText({ status: 'ausverkauft', auflage: 10 }) === 'Alle 10 vergeben' && standText({ status: 'pausiert' }) === 'Verkauf pausiert'
  && standText({ status: 'beendet' }) === 'Verkauf beendet');
// Englisch-Durchsicht 09.11.: Name der Edition und Datum folgen der Sprache (Server kennt nur den deutschen Namen)
pruefe('Shop: deutscher Name bleibt, Server-Name zaehlt', produktName('brett-mitternacht') === 'Mitternacht & Gold' && produktName('brett-mitternacht', 'Anders') === 'Anders');
setzeSprache('en');
{
  const ab = standText({ status: 'angekuendigt', verkauf_ab: '2026-12-01T10:00:00Z', auflage: 10 });
  pruefe('Shop englisch: Midnight & Gold statt des deutschen Server-Namens, Datum im US-Format',
    produktName('brett-mitternacht', 'Mitternacht & Gold') === 'Midnight & Gold' && ab === 'On sale from 12/01/2026', ab);
}
// Der englische Name ist nur Anzeige: Besitz steht nur in der Datenbank (besitz, Schluessel produkt_id), und shop.js
// findet Aussehen, Karte und Server-Abgleich ueber die produkt_id; mit dem Namen vergleicht nichts
{
  const quelle = readFileSync(path.join(WURZEL, 'js/pakete/sammlung/shop.js'), 'utf8');
  const zeilen = quelle.split('\n').filter((z) => !z.trim().startsWith('//'));
  const nameVergleich = zeilen.filter((z) => /\bname\s*[!=]==?|[!=]==?\s*[\w.]*\bname\b/.test(z));
  const nameNutzung = zeilen.filter((z) => /\b(e|a|aussehen)\.name\b/.test(z));
  pruefe('Shop: Name nur Anzeige, kein Vergleich ueber den Namen, Zuordnung ueber produkt_id',
    nameVergleich.length === 0 && nameNutzung.every((z) => /produktName\(|aussehen\.name : id/.test(z)) && /KATALOG\[e\.produkt_id\]/.test(quelle)
    && produktName('brett-mitternacht', 'Mitternacht & Gold') === 'Midnight & Gold', { nameVergleich, nameNutzung });
}
setzeSprache('de');

// Titel (Flo 01.11.2026: "bessere Designs, Titel auch zu Errungenschaften, nicht nur bei den Leveln")
{
  const erfolge = [{ id: 'erfolg-erster-sieg', name: 'Erster Sieg', frei: true }, { id: 'erfolg-welt-1', name: 'Karofelder gemeistert', frei: false, fortschritt: .5 }];
  const l = titelListe({ level: 12, erfolge, erfinder: false });
  const lv = l.filter((x) => x.art === 'level');
  const ef = l.filter((x) => x.art === 'erfolg');
  pruefe('Titel: alle Level-Titel (frei nach Level) und je ein Erfolgs-Titel, ohne Erfinder kein Erfinder-Titel',
    lv.length === LEVEL_TITEL.length && lv.filter((x) => x.frei).map((x) => x.ab).join() === '1,5,10' && ef.length === ERFOLGS_TITEL.filter((x) => !x.labor && !x.nurErspielt).length && !l.some((x) => x.art === 'erfinder'),
    l.map((x) => x.id + (x.frei ? '+' : '-')).join());
  pruefe('Titel: Erfolgs-Titel frei mit dem Erfolg, sonst mit Weg und Fortschritt',
    ef.find((x) => x.id === 'erfolg-feuertaufe').frei && !ef.find((x) => x.id === 'erfolg-goldene-aehre').frei
    && /Karofelder gemeistert/.test(ef.find((x) => x.id === 'erfolg-goldene-aehre').weg) && ef.find((x) => x.id === 'erfolg-goldene-aehre').fortschritt === .5);
  const VERBOTEN_T = /meister|profi|experte|\belo\b|grandmaster|master|pro\b|expert/i;
  pruefe('Titel: Namen ohne Meister, Profi, Experte oder Elo (Fairness 12), jeder Name eindeutig, Deutsch und Englisch',
    l.every((x) => x.name && !VERBOTEN_T.test(x.name) && !x.name.startsWith('p-sammlung')) && new Set(l.map((x) => x.name)).size === l.length, l.map((x) => x.name).join());
  const bilder = [...l, ...titelListe({ level: 100, erfolge: [], erfinder: true })].map((x) => titelWappen(x.zeichen, { farbe: x.farbe, seltenheit: x.seltenheit, n: x.n }));
  pruefe('Titel: jedes Wappen gezeichnet, Zeichen bekannt, keine Luecken, eigene Verlaufs-Id je Aufruf',
    bilder.every((b) => /^<svg class="titel-wappen" data-zeichen="[a-z0-9-]+"/.test(b) && !/undefined|NaN/.test(b))
    && l.every((x) => TITEL_ZEICHEN.includes(x.zeichen)) && titelWappen('funke') !== titelWappen('funke') && titelWappen('gibtsnicht') === '');
  pruefe('Titel: ab Legende ein Lorbeer um das Schild', /tw-lorbeer/.test(titelWappen('sonne', { seltenheit: 'legende' })) && !/tw-lorbeer/.test(titelWappen('funke', { seltenheit: 'frei' })));
  const auto = aktuellerTitel({ level: 12, erfolge, erfinder: false, wahl: null });
  const gew = aktuellerTitel({ level: 12, erfolge, erfinder: false, wahl: 'erfolg-feuertaufe' });
  const zu = aktuellerTitel({ level: 12, erfolge, erfinder: false, wahl: 'erfolg-goldene-aehre' });
  const er = aktuellerTitel({ level: 1, erfolge, erfinder: true, wahl: null });
  pruefe('Titel: ohne Wahl der hoechste Level-Titel, gewaehlt nur wenn frei, beim Erfinder „Der Erfinder“',
    auto.id === 'level-10' && !auto.gewaehlt && gew.id === 'erfolg-feuertaufe' && gew.gewaehlt && zu.id === 'level-10' && er.id === 'erfinder' && er.name === 'Der Erfinder',
    { auto: auto.id, gew: gew.id, zu: zu.id, er: er.id });
  // Wahl ueber das Profil: Tipp traegt, zweiter Tipp nimmt ab; der Matchbeginn zeigt den Titel nur, wenn er gewaehlt ist
  setzeProfilWahl({ titel: null });
  const vorher = duellProfil();
  const teile = titelTeile();
  const funke = teile.find((x) => x.id === 'titel-level-1');
  funke.wahl();
  const nachWahl = { wahl: profilWahl().titel, duell: duellProfil() };
  const angelegt = titelTeile().find((x) => x.id === 'titel-level-1');
  angelegt.abwahl();
  pruefe('Titel: Tipp traegt (profilWahl.titel), Matchbeginn zeigt ihn mit Wappen, zweiter Tipp nimmt ab', vorher === null
    && nachWahl.wahl === 'level-1' && nachWahl.duell && nachWahl.duell.titel === 'Funke' && /titel-wappen/.test(nachWahl.duell.titelBild)
    && angelegt.an && typeof angelegt.abwahl === 'function' && profilWahl().titel === null && duellProfil() === null, nachWahl);
  setzeProfilWahl({ titel: 'unsinn$' });
  pruefe('Titel: unbekannte Werte werden nicht gespeichert', profilWahl().titel === null);
  // Pionier (Flo 01.11.2026: "die ersten 100 Spieler bekommen einen Titel"): nur mit Nummer vom Server sichtbar
  const mitPi = titelListe({ level: 1, erfolge: [], erfinder: false, pionier: 7 });
  const ohnePi = titelListe({ level: 1, erfolge: [], erfinder: false, pionier: null });
  pruefe('Pionier: mit Nummer sichtbar und frei („Pionier Nr. 7“), ohne Nummer gar nicht da, ohne Wahl der getragene Titel',
    mitPi.some((x) => x.art === 'pionier' && x.frei && x.name === 'Pionier Nr. 7') && !ohnePi.some((x) => x.art === 'pionier')
    && !titelListe({ pionier: 101 }).some((x) => x.art === 'pionier') && aktuellerTitel({ level: 20, pionier: 7 }).id === 'pionier'
    && aktuellerTitel({ level: 20, pionier: 7, erfinder: true }).id === 'erfinder');
  // Koennen-Titel aus den eigenen Partien
  const zuege = (n) => new Array(n * 2).fill('e2e4');
  const partien = [{ ergebnis: 'sieg', zuege: zuege(12), genauigkeit: 80, botId: 'a' }, { ergebnis: 'sieg', zuege: zuege(61), genauigkeit: 92, botId: 'b', hinweise: 0, zuruecknahmen: 0 },
    { ergebnis: 'remis', zuege: zuege(30) }, { ergebnis: 'remis', zuege: zuege(30) }, { ergebnis: 'niederlage', zuege: zuege(5) }];
  const k1 = koennenFrei(partien, (id) => (id === 'b' ? 1300 : 300));
  pruefe('Können: Blitzschlag (≤ 15 Züge), Langer Atem (≥ 60), Feinschliff (≥ 90 %), Eigene Kraft (Elo ≥ 1200 ohne Hilfe); Gleichgewicht erst ab 3 Remis, Stammgast ab 100 Partien',
    k1.join() === 'koennen-blitzschlag,koennen-langer-atem,koennen-feinschliff,koennen-eigene-kraft', k1);
  pruefe('Können: Gleichgewicht mit 3 Remis, Stammgast mit 100 Partien, ohne Partien nichts',
    koennenFrei([...partien, { ergebnis: 'remis', zuege: [] }]).includes('koennen-gleichgewicht')
    && koennenFrei(new Array(100).fill({ ergebnis: 'niederlage', zuege: [] })).join() === 'koennen-stammgast' && koennenFrei([]).length === 0);
  merkeErspielteTitel(['koennen-blitzschlag']);
  merkeErspielteTitel(['koennen-blitzschlag', 'unsinn$']);
  pruefe('Können: einmal erspielt bleibt gemerkt (ohne Doppel, nur gueltige Ids)', erspielteTitel().join() === 'koennen-blitzschlag', erspielteTitel());
  const lk = titelListe({ level: 1, koennen: ['koennen-blitzschlag'] }).filter((x) => x.art === 'koennen');
  pruefe('Können: alle Titel ausser Labor, frei nur die erspielten, gesperrte mit Weg', lk.length === KOENNEN_TITEL.filter((x) => !x.labor).length && lk.filter((x) => x.frei).length === 1
    && lk.find((x) => x.id === 'koennen-stammgast').weg === 'Spiele 100 Partien' && lk.find((x) => x.id === 'koennen-raetselfuchs').weg === 'Löse 100 Tagesrätsel'
    && !lk.some((x) => x.id === 'koennen-musterschueler') && titelListe({ level: 1, labor: true }).some((x) => x.id === 'koennen-musterschueler'), lk.map((x) => x.id + (x.frei ? '+' : '-')).join());
  // Neue Titel (Flo 08.11.2026) nur aus Daten, die der Browser schon hat; je Bedingung knapp darunter nichts, genau darauf alles
  const voll = { kronenStufe: 15, raetsel: 100, weltenMitSieg: 5, weltenAlle: 5, sterneWelt: true, platz1: 5, rekorde: 10, kartei: 50, labor: true, schulKapitel: 1, erzfeind: 1 };
  const knapp = { kronenStufe: 14, raetsel: 99, weltenMitSieg: 4, weltenAlle: 5, sterneWelt: false, platz1: 4, rekorde: 9, kartei: 49, labor: true, schulKapitel: 0, erzfeind: 0 };
  const neun = ['kroenung', 'raetselfuchs', 'weltenwanderer', 'tafelkoenig', 'rekordjaeger', 'sterne-sammler', 'fehlerjaeger', 'musterschueler', 'erzfeind'].map((x) => 'koennen-' + x);
  pruefe('Neue Titel: alle neun genau an der Schwelle frei, knapp darunter keiner, ohne Daten keiner, Weltenwanderer nie ohne Welten',
    neun.every((x) => koennenFrei([], null, voll).includes(x)) && koennenFrei([], null, knapp).length === 0 && koennenFrei([], null, {}).length === 0
    && !koennenFrei([], null, { weltenMitSieg: 0, weltenAlle: 0 }).includes('koennen-weltenwanderer'), koennenFrei([], null, voll));
  pruefe('Neue Titel: Namen eindeutig, DE und EN, ohne Meister/Profi/Experte', (() => {
    const de = titelListe({ level: 1, labor: true, alle: true }).filter((x) => neun.includes(x.id));
    return de.length === 9 && de.every((x) => x.name && !/^p-sammlung|titel\./.test(x.name) && !VERBOTEN_T.test(x.name) && TITEL_ZEICHEN.includes(x.zeichen));
  })());
}

// ---------------------------------------------------------------------------
// Browser-Teil (volle App, alle Pakete)
// ---------------------------------------------------------------------------
async function warteAufServer(url, ms = 10000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try { const r = await fetch(url); await r.arrayBuffer(); if (r.ok) return; } catch (e) { /* noch nicht da */ }
    await warte(150);
  }
  throw new Error('Server startet nicht: ' + url);
}

function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}

const SUPA = 'https://usaamcqypmvgqmsbfecb.supabase.co';
const token = (sub) => 'a.' + Buffer.from(JSON.stringify({ sub })).toString('base64url') + '.x';
const SITZUNG = { access_token: token('0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f'), refresh_token: 'r1', expires_at: 9999999999,
  user: { id: '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f', email: 'probe@example.invalid' } };
const EDITION = { produkt_id: 'brett-mitternacht', name: 'Mitternacht & Gold', auflage: 10, status: 'erhaeltlich', restzahl: 9,
  verkauf_ab: '2026-11-28T10:00:00Z' };

// Shop mit gefaelschtem Server: edition_staende liefert [] ohne Altersangabe (wie supabase/werkstatt-schema.sql)
async function shopSeite(browser, { sitzung = null, server = {}, bereich = 'shop', vorher = {} } = {}) {
  const k = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', timezoneId: 'Europe/Berlin' });
  const s = await k.newPage();
  const srv = { ab18: false, editionen: [EDITION], sonder: [], ...server };
  const anfragen = [];
  const fehlerListe = [];
  s.on('pageerror', (e) => fehlerListe.push(e.message));
  await s.route(SUPA + '/**', async (r) => {
    const u = r.request().url();
    anfragen.push({ url: u, body: r.request().postData() });
    if (u.includes('/rpc/alter_angeben')) { srv.ab18 = true; return r.fulfill({ status: 204, body: '' }); }
    const body = u.includes('/rpc/edition_staende') ? (srv.ab18 ? srv.editionen : [])
      : u.includes('/rest/v1/altersangaben') ? (srv.ab18 ? [{ ab18: true }] : [])
      : u.includes('/rest/v1/sonderstuecke') ? srv.sonder : {};
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await s.addInitScript(({ sitzung, vorher }) => {
    try {
      if (sessionStorage.getItem('probe-start')) return;
      sessionStorage.setItem('probe-start', '1');
      localStorage.clear();
      if (sitzung) localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
      for (const [k, v] of Object.entries(vorher)) localStorage.setItem(k, v);
    } catch (e) { /* egal */ }
  }, { sitzung, vorher });
  await s.goto(BASIS + '#ich');
  await s.waitForSelector('.sa-screen', { timeout: 30000 });
  // Etappe 4b: beim Start gebuchte Stufen zeigt "Ich" als Freischalt-Moment; wegtippen, wie ein Spieler es tut
  await warte(400);
  let moment = 0;
  while (moment < 12 && await s.locator('.st-moment .st-weiter').count()) { moment++; await s.locator('.st-moment .st-weiter').first().click(); await warte(250); }
  if (bereich) await waehle(s, bereich);
  await warte(500);
  return { k, s, srv, anfragen, fehlerListe, moment };
}

async function shopTeil(browser) {
  // abgemeldet: ein Satz und der Weg zum Konto, keine Anfrage an den Server
  let p = await shopSeite(browser);
  let text = await p.s.locator('.sh-bereich').innerText();
  pruefe('Shop abgemeldet: Hinweis ab 18 und Weg zum Konto, keine Editionen-Anfrage', /ab 18 Jahren/.test(text) && /Zum Konto/.test(text)
    && !p.anfragen.some((a) => a.url.includes('edition_staende')), text);
  const zaehl = await p.s.evaluate(() => ({ stand: document.querySelector('.sa-stand').textContent, alle: document.querySelectorAll('.sa-teil').length,
    frei: document.querySelectorAll('.sa-teil:not([data-zustand="zu"])').length }));
  pruefe('Shop abgemeldet: Stücke ausgegraut zu sehen, ohne Kauf-Knopf und ohne Preis', await p.s.evaluate(() => {
    const k = [...document.querySelectorAll('.sh-gast .sh-karte[data-gast]')];
    return k.length > 0 && !document.querySelector('.sh-bereich .sh-kaufen') && k.every((x) => !/€|Taler/.test(x.textContent));
  }));
  // R5-2 (Kundenblick 09.11.2026): „ab 18“ stand doppelt im Blatt (Hinweis oben und auf der Karte)
  pruefe('Shop abgemeldet: „ab 18“ steht genau einmal im Blatt (R5-2)', (text.match(/ab 18/g) || []).length === 1, text);
  // R5-3: ausgegraut bleibt, aber das Brett muss als Brett erkennbar sein (vorher Deckkraft .55 = graues Karomuster wie ein kaputtes Bild)
  const vorschau = await p.s.evaluate(() => { const b = document.querySelector('.sh-karte[data-gast] .sh-bild'); const c = getComputedStyle(b);
    return { opacity: +c.opacity, filter: c.filter, rand: getComputedStyle(b.querySelector('.sh-brett')).boxShadow }; });
  pruefe('Shop abgemeldet: Vorschau gedaempft, erkennbar farbig und mit Brettrand (R13-Shop)', /grayscale\(0\.75\)/.test(vorschau.filter)
    && vorschau.rand !== 'none', vorschau);
  pruefe('Shop zählt nicht in „freigeschaltet“ mit', zaehl.stand === `${zaehl.frei} von ${zaehl.alle} freigeschaltet`, zaehl);
  // Kundenblick 09.11.2026 (Befund 12): kein leeres "0 / 0" auf "Ich", ohne Partie auch keine Spielzahl im Profil
  const ich = await p.s.evaluate(() => ({ zahlen: [...document.querySelectorAll('.sa-gross .zahl, .sa-platz-zahl')].map((z) => z.textContent.trim()),
    seit: document.querySelector('.pr-seit')?.textContent || '' }));
  pruefe('Ich: kein „0 / 0“, ohne Partie keine Spielzahl (Befund 12)', !ich.zahlen.some((z) => /^0\s*\/\s*0$/.test(z)) && !/Partie/.test(ich.seit), ich);
  await p.s.locator('.sh-bereich .knopf').click();
  await p.s.waitForSelector('.konto-gruppe', { timeout: 15000 }).catch(() => {});
  pruefe('Shop abgemeldet: „Zum Konto“ öffnet die Einstellungen mit der Konto-Gruppe', await p.s.locator('.konto-gruppe').count() === 1);
  pruefe('Shop abgemeldet: keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
  await p.k.close();

  // angemeldet ohne Altersangabe: einmal fragen, danach die Edition
  p = await shopSeite(browser, { sitzung: SITZUNG });
  await p.s.waitForSelector('.sh-bereich .knopf', { timeout: 15000 });
  text = await p.s.locator('.sh-bereich').innerText();
  pruefe('Shop ohne Altersangabe: Frage und Knopf „Ich bin 18 oder älter“, noch keine Karte', /18 oder älter/.test(text)
    && await p.s.locator('.sh-karte').count() === 0, text);
  await p.s.locator('.sh-bereich .knopf').click();
  await p.s.waitForSelector('.sh-karte', { timeout: 15000 }).catch(() => {});
  const alter = p.anfragen.find((a) => a.url.includes('/rpc/alter_angeben'));
  pruefe('Shop: Altersangabe geht als { ab18: true } an den Server', !!alter && JSON.parse(alter.body || '{}').ab18 === true, alter);
  const karte = await p.s.evaluate(() => {
    const k = document.querySelector('.sh-karte');
    if (!k) return null;
    const kauf = k.querySelector('.sh-kaufen');
    return { produkt: k.dataset.produkt, name: k.querySelector('.sh-name').textContent, stand: k.querySelector('.sh-stand').textContent,
      text: k.innerText, kaufAus: kauf.disabled, kaufText: kauf.textContent.trim(), breit: k.scrollWidth <= k.clientWidth + 1 };
  });
  pruefe('Shop: Karte mit Name vom Server, „9 von 10 verfügbar“, Regel je Konto', !!karte && karte.produkt === 'brett-mitternacht'
    && karte.name === 'Mitternacht & Gold' && karte.stand === '9 von 10 verfügbar' && /Höchstens 1 Stück je Konto/.test(karte.text), karte);
  pruefe('Shop: Kaufknopf „Bald verfügbar“ und abgeschaltet, kein Preis', !!karte && karte.kaufAus && karte.kaufText === 'Bald verfügbar'
    && !/€|EUR|\d+,\d\d/.test(karte.text), karte);
  pruefe('Shop: Karte passt aufs Handy', !!karte && karte.breit && await p.s.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await p.s.locator('.sh-anprobieren').click();
  await p.s.waitForSelector('.sheet-karte .sh-brett.gross', { timeout: 5000 }).catch(() => {});
  pruefe('Shop: Anprobieren zeigt das Brett groß im Blatt', await p.s.locator('.sheet-karte .sh-brett.gross').count() === 1);
  pruefe('Shop angemeldet: keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
  await p.k.close();

  // angemeldet mit Altersangabe, aber nur unbekannte Produkte: ruhiger Satz statt leerer Karte
  p = await shopSeite(browser, { sitzung: SITZUNG, server: { ab18: true, editionen: [{ ...EDITION, produkt_id: 'figuren-unbekannt' }] } });
  await p.s.waitForFunction(() => /Vorbereitung/.test(document.querySelector('.sh-bereich')?.innerText || ''), null, { timeout: 15000 }).catch(() => {});
  text = await p.s.locator('.sh-bereich').innerText();
  pruefe('Shop: unbekanntes Produkt zeigt „in Vorbereitung“, keine Altersfrage', /in Vorbereitung/.test(text) && !/18 oder älter/.test(text), text);
  await p.k.close();
}

const ERFINDER_ZEILEN = ['erfinder-banner-blatt-0', 'erfinder-titel', 'erfinder-figuren-blaupause', 'erfinder-finisher-signatur']
  .map((stueck_id) => ({ stueck_id }));
const figurenQuellen = (s) => s.evaluate(() => [...document.querySelectorAll('img.figur')].map((x) => x.getAttribute('src')));

async function erfinderTeil(browser) {
  // Flos Konto mit allen vier Zeilen: der Bereich erscheint nach der Antwort des Servers von selbst
  let p = await shopSeite(browser, { sitzung: SITZUNG, server: { sonder: ERFINDER_ZEILEN }, bereich: null });
  await p.s.waitForSelector('.sa-platz[data-bereich="erfinder"]', { timeout: 15000 }).catch(() => {});
  const plaetze = await p.s.evaluate(() => [...document.querySelectorAll('.sa-platz, .sa-gross')].map((b) => b.getBoundingClientRect()));
  await waehle(p.s, 'erfinder');
  const info = await p.s.evaluate(() => {
    const b = document.querySelector('.sa-bereich[data-bereich="erfinder"]');
    return b && { teile: [...b.querySelectorAll('.sa-teil')].map((x) => x.dataset.teil).join(), chips: [...b.querySelectorAll('.er-chip')].map((x) => x.textContent).join('|'),
      knopf: b.querySelector('.er-figuren')?.textContent, platz: !!document.querySelector('.sa-platz[data-bereich="erfinder"]'), sichtbar: !b.hidden && !!b.closest('.sa-blatt') };
  });
  pruefe('Erfinder: eigener Platz, öffnet als Blatt mit Banner, Titel, Blaupause und Signatur', !!info && info.sichtbar && info.platz
    && info.teile === ERFINDER_ZEILEN.map((z) => z.stueck_id).join(), info);
  pruefe('Erfinder: „Der Erfinder“ und „Nr. 0 · 1 von 1“, Knopf für die Blaupause', !!info && info.chips === 'Der Erfinder|Nr. 0 · 1 von 1'
    && info.knopf === 'Blaupause-Figuren benutzen', info);
  pruefe('Erfinder: Profil passt aufs Handy', await p.s.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  // G-002 (Sammlung B): Plaetze statt Reiter; auf dem Handy alle im Bild, gross genug, ohne Ueberlappung
  pruefe('Handy: alle Plätze der Sammlung sichtbar (mindestens 44 px hoch, keiner überlappt, nichts ragt rechts heraus)', await p.s.evaluate((seg) => {
    const ueber = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    const st = document.querySelector('.sa-plaetze');
    return seg.length > 6 && seg.every((r) => r.height >= 44 && r.left >= 0 && r.right <= innerWidth + 1)
      && seg.every((r, i) => seg.every((q, j) => i === j || !ueber(r, q))) && st.scrollWidth <= st.clientWidth + 1;
  }, plaetze), plaetze.length);
  pruefe('Erfinder: alle Finisher frei (Labor, mit Schild), auch auf Level 1 (kein Schloss), mit Szenenbild und echten Figuren', await p.s.evaluate(() => {
    const t = [...document.querySelectorAll('.sa-bereich[data-bereich="finisher"] .sa-teil')];
    return t.length === 5 && !t.some((x) => x.dataset.zustand === 'zu') && t.every((x) => x.querySelector('.sa-labor'))
      && t.filter((x) => x.querySelector('.sa-bild svg.sk-finisher image[href*="/assets/pieces/"]')).length >= 3;
  }));
  await p.s.locator('.er-figuren').click();
  await p.s.waitForFunction(() => document.querySelector('.er-figuren')?.getAttribute('aria-pressed') === 'true', null, { timeout: 10000 }).catch(() => {});
  pruefe('Erfinder: Blaupause ausgerüstet', await p.s.evaluate(() => document.querySelector('.sa-teil[data-teil="erfinder-figuren-blaupause"]')?.dataset.zustand) === 'an');
  await p.s.evaluate(() => window.__app.gehe('partie', { botId: 'benno', farbe: 'w' }));
  await p.s.waitForSelector('img.figur', { timeout: 20000 }).catch(() => {});
  let quellen = await figurenQuellen(p.s);
  pruefe('Erfinder: in der Partie stehen alle 32 Figuren im Blaupause-Satz', quellen.length === 32 && quellen.every((q) => q.includes('/blaupause/')), quellen.slice(0, 3));
  // Finisher waehlt man seit 31.10.2026 nur in der Sammlung (Flo: nichts doppelt); die Einstellungen haben nur noch an/aus
  const fiStand = () => p.s.evaluate(() => JSON.parse(localStorage.getItem('schach-arena:v1:einstellungen:finisher') || '{}'));
  await p.s.evaluate(() => window.__app.gehe('ich', { bereich: 'finisher' }));
  await p.s.waitForSelector('.sa-teil[data-teil="finisher-signatur"]', { timeout: 15000 }).catch(() => {});
  pruefe('Erfinder: Signatur bei den Finishern in der Sammlung wählbar', await p.s.locator('.sa-teil[data-teil="finisher-signatur"] .sa-wahl').count() === 1);
  await ruesteAus(p.s, 'finisher-signatur');
  pruefe('Erfinder: Tipp rüstet die Signatur als Finisher aus', (await fiStand()).auswahl === 'signatur', await fiStand());
  await p.s.locator('.sa-teil[data-teil="finisher-signatur"] .sa-wahl[data-ab]').click();
  await p.s.waitForFunction(() => document.querySelector('.sa-teil[data-teil="finisher-signatur"]')?.dataset.zustand !== 'an', null, { timeout: 10000 }).catch(() => {});
  pruefe('Erfinder: zweiter Tipp schaltet den Finisher aus', (await fiStand()).auswahl === 'aus', await fiStand());
  await p.s.evaluate(() => window.__app.gehe('einstellungen', { seite: 'finisher' }));   // Handy: Finisher als eigene Seite
  await p.s.waitForSelector('.fi-schalter', { timeout: 15000 }).catch(() => {});
  pruefe('Einstellungen: beim Finisher nur ein Schalter (aus), keine Auswahl mehr', await p.s.locator('.fi-wahl, [data-finisher-wahl]').count() === 0
    && await p.s.locator('.fi-schalter').getAttribute('aria-checked') === 'false');
  // angemeldet ohne Abgleich fragt die Konto-Gruppe "Welchen Spielstand behalten?"; hier egal, das Blatt schliessen
  if (await p.s.locator('.dialog-ort .knopf').count()) {
    await p.s.keyboard.press('Escape');
    await p.s.waitForFunction(() => !document.querySelector('.dialog-ort .knopf'), null, { timeout: 5000 }).catch(() => {});
  }
  await p.s.locator('.fi-schalter').click();
  pruefe('Einstellungen: Einschalten bringt den zuletzt gewählten Finisher zurück (Signatur)', (await fiStand()).auswahl === 'signatur'
    && await p.s.locator('.fi-schalter').getAttribute('aria-checked') === 'true', await fiStand());
  // Kreatur (Labor): nur noch in der Sammlung, Tipp ruestet aus, zweiter Tipp nimmt sie ab. Seit 01.11.2026 (Flo: "die
  // Kreaturen gehoeren zu den Emotes") stehen sie im Bereich Emotes unter den Stickern
  const kreatur = () => p.s.evaluate(() => JSON.parse(localStorage.getItem('schach-arena:v1:einstellungen:ausdruck') || '{}').kreatur ?? null);
  await p.s.evaluate(() => window.__app.gehe('ich', { bereich: 'emotes' }));
  await p.s.waitForSelector('.sa-teil[data-teil="kreatur-kronli"]', { timeout: 15000 }).catch(() => {});
  await ruesteAus(p.s, 'kreatur-kronli');
  const kAn = await kreatur();
  await p.s.locator('.sa-teil[data-teil="kreatur-kronli"] .sa-wahl[data-ab]').click();
  await p.s.waitForFunction(() => document.querySelector('.sa-teil[data-teil="kreatur-kronli"]')?.dataset.zustand !== 'an', null, { timeout: 10000 }).catch(() => {});
  pruefe('Erfinder: Kreatur in der Sammlung ausrüsten (Kronli) und mit zweitem Tipp wieder abnehmen', kAn === 'kronli' && (await kreatur()) === null, { kAn, nach: await kreatur() });
  await p.s.evaluate(() => window.__app.gehe('ich'));
  await p.s.waitForSelector('.pr-karte', { timeout: 15000 }).catch(() => {});
  const erProfil = await p.s.evaluate(() => ({ titel: document.querySelector('.pr-karte .pr-chip-titel')?.textContent,
    rahmen: [...document.querySelectorAll('.sa-bereich[data-bereich="rahmen"] .sa-teil')].map((x) => x.dataset.zustand) }));
  pruefe('Erfinder: Profil mit „Der Erfinder“, alle Rahmen frei samt Blatt 0', erProfil.titel === 'Der Erfinder'
    && erProfil.rahmen.length > 10 && !erProfil.rahmen.includes('zu')
    && await p.s.locator('.sa-teil[data-teil="rahmen-erfinder-blatt-0"]').count() === 1, erProfil);
  pruefe('Erfinder: keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
  await p.k.close();

  // ein anderes Konto ohne Zeilen, das die Einstellung von Hand auf blaupause setzt: nichts davon wirkt
  p = await shopSeite(browser, { sitzung: SITZUNG, server: { sonder: [] }, bereich: null,
    vorher: { 'schach-arena:v1:einstellungen': JSON.stringify({ figuren: 'blaupause' }) } });
  await warte(800);
  pruefe('Ohne Sonderstücke: kein Erfinder-Bereich und kein leerer Platz', await p.s.locator('.sa-bereich[data-bereich="erfinder"], .sa-platz[data-bereich="erfinder"]').count() === 0);
  await p.s.evaluate(() => window.__app.gehe('partie', { botId: 'benno', farbe: 'w' }));
  await p.s.waitForSelector('img.figur', { timeout: 20000 }).catch(() => {});
  quellen = await figurenQuellen(p.s);
  pruefe('Ohne Sonderstücke: Standardfiguren, auch wenn die Einstellung blaupause sagt', quellen.length === 32 && !quellen.some((q) => q.includes('blaupause')), quellen.slice(0, 3));
  await p.s.evaluate(() => window.__app.gehe('ich', { bereich: 'finisher' }));
  await p.s.waitForSelector('.sa-screen', { timeout: 15000 }).catch(() => {});
  await warte(500);
  // Flo 01.11.2026: "Finisher ins Labor, nur ich soll die sehen, die kommen in den Shop"
  pruefe('Ohne Sonderstücke: kein Finisher-Bereich (Labor, später Shop)', await p.s.locator('.sa-bereich[data-bereich="finisher"], .sa-platz[data-bereich="finisher"]').count() === 0);
  await p.k.close();
}

// Ausruesten per Tipp: die Sammlung zeichnet danach neu (app.gehe ... ersetzen), erst dann steht das Teil auf "an".
// Darauf warten, sonst misst der Test zwischen Einstellung und neuem Bild (CI, PR #103)
// Sammlung B (G-002): jeder Bereich liegt hinter einem Platz und oeffnet als Blatt; ein offenes Blatt erst schliessen
async function waehle(s, id) {
  if (await s.locator('.sa-blatt').count()) {
    await s.locator('.sa-blatt .sheet-knoepfe button').first().click();
    await s.waitForSelector('.sa-blatt', { state: 'detached', timeout: 10000 }).catch(() => {});
  }
  await s.locator(`.sa-platz[data-bereich="${id}"], .sa-gross[data-bereich="${id}"]`).first().click();
  await s.waitForSelector(`.sa-blatt .sa-bereich[data-bereich="${id}"]:not([hidden])`, { timeout: 10000 });
  await warte(300);
}

async function ruesteAus(s, teil) {
  await s.locator(`.sa-teil[data-teil="${teil}"] .sa-wahl`).click();
  await s.waitForFunction((t) => document.querySelector(`.sa-teil[data-teil="${t}"]`)?.dataset.zustand === 'an', teil, { timeout: 10000 }).catch(() => {});
}

// Labor (Flo 31.10.2026): Bretter und Figuren nur im Erfinder-Konto, mit Schild "Labor"; Ausruesten per Tipp in der Sammlung
async function laborTeil(browser) {
  let p = await shopSeite(browser, { sitzung: SITZUNG, server: { sonder: ERFINDER_ZEILEN }, bereich: null });
  await p.s.waitForSelector('.sa-platz[data-bereich="erfinder"]', { timeout: 15000 }).catch(() => {});
  await waehle(p.s, 'bretter');
  const bretter = await p.s.evaluate(() => [...document.querySelectorAll('.sa-bereich[data-bereich="bretter"] .sa-teil')]
    .map((x) => ({ id: x.dataset.teil, labor: !!x.querySelector('.sa-labor'), wahl: !!x.querySelector('.sa-wahl') })));
  const lab = bretter.filter((b) => b.labor).map((b) => b.id).join();
  pruefe('Labor: zehn Bretter mit Schild (fünf Themen, fünf Welten), nur diese markiert', lab === 'brett-kuerbis,brett-frost,brett-marmor,brett-nussbaum,brett-thron,brett-acker,brett-moos,brett-pflaster,brett-brandung,brett-tiefsee', bretter);
  await ruesteAus(p.s, 'brett-kuerbis');
  pruefe('Labor: Tipp rüstet das Kürbis-Brett aus', await p.s.evaluate(() => document.documentElement.dataset.brett === 'kuerbis'
    && document.querySelector('.sa-teil[data-teil="brett-kuerbis"]')?.dataset.zustand === 'an'));
  await waehle(p.s, 'figuren');
  const saetze = await p.s.evaluate(() => [...document.querySelectorAll('.sa-bereich[data-bereich="figuren"] .sa-teil')].map((x) => x.dataset.teil).join());
  pruefe('Labor: Figurensätze Klassisch, Blaupause, dann Drachen, Zombies, Geister, Lava-Golem, Piraten, Ägypten, Wikinger, Dinos, Feuer, Stein, Halloween, Weihnachten, Ostern, Weltraum, Roboter, Naschwerk, Moosgeister, Tiefsee und die Materialien', saetze === 'figuren-cburnett,figuren-blaupause,figuren-drachen,figuren-zombies,figuren-geister,figuren-lavagolem,figuren-piraten,figuren-aegypten,figuren-wikinger,figuren-dinos,figuren-feuer,figuren-stein,figuren-halloween,figuren-weihnachten,figuren-ostern,figuren-weltraum,figuren-roboter,figuren-naschwerk,figuren-moosgeister,figuren-tiefsee,figuren-elfenbein,figuren-holz,figuren-marmor,figuren-gold,figuren-glas,figuren-neon,figuren-frost,figuren-kuerbis,figuren-pixel,figuren-geo', saetze);
  await ruesteAus(p.s, 'figuren-kuerbis');
  await waehle(p.s, 'klaenge');
  await ruesteAus(p.s, 'klang-holz');
  pruefe('Ausrüsten: Klangset per Tipp gewählt', await p.s.evaluate(() => JSON.parse(localStorage.getItem('schach-arena:v1:einstellungen') || '{}').klangpaket) === 'holz');
  const klaenge = await p.s.evaluate(() => [...document.querySelectorAll('.sa-bereich[data-bereich="klaenge"] .sa-teil')].filter((x) => x.querySelector('.sa-labor')).map((x) => x.dataset.teil).join());
  pruefe('Labor: Klangsets Juwel, Grusel und Kristall mit Schild', klaenge === 'klang-juwel,klang-grusel,klang-kristall', klaenge);
  await ruesteAus(p.s, 'klang-grusel');
  pruefe('Labor: Grusel per Tipp gewählt und aktiv', await p.s.evaluate(async () => {
    const { klang } = await import('./js/sounds.js');
    return klang.vorrat().paket === 'grusel' && document.querySelector('.sa-teil[data-teil="klang-grusel"]')?.dataset.zustand === 'an';
  }));
  // Lobby-Musik (Flo 31.10.: "kann die Lobby-Musik nicht ausschalten, wenn ich zweimal drauf klicke")
  // und Flo 31.10. abends: "wenn ich auf die Lobby klicke, springt der nach oben": die Seite bleibt, wo sie war
  const obenVor = await p.s.evaluate(() => {
    document.querySelector('.sa-teil[data-teil="melodie-karofelder"]').scrollIntoView({ block: 'center' });
    document.querySelector('.sa-screen').dataset.alt = '1';
    const b = document.querySelector('.sa-blatt');
    return { st: b.scrollTop, roll: b.scrollHeight > b.clientHeight + 40,
      top: Math.round(document.querySelector('.sa-teil[data-teil="melodie-karofelder"]').getBoundingClientRect().top) };
  });
  await ruesteAus(p.s, 'melodie-karofelder');
  await warte(300);
  const obenNach = await p.s.evaluate(() => ({ st: document.querySelector('.sa-blatt').scrollTop,
    top: Math.round(document.querySelector('.sa-teil[data-teil="melodie-karofelder"]').getBoundingClientRect().top) }));
  // Sammlung B: das Blatt scrollt in sich; die Melodie bleibt an ihrer Stelle (gerollt oder nicht)
  pruefe('Ausrüsten: das Blatt springt nicht nach oben, es bleibt an der Melodie', (!obenVor.roll || obenVor.st > 0)
    && Math.abs(obenNach.top - obenVor.top) <= 30 && Math.abs(obenNach.st - obenVor.st) <= 30, { obenVor, obenNach });
  // iPad (Flo 31.10. abends: "springt immer noch nach oben"): kein Neuaufbau des Screens mehr, nur die Karten werden neu gezeichnet
  pruefe('Ausrüsten: derselbe Screen bleibt stehen (kein Neuaufbau), die Stelle stimmt aufs Pixel',
    await p.s.evaluate(() => document.querySelector('.sa-screen')?.dataset.alt === '1') && Math.abs(obenNach.top - obenVor.top) <= 1, { obenVor, obenNach });
  pruefe('Lobby-Musik: Tipp auf Karofelder schaltet sie ein', await p.s.evaluate(() => {
    const e = JSON.parse(localStorage.getItem('schach-arena:v1:einstellungen') || '{}');
    return e.musik === true && e.musikMelodie === 'karofelder';
  }));
  await p.s.locator('.sa-teil[data-teil="melodie-karofelder"] .sa-wahl').click();
  await p.s.waitForFunction(() => document.querySelector('.sa-teil[data-teil="melodie-karofelder"]')?.dataset.zustand === 'frei', null, { timeout: 10000 }).catch(() => {});
  pruefe('Lobby-Musik: zweiter Tipp auf die laufende Melodie schaltet die Musik aus', await p.s.evaluate(() => {
    const e = JSON.parse(localStorage.getItem('schach-arena:v1:einstellungen') || '{}');
    return e.musik === false && document.querySelector('.sa-teil[data-teil="melodie-karofelder"]')?.dataset.zustand === 'frei';
  }));
  await p.s.evaluate(() => window.__app.gehe('partie', { botId: 'benno', farbe: 'w' }));
  await p.s.waitForSelector('img.figur', { timeout: 20000 }).catch(() => {});
  let quellen = await figurenQuellen(p.s);
  pruefe('Labor: in der Partie alle 32 Figuren im Kürbis-Satz', quellen.length === 32 && quellen.every((q) => q.includes('/kuerbis/')), quellen.slice(0, 3));
  pruefe('Labor: keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
  await p.k.close();

  // anderes Konto, Einstellungen von Hand auf Labor gesetzt: nichts davon wirkt, nichts davon ist zu sehen
  p = await shopSeite(browser, { sitzung: SITZUNG, server: { sonder: [] }, bereich: 'bretter',
    vorher: { 'schach-arena:v1:einstellungen': JSON.stringify({ brett: 'kuerbis', figuren: 'kuerbis', klangpaket: 'grusel' }) } });
  await warte(500);
  pruefe('Ohne Labor: Klang bleibt beim Standard (Arcade), kein Grusel in der Sammlung', await p.s.evaluate(async () => {
    const { klang } = await import('./js/sounds.js');
    return klang.vorrat().paket === 'arcade' && !document.querySelector('[data-teil="klang-grusel"]');
  }));
  pruefe('Ohne Labor: Brett bleibt Nacht, keine Labor-Teile, kein Figuren-Bereich', await p.s.evaluate(() => document.documentElement.dataset.brett === 'nacht'
    && !document.querySelector('.sa-labor') && !document.querySelector('.sa-platz[data-bereich="figuren"]')));
  await p.s.evaluate(() => window.__app.gehe('partie', { botId: 'benno', farbe: 'w' }));
  await p.s.waitForSelector('img.figur', { timeout: 20000 }).catch(() => {});
  quellen = await figurenQuellen(p.s);
  pruefe('Ohne Labor: Standardfiguren, auch wenn die Einstellung kuerbis sagt', quellen.length === 32 && !quellen.some((q) => /kuerbis|frost|gold/.test(q)), quellen.slice(0, 3));
  // Dabei seit (Flo 31.10.2026): ohne Partien zaehlt der erste Tag, Monat kurz und Jahr
  await p.s.evaluate(() => window.__app.gehe('ich'));
  await p.s.waitForSelector('.pr-karte .pr-seit', { timeout: 15000 }).catch(() => {});
  const seit = await p.s.evaluate(() => document.querySelector('.pr-karte .pr-seit')?.textContent || '');
  pruefe('Profil: „Dabei seit“ mit Monat und Jahr', /^Dabei seit \S+ 20\d\d$/.test(seit), seit);
  await p.k.close();
}

// Profil (Flo, 30.10.2026): Figur und Rahmen waehlen, Vitrine mit einem erspielten Erfolg, Flexen im Duell-Intro
async function profilTeil(browser) {
  const sieg = { bots: { [BOTS[0].id]: { sterne: [true, false, false] } }, brillanteZuege: [] };
  const p = await shopSeite(browser, { bereich: 'rahmen', vorher: { 'schach-arena:v1:fortschritt': JSON.stringify(sieg),
    'schach-arena:v1:einstellungen': JSON.stringify({ duellIntro: 'immer', klang: false }) } });
  await p.s.waitForSelector('.pr-karte', { timeout: 15000 }).catch(() => {});
  pruefe('Freischalt-Moment: der erste Sieg zeigt sich beim Öffnen von „Ich“', p.moment >= 1, p.moment);
  const vorher = await p.s.evaluate(() => ({ karte: !!document.querySelector('.pr-karte'), figur: document.querySelector('.pr-av svg')?.dataset.figur,
    leer: document.querySelectorAll('.pr-orden.leer').length, oben: !!document.querySelector('.sa-kopf-ort .pr-karte') }));
  pruefe('Profil: Karte oben im Reiter „Ich“, Bauer als Bild, drei leere Plätze', vorher.karte && vorher.oben && vorher.figur === 'P' && vorher.leer === 3, vorher);
  const rahmen = await p.s.evaluate(() => [...document.querySelectorAll('.sa-bereich[data-bereich="rahmen"] .sa-teil')].map((x) => ({
    id: x.dataset.teil, z: x.dataset.zustand, zeile: x.querySelector('.sa-zeile')?.textContent })));
  const r = (id) => rahmen.find((x) => x.id === 'rahmen-' + id) || {};
  pruefe('Rahmen: ohne an, Holz frei, unerreichte Liga-Rahmen ausgeblendet, Serie 30 mit Schloss und Weg', r('ohne').z === 'an' && r('holz').z !== 'zu'
    && !rahmen.some((x) => /^rahmen-liga-/.test(x.id)) && r('serie-30').z === 'zu' && /30/.test(r('serie-30').zeile || '')
    && !rahmen.some((x) => x.id === 'rahmen-erfinder-blatt-0'), rahmen);
  await p.s.locator('.sa-blatt .sheet-knoepfe button').first().click();
  await p.s.waitForSelector('.sa-blatt', { state: 'detached', timeout: 10000 }).catch(() => {});
  await p.s.locator('.pr-aendern').click();
  await p.s.waitForSelector('.pr-blatt .pr-figur', { timeout: 5000 });
  pruefe('Profil-Blatt: gesperrter Rahmen ist nicht wählbar', await p.s.locator('.pr-rahmen[data-rahmen="serie-30"]').isDisabled());
  // das Blatt gleitet herein: erst messen, wenn es steht
  await p.s.waitForFunction(() => { const b = document.querySelector('.pr-blatt .sheet-knoepfe button'); return !!b && b.getBoundingClientRect().bottom <= innerHeight; },
    null, { timeout: 3000 }).catch(() => {});
  const wahlInfo = await p.s.evaluate(() => ({ figuren: [...document.querySelectorAll('.pr-blatt .pr-figur')].map((b) => b.dataset.figur).join(),
    kreaturen: [...document.querySelectorAll('.pr-blatt .pr-kreatur')].map((b) => b.dataset.figur + (b.disabled ? '-' : '+')).join(),
    gruende: [...document.querySelectorAll('.pr-blatt .pr-grund')].map((b) => b.dataset.grund + (b.disabled ? '-' : '+')).join(),
    vorschau: !!document.querySelector('.pr-blatt .pr-vorschau svg'),
    scrollt: getComputedStyle(document.querySelector('.pr-blatt .pr-wahl')).overflowY,
    fertigImBild: document.querySelector('.pr-blatt .sheet-knoepfe button').getBoundingClientRect().bottom <= innerHeight }));
  // Flo 31.10.: "mehr Optionen ... nur ich der Erschaffer kann den Koenig waehlen"
  pruefe('Profil-Blatt: kein König (nur der Erfinder), Kreaturen gesperrt bis die Welt gemeistert ist, Karofelder-Hintergrund frei, Vorschau oben, nur die Wahl scrollt',
    wahlInfo.figuren === 'Q,R,B,N,P' && wahlInfo.kreaturen === 'karo-,stups-,zinni-,klippa-,glimm-' && /welt-1\+/.test(wahlInfo.gruende)
    && /welt-2-/.test(wahlInfo.gruende) && wahlInfo.vorschau && wahlInfo.scrollt === 'auto' && wahlInfo.fertigImBild, wahlInfo);
  await p.s.locator('.pr-grund[data-grund="welt-1"]').click();
  pruefe('Profil-Blatt: Hintergrund Karofelder wählen, die Vorschau zeigt ihn sofort',
    await p.s.evaluate(() => document.querySelector('.pr-blatt .pr-vorschau svg')?.dataset.grund === 'welt-1'));
  await p.s.locator('.pr-figur[data-figur="Q"]').click();
  await p.s.locator('.pr-rahmen[data-rahmen="holz"]').click();
  await p.s.locator('.pr-blatt .sheet-knoepfe button', { hasText: 'Fertig' }).click();
  await p.s.waitForFunction(() => document.querySelector('.pr-av svg')?.dataset.figur === 'Q', null, { timeout: 5000 }).catch(() => {});
  pruefe('Profil: Dame mit Holzrahmen nach „Fertig“', await p.s.evaluate(() => {
    const a = document.querySelector('.pr-av svg');
    return !!a && a.dataset.figur === 'Q' && a.dataset.rahmen === 'holz';
  }));
  await p.s.locator('.pr-orden[data-platz="0"]').click();
  await p.s.waitForSelector('.pr-orden-knopf', { timeout: 5000 });
  const auswahl = await p.s.evaluate(() => [...document.querySelectorAll('.pr-orden-knopf')].map((x) => x.dataset.erfolg));
  // Etappe 4b: die Vitrine zeigt Erfolgs-Familien mit Stufe (erster Sieg = Siegeszug Bronze)
  pruefe('Vitrine: zur Wahl steht nur Erspieltes (hier: Siegeszug Bronze)', auswahl.join() === 'stufe-siege', auswahl);
  await p.s.locator('.pr-orden-knopf[data-erfolg="stufe-siege"]').click();
  await p.s.locator('.pr-blatt .sheet-knoepfe button', { hasText: 'Fertig' }).click();
  await p.s.waitForSelector('.pr-orden:not(.leer)', { timeout: 5000 }).catch(() => {});
  pruefe('Vitrine: Platz 1 zeigt „Siegeszug“ mit Stufe Bronze', await p.s.evaluate(() => {
    const o = document.querySelector('.pr-orden[data-platz="0"]');
    return !!o && /Siegeszug/.test(o.textContent) && o.dataset.stufe === '1';
  }));
  pruefe('Profil passt aufs Handy', await p.s.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await p.s.reload();
  await p.s.waitForSelector('.pr-karte', { timeout: 15000 });
  pruefe('Profil bleibt nach dem Neuladen', await p.s.evaluate(() => document.querySelector('.pr-av svg')?.dataset.figur === 'Q'
    && /Siegeszug/.test(document.querySelector('.pr-orden[data-platz="0"]')?.textContent || '')));
  await p.s.evaluate(() => window.__app.gehe('arena'));
  await p.s.waitForSelector('.detail [data-aktion="spielen"]', { timeout: 15000 });
  await warte(600);
  await p.s.locator('.detail [data-aktion="spielen"]').first().click();
  await p.s.waitForSelector('.duell.voll', { timeout: 5000 }).catch(() => {});
  const duell = await p.s.evaluate(() => ({ orden: [...document.querySelectorAll('.duell.voll .duell-seite.flo .duell-orden')].map((x) => x.textContent),
    // Layout-Breite (getComputedStyle), nicht das Rechteck: das Abzeichen springt gerade mit scale(.7) herein
    bilder: [...document.querySelectorAll('.duell.voll .duell-seite.flo .duell-orden.mit-bild > svg.sk-erfolg')].map((x) => Math.round(parseFloat(getComputedStyle(x).width))),
    figur: document.querySelector('.duell.voll [data-rolle="flo"] svg')?.dataset.figur, titel: document.querySelectorAll('.duell.voll .duell-titel').length }));
  pruefe('Duell-Intro: unter Flo steht die Vitrine mit Abzeichen (Flo 01.11.2026), Avatar ist die Dame, ohne Erfinder kein Titel', duell.orden.join() === 'Siegeszug'
    && duell.bilder.length === 1 && duell.bilder[0] >= 36 && duell.figur === 'Q' && duell.titel === 0, duell);
  pruefe('Profil: keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
  await p.k.close();
}

// Eigener Name (Flo 01.11.2026: "Ein Freund hat sich angemeldet ... der Account heisst Flo"): Profilkarte und Partie zeigen den
// Benutzernamen des angemeldeten Kontos, ohne Namen "Du", nie fest "Flo"
async function nameTeil(browser) {
  let p = await shopSeite(browser, { sitzung: SITZUNG, bereich: null,
    vorher: { 'schach-arena:konto:name': JSON.stringify({ konto: SITZUNG.user.id, name: 'lena_spielt' }) } });
  await p.s.waitForSelector('.pr-karte', { timeout: 15000 });
  const karte = await p.s.locator('.pr-name b').innerText();
  await p.s.evaluate(() => window.__app.gehe('partie', { botId: 'benno', farbe: 'w' }));
  await p.s.waitForSelector('.screen.partie .spieler.ich .name', { timeout: 15000 });
  const partie = await p.s.evaluate(() => ({ name: document.querySelector('.spieler.ich .name').textContent, aria: document.querySelector('.spieler.ich').getAttribute('aria-label') }));
  pruefe('Mit Benutzernamen: Profilkarte und Partie zeigen ihn', karte === 'lena_spielt' && partie.name === 'lena_spielt' && partie.aria === 'lena_spielt', { karte, partie });
  pruefe('Name: keine Seitenfehler', p.fehlerListe.length === 0, p.fehlerListe.join(' | '));
  await p.k.close();
  p = await shopSeite(browser, { sitzung: SITZUNG, bereich: null });
  await p.s.waitForSelector('.pr-karte', { timeout: 15000 });
  const ohne = await p.s.locator('.pr-name b').innerText();
  pruefe('Ohne Benutzernamen: "Du" statt eines fremden Namens', ohne === 'Du', ohne);
  await p.k.close();
}

async function browserTeil() {
  const pw = ladePlaywright();
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
  let browser;
  try {
    await warteAufServer(`http://127.0.0.1:${PORT}/index.html`);
    browser = await browserTyp(pw).launch();
    for (const [name, width, height] of [['ipad-quer', 1180, 820], ['handy', 390, 844]]) {
      const k = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', timezoneId: 'Europe/Berlin' });
      const s = await k.newPage();
      const fehlerListe = [];
      s.on('pageerror', (e) => fehlerListe.push(e.message));
      s.on('console', (m) => { if (m.type() === 'error' || /unbekanntes Modul/.test(m.text())) fehlerListe.push(m.text()); });
      await s.goto(BASIS + '#arena');
      await s.waitForFunction(() => !!window.__app && !!document.querySelector('.screen'), null, { timeout: 30000 });
      await s.evaluate(() => localStorage.clear());
      await s.goto(BASIS + '#arena');
      await s.waitForFunction(() => !!window.__app && !!document.querySelector('.reiter-leiste'), null, { timeout: 30000 });
      await warte(800);
      const reiter = await s.evaluate(() => [...document.querySelectorAll('.reiter-leiste [data-reiter]')].map((x) => x.dataset.reiter).join());
      pruefe(`${name}: Reiter-Leiste mit „Ich“`, reiter.split(',').includes('ich'), reiter);
      await s.locator('.reiter-leiste [data-reiter="ich"]').first().click();
      await s.waitForSelector('.sa-screen', { timeout: 15000 });
      await warte(700);
      const bereiche = await s.evaluate(() => [...document.querySelectorAll('.sa-bereich')].map((x) => x.dataset.bereich).join());
      // ohne Erfinder-Konto keine Finisher (Labor, Flo 01.11.2026)
      pruefe(`${name}: acht Bereiche (Emotes, Titel, Banner, Rahmen, Bretter, Klänge, Erfolge, Shop), keine Finisher`, bereiche === 'emotes,titel,banner,rahmen,bretter,klaenge,erfolge,shop', bereiche);
      const stand = await s.locator('.sa-stand').innerText();
      const zaehl = await s.evaluate(() => ({ alle: document.querySelectorAll('.sa-teil').length, frei: document.querySelectorAll('.sa-teil:not([data-zustand="zu"])').length }));
      pruefe(`${name}: Zähler „N von M freigeschaltet“ passt zu den Karten`, stand === `${zaehl.frei} von ${zaehl.alle} freigeschaltet` && zaehl.frei < zaehl.alle, { stand, zaehl });
      await waehle(s, 'titel');
      const tit = await s.evaluate(() => [...document.querySelectorAll('.sa-bereich[data-bereich="titel"] .sa-teil')].map((x) => ({
        id: x.dataset.teil, z: x.dataset.zustand, schloss: !!x.querySelector('.sa-bild .sa-frage'), zeile: x.querySelector('.sa-zeile').textContent,
        wappen: !!x.querySelector('.sa-bild svg.titel-wappen') })));
      const funke = tit.find((x) => x.id === 'titel-level-1');
      const glut = tit.find((x) => x.id === 'titel-level-5');
      pruefe(`${name}: Titel mit Wappen: Funke getragen (automatisch), Glut geheimnisvoll (?) ab Level 5`, !!funke && funke.z === 'an' && funke.wappen
        && glut.z === 'zu' && glut.schloss && glut.zeile === 'Ab Level 5' && tit.every((x) => x.wappen), tit.slice(0, 3));
      pruefe(`${name}: nur ein Bereich sichtbar`, await s.locator('.sa-bereich:not([hidden])').count() === 1);
      await waehle(s, 'erfolge');
      // Etappe 4b: Erfolge in drei Stufen, die Zeile nennt den Weg zur naechsten Stufe
      pruefe(`${name}: Erfolge gewählt, Weg dahin sichtbar`, await s.locator('.sa-bereich[data-bereich="erfolge"]:not([hidden])').count() === 1
        && /0 von 1 Siege gegen Bots bis Bronze/.test(await s.locator('.sa-bereich[data-bereich="erfolge"]').innerText()));
      const quer = await s.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      pruefe(`${name}: kein waagrechtes Scrollen der Seite`, quer);
      await s.reload();
      await s.waitForSelector('.sa-screen', { timeout: 15000 });
      // Sammlung B: nach dem Neuladen wieder die Uebersicht (kein Blatt offen, alle Bereiche zu)
      await warte(400);
      pruefe(`${name}: nach dem Neuladen die Übersicht mit Plätzen, kein Blatt offen`, await s.locator('.sa-blatt').count() === 0
        && await s.locator('.sa-platz').count() >= 6 && await s.locator('.sa-bereich:not([hidden])').count() === 0);
      pruefe(`${name}: keine Konsolenfehler`, fehlerListe.length === 0, fehlerListe.join(' | '));
      await k.close();
    }
    await shopTeil(browser);
    await erfinderTeil(browser);
    await laborTeil(browser);
    await profilTeil(browser);
    await nameTeil(browser);
    // Englisch
    const k = await browser.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: 'block' });
    const s = await k.newPage();
    await s.goto(`http://127.0.0.1:${PORT}/index.html?test&sprache=en#ich`);
    await s.waitForSelector('.sa-screen', { timeout: 30000 });
    await waehle(s, 'titel');
    const text = (await s.locator('.sa-screen').innerText()) + '\n' + (await s.locator('.sa-blatt').innerText());
    pruefe('Englisch: Me (Reitername), unlocked, From level', /^Me$/m.test(text) && /of \d+ unlocked/.test(text) && /From level 5/.test(text), text.slice(0, 200));
    await k.close();
  } catch (e) {
    pruefe('Browser-Teil läuft durch', false, e.message);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

if (!NUR_NODE) await browserTeil();
console.log(`${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
