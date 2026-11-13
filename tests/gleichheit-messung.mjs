// Gemeinsame Messhilfe fuer Gleichheits-Proben (R9, 13.11.2026): die EINE Messung einer Partie-Ansicht, genutzt von
// tests/gleichheit-ansichten.test.mjs und tests/funktion-zuzweit-lernen.test.mjs (vorher hatte gleichheit-ansichten
// eine eigene Kopie `messe`).
//   messeAnsicht(seite, screenSelektor) -> { brett, brettRaster, leisten[], knoepfe{aufgeben,remis,hinweis}, zugStreifen, seiteScrollt }
//     brett       Breite des Feldrasters (linke Kante a-Linie bis rechte Kante h-Linie), wie in gleichheit-ansichten
//     brettRaster Gegenprobe: Breite von .brett-felder
//     leisten     sichtbare Spielerleisten (.spieler, .zz-spieler) mit Lage zum Brett, Name, Avatar, Uhr
//     knoepfe     die drei Rollen aufgeben, remis, hinweis: da und ganz im Bild
//   introWeg(seite)  wartet, bis das Duell-Intro (.duell) weg ist (wie gleichheit-ansichten)
//   ROLLEN           die verglichenen Knopf-Rollen

export const ROLLEN = ['aufgeben', 'remis', 'hinweis'];

export const introWeg = (s) => s.waitForFunction(() => !document.querySelector('.duell'), null, { timeout: 12000 }).catch(() => {});

export const messeAnsicht = (s, screen) => s.evaluate(({ screen, rollen }) => {
  const sichtbar = (e) => !!e && !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0;
  const wurzel = document.querySelector(screen) || document;
  const felder = [...wurzel.querySelectorAll('.brett-felder .feld[data-feld]')].filter(sichtbar).map((f) => f.getBoundingClientRect());
  if (felder.length < 64) return { fehlt: `nur ${felder.length} Felder in ${screen}` };
  const b = { links: Math.min(...felder.map((r) => r.left)), rechts: Math.max(...felder.map((r) => r.right)),
    oben: Math.min(...felder.map((r) => r.top)), unten: Math.max(...felder.map((r) => r.bottom)) };
  const raster = wurzel.querySelector('.brett-felder');
  const leisten = [...wurzel.querySelectorAll('.spieler, .zz-spieler')].filter(sichtbar).map((e) => {
    const r = e.getBoundingClientRect();
    const lage = r.bottom <= b.oben + 4 ? 'oben' : r.top >= b.unten - 4 ? 'unten' : 'seite';
    const nameEl = e.querySelector('.name, .bot-name, .rd-name, .zz-name b');
    const uhr = [...e.querySelectorAll('.uhr')].find(sichtbar);
    return { lage, wer: e.classList.contains('ich') || e.classList.contains('zz-unten') ? 'ich' : 'gegner', name: (nameEl?.textContent || '').trim(),
      avatar: !!e.querySelector('.av, .rd-av, .avatar, img, svg'), uhr: !!uhr, imBild: r.top >= -0.5 && r.bottom <= innerHeight + 0.5 };
  });
  const knoepfe = {};
  for (const k of rollen) {
    const el = [...wurzel.querySelectorAll(`[data-aktion="${k}"], [data-online="${k}"], [data-zz="${k}"], [data-a="${k}"]`)].find(sichtbar);
    const r = el?.getBoundingClientRect();
    knoepfe[k] = el ? { da: true, imBild: r.top >= -0.5 && r.bottom <= innerHeight + 0.5 && r.left >= -0.5 && r.right <= innerWidth + 0.5 } : { da: false, imBild: false };
  }
  // R8 (L3): Zugstreifen (hoch) oder Zugliste (quer): Lage zu den Knoepfen und ganz im Bild
  const zuege = [...wurzel.querySelectorAll('.zugleiste')].find(sichtbar) || [...wurzel.querySelectorAll('.zugbox')].find(sichtbar);
  const kn = [...wurzel.querySelectorAll('.spielknoepfe, .zz-aktionen')].find(sichtbar);
  let zugStreifen = 'keiner';
  if (zuege) {
    const r = zuege.getBoundingClientRect(), k = kn?.getBoundingClientRect();
    zugStreifen = (zuege.matches('.zugleiste') ? 'streifen' : 'liste') + (!k ? '' : r.bottom <= k.top + 1 ? ' ueber Knoepfen' : r.top >= k.bottom - 1 ? ' unter Knoepfen' : ' neben Knoepfen')
      + (r.top >= -0.5 && r.bottom <= innerHeight + 0.5 ? '' : ' ausserhalb');
  }
  return { zugStreifen, brett: Math.round(b.rechts - b.links), brettRaster: raster ? Math.round(raster.getBoundingClientRect().width) : null,
    leisten, knoepfe, seiteScrollt: document.documentElement.scrollHeight - innerHeight > 1 || window.scrollY > 0 };
}, { screen, rollen: ROLLEN });
