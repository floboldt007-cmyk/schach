// Screen "heim" (Etappe A, Task 3; Konzept 2026-11-06, Startseite Variante A, Entwurf startseite-v4): die ruhige
// Startseite. Oben Name und Level, in der Mitte der Rang-Ring, darunter eine Zeile, dann drei Modus-Karten:
// Online spielen (gold, Hauptknopf), Bots besiegen, Raetsel. Die Zeile fuer kommende Shop-Hinweise steht schon im
// DOM, bleibt in dieser Etappe aber ausgeblendet. Premium-Krone im Kopf (js/ui/seite.js hauptKopf).
//
//   zeige(root, params, app) -> { verlasse() }
//   zeigeHeim(app) -> section   baut nur den Screen (ohne einzuhaengen), fuer zeige() und Tests
//   kronenLage(stand | null) -> { kronen, stufe, liga, rang, platz, n, ziel, anteil, ohneKonto }   rein
//   ligaLage() -> Liga-Punkte der Arena (Paket liga), bleibt fuer die Arena; der Ring zeigt sie nicht mehr
//
// Kronen (Etappe B, Task 7; Wochen-Gruppen 07.11.2026): Der Ring zeigt die Kronen dieser Woche mit dem Kronen-Symbol,
// die Zeile darunter Stufe und Platz ("Läufer II · Platz 3 von 30", Flo 07.11.). Der Bogen fuellt sich bis zu den
// Kronen auf Platz 5 (ziel, der letzte Aufstiegsplatz); auf Platz 1 bis 5 ist er voll. Ohne Gruppe in dieser Woche:
// "Läufer II · Spiel eine Partie für deine Gruppe". Erst den gemerkten Stand (Modul kronen, nur fuer dasselbe Konto)
// sofort zeichnen, dann den Server-Stand (js/kronen.js holeStand) nachladen und merken; offline bleibt der gemerkte.
// Ohne Konto: 0 und Bauer III, die Zeile ist der Link "Konto anlegen und Kronen sammeln" nach #einstellungen/konto
// (#konto ist keine Seite, nur der Test-Schalter in js/konto.js). Nie NaN: jeder kaputte Stand gilt als 0.
// Ziele: heim-online -> lobby (wenn freigeschaltet, js/labor.js laborFrei) sonst online (Link-Duell);
// heim-bots -> arena; heim-raetsel -> training (das vorhandene Raetsel-Training).
// DOM: section.screen.heim-screen > header.haupt-kopf, .heim-rumpf > .heim-ring[data-anteil] (svg mit .heim-spur und
// .heim-bogen, .heim-mitte > .heim-zahl + .heim-einheit > svg + .heim-stufe), p.heim-liga (ohne Konto mit a.heim-konto),
// .heim-modi > button.heim-modus[data-aktion] (die erste mit .haupt), .heim-shop[hidden]. Optik: css/heim.css, nur Tokens.
import { hauptKopf, verbindeKopf, kopfEintritt } from './seite.js';
import { icon } from './icons.js';
import { staffel, tempo } from '../bewegung.js';
import { ladeModul, speichereModul } from '../storage.js';
import { laborFrei } from '../labor.js';
import { BOTS } from '../bots.js';
import { meinName, sitzung } from '../konto.js';
import { holeStand, angemeldet } from '../kronen.js';
import { normalisiereStand, ligaStufe, STUFEN } from '../pakete/liga/wertung.js';
import { stufeInfo, kronenSpeicher, AUFSTIEG_PLAETZE, GRUPPE_GROESSE } from '../pakete/liga/kronen.js';
import { t, zahl, registriereTexte } from '../sprache.js';
import { stufenName } from '../pakete/liga/texte.js';
import '../sprachen/allgemein.js';
import '../sprachen/rahmen.js';

registriereTexte('heim', {
  de: {
    aria: 'Start',
    level: 'Level {level}',
    woche: 'diese Woche',
    platz: '{stufe} · Platz {platz} von {n}',
    ohneGruppe: '{stufe} · Spiel eine Partie für deine Gruppe',
    ohneKonto: 'Konto anlegen und Kronen sammeln',
    ringLabel: '{kronen} Kronen diese Woche, {zeile}',
    'online.titel': 'Online spielen',
    'online.text': 'Gegner in deiner Stärke, zählt für die Liga',
    'bots.titel': 'Bots besiegen',
    'bots.text': '{n} Gegner, jeder spielt anders',
    'raetsel.titel': 'Rätsel',
    'raetsel.text': 'Täglich neue Aufgaben, in Ruhe gelöst',
  },
  en: {
    aria: 'Home',
    level: 'Level {level}',
    woche: 'this week',
    platz: '{stufe} · Place {platz} of {n}',
    ohneGruppe: '{stufe} · Play a game to join your group',
    ohneKonto: 'Create an account and collect crowns',
    ringLabel: '{kronen} crowns this week, {zeile}',
    'online.titel': 'Play online',
    'online.text': 'Opponents at your level, counts for the league',
    'bots.titel': 'Beat the bots',
    'bots.text': '{n} opponents, each plays differently',
    'raetsel.titel': 'Puzzles',
    'raetsel.text': 'New puzzles every day, solved at your pace',
  },
});

