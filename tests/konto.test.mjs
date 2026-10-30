import { setzeSpeicher } from '../js/storage.js';
import { fordereCodeAn, pruefeCode, erneuereSitzung, abmelden, speichereCloudStand, ladeCloudStand,
  speichereBenutzername, setzeKontoFetch, sitzung, ladeStandAufGeraet, kontoFreigeschaltet,
  SICHTBAR_SCHLUESSEL, RUECKFALL_SCHLUESSEL, uebernimmLinkSitzung, googleAnmeldeUrl, meldeMitGoogleAn, aktiveSitzung, userId,
  ABGEGLICHEN_SCHLUESSEL, istAbgeglichen, hatSpielstand, gleicheNachAnmeldung, planeSicherung, linkAnmeldungFrisch, vorschau } from '../js/konto.js';
import { SUPABASE_URL } from '../js/konto-config.js';

let ok = 0, gesamt = 0;
function pruefe(name, wert, extra = '') { gesamt++; if (wert) ok++; else console.error('FEHLER ' + name, extra); }
const m = new Map(); globalThis.localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k,v) => m.set(k,String(v)), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i] ?? null, get length(){ return m.size; } };
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Test' }, configurable: true }); // Node 21+: navigator nur mit Getter setzeSpeicher(globalThis.localStorage);
pruefe('Konto-Gruppe anfangs verborgen', !kontoFreigeschaltet('#arena'));
pruefe('Konto-Gruppe erst nach #konto dauerhaft sichtbar', kontoFreigeschaltet('#konto') && localStorage.getItem(SICHTBAR_SCHLUESSEL) === '1' && kontoFreigeschaltet('#einstellungen'));
const antworten = []; const calls = [];
setzeKontoFetch(async (url, opt) => { calls.push({ url, ...opt }); const x = antworten.shift() || { status: 200, body: {} }; return { ok: x.status < 400, status: x.status, async json(){ return x.body; } }; });
const session = { access_token: 'a.' + Buffer.from(JSON.stringify({ sub: 'u1' })).toString('base64url') + '.x', refresh_token: 'r', expires_at: 9999999999, user: { id: 'u1', email: 'a@b.de' } };

antworten.push({ status: 200, body: {} }); await fordereCodeAn('a@b.de');
pruefe('Code anfordern', calls.at(-1).url.endsWith('/auth/v1/otp') && JSON.parse(calls.at(-1).body).create_user === true);
antworten.push({ status: 200, body: {} }); await fordereCodeAn('a@b.de', 'https://floboldt007-cmyk.github.io/schach/?sprache=en');
pruefe('Code anfordern schickt die App-Adresse als redirect_to (sonst fuehrt der Link nach github.io/ ohne /schach/)',
  calls.at(-1).url === SUPABASE_URL + '/auth/v1/otp?redirect_to=' + encodeURIComponent('https://floboldt007-cmyk.github.io/schach/?sprache=en'), calls.at(-1).url);
