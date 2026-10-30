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
//          fuer die Spielerkarte), app:bereit (vorlaeufige Bot-Laeufe laden, einmaliger Umzug der gespeicherten Analysen),
//          speicher:zurueckgesetzt.
// Sendet:  punkte:geaendert { punkte, platz, tafel, rekord } je bewerteter Partie; rekord:neu { tafel, wert, vorher, platz,
//          fenster: 'allzeit', partieId } bei einem neuen eigenen Allzeit-Rekord auf einer Tafel.
// Orte:    ergebnis:abrechnung 10 (Zeile PUNKTE), bestenliste:reiter Ich 10, Bots 20, Freunde 50, arena:panel-bot 40
//          (Tafel des gewaehlten Bots mit Bestwert, Antippen oeffnet sie).
// Feier:   bot-rekord (gross 78) "Platz 1 auf ... Tafel", wenn dabei Gaeste hinter dir landen (stand vorher ein Bot-Lauf
//          vorn, sagt dieser Bot einen Satz, 3.13); tafel-rekord (gross 70, eigene Quelle wie "Eigener Allzeit-Rekord" in
//          3.13) bei einem neuen Rekord. Ist der grosse Platz dieser Partie schon belegt (ein grosser Moment, den das
//          Ergebnis schon zeigt, egal mit welcher Prioritaet, oder ein wartender mit gleicher oder hoeherer), kommt der
//          Moment als Zeile rekord (58): mit Ueberholen "Platz 4 auf Thorstens Tafel ^ 2" (vorher Platz 6), sonst "Rekord auf
//          Thorstens Tafel: 23.100". Klang "rekord" genau einmal: zeigt das Ergebnis den grossen Moment (der klingt dort), bleibt
//          die Abrechnungszeile still. Erster Eintrag, Wochen- und Monatsbeste und "so nah wie noch nie": keine Feier.
// Inhalte: daten/punkte/bot-laeufe.json (art 'bot-laeufe', format 1; werkzeuge/nachbar-laeufe.mjs): vorlaeufige Bot-
//          Laeufe der Nachbar-Bots als Gaeste auf den Tafeln (3.13 "Schon in S1 nicht leer"), nur mit dem Rechenstand der
//          Formel. Fehlt die Datei, stehen nur Freunde auf den Tafeln.
// Register: Icon "code", Saetze "tafel-platz1" (der Bot, den du von Platz 1 verdraengt hast).
// Testmodus (?test): window.__punkte = { stand(), speichere(st), umzug, ladeBotLaeufe, fastZeigen, S, T, C, F }.
import { hoere, sende } from '../../ereignisse.js';
import { anbieten } from '../../orte.js';
import { melde } from '../../feier.js';
import { botNachId, staerkeFuerElo, registriereSaetze, botSatz } from '../../bots.js';
import { registriereInhaltsart, ladeInhalt } from '../../inhalte.js';
import { registriereIcon } from '../../ui/icons.js';
import { ladeModul, ladePartie, ladePartien, ladeReview, hatReview, ladeEinstellungen, eigeneZuege } from '../../storage.js';
import { tagSchluessel } from '../../tag.js';
import { freischalten } from '../../ui/bestenliste.js';
import * as FK from './freunde.js';
import { t, locale, texte } from '../../sprache.js';
import './texte.js';
import * as S from './stand.js';
import * as T from './tafel.js';
import * as C from './code.js';
import * as F from './formel.js';
import * as A from './ansicht.js';
import * as B from './liste.js';
import { protokolliere } from '../../protokoll.js';

const PAKET = 'punkte';
const TEST = typeof location !== 'undefined' && /[?&]test\b/.test(location.search || '');
const UMZUG_MAX = 12;

function sicher(fn, wo) {
  try { return fn(); } catch (e) {
    try { console.error(`Paket punkte (${wo || 'unbekannt'}):`, e); } catch (x) { /* egal */ }
    protokolliere('paket', e, { vorsatz: `Paket punkte (${wo || 'unbekannt'})` });
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
    const tf = st.tafeln[tafelId];
    const e = tf && tf.eintraege.slice(0, T.EIGENE_SICHTBAR).find((x) => x.id === partieId);
    if (!e || e.n) return;
    const n = nachweisFuer(ladePartie(partieId), tafelId);
    if (!n) return;
    e.n = n;
    const r = st.rekorde.find((x) => x.id === partieId);
    if (r && !r.n) r.n = n;
    S.speichere(st);
  }, 'Nachweis'), 0);
}

