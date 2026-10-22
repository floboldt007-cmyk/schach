// Duell-Intro (Premium-Umbau U5, PLAN 2.3, Entwurf A "Duell-Buehne"): die Ueberlagerung zwischen "Spielen" in der
// Arena und der Partie. Bot-Haelfte in Bot-Farbe waechst aus der Detail-Karte, Flos Haelfte (Schiefer, sein Koenig)
// schiebt sich mit schraeger Naht herein (Hochformat: waagrecht), "gegen" schlaegt auf der Naht ein (genau dann der
// Start-Klang), Haltephase, dann fliegen beide Portraets an ihren Platz in der Partie. Optik: css/duell.css.
//
//   duellArt({ einstellung, anlass, reduziert }) -> 'voll' | 'kurz' | 'aus'
//       einstellung = duellIntro aus den Einstellungen ('immer' | 'besondere' | 'aus', Flo D3), anlass = 'boss' |
//       'liga' | 'erste' | null (erste Partie gegen diesen Bot), reduziert = bewegung.js reduziert().
//       'aus' bei reduzierter Bewegung oder Einstellung aus (kein Intro, nur Start-Klang); 'voll' bei 'immer' oder bei
//       'besondere' mit besonderem Anlass; sonst 'kurz' (0,4 s, nur der Portraetflug).
//   spieleDuell({ bot, farbe, anlass, von, art?, einstellung? }) -> { bereit: Promise, fertig: Promise, ueberspringe(), art }
//       bot aus bots.js, farbe Flos Farbe ('w' | 'b'), von das Element, aus dem die Buehne waechst (Portraet der
//       Detail-Karte oder die Station; die Buehne nimmt die umgebende .detail, wenn es sie gibt). art kommt sonst aus
//       duellArt(). bereit erfuellt sich am Ende der Haltephase (0,76 s; arena.js ruft dann app.gehe('partie'), die
//       Portraets fliegen, sobald die Partie da ist), bei 'kurz' und 'aus' sofort. fertig erfuellt sich am Ende (auch
//       beim Ueberspringen), hoechstens DAUER_MAX ms nach dem Start. Tippen ueberspringt die Vollfassung, solange die
//       Buehne steht; waehrend des Portraetflugs (Buehne loest sich auf) und in der Kurzfassung gehen Tipps durch.
//   aktivesDuell() -> { fertig } | null     laeuft gerade ein Intro (fuer die Partie: Uhr und Bot-Zug erst danach)
//
// Vertrag mit der Partie (U7 baut die andere Seite): solange das Intro laeuft, steht
// document.documentElement.dataset.duell = 'laeuft'; beim Ende (auch beim Ueberspringen) wird das Attribut entfernt
// und document.dispatchEvent(new CustomEvent('duell:fertig', { detail: { art, uebersprungen } })) gesendet. Bei 'aus'
// laeuft nichts: kein Attribut, kein Ereignis, aktivesDuell() ist null.
// Die Ueberlagerung haengt an document.body (ausserhalb #app), wartet auf das Ereignis app:screen mit name 'partie'
// (js/ereignisse.js) und fliegt die Portraets auf .screen.partie .spieler.gegner .av und .screen.partie .spieler.ich .av;
// fehlen die Ziele (heutiger Partie-Screen), blendet sie nur aus. Tippen ueberspringt. Nur transform und opacity werden
// bewegt (bewegung.js anim mit Tempo). Im Testmodus (?test) protokolliert window.__duellProtokoll jeden Lauf.
import { klang } from '../sounds.js';
import { hoere } from '../ereignisse.js';
import { anim, tempo } from '../bewegung.js';
import { botFarbe, avatarVon, floAvatar } from '../thema.js';

