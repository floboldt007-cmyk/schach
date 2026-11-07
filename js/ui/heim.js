// Screen "heim" (Konzept 2026-11-06, Abschnitt 12, Entwuerfe start-ipad-v2 und start-ipad-quer, Flo 07.11.2026 "ja go"):
// die ruhige Startseite. Oben der Kopf mit der Tage-Serie (dezent), darunter Gruss nach Tageszeit und eine dunkle
// Buehne: die laufende Partie als Mini-Brett mit einem Satz zur Lage, Bewertungsbalken und "Weiterspielen", ohne
// Partie der naechste Gegner der Bot-Leiter mit "Spielen". Dann "Als Naechstes" (hoechstens zwei Zeilen nach Rang,
// ohne Daten entfaellt der Abschnitt) und drei schlichte Wege: Online, Lernen, Zu zweit.
// Was es noch nicht gibt (Taler, offene Herausforderungen, Belohnung kurz vor dem Ziel), wird nicht erfunden.
//
//   zeige(root, params, app) -> { verlasse() }
//   zeigeHeim(app, { jetzt }) -> section   baut nur den Screen (ohne einzuhaengen), fuer zeige() und Tests
//   ligaLage() -> { vorhanden, punkte, stufe, naechste, fehlt, anteil }   Liga-Stand der laufenden Saison (nur lesend)
//   (intern) lageSatz(cp, mate, sicht) -> { art, anteil, wert }   Bewertung (Sicht Weiss) als Lage-Art, Balken und Zahl
//
// Ziele: Weiterspielen -> partie (fortsetzen, wie app.js pruefeZiel; Zu zweit wie pakete/zuzweit), Spielen -> partie
// gegen naechsterGegner(); heim-online -> lobby (laborFrei) sonst online; heim-raetsel (Lernen) -> training (dort steht
// die Meisterschule oben, #150); heim-zuzweit -> partie Zu zweit; Liga-Zeile -> bestenliste.
// DOM: section.screen.heim-screen > header.haupt-kopf, .heim-rumpf > .heim-links (.heim-gruss, .heim-buehne[data-art]),
// .heim-rechts (.heim-naechstes?, .heim-wege > button.heim-modus[data-aktion]). Optik: css/heim.css, nur Tokens.
import { hauptKopf, verbindeKopf, kopfEintritt } from './seite.js';
import { icon } from './icons.js';
import { Brett } from '../board.js';
import { figurenPfad } from '../figurensatz.js';
import { anim, tempo } from '../bewegung.js';
import { ladeModul, ladeLaufendePartie, naechsterGegner, ladeEinstellungen } from '../storage.js';
import { laborFrei } from '../labor.js';
import { botNachId } from '../bots.js';
import { eigenerName } from '../konto.js';
import { normalisiereStand, ligaStufe, STUFEN } from '../pakete/liga/wertung.js';
import * as serieStand from '../pakete/serie/stand.js';
import { lage as serieLage } from '../pakete/serie/tag.js';
import { tagSchluessel } from '../tag.js';
import { Chess } from '../../vendor/chess/chess.js';
import { t, zahl, registriereTexte } from '../sprache.js';
import '../pakete/liga/texte.js';
import '../sprachen/allgemein.js';
import '../sprachen/rahmen.js';

