// Screen "Bestenliste" (Paket punkte, SPIELKONZEPT 3.13 und 3.17; Look A). Host des Orts bestenliste:reiter.
//
// Gehoert dem Paket punkte (PAKET_SCREENS in js/app.js, SCREEN_PAKET in tests/sw.test.mjs): Die Datei liegt zwar im Kern-
// Ordner js/ui/, zeige() gibt es aber erst, wenn das Paket geladen ist und freischalten() ruft (Live-Binding). Ohne Paket
// findet der Router kein zeige() und geht still zur Arena, genau wie ohne Datei (ARCHITEKTUR.md "app.js: Pakete").
//
//   zeige(root, params, app) -> { verlasse() }       erst nach freischalten(), sonst undefined
//   freischalten()                                   nur js/pakete/punkte/index.js, einmal beim Laden
//   params: { reiter?: 'ich' | 'bots' | ..., fenster?: 'woche' | 'monat' | 'allzeit' }
//
// Aufbau: header.kopf.haupt-kopf (js/ui/seite.js), darunter .bl-rumpf (scrollt) mit .seiten-kopf, der Steuerzeile
// .bl-steuer (Segment der Reiter aus den Anbietern, Segment der Fenster Woche / Monat / Allzeit, Standard Woche) und dem
// Behaelter .bl-ort des Orts bestenliste:reiter (Kontext { app, reiter, fenster }). Jeder Anbieter liefert ein
// section.bl-reiter[data-reiter][data-name] (Reihenfolge: Ich 10 / Bots 20 / Liga 30 / Raetsel 40 / Freunde 50; mit
// data-ohne-fenster blendet der Host das Fenster-Segment aus, solange dieser Reiter gewaehlt ist); ist sein
// Reiter nicht gewaehlt, eine leere Huelle (hidden), aus der die Reiterzeile entsteht. Wechsel von Reiter oder Fenster
// fuellt den Ort neu. Ohne Anbieter: eine ruhige Karte .bl-leer-screen. Gemerkt je Geraet (Modul-Einstellungen punkte).
import { fuelle } from '../orte.js';
import { hauptKopf, seitenKopf, verbindeKopf, kopfEintritt } from './seite.js';
import { segment } from './bauteile.js';
import { icon } from './icons.js';
import { staffel, tempo } from '../bewegung.js';
import { ladeModulEinstellungen, speichereModulEinstellungen } from '../storage.js';
import { t } from '../sprache.js';
import '../sprachen/rahmen.js';

const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Zeitfenster; die Namen kommen erst beim Zeichnen (t('rahmen.bestenliste.<id>'))
const FENSTER = [{ id: 'woche' }, { id: 'monat' }, { id: 'allzeit' }];
function fensterOptionen() {
  return FENSTER.map((f) => ({ id: f.id, text: t('rahmen.bestenliste.' + f.id) }));
}

