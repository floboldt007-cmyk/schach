// Paket "teilen": zeichnet das Siegesbild auf eine Leinwand (Canvas 2D) im Look A (Papier oder Schiefer, Karte,
// Marke, grosse Display-Schrift, Brett im Sockel, Gold nur fuer Sterne und das Ausrufezeichen).
// zeichne() braucht nur einen 2D-Kontext und ist mit einem Fake-Kontext in Node testbar; die Lader (Farben aus den
// Tokens, Figuren, Portraet, Schriften) brauchen den Browser.
//
//   zeichne(ctx, daten, farben, bilder = {}) -> { texte: [...], felder: 64 }
//       daten: bildDaten() aus logik.js; farben: { '--token': Wert } (TOKENS_THEMA, TOKENS_BRETT, --bot-<id>-tint);
//       bilder: { figuren: { wK: Bild, ... }, portraet: Bild | null }; fehlt ein Bild, steht ein ruhiger Ersatz da
//       (Figur: Kreis mit Buchstabe, Portraet: Initiale). texte: jeder Text, der im Bild steht, in Zeichenfolge.
//   cssRegeln(doc) -> [{ selektor, decls, media }]   alle Custom Properties der eigenen Stylesheets (CSSOM)
//   farbenAusDokument(modus, { doc, themaId }) -> { '--token': Wert }   Theme-Tokens des gewuenschten Modus
//       (ohne den Modus der App umzuschalten), dazu die Brett-Tokens der eingestellten Brettfarbe
//   ladeSvgBild(url, groesse) -> Promise<Bild>       SVG mit fester Groesse als data:-URL (Avatare haben nur viewBox)
//   ladeBilder(daten, { figurenPfad }) -> Promise<{ figuren, portraet }>   nur die Figuren, die auf dem Brett stehen
//   schriftenBereit(farben, ms = 1500) -> Promise    wartet hoechstens ms auf Bricolage und Manrope
//   rendere(canvas, daten, modus, { ohneBilder }) -> Promise<{ texte, modus }>
//   alsDatei(canvas, name) -> Promise<File>          PNG
import { BREITE, HOEHE, TOKENS_THEMA, TOKENS_BRETT, layout, feldRechteck, themaTokens } from './logik.js';

// Formen im 24er Raster (wie js/ui/icons.js 'stern' und 'bauer', die Schriften kennen ★ und ♙ nicht)
const STERN = 'M12 2.6l2.85 5.95 6.5.82-4.78 4.5 1.2 6.46L12 17.2l-5.77 3.13 1.2-6.46-4.78-4.5 6.5-.82z';
const BAUER = 'M12 3.4a2.55 2.55 0 0 1 1.58 4.57c1.42.9 2.25 2.25 2.25 3.83 0 1.12-.45 2.1-1.2 2.85l.9 3.07H8.47l.9-3.07'
  + 'a3.98 3.98 0 0 1-1.2-2.85c0-1.58.83-2.93 2.25-3.83A2.55 2.55 0 0 1 12 3.4z';
const FIGUR_BUCHSTABE = { K: 'K', Q: 'D', R: 'T', B: 'L', N: 'S', P: 'B' };
const RUECKFALL_SCHRIFT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function pfad(d) {
  try { return typeof Path2D === 'function' ? new Path2D(d) : null; } catch (e) { return null; }
}

function rundesRechteck(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

function figurenAus(fen) {
  const out = [];
  const reihen = String(fen || '').split('/');
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const z of reihen[r] || '') {
      if (f >= 8) break;
      if (/[1-8]/.test(z)) { f += Number(z); continue; }
      if (/^[prnbqkPRNBQK]$/.test(z)) {
        out.push({ feld: 'abcdefgh'[f] + (8 - r), farbe: z === z.toUpperCase() ? 'w' : 'b', typ: z.toUpperCase() });
        f++;
      }
    }
  }
  return out;
}

