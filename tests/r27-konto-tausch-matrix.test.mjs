// R27 Konto-Trennung, Matrix-Test (Kaltreview a6, 22.11.2026): Statt einzelner Proben wird der Tausch des Geraets von Konto A
// zu Konto B nach JEDEM einzelnen Schreibschritt abgebrochen (die Seite "stirbt": ab da kommt kein Schreiben und kein Netz
// mehr an). Danach startet die App neu, auf fuenf Arten: als Gast, direkt in einer Partie (laden:false), angemeldet als A,
// angemeldet als B, und als B mit vollem Speicher. Je Fall gilt:
//   (1) kein Stand verloren: A's Stand (Level 23, Partie p-neu, nie abgeglichen) liegt irgendwo vollstaendig
//   (2) nichts fremd hochgeladen: am Server von B steht nichts von A
//   (3) B spielt nie auf A's Stand, und das Geraet von A ist ohne offenen Merker nie ein Teilstand
//   (4) keine Schleife: ein zweiter Start aendert nichts mehr
//
//   node tests/r27-konto-tausch-matrix.test.mjs
import { setzeSpeicher } from '../js/storage.js';

let ok = 0, gesamt = 0;
const fehlerListe = [];
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++; else fehlerListe.push(name + ' ' + JSON.stringify(detail));
}

// ---------- Speicher mit Abbruchpunkt und Groessengrenze ----------
const m = new Map();
let ops = 0, stopNach = Infinity, grenze = null;
const tot = () => ops > stopNach;
const belegt = () => [...m].reduce((n, [k, v]) => n + k.length + v.length, 0);
globalThis.localStorage = {
  getItem: (k) => m.get(k) ?? null,
  setItem: (k, v) => {
    ops++; if (tot()) return;                                       // nach dem Abbruch kommt nichts mehr an
    v = String(v);
    if (grenze !== null && belegt() - (m.has(k) ? k.length + m.get(k).length : 0) + k.length + v.length > grenze) throw new Error('QuotaExceededError');
    m.set(k, v);
  },
  removeItem: (k) => { ops++; if (tot()) return; m.delete(k); },
  key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; }, clear: () => m.clear(),
};
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Test' }, configurable: true });
setzeSpeicher(globalThis.localStorage);

// ---------- simulierter Server ----------
const P = 'schach-arena:v1:';
const SITZUNG = 'schach-arena:konto:sitzung', SYNC = 'schach-arena:konto:abgleich-stand', TAUSCH = 'schach-arena:konto:tausch';
const PARK = 'schach-arena:konto:geparkt:';
let zeilen = new Map(), netzWeg = false;
const jwt = (sub) => 'a.' + Buffer.from(JSON.stringify({ sub })).toString('base64url') + '.x';
// INTENTIONAL-SLOP[E5]: ohne gueltiges Token kennt der simulierte Server niemanden
const wer = (opt) => { try { return JSON.parse(Buffer.from(String(opt.headers?.Authorization || '').split('.')[1], 'base64url')).sub; } catch (e) { return null; } };
async function serverFetch(url, opt = {}) {
  if (tot()) throw new TypeError('Seite beendet');
  const antwort = (status, body) => ({ ok: status < 400, status, async json() { return body; } });
  if (url.endsWith('/auth/v1/verify')) {
    const email = JSON.parse(opt.body).email; const id = 'u-' + email.split('@')[0];
    return antwort(200, { access_token: jwt(id), refresh_token: 'r-' + id, expires_in: 3600, user: { id, email } });
  }
  if (url.includes('/auth/v1/logout')) return antwort(204, null);
  if (url.includes('/rest/v1/spielstaende')) {
    const id = wer(opt);
    if (opt.method === 'POST') {
      if (netzWeg) throw new TypeError('Failed to fetch');
      const d = JSON.parse(opt.body); if (d.user_id !== id) return antwort(403, {}); zeilen.set(id, d); return antwort(201, null);
    }
    return antwort(200, zeilen.has(id) ? [zeilen.get(id)] : []);
  }
  return antwort(200, {});
}

// ---------- Hilfen ----------
// INTENTIONAL-SLOP[E5]: ein fehlender oder kaputter Eintrag zaehlt als "nicht da"
const json = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };
const geraet = () => Object.fromEntries([...m].filter(([k]) => k.startsWith(P)));
// A's vollstaendiger Stand: Level 23, die 40 alten Partien und die neue Partie p-neu
const istA = (stand) => !!stand && json(stand[P + 'modul:funken'])?.level === 23
  && (json(stand[P + 'partien']) || []).length === 41 && (json(stand[P + 'partien']) || []).some((p) => p.id === 'p-neu');
const hatVonA = (stand) => !!stand && ((json(stand[P + 'partien']) || []).some((p) => /^p/.test(p.id)) || json(stand[P + 'modul:funken'])?.level >= 22);
let lauf = 0;
const frisch = async (tag) => { const K = await import(`../js/konto.js?m=${++lauf}-${tag}`); K.setzeKontoFetch(serverFetch); return K; };