function zeigeBestenliste(root, params = {}, app) {
  const s = document.createElement('section');
  s.className = 'screen bl-screen';
  s.setAttribute('aria-label', t('rahmen.bestenliste.titel'));
  s.innerHTML = `${hauptKopf({ zurueck: true, titelElement: 'div', seite: t('rahmen.bestenliste.titel') })}
    <div class="bl-rumpf">
      ${seitenKopf({ titel: t('rahmen.bestenliste.titel') })}
      <div class="bl-steuer"><div class="bl-steuer-reiter"></div><div class="bl-steuer-fenster"></div></div>
      <div class="bl-ort"></div>
      <div class="bl-leer-screen t-karte" hidden>
        <span class="t-symbol" aria-hidden="true">${icon('podest')}</span>
        <div><h2>${esc(t('rahmen.bestenliste.leerTitel'))}</h2><p>${esc(t('rahmen.bestenliste.leerText'))}</p></div>
      </div>
    </div>`;
  root.append(s);
  const kopf = verbindeKopf(s, app, { beiZurueck: () => app.zurueck(), beiEinstellungen: () => app.gehe('einstellungen') });

  let gemerkt = {};
  try { gemerkt = ladeModulEinstellungen('punkte', {}) || {}; } catch (e) { gemerkt = {}; }
  let reiter = typeof params.reiter === 'string' ? params.reiter : (gemerkt.reiter || 'ich');
  let fenster = FENSTER.some((f) => f.id === params.fenster) ? params.fenster : (FENSTER.some((f) => f.id === gemerkt.fenster) ? gemerkt.fenster : 'woche');
  const merke = () => {
    try { speichereModulEinstellungen('punkte', { ...(ladeModulEinstellungen('punkte', {}) || {}), reiter, fenster }); } catch (e) { /* Komfort */ }
  };

  const ort = s.querySelector('.bl-ort');
  const platzReiter = s.querySelector('.bl-steuer-reiter');
  const fensterSeg = segment({ name: 'bl-fenster', label: t('rahmen.bestenliste.zeitraum'), optionen: fensterOptionen(), wert: fenster,
    beiWahl: (id) => { fenster = id; merke(); fuelleOrt(); } });
  s.querySelector('.bl-steuer-fenster').append(fensterSeg.el);
  let reiterSeg = null;
  let reiterIds = '';
  let gefuellt = null;

  function fuelleOrt({ erst = false } = {}) {
    if (gefuellt) { try { gefuellt.verlasse(); } catch (e) { console.error(e); } }
    try {
      gefuellt = fuelle('bestenliste:reiter', ort, { app, reiter, fenster });
    } catch (e) {
      console.error(e);
      gefuellt = { anzahl: 0, verlasse() {} };
    }
    const alle = [...ort.querySelectorAll(':scope > [data-reiter]')];
    // gewaehlter Reiter nicht angeboten: der erste, und neu fuellen (dann liefert er seinen Inhalt)
    if (alle.length && !alle.some((x) => x.dataset.reiter === reiter)) {
      reiter = alle[0].dataset.reiter;
      fuelleOrt({ erst });
      return;
    }
    for (const x of alle) x.hidden = x.dataset.reiter !== reiter;
    const ids = alle.map((x) => `${x.dataset.reiter}:${x.dataset.name || x.dataset.reiter}`).join('|');
    if (ids !== reiterIds) {
      reiterIds = ids;
      platzReiter.replaceChildren();
      reiterSeg = null;
      if (alle.length > 1) {
        reiterSeg = segment({ name: 'bl-reiter', label: t('rahmen.bestenliste.bereich'), wert: reiter,
          optionen: alle.map((x) => ({ id: x.dataset.reiter, text: x.dataset.name || x.dataset.reiter })),
          beiWahl: (id) => { reiter = id; merke(); fuelleOrt(); } });
        platzReiter.append(reiterSeg.el);
      }
    } else if (reiterSeg) reiterSeg.setze(reiter);
    s.dataset.reiter = reiter;
    s.dataset.fenster = fenster;
    s.querySelector('.bl-leer-screen').hidden = gefuellt.anzahl > 0;
    ort.hidden = gefuellt.anzahl === 0;
    const sichtbar = alle.find((x) => !x.hidden);
    // ein Reiter ohne Zeitraum (z. B. Freunde) blendet das Fenster-Segment aus
    s.querySelector('.bl-steuer-fenster').hidden = !!(sichtbar && sichtbar.hasAttribute('data-ohne-fenster'));
    if (!erst && sichtbar && tempo() > 0) staffel(sichtbar.children, { d: 480, abstand: 50, von: 'translateY(14px)' });
  }
  fuelleOrt({ erst: true });

  if (tempo() > 0) {
    kopfEintritt(s);
    staffel(s.querySelectorAll('.seiten-kopf > *'), { d: 560, v: 60, abstand: 50 });
    const sichtbar = ort.querySelector(':scope > [data-reiter]:not([hidden])');
    staffel([s.querySelector('.bl-steuer'), ...(sichtbar ? sichtbar.children : [])], { d: 680, v: 160, abstand: 70, von: 'translateY(24px)' });
  }

  return {
    verlasse() {
      if (gefuellt) { try { gefuellt.verlasse(); } catch (e) { console.error(e); } }
      kopf.verlasse();
    },
  };
}

// Live-Binding: undefined, bis das Paket punkte freischaltet (ohne Paket geht der Router still zur Arena)
export let zeige;
export function freischalten() {
  zeige = zeigeBestenliste;
}
