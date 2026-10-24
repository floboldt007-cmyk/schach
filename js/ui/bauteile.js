// Bauteile der Schach-Arena (Premium-Umbau U2, PLAN 2.1 und 4; Optik in css/bauteile.css nach Entwurf A).
// Importiert app.js NICHT (die Testseiten laden Screens ohne App). Jedes Bauteil liefert ein Objekt mit el (fertiges
// Element) und kleinen Steuerfunktionen; Klicks bindet das Bauteil selbst. Klaenge ueber klang.spiele() (Gruppe
// "bedienung": klick, schalter), fehlt ein Klang, bleibt es still.
//
//   segment({ name, optionen: [{ id, text, klein, html, label }], wert, beiWahl(id, { quelle }), klasse, label })
//       -> { el, setze(id), wert() }   div.segment[role=radiogroup] mit button.seg[role=radio]; die .seg-pille gleitet
//       unter die Wahl (gleich breite Spalten, daher ohne Messen). Pfeiltasten, Pos1 und Ende waehlen und fokussieren
//       (nur die Wahl hat tabindex 0). setze() ruft beiWahl nicht.
//   schalter({ name, an, beiWechsel(an), label }) -> { el, setze(an), an() }   button.schalter[role=switch]
//   regler({ name, wert, min = 0, max = 1, schritt = 0.05, beiAenderung(w, { fertig }), label, format(w), links, rechts })
//       -> { el, setze(w), wert() }   div.regler-zeile mit div.regler[role=slider]: Ziehen und Tippen (Pointer), Pfeiltasten
//       (ein Schritt), Bild auf/ab (zehn), Pos1/Ende. fertig ist true beim Loslassen und bei Tasten.
//   sheet({ titel, text, knoepfe: [{ text, wert, art }], abbrechen = null }) -> Promise<wert>   Blatt von unten ueber
//       einem Schleier; Escape und Tipp auf den Schleier liefern abbrechen, der Fokus bleibt im Blatt.
//   schliesseSheet()   offenes Blatt mit abbrechen schliessen (app.js beim Screen-Wechsel)
//   halteKnopf({ text, icon, dauer = 1000, beiAusloesen(), frage: { titel, text, ja, nein }, klasse, label, hinweis })
//       -> { el, verlasse() }   Finger oder Maus halten: ein Ring fuellt sich in dauer ms, dann beiAusloesen(); frueher
//       loslassen bricht ab (mit hinweis als Meldung). Ein Klick ohne Zeiger (Tastatur, VoiceOver) oeffnet stattdessen das
//       Blatt mit der Rueckfrage frage; erst "ja" loest aus. Die Haltezeit haengt nicht am Animationstempo.
//   toast(text, { art: 'info' | 'fehler', dauer = 3200 }) und toastLeeren()   Meldung (div.toast-ort > div.toast),
//       in der Partie oben (CSS). app.meldung() benutzt toast().
//   miniBrett(fen, { zuletzt: ['e4', ...], klasse }) -> HTML   kleines Vorschau-Brett in Flos Brettfarben (--feld-*),
//       Figuren aus assets/pieces/ (cburnett)
import { klang } from '../sounds.js';
import { anim, tempo } from '../bewegung.js';
import { t } from '../sprache.js';
import '../sprachen/allgemein.js';
import '../sprachen/rahmen.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tonSpielen = (name) => { try { klang.spiele(name); } catch (e) { /* Klang ist nie wichtig genug fuer einen Fehler */ } };
const PIECES = new URL('../../assets/pieces/', import.meta.url).href;

