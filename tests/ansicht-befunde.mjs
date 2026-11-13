// Befund-Funktionen der Ansichts-Pruefung (tests/ansicht.test.mjs). Beide laufen per page.evaluate IN der Seite, darum
// ganz ohne Bezug auf diese Datei; tests/ansicht-befunde.test.mjs prueft sie an festen Probe-Seiten.

// Laeuft in der Seite: Befunde des sichtbaren Zustands
export function befundeDerSeite() {
  const W = innerWidth;
  const sichtbar = (el) => {
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none' || +st.opacity === 0) return false;
    const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  };
  const pfad = (el) => {
    const t = []; let e = el;
    for (let i = 0; e && e !== document.body && i < 3; i++, e = e.parentElement) {
      t.unshift(e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''));
    }
    return t.join('>');
  };
  // .sr: nur fuer Vorleser (1 x 1 px, absichtlich abgeschnitten). Dazu, was niemand sieht oder erreicht (Feinschliff R8):
  // unter [inert] (stillgelegter Hintergrund hinter einem offenen Blatt) oder unter einem unsichtbaren Vorfahren
  // (opacity 0, visibility hidden, display none); sonst zaehlten Fehlbefunde in Schrift, Rand, Abschneiden und Kappen.
  const unsichtbarerVorfahr = (el) => {
    if (typeof el.checkVisibility === 'function') return !el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    for (let a = el; a && a.nodeType === 1; a = a.parentElement) {
      const st = getComputedStyle(a);
      if (st.display === 'none' || st.visibility === 'hidden' || +st.opacity === 0) return true;
    }
    return false;
  };
  const versteckt = (el) => !!el.closest('[aria-hidden="true"], [hidden], .sr, [inert]') || unsichtbarerVorfahr(el);
  const aus = { ueberlauf: document.documentElement.scrollWidth - W, klein: [], knopf: [], rand: [], ueberlapp: [], abgeschnitten: [], gekappt: [] };
  // Inhalt, der unten abgeschnitten ist und sich nicht scrollen laesst (Flo 30.10.: "kann den unteren Teil nicht sehen")
  for (const el of document.querySelectorAll('.screen, .screen *')) {
    if (!sichtbar(el) || versteckt(el) || el.closest('.welt, .karte, .brett, .duell, .evalbalken')) continue;
    const st = getComputedStyle(el);
    if (/(hidden|clip)/.test(st.overflowY) && el.clientHeight > 120 && el.scrollHeight > el.clientHeight + 24) aus.gekappt.push(`${pfad(el)} ${el.scrollHeight}/${el.clientHeight}`);
  }
  const alle = [...document.querySelectorAll('body *')].filter(sichtbar);
  for (const el of alle) {
    if (versteckt(el)) continue;
    const hatText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    const st = getComputedStyle(el);
    const min = el.closest('.koord, .evalbalken, .an-eb-wert, .an-evalbalken') ? 10 : 12;
    if (hatText && parseFloat(st.fontSize) < min) aus.klein.push(`${pfad(el)} ${st.fontSize} "${el.textContent.trim().slice(0, 24)}"`);
    const r = el.getBoundingClientRect();
    if (r.right > W + 1 || r.left < -1) {
      let a = el.parentElement, gekappt = false;
      while (a && a !== document.documentElement) { if (/(hidden|auto|scroll|clip)/.test(getComputedStyle(a).overflowX)) { gekappt = true; break; } a = a.parentElement; }
      if (!gekappt) aus.rand.push(`${pfad(el)} ${Math.round(r.left)}..${Math.round(r.right)}`);
    }
    if (hatText && /(hidden|clip)/.test(st.overflowX) && el.scrollWidth > el.clientWidth + 2 && st.textOverflow !== 'ellipsis' && !/-webkit-box/.test(st.display)) {
      aus.abgeschnitten.push(`${pfad(el)} "${el.textContent.trim().slice(0, 24)}"`);
    }
  }
  // Brettfelder sind seit dem Brett per Tastatur role="button", Groesse und Lage gibt das Brett vor (WCAG 2.5.8, Ausnahme
  // "wesentlich"); vorher zaehlten sie hier nicht, darum bleiben sie draussen. Knoepfe in [inert] auch: hinter einem
  // offenen Blatt legt die App den Hintergrund still (js/ui/bauteile.js), dort ist nichts antippbar (R6: 43 px hinter dem Ergebnis)
  const knoepfe = alle.filter((el) => el.matches('button, a[href], [role="button"], input:not([type="hidden"]), select, summary, textarea') && !el.closest('.brett-felder, [inert]') && !versteckt(el));
  const flaeche = (el) => {
    const r = el.getBoundingClientRect(); let w = r.width, h = r.height;
    for (const ps of ['::before', '::after']) {
      const q = getComputedStyle(el, ps);
      if (q.content === 'none' || q.position !== 'absolute') continue;
      const n = (v) => Math.max(0, -parseFloat(v) || 0);
      w = Math.max(w, r.width + n(q.left) + n(q.right)); h = Math.max(h, r.height + n(q.top) + n(q.bottom));
    }
    return { w, h };
  };
  for (const el of knoepfe) {
    if (el.matches('input[type="checkbox"], input[type="radio"]')) continue;
    const f = flaeche(el);
    if (f.w < 44 || f.h < 44) aus.knopf.push(`${pfad(el)} ${Math.round(f.w)}x${Math.round(f.h)} "${(el.getAttribute('aria-label') || el.textContent).trim().slice(0, 20)}"`);
  }
  for (let i = 0; i < knoepfe.length; i++) for (let j = i + 1; j < knoepfe.length; j++) {
    const a = knoepfe[i], c = knoepfe[j];
    if (a.contains(c) || c.contains(a)) continue;
    if (a.closest('.welt') || c.closest('.welt')) continue;
    if (a.closest('.reiter-leiste, .cta-platz') || c.closest('.reiter-leiste, .cta-platz')) continue;
    const ra = [...a.getClientRects()], rc = [...c.getClientRects()];
    if (ra.some((x) => rc.some((y) => Math.min(x.right, y.right) - Math.max(x.left, y.left) > 4 && Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) > 4))) {
      aus.ueberlapp.push(`${pfad(a)} / ${pfad(c)}`);
    }
  }
  return aus;
}

