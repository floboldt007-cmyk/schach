// Oberflaeche des Pakets punkte im Ergebnis (Look A, Klassen pk-*, Optik in css/pakete/punkte.css). Nur DOM, keine
// Buchungen: index.js liest das Ergebnis (stand.js) und reicht es herein. Bewegung nur ueber transform und opacity
// (js/bewegung.js: anim, tempo); bei reduzierter Bewegung oder Tempo 0 steht sofort das Endbild, der Klang bleibt.
//
//   zahlText(n) -> '21.300'
//   tafelName(tafelId, botNachId) -> 'Rudis Tafel' | 'Boss-Tafel Baron von Gambit / Meister' | 'Tafel'
//   unterText(ergebnis, name) -> Satz der Abrechnungszeile ("Platz 3 auf Rudis Tafel", "Rekord auf ...", ...)
//   abrechnungsZeile({ ergebnis, tafelName, schonGezeigt, merke, mini, beiListe, post, stumm }) -> { el, beende(), verlasse() }
//       div.pk-abr[data-zeile="punkte"]: "PUNKTE 21.300", darunter "Platz 3 auf Rudis Tafel ^ 2"; bei einem Rekord bleibt
//       der alte Wert durchgestrichen stehen (.pk-alt), der neue zaehlt hoch. Bei ueberholten Zeilen (^) eine Mini-Tafel mit
//       drei Zeilen (ueber dir, du, unter dir): deine Zeile gleitet nach oben, je ueberholter Zeile ein Klacken (Klang
//       "klick"). Antippen zeigt die Aufschluesselung und "Zur Bestenliste". data-fertig="1", sobald das Endbild steht.
//       stumm: true, wenn das Ergebnis den grossen Moment schon mit Klang "rekord" zeigt (dann nur das Klacken, kein Echo).
//       post: { name, text() -> Text } (Ueberhol-Post, 3.13): in der Aufschluesselung einmal still "Ueberhol-Post an Jule";
//       Antippen zeigt den Text mit Code als Vorschau, verschickt wird nur von Hand (Kopieren oder Teilen-Blatt).
//   panelZeile({ name, best, platz, beiTipp }) -> HTMLElement   Ort arena:panel-bot (3.17 "Rudis Tafel: Platz 4"):
//       button.pk-panel "Rudis Tafel / Bestwert 12.300" (mit Gaesten dazu "/ Platz 2"), Antippen oeffnet die Tafel
//   wartezeile({ fehlt }) -> HTMLElement   "Punkte werden gezaehlt ..." (Analyse rechnet noch, ruhiger Schimmer, endlich)
//       bzw. mit fehlt: "Punkte folgen mit der Analyse" (die Arena holt sie nach)
import { anim, tempo } from '../../bewegung.js';
import { klang } from '../../sounds.js';
import { icon } from '../../ui/icons.js';
import { t, zahl } from '../../sprache.js';
import '../../sprachen/allgemein.js';
import './texte.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Zahlen in der eingestellten Sprache ('21.300' | '21,300')
export const zahlText = (n) => zahl(Math.round(Number(n) || 0));

// Besitzform der Leiter-Bots ("Rudis Tafel", Woerterbuch besitz.<id>); andere Gegner heissen "Tafel: <Name>"
const BESITZ = new Set(['benno', 'hilde', 'kalle', 'lisa', 'rudi', 'turm', 'delia', 'koenig', 'greta', 'stockfisch',
  // Welten (24.10.): die neuen Bots
  'fridolin', 'paula', 'gustav', 'janine', 'bodo', 'leo', 'edda', 'luke', 'moritz', 'ottilie', 'lasse', 'wiebke', 'henning', 'ilka',
  'johann', 'keetan', 'ragna', 'silas', 'merle', 'alva']);
const STUFEN = ['standard', 'meister'];

