// Screen "lobby" (Paket lobby, Flo 01.11.2026): die Online-Lobby als Vorschau im Labor. Oben der Umschalter Welten | Online
// (wie auf der Startseite), darunter "Schnell eine Partie" mit Bedenkzeiten (Blitz, Schnellschach, Klassisch), Gewertet
// oder Freundschaft und "Gegner suchen"; dann die eigenen Wertungen (geschaetzt), die Online-Liga (Beispiel-Tabelle) und
// weitere Spielarten (Gegen Freunde echt, Turniere und Raetsel-Duell bald). Die Gegnersuche zeigt den Radar und endet
// ehrlich mit einem Bot in passender Staerke und derselben Uhr (echte Partie). params: { zeit } (z. B. '3+2').
// Nur im Labor (js/labor.js laborFrei); sonst still zur Arena wie ein fehlender Paket-Screen.
//
//   zeige(root, params, app) -> { verlasse() }
// DOM: section.screen.lobby > header.haupt-kopf, .lb-rumpf > .lb-modus, .lb-spielen (.lb-zeiten > .lb-gruppe >
// button.lb-zeit[data-zeit][aria-checked], .segment[data-seg="lb-wertung"], button.lb-suchen), .lb-wertungen
// (.lb-wert[data-art]), .lb-liga (ol.lb-tabelle > li[data-zone][data-du]), .lb-mehr (button.lb-modus-karte[data-ziel]);
// waehrend der Suche .lb-suche[data-phase="suche"|"gefunden"]. Optik: css/pakete/lobby.css.
import { hauptKopf, verbindeKopf, kopfEintritt } from './seite.js';
import { segment } from './bauteile.js';
import { icon } from './icons.js';
import { staffel, tempo, anim } from '../bewegung.js';
import { laborFrei } from '../labor.js';
import { ladeFortschritt } from '../storage.js';
import { avatarVon, floAvatar } from '../thema.js';
import { t } from '../sprache.js';
import { ZEITEN, ARTEN, STANDARD_ZEIT, zeitText, schaetzeWertung, passenderBot, ligaTabelle, modusLeiste, ladeLobbyCss } from '../pakete/lobby/index.js';
import '../sprachen/allgemein.js';
import '../sprachen/rahmen.js';

