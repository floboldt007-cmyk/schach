// Screen "Ich" mit der Sammlung (Paket sammlung). Flo, 30.10.2026: "welche Skins habe ich freigeschaltet, welche noch
// nicht, welche gibt es ueberhaupt. So mit einem Schloss ... Fuer Erfolge gilt das Gleiche und alles andere auch."
//
// Gehoert dem Paket sammlung (PAKET_SCREENS 'ich' in js/app.js): zeige gibt es erst, wenn das Paket freischalten() ruft.
// Host der Orte ich:kopf (Profil, Kontext { app }) und sammlung:bereich (Kontext { app }). Jeder Anbieter liefert ein Element aus bereich(); der Screen zeigt
// einen Bereich zur Zeit (Segment, gemerkt je Geraet) und oben "N von M freigeschaltet" ueber alle Bereiche.
// Gezeigt wird nur, was es in der App wirklich gibt; gesperrte Stuecke tragen ein Schloss und den Weg dahin.
//
//   bereich({ id, name, teile, hinweis }) -> section.sa-bereich[data-bereich][data-name]
//     teile: [{ id, name, frei, an, zeile, bild, fortschritt, seltenheit, labor, merkmal }]   bild: HTML (SVG oder <img>); gesperrt
//       erscheint es als dunkle Silhouette mit "?" (Flo 30.10.: "mehr Aura, mysterioeser"), ohne Bild ein "?";
//       an: gerade benutzt ("Ausgeruestet"); zeile: Weg dahin oder Stand; fortschritt 0..1; seltenheit 'frei' | 'selten'
//       | 'episch' | 'legende' | 'einzig' (Leuchten und Schild); labor: nur fuer den Erfinder (Schild "Labor")
//     hinweis: ein Satz unter dem Raster (z. B. was erst mit der Werkstatt kommt)
//   zeige(root, params, app) -> { verlasse() }   erst nach freischalten(); params: { bereich?, oben?, ruhig? }
//       oben: Scroll-Stand der Sammlung (nach dem Ausruesten bleibt die Seite, wo sie war; Flo 31.10.2026: "wenn ich
//       auf die Lobby klicke, springt der nach oben"), ruhig: ohne Einflug-Bewegung neu zeichnen
//   freischalten()                                nur js/pakete/sammlung/index.js
import { fuelle } from '../orte.js';
import { hauptKopf, seitenKopf, verbindeKopf, kopfEintritt } from './seite.js';
import { segment, wischKanten } from './bauteile.js';
import { staffel, tempo } from '../bewegung.js';
import { ladeModulEinstellungen, speichereModulEinstellungen } from '../storage.js';
import { t } from '../sprache.js';
import '../sprachen/rahmen.js';

const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Speicher: der fuer das Sammeln reservierte Modulplatz 'sammeln' (storage.js MODUL_BUDGET), hier nur der gemerkte Bereich
const MODUL = 'sammeln';
// Ausruesten per Tipp (Flo 31.10.2026: "Warum kann ich die Klaenge nicht auswaehlen?"): ein Teil mit wahl() bekommt eine
// Tippflaeche ueber der Karte; der Screen ruft wahl() und zeichnet den Bereich neu
const WAHLEN = new WeakMap();   // section.sa-bereich -> Map(teil-id -> wahl)

