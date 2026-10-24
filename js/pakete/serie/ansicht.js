// Oberflaeche des Pakets serie (Bauernmarsch und Siegeslauf, Look A, Klassen se-*, Optik in css/pakete/serie.css).
// Nur DOM, keine Buchungen: index.js liest den Stand (stand.js, tag.js) und reicht ihn herein. Bewegung nur ueber
// transform und opacity mit anim() aus js/bewegung.js; bei reduzierter Bewegung steht sofort das Endbild, der Klang bleibt.
// Texte: nie "0" fuer eine ruhende Serie, nie "am Stueck", keine Warnung vorher (SPIELKONZEPT 3.14 Regeln 4, 8, 9).
//
//   streifenHtml({ feld, heute, umwandlung, klein }) -> HTML      Bauernmarsch als Reihe: Startfeld, 5 Felder, Umwandlungsfeld
//   kopfChip({ lage, lauf, ring, leise, beiTipp }) -> { el, verlasse() }   .se-chip[role=button] "Bauer 12", ruhend "Bauer ruht" (grau),
//       leise (nach Tag 66, auf Wunsch): Wochen-Ring; Flamme mit Zahl ab 3 Siegen in Folge
//   heuteZeile({ lage, st, einst, ring, training, beiTraining, beiWahl, beiBlatt, beiLeise, texte }) -> HTMLElement
//   abrechnungsZeile({ e, schonGezeigt, merke, stumm }) -> { el, beende(), verlasse() } | null   div.se-abr[data-zeile="serie"];
//       stumm: boolean oder Funktion (beim Schritt gefragt): true = kein Klang "bauer" (der grosse Moment klingt selbst)
//   flamme({ n }) -> HTMLElement                         Flamme mit Zahl an Flos Namen (partie:spieler-leiste)
//   blattInhalt({ ... }) -> HTMLElement                  Serien-Blatt (Kopf, Bauernmarsch, Kalender, Ring, Kapitel, Lauf, Regeln)
//   oeffneBlatt(inhalt, { titel }) -> { schliesse() }, schliesseBlatt()
//   einstellungsGruppe({ einst, beiAenderung }) -> HTMLElement   Gruppe "Bauernmarsch" (einstellungen:gruppen)
//   umwandlungAnimation(el)
import { anim, tempo } from '../../bewegung.js';
import { klang } from '../../sounds.js';
import { icon } from '../../ui/icons.js';
import { wochentag } from '../../tag.js';
import { t, zahl as zahlFormat } from '../../sprache.js';
import '../../sprachen/allgemein.js';
import * as T from './tag.js';
import * as LA from './lauf.js';
import './texte.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const zahl = (n) => zahlFormat(Math.round(Number(n) || 0));
const figurBild = (f) => new URL(`../../../assets/pieces/w${f === 'S' ? 'N' : f === 'L' ? 'B' : f === 'T' ? 'R' : f === 'D' ? 'Q' : 'P'}.svg`, import.meta.url).href;
// Wochentage (0 = Montag) in der eingestellten Sprache: Listen mit Gettern, gelesen erst beim Zeichnen
function tageListe(art) {
  const l = [];
  for (let i = 0; i < 7; i++) Object.defineProperty(l, i, { get: () => t(`p-serie.${art}.${i}`), enumerable: true });
  return Object.freeze(l);
}
const WOCHENTAGE = tageListe('wochentag');
const KURZ = tageListe('kurz');

function el(tag, klasse, html) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (html != null) e.innerHTML = html;
  return e;
}

export function schachtage(n) {
  return t('p-serie.schachtage', { n: Math.round(Number(n) || 0) });
}
export function bisText(n) {
  return t('p-serie.bis', { n });
}
export function laufText(n) {
  return t('p-serie.lauf', { n });
}
export function endeText(n, rekord) {
  return t('p-serie.lauf.ende', { n, rekord });
}

// ---------- Bauernmarsch-Streifen ----------
// 7 Felder: 0 = Startfeld, 1..5, 6 = Umwandlungsfeld. heute: 'gezaehlt' (Feld des Bauern hervorgehoben) oder 'offen'
// (das naechste Feld gestrichelt: hier landet der Bauer mit dem Tageswerk)
export function streifenHtml({ feld = 0, heute = null, umwandlung = false, klein = false, label = '' } = {}) {
  const pos = umwandlung ? T.FELDER : Math.max(0, Math.min(T.FELDER, feld));
  let zellen = '';
  for (let i = 0; i <= T.FELDER; i++) {
    const klassen = ['se-feld', i % 2 ? 'd' : 'h'];
    if (i === T.FELDER) klassen.push('ziel');
    if (heute === 'gezaehlt' && i === pos) klassen.push('heute');
    if (heute === 'offen' && i === pos + 1) klassen.push('naechstes');
    // Umwandlungsfeld: blasse Dame als Ziel
    zellen += `<i class="${klassen.join(' ')}">${i === T.FELDER ? `<img class="se-krone" src="${esc(figurBild('D'))}" alt="" draggable="false">` : ''}</i>`;
  }
  return `<span class="se-streifen${klein ? ' klein' : ''}" role="img" aria-label="${esc(label || t('p-serie.streifen.feld', { pos, max: T.FELDER }))}" style="--feld:${pos}">`
    + `${zellen}<img class="se-bauer" src="${esc(figurBild('P'))}" alt="" draggable="false"></span>`;
}

