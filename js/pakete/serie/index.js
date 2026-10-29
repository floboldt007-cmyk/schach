// Paket serie: Bauernmarsch (Tages-Serie, SPIELKONZEPT 3.14) und Siegeslauf (3.15), Paket P3 (frueher S1-4 und Schub 2b).
// Einstieg, den js/app.js per import() laedt (PAKETE in js/erweiterungen.js, im Testmodus ?test&erw=pakete/serie/index).
// Defensiv: ein Fehler hier stoppt nie die App oder die Partie (jeder Hoerer und Anbieter laeuft in try/catch).
//
// Logik: tag.js (Tageswerk, Serie, Bruecken, Kapitel, Bauernmarsch, Meilensteine, Kalender, Wochen-Ring, Pause; rein),
// lauf.js (Siegeslauf; rein), Speicher: stand.js (Modul serie, Einstellungen serie), Oberflaeche: ansicht.js,
// Optik: css/pakete/serie.css (nur Tokens).
//
// Hoert:   partie:beendet (Tageswerk Partie ab 10 eigenen Zuegen, Uebung, Siegeslauf), partie:gestartet (Uebung: welche Stelle),
//          uebung:ergebnis, training:geloest, raetsel:geloest, lektion:beendet (Tageswerk), app:bereit (Stand senden),
//          app:screen (Blatt schliessen), speicher:zurueckgesetzt (nur Arbeitsspeicher leeren, nie schreiben),
//          liga:geaendert (Arena-Wertung fuer den Siegeslauf), sobald das Paket Wertung das Ereignis eintraegt.
// Sendet:  tag:gezaehlt { tag, quelle, serie, kapitel } einmal je Tag beim ersten Tageswerk (bringt nie Funken),
//          serie:geaendert { tag, lauf, meilenstein, ruht, kapitel, rekord, gesamt, heute } nach jedem gezaehlten Tag, jeder
//          Aenderung am Siegeslauf und einmal nach app:bereit (tag = Schachtage in Serie wie "Tag 12", heute = Tagesschluessel).
// Orte:    arena:heute 10 (Bauernmarsch als Bild, was heute zaehlt, Umwandlung waehlen), arena:kopf 20 (Chip "Bauer 12", Flamme ab 3),
//          ergebnis:abrechnung 40 (Zeile "Tag 12 - Bauernmarsch" nur am ersten Werk des Tages, Siegeslauf), partie:spieler-leiste 30
//          (Flamme an Flos Namen ab 3 Siegen), einstellungen:gruppen 20 (Gruppe Bauernmarsch: anzeigen, streng, leise, Ruhetag).
// Feier:   umwandlung (gross 66, Klang umwandlung), meilenstein (gross 72, Plakette mit Zeitraum und Beweis, Klang siegel),
//          marsch (Zeile 50, nur fuer ein Tageswerk ausserhalb einer Partie: dort ist die Abrechnungszeile der Zaehl-Moment),
//          siegeslauf (Zeile 44 bei 3, 5, 10, 15). Nichts davon, wenn die Serie ausgeblendet ist.
// Register: Icons se-bauer, se-flamme, se-ring, se-mond, se-liege.
// Testmodus (?test): window.__serie = { stand(), speichere(st), einstellungen(), setzeUhr(ms | null), heute(), T, LA, S }.
import { EREIGNISSE, hoere, sende } from '../../ereignisse.js';
import { anbieten, angeboten } from '../../orte.js';
import { melde } from '../../feier.js';
import { botNachId } from '../../bots.js';
import { registriereIcon } from '../../ui/icons.js';
import { ladeFortschritt, hoechsteFreieStufe, ladePartien, eigeneZuege } from '../../storage.js';
import { tagSchluessel, addiereTage } from '../../tag.js';
import { klang } from '../../sounds.js';
import { t } from '../../sprache.js';
import './texte.js';
import * as T from './tag.js';
import * as LA from './lauf.js';
import * as S from './stand.js';
import * as A from './ansicht.js';
import { protokolliere } from '../../protokoll.js';

const PAKET = 'serie';
const TEST = typeof location !== 'undefined' && /[?&]test\b/.test(location.search || '');

// Uhr (Tests stellen sie, um Tage zu ueberspringen)
let uhrMs = null;
export function setzeUhr(ms) { uhrMs = Number.isFinite(ms) ? ms : null; }
const jetzt = () => (uhrMs != null ? new Date(uhrMs) : new Date());
const heute = () => tagSchluessel(jetzt());

