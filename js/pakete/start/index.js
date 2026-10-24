// Paket "start" (Welle A, A4): Willkommen, die ersten 5 Minuten, Einstufungstest (SPIELKONZEPT 3.16, 3.12).
// - Willkommen: beim allerersten Start (keine Partie gespielt, keine offen, noch nie gezeigt) waehlt das Paket am
//   Wahl-Ort app:erster-screen? den Paket-Screen "start" (js/ui/start.js): drei kurze Seiten, ueberspringbar, dann
//   "Kennst du die Schachregeln?" -> Regel-Hilfe (Raetsel-Bildschirm, je Figur eine Aufgabe) oder Einstufung.
// - Einstufung: 8 Aufgaben im Raetsel-Bildschirm (js/ui/raetsel.js, Quelle start-einstufung), danach die Empfehlung mit
//   Begruendung. Steht der empfohlene Bot ueber der Leiter, gibt es ihn nur als Probepartie (Modus 'frei', wertet nie).
// - Entdeckungs-Fahrplan: hoechstens ein Hinweis "Neu fuer dich" je Tag in der Heute-Karte, abschaltbar.
// - Erster Sieg: die Feier-Zeile "Dein erster Sieg" (Quelle erster-sieg, gross) beim ersten wertenden Sieg ueberhaupt.
//
// Orte:       app:erster-screen? (Reihenfolge 80, logik.WAHL_REIHENFOLGE: andere Pakete mit eigener Wahl gehen vor),
//             arena:heute (70, Zeile .st-neu: Knopf .st-neu-los "Neu fuer dich: ..." fuehrt hin, .st-neu-weg blendet aus),
//             einstellungen:gruppen (90, Gruppe "Erste Schritte": Schalter fuer die Hinweise, Stand der Einstufung,
//             Willkommen, Regel-Hilfe)
// Ereignisse: hoert app:bereit (Fahrplan beginnt, per setTimeout), app:screen (besuchte Screens: kein Hinweis mehr dafuer),
//             partie:beendet (letzte Partie fuer den Hinweis zur Analyse; erster Sieg synchron vor den Feier-Zeilen des
//             Overlays), training:stand (Stand des Trainings, z. B. der Kartei: der Hinweis "Das Training" kommt erst, wenn
//             dort Karten liegen, nie fuer einen leeren Stapel). Sendet nichts.
// Heute-Karte: die Zeile "Neu fuer dich" tritt zurueck, solange dort eine Zeile eines anderen Pakets steht
//             (css/pakete/start.css, .heute-karte .st-neu:not(:only-child)): Spielen-Knopf auf dem iPad quer im Bild.
// Register:   Raetsel-Quellen start-regeln und start-einstufung (dienst.js), Icon "neu-siegel".
// Speicher:   Modul "start" (Budget 6.000, logik.js), Paket-Einstellungen "start" { hinweise: true }.
// Test:       zustand() -> { modul, einstellungen, hinweis, training }   hinweis: der Hinweis des Tages (auch wenn die Zeile
//             gerade zuruecktritt), training: letzter training:stand
// Texte:      t('p-start.x') aus texte.js (Englische Version, Teil 2), erst beim Zeichnen.
// Ein Fehler im Paket stoppt nie die App: jeder Anbieter liefert im Zweifel null.
import { anbieten, angeboten } from '../../orte.js';
import { hoere } from '../../ereignisse.js';
import { melde } from '../../feier.js';
import { ladePartien, ladeLaufendePartie, ladeFortschritt, hatReview } from '../../storage.js';
import { BOTS, botNachId } from '../../bots.js';
import { icon, registriereIcon } from '../../ui/icons.js';
import { schalter } from '../../ui/bauteile.js';
import { anim, tempo } from '../../bewegung.js';
import { t } from '../../sprache.js';
import * as D from './dienst.js';
import * as L from './logik.js';
import './texte.js';

