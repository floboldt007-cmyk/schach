// Zug-Animation in der Online-Partie (Feinschliff R26, Flo 21.11.2026): nach jedem Zug laeuft die Animation des Spielers,
// der gezogen hat, einmal auf dem Zielfeld (die Funkenspur auf dem Weg der Figur), in der Effekt-Ebene ueber dem Brett.
// Die Grafiken sind die Zug-Effekte aus assets/shop/vorrat.json (anlass zug), geladen wie in der Shop-Vorschau
// (js/pakete/sammlung/effekt-vorschau.js). Bei "weniger Bewegung" (js/bewegung.js) laeuft keine.
//   eigenerZugEffekt(einstellungen) -> Kennung oder 'aus' (frei nur fuer den Erfinder, wie die Labor-Saetze)
//   istZugEffekt(id)                 bekannte Kennung (ohne 'aus')
//   spieleZugEffekt({ ebene, brett, id, von, nach })
import { ladeEffekt, dauerSek } from './pakete/sammlung/effekt-vorschau.js';
import { reduziert } from './bewegung.js';
import { istErfinder } from './sonderstuecke.js';
import { EINSTELLUNG_WERTE } from './storage.js';

const WURZEL = new URL('../', import.meta.url);
const ZUG = EINSTELLUNG_WERTE.zugEffekt.filter((x) => x !== 'aus');
export const istZugEffekt = (id) => ZUG.includes(id);
export const eigenerZugEffekt = (e) => (e && istZugEffekt(e.zugEffekt) && istErfinder() ? e.zugEffekt : 'aus');

let vorrat = null;
const ladeVorrat = () => (vorrat ||= fetch(new URL('assets/shop/vorrat.json', WURZEL)).then((r) => (r.ok ? r.json() : null))
  .then((v) => Object.fromEntries((v?.stuecke || []).filter((s) => s.art === 'effekt' && s.anlass === 'zug' && istZugEffekt(s.id))
    .map((s) => [s.id, new URL(s.datei, WURZEL).href])))
  .catch(() => { vorrat = null; return {}; }));

// Mitte eines Feldes in Feldern ab der linken oberen Ecke, wie das Brett es gerade zeigt
const mitte = (feld, ausrichtung) => {
  const x = feld.charCodeAt(0) - 97 + 0.5, y = 8 - Number(feld[1]) + 0.5;
  return ausrichtung === 'b' ? [8 - x, 8 - y] : [x, y];
};
const prozent = (n) => Number((n * 12.5).toFixed(3)) + '%';
// Lage der Funken in ihrer Grafik (viewBox 100): von (18|82) nach (82|18), wie in effekt-vorschau.js
const SPUR_LAENGE = Math.hypot(64, 64) / 100, SPUR_WINKEL = -45, AUSBLENDEN_MS = 260;

export async function spieleZugEffekt({ ebene, brett, id, von, nach }) {
  if (!ebene || !brett || !istZugEffekt(id) || reduziert() || !/^[a-h][1-8]$/.test(von) || !/^[a-h][1-8]$/.test(nach)) return;
  const datei = (await ladeVorrat())[id];
  const svg = datei ? await ladeEffekt(datei) : null;
  if (!svg || !ebene.isConnected || reduziert()) return;
  const huelle = document.createElement('div');
  huelle.className = 'zug-effekt';
  huelle.dataset.zugEffekt = id;
  huelle.setAttribute('aria-hidden', 'true');
  huelle.style.cssText = 'position:absolute;inset:0;pointer-events:none;transition:opacity .26s';
  const a = mitte(von, brett.ausrichtung), b = mitte(nach, brett.ausrichtung);
  let [x, y] = b, groesse = 3, winkel = 0;
  if (id === 'funkenspur') {
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    [x, y] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    groesse = Math.hypot(dx, dy) / SPUR_LAENGE;
    winkel = (Math.atan2(dy, dx) * 180) / Math.PI - SPUR_WINKEL;
  }
  Object.assign(svg.style, { position: 'absolute', left: prozent(x - groesse / 2), top: prozent(y - groesse / 2),
    width: prozent(groesse), height: prozent(groesse), transform: winkel ? `rotate(${Number(winkel.toFixed(3))}deg)` : '' });
  huelle.append(svg);
  ebene.append(huelle);
  // ein Durchgang (die Grafiken laufen in Schleife), hoechstens 2 s, dann ausblenden
  const dauer = Math.min(2000, Math.max(400, dauerSek(svg) * 1000));
  setTimeout(() => { huelle.style.opacity = '0'; setTimeout(() => huelle.remove(), AUSBLENDEN_MS); }, dauer);
}
