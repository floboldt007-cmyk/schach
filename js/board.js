// Brett-Komponente: DOM-Brett mit Tippen-Tippen und Ziehen (Pointer Events, iPad),
// Animation, Markierungen, Pfeilen, Zug-Klassen-Abzeichen und Umwandlungsauswahl.
// Kennt keine Schachregeln: welche Zuege gehen, sagt die App ueber erlaubeZuege().
//
// DOM (Klassennamen fuer css/app.css, Grundstil in css/board.css):
//   .brett[data-ausrichtung="w"|"b"]                    das uebergebene Element (ohne padding/border)
//     .brett-felder                                      8x8-Raster, abgerundet, schneidet ab
//       .feld.h | .feld.d [data-feld]                    Felder, darin .koord.zahl / .koord.buchst
//       .brett-lagen > .lage.<art>[data-feld]            Ueberlagerungen: zuletzt, auswahl, schach,
//                                                        ziel (Punkt), ziel.schlag (Ring), ueber, mark-<art>
//     img.figur[data-feld][data-figur="wN"]              Figuren; Zustaende .gleitet .gezogen .geht .kommt
//     svg.brett-pfeile > g.pfeil[data-von][data-nach]    Pfeile (viewBox 0 0 8 8)
//     .abzeichen-ort.k-<klasse>[data-feld][data-klasse]  Klassen-Symbol oben rechts am Feld
//     .brett-umwandlung > .umwandlung-wahl > button.umwandlung-figur[data-figur="q"]
//     svg.brett-striche > g.strich[data-art][data-von][data-nach]   W0+a: Striche (im Brett oder in einer Effekt-Ebene)
// Alles, was auf einem Feld sitzt, traegt --x/--y (Spalte/Zeile am Bildschirm, 0..7).
//
// W0+a "Spiel-Fundament" (SPIELKONZEPT 6.2, 3.9, 3.18):
//   new Brett(el, { ..., beiAbgelehnt(von, nach, art) })   meldet einen Zugversuch, den die Zielkarte nicht
//       erlaubt (nur waehrend erlaubeZuege() gesetzt ist): Figur auf ein nicht erlaubtes Feld gezogen oder getippt
//       (nach = Feld, art 'ziehen' | 'tippen'), oder eine eigene Figur ohne erlaubten Zug angetippt oder gezogen
//       (nach = null beim Antippen). Am Bild aendert sich dabei nichts. partie.js sendet daraus zug:abgelehnt.
//   striche(liste, { ebene = null, animieren = true }) -> { el, entferne() }
//       liste: [{ von, nach, art = 'linie' | 'haken' | 'kreuz', farbe, breite = 0.07, verzoegerung = 0 (ms) }]
//       'linie' von Feldmitte zu Feldmitte (Mattnetz: die Figur, die ein Fluchtfeld deckt), 'haken' und 'kreuz'
//       auf dem Feld nach (bzw. von). Gezeichnet in ebene (z. B. buehne.effekte, gleiche Lage wie die Felder)
//       oder im Brett ueber den Figuren; folgt dem Drehen des Bretts. Nur transform und opacity werden animiert,
//       reduzierte Bewegung zeigt sofort das fertige Bild.
//   kippeKoenig(feld, { langsam = false }) -> boolean   der Koenig auf feld kippt (Matt, Finisher); setzeStellung
//       und richteAuf() stellen ihn wieder auf. false, wenn dort kein Koenig steht.

const DATEIEN = 'abcdefgh';
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const SVG_NS = 'http://www.w3.org/2000/svg';

const FIGUR_NAMEN = { q: 'Dame', r: 'Turm', b: 'Läufer', n: 'Springer' };
const UMWANDLUNG_REIHE = ['q', 'r', 'b', 'n']; // Vertrag: D T L S

export const KLASSEN_TITEL = {
  brillant: 'Brillant', stark: 'Großartig', bester: 'Bester Zug', exzellent: 'Exzellent',
  gut: 'Gut', buch: 'Buchzug', ungenau: 'Ungenau', fehler: 'Fehler',
  verpasst: 'Chance verpasst', patzer: 'Patzer', erzwungen: 'Erzwungen',
};

// Ersatzfarben, falls die Design-Variablen --k-* fehlen
const KLASSEN_ERSATZ = {
  brillant: '#14b8c8', stark: '#4f7bf7', bester: '#2db45d', exzellent: '#7cc242', gut: '#97ad7b',
  buch: '#c38d5e', ungenau: '#e9b21b', fehler: '#ff8b2c', verpasst: '#b266ea', patzer: '#f0474b',
  erzwungen: '#8a93a8',
};

// Farbnamen fuer Pfeile, die auf Vertrags-Variablen zeigen
const VAR_FARBEN = new Set(['hinweis', 'akzent', 'gut', 'schlecht', 'auswahl', 'zuletzt', 'schach', 'punkt']);

// ---------- Klassen-Symbole (austauschbar ueber setzeSymbole) ----------

const STRICH = 'fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"';
const zeichen = (t, groesse = 19) =>
  `<text x="20" y="21" text-anchor="middle" dominant-baseline="central" fill="#fff" font-size="${groesse}" ` +
  `font-weight="900" font-family="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">${t}</text>`;

const PLATZHALTER_ZEICHEN = {
  brillant: zeichen('!!'),
  stark: zeichen('!', 22),
  bester: '<path d="M20 9.2l3.2 6.6 7.3.9-5.4 5 1.4 7.2L20 25.3l-6.5 3.6 1.4-7.2-5.4-5 7.3-.9z" fill="#fff"/>',
  exzellent: `<path d="M13 20.5l7-6.5 7 6.5M13 27l7-6.5 7 6.5" ${STRICH} stroke-width="3.2"/>`,
  gut: `<path d="M13 23.5l7-7 7 7" ${STRICH} stroke-width="3.4"/>`,
  buch: `<path d="M10.5 13.2c3.2-1.3 6.3-1.1 9.5 1 3.2-2.1 6.3-2.3 9.5-1v13.4c-3.2-1.3-6.3-1.1-9.5 1-3.2-2.1-6.3-2.3-9.5-1z" ${STRICH} stroke-width="2.4"/><path d="M20 14.2v13.4" ${STRICH} stroke-width="2.2"/>`,
  ungenau: zeichen('?!'),
  fehler: zeichen('?', 22),
  verpasst: `<path d="M14.2 14.2l11.6 11.6M25.8 14.2L14.2 25.8" ${STRICH} stroke-width="3.6"/>`,
  patzer: zeichen('??'),
  erzwungen: `<path d="M11 20h16.5M21.5 14l6 6-6 6" ${STRICH} stroke-width="3.4"/>`,
};

