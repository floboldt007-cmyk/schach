// Screen "lobby" (Paket lobby, Flo 01.11.2026): die Online-Lobby als Vorschau im Labor. Oben der Umschalter Welten | Online
// (wie auf der Startseite), darunter "Schnell eine Partie" mit Bedenkzeiten (Blitz, Schnellschach, Klassisch), Gewertet
// oder Freundschaft und "Gegner suchen"; dann die eigenen Wertungen (geschaetzt) und weitere Spielarten (die
// Beispiel-Liga mit erfundenen Namen ist seit Flo 08.11.2026 weg, die echte Liga steht im Liga-Reiter) (Gegen Freunde und Raetsel-Duell echt, Turniere bald). Die Gegnersuche zeigt den Radar und endet
// ehrlich mit einem Bot in passender Staerke und derselben Uhr (echte Partie). params: { zeit } (z. B. '3+2').
// Nur im Labor (js/labor.js laborFrei); sonst still zur Arena wie ein fehlender Paket-Screen.
//
//   zeige(root, params, app) -> { verlasse() }
// DOM (R19 Lobby B "Schnellstart"): section.screen.lobby > header.haupt-kopf, .lb-rumpf > .lb-modus, .lb-spielen[data-variante]
// (.lb-kopfzeile mit .lb-rang, button.lb-kachel.lb-gewertet.lb-suchen, .lb-raster > button.lb-kachel.lb-frei[data-zeit]),
// .lb-mehr (button.lb-modus-karte[data-ziel]); jede Kachel startet die Suche sofort;
// waehrend der Suche .lb-suche[data-phase="suche"|"gefunden"|"anmelden"|"fehler"]. Optik: css/pakete/lobby.css.
// Gewertet (Etappe B Task 4): echte Gegnersuche ueber js/kronen.js; Treffer oeffnet die Online-Partie, nach der Wartezeit
// des Servers (window.__lobbyBotMs verkuerzt sie im Test) startet die Partie gegen den passenden Bot als KI-Gegner (params ki, kiRef).
import { hauptKopf, verbindeKopf, kopfEintritt } from './seite.js';
import { icon } from './icons.js';
import { staffel, tempo, anim } from '../bewegung.js';
import { laborFrei } from '../labor.js';
import { ladeFortschritt, ladeModul } from '../storage.js';
import { sitzung } from '../konto.js';
import { stufeInfo, kronenSpeicher, startStufeAusElo } from '../pakete/liga/kronen.js';
import { stufenName } from '../pakete/liga/texte.js';
import { avatarVon, floAvatar } from '../thema.js';
import { t } from '../sprache.js';
import { ZEITEN, STANDARD_ZEIT, zeitText, schaetzeWertung, passenderBot, modusLeiste, ladeLobbyCss } from '../pakete/lobby/index.js';
import { suche as kronenSuche, angemeldet as kronenAngemeldet, RANKED_ZEIT } from '../kronen.js';
import { karteDerPartie } from '../karte.js';
import { visitenkarte, eigeneKarte, fremdeKarte, botKarte, karteVomServer } from './visitenkarte.js';
import { hoere } from '../ereignisse.js';
import '../sprachen/allgemein.js';
import '../sprachen/rahmen.js';
import '../sprachen/online.js';

const L = (k, w) => t('p-lobby.' + k, w);
const O = (k, w) => t('online.' + k, w);
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ART_ICON = { blitz: 'blitz', schnell: 'play', klassisch: 'verlauf' };
// so lange sucht die Vorschau, bevor der Gegner "gefunden" ist (ms); window.__lobbySuche verkuerzt es im Test
const SUCHDAUER = 2600;
// Etappe 4b: so lange stehen die Visitenkarten nach einem Treffer oder dem KI-Ersatz (ms); window.__lobbyGefundenMs im Test
const GEFUNDEN_MS = 1800;
const KT = (k, w) => t('p-karte.' + k, w);

// Sondertitel (supabase/karte-sondertitel-schema.sql): die Sammlung kennt sie nur fuer das eigene Konto, deshalb hier
// benannt; dieselbe Regel steht in js/ui/online.js spielerDaten (Duell-Intro), beide gleich halten
function mitSondertitel(k, roh) {
  if (!k || k.titel || !roh || typeof roh.titel !== 'string') return k;
  const pionier = /^pionier-(\d{3})$/.exec(roh.titel);
  if (roh.titel === 'erfinder') k.titel = { name: O('titel.erfinder') };
  else if (pionier && Number(pionier[1]) >= 1 && Number(pionier[1]) <= 100) k.titel = { name: O('titel.pionier', { n: Number(pionier[1]) }) };
  return k;
}

