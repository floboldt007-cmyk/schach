// Anzeige-Orte (Slots) der Schach-Arena (Runde 4, Welle 0). Rein, in Node testbar (braucht vom
// Container nur appendChild/removeChild, von Elementen nur nodeType und parentNode).
// Pakete bieten an einem Ort etwas an, die Host-Screens fuellen ihre Orte beim Zeichnen.
//
//   import { anbieten, fuelle, waehle } from './orte.js';
//   anbieten('verlauf:seite', ({ app }) => element, { reihenfolge: 30, paket: 'kartei' });
//   const gefuellt = fuelle('verlauf:seite', container, { app });   // Host
//   gefuellt.verlasse();                                              // Host vor dem Neuzeichnen
//
// API:
//   ORTE                           eingefroren: Ort -> Art ('dom' | 'aufruf' | 'wahl'). Wahl-Orte enden auf "?".
//   anbieten(ort, anbieter, { reihenfolge = 50, paket } = {}) -> abmelden()
//       DOM-Ort:    anbieter(kontext) -> HTMLElement | { el, verlasse() } | null
//       Aufruf-Ort: anbieter(kontext) -> { verlasse() } | null   (macht selbst etwas, z. B. eine Kamerafahrt)
//       Wahl-Ort:   anbieter(kontext) -> Wert | null
//       Unbekannter Ort oder anbieter keine Funktion: Fehler (Tippfehler fallen sofort auf).
//   fuelle(ort, container, kontext) -> { anzahl, verlasse(), fertig, wartend }   nur Host-Screens, nur DOM- und
//       Aufruf-Orte.
//       Ruft die Anbieter in ihrer Reihenfolge (kleinere Zahl zuerst, bei Gleichstand Anmelde-Reihenfolge)
//       und haengt die Elemente hinten an den Container an (der Container wird NICHT geleert).
//       verlasse() ruft die verlasse() der Anbieter und nimmt deren Elemente wieder heraus (idempotent).
//       W0+a: Ein Aufruf-Anbieter darf zusaetzlich { fertig: Promise } liefern (z. B. ein Finisher, der laeuft);
//       fertig ist dann ein Promise, das sich erfuellt, sobald alle diese Promises fertig sind (auch bei Fehlern),
//       wartend die Zahl dieser Anbieter (0: fertig ist sofort erfuellt, der Host wartet nicht).
//   angeboten(ort) -> Zahl der Anbieter an diesem Ort (W0+a; ein Host spart sich damit Wartezeiten, wenn
//       niemand etwas anbietet). Unbekannter Ort: Fehler.
//   waehle(ort, kontext) -> Wert | null   nur Wahl-Orte: erster Wert != null in der Reihenfolge
//   zuruecksetzen()                alle Anbieter entfernen (nur fuer Tests)
//   setzeFehlerMelder(fn | null)   Tester-Bericht (Luecken-Check 10): fn(ort, paket, fehler) bekommt zusaetzlich zur
//                                  Konsole jeden Fehler eines Anbieters (js/protokoll.js meldet sich hier an; orte.js
//                                  importiert weiter nichts). Ein Fehler im Melder bleibt ohne Folgen; zuruecksetzen()
//                                  laesst den Melder stehen.
//
// Regeln: Kontexte sind flach eingefroren. Ein Anbieter rechnet nichts Schweres (nur Modul-Speicher
// lesen), bindet seine Klicks selbst an sein Element und liefert null, wenn er nichts zu zeigen hat.
// Ein werfender Anbieter macht den Host nie kaputt (console.error, die anderen laufen weiter).

export const ORTE = Object.freeze({
  'arena:kopf': 'dom',
  'arena:panel-oben': 'dom',
  'arena:panel-bot': 'dom',
  'arena:start': 'aufruf',
  'partie:begruessung?': 'wahl',
  'ergebnis:karte': 'dom',
  'analyse:coach': 'dom',
  'analyse:oben': 'dom',
  'verlauf:seite': 'dom',
  'einstellungen:gruppen': 'dom',
  'app:erster-screen?': 'wahl',
  // W0+a "Spiel-Fundament" (SPIELKONZEPT 6.2), Hosts und Kontexte in ARCHITEKTUR.md "W0+a: Spiel-Fundament"
  'arena:heute': 'dom',
  'partie:gegner-leiste': 'dom',
  'partie:matt': 'aufruf',
  'ergebnis:abrechnung': 'dom',
  'bestenliste:reiter': 'dom',
  'training:karten': 'dom',
  'ich:vitrine': 'dom',
  'spielplan:tage': 'dom',
  // w0plus-a-fix: Schub 2b (Emote-Rad, Schnell-Chat, Flamme des Siegeslaufs an Flos Namen), Host partie.js
  'partie:spieler-leiste': 'dom',
  'partie:aktionen': 'dom',
  // Premium-Umbau U5 (Weltkarte): zwei Plaetze auf der Karte, Host arena.js (.ort-karte-boss am Zelt des Wochen-Boss,
  // .ort-karte-event an der Fahne); ohne Anbieter unsichtbar. Kontext { app, fortschritt, karte, scrolleZu }
  'arena:karte-boss': 'dom',
  'arena:karte-event': 'dom',
});

