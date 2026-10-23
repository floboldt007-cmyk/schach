// Paket "start" (Welle A, A4): Speicher, Raetsel-Quellen und Spielstart, gemeinsam fuer den Paket-Einstieg (index.js)
// und den Willkommens-Screen (js/ui/start.js). Beim Laden meldet diese Datei nur die zwei Raetsel-Quellen an und hoert
// app:screen (Rueckweg vergessen); Orte, Feier und Fahrplan haengt erst index.js ein.
//
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
import {
  ladeModul, speichereModul, ladeModulEinstellungen, speichereModulEinstellungen, ladeFortschritt, hoechsteFreieStufe,
  naechsterGegner, ladeLaufendePartie, loescheLaufendePartie,
} from '../../storage.js';
import { botNachId } from '../../bots.js';
import { tagSchluessel } from '../../tag.js';
import { hoere } from '../../ereignisse.js';
import { registriereRaetselQuelle } from '../../ui/raetsel.js';
import * as L from './logik.js';
import { REGEL_AUFGABEN, EINSTUFUNG } from './aufgaben.js';

export const QUELLE_REGELN = 'start-regeln';
export const QUELLE_EINSTUFUNG = 'start-einstufung';
export const STANDARD_EINSTELLUNGEN = Object.freeze({ hinweise: true });

export function sicher(fn, wo) {
  try {
    return fn();
  } catch (e) {
    console.error('start: ' + wo, e);
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

export function markiereGesehen() {
  return aendere((m) => (m.gesehen ? null : { ...m, gesehen: heute() }));
}

// ---------- Rueckweg aus dem Raetsel-Bildschirm ----------
let rueck = null;
export function setzeRueck(seite) { rueck = typeof seite === 'string' ? seite : null; }
export function nimmRueck() { const r = rueck; rueck = null; return r; }
hoere('app:screen', (d) => { if (!d || (d.name !== 'raetsel' && d.name !== 'start')) rueck = null; });

// ---------- Spiel starten ----------
export async function starteSpiel(app, { botId, probe = false } = {}) {
  const bot = botNachId(botId);
  if (!bot || !app) return false;
  const laufend = ladeLaufendePartie();
  if (laufend) {
    const lb = botNachId(laufend.botId);
    const ok = await app.frage({
      titel: 'Neue Partie starten?',
      text: `Du hast noch eine offene Partie gegen ${lb ? lb.name : 'einen Bot'}. Sie wird verworfen.`,
      knoepfe: [{ text: 'Abbrechen', wert: false }, { text: 'Neue Partie', wert: true, art: 'primaer' }],
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
const kopie = (a) => ({ ...a, loesung: [...a.loesung] });

function regelQuelle() {
  return {
    titel: 'Die Figuren',
    unter: 'Regel-Hilfe',
    liste() { return REGEL_AUFGABEN.map(kopie); },
    ergebnis() { return null; },
    ende(z) {
      sicher(() => aendere((m) => ({ ...m, regeln: { tag: heute(), geloest: z.geloest, gesamt: z.gesamt } })), 'Regeln speichern');
      setzeRueck('nach-regeln');
      return {
        titel: z.geloest === z.gesamt ? 'Du kennst alle Figuren' : 'Alle Figuren gesehen',
        text: 'Dazu kommen ein paar Sonderzüge wie die Rochade. Im Spiel zeigen dir die Punkte jeden erlaubten Zug: Tippe einfach eine Figur an.',
        klang: 'stern',
        knoepfe: [{ text: 'Gegen Bauer Benno spielen', art: 'primaer', beiKlick: (app) => { starteSpiel(app, { botId: 'benno' }); } }],
      };
    },
  };
}

function einstufungQuelle() {
  return {
    titel: 'Einstufung',
    unter: '8 Aufgaben, wertet nichts',
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
          { text: `Probepartie gegen ${bot.name}`, art: 'primaer', beiKlick: (app) => { starteSpiel(app, { botId: bot.id, probe: true }); } },
          { text: `Leiter: ${leiter.name}`, beiKlick: (app) => { starteSpiel(app, { botId: leiter.id }); } },
        ]
        : [{ text: `Gegen ${bot.name} spielen`, art: 'primaer', beiKlick: (app) => { starteSpiel(app, { botId: bot.id }); } }];
      return {
        titel: `Starte gegen ${bot.name}`,
        text: b.kurz + (e.probe ? ' Die Probepartie wertet nicht: keine Sterne, keine Freischaltung.' : ''),
        klang: 'stern',
        knoepfe,
      };
    },
  };
}

sicher(() => {
  registriereRaetselQuelle(QUELLE_REGELN, regelQuelle());
  registriereRaetselQuelle(QUELLE_EINSTUFUNG, einstufungQuelle());
}, 'Raetsel-Quellen');
