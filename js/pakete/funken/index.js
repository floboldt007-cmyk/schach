// Paket funken: Funken und Level (SPIELKONZEPT 3.3, Paket S1-1). Einstieg, den js/app.js per import() laedt
// (PAKETE in js/erweiterungen.js, im Testmodus ?test&erw=pakete/funken/index). Defensiv: ein Fehler hier stoppt nie
// die App oder die Partie (jeder Hoerer und Anbieter laeuft in try/catch, die Busse fangen zusaetzlich).
//
// Rechnung: rechnung.js (rein), Level-Kurve und Belohnungen: level.js (rein), Speicher: stand.js (Modul funken),
// Oberflaeche: ansicht.js, Optik: css/pakete/funken.css (nur Tokens).
//
// Hoert:   partie:gestartet (Faktor festlegen, Lauf anlegen), zug:gespielt, hilfe:genutzt, zug:zurueckgenommen,
//          zug:bewertet, stellung:analysiert (Live-Daten der laufenden Partie), partie:beendet (Partie-Funken buchen,
//          VOR den Feier-Zeilen des Ergebnisses), partie:analysiert (Nachtrag: Stern 2, Genauigkeits-Lichtblick),
//          uebung:ergebnis, analyse:gesehen, training:geloest, lektion:beendet, raetsel:geloest (Lern-Funken),
//          boss:siegel, rekord:neu, bestmarke:neu (Meilensteine), tag:gezaehlt (nur Aktivitaet, nie Funken),
//          app:bereit, app:screen, app:sichtbar, speicher:zurueckgesetzt, spielplan:geladen (das Boss-Paket hat den
//          Spielplan geladen: erst dann liest funken ihn); liga:geaendert (Arena-Wertung als Lage fuer den Faktor), sobald
//          das Paket Wertung das Ereignis eintraegt (vorher wird es nicht abonniert).
// Sendet:  funken:gebucht { quelle, menge, gesamt, level } je Buchung, funken:geaendert { funken, level, delta,
//          aufstieg } einmal je Ereignis mit Buchungen, level:aufstieg { level, titel, neu } beim Aufstieg.
// Orte:    ergebnis:abrechnung 20 (Zeile FUNKEN), arena:kopf 5 (Chip Level), arena:heute 50 (Rueckenwind),
//          arena:panel-bot 30 (Faktor vor der Partie), verlauf:seite 5 (Karte Level und Funken),
//          partie:spieler-leiste 20 (Level-Emblem), spielplan:tage 20 (Funken-Wochenende), partie:begruessung? 40
//          (der Bot gruesst einmal das neue Level). Funkenlinie: buehne.platz('funkenlinie'), nur mit Anzeige an.
// Feier:   level (Zeile 55) bei jedem Aufstieg, level-titel (gross 75) bei jedem neuen Titel, Klang "level".
// Register: Icon "funke", Saetze "funken-level" fuer die 10 Leiter-Bots.
// Testmodus (?test): window.__funken = { stand(), speichere(st), plan(), setzePlan(p), S, R, L }.
import { EREIGNISSE, hoere, sende } from '../../ereignisse.js';
import { anbieten } from '../../orte.js';
import { melde } from '../../feier.js';
import { registriereSaetze, botNachId, staerkeFuerElo } from '../../bots.js';
import { registriereIcon } from '../../ui/icons.js';
import { ladePartien, wertet, eigeneZuege as eigeneZuegeVon } from '../../storage.js';
import { ladeSpielplan, funkenWochenendeAktiv, spielplanWoche } from '../../inhalte.js';
import { wochenSchluessel, wochentag, istSchluessel } from '../../tag.js';
import { klang } from '../../sounds.js';
import * as S from './stand.js';
import * as R from './rechnung.js';
import * as L from './level.js';
import * as A from './ansicht.js';

const PAKET = 'funken';
const TEST = typeof location !== 'undefined' && /[?&]test\b/.test(location.search || '');
const jetzt = () => new Date();

function sicher(fn, wo) {
  try { return fn(); } catch (e) {
    try { console.error(`Paket funken (${wo || 'unbekannt'}):`, e); } catch (x) { /* egal */ }
    return null;
  }
}

