// Alle Elemente gehoeren dem Paket. Der Host raeumt sie ueber verlasse() wieder ab.
import { hoere } from '../../ereignisse.js';
import { icon } from '../../ui/icons.js';
import { tagSchluessel, addiereTage, tageZwischen } from '../../tag.js';
import { KLASSEN, STUFEN, SAISON_TAGE, unsicherheit, vorlaeufig, saisonAm, kreuztabelle, belegFuer } from './wertung.js';

const el = (tag, klasse, text) => {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text != null) e.textContent = text;
  return e;
};
const mitIcon = (name, klasse) => { const e = el('span', klasse); e.innerHTML = icon(name); return e; };
const differenz = (n) => n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '±0';
const wertText = (w) => `≈ ${w.wert} ± ${unsicherheit(w.n)}${vorlaeufig(w.n) ? ' · vorläufig' : ''}`;

function beobachte(e, zeichne) {
  const ab = hoere('liga:geaendert', zeichne);
  return { el: e, verlasse: ab };
}

function tabelle(st, bots) {
  const k = kreuztabelle(st.meisterschaft, bots);
  const t = el('table', 'liga-tabelle');
  t.append(el('caption', null, 'Du gegen die Bots'));
  const kopf = el('thead'), h = el('tr');
  for (const text of ['Bot', 'Bestes Ergebnis', 'Punkte']) { const th = el('th', null, text); th.scope = 'col'; h.append(th); }
  kopf.append(h); t.append(kopf);
  const tbody = el('tbody');
  for (const z of k.zeilen) {
    const r = el('tr'), th = el('th', null, z.name);
    th.scope = 'row';
    r.append(th, el('td', null, z.punkte === 3 ? 'Sieg' : z.punkte === 1 ? 'Remis' : z.gespielt ? 'Gespielt' : 'Offen'), el('td', 'zahl', z.punkte));
    tbody.append(r);
  }
  t.append(tbody);
  return t;
}

function details(st, bots) {
  const innen = el('div', 'liga-details');
  innen.append(el('p', 'liga-hilfe', 'Jede Saison zählt dein bestes Ergebnis gegen jeden Bot: Sieg 3 Punkte, Remis 1 Punkt. Du wählst, wann du spielst.'));
  innen.append(tabelle(st, bots));
  const gesamt = kreuztabelle(st.meisterschaft, bots);
  innen.append(el('p', 'liga-hilfe zahl', `Vereinsmeisterschaft: ${gesamt.punkte} von ${bots.length * 3} Punkten`));
  innen.append(el('h4', null, 'Deine Wertungen'));
  innen.append(el('p', 'liga-hilfe', `Normal: ${wertText(st.wertung)} · ${st.wertung.n} Partien`));
  innen.append(el('p', 'liga-hilfe', `Blitz: ${wertText(st.wertung.blitz)} · ${st.wertung.blitz.n} Partien`));
  innen.append(el('p', 'liga-hilfe', 'Die Arena-Wertung hat einen Verlustschutz. Negative Elo-Schritte werden als 0 gebucht. Diese vorläufige Bot-Skala ist keine Online-Wertung und noch nicht geeicht.'));
  innen.append(el('p', 'liga-hilfe', 'Blitz zählt bei weniger als 10 Minuten Grundzeit getrennt. Ohne Uhr zählt die normale Wertung. Hinweise halbieren den K-Faktor: 40 für die ersten 15 Partien, danach 24.'));
  innen.append(el('p', 'liga-hilfe', 'Die Spielklasse gehört zur normalen Wertung. Ab 10 Partien kannst du aufsteigen; deine höchste Klasse bleibt.'));
  innen.append(el('p', 'liga-hilfe', 'Klassen ab Wertung 1000 / 1200 / 1400 / 1600 / 1900: Springer / Läufer / Turm / Dame / König. Diese Grenzen sind vorläufig.'));
  innen.append(el('h4', null, 'So zählen Liga-Punkte'));
  innen.append(el('p', 'liga-hilfe', 'Sieg: 10 Punkte plus 1 je angefangenen 100 Punkten stärkerem Bot, höchstens 25. Remis: +4. Niederlage: −3. Ab 80 % Genauigkeit: +2; ein Sieg bleibt bei höchstens 25. Die Schwelle deiner erreichten Stufe bleibt erhalten.'));
  innen.append(el('p', 'liga-hilfe', STUFEN.map((s) => `${s.name} ${s.schwelle}`).join(' · ')));
  innen.append(el('p', 'liga-hilfe', 'Eine Saison dauert 12 Wochen. Danach wird dein Abzeichen im Archiv bewahrt. Die nächste Saison beginnt eine Stufe darunter; Holz bleibt Holz. Bei längeren Pausen geschieht das einmal.'));
  innen.append(el('p', 'liga-hilfe', 'Es zählen neue wertende Partien aus der Grundstellung gegen die Leiter-Bots. Übungen, eigene Stellungen, freie Partien und Bosse zählen nicht.'));
  return innen;
}

