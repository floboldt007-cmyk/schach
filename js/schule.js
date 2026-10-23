// Schulmodus (Welle B3): Klassen fuer Lehrkraefte und Vereine. Ohne Supabase-Bibliothek, nur fetch (Muster: js/konto.js,
// js/abo.js). Die Wahrheit liegt auf dem Server (supabase/schule-schema.sql, Funktionen schule_*); hier stehen die Aufrufe,
// ein Zwischenspeicher fuer "Meine Klassen" (damit die Aufgabe auch offline in der Arena steht) und die Rechnung, was
// ein Mitglied meldet. Die Oberflaeche liegt im Paket js/pakete/schule/ (Gruppe in den Einstellungen, Zeile in der
// Heute-Karte) und im Paket-Screen js/ui/schule.js (Lehrkraft-Ansicht). Idee und Datenschutz: design/runde4/SCHULE.md.
//
// Was die Leitung sieht (und was die App einem Mitglied vor dem Beitritt sagt, WAS_DIE_LEITUNG_SIEHT): den selbst
// gewaehlten Anzeigenamen, besiegte Bots, Sterne, Zahl der wertenden Partien, die durchschnittliche Genauigkeit, die
// haeufigsten Fehlerarten (aus den letzten FEHLER_FENSTER Partien) und welche Aufgaben erledigt sind. Nie die E-Mail,
// nie die Partien, Zuege oder Uhrzeiten.
//
// API:
//   setzeSchuleFetch(fn), setzeSchuleUhr(fn)    nur fuer Tests
//   normalisiereCode(text) -> 'ABC234' | null   Leerzeichen und Bindestriche weg, gross; nur die 32 Zeichen ohne 0/O/1/I
//   pruefeAnzeigename(text) -> { ok, name, grund? }   2 bis 24 Zeichen, Buchstaben (auch mit Akzent), Ziffern, Leerzeichen,
//       Punkt, Bindestrich, Apostroph, mindestens ein Buchstabe, nie eine E-Mail (wie die Pruefung auf dem Server)
//   pruefeKlassenname(text) -> { ok, name, grund? }   2 bis 40 Zeichen, ohne @ und Spitzklammern
//   fehlerText(grund, { was }) -> Satz   was: 'klasse' | 'anzeigename' fuer SCHULE_NAME_UNGUELTIG
//   meineKlassen({ neu = false } = {}) -> Promise<{ ok, daten?, offline?, grund? }>
//       daten = { leitung: [{ id, name, code, aktiv, erstellt_am, geschlossen_am, mitglieder }],
//                 mitglied: [{ klasse, name, aktiv, mitglied, anzeigename, beigetreten_am, erledigt, aufgaben }] }
//       Zwischenspeicher hoechstens STAND_MS (ohne Klasse LEER_MS), offline der letzte Stand (offline: true).
//   meineKlassenGespeichert() -> daten | null   synchron, nur fuer das angemeldete Konto
//   erstelleKlasse(name), trittBei(code, anzeigename), verlasse(klasseId), uebersicht(klasseId),
//   aufgabeAnlegen(klasseId, { titel, art, ziel, faellig }), aufgabeLoeschen(aufgabeId), entferneMitglied(mitgliedId),
//   schliesseKlasse(klasseId), loescheKlasse(klasseId)
//       -> Promise<{ ok: true, ... } | { ok: false, grund }>   grund: 'abgemeldet' | 'offline' | 'server' |
//       'nicht_eingerichtet' | eine Kennung SCHULE_* aus dem Schema. Nach jeder Aenderung ist "Meine Klassen" neu geholt.
//   Fortschritt (Mitglied):
//   fortschrittJetzt({ stand, partien, fortschritt, statistikWerte, geloest } = {}) -> Parameter fuer
//       schule_melde_fortschritt: { bots_besiegt, sterne, partien, genauigkeit_schnitt, haeufigste_fehler, erledigt }
//   haeufigsteFehler(partien) -> { zuege, arten: [{ art, anzahl }] }   letzte FEHLER_FENSTER wertende Partien, nur eigene Zuege
//   aufgabeStand(aufgabe, { fortschritt, partien, geloest }) -> { erledigt, stand, ziel }   stand/ziel bei Partien und Raetseln
//   zielText(aufgabe) -> 'Ritter Rudi besiegen' | '5 Partien spielen' | '10 Rätsel lösen' (mit Sternen: '... mit 2 Sternen')
//   faelligText(faellig) -> 'bis Fr 30.10.' | ''   (ein Termin, nie ein Countdown)
//   offeneAufgabe(stand = meineKlassenGespeichert(), { heute, ... }) -> { klasse, aufgabe, stand } | null
//       die naechste nicht erledigte Aufgabe einer aktiven Klasse (Heute-Karte), Faellige zuerst; laenger als
//       ALT_TAGE ueberfaellige nicht mehr
//   merkeRaetsel({ id, richtig })   raetsel:geloest: zaehlt ein richtig geloestes Raetsel fuer offene Raetsel-Aufgaben
//       (jedes Raetsel einmal je Aufgabe, nur Aufgaben, die vor dem Loesen gestellt waren)
//   planeMeldung({ sofort = false } = {})   nach einer Partie: Meldung vormerken (OFFEN_SCHLUESSEL) und gebuendelt
//       senden (fruehestens BUENDEL_MS spaeter, hoechstens alle MELDE_ABSTAND_MS). Nur mit Anmeldung und einer
//       aktiven Klasse. Offline bleibt sie vorgemerkt (still, ohne Meldung) und geht beim naechsten Start oder
//       Zurueckkommen in die App.
//   meldeJetzt() -> Promise<{ ok, gesendet?, klassen?, grund? }>   grund 'keine_klasse' | 'gleich' (schon so gemeldet) | ...
//   meldungOffen() -> boolean
//   aufraeumen() -> boolean   ohne Anmeldung: alles vom Geraet nehmen, was zum Konto gehoert (nach dem Abmelden)
//   sortiereMitglieder(liste, spalte, richtung) -> neue Liste   spalte: 'name' | 'bots' | 'sterne' | 'partien' |
//       'genauigkeit' | 'aufgaben' | 'aktualisiert'; fehlende Werte immer unten
//   stelleSchuleCssSicher()   css/pakete/schule.css einmal nachladen
//   ICON = 'tafel'   Icon des Schulmodus (Tafel), beim Laden dieser Datei registriert (Paket und Screen nutzen es)
//
// Speicher (bewusst AUSSERHALB von schach-arena:v1:, wie beim Abo: gehoert zum Konto, nicht zum Spielstand; nicht in
// Cloud-Sicherung oder Export):
//   schach-arena:schule:stand     { uid, daten, geholtAm }
//   schach-arena:schule:offen     { uid, seit }   eine Meldung steht aus
//   schach-arena:schule:gemeldet  { uid, inhalt, am }   zuletzt gemeldet (gleiche Meldung geht nicht zweimal)
//   schach-arena:schule:raetsel   { uid, geloest: { <aufgabeId>: [raetselId, ...] } }
import { SUPABASE_URL, SUPABASE_KEY } from './konto-config.js';
import { sitzung, erneuereSitzung } from './konto.js';
import { ladePartien, ladeFortschritt, statistik, besiegteBots, gesamtSterne, sterneZahl, wertet } from './storage.js';
import { tagSchluessel, istSchluessel, wochentag, tageZwischen } from './tag.js';
import { BOTS } from './bots.js';
import { KLASSEN_NAME } from './zugklassen.js';
import { registriereIcon } from './ui/icons.js';

