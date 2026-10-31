// Paket sammlung: der Reiter "Ich" mit der Sammlung (Screen js/ui/ich.js, Optik css/pakete/sammlung.css).
// Dieses Paket fuellt die Bereiche, die zum Kern gehoeren: Bretter und Klaenge (frei waehlbar in den Einstellungen) und
// Erfolge, die sich aus dem Spielstand ablesen lassen (keine eigene Buchfuehrung, nichts zum Kaufen). Finisher, Emotes
// und Titel bringen ihre Pakete selbst am Ort sammlung:bereich mit.
// Orte: ich:kopf Profil 10 und duell:profil? (profil.js); sammlung:bereich Erfinder 5 (nur mit Sonderstuecken, erfinder.js), Rahmen 35 (profil.js), Bretter 40, Klaenge 50, Erfolge 90, Shop 95 (Editionen, js/pakete/sammlung/shop.js)
import { anbieten, waehle } from '../../orte.js';
import { freischalten, bereich } from '../../ui/ich.js';
import { ladeEinstellungen, ladeFortschritt, gesamtSterne, besiegteBots, sterneZahl, ladeModul } from '../../storage.js';
import { BOTS, WELTEN } from '../../bots.js';
import { PAKETE_KLANG } from '../../sounds.js';
import { klangKunst, brettKunst, erfolgKunst, erfolgSeltenheit } from '../../sammlung-kunst.js';
import { t } from '../../sprache.js';
import { LABOR_BRETTER, LABOR_FIGUREN, LABOR_KLAENGE, laborFrei, brettWahl, klangWahl } from '../../labor.js';
import { figurenSatz } from '../../figurensatz.js';
import { hatSonderstueck, ERFINDER } from '../../sonderstuecke.js';
import { shopBereich } from './shop.js';
import { erfinderBereich } from './erfinder.js';
import './profil.js';
import './texte.js';

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

export function teileBretter(e = ladeEinstellungen(), app = null) {
  const an = brettWahl(e.brett);
  // Labor (Flo 31.10.2026): Kuerbis, Frost, Marmor, Nussbaum, Thron nur im Erfinder-Konto (js/labor.js)
  const liste = [...BRETTER, ...(laborFrei() ? LABOR_BRETTER.map((b) => [b.id, b.hell, b.dunkel, b.rand, true]) : [])];
  return liste.map(([id, h, d, r, labor]) => ({ id: 'brett-' + id, name: S('brett.' + id), frei: true, an: an === id, zeile: an === id ? S('an') : S('frei'),
    bild: brettKunst(h, d, r), labor: !!labor, wahl: wahlVon(app, { brett: id }) }));
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
  return { ligaBest: stufen.length ? Math.max(...stufen) : 0, serieBest: Number.isInteger(serie.best) ? serie.best : 0,
    level: Number.isInteger(funken.level) ? funken.level : 1 };
}
export const LIGA_STUFEN = 6;                       // Bronze bis Meister (Paket liga, STUFEN 1 bis 6)
export const SERIE_ZIELE = Object.freeze([7, 30, 100]);
export const LEVEL_ZIELE = Object.freeze([10, 20, 30]);

// Erfolge nur aus dem Spielstand: Sieg, drei Sterne, je Welt alle Bots, alle Bots, alle Sterne, dazu (Flo 30.10.,
// Profil mit Vitrine) Liga-Stufen, Serie und Level
export function teileErfolge(f = ladeFortschritt(), z = spielstand()) {
  const besiegt = (b) => !!(f.bots[b.id] && f.bots[b.id].sterne[0]);
  const n = besiegteBots(f);
  const sterne = gesamtSterne(f);
  const dreiSterne = BOTS.some((b) => sterneZahl(b.id, f) === 3);
  // eigenes Abzeichen je Erfolg, gestaffelt nach Seltenheit (js/sammlung-kunst.js); der Stern bleibt nur Rueckfall
  const gruppe = (id) => S('gruppe.' + (/^welt-/.test(id) ? 'welten' : /^liga-/.test(id) ? 'liga' : /^serie-/.test(id) ? 'serie' : /^level-/.test(id) ? 'level' : 'meilensteine'));
  const erfolg = (id, frei, name, weg, fortschritt) => ({ id: 'erfolg-' + id, name, frei, zeile: frei ? S('geschafft') : weg,
    bild: erfolgKunst(id) || sternBild, seltenheit: erfolgSeltenheit(id), fortschritt, gruppe: gruppe(id) });
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
  for (let s = 1; s <= LIGA_STUFEN; s++) {
    aus.push(erfolg('liga-' + s, z.ligaBest >= s, S('erfolg.liga', { stufe: S('liga.' + s) }), S('erfolg.ligaWeg', { stufe: S('liga.' + s) })));
  }
  for (const n of SERIE_ZIELE) {
    aus.push(erfolg('serie-' + n, z.serieBest >= n, S('erfolg.serie', { n }), S('erfolg.serieWeg', { n: Math.min(z.serieBest, n), alle: n }),
      Math.min(1, z.serieBest / n)));
  }
  for (const n of LEVEL_ZIELE) {
    aus.push(erfolg('level-' + n, z.level >= n, S('erfolg.level', { n }), S('erfolg.levelWeg', { n: Math.min(z.level, n), alle: n }),
      Math.min(1, z.level / n)));
  }
  return aus;
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
anbieten('sammlung:bereich', () => bereich({ id: 'erfolge', name: S('erfolge'), teile: teileErfolge() }), { reihenfolge: 90, paket: PAKET });
anbieten('sammlung:bereich', ({ app }) => shopBereich({ app }), { reihenfolge: 95, paket: PAKET });