// ---------- Kopf-Chip ----------
export function kopfChip({ lage, lauf = { n: 0 }, ring = null, leise = false, beiTipp } = {}) {
  const b = el('span', 'chip se-chip dr');
  b.setAttribute('role', 'button');
  b.tabIndex = 0;
  b.dataset.paket = 'serie';
  const ruht = lage.art === 'ruht';
  b.dataset.ruht = ruht ? '1' : '0';
  b.dataset.serie = String(lage.aktuell);
  const flamme = lauf && lauf.n >= LA.FLAMME_AB;
  let inhalt;
  let label;
  if (leise && ring && !ruht) {
    inhalt = `${icon('se-ring', 'se-ico')}<b class="zahl">${ring.n}</b>`;
    label = t('p-serie.chip.ring', { n: ring.n, schachtage: schachtage(lage.aktuell) });
  } else if (ruht) {
    inhalt = `${icon('se-bauer', 'se-ico')}<span class="se-chip-ruht">${esc(t('p-serie.ruht'))}</span>`;
    label = t('p-serie.chip.ruht', { best: lage.best, kapitel: lage.naechstesKapitel });
  } else {
    inhalt = `${icon('se-bauer', 'se-ico')}<b class="zahl">${lage.aktuell}</b>`;
    label = t('p-serie.chip.laeuft', { schachtage: schachtage(lage.aktuell), best: lage.best });
  }
  if (flamme) {
    inhalt += `<span class="se-chip-flamme">${icon('se-flamme', 'se-ico')}<b class="zahl">${lauf.n}</b></span>`;
    label += '. ' + t('p-serie.lauf.label', { lauf: laufText(lauf.n) });
    b.dataset.lauf = String(lauf.n);
  }
  b.innerHTML = inhalt;
  b.title = label;
  b.setAttribute('aria-label', label);
  if (typeof beiTipp === 'function') {
    b.addEventListener('click', beiTipp);
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      beiTipp(e);
    });
  }
  return { el: b, verlasse() {} };
}

export function flamme({ n } = {}) {
  const s = el('span', 'se-spieler-flamme', `${icon('se-flamme', 'se-ico')}<b class="zahl">${n}</b>`);
  s.dataset.paket = 'serie';
  s.title = t('p-serie.lauf.label', { lauf: laufText(n) });
  s.setAttribute('aria-label', t('p-serie.lauf.label', { lauf: laufText(n) }));
  return s;
}

// ---------- Heute-Karte ----------
export function heuteZeile({ lage, st, einst = {}, training = false, beiTraining, beiWahl, beiBlatt, beiLeise, texte = {} } = {}) {
  const z = el('div', 'se-heute');
  z.dataset.paket = 'serie';
  z.dataset.art = lage.art;
  const heuteArt = lage.heuteGezaehlt ? 'gezaehlt' : 'offen';
  let titel;
  if (lage.art === 'neu') titel = `<b>${esc(t('p-serie.name'))}</b>`;
  else if (lage.art === 'ruht') titel = `<b>${esc(t('p-serie.heute.ruht'))}</b> · ${esc(t('p-serie.rekord', { wert: zahl(lage.best) }))}`;
  else titel = `<b>${esc(t('p-serie.tag', { wert: zahl(lage.aktuell) }))}</b> · ${esc(t('p-serie.name'))}`;
  z.innerHTML = `<div class="se-h-zeile"><button class="se-h-titel" type="button" aria-label="${esc(t('p-serie.heute.blatt'))}">`
    + `<span class="se-h-symbol" aria-hidden="true">${icon('se-bauer', 'se-ico')}</span><span class="se-h-text">${titel}</span></button>`
    + `${streifenHtml({ feld: lage.feld, heute: lage.art === 'ruht' && !lage.heuteGezaehlt ? null : heuteArt,
      label: lage.art === 'neu' ? t('p-serie.streifen.start') : t('p-serie.streifen.text', { text: bisText(lage.bisUmwandlung) }) })}</div>`;
  const status = el('p', 'se-h-status');
  if (lage.heuteGezaehlt) status.textContent = t('p-serie.heute.geschafft');
  else if (lage.pause) status.textContent = t('p-serie.heute.pause');
  else if (lage.ruhetag) status.textContent = t('p-serie.heute.ruhetag');
  else status.textContent = t('p-serie.heute.offen');
  z.append(status);
  const detail = el('p', 'se-h-detail');
  if (lage.art === 'neu') detail.textContent = t('p-serie.heute.neu');
  else if (lage.art === 'ruht') detail.textContent = t('p-serie.heute.ruhtDetail', { kapitel: lage.naechstesKapitel });
  else if (lage.gesternBruecke && !lage.heuteGezaehlt) detail.textContent = t('p-serie.heute.bruecke', { schachtage: schachtage(lage.aktuell) });
  else detail.textContent = bisText(lage.bisUmwandlung);
  z.append(detail);
  if (!lage.heuteGezaehlt && !lage.pause && training && typeof beiTraining === 'function') {
    const k = el('button', 'knopf se-h-training dr', esc(t('p-serie.heute.training')));
    k.type = 'button';
    k.setAttribute('aria-label', t('p-serie.heute.trainingLabel'));
    k.addEventListener('click', beiTraining);
    z.append(k);
  }
  for (const [art, text] of Object.entries(texte)) {
    if (!text) continue;
    const p = el('p', 'se-h-hinweis');
    p.dataset.hinweis = art;
    p.textContent = text;
    z.append(p);
    if (art === 'gewohnheit' && typeof beiLeise === 'function' && !einst.leise) {
      const k = el('button', 'knopf se-h-leise dr', esc(t('p-serie.heute.leise')));
      k.type = 'button';
      k.addEventListener('click', () => beiLeise(k));
      z.append(k);
    }
  }
  if (lage.offeneWahl > 0 && typeof beiWahl === 'function') z.append(wahlBlock({ beiWahl, nr: offeneNr(st) }));
  const titelKnopf = z.querySelector('.se-h-titel');
  if (typeof beiBlatt === 'function') titelKnopf.addEventListener('click', beiBlatt);
  return z;
}

