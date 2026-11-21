// Effekt-Vorschau im Shop (Feinschliff R20, Probe: tests/r20-effekt-vorschau.test.mjs): spielt einen Effekt aus
// assets/shop/vorrat.json einmal auf dem echten Brett (js/board.js) ab, nur als Ansicht, ohne Kauf und ohne Server.
//   Zug-Effekte laufen nach dem gezeigten Zug g1-f3 auf dem Zielfeld, die Funkenspur auf dem Weg der Figur.
//   Sieg-Effekte laufen in einer Mattstellung ueber das ganze Brett, die Lichtsaeule steht auf dem Koenigsfeld e1.
//   Die Grafiken laufen in Endlosschleife (werkzeuge/shop-vorrat.mjs): die Dauer eines Durchgangs steht in ihren Animationen,
//   danach blendet die Ebene aus. Bei "weniger Bewegung" (js/bewegung.js) steht die Endstellung mit einem ruhigen Standbild.
//
//   effektStandbild(datei) -> Promise<svg | null>                  ruhendes Bild fuer die Karte im Regal
//   spieleEffekt({ ebene, brett, stueck }) -> { stoppe() }         ebene.dataset.zustand: wartet | laeuft | still
import { reduziert } from '../../bewegung.js';

const VON = 'g1', NACH = 'f3', KOENIG = 'e1';
const VOR_ZUG = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
const NACH_ZUG = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
const MATT = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4';
const VORLAUF_MS = 450, AUSBLENDEN_MS = 260;
// Lage in den Grafiken (viewBox 100): die Funken laufen von (18|82) nach (82|18), der Fuss der Lichtsaeule liegt bei y = 92
const SPUR_LAENGE = Math.hypot(64, 64) / 100, SPUR_WINKEL = -45, FUSS_Y = 0.92;

// Mitte eines Feldes in Feldern ab a8 (Ansicht von Weiss)
const feldMitte = (feld) => [feld.charCodeAt(0) - 97 + 0.5, 8 - Number(feld[1]) + 0.5];
const prozent = (n) => Number((n * 12.5).toFixed(3)) + '%';

let zaehler = 0;
// auch fuer die Zug-Animation in der Online-Partie (js/zug-effekt.js)
export async function ladeEffekt(datei) {
  const antwort = await fetch(datei).catch(() => null);
  if (!antwort || !antwort.ok) return null;
  // Verlaufs-Ids gelten im ganzen Dokument: je Aufruf eindeutig, Karte und Vorschau teilen sich keine
  const vor = `fx${++zaehler}-`;
  const text = (await antwort.text()).replace(/\bid="([^"]+)"/g, `id="${vor}$1"`).replace(/url\(#([^)]+)\)/g, `url(#${vor}$1)`);
  const dok = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (dok.querySelector('parsererror')) return null;
  const svg = document.importNode(dok.documentElement, true);
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.setAttribute('aria-hidden', 'true');
  return svg;
}

// Ein Durchgang: die laengste Animation samt spaeterem Beginn (negative Beginne laufen schon)
export function dauerSek(svg) {
  const zahl = (w) => parseFloat(w) || 0;
  return Math.max(...[...svg.querySelectorAll('animate, animateTransform')]
    .map((a) => zahl(a.getAttribute('dur')) + Math.max(0, zahl(a.getAttribute('begin')))), 0);
}

// Standbild aus der Mitte des Durchgangs; die Karte haengt erst spaeter im Dokument, dann die Zeit noch einmal setzen
function halteAn(svg) {
  const zeit = dauerSek(svg) * 0.55;
  const stelle = () => { svg.pauseAnimations(); svg.setCurrentTime(zeit); };
  stelle();
  let versuche = 0;
  const sobaldDa = () => {
    if (svg.isConnected) stelle();
    else if (++versuche < 120) requestAnimationFrame(sobaldDa);
  };
  requestAnimationFrame(sobaldDa);
}

export async function effektStandbild(datei) {
  const svg = await ladeEffekt(datei);
  if (svg) halteAn(svg);
  return svg;
}

// Grafik ueber das Brett legen: Mitte und Groesse in Feldern
function lege(svg, [x, y], groesse, winkel = 0) {
  svg.style.left = prozent(x - groesse / 2);
  svg.style.top = prozent(y - groesse / 2);
  svg.style.width = svg.style.height = prozent(groesse);
  if (winkel) svg.style.transform = `rotate(${Number(winkel.toFixed(3))}deg)`;
}
function platziere(svg, stueck) {
  if (stueck.id === 'funkenspur') {
    const [a, b] = [feldMitte(VON), feldMitte(NACH)];
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    lege(svg, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], Math.hypot(dx, dy) / SPUR_LAENGE, (Math.atan2(dy, dx) * 180) / Math.PI - SPUR_WINKEL);
  } else if (stueck.id === 'lichtsaeule') {
    const [x, y] = feldMitte(KOENIG);
    lege(svg, [x, y - (FUSS_Y - 0.5) * 8], 8);
  } else if (stueck.anlass === 'zug') lege(svg, feldMitte(NACH), 3);
  else lege(svg, [4, 4], 8);
}

export function spieleEffekt({ ebene, brett, stueck }) {
  const zeiten = [];
  let gestoppt = false;
  const spaeter = (ms, f) => zeiten.push(setTimeout(f, ms));
  const zug = stueck.anlass === 'zug';
  const zuletzt = zug ? [VON, NACH] : ['h5', 'f7'];
  ebene.dataset.zustand = 'wartet';
  brett.setzeStellung(zug ? VOR_ZUG : MATT, { animieren: false, letzterZug: zug ? null : zuletzt, schach: zug ? null : true });

  ladeEffekt(stueck.datei).then((svg) => {
    if (gestoppt) return;
    if (!svg) { ebene.remove(); return; }
    platziere(svg, stueck);
    if (reduziert()) {
      if (zug) brett.setzeStellung(NACH_ZUG, { animieren: false, letzterZug: zuletzt });
      halteAn(svg);
      ebene.append(svg);
      ebene.dataset.zustand = 'still';
      return;
    }
    const starte = () => {
      ebene.append(svg);
      ebene.dataset.zustand = 'laeuft';
      spaeter(dauerSek(svg) * 1000, () => {
        ebene.classList.add('endet');
        spaeter(AUSBLENDEN_MS, () => ebene.remove());
      });
    };
    spaeter(VORLAUF_MS, () => {
      if (!zug) { starte(); return; }
      brett.setzeStellung(NACH_ZUG, { animieren: true, letzterZug: zuletzt });
      // die Funken begleiten die Figur, alles andere wartet auf ihre Landung
      if (stueck.id === 'funkenspur') starte(); else spaeter(brett.gleitDauer(), starte);
    });
  });
  return { stoppe() { gestoppt = true; zeiten.forEach(clearTimeout); ebene.remove(); } };
}
