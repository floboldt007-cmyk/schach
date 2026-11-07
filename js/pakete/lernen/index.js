// Paket "lernen": die Meisterschule (Flo 31.10.2026, Vault Schach-App/Meisterschule.md). Bereiche Mattbilder (20) und
// Endspiele (11), Daten und Regeln in js/pakete/lernen/mattbilder.js und endspiele.js, Screens js/ui/lernen.js
// (Uebersicht mit Bereichswahl) und js/ui/lektion.js (eine Lektion: Flo spielt, die Engine die Gegenseite). Seit 07.11.2026
// fuer alle (FAHRPLAN Abschnitt 6): leichte Lektionen und je eine Probe gratis, der Rest im Trainer (js/pakete/lernen/zugang.js).
//
// Orte und Ereignisse:
//   training:karten   (reihenfolge 3) Karte "Meisterschule" mit Sternen, fuer alle; das Labor-Schild nur beim Erfinder
//   lektion:beendet   sendet js/ui/lektion.js nach einer geschafften Lektion: { id: '<bereich>-<id>', ringe } (Vertrag in ARCHITEKTUR.md;
//                     1 Stern = gelernt, 2 = sicher, 3 = gemeistert); das Paket funken bucht daraus Lern-Funken
// Speicher: Modul lernen (js/storage.js MODUL_BUDGET), Aufbau in mattbilder.js stand().
// Defensiv: Ein Fehler hier haelt die App nie an.
import { anbieten } from '../../orte.js';
import { ladeModul } from '../../storage.js';
import { laborFrei } from '../../labor.js';
import { icon } from '../../ui/icons.js';
import { t } from '../../sprache.js';
import { registriereVorteil } from '../../abo.js';
import { summe, ALLE } from './mattbilder.js';
import { zahlen, VORTEIL } from './zugang.js';
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
  ladeLernenCss();
  const sum = summe(ladeModul(PAKET, {}));
  const el = document.createElement('article');
  el.className = 't-karte ms-karte';
  el.dataset.paket = PAKET;
  el.innerHTML = `<span class="ueberzeile">${esc(S('name'))}${laborFrei() ? ` <span class="ms-labor">${esc(S('labor'))}</span>` : ''}</span>
    <div><h2>${esc(S('karteTitel'))}</h2><p>${esc(S('karteText', { n: ALLE.length }))} ${esc(S('karteGratis', { n: zahlen().gratis }))}</p></div>
    <div class="t-fuss"><span class="ms-sterne-zahl">${icon('stern')}${esc(S('sterne', { n: sum.sterne, max: sum.max }))}</span>
      <button class="knopf primaer dr ms-oeffnen" type="button">${esc(S('oeffnen'))}${icon('vor')}</button></div>`;
  el.querySelector('.ms-oeffnen').addEventListener('click', () => app.gehe('lernen'));
  return el;
}

// Die Meisterschule ist im Trainer gebaut: das Blatt zaehlt sie unter "Im Trainer" (Verkauft wird nur, was es gibt)
try { registriereVorteil(VORTEIL); } catch (e) { console.error(e); }

try {
  anbieten('training:karten', (k) => {
    try { return k && k.app ? trainingKarte(k.app) : null; } catch (e) { console.error(e); return null; }
  }, { reihenfolge: 3, paket: PAKET });
} catch (e) { console.error(e); }
