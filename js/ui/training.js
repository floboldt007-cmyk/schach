// Screen "Training" (Premium-Umbau U2, PLAN 2.10): Kern-Screen und Huelle fuer den Ort training:karten. Die Karten
// liefern Pakete (Tagesraetsel S1-5, Lernpfad S1-10, Kartei S2-1); ohne Anbieter steht eine ruhige Karte da.
// Seit U2 gehoert der Screen keinem Paket mehr (vorher Paket kartei, ohne Datei still zur Arena).
//
//   zeige(root, params, app) -> { verlasse() }
//
// Aufbau: header.kopf.haupt-kopf (js/ui/seite.js), darunter .training-rumpf (scrollt) mit .seiten-kopf ("Üben ohne
// Druck", "Training", Satz) und dem Gitter .training-gitter (Behaelter des Orts training:karten, Kontext { app }).
// Das Gitter zaehlt seine Karten in data-anzahl: ab drei Karten ist die erste gross und reicht ueber zwei Zeilen
// (Entwurf A), auf dem Handy eine Spalte. Ohne Karten: .training-leer. Bausteine fuer die Karten der Pakete stehen in
// css/training.css (.t-karte, .t-held, .t-marke, .t-zahl, .t-fuss, .kartei-stapel) und js/ui/bauteile.js (miniBrett).
import { fuelle } from '../orte.js';
import { hauptKopf, seitenKopf, verbindeKopf, kopfEintritt } from './seite.js';
import { icon } from './icons.js';
import { staffel, tempo } from '../bewegung.js';

export function zeige(root, params, app) {
  const s = document.createElement('section');
  s.className = 'screen training-screen';
  s.setAttribute('aria-label', 'Training');
  s.innerHTML = `${hauptKopf({ zurueck: true, titelElement: 'div' })}
    <div class="training-rumpf">
      ${seitenKopf({ ueber: 'Üben ohne Druck', titel: 'Training', text: 'Kurze Rätsel, deine eigenen Fehler als Karten und nichts, was abläuft.' })}
      <div class="training-gitter" data-anzahl="0"></div>
      <div class="training-leer t-karte" hidden>
        <span class="t-symbol" aria-hidden="true">${icon('ziel')}</span>
        <div><h2>Training kommt mit der nächsten Welle</h2>
          <p>Hier stehen bald Rätsel, ein Lernpfad und deine eigenen Fehler als Karten. Bis dahin warten die Bots in der Arena.</p></div>
        <div class="t-fuss"><button class="knopf dr" type="button" data-aktion="arena">Zur Arena ${icon('vor')}</button></div>
      </div>
    </div>`;
  root.append(s);

  const kopf = verbindeKopf(s, app, {
    beiZurueck: () => app.zurueck(),
    beiEinstellungen: () => app.gehe('einstellungen'),
  });
  s.querySelector('.training-leer [data-aktion="arena"]').addEventListener('click', () => app.gehe('arena', {}, { ersetzen: true }));

  const gitter = s.querySelector('.training-gitter');
  const leer = s.querySelector('.training-leer');
  let ort = null;
  try {
    ort = fuelle('training:karten', gitter, { app });
  } catch (e) {
    console.error(e);
    ort = { anzahl: 0, verlasse() {} };
  }
  gitter.dataset.anzahl = String(ort.anzahl);
  gitter.hidden = ort.anzahl === 0;
  leer.hidden = ort.anzahl > 0;

  // Eintritt wie im Entwurf: Kopf, Seitentitel, dann die Karten (bei Tempo 0 nichts)
  if (tempo() > 0) {
    kopfEintritt(s);
    staffel(s.querySelectorAll('.seiten-kopf > *'), { d: 560, v: 60, abstand: 50 });
    staffel(ort.anzahl ? gitter.children : [leer], { d: 720, v: 180, abstand: 80, von: 'translateY(28px) scale(.98)' });
  }

  return {
    verlasse() {
      try { ort.verlasse(); } catch (e) { console.error(e); }
      kopf.verlasse();
    },
  };
}
