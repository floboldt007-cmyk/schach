import { anbieten } from '../../orte.js';
import { t } from '../../sprache.js';
import './texte.js';
const O = (k, w) => t('p-online.' + k, w);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
import { kontoFreigeschaltet } from '../../konto.js';
import { gemerkteEinladung } from '../../online.js';

anbieten('training:karten', ({ app }) => {
  if (!kontoFreigeschaltet()) return null;
  const el = document.createElement('article'); el.className = 't-karte online-karte';
  el.innerHTML = `<div><h2>${esc(O('titel'))}</h2><p>${esc(O('karte'))}</p></div><div class="t-fuss"><button class="knopf primaer" type="button">${esc(O('spielen'))}</button></div>`;
  el.querySelector('button').addEventListener('click', () => app.gehe('online'));
  return el;
}, { paket: 'online', reihenfolge: 65 });

// Die Einladung bleibt auch nach E-Mail- oder Google-Anmeldung in den Einstellungen erreichbar.
anbieten('einstellungen:gruppen', ({ app }) => {
  if (!kontoFreigeschaltet() || !gemerkteEinladung()) return null;
  const el = document.createElement('section'); el.className = 'es-gruppe flaeche';
  el.innerHTML = `<h3>${esc(O('einladung'))}</h3><p>${esc(O('wartet'))}</p><button class="knopf primaer" type="button">${esc(O('hin'))}</button>`;
  el.querySelector('button').addEventListener('click', () => app.gehe('online'));
  return el;
}, { paket: 'online', reihenfolge: 6 });
