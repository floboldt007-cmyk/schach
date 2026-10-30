// Lobby-Musik: generative Web-Audio-Melodien, nur ausserhalb einer Partie.
import { anbieten } from '../../orte.js';
import { hoere } from '../../ereignisse.js';
import { hatWeltsiegel, ladeFortschritt } from '../../storage.js';
import { musik, MUSIK_WELTEN } from '../../musik.js';
import { istErfinder } from '../../sonderstuecke.js';
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
  // Erfinder: alles Ausruestbare frei (js/sonderstuecke.js istErfinder)
  if (i >= 0 && istErfinder()) return true;
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
  // Lobby-Musik als Untergruppe der Gruppe Klang (Flo 30.10.: "optional, in den Einstellungen anmachen"), im Stil der
  // Einstellungen: Schalter-Zeile, Regler, Auswahl. Die Werte setzt das Paket selbst (kein data-aktion des Screens).
  const el = document.createElement('div');
  el.className = 'es-untergruppe musik-einstellung';
  const e = a.einstellungen();
  const laut = e.musikLautstaerke ?? .35;
  const optionen = [['welt', t('p-musik.welt')], ...MUSIK_WELTEN.map((m) => [m.id, t('p-musik.welt.' + m.id)])];
  el.innerHTML = `<h4>${t('p-musik.titel')}</h4>
    <div class="es-zeile">
      <div class="es-text"><b id="es-l-musik">${t('p-musik.an')}</b><span id="es-t-musik">${t('p-musik.hilfe')}</span></div>
      <button class="es-schalter musik-schalter" type="button" role="switch" aria-labelledby="es-l-musik" aria-describedby="es-t-musik"
        aria-checked="${e.musik === true}"><i></i></button>
    </div>
    <label class="es-regler"><span><b>${t('p-musik.laut')}</b><output class="musik-prozent">${Math.round(laut * 100)} %</output></span>
      <input class="musik-laut" type="range" min="0" max="1" step="0.05" value="${laut}"></label>
    <label class="musik-wahl-feld"><b>${t('p-musik.wahl')}</b><select class="musik-wahl">${optionen.map(([id, name]) => {
      const frei = id === 'welt' || istMelodieFrei(id);
      return `<option value="${id}" ${id === e.musikMelodie ? 'selected' : ''} ${frei ? '' : 'disabled'}>${name}${frei ? '' : ` · ${t('p-musik.gesperrt')}`}</option>`;
    }).join('')}</select></label>
    <div class="musik-abend"><span><b>${t('p-musik.abend')}</b><span>${t('p-musik.abendText')}</span></span><span class="musik-bald">${t('p-musik.bald')}</span></div>`;
  const schalter = el.querySelector('.musik-schalter');
  schalter.addEventListener('click', () => { entsperre(); a.setzeEinstellungen({ musik: a.einstellungen().musik !== true }); schalter.setAttribute('aria-checked', a.einstellungen().musik === true); aktualisiere(); });
  el.querySelector('.musik-laut').addEventListener('input', (ev) => {
    a.setzeEinstellungen({ musikLautstaerke: Number(ev.target.value) });
    el.querySelector('.musik-prozent').textContent = `${Math.round(Number(ev.target.value) * 100)} %`;
  });
  el.querySelector('.musik-wahl').addEventListener('change', (ev) => a.setzeEinstellungen({ musikMelodie: ev.target.value }));
  return el;
}

anbieten('einstellungen:klang', gruppe, { reihenfolge: 4, paket: 'musik' });
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
// App im Hintergrund: ausblenden und anhalten; zurueck: weiter ab jetzt (iOS notfalls erst mit der naechsten Geste)
hoere('app:sichtbar', (d) => musik.sichtbarkeit(!(d && d.sichtbar === false)));

if (typeof window !== 'undefined' && typeof location !== 'undefined' && /[?&]test\b/.test(location.search || '')) {
  window.__musik = { musik, istMelodieFrei, aktualisiere, welt: () => welt };
}
