// Vorlaeufige Bot-Laeufe fuer die Tafeln des Pakets punkte (SPIELKONZEPT 3.13 "Schon in S1 nicht leer", Fahrplan
// 6.3 S1-3). Werkzeug am PC, laeuft unter Node, wird nicht ausgeliefert.
//
// Die Messung der Eichung hat 320 Partien zwischen Nachbar-Bots gespielt (eichung/messung/roh/botpartien.jsonl,
// typ 'nachbar': je Paar Stufe k gegen k+1 2 x 20 Partien, Lukas-Hilde bis Koenig-Greta; die Datei liegt nicht im
// Repo). Dieses Werkzeug analysiert jede Partie mit derselben Engine und derselben Funktion wie die App
// (Stockfish 19 lite aus vendor/stockfish als Kindprozess, js/review.js analysierePartie, Tiefe 14, MultiPV 2),
// bewertet beide Seiten mit js/pakete/punkte/formel.js (tafelwert) und schreibt je Tafel und Nachbar den besten und
// den mittleren Lauf nach daten/punkte/bot-laeufe.json (art 'bot-laeufe', format 1, rechenstand = formel.STAND).
// Beispiel: Lisa gegen Thorsten ergibt Lisas Laeufe auf Thorstens Tafel und Thorstens Laeufe auf Lisas Tafel.
//
//   1. Analysieren (fortsetzbar, mehrere Prozesse mit --teil teilen sich die Partien, je Prozess ein eigener Cache):
//      node werkzeuge/nachbar-laeufe.mjs --partien=<botpartien.jsonl> --cache=<analysen-0.jsonl> --teil=0/2
//      node werkzeuge/nachbar-laeufe.mjs --partien=<botpartien.jsonl> --cache=<analysen-1.jsonl> --teil=1/2
//      Helfer fuer einen langsamen Teil (schreibt in den ersten Cache, ueberspringt alles aus allen, von hinten):
//      node werkzeuge/nachbar-laeufe.mjs --partien=<botpartien.jsonl> --cache=<analysen-3.jsonl,analysen-1.jsonl> --teil=1/2 --rueckwaerts
//   2. Auswerten (ohne Engine, Sekunden; nach jeder Aenderung der Punkte-Formel erneut, mit hoeherem STAND):
//      node werkzeuge/nachbar-laeufe.mjs --partien=<botpartien.jsonl> --cache=<a.jsonl,b.jsonl> --auswerten
//        [--aus=daten/punkte/bot-laeufe.json] [--stand=JJJJ-MM-TT]
//
// Datei: { kopf, quelle: { partien, tiefe, multipv, engine, vorlaeufig: true }, tafeln: { 'bot:rudi': [Lauf] } },
//   Lauf = { bot, lauf: 'best' | 'mittel', w (Tafelwert), f (Farbe des Bots), e ('s'|'r'|'n' aus Sicht des Bots),
//   z (eigene Zuege), g (Genauigkeit), partie (ID in botpartien.jsonl), von (Laeufe dieses Nachbarn auf dieser Tafel) }
//   Die App (js/pakete/punkte/stand.js) prueft die Datei mit pruefeBotLaeufe und zeigt die Laeufe als Gaeste.
// Regeln: Partien mit Zuglimit (die App kennt kein Zuglimit, das Ergebnis waere erfunden) zaehlen nicht. Ergebnis
// aus Sicht des Laeufers (1 Weiss gewinnt, 0 Schwarz gewinnt, 0.5 Remis). Mittlerer Lauf: nach Wert absteigend
// sortiert der Eintrag an Stelle floor((n - 1) / 2). Kein Zufall: dieselben Partien ergeben dieselbe Datei.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(HIER, '..');

// ---------- Kindprozess statt Web Worker (js/engine.js ruft new Worker(pfad)) ----------
const laufend = new Set();
class ProzessWorker {
  constructor(pfad) {
    const p = String(pfad).startsWith('file:') ? fileURLToPath(pfad) : String(pfad);
    this.kind = spawn('nice', ['-n', '19', process.execPath, p], { cwd: path.dirname(p), stdio: ['pipe', 'pipe', 'ignore'] });
    this.pid = this.kind.pid;
    laufend.add(this);
    this.onmessage = null;
    this.onerror = null;
    let rest = '';
    this.kind.stdout.setEncoding('utf8');
    this.kind.stdout.on('data', (stueck) => {
      rest += stueck;
      const zeilen = rest.split(/\r?\n/);
      rest = zeilen.pop();
      for (const z of zeilen) if (z && this.onmessage) this.onmessage({ data: z });
    });
    this.kind.on('error', (e) => { if (this.onerror) this.onerror({ message: e.message }); });
    this.kind.on('exit', () => laufend.delete(this));
  }
  postMessage(befehl) {
    if (this.kind.stdin.writable) this.kind.stdin.write(befehl + '\n');
  }
  terminate() {
    try { this.kind.stdin.end(); } catch (e) { /* egal */ }
    try { process.kill(this.pid, 'SIGTERM'); } catch (e) { /* schon weg */ }
    laufend.delete(this);
  }
}
const alleBeenden = () => { for (const w of [...laufend]) w.terminate(); };

