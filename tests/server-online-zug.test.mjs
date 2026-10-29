// Server-Teil von Anti-Cheat Etappe 1a, Teil 1 (Edge Function online-zug), nur Node, ohne Browser und ohne Netz:
//   node tests/server-online-zug.test.mjs
// Prueft supabase/functions/_gemeinsam/online-zug.js mit chess.js aus vendor/chess (dieselbe Version 1.4.0, die die Huelle
// aus npm laedt): Eingabe nur { partie, zug }, Regeln (illegaler Zug, erfundene Stellung, Rochade durch Schach, en passant,
// Umwandlung, e2e4q), das Ende vom Server (Matt, Patt, zu wenig Material, dreifache Wiederholung, 50 Zuege), verarbeite()
// mit gefaelschtem Supabase (Anmeldung, Laden, Verbuchen mit veraltetem Stand, Ankunftszeit, Fehlerwege ohne Stacktrace),
// die Deno-Huelle online-zug/index.ts (Node entfernt die Typen, Deno-Attrappe, npm:chess.js auf vendor umgelenkt) und den
// Vertrag mit supabase/online-schema.sql und supabase/online-rls-test.sql. Die SQL selbst laeuft im PGlite-Pruefer
// (Scratchpad) und im Supabase SQL Editor.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import module from 'node:module';
import path from 'node:path';
import { Chess } from '../vendor/chess/chess.js';
import { DE, EN } from '../js/sprachen/online.js';
import {
  MAX_KOERPER, KOPF, KENNUNGEN, FEHLER_TEXTE, SQL_KENNUNGEN, bearer, pruefeEingabe, nachspielen, stimmtUeberein, ende, rechneZug,
  leseKoerper, verarbeite,
} from '../supabase/functions/_gemeinsam/online-zug.js';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');

let ok = 0;
let gesamt = 0;
// eigene Ausgabe: der Test der Huelle faengt console.log ab (dort schreibt die Function ihr Protokoll)
const ausgabe = console.log.bind(console);
function pruefe(name, bedingung, info) {
  gesamt++;
  if (bedingung) { ok++; ausgabe('ok     ' + name); } else ausgabe('FEHLER ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : ''));
}

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const UID_W = '0f8b6c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f';
const UID_S = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const UID_X = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';
const PARTIE = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const jwtFuer = (sub) => 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ sub })).toString('base64url') + '.c2lnbmF0dXItcHJvYmU';
const JWT_W = jwtFuer(UID_W);
const JWT_S = jwtFuer(UID_S);
const JWT_X = jwtFuer(UID_X);
const DIENST = 'sb_secret_probe';
const UMGEBUNG = { SUPABASE_URL: 'https://probe.supabase.example', SUPABASE_ANON_KEY: 'anon-probe', SUPABASE_SERVICE_ROLE_KEY: DIENST };

// Stellung nach einer Zugliste (chess.js aus vendor, wie der Server)
function stellung(zuege) {
  const c = new Chess();
  for (const u of zuege.split(' ').filter(Boolean)) c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  return c;
}
// Zeile wie in partien_online (nur die Spalten, die die Function laedt, plus Uhr fuer die Antwort)
function zeileNach(zuege, extra = {}) {
  const c = stellung(zuege);
  return { id: PARTIE, weiss: UID_W, schwarz: UID_S, status: 'laeuft', fen: c.fen(), zuege, am_zug: c.turn(), ...extra };
}

// Folgen, mit chess.js ausgesucht und hier noch einmal nachgerechnet (siehe Abschnitt "Folgen")
const FOLGEN = {
  // Narrenmatt: Schwarz setzt mit d8h4 matt
  narrenmatt: 'f2f3 e7e5 g2g4 d8h4',
  // Schaefermatt: Weiss setzt mit h5f7 matt
  schaefermatt: 'e2e4 e7e5 d1h5 b8c6 f1c4 g8f6 h5f7',
  // kuerzestes bekanntes Patt (Sam Loyd): Weiss setzt mit c8e6 patt
  patt: 'e2e3 a7a5 d1h5 a8a6 h5a5 h7h5 h2h4 a6h6 a5c7 f7f6 c7d7 e8f7 d7b7 d8d3 b7b8 d3h7 b8c8 f7g6 c8e6',
  // Springer hin und her: die Grundstellung zum dritten Mal nach dem 8. Halbzug
  wiederholung: 'g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1 f6g8',
  // viele Schlagzuege, am Ende Koenig gegen Koenig und Springer (c3b4 schlaegt den letzten Bauern)
  material: 'g1f3 a7a5 b2b4 a5b4 g2g4 a8a2 a1a2 g7g5 f3g5 b7b5 g5f7 e8f7 b1c3 b4c3 a2a8 c3d2 c1d2 e7e5 a8b8 f8h6 b8c8 h6d2 '
    + 'e1d2 d8c8 f1g2 e5e4 g2e4 c7c6 e4c6 d7c6 f2f4 c8g4 h1g1 g4e2 d2e2 g8e7 g1g6 h7g6 e2d2 f7g7 d2c1 h8h2 c1b2 h2c2 d1c2 '
    + 'g6g5 c2c6 e7c6 f4g5 g7h7 b2a2 c6a7 a2b2 a7c6 b2b1 c6a7 b1c2 h7g7 c2c1 g7g6 c1c2 g6g5 c2c3 b5b4 c3b4',
  // 10 Bauernzuege, danach 100 Halbzuege nur mit Figuren, ohne Schlagen und ohne Wiederholung
  fuenfzig: 'e2e4 e7e5 g2g3 g7g6 b2b3 b7b6 a2a4 a7a5 h2h4 h7h5 g1e2 h8h6 e2g1 f8b4 f1g2 a8a7 b1a3 d8e7 e1f1 b4c3 d1e1 h6h8 '
    + 'c1b2 c3b4 e1c1 e7d8 a3b5 b4a3 c1e1 a7b7 g2h3 h8h7 e1b1 a3b4 g1f3 b4c5 h3g2 h7h6 f1e2 d8f6 f3h2 h6h8 e2e1 c5e7 a1a3 '
    + 'e7d8 g2f3 b8a6 b5d4 f6g7 b1a1 g7h7 a1b1 d8f6 e1f1 f6d8 d4c6 g8e7 f3g2 e7d5 f1e1 h8g8 g2f1 a6b8 f1c4 d8f6 a3a2 d5c3 '
    + 'h2f1 f6g5 c4e2 g5e7 f1e3 c3d1 h1g1 e7f8 e3c4 f8a3 c6e7 a3b4 b1c1 b8a6 e2g4 a6c5 e7c6 d1c3 c4a3 g8f8 g4e6 c3b1 a3b5 '
    + 'f8h8 g1g2 b7b8 e6f5 c5b7 b5a3 h7h6 f5e6 h6g7 c6d4 e8e7 e1d1 e7d6 d4e2 g7h7 g2g1 h7g8 g1e1 g8g7',
  // Schwarzer Laeufer auf a6 haelt f1 unter Beschuss: Weiss darf nicht kurz rochieren (Rechte und freie Felder hat er)
  rochadeDurchSchach: 'e2e4 b7b6 g1f3 c8a6 g2g3 b8c6 f1h3 g8f6',
  // Italienisch: Weiss darf kurz rochieren
  rochadeErlaubt: 'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6',
  // Doppelschritt d7d5 neben dem weissen Bauern auf e5: e5d6 schlaegt en passant
  enPassant: 'e2e4 a7a6 e4e5 d7d5',
  // Weisser Bauer auf b7, Feld a8 mit dem schwarzen Turm: b7a8q schlaegt und wandelt um
  umwandlung: 'a2a4 b7b5 a4b5 a7a6 b5a6 c8b7 a6b7 b8c6',
};
const letzterZug = (folge) => folge.split(' ').at(-1);
const ohneLetzten = (folge) => folge.split(' ').slice(0, -1).join(' ');

