// Paket punkte: Punkte, Abrechnung und Bestenliste (SPIELKONZEPT 3.2, 3.10, 3.13, 3.17; Paket S1-3). Einstieg, den
// js/app.js per import() laedt (PAKETE in js/erweiterungen.js, im Testmodus ?test&erw=pakete/punkte/index). Defensiv: ein
// Fehler hier stoppt nie die App oder die Partie (jeder Hoerer und Anbieter laeuft in try/catch, die Busse fangen auch).
//
// Rechnung: formel.js (rein), Tafeln: tafel.js (rein), Codes: code.js (rein), Speicher: stand.js (Modul punkte),
// Oberflaeche: ansicht.js (Abrechnung), liste.js (Reiter der Bestenliste), Screen js/ui/bestenliste.js, Optik
// css/pakete/punkte.css (nur Tokens).
//
// Hoert:   partie:gestartet, hilfe:genutzt, zug:gespielt, zug:zurueckgenommen (Zuege nach Hilfe zaehlen 0 und belegen keinen
//          Platz), partie:beendet (merkt sie bis zur Analyse), partie:analysiert (Tafelwert aus der Spielanalyse, Eintrag auf
//          der Tafel, synchron vor dem Nachtrag des Ergebnisses; zweimal je Partie ist harmlos), funken:geaendert (Level
//          fuer die Spielerkarte), app:bereit (einmaliger Umzug der gespeicherten Analysen), speicher:zurueckgesetzt.
// Sendet:  punkte:geaendert { punkte, platz, tafel, rekord } je bewerteter Partie; rekord:neu { tafel, wert, vorher, platz,
//          fenster: 'allzeit', partieId } bei einem neuen eigenen Allzeit-Rekord auf einer Tafel.
// Orte:    ergebnis:abrechnung 10 (Zeile PUNKTE), bestenliste:reiter Ich 10, Bots 20, Freunde 50.
// Feier:   bot-rekord (gross 78) "Platz 1 auf ... Tafel", wenn dabei Gaeste hinter dir landen; tafel-rekord (gross 70, eigene
//          Quelle wie "Eigener Allzeit-Rekord" in 3.13) bei einem neuen Rekord, ist das grosse Budget dieser Partie schon
//          vergeben, als Zeile rekord (58); rekord (Zeile 58) "Platz 4 auf Rudis Tafel ▲ 2" beim Ueberholen. Klang "rekord".
// Register: Icon "code".
// Testmodus (?test): window.__punkte = { stand(), speichere(st), S, T, C, F }.
import { hoere, sende } from '../../ereignisse.js';
import { anbieten } from '../../orte.js';
import { melde } from '../../feier.js';
import { botNachId, staerkeFuerElo } from '../../bots.js';
import { registriereIcon } from '../../ui/icons.js';
import { ladeModul, ladePartie, ladePartien, ladeReview, hatReview, ladeEinstellungen } from '../../storage.js';
import { tagSchluessel } from '../../tag.js';
import { freischalten } from '../../ui/bestenliste.js';
import * as S from './stand.js';
import * as T from './tafel.js';
import * as C from './code.js';
import * as F from './formel.js';
import * as A from './ansicht.js';
import * as B from './liste.js';

const PAKET = 'punkte';
const TEST = typeof location !== 'undefined' && /[?&]test\b/.test(location.search || '');
const UMZUG_MAX = 12;

function sicher(fn, wo) {
  try { return fn(); } catch (e) {
    try { console.error(`Paket punkte (${wo || 'unbekannt'}):`, e); } catch (x) { /* egal */ }
    return null;
  }
}

// ---------- laufende Partie: Zuege nach Hinweis oder Zuruecknehmen ----------
let hilfeOffen = null;
function lauf(fn) {
  const st = S.lade();
  if (fn(st) !== false) S.speichere(st);
}

// ---------- Bewerten ----------
function bossElo(p) {
  if (!p || !p.boss) return null;
  if (Number.isFinite(p.boss.staerke)) {
    const s = staerkeFuerElo(p.boss.staerke);
    if (s && Number.isFinite(s.elo)) return s.elo;
  }
  const b = botNachId(p.boss.id);
  return b && Number.isFinite(b.elo) ? b.elo : null;
}

