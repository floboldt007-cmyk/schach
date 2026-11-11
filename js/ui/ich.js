// Screen "Ich" mit der Sammlung (Paket sammlung). Flo, 30.10.2026: "welche Skins habe ich freigeschaltet, welche noch
// nicht, welche gibt es ueberhaupt. So mit einem Schloss ... Fuer Erfolge gilt das Gleiche und alles andere auch."
//
// Gehoert dem Paket sammlung (PAKET_SCREENS 'ich' in js/app.js): zeige gibt es erst, wenn das Paket freischalten() ruft.
// Host der Orte ich:kopf (Profil, Kontext { app }) und sammlung:bereich (Kontext { app }). Jeder Anbieter liefert ein Element aus bereich().
// Ausruestung mit Plaetzen (G-002, Flos Wahl "Sammlung B" 08.11.2026; vorher acht Reiter): oben "N von M freigeschaltet",
// dann die Plaetze untereinander in zwei Gruppen, "So sehen dich andere" (Banner, Titel, Rahmen) und "Am Brett" (Bretter,
// Figuren, Klaenge, Emotes, Finisher; unbekannte Bereiche dahinter). Jeder Platz (button.sa-platz[data-bereich]) zeigt das
// Getragene und "frei / alle"; ein Tipp oeffnet den Bereich als Blatt (.sheet-karte.sa-blatt), darin wird wie bisher
// ausgeruestet. Darunter zwei grosse Knoepfe (button.sa-gross) fuer Erfolge und Shop, die ebenso als Blatt aufgehen.
// Die Bereiche selbst liegen versteckt in .sa-ort und wandern fuer die Dauer des Blatts hinein.
// Gezeigt wird nur, was es in der App wirklich gibt; gesperrte Stuecke tragen ein Schloss und den Weg dahin.
//
//   bereich({ id, name, teile, hinweis }) -> section.sa-bereich[data-bereich][data-name]
//     teile: [{ id, name, frei, an, zeile, bild, fortschritt, seltenheit, labor, merkmal }]   bild: HTML (SVG oder <img>); gesperrt
//       erscheint es als dunkle Silhouette mit "?" (Flo 30.10.: "mehr Aura, mysterioeser"), ohne Bild ein "?";
//       an: gerade benutzt ("Ausgeruestet"); zeile: Weg dahin oder Stand; fortschritt 0..1; seltenheit 'frei' | 'selten'
//       | 'episch' | 'legende' | 'einzig' (Leuchten und Schild); labor: nur fuer den Erfinder (Schild "Labor")
//     hinweis: ein Satz unter dem Raster (z. B. was erst mit der Werkstatt kommt)
//   zeige(root, params, app) -> { verlasse() }   erst nach freischalten(); params: { bereich?, oben?, ruhig? }
//       bereich: dieses Blatt gleich oeffnen (z. B. "shop" von der Startseite)
//       oben: Scroll-Stand der Sammlung (nach dem Ausruesten bleibt die Seite, wo sie war; Flo 31.10.2026: "wenn ich
//       auf die Lobby klicke, springt der nach oben"), ruhig: ohne Einflug-Bewegung neu zeichnen
//   freischalten()                                nur js/pakete/sammlung/index.js
import { fuelle } from '../orte.js';
import { hauptKopf, seitenKopf, verbindeKopf, kopfEintritt } from './seite.js';
import { sheet, schliesseSheet } from './bauteile.js';
import { icon } from './icons.js';
import { staffel, tempo } from '../bewegung.js';
import { t } from '../sprache.js';
import '../sprachen/rahmen.js';

