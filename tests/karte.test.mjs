// Etappe 4b: js/karte.js gegen einen nachgebildeten Server (ohne Browser, ohne Netz). Was der echte Server bucht und
// ablehnt, prueft tests/server-karte.test.mjs; hier geht es um das, was der Client sendet und was er sich merkt.
//   node tests/karte.test.mjs
import { setzeSpeicher, speichereModul } from '../js/storage.js';
import { setzeOnlineFetch } from '../js/online.js';
import { setzeProfilWahl } from '../js/profil.js';
import { ladeBesitz, abgleichen, serverStand, eigeneBanner } from '../js/besitz.js';
import * as K from '../js/karte.js';

let ok = 0; let fehler = 0;
function pruefe(name, wert, info = '') {
  if (wert) { ok++; console.log('ok   ' + name); } else { fehler++; console.log('FEHLER ' + name + ' ' + (typeof info === 'string' ? info : JSON.stringify(info))); }
}
const speicher = new Map();
const lager = { getItem: (k) => (speicher.has(k) ? speicher.get(k) : null), setItem: (k, v) => speicher.set(k, String(v)),
  removeItem: (k) => speicher.delete(k), key: (i) => [...speicher.keys()][i] ?? null, get length() { return speicher.size; } };
setzeSpeicher(lager);
globalThis.localStorage = lager;

const UID = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const sitzung = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: UID })).toString('base64url') + '.x', refresh_token: 'r1',
  expires_at: 9999999999, user: { id: UID, email: 'probe@example.invalid' } };
const anmelden = () => speicher.set('schach-arena:konto:sitzung', JSON.stringify(sitzung));
const abmelden = () => speicher.delete('schach-arena:konto:sitzung');

// nachgebildeter Server: Antworten je Funktion, Liste der Aufrufe
let aufrufe = [];
let antworten = {};
let netzFehlt = false;
setzeOnlineFetch(async (url, opt) => {
  const name = (String(url).match(/\/rest\/v1\/rpc\/([a-z_]+)/) || [])[1];
  aufrufe.push({ name, daten: opt && opt.body ? JSON.parse(opt.body) : null });
  if (netzFehlt) throw new Error('offline');
  const a = antworten[name];
  const d = typeof a === 'function' ? await a(aufrufe[aufrufe.length - 1].daten) : a;
  if (d && d.__status) return { ok: false, status: d.__status, json: async () => ({ message: d.message }) };
  return { ok: true, status: 200, json: async () => d };
});
// Stufen wie gemeldet (Siege Silber, Raetsel Bronze): der Server ist auf dem Stand des Geraets, niemand fragt nach
const stand = (x = {}) => ({ taler: 70, stufen: { siege: 2, raetsel: 1, liga: 1 }, banner: ['start', 'saison-bronze'], wahl: { banner: 'start' }, ...x });

// ohne Konto: nichts geht raus
abmelden();
pruefe('Ohne Konto: kein Aufruf, null', (await K.abgleichKonto()) === null && aufrufe.length === 0);
pruefe('Ohne Konto: keine Karte der Partie', (await K.karteDerPartie('p1')) === null && aufrufe.length === 0);

// mit Konto
anmelden();
abgleichen({ siege: 50, raetsel: 10, level: 1, ligaStufe: 15 });
pruefe('Lokal gebucht: Siege Silber, Raetsel Bronze, Liga Gold (nur lokal)', ladeBesitz().stufen.siege === 2 && ladeBesitz().stufen.liga === 3);
setzeProfilWahl({ figur: 'Q', rahmen: 'liga-2', vitrine: ['erfolg-erster-sieg', 'stufe-raetsel', null], titel: 'erfolg-feuertaufe', banner: 'saison-bronze' });
antworten = { karte_melde_stufen: stand(), karte_waehle: (d) => stand({ wahl: { banner: d.banner } }) };
aufrufe = [];
const r = await K.abgleichKonto({ titel: 'erfolg-feuertaufe' });
pruefe('Meldet zuerst die Stufen, dann die Wahl', aufrufe.map((a) => a.name).join() === 'karte_melde_stufen,karte_waehle', aufrufe);
pruefe('liga wird nie gemeldet (leitet der Server ab)', aufrufe[0].daten.stufen.siege === 2 && !('liga' in aufrufe[0].daten.stufen), aufrufe[0].daten);
pruefe('Wahl in Server-Form: alte Vitrine-Id wird Familie, Titel, Banner, Motiv', JSON.stringify(aufrufe[1].daten) === JSON.stringify({
  banner: 'saison-bronze', titel: 'erfolg-feuertaufe', vitrine: ['stufe-siege', 'stufe-raetsel'], motiv: 'Q', grund: 'standard', rahmen: 'liga-2' }), aufrufe[1].daten);