for (const basis of ['', 'capacitor://localhost/', 'javascript:alert(1)']) {
  antworten.push({ status: 200, body: {} }); await fordereCodeAn('a@b.de', basis);
  pruefe('Code anfordern ohne redirect_to bei Adresse "' + basis + '"', calls.at(-1).url === SUPABASE_URL + '/auth/v1/otp', calls.at(-1).url);
}
antworten.push({ status: 200, body: session }); await pruefeCode('a@b.de', '123456');
pruefe('Code prüfen und Sitzung speichern', sitzung().refresh_token === 'r' && calls.at(-1).url.endsWith('/auth/v1/verify'));
localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify({ ...session, expires_at: 1 })); antworten.push({ status: 200, body: { ...session, refresh_token: 'r2' } }); await erneuereSitzung();
pruefe('Sitzung erneuern', sitzung().refresh_token === 'r2' && calls.at(-1).url.includes('grant_type=refresh_token'));
localStorage.setItem('schach-arena:v1:partien', '[]'); antworten.push({ status: 201, body: null }); await speichereCloudStand();
pruefe('Hochladen mit Auth und Prefer', calls.at(-1).headers.Authorization.startsWith('Bearer ') && calls.at(-1).headers.Prefer === 'resolution=merge-duplicates');
{
  const lokal = { modus: 'zuzweit', zuzweit: { weiss: 'Anna privat', schwarz: 'Ben privat', drehen: true }, zuege: ['e2e4'] };
  localStorage.setItem('schach-arena:v1:partien', JSON.stringify([lokal]));
  localStorage.setItem('schach-arena:v1:laufend', JSON.stringify(lokal));
  localStorage.setItem('schach-arena:v1:einstellungen:zuzweit', JSON.stringify(lokal.zuzweit));
  antworten.push({ status: 201, body: null }); await speichereCloudStand();
  const stand = JSON.parse(calls.at(-1).body).stand;
  pruefe('Lokale Namen fehlen im Cloud-Spielstand und in den Einstellungen', !JSON.stringify(stand).includes('privat')
    && !('schach-arena:v1:einstellungen:zuzweit' in stand)
    && JSON.parse(stand['schach-arena:v1:partien'])[0].zuzweit.weiss === 'Weiß'
    && JSON.parse(stand['schach-arena:v1:laufend']).zuzweit.schwarz === 'Schwarz');
  pruefe('Cloud-Sicherung aendert die Namen auf dem Geraet nicht', localStorage.getItem('schach-arena:v1:laufend').includes('Anna privat')
    && localStorage.getItem('schach-arena:v1:einstellungen:zuzweit').includes('Ben privat'));
}
antworten.push({ status: 200, body: [{ stand: {}, format_version: 1 }] }); const cloud = await ladeCloudStand(); pruefe('Cloud laden', cloud.format_version === 1);
antworten.push({ status: 409, body: { code: '23505' } }); let nameFehler = ''; try { await speichereBenutzername('Flo_1'); } catch(e) { nameFehler=e.message; } pruefe('belegter Benutzername freundlich', /vergeben/.test(nameFehler));
let offline = ''; setzeKontoFetch(async () => { throw new Error('offline'); }); try { await fordereCodeAn('a@b.de'); } catch(e) { offline=e.message; } pruefe('Offline-Fehler freundlich', /offline/.test(offline));
localStorage.setItem('schach-arena:v1:partien', '[1]'); ladeStandAufGeraet({ format_version: 1, stand: { 'schach-arena:v1:partien': '[2]' } });
pruefe('Cloud laden mit Rückfall-Sicherung', localStorage.getItem('schach-arena:v1:partien') === '[2]' && !!localStorage.getItem(RUECKFALL_SCHLUESSEL));
setzeKontoFetch(async () => ({ ok:true,status:204,async json(){return null;} })); await abmelden(); pruefe('Abmelden löscht lokale Sitzung', sitzung() === null);
for (const k of ['schach-arena:konto:sitzung', 'schach-arena:konto:rueckfall', 'schach-arena:abo:stand', 'schach-arena:daten:zustimmung', 'schach-arena:online:einladung', 'schach-arena:schule:stand']) localStorage.setItem(k, k);
localStorage.setItem('schach-arena:v1:partien', '[1]');
await abmelden({ geraet: true });
pruefe('Abmelden und Kontodaten entfernen: alle Kontobereiche weg, lokaler Spielstand bleibt',
  ![...m.keys()].some((k) => /^(schach-arena:(?:konto|abo|daten|online:einladung|schule))(?::|$)/.test(k)) && localStorage.getItem('schach-arena:v1:partien') === '[1]');