function offeneNr(st) {
  const i = st.figuren.indexOf('?');
  return i < 0 ? null : st.bretter * T.BRETT + i + 1;
}

function wahlBlock({ beiWahl, nr }) {
  const w = el('div', 'se-wahl');
  w.setAttribute('role', 'group');
  w.setAttribute('aria-label', t('p-serie.wahl.label'));
  w.innerHTML = `<p class="se-wahl-text">${esc(nr ? t('p-serie.wahl.textNr', { nr }) : t('p-serie.wahl.text'))}</p><div class="se-wahl-knoepfe"></div>`;
  const reihe = w.querySelector('.se-wahl-knoepfe');
  for (const [f, name] of Object.entries(T.FIGUREN)) {
    const k = el('button', 'se-wahl-knopf dr', `<img src="${esc(figurBild(f))}" alt=""><span>${esc(name)}</span>`);
    k.type = 'button';
    k.dataset.figur = f;
    k.setAttribute('aria-label', t('p-serie.wahl.figur', { name }));
    k.addEventListener('click', () => beiWahl(f, w));
    reihe.append(k);
  }
  return w;
}

export function umwandlungAnimation(ziel) {
  if (!ziel) return;
  anim(ziel, [{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }], { d: 520, k: 'hupf' });
}

// ---------- Abrechnung ----------
// e = { id, t (Tag oder null), fv (Felder vorher), f (Felder nachher), u (Umwandlungen), m (Meilenstein), d (Doppelschritt),
//       l (Siegeslauf nach einem Sieg oder null), e (beendet bei n oder null), b (Rekord) }
export function abrechnungsZeile({ e, schonGezeigt = false, merke = () => {}, stumm = false } = {}) {
  const mitTag = Number.isInteger(e.t);
  const mitLauf = Number.isInteger(e.l) && e.l >= 2;
  const mitEnde = Number.isInteger(e.e) && e.e >= LA.FLAMME_AB;
  const zeile = el('div', 'se-abr');
  zeile.dataset.zeile = 'serie';
  zeile.dataset.paket = 'serie';
  if (e.u) zeile.dataset.umwandlung = String(e.u);
  if (mitLauf) zeile.dataset.lauf = String(e.l);
  const umw = e.u > 0;
  const posVorher = e.fv % T.FELDER;
  const posNachher = umw ? T.FELDER : e.f % T.FELDER;
  let kopf;
  let unter = '';
  if (mitTag) {
    kopf = `<span class="se-label">${esc(t('p-serie.abr.serie'))}</span><b class="se-abr-wert">${esc(t('p-serie.tag', { wert: zahl(e.t) }))} · ${esc(t('p-serie.name'))}</b>`;
    if (umw) unter = t('p-serie.abr.umwandlung');
    else unter = (e.d ? t('p-serie.doppelKurz') + ' ' : '') + bisText(T.FELDER - (e.f % T.FELDER));
  } else {
    kopf = `<span class="se-label">${esc(t('p-serie.lauf.name'))}</span><b class="se-abr-wert">${mitLauf ? esc(laufText(e.l)) : esc(t('p-serie.lauf.beendet'))}</b>`;
  }
  let lauf = '';
  if (mitTag && mitLauf) lauf = `<span class="se-abr-lauf"${e.l >= LA.FLAMME_AB ? ' data-flamme="1"' : ''}>${e.l >= LA.FLAMME_AB ? icon('se-flamme', 'se-ico') : ''}${esc(laufText(e.l))}</span>`;
  else if (!mitTag && mitLauf && e.l >= LA.FLAMME_AB) kopf = `<span class="se-label">${esc(t('p-serie.lauf.name'))}</span><b class="se-abr-wert">${icon('se-flamme', 'se-ico')}${esc(laufText(e.l))}</b>`;
  if (mitEnde) lauf += `<span class="se-abr-ende">${esc(endeText(e.e, e.b))}</span>`;
  zeile.innerHTML = `<span class="se-abr-symbol" aria-hidden="true">${icon(mitTag ? 'se-bauer' : 'se-flamme', 'se-ico')}</span>`
    + `<span class="se-abr-mitte"><span class="se-abr-kopf">${kopf}</span>${unter ? `<span class="se-abr-unter">${esc(unter)}</span>` : ''}${lauf}</span>`
    + (mitTag ? streifenHtml({ feld: schonGezeigt ? posNachher : posVorher, heute: 'gezaehlt', klein: true, umwandlung: false,
      label: umw ? t('p-serie.streifen.umwandlung') : t('p-serie.streifen.text', { text: bisText(T.FELDER - (e.f % T.FELDER)) }) }) : '');
  if (!mitTag && !mitLauf && !mitEnde) return null;
  const uhren = new Set();
  const spaeter = (fn, t) => { const u = setTimeout(() => { uhren.delete(u); fn(); }, Math.max(0, t)); uhren.add(u); return u; };
  const streifen = zeile.querySelector('.se-streifen');
  let fertig = schonGezeigt || !mitTag;
  if (fertig) zeile.dataset.fertig = '1';
  function endbild() {
    if (!streifen) return;
    try { for (const a of zeile.getAnimations({ subtree: true })) a.cancel(); } catch (x) { /* aeltere Browser */ }
    streifen.style.setProperty('--feld', String(posNachher));
    for (const f of streifen.querySelectorAll('.se-feld')) f.classList.toggle('heute', [...streifen.children].indexOf(f) === posNachher);
    zeile.dataset.fertig = '1';
  }
  function beende() {
    if (fertig) return;
    fertig = true;
    for (const u of uhren) clearTimeout(u);
    uhren.clear();
    endbild();
  }
  if (!fertig) {
    merke();
    spaeter(() => {
      const t0 = parseInt(zeile.style.getPropertyValue('--t'), 10) || 300;
      const f = tempo();
      // Klang "bauer" zum Schritt; steht der grosse Moment (Umwandlung, Meilenstein) im Ergebnis, klingt er dort
      const spiel = () => {
        const still = typeof stumm === 'function' ? stumm() : stumm;
        if (!still) { try { klang.spiele('bauer'); } catch (x) { /* still */ } }
      };
      if (f === 0) {
        endbild();
        fertig = true;
        spaeter(spiel, t0);
        return;
      }
      const bauer = streifen.querySelector('.se-bauer');
      const schritt = posNachher - posVorher;
      spaeter(() => {
        if (fertig) return;
        // Bauer gleitet Feld um Feld (transform), danach steht das Endbild per --feld (Lage ueber left, nicht animiert)
        const zelle = streifen.querySelector('.se-feld').getBoundingClientRect().width || 18;
        const a = anim(bauer, [{ transform: 'translateX(0)' }, { transform: `translateX(${(zelle * schritt).toFixed(1)}px)` }],
          { d: 420 + 120 * Math.max(0, schritt - 1), k: 'feder', fill: 'forwards' });
        spiel();
        Promise.resolve(a && a.finished).catch(() => {}).then(() => { if (!fertig) { fertig = true; endbild(); } });
        spaeter(() => { if (!fertig) { fertig = true; endbild(); } }, (700 + 120 * schritt) * f + 80);
      }, t0 + 200);
    }, 0);
  }
  return {
    el: zeile,
    beende,
    verlasse() {
      for (const u of uhren) clearTimeout(u);
      uhren.clear();
    },
  };
}