pruefe('Server-Stand gemerkt je Konto', r && serverStand(UID).taler === 70 && eigeneBanner(ladeBesitz(), UID).includes('saison-bronze'));

// drei Abgleiche zugleich: der erste laeuft, die beiden spaeteren teilen genau einen zweiten Lauf danach
aufrufe = [];
await Promise.all([K.abgleichKonto(), K.abgleichKonto(), K.abgleichKonto()]);
pruefe('Laufender Abgleich: spaetere Aufrufe teilen genau einen zweiten Lauf', aufrufe.filter((a) => a.name === 'karte_melde_stufen').length === 2, aufrufe);

// Absage der Wahl: zweiter Versuch nur mit Besitz
setzeProfilWahl({ banner: 'shop-kronjuwel', rahmen: 'neon' });
antworten = { karte_melde_stufen: stand({ stufen: { siege: 2, raetsel: 1 } }),
  karte_waehle: (d) => (d.titel ? { __status: 400, message: 'KARTE_TITEL' } : stand({ wahl: { banner: d.banner } })) };
aufrufe = [];
await K.abgleichKonto({ titel: 'erfolg-gibtsnicht' });
const w2 = aufrufe.filter((a) => a.name === 'karte_waehle');
pruefe('Nach Absage: zweite Wahl ohne Titel, Banner und Rahmen auf Standard, Vitrine nur Besitz', w2.length === 2 && w2[1].daten.titel === null
  && w2[1].daten.banner === 'start' && w2[1].daten.rahmen === 'ohne' && w2[1].daten.vitrine.join() === 'stufe-siege,stufe-raetsel', w2.map((x) => x.daten));

// ---------- Besitz-Pruefung und Bremse des Servers (supabase/karte-schema.sql ab 09.11.2026) ----------
// nachgebildeter Server: je Meldung hoechstens eine neue Stufe je Familie, hoechstens `tag` neue Stufen insgesamt
function bremsServer(tag) {
  const hat = {};
  let frei = tag;
  const melde = (d) => {
    for (const [f, ziel] of Object.entries(d.stufen)) {
      if (frei > 0 && (hat[f] || 0) < ziel) { hat[f] = (hat[f] || 0) + 1; frei--; }
    }
    return stand({ stufen: { ...hat }, taler: 0 });
  };
  return { karte_melde_stufen: melde, karte_waehle: (d) => stand({ stufen: { ...hat }, taler: 0, wahl: { banner: d.banner } }) };
}
speichereModul('besitz', {});
abgleichen({ siege: 100, raetsel: 200, level: 1 });
setzeProfilWahl({ figur: 'Q', rahmen: 'ohne', vitrine: [null, null, null], titel: null, banner: 'start' });
antworten = bremsServer(99);
aufrufe = [];
await K.abgleichKonto();
let m = aufrufe.filter((a) => a.name === 'karte_melde_stufen');
pruefe('Eine Stufe je Meldung: Gold kommt mit drei Meldungen an, dann ist Schluss', m.length === 3 && serverStand(UID).stufen.siege === 3
  && serverStand(UID).stufen.raetsel === 3 && m.every((x) => x.daten.stufen.siege === 3), { n: m.length, s: serverStand(UID) });
