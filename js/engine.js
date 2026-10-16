// Stockfish-Wrapper: ein Web Worker, eine Suche zur Zeit, Warteschlange, Abbruch, MultiPV.
// Bewertungen kommen immer aus Sicht von Weiss zurueck ({cp, mate}, genau eins gesetzt).
// analyse(..., { prioritaet }): 'sofort' bricht die laufende Suche ab und kommt als Naechste dran,
// 'vorne' stellt sich nur vorne an (die laufende Suche rechnet zu Ende).
import { Chess } from '../vendor/chess/chess.js';

// Standardpfad relativ zu diesem Modul, damit es auch aus Unterordnern (tests/) klappt.
const STANDARD_PFAD = new URL('../vendor/stockfish/stockfish-19-lite-single.js', import.meta.url).href;
// Startet die Engine nicht (z. B. Speicher), kommt die Meldung nach dieser Zeit (der Worker
// meldet einen gescheiterten WebAssembly-Start nicht selbst)
const INIT_ZEITLIMIT_MS = 15000;

export class Engine {
  constructor(pfad = STANDARD_PFAD, { protokoll = false } = {}) {
    this.pfad = pfad;
    this.optionen = {};            // aus der 'uci'-Antwort: Name -> { typ, standard, min, max }
    this.protokoll = protokoll ? [] : null;  // gesendete Befehle (fuer Tests/Fehlersuche)
    this._worker = null;
    this._initPromise = null;
    this._lauscher = new Set();
    this._schlange = [];
    this._laufend = null;
    this._opt = { multipv: 1, skill: null, elo: null };
  }

  // uci + isready, idempotent
  init() {
    if (this._initPromise) return this._initPromise;
    const p = new Promise((resolve, reject) => {
      let worker;
      try {
        worker = new Worker(this.pfad);
      } catch (e) {
        reject(e);
        return;
      }
      this._worker = worker;
      const uhr = setTimeout(() => reject(new Error('Engine antwortet nicht')), INIT_ZEITLIMIT_MS);
      worker.onmessage = (ev) => {
        if (typeof ev.data !== 'string') return;  // Ladefortschritt o. ae.
        for (const z of ev.data.split(/\r?\n/)) if (z) this._zeile(z);
      };
      worker.onerror = (ev) => {
        clearTimeout(uhr);
        const fehler = new Error('Engine-Fehler: ' + (ev && ev.message ? ev.message : 'unbekannt'));
        reject(fehler);
        this._absturz(fehler);
      };
      this._warteAuf((z) => z === 'uciok')
        .then(() => {
          this._sende('isready');
          return this._warteAuf((z) => z === 'readyok');
        })
        .then(() => { clearTimeout(uhr); resolve(); });
      this._sende('uci');
    });
    this._initPromise = p;
    p.catch(() => { if (this._initPromise === p) this._initPromise = null; });
    return p;
  }

  // Analyse = { fen, turn, depth, bestmove, lines: [{ multipv, depth, eval: {cp, mate}, pv }] }
  // Zusatzfelder: ende ('matt'|'patt'|null), gewinner ('w'|'b'|null), abgebrochen, zeitMs
  analyse(fen, { depth, movetime, nodes, multipv = 1, skill, elo, prioritaet, beiTiefe } = {}) {
    let chess;
    try {
      chess = new Chess(fen);
    } catch (e) {
      return Promise.reject(new Error('Ungueltige Stellung: ' + fen));
    }
    const turn = chess.turn();
    const anzahl = chess.moves().length;
    // Matt und Patt ohne Engine beantworten
    if (anzahl === 0) return Promise.resolve(endstellung(fen, turn, chess.inCheck()));

    const maxPv = this.optionen.MultiPV?.max ?? 256;
    const n = Math.max(1, Math.min(Math.round(multipv) || 1, anzahl, maxPv));
    return new Promise((resolve, reject) => {
      const job = {
        typ: 'suche', fen, uciFen: chess.fen(), turn, n,
        depth: zahlOderNull(depth), movetime: zahlOderNull(movetime), nodes: zahlOderNull(nodes),
        skill: skill == null ? null : skill, elo: elo == null ? null : elo,
        beiTiefe: typeof beiTiefe === 'function' ? beiTiefe : null,
        resolve, reject,
        tiefen: new Map(), besteTiefe: 0, infoZaehler: 0, vollBei: new Map(),
        gesendet: false, stopp: false, start: 0,
      };
      if (prioritaet === 'sofort') {
        this._schlange.unshift(job);
        this._stoppeLaufende();
      } else if (prioritaet === 'vorne') {
        this._schlange.unshift(job);
      } else {
        this._schlange.push(job);
      }
      this._weiter();
    });
  }

