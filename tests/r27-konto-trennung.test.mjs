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
import { pruefeCode, abmelden, setzeKontoFetch, gleicheNachAnmeldung, lokalerStand, synchronisiere, GEPARKT_SCHLUESSEL } from '../js/konto.js';
import { profilWahl, setzeProfilWahl } from '../js/profil.js';
import { SONDER_SCHLUESSEL } from '../js/sonderstuecke.js';

let ok = 0, gesamt = 0;
function pruefe(name, gut, detail = '') {
  gesamt++; if (gut) ok++;
  // INTENTIONAL-SLOP[T4]: die Pruefzeile ist die Ausgabe des Tests (wie in tests/konto.test.mjs)
  console.log(`${gut ? 'ok  ' : 'FEHLER'} ${name}${gut ? '' : ' ' + JSON.stringify(detail)}`);
}
const m = new Map();
globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
  key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; }, clear: () => m.clear() };
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Test' }, configurable: true });
setzeSpeicher(globalThis.localStorage);

// ---------- simulierter Server: je Konto eine Zeile spielstaende ----------
const P = 'schach-arena:v1:';
const zeilen = new Map();               // user_id -> { user_id, stand, format_version }
const jwt = (sub) => 'a.' + Buffer.from(JSON.stringify({ sub })).toString('base64url') + '.x';
// INTENTIONAL-SLOP[E5]: ohne gueltiges Token kennt der simulierte Server niemanden (null = keine Zeile, POST abgelehnt)
const wer = (opt) => { try { return JSON.parse(Buffer.from(String(opt.headers?.Authorization || '').split('.')[1], 'base64url')).sub; } catch (e) { return null; } };
setzeKontoFetch(async (url, opt = {}) => {
  const antwort = (status, body) => ({ ok: status < 400, status, async json() { return body; } });
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
} catch (e) {
  pruefe('Lauf ohne Ausnahme', false, String(e && e.stack || e));
}
// INTENTIONAL-SLOP[T4]: die Schlusszeile ist die Ausgabe des Tests
console.log(`\n${ok}/${gesamt} Pruefungen bestanden`);
process.exit(ok === gesamt ? 0 : 1);
