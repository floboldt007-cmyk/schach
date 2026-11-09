// Screen "lernen" (Paket lernen): Uebersicht der Meisterschule. Oben vier Bereichskarten (Mattbilder, Taktik, Endspiele,
// Eroeffnungen; params { bereich }) mit Sternen, Balken und Zahl der Gratis-Lektionen, darunter die Lektionen des
// Bereichs nach Stufe gruppiert (js/pakete/lernen/mattbilder.js BEREICHE): Nummer, kleines Brett, Titel, Stufe, bei
// Endspielen die Art, Sterne. Seit 07.11.2026 fuer alle (FAHRPLAN Abschnitt 6, js/pakete/lernen/zugang.js): Gratis-Lektionen
// oeffnen die Lektion (Screen "lektion", params { id }); Abo-Lektionen bleiben sichtbar, mit Schloss statt Sternen, und ein
// Tipp darauf zeigt den ruhigen Trainer-Hinweis (js/abo.js premiumHinweis: nur als Antwort auf einen Tipp, nie von selbst).
// Der Kopf zeigt die Sterne der Meisterschule statt der Arena-Zaehler. In der Willkommenswoche (zugang.js) ist alles offen,
// die Trainer-Lektionen tragen weiter ihre Marke, und eine Zeile p.ms-willkommen nennt das Datum, bis wann.
//
//   zeige(root, params, app) -> { verlasse() }
// DOM: section.screen.ms-screen > header.haupt-kopf, .ms-rumpf > .ms-bereiche > button.ms-bkarte[data-bereich][aria-pressed],
// .ms-bereich > .seiten-kopf, .ms-gruppe[data-stufe] > h3 + ol.ms-liste > li > button.ms-lektion[data-id]
// [data-geschafft][data-gesperrt][data-probe] (.mini, .ms-nr, .ms-text > b + .ms-zeile > .ms-stufe[data-stufe] + .ms-art[data-art]
// + .ms-marke, .ms-sterne[data-sterne] | .ms-schloss), p.ms-bald. Optik: css/pakete/lernen.css.
import { hauptKopf, seitenKopf, verbindeKopf, kopfEintritt } from './seite.js';
import { miniBrett } from './bauteile.js';
import { icon } from './icons.js';
import { staffel, tempo } from '../bewegung.js';
import { ladeModul } from '../storage.js';
import { t, datum } from '../sprache.js';
import { istPremium, premiumHinweis } from '../abo.js';
import { BEREICHE, artVon, stand, summe } from '../pakete/lernen/mattbilder.js';
import { istOffen, istGratis, istProbe, istImTrainer, inWillkommenswoche, willkommenBis } from '../pakete/lernen/zugang.js';
import { ladeLernenCss, PAKET } from '../pakete/lernen/index.js';
import '../sprachen/allgemein.js';
import '../sprachen/rahmen.js';

const S = (k, w) => t('p-lernen.' + k, w);
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Gruppen der Liste: Meister steht mit Schwer zusammen (nur eine Lektion)
const GRUPPEN = [['leicht', ['leicht']], ['mittel', ['mittel']], ['schwer', ['schwer', 'meister']]];

export const sterneHtml = (n) => `<span class="ms-sterne" data-sterne="${n}" role="img" aria-label="${esc(S('sterne', { n, max: 3 }))}">`
  + [1, 2, 3].map((i) => `<i class="${i <= n ? 'an' : ''}">${icon('stern')}</i>`).join('') + '</span>';

const kopfChip = (sum) => `<span class="chip zahl chip-sterne ms-kopf-sterne" title="${esc(S('sterne', { n: sum.sterne, max: sum.max }))}">${icon('stern', 'stern')}`
  + `<span class="sr">${esc(S('sterne', { n: sum.sterne, max: sum.max }))}</span> ${sum.sterne}<span class="von"> / ${sum.max}</span></span>`;

