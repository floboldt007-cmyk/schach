// Paket "kartei" (Welle A, A3): Deine Fehler werden dein Training.
// - Karten entstehen aus jeder Partie mit Spielanalyse (Ereignis partie:analysiert, auch beim Nachholen und im
//   Analyse-Screen; Uebungen nie): eigene Zuege "Weit daneben", "Verschenkt" und "Daneben" mit eindeutiger Loesung,
//   hoechstens 3 je Partie, die schwersten zuerst (Regeln in logik.js). Beim Start werden gespeicherte Analysen
//   einmal je Sitzung nachgetragen (Partien, die vor dem Paket analysiert wurden).
// - Wiederholung nach 1, 3, 7, 14, 30 Tagen (Tagesschluessel aus tag.js, Grenze 4:00), dann "für immer gelöst";
//   hoechstens 10 Karten am Tag, der Rest bleibt still faellig.
// - Ueben im Raetsel-Bildschirm (js/ui/raetsel.js, Quelle "kartei"): app.gehe('raetsel', { quelle: 'kartei' }).
//
// Orte:       training:karten (10, Karte "Fehler wiederholen · 5 fällig" mit Stapel, sonst "Stapel leer" bzw. ein
//             freundlicher Leer-Zustand), arena:heute (25, Zeile nur wenn Karten faellig sind)
// Ereignisse: hoert partie:analysiert (Karten, Feier-Zeile "2 neue Karten in deinem Stapel", Quelle karten, Zeile
//             Prio 30), app:bereit (training:stand, Nachtrag), speicher:zurueckgesetzt (training:stand);
//             sendet training:geloest { karteId, richtig, versuch, quelle: 'kartei' } je Karte und training:stand
//             { faellig, gesamt, gemeistert } beim Start und nach jeder Aenderung.
// Register:   Raetsel-Quelle "kartei" (js/ui/raetsel.js), Icon "kartei".
// Speicher:   Modul "kartei" (Budget 160.000, logik.js), bei jedem Zugriff frisch gelesen; ein Modul aus einer
//             neueren App (v > RECHENSTAND) wird gelesen, aber nie ueberschrieben.
// Test:       zustand() -> { modul, stand, letzte }
// Ein Fehler im Paket stoppt nie die App: jeder Anbieter liefert im Zweifel null.
import { anbieten } from '../../orte.js';
import { hoere, sende } from '../../ereignisse.js';
import { melde } from '../../feier.js';
import { ladeModul, speichereModul, ladePartien, hatReview, ladeReview } from '../../storage.js';
import { botNachId } from '../../bots.js';
import { icon, registriereIcon } from '../../ui/icons.js';
import { miniBrett } from '../../ui/bauteile.js';
import { tagSchluessel, tageZwischen, wochentag } from '../../tag.js';
import { registriereRaetselQuelle } from '../../ui/raetsel.js';
import * as L from './logik.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// wochentag() aus tag.js: 0 = Montag
const WOCHENTAG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const NACHTRAG_MS = 2500;

function sicher(fn, wo) {
  try {
    return fn();
  } catch (e) {
    console.error('kartei: ' + wo, e);
    return null;
  }
}

// ---------- Modul-Speicher ----------
function roh() {
  return ladeModul(L.MODUL, L.leeresModul());
}
function stand() {
  return L.normalisiereModul(roh());
}
// Neuere App (hoeherer Rechenstand): lesen ja, schreiben nie (sonst gingen ihre Felder verloren)
function schreibbar() {
  const r = roh();
  return !(r && Number.isInteger(r.v) && r.v > L.RECHENSTAND);
}
function sichere(m) {
  if (!schreibbar()) return false;
  let r = speichereModul(L.MODUL, { ...m, v: L.RECHENSTAND });
  if (r && r.grund === 'budget') r = speichereModul(L.MODUL, { ...L.duenneAus(m, Math.floor(L.BUDGET * 0.9)), v: L.RECHENSTAND });
  if (!r || !r.ok) { console.warn('kartei: Modul nicht gespeichert', r && r.grund); return false; }
  return true;
}

const heute = () => tagSchluessel();
let letzte = null;
export function zustand() {
  const m = stand();
  return { modul: JSON.parse(JSON.stringify(m)), stand: L.stand(m, heute()), letzte: letzte ? { ...letzte } : null };
}

function sendeStand(m = stand()) {
  sicher(() => sende('training:stand', L.stand(m, heute())), 'training:stand');
}

