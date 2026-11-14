// Paket sammlung: der Reiter "Ich" mit der Sammlung (Screen js/ui/ich.js, Optik css/pakete/sammlung.css).
// Dieses Paket fuellt die Bereiche, die zum Kern gehoeren: Bretter und Klaenge (frei waehlbar in den Einstellungen) und
// Erfolge, die sich aus dem Spielstand ablesen lassen (keine eigene Buchfuehrung, nichts zum Kaufen). Finisher, Emotes
// und Titel bringen ihre Pakete selbst am Ort sammlung:bereich mit.
// Orte: ich:kopf Profil 10 und duell:profil? (profil.js); sammlung:bereich Erfinder 5 (nur mit Sonderstuecken, erfinder.js), Rahmen 35 (profil.js), Bretter 40, Klaenge 50, Erfolge 90, Shop 95 (Editionen, js/pakete/sammlung/shop.js)
import { anbieten, waehle } from '../../orte.js';
import { freischalten, bereich } from '../../ui/ich.js';
import { ladeEinstellungen, ladeFortschritt, gesamtSterne, besiegteBots, sterneZahl, ladeModul, ladePartien, wertet } from '../../storage.js';
import { erspielteErfolge, merkeErspielteErfolge } from '../../profil.js';
import { BEREICHE as SCHUL_BEREICHE, ALLE as SCHUL_LEKTIONEN, summe as schulSumme } from '../lernen/mattbilder.js';
import { BOTS, WELTEN } from '../../bots.js';
import { PAKETE_KLANG } from '../../sounds.js';
import { klangKunst, brettKunst, erfolgKunst, erfolgSeltenheit } from '../../sammlung-kunst.js';
import { t } from '../../sprache.js';
import { LABOR_BRETTER, LABOR_FIGUREN, LABOR_KLAENGE, laborFrei, brettWahl, klangWahl } from '../../labor.js';
import { figurenSatz, figurenPfad } from '../../figurensatz.js';
import { hatSonderstueck, ERFINDER } from '../../sonderstuecke.js';
import { shopBereich } from './shop.js';
import { erfinderBereich } from './erfinder.js';
import { hoere } from '../../ereignisse.js';
import { ladeBesitz, abgleichen, zaehleRaetsel } from '../../besitz.js';
import { kronenSpeicher, stufeInfo } from '../liga/kronen.js';
import { lade as ladePunkte, tafelStatistik } from '../punkte/stand.js';
import { FAMILIEN, familienStand } from './stufen.js';
import { zeigeStufen } from './moment.js';
import { titelJetzt, talerJetzt } from './profil.js';
import './texte.js';
import './karte-texte.js';

const PAKET = 'sammlung';
const S = (k, w) => t('p-sammlung.' + k, w);
// Farben wie die Brettwahl in js/ui/partie.js (BRETTER): hell, dunkel
const BRETTER = Object.freeze([['nacht', '#e4e8f6', '#7c87b6', '#2A3150'], ['gruen', '#eeeed2', '#769656', '#3E5A2A'], ['holz', '#f0d9b5', '#b58863', '#6E4420']]);

if (typeof document !== 'undefined' && !document.querySelector('link[data-paket="sammlung"]')) {
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.dataset.paket = PAKET;
  css.href = new URL('../../../css/pakete/sammlung.css', import.meta.url).href;
  document.head.appendChild(css);
}

const klangBild = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11"/></svg>';
const sternBild = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z"/></svg>';

// Ausruesten per Tipp (js/ui/ich.js): wahl() setzt die Einstellung ueber die App; ohne App (Node-Tests) keine Wahl
const wahlVon = (app, teil) => (app && typeof app.setzeEinstellungen === 'function' ? () => app.setzeEinstellungen(teil) : undefined);