function platzhalterSymbol(klasse) {
  const farbe = `var(--k-${klasse}, ${KLASSEN_ERSATZ[klasse] || '#8a93a8'})`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" aria-hidden="true">` +
    `<circle cx="20" cy="20" r="17.8" style="fill:${farbe}" stroke="#fff" stroke-width="2.4"/>` +
    (PLATZHALTER_ZEICHEN[klasse] || zeichen('?')) + '</svg>';
}

const eigeneSymbole = {};
const alleBretter = new Set();

// Symbole tauschen: setzeSymbole({ brillant: '<svg ...>', ... }); null setzt auf den Platzhalter zurueck.
export function setzeSymbole(karte) {
  for (const [klasse, svg] of Object.entries(karte || {})) {
    if (svg == null) delete eigeneSymbole[klasse];
    else eigeneSymbole[klasse] = String(svg);
  }
  for (const b of alleBretter) b._zeichneAbzeichen(false);
}

// Aktuelles SVG einer Klasse (auch fuer Coach-Zeile und Zugliste nutzbar)
export function symbolSvg(klasse) {
  return eigeneSymbole[klasse] || platzhalterSymbol(klasse);
}

// Zielkarte fuer erlaubeZuege() aus einer chess.js-Instanz: { e2: ['e3','e4'], ... }
export function zielKarte(chess) {
  const karte = {};
  for (const z of chess.moves({ verbose: true })) {
    const liste = karte[z.from] || (karte[z.from] = []);
    if (!liste.includes(z.to)) liste.push(z.to);
  }
  return karte;
}

// ---------- Hilfen ----------

function gueltigesFeld(f) {
  return typeof f === 'string' && /^[a-h][1-8]$/.test(f);
}

function leseFen(fen) {
  const text = fen === 'start' || !fen ? START_FEN : String(fen).trim();
  const teile = text.split(/\s+/);
  const reihen = teile[0].split('/');
  if (reihen.length !== 8) throw new Error('Ungültige FEN: ' + fen);
  const figuren = new Map();
  reihen.forEach((reihe, i) => {
    let datei = 0;
    for (const z of reihe) {
      if (z >= '1' && z <= '8') datei += Number(z);
      else if ('pnbrqkPNBRQK'.includes(z)) {
        if (datei > 7) throw new Error('Ungültige FEN: ' + fen);
        figuren.set(DATEIEN[datei] + (8 - i), (z === z.toUpperCase() ? 'w' : 'b') + z.toUpperCase());
        datei++;
      } else throw new Error('Ungültige FEN: ' + fen);
    }
    if (datei !== 8) throw new Error('Ungültige FEN: ' + fen);
  });
  return { figuren, amZug: teile[1] === 'b' ? 'b' : 'w' };
}

function feldAbstand(a, b) {
  return Math.hypot(a.charCodeAt(0) - b.charCodeAt(0), Number(a[1]) - Number(b[1]));
}

// Bauer <-> umgewandelte Figur (vor- und rueckwaerts), fuer eine gleitende Umwandlung
function istUmwandlungsPaar(altFeld, altCode, neuFeld, neuCode) {
  if (altCode[0] !== neuCode[0] || altCode === neuCode) return false;
  const dx = Math.abs(altFeld.charCodeAt(0) - neuFeld.charCodeAt(0));
  const dy = Math.abs(Number(altFeld[1]) - Number(neuFeld[1]));
  if (dx > 1 || dy !== 1) return false;
  const grund = (f) => f[1] === '1' || f[1] === '8';
  if (altCode[1] === 'P' && neuCode[1] !== 'K' && grund(neuFeld)) return true;
  if (neuCode[1] === 'P' && altCode[1] !== 'K' && grund(altFeld)) return true;
  return false;
}

// Zug auf eine Figurenkarte anwenden (Rochade, en passant, Umwandlung)
function wendeZugAn(alt, von, nach, umwandlung) {
  const neu = new Map(alt);
  const fig = neu.get(von);
  if (!fig) return neu;
  neu.delete(von);
  const farbe = fig[0];
  const art = fig[1];
  const dd = nach.charCodeAt(0) - von.charCodeAt(0);
  if (art === 'K' && Math.abs(dd) === 2 && von[1] === nach[1]) {
    const [turmVon, turmNach] = dd > 0 ? ['h', 'f'] : ['a', 'd'];
    if (neu.get(turmVon + von[1]) === farbe + 'R') {
      neu.delete(turmVon + von[1]);
      neu.set(turmNach + von[1], farbe + 'R');
    }
  }
  if (art === 'P' && dd !== 0 && !neu.has(nach)) {
    const opfer = nach[0] + von[1];
    const o = neu.get(opfer);
    if (o && o[1] === 'P' && o[0] !== farbe) neu.delete(opfer);
  }
  let ergebnis = fig;
  if (art === 'P' && (nach[1] === '8' || nach[1] === '1')) {
    ergebnis = farbe + String(umwandlung || 'q').toUpperCase();
  }
  neu.set(nach, ergebnis);
  return neu;
}

function farbeAus(farbe) {
  if (!farbe) return 'var(--k-bester, #2db45d)';
  if (KLASSEN_ERSATZ[farbe]) return `var(--k-${farbe}, ${KLASSEN_ERSATZ[farbe]})`;
  if (VAR_FARBEN.has(farbe)) return `var(--${farbe})`;
  return farbe;
}