function sicher(fn, wo) {
  try { return fn(); } catch (e) {
    try { console.error(`Paket serie (${wo || 'unbekannt'}):`, e); } catch (x) { /* egal */ }
    protokolliere('paket', e, { vorsatz: `Paket serie (${wo || 'unbekannt'})` });
    return null;
  }
}

// Zeitpunkt einer beendeten Partie: das Datum des Datensatzes (eine Partie um 3:59 zaehlt zum Vortag, auch wenn das
// Ereignis erst um 4:00 kommt); mit gestellter Uhr (Tests) die Uhr
function zeitVon(d) {
  if (uhrMs == null && d && typeof d.datum === 'string') {
    const t = Date.parse(d.datum);
    if (Number.isFinite(t)) return new Date(t);
  }
  return jetzt();
}

// ---------- Uebungen: welche Stelle wird geuebt (eine Uebung zaehlt einmal, egal ob uebung:ergebnis oder partie:beendet) ----------
const uebungen = new Map();   // laufId -> Schluessel
function uebungsSchluessel(ziel) {
  return ziel && typeof ziel.partieId === 'string' && Number.isInteger(ziel.ply) ? `${ziel.partieId}:${ziel.ply}` : null;
}

// ---------- Senden ----------
function sendeStand(st, { meilenstein = null } = {}) {
  const e = S.einstellungen();
  const lg = T.lage(st, heute(), e);
  sende('serie:geaendert', {
    tag: lg.art === 'neu' ? 0 : lg.aktuell, lauf: st.lauf.n, meilenstein, ruht: lg.art === 'ruht', kapitel: lg.kapitel,
    rekord: st.best, gesamt: st.gesamt, heute: heute(),
  });
}

// ---------- Feier ----------
// Absender der Briefe zu den Meilensteinen; der Text steht im Woerterbuch (p-serie.brief.<n>)
const BRIEFE = { 7: 'benno', 30: 'hilde', 100: 'rudi', 365: 'greta' };
function briefText(n) {
  const b = BRIEFE[n];
  if (!b) return null;
  const bot = botNachId(b);
  return t('p-serie.brief.post', { name: bot && bot.name ? bot.name : t('p-serie.brief.einemBot'), text: t('p-serie.brief.' + n) });
}

function beweisFuer(st, r) {
  if (!r.plakette) return null;
  if (r.meilenstein < T.BEWEIS_AB) return t('p-serie.zeitraum', { von: T.datumText(r.plakette.von), bis: T.datumText(r.plakette.bis) });
  const partien = sicher(() => ladePartien().map((p) => ({
    datum: p.datum, genauigkeit: p.genauigkeit, liveKlassen: p.liveKlassen, eigeneZuege: eigeneZuege(p), modus: p.modus,
  })), 'Beweis') || [];
  return T.beweis({ partien, von: r.plakette.von, bis: r.plakette.bis, tage: r.aktuell, z: st.kapitel ? st.kapitel.z : {} });
}

function feiern(st, r, partieId, einst) {
  if (!r || !einst.anzeigen) return;
  if (r.meilenstein) {
    melde({ partieId, quelle: 'meilenstein', titel: A.schachtage(r.meilenstein), text: beweisFuer(st, r), symbol: 'se-bauer', klang: 'siegel' });
  }
  if (r.umwandlungen.length) {
    const nr = r.umwandlungen[r.umwandlungen.length - 1];
    melde({ partieId, quelle: 'umwandlung', titel: t('p-serie.feier.umwandlung', { nr }),
      text: t('p-serie.feier.umwandlungText'), symbol: 'se-bauer', klang: 'umwandlung' });
  }
  // ausserhalb einer Partie (Raetsel, Kartei, Uebung, Lektion): eine Zeile fuer die Nachlese
  if (!partieId) {
    const text = (r.doppelschritt ? t('p-serie.doppelKurz') + ' ' : '') + A.bisText(T.FELDER - (st.felder % T.FELDER));
    melde({ partieId: null, quelle: 'marsch', titel: t('p-serie.feier.marsch', { n: r.aktuell }), text, symbol: 'se-bauer', klang: 'bauer' });
  }
}