export const STAND_SCHLUESSEL = 'schach-arena:schule:stand';
export const OFFEN_SCHLUESSEL = 'schach-arena:schule:offen';
export const GEMELDET_SCHLUESSEL = 'schach-arena:schule:gemeldet';
export const RAETSEL_SCHLUESSEL = 'schach-arena:schule:raetsel';
export const STAND_MS = 10 * 60 * 1000;
export const LEER_MS = 12 * 60 * 60 * 1000;
export const BUENDEL_MS = 4000;
export const MELDE_ABSTAND_MS = 60 * 1000;
export const FEHLER_FENSTER = 20;
export const FEHLER_ARTEN = Object.freeze(['patzer', 'fehler', 'verpasst', 'ungenau']);
export const CODE_ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ALT_TAGE = 14;
export const ARTEN = Object.freeze(['bot', 'raetsel', 'partien']);
export const GRENZEN = Object.freeze({ mitglieder: 60, klassen: 20, mitgliedschaften: 10, aufgaben: 30, anzahl: 100 });

export const WAS_DIE_LEITUNG_SIEHT = 'Deine Lehrkraft oder Trainerin sieht deinen Anzeigenamen, wie viele Bots du besiegt hast, '
  + 'deine Sterne, die Zahl deiner Partien, deine durchschnittliche Genauigkeit, deine häufigsten Fehlerarten und welche '
  + 'Aufgaben erledigt sind. Nicht: deine E-Mail-Adresse, deine Partien, Züge oder Spielzeiten. Austreten geht jederzeit.';