// ---------- Segment ----------
export function segment({ name = '', optionen = [], wert = null, beiWahl = null, klasse = '', label = '' } = {}) {
  const el = document.createElement('div');
  el.className = 'segment' + (klasse ? ' ' + klasse : '');
  el.setAttribute('role', 'radiogroup');
  if (label) el.setAttribute('aria-label', label);
  if (name) el.dataset.seg = name;
  el.style.setProperty('--n', String(Math.max(1, optionen.length)));
  el.innerHTML = '<span class="seg-pille" aria-hidden="true"></span>' + optionen.map((o) =>
    `<button class="seg dr${o.zeile ? ' seg-zeile' : ''}" role="radio" type="button" data-wert="${esc(o.id)}"` +
    `${o.label ? ` aria-label="${esc(o.label)}"` : ''}>${o.html || esc(o.text)}${o.klein ? `<small>${esc(o.klein)}</small>` : ''}</button>`).join('');
  const knoepfe = [...el.querySelectorAll('.seg')];
  const pille = el.querySelector('.seg-pille');
  let aktuell = null;
  function setze(id) {
    let i = knoepfe.findIndex((k) => k.dataset.wert === String(id));
    if (i < 0) i = 0;
    aktuell = knoepfe[i] ? knoepfe[i].dataset.wert : null;
    knoepfe.forEach((k, n) => {
      k.setAttribute('aria-checked', n === i ? 'true' : 'false');
      k.tabIndex = n === i ? 0 : -1;
    });
    pille.style.transform = `translateX(${i * 100}%)`;
    el.dataset.wert = aktuell ?? '';
  }
  function waehle(k, quelle) {
    if (!k || k.disabled) return;
    if (k.dataset.wert === aktuell) return;
    setze(k.dataset.wert);
    tonSpielen('klick');
    if (typeof beiWahl === 'function') beiWahl(aktuell, { quelle });
  }
  el.addEventListener('click', (e) => {
    const k = e.target.closest('.seg');
    if (k && el.contains(k)) waehle(k, 'klick');
  });
  el.addEventListener('keydown', (e) => {
    const i = knoepfe.findIndex((k) => k.dataset.wert === aktuell);
    let n = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % knoepfe.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + knoepfe.length) % knoepfe.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = knoepfe.length - 1;
    if (n == null || !knoepfe[n]) return;
    e.preventDefault();
    waehle(knoepfe[n], 'taste');
    knoepfe[n].focus();
  });
  setze(wert);
  return { el, setze, wert: () => aktuell };
}

// ---------- Schalter ----------
export function schalter({ name = '', an = false, beiWechsel = null, label = '' } = {}) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'schalter dr';
  el.setAttribute('role', 'switch');
  if (label) el.setAttribute('aria-label', label);
  if (name) el.dataset.schalter = name;
  el.innerHTML = '<i aria-hidden="true"></i>';
  let zustand = !!an;
  const setze = (wert) => { zustand = !!wert; el.setAttribute('aria-checked', zustand ? 'true' : 'false'); };
  el.addEventListener('click', () => {
    setze(!zustand);
    tonSpielen('schalter');
    if (typeof beiWechsel === 'function') beiWechsel(zustand);
  });
  setze(zustand);
  return { el, setze, an: () => zustand };
}

// ---------- Regler ----------
const runde = (w, schritt, min) => {
  const s = Number(schritt) > 0 ? Number(schritt) : 0;
  if (!s) return w;
  const n = Math.round((w - min) / s);
  // Kommastellen des Schritts behalten (0.05 * 3 = 0.15000000000000002)
  const stellen = (String(s).split('.')[1] || '').length;
  return Number((min + n * s).toFixed(stellen));
};