// Feier-Warteschlange dieser Partie, nur lesend (js/feier.js speichert sie im Modul feier; punkte schreibt nie hinein)
function feierEintraege(partieId) {
  const f = ladeModul('feier', { eintraege: [] });
  const l = f && Array.isArray(f.eintraege) ? f.eintraege : [];
  return l.filter((x) => x && typeof x === 'object' && x.partieId === partieId);
}

// Ist der eine grosse Platz dieser Partie noch frei? Belegt ist er, wenn das Ergebnis schon einen grossen Moment zeigt
// (status 'overlay', egal mit welcher Prioritaet: feier.fuerOverlay vergibt den Platz kein zweites Mal), oder wenn ein
// wartender grosser Moment mindestens so wichtig ist (der verdraengt uns ohnehin). Ein wartender kleinerer weicht uns.
function grossFrei(partieId, prio) {
  return !feierEintraege(partieId).some((x) => x.art === 'gross'
    && (x.status === 'overlay' || (x.status !== 'nachlese' && Number(x.prio) >= prio)));
}

// Zeigt das Ergebnis den grossen Moment von punkte (mit Klang)? Dann klingt "rekord" dort, die Abrechnungszeile schweigt.
const EIGENE_GROSSE = ['tafel-rekord', 'bot-rekord'];
function feierKlingt(partieId) {
  return feierEintraege(partieId).some((x) => EIGENE_GROSSE.includes(x.quelle) && x.art === 'gross' && x.klang && x.status === 'overlay');
}

// Satz des Bots, der vorher Platz 1 war (3.13: "dazu ein Satz des ueberholten Bots"); fest gewaehlt, kein Zufall.
// Die Saetze stehen im Woerterbuch p-punkte (platz1.<botId>). Das Satz-Register bekommt die deutschen (Quelle, wie alle
// Saetze im Register); angezeigt wird der eigene Satz in der eingestellten Sprache, ein fremder Satz aus dem Register so,
// wie er angemeldet ist.
const PLATZ1_BOTS = ['benno', 'hilde', 'kalle', 'lisa', 'rudi', 'turm', 'delia', 'koenig', 'greta', 'stockfisch'];
function platz1Saetze() {
  const de = texte('de');
  return Object.fromEntries(PLATZ1_BOTS.map((id) => [id, [de['p-punkte.platz1.' + id]]]));
}
function platz1Satz(botId) {
  const b = botId ? botNachId(botId) : null;
  if (!b) return null;
  const satz = botSatz(b, 'tafel-platz1', () => 0);
  if (!satz) return null;
  const eigen = PLATZ1_BOTS.includes(b.id) && satz === texte('de')['p-punkte.platz1.' + b.id];
  return t('p-punkte.feier.satz', { name: b.name, satz: eigen ? t('p-punkte.platz1.' + b.id) : satz });
}

function feiern(e) {
  if (!e || !e.tafel) return;
  // Texte in der eingestellten Sprache; die Feier merkt sie sich fertig (ein spaeterer Sprachwechsel zeigt sie wie gemeldet)
  const name = A.tafelName(e.tafel, botNachId);
  const gross = (text) => text.toLocaleUpperCase(locale());
  const pfeil = e.aufstieg > 0 ? ` ▲ ${e.aufstieg}` : '';
  // Platz 1 einer Tafel (nur mit Gaesten dahinter): grosser Moment 78; ist der schon vergeben, eine Zeile
  if (e.platz1) {
    if (grossFrei(e.id, 78)) {
      const satz = sicher(() => platz1Satz(e.satzBot), 'Bot-Satz');
      const text = t('p-punkte.feier.text', { wert: A.zahlText(e.w), wer: e.ueberholt.join(', ') || t('p-punkte.feier.allenGaesten') });
      melde({ partieId: e.id, quelle: 'bot-rekord', titel: gross(t('p-punkte.platzAuf', { platz: 1, name })),
        text: satz ? t('p-punkte.feier.mitSatz', { text, satz }) : text, symbol: 'podest', klang: 'rekord' });
    } else {
      melde({ partieId: e.id, quelle: 'rekord', titel: t('p-punkte.platzAuf', { platz: 1, name }) + pfeil,
        text: e.platzVorher ? t('p-punkte.feier.vorherPlatz', { platz: e.platzVorher }) : null, symbol: 'podest' });
    }
    return;
  }
  // eigener Allzeit-Rekord: grosser Moment 70 (alte Zahl daneben); ist der schon vergeben, eine Zeile: mit Ueberholen
  // "Platz 4 auf Thorstens Tafel ^ 2" (Platz gewonnen, 58), sonst "Rekord auf Thorstens Tafel: 23.100"
  if (e.rekord) {
    const plus = t('p-punkte.feier.plus', { wert: A.zahlText(e.w), vorher: A.zahlText(e.vorher), diff: A.zahlText(e.w - e.vorher) });
    if (grossFrei(e.id, 70)) {
      melde({ partieId: e.id, quelle: 'tafel-rekord', art: 'gross', prio: 70, titel: gross(t('p-punkte.feier.neuerRekord', { name })),
        text: e.aufstieg > 0 && e.platz != null ? t('p-punkte.feier.platzPlus', { platz: e.platz, pfeil, plus }) : plus, symbol: 'podest', klang: 'rekord' });
    } else if (e.aufstieg > 0 && e.platz != null) {
      melde({ partieId: e.id, quelle: 'rekord', titel: t('p-punkte.platzAuf', { platz: e.platz, name }) + pfeil,
        text: t('p-punkte.feier.vorherPlatz', { platz: e.platzVorher }), symbol: 'podest' });
    } else {
      melde({ partieId: e.id, quelle: 'rekord', titel: t('p-punkte.feier.rekordAuf', { name, wert: A.zahlText(e.w) }),
        text: t('p-punkte.vorher', { wert: A.zahlText(e.vorher) }), symbol: 'podest' });
    }
  }
}

