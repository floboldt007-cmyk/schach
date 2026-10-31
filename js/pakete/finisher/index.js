// Paket Finisher: nutzt ausschliesslich den Aufruf-Ort partie:matt. Es aendert weder Partie noch Ergebnis.
// Freischaltregel: Krone ist frei, Schachbrett-Welle ab Funken-Level 5, Fallender Koenig ab Level 10.
// Als Erfinder (Flo, Sonderstueck vom Server) sind alle Stufen frei, unabhaengig vom Level.
// Signatur gehoert zu Flos Erfinder-Profil (js/sonderstuecke.js): frei nur mit dem Sonderstueck vom Server; wer es nicht
// hat, sieht es nicht in der Sammlung (kein leerer Platz).
// Die festen Stufen sind nachvollziehbar, enthalten keinen Zufall und keine Kaufmoeglichkeit. Die Level-Leiter
// (funken/level.js, Stuecke 'finisher-<id>') nennt genau diese Stufen; tests/funken.test.mjs vergleicht beide.
// Klang: den Siegesklang spielt die Partie selbst; der Finisher hat einen eigenen Klang in der Gruppe 'finisher'.
import { anbieten } from '../../orte.js';
import { ladeModul, ladeModulEinstellungen, speichereModulEinstellungen } from '../../storage.js';
import { klang } from '../../sounds.js';
import { t } from '../../sprache.js';
import { bereich } from '../../ui/ich.js';
import { hatSonderstueck, istErfinder, ERFINDER } from '../../sonderstuecke.js';
import { finisherKunst } from '../../sammlung-kunst.js';
import { figurenPfad } from '../../figurensatz.js';
import './texte.js';

const MODUL = 'finisher';
const F = (k, w) => t('p-finisher.' + k, w);

// Paket-CSS nur zusammen mit dem Paket laden; ?test&kern bleibt dadurch wirklich paketfrei.
if (typeof document !== 'undefined' && !document.querySelector('link[data-paket="finisher"]')) {
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.dataset.paket = 'finisher';
  css.href = new URL('../../../css/pakete/finisher.css', import.meta.url).href;
  document.head.appendChild(css);
}
export const FINISHER = Object.freeze([
  Object.freeze({ id: 'aus', text: 'aus', level: 1, klang: null }),
  Object.freeze({ id: 'krone', text: 'krone', level: 1, klang: 'finisher-glocke' }),
  Object.freeze({ id: 'welle', text: 'welle', level: 5, klang: 'finisher-kreide' }),
  Object.freeze({ id: 'koenig', text: 'koenig', level: 10, klang: 'finisher-tinte' }),
  Object.freeze({ id: 'signatur', text: 'signatur', level: 1, klang: 'finisher-tinte', sonder: ERFINDER.finisher }),
]);
// was dieses Konto sehen darf: alle Stufen-Finisher, Sonderstuecke nur mit Besitz
const sichtbar = (f) => !f.sonder || hatSonderstueck(f.sonder);

