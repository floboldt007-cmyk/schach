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
import { klang } from '../sounds.js';
import { setzeZurueck, statistik, gesamtSterne } from '../storage.js';
import { fuelle } from '../orte.js';
import { SPRACHWAHL, sprache } from '../sprache.js';

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

// Brettfarben wie im Design-Konzept (nur --feld-hell/--feld-dunkel)
const BRETTER = [
  { id: 'nacht', name: 'Nacht', hell: '#e4e8f6', dunkel: '#7c87b6' },
  { id: 'gruen', name: 'Grün', hell: '#eeeed2', dunkel: '#769656' },
  { id: 'holz', name: 'Holz', hell: '#f0d9b5', dunkel: '#b58863' },
];
const TIEFEN = [
  { wert: 12, name: 'Schnell', text: 'Tiefe 12' },
  { wert: 14, name: 'Normal', text: 'Tiefe 14' },
  { wert: 16, name: 'Gründlich', text: 'Tiefe 16' },
];
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
  let ortGruppen = null;   // Fuellung des Orts einstellungen:gruppen

  const lies = () => { try { return app.einstellungen() || {}; } catch (e) { return {}; } };

  const sec = document.createElement('section');
  sec.className = 'screen scrollt es-screen';
  sec.setAttribute('aria-label', 'Einstellungen');
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
        <button class="icon-knopf" type="button" data-aktion="zurueck" aria-label="Zurück">${icon('zurueck')}</button>
        <div class="titel"><h2>Einstellungen</h2><div class="unter">Wirkt sofort und bleibt gespeichert</div></div>
      </header>
      <div class="es-layout">
       <nav class="es-nav" aria-label="Einstellungsbereiche">
        ${[['klang','Klang'],['spiel','Spiel'],['bewegung','Bewegung'],['anzeige','Anzeige'],['coach','Coach'],['fortschritt','Fortschritt'],['info','Info']].map(([id,n], i) => `<a href="#es-g-${id}" class="${i ? '' : 'an'}">${n}</a>`).join('')}
       </nav>
       <div class="es-inhalt">
        <section class="es-gruppe flaeche" aria-labelledby="es-g-klang">
          <h3 class="es-titel" id="es-g-klang">Klang</h3>
          ${schalter('klang', 'Klang', 'Zugklänge und Effekte',
            `<button class="knopf es-probe" type="button" data-aktion="probe">${icon('play')} Probe</button>`)}
          ${segment('klangpaket', 'Klangpaket', [['','Arcade (Ansicht)'],['arcade','Arcade'],['holz','Holz']])}
          <label class="es-regler"><span><b>Lautstärke</b><output>80 %</output></span><input type="range" min="0" max="1" step="0.05" data-key="lautstaerke"></label>
          ${segment('klangstufe', 'Klangstufe', [['alle','Alle'],['wichtig','Wichtig'],['aus','Aus']])}
          <div class="es-untergruppe"><h4>Klänge einzeln</h4>${[['brett','Züge'],['bewertung','Bewertung'],['feier','Feier'],['uhr','Uhr'],['boss','Boss-Treffer'],['finisher','Finisher'],['bedienung','Bedienung']].map(([k,n]) => schalter(`klanggruppe-${k}`,n,'')).join('')}</div>
        </section>

        <section class="es-gruppe flaeche" aria-labelledby="es-g-spiel"><h3 class="es-titel" id="es-g-spiel">Spiel</h3>
          ${segment('zugBestaetigen','Zug bestätigen',[['aus','Aus'],['ohneUhr','Ohne Uhr'],['immer','Immer']],'Der erste Tipp zeigt den Zug, ein zweiter Tipp aufs Zielfeld spielt ihn.')}
          ${schalter('haltenAufgeben','Aufgeben und Remis halten','Schützt vor versehentlichem Antippen.')}
          ${schalter('turmRochade','Turm auf König rochiert','Erlaubt die kurze Eingabe der Rochade.')}
          ${schalter('autoDame','Automatisch Dame','Ohne Auswahl bei der Umwandlung. Halten am Zielfeld zeigt die anderen Figuren.')}
          ${schalter('vorzuege','Vorzüge','Bis zu fünf Züge vormerken, während der Gegner denkt. Ein Tipp ins leere Brett löscht sie.')}
          ${segment('steuerung','Figuren bewegen',[['beides','Beides'],['ziehen','Ziehen'],['tippen','Tippen']])}
        </section>

        <section class="es-gruppe flaeche" aria-labelledby="es-g-bewegung"><h3 class="es-titel" id="es-g-bewegung">Bewegung</h3>
          ${segment('bewegung','Animationstempo',[['langsam','Langsam'],['normal','Normal'],['schnell','Schnell'],['aus','Aus']],'Die Systemeinstellung „weniger Bewegung“ hat Vorrang.')}
          <div class="es-tempo-vorschau" aria-hidden="true"><span>♞</span></div>
        </section>

        <section class="es-gruppe flaeche" aria-labelledby="es-g-anzeige">
          <h3 class="es-titel" id="es-g-anzeige">Anzeige</h3>
          ${segment('thema','Ansicht',[['modern','Modern und klar']])}
          ${segment('modus','Erscheinungsbild',[['system','System'],['hell','Hell'],['dunkel','Dunkel']])}
          ${ZEIGE_SPRACHE ? segment('sprache','Sprache · Language',[['de','Deutsch'],['en','English']]) : ''}
          <h4>Brettfarbe</h4>
          <div class="es-bretter" role="radiogroup" aria-labelledby="es-g-brett">
            ${BRETTER.map((b) => `
              <button class="es-brett" type="button" role="radio" aria-checked="false" data-aktion="brett" data-wert="${b.id}">
                ${miniBrett(b)}<span class="es-brett-name">${b.name}</span>
              </button>`).join('')}
          </div>
          ${schalter('koordinaten','Koordinaten','Buchstaben und Zahlen am Brett.')}
          ${segment('koordLage','Lage der Koordinaten',[['ecke','Ecke'],['rand','Rand']])}
          ${schalter('balken','Bewertungsbalken','Zeigt, wer besser steht.')}${schalter('liveBewertung','Live-Bewertung','Coach nach jedem eigenen Zug.')}
          ${schalter('pfeile','Pfeile und Marken','Feld halten und ziehen malt einen Pfeil, nur halten eine Marke. Am Rechner mit Rechtsklick. Ein Tipp ins leere Brett löscht alles.')}
          ${segment('duellIntro','Duell-Intro',[['immer','Immer'],['besondere','Besondere'],['aus','Aus']])}
          ${schalter('lebensleiste','Lebensleiste','Bei Boss-Partien.')}${schalter('zaehlwerk','Zählwerk','Wenn ein Spielmodus es anbietet.')}${schalter('funkenlinie','Funkenlinie','Wenn ein Spielmodus es anbietet.')}
        </section>

        <section class="es-gruppe flaeche" aria-labelledby="es-g-coach"><h3 class="es-titel" id="es-g-coach">Coach</h3>
          ${segment('coachStil','Erklärungen',[['ausfuehrlich','Ausführlich'],['knapp','Knapp']])}
          ${segment('sprueche','Bot-Sprüche',[['an','An'],['wenig','Wenig'],['aus','Aus']])}
          ${segment('tiefe','Rechentiefe',TIEFEN.map(t => [String(t.wert),t.name,t.text]),'Gründlich ist genauer, braucht aber länger.')}
          <div class="es-coach-vorschau"><b>Coach-Vorschau</b><p>Dieser Zug entwickelt eine Figur und bereitet die Rochade vor.</p></div>
        </section>

        <div class="es-ort"></div>

        <section class="es-gruppe flaeche es-gefahr" aria-labelledby="es-g-fortschritt">
          <h3 class="es-titel" id="es-g-fortschritt">Fortschritt</h3>
          <div class="es-reset" aria-live="polite"></div>
        </section>

        <section class="es-gruppe flaeche es-info" aria-labelledby="es-g-info">
          <h3 class="es-titel" id="es-g-info">Info und Lizenzen</h3>
          <p><b>Crownmate</b> ist freie Software unter der <a href="${esc(pfad('LICENSE'))}" target="_blank" rel="noopener">GPL-3.0</a>. Alles läuft auf deinem Gerät, auch offline.</p>
          <p class="es-recht"><a href="${esc(pfad('datenschutz.html'))}" target="_blank" rel="noopener">Datenschutzerklärung</a> · <a href="${esc(pfad('impressum.html'))}" target="_blank" rel="noopener">Impressum</a></p>
          <ul class="es-lizenzen">
            <li><b>Stockfish 19</b><span>Schach-Engine als WebAssembly (stockfish.js, lite), GPL-3.0. Quellen: <a href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noopener">github.com/nmrugg/stockfish.js</a></span></li>
            <li><b>chess.js 1.4.0</b><span>Schachregeln, BSD-2-Clause</span></li>
            <li><b>Figuren „cburnett“</b><span>von Colin M. L. Burnett, GPLv2+</span></li>
            <li><b>Schriften Manrope und Bricolage Grotesque</b><span>SIL Open Font License 1.1: <a href="${esc(pfad('assets/schriften/OFL-Manrope.txt'))}" target="_blank" rel="noopener">Manrope</a>, <a href="${esc(pfad('assets/schriften/OFL-Bricolage-Grotesque.txt'))}" target="_blank" rel="noopener">Bricolage Grotesque</a></span></li>
            <li><b>Tagesrätsel</b><span>Eigene Rätsel, mit Stockfish geprüft. Entstanden aus Partien der Engine gegen sich selbst und eigenen Lehr-Stellungen, keine Rätsel aus fremden Sammlungen.</span></li>
            <li><b>Klänge „Holz“ und „Arcade“</b><span>Eigene Werke, alle Rechte vorbehalten, nur zur Nutzung in dieser App</span></li>
            <li><b>Avatare, Zug-Symbole und App-Icon</b><span>Für dieses Projekt entstanden, GPL-3.0</span></li>
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
    for (const b of sec.querySelectorAll('.es-seg')) b.setAttribute('aria-checked', String(b.dataset.wert) === String(e[b.dataset.key]) ? 'true' : 'false');
    const regler = sec.querySelector('[data-key="lautstaerke"]');
    if (regler) { regler.value = e.lautstaerke ?? .8; regler.previousElementSibling.querySelector('output').value = `${Math.round(regler.value * 100)} %`; }
  }

  function zeigeReset() {
    const box = sec.querySelector('.es-reset');
    if (!box) return;
    if (resetStufe === 0) {
      const s = statistik();
      box.innerHTML = `
        <p class="es-hilfe">Löscht alle Sterne, Freischaltungen, Partien, Analysen und die Schatzkiste. Die Einstellungen bleiben.
          Im Moment: <b class="zahl">${s.partien}</b> ${s.partien === 1 ? 'Partie' : 'Partien'}, <b class="zahl">${gesamtSterne()}</b> Sterne.</p>
        <button class="knopf es-rot-rand" type="button" data-aktion="reset-1">${icon('muell')} Fortschritt zurücksetzen</button>`;
    } else if (resetStufe === 1) {
      box.innerHTML = `
        <div class="es-warnung" role="alert">${icon('warnung')}<p><b>Wirklich alles zurücksetzen?</b> Alle Sterne, Partien und Analysen sind dann weg, und die Leiter beginnt wieder bei Bauer Benno.</p></div>
        <div class="es-knoepfe">
          <button class="knopf" type="button" data-aktion="reset-ab">Abbrechen</button>
          <button class="knopf es-rot-rand" type="button" data-aktion="reset-2">Ja, weiter</button>
        </div>`;
      box.querySelector('[data-aktion="reset-ab"]').focus();
    } else {
      box.innerHTML = `
        <div class="es-warnung stark" role="alert">${icon('warnung')}<p><b>Letzte Rückfrage.</b> Das lässt sich nicht rückgängig machen.</p></div>
        <div class="es-knoepfe">
          <button class="knopf" type="button" data-aktion="reset-ab">Abbrechen</button>
          <button class="knopf es-rot" type="button" data-aktion="reset-ok">${icon('muell')} Endgültig löschen</button>
        </div>`;
      box.querySelector('[data-aktion="reset-ab"]').focus();
    }
  }

  function setze(teil) {
    try { app.setzeEinstellungen(teil); } catch (e) { try { app.meldung('Speichern hat nicht geklappt', { art: 'fehler' }); } catch (f) { /* egal */ } }
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
        setze({ [k.dataset.key]: k.dataset.key === 'tiefe' ? Number(k.dataset.wert) : k.dataset.wert });
        // neue Sprache: alles neu zeichnen (die Screens lesen ihre Texte beim Zeichnen)
        if (k.dataset.key === 'sprache' && k.dataset.wert !== sprache()) setTimeout(() => location.reload(), 60);
        break;
      case 'reset-1': resetStufe = 1; zeigeReset(); break;
      case 'reset-2': resetStufe = 2; zeigeReset(); break;
      case 'reset-ab': resetStufe = 0; zeigeReset(); sec.querySelector('[data-aktion="reset-1"]')?.focus(); break;
      case 'reset-ok':
        // setzeZurueck sendet speicher:zurueckgesetzt (Pakete leeren ihren Zustand); danach die Gruppen der
        // Pakete neu fuellen, damit sie den frischen Stand zeigen
        setzeZurueck();
        resetStufe = 0;
        if (ortGruppen) ortGruppen.verlasse();
        ortGruppen = fuelle('einstellungen:gruppen', sec.querySelector('.es-ort'), { app });
        zeigeReset();
        try { app.meldung('Fortschritt zurückgesetzt. Bauer Benno wartet schon!'); } catch (f) { /* egal */ }
        break;
      default: break;
    }
  });

  lausche(sec, 'input', (e) => {
    const regler = e.target.closest('input[type="range"][data-key]');
    if (!regler) return;
    regler.previousElementSibling.querySelector('output').value = `${Math.round(Number(regler.value) * 100)} %`;
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