// Oberflaechen der seltenen Labor-Bretter (14.11.2026): nur das Erfinder-Konto laedt sie, und zwar beim ersten Sammelbild mit
// freiem Labor (Befund ed: auf einem neuen Geraet kommt der Erfinder-Status erst nach dem Laden). Ist die Datei da, wird der
// offene Screen "Ich" ruhig neu gezeigt; fehlt sie (offline, nicht im Cache), bleiben die Farben ohne Oberflaeche und das
// naechste Sammelbild fragt noch einmal
let FLAECHEN = null;
let flaechenLaden = null;
function flaechenAnstossen(app) {
  if (FLAECHEN || flaechenLaden || !laborFrei()) return;
  flaechenLaden = import('../../brett-flaechen.js').then((m) => {
    FLAECHEN = m;
    const s = typeof document !== 'undefined' && document.querySelector('.sa-screen');
    if (!s || !app || typeof app.gehe !== 'function') return;
    const oben = s.querySelector('.sa-rumpf')?.scrollTop || 0;
    app.gehe('ich', { ...(s.dataset.bereich ? { bereich: s.dataset.bereich } : {}), oben, ruhig: true }, { ersetzen: true });
  }).catch(() => {}).finally(() => { flaechenLaden = null; });
}

export function teileBretter(e = ladeEinstellungen(), app = null) {
  flaechenAnstossen(app);
  const an = brettWahl(e.brett);
  // Labor (Flo 31.10.2026): Kuerbis, Frost, Marmor, Nussbaum, Thron nur im Erfinder-Konto (js/labor.js)
  const liste = [...BRETTER, ...(laborFrei() ? LABOR_BRETTER.map((b) => [b.id, b.hell, b.dunkel, b.rand, true, (b.flaeche && FLAECHEN && FLAECHEN.brettMuster(b)) || b.muster]) : [])];
  // echte Figuren des ausgeruesteten Satzes (Flo 31.10.: "der Koenig sieht ganz anders aus")
  const figuren = new URL('../../../' + figurenPfad(e), import.meta.url).href;
  return liste.map(([id, h, d, r, labor, muster]) => ({ id: 'brett-' + id, name: S('brett.' + id), frei: true, an: an === id, zeile: an === id ? S('an') : S('frei'),
    bild: brettKunst(h, d, r, figuren, muster), labor: !!labor, wahl: wahlVon(app, { brett: id }) }));
}

// Figurensaetze: Klassisch fuer alle, Blaupause mit Sonderstueck, die Saetze des Labors fuer den Erfinder. Bild: weisser
// Springer und schwarzer Koenig des Satzes auf einer Scheibe
const figurenBild = (satz) => {
  const pfad = (f) => new URL(`../../../assets/pieces/${satz === 'cburnett' ? '' : satz + '/'}${f}.svg`, import.meta.url).href;
  return `<span class="sk-figuren" data-satz="${satz}"><img src="${pfad('wN')}" alt=""><img src="${pfad('bK')}" alt=""></span>`;
};
export function teileFiguren(e = ladeEinstellungen(), app = null) {
  const an = figurenSatz(e);
  const saetze = [['cburnett', false], ...(hatSonderstueck(ERFINDER.figuren) ? [['blaupause', false]] : []),
    ...(laborFrei() ? LABOR_FIGUREN.map((s) => [s, true]) : [])];
  return saetze.map(([s, labor]) => ({ id: 'figuren-' + s, name: S('figuren.' + s), frei: true, an: an === s, zeile: an === s ? S('an') : S('frei'),
    bild: figurenBild(s), labor, wahl: wahlVon(app, { figuren: s }) }));
}

export function teileKlaenge(e = ladeEinstellungen(), app = null) {
  // '' heisst: Standard der Ansicht (heute Arcade, js/sounds.js)
  // Labor-Klangsets (Grusel, Kristall) nur fuer den Erfinder (js/labor.js), mit Schild "Labor"
  const labor = laborFrei() ? LABOR_KLAENGE : [];
  const p = klangWahl(e.klangpaket);
  const gewaehlt = PAKETE_KLANG[p] || labor.includes(p) ? p : 'arcade';
  const sets = [...Object.keys(PAKETE_KLANG), ...labor].map((id) => ({ id: 'klang-' + id, name: S('klang.' + id), frei: true, an: gewaehlt === id, zeile: gewaehlt === id ? S('an') : S('frei'),
    bild: klangKunst(id) || klangBild, labor: labor.includes(id), gruppe: S('gruppe.klangsets'), wahl: wahlVon(app, { klangpaket: id }) }));
  // Lobby-Musik (Paket musik, Ort sammlung:musik?): ohne das Paket gibt es sie nicht, dann nur die Klangsets
  let musik = null;
  try { musik = waehle('sammlung:musik?', {}); } catch (e) { musik = null; }
  return Array.isArray(musik) && musik.length ? [...sets, ...musik.map((m) => ({ ...m, gruppe: S('gruppe.musik') }))] : sets;
}