function nachweisFuer(p, tafelId) {
  const z = T.zerlegeId(tafelId);
  if (!p || !z) return null;
  const bot = botNachId(p.botId);
  const r = C.erzeugeCode({
    art: z.art === 'boss' ? 'boss' : 'partie', botId: p.botId, farbe: p.spielerFarbe, stufe: z.stufe, ergebnis: p.ergebnis,
    seed: Number.isInteger(p.seed) ? p.seed : 0, tag: tagSchluessel(Date.parse(p.datum) || Date.now()), tiefe: ladeEinstellungen().tiefe,
    staerke: p.boss && p.boss.staerke, zuege: p.zuege, startFen: p.startFen || (bot && bot.startFen) || C.GRUNDSTELLUNG, stand: S.STAND,
  });
  return r.ok ? r.roh : null;
}

// Nachweis (SA1-Code) erst nach der Partie und ausserhalb des Hoerers (chess.js spielt jeden Zug nach, einige Millisekunden)
function nachweisSpaeter(partieId, tafelId) {
  setTimeout(() => sicher(() => {
    const st = S.lade();
    const t = st.tafeln[tafelId];
    const e = t && t.eintraege.slice(0, T.EIGENE_SICHTBAR).find((x) => x.id === partieId);
    if (!e || e.n) return;
    const n = nachweisFuer(ladePartie(partieId), tafelId);
    if (!n) return;
    e.n = n;
    const r = st.rekorde.find((x) => x.id === partieId);
    if (r && !r.n) r.n = n;
    S.speichere(st);
  }, 'Nachweis'), 0);
}

// Ist der eine grosse Moment dieser Partie schon vergeben (gleiche oder hoehere Prioritaet)? Liest nur die
// Feier-Warteschlange (js/feier.js speichert sie im Modul feier), schreibt nie hinein.
function grossFrei(partieId, prio) {
  const f = ladeModul('feier', { eintraege: [] });
  const l = f && Array.isArray(f.eintraege) ? f.eintraege : [];
  return !l.some((x) => x && x.partieId === partieId && x.art === 'gross' && x.status !== 'nachlese' && Number(x.prio) >= prio);
}

function feiern(e) {
  if (!e || !e.tafel) return;
  const name = A.tafelName(e.tafel, botNachId);
  const gross = name.toLocaleUpperCase('de-DE');
  if (e.platz1) {
    if (grossFrei(e.id, 78)) {
      melde({ partieId: e.id, quelle: 'bot-rekord', titel: `PLATZ 1 AUF ${gross}`,
        text: `${A.zahlText(e.w)} Punkte, vor ${e.ueberholt.join(', ') || 'allen Gästen'}`, symbol: 'podest', klang: 'rekord' });
    } else {
      melde({ partieId: e.id, quelle: 'rekord', titel: `Platz 1 auf ${name}${e.aufstieg ? ` ▲ ${e.aufstieg}` : ''}`, symbol: 'podest' });
    }
    return;
  }
  if (e.rekord) {
    const text = `${A.zahlText(e.w)} Punkte, vorher ${A.zahlText(e.vorher)} (+${A.zahlText(e.w - e.vorher)})`;
    if (grossFrei(e.id, 70)) {
      melde({ partieId: e.id, quelle: 'tafel-rekord', art: 'gross', prio: 70, titel: `NEUER REKORD AUF ${gross}`, text, symbol: 'podest', klang: 'rekord' });
    } else {
      melde({ partieId: e.id, quelle: 'rekord', titel: `Rekord auf ${name}: ${A.zahlText(e.w)}`, text: `vorher ${A.zahlText(e.vorher)}`, symbol: 'podest' });
    }
    return;
  }
  if (e.aufstieg > 0 && e.platz != null) {
    melde({ partieId: e.id, quelle: 'rekord', titel: `Platz ${e.platz} auf ${name} ▲ ${e.aufstieg}`, text: `vorher Platz ${e.platzVorher}`, symbol: 'podest' });
  }
}

function senden(e) {
  sende('punkte:geaendert', { punkte: e.w, platz: e.platz, tafel: e.tafel, rekord: !!e.rekord });
  if (e.rekord) sende('rekord:neu', { tafel: e.tafel, wert: e.w, vorher: e.vorher, platz: e.platz, fenster: 'allzeit', partieId: e.id });
}

