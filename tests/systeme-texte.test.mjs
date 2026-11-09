// Spielsysteme ohne Widerspruch (G-002 AC-03, Pruefung U 09.11.2026): Die Regel- und Hilfetexte von Funken, Raetsel-Duell
// und Liga mit Kronen nennen in Deutsch UND Englisch dieselben Zahlen wie der Code, und die Waehrung Taler heisst in jeder
// Sprache ueberall gleich. Aendert jemand eine Konstante (z. B. Funken je Sieg) und vergisst den Text, wird dieser Test rot.
// Nur Node, ohne Browser.
//   node tests/systeme-texte.test.mjs
import * as S from '../js/sprache.js';
import * as F from '../js/pakete/funken/rechnung.js';
import { ERSTE_KARTE_TAG } from '../js/pakete/funken/stand.js';
import { KONST as DUELL } from '../js/pakete/lobby/raetsel-duell.js';
import * as K from '../js/pakete/liga/kronen.js';
import { DE as LIGA_DE, EN as LIGA_EN } from '../js/pakete/liga/texte.js';
import '../js/pakete/funken/texte.js';
import '../js/pakete/lobby/raetsel-duell-texte.js';
import '../js/pakete/sammlung/karte-texte.js';
import '../js/pakete/punkte/texte.js';

let ok = 0;
let gesamt = 0;
function pruefe(name, bedingung, info) {
  gesamt++;
  if (bedingung) { ok++; console.log('ok     ' + name); } else console.log('FEHLER ' + name + (info !== undefined ? '  -> ' + (typeof info === 'string' ? info : JSON.stringify(info)) : ''));
}
// Zahl so, wie sie im Text steht (1.000 / 1,000, 1,5 / 1.5); fehlende Zahlen zurueck
const form = (n, sp) => {
  const s = String(n);
  if (Number.isInteger(n) && n >= 1000) return sp === 'de' ? s.replace(/\B(?=(\d{3})+$)/g, '.') : s.replace(/\B(?=(\d{3})+$)/g, ',');
  return sp === 'de' ? s.replace('.', ',') : s;
};
const fehlend = (text, zahlen, sp) => zahlen.filter((n) => !new RegExp(`(^|[^0-9.,])${form(n, sp).replace(/[.,]/g, '\\$&')}(?![0-9]|[.,][0-9])`).test(text));
function inBeidenSprachen(fn) {
  for (const sp of ['de', 'en']) { S.setzeSprache(sp); fn(sp); }
  S.setzeSprache('de');
}

// ---------- Funken (p-funken.regeln.*) ----------
inBeidenSprachen((sp) => {
  const tx = (k) => S.t('p-funken.regeln.' + k);
  const z = F.ZUG_FUNKEN;
  pruefe(`${sp}: Funken je Zug, Deckel und Theorie wie rechnung.js`, !fehlend(tx('zuege'),
    [z.brillant, z.stark, z.bester, z.exzellent, z.gut, z.ungenau, F.DECKEL_OFFEN, F.THEORIE_FUNKEN, F.THEORIE_MAX, F.OFFEN_VON * 100, F.OFFEN_BIS * 100], sp).length,
  fehlend(tx('zuege'), [z.brillant, z.stark, z.bester, z.exzellent, z.gut, z.ungenau, F.DECKEL_OFFEN, F.THEORIE_FUNKEN, F.THEORIE_MAX, F.OFFEN_VON * 100, F.OFFEN_BIS * 100], sp));
  const erg = [F.ERGEBNIS_FUNKEN.sieg, F.ERGEBNIS_FUNKEN.remis, F.ERGEBNIS_FUNKEN.niederlage, F.KAMPFGEIST_ZUEGE, F.MIN_ZUEGE, F.VERWERTUNG_MAX, F.LICHTBLICK_FUNKEN, F.LICHTBLICK_MAX];
  pruefe(`${sp}: Funken je Ergebnis wie rechnung.js`, !fehlend(tx('ergebnis'), erg, sp).length, fehlend(tx('ergebnis'), erg, sp));
  const fak = [...F.FAKTOREN.map((f) => f[1]), F.FAKTOR_AB_PARTIE];
  pruefe(`${sp}: Herausforderungs-Faktoren wie rechnung.js`, !fehlend(tx('faktor'), fak, sp).length, fehlend(tx('faktor'), fak, sp));
  pruefe(`${sp}: Rueckenwind (erste Karte, Einheiten, Fach) wie Code`, !fehlend(tx('rw'), [ERSTE_KARTE_TAG, F.RUECKENWIND_EINHEITEN, F.KARTEN_MAX], sp).length,
    fehlend(tx('rw'), [ERSTE_KARTE_TAG, F.RUECKENWIND_EINHEITEN, F.KARTEN_MAX], sp));
  pruefe(`${sp}: Tagesbogen wie rechnung.js`, !fehlend(tx('bogen'), [F.TAGESBOGEN], sp).length, tx('bogen'));
  const lern = [F.LERN.uebungGetroffen, F.LERN.uebungDaneben, F.LERN.moment, F.LERN.momenteMax, F.LERN.karte1, F.LERN.karte2, F.LERN.kartenTag, F.LERN.lektion,
    F.MEILENSTEIN.stern, F.MEILENSTEIN.ersterSieg, F.MEILENSTEIN.siegel.bronze, F.MEILENSTEIN.siegel.gold, F.MEILENSTEIN.stockfisch];
  pruefe(`${sp}: Lernen und Meilensteine wie rechnung.js`, !fehlend(tx('lernen'), lern, sp).length, fehlend(tx('lernen'), lern, sp));
});

