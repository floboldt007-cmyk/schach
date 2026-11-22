// Paket Finisher: nutzt ausschliesslich den Aufruf-Ort partie:matt. Es aendert weder Partie noch Ergebnis.
// Erspielen (R19, Flos Wahl Variante C vom 18.11.2026): Krone, Schachbrett-Welle und Fallender Koenig schaltet der Endgegner
// von Welt 1, 2 und 3 frei; die Freigabe wird nur aus dem Spielstand berechnet. Kronensturz, Blitzschlag, Goldregen und
// Schockwelle bleiben "Bald im Shop" (Flo 01.11. und 15.11.2026: "die kommen in den Shop", "Gekauftes krasser"). Das
// Erfinder-Konto (Sonderstueck vom Server, js/sonderstuecke.js) hat alle frei.
// Signatur gehoert zu Flos Erfinder-Profil: frei nur mit dem Sonderstueck vom Server.
// Klang: den Siegesklang spielt die Partie selbst; der Finisher hat einen eigenen Klang in der Gruppe 'finisher'.
import { ladePaketCss, beimStart } from '../../paket-css.js';
import { anbieten } from '../../orte.js';
import { ladeModul, ladeModulEinstellungen, speichereModulEinstellungen, endgegnerBesiegt } from '../../storage.js';
import { klang } from '../../sounds.js';
import { t } from '../../sprache.js';
import { bereich } from '../../ui/ich.js';
import { endgegnerDerWelt, rufname } from '../../bots.js';
import { hatSonderstueck, istErfinder, ERFINDER } from '../../sonderstuecke.js';
import { finisherKunst } from '../../sammlung-kunst.js';
import { figurenPfad } from '../../figurensatz.js';
import './texte.js';

const MODUL = 'finisher';
const F = (k, w) => t('p-finisher.' + k, w);

// Paket-CSS nur zusammen mit dem Paket laden; ?test&kern bleibt dadurch wirklich paketfrei.
// beim Start hoechstens kurz warten (js/paket-css.js), damit der erste Screen mit Stil malt
await beimStart(ladePaketCss('finisher'));
export const FINISHER = Object.freeze([
  Object.freeze({ id: 'aus', text: 'aus', klang: null }),
  Object.freeze({ id: 'krone', text: 'krone', klang: 'finisher-glocke', welt: 1 }),
  Object.freeze({ id: 'welle', text: 'welle', klang: 'finisher-kreide', welt: 2 }),
  Object.freeze({ id: 'koenig', text: 'koenig', klang: 'finisher-tinte', welt: 3 }),
  // Kronensturz (Flo 08.11.2026): die Krone faellt vom mattgesetzten Koenig, rollt aus und bleibt liegen; Klang wie Krone
  Object.freeze({ id: 'kronensturz', text: 'kronensturz', klang: 'finisher-glocke' }),
  // R19 (Flo 15.11.2026: mehr Finisher, Gekauftes krasser): kurz (dauer hoechstens 1400 ms, die alten bleiben, wie sie sind),
  // nur transform und opacity; frei nur im Labor des Erfinders, sonst im Shop mit Schloss
  Object.freeze({ id: 'blitzschlag', text: 'blitzschlag', klang: 'finisher-kreide', dauer: 1300 }),
  Object.freeze({ id: 'goldregen', text: 'goldregen', klang: 'finisher-glocke', dauer: 1400 }),
  Object.freeze({ id: 'schockwelle', text: 'schockwelle', klang: 'finisher-tinte', dauer: 1200 }),
  Object.freeze({ id: 'signatur', text: 'signatur', klang: 'finisher-tinte', sonder: ERFINDER.finisher }),
]);
// was dieses Konto sehen darf: alle Stufen-Finisher, Sonderstuecke nur mit Besitz
const sichtbar = (f) => !f.sonder || hatSonderstueck(f.sonder);