// ---------- Serien-Blatt ----------
// Text zur Art eines Kalendertags (zukunft und vorher: leer)
const ART_TEXT = new Set(['gezaehlt', 'reise', 'bruecke', 'ruhetag', 'pause', 'leer', 'offen']);
function artText(art) {
  return ART_TEXT.has(art) ? t('p-serie.art.' + art) : '';
}
function datumKurz(k) {
  return t('p-serie.datum.kurz', { t: k.slice(8, 10), m: k.slice(5, 7) });
}

function ehrenreihen(st) {
  const box = el('div', 'se-ehren');
  const figuren = st.figuren;
  const reihen = Math.max(1, Math.ceil((figuren.length + 1) / T.REIHE));
  for (let r = 0; r < Math.min(reihen, 8); r++) {
    const reihe = el('div', 'se-ehren-reihe');
    reihe.setAttribute('role', 'list');
    const voll = figuren.slice(r * T.REIHE, (r + 1) * T.REIHE).length === T.REIHE;
    reihe.setAttribute('aria-label', t(voll ? 'p-serie.ehren.reiheVoll' : 'p-serie.ehren.reihe', { nr: r + 1 }));
    for (let i = 0; i < T.REIHE; i++) {
      const f = figuren[r * T.REIHE + i];
      const zelle = el('span', `se-ehre ${(r + i) % 2 ? 'd' : 'h'}${f === '?' ? ' offen' : ''}`);
      zelle.setAttribute('role', 'listitem');
      if (f && f !== '?') {
        zelle.innerHTML = `<img src="${esc(figurBild(f))}" alt="">`;
        zelle.setAttribute('aria-label', T.FIGUREN[f]);
      } else if (f === '?') {
        zelle.innerHTML = '<b aria-hidden="true">?</b>';
        zelle.setAttribute('aria-label', t('p-serie.ehren.offen'));
      } else zelle.setAttribute('aria-label', t('p-serie.ehren.frei'));
      reihe.append(zelle);
    }
    box.append(reihe);
  }
  return box;
}