// ---------------------------------------------------------------------------
// Gefaelschtes Supabase: Anmeldung, Tabelle partien_online (nur Lesen mit Service-Schluessel), online_zug_verbuchen wie
// in online-schema.sql vereinfacht (Stand, Spieler, Seite am Zug, Verbuchen). Ruft nie das Netz.
// ---------------------------------------------------------------------------
function server({ zeile = zeileNach(''), auth = 'ok', laden = 'ok', rpc = 'db', vorLaden = null } = {}) {
  const db = new Map([[PARTIE, { ...zeile, uhr_weiss_ms: null, uhr_schwarz_ms: null, ergebnis: null, grund: null, aktualisiert_am: 't0' }]]);
  const aufrufe = [];
  const json = (status, daten) => ({ ok: status >= 200 && status < 300, status, json: async () => daten });
  const f = async (url, opt = {}) => {
    const u = new URL(url);
    const a = { url, pfad: u.pathname, methode: opt.method, kopf: opt.headers || {}, daten: opt.body ? JSON.parse(opt.body) : null };
    aufrufe.push(a);
    if (u.pathname === '/auth/v1/user') {
      if (auth === 'netz') throw new Error('Netz weg');
      if (auth === '500') return json(500, { msg: 'kaputt' });
      if (auth === 'apikey') return json(401, { message: 'Invalid API key' });
      if (auth === 'ohne-id') return json(200, { email: 'x@example.invalid' });
      const t = String(a.kopf.Authorization || '').replace(/^Bearer /, '');
      const sub = { [JWT_W]: UID_W, [JWT_S]: UID_S, [JWT_X]: UID_X }[t];
      return sub ? json(200, { id: sub, aud: 'authenticated' }) : json(401, { code: 401, msg: 'bad_jwt' });
    }
    if (u.pathname === '/rest/v1/partien_online') {
      if (vorLaden) await vorLaden();
      if (laden === 'netz') throw new Error('Netz weg');
      if (laden === '404') return json(404, { code: 'PGRST205', message: 'Could not find the table' });
      if (laden === '500') return json(500, { message: 'kaputt' });
      const id = (u.searchParams.get('id') || '').replace(/^eq\./, '');
      const z = db.get(id);
      // eine Kopie, wie sie zum Zeitpunkt der Anfrage in der Datenbank stand
      return json(200, z ? [{ id: z.id, weiss: z.weiss, schwarz: z.schwarz, status: z.status, fen: z.fen, zuege: z.zuege, am_zug: z.am_zug }] : []);
    }
    if (u.pathname === '/rest/v1/rpc/online_zug_verbuchen') {
      if (typeof rpc === 'function') return rpc(a, json);
      const d = a.daten;
      const z = db.get(d.partie);
      const raise = (k) => json(400, { code: 'P0001', details: null, hint: null, message: k });
      if (!z || (z.weiss !== d.nutzer && z.schwarz !== d.nutzer)) return raise('ONLINE_PARTIE_UNBEKANNT');
      if (z.status !== 'laeuft') return raise('ONLINE_PARTIE_BEENDET');
      const halbzuege = z.zuege ? z.zuege.split(' ').length : 0;
      if (d.halbzuege_vorher !== halbzuege) return raise('ONLINE_STAND_VERALTET');
      if (z.am_zug !== (z.weiss === d.nutzer ? 'w' : 'b')) return raise('ONLINE_NICHT_DEIN_ZUG');
      Object.assign(z, { zuege: z.zuege ? z.zuege + ' ' + d.zug : d.zug, fen: d.fen_danach, am_zug: d.am_zug_danach,
        status: d.ergebnis ? 'beendet' : 'laeuft', ergebnis: d.ergebnis, grund: d.grund, aktualisiert_am: 't' + (halbzuege + 1) });
      return json(200, { ...z });
    }
    return json(404, { message: 'unbekannt' });
  };
  return { f, aufrufe, db };
}
const anfrage = (daten, { jwt = JWT_W, methode = 'POST', ankunft = '2026-10-29T12:00:00.000Z', roh, zuGross = false } = {}) => ({
  methode, koerper: roh !== undefined ? roh : JSON.stringify(daten), zuGross, autorisierung: jwt ? 'Bearer ' + jwt : null, ankunft,
});
const lese = (r) => { try { return JSON.parse(r.koerper); } catch (e) { return null; } };
const rpcAufrufe = (s) => s.aufrufe.filter((a) => a.pfad === '/rest/v1/rpc/online_zug_verbuchen');

// ---------------------------------------------------------------------------
// Grundwerte und Texte
// ---------------------------------------------------------------------------
pruefe('Grundwerte: hoechstens 512 Bytes, JSON mit CORS fuer POST und OPTIONS, nie zwischengespeichert', MAX_KOERPER === 512
  && KOPF['Access-Control-Allow-Origin'] === '*' && KOPF['Access-Control-Allow-Methods'] === 'POST, OPTIONS'
  && /authorization/.test(KOPF['Access-Control-Allow-Headers']) && /apikey/.test(KOPF['Access-Control-Allow-Headers'])
  && /application\/json/.test(KOPF['Content-Type']) && KOPF['Cache-Control'] === 'no-store');
pruefe('Kennungen: alle mit Rueckfall-Satz, Etappe-1a-Kennungen dabei', KENNUNGEN.length === 13 && KENNUNGEN.every((k) => /^ONLINE_[A-Z_]+$/.test(k) && FEHLER_TEXTE[k].length > 10)
  && ['ONLINE_ZUG_ILLEGAL', 'ONLINE_STAND_VERALTET', 'ONLINE_PARTIE_DEFEKT', 'ONLINE_NICHT_EINGERICHTET', 'ONLINE_SERVER'].every((k) => KENNUNGEN.includes(k)));
{
  const quelle = lies('js/online.js');
  const fehlt = KENNUNGEN.filter((k) => !new RegExp(`get ${k}\\(\\) \\{ return O\\('fehler\\.${k}'\\); \\}`).test(quelle)
    || typeof DE['fehler.' + k] !== 'string' || typeof EN['fehler.' + k] !== 'string' || DE['fehler.' + k] === EN['fehler.' + k]);
  pruefe('js/online.js und js/sprachen/online.js: jede Kennung der Function hat einen Satz auf Deutsch und Englisch', fehlt.length === 0, fehlt);
  pruefe('Texte ruhig: kein Ausrufezeichen, keine Kennung im Satz', KENNUNGEN.every((k) => !/[!]|ONLINE_/.test(DE['fehler.' + k] + EN['fehler.' + k] + FEHLER_TEXTE[k])));
  pruefe('SQL-Kennungen, die durchgereicht werden, sind Kennungen der Function', Object.keys(SQL_KENNUNGEN).every((k) => KENNUNGEN.includes(k))
    && SQL_KENNUNGEN.ONLINE_STAND_VERALTET === 409 && SQL_KENNUNGEN.ONLINE_PARTIE_UNBEKANNT === 404);
}
pruefe('bearer: nur "Bearer <Token>" mit vernuenftiger Laenge', bearer('Bearer ' + JWT_W) === JWT_W && bearer('bearer ' + JWT_W) === null
  && bearer('Bearer kurz') === null && bearer(null) === null && bearer('Basic ' + JWT_W) === null);

// ---------------------------------------------------------------------------
// Eingabe: genau { partie, zug }
// ---------------------------------------------------------------------------
{
  const gut = pruefeEingabe({ partie: PARTIE, zug: 'e2e4' });
  pruefe('Eingabe: { partie, zug } wird angenommen', gut.ok && gut.partie === PARTIE && gut.zug === 'e2e4');
  pruefe('Eingabe: Partie-ID gross geschrieben wird klein', pruefeEingabe({ partie: PARTIE.toUpperCase(), zug: 'e7e8q' }).partie === PARTIE);
  const schlecht = {
    'falsches Matt mitgeschickt (ergebnis, grund)': { partie: PARTIE, zug: 'e2e4', ergebnis: '1-0', grund: 'matt' },
    'erfundene Stellung mitgeschickt (fen_danach)': { partie: PARTIE, zug: 'e2e4', fen_danach: '4k3/8/8/8/8/8/8/4KQ2 b - - 0 1' },
    'Seite am Zug mitgeschickt': { partie: PARTIE, zug: 'e2e4', am_zug_danach: 'b' },
    'fremde Nutzer-ID mitgeschickt': { partie: PARTIE, zug: 'e2e4', nutzer: UID_S },
    'Ankunftszeit mitgeschickt': { partie: PARTIE, zug: 'e2e4', ankunft: '2020-01-01T00:00:00Z' },
    'Zug fehlt': { partie: PARTIE },
    'Partie fehlt': { zug: 'e2e4' },
    'Partie keine UUID': { partie: 'partie-1', zug: 'e2e4' },
    'Partie als Zahl': { partie: 7, zug: 'e2e4' },
    'Liste statt Objekt': [PARTIE, 'e2e4'],
    'null': null,
    'Text': 'e2e4',
  };
  const falsch = Object.entries(schlecht).filter(([, d]) => { const r = pruefeEingabe(d); return r.ok || r.kennung !== 'ONLINE_ANFRAGE'; }).map(([n]) => n);
  pruefe(`Eingabe: ${Object.keys(schlecht).length} falsche Formen (auch falsches Matt und erfundene Stellung) werden abgelehnt`, falsch.length === 0, falsch);
  const zuege = ['e2e9', 'E2E4', 'e2e4 ', ' e2e4', 'e2e4qq', 'e7e8k', 'e2-e4', 'O-O', '', 'e2e4\n'];
  const falschZug = zuege.filter((z) => { const r = pruefeEingabe({ partie: PARTIE, zug: z }); return r.ok || r.kennung !== 'ONLINE_ZUG_FORM'; });
  pruefe('Eingabe: falsche Zugform ist ONLINE_ZUG_FORM', falschZug.length === 0 && pruefeEingabe({ partie: PARTIE, zug: 5 }).kennung === 'ONLINE_ZUG_FORM', falschZug);
}

