// Screen "Einstellungen": Klang (mit Probeton), Bewertungsbalken, Live-Bewertung, Brettfarbe
// mit Mini-Brett-Vorschau, Koordinaten, Rechentiefe, Fortschritt zuruecksetzen (zweistufige
// Rueckfrage) und Info/Lizenzen (mit Datenschutzerklaerung und Impressum, Daten-Fundament). Jede Aenderung geht sofort
// ueber app.setzeEinstellungen(teil).
//
//   zeige(root, {}, app) -> { verlasse() }
//
// Klassen mit Praefix es- (Stil in css/screens.css), Basis-Klassen aus css/app.css.
// Runde 4: Anzeige-Ort einstellungen:gruppen (Gruppen der Pakete, vor der Gruppe "Fortschritt"), nach
// "Fortschritt zuruecksetzen" neu gefuellt. Die Einstellungen bleiben dabei, auch die der Pakete
// (storage.ladeModulEinstellungen).
// Tester-Bericht (Luecken-Check 10): in "Info und Lizenzen" der Eintrag .es-bericht mit dem Knopf
// [data-aktion="bericht"]; er laedt js/bericht.js erst beim Tipp (import()) und oeffnet dort das Blatt mit dem Bericht.
import { klang } from '../sounds.js';
import { setzeZurueck, statistik, gesamtSterne } from '../storage.js';
import { fuelle } from '../orte.js';
import { SPRACHWAHL, t, sprache } from '../sprache.js';
import { BOTS } from '../bots.js';
import { sitzung, istAbgeglichen } from '../konto.js';
import '../sprachen/allgemein.js';
import '../sprachen/einstellungen.js';
import '../sprachen/bericht.js';

// Sprachwahl erst, wenn alles uebersetzt ist (SPRACHWAHL); mit ?test schon jetzt (tests/sprache.test.mjs)
const ZEIGE_SPRACHE = SPRACHWAHL || (typeof location !== 'undefined' && /[?&]test\b/.test(location.search || ''));

const WURZEL = new URL('../../', import.meta.url);
const pfad = (rel) => new URL(rel, WURZEL).href;

