// Oberflaeche des Pakets punkte im Ergebnis (Look A, Klassen pk-*, Optik in css/pakete/punkte.css). Nur DOM, keine
// Buchungen: index.js liest das Ergebnis (stand.js) und reicht es herein. Bewegung nur ueber transform und opacity
// (js/bewegung.js: anim, tempo); bei reduzierter Bewegung oder Tempo 0 steht sofort das Endbild, der Klang bleibt.
//
//   zahlText(n) -> '21.300'
//   tafelName(tafelId, botNachId) -> 'Rudis Tafel' | 'Boss-Tafel Baron von Gambit / Meister' | 'Tafel'
//   unterText(ergebnis, name) -> Satz der Abrechnungszeile ("Platz 3 auf Rudis Tafel", "Rekord auf ...", ...)
//   abrechnungsZeile({ ergebnis, tafelName, schonGezeigt, merke, mini, beiListe, post }) -> { el, beende(), verlasse() }
//       div.pk-abr[data-zeile="punkte"]: "PUNKTE 21.300", darunter "Platz 3 auf Rudis Tafel ^ 2"; bei einem Rekord bleibt
//       der alte Wert durchgestrichen stehen (.pk-alt), der neue zaehlt hoch. Bei ueberholten Zeilen (^) eine Mini-Tafel mit
//       drei Zeilen (ueber dir, du, unter dir): deine Zeile gleitet nach oben, je ueberholter Zeile ein Klacken (Klang
//       "klick"). Antippen zeigt die Aufschluesselung und "Zur Bestenliste". data-fertig="1", sobald das Endbild steht.
//       post: { name, text() -> Text } (Ueberhol-Post, 3.13): in der Aufschluesselung einmal still "Ueberhol-Post an Jule";
//       Antippen zeigt den Text mit Code als Vorschau, verschickt wird nur von Hand (Kopieren oder Teilen-Blatt).
//   wartezeile({ fehlt }) -> HTMLElement   "Punkte werden gezaehlt ..." (Analyse rechnet noch, ruhiger Schimmer, endlich)
//       bzw. mit fehlt: "Punkte folgen mit der Analyse" (die Arena holt sie nach)
import { anim, tempo } from '../../bewegung.js';
import { klang } from '../../sounds.js';
import { icon } from '../../ui/icons.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const zahlText = (n) => Math.round(Number(n) || 0).toLocaleString('de-DE');

// Besitzform der Leiter-Bots ("Rudis Tafel"); andere Gegner heissen "Tafel: <Name>"
const BESITZ = {
  benno: 'Bennos', hilde: 'Hildes', kalle: 'Kalles', lisa: 'Lisas', rudi: 'Rudis', turm: 'Professor Turms', delia: 'Delias',
  koenig: 'Kommissar Königs', greta: 'Gretas', stockfisch: 'Stockfischs',
};
const STUFE_NAME = { standard: 'Standard', meister: 'Meister' };

export function tafelName(tafelId, botNachId = () => null) {
  const t = typeof tafelId === 'string' ? tafelId.split(':') : [];
  if (t[0] === 'bot') {
    if (BESITZ[t[1]]) return `${BESITZ[t[1]]} Tafel`;
    const b = botNachId(t[1]);
    return b && b.name ? `Tafel: ${b.name}` : 'Tafel';
  }
  if (t[0] === 'boss') {
    const b = botNachId(t[1]);
    return `Boss-Tafel ${b && b.name ? b.name : 'Wochen-Boss'} · ${STUFE_NAME[t[2]] || ''}`.trim();
  }
  return 'Tafel';
}

const GRUND = {
  hilfe: 'Ohne Tafel-Eintrag: Hinweis oder Zurücknehmen genutzt',
  frei: 'Freie Partie: zählt für keine Tafel',
  spiel: 'Spielhalle: eigene Tafeln kommen später',
  gast: 'Gast-Partie: zählt für keine Tafel',
  stellung: 'Eigene Stellung: zählt für keine Tafel',
};

export function unterText(e, name = 'Tafel') {
  if (!e) return '';
  if (!e.tafel) return GRUND[e.grund] || GRUND.gast;
  if (e.erster) return `Erster Eintrag auf ${name}`;
  // Platz gewonnen: "Platz 3 auf Rudis Tafel" (der Pfeil ^ 2 und die durchgestrichene alte Zahl stehen daneben)
  if (e.rekord && e.aufstieg > 0 && e.platz != null) return `Platz ${e.platz} auf ${name}`;
  if (e.rekord) return `Rekord auf ${name} · +${zahlText(e.w - (e.vorher || 0))}`;
  if (e.platz != null) return `Platz ${e.platz} auf ${name}`;
  if (e.wochenPlatz != null) return `Diese Woche: Platz ${e.wochenPlatz} auf ${name}`;
  if (e.fast) return `So nah wie noch nie: ${e.fast.prozent} % deines Rekords auf ${name}`;
  return `${name}: dein Bestwert ${zahlText(e.bestwert)}`;
}

function el(tag, klasse, html) {
  const x = document.createElement(tag);
  if (klasse) x.className = klasse;
  if (html != null) x.innerHTML = html;
  return x;
}

