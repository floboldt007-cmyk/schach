import path from 'node:path';

// Waehlt die Browser-Engine fuer alle Playwright-Suiten. Ohne BROWSER bleibt
// Chromium der Standard; WebKit kann lokal und in CI explizit aktiviert werden.
// Absturz-Protokoll (R19, Analyse f1 R19-Kritik/absturz-ursache.md): launch() haengt an jede Seite page.on('crash'), damit die
// Absturzzeile Suite, Ansicht (Hash der letzten Adresse) und Viewport nennt. Die Zeile enthaelt "Target crashed", so erkennt
// tests/alle.mjs den Absturz auch dann, wenn die Suite den Fehler selbst faengt.
export function browserTyp(playwright) {
  const name = process.env.BROWSER || 'chromium';
  if (!['chromium', 'webkit'].includes(name)) {
    throw new Error(`Unbekannter BROWSER \"${name}\" (erlaubt: chromium, webkit)`);
  }
  const typ = playwright[name];
  return new Proxy(typ, {
    get(ziel, schluessel) {
      if (schluessel === 'launch') return async (...args) => mitAbsturzMeldung(await ziel.launch(...args));
      const wert = Reflect.get(ziel, schluessel);
      return typeof wert === 'function' ? wert.bind(ziel) : wert;
    },
  });
}

const SUITE = path.basename(process.argv[1] || 'unbekannt');
const gemeldet = new WeakSet();

function meldeAbsturz(seite) {
  if (gemeldet.has(seite)) return;
  gemeldet.add(seite);
  // chrome://crash und aehnliche Adressen sind der Absturz selbst, nicht die Ansicht davor
  let adresse = seite.url();
  seite.on('framenavigated', (rahmen) => {
    if (rahmen === seite.mainFrame() && !/^chrome:/.test(rahmen.url())) adresse = rahmen.url();
  });
  seite.on('crash', () => {
    let ansicht;
    try { ansicht = new URL(adresse).hash || '#/'; } catch (e) { ansicht = adresse || '-'; }
    const v = seite.viewportSize();
    console.log(`FEHLER Seite abgestuerzt (Target crashed) in ${SUITE}: Ansicht ${ansicht}, Viewport ${v ? `${v.width}x${v.height}` : 'ohne'}`);
  });
}

// browser.newPage laeuft in Playwright 1.64.1 ueber browser.newContext; die WeakSet verhindert die doppelte Meldung
function mitAbsturzMeldung(browser) {
  const neuerKontext = browser.newContext.bind(browser);
  const neueSeite = browser.newPage.bind(browser);
  browser.newContext = async (...args) => {
    const kontext = await neuerKontext(...args);
    kontext.on('page', meldeAbsturz);
    return kontext;
  };
  browser.newPage = async (...args) => {
    const seite = await neueSeite(...args);
    meldeAbsturz(seite);
    return seite;
  };
  return browser;
}

// Finger-Treiber ohne CDP (Premium-Umbau U6): synthetische Zeiger-Ereignisse mit pointerType 'touch' per
// page.evaluate, damit die Suiten auch in WebKit laufen (Input.dispatchTouchEvent gibt es nur in Chromium).
// Der Zeiger-Fang wird nachgebildet: pointermove/pointerup gehen an das Element, das pointerdown bekommen hat
// (wie beim echten Finger, den das Brett mit setPointerCapture faengt). Mehrere Finger ueber id (1 = erster).
//   const finger = fingerTreiber(seite);
//   await finger.runter(x, y); await finger.bewege(x2, y2); await finger.hoch(x2, y2);
//   await finger.ziehe([[x, y], [x2, y2]], { schritte: 8, mitte: async () => {...} });
//   await finger.seitAufsetzen()   ms seit dem letzten Aufsetzen von Finger 1 (fuer Fehlermeldungen)
//
// Halte-Uhr (07.11.2026): Das Brett macht aus 400 ms Stillhalten einen Pfeil statt eines Zugs (js/board.js HALTEN_MALEN).
// Frueher wartete der Treiber NACH dem Aufsetzen auf ein Bild und eine weitere Rundreise; in WebKit vergingen so bis zur
// ersten Bewegung gemessen 226 bis 474 ms, und Zieh-Pruefungen wurden zufaellig zu Mal-Gesten (CI-Lauf 42299790934).
// Jetzt kommt das Bild VOR dem Aufsetzen, und ziehe() schickt Aufsetzen und alle Bewegungen in EINER Seitenrunde.
// Tests, die absichtlich halten, warten wie bisher selbst (warte/warteSeite nach runter).