// ---------- Spielplan (Funken-Wochenende) ----------
// Der Spielplan gehoert zum Boss-Paket (S1-6, daten/boss/spielplan.json). funken fragt erst danach, wenn das Boss-Paket
// meldet, dass es ihn geladen hat (spielplan:geladen); ladeSpielplan() liefert ihn dann aus dem Zwischenspeicher von
// inhalte.js, ohne zweite Anfrage. Ein angemeldeter Boss allein reicht nicht: ein Boss ohne Spielplan-Datei (wie das
// Test-Paket in tests/app.test.mjs) ergaebe sonst einen 404 in der Konsole. Ohne Spielplan kein Funken-Wochenende.
// Kommt das Signal wieder (neuer Plan), liest funken ihn neu.
let plan = null;
let planLaeuft = false;
function planLaden() {
  if (planLaeuft) return;
  planLaeuft = true;
  ladeSpielplan().then((r) => { if (r && r.ok) plan = r.daten; }).catch(() => {}).then(() => { planLaeuft = false; });
}
function wochenende(t = jetzt()) {
  try { return !!plan && funkenWochenendeAktiv(plan, t); } catch (e) { return false; }
}
const ladeStand = (t = jetzt()) => S.lade(t, { plan });

// ---------- Hilfen ----------
function botNameVon(id) {
  const b = typeof id === 'string' ? botNachId(id) : null;
  return b && b.name ? b.name : 'den Bot';
}
// in Listen (Verlauf, Spiegel): unbekannte Gegner (z. B. ein Boss, dessen Paket fehlt) heissen neutral "Gegner"
function listenName(id) {
  const b = typeof id === 'string' ? botNachId(id) : null;
  return b && b.name ? b.name : 'Gegner';
}
function eloVon(p) {
  const b = p && botNachId(p.botId);
  return b && Number.isFinite(b.elo) ? b.elo : null;
}
function zuegeVon(p) {
  try { return eigeneZuegeVon(p); } catch (e) { return 0; }
}
// Faktor vor der Partie: Abstand = Bot-Staerke minus eigene Lage (Leistungswert der letzten 20 wertenden Partien,
// bis es die Arena-Wertung gibt), in den ersten 10 wertenden Partien x1
function faktorFuer({ botId, boss = null, ohne = null } = {}) {
  const partien = ladePartien().filter((p) => p && p.id !== ohne && wertet(p));
  // die Arena-Wertung des Pakets Wertung (liga:geaendert) geht vor, sonst der Leistungswert
  const lage = S.lageVon(ladeStand()) ?? R.lageAusPartien(partien, eloVon);
  const bot = typeof botId === 'string' ? botNachId(botId) : null;
  let elo = bot && Number.isFinite(bot.elo) ? bot.elo : null;
  if (boss && Number.isFinite(boss.staerke)) {
    const s = staerkeFuerElo(boss.staerke);
    if (s && Number.isFinite(s.elo)) elo = s.elo;
  }
  return R.faktorVon(elo != null && lage != null ? elo - lage : null, partien.length);
}
// Vergleichswerte fuer die Lichtblicke: bisherige Partien gegen diesen Gegner (ohne Uebungen)
function gegnerRef(botId, ohne = null) {
  const liste = ladePartien().filter((p) => p && p.botId === botId && p.id !== ohne && (p.modus || 'normal') !== 'uebung');
  let maxZuege = null;
  for (const p of liste) maxZuege = Math.max(maxZuege ?? 0, zuegeVon(p));
  const mitGenau = liste.find((p) => Number.isFinite(p.genauigkeit));
  return { partien: liste.length, maxZuege, letzteGenauigkeit: mitGenau ? mitGenau.genauigkeit : null };
}

