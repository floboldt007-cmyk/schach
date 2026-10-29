import { setzeSpeicher } from '../js/storage.js';
import { fordereCodeAn, pruefeCode, erneuereSitzung, abmelden, speichereCloudStand, ladeCloudStand,
  speichereBenutzername, setzeKontoFetch, sitzung, ladeStandAufGeraet, kontoFreigeschaltet,
  SICHTBAR_SCHLUESSEL, RUECKFALL_SCHLUESSEL, uebernimmLinkSitzung, googleAnmeldeUrl, meldeMitGoogleAn, aktiveSitzung, userId } from '../js/konto.js';
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
console.log(`${ok}/${gesamt} bestanden`); process.exit(ok === gesamt ? 0 : 1);
