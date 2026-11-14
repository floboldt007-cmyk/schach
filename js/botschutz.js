// Bot-Schutz fuer die Anmeldung: Cloudflare Turnstile (Flos Wahl 09.11.2026, Konzept-Anti-Cheat Abschnitt 3).
// Supabase Auth prueft mit eingeschaltetem CAPTCHA genau die Code-Anforderung (/auth/v1/otp); das Token geht dort als
// gotrue_meta_security.captcha_token mit (js/konto.js). Auffrischen der Sitzung, /verify und die Google-Anmeldung
// (/authorize) prueft Supabase nicht (supabase/auth, internal/api: verifyCaptcha, isIgnoreCaptchaRoute).
//
//   botschutzAn() -> boolean          ist ein Site-Key gesetzt (js/konto-config.js TURNSTILE_SITEKEY)?
//   botschutz(ort, { modus, sprache }) -> { token(), verbraucht(), entferne() } | null
//       zeichnet das Widget in ort (div.konto-botschutz); null, wenn kein Site-Key gesetzt ist. Ohne Site-Key laedt die App
//       nichts von Cloudflare und verhaelt sich wie vor dem Bot-Schutz. token() wartet hoechstens WARTEN_MS auf ein
//       Token und liefert es oder ''; verbraucht() holt nach einer Anfrage ein neues (jedes Token gilt nur einmal und
//       hoechstens 300 s, developers.cloudflare.com/turnstile/get-started/client-side-rendering).
//
// Datensparsamkeit: Das Skript kommt nur von challenges.cloudflare.com und erst, wenn die Anmeldung gezeichnet wird
// (Konto-Gruppe ohne Sitzung), nie beim Start der App. sw.js laesst fremde Herkuenfte ohnehin am Cache vorbei.
// Testmodus (?test): nur window.__botschutzTestKey zaehlt (ohne ihn ist der Bot-Schutz aus), damit die Browser-Tests ohne
// Konto bei Cloudflare laufen und der echte Key (gilt nur auf crownmate.de) keine Suite veraendert; ausserhalb des
// Testmodus zaehlt nur TURNSTILE_SITEKEY.
import { TURNSTILE_SITEKEY } from './konto-config.js';

export const TURNSTILE_SKRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const WARTEN_MS = 8000;
let laden = null;

function siteKey() {
  try {
    if (/[?&]test(?:[&=]|$)/.test(globalThis.location?.search || '')) return String(globalThis.__botschutzTestKey || '');
  } catch (e) { /* kein location */ }
  return String(TURNSTILE_SITEKEY || '');
}
export function botschutzAn() { return siteKey() !== ''; }

function ladeSkript() {
  if (globalThis.turnstile) return Promise.resolve(globalThis.turnstile);
  if (laden) return laden;
  laden = new Promise((ja, nein) => {
    const s = document.createElement('script');
    s.src = TURNSTILE_SKRIPT; s.async = true; s.defer = true;
    s.onload = () => (globalThis.turnstile ? ja(globalThis.turnstile) : nein(new Error('turnstile fehlt')));
    s.onerror = () => nein(new Error('turnstile nicht geladen'));
    document.head.append(s);
  }).catch((f) => { laden = null; throw f; });
  return laden;
}

export function botschutz(ort, { modus = 'hell', sprache = 'de' } = {}) {
  const key = siteKey();
  if (!key || !ort) return null;
  let id = null; let wert = ''; let wartende = []; let fehler = false; let weg = false;
  const gib = (t) => { wert = t || ''; const w = wartende; wartende = []; w.forEach((f) => f(wert)); };
  ort.hidden = false;
  const bereit = ladeSkript().then((ts) => {
    if (weg) return;
    id = ts.render(ort, {
      sitekey: key, theme: modus === 'dunkel' ? 'dark' : 'light', language: sprache === 'en' ? 'en' : 'de',
      size: 'flexible', appearance: 'interaction-only',
      callback: (t) => { fehler = false; gib(t); },
      'expired-callback': () => { wert = ''; },
      'error-callback': () => { fehler = true; gib(''); },
    });
  }).catch(() => { fehler = true; gib(''); });
  return {
    get fehler() { return fehler; },
    token() {
      if (wert) return Promise.resolve(wert);
      if (fehler) return Promise.resolve('');
      return new Promise((ja) => {
        wartende.push(ja);
        setTimeout(() => { wartende = wartende.filter((f) => f !== ja); ja(wert); }, WARTEN_MS);
      });
    },
    verbraucht() {
      wert = ''; fehler = false;
      bereit.then(() => { try { if (id != null) globalThis.turnstile?.reset(id); } catch (e) { /* egal */ } });
    },
    entferne() {
      weg = true; wert = '';
      try { if (id != null) globalThis.turnstile?.remove(id); } catch (e) { /* egal */ }
    },
  };
}