function senden(e) {
  sende('punkte:geaendert', { punkte: e.w, platz: e.platz, tafel: e.tafel, rekord: !!e.rekord });
  if (e.rekord) sende('rekord:neu', { tafel: e.tafel, wert: e.w, vorher: e.vorher, platz: e.platz, fenster: 'allzeit', partieId: e.id });
  // Wochenwertung fuer die Freunde-Rangliste melden (nur angemeldet, nur bei Aenderung; wirft nie)
  try { FK.meldeWoche().catch(() => {}); } catch (x) { /* egal */ }
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

// Vorlaeufige Bot-Laeufe (3.13 "Schon in S1 nicht leer"): nur mit dem Rechenstand der Formel, sonst keine (alte und
// neue Regeln mischen sich nie). Fehlt die Datei (grund 'netz'), bleiben die Tafeln bei Freunden und eigenen Zeilen.
const BOT_LAEUFE = 'punkte/bot-laeufe';
async function ladeBotLaeufe() {
  const r = await ladeInhalt(BOT_LAEUFE, { art: 'bot-laeufe' });
  if (!r.ok || r.veraltet || !r.kopf || r.kopf.rechenstand !== S.STAND) { S.setzeBotLaeufe(null); return 0; }
  return S.setzeBotLaeufe(r.daten);
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
    const tf = st.tafeln[id];
    if (tf) for (const e of tf.eintraege.slice(0, T.EIGENE_SICHTBAR)) nachweisSpaeter(e.id, id);
  }
}

// ---------- Oberflaeche ----------
const gezeigt = new Set();   // Partien, deren Abrechnungszeile schon gelaufen ist (der Nachtrag rollt nicht neu)

function miniTafel(e) {
  if (!e.tafel || !(e.aufstieg > 0)) return null;
  const st = S.lade();
  const tf = st.tafeln[e.tafel];
  if (!tf) return null;
  const zeilen = T.zeilen(tf, { fenster: 'allzeit', gaeste: S.gaeste(st, e.tafel) });
  const i = zeilen.findIndex((r) => r.eigen && r.id === e.id);
  if (i < 0) return null;
  const aus = [];
  const du = t('p-punkte.du');
  if (zeilen[i - 1]) aus.push({ ...zeilen[i - 1], rolle: 'ueber', name: zeilen[i - 1].eigen ? du : zeilen[i - 1].name });
  aus.push({ ...zeilen[i], rolle: 'ich', name: du, eigen: true });
  if (zeilen[i + 1]) aus.push({ ...zeilen[i + 1], rolle: 'unter', name: zeilen[i + 1].eigen ? du : zeilen[i + 1].name, eigen: false });
  return aus;
}

// Ueberhol-Post (3.13): "Ich hab deine 21.800 auf Thorstens Tafel geknackt, jetzt 23.100. Code: SA1-..."; erst beim Antippen
function postText(e) {
  const name = A.tafelName(e.tafel, botNachId);
  const st = S.lade();
  const tf = st.tafeln[e.tafel];
  const eintrag = tf && tf.eintraege.find((x) => x.id === e.id);
  const code = eintrag ? sicher(() => B.codeFuer(eintrag, e.tafel, String(B.einstellungen().name || '').slice(0, C.NAME_MAX)), 'Code') : null;
  const werte = { alt: A.zahlText(e.post.w), name, neu: A.zahlText(e.w), code: code && code.ok ? code.code : '' };
  return t(code && code.ok ? 'p-punkte.post.textCode' : 'p-punkte.post.text', werte);
}