export function bereich({ id, name, teile = [], hinweis = '' } = {}) {
  const s = document.createElement('section');
  s.className = 'sa-bereich';
  s.dataset.bereich = id;
  s.dataset.name = name;
  s.setAttribute('aria-label', name);
  // Gruppen (Feld gruppe, z. B. Erfolge: Meilensteine, Welten, Liga, Serie, Level) bekommen je eine Ueberschrift mit
  // "n von m" und ein eigenes Raster; ohne Gruppen ein Raster wie bisher (Flo 30.10. abends: Erfolge "in meinem Stil")
  const gruppen = [];
  for (const x of teile) {
    const g = x.gruppe || '';
    if (!gruppen.length || gruppen[gruppen.length - 1].name !== g) gruppen.push({ name: g, teile: [] });
    gruppen[gruppen.length - 1].teile.push(x);
  }
  s.innerHTML = `${gruppen.map((gr) => `${gr.name ? `<h4 class="sa-gruppe"><span>${esc(gr.name)}</span><small class="zahl">${gr.teile.filter((x) => x.frei).length} / ${gr.teile.length}</small></h4>` : ''}`
    + `<div class="sa-raster" role="list">${gr.teile.map((x) => {
    const zustand = x.an ? 'an' : x.frei ? 'frei' : 'zu';
    const balken = Number.isFinite(x.fortschritt) && !x.frei
      ? `<span class="sa-balken" aria-hidden="true"><i style="transform:scaleX(${Math.max(0, Math.min(1, x.fortschritt)).toFixed(3)})"></i></span>` : '';
    const seltenheit = ['frei', 'selten', 'episch', 'legende', 'einzig'].includes(x.seltenheit) ? x.seltenheit : '';
    const schild = x.labor ? `<span class="sa-schild sa-labor">${esc(t('rahmen.sammlung.labor'))}</span>`
      : seltenheit && seltenheit !== 'frei' ? `<span class="sa-schild" data-seltenheit="${seltenheit}">${esc(t('rahmen.sammlung.selten.' + seltenheit))}</span>` : '';
    const bild = x.frei ? (x.bild || '') : x.bild ? `<span class="sa-geheim">${x.bild}</span><span class="sa-frage">?</span>` : '<span class="sa-frage">?</span>';
    const waehlbar = x.frei && !x.an && typeof x.wahl === 'function';
    // abwahl (z. B. Lobby-Musik): ein zweiter Tipp auf das ausgeruestete Teil schaltet es aus
    const abwaehlbar = x.frei && x.an && typeof x.abwahl === 'function';
    const knopf = waehlbar ? `<button type="button" class="sa-wahl" aria-label="${esc(t('rahmen.sammlung.ausruesten', { name: x.name }))}"></button>`
      : abwaehlbar ? `<button type="button" class="sa-wahl" data-ab aria-label="${esc(t('rahmen.sammlung.ausschalten', { name: x.name }))}"></button>` : '';
    return `<div class="sa-teil" role="listitem" data-teil="${esc(x.id)}" data-zustand="${zustand}"${seltenheit ? ` data-seltenheit="${seltenheit}"` : ''}${waehlbar || abwaehlbar ? ' data-waehlbar' : ''}>${knopf}
      <span class="sa-bild" aria-hidden="true">${bild}${schild}</span>
      <span class="sa-text"><b>${esc(x.name)}</b>${schild ? `<span class="sa-text-schild">${schild}</span>` : ''}<span class="sa-zeile">${esc(x.zeile || '')}</span>${balken}</span></div>`;
  }).join('')}</div>`).join('')}${hinweis ? `<p class="sa-hinweis">${esc(hinweis)}</p>` : ''}`;
  const wahlen = new Map([
    ...teile.filter((x) => x.frei && !x.an && typeof x.wahl === 'function').map((x) => [String(x.id), { fn: x.wahl, ab: false }]),
    ...teile.filter((x) => x.frei && x.an && typeof x.abwahl === 'function').map((x) => [String(x.id), { fn: x.abwahl, ab: true }]),
  ]);
  if (wahlen.size) WAHLEN.set(s, wahlen);
  return s;
}