// Was die Erfolge ausser den Bot-Ergebnissen lesen (nur lesen, nie schreiben): beste Liga-Stufe aller Saisons
// (Paket liga), laengste Serie in Tagen (Paket serie, best) und das Funken-Level
export function spielstand() {
  const sicher = (m, f) => { try { return ladeModul(m, null) || f; } catch (e) { return f; } };
  const liga = sicher('liga', {});
  const stufen = [liga.saison && liga.saison.stufe, ...(Array.isArray(liga.archiv) ? liga.archiv.map((a) => a && a.stufe) : [])]
    .filter((x) => Number.isInteger(x) && x >= 0);
  const serie = sicher('serie', {});
  const funken = sicher('funken', {});
  // Etappe 4b: Gold der Familie Ligaaufstieg (Krone III) verspricht den Titel Ligakrone, der am alten Erfolg liga-6
  // haengt; deshalb zaehlt die gebuchte Gold-Stufe wie die hoechste Stufe der alten Liga
  let ligaGold = false;
  try { ligaGold = ladeBesitz().stufen.liga === 3; } catch (e) { ligaGold = false; }
  if (ligaGold) stufen.push(LIGA_STUFEN);
  return { ligaBest: stufen.length ? Math.max(...stufen) : 0, serieBest: Number.isInteger(serie.best) ? serie.best : 0,
    level: Number.isInteger(funken.level) ? funken.level : 1 };
}

// Was die Koennen-Titel vom 08.11.2026 lesen (Flo: zwoelf neue Titel, jeder erklaert eine vorhandene Zahl). Nur Daten, die
// der Browser schon hat, nur lesen; jede kaputte Quelle zaehlt als 0. Fortschritt (Welten, Sterne), Kronen-Stufe des
// letzten Server-Stands, Raetsel-Zaehler (js/besitz.js, Tagesraetsel), Tafeln und Rekorde (Paket punkte), richtig
// geloeste Karten der Fehler-Kartei, fertige Kapitel der Meisterschule (nur im Labor) und bezwungene Erzfeinde (Modul bots).
export function titelDaten(f = ladeFortschritt(), schule = schulStand()) {
  const sicher = (fn, ersatz) => { try { const x = fn(); return x == null ? ersatz : x; } catch (e) { return ersatz; } };
  const zahl = (x) => (Number.isFinite(x) && x > 0 ? Math.floor(x) : 0);
  const besiegt = (b) => !!(f.bots[b.id] && f.bots[b.id].sterne[0]);
  const welten = WELTEN.map((w) => BOTS.filter((b) => b.welt === w.nr)).filter((bs) => bs.length);
  const tafel = sicher(() => tafelStatistik(ladePunkte()), {});
  const kartei = sicher(() => ladeModul('kartei', null), {});
  const bots = sicher(() => ladeModul('bots', null), {});
  const erzfeind = bots && bots.erzfeind && typeof bots.erzfeind === 'object' && !Array.isArray(bots.erzfeind) ? bots.erzfeind : {};
  return {
    kronenStufe: sicher(() => { const k = kronenSpeicher(ladeModul('kronen', {})); return k.stand && Number.isInteger(k.stand.stufe) ? stufeInfo(k.stand.stufe).index : -1; }, -1),
    raetsel: zahl(sicher(() => ladeBesitz().raetsel.n, 0)),
    weltenMitSieg: sicher(() => welten.filter((bs) => bs.some(besiegt)).length, 0), weltenAlle: welten.length,
    sterneWelt: sicher(() => welten.some((bs) => bs.every((b) => sterneZahl(b.id, f) === 3)), false),
    platz1: zahl(tafel.platz1), rekorde: zahl(tafel.rekorde),
    kartei: zahl(kartei && kartei.zaehler && kartei.zaehler.richtig),
    schulKapitel: schule ? schule.bereiche.filter((b) => b.alle > 0 && b.geschafft >= b.alle).length : 0,
    erzfeind: Object.keys(erzfeind).length,
  };
}
export const LIGA_STUFEN = 6;                      // Bronze bis Meister (Paket liga, STUFEN 1 bis 6)
export const SERIE_ZIELE = Object.freeze([7, 30, 100]);
export const LEVEL_ZIELE = Object.freeze([10, 20, 30]);
export const SIEGE_ZIELE = Object.freeze([10, 50, 100]);
export const SIEGESSERIE = 5;