export function regler({ name = '', wert = 0, min = 0, max = 1, schritt = 0.05, beiAenderung = null, label = '', format = null,
  links = '', rechts = '' } = {}) {
  const el = document.createElement('div');
  el.className = 'regler-zeile';
  if (name) el.dataset.regler = name;
  const fmt = typeof format === 'function' ? format : (w) => t('rahmen.bauteile.prozent', { wert: Math.round(((w - min) / ((max - min) || 1)) * 100) });
  el.innerHTML = `${links || ''}<div class="regler" role="slider" tabindex="0" aria-valuemin="${min}" aria-valuemax="${max}"` +
    `${label ? ` aria-label="${esc(label)}"` : ''}><span class="regler-innen"><span class="bahn"><span class="fuell"></span></span>` +
    `<span class="knauf" aria-hidden="true"></span></span></div>${rechts || ''}<output class="regler-wert zahl"></output>`;
  const r = el.querySelector('.regler');
  const innen = el.querySelector('.regler-innen');
  const ausgabe = el.querySelector('.regler-wert');
  let w = min;
  function setze(neu) {
    const z = Number(neu);
    w = Math.min(max, Math.max(min, runde(Number.isFinite(z) ? z : min, schritt, min)));
    const anteil = (w - min) / ((max - min) || 1);
    r.style.setProperty('--w', String(anteil));
    r.setAttribute('aria-valuenow', String(w));
    r.setAttribute('aria-valuetext', fmt(w));
    ausgabe.textContent = fmt(w);
  }
  function melde(fertig) { if (typeof beiAenderung === 'function') beiAenderung(w, { fertig }); }
  function ausZeiger(x) {
    const b = innen.getBoundingClientRect();
    if (!b.width) return;
    const vorher = w;
    setze(min + ((x - b.left) / b.width) * (max - min));
    if (w !== vorher) melde(false);
  }
  let zieht = null;
  r.addEventListener('pointerdown', (e) => {
    if (e.button != null && e.button > 0) return;
    zieht = e.pointerId;
    try { r.setPointerCapture(e.pointerId); } catch (f) { /* egal */ }
    r.classList.add('zieht');
    ausZeiger(e.clientX);
  });
  r.addEventListener('pointermove', (e) => { if (zieht === e.pointerId) ausZeiger(e.clientX); });
  const los = (e) => {
    if (zieht !== e.pointerId) return;
    zieht = null;
    r.classList.remove('zieht');
    melde(true);
  };
  r.addEventListener('pointerup', los);
  r.addEventListener('pointercancel', los);
  r.addEventListener('keydown', (e) => {
    const s = Number(schritt) > 0 ? Number(schritt) : (max - min) / 20;
    let neu = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') neu = w + s;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') neu = w - s;
    else if (e.key === 'PageUp') neu = w + s * 10;
    else if (e.key === 'PageDown') neu = w - s * 10;
    else if (e.key === 'Home') neu = min;
    else if (e.key === 'End') neu = max;
    if (neu == null) return;
    e.preventDefault();
    const vorher = w;
    setze(neu);
    if (w !== vorher) melde(true);
  });
  setze(wert);
  return { el, setze, wert: () => w };
}

// ---------- Sheet (Blatt von unten) ----------
let offenesSheet = null;
export function schliesseSheet() {
  if (offenesSheet) offenesSheet.ende();
}

export function sheet({ titel = '', text = '', knoepfe = [{ text: 'OK', wert: true, art: 'primaer' }], abbrechen = null } = {}) {
  schliesseSheet();
  return new Promise((resolve) => {
    const ort = document.createElement('div');
    ort.className = 'sheet-ort';
    const id = 'sh' + Date.now().toString(36) + Math.floor(Math.random() * 1e4);
    ort.innerHTML = `<div class="sheet-schleier"></div>
      <div class="sheet-karte" role="alertdialog" aria-modal="true" aria-labelledby="${id}-t"${text ? ` aria-describedby="${id}-x"` : ''}>
        <div class="sheet-griff" aria-hidden="true"></div><h3 id="${id}-t"></h3>${text ? `<p id="${id}-x"></p>` : ''}<div class="sheet-knoepfe"></div></div>`;
    ort.querySelector('h3').textContent = titel;
    if (text) ort.querySelector('p').textContent = text;
    const karte = ort.querySelector('.sheet-karte');
    const schleier = ort.querySelector('.sheet-schleier');
    const leiste = ort.querySelector('.sheet-knoepfe');
    const vorherFokus = document.activeElement;
    let fertig = false;
    const taste = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); ende(abbrechen); return; }
      if (e.key === 'Tab') {
        const k = [...leiste.querySelectorAll('button')];
        if (!k.length) return;
        const i = k.indexOf(document.activeElement);
        const naechster = e.shiftKey ? (i <= 0 ? k[k.length - 1] : k[i - 1]) : (i < 0 || i === k.length - 1 ? k[0] : k[i + 1]);
        e.preventDefault();
        naechster.focus();
      }
    };
    function ende(wert) {
      if (fertig) return;
      fertig = true;
      document.removeEventListener('keydown', taste, true);
      if (offenesSheet && offenesSheet.ort === ort) offenesSheet = null;
      ort.classList.add('weg');
      if (tempo() === 0) ort.remove();
      else {
        const a = anim(karte, [{ transform: 'none' }, { transform: 'translateY(110%)' }], { d: 260, k: 'raus', fill: 'forwards' });
        anim(schleier, [{ opacity: 1 }, { opacity: 0 }], { d: 220, k: 'sanft', fill: 'forwards' });
        Promise.resolve(a.finished).catch(() => {}).then(() => ort.remove());
      }
      if (vorherFokus && vorherFokus.isConnected && typeof vorherFokus.focus === 'function') {
        try { vorherFokus.focus({ preventScroll: true }); } catch (f) { /* egal */ }
      }
      resolve(wert);
    }
    for (const k of knoepfe) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'knopf gross dr' + (k.art ? ' ' + k.art : '');
      b.textContent = k.text;
      b.addEventListener('click', () => ende(k.wert));
      leiste.append(b);
    }
    schleier.addEventListener('pointerdown', () => ende(abbrechen));
    document.addEventListener('keydown', taste, true);
    document.body.append(ort);
    offenesSheet = { ort, ende: () => ende(abbrechen) };
    anim(karte, [{ transform: 'translateY(100%)' }, { transform: 'none' }], { d: 480, k: 'gleiten' });
    anim(schleier, [{ opacity: 0 }, { opacity: 1 }], { d: 260, k: 'sanft' });
    // Rueckfrage zum Aufgeben: der sichere Knopf (ohne Art "gefahr") bekommt den Fokus
    const erster = leiste.querySelector('.primaer') || [...leiste.querySelectorAll('button')].find((b) => !b.classList.contains('gefahr'))
      || leiste.querySelector('button');
    if (erster) erster.focus({ preventScroll: true });
  });
}

