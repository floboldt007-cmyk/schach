// R27 Konto-Trennung (Flo 22.11.2026, live-Fehler): Auf DEMSELBEN Geraet meldet sich ein zweites, NEUES Konto an
// ("Schrank 55") und hat sofort den ganzen Stand des Hauptkontos (Level 22, Titel, Rahmen, Erfolge). Erwartet: ein neues
// Konto startet bei null. Nachgestellt mit zwei Testkonten gegen einen simulierten Server (nur im Speicher, nie Supabase).
//
//   node tests/r27-konto-trennung.test.mjs
//
// Zielverhalten (Auftrag 22.11.): Gastfortschritt darf beim ERSTEN Login einmal in ein Konto; ein Geraet, das schon einem
// Konto gehoert, gibt dessen Stand nie an ein anderes Konto weiter; beim Kontowechsel wird der lokale Stand getrennt; der
// Stand des Hauptkontos bleibt am Server und nach dem Zurueckwechseln heil.
import { setzeSpeicher } from '../js/storage.js';
import { pruefeCode, abmelden, setzeKontoFetch, gleicheNachAnmeldung, lokalerStand, synchronisiere, GEPARKT_SCHLUESSEL, TAUSCH_SCHLUESSEL,
  SYNC_SCHLUESSEL, sitzung } from '../js/konto.js';
import * as KONTO from '../js/konto.js';
import { profilWahl, setzeProfilWahl } from '../js/profil.js';
import { SONDER_SCHLUESSEL } from '../js/sonderstuecke.js';

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/konto.test.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}
const m = new Map();
// Kaltreview a6 B4: ein Speicher mit Groessengrenze (Zeichen ueber alle Eintraege), null = unbegrenzt
let grenze = null;
const belegt = () => [...m].reduce((n, [k, v]) => n + k.length + v.length, 0);
const setze = (k, v) => {
  v = String(v);
  if (grenze !== null && belegt() - (m.has(k) ? k.length + m.get(k).length : 0) + k.length + v.length > grenze) throw new Error('QuotaExceededError');
  m.set(k, v);
};
globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: setze, removeItem: (k) => m.delete(k),
  key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; }, clear: () => m.clear() };
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Test' }, configurable: true });
setzeSpeicher(globalThis.localStorage);

// ---------- simulierter Server: je Konto eine Zeile spielstaende ----------
const P = 'schach-arena:v1:';
const zeilen = new Map();               // user_id -> { user_id, stand, format_version }
const jwt = (sub) => 'a.' + Buffer.from(JSON.stringify({ sub })).toString('base64url') + '.x';
// INTENTIONAL-SLOP[E5]: ohne gueltiges Token kennt der simulierte Server niemanden (null = keine Zeile, POST abgelehnt)
const wer = (opt) => { try { return JSON.parse(Buffer.from(String(opt.headers?.Authorization || '').split('.')[1], 'base64url')).sub; } catch (e) { return null; } };
// netzWeg: Hochladen scheitert sofort (offline); haengen: Hochladen und Logout antworten nie (Kaltreview a6 B2/B3)
let netzWeg = false, haengen = false;
setzeKontoFetch(async (url, opt = {}) => {
  const antwort = (status, body) => ({ ok: status < 400, status, async json() { return body; } });
  if (haengen && (opt.method === 'POST' && url.includes('/rest/v1/spielstaende') || url.includes('/auth/v1/logout'))) return new Promise(() => {});
  if (netzWeg && opt.method === 'POST' && url.includes('/rest/v1/spielstaende')) throw new TypeError('Failed to fetch');
  if (url.endsWith('/auth/v1/verify')) {
    const email = JSON.parse(opt.body).email; const id = 'u-' + email.split('@')[0];
    return antwort(200, { access_token: jwt(id), refresh_token: 'r-' + id, expires_in: 3600, user: { id, email } });
  }
  if (url.includes('/auth/v1/logout')) return antwort(204, null);
  if (url.includes('/rest/v1/spielstaende')) {
    const id = wer(opt);
    if (opt.method === 'POST') { const d = JSON.parse(opt.body); if (d.user_id !== id) return antwort(403, {}); zeilen.set(id, d); return antwort(201, null); }
    return antwort(200, zeilen.has(id) ? [zeilen.get(id)] : []);
  }
  return antwort(200, {});
});