// laeuft in der Seite: schickt die Ereignisse der Reihe nach, mit Bild nach jedem ausser dem letzten, wenn bild gesetzt
async function seitenFinger({ ereignisse, bild }) {
  const finger = (window.__finger = window.__finger || { ziel: {}, auf: {}, erste: {} });
  for (let i = 0; i < ereignisse.length; i++) {
    const [typ, x, y, id] = ereignisse[i];
    let ziel;
    if (typ === 'pointerdown') {
      ziel = document.elementFromPoint(x, y) || document.body;
      finger.ziel[id] = ziel;
      finger.auf[id] = performance.now();
      finger.erste[id] = null;
    } else ziel = finger.ziel[id] || document.elementFromPoint(x, y) || document.body;
    if (typ === 'pointermove' && finger.erste[id] === null) finger.erste[id] = Math.round(performance.now() - finger.auf[id]);
    const ende = typ === 'pointerup' || typ === 'pointercancel';
    ziel.dispatchEvent(new PointerEvent(typ, {
      pointerType: 'touch', pointerId: id, isPrimary: id === 1, clientX: x, clientY: y, screenX: x, screenY: y,
      bubbles: true, cancelable: true, composed: true, button: typ === 'pointermove' ? -1 : 0, buttons: ende ? 0 : 1,
      width: 16, height: 16, pressure: ende ? 0 : 0.5,
    }));
    if (ende) delete finger.ziel[id];
    // Aufsetzen und erste Bewegung ohne Pause: die erste Bewegung ab 8 px loescht die Halte-Uhr (board.js), und ein
    // Bild dazwischen dauerte im CI-WebKit bis 474 ms. Erst danach je Schritt ein Bild.
    if (bild && i > 0 && i < ereignisse.length - 1) await new Promise((fertig) => requestAnimationFrame(() => fertig()));
  }
}

export function fingerTreiber(seite) {
  // Echte Eingaben aktivieren die Seite und durchlaufen einen Render-Schritt. evaluate() allein tut das in WebKit
  // nicht: Halte-Timer und CSS-Federn duerften sonst wie in einer Hintergrundseite warten. Deshalb vor jedem Aufsetzen
  // nach vorn holen und ein Bild abwarten; das Aufsetzen selbst ist dann das Letzte der Runde.
  const wecke = async () => {
    await seite.bringToFront();
    await seite.evaluate(() => new Promise((fertig) => requestAnimationFrame(() => fertig())));
  };
  const sende = async (typ, x, y, id) => {
    if (typ === 'pointerdown') await wecke();
    await seite.evaluate(seitenFinger, { ereignisse: [[typ, x, y, id]], bild: false });
  };
  const t = {
    runter: (x, y, id = 1) => sende('pointerdown', x, y, id),
    bewege: (x, y, id = 1) => sende('pointermove', x, y, id),
    hoch: (x, y, id = 1) => sende('pointerup', x, y, id),
    abbruch: (x, y, id = 1) => sende('pointercancel', x, y, id),
    // ms seit dem letzten Aufsetzen dieses Fingers und bis zu seiner ersten Bewegung (null: noch keine)
    seitAufsetzen: (id = 1) => seite.evaluate((i) => {
      const f = window.__finger;
      return f && f.auf[i] !== undefined ? { seit: Math.round(performance.now() - f.auf[i]), ersteBewegung: f.erste[i] } : null;
    }, id),
    // Finger setzt bei punkte[0] auf, gleitet in schritte ueber alle Punkte und hebt am letzten ab. Aufsetzen und
    // Gleiten laufen in einer Seitenrunde (ein Bild je Schritt), damit die Halte-Uhr nie dazwischenkommt.
    async ziehe(punkte, { id = 1, schritte = 8, mitte = null } = {}) {
      const ereignisse = [['pointerdown', punkte[0][0], punkte[0][1], id]];
      for (let p = 1; p < punkte.length; p++) {
        const [ax, ay] = punkte[p - 1];
        const [bx, by] = punkte[p];
        for (let i = 1; i <= schritte; i++) ereignisse.push(['pointermove', ax + (bx - ax) * i / schritte, ay + (by - ay) * i / schritte, id]);
      }
      await wecke();
      await seite.evaluate(seitenFinger, { ereignisse, bild: true });
      if (mitte) await mitte();
      const [xe, ye] = punkte[punkte.length - 1];
      await t.hoch(xe, ye, id);
    },
  };
  return t;
}
