import { setzeSpeicher } from '../js/storage.js';
import { fordereCodeAn, pruefeCode, erneuereSitzung, abmelden, speichereCloudStand, ladeCloudStand,
  speichereBenutzername, setzeKontoFetch, sitzung, eigenerName, meinName, ladeProfil, NAME_SCHLUESSEL, ladeStandAufGeraet, kontoFreigeschaltet,
  SICHTBAR_SCHLUESSEL, RUECKFALL_SCHLUESSEL, uebernimmLinkSitzung, googleAnmeldeUrl, meldeMitGoogleAn, aktiveSitzung, userId,
  ABGEGLICHEN_SCHLUESSEL, istAbgeglichen, hatSpielstand, gleicheNachAnmeldung, planeSicherung, linkAnmeldungFrisch, vorschau,
  anmeldeUrl, anmeldewege, setzeAnmeldewege, mehrFortschritt,
 } from '../js/konto.js';
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
{
  // eigener Benutzername (Flo 01.11.2026: ein Freund sah "Flo" als seinen Namen): Merker je Nutzer-ID, sonst "Du"
  localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(session));
  localStorage.removeItem(NAME_SCHLUESSEL);
  pruefe('Name: ohne Benutzernamen heisst der Spieler "Du", nie "Flo"', eigenerName() === null && meinName() === 'Du');
  setzeKontoFetch(async () => ({ ok: true, status: 201, async json() { return null; } }));
  await speichereBenutzername('lena_spielt');
  pruefe('Name: gespeicherter Benutzername gilt sofort', eigenerName() === 'lena_spielt' && meinName() === 'lena_spielt');
  localStorage.setItem(NAME_SCHLUESSEL, JSON.stringify({ konto: 'anderer', name: 'max_99' }));
  pruefe('Name: der Merker einer anderen Nutzer-ID gilt nicht', eigenerName() === null && meinName() === 'Du');
  setzeKontoFetch(async () => ({ ok: true, status: 200, async json() { return [{ user_id: 'u1', benutzername: 'max_99' }]; } }));
  await ladeProfil();
  pruefe('Name: Profil laden merkt den Benutzernamen', meinName() === 'max_99');
  setzeKontoFetch(async () => ({ ok: true, status: 204, async json() { return null; } }));
  await abmelden();
  pruefe('Name: Abmelden vergisst ihn', localStorage.getItem(NAME_SCHLUESSEL) === null && meinName() === 'Du');
  localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(session));
}
let offline = ''; setzeKontoFetch(async () => { throw new Error('offline'); }); try { await fordereCodeAn('a@b.de'); } catch(e) { offline=e.message; } pruefe('Offline-Fehler freundlich', /offline/.test(offline));
localStorage.setItem('schach-arena:v1:partien', '[1]'); ladeStandAufGeraet({ format_version: 1, stand: { 'schach-arena:v1:partien': '[2]' } });
pruefe('Cloud laden mit Rückfall-Sicherung', localStorage.getItem('schach-arena:v1:partien') === '[2]' && !!localStorage.getItem(RUECKFALL_SCHLUESSEL));
setzeKontoFetch(async () => ({ ok:true,status:204,async json(){return null;} })); await abmelden(); pruefe('Abmelden löscht lokale Sitzung', sitzung() === null);
{ // Abmelden: lokal sofort, der Server nur fuer diese Sitzung (scope=local) und mit Frist
  const rufe = []; let haengt = true;
  setzeKontoFetch(async (url, opt) => { rufe.push({ url, ...opt }); if (haengt) await new Promise(() => {}); return { ok: true, status: 204, async json() { return null; } }; });
  localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(session));
  const fertig = abmelden({ frist: 30 });
  pruefe('Abmelden entfernt die Sitzung sofort, ohne auf den Server zu warten', sitzung() === null);
  await fertig;
  pruefe('Abmelden meldet nur diese Sitzung beim Server ab (scope=local) und haengt nie', rufe.length === 1 && rufe[0].url.endsWith('/auth/v1/logout?scope=local'), rufe[0]?.url);
  haengt = false;
}
const mitAntwort = (status, body) => setzeKontoFetch(async () => ({ ok: status < 400, status, async json() { return body; } }));
mitAntwort(403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid for a@b.de' });
let serverFehler = ''; try { await pruefeCode('a@b.de', '123456'); } catch (e) { serverFehler = e.message; }
pruefe('Falscher oder abgelaufener Code (GoTrue: otp_expired): ein Text fuer beides, Server-Text nie angezeigt',
  /stimmt nicht oder ist abgelaufen/.test(serverFehler) && !/Token|a@b\.de/.test(serverFehler), serverFehler);
mitAntwort(400, { code: 400, error_code: 'email_address_not_authorized', msg: 'Email address "a@b.de" cannot be used' });
serverFehler = ''; try { await fordereCodeAn('a@b.de'); } catch (e) { serverFehler = e.message; }
pruefe('E-Mail nicht freigegeben (eingebauter Versand, Testphase): eigener Text', /Testphase/.test(serverFehler) && !/a@b\.de/.test(serverFehler), serverFehler);
mitAntwort(400, { code: 400, error_code: 'validation_failed', msg: 'Unable to validate email address: a@b.de' });
serverFehler = ''; try { await fordereCodeAn('a@b.de'); } catch (e) { serverFehler = e.message; }
pruefe('Unbekannte Kennung erscheint im Sammeltext (fuer den Tester-Bericht), nie die E-Mail', serverFehler === 'Serverfehler (400, validation_failed)', serverFehler);
mitAntwort(500, { msg: 'Error sending magic link email to a@b.de' });
serverFehler = ''; try { await fordereCodeAn('a@b.de'); } catch (e) { serverFehler = e.message; }
pruefe('Ohne Kennung nur der Status', serverFehler === 'Serverfehler (500)', serverFehler);
localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify({ ...session, expires_at: 1 })); localStorage.setItem(ABGEGLICHEN_SCHLUESSEL, 'u1');
mitAntwort(400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' });
serverFehler = ''; try { await aktiveSitzung(); } catch (e) { serverFehler = e.message; }
pruefe('Tote Sitzung: Text "Anmeldung abgelaufen", lokal abgemeldet und Riegel zu (die Gruppe zeigt dann "abgemeldet")',
  /Anmeldung ist abgelaufen/.test(serverFehler) && sitzung() === null && localStorage.getItem(ABGEGLICHEN_SCHLUESSEL) === null, serverFehler);
{ // Anmelde-Link (Rueckfall ohne SMTP): Sitzung uebernehmen, Token aus der Adresse entfernen
  const tok = 'a.' + Buffer.from(JSON.stringify({ sub: 'u9', email: 'link@b.de' })).toString('base64url') + '.x';
  let neu = null; const ort = { hash: `#access_token=${tok}&expires_in=3600&refresh_token=rl&token_type=bearer&type=magiclink`, pathname: '/schach/', search: '' };
  const genommen = uebernimmLinkSitzung(ort, { replaceState: (_, __, u) => { neu = u; } });
  pruefe('Anmelde-Link: Sitzung übernommen, Token aus der Adresse entfernt', genommen && sitzung()?.refresh_token === 'rl' && sitzung()?.email === 'link@b.de' && neu === '/schach/#einstellungen/konto' && !neu.includes('token'), neu);
  neu = null; const fehler = uebernimmLinkSitzung({ hash: '#error=access_denied&error_code=otp_expired', pathname: '/', search: '' }, { replaceState: (_, __, u) => { neu = u; } });
  pruefe('Abgelaufener Link: Fehler aus der Adresse entfernt, Sitzung unverändert', fehler && neu === '/#einstellungen/konto' && sitzung()?.refresh_token === 'rl');
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
  localStorage.removeItem(SICHTBAR_SCHLUESSEL);
  const genommen = uebernimmLinkSitzung({ hash: `#konto#access_token=${tok}&expires_at=9999999999&expires_in=3600&provider_token=GOOGLE&refresh_token=rg&token_type=bearer`, pathname: '/schach/', search: '' },
    { replaceState: (_, __, u) => { neu = u; } });
  pruefe('Google: Rückkehr mit #konto#access_token übernommen, Tokens (auch provider_token) aus der Adresse entfernt',
    genommen && sitzung()?.refresh_token === 'rg' && sitzung()?.email === 'g@gmail.example' && neu === '/schach/#einstellungen/konto'
    && !JSON.stringify(sitzung()).includes('GOOGLE') && localStorage.getItem(SICHTBAR_SCHLUESSEL) === null, JSON.stringify({ neu, s: sitzung() }));
  neu = null;
  pruefe('Google: abgebrochene Anmeldung (#error=...) räumt die Adresse auf, Sitzung bleibt', uebernimmLinkSitzung({ hash: '#error=access_denied&error_description=abgebrochen', pathname: '/schach/', search: '' },
    { replaceState: (_, __, u) => { neu = u; } }) && neu === '/schach/#einstellungen/konto' && sitzung()?.refresh_token === 'rg');
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
  { // Wettlauf (Ultracode-Pruefung 30.10.): Abmelden, waehrend der Abgleich auf die Cloud wartet
    let gib; const spaet = new Promise((r) => { gib = r; });
    setzeKontoFetch(async (url, opt) => { rufe.push({ url, ...opt }); if (url.includes('/rest/v1/spielstaende') && opt.method !== 'POST') { await spaet; return { ok: true, status: 200, async json() { return cloudMit(4).body; } }; } return { ok: true, status: 204, async json() { return null; } }; });
    leereV1(); localStorage.setItem('schach-arena:konto:sitzung', sitzungVon('u7')); localStorage.removeItem(ABGEGLICHEN_SCHLUESSEL);
    localStorage.removeItem(RUECKFALL_SCHLUESSEL);
    const abgleich = gleicheNachAnmeldung();
    await warteKurz(); await abmelden({ frist: 10 });
    gib(); const ergebnis = await abgleich;
    pruefe('Abmelden waehrend des Abgleichs: nichts zurueck aufs Geraet geschrieben', ergebnis === null && localStorage.getItem('schach-arena:v1:partien') === null
      && localStorage.getItem(RUECKFALL_SCHLUESSEL) === null && !istAbgeglichen(), String(ergebnis));
  }
  { // Spaete Erneuerung (Ultracode-Pruefung 30.10.): Die Antwort kommt erst nach dem Abmelden und darf die Sitzung nicht
    // zurueckbringen; ein Upload, der auf die Erneuerung wartet, geht nicht mehr raus
    let gib; const spaet = new Promise((r) => { gib = r; }); const posts = [];
    const alt = JSON.parse(sitzungVon('u9')); localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify({ ...alt, expires_at: 1 }));
    localStorage.setItem(ABGEGLICHEN_SCHLUESSEL, 'u9'); localStorage.setItem('schach-arena:v1:partien', JSON.stringify([{ id: 'q1' }]));
    setzeKontoFetch(async (url, opt) => {
      if (url.includes('grant_type=refresh_token')) { await spaet; return { ok: true, status: 200, async json() { return { ...alt, refresh_token: 'r-neu', expires_at: 9999999999 }; } }; }
      if (opt.method === 'POST' && url.endsWith('/rest/v1/spielstaende')) posts.push(url);
      return { ok: true, status: 204, async json() { return null; } };
    });
    const upload = speichereCloudStand().then(() => 'hochgeladen', (e) => e.message);
    await warteKurz(); await abmelden({ frist: 10 });
    gib(); const ergebnis = await upload;
    pruefe('Spaete Erneuerung nach dem Abmelden: Sitzung kommt nicht zurueck, nichts hochgeladen', sitzung() === null && posts.length === 0
      && ergebnis !== 'hochgeladen' && !istAbgeglichen(), ergebnis);
    localStorage.removeItem('schach-arena:v1:partien');
    setzeKontoFetch(async (url, opt) => { rufe.push({ url, ...opt }); const x = antw.shift() || { status: 200, body: [] }; return { ok: x.status < 400, status: x.status, async json() { return x.body; } }; });
  }
  { // Gleichzeitige Erneuerungen (Ultracode-Pruefung 30.10., zweite Runde): teilen sich eine Anfrage, keiner scheitert;
    // hat ein anderer Tab schon erneuert (gleiches Konto), gilt dessen Sitzung; bei einem anderen Konto nicht
    const alt = JSON.parse(sitzungVon('u8'));
    const fremd = (sub, rt) => ({ ...JSON.parse(sitzungVon(sub)), refresh_token: rt });
    const lauf = async (waehrend) => {
      let gib; const spaet = new Promise((r) => { gib = r; }); let anfragen = 0;
      localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify({ ...alt, expires_at: 1 }));
      setzeKontoFetch(async (url) => {
        if (url.includes('grant_type=refresh_token')) { anfragen++; await spaet; return { ok: true, status: 200, async json() { return { ...alt, refresh_token: 'r-neu', expires_at: 9999999999 }; } }; }
        return { ok: true, status: 200, async json() { return []; } };
      });
      const a = aktiveSitzung().then((x) => x.refresh_token, (e) => 'FEHLER ' + e.message);
      const b = aktiveSitzung().then((x) => x.refresh_token, (e) => 'FEHLER ' + e.message);
      await warteKurz(); if (waehrend) waehrend(); gib();
      return { a: await a, b: await b, anfragen, gespeichert: sitzung()?.refresh_token || null };
    };
    const r1 = await lauf(null);
    pruefe('Zweimal aktiveSitzung() gleichzeitig: eine Anfrage, beide bekommen die neue Sitzung', r1.anfragen === 1 && r1.a === 'r-neu' && r1.b === 'r-neu' && r1.gespeichert === 'r-neu', r1);
    const r2 = await lauf(() => localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(fremd('u8', 'r-tab2'))));
    pruefe('Anderer Tab erneuert dasselbe Konto währenddessen: dessen Sitzung gilt, kein „Nicht angemeldet.“', r2.a === 'r-tab2' && r2.b === 'r-tab2' && r2.gespeichert === 'r-tab2', r2);
    const r3 = await lauf(() => localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(fremd('u7', 'r-u7'))));
    pruefe('Anderer Tab meldet währenddessen ein anderes Konto an: Antwort verworfen, die fremde Sitzung bleibt', /^FEHLER/.test(r3.a) && /^FEHLER/.test(r3.b) && r3.gespeichert === 'r-u7', r3);
    localStorage.removeItem('schach-arena:konto:sitzung');
    setzeKontoFetch(async (url, opt) => { rufe.push({ url, ...opt }); const x = antw.shift() || { status: 200, body: [] }; return { ok: x.status < 400, status: x.status, async json() { return x.body; } }; });
  }
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
  pruefe('Abgelaufener Link: Meldung beim Zeichnen der (immer sichtbaren) Konto-Gruppe, Installations-Hinweis wartet, Testbereiche bleiben zu',
    localStorage.getItem(SICHTBAR_SCHLUESSEL) === null && linkAnmeldungFrisch());
}
// Konto fuer alle (Flo 31.10.2026): Anmeldewege vom Server, Apple-Adresse, Empfehlung im Konflikt-Dialog
{
  const apple = anmeldeUrl('apple', 'https://floboldt007-cmyk.github.io/schach/');
  pruefe('Apple: gleiche Form wie Google (provider=apple, redirect_to mit #konto)', new URL(apple).searchParams.get('provider') === 'apple'
    && new URL(apple).searchParams.get('redirect_to') === 'https://floboldt007-cmyk.github.io/schach/#konto', apple);
  pruefe('Anmeldewege: E-Mail und Google an, Apple aus, bis es in Supabase eingerichtet ist (feste Liste, keine Abfrage beim Server)',
    anmeldewege().email === true && anmeldewege().google === true && anmeldewege().apple === false);
  setzeAnmeldewege({ email: true, google: true, apple: true });
  pruefe('Anmeldewege: zum Testen umschaltbar', anmeldewege().apple === true);
  setzeAnmeldewege(null);
  pruefe('Mehr Fortschritt: erst Level, dann Partien, Gleichstand ohne Empfehlung',
    mehrFortschritt({ level: 5, partien: 3 }, { level: 2, partien: 40 }) === 'geraet' && mehrFortschritt({ level: 2, partien: 3 }, { level: 2, partien: 9 }) === 'cloud'
    && mehrFortschritt({ level: 3, partien: 7 }, { level: 3, partien: 7 }) === null && mehrFortschritt({}, { level: 4 }) === 'cloud');
  pruefe('Ohne #konto: Testbereiche bleiben zu (kontoFreigeschaltet), auch nach einer Anmeldung', (() => { localStorage.removeItem(SICHTBAR_SCHLUESSEL); return !kontoFreigeschaltet('#einstellungen'); })());
}
console.log(`${ok}/${gesamt} bestanden`); process.exit(ok === gesamt ? 0 : 1);
