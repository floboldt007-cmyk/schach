// Screen "heim" (Etappe A, Task 3; Konzept 2026-11-06, Startseite Variante A, Entwurf startseite-v4): die ruhige
// Startseite. Oben Name und Level, in der Mitte der Rang-Ring mit den Liga-Punkten der laufenden Saison (Fortschritt
// bis zur naechsten Stufe aus STUFEN), darunter "<Stufe>, noch <n> bis <naechste>", dann drei Modus-Karten:
// Online spielen (gold, Hauptknopf), Bots besiegen, Raetsel. Die Zeile fuer kommende Shop-Hinweise steht schon im
// DOM, bleibt in dieser Etappe aber ausgeblendet. Premium-Krone im Kopf (js/ui/seite.js hauptKopf).
//
//   zeige(root, params, app) -> { verlasse() }
//   zeigeHeim(app) -> section   baut nur den Screen (ohne einzuhaengen), fuer zeige() und Tests
//
// Liga-Punkte: Modul-Speicher liga, gelesen wie im Paket liga (normalisiereStand), nur lesend. Fehlt der Stand oder
// stammt er aus einem anderen Rechenstand, gelten Holz und 0 (nie NaN). Die Stufe ist die geschuetzte saison.stufe.
// Ziele: heim-online -> lobby (wenn freigeschaltet, js/labor.js laborFrei) sonst online (Link-Duell);
// heim-bots -> arena; heim-raetsel -> training (das vorhandene Raetsel-Training).
// DOM: section.screen.heim-screen > header.haupt-kopf, .heim-rumpf > .heim-ring[data-anteil] (svg mit .heim-spur und
// .heim-bogen, .heim-mitte > .heim-zahl + .heim-einheit), p.heim-liga, .heim-modi > button.heim-modus[data-aktion]
// (die erste mit .haupt), .heim-shop[hidden]. Optik: css/heim.css, nur Tokens.
import { hauptKopf, verbindeKopf, kopfEintritt } from './seite.js';
import { icon } from './icons.js';
import { staffel, tempo } from '../bewegung.js';
import { ladeModul } from '../storage.js';
import { laborFrei } from '../labor.js';
import { BOTS } from '../bots.js';
import { meinName } from '../konto.js';
import { normalisiereStand, ligaStufe, STUFEN } from '../pakete/liga/wertung.js';
import { t, zahl, registriereTexte } from '../sprache.js';
import '../pakete/liga/texte.js';
import '../sprachen/allgemein.js';
import '../sprachen/rahmen.js';

registriereTexte('heim', {
  de: {
    aria: 'Start',
    level: 'Level {level}',
    einheit: 'Liga-Punkte',
    noch: '{stufe}, noch {n} bis {naechste}',
    oben: '{stufe}, höchste Stufe',
    ringLabel: '{punkte} Liga-Punkte, Stufe {stufe}',
    'online.titel': 'Online spielen',
    'online.text': 'Gegner in deiner Stärke, zählt für die Liga',
    'bots.titel': 'Bots besiegen',
    'bots.text': '{n} Gegner, jeder spielt anders',
    'raetsel.titel': 'Lernen',
    'raetsel.text': 'Rätsel und Meisterschule, in Ruhe gelöst',
  },
  en: {
    aria: 'Home',
    level: 'Level {level}',
    einheit: 'League points',
    noch: '{stufe}, {n} to {naechste}',
    oben: '{stufe}, top tier',
    ringLabel: '{punkte} league points, tier {stufe}',
    'online.titel': 'Play online',
    'online.text': 'Opponents at your level, counts for the league',
    'bots.titel': 'Beat the bots',
    'bots.text': '{n} opponents, each plays differently',
    'raetsel.titel': 'Learn',
    'raetsel.text': 'Puzzles and master school, at your own pace',
  },
});

const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const R = 84;
const UMFANG = 2 * Math.PI * R;
const KARTEN = [['online', 'krone', true], ['bots', 'pokal', false], ['raetsel', 'ziel', false]];