registriereTexte('heim', {
  de: {
    aria: 'Start',
    'gruss.morgen': 'Guten Morgen',
    'gruss.tag': 'Guten Tag',
    'gruss.abend': 'Guten Abend',
    'gruss.name': '{gruss}, {name}',
    'titel.partie': 'Deine Partie wartet.',
    'titel.leer': 'Bereit für die nächste Partie?',
    serie: '{n} Tage',
    serieTitel: '{n} Tage in Folge gespielt',
    gegen: 'gegen {name} · Bot {elo}',
    zuzweit: '{weiss} gegen {schwarz} · Zu zweit',
    weiss: 'Weiß',
    schwarz: 'Schwarz',
    'lage.gleich': 'Ausgeglichen',
    'lage.besser': 'Du stehst besser',
    'lage.klarBesser': 'Du stehst klar besser',
    'lage.schlechter': 'Du stehst schlechter',
    'lage.klarSchlechter': 'Es wird eng',
    'lage.wBesser': 'Weiß steht besser',
    'lage.sBesser': 'Schwarz steht besser',
    'zug.du': 'du bist am Zug',
    'zug.bot': '{name} ist am Zug',
    'zug.w': 'Weiß am Zug',
    'zug.s': 'Schwarz am Zug',
    'zug.duGross': 'Du bist am Zug',
    'zug.botGross': '{name} ist am Zug',
    'zug.wGross': 'Weiß am Zug',
    'zug.sGross': 'Schwarz am Zug',
    balken: 'Bewertung {wert}',
    weiter: 'Weiterspielen',
    naechsterGegner: 'Nächster Gegner auf deiner Leiter',
    spielen: 'Spielen',
    naechstes: 'Als Nächstes',
    'liga.noch': 'Noch {n} Liga-Punkte bis {naechste}',
    'liga.oben': 'Höchste Stufe erreicht',
    'online.titel': 'Online',
    'online.text': 'Schnellpartie',
    'raetsel.titel': 'Lernen',
    'raetsel.text': 'Rätsel und Meisterschule',
    'zuzweit.titel': 'Zu zweit',
    'zuzweit.text': 'An einem Gerät',
  },
  en: {
    aria: 'Home',
    'gruss.morgen': 'Good morning',
    'gruss.tag': 'Hello',
    'gruss.abend': 'Good evening',
    'gruss.name': '{gruss}, {name}',
    'titel.partie': 'Your game is waiting.',
    'titel.leer': 'Ready for the next game?',
    serie: '{n} days',
    serieTitel: '{n} days in a row',
    gegen: 'vs {name} · Bot {elo}',
    zuzweit: '{weiss} vs {schwarz} · Two players',
    weiss: 'White',
    schwarz: 'Black',
    'lage.gleich': 'Level position',
    'lage.besser': 'You are better',
    'lage.klarBesser': 'You are clearly better',
    'lage.schlechter': 'You are worse',
    'lage.klarSchlechter': 'It is getting tight',
    'lage.wBesser': 'White is better',
    'lage.sBesser': 'Black is better',
    'zug.du': 'your move',
    'zug.bot': '{name} to move',
    'zug.w': 'White to move',
    'zug.s': 'Black to move',
    'zug.duGross': 'Your move',
    'zug.botGross': '{name} to move',
    'zug.wGross': 'White to move',
    'zug.sGross': 'Black to move',
    balken: 'Evaluation {wert}',
    weiter: 'Continue',
    naechsterGegner: 'Next opponent on your ladder',
    spielen: 'Play',
    naechstes: 'Up next',
    'liga.noch': '{n} league points to {naechste}',
    'liga.oben': 'Top tier reached',
    'online.titel': 'Online',
    'online.text': 'Quick game',
    'raetsel.titel': 'Learn',
    'raetsel.text': 'Puzzles and master school',
    'zuzweit.titel': 'Two players',
    'zuzweit.text': 'On one device',
  },
});

const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WEGE = [['online', 'blitz'], ['raetsel', 'ziel'], ['zuzweit', 'person']];
const BEWERTUNG_TIEFE = 10;

// Punkte und Stufe der laufenden Saison; jeder Fehler ergibt Holz und 0. vorhanden: es gibt einen Liga-Stand
export function ligaLage() {
  let punkte = 0, stufe = 0, vorhanden = false;
  try {
    const roh = ladeModul('liga');
    const st = roh ? normalisiereStand(roh, new Date()) : null;
    if (st && st.saison) {
      vorhanden = true;
      punkte = Number.isFinite(st.saison.punkte) && st.saison.punkte > 0 ? Math.floor(st.saison.punkte) : 0;
      stufe = Number.isInteger(st.saison.stufe) ? Math.min(STUFEN.length - 1, Math.max(0, st.saison.stufe)) : 0;
    }
  } catch (e) { console.error(e); }
  stufe = Math.max(stufe, ligaStufe(punkte));
  const naechste = STUFEN[stufe + 1] || null;
  const von = STUFEN[stufe].schwelle;
  const anteil = naechste ? Math.min(1, Math.max(0, (punkte - von) / (naechste.schwelle - von))) : 1;
  return { vorhanden, punkte, stufe, naechste: naechste ? stufe + 1 : null, fehlt: naechste ? Math.max(0, naechste.schwelle - punkte) : 0, anteil };
}

