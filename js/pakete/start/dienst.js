// Paket "start" (Welle A, A4): Speicher, Raetsel-Quellen und Spielstart, gemeinsam fuer den Paket-Einstieg (index.js)
// und den Willkommens-Screen (js/ui/start.js). Beim Laden tut diese Datei nichts; erst starte() (aus index.js) meldet
// die zwei Raetsel-Quellen an und hoert app:screen (Rueckweg vergessen). Orte, Feier und Fahrplan haengt index.js ein.
//
//   starte()                             einmal aus index.js; danach gilt paketGeladen() (ohne den Einstieg, z. B. #start
//                                        von Hand ohne Paket, geht der Screen still zur Arena wie ein fehlender
//                                        Paket-Screen; so bleibt der Router-Test in app.test.mjs gueltig)
//   paketGeladen() -> boolean
//   QUELLE_REGELN 'start-regeln'         Regel-Hilfe: je Figur eine Mini-Aufgabe (aufgaben.js REGEL_AUFGABEN)
//   QUELLE_EINSTUFUNG 'start-einstufung' Einstufungstest: 8 Aufgaben (aufgaben.js EINSTUFUNG), am Ende die Empfehlung
//   stand() -> Modul "start" (logik.normalisiereModul, bei jedem Zugriff frisch gelesen)
//   sichere(modul) -> boolean   schreibt nie ein Modul einer neueren App (v hoeher als RECHENSTAND)
//   aendere(fn) -> boolean      fn(modul) -> neues Modul oder null (nichts zu tun)
//   einstellungen() -> { hinweise }, setzeEinstellungen(teil)   Paket-Einstellungen "start" (Hinweise "Neu fuer dich")
//   setzeRueck(seite) / nimmRueck() -> seite | null   welche Seite der Willkommens-Screen zeigt, wenn Flo aus dem
//     Raetsel-Bildschirm zurueckkommt (Zurueck oder "Fertig"); jeder andere Screen vergisst ihn
//   starteSpiel(app, { botId, probe }) -> Promise<boolean>   Partie mit Weiss; probe: Modus 'frei' (wertet nie). Ist eine
//     Partie offen, fragt es wie die Arena, ob sie verworfen werden soll
//   aktuelleEmpfehlung() -> { e, bot, leiter, probe, begruendung } | null   letzte Einstufung mit dem heutigen Stand der
//     Leiter (probe: der Bot ist noch nicht freigeschaltet)
//   ersterGegner() -> Bot   der erste Bot der Leiter (BOTS[0], heute Bauer Lukas; immer frei): Gegner nach der
//     Regel-Hilfe. Aus BOTS statt mit festem Namen, damit es nach einem Umbau der Leiter (Welten) weiter stimmt
// Texte ueber t('p-start.x') (texte.js), erst beim Zeichnen: Titel und Untertitel der Quellen sind Getter, die Aufgaben
// bekommen ihre Texte in liste() (Daten in aufgaben.js deutsch, angezeigt in der Sprache der App).
import {
  ladeModul, speichereModul, ladeModulEinstellungen, speichereModulEinstellungen, ladeFortschritt, hoechsteFreieStufe,
  naechsterGegner, ladeLaufendePartie, loescheLaufendePartie,
} from '../../storage.js';
import { BOTS, botNachId } from '../../bots.js';
import { tagSchluessel } from '../../tag.js';
import { hoere } from '../../ereignisse.js';
import { registriereRaetselQuelle } from '../../ui/raetsel.js';
import { t } from '../../sprache.js';
import * as L from './logik.js';
import { REGEL_AUFGABEN, EINSTUFUNG } from './aufgaben.js';
import './texte.js';
import { protokolliere } from '../../protokoll.js';

export const QUELLE_REGELN = 'start-regeln';
export const QUELLE_EINSTUFUNG = 'start-einstufung';
export const STANDARD_EINSTELLUNGEN = Object.freeze({ hinweise: true });