// ---------------------------------------------------------------------------
// Folgen: noch einmal mit chess.js nachgerechnet, damit die Tests unten wirklich pruefen, was sie sagen
// ---------------------------------------------------------------------------
{
  const vorher = (k) => stellung(ohneLetzten(FOLGEN[k]));
  const nachher = (k) => stellung(FOLGEN[k]);
  pruefe('Folgen: vor dem letzten Zug ist keine der End-Folgen schon zu Ende', ['narrenmatt', 'schaefermatt', 'patt', 'wiederholung', 'material', 'fuenfzig']
    .every((k) => !vorher(k).isGameOver()));
  pruefe('Folgen: danach Matt, Matt, Patt, Wiederholung, Material, 50 Zuege (und jeweils nur das)', nachher('narrenmatt').isCheckmate() && nachher('schaefermatt').isCheckmate()
    && nachher('patt').isStalemate() && !nachher('patt').isInsufficientMaterial()
    && nachher('wiederholung').isThreefoldRepetition() && !nachher('wiederholung').isDrawByFiftyMoves()
    && nachher('material').isInsufficientMaterial() && !nachher('material').isThreefoldRepetition()
    && nachher('fuenfzig').isDrawByFiftyMoves() && !nachher('fuenfzig').isThreefoldRepetition() && !nachher('fuenfzig').isInsufficientMaterial()
    && nachher('fuenfzig').fen().split(' ')[4] === '100');
  const r = stellung(FOLGEN.rochadeDurchSchach);
  pruefe('Folgen: Rochade durch Schach (Weiss am Zug, nicht im Schach, Recht K, f1 und g1 frei, f1 angegriffen)', r.turn() === 'w' && !r.inCheck()
    && r.fen().split(' ')[2].includes('K') && !r.get('f1') && !r.get('g1') && r.isAttacked('f1', 'b'));
}

// ---------------------------------------------------------------------------
// Schach auf dem Server: nachspielen, Uebereinstimmung, Zug pruefen, Ende ausrechnen
// ---------------------------------------------------------------------------
{
  const c = nachspielen(Chess, 'e2e4 e7e5');
  pruefe('nachspielen: legale Zuege ergeben die Stellung', c && c.fen() === stellung('e2e4 e7e5').fen());
  pruefe('nachspielen: leere Liste ist die Grundstellung', nachspielen(Chess, '').fen() === START);
  pruefe('nachspielen: illegaler Zug, kaputte Form oder zu lange Liste ergeben null', nachspielen(Chess, 'e2e4 e7e5 e1e3') === null
    && nachspielen(Chess, 'e2e4 E7E5') === null && nachspielen(Chess, null) === null && nachspielen(Chess, 'e2e4 '.repeat(4001)) === null);
  const z = zeileNach('e2e4');
  pruefe('stimmtUeberein: gleiche Stellung', stimmtUeberein(stellung('e2e4'), z));
  const t = z.fen.split(' ');
  pruefe('stimmtUeberein: nur Zaehler, Rochaderechte oder en passant anders ist kein Widerspruch (wie im Browser)',
    stimmtUeberein(stellung('e2e4'), { ...z, fen: [t[0], t[1], 'Kq', '-', '7', '23'].join(' ') }));
  pruefe('stimmtUeberein: anderes Brett, andere Seite im FEN oder in am_zug ist ein Widerspruch',
    !stimmtUeberein(stellung('e2e4'), { ...z, fen: z.fen.replace('rnbqkbnr', 'rnb1kbnr') })
    && !stimmtUeberein(stellung('e2e4'), { ...z, fen: z.fen.replace(' b ', ' w ') })
    && !stimmtUeberein(stellung('e2e4'), { ...z, am_zug: 'w' }));
}
{
  const r = rechneZug(Chess, zeileNach(''), UID_W, 'e2e4');
  pruefe('rechneZug: e2e4 aus der Grundstellung (Stellung, Schwarz am Zug, kein Ende, Stand 0)', r.ok && r.zug === 'e2e4'
    && r.fen === stellung('e2e4').fen() && r.amZug === 'b' && r.ergebnis === null && r.grund === null && r.halbzuegeVorher === 0, r);
  const illegal = ['e2e5', 'e1e2', 'b1b3', 'e7e5', 'a1a8', 'd1h5', 'e2d3'].filter((u) => rechneZug(Chess, zeileNach(''), UID_W, u).kennung !== 'ONLINE_ZUG_ILLEGAL');
  pruefe('rechneZug: illegale Zuege (falsche Gangart, verstellt, fremde Figur, leeres Feld) sind ONLINE_ZUG_ILLEGAL', illegal.length === 0, illegal);
  pruefe('rechneZug: Schwarz am Zug, Weiss zieht -> ONLINE_NICHT_DEIN_ZUG', rechneZug(Chess, zeileNach('e2e4'), UID_W, 'd2d4').kennung === 'ONLINE_NICHT_DEIN_ZUG'
    && rechneZug(Chess, zeileNach(''), UID_S, 'e7e5').kennung === 'ONLINE_NICHT_DEIN_ZUG');
  pruefe('rechneZug: Dritter -> ONLINE_PARTIE_UNBEKANNT, offen -> NICHT_GESTARTET, beendet -> BEENDET',
    rechneZug(Chess, zeileNach(''), UID_X, 'e2e4').kennung === 'ONLINE_PARTIE_UNBEKANNT' && rechneZug(Chess, null, UID_W, 'e2e4').kennung === 'ONLINE_PARTIE_UNBEKANNT'
    && rechneZug(Chess, zeileNach('', { status: 'offen', schwarz: null }), UID_W, 'e2e4').kennung === 'ONLINE_PARTIE_NICHT_GESTARTET'
    && rechneZug(Chess, zeileNach('', { status: 'beendet' }), UID_W, 'e2e4').kennung === 'ONLINE_PARTIE_BEENDET');
  // erfundene Stellung (L2 im Konzept): Die gespeicherte Stellung passt nicht zu den Zuegen, z. B. die schwarze Dame fehlt
  const erfunden = zeileNach('e2e4 e7e5', { fen: stellung('e2e4 e7e5').fen().replace('rnbqkbnr', 'rnb1kbnr') });
  const illegaleListe = { ...zeileNach('e2e4 e7e5'), zuege: 'e2e4 e7e5 d1h7' };
  pruefe('rechneZug: erfundene Stellung, illegaler Zug in der Liste oder falsche Seite in am_zug -> ONLINE_PARTIE_DEFEKT',
    rechneZug(Chess, erfunden, UID_W, 'g1f3').kennung === 'ONLINE_PARTIE_DEFEKT' && rechneZug(Chess, illegaleListe, UID_S, 'g8f6').kennung === 'ONLINE_PARTIE_DEFEKT'
    && rechneZug(Chess, zeileNach('e2e4 e7e5', { am_zug: 'b' }), UID_S, 'g8f6').kennung === 'ONLINE_PARTIE_DEFEKT');
  const rochade = rechneZug(Chess, zeileNach(FOLGEN.rochadeDurchSchach), UID_W, 'e1g1');
  const rochadeOk = rechneZug(Chess, zeileNach(FOLGEN.rochadeErlaubt), UID_W, 'e1g1');
  const rochadeTurm = rechneZug(Chess, zeileNach(FOLGEN.rochadeErlaubt), UID_W, 'e1h1');
  pruefe('Rochade durch Schach (f1 angegriffen) wird abgelehnt, eine erlaubte Rochade geht (Turm springt mit)', rochade.kennung === 'ONLINE_ZUG_ILLEGAL'
    && rochadeOk.ok && rochadeOk.zug === 'e1g1' && rochadeOk.fen.startsWith('r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq')
    && rochadeTurm.kennung === 'ONLINE_ZUG_ILLEGAL', { rochade, rochadeOk, rochadeTurm });
  const ep = rechneZug(Chess, zeileNach(FOLGEN.enPassant), UID_W, 'e5d6');
  pruefe('en passant geht: Der geschlagene Bauer auf d5 verschwindet', ep.ok && ep.zug === 'e5d6' && ep.fen.split(' ')[0] === 'rnbqkbnr/1pp1pppp/p2P4/8/8/8/PPPP1PPP/RNBQKBNR'
    && ep.halbzuegeVorher === 4, ep);
  const umw = rechneZug(Chess, zeileNach(FOLGEN.umwandlung), UID_W, 'b7a8q');
  const unter = rechneZug(Chess, zeileNach(FOLGEN.umwandlung), UID_W, 'b7a8n');
  const ohne = rechneZug(Chess, zeileNach(FOLGEN.umwandlung), UID_W, 'b7a8');
  pruefe('Umwandlung geht (Dame und Unterverwandlung), ohne Figur ist sie nicht erlaubt', umw.ok && umw.zug === 'b7a8q' && umw.fen.startsWith('Q2qkbnr/')
    && unter.ok && unter.zug === 'b7a8n' && unter.fen.startsWith('N2qkbnr/') && ohne.kennung === 'ONLINE_ZUG_ILLEGAL', { umw, unter, ohne });
  const q = rechneZug(Chess, zeileNach(''), UID_W, 'e2e4q');
  const q2 = rechneZug(Chess, zeileNach('e2e4'), UID_S, 'g8f6n');
  pruefe('e2e4q wird als e2e4 gespeichert (der Umwandlungsbuchstabe faellt weg, wie in chess.js)', q.ok && q.zug === 'e2e4' && q.fen === stellung('e2e4').fen()
    && q2.ok && q2.zug === 'g8f6', { q, q2 });
}
{
  const amEnde = (k, uid) => rechneZug(Chess, zeileNach(ohneLetzten(FOLGEN[k])), uid, letzterZug(FOLGEN[k]));
  const narr = amEnde('narrenmatt', UID_S);
  const schaefer = amEnde('schaefermatt', UID_W);
  pruefe('Matt: das Ergebnis rechnet der Server (Schwarz setzt matt: 0-1, Weiss: 1-0)', narr.ok && narr.ergebnis === '0-1' && narr.grund === 'matt'
    && schaefer.ok && schaefer.ergebnis === '1-0' && schaefer.grund === 'matt', { narr, schaefer });
  const patt = amEnde('patt', UID_W);
  pruefe('Patt: 1/2-1/2, Grund patt', patt.ok && patt.ergebnis === '1/2-1/2' && patt.grund === 'patt', patt);
  const mat = amEnde('material', UID_W);
  pruefe('Zu wenig Material (Koenig gegen Koenig und Springer): 1/2-1/2, Grund material', mat.ok && mat.ergebnis === '1/2-1/2' && mat.grund === 'material', mat);
  const wdh = amEnde('wiederholung', UID_S);
  pruefe('Dreifache Wiederholung: 1/2-1/2, Grund wiederholung (die ganze Zugliste zaehlt)', wdh.ok && wdh.ergebnis === '1/2-1/2' && wdh.grund === 'wiederholung'
    && wdh.halbzuegeVorher === 7, wdh);
  const zweimal = rechneZug(Chess, zeileNach('g1f3 g8f6 f3g1'), UID_S, 'f6g8');
  pruefe('Zweimal dieselbe Stellung ist noch keine Wiederholung', zweimal.ok && zweimal.ergebnis === null, zweimal);
  const fuenfzig = amEnde('fuenfzig', UID_S);
  pruefe('50 Zuege ohne Bauernzug und ohne Schlagen: 1/2-1/2, Grund 50-zuege', fuenfzig.ok && fuenfzig.ergebnis === '1/2-1/2' && fuenfzig.grund === '50-zuege'
    && fuenfzig.halbzuegeVorher === 109, fuenfzig);
  const kurzVorher = rechneZug(Chess, zeileNach(FOLGEN.fuenfzig.split(' ').slice(0, -2).join(' ')), UID_W, FOLGEN.fuenfzig.split(' ').at(-2));
  pruefe('Nach 99 ruhigen Halbzuegen noch kein Ende', kurzVorher.ok && kurzVorher.ergebnis === null, kurzVorher);
  pruefe('ende(): ohne Ende null und null', JSON.stringify(ende(stellung('e2e4'))) === '{"ergebnis":null,"grund":null}');
}

