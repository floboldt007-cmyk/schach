// Duell-Intro (Premium-Umbau U5, PLAN 2.3, Entwurf A "Duell-Buehne"): die Ueberlagerung zwischen "Spielen" in der
// Arena und der Partie. Bot-Haelfte in Bot-Farbe waechst aus der Detail-Karte, Flos Haelfte (Schiefer, sein Koenig)
// schiebt sich mit schraeger Naht herein (Hochformat: waagrecht), "gegen" schlaegt auf der Naht ein (genau dann der
// Start-Klang), Haltephase, dann fliegen beide Portraets an ihren Platz in der Partie. Optik: css/duell.css.
//
//   duellArt({ einstellung, anlass, reduziert }) -> 'voll' | 'kurz' | 'aus'
//       einstellung = duellIntro aus den Einstellungen ('immer' | 'besondere' | 'aus', Flo D3), anlass = 'boss' |
//       'liga' | 'erste' | null (erste Partie gegen diesen Bot), reduziert = bewegung.js reduziert().
//       'aus' bei reduzierter Bewegung oder Einstellung aus (kein Intro, nur Start-Klang); 'voll' bei 'immer' oder bei
//       'besondere' mit besonderem Anlass; sonst 'kurz' (0,4 s, nur der Portraetflug: Bot von seiner Station, Flo von
//       seiner Figur auf der Karte in die Spielerleisten).
//   spieleDuell({ bot, farbe, anlass, von, art?, einstellung? }) -> { bereit: Promise, fertig: Promise, ueberspringe(), art }
//       bot aus bots.js, farbe Flos Farbe ('w' | 'b'), von das Element, aus dem die Buehne waechst (Portraet der
//       Detail-Karte oder die Station; die Buehne nimmt die umgebende .detail, wenn es sie gibt). art kommt sonst aus
//       duellArt(). bereit erfuellt sich, sobald die Buehne den ganzen Schirm deckt (ihre Animation ist fertig,
//       fruehestens WECHSEL_BEI, 0,47 s; arena.js ruft
//       dann app.gehe('partie'), die Partie baut sich unter der Buehne auf), bei 'kurz' und 'aus' sofort. Die Portraets
//       fliegen, sobald die Partie da ist, fruehestens am Ende der Haltephase (HALTE_BIS, 0,82 s), so bleibt dem Flug
//       seine volle Dauer. fertig erfuellt sich am Ende (auch beim Ueberspringen), hoechstens DAUER_MAX ms nach dem Start.
//       Tippen ueberspringt immer: solange nur die Arena darunter liegt, faengt die Buehne den Tipp ab; ist die Partie
//       da (und in der Kurzfassung), geht der Tipp zusaetzlich an die Partie durch.
//       Tempo: die Vollfassung laeuft hoechstens im normalen Tempo (Bewegung "langsam" dehnt sie nicht, sie muss in
//       1,4 s passen), "schnell" verkuerzt sie.
//   aktivesDuell() -> { fertig } | null     laeuft gerade ein Intro (fuer die Partie: Uhr und Bot-Zug erst danach)
//
// Vertrag mit der Partie (U7 baut die andere Seite): solange das Intro laeuft, steht
// document.documentElement.dataset.duell = 'laeuft'; beim Ende (auch beim Ueberspringen) wird das Attribut entfernt
// und document.dispatchEvent(new CustomEvent('duell:fertig', { detail: { art, uebersprungen } })) gesendet. Bei 'aus'
// laeuft nichts: kein Attribut, kein Ereignis, aktivesDuell() ist null.
// Die Ueberlagerung haengt an document.body (ausserhalb #app), wartet auf das Ereignis app:screen mit name 'partie'
// (js/ereignisse.js) und fliegt die Portraets auf .screen.partie .spieler.gegner .av und .screen.partie .spieler.ich .av;
// fehlen die Ziele (heutiger Partie-Screen), blendet sie nur aus. Tippen ueberspringt. Nur transform und opacity werden
// bewegt (bewegung.js anim mit Tempo). Im Testmodus (?test) protokolliert window.__duellProtokoll jeden Lauf
// ({ art, anlass, bot, uebersprungen, ziele, dauer, wechsel, partieAb, flugAb, flug }: Zeiten in ms ab dem Start).
import { klang } from '../sounds.js';
import { hoere } from '../ereignisse.js';
import { anim, tempo } from '../bewegung.js';
import { botFarbe, avatarVon, floAvatar } from '../thema.js';
import { t } from '../sprache.js';
import '../sprachen/allgemein.js';
import '../sprachen/arena.js';