export const TEXTE = Object.freeze({
  abgemeldet: 'Melde dich zuerst mit deinem Konto an.',
  offline: 'Gerade keine Verbindung. Versuch es gleich noch einmal.',
  server: 'Der Server antwortet gerade nicht. Versuch es später noch einmal.',
  nicht_eingerichtet: 'Der Schulmodus ist auf dem Server noch nicht eingerichtet.',
  SCHULE_NICHT_ANGEMELDET: 'Melde dich zuerst mit deinem Konto an.',
  SCHULE_NAME_UNGUELTIG: 'Der Anzeigename braucht 2 bis 24 Zeichen: Buchstaben, Ziffern, Leerzeichen, Punkt oder Bindestrich. Eine E-Mail-Adresse geht nicht.',
  SCHULE_NAME_UNGUELTIG_KLASSE: 'Der Name der Klasse braucht 2 bis 40 Zeichen, ohne @.',
  SCHULE_NAME_VERGEBEN: 'Diesen Anzeigenamen gibt es in der Klasse schon. Nimm zum Beispiel den ersten Buchstaben deines Nachnamens dazu.',
  SCHULE_CODE_UNGUELTIG: 'Zu diesem Code gibt es keine Klasse. Prüfe die 6 Zeichen.',
  SCHULE_KLASSE_GESCHLOSSEN: 'Diese Klasse ist geschlossen.',
  SCHULE_EIGENE_KLASSE: 'Das ist deine eigene Klasse. Du leitest sie schon.',
  SCHULE_KLASSE_VOLL: 'Die Klasse hat schon 60 Mitglieder.',
  SCHULE_ZU_VIELE_KLASSEN: 'Mit einem Konto gehen höchstens 20 eigene Klassen und 10 Klassen als Mitglied.',
  SCHULE_ZU_VIELE_VERSUCHE: 'Heute waren es zu viele falsche Codes. Morgen geht es wieder.',
  SCHULE_KEIN_CODE: 'Gerade ließ sich kein Code erzeugen. Versuch es gleich noch einmal.',
  SCHULE_KEINE_LEITUNG: 'Diese Klasse gibt es nicht mehr, oder du leitest sie nicht.',
  SCHULE_AUFGABE_UNGUELTIG: 'So passt die Aufgabe nicht: Titel 2 bis 80 Zeichen, Anzahl 1 bis 100, Datum höchstens ein Jahr voraus.',
  SCHULE_ZU_VIELE_AUFGABEN: 'Eine Klasse hat höchstens 30 Aufgaben. Lösche eine alte, dann geht eine neue.',
  SCHULE_FORTSCHRITT_UNGUELTIG: 'Der Fortschritt ließ sich nicht melden.',
});

