// Bewegung der Schach-Arena (Premium-Umbau, PLAN 1.2 "Bewegung" und 4 "Animationstempo").
// Eine Sprache fuer alles: Federn fuer Dinge, die ankommen, Gleiten fuer Dinge, die reisen, nie linear.
//
//   TEMPI                      { langsam: 1.5, normal: 1, schnell: 0.6, aus: 0 }  (Einstellung `bewegung`)
//   setzeBewegung(stufe)       setzt die Stufe und --tempo am <html>; "weniger Bewegung" des Geraets wirkt wie 'aus'
//   bewegungStufe()            -> gewaehlte Stufe ('normal' ...)
//   tempo()                    -> Faktor fuer Dauern (0 bei 'aus' oder reduzierter Bewegung)
//   reduziert()                -> true, wenn Tempo 0 ist (Systemwunsch oder Einstellung)
//   taktFaktor(), takt(ms)     Pausen zum Mitlesen (Demo, Feier, Sterne): skalieren mit dem Tempo, nie unter 0.6
//   warte(ms, ohneTempo)       Promise nach ms * tempo()
//   federKurve(k, d)           -> { kurve: 'linear(...)', dauer: ms } (rein, Federmodell aus Entwurf A)
//   setzeFedern({ feder, weich, hupf })   [k, d] je Feder (aus dem Theme-Objekt); schreibt --feder, --feder-weich,
//                              --feder-hupf als linear(), wo der Browser das kann (Safari ab 17.2), sonst bleiben
//                              die cubic-bezier-Werte des Themes
//   KURVEN                     Namen -> CSS-Kurve fuer Web-Animationen (gleiten, sanft, raus, feder, weich, hupf)
//   anim(el, frames, o)        Web-Animation mit Tempo: o = { d, v, k, fill, it, dir }; bei Tempo 0 sofort am Ende
//   staffel(els, o)            gestaffelter Eintritt (o = { d, v, abstand, von, k }) -> Promise (ungefaehr am Ende)
//   starteDruck(wurzel)        einmalig: Druck-Rueckmeldung, jedes .dr bekommt beim Druecken .gedrueckt
//
// Nur DOM-frei rechnende Teile (federKurve, TEMPI) laufen in Node; alles andere prueft vorher, ob es document gibt.

export const TEMPI = Object.freeze({ langsam: 1.5, normal: 1, schnell: 0.6, aus: 0 });

const ERSATZ = Object.freeze({
  feder: 'cubic-bezier(.34,1.36,.64,1)',
  weich: 'cubic-bezier(.22,1.12,.36,1)',
  hupf: 'cubic-bezier(.34,1.7,.5,1)',
});

export const KURVEN = {
  gleiten: 'cubic-bezier(.16,1,.3,1)',
  sanft: 'cubic-bezier(.65,0,.35,1)',
  raus: 'cubic-bezier(.55,0,.8,.2)',
  linear: 'linear',
  feder: ERSATZ.feder,
  weich: ERSATZ.weich,
  hupf: ERSATZ.hupf,
};

let stufe = 'normal';
let mq = null;

function wurzel() {
  return typeof document !== 'undefined' ? document.documentElement : null;
}

function systemReduziert() {
  try {
    if (!mq && typeof matchMedia === 'function') {
      mq = matchMedia('(prefers-reduced-motion: reduce)');
      const neu = () => schreibeTempo();
      if (mq.addEventListener) mq.addEventListener('change', neu);
      else if (mq.addListener) mq.addListener(neu);
    }
    return !!(mq && mq.matches);
  } catch (e) {
    return false;
  }
}

export function tempo() {
  if (systemReduziert()) return 0;
  return TEMPI[stufe] ?? 1;
}

export function reduziert() {
  return tempo() === 0;
}

export function bewegungStufe() {
  return stufe;
}

function schreibeTempo() {
  const r = wurzel();
  if (!r) return;
  const t = tempo();
  r.style.setProperty('--tempo', String(t));
  r.dataset.bewegung = t === 0 ? 'aus' : stufe;
}

export function setzeBewegung(neu) {
  stufe = Object.prototype.hasOwnProperty.call(TEMPI, neu) ? neu : 'normal';
  schreibeTempo();
  return tempo();
}

export function taktFaktor() {
  return Math.max(tempo(), 0.6);
}

export function warte(ms, ohneTempo = false) {
  const dauer = ohneTempo ? ms : ms * tempo();
  return new Promise((r) => setTimeout(r, Math.max(0, dauer)));
}

export function takt(ms) {
  return warte(ms * taktFaktor(), true);
}

