// Screen "lernen" (Paket lernen): Uebersicht der Meisterschule. Oben die Bereichswahl (Mattbilder, Endspiele; params
// { bereich }), darunter die Lektionen des Bereichs (js/pakete/lernen/mattbilder.js BEREICHE): Nummer, kleines Brett,
// Titel, Stufe, bei Endspielen die Art (Umwandeln, Gewinnen, Halten), Sterne; ein Tipp oeffnet die Lektion (Screen
// "lektion", params { id }). Darunter ein ruhiger Satz, welche Bereiche als Naechstes kommen.
// Nur im Labor (js/labor.js laborFrei); sonst still zur Arena wie ein fehlender Paket-Screen.
//
//   zeige(root, params, app) -> { verlasse() }
// DOM: section.screen.ms-screen > header.haupt-kopf, .ms-rumpf > .ms-steuer > .segment[data-seg="ms-bereich"],
// .seiten-kopf, .ms-gesamt, ol.ms-liste > li > button.ms-lektion[data-id] (.mini, .ms-nr, .ms-text > b + .ms-zeile >
// .ms-stufe[data-stufe] + .ms-art[data-art], .ms-sterne[data-sterne]), p.ms-bald. Optik: css/pakete/lernen.css.
import { hauptKopf, seitenKopf, verbindeKopf, kopfEintritt } from './seite.js';
import { miniBrett, segment } from './bauteile.js';
import { icon } from './icons.js';
import { staffel, tempo } from '../bewegung.js';
import { ladeModul } from '../storage.js';
import { laborFrei } from '../labor.js';
import { t } from '../sprache.js';
import { BEREICHE, artVon, stand, summe } from '../pakete/lernen/mattbilder.js';
import { ladeLernenCss, PAKET } from '../pakete/lernen/index.js';
import '../sprachen/allgemein.js';
import '../sprachen/rahmen.js';

const S = (k, w) => t('p-lernen.' + k, w);
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const sterneHtml = (n) => `<span class="ms-sterne" data-sterne="${n}" role="img" aria-label="${esc(S('sterne', { n, max: 3 }))}">`
  + [1, 2, 3].map((i) => `<i class="${i <= n ? 'an' : ''}">${icon('stern')}</i>`).join('') + '</span>';

export function zeige(root, params, app) {
  const s = document.createElement('section');
  s.className = 'screen ms-screen';
  s.setAttribute('aria-label', S('name'));
  root.append(s);
  if (!laborFrei()) {
    let weg = false;
    setTimeout(() => { if (!weg) app.gehe('arena', {}, { ersetzen: true }); }, 0);
    return { verlasse() { weg = true; } };
  }
  ladeLernenCss();
  const st = stand(ladeModul(PAKET, {}));
  let bereich = BEREICHE.find((b) => b.id === (params && params.bereich)) || BEREICHE[0];
  s.innerHTML = `${hauptKopf({ zurueck: true, titelElement: 'div', seite: S('name') })}
    <div class="ms-rumpf">
      <div class="ms-steuer"></div>
      <div class="ms-bereich"></div>
      <p class="ms-bald">${esc(S('naechste', { liste: S('bereiche') }))}</p>
    </div>`;
  const inhalt = s.querySelector('.ms-bereich');
  function zeichne(erstes) {
    const sum = summe(st, bereich.id);
    inhalt.innerHTML = `${seitenKopf({ ueber: S('name'), titel: S('bereich.' + bereich.id), text: S('text.' + bereich.id) })}
      <div class="ms-gesamt">${icon('stern')}<span>${esc(S('sterne', { n: sum.sterne, max: sum.max }))}</span></div>
      <ol class="ms-liste">${bereich.lektionen.map((l, i) => {
        const e = st.lek[l.id];
        const art = artVon(l);
        const bestes = !e ? '' : art === 'halten' ? S('gehalten') : e.z === 1 ? S('bestesEins') : S('bestes', { n: e.z });
        return `<li><button class="ms-lektion" type="button" data-id="${l.id}"${e ? ' data-geschafft' : ''}>
          ${miniBrett(l.fen, { klasse: 'ms-mini' })}
          <span class="ms-nr zahl">${i + 1}</span>
          <span class="ms-text"><b>${esc(S('titel.' + l.id))}</b>
            <span class="ms-zeile"><span class="ms-stufe" data-stufe="${l.stufe}">${esc(S('stufe.' + l.stufe))}</span>
            ${art !== 'matt' ? `<span class="ms-art" data-art="${art}">${esc(S('art.' + art))}</span>` : ''}
            ${bestes ? `<span class="ms-bestes">${esc(bestes)}</span>` : ''}</span></span>
          ${sterneHtml(e ? e.s : 0)}
          <span class="ms-pfeil" aria-hidden="true">${icon('vor')}</span></button></li>`;
      }).join('')}</ol>`;
    if (tempo() > 0) {
      if (erstes) staffel(inhalt.querySelectorAll('.seiten-kopf > *, .ms-gesamt'), { d: 560, v: 60, abstand: 50 });
      staffel(inhalt.querySelectorAll('.ms-liste > li'), { d: 620, v: erstes ? 160 : 0, abstand: erstes ? 45 : 25, von: 'translateY(18px)' });
    }
  }
  const seg = segment({ name: 'ms-bereich', label: S('bereichWahl'), wert: bereich.id,
    optionen: BEREICHE.map((b) => ({ id: b.id, text: S('bereich.' + b.id) })),
    beiWahl: (id) => {
      bereich = BEREICHE.find((b) => b.id === id) || BEREICHE[0];
      zeichne(false);
      // die Wahl bleibt im Verlauf (Zurueck aus einer Lektion landet im selben Bereich); der Hash bleibt #lernen
      try {
        const h = history.state;
        if (h && h.schach && h.name === 'lernen') history.replaceState({ ...h, params: { ...(h.params || {}), bereich: bereich.id } }, '', location.hash);
      } catch (e) { /* egal */ }
    } });
  s.querySelector('.ms-steuer').append(seg.el);
  zeichne(true);
  const kopf = verbindeKopf(s, app, { beiZurueck: () => app.zurueck(), beiEinstellungen: () => app.gehe('einstellungen') });
  inhalt.addEventListener('click', (ev) => {
    const b = ev.target.closest('.ms-lektion');
    if (b) app.gehe('lektion', { id: b.dataset.id });
  });
  if (tempo() > 0) kopfEintritt(s);
  return { verlasse() { kopf.verlasse(); } };
}