const sicher = D.sicher;
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let letzterHinweis = null;
// letzter Stand des Trainings (Ereignis training:stand { faellig, gesamt, gemeistert }), null: niemand hat gemeldet
let trainingStand = null;
const trainingHatKarten = () => !!(trainingStand && Number(trainingStand.gesamt) > 0);

export function zustand() {
  return { modul: D.stand(), einstellungen: D.einstellungen(), hinweis: letzterHinweis, training: trainingStand ? { ...trainingStand } : null };
}

const partienAus = (fortschritt) => {
  let n = 0;
  const f = fortschritt && fortschritt.bots ? fortschritt : ladeFortschritt();
  for (const b of BOTS) { const x = f.bots[b.id]; if (x && Number.isFinite(x.partien)) n += x.partien; }
  return n;
};

// ---------- Heute-Karte: "Neu fuer dich" ----------
function ziel(app, id) {
  const m = D.stand();
  if (id === 'analyse') {
    if (m.letzte && hatReview(m.letzte)) app.gehe('analyse', { partieId: m.letzte });
    else app.gehe('verlauf');
  } else if (id === 'einstufung') app.gehe('start', { seite: 'einstufung' });
  else if (id === 'training') app.gehe('training');
  else if (id === 'einstellungen') app.gehe('einstellungen');
  else if (id === 'verlauf') app.gehe('verlauf');
}

