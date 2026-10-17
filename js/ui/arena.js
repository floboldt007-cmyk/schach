// Arena: die Bot-Leiter als Level-Karte (leuchtender Serpentinenweg, Knoten je Bot) und das
// Gegner-Panel (Avatar, Begruessung, Bio, Merkmale, Stern-Ziele, Farbwahl, Spielen, Bilanz).
// Params: { neuFreigeschaltet?: botId } spielt die Freischalt-Animation,
//         { waehle?: botId } (Zusatz) waehlt einen freien Bot im Panel vor.
// Runde 4 (Anzeige-Orte, js/orte.js): arena:kopf (in .kopf-chips nach den zwei Chips),
// arena:panel-oben (ganz oben im Panel, davor die Nachlese aus feier.nachlese() "Seit deiner letzten
// Partie"), arena:panel-bot (nach den Stern-Zielen), arena:start (einmal nach dem ersten Layout).
// Die Begruessung im Panel waehlt wie in der Partie der Wahl-Ort partie:begruessung?.
// w0c: Fehlt gespeicherten Partien die Analyse (App waehrend der Auswertung beendet), rechnet die Arena sie
// still nach (js/nachholen.js, Start nach ARENA_NACHHOLEN_MS, Ende mit verlasse()) und zeichnet die Sterne
// danach ohne Animation neu.
import { BOTS, botSatz } from '../bots.js';
import {
  ladeFortschritt, istFreigeschaltet, naechsterGegner, gesamtSterne, besiegteBots, statistik,
  ladeLaufendePartie, loescheLaufendePartie, ladePartien,
} from '../storage.js';
import { klang } from '../sounds.js';
import { fuelle, waehle } from '../orte.js';
import { nachlese } from '../feier.js';
import { starteNachholen } from '../nachholen.js';
import { icon } from '../app.js';

// Merkmal-Kacheln (aus der Bot-Bio abgeleitet): Lieblingsfigur, Tempo, Schwaeche
const MERKMALE = {
  benno: { figur: 'P', lieblings: 'Bauer', tempo: 'Flott', schwaeche: 'Lässt Figuren hängen' },
  hilde: { figur: 'Q', lieblings: 'Dame', tempo: 'Gemütlich', schwaeche: 'Vergisst eigene Figuren' },
  kalle: { figur: 'Q', lieblings: 'Dame', tempo: 'Hastig', schwaeche: 'Achtet kaum auf Deckung' },
  lisa: { figur: 'B', lieblings: 'Läufer', tempo: 'Flott', schwaeche: 'Lange Pläne' },
  rudi: { figur: 'N', lieblings: 'Springer', tempo: 'Überlegt', schwaeche: 'Verliert den Überblick' },
  turm: { figur: 'R', lieblings: 'Turm', tempo: 'Bedächtig', schwaeche: 'Spielt lieber sicher' },
  delia: { figur: 'Q', lieblings: 'Dame', tempo: 'Stürmisch', schwaeche: 'Opfert zu gern' },
  koenig: { figur: 'K', lieblings: 'König', tempo: 'Bedächtig', schwaeche: 'Scharfe Taktik' },
  greta: { figur: 'B', lieblings: 'Läuferpaar', tempo: 'Präzise', schwaeche: 'Kaum eine' },
  stockfisch: { figur: 'Q', lieblings: 'Alle', tempo: 'Blitzschnell', schwaeche: 'Keine bekannt' },
};

// Knoten-Positionen auf der breiten Karte in Prozent (aus dem Mockup)
const POS_QUER = [[11, 86], [31, 80], [51, 86], [72, 79], [86, 56], [64, 50], [42, 56], [20, 47], [28, 20], [64, 17]];
// Hochformat: Serpentine von unten nach oben (x in Prozent, y gleichmaessig verteilt)
const X_HOCH = [22, 60, 80, 50, 20, 56, 82, 50, 20, 58];
const STUFEN_LABEL = [['Anfänger', 0.965], ['Fortgeschritten', 0.6], ['Meister', 0.045]];

