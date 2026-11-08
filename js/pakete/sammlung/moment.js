// Freischalt-Moment der Erfolgs-Stufen (Konzept 06.11.2026, 5b): eine Karte dreht sich mit Klang und zeigt Stufe, Taler und
// bei Gold den Titel oder das Banner. Bei "Bewegung reduzieren" (js/bewegung.js tempo 0) nur Einblenden, ohne Drehung.
// Mehrere neue Stufen kommen nacheinander; laeuft gerade eine Partie, warten sie bis zum naechsten Bildschirmwechsel.
//
//   zeigeStufen([{ familie, stufe, taler, lohn }])   reiht ein und zeigt, sobald die Buehne frei ist
//   lohnText(lohn) -> 'Titel frei: …' | 'Banner frei: …' | ''
import { tempo, anim } from '../../bewegung.js';
import { klang } from '../../sounds.js';
import { hoere } from '../../ereignisse.js';
import { t } from '../../sprache.js';
import { erfolgKunst } from '../../sammlung-kunst.js';
import { FAMILIEN } from './stufen.js';
import './karte-texte.js';
import './texte.js';

const K = (k, w) => t('p-karte.' + k, w);
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const schlange = [];
let offen = null;

export function lohnText(lohn) {
  if (!lohn) return '';
  if (lohn.banner) return K('lohn.banner', { name: K('b.' + lohn.banner) });
  if (lohn.titel) {
    const id = lohn.titel.replace(/^erfolg-/, '');
    const name = /^level-\d+$/.test(id) ? t('p-sammlung.titel.level.' + id.slice(6)) : t('p-sammlung.titel.' + id);
    return K('lohn.titel', { name });
  }
  return '';
}

// waehrend einer Partie nicht ueber das Brett legen (das Ergebnis hat Vorrang)
const buehneFrei = () => typeof document !== 'undefined' && !document.querySelector('.screen.partie');

function naechste() {
  if (offen || !schlange.length || !buehneFrei()) return;
  const x = schlange.shift();
  const f = FAMILIEN.find((y) => y.id === x.familie);
  const bild = (f && f.alt.length && erfolgKunst(f.alt[f.alt.length - 1])) || '';
  const el = document.createElement('div');
  el.className = 'st-moment';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', K('moment.titel'));
  el.innerHTML = `<div class="st-karte" data-stufe="${x.stufe}">
      <p class="st-ueber">${esc(K('moment.titel'))}</p>
      <span class="st-bild" aria-hidden="true">${bild}</span>
      <b class="st-name">${esc(K('fam.' + x.familie))}</b>
      <span class="st-stufe">${esc(K('stufe.' + x.stufe))}</span>
      <span class="st-lohn">${esc(K('lohn.taler', { n: x.taler }))}</span>
      ${x.lohn ? `<span class="st-lohn st-lohn-gold">${esc(lohnText(x.lohn))}</span>` : ''}
      <button type="button" class="knopf primaer st-weiter">${esc(K('moment.weiter'))}</button>
    </div>`;
  const zu = () => { el.remove(); offen = null; naechste(); };
  el.querySelector('.st-weiter').addEventListener('click', zu);
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); zu(); } });
  document.body.appendChild(el);
  offen = el;
  try { klang.spiele('siegel'); } catch (e) { /* ohne Ton */ }
  const karte = el.querySelector('.st-karte');
  // ruhig: ohne Drehung, das Einblenden uebernimmt die CSS-Uebergangsklasse (.st-moment.ruhig)
  if (tempo() > 0) anim(karte, [{ transform: 'perspective(800px) rotateY(-180deg) scale(.8)', opacity: 0 }, { transform: 'none', opacity: 1 }], { d: 700, k: 'weich' });
  else el.classList.add('ruhig');
  el.querySelector('.st-weiter').focus();
}

export function zeigeStufen(neu = []) {
  if (typeof document === 'undefined') return;
  schlange.push(...neu.filter((x) => x && x.familie && x.stufe));
  naechste();
}

if (typeof window !== 'undefined') hoere('app:screen', () => setTimeout(naechste, 400));
