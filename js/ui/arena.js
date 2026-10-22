// Arena: die Bot-Leiter als bunte Weltkarte (Premium-Umbau U5, Flo 18.10. "Variante 1": Karte aus Entwurf C mit
// Himmel, Huegeln, Baeumen, Haeuschen und geschwungenem Pfad, alles drumherum im Look A) und das Gegner-Panel.
// Params: { neuFreigeschaltet?: botId } spielt die Freischalt-Animation,
//         { waehle?: botId } (Zusatz) waehlt einen freien Bot im Panel vor.
//
// Aufbau: section.screen.arena > header (js/ui/seite.js hauptKopf) + .inhalt > .karte (Scroll-Behaelter) > .welt
// (SVG-Zeichnung .welt-svg, Orte .ort-karte-boss/.ort-karte-event, Flos Figur .flo-figur, je Bot eine Station
// button.stufe.knoten[data-bot] mit Zustand besiegt | aktuell | gesperrt, Endgegner .boss) und aside.detail.
// Die Zeichnung entsteht in Pixelmass (viewBox = Groesse der Karte): weltSvg() legt Himmel, Berge, Huegelbaender,
// Baeume, Haeuser, See, Zaun und den Pfad (Bezier durch die Stationen, Fortschritt in Akzentfarbe bis zum naechsten
// Gegner) je Lage neu an; die Stationen stehen in Prozent (LAGEN.quer / LAGEN.hoch).
// Lagen: iPad quer = Karte links, passt ganz ohne Scrollen (Endgegner oben), Panel rechts; iPad hoch = Karte oben,
// Panel zweispaltig darunter; Handy = Karte senkrecht scrollbar (startet beim naechsten Gegner), Panel darunter,
// Spielen-Knopf klebt ueber der Reiter-Pille. Optik: css/arena.css.
// Inszenierte Momente (entwurf-a/SYSTEM.md): Eintritt (Karte gleitet, Stationen fallen gestaffelt, Fortschritts-Pfad
// zeichnet sich), Bot waehlen (Station hebt sich, Panel wechselt gestaffelt), nach einem Sieg (.wird-frei: alte Station
// bekommt Sterne, Schloss der neuen springt ab, Fahne wandert, Flo zieht weiter, Karte scrollt zur neuen Station,
// Stern-Klang). Reduzierte Bewegung (bewegung.js reduziert()): alles sofort.
// Spielen: js/ui/duell.js spieleDuell() (Duell-Intro nach Einstellung duellIntro: immer | besondere | aus), danach
// app.gehe('partie', ...). Portraets ueber thema.avatarVon(bot) (Modern-Portraets, sonst bot.avatar).
//
// Runde 4 (Anzeige-Orte, js/orte.js): arena:kopf (in .kopf-chips nach den zwei Chips), arena:panel-oben (ganz oben
// im Panel, davor die Nachlese aus feier.nachlese() "Seit deiner letzten Partie"), arena:panel-bot (nach den
// Stern-Zielen), arena:start (einmal nach dem ersten Layout, Kontext { app, s, karte, scrolleZu(botId, sanft), neuId }),
// U5 neu: arena:karte-boss (.ort-karte-boss am Zelt des Wochen-Boss) und arena:karte-event (.ort-karte-event an der
// Fahne) auf der Karte, Kontext { app, fortschritt, karte, scrolleZu }, ohne Anbieter unsichtbar.
// Die Begruessung im Panel waehlt wie in der Partie der Wahl-Ort partie:begruessung?.
// w0c: Fehlt gespeicherten Partien die Analyse (App waehrend der Auswertung beendet), rechnet die Arena sie still nach
// (js/nachholen.js, Start nach ARENA_NACHHOLEN_MS, Ende mit verlasse()) und zeichnet die Sterne danach ohne Animation neu.
// W0+a: Host des Orts arena:heute (Heute-Karte): section.heute-karte direkt nach .ort-panel-oben im Panel, Kopfzeile
// "Heute · <Wochentag>" (Tag mit Grenze 4:00, tag.js), Zeilen der Pakete in .ort-heute. Gefuellt bei jedem zeigeDetail();
// ohne Anbieter versteckt. Kontext { app, bot, fortschritt, tag, woche }. Die Karte "Offene Partie" und der Dialog vor
// einer neuen Partie finden auch angemeldete Bots (botNachId, z. B. eine verlassene Boss-Partie).
import { BOTS, botSatz, botNachId } from '../bots.js';
import { tagSchluessel, wochenSchluessel, wochentag } from '../tag.js';
import {
  ladeFortschritt, istFreigeschaltet, naechsterGegner, gesamtSterne, statistik,
  ladeLaufendePartie, loescheLaufendePartie, ladePartien,
} from '../storage.js';
import { klang } from '../sounds.js';
import { fuelle, waehle } from '../orte.js';
import { nachlese } from '../feier.js';
import { starteNachholen } from '../nachholen.js';
import { icon } from './icons.js';
import { botFarbe, avatarVon, floAvatar } from '../thema.js';
import { anim, staffel, tempo, reduziert } from '../bewegung.js';
import { segment } from './bauteile.js';
import { hauptKopf, standardChips, verbindeKopf, kopfEintritt } from './seite.js';
import { spieleDuell, duellArt } from './duell.js';

// Merkmal-Kacheln (aus der Bot-Bio abgeleitet): Lieblingsfigur, Tempo, Schwaeche
const MERKMALE = {
  benno: { figur: 'P', lieblings: 'Bauer', tempo: 'Flott', schwaeche: 'Lässt Figuren hängen' },
  hilde: { figur: 'Q', lieblings: 'Dame', tempo: 'Gemütlich', schwaeche: 'Vergisst eigene Figuren' },
  kalle: { figur: 'Q', lieblings: 'Dame', tempo: 'Hastig', schwaeche: 'Achtet kaum auf Deckung' },
  lisa: { figur: 'B', lieblings: 'Läufer', tempo: 'Flott', schwaeche: 'Lange Pläne' },
  rudi: { figur: 'N', lieblings: 'Springer', tempo: 'Überlegt', schwaeche: 'Verliert den Überblick' },
  turm: { figur: 'R', lieblings: 'Turm', tempo: 'Bedächtig', schwaeche: 'Spielt lieber sicher' },
  delia: { figur: 'Q', lieblings: 'Dame', tempo: 'Stürmisch', schwaeche: 'Opfert zu gern' },
  koenig: { figur: 'K', lieblings: 'König', tempo: 'Bedächtig', schwaeche: 'Scharfe Taktik' },
  greta: { figur: 'B', lieblings: 'Läuferpaar', tempo: 'Präzise', schwaeche: 'Kaum eine' },
  stockfisch: { figur: 'Q', lieblings: 'Alle', tempo: 'Blitzschnell', schwaeche: 'Keine bekannt' },
};
// Kurze Namen fuer die Schilder auf der Karte (nie abgeschnitten) und den Spielen-Knopf ("Spielen gegen Kalle")
const KURZ = {
  benno: 'Benno', hilde: 'Oma Hilde', kalle: 'Kalle', lisa: 'Lisa', rudi: 'Ritter Rudi', turm: 'Prof. Turm',
  delia: 'Delia', koenig: 'König', greta: 'Greta', stockfisch: 'Stockfisch',
};
const RUF = { ...KURZ, turm: 'den Professor', koenig: 'den Kommissar', stockfisch: 'den Stockfisch' };
// Text des Spielen-Knopfs ("Spielen gegen Kalle", besiegt "Revanche gegen ..."). Der Rufname steht in .sp-name und
// bricht nie in sich um; wird es eng (schmales Panel, langer Rufname), bricht der Knopf vor dem Namen auf zwei Zeilen
// um, statt etwas abzuschneiden (css/arena.css .spielen .sp-text, tests/arena.test.mjs prueft alle zehn Bots)
export function spielenText(b, besiegt) {
  return `${besiegt ? 'Revanche' : 'Spielen'} gegen <span class="sp-name">${esc((b && (RUF[b.id] || b.name)) || '')}</span>`;
}