export function tafelName(tafelId, botNachId = () => null) {
  const teile = typeof tafelId === 'string' ? tafelId.split(':') : [];
  if (teile[0] === 'bot') {
    if (BESITZ.has(teile[1])) return t('p-punkte.tafel.besitz', { wer: t('p-punkte.besitz.' + teile[1]) });
    const b = botNachId(teile[1]);
    return b && b.name ? t('p-punkte.tafel.von', { name: b.name }) : t('p-punkte.tafel.allein');
  }
  if (teile[0] === 'boss') {
    const b = botNachId(teile[1]);
    return t('p-punkte.tafel.boss', { name: b && b.name ? b.name : t('p-punkte.tafel.wochenBoss'),
      stufe: STUFEN.includes(teile[2]) ? t('p-punkte.stufe.' + teile[2]) : '' }).trim();
  }
  return t('p-punkte.tafel.allein');
}

const GRUENDE = ['hilfe', 'frei', 'spiel', 'gast', 'stellung'];

export function unterText(e, name = t('p-punkte.tafel.allein')) {
  if (!e) return '';
  if (!e.tafel) return t('p-punkte.grund.' + (GRUENDE.includes(e.grund) ? e.grund : 'gast'));
  if (e.erster) return t('p-punkte.erster', { name });
  // Platz gewonnen: "Platz 3 auf Rudis Tafel" (der Pfeil ^ 2 und die durchgestrichene alte Zahl stehen daneben)
  if (e.rekord && e.aufstieg > 0 && e.platz != null) return t('p-punkte.platzAuf', { platz: e.platz, name });
  if (e.rekord) return t('p-punkte.rekordPlus', { name, plus: zahlText(e.w - (e.vorher || 0)) });
  // "So nah" vor dem Platz: eine Partie mit 90 % des Rekords steht fast immer unter deinen drei Besten, und der leise
  // Moment (hoechstens einmal je Tafel und Woche) waere sonst nie zu sehen
  if (e.fast) return t('p-punkte.fast', { prozent: e.fast.prozent, name });
  if (e.platz != null) return t('p-punkte.platzAuf', { platz: e.platz, name });
  if (e.wochenPlatz != null) return t('p-punkte.wochePlatz', { platz: e.wochenPlatz, name });
  return t('p-punkte.bestwert', { name, wert: zahlText(e.bestwert) });
}

// Text mit Markup an Platzhaltern: der Text wird maskiert, {name} aus html bleibt Markup (Texte ohne HTML im Woerterbuch)
function mitHtml(schluessel, werte, html) {
  let s = esc(t(schluessel, werte));
  for (const [k, v] of Object.entries(html)) s = s.split('{' + k + '}').join(v);
  return s;
}

function el(tag, klasse, html) {
  const x = document.createElement(tag);
  if (klasse) x.className = klasse;
  if (html != null) x.innerHTML = html;
  return x;
}

function posten(e) {
  const p = e.posten || {};
  const aus = [[t('p-punkte.posten.zuege', { offen: p.offen || 0 }), p.zugpunkte], [t('p-punkte.posten.theorie'), p.theorie]];
  if (p.kurz) aus.push([t('p-punkte.posten.kurz'), null]);
  else {
    const erg = { sieg: 'allgemein.sieg', remis: 'allgemein.remis', niederlage: 'p-punkte.posten.kampfgeist' }[e.erg];
    aus.push([t(erg || 'p-punkte.posten.ergebnis'), p.ergebnis]);
  }
  if (e.erg === 'sieg') aus.push([p.par ? t('p-punkte.posten.verwertungPar', { par: p.par }) : t('p-punkte.posten.verwertung'), p.verwertung]);
  if (p.combo) aus.push([t('p-punkte.posten.combo', { n: p.maxSerie || 0 }), p.combo]);
  if (p.weste) aus.push([t('p-punkte.posten.weste'), p.weste]);
  if (e.erg === 'niederlage' && !p.kurz && !p.ergebnis) aus.push([t('p-punkte.posten.kampfgeistAb'), null]);
  return aus;
}