const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Ausruesten per Tipp (Flo 31.10.2026: "Warum kann ich die Klaenge nicht auswaehlen?"): ein Teil mit wahl() bekommt eine
// Tippflaeche ueber der Karte; der Screen ruft wahl() und zeichnet den Bereich neu
const WAHLEN = new WeakMap();   // section.sa-bereich -> Map(teil-id -> wahl)
// Plaetze je Gruppe (Reihenfolge der Anzeige); Erfolge und Shop sind die grossen Knoepfe unten
const PLAETZE = Object.freeze([
  Object.freeze({ id: 'andere', bereiche: Object.freeze(['banner', 'titel', 'rahmen']) }),
  Object.freeze({ id: 'amBrett', bereiche: Object.freeze(['bretter', 'figuren', 'klaenge', 'emotes', 'finisher']) }),
]);
const GROSS = Object.freeze(['erfolge', 'shop']);

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
  // Verlauf (Flo 01.11.2026, Startseite neu): auf dem Handy steht er nicht mehr im Kopf der Arena, sondern hier bei "Ich"
  s.innerHTML = `${hauptKopf({ zurueck: true, titelElement: 'div', seite: t('rahmen.sammlung.titel'),
    knoepfe: [{ aktion: 'verlauf', icon: 'verlauf', label: t('allgemein.verlauf') }] })}
    <div class="sa-rumpf">
      ${seitenKopf({ titel: t('rahmen.sammlung.titel') })}
      <div class="sa-kopf-ort"></div>
      <p class="sa-stand" aria-live="polite"></p>
      <div class="sa-steuer"></div>
      <div class="sa-ort"></div>
    </div>`;
  root.append(s);
  const kopf = verbindeKopf(s, app, { beiZurueck: () => app.zurueck(), beiEinstellungen: () => app.gehe('einstellungen') });
  s.querySelector('.haupt-kopf [data-aktion="verlauf"]')?.addEventListener('click', () => app.gehe('verlauf'));
  const ort = s.querySelector('.sa-ort');
  ort.hidden = true;
  const platzOrt = s.querySelector('.sa-steuer');
  platzOrt.className = 'sa-plaetze';
  let gefuellt = { anzahl: 0, verlasse() {} };
  let kopfOrt = { anzahl: 0, verlasse() {} };
  // offenes Blatt: { id, huelle } (die Huelle haelt den Bereich, solange das Blatt offen ist)
  let blatt = null;
  // Profil oben (Ort ich:kopf, Paket sammlung), ohne Anbieter bleibt die Stelle leer
  try { kopfOrt = fuelle('ich:kopf', s.querySelector('.sa-kopf-ort'), { app }); } catch (e) { console.error(e); }
  s.querySelector('.sa-kopf-ort').hidden = !kopfOrt.anzahl;
  try { gefuellt = fuelle('sammlung:bereich', ort, { app }); } catch (e) { console.error(e); }
  const bereiche = () => [...ort.querySelectorAll(':scope > .sa-bereich'), ...(blatt ? blatt.huelle.querySelectorAll(':scope > .sa-bereich') : [])];

  // Ausruesten per Tipp: wahl() des Teils, dann Bereiche (und das Profil oben) an Ort und Stelle neu zeichnen; das offene
  // Blatt bekommt den neu gezeichneten Bereich
  function beiWahl(ev) {
    const b = ev.target.closest('.sa-wahl');
    const teil = b && b.closest('.sa-teil');
    const ber = teil && teil.closest('.sa-bereich');
    const wahl = ber && WAHLEN.get(ber)?.get(teil.dataset.teil);
    if (!wahl) return;
    try { wahl.fn(); } catch (e) { console.error(e); return; }
    const name = teil.querySelector('.sa-text b')?.textContent || '';
    try { app.meldung?.(t(wahl.ab ? 'rahmen.sammlung.ausgeschaltet' : 'rahmen.sammlung.ausgeruestet', { name })); } catch (e) { /* egal */ }
    zeichneNeu();
  }
  ort.addEventListener('click', beiWahl);
  // Ein Bereich bittet um sein Blatt zurueck (Shop nach dem Anprobieren: sheet() zeigt nur ein Blatt zugleich, die Vorschau
  // hat das Shop-Blatt geschlossen und der Bereich liegt wieder hier in .sa-ort)
  ort.addEventListener('sa:oeffne', (ev) => {
    const ber = ev.target.closest('.sa-bereich');
    if (ber && !blatt) oeffne(ber.dataset.bereich);
  });

  const stand = s.querySelector('.sa-stand');
  const zeigeStand = () => {
    const alle = bereiche();
    const teile = alle.reduce((n, x) => n + x.querySelectorAll('.sa-teil').length, 0);
    const frei = alle.reduce((n, x) => n + x.querySelectorAll('.sa-teil:not([data-zustand="zu"])').length, 0);
    stand.textContent = teile ? t('rahmen.sammlung.stand', { frei, alle: teile }) : t('rahmen.sammlung.leer');
    // Fortschritt als Balken unter der Zeile (Flo 30.10.: "21 von 67" sichtbar machen)
    stand.style.setProperty('--anteil', teile ? (frei / teile).toFixed(3) : '0');
  };

  // ein Platz: Bild und Name des Getragenen, "frei / alle", Pfeil
  function platzHtml(x, gross = false) {
    const teile = [...x.querySelectorAll('.sa-teil')];
    const frei = teile.filter((y) => y.dataset.zustand !== 'zu').length;
    // ohne Getragenes (z. B. Emote-Sticker, alle zugleich im Rad): das erste freie Stueck und die ersten zwei Namen
    const an = teile.find((y) => y.dataset.zustand === 'an');
    const freie = teile.filter((y) => y.dataset.zustand === 'frei');
    const vorne = an || freie[0];
    const bild = vorne ? vorne.querySelector('.sa-bild') : null;
    const kopie = bild ? bild.cloneNode(true) : null;
    if (kopie) for (const sch of kopie.querySelectorAll('.sa-schild')) sch.remove();
    const nameVon = (y) => y.querySelector('.sa-text b')?.textContent || '';
    const anName = an ? nameVon(an) : freie.length ? freie.slice(0, 2).map(nameVon).join(', ') + (freie.length > 2 ? ' …' : '') : '';
    const name = x.dataset.name || x.dataset.bereich;
    // Kundenblick 09.11.2026 (Befund 12): ohne Stuecke keine Zahl ("Shop 0 / 0"); der Shop zeigt trotzdem Hinweise
    // (ab 18, Konto) und Editionen vom Server, darum bleibt der Knopf
    const zahl = teile.length ? `${frei} / ${teile.length}` : '';
    const label = zahl ? t('rahmen.sammlung.platzLabel', { name, an: anName || t('rahmen.sammlung.nichts'), zahl }) : name;
    if (gross) {
      return `<button type="button" class="sa-gross" data-bereich="${esc(x.dataset.bereich)}" aria-haspopup="dialog" aria-label="${esc(label)}">
        <span class="sa-gross-name">${esc(name)}</span><small class="zahl">${esc(zahl)}</small>${icon('pfeil')}</button>`;
    }
    return `<button type="button" class="sa-platz" data-bereich="${esc(x.dataset.bereich)}" aria-haspopup="dialog" aria-label="${esc(label)}">
      <span class="sa-platz-bild" aria-hidden="true">${kopie ? kopie.innerHTML : ''}</span>
      <span class="sa-platz-text"><b>${esc(name)}</b><span>${esc(anName || t('rahmen.sammlung.nichts'))}</span></span>
      <small class="sa-platz-zahl zahl" aria-hidden="true">${esc(zahl)}</small>${icon('pfeil')}</button>`;
  }
  function zeichnePlaetze() {
    const alle = bereiche();
    const nachId = new Map(alle.map((x) => [x.dataset.bereich, x]));
    const vergeben = new Set(GROSS);
    const gruppen = PLAETZE.map((g) => ({ id: g.id, liste: g.bereiche.filter((id) => nachId.has(id)).map((id) => { vergeben.add(id); return nachId.get(id); }) }));
    // Bereiche ohne festen Platz (z. B. Erfinder, Lobby-Musik): am Ende von "Am Brett"
    gruppen[1].liste.push(...alle.filter((x) => !vergeben.has(x.dataset.bereich)));
    const gross = GROSS.filter((id) => nachId.has(id)).map((id) => nachId.get(id));
    platzOrt.innerHTML = gruppen.filter((g) => g.liste.length).map((g) => `<section class="sa-platz-gruppe" data-gruppe="${g.id}">
        <h3 class="sa-platz-titel">${esc(t('rahmen.sammlung.' + g.id))}</h3>
        <div class="sa-platz-liste">${g.liste.map((x) => platzHtml(x)).join('')}</div></section>`).join('')
      + (gross.length ? `<div class="sa-gross-reihe">${gross.map((x) => platzHtml(x, true)).join('')}</div>` : '');
  }
  platzOrt.addEventListener('click', (ev) => {
    const k = ev.target.closest('[data-bereich]');
    if (k) oeffne(k.dataset.bereich);
  });

  // Blatt eines Bereichs: der Bereich wandert hinein, beim Schliessen zurueck nach .sa-ort
  function oeffne(id) {
    const x = [...ort.querySelectorAll(':scope > .sa-bereich')].find((y) => y.dataset.bereich === id);
    if (!x) return;
    const huelle = document.createElement('div');
    huelle.className = 'sa-blatt-inhalt';
    huelle.addEventListener('click', beiWahl);
    x.hidden = false;
    huelle.append(x);
    blatt = { id, huelle };
    s.dataset.bereich = id;
    sheet({ titel: x.dataset.name || id, inhalt: huelle, klasse: 'sa-blatt', knoepfe: [{ text: t('rahmen.sammlung.fertig'), wert: true }], abbrechen: false })
      .then(() => {
        if (!blatt || blatt.huelle !== huelle) return;
        for (const y of huelle.querySelectorAll(':scope > .sa-bereich')) { y.hidden = true; ort.append(y); }
        blatt = null;
        s.dataset.bereich = '';
        zeichnePlaetze();
        zeigeStand();
      });
  }

  // Nach dem Ausruesten: Profil und Bereiche neu fuellen, die Scroll-Stelle bleibt; keine Einflug-Bewegung
  function zeichneNeu() {
    const rumpf = s.querySelector('.sa-rumpf');
    const oben = rumpf.scrollTop;
    try { kopfOrt.verlasse(); } catch (e) { console.error(e); }
    try { gefuellt.verlasse(); } catch (e) { console.error(e); }
    const kopfEl = s.querySelector('.sa-kopf-ort');
    kopfEl.replaceChildren();
    ort.replaceChildren();
    try { kopfOrt = fuelle('ich:kopf', kopfEl, { app }); } catch (e) { console.error(e); kopfOrt = { anzahl: 0, verlasse() {} }; }
    kopfEl.hidden = !kopfOrt.anzahl;
    try { gefuellt = fuelle('sammlung:bereich', ort, { app }); } catch (e) { console.error(e); gefuellt = { anzahl: 0, verlasse() {} }; }
    for (const x of ort.querySelectorAll(':scope > .sa-bereich')) x.hidden = true;
    if (blatt) {
      const x = [...ort.querySelectorAll(':scope > .sa-bereich')].find((y) => y.dataset.bereich === blatt.id);
      if (x) { x.hidden = false; blatt.huelle.replaceChildren(x); }
    }
    zeichnePlaetze();
    zeigeStand();
    rumpf.scrollTop = oben;
  }

  for (const x of ort.querySelectorAll(':scope > .sa-bereich')) x.hidden = true;
  zeichnePlaetze();
  zeigeStand();
  s.dataset.bereich = '';
  if (typeof params.bereich === 'string') requestAnimationFrame(() => oeffne(params.bereich));
  const oben = Number(params.oben);
  if (Number.isFinite(oben) && oben > 0) {
    const rumpf = s.querySelector('.sa-rumpf');
    rumpf.scrollTop = oben;
    // nach dem ersten Layout noch einmal (Bilder und Orte koennen die Hoehe erst dann setzen)
    requestAnimationFrame(() => { rumpf.scrollTop = oben; });
  }
  if (tempo() > 0 && !params.ruhig) {
    kopfEintritt(s);
    staffel(s.querySelectorAll('.seiten-kopf > *, .sa-stand, .sa-platz-gruppe, .sa-gross-reihe'), { d: 520, v: 60, abstand: 50 });
  }
  return {
    verlasse() {
      if (blatt) schliesseSheet();
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