function merkeHinweise(st, r) {
  const tag = r.tag;
  const neu = [];
  if (r.doppelschritt) neu.push({ tag, art: 'doppel', n: null });
  if (r.gesamtMeilenstein) neu.push({ tag, art: 'gesamt', n: r.gesamtMeilenstein });
  st.hinweise = [...st.hinweise.filter((h) => h.tag === tag), ...neu].slice(-3);
}

// Ein Tageswerk ist erfuellt: Tag zaehlen, Hinweise merken. -> Ergebnis von zaehleTag oder null
function zaehle(st, tag, quelle, zeit, einst) {
  const r = T.zaehleTag(st, tag, { quelle, einst, tz: zeit.getTimezoneOffset() });
  if (r) merkeHinweise(st, r);
  return r;
}

function nachZaehlen(st, r, { partieId = null, einst, meilensteinLauf = null } = {}) {
  if (r) {
    sende('tag:gezaehlt', { tag: r.tag, quelle: r.quelle, serie: r.aktuell, kapitel: r.kapitel });
    sicher(() => feiern(st, r, partieId, einst), 'Feier');
  }
  sendeStand(st, { meilenstein: r && r.meilenstein ? r.meilenstein : meilensteinLauf });
}

// ---------- Partie ----------
function laufKontext(st, d) {
  const f = ladeFortschritt();
  let hoechste = hoechsteFreieStufe(f);
  // diese Partie hat gerade einen Bot freigeschaltet: vorher war die Stufe davor die hoechste
  const neu = d && typeof d.neuFreigeschaltet === 'string' ? botNachId(d.neuFreigeschaltet) : null;
  if (neu && Number.isInteger(neu.stufe)) hoechste = Math.min(hoechste, neu.stufe - 1);
  const bot = d && typeof d.botId === 'string' ? botNachId(d.botId) : null;
  return {
    hoechsteStufe: hoechste, botStufe: bot && Number.isInteger(bot.stufe) ? bot.stufe : null,
    botElo: bot && Number.isFinite(bot.elo) ? bot.elo : null, wertung: st.w ? st.w.wert : null, wertungPartien: st.w ? st.w.n : 0,
  };
}

function partieBeendet(d) {
  if (!d || typeof d.partieId !== 'string') return;
  const st = S.lade();
  if (S.nurLesen(st) || st.ids.includes(d.partieId)) return;
  st.ids.push(d.partieId);
  const einst = S.einstellungen();
  const zeit = zeitVon(d);
  const tag = tagSchluessel(zeit);
  const uebung = (d.modus || 'normal') === 'uebung';
  let quelle = null;
  if (uebung) {
    const schluessel = uebungen.get(d.laufId) || 'p:' + d.partieId;
    quelle = T.aktivitaet(st, { tag, art: 'uebung', schluessel });
  } else if (Number(d.eigeneZuege) >= T.WERK.partieZuege) {
    quelle = T.aktivitaet(st, { tag, art: 'partie' });
  }
  const feldVorher = st.felder;
  const r = quelle ? zaehle(st, tag, quelle, zeit, einst) : null;
  if (uebung) T.zaehleEinheit(st, 'uebung');
  else if (Number(d.eigeneZuege) >= T.WERK.partieZuege) T.zaehleEinheit(st, 'partie');
  // Siegeslauf
  const lb = LA.buche(st.lauf, d, laufKontext(st, d));
  st.abr.push({
    id: d.partieId, t: r ? r.aktuell : null, fv: feldVorher, f: st.felder, u: r ? r.umwandlungen.length : 0, m: r ? r.meilenstein : null,
    d: r ? r.doppelschritt : false, l: lb.wirkung === 'sieg' ? lb.n : null, e: lb.endeBei, b: lb.best,
  });
  S.speichere(st);
  if (lb.meilenstein && einst.anzeigen) {
    sicher(() => melde({ partieId: d.partieId, quelle: 'siegeslauf', titel: t('p-serie.lauf.feierTitel', { n: lb.meilenstein }),
      text: t('p-serie.lauf.feierText', { lauf: A.laufText(lb.meilenstein) }), symbol: 'se-flamme' }), 'Siegeslauf');
  }
  if (r || lb.wirkung === 'sieg' || lb.wirkung === 'ende') nachZaehlen(st, r, { partieId: d.partieId, einst, meilensteinLauf: null });
}

