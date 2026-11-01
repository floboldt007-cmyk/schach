// Paket lobby (Flo 01.11.2026: "Du kannst auch schon mal alles optisch so einrichten, als wuerde alles funktionieren ...
// Online-Modi ... Startseite Blitz, Schnell, Ligen"): die Online-Lobby als Vorschau, nur im Labor (js/labor.js laborFrei),
// bis der Server fuer Online-Partien steht. Andere Spieler sehen nichts davon.
// Die Startseite (Arena) bekommt oben den Umschalter Welten | Online (Ort arena:modus); der Screen "lobby"
// (js/ui/lobby.js) zeigt Bedenkzeiten, Wertungen, die Online-Liga, Turniere und Gegen Freunde.
// Ehrlich bleibt es trotzdem: Liga-Tabelle und Wertungen sind als Beispiel bzw. Schaetzung markiert, die Gegnersuche endet
// mit einem Bot in passender Staerke und derselben Uhr (eine echte Partie), "Gegen Freunde" oeffnet den echten Screen.
// Rein bis auf modusLeiste und ladeLobbyCss (DOM), in Node testbar.
//
//   PAKET = 'lobby'
//   ZEITEN [{ id, art, grund, zuschlag }]          art: blitz | schnell | klassisch; grund in Sekunden
//   ARTEN ['blitz', 'schnell', 'klassisch']
//   zeitText(z) -> '3 + 2'
//   schaetzeWertung(fortschritt, bots?) -> Zahl    aus dem staerksten besiegten Bot (gerundet, 400 bis 2800)
//   passenderBot(wertung, fortschritt, bots?) -> Bot   freier Bot (kein Endgegner) mit der naechsten Staerke
//   LIGA_BEISPIEL [{ name, punkte }]                 erfundene Namen fuer die Vorschau der Liga-Tabelle
//   ligaTabelle(eigeneZeile) -> [{ platz, name, punkte, du, zone }]   zone: auf | ab | ''
//   modusLeiste(app, aktiv) -> HTMLElement | null  Umschalter Welten | Online (null ohne Labor)
import { anbieten } from '../../orte.js';
import { laborFrei } from '../../labor.js';
import { BOTS } from '../../bots.js';
import { istFreigeschaltet, ladeFortschritt } from '../../storage.js';
import { t } from '../../sprache.js';
import './texte.js';

export const PAKET = 'lobby';
const L = (k, w) => t('p-lobby.' + k, w);

export const ARTEN = Object.freeze(['blitz', 'schnell', 'klassisch']);
export const ZEITEN = Object.freeze([
  { id: '3+0', art: 'blitz', grund: 180, zuschlag: 0 },
  { id: '3+2', art: 'blitz', grund: 180, zuschlag: 2 },
  { id: '5+0', art: 'blitz', grund: 300, zuschlag: 0 },
  { id: '10+0', art: 'schnell', grund: 600, zuschlag: 0 },
  { id: '15+10', art: 'schnell', grund: 900, zuschlag: 10 },
  { id: '30+0', art: 'klassisch', grund: 1800, zuschlag: 0 },
].map((z) => Object.freeze(z)));
export const STANDARD_ZEIT = '3+2';

export const zeitText = (z) => (z ? `${Math.round(z.grund / 60)} + ${z.zuschlag}` : '');

// Schaetzung fuer die Vorschau: der staerkste besiegte Bot, auf 50 gerundet (ohne Sieg 400)
export function schaetzeWertung(f = ladeFortschritt(), bots = BOTS) {
  let best = 0;
  for (const b of bots) if (f && f.bots && f.bots[b.id] && f.bots[b.id].sterne && f.bots[b.id].sterne[0]) best = Math.max(best, Number(b.elo) || 0);
  if (!best) return 400;
  return Math.max(400, Math.min(2800, Math.round(best / 50) * 50));
}

