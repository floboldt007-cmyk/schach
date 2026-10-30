// Alle Elemente gehoeren dem Paket. Der Host raeumt sie ueber verlasse() wieder ab.
import { hoere } from '../../ereignisse.js';
import { icon } from '../../ui/icons.js';
import { addiereTage } from '../../tag.js';
import { t, datum } from '../../sprache.js';
import '../../sprachen/allgemein.js';
import { STUFEN, SAISON_TAGE, unsicherheit, vorlaeufig, kreuztabelle, belegFuer } from './wertung.js';
import { ligaWappen } from '../../sammlung-kunst.js';
import './texte.js';

const el = (tag, klasse, text) => {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text != null) e.textContent = text;
  return e;
};
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mitIcon = (name, klasse) => { const e = el('span', klasse); e.innerHTML = icon(name); return e; };
const differenz = (n) => n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '±0';
// Texte aus dem Woerterbuch (texte.js), erst beim Zeichnen
const tx = (k, w) => t('p-liga.' + k, w);
const wertText = (w) => tx(vorlaeufig(w.n) ? 'wertVorlaeufig' : 'wert', { wert: w.wert, u: unsicherheit(w.n) });
// Spielklasse und Liga-Stufe ueber ihre Nummer (wertung.js haelt die deutschen Namen als Daten)
const klasseName = (i) => tx('klasse.' + i);
const stufeName = (i) => tx('stufe.' + i);

function beobachte(e, zeichne) {
  const ab = hoere('liga:geaendert', zeichne);
  return { el: e, verlasse: ab };
}

function tabelle(st, bots) {
  const k = kreuztabelle(st.meisterschaft, bots);
  const tab = el('table', 'liga-tabelle');
  tab.append(el('caption', null, tx('tabelle.titel')));
  const kopf = el('thead'), h = el('tr');
  for (const text of [tx('tabelle.bot'), tx('tabelle.bestes'), tx('tabelle.punkte')]) { const th = el('th', null, text); th.scope = 'col'; h.append(th); }
  kopf.append(h); tab.append(kopf);
  const tbody = el('tbody');
  for (const z of k.zeilen) {
    const r = el('tr'), th = el('th', null, z.name);
    th.scope = 'row';
    r.append(th, el('td', null, z.punkte === 3 ? t('allgemein.sieg') : z.punkte === 1 ? t('allgemein.remis')
      : z.gespielt ? tx('tabelle.gespielt') : tx('tabelle.offen')), el('td', 'zahl', z.punkte));
    tbody.append(r);
  }
  tab.append(tbody);
  return tab;
}

function details(st, bots) {
  const innen = el('div', 'liga-details');
  innen.append(el('p', 'liga-hilfe', tx('details.saison')));
  innen.append(tabelle(st, bots));
  const gesamt = kreuztabelle(st.meisterschaft, bots);
  innen.append(el('p', 'liga-hilfe zahl', tx('details.verein', { punkte: gesamt.punkte, max: bots.length * 3 })));
  innen.append(el('h4', null, tx('details.wertungen')));
  innen.append(el('p', 'liga-hilfe', tx('details.normal', { wert: wertText(st.wertung), n: st.wertung.n })));
  innen.append(el('p', 'liga-hilfe', tx('details.blitz', { wert: wertText(st.wertung.blitz), n: st.wertung.blitz.n })));
  innen.append(el('p', 'liga-hilfe', tx('details.schutz')));
  innen.append(el('p', 'liga-hilfe', tx('details.blitzRegel')));
  innen.append(el('p', 'liga-hilfe', tx('details.klasse')));
  innen.append(el('p', 'liga-hilfe', tx('details.grenzen')));
  innen.append(el('h4', null, tx('details.punkteTitel')));
  innen.append(el('p', 'liga-hilfe', tx('details.punkte')));
  innen.append(el('p', 'liga-hilfe', STUFEN.map((s, i) => tx('details.stufe', { name: stufeName(i), schwelle: s.schwelle })).join(' · ')));
  innen.append(el('p', 'liga-hilfe', tx('details.dauer')));
  innen.append(el('p', 'liga-hilfe', tx('details.zaehlt')));
  return innen;
}