// ---------- Lernen (Kartei, Uebung, Raetsel, Lektion) ----------
function lernen(art, schluessel) {
  const st = S.lade();
  if (S.nurLesen(st)) return;
  const einst = S.einstellungen();
  const zeit = jetzt();
  const tag = tagSchluessel(zeit);
  const quelle = T.aktivitaet(st, { tag, art, schluessel });
  const r = quelle ? zaehle(st, tag, quelle, zeit, einst) : null;
  T.zaehleEinheit(st, art);
  S.speichere(st);
  if (r) nachZaehlen(st, r, { partieId: null, einst });
}

// ---------- Oberflaeche ----------
function botName(id) {
  const b = botNachId(id);
  return b && b.name ? b.name : t('p-serie.gegner');
}

function heuteTexte(st, h, einst) {
  const aus = {};
  if (st.brief && st.brief.tag === h) aus.brief = briefText(st.brief.n);
  if (st.ms66 === h) aus.gewohnheit = t('p-serie.hinweis.gewohnheit');
  for (const x of st.hinweise.filter((y) => y.tag === h)) {
    if (x.art === 'doppel') aus.doppel = t('p-serie.hinweis.doppel');
    if (x.art === 'gesamt') aus.gesamt = t('p-serie.hinweis.gesamt', { wert: x.n });
  }
  return aus;
}

function anbieterHeute(k) {
  const einst = S.einstellungen();
  if (!einst.anzeigen) return null;
  const app = k && k.app;
  const baue = () => {
    const st = S.lade();
    const h = heute();
    const lg = T.lage(st, h, einst);
    return A.heuteZeile({
      lage: lg, st, einst, texte: heuteTexte(st, h, einst),
      training: sicher(() => angeboten('training:karten') > 0, 'Training') === true && !!app,
      beiTraining: () => sicher(() => app.gehe('training'), 'Training'),
      beiBlatt: () => sicher(zeigeBlatt, 'Blatt'),
      beiWahl: (f, block) => sicher(() => waehle(f, block, zeile), 'Wahl'),
      beiLeise: () => sicher(() => {
        S.speichereEinstellungen({ leise: true });
        const neu = baue();
        zeile.replaceChildren(...neu.childNodes);
      }, 'Leise'),
    });
  };
  const zeile = baue();
  function waehle(f, block, ziel) {
    const st = S.lade();
    if (S.nurLesen(st) || !T.waehleFigur(st, f)) return;
    S.speichere(st);
    try { klang.spiele('umwandlung'); } catch (x) { /* still */ }
    const neu = baue();
    ziel.replaceChildren(...neu.childNodes);
    A.umwandlungAnimation(ziel.querySelector('.se-streifen .ziel'));
  }
  return zeile;
}

function zeigeBlatt() {
  const baue = () => {
    const st = S.lade();
    const einst = S.einstellungen();
    const h = heute();
    return A.blattInhalt({
      st, lage: T.lage(st, h, einst), einst, heute: h, wochen: T.kalender(st, h, einst, 6), ring: T.ringStand(st, h, einst),
      pauseRest: T.pauseRest(st, h.slice(0, 4)), pauseAb: st.letzter === h ? 'morgen' : 'heute',
      beiRuhetag: (w) => sicher(() => { S.speichereEinstellungen({ ruhetag: w }); neu(); }, 'Ruhetag'),
      beiPause: (n) => sicher(() => {
        const s2 = S.lade();
        if (S.nurLesen(s2)) return;
        // ist heute schon gezaehlt, beginnt die Pause morgen (sonst waere ein Tag der Pause verschenkt)
        const h2 = heute();
        const r = T.pauseAnsagen(s2, h2, { ab: s2.letzter === h2 ? addiereTage(h2, 1) : h2, tage: n });
        if (r.ok) S.speichere(s2);
        neu();
      }, 'Pause'),
      beiPauseEnde: () => sicher(() => {
        const s2 = S.lade();
        if (S.nurLesen(s2)) return;
        T.pauseBeenden(s2, heute());
        S.speichere(s2);
        neu();
      }, 'Pause beenden'),
      beiWahl: (f) => sicher(() => {
        const s2 = S.lade();
        if (S.nurLesen(s2) || !T.waehleFigur(s2, f)) return;
        S.speichere(s2);
        try { klang.spiele('umwandlung'); } catch (x) { /* still */ }
        neu();
      }, 'Wahl'),
    });
  };
  const blatt = A.oeffneBlatt(baue(), { titel: t('p-serie.name') });
  function neu() { if (blatt && A.offenesBlatt() === blatt) blatt.ersetze(baue()); }
}

