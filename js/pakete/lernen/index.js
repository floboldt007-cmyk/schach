// Paket "lernen": die Meisterschule (Flo 31.10.2026, Vault Schach-App/Meisterschule.md). Etappe 1: Bereich Mattbilder
// mit 20 Lektionen (js/pakete/lernen/mattbilder.js), Screens js/ui/lernen.js (Uebersicht) und js/ui/lektion.js (eine
// Lektion: Flo setzt matt, die Engine verteidigt). Vorerst nur im Labor (js/labor.js laborFrei, also nur fuers
// Erfinder-Konto): Flo probiert aus und entscheidet dann, was gratis wird und was ins Abo kommt.
//
// Orte und Ereignisse:
//   training:karten   (reihenfolge 3) Karte "Meisterschule · Mattbilder" mit Sternen, nur mit laborFrei()
//   lektion:beendet   sendet js/ui/lektion.js nach einem Matt: { id: 'matt-<id>', ringe } (Vertrag in ARCHITEKTUR.md;
//                     1 Stern = gelernt, 2 = sicher, 3 = gemeistert); das Paket funken bucht daraus Lern-Funken
// Speicher: Modul lernen (js/storage.js MODUL_BUDGET), Aufbau in mattbilder.js stand().
// Defensiv: Ein Fehler hier haelt die App nie an.
import { anbieten } from '../../orte.js';
import { ladeModul } from '../../storage.js';
import { laborFrei } from '../../labor.js';
import { icon } from '../../ui/icons.js';
import { t } from '../../sprache.js';
import { summe, LEKTIONEN } from './mattbilder.js';
import './texte.js';

export const PAKET = 'lernen';
const S = (k, w) => t('p-lernen.' + k, w);
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function ladeLernenCss() {
  try {
    if (typeof document === 'undefined' || document.querySelector('link[data-paket="lernen"]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL('../../../css/pakete/lernen.css', import.meta.url).href;
    l.dataset.paket = 'lernen';
    document.head.append(l);
  } catch (e) { /* ohne eigenes CSS bleibt alles bedienbar */ }
}

export function trainingKarte(app) {
  if (!laborFrei()) return null;
  ladeLernenCss();
  const sum = summe(ladeModul(PAKET, {}));
  const el = document.createElement('article');
  el.className = 't-karte ms-karte';
  el.dataset.paket = PAKET;
  el.innerHTML = `<span class="ueberzeile">${esc(S('name'))} <span class="ms-labor">${esc(S('labor'))}</span></span>
    <div><h2>${esc(S('bereich'))}</h2><p>${esc(S('karteText', { n: LEKTIONEN.length }))}</p></div>
    <div class="t-fuss"><span class="ms-sterne-zahl">${icon('stern')}${esc(S('sterne', { n: sum.sterne, max: sum.max }))}</span>
      <button class="knopf primaer dr ms-oeffnen" type="button">${esc(S('oeffnen'))}${icon('vor')}</button></div>`;
  el.querySelector('.ms-oeffnen').addEventListener('click', () => app.gehe('lernen'));
  return el;
}

try {
  anbieten('training:karten', (k) => {
    try { return k && k.app ? trainingKarte(k.app) : null; } catch (e) { console.error(e); return null; }
  }, { reihenfolge: 3, paket: PAKET });
} catch (e) { console.error(e); }