// ---------- laufende Partie ----------
let lauf = null;        // { id, farbe, fa, fn, ab, ref, hilfe, z, bucht, g0 }
let linie = null;       // Funkenlinie der laufenden Partie
let speichernUhr = 0;
function speichereLauf() {
  clearTimeout(speichernUhr);
  speichernUhr = 0;
  if (!lauf) return;
  const st = ladeStand();
  st.lauf = lauf;
  S.speichere(st);
}
function spaeterSpeichern() {
  if (speichernUhr) return;
  speichernUhr = setTimeout(() => sicher(speichereLauf, 'Lauf speichern'), 0);
}
function passt(d) {
  return !!lauf && !!d && d.laufId === lauf.id;
}
function aktualisiereLinie() {
  if (!linie || !lauf) return;
  const zw = R.zugwerte(S.eigeneZuege(null, lauf));
  const st = ladeStand();
  const rw = wochenende() || st.rw.aktiv > 0 ? 2 : 1;
  const fs = L.fortschritt(st.gesamt);
  const schaetzung = (zw.zugwerte + zw.theorie) * (Number.isFinite(lauf.fa) ? lauf.fa : 1) * rw;
  linie.setze((fs.inLevel + schaetzung) / fs.kostet);
}

function starteLauf(d) {
  const st = ladeStand();
  // eine neue Partie hat gerade begruesst (partie:begruessung? kommt vor partie:gestartet)
  if (!d.fortgesetzt && st.gruss) st.gruss = false;
  const bucht = d.wertet === true || d.modus === 'boss';
  let l = st.lauf && st.lauf.id === d.laufId ? st.lauf : null;
  if (!l) {
    l = { id: d.laufId, farbe: d.farbe === 'b' ? 'b' : 'w', z: {}, hilfe: false, bucht };
    if (bucht) {
      const f = faktorFuer({ botId: d.botId, boss: d.boss });
      l.fa = f.faktor;
      l.fn = f.name;
      l.ab = f.abstand;
      l.ref = gegnerRef(d.botId);
    }
  }
  st.lauf = l;
  S.speichere(st);
  lauf = l;
  linie = null;
  const b = d.buehne;
  if (bucht && b && typeof b.zeigt === 'function' && b.zeigt('funkenlinie')) {
    linie = A.funkenlinie(b.platz('funkenlinie'));
    aktualisiereLinie();
  }
}

// ---------- Buchen ----------
function koennen(st) {
  const vorig = st.aufstiege[1] || null;
  return R.koennenSatz({
    partien: ladePartien().filter((p) => p && wertet(p)), seit: vorig ? vorig.t : null, levelVorher: vorig ? vorig.level : null,
  });
}

function feiern(auf, satz, partieId) {
  const stuecke = auf.neu.filter((s) => s.art !== 'titel');
  const neuText = stuecke.length
    ? 'Neu: ' + stuecke.slice(0, 2).map((s) => s.name).join(' · ') + (stuecke.length > 2 ? ` und ${stuecke.length - 2} mehr` : '')
    : '';
  if (auf.titel) {
    melde({ partieId, quelle: 'level-titel', titel: `LEVEL ${auf.nachher} · ${L.titelVon(auf.nachher)}`,
      text: satz ? satz.text : (neuText || null), symbol: 'funke', klang: 'level' });
    if (neuText) melde({ partieId, quelle: 'level', titel: neuText, symbol: 'funke' });
  } else {
    melde({ partieId, quelle: 'level', titel: `Level ${auf.nachher}${neuText ? ' · ' + neuText : ''}`,
      text: satz ? satz.text : null, symbol: 'funke', klang: 'level' });
  }
}

// Level-Feier einer Partie aus ihrem Verlaufseintrag (lv: Level vor und nach allen Buchungen dieser Partie). Je Partie
// genau eine Level-Feier; kommt die Spielanalyse noch (Stern 2, Lichtblick), wartet sie auf partie:analysiert, damit
// die Zeile das endgueltige Level nennt (sonst stuende "Level 2" ueber einer Abrechnung mit Level 3).
function partieFeier(st, e) {
  if (!e || e.lf || !Array.isArray(e.lv) || e.lv[1] <= e.lv[0]) return false;
  e.lf = true;
  e.lfOffen = false;
  const neu = [];
  let titel = null;
  for (let l = e.lv[0] + 1; l <= e.lv[1]; l++) {
    for (const x of L.belohnungen(l)) neu.push(x);
    if (L.istTitelLevel(l)) titel = L.titelVon(l);
  }
  const a = st.aufstiege[0];
  const satz = a && a.satz ? { text: a.satz } : null;
  sicher(() => feiern({ vorher: e.lv[0], nachher: e.lv[1], neu, titel }, satz, e.id), 'Feier');
  return true;
}