function partieAnalysiert(d) {
  if (!d || typeof d.partieId !== 'string') return;
  const st = S.lade();
  if (st.ids.includes(d.partieId)) return;
  const e = S.bewerte(st, d, { jetzt: new Date(), bossElo: bossElo(d.partie) });
  S.speichere(st);
  if (!e) return;
  senden(e);
  if (e.tafel && (e.sichtbar || e.rekord)) nachweisSpaeter(e.id, e.tafel);
  // nach den anderen Hoerern dieses Ereignisses (Funken meldet seine Level-Feier synchron), aber vor dem Nachtrag des
  // Ergebnisses (der kommt erst nach dem Ende des Ereignisses ueber ein await): so sieht grossFrei() deren grosse Momente
  queueMicrotask(() => sicher(() => feiern(e), 'Feier'));
}

// Umzug bestehender Spielstaende (SPIELKONZEPT 6.3): einmal beim ersten Start die gespeicherten Analysen (bis zu 12)
// bewerten; sie werden die ersten eigenen Eintraege. Still: keine Feier, keine Ereignisse.
function umzug() {
  const st = S.lade();
  if (st.umzug) return;
  const kandidaten = ladePartien().filter((p) => p && hatReview(p.id) && !st.ids.includes(p.id)).slice(0, UMZUG_MAX).reverse();
  const tafeln = new Set();
  for (const p of kandidaten) {
    const review = ladeReview(p.id);
    if (!review) continue;
    const e = sicher(() => S.bewerte(st, { partieId: p.id, botId: p.botId, modus: p.modus || 'normal', partie: p, review },
      { jetzt: new Date(), bossElo: bossElo(p), nachHilfe: [] }), 'Umzug');
    if (e && e.tafel) tafeln.add(e.tafel);
  }
  st.umzug = true;
  st.neu = [];
  S.speichere(st);
  for (const id of tafeln) {
    const t = st.tafeln[id];
    if (t) for (const e of t.eintraege.slice(0, T.EIGENE_SICHTBAR)) nachweisSpaeter(e.id, id);
  }
}

// ---------- Oberflaeche ----------
const gezeigt = new Set();   // Partien, deren Abrechnungszeile schon gelaufen ist (der Nachtrag rollt nicht neu)

function miniTafel(e) {
  if (!e.tafel || !(e.aufstieg > 0)) return null;
  const st = S.lade();
  const t = st.tafeln[e.tafel];
  if (!t) return null;
  const zeilen = T.zeilen(t, { fenster: 'allzeit', gaeste: S.gaeste(st, e.tafel) });
  const i = zeilen.findIndex((r) => r.eigen && r.id === e.id);
  if (i < 0) return null;
  const aus = [];
  if (zeilen[i - 1]) aus.push({ ...zeilen[i - 1], rolle: 'ueber', name: zeilen[i - 1].eigen ? 'Du' : zeilen[i - 1].name });
  aus.push({ ...zeilen[i], rolle: 'ich', name: 'Du', eigen: true });
  if (zeilen[i + 1]) aus.push({ ...zeilen[i + 1], rolle: 'unter', name: zeilen[i + 1].eigen ? 'Du' : zeilen[i + 1].name, eigen: false });
  return aus;
}