// Tage in Folge (Paket serie), nur wenn die Serie laeuft und angezeigt werden soll; sonst 0
function serieTage(jetzt) {
  try {
    const einst = serieStand.einstellungen();
    if (einst && einst.anzeigen === false) return 0;
    const l = serieLage(serieStand.lade(), tagSchluessel(jetzt), einst);
    return l && l.art === 'laeuft' && l.aktuell > 0 ? l.aktuell : 0;
  } catch (e) { return 0; }
}

function gruss(jetzt) {
  const h = jetzt.getHours();
  const g = t(h >= 5 && h < 11 ? 'heim.gruss.morgen' : h >= 11 && h < 18 ? 'heim.gruss.tag' : 'heim.gruss.abend');
  let name = '';
  try { name = eigenerName() || ''; } catch (e) { name = ''; }
  return name ? t('heim.gruss.name', { gruss: g, name }) : g;
}

// Bewertung (cp/mate aus Sicht von Weiss) aus Sicht sicht ('w' | 'b'): art fuer den Satz, anteil 0..1 fuer den Balken
function lageSatz(cp, mate, sicht = 'w') {
  const vz = sicht === 'b' ? -1 : 1;
  if (Number.isFinite(mate) && mate !== 0) {
    const gut = mate * vz > 0;
    return { art: gut ? 'klarBesser' : 'klarSchlechter', anteil: gut ? 1 : 0, wert: (gut ? '+' : '-') + 'M' + Math.abs(mate) };
  }
  const d = (Number.isFinite(cp) ? cp : 0) * vz;
  const art = Math.abs(d) < 50 ? 'gleich' : d >= 300 ? 'klarBesser' : d > 0 ? 'besser' : d <= -300 ? 'klarSchlechter' : 'schlechter';
  const anteil = 1 / (1 + Math.exp(-d / 250));
  const wert = (d >= 0 ? '+' : '-') + zahl(Math.abs(d) / 100, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return { art, anteil, wert };
}

// Stellung der laufenden Partie: { fen, amZug, zuletzt: [von, nach], schach } oder null (kaputte Daten)
function stellung(laufend) {
  try {
    const c = laufend.startFen ? new Chess(laufend.startFen) : new Chess();
    let letzter = null;
    for (const u of laufend.zuege) {
      const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });
      if (!m) return null;
      letzter = [m.from, m.to];
    }
    return { fen: c.fen(), amZug: c.turn(), zuletzt: letzter || [], schach: c.inCheck() };
  } catch (e) { return null; }
}

const sichtVon = (laufend) => (laufend.modus !== 'zuzweit' && laufend.spielerFarbe === 'b' ? 'b' : 'w');

// "Du bist am Zug" (gross = Satzanfang); in Zu zweit "Weiss am Zug"
function zugText(laufend, st, bot, gross) {
  const g = gross ? 'Gross' : '';
  if (laufend.modus === 'zuzweit') return t('heim.zug.' + (st.amZug === 'w' ? 'w' : 's') + g);
  if (st.amZug === sichtVon(laufend)) return t('heim.zug.du' + g);
  return t('heim.zug.bot' + g, { name: bot ? bot.name : '' });
}

function buehnePartie(laufend, st) {
  const zuzweit = laufend.modus === 'zuzweit';
  const bot = zuzweit ? null : botNachId(laufend.botId);
  const namen = laufend.zuzweit || {};
  const ueber = zuzweit
    ? t('heim.zuzweit', { weiss: namen.weiss || t('heim.weiss'), schwarz: namen.schwarz || t('heim.schwarz') })
    : t('heim.gegen', { name: bot ? bot.name : '', elo: bot ? zahl(bot.elo) : '' });
  // das Brett selbst baut zeigeHeim (echtes Brett der App, nur zum Ansehen)
  return `<div class="heim-brett"><div class="heim-mini"></div></div>
    <div class="heim-buehne-text">
      <small class="heim-ueber">${esc(ueber)}</small>
      <h2 class="heim-lage" aria-live="polite">${esc(zugText(laufend, st, bot, true))}</h2>
      <div class="heim-balken" hidden><span class="heim-balken-spur"><span class="heim-balken-wert"></span></span><span class="heim-balken-zahl zahl"></span></div>
      <button class="heim-los dr" type="button" data-aktion="heim-weiter">${icon('play')}<span>${esc(t('heim.weiter'))}</span></button>
    </div>`;
}