// ---------- Halte-Knopf ----------
export function halteKnopf({ text = '', icon = '', dauer = 1000, beiAusloesen = null, frage = null, klasse = '', label = '', hinweis = '' } = {}) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'knopf halte-knopf' + (klasse ? ' ' + klasse : '');
  el.setAttribute('aria-label', label || t('rahmen.bauteile.halten', { text }));
  el.innerHTML = `<span class="halte-symbol"><svg class="halte-ring" viewBox="0 0 36 36" aria-hidden="true" focusable="false">` +
    `<circle class="halte-bahn" cx="18" cy="18" r="16"/><circle class="halte-fuell" cx="18" cy="18" r="16" pathLength="100"/></svg>` +
    `${icon || ''}</span><span class="halte-text">${esc(text)}</span>`;
  const fuell = el.querySelector('.halte-fuell');
  const ms = Math.max(200, Number(dauer) || 1000);
  let laeuft = null;     // { id, uhr, a }
  let zeigerZeit = 0;    // letzter pointerdown: ein Klick danach kam vom Zeiger, nicht von der Tastatur
  let weg = false;
  const ausloesen = () => { if (!weg && typeof beiAusloesen === 'function') beiAusloesen(); };
  function abbruch(mitHinweis) {
    if (!laeuft) return;
    clearTimeout(laeuft.uhr);
    if (laeuft.a) try { laeuft.a.cancel(); } catch (e) { /* egal */ }
    laeuft = null;
    el.classList.remove('haelt');
    if (mitHinweis && hinweis) toast(hinweis, { dauer: 1800 });
  }
  el.addEventListener('pointerdown', (e) => {
    if (el.disabled || (e.button != null && e.button > 0)) return;
    zeigerZeit = Date.now();
    abbruch(false);
    try { el.setPointerCapture(e.pointerId); } catch (f) { /* egal */ }
    el.classList.add('haelt');
    // Ring: die Haltezeit ist eine Sicherung, keine Zierde, deshalb immer dauer ms (auch bei Tempo aus)
    let a = null;
    if (typeof fuell.animate === 'function') {
      a = fuell.animate([{ strokeDashoffset: 100 }, { strokeDashoffset: 0 }], { duration: ms, easing: 'linear', fill: 'forwards' });
    }
    const id = e.pointerId;
    laeuft = { id, a, uhr: setTimeout(() => {
      if (!laeuft || laeuft.id !== id) return;
      laeuft = null;
      el.classList.remove('haelt');
      el.classList.add('ausgeloest');
      setTimeout(() => { el.classList.remove('ausgeloest'); if (a) try { a.cancel(); } catch (f) { /* egal */ } }, 400);
      ausloesen();
    }, ms) };
  });
  el.addEventListener('pointerup', (e) => {
    zeigerZeit = Date.now();
    if (laeuft && laeuft.id === e.pointerId) abbruch(true);
  });
  el.addEventListener('pointercancel', (e) => { zeigerZeit = Date.now(); if (laeuft && laeuft.id === e.pointerId) abbruch(false); });
  el.addEventListener('lostpointercapture', (e) => { if (laeuft && laeuft.id === e.pointerId) abbruch(false); });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('click', (e) => {
    // Klick direkt nach einem Zeiger: das Halten entscheidet (oder hat schon entschieden), nicht der Klick.
    // Tastatur und Bedienhilfen klicken ohne Zeiger (detail 0): dann die Rueckfrage als Blatt.
    if (e.detail !== 0 && (laeuft || Date.now() - zeigerZeit < 800)) return;
    e.preventDefault();
    const f = frage || {};
    sheet({
      titel: f.titel || text, text: f.text || '',
      knoepfe: [{ text: f.nein || t('allgemein.abbrechen'), wert: false }, { text: f.ja || text, wert: true, art: 'gefahr' }],
      abbrechen: false,
    }).then((ja) => { if (ja) ausloesen(); });
  });
  return { el, verlasse() { weg = true; abbruch(false); } };
}

