// Emote-Rad und Schnell-Chat. Der Transport bleibt absichtlich hinter senden(): Online kann spaeter andocken.
import { anbieten } from '../../orte.js';
import { ladeModulEinstellungen, speichereModulEinstellungen } from '../../storage.js';
import { t } from '../../sprache.js';
import './texte.js';

const MODUL = 'emotes';
const SPERRZEIT = 3000;
const EMOTES = Object.freeze([
  ['daumen', '<path d="M8 20H4V9h4m0 10c3 1 7 1 9 0l2-7c.3-1.5-.5-3-2-3h-4l1-4c.2-1-1-2-2-1L8 9z"/>'],
  ['lachen', '<circle cx="12" cy="12" r="9"/><path d="M8 10h.01M16 10h.01M8 14c2 3 6 3 8 0"/>'],
  ['staunen', '<circle cx="12" cy="12" r="9"/><path d="M8 9h.01M16 9h.01"/><circle cx="12" cy="15" r="2"/>'],
  ['denken', '<path d="M5 16c-2-1-3-3-3-5 0-4 4-7 9-7s9 3 9 7-4 7-9 7H8l-4 3z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/>'],
  ['respekt', '<path d="M4 13l5 5L20 7l-3-3-8 9-2-3z"/>'],
  ['hallo', '<path d="M7 12V5a1.5 1.5 0 013 0v5-7a1.5 1.5 0 013 0v7-5a1.5 1.5 0 013 0v6-3a1.5 1.5 0 013 0v6c0 5-3 8-8 8-4 0-6-2-8-5l-2-3c-1-2 1-3 3-2l2 2"/>'],
  ['gut', '<path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'],
  ['uff', '<path d="M12 3a9 9 0 109 9"/><path d="M8 10h.01M16 10h.01M8 16c2-2 6-2 8 0M18 3v5m0 3v.01"/>'],
]);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const T = (k, w) => t('p-emotes.' + k, w);
const einstellungen = () => {
  const e = ladeModulEinstellungen(MODUL, { an: true, daempfen: false });
  return { an: e.an !== false, daempfen: e.daempfen === true };
};
const setze = (teil) => speichereModulEinstellungen(MODUL, { ...einstellungen(), ...teil });

function icon(id) {
  const daten = EMOTES.find(([k]) => k === id);
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${daten ? daten[1] : ''}</svg>`;
}

function popup(knopf, art, eintraege, waehlen) {
  const el = document.createElement('div');
  el.className = 'em-popup'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', T(art));
  el.innerHTML = `<div class="em-kopf"><b>${esc(T(art))}</b><button type="button" class="em-zu" aria-label="${esc(T('schliessen'))}">×</button></div><div class="em-auswahl ${art === 'emotes' ? 'em-rad' : ''}"></div>`;
  const auswahl = el.querySelector('.em-auswahl');
  for (const e of eintraege) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'em-wahl';
    b.dataset.wert = e.id; b.setAttribute('aria-label', e.text); b.innerHTML = (e.svg || '') + `<span>${esc(e.text)}</span>`;
    b.addEventListener('click', () => { if (waehlen(e)) schliessen(); }); auswahl.append(b);
  }
  const schliessen = () => { el.remove(); knopf.setAttribute('aria-expanded', 'false'); knopf.focus(); };
  el.querySelector('.em-zu').addEventListener('click', schliessen);
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') schliessen(); });
  knopf.closest('.partie').append(el); knopf.setAttribute('aria-expanded', 'true');
  auswahl.querySelector('button')?.focus();
}

function reaktion(k, quelle) {
  const { buehne, bot } = k;
  const welt = Math.max(1, Math.min(5, Number(bot && bot.welt) || 1));
  const nr = (quelle.length + String(bot && bot.id).length) % 3;
  const text = T(`antwort.${welt}.${nr}`);
  const ms = einstellungen().daempfen ? 1500 : 800;
  buehne.spaeter(() => {
    if (!einstellungen().an) return;
    const antwort = document.createElement('div'); antwort.className = 'em-botantwort'; antwort.textContent = text;
    buehne.el.append(antwort); buehne.spaeter(() => antwort.remove(), einstellungen().daempfen ? 1400 : 2200);
    const live = buehne.el.querySelector('.em-live');
    if (live) live.textContent = T('botSagt', { name: bot.name, text });
  }, ms);
}

function aktionsKnopf(k, art) {
  if (!einstellungen().an) return null;
  let zuletzt = 0;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'knopf em-aktion';
  b.dataset.emoteAktion = art; b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-expanded', 'false');
  b.innerHTML = `${art === 'emotes' ? icon('lachen') : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>'}<span>${esc(T(art))}</span>`;
  b.addEventListener('click', () => {
    k.buehne.el.querySelector('.em-popup')?.remove();
    const istEmote = art === 'emotes';
    const daten = istEmote
      ? EMOTES.map(([id]) => ({ id, text: T('emote.' + id), svg: icon(id) }))
      : Array.from({ length: 6 }, (_, i) => ({ id: String(i), text: T('chat.' + i) }));
    popup(b, art, daten, (e) => {
      const jetzt = Date.now();
      if (istEmote && jetzt - zuletzt < SPERRZEIT) { k.app.meldung(T('bereit')); return false; }
      if (istEmote) zuletzt = jetzt;
      const rand = document.createElement('div'); rand.className = 'em-rand'; rand.innerHTML = e.svg || `<span>${esc(e.text)}</span>`;
      rand.setAttribute('aria-label', e.text); k.buehne.el.append(rand); k.buehne.spaeter(() => rand.remove(), 1800);
      const live = k.buehne.el.querySelector('.em-live'); if (live) live.textContent = T('gesendet', { text: e.text });
      reaktion(k, e.id); return true;
    });
  });
  return b;
}

function gruppe() {
  const e = einstellungen();
  const el = document.createElement('section'); el.className = 'es-gruppe flaeche em-einstellungen';
  el.innerHTML = `<h3>${esc(T('gruppe'))}</h3>${[['an', e.an, 'anText'], ['daempfen', e.daempfen, 'daempfenText']].map(([id, an, text]) => `<label class="em-schalter"><span><b>${esc(T(id))}</b><small>${esc(T(text))}</small></span><input type="checkbox" data-em-einst="${id}" ${an ? 'checked' : ''}></label>`).join('')}`;
  el.querySelectorAll('input').forEach((x) => x.addEventListener('change', () => setze({ [x.dataset.emEinst]: x.checked })));
  return el;
}

function ladeCss() {
  if (typeof document === 'undefined' || document.querySelector('link[data-paket="emotes"]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('../../../css/pakete/emotes.css', import.meta.url).href; l.dataset.paket = MODUL; document.head.append(l);
}

ladeCss();
anbieten('partie:aktionen', (k) => aktionsKnopf(k, 'emotes'), { paket: MODUL, reihenfolge: 20 });
anbieten('partie:aktionen', (k) => aktionsKnopf(k, 'chat'), { paket: MODUL, reihenfolge: 21 });
anbieten('partie:spieler-leiste', ({ buehne }) => { if (!einstellungen().an) return null; const e = document.createElement('span'); e.className = 'em-live sr-only'; e.setAttribute('aria-live', 'polite'); buehne.el.append(e); return e; }, { paket: MODUL, reihenfolge: 80 });
anbieten('einstellungen:gruppen', () => gruppe(), { paket: MODUL, reihenfolge: 40 });

export { EMOTES, SPERRZEIT, einstellungen };