const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const R = 84;
const UMFANG = 2 * Math.PI * R;
const KARTEN = [['online', 'krone', true], ['bots', 'pokal', false], ['raetsel', 'ziel', false]];

// Punkte und Stufe der laufenden Saison; jeder Fehler ergibt Holz und 0
export function ligaLage() {
  let punkte = 0, stufe = 0;
  try {
    const st = normalisiereStand(ladeModul('liga'), new Date());
    if (st && st.saison) {
      punkte = Number.isFinite(st.saison.punkte) && st.saison.punkte > 0 ? Math.floor(st.saison.punkte) : 0;
      stufe = Number.isInteger(st.saison.stufe) ? Math.min(STUFEN.length - 1, Math.max(0, st.saison.stufe)) : 0;
    }
  } catch (e) { console.error(e); }
  stufe = Math.max(stufe, ligaStufe(punkte));
  const naechste = STUFEN[stufe + 1] || null;
  const von = STUFEN[stufe].schwelle;
  const anteil = naechste ? Math.min(1, Math.max(0, (punkte - von) / (naechste.schwelle - von))) : 1;
  return { punkte, stufe, naechste: naechste ? stufe + 1 : null, fehlt: naechste ? Math.max(0, naechste.schwelle - punkte) : 0, anteil };
}

// Kronen-Stand vom Server (oder gemerkt) als Ring-Lage; null heisst ohne Konto. Jeder kaputte Wert gilt als 0 bzw.
// als "ohne Gruppe" (platz null).
const ganz = (v, min, max) => { const x = Number(v); return Number.isFinite(x) ? Math.min(max, Math.max(min, Math.floor(x))) : null; };
export function kronenLage(stand) {
  const o = stand && typeof stand === 'object' && !Array.isArray(stand) ? stand : {};
  const kronen = ganz(o.kronen, 0, Number.MAX_SAFE_INTEGER) ?? 0;
  const s = stufeInfo(ganz(o.stufe, 0, 17) ?? 0);
  const n = ganz(o.n, 1, 1000) ?? GRUPPE_GROESSE;
  const platz = o.platz == null ? null : ganz(o.platz, 1, n);
  const ziel = o.ziel == null ? null : ganz(o.ziel, 0, Number.MAX_SAFE_INTEGER);
  let anteil = 0;
  if (platz != null && platz <= AUFSTIEG_PLAETZE) anteil = 1;
  else if (platz != null && ziel > 0) anteil = Math.min(1, kronen / ziel);
  return { kronen, stufe: s.index, liga: s.liga, rang: s.rang, platz, n, ziel, anteil, ohneKonto: stand == null };
}

// Erste Lage ohne Netz: ohne Konto null, sonst der gemerkte Stand dieses Kontos (oder 0)
function ersteLage() {
  if (!angemeldet()) return kronenLage(null);
  const m = kronenSpeicher(ladeModul('kronen'));
  const uid = sitzung()?.user?.id;
  return kronenLage(m.stand && uid && m.konto === uid ? m.stand : { kronen: 0 });
}

function merke(stand) {
  const uid = sitzung()?.user?.id;
  if (!uid) return;
  const alt = kronenSpeicher(ladeModul('kronen'));
  const st = { kronen: stand.kronen, stufe: stand.stufe, platz: stand.platz ?? null, ziel: stand.ziel ?? null, n: stand.n };
  speichereModul('kronen', { konto: uid, stand: st, startGemeldet: alt.konto === uid ? alt.startGemeldet : false });
}

// Ring, Mitte und Zeile aus einer Lage; dieselben Teile baut zeigeHeim zuerst und zeichne() spaeter neu
function ringTeile(lg) {
  const name = stufenName(lg.stufe);
  let text;
  if (lg.ohneKonto) text = t('heim.ohneKonto');
  else if (lg.platz != null) text = t('heim.platz', { stufe: name, platz: zahl(lg.platz), n: zahl(lg.n) });
  else text = t('heim.ohneGruppe', { stufe: name });
  const zeile = lg.ohneKonto ? `<a class="heim-konto" href="#einstellungen/konto">${esc(text)}</a>` : esc(text);
  return { stufe: t('heim.woche'), zeile, label: t('heim.ringLabel', { kronen: zahl(lg.kronen), zeile: text }),
    versatz: (UMFANG * (1 - lg.anteil)).toFixed(2) };
}

