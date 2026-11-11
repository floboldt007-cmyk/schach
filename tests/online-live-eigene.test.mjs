// Tests fuer js/pakete/online/live-eigene.js (Live-Bewertung eigener Zuege in Online-Partien), nur Node, ohne Browser.
//
//   node tests/online-live-eigene.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Chess } from '../vendor/chess/chess.js';
import { stellungsSchluessel } from '../js/openings.js';
import { START_FEN } from '../js/review.js';
import { t, setzeSprache } from '../js/sprache.js';
import { erstelle } from '../js/pakete/online/live-eigene.js';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ergebnisse = [];
function pruefe(name, ok, detail = '') {
  ergebnisse.push({ name, ok: !!ok });
  console.log((ok ? 'OK     ' : 'FEHLER ') + name + (detail && !ok ? '  (' + detail + ')' : ''));
}
const ev = (cp) => ({ cp, mate: null });

// Fake-Engine wie in tests/review.test.mjs: feste Bewertungen je Stellung, sonst cp 20
class FakeEngine {
  constructor(tabelle = {}) {
    this.tabelle = new Map(Object.entries(tabelle).map(([f, v]) => [stellungsSchluessel(f), v]));
    this.aufrufe = [];
  }
  async analyse(fen, opts = {}) {
    this.aufrufe.push({ fen, ...opts });
    const c = new Chess(fen);
    const zuege = c.moves({ verbose: true });
    const tab = this.tabelle.get(stellungsSchluessel(fen));
    const n = Math.min(opts.multipv || 1, zuege.length);
    const lines = (tab || [{ eval: ev(20), pv: [zuege[0].lan] }, { eval: ev(10), pv: [zuege[1]?.lan] }])
      .slice(0, n).map((l, i) => ({ multipv: i + 1, depth: opts.depth, ...l }));
    return { fen, turn: c.turn(), depth: opts.depth, bestmove: lines[0].pv[0], lines };
  }
}
function fenNach(sans, start = START_FEN) {
  const c = new Chess(start);
  for (const s of sans) c.move(s);
  return c.fen();
}
// Schwarz am Zug nach 1.e4 e5 2.Sf3; Dg5?? stellt die Dame ein (bester Zug waere b8c6)
const DAME = fenNach(['e4', 'e5', 'Nf3']);
const tabelle = () => ({
  [DAME]: [{ eval: ev(40), pv: ['b8c6', 'f1b5'] }, { eval: ev(50), pv: ['d7d6'] }],
  [fenNach(['Qg5'], DAME)]: [{ eval: ev(900), pv: ['f3g5', 'g8f6'] }],
});
// rpc-Attrappe: Antworten je Funktionsname, Funktion oder Fehler; merkt sich jeden Aufruf
function serverMit(antworten) {
  const aufrufe = [];
  const rpc = async (name, daten) => {
    aufrufe.push({ name, daten });
    if (!(name in antworten)) throw Object.assign(new Error('404 ' + name), { status: 404 });
    const a = antworten[name];
    if (a instanceof Error) throw a;
    return typeof a === 'function' ? a(daten) : a;
  };
  return { rpc, aufrufe };
}
const appMit = (einstellungen = {}) => ({ einstellungen: () => ({ liveBewertung: true, tiefe: 12, ...einstellungen }) });

// ---------- Freund und KI: wie bei den Bots, ohne Server ----------
for (const modus of ['freund', 'ki']) {
  const s = serverMit({});
  const eng = new FakeEngine(tabelle());
  const live = await erstelle({ modus, partieId: 'p1', meineFarbe: 'b', app: appMit(), rpc: s.rpc, engine: async () => eng });
  pruefe(`${modus}: an ohne Server-Anfrage`, live.an === true && live.grund === 'an' && s.aufrufe.length === 0, JSON.stringify(s.aufrufe));
  const erg = await live.bewerteEigenenZug(DAME, 'd8g5');
  pruefe(`${modus}: Dg5 ist patzer mit Symbol ??`, erg.klasse === 'patzer' && erg.symbol === '??', JSON.stringify(erg));
  pruefe(`${modus}: Ergebnis hat nur symbol und klasse`, JSON.stringify(Object.keys(erg).sort()) === '["klasse","symbol"]', Object.keys(erg).join());
  pruefe(`${modus}: kein bester Zug im Ergebnis`, !/b8c6|f3g5|Sc6|Nc6/.test(JSON.stringify(erg)), JSON.stringify(erg));
  pruefe(`${modus}: Tiefe aus den Einstellungen`, eng.aufrufe.every((a) => a.depth === 12), JSON.stringify(eng.aufrufe.map((a) => a.depth)));
}