export function sicher(fn, wo) {
  try {
    return fn();
  } catch (e) {
    console.error('start: ' + wo, e);
    protokolliere('paket', e, { vorsatz: 'Paket start (' + (wo || 'unbekannt') + ')' });
    return null;
  }
}

export const heute = () => tagSchluessel();

// ---------- Modul-Speicher ----------
function roh() {
  return ladeModul(L.MODUL, L.leeresModul());
}
export function stand() {
  return L.normalisiereModul(roh());
}
let gewarnt = false;
function schreibbar() {
  const r = roh();
  if (r && Number.isInteger(r.v) && r.v > L.RECHENSTAND) {
    if (!gewarnt) { gewarnt = true; console.warn('start: Modul aus einer neueren App (Rechenstand hoeher als ' + L.RECHENSTAND + '), es bleibt unveraendert'); }
    return false;
  }
  return true;
}
export function sichere(m) {
  if (!m || !schreibbar()) return false;
  const r = speichereModul(L.MODUL, { ...m, v: L.RECHENSTAND });
  if (!r || !r.ok) { console.warn('start: Modul nicht gespeichert', r && r.grund); return false; }
  return true;
}
export function aendere(fn) {
  const neu = fn(stand());
  return neu ? sichere(neu) : false;
}

export function einstellungen() {
  const e = ladeModulEinstellungen(L.MODUL, STANDARD_EINSTELLUNGEN);
  return { hinweise: !(e && e.hinweise === false) };
}
export function setzeEinstellungen(teil) {
  return speichereModulEinstellungen(L.MODUL, { ...einstellungen(), ...teil });
}

export const ersterGegner = () => BOTS[0];

export function markiereGesehen() {
  return aendere((m) => (m.gesehen ? null : { ...m, gesehen: heute() }));
}

// ---------- Rueckweg aus dem Raetsel-Bildschirm ----------
let rueck = null;
export function setzeRueck(seite) { rueck = typeof seite === 'string' ? seite : null; }
export function nimmRueck() { const r = rueck; rueck = null; return r; }

// ---------- Spiel starten ----------
export async function starteSpiel(app, { botId, probe = false } = {}) {
  const bot = botNachId(botId);
  if (!bot || !app) return false;
  const laufend = ladeLaufendePartie();
  if (laufend) {
    const lb = botNachId(laufend.botId);
    const ok = await app.frage({
      titel: t('p-start.neu.titel'),
      text: t('p-start.neu.text', { name: lb ? lb.name : t('p-start.neu.einBot') }),
      knoepfe: [{ text: t('allgemein.abbrechen'), wert: false }, { text: t('p-start.neu.knopf'), wert: true, art: 'primaer' }],
      abbrechen: false,
    });
    if (!ok) return false;
    loescheLaufendePartie();
  }
  const params = { botId: bot.id, farbe: 'w' };
  if (probe) params.modus = 'frei';
  app.gehe('partie', params);
  return true;
}

// ---------- Empfehlung ----------
// Aufgabenergebnisse aus dem gespeicherten je ([[id, punkte]]) fuer logik.empfehlung
const ausJe = (je) => (je || []).map(([id, p]) => ({ id, richtig: p > 0, versuch: p === 1 ? 1 : 2 }));

export function aktuelleEmpfehlung() {
  const m = stand();
  if (!m.einstufung) return null;
  const f = ladeFortschritt();
  const frei = hoechsteFreieStufe(f);
  const e = { ...L.empfehlung({ ergebnisse: ausJe(m.einstufung.je), hoechsteFrei: frei }), botId: m.einstufung.botId };
  const bot = botNachId(e.botId);
  if (!bot) return null;
  e.stufe = bot.stufe;
  e.probe = bot.stufe > frei;
  return { e, bot, leiter: naechsterGegner(f), probe: e.probe, begruendung: L.begruendung(e, { botName: bot.name }), tag: m.einstufung.tag };
}