// Lagen der Karte: Stationen und Szenerie in Anteilen der Kartengroesse (0..1). quer = fast quadratische Karte
// (iPad quer, passt ganz), hoch = schmale, hohe Karte (Entwurf C: 400 x 760, scrollt). start = wo Flos Weg beginnt,
// boss/event = Plaetze der Orte arena:karte-boss (Zelt) und arena:karte-event (Fahne am Turm).
// Szene: [Art, x, y, Groesse?, Variante?]
const LAGEN = {
  quer: {
    himmel: 0.15,
    baender: [0.15, 0.36, 0.56, 0.76],
    stationen: [[0.13, 0.86], [0.36, 0.80], [0.60, 0.86], [0.84, 0.75], [0.70, 0.545], [0.45, 0.60], [0.20, 0.52], [0.26, 0.32], [0.52, 0.28], [0.78, 0.22]],
    start: [0.03, 0.96],
    boss: [0.92, 0.42],
    event: [0.06, 0.40],
    berge: [[0.30, 1.3], [0.56, 1.0], [0.88, 1.15]],
    szene: [
      ['sonne', 0.93, 0.07], ['wolke', 0.10, 0.06], ['wolke', 0.47, 0.09], ['wolke', 0.72, 0.05],
      ['burg', 0.06, 0.40], ['zelt', 0.92, 0.42], ['tempel', 0.92, 0.26], ['haus', 0.60, 0.44, 1, 1], ['haus', 0.10, 0.70, 1, 2], ['haus', 0.84, 0.92, 1, 3],
      ['see', 0.36, 0.42, 1.2], ['ring', 0.62, 0.70], ['zaun', 0.24, 0.94], ['muehle', 0.40, 0.14],
      ['tanne', 0.04, 0.22], ['tanne', 0.08, 0.26, 0.8], ['tanne', 0.66, 0.20, 0.9], ['tanne', 0.98, 0.18, 0.9], ['tanne', 0.20, 0.17, 0.8],
      ['baum', 0.37, 0.52], ['baum', 0.92, 0.60, 0.9, 2], ['baum', 0.30, 0.68, 0.8], ['baum', 0.50, 0.73, 0.8, 2], ['baum', 0.97, 0.80, 0.9],
      ['baum', 0.73, 0.40, 0.8, 2], ['baum', 0.16, 0.60, 0.9, 2], ['baum', 0.44, 0.95, 0.9], ['baum', 0.70, 0.95, 0.8, 2], ['baum', 0.04, 0.82, 0.8],
      ['busch', 0.57, 0.50], ['busch', 0.22, 0.80], ['busch', 0.86, 0.50], ['busch', 0.63, 0.32],
      ['blumen', 0.33, 0.90], ['blumen', 0.50, 0.90], ['blumen', 0.08, 0.60], ['blumen', 0.62, 0.62], ['blumen', 0.88, 0.70], ['blumen', 0.40, 0.36],
    ],
  },
  hoch: {
    himmel: 0.197,
    baender: [0.197, 0.40, 0.57, 0.79],
    stationen: [[0.275, 0.921], [0.695, 0.842], [0.315, 0.753], [0.71, 0.658], [0.295, 0.568], [0.705, 0.479], [0.315, 0.392], [0.715, 0.305], [0.345, 0.221], [0.71, 0.108]],
    start: [0.51, 0.99],
    boss: [0.125, 0.385],
    event: [0.115, 0.52],
    berge: [[0.72, 1.3], [0.90, 1.0], [0.12, 1.0]],
    szene: [
      ['sonne', 0.93, 0.04], ['wolke', 0.10, 0.05], ['wolke', 0.40, 0.04], ['wolke', 0.18, 0.13], ['wolke', 0.55, 0.15],
      ['tempel', 0.71, 0.125], ['tanne', 0.07, 0.345], ['tanne', 0.13, 0.363, 0.8], ['tanne', 0.92, 0.353], ['tanne', 0.52, 0.33, 0.8], ['tanne', 0.57, 0.345, 0.7],
      ['zelt', 0.125, 0.385], ['haus', 0.89, 0.445, 1, 1], ['baum', 0.175, 0.503], ['baum', 0.24, 0.49, 0.8, 2], ['baum', 0.83, 0.39, 0.8], ['baum', 0.50, 0.52, 0.7, 2],
      ['burg', 0.115, 0.52], ['ring', 0.89, 0.53], ['baum', 0.15, 0.68], ['baum', 0.22, 0.70, 0.8, 2], ['baum', 0.815, 0.585, 0.9], ['baum', 0.89, 0.566, 0.7, 2],
      ['baum', 0.795, 0.774, 0.9], ['baum', 0.875, 0.79, 0.75, 2], ['busch', 0.515, 0.737], ['busch', 0.475, 0.618],
      ['haus', 0.11, 0.745, 1, 2], ['haus', 0.83, 0.915, 1, 3], ['see', 0.62, 0.942], ['zaun', 0.13, 0.86],
      ['baum', 0.10, 0.937], ['baum', 0.925, 0.855, 0.8], ['blumen', 0.465, 0.953], ['blumen', 0.825, 0.99], ['blumen', 0.09, 0.805], ['blumen', 0.58, 0.63], ['blumen', 0.175, 0.618],
    ],
  },
};

// Partie-Screen vorab laden (dasselbe Modul, das app.js beim Wechsel importiert: danach kommt es aus dem Modul-Speicher).
// Ein Fehler hier ist egal, app.js zeigt beim Wechsel selbst den Platzhalter.
let partieVorab = null;
function ladePartieScreen() {
  if (!partieVorab) partieVorab = import('./partie.js').catch(() => { partieVorab = null; });
  return partieVorab;
}

const WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

let letzteFarbe = 'w';   // Farbwahl bleibt waehrend der Sitzung erhalten ('w' | 'zufall' | 'b')
// Fehlende Analysen erst nachrechnen, wenn die Arena steht (nach der Freischalt-Animation)
const ARENA_NACHHOLEN_MS = 2500;
const ZIELE = [['Sieg', 'Sieg'], ['80 % genau', 'Sieg mit mindestens 80 % Genauigkeit'], ['Ohne Hilfe', 'Ohne Hinweis und ohne Zurücknehmen']];
// Mindesthoehe der hohen Welt auf schmalen Karten (px): Stationen mit Sternen, Fahne und Schild ueberdecken sich nicht
const WELT_MIN_H = 820;
// Dauer der Freischalt-Choreografie (tests/app.test.mjs misst 2,7 s zwischen Beginn und Ende von .wird-frei)
const FREI_DAUER_MS = 2700;

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const prozent = (x) => (Number.isFinite(x) ? String(Math.round(x * 10) / 10).replace('.', ',') + ' %' : '-');
const kSterneHtml = (sterne) => sterne.map((x) => icon('stern', x ? 'stern' : 'aus')).join('');
const zielSterneHtml = (sterne) => ZIELE.map(([kurz, lang], i) => `<div class="${sterne[i] ? 'an' : ''}" title="${esc(lang)}"><b aria-hidden="true">${icon('stern')}</b>${kurz}<span class="sr"> (${esc(lang)}${sterne[i] ? ', erreicht' : ''})</span></div>`).join('');
const r1 = (x) => (Math.round(x * 10) / 10).toFixed(1).replace(/\.0$/, '');