// ---------- Nie ein Gegnerzug ----------
{
  const eng = new FakeEngine(tabelle());
  const live = await erstelle({ modus: 'freund', meineFarbe: 'w', app: appMit(), engine: async () => eng });
  let fehler = null;
  try { await live.bewerteEigenenZug(DAME, 'd8g5'); } catch (e) { fehler = e; }
  pruefe('Gegnerzug (Schwarz am Zug, ich Weiss) wird abgelehnt', fehler && fehler.grund === 'gegner');
  pruefe('Gegnerzug: Engine nicht befragt', eng.aufrufe.length === 0, eng.aufrufe.length);
}

// ---------- Ranked: Kontingent vom Server ----------
{
  const s = serverMit({ online_live_bewertung_frei: true, online_live_bewertung_nutzen: true });
  const eng = new FakeEngine(tabelle());
  const live = await erstelle({ modus: 'ranked', partieId: 'p-42', meineFarbe: 'b', app: appMit(), rpc: s.rpc, engine: async () => eng });
  pruefe('ranked frei: an', live.an === true, live.grund);
  // R2 (11.11.2026): beim Start nur frei(partie) fragen; gebucht wird erst mit dem ersten eigenen Zug
  pruefe('ranked Start: nur frei mit partie, noch keine Buchung',
    s.aufrufe.length === 1 && s.aufrufe[0].name === 'online_live_bewertung_frei' && s.aufrufe[0].daten.partie === 'p-42', JSON.stringify(s.aufrufe));
  const erg = await live.bewerteEigenenZug(DAME, 'd8g5');
  pruefe('ranked erster eigener Zug: nutzen mit partie, genau einmal', s.aufrufe.length === 2
    && s.aufrufe[1].name === 'online_live_bewertung_nutzen' && s.aufrufe[1].daten.partie === 'p-42', JSON.stringify(s.aufrufe));
  await live.bewerteEigenenZug(DAME, 'b8c6');
  pruefe('ranked zweiter eigener Zug: keine zweite Buchung', s.aufrufe.filter((a) => a.name === 'online_live_bewertung_nutzen').length === 1, JSON.stringify(s.aufrufe));
  pruefe('ranked: nur symbol und klasse, kein bester Zug',
    JSON.stringify(erg) === JSON.stringify({ symbol: '??', klasse: 'patzer' }), JSON.stringify(erg));
  let fehler = null;
  try { await live.bewerteEigenenZug(fenNach(['Qg5'], DAME), 'f3g5'); } catch (e) { fehler = e; }
  pruefe('ranked: Zug des Gegners wird abgelehnt', fehler && fehler.grund === 'gegner');
}
for (const [frei, nutzen] of [[{ frei: true }, { ok: true }], [[{ online_live_bewertung_frei: true }], { online_live_bewertung_nutzen: true }], [[true], { genutzt: true }]]) {
  const s = serverMit({ online_live_bewertung_frei: frei, online_live_bewertung_nutzen: nutzen });
  const live = await erstelle({ modus: 'ranked', partieId: 'p1', meineFarbe: 'b', app: appMit(), rpc: s.rpc, engine: async () => new FakeEngine() });
  pruefe(`ranked frei als ${JSON.stringify(frei)} / ${JSON.stringify(nutzen)}: an`, live.an === true, live.grund);
}
for (const [name, antworten, grund] of [
  ['Funktionen fehlen (404)', {}, 'server'],
  ['frei fehlt, nutzen da', { online_live_bewertung_nutzen: true }, 'server'],
  ['nutzen fehlt', { online_live_bewertung_frei: true }, 'server'],
  ['heute genutzt (false)', { online_live_bewertung_frei: false, online_live_bewertung_nutzen: true }, 'kontingent'],
  ['frei als Zeile { frei: false }', { online_live_bewertung_frei: [{ frei: false }], online_live_bewertung_nutzen: true }, 'kontingent'],
  ['Serverfehler als jsonb', { online_live_bewertung_frei: { fehler: 'ONLINE_X' }, online_live_bewertung_nutzen: true }, 'server'],
  ['unklare Antwort (null)', { online_live_bewertung_frei: null, online_live_bewertung_nutzen: true }, 'kontingent'],
  ['frei meldet { genutzt: true } (verbraucht)', { online_live_bewertung_frei: { genutzt: true }, online_live_bewertung_nutzen: true }, 'kontingent'],
  ['nutzen sagt nein',{ online_live_bewertung_frei: true, online_live_bewertung_nutzen: false }, 'kontingent'],
  ['Netzfehler', { online_live_bewertung_frei: new Error('offline') }, 'server'],
]) {
  const s = serverMit(antworten);
  const eng = new FakeEngine(tabelle());
  const live = await erstelle({ modus: 'ranked', partieId: 'p1', meineFarbe: 'b', app: appMit(), rpc: s.rpc, engine: async () => eng });
  let fehler = null;
  try { await live.bewerteEigenenZug(DAME, 'd8g5'); } catch (e) { fehler = e; }
  pruefe(`ranked ${name}: AUS (${grund})`, live.an === false && live.grund === grund && fehler && fehler.aus === true && eng.aufrufe.length === 0,
    `${live.an} ${live.grund}`);
}
// Kontingent fuer den Hinweis in der Online-Ansicht (Server: { frei, rest, unbegrenzt })
{
  const s = serverMit({ online_live_bewertung_frei: { frei: true, rest: 1, unbegrenzt: false }, online_live_bewertung_nutzen: { ok: true, rest: 0, gebucht: true } });
  const live = await erstelle({ modus: 'ranked', partieId: 'p7', meineFarbe: 'b', app: appMit(), rpc: s.rpc, engine: async () => new FakeEngine(tabelle()) });
  pruefe('Kontingent ohne Premium: rest 1, noch nicht gebucht', live.kontingent && live.kontingent.rest === 1 && !live.kontingent.unbegrenzt && !live.kontingent.gebucht, JSON.stringify(live.kontingent));
  await live.bewerteEigenenZug(DAME, 'd8g5');
  pruefe('Kontingent nach dem ersten Zug: gebucht', live.kontingent.gebucht === true, JSON.stringify(live.kontingent));
  const prem = await erstelle({ modus: 'ranked', partieId: 'p8', meineFarbe: 'b', app: appMit(), rpc: serverMit({ online_live_bewertung_frei: { frei: true, rest: null, unbegrenzt: true } }).rpc, engine: async () => new FakeEngine() });
  pruefe('Kontingent Premium: unbegrenzt', prem.kontingent && prem.kontingent.unbegrenzt === true, JSON.stringify(prem.kontingent));
  const leer = await erstelle({ modus: 'ranked', partieId: 'p9', meineFarbe: 'b', app: appMit(), rpc: serverMit({ online_live_bewertung_frei: { frei: false, rest: 0, unbegrenzt: false } }).rpc, engine: async () => new FakeEngine() });
  pruefe('Kontingent verbraucht: AUS mit rest 0 (Hinweis "morgen wieder")', leer.an === false && leer.grund === 'kontingent' && leer.kontingent?.rest === 0, JSON.stringify(leer));
  const freund = await erstelle({ modus: 'freund', meineFarbe: 'b', app: appMit(), engine: async () => new FakeEngine() });
  pruefe('Freund: kein Kontingent', freund.kontingent === null);
}
{
  const s = serverMit({ online_live_bewertung_frei: false });
  await erstelle({ modus: 'ranked', partieId: 'p1', meineFarbe: 'b', app: appMit(), rpc: s.rpc, engine: async () => new FakeEngine() });
  pruefe('ranked nicht frei: nutzen wird nicht aufgerufen', s.aufrufe.length === 1, JSON.stringify(s.aufrufe));
  const ohne = await erstelle({ modus: 'ranked', meineFarbe: 'b', app: appMit(), rpc: s.rpc, engine: async () => new FakeEngine() });
  pruefe('ranked ohne partieId: AUS', ohne.an === false && ohne.grund === 'server');
}