// Erfolge aus dem Partien-Archiv (nur wertende Partien): Sieg mit Schwarz und die beste Siegesfolge. Einmal geschafft,
// bleiben sie (js/profil.js erspielteErfolge), auch wenn die Partie spaeter aus dem Archiv (300 Partien) faellt.
export function partienStand(partien = null) {
  let liste = [];
  try { liste = (Array.isArray(partien) ? partien : ladePartien()).filter(wertet); } catch (e) { liste = []; }
  // das Archiv kommt neueste zuerst
  const zeit = (p) => String((p && p.datum) || '');
  let folge = 0;
  let beste = 0;
  for (const p of [...liste].sort((a, b) => zeit(a).localeCompare(zeit(b)))) {
    if (p && p.ergebnis === 'sieg') { folge += 1; beste = Math.max(beste, folge); } else folge = 0;
  }
  const neu = [];
  if (liste.some((p) => p && p.ergebnis === 'sieg' && p.spielerFarbe === 'b')) neu.push('schwarz-sieg');
  if (beste >= SIEGESSERIE) neu.push('siegesserie-' + SIEGESSERIE);
  let gemerkt = [];
  try { gemerkt = erspielteErfolge(); } catch (e) { gemerkt = []; }
  if (neu.some((x) => !gemerkt.includes(x))) {
    try { merkeErspielteErfolge(neu); } catch (e) { /* ohne Speicher nur fuer jetzt */ }
    gemerkt = [...new Set([...gemerkt, ...neu])];
  }
  return { beste, frei: gemerkt };
}

// Meisterschule (Paket lernen): nur, solange sie im Labor steht (js/labor.js laborFrei), sonst gaebe es keinen Weg dahin
export function schulStand(roh = undefined) {
  if (roh === undefined) {
    if (!laborFrei()) return null;
    try { roh = ladeModul('lernen', {}); } catch (e) { roh = {}; }
  }
  return {
    bereiche: SCHUL_BEREICHE.map((b) => ({ id: b.id, alle: b.lektionen.length, ...schulSumme(roh, b.id) })),
    gesamt: { alle: SCHUL_LEKTIONEN.length, ...schulSumme(roh) },
  };
}