// ---------- Welt-Zeichnung (Pixelmass) ----------
// Pfad als Bezier durch die Punkte (Entwurf C pfadD)
export function pfadD(pts) {
  if (!pts.length) return '';
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 5, p1[1] + (p2[1] - p0[1]) / 5];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 5, p2[1] - (p3[1] - p1[1]) / 5];
    d += ` C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return d;
}

const g = (x, y, s, inhalt) => `<g transform="translate(${r1(x)} ${r1(y)}) scale(${r1(s)})">${inhalt}</g>`;
const SZENE = {
  baum: (x, y, s = 1, v = 1) => g(x, y, s, `<ellipse cx="0" cy="2" rx="11" ry="3.5" class="w-schatten"/><rect x="-2.2" y="-8" width="4.4" height="10" rx="2" class="w-stamm"/><circle cx="0" cy="-15" r="11" class="${v === 2 ? 'w-laub-2' : 'w-laub'}"/><circle cx="-3.5" cy="-18.5" r="5" class="w-weiss"/>`),
  tanne: (x, y, s = 1) => g(x, y, s, '<ellipse cx="0" cy="1" rx="9" ry="3" class="w-schatten"/><rect x="-1.8" y="-6" width="3.6" height="7" class="w-stamm-2"/><path d="M0-30 10-12H-10z" class="w-tanne"/><path d="M0-22 12-4H-12z" class="w-tanne-2"/>'),
  busch: (x, y, s = 1) => g(x, y, s, '<circle cx="-5" cy="0" r="6" class="w-laub-2"/><circle cx="4" cy="-2" r="7" class="w-laub-3"/><circle cx="2" cy="-4" r="2.4" class="w-weiss"/>'),
  blumen: (x, y, s = 1) => g(x, y, s, '<circle r="2" class="w-blume-1"/><circle cx="7" cy="3" r="2" class="w-blume-2"/><circle cx="-6" cy="4" r="2" class="w-blume-3"/>'),
  wolke: (x, y, s = 1) => g(x, y, s, '<path d="M0 0q20-6 40 0t40 0" class="w-wolke"/>'),
  sonne: (x, y, s = 1) => g(x, y, s, '<circle r="13" class="w-sonne"/><circle r="7" class="w-sonne-2"/>'),
  // Haeuser: 1 Giebel mit Schornstein (blau), 2 braunes Dach mit Laterne, 3 rotes Dach
  haus: (x, y, s = 1, v = 1) => g(x - 30, y - 22, s, v === 1
    ? '<rect width="62" height="42" rx="5" class="w-wand-2"/><path d="M-6 4 31-22 68 4z" class="w-dach-3"/><rect x="24" y="18" width="14" height="24" rx="3" class="w-stamm"/><rect x="6" y="12" width="12" height="12" rx="2" class="w-fenster"/><rect x="44" y="12" width="12" height="12" rx="2" class="w-fenster"/>'
    : v === 2
      ? '<rect width="56" height="40" rx="5" class="w-wand"/><path d="M-5 3 28-18 61 3z" class="w-dach-2"/><rect x="21" y="18" width="14" height="22" rx="3" class="w-tuer-2"/><rect x="5" y="12" width="10" height="10" rx="2" class="w-fenster"/><rect x="41" y="12" width="10" height="10" rx="2" class="w-fenster"/><g transform="translate(62 2)"><path d="M0 0v14" class="w-mast"/><rect x="-2" y="-12" width="16" height="13" rx="3" class="w-lampe"/><path d="M3-9h6v8H3z" class="w-weiss"/></g>'
      : '<rect width="64" height="44" rx="6" class="w-wand"/><path d="M-4 2 32-20 68 2z" class="w-dach"/><rect x="26" y="20" width="14" height="24" rx="3" class="w-tuer"/><rect x="6" y="13" width="12" height="12" rx="2" class="w-fenster"/><rect x="46" y="13" width="12" height="12" rx="2" class="w-fenster"/><circle cx="32" cy="-8" r="4" class="w-lampe"/>'),
  // Zelt des Wochen-Boss (Ort arena:karte-boss)
  zelt: (x, y, s = 1) => g(x - 32, y - 20, s, '<rect width="64" height="44" rx="6" class="w-wand"/><path d="M-4 2 32-20 68 2z" class="w-zelt"/><rect x="10" y="12" width="44" height="32" rx="16" class="w-zelt-2"/><path d="M14 44V22q18 10 18 22M50 44V22q-18 10-18 22" class="w-zelt"/><circle cx="32" cy="-8" r="4" class="w-lampe"/>'),
  // Tempel mit Kuppel (Ziel oben)
  tempel: (x, y, s = 1) => g(x - 29, y - 18, s, '<rect width="58" height="40" rx="5" class="w-wand-2"/><path d="M8 0a21 21 0 0 1 42 0z" class="w-kuppel"/><rect x="6" y="12" width="7" height="22" rx="3" class="w-saeule"/><rect x="45" y="12" width="7" height="22" rx="3" class="w-saeule"/><rect x="22" y="18" width="14" height="22" rx="7" class="w-tuer"/><circle cx="29" cy="-21" r="3" class="w-lampe"/>'),
  // Burgturm mit Fahne (Ort arena:karte-event)
  burg: (x, y, s = 1) => g(x - 21, y - 34, s, '<rect x="4" y="18" width="34" height="56" class="w-stein"/><path d="M4 18h6v-8h6v8h6v-8h6v8h6v-8h4v8" class="w-stein"/><rect x="15" y="50" width="12" height="24" rx="6" class="w-tuer"/><rect x="16" y="30" width="10" height="10" rx="5" class="w-stein-2"/><path d="M21 10V-8" class="w-mast"/><path d="M21-8l14 5-14 5z" class="w-fahne"/>'),
  see: (x, y, s = 1) => g(x, y, s, '<ellipse rx="26" ry="10" class="w-wasser"/><ellipse cx="-6" cy="-3" rx="9" ry="2.4" class="w-glanz"/>'),
  ring: (x, y, s = 1) => g(x, y, s, '<ellipse rx="36" ry="21" class="w-ring"/><ellipse rx="27" ry="13" class="w-ring-2"/><ellipse rx="31.5" ry="17" class="w-glanz-linie"/>'),
  zaun: (x, y, s = 1) => g(x - 34, y, s, '<path d="M0 0h70M0 12h70M8-6v26M28-6v26M48-6v26M68-6v26" class="w-zaun"/>'),
  muehle: (x, y, s = 1) => g(x, y, s, '<ellipse cx="0" cy="22" rx="14" ry="4" class="w-schatten"/><path d="M-10 22 -6-10h12l4 32z" class="w-wand"/><path d="M-7-10 0-20 7-10z" class="w-dach-2"/><path d="M0-14 18-26M0-14-18-2M0-14 12 4M0-14-12-32" class="w-mast"/><circle cy="-14" r="2.2" class="w-tuer"/><rect x="-3" y="10" width="6" height="12" rx="3" class="w-tuer"/>'),
};

// Wellenband: Huegelkante quer ueber die ganze Breite
function band(y, w, h, klasse, amp) {
  const q = w / 4;
  return `<path d="M0 ${r1(y)} q${r1(q / 2)} ${r1(-amp)} ${r1(q)} 0 t${r1(q)} 0 t${r1(q)} 0 t${r1(q)} 0 V${r1(h)} H0 Z" class="${klasse}"/>`;
}
function berg(x, y, s, w) {
  const b = Math.max(60, Math.min(110, w * 0.18)) * s;
  const hh = b * 1.05;
  return `<path d="M${r1(x - b)} ${r1(y)} L${r1(x)} ${r1(y - hh)} L${r1(x + b)} ${r1(y)}z" class="${s > 1.1 ? 'w-berg' : 'w-berg-2'}"/>`
    + `<path d="M${r1(x)} ${r1(y - hh)} l${r1(-b * 0.27)} ${r1(hh * 0.3)} l${r1(b * 0.14)} ${r1(-hh * 0.05)} l${r1(b * 0.1)} ${r1(hh * 0.08)} l${r1(b * 0.11)} ${r1(-hh * 0.09)} l${r1(b * 0.12)} ${r1(hh * 0.05)}z" class="w-schnee"/>`;
}

// Die ganze Zeichnung. punkte: Stationen in Pixel; bis: Index des naechsten Gegners (Fortschritt bis dorthin);
// neuIdx: Station, die gerade frei wird (ihr Stueck Weg zeichnet sich spaeter, Klasse .w-fortschritt-neu).
// y0/hy: senkrechte Abbildung der Anteile auf Pixel, Y(f) = y0 + f * hy (Hochformat: Rand oben fuer Krone und Fahne
// des Endgegners, unten fuer das Schild der ersten Station; die Flaeche darunter bleibt Wiese, darueber Himmel)
export function weltSvg({ w, h, s, lage, punkte, start, bis, neuIdx = -1, y0 = 0, hy = h }) {
  const Y = (f) => y0 + f * hy;
  const himmel = Y(lage.himmel);
  const amp = Math.max(8, Math.min(16, 14 * s));
  const teile = [`<rect width="${r1(w)}" height="${r1(h)}" class="w-gras"/>`, `<rect width="${r1(w)}" height="${r1(himmel + amp)}" class="w-himmel"/>`];
  for (const [fx, bs] of lage.berge) teile.push(berg(fx * w, himmel + amp * 0.6, bs * s, w));
  teile.push(band(himmel, w, h, 'w-strand', amp));
  teile.push(band(himmel + Math.max(14, 18 * s), w, h, 'w-gras-4', amp));
  const klassen = ['w-gras-3', 'w-gras-2', 'w-gras'];
  lage.baender.slice(1).forEach((f, i) => teile.push(band(Y(f), w, h, klassen[i] || 'w-gras', amp * (1 + i * 0.3))));
  // Szenerie: hintere (hoehere) zuerst, damit Vorderes ueberdeckt
  const szene = [...lage.szene].sort((a, b) => a[2] - b[2]);
  for (const [art, fx, fy, gr = 1, v = 1] of szene) {
    const fn = SZENE[art];
    if (fn) teile.push(fn(fx * w, Y(fy), gr * s, v));
  }
  // Pfad: drei Lagen (Rand, Weg, gestrichelte Mitte), dann der Fortschritt in Akzentfarbe
  const alle = [start, ...punkte];
  const d = pfadD(alle);
  teile.push(`<path d="${d}" class="w-weg-rand" stroke-width="${r1(22 * s)}"/>`);
  teile.push(`<path d="${d}" class="w-weg" stroke-width="${r1(15 * s)}"/>`);
  teile.push(`<path d="${d}" class="w-weg-strich" stroke-width="${r1(2 * s)}" stroke-dasharray="${r1(5 * s)} ${r1(9 * s)}"/>`);
  const fertigBis = neuIdx >= 0 ? Math.min(bis, neuIdx - 1) : bis;
  if (fertigBis >= 0) teile.push(`<path d="${pfadD(alle.slice(0, fertigBis + 2))}" class="w-fortschritt" stroke-width="${r1(6 * s)}"/>`);
  if (neuIdx > 0 && neuIdx === bis) teile.push(`<path d="${pfadD(alle.slice(neuIdx, neuIdx + 2))}" class="w-fortschritt-neu" stroke-width="${r1(6 * s)}"/>`);
  return `<svg class="welt-svg" viewBox="0 0 ${r1(w)} ${r1(h)}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${teile.join('')}</svg>`;
}