  // laufende Suche abbrechen; ihr Promise loest mit dem bisherigen Stand auf.
  // { warteschlange: true } verwirft zusaetzlich alle wartenden Suchen (loesen leer auf).
  stop({ warteschlange = false } = {}) {
    if (warteschlange) {
      for (const job of this._schlange.splice(0)) {
        if (job.typ === 'suche') job.resolve(leereAnalyse(job));
        else job.resolve();
      }
    }
    this._stoppeLaufende();
  }

  // ucinewgame + isready (reiht sich hinter laufende Suchen ein)
  newGame() {
    return new Promise((resolve, reject) => {
      this._schlange.push({ typ: 'neu', resolve, reject });
      this._weiter();
    });
  }

  terminate() {
    const w = this._worker;
    this._worker = null;
    this._initPromise = null;
    if (w) {
      try { w.postMessage('quit'); } catch (e) { /* egal */ }
      w.terminate();
    }
    this._alleAufloesen();
    this._opt = { multipv: 1, skill: null, elo: null };
  }

  // ---------- intern ----------

  _sende(befehl) {
    if (this.protokoll) this.protokoll.push(befehl);
    if (this._worker) this._worker.postMessage(befehl);
  }

  _warteAuf(pruefung) {
    return new Promise((resolve) => {
      const l = (z) => {
        if (pruefung(z)) {
          this._lauscher.delete(l);
          resolve(z);
        }
      };
      this._lauscher.add(l);
    });
  }

  _zeile(z) {
    if (z.startsWith('option name ')) this._leseOption(z);
    const job = this._laufend;
    if (job && job.typ === 'suche' && job.gesendet) {
      if (z.startsWith('info ') && z.includes(' pv ')) this._info(job, z);
      else if (z.startsWith('bestmove')) this._fertig(job, z);
    }
    for (const l of [...this._lauscher]) l(z);
  }

  _leseOption(z) {
    const m = /^option name (.+?) type (\w+)(?: default (\S*))?(?: min (-?\d+))?(?: max (-?\d+))?/.exec(z);
    if (!m) return;
    this.optionen[m[1]] = {
      typ: m[2], standard: m[3],
      min: m[4] != null ? Number(m[4]) : null,
      max: m[5] != null ? Number(m[5]) : null,
    };
  }

  _stoppeLaufende() {
    const job = this._laufend;
    if (!job || job.typ !== 'suche' || job.stopp) return;
    job.stopp = true;
    if (job.gesendet) this._sende('stop');
  }

  async _weiter() {
    if (this._laufend || this._schlange.length === 0) return;
    const job = this._schlange.shift();
    this._laufend = job;
    try {
      await this.init();
    } catch (e) {
      this._laufend = null;
      job.reject(e);
      this._weiter();
      return;
    }
    if (this._laufend !== job) return;  // inzwischen beendet (terminate)

    if (job.typ === 'neu') {
      this._sende('ucinewgame');
      this._sende('isready');
      await this._warteAuf((z) => z === 'readyok');
      if (this._laufend === job) this._laufend = null;
      job.resolve();
      this._weiter();
      return;
    }

    this._setzeOptionen(job);
    this._sende('position fen ' + job.uciFen);
    let go = 'go';
    if (job.depth) go += ' depth ' + Math.round(job.depth);
    if (job.movetime) go += ' movetime ' + Math.round(job.movetime);
    if (job.nodes) go += ' nodes ' + Math.round(job.nodes);
    if (go === 'go') go += ' depth 12';
    job.start = jetzt();
    job.gesendet = true;
    this._sende(go);
    if (job.stopp) this._sende('stop');
  }

