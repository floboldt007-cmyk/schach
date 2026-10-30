// Screen "Ich" mit der Sammlung (Paket sammlung). Flo, 30.10.2026: "welche Skins habe ich freigeschaltet, welche noch
// nicht, welche gibt es ueberhaupt. So mit einem Schloss ... Fuer Erfolge gilt das Gleiche und alles andere auch."
//
// Gehoert dem Paket sammlung (PAKET_SCREENS 'ich' in js/app.js): zeige gibt es erst, wenn das Paket freischalten() ruft.
// Host des Orts sammlung:bereich (Kontext { app }). Jeder Anbieter liefert ein Element aus bereich(); der Screen zeigt
// einen Bereich zur Zeit (Segment, gemerkt je Geraet) und oben "N von M freigeschaltet" ueber alle Bereiche.
// Gezeigt wird nur, was es in der App wirklich gibt; gesperrte Stuecke tragen ein Schloss und den Weg dahin.
//
//   bereich({ id, name, teile, hinweis }) -> section.sa-bereich[data-bereich][data-name]
//     teile: [{ id, name, frei, an, zeile, bild, fortschritt }]   bild: HTML (SVG oder <img>), nur fuer freie Teile
//       gezeigt; an: gerade benutzt ("Ausgeruestet"); zeile: Weg dahin oder Stand; fortschritt 0..1 (Erfolge)
//     hinweis: ein Satz unter dem Raster (z. B. was erst mit der Werkstatt kommt)
//   zeige(root, params, app) -> { verlasse() }   erst nach freischalten(); params: { bereich? }
//   freischalten()                                nur js/pakete/sammlung/index.js
import { fuelle } from '../orte.js';
import { hauptKopf, seitenKopf, verbindeKopf, kopfEintritt } from './seite.js';
import { segment } from './bauteile.js';
import { icon } from './icons.js';
import { staffel, tempo } from '../bewegung.js';
import { ladeModulEinstellungen, speichereModulEinstellungen } from '../storage.js';
import { t } from '../sprache.js';
import '../sprachen/rahmen.js';

const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Speicher: der fuer das Sammeln reservierte Modulplatz 'sammeln' (storage.js MODUL_BUDGET), hier nur der gemerkte Bereich
const MODUL = 'sammeln';

export function bereich({ id, name, teile = [], hinweis = '' } = {}) {
  const s = document.createElement('section');
  s.className = 'sa-bereich';
  s.dataset.bereich = id;
  s.dataset.name = name;
  s.setAttribute('aria-label', name);
  s.innerHTML = `<div class="sa-raster" role="list">${teile.map((x) => {
    const zustand = x.an ? 'an' : x.frei ? 'frei' : 'zu';
    const balken = Number.isFinite(x.fortschritt) && !x.frei
      ? `<span class="sa-balken" aria-hidden="true"><i style="transform:scaleX(${Math.max(0, Math.min(1, x.fortschritt)).toFixed(3)})"></i></span>` : '';
    return `<div class="sa-teil" role="listitem" data-teil="${esc(x.id)}" data-zustand="${zustand}">
      <span class="sa-bild" aria-hidden="true">${x.frei ? (x.bild || '') : icon('schloss')}</span>
      <span class="sa-text"><b>${esc(x.name)}</b><span class="sa-zeile">${esc(x.zeile || '')}</span>${balken}</span></div>`;
  }).join('')}</div>${hinweis ? `<p class="sa-hinweis">${esc(hinweis)}</p>` : ''}`;
  return s;
}

function zeigeIch(root, params = {}, app) {
  const s = document.createElement('section');
  s.className = 'screen sa-screen';
  s.setAttribute('aria-label', t('rahmen.sammlung.titel'));
  s.innerHTML = `${hauptKopf({ zurueck: true, titelElement: 'div' })}
    <div class="sa-rumpf">
      ${seitenKopf({ titel: t('rahmen.sammlung.titel') })}
      <p class="sa-stand" aria-live="polite"></p>
      <div class="sa-steuer"></div>
      <div class="sa-ort"></div>
    </div>`;
  root.append(s);
  const kopf = verbindeKopf(s, app, { beiZurueck: () => app.zurueck(), beiEinstellungen: () => app.gehe('einstellungen') });
  let gemerkt = {};
  try { gemerkt = ladeModulEinstellungen(MODUL, {}) || {}; } catch (e) { gemerkt = {}; }
  let aktiv = typeof params.bereich === 'string' ? params.bereich : gemerkt.bereich || null;
  const ort = s.querySelector('.sa-ort');
  let gefuellt = { anzahl: 0, verlasse() {} };
  try { gefuellt = fuelle('sammlung:bereich', ort, { app }); } catch (e) { console.error(e); }
  const alle = [...ort.querySelectorAll(':scope > .sa-bereich')];
  if (!alle.some((x) => x.dataset.bereich === aktiv)) aktiv = alle.length ? alle[0].dataset.bereich : null;
  const teile = ort.querySelectorAll('.sa-teil');
  const frei = ort.querySelectorAll('.sa-teil:not([data-zustand="zu"])').length;
  s.querySelector('.sa-stand').textContent = teile.length ? t('rahmen.sammlung.stand', { frei, alle: teile.length }) : t('rahmen.sammlung.leer');
  const zeigeBereich = () => {
    for (const x of alle) x.hidden = x.dataset.bereich !== aktiv;
    s.dataset.bereich = aktiv || '';
  };
  if (alle.length > 1) {
    const seg = segment({ name: 'sa-bereich', label: t('rahmen.sammlung.bereiche'), wert: aktiv,
      optionen: alle.map((x) => ({ id: x.dataset.bereich, text: x.dataset.name })),
      beiWahl: (id) => {
        aktiv = id;
        zeigeBereich();
        try { speichereModulEinstellungen(MODUL, { ...(ladeModulEinstellungen(MODUL, {}) || {}), bereich: id }); } catch (e) { /* Komfort */ }
        const sichtbar = alle.find((x) => !x.hidden);
        if (sichtbar && tempo() > 0) staffel(sichtbar.querySelectorAll('.sa-teil'), { d: 360, abstand: 25, von: 'translateY(8px)' });
      } });
    s.querySelector('.sa-steuer').append(seg.el);
  }
  zeigeBereich();
  if (tempo() > 0) {
    kopfEintritt(s);
    staffel(s.querySelectorAll('.seiten-kopf > *, .sa-stand, .sa-steuer'), { d: 520, v: 60, abstand: 50 });
  }
  return {
    verlasse() {
      try { gefuellt.verlasse(); } catch (e) { console.error(e); }
      kopf.verlasse();
    },
  };
}

// Live-Binding: undefined, bis das Paket sammlung freischaltet (ohne Paket geht der Router still zur Arena)
export let zeige;
export function freischalten() {
  zeige = zeigeIch;
}
