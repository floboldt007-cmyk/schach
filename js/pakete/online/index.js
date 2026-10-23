import { anbieten } from '../../orte.js';
import { gemerkteEinladung } from '../../online.js';

anbieten('training:karten', ({ app }) => {
  const el = document.createElement('article'); el.className = 't-karte online-karte';
  el.innerHTML = '<div><h2>Gegen Freunde</h2><p>Per Code oder Link einladen und online Schach spielen.</p></div><div class="t-fuss"><button class="knopf primaer" type="button">Gegen Freunde spielen</button></div>';
  el.querySelector('button').addEventListener('click', () => app.gehe('online'));
  return el;
}, { paket: 'online', reihenfolge: 65 });

// Die Einladung bleibt auch nach E-Mail- oder Google-Anmeldung in den Einstellungen erreichbar.
anbieten('einstellungen:gruppen', ({ app }) => {
  if (!gemerkteEinladung()) return null;
  const el = document.createElement('section'); el.className = 'es-gruppe flaeche';
  el.innerHTML = '<h3>Einladung zum Schach</h3><p>Die Einladung wartet hier, bis du angemeldet bist.</p><button class="knopf primaer" type="button">Zur Einladung</button>';
  el.querySelector('button').addEventListener('click', () => app.gehe('online'));
  return el;
}, { paket: 'online', reihenfolge: 6 });