let letzteFarbe = 'w';   // Farbwahl bleibt waehrend der Sitzung erhalten
// Fehlende Analysen erst nachrechnen, wenn die Arena steht (nach der Freischalt-Animation)
const ARENA_NACHHOLEN_MS = 2500;
const ZIEL_TEXTE = ['Sieg', 'Sieg mit ≥\u00a080\u00a0% Genauigkeit', 'ohne Hinweis und ohne Zurücknehmen'];

const kSterneHtml = (sterne) => sterne.map((x) => `<span class="${x ? 'stern' : 'aus'}">★</span>`).join('');
const zielSterneHtml = (sterne) => ZIEL_TEXTE.map((t, i) => `<div class="${sterne[i] ? 'an' : ''}"><b aria-hidden="true">★</b>${t}${sterne[i] ? '<span class="sr"> (erreicht)</span>' : ''}</div>`).join('');
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const prozent = (x) => (Number.isFinite(x) ? String(Math.round(x * 10) / 10).replace('.', ',') + ' %' : '-');

export function zeige(root, params, app) {
  const reduziert = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const uhren = new Set();
  const spaeter = (fn, ms) => { const u = setTimeout(() => { uhren.delete(u); fn(); }, ms); uhren.add(u); return u; };
  let beobachter = null;
  let weg = false;

  const fortschritt = ladeFortschritt();
  // Feier-Momente, die nicht ins Ergebnis passten: einmal holen, gilt fuer diesen Screen
  let feierRest = [];
  try { feierRest = nachlese(); } catch (e) { feierRest = []; }
  const orte = { kopf: null, oben: null, bot: null, start: null };
  const neuId = params && params.neuFreigeschaltet && BOTS.some((b) => b.id === params.neuFreigeschaltet) ? params.neuFreigeschaltet : null;
  const naechster = naechsterGegner(fortschritt);
  const alleBesiegt = BOTS.every((b) => fortschritt.bots[b.id].sterne[0]);
  const aktuellId = alleBesiegt ? null : naechster.id;
  // Alle besiegt: den ersten Bot mit fehlenden Sternen vorwaehlen (statt immer den Endgegner)
  const fehlendeSterne = alleBesiegt ? BOTS.find((b) => fortschritt.bots[b.id].sterne.some((x) => !x)) : null;
  let gewaehlt = neuId || (params && params.waehle && BOTS.some((b) => b.id === params.waehle) ? params.waehle : null)
    || (fehlendeSterne ? fehlendeSterne.id : naechster.id);
  if (!istFreigeschaltet(BOTS.find((b) => b.id === gewaehlt).stufe, fortschritt)) gewaehlt = naechster.id;

  const zustandVon = (b) => {
    if (fortschritt.bots[b.id].sterne[0]) return 'besiegt';
    if (istFreigeschaltet(b.stufe, fortschritt)) return 'aktuell';
    return 'gesperrt';
  };

  // ---------- Aufbau ----------
  const s = document.createElement('section');
  s.className = 'screen arena';
  s.setAttribute('aria-label', 'Bot-Leiter');
  s.innerHTML = `
    <header class="kopf">
      <div class="titel"><div class="logo">SCHACH·ARENA</div><div class="logo-unter">${alleBesiegt
        ? `Arena bezwungen! ${gesamtSterne(fortschritt)}/30\u00a0Sterne` : 'Besiege alle 10 Bots'}</div></div>
      <div class="kopf-chips">
        <span class="chip zahl" title="Gesammelte Sterne"><span class="stern" aria-hidden="true">★</span><span class="sr">Sterne:</span> ${gesamtSterne(fortschritt)}<span class="von"> / 30</span></span>
        <span class="chip zahl" title="Besiegte Bots">${icon('pokal')}<span class="sr">Besiegt:</span> ${besiegteBots(fortschritt)}<span class="von"> / 10</span></span>
      </div>
      <button class="icon-knopf" type="button" data-aktion="verlauf" aria-label="Verlauf">${icon('verlauf')}</button>
      <button class="icon-knopf" type="button" data-aktion="einstellungen" aria-label="Einstellungen">${icon('einst')}</button>
    </header>
    <div class="inhalt">
      <div class="karte" tabindex="-1">
        <div class="karte-innen">
          <svg class="pfad" aria-hidden="true" focusable="false">
            <defs><linearGradient id="verlauf-weg" gradientUnits="userSpaceOnUse" x1="0" y1="1000" x2="1000" y2="0">
              <stop offset="0" stop-color="#19f6e8"/><stop offset=".55" stop-color="#a06bff"/><stop offset="1" stop-color="#ff2d78"/></linearGradient></defs>
            <path class="weg-offen"/><path class="weg-glow"/><path class="weg-fertig"/><path class="weg-neu-glow"/><path class="weg-neu"/>
          </svg>
          ${STUFEN_LABEL.map(([t]) => `<span class="stufe-label">${t}</span>`).join('')}
          <div class="knoten-ort"></div>
        </div>
      </div>
      <aside class="detail flaeche" aria-label="Gegner"></aside>
    </div>`;
  root.append(s);

  const karte = s.querySelector('.karte');
  const innen = s.querySelector('.karte-innen');
  const svg = s.querySelector('.pfad');
  const detail = s.querySelector('.detail');
  const knotenOrt = s.querySelector('.knoten-ort');

  s.querySelector('[data-aktion="verlauf"]').addEventListener('click', () => app.gehe('verlauf'));
  s.querySelector('[data-aktion="einstellungen"]').addEventListener('click', () => app.gehe('einstellungen'));
  orte.kopf = fuelle('arena:kopf', s.querySelector('.kopf-chips'), { app, fortschritt });

  // ---------- Knoten ----------
  const knoten = BOTS.map((b) => {
    const z = b.id === neuId ? 'aktuell' : zustandVon(b);
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `knoten ${z}${b.stufe === 10 ? ' boss' : ''}`;
    el.dataset.bot = b.id;
    el.style.setProperty('--bf', b.farbe);
    const sterne = fortschritt.bots[b.id].sterne;
    el.setAttribute('aria-label', knotenLabel(b, z));
    el.innerHTML = `
      ${z === 'aktuell' && b.id === aktuellId ? '<span class="fahne">NÄCHSTER GEGNER</span>' : ''}
      ${b.stufe === 10 ? '<span class="boss-krone">ENDGEGNER</span>' : ''}
      ${z === 'besiegt' ? `<span class="k-sterne" aria-hidden="true">${kSterneHtml(sterne)}</span>` : ''}
      <span class="avatar"><img src="${esc(b.avatar)}" alt="" draggable="false"><span class="k-nr">${b.stufe}</span>${z === 'gesperrt' || b.id === neuId ? `<span class="schloss">${icon('schloss')}</span>` : ''}</span>
      <span class="k-name">${esc(b.name)}</span>
      <span class="k-meta zahl">Elo ${b.elo}</span>`;
    el.addEventListener('click', () => tippeKnoten(b, el));
    knotenOrt.append(el);
    return el;
  });

  function knotenLabel(b, z) {
    const zustandText = { besiegt: 'besiegt', aktuell: 'nächster Gegner', gesperrt: 'gesperrt' }[z];
    const sterne = fortschritt.bots[b.id].sterne;
    return `Stufe ${b.stufe}: ${b.name}, Elo ${b.elo}, ${zustandText}${z === 'besiegt' ? `, ${sterne.filter(Boolean).length} von 3 Sternen` : ''}`;
  }

  function tippeKnoten(b, el) {
    if (el.classList.contains('gesperrt')) {
      // den Bot nennen, den Flo jetzt spielen kann (der direkte Vorgaenger ist evtl. selbst gesperrt)
      const vorher = BOTS.find((x) => x.stufe === b.stufe - 1);
      app.meldung(vorher && vorher.id === naechster.id
        ? `Besiege erst ${vorher.name}.`
        : `Gesperrt. Besiege zuerst ${naechster.name}, dann geht es Stufe für Stufe weiter.`);
      el.classList.remove('ruettel');
      void el.offsetWidth;
      el.classList.add('ruettel');
      return;
    }
    if (gewaehlt === b.id) {
      if (window.matchMedia('(max-width: 600px)').matches) detail.scrollIntoView({ behavior: reduziert ? 'auto' : 'smooth', block: 'nearest' });
      return;
    }
    gewaehlt = b.id;
    markiereGewaehlt();
    zeigeDetail(true);
  }

  function markiereGewaehlt() {
    for (const el of knoten) {
      const an = el.dataset.bot === gewaehlt;
      el.classList.toggle('gewaehlt', an);
      el.setAttribute('aria-pressed', an ? 'true' : 'false');
    }
  }

  // ---------- Karte: Layout, Weg ----------
  let modus = null;
  function layout() {
    if (weg) return;
    const kb = karte.clientWidth;
    const kh = karte.clientHeight;
    if (!kb || !kh) return;
    const quer = !window.matchMedia('(orientation: portrait), (max-width: 760px)').matches && kh >= 420;
    const vorher = modus;
    modus = quer ? 'quer' : 'hoch';
    s.classList.toggle('karte-quer', quer);
    s.classList.toggle('karte-hoch', !quer);
    let w = kb;
    let h = kh;
    let punkte;
    if (quer) {
      innen.style.height = '';
      // im Querformat scrollt die Karte nicht: ein Rest aus dem Hochformat wuerde sie verschieben
      karte.scrollTop = 0;
      // Knoten etwas anheben: die Beschriftung haengt unter dem Avatar
      punkte = POS_QUER.map(([x, y]) => [x / 100 * w, y / 100 * h - Math.min(34, h * 0.045)]);
    } else {
      const schmal = kb < 600;
      const reihe = schmal ? 104 : 118;
      const oben = schmal ? 92 : 100;
      const unten = schmal ? 70 : 78;
      h = Math.max(kh, oben + unten + reihe * 9);
      innen.style.height = h + 'px';
      const rand = schmal ? 0 : Math.max(0, (w - 620) / 2);  // breite Hochformat-Karte: Weg mittig halten
      const nutz = w - 2 * rand;
      punkte = X_HOCH.map((x, i) => [rand + x / 100 * nutz, h - unten - i * reihe]);
    }
    punkte.forEach(([x, y], i) => {
      knoten[i].style.left = x.toFixed(1) + 'px';
      knoten[i].style.top = y.toFixed(1) + 'px';
    });
    s.querySelectorAll('.stufe-label').forEach((el, i) => { el.style.top = (STUFEN_LABEL[i][1] * h).toFixed(0) + 'px'; });
    zeichneWeg(punkte, w, h);
    // nach dem Drehen ins Hochformat den gewaehlten Gegner wieder ins Bild holen
    if (!quer && vorher && vorher !== modus) scrolleZu(gewaehlt, false);
  }

  function segmente(p) {
    const seg = [];
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i];
      const p1 = p[i];
      const p2 = p[i + 1];
      const p3 = p[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      seg.push(` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`);
    }
    return seg;
  }

  let wegAnimiert = false;
  function zeichneWeg(p, w, h) {
    svg.setAttribute('viewBox', `0 0 ${w.toFixed(0)} ${h.toFixed(0)}`);
    svg.setAttribute('width', w.toFixed(0));
    svg.setAttribute('height', h.toFixed(0));
    const grad = svg.querySelector('linearGradient');
    grad.setAttribute('x1', '0'); grad.setAttribute('y1', String(h)); grad.setAttribute('x2', String(w)); grad.setAttribute('y2', '0');
    const seg = segmente(p);
    const m = (i) => `M${p[i][0].toFixed(1)} ${p[i][1].toFixed(1)}`;
    // Index des aktuellen Gegners (Weg fertig bis dorthin)
    const bis = aktuellId ? BOTS.findIndex((b) => b.id === aktuellId) : BOTS.length - 1;
    const neuIdx = neuId ? BOTS.findIndex((b) => b.id === neuId) : -1;
    const animiert = neuIdx > 0 && neuIdx === bis && !wegAnimiert && !reduziert;
    const fertigBis = animiert ? bis - 1 : bis;
    const fertig = fertigBis > 0 ? m(0) + seg.slice(0, fertigBis).join('') : '';
    const offen = bis < p.length - 1 ? m(bis) + seg.slice(bis).join('') : '';
    svg.querySelector('.weg-offen').setAttribute('d', offen);
    svg.querySelector('.weg-fertig').setAttribute('d', fertig);
    svg.querySelector('.weg-glow').setAttribute('d', fertig);
    const neu = svg.querySelector('.weg-neu');
    const neuGlow = svg.querySelector('.weg-neu-glow');
    if (animiert) {
      const d = m(bis - 1) + seg[bis - 1];
      neu.setAttribute('d', d);
      neuGlow.setAttribute('d', d);
      let laenge = 400;
      try { laenge = neu.getTotalLength() || 400; } catch (e) { /* egal */ }
      for (const el of [neu, neuGlow]) {
        el.style.strokeDasharray = `${laenge.toFixed(1)} ${laenge.toFixed(1)}`;
        el.style.setProperty('--laenge', laenge.toFixed(1));
      }
      s.classList.add('weg-zeichnet');
      wegAnimiert = true;
    } else if (!s.classList.contains('weg-zeichnet')) {
      neu.setAttribute('d', '');
      neuGlow.setAttribute('d', '');
    } else {
      const d = m(bis - 1) + seg[bis - 1];
      neu.setAttribute('d', d);
      neuGlow.setAttribute('d', d);
    }
  }

  function scrolleZu(id, sanft) {
    if (modus !== 'hoch') return;
    const i = BOTS.findIndex((b) => b.id === id);
    const el = knoten[i];
    if (!el) return;
    const y = parseFloat(el.style.top) || 0;
    const ziel = Math.max(0, y - karte.clientHeight * 0.55);
    if (sanft && !reduziert && karte.scrollTo) karte.scrollTo({ top: ziel, behavior: 'smooth' });
    else karte.scrollTop = ziel;
  }

  // ---------- Gegner-Panel ----------
  function zeigeDetail(neueBlase) {
    const b = BOTS.find((x) => x.id === gewaehlt);
    const f = fortschritt.bots[b.id];
    const mm = MERKMALE[b.id] || MERKMALE.benno;
    const z = b.id === neuId ? 'aktuell' : zustandVon(b);
    const st = statistik();
    const laufend = ladeLaufendePartie();
    const laufBot = laufend ? BOTS.find((x) => x.id === laufend.botId) : null;
    const status = z === 'besiegt' ? 'BESIEGT' : 'NÄCHSTER GEGNER';
    const satz = begruessung(b);
    const farben = [['w', 'Weiß', ['wK']], ['z', 'Zufall', ['wK', 'bK']], ['b', 'Schwarz', ['bK']]];
    detail.style.setProperty('--bf', b.farbe);
    if (orte.oben) orte.oben.verlasse();
    if (orte.bot) orte.bot.verlasse();
    detail.innerHTML = `
      <div class="ort-panel-oben" hidden></div>
      ${laufend && laufBot ? `
      <div class="fortsetzen" style="--bf:${laufBot.farbe}">
        <span class="avatar"><img src="${esc(laufBot.avatar)}" alt=""></span>
        <div class="ft-text"><b>Offene Partie</b><span>gegen ${esc(laufBot.name)}</span><span>bei Zug ${Math.floor(laufend.zuege.length / 2) + 1}</span></div>
        <button class="knopf primaer" type="button" data-aktion="fortsetzen">${icon('play')} Fortsetzen</button>
      </div>` : ''}
      <div class="detail-links">
        <div class="detail-kopf">
          <button class="avatar gross" type="button" data-aktion="mehr" aria-label="Mehr über ${esc(b.name)}" aria-expanded="false"><img src="${esc(b.avatar)}" alt=""></button>
          <div class="detail-name">
            <span class="stufe">STUFE ${b.stufe} · ${status}</span>
            <h2>${esc(b.name)}</h2>
            <div class="elo zahl">Elo ${b.elo} · ${esc(b.titel)}</div>
            <div class="mini-sterne" aria-label="${f.sterne.filter(Boolean).length} von 3 Sternen">${kSterneHtml(f.sterne)}</div>
          </div>
          <button class="icon-knopf mehr-knopf" type="button" data-aktion="mehr" aria-label="Mehr über ${esc(b.name)}" aria-expanded="false">${icon('vor')}</button>
        </div>
        <div class="sprechblase oben mehr${neueBlase ? '' : ' still'}">„${esc(satz)}“</div>
        <p class="bio mehr">${esc(b.bio)}</p>
      </div>
      <div class="detail-rechts">
        <div class="merkmale mehr">
          <div class="merkmal"><span class="m-label">Lieblingsfigur</span><span class="m-wert"><span class="m-figur"><img src="assets/pieces/w${mm.figur}.svg" alt=""></span>${esc(mm.lieblings)}</span></div>
          <div class="merkmal"><span class="m-label">Tempo</span><span class="m-wert">${esc(mm.tempo)}</span></div>
          <div class="merkmal"><span class="m-label">Schwäche</span><span class="m-wert">${esc(mm.schwaeche)}</span></div>
        </div>
        <div class="ziel-sterne mehr">
          ${zielSterneHtml(f.sterne)}
        </div>
        <div class="ort-panel-bot mehr" hidden></div>
        <div class="farbwahl" role="radiogroup" aria-label="Farbe wählen">
          ${farben.map(([k, t, fig]) => `<button type="button" role="radio" data-farbe="${k}" aria-checked="${letzteFarbe === k}" class="${letzteFarbe === k ? 'an' : ''}">
            <span class="fig-bg">${fig.map((x) => `<img src="assets/pieces/${x}.svg" alt="">`).join('')}</span>${t}</button>`).join('')}
        </div>
        <button class="knopf primaer gross spielen" type="button" data-aktion="spielen">${icon('play')} Spielen</button>
        <div class="bilanz">${bilanzHtml(st)}</div>
      </div>`;

    detail.querySelectorAll('.farbwahl button').forEach((k) => k.addEventListener('click', () => {
      letzteFarbe = k.dataset.farbe;
      detail.querySelectorAll('.farbwahl button').forEach((x) => {
        const an = x === k;
        x.classList.toggle('an', an);
        x.setAttribute('aria-checked', an ? 'true' : 'false');
      });
    }));
    detail.querySelector('[data-aktion="spielen"]').addEventListener('click', () => spielen(b));
    detail.querySelectorAll('[data-aktion="mehr"]').forEach((k) => k.addEventListener('click', () => {
      const offen = detail.classList.toggle('offen');
      detail.querySelectorAll('[data-aktion="mehr"]').forEach((x) => x.setAttribute('aria-expanded', offen ? 'true' : 'false'));
    }));
    const fort = detail.querySelector('[data-aktion="fortsetzen"]');
    if (fort) {
      fort.addEventListener('click', () => app.gehe('partie', { botId: laufend.botId, farbe: laufend.spielerFarbe, fortsetzen: true }));
    }
    // Orte im Panel: oben (davor die Nachlese) und nach den Stern-Zielen
    const oben = detail.querySelector('.ort-panel-oben');
    const nl = nachleseKarte();
    if (nl) oben.append(nl);
    orte.oben = fuelle('arena:panel-oben', oben, { app, bot: b, fortschritt });
    oben.hidden = !nl && orte.oben.anzahl === 0;
    const botOrt = detail.querySelector('.ort-panel-bot');
    orte.bot = fuelle('arena:panel-bot', botOrt, { app, bot: b, fortschritt });
    botOrt.hidden = orte.bot.anzahl === 0;
  }

  function bilanzHtml(st) {
    return `
          <div><b>${st.partien}</b><span>Partien</span></div>
          <div><b>${st.siege}</b><span>Siege</span></div>
          <div><b>${prozent(st.schnittGenauigkeit)}</b><span>Ø Genauigkeit</span></div>
          <div><b>${st.spielstaerke ? '≈ ' + st.spielstaerke : '-'}</b><span>Spielstärke</span></div>
        `;
  }

  // Nachgeholte Analyse (w0c): Sterne, Kopf-Chip und Bilanz still neu zeichnen, ohne Animation und ohne
  // das Panel neu aufzubauen. Nur Stern 2 kann sich so aendern (Sieg und Freischaltung sind schon gebucht).
  function sterneNeu() {
    if (weg) return;
    const neu = ladeFortschritt();
    for (const b of BOTS) fortschritt.bots[b.id] = neu.bots[b.id];
    const zahl = s.querySelector('.kopf-chips .chip .sr');
    if (zahl && zahl.nextSibling && zahl.nextSibling.nodeType === 3) zahl.nextSibling.textContent = ' ' + gesamtSterne(fortschritt);
    if (alleBesiegt) s.querySelector('.logo-unter').textContent = `Arena bezwungen! ${gesamtSterne(fortschritt)}/30\u00a0Sterne`;
    BOTS.forEach((b, i) => {
      const el = knoten[i];
      const z = b.id === neuId ? 'aktuell' : zustandVon(b);
      const ks = el.querySelector('.k-sterne');
      if (ks) ks.innerHTML = kSterneHtml(fortschritt.bots[b.id].sterne);
      el.setAttribute('aria-label', knotenLabel(b, z));
    });
    const f = fortschritt.bots[gewaehlt];
    const mini = detail.querySelector('.mini-sterne');
    if (f && mini) {
      mini.innerHTML = kSterneHtml(f.sterne);
      mini.setAttribute('aria-label', `${f.sterne.filter(Boolean).length} von 3 Sternen`);
    }
    const ziele = detail.querySelector('.ziel-sterne');
    if (f && ziele) ziele.innerHTML = `\n          ${zielSterneHtml(f.sterne)}\n        `;
    const bilanz = detail.querySelector('.bilanz');
    if (bilanz) bilanz.innerHTML = bilanzHtml(statistik());
  }

  // Begruessung im Panel: dieselbe Wahl wie in der Partie (Wahl-Ort partie:begruessung?)
  function begruessung(b) {
    let wahl = null;
    try {
      wahl = waehle('partie:begruessung?', {
        bot: b, farbe: letzteFarbe === 'z' ? null : letzteFarbe, modus: 'normal',
        partienGegenBot: ladePartien().filter((p) => p.botId === b.id),
      });
    } catch (e) { wahl = null; }
    const anlass = wahl && typeof wahl.anlass === 'string' && wahl.anlass ? wahl.anlass : null;
    return (anlass && botSatz(b, anlass, Math.random, wahl.werte || null)) || botSatz(b, 'begruessung') || '';
  }

  // Nachlese: was nach der letzten Partie nicht mehr ins Ergebnis passte (still, ohne Klang)
  function nachleseKarte() {
    if (!feierRest.length) return null;
    const k = document.createElement('div');
    k.className = 'nachlese';
    k.setAttribute('role', 'status');
    k.innerHTML = '<div class="nl-titel">Seit deiner letzten Partie</div>';
    for (const f of feierRest) {
      const z = document.createElement('div');
      z.className = 'nl-zeile' + (f.art === 'gross' ? ' gross' : '');
      z.innerHTML = '<b></b>';
      z.querySelector('b').textContent = f.titel;
      if (f.text) {
        const t = document.createElement('span');
        t.textContent = f.text;
        z.append(' ', t);
      }
      k.append(z);
    }
    return k;
  }

  async function spielen(b) {
    const laufend = ladeLaufendePartie();
    if (laufend) {
      const lb = BOTS.find((x) => x.id === laufend.botId);
      const ok = await app.frage({
        titel: 'Neue Partie starten?',
        text: `Du hast noch eine offene Partie gegen ${lb ? lb.name : 'einen Bot'}. Sie wird verworfen.`,
        knoepfe: [{ text: 'Abbrechen', wert: false }, { text: 'Neue Partie', wert: true, art: 'primaer' }],
        abbrechen: false,
      });
      if (!ok || weg) return;
      loescheLaufendePartie();
    }
    const farbe = letzteFarbe === 'z' ? (Math.random() < 0.5 ? 'w' : 'b') : letzteFarbe;
    app.gehe('partie', { botId: b.id, farbe });
  }

  // ---------- Freischalt-Animation ----------
  function freischalten() {
    const i = BOTS.findIndex((b) => b.id === neuId);
    const el = knoten[i];
    if (!el) return;
    if (reduziert) {
      el.querySelector('.schloss')?.remove();
      return;
    }
    el.classList.add('wird-frei');
    s.classList.add('freischaltung');
    spaeter(() => scrolleZu(neuId, true), 250);
    spaeter(() => { klang.umwandlung(); }, 1250);
    spaeter(() => { klang.brillant(); }, 1650);
    spaeter(() => {
      el.classList.remove('wird-frei');
      el.querySelector('.schloss')?.remove();
      s.classList.remove('weg-zeichnet', 'freischaltung');
      const neu = svg.querySelector('.weg-neu');
      neu.style.strokeDasharray = '';
      svg.querySelector('.weg-neu-glow').style.strokeDasharray = '';
      app.meldung(`Neu freigeschaltet: ${BOTS[i].name}!`);
    }, 2700);
  }

  // ---------- Start ----------
  markiereGewaehlt();
  zeigeDetail(true);
  layout();
  scrolleZu(neuId ? BOTS[Math.max(0, BOTS.findIndex((b) => b.id === neuId) - 1)].id : gewaehlt, false);
  if (neuId) freischalten();
  // Aufruf-Ort arena:start (z. B. eine Kamerafahrt beim ersten Start), einmal nach dem ersten Layout
  orte.start = fuelle('arena:start', null, {
    app, s, karte, scrolleZu: (id, sanft) => scrolleZu(id, !!sanft), neuId,
  });
  if (typeof ResizeObserver === 'function') {
    let letzte = '';
    beobachter = new ResizeObserver(() => {
      const g = karte.clientWidth + 'x' + karte.clientHeight;
      if (g === letzte) return;
      const ersterLauf = letzte === '';
      letzte = g;
      if (ersterLauf) return;
      layout();
    });
    beobachter.observe(karte);
  }
  const beiGroesse = () => layout();
  window.addEventListener('orientationchange', beiGroesse);

  // Engines im Hintergrund vorwaermen, damit die erste Partie sofort startet
  spaeter(() => { app.engine('bot').catch(() => {}); app.engine('bewertung').catch(() => {}); }, 900);
  // Fehlende Analysen still nachholen (Stern 2); endet mit verlasse(), also auch beim Start einer Partie
  let nachholLauf = null;
  spaeter(() => { if (!weg) nachholLauf = starteNachholen(app, { beiPartie: sterneNeu }); }, ARENA_NACHHOLEN_MS + (neuId && !reduziert ? 1000 : 0));

  return {
    verlasse() {
      weg = true;
      if (nachholLauf) nachholLauf.stop();
      for (const u of uhren) clearTimeout(u);
      uhren.clear();
      if (beobachter) beobachter.disconnect();
      window.removeEventListener('orientationchange', beiGroesse);
      for (const o of Object.values(orte)) if (o) o.verlasse();
    },
  };
}