function posten(e) {
  const p = e.posten || {};
  const aus = [[`Züge (${p.offen || 0} offen)`, p.zugpunkte], ['Theorie', p.theorie]];
  if (p.kurz) aus.push(['Vor dem 10. eigenen Zug beendet: kein Ergebnis-Bonus', null]);
  else aus.push([{ sieg: 'Sieg', remis: 'Remis', niederlage: 'Kampfgeist' }[e.erg] || 'Ergebnis', p.ergebnis]);
  if (e.erg === 'sieg') aus.push([p.par ? `Verwertung (Par ${p.par})` : 'Verwertung', p.verwertung]);
  if (p.combo) aus.push([`COMBO-Zuschlag (längste Serie × ${p.maxSerie || 0})`, p.combo]);
  if (p.weste) aus.push(['Weiße Weste: Sieg ohne Daneben', p.weste]);
  if (e.erg === 'niederlage' && !p.kurz && !p.ergebnis) aus.push(['Kampfgeist gibt es ab dem 15. eigenen Zug', null]);
  return aus;
}

export function wartezeile({ fehlt = false } = {}) {
  const z = el('div', 'pk-abr pk-wartet' + (fehlt ? '' : ' pk-schimmer'));
  z.dataset.zeile = 'punkte';
  z.dataset.paket = 'punkte';
  z.innerHTML = `<div class="pk-abr-knopf pk-statisch"><span class="pk-symbol" aria-hidden="true">${icon('podest')}</span>
    <span class="pk-abr-mitte"><span class="pk-label">Punkte</span><span class="pk-text"></span></span>
    <span class="pk-werte"><span class="pk-wert zahl">…</span></span></div>`;
  z.querySelector('.pk-text').textContent = fehlt ? 'Punkte folgen mit der Analyse (die Arena rechnet sie nach).' : 'Punkte werden gezählt …';
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
  box.innerHTML = `<p class="pk-klein">Vorschau. Der Code enthält deine Züge, Datum, Seed und deinen Namen, falls du einen eingetragen hast.</p>
    <textarea class="pk-post-text" rows="3" readonly></textarea>
    <div class="pk-d-knoepfe"><button class="knopf primaer pk-post-kopieren dr" type="button">Kopieren</button>
    ${typeof navigator !== 'undefined' && navigator.share ? '<button class="knopf pk-post-teilen dr" type="button">Teilen …</button>' : ''}</div>
    <p class="pk-klein pk-post-meldung" role="status" aria-live="polite"></p>`;
  const feld = box.querySelector('.pk-post-text');
  feld.value = text;
  box.querySelector('.pk-post-kopieren').addEventListener('click', async (ev) => {
    ev.stopPropagation();
    const ok = await kopiere(text, feld);
    box.querySelector('.pk-post-meldung').textContent = ok ? 'Kopiert. Füge den Text in eine Nachricht ein.' : 'Kopieren ging nicht. Markiere den Text und kopiere ihn von Hand.';
  });
  const teilen = box.querySelector('.pk-post-teilen');
  if (teilen) teilen.addEventListener('click', (ev) => { ev.stopPropagation(); navigator.share({ text }).catch(() => {}); });
  if (tempo() > 0) anim(box, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { d: 320, k: 'gleiten' });
}

export function abrechnungsZeile({ ergebnis: e, tafelName: name = 'Tafel', schonGezeigt = false, merke = () => {}, mini = null,
  beiListe = null, post = null } = {}) {
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
      <span class="pk-abr-mitte"><span class="pk-label">Punkte</span><span class="pk-text"><span class="pk-satz"></span>${pfeil}</span></span>
      <span class="pk-werte">${e.rekord && e.vorher != null ? `<s class="pk-alt zahl" aria-label="vorher ${zahlText(e.vorher)}">${zahlText(e.vorher)}</s>` : ''}`
      + `<span class="pk-wert zahl" data-wert="${e.w}">${schonGezeigt ? zahlText(e.w) : '0'}</span></span>
    </button>
    ${zeigeMini ? `<ol class="pk-mini" aria-label="Ausschnitt der Tafel">${miniHtml(mini)}</ol>` : ''}
    <div class="pk-details" id="${id}" hidden><ul></ul><p class="pk-d-summe">Zusammen <b class="zahl">${zahlText(e.w)}</b> Punkte`
      + `${e.tafel && e.bestwert != null ? ` · dein Bestwert auf ${esc(name)}: <span class="zahl">${zahlText(e.bestwert)}</span>` : ''}</p>`
      + `<div class="pk-d-knoepfe">${e.tafel && typeof beiListe === 'function' ? '<button class="knopf pk-zur-liste dr" type="button">Zur Bestenliste</button>' : ''}`
      + `${post && post.name && typeof post.text === 'function' ? `<button class="knopf pk-post dr" type="button">Überhol-Post an ${esc(post.name)}</button>` : ''}</div>`
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
      // Klang: ein Rekord klingt (Datei "rekord"), Niederlagen ohne Rekord bleiben still (3.13)
      const klingt = e.rekord || e.platz1 || e.aufstieg > 0;
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