const gezeigt = new Set();   // Partien, deren Abrechnungszeile schon gelaufen ist (der Nachtrag rollt nicht neu)

function anbieterAbrechnung(k) {
  const id = k && k.erg && k.erg.partie ? k.erg.partie.id : null;
  if (!id || !S.einstellungen().anzeigen) return null;
  const e = S.lade().abr.find((x) => x.id === id);
  if (!e) return null;
  const z = A.abrechnungsZeile({ e, schonGezeigt: gezeigt.has(id), merke: () => gezeigt.add(id), stumm: () => grosserMoment(z && z.el) });
  if (!z) return null;
  // Antippen der Ergebnis-Karte zeigt sofort alles (wie die Huelle der Abrechnung); erst nach dem Einhaengen
  let karte = null;
  let weg = false;
  const tipp = () => z.beende();
  const uhr = setTimeout(() => {
    if (weg) return;
    karte = z.el.closest('.ergebnis-karte');
    if (karte) karte.addEventListener('click', tipp);
  }, 0);
  return {
    el: z.el,
    verlasse() {
      weg = true;
      clearTimeout(uhr);
      z.verlasse();
      if (karte) karte.removeEventListener('click', tipp);
    },
  };
}
// Steht der grosse Moment des Bauernmarschs (Umwandlung, Meilenstein) im Ergebnis, klingt er dort: die Zeile bleibt still
function grosserMoment(zeile) {
  const karte = zeile && zeile.closest ? zeile.closest('.ergebnis-karte') : null;
  return !!(karte && karte.querySelector('.erg-feier [data-quelle="umwandlung"], .erg-feier [data-quelle="meilenstein"]'));
}

function anbieterKopf() {
  const einst = S.einstellungen();
  if (!einst.anzeigen) return null;
  const st = S.lade();
  const h = heute();
  const lg = T.lage(st, h, einst);
  // erst ab dem ersten gezaehlten Tag (3.14 Anzeige)
  if (lg.art === 'neu') return null;
  return A.kopfChip({ lage: lg, lauf: st.lauf, ring: einst.leise ? T.ringStand(st, h, einst) : null, leise: einst.leise,
    beiTipp: () => sicher(zeigeBlatt, 'Blatt') });
}

function anbieterSpieler() {
  const einst = S.einstellungen();
  if (!einst.anzeigen) return null;
  const st = S.lade();
  return st.lauf.n >= LA.FLAMME_AB ? A.flamme({ n: st.lauf.n }) : null;
}

function anbieterEinstellungen() {
  return A.einstellungsGruppe({ einst: S.einstellungen(), beiAenderung: (teil) => sicher(() => S.speichereEinstellungen(teil), 'Einstellungen') });
}