const WOCHENTAG_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const NAME_ZEICHEN = /^[A-Za-zÀ-ÖØ-öø-ÿĀ-ž0-9 .'-]+$/;
const NAME_BUCHSTABE = /[A-Za-zÀ-ÖØ-öø-ÿĀ-ž]/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let fetchFn = (...a) => fetch(...a);
let uhr = () => Date.now();
let laufendStand = null;
let laufendMeldung = null;
let meldeTimer = null;
export function setzeSchuleFetch(fn) { fetchFn = fn || ((...a) => fetch(...a)); }
export function setzeSchuleUhr(fn) { uhr = typeof fn === 'function' ? fn : () => Date.now(); }

function lager() { return globalThis.localStorage; }
function jsonLies(k) { try { return JSON.parse(lager().getItem(k)); } catch (e) { return null; } }
function jsonSchreib(k, v) { try { lager().setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
function entferne(k) { try { lager().removeItem(k); } catch (e) { /* egal */ } }

// Nutzer-ID aus der Sitzung (wie js/konto.js: user.id, sonst sub im Token)
export function nutzerId(s = sitzung()) {
  if (!s) return null;
  if (s.user && typeof s.user.id === 'string') return s.user.id;
  try { return JSON.parse(atob(String(s.access_token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub || null; } catch (e) { return null; }
}
async function gueltigeSitzung() {
  const s = sitzung();
  if (!s) { const f = new Error('Nicht angemeldet.'); f.grund = 'abgemeldet'; throw f; }
  if (Number(s.expires_at) > Math.floor(uhr() / 1000) + 30) return s;
  try { return await erneuereSitzung(); } catch (e) {
    const f = new Error(e.message);
    f.grund = /Verbindung/.test(String(e.message)) ? 'offline' : 'abgemeldet';
    throw f;
  }
}

// RPC an die Datenbank. Fehler tragen grund: 'offline' | 'abgemeldet' | 'server' | 'nicht_eingerichtet' | SCHULE_*
async function rpc(name, daten = {}) {
  const s = await gueltigeSitzung();
  let r;
  try {
    r = await fetchFn(`${SUPABASE_URL}/rest/v1/rpc/${name}`, { method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(daten) });
  } catch (e) {
    const f = new Error('Keine Verbindung.'); f.grund = 'offline'; throw f;
  }
  let d = null;
  if (r.status !== 204) { try { d = await r.json(); } catch (e) { /* leer */ } }
  if (!r.ok) {
    const text = String((d && (d.message || d.msg)) || '');
    const f = new Error(text || `Serverfehler (${r.status})`);
    const kennung = text.match(/SCHULE_[A-Z_]+/);
    if (kennung) f.grund = kennung[0];
    else if (r.status === 401 || r.status === 403) f.grund = 'abgemeldet';
    // Funktion unbekannt (Schema nicht eingespielt): PostgREST meldet 404 bzw. PGRST202
    else if (r.status === 404 || (d && d.code === 'PGRST202')) f.grund = 'nicht_eingerichtet';
    else f.grund = 'server';
    throw f;
  }
  if (d && typeof d === 'object' && !Array.isArray(d) && typeof d.fehler === 'string' && /^SCHULE_/.test(d.fehler)) {
    const f = new Error(d.fehler); f.grund = d.fehler; throw f;
  }
  return d;
}
const fehlschlag = (e) => ({ ok: false, grund: (e && e.grund) || 'server' });

// ---------- Eingaben ----------
export function normalisiereCode(text) {
  const c = String(text ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length !== 6) return null;
  for (const z of c) if (!CODE_ZEICHEN.includes(z)) return null;
  return c;
}
const sauber = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();
export function pruefeAnzeigename(text) {
  const name = sauber(text);
  if (name.includes('@')) return { ok: false, name, grund: 'SCHULE_NAME_UNGUELTIG' };
  const ok = name.length >= 2 && name.length <= 24 && NAME_ZEICHEN.test(name) && NAME_BUCHSTABE.test(name);
  return ok ? { ok: true, name } : { ok: false, name, grund: 'SCHULE_NAME_UNGUELTIG' };
}
export function pruefeKlassenname(text) {
  const name = sauber(text);
  // eslint-disable-next-line no-control-regex
  const ok = name.length >= 2 && name.length <= 40 && !/[<>@\u0000-\u001f\u007f]/.test(name);
  return ok ? { ok: true, name } : { ok: false, name, grund: 'SCHULE_NAME_UNGUELTIG' };
}
export function fehlerText(grund, { was = 'anzeigename' } = {}) {
  if (grund === 'SCHULE_NAME_UNGUELTIG' && was === 'klasse') return TEXTE.SCHULE_NAME_UNGUELTIG_KLASSE;
  return TEXTE[grund] || TEXTE.server;
}

// ---------- Meine Klassen ----------
const leer = () => ({ leitung: [], mitglied: [] });
function pruefeStand(d) {
  if (!d || typeof d !== 'object') return leer();
  return { leitung: Array.isArray(d.leitung) ? d.leitung.filter((k) => k && typeof k === 'object') : [],
    mitglied: Array.isArray(d.mitglied) ? d.mitglied.filter((k) => k && typeof k === 'object') : [] };
}
function gecacht(uid) {
  const c = jsonLies(STAND_SCHLUESSEL);
  return c && typeof c === 'object' && c.uid === uid && c.daten ? c : null;
}
export function meineKlassenGespeichert() {
  const uid = nutzerId();
  const c = uid ? gecacht(uid) : null;
  return c ? pruefeStand(c.daten) : null;
}
const hatKlassen = (d) => !!d && (d.leitung.length > 0 || d.mitglied.length > 0);

export function meineKlassen({ neu = false } = {}) {
  const uid = nutzerId();
  if (!uid) return Promise.resolve({ ok: false, grund: 'abgemeldet' });
  const c = gecacht(uid);
  if (!neu && c && Number.isFinite(c.geholtAm) && uhr() >= c.geholtAm
    && uhr() - c.geholtAm < (hatKlassen(pruefeStand(c.daten)) ? STAND_MS : LEER_MS)) {
    return Promise.resolve({ ok: true, daten: pruefeStand(c.daten) });
  }
  if (laufendStand && laufendStand.uid === uid) return laufendStand.p;
  const p = (async () => {
    try {
      const daten = pruefeStand(await rpc('schule_meine_klassen'));
      jsonSchreib(STAND_SCHLUESSEL, { uid, daten, geholtAm: uhr() });
      return { ok: true, daten };
    } catch (e) {
      if (c && (e.grund === 'offline' || e.grund === 'server')) return { ok: true, daten: pruefeStand(c.daten), offline: true };
      return fehlschlag(e);
    } finally {
      laufendStand = null;
    }
  })();
  laufendStand = { uid, p };
  return p;
}

// Aenderung, danach "Meine Klassen" neu holen (Fehler beim Nachholen aendern das Ergebnis nicht)
async function aendere(name, daten, aus = (d) => d) {
  try {
    const d = await rpc(name, daten);
    await meineKlassen({ neu: true }).catch(() => null);
    return { ok: true, ...aus(d) };
  } catch (e) {
    return fehlschlag(e);
  }
}

export async function erstelleKlasse(name) {
  const n = pruefeKlassenname(name);
  if (!n.ok) return { ok: false, grund: n.grund };
  return aendere('schule_erstelle_klasse', { name: n.name }, (d) => ({ klasse: d }));
}

export async function trittBei(code, anzeigename) {
  const c = normalisiereCode(code);
  const n = pruefeAnzeigename(anzeigename);
  if (!n.ok) return { ok: false, grund: n.grund };
  // ein sichtbar falscher Code geht gar nicht erst zum Server (zaehlt dort sonst als Fehlversuch)
  if (!c) return { ok: false, grund: 'SCHULE_CODE_UNGUELTIG' };
  const r = await aendere('schule_tritt_bei', { code: c, anzeigename: n.name }, (d) => ({ klasse: d.klasse, mitglied: d.mitglied }));
  // gleich melden, damit die Leitung den Stand sieht (geht nur mit Anmeldung, still bei Fehlern)
  if (r.ok) planeMeldung({ sofort: true });
  return r;
}

export function verlasse(klasseId) { return aendere('schule_verlasse', { klasse: klasseId }, (d) => ({ verlassen: d === true })); }
export async function uebersicht(klasseId) {
  try { return { ok: true, daten: await rpc('schule_klassen_uebersicht', { klasse: klasseId }) }; } catch (e) { return fehlschlag(e); }
}
export function aufgabeAnlegen(klasseId, { titel, art, ziel, faellig = null } = {}) {
  return aendere('schule_aufgabe_anlegen', { klasse: klasseId, titel: sauber(titel), art, ziel, faellig: faellig || null }, (d) => ({ aufgabe: d }));
}
export function aufgabeLoeschen(aufgabeId) { return aendere('schule_aufgabe_loeschen', { aufgabe: aufgabeId }, (d) => ({ geloescht: d === true })); }
export function entferneMitglied(mitgliedId) { return aendere('schule_entferne_mitglied', { mitglied: mitgliedId }, (d) => ({ entfernt: d === true })); }
export function schliesseKlasse(klasseId) { return aendere('schule_schliesse_klasse', { klasse: klasseId }, () => ({})); }
export function loescheKlasse(klasseId) { return aendere('schule_loesche_klasse', { klasse: klasseId }, (d) => ({ geloescht: d === true })); }

// ---------- Aufgaben: Texte und Stand ----------
const botName = (id) => (BOTS.find((b) => b.id === id) || {}).name || id;
export function zielText(a) {
  const z = (a && a.ziel) || {};
  if (a && a.art === 'bot') {
    const s = Number(z.sterne) || 1;
    return `${botName(z.bot)} besiegen${s > 1 ? ` mit ${s} Sternen` : ''}`;
  }
  const n = Number(z.anzahl) || 1;
  if (a && a.art === 'raetsel') return `${n} Rätsel lösen`;
  return `${n} ${n === 1 ? 'Partie' : 'Partien'} spielen`;
}
// Faelligkeit als Termin ("bis Fr 30.10."), nie als Restzeit
export function faelligText(faellig) {
  if (typeof faellig !== 'string' || !istSchluessel(faellig)) return '';
  const [, m, t] = faellig.split('-');
  return `bis ${WOCHENTAG_KURZ[wochentag(faellig)]} ${t}.${m}.`;
}
const msVon = (iso) => { const t = Date.parse(iso); return Number.isFinite(t) ? t : 0; };
function geloestFuer(uid) {
  const g = jsonLies(RAETSEL_SCHLUESSEL);
  return g && typeof g === 'object' && g.uid === uid && g.geloest && typeof g.geloest === 'object' ? g.geloest : {};
}
export function aufgabeStand(a, { fortschritt = null, partien = null, geloest = null } = {}) {
  const z = (a && a.ziel) || {};
  if (!a || !ARTEN.includes(a.art)) return { erledigt: false, stand: null, ziel: null };
  if (a.art === 'bot') {
    const f = fortschritt || ladeFortschritt();
    const ziel = Math.min(3, Math.max(1, Number(z.sterne) || 1));
    const hat = f && f.bots && f.bots[z.bot] ? sterneZahl(z.bot, f) : 0;
    return { erledigt: hat >= ziel, stand: Math.min(hat, ziel), ziel };
  }
  const ziel = Math.max(1, Number(z.anzahl) || 1);
  if (a.art === 'partien') {
    const ab = msVon(a.erstellt_am);
    // gespielte Partien seit der Aufgabe (Uebungen sind keine Partie)
    const n = (partien || ladePartien()).filter((p) => p && p.modus !== 'uebung' && msVon(p.datum) >= ab).length;
    return { erledigt: n >= ziel, stand: Math.min(n, ziel), ziel };
  }
  const liste = (geloest || geloestFuer(nutzerId()))[a.id];
  const n = Array.isArray(liste) ? liste.length : 0;
  return { erledigt: n >= ziel, stand: Math.min(n, ziel), ziel };
}

// Die naechste offene Aufgabe (Heute-Karte): zuerst mit Termin (der naechste zuerst), dann ohne Termin (die neueste),
// laenger als ALT_TAGE ueberfaellige gar nicht mehr
export function offeneAufgabe(stand = meineKlassenGespeichert(), { heute = tagSchluessel(new Date(uhr())), ...quellen } = {}) {
  if (!stand) return null;
  const kandidaten = [];
  for (const k of stand.mitglied || []) {
    if (!k.aktiv) continue;
    for (const a of Array.isArray(k.aufgaben) ? k.aufgaben : []) {
      if (!a || !ARTEN.includes(a.art)) continue;
      if (typeof a.faellig === 'string' && istSchluessel(a.faellig) && tageZwischen(a.faellig, heute) > ALT_TAGE) continue;
      const st = aufgabeStand(a, quellen);
      if (!st.erledigt) kandidaten.push({ klasse: k, aufgabe: a, stand: st });
    }
  }
  const termin = (x) => (typeof x.aufgabe.faellig === 'string' && istSchluessel(x.aufgabe.faellig) ? x.aufgabe.faellig : null);
  kandidaten.sort((x, y) => {
    const a = termin(x);
    const b = termin(y);
    if (a && b) return a < b ? -1 : a > b ? 1 : 0;
    if (a || b) return a ? -1 : 1;
    return msVon(y.aufgabe.erstellt_am) - msVon(x.aufgabe.erstellt_am);
  });
  return kandidaten[0] || null;
}

export function merkeRaetsel({ id, richtig } = {}) {
  const uid = nutzerId();
  if (!uid || !richtig || (typeof id !== 'string' && typeof id !== 'number')) return false;
  const stand = meineKlassenGespeichert();
  if (!stand) return false;
  const geloest = geloestFuer(uid);
  const jetzt = uhr();
  const gueltig = new Set();
  let neu = false;
  for (const k of stand.mitglied) {
    if (!k.aktiv) continue;
    for (const a of Array.isArray(k.aufgaben) ? k.aufgaben : []) {
      if (!a || a.art !== 'raetsel' || typeof a.id !== 'string') continue;
      gueltig.add(a.id);
      if (msVon(a.erstellt_am) > jetzt) continue;
      const liste = Array.isArray(geloest[a.id]) ? geloest[a.id] : [];
      const ziel = Math.min(GRENZEN.anzahl, Math.max(1, Number(a.ziel && a.ziel.anzahl) || 1));
      if (liste.length >= ziel || liste.includes(String(id))) continue;
      geloest[a.id] = [...liste, String(id)];
      neu = true;
    }
  }
  // Aufgaben, die es nicht mehr gibt, fallen heraus
  for (const k of Object.keys(geloest)) if (!gueltig.has(k)) delete geloest[k];
  jsonSchreib(RAETSEL_SCHLUESSEL, { uid, geloest });
  return neu;
}

// ---------- Fortschritt ----------
// Eigene Zuege einer Partie aus der Grundstellung: Weiss zieht in den geraden Halbzuegen
export function haeufigsteFehler(partien = ladePartien()) {
  const liste = (Array.isArray(partien) ? partien : []).filter((p) => p && wertet(p) && Array.isArray(p.zuege))
    .sort((a, b) => msVon(b.datum) - msVon(a.datum)).slice(0, FEHLER_FENSTER);
  const zaehler = Object.fromEntries(FEHLER_ARTEN.map((a) => [a, 0]));
  let zuege = 0;
  for (const p of liste) {
    const rest = p.spielerFarbe === 'b' ? 1 : 0;
    const klassen = Array.isArray(p.liveKlassen) ? p.liveKlassen : [];
    for (let i = rest; i < p.zuege.length; i += 2) {
      zuege++;
      const k = klassen[i];
      if (Object.prototype.hasOwnProperty.call(zaehler, k)) zaehler[k]++;
    }
  }
  const arten = FEHLER_ARTEN.map((art) => ({ art, anzahl: zaehler[art] })).filter((x) => x.anzahl > 0)
    .sort((a, b) => b.anzahl - a.anzahl || FEHLER_ARTEN.indexOf(a.art) - FEHLER_ARTEN.indexOf(b.art));
  return { zuege: Math.min(zuege, 999999), arten };
}
export function fehlerArtName(art) { return KLASSEN_NAME[art] || art; }

export function fortschrittJetzt({ stand = meineKlassenGespeichert(), partien = null, fortschritt = null, statistikWerte = null, geloest = null } = {}) {
  const f = fortschritt || ladeFortschritt();
  const p = partien || ladePartien();
  const st = statistikWerte || statistik();
  const erledigt = [];
  for (const k of (stand && stand.mitglied) || []) {
    if (!k.aktiv) continue;
    for (const a of Array.isArray(k.aufgaben) ? k.aufgaben : []) {
      if (a && typeof a.id === 'string' && UUID_RE.test(a.id) && !erledigt.includes(a.id)
        && aufgabeStand(a, { fortschritt: f, partien: p, geloest }).erledigt) erledigt.push(a.id);
    }
  }
  const gen = Number.isFinite(st.schnittGenauigkeit) ? Math.round(Math.min(100, Math.max(0, st.schnittGenauigkeit)) * 10) / 10 : null;
  return {
    bots_besiegt: Math.min(10, besiegteBots(f)),
    sterne: Math.min(30, gesamtSterne(f)),
    partien: Math.min(100000, Number(st.partien) || 0),
    genauigkeit_schnitt: gen,
    haeufigste_fehler: haeufigsteFehler(p),
    erledigt: erledigt.slice(0, 30),
  };
}

// ---------- Melden (gebuendelt, offline still) ----------
export function meldungOffen() {
  const o = jsonLies(OFFEN_SCHLUESSEL);
  return !!o && o.uid === nutzerId() && !!o.uid;
}
const aktiveKlassen = (d) => ((d && d.mitglied) || []).filter((k) => k.aktiv);

export function planeMeldung({ sofort = false } = {}) {
  const uid = nutzerId();
  if (!uid) return false;
  const stand = meineKlassenGespeichert();
  // bekannt ohne aktive Klasse: nichts vormerken (kein Netz fuer Leute ohne Klasse)
  if (stand && !aktiveKlassen(stand).length) return false;
  if (!meldungOffen()) jsonSchreib(OFFEN_SCHLUESSEL, { uid, seit: uhr() });
  const g = jsonLies(GEMELDET_SCHLUESSEL);
  const seit = g && g.uid === uid && Number.isFinite(g.am) ? uhr() - g.am : Infinity;
  const warte = sofort ? 0 : Math.max(BUENDEL_MS, seit >= 0 ? MELDE_ABSTAND_MS - seit : 0);
  clearTimeout(meldeTimer);
  meldeTimer = setTimeout(() => { meldeTimer = null; meldeJetzt().catch(() => {}); }, warte);
  return true;
}

export function meldeJetzt() {
  if (laufendMeldung) return laufendMeldung;
  laufendMeldung = (async () => {
    const uid = nutzerId();
    if (!uid) { entferne(OFFEN_SCHLUESSEL); return { ok: false, grund: 'abgemeldet' }; }
    const r = await meineKlassen();
    if (!r.ok) {
      if (r.grund !== 'offline' && r.grund !== 'server') entferne(OFFEN_SCHLUESSEL);
      return { ok: false, grund: r.grund };
    }
    const aktiv = aktiveKlassen(r.daten);
    if (!aktiv.length) { entferne(OFFEN_SCHLUESSEL); return { ok: true, gesendet: false, grund: 'keine_klasse' }; }
    const daten = fortschrittJetzt({ stand: r.daten });
    const inhalt = JSON.stringify({ klassen: aktiv.map((k) => k.mitglied).sort(), daten });
    const g = jsonLies(GEMELDET_SCHLUESSEL);
    if (g && g.uid === uid && g.inhalt === inhalt) { entferne(OFFEN_SCHLUESSEL); return { ok: true, gesendet: false, grund: 'gleich' }; }
    try {
      const n = await rpc('schule_melde_fortschritt', daten);
      jsonSchreib(GEMELDET_SCHLUESSEL, { uid, inhalt, am: uhr() });
      entferne(OFFEN_SCHLUESSEL);
      return { ok: true, gesendet: true, klassen: Number(n) || 0 };
    } catch (e) {
      // offline oder Server weg: vorgemerkt lassen (still); alles andere nicht endlos wiederholen
      if (e.grund !== 'offline' && e.grund !== 'server') entferne(OFFEN_SCHLUESSEL);
      return fehlschlag(e);
    }
  })().finally(() => { laufendMeldung = null; });
  return laufendMeldung;
}

// Nach dem Abmelden: was zum Konto gehoert, vom Geraet nehmen. Liefert true, wenn etwas entfernt wurde.
export function aufraeumen() {
  if (nutzerId()) return false;
  let weg = false;
  for (const k of [STAND_SCHLUESSEL, OFFEN_SCHLUESSEL, GEMELDET_SCHLUESSEL, RAETSEL_SCHLUESSEL]) {
    try { if (lager().getItem(k) !== null) { lager().removeItem(k); weg = true; } } catch (e) { /* egal */ }
  }
  clearTimeout(meldeTimer);
  meldeTimer = null;
  return weg;
}

// ---------- Sortieren (Lehrkraft-Ansicht) ----------
export const SPALTEN = Object.freeze(['name', 'bots', 'sterne', 'partien', 'genauigkeit', 'aufgaben', 'aktualisiert']);
function wert(m, spalte) {
  const f = m && m.fortschritt;
  switch (spalte) {
    case 'name': return String((m && m.anzeigename) || '').toLocaleLowerCase('de');
    case 'bots': return f ? f.bots_besiegt : null;
    case 'sterne': return f ? f.sterne : null;
    case 'partien': return f ? f.partien : null;
    case 'genauigkeit': return f && f.genauigkeit_schnitt != null ? Number(f.genauigkeit_schnitt) : null;
    case 'aufgaben': return f && Array.isArray(f.erledigt) ? f.erledigt.length : null;
    case 'aktualisiert': return f ? msVon(f.aktualisiert_am) : null;
    default: return null;
  }
}
export function sortiereMitglieder(liste, spalte = 'name', richtung = 'auf') {
  const s = SPALTEN.includes(spalte) ? spalte : 'name';
  const r = richtung === 'ab' ? -1 : 1;
  return [...(Array.isArray(liste) ? liste : [])].sort((a, b) => {
    const x = wert(a, s);
    const y = wert(b, s);
    if (x == null || y == null || Number.isNaN(x) || Number.isNaN(y)) {
      if ((x == null || Number.isNaN(x)) && (y == null || Number.isNaN(y))) return wert(a, 'name').localeCompare(wert(b, 'name'), 'de');
      return x == null || Number.isNaN(x) ? 1 : -1;
    }
    const c = typeof x === 'string' ? x.localeCompare(y, 'de') : x - y;
    return c * r || wert(a, 'name').localeCompare(wert(b, 'name'), 'de');
  });
}

// ---------- Optik ----------
export function stelleSchuleCssSicher() {
  if (typeof document === 'undefined' || document.querySelector('link[data-paket-css="schule"]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = new URL('../css/pakete/schule.css', import.meta.url).href;
  l.dataset.paketCss = 'schule';
  document.head.appendChild(l);
}

// Icon des Schulmodus: eine Tafel auf Beinen (Paket-Zeile, Gruppe, Lehrkraft-Ansicht)
export const ICON = 'tafel';
try {
  registriereIcon(ICON, '<rect x="3.5" y="4.5" width="17" height="11.5" rx="1.6"/><path d="M8.5 20.5l2-4.5M15.5 20.5l-2-4.5M7.5 9h6M7.5 12h4"/>');
} catch (e) { /* ohne Icon geht es auch */ }