// Nach den Buchungen eines Ereignisses: Level nachziehen, speichern, Ereignisse senden, feiern.
// feier: 'jetzt' (Lern-Funken, Meilensteine: partieId null, also Nachlese ausserhalb des Ergebnisses), 'partie' (die
// Level-Feier dieser Partie sofort) oder 'spaeter' (die Analyse kommt noch: Feier mit partie:analysiert)
function nachBuchung(st, vorher, buchungen, { partieId = null, t = jetzt(), feier = 'jetzt' } = {}) {
  const auf = S.schliesseLevel(st, vorher, t);
  if (auf) {
    const satz = sicher(() => koennen(st), 'Koennen-Satz');
    if (satz) Object.assign(st.aufstiege[0], { satz: satz.text.slice(0, 160), herkunft: (satz.herkunft || '').slice(0, 160) });
  }
  const e = partieId ? st.verlauf.find((x) => x.id === partieId) : null;
  let feiernJetzt = false;
  if (auf && feier === 'jetzt') feiernJetzt = true;
  else if (e && feier === 'spaeter' && e.lv[1] > e.lv[0]) e.lfOffen = true;
  // erst speichern, dann senden und feiern (lf wird mitgespeichert)
  const partieFeiert = e && feier === 'partie' && !e.lf && e.lv[1] > e.lv[0];
  if (partieFeiert) e.lf = true;
  S.speichere(st);
  let delta = 0;
  for (const b of buchungen) {
    delta += b.menge;
    sende('funken:gebucht', { quelle: b.quelle, menge: b.menge, gesamt: st.gesamt, level: st.level });
  }
  sende('funken:geaendert', { funken: st.gesamt, level: st.level, delta, aufstieg: !!auf });
  if (auf) sende('level:aufstieg', { level: auf.nachher, titel: auf.titel, neu: auf.neu.map(({ art, id, name }) => ({ art, id, name })) });
  if (partieFeiert) {
    e.lf = false;
    partieFeier(st, e);
  } else if (feiernJetzt) {
    const a = st.aufstiege[0];
    sicher(() => feiern(auf, a && a.satz ? { text: a.satz } : null, null), 'Feier');
  }
  return auf;
}

let letztePartieId = null;

function partieBeendet(d) {
  if (!d || typeof d.partieId !== 'string') return;
  letztePartieId = d.partieId;
  const t = jetzt();
  const st = ladeStand(t);
  const vorher = st.level;
  let l = passt(d) ? lauf : (st.lauf && st.lauf.id === d.laufId ? st.lauf : null);
  const bucht = d.wertet === true || d.modus === 'boss';
  if (bucht && (!l || !Number.isFinite(l.fa))) {
    // Paket kam erst waehrend der Partie: Faktor jetzt (ohne diese, schon gespeicherte Partie)
    const f = faktorFuer({ botId: d.botId, boss: d.boss, ohne: d.partieId });
    l = { ...(l || { id: d.laufId, z: {} }), fa: f.faktor, fn: f.name, ab: f.abstand };
  }
  const gegner = l && l.ref ? l.ref : gegnerRef(d.botId, d.partieId);
  const res = S.buchePartie(st, d, { lauf: l, jetzt: t, wochenende: wochenende(t), botName: botNameVon(d.botId), gegner });
  if (passt(d)) { lauf = null; linie = null; }
  if (!res) { S.speichere(st); return; }
  // partie:analysiert kommt fuer jede wertende Partie und jede Boss-Partie mit eigenem Zug (sonst holt die Arena es nach)
  const analyseKommt = (d.wertet === true || d.modus === 'boss') && Number(d.eigeneZuege) > 0;
  nachBuchung(st, vorher, res.buchungen, { partieId: d.partieId, t, feier: analyseKommt ? 'spaeter' : 'partie' });
}