// ---------- Karten aus der Spielanalyse ----------
function verarbeite(partie, review, { feier = true } = {}) {
  if (!partie || !review || (partie.modus || 'normal') === 'uebung') return null;
  const tag = heute();
  const m = stand();
  const r = L.fuegeHinzu(m, partie, review, tag, { tagVon: (ms) => tagSchluessel(ms) });
  if (r.doppelt) return r;
  letzte = { partieId: partie.id, neu: r.neu.slice(), rueckfall: r.rueckfall.slice() };
  const anzahl = r.neu.length + r.rueckfall.length;
  // Feier-Zeile synchron, damit sie noch im Ergebnis erscheint (partie.js fuellt das Overlay gleich danach)
  if (feier && anzahl) {
    sicher(() => melde({ partieId: partie.id, quelle: 'karten', titel: L.neueKartenText(anzahl), symbol: 'kartei' }), 'Feier');
  }
  // Schreiben in einer eigenen Aufgabe (Hoerer bleiben kurz); vorher frisch lesen, falls inzwischen geuebt wurde
  setTimeout(() => sicher(() => {
    const neu = L.fuegeHinzu(stand(), partie, review, heute(), { tagVon: (ms) => tagSchluessel(ms) });
    if (!neu.doppelt) sichere(neu.modul);
    sendeStand();
  }, 'Speichern'), 0);
  return r;
}

// Einmal je Sitzung: Partien, deren Analyse schon gespeichert ist (z. B. vor dem Paket), nachtragen
let nachgetragen = false;
function nachtragen() {
  if (nachgetragen) return;
  nachgetragen = true;
  const m = stand();
  const offen = sicher(() => ladePartien().filter((p) => p && p.analysiert && (p.modus || 'normal') !== 'uebung'
    && !m.verarbeitet.includes(p.id) && hatReview(p.id)), 'Nachtrag') || [];
  let i = 0;
  const schritt = () => {
    if (i >= offen.length) return;
    const p = offen[i++];
    sicher(() => {
      const review = ladeReview(p.id);
      if (!review) return;
      const neu = L.fuegeHinzu(stand(), p, review, heute(), { tagVon: (ms) => tagSchluessel(ms) });
      if (!neu.doppelt && sichere(neu.modul)) sendeStand(neu.modul);
    }, 'Nachtrag');
    setTimeout(schritt, 0);
  };
  setTimeout(schritt, 0);
}

// ---------- Raetsel-Quelle ----------
function botName(id) {
  const b = sicher(() => botNachId(id), 'Bot');
  return b && b.name ? b.name : '';
}

function quelle() {
  // Antworten dieser Sitzung (fuer die Zusammenfassung); je Oeffnen neu
  let sitzung = [];
  return {
    titel: 'Fehler wiederholen',
    unter: 'Fehler-Kartei',
    liste() {
      sitzung = [];
      const tag = heute();
      return L.faellige(stand(), tag).map((k) => L.alsAufgabe(k, { botName: botName(k.botId), heute: tag })).filter(Boolean);
    },
    ergebnis(aufgabe, erg) {
      const tag = heute();
      const richtig = !!erg.richtig;
      const versuch = Number.isInteger(erg.versuch) ? erg.versuch : 0;
      const r = L.beantworte(stand(), aufgabe.id, { richtig, versuch, heute: tag });
      if (!r) return null;
      sichere(r.modul);
      sitzung.push({ id: aufgabe.id, info: r.info });
      sicher(() => sende('training:geloest', { karteId: aufgabe.id, richtig, versuch, quelle: 'kartei' }), 'training:geloest');
      sendeStand(r.modul);
      const t = L.rueckmeldung(r.info);
      return { titel: t.titel, text: t.text, klang: r.info.gemeistert ? 'stern' : undefined };
    },
    ende() {
      const t = L.endeText(sitzung);
      return { titel: t.titel, text: t.text };
    },
    leer() {
      const m = stand();
      const st = L.stand(m, heute());
      return st.gesamt
        ? { titel: 'Stapel leer. Gut gemacht.', text: naechsteText(m) }
        : { titel: 'Noch keine Karten', text: 'Nach jeder analysierten Partie werden bis zu drei deiner Fehler hier zu Karten.' };
    },
  };
}

function naechsteText(m) {
  const tag = heute();
  const n = L.naechsterTag(m, tag);
  if (!n || n === tag) return '';
  const tage = tageZwischen(tag, n);
  if (tage === 1) return 'Die nächste Karte kommt morgen.';
  if (tage > 1 && tage < 7) return `Die nächste Karte kommt am ${WOCHENTAG[wochentag(n)]}.`;
  return tage > 1 ? `Die nächste Karte kommt in ${tage} Tagen.` : '';
}

// ---------- Elemente ----------
function oeffne(app, ev) {
  if (ev) ev.stopPropagation();
  sicher(() => app.gehe('raetsel', { quelle: L.PAKET }), 'Öffnen');
}