function buehneGegner(bot) {
  return `<div class="heim-portraet" style="--bot-farbe: var(--bot-${esc(bot.id)}, var(--gold))"><img src="${esc(bot.avatar)}" alt="" draggable="false"></div>
    <div class="heim-buehne-text">
      <small class="heim-ueber">${esc(t('heim.naechsterGegner'))}</small>
      <h2 class="heim-gegner">${esc(bot.name)} <span class="zahl">· ${esc(zahl(bot.elo))}</span></h2>
      ${bot.kurz ? `<p class="heim-spielweise">${esc(bot.kurz)}</p>` : ''}
      <button class="heim-los dr" type="button" data-aktion="heim-spielen" data-bot="${esc(bot.id)}">${icon('play')}<span>${esc(t('heim.spielen'))}</span></button>
    </div>`;
}

// "Als Naechstes": Kandidaten mit Rang (1 offene Herausforderung, 2 Belohnung kurz vor dem Ziel, 3 Liga-Platz), hoechstens
// zwei. Heute gibt es Daten nur fuer den Liga-Platz; die anderen Raenge kommen mit ihren Quellen (Online-Server, Belohnungen).
function naechsteZeilen() {
  const zeilen = [];
  const lg = ligaLage();
  if (lg.vorhanden) {
    const text = lg.naechste == null ? t('heim.liga.oben')
      : t('heim.liga.noch', { n: zahl(lg.fehlt), naechste: t('p-liga.stufe.' + lg.naechste) });
    zeilen.push({ rang: 3, html: `<button class="heim-zeile dr" type="button" data-aktion="heim-liga">
        <span class="heim-zeile-bild" aria-hidden="true">${icon('liga')}</span>
        <span class="heim-zeile-text"><b>${esc(t('p-liga.stufe.' + lg.stufe))}</b><span>${esc(text)}</span></span>
        <span class="heim-zeile-balken" aria-hidden="true"><span style="width: ${Math.round(lg.anteil * 100)}%"></span></span>
      </button>` });
  }
  return zeilen.sort((a, b) => a.rang - b.rang).slice(0, 2);
}

export function zeigeHeim(app, { jetzt = new Date() } = {}) {
  const laufend = ladeLaufendePartie();
  const st = laufend ? stellung(laufend) : null;
  const partie = !!(laufend && st);
  const bot = partie ? null : naechsterGegner();
  const tage = serieTage(jetzt);
  const chips = tage > 0
    ? `<span class="chip zahl heim-serie" title="${esc(t('heim.serieTitel', { n: zahl(tage) }))}"><i class="heim-punkt" aria-hidden="true"></i>${esc(t('heim.serie', { n: zahl(tage) }))}</span>`
    : '';
  const zeilen = naechsteZeilen();
  const s = document.createElement('section');
  s.className = 'screen heim-screen';
  s.setAttribute('aria-label', t('heim.aria'));
  s.innerHTML = `${hauptKopf({ titelElement: 'div', premium: true, klang: false, chips })}
    <div class="heim-rumpf">
      <div class="heim-links">
        <div class="heim-gruss"><small>${esc(gruss(jetzt))}</small><h1>${esc(t(partie ? 'heim.titel.partie' : 'heim.titel.leer'))}</h1></div>
        <div class="heim-buehne" data-art="${partie ? 'partie' : 'gegner'}">${partie ? buehnePartie(laufend, st) : buehneGegner(bot)}</div>
      </div>
      <div class="heim-rechts">
        ${zeilen.length ? `<section class="heim-naechstes" aria-labelledby="heim-naechstes-titel">
          <h3 id="heim-naechstes-titel">${esc(t('heim.naechstes'))}</h3>
          <div class="heim-liste">${zeilen.map((z) => z.html).join('')}</div>
        </section>` : ''}
        <div class="heim-wege">
          ${WEGE.map(([id, ic]) => `<button class="heim-modus dr" type="button" data-aktion="heim-${id}" data-weg="${id}">
            <span class="heim-symbol" aria-hidden="true">${icon(ic)}</span>
            <span class="heim-text"><b>${esc(t('heim.' + id + '.titel'))}</b><span>${esc(t('heim.' + id + '.text'))}</span></span>
          </button>`).join('')}
        </div>
      </div>
    </div>`;
  s.querySelector('.heim-rumpf').addEventListener('click', (e) => {
    const k = e.target.closest('[data-aktion]');
    if (!k) return;
    const a = k.dataset.aktion;
    if (a === 'heim-weiter' && laufend) {
      if (laufend.modus === 'zuzweit') app.gehe('partie', { modus: 'zuzweit', fortsetzen: true });
      else app.gehe('partie', { botId: laufend.botId, farbe: laufend.spielerFarbe, fortsetzen: true });
    } else if (a === 'heim-spielen') app.gehe('partie', { botId: k.dataset.bot });
    else if (a === 'heim-liga') app.gehe('bestenliste');
    else if (a === 'heim-online') app.gehe(laborFrei() ? 'lobby' : 'online');
    else if (a === 'heim-raetsel') app.gehe('training');
    else if (a === 'heim-zuzweit') app.gehe('partie', { modus: 'zuzweit' });
  });
  if (partie) {
    // dasselbe Brett wie in der Partie (Figurensatz, Brettfarben, Koordinaten aus den Einstellungen), nur zum Ansehen:
    // keine Zuege, keine Pfeile, Tipps gehen durch (pointer-events in heim.css)
    const e = ladeEinstellungen();
    s._brett = new Brett(s.querySelector('.heim-mini'), { ausrichtung: sichtVon(laufend), figurenPfad: figurenPfad(e),
      koordinaten: e.koordinaten, koordLage: e.koordLage, pfeile: false });
    s._brett.setzeStellung(st.fen, { animieren: false, letzterZug: st.zuletzt.length ? st.zuletzt : null, schach: st.schach ? true : null });
    s._bewertung = { fen: st.fen, sicht: sichtVon(laufend), laufend, st };
  }
  return s;
}