export function saisonKarte({ lese, bots, saisonPruefen, verstanden }) {
  const st = lese();
  if (!st) return null;
  const karte = el('section', 'liga-karte');
  karte.setAttribute('aria-label', tx('karte.label'));
  const auf = el('details', 'liga-aufklappen'), summary = el('summary', 'liga-summary');
  // Wappen der aktuellen Stufe statt eines Sammel-Symbols (Flo 30.10.: eigenes Bild je Stueck)
  const badge = el('span', 'liga-wappen liga-wappen-kunst');
  badge.setAttribute('aria-hidden', 'true');
  const kopf = el('span', 'liga-kurz'), titel = el('strong', 'liga-titel'), unter = el('span', 'liga-unter');
  kopf.append(titel, unter);
  summary.append(badge, kopf, mitIcon('vor', 'liga-mehr'));
  auf.append(summary);
  const balken = el('progress', 'liga-balken');
  balken.max = 100;
  // Flo, 30.10.2026 (Entwurf Bestenliste): vorn nur die Liga und der Weg zur naechsten; Wertung, Klasse und
  // Vereinsmeisterschaft stehen in den Details (aufklappen)
  const weg = el('p', 'liga-hilfe liga-weg zahl'), regel = el('p', 'liga-hilfe liga-regel', tx('karte.regel'));
  const wertung = el('p', 'liga-wertung zahl'), club = el('p', 'liga-hilfe liga-club');
  const wechsel = el('div', 'liga-wechsel');
  const hinweis = el('p', 'liga-hilfe', tx('karte.neu'));
  const quitt = el('button', 'liga-knopf', tx('karte.verstanden'));
  quitt.type = 'button'; quitt.addEventListener('click', verstanden);
  wechsel.append(hinweis, quitt);
  const detailOrt = el('div');
  // Flo 30.10. abends: "Man muss sehen koennen, was fuer Ligen es gibt": die Leiter aller Stufen zuerst in den Details
  const leiterOrt = el('div');
  auf.append(leiterOrt, wertung, club, detailOrt);
  // Zusammenfassung, Balken und Weg bleiben sichtbar; Wertung, Klasse und Kreuztabelle oeffnen sich erst auf Antippen.
  karte.append(auf, balken, weg, regel, wechsel);
  const zeichne = () => {
    const s = lese();
    if (!s) { karte.hidden = true; return; }
    const naechste = STUFEN[s.saison.stufe + 1];
    // ruhiges Enddatum statt Countdown (SPIELKONZEPT 7.1): letzter Tag der Saison
    const ende = s.saison.nr ? String(addiereTage(s.saison.start, SAISON_TAGE - 1)).split('-').map(Number) : null;
    titel.textContent = s.saison.nr ? tx('karte.titel', { stufe: stufeName(s.saison.stufe) }) : tx('karte.vorStart');
    unter.textContent = s.saison.nr ? tx('karte.saison', { nr: s.saison.nr, datum: datum(new Date(ende[0], ende[1] - 1, ende[2]), { day: 'numeric', month: 'long' }) })
      : tx('karte.beginnt');
    const unten = STUFEN[s.saison.stufe].schwelle;
    balken.value = naechste ? Math.min(100, (s.saison.punkte - unten) / (naechste.schwelle - unten) * 100) : 100;
    // die oberste Stufe ("Meister") ist die letzte in STUFEN
    const oben = stufeName(STUFEN.length - 1);
    balken.setAttribute('aria-label', naechste ? tx('karte.fortschritt', { stufe: stufeName(s.saison.stufe + 1) }) : tx('karte.erreicht', { stufe: oben }));
    weg.textContent = naechste ? tx('karte.weg', { punkte: s.saison.punkte, schwelle: naechste.schwelle, stufe: stufeName(s.saison.stufe + 1) })
      : tx('karte.oben', { punkte: s.saison.punkte, stufe: oben });
    wertung.textContent = `${klasseName(s.klasse.erreicht)} · ${wertText(s.wertung)}`;
    club.textContent = tx('karte.club', { siege: kreuztabelle(s.meisterschaft, bots).siege, n: bots.length });
    wechsel.hidden = !s.wechsel;
    detailOrt.replaceChildren(details(s, bots));
    leiterOrt.replaceChildren(leiter(s));
    badge.innerHTML = ligaWappen(s.saison.stufe);
  };
  zeichne();
  const ab = hoere('liga:geaendert', zeichne);
  const timer = setInterval(() => { saisonPruefen(); zeichne(); }, 60000);
  return { el: karte, verlasse() { ab(); clearInterval(timer); } };
}

