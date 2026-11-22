// Paket-CSS vor dem Aufbau (fc-14:10, Befund 20.11.2026: lernen.css kam erst beim Aufbau des Screens, der Screen wurde ohne
// Stil gemalt und danach die ganze Seite neu gerechnet). Ein gemeinsamer Lader fuer alle Pakete und Paket-Screens:
//   ladePaketCss(paket, { screens, href })  haengt css/pakete/<paket>.css einmal je Paket an (oder nimmt einen schon
//       vorhandenen link[data-paket]) und gibt immer dasselbe Promise zurueck. Es wird NIE abgelehnt: null, sobald das CSS
//       geladen ist, sonst ein PaketCssFehler (grund 'fehler': error/404/ohne Netz; 'frist': nach PAKET_CSS_FRIST_MS noch
//       nichts). Wer baut, wartet darauf und baut danach in jedem Fall.
//   Wer beim START laedt (Paket-index.js, ui/raetsel.js, js/schule.js), wartet hoechstens START_FRIST_MS (beimStart): ein
//       volles await dort hielte den Start bis zur Frist auf. Voll warten darf nur ein Screen-Modul, das app.js erst beim
//       Oeffnen per import() holt.
//   cssFehlerFuerScreen(name)  synchron: der PaketCssFehler des Pakets, das diesen Screen bedient, solange sein CSS nicht
//       geladen ist, sonst null (fuer den Fehlerweg in js/app.js bei jedem Zeigen).
//   Ereignis 'schach:paket-fehler' auf window je Zustandswechsel zu 'fehler' bzw. 'frist', detail { paket, art: 'css',
//       screens, fehler }; immer asynchron, nie mitten in zeige(). console.error einmal je Paket.

export const PAKET_CSS_FRIST_MS = 4000;

export class PaketCssFehler extends Error {
  constructor(paket, grund, href) {
    super(`Paket-CSS nicht geladen: ${paket} (${grund})`);
    this.name = 'PaketCssFehler';
    this.paket = paket;
    this.grund = grund;
    this.href = href;
  }
}

const pakete = new Map();   // paket -> { versprechen, fehler, screens, gemeldet }

const melde = (eintrag, paket, fehler) => {
  eintrag.fehler = fehler;
  if (!eintrag.gemeldet) { eintrag.gemeldet = true; console.error(fehler.message); }
  try { window.dispatchEvent(new CustomEvent('schach:paket-fehler', { detail: { paket, art: 'css', screens: eintrag.screens, fehler } })); }
  catch (e) { /* ohne window: kein Ereignis */ }
};

// marke: das data-Merkmal des link (Vorgabe data-paket="<paket>"); einige Pakete und ihre Tests kennen ihr altes Merkmal
// (coach-ki und schule data-paket-css, raetsel data-screen, online data-online)
export function ladePaketCss(paket, { screens = [], href = null, marke = { paket } } = {}) {
  const da = pakete.get(paket);
  if (da) {
    for (const s of screens) if (!da.screens.includes(s)) da.screens.push(s);
    return da.versprechen;
  }
  const eintrag = { versprechen: null, fehler: null, screens: [...screens], gemeldet: false };
  pakete.set(paket, eintrag);
  if (typeof document === 'undefined') { eintrag.versprechen = Promise.resolve(null); return eintrag.versprechen; }
  const ziel = href || new URL(`../css/pakete/${paket}.css`, import.meta.url).href;
  eintrag.versprechen = new Promise((fertig) => {
    const [schluessel, wert] = Object.entries(marke)[0];
    let l = document.querySelector(`link[data-${schluessel.replace(/[A-Z]/g, (b) => '-' + b.toLowerCase())}="${wert}"]`);
    // schon geladen (ein frueherer Lader): sofort
    if (l && l.sheet) { fertig(null); return; }
    // das Promise steht beim ersten Ausgang fest; was danach kommt, aendert nur den Zustand fuer cssFehlerFuerScreen
    // (laedt es nach der Frist doch noch, ist der Fehler weg; scheitert es danach, kommt die Meldung 'fehler')
    let steht = false;
    const ausgang = (fehler) => {
      if (fehler) melde(eintrag, paket, fehler); else eintrag.fehler = null;
      if (!steht) { steht = true; clearTimeout(uhr); fertig(fehler); }
    };
    const uhr = setTimeout(() => ausgang(new PaketCssFehler(paket, 'frist', ziel)), PAKET_CSS_FRIST_MS);
    const neu = !l;
    if (neu) {
      l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = ziel;
      l.dataset[schluessel] = wert;
    }
    l.addEventListener('load', () => ausgang(null), { once: true });
    l.addEventListener('error', () => ausgang(new PaketCssFehler(paket, 'fehler', ziel)), { once: true });
    if (neu) document.head.append(l);
  });
  return eintrag.versprechen;
}

// Fuer alles, was beim START laedt: hoechstens START_FRIST_MS auf das CSS warten, dann weiter (das Laden laeuft weiter).
// So malt der Start im Normalfall gleich mit Stil (das CSS kommt aus dem Cache in wenigen ms), haengt aber nie.
// Alle, die in einem Schub warten, teilen EIN Fristende: Module, die einander importieren (kartei importiert ui/raetsel.js),
// warten sonst nacheinander und summieren ihre Fristen (gemessen: 688 ms statt 300 bei haengendem CSS). Wer kurz nach dem
// Fristende kommt, wartet nicht mehr; erst nach SCHUB_PAUSE_MS Ruhe (ein Modul, das spaeter beim Oeffnen laedt) beginnt
// ein neuer Schub.
export const START_FRIST_MS = 300;
const SCHUB_PAUSE_MS = 2000;
let schubEnde = 0;
export const beimStart = (versprechen) => {
  const jetzt = Date.now();
  if (jetzt > schubEnde + SCHUB_PAUSE_MS) schubEnde = jetzt + START_FRIST_MS;
  return Promise.race([versprechen, new Promise((r) => { setTimeout(r, Math.max(0, schubEnde - jetzt)); })]);
};

export function cssFehlerFuerScreen(name) {
  for (const e of pakete.values()) if (e.fehler && e.screens.includes(name)) return e.fehler;
  return null;
}