export function aktuellesLevel() {
  const st = ladeModul('funken', {});
  return Number.isInteger(st && st.level) ? Math.max(1, st.level) : 1;
}
export function istFrei(id, level = aktuellesLevel()) {
  const f = FINISHER.find((x) => x.id === id);
  if (f && f.sonder) return hatSonderstueck(f.sonder);
  // Erfinder: alles Ausruestbare frei (js/sonderstuecke.js)
  if (f && istErfinder()) return true;
  return !!f && level >= f.level;
}
export function auswahl(level = aktuellesLevel()) {
  const e = ladeModulEinstellungen(MODUL, { auswahl: 'krone' }) || {};
  return istFrei(e.auswahl, level) ? e.auswahl : 'krone';
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function punkt(buehne, feld) {
  const p = buehne.feld(feld);
  return p ? { x: (p.x + .5) * 12.5, y: (p.y + .5) * 12.5 } : { x: 50, y: 50 };
}

export function starteFinisher(ctx, id = auswahl()) {
  if (id === 'aus' || ctx.gewinner !== 'flo') return null;
  // schon abgebrochen (frueher Tipp): ohne Klang und Animation sofort fertig, das Ergebnis wartet nicht
  if (ctx.signal && ctx.signal.aborted) return { fertig: Promise.resolve(), verlasse: () => {} };
  const reduziert = !!ctx.reduziert;
  const ziel = id === 'koenig' ? ctx.koenigFeld : (ctx.letzterZug && ctx.letzterZug.nach);
  const p = punkt(ctx.buehne, ziel);
  const el = document.createElement('div');
  el.className = `finisher finisher-${id}${reduziert ? ' ist-ruhig' : ''}`;
  el.dataset.finisher = id;
  el.setAttribute('aria-hidden', 'true');
  el.style.setProperty('--fx', `${p.x}%`); el.style.setProperty('--fy', `${p.y}%`);
  if (id === 'krone') el.innerHTML = '<span class="fi-krone">♛</span><span class="fi-glanz">✦</span>';
  if (id === 'koenig') el.innerHTML = '<span class="fi-koenig">♚</span>';
  // Signatur: ein goldener Namenszug und eine Linie unter der Partie, darunter "Nr. 0"
  if (id === 'signatur') el.innerHTML = '<svg class="fi-signatur" viewBox="0 0 100 40"><path class="fi-zug" d="M10 26c9-2 16-12 20-21 2 9-2 18 2 20s9-12 11-16c0 7 2 12 11 12 6 0 10-4 14-8"/>'
    + '<path class="fi-linie" d="M8 34h84"/></svg><span class="fi-nr">Nr. 0</span>';
  if (id === 'welle') {
    el.innerHTML = Array.from({ length: 64 }, (_, i) => {
      const x = i % 8, y = Math.floor(i / 8), abstand = Math.abs(x + .5 - p.x / 12.5) + Math.abs(y + .5 - p.y / 12.5);
      return `<i style="--x:${x};--y:${y};--v:${Math.round(abstand) * 55}ms"></i>`;
    }).join('');
  }
  ctx.buehne.effekte.appendChild(el);
  // Eigener Klang (Gruppe 'finisher', einzeln abschaltbar), nie ein zweites 'sieg'; bei ruhigem Standbild still.
  const f = FINISHER.find((x) => x.id === id);
  if (!reduziert && f && f.klang) klang.spiele(f.klang);
  let timer = null, fertig;
  const aufraeumen = () => { if (timer) clearTimeout(timer); el.remove(); fertig(); };
  const promise = new Promise((resolve) => { fertig = resolve; });
  const dauer = reduziert ? Math.min(650, ctx.kurzMs || 650) : Math.min(1750, ctx.dauerMs || 1750);
  timer = setTimeout(aufraeumen, dauer);
  if (ctx.signal) ctx.signal.addEventListener('abort', aufraeumen, { once: true });
  return { fertig: promise, verlasse: aufraeumen };
}

// Einstellungen (Flo 31.10.2026: "doppelt sich"): nur noch an oder aus. Welcher Finisher laeuft, waehlt man in der
// Sammlung; "zuletzt" merkt sich die Wahl, damit Einschalten den vorigen Finisher zurueckbringt.
function einstellungen() {
  const el = document.createElement('section'); el.className = 'es-gruppe flaeche fi-einstellungen';
  const an = () => auswahl() !== 'aus';
  el.innerHTML = `<h3 class="es-titel">${esc(F('titel'))}</h3>
    <div class="es-zeile">
      <div class="es-text"><b id="es-l-finisher">${esc(F('an'))}</b><span id="es-t-finisher">${esc(F('anText'))}</span></div>
      <button class="es-schalter fi-schalter" type="button" role="switch" aria-labelledby="es-l-finisher" aria-describedby="es-t-finisher"
        aria-checked="${an()}"><i></i></button>
    </div>
    <p class="es-hilfe">${esc(F('wahlHinweis'))}</p>`;
  const schalter = el.querySelector('.fi-schalter');
  const umschalten = () => {
    const e = ladeModulEinstellungen(MODUL, {}) || {};
    if (an()) speichereModulEinstellungen(MODUL, { auswahl: 'aus', zuletzt: auswahl() });
    else speichereModulEinstellungen(MODUL, { auswahl: e.zuletzt && e.zuletzt !== 'aus' && istFrei(e.zuletzt) ? e.zuletzt : 'krone' });
    schalter.setAttribute('aria-checked', String(an()));
  };
  schalter.addEventListener('click', umschalten);
  el.querySelector('.es-text').addEventListener('click', umschalten);
  return el;
}

anbieten('partie:matt', (ctx) => starteFinisher(ctx), { paket: MODUL });
anbieten('einstellungen:gruppen', einstellungen, { paket: MODUL, reihenfolge: 45 });
// Sammlung (Reiter Ich): jeder Finisher mit Schloss und Stufe, der ausgewaehlte als "Ausgeruestet". Bild: der Moment
// des Finishers mit den echten Figuren des ausgeruesteten Satzes (js/sammlung-kunst.js, Flo 31.10.2026)
anbieten('sammlung:bereich', () => {
  const lv = aktuellesLevel();
  const gewaehlt = auswahl(lv);
  const figuren = new URL('../../../' + figurenPfad(), import.meta.url).href;
  return bereich({ id: 'finisher', name: F('titel'), teile: FINISHER.filter((x) => x.id !== 'aus' && sichtbar(x)).map((x) => ({
    id: 'finisher-' + x.id, name: F(x.text), frei: istFrei(x.id, lv), an: gewaehlt === x.id,
    // Tipp waehlt, ein zweiter Tipp auf den gewaehlten schaltet den Finisher aus (wie die Lobby-Musik)
    wahl: () => speichereModulEinstellungen(MODUL, { auswahl: x.id, zuletzt: x.id }),
    abwahl: () => speichereModulEinstellungen(MODUL, { auswahl: 'aus', zuletzt: x.id }),
    zeile: gewaehlt === x.id ? F('gewaehlt') : istFrei(x.id, lv) ? F('frei') : F('level', { level: x.level }),
    bild: finisherKunst(x.id, figuren) || '',
  })) });
}, { paket: MODUL, reihenfolge: 10 });

if (typeof window !== 'undefined' && /[?&]test\b/.test(location.search || '')) window.__finisher = { FINISHER, istFrei, auswahl, starteFinisher };
