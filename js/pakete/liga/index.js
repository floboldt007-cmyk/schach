// P4: Anbindung ausschliesslich ueber Ereignisse, Orte, Feier- und Icon-Register, Modul-Speicher.
// Keine Engine-Arbeit, kein Zugriff auf fremde Screen-Elemente. Fehler bleiben im Paket.
import { hoere, sende } from '../../ereignisse.js';
import { anbieten } from '../../orte.js';
import { BOTS, botNachId } from '../../bots.js';
import { ladeModul, speichereModul, ladePartie, wertet, MODUL_BUDGET, eigeneZuege, BESTWERT_MIN_ZUEGE } from '../../storage.js';
import { registriereIcon } from '../../ui/icons.js';
import './texte.js';
import {
  normalisiereStand, beendeSaisonLiga, buchePartie, bucheGenauigkeit, belegFuer, imBudget, STUFEN,
} from './wertung.js';
import { verlaufKarte, botBilanz, abrechnungsZeile } from './ansicht.js';
import { reiterGruppe, huelleGruppe } from './gruppe.js';
import { protokolliere } from '../../protokoll.js';

const MODUL = 'liga';
const laufend = new Map();
const LEITER = new Set(BOTS.map((b) => b.id));

function sicher(fn) {
  return (...args) => {
    try { return fn(...args); }
    catch (e) { console.error('Liga konnte nicht aktualisiert werden:', e); protokolliere('paket', e, { vorsatz: 'Paket liga' }); return null; }
  };
}

// Eine Liga (Flo 08.11.2026): es zaehlt nur die Kronen-Liga. Jeder gelesene Stand ist ein beendeter Saison-Stand
// (wertung.js beendeSaisonLiga); Wertung, Kurve, Belege und die Saison-Abzeichen im Archiv bleiben.
const lese = () => { const st = normalisiereStand(ladeModul(MODUL), new Date()); return st && beendeSaisonLiga(st); };

function geaendert(st, aufstieg = false) {
  // Empfaenger erhalten eigene Daten und koennen den gespeicherten Zustand nicht veraendern.
  const { wertung, klasse, saison } = JSON.parse(JSON.stringify(st));
  sende('liga:geaendert', { wertung, klasse, saison, stufe: STUFEN[saison.stufe].name, aufstieg });
}

function speichere(st) {
  const klein = imBudget(st, MODUL_BUDGET.liga);
  return speichereModul(MODUL, klein).ok;
}

// Migration im Browser: ein gespeicherter Stand ohne Merker saisonEnde wird einmal beendet und gespeichert (die laufende
// Saison kommt als Abzeichen ins Archiv). Ohne gespeicherten Stand entsteht nichts. Ein Stand aus einer neueren App
// (normalisiereStand null) bleibt unberuehrt.
function migriere() {
  const roh = ladeModul(MODUL);
  if (roh == null) return;
  const st = normalisiereStand(roh, new Date());
  if (!st || st.saisonEnde === true) return;
  const neu = beendeSaisonLiga(st);
  if (speichere(neu)) geaendert(neu);
}

// Keine Feier mehr: Liga-Punkte gibt es nicht, und die Spielklasse zeigt keinen Figurennamen mehr (Flo 08.11.2026)
function uebernehme(r) {
  if (!r.gebucht || !speichere(r.stand)) return;
  geaendert(r.stand, false);
}

// Etappe B Task 6: Start-Liga aus der lokalen Elo, sobald ein Konto da ist (ein eigenes Anmelde-Ereignis gibt es nicht).
// Ohne gewertete Partie bleibt js/kronen.js ungeladen; den Merker je Konto prueft setzeStartLiga.
function startLiga() {
  const st = lese();
  if (!st || !(st.wertung.n > 0)) return;
  import('../../kronen.js').then((k) => k.setzeStartLiga()).catch(() => {});
}

hoere('app:bereit', sicher(() => {
  laufend.clear();
  migriere();
  startLiga();
}));
hoere('app:sichtbar', sicher(({ sichtbar }) => { if (sichtbar) startLiga(); }));
hoere('partie:gestartet', sicher((d) => {
  laufend.set(d.laufId, { wertet: d.wertet === true, hinweise: d.hinweise || 0, beendet: false });
}));
hoere('hilfe:genutzt', sicher((d) => {
  const l = laufend.get(d.laufId);
  if (l && d.art === 'hinweis') l.hinweise++;
}));
hoere('partie:verlassen', sicher(({ laufId }) => { laufend.delete(laufId); }));
hoere('speicher:zurueckgesetzt', sicher(() => { laufend.clear(); }));