aufrufe = [];
await K.abgleichKonto();
pruefe('Server auf dem Stand des Geraets: genau eine Meldung', aufrufe.filter((a) => a.name === 'karte_melde_stufen').length === 1, aufrufe);
// Tagesgrenze: der Server bucht nur zwei Stufen, danach nichts mehr
speichereModul('besitz', {});
abgleichen({ siege: 100, raetsel: 200, level: 1 });
antworten = bremsServer(2);
aufrufe = [];
const gebremst = await K.abgleichKonto();
m = aufrufe.filter((a) => a.name === 'karte_melde_stufen');
pruefe('Bremse: der Abgleich hoert auf, sobald nichts mehr vorangeht (kein Dauerfeuer), und liefert den Stand', m.length === 2 && !!gebremst
  && serverStand(UID).stufen.siege === 1 && serverStand(UID).stufen.raetsel === 1, { n: m.length, s: serverStand(UID) });
pruefe('Bremse: das Geraet behaelt seinen eigenen Stand (nichts verfaellt)', ladeBesitz().stufen.siege === 3 && ladeBesitz().stufen.raetsel === 3);
aufrufe = [];
await K.abgleichKonto();
pruefe('Bremse am selben Tag: beim naechsten Abgleich nur eine Meldung', aufrufe.filter((a) => a.name === 'karte_melde_stufen').length === 1, aufrufe);
// Server vor dem 09.11.2026 (bucht alles auf einmal): wie bisher eine Meldung
speichereModul('besitz', {});
abgleichen({ siege: 100, level: 1 });
antworten = { karte_melde_stufen: (d) => stand({ stufen: { ...d.stufen } }), karte_waehle: (d) => stand({ stufen: { siege: 3 }, wahl: { banner: d.banner } }) };
aufrufe = [];
await K.abgleichKonto();
pruefe('Alter Server (alles auf einmal): eine Meldung', aufrufe.filter((a) => a.name === 'karte_melde_stufen').length === 1, aufrufe);

// Wahl gegen Besitz: der Server lehnt ab, was er nicht belegen kann; der zweite Versuch traegt nur, was frei ist
const FREI = { titel: ['level-1', 'level-5', 'erfolg-feuertaufe'], rahmen: ['ohne', 'holz', 'serie-7'], gruende: ['standard', 'welt-1'], motive: ['Q', 'R', 'B', 'N', 'P'] };
const besitzServer = (wahl) => (d) => {
  const ok = (liste, x, alt) => x === alt || FREI[liste].includes(x);
  if (d.titel !== null && !ok('titel', d.titel, wahl.titel)) return { __status: 400, message: 'KARTE_TITEL' };
  if (!ok('rahmen', d.rahmen, wahl.rahmen) || !ok('gruende', d.grund, wahl.grund) || !ok('motive', d.motiv, wahl.motiv)) return { __status: 400, message: 'KARTE_PROFIL' };
  Object.assign(wahl, d);
  return stand({ frei: FREI, wahl: { ...wahl } });
};
let serverWahl = { banner: 'start', titel: null, vitrine: [], motiv: 'P', grund: 'standard', rahmen: 'ohne' };
setzeProfilWahl({ figur: 'karo', grund: 'welt-3', rahmen: 'liga-6', titel: 'level-100', banner: 'start' });
antworten = { karte_melde_stufen: () => stand({ stufen: { siege: 3 }, frei: FREI, wahl: { ...serverWahl } }), karte_waehle: besitzServer(serverWahl) };
aufrufe = [];
let rw = await K.abgleichKonto({ titel: 'level-100' });
let wz = aufrufe.filter((a) => a.name === 'karte_waehle');
pruefe('Nicht belegte Wahl: erst der Wunsch, dann ohne die fremden Stuecke (Standard)', wz.length === 2 && wz[0].daten.titel === 'level-100'
  && JSON.stringify(wz[1].daten) === JSON.stringify({ banner: 'start', titel: null, vitrine: [], motiv: 'P', grund: 'standard', rahmen: 'ohne' }), wz.map((x) => x.daten));