export function zeige(root, params, app) {
  const s = document.createElement('section');
  s.className = 'screen ms-screen';
  s.setAttribute('aria-label', S('name'));
  root.append(s);
  ladeLernenCss();
  const st = stand(ladeModul(PAKET, {}));
  let bereich = BEREICHE.find((b) => b.id === (params && params.bereich)) || BEREICHE[0];
  s.innerHTML = `${hauptKopf({ zurueck: true, titelElement: 'div', seite: S('name'), chips: kopfChip(summe(st)) })}
    <div class="ms-rumpf">
      <div class="ms-bereiche" role="group" aria-label="${esc(S('bereichWahl'))}"></div>
      <div class="ms-bereich"></div>
      <p class="ms-bald">${esc(S('naechste', { liste: S('bereiche') }))}</p>
    </div>`;
  const karten = s.querySelector('.ms-bereiche');
  // Willkommenswoche: eine ruhige Zeile mit dem Datum (kein Countdown), unter den Bereichskarten
  const woche = inWillkommenswoche();
  if (woche) {
    const p = document.createElement('p');
    p.className = 'ms-willkommen';
    p.innerHTML = `${icon('stern')}<span></span>`;
    const [j, m, tg] = willkommenBis().split('-').map(Number);
    p.querySelector('span').textContent = S('willkommen', { datum: datum(new Date(j, m - 1, tg, 12), { weekday: 'long', day: 'numeric', month: 'numeric' }) });
    karten.after(p);
  }
  const inhalt = s.querySelector('.ms-bereich');

  function zeichneKarten() {
    karten.innerHTML = BEREICHE.map((b) => {
      const sum = summe(st, b.id);
      const anteil = sum.max ? Math.round((sum.sterne / sum.max) * 100) : 0;
      const gratis = b.lektionen.filter(istGratis).length;
      return `<button class="ms-bkarte dr" type="button" data-bereich="${b.id}" aria-pressed="${b === bereich}">
        <b>${esc(S('bereich.' + b.id))}</b>
        <span class="ms-bk-zeile"><span class="ms-bk-sterne zahl">${icon('stern')}${sum.sterne}<span class="von"> / ${sum.max}</span></span>
          <span class="ms-bk-gratis">${esc(S('gratisZahl', { n: gratis }))}</span></span>
        <span class="ms-bk-balken" aria-hidden="true"><i style="width:${anteil}%"></i></span></button>`;
    }).join('');
  }

  // mitStufe: das Stufen-Schild nur, wo die Gruppe mehrere Stufen mischt (Schwer und Meister); sonst nennt sie die Ueberschrift
  function zeile(l, i, mitStufe) {
    const e = st.lek[l.id];
    const art = artVon(l);
    const offen = istOffen(l);
    const bestes = !e ? '' : art === 'halten' ? S('gehalten') : e.z === 1 ? S('bestesEins') : S('bestes', { n: e.z });
    // "Trainer" auch in der Willkommenswoche: man soll wissen, was man gerade geschenkt bekommt
    const marke = istImTrainer(l) && (!offen || woche) ? `<span class="ms-marke" data-marke="trainer">${esc(S('trainer'))}</span>`
      : istProbe(l) && l.stufe !== 'leicht' ? `<span class="ms-marke" data-marke="probe">${esc(S('gratisProbe'))}</span>` : '';
    return `<li><button class="ms-lektion" type="button" data-id="${l.id}"${e ? ' data-geschafft' : ''}${offen ? '' : ' data-gesperrt'}${istProbe(l) ? ' data-probe' : ''}
        ${offen ? '' : `aria-label="${esc(S('titel.' + l.id) + ', ' + S('gesperrt'))}"`}>
      ${miniBrett(l.fen, { klasse: 'ms-mini' })}
      <span class="ms-nr zahl">${i + 1}</span>
      <span class="ms-text"><b>${esc(S('titel.' + l.id))}</b>
        <span class="ms-zeile">${mitStufe ? `<span class="ms-stufe" data-stufe="${l.stufe}">${esc(S('stufe.' + l.stufe))}</span>` : ''}
        ${art !== 'matt' ? `<span class="ms-art" data-art="${art}">${esc(S('art.' + art))}</span>` : ''}
        ${marke}${bestes ? `<span class="ms-bestes">${esc(bestes)}</span>` : ''}</span></span>
      ${offen ? sterneHtml(e ? e.s : 0) : `<span class="ms-schloss" aria-hidden="true">${icon('schloss')}</span>`}
      <span class="ms-pfeil" aria-hidden="true">${icon('vor')}</span></button></li>`;
  }

  function zeichne(erstes) {
    const nr = (l) => bereich.lektionen.indexOf(l);
    inhalt.innerHTML = `${seitenKopf({ ueber: S('name'), titel: S('bereich.' + bereich.id), text: S('text.' + bereich.id) })}
      ${GRUPPEN.map(([id, stufen]) => {
        const liste = bereich.lektionen.filter((l) => stufen.includes(l.stufe));
        if (!liste.length) return '';
        return `<section class="ms-gruppe" data-stufe="${id}"><h3>${esc(S('gruppe.' + id))}</h3>
          <ol class="ms-liste">${liste.map((l) => zeile(l, nr(l), stufen.length > 1)).join('')}</ol></section>`;
      }).join('')}`;
    if (tempo() > 0) {
      if (erstes) staffel(inhalt.querySelectorAll('.seiten-kopf > *'), { d: 560, v: 60, abstand: 50 });
      staffel(inhalt.querySelectorAll('.ms-liste > li'), { d: 620, v: erstes ? 160 : 0, abstand: erstes ? 30 : 18, von: 'translateY(18px)' });
    }
  }

  function waehle(id) {
    const neu = BEREICHE.find((b) => b.id === id);
    if (!neu || neu === bereich) return;
    bereich = neu;
    for (const k of karten.querySelectorAll('.ms-bkarte')) k.setAttribute('aria-pressed', String(k.dataset.bereich === id));
    zeichne(false);
    // die Wahl bleibt im Verlauf (Zurueck aus einer Lektion landet im selben Bereich); der Hash bleibt #lernen
    try {
      const h = history.state;
      if (h && h.schach && h.name === 'lernen') history.replaceState({ ...h, params: { ...(h.params || {}), bereich: bereich.id } }, '', location.hash);
    } catch (e) { /* egal */ }
  }

  zeichneKarten();
  zeichne(true);
  const kopf = verbindeKopf(s, app, { beiZurueck: () => app.zurueck(), beiEinstellungen: () => app.gehe('einstellungen') });
  karten.addEventListener('click', (ev) => {
    const k = ev.target.closest('.ms-bkarte');
    if (k) waehle(k.dataset.bereich);
  });
  inhalt.addEventListener('click', (ev) => {
    const b = ev.target.closest('.ms-lektion');
    if (!b) return;
    if (!b.hasAttribute('data-gesperrt')) { app.gehe('lektion', { id: b.dataset.id }); return; }
    // gesperrt: der ruhige Trainer-Hinweis direkt unter der Zeile (ersetzt einen vorigen)
    for (const alt of inhalt.querySelectorAll('.premium-hinweis')) alt.remove();
    premiumHinweis(b.parentElement, S('abo.was'), { app });
  });

  // Premium kann sich aendern (Abgleich mit dem Server, Kauf): dann die Schloesser neu zeichnen
  let weg = false;
  const gesperrt = () => BEREICHE.flatMap((b) => b.lektionen).filter((l) => !istOffen(l)).length;
  let zuletzt = gesperrt();
  const neuZeichnen = () => {
    if (weg) return;
    const jetzt = gesperrt();
    if (jetzt === zuletzt) return;
    zuletzt = jetzt;
    zeichne(false);
  };
  const beiStand = () => neuZeichnen();
  document.addEventListener('abo:stand', beiStand);
  istPremium().then(neuZeichnen).catch(() => {});
  if (tempo() > 0) kopfEintritt(s);
  return { verlasse() { weg = true; document.removeEventListener('abo:stand', beiStand); kopf.verlasse(); } };
}