export function aktuellesLevel() {
  const st = ladeModul('funken', {});
  return Number.isInteger(st && st.level) ? Math.max(1, st.level) : 1;
}
// Frei: der Erfinder hat alle, sonst zaehlt der Endgegner der Welt des Finishers; das Level spielt keine Rolle
export function istFrei(id) {
  const f = FINISHER.find((x) => x.id === id);
  if (!f) return false;
  if (f.id === 'aus') return true;
  if (f.sonder) return hatSonderstueck(f.sonder);
  return istErfinder() || (!!f.welt && endgegnerBesiegt(f.welt));
}
export function auswahl(level = aktuellesLevel()) {
  const e = ladeModulEinstellungen(MODUL, { auswahl: 'krone' }) || {};
  if (istFrei(e.auswahl, level)) return e.auswahl;
  return istErfinder() ? 'krone' : 'aus';
}
// Der Schalter in den Einstellungen erscheint erst, wenn es etwas zu schalten gibt
const hatFinisher = () => FINISHER.some((x) => x.id !== 'aus' && istFrei(x.id));

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
  const ziel = id === 'koenig' || id === 'kronensturz' || id === 'blitzschlag' ? ctx.koenigFeld : (ctx.letzterZug && ctx.letzterZug.nach);
  const p = punkt(ctx.buehne, ziel);
  const el = document.createElement('div');
  el.className = `finisher finisher-${id}${reduziert ? ' ist-ruhig' : ''}`;
  el.dataset.finisher = id;
  el.setAttribute('aria-hidden', 'true');
  el.style.setProperty('--fx', `${p.x}%`); el.style.setProperty('--fy', `${p.y}%`);
  if (id === 'krone') el.innerHTML = '<span class="fi-krone">♛</span><span class="fi-glanz">✦</span>';
  if (id === 'koenig') el.innerHTML = '<span class="fi-koenig">♚</span>';
  if (id === 'kronensturz') el.innerHTML = '<span class="fi-sturz">♛</span>';
  // Signatur: ein goldener Namenszug und eine Linie unter der Partie, darunter "Nr. 0"
  if (id === 'signatur') el.innerHTML = '<svg class="fi-signatur" viewBox="0 0 100 40"><path class="fi-zug" d="M10 26c9-2 16-12 20-21 2 9-2 18 2 20s9-12 11-16c0 7 2 12 11 12 6 0 10-4 14-8"/>'
    + '<path class="fi-linie" d="M8 34h84"/></svg><span class="fi-nr">Nr. 0</span>';
  // Blitzschlag: ein goldener Blitz faehrt in den mattgesetzten Koenig, das Brett leuchtet einmal auf, ein Ring laeuft aus
  if (id === 'blitzschlag') el.innerHTML = '<span class="fi-licht"></span><span class="fi-ring"></span>'
    + '<svg class="fi-blitz" viewBox="0 0 40 100" preserveAspectRatio="none"><path d="M26 0L8 52h13L12 100l22-60H21z"/></svg>';
  // Goldregen: goldene Muenzen und Funken fallen ueber das ganze Brett
  if (id === 'goldregen') {
    el.innerHTML = Array.from({ length: 18 }, (_, i) => {
      const x = (i * 37 + 11) % 96 + 2, v = (i * 53) % 420, art = i % 3 ? 'fi-muenze' : 'fi-funke';
      return `<i class="${art}" style="--x:${x}%;--y:${(i * 41) % 90};--v:${v}ms;--d:${(i * 29) % 70 - 35}deg"></i>`;
    }).join('');
  }
  // Schockwelle: vom Mattfeld laufen zwei goldene Ringe ueber das Brett
  if (id === 'schockwelle') el.innerHTML = '<span class="fi-welle1"></span><span class="fi-welle2"></span><span class="fi-kern"></span>';
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
  // die neuen Finisher tragen ihre eigene Hoechstdauer (unter 1,5 s), die alten laufen wie bisher bis 1750 ms
  const hoechst = (f && f.dauer) || 1750;
  const dauer = reduziert ? Math.min(650, ctx.kurzMs || 650) : Math.min(hoechst, ctx.dauerMs || hoechst);
  timer = setTimeout(aufraeumen, dauer);
  if (ctx.signal) ctx.signal.addEventListener('abort', aufraeumen, { once: true });
  return { fertig: promise, verlasse: aufraeumen };
}

// Einstellungen (Flo 31.10.2026: "doppelt sich"): nur noch an oder aus. Welcher Finisher laeuft, waehlt man in der
// Sammlung; "zuletzt" merkt sich die Wahl, damit Einschalten den vorigen Finisher zurueckbringt.
function einstellungen() {
  if (!hatFinisher()) return null;
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

// ctx.fremd (Online, R26): der Finisher des Gegners, der gewonnen hat; nur eine bekannte Kennung, sonst keiner
anbieten('partie:matt', (ctx) => (ctx.fremd === undefined ? starteFinisher(ctx)
  : (FINISHER.some((x) => x.id === ctx.fremd) ? starteFinisher(ctx, ctx.fremd) : null)), { paket: MODUL });
anbieten('einstellungen:gruppen', einstellungen, { paket: MODUL, reihenfolge: 45 });
// Sammlung (Reiter Ich): jeder Finisher, der ausgewaehlte als "Ausgeruestet", Gesperrtes nennt seinen Weg; Schild "Labor" nur beim
// Erfinder. Bild: der Moment des Finishers mit den echten Figuren des ausgeruesteten Satzes (js/sammlung-kunst.js, Flo 31.10.2026)
const finisherWeg = (x) => (x.welt ? F('weg.endgegner', { name: rufname(endgegnerDerWelt(x.welt)) }) : F('bald'));
export function teileFinisher() {
  const gewaehlt = auswahl();
  const erfinder = istErfinder();
  const figuren = new URL('../../../' + figurenPfad(), import.meta.url).href;
  return FINISHER.filter((x) => x.id !== 'aus' && sichtbar(x)).map((x) => {
    const frei = istFrei(x.id);
    return {
      id: 'finisher-' + x.id, name: F(x.text), frei, an: frei && gewaehlt === x.id,
      // Tipp waehlt, ein zweiter Tipp auf den gewaehlten schaltet den Finisher aus (wie die Lobby-Musik)
      ...(frei ? {
        wahl: () => speichereModulEinstellungen(MODUL, { auswahl: x.id, zuletzt: x.id }),
        abwahl: () => speichereModulEinstellungen(MODUL, { auswahl: 'aus', zuletzt: x.id }),
      } : {}),
      zeile: !frei ? finisherWeg(x) : gewaehlt === x.id ? F('gewaehlt') : F('frei'), labor: erfinder,
      bild: finisherKunst(x.id, figuren) || '',
    };
  });
}
anbieten('sammlung:bereich', () => bereich({ id: 'finisher', name: F('titel'), teile: teileFinisher() }), { paket: MODUL, reihenfolge: 10 });

if (typeof window !== 'undefined' && /[?&]test\b/.test(location.search || '')) window.__finisher = { FINISHER, istFrei, auswahl, starteFinisher };