// Lage-Satz und Balken nachtragen, sobald die Engine eine kurze Bewertung hat; ohne Engine bleibt "Du bist am Zug"
async function bewerte(s, app, istWeg) {
  const b = s._bewertung;
  if (!b || !app || typeof app.engine !== 'function') return;
  try {
    const engine = await app.engine('bewertung');
    if (istWeg()) return;
    const r = await engine.analyse(b.fen, { depth: BEWERTUNG_TIEFE });
    if (istWeg() || !r || !r.lines || !r.lines[0]) return;
    const ev = r.lines[0].eval || {};
    const l = lageSatz(ev.cp, ev.mate, b.sicht);
    const zz = b.laufend.modus === 'zuzweit';
    const bot = zz ? null : botNachId(b.laufend.botId);
    let satz;
    if (zz) satz = l.art === 'gleich' ? t('heim.lage.gleich') : t(l.anteil > 0.5 ? 'heim.lage.wBesser' : 'heim.lage.sBesser');
    else satz = t('heim.lage.' + l.art);
    s.querySelector('.heim-lage').textContent = `${satz}, ${zugText(b.laufend, b.st, bot, false)}`;
    const balken = s.querySelector('.heim-balken');
    balken.querySelector('.heim-balken-wert').style.width = Math.round(l.anteil * 100) + '%';
    balken.querySelector('.heim-balken-zahl').textContent = l.wert;
    balken.setAttribute('role', 'img');
    balken.setAttribute('aria-label', t('heim.balken', { wert: l.wert }));
    balken.hidden = false;
  } catch (e) { /* ohne Bewertung bleibt der Zug-Satz */ }
}

export function zeige(root, params, app) {
  const s = zeigeHeim(app);
  root.append(s);
  let weg = false;
  const kopf = verbindeKopf(s, app, {
    beiZurueck: () => app.zurueck(),
    beiEinstellungen: () => app.gehe('einstellungen'),
  });
  // Ruhe: nur die Buehne gleitet einmal sanft herein (tempo() ist 0 bei reduzierter Bewegung)
  if (tempo() > 0) {
    kopfEintritt(s);
    anim(s.querySelector('.heim-buehne'), [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { d: 620 });
  }
  bewerte(s, app, () => weg);
  return {
    verlasse() {
      weg = true;
      try { kopf.verlasse(); } catch (e) { /* egal */ }
      if (s._brett) s._brett.zerstoere();
    },
  };
}