// Erfolge nur aus dem Spielstand: Sieg, drei Sterne, je Welt alle Bots, alle Bots, alle Sterne, dazu (Flo 30.10.,
// Profil mit Vitrine) Liga-Stufen, Serie und Level
export function teileErfolge(f = ladeFortschritt(), z = spielstand(), pa = partienStand(), schule = schulStand()) {
  const besiegt = (b) => !!(f.bots[b.id] && f.bots[b.id].sterne[0]);
  const n = besiegteBots(f);
  const sterne = gesamtSterne(f);
  const dreiSterne = BOTS.some((b) => sterneZahl(b.id, f) === 3);
  // eigenes Abzeichen je Erfolg, gestaffelt nach Seltenheit (js/sammlung-kunst.js); der Stern bleibt nur Rueckfall
  const gruppe = (id) => S('gruppe.' + (/^welt-/.test(id) ? 'welten' : /^liga-/.test(id) ? 'liga' : /^serie-/.test(id) ? 'serie' : /^level-/.test(id) ? 'level'
    : /^(siege-|schwarz-|siegesserie-|endgegner|alle-endgegner)/.test(id) ? 'partien' : /^schule-/.test(id) ? 'schule' : 'meilensteine'));
  const erfolg = (id, frei, name, weg, fortschritt, labor = false) => ({ id: 'erfolg-' + id, name, frei, zeile: frei ? S('geschafft') : weg,
    bild: erfolgKunst(id) || sternBild, seltenheit: erfolgSeltenheit(id), fortschritt, gruppe: gruppe(id), ...(labor ? { labor: true } : {}) });
  const aus = [
    erfolg('erster-sieg', n > 0, S('erfolg.ersterSieg'), S('erfolg.ersterSiegWeg')),
    erfolg('drei-sterne', dreiSterne, S('erfolg.dreiSterne'), S('erfolg.dreiSterneWeg')),
    erfolg('alle-bots', n === BOTS.length, S('erfolg.alleBots'), S('erfolg.alleBotsWeg', { n, alle: BOTS.length }), n / BOTS.length),
    erfolg('alle-sterne', sterne === BOTS.length * 3, S('erfolg.alleSterne'), S('erfolg.alleSterneWeg', { n: sterne, alle: BOTS.length * 3 }), sterne / (BOTS.length * 3)),
  ];
  for (const w of WELTEN) {
    const bots = BOTS.filter((b) => b.welt === w.nr);
    const k = bots.filter(besiegt).length;
    aus.push(erfolg('welt-' + w.nr, bots.length > 0 && k === bots.length, S('erfolg.welt', { name: w.name }),
      S('erfolg.weltWeg', { n: k, alle: bots.length }), bots.length ? k / bots.length : 0));
  }
  // Alte Saison-Liga (Flo 08.11.2026, eine Liga): wer eine Stufe erreicht hat, behaelt den Erfolg; alle anderen sehen
  // ihn nicht mehr, weil er nicht mehr zu erspielen ist (die Kronen-Liga zaehlt in der Familie liga, ./stufen.js)
  for (let s = 1; s <= LIGA_STUFEN; s++) {
    if (z.ligaBest >= s) aus.push(erfolg('liga-' + s, z.ligaBest >= s, S('erfolg.liga', { stufe: S('liga.' + s) }), S('erfolg.ligaWeg', { stufe: S('liga.' + s) })));
  }
  for (const n of SERIE_ZIELE) {
    aus.push(erfolg('serie-' + n, z.serieBest >= n, S('erfolg.serie', { n }), S('erfolg.serieWeg', { n: Math.min(z.serieBest, n), alle: n }),
      Math.min(1, z.serieBest / n)));
  }
  for (const n of LEVEL_ZIELE) {
    aus.push(erfolg('level-' + n, z.level >= n, S('erfolg.level', { n }), S('erfolg.levelWeg', { n: Math.min(z.level, n), alle: n }),
      Math.min(1, z.level / n)));
  }
  // Partien (Flo 01.11.2026: neue Errungenschaften): Siege aus dem Zaehler je Bot (bleibt immer), Schwarz und Folge aus
  // dem Archiv (gemerkt), Endgegner aus dem Fortschritt
  const siege = BOTS.reduce((a, b) => a + (Number(f.bots[b.id] && f.bots[b.id].siege) || 0), 0);
  for (const n of SIEGE_ZIELE) {
    aus.push(erfolg('siege-' + n, siege >= n, S('erfolg.siege', { n }), S('erfolg.siegeWeg', { n: Math.min(siege, n), alle: n }), Math.min(1, siege / n)));
  }
  const pf = (pa && Array.isArray(pa.frei)) ? pa.frei : [];
  aus.push(erfolg('schwarz-sieg', pf.includes('schwarz-sieg'), S('erfolg.schwarzSieg'), S('erfolg.schwarzSiegWeg')));
  const folge = Math.min(Number(pa && pa.beste) || 0, SIEGESSERIE);
  const serieFrei = pf.includes('siegesserie-' + SIEGESSERIE);
  aus.push(erfolg('siegesserie-' + SIEGESSERIE, serieFrei, S('erfolg.siegesserie', { alle: SIEGESSERIE }),
    S('erfolg.siegesserieWeg', { n: folge, alle: SIEGESSERIE }), serieFrei ? 1 : folge / SIEGESSERIE));
  const bosse = BOTS.filter((b) => b.endgegner);
  const bossK = bosse.filter(besiegt).length;
  aus.push(erfolg('endgegner', bossK > 0, S('erfolg.endgegner'), S('erfolg.endgegnerWeg')));
  aus.push(erfolg('alle-endgegner', bosse.length > 0 && bossK === bosse.length, S('erfolg.alleEndgegner'),
    S('erfolg.alleEndgegnerWeg', { n: bossK, alle: bosse.length }), bosse.length ? bossK / bosse.length : 0));
  // Meisterschule: nur im Labor (schule null = nicht sichtbar)
  if (schule) {
    const name = { matt: 'schuleMatt', taktik: 'schuleTaktik', end: 'schuleEnd', eroeffnung: 'schuleEroeffnung' };
    for (const b of schule.bereiche) {
      if (!name[b.id] || !b.alle) continue;
      aus.push(erfolg('schule-' + b.id, b.geschafft >= b.alle, S('erfolg.' + name[b.id]), S('erfolg.schuleBereichWeg', { n: b.geschafft, alle: b.alle }),
        b.geschafft / b.alle, true));
    }
    const g = schule.gesamt;
    aus.push(erfolg('schule-alle', g.alle > 0 && g.geschafft >= g.alle, S('erfolg.schuleAlle'), S('erfolg.schuleAlleWeg', { n: g.geschafft, alle: g.alle }),
      g.alle ? g.geschafft / g.alle : 0, true));
    aus.push(erfolg('schule-sterne', g.max > 0 && g.sterne >= g.max, S('erfolg.schuleSterne'), S('erfolg.schuleSterneWeg', { n: g.sterne, alle: g.max }),
      g.max ? g.sterne / g.max : 0, true));
  }
  return aus;
}

