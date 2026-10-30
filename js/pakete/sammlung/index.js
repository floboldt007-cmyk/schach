// Paket sammlung: der Reiter "Ich" mit der Sammlung (Screen js/ui/ich.js, Optik css/pakete/sammlung.css).
// Dieses Paket fuellt die Bereiche, die zum Kern gehoeren: Bretter und Klaenge (frei waehlbar in den Einstellungen) und
// Erfolge, die sich aus dem Spielstand ablesen lassen (keine eigene Buchfuehrung, nichts zum Kaufen). Finisher, Emotes
// und Titel bringen ihre Pakete selbst am Ort sammlung:bereich mit.
// Orte: sammlung:bereich Erfinder 5 (nur mit Sonderstuecken, erfinder.js), Bretter 40, Klaenge 50, Erfolge 90, Shop 95 (Editionen, js/pakete/sammlung/shop.js)
import { anbieten } from '../../orte.js';
import { freischalten, bereich } from '../../ui/ich.js';
import { ladeEinstellungen, ladeFortschritt, gesamtSterne, besiegteBots, sterneZahl } from '../../storage.js';
import { BOTS, WELTEN } from '../../bots.js';
import { PAKETE_KLANG } from '../../sounds.js';
import { t } from '../../sprache.js';
import { shopBereich } from './shop.js';
import { erfinderBereich } from './erfinder.js';
import './texte.js';

const PAKET = 'sammlung';
const S = (k, w) => t('p-sammlung.' + k, w);
// Farben wie die Brettwahl in js/ui/partie.js (BRETTER): hell, dunkel
const BRETTER = Object.freeze([['nacht', '#e4e8f6', '#7c87b6'], ['gruen', '#eeeed2', '#769656'], ['holz', '#f0d9b5', '#b58863']]);

if (typeof document !== 'undefined' && !document.querySelector('link[data-paket="sammlung"]')) {
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.dataset.paket = PAKET;
  css.href = new URL('../../../css/pakete/sammlung.css', import.meta.url).href;
  document.head.appendChild(css);
}

const brettBild = (h, d) => `<svg viewBox="0 0 4 4" class="sa-brett"><path fill="${h}" d="M0 0h4v4H0z"/><path fill="${d}" d="M1 0h1v1H1zM3 0h1v1H3zM0 1h1v1H0zM2 1h1v1H2zM1 2h1v1H1zM3 2h1v1H3zM0 3h1v1H0zM2 3h1v1H2z"/></svg>`;
const klangBild = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11"/></svg>';
const sternBild = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z"/></svg>';

export function teileBretter(e = ladeEinstellungen()) {
  return BRETTER.map(([id, h, d]) => ({ id: 'brett-' + id, name: S('brett.' + id), frei: true, an: e.brett === id, zeile: e.brett === id ? S('an') : S('frei'), bild: brettBild(h, d) }));
}

export function teileKlaenge(e = ladeEinstellungen()) {
  // '' heisst: Standard der Ansicht (heute Arcade, js/sounds.js)
  const gewaehlt = PAKETE_KLANG[e.klangpaket] ? e.klangpaket : 'arcade';
  return Object.keys(PAKETE_KLANG).map((id) => ({ id: 'klang-' + id, name: S('klang.' + id), frei: true, an: gewaehlt === id, zeile: gewaehlt === id ? S('an') : S('frei'), bild: klangBild }));
}

// Erfolge nur aus dem Spielstand: Sieg, drei Sterne, je Welt alle Bots, alle Bots, alle Sterne
export function teileErfolge(f = ladeFortschritt()) {
  const besiegt = (b) => !!(f.bots[b.id] && f.bots[b.id].sterne[0]);
  const n = besiegteBots(f);
  const sterne = gesamtSterne(f);
  const dreiSterne = BOTS.some((b) => sterneZahl(b.id, f) === 3);
  const erfolg = (id, frei, name, weg, fortschritt) => ({ id: 'erfolg-' + id, name, frei, zeile: frei ? S('geschafft') : weg, bild: sternBild, fortschritt });
  const aus = [
    erfolg('erster-sieg', n > 0, S('erfolg.ersterSieg'), S('erfolg.ersterSiegWeg')),
    erfolg('drei-sterne', dreiSterne, S('erfolg.dreiSterne'), S('erfolg.dreiSterneWeg')),
  ];
  for (const w of WELTEN) {
    const bots = BOTS.filter((b) => b.welt === w.nr);
    const k = bots.filter(besiegt).length;
    aus.push(erfolg('welt-' + w.nr, bots.length > 0 && k === bots.length, S('erfolg.welt', { name: w.name }),
      S('erfolg.weltWeg', { n: k, alle: bots.length }), bots.length ? k / bots.length : 0));
  }
  aus.push(erfolg('alle-bots', n === BOTS.length, S('erfolg.alleBots'), S('erfolg.alleBotsWeg', { n, alle: BOTS.length }), n / BOTS.length));
  aus.push(erfolg('alle-sterne', sterne === BOTS.length * 3, S('erfolg.alleSterne'), S('erfolg.alleSterneWeg', { n: sterne, alle: BOTS.length * 3 }), sterne / (BOTS.length * 3)));
  return aus;
}

freischalten();
anbieten('sammlung:bereich', ({ app }) => erfinderBereich({ app }), { reihenfolge: 5, paket: PAKET });
anbieten('sammlung:bereich', () => bereich({ id: 'bretter', name: S('bretter'), teile: teileBretter() }), { reihenfolge: 40, paket: PAKET });
anbieten('sammlung:bereich', () => bereich({ id: 'klaenge', name: S('klaenge'), teile: teileKlaenge() }), { reihenfolge: 50, paket: PAKET });
anbieten('sammlung:bereich', () => bereich({ id: 'erfolge', name: S('erfolge'), teile: teileErfolge() }), { reihenfolge: 90, paket: PAKET });
anbieten('sammlung:bereich', ({ app }) => shopBereich({ app }), { reihenfolge: 95, paket: PAKET });