  // Skill/Elo nur fuer Suchen setzen, die sie wollen; sonst wieder volle Staerke.
  _setzeOptionen(job) {
    const o = this._opt;
    if (o.multipv !== job.n) {
      this._sende('setoption name MultiPV value ' + job.n);
      o.multipv = job.n;
    }
    const sk = this.optionen['Skill Level'];
    const skill = job.skill == null ? null : begrenze(Math.round(job.skill), sk?.min ?? 0, sk?.max ?? 20);
    if (skill !== o.skill) {
      this._sende('setoption name Skill Level value ' + (skill == null ? (sk?.max ?? 20) : skill));
      o.skill = skill;
    }
    const eo = this.optionen.UCI_Elo;
    const elo = job.elo == null ? null : begrenze(Math.round(job.elo), eo?.min ?? 1320, eo?.max ?? 3190);
    if (elo == null) {
      if (o.elo != null) {
        this._sende('setoption name UCI_LimitStrength value false');
        o.elo = null;
      }
    } else {
      if (o.elo == null) this._sende('setoption name UCI_LimitStrength value true');
      if (o.elo !== elo) this._sende('setoption name UCI_Elo value ' + elo);
      o.elo = elo;
    }
  }

  _info(job, z) {
    const r = leseInfo(z);
    // nur exakte Bewertungen mit Hauptvariante; Schranken (lower/upperbound) ignorieren
    if (!r || r.grenze || r.depth == null || r.pv.length === 0) return;
    if (r.cp == null && r.mate == null) return;
    if (r.multipv < 1 || r.multipv > job.n) return;
    job.infoZaehler++;
    let satz = job.tiefen.get(r.depth);
    if (!satz) {
      satz = new Map();
      job.tiefen.set(r.depth, satz);
    }
    if (satz.size >= job.n) return;  // Tiefe schon vollstaendig: eingefroren
    satz.set(r.multipv, {
      multipv: r.multipv,
      depth: r.depth,
      eval: weissSicht(r.cp, r.mate, job.turn),
      pv: r.pv,
    });
    if (satz.size >= job.n) {
      job.vollBei.set(r.depth, job.infoZaehler);
      if (r.depth > job.besteTiefe) {
        job.besteTiefe = r.depth;
        if (job.beiTiefe) {
          try {
            job.beiTiefe(baueAnalyse(job, r.depth, sortiert(satz), null));
          } catch (e) { /* Rueckruf-Fehler nicht in die Engine tragen */ }
        }
      }
    }
  }

  _fertig(job, z) {
    const teile = z.trim().split(/\s+/);
    let best = teile[1] || null;
    if (best === '(none)' || best === '0000') best = null;

    // Suche lief bis zur gewuenschten Tiefe durch? Sonst ist der letzte Ausgabeblock
    // (beim Abbruch geschrieben) unvollstaendig gerechnet und wird nicht genommen.
    const durch = job.depth != null && job.besteTiefe >= job.depth && !job.stopp;
    let gewaehlt = null;
    for (const d of [...job.tiefen.keys()].sort((a, b) => b - a)) {
      const satz = job.tiefen.get(d);
      if (satz.size < job.n) continue;
      if (!durch && job.vollBei.get(d) === job.infoZaehler && hatAeltereVolle(job, d)) continue;
      gewaehlt = d;
      break;
    }

    let lines;
    if (gewaehlt != null) {
      lines = sortiert(job.tiefen.get(gewaehlt));
    } else {
      // Rueckfall (sehr frueh abgebrochen): je Zeile die tiefste exakte Angabe
      const beste = new Map();
      for (const [d, satz] of job.tiefen) {
        for (const [k, zeile] of satz) {
          const alt = beste.get(k);
          if (!alt || alt.depth < d) beste.set(k, zeile);
        }
      }
      const gesehen = new Set();
      lines = [...beste.values()]
        .sort((a, b) => a.multipv - b.multipv)
        .filter((l) => (gesehen.has(l.pv[0]) ? false : gesehen.add(l.pv[0])));
    }
    const tiefe = gewaehlt ?? (lines.length ? Math.max(...lines.map((l) => l.depth)) : 0);
    const analyse = baueAnalyse(job, tiefe, lines, best ?? (lines[0]?.pv[0] ?? null));
    analyse.abgebrochen = job.stopp;

    this._laufend = null;
    job.resolve(analyse);
    this._weiter();
  }