export function zeichne(ctx, daten, farben = {}, bilder = {}) {
  const l = layout();
  const f = (k, rueck) => (farben && typeof farben[k] === 'string' && farben[k].trim()) || rueck;
  const schrift = f('--schrift', RUECKFALL_SCHRIFT);
  const display = f('--display', schrift);
  const texte = [];
  const font = (gewicht, gr, familie) => {
    const soll = `${gewicht} ${gr}px ${familie}`;
    ctx.font = soll;
    // eine Familienliste, die der Kontext nicht versteht, ersetzt er nicht: dann die Systemschrift
    if (typeof ctx.font === 'string' && !ctx.font.includes(`${gr}px`)) ctx.font = `${gewicht} ${gr}px ${RUECKFALL_SCHRIFT}`;
  };
  const breite = (t) => {
    try { return ctx.measureText(t).width || 0; } catch (e) { return 0; }
  };
  // Text so gross wie moeglich bis max (hoechstens 40 % kleiner), sonst gekuerzt
  const passend = (t, gewicht, gr, familie, max) => {
    let g = gr;
    font(gewicht, g, familie);
    while (max && breite(t) > max && g > gr * 0.6) { g -= 2; font(gewicht, g, familie); }
    let s = t;
    while (max && s.length > 1 && breite(s) > max) s = s.slice(0, -2) + '…';
    return s;
  };
  const text = (t, x, y, { farbe, ausrichtung = 'left', grundlinie = 'alphabetic' } = {}) => {
    if (!t) return 0;
    ctx.fillStyle = farbe;
    ctx.textAlign = ausrichtung;
    ctx.textBaseline = grundlinie;
    ctx.fillText(t, x, y);
    texte.push(t);
    return breite(t);
  };

  // 1. Grund und Karte
  ctx.save();
  ctx.clearRect(0, 0, BREITE, HOEHE);
  ctx.fillStyle = f('--grund', '#808080');
  ctx.fillRect(0, 0, BREITE, HOEHE);
  const k = l.karte;
  rundesRechteck(ctx, k.x, k.y, k.w, k.h, k.r);
  ctx.fillStyle = f('--flaeche', '#808080');
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = f('--linie', 'transparent');
  ctx.stroke();

  // 2. Kopf: Marke (Bauer auf Tinte) und Datum
  const m = l.marke;
  rundesRechteck(ctx, m.x, m.y, m.s, m.s, m.r);
  ctx.fillStyle = f('--tinte', '#202020');
  ctx.fill();
  const bauer = pfad(BAUER);
  if (bauer) {
    ctx.save();
    const sk = (m.s * 0.62) / 24;
    ctx.translate(m.x + m.s / 2 - 12 * sk, m.y + m.s / 2 - 12.2 * sk);
    ctx.scale(sk, sk);
    ctx.fillStyle = f('--auf-tinte', '#f0f0f0');
    ctx.fill(bauer);
    rundesRechteck(ctx, 6.4, 18.45, 11.2, 2.55, 1.27);
    ctx.fill();
    ctx.restore();
  }
  font(800, l.markeText.gr, display);
  text(daten.marke, l.markeText.x, l.markeText.y, { farbe: f('--text', '#000'), grundlinie: 'middle' });
  font(650, l.datum.gr, schrift);
  text(daten.datum || '', l.datum.x, l.datum.y, { farbe: f('--text-2', '#555'), ausrichtung: 'right', grundlinie: 'middle' });

  // 3. Ueberzeile, das grosse Wort, Gegner, Name
  const textMax = l.portraet.x - 32 - l.links;
  if (daten.ueber) {
    const hatAbstand = 'letterSpacing' in ctx;
    if (hatAbstand) ctx.letterSpacing = '2px';
    const ueber = passend(String(daten.ueber).toUpperCase(), 750, l.ueber.gr, schrift, textMax);
    text(ueber, l.ueber.x, l.ueber.y, { farbe: f('--text-2', '#555') });
    if (hatAbstand) ctx.letterSpacing = '0px';
  }
  font(800, l.wort.gr, display);
  const wb = text(daten.wort, l.wort.x, l.wort.y, { farbe: f('--text', '#000') });
  if (daten.ausruf) text(daten.ausruf, l.wort.x + wb + 4, l.wort.y, { farbe: f('--gold', '#c90') });
  const gegner = passend(daten.gegner, 750, l.gegner.gr, display, Math.min(l.gegner.max, textMax));
  text(gegner, l.gegner.x, l.gegner.y, { farbe: f('--text', '#000') });
  if (daten.name) {
    const name = passend(`Gespielt von ${daten.name}`, 650, l.name.gr, schrift, Math.min(l.name.max, textMax));
    text(name, l.name.x, l.name.y, { farbe: f('--text-2', '#555') });
  }

  // 4. Portraet des Bots auf seiner Toenung
  const p = l.portraet;
  ctx.save();
  rundesRechteck(ctx, p.x, p.y, p.s, p.s, p.r);
  ctx.fillStyle = f(`--bot-${daten.botId}-tint`, f('--flaeche-2', '#eee'));
  ctx.fill();
  ctx.clip();
  if (bilder.portraet) {
    try { ctx.drawImage(bilder.portraet, p.x + p.innen, p.y + p.innen, p.s - 2 * p.innen, p.s - 2 * p.innen); } catch (e) { /* ohne Bild */ }
  } else {
    font(800, 72, display);
    text((daten.botName || '?').trim().charAt(0).toUpperCase(), p.x + p.s / 2, p.y + p.s / 2, { farbe: f('--text-2', '#555'), ausrichtung: 'center', grundlinie: 'middle' });
  }
  ctx.restore();

  // 5. Sockel und Brett (Feldfarben fest je Brettfarbe, letzter Zug als Toenung, Koordinaten klein innen)
  const sb = l.sockelBox;
  const b = l.brett;
  rundesRechteck(ctx, sb.x, sb.y, sb.w, sb.h, b.rs);
  ctx.fillStyle = f('--sockel', '#fff');
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = f('--linie', 'transparent');
  ctx.stroke();
  ctx.save();
  rundesRechteck(ctx, b.x, b.y, b.groesse, b.groesse, b.r);
  ctx.clip();
  const hell = f('--feld-hell', '#e4e8f6');
  const dunkel = f('--feld-dunkel', '#7c87b6');
  const zuletzt = new Set(Array.isArray(daten.zuletzt) ? daten.zuletzt : []);
  let felder = 0;
  for (let r = 1; r <= 8; r++) {
    for (let s = 0; s < 8; s++) {
      const name = 'abcdefgh'[s] + r;
      const q = feldRechteck(name, daten.unten, l);
      const istDunkel = (s + r) % 2 === 1;   // a1 (Linie 0, Reihe 1) ist dunkel
      ctx.fillStyle = istDunkel ? dunkel : hell;
      ctx.fillRect(q.x, q.y, q.s, q.s);
      if (zuletzt.has(name)) {
        ctx.fillStyle = f('--zuletzt', 'rgba(255,220,80,.5)');
        ctx.fillRect(q.x, q.y, q.s, q.s);
      }
      felder++;
    }
  }
  // Koordinaten: Reihen links oben in der linken Spalte, Linien rechts unten in der unteren Reihe
  font(750, 17, schrift);
  for (let i = 0; i < 8; i++) {
    const reihe = daten.unten === 'b' ? i + 1 : 8 - i;
    const linie = daten.unten === 'b' ? 'hgfedcba'[i] : 'abcdefgh'[i];
    const qr = feldRechteck('abcdefgh'[daten.unten === 'b' ? 7 : 0] + reihe, daten.unten, l);
    const rDunkel = ((daten.unten === 'b' ? 7 : 0) + reihe) % 2 === 1;
    text(String(reihe), qr.x + 6, qr.y + 6, { farbe: rDunkel ? hell : dunkel, grundlinie: 'top' });
    const ql = feldRechteck(linie + (daten.unten === 'b' ? 8 : 1), daten.unten, l);
    const lDunkel = ('abcdefgh'.indexOf(linie) + (daten.unten === 'b' ? 8 : 1)) % 2 === 1;
    text(linie, ql.x + ql.s - 6, ql.y + ql.s - 5, { farbe: lDunkel ? hell : dunkel, ausrichtung: 'right', grundlinie: 'bottom' });
  }
  for (const fig of figurenAus(daten.fen)) {
    const q = feldRechteck(fig.feld, daten.unten, l);
    const bild = bilder.figuren && bilder.figuren[fig.farbe + fig.typ];
    if (bild) {
      try { ctx.drawImage(bild, q.x, q.y, q.s, q.s); continue; } catch (e) { /* Ersatz unten */ }
    }
    // Ersatz ohne Figurenbild: Kreis mit dem deutschen Buchstaben in den Farben des Bewertungsbalkens
    const weiss = f('--balken-weiss', 'white');
    const schwarz = f('--balken-schwarz', 'black');
    ctx.beginPath();
    ctx.arc(q.x + q.s / 2, q.y + q.s / 2, q.s * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = fig.farbe === 'w' ? weiss : schwarz;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = fig.farbe === 'w' ? schwarz : weiss;
    ctx.stroke();
    font(800, 30, schrift);
    text(FIGUR_BUCHSTABE[fig.typ], q.x + q.s / 2, q.y + q.s / 2 + 1, { farbe: fig.farbe === 'w' ? schwarz : weiss, ausrichtung: 'center', grundlinie: 'middle' });
  }
  ctx.restore();

  // 6. Werte rechts neben dem Brett: Sterne (nur wertender Sieg), Genauigkeit (wenn bekannt), Zuege
  const w = l.werte;
  const bloecke = [];
  if (Array.isArray(daten.sterne)) bloecke.push({ art: 'sterne', label: 'Sterne' });
  if (daten.genauigkeit) bloecke.push({ wert: daten.genauigkeit, label: 'Genauigkeit' });
  if (daten.zuege) bloecke.push({ wert: String(daten.zuege), label: daten.zuege === 1 ? 'Zug' : 'Züge' });
  const stern = pfad(STERN);
  bloecke.forEach((bl, i) => {
    const y = w.y + i * w.abstand;
    if (bl.art === 'sterne') {
      const gr = w.stern;
      daten.sterne.forEach((an, n) => {
        const x = w.x + n * (gr + 10);
        if (!stern) return;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(gr / 24, gr / 24);
        ctx.fillStyle = an ? f('--gold', '#c90') : f('--flaeche-3', '#ddd');
        ctx.fill(stern);
        ctx.restore();
      });
    } else {
      const wert = passend(bl.wert, 800, w.wert, display, w.w);
      text(wert, w.x, y + w.wert * 0.86, { farbe: f('--text', '#000') });
    }
    font(650, w.label, schrift);
    text(bl.label, w.x, y + w.wert + 38, { farbe: f('--text-2', '#555') });
  });

  // 7. Fuss: Haarlinie, "crownmate" und die Adresse der App
  ctx.fillStyle = f('--linie', 'transparent');
  ctx.fillRect(l.links, l.linie.y, l.rechts - l.links, 2);
  font(800, l.fuss.gr, display);
  const fb = text(daten.fuss, l.links, l.fuss.y, { farbe: f('--text', '#000'), grundlinie: 'middle' });
  if (daten.adresse) {
    const adresse = passend(daten.adresse, 650, l.fuss.adresseGr, schrift, l.rechts - l.links - fb - 40);
    text(adresse, l.rechts, l.fuss.y, { farbe: f('--text-2', '#555'), ausrichtung: 'right', grundlinie: 'middle' });
  }
  ctx.restore();
  return { texte, felder };
}

// ---------- Browser: Farben aus den Tokens ----------
export function cssRegeln(doc = globalThis.document) {
  const regeln = [];
  const sammle = (liste, media) => {
    for (const r of liste || []) {
      if (r && r.style && typeof r.selectorText === 'string') {
        const decls = [];
        for (let i = 0; i < r.style.length; i++) {
          const k = r.style[i];
          if (k && k.startsWith('--')) decls.push([k, r.style.getPropertyValue(k).trim()]);
        }
        if (decls.length) regeln.push({ selektor: r.selectorText, decls, media });
      } else if (r && r.cssRules) {
        sammle(r.cssRules, (r.media && r.media.mediaText) || media || 'gruppe');
      }
    }
  };
  for (const blatt of (doc && doc.styleSheets) || []) {
    let liste = null;
    try { liste = blatt.cssRules; } catch (e) { continue; }   // fremde Blaetter (gibt es nicht, sicher ist sicher)
    sammle(liste, null);
  }
  return regeln;
}

export function farbenAusDokument(modus, { doc = globalThis.document, themaId = null } = {}) {
  const wurzel = doc.documentElement;
  const id = themaId || (wurzel.dataset && wurzel.dataset.thema) || 'modern';
  const cs = globalThis.getComputedStyle(wurzel);
  const jetzt = (k) => cs.getPropertyValue(k).trim();
  const tokens = themaTokens(cssRegeln(doc), id, modus);
  const out = {};
  // fehlt ein Token in den Regeln (z. B. ein Theme ohne dunkle Fassung), gilt der Wert der App (aktueller Modus)
  for (const k of TOKENS_THEMA) out[k] = tokens[k] || jetzt(k);
  for (const [k, v] of Object.entries(tokens)) if (k.startsWith('--bot-')) out[k] = v;
  // Brettfarben gehoeren zu Flos Einstellung (html[data-brett]), nicht zum Modus
  for (const k of TOKENS_BRETT) out[k] = jetzt(k);
  return out;
}

// ---------- Browser: Bilder und Schriften ----------
const bildCache = new Map();

function svgMitGroesse(text, groesse) {
  return String(text).replace(/<svg\b([^>]*)>/, (_, attr) => {
    const w = /\swidth="([\d.]+)(?:px)?"/.exec(attr);
    const h = /\sheight="([\d.]+)(?:px)?"/.exec(attr);
    let a = attr.replace(/\s(width|height)="[^"]*"/g, '');
    if (!/\sviewBox=/.test(a) && w && h) a += ` viewBox="0 0 ${w[1]} ${h[1]}"`;
    return `<svg${a} width="${groesse}" height="${groesse}">`;
  });
}

export function ladeSvgBild(url, groesse = 256) {
  const schluessel = groesse + '|' + url;
  if (bildCache.has(schluessel)) return bildCache.get(schluessel);
  const versprechen = (async () => {
    const antwort = await fetch(url);
    if (!antwort.ok) throw new Error('Bild fehlt: ' + url);
    const text = svgMitGroesse(await antwort.text(), groesse);
    const bild = new Image();
    bild.decoding = 'async';
    bild.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
    if (typeof bild.decode === 'function') await bild.decode();
    else await new Promise((ok, nein) => { bild.onload = ok; bild.onerror = nein; });
    return bild;
  })();
  bildCache.set(schluessel, versprechen);
  versprechen.catch(() => bildCache.delete(schluessel));
  return versprechen;
}

const WURZEL = new URL('../../../', import.meta.url);

export async function ladeBilder(daten, { figurenPfad = 'assets/pieces/' } = {}) {
  const figuren = {};
  const namen = [...new Set(figurenAus(daten.fen).map((x) => x.farbe + x.typ))];
  await Promise.all(namen.map(async (n) => {
    try { figuren[n] = await ladeSvgBild(new URL(figurenPfad + n + '.svg', WURZEL).href, 156); } catch (e) { /* Ersatz in zeichne() */ }
  }));
  let portraet = null;
  if (daten.avatar) {
    try {
      const url = /^data:/.test(daten.avatar) ? daten.avatar : new URL(daten.avatar, WURZEL).href;
      portraet = await ladeSvgBild(url, 240);
    } catch (e) { portraet = null; }
  }
  return { figuren, portraet };
}

export async function schriftenBereit(farben = {}, ms = 1500) {
  const fonts = globalThis.document && globalThis.document.fonts;
  if (!fonts || typeof fonts.load !== 'function') return;
  const display = farben['--display'] || RUECKFALL_SCHRIFT;
  const schrift = farben['--schrift'] || RUECKFALL_SCHRIFT;
  const laden = Promise.all([
    fonts.load(`800 112px ${display}`, 'Sieg! Crownmate'),
    fonts.load(`650 24px ${schrift}`, 'Genauigkeit Züge 0123456789'),
  ]).catch(() => {});
  await Promise.race([laden, new Promise((r) => setTimeout(r, ms))]);
}

export async function rendere(canvas, daten, modus, { ohneBilder = false, figurenPfad } = {}) {
  canvas.width = BREITE;
  canvas.height = HOEHE;
  const farben = farbenAusDokument(modus);
  await schriftenBereit(farben);
  const bilder = ohneBilder ? {} : await ladeBilder(daten, { figurenPfad });
  const ctx = canvas.getContext('2d');
  const r = zeichne(ctx, daten, farben, bilder);
  return { ...r, modus, farben };
}

export function alsDatei(canvas, name) {
  return new Promise((ok, nein) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob) { nein(new Error('Bild leer')); return; }
        try { ok(new File([blob], name, { type: 'image/png' })); } catch (e) { blob.name = name; ok(blob); }
      }, 'image/png');
    } catch (e) { nein(e); }
  });
}
