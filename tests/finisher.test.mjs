import assert from 'node:assert/strict';
import { setzeSpeicher } from '../js/storage.js';

class Speicher { constructor() { this.m = new Map(); } getItem(k) { return this.m.get(k) ?? null; } setItem(k, v) { this.m.set(k, String(v)); } removeItem(k) { this.m.delete(k); } key(i) { return [...this.m.keys()][i] ?? null; } get length() { return this.m.size; } }
setzeSpeicher(new Speicher());
const { FINISHER, istFrei, auswahl, starteFinisher } = await import('../js/pakete/finisher/index.js');
const { klang, KATALOG } = await import('../js/sounds.js');

assert.deepEqual(FINISHER.map((x) => x.id), ['aus', 'krone', 'welle', 'koenig', 'signatur']);
// Signatur (Erfinder-Profil): nie ueber das Level, nur mit dem Sonderstueck des angemeldeten Kontos
assert.equal(istFrei('signatur', 99), false, 'Signatur ohne Sonderstueck gesperrt');
assert.equal(istFrei('krone', 1), true);
assert.equal(istFrei('welle', 4), false);
assert.equal(istFrei('welle', 5), true);
assert.equal(istFrei('koenig', 9), false);
assert.equal(istFrei('koenig', 10), true);
assert.equal(auswahl(1), 'krone');

// Kleines Schein-DOM fuer starteFinisher (Node): nur was der Effekt braucht
class El {
  constructor() { this.kinder = []; this.dataset = {}; this.attr = {}; this.style = { setProperty() {} }; this.eltern = null; this.innerHTML = ''; }
  setAttribute(k, v) { this.attr[k] = String(v); }
  appendChild(k) { k.eltern = this; this.kinder.push(k); return k; }
  remove() { if (this.eltern) this.eltern.kinder = this.eltern.kinder.filter((x) => x !== this); this.eltern = null; }
}
globalThis.document = { createElement: () => new El() };
const gespielt = [];
klang.spiele = (name) => { gespielt.push(name); };
const buehne = () => ({ effekte: new El(), feld: () => ({ x: 4, y: 4 }) });
const ctx = (extra = {}) => ({ gewinner: 'flo', buehne: buehne(), letzterZug: { nach: 'f7' }, koenigFeld: 'e8', dauerMs: 30, kurzMs: 20, ...extra });

// Sieg mit Finisher: genau ein Siegesklang (den spielt die Partie), der Finisher spielt nur seinen eigenen Klang der Gruppe finisher
for (const f of FINISHER.filter((x) => x.id !== 'aus')) {
  gespielt.length = 0;
  const c = ctx();
  const r = starteFinisher(c, f.id);
  assert.ok(r && c.buehne.effekte.kinder.length === 1, `${f.id}: Effekt im Brett`);
  assert.deepEqual(gespielt, [f.klang], `${f.id}: genau ein eigener Klang`);
  assert.ok(!gespielt.includes('sieg'), `${f.id}: kein zweites sieg`);
  assert.equal(KATALOG[f.klang].gruppe, 'finisher', `${f.id}: Klang in der Gruppe finisher (einzeln abschaltbar)`);
  await r.fertig;
  assert.equal(c.buehne.effekte.kinder.length, 0, `${f.id}: Effekt nach der Dauer weg`);
}
gespielt.length = 0;
const ruhig = ctx({ reduziert: true });
await starteFinisher(ruhig, 'krone').fertig;
assert.deepEqual(gespielt, [], 'reduzierte Bewegung: still');

// Schon abgebrochenes Signal (frueher Tipp): ohne Klang und ohne Effekt sofort fertig
gespielt.length = 0;
const ab = new AbortController(); ab.abort();
const c2 = ctx({ signal: ab.signal, dauerMs: 60000 });
const r2 = starteFinisher(c2, 'koenig');
assert.ok(r2 && typeof r2.fertig.then === 'function' && typeof r2.verlasse === 'function', 'abgebrochen: Vertrag { fertig, verlasse }');
assert.equal(c2.buehne.effekte.kinder.length, 0, 'abgebrochen: nichts im Brett');
assert.deepEqual(gespielt, [], 'abgebrochen: kein Klang');
const schnell = await Promise.race([r2.fertig.then(() => 'fertig'), new Promise((r) => setTimeout(() => r('wartet'), 50))]);
assert.equal(schnell, 'fertig', 'abgebrochen: sofort fertig');
r2.verlasse();

// Abbruch waehrend des Effekts raeumt sofort auf
const ab3 = new AbortController();
const c3 = ctx({ signal: ab3.signal, dauerMs: 60000 });
const r3 = starteFinisher(c3, 'welle');
assert.equal(c3.buehne.effekte.kinder.length, 1);
ab3.abort();
await r3.fertig;
assert.equal(c3.buehne.effekte.kinder.length, 0, 'Abbruch waehrend des Effekts: weg');

// Nie fuer den Bot, nie bei aus
assert.equal(starteFinisher(ctx({ gewinner: 'bot' }), 'krone'), null);
assert.equal(starteFinisher(ctx(), 'aus'), null);
// Signatur mit Sonderstueck: nur fuer das Konto, dem der Merker gehoert
const lager = new Speicher();
globalThis.localStorage = lager;
const tok = (sub) => 'a.' + Buffer.from(JSON.stringify({ sub })).toString('base64url') + '.x';
lager.setItem('schach-arena:konto:sonderstuecke', JSON.stringify({ konto: 'u-flo', ids: ['erfinder-finisher-signatur'] }));
assert.equal(istFrei('signatur', 1), false, 'Signatur: abgemeldet gesperrt');
lager.setItem('schach-arena:konto:sitzung', JSON.stringify({ access_token: tok('u-anders'), refresh_token: 'r', expires_at: 9999999999 }));
assert.equal(istFrei('signatur', 1), false, 'Signatur: anderes Konto gesperrt');
lager.setItem('schach-arena:konto:sitzung', JSON.stringify({ access_token: tok('u-flo'), refresh_token: 'r', expires_at: 9999999999 }));
assert.equal(istFrei('signatur', 1), true, 'Signatur: Flos Konto frei');
const { speichereModulEinstellungen } = await import('../js/storage.js');
speichereModulEinstellungen('finisher', { auswahl: 'signatur' });
assert.equal(auswahl(1), 'signatur', 'Signatur waehlbar');
lager.removeItem('schach-arena:konto:sitzung');
assert.equal(auswahl(1), 'krone', 'nach dem Abmelden faellt die Wahl auf Krone zurueck');
console.log('finisher.test.mjs: Freischaltungen, sichere Standardwahl, eigener Klang statt zweitem Sieg, abgebrochenes Signal ok');