// ---------- Einstellung, Eingaben, stop ----------
{
  const s = serverMit({ online_live_bewertung_frei: true, online_live_bewertung_nutzen: true });
  const live = await erstelle({ modus: 'ranked', partieId: 'p1', meineFarbe: 'b', app: appMit({ liveBewertung: false }), rpc: s.rpc, engine: async () => new FakeEngine() });
  pruefe('Einstellung aus: AUS, verbraucht kein Kontingent', live.an === false && live.grund === 'aus-einstellung' && s.aufrufe.length === 0);
  pruefe('unbekannter Modus: AUS', (await erstelle({ modus: 'arena', meineFarbe: 'w', engine: async () => new FakeEngine() })).grund === 'modus');
  pruefe('falsche Farbe: AUS', (await erstelle({ modus: 'ki', meineFarbe: 'weiss', engine: async () => new FakeEngine() })).grund === 'farbe');
  pruefe('ohne Engine: AUS', (await erstelle({ modus: 'ki', meineFarbe: 'w' })).grund === 'engine');
  const app = { ...appMit(), engine: async (name) => { app.genutzt = name; return new FakeEngine(tabelle()); } };
  const ueberApp = await erstelle({ modus: 'ki', meineFarbe: 'b', app });
  await ueberApp.bewerteEigenenZug(DAME, 'd8g5');
  pruefe('ohne engine-Option: dieselbe Engine wie die Bot-Partie (app.engine bewertung)', app.genutzt === 'bewertung', app.genutzt);
}
{
  let loesen;
  const eng = new FakeEngine(tabelle());
  const live = await erstelle({ modus: 'freund', meineFarbe: 'b', app: appMit(), engine: () => new Promise((r) => { loesen = () => r(eng); }) });
  const laeuft = live.bewerteEigenenZug(DAME, 'd8g5');
  live.stop();
  loesen();
  let fehler = null;
  try { await laeuft; } catch (e) { fehler = e; }
  pruefe('stop waehrend der Bewertung: abgebrochen, keine Analyse', fehler && fehler.abgebrochen === true && eng.aufrufe.length === 0);
  fehler = null;
  try { await live.bewerteEigenenZug(DAME, 'd8g5'); } catch (e) { fehler = e; }
  pruefe('nach stop: jede weitere Bewertung abgebrochen', fehler && fehler.abgebrochen === true);
}