function svgEl(name, attr) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attr)) el.setAttribute(k, v);
  return el;
}

// ---------- Brett ----------

export class Brett {
  constructor(element, { ausrichtung = 'w', figurenPfad = 'assets/pieces/', beiZug = null,
    koordinaten = true, animation = 150, fen = null, beiAbgelehnt = null } = {}) {
    if (!element) throw new Error('Brett braucht ein Element');
    this.el = element;
    this.figurenPfad = figurenPfad.endsWith('/') ? figurenPfad : figurenPfad + '/';
    this.beiZug = beiZug;
    this.beiAbgelehnt = typeof beiAbgelehnt === 'function' ? beiAbgelehnt : null;
    this._stumm = null;          // Geste auf einer eigenen Figur ohne erlaubten Zug (nur fuer beiAbgelehnt)
    this._striche = new Set();   // gezeichnete Striche (W0+a)
    this._gekippt = new Set();   // gekippte Koenige (img)
    this.ausrichtung = ausrichtung === 'b' ? 'b' : 'w';
    this.dauer = animation;

    this._figuren = new Map();   // feld -> img
    this._erlaubt = null;        // Map feld -> Set(ziele) oder null
    this._erlaubtVersion = 0;
    this._stellungVersion = 0;
    this._letzter = null;
    this._schach = null;
    this._auswahl = null;
    this._ueber = null;
    this._marken = new Map();    // art -> Set(felder)
    this._lagen = new Map();     // schluessel -> element
    this._pfeile = [];
    this._abzeichen = null;
    this._abzeichenEl = null;
    this._geste = null;
    this._umwandlung = null;
    this._wartet = false;
    this._koord = !!koordinaten;
    this._cursorFeld = null;

    this._baue();
    alleBretter.add(this);
    if (fen) this.setzeStellung(fen, { animieren: false });
  }

  // ----- oeffentliche API (Vertrag) -----

  setzeStellung(fen, { animieren = true, letzterZug = null, schach = null } = {}) {
    const { figuren, amZug } = leseFen(fen);
    this._stellungVersion++;
    if (this._gekippt.size) this.richteAuf();
    if (this._umwandlung) this._brichUmwandlungAb(false);
    if (this._geste) this._brichGesteAb(false);
    this._auswahl = null;
    this._ueber = null;
    this._letzter = this._normiereLetzten(letzterZug);
    if (schach === true) {
      this._schach = [...figuren].find(([, c]) => c === amZug + 'K')?.[0] || null;
    } else this._schach = gueltigesFeld(schach) ? schach : null;
    this._zeigeFiguren(figuren, animieren && this._figuren.size > 0);
    this._zeichneLagen();
  }

  setzeAusrichtung(farbe) {
    const neu = farbe === 'b' ? 'b' : 'w';
    if (neu === this.ausrichtung) return;
    if (this._umwandlung) this._brichUmwandlungAb(false);
    if (this._geste) this._brichGesteAb(false);
    this.ausrichtung = neu;
    this.el.dataset.ausrichtung = neu;
    this._beschrifte();
    for (const [feld, el] of this._figuren) { el.classList.remove('gleitet'); this._platziere(el, feld); }
    for (const el of this._lagen.values()) this._platziere(el, el.dataset.feld);
    if (this._abzeichenEl) this._platziere(this._abzeichenEl, this._abzeichen.feld);
    this._zeichnePfeile();
    for (const h of this._striche) this._zeichneStriche(h);
  }

  // Bequemlichkeit: Brett drehen
  dreheUm() {
    this.setzeAusrichtung(this.ausrichtung === 'w' ? 'b' : 'w');
  }

  erlaubeZuege(karte) {
    this._erlaubtVersion++;
    if (!karte) this._erlaubt = null;
    else {
      this._erlaubt = new Map();
      const eintraege = karte instanceof Map ? [...karte] : Object.entries(karte);
      for (const [von, ziele] of eintraege) {
        const s = new Set([...(ziele || [])].map((z) => String(z).slice(0, 2)).filter(gueltigesFeld));
        if (gueltigesFeld(von) && s.size) this._erlaubt.set(von, s);
      }
    }
    if (this._geste && !this._kannZiehen(this._geste.von)) this._brichGesteAb(true);
    const u = this._umwandlung;
    if (u && !this._zieleVon(u.von).has(u.nach)) this._brichUmwandlungAb(true);
    if (this._auswahl && !this._kannZiehen(this._auswahl)) this._auswahl = null;
    this._zeichneLagen();
  }

  zeigeAbzeichen(feld, klasse) {
    if (!gueltigesFeld(feld) || !klasse) { this.entferneAbzeichen(); return; }
    this._abzeichen = { feld, klasse };
    this._zeichneAbzeichen(true);
  }

  entferneAbzeichen() {
    this._abzeichen = null;
    if (this._abzeichenEl) this._abzeichenEl.remove();
    this._abzeichenEl = null;
  }

  // [{ von, nach, farbe?, breite?, deckkraft? }]; farbe = CSS-Farbe, Klassenname ('bester') oder
  // Vertragsname ('hinweis', 'akzent', 'gut', 'schlecht'). von === nach zeichnet einen Kreis.
  pfeile(liste) {
    this._pfeile = (liste || []).filter((p) => p && gueltigesFeld(p.von) && gueltigesFeld(p.nach || p.von));
    this._zeichnePfeile();
  }

  // markiere(['e4'], 'hinweis') setzt die Felder dieser Art (ersetzt die vorigen),
  // markiere([], art) / markiere(null, art) loescht die Art, markiere(null) loescht alle.
  // Arten mit Grundstil: hinweis, fehler, gut, auswahl, zuletzt, bewertung, k-<klasse>.
  markiere(felder, art) {
    const liste = felder == null ? [] : [].concat(felder).filter(gueltigesFeld);
    if (!liste.length) {
      if (art) this._marken.delete(art);
      else this._marken.clear();
    } else this._marken.set(art || 'hinweis', new Set(liste));
    this._zeichneLagen();
  }