// INTENTIONAL-SLOP[E5]: kein Funken-Eintrag heisst "startet bei null", das prueft der Test ausdruecklich
const level = (stand) => { try { return JSON.parse(stand[P + 'modul:funken']).level; } catch (e) { return null; } };
const HAUPT = { [P + 'modul:funken']: JSON.stringify({ level: 22, gesamt: 9000 }), [P + 'partien']: JSON.stringify(Array.from({ length: 40 }, (_, i) => ({ id: 'p' + i }))),
  [P + 'einstellungen']: JSON.stringify({ sprache: 'de', brett: 'nacht' }) };

try {
  // 1) Hauptkonto: Geraet mit Fortschritt, Anmeldung, Abgleich -> Stand liegt am Server beim Hauptkonto
  for (const [k, v] of Object.entries(HAUPT)) localStorage.setItem(k, v);
  await pruefeCode('haupt@test.de', '123456');
  const r1 = await gleicheNachAnmeldung();
  pruefe('Hauptkonto: erster Login laedt den Geraetestand hoch (Gastfortschritt einmal ins Konto)', r1 === 'geraet' && level(zeilen.get('u-haupt')?.stand) === 22, { r1 });

  // 2) Abmelden, neues Konto auf demselben Geraet
  await abmelden({ frist: 10 });
  await pruefeCode('schrank55@test.de', '654321');
  const r2 = await gleicheNachAnmeldung();
  const neu = zeilen.get('u-schrank55');
  pruefe('neues Konto: am Server landet NICHT der Stand des Hauptkontos', !neu || level(neu.stand) !== 22, { r2, level: level(neu?.stand) });
  pruefe('neues Konto: auf dem Geraet startet es bei null (kein Level 22)', level(lokalerStand()) !== 22, { level: level(lokalerStand()) });

  // 3) Zurueck zum Hauptkonto: sein Stand bleibt heil (Server und Geraet)
  await abmelden({ frist: 10 });
  await pruefeCode('haupt@test.de', '123456');
  await gleicheNachAnmeldung();
  pruefe('Hauptkonto: Stand am Server bleibt heil', level(zeilen.get('u-haupt')?.stand) === 22, { level: level(zeilen.get('u-haupt')?.stand) });
  pruefe('Hauptkonto: nach dem Zurueckwechseln wieder Level 22 auf dem Geraet', level(lokalerStand()) === 22, { level: level(lokalerStand()) });

  // 4) Hin und her mit Partien im zweiten Konto: nichts vermischt sich, kein Stand wird ueberschrieben
  await abmelden({ frist: 10 });
  await pruefeCode('schrank55@test.de', '654321');
  await gleicheNachAnmeldung();
  localStorage.setItem(P + 'modul:funken', JSON.stringify({ level: 3, gesamt: 120 }));
  await synchronisiere();
  pruefe('Schrank: eigener Fortschritt (Level 3) am Server', level(zeilen.get('u-schrank55')?.stand) === 3, { level: level(zeilen.get('u-schrank55')?.stand) });
  localStorage.setItem(P + 'modul:funken', JSON.stringify({ level: 4, gesamt: 200 }));   // noch nicht abgeglichen
  await abmelden({ frist: 1000 });
  pruefe('Abmelden laedt Aenderungen vorher hoch (Level 4 beim Schrank)', level(zeilen.get('u-schrank55')?.stand) === 4, { level: level(zeilen.get('u-schrank55')?.stand) });
  await pruefeCode('haupt@test.de', '123456');
  await gleicheNachAnmeldung();
  pruefe('Wechsel zurueck: Hauptkonto am Server unvermischt (Level 22)', level(zeilen.get('u-haupt')?.stand) === 22, { level: level(zeilen.get('u-haupt')?.stand) });
  pruefe('Wechsel zurueck: Geraet zeigt Level 22', level(lokalerStand()) === 22, { level: level(lokalerStand()) });
  // INTENTIONAL-SLOP[F1]: ein fehlender oder kaputter Park laesst die naechste Pruefung mit Meldung scheitern
  let park = null; try { park = JSON.parse(localStorage.getItem(GEPARKT_SCHLUESSEL + 'u-schrank55')); } catch (e) { /* bleibt null */ }
  pruefe('Schrank-Stand ist auf dem Geraet geparkt, nicht weggeworfen', level(park?.stand || {}) === 4, park && Object.keys(park));
  await abmelden({ frist: 10 });
  await pruefeCode('schrank55@test.de', '654321');
  await gleicheNachAnmeldung();
  pruefe('wieder Schrank: Level 4 kommt zurueck, Hauptkonto bleibt 22', level(lokalerStand()) === 4 && level(zeilen.get('u-haupt')?.stand) === 22, { level: level(lokalerStand()) });
  pruefe('Geraete-Einstellungen bleiben beim Wechsel (Sprache)', JSON.parse(localStorage.getItem(P + 'einstellungen') || '{}').sprache === 'de');
  await abmelden({ frist: 10 });

  // 5) Gast zuerst (Ergaenzung 2): Gast spielt, Konto A, abmelden, Gast spielt weiter, Konto B. Festgelegt: Das Geraet
  // bleibt nach dem Abmelden "A gehoerig"; Weiterspielen als Gast bleibt lokal, geht nie zu B und beim naechsten Login
  // von A in A.
  for (const k of [...m.keys()]) m.delete(k);
  localStorage.setItem(P + 'einstellungen', JSON.stringify({ sprache: 'de' }));
  localStorage.setItem(P + 'modul:funken', JSON.stringify({ level: 5, gesamt: 300 }));
  localStorage.setItem(P + 'partien', JSON.stringify([{ id: 'g1' }]));
  await pruefeCode('gasta@test.de', '111111');
  await gleicheNachAnmeldung();
  pruefe('Gast -> A: Gastfortschritt einmal in A', level(zeilen.get('u-gasta')?.stand) === 5);
  await abmelden({ frist: 10 });
  localStorage.setItem(P + 'modul:funken', JSON.stringify({ level: 6, gesamt: 400 }));   // Gast spielt weiter
  await pruefeCode('gastb@test.de', '222222');
  await gleicheNachAnmeldung();
  pruefe('danach B: bekommt nichts von A und nichts vom Weiterspielen', !zeilen.get('u-gastb') || level(zeilen.get('u-gastb').stand) === null, { level: level(zeilen.get('u-gastb')?.stand) });
  pruefe('danach B: Geraet startet bei null', level(lokalerStand()) === null, { level: level(lokalerStand()) });
  await abmelden({ frist: 10 });
  await pruefeCode('gasta@test.de', '111111');
  await gleicheNachAnmeldung();
  pruefe('wieder A: das Weiterspielen (Level 6) gehoert A und geht in A', level(lokalerStand()) === 6 && level(zeilen.get('u-gasta')?.stand) === 6, { geraet: level(lokalerStand()), server: level(zeilen.get('u-gasta')?.stand) });
  await abmelden({ frist: 10 });

  // 6) Erfinder-Rahmen nur mit Besitz (der gewaehlte Rahmen wandert mit dem Stand mit)
  setzeProfilWahl({ rahmen: 'erfinder-blatt-0' });
  pruefe('Erfinder-Rahmen ohne Besitz wird nicht gezeigt', profilWahl().rahmen === 'ohne', profilWahl().rahmen);
  await pruefeCode('haupt@test.de', '123456');
  localStorage.setItem(SONDER_SCHLUESSEL, JSON.stringify({ konto: 'u-haupt', ids: ['erfinder-banner-blatt-0', 'erfinder-titel'] }));
  setzeProfilWahl({ rahmen: 'erfinder-blatt-0' });
  pruefe('Erfinder-Rahmen mit Besitz bleibt', profilWahl().rahmen === 'erfinder-blatt-0', profilWahl().rahmen);
  await abmelden({ frist: 10 });

  // ---------- Kaltreview a6 (22.11.2026): vier Befunde, je zuerst rot ----------
  const leeren = () => { for (const k of [...m.keys()]) m.delete(k); zeilen.clear(); };
  const mitUhr = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r('HAENGT'), ms))]);
  const funken = (lv) => localStorage.setItem(P + 'modul:funken', JSON.stringify({ level: lv, gesamt: lv * 100 }));

  // B1 kritisch: Abbruch mitten im Tausch (Park von A steht, das Geraet ist schon halb geleert, der Besitzer ist noch A).
  // Der naechste Tausch darf den guten Park nie mit dem Teilstand ueberschreiben.
  leeren();
  for (const [k, v] of Object.entries(HAUPT)) localStorage.setItem(k, v);
  localStorage.setItem(P + 'erfolge', JSON.stringify(['erster-sieg']));
  await pruefeCode('absturza@test.de', '111111'); await gleicheNachAnmeldung();
  funken(23);                                                     // weitergespielt, noch nicht abgeglichen
  netzWeg = true; await abmelden({ frist: 50 }); netzWeg = false;  // offline abgemeldet: Level 23 nur auf dem Geraet
  const voll = lokalerStand();
  // nachgestellt: genau der Zustand, den der Tausch nach dem Parken und dem Merker hinterlaesst, wenn die Seite beim Leeren stirbt
  localStorage.setItem(GEPARKT_SCHLUESSEL + 'u-absturza', JSON.stringify({ datum: 'x', basis: JSON.parse(localStorage.getItem(SYNC_SCHLUESSEL)).hash, stand: voll }));
  localStorage.setItem(TAUSCH_SCHLUESSEL, JSON.stringify({ von: 'u-absturza', nach: 'u-absturzb' }));
  localStorage.removeItem(P + 'modul:funken'); localStorage.removeItem(P + 'partien');
  await pruefeCode('absturzb@test.de', '222222'); await gleicheNachAnmeldung();
  let parkA = null; try { parkA = JSON.parse(localStorage.getItem(GEPARKT_SCHLUESSEL + 'u-absturza')); } catch (e) { /* null */ }
  pruefe('B1: nach Abbruch im Tausch bleibt der Park von A vollstaendig (Level 23, 40 Partien)',
    level(parkA?.stand || {}) === 23 && JSON.parse(parkA?.stand?.[P + 'partien'] || '[]').length === 40, { level: level(parkA?.stand || {}) });
  pruefe('B1: B bekommt dabei nichts von A', level(lokalerStand()) === null && !zeilen.get('u-absturzb')?.stand?.[P + 'partien'], { level: level(lokalerStand()) });
  await abmelden({ frist: 10 });
  await pruefeCode('absturza@test.de', '111111'); await gleicheNachAnmeldung();
  pruefe('B1: zurueck bei A sind Level 23 und alle Partien wieder da und am Server', level(lokalerStand()) === 23
    && JSON.parse(localStorage.getItem(P + 'partien') || '[]').length === 40 && level(zeilen.get('u-absturza')?.stand) === 23,
  { geraet: level(lokalerStand()), server: level(zeilen.get('u-absturza')?.stand) });
  pruefe('B1: kein Tausch-Merker bleibt liegen', localStorage.getItem(TAUSCH_SCHLUESSEL) === null);
  await abmelden({ frist: 10 });

  // B2: Abmelden haelt EINE Frist ein, auch wenn Hochladen und Logout beide nie antworten
  leeren();
  for (const [k, v] of Object.entries(HAUPT)) localStorage.setItem(k, v);
  await pruefeCode('frista@test.de', '333333'); await gleicheNachAnmeldung();
  funken(24);
  haengen = true;
  const t0 = Date.now(); await abmelden({ frist: 300 }); const dauer = Date.now() - t0;
  pruefe('B2: Abmelden dauert hoechstens die eine Frist (300 ms, plus 120 ms Luft)', dauer <= 420, { dauer });
  pruefe('B2: lokal ist danach abgemeldet', sitzung() === null);

  // B3: der haengende Upload von A sperrt den Abgleich von B nicht; B sieht nie den Stand von A
  haengen = false;
  await pruefeCode('fristb@test.de', '444444');
  const r3 = await mitUhr(gleicheNachAnmeldung(), 2000);
  pruefe('B3: Abgleich des naechsten Kontos kommt zurueck, statt auf den alten Lauf zu warten', r3 !== 'HAENGT', { r3 });
  pruefe('B3: das naechste Konto sieht den Stand von A nicht', level(lokalerStand()) === null, { level: level(lokalerStand()) });
  await abmelden({ frist: 10 });

  // B4: Speicher voll, der Park passt nicht: B spielt nie auf dem Stand von A, und A verliert nichts
  leeren();
  for (const [k, v] of Object.entries(HAUPT)) localStorage.setItem(k, v);
  await pruefeCode('volla@test.de', '555555'); await gleicheNachAnmeldung();
  funken(25); netzWeg = true; await abmelden({ frist: 50 }); netzWeg = false;   // Level 25 nur auf dem Geraet
  grenze = belegt() + 600;                                                       // eine zweite Kopie des Stands passt nicht mehr
  await pruefeCode('vollb@test.de', '666666');
  let fehler4 = null, r4 = null;
  try { r4 = await gleicheNachAnmeldung(); } catch (e) { fehler4 = e; }
  const alsB = sitzung() !== null && JSON.stringify(sitzung()).includes('vollb');
  pruefe('B4: B ist nie mit dem Stand von A angemeldet (Anmeldung zurueckgenommen oder Geraet leer)',
    !(alsB && level(lokalerStand()) === 25), { alsB, level: level(lokalerStand()), r4 });
  pruefe('B4: eine klare Meldung statt Schweigen', !alsB ? !!fehler4?.message && !/R.ckfall/.test(fehler4.message) : true, fehler4?.message);
  pruefe('B4: am Server von B landet nichts von A', !zeilen.get('u-vollb')?.stand || level(zeilen.get('u-vollb').stand) !== 25);
  grenze = null;
  if (sitzung()) await abmelden({ frist: 10 });
  await pruefeCode('volla@test.de', '555555'); await gleicheNachAnmeldung();
  pruefe('B4: A bekommt Level 25 zurueck und sichert es', level(lokalerStand()) === 25 && level(zeilen.get('u-volla')?.stand) === 25,
    { geraet: level(lokalerStand()), server: level(zeilen.get('u-volla')?.stand) });
  await abmelden({ frist: 10 });

  // N1 (Nach-Review a6): Abbruch im Tausch, danach Neustart OHNE Abgleich (Gast oder direkt in eine Partie mit laden:false).
  // Das Geraet muss schon beim Laden der App geheilt sein, bevor jemand auf dem Teilstand spielt.
  leeren();
  for (const [k, v] of Object.entries(HAUPT)) localStorage.setItem(k, v);
  await pruefeCode('neustarta@test.de', '777777'); await gleicheNachAnmeldung();
  funken(26); netzWeg = true; await abmelden({ frist: 50 }); netzWeg = false;
  localStorage.setItem(GEPARKT_SCHLUESSEL + 'u-neustarta', JSON.stringify({ datum: 'x', basis: JSON.parse(localStorage.getItem(SYNC_SCHLUESSEL)).hash, stand: lokalerStand() }));
  localStorage.setItem(TAUSCH_SCHLUESSEL, JSON.stringify({ von: 'u-neustarta', nach: 'u-neustartb' }));
  localStorage.removeItem(P + 'modul:funken'); localStorage.removeItem(P + 'partien');
  await import('../js/konto.js?neustart=1');                      // Neustart der App: das Modul wird frisch ausgewertet
  pruefe('N1: beim Laden der App ist der Teilstand geheilt (Level 26 und 40 Partien wieder auf dem Geraet), ohne Anmeldung',
    level(lokalerStand()) === 26 && JSON.parse(localStorage.getItem(P + 'partien') || '[]').length === 40, { level: level(lokalerStand()) });
  pruefe('N1: kein Merker und kein Park bleiben liegen, nichts hochgeladen',
    localStorage.getItem(TAUSCH_SCHLUESSEL) === null && localStorage.getItem(GEPARKT_SCHLUESSEL + 'u-neustarta') === null
    && level(zeilen.get('u-neustarta')?.stand) === 22);

  // N2 (a6 zu cbc5b379): wie N1, aber B ist beim Neustart noch angemeldet. Nach dem Heilen gehoert das Geraet wieder A; B darf
  // nicht (etwa in einer Partie mit laden:false) auf dem Stand von A spielen: der Tausch wird beim Laden gleich lokal fertig.
  leeren();
  for (const [k, v] of Object.entries(HAUPT)) localStorage.setItem(k, v);
  await pruefeCode('neustartc@test.de', '888888'); await gleicheNachAnmeldung();
  funken(27); netzWeg = true; await abmelden({ frist: 50 }); netzWeg = false;
  await pruefeCode('neustartd@test.de', '999999');                // B angemeldet, Abgleich kam nicht mehr dazu
  localStorage.setItem(GEPARKT_SCHLUESSEL + 'u-neustartc', JSON.stringify({ datum: 'x', basis: JSON.parse(localStorage.getItem(SYNC_SCHLUESSEL)).hash, stand: lokalerStand() }));
  localStorage.setItem(TAUSCH_SCHLUESSEL, JSON.stringify({ von: 'u-neustartc', nach: 'u-neustartd' }));
  localStorage.removeItem(P + 'modul:funken'); localStorage.removeItem(P + 'partien');
  await import('../js/konto.js?neustart=2');
  let parkC = null; try { parkC = JSON.parse(localStorage.getItem(GEPARKT_SCHLUESSEL + 'u-neustartc')); } catch (e) { /* null */ }
  pruefe('N2: mit B angemeldet zeigt das Geraet nach dem Laden nicht den Stand von A', level(lokalerStand()) === null
    && JSON.parse(localStorage.getItem(SYNC_SCHLUESSEL) || '{}').konto === 'u-neustartd', { level: level(lokalerStand()), besitzer: localStorage.getItem(SYNC_SCHLUESSEL) });
  pruefe('N2: der Stand von A liegt vollstaendig im Park (Level 27, 40 Partien)', level(parkC?.stand || {}) === 27
    && JSON.parse(parkC?.stand?.[P + 'partien'] || '[]').length === 40, { level: level(parkC?.stand || {}) });
  const r5 = await synchronisiere({ laden: false });
  pruefe('N2: eine Partie von B (laden:false) laedt danach nichts von A zu B hoch', level(zeilen.get('u-neustartd')?.stand) !== 27, { r5 });
  if (sitzung()) await abmelden({ frist: 10 });

  // ---------- a6 W1: jede Schutzschicht des Tauschs direkt ----------
  const T = KONTO._tauschIntern;
  const wirft = (f) => { try { f(); return false; } catch (e) { return true; } };
  const roh = () => JSON.stringify([...m].sort());
  leeren();
  for (const [k, v] of Object.entries(HAUPT)) localStorage.setItem(k, v);
  localStorage.setItem(SYNC_SCHLUESSEL, JSON.stringify({ konto: 'u-w', hash: null }));
  let vor = roh();
  pruefe('W1: parke() wirft ohne Merker und schreibt nichts', !!T && wirft(() => T.parke('u-w', null)) && roh() === vor);
  localStorage.setItem(TAUSCH_SCHLUESSEL, JSON.stringify({ von: 'u-w', nach: 'u-x', phase: 'geraet' })); vor = roh();
  pruefe('W1: parke() wirft in Phase "geraet" (Teilstand moeglich)', !!T && wirft(() => T.parke('u-w', null)) && roh() === vor);
  localStorage.setItem(TAUSCH_SCHLUESSEL, JSON.stringify({ von: 'u-y', nach: 'u-x', phase: 'park' })); vor = roh();
  pruefe('W1: parke() wirft fuer ein anderes Konto als "von"', !!T && wirft(() => T.parke('u-w', null)) && roh() === vor);
  localStorage.setItem(TAUSCH_SCHLUESSEL, JSON.stringify({ von: 'u-w', nach: 'u-x', phase: 'geraet' })); vor = roh();
  pruefe('W1: trenneGeraet() wirft bei offenem Merker und aendert nichts', !!T && wirft(() => T.trenneGeraet('u-x')) && roh() === vor);
  localStorage.setItem(TAUSCH_SCHLUESSEL, JSON.stringify({ von: 'u-w', nach: 'u-x', phase: 'park' }));
  localStorage.setItem(GEPARKT_SCHLUESSEL + 'u-w', '"ALTER PARK"');
  const p1 = !!T && T.parke('u-w', null);
  pruefe('W1: ein vorhandener Park wird nicht ueberschrieben, er wandert unter :alt', p1 === true
    && localStorage.getItem(GEPARKT_SCHLUESSEL + 'u-w:alt') === '"ALTER PARK"' && level(JSON.parse(localStorage.getItem(GEPARKT_SCHLUESSEL + 'u-w')).stand) === 22);
  localStorage.setItem(GEPARKT_SCHLUESSEL + 'u-w', '"ZWEITER PARK"'); vor = roh();
  pruefe('W1: liegt schon ein :alt, unterbleibt das Parken (weder Park noch :alt ueberschrieben)', !!T && T.parke('u-w', null) === false && roh() === vor);

  // ---------- a6 W2: ein liegengebliebenes :alt sperrt keinen spaeteren Tausch ----------
  leeren();
  for (const [k, v] of Object.entries(HAUPT)) localStorage.setItem(k, v);
  await pruefeCode('altea@test.de', '121212'); await gleicheNachAnmeldung();
  localStorage.setItem(GEPARKT_SCHLUESSEL + 'u-altea', JSON.stringify({ datum: 'x', basis: null, stand: { [P + 'modul:funken']: JSON.stringify({ level: 20 }) } }));
  await abmelden({ frist: 10 });
  await pruefeCode('alteb@test.de', '343434'); await gleicheNachAnmeldung();                 // A -> B: alter Park wandert unter :alt
  pruefe('W2: beim ersten Wechsel wandert der alte Park unter :alt', localStorage.getItem(GEPARKT_SCHLUESSEL + 'u-altea:alt') !== null);
  await abmelden({ frist: 10 });
  await pruefeCode('altea@test.de', '121212'); await gleicheNachAnmeldung();                 // B -> A: Park von A sauber zurueck
  pruefe('W2: nach dem sauberen Zurueckspielen ist :alt aufgeloest, A hat Level 22', localStorage.getItem(GEPARKT_SCHLUESSEL + 'u-altea:alt') === null
    && level(lokalerStand()) === 22, { alt: !!localStorage.getItem(GEPARKT_SCHLUESSEL + 'u-altea:alt'), level: level(lokalerStand()) });
  localStorage.setItem(GEPARKT_SCHLUESSEL + 'u-altea', JSON.stringify({ datum: 'x', basis: null, stand: {} }));   // noch einmal ein liegengebliebener Park
  await abmelden({ frist: 10 });
  await pruefeCode('alteb@test.de', '343434');
  let fehlerW2 = null; try { await gleicheNachAnmeldung(); } catch (e) { fehlerW2 = e.message; }
  pruefe('W2: der naechste Wechsel A -> B klappt (keine Sperre durch :alt)', !fehlerW2 && sitzung() !== null && level(lokalerStand()) === null
    && level(JSON.parse(localStorage.getItem(GEPARKT_SCHLUESSEL + 'u-altea') || '{}').stand || {}) === 22, { fehlerW2, level: level(lokalerStand()) });
} catch (e) {
  pruefe('Lauf ohne Ausnahme', false, String(e && e.stack || e));
}
// INTENTIONAL-SLOP[T4]: die Schlusszeile ist die Ausgabe des Tests
console.log(`\n${ok}/${gesamt} Pruefungen bestanden`);
process.exit(ok === gesamt ? 0 : 1);