setzeKontoFetch(async () => ({ ok: false, status: 400, async json() { return { error_code: 'otp_expired', msg: 'internal secret detail' }; } }));
let serverFehler = ''; try { await fordereCodeAn('a@b.de'); } catch (e) { serverFehler = e.message; }
pruefe('Bekannte Serverkennung wird übersetzt, Originaltext nicht angezeigt', /abgelaufen/.test(serverFehler) && !/secret|internal/.test(serverFehler));
{ // Anmelde-Link (Rueckfall ohne SMTP): Sitzung uebernehmen, Token aus der Adresse entfernen
  const tok = 'a.' + Buffer.from(JSON.stringify({ sub: 'u9', email: 'link@b.de' })).toString('base64url') + '.x';
  let neu = null; const ort = { hash: `#access_token=${tok}&expires_in=3600&refresh_token=rl&token_type=bearer&type=magiclink`, pathname: '/schach/', search: '' };
  const genommen = uebernimmLinkSitzung(ort, { replaceState: (_, __, u) => { neu = u; } });
  pruefe('Anmelde-Link: Sitzung übernommen, Token aus der Adresse entfernt', genommen && sitzung()?.refresh_token === 'rl' && sitzung()?.email === 'link@b.de' && neu === '/schach/#einstellungen' && !neu.includes('token'), neu);
  neu = null; const fehler = uebernimmLinkSitzung({ hash: '#error=access_denied&error_code=otp_expired', pathname: '/', search: '' }, { replaceState: (_, __, u) => { neu = u; } });
  pruefe('Abgelaufener Link: Fehler aus der Adresse entfernt, Sitzung unverändert', fehler && neu === '/#einstellungen' && sitzung()?.refresh_token === 'rl');
  pruefe('Normale Adresse bleibt unberührt', uebernimmLinkSitzung({ hash: '#arena', pathname: '/', search: '' }, { replaceState: () => { throw new Error('nicht aufrufen'); } }) === false);
}
{ // Anmeldung mit Google (Supabase OAuth): Adresse, Weiterleitung, Rueckkehr mit #konto#access_token=...
  const url = googleAnmeldeUrl('https://floboldt007-cmyk.github.io/schach/');
  pruefe('Google: Adresse von /auth/v1/authorize mit provider=google und redirect_to auf #konto',
    url === SUPABASE_URL + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent('https://floboldt007-cmyk.github.io/schach/#konto')
    && url.startsWith('https://usaamcqypmvgqmsbfecb.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Ffloboldt007-cmyk.github.io%2Fschach%2F%23konto'), url);
  const q = new URL(url).searchParams;
  pruefe('Google: genau provider und redirect_to, kein Geheimnis in der Adresse', [...q.keys()].join(',') === 'provider,redirect_to'
    && q.get('redirect_to') === 'https://floboldt007-cmyk.github.io/schach/#konto' && !/secret|client_id|apikey|sb_/i.test(url), url);
  let ziel = null; const ort = { href: 'http://127.0.0.1:9500/schach/?test#einstellungen', assign: (u) => { ziel = u; } };
  const geliefert = meldeMitGoogleAn(ort);
  pruefe('Google: Basis aus location ohne Hash (Suche bleibt), location.assign aufgerufen', ziel === geliefert
    && new URL(ziel).searchParams.get('redirect_to') === 'http://127.0.0.1:9500/schach/?test#konto', ziel);
  const tok = 'a.' + Buffer.from(JSON.stringify({ sub: 'u7', email: 'g@gmail.example' })).toString('base64url') + '.x';
  let neu = null;
  const genommen = uebernimmLinkSitzung({ hash: `#konto#access_token=${tok}&expires_at=9999999999&expires_in=3600&provider_token=GOOGLE&refresh_token=rg&token_type=bearer`, pathname: '/schach/', search: '' },
    { replaceState: (_, __, u) => { neu = u; } });
  pruefe('Google: Rückkehr mit #konto#access_token übernommen, Tokens (auch provider_token) aus der Adresse entfernt',
    genommen && sitzung()?.refresh_token === 'rg' && sitzung()?.email === 'g@gmail.example' && neu === '/schach/#einstellungen'
    && !JSON.stringify(sitzung()).includes('GOOGLE') && localStorage.getItem(SICHTBAR_SCHLUESSEL) === '1', JSON.stringify({ neu, s: sitzung() }));
  neu = null;
  pruefe('Google: abgebrochene Anmeldung (#error=...) räumt die Adresse auf, Sitzung bleibt', uebernimmLinkSitzung({ hash: '#error=access_denied&error_description=abgebrochen', pathname: '/schach/', search: '' },
    { replaceState: (_, __, u) => { neu = u; } }) && neu === '/schach/#einstellungen' && sitzung()?.refresh_token === 'rg');
  pruefe('Google: #konto allein ist keine Rückkehr', uebernimmLinkSitzung({ hash: '#konto', pathname: '/', search: '' }, { replaceState: () => { throw new Error('nicht aufrufen'); } }) === false);
  // fuer js/daten.js exportiert
  pruefe('aktiveSitzung und userId exportiert (Sitzung, Benutzer-ID aus dem Token)', userId(sitzung()) === 'u7' && (await aktiveSitzung()).refresh_token === 'rg');
}
{ // Abgleich-Riegel (Ultracode-Pruefung PR #76): automatisch hochgeladen wird erst nach einem Abgleich auf diesem Geraet.
  // Anlass: Der Anmelde-Link oeffnet einen zweiten Tab oder Safari (leerer Speicher); ein abgebrochener Konflikt-Dialog
  // oder ein Tab ohne Abgleich ueberschrieb sonst beim Verlassen der Einstellungen den Cloud-Stand.
  const rufe = []; const antw = [];
  setzeKontoFetch(async (url, opt) => { rufe.push({ url, ...opt }); const x = antw.shift() || { status: 200, body: [] }; return { ok: x.status < 400, status: x.status, async json() { return x.body; } }; });
  const uploads = () => rufe.filter((c) => c.url.endsWith('/rest/v1/spielstaende') && c.method === 'POST').length;
  const warteKurz = () => new Promise((r) => setTimeout(r, 20));
  const sitzungVon = (sub) => JSON.stringify({ access_token: 'a.' + Buffer.from(JSON.stringify({ sub, email: sub + '@b.de' })).toString('base64url') + '.x', refresh_token: 'r-' + sub, expires_at: 9999999999, email: sub + '@b.de' });
  const cloudMit = (n) => ({ status: 200, body: [{ stand: { 'schach-arena:v1:partien': JSON.stringify(Array.from({ length: n }, (_, i) => ({ id: 'c' + i }))) }, format_version: 1 }] });
  const leereV1 = () => { for (const k of Object.keys(Object.fromEntries([...Array(localStorage.length)].map((_, i) => [localStorage.key(i), 1])))) if (k.startsWith('schach-arena:v1:')) localStorage.removeItem(k); };
  localStorage.setItem('schach-arena:konto:sitzung', sitzungVon('u5')); localStorage.removeItem(ABGEGLICHEN_SCHLUESSEL);
  leereV1(); localStorage.setItem('schach-arena:v1:partien', JSON.stringify([{ id: 'p1' }, { id: 'p2' }]));
  planeSicherung(0); await warteKurz();
  pruefe('Ohne Abgleich lädt planeSicherung nichts hoch (anderer Tab, abgebrochener Dialog)', uploads() === 0 && !istAbgeglichen());
  antw.push(cloudMit(7)); const k = await gleicheNachAnmeldung(true);
  pruefe('Abbruch-Wert (true) entscheidet keinen Konflikt: nichts geschrieben, Riegel bleibt zu', k?.konflikt === true && k.cloud.partien === 7 && k.geraet.partien === 2
    && uploads() === 0 && !istAbgeglichen() && JSON.parse(localStorage.getItem('schach-arena:v1:partien')).length === 2, JSON.stringify(k));
  antw.push(cloudMit(7), { status: 201, body: null });
  pruefe('Wahl "geraet" lädt hoch und öffnet den Riegel für genau diese Nutzer-ID', (await gleicheNachAnmeldung('geraet')) === 'geraet' && uploads() === 1
    && istAbgeglichen() && localStorage.getItem(ABGEGLICHEN_SCHLUESSEL) === 'u5');
  antw.push({ status: 201, body: null }); planeSicherung(0); await warteKurz();
  pruefe('Nach dem Abgleich sichert planeSicherung wie bisher', uploads() === 2);
  localStorage.setItem('schach-arena:konto:sitzung', sitzungVon('u6'));
  pruefe('Der Riegel gilt nur für die Nutzer-ID, mit der abgeglichen wurde', !istAbgeglichen());
  localStorage.setItem('schach-arena:konto:sitzung', sitzungVon('u5')); antw.push({ status: 204, body: null }); await abmelden();
  pruefe('Abmelden schließt den Riegel wieder', localStorage.getItem(ABGEGLICHEN_SCHLUESSEL) === null && sitzung() === null);
  // Safari nach dem Link: nur die Eintraege eines frischen Starts, keine Partie
  leereV1();
  for (const k2 of ['hinweis-installieren', 'modul:start', 'modul:funken', 'modul:punkte']) localStorage.setItem('schach-arena:v1:' + k2, '{}');
  pruefe('Frischer Start ohne Partie ist kein Spielstand', !hatSpielstand());
  localStorage.setItem('schach-arena:konto:sitzung', sitzungVon('u5')); antw.push(cloudMit(7));
  const leer = await gleicheNachAnmeldung();
  pruefe('Leerer Browser lädt die Cloud ohne Rückfrage und lädt nichts hoch', leer === 'cloud' && JSON.parse(localStorage.getItem('schach-arena:v1:partien')).length === 7
    && uploads() === 2 && istAbgeglichen(), String(leer));
  pruefe('Reine Einstellungen zählen nicht als Spielstand', !hatSpielstand({ 'schach-arena:v1:einstellungen': '{}', 'schach-arena:v1:einstellungen:musik': '{}' }));
  pruefe('Vorschau liest das Level aus dem Funken-Modul (vorher immer Level 1)', vorschau({ 'schach-arena:v1:modul:funken': JSON.stringify({ level: 5, gesamt: 900 }) }).level === 5
    && hatSpielstand({ 'schach-arena:v1:modul:funken': JSON.stringify({ level: 2 }) }));
  localStorage.setItem(ABGEGLICHEN_SCHLUESSEL, 'u5'); antw.push({ status: 200, body: JSON.parse(sitzungVon('u5')) });
  await pruefeCode('u5@b.de', '123456');
  pruefe('Neue Anmeldung per Code verlangt einen neuen Abgleich', localStorage.getItem(ABGEGLICHEN_SCHLUESSEL) === null);
  leereV1(); localStorage.setItem('schach-arena:v1:partien', JSON.stringify([{ id: 'p1' }])); localStorage.setItem(ABGEGLICHEN_SCHLUESSEL, 'u5'); antw.push(cloudMit(3));
  const k2 = await gleicheNachAnmeldung();
  pruefe('Ein gefundener Konflikt schließt den Riegel, auch mit altem Merker', k2?.konflikt === true && localStorage.getItem(ABGEGLICHEN_SCHLUESSEL) === null);
  pruefe('Mit einer Partie oder einem anderen Eintrag zählt der Browser als Spielstand',
    hatSpielstand({ 'schach-arena:v1:partien': '[{"id":"x"}]' }) && hatSpielstand({ 'schach-arena:v1:serie': '{}' }) && !hatSpielstand({}));
  localStorage.removeItem(SICHTBAR_SCHLUESSEL);
  uebernimmLinkSitzung({ hash: '#error=access_denied&error_code=otp_expired', pathname: '/', search: '' }, { replaceState() {} });
  pruefe('Abgelaufener Link: Konto-Gruppe wird sichtbar (Meldung beim Zeichnen), Installations-Hinweis wartet',
    localStorage.getItem(SICHTBAR_SCHLUESSEL) === '1' && linkAnmeldungFrisch());
}
console.log(`${ok}/${gesamt} bestanden`); process.exit(ok === gesamt ? 0 : 1);