export function saisonKarte({ lese, bots, saisonPruefen, verstanden }) {
  const st = lese();
  if (!st) return null;
  const karte = el('section', 'liga-karte');
  karte.setAttribute('aria-label', 'Saison-Liga');
  const auf = el('details', 'liga-aufklappen'), summary = el('summary', 'liga-summary');
  const badge = mitIcon('liga-wappen', 'liga-wappen');
  const kopf = el('span', 'liga-kurz'), titel = el('strong', 'liga-titel'), unter = el('span', 'liga-unter');
  kopf.append(titel, unter);
  summary.append(badge, kopf, mitIcon('vor', 'liga-mehr'));
  auf.append(summary);
  const balken = el('progress', 'liga-balken');
  balken.max = 100;
  const weg = el('p', 'liga-hilfe liga-weg zahl'), wertung = el('p', 'liga-wertung zahl'), club = el('p', 'liga-hilfe liga-club');
  const wechsel = el('div', 'liga-wechsel');
  const hinweis = el('p', 'liga-hilfe', 'Neue Saison, neue Chance. Dein Level und deine Spielklasse bleiben.');
  const quitt = el('button', 'liga-knopf', 'Verstanden');
  quitt.type = 'button'; quitt.addEventListener('click', verstanden);
  wechsel.append(hinweis, quitt);
  const detailOrt = el('div');
  auf.append(detailOrt);
  // Zusammenfassung und Balken bleiben sichtbar; die Kreuztabelle oeffnet sich erst auf Antippen.
  karte.append(auf, balken, weg, wertung, club, wechsel);
  const zeichne = () => {
    const s = lese();
    if (!s) { karte.hidden = true; return; }
    const naechste = STUFEN[s.saison.stufe + 1];
    const tage = s.saison.nr ? Math.max(0, tageZwischen(tagSchluessel(), addiereTage(s.saison.start, SAISON_TAGE))) : saisonAm(new Date()).tage;
    titel.textContent = s.saison.nr ? `${STUFEN[s.saison.stufe].name} · Saison ${s.saison.nr}` : 'Saison 1 · ab 19.10.2026';
    unter.textContent = s.saison.nr ? `noch ${tage} ${tage === 1 ? 'Tag' : 'Tage'} · Details` : 'Die Saison beginnt am Startmontag · Details';
    const unten = STUFEN[s.saison.stufe].schwelle;
    balken.value = naechste ? Math.min(100, (s.saison.punkte - unten) / (naechste.schwelle - unten) * 100) : 100;
    balken.setAttribute('aria-label', naechste ? `Fortschritt zu ${naechste.name}` : 'Meister erreicht');
    weg.textContent = naechste ? `${s.saison.punkte} / ${naechste.schwelle} Liga-Punkte · ${naechste.name}` : `${s.saison.punkte} Liga-Punkte · Meister`;
    wertung.textContent = `${KLASSEN[s.klasse.erreicht]} · ${wertText(s.wertung)}`;
    club.textContent = `${kreuztabelle(s.meisterschaft, bots).siege} von ${bots.length} Bots geschlagen`;
    wechsel.hidden = !s.wechsel;
    detailOrt.replaceChildren(details(s, bots));
  };
  zeichne();
  const ab = hoere('liga:geaendert', zeichne);
  const timer = setInterval(() => { saisonPruefen(); zeichne(); }, 60000);
  return { el: karte, verlasse() { ab(); clearInterval(timer); } };
}