// "So nah wie noch nie" gilt erst, wenn die Zeile ihn zeigt: beim ersten Zeigen festschreiben; ist der Moment der Woche
// inzwischen vergeben (eine andere Partie hat ihn gezeigt), steht stattdessen der naechste Satz da. Entschieden wird
// einmal je Partie (fastEntschieden), damit ein Neuaufbau der Zeile (Nachtrag) denselben Satz zeigt.
const fastEntschieden = new Map();   // partieId -> true (Satz gezeigt) | false (Moment schon vergeben)
function fastZeigen(e) {
  if (!e.fast) return e;
  if (!fastEntschieden.has(e.id)) {
    const ok = !!sicher(() => {
      const st = S.lade();
      const r = S.merkeFast(st, e);
      if (r) S.speichere(st);
      return r;
    }, 'So nah');
    fastEntschieden.set(e.id, ok);
    if (fastEntschieden.size > 40) fastEntschieden.delete(fastEntschieden.keys().next().value);
  }
  return fastEntschieden.get(e.id) ? e : { ...e, fast: null };
}

// Fenster der Bestenliste passend zum Satz: "Diese Woche: Platz 2" oeffnet die Woche, sonst Allzeit (Platz, Rekord, so nah)
const fensterFuer = (e) => (e.platz == null && !e.rekord && !e.fast && e.wochenPlatz != null ? 'woche' : 'allzeit');

