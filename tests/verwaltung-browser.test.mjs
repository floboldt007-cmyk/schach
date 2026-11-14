// Browser-Test der Verwaltung (G-006 M3) gegen die echte App (index.html?test, also mit der Paketliste PAKETE aus
// js/erweiterungen.js, ohne ?erw) und einen gefaelschten Supabase-Server ueber page.route; die echte Supabase wird nie
// gerufen. Prueft: ohne Anmeldung, ohne Recht, offline und solange die SQL fehlt (404) bleibt die Gruppe "Verwaltung"
// in den Einstellungen still unsichtbar, ohne Fehler in der Konsole. Gegenprobe: mit Recht erscheint sie (sonst
// waere "unsichtbar" auch dann gruen, wenn das Paket gar nicht geladen wird). Seit dem Kaltreview vom 14.11.2026 auch:
// die Gruppe haengt an der Anmeldung, nicht am #konto-Merker; eigenes Menue-Zeichen; das Menue wird bei spaeter Antwort
// genau einmal neu gebaut, nach dem Verlassen nie mehr; der Deep Link #einstellungen/verwaltung oeffnet am Handy.
//   node tests/verwaltung-browser.test.mjs
//   PORT=9800 node tests/verwaltung-browser.test.mjs   eigener Port (Standard: frei)
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { browserTyp } from './browser.mjs';
import { DE } from '../js/pakete/verwaltung/texte.js';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || await (await import('./freier-port.mjs')).freierPort();
const BASIS = `http://127.0.0.1:${PORT}/index.html?test`;
const SUPA = 'https://usaamcqypmvgqmsbfecb.supabase.co';
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0;
let gesamt = 0;
function pruefe(name, bedingung, info) {
  gesamt++;
  if (bedingung) { ok++; console.log('ok     ' + name); } else console.log('FEHLER ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : ''));
}

const UID = 'f1000000-0000-4000-8000-0000000000f1';
const token = (sub) => 'a.' + Buffer.from(JSON.stringify({ sub })).toString('base64url') + '.x';
const SITZUNG = { access_token: token(UID), refresh_token: 'r1', expires_at: 9999999999, user: { id: UID, email: 'f@x' }, email: 'f@x' };
const UID_B = 'b2000000-0000-4000-8000-0000000000b2';
const SITZUNG_B = { access_token: token(UID_B), refresh_token: 'r2', expires_at: 9999999999, user: { id: UID_B, email: 'b@x' }, email: 'b@x' };

function ladePlaywright() {
  for (const k of [process.env.PLAYWRIGHT_PFAD, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(k); } catch (e) { /* naechster */ }
  }
  throw new Error('Playwright nicht gefunden (PLAYWRIGHT_PFAD setzen)');
}
async function warteAufServer(url, ms = 10000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    try { const r = await fetch(url); await r.arrayBuffer(); if (r.ok) return; } catch (e) { /* noch nicht da */ }
    await warte(150);
  }
  throw new Error('Server startet nicht: ' + url);
}

