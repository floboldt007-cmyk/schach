// S1-9: tragbare Sicherung des kompletten, eigenen localStorage-Bereichs.
// Die Datenlogik bleibt DOM-frei und wird unten nur an den Einstellungs-Ort gebunden.
import { anbieten } from './orte.js';
import { rohSpeicher, speicherStand } from './storage.js';
import { tagSchluessel, tageZwischen } from './tag.js';
import { t, datum, zahl } from './sprache.js';
import './sprachen/allgemein.js';
import './sprachen/einstellungen.js';

export const SICHERUNG_FORMAT = 'schach-arena-sicherung';
export const SICHERUNG_VERSION = 2;
const STANDARD = Object.freeze({ letzteSicherung: 0, letzterTag: '' });
function S(k, w) { return t('einstellungen.si.' + k, w); }

function ladeMerker() {
  try { return JSON.parse(rohSpeicher().lies(rohSpeicher().praefix + 'sicherung') || 'null') || STANDARD; }
  catch (e) { return STANDARD; }
}

function speichereMerker(daten) {
  rohSpeicher().schreib(rohSpeicher().praefix + 'sicherung', JSON.stringify(daten));
}

function zeitText(ms) {
  return datum(new Date(ms), { dateStyle: 'medium', timeStyle: 'short' });
}

function datenAusSpeicher() {
  const roh = rohSpeicher();
  return Object.fromEntries(roh.schluessel().map((k) => [k, roh.lies(k)]));
}

export function erstelleSicherung(jetzt = new Date()) {
  const ms = jetzt instanceof Date ? jetzt.getTime() : Number(jetzt);
  if (!Number.isFinite(ms)) throw new TypeError('Ungültiges Sicherungsdatum');
  const tag = tagSchluessel(ms);
  speichereMerker({ letzteSicherung: ms, letzterTag: tag });
  return {
    format: SICHERUNG_FORMAT,
    version: SICHERUNG_VERSION,
    erstellt: ms,
    tag,
    daten: datenAusSpeicher(),
  };
}

// Version 1 schrieb dieselben Schlüssel als Liste. Vor der Versionierung gab es eine reine Daten-Abbildung.
function migriere(eingabe) {
  if (!eingabe || typeof eingabe !== 'object' || Array.isArray(eingabe)) throw new Error(S('fehler.keine'));
  if (!('version' in eingabe) && eingabe.daten && typeof eingabe.daten === 'object') {
    return { ...eingabe, format: SICHERUNG_FORMAT, version: 2, erstellt: Number(eingabe.erstellt || eingabe.datum) };
  }
  if (eingabe.format !== SICHERUNG_FORMAT) throw new Error(S('fehler.format'));
  if (eingabe.version === 1 && Array.isArray(eingabe.speicher)) {
    return { ...eingabe, version: 2, daten: Object.fromEntries(eingabe.speicher) };
  }
  if (eingabe.version !== SICHERUNG_VERSION) throw new Error(S('fehler.version'));
  return eingabe;
}

export function pruefeSicherung(eingabe) {
  const s = migriere(typeof eingabe === 'string' ? (() => {
    try { return JSON.parse(eingabe); } catch (e) { throw new Error(S('fehler.json')); }
  })() : eingabe);
  if (!Number.isFinite(s.erstellt) || s.erstellt <= 0) throw new Error(S('fehler.datum'));
  if (!s.daten || typeof s.daten !== 'object' || Array.isArray(s.daten)) throw new Error(S('fehler.daten'));
  const roh = rohSpeicher();
  const eintraege = Object.entries(s.daten);
  if (!eintraege.length) throw new Error(S('fehler.leer'));
  for (const [k, v] of eintraege) {
    if (!k.startsWith(roh.praefix) || k.length <= roh.praefix.length || typeof v !== 'string') throw new Error(S('fehler.eintraege'));
    try { JSON.parse(v); } catch (e) { throw new Error(S('fehler.beschaedigt')); }
  }
  const partien = JSON.parse(s.daten[roh.praefix + 'partien'] || '[]');
  const fortschritt = JSON.parse(s.daten[roh.praefix + 'fortschritt'] || '{}');
  if (!Array.isArray(partien) || !fortschritt || typeof fortschritt !== 'object' || Array.isArray(fortschritt)) throw new Error(S('fehler.pflicht'));
  const bots = fortschritt.bots && typeof fortschritt.bots === 'object'
    ? Object.values(fortschritt.bots).filter((b) => b && Array.isArray(b.sterne) && b.sterne[0]).length : 0;
  let level = 1;
  try { level = Number(JSON.parse(s.daten[roh.praefix + 'modul:funken'] || '{}').level) || 1; } catch (e) { /* schon geprüft */ }
  return Object.freeze({ sicherung: s, vorschau: Object.freeze({ datum: s.erstellt, partien: partien.length, level, bots }) });
}

