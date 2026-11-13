// Befund-Funktionen der Ansichts-Pruefung (tests/ansicht.test.mjs). befundeDerSeite und untenFrei laufen per page.evaluate
// IN der Seite, darum ganz ohne Bezug auf diese Datei; kontrastBefunde(page) laeuft in Node (Kontrast, Feinschliff R9).
// tests/ansicht-befunde.test.mjs prueft alle an festen Probe-Seiten.

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

// ---------- Kontrast (Feinschliff R9) ----------
// Laeuft in der Seite: Text unter dem WCAG-Soll (4,5:1, grosse Schrift 3:1), Hintergrund ueber die Vorfahren gerechnet.
// Wie befundeDerSeite zaehlt nichts unter [inert], [aria-hidden], .sr oder einem unsichtbaren Vorfahren, dazu nichts
// Deaktiviertes (WCAG 1.4.3 nimmt inaktive Bedienelemente aus) und keine Brett- oder SVG-Schrift.
export function kontrastDerSeite() {
  const rgb = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v[3] ?? 1 }; };
  const lum = (c) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const mix = (o, u) => ({ r: o.r * o.a + u.r * (1 - o.a), g: o.g * o.a + u.g * (1 - o.a), b: o.b * o.a + u.b * (1 - o.a), a: 1 });
  const kon = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const versteckt = (el) => !!el.closest('[aria-hidden="true"], [hidden], .sr, [inert]')
    || (typeof el.checkVisibility === 'function' && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true }));
  const gefuellt = (st) => (rgb(st.backgroundColor)?.a || 0) > 0 || (st.backgroundImage && st.backgroundImage !== 'none');
  // Hintergrund ueber die Vorfahren: Schichten bis zur ersten deckenden Farbe, darunter die Seite. Eindeutig ist er nur,
  // wenn dabei kein Verlauf oder Bild, keine teiltransparente Schicht und keine gefuellte ::before/::after-Ebene liegt.
  const hinter = (el) => {
    const stapel = []; let x = el, grund = null;
    for (; x && x.nodeType === 1; x = x.parentElement) {
      const st = getComputedStyle(x);
      if (st.backgroundImage && st.backgroundImage !== 'none') return { unklar: 'verlauf oder bild' };
      for (const ps of ['::before', '::after']) {
        const q = getComputedStyle(x, ps);
        if (q.content !== 'none' && q.content !== 'normal' && gefuellt(q)) return { unklar: 'ebene ' + ps };
      }
      const c = rgb(st.backgroundColor);
      if (c && c.a > 0) { if (c.a < 1) return { unklar: 'teiltransparent' }; stapel.push(c); grund = x; break; }
    }
    let b = { r: 255, g: 255, b: 255, a: 1 };
    if (!grund) { const c = rgb(getComputedStyle(document.body).backgroundColor); if (c && c.a >= 1) b = c; }
    for (let i = stapel.length - 1; i >= 0; i--) b = mix(stapel[i], b);
    return { farbe: b, grund };
  };
  // Geschwister-Ebene: liegt zwischen dem Text und seinem Grund ein fremdes, gefuelltes Element (Banner, Bild, Balken)?
  // Liegt dagegen etwas Gefuelltes UEBER dem Text (eine Leiste, ein Blatt) oder trifft der Punkt den Text gar nicht, ist er
  // verdeckt: keine Kontrastfrage (das prueft "unten frei"), sondern unklar.
  const voll = (e) => /^(IMG|CANVAS|VIDEO|svg)$/i.test(e.tagName) || gefuellt(getComputedStyle(e));
  const fremdeEbene = (el, grund, r) => {
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return 'ausserhalb';
    const stapel = document.elementsFromPoint(x, y);
    const ab = stapel.findIndex((e) => e === el || el.contains(e));
    if (ab < 0 || stapel.slice(0, ab).some((e) => !e.contains(el) && voll(e))) return 'verdeckt';
    for (const e of stapel.slice(ab + 1)) {
      if (el.contains(e)) continue;
      if (e === grund || e === document.body || e === document.documentElement) return null;
      if (e.contains(el)) continue;
      if (voll(e)) return 'geschwister-ebene';
    }
    return null;
  };
  const aus = { befunde: [], kandidaten: [], gemessen: 0 };
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const gesehen = new Set(); let n, nr = 0;
  while ((n = tw.nextNode())) {
    const el = n.parentElement;
    if (!el || gesehen.has(el) || !n.textContent.trim()) continue; gesehen.add(el);
    if (el.closest('svg, .brett, [disabled], [aria-disabled="true"]') || versteckt(el)) continue;
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    const st = getComputedStyle(el); const f = rgb(st.color); if (!f) continue;
    const px = parseFloat(st.fontSize), gross = px >= 24 || (px >= 18.66 && +st.fontWeight >= 700), soll = gross ? 3 : 4.5;
    const text = n.textContent.trim().slice(0, 30);
    aus.gemessen++;
    const h = hinter(el);
    // verdeckt oder ausserhalb geht vor dem Vorfahren-Grund: dann ist auch kein Pixel-Mass moeglich
    const ebene = fremdeEbene(el, h.grund, r);
    const unklar = ebene === 'verdeckt' || ebene === 'ausserhalb' ? ebene : h.unklar || ebene;
    if (unklar) {
      // Pixel-Weg (kontrastBefunde): Element markieren, Masse und Farbe mitgeben
      el.dataset.kontrastNr = String(nr);
      aus.kandidaten.push({ nr: nr++, text, soll, px, grund: unklar, farbe: [f.r, f.g, f.b, f.a],
        r: { x: r.left, y: r.top, w: r.width, h: r.height } });
      continue;
    }
    const vorne = f.a < 1 ? mix(f, h.farbe) : f;
    const k = kon(vorne, h.farbe);
    if (k < soll) aus.befunde.push({ text, k: +k.toFixed(2), soll, px, weg: 'vorfahren' });
  }
  return aus;
}