function kalenderTabelle(wochen) {
  const tab = el('div', 'se-kalender');
  tab.setAttribute('role', 'table');
  tab.setAttribute('aria-label', t('p-serie.kalender.label'));
  tab.innerHTML = `<div class="se-k-zeile se-k-kopf" role="row"><span role="columnheader"></span>${KURZ.map((k) => `<span role="columnheader">${esc(k)}</span>`).join('')}</div>`;
  for (const w of wochen) {
    const z = el('div', 'se-k-zeile');
    z.setAttribute('role', 'row');
    z.innerHTML = `<span class="se-k-kw" role="rowheader">${esc(t('p-serie.kalender.kw', { kw: w.kw }))}</span>`;
    for (const d of w.tage) {
      const c = el('span', `se-k-tag ${d.art}${d.heute ? ' heute' : ''}`);
      c.setAttribute('role', 'cell');
      c.dataset.tag = d.tag;
      c.dataset.art = d.art;
      const sym = d.art === 'gezaehlt' || d.art === 'reise' ? icon('se-bauer', 'se-ico')
        : d.art === 'ruhetag' ? icon('se-mond', 'se-ico') : d.art === 'pause' ? icon('se-liege', 'se-ico') : '';
      c.innerHTML = `${sym}<span class="sr">${esc(datumKurz(d.tag))} ${esc(artText(d.art))}</span>`;
      z.append(c);
    }
    tab.append(z);
  }
  return tab;
}

function kapitelBalken(st, lage) {
  const liste = [...st.kapitelListe.map((k) => ({ nr: k.nr, tage: k.tage, laeuft: false }))];
  if (st.kapitel) liste.push({ nr: st.kapitel.nr, tage: st.aktuell, laeuft: lage.art === 'laeuft' });
  if (!liste.length) return null;
  const max = Math.max(...liste.map((k) => k.tage), 1);
  const box = el('div', 'se-kapitel');
  for (const k of liste.slice(-6)) {
    const z = el('div', 'se-kap');
    z.innerHTML = `<span class="se-kap-name">${esc(t('p-serie.kapitel.name', { nr: k.nr }))}</span><span class="se-kap-balken"><i style="transform:scaleX(${(k.tage / max).toFixed(3)})"></i></span>`
      + `<span class="se-kap-zahl zahl">${esc(k.laeuft ? t('p-serie.kapitel.laeuft', { wert: zahl(k.tage) }) : zahl(k.tage))}</span>`;
    box.append(z);
  }
  return box;
}

function ruhetagWahl({ einst, beiRuhetag }) {
  const box = el('div', 'se-ruhetag');
  box.setAttribute('role', 'radiogroup');
  box.setAttribute('aria-label', t('p-serie.ruhetag.name'));
  const werte = [[null, t('p-serie.ruhetag.kein')], ...KURZ.map((k, i) => [i, k])];
  for (const [w, name] of werte) {
    const k = el('button', 'se-rt dr', esc(name));
    k.type = 'button';
    k.setAttribute('role', 'radio');
    k.setAttribute('aria-checked', String(einst.ruhetag === w));
    k.setAttribute('aria-label', w == null ? t('p-serie.ruhetag.keinLabel') : t('p-serie.ruhetag.label', { tag: WOCHENTAGE[w] }));
    k.dataset.wert = w == null ? '' : String(w);
    k.addEventListener('click', () => {
      for (const x of box.children) x.setAttribute('aria-checked', String(x === k));
      if (typeof beiRuhetag === 'function') beiRuhetag(w);
    });
    box.append(k);
  }
  return box;
}

// pauseAb ist 'heute' oder 'morgen' (Kennung aus index.js), angezeigt in der eingestellten Sprache
function abText(ab) {
  return ab === 'morgen' ? t('p-serie.pause.ab.morgen') : t('p-serie.pause.ab.heute');
}