// Leiter aller Liga-Stufen von Meister bis Holz: Wappen, Schwelle, Zustand (erreicht, du bist hier, noch n Punkte)
function leiter(s) {
  const box = el('div', 'liga-leiter');
  box.append(el('p', 'liga-leiter-titel', tx('leiter.titel')));
  const liste = el('ol', 'liga-stufen');
  liste.setAttribute('aria-label', tx('leiter.titel'));
  for (let i = STUFEN.length - 1; i >= 0; i--) {
    const zustand = i < s.saison.stufe ? 'erreicht' : i === s.saison.stufe ? 'hier' : 'offen';
    const z = el('li', 'liga-stufe');
    z.dataset.zustand = zustand;
    z.style.setProperty('--liga-f', LIGA_FARBEN[i]);
    const stand = zustand === 'erreicht' ? tx('leiter.erreicht') : zustand === 'hier' ? tx('leiter.hier', { punkte: s.saison.punkte })
      : tx('leiter.noch', { n: STUFEN[i].schwelle - s.saison.punkte });
    z.innerHTML = `<span class="liga-stufe-wappen" aria-hidden="true">${ligaWappen(i)}</span>`
      + `<span class="liga-stufe-text"><b>${esc(stufeName(i))}</b><span>${esc(tx('leiter.ab', { n: STUFEN[i].schwelle }))}</span></span>`
      + `<span class="liga-stufe-stand zahl">${esc(stand)}</span>`;
    liste.append(z);
  }
  box.append(liste);
  return box;
}

export function botBilanz({ bot, fortschritt }) {
  if (!bot?.id) return null;
  const b = fortschritt?.bots?.[bot.id] || {};
  const siege = b.siege || 0, remis = b.remis || 0;
  return el('p', 'liga-bilanz', tx('bilanz.text', { name: bot.name, siege: tx('bilanz.siege', { n: siege }),
    remis: tx('bilanz.remis', { n: remis }), niederlagen: tx('bilanz.niederlagen', { n: b.niederlagen || 0 }) }));
}