const L = (k, w) => t('p-lobby.' + k, w);
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ART_ICON = { blitz: 'blitz', schnell: 'play', klassisch: 'verlauf' };
// so lange sucht die Vorschau, bevor der Gegner "gefunden" ist (ms); window.__lobbySuche verkuerzt es im Test
const SUCHDAUER = 2600;

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
  let zeit = ZEITEN.find((z) => z.id === (params && params.zeit)) || ZEITEN.find((z) => z.id === STANDARD_ZEIT);
  let gewertet = true;
  const uhren = new Set();
  const spaeter = (fn, ms) => { const u = setTimeout(() => { uhren.delete(u); fn(); }, ms); uhren.add(u); return u; };

  const zeitKnopf = (z) => `<button type="button" class="lb-zeit dr" role="radio" data-zeit="${z.id}" aria-checked="${z.id === zeit.id}"
    aria-label="${esc(L('zeit.aria', { art: L('art.' + z.art), min: Math.round(z.grund / 60), plus: z.zuschlag }))}"><b>${esc(zeitText(z))}</b></button>`;
  const tabelle = ligaTabelle({ name: L('du'), punkte: 0 });
  s.innerHTML = `${hauptKopf({ unter: L('unter'), premium: true })}
    <div class="lb-rumpf">
      <div class="lb-modus-ort"></div>
      <section class="lb-karte lb-spielen" aria-labelledby="lb-spielen-titel">
        <span class="ueberzeile">${esc(L('spielen.ueber'))}</span>
        <h2 id="lb-spielen-titel">${esc(L('spielen.titel'))}</h2>
        <div class="lb-zeiten" role="radiogroup" aria-label="${esc(L('zeit.label'))}">
          ${ARTEN.map((art) => `<div class="lb-gruppe" data-art="${art}"><span class="lb-gruppe-name">${icon(ART_ICON[art])}${esc(L('art.' + art))}</span>
            <div class="lb-chips">${ZEITEN.filter((z) => z.art === art).map(zeitKnopf).join('')}</div></div>`).join('')}
        </div>
        <div class="lb-wertung-ort"></div>
        <button type="button" class="knopf primaer dr lb-suchen">${esc(L('suchen'))}${icon('vor')}</button>
        <p class="lb-zeile"></p>
      </section>
      <section class="lb-karte lb-wertungen" aria-labelledby="lb-wertungen-titel">
        <h2 id="lb-wertungen-titel">${esc(L('wertungen.titel'))}</h2>
        <div class="lb-werte">${ARTEN.map((art) => `<div class="lb-wert" data-art="${art}">${icon(ART_ICON[art])}<span>${esc(L('art.' + art))}</span>
          <b class="zahl">${wertung}</b><small>${esc(L('geschaetzt'))}</small></div>`).join('')}</div>
        <p class="lb-text">${esc(L('wertungen.text'))}</p>
      </section>
      <section class="lb-karte lb-liga" aria-labelledby="lb-liga-titel">
        <div class="lb-liga-kopf"><div><span class="ueberzeile">${esc(L('liga.ueber'))}</span><h2 id="lb-liga-titel">${esc(L('liga.titel'))}</h2></div>
          <span class="lb-beispiel">${esc(L('beispiel'))}</span></div>
        <ol class="lb-tabelle">${tabelle.map((z) => `<li data-zone="${z.zone}"${z.du ? ' data-du' : ''}>
          <span class="lb-platz zahl">${z.platz}</span><span class="lb-av" aria-hidden="true">${z.du ? floAvatar('w') : esc([...z.name][0] || '?')}</span>
          <span class="lb-name">${esc(z.name)}</span>${z.zone ? `<span class="lb-zone">${icon('pfeil')}<span class="sr">${esc(L('zone.' + z.zone))}</span></span>` : '<span></span>'}
          <b class="lb-punkte zahl">${esc(L('punkte', { n: z.punkte }))}</b></li>`).join('')}</ol>
        <p class="lb-text">${esc(L('liga.text'))}</p>
      </section>
      <section class="lb-mehr" aria-labelledby="lb-mehr-titel">
        <h2 id="lb-mehr-titel">${esc(L('mehr.titel'))}</h2>
        <div class="lb-mehr-liste">
          <button type="button" class="lb-karte lb-modus-karte dr" data-ziel="online">${icon('person')}<span><b>${esc(L('freunde.titel'))}</b><small>${esc(L('freunde.text'))}</small></span>${icon('vor')}</button>
          <button type="button" class="lb-karte lb-modus-karte dr" data-ziel="turniere" disabled>${icon('pokal')}<span><b>${esc(L('turniere.titel'))}</b><small>${esc(L('turniere.text'))}</small></span><span class="lb-bald">${esc(L('bald'))}</span></button>
          <button type="button" class="lb-karte lb-modus-karte dr" data-ziel="duell" disabled>${icon('ziel')}<span><b>${esc(L('duell.titel'))}</b><small>${esc(L('duell.text'))}</small></span><span class="lb-bald">${esc(L('bald'))}</span></button>
        </div>
      </section>
    </div>`;

  const leiste = modusLeiste(app, 'online');
  if (leiste) s.querySelector('.lb-modus-ort').replaceWith(leiste);
  else s.querySelector('.lb-modus-ort').remove();
  const zeile = s.querySelector('.lb-zeile');
  const setzeZeile = () => { zeile.textContent = L('deine.wertung', { art: L('art.' + zeit.art), wert: `${wertung} (${L('geschaetzt')})` }); };
  setzeZeile();
  const zeitenEl = s.querySelector('.lb-zeiten');
  zeitenEl.addEventListener('click', (e) => {
    const k = e.target.closest('.lb-zeit');
    if (!k) return;
    zeit = ZEITEN.find((z) => z.id === k.dataset.zeit) || zeit;
    for (const b of zeitenEl.querySelectorAll('.lb-zeit')) b.setAttribute('aria-checked', String(b === k));
    setzeZeile();
    try {
      const h = history.state;
      if (h && h.schach && h.name === 'lobby') history.replaceState({ ...h, params: { ...(h.params || {}), zeit: zeit.id } }, '', location.hash);
    } catch (f2) { /* egal */ }
  });
  // Pfeiltasten in der Gruppe der Bedenkzeiten (Radiogruppe)
  zeitenEl.addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    const alle = [...zeitenEl.querySelectorAll('.lb-zeit')];
    const i = alle.findIndex((b) => b.dataset.zeit === zeit.id);
    const n = alle[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : alle.length - 1)) % alle.length];
    e.preventDefault();
    n.focus();
    n.click();
  });
  const seg = segment({ name: 'lb-wertung', label: L('wertung.label'), wert: 'gewertet',
    optionen: [{ id: 'gewertet', text: L('gewertet') }, { id: 'freundschaft', text: L('freundschaft') }],
    beiWahl: (id) => { gewertet = id === 'gewertet'; } });
  s.querySelector('.lb-wertung-ort').replaceWith(seg.el);

  s.querySelector('.lb-mehr').addEventListener('click', (e) => {
    const k = e.target.closest('.lb-modus-karte');
    if (k && !k.disabled && k.dataset.ziel === 'online') app.gehe('online');
  });

  // ---------- Gegnersuche (Vorschau) ----------
  let suche = null;
  function schliesseSuche() {
    if (!suche) return;
    for (const u of uhren) clearTimeout(u);
    uhren.clear();
    const el = suche.el;
    suche = null;
    el.remove();
    const k = s.querySelector('.lb-suchen');
    if (k && s.isConnected) k.focus();
  }
  function starteSuche() {
    if (suche) return;
    const bot = passenderBot(wertung, f);
    const el = document.createElement('div');
    el.className = 'lb-suche';
    el.dataset.phase = 'suche';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', L('suche.aria'));
    const zeileText = L('suche.zeile', { art: L('art.' + zeit.art), zeit: zeitText(zeit), wertung: gewertet ? L('gewertet') : L('freundschaft') });
    el.innerHTML = `<div class="lb-suche-karte">
        <div class="lb-radar" aria-hidden="true"><i></i><i></i><i></i><span class="lb-ich">${floAvatar('w')}</span>
          <span class="lb-gegner"><img src="${esc(avatarVon(bot))}" alt=""></span><b class="lb-vs">VS</b></div>
        <b class="lb-suche-titel" aria-live="polite">${esc(L('suche.titel'))}</b>
        <span class="lb-suche-zeile">${esc(zeileText)}</span>
        <span class="lb-suche-text">${esc(L('suche.text'))} · <span class="lb-uhr zahl">0:00</span></span>
        <p class="lb-gefunden-text" hidden>${esc(L('gefunden.text', { bot: bot.name, elo: bot.elo }))}</p>
        <div class="lb-suche-knoepfe">
          <button type="button" class="knopf primaer dr lb-spielen-bot" hidden>${esc(L('gefunden.spielen', { bot: bot.name }))}</button>
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
      const sek = Math.floor((Date.now() - start) / 1000);
      uhr.textContent = `${Math.floor(sek / 60)}:${String(sek % 60).padStart(2, '0')}`;
      if (el.dataset.phase === 'suche') spaeter(tick, 1000);
    };
    spaeter(tick, 1000);
    const dauer = typeof window !== 'undefined' && Number.isFinite(window.__lobbySuche) ? window.__lobbySuche : SUCHDAUER;
    spaeter(() => {
      if (!suche || suche.el !== el) return;
      el.dataset.phase = 'gefunden';
      el.querySelector('.lb-suche-titel').textContent = L('gefunden.titel');
      el.querySelector('.lb-gefunden-text').hidden = false;
      const los = el.querySelector('.lb-spielen-bot');
      los.hidden = false;
      el.querySelector('.lb-abbrechen').textContent = L('zurueck');
      if (tempo() > 0) anim(el.querySelector('.lb-gegner'), [{ transform: 'scale(.4)', opacity: 0 }, { transform: 'none', opacity: 1 }], { d: 520, k: 'hupf' });
      los.focus();
    }, dauer);
    el.addEventListener('click', (e) => {
      if (e.target.closest('.lb-abbrechen') || e.target === el) schliesseSuche();
      else if (e.target.closest('.lb-spielen-bot')) {
        const b = suche.bot;
        const tempoWahl = { grund: zeit.grund, zuschlag: zeit.zuschlag };
        schliesseSuche();
        app.gehe('partie', { botId: b.id, farbe: Math.random() < 0.5 ? 'w' : 'b', tempo: tempoWahl });
      }
    });
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); schliesseSuche(); } });
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
      if (suche) { suche.el.remove(); suche = null; }
      kopf.verlasse();
    },
  };
}