function zeichne(s, lg) {
  const r = ringTeile(lg);
  const ring = s.querySelector('.heim-ring');
  ring.dataset.anteil = String(lg.anteil);
  ring.setAttribute('aria-label', r.label);
  s.querySelector('.heim-bogen').setAttribute('stroke-dashoffset', r.versatz);
  s.querySelector('.heim-zahl').textContent = zahl(lg.kronen);
  s.querySelector('.heim-stufe').textContent = r.stufe;
  s.querySelector('.heim-liga').innerHTML = r.zeile;
}

function aktuellesLevel() {
  try {
    const st = ladeModul('funken', {});
    return Number.isInteger(st && st.level) ? Math.max(1, st.level) : 1;
  } catch (e) { return 1; }
}

export function zeigeHeim(app) {
  const lg = ersteLage();
  const r = ringTeile(lg);
  const s = document.createElement('section');
  s.className = 'screen heim-screen';
  s.setAttribute('aria-label', t('heim.aria'));
  // Name und Level stehen im Rumpf: der Hauptseiten-Kopf blendet seinen Titel auf dem Handy aus (css/navigation.css)
  s.innerHTML = `${hauptKopf({ titelElement: 'div', premium: true, klang: false })}
    <div class="heim-rumpf">
      <div class="heim-wer"><h1 class="heim-name">${esc(meinName())}</h1><span class="heim-level">${esc(t('heim.level', { level: zahl(aktuellesLevel()) }))}</span></div>
      <div class="heim-ring" role="img" data-anteil="${lg.anteil}" aria-label="${esc(r.label)}">
        <svg viewBox="0 0 188 188" aria-hidden="true" focusable="false">
          <circle class="heim-spur" cx="94" cy="94" r="${R}"/>
          <circle class="heim-bogen" cx="94" cy="94" r="${R}" stroke-dasharray="${UMFANG.toFixed(2)}"
            stroke-dashoffset="${r.versatz}" transform="rotate(-90 94 94)"/>
        </svg>
        <div class="heim-mitte" aria-hidden="true"><span class="heim-zahl">${esc(zahl(lg.kronen))}</span><span class="heim-einheit">${icon('krone')}<span class="heim-stufe">${esc(r.stufe)}</span></span></div>
      </div>
      <p class="heim-liga">${r.zeile}</p>
      <div class="heim-modi">
        ${KARTEN.map(([id, ic, haupt]) => `<button class="heim-modus dr${haupt ? ' haupt' : ''}" type="button" data-aktion="heim-${id}">
          <span class="heim-symbol" aria-hidden="true">${icon(ic)}</span>
          <span class="heim-text"><b>${esc(t('heim.' + id + '.titel'))}</b><span>${esc(t('heim.' + id + '.text', { n: zahl(BOTS.length) }))}</span></span>
        </button>`).join('')}
      </div>
      <div class="heim-shop" hidden></div>
    </div>`;
  s.querySelector('.heim-modi').addEventListener('click', (e) => {
    const k = e.target.closest('[data-aktion]');
    if (!k) return;
    const a = k.dataset.aktion;
    if (a === 'heim-online') app.gehe(laborFrei() ? 'lobby' : 'online');
    else if (a === 'heim-bots') app.gehe('arena');
    else if (a === 'heim-raetsel') app.gehe('training');
  });
  return s;
}

export function zeige(root, params, app) {
  const s = zeigeHeim(app);
  root.append(s);
  const kopf = verbindeKopf(s, app, {
    beiZurueck: () => app.zurueck(),
    beiEinstellungen: () => app.gehe('einstellungen'),
  });
  if (tempo() > 0) {
    kopfEintritt(s);
    staffel(s.querySelectorAll('.heim-ring, .heim-liga, .heim-modus'), { d: 560, v: 60, abstand: 60, von: 'translateY(16px)' });
  }
  // Server-Stand nachladen; offline oder bei einer unbrauchbaren Antwort bleibt der gemerkte Stand stehen
  let weg = false;
  if (angemeldet()) {
    holeStand().then((d) => {
      const stand = Array.isArray(d) ? d[0] : d;
      if (!stand || typeof stand !== 'object' || !Number.isFinite(Number(stand.kronen))) return;
      merke(stand);
      if (!weg && s.isConnected) zeichne(s, kronenLage(stand));
    }, () => {});
  }
  return {
    verlasse() {
      weg = true;
      try { kopf.verlasse(); } catch (e) { /* egal */ }
    },
  };
}