// Etappe 4b: der Stand, aus dem die Erfolgs-Familien ihre Stufen lesen (js/pakete/sammlung/stufen.js); dieselben Quellen
// wie teileErfolge, dazu der Raetsel-Zaehler (js/besitz.js) und die Kronen-Stufe des letzten Server-Stands
export function stufenStand(f = ladeFortschritt(), z = spielstand(), pa = partienStand()) {
  const besiegt = (b) => !!(f.bots[b.id] && f.bots[b.id].sterne[0]);
  const bosse = BOTS.filter((b) => b.endgegner);
  let raetsel = 0;
  try { raetsel = ladeBesitz().raetsel.n; } catch (e) { raetsel = 0; }
  let ligaStufe = -1;
  try {
    const k = kronenSpeicher(ladeModul('kronen', {}));
    // Wochen-Gruppen: die Stufe steht im Stand (stand.kronen sind nur die Kronen dieser Woche)
    if (k.stand && Number.isInteger(k.stand.stufe)) ligaStufe = stufeInfo(k.stand.stufe).index;
  } catch (e) { ligaStufe = -1; }
  return {
    // jeder besiegte Bot (Stern) ist mindestens ein Sieg, auch in Spielstaenden ohne Siegzaehler
    siege: Math.max(besiegteBots(f), BOTS.reduce((a, b) => a + (Number(f.bots[b.id] && f.bots[b.id].siege) || 0), 0)),
    besiegt: besiegteBots(f), botsAlle: BOTS.length,
    welten: WELTEN.filter((w) => { const bs = BOTS.filter((b) => b.welt === w.nr); return bs.length > 0 && bs.every(besiegt); }).length,
    weltenAlle: WELTEN.length,
    sterne: gesamtSterne(f), sterneAlle: BOTS.length * 3,
    endgegner: bosse.filter(besiegt).length, endgegnerAlle: bosse.length,
    siegesfolge: Number(pa && pa.beste) || 0, raetsel, serie: z.serieBest, level: z.level, ligaStufe,
  };
}

// Bild je Familie und Stufe: ein Abzeichen ihrer alten Erfolge (js/sammlung-kunst.js), Bronze das leichteste, Gold das
// schwerste (sonst traegt Bronze schon die "100"); Ring in der Stufenfarbe (CSS)
const familienBild = (fam, stufe = 3) => {
  const f = FAMILIEN.find((x) => x.id === fam);
  const n = f ? f.alt.length : 0;
  const alt = n ? f.alt[Math.round((Math.max(1, Math.min(3, stufe)) - 1) * (n - 1) / 2)] : '';
  return erfolgKunst(alt) || sternBild;
};
const K = (k, w) => t('p-karte.' + k, w);
const SELTEN = ['frei', 'selten', 'episch', 'legende'];

// Teile des Bereichs Erfolge: je Familie eins, mit Stufe und Zeile bis zur naechsten Stufe
export function teileErfolgsStufen(stand = stufenStand(), gemerkt = ladeBesitz().stufen) {
  return familienStand(stand, gemerkt).map((x) => {
    const n = Math.min(x.wert, x.naechstes ?? x.wert);
    const zeile = x.stufe === 3 ? K('zeile.gold') : x.familie === 'liga' && x.stufe === 0 ? K('zeile.liga') : x.stufe === 0
      ? K('zeile.start', { n, ziel: x.naechstes, was: K('was.' + x.familie) })
      : K('zeile.weiter', { stufe: K('stufe.' + x.stufe), n, ziel: x.naechstes, naechste: K('stufe.' + (x.stufe + 1)) });
    const vorher = x.stufe > 0 ? x.ziele[x.stufe - 1] : 0;
    return { id: 'stufe-' + x.familie, familie: x.familie, stufe: x.stufe, name: K('fam.' + x.familie), frei: x.stufe > 0,
      zeile, bild: familienBild(x.familie, x.stufe), seltenheit: SELTEN[x.stufe], gruppe: S('gruppe.' + x.gruppe),
      fortschritt: x.naechstes && x.familie !== 'liga' ? Math.max(0, Math.min(1, (x.wert - vorher) / Math.max(1, x.naechstes - vorher))) : undefined };
  });
}

