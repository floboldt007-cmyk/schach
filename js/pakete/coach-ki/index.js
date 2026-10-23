// Paket "coach-ki" (Welle B2): "Frag den Coach" in der Spielanalyse. Logik und Server-Anfrage stehen in js/coach-ki.js,
// die Optik in css/pakete/coach-ki.css, der Server in supabase/functions/coach/.
//
// Orte und Register:
//   analyse:coach   Knopf "Frag den Coach" in der Knopfzeile der Coach-Karte (reihenfolge 30), fuer jeden Zug. Erst ein
//                   Tipp fragt (nie von selbst). Die Antwort erscheint als Karte .ck-karte unten in der Coach-Karte
//                   (.an-coach, ueber die ganze Breite); verlasse() nimmt sie wieder heraus (der Host zeichnet die
//                   Coach-Karte bei jedem Zug neu). Ein zweiter Tipp klappt eine Antwort zu bzw. wieder auf; nach einem
//                   Fehler (offline, nicht erreichbar, Limit) fragt er erneut.
//                   Nur, wenn das Konto sichtbar ist (kontoFreigeschaltet, zuerst nur fuer Flo): ohne Konto kann niemand
//                   den Trainer haben, der Knopf waere eine Sackgasse.
//   registriereVorteil('frag-den-coach')   meldet den Vorteil beim Abo (B1) als gebaut: Das Blatt "Crownmate Trainer"
//                   fuehrt ihn dann unter "Im Trainer" (Text in js/pakete/abo/trainer.js: eine KI erklaert, mit Tagesgrenze)
//                   und bietet den Kauf an. Bewusst NICHT 'coach-erklaerungen': Das sind laut SPIELKONZEPT 2b.5 die
//                   Erklaerungen der Coaches aus Engine-Fakten und Textbausteinen, ohne KI (Pruefer-Befund B2, Paragraf 5 UWG).
//   registriereIcon('coach-frage')              Sprechblase mit Fragezeichen fuer den Knopf
//
// Zustaende der Karte (data-zustand): laedt | antwort | abgemeldet | premium | offline | limit | abgelehnt | eingabe |
//   nicht_eingerichtet | ki. Die Antwort traegt immer sichtbar den Hinweis KI_HINWEIS (KI-Verordnung Art. 50).
//   premium zeigt premiumHinweis aus js/abo.js (ruhig, "Mehr zum Trainer"), und nur als Antwort auf den Tipp. Nur ein
//   bekannter Abo-Stand ohne Trainer zeigt ihn sofort; ist der Stand unbekannt (nie geprueft, z. B. neues Geraet ohne
//   Netz), fragt die App den Server, der den Trainer selbst prueft: So sieht kein zahlender Nutzer einen Kaufhinweis,
//   nur weil gerade das Netz fehlt (dann "offline").
// Defensiv: Ein Fehler hier stoert nie die Analyse.
import { anbieten } from '../../orte.js';
import { kontoFreigeschaltet } from '../../konto.js';
import { registriereVorteil, premiumHinweis, istPremium, premiumStand, nutzerId } from '../../abo.js';
import { icon, registriereIcon } from '../../ui/icons.js';
import { tempo } from '../../bewegung.js';
import { frageCoach, eingabeAusZug, restText, TEXTE, KI_HINWEIS } from '../../coach-ki.js';

export const VORTEIL = 'frag-den-coach';
export const KNOPF_TEXT = 'Frag den Coach';
export const LAEDT_TEXT = 'Der Coach schaut sich die Stellung an …';
// Zustaende, in denen ein zweiter Tipp die Karte zuklappt; sonst (Fehler, offline, Limit) fragt er erneut
const ZUKLAPPEN = new Set(['antwort', 'premium', 'abgemeldet']);
let kartenNr = 0;