// ---------- Toast (Meldung) ----------
let toastOrt = null;
let toastUhr = 0;
export function toast(text, { art = 'info', dauer = 3200 } = {}) {
  if (typeof document === 'undefined' || !document.body) return;
  if (!toastOrt || !toastOrt.isConnected) {
    toastOrt = document.createElement('div');
    toastOrt.className = 'toast-ort';
    toastOrt.setAttribute('role', 'status');
    toastOrt.setAttribute('aria-live', 'polite');
    document.body.append(toastOrt);
  }
  const t = document.createElement('div');
  t.className = 'toast ' + (art === 'fehler' ? 'fehler' : 'info');
  t.textContent = String(text);
  toastOrt.replaceChildren(t);
  clearTimeout(toastUhr);
  toastUhr = setTimeout(() => {
    t.classList.add('weg');
    toastUhr = setTimeout(() => t.remove(), 320);
  }, dauer);
}
export function toastLeeren() {
  clearTimeout(toastUhr);
  if (toastOrt) toastOrt.replaceChildren();
}

// ---------- Mini-Brett ----------
const FIGUR = /^[prnbqkPRNBQK]$/;
export function miniBrett(fen, { zuletzt = [], klasse = '' } = {}) {
  const reihen = String(fen || '').trim().split(/\s+/)[0].split('/');
  const felder = [];
  for (let r = 0; r < 8; r++) {
    const zeile = reihen[r] || '8';
    let f = 0;
    for (const z of zeile) {
      if (f >= 8) break;
      if (/[1-8]/.test(z)) { for (let i = 0; i < Number(z) && f < 8; i++, f++) felder.push(null); }
      else if (FIGUR.test(z)) { felder.push((z === z.toUpperCase() ? 'w' : 'b') + z.toUpperCase()); f++; }
    }
    while (f < 8) { felder.push(null); f++; }
  }
  const markiert = new Set((Array.isArray(zuletzt) ? zuletzt : []).map((x) => String(x).toLowerCase()));
  let html = '';
  for (let i = 0; i < 64; i++) {
    const r = Math.floor(i / 8);
    const c = i % 8;
    const name = 'abcdefgh'[c] + (8 - r);
    const dunkel = (r + c) % 2 === 1;
    const fig = felder[i];
    html += `<i class="${dunkel ? 'd' : 'h'}${markiert.has(name) ? ' z' : ''}">${fig ? `<img src="${PIECES}${fig}.svg" alt="" loading="lazy" draggable="false">` : ''}</i>`;
  }
  return `<div class="mini${klasse ? ' ' + esc(klasse) : ''}" aria-hidden="true">${html}</div>`;
}
