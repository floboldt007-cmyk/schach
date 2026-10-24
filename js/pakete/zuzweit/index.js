// Einstieg ueber den bestehenden Trainings-Ort; keine Engine und keine Wertung. Texte ueber t('p-zuzweit.x') (texte.js).
import { anbieten } from '../../orte.js';
import { ladeLaufendePartie } from '../../storage.js';
import { t } from '../../sprache.js';
import './texte.js';

const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

anbieten('training:karten', ({ app }) => {
  const el = document.createElement('article');
  el.className = 't-karte zz-karte';
  el.innerHTML = `<div><h2>${esc(t('p-zuzweit.titel'))}</h2><p>${esc(t('p-zuzweit.text'))}</p></div>`
    + `<div class="t-fuss"><button class="knopf primaer" type="button">${esc(t('p-zuzweit.spielen'))}</button></div>`;
  el.querySelector('button').addEventListener('click', () => app.gehe('partie', { modus: 'zuzweit' }));
  if (ladeLaufendePartie()?.modus === 'zuzweit') {
    const fort = document.createElement('button');
    fort.className = 'knopf'; fort.type = 'button'; fort.textContent = t('p-zuzweit.fortsetzen');
    fort.addEventListener('click', () => app.gehe('partie', { modus: 'zuzweit', fortsetzen: true }));
    el.querySelector('.t-fuss').append(fort);
  }
  return el;
}, { paket: 'zuzweit', reihenfolge: 60 });
