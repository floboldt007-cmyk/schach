// P4: Anbindung ausschliesslich ueber Ereignisse, Orte, Feier- und Icon-Register, Modul-Speicher.
// Keine Engine-Arbeit, kein Zugriff auf fremde Screen-Elemente. Fehler bleiben im Paket.
import { hoere, sende } from '../../ereignisse.js';
import { anbieten } from '../../orte.js';
import { melde } from '../../feier.js';
import { BOTS, botNachId } from '../../bots.js';
import { ladeModul, speichereModul, ladePartie, wertet, MODUL_BUDGET } from '../../storage.js';
import { registriereIcon } from '../../ui/icons.js';
import { t } from '../../sprache.js';
import './texte.js';
import {
  normalisiereStand, wechsleSaison, buchePartie, bucheGenauigkeit, belegFuer, imBudget, STUFEN,
} from './wertung.js';
import { saisonKarte, verlaufKarte, botBilanz, abrechnungsZeile } from './ansicht.js';
import { protokolliere } from '../../protokoll.js';

const MODUL = 'liga';
const laufend = new Map();
const LEITER = new Set(BOTS.map((b) => b.id));

function sicher(fn) {
  return (...args) => {
    try { return fn(...args); }
    catch (e) { console.error('Liga konnte nicht aktualisiert werden:', e); protokolliere('paket', e, { vorsatz: 'Paket liga' }); return null; }
  };
}

const lese = () => normalisiereStand(ladeModul(MODUL), new Date());

function geaendert(st, aufstieg = false) {
  // Empfaenger erhalten eigene Daten und koennen den gespeicherten Zustand nicht veraendern.
  const { wertung, klasse, saison } = JSON.parse(JSON.stringify(st));
  sende('liga:geaendert', { wertung, klasse, saison, stufe: STUFEN[saison.stufe].name, aufstieg });
}

function speichere(st) {
  const klein = imBudget(st, MODUL_BUDGET.liga);
  return speichereModul(MODUL, klein).ok;
}

function saisonPruefen() {
  if ([...laufend.values()].some((l) => !l.beendet)) return;
  const st = lese();
  if (!st) return;
  const r = wechsleSaison(st, new Date());
  if (r.wechsel && speichere(r.stand)) geaendert(r.stand);
}

function feiere(r, partieId) {
  for (const a of r.aufstieg) {
    const klasse = a.art === 'klasse';
    melde({
      partieId, quelle: klasse ? 'klasse' : 'liga-saison',
      titel: klasse ? t('p-liga.feier.klasse', { klasse: t('p-liga.klasse.' + a.stufe) }) : t('p-liga.feier.liga', { stufe: t('p-liga.stufe.' + a.stufe) }),
      text: klasse ? t('p-liga.feier.klasseText', { n: r.stand.wertung.n, wert: r.stand.wertung.wert })
        : t('p-liga.feier.ligaText', { nr: r.stand.saison.nr, punkte: r.stand.saison.punkte }),
      symbol: klasse ? 'bauer' : 'liga-wappen', klang: 'rekord',
    });
  }
}

function uebernehme(r, partieId) {
  if (!r.gebucht || !speichere(r.stand)) return;
  feiere(r, partieId);
  geaendert(r.stand, r.aufstieg.length > 0);
}

hoere('app:bereit', sicher(() => {
  laufend.clear();
  saisonPruefen();
}));
hoere('app:sichtbar', sicher(({ sichtbar }) => { if (sichtbar) saisonPruefen(); }));
hoere('app:screen', sicher(({ name }) => { if (name !== 'partie') saisonPruefen(); }));
hoere('partie:gestartet', sicher((d) => {
  laufend.set(d.laufId, { wertet: d.wertet === true, hinweise: d.hinweise || 0, beendet: false });
}));
hoere('hilfe:genutzt', sicher((d) => {
  const l = laufend.get(d.laufId);
  if (l && d.art === 'hinweis') l.hinweise++;
}));
hoere('partie:verlassen', sicher(({ laufId }) => { laufend.delete(laufId); }));
hoere('speicher:zurueckgesetzt', sicher(() => { laufend.clear(); }));

hoere('partie:beendet', sicher((d) => {
  const l = laufend.get(d.laufId);
  if (l) l.beendet = true;
  if (d.wertet !== true || (l && !l.wertet)) return;
  // Das Ende-Ereignis enthaelt kein tempo. Immer den gerade gespeicherten Datensatz lesen:
  // so bleiben Blitz und normale Wertung getrennt, auch nach dem Fortsetzen einer Partie.
  const p = ladePartie(d.partieId);
  if (!p || !wertet(p) || !LEITER.has(p.botId)) return;
  const bot = botNachId(p.botId), st = lese();
  if (!st) return;
  const partie = { ...p, hinweise: Math.max(p.hinweise || 0, d.hinweise || 0, l?.hinweise || 0) };
  uebernehme(buchePartie(st, partie, bot.elo, new Date()), p.id);
}));

hoere('partie:analysiert', sicher((d) => {
  if (d.wertet !== true) return;
  const st = lese(), p = ladePartie(d.partieId);
  // Nachholen einer alten Partie darf keine zweite Wertung und keine neue Saison-Partie erzeugen.
  if (!st || !p || !wertet(p) || !belegFuer(st, p.id)) return;
  const frisch = wechsleSaison(st, new Date()).stand;
  const genauigkeit = p.genauigkeitQuelle === 'analyse' && Number.isFinite(p.genauigkeit)
    ? p.genauigkeit : d.review?.genauigkeit?.[p.spielerFarbe];
  uebernehme(bucheGenauigkeit(frisch, p.id, genauigkeit), p.id);
}));

if (typeof document !== 'undefined') {
  sicher(() => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = new URL('../../../css/pakete/liga.css', import.meta.url).href;
    css.dataset.paket = MODUL;
    document.head.append(css);
    registriereIcon('liga-wappen', '<path d="M5 4h14v8c0 4-4 7-7 9-3-2-7-5-7-9z"/><path d="m8 9 4 3 4-3M8 14l4 3 4-3"/>');
  })();
  const kontext = { lese, bots: BOTS, saisonPruefen: sicher(saisonPruefen),
    verstanden: sicher(() => { const st = lese(); if (st) { delete st.wechsel; if (speichere(st)) geaendert(st); } }) };
  anbieten('arena:panel-oben', sicher(() => saisonKarte(kontext)), { reihenfolge: 30, paket: MODUL });
  anbieten('arena:panel-bot', sicher((k) => botBilanz(k)), { reihenfolge: 15, paket: MODUL });
  anbieten('ergebnis:abrechnung', sicher((k) => abrechnungsZeile(k, lese())), { reihenfolge: 30, paket: MODUL });
  anbieten('verlauf:seite', sicher(() => verlaufKarte(kontext)), { reihenfolge: 20, paket: MODUL });
}
