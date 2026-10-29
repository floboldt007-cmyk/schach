// Paket Finisher: nutzt ausschliesslich den Aufruf-Ort partie:matt. Es aendert weder Partie noch Ergebnis.
// Freischaltregel: Krone ist frei, Schachbrett-Welle ab Funken-Level 5, Fallender Koenig ab Level 10.
// Die festen Stufen sind nachvollziehbar, enthalten keinen Zufall und keine Kaufmoeglichkeit.
import { anbieten } from '../../orte.js';
import { ladeModul, ladeModulEinstellungen, speichereModulEinstellungen } from '../../storage.js';
import { klang } from '../../sounds.js';
import { t } from '../../sprache.js';
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
  Object.freeze({ id: 'aus', text: 'aus', level: 1 }),
  Object.freeze({ id: 'krone', text: 'krone', level: 1 }),
  Object.freeze({ id: 'welle', text: 'welle', level: 5 }),
  Object.freeze({ id: 'koenig', text: 'koenig', level: 10 }),
]);

export function aktuellesLevel() {
  const st = ladeModul('funken', {});
  return Number.isInteger(st && st.level) ? Math.max(1, st.level) : 1;
}
export function istFrei(id, level = aktuellesLevel()) {
  const f = FINISHER.find((x) => x.id === id);
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
  if (id === 'welle') {
    el.innerHTML = Array.from({ length: 64 }, (_, i) => {
      const x = i % 8, y = Math.floor(i / 8), abstand = Math.abs(x + .5 - p.x / 12.5) + Math.abs(y + .5 - p.y / 12.5);
      return `<i style="--x:${x};--y:${y};--v:${Math.round(abstand) * 55}ms"></i>`;
    }).join('');
  }
  ctx.buehne.effekte.appendChild(el);
  // Ein vorhandener grosser Moment; bei ruhigem Standbild bleibt auch der Klang aus.
  if (!reduziert) klang.spiele('sieg');
  let timer = null, fertig;
  const aufraeumen = () => { if (timer) clearTimeout(timer); el.remove(); fertig(); };
  const promise = new Promise((resolve) => { fertig = resolve; });
  const dauer = reduziert ? Math.min(650, ctx.kurzMs || 650) : Math.min(1750, ctx.dauerMs || 1750);
  timer = setTimeout(aufraeumen, dauer);
  if (ctx.signal) ctx.signal.addEventListener('abort', aufraeumen, { once: true });
  return { fertig: promise, verlasse: aufraeumen };
}

function einstellungen() {
  const level = aktuellesLevel();
  const gewaehlt = auswahl(level);
  const el = document.createElement('section'); el.className = 'es-gruppe flaeche fi-einstellungen';
  el.innerHTML = `<h3 class="es-titel">${esc(F('titel'))}</h3><p>${esc(F('erklaerung'))}</p><div class="fi-auswahl" role="radiogroup" aria-label="${esc(F('titel'))}"></div>`;
  const gruppe = el.querySelector('.fi-auswahl');
  for (const f of FINISHER) {
    const frei = istFrei(f.id, level); const aktiv = f.id === gewaehlt;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'fi-wahl'; b.dataset.finisherWahl = f.id;
    b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', aktiv ? 'true' : 'false'); b.disabled = !frei;
    const hinweis = f.id === 'aus' ? '' : f.level === 1 ? F('frei') : F('level', { level: f.level });
    b.innerHTML = `<b>${frei ? '' : '🔒 '}${esc(F(f.text))}</b><span>${esc(frei && aktiv ? F('gewaehlt') : hinweis)}</span>`;
    if (!frei) b.setAttribute('aria-label', `${F(f.text)}. ${F('gesperrt', { level: f.level })}`);
    b.addEventListener('click', () => {
      if (!frei) return;
      speichereModulEinstellungen(MODUL, { auswahl: f.id });
      for (const x of gruppe.querySelectorAll('.fi-wahl')) x.setAttribute('aria-checked', x === b ? 'true' : 'false');
      for (const x of gruppe.querySelectorAll('.fi-wahl span')) x.textContent = '';
      b.querySelector('span').textContent = F('gewaehlt');
    });
    gruppe.appendChild(b);
  }
  return el;
}

anbieten('partie:matt', (ctx) => starteFinisher(ctx), { paket: MODUL });
anbieten('einstellungen:gruppen', einstellungen, { paket: MODUL, reihenfolge: 45 });

if (typeof window !== 'undefined' && /[?&]test\b/.test(location.search || '')) window.__finisher = { FINISHER, istFrei, auswahl, starteFinisher };