export function uebernehmeSicherung(geprueft, jetzt = new Date()) {
  const p = geprueft && geprueft.sicherung ? geprueft : pruefeSicherung(geprueft);
  const rueckfall = erstelleSicherung(jetzt);
  const roh = rohSpeicher();
  try {
    const ziel = p.sicherung.daten;
    for (const k of roh.schluessel()) if (!(k in ziel)) roh.entferne(k);
    for (const [k, v] of Object.entries(ziel)) if (!roh.schreib(k, v)) throw new Error(S('fehler.speicher'));
    return { rueckfall, vorschau: p.vorschau };
  } catch (fehler) {
    for (const k of roh.schluessel()) roh.entferne(k);
    for (const [k, v] of Object.entries(rueckfall.daten)) roh.schreib(k, v);
    throw fehler;
  }
}

export function sicherungsHinweis(jetzt = new Date()) {
  const m = ladeMerker();
  if (!m.letzterTag) return { tage: null, text: S('keine') };
  let tage;
  try { tage = Math.max(0, tageZwischen(m.letzterTag, tagSchluessel(jetzt))); } catch (e) { return { tage: null, text: S('keine') }; }
  return { tage, text: tage >= 7 ? S('vorTagen', { tage }) : S('zuletzt', { zeit: zeitText(m.letzteSicherung) }) };
}

export function dateiFuer(sicherung) {
  const text = JSON.stringify(sicherung, null, 2);
  return new File([text], `schach-arena-sicherung-${sicherung.tag}.json`, { type: 'application/json' });
}

export async function speichereDatei(datei) {
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [datei] })) {
    await navigator.share({ files: [datei], title: S('teilenTitel') });
    return 'geteilt';
  }
  const url = URL.createObjectURL(datei);
  const a = document.createElement('a'); a.href = url; a.download = datei.name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'download';
}

function karte({ app }) {
  const el = document.createElement('section');
  el.className = 'es-gruppe flaeche si-gruppe';
  el.setAttribute('aria-labelledby', 'si-titel');
  el.innerHTML = `<h3 class="es-titel" id="si-titel">${S('titel')}</h3>
    <p class="es-hilfe si-stand"></p><p class="si-belegung zahl"></p>
    <div class="si-knoepfe"><button class="knopf primaer" type="button" data-si="export">${S('erstellen')}</button>
    <button class="knopf" type="button" data-si="import">${S('einlesen')}</button></div>
    <input class="si-datei" type="file" accept="application/json,.json" hidden>`;
  const stand = () => {
    const h = sicherungsHinweis();
    el.querySelector('.si-stand').textContent = h.text;
    const s = speicherStand();
    el.querySelector('.si-belegung').textContent = S('belegt', { kb: zahl(s.zeichen / 1024, { maximumFractionDigits: 1 }) });
  };
  const exportiere = async () => {
    try { await speichereDatei(dateiFuer(erstelleSicherung())); stand(); app.meldung(S('erstellt')); }
    catch (e) { if (e && e.name !== 'AbortError') app.meldung(S('erstellenFehler'), { art: 'fehler' }); }
  };
  const input = el.querySelector('.si-datei');
  el.querySelector('[data-si="export"]').addEventListener('click', exportiere);
  el.querySelector('[data-si="import"]').addEventListener('click', () => { input.value = ''; input.click(); });
  input.addEventListener('change', async () => {
    if (!input.files || !input.files[0]) return;
    try {
      const p = pruefeSicherung(await input.files[0].text());
      const v = p.vorschau;
      const ok = await app.frage({ titel: S('frageTitel'), text: S('frageText', { n: v.partien, datum: zeitText(v.datum), partien: v.partien, level: v.level, bots: v.bots }), knoepfe: [{ text: t('allgemein.abbrechen'), wert: false }, { text: S('einlesenKnopf'), wert: true, art: 'primaer' }], abbrechen: false });
      if (!ok) return;
      const rueckfall = dateiFuer(erstelleSicherung());
      await speichereDatei(rueckfall);
      uebernehmeSicherung(p);
      app.meldung(S('eingelesen'));
      setTimeout(() => location.reload(), 500);
    } catch (e) { app.meldung(e && e.message ? e.message : S('lesenFehler'), { art: 'fehler', dauer: 6000 }); }
  });
  stand();
  return el;
}

anbieten('einstellungen:gruppen', karte, { reihenfolge: 40, paket: 'sicherung' });