function zeigeIch(root, params = {}, app) {
  const s = document.createElement('section');
  s.className = 'screen sa-screen';
  s.setAttribute('aria-label', t('rahmen.sammlung.titel'));
  s.innerHTML = `${hauptKopf({ zurueck: true, titelElement: 'div' })}
    <div class="sa-rumpf">
      ${seitenKopf({ titel: t('rahmen.sammlung.titel') })}
      <div class="sa-kopf-ort"></div>
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
  let kopfOrt = { anzahl: 0, verlasse() {} };
  // Profil oben (Ort ich:kopf, Paket sammlung), ohne Anbieter bleibt die Stelle leer
  try { kopfOrt = fuelle('ich:kopf', s.querySelector('.sa-kopf-ort'), { app }); } catch (e) { console.error(e); }
  s.querySelector('.sa-kopf-ort').hidden = !kopfOrt.anzahl;
  try { gefuellt = fuelle('sammlung:bereich', ort, { app }); } catch (e) { console.error(e); }
  // Ausruesten per Tipp: wahl() des Teils, dann nur die Bereiche (und das Profil oben) an Ort und Stelle neu zeichnen.
  // Vorher wurde der ganze Screen neu aufgebaut und die Scroll-Stelle danach wiederhergestellt; auf dem iPad (Safari)
  // sah man dabei kurz den Anfang der Seite (Flo 31.10.2026 abends: "auf dem iPad springt es immer noch nach oben").
  ort.addEventListener('click', (ev) => {
    const b = ev.target.closest('.sa-wahl');
    const teil = b && b.closest('.sa-teil');
    const ber = teil && teil.closest('.sa-bereich');
    const wahl = ber && WAHLEN.get(ber)?.get(teil.dataset.teil);
    if (!wahl) return;
    try { wahl.fn(); } catch (e) { console.error(e); return; }
    const name = teil.querySelector('.sa-text b')?.textContent || '';
    try { app.meldung?.(t(wahl.ab ? 'rahmen.sammlung.ausgeschaltet' : 'rahmen.sammlung.ausgeruestet', { name })); } catch (e) { /* egal */ }
    aktiv = ber.dataset.bereich;
    zeichneNeu();
  });
  let alle = [...ort.querySelectorAll(':scope > .sa-bereich')];
  if (!alle.some((x) => x.dataset.bereich === aktiv)) aktiv = alle.length ? alle[0].dataset.bereich : null;
  const stand = s.querySelector('.sa-stand');
  const zeigeStand = () => {
    const teile = ort.querySelectorAll('.sa-teil');
    const frei = ort.querySelectorAll('.sa-teil:not([data-zustand="zu"])').length;
    stand.textContent = teile.length ? t('rahmen.sammlung.stand', { frei, alle: teile.length }) : t('rahmen.sammlung.leer');
    // Fortschritt als Balken unter der Zeile (Flo 30.10.: "21 von 67" sichtbar machen)
    stand.style.setProperty('--anteil', teile.length ? (frei / teile.length).toFixed(3) : '0');
  };
  zeigeStand();
  const zeigeBereich = () => {
    for (const x of alle) x.hidden = x.dataset.bereich !== aktiv;
    s.dataset.bereich = aktiv || '';
  };
  // Nach dem Ausruesten: Profil und Bereiche neu fuellen, die Hoehe haelt so lange, die Scroll-Stelle bleibt (im selben
  // Durchlauf, vor dem naechsten Bild); keine Einflug-Bewegung
  function zeichneNeu() {
    const rumpf = s.querySelector('.sa-rumpf');
    const oben = rumpf.scrollTop;
    ort.style.minHeight = ort.offsetHeight + 'px';
    try { kopfOrt.verlasse(); } catch (e) { console.error(e); }
    try { gefuellt.verlasse(); } catch (e) { console.error(e); }
    const kopfEl = s.querySelector('.sa-kopf-ort');
    kopfEl.replaceChildren();
    ort.replaceChildren();
    try { kopfOrt = fuelle('ich:kopf', kopfEl, { app }); } catch (e) { console.error(e); kopfOrt = { anzahl: 0, verlasse() {} }; }
    kopfEl.hidden = !kopfOrt.anzahl;
    try { gefuellt = fuelle('sammlung:bereich', ort, { app }); } catch (e) { console.error(e); gefuellt = { anzahl: 0, verlasse() {} }; }
    alle = [...ort.querySelectorAll(':scope > .sa-bereich')];
    if (!alle.some((x) => x.dataset.bereich === aktiv)) aktiv = alle.length ? alle[0].dataset.bereich : null;
    zeigeBereich();
    zeigeStand();
    ort.style.minHeight = '';
    rumpf.scrollTop = oben;
  }
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
    const steuer = s.querySelector('.sa-steuer');
    steuer.append(seg.el);
    wischKanten(steuer);
    // Handy: die Leiste wischt waagrecht; der gewaehlte Reiter steht beim Oeffnen in der Mitte, nicht ausserhalb
    requestAnimationFrame(() => {
      const an = seg.el.querySelector('[aria-checked="true"]');
      if (an && steuer.scrollWidth > steuer.clientWidth) steuer.scrollLeft = Math.max(0, an.offsetLeft - (steuer.clientWidth - an.offsetWidth) / 2);
    });
  }
  zeigeBereich();
  const oben = Number(params.oben);
  if (Number.isFinite(oben) && oben > 0) {
    const rumpf = s.querySelector('.sa-rumpf');
    rumpf.scrollTop = oben;
    // nach dem ersten Layout noch einmal (Bilder und Orte koennen die Hoehe erst dann setzen)
    requestAnimationFrame(() => { rumpf.scrollTop = oben; });
  }
  if (tempo() > 0 && !params.ruhig) {
    kopfEintritt(s);
    staffel(s.querySelectorAll('.seiten-kopf > *, .sa-stand, .sa-steuer'), { d: 520, v: 60, abstand: 50 });
  }
  return {
    verlasse() {
      try { gefuellt.verlasse(); } catch (e) { console.error(e); }
      try { kopfOrt.verlasse(); } catch (e) { console.error(e); }
      kopf.verlasse();
    },
  };
}

// Live-Binding: undefined, bis das Paket sammlung freischaltet (ohne Paket geht der Router still zur Arena)
export let zeige;
export function freischalten() {
  zeige = zeigeIch;
}