export const BESONDERE = Object.freeze(['boss', 'liga', 'erste']);
export const DAUER_MAX = 1400;          // haerteste Grenze fuer das ganze Intro (ms, unabhaengig vom Tempo)
const KURZ_DAUER = 400;                  // Kurzfassung: nur der Portraetflug
// Zeitplan der Vollfassung (ms bei normalem Tempo, mal Zeitfaktor zf = min(tempo(), 1)):
// Die Buehne waechst in 460 ms auf den ganzen Schirm. Ist ihre Animation fertig (fruehestens WECHSEL_BEI, spaetestens
// HALTE_BIS), erfuellt sich `bereit` und die Arena wechselt
// zur Partie, die sich unter der deckenden Buehne aufbaut, waehrend "gegen" einschlaegt und die Haltephase laeuft. Die
// Portraets fliegen, sobald die Partie da ist, fruehestens bei HALTE_BIS; so hat der Flug (FLUG) seine volle Dauer und
// das Intro endet vor der harten Grenze, auch wenn der Aufbau der Partie dauert (Pruefer-Befund U5: mit dem Wechsel
// erst am Ende der Haltephase blieben dem Flug 160 bis 215 ms).
export const WECHSEL_BEI = 470;
export const HALTE_BIS = 820;
export const FLUG = 440;
const FLUG_VERSATZ = 30;                 // Flos Portraet startet etwas spaeter
export const FLUG_MIN = 180;             // kuerzer lohnt kein Flug: dann blendet die Buehne nur aus
const PUFFER = 60;                       // Abstand zur harten Grenze: der Flug endet spaetestens DAUER_MAX - PUFFER ms
const jetzt = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const KLANG_BEI = 430;                   // "gegen" schlaegt ein: Start-Klang (ms * zf)
// Texte als Schluessel (Woerterbuecher allgemein und arena), gelesen beim Zeichnen
const FARBE_NAME = { w: 'allgemein.weiss', b: 'allgemein.schwarz' };
const ANLASS_TEXT = { boss: 'arena.duell.boss', liga: 'arena.duell.liga', erste: 'arena.duell.erste' };

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TEST = typeof location !== 'undefined' && /[?&]test\b/.test(location.search || '');

let aktiv = null;

export function duellArt({ einstellung = 'besondere', anlass = null, reduziert = false } = {}) {
  if (reduziert || einstellung === 'aus') return 'aus';
  if (einstellung === 'immer') return 'voll';
  return anlass && BESONDERE.includes(anlass) ? 'voll' : 'kurz';
}

export function aktivesDuell() {
  return aktiv ? { fertig: aktiv.fertig } : null;
}

function protokolliere(eintrag) {
  if (!TEST || typeof window === 'undefined') return;
  (window.__duellProtokoll = window.__duellProtokoll || []).push(eintrag);
}

const rect = (el) => {
  if (!el || typeof el.getBoundingClientRect !== 'function') return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
};
const imBild = (r) => !!r && r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0;
// Rechteck eines Elements, wenn es wirklich zu sehen ist: im Bild und, falls es in einem scrollenden Behaelter steht
// (die Karte der Arena), mit seiner Mitte in dessen sichtbarem Ausschnitt; sonst null
function sichtbar(el) {
  const r = rect(el);
  if (!imBild(r)) return null;
  const huelle = el.closest ? el.closest('.karte') : null;
  const h = huelle ? rect(huelle) : null;
  const mx = r.left + r.width / 2;
  const my = r.top + r.height / 2;
  if (h && (mx < h.left || mx > h.right || my < h.top || my > h.bottom)) return null;
  return r;
}