// Vorlauf bis kurz vor dem Tausch: A spielt, gleicht ab (Level 22), spielt offline weiter (23, p-neu), meldet sich offline ab,
// B meldet sich an. Danach steht der Tausch an.
async function vorlauf() {
  m.clear(); zeilen = new Map(); ops = 0; stopNach = Infinity; grenze = null; netzWeg = false;
  const K = await frisch('vorlauf');
  m.set(P + 'modul:funken', JSON.stringify({ level: 22, gesamt: 9000 }));
  m.set(P + 'partien', JSON.stringify(Array.from({ length: 40 }, (_, i) => ({ id: 'p' + i }))));
  m.set(P + 'einstellungen', JSON.stringify({ sprache: 'de' }));
  await K.pruefeCode('a@test.de', '111111'); await K.gleicheNachAnmeldung();
  const sitzungA = m.get(SITZUNG);
  m.set(P + 'modul:funken', JSON.stringify({ level: 23, gesamt: 9100 }));
  m.set(P + 'partien', JSON.stringify([...json(m.get(P + 'partien')), { id: 'p-neu' }]));
  netzWeg = true; await K.abmelden({ frist: 50 }); netzWeg = false;
  await K.pruefeCode('b@test.de', '222222');
  return { K, sitzungA, sitzungB: m.get(SITZUNG) };
}

// Wie viele Schreibschritte hat der Tausch ohne Abbruch?
let schritte = 0;
{
  const { K } = await vorlauf();
  ops = 0; await K.gleicheNachAnmeldung(); schritte = ops;
}
console.log(`Tausch A -> B: ${schritte} Schreibschritte, je Abbruch 5 Starts`);

const STARTS = ['gast', 'partie', 'als-a', 'als-b', 'voll'];
try {
  for (let n = 0; n <= schritte; n++) {
    const { K, sitzungA, sitzungB } = await vorlauf();
    ops = 0; stopNach = n;                                              // nach n Schreibschritten stirbt die Seite
    try { await K.gleicheNachAnmeldung(); } catch (e) { /* die Seite ist tot, was sie noch tut, kommt nicht an */ }
    stopNach = Infinity;
    const nachAbbruch = new Map(m), serverNachAbbruch = new Map(zeilen);
    for (const start of STARTS) {
      m.clear(); for (const [k, v] of nachAbbruch) m.set(k, v);
      zeilen = new Map(serverNachAbbruch); grenze = null;
      if (start === 'gast') m.delete(SITZUNG);
      else m.set(SITZUNG, start === 'als-a' ? sitzungA : sitzungB);
      const voll = start === 'voll' ? belegt() + 200 : null;            // kein Platz fuer eine zweite Kopie des Stands
      grenze = voll;
      const fall = `Abbruch nach ${n}/${schritte}, Start ${start}`;
      let K2 = null;
      try {
        K2 = await frisch(`${n}-${start}`);                             // Neustart: Heilen beim Laden
        if (start === 'partie') await K2.synchronisiere({ laden: false });
        if (start === 'als-a' || start === 'als-b') await K2.synchronisiere();
      } catch (e) { /* ein Fehler beim Start ist erlaubt, Datenverlust nicht */ }
      grenze = null;
      const besitzer = json(m.get(SYNC))?.konto;
      const angemeldet = json(m.get(SITZUNG))?.user?.id || (m.get(SITZUNG) === sitzungB ? 'u-b' : m.get(SITZUNG) === sitzungA ? 'u-a' : null);
      const orte = { geraet: besitzer === 'u-a' && istA(geraet()), park: istA(json(m.get(PARK + 'u-a'))?.stand),
        parkAlt: istA(json(m.get(PARK + 'u-a:alt'))?.stand), server: istA(zeilen.get('u-a')?.stand) };
      pruefe(`${fall}: A's Stand liegt irgendwo vollstaendig`, Object.values(orte).some(Boolean), { orte, besitzer, merker: m.get(TAUSCH) });
      pruefe(`${fall}: am Server von B nichts von A`, !hatVonA(zeilen.get('u-b')?.stand), json(zeilen.get('u-b')?.stand?.[P + 'modul:funken']));
      pruefe(`${fall}: B spielt nie auf A's Stand`, !(m.get(SITZUNG) === sitzungB && hatVonA(geraet())), { besitzer, angemeldet });
      pruefe(`${fall}: ohne offenen Merker ist das Geraet von A nie ein Teilstand`, m.has(TAUSCH) || besitzer !== 'u-a' || istA(geraet()) || orte.server,
        { besitzer, merker: m.get(TAUSCH) });
      const vorher = JSON.stringify([...m].sort());
      grenze = voll;                                                    // derselbe Speicher wie beim ersten Start
      try { await frisch(`${n}-${start}-nochmal`); } catch (e) { /* zaehlt unten */ }
      grenze = null;
      pruefe(`${fall}: ein zweiter Start aendert nichts mehr (keine Schleife)`, JSON.stringify([...m].sort()) === vorher);
      if (start === 'voll' && m.get(SITZUNG) !== sitzungB && sitzungB) {
        pruefe(`${fall}: B wurde zurueckgenommen, der Grund ist fuer den ersten Bildschirm gemerkt`, !!K2 && typeof K2.kontoHinweis === 'function'
          && (K2.kontoHinweis() || '').length > 0);
      }
    }
  }
} catch (e) {
  pruefe('Lauf ohne Ausnahme', false, String(e && e.stack || e));
}
// INTENTIONAL-SLOP[T4]: die Fehlerzeilen und die Schlusszeile sind die Ausgabe des Tests
for (const f of fehlerListe.slice(0, 25)) console.log('FEHLER ' + f);
if (fehlerListe.length > 25) console.log(`... und ${fehlerListe.length - 25} weitere`);
console.log(`\n${ok}/${gesamt} Pruefungen bestanden`);
process.exit(ok === gesamt ? 0 : 1);