// ---------- Raetsel-Duell (p-duell.*) ----------
const MINUTEN = { de: ['', 'Eine', 'Zwei', 'Drei', 'Vier', 'Fünf'], en: ['', 'One', 'Two', 'Three', 'Four', 'Five'] };
inBeidenSprachen((sp) => {
  const r2 = S.t('p-duell.regeln.2');
  pruefe(`${sp}: Duell-Regel nennt Dauer (${DUELL.DAUER_S / 60} min) und Abzug (${DUELL.STRAFE_S} s) wie KONST`,
    r2.includes(MINUTEN[sp][DUELL.DAUER_S / 60]) && !fehlend(r2, [DUELL.STRAFE_S], sp).length, r2);
  for (const k of ['gewertet.text', 'suche.text']) {
    pruefe(`${sp}: Duell ${k} nennt den KI-Ersatz nach ${DUELL.KI_WARTE_S} s`, !fehlend(S.t('p-duell.' + k), [DUELL.KI_WARTE_S], sp).length, S.t('p-duell.' + k));
  }
});

// ---------- Liga mit Kronen (p-liga.gruppe.*) ----------
const letzterLohn = K.BELOHNUNG[K.BELOHNUNG.length - 1].bis;
for (const [sp, tx] of [['de', LIGA_DE], ['en', LIGA_EN]]) {
  pruefe(`${sp}: "ohne Belohnung ab Platz" = letzter belohnter Platz + 1 (${letzterLohn + 1})`, !fehlend(tx['gruppe.keine'], [letzterLohn + 1], sp).length, tx['gruppe.keine']);
  pruefe(`${sp}: Liga erklaert, wie Kronen zaehlen (Titel und Regeln vorhanden)`, !!(tx['gruppe.regeln.titel'] && tx['gruppe.regeln.kronen'] && tx['gruppe.regeln.woche']),
    Object.keys(tx).filter((k) => k.startsWith('gruppe.regeln')));
}
inBeidenSprachen((sp) => {
  const kr = S.t('p-liga.gruppe.regeln.kronen', K.kronenRegelWerte ? K.kronenRegelWerte() : {});
  const zahlen = [...new Set(['online', 'ki', 'bot'].flatMap((a) => [K.KRONEN[a].sieg, K.KRONEN[a].remis, Math.abs(K.KRONEN[a].niederlage)]))].filter((n) => n !== 0);
  pruefe(`${sp}: Kronen-Regel nennt alle Werte aus KRONEN (online, KI, Bot)`, !fehlend(kr, zahlen, sp).length && !/\{/.test(kr), kr);
  pruefe(`${sp}: Duell zaehlt wie online und KI (KRONEN.duell, duell_ki)`, JSON.stringify(K.KRONEN.duell) === JSON.stringify(K.KRONEN.online)
    && JSON.stringify(K.KRONEN.duell_ki) === JSON.stringify(K.KRONEN.ki));
  const wo = S.t('p-liga.gruppe.regeln.woche', K.kronenRegelWerte ? K.kronenRegelWerte() : {});
  pruefe(`${sp}: Wochen-Regel nennt Gruppe, Aufstieg, eine Stufe tiefer, Belohnung und Tagesgrenzen wie kronen.js`,
    !fehlend(wo, [K.GRUPPE_GROESSE, K.AUFSTIEG_PLAETZE, K.ABSTIEG_PLAETZE, letzterLohn, K.BOT_TAGESGRENZE, K.KI_TAGESGRENZE, K.BOT_KI_WOCHEN_MAX], sp).length && !/\{/.test(wo), wo);
  const ohne = S.t('p-punkte.ich.kronenOhne');
  pruefe(`${sp}: "Kronen ohne Konto" nennt die Gruppengroesse ${K.GRUPPE_GROESSE}`, !fehlend(ohne, [K.GRUPPE_GROESSE], sp).length, ohne);
});

// ---------- Taler: ein Wort je Sprache ----------
{
  S.setzeSprache('en');
  const en = [S.t('p-liga.gruppe.taler', { n: 5 }), S.t('p-liga.gruppe.talerText', { n: 5 }), S.t('p-karte.lohn.taler', { n: 5 }), S.t('p-karte.taler.stand', { n: 5 })];
  pruefe('en: Taler heisst ueberall "thalers" (Liga-Belohnung, Visitenkarte)', en.every((x) => /thalers/.test(x) && !/coin/i.test(x)), en);
  S.setzeSprache('de');
  const de = [S.t('p-liga.gruppe.taler', { n: 5 }), S.t('p-liga.gruppe.talerText', { n: 5 }), S.t('p-karte.lohn.taler', { n: 5 }), S.t('p-karte.taler.stand', { n: 5 })];
  pruefe('de: Taler heisst ueberall "Taler"', de.every((x) => /Taler/.test(x)), de);
}

// Gegenprobe: der Pruefer erkennt eine fehlende Zahl wirklich
pruefe('Gegenprobe: fehlend() findet eine Zahl, die nicht im Text steht', fehlend('Sieg 40 · Remis 25', [40, 26], 'de').join() === '26'
  && fehlend('bis 1.000 Funken', [1000], 'de').length === 0 && fehlend('× 1,25', [1.25], 'de').length === 0 && fehlend('x 12', [1], 'de').join() === '1');

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