// Punkte und Stufe der laufenden Saison; jeder Fehler ergibt Holz und 0
export function ligaLage() {
  let punkte = 0, stufe = 0;
  try {
    const st = normalisiereStand(ladeModul('liga'), new Date());
    if (st && st.saison) {
      punkte = Number.isFinite(st.saison.punkte) && st.saison.punkte > 0 ? Math.floor(st.saison.punkte) : 0;
      stufe = Number.isInteger(st.saison.stufe) ? Math.min(STUFEN.length - 1, Math.max(0, st.saison.stufe)) : 0;
    }
  } catch (e) { console.error(e); }
  stufe = Math.max(stufe, ligaStufe(punkte));
  const naechste = STUFEN[stufe + 1] || null;
  const von = STUFEN[stufe].schwelle;
  const anteil = naechste ? Math.min(1, Math.max(0, (punkte - von) / (naechste.schwelle - von))) : 1;
  return { punkte, stufe, naechste: naechste ? stufe + 1 : null, fehlt: naechste ? Math.max(0, naechste.schwelle - punkte) : 0, anteil };
}

function aktuellesLevel() {
  try {
    const st = ladeModul('funken', {});
    return Number.isInteger(st && st.level) ? Math.max(1, st.level) : 1;
  } catch (e) { return 1; }
}

const stufenName = (i) => t('p-liga.stufe.' + i);

export function zeigeHeim(app) {
  const lg = ligaLage();
  const name = stufenName(lg.stufe);
  const zeile = lg.naechste == null
    ? t('heim.oben', { stufe: '\u0000' })
    : t('heim.noch', { stufe: '\u0000', n: zahl(lg.fehlt), naechste: stufenName(lg.naechste) });
  // Stufen-Name fett: Platzhalter erst nach dem Maskieren ersetzen
  const ligaHtml = esc(zeile).replace('\u0000', `<b>${esc(name)}</b>`);
  const s = document.createElement('section');
  s.className = 'screen heim-screen';
  s.setAttribute('aria-label', t('heim.aria'));
  // Name und Level stehen im Rumpf: der Hauptseiten-Kopf blendet seinen Titel auf dem Handy aus (css/navigation.css)
  s.innerHTML = `${hauptKopf({ titelElement: 'div', premium: true, klang: false })}
    <div class="heim-rumpf">
      <div class="heim-wer"><h1 class="heim-name">${esc(meinName())}</h1><span class="heim-level">${esc(t('heim.level', { level: zahl(aktuellesLevel()) }))}</span></div>
      <div class="heim-ring" role="img" data-anteil="${lg.anteil}" aria-label="${esc(t('heim.ringLabel', { punkte: zahl(lg.punkte), stufe: name }))}">
        <svg viewBox="0 0 188 188" aria-hidden="true" focusable="false">
          <circle class="heim-spur" cx="94" cy="94" r="${R}"/>
          <circle class="heim-bogen" cx="94" cy="94" r="${R}" stroke-dasharray="${UMFANG.toFixed(2)}"
            stroke-dashoffset="${(UMFANG * (1 - lg.anteil)).toFixed(2)}" transform="rotate(-90 94 94)"/>
        </svg>
        <div class="heim-mitte" aria-hidden="true"><span class="heim-zahl">${esc(zahl(lg.punkte))}</span><span class="heim-einheit">${esc(t('heim.einheit'))}</span></div>
      </div>
      <p class="heim-liga">${ligaHtml}</p>
      <div class="heim-modi">
        ${KARTEN.map(([id, ic, haupt]) => `<button class="heim-modus dr${haupt ? ' haupt' : ''}" type="button" data-aktion="heim-${id}">
          <span class="heim-symbol" aria-hidden="true">${icon(ic)}</span>
          <span class="heim-text"><b>${esc(t('heim.' + id + '.titel'))}</b><span>${esc(t('heim.' + id + '.text', { n: zahl(BOTS.length) }))}</span></span>
        </button>`).join('')}
      </div>
      <div class="heim-shop" hidden></div>
    </div>`;
  s.querySelector('.heim-modi').addEventListener('click', (e) => {
    const k = e.target.closest('[data-aktion]');
    if (!k) return;
    const a = k.dataset.aktion;
    if (a === 'heim-online') app.gehe(laborFrei() ? 'lobby' : 'online');
    else if (a === 'heim-bots') app.gehe('arena');
    else if (a === 'heim-raetsel') app.gehe('training');
  });
  return s;
}

export function zeige(root, params, app) {
  const s = zeigeHeim(app);
  root.append(s);
  const kopf = verbindeKopf(s, app, {
    beiZurueck: () => app.zurueck(),
    beiEinstellungen: () => app.gehe('einstellungen'),
  });
  if (tempo() > 0) {
    kopfEintritt(s);
    staffel(s.querySelectorAll('.heim-ring, .heim-liga, .heim-modus'), { d: 560, v: 60, abstand: 60, von: 'translateY(16px)' });
  }
  return {
    verlasse() {
      try { kopf.verlasse(); } catch (e) { /* egal */ }
    },
  };
}