// Schwarzer oder weisser Text auf der Bot-Farbe (Kontrast nach WCAG, aus der gerechneten Hintergrundfarbe)
function hellerText(el) {
  let rgb = null;
  try { rgb = getComputedStyle(el).backgroundColor.match(/[\d.]+/g); } catch (e) { rgb = null; }
  if (!rgb || rgb.length < 3) return true;
  const l = (x) => { const c = Number(x) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const L = 0.2126 * l(rgb[0]) + 0.7152 * l(rgb[1]) + 0.0722 * l(rgb[2]);
  return 1.05 / (L + 0.05) >= 4.5;
}

// FLIP: ein Element fliegt von einer fremden Stelle an seinen eigenen Platz (nur transform)
function flip(el, von, { d = 560, v = 0, k = 'weich' } = {}) {
  const ziel = rect(el);
  if (!von || !ziel || !ziel.width) return;
  const s = von.width / ziel.width;
  // die Formel rechnet von der linken oberen Ecke aus (wie flieger()); mit dem Standard "center" laege der Start
  // daneben (Pruefer-Befund U5: 48 px)
  el.style.transformOrigin = '0 0';
  anim(el, [{ transform: `translate(${(von.left - ziel.left).toFixed(1)}px, ${(von.top - ziel.top).toFixed(1)}px) scale(${s.toFixed(4)})` }, { transform: 'none' }], { d, v, k });
}

// Flieger: eine Kopie des Portraets reist von einem Rechteck zum anderen (an document.body, ueber allem)
function flieger(html, von, nach, { d = 440, v = 0, k = 'weich', rund = true } = {}) {
  const el = document.createElement('div');
  el.className = 'duell-flieger' + (rund ? ' rund' : '');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = html;
  Object.assign(el.style, { left: nach.left + 'px', top: nach.top + 'px', width: nach.width + 'px', height: nach.height + 'px' });
  document.body.append(el);
  const sx = von.width / nach.width;
  const sy = von.height / nach.height;
  const a = anim(el, [{ transform: `translate(${(von.left - nach.left).toFixed(1)}px, ${(von.top - nach.top).toFixed(1)}px) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})` }, { transform: 'none' }], { d, v, k });
  return { el, a };
}

export function spieleDuell({ bot, farbe = 'w', anlass = null, von = null, art = null, einstellung = 'besondere' } = {}) {
  const f = farbe === 'b' ? 'b' : 'w';
  const gewaehlteArt = ['voll', 'kurz', 'aus'].includes(art) ? art : duellArt({ einstellung, anlass, reduziert: tempo() === 0 });
  const t0 = jetzt();
  // Zeitfaktor: hoechstens normales Tempo (das Intro muss in DAUER_MAX passen). A() bewegt mit diesem Faktor statt mit
  // tempo() (anim rechnet selbst mit tempo(), daher der Ausgleich tk); absolut() rechnet absolute ms fuer anim um.
  const zf = Math.min(Math.max(tempo(), 0), 1);
  const tk = tempo() > 0 ? zf / tempo() : 0;
  const A = (el, frames, o = {}) => anim(el, frames, { ...o, d: (o.d ?? 320) * tk, v: (o.v ?? 0) * tk });
  const absolut = (x) => x / Math.max(tempo(), 0.01);

  // 'aus': kein Intro, nur der Start-Klang (Klang ist keine Bewegung)
  if (gewaehlteArt === 'aus' || !bot || typeof document === 'undefined') {
    try { klang.spiele('start'); } catch (e) { /* still */ }
    protokolliere({ art: 'aus', anlass, bot: bot ? bot.id : null, uebersprungen: false, ziele: 0, dauer: 0, wechsel: 0, partieAb: null, flugAb: null, flug: 0 });
    const sofort = Promise.resolve();
    return { bereit: sofort, fertig: sofort, ueberspringe() {}, art: 'aus' };
  }

  // Quellen fuer den Portraetflug der Kurzfassung, solange die Arena noch steht (beim Flug ist sie schon durch die
  // Partie ersetzt): die Station des Bots auf der Karte ("von der Stufe", PLAN 2.3) und Flos Figur auf dem Pfad; sind
  // sie nicht zu sehen, das Portraet der Detail-Karte (von) bzw. der Pfeil des Spielen-Knopfs
  const station = [...document.querySelectorAll('.screen.arena .knoten')].find((k) => k.dataset.bot === bot.id);
  const quelleBot = sichtbar(station && station.querySelector('.avatar')) || sichtbar(von);
  const quelleFlo = sichtbar(document.querySelector('.screen.arena .flo-figur')) || sichtbar(document.querySelector('.screen.arena .detail .spielen .pf'));

  // ein laufendes Intro (Doppeltipp) zuerst beenden
  if (aktiv) aktiv.ueberspringe();

  let bereitLoes = null;
  let fertigLoes = null;
  const bereit = new Promise((r) => { bereitLoes = r; });
  const fertig = new Promise((r) => { fertigLoes = r; });
  const uhren = new Set();
  const spaeter = (fn, ms) => { const u = setTimeout(() => { uhren.delete(u); fn(); }, Math.max(0, ms)); uhren.add(u); return u; };
  let zuEnde = false;
  let uebersprungen = false;
  let abPartie = null;
  let wechsel = null;      // wann sich `bereit` erfuellt hat (ms ab Start)
  let partieAb = null;     // wann die Partie da war (app:screen partie)
  let flugAb = null;       // wann der Portraetflug begann
  let flugDauer = 0;
  const flieg = [];
  const versteckt = [];
  const html = document.documentElement;
  html.dataset.duell = 'laeuft';

  const bf = botFarbe(bot);
  const voll = gewaehlteArt === 'voll';
  const ueber = document.createElement('div');
  ueber.className = 'duell' + (voll ? ' voll' : ' kurz');
  ueber.dataset.art = gewaehlteArt;
  ueber.dataset.bot = bot.id;
  if (anlass) ueber.dataset.anlass = anlass;
  ueber.style.setProperty('--bf', bf);
  ueber.setAttribute('role', voll ? 'dialog' : 'presentation');
  ueber.tabIndex = -1;
  if (voll) ueber.setAttribute('aria-label', t('arena.duell.aria', { name: bot.name }));
  const stufeText = bot.stufe ? t('arena.duell.stufe', { stufe: bot.stufe }) : '';
  const anlassText = ANLASS_TEXT[anlass] ? t(ANLASS_TEXT[anlass]) : '';
  if (voll) {
    ueber.innerHTML = `
      <div class="duell-buehne"></div>
      <div class="duell-flo"><i></i><span class="naht"></span></div>
      <div class="duell-inhalt">
        <div class="duell-paar">
          <div class="duell-seite bot">
            <div class="duell-av" data-rolle="bot"><img src="${esc(avatarVon(bot))}" alt="" draggable="false"></div>
            <div class="duell-name">${esc(bot.name)}</div>
            <div class="duell-unter">Elo ${esc(bot.elo)} · ${esc(t(FARBE_NAME[f === 'w' ? 'b' : 'w']))}</div>
          </div>
          <div class="duell-gegen">${esc(t('arena.duell.gegen'))}</div>
          <div class="duell-seite flo">
            <div class="duell-av" data-rolle="flo">${floAvatar(f)}</div>
            <div class="duell-name">Flo</div>
            <div class="duell-unter">${esc(t(FARBE_NAME[f]))}</div>
          </div>
        </div>
      </div>
      ${stufeText || anlassText ? `<div class="duell-oben"><span class="duell-chip">${esc([stufeText, anlassText].filter(Boolean).join(' · '))}</span></div>` : ''}
      <div class="duell-tipp">${esc(t('arena.duell.tipp'))}</div>`;
  } else {
    // Kurzfassung: nur eine unsichtbare Huelle (Tipps gehen durch und beenden das Intro); die Portraets fliegen aus der Arena
    ueber.innerHTML = '';
  }
  document.body.append(ueber);
  // Sicherheitsnetz fuer langsame Geraete: blockiert der Aufbau der Partie den Hauptfaden, kann die harte Grenze (ein
  // Timer) nicht rechtzeitig feuern; die Ueberlagerung ist dann trotzdem zur harten Grenze ausgeblendet (Opazitaet
  // laeuft im Compositor). Absolute Zeit: anim() rechnet mit Tempo, deshalb durch tempo() geteilt.
  anim(ueber, [{ opacity: 1 }, { opacity: 1, offset: (DAUER_MAX - 160) / DAUER_MAX }, { opacity: 0 }], { d: absolut(DAUER_MAX), k: 'linear', fill: 'forwards' });
  const meldeBereit = () => { if (wechsel == null) wechsel = Math.round(jetzt() - t0); bereitLoes(); };

  const zeigeZiele = () => {
    for (const z of versteckt) { try { z.style.visibility = ''; } catch (e) { /* egal */ } }
    versteckt.length = 0;
  };
  const ende = () => {
    if (zuEnde) return;
    zuEnde = true;
    for (const u of uhren) clearTimeout(u);
    uhren.clear();
    if (abPartie) { try { abPartie(); } catch (e) { /* egal */ } abPartie = null; }
    for (const fl of flieg) { try { fl.el.remove(); } catch (e) { /* egal */ } }
    flieg.length = 0;
    zeigeZiele();
    try { ueber.remove(); } catch (e) { /* egal */ }
    try { document.removeEventListener('pointerdown', tipp, true); } catch (e) { /* egal */ }
    if (aktiv && aktiv.ueber === ueber) aktiv = null;
    if (html.dataset.duell === 'laeuft' && !aktiv) delete html.dataset.duell;
    const dauer = Math.round(jetzt() - t0);
    protokolliere({ art: gewaehlteArt, anlass, bot: bot.id, uebersprungen, ziele: zieleZahl, dauer, wechsel, partieAb, flugAb, flug: Math.round(flugDauer) });
    meldeBereit();
    fertigLoes();
    try { document.dispatchEvent(new CustomEvent('duell:fertig', { detail: { art: gewaehlteArt, uebersprungen, bot: bot.id } })); } catch (e) { /* egal */ }
  };
  let zieleZahl = 0;

  const ueberspringe = () => {
    if (zuEnde) return;
    uebersprungen = true;
    // laufende Bewegungen sofort zu Ende, dann alles weg
    try { for (const a of ueber.getAnimations({ subtree: true })) a.finish(); } catch (e) { /* egal */ }
    for (const fl of flieg) { try { fl.a.finish(); } catch (e) { /* egal */ } }
    ende();
  };
  // Tippen ueberspringt, in jeder Phase. Solange nur die Arena unter der Buehne liegt, faengt die Ueberlagerung den Tipp
  // ab (die Arena bekommt ihn nicht). Ist die Partie da (Klasse .durch) und in der Kurzfassung liegt sie mit
  // pointer-events: none darueber: der Tipp beendet das Intro und kommt zusaetzlich bei der Partie an (z. B. der erste
  // Tipp aufs Brett, tests/app.test.mjs tippt direkt nach "bereit" der Partie).
  const tipp = () => ueberspringe();
  document.addEventListener('pointerdown', tipp, { capture: true, passive: true });
  ueber.addEventListener('click', ueberspringe);
  ueber.addEventListener('keydown', (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') ueberspringe(); });
  aktiv = { ueber, fertig, ueberspringe };

  // Phase 2: die Portraets fliegen an ihren Platz in der Partie (oder die Ueberlagerung blendet nur aus)
  let phase2Lief = false;
  const phase2 = () => {
    if (zuEnde || phase2Lief) return;
    phase2Lief = true;
    ueber.classList.add('phase-2', 'durch');
    const partie = document.querySelector('.screen.partie');
    const zielBot = partie ? partie.querySelector('.spieler.gegner .av') : null;
    const zielFlo = partie ? partie.querySelector('.spieler.ich .av') : null;
    const ziele = [zielBot, zielFlo].filter((z) => z && imBild(rect(z)));
    zieleZahl = ziele.length;
    // Flugdauer (absolute ms): wie im Entwurf, aber so gekuerzt, dass das Intro vor der harten Grenze endet; reicht die
    // Zeit nicht fuer FLUG_MIN (Partie kam sehr spaet), fliegt nichts und die Buehne blendet nur aus
    const rest = DAUER_MAX - PUFFER - (jetzt() - t0);
    const versatz = FLUG_VERSATZ * zf;
    const moeglich = Math.min((voll ? FLUG : KURZ_DAUER) * zf, rest - versatz - 40);
    const fliegt = ziele.length > 0 && moeglich >= FLUG_MIN * zf;
    if (fliegt) {
      flugAb = Math.round(jetzt() - t0);
      flugDauer = moeglich;
      // Quellen: in der Vollfassung die Buehnen-Portraets, in der Kurzfassung Station und Flos Figur auf der Karte
      // (beim Start gemessen); fehlt eine Quelle, kommt das Portraet von knapp ueber seinem Ziel
      const qBot = voll ? rect(ueber.querySelector('[data-rolle="bot"]')) : quelleBot;
      const qFlo = voll ? rect(ueber.querySelector('[data-rolle="flo"]')) : quelleFlo;
      const bild = (ziel, quelle, inhalt, v, rolle) => {
        const nach = rect(ziel);
        const q = quelle || { left: nach.left, top: nach.top - 40, width: nach.width, height: nach.height };
        ziel.style.visibility = 'hidden';
        versteckt.push(ziel);
        flieg.push(flieger(inhalt, q, nach, { d: absolut(flugDauer), v: absolut(v), k: 'weich' }));
        // das Buehnen-Portraet weicht dem Flieger (sonst bleibt es und blendet mit dem Inhalt aus)
        const p = voll ? ueber.querySelector(`[data-rolle="${rolle}"]`) : null;
        if (p) p.style.opacity = '0';
      };
      if (zielBot && ziele.includes(zielBot)) bild(zielBot, qBot, `<img src="${esc(avatarVon(bot))}" alt="">`, 0, 'bot');
      if (zielFlo && ziele.includes(zielFlo)) bild(zielFlo, qFlo, floAvatar(f), versatz, 'flo');
    }
    if (voll) {
      A(ueber.querySelector('.duell-inhalt'), [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.98)' }], { d: 200, k: 'sanft', fill: 'forwards' });
      for (const e of ueber.querySelectorAll('.duell-oben, .duell-tipp')) A(e, [{ opacity: 1 }, { opacity: 0 }], { d: 160, k: 'sanft', fill: 'forwards' });
      A(ueber.querySelector('.duell-buehne'), [{ opacity: 1 }, { opacity: 0 }], { d: 380, v: 40, k: 'sanft', fill: 'forwards' });
      A(ueber.querySelector('.duell-flo'), [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: hoch() ? 'translateY(8%)' : 'translateX(8%)' }], { d: 360, k: 'sanft', fill: 'forwards' });
    }
    // Nachlauf bis zum Ende: Flug, sonst das Ausblenden der Buehne (hoechstens bis zur harten Grenze); ist keine Zeit
    // mehr, sofort (die Ueberlagerung ist dann ohnehin ueber die Sicherheits-Animation ausgeblendet)
    const nachlauf = fliegt ? flugDauer + versatz + 40 : (voll ? Math.min(420 * zf, rest) : 0);
    if (nachlauf > 12) spaeter(ende, nachlauf);
    else ende();
  };
  // Die Partie ist da (app:screen partie, nach `bereit`): ein Bild warten, damit sie ihr Layout hat (Ziele messbar).
  // Ab dann gehen Tipps zur Partie durch (.durch); die Portraets fliegen am Ende der Haltephase, oder sofort, wenn sie
  // schon vorbei ist
  const halteEnde = voll ? HALTE_BIS * zf : 0;
  const beiPartie = (d) => {
    if (!d || d.name !== 'partie' || zuEnde) return;
    if (abPartie) { try { abPartie(); } catch (e) { /* egal */ } abPartie = null; }
    partieAb = Math.round(jetzt() - t0);
    ueber.classList.add('durch');
    // kam die Partie so spaet, dass kein Flug mehr passt (langsames Geraet), nicht noch ein Bild warten
    if (DAUER_MAX - PUFFER - (jetzt() - t0) < (FLUG_MIN + FLUG_VERSATZ + 40) * zf) { phase2(); return; }
    requestAnimationFrame(() => {
      if (zuEnde) return;
      const warten = halteEnde - (jetzt() - t0);
      if (warten > 8) spaeter(phase2, warten);
      else phase2();
    });
  };
  try { abPartie = hoere('app:screen', beiPartie); } catch (e) { abPartie = null; }
  // haerteste Grenze: hoechstens DAUER_MAX ms, auch wenn die Partie nicht kommt
  spaeter(() => { if (!zuEnde) ende(); }, DAUER_MAX);

  const hoch = () => innerHeight > innerWidth;

  if (!voll) {
    // Kurzfassung: Start-Klang sofort, die Arena darf sofort zur Partie
    try { klang.spiele('start'); } catch (e) { /* still */ }
    meldeBereit();
    return { bereit, fertig, ueberspringe, art: gewaehlteArt };
  }

  // ---------- Vollfassung, Phase 1 ----------
  try { ueber.focus({ preventScroll: true }); } catch (e) { /* egal */ }
  const W = innerWidth;
  const H = innerHeight;
  const buehne = ueber.querySelector('.duell-buehne');
  const seiteBot = ueber.querySelector('.duell-seite.bot');
  seiteBot.classList.toggle('hell', hellerText(buehne));
  // Quelle der Buehne: die Detail-Karte um von (sonst von selbst, sonst die Mitte)
  const karte = von && von.closest ? (von.closest('.detail') || von) : null;
  let dr = karte ? rect(karte) : null;
  if (!imBild(dr)) dr = { left: W * 0.1, top: H * 0.3, right: W * 0.9, bottom: H * 0.7, width: W * 0.8, height: H * 0.4 };
  const bx = Math.max(0, dr.left);
  const by = Math.max(0, dr.top);
  const bw = Math.max(1, Math.min(W, dr.right) - bx);
  const bh = Math.max(1, Math.min(H, dr.bottom) - by);
  buehne.style.transformOrigin = '0 0';
  const buehneLauf = A(buehne, [{ transform: `translate(${bx.toFixed(1)}px, ${by.toFixed(1)}px) scale(${(bw / W).toFixed(4)}, ${(bh / H).toFixed(4)})`, opacity: 0 }, { opacity: 1, offset: 0.12 }, { transform: 'none', opacity: 1 }], { d: 460, k: 'gleiten' });
  A(ueber.querySelector('.duell-flo'), [{ transform: hoch() ? 'translateY(64%)' : 'translateX(64%)' }, { transform: 'none' }], { d: 480, v: 40, k: 'gleiten' });
  // beide Portraets fliegen von ihrer Quelle zur Mitte (Bot aus der Karte, Flo aus dem Pfeil des Spielen-Knopfs)
  const qBot = imBild(rect(von)) ? rect(von) : null;
  const pf = document.querySelector('.screen.arena .detail .spielen .pf');
  const qFlo = pf && imBild(rect(pf)) ? rect(pf) : { left: W - 80, top: H - 80, width: 36, height: 36 };
  flip(ueber.querySelector('[data-rolle="bot"]'), qBot, { d: 560 * tk, k: 'weich' });
  flip(ueber.querySelector('[data-rolle="flo"]'), qFlo, { d: 600 * tk, v: 40 * tk, k: 'weich' });
  ueber.querySelectorAll('.duell-name, .duell-unter').forEach((t, n) => A(t, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { d: 440, v: 220 + (n % 2) * 40 + (n > 1 ? 40 : 0), k: 'weich' }));
  // "gegen" schlaegt auf der Naht ein, genau dann der Start-Klang
  A(ueber.querySelector('.duell-gegen'), [{ opacity: 0, transform: 'scale(2.1) rotate(-10deg)' }, { opacity: 1, transform: 'none' }], { d: 460, v: 300, k: 'hupf' });
  spaeter(() => { try { klang.spiele('start'); } catch (e) { /* still */ } }, KLANG_BEI * zf);
  const oben = ueber.querySelector('.duell-oben');
  if (oben) A(oben, [{ opacity: 0, transform: 'translateY(-12px)' }, { opacity: 1, transform: 'none' }], { d: 440, v: 200, k: 'weich' });
  A(ueber.querySelector('.duell-tipp'), [{ opacity: 0 }, { opacity: 1 }], { d: 300, v: 420, k: 'sanft' });
  // Haltephase: beide Seiten treiben 11 px aufeinander zu
  const zu = (px) => (hoch() ? `translateY(${px}px)` : `translateX(${px}px)`);
  A(seiteBot, [{ transform: 'none' }, { transform: zu(11) }], { d: 900, v: 460, k: 'sanft', fill: 'forwards' });
  A(ueber.querySelector('.duell-seite.flo'), [{ transform: 'none' }, { transform: zu(-11) }], { d: 900, v: 460, k: 'sanft', fill: 'forwards' });
  // Die Buehne deckt den Schirm: die Arena darf zur Partie wechseln, die sich darunter aufbaut (die Buehne bleibt davor,
  // bis die Portraets geflogen sind); kommt die Partie nicht, stoesst die harte Grenze oben an. Gewechselt wird erst, wenn
  // die Animation der Buehne wirklich fertig ist (unter Last startet sie ein, zwei Bilder spaeter als ein Timer, die
  // Partie stuende dann kurz neben der noch wachsenden Buehne), und fruehestens bei WECHSEL_BEI. Sicherheitsnetz, falls
  // Animationen stehen (z. B. im Hintergrund): spaetestens am Ende der Haltephase.
  let gedeckt = false;
  let zeitDa = false;
  const wechsle = () => { if (gedeckt && zeitDa) meldeBereit(); };
  Promise.resolve(buehneLauf && buehneLauf.finished).catch(() => {}).then(() => { gedeckt = true; wechsle(); });
  spaeter(() => { zeitDa = true; wechsle(); }, WECHSEL_BEI * zf);
  spaeter(meldeBereit, HALTE_BIS * zf);

  return { bereit, fertig, ueberspringe, art: gewaehlteArt };
}