export function botBilanz({ bot, fortschritt }) {
  if (!bot?.id) return null;
  const b = fortschritt?.bots?.[bot.id] || {};
  const siege = b.siege || 0, remis = b.remis || 0;
  return el('p', 'liga-bilanz', `Du gegen ${bot.name}: ${siege} ${siege === 1 ? 'Sieg' : 'Siege'} · ${remis} Remis · ${b.niederlagen || 0} Niederlagen`);
}

export function abrechnungsZeile(k, st) {
  if (!st || k.wertet !== true) return null;
  const r = belegFuer(st, k.erg?.partie?.id);
  if (!r) return null;
  const zeile = el('div', 'liga-abrechnung zahl');
  zeile.dataset.zeile = 'liga';
  if (r[1] === st.saison.nr && r[1] > 0) {
    zeile.textContent = `Liga ${differenz(r[3])} · ${STUFEN[st.saison.stufe].name}`;
  } else zeile.textContent = `${r[4] ? 'Blitz-Wertung' : 'Arena-Wertung'} ${differenz(r[2])}`;
  return zeile;
}

function miniKurve(werte) {
  const box = el('div', 'liga-kurve');
  if (werte.length < 2) { box.append(el('p', 'liga-hilfe', 'Deine Wertungskurve wächst mit den nächsten normalen Partien.')); return box; }
  const min = Math.min(...werte.map((w) => w[1])), max = Math.max(...werte.map((w) => w[1]));
  const punkte = werte.map((w, i) => `${8 + i / (werte.length - 1) * 304},${66 - (w[1] - min) / Math.max(1, max - min) * 54}`).join(' ');
  box.innerHTML = `<svg viewBox="0 0 320 80" role="img" aria-label="Verlauf der normalen Arena-Wertung"><title>Arena-Wertung: ${werte[0][1]} bis ${werte[werte.length - 1][1]}</title><polyline points="${punkte}"/></svg>`;
  box.append(el('p', 'liga-hilfe zahl', `${werte[0][1]} → ${werte[werte.length - 1][1]} · letzte ${werte.length} normale Partien`));
  return box;
}

export function verlaufKarte({ lese }) {
  if (!lese()) return null;
  const karte = el('section', 'liga-verlauf liga-karte');
  karte.setAttribute('aria-label', 'Wertung und Saison-Archiv');
  const zeichne = () => {
    const st = lese();
    if (!st) return;
    karte.replaceChildren(el('h3', null, 'Wertung und Saison-Archiv'), el('p', 'liga-wertung zahl', `${KLASSEN[st.klasse.erreicht]} · ${wertText(st.wertung)}`), miniKurve(st.kurve));
    karte.append(el('h4', null, 'Deine Saison-Abzeichen'));
    if (!st.archiv.length) karte.append(el('p', 'liga-hilfe', 'Dein erstes Saison-Abzeichen erscheint hier nach der Saison.'));
    else {
      const liste = el('ul', 'liga-archiv');
      for (const a of [...st.archiv].reverse()) {
        const zeile = el('li', 'liga-abzeichen');
        zeile.append(mitIcon('liga-wappen'), el('span', null, `Saison ${a.nr}: ${STUFEN[a.stufe].name}`), el('small', 'zahl', `${a.punkte} Punkte · Rechenstand ${a.stand}`));
        liste.append(zeile);
      }
      karte.append(liste);
    }
    karte.append(el('p', 'liga-hilfe', `Arena-Wertung mit Verlustschutz · Rechenstand ${st.stand}. Die Bot-Skala ist vorläufig.`));
  };
  zeichne();
  return beobachte(karte, zeichne);
}
