// Seit Variante A (Flo 08.11.2026) zeigt das Bots-Panel nur noch den Gegner: die Orte arena:heute (Heute-Karte) und
// arena:panel-bot haben keinen Host mehr. Ihre Anbieter bleiben registriert, bis sie einen neuen Platz bekommen. Damit
// deren Logik geprueft bleibt, setzt dieser Helfer beide Orte NUR IM TEST an ihre alte Stelle im Panel (Heute-Karte nach
// .ort-panel-oben, panel-bot vor der Farbwahl) und fuellt sie wie frueher js/ui/arena.js; ohne Zeilen bleiben sie versteckt.
// Aufruf nach jedem Neuzeichnen des Panels (Bot gewaehlt, Arena neu betreten).
export async function alteOrte(seite) {
  await seite.waitForSelector('.screen.arena .detail .ort-panel-oben', { state: 'attached', timeout: 20000 });
  await seite.evaluate(async () => {
    const [{ fuelle }, { botNachId }, { ladeFortschritt }] = await Promise.all([
      import('/js/orte.js'), import('/js/bots.js'), import('/js/storage.js')]);
    const detail = document.querySelector('.screen.arena .detail');
    detail.querySelectorAll('[data-test-ort]').forEach((e) => e.remove());
    const gew = document.querySelector('.screen.arena .knoten.gewaehlt');
    const bot = gew ? botNachId(gew.dataset.bot) : null;
    const fortschritt = ladeFortschritt();
    const app = window.__app;
    const k = document.createElement('section');
    k.className = 'heute-karte';
    k.dataset.testOrt = 'heute';
    k.innerHTML = '<div class="hk-kopf">Heute</div><div class="ort-heute"></div>';
    detail.querySelector('.ort-panel-oben').after(k);
    k.hidden = fuelle('arena:heute', k.querySelector('.ort-heute'), { app, bot, fortschritt }).anzahl === 0;
    const p = document.createElement('div');
    p.className = 'ort-panel-bot';
    p.dataset.testOrt = 'panel-bot';
    const vor = detail.querySelector('.wahl-farbe');
    if (vor) vor.before(p); else detail.append(p);
    p.hidden = fuelle('arena:panel-bot', p, { app, bot, fortschritt }).anzahl === 0;
  });
}
