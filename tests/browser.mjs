// Waehlt die Browser-Engine fuer alle Playwright-Suiten. Ohne BROWSER bleibt
// Chromium der Standard; WebKit kann lokal und in CI explizit aktiviert werden.
export function browserTyp(playwright) {
  const name = process.env.BROWSER || 'chromium';
  if (!['chromium', 'webkit'].includes(name)) {
    throw new Error(`Unbekannter BROWSER \"${name}\" (erlaubt: chromium, webkit)`);
  }
  return playwright[name];
}

// Finger-Treiber ohne CDP (Premium-Umbau U6): synthetische Zeiger-Ereignisse mit pointerType 'touch' per
// page.evaluate, damit die Suiten auch in WebKit laufen (Input.dispatchTouchEvent gibt es nur in Chromium).
// Der Zeiger-Fang wird nachgebildet: pointermove/pointerup gehen an das Element, das pointerdown bekommen hat
// (wie beim echten Finger, den das Brett mit setPointerCapture faengt). Mehrere Finger ueber id (1 = erster).
//   const finger = fingerTreiber(seite);
//   await finger.runter(x, y); await finger.bewege(x2, y2); await finger.hoch(x2, y2);
//   await finger.ziehe([[x, y], [x2, y2]], { schritte: 8, mitte: async () => {...} });
export function fingerTreiber(seite) {
  const sende = async (typ, x, y, id) => {
    // Echte Eingaben aktivieren die Seite und durchlaufen einen Render-Schritt. evaluate() allein tut das in
    // WebKit nicht: Halte-Timer und CSS-Federn duerfen dadurch nicht wie in einer Hintergrundseite warten.
    if (typ === 'pointerdown') await seite.bringToFront();
    await seite.evaluate(({ typ, x, y, id }) => {
      const finger = (window.__finger = window.__finger || {});
      let ziel;
      if (typ === 'pointerdown') {
        ziel = document.elementFromPoint(x, y) || document.body;
        finger[id] = ziel;
      } else ziel = finger[id] || document.elementFromPoint(x, y) || document.body;
      const ende = typ === 'pointerup' || typ === 'pointercancel';
      const ev = new PointerEvent(typ, {
        pointerType: 'touch', pointerId: id, isPrimary: id === 1, clientX: x, clientY: y, screenX: x, screenY: y,
        bubbles: true, cancelable: true, composed: true, button: typ === 'pointermove' ? -1 : 0, buttons: ende ? 0 : 1,
        width: 16, height: 16, pressure: ende ? 0 : 0.5,
      });
      ziel.dispatchEvent(ev);
      if (ende) delete finger[id];
    }, { typ, x, y, id });
    if (typ === 'pointerdown') await seite.evaluate(() => new Promise((fertig) => requestAnimationFrame(fertig)));
  };
  const t = {
    runter: (x, y, id = 1) => sende('pointerdown', x, y, id),
    bewege: (x, y, id = 1) => sende('pointermove', x, y, id),
    hoch: (x, y, id = 1) => sende('pointerup', x, y, id),
    abbruch: (x, y, id = 1) => sende('pointercancel', x, y, id),
    // Finger setzt bei punkte[0] auf, gleitet in schritte ueber alle Punkte und hebt am letzten ab
    async ziehe(punkte, { id = 1, schritte = 8, mitte = null } = {}) {
      const [x0, y0] = punkte[0];
      await t.runter(x0, y0, id);
      for (let p = 1; p < punkte.length; p++) {
        const [ax, ay] = punkte[p - 1];
        const [bx, by] = punkte[p];
        for (let i = 1; i <= schritte; i++) await t.bewege(ax + (bx - ax) * i / schritte, ay + (by - ay) * i / schritte, id);
      }
      if (mitte) await mitte();
      const [xe, ye] = punkte[punkte.length - 1];
      await t.hoch(xe, ye, id);
    },
  };
  return t;
}