const arg = (n, s = null) => {
  const a = process.argv.find((x) => x.startsWith('--' + n + '=') || x === '--' + n);
  if (!a) return s;
  return a.includes('=') ? a.slice(n.length + 3) : true;
};

const { analysierePartie } = await import('../js/review.js');
const F = await import('../js/pakete/punkte/formel.js');

const PARTIEN = arg('partien');
const CACHE = String(arg('cache', '')).split(',').filter(Boolean);
const AUSWERTEN = arg('auswerten', false) === true;
const RUECKWAERTS = arg('rueckwaerts', false) === true;
const TIEFE = Number(arg('tiefe', 14));
const MULTIPV = 2;
const [TEIL_K, TEIL_N] = String(arg('teil', '0/1')).split('/').map(Number);
const AUS = path.resolve(WURZEL, arg('aus', 'daten/punkte/bot-laeufe.json'));
const STAND_TAG = arg('stand', null);

if (!PARTIEN || !CACHE.length) {
  console.error('Aufruf: node werkzeuge/nachbar-laeufe.mjs --partien=<botpartien.jsonl> --cache=<analysen.jsonl> [--teil=k/n | --auswerten]');
  process.exit(2);
}

function liesJsonl(datei) {
  if (!fs.existsSync(datei)) return [];
  const aus = [];
  for (const z of fs.readFileSync(datei, 'utf8').split('\n')) {
    if (!z.trim()) continue;
    try { aus.push(JSON.parse(z)); } catch (e) { /* halbe Zeile eines abgebrochenen Laufs */ }
  }
  return aus;
}

const partien = liesJsonl(PARTIEN).filter((p) => p.typ === 'nachbar' && Array.isArray(p.zuege) && p.weiss && p.schwarz
  && !/^Zuglimit/.test(String(p.grund || '')));
partien.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

const kompakt = (a) => ({ d: a.depth ?? null, b: a.bestmove ?? null, l: (a.lines || []).map((x) => ({ e: x.eval, pv: x.pv || [] })) });
const ausKompakt = (a, fen) => ({
  fen, depth: a.d, bestmove: a.b, lines: a.l.map((x, j) => ({ multipv: j + 1, depth: a.d, eval: x.e, pv: x.pv })),
});

// ---------- 1. Analysieren ----------
async function analysiere() {
  globalThis.Worker = ProzessWorker;
  const { Engine } = await import('../js/engine.js');
  const datei = CACHE[0];
  fs.mkdirSync(path.dirname(path.resolve(datei)), { recursive: true });
  // fertig ist, was in irgendeinem der Caches steht (geschrieben wird nur in den ersten); --rueckwaerts arbeitet von
  // hinten, so kann ein zweiter Prozess einem langsamen helfen, ohne Partien doppelt zu rechnen
  const fertigAlle = () => new Set(CACHE.flatMap((d) => liesJsonl(d).map((x) => x.id)));
  const fertig = fertigAlle();
  const offen = partien.filter((_, i) => i % TEIL_N === TEIL_K).filter((p) => !fertig.has(p.id));
  if (RUECKWAERTS) offen.reverse();
  console.log(`${new Date().toISOString()} ${path.basename(datei)}: ${offen.length} offen, ${fertig.size} fertig, Tiefe ${TIEFE}`);
  const engine = new Engine();
  await engine.init();
  const t0 = Date.now();
  let stellungen = 0;
  let nr = 0;
  for (const p of offen) {
    if (CACHE.length > 1 && fertigAlle().has(p.id)) continue;
    await engine.newGame();
    const liste = [];
    const aufzeichner = {
      analyse: async (fen, o) => { const a = await engine.analyse(fen, o); liste.push(kompakt(a)); return a; },
      stop: () => engine.stop(),
    };
    try {
      await analysierePartie(aufzeichner, p.zuege, { tiefe: TIEFE, multipv: MULTIPV });
    } catch (e) {
      console.log('FEHLER', p.id, e.message);
      continue;
    }
    fs.appendFileSync(datei, JSON.stringify({ id: p.id, tiefe: TIEFE, multipv: MULTIPV, engine: 'stockfish-19-lite', analysen: liste }) + '\n');
    nr++;
    stellungen += liste.length;
    if (nr % 5 === 0 || nr === offen.length) {
      const s = (Date.now() - t0) / 1000;
      console.log(`${new Date().toISOString()} ${path.basename(datei)}: ${nr}/${offen.length} Partien, ${(s / stellungen).toFixed(3)} s je Stellung`);
    }
  }
  engine.terminate();
  alleBeenden();
}

