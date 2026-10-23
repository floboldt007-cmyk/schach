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
import * as T from './tag.js';
import * as LA from './lauf.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const zahl = (n) => Math.round(Number(n) || 0).toLocaleString('de-DE');
const figurBild = (f) => new URL(`../../../assets/pieces/w${f === 'S' ? 'N' : f === 'L' ? 'B' : f === 'T' ? 'R' : f === 'D' ? 'Q' : 'P'}.svg`, import.meta.url).href;
const WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function el(tag, klasse, html) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (html != null) e.innerHTML = html;
  return e;
}

export const schachtage = (n) => `${zahl(n)} ${n === 1 ? 'Schachtag' : 'Schachtage'} in Serie`;
export const bisText = (n) => `noch ${n} ${n === 1 ? 'Feld' : 'Felder'} bis zur Umwandlung`;
export const laufText = (n) => `${n} ${n === 1 ? 'Sieg' : 'Siege'} in Folge`;
export const endeText = (n, rekord) => `Siegeslauf beendet bei ${n}. Dein Rekord: ${rekord}.`;

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
  return `<span class="se-streifen${klein ? ' klein' : ''}" role="img" aria-label="${esc(label || `Bauernmarsch: Feld ${pos} von ${T.FELDER}`)}" style="--feld:${pos}">`
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
    label = `Wochen-Ring: ${ring.n} volle ${ring.n === 1 ? 'Woche' : 'Wochen'} in Folge. Bauernmarsch: ${schachtage(lage.aktuell)}`;
  } else if (ruht) {
    inhalt = `${icon('se-bauer', 'se-ico')}<span class="se-chip-ruht">ruht</span>`;
    label = `Bauernmarsch ruht, Rekord ${lage.best}. Das nächste Tageswerk beginnt Kapitel ${lage.naechstesKapitel}`;
  } else {
    inhalt = `${icon('se-bauer', 'se-ico')}<b class="zahl">${lage.aktuell}</b>`;
    label = `Bauernmarsch: ${schachtage(lage.aktuell)}, Rekord ${lage.best}`;
  }
  if (flamme) {
    inhalt += `<span class="se-chip-flamme">${icon('se-flamme', 'se-ico')}<b class="zahl">${lauf.n}</b></span>`;
    label += `. Siegeslauf: ${laufText(lauf.n)}`;
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
  s.title = `Siegeslauf: ${laufText(n)}`;
  s.setAttribute('aria-label', `Siegeslauf: ${laufText(n)}`);
  return s;
}

// ---------- Heute-Karte ----------
export function heuteZeile({ lage, st, einst = {}, training = false, beiTraining, beiWahl, beiBlatt, beiLeise, texte = {} } = {}) {
  const z = el('div', 'se-heute');
  z.dataset.paket = 'serie';
  z.dataset.art = lage.art;
  const heuteArt = lage.heuteGezaehlt ? 'gezaehlt' : 'offen';
  let titel;
  if (lage.art === 'neu') titel = '<b>Bauernmarsch</b>';
  else if (lage.art === 'ruht') titel = `<b>ruht</b> · Rekord ${zahl(lage.best)}`;
  else titel = `<b>Tag ${zahl(lage.aktuell)}</b> · Bauernmarsch`;
  z.innerHTML = `<div class="se-h-zeile"><button class="se-h-titel" type="button" aria-label="Serien-Blatt öffnen">`
    + `<span class="se-h-symbol" aria-hidden="true">${icon('se-bauer', 'se-ico')}</span><span class="se-h-text">${titel}</span></button>`
    + `${streifenHtml({ feld: lage.feld, heute: lage.art === 'ruht' && !lage.heuteGezaehlt ? null : heuteArt,
      label: lage.art === 'neu' ? 'Bauernmarsch: dein Bauer steht am Start' : `Bauernmarsch: ${bisText(lage.bisUmwandlung)}` })}</div>`;
  const status = el('p', 'se-h-status');
  if (lage.heuteGezaehlt) status.textContent = 'Tageswerk geschafft. Alles Weitere ist Kür.';
  else if (lage.pause) status.textContent = 'Pause: Die Serie ist eingefroren.';
  else if (lage.ruhetag) status.textContent = 'Heute ist dein Ruhetag. Er zählt nie als freier Tag.';
  else status.textContent = 'Heute noch offen · Tageswerk in 5 Minuten';
  z.append(status);
  const detail = el('p', 'se-h-detail');
  if (lage.art === 'neu') detail.textContent = 'Jeder Schachtag schiebt deinen Bauern ein Feld vor. Nach 6 Feldern wandelt er sich um.';
  else if (lage.art === 'ruht') detail.textContent = `Dein nächstes Tageswerk beginnt Kapitel ${lage.naechstesKapitel}. Figuren und Rekord bleiben.`;
  else if (lage.gesternBruecke && !lage.heuteGezaehlt) detail.textContent = `Gestern war ein Brückentag. Deine Serie läuft: ${schachtage(lage.aktuell)}.`;
  else detail.textContent = bisText(lage.bisUmwandlung);
  z.append(detail);
  if (!lage.heuteGezaehlt && !lage.pause && training && typeof beiTraining === 'function') {
    const k = el('button', 'knopf se-h-training dr', 'Zum Training');
    k.type = 'button';
    k.setAttribute('aria-label', 'Zum Training: Tageswerk in 5 Minuten');
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
      const k = el('button', 'knopf se-h-leise dr', 'Nur den Wochen-Ring zeigen');
      k.type = 'button';
      k.addEventListener('click', () => beiLeise(k));
      z.append(k);
    }
  }
  if (lage.offeneWahl > 0 && typeof beiWahl === 'function') z.append(wahlBlock({ beiWahl, nr: offeneNr(st) }));
  const t = z.querySelector('.se-h-titel');
  if (typeof beiBlatt === 'function') t.addEventListener('click', beiBlatt);
  return z;
}