export function zeige(root, params, app) {
  const uhren = new Set();
  const spaeter = (fn, ms) => { const u = setTimeout(() => { uhren.delete(u); fn(); }, ms); uhren.add(u); return u; };
  let beobachter = null;
  let weg = false;

  const fortschritt = ladeFortschritt();
  // Feier-Momente, die nicht ins Ergebnis passten: einmal holen, gilt fuer diesen Screen
  let feierRest = [];
  try { feierRest = nachlese(); } catch (e) { feierRest = []; }
  const orte = { kopf: null, oben: null, heute: null, bot: null, start: null, karteBoss: null, karteEvent: null };
  const neuId = params && params.neuFreigeschaltet && BOTS.some((b) => b.id === params.neuFreigeschaltet) ? params.neuFreigeschaltet : null;
  const naechster = naechsterGegner(fortschritt);
  const alleBesiegt = BOTS.every((b) => fortschritt.bots[b.id].sterne[0]);
  const aktuellId = alleBesiegt ? null : naechster.id;
  // Alle besiegt: den ersten Bot mit fehlenden Sternen vorwaehlen (statt immer den Endgegner)
  const fehlendeSterne = alleBesiegt ? BOTS.find((b) => fortschritt.bots[b.id].sterne.some((x) => !x)) : null;
  let gewaehlt = neuId || (params && params.waehle && BOTS.some((b) => b.id === params.waehle) ? params.waehle : null)
    || (fehlendeSterne ? fehlendeSterne.id : naechster.id);
  if (!istFreigeschaltet(BOTS.find((b) => b.id === gewaehlt).stufe, fortschritt)) gewaehlt = naechster.id;
  const idx = (id) => BOTS.findIndex((b) => b.id === id);
  const aktuellIdx = aktuellId ? idx(aktuellId) : BOTS.length - 1;

  const zustandVon = (b) => {
    if (fortschritt.bots[b.id].sterne[0]) return 'besiegt';
    if (istFreigeschaltet(b.stufe, fortschritt)) return 'aktuell';
    return 'gesperrt';
  };
  const kurzName = (b) => KURZ[b.id] || b.name;

  // ---------- Aufbau ----------
  const s = document.createElement('section');
  s.className = 'screen arena';
  s.setAttribute('aria-label', 'Bot-Leiter');
  // Lage schon vor dem ersten Bild setzen (kein Umspringen): quer nur im Querformat mit genug Hoehe
  const querVorab = !window.matchMedia('(orientation: portrait), (max-width: 760px)').matches && window.innerHeight - 140 >= 420;
  s.classList.add(querVorab ? 'karte-quer' : 'karte-hoch');
  s.innerHTML = `
    ${hauptKopf({
    unter: alleBesiegt ? `Arena bezwungen! ${gesamtSterne(fortschritt)}/30 Sterne` : 'Besiege alle 10 Bots',
    chips: standardChips(fortschritt),
    knoepfe: [{ aktion: 'verlauf', icon: 'verlauf', label: 'Verlauf' }],
  })}
    <div class="inhalt">
      <div class="karte" tabindex="-1" aria-label="Weltkarte">
        <div class="welt">
          <div class="welt-bild" aria-hidden="true"></div>
          <div class="ort-karte-boss" hidden></div>
          <div class="ort-karte-event" hidden></div>
          <div class="flo-figur" aria-hidden="true">${floAvatar(letzteFarbe === 'b' ? 'b' : 'w')}</div>
        </div>
      </div>
      <aside class="detail" aria-label="Gegner"></aside>
    </div>`;
  root.append(s);

  const karte = s.querySelector('.karte');
  const welt = s.querySelector('.welt');
  const bild = s.querySelector('.welt-bild');
  const detail = s.querySelector('.detail');
  const floFigur = s.querySelector('.flo-figur');

  s.querySelector('[data-aktion="verlauf"]').addEventListener('click', () => app.gehe('verlauf'));
  // Premium-Umbau U2: Hauptseiten-Kopf (Klang-Schalter, Hell/Dunkel, Zahnrad), js/ui/seite.js
  const kopfHandle = verbindeKopf(s, app, { beiEinstellungen: () => app.gehe('einstellungen') });
  orte.kopf = fuelle('arena:kopf', s.querySelector('.kopf-chips'), { app, fortschritt });

  // ---------- Stationen ----------
  const knoten = BOTS.map((b) => {
    const z = b.id === neuId ? 'aktuell' : zustandVon(b);
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `stufe knoten ${z}${b.stufe === 10 ? ' boss' : ''}`;
    el.dataset.bot = b.id;
    el.style.setProperty('--bf', botFarbe(b));
    const sterne = fortschritt.bots[b.id].sterne;
    el.setAttribute('aria-label', knotenLabel(b, z));
    el.innerHTML = `
      ${b.stufe === 10 ? '<span class="boss-krone">ENDGEGNER</span>' : ''}
      ${z === 'aktuell' && b.id === aktuellId ? '<span class="fahne">NÄCHSTER GEGNER</span>' : ''}
      ${z === 'besiegt' ? `<span class="k-sterne" aria-hidden="true">${kSterneHtml(sterne)}</span>` : ''}
      <span class="avatar"><img src="${esc(avatarVon(b))}" alt="" draggable="false"></span>
      <span class="k-nr zahl" aria-hidden="true">${b.stufe}</span>
      ${z === 'gesperrt' || b.id === neuId ? `<span class="schloss">${icon('schloss')}</span>` : ''}
      <span class="k-schild"><span class="k-name">${esc(kurzName(b))}</span><span class="k-meta zahl">${b.elo}</span></span>`;
    el.addEventListener('click', () => tippeKnoten(b, el));
    welt.append(el);
    return el;
  });

  function knotenLabel(b, z) {
    const zustandText = { besiegt: 'besiegt', aktuell: 'nächster Gegner', gesperrt: 'gesperrt' }[z];
    const sterne = fortschritt.bots[b.id].sterne;
    return `Stufe ${b.stufe}: ${b.name}, Elo ${b.elo}, ${zustandText}${z === 'besiegt' ? `, ${sterne.filter(Boolean).length} von 3 Sternen` : ''}`;
  }

  function tippeKnoten(b, el) {
    if (el.classList.contains('gesperrt')) {
      // den Bot nennen, den Flo jetzt spielen kann (der direkte Vorgaenger ist evtl. selbst gesperrt)
      const vorher = BOTS.find((x) => x.stufe === b.stufe - 1);
      app.meldung(vorher && vorher.id === naechster.id
        ? `Besiege erst ${vorher.name}.`
        : `Gesperrt. Besiege zuerst ${naechster.name}, dann geht es Stufe für Stufe weiter.`);
      el.classList.remove('ruettel');
      void el.offsetWidth;
      el.classList.add('ruettel');
      return;
    }
    if (gewaehlt === b.id) {
      // schon gewaehlt: auf dem Handy zum Panel, dazu ein kurzer Wink des Spielen-Knopfs
      if (modus === 'hoch') detail.scrollIntoView({ behavior: reduziert() ? 'auto' : 'smooth', block: 'nearest' });
      const sp = detail.querySelector('[data-aktion="spielen"]');
      if (sp) anim(sp, [{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'none' }], { d: 420, k: 'feder' });
      return;
    }
    gewaehlt = b.id;
    markiereGewaehlt();
    try { klang.spiele('wechsel'); } catch (e) { /* still */ }
    // Station federt (Portraet hebt sich kurz), das Namensschild federt auf (entwurf-a/SYSTEM.md "Bot waehlen")
    anim(el.querySelector('.avatar'), [{ transform: 'scale(.86)' }, { transform: 'translateY(-5px) scale(1.04)', offset: 0.55 }, { transform: 'none' }], { d: 560, k: 'hupf' });
    anim(el.querySelector('.k-schild'), [{ transform: 'translateX(-50%) scale(.84)' }, { transform: 'translateX(-50%)' }], { d: 460, k: 'feder' });
    zeigeDetail(true, true);
  }

  function markiereGewaehlt() {
    for (const el of knoten) {
      const an = el.dataset.bot === gewaehlt;
      el.classList.toggle('gewaehlt', an);
      el.setAttribute('aria-pressed', an ? 'true' : 'false');
    }
  }

  // ---------- Karte: Layout, Zeichnung ----------
  let modus = null;
  let letzteKh = 0;
  let masse = { w: 0, h: 0, s: 1, y0: 0, hy: 0 };
  const yVon = (f) => masse.y0 + f * masse.hy;   // Anteil (0..1) -> Pixel in der Welt
  // das neue Stueck Fortschritt (Freischalten) ist schon sichtbar; ohne Bewegung von Anfang an (kein Ausblenden, das
  // sonst ueber eine Transition wieder einblendet)
  let wegGezeichnet = reduziert();
  function layout() {
    if (weg) return;
    const kw = karte.clientWidth;
    const kh = karte.clientHeight;
    if (!kw || !kh) return;
    const quer = !window.matchMedia('(orientation: portrait), (max-width: 760px)').matches && kh >= 420;
    const vorher = modus;
    modus = quer ? 'quer' : 'hoch';
    s.classList.toggle('karte-quer', quer);
    s.classList.toggle('karte-hoch', !quer);
    const lage = LAGEN[modus];
    const w = kw;
    // Hochformat: Handy gestreckter (Platz fuer Schilder, Sterne und Fahne zwischen den Stationen), iPad hoch wie C;
    // schmale Karten (Handy quer: Karte neben dem Panel) mindestens WELT_MIN_H hoch, sonst rueckten die Stationen so eng
    // zusammen, dass Sterne und Fahne auf das Schild der Station darueber stiessen
    const h = quer ? kh : Math.max(kh, Math.round(kw * (kw < 600 ? 2.3 : 1.45)), kw < 600 ? WELT_MIN_H : 0);
    const sk = Math.max(0.78, Math.min(1.12, Math.min(w, quer ? h : w * 1.1) / 700));
    // senkrechte Abbildung: quer 1:1 (die Lage ist dafuer gezeichnet); hoch mit Rand oben (Krone und Fahne ueber dem
    // Endgegner) und unten (Schild unter Station 1), damit keine Beschriftung aus der Karte ragt
    let y0 = 0;
    let hy = h;
    if (!quer) {
      const kn = 76 * sk;
      const ys = lage.stationen.map((p) => p[1]);
      const fMin = Math.min(...ys);
      const fMax = Math.max(...ys);
      const oben = kn * 0.65 + 72;
      const unten = kn * 0.61 + 36;
      hy = Math.min(h, (h - oben - unten) / (fMax - fMin));
      y0 = oben - fMin * hy;
    }
    masse = { w, h, s: sk, y0, hy };
    welt.style.width = w + 'px';
    welt.style.height = h + 'px';
    welt.style.setProperty('--kn-basis', Math.round(76 * sk) + 'px');
    const punkte = lage.stationen.map(([fx, fy]) => [fx * w, yVon(fy)]);
    const start = [lage.start[0] * w, yVon(lage.start[1])];
    const neuIdx = neuId ? idx(neuId) : -1;
    bild.innerHTML = weltSvg({ w, h, s: sk, lage, punkte, start, bis: aktuellIdx, neuIdx, y0, hy });
    const neuWeg = bild.querySelector('.w-fortschritt-neu');
    if (neuWeg && !wegGezeichnet) neuWeg.style.opacity = '0';
    // Stationen und Orte in Prozent der Welt (folgen damit jeder Groesse; hoch haengt y an der Abbildung)
    const setze = (el, [fx, fy]) => { el.style.left = (fx * 100).toFixed(2) + '%'; el.style.top = (yVon(fy) / h * 100).toFixed(2) + '%'; };
    lage.stationen.forEach((p, i) => setze(knoten[i], p));
    setze(s.querySelector('.ort-karte-boss'), lage.boss);
    setze(s.querySelector('.ort-karte-event'), lage.event);
    stelleFlo(floPosition());
    // im Querformat scrollt die Karte nicht: ein Rest aus dem Hochformat wuerde sie verschieben
    if (quer) { karte.scrollTop = 0; s.querySelector('.inhalt').scrollTop = 0; }
    // nach dem Drehen ins Hochformat den gewaehlten Gegner wieder ins Bild holen; ebenso, wenn sich nur die Hoehe der
    // Karte aendert (die Reiter-Pille kuerzt sie nach dem ersten Layout, die Karte waechst in freien Platz) und er dabei
    // aus dem sichtbaren Teil geraten ist
    if (!quer && vorher && vorher !== modus) scrolleZu(gewaehlt, false);
    else if (!quer && vorher && kh !== letzteKh && !ganzImBild(gewaehlt)) scrolleZu(gewaehlt, false);
    letzteKh = kh;
  }

  // steht die Station samt Schild (darunter) und Fahne (darueber) ganz im sichtbaren Teil der Karte?
  function ganzImBild(id) {
    const el = knoten[idx(id)];
    if (!el) return true;
    const k = karte.getBoundingClientRect();
    const teile = [el, el.querySelector('.k-schild'), el.querySelector('.fahne')].filter(Boolean).map((t) => t.getBoundingClientRect());
    return teile.every((n) => n.top >= k.top - 1 && n.bottom <= k.bottom + 1);
  }

  // Flo steht neben der zuletzt bezwungenen Station (sonst am Start des Wegs); beim Freischalten noch beim alten Platz
  function floPosition(vorStation = null) {
    const lage = LAGEN[modus];
    // zuletzt bezwungen: die Station vor dem naechsten Gegner (alle besiegt: der Endgegner); waehrend des Freischaltens
    // noch die Station davor
    const letzte = alleBesiegt ? BOTS.length - 1 : aktuellIdx - 1;
    const i = vorStation != null ? vorStation : (neuId && !wegGezeichnet ? idx(neuId) - 2 : letzte);
    const kn = 76 * masse.s;
    if (i < 0) return [lage.start[0] * masse.w + kn * 0.1, yVon(lage.start[1]) - kn * 0.45];
    const [fx, fy] = lage.stationen[i];
    const gross = BOTS[i].id === aktuellId ? 1.22 : 1;
    return [fx * masse.w + kn * gross * 0.52, yVon(fy) - kn * gross * 0.28];
  }
  function stelleFlo([x, y]) {
    floFigur.style.left = x.toFixed(1) + 'px';
    floFigur.style.top = y.toFixed(1) + 'px';
  }

  function scrolleZu(id, sanft) {
    if (modus !== 'hoch') return;
    const i = idx(id);
    if (i < 0) return;
    const y = yVon(LAGEN.hoch.stationen[i][1]);
    const ziel = Math.max(0, Math.min(welt.offsetHeight - karte.clientHeight, y - karte.clientHeight * 0.55));
    if (sanft && !reduziert() && karte.scrollTo) {
      try { karte.scrollTo({ top: ziel, behavior: 'smooth' }); } catch (e) { karte.scrollTop = ziel; }
    } else karte.scrollTop = ziel;
  }

  // ---------- Gegner-Panel ----------
  let panelLauf = 0;
  function zeigeDetail(neueBlase, animiert = false) {
    const lauf = ++panelLauf;
    const b = BOTS.find((x) => x.id === gewaehlt);
    const f = fortschritt.bots[b.id];
    const mm = MERKMALE[b.id] || MERKMALE.benno;
    const z = b.id === neuId ? 'aktuell' : zustandVon(b);
    const st = statistik();
    const laufend = ladeLaufendePartie();
    // W0+a: auch angemeldete Bots (z. B. ein Boss), solange ihr Paket geladen ist (sonst gibt es keine laufende Partie)
    const laufBot = laufend ? botNachId(laufend.botId) : null;
    const status = z === 'besiegt' ? 'Besiegt' : 'Nächster Gegner';
    const satz = begruessung(b);
    detail.style.setProperty('--bf', botFarbe(b));
    if (orte.oben) orte.oben.verlasse();
    if (orte.heute) orte.heute.verlasse();
    if (orte.bot) orte.bot.verlasse();
    const bau = () => {
      if (lauf !== panelLauf || weg) return;
      detail.innerHTML = `
      <div class="ort-panel-oben" hidden></div>
      <section class="heute-karte" aria-label="Heute" hidden><div class="hk-kopf"></div><div class="ort-heute"></div></section>
      ${laufend && laufBot ? `
      <div class="fortsetzen" style="--bf:${botFarbe(laufBot)}">
        <span class="avatar"><img src="${esc(avatarVon(laufBot))}" alt=""></span>
        <div class="ft-text"><b>Offene Partie</b><span>gegen ${esc(laufBot.name)}</span><span>bei Zug ${Math.floor(laufend.zuege.length / 2) + 1}</span></div>
        <button class="knopf primaer dr" type="button" data-aktion="fortsetzen">${icon('play')} Fortsetzen</button>
      </div>` : ''}
      <div class="detail-links">
        <div class="detail-kopf">
          <div class="av"><img src="${esc(avatarVon(b))}" alt=""></div>
          <div class="detail-name">
            <div class="ueberzeile detail-ueber${z === 'aktuell' ? ' akz' : ''}">Stufe ${b.stufe} · ${status}</div>
            <h2 class="disp">${esc(b.name)}</h2>
            <div class="elo zahl">Elo ${b.elo} · ${esc(b.titel)}</div>
            <div class="mini-sterne" aria-label="${f.sterne.filter(Boolean).length} von 3 Sternen">${kSterneHtml(f.sterne)}</div>
          </div>
        </div>
        <div class="sprechblase spruch${neueBlase ? '' : ' still'}">„${esc(satz)}“</div>
        <div class="merkmale">
          <div class="merkmal"><span class="m-label">Lieblingsfigur</span><span class="m-wert"><span class="m-figur"><img src="assets/pieces/w${mm.figur}.svg" alt=""></span>${esc(mm.lieblings)}</span></div>
          <div class="merkmal"><span class="m-label">Tempo</span><span class="m-wert">${esc(mm.tempo)}</span></div>
          <div class="merkmal"><span class="m-label">Schwäche</span><span class="m-wert">${esc(mm.schwaeche)}</span></div>
        </div>
      </div>
      <div class="detail-rechts">
        <div class="ziel-sterne" aria-label="Bedingungen für die drei Sterne">
          ${zielSterneHtml(f.sterne)}
        </div>
        <div class="ort-panel-bot" hidden></div>
        <div class="wahl wahl-farbe"><div class="wahl-titel">Deine Farbe</div><div class="farbwahl-ort"></div></div>
        <div class="ort-tempo" hidden></div>
        <div class="cta-platz"><button class="knopf primaer gross spielen dr" type="button" data-aktion="spielen"><span class="sp-text">${spielenText(b, z === 'besiegt')}</span><span class="pf">${icon('pfeil')}</span></button></div>
        <div class="bilanz">${bilanzHtml(st)}</div>
      </div>`;

      // Farbe als Segment (A): Hooks .farbwahl [data-farbe="w|zufall|b"][aria-checked]
      const fig = (x) => `<img class="fig" src="assets/pieces/${x}.svg" alt="">`;
      const seg = segment({
        name: 'farbe', label: 'Deine Farbe', wert: letzteFarbe,
        optionen: [
          { id: 'w', zeile: true, label: 'Weiß', html: `<span class="fig-bg">${fig('wK')}</span>Weiß` },
          { id: 'zufall', zeile: true, label: 'Zufall', html: `<span class="fig-bg fig-paar">${fig('wK')}${fig('bK')}</span>Zufall` },
          { id: 'b', zeile: true, label: 'Schwarz', html: `<span class="fig-bg">${fig('bK')}</span>Schwarz` },
        ],
        beiWahl: (id) => { letzteFarbe = id; floFigur.innerHTML = floAvatar(id === 'b' ? 'b' : 'w'); },
      });
      seg.el.classList.add('farbwahl');
      for (const k of seg.el.querySelectorAll('.seg')) k.dataset.farbe = k.dataset.wert;
      detail.querySelector('.farbwahl-ort').replaceWith(seg.el);

      detail.querySelector('[data-aktion="spielen"]').addEventListener('click', () => spielen(b));
      const fort = detail.querySelector('[data-aktion="fortsetzen"]');
      if (fort) {
        fort.addEventListener('click', () => app.gehe('partie', { botId: laufend.botId, farbe: laufend.spielerFarbe, fortsetzen: true }));
      }
      // Orte im Panel: oben (davor die Nachlese) und nach den Stern-Zielen
      const oben = detail.querySelector('.ort-panel-oben');
      const nl = nachleseKarte();
      if (nl) oben.append(nl);
      orte.oben = fuelle('arena:panel-oben', oben, { app, bot: b, fortschritt });
      oben.hidden = !nl && orte.oben.anzahl === 0;
      // W0+a: Heute-Karte (Ort arena:heute), nur mit Zeilen sichtbar
      const heute = detail.querySelector('.heute-karte');
      const tag = tagSchluessel();
      heute.querySelector('.hk-kopf').textContent = `Heute · ${WOCHENTAGE[wochentag(tag)]}`;
      orte.heute = fuelle('arena:heute', heute.querySelector('.ort-heute'), { app, bot: b, fortschritt, tag, woche: wochenSchluessel() });
      heute.hidden = orte.heute.anzahl === 0;
      const botOrt = detail.querySelector('.ort-panel-bot');
      orte.bot = fuelle('arena:panel-bot', botOrt, { app, bot: b, fortschritt });
      botOrt.hidden = orte.bot.anzahl === 0;
      if (animiert && tempo() > 0) {
        const teile = [...detail.querySelectorAll(':scope > :not([hidden]):not(.detail-links):not(.detail-rechts), .detail-links > *, .detail-rechts > :not([hidden])')];
        staffel(teile, { d: 520, abstand: 38, von: 'translateY(12px)' });
        anim(detail.querySelector('.detail-kopf .av'), [{ transform: 'scale(.7) rotate(-6deg)' }, { transform: 'none' }], { d: 640, k: 'hupf' });
      }
    };
    // Bot wechseln: das neue Panel steht sofort (Orte und Hooks gleich da, tests/app.test.mjs zaehlt direkt nach dem
    // Tipp) und kommt gestaffelt herein (bau() oben)
    bau();
  }

  function bilanzHtml(st) {
    return `
          <div><b>${st.partien}</b><span>Partien</span></div>
          <div><b>${st.siege}</b><span>Siege</span></div>
          <div><b>${prozent(st.schnittGenauigkeit)}</b><span>Ø Genauigkeit</span></div>
          <div><b>${st.spielstaerke ? '≈ ' + st.spielstaerke : '-'}</b><span>Spielstärke</span></div>
        `;
  }

  // Nachgeholte Analyse (w0c): Sterne, Kopf-Chip und Bilanz still neu zeichnen, ohne Animation und ohne
  // das Panel neu aufzubauen. Nur Stern 2 kann sich so aendern (Sieg und Freischaltung sind schon gebucht).
  function sterneNeu() {
    if (weg) return;
    const neu = ladeFortschritt();
    for (const b of BOTS) fortschritt.bots[b.id] = neu.bots[b.id];
    const zahl = s.querySelector('.kopf-chips .chip .sr');
    if (zahl && zahl.nextSibling && zahl.nextSibling.nodeType === 3) zahl.nextSibling.textContent = ' ' + gesamtSterne(fortschritt);
    if (alleBesiegt) s.querySelector('.logo-unter').textContent = `Arena bezwungen! ${gesamtSterne(fortschritt)}/30 Sterne`;
    BOTS.forEach((b, i) => {
      const el = knoten[i];
      const z = b.id === neuId ? 'aktuell' : zustandVon(b);
      const ks = el.querySelector('.k-sterne');
      if (ks) ks.innerHTML = kSterneHtml(fortschritt.bots[b.id].sterne);
      el.setAttribute('aria-label', knotenLabel(b, z));
    });
    const f = fortschritt.bots[gewaehlt];
    const mini = detail.querySelector('.mini-sterne');
    if (f && mini) {
      mini.innerHTML = kSterneHtml(f.sterne);
      mini.setAttribute('aria-label', `${f.sterne.filter(Boolean).length} von 3 Sternen`);
    }
    const ziele = detail.querySelector('.ziel-sterne');
    if (f && ziele) ziele.innerHTML = `\n          ${zielSterneHtml(f.sterne)}\n        `;
    const bilanz = detail.querySelector('.bilanz');
    if (bilanz) bilanz.innerHTML = bilanzHtml(statistik());
  }

  // Begruessung im Panel: dieselbe Wahl wie in der Partie (Wahl-Ort partie:begruessung?)
  function begruessung(b) {
    let wahl = null;
    try {
      wahl = waehle('partie:begruessung?', {
        bot: b, farbe: letzteFarbe === 'zufall' ? null : letzteFarbe, modus: 'normal',
        partienGegenBot: ladePartien().filter((p) => p.botId === b.id),
      });
    } catch (e) { wahl = null; }
    const anlass = wahl && typeof wahl.anlass === 'string' && wahl.anlass ? wahl.anlass : null;
    return (anlass && botSatz(b, anlass, Math.random, wahl.werte || null)) || botSatz(b, 'begruessung') || '';
  }

  // Nachlese: was nach der letzten Partie nicht mehr ins Ergebnis passte (still, ohne Klang)
  function nachleseKarte() {
    if (!feierRest.length) return null;
    const k = document.createElement('div');
    k.className = 'nachlese';
    k.setAttribute('role', 'status');
    k.innerHTML = '<div class="nl-titel">Seit deiner letzten Partie</div>';
    for (const f of feierRest) {
      const z = document.createElement('div');
      z.className = 'nl-zeile' + (f.art === 'gross' ? ' gross' : '');
      z.innerHTML = '<b></b>';
      z.querySelector('b').textContent = f.titel;
      if (f.text) {
        const t = document.createElement('span');
        t.textContent = f.text;
        z.append(' ', t);
      }
      k.append(z);
    }
    return k;
  }

  // Spielen: Rueckfrage bei offener Partie, dann das Duell-Intro (js/ui/duell.js) und nach dessen `bereit` die Partie
  async function spielen(b) {
    ladePartieScreen();
    const laufend = ladeLaufendePartie();
    if (laufend) {
      const lb = botNachId(laufend.botId);
      const ok = await app.frage({
        titel: 'Neue Partie starten?',
        text: `Du hast noch eine offene Partie gegen ${lb ? lb.name : 'einen Bot'}. Sie wird verworfen.`,
        knoepfe: [{ text: 'Abbrechen', wert: false }, { text: 'Neue Partie', wert: true, art: 'primaer' }],
        abbrechen: false,
      });
      if (!ok || weg) return;
      loescheLaufendePartie();
    }
    const farbe = letzteFarbe === 'zufall' ? (Math.random() < 0.5 ? 'w' : 'b') : letzteFarbe;
    let einstellung = 'besondere';
    try { einstellung = (app.einstellungen && app.einstellungen().duellIntro) || 'besondere'; } catch (e) { /* Standard */ }
    let erste = true;
    try { erste = !ladePartien().some((p) => p.botId === b.id); } catch (e) { erste = true; }
    const anlass = b.stufe === 10 ? 'boss' : (erste ? 'erste' : null);
    const art = duellArt({ einstellung, anlass, reduziert: reduziert() });
    const von = detail.querySelector('.detail-kopf .av') || knoten[idx(b.id)].querySelector('.avatar');
    const duell = spieleDuell({ bot: b, farbe, anlass, von, art });
    await duell.bereit;
    if (weg) return;
    app.gehe('partie', { botId: b.id, farbe });
  }

  // ---------- Eintritt ----------
  function eintritt() {
    if (tempo() === 0) return;
    kopfEintritt(s);
    anim(karte, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { d: 640, v: 40, k: 'weich' });
    if (!neuId) {
      // Stationen fallen gestaffelt (nur das Portraet und das Schild bewegen sich: die Station selbst bleibt messbar)
      knoten.forEach((el, i) => {
        anim(el.querySelector('.avatar'), [{ opacity: 0, transform: 'translateY(-18px) scale(.6)' }, { opacity: 1, transform: 'none' }], { d: 560, v: 160 + i * 48, k: 'hupf' });
        anim(el.querySelector('.k-schild'), [{ opacity: 0, transform: 'translateX(-50%) translateY(6px)' }, { opacity: 1, transform: 'translateX(-50%)' }], { d: 420, v: 300 + i * 48, k: 'weich' });
      });
      const fahne = s.querySelector('.knoten .fahne');
      if (fahne) anim(fahne, [{ opacity: 0, transform: 'translateX(-50%) translateY(10px) scale(.6)' }, { opacity: 1, transform: 'translateX(-50%)' }], { d: 560, v: 160 + knoten.length * 48, k: 'hupf' });
      anim(floFigur, [{ opacity: 0, transform: 'translateY(-30px) scale(.5)' }, { opacity: 1, transform: 'none' }], { d: 600, v: 400 + aktuellIdx * 48, k: 'hupf' });
      // der Fortschritts-Pfad zeichnet sich
      const pfad = bild.querySelector('.w-fortschritt');
      if (pfad && pfad.getTotalLength) {
        let laenge = 0;
        try { laenge = pfad.getTotalLength(); } catch (e) { laenge = 0; }
        if (laenge > 0) {
          pfad.style.strokeDasharray = String(laenge);
          anim(pfad, [{ strokeDashoffset: laenge }, { strokeDashoffset: 0 }], { d: 900, v: 260, k: 'gleiten' });
        }
      }
    }
    anim(detail, [{ opacity: 0, transform: 'translateY(22px) scale(.985)' }, { opacity: 1, transform: 'none' }], { d: 700, v: 140, k: 'weich' });
    staffel([...detail.querySelectorAll(':scope > :not([hidden]):not(.detail-links):not(.detail-rechts), .detail-links > *, .detail-rechts > :not([hidden])')],
      { d: 520, v: 240, abstand: 40, von: 'translateY(10px)' });
  }

  // ---------- Freischalt-Choreografie (nach einem Sieg, params.neuFreigeschaltet) ----------
  function freischalten() {
    const i = idx(neuId);
    const el = knoten[i];
    if (!el) return;
    const alt = knoten[i - 1];
    const neuWeg = () => bild.querySelector('.w-fortschritt-neu');
    if (reduziert()) {
      el.querySelector('.schloss')?.remove();
      el.classList.add('frei');
      wegGezeichnet = true;
      const nw = neuWeg();
      if (nw) nw.style.opacity = '';
      stelleFlo(floPosition());
      return;
    }
    el.classList.add('wird-frei');
    s.classList.add('freischaltung');
    const f = tempo();
    const T = (ms) => Math.round(ms * f);
    // 1. die alte Station bekommt ihre Sterne (gestaffelt, Stern-Klang bei der Landung)
    if (alt) {
      alt.querySelectorAll('.k-sterne .ico').forEach((st, n) => anim(st, [{ opacity: 0, transform: 'translateY(-14px) scale(.3) rotate(-40deg)' }, { opacity: 1, transform: 'none' }],
        { d: 620, v: 350 + n * 110, k: 'hupf' }));
      spaeter(() => { try { klang.stern(2); } catch (e) { /* still */ } }, T(700));
    }
    // 2. die Karte holt die neue Station ins Bild
    spaeter(() => scrolleZu(neuId, true), T(250));
    // 3. der Weg waechst bis zur neuen Station, Flo zieht weiter
    spaeter(() => {
      const nw = neuWeg();
      if (nw && nw.getTotalLength) {
        let laenge = 0;
        try { laenge = nw.getTotalLength(); } catch (e) { laenge = 0; }
        nw.style.opacity = '';
        if (laenge > 0) {
          nw.style.strokeDasharray = String(laenge);
          anim(nw, [{ strokeDashoffset: laenge }, { strokeDashoffset: 0 }], { d: 700, k: 'gleiten' });
        }
      }
      wegGezeichnet = true;
      // Flo zieht vom Platz vor dem Sieg (Station i - 2, sonst der Start) zur gerade bezwungenen Station i - 1
      const von = floPosition(i - 2);
      const nach = floPosition(i - 1);
      const dx = von[0] - nach[0];
      const dy = von[1] - nach[1];
      stelleFlo(nach);
      anim(floFigur, [{ transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)` }, { transform: `translate(${(dx / 2).toFixed(1)}px, ${(dy / 2 - 34).toFixed(1)}px)`, offset: 0.5 }, { transform: 'none' }],
        { d: 760, k: 'sanft' });
    }, T(900));
    // 4. das Schloss springt ab, die Station bekommt Farbe und ihre Fahne
    spaeter(() => {
      const schloss = el.querySelector('.schloss');
      try { klang.umwandlung(); } catch (e) { /* still */ }
      el.classList.add('frei');
      anim(el.querySelector('.avatar'), [{ transform: 'scale(.86)' }, { transform: 'scale(1.1)', offset: 0.6 }, { transform: 'none' }], { d: 700, k: 'hupf' });
      if (schloss) {
        anim(schloss, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(-10px) rotate(-18deg) scale(1.15)', opacity: 1, offset: 0.4 }, { transform: 'translateY(16px) rotate(30deg) scale(.4)', opacity: 0 }],
          { d: 560, k: 'sanft', fill: 'forwards' }).finished.then(() => schloss.remove(), () => schloss.remove());
      }
      // die Fahne wandert von der bezwungenen Station zur neuen (Versatz der beiden Stationen, gleiche Kante oben)
      const fahne = el.querySelector('.fahne');
      if (fahne) {
        let dx = 0;
        let dy = 12;
        if (alt) {
          const a = alt.getBoundingClientRect();
          const n = el.getBoundingClientRect();
          dx = a.left + a.width / 2 - (n.left + n.width / 2);
          dy = a.top - n.top;
        }
        const weg = `translateX(-50%) translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
        anim(fahne, [{ opacity: 0, transform: weg + ' scale(.6)' }, { opacity: 1, transform: weg, offset: 0.18 }, { opacity: 1, transform: 'translateX(-50%) translateY(-10px)', offset: 0.78 }, { opacity: 1, transform: 'translateX(-50%)' }],
          { d: 760, v: 60, k: 'sanft', fill: 'forwards' });
      }
    }, T(1700));
    // 5. Ende der Choreografie (feste 2,7 s, tests/app.test.mjs)
    spaeter(() => {
      el.querySelector('.schloss')?.remove();
      el.classList.remove('wird-frei', 'frei');
      s.classList.remove('freischaltung');
      const fahne = el.querySelector('.fahne');
      if (fahne) fahne.getAnimations().forEach((a) => a.cancel());
      app.meldung(`Neu freigeschaltet: ${BOTS[i].name}!`);
    }, FREI_DAUER_MS);
  }

  // ---------- Start ----------
  markiereGewaehlt();
  zeigeDetail(true);
  layout();
  scrolleZu(neuId ? BOTS[Math.max(0, idx(neuId) - 1)].id : gewaehlt, false);
  eintritt();
  if (neuId) freischalten();
  // Plaetze auf der Karte (Zelt des Wochen-Boss, Event-Fahne): ohne Anbieter unsichtbar
  const karteKontext = { app, fortschritt, karte, scrolleZu: (id, sanft) => scrolleZu(id, !!sanft) };
  const ortBoss = s.querySelector('.ort-karte-boss');
  orte.karteBoss = fuelle('arena:karte-boss', ortBoss, karteKontext);
  ortBoss.hidden = orte.karteBoss.anzahl === 0;
  const ortEvent = s.querySelector('.ort-karte-event');
  orte.karteEvent = fuelle('arena:karte-event', ortEvent, karteKontext);
  ortEvent.hidden = orte.karteEvent.anzahl === 0;
  // Aufruf-Ort arena:start (z. B. eine Kamerafahrt beim ersten Start), einmal nach dem ersten Layout
  orte.start = fuelle('arena:start', null, {
    app, s, karte, scrolleZu: (id, sanft) => scrolleZu(id, !!sanft), neuId,
  });
  if (typeof ResizeObserver === 'function') {
    let letzteB = karte.clientWidth;
    let letzteH = karte.clientHeight;
    beobachter = new ResizeObserver(() => {
      const kb = karte.clientWidth;
      const kh = karte.clientHeight;
      if (kb === letzteB && kh === letzteH) return;
      letzteB = kb;
      letzteH = kh;
      layout();
    });
    beobachter.observe(karte);
  }
  const beiGroesse = () => layout();
  window.addEventListener('orientationchange', beiGroesse);

  // Engines und den Partie-Screen im Hintergrund vorwaermen, damit die erste Partie sofort startet (der Partie-Screen
  // baut sich waehrend des Duell-Intros unter der Buehne auf; je schneller, desto laenger der Portraetflug)
  spaeter(() => { app.engine('bot').catch(() => {}); app.engine('bewertung').catch(() => {}); ladePartieScreen(); }, 900);
  // Fehlende Analysen still nachholen (Stern 2); endet mit verlasse(), also auch beim Start einer Partie
  let nachholLauf = null;
  spaeter(() => { if (!weg) nachholLauf = starteNachholen(app, { beiPartie: sterneNeu }); }, ARENA_NACHHOLEN_MS + (neuId && !reduziert() ? 1000 : 0));

  return {
    verlasse() {
      weg = true;
      if (nachholLauf) nachholLauf.stop();
      for (const u of uhren) clearTimeout(u);
      uhren.clear();
      if (beobachter) beobachter.disconnect();
      window.removeEventListener('orientationchange', beiGroesse);
      for (const o of Object.values(orte)) if (o) o.verlasse();
      kopfHandle.verlasse();
    },
  };
}