export function zeige(root, params, app) {
  const s = document.createElement('section');
  s.className = 'screen lobby';
  s.setAttribute('aria-label', L('name'));
  root.append(s);
  if (!laborFrei()) {
    let weg = false;
    setTimeout(() => { if (!weg) app.gehe('arena', {}, { ersetzen: true }); }, 0);
    return { verlasse() { weg = true; } };
  }
  ladeLobbyCss();
  const f = ladeFortschritt();
  const wertung = schaetzeWertung(f);
  // Rang-Wappen: der gemerkte Liga-Stand desselben Kontos (wie die Startseite), sonst die Start-Liga aus der geschaetzten Wertung
  const gemerkt = kronenSpeicher(ladeModul('kronen'));
  const rang = gemerkt.stand && gemerkt.konto && gemerkt.konto === sitzung()?.user?.id ? gemerkt.stand.stufe : startStufeAusElo(wertung);
  let zeit = ZEITEN.find((z) => z.id === (params && params.zeit)) || ZEITEN.find((z) => z.id === STANDARD_ZEIT);
  let gewertet = true;
  const uhren = new Set();
  const spaeter = (fn, ms) => { const u = setTimeout(() => { uhren.delete(u); fn(); }, ms); uhren.add(u); return u; };

  // R19 Lobby B "Schnellstart": jede Kachel startet sofort die Suche; oben die gewertete Partie, darunter alle Zeiten als Freundschaft
  const freiKachel = (z) => `<button type="button" class="lb-kachel lb-frei dr" data-zeit="${z.id}"
    aria-label="${esc(L('b.freiAria', { art: L('art.' + z.art), min: Math.round(z.grund / 60), plus: z.zuschlag }))}">
    <b class="zahl">${esc(zeitText(z))}</b><small>${icon(ART_ICON[z.art])}${esc(L('b.art.' + z.art))}</small></button>`;
  s.innerHTML = `${hauptKopf({ unter: L('unter'), premium: true })}
    <div class="lb-rumpf">
      <div class="lb-modus-ort"></div>
      <section class="lb-karte lb-spielen" data-variante="lobby-b" aria-labelledby="lb-spielen-titel">
        <div class="lb-kopfzeile">
          <div><span class="ueberzeile">${esc(L('spielen.ueber'))}</span><h2 id="lb-spielen-titel">${esc(L('b.titel'))}</h2></div>
          <div class="lb-rang" role="img" aria-label="${esc(L('rang.aria', { stufe: stufenName(rang), wert: `${wertung} (${L('geschaetzt')})` }))}">
            <img src="${esc(new URL(`../../assets/liga/${stufeInfo(rang).liga}.svg`, import.meta.url).href)}" alt="" width="44" height="53">
            <span><b>${esc(stufenName(rang))}</b><small class="zahl">${wertung} · ${esc(L('geschaetzt'))}</small></span>
          </div>
        </div>
        <button type="button" class="lb-kachel lb-gewertet lb-suchen dr">
          <span class="lb-kachel-ueber">${icon('pokal')}${esc(L('gewertet'))}</span>
          <b class="zahl">${esc(zeitText(RANKED_ZEIT))}</b><small>${esc(L('b.gewertetText', { art: L('art.' + RANKED_ZEIT.art) }))}</small>${icon('vor')}
        </button>
        <h3 class="lb-raster-titel">${esc(L('b.frei'))}</h3>
        <div class="lb-raster">${ZEITEN.map(freiKachel).join('')}</div>
      </section>
      <section class="lb-mehr" aria-labelledby="lb-mehr-titel">
        <h2 id="lb-mehr-titel">${esc(L('mehr.titel'))}</h2>
        <div class="lb-mehr-liste">
          <button type="button" class="lb-karte lb-modus-karte dr" data-ziel="online">${icon('person')}<span><b>${esc(L('freunde.titel'))}</b><small>${esc(L('freunde.text'))}</small></span>${icon('vor')}</button>
          <button type="button" class="lb-karte lb-modus-karte dr" data-ziel="turniere" disabled>${icon('pokal')}<span><b>${esc(L('turniere.titel'))}</b><small>${esc(L('turniere.text'))}</small></span><span class="lb-bald">${esc(L('bald'))}</span></button>
          <button type="button" class="lb-karte lb-modus-karte dr" data-ziel="duell">${icon('ziel')}<span><b>${esc(L('duell.titel'))}</b><small>${esc(L('duell.text'))}</small></span>${icon('vor')}</button>
        </div>
      </section>
    </div>`;

  const leiste = modusLeiste(app, 'online');
  if (leiste) s.querySelector('.lb-modus-ort').replaceWith(leiste);
  else s.querySelector('.lb-modus-ort').remove();
  // Freundschafts-Kachel: Zeit setzen und gleich suchen; gewertet gilt nur fuer diesen einen Start (starteSuche liest es sofort).
  // Die gewertete Kachel ist .lb-suchen und startet unten ueber denselben Weg wie bisher (feste Zeit RANKED_ZEIT).
  s.querySelector('.lb-raster').addEventListener('click', (e) => {
    const k = e.target.closest('.lb-frei');
    if (!k) return;
    zeit = ZEITEN.find((z) => z.id === k.dataset.zeit) || zeit;
    gewertet = false;
    starteSuche();
    gewertet = true;
  });

  s.querySelector('.lb-mehr').addEventListener('click', (e) => {
    const k = e.target.closest('.lb-modus-karte');
    if (k && !k.disabled && k.dataset.ziel === 'online') app.gehe('online');
    // Etappe 5: Raetsel-Duell (eigener Screen js/ui/raetsel-duell.js)
    if (k && !k.disabled && k.dataset.ziel === 'duell') app.gehe('raetsel-duell');
  });

  // ---------- Gegnersuche (Vorschau) ----------
  let suche = null;
  function schliesseSuche() {
    if (!suche) return;
    for (const u of uhren) clearTimeout(u);
    uhren.clear();
    if (suche.server) suche.server.stopp();
    const el = suche.el;
    suche = null;
    el.remove();
    const k = s.querySelector('.lb-suchen');
    if (k && s.isConnected) k.focus();
  }
  // Etappe 4b "Gegner gefunden": beide Visitenkarten fliegen von links und rechts herein (ruhig: ohne Flug)
  function zeigeKarten(el, gegner) {
    const box = el.querySelector('.lb-karten');
    const ich = visitenkarte(eigeneKarte(), { groesse: 'mittel' });
    ich.classList.add('lb-karte-ich');
    const du = visitenkarte(gegner, { groesse: 'mittel' });
    du.classList.add('lb-karte-gegner');
    box.replaceChildren(ich, Object.assign(document.createElement('b'), { className: 'lb-karten-vs', textContent: 'VS' }), du);
    box.hidden = false;
    if (tempo() > 0) {
      anim(ich, [{ transform: 'translateX(-48px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { d: 520, k: 'weich' });
      anim(du, [{ transform: 'translateX(48px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { d: 520, k: 'weich' });
    }
  }
  // Treffer oder KI-Ersatz: kurz die Karten zeigen, dann weiter. Waehrend der Pause kein Abbrechen (der Server hat schon
  // gepaart bzw. den Beleg ausgestellt; abbrechen liesse die Partie verwaisen).
  function gefundenUndWeiter(el, gegner, weiter) {
    suche.gesperrt = true;
    suche.weiter = weiter;
    el.dataset.phase = 'gefunden';
    el.querySelector('.lb-suche-titel').textContent = L('gefunden.titel');
    el.querySelector('.lb-suche-text').textContent = KT('gefunden.los');
    el.querySelector('.lb-abbrechen').hidden = true;
    zeigeKarten(el, gegner);
    el.focus();
    const ms = typeof window !== 'undefined' && Number.isFinite(window.__lobbyGefundenMs) ? window.__lobbyGefundenMs : GEFUNDEN_MS;
    spaeter(() => { if (!suche || suche.el !== el) return; schliesseSuche(); weiter(); }, ms);
  }
  function starteSuche() {
    if (suche) return;
    const bot = passenderBot(wertung, f);
    const el = document.createElement('div');
    el.className = 'lb-suche';
    el.dataset.phase = 'suche';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.tabIndex = -1;
    el.setAttribute('aria-label', L('suche.aria'));
    const z = gewertet ? RANKED_ZEIT : zeit;
    const zeileText = L('suche.zeile', { art: L('art.' + z.art), zeit: zeitText(z), wertung: gewertet ? L('gewertet') : L('freundschaft') });
    el.innerHTML = `<div class="lb-suche-karte">
        <div class="lb-radar" aria-hidden="true"><i></i><i></i><i></i><span class="lb-ich">${floAvatar('w')}</span>
          <span class="lb-gegner"><img src="${esc(avatarVon(bot))}" alt=""></span><b class="lb-vs">VS</b></div>
        <div class="lb-karten" hidden></div>
        <b class="lb-suche-titel" aria-live="polite">${esc(L('suche.titel'))}</b>
        <span class="lb-suche-zeile">${esc(zeileText)}</span>
        <span class="lb-suche-text">${esc(L('suche.text'))} · <span class="lb-uhr zahl">0:00</span></span>
        <p class="lb-gefunden-text" hidden>${esc(L('gefunden.text', { bot: bot.name, elo: bot.elo }))}</p>
        <div class="lb-suche-knoepfe">
          <button type="button" class="knopf primaer dr lb-spielen-bot" hidden>${esc(L('gefunden.spielen', { bot: bot.name }))}</button>
          <button type="button" class="knopf primaer dr lb-ki-jetzt" hidden disabled>${esc(L('suche.kiJetzt'))}</button>
          <button type="button" class="knopf dr lb-abbrechen">${esc(L('abbrechen'))}</button>
        </div>
      </div>`;
    // an body, damit die Suche auch die Reiter-Leiste abdeckt (der Screen hat einen eigenen Stapelkontext)
    document.body.append(el);
    suche = { el, bot };
    const uhr = el.querySelector('.lb-uhr');
    const start = Date.now();
    const tick = () => {
      if (!suche || suche.el !== el) return;
      // mit Server-Suche zaehlt die Uhr ab dem Beginn, den der Server nennt (js/gegnersuche.js)
      const l = suche.server ? suche.server.lage() : null;
      const sek = Math.floor((l ? l.vergangenMs : Date.now() - start) / 1000);
      // "Jetzt gegen KI" nur, wenn der Server eine KI-Grenze vor dem Ende nennt (neues SQL), und erst ab da
      const ki = el.querySelector('.lb-ki-jetzt');
      if (l && el.dataset.phase === 'suche') {
        ki.hidden = !(l.vomServer && l.kiAbMs < l.warteMs);
        ki.disabled = l.vergangenMs < l.kiAbMs;
      } else ki.hidden = true;
      uhr.textContent = `${Math.floor(sek / 60)}:${String(sek % 60).padStart(2, '0')}`;
      if (el.dataset.phase === 'suche') spaeter(tick, 1000);
    };
    spaeter(tick, 1000);
    const tempoWahl = { grund: z.grund, zuschlag: z.zuschlag };
    // Etappe B Task 4: gewertet = echte Gegnersuche auf dem Server (js/kronen.js), nach der Wartezeit des Servers ein KI-Gegner mit Beleg;
    // Freundschaft bleibt die Vorschau mit einem Bot ohne Kronen
    if (gewertet) {
      const text = el.querySelector('.lb-suche-text');
      if (!kronenAngemeldet()) {
        el.dataset.phase = 'anmelden';
        el.querySelector('.lb-suche-titel').textContent = L('suche.anmelden');
        text.textContent = L('suche.anmelden.text');
      } else {
        text.firstChild.textContent = L('suche.server') + ' · ';
        // die Wartezeit nennt der Server; __lobbyBotMs nur im Test
        const warteMs = typeof window !== 'undefined' && Number.isFinite(window.__lobbyBotMs) ? window.__lobbyBotMs : undefined;
        suche.server = kronenSuche(z.id, {
          warteMs,
          beiTreffer: (partieId) => {
            if (!suche || suche.el !== el) return;
            // zuerst Start-Banner und "Gegner"; kommt die Karte des Servers rechtzeitig (js/karte.js, 1,2 s), ersetzt sie das
            gefundenUndWeiter(el, karteVomServer(null), () => app.gehe('online', { partieId }));
            karteDerPartie(partieId).then((d) => {
              if (!d || !suche || suche.el !== el) return;
              const fremd = d.w && d.w.du ? d.s : d.w;
              const alt = el.querySelector('.lb-karte-gegner');
              if (!fremd || !alt) return;
              const neu = visitenkarte(mitSondertitel(fremdeKarte(fremd), fremd), { groesse: 'mittel' });
              neu.classList.add('lb-karte-gegner');
              alt.replaceWith(neu);
            });
          },
          beiBot: ({ kiRef }) => {
            if (!suche || suche.el !== el) return;
            // wie Online: nur mit Beleg und neuem SQL (#213) der Hinweis, dass Verlassen als Niederlage zaehlt
            const verlassen = !!kiRef && suche.server.lage().vomServer;
            gefundenUndWeiter(el, botKarte(bot), () => {
              // erst wenn die Partie steht: der Seitenwechsel leert die Meldungen (js/app.js zeigeScreen)
              if (verlassen) { const ab = hoere('app:screen', (d) => { if (d.name !== 'partie') return; ab(); app.meldung(L('suche.kiVerlassen'), { dauer: 4500 }); }); }
              app.gehe('partie', { botId: bot.id, farbe: Math.random() < 0.5 ? 'w' : 'b', tempo: tempoWahl, ki: true, ...(kiRef ? { kiRef } : {}) });
            });
          },
          beiFehler: () => {
            if (!suche || suche.el !== el) return;
            el.dataset.phase = 'fehler';
            text.textContent = L('suche.fehler');
          },
        });
      }
    }
    const dauer = typeof window !== 'undefined' && Number.isFinite(window.__lobbySuche) ? window.__lobbySuche : SUCHDAUER;
    if (!gewertet) spaeter(() => {
      if (!suche || suche.el !== el) return;
      el.dataset.phase = 'gefunden';
      el.querySelector('.lb-suche-titel').textContent = L('gefunden.titel');
      el.querySelector('.lb-gefunden-text').hidden = false;
      const los = el.querySelector('.lb-spielen-bot');
      los.hidden = false;
      el.querySelector('.lb-abbrechen').textContent = L('zurueck');
      // Freundschaft: dieselben Karten, der Bot als KI-Gegner gekennzeichnet; hier waehlt man selbst, wann es losgeht
      zeigeKarten(el, botKarte(bot));
      los.focus();
    }, dauer);
    el.addEventListener('click', (e) => {
      if (suche && suche.gesperrt) return;
      if (e.target.closest('.lb-abbrechen') || e.target === el) schliesseSuche();
      else if (e.target.closest('.lb-ki-jetzt')) { if (suche.server) suche.server.jetztKi(); }
      else if (e.target.closest('.lb-spielen-bot')) {
        const b = suche.bot;
        schliesseSuche();
        app.gehe('partie', { botId: b.id, farbe: Math.random() < 0.5 ? 'w' : 'b', tempo: tempoWahl });
      }
    });
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); if (!(suche && suche.gesperrt)) schliesseSuche(); } });
    if (tempo() > 0) anim(el.querySelector('.lb-suche-karte'), [{ transform: 'translateY(24px) scale(.96)', opacity: 0 }, { transform: 'none', opacity: 1 }], { d: 360, k: 'weich' });
    el.querySelector('.lb-abbrechen').focus();
  }
  s.querySelector('.lb-suchen').addEventListener('click', starteSuche);

  const kopf = verbindeKopf(s, app, { beiEinstellungen: () => app.gehe('einstellungen') });
  if (tempo() > 0) {
    kopfEintritt(s);
    staffel(s.querySelectorAll('.lb-rumpf > *'), { d: 560, v: 60, abstand: 50, von: 'translateY(14px)' });
  }
  return {
    verlasse() {
      for (const u of uhren) clearTimeout(u);
      uhren.clear();
      // in der Pause nach "Gegner gefunden" ist die Partie schon gepaart: Wegnavigieren (Zurueck-Geste) fuehrt trotzdem
      // in die Partie, sonst wartet der Gegner auf niemanden
      const nachholen = suche && suche.gesperrt ? suche.weiter : null;
      if (suche) { if (suche.server) suche.server.stopp(); suche.el.remove(); suche = null; }
      kopf.verlasse();
      if (nachholen) setTimeout(nachholen, 0);
    },
  };
}