function partieAnalysiert(d) {
  if (!d || typeof d.partieId !== 'string') return;
  const t = jetzt();
  const st = ladeStand(t);
  const vorher = st.level;
  const res = S.nachtragPartie(st, d, { jetzt: t });
  if (!res) return;
  if (res.buchungen.length) nachBuchung(st, vorher, res.buchungen, { partieId: d.partieId, t, feier: 'partie' });
  else if (res.eintrag && res.eintrag.lfOffen && !res.eintrag.lf) {
    partieFeier(st, res.eintrag);
    S.speichere(st);
  }
}

function lernEreignis(fn, d, { partieId = null } = {}) {
  const t = jetzt();
  const st = ladeStand(t);
  const vorher = st.level;
  const b = fn(st, d, { wochenende: wochenende(t), woche: wochenSchluessel(t) });
  if (!b || !b.length) { S.speichere(st); return; }
  nachBuchung(st, vorher, b, { partieId, t });
}

// ---------- Oberflaeche ----------
function zeigeSpiegel() {
  const st = ladeStand();
  A.oeffneSpiegel(A.spiegelInhalt({ st, botName: listenName, wochenende: wochenende() }), { titel: 'Funken-Spiegel' });
}

const gezeigt = new Set();   // Partien, deren Abrechnungszeile schon gelaufen ist (der Nachtrag rollt nicht neu)

