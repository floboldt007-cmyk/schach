// Bereich "Erfinder" der Sammlung: Flos Erfinder-Profil (Flo, 30.10.2026: "mache die Version fuer mich fuer den
// Erschaffer"; Entwurf Erfinder vom 29.10.: Banner "Blatt 0", Titel "Der Erfinder", "Nr. 0 · 1 von 1", Figurensatz
// "Blaupause", Finisher "Signatur"). Nicht kaeuflich, nicht erspielbar: Was ein Konto besitzt, sagt nur der Server
// (js/sonderstuecke.js). Wer nichts davon hat, sieht weder den Bereich noch einen leeren Platz.
// Beim Oeffnen fragt der Bereich den Server im Hintergrund; aendert sich der Besitz, baut er den Screen neu auf.
//   erfinderBereich({ app }) -> section.sa-bereich[data-bereich="erfinder"] | null
import { bereich } from '../../ui/ich.js';
import { sonderstuecke, ladeSonderstuecke, ERFINDER } from '../../sonderstuecke.js';
import { figurenSatz } from '../../figurensatz.js';
// Signatur: dasselbe Bild wie der Finisher in seinem Bereich (je Aufruf eigene Verlauf-Ids)
import { finisherKunst } from '../../sammlung-kunst.js';
import { t } from '../../sprache.js';
import './texte.js';

const S = (k, w) => t('p-sammlung.' + k, w);
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WURZEL = new URL('../../../', import.meta.url);

// Banner "Blatt 0": eine goldene Krone auf Bauplan-Papier (eigenes Werk, GPL-3.0 wie die App)
const GITTER = Array.from({ length: 27 }, (_, i) => `M${i * 20} 0v200`).join('') + Array.from({ length: 11 }, (_, i) => `M0 ${i * 20}h520`).join('');
export const BANNER = `<svg viewBox="0 0 520 200" class="er-banner-bild" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
  <rect width="520" height="200" fill="#14161C"/>
  <path d="${GITTER}" stroke="rgba(120,170,255,.09)" stroke-width="1"/>
  <g fill="none" stroke="rgba(120,170,255,.28)" stroke-width="1" stroke-dasharray="4 4"><circle cx="260" cy="46" r="38"/><circle cx="162" cy="72" r="24"/><circle cx="358" cy="72" r="24"/><path d="M120 150h280M260 20v150"/></g>
  <path class="er-krone" d="M150 150 L162 72 L206 112 L260 46 L314 112 L358 72 L370 150 Z" fill="rgba(224,162,43,.10)" stroke="#E0A22B" stroke-width="3" stroke-linejoin="round"/>
  <g fill="#E0A22B"><circle cx="162" cy="72" r="6"/><circle cx="260" cy="46" r="7"/><circle cx="358" cy="72" r="6"/></g>
  <path d="M176 136h168" stroke="#E0A22B" stroke-width="2" stroke-dasharray="2 6"/></svg>`;

export function erfinderBereich({ app } = {}) {
  const besitz = new Set(sonderstuecke());
  // im Hintergrund nachfragen; hat sich etwas geaendert, den Screen mit diesem Bereich neu zeigen
  const vorher = [...besitz].sort().join();
  ladeSonderstuecke().then((ids) => {
    if (!ids || [...ids].sort().join() === vorher) return;
    if (!document.querySelector('.sa-screen')) return;
    try { app?.gehe?.('ich', ids.includes(ERFINDER.titel) ? { bereich: 'erfinder' } : {}, { ersetzen: true }); } catch (e) { /* egal */ }
  }).catch(() => {});
  if (!Object.values(ERFINDER).some((id) => besitz.has(id))) return null;

  const blaupause = figurenSatz() === 'blaupause';
  const teile = [];
  if (besitz.has(ERFINDER.banner)) teile.push({ id: ERFINDER.banner, name: S('erfinder.banner'), frei: true, an: true, zeile: S('erfinder.nr'), bild: BANNER });
  if (besitz.has(ERFINDER.titel)) teile.push({ id: ERFINDER.titel, name: S('erfinder.titel'), frei: true, an: true, zeile: S('erfinder.nr'),
    bild: '<span class="er-titel-bild">0</span>' });
  if (besitz.has(ERFINDER.figuren)) teile.push({ id: ERFINDER.figuren, name: S('erfinder.figuren'), frei: true, an: blaupause,
    zeile: blaupause ? S('an') : S('frei'), bild: `<img src="${new URL('assets/pieces/blaupause/wK.svg', WURZEL).href}" alt="">` });
  if (besitz.has(ERFINDER.finisher)) teile.push({ id: ERFINDER.finisher, name: S('erfinder.finisher'), frei: true, zeile: S('erfinder.finisherWo'), bild: finisherKunst('signatur') });
  const s = bereich({ id: 'erfinder', name: S('erfinder.name'), teile, hinweis: S('erfinder.hinweis') });
  s.classList.add('er-bereich');

  if (besitz.has(ERFINDER.banner) || besitz.has(ERFINDER.titel)) {
    const karte = document.createElement('div');
    karte.className = 'er-karte';
    karte.innerHTML = `<div class="er-banner" role="img" aria-label="${esc(S('erfinder.bannerBild'))}">${BANNER}
        <span class="er-ecke er-oben">CROWNMATE · BLATT 0</span><span class="er-ecke er-unten">${esc(S('erfinder.ersterZug'))}</span></div>
      <div class="er-chips">${besitz.has(ERFINDER.titel) ? `<span class="er-chip er-chip-titel">${esc(S('erfinder.titel'))}</span>` : ''}
        <span class="er-chip er-chip-nr">${esc(S('erfinder.nr'))}</span></div>`;
    s.prepend(karte);
  }
  if (besitz.has(ERFINDER.figuren)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'knopf er-figuren';
    b.setAttribute('aria-pressed', blaupause ? 'true' : 'false');
    b.textContent = blaupause ? S('erfinder.figurenAus') : S('erfinder.figurenAn');
    b.addEventListener('click', () => {
      const an = figurenSatz() !== 'blaupause';
      try { app.setzeEinstellungen({ figuren: an ? 'blaupause' : 'cburnett' }); } catch (e) { return; }
      try { app?.gehe?.('ich', { bereich: 'erfinder' }, { ersetzen: true }); } catch (e) { /* egal */ }
    });
    s.append(b);
  }
  return s;
}