// ---------------------------------------------------------------------------
// verarbeite(): Methoden, Einrichtung, Anmeldung, Groesse, Eingabe
// ---------------------------------------------------------------------------
const ZUG = { partie: PARTIE, zug: 'e2e4' };
{
  const s = server();
  const o = await verarbeite({ methode: 'OPTIONS' }, UMGEBUNG, { fetch: s.f, Chess });
  pruefe('OPTIONS: 204 ohne Koerper, mit CORS', o.status === 204 && o.koerper === '' && o.kopf['Access-Control-Allow-Origin'] === '*');
  const g = await verarbeite({ methode: 'GET' }, UMGEBUNG, { fetch: s.f, Chess });
  pruefe('GET: 405 ONLINE_METHODE', g.status === 405 && lese(g).fehler === 'ONLINE_METHODE' && lese(g).text === FEHLER_TEXTE.ONLINE_METHODE);
  const zeilen = [];
  const ohne = [
    await verarbeite(anfrage(ZUG), { ...UMGEBUNG, SUPABASE_URL: '' }, { fetch: s.f, Chess, protokoll: (z) => zeilen.push(z) }),
    await verarbeite(anfrage(ZUG), { ...UMGEBUNG, SUPABASE_SERVICE_ROLE_KEY: '' }, { fetch: s.f, Chess }),
    await verarbeite(anfrage(ZUG), UMGEBUNG, { fetch: s.f }),
  ];
  pruefe('ohne URL, Service-Schluessel oder chess.js: 503 ONLINE_NICHT_EINGERICHTET, Zeile im Protokoll, keine Anfrage', ohne.every((r) => r.status === 503
    && lese(r).fehler === 'ONLINE_NICHT_EINGERICHTET') && zeilen[0] === 'online-zug nicht_eingerichtet' && s.aufrufe.length === 0);
  const k = await verarbeite(anfrage(ZUG, { jwt: null }), UMGEBUNG, { fetch: s.f, Chess });
  const k2 = await verarbeite({ ...anfrage(ZUG), autorisierung: 'Bearer kurz' }, UMGEBUNG, { fetch: s.f, Chess });
  pruefe('ohne gueltige Anmeldung (kein oder kaputtes Token): 401 ONLINE_NICHT_ANGEMELDET, keine Anfrage', k.status === 401 && k2.status === 401
    && lese(k).fehler === 'ONLINE_NICHT_ANGEMELDET' && s.aufrufe.length === 0);
  const gross = await verarbeite(anfrage(null, { roh: JSON.stringify({ partie: PARTIE, zug: 'e2e4', x: 'y'.repeat(600) }) }), UMGEBUNG, { fetch: s.f, Chess });
  const gross2 = await verarbeite(anfrage(ZUG, { zuGross: true }), UMGEBUNG, { fetch: s.f, Chess });
  pruefe('zu gross: 413 ONLINE_ANFRAGE, keine Anfrage', gross.status === 413 && gross2.status === 413 && lese(gross).fehler === 'ONLINE_ANFRAGE' && s.aufrufe.length === 0);
  const leer = await verarbeite(anfrage(null, { roh: '' }), UMGEBUNG, { fetch: s.f, Chess });
  const kaputt = await verarbeite(anfrage(null, { roh: '{"partie":' }), UMGEBUNG, { fetch: s.f, Chess });
  const extra = await verarbeite(anfrage({ ...ZUG, ergebnis: '1-0', grund: 'matt' }), UMGEBUNG, { fetch: s.f, Chess });
  const fen = await verarbeite(anfrage({ ...ZUG, fen_danach: '4k3/8/8/8/8/8/8/4KQ2 b - - 0 1' }), UMGEBUNG, { fetch: s.f, Chess });
  const form = await verarbeite(anfrage({ partie: PARTIE, zug: 'e2e9' }), UMGEBUNG, { fetch: s.f, Chess });
  pruefe('leer, kein JSON, falsches Matt oder erfundene Stellung im Koerper: 400 ONLINE_ANFRAGE; Zugform 400 ONLINE_ZUG_FORM; keine Anfrage',
    [leer, kaputt, extra, fen].every((r) => r.status === 400 && lese(r).fehler === 'ONLINE_ANFRAGE') && form.status === 400 && lese(form).fehler === 'ONLINE_ZUG_FORM'
    && s.aufrufe.length === 0);
}
{
  const zeilen = [];
  const p = (z) => zeilen.push(z);
  const a401 = await verarbeite(anfrage(ZUG, { jwt: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.abgelaufenes-token' }), UMGEBUNG, { fetch: server().f, Chess, protokoll: p });
  const aKey = await verarbeite(anfrage(ZUG), UMGEBUNG, { fetch: server({ auth: 'apikey' }).f, Chess, protokoll: p });
  const aNetz = await verarbeite(anfrage(ZUG), UMGEBUNG, { fetch: server({ auth: 'netz' }).f, Chess, protokoll: p });
  const a500 = await verarbeite(anfrage(ZUG), UMGEBUNG, { fetch: server({ auth: '500' }).f, Chess, protokoll: p });
  const aOhne = await verarbeite(anfrage(ZUG), UMGEBUNG, { fetch: server({ auth: 'ohne-id' }).f, Chess, protokoll: p });
  pruefe('Anmeldung ueber /auth/v1/user: abgelehnt 401, falscher Projekt-Schluessel 503 nicht eingerichtet, Netz/500 503 ONLINE_SERVER, ohne ID 401',
    a401.status === 401 && lese(a401).fehler === 'ONLINE_NICHT_ANGEMELDET' && aKey.status === 503 && lese(aKey).fehler === 'ONLINE_NICHT_EINGERICHTET'
    && aNetz.status === 503 && lese(aNetz).fehler === 'ONLINE_SERVER' && a500.status === 503 && aOhne.status === 401
    && zeilen.includes('online-zug anmeldung 401') && zeilen.includes('online-zug nicht_eingerichtet apikey'), zeilen);
  const s = server();
  await verarbeite(anfrage(ZUG), UMGEBUNG, { fetch: s.f, Chess });
  const auth = s.aufrufe[0];
  pruefe('Anmeldung: GET /auth/v1/user mit dem Token der Person und dem oeffentlichen Schluessel', auth.pfad === '/auth/v1/user' && auth.methode === 'GET'
    && auth.kopf.Authorization === 'Bearer ' + JWT_W && auth.kopf.apikey === 'anon-probe');
}

// ---------------------------------------------------------------------------
// verarbeite(): Laden, Pruefen, Verbuchen
// ---------------------------------------------------------------------------
{
  const s = server();
  const r = await verarbeite(anfrage(ZUG, { ankunft: '2026-10-29T12:00:01.250Z' }), UMGEBUNG, { fetch: s.f, Chess });
  const d = lese(r);
  const laden = s.aufrufe[1];
  const rpc = rpcAufrufe(s)[0];
  pruefe('Zug: 200 mit der verbuchten Partie (Zeile wie bisher von online_zug)', r.status === 200 && d.id === PARTIE && d.zuege === 'e2e4' && d.am_zug === 'b'
    && d.status === 'laeuft' && r.kopf['Access-Control-Allow-Origin'] === '*', d);
  pruefe('Laden: nur die noetigen Spalten mit dem Service-Schluessel', laden.methode === 'GET'
    && laden.url === `${UMGEBUNG.SUPABASE_URL}/rest/v1/partien_online?id=eq.${PARTIE}&select=id,weiss,schwarz,status,fen,zuege,am_zug`
    && laden.kopf.apikey === DIENST);
  pruefe('Verbuchen: POST rpc/online_zug_verbuchen mit Service-Schluessel, nur vom Server berechnete Werte, Nutzer aus der Anmeldung',
    rpc && rpc.methode === 'POST' && rpc.kopf.apikey === DIENST && JSON.stringify(rpc.daten) === JSON.stringify({
      partie: PARTIE, nutzer: UID_W, zug: 'e2e4', fen_danach: stellung('e2e4').fen(), am_zug_danach: 'b', ergebnis: null, grund: null,
      ankunft: '2026-10-29T12:00:01.250Z', halbzuege_vorher: 0,
    }), rpc && rpc.daten);
  const s2 = server();
  const r2 = await verarbeite(anfrage(ZUG, { ankunft: 'gestern' }), UMGEBUNG, { fetch: s2.f, Chess, jetzt: () => Date.parse('2026-10-29T13:14:15.000Z') });
  const s3 = server();
  await verarbeite(anfrage(ZUG, { ankunft: null }), UMGEBUNG, { fetch: s3.f, Chess, jetzt: () => Date.parse('2026-10-29T13:14:16.000Z') });
  pruefe('Ankunftszeit: von der Huelle gemessen und weitergegeben; unlesbar oder fehlend gilt jetzt (die Datenbank begrenzt sie noch einmal)',
    r2.status === 200 && rpcAufrufe(s2)[0].daten.ankunft === '2026-10-29T13:14:15.000Z' && rpcAufrufe(s3)[0].daten.ankunft === '2026-10-29T13:14:16.000Z');
}
{
  const zeilen = [];
  const amEnde = async (k, jwt) => {
    const s = server({ zeile: zeileNach(ohneLetzten(FOLGEN[k])) });
    const r = await verarbeite(anfrage({ partie: PARTIE, zug: letzterZug(FOLGEN[k]) }, { jwt }), UMGEBUNG, { fetch: s.f, Chess, protokoll: (z) => zeilen.push(z) });
    return { r, d: lese(r), rpc: rpcAufrufe(s)[0]?.daten };
  };
  const m = await amEnde('narrenmatt', JWT_S);
  pruefe('Matt ueber verarbeite(): ergebnis 0-1 und grund matt kommen vom Server, die Partie ist beendet', m.r.status === 200 && m.rpc.ergebnis === '0-1'
    && m.rpc.grund === 'matt' && m.d.status === 'beendet' && m.d.ergebnis === '0-1', m.rpc);
  const ende5 = [await amEnde('patt', JWT_W), await amEnde('material', JWT_W), await amEnde('wiederholung', JWT_S), await amEnde('fuenfzig', JWT_S)];
  pruefe('Patt, Material, Wiederholung, 50 Zuege ueber verarbeite(): Remis mit dem Grund vom Server', ende5.map((e) => e.r.status === 200 && e.rpc.ergebnis === '1/2-1/2' && e.rpc.grund).join(',')
    === 'patt,material,wiederholung,50-zuege', ende5.map((e) => e.rpc));
  pruefe('Protokoll: Ende nur als Grund ("online-zug ende matt"), keine Zuege, keine Nutzer-IDs', zeilen.includes('online-zug ende matt') && zeilen.includes('online-zug ende 50-zuege')
    && zeilen.every((z) => /^online-zug [a-z_ 0-9-]+$/.test(z) && !z.includes(UID_W) && !z.includes(UID_S)), zeilen);
}
{
  const zeilen = [];
  const p = (z) => zeilen.push(z);
  const s = server();
  const il = await verarbeite(anfrage({ partie: PARTIE, zug: 'e2e5' }), UMGEBUNG, { fetch: s.f, Chess, protokoll: p });
  pruefe('illegaler Zug: 422 ONLINE_ZUG_ILLEGAL, nichts verbucht, Protokoll "online-zug illegal"', il.status === 422 && lese(il).fehler === 'ONLINE_ZUG_ILLEGAL'
    && rpcAufrufe(s).length === 0 && zeilen.includes('online-zug illegal') && s.db.get(PARTIE).zuege === '');
  const sR = server({ zeile: zeileNach(FOLGEN.rochadeDurchSchach) });
  const ro = await verarbeite(anfrage({ partie: PARTIE, zug: 'e1g1' }), UMGEBUNG, { fetch: sR.f, Chess });
  pruefe('Rochade durch Schach ueber verarbeite(): 422, nichts verbucht', ro.status === 422 && rpcAufrufe(sR).length === 0);
  const sE = server({ zeile: zeileNach('e2e4 e7e5', { fen: stellung('e2e4 e7e5').fen().replace('rnbqkbnr', 'rnb1kbnr') }) });
  const ef = await verarbeite(anfrage({ partie: PARTIE, zug: 'g1f3' }), UMGEBUNG, { fetch: sE.f, Chess, protokoll: p });
  pruefe('erfundene Stellung auf dem Server: 409 ONLINE_PARTIE_DEFEKT, nichts verbucht, Protokoll "online-zug defekt"', ef.status === 409
    && lese(ef).fehler === 'ONLINE_PARTIE_DEFEKT' && rpcAufrufe(sE).length === 0 && zeilen.includes('online-zug defekt'));
  const sQ = server();
  const eq = await verarbeite(anfrage({ partie: PARTIE, zug: 'e2e4q' }), UMGEBUNG, { fetch: sQ.f, Chess });
  pruefe('e2e4q ueber verarbeite(): verbucht als e2e4', eq.status === 200 && rpcAufrufe(sQ)[0].daten.zug === 'e2e4' && lese(eq).zuege === 'e2e4');
  const sU = server({ zeile: zeileNach(FOLGEN.umwandlung) });
  const um = await verarbeite(anfrage({ partie: PARTIE, zug: 'b7a8q' }), UMGEBUNG, { fetch: sU.f, Chess });
  const sP = server({ zeile: zeileNach(FOLGEN.enPassant) });
  const ep = await verarbeite(anfrage({ partie: PARTIE, zug: 'e5d6' }), UMGEBUNG, { fetch: sP.f, Chess });
  pruefe('Umwandlung und en passant ueber verarbeite(): 200, verbucht', um.status === 200 && rpcAufrufe(sU)[0].daten.zug === 'b7a8q'
    && ep.status === 200 && rpcAufrufe(sP)[0].daten.fen_danach.startsWith('rnbqkbnr/1pp1pppp/p2P4/8/'));
  const nz = await verarbeite(anfrage(ZUG, { jwt: JWT_S }), UMGEBUNG, { fetch: server().f, Chess });
  const fremd = await verarbeite(anfrage(ZUG, { jwt: JWT_X }), UMGEBUNG, { fetch: server().f, Chess });
  const fehlt = await verarbeite(anfrage({ partie: '3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a6b', zug: 'e2e4' }), UMGEBUNG, { fetch: server().f, Chess });
  const offen = await verarbeite(anfrage(ZUG), UMGEBUNG, { fetch: server({ zeile: zeileNach('', { status: 'offen', schwarz: null }) }).f, Chess });
  const vorbei = await verarbeite(anfrage(ZUG), UMGEBUNG, { fetch: server({ zeile: zeileNach('', { status: 'beendet' }) }).f, Chess });
  pruefe('nicht am Zug 409, fremde oder unbekannte Partie 404, nicht gestartet 409, beendet 409', nz.status === 409 && lese(nz).fehler === 'ONLINE_NICHT_DEIN_ZUG'
    && fremd.status === 404 && lese(fremd).fehler === 'ONLINE_PARTIE_UNBEKANNT' && fehlt.status === 404
    && offen.status === 409 && lese(offen).fehler === 'ONLINE_PARTIE_NICHT_GESTARTET' && vorbei.status === 409 && lese(vorbei).fehler === 'ONLINE_PARTIE_BEENDET');
}
{
  // Zwei Zuege gleichzeitig (Doppelklick, zwei Tabs): Beide laden denselben Stand, bevor einer verbucht. Die Datenbank
  // nimmt den ersten und lehnt den zweiten als veraltet ab.
  let geladen = 0;
  let weiter;
  const beide = new Promise((r) => { weiter = r; });
  const s = server({ vorLaden: async () => { geladen++; if (geladen === 2) weiter(); await beide; } });
  const zeilen = [];
  const [a, b] = await Promise.all([
    verarbeite(anfrage({ partie: PARTIE, zug: 'e2e4' }), UMGEBUNG, { fetch: s.f, Chess, protokoll: (z) => zeilen.push(z) }),
    verarbeite(anfrage({ partie: PARTIE, zug: 'd2d4' }), UMGEBUNG, { fetch: s.f, Chess, protokoll: (z) => zeilen.push(z) }),
  ]);
  const st = [a.status, b.status].sort().join(',');
  const verloren = a.status === 409 ? a : b;
  pruefe('Zwei Zuege gleichzeitig: einer gilt (200), der andere ist ONLINE_STAND_VERALTET (409), genau ein Zug verbucht', st === '200,409'
    && lese(verloren).fehler === 'ONLINE_STAND_VERALTET' && rpcAufrufe(s).length === 2 && rpcAufrufe(s).every((x) => x.daten.halbzuege_vorher === 0)
    && s.db.get(PARTIE).zuege.split(' ').length === 1 && zeilen.includes('online-zug veraltet'), { st, zuege: s.db.get(PARTIE).zuege });
}
{
  // Antworten der Datenbank auf das Verbuchen
  const mit = (rpc) => server({ rpc });
  const roh = (status, daten) => (a, json) => json(status, daten);
  const zeilen = [];
  const p = (z) => zeilen.push(z);
  const beendet = await verarbeite(anfrage(ZUG), UMGEBUNG, { fetch: mit(roh(400, { code: 'P0001', message: 'ONLINE_PARTIE_BEENDET' })).f, Chess });
  const fehltFn = await verarbeite(anfrage(ZUG), UMGEBUNG, { fetch: mit(roh(404, { code: 'PGRST202', message: 'Could not find the function' })).f, Chess, protokoll: p });
  const kaputt = await verarbeite(anfrage(ZUG), UMGEBUNG, { fetch: mit(roh(500, { message: 'internal' })).f, Chess, protokoll: p });
  const wider = await verarbeite(anfrage(ZUG), UMGEBUNG, { fetch: mit(roh(400, { code: 'P0001', message: 'ONLINE_STELLUNG_FALSCH' })).f, Chess, protokoll: p });
  const fremdText = await verarbeite(anfrage(ZUG), UMGEBUNG, { fetch: mit(roh(400, { code: '42501', message: 'permission denied for function online_zug_verbuchen' })).f, Chess, protokoll: p });
  const netz = await verarbeite(anfrage(ZUG), UMGEBUNG, { fetch: mit(() => { throw new Error('Netz weg'); }).f, Chess, protokoll: p });
  const leer = await verarbeite(anfrage(ZUG), UMGEBUNG, { fetch: mit(roh(200, null)).f, Chess, protokoll: p });
  pruefe('Verbuchen: SQL-Kennung durchgereicht (PARTIE_BEENDET 409), Funktion fehlt 503 nicht eingerichtet, sonst 503 ONLINE_SERVER',
    beendet.status === 409 && lese(beendet).fehler === 'ONLINE_PARTIE_BEENDET' && fehltFn.status === 503 && lese(fehltFn).fehler === 'ONLINE_NICHT_EINGERICHTET'
    && [kaputt, wider, fremdText, netz, leer].every((r) => r.status === 503 && lese(r).fehler === 'ONLINE_SERVER'));
  pruefe('Verbuchen: Widerspruch zwischen Function und Datenbank steht im Protokoll, fremde Texte nicht', zeilen.includes('online-zug nicht_eingerichtet sql')
    && zeilen.includes('online-zug widerspruch ONLINE_STELLUNG_FALSCH') && zeilen.includes('online-zug server buchen 500')
    && zeilen.includes('online-zug server buchen 400') && zeilen.includes('online-zug server buchen netz') && !zeilen.some((z) => /permission|internal|Netz weg/.test(z)), zeilen);
  // Zeitende vor dem Zug: Die Datenbank beendet die Partie (hier gegen den blanken Koenig: Remis zeit-material), der Zug
  // verfaellt, die Antwort ist trotzdem die Zeile
  const zeitende = { id: PARTIE, weiss: UID_W, schwarz: UID_S, status: 'beendet', ergebnis: '1/2-1/2', grund: 'zeit-material', zuege: 'e2e4 e7e5', am_zug: 'w',
    fen: '4k3/8/8/2n5/8/8/8/4K3 w - - 0 40', uhr_weiss_ms: 0, uhr_schwarz_ms: 41000 };
  const zz = [];
  const z = await verarbeite(anfrage({ partie: PARTIE, zug: 'g1f3' }), UMGEBUNG, { fetch: server({ zeile: zeileNach('e2e4 e7e5'), rpc: roh(200, zeitende) }).f, Chess, protokoll: (x) => zz.push(x) });
  pruefe('Zeitende gegen den blanken Koenig (von der Datenbank): 200 mit 1/2-1/2 und Grund zeit-material', z.status === 200 && lese(z).ergebnis === '1/2-1/2'
    && lese(z).grund === 'zeit-material' && zz.includes('online-zug ende zeit-material'));
  const lad404 = await verarbeite(anfrage(ZUG), UMGEBUNG, { fetch: server({ laden: '404' }).f, Chess });
  const lad500 = await verarbeite(anfrage(ZUG), UMGEBUNG, { fetch: server({ laden: '500' }).f, Chess });
  const ladNetz = await verarbeite(anfrage(ZUG), UMGEBUNG, { fetch: server({ laden: 'netz' }).f, Chess });
  pruefe('Laden: Tabelle fehlt 503 nicht eingerichtet, Fehler oder Netz 503 ONLINE_SERVER', lad404.status === 503 && lese(lad404).fehler === 'ONLINE_NICHT_EINGERICHTET'
    && lad500.status === 503 && lese(lad500).fehler === 'ONLINE_SERVER' && ladNetz.status === 503);
}
{
  // Nie ein Stacktrace, ein Fehlertext oder ein Schluessel in Antworten oder im Protokoll
  class KaputtesSchach { constructor() { throw new Error('geheimer Stack ' + DIENST); } }
  const zeilen = [];
  const r1 = await verarbeite(anfrage(ZUG), UMGEBUNG, { fetch: server().f, Chess: KaputtesSchach, protokoll: (z) => zeilen.push(z) });
  const r2 = await verarbeite(anfrage(ZUG), UMGEBUNG, { fetch: server().f, Chess, protokoll: () => { throw new Error('Protokoll kaputt'); } });
  const alle = [r1, r2];
  for (const [k, v] of [['auth', 'netz'], ['laden', 'netz']]) alle.push(await verarbeite(anfrage(ZUG), UMGEBUNG, { fetch: server({ [k]: v }).f, Chess, protokoll: (z) => zeilen.push(z) }));
  const texte = alle.map((r) => r.koerper).join('\n') + '\n' + zeilen.join('\n');
  pruefe('kaputtes chess.js: 503 ONLINE_SERVER statt Absturz; ein kaputtes Protokoll stoert nie', r1.status === 503 && lese(r1).fehler === 'ONLINE_SERVER' && r2.status === 200);
  pruefe('keine Stacktraces, Fehlertexte oder Schluessel in Antworten und Protokoll', !/geheimer|Stack|Error|at \S+:\d+|sb_secret|anon-probe|Netz weg/.test(texte), texte.slice(0, 300));
  pruefe('jede Fehlerantwort hat genau { fehler, text }', alle.filter((r) => r.status >= 400).every((r) => JSON.stringify(Object.keys(lese(r))) === '["fehler","text"]'));
}

// ---------------------------------------------------------------------------
// leseKoerper: hoechstens MAX_KOERPER Bytes
// ---------------------------------------------------------------------------
{
  const k1 = await leseKoerper(new Request('https://probe.example/', { method: 'POST', body: JSON.stringify(ZUG) }));
  const k2 = await leseKoerper(new Request('https://probe.example/', { method: 'POST', body: 'x'.repeat(600) }));
  let gelesen = 0;
  const strom = new ReadableStream({ pull(c) { gelesen++; if (gelesen > 50) { c.close(); return; } c.enqueue(new TextEncoder().encode('y'.repeat(100))); } });
  const k3 = await leseKoerper(new Request('https://probe.example/', { method: 'POST', body: strom, duplex: 'half' }));
  const k4 = await leseKoerper(new Request('https://probe.example/', { method: 'POST', body: new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]) }));
  const k5 = await leseKoerper({ headers: new Headers({ 'content-length': '99999' }), body: null });
  pruefe('leseKoerper: kleiner Koerper als Text, zu grosser (Content-Length oder Strom ohne Laenge) wird nicht weiter gelesen, kaputtes UTF-8 leer',
    k1.text === JSON.stringify(ZUG) && !k1.zuGross && k2.zuGross && k3.zuGross && gelesen <= 8 && k4.text === '' && !k4.zuGross && k5.zuGross, { k3, gelesen });
}

// ---------------------------------------------------------------------------
// Deno-Huelle online-zug/index.ts (Node entfernt die Typen; Deno ist hier nicht installiert; npm:chess.js wird auf
// vendor/chess umgelenkt, dieselbe Datei wie im npm-Paket 1.4.0)
// ---------------------------------------------------------------------------
{
  const ts = lies('supabase/functions/online-zug/index.ts');
  const imp = ts.match(/^import .*$/gm) || [];
  pruefe('index.ts: nur die Huelle (chess.js in fester Version 1.4.0, verarbeite und leseKoerper aus _gemeinsam, Supabase-Werte aus Deno.env)',
    imp.length === 2 && imp[0] === "import { Chess } from 'npm:chess.js@1.4.0';" && imp[1] === "import { leseKoerper, verarbeite } from '../_gemeinsam/online-zug.js';"
    && ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].every((k) => ts.includes(`Deno.env.get('${k}')`))
    && (ts.match(/Deno\.env\.get\(/g) || []).length === 3 && ts.split('\n').length < 50, imp);
  pruefe('index.ts: Ankunftszeit als Erstes gemessen, vor dem Lesen des Koerpers', ts.indexOf('const ankunft = new Date().toISOString();') > 0
    && ts.indexOf('const ankunft = new Date().toISOString();') < ts.indexOf('await leseKoerper(anfrage)'));
  if (process.features && process.features.typescript && typeof module.registerHooks === 'function') {
    const chessUrl = pathToFileURL(path.join(WURZEL, 'vendor/chess/chess.js')).href;
    const haken = module.registerHooks({
      resolve(spec, kontext, weiter) {
        if (spec === 'npm:chess.js@1.4.0') return { url: chessUrl, shortCircuit: true };
        return weiter(spec, kontext);
      },
    });
    let env = { SUPABASE_URL: UMGEBUNG.SUPABASE_URL, SUPABASE_ANON_KEY: 'anon-probe', SUPABASE_SERVICE_ROLE_KEY: DIENST };
    let handler = null;
    globalThis.Deno = { env: { get: (k) => { if (env === null) throw new Error('env kaputt ' + DIENST); return env[k]; } }, serve: (fn) => { handler = fn; } };
    const s = server();
    const echtesFetch = globalThis.fetch;
    globalThis.fetch = s.f;
    const log = console.log;
    const zeilen = [];
    console.log = (...a) => zeilen.push(a.join(' '));
    try {
      await import(pathToFileURL(path.join(WURZEL, 'supabase/functions/online-zug/index.ts')).href);
      const url = 'https://probe.supabase.example/functions/v1/online-zug';
      const post = (koerper, kopf = { Authorization: 'Bearer ' + JWT_W }) => handler(new Request(url, { method: 'POST', body: koerper, headers: kopf }));
      const vorher = Date.now();
      const r = await post(JSON.stringify(ZUG));
      const d = await r.json();
      const ank = Date.parse(rpcAufrufe(s)[0]?.daten?.ankunft);
      const o = await handler(new Request(url, { method: 'OPTIONS' }));
      pruefe('index.ts laeuft: 200 mit der Partie, Ankunftszeit gemessen, OPTIONS 204 ohne Koerper (Deno-Attrappe)', typeof handler === 'function' && r.status === 200
        && d.zuege === 'e2e4' && ank >= vorher - 5 && ank <= Date.now() + 5 && o.status === 204 && (await o.text()) === ''
        && r.headers.get('access-control-allow-origin') === '*' && /application\/json/.test(r.headers.get('content-type')), { status: r.status, d });
      const ohne = await post(JSON.stringify(ZUG), {});
      const gross = await post('x'.repeat(2000), { Authorization: 'Bearer ' + JWT_W });
      const get = await handler(new Request(url, { method: 'GET' }));
      pruefe('index.ts: ohne Anmeldung 401, zu grosser Koerper 413, GET 405', ohne.status === 401 && gross.status === 413 && get.status === 405);
      env = null;
      const kaputt = await post(JSON.stringify(ZUG));
      const kText = await kaputt.text();
      pruefe('index.ts: ein unerwarteter Fehler wird 503 ONLINE_SERVER, ohne Stacktrace oder Schluessel', kaputt.status === 503 && JSON.parse(kText).fehler === 'ONLINE_SERVER'
        && !/env kaputt|sb_secret|at /.test(kText) && zeilen.includes('online-zug server unerwartet'));
      pruefe('index.ts: Protokoll ohne Inhalte', zeilen.length > 0 && zeilen.every((z) => /^online-zug /.test(z) && !z.includes(UID_W) && !z.includes('e2e4') && !z.includes(DIENST)), zeilen);
    } catch (e) {
      pruefe('index.ts laeuft (Deno-Attrappe)', false, e.stack || e.message);
    } finally {
      globalThis.fetch = echtesFetch;
      console.log = log;
      delete globalThis.Deno;
      haken.deregister();
    }
  } else {
    pruefe('index.ts gibt Status, Kopf und Koerper von verarbeite() weiter (Node ohne TS oder ohne registerHooks: nur statisch)',
      /new Response\(ergebnis\.status === 204 \? null : ergebnis\.koerper, \{ status: ergebnis\.status, headers: ergebnis\.kopf \}\)/.test(ts));
  }
}
{
  // chess.js: dieselbe Version im Browser (vendor) und auf dem Server (npm, feste Version)
  const quelle = lies('vendor/chess/QUELLE.md');
  const sha = createHash('sha256').update(readFileSync(path.join(WURZEL, 'vendor/chess/chess.js'))).digest('hex');
  pruefe('chess.js 1.4.0: vendor/chess (Pruefsumme laut QUELLE.md) und npm:chess.js@1.4.0 in der Huelle', /Version \*\*1\.4\.0\*\*/.test(quelle)
    && quelle.includes(sha) && lies('supabase/functions/online-zug/index.ts').includes("'npm:chess.js@1.4.0'"), sha);
}

// ---------------------------------------------------------------------------
// Vertrag mit supabase/online-schema.sql und supabase/online-rls-test.sql (statisch; die SQL laeuft im PGlite-Pruefer
// und im SQL Editor)
// ---------------------------------------------------------------------------
{
  const sql = lies('supabase/online-schema.sql');
  const o = sql.split('\n').map((z) => z.replace(/--.*$/, '')).join('\n');
  const SIG = 'uuid, uuid, text, text, text, text, text, timestamptz, integer';
  const kopf = /create or replace function public\.online_zug_verbuchen\(([^)]*)\)\s*returns public\.partien_online\s*language plpgsql\s*security definer\s*set search_path = ''/.exec(o);
  const namen = kopf ? kopf[1].split(',').map((t) => t.trim().split(/\s+/)[0]) : [];
  pruefe('Vertrag: online_zug_verbuchen hat genau die Parameter, die die Function schickt (Namen und Reihenfolge), security definer, leerer search_path',
    JSON.stringify(namen) === JSON.stringify(['partie', 'nutzer', 'zug', 'fen_danach', 'am_zug_danach', 'ergebnis', 'grund', 'ankunft', 'halbzuege_vorher']), namen);
  pruefe('Rechte: online_zug_verbuchen nur fuer die Service-Rolle, der alte Weg online_zug fuer niemanden mehr freigegeben',
    o.includes(`revoke all on function public.online_zug_verbuchen(${SIG}) from anon, authenticated, public;`)
    && o.includes(`grant execute on function public.online_zug_verbuchen(${SIG}) to service_role;`)
    && !new RegExp(`grant execute on function public\\.online_zug_verbuchen[^;]*(anon|authenticated)`).test(o)
    && o.includes('revoke all on function public.online_zug(uuid, text, text, text, text, text) from anon, authenticated, public;')
    && !/grant execute on function public\.online_zug\(/.test(o)
    && o.includes(`revoke all on function public.online_zug_buchen(${SIG}) from anon, authenticated, public;`) && !/grant[^;]*online_zug_buchen/.test(o));
  pruefe('SQL: Ankunft zwischen letztem Zug und jetzt begrenzt, veralteter Stand vor "nicht dein Zug", Uhr bis zur Ankunft',
    o.includes('v_ankunft := greatest(least(coalesce(ankunft, jetzt), jetzt), coalesce(p.letzter_zug_am, jetzt));')
    && o.indexOf("raise exception 'ONLINE_STAND_VERALTET'") < o.indexOf("raise exception 'ONLINE_NICHT_DEIN_ZUG'", o.indexOf('function public.online_zug_buchen'))
    && o.includes('p := public.online_uhr_pruefen(p, v_ankunft);') && o.includes('verbraucht_ms := floor(extract(epoch from (v_ankunft - coalesce(p.letzter_zug_am, v_ankunft))) * 1000);'));
  pruefe('SQL: Etappe-0-Regeln im gemeinsamen Kern (Ergebnis nur mit passendem Grund, Folgestellung, zeit-material)',
    /elsif v_grund = 'matt' then/.test(o) && o.includes("'patt', 'material', 'wiederholung', '50-zuege'") && o.includes('if not public.online_folge_passt(p.fen, zug, fen_danach) then')
    && o.includes("'zeit-material'") && (o.match(/create or replace function public\.online_zug_buchen\(/g) || []).length === 1
    && /return public\.online_zug_buchen\(partie, auth\.uid\(\)/.test(o) && /return public\.online_zug_buchen\(partie, nutzer,/.test(o));
  pruefe('SQL: die Function liest partien_online mit der Service-Rolle (ausdruecklich erlaubt, nur lesen)', o.includes('grant select on table public.partien_online to service_role;')
    && !/grant[^;]*\b(insert|update|delete|all)\b[^;]*partien_online/.test(o));
  const rls = lies('supabase/online-rls-test.sql');
  pruefe('online-rls-test.sql: Faelle der Etappe 1a (alter Weg verboten, Server-Funktion nur Service-Rolle, veraltet, Ankunft begrenzt, zeit-material)',
    ['22. Anti-Cheat Etappe 1a', 'pg_temp.ziehe', 'online_zug noch direkt aufrufen', 'kann online_zug_verbuchen aufrufen', 'ONLINE_STAND_VERALTET',
      'zweiter Zug auf veraltetem Stand', 'Ankunftszeit vor dem letzten Zug', 'Ankunftszeit in der Zukunft', 'rechtzeitig angekommene Zug',
      'ueber online_zug_verbuchen ist kein Remis', 'when insufficient_privilege then null', 'set local role service_role'].every((t) => rls.includes(t)));
  // Den alten Weg ruft der Test nur noch auf, um die Absage zu pruefen (anon in Abschnitt 20, B in Abschnitt 22)
  const alt = [...rls.matchAll(/public\.online_zug\((?!uuid, text)/g)].map((m) => rls.slice(m.index, m.index + 500));
  pruefe('online-rls-test.sql: online_zug nur noch als verbotener Aufruf (zweimal, jeweils insufficient_privilege erwartet)',
    alt.length === 2 && alt.every((t) => /^public\.online_zug\([^;]*\);\s+raise exception 'FEHLER: [^']*online_zug[^']*';\s+exception\s+when insufficient_privilege then null;/.test(t)), alt.map((t) => t.slice(0, 120)));
}
{
  // Anleitung: Reihenfolge beim Einrichten. Die 1a-Fassung von online-schema.sql schliesst den alten Zugweg. Wer sie
  // einspielt, bevor die Function hochgeladen ist, kann danach nicht mehr ziehen, und online-rls-test.sql meldet
  // trotzdem Erfolg. Deshalb muss JEDER Abschnitt, der zum Einspielen von online-schema.sql auffordert, das Hochladen
  // vorher nennen (auch der Abschnitt "Anti-Cheat Etappe 0", auf den Flos offener Punkt zeigt).
  const a = lies('supabase/ANLEITUNG.md');
  const abschnitte = a.split(/\n(?=#{2,3} )/);
  const titel = (s) => s.split('\n')[0];
  const HOCHLADEN_RE = /functions deploy online-zug|Edge Function `online-zug`[^.\n]*hochladen/;
  const mitSql = abschnitte.filter((s) => s.includes('`supabase/online-schema.sql`'));
  const erwartet = ['## Online gegen Freunde', '### Anti-Cheat Etappe 0', '### Anti-Cheat Etappe 1a'];
  pruefe('ANLEITUNG: die drei Abschnitte, die online-schema.sql einspielen lassen, werden gefunden',
    erwartet.every((e) => mitSql.some((s) => titel(s).startsWith(e))), mitSql.map(titel));
  const ohne = mitSql.filter((s) => !HOCHLADEN_RE.test(s.slice(0, s.indexOf('online-schema.sql'))));
  pruefe('ANLEITUNG: jeder Abschnitt nennt das Hochladen von online-zug VOR dem ersten online-schema.sql',
    mitSql.length > 0 && ohne.length === 0, ohne.map(titel));
  const e0 = abschnitte.find((s) => titel(s).startsWith('### Anti-Cheat Etappe 0')) || '';
  const punkte = e0.split('\n').filter((z) => /^\d+\. /.test(z) || /^ {3}\S/.test(z))
    .reduce((l, z) => (/^\d+\. /.test(z) ? [...l, z] : (l.length ? [...l.slice(0, -1), l[l.length - 1] + ' ' + z.trim()] : l)), []);
  const iFn = punkte.findIndex((p) => p.includes('functions deploy online-zug'));
  const iSql = punkte.findIndex((p) => p.includes('`supabase/online-schema.sql`'));
  const iSchema = punkte.findIndex((p) => p.includes('`supabase/schema.sql`'));
  const iDaten = punkte.findIndex((p) => p.includes('`supabase/daten-schema.sql`'));
  pruefe('ANLEITUNG Etappe 0: Liste 1. Function hochladen, dann schema.sql, daten-schema.sql, online-schema.sql; danach Function im Dashboard nachsehen',
    iFn === 0 && iFn < iSchema && iSchema < iDaten && iDaten < iSql
    && punkte.slice(iSql + 1).some((p) => p.includes('**Edge Functions**') && p.includes('`online-zug`')), punkte.map((p) => p.slice(0, 60)));
  pruefe('ANLEITUNG Etappe 0: sagt, dass der RLS-Test eine fehlende Function nicht bemerkt',
    /meldet trotzdem Erfolg, weil der Test die Function nicht\s+braucht/.test(e0));
  const e1 = abschnitte.find((s) => titel(s).startsWith('### Anti-Cheat Etappe 1a')) || '';
  const schritt2 = (e1.match(/\n2\. \*\*SQL neu einspielen:\*\*[\s\S]*?(?=\n3\. )/) || [''])[0];
  pruefe('ANLEITUNG Etappe 1a, Schritt 2: verweist fuer schema.sql und daten-schema.sql auf Etappe 0 und aufs Nachsehen der Function',
    /Ist Etappe 0 noch nicht eingespielt/.test(schritt2) && schritt2.includes('`supabase/schema.sql`')
    && schritt2.includes('`supabase/daten-schema.sql`') && /„Anti-Cheat Etappe 0“/.test(schritt2) && schritt2.includes('**Edge Functions**'));
  pruefe('ANLEITUNG Etappe 0 und 1a: keine Gedankenstriche (wie im Rest der Anleitung)', !/[–—]/.test(e0 + e1));
}
{
  // Keine Geheimnisse und keine Preise in den Dateien dieser Etappe (oeffentliches Repo)
  const dateien = ['supabase/functions/_gemeinsam/online-zug.js', 'supabase/functions/online-zug/index.ts', 'supabase/online-schema.sql',
    'supabase/online-rls-test.sql', 'js/online.js', 'js/ui/online.js', 'js/sprachen/online.js', 'supabase/ANLEITUNG.md'];
  const GEHEIM_RE = /sk-ant-[A-Za-z0-9_-]{8,}|(sk|rk)_(live|test)_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{12,}|sb_secret_[A-Za-z0-9_-]{12,}|eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/;
  const PREIS_RE = /\d+(?:[.,]\d{1,2})?\s*(?:€|EUR\b|Euro\b|\$|USD\b|Dollar\b|Cent\b)|[€$]\s*\d/;
  const geheim = [];
  const preis = [];
  for (const d of dateien) {
    const t = lies(d);
    if (GEHEIM_RE.test(t)) geheim.push(d);
    if (PREIS_RE.test(t)) preis.push(d + ': ' + t.match(PREIS_RE)[0]);
  }
  pruefe(`keine Schluessel oder Geheimnisse in ${dateien.length} Dateien der Etappe 1a`, geheim.length === 0, geheim);
  pruefe('keine Preise in den Dateien der Etappe 1a', preis.length === 0, preis);
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
