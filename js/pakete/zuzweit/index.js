// Einstieg ueber den bestehenden Trainings-Ort; keine Engine und keine Wertung.
import { anbieten } from '../../orte.js';
import { ladeLaufendePartie } from '../../storage.js';

anbieten('training:karten', ({ app }) => {
  const el = document.createElement('article');
  el.className = 't-karte zz-karte';
  el.innerHTML = '<div><h2>Zu zweit</h2><p>Zwei Menschen, ein Brett. Mit Namen, auf Wunsch mit Schachuhr und danach Analyse für beide.</p></div>'
    + '<div class="t-fuss"><button class="knopf primaer" type="button">Zu zweit spielen</button></div>';
  el.querySelector('button').addEventListener('click', () => app.gehe('partie', { modus: 'zuzweit' }));
  if (ladeLaufendePartie()?.modus === 'zuzweit') {
    const fort = document.createElement('button');
    fort.className = 'knopf'; fort.type = 'button'; fort.textContent = 'Partie fortsetzen';
    fort.addEventListener('click', () => app.gehe('partie', { modus: 'zuzweit', fortsetzen: true }));
    el.querySelector('.t-fuss').append(fort);
  }
  return el;
}, { paket: 'zuzweit', reihenfolge: 60 });