// ---------- Texte und Quelle ----------
setzeSprache('de');
pruefe('Text de', t('online.live.genutzt') === 'Live-Bewertung heute schon genutzt, morgen wieder frei. Mit Premium unbegrenzt.', t('online.live.genutzt'));
pruefe('Text de frei', t('online.live.frei', { n: 1 }) === 'Live-Bewertung: heute noch 1 Partie frei. Sie zählt ab deinem ersten Zug.', t('online.live.frei', { n: 1 }));
setzeSprache('en');
pruefe('Text en', t('online.live.genutzt') === 'Live rating already used today, free again tomorrow. Unlimited with Premium.', t('online.live.genutzt'));
pruefe('Text en frei', t('online.live.frei', { n: 1 }) === 'Live rating: 1 free game left today. It counts from your first move.', t('online.live.frei', { n: 1 }));
setzeSprache('de');
const quelle = readFileSync(path.join(WURZEL, 'js/pakete/online/live-eigene.js'), 'utf8');
pruefe('Quelle: kein Zugriff auf js/ui/online.js', !/ui\/online/.test(quelle));
pruefe('Quelle: gibt keinen besten Zug und keine Bewertungszahl heraus',
  !/besterZug|gewinn|verlust|genauigkeit|evalVorher|vorab/.test(quelle.split('\n').filter((z) => !z.trim().startsWith('//')).join('\n')));

const fehlerAnzahl = ergebnisse.filter((e) => !e.ok).length;
console.log(`\n${ergebnisse.length - fehlerAnzahl}/${ergebnisse.length} bestanden`);
process.exit(fehlerAnzahl ? 1 : 0);