// ---------- Registrieren ----------
function cssLaden() {
  if (typeof document === 'undefined' || document.querySelector('link[data-paket="serie"]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = new URL('../../../css/pakete/serie.css', import.meta.url).href;
  l.dataset.paket = PAKET;
  document.head.append(l);
}

const ICONS = {
  'se-bauer': '<path fill="currentColor" stroke="none" d="M12 3.2a3.3 3.3 0 0 0-2 5.9c-1.3.6-2.1 1.7-2.1 3h8.2c0-1.3-.8-2.4-2.1-3a3.3 3.3 0 0 0-2-5.9zM9.2 13.3c-.2 2.4-1.2 4.2-2.7 5.5h11c-1.5-1.3-2.5-3.1-2.7-5.5zM5.6 19.9h12.8v1.7H5.6z"/>',
  'se-flamme': '<path fill="currentColor" stroke="none" d="M12.9 2.6c.5 3.1-1.3 4.8-2.9 6.6-1.6 1.8-3.1 3.7-3.1 6.3a5.1 5.1 0 0 0 10.2 0c0-2.7-1.3-4.3-2.3-5.6-.3 1.4-.9 2.3-1.9 2.8.6-3-.3-6.6-1-10.1z"/>',
  'se-ring': '<circle cx="12" cy="12" r="7.6"/><circle cx="12" cy="12" r="3.3" fill="currentColor" stroke="none"/>',
  'se-mond': '<path d="M19 14.8A7.6 7.6 0 0 1 9.2 5a7.6 7.6 0 1 0 9.8 9.8z"/>',
  'se-liege': '<path d="M7 4.5l4.6 9.5H19M6 20l3.6-6M18 20l-2.6-6"/>',
};

function registriere() {
  cssLaden();
  for (const [n, svg] of Object.entries(ICONS)) registriereIcon(n, svg);

  hoere('app:bereit', () => sicher(() => sendeStand(S.lade()), 'app:bereit'));
  hoere('app:screen', () => sicher(() => A.schliesseBlatt(), 'app:screen'));
  hoere('speicher:zurueckgesetzt', () => sicher(() => { gezeigt.clear(); uebungen.clear(); A.schliesseBlatt(); }, 'zurueckgesetzt'));
  hoere('partie:gestartet', (d) => sicher(() => {
    if (!d || (d.modus || 'normal') !== 'uebung') return;
    const s = uebungsSchluessel(d.ziel);
    if (s && typeof d.laufId === 'string') {
      uebungen.set(d.laufId, s);
      if (uebungen.size > 20) uebungen.delete(uebungen.keys().next().value);
    }
  }, 'partie:gestartet'));
  hoere('partie:beendet', (d) => sicher(() => partieBeendet(d), 'partie:beendet'));
  hoere('uebung:ergebnis', (d) => sicher(() => {
    if (!d || typeof d.partieId !== 'string' || !Number.isInteger(d.ply)) return;
    lernen('uebung', `${d.partieId}:${d.ply}`);
  }, 'uebung:ergebnis'));
  // Karteikarte: nur mit eigenem Versuch (Loesung nur angesehen, ohne Zug: zaehlt nicht, blosses Oeffnen zaehlt nie)
  hoere('training:geloest', (d) => sicher(() => {
    if (!d || !(d.richtig === true || (Number.isInteger(d.versuch) && d.versuch > 0))) return;
    lernen('karte', null);
  }, 'training:geloest'));
  hoere('raetsel:geloest', (d) => sicher(() => {
    if (!d || d.id == null || !(d.richtig === true || (Number.isInteger(d.versuch) && d.versuch > 0))) return;
    lernen('raetsel', String(d.id));
  }, 'raetsel:geloest'));
  hoere('lektion:beendet', (d) => sicher(() => { if (d && d.id != null) lernen('lektion', String(d.id)); }, 'lektion:beendet'));
  // Arena-Wertung (Paket Wertung/Liga): sobald es das Ereignis gibt, misst der Siegeslauf "Augenhoehe" an ihr
  if (EREIGNISSE.includes('liga:geaendert')) {
    hoere('liga:geaendert', (d) => sicher(() => {
      const w = d && (typeof d.wertung === 'number' ? d.wertung : d.wertung && typeof d.wertung === 'object' ? d.wertung.wert : null);
      if (!Number.isFinite(w) || w < 0 || w > 4000) return;
      const n = d.wertung && typeof d.wertung === 'object' ? (Number.isInteger(d.wertung.n) ? d.wertung.n : d.wertung.partien) : d.partien;
      const st = S.lade();
      if (S.nurLesen(st)) return;
      st.w = { wert: Math.round(w), n: Number.isInteger(n) && n >= 0 ? n : 0 };
      S.speichere(st);
    }, 'liga:geaendert'));
  }

  anbieten('arena:heute', (k) => sicher(() => anbieterHeute(k), 'Heute'), { reihenfolge: 10, paket: PAKET });
  anbieten('arena:kopf', () => sicher(anbieterKopf, 'Kopf'), { reihenfolge: 20, paket: PAKET });
  anbieten('ergebnis:abrechnung', (k) => sicher(() => anbieterAbrechnung(k), 'Abrechnung'), { reihenfolge: 40, paket: PAKET });
  anbieten('partie:spieler-leiste', () => sicher(anbieterSpieler, 'Spieler-Leiste'), { reihenfolge: 30, paket: PAKET });
  anbieten('einstellungen:gruppen', () => sicher(anbieterEinstellungen, 'Einstellungen'), { reihenfolge: 20, paket: PAKET });

  if (TEST && typeof window !== 'undefined') {
    window.__serie = {
      stand: () => S.lade(), speichere: (st) => S.speichere(st), einstellungen: () => S.einstellungen(),
      setzeEinstellungen: (e) => S.speichereEinstellungen(e), setzeUhr, heute, T, LA, S,
    };
  }
}

sicher(registriere, 'Laden');