// Laeuft in der Seite: ganz nach unten scrollen, dann darf nichts unter Leiste oder Spielen-Flaeche liegen
export async function untenFrei() {
  const deckel = [...document.querySelectorAll('.reiter-leiste, .cta-platz')].filter((d) => getComputedStyle(d).display !== 'none'
    && d.getBoundingClientRect().height > 0 && d.getBoundingClientRect().top > innerHeight / 2);
  if (!deckel.length) return [];
  const roller = [document.scrollingElement, ...[...document.querySelectorAll('body *')].filter((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY))]
    .filter((e) => e && e.scrollHeight > e.clientHeight + 4);
  for (const e of roller) e.scrollTop = e.scrollHeight;
  await new Promise((r) => setTimeout(r, 400));
  const aus = [];
  for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')) {
    // [inert] und unsichtbare Vorfahren: wie in befundeDerSeite (Feinschliff R8), dort ist nichts erreichbar
    if (el.closest('.reiter-leiste, .cta-platz, .welt, [aria-hidden="true"], [inert]')) continue;
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none' || st.position === 'fixed') continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const deckt = deckel.some((d) => { const l = d.getBoundingClientRect(); return Math.min(r.right, l.right) - Math.max(r.left, l.left) > 4 && Math.min(r.bottom, l.bottom) - Math.max(r.top, l.top) > 4; });
    if (deckt) aus.push(`${String(el.className || el.tagName).slice(0, 40)} "${(el.textContent || '').trim().slice(0, 20)}"`);
  }
  for (const e of roller) e.scrollTop = 0;
  return aus;
}