function anbieterAbrechnung(k) {
  const id = k && k.erg && k.erg.partie ? k.erg.partie.id : null;
  if (!id) return null;
  const e = ladeStand().verlauf.find((x) => x.id === id);
  if (!e) return null;
  const z = A.abrechnungsZeile({ eintrag: e, botName: botNameVon(e.bot), schonGezeigt: gezeigt.has(id), merke: () => gezeigt.add(id),
    feierKommt: !!e.lfOffen && !e.lf });
  // Antippen der Ergebnis-Karte zeigt sofort alles (wie die Huelle der Abrechnung); erst nach dem Einhaengen, und nie
  // mehr, wenn der Host die Zeile vorher schon wieder abgeraeumt hat
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

function anbieterHeute() {
  const st = ladeStand();
  const we = wochenende();
  const zuenden = (zeile) => sicher(() => {
    const s2 = ladeStand();
    if (!S.zuenden(s2)) return;
    S.speichere(s2);
    const neu = A.heuteZeile({ st: s2, wochenende: wochenende(), beiZuenden: zuenden });
    // die Zeile selbst bleibt (der Host raeumt sie beim Neuzeichnen ab), nur ihr Inhalt wechselt
    if (neu) zeile.replaceChildren(...neu.childNodes);
    A.zuendenAnimation(zeile);
    try { klang.spiele('feier', 2); } catch (x) { /* still */ }
  }, 'Zuenden');
  return A.heuteZeile({ st, wochenende: we, beiZuenden: zuenden });
}

function anbieterSpielplan(k) {
  if (!k || !k.plan || !istSchluessel(k.woche)) return null;
  const w = spielplanWoche(k.plan, k.woche);
  if (!w || w.funkenWochenende !== true) return null;
  // Freitag bis Sonntag (und Montag vor 4 Uhr gehoert noch zum Sonntag): Steckbrief-Zeile
  if (istSchluessel(k.tag) && wochentag(k.tag) < 4) return null;
  const z = document.createElement('p');
  z.className = 'fk-spielplan';
  z.dataset.paket = PAKET;
  z.textContent = 'Funken-Wochenende ab Freitag 16 Uhr: Partien und Lernen zählen doppelt. Wer nicht spielt, bekommt am Montag eine Rückenwind-Karte.';
  return z;
}

// ---------- Registrieren ----------
function cssLaden() {
  if (typeof document === 'undefined' || document.querySelector('link[data-paket="funken"]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = new URL('../../../css/pakete/funken.css', import.meta.url).href;
  l.dataset.paket = PAKET;
  document.head.append(l);
}

const GRUSS = {
  benno: ['Ein neues Level? Donnerwetter, dann zieh ich die Gummistiefel lieber wieder an.'],
  hilde: ['Du bist ja ein Level weiter! Dafür gibt es nachher ein extra Stück Kuchen.'],
  kalle: ['Ein Level hoch, Kollege? Dann geb ich heute noch mehr Gas!'],
  lisa: ['Level hoch? Stark! Dann wird mein Training heute richtig anstrengend.'],
  rudi: ['Fürwahr, Ihr seid aufgestiegen! Mein Ross scharrt schon unruhig mit den Hufen.'],
  turm: ['Ein neues Level. Ausgezeichnet, dann heben wir das Niveau der Vorlesung an.'],
  delia: ['Ein Level höher, Schätzchen? Dann gibt es heute das große Feuerwerk.'],
  koenig: ['Neues Level, notiert. Der Fall wird interessanter.'],
  greta: ['Ein neues Level. Gut. Dann wird es ja endlich spannend.'],
  stockfisch: ['Blubb. Ein neues Level. Ich rechne trotzdem dreißig Züge voraus.'],
};

function registriere() {
  cssLaden();
  registriereIcon('funke', '<path d="M12 3.2c.7 4.3 2.2 5.9 6.6 6.6-4.4.7-5.9 2.3-6.6 6.6-.7-4.3-2.2-5.9-6.6-6.6 4.4-.7 5.9-2.3 6.6-6.6z"/><path d="M18.6 15.6v4M16.6 17.6h4"/>');
  registriereSaetze('funken-level', GRUSS);

  hoere('app:bereit', () => sicher(() => S.speichere(ladeStand()), 'app:bereit'));
  hoere('spielplan:geladen', () => sicher(planLaden, 'spielplan:geladen'));
  hoere('app:screen', () => sicher(() => A.schliesseSpiegel(), 'app:screen'));
  hoere('app:sichtbar', (d) => sicher(() => { if (d && d.sichtbar === false && speichernUhr) speichereLauf(); }, 'app:sichtbar'));
  hoere('speicher:zurueckgesetzt', () => sicher(() => { lauf = null; linie = null; gezeigt.clear(); letztePartieId = null; }, 'zurueckgesetzt'));

  hoere('partie:gestartet', (d) => { setTimeout(() => sicher(() => starteLauf(d), 'partie:gestartet'), 0); });
  hoere('zug:gespielt', (d) => sicher(() => {
    if (!passt(d) || d.wer !== 'flo' || !lauf.hilfe) return;
    S.merkeHilfe(lauf, d.ply);
    lauf.hilfe = false;
    spaeterSpeichern();
  }, 'zug:gespielt'));
  hoere('hilfe:genutzt', (d) => sicher(() => { if (passt(d)) { lauf.hilfe = true; spaeterSpeichern(); } }, 'hilfe:genutzt'));
  hoere('zug:zurueckgenommen', (d) => sicher(() => {
    if (!passt(d)) return;
    S.vergissAb(lauf, d.bisPly);
    lauf.hilfe = true;
    spaeterSpeichern();
    aktualisiereLinie();
  }, 'zug:zurueckgenommen'));
  hoere('zug:bewertet', (d) => sicher(() => {
    if (!passt(d)) return;
    S.merkeZug(lauf, d);
    spaeterSpeichern();
    aktualisiereLinie();
  }, 'zug:bewertet'));
  hoere('stellung:analysiert', (d) => sicher(() => {
    if (!passt(d) || d.amZug !== 'bot' || !Number.isInteger(d.plies) || !d.analyse || !Array.isArray(d.analyse.lines)) return;
    const ev = d.analyse.lines[0] && d.analyse.lines[0].eval;
    if (!ev || ev.mate == null) return;
    const m = lauf.farbe === 'b' ? -ev.mate : ev.mate;
    S.merkeMatt(lauf, d.plies - 1, m > 0 ? m : null);
    spaeterSpeichern();
  }, 'stellung:analysiert'));
  hoere('partie:beendet', (d) => sicher(() => partieBeendet(d), 'partie:beendet'));
  hoere('partie:analysiert', (d) => sicher(() => partieAnalysiert(d), 'partie:analysiert'));
  hoere('partie:verlassen', (d) => sicher(() => { if (passt(d) && speichernUhr) speichereLauf(); }, 'partie:verlassen'));

  // Tabelle B und C
  hoere('uebung:ergebnis', (d) => sicher(() => lernEreignis(S.lernUebung, d), 'uebung:ergebnis'));
  hoere('analyse:gesehen', (d) => sicher(() => { if (d && d.moment) lernEreignis(S.lernMoment, d); }, 'analyse:gesehen'));
  hoere('training:geloest', (d) => sicher(() => { if (d && d.richtig === true) lernEreignis(S.lernKarte, d); }, 'training:geloest'));
  hoere('lektion:beendet', (d) => sicher(() => lernEreignis(S.lernLektion, d), 'lektion:beendet'));
  hoere('raetsel:geloest', (d) => sicher(() => lernEreignis(S.lernRaetsel, d), 'raetsel:geloest'));
  hoere('boss:siegel', (d) => sicher(() => lernEreignis((st) => S.siegel(st, d), d), 'boss:siegel'));
  hoere('rekord:neu', (d) => sicher(() => lernEreignis((st) => S.rekord(st, d, letztePartieId), d, { partieId: letztePartieId }), 'rekord:neu'));
  hoere('bestmarke:neu', (d) => sicher(() => lernEreignis((st) => S.rekord(st, d, d && d.partieId), d, { partieId: d && d.partieId }), 'bestmarke:neu'));
  // Arena-Wertung (Paket Wertung/Liga, P4): sobald es das Ereignis gibt, ersetzt sie den Leistungswert als Lage
  if (EREIGNISSE.includes('liga:geaendert')) {
    hoere('liga:geaendert', (d) => sicher(() => {
      const st = ladeStand();
      if (S.setzeLage(st, d)) S.speichere(st);
    }, 'liga:geaendert'));
  }
  // Tageswerk zaehlt als Aktivitaet ("Willkommen zurueck"), bringt aber nie Funken (Fairness 5.3)
  hoere('tag:gezaehlt', (d) => sicher(() => {
    if (!d || !istSchluessel(d.tag)) return;
    const st = ladeStand();
    st.rw.letzterTag = d.tag;
    S.speichere(st);
  }, 'tag:gezaehlt'));

  anbieten('ergebnis:abrechnung', (k) => sicher(() => anbieterAbrechnung(k), 'Abrechnung'), { reihenfolge: 20, paket: PAKET });
  anbieten('arena:kopf', () => sicher(() => A.kopfChip({ st: ladeStand(), beiTipp: () => sicher(zeigeSpiegel, 'Spiegel') }), 'Kopf'),
    { reihenfolge: 5, paket: PAKET });
  anbieten('arena:heute', () => sicher(anbieterHeute, 'Heute'), { reihenfolge: 50, paket: PAKET });
  anbieten('arena:panel-bot', (k) => sicher(() => {
    if (!k || !k.bot || k.bot.stufe == null) return null;
    return A.faktorChip(faktorFuer({ botId: k.bot.id }));
  }, 'Panel'), { reihenfolge: 30, paket: PAKET });
  anbieten('verlauf:seite', () => sicher(() => A.verlaufKarte({ st: ladeStand(), botName: listenName, beiMehr: () => sicher(zeigeSpiegel, 'Spiegel') }), 'Verlauf'),
    { reihenfolge: 5, paket: PAKET });
  anbieten('partie:spieler-leiste', () => sicher(() => A.spielerEmblem({ st: ladeStand() }), 'Spieler-Leiste'), { reihenfolge: 20, paket: PAKET });
  anbieten('spielplan:tage', (k) => sicher(() => anbieterSpielplan(k), 'Spielplan'), { reihenfolge: 20, paket: PAKET });
  anbieten('partie:begruessung?', (k) => sicher(() => {
    if (!k || !k.bot || k.bot.stufe == null || !GRUSS[k.bot.id] || (k.modus && k.modus !== 'normal')) return null;
    return ladeStand().gruss ? { anlass: 'funken-level' } : null;
  }, 'Begruessung'), { reihenfolge: 40, paket: PAKET });

  if (TEST && typeof window !== 'undefined') {
    window.__funken = {
      stand: () => ladeStand(), speichere: (st) => S.speichere(st), plan: () => plan,
      setzePlan: (p) => { plan = p; }, S, R, L,
    };
  }
}

sicher(registriere, 'Laden');
