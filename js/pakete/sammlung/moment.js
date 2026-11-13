// Freischalt-Moment der Erfolgs-Stufen (Konzept 06.11.2026, 5b): eine Karte dreht sich mit Klang und zeigt Stufe, Taler und
// bei Gold den Titel oder das Banner. Bei "Bewegung reduzieren" (js/bewegung.js tempo 0) nur Einblenden, ohne Drehung.
// Mehrere neue Stufen kommen nacheinander; laeuft gerade eine Partie, warten sie bis zum naechsten Bildschirmwechsel.
//
//   zeigeStufen([{ familie, stufe, taler, lohn }])   reiht ein und zeigt, sobald die Buehne frei ist
//   lohnText(lohn) -> 'Titel frei: …' | 'Banner frei: …' | ''
//   zielText({ familie, gold }) -> 'Ziel für Gold: 100 Siege gegen Bots' | ''
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

// R13-G3 (Flos Wahl "satz"): das Bild zeigt die Gold-Medaille der Familie (z. B. "100" = 100 Siege); der Satz sagt, wofuer
// die Zahl steht. Liga zaehlt Stufen, dort steht der Weg in Worten.
export function zielText(x) {
  if (!x) return '';
  if (x.familie === 'liga') return K('zeile.liga');
  return Number.isInteger(x.gold) && x.gold > 0 ? K('moment.ziel', { n: x.gold, was: K('was.' + x.familie) }) : '';
}

// waehrend einer Partie nicht ueber das Brett legen (das Ergebnis hat Vorrang), und nie ueber ein offenes Blatt oder einen
// Dialog (Feinschliff R8, LG4 A: vorher lag "Ligaaufstieg" z. B. ueber dem offenen Shop-Blatt, zwei Ebenen uebereinander).
// Es zaehlt nur ein sichtbares Blatt: nicht beim Schliessen (.weg, es gleitet noch hinaus) und nicht versteckt im Dokument
// (z. B. die Tafel der Meisterschule mit hidden).
const blattOffen = () => [...document.querySelectorAll('[aria-modal="true"]:not(.st-moment)')]
  .some((e) => !e.closest('.weg, [hidden]') && e.getClientRects().length > 0);
const buehneFrei = () => typeof document !== 'undefined' && !document.querySelector('.screen.partie') && !blattOffen();

// wartet ein Erfolg auf ein offenes Blatt, kommt er, sobald es zu ist (sonst erst beim naechsten Bildschirmwechsel)
let wache = null;
function warteAufBlatt() {
  if (wache || typeof MutationObserver === 'undefined' || !blattOffen()) return;
  wache = new MutationObserver(() => {
    if (blattOffen()) return;
    wache.disconnect(); wache = null;
    setTimeout(naechste, 300);
  });
  wache.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-modal'] });
}

function naechste() {
  if (offen || !schlange.length) return;
  if (!buehneFrei()) { warteAufBlatt(); return; }
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
      ${zielText(x) ? `<span class="st-ziel">${esc(zielText(x))}</span>` : ''}
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