function stelleCssSicher() {
  if (typeof document === 'undefined' || document.querySelector('link[data-paket-css="coach-ki"]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = new URL('../../../css/pakete/coach-ki.css', import.meta.url).href;
  l.dataset.paketCss = 'coach-ki';
  document.head.appendChild(l);
}

export function coachKnopf({ app = null, partie = null, zug = null, du = null } = {}) {
  if (typeof document === 'undefined' || !kontoFreigeschaltet()) return null;
  const eingabe = eingabeAusZug(zug, { partie, du });
  if (!eingabe) return null;
  stelleCssSicher();
  const knopf = document.createElement('button');
  knopf.type = 'button';
  knopf.className = 'knopf ck-knopf';
  knopf.dataset.paket = 'coach-ki';
  knopf.setAttribute('aria-expanded', 'false');
  knopf.innerHTML = `${icon('coach-frage')}<span>${KNOPF_TEXT}</span>`;
  let karte = null;
  let weg = false;
  let laeuft = false;

  const zeigeKarte = (zustand) => {
    if (!karte) {
      karte = document.createElement('div');
      karte.className = 'ck-karte';
      karte.id = 'ck-karte-' + (++kartenNr);
      karte.setAttribute('role', 'status');
      karte.setAttribute('aria-live', 'polite');
      knopf.setAttribute('aria-controls', karte.id);
      // unten in die Coach-Karte (ueber die ganze Breite); ohne sie direkt hinter die Knopfzeile
      const wirt = knopf.closest('.an-coach');
      if (wirt) wirt.appendChild(karte);
      else (knopf.closest('.an-c-fuss') || knopf.parentElement || document.body).after(karte);
    }
    karte.hidden = false;
    karte.dataset.zustand = zustand;
    karte.setAttribute('aria-busy', zustand === 'laedt' ? 'true' : 'false');
    knopf.setAttribute('aria-expanded', 'true');
    karte.replaceChildren();
    return karte;
  };
  const kopf = (k) => {
    const h = document.createElement('div');
    h.className = 'ck-kopf';
    h.innerHTML = '<span class="ck-marke">KI</span><span class="ck-titel">Der Coach erklärt</span>';
    k.append(h);
  };
  const absatz = (k, klasse, text) => {
    const p = document.createElement('p');
    p.className = klasse;
    p.textContent = text;
    k.append(p);
    return p;
  };

  // Die Coach-Karte scrollt im Querformat innen, auf dem Handy die Seite: die neue Karte ins Bild holen
  const insBild = (k) => {
    try { k.scrollIntoView({ block: 'nearest', behavior: tempo() === 0 ? 'auto' : 'smooth' }); } catch (e) { /* egal */ }
  };
  const zeigeAntwort = (a) => {
    const k = zeigeKarte('antwort');
    kopf(k);
    absatz(k, 'ck-text', a.text);
    const fuss = absatz(k, 'ck-fuss', KI_HINWEIS);
    fuss.classList.add('ck-ki-hinweis');
    const rest = restText(a.rest);
    if (rest && !a.gemerkt) absatz(k, 'ck-rest', rest);
    insBild(k);
  };
  const zeigeGrund = (grund) => {
    if (grund === 'premium') {
      const k = zeigeKarte('premium');
      // ruhiger Hinweis aus B1; in Partie und Lektion liefert er null, dann bleibt die Karte zu
      if (!premiumHinweis(k, KNOPF_TEXT, { app })) schliesse();
      else insBild(k);
      return;
    }
    const k = zeigeKarte(grund);
    absatz(k, 'ck-meldung', TEXTE[grund] || TEXTE.ki);
    if (grund === 'abgemeldet' && app && typeof app.gehe === 'function') {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'knopf ck-konto';
      b.textContent = 'Zum Konto';
      b.addEventListener('click', () => {
        if (document.documentElement.dataset.screen !== 'einstellungen') app.gehe('einstellungen');
        requestAnimationFrame(() => {
          const g = document.querySelector('.konto-gruppe');
          if (g) g.scrollIntoView({ block: 'start', behavior: tempo() === 0 ? 'auto' : 'smooth' });
        });
      });
      k.append(b);
    }
    insBild(k);
  };
  function schliesse() {
    if (karte) karte.hidden = true;
    knopf.setAttribute('aria-expanded', 'false');
  }

  async function frage() {
    if (!nutzerId()) { zeigeGrund('abgemeldet'); return; }
    laeuft = true;
    knopf.disabled = true;
    try {
      // Erst der Zwischenspeicher des Abos (ohne Netz, wenn frisch): ohne Trainer kein Aufruf der KI. Ein unbekannter
      // Stand (nie erfolgreich geprueft) ist kein "ohne Trainer": dann entscheidet der Server (403 -> Hinweis)
      const premium = await istPremium();
      if (weg) return;
      if (!premium && premiumStand().geprueftAm) { zeigeGrund('premium'); return; }
      const k = zeigeKarte('laedt');
      kopf(k);
      absatz(k, 'ck-meldung', LAEDT_TEXT);
      insBild(k);
      const a = await frageCoach(eingabe);
      if (weg) return;
      if (a.ok) zeigeAntwort(a);
      else zeigeGrund(a.grund);
    } catch (e) {
      if (!weg) zeigeGrund('ki');
    } finally {
      laeuft = false;
      if (!weg) knopf.disabled = false;
    }
  }

  knopf.addEventListener('click', () => {
    if (laeuft) return;
    // Zweiter Tipp: zuklappen; danach wieder aufklappen (eine gemerkte Antwort kostet keine neue Frage)
    if (karte && !karte.hidden && ZUKLAPPEN.has(karte.dataset.zustand)) { schliesse(); return; }
    frage();
  });
  return {
    el: knopf,
    verlasse() {
      weg = true;
      if (karte) karte.remove();
      karte = null;
    },
  };
}

try {
  registriereIcon('coach-frage', '<path d="M4.5 5.5h15a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H12l-4.5 3.5v-3.5h-3A1.5 1.5 0 0 1 3 16V7a1.5 1.5 0 0 1 1.5-1.5z"/>'
    + '<path d="M10 9.6a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.3v.3"/><path d="M12 15.2v.1"/>');
  registriereVorteil(VORTEIL);
  anbieten('analyse:coach', coachKnopf, { reihenfolge: 30, paket: 'coach-ki' });
} catch (e) {
  console.error('Paket coach-ki nicht eingehaengt', e);
}