const ICON = {
  zurueck: '<path d="M15 5 8 12l7 7"/>',
  klang: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  warnung: '<path d="M12 3.5 2.8 19.5h18.4zM12 10v4.2M12 17.2v.1"/>',
  muell: '<path d="M4.5 7h15M9.5 7V4.8h5V7M6.8 7l.9 12.2a1.6 1.6 0 0 0 1.6 1.5h5.4a1.6 1.6 0 0 0 1.6-1.5L17.2 7M10.2 10.5v6.5M13.8 10.5v6.5"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.1"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

// Brettfarben wie im Design-Konzept (nur --feld-hell/--feld-dunkel); Namen beim Zeichnen: t('einstellungen.brett.<id>')
const BRETTER = [
  { id: 'nacht', hell: '#e4e8f6', dunkel: '#7c87b6' },
  { id: 'gruen', hell: '#eeeed2', dunkel: '#769656' },
  { id: 'holz', hell: '#f0d9b5', dunkel: '#b58863' },
];
// Namen beim Zeichnen: t('einstellungen.tiefe.<name>'), Text t('einstellungen.tiefe.text')
const TIEFEN = [
  { wert: 12, name: 'schnell' },
  { wert: 14, name: 'normal' },
  { wert: 16, name: 'gruendlich' },
];
function E(k, w) { return t('einstellungen.' + k, w); }
// der Bot, bei dem die Leiter nach dem Zuruecksetzen wieder beginnt (Name aus bots.js, beim Zeichnen gelesen)
// Erster Gegner der Leiter (seit den Welten Vogelscheuche Willi, vorher Bauer Lukas): dort beginnt sie nach dem Zuruecksetzen
function ersterGegner() {
  return (BOTS[0] || {}).name || '';
}
// Mini-Brett: 4x4 Ausschnitt mit ein paar Figuren
const MINI = { 1: 'bN', 6: 'bP', 9: 'wB', 14: 'wK' };

function esc(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function zeige(root, params = {}, app) {
  let beendet = false;
  const aufraeumen = [];
  const timer = new Set();
  const lausche = (ziel, typ, f, opt) => { ziel.addEventListener(typ, f, opt); aufraeumen.push(() => ziel.removeEventListener(typ, f, opt)); };
  const nach = (ms, f) => { const t = setTimeout(() => { timer.delete(t); if (!beendet) f(); }, ms); timer.add(t); return t; };
  let resetStufe = 0;
  // Doppeltipp-Schutz: Die Rueckfrage zeichnet ihren Knopf an die Stelle des Ausloesers. Ein zweiter Tipp (Doppeltipp,
  // Doppelklick) darf sie nicht gleich bestaetigen, darum gilt ein neu gezeichneter Knopf erst nach kurzer Zeit.
  let resetBereitAb = 0;
  let ortGruppen = null;   // Fuellung des Orts einstellungen:gruppen

  const lies = () => { try { return app.einstellungen() || {}; } catch (e) { return {}; } };

  const sec = document.createElement('section');
  sec.className = 'screen scrollt es-screen';
  sec.setAttribute('aria-label', t('allgemein.einstellungen'));
  root.append(sec);

  const schalter = (key, titel, text, extra = '') => `
    <div class="es-zeile" data-zeile="${key}">
      <div class="es-text" data-aktion="schalte" data-key="${key}"><b id="es-l-${key}">${titel}</b><span id="es-t-${key}">${text}</span></div>
      ${extra}
      <button class="es-schalter" type="button" role="switch" data-aktion="schalte" data-key="${key}"
        aria-labelledby="es-l-${key}" aria-describedby="es-t-${key}" aria-checked="false"><i></i></button>
    </div>`;

  const miniBrett = (b) => {
    let felder = '';
    for (let i = 0; i < 16; i++) {
      const zeile = Math.floor(i / 4);
      const dunkel = (zeile + (i % 4)) % 2 === 1;
      const fig = MINI[i] ? `<img src="${esc(pfad(`assets/pieces/${MINI[i]}.svg`))}" alt="">` : '';
      felder += `<i class="${dunkel ? 'd' : 'h'}">${fig}</i>`;
    }
    return `<span class="es-mini" style="--feld-hell:${b.hell};--feld-dunkel:${b.dunkel}" aria-hidden="true">${felder}</span>`;
  };

  const segment = (key, titel, werte, hilfe = '') => `
    <div class="es-block" data-einstellung="${key}">
      <h4>${titel}</h4>${hilfe ? `<p class="es-hilfe">${hilfe}</p>` : ''}
      <div class="es-segment" role="radiogroup" aria-label="${titel}">
        ${werte.map(([wert, name, text = '']) => `<button class="es-seg" type="button" role="radio" aria-checked="false"
          data-aktion="wahl" data-key="${key}" data-wert="${wert}"><b>${name}</b>${text ? `<span>${text}</span>` : ''}</button>`).join('')}
      </div>
    </div>`;

  function baue() {
    sec.innerHTML = `
      <header class="kopf">
        <button class="icon-knopf" type="button" data-aktion="zurueck" aria-label="${t('allgemein.zurueck')}">${icon('zurueck')}</button>
        <div class="titel"><h2>${t('allgemein.einstellungen')}</h2><div class="unter">${E('unter')}</div></div>
      </header>
      <div class="es-layout">
       <nav class="es-nav" aria-label="${E('nav')}">
        ${['klang','spiel','bewegung','anzeige','coach','fortschritt','info'].map((id, i) => `<a href="#es-g-${id}" class="${i ? '' : 'an'}">${E('gruppe.' + id)}</a>`).join('')}
       </nav>
       <div class="es-inhalt">
        <section class="es-gruppe flaeche" aria-labelledby="es-g-klang">
          <h3 class="es-titel" id="es-g-klang">${E('gruppe.klang')}</h3>
          ${schalter('klang', E('klang.titel'), E('klang.text'),
            `<button class="knopf es-probe" type="button" data-aktion="probe">${icon('play')} ${E('klang.probe')}</button>`)}
          ${segment('klangpaket', E('klang.paket'), [['',E('klang.paketAnsicht')],['arcade',E('klang.paketArcade')],['holz',E('klang.paketHolz')]])}
          <label class="es-regler"><span><b>${E('klang.lautstaerke')}</b><output>${E('prozent', { wert: 80 })}</output></span><input type="range" min="0" max="1" step="0.05" data-key="lautstaerke"></label>
          ${segment('klangstufe', E('klang.stufe'), [['alle',E('klang.alle')],['wichtig',E('klang.wichtig')],['aus',t('allgemein.aus')]])}
          <div class="es-untergruppe"><h4>${E('klang.einzeln')}</h4>${['brett','bewertung','feier','uhr','boss','finisher','bedienung'].map((k) => schalter(`klanggruppe-${k}`,E('klang.' + k),'')).join('')}</div>
        </section>

        <section class="es-gruppe flaeche" aria-labelledby="es-g-spiel"><h3 class="es-titel" id="es-g-spiel">${E('gruppe.spiel')}</h3>
          ${segment('zugBestaetigen',E('spiel.bestaetigen'),[['aus',t('allgemein.aus')],['ohneUhr',E('spiel.ohneUhr')],['immer',E('spiel.immer')]],E('spiel.bestaetigenHilfe'))}
          ${schalter('haltenAufgeben',E('spiel.halten'),E('spiel.haltenText'))}
          ${schalter('turmRochade',E('spiel.turmRochade'),E('spiel.turmRochadeText'))}
          ${schalter('autoDame',E('spiel.autoDame'),E('spiel.autoDameText'))}
          ${schalter('vorzuege',E('spiel.vorzuege'),E('spiel.vorzuegeText'))}
          ${segment('steuerung',E('spiel.steuerung'),[['beides',E('spiel.beides')],['ziehen',E('spiel.ziehen')],['tippen',E('spiel.tippen')]])}
        </section>

        <section class="es-gruppe flaeche" aria-labelledby="es-g-bewegung"><h3 class="es-titel" id="es-g-bewegung">${E('gruppe.bewegung')}</h3>
          ${segment('bewegung',E('bewegung.tempo'),[['langsam',E('bewegung.langsam')],['normal',E('bewegung.normal')],['schnell',E('bewegung.schnell')],['aus',t('allgemein.aus')]],E('bewegung.hilfe'))}
          <div class="es-tempo-vorschau" aria-hidden="true"><span>♞</span></div>
        </section>

        <section class="es-gruppe flaeche" aria-labelledby="es-g-anzeige">
          <h3 class="es-titel" id="es-g-anzeige">${E('gruppe.anzeige')}</h3>
          ${segment('thema',E('anzeige.ansicht'),[['modern',E('anzeige.modern')]])}
          ${segment('modus',E('anzeige.erscheinung'),[['system',E('anzeige.system')],['hell',E('anzeige.hell')],['dunkel',E('anzeige.dunkel')]])}
          ${ZEIGE_SPRACHE ? segment('sprache','Sprache · Language',[['auto',E('anzeige.geraet')],['de','Deutsch'],['en','English']]) : ''}
          <h4>${E('anzeige.brettfarbe')}</h4>
          <div class="es-bretter" role="radiogroup" aria-labelledby="es-g-brett">
            ${BRETTER.map((b) => `
              <button class="es-brett" type="button" role="radio" aria-checked="false" data-aktion="brett" data-wert="${b.id}">
                ${miniBrett(b)}<span class="es-brett-name">${E('brett.' + b.id)}</span>
              </button>`).join('')}
          </div>
          ${schalter('koordinaten',E('anzeige.koordinaten'),E('anzeige.koordinatenText'))}
          ${segment('koordLage',E('anzeige.koordLage'),[['ecke',E('anzeige.ecke')],['rand',E('anzeige.rand')]])}
          ${schalter('balken',E('anzeige.balken'),E('anzeige.balkenText'))}${schalter('liveBewertung',E('anzeige.live'),E('anzeige.liveText'))}
          ${schalter('pfeile',E('anzeige.pfeile'),E('anzeige.pfeileText'))}
          ${segment('duellIntro',E('anzeige.duellIntro'),[['immer',E('spiel.immer')],['besondere',E('anzeige.besondere')],['aus',t('allgemein.aus')]])}
          ${schalter('lebensleiste',E('anzeige.lebensleiste'),E('anzeige.lebensleisteText'))}${schalter('zaehlwerk',E('anzeige.zaehlwerk'),E('anzeige.spielmodus'))}${schalter('funkenlinie',E('anzeige.funkenlinie'),E('anzeige.spielmodus'))}
        </section>

        <section class="es-gruppe flaeche" aria-labelledby="es-g-coach"><h3 class="es-titel" id="es-g-coach">${E('gruppe.coach')}</h3>
          ${segment('coachStil',E('coach.stil'),[['ausfuehrlich',E('coach.ausfuehrlich')],['knapp',E('coach.knapp')]])}
          ${segment('sprueche',E('coach.sprueche'),[['an',t('allgemein.an')],['wenig',E('coach.wenig')],['aus',t('allgemein.aus')]])}
          ${segment('tiefe',E('coach.tiefe'),TIEFEN.map(x => [String(x.wert),E('tiefe.' + x.name),E('tiefe.text', { wert: x.wert })]),E('coach.tiefeHilfe'))}
          <div class="es-coach-vorschau"><b>${E('coach.vorschau')}</b><p>${E('coach.vorschauText')}</p></div>
        </section>

        <div class="es-ort"></div>

        <section class="es-gruppe flaeche es-gefahr" aria-labelledby="es-g-fortschritt">
          <h3 class="es-titel" id="es-g-fortschritt">${E('gruppe.fortschritt')}</h3>
          <div class="es-reset" aria-live="polite"></div>
        </section>

        <section class="es-gruppe flaeche es-info" aria-labelledby="es-g-info">
          <h3 class="es-titel" id="es-g-info">${E('gruppe.infoLizenzen')}</h3>
          <p>${E('info.frei', { app: '<b>Crownmate</b>', lizenz: `<a href="${esc(pfad('LICENSE'))}" target="_blank" rel="noopener">GPL-3.0</a>` })}</p>
          <p class="es-recht"><a href="${esc(pfad(sprache() === 'en' ? 'datenschutz-en.html' : 'datenschutz.html'))}" target="_blank" rel="noopener">${E('info.datenschutz')}</a> · <a href="${esc(pfad(sprache() === 'en' ? 'impressum-en.html' : 'impressum.html'))}" target="_blank" rel="noopener">${E('info.impressum')}</a></p>
          <div class="es-bericht">
            <p class="es-hilfe" id="es-t-bericht">${t('bericht.eintragText')}</p>
            <button class="knopf" type="button" data-aktion="bericht" aria-describedby="es-t-bericht">${t('bericht.eintrag')}</button>
          </div>
          <ul class="es-lizenzen">
            <li><b>Stockfish 19</b><span>${E('info.stockfish', { link: '<a href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noopener">github.com/nmrugg/stockfish.js</a>' })}</span></li>
            <li><b>chess.js 1.4.0</b><span>${E('info.chessjs')}</span></li>
            <li><b>${E('info.figuren')}</b><span>${E('info.figurenText')}</span></li>
            <li><b>${E('info.schriften')}</b><span>SIL Open Font License 1.1: <a href="${esc(pfad('assets/schriften/OFL-Manrope.txt'))}" target="_blank" rel="noopener">Manrope</a>, <a href="${esc(pfad('assets/schriften/OFL-Bricolage-Grotesque.txt'))}" target="_blank" rel="noopener">Bricolage Grotesque</a></span></li>
            <li><b>${E('info.tagesraetsel')}</b><span>${E('info.tagesraetselText')}</span></li>
            <li><b>${E('info.klaenge')}</b><span>${E('info.klaengeText')}</span></li>
            <li><b>${E('info.bilder')}</b><span>${E('info.bilderText')}</span></li>
          </ul>
        </section>
       </div>
      </div>`;
    // Ort einstellungen:gruppen (vor der Gruppe "Fortschritt"; der Behaelter ist display: contents)
    if (ortGruppen) ortGruppen.verlasse();
    ortGruppen = fuelle('einstellungen:gruppen', sec.querySelector('.es-ort'), { app });
    zeigeStand();
    zeigeReset();
  }

  function zeigeStand() {
    const e = lies();
    for (const k of sec.querySelectorAll('.es-schalter')) {
      if (k.closest('.es-ort')) continue;   // Schalter der Pakete
      const an = k.dataset.key.startsWith('klanggruppe-') ? e.klanggruppen?.[k.dataset.key.slice(12)] !== false : e[k.dataset.key] !== false;
      k.setAttribute('aria-checked', an ? 'true' : 'false');
    }
    const probe = sec.querySelector('.es-probe');
    if (probe) probe.disabled = e.klang === false;
    for (const b of sec.querySelectorAll('.es-brett')) b.setAttribute('aria-checked', b.dataset.wert === (e.brett || 'nacht') ? 'true' : 'false');
    for (const b of sec.querySelectorAll('.es-seg')) {
      // Sprache ohne eigene Wahl: "Geraet" (js/app.js spracheOhneWahl)
      const wert = b.dataset.key === 'sprache' && !e.spracheGewaehlt ? 'auto' : e[b.dataset.key];
      b.setAttribute('aria-checked', String(b.dataset.wert) === String(wert) ? 'true' : 'false');
    }
    const regler = sec.querySelector('[data-key="lautstaerke"]');
    if (regler) { regler.value = e.lautstaerke ?? .8; regler.previousElementSibling.querySelector('output').value = E('prozent', { wert: Math.round(regler.value * 100) }); }
  }

  // Nur Angemeldete bekommen den Satz zur Cloud, je nachdem, ob dieses Geraet abgeglichen ist (Ultracode 30.10.)
  function cloudSatz() {
    try { return sitzung() ? ' ' + E(istAbgeglichen() ? 'reset.textAbgeglichen' : 'reset.textNichtAbgeglichen') : ''; } catch (e) { return ''; }
  }
  function zeigeReset() {
    const box = sec.querySelector('.es-reset');
    if (!box) return;
    if (resetStufe === 0) {
      const s = statistik();
      const sterne = gesamtSterne();
      box.innerHTML = `
        <p class="es-hilfe">${E('reset.hilfe')}
          ${E('reset.stand', { partien: E('reset.partien', { n: s.partien, zahl: `<b class="zahl">${s.partien}</b>` }), sterne: E('reset.sterne', { n: sterne, zahl: `<b class="zahl">${sterne}</b>` }) })}</p>
        <button class="knopf es-rot-rand" type="button" data-aktion="reset-1">${icon('muell')} ${E('reset.knopf')}</button>`;
    } else if (resetStufe === 1) {
      box.innerHTML = `
        <div class="es-warnung" role="alert">${icon('warnung')}<p><b>${E('reset.frage1')}</b> ${E('reset.text1', { bot: esc(ersterGegner()) })}</p></div>
        <div class="es-knoepfe">
          <button class="knopf" type="button" data-aktion="reset-ab">${t('allgemein.abbrechen')}</button>
          <button class="knopf es-rot-rand" type="button" data-aktion="reset-2">${E('reset.weiter')}</button>
        </div>`;
      box.querySelector('[data-aktion="reset-ab"]').focus();
    } else {
      box.innerHTML = `
        <div class="es-warnung stark" role="alert">${icon('warnung')}<p><b>${E('reset.frage2')}</b> ${E('reset.text2')}${cloudSatz()}</p></div>
        <div class="es-knoepfe">
          <button class="knopf" type="button" data-aktion="reset-ab">${t('allgemein.abbrechen')}</button>
          <button class="knopf es-rot" type="button" data-aktion="reset-ok">${icon('muell')} ${E('reset.endgueltig')}</button>
        </div>`;
      box.querySelector('[data-aktion="reset-ab"]').focus();
    }
  }

  function setze(teil) {
    try { app.setzeEinstellungen(teil); } catch (e) { try { app.meldung(E('speichernFehler'), { art: 'fehler' }); } catch (f) { /* egal */ } }
    zeigeStand();
  }

  lausche(sec, 'click', (e) => {
    const k = e.target.closest('[data-aktion]');
    if (!k || !sec.contains(k) || k.disabled || k.closest('.es-ort')) return;   // Pakete binden selbst
    const e0 = lies();
    switch (k.dataset.aktion) {
      case 'zurueck': app.zurueck(); break;
      case 'schalte': {
        const key = k.dataset.key;
        if (key.startsWith('klanggruppe-')) {
          const gruppe = key.slice(12);
          setze({ klanggruppen: { [gruppe]: e0.klanggruppen?.[gruppe] === false } });
        } else setze({ [key]: e0[key] === false });
        if (key === 'klang' && e0.klang === false) probeton();
        break;
      }
      case 'probe': probeton(); break;
      case 'brett': setze({ brett: k.dataset.wert }); break;
      case 'tiefe': setze({ tiefe: Number(k.dataset.wert) }); break;
      case 'wahl':
        if (k.dataset.key === 'sprache') {
          // Geraet oder feste Sprache; danach alles neu zeichnen (die Screens lesen ihre Texte beim Zeichnen)
          setze(k.dataset.wert === 'auto' ? { spracheGewaehlt: false } : { sprache: k.dataset.wert, spracheGewaehlt: true });
          setTimeout(() => location.reload(), 60);
          break;
        }
        setze({ [k.dataset.key]: k.dataset.key === 'tiefe' ? Number(k.dataset.wert) : k.dataset.wert });
        break;
      case 'bericht':
        // erst beim Tipp laden: ein Fehler im Bericht stoppt nie den Screen (zeigeBericht oeffnet nie zwei Blaetter)
        import('../bericht.js').then((m) => m.zeigeBericht(app))
          .catch(() => { try { app.meldung(t('bericht.erstellenFehler'), { art: 'fehler' }); } catch (f) { /* egal */ } });
        break;
      case 'reset-1': if (e.detail > 1) break; resetStufe = 1; resetBereitAb = Date.now() + 600; zeigeReset(); break;
      case 'reset-2': if (e.detail > 1 || Date.now() < resetBereitAb) break; resetStufe = 2; resetBereitAb = Date.now() + 600; zeigeReset(); break;
      case 'reset-ab': resetStufe = 0; zeigeReset(); sec.querySelector('[data-aktion="reset-1"]')?.focus(); break;
      case 'reset-ok':
        if (e.detail > 1 || Date.now() < resetBereitAb) break;
        // setzeZurueck sendet speicher:zurueckgesetzt (Pakete leeren ihren Zustand); danach die Gruppen der
        // Pakete neu fuellen, damit sie den frischen Stand zeigen
        setzeZurueck();
        resetStufe = 0;
        if (ortGruppen) ortGruppen.verlasse();
        ortGruppen = fuelle('einstellungen:gruppen', sec.querySelector('.es-ort'), { app });
        zeigeReset();
        try { app.meldung(E('reset.fertig', { bot: ersterGegner() })); } catch (f) { /* egal */ }
        break;
      default: break;
    }
  });

  lausche(sec, 'input', (e) => {
    const regler = e.target.closest('input[type="range"][data-key]');
    if (!regler) return;
    regler.previousElementSibling.querySelector('output').value = E('prozent', { wert: Math.round(Number(regler.value) * 100) });
    setze({ [regler.dataset.key]: Number(regler.value) });
  });

  // Pfeiltasten in den Auswahlgruppen (Radiogruppen-Verhalten)
  lausche(sec, 'keydown', (e) => {
    const k = e.target.closest('[role="radio"]');
    if (!k || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const gruppe = [...k.parentElement.querySelectorAll('[role="radio"]')];
    const i = gruppe.indexOf(k);
    const neu = gruppe[(i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) + gruppe.length) % gruppe.length];
    e.preventDefault();
    neu.focus();
    neu.click();
  });

  function probeton() {
    try {
      klang.aktivieren();
      klang.zug();
      nach(260, () => { try { klang.brillant(); } catch (e) { /* egal */ } });
    } catch (e) { /* Klang nicht verfuegbar */ }
  }

  baue();

  return {
    verlasse() {
      if (beendet) return;
      beendet = true;
      for (const t of timer) clearTimeout(t);
      timer.clear();
      for (const f of aufraeumen.splice(0)) { try { f(); } catch (e) { /* egal */ } }
      if (ortGruppen) { ortGruppen.verlasse(); ortGruppen = null; }
    },
  };
}
