// Vorlauf design-beweis Shop A (3f, 18.11.2026): angemeldet mit Testkonto, Server simuliert (Edition, 18+), Modus dunkel,
// nach dem Laden zum Shop (nur Navigation)
(() => {
  if (!sessionStorage.getItem('ek-vorlauf')) {
    sessionStorage.setItem('ek-vorlauf', '1');
    localStorage.clear();
    localStorage.setItem('schach-arena:konto:sichtbar', '1');
    localStorage.setItem('schach-arena:konto:sitzung', JSON.stringify({ access_token: 'a.eyJzdWIiOiJ1MSJ9.x', refresh_token: 'r', expires_at: 9999999999, user: { id: 'u1', email: 'probe@example.invalid' } }));
    localStorage.setItem('schach-arena:v1:einstellungen', JSON.stringify({ klang: false, bewegung: 'aus', figuren: 'cburnett', modus: 'dunkel' }));
  }
  if (document.documentElement) document.documentElement.dataset.modus = 'dunkel';
  const echt = window.fetch.bind(window);
  const ed = [{ produkt_id: 'brett-mitternacht', name: 'Mitternacht & Gold', auflage: 10, status: 'erhaeltlich', restzahl: 9, verkauf_ab: '2026-11-28T10:00:00Z', betrag_cent: 499, waehrung: 'eur' }];
  window.fetch = (u, o) => {
    const url = String(u && u.url ? u.url : u);
    if (!url.includes('.supabase.co')) return echt(u, o);
    const body = url.includes('/auth/v1/') ? { id: 'u1' } : url.includes('altersangaben') ? [{ ab18: true }] : url.includes('edition_staende') ? ed
      : /karte_(melde_stufen|waehle)/.test(url) ? { taler: 0, stufen: {}, banner: ['start'], wahl: { banner: 'start' } } : [];
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  };
  const t = setInterval(() => { if (window.__app && document.querySelector('.screen.heim-screen')) { clearInterval(t); window.__app.gehe('ich', { bereich: 'shop' }); } }, 100);
})();