// PNG (8 bit, RGB oder RGBA, ohne Zeilensprung, wie Playwright es liefert) zu Pixeln; nur zlib, keine Pakete
async function pngPixel(buf) {
  const { inflateSync } = await import('node:zlib');
  let p = 8, w = 0, h = 0, typ = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), art = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (art === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); typ = d[9]; if (d[8] !== 8 || d[12] !== 0 || (typ !== 2 && typ !== 6)) return null; }
    if (art === 'IDAT') idat.push(d);
    p += 12 + len;
  }
  const bpp = typ === 6 ? 4 : 3, roh = inflateSync(Buffer.concat(idat)), zeile = w * bpp, out = Buffer.alloc(h * zeile);
  for (let y = 0; y < h; y++) {
    const f = roh[y * (zeile + 1)], q = roh.subarray(y * (zeile + 1) + 1, (y + 1) * (zeile + 1));
    for (let x = 0; x < zeile; x++) {
      const a = x >= bpp ? out[y * zeile + x - bpp] : 0, b = y ? out[(y - 1) * zeile + x] : 0, c = x >= bpp && y ? out[(y - 1) * zeile + x - bpp] : 0;
      let v = q[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * zeile + x] = v & 255;
    }
  }
  return { w, h, bpp, daten: out };
}

// Laeuft in Node: Kontrast-Befunde einer Seite (page = Playwright-Seite). Eindeutige Faelle rechnet kontrastDerSeite ueber
// die Vorfahren; die uebrigen misst sie per Pixel: Text der Kandidaten durchsichtig, ein Bild des Fensters, je Kandidat die
// Textfarbe gegen jeden Pixel seines Kastens, Massstab das 10. Perzentil (einzelne Pixel am Rand eines Scheins zaehlen
// nicht). Geht auch das nicht (ausserhalb des Fensters, leerer Kasten), ist der Fall "unklar" und kein Befund.
export async function kontrastBefunde(page) {
  const aus = await page.evaluate(kontrastDerSeite);
  aus.unklar = []; aus.pixel = 0;
  const nichtMessbar = (x) => x.grund === 'ausserhalb' || x.grund === 'verdeckt';
  const messbar = aus.kandidaten.filter((x) => !nichtMessbar(x));
  for (const x of aus.kandidaten) if (nichtMessbar(x)) aus.unklar.push({ text: x.text, grund: x.grund });
  if (messbar.length) {
    await page.evaluate(() => {
      for (const e of document.querySelectorAll('[data-kontrast-nr]')) for (const t of [e, ...e.querySelectorAll('*')]) {
        t.dataset.kontrastStil = t.getAttribute('style') ?? '\u0000';
        t.style.setProperty('color', 'transparent', 'important'); t.style.setProperty('-webkit-text-fill-color', 'transparent', 'important');
        t.style.setProperty('text-shadow', 'none', 'important'); t.style.setProperty('caret-color', 'transparent', 'important');
      }
    });
    let bild = null, iw = 0;
    try { bild = await pngPixel(await page.screenshot({ type: 'png' })); iw = await page.evaluate(() => innerWidth); }
    finally {
      await page.evaluate(() => {
        for (const t of document.querySelectorAll('[data-kontrast-stil]')) {
          if (t.dataset.kontrastStil === '\u0000') t.removeAttribute('style'); else t.setAttribute('style', t.dataset.kontrastStil);
          delete t.dataset.kontrastStil;
        }
      });
    }
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    for (const x of messbar) {
      const sk = bild ? bild.w / iw : 0;
      const x0 = Math.max(0, Math.floor(x.r.x * sk)), y0 = Math.max(0, Math.floor(x.r.y * sk));
      const x1 = bild ? Math.min(bild.w, Math.ceil((x.r.x + x.r.w) * sk)) : 0, y1 = bild ? Math.min(bild.h, Math.ceil((x.r.y + x.r.h) * sk)) : 0;
      if (!bild || x1 <= x0 || y1 <= y0) { aus.unklar.push({ text: x.text, grund: 'kein bild' }); continue; }
      const [fr, fg, fb, fa] = x.farbe, ks = [];
      for (let y = y0; y < y1; y++) for (let xx = x0; xx < x1; xx++) {
        const i = (y * bild.w + xx) * bild.bpp, p = [bild.daten[i], bild.daten[i + 1], bild.daten[i + 2]];
        const v = fa < 1 ? [fr * fa + p[0] * (1 - fa), fg * fa + p[1] * (1 - fa), fb * fa + p[2] * (1 - fa)] : [fr, fg, fb];
        const l1 = lum(v), l2 = lum(p); ks.push((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05));
      }
      ks.sort((a, b) => a - b);
      const k = ks[Math.floor(ks.length * 0.1)];
      aus.pixel++;
      if (k < x.soll) aus.befunde.push({ text: x.text, k: +k.toFixed(2), soll: x.soll, px: x.px, weg: 'pixel', grund: x.grund });
    }
  }
  await page.evaluate(() => { for (const e of document.querySelectorAll('[data-kontrast-nr]')) delete e.dataset.kontrastNr; });
  delete aus.kandidaten;
  return aus;
}