// Gedaempfte Feder (Masse 1) auf 1 zu, Schritt 1/1200 s; 45 Stuetzpunkte fuer CSS linear()
export function federKurve(k, d) {
  let x = 0;
  let v = 0;
  let t = 0;
  const dt = 1 / 1200;
  const werte = [];
  while (t < 2.5) {
    const a = -k * (x - 1) - d * v;
    v += a * dt;
    x += v * dt;
    t += dt;
    werte.push(x);
    if (t > 0.08 && Math.abs(x - 1) < 0.0008 && Math.abs(v) < 0.01) break;
  }
  const n = 44;
  const punkte = [];
  for (let i = 0; i <= n; i++) punkte.push(+werte[Math.min(werte.length - 1, Math.round((i / n) * (werte.length - 1)))].toFixed(4));
  punkte[0] = 0;
  punkte[n] = 1;
  return { kurve: `linear(${punkte.join(', ')})`, dauer: Math.round(t * 1000) };
}

function kannLinear() {
  try {
    return typeof CSS !== 'undefined' && CSS.supports && CSS.supports('transition-timing-function', 'linear(0, 1)');
  } catch (e) {
    return false;
  }
}

export function setzeFedern(federn = {}) {
  const r = wurzel();
  const paare = { feder: federn.feder, weich: federn.weich, hupf: federn.hupf };
  const linear = kannLinear();
  const css = { feder: '--feder', weich: '--feder-weich', hupf: '--feder-hupf' };
  for (const [name, kd] of Object.entries(paare)) {
    const gueltig = Array.isArray(kd) && kd.length === 2 && kd.every((z) => Number.isFinite(z) && z > 0);
    KURVEN[name] = linear && gueltig ? federKurve(kd[0], kd[1]).kurve : ERSATZ[name];
    if (!r) continue;
    if (linear && gueltig) r.style.setProperty(css[name], KURVEN[name]);
    else r.style.removeProperty(css[name]);
  }
  return { ...KURVEN };
}

// Web-Animation mit Tempo-Faktor. fill 'backwards': der Endzustand ist der natuerliche CSS-Zustand.
const KEINE = Object.freeze({ finished: Promise.resolve(), cancel() {}, finish() {} });
export function anim(el, frames, o = {}) {
  if (!el || typeof el.animate !== 'function') return KEINE;
  const f = tempo();
  let easing = KURVEN[o.k || 'gleiten'] || o.k;
  let kf = frames;
  // mehrstufig: Kurve je Abschnitt statt ueber die ganze Zeitachse
  if (Array.isArray(kf) && kf.length > 2) {
    kf = kf.map((k, i) => (i < kf.length - 1 && !k.easing ? { ...k, easing } : k));
    easing = 'linear';
  }
  const a = el.animate(kf, {
    duration: Math.max(0, (o.d ?? 320) * f),
    delay: Math.max(0, (o.v ?? 0) * f),
    easing,
    fill: o.fill || 'backwards',
    iterations: o.it || 1,
    direction: o.dir || 'normal',
  });
  if (a && a.finished) a.finished.catch(() => {});
  return a;
}

export function staffel(els, o = {}) {
  const liste = Array.from(els || []);
  const abstand = o.abstand ?? 45;
  const d = o.d || 560;
  liste.forEach((el, i) => anim(el, [
    { opacity: 0, transform: o.von || 'translateY(16px)' }, { opacity: 1, transform: 'none' },
  ], { d, v: (o.v || 0) + i * abstand, k: o.k || 'weich' }));
  return warte((o.v || 0) + liste.length * abstand + d * 0.6);
}

// Druck-Rueckmeldung: jeder Knopf mit .dr wird beim Druecken kleiner (CSS .dr.gedrueckt) und federt zurueck
let druckAn = false;
export function starteDruck(start = typeof document !== 'undefined' ? document : null) {
  if (druckAn || !start || typeof window === 'undefined') return false;
  druckAn = true;
  let aktiv = null;
  const los = () => {
    if (aktiv) {
      aktiv.classList.remove('gedrueckt');
      aktiv = null;
    }
  };
  start.addEventListener('pointerdown', (e) => {
    const k = e.target && e.target.closest ? e.target.closest('.dr') : null;
    if (!k || k.disabled || k.getAttribute('aria-disabled') === 'true') return;
    los();
    aktiv = k;
    k.classList.add('gedrueckt');
  }, { passive: true });
  for (const t of ['pointerup', 'pointercancel', 'blur']) window.addEventListener(t, los, { passive: true });
  start.addEventListener('pointerleave', los, { passive: true });
  // :active auf iOS
  start.addEventListener('touchstart', () => {}, { passive: true });
  return true;
}