// Liga im Ergebnis (Flo 30.10. abends: "Liga anzeigen", "farbiger und mehr durchdacht"): Karte mit Wappen der Stufe,
// Stand, Balken bis zur naechsten Stufe, Aenderung und warum (Ergebnis, Genauigkeit, geschuetzte Stufe)
const ERG = ['niederlage', 'remis', 'sieg'];
// Farbe je Stufe: Holz, Bronze, Silber, Gold, Platin, Diamant, Meister (wie die Wappen in js/sammlung-kunst.js)
const LIGA_FARBEN = ['#A8743F', '#C27A3E', '#A9B2BE', '#E0A22B', '#5FB3AA', '#5AA6F0', '#A855F7'];
export function abrechnungsZeile(k, st) {
  if (!st || k.wertet !== true) return null;
  const r = belegFuer(st, k.erg?.partie?.id);
  if (!r) return null;
  const zeile = el('div', 'liga-abrechnung zahl');
  zeile.dataset.zeile = 'liga';
  if (!(r[1] === st.saison.nr && r[1] > 0)) {
    zeile.textContent = tx(r[4] ? 'abr.blitz' : 'abr.arena', { diff: differenz(r[2]) });
    return zeile;
  }
  const stufe = st.saison.stufe;
  const naechste = STUFEN[stufe + 1];
  const unten = STUFEN[stufe].schwelle;
  const anteil = naechste ? Math.max(0, Math.min(1, (st.saison.punkte - unten) / (naechste.schwelle - unten))) : 1;
  const grund = [];
  if (r.length > 10 && ERG[r[10]]) grund.push(`${tx('abr.ergebnis.' + ERG[r[10]])} ${differenz(r[6])}`);
  const g = k.erg?.partie?.genauigkeit;
  if (r[7]) grund.push(`${Number.isFinite(g) ? tx('abr.genau', { g: Math.round(g) }) : tx('abr.genauOhne')} ${differenz(r[7])}`);
  if (r[3] > r[6] + r[7]) grund.push(tx('abr.geschuetzt'));
  zeile.classList.add('liga-erg');
  zeile.dataset.stufe = String(stufe);
  zeile.style.setProperty('--liga-f', LIGA_FARBEN[stufe] || LIGA_FARBEN[0]);
  zeile.dataset.richtung = r[3] > 0 ? 'plus' : r[3] < 0 ? 'minus' : 'null';
  zeile.setAttribute('role', 'group');
  zeile.setAttribute('aria-label', tx('abr.liga', { diff: differenz(r[3]), stufe: stufeName(stufe) }));
  zeile.innerHTML = `<span class="liga-erg-wappen" aria-hidden="true">${ligaWappen(stufe)}</span>
    <span class="liga-erg-mitte"><span class="liga-erg-titel">${esc(tx('abr.titel'))}</span>
      <b class="liga-erg-stand">${esc(tx('abr.stand', { stufe: stufeName(stufe), punkte: st.saison.punkte }))}</b>
      <span class="liga-erg-balken" aria-hidden="true"><i style="transform:scaleX(${anteil.toFixed(3)})"></i></span>
      <span class="liga-erg-weg">${esc(naechste ? tx('abr.weg', { n: naechste.schwelle - st.saison.punkte, stufe: stufeName(stufe + 1) }) : tx('abr.oben'))}</span>
      ${grund.length ? `<span class="liga-erg-grund">${esc(grund.join(' · '))}</span>` : ''}</span>
    <span class="liga-erg-diff">${esc(differenz(r[3]))}</span>`;
  return zeile;
}

function miniKurve(werte) {
  const box = el('div', 'liga-kurve');
  if (werte.length < 2) { box.append(el('p', 'liga-hilfe', tx('kurve.leer'))); return box; }
  const min = Math.min(...werte.map((w) => w[1])), max = Math.max(...werte.map((w) => w[1]));
  const punkte = werte.map((w, i) => `${8 + i / (werte.length - 1) * 304},${66 - (w[1] - min) / Math.max(1, max - min) * 54}`).join(' ');
  box.innerHTML = `<svg viewBox="0 0 320 80" role="img" aria-label="${esc(tx('kurve.label'))}"><title>${esc(tx('kurve.titel', { a: werte[0][1], b: werte[werte.length - 1][1] }))}</title><polyline points="${punkte}"/></svg>`;
  box.append(el('p', 'liga-hilfe zahl', tx('kurve.text', { a: werte[0][1], b: werte[werte.length - 1][1], n: werte.length })));
  return box;
}

export function verlaufKarte({ lese }) {
  if (!lese()) return null;
  const karte = el('section', 'liga-verlauf liga-karte');
  karte.setAttribute('aria-label', tx('verlauf.titel'));
  const zeichne = () => {
    const st = lese();
    if (!st) return;
    karte.replaceChildren(el('h3', null, tx('verlauf.titel')), el('p', 'liga-wertung zahl', `${klasseName(st.klasse.erreicht)} · ${wertText(st.wertung)}`), miniKurve(st.kurve));
    karte.append(el('h4', null, tx('verlauf.abzeichen')));
    if (!st.archiv.length) karte.append(el('p', 'liga-hilfe', tx('verlauf.leer')));
    else {
      const liste = el('ul', 'liga-archiv');
      for (const a of [...st.archiv].reverse()) {
        const zeile = el('li', 'liga-abzeichen');
        zeile.append(mitIcon('liga-wappen'), el('span', null, tx('verlauf.saison', { nr: a.nr, stufe: stufeName(a.stufe) })),
          el('small', 'zahl', tx('verlauf.punkte', { punkte: a.punkte, stand: a.stand })));
        liste.append(zeile);
      }
      karte.append(liste);
    }
    karte.append(el('p', 'liga-hilfe', tx('verlauf.fuss', { stand: st.stand })));
  };
  zeichne();
  return beobachte(karte, zeichne);
}