function anbieterAbrechnung(k) {
  const p = k && k.erg && k.erg.partie ? k.erg.partie : null;
  if (!p || typeof p.id !== 'string') return null;
  if ((k.modus || p.modus) === 'uebung') return null;
  // ohne eigenen Zug (z. B. sofort aufgegeben) gibt es keine Spielanalyse und also keine Punkte: keine Zeile
  if (!(eigeneZuege(p) > 0)) return null;
  const roh = S.ergebnisVon(S.lade(), p.id);
  if (!roh) {
    // die Analyse rechnet noch: ruhiger Schimmer; ohne Analyse (fehlgeschlagen): die Arena holt sie nach
    if (k.rechnet) return A.wartezeile();
    return A.wartezeile({ fehlt: true });
  }
  const schon = gezeigt.has(p.id);
  const e = fastZeigen(roh);
  const z = A.abrechnungsZeile({
    ergebnis: e, tafelName: e.tafel ? A.tafelName(e.tafel, botNachId) : t('p-punkte.tafel.allein'), schonGezeigt: schon, merke: () => gezeigt.add(p.id),
    mini: sicher(() => miniTafel(e), 'Mini-Tafel'),
    // der grosse Moment im Ergebnis klingt schon "rekord": die Zeile schweigt (kein Echo)
    stumm: !!sicher(() => feierKlingt(p.id), 'Klang'),
    beiListe: e.tafel && k.app && typeof k.app.gehe === 'function' ? () => {
      B.merkeEinstellung({ tafel: e.tafel, reiter: 'bots' });
      k.app.gehe('bestenliste', { reiter: 'bots', fenster: fensterFuer(e) });
    } : null,
    post: e.post && e.tafel ? { name: e.post.name, text: () => postText(e) } : null,
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

// Bot-Panel der Arena (3.17 "Thorstens Tafel: Platz 4"): nur Leiter-Bots mit eigenem Eintrag, Platz nur mit Gaesten
function anbieterPanel(k) {
  const bot = k && k.bot;
  if (!bot || bot.stufe == null) return null;
  const id = T.tafelId({ botId: bot.id });
  const st = S.lade();
  const tf = id && st.tafeln[id];
  if (!tf || !tf.eintraege.length) return null;
  const gaeste = S.gaeste(st, id);
  const ich = gaeste.length ? T.zeilen(tf, { fenster: 'allzeit', gaeste }).find((r) => r.eigen) : null;
  return A.panelZeile({
    name: A.tafelName(id, botNachId), best: T.eigene(tf, 'allzeit')[0].w, platz: ich ? ich.platz : null,
    beiTipp: k.app && typeof k.app.gehe === 'function' ? () => {
      B.merkeEinstellung({ tafel: id, reiter: 'bots' });
      k.app.gehe('bestenliste', { reiter: 'bots', fenster: 'allzeit' });
    } : null,
  });
}

// name erst beim Fuellen (Woerterbuch p-punkte, reiter.<id>)
function anbieterReiter(id, baue) {
  return (k) => sicher(() => {
    if (!k || k.reiter !== id) return B.huelle(id, t('p-punkte.reiter.' + id));
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
  // je fuer sich: ein Fehler hier (z. B. Art schon angemeldet) haelt die Hoerer und Orte darunter nicht auf
  sicher(() => registriereSaetze('tafel-platz1', platz1Saetze()), 'Saetze');
  sicher(() => registriereInhaltsart('bot-laeufe', { formate: [1], pruefe: (json) => S.pruefeBotLaeufe(json) }), 'Inhaltsart');
  S.setzeBotNamen((id) => { const b = botNachId(id); return b && b.name ? b.name : id; });

  hoere('app:bereit', () => {
    ladeBotLaeufe().catch((e) => sicher(() => { throw e; }, 'Bot-Laeufe'));
    setTimeout(() => sicher(umzug, 'Umzug'), 1200);
  });
  hoere('speicher:zurueckgesetzt', () => sicher(() => { gezeigt.clear(); fastEntschieden.clear(); }, 'zurueckgesetzt'));
  // der Modul-Speicher wird nur bei Hilfe gelesen: der naechste eigene Zug nach einem Hinweis oder Zuruecknehmen
  // (hilfeOffen merkt sich die laufId, damit nicht jeder Zug den Speicher liest)
  // partie:gestartet liest und schreibt den Modul-Speicher: ausserhalb des Hoerers (Hoerer hoechstens 2 ms), lange vor
  // dem ersten eigenen Zug
  hoere('partie:gestartet', (d) => {
    if (!d || !d.laufId) return;
    const laufId = d.laufId;
    const fortgesetzt = !!d.fortgesetzt;
    setTimeout(() => sicher(() => lauf((st) => {
      S.merkeLauf(st, laufId, { fortgesetzt });
      hilfeOffen = st.lauf && st.lauf.hilfe ? laufId : null;
    }), 'partie:gestartet'), 0);
  });
  hoere('hilfe:genutzt', (d) => sicher(() => {
    if (!d || !d.laufId) return;
    hilfeOffen = d.laufId;
    // der Lauf entsteht notfalls hier (partie:gestartet merkt ihn erst nach dem Hoerer)
    lauf((st) => { S.merkeLauf(st, d.laufId, { fortgesetzt: true }); S.merkeHilfe(st, d.laufId); });
  }, 'hilfe:genutzt'));
  hoere('zug:gespielt', (d) => sicher(() => {
    if (!d || d.wer !== 'flo' || hilfeOffen !== d.laufId) return;
    hilfeOffen = null;
    lauf((st) => S.merkeZug(st, d.laufId, d.ply));
  }, 'zug:gespielt'));
  hoere('zug:zurueckgenommen', (d) => sicher(() => {
    if (!d || !d.laufId) return;
    hilfeOffen = d.laufId;
    lauf((st) => { S.merkeLauf(st, d.laufId, { fortgesetzt: true }); S.vergissAb(st, d.laufId, d.bisPly); });
  }, 'zug:zurueckgenommen'));
  hoere('partie:beendet', (d) => sicher(() => { if (d && d.partieId) lauf((st) => S.beende(st, d.laufId, d.partieId)); }, 'partie:beendet'));
  hoere('partie:analysiert', (d) => sicher(() => partieAnalysiert(d), 'partie:analysiert'));
  hoere('funken:geaendert', (d) => sicher(() => {
    if (!d || !Number.isInteger(d.level)) return;
    lauf((st) => { if (st.level === d.level) return false; st.level = d.level; return true; });
  }, 'funken:geaendert'));

  anbieten('ergebnis:abrechnung', (k) => sicher(() => anbieterAbrechnung(k), 'Abrechnung'), { reihenfolge: 10, paket: PAKET });
  anbieten('arena:panel-bot', (k) => sicher(() => anbieterPanel(k), 'Panel'), { reihenfolge: 40, paket: PAKET });
  anbieten('bestenliste:reiter', anbieterReiter('ich', B.reiterIch), { reihenfolge: 10, paket: PAKET });
  anbieten('bestenliste:reiter', anbieterReiter('bots', B.reiterBots), { reihenfolge: 20, paket: PAKET });
  // Freunde mit Konto (Entwurf "Bestenliste", 30.10.2026): Rangliste nach Wochenwertung, darunter die Codes ohne Konto
  anbieten('bestenliste:reiter', anbieterReiter('freunde', FK.reiterFreunde), { reihenfolge: 50, paket: PAKET });

  if (TEST && typeof window !== 'undefined') {
    window.__punkte = { stand: () => S.lade(), speichere: (st) => S.speichere(st), umzug, ladeBotLaeufe, fastZeigen, S, T, C, F };
  }
}

sicher(registriere, 'Laden');