export function panelZeile({ name = t('p-punkte.tafel.allein'), best = 0, platz = null, beiTipp = null } = {}) {
  const k = el('button', 'pk-panel dr');
  k.type = 'button';
  k.dataset.paket = 'punkte';
  k.innerHTML = `<span class="pk-panel-symbol" aria-hidden="true">${icon('podest')}</span><span class="pk-panel-text"></span>`;
  const werte = { name, wert: zahlText(best), platz };
  k.querySelector('.pk-panel-text').textContent = t(platz != null ? 'p-punkte.panel.textPlatz' : 'p-punkte.panel.text', werte);
  k.setAttribute('aria-label', t(platz != null ? 'p-punkte.panel.labelPlatz' : 'p-punkte.panel.label', werte));
  if (typeof beiTipp === 'function') k.addEventListener('click', (ev) => { ev.stopPropagation(); beiTipp(); });
  return k;
}

export function wartezeile({ fehlt = false } = {}) {
  const z = el('div', 'pk-abr pk-wartet' + (fehlt ? '' : ' pk-schimmer'));
  z.dataset.zeile = 'punkte';
  z.dataset.paket = 'punkte';
  z.innerHTML = `<div class="pk-abr-knopf pk-statisch"><span class="pk-symbol" aria-hidden="true">${icon('podest')}</span>
    <span class="pk-abr-mitte"><span class="pk-label">${esc(t('p-punkte.label'))}</span><span class="pk-text"></span></span>
    <span class="pk-werte"><span class="pk-wert zahl">…</span></span></div>`;
  z.querySelector('.pk-text').textContent = t(fehlt ? 'p-punkte.warte.fehlt' : 'p-punkte.warte.rechnet');
  return z;
}

// Mini-Tafel: ueber dir, du, unter dir (die zuletzt ueberholte Zeile)
function miniHtml(mini) {
  return mini.map((r) => `<li class="pk-m-zeile${r.eigen ? ' ich' : ''}" data-rolle="${esc(r.rolle)}">`
    + `<span class="pk-m-platz zahl">${r.platz != null ? r.platz : ''}</span><span class="pk-m-name">${esc(r.name)}</span>`
    + `<span class="pk-m-wert zahl">${zahlText(r.w)}</span></li>`).join('');
}

// Ueberhol-Post (3.13): Vorschau des Texts mit Code, Kopieren oder Teilen-Blatt; nichts geht automatisch raus
async function kopiere(text, feld) {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* weiter mit der Auswahl */ }
  try {
    feld.focus();
    feld.select();
    return document.execCommand('copy');
  } catch (e) { return false; }
}

function zeigePost(box, post) {
  if (!box || !post) return;
  if (!box.hidden) { box.hidden = true; return; }
  let text = '';
  try { text = String(post.text() || ''); } catch (e) { text = ''; }
  box.hidden = false;
  box.innerHTML = `<p class="pk-klein">${esc(t('p-punkte.post.vorschau'))}</p>
    <textarea class="pk-post-text" rows="3" readonly></textarea>
    <div class="pk-d-knoepfe"><button class="knopf primaer pk-post-kopieren dr" type="button">${esc(t('p-punkte.kopieren'))}</button>
    ${typeof navigator !== 'undefined' && navigator.share ? `<button class="knopf pk-post-teilen dr" type="button">${esc(t('p-punkte.teilen'))}</button>` : ''}</div>
    <p class="pk-klein pk-post-meldung" role="status" aria-live="polite"></p>`;
  const feld = box.querySelector('.pk-post-text');
  feld.value = text;
  box.querySelector('.pk-post-kopieren').addEventListener('click', async (ev) => {
    ev.stopPropagation();
    const ok = await kopiere(text, feld);
    box.querySelector('.pk-post-meldung').textContent = t(ok ? 'p-punkte.post.kopiert' : 'p-punkte.post.kopierenNicht');
  });
  const teilen = box.querySelector('.pk-post-teilen');
  if (teilen) teilen.addEventListener('click', (ev) => { ev.stopPropagation(); navigator.share({ text }).catch(() => {}); });
  if (tempo() > 0) anim(box, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { d: 320, k: 'gleiten' });
}