function pauseBereich({ st, heute, beiPause, beiPauseEnde, pauseRest, pauseAb = 'heute' }) {
  const box = el('div', 'se-pause');
  const kommend = st.pausen.filter((k) => k >= heute);
  const info = el('p', 'se-p-info');
  if (kommend.length) {
    info.textContent = t('p-serie.pause.angesagt', { von: datumKurz(kommend[0]), bis: datumKurz(kommend[kommend.length - 1]), n: kommend.length });
  } else {
    info.textContent = t('p-serie.pause.info', { ab: abText(pauseAb), rest: pauseRest, max: T.PAUSE_JAHR_MAX });
  }
  box.append(info);
  const reihe = el('div', 'se-p-knoepfe');
  if (kommend.length && typeof beiPauseEnde === 'function') {
    const k = el('button', 'knopf se-p-ende dr', esc(t('p-serie.pause.beenden')));
    k.type = 'button';
    k.addEventListener('click', beiPauseEnde);
    reihe.append(k);
  } else if (typeof beiPause === 'function' && pauseRest > 0) {
    for (const n of [1, 3, 7, 14].filter((x) => x <= pauseRest)) {
      const k = el('button', 'knopf se-p-tage dr', esc(t('p-serie.pause.tage', { n })));
      k.type = 'button';
      k.dataset.tage = String(n);
      k.setAttribute('aria-label', t('p-serie.pause.label', { ab: abText(pauseAb), n }));
      k.addEventListener('click', () => beiPause(n));
      reihe.append(k);
    }
  }
  if (reihe.children.length) box.append(reihe);
  return box;
}

function regeln() {
  const d = el('details', 'se-regeln');
  d.innerHTML = `<summary>${esc(t('p-serie.regeln.titel'))}</summary>`
    + ['tag', 'frei', 'bauer', 'lauf', 'ohne'].map((k) => `\n    <p>${esc(t('p-serie.regeln.' + k))}</p>`).join('');
  return d;
}

