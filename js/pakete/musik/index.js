// Lobby-Musik: generative Web-Audio-Melodien, nur ausserhalb einer Partie.
import { anbieten } from '../../orte.js';
import { hoere } from '../../ereignisse.js';
import { hatWeltsiegel, ladeFortschritt } from '../../storage.js';
import { musik, MUSIK_WELTEN } from '../../musik.js';
import { t } from '../../sprache.js';
import './texte.js';

// Paket-CSS nur zusammen mit dem Paket laden (wie finisher); ?test&kern bleibt dadurch wirklich paketfrei.
if (typeof document !== 'undefined' && !document.querySelector('link[data-paket="musik"]')) {
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.dataset.paket = 'musik';
  css.href = new URL('../../../css/pakete/musik.css', import.meta.url).href;
  document.head.appendChild(css);
}

let app = null;
let screen = 'arena';
let partie = false;
let welt = 1;

export const ABEND_ARTIKEL = Object.freeze({
  id: 'musik-abend', art: 'musikpaket', name: 'Abend', stuecke: 3, verfuegbar: false,
});
// Werkstatt #56 kann diese Funktion spaeter mit ihrem registriereArtikel uebergeben.
export function anmeldenWerkstatt(registriereArtikel) {
  return typeof registriereArtikel === 'function' ? registriereArtikel(ABEND_ARTIKEL) : null;
}

function einstellung() { return app && app.einstellungen ? app.einstellungen() : {}; }
export function istMelodieFrei(id, fortschritt = ladeFortschritt()) {
  const i = MUSIK_WELTEN.findIndex((m) => m.id === id);
  return i === 0 || (i > 0 && hatWeltsiegel(i + 1, fortschritt));
}
function weltId() { return (MUSIK_WELTEN[welt - 1] || MUSIK_WELTEN[0]).id; }
function aktualisiere() {
  if (!app) return;
  const e = einstellung();
  const fest = e.musikMelodie && e.musikMelodie !== 'welt' && istMelodieFrei(e.musikMelodie) ? e.musikMelodie : null;
  musik.einstellen({ an: e.musik === true && !partie && screen !== 'partie', laut: e.musikLautstaerke, welt: fest || weltId() });
}
function entsperre() { musik.aktivieren(); aktualisiere(); }
if (typeof window !== 'undefined') {
  for (const art of ['pointerup', 'touchend', 'keydown']) window.addEventListener(art, entsperre, { passive: true });
  window.addEventListener('schach:einstellungen', aktualisiere);
}

function gruppe({ app: a }) {
  const el = document.createElement('section');
  el.className = 'es-gruppe flaeche musik-einstellung';
  el.setAttribute('aria-labelledby', 'musik-titel');
  const e = a.einstellungen();
  const optionen = [['welt', t('p-musik.welt')], ...MUSIK_WELTEN.map((m) => [m.id, t('p-musik.welt.' + m.id)])];
  el.innerHTML = `<div class="musik-kopf"><div><h3 class="es-titel" id="musik-titel">${t('p-musik.titel')}</h3><p>${t('p-musik.hilfe')}</p></div>
    <button class="musik-schalter" type="button" role="switch" aria-checked="${e.musik === true}">${t('p-musik.an')}</button></div>
    <label>${t('p-musik.laut')} <input class="musik-laut" type="range" min="0" max="1" step="0.05" value="${e.musikLautstaerke ?? .35}"></label>
    <label>${t('p-musik.wahl')} <select class="musik-wahl">${optionen.map(([id, name]) => {
      const frei = id === 'welt' || istMelodieFrei(id);
      return `<option value="${id}" ${id === e.musikMelodie ? 'selected' : ''} ${frei ? '' : 'disabled'}>${name}${frei ? '' : ` · ${t('p-musik.gesperrt')}`}</option>`;
    }).join('')}</select></label>
    <div class="musik-abend"><b>${t('p-musik.abend')}</b><p>${t('p-musik.abendText')}</p><button class="knopf" type="button" disabled>${t('p-musik.bald')}</button></div>`;
  const schalter = el.querySelector('.musik-schalter');
  schalter.addEventListener('click', () => { entsperre(); a.setzeEinstellungen({ musik: a.einstellungen().musik !== true }); schalter.setAttribute('aria-checked', a.einstellungen().musik === true ? 'true' : 'false'); });
  el.querySelector('.musik-laut').addEventListener('input', (ev) => a.setzeEinstellungen({ musikLautstaerke: Number(ev.target.value) }));
  el.querySelector('.musik-wahl').addEventListener('change', (ev) => a.setzeEinstellungen({ musikMelodie: ev.target.value }));
  return el;
}

anbieten('einstellungen:gruppen', gruppe, { reihenfolge: 4, paket: 'musik' });
hoere('app:bereit', (d) => { app = d.app; aktualisiere(); });
hoere('app:screen', (d) => {
  screen = d.name;
  if (screen === 'arena') {
    const nr = Number(d.params && d.params.welt);
    if (nr >= 1 && nr <= MUSIK_WELTEN.length) welt = nr;
    setTimeout(() => {
      const id = document.querySelector('.welt[data-welt]')?.dataset.welt;
      const i = MUSIK_WELTEN.findIndex((m) => m.id === id);
      if (i >= 0) { welt = i + 1; aktualisiere(); }
    }, 0);
  }
  aktualisiere();
});
hoere('partie:gestartet', () => { partie = true; musik.partie(true); });
hoere('partie:verlassen', () => { partie = false; musik.partie(false); aktualisiere(); });

if (typeof window !== 'undefined' && typeof location !== 'undefined' && /[?&]test\b/.test(location.search || '')) {
  window.__musik = { musik, istMelodieFrei, aktualisiere, welt: () => welt };
}