// Etappe B Task 5: Kronen beim Server melden, je Partie einmal je Sitzung (der Server zaehlt ohnehin nur einmal).
// Ein KI-Gegner aus der Gegnersuche meldet nur mit Beleg und nie als Bot-Leiter; ohne Konto oder offline still nichts.
// js/kronen.js kommt erst beim Melden dazu: das Paket zieht so Konto und Online nicht schon beim Laden mit.
const gemeldet = new Set();
function meldeKronen(p, bot) {
  if (gemeldet.has(p.id)) return;
  gemeldet.add(p.id);
  if (p.ki === true && !p.kiRef) return;
  import('../../kronen.js').then((k) => (p.ki === true
    ? k.meldeKiErgebnis({ kiRef: p.kiRef, ergebnis: p.ergebnis })
    : k.meldeBotErgebnis({ partieId: p.id, ergebnis: p.ergebnis, botElo: bot.elo }))).catch(() => {});
}

hoere('partie:beendet', sicher((d) => {
  const l = laufend.get(d.laufId);
  if (l) l.beendet = true;
  if (d.wertet !== true || (l && !l.wertet)) return;
  // Das Ende-Ereignis enthaelt kein tempo. Immer den gerade gespeicherten Datensatz lesen:
  // so bleiben Blitz und normale Wertung getrennt, auch nach dem Fortsetzen einer Partie.
  const p = ladePartie(d.partieId);
  if (!p || !wertet(p) || !LEITER.has(p.botId)) return;
  const bot = botNachId(p.botId), st = lese();
  meldeKronen(p, bot);
  if (!st) return;
  const partie = { ...p, hinweise: Math.max(p.hinweise || 0, d.hinweise || 0, l?.hinweise || 0) };
  uebernehme(buchePartie(st, partie, bot.elo, new Date()));
}));

hoere('partie:analysiert', sicher((d) => {
  if (d.wertet !== true) return;
  const st = lese(), p = ladePartie(d.partieId);
  // Nachholen einer alten Partie darf keine zweite Wertung erzeugen.
  if (!st || !p || !wertet(p) || !belegFuer(st, p.id)) return;
  const genauigkeit = p.genauigkeitQuelle === 'analyse' && Number.isFinite(p.genauigkeit)
    ? p.genauigkeit : d.review?.genauigkeit?.[p.spielerFarbe];
  // Zu kurze Partien zeigen keine Genauigkeit ("zu kurz"), dann zaehlt sie auch in der Liga nicht
  if (eigeneZuege(p) < BESTWERT_MIN_ZUEGE) return;
  uebernehme(bucheGenauigkeit(st, p.id, genauigkeit));
}));

if (typeof document !== 'undefined') {
  sicher(() => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = new URL('../../../css/pakete/liga.css', import.meta.url).href;
    css.dataset.paket = MODUL;
    document.head.append(css);
    registriereIcon('liga-wappen', '<path d="M5 4h14v8c0 4-4 7-7 9-3-2-7-5-7-9z"/><path d="m8 9 4 3 4-3M8 14l4 3 4-3"/>');
  })();
  const kontext = { lese };
  // Die Saison-Liga-Karte der Bots-Seite (Ort arena:panel-oben) entfaellt mit der einen Liga (Flo 08.11.2026)
  anbieten('arena:panel-bot', sicher((k) => botBilanz(k)), { reihenfolge: 15, paket: MODUL });
  anbieten('ergebnis:abrechnung', sicher((k) => abrechnungsZeile(k, lese())), { reihenfolge: 30, paket: MODUL });
  anbieten('verlauf:seite', sicher(() => verlaufKarte(kontext)), { reihenfolge: 20, paket: MODUL });
  // Wochen-Gruppe der Kronen-Liga (07.11.2026): erster Reiter der Bestenliste, Freunde (Paket punkte, 8) gleich dahinter
  anbieten('bestenliste:reiter', sicher((k) => (k && k.reiter === 'gruppe' ? reiterGruppe(k) : { el: huelleGruppe(), verlasse() {} })),
    { reihenfolge: 5, paket: MODUL });
}