function trainingKarte(app) {
  const m = stand();
  const tag = heute();
  const st = L.stand(m, tag);
  const el = document.createElement('section');
  el.className = 't-karte kt-karte';
  el.dataset.paket = L.PAKET;
  el.dataset.faellig = String(st.faellig);
  el.setAttribute('aria-label', 'Fehler-Kartei');
  const faellig = L.faellige(m, tag);
  if (st.faellig > 0) {
    const zeigen = faellig.slice(0, 4);
    el.innerHTML = `<span class="ueberzeile">Fehler-Kartei</span>
      <div class="kartei-stapel kt-stapel" data-anzahl="${zeigen.length}">${zeigen.map((k) => {
        const vor = k.vor ? [k.vor.slice(0, 2), k.vor.slice(2, 4)] : [];
        return `<div class="kk">${miniBrett(k.fen, { zuletzt: vor })}${k.san ? `<em>${esc(k.san)}</em>` : ''}</div>`;
      }).join('')}</div>
      <h2>Fehler wiederholen · ${st.faellig} fällig</h2>
      <p>Deine eigenen Fehler als Karten. Jede kommt wieder, bis sie sitzt.</p>
      <div class="t-fuss"><span class="kt-zahlen">${zahlenText(st)}</span>
        <button class="knopf dr kt-los" type="button">Üben${icon('vor')}</button></div>`;
    el.querySelector('.kt-los').addEventListener('click', (ev) => oeffne(app, ev));
  } else if (st.gesamt > 0) {
    el.classList.add('kt-ruhig');
    el.innerHTML = `<span class="ueberzeile">Fehler-Kartei</span>
      <span class="kt-symbol" aria-hidden="true">${icon('haken')}</span>
      <h2>Stapel leer. Gut gemacht.</h2>
      <p>${esc(naechsteText(m) || 'Für heute ist alles geübt.')}</p>
      <div class="t-fuss"><span class="kt-zahlen">${zahlenText(st)}</span></div>`;
  } else {
    el.classList.add('kt-ruhig', 'kt-leer');
    el.innerHTML = `<span class="ueberzeile">Fehler-Kartei</span>
      <span class="kt-symbol" aria-hidden="true">${icon('kartei')}</span>
      <h2>Noch keine Karten</h2>
      <p>Nach jeder analysierten Partie werden bis zu drei deiner Fehler hier zu Karten. Sie kommen wieder, bis sie sitzen.</p>`;
  }
  return el;
}

function zahlenText(st) {
  const teile = [`${st.gesamt} im Training`];
  if (st.gemeistert) teile.push(`${st.gemeistert} für immer gelöst`);
  return esc(teile.join(' · '));
}

function heuteZeile(app, tag) {
  const st = L.stand(stand(), tag);
  if (!st.faellig) return null;
  const el = document.createElement('div');
  el.className = 'kt-heute';
  el.dataset.paket = L.PAKET;
  el.innerHTML = `<span class="kt-heute-symbol" aria-hidden="true">${icon('kartei')}</span>
    <span class="kt-heute-text"><b>Fehler wiederholen</b> · ${st.faellig} fällig</span>
    <button class="knopf dr kt-heute-los" type="button">Üben</button>`;
  el.querySelector('.kt-heute-los').addEventListener('click', (ev) => oeffne(app, ev));
  return el;
}

// ---------- Einhaengen (defensiv) ----------
function ladeCss() {
  try {
    if (typeof document === 'undefined' || document.querySelector('link[data-paket="kartei"]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL('../../../css/pakete/kartei.css', import.meta.url).href;
    l.dataset.paket = L.PAKET;
    document.head.append(l);
  } catch (e) { /* ohne eigenes CSS bleibt alles lesbar */ }
}

function registriere() {
  ladeCss();
  // drei gefaecherte Karten
  registriereIcon('kartei', '<rect x="7.5" y="4.5" width="11" height="15" rx="2.2"/><path d="M5.5 7.2 4.3 18a2 2 0 0 0 1.8 2.2l7.6.8"/><path d="M10.5 9.5h5M10.5 13h3.5"/>');
  registriereRaetselQuelle(L.PAKET, quelle());

  anbieten('training:karten', (k) => sicher(() => (k && k.app ? trainingKarte(k.app) : null), 'Training'), { reihenfolge: 10, paket: L.PAKET });
  anbieten('arena:heute', (k) => sicher(() => (k && k.app ? heuteZeile(k.app, typeof k.tag === 'string' ? k.tag : heute()) : null), 'Heute'),
    { reihenfolge: 25, paket: L.PAKET });

  hoere('partie:analysiert', (d) => sicher(() => {
    if (!d || !d.partie || !d.review) return;
    verarbeite({ ...d.partie, id: d.partieId || d.partie.id, modus: d.modus || d.partie.modus }, d.review);
  }, 'partie:analysiert'));
  hoere('app:bereit', () => {
    sendeStand();
    setTimeout(() => sicher(nachtragen, 'Nachtrag'), NACHTRAG_MS);
  });
  hoere('speicher:zurueckgesetzt', () => { letzte = null; sendeStand(); });
}

sicher(registriere, 'Laden');
