// Screen "lernen" (Paket lernen): Uebersicht der Meisterschule. Etappe 1 zeigt den Bereich Mattbilder mit seinen
// Lektionen (js/pakete/lernen/mattbilder.js): Nummer, kleines Brett, Titel, Stufe, Sterne; ein Tipp oeffnet die Lektion
// (Screen "lektion", params { id }). Darunter ein ruhiger Satz, welche Bereiche als Naechstes kommen.
// Nur im Labor (js/labor.js laborFrei); sonst still zur Arena wie ein fehlender Paket-Screen.
//
//   zeige(root, params, app) -> { verlasse() }
// DOM: section.screen.ms-screen > header.haupt-kopf, .ms-rumpf > .seiten-kopf, ol.ms-liste > li > button.ms-lektion[data-id]
// (.mini, .ms-nr, .ms-text > b + .ms-stufe[data-stufe], .ms-sterne[data-sterne]), p.ms-bald. Optik: css/pakete/lernen.css.
import { hauptKopf, seitenKopf, verbindeKopf, kopfEintritt } from './seite.js';
import { miniBrett } from './bauteile.js';
import { icon } from './icons.js';
import { staffel, tempo } from '../bewegung.js';
import { ladeModul } from '../storage.js';
import { laborFrei } from '../labor.js';
import { t } from '../sprache.js';
import { LEKTIONEN, stand, summe } from '../pakete/lernen/mattbilder.js';
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
  const sum = summe(st);
  s.innerHTML = `${hauptKopf({ zurueck: true, titelElement: 'div' })}
    <div class="ms-rumpf">
      ${seitenKopf({ ueber: S('name'), titel: S('bereich'), text: S('uebersichtText') })}
      <div class="ms-gesamt">${icon('stern')}<span>${esc(S('sterne', { n: sum.sterne, max: sum.max }))}</span></div>
      <ol class="ms-liste">${LEKTIONEN.map((l, i) => {
        const e = st.lek[l.id];
        return `<li><button class="ms-lektion" type="button" data-id="${l.id}"${e ? ' data-geschafft' : ''}>
          ${miniBrett(l.fen, { klasse: 'ms-mini' })}
          <span class="ms-nr zahl">${i + 1}</span>
          <span class="ms-text"><b>${esc(S('titel.' + l.id))}</b>
            <span class="ms-zeile"><span class="ms-stufe" data-stufe="${l.stufe}">${esc(S('stufe.' + l.stufe))}</span>
            ${e ? `<span class="ms-bestes">${esc(e.z === 1 ? S('bestesEins') : S('bestes', { n: e.z }))}</span>` : ''}</span></span>
          ${sterneHtml(e ? e.s : 0)}
          <span class="ms-pfeil" aria-hidden="true">${icon('vor')}</span></button></li>`;
      }).join('')}</ol>
      <p class="ms-bald">${esc(S('naechste', { liste: S('bereiche') }))}</p>
    </div>`;
  const kopf = verbindeKopf(s, app, { beiZurueck: () => app.zurueck(), beiEinstellungen: () => app.gehe('einstellungen') });
  s.querySelector('.ms-liste').addEventListener('click', (ev) => {
    const b = ev.target.closest('.ms-lektion');
    if (b) app.gehe('lektion', { id: b.dataset.id });
  });
  if (tempo() > 0) {
    kopfEintritt(s);
    staffel(s.querySelectorAll('.seiten-kopf > *, .ms-gesamt'), { d: 560, v: 60, abstand: 50 });
    staffel(s.querySelectorAll('.ms-liste > li'), { d: 620, v: 160, abstand: 45, von: 'translateY(18px)' });
  }
  return { verlasse() { kopf.verlasse(); } };
}