// ---------- 2. Auswerten ----------
const ERG = (wert, farbe) => {
  if (wert === 0.5) return 'remis';
  if (wert === 1) return farbe === 'w' ? 'sieg' : 'niederlage';
  if (wert === 0) return farbe === 'b' ? 'sieg' : 'niederlage';
  return null;
};
const KURZ = { sieg: 's', remis: 'r', niederlage: 'n' };

async function auswerten() {
  const cache = new Map();
  for (const d of CACHE) for (const x of liesJsonl(d)) if (x && x.id && Array.isArray(x.analysen)) cache.set(x.id, x);
  const laeufe = new Map();   // 'tafel|bot' -> [Lauf]
  let gezaehlt = 0;
  const fehlen = [];
  for (const p of partien) {
    const c = cache.get(p.id);
    if (!c) { fehlen.push(p.id); continue; }
    let i = 0;
    const wiedergabe = {
      analyse: async (fen) => {
        const a = c.analysen[i++];
        if (!a) throw new Error('Cache zu kurz: ' + p.id);
        return ausKompakt(a, fen);
      },
      stop: () => {},
    };
    const review = await analysierePartie(wiedergabe, p.zuege, { tiefe: c.tiefe, multipv: c.multipv });
    gezaehlt++;
    for (const farbe of ['w', 'b']) {
      const laeufer = farbe === 'w' ? p.weiss.id : p.schwarz.id;
      const gegner = farbe === 'w' ? p.schwarz.id : p.weiss.id;
      const ergebnis = ERG(p.ergebnis, farbe);
      if (!ergebnis) continue;
      const zuege = F.zuegeAusReview(review, farbe);
      const eigene = farbe === 'w' ? Math.ceil(p.zuege.length / 2) : Math.floor(p.zuege.length / 2);
      const r = F.tafelwert({ zuege, ergebnis, eigeneZuege: eigene, hilfe: false });
      const g = review.genauigkeit && Number.isFinite(review.genauigkeit[farbe]) ? Math.round(review.genauigkeit[farbe] * 10) / 10 : null;
      const k = `bot:${gegner}|${laeufer}`;
      if (!laeufe.has(k)) laeufe.set(k, []);
      laeufe.get(k).push({ w: r.wert, f: farbe, e: KURZ[ergebnis], z: eigene, g, partie: p.id });
    }
  }
  if (fehlen.length) console.log(`Ohne Analyse (fehlt im Cache): ${fehlen.length} Partien`);
  const tafeln = {};
  const sortiert = [...laeufe.keys()].sort();
  for (const k of sortiert) {
    const [tafel, bot] = k.split('|');
    const l = laeufe.get(k).sort((a, b) => (b.w - a.w) || (a.partie < b.partie ? -1 : a.partie > b.partie ? 1 : 0));
    const best = l[0];
    const mittel = l[Math.floor((l.length - 1) / 2)];
    if (!tafeln[tafel]) tafeln[tafel] = [];
    tafeln[tafel].push({ bot, lauf: 'best', ...best, von: l.length });
    if (mittel !== best) tafeln[tafel].push({ bot, lauf: 'mittel', ...mittel, von: l.length });
  }
  const tag = STAND_TAG || new Date().toISOString().slice(0, 10);
  const datei = {
    kopf: { art: 'bot-laeufe', format: 1, rechenstand: F.STAND, stand: tag, titel: 'Vorlaeufige Bot-Laeufe aus den Nachbar-Partien der Eichung' },
    quelle: { partien: gezaehlt, tiefe: TIEFE, multipv: MULTIPV, engine: 'Stockfish 19 lite (wie die App)', vorlaeufig: true },
    tafeln,
  };
  fs.mkdirSync(path.dirname(AUS), { recursive: true });
  // kompakt und doch lesbar: je Lauf eine Zeile (die App bekommt so nur wenige KB)
  const tafelText = Object.entries(tafeln).map(([t, l]) => `  ${JSON.stringify(t)}: [\n${l.map((x) => '   ' + JSON.stringify(x)).join(',\n')}\n  ]`).join(',\n');
  const text = `{\n "kopf": ${JSON.stringify(datei.kopf)},\n "quelle": ${JSON.stringify(datei.quelle)},\n "tafeln": {\n${tafelText}\n }\n}\n`;
  JSON.parse(text);
  fs.writeFileSync(AUS, text);
  console.log(`${path.relative(WURZEL, AUS)}: ${gezaehlt} Partien, ${Object.keys(tafeln).length} Tafeln, `
    + `${Object.values(tafeln).reduce((s, l) => s + l.length, 0)} Laeufe, ${fs.statSync(AUS).size} Bytes`);
  for (const [t, l] of Object.entries(tafeln)) console.log(' ', t, l.map((x) => `${x.bot}/${x.lauf} ${x.w} (${x.e}, von ${x.von})`).join(' · '));
}

try {
  if (AUSWERTEN) await auswerten();
  else await analysiere();
} finally {
  alleBeenden();
}
process.exit(0);