pruefe('Nicht belegte Wahl: der Abgleich endet mit dem Stand des Servers, ohne Fehler', !!rw && rw.wahl.rahmen === 'ohne' && rw.wahl.titel === null, rw);
// ein Teil der Wahl ist belegt: der bleibt, nur das Fremde faellt weg
setzeProfilWahl({ figur: 'N', grund: 'welt-1', rahmen: 'serie-7', titel: 'level-100' });
aufrufe = [];
rw = await K.abgleichKonto({ titel: 'level-100' });
wz = aufrufe.filter((a) => a.name === 'karte_waehle');
pruefe('Teils belegte Wahl: Rahmen, Hintergrund und Bild bleiben, nur der Titel faellt weg', wz.length === 2 && wz[1].daten.rahmen === 'serie-7'
  && wz[1].daten.grund === 'welt-1' && wz[1].daten.motiv === 'N' && wz[1].daten.titel === null && rw.wahl.rahmen === 'serie-7', wz.map((x) => x.daten));
// Bestandsschutz: was schon auf der Server-Karte steht, sendet der zweite Versuch wieder (der Server nimmt es weiter an)
serverWahl = { banner: 'start', titel: 'erfolg-sternenkrone', vitrine: [], motiv: 'P', grund: 'standard', rahmen: 'liga-6' };
antworten = { karte_melde_stufen: () => stand({ stufen: { siege: 3 }, frei: FREI, wahl: { ...serverWahl } }), karte_waehle: besitzServer(serverWahl) };
setzeProfilWahl({ figur: 'Q', grund: 'standard', rahmen: 'liga-3', titel: 'erfolg-sternenkrone' });
aufrufe = [];
rw = await K.abgleichKonto({ titel: 'erfolg-sternenkrone' });
wz = aufrufe.filter((a) => a.name === 'karte_waehle');
pruefe('Bestand: nach der Absage bleibt, was schon auf der Karte stand (Titel und alter Rahmen), das Bild wechselt', wz.length === 2
  && wz[1].daten.titel === 'erfolg-sternenkrone' && wz[1].daten.rahmen === 'liga-6' && wz[1].daten.motiv === 'Q' && rw.wahl.rahmen === 'liga-6', wz.map((x) => x.daten));
// Codex-Befund PR #206: ohne eigene Titel-Wahl (wahl.titel null) kommt der berechnete Level-Titel als Parameter. Wird nur
// der Rahmen abgelehnt, muss der erlaubte Titel im zweiten Versuch stehen bleiben.
serverWahl = { banner: 'start', titel: null, vitrine: [], motiv: 'P', grund: 'standard', rahmen: 'ohne' };
antworten = { karte_melde_stufen: () => stand({ stufen: { siege: 3 }, frei: FREI, wahl: { ...serverWahl } }), karte_waehle: besitzServer(serverWahl) };
setzeProfilWahl({ figur: 'Q', grund: 'standard', rahmen: 'liga-6', titel: null });
aufrufe = [];
rw = await K.abgleichKonto({ titel: 'level-5' });
wz = aufrufe.filter((a) => a.name === 'karte_waehle');
pruefe('Berechneter Titel ohne eigene Wahl: bleibt im zweiten Versuch, nur der gesperrte Rahmen faellt weg', wz.length === 2 && wz[0].daten.titel === 'level-5'
  && wz[1].daten.titel === 'level-5' && wz[1].daten.rahmen === 'ohne' && rw.wahl.titel === 'level-5', wz.map((x) => x.daten));