// Oeffnet die Einstellungen mit gefaelschtem Supabase. recht: Antwort von ist_verwalter (true/false), 'offline'
// (Anfrage bricht ab) oder 'fehlt' (404 wie ohne verwaltung-schema.sql). Gemessen wird, nachdem ist_verwalter beantwortet
// ist (bzw. ohne Anmeldung nach derselben Wartezeit). spaet: ist_verwalter antwortet erst nach so vielen ms (das Menue
// ist dann laengst gebaut). konto: Konto freigeschaltet (schach-arena:konto:sichtbar). handy: Handybreite, dort tippt der
// Test den Menue-Eintrag an und misst, ob die Seite des Bereichs aufgeht. hash: Ziel beim Laden (Deep Link). verlassen:
// gleich nach dem Laden nach #heim, noch vor der Antwort. probe: wird zum Schluss mit der Seite gerufen, ihr Ergebnis
// steht in probe. neubau zaehlt, wie oft das Menue (.es-nav) neu gefuellt wurde, nachdem die Seite stand.
// folge: je Anfrage an ist_verwalter eigene Antwort und Verzoegerung ([{ recht, spaet }, ...], die n-te Anfrage nimmt
// den n-ten Eintrag); reihenfolge haelt fest, in welcher Reihenfolge die Antworten fertig wurden (Anfrage-Nummern ab 1).
async function zustand(browser, { sitzung = SITZUNG, recht = false, spaet = 0, konto = true, handy = false, hash = '#einstellungen',
  verlassen = false, probe = null, folge = null } = {}) {
  const [w, h] = handy ? [390, 844] : [1180, 820];
  const kontext = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const seite = await kontext.newPage();
  const fehler = [];
  const frage = [];
  const [rechtStandard, spaetStandard] = [recht, spaet];
  seite.on('pageerror', (e) => fehler.push('pageerror: ' + e.message));
  // wie tests/abo.test.mjs: Netzmeldungen des Browsers (404, abgebrochen) sind kein Fehler der App
  seite.on('console', (m) => {
    if (m.type() === 'error' && !/404|ERR_FAILED|net::/.test(m.text())) fehler.push('console: ' + m.text());
  });
  let beantwortet = 0;
  const reihenfolge = [];
  await seite.route(SUPA + '/**', async (r) => {
    const u = r.request().url();
    if (u.endsWith('/rest/v1/rpc/ist_verwalter')) {
      frage.push(u);
      const nr = frage.length;
      const { recht, spaet } = folge?.[nr - 1] || { recht: rechtStandard, spaet: spaetStandard };
      if (spaet) await warte(spaet);
      beantwortet++;
      reihenfolge.push(nr);
      if (recht === 'offline') return r.abort('internetdisconnected');
      if (recht === 'fehlt') {
        return r.fulfill({ status: 404, contentType: 'application/json',
          body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function public.ist_verwalter without parameters' }) });
      }
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(recht === true) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await seite.addInitScript(({ sitzung, konto }) => {
    try {
      if (konto) localStorage.setItem('schach-arena:konto:sichtbar', '1');
      if (sitzung) localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(sitzung));
    } catch (e) { /* egal */ }
  }, { sitzung, konto });
  await seite.goto(BASIS + hash);
  // state attached: am Handy ist der Inhalt in der Liste verborgen
  await seite.waitForSelector('.es-inhalt', { state: 'attached', timeout: 15000 });
  const navVorher = await seite.locator('.es-nav-punkt').count();
  await seite.evaluate(() => {
    window.__neubau = 0;
    const nav = document.querySelector('.es-nav');
    if (nav) new MutationObserver(() => { window.__neubau++; }).observe(nav, { childList: true });
  });
  if (verlassen) await seite.evaluate(() => { location.hash = '#heim'; });
  const ende = Date.now() + 5000 + spaet;
  while (sitzung && !beantwortet && Date.now() < ende) await warte(50);
  await warte(600);
  const messe = () => seite.evaluate((titel) => {
    const g = document.querySelector('.vw-gruppe');
    const nav = [...document.querySelectorAll('.es-nav-punkt')].map((b) => b.textContent.trim());
    const zeichen = (s) => document.querySelector(`.es-nav-punkt[data-seite="${s}"] .es-nav-zeichen`)?.innerHTML || '';
    return {
      da: !!g,
      sichtbar: !!g && !g.hidden && g.getClientRects().length > 0,
      inNav: nav.some((t) => t.includes(titel)),
      text: document.querySelector('.es-inhalt')?.innerText.includes(titel) || false,
      offen: !!document.querySelector('.vw-gruppe.es-offen'),
      kopf: document.querySelector('.kopf h2')?.textContent.trim() || '',
      zeichen: zeichen('verwaltung'),
      kontoZeichen: zeichen('konto'),
      abschnitte: [...document.querySelectorAll('.es-nav-abschnitt')].map((a) => a.textContent.trim()),
      neubau: window.__neubau,
    };
  }, DE.titel);
  const stand = await messe();
  let seiteAuf = null;
  if (handy && stand.inNav && hash === '#einstellungen') {
    await seite.locator('.es-nav-punkt', { hasText: DE.titel }).first().click();
    await seite.waitForFunction(() => location.hash.startsWith('#einstellungen/'), null, { timeout: 5000 }).catch(() => {});
    await warte(600);
    seiteAuf = { hash: await seite.evaluate(() => location.hash), ...(await messe()),
      offen: await seite.evaluate(() => !!document.querySelector('.vw-gruppe.es-offen')) };
  }
  const probeErg = probe ? await probe(seite, { fragen: () => frage.length, beantwortet: () => beantwortet }) : null;
  await kontext.close();
  return { ...stand, navVorher, seiteAuf, fehler, fragen: frage.length, reihenfolge, probe: probeErg };
}

async function browserTeil(browser) {
  const ohne = await zustand(browser, { sitzung: null });
  pruefe('ohne Anmeldung: Gruppe still unsichtbar, keine Anfrage an ist_verwalter', !ohne.sichtbar && !ohne.text && ohne.fragen === 0, ohne);
  pruefe('ohne Anmeldung: kein Konsolenfehler', ohne.fehler.length === 0, ohne.fehler);

  const kein = await zustand(browser, { recht: false });
  pruefe('ohne Recht: Gruppe still unsichtbar, nicht im Menue', kein.fragen === 1 && !kein.sichtbar && !kein.text && !kein.inNav, kein);
  pruefe('ohne Recht: kein Konsolenfehler', kein.fehler.length === 0, kein.fehler);

  const offline = await zustand(browser, { recht: 'offline' });
  pruefe('offline: Gruppe still unsichtbar', offline.fragen >= 1 && !offline.sichtbar && !offline.text, offline);
  pruefe('offline: kein Konsolenfehler', offline.fehler.length === 0, offline.fehler);

  const fehlt = await zustand(browser, { recht: 'fehlt' });
  pruefe('SQL fehlt (404): Gruppe still unsichtbar', fehlt.fragen >= 1 && !fehlt.sichtbar && !fehlt.text, fehlt);
  pruefe('SQL fehlt (404): kein Konsolenfehler', fehlt.fehler.length === 0, fehlt.fehler);

  // Die Gruppe haengt an der Anmeldung, nicht am #konto-Merker (Kaltreview 14.11.2026): wer sich ueber
  // #einstellungen/konto anmeldet, hat den Merker nicht, der Verwalter sieht die Verwaltung trotzdem
  const ohneMerker = await zustand(browser, { recht: true, konto: false });
  pruefe('angemeldet ohne #konto-Merker: Verwalter sieht Gruppe und Menue-Eintrag', ohneMerker.fragen === 1 && ohneMerker.sichtbar
    && ohneMerker.inNav, ohneMerker);
  pruefe('angemeldet ohne #konto-Merker: kein Konsolenfehler', ohneMerker.fehler.length === 0, ohneMerker.fehler);
  const nichts = await zustand(browser, { sitzung: null, konto: false });
  pruefe('ohne Sitzung und ohne Merker: keine Anfrage an ist_verwalter, Gruppe unsichtbar', nichts.fragen === 0 && !nichts.sichtbar
    && !nichts.text, nichts);

  // Gegenprobe: das Paket steht in PAKETE und zeigt die Gruppe dem Verwalter, ohne ?erw. ist_verwalter antwortet spaet,
  // das Menue ist dann schon gebaut und muss den Eintrag nachreichen
  const flo = await zustand(browser, { recht: true, spaet: 1500, probe: (s) => s.evaluate(async () => {
    // Verstecken und wieder Zeigen der Gruppe: je genau ein Neubau des Menues, keine Schleife
    const g = document.querySelector('.vw-gruppe');
    const pause = () => new Promise((r) => setTimeout(r, 300));
    const a = window.__neubau;
    g.hidden = true; await pause();
    const b = window.__neubau;
    g.hidden = false; await pause();
    return { versteckt: b - a, gezeigt: window.__neubau - b };
  }) });
  pruefe('Gegenprobe Verwalter: Gruppe da und sichtbar (Paket aus PAKETE geladen, ohne ?erw)', flo.da && flo.sichtbar && flo.text, flo);
  pruefe('Verwalter am PC: Eintrag im Menue, obwohl ist_verwalter erst nach dem Menue antwortet', flo.navVorher > 0 && flo.inNav, flo);
  pruefe('Verwalter am PC: das Menue wird bei der spaeten Antwort genau einmal neu gebaut', flo.neubau === 1, flo.neubau);
  pruefe('Verwalter am PC: Verstecken und Zeigen der Gruppe baut das Menue je genau einmal neu (keine Schleife)',
    flo.probe?.versteckt === 1 && flo.probe?.gezeigt === 1, flo.probe);
  pruefe('Menue-Zeichen der Verwaltung: das Konto-Zeichen aus dem Verzeichnis, nicht der Ersatz "regler"',
    !!flo.zeichen && flo.zeichen === flo.kontoZeichen, { zeichen: flo.zeichen, konto: flo.kontoZeichen });
  pruefe('Menue: kein Zwischentitel doppelt', flo.abschnitte.length > 0 && new Set(flo.abschnitte).size === flo.abschnitte.length, flo.abschnitte);
  pruefe('Verwalter am PC: kein Konsolenfehler', flo.fehler.length === 0, flo.fehler);

  // Verlassen vor der Antwort: danach baut niemand mehr am alten Menue (Beobachter getrennt), zurueck ist alles wieder da
  const weg = await zustand(browser, { recht: true, spaet: 1500, verlassen: true, probe: async (s) => {
    await s.evaluate(() => { location.hash = '#einstellungen'; });
    await s.waitForSelector('.es-inhalt', { state: 'attached', timeout: 15000 });
    await warte(900);
    return s.evaluate((titel) => [...document.querySelectorAll('.es-nav-punkt')].some((b) => b.textContent.includes(titel)), DE.titel);
  } });
  pruefe('Einstellungen vor der Antwort verlassen: danach kein Neubau des alten Menues, kein Fehler', weg.fragen === 1 && weg.neubau === 0
    && weg.fehler.length === 0, weg);
  pruefe('nach der Rueckkehr in die Einstellungen: Verwaltung wieder im Menue', weg.probe === true, weg.probe);

  // Deep Link am Handy: die Seite der Verwaltung oeffnet, sobald die spaete Antwort sie sichtbar macht
  const tief = await zustand(browser, { recht: true, spaet: 1500, handy: true, hash: '#einstellungen/verwaltung' });
  pruefe('Deep Link #einstellungen/verwaltung am Handy: Seite der Verwaltung offen nach der spaeten Antwort', tief.offen && tief.sichtbar
    && tief.kopf === DE.titel, tief);
  pruefe('Deep Link am Handy: kein Konsolenfehler', tief.fehler.length === 0, tief.fehler);

  // Kaltreview 14.11.2026 (Runde 2): An- und Abmelden, waehrend die Einstellungen offen sind. Die Konto-Gruppe zeichnet
  // sich dabei neu (js/konto.js, Uhr 1 s); die Verwaltung folgt ohne Verlassen und Wiederkommen, je Wechsel ein Neubau
  const imBlick = (s) => s.evaluate((titel) => {
    const g = document.querySelector('.vw-gruppe');
    return { sichtbar: !!g && !g.hidden && g.getClientRects().length > 0,
      inNav: [...document.querySelectorAll('.es-nav-punkt')].some((b) => b.textContent.includes(titel)), neubau: window.__neubau };
  }, DE.titel);
  const an = await zustand(browser, { sitzung: null, recht: true, hash: '#einstellungen/konto', probe: async (s) => {
    const vorher = await imBlick(s);
    await s.evaluate((x) => localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(x)), SITZUNG);
    await warte(3000);
    return { vorher, nachher: await imBlick(s) };
  } });
  pruefe('Anmeldung bei offenen Einstellungen: Verwaltung erscheint ohne Verlassen (Gruppe und Menue), genau eine Anfrage',
    !an.probe.vorher.sichtbar && an.probe.nachher.sichtbar && an.probe.nachher.inNav && an.fragen === 1, { probe: an.probe, fragen: an.fragen });
  pruefe('Anmeldung bei offenen Einstellungen: das Menue wird genau einmal neu gebaut', an.probe.nachher.neubau - an.probe.vorher.neubau === 1,
    an.probe);
  pruefe('Anmeldung bei offenen Einstellungen: kein Konsolenfehler', an.fehler.length === 0, an.fehler);
  const ab = await zustand(browser, { recht: true, hash: '#einstellungen/konto', probe: async (s) => {
    const vorher = await imBlick(s);
    await s.evaluate(() => localStorage.removeItem('schach-arena:konto:sitzung'));
    await warte(3000);
    return { vorher, nachher: await imBlick(s) };
  } });
  pruefe('Abmeldung bei offenen Einstellungen: Verwaltung verschwindet sofort (Gruppe und Menue), keine neue Anfrage',
    ab.probe.vorher.sichtbar && !ab.probe.nachher.sichtbar && !ab.probe.nachher.inNav && ab.fragen === 1, { probe: ab.probe, fragen: ab.fragen });
  pruefe('Abmeldung bei offenen Einstellungen: das Menue wird genau einmal neu gebaut', ab.probe.nachher.neubau - ab.probe.vorher.neubau === 1,
    ab.probe);
  pruefe('Abmeldung bei offenen Einstellungen: kein Konsolenfehler', ab.fehler.length === 0, ab.fehler);
  // Kaltreview Runde 3: Abmelden verwirft die gemerkte Antwort auch im Weg ueber die Gruppe; meldet sich dasselbe Konto
  // wieder an, wird neu gefragt (sonst bliebe ein inzwischen entzogenes Recht in der Anzeige stehen)
  const wieder = await zustand(browser, { recht: true, hash: '#einstellungen/konto', probe: async (s) => {
    await s.evaluate(() => localStorage.removeItem('schach-arena:konto:sitzung'));
    await warte(3000);
    const zwischen = await imBlick(s);
    await s.evaluate((x) => localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(x)), SITZUNG);
    await warte(3000);
    return { zwischen, nachher: await imBlick(s) };
  } });
  pruefe('Ab- und Wiederanmeldung desselben Kontos bei offenen Einstellungen: neu gefragt (2 Anfragen), Gruppe wieder da',
    !wieder.probe.zwischen.sichtbar && wieder.probe.nachher.sichtbar && wieder.fragen === 2, { probe: wieder.probe, fragen: wieder.fragen });

  // R18: zwei sich kreuzende Antworten. Die Anfrage der ersten Anmeldung antwortet erst, nachdem das Konto ab- und wieder
  // angemeldet ist und die zweite Anfrage schon beantwortet wurde. Gezaehlt wird nur die juengste Anfrage: die spaete
  // Antwort einer frueheren Anmeldung ueberschreibt sie nie, und wer nicht Verwalter ist, sieht die Verwaltung nie, auch
  // nicht kurz (Abtastung alle 10 ms und bei jeder Aenderung des hidden-Attributs)
  const kreuz = (folge) => zustand(browser, { sitzung: null, hash: '#einstellungen/konto', folge, probe: async (s, z) => {
    await s.evaluate(() => {
      window.__gesehen = 0;
      const sieh = () => { const g = document.querySelector('.vw-gruppe'); if (g && !g.hidden && g.getClientRects().length) window.__gesehen++; };
      setInterval(sieh, 10);
      new MutationObserver(sieh).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
    });
    const bis = async (f, ms = 8000) => { const ende = Date.now() + ms; while (!f() && Date.now() < ende) await warte(25); };
    const an = () => s.evaluate((x) => localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify(x)), SITZUNG);
    await an();
    await bis(() => z.fragen() >= 1);
    await s.evaluate(() => localStorage.removeItem('schach-arena:konto:sitzung'));
    await warte(1500);
    await an();
    await bis(() => z.fragen() >= 2);
    await bis(() => z.beantwortet() >= 2, 10000);
    await warte(600);
    return { ...(await imBlick(s)), gesehen: await s.evaluate(() => window.__gesehen) };
  } });
  const spaetJa = await kreuz([{ recht: true, spaet: 5000 }, { recht: false, spaet: 0 }]);
  pruefe('R18 sich kreuzende Antworten: die spaete Antwort kam zuletzt (Anfrage 2 vor Anfrage 1)',
    spaetJa.fragen === 2 && spaetJa.reihenfolge.join() === '2,1', { fragen: spaetJa.fragen, reihenfolge: spaetJa.reihenfolge });
  pruefe('R18 spaete Antwort "Verwalter" der frueheren Anmeldung: wer nicht Verwalter ist, sieht die Verwaltung nie, auch nicht kurz',
    !spaetJa.probe.sichtbar && !spaetJa.probe.inNav && spaetJa.probe.gesehen === 0, spaetJa.probe);
  pruefe('R18 spaete Antwort "Verwalter": kein Konsolenfehler', spaetJa.fehler.length === 0, spaetJa.fehler);
  const spaetNein = await kreuz([{ recht: false, spaet: 5000 }, { recht: true, spaet: 0 }]);
  pruefe('R18 Gegenrichtung: die spaete Antwort kam zuletzt', spaetNein.fragen === 2 && spaetNein.reihenfolge.join() === '2,1',
    { fragen: spaetNein.fragen, reihenfolge: spaetNein.reihenfolge });
  pruefe('R18 spaete Antwort "kein Recht" der frueheren Anmeldung: die neuere Antwort bleibt, Verwaltung sichtbar',
    spaetNein.probe.sichtbar && spaetNein.probe.inNav, spaetNein.probe);
  pruefe('R18 spaete Antwort "kein Recht": kein Konsolenfehler', spaetNein.fehler.length === 0, spaetNein.fehler);
  // R18: direkter Wechsel vom Verwalter-Konto zu einem anderen Konto ohne Abmelden dazwischen (z. B. aus einem anderen
  // Tab). Solange die Antwort fuer das neue Konto aussteht, ist die Verwaltung schon weg; bleibt sie offline aus, auch
  for (const [art, zweite] of [['kein Recht', { recht: false, spaet: 3000 }], ['offline', { recht: 'offline', spaet: 3000 }]]) {
    const wechsel = await zustand(browser, { hash: '#einstellungen/konto', folge: [{ recht: true, spaet: 0 }, zweite], probe: async (s, z) => {
      const bis = async (f, ms = 8000) => { const ende = Date.now() + ms; while (!f() && Date.now() < ende) await warte(25); };
      const vorher = await imBlick(s);
      // wie ein anderer Tab: Speicher schreiben und das storage-Ereignis melden (im selben Tab feuert es nicht von selbst)
      await s.evaluate((x) => {
        const neu = JSON.stringify(x);
        localStorage.setItem('schach-arena:konto:sitzung', neu);
        window.dispatchEvent(new StorageEvent('storage', { key: 'schach-arena:konto:sitzung', newValue: neu }));
      }, SITZUNG_B);
      await bis(() => z.fragen() >= 2);
      await warte(300);
      const offen = { ...(await imBlick(s)), beantwortet: z.beantwortet() };
      await bis(() => z.beantwortet() >= 2, 10000);
      await warte(600);
      return { vorher, offen, nachher: await imBlick(s) };
    } });
    pruefe(`R18 direkter Kontowechsel (${art}): vorher sichtbar, waehrend die Antwort aussteht schon weg, danach weg`,
      wechsel.fragen === 2 && wechsel.probe.vorher.sichtbar && wechsel.probe.offen.beantwortet === 1 && !wechsel.probe.offen.sichtbar
      && !wechsel.probe.offen.inNav && !wechsel.probe.nachher.sichtbar && !wechsel.probe.nachher.inNav, { fragen: wechsel.fragen, probe: wechsel.probe });
    pruefe(`R18 direkter Kontowechsel (${art}): kein Konsolenfehler`, wechsel.fehler.length === 0, wechsel.fehler);
  }

  const floHandy = await zustand(browser, { recht: true, spaet: 1500, handy: true });
  pruefe('Verwalter am Handy: Eintrag in der Liste nach spaeter Antwort', floHandy.navVorher > 0 && floHandy.inNav, floHandy);
  pruefe('Verwalter am Handy: Tipp oeffnet die Seite der Verwaltung', !!floHandy.seiteAuf?.offen && floHandy.seiteAuf.sichtbar
    && floHandy.seiteAuf.hash === '#einstellungen/verwaltung', floHandy.seiteAuf);
  pruefe('Verwalter am Handy: kein Konsolenfehler', floHandy.fehler.length === 0, floHandy.fehler);

  const keinHandy = await zustand(browser, { recht: false, spaet: 1500, handy: true });
  pruefe('ohne Recht am Handy: kein Eintrag in der Liste, Gruppe unsichtbar', keinHandy.fragen === 1 && !keinHandy.inNav && !keinHandy.sichtbar, keinHandy);
  pruefe('ohne Recht am Handy: kein Konsolenfehler', keinHandy.fehler.length === 0, keinHandy.fehler);
}

// Der Servertest der Verwaltung braucht PGlite und laeuft darum im CI-Job sql, nicht ueber tests/alle.mjs (dort fehlt
// PGlite im Browser-Job, R17-sammelfix2)
pruefe('CI-Job sql fuehrt die Suite server-verwaltung', /run: node tests\/server-verwaltung\.test\.mjs/
  .test(readFileSync(path.join(WURZEL, '.github/workflows/tests.yml'), 'utf8')));
pruefe('tests/alle.mjs fuehrt server-verwaltung nicht (PGlite nur im CI-Job sql)', !/name: 'server-verwaltung'/
  .test(readFileSync(path.join(WURZEL, 'tests/alle.mjs'), 'utf8')));

let server = null;
let browser = null;
try {
  const pw = ladePlaywright();
  server = spawn(process.execPath, ['tests/testserver.mjs', String(PORT), '--bind', '127.0.0.1'], { cwd: WURZEL, stdio: 'ignore' });
  await warteAufServer(`http://127.0.0.1:${PORT}/index.html`);
  browser = await browserTyp(pw).launch();
  await browserTeil(browser);
} catch (e) {
  pruefe('Browser-Teil lief ohne Ausnahme', false, e && (e.stack || e.message));
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) server.kill();
}
console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
