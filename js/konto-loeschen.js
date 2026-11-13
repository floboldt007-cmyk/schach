// Loeschseite fuer das Konto (konto-loeschen.html, konto-loeschen-en.html, G-007 M3): Google Play verlangt einen Weg, das
// Konto ohne die App zu loeschen. Die Seite meldet mit denselben Wegen an wie die App (E-Mail-Code mit Bot-Schutz, Google)
// und loescht ueber denselben Server-Aufruf wie Einstellungen > Daten > "Konto löschen" (loescheKonto, rpc konto_loeschen).
// Die Texte stehen in der Seite (script#kl-texte, JSON); Fehler von Supabase kommen als ganze Saetze aus js/konto.js.
//
//   starte(doc = document) -> { zeige() }   verdrahtet die Seite; Sprache aus <html lang>
// Ein laufendes Stripe-Abo endet mit dem Konto nicht: Ist es im Geraet bekannt (js/abo.js), steht der Hinweis vor dem
// zweiten Schritt. Die Seite zeigt den Hinweis ausserdem immer als festen Satz, weil ein fremder Browser den Stand nicht kennt.
import { setzeSprache } from './sprache.js';
import { fordereCodeAn, pruefeCode, meldeMitGoogleAn, uebernimmLinkSitzung, sitzung, userId, abmelden } from './konto.js';
import { loescheKonto } from './daten.js';
import { botschutz } from './botschutz.js';

// INTENTIONAL-SLOP[O4]: Seiten-Start mit lauter kleinen Knopf-Handlern, die sich text/melde/zeige teilen; geteilt waere es nur verschoben
export function starte(doc = document) {
  const sprache = setzeSprache(doc.documentElement.lang === 'en' ? 'en' : 'de');
  let T = {};
  // INTENTIONAL-SLOP[F1]: kaputtes JSON darf die Seite nicht anhalten, dann stehen die Schluessel als Text da
  try { T = JSON.parse(doc.getElementById('kl-texte').textContent); } catch (e) { /* ohne Texte: Schluessel zeigen */ }
  const text = (k) => T[k] || k;
  const $ = (sel) => doc.querySelector(sel);
  const status = $('.kl-status');
  const melde = (s, fehler = false) => { status.textContent = s || ''; status.dataset.fehler = fehler ? 'ja' : 'nein'; };
  const wort = String(T.wort || 'LÖSCHEN');
  let email = '';
  let schutz = null;

  // Google-Rueckkehr (#konto#access_token=... oder #error=...): js/konto.js uebernimmt die Sitzung schon beim Import und
  // setzt die Adresse dabei auf #einstellungen/konto. Den Hash davor merkt sich darum das klassische Skript im Kopf der
  // Seite (window.__klHash, laeuft vor jedem Modul). Danach steht die Adresse ohne Hash da.
  const hash = String(globalThis.__klHash ?? globalThis.location?.hash ?? '');
  const rueckkehr = uebernimmLinkSitzung() || /(?:^|[#&])(?:access_token|error)=/.test(hash);
  if (rueckkehr || location.hash === '#einstellungen/konto') {
    // INTENTIONAL-SLOP[F1]: ohne history (alte Browser, file://) bleibt nur der Hash stehen, die Seite laeuft weiter
    try { globalThis.history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* egal */ }
  }
  if (rueckkehr && !sitzung() && /(?:^|[#&])error=/.test(hash)) melde(text('googleFehler'), true);

  function zeige() {
    const s = sitzung();
    const an = !!(s?.access_token && userId(s));
    $('.kl-anmelden').hidden = an;
    $('.kl-angemeldet').hidden = !an;
    $('.kl-schritt2').hidden = true;
    $('[data-kl="weiter"]').hidden = false;
    if (an) {
      $('.kl-wer').textContent = s.email || s.user?.email || '';
      schutz?.entferne(); schutz = null;
    } else if (!schutz) {
      schutz = botschutz($('.konto-botschutz'), { sprache, modus: doc.documentElement.dataset.modus === 'dunkel' ? 'dunkel' : 'hell' });
    }
  }

  const versuche = async (fn) => { try { return await fn(); } catch (f) { melde(f?.message || text('fehler'), true); return false; } };
  const knopf = (k, fn) => $(`[data-kl="${k}"]`).addEventListener('click', async (e) => {
    const b = e.currentTarget; if (b.disabled) return;
    b.disabled = true;
    try { await fn(); } finally { if (b.isConnected && b.dataset.kl !== 'loeschen') b.disabled = false; }
  });

  knopf('code', () => versuche(async () => {
    melde('');
    const mail = $('.kl-email').value;
    const token = schutz ? await schutz.token() : '';
    try {
      await fordereCodeAn(mail, location.href.split('#')[0], token);
    } finally { schutz?.verbraucht(); }
    email = String(mail).trim();
    $('.kl-codeteil').hidden = false;
    $('.kl-code').focus();
    melde(text('codeGesendet'));
  }));
  knopf('pruefen', () => versuche(async () => {
    await pruefeCode(email || $('.kl-email').value, $('.kl-code').value);
    melde(''); zeige();
  }));
  knopf('google', () => versuche(async () => { melde(text('zuGoogle')); meldeMitGoogleAn(); }));
  knopf('weiter', async () => {
    melde('');
    let abo = '';
    // INTENTIONAL-SLOP[F1]: der Abo-Hinweis ist eine Zugabe; laedt abo.js nicht, geht das Loeschen ohne ihn weiter
    try { abo = (await import('./abo.js')).aboHinweisZumLoeschen() || ''; } catch (e) { /* ohne Abo-Modul */ }
    $('.kl-abo').textContent = abo; $('.kl-abo').hidden = !abo;
    $('[data-kl="weiter"]').hidden = true;
    $('.kl-schritt2').hidden = false;
    $('.kl-bestaetigen').value = '';
    $('[data-kl="loeschen"]').disabled = true;
    $('.kl-bestaetigen').focus();
  });
  $('.kl-bestaetigen').addEventListener('input', (e) => {
    $('[data-kl="loeschen"]').disabled = e.target.value.trim().toLocaleUpperCase(sprache) !== wort;
  });
  knopf('abbrechen', () => { melde(''); zeige(); });
  // abmelden() entfernt die Sitzung sofort und wartet danach auf den Server: nicht darauf warten
  knopf('abmelden', () => { abmelden().catch(() => {}); melde(''); zeige(); });
  knopf('loeschen', async () => {
    melde(text('loescht'));
    const ok = await versuche(() => loescheKonto());
    if (!ok) { $('[data-kl="loeschen"]').disabled = false; return; }
    $('.kl-anmelden').hidden = true;
    $('.kl-angemeldet').hidden = true;
    $('.kl-fertig').hidden = false;
    melde('');
    $('.kl-fertig').focus?.();
  });

  zeige();
  return { zeige };
}