let anbieterListe = new Map();   // ort -> [{ fn, reihenfolge, paket, nr }]
let zaehler = 0;
let fehlerMelder = null;

export function setzeFehlerMelder(fn) {
  fehlerMelder = typeof fn === 'function' ? fn : null;
}

function artVon(ort) {
  const art = Object.prototype.hasOwnProperty.call(ORTE, ort) ? ORTE[ort] : null;
  if (!art) throw new Error('Unbekannter Anzeige-Ort: ' + String(ort));
  return art;
}

function meldeFehler(ort, eintrag, f) {
  try { console.error(`Anbieter ${eintrag && eintrag.paket ? '"' + eintrag.paket + '" ' : ''}an ${ort} fehlgeschlagen:`, f); } catch (x) { /* egal */ }
  if (fehlerMelder) {
    try { fehlerMelder(ort, (eintrag && eintrag.paket) || '', f); } catch (x) { /* egal */ }
  }
}

const istElement = (x) => !!x && typeof x === 'object' && x.nodeType === 1;
const einfrieren = (k) => Object.freeze(k && typeof k === 'object' ? { ...k } : {});

export function anbieten(ort, anbieter, { reihenfolge = 50, paket } = {}) {
  artVon(ort);
  if (typeof anbieter !== 'function') throw new TypeError('anbieten(' + ort + '): anbieter ist keine Funktion');
  const eintrag = {
    fn: anbieter,
    reihenfolge: Number.isFinite(reihenfolge) ? reihenfolge : 50,
    paket: paket == null ? '' : String(paket),
    nr: zaehler++,
  };
  const neu = [...(anbieterListe.get(ort) || []), eintrag];
  neu.sort((a, b) => a.reihenfolge - b.reihenfolge || a.nr - b.nr);
  anbieterListe.set(ort, neu);
  let aktiv = true;
  return function abmelden() {
    if (!aktiv) return;
    aktiv = false;
    const jetzt = (anbieterListe.get(ort) || []).filter((e) => e !== eintrag);
    if (jetzt.length) anbieterListe.set(ort, jetzt);
    else anbieterListe.delete(ort);
  };
}

export function fuelle(ort, container, kontext) {
  const art = artVon(ort);
  if (art === 'wahl') throw new Error('fuelle: ' + ort + ' ist ein Wahl-Ort (waehle benutzen)');
  const k = einfrieren(kontext);
  const elemente = [];
  const aufraeumer = [];
  const laeuft = [];
  let anzahl = 0;
  for (const e of anbieterListe.get(ort) || []) {
    let r = null;
    try {
      r = e.fn(k);
    } catch (f) {
      meldeFehler(ort, e, f);
      continue;
    }
    if (r == null) continue;
    if (art === 'aufruf') {
      anzahl++;
      if (typeof r.verlasse === 'function') aufraeumer.push({ e, fn: () => r.verlasse() });
      if (r.fertig && typeof r.fertig.then === 'function') {
        laeuft.push(Promise.resolve(r.fertig).catch((f) => meldeFehler(ort, e, f)));
      }
      continue;
    }
    const el = istElement(r) ? r : (r && istElement(r.el) ? r.el : null);
    if (!el) {
      meldeFehler(ort, e, new TypeError('Anbieter liefert weder HTMLElement noch { el }'));
      continue;
    }
    try {
      if (!container || typeof container.appendChild !== 'function') throw new TypeError('kein Container');
      container.appendChild(el);
    } catch (f) {
      meldeFehler(ort, e, f);
      continue;
    }
    anzahl++;
    elemente.push(el);
    if (!istElement(r) && typeof r.verlasse === 'function') aufraeumer.push({ e, fn: () => r.verlasse() });
  }
  let offen = true;
  return {
    anzahl,
    wartend: laeuft.length,
    fertig: laeuft.length ? Promise.all(laeuft).then(() => undefined) : Promise.resolve(),
    verlasse() {
      if (!offen) return;
      offen = false;
      for (const a of aufraeumer) {
        try { a.fn(); } catch (f) { meldeFehler(ort, a.e, f); }
      }
      for (const el of elemente) {
        try { if (el.parentNode) el.parentNode.removeChild(el); } catch (f) { /* egal */ }
      }
    },
  };
}

export function waehle(ort, kontext) {
  const art = artVon(ort);
  if (art !== 'wahl') throw new Error('waehle: ' + ort + ' ist kein Wahl-Ort (fuelle benutzen)');
  const k = einfrieren(kontext);
  for (const e of anbieterListe.get(ort) || []) {
    try {
      const r = e.fn(k);
      if (r != null) return r;
    } catch (f) {
      meldeFehler(ort, e, f);
    }
  }
  return null;
}

export function angeboten(ort) {
  artVon(ort);
  return (anbieterListe.get(ort) || []).length;
}

export function zuruecksetzen() {
  anbieterListe = new Map();
  zaehler = 0;
}
