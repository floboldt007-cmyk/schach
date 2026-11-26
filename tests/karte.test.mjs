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
const stand = (x = {}) => ({ taler: 70, stufen: { siege: 2, liga: 1 }, banner: ['start', 'saison-bronze'], wahl: { banner: 'start' }, ...x });

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
antworten = { karte_melde_stufen: stand({ stufen: { siege: 2 } }),
  karte_waehle: (d) => (d.titel ? { __status: 400, message: 'KARTE_TITEL' } : stand({ wahl: { banner: d.banner } })) };
aufrufe = [];
await K.abgleichKonto({ titel: 'erfolg-gibtsnicht' });
const w2 = aufrufe.filter((a) => a.name === 'karte_waehle');
pruefe('Nach Absage: zweite Wahl ohne Titel, Banner und Rahmen auf Standard, Vitrine nur Besitz', w2.length === 2 && w2[1].daten.titel === null
  && w2[1].daten.banner === 'start' && w2[1].daten.rahmen === 'ohne' && w2[1].daten.vitrine.join() === 'stufe-siege', w2.map((x) => x.daten));

// KARTE_TITEL live 11.11.2026 20:09: Erfinder und Pionier ohne eigene Wahl bekommen den Titel "erfinder" bzw. "pionier"
// (titelListe), den der Server mit Absicht nicht kennt (karte-vertrag: "kein Erfinder, kein Pionier"). Gesendet wird er
// nicht: die erste Wahl geht ohne Titel raus, mit Banner und Rahmen wie gewaehlt, und es gibt keine Absage.
for (const titel of ['erfinder', 'pionier']) {
  setzeProfilWahl({ banner: 'saison-bronze', rahmen: 'liga-2' });
  antworten = { karte_melde_stufen: stand(),
    karte_waehle: (d) => (d.titel ? { __status: 400, message: 'KARTE_TITEL' } : stand({ wahl: { banner: d.banner } })) };
  aufrufe = [];
  await K.abgleichKonto({ titel });
  const w = aufrufe.filter((a) => a.name === 'karte_waehle');
  pruefe(`Titel "${titel}" geht nicht an den Server: eine Wahl ohne Titel, Banner und Rahmen bleiben`, w.length === 1 && w[0].daten.titel === null
    && w[0].daten.banner === 'saison-bronze' && w[0].daten.rahmen === 'liga-2', w.map((x) => x.daten));
}

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
// R30 (Flo 22.11.2026 "Was du besitzt und traegst, sieht auch dein Gegner"): Koenig, Kronli und Erfinder-Rahmen gehen an den
// Server, der sie nur mit Stueck annimmt (supabase/karte-besitz-sicht-schema.sql); Labor-Rahmen nie
pruefe('Erfinder-Motive und Erfinder-Rahmen in der Server-Liste, Labor-Rahmen nicht', ['K', 'kronli'].every((m) => K.KARTE_MOTIVE.includes(m))
  && K.KARTE_RAHMEN.includes('erfinder-blatt-0') && !['neon', 'brett', 'drache', 'pixel'].some((x) => K.KARTE_RAHMEN.includes(x)));
pruefe('Erste Wahl: Koenig und Erfinder-Rahmen gehen ohne eigene Besitzpruefung mit (der Server entscheidet)',
  K.wahlFuerServer({ figur: 'K', rahmen: 'erfinder-blatt-0', vitrine: [] }).motiv === 'K'
  && K.wahlFuerServer({ figur: 'kronli', rahmen: 'erfinder-blatt-0', vitrine: [] }).rahmen === 'erfinder-blatt-0');