  _absturz(fehler) {
    this._worker = null;
    this._initPromise = null;
    this._opt = { multipv: 1, skill: null, elo: null };
    this._alleAufloesen(fehler);
  }

  _alleAufloesen(fehler = null) {
    const jobs = [];
    if (this._laufend) jobs.push(this._laufend);
    jobs.push(...this._schlange.splice(0));
    this._laufend = null;
    this._lauscher.clear();
    for (const job of jobs) {
      if (job.typ === 'suche') {
        const a = leereAnalyse(job);
        if (fehler) a.fehler = fehler.message;
        job.resolve(a);
      } else {
        job.resolve();
      }
    }
  }
}

// ---------- Hilfen ----------

function jetzt() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function zahlOderNull(x) {
  return typeof x === 'number' && isFinite(x) && x > 0 ? x : null;
}

function begrenze(x, min, max) {
  return Math.max(min, Math.min(max, x));
}

function sortiert(satz) {
  return [...satz.values()].sort((a, b) => a.multipv - b.multipv);
}

function hatAeltereVolle(job, d) {
  for (const [t, satz] of job.tiefen) if (t < d && satz.size >= job.n) return true;
  return false;
}

// Stockfish meldet aus Sicht der Seite am Zug: fuer Schwarz umdrehen
function weissSicht(cp, mate, turn) {
  const vz = turn === 'b' ? -1 : 1;
  if (mate != null) return { cp: null, mate: mate === 0 ? 0 : mate * vz };
  return { cp: cp === 0 ? 0 : cp * vz, mate: null };
}

function leseInfo(z) {
  const t = z.trim().split(/\s+/);
  const r = { depth: null, multipv: 1, cp: null, mate: null, grenze: false, pv: [] };
  for (let i = 1; i < t.length; i++) {
    switch (t[i]) {
      case 'string':
        return null;
      case 'depth':
        r.depth = Number(t[++i]);
        break;
      case 'multipv':
        r.multipv = Number(t[++i]);
        break;
      case 'score': {
        const art = t[++i];
        const wert = Number(t[++i]);
        if (art === 'cp') r.cp = wert;
        else if (art === 'mate') r.mate = wert;
        if (t[i + 1] === 'lowerbound' || t[i + 1] === 'upperbound') {
          r.grenze = true;
          i++;
        }
        break;
      }
      case 'lowerbound':
      case 'upperbound':
        r.grenze = true;
        break;
      case 'pv':
        r.pv = t.slice(i + 1);
        i = t.length;
        break;
      default:
        // seldepth, nodes, nps, time, hashfull, wdl ... ueberspringen
        break;
    }
  }
  if (!Number.isFinite(r.depth)) r.depth = null;
  return r;
}

function baueAnalyse(job, depth, lines, bestmove) {
  return {
    fen: job.fen,
    turn: job.turn,
    depth,
    bestmove: bestmove ?? (lines[0]?.pv[0] ?? null),
    lines,
    ende: null,
    gewinner: null,
    abgebrochen: false,
    zeitMs: job.start ? Math.round(jetzt() - job.start) : 0,
  };
}

function leereAnalyse(job) {
  const a = baueAnalyse(job, 0, [], null);
  a.abgebrochen = true;
  return a;
}

// Matt: Vorzeichen zeigt den Gewinner (mate +1 = Weiss hat matt gesetzt, -1 = Schwarz),
// damit Gewinnchancen ohne Sonderfall stimmen. Patt: cp 0.
function endstellung(fen, turn, schach) {
  const gewinner = schach ? (turn === 'w' ? 'b' : 'w') : null;
  const ev = schach ? { cp: null, mate: gewinner === 'w' ? 1 : -1 } : { cp: 0, mate: null };
  return {
    fen, turn, depth: 0, bestmove: null,
    lines: [{ multipv: 1, depth: 0, eval: ev, pv: [] }],
    ende: schach ? 'matt' : 'patt',
    gewinner,
    abgebrochen: false,
    zeitMs: 0,
  };
}