// belegte Wahl: ein Aufruf genuegt
setzeProfilWahl({ figur: 'Q', grund: 'standard', rahmen: 'holz', titel: 'erfolg-feuertaufe' });
aufrufe = [];
await K.abgleichKonto({ titel: 'erfolg-feuertaufe' });
pruefe('Belegte Wahl: ein Aufruf', aufrufe.filter((a) => a.name === 'karte_waehle').length === 1, aufrufe);
pruefe('wahlFuerServer ohne frei im Stand (alter Server): wie bisher kein Titel, Rahmen aus der festen Liste',
  JSON.stringify(K.wahlFuerServer({ figur: 'Q', rahmen: 'liga-6', titel: 'level-100', vitrine: [] }, { stufen: {}, banner: ['start'] }))
  === JSON.stringify({ banner: 'start', titel: null, vitrine: [], motiv: 'Q', grund: 'standard', rahmen: 'liga-6' }));
antworten = { karte_melde_stufen: stand(), karte_waehle: (d) => stand({ wahl: { banner: d.banner } }) };
speichereModul('besitz', {});
await K.abgleichKonto();

// offline: null, nichts gemerkt
netzFehlt = true;
const vorher = JSON.stringify(serverStand(UID));
pruefe('Offline: null ohne Fehler, alter Server-Stand bleibt', (await K.abgleichKonto()) === null && JSON.stringify(serverStand(UID)) === vorher);
netzFehlt = false;

// kaputte Antwort wird nicht gemerkt
antworten = { karte_melde_stufen: { taler: 'viel' } };
pruefe('Kaputte Antwort: null, nichts gemerkt', (await K.abgleichKonto()) === null && JSON.stringify(serverStand(UID)) === vorher);

// Karte der Partie
antworten = { karte_der_partie: { w: { name: 'a', banner: 'start' }, s: { name: 'b', banner: 'saison-gold' } } };
aufrufe = [];
const kp = await K.karteDerPartie('p-1');
pruefe('Karte der Partie: beide Karten, Parameter partie', kp && kp.s.banner === 'saison-gold' && aufrufe[0].daten.partie === 'p-1', aufrufe);
antworten = { karte_der_partie: () => new Promise((res) => setTimeout(() => res({ w: {}, s: {} }), 300)) };
const t0 = Date.now();
pruefe('Karte der Partie: nach der Frist null (Rueckfall Start-Banner)', (await K.karteDerPartie('p-2', { frist: 50 })) === null && Date.now() - t0 < 250);
antworten = { karte_der_partie: { __status: 400, message: 'KARTE_KEINE_PARTIE' } };
pruefe('Karte der Partie: Absage gibt null', (await K.karteDerPartie('p-3')) === null);

// feste Listen im Client
pruefe('Kein Erfinder-Motiv und kein Labor-Rahmen auf der Server-Karte', !K.KARTE_MOTIVE.includes('K') && !K.KARTE_MOTIVE.includes('kronli')
  && !K.KARTE_RAHMEN.includes('neon') && !K.KARTE_RAHMEN.some((x) => x.startsWith('erfinder')));
pruefe('Erfinder-Koenig wird auf der Karte zum Bauern', K.wahlFuerServer({ figur: 'K', vitrine: [] }).motiv === 'P');
// fremde Karte: ohne Paket sammlung nur die geprueften Rohwerte, mit Paket Titel und Liga-Name
const { fremdeKarte, kronenText, LIGA_NAMEN } = await import('../js/ui/visitenkarte.js');
const roh = { name: 'Gegner_2', titel: 'erfolg-feuertaufe', banner: 'saison-silber', kronen_stufe: 7 };
pruefe('Fremde Karte ohne Paket: Banner und Name, kein Titel', fremdeKarte(roh).titel === null && fremdeKarte(roh).banner === 'saison-silber');
await import('../js/pakete/sammlung/profil.js');
pruefe('Fremde Karte mit Paket: Titel aus der festen Liste', fremdeKarte(roh).titel?.name === 'Feuertaufe', fremdeKarte(roh).titel);
pruefe('Liga-Namen nach Konzept 5a an einer Stelle', Object.values(LIGA_NAMEN).join() === 'bauer,springer,laeufer,turm,dame,koenig'
  && kronenText(7) === 'Läufer II', kronenText(7));
speichereModul('besitz', {});

console.log(`\n${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
