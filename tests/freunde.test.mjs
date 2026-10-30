// Freunde (js/freunde.js): Anfragen an die Funktionen aus supabase/freunde-schema.sql mit abgefangenem fetch, Link und
// Code. Die Rechte und Regeln auf dem Server prueft supabase/freunde-rls-test.sql (im Supabase SQL Editor).
//   node tests/freunde.test.mjs
import { setzeSpeicher } from '../js/storage.js';
import { NAME, meldeWochenpunkte, ladeRangliste, ladeFreunde, frageAn, antworte, entferne, einladung, nutzeEinladung, einladungsLink, codeAusLink,
  uebernimmLink, gemerkterCode, vergissCode, setzeFreundeFetch, CODE_SCHLUESSEL } from '../js/freunde.js';
import { SUPABASE_URL } from '../js/konto-config.js';

let ok = 0, gesamt = 0;
function pruefe(name, wert, extra = '') { gesamt++; if (wert) ok++; else console.error('FEHLER ' + name, extra); }
const m = new Map();
globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
  key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; }, clear() { m.clear(); } };
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Test' }, configurable: true });
setzeSpeicher(globalThis.localStorage);

const antworten = []; const calls = [];
setzeFreundeFetch(async (url, opt) => {
  calls.push({ url, ...opt });
  const x = antworten.shift();
  if (x === 'offline') throw new TypeError('Failed to fetch');
  const a = x || { status: 200, body: {} };
  return { ok: a.status < 400, status: a.status, async json() { return a.body; } };
});
const fehlerVon = async (f) => { try { await f(); return null; } catch (e) { return e.grund; } };
const CODE = '0123456789abcdef';

pruefe('ohne Anmeldung: abgemeldet, keine Anfrage', await fehlerVon(() => ladeFreunde()) === 'abgemeldet' && calls.length === 0);
const sitzung = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: 'u1' })).toString('base64url') + '.x', refresh_token: 'r', expires_at: 9999999999,
  user: { id: 'u1', email: 'probe@example.invalid' } };
localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));

antworten.push({ status: 200, body: [{ id: 'b', name: 'lena_spielt', status: 'freunde', seit: '2026-10-30T10:00:00Z' },
  { id: 'c', name: 'Max', status: 'eingehend' }, { id: 'x', name: 'kaputt', status: 'abgelehnt' }, null, { name: 'ohneId', status: 'freunde' }] });
const liste = await ladeFreunde();
const c0 = calls.at(-1);
pruefe('freunde(): POST an rpc/freunde mit Anmeldung', c0.url === SUPABASE_URL + '/rest/v1/rpc/freunde' && c0.method === 'POST'
  && c0.headers.Authorization === 'Bearer ' + sitzung.access_token && !!c0.headers.apikey, c0);
pruefe('freunde(): nur gueltige Zeilen, Status freunde/eingehend/ausgehend', liste.length === 2 && liste[0].name === 'lena_spielt'
  && liste[1].status === 'eingehend' && liste[1].seit === null, liste);

pruefe('Name ungueltig: ohne Anfrage', await frageAn('a') === 'ungueltig' && await frageAn('lena spielt') === 'ungueltig' && await frageAn('Jürgen') === 'ungueltig'
  && calls.length === 1);
antworten.push({ status: 200, body: { ergebnis: 'gesendet' } });
pruefe('frageAn: gesendet, Name getrimmt', await frageAn('  lena_spielt ') === 'gesendet' && JSON.parse(calls.at(-1).body).name === 'lena_spielt'
  && calls.at(-1).url.endsWith('/rpc/freund_anfragen'));
for (const e of ['freunde', 'schon', 'unbekannt', 'selbst', 'kein_name', 'grenze']) {
  antworten.push({ status: 200, body: { ergebnis: e } });
  pruefe('frageAn: ' + e, await frageAn('Max') === e);
}
antworten.push({ status: 200, body: { ergebnis: 'freunde' } });
pruefe('antworte: annehmen', await antworte('c', 1) === 'freunde' && JSON.stringify(JSON.parse(calls.at(-1).body)) === '{"anderer":"c","annehmen":true}'
  && calls.at(-1).url.endsWith('/rpc/freund_antworten'));
antworten.push({ status: 200, body: { ergebnis: 'abgelehnt' } });
pruefe('antworte: ablehnen', await antworte('c', false) === 'abgelehnt' && JSON.parse(calls.at(-1).body).annehmen === false);
antworten.push({ status: 200, body: { ergebnis: 'entfernt' } });
pruefe('entferne', await entferne('b') === 'entfernt' && calls.at(-1).url.endsWith('/rpc/freund_entfernen') && JSON.parse(calls.at(-1).body).anderer === 'b');
antworten.push({ status: 200, body: null });
pruefe('kaputte Antwort: unbekannt', await entferne('b') === 'unbekannt');