// Name und Abzeichen einer Familie fuer die Karte eines anderen Spielers (seine Stufe kommt vom Server)
export function familienOrden(familie, stufe = 3) {
  if (!FAMILIEN.some((x) => x.id === familie)) return null;
  return { name: K('fam.' + familie), bild: familienBild(familie, stufe) };
}

// Freischalt-Moment (Konzept 5b): neue Stufen nach einer Partie, einem Raetsel und beim Start sofort buchen; gezeigt
// werden sie im Reiter "Ich" (sofort, wenn er offen ist). Der Moment ist ein Dialog und legt sich so nie ungefragt
// ueber Ergebnis, Analyse oder Partie (dort wuerde er Knoepfe wie "Als Bild teilen" verdecken).
// Mit Konto meldet js/karte.js danach Stufen und Karte an den Server (beim Start immer, sonst nur bei neuen Stufen);
// ohne Konto kehrt der Abgleich dort sofort zurueck.
let wartend = [];
function pruefeStufen({ start = false } = {}) {
  let neu = [];
  try { neu = abgleichen(stufenStand()); } catch (e) { neu = []; }
  wartend.push(...neu);
  if (document.documentElement.dataset.screen === 'ich') zeigeWartende();
  if (start || neu.length) karteAbgleichen();
}
function zeigeWartende() {
  if (!wartend.length) return;
  const liste = wartend;
  wartend = [];
  zeigeStufen(liste);
}
export function karteAbgleichen() {
  let titel = null;
  try { titel = (titelJetzt() || {}).id || null; } catch (e) { titel = null; }
  return import('../../karte.js').then((k) => k.abgleichKonto({ titel })).catch(() => null);
}
if (typeof window !== 'undefined') {
  hoere('raetsel:geloest', (d) => { try { zaehleRaetsel(d); } catch (e) { /* ohne Speicher nicht gezaehlt */ } pruefeStufen(); });
  hoere('partie:beendet', () => pruefeStufen());
  hoere('app:bereit', () => pruefeStufen({ start: true }));
  hoere('app:screen', (d) => { if (d && d.name === 'ich') zeigeWartende(); });
}

freischalten();
anbieten('sammlung:bereich', ({ app }) => erfinderBereich({ app }), { reihenfolge: 5, paket: PAKET });
anbieten('sammlung:bereich', ({ app }) => bereich({ id: 'bretter', name: S('bretter'), teile: teileBretter(undefined, app) }), { reihenfolge: 40, paket: PAKET });
// Figurensaetze nur, wenn es mehr als einen gibt (Blaupause oder Labor), sonst gaebe es nichts zu waehlen
anbieten('sammlung:bereich', ({ app }) => {
  const teile = teileFiguren(undefined, app);
  return teile.length > 1 ? bereich({ id: 'figuren', name: S('figuren'), teile }) : null;
}, { reihenfolge: 45, paket: PAKET });
anbieten('sammlung:bereich', ({ app }) => bereich({ id: 'klaenge', name: S('klaenge'), teile: teileKlaenge(undefined, app) }), { reihenfolge: 50, paket: PAKET });
// Etappe 4b: jede Stufe zahlt Taler; der Stand steht als Hinweis ueber den Erfolgen (mit Konto der des Servers)
anbieten('sammlung:bereich', () => bereich({ id: 'erfolge', name: S('erfolge'), teile: teileErfolgsStufen(),
  hinweis: K('taler.stand', { n: talerJetzt() }) }), { reihenfolge: 90, paket: PAKET });
anbieten('sammlung:bereich', ({ app }) => shopBereich({ app }), { reihenfolge: 95, paket: PAKET });