// Gegner fuer "Gegen Bot spielen": unter den freien Bots der mit der naechsten Staerke (bei Gleichstand der staerkere)
export function passenderBot(wertung, f = ladeFortschritt(), bots = BOTS) {
  // Endgegner nicht als Vorschau-Gegner (sie sind direkt offen, aber fuer einen Einstieg zu hart)
  const frei = bots.filter((b) => { try { return !b.endgegner && istFreigeschaltet(b.stufe, f); } catch (e) { return false; } });
  const liste = frei.length ? frei : bots.slice(0, 1);
  return liste.reduce((a, b) => {
    const da = Math.abs((Number(a.elo) || 0) - wertung);
    const db = Math.abs((Number(b.elo) || 0) - wertung);
    return db < da || (db === da && (Number(b.elo) || 0) > (Number(a.elo) || 0)) ? b : a;
  });
}

// Liga-Vorschau: erfundene Spielernamen (keine echten Personen), Punkte absteigend; du stehst auf dem eigenen Platz
export const LIGA_BEISPIEL = Object.freeze([
  { name: 'Turmfalke', punkte: 14 }, { name: 'Rochade77', punkte: 12 }, { name: 'Nachteule', punkte: 11 },
  { name: 'Bauernsturm', punkte: 9 }, { name: 'Springinsfeld', punkte: 7 }, { name: 'Damenflügel', punkte: 4 },
  { name: 'Läuferpaar', punkte: 2 },
].map((x) => Object.freeze(x)));
export function ligaTabelle(du = { name: '', punkte: 0 }, beispiel = LIGA_BEISPIEL) {
  const zeilen = [...beispiel.map((x) => ({ ...x, du: false })), { name: du.name, punkte: Number(du.punkte) || 0, du: true }]
    .sort((a, b) => b.punkte - a.punkte || (a.du ? 1 : 0) - (b.du ? 1 : 0));
  const n = zeilen.length;
  return zeilen.map((z, i) => ({ ...z, platz: i + 1, zone: i < 3 ? 'auf' : i >= n - 2 ? 'ab' : '' }));
}

export function ladeLobbyCss() {
  try {
    if (typeof document === 'undefined' || document.querySelector('link[data-paket="lobby"]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL('../../../css/pakete/lobby.css', import.meta.url).href;
    l.dataset.paket = 'lobby';
    document.head.append(l);
  } catch (e) { /* ohne eigenes CSS bleibt alles bedienbar */ }
}

// Umschalter oben auf der Startseite und in der Lobby (zwei echte Knoepfe, aria-pressed; 44 px hoch)
export function modusLeiste(app, aktiv = 'welten') {
  if (!laborFrei() || typeof document === 'undefined') return null;
  ladeLobbyCss();
  const el = document.createElement('div');
  el.className = 'lb-modus';
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', L('modus.label'));
  el.dataset.aktiv = aktiv === 'online' ? 'online' : 'welten';
  el.innerHTML = `<span class="lb-modus-pille" aria-hidden="true"></span>`
    + `<button type="button" class="lb-modus-knopf dr" data-modus="welten" aria-pressed="${aktiv !== 'online'}">${L('modus.welten')}</button>`
    + `<button type="button" class="lb-modus-knopf dr" data-modus="online" aria-pressed="${aktiv === 'online'}">${L('modus.online')}<span class="lb-labor">${L('labor')}</span></button>`;
  el.addEventListener('click', (e) => {
    const k = e.target.closest('[data-modus]');
    if (!k || k.dataset.modus === el.dataset.aktiv) return;
    el.dataset.aktiv = k.dataset.modus;
    for (const b of el.querySelectorAll('[data-modus]')) b.setAttribute('aria-pressed', String(b === k));
    try { app.gehe(k.dataset.modus === 'online' ? 'lobby' : 'arena', {}, { ersetzen: true }); } catch (f) { console.error(f); }
  });
  return el;
}

try {
  anbieten('arena:modus', (k) => {
    try { return k && k.app ? modusLeiste(k.app, 'welten') : null; } catch (e) { console.error(e); return null; }
  }, { reihenfolge: 1, paket: PAKET });
} catch (e) { console.error(e); }