export function abrechnungsZeile({ ergebnis: e, tafelName: name = t('p-punkte.tafel.allein'), schonGezeigt = false, merke = () => {}, mini = null,
  beiListe = null, post = null, stumm = false } = {}) {
  const z = el('div', 'pk-abr');
  z.dataset.zeile = 'punkte';
  z.dataset.paket = 'punkte';
  if (e.rekord) z.dataset.rekord = '1';
  if (e.aufstieg > 0) z.dataset.aufstieg = String(e.aufstieg);
  const id = 'pk-d-' + String(e.id).replace(/[^a-z0-9]/gi, '').slice(0, 20);
  const pfeil = e.aufstieg > 0 ? ` <b class="pk-pfeil">▲ ${e.aufstieg}</b>` : '';
  const zeigeMini = Array.isArray(mini) && mini.length >= 2 && e.aufstieg > 0;
  z.innerHTML = `
    <button class="pk-abr-knopf" type="button" aria-expanded="false" aria-controls="${id}">
      <span class="pk-symbol" aria-hidden="true">${icon('podest')}</span>
      <span class="pk-abr-mitte"><span class="pk-label">${esc(t('p-punkte.label'))}</span><span class="pk-text"><span class="pk-satz"></span>${pfeil}</span></span>
      <span class="pk-werte">${e.rekord && e.vorher != null ? `<s class="pk-alt zahl" aria-label="${esc(t('p-punkte.vorher', { wert: zahlText(e.vorher) }))}">${zahlText(e.vorher)}</s>` : ''}`
      + `<span class="pk-wert zahl" data-wert="${e.w}">${schonGezeigt ? zahlText(e.w) : '0'}</span></span>
    </button>
    ${zeigeMini ? `<ol class="pk-mini" aria-label="${esc(t('p-punkte.abr.mini'))}">${miniHtml(mini)}</ol>` : ''}
    <div class="pk-details" id="${id}" hidden><ul></ul><p class="pk-d-summe">`
      + `${mitHtml(e.tafel && e.bestwert != null ? 'p-punkte.abr.summeBest' : 'p-punkte.abr.summe', { name },
        { wert: `<b class="zahl">${zahlText(e.w)}</b>`, best: `<span class="zahl">${zahlText(e.bestwert)}</span>` })}</p>`
      + `<div class="pk-d-knoepfe">${e.tafel && typeof beiListe === 'function' ? `<button class="knopf pk-zur-liste dr" type="button">${esc(t('p-punkte.abr.zurListe'))}</button>` : ''}`
      + `${post && post.name && typeof post.text === 'function' ? `<button class="knopf pk-post dr" type="button">${esc(t('p-punkte.abr.post', { name: post.name }))}</button>` : ''}</div>`
      + '<div class="pk-post-box" hidden></div></div>';
  z.querySelector('.pk-satz').textContent = unterText(e, name);
  const ul = z.querySelector('.pk-details ul');
  for (const [text, wert] of posten(e)) {
    const li = el('li');
    li.innerHTML = `<span></span>${wert != null ? `<b class="zahl">${zahlText(wert)}</b>` : ''}`;
    li.firstChild.textContent = text;
    ul.append(li);
  }
  const knopf = z.querySelector('.pk-abr-knopf');
  const details = z.querySelector('.pk-details');
  knopf.addEventListener('click', () => {
    const offen = details.hidden;
    details.hidden = !offen;
    knopf.setAttribute('aria-expanded', offen ? 'true' : 'false');
    beende();
  });
  const liste = z.querySelector('.pk-zur-liste');
  if (liste) liste.addEventListener('click', (ev) => { ev.stopPropagation(); beiListe(); });
  const postKnopf = z.querySelector('.pk-post');
  if (postKnopf) postKnopf.addEventListener('click', (ev) => { ev.stopPropagation(); zeigePost(z.querySelector('.pk-post-box'), post); });

  const uhren = new Set();
  const spaeter = (fn, t) => { const u = setTimeout(() => { uhren.delete(u); fn(); }, Math.max(0, t)); uhren.add(u); return u; };
  const wertEl = z.querySelector('.pk-wert');
  let fertig = schonGezeigt;
  let rahmen = 0;
  if (schonGezeigt) z.dataset.fertig = '1';

  function endbild() {
    try { for (const a of z.getAnimations({ subtree: true })) a.cancel(); } catch (x) { /* aeltere Browser: egal */ }
    wertEl.textContent = zahlText(e.w);
    z.dataset.fertig = '1';
  }
  function beende() {
    if (fertig) return;
    fertig = true;
    for (const u of uhren) clearTimeout(u);
    uhren.clear();
    if (rahmen) cancelAnimationFrame(rahmen);
    endbild();
  }

  if (!schonGezeigt) {
    merke();
    spaeter(() => {
      const t0 = parseInt(z.style.getPropertyValue('--t'), 10) || 300;
      const f = tempo();
      // Klang: ein Rekord klingt (Datei "rekord"), Niederlagen ohne Rekord bleiben still (3.13); zeigt das Ergebnis den
      // grossen Moment, klingt er dort (stumm), hier nur das Klacken der ueberholten Zeilen
      const klingt = !stumm && (e.rekord || e.platz1 || e.aufstieg > 0);
      if (f === 0) {
        endbild();
        fertig = true;
        if (klingt) spaeter(() => { try { klang.spiele('rekord'); } catch (x) { /* still */ } }, t0);
        return;
      }
      const start = t0 + 200;
      // hochzaehlen (Text, kein Layout), hoechstens 1,2 s fuer den ganzen Moment (3.13)
      const dauer = 620 * f;
      spaeter(() => {
        const a = performance.now();
        const schritt = () => {
          const x = Math.min(1, (performance.now() - a) / dauer);
          const k = 1 - Math.pow(1 - x, 3);
          wertEl.textContent = zahlText(e.w * k);
          if (x < 1 && !fertig) rahmen = requestAnimationFrame(schritt);
        };
        rahmen = requestAnimationFrame(schritt);
      }, start);
      if (zeigeMini) {
        // deine Zeile gleitet an den ueberholten vorbei; die ueberholte rutscht eine Zeile tiefer
        const ich = z.querySelector('.pk-m-zeile.ich');
        const unten = z.querySelector('.pk-m-zeile[data-rolle="unter"]');
        if (ich && unten) {
          spaeter(() => {
            anim(ich, [{ transform: 'translateY(100%)' }, { transform: 'none' }], { d: 560, k: 'gleiten' });
            anim(unten, [{ transform: 'translateY(-100%)' }, { transform: 'none' }], { d: 560, k: 'gleiten' });
          }, start);
          const n = Math.min(4, e.aufstieg);
          for (let i = 0; i < n; i++) spaeter(() => { try { klang.spiele('klick'); } catch (x) { /* still */ } }, start + 140 + i * 110 * f);
        }
      }
      if (klingt) spaeter(() => { try { klang.spiele('rekord'); } catch (x) { /* still */ } }, start + dauer);
      spaeter(() => { fertig = true; endbild(); }, start + dauer + 80);
    }, 0);
  }
  return {
    el: z,
    beende,
    verlasse() {
      for (const u of uhren) clearTimeout(u);
      uhren.clear();
      if (rahmen) cancelAnimationFrame(rahmen);
    },
  };
}