export function blattInhalt({ st, lage, einst, heute, wochen, ring, beiRuhetag, beiPause, beiPauseEnde, beiWahl, pauseRest = T.PAUSE_JAHR_MAX, pauseAb = 'heute' } = {}) {
  const box = el('div', 'se-blatt-inhalt');
  const kopf = el('div', 'se-b-kopf');
  let titel;
  if (lage.art === 'neu') titel = t('p-serie.blatt.neu');
  else if (lage.art === 'ruht') titel = t('p-serie.blatt.ruht', { best: zahl(lage.best), kapitel: lage.kapitel });
  else titel = t('p-serie.blatt.laeuft', { schachtage: schachtage(lage.aktuell), best: zahl(lage.best), kapitel: lage.kapitel });
  const unter = [];
  if (lage.art === 'laeuft' && lage.seit) {
    unter.push(t('p-serie.blatt.seit', { datum: datumKurz(lage.seit), bruecken: lage.bruecken ? t('p-serie.blatt.bruecken', { n: lage.bruecken }) : t('p-serie.blatt.ohneBruecke') }));
  }
  if (lage.art === 'ruht') unter.push(t('p-serie.blatt.naechstes', { kapitel: lage.naechstesKapitel }));
  unter.push(bisText(lage.bisUmwandlung));
  kopf.innerHTML = `<span class="se-b-symbol" aria-hidden="true">${icon('se-bauer', 'se-ico')}</span><div><b class="se-b-titel"></b><span class="se-b-unter"></span></div>`;
  kopf.querySelector('.se-b-titel').textContent = titel;
  kopf.querySelector('.se-b-unter').textContent = unter.join(' · ');
  box.append(kopf);

  const marsch = el('section', 'se-b-teil');
  marsch.innerHTML = `<h4 class="se-b-ueber">${esc(t('p-serie.name'))}</h4>${streifenHtml({ feld: lage.feld, heute: lage.heuteGezaehlt ? 'gezaehlt' : (lage.art === 'ruht' ? null : 'offen') })}`;
  const umw = st.bretter * T.BRETT + st.figuren.length;
  const info = el('p', 'se-b-text');
  info.textContent = umw ? (st.bretter
    ? t('p-serie.blatt.umwInfoBretter', { umw: t('p-serie.blatt.umw', { n: umw }), bretter: t('p-serie.blatt.bretter', { n: st.bretter }) })
    : t('p-serie.blatt.umwInfo', { umw: t('p-serie.blatt.umw', { n: umw }) }))
    : t('p-serie.blatt.umwKeine');
  marsch.append(info);
  if (umw) marsch.append(ehrenreihen(st));
  if (lage.offeneWahl > 0 && typeof beiWahl === 'function') marsch.append(wahlBlock({ beiWahl, nr: offeneNr(st) }));
  box.append(marsch);

  const kal = el('section', 'se-b-teil');
  kal.innerHTML = `<h4 class="se-b-ueber">${esc(t('p-serie.blatt.kalender'))}</h4>`;
  kal.append(kalenderTabelle(wochen));
  const leg = el('p', 'se-legende');
  const legende = (k) => esc(t('p-serie.blatt.legende.' + k));
  leg.innerHTML = `<span>${icon('se-bauer', 'se-ico')} ${legende('schachtag')}</span><span><i class="se-l-bruecke"></i> ${legende('bruecke')}</span><span>${icon('se-mond', 'se-ico')} ${legende('ruhetag')}</span>`
    + `<span>${icon('se-liege', 'se-ico')} ${legende('pause')}</span><span>${legende('leer')}</span>`;
  kal.append(leg);
  box.append(kal);

  const zahlen = el('dl', 'se-b-zahlen');
  const ringText = ring.n > 0 ? t('p-serie.blatt.ring', { n: ring.n, best: ring.best })
    : t('p-serie.blatt.ringWoche', { gezaehlt: Math.min(ring.woche.gezaehlt, ring.woche.noetig), noetig: ring.woche.noetig });
  const lauf = st.lauf;
  const laufInhalt = lauf.n > 0 ? t('p-serie.blatt.laufRekord', { lauf: laufText(lauf.n), best: lauf.best })
    : lauf.best > 0 ? t('p-serie.rekord', { wert: lauf.best }) : t('p-serie.blatt.keinLauf');
  zahlen.innerHTML = `<dt>${esc(t('p-serie.blatt.wochenRing'))}</dt><dd class="se-b-ring"></dd><dt>${esc(t('p-serie.blatt.gesamt'))}</dt><dd class="zahl">${zahl(st.gesamt)}</dd>`
    + `<dt>${esc(t('p-serie.lauf.name'))}</dt><dd class="se-b-lauf"></dd>`;
  zahlen.querySelector('.se-b-ring').textContent = ringText;
  zahlen.querySelector('.se-b-lauf').innerHTML = `${lauf.n >= LA.FLAMME_AB ? icon('se-flamme', 'se-ico') : ''}<span></span>`;
  zahlen.querySelector('.se-b-lauf span').textContent = laufInhalt;
  if (st.plaketten.length) {
    const p = st.plaketten[0];
    zahlen.insertAdjacentHTML('beforeend', `<dt>${esc(t('p-serie.blatt.plakette'))}</dt><dd class="se-b-plakette"></dd>`);
    zahlen.querySelector('.se-b-plakette').textContent = t('p-serie.blatt.plaketteText', { schachtage: schachtage(p.n), von: datumKurz(p.von), bis: datumKurz(p.bis) });
  }
  box.append(zahlen);
  const kap = kapitelBalken(st, lage);
  if (kap) {
    const teil = el('section', 'se-b-teil');
    teil.innerHTML = `<h4 class="se-b-ueber">${esc(t('p-serie.blatt.kapitel'))}</h4>`;
    teil.append(kap);
    box.append(teil);
  }
  const ein = el('section', 'se-b-teil');
  ein.innerHTML = `<h4 class="se-b-ueber">${esc(t('p-serie.ruhetag.name'))}</h4><p class="se-b-text">${esc(t('p-serie.blatt.ruhetagText'))}</p>`;
  ein.append(ruhetagWahl({ einst, beiRuhetag }));
  const pz = el('h4', 'se-b-ueber', esc(t('p-serie.blatt.pause')));
  ein.append(pz, pauseBereich({ st, heute, beiPause, beiPauseEnde, pauseRest, pauseAb }));
  box.append(ein);
  box.append(regeln());
  return box;
}