// ---------- Raetsel-Quellen ----------
// Texte der Aufgabe in der Sprache der App (texte.js 'aufgabe.<id>.<feld>', de = die Daten aus aufgaben.js)
const TEXT_FELDER = ['titel', 'text', 'hinweis', 'erklaerung', 'marke'];
const kopie = (a) => {
  const k = { ...a, loesung: [...a.loesung] };
  for (const f of TEXT_FELDER) if (typeof a[f] === 'string') k[f] = t(`p-start.aufgabe.${a.id}.${f}`);
  return k;
};

function regelQuelle() {
  return {
    get titel() { return t('p-start.regeln.titel'); },
    get unter() { return t('p-start.regeln.unter'); },
    liste() { return REGEL_AUFGABEN.map(kopie); },
    ergebnis() { return null; },
    ende(z) {
      sicher(() => aendere((m) => ({ ...m, regeln: { tag: heute(), geloest: z.geloest, gesamt: z.gesamt } })), 'Regeln speichern');
      setzeRueck('nach-regeln');
      const erster = ersterGegner();
      return {
        titel: z.geloest === z.gesamt ? t('p-start.regeln.alle') : t('p-start.regeln.gesehen'),
        text: t('p-start.regeln.text'),
        klang: 'stern',
        knoepfe: [{ text: t('p-start.spielen', { name: erster.name }), art: 'primaer', beiKlick: (app) => { starteSpiel(app, { botId: erster.id }); } }],
      };
    },
  };
}

function einstufungQuelle() {
  return {
    get titel() { return t('p-start.einstufung.titel'); },
    get unter() { return t('p-start.einstufung.unter'); },
    liste() { return EINSTUFUNG.map(kopie); },
    ergebnis() { return null; },
    ende(z) {
      const f = ladeFortschritt();
      const e = L.empfehlung({ ergebnisse: z.ergebnisse, hoechsteFrei: hoechsteFreieStufe(f) });
      sicher(() => aendere((m) => ({
        ...m,
        einstufung: {
          tag: heute(), rechenstand: L.RECHENSTAND, punkte: e.punkte, geloest: e.geloest, ersterVersuch: e.ersterVersuch,
          gesamt: e.gesamt, je: e.je, botId: e.botId,
        },
      })), 'Einstufung speichern');
      setzeRueck('empfehlung');
      const bot = botNachId(e.botId);
      const leiter = naechsterGegner(f);
      const b = L.begruendung(e, { botName: bot.name });
      const knoepfe = e.probe
        ? [
          { text: t('p-start.einstufung.probe', { name: bot.name }), art: 'primaer', beiKlick: (app) => { starteSpiel(app, { botId: bot.id, probe: true }); } },
          { text: t('p-start.einstufung.leiter', { name: leiter.name }), beiKlick: (app) => { starteSpiel(app, { botId: leiter.id }); } },
        ]
        : [{ text: t('p-start.spielen', { name: bot.name }), art: 'primaer', beiKlick: (app) => { starteSpiel(app, { botId: bot.id }); } }];
      return {
        titel: t('p-start.einstufung.ende', { name: bot.name }),
        text: b.kurz + (e.probe ? ' ' + t('p-start.einstufung.probeText') : ''),
        klang: 'stern',
        knoepfe,
      };
    },
  };
}

// ---------- Start (aus index.js) ----------
let geladen = false;
export const paketGeladen = () => geladen;
export function starte() {
  if (geladen) return;
  geladen = true;
  sicher(() => {
    registriereRaetselQuelle(QUELLE_REGELN, regelQuelle());
    registriereRaetselQuelle(QUELLE_EINSTUFUNG, einstufungQuelle());
  }, 'Raetsel-Quellen');
  sicher(() => hoere('app:screen', (d) => { if (!d || (d.name !== 'raetsel' && d.name !== 'start')) rueck = null; }), 'app:screen');
}