function offeneNr(st) {
  const i = st.figuren.indexOf('?');
  return i < 0 ? null : st.bretter * T.BRETT + i + 1;
}

function wahlBlock({ beiWahl, nr }) {
  const w = el('div', 'se-wahl');
  w.setAttribute('role', 'group');
  w.setAttribute('aria-label', 'Umwandlung: Figur wählen');
  w.innerHTML = `<p class="se-wahl-text">Umwandlung! Deine ${nr ? nr + '. ' : ''}Figur zieht in die Ehrenreihe. Welche soll es sein?</p><div class="se-wahl-knoepfe"></div>`;
  const reihe = w.querySelector('.se-wahl-knoepfe');
  for (const [f, name] of Object.entries(T.FIGUREN)) {
    const k = el('button', 'se-wahl-knopf dr', `<img src="${esc(figurBild(f))}" alt=""><span>${esc(name)}</span>`);
    k.type = 'button';
    k.dataset.figur = f;
    k.setAttribute('aria-label', `${name} wählen`);
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
    kopf = `<span class="se-label">Serie</span><b class="se-abr-wert">Tag ${zahl(e.t)} · Bauernmarsch</b>`;
    if (umw) unter = 'Umwandlung! Die Figur wählst du in der Arena.';
    else unter = (e.d ? 'Willkommen zurück. Doppelschritt. ' : '') + bisText(T.FELDER - (e.f % T.FELDER));
  } else {
    kopf = `<span class="se-label">Siegeslauf</span><b class="se-abr-wert">${mitLauf ? esc(laufText(e.l)) : 'beendet'}</b>`;
  }
  let lauf = '';
  if (mitTag && mitLauf) lauf = `<span class="se-abr-lauf"${e.l >= LA.FLAMME_AB ? ' data-flamme="1"' : ''}>${e.l >= LA.FLAMME_AB ? icon('se-flamme', 'se-ico') : ''}${esc(laufText(e.l))}</span>`;
  else if (!mitTag && mitLauf && e.l >= LA.FLAMME_AB) kopf = `<span class="se-label">Siegeslauf</span><b class="se-abr-wert">${icon('se-flamme', 'se-ico')}${esc(laufText(e.l))}</b>`;
  if (mitEnde) lauf += `<span class="se-abr-ende">${esc(endeText(e.e, e.b))}</span>`;
  zeile.innerHTML = `<span class="se-abr-symbol" aria-hidden="true">${icon(mitTag ? 'se-bauer' : 'se-flamme', 'se-ico')}</span>`
    + `<span class="se-abr-mitte"><span class="se-abr-kopf">${kopf}</span>${unter ? `<span class="se-abr-unter">${esc(unter)}</span>` : ''}${lauf}</span>`
    + (mitTag ? streifenHtml({ feld: schonGezeigt ? posNachher : posVorher, heute: 'gezaehlt', klein: true, umwandlung: false,
      label: umw ? 'Bauernmarsch: Umwandlung' : `Bauernmarsch: ${bisText(T.FELDER - (e.f % T.FELDER))}` }) : '');
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
const ART_TEXT = {
  gezaehlt: 'gezählt', reise: 'gezählt (Reise-Regel)', bruecke: 'Brücke', ruhetag: 'Ruhetag', pause: 'Pause', leer: 'frei', offen: 'heute', zukunft: '', vorher: '',
};
const datumKurz = (k) => `${k.slice(8, 10)}.${k.slice(5, 7)}.`;

function ehrenreihen(st) {
  const box = el('div', 'se-ehren');
  const figuren = st.figuren;
  const reihen = Math.max(1, Math.ceil((figuren.length + 1) / T.REIHE));
  for (let r = 0; r < Math.min(reihen, 8); r++) {
    const reihe = el('div', 'se-ehren-reihe');
    reihe.setAttribute('role', 'list');
    const voll = figuren.slice(r * T.REIHE, (r + 1) * T.REIHE).length === T.REIHE;
    reihe.setAttribute('aria-label', `${r + 1}. Ehrenreihe${voll ? ' (voll)' : ''}`);
    for (let i = 0; i < T.REIHE; i++) {
      const f = figuren[r * T.REIHE + i];
      const zelle = el('span', `se-ehre ${(r + i) % 2 ? 'd' : 'h'}${f === '?' ? ' offen' : ''}`);
      zelle.setAttribute('role', 'listitem');
      if (f && f !== '?') {
        zelle.innerHTML = `<img src="${esc(figurBild(f))}" alt="">`;
        zelle.setAttribute('aria-label', T.FIGUREN[f]);
      } else if (f === '?') {
        zelle.innerHTML = '<b aria-hidden="true">?</b>';
        zelle.setAttribute('aria-label', 'Umwandlung: Figur noch wählen');
      } else zelle.setAttribute('aria-label', 'frei');
      reihe.append(zelle);
    }
    box.append(reihe);
  }
  return box;
}

function kalenderTabelle(wochen) {
  const t = el('div', 'se-kalender');
  t.setAttribute('role', 'table');
  t.setAttribute('aria-label', 'Kalender der letzten Wochen');
  t.innerHTML = `<div class="se-k-zeile se-k-kopf" role="row"><span role="columnheader"></span>${KURZ.map((k) => `<span role="columnheader">${k}</span>`).join('')}</div>`;
  for (const w of wochen) {
    const z = el('div', 'se-k-zeile');
    z.setAttribute('role', 'row');
    z.innerHTML = `<span class="se-k-kw" role="rowheader">KW ${w.kw}</span>`;
    for (const d of w.tage) {
      const c = el('span', `se-k-tag ${d.art}${d.heute ? ' heute' : ''}`);
      c.setAttribute('role', 'cell');
      c.dataset.tag = d.tag;
      c.dataset.art = d.art;
      const sym = d.art === 'gezaehlt' || d.art === 'reise' ? icon('se-bauer', 'se-ico')
        : d.art === 'ruhetag' ? icon('se-mond', 'se-ico') : d.art === 'pause' ? icon('se-liege', 'se-ico') : '';
      c.innerHTML = `${sym}<span class="sr">${datumKurz(d.tag)} ${ART_TEXT[d.art] || ''}</span>`;
      z.append(c);
    }
    t.append(z);
  }
  return t;
}

function kapitelBalken(st, lage) {
  const liste = [...st.kapitelListe.map((k) => ({ nr: k.nr, tage: k.tage, laeuft: false }))];
  if (st.kapitel) liste.push({ nr: st.kapitel.nr, tage: st.aktuell, laeuft: lage.art === 'laeuft' });
  if (!liste.length) return null;
  const max = Math.max(...liste.map((k) => k.tage), 1);
  const box = el('div', 'se-kapitel');
  for (const k of liste.slice(-6)) {
    const z = el('div', 'se-kap');
    z.innerHTML = `<span class="se-kap-name">Kapitel ${k.nr}</span><span class="se-kap-balken"><i style="transform:scaleX(${(k.tage / max).toFixed(3)})"></i></span>`
      + `<span class="se-kap-zahl zahl">${zahl(k.tage)}${k.laeuft ? ' (läuft)' : ''}</span>`;
    box.append(z);
  }
  return box;
}

function ruhetagWahl({ einst, beiRuhetag }) {
  const box = el('div', 'se-ruhetag');
  box.setAttribute('role', 'radiogroup');
  box.setAttribute('aria-label', 'Ruhetag');
  const werte = [[null, 'Kein'], ...KURZ.map((k, i) => [i, k])];
  for (const [w, name] of werte) {
    const k = el('button', 'se-rt dr', esc(name));
    k.type = 'button';
    k.setAttribute('role', 'radio');
    k.setAttribute('aria-checked', String(einst.ruhetag === w));
    k.setAttribute('aria-label', w == null ? 'Kein Ruhetag' : `Ruhetag ${WOCHENTAGE[w]}`);
    k.dataset.wert = w == null ? '' : String(w);
    k.addEventListener('click', () => {
      for (const x of box.children) x.setAttribute('aria-checked', String(x === k));
      if (typeof beiRuhetag === 'function') beiRuhetag(w);
    });
    box.append(k);
  }
  return box;
}

function pauseBereich({ st, heute, beiPause, beiPauseEnde, pauseRest, pauseAb = 'heute' }) {
  const box = el('div', 'se-pause');
  const kommend = st.pausen.filter((k) => k >= heute);
  const info = el('p', 'se-p-info');
  if (kommend.length) {
    info.textContent = `Pause angesagt: ${datumKurz(kommend[0])} bis ${datumKurz(kommend[kommend.length - 1])} (${kommend.length} ${kommend.length === 1 ? 'Tag' : 'Tage'}). Die Serie ist dann eingefroren.`;
  } else {
    info.textContent = `Urlaub oder krank? Sag eine Pause ab ${pauseAb} an, dann ist die Serie eingefroren. Dieses Jahr sind noch ${pauseRest} von ${T.PAUSE_JAHR_MAX} Pausentagen frei.`;
  }
  box.append(info);
  const reihe = el('div', 'se-p-knoepfe');
  if (kommend.length && typeof beiPauseEnde === 'function') {
    const k = el('button', 'knopf se-p-ende dr', 'Pause beenden');
    k.type = 'button';
    k.addEventListener('click', beiPauseEnde);
    reihe.append(k);
  } else if (typeof beiPause === 'function' && pauseRest > 0) {
    for (const n of [1, 3, 7, 14].filter((x) => x <= pauseRest)) {
      const k = el('button', 'knopf se-p-tage dr', `${n} ${n === 1 ? 'Tag' : 'Tage'}`);
      k.type = 'button';
      k.dataset.tage = String(n);
      k.setAttribute('aria-label', `Pause ab ${pauseAb} für ${n} ${n === 1 ? 'Tag' : 'Tage'} ansagen`);
      k.addEventListener('click', () => beiPause(n));
      reihe.append(k);
    }
  }
  if (reihe.children.length) box.append(reihe);
  return box;
}

function regeln() {
  const d = el('details', 'se-regeln');
  d.innerHTML = `<summary>So zählt der Bauernmarsch</summary>
    <p>Ein Tag reicht von 4 Uhr bis 4 Uhr. Er zählt mit einem Tageswerk: eine Partie ab 10 eigenen Zügen (egal welche Art),
    3 Karteikarten, 2 Übungen „Ab hier nochmal“, 3 Rätsel oder eine Lektion. Partien mit Hilfe zählen auch. Bloßes Öffnen zählt nie.</p>
    <p>Ein freier Tag ist nie schlimm: Er wird zur Brücke. Erst zwei freie Tage hintereinander lassen die Serie ruhen. Dein Ruhetag und eine
    angesagte Pause zählen nie als freier Tag. Ruht die Serie, beginnt das nächste Tageswerk ein neues Kapitel; Rekord, Figuren und Spieltage bleiben.</p>
    <p>Jeder Schachtag schiebt deinen Bauern ein Feld vor, nach 6 Feldern wandelt er sich um. Doppelschritt: am ersten Tag nach mindestens
    zwei Tagen ohne Tageswerk, höchstens einmal im Monat. Der Bauer läuft nie zurück.</p>
    <p>Siegeslauf: Siege in Folge gegen Gegner ab einer Stufe unter deinem höchsten freigeschalteten Bot (später: ab deiner Wertung minus 150).
    Partien mit Hilfe, gegen schwächere Gegner, Übungen, freie und Boss-Partien zählen nicht und beenden nichts. Ab 3 Siegen eine Flamme.</p>
    <p>Die Serie bringt keine Funken, ändert keine Bots, Wertung oder Sterne und ist nie in einer Rangliste.</p>`;
  return d;
}

export function blattInhalt({ st, lage, einst, heute, wochen, ring, beiRuhetag, beiPause, beiPauseEnde, beiWahl, pauseRest = T.PAUSE_JAHR_MAX, pauseAb = 'heute' } = {}) {
  const box = el('div', 'se-blatt-inhalt');
  const kopf = el('div', 'se-b-kopf');
  let titel;
  if (lage.art === 'neu') titel = 'Noch kein Schachtag';
  else if (lage.art === 'ruht') titel = `Ruht · Rekord ${zahl(lage.best)} · Kapitel ${lage.kapitel}`;
  else titel = `${schachtage(lage.aktuell)} · Rekord ${zahl(lage.best)} · Kapitel ${lage.kapitel}`;
  const unter = [];
  if (lage.art === 'laeuft' && lage.seit) {
    unter.push(`seit ${datumKurz(lage.seit)}, ${lage.bruecken ? `${lage.bruecken} ${lage.bruecken === 1 ? 'Brücke' : 'Brücken'}` : 'ohne Brücke'}`);
  }
  if (lage.art === 'ruht') unter.push(`Das nächste Tageswerk beginnt Kapitel ${lage.naechstesKapitel}.`);
  unter.push(bisText(lage.bisUmwandlung));
  kopf.innerHTML = `<span class="se-b-symbol" aria-hidden="true">${icon('se-bauer', 'se-ico')}</span><div><b class="se-b-titel"></b><span class="se-b-unter"></span></div>`;
  kopf.querySelector('.se-b-titel').textContent = titel;
  kopf.querySelector('.se-b-unter').textContent = unter.join(' · ');
  box.append(kopf);

  const marsch = el('section', 'se-b-teil');
  marsch.innerHTML = `<h4 class="se-b-ueber">Bauernmarsch</h4>${streifenHtml({ feld: lage.feld, heute: lage.heuteGezaehlt ? 'gezaehlt' : (lage.art === 'ruht' ? null : 'offen') })}`;
  const umw = st.bretter * T.BRETT + st.figuren.length;
  const info = el('p', 'se-b-text');
  info.textContent = umw ? `${umw} ${umw === 1 ? 'Umwandlung' : 'Umwandlungen'}${st.bretter ? `, ${st.bretter} ${st.bretter === 1 ? 'volles Brett' : 'volle Bretter'}` : ''}. Jede Figur zieht mit Datum in deine Ehrenreihe.`
    : 'Nach 6 Feldern wandelt sich dein Bauer um, und die Figur zieht in deine Ehrenreihe.';
  marsch.append(info);
  if (umw) marsch.append(ehrenreihen(st));
  if (lage.offeneWahl > 0 && typeof beiWahl === 'function') marsch.append(wahlBlock({ beiWahl, nr: offeneNr(st) }));
  box.append(marsch);

  const kal = el('section', 'se-b-teil');
  kal.innerHTML = '<h4 class="se-b-ueber">Kalender</h4>';
  kal.append(kalenderTabelle(wochen));
  const leg = el('p', 'se-legende');
  leg.innerHTML = `<span>${icon('se-bauer', 'se-ico')} Schachtag</span><span><i class="se-l-bruecke"></i> Brücke</span><span>${icon('se-mond', 'se-ico')} Ruhetag</span>`
    + `<span>${icon('se-liege', 'se-ico')} Pause</span><span>leer: frei, nie rot</span>`;
  kal.append(leg);
  box.append(kal);

  const zahlen = el('dl', 'se-b-zahlen');
  const ringText = ring.n > 0 ? `${ring.n} volle ${ring.n === 1 ? 'Woche' : 'Wochen'} in Folge (Rekord ${ring.best})`
    : `diese Woche ${Math.min(ring.woche.gezaehlt, ring.woche.noetig)} von ${ring.woche.noetig} Tagen`;
  const lauf = st.lauf;
  const laufInhalt = lauf.n > 0 ? `${laufText(lauf.n)} · Rekord ${lauf.best}` : lauf.best > 0 ? `Rekord ${lauf.best}` : 'noch kein Lauf';
  zahlen.innerHTML = `<dt>Wochen-Ring</dt><dd class="se-b-ring"></dd><dt>Spieltage gesamt</dt><dd class="zahl">${zahl(st.gesamt)}</dd>`
    + `<dt>Siegeslauf</dt><dd class="se-b-lauf"></dd>`;
  zahlen.querySelector('.se-b-ring').textContent = ringText;
  zahlen.querySelector('.se-b-lauf').innerHTML = `${lauf.n >= LA.FLAMME_AB ? icon('se-flamme', 'se-ico') : ''}<span></span>`;
  zahlen.querySelector('.se-b-lauf span').textContent = laufInhalt;
  if (st.plaketten.length) {
    const p = st.plaketten[0];
    zahlen.insertAdjacentHTML('beforeend', '<dt>Letzte Plakette</dt><dd class="se-b-plakette"></dd>');
    zahlen.querySelector('.se-b-plakette').textContent = `${schachtage(p.n)}, ${datumKurz(p.von)} bis ${datumKurz(p.bis)}`;
  }
  box.append(zahlen);
  const kap = kapitelBalken(st, lage);
  if (kap) {
    const teil = el('section', 'se-b-teil');
    teil.innerHTML = '<h4 class="se-b-ueber">Kapitel</h4>';
    teil.append(kap);
    box.append(teil);
  }
  const ein = el('section', 'se-b-teil');
  ein.innerHTML = '<h4 class="se-b-ueber">Ruhetag</h4><p class="se-b-text">Dein Ruhetag zählt nie als freier Tag.</p>';
  ein.append(ruhetagWahl({ einst, beiRuhetag }));
  const pz = el('h4', 'se-b-ueber', 'Pause ansagen');
  ein.append(pz, pauseBereich({ st, heute, beiPause, beiPauseEnde, pauseRest, pauseAb }));
  box.append(ein);
  box.append(regeln());
  return box;
}

// ---------- Blatt ----------
let offen = null;
export function oeffneBlatt(inhalt, { titel = 'Bauernmarsch' } = {}) {
  if (offen) offen.schliesse();
  const ort = el('div', 'sheet-ort se-blatt-ort');
  ort.innerHTML = `<div class="sheet-schleier"></div><div class="sheet-karte se-blatt" role="dialog" aria-modal="true" aria-labelledby="se-blatt-titel">
    <div class="sheet-griff" aria-hidden="true"></div><h3 id="se-blatt-titel"></h3><div class="se-blatt-rumpf"></div>
    <div class="se-blatt-knoepfe"><button class="knopf gross dr se-schliessen" type="button">Schließen</button></div></div>`;
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
  g.innerHTML = '<h3 class="es-titel" id="se-es-titel">Bauernmarsch</h3>';
  const aendere = (teil) => { if (typeof beiAenderung === 'function') beiAenderung(teil); };
  g.append(schalterZeile({ key: 'anzeigen', titel: 'Serie anzeigen', text: 'Chip im Kopf, Heute-Karte und Abrechnung. Gezählt wird auch ausgeblendet.',
    an: einst.anzeigen, beiWechsel: (an) => aendere({ anzeigen: an }) }));
  g.append(schalterZeile({ key: 'strenge', titel: 'Strenge Serie', text: 'Statt Brücken gelten 2 Schonungstage im Monat.',
    an: einst.strenge, beiWechsel: (an) => aendere({ strenge: an }) }));
  g.append(schalterZeile({ key: 'leise', titel: 'Leise Serie', text: 'Im Kopf steht der Wochen-Ring statt der Tage.',
    an: einst.leise, beiWechsel: (an) => aendere({ leise: an }) }));
  const rt = el('div', 'se-es-ruhetag');
  rt.innerHTML = '<b>Ruhetag</b><span>Zählt nie als freier Tag. Standard: keiner.</span>';
  rt.append(ruhetagWahl({ einst, beiRuhetag: (w) => aendere({ ruhetag: w }) }));
  g.append(rt);
  return g;
}

export { WOCHENTAGE, wochentag };