// ---------- Blatt ----------
let offen = null;
export function oeffneBlatt(inhalt, { titel = t('p-serie.name') } = {}) {
  if (offen) offen.schliesse();
  const ort = el('div', 'sheet-ort se-blatt-ort');
  ort.innerHTML = `<div class="sheet-schleier"></div><div class="sheet-karte se-blatt" role="dialog" aria-modal="true" aria-labelledby="se-blatt-titel">
    <div class="sheet-griff" aria-hidden="true"></div><h3 id="se-blatt-titel"></h3><div class="se-blatt-rumpf"></div>
    <div class="se-blatt-knoepfe"><button class="knopf gross dr se-schliessen" type="button">${esc(t('allgemein.schliessen'))}</button></div></div>`;
  ort.querySelector('h3').textContent = titel;
  ort.querySelector('.se-blatt-rumpf').append(inhalt);
  const karte = ort.querySelector('.sheet-karte');
  const schleier = ort.querySelector('.sheet-schleier');
  const vorher = document.activeElement;
  let zu = false;
  // modal wie das Blatt in js/ui/bauteile.js und der Funken-Spiegel: Escape schliesst, Tab bleibt im Blatt
  const fokussierbar = () => [...karte.querySelectorAll('button, [href], summary, input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((x) => !x.disabled && x.getClientRects().length > 0);
  const taste = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); schliesse(); return; }
    if (e.key !== 'Tab') return;
    const liste = fokussierbar();
    if (!liste.length) { e.preventDefault(); return; }
    const erstes = liste[0];
    const letztes = liste[liste.length - 1];
    const aktiv = document.activeElement;
    if (!karte.contains(aktiv)) { e.preventDefault(); (e.shiftKey ? letztes : erstes).focus(); return; }
    if (e.shiftKey && aktiv === erstes) { e.preventDefault(); letztes.focus(); } else if (!e.shiftKey && aktiv === letztes) { e.preventDefault(); erstes.focus(); }
  };
  function schliesse() {
    if (zu) return;
    zu = true;
    document.removeEventListener('keydown', taste, true);
    if (offen && offen.ort === ort) offen = null;
    ort.classList.add('weg');
    if (tempo() === 0) ort.remove();
    else {
      const a = anim(karte, [{ transform: 'none' }, { transform: 'translateY(110%)' }], { d: 260, k: 'raus', fill: 'forwards' });
      anim(schleier, [{ opacity: 1 }, { opacity: 0 }], { d: 220, k: 'sanft', fill: 'forwards' });
      const weg = () => { if (ort.isConnected) ort.remove(); };
      Promise.resolve(a.finished).catch(() => {}).then(weg);
      setTimeout(weg, 520 * tempo() + 100);
    }
    if (vorher && vorher.isConnected && typeof vorher.focus === 'function') { try { vorher.focus({ preventScroll: true }); } catch (f) { /* egal */ } }
  }
  schleier.addEventListener('pointerdown', schliesse);
  ort.querySelector('.se-schliessen').addEventListener('click', schliesse);
  document.addEventListener('keydown', taste, true);
  document.body.append(ort);
  anim(karte, [{ transform: 'translateY(100%)' }, { transform: 'none' }], { d: 480, k: 'gleiten' });
  anim(schleier, [{ opacity: 0 }, { opacity: 1 }], { d: 260, k: 'sanft' });
  try { ort.querySelector('.se-schliessen').focus({ preventScroll: true }); } catch (f) { /* egal */ }
  offen = {
    ort, schliesse,
    ersetze(neu) { const r = ort.querySelector('.se-blatt-rumpf'); r.replaceChildren(neu); },
  };
  return offen;
}

export function schliesseBlatt() {
  if (offen) offen.schliesse();
}
export function offenesBlatt() {
  return offen;
}

// ---------- Einstellungen ----------
function schalterZeile({ key, titel, text, an, beiWechsel }) {
  const z = el('div', 'es-zeile se-es-zeile');
  z.dataset.zeile = 'serie-' + key;
  z.innerHTML = `<div class="es-text"><b id="se-l-${key}"></b><span id="se-t-${key}"></span></div>`
    + `<button class="es-schalter se-schalter" type="button" role="switch" aria-labelledby="se-l-${key}" aria-describedby="se-t-${key}" aria-checked="${an ? 'true' : 'false'}" data-key="${key}"><i></i></button>`;
  z.querySelector('b').textContent = titel;
  z.querySelector('span').textContent = text;
  const k = z.querySelector('button');
  const umschalten = () => {
    const neu = k.getAttribute('aria-checked') !== 'true';
    k.setAttribute('aria-checked', String(neu));
    try { klang.spiele('schalter'); } catch (x) { /* still */ }
    beiWechsel(neu);
  };
  k.addEventListener('click', umschalten);
  z.querySelector('.es-text').addEventListener('click', umschalten);
  return z;
}

export function einstellungsGruppe({ einst, beiAenderung } = {}) {
  const g = el('section', 'es-gruppe flaeche se-es');
  g.dataset.paket = 'serie';
  g.setAttribute('aria-labelledby', 'se-es-titel');
  g.innerHTML = `<h3 class="es-titel" id="se-es-titel">${esc(t('p-serie.name'))}</h3>`;
  const aendere = (teil) => { if (typeof beiAenderung === 'function') beiAenderung(teil); };
  g.append(schalterZeile({ key: 'anzeigen', titel: t('p-serie.es.anzeigen'), text: t('p-serie.es.anzeigenText'),
    an: einst.anzeigen, beiWechsel: (an) => aendere({ anzeigen: an }) }));
  g.append(schalterZeile({ key: 'strenge', titel: t('p-serie.es.strenge'), text: t('p-serie.es.strengeText'),
    an: einst.strenge, beiWechsel: (an) => aendere({ strenge: an }) }));
  g.append(schalterZeile({ key: 'leise', titel: t('p-serie.es.leise'), text: t('p-serie.es.leiseText'),
    an: einst.leise, beiWechsel: (an) => aendere({ leise: an }) }));
  const rt = el('div', 'se-es-ruhetag');
  rt.innerHTML = `<b>${esc(t('p-serie.ruhetag.name'))}</b><span>${esc(t('p-serie.es.ruhetagText'))}</span>`;
  rt.append(ruhetagWahl({ einst, beiRuhetag: (w) => aendere({ ruhetag: w }) }));
  g.append(rt);
  return g;
}

export { WOCHENTAGE, wochentag };