antworten.push({ status: 200, body: { code: CODE, gueltig_bis: '2026-11-06T10:00:00Z' } });
const ein = await einladung('https://floboldt007-cmyk.github.io/schach/?sprache=en#bestenliste');
pruefe('einladung: Code und Link', ein.code === CODE && ein.link === `https://floboldt007-cmyk.github.io/schach/#freund/${CODE}`, ein);
antworten.push({ status: 200, body: { ergebnis: 'kein_name' } });
pruefe('einladung ohne Namen', (await einladung()).ergebnis === 'kein_name');
antworten.push({ status: 200, body: { ergebnis: 'freunde', name: 'lena_spielt' } });
const n = await nutzeEinladung(`https://x.example/#freund/${CODE.toUpperCase()}`);
pruefe('nutzeEinladung: aus dem Link, Name', n.ergebnis === 'freunde' && n.name === 'lena_spielt' && JSON.parse(calls.at(-1).body).code === CODE, n);
const vorher = calls.length;
pruefe('nutzeEinladung: Unsinn ohne Anfrage', (await nutzeEinladung('#freund/zzz')).ergebnis === 'ungueltig' && calls.length === vorher);

pruefe('Link: Adresse ohne Hash und Suche', einladungsLink(CODE, 'https://a.b/schach/index.html?x=1#arena') === `https://a.b/schach/index.html#freund/${CODE}`);
pruefe('Link: ohne Browser die feste Adresse', einladungsLink(CODE) === `https://floboldt007-cmyk.github.io/schach/#freund/${CODE}`);
pruefe('Link: falscher Code wirft', await fehlerVon(() => einladungsLink('abc')) === 'ungueltig');
pruefe('codeAusLink', codeAusLink(`#freund/${CODE}`) === CODE && codeAusLink(CODE) === CODE && codeAusLink(`#freund/${CODE}x`) === null
  && codeAusLink('#online/ABC234') === null && codeAusLink('') === null);
pruefe('uebernimmLink merkt den Code', uebernimmLink({ hash: `#freund/${CODE}` }) === CODE && gemerkterCode() === CODE && localStorage.getItem(CODE_SCHLUESSEL) === CODE);
vergissCode();
pruefe('vergissCode', gemerkterCode() === null && uebernimmLink({ hash: '#arena' }) === null);

antworten.push({ status: 200, body: { ergebnis: 'ok' } });
pruefe('meldeWochenpunkte', await meldeWochenpunkte({ woche: '2026-10-26', punkte: 280, partien: 9 }) === 'ok'
  && JSON.stringify(JSON.parse(calls.at(-1).body)) === '{"woche":"2026-10-26","punkte":280,"partien":9}' && calls.at(-1).url.endsWith('/rpc/wochenpunkte_melden'));
const vorM = calls.length;
pruefe('meldeWochenpunkte: Unsinn ohne Anfrage', await meldeWochenpunkte({ woche: '26.10.', punkte: 1, partien: 1 }) === 'ungueltig'
  && await meldeWochenpunkte({ woche: '2026-10-26', punkte: -1, partien: 1 }) === 'ungueltig' && await meldeWochenpunkte({ woche: '2026-10-26', punkte: 1.5, partien: 1 }) === 'ungueltig'
  && calls.length === vorM);
antworten.push({ status: 200, body: [{ id: 'b', name: 'lena_spielt', punkte: 340, partien: 12, ich: false }, { id: 'a', name: null, punkte: '280', partien: 9, ich: true }, { name: 'x' }] });
const rl = await ladeRangliste('monat');
pruefe('ladeRangliste: Fenster, Zahlen, ich', JSON.parse(calls.at(-1).body).fenster === 'monat' && rl.length === 2 && rl[1].punkte === 280 && rl[1].ich === true
  && rl[1].name === null, rl);
antworten.push({ status: 200, body: [] });
await ladeRangliste('quatsch');
pruefe('ladeRangliste: unbekanntes Fenster wird Woche', JSON.parse(calls.at(-1).body).fenster === 'woche');

antworten.push('offline');
pruefe('offline', await fehlerVon(() => ladeFreunde()) === 'offline');
antworten.push({ status: 401, body: {} });
pruefe('401: abgemeldet', await fehlerVon(() => ladeFreunde()) === 'abgemeldet');
antworten.push({ status: 500, body: { message: 'intern' } });
pruefe('500: server, kein Rohtext', await fehlerVon(() => frageAn('Max')) === 'server');
pruefe('NAME wie im Schema', NAME.test('Flo_2026') && !NAME.test('ab') && !NAME.test('a'.repeat(21)));
pruefe('keine E-Mail in Anfragen', !calls.some((c) => String(c.body || '').includes('@')));

console.log(`${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