  koordinaten(an = true) {
    this._koord = !!an;
    this.el.classList.toggle('ohne-koordinaten', !this._koord);
    this._beschrifte();
  }

  // ----- W0+a: Striche und Koenigsfall -----

  striche(liste, { ebene = null, animieren = true } = {}) {
    const gut = (liste || []).filter((x) => x && gueltigesFeld(x.nach || x.von) && (x.von == null || gueltigesFeld(x.von)));
    const svg = svgEl('svg', { class: 'brett-striche', viewBox: '0 0 8 8', 'aria-hidden': 'true' });
    if (!animieren) svg.classList.add('still');
    const h = { liste: gut, el: svg };
    if (ebene && typeof ebene.appendChild === 'function') ebene.appendChild(svg);
    else this.el.insertBefore(svg, this._umwandlungEl);
    this._zeichneStriche(h);
    this._striche.add(h);
    return {
      el: svg,
      entferne: () => {
        this._striche.delete(h);
        svg.remove();
      },
    };
  }

  _zeichneStriche(h) {
    h.el.replaceChildren();
    const mitte = (feld) => {
      const [x, y] = this._spalteZeile(feld);
      return [x + 0.5, y + 0.5];
    };
    const r = (n) => Number(n.toFixed(3));
    for (const s of h.liste) {
      const nach = s.nach || s.von;
      const von = s.von || nach;
      const art = ['linie', 'haken', 'kreuz'].includes(s.art) ? s.art : 'linie';
      const breite = Number(s.breite) > 0 ? Number(s.breite) : 0.07;
      const g = svgEl('g', { class: 'strich', 'data-art': art, 'data-von': von, 'data-nach': nach });
      g.style.color = farbeAus(s.farbe || 'akzent');
      g.style.setProperty('--v', Math.max(0, Number(s.verzoegerung) || 0) + 'ms');
      const strich = { fill: 'none', stroke: 'currentColor', 'stroke-width': breite, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
      if (art === 'linie' && von !== nach) {
        const [x1, y1] = mitte(von);
        const [x2, y2] = mitte(nach);
        const winkel = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        const laenge = Math.hypot(x2 - x1, y2 - y1);
        const lage = svgEl('g', { transform: `translate(${r(x1)} ${r(y1)}) rotate(${r(winkel)})` });
        lage.append(svgEl('line', { ...strich, x1: 0, y1: 0, x2: r(laenge), y2: 0, class: 'strich-zug' }));
        g.append(lage);
      } else {
        const [x, y] = mitte(nach);
        const lage = svgEl('g', { transform: `translate(${r(x)} ${r(y)})` });
        const d = art === 'kreuz' ? 'M -0.2 -0.2 L 0.2 0.2 M 0.2 -0.2 L -0.2 0.2' : 'M -0.22 0.02 L -0.07 0.17 L 0.23 -0.17';
        lage.append(svgEl('path', { ...strich, d, class: 'strich-marke' }));
        g.append(lage);
      }
      h.el.append(g);
    }
  }

  kippeKoenig(feld, { langsam = false } = {}) {
    const el = gueltigesFeld(feld) ? this._figuren.get(feld) : null;
    if (!el || !/K$/.test(el.dataset.figur || '')) return false;
    el.classList.add('kippt');
    el.classList.toggle('langsam', !!langsam);
    this._gekippt.add(el);
    return true;
  }

  richteAuf() {
    for (const el of this._gekippt) el.classList.remove('kippt', 'langsam');
    this._gekippt.clear();
  }

  // ----- Zusatz -----

  figurAuf(feld) {
    const el = this._figuren.get(feld);
    return el ? el.dataset.figur : null;
  }

  zerstoere() {
    alleBretter.delete(this);
    for (const h of this._striche) h.el.remove();
    this._striche.clear();
    const el = this.el;
    el.removeEventListener('pointerdown', this._h.runter);
    el.removeEventListener('pointermove', this._h.bewege);
    el.removeEventListener('pointerup', this._h.hoch);
    el.removeEventListener('pointercancel', this._h.abbruch);
    el.removeEventListener('lostpointercapture', this._h.abbruch);
    el.removeEventListener('contextmenu', this._h.kontext);
    el.removeEventListener('pointerleave', this._h.verlassen);
    document.removeEventListener('keydown', this._h.taste);
    el.innerHTML = '';
    el.classList.remove('brett', 'zieht', 'ohne-koordinaten');
  }

  // ----- Aufbau -----

  _baue() {
    const el = this.el;
    el.classList.add('brett');
    el.innerHTML = '';
    el.dataset.ausrichtung = this.ausrichtung;
    el.style.setProperty('--brett-dauer', this.dauer + 'ms');
    if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', 'Schachbrett');

    this._felderEl = document.createElement('div');
    this._felderEl.className = 'brett-felder';
    this._feldEls = [];
    for (let i = 0; i < 64; i++) {
      const f = document.createElement('div');
      const zeile = Math.floor(i / 8);
      const spalte = i % 8;
      f.className = 'feld ' + ((zeile + spalte) % 2 === 0 ? 'h' : 'd');
      this._feldEls.push(f);
      this._felderEl.append(f);
    }
    this._lagenEl = document.createElement('div');
    this._lagenEl.className = 'brett-lagen';
    this._felderEl.append(this._lagenEl);

    this._pfeileEl = svgEl('svg', { class: 'brett-pfeile', viewBox: '0 0 8 8', 'aria-hidden': 'true' });

    this._umwandlungEl = document.createElement('div');
    this._umwandlungEl.className = 'brett-umwandlung';
    this._umwandlungEl.hidden = true;
    this._umwandlungEl.setAttribute('role', 'dialog');
    this._umwandlungEl.setAttribute('aria-label', 'Umwandlung wählen');

    el.append(this._felderEl, this._pfeileEl, this._umwandlungEl);
    el.classList.toggle('ohne-koordinaten', !this._koord);
    this._beschrifte();

    this._h = {
      runter: (e) => this._runter(e),
      bewege: (e) => this._bewege(e),
      hoch: (e) => this._hoch(e),
      abbruch: (e) => this._abbruch(e),
      kontext: (e) => e.preventDefault(),
      verlassen: () => this._setzeCursor(null),
      taste: (e) => { if (e.key === 'Escape' && this._umwandlung) this._brichUmwandlungAb(true); },
      wahlRunter: (e) => this._wahlRunter(e),
      wahlHoch: (e) => this._wahlHoch(e),
      wahlKlick: (e) => this._wahlKlick(e),
    };
    el.addEventListener('pointerdown', this._h.runter);
    el.addEventListener('pointermove', this._h.bewege);
    el.addEventListener('pointerup', this._h.hoch);
    el.addEventListener('pointercancel', this._h.abbruch);
    el.addEventListener('lostpointercapture', this._h.abbruch);
    el.addEventListener('contextmenu', this._h.kontext);
    el.addEventListener('pointerleave', this._h.verlassen);
    this._umwandlungEl.addEventListener('pointerdown', this._h.wahlRunter);
    this._umwandlungEl.addEventListener('pointerup', this._h.wahlHoch);
    this._umwandlungEl.addEventListener('click', this._h.wahlKlick);
  }

  // Feldnamen und Koordinaten je nach Ausrichtung
  _beschrifte() {
    this._feldEls.forEach((f, i) => {
      const zeile = Math.floor(i / 8);
      const spalte = i % 8;
      const feld = this._feldAus(spalte, zeile);
      f.dataset.feld = feld;
      f.textContent = '';
      if (!this._koord) return;
      if (spalte === 0) {
        const s = document.createElement('span');
        s.className = 'koord zahl';
        s.textContent = feld[1];
        f.append(s);
      }
      if (zeile === 7) {
        const s = document.createElement('span');
        s.className = 'koord buchst';
        s.textContent = feld[0];
        f.append(s);
      }
    });
  }

  // ----- Koordinaten -----

  _spalteZeile(feld) {
    const d = feld.charCodeAt(0) - 97;
    const r = Number(feld[1]) - 1;
    return this.ausrichtung === 'w' ? [d, 7 - r] : [7 - d, r];
  }

  _feldAus(spalte, zeile) {
    if (spalte < 0 || spalte > 7 || zeile < 0 || zeile > 7) return null;
    return this.ausrichtung === 'w' ? DATEIEN[spalte] + (8 - zeile) : DATEIEN[7 - spalte] + (zeile + 1);
  }

  _feldAusPunkt(x, y) {
    const r = this._felderEl.getBoundingClientRect();
    if (!r.width) return null;
    return this._feldAus(Math.floor((x - r.left) / r.width * 8), Math.floor((y - r.top) / r.height * 8));
  }

  _platziere(el, feld) {
    const [x, y] = this._spalteZeile(feld);
    el.style.setProperty('--x', x);
    el.style.setProperty('--y', y);
    el.dataset.feld = feld;
  }

  _normiereLetzten(z) {
    if (!z) return null;
    if (typeof z === 'string' && z.length >= 4) z = [z.slice(0, 2), z.slice(2, 4)];
    if (Array.isArray(z) && gueltigesFeld(z[0]) && gueltigesFeld(z[1])) return [z[0], z[1]];
    return null;
  }

  // ----- Figuren -----

  _bild(code) {
    return this.figurenPfad + code + '.svg';
  }

  _neueFigur(code, feld) {
    const img = document.createElement('img');
    img.className = 'figur';
    img.alt = '';
    img.draggable = false;
    img.dataset.figur = code;
    img.src = this._bild(code);
    this._platziere(img, feld);
    this.el.insertBefore(img, this._pfeileEl);
    return img;
  }

  _stellungKarte() {
    const k = new Map();
    for (const [feld, el] of this._figuren) k.set(feld, el.dataset.figur);
    return k;
  }

  _gleite(el, an) {
    clearTimeout(el._gleitZeit);
    if (an) {
      el.classList.add('gleitet');
      el._gleitZeit = setTimeout(() => el.classList.remove('gleitet'), this.dauer + 60);
    } else el.classList.remove('gleitet');
  }

  // Neue Stellung zeigen: gleiche Figuren gleiten (kuerzester Weg), geschlagene blenden aus.
  // sofortFeld: die Figur, die dort landet, springt ohne Gleiten (nach dem Ziehen mit dem Finger).
  _zeigeFiguren(neu, animieren, sofortFeld = null) {
    const bleiben = new Map();
    const weg = [];
    const dazu = [];
    for (const [feld, el] of this._figuren) {
      if (neu.get(feld) === el.dataset.figur) bleiben.set(feld, el);
      else weg.push({ feld, el, code: el.dataset.figur });
    }
    for (const [feld, code] of neu) if (!bleiben.has(feld)) dazu.push({ feld, code });

    const paare = [];
    const wegFrei = new Set(weg.map((_, i) => i));
    const dazuFrei = new Set(dazu.map((_, i) => i));
    const kandidaten = [];
    weg.forEach((w, i) => dazu.forEach((d, j) => {
      if (w.code === d.code) kandidaten.push([feldAbstand(w.feld, d.feld), i, j]);
    }));
    kandidaten.sort((a, b) => a[0] - b[0]);
    for (const [, i, j] of kandidaten) {
      if (wegFrei.has(i) && dazuFrei.has(j)) { wegFrei.delete(i); dazuFrei.delete(j); paare.push([weg[i], dazu[j]]); }
    }
    for (const j of [...dazuFrei]) {
      for (const i of wegFrei) {
        if (istUmwandlungsPaar(weg[i].feld, weg[i].code, dazu[j].feld, dazu[j].code)) {
          wegFrei.delete(i); dazuFrei.delete(j); paare.push([weg[i], dazu[j]]);
          break;
        }
      }
    }

    const karte = new Map(bleiben);
    for (const [w, d] of paare) {
      const el = w.el;
      if (el.dataset.figur !== d.code) { el.dataset.figur = d.code; el.src = this._bild(d.code); }
      el.classList.remove('verdeckt', 'geht');
      el.style.transform = '';
      this._gleite(el, animieren && d.feld !== sofortFeld);
      this._platziere(el, d.feld);
      karte.set(d.feld, el);
    }
    for (const i of wegFrei) {
      const el = weg[i].el;
      clearTimeout(el._gleitZeit);
      if (animieren) {
        el.classList.add('geht');
        el.dataset.feld = '';
        setTimeout(() => el.remove(), this.dauer + 60);
      } else el.remove();
    }
    for (const j of dazuFrei) {
      const el = this._neueFigur(dazu[j].code, dazu[j].feld);
      if (animieren) el.classList.add('kommt');
      karte.set(dazu[j].feld, el);
    }
    this._figuren = karte;
  }

  // ----- Zustand der Ueberlagerungen -----

  _kannZiehen(feld) {
    return !this._wartet && !!this._erlaubt && !!this._erlaubt.get(feld) && this._figuren.has(feld);
  }

  _zieleVon(feld) {
    return (this._erlaubt && this._erlaubt.get(feld)) || new Set();
  }

  _zeichneLagen() {
    const soll = [];
    if (this._letzter) for (const f of this._letzter) soll.push(['zuletzt', f]);
    for (const [art, felder] of this._marken) for (const f of felder) soll.push(['mark-' + art, f]);
    if (this._schach) soll.push(['schach', this._schach]);
    if (this._auswahl) {
      soll.push(['auswahl', this._auswahl]);
      if (!this._umwandlung) {
        for (const z of this._zieleVon(this._auswahl)) soll.push([this._figuren.has(z) ? 'ziel schlag' : 'ziel', z]);
      }
    }
    if (this._ueber) soll.push(['ueber', this._ueber]);

    const neu = new Map();
    for (const [art, feld] of soll) {
      const schluessel = art + '@' + feld;
      if (neu.has(schluessel)) continue;
      let el = this._lagen.get(schluessel);
      if (!el) {
        el = document.createElement('div');
        el.className = 'lage ' + art;
        this._platziere(el, feld);
        this._lagenEl.append(el);
      }
      neu.set(schluessel, el);
    }
    for (const [schluessel, el] of this._lagen) if (!neu.has(schluessel)) el.remove();
    this._lagen = neu;
  }

  _zeichneAbzeichen(plopp) {
    if (!this._abzeichen) return;
    const { feld, klasse } = this._abzeichen;
    let el = this._abzeichenEl;
    if (!el || plopp) {
      if (el) el.remove();
      el = document.createElement('div');
      this.el.insertBefore(el, this._umwandlungEl);
      this._abzeichenEl = el;
    }
    el.className = 'abzeichen-ort k-' + klasse + (plopp ? ' plopp' : '');
    el.dataset.klasse = klasse;
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', KLASSEN_TITEL[klasse] || klasse);
    el.innerHTML = symbolSvg(klasse);
    this._platziere(el, feld);
  }

  _zeichnePfeile() {
    const svg = this._pfeileEl;
    svg.replaceChildren();
    const mitte = (feld) => {
      const [x, y] = this._spalteZeile(feld);
      return [x + 0.5, y + 0.5];
    };
    for (const p of this._pfeile) {
      const nach = p.nach || p.von;
      const g = svgEl('g', { class: 'pfeil', 'data-von': p.von, 'data-nach': nach });
      g.style.color = farbeAus(p.farbe);
      if (p.deckkraft != null) g.style.opacity = String(p.deckkraft);
      const breite = Number(p.breite) > 0 ? Number(p.breite) : 0.2;
      const [x1, y1] = mitte(p.von);
      if (nach === p.von) {
        g.append(svgEl('circle', {
          cx: x1, cy: y1, r: 0.44, fill: 'none', stroke: 'currentColor', 'stroke-width': Math.max(0.07, breite * 0.45),
        }));
        svg.append(g);
        continue;
      }
      const [x2, y2] = mitte(nach);
      const punkte = [[x1, y1]];
      const dx = Math.abs(x2 - x1);
      const dy = Math.abs(y2 - y1);
      if ((dx === 1 && dy === 2) || (dx === 2 && dy === 1)) {
        punkte.push(dx === 2 ? [x2, y1] : [x1, y2]); // Springer als L, langer Schenkel zuerst
      }
      const [ax, ay] = punkte[punkte.length - 1];
      const laenge = Math.hypot(x2 - ax, y2 - ay);
      const ux = (x2 - ax) / laenge;
      const uy = (y2 - ay) / laenge;
      const kopfL = breite * 2.2;
      const kopfB = breite * 1.4;
      const sx = x2 - ux * 0.08;
      const sy = y2 - uy * 0.08;
      const bx = sx - ux * kopfL;
      const by = sy - uy * kopfL;
      const r = (n) => n.toFixed(3);
      const d = 'M ' + punkte.map(([x, y]) => r(x) + ' ' + r(y)).join(' L ') + ` L ${r(bx + ux * 0.02)} ${r(by + uy * 0.02)}`;
      g.append(svgEl('path', {
        d, fill: 'none', stroke: 'currentColor', 'stroke-width': breite,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'pfeil-linie',
      }));
      g.append(svgEl('polygon', {
        points: `${r(sx)},${r(sy)} ${r(bx - uy * kopfB)},${r(by + ux * kopfB)} ${r(bx + uy * kopfB)},${r(by - ux * kopfB)}`,
        fill: 'currentColor', class: 'pfeil-kopf',
      }));
      svg.append(g);
    }
  }

  // ----- Bedienung -----

  _runter(e) {
    if (this._geste || this._umwandlung) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this._stumm = null;
    const feld = this._feldAusPunkt(e.clientX, e.clientY);
    if (!feld) return;
    e.preventDefault();
    if (this._wartet) return;
    if (this._auswahl && this._auswahl !== feld && this._zieleVon(this._auswahl).has(feld)) {
      this._versucheZug(this._auswahl, feld, 'tippen');
      return;
    }
    if (this._kannZiehen(feld)) {
      const warSchon = this._auswahl === feld;
      this._auswahl = feld;
      this._zeichneLagen();
      this._geste = {
        id: e.pointerId, von: feld, x0: e.clientX, y0: e.clientY, typ: e.pointerType,
        zieht: false, warSchon, el: this._figuren.get(feld),
      };
      try { this.el.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
      return;
    }
    // W0+a: nicht erlaubter Zugversuch (am Bild aendert sich nichts)
    if (this.beiAbgelehnt && this._erlaubt) {
      if (this._eigeneFigur(feld)) this._stumm = { id: e.pointerId, von: feld };
      else if (this._auswahl) this._meldeAbgelehnt(this._auswahl, feld, 'tippen');
    }
    if (this._auswahl) {
      this._auswahl = null;
      this._zeichneLagen();
    }
  }

  // Figur der Seite am Zug (Farbe aus der Zielkarte), die selbst keinen erlaubten Zug hat
  _eigeneFigur(feld) {
    const code = this.figurAuf(feld);
    if (!code || !this._erlaubt) return false;
    for (const von of this._erlaubt.keys()) {
      const f = this.figurAuf(von);
      if (f) return f[0] === code[0];
    }
    return false;
  }

  _meldeAbgelehnt(von, nach, art) {
    if (!this.beiAbgelehnt) return;
    try { this.beiAbgelehnt(von, nach, art); } catch (err) { console.error(err); }
  }

  _bewege(e) {
    const g = this._geste;
    if (!g) {
      if (e.pointerType === 'mouse') this._setzeCursor(this._feldAusPunkt(e.clientX, e.clientY));
      return;
    }
    if (e.pointerId !== g.id) return;
    if (!g.zieht) {
      const schwelle = g.typ === 'mouse' ? 4 : 7;
      if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < schwelle || !g.el) return;
      g.zieht = true;
      clearTimeout(g.el._gleitZeit);
      g.el.classList.remove('gleitet');
      g.el.classList.add('gezogen');
      g.el.classList.toggle('beruehrung', g.typ !== 'mouse');
      this.el.classList.add('zieht');
    }
    e.preventDefault();
    const r = this._felderEl.getBoundingClientRect();
    const s = r.width / 8;
    // Vergroesserung im selben transform (die CSS-Eigenschaft scale wuerde den Versatz mitskalieren)
    const skala = g.typ === 'mouse' ? 'var(--brett-zieh-maus, 1)' : 'var(--brett-zieh-finger, 1.35)';
    g.el.style.transform = `translate(${(e.clientX - r.left - s / 2).toFixed(1)}px, ${(e.clientY - r.top - s / 2).toFixed(1)}px) scale(${skala})`;
    const f = this._feldAusPunkt(e.clientX, e.clientY);
    const ueber = f && f !== g.von && this._zieleVon(g.von).has(f) ? f : null;
    if (ueber !== this._ueber) {
      this._ueber = ueber;
      this._zeichneLagen();
    }
  }

  _hoch(e) {
    const st = this._stumm;
    if (st && e.pointerId === st.id) {
      this._stumm = null;
      const ziel = this._feldAusPunkt(e.clientX, e.clientY);
      if (ziel && this._erlaubt && !this._wartet) this._meldeAbgelehnt(st.von, ziel === st.von ? null : ziel, ziel === st.von ? 'tippen' : 'ziehen');
      return;
    }
    const g = this._geste;
    if (!g || e.pointerId !== g.id) return;
    this._geste = null;
    this._ueber = null;
    this.el.classList.remove('zieht');
    if (g.zieht) {
      g.el.classList.remove('gezogen', 'beruehrung');
      const ziel = this._feldAusPunkt(e.clientX, e.clientY);
      if (ziel && ziel !== g.von && this._zieleVon(g.von).has(ziel)) {
        this._versucheZug(g.von, ziel, 'ziehen');
      } else {
        this._schnappeZurueck(g.el, g.von);
        this._zeichneLagen();
        if (ziel && ziel !== g.von) this._meldeAbgelehnt(g.von, ziel, 'ziehen');
      }
    } else if (g.warSchon) {
      this._auswahl = null; // zweites Tippen auf dieselbe Figur hebt die Auswahl auf
      this._zeichneLagen();
    }
  }

  _abbruch(e) {
    const g = this._geste;
    if (!g || e.pointerId !== g.id) return;
    this._brichGesteAb(true);
  }

  _brichGesteAb(animieren) {
    const g = this._geste;
    this._geste = null;
    this._ueber = null;
    this.el.classList.remove('zieht');
    if (!g) return;
    try { this.el.releasePointerCapture(g.id); } catch (err) { /* egal */ }
    if (g.zieht && g.el) {
      g.el.classList.remove('gezogen', 'beruehrung');
      if (animieren) this._schnappeZurueck(g.el, g.von);
      else { g.el.style.transform = ''; this._platziere(g.el, g.von); }
    }
    this._zeichneLagen();
  }

  _schnappeZurueck(el, feld) {
    this._gleite(el, true);
    el.style.transform = '';
    this._platziere(el, feld);
  }

  _setzeCursor(feld) {
    if (feld === this._cursorFeld) return;
    this._cursorFeld = feld;
    this.el.classList.toggle('greifbar', !!feld && this._kannZiehen(feld));
  }

  _versucheZug(von, nach, art) {
    const fig = this.figurAuf(von);
    if (fig && fig[1] === 'P' && ((fig[0] === 'w' && nach[1] === '8') || (fig[0] === 'b' && nach[1] === '1'))) {
      this._oeffneUmwandlung(von, nach, art);
      return;
    }
    this._fuehreAus(von, nach, undefined, art);
  }

  // Zug sofort zeigen (inkl. Rochade/en passant), dann die App fragen; bei Nein zuruecknehmen.
  _fuehreAus(von, nach, umwandlung, art) {
    const vorher = { figuren: this._stellungKarte(), letzter: this._letzter, schach: this._schach };
    const neu = wendeZugAn(vorher.figuren, von, nach, umwandlung);
    this._auswahl = null;
    this._ueber = null;
    this._letzter = [von, nach];
    this._schach = null;
    this._zeigeFiguren(neu, true, art === 'tippen' ? null : nach);
    this._zeichneLagen();

    const stellungVersion = ++this._stellungVersion;
    const erlaubtVersion = this._erlaubtVersion;
    const fertig = (ok) => {
      if (!ok) {
        if (this._stellungVersion === stellungVersion) {
          this._letzter = vorher.letzter;
          this._schach = vorher.schach;
          this._zeigeFiguren(vorher.figuren, true);
          this._zeichneLagen();
        }
      } else if (this._erlaubtVersion === erlaubtVersion) {
        this._erlaubt = null; // alte Zielkarte gilt nicht mehr; die App gibt die naechste frei
        this._zeichneLagen();
      }
    };
    let antwort = false;
    try {
      antwort = this.beiZug ? this.beiZug(von, nach, umwandlung) : false;
    } catch (err) {
      console.error(err);
      antwort = false;
    }
    if (antwort && typeof antwort.then === 'function') {
      this._wartet = true;
      antwort.then(
        (ok) => { this._wartet = false; fertig(!!ok); },
        (err) => { console.error(err); this._wartet = false; fertig(false); },
      );
    } else fertig(!!antwort);
  }

  // ----- Umwandlung -----

  _oeffneUmwandlung(von, nach, art) {
    const bauer = this._figuren.get(von);
    const farbe = bauer.dataset.figur[0];
    const verdeckt = this._figuren.get(nach) || null;
    if (verdeckt) verdeckt.classList.add('verdeckt');
    bauer.classList.add('wartet');
    this._gleite(bauer, art === 'tippen');
    bauer.style.transform = '';
    this._platziere(bauer, nach);

    const [spalte, zeile] = this._spalteZeile(nach);
    const nachUnten = zeile < 4;
    const wahl = document.createElement('div');
    wahl.className = 'umwandlung-wahl ' + (nachUnten ? 'nach-unten' : 'nach-oben');
    wahl.style.setProperty('--x', spalte);
    wahl.style.setProperty('--y', nachUnten ? zeile : zeile - 3);
    const knoepfe = UMWANDLUNG_REIHE.map((f) => {
      const k = document.createElement('button');
      k.type = 'button';
      k.className = 'umwandlung-figur';
      k.dataset.figur = f;
      k.setAttribute('aria-label', FIGUR_NAMEN[f]);
      k.title = FIGUR_NAMEN[f];
      const img = document.createElement('img');
      img.alt = '';
      img.draggable = false;
      img.src = this._bild(farbe + f.toUpperCase());
      k.append(img);
      return k;
    });
    if (!nachUnten) knoepfe.reverse(); // Dame steht immer direkt am Zielfeld
    wahl.append(...knoepfe);
    this._umwandlungEl.replaceChildren(wahl);
    this._umwandlungEl.hidden = false;
    this._umwandlung = { von, nach, verdeckt, bauer, knopf: null, seit: Date.now() };
    this._auswahl = von;
    this._zeichneLagen();
    document.addEventListener('keydown', this._h.taste);
  }

  _schliesseUmwandlung() {
    this._umwandlungEl.hidden = true;
    this._umwandlungEl.replaceChildren();
    document.removeEventListener('keydown', this._h.taste);
    const u = this._umwandlung;
    this._umwandlung = null;
    if (u) u.bauer.classList.remove('wartet');
    return u;
  }

  _brichUmwandlungAb(animieren) {
    const u = this._schliesseUmwandlung();
    if (!u) return;
    if (u.verdeckt) u.verdeckt.classList.remove('verdeckt');
    this._gleite(u.bauer, animieren);
    this._platziere(u.bauer, u.von);
    this._auswahl = null;
    this._zeichneLagen();
  }

  _waehleUmwandlung(figur) {
    const u = this._schliesseUmwandlung();
    if (!u) return;
    this._fuehreAus(u.von, u.nach, figur, 'ziehen');
  }

  _wahlRunter(e) {
    e.stopPropagation();
    e.preventDefault();
    if (this._umwandlung) this._umwandlung.knopf = e.target.closest('.umwandlung-figur');
  }

  _wahlHoch(e) {
    e.stopPropagation();
    const u = this._umwandlung;
    if (!u) return;
    const knopf = e.target.closest('.umwandlung-figur');
    // Touch faengt den Zeiger am Startelement ein: dann zaehlt der Knopf vom Herunterdruecken
    const unter = document.elementFromPoint(e.clientX, e.clientY);
    const ziel = (unter && unter.closest && unter.closest('.umwandlung-figur')) || knopf;
    if (ziel && ziel === u.knopf) this._waehleUmwandlung(ziel.dataset.figur);
    else if (!ziel && !u.knopf) this._brichUmwandlungAb(true);
    else u.knopf = null;
  }

  _wahlKlick(e) {
    e.stopPropagation();
    if (e.detail !== 0 || !this._umwandlung) return; // nur Tastatur (Enter/Leertaste)
    // Der Klick des Tipps, der die Auswahl geoeffnet hat, landet auf der Dame unter dem Finger
    // (manche Touch-Browser melden ihn mit detail 0): kurz nach dem Oeffnen nicht als Wahl werten
    if (Date.now() - this._umwandlung.seit < 500) return;
    const knopf = e.target.closest('.umwandlung-figur');
    if (knopf) this._waehleUmwandlung(knopf.dataset.figur);
  }
}

Brett.setzeSymbole = setzeSymbole;
Brett.symbolSvg = symbolSvg;