function neuZeile(k) {
  if (!k || !k.app || !D.einstellungen().hinweise) return null;
  const m = D.stand();
  // Partien: wertende aus dem Fortschritt; eine Probepartie zaehlt dort nicht, aber sie ist die letzte Partie
  const partien = Math.max(partienAus(k.fortschritt), m.letzte ? 1 : 0);
  const r = L.hinweisHeute(m, {
    tag: typeof k.tag === 'string' ? k.tag : D.heute(), an: true, partien,
    training: angeboten('training:karten') > 0 && trainingHatKarten(), einstufungFertig: !!m.einstufung,
  });
  if (JSON.stringify(r.modul.fahrplan.heute) !== JSON.stringify(m.fahrplan.heute)) D.sichere(r.modul);
  letzterHinweis = r.id;
  const e = L.entdeckung(r.id);
  if (!e) return null;
  const el = document.createElement('div');
  el.className = 'st-neu';
  el.dataset.paket = L.PAKET;
  el.dataset.entdeckung = e.id;
  // die ganze Zeile fuehrt hin (SPIELKONZEPT 3.16 "Antippen fuehrt hin"), daneben nur das Kreuz zum Ausblenden
  el.innerHTML = `<button class="st-neu-los dr" type="button"><span class="st-neu-siegel" aria-hidden="true">${icon('neu-siegel')}</span>
    <span class="st-neu-text"><span class="st-neu-kopf"><b>${esc(t('p-start.neu.kopf'))}</b> <span class="st-neu-titel"></span></span> <small></small></span>
    <span class="st-neu-pfeil" aria-hidden="true">${icon('vor')}</span></button>
    <button class="icon-knopf dr st-neu-weg" type="button" aria-label="${esc(t('p-start.neu.weg'))}">${icon('kreuz')}</button>`;
  el.querySelector('.st-neu-titel').textContent = e.titel;
  el.querySelector('small').textContent = e.text;
  const erledigt = () => D.aendere((x) => L.erledige(x, e.id));
  el.querySelector('.st-neu-los').addEventListener('click', (ev) => {
    ev.stopPropagation();
    sicher(() => { erledigt(); ziel(k.app, e.id); }, 'Hinweis');
  });
  el.querySelector('.st-neu-weg').addEventListener('click', (ev) => {
    ev.stopPropagation();
    sicher(() => {
      erledigt();
      const weg = () => {
        const ort = el.parentNode;
        el.remove();
        // war es die einzige Zeile der Heute-Karte, verschwindet die Karte wie ohne Zeilen
        const karte = ort && !ort.children.length && ort.closest ? ort.closest('.heute-karte') : null;
        if (karte) karte.hidden = true;
      };
      if (tempo() > 0) anim(el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(18px)' }], { d: 200, k: 'raus', fill: 'forwards' }).finished.then(weg, weg);
      else weg();
    }, 'Ausblenden');
  });
  return el;
}

// ---------- Einstellungen: Gruppe "Erste Schritte" ----------
const tagText = (tag) => (typeof tag === 'string' && tag.length === 10 ? t('p-start.tag', { tag: tag.slice(8, 10), monat: tag.slice(5, 7) }) : '');

function gruppe(app) {
  const el = document.createElement('section');
  el.className = 'es-gruppe flaeche st-gruppe';
  el.dataset.paket = L.PAKET;
  el.setAttribute('aria-labelledby', 'st-g-titel');
  el.innerHTML = `<h3 class="es-titel" id="st-g-titel">${esc(t('p-start.gruppe.titel'))}</h3>
    <div class="st-g-zeile st-g-hinweise"><div class="st-g-text"><b id="st-g-hinweise">${esc(t('p-start.gruppe.neu'))}</b>
      <span>${esc(t('p-start.gruppe.neuText'))}</span></div></div>
    <div class="st-g-zeile st-g-einstufung"><div class="st-g-text"><b>${esc(t('p-start.gruppe.einstufung'))}</b><span class="st-g-stand"></span></div>
      <button class="knopf dr st-g-einstufen" type="button"></button></div>
    <div class="st-g-knoepfe"><button class="knopf dr st-g-willkommen" type="button">${esc(t('p-start.gruppe.willkommen'))}</button>
      <button class="knopf dr st-g-regeln" type="button">${esc(t('p-start.gruppe.regeln'))}</button></div>`;
  const s = schalter({ name: 'start-hinweise', an: D.einstellungen().hinweise, label: t('p-start.gruppe.neu'),
    beiWechsel: (an) => sicher(() => D.setzeEinstellungen({ hinweise: !!an }), 'Einstellung') });
  s.el.setAttribute('aria-labelledby', 'st-g-hinweise');
  el.querySelector('.st-g-hinweise').append(s.el);
  const em = sicher(() => D.aktuelleEmpfehlung(), 'Empfehlung');
  el.querySelector('.st-g-stand').textContent = em
    ? t('p-start.gruppe.stand', { tag: tagText(em.tag), geloest: em.e.geloest, gesamt: em.e.gesamt, name: em.bot.name })
    : t('p-start.gruppe.standLeer');
  const k = el.querySelector('.st-g-einstufen');
  k.textContent = em ? t('p-start.gruppe.zurEmpfehlung') : t('p-start.gruppe.einstufen');
  k.addEventListener('click', () => sicher(() => app.gehe('start', { seite: em ? 'empfehlung' : 'einstufung' }), 'Einstufung'));
  el.querySelector('.st-g-willkommen').addEventListener('click', () => sicher(() => app.gehe('start', { seite: 'w1' }), 'Willkommen'));
  el.querySelector('.st-g-regeln').addEventListener('click', () => sicher(() => app.gehe('raetsel', { quelle: D.QUELLE_REGELN }), 'Regeln'));
  return el;
}

// ---------- Einhaengen (defensiv) ----------
function ladeCss() {
  try {
    if (typeof document === 'undefined' || document.querySelector('link[data-paket="start"]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = new URL('../../../css/pakete/start.css', import.meta.url).href;
    l.dataset.paket = L.PAKET;
    document.head.append(l);
  } catch (e) { /* ohne eigenes CSS bleibt alles bedienbar */ }
}

function registriere() {
  // zuerst: Raetsel-Quellen und Rueckweg (dienst.js); ab hier gehoert der Screen "start" einem geladenen Paket
  D.starte();
  ladeCss();
  // kleines Papier-Siegel (gezackter Rand mit Haken) fuer "Neu fuer dich"
  registriereIcon('neu-siegel', '<path d="M12 2.8l2.1 1.5 2.5-.2.9 2.4 2.4.9-.2 2.5 1.5 2.1-1.5 2.1.2 2.5-2.4.9-.9 2.4-2.5-.2L12 21.2l-2.1-1.5-2.5.2-.9-2.4-2.4-.9.2-2.5L2.8 12l1.5-2.1-.2-2.5 2.4-.9.9-2.4 2.5.2z"/><path d="M8.8 12.3l2.2 2.1 4.2-4.6"/>');

  // Partien wie beim Fahrplan: Partienliste (aus app.js) oder wertend im Fortschritt, das Groessere zaehlt (ein Spielstand
  // mit Fortschritt, aber ohne Partienliste, z. B. nur teilweise wiederhergestellt, ist kein allererster Start)
  anbieten('app:erster-screen?', (k) => sicher(() => L.ersterScreenWahl(D.stand(), {
    partienZahl: Math.max(k && Number.isFinite(k.partienZahl) ? k.partienZahl : 1, partienAus(null)), laufend: !!ladeLaufendePartie(),
  }), 'Erster Screen'), { reihenfolge: L.WAHL_REIHENFOLGE, paket: L.PAKET });
  anbieten('arena:heute', (k) => sicher(() => neuZeile(k), 'Heute'), { reihenfolge: 70, paket: L.PAKET });
  anbieten('einstellungen:gruppen', (k) => sicher(() => (k && k.app ? gruppe(k.app) : null), 'Einstellungen'), { reihenfolge: 90, paket: L.PAKET });

  // Fahrplan beginnt beim ersten Start mit dem Paket (ausserhalb des Hoerers: die Partienliste kann gross sein). Erfahren
  // ist, wer schon ERFAHREN_AB Partien hat: in der Partienliste oder (wertend) im Fortschritt, das Groessere zaehlt
  hoere('app:bereit', () => {
    setTimeout(() => sicher(() => {
      const m = D.stand();
      if (m.fahrplan.start) return;
      D.sichere(L.fahrplanStart(m, { tag: D.heute(), partien: Math.max(ladePartien().length, partienAus(null)) }));
    }, 'Fahrplan'), 0);
  });
  hoere('training:stand', (d) => sicher(() => {
    trainingStand = d && typeof d === 'object' ? { faellig: Number(d.faellig) || 0, gesamt: Number(d.gesamt) || 0 } : null;
  }, 'training:stand'));
  hoere('app:screen', (d) => sicher(() => {
    if (!d || typeof d.name !== 'string') return;
    const m = D.stand();
    const r = L.merkeBenutzt(m, d.name);
    if (r.neu) D.sichere(r.modul);
  }, 'app:screen'));
  // synchron: partie:beendet kommt vor den Feier-Zeilen des Overlays
  hoere('partie:beendet', (d) => sicher(() => {
    if (!d) return;
    const m = D.stand();
    let neu = null;
    if (typeof d.partieId === 'string' && d.partieId && d.partieId !== m.letzte) neu = { ...m, letzte: d.partieId };
    if (!m.ersterSieg && L.istErsterSieg({ ergebnis: d.ergebnis, wertet: d.wertet, fortschritt: ladeFortschritt() })) {
      const bot = botNachId(d.botId);
      const n = Number.isInteger(d.eigeneZuege) ? d.eigeneZuege : 0;
      melde({
        partieId: d.partieId || null, quelle: 'erster-sieg', titel: t('p-start.sieg.titel'),
        text: bot ? (n ? t('p-start.sieg.zuege', { name: bot.name, n }) : t('p-start.sieg.gegen', { name: bot.name })) : undefined,
        symbol: 'pokal', klang: 'rekord',
      });
      neu = { ...(neu || m), ersterSieg: d.partieId || 'ja' };
    }
    if (neu) D.sichere(neu);
  }, 'partie:beendet'));
}

sicher(registriere, 'Laden');