pruefe('Rueckfall mit Stand: Koenig, Kronli zum Bauern, Erfinder-Rahmen zu ohne',
  ['K', 'kronli'].every((m) => K.wahlFuerServer({ figur: m, rahmen: 'erfinder-blatt-0', vitrine: [] }, stand()).motiv === 'P')
  && K.wahlFuerServer({ figur: 'Q', rahmen: 'erfinder-blatt-0', vitrine: [] }, stand()).rahmen === 'ohne'
  && K.wahlFuerServer({ figur: 'Q', rahmen: 'holz', vitrine: [] }, stand()).motiv === 'Q');
{
  // Erfinder (Merker mit beiden Stuecken), alter Server oder Konto ohne Stueck: KARTE_PROFIL, dann GENAU EIN zweiter Versuch
  // mit P / ohne; ein Server mit R30 und Stueck nimmt die erste Wahl
  const { SONDER_SCHLUESSEL, ERFINDER } = await import('../js/sonderstuecke.js');
  speicher.set(SONDER_SCHLUESSEL, JSON.stringify({ konto: UID, ids: [ERFINDER.titel, ERFINDER.banner] }));
  setzeProfilWahl({ figur: 'K', rahmen: 'erfinder-blatt-0', banner: 'start' });
  const sonderAbgelehnt = (d) => (d.motiv === 'K' || d.rahmen === 'erfinder-blatt-0' ? { __status: 400, message: 'KARTE_PROFIL' } : stand({ wahl: d }));
  antworten = { karte_melde_stufen: stand(), karte_waehle: sonderAbgelehnt };
  aufrufe = [];
  await K.abgleichKonto();
  const w = aufrufe.filter((a) => a.name === 'karte_waehle').map((a) => a.daten);
  pruefe('alter Server: erst K/erfinder-blatt-0, nach KARTE_PROFIL genau einmal P/ohne', w.length === 2 && w[0].motiv === 'K'
    && w[0].rahmen === 'erfinder-blatt-0' && w[1].motiv === 'P' && w[1].rahmen === 'ohne', w);
  // Live ohne supabase/karte-besitz-sicht-schema.sql (CI-Befund T-003, 26.11.): der zweite Versuch nimmt nur die Sonderwerte
  // heraus und behaelt Titel, Banner und Vitrine, sonst verloere der Erfinder dort seinen Titel, den er vor R30 behielt
  setzeProfilWahl({ figur: 'K', rahmen: 'erfinder-blatt-0', banner: 'saison-bronze', titel: 'erfolg-feuertaufe', vitrine: ['stufe-raetsel'] });
  aufrufe = [];
  await K.abgleichKonto({ titel: 'erfolg-feuertaufe' });
  const w2 = aufrufe.filter((a) => a.name === 'karte_waehle').map((a) => a.daten);
  pruefe('alter Server: der zweite Versuch behaelt Titel, Banner und Vitrine (nur K und Erfinder-Rahmen fallen weg)',
    w2.length === 2 && w2[1].motiv === 'P' && w2[1].rahmen === 'ohne' && w2[1].titel === 'erfolg-feuertaufe'
    && w2[1].banner === 'saison-bronze' && JSON.stringify(w2[1].vitrine) === JSON.stringify(w2[0].vitrine), w2);
  setzeProfilWahl({ figur: 'K', rahmen: 'erfinder-blatt-0', banner: 'start', titel: null, vitrine: [] });
  antworten = { karte_melde_stufen: stand(), karte_waehle: (d) => stand({ wahl: d }) };
  aufrufe = [];
  await K.abgleichKonto();
  const w3 = aufrufe.filter((a) => a.name === 'karte_waehle').map((a) => a.daten);
  pruefe('Server mit R30 und Stueck: eine Wahl, K/erfinder-blatt-0', w3.length === 1 && w3[0].motiv === 'K' && w3[0].rahmen === 'erfinder-blatt-0', w3);
  setzeProfilWahl({ figur: 'Q', rahmen: 'ohne' });
  speicher.delete(SONDER_SCHLUESSEL);
}
// fremde Karte: ohne Paket sammlung nur die geprueften Rohwerte, mit Paket Titel und Liga-Name
const { fremdeKarte, kronenText, LIGA_NAMEN } = await import('../js/ui/visitenkarte.js');
const roh = { name: 'Gegner_2', titel: 'erfolg-feuertaufe', banner: 'saison-silber', kronen_stufe: 7 };
pruefe('Fremde Karte ohne Paket: Banner und Name, kein Titel', fremdeKarte(roh).titel === null && fremdeKarte(roh).banner === 'saison-silber');
await import('../js/pakete/sammlung/profil.js');
pruefe('Fremde Karte mit Paket: Titel aus der festen Liste', fremdeKarte(roh).titel?.name === 'Feuertaufe', fremdeKarte(roh).titel);
pruefe('Liga-Namen nach Konzept 5a an einer Stelle', Object.values(LIGA_NAMEN).join() === 'bauer,springer,laeufer,turm,dame,koenig'
  && kronenText(7) === 'Warden II', kronenText(7));
speichereModul('besitz', {});

console.log(`\n${ok}/${ok + fehler} bestanden`);
process.exit(fehler ? 1 : 0);