export const BESONDERE = Object.freeze(['boss', 'liga', 'erste']);
export const DAUER_MAX = 1400;          // haerteste Grenze fuer das ganze Intro (ms, unabhaengig vom Tempo)
const KURZ_DAUER = 400;                  // Kurzfassung: nur der Portraetflug
// Ende der Haltephase (ms * Tempo): erst dann erfuellt sich `bereit`, die Arena wechselt zur Partie, und sobald
// app:screen partie kommt, fliegen die Portraets (Phase 2). Die Partie steht also nie laenger als den Flug unter der
// Buehne, und waehrend des Flugs (die Buehne loest sich auf) faengt die Ueberlagerung keine Tipps mehr ab: ein Tipp
// aufs Brett kommt an (tests/app.test.mjs tippt direkt nach "bereit" der Partie).
const HALTE_BIS = 760;
const PUFFER = 60;                       // Abstand zur harten Grenze: der Flug endet spaetestens DAUER_MAX - PUFFER ms
const jetzt = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const KLANG_BEI = 430;                   // "gegen" schlaegt ein: Start-Klang (ms * Tempo)
const FARBE_NAME = { w: 'Weiß', b: 'Schwarz' };
const ANLASS_TEXT = { boss: 'Endgegner', liga: 'Liga', erste: 'Erste Partie' };

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
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  // 'aus': kein Intro, nur der Start-Klang (Klang ist keine Bewegung)
  if (gewaehlteArt === 'aus' || !bot || typeof document === 'undefined') {
    try { klang.spiele('start'); } catch (e) { /* still */ }
    protokolliere({ art: 'aus', anlass, bot: bot ? bot.id : null, uebersprungen: false, ziele: 0, dauer: 0 });
    const sofort = Promise.resolve();
    return { bereit: sofort, fertig: sofort, ueberspringe() {}, art: 'aus' };
  }

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
  if (voll) ueber.setAttribute('aria-label', `Duell gegen ${bot.name}`);
  const stufeText = bot.stufe ? `Stufe ${bot.stufe}` : '';
  const anlassText = ANLASS_TEXT[anlass] || '';
  if (voll) {
    ueber.innerHTML = `
      <div class="duell-buehne"></div>
      <div class="duell-flo"><i></i><span class="naht"></span></div>
      <div class="duell-inhalt">
        <div class="duell-paar">
          <div class="duell-seite bot">
            <div class="duell-av" data-rolle="bot"><img src="${esc(avatarVon(bot))}" alt="" draggable="false"></div>
            <div class="duell-name">${esc(bot.name)}</div>
            <div class="duell-unter">Elo ${esc(bot.elo)} · ${FARBE_NAME[f === 'w' ? 'b' : 'w']}</div>
          </div>
          <div class="duell-gegen">gegen</div>
          <div class="duell-seite flo">
            <div class="duell-av" data-rolle="flo">${floAvatar(f)}</div>
            <div class="duell-name">Flo</div>
            <div class="duell-unter">${FARBE_NAME[f]}</div>
          </div>
        </div>
      </div>
      ${stufeText || anlassText ? `<div class="duell-oben"><span class="duell-chip">${esc([stufeText, anlassText].filter(Boolean).join(' · '))}</span></div>` : ''}
      <div class="duell-tipp">Tippen zum Überspringen</div>`;
  } else {
    // Kurzfassung: nur eine unsichtbare Huelle, die das Tippen auffaengt; die Portraets fliegen aus der Arena
    ueber.innerHTML = '';
  }
  document.body.append(ueber);

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
    if (aktiv && aktiv.ueber === ueber) aktiv = null;
    if (html.dataset.duell === 'laeuft' && !aktiv) delete html.dataset.duell;
    const dauer = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
    protokolliere({ art: gewaehlteArt, anlass, bot: bot.id, uebersprungen, ziele: zieleZahl, dauer });
    bereitLoes();
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
  // Tippen ueberspringt (nur die Vollfassung faengt Tipps ab; die Kurzfassung liegt mit pointer-events: none darueber)
  ueber.addEventListener('pointerdown', ueberspringe, { passive: true });
  ueber.addEventListener('click', ueberspringe);
  ueber.addEventListener('keydown', (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') ueberspringe(); });
  aktiv = { ueber, fertig, ueberspringe };

  // Phase 2: die Portraets fliegen an ihren Platz in der Partie (oder die Ueberlagerung blendet nur aus)
  let phase2Lief = false;
  const phase2 = () => {
    if (zuEnde || phase2Lief) return;
    phase2Lief = true;
    ueber.classList.add('phase-2');   // ab jetzt gehen Tipps durch (css/duell.css: pointer-events: none)
    const partie = document.querySelector('.screen.partie');
    const zielBot = partie ? partie.querySelector('.spieler.gegner .av') : null;
    const zielFlo = partie ? partie.querySelector('.spieler.ich .av') : null;
    const ziele = [zielBot, zielFlo].filter((z) => z && imBild(rect(z)));
    zieleZahl = ziele.length;
    // Flugdauer (ms, schon mit Tempo): wie im Entwurf, aber so gekuerzt, dass das Intro vor der harten Grenze endet
    // (die Partie braucht je nach Geraet unterschiedlich lange zum Aufbau)
    const rest = DAUER_MAX - PUFFER - (jetzt() - t0);
    const dauerFlug = Math.max(160, Math.min((voll ? 440 : KURZ_DAUER) * tempo(), rest - 40));
    if (ziele.length) {
      // Quellen: in der Vollfassung die Buehnen-Portraets, in der Kurzfassung das Portraet der Arena (von)
      const qBot = voll ? rect(ueber.querySelector('[data-rolle="bot"]')) : (imBild(rect(von)) ? rect(von) : null);
      const qFlo = voll ? rect(ueber.querySelector('[data-rolle="flo"]')) : null;
      const bild = (ziel, quelle, inhalt, v, rolle) => {
        const nach = rect(ziel);
        const q = quelle || { left: nach.left, top: nach.top - 40, width: nach.width, height: nach.height };
        ziel.style.visibility = 'hidden';
        versteckt.push(ziel);
        flieg.push(flieger(inhalt, q, nach, { d: dauerFlug / Math.max(tempo(), 0.01), v, k: 'weich' }));
        // das Buehnen-Portraet weicht dem Flieger (sonst bleibt es und blendet mit dem Inhalt aus)
        const p = voll ? ueber.querySelector(`[data-rolle="${rolle}"]`) : null;
        if (p) p.style.opacity = '0';
      };
      if (zielBot && ziele.includes(zielBot)) bild(zielBot, qBot, `<img src="${esc(avatarVon(bot))}" alt="">`, 0, 'bot');
      if (zielFlo && ziele.includes(zielFlo)) bild(zielFlo, qFlo, floAvatar(f), 30, 'flo');
    }
    if (voll) {
      anim(ueber.querySelector('.duell-inhalt'), [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.98)' }], { d: 200, k: 'sanft', fill: 'forwards' });
      for (const e of ueber.querySelectorAll('.duell-oben, .duell-tipp')) anim(e, [{ opacity: 1 }, { opacity: 0 }], { d: 160, k: 'sanft', fill: 'forwards' });
      anim(ueber.querySelector('.duell-buehne'), [{ opacity: 1 }, { opacity: 0 }], { d: 380, v: 40, k: 'sanft', fill: 'forwards' });
      anim(ueber.querySelector('.duell-flo'), [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: hoch() ? 'translateY(8%)' : 'translateX(8%)' }], { d: 360, k: 'sanft', fill: 'forwards' });
    }
    spaeter(ende, ziele.length ? dauerFlug + 40 : (voll ? Math.min(380 * tempo(), Math.max(0, rest)) : 0));
  };
  // Die Partie ist da (app:screen partie, nach `bereit`): ein Bild warten, damit sie ihr Layout hat (Ziele messbar),
  // dann Phase 2
  const beiPartie = (d) => {
    if (!d || d.name !== 'partie' || zuEnde) return;
    if (abPartie) { try { abPartie(); } catch (e) { /* egal */ } abPartie = null; }
    requestAnimationFrame(() => { if (!zuEnde) phase2(); });
  };
  try { abPartie = hoere('app:screen', beiPartie); } catch (e) { abPartie = null; }
  // haerteste Grenze: hoechstens DAUER_MAX ms, auch wenn die Partie nicht kommt
  spaeter(() => { if (!zuEnde) { if (!phase2Lief) phase2(); spaeter(ende, 0); } }, DAUER_MAX);

  const hoch = () => innerHeight > innerWidth;

  if (!voll) {
    // Kurzfassung: Start-Klang sofort, die Arena darf sofort zur Partie
    try { klang.spiele('start'); } catch (e) { /* still */ }
    bereitLoes();
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
  anim(buehne, [{ transform: `translate(${bx.toFixed(1)}px, ${by.toFixed(1)}px) scale(${(bw / W).toFixed(4)}, ${(bh / H).toFixed(4)})`, opacity: 0 }, { opacity: 1, offset: 0.12 }, { transform: 'none', opacity: 1 }], { d: 460, k: 'gleiten' });
  anim(ueber.querySelector('.duell-flo'), [{ transform: hoch() ? 'translateY(64%)' : 'translateX(64%)' }, { transform: 'none' }], { d: 480, v: 40, k: 'gleiten' });
  // beide Portraets fliegen von ihrer Quelle zur Mitte (Bot aus der Karte, Flo aus dem Pfeil des Spielen-Knopfs)
  const qBot = imBild(rect(von)) ? rect(von) : null;
  const pf = document.querySelector('.screen.arena .detail .spielen .pf');
  const qFlo = pf && imBild(rect(pf)) ? rect(pf) : { left: W - 80, top: H - 80, width: 36, height: 36 };
  flip(ueber.querySelector('[data-rolle="bot"]'), qBot, { d: 560, k: 'weich' });
  flip(ueber.querySelector('[data-rolle="flo"]'), qFlo, { d: 600, v: 40, k: 'weich' });
  ueber.querySelectorAll('.duell-name, .duell-unter').forEach((t, n) => anim(t, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { d: 440, v: 220 + (n % 2) * 40 + (n > 1 ? 40 : 0), k: 'weich' }));
  // "gegen" schlaegt auf der Naht ein, genau dann der Start-Klang
  anim(ueber.querySelector('.duell-gegen'), [{ opacity: 0, transform: 'scale(2.1) rotate(-10deg)' }, { opacity: 1, transform: 'none' }], { d: 460, v: 300, k: 'hupf' });
  spaeter(() => { try { klang.spiele('start'); } catch (e) { /* still */ } }, KLANG_BEI * tempo());
  const oben = ueber.querySelector('.duell-oben');
  if (oben) anim(oben, [{ opacity: 0, transform: 'translateY(-12px)' }, { opacity: 1, transform: 'none' }], { d: 440, v: 200, k: 'weich' });
  anim(ueber.querySelector('.duell-tipp'), [{ opacity: 0 }, { opacity: 1 }], { d: 300, v: 420, k: 'sanft' });
  // Haltephase: beide Seiten treiben 11 px aufeinander zu
  const zu = (px) => (hoch() ? `translateY(${px}px)` : `translateX(${px}px)`);
  anim(seiteBot, [{ transform: 'none' }, { transform: zu(11) }], { d: 900, v: 460, k: 'sanft', fill: 'forwards' });
  anim(ueber.querySelector('.duell-seite.flo'), [{ transform: 'none' }, { transform: zu(-11) }], { d: 900, v: 460, k: 'sanft', fill: 'forwards' });
  // Ende der Haltephase: die Arena darf zur Partie wechseln (die Buehne bleibt davor, bis die Portraets geflogen sind);
  // kommt die Partie nicht, stoesst die harte Grenze oben an
  spaeter(() => bereitLoes(), HALTE_BIS * tempo());

  return { bereit, fertig, ueberspringe, art: gewaehlteArt };
}