function anbieterAbrechnung(k) {
  const p = k && k.erg && k.erg.partie ? k.erg.partie : null;
  if (!p || typeof p.id !== 'string') return null;
  if ((k.modus || p.modus) === 'uebung') return null;
  const e = S.ergebnisVon(S.lade(), p.id);
  if (!e) {
    // die Analyse rechnet noch: ruhiger Schimmer; ohne Analyse (fehlgeschlagen): die Arena holt sie nach
    if (k.rechnet) return A.wartezeile();
    return A.wartezeile({ fehlt: true });
  }
  const z = A.abrechnungsZeile({
    ergebnis: e, tafelName: e.tafel ? A.tafelName(e.tafel, botNachId) : 'Tafel', schonGezeigt: gezeigt.has(p.id), merke: () => gezeigt.add(p.id),
    mini: sicher(() => miniTafel(e), 'Mini-Tafel'),
    beiListe: e.tafel && k.app && typeof k.app.gehe === 'function' ? () => { B.merkeEinstellung({ tafel: e.tafel, reiter: 'bots' }); k.app.gehe('bestenliste', { reiter: 'bots' }); } : null,
  });
  // Antippen der Ergebnis-Karte zeigt sofort alles (wie die Huelle der Abrechnung), erst nach dem Einhaengen
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

function anbieterReiter(id, name, baue) {
  return (k) => sicher(() => {
    if (!k || k.reiter !== id) return B.huelle(id, name);
    return baue({ app: k.app, fenster: k.fenster || 'woche', jetzt: new Date() });
  }, 'Reiter ' + id);
}

// ---------- Registrieren ----------
function cssLaden() {
  if (typeof document === 'undefined' || document.querySelector('link[data-paket="punkte"]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = new URL('../../../css/pakete/punkte.css', import.meta.url).href;
  l.dataset.paket = PAKET;
  document.head.append(l);
}

function registriere() {
  cssLaden();
  freischalten();
  registriereIcon('code', '<path d="M8.5 7.5 4 12l4.5 4.5M15.5 7.5 20 12l-4.5 4.5M13.5 5.5l-3 13"/>');

  hoere('app:bereit', () => { setTimeout(() => sicher(umzug, 'Umzug'), 1200); });
  hoere('speicher:zurueckgesetzt', () => sicher(() => { gezeigt.clear(); }, 'zurueckgesetzt'));
  // der Modul-Speicher wird nur bei Hilfe gelesen: der naechste eigene Zug nach einem Hinweis oder Zuruecknehmen
  // (hilfeOffen merkt sich die laufId, damit nicht jeder Zug den Speicher liest)
  hoere('partie:gestartet', (d) => sicher(() => {
    if (!d || !d.laufId) return;
    lauf((st) => {
      S.merkeLauf(st, d.laufId, { fortgesetzt: !!d.fortgesetzt });
      hilfeOffen = st.lauf && st.lauf.hilfe ? d.laufId : null;
    });
  }, 'partie:gestartet'));
  hoere('hilfe:genutzt', (d) => sicher(() => {
    if (!d || !d.laufId) return;
    hilfeOffen = d.laufId;
    lauf((st) => S.merkeHilfe(st, d.laufId));
  }, 'hilfe:genutzt'));
  hoere('zug:gespielt', (d) => sicher(() => {
    if (!d || d.wer !== 'flo' || hilfeOffen !== d.laufId) return;
    hilfeOffen = null;
    lauf((st) => S.merkeZug(st, d.laufId, d.ply));
  }, 'zug:gespielt'));
  hoere('zug:zurueckgenommen', (d) => sicher(() => {
    if (!d || !d.laufId) return;
    hilfeOffen = d.laufId;
    lauf((st) => S.vergissAb(st, d.laufId, d.bisPly));
  }, 'zug:zurueckgenommen'));
  hoere('partie:beendet', (d) => sicher(() => { if (d && d.partieId) lauf((st) => S.beende(st, d.laufId, d.partieId)); }, 'partie:beendet'));
  hoere('partie:analysiert', (d) => sicher(() => partieAnalysiert(d), 'partie:analysiert'));
  hoere('funken:geaendert', (d) => sicher(() => {
    if (!d || !Number.isInteger(d.level)) return;
    lauf((st) => { if (st.level === d.level) return false; st.level = d.level; return true; });
  }, 'funken:geaendert'));

  anbieten('ergebnis:abrechnung', (k) => sicher(() => anbieterAbrechnung(k), 'Abrechnung'), { reihenfolge: 10, paket: PAKET });
  anbieten('bestenliste:reiter', anbieterReiter('ich', 'Ich', B.reiterIch), { reihenfolge: 10, paket: PAKET });
  anbieten('bestenliste:reiter', anbieterReiter('bots', 'Bots', B.reiterBots), { reihenfolge: 20, paket: PAKET });
  anbieten('bestenliste:reiter', anbieterReiter('freunde', 'Freunde', B.reiterFreunde), { reihenfolge: 50, paket: PAKET });

  if (TEST && typeof window !== 'undefined') {
    window.__punkte = { stand: () => S.lade(), speichere: (st) => S.speichere(st), umzug, S, T, C, F };
  }
}

sicher(registriere, 'Laden');
