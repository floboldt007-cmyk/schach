import { setzeSpeicher } from '../js/storage.js';
import { fordereCodeAn, pruefeCode, erneuereSitzung, abmelden, speichereCloudStand, ladeCloudStand,
  speichereBenutzername, setzeKontoFetch, sitzung, ladeStandAufGeraet, kontoFreigeschaltet,
  SICHTBAR_SCHLUESSEL, RUECKFALL_SCHLUESSEL, uebernimmLinkSitzung } from '../js/konto.js';

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
antworten.push({ status: 200, body: session }); await pruefeCode('a@b.de', '123456');
pruefe('Code prüfen und Sitzung speichern', sitzung().refresh_token === 'r' && calls.at(-1).url.endsWith('/auth/v1/verify'));
localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify({ ...session, expires_at: 1 })); antworten.push({ status: 200, body: { ...session, refresh_token: 'r2' } }); await erneuereSitzung();
pruefe('Sitzung erneuern', sitzung().refresh_token === 'r2' && calls.at(-1).url.includes('grant_type=refresh_token'));
localStorage.setItem('schach-arena:v1:partien', '[]'); antworten.push({ status: 201, body: null }); await speichereCloudStand();
pruefe('Hochladen mit Auth und Prefer', calls.at(-1).headers.Authorization.startsWith('Bearer ') && calls.at(-1).headers.Prefer === 'resolution=merge-duplicates');
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
console.log(`${ok}/${gesamt} bestanden`); process.exit(ok === gesamt ? 0 : 1);
