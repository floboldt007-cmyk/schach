// Visitenkarte und Erfolgs-Stufen (Etappe 4b): Vertrag von supabase/karte-schema.sql mit dem Client (Node, ohne Datenbank).
// Die SQL selbst fuehrt tests/server-karte.test.mjs in PGlite aus (CI-Job "sql"). Hier steht, was beim Aendern einer Seite
// die andere nicht vergessen darf: Taler, Familien und Gold-Lohn gleich, feste Listen gleich (Titel, Motive, Hintergruende,
// Rahmen, Banner), Rechte zu, Rueckweg vollstaendig, Datenauskunft, und Erfolge sind nie kaeuflich.
//   node tests/karte-vertrag.test.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FAMILIEN, TALER_JE_STUFE, STUFEN } from '../js/pakete/sammlung/stufen.js';
import { ERFOLGS_TITEL, KOENNEN_TITEL, titelListe } from '../js/pakete/sammlung/titel.js';
import { MOTIVE, NUR_ERFINDER, GRUENDE, RAHMEN } from '../js/profil.js';
import { KARTE_MOTIVE, KARTE_RAHMEN } from '../js/karte.js';
import { MENSCHEN_BANNER, BOT_BANNER } from '../js/ui/visitenkarte.js';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (d) => readFileSync(path.join(WURZEL, d), 'utf8');
let ok = 0;
let gesamt = 0;
function pruefe(name, bedingung, info) {
  gesamt++;
  if (bedingung) { ok++; console.log('ok     ' + name); } else console.log('FEHLER ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : ''));
}
const ohneKommentare = (t) => t.split('\n').map((z) => z.replace(/--.*$/, '')).join('\n');
const sql = ohneKommentare(lies('supabase/karte-schema.sql'));
const zurueck = ohneKommentare(lies('supabase/karte-zurueck.sql'));
const gleich = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

const k = (sql.match(/function public\.karte_konstanten\(\)[\s\S]*?\$\$([\s\S]*?)\$\$;/) || [])[1] || '';
const liste = (schluessel) => {
  const m = k.match(new RegExp(`'${schluessel}',\\s*jsonb_build_array\\(([^)]*)\\)`));
  return m ? [...m[1].matchAll(/'([^']*)'|(-?\d+)/g)].map((x) => (x[1] !== undefined ? x[1] : Number(x[2]))) : null;
};
pruefe('karte_konstanten vorhanden', !!k);

// ---------- Zahlen und Familien ----------
{
  const taler = (s) => Number((k.match(new RegExp(`'taler',\\s*jsonb_build_object\\([^)]*'${s}',\\s*(\\d+)`)) || [])[1]);
  pruefe('Stufen gleich', gleich(liste('stufen'), STUFEN), liste('stufen'));
  pruefe('Taler je Stufe gleich (Bronze 20, Silber 50, Gold 120)', STUFEN.every((s) => taler(s) === TALER_JE_STUFE[s]), STUFEN.map(taler));
  const fam = [...(k.match(/'familien',\s*jsonb_build_object\(([\s\S]*?)\n\s*\),/) || [])[1]?.matchAll(/'([a-z]+)',\s*jsonb_build_object\(([^)]*)\)/g) || []]
    .map((m) => ({ id: m[1], titel: (m[2].match(/'titel',\s*'([^']+)'/) || [])[1], banner: (m[2].match(/'banner',\s*'([^']+)'/) || [])[1],
      server: /'server',\s*true/.test(m[2]) }));
  pruefe('Familien gleich', gleich(fam.map((f) => f.id), FAMILIEN.map((f) => f.id)), fam.map((f) => f.id));
  const falsch = FAMILIEN.filter((f) => {
    const s = fam.find((x) => x.id === f.id) || {};
    return s.titel !== f.gold.titel || s.banner !== f.gold.banner || s.server !== !!f.server;
  }).map((f) => f.id);
  pruefe('Gold-Lohn und Server-Familien gleich', falsch.length === 0, falsch);
  pruefe('Liga-Ziele gleich', gleich(liste('liga_ziele'), FAMILIEN.find((f) => f.id === 'liga').ziele({})), liste('liga_ziele'));
}

// ---------- Feste Listen ----------
{
  const jsTitel = [...titelListe({ level: 1 }).filter((x) => x.art === 'level').map((x) => x.id),
    ...ERFOLGS_TITEL.map((x) => 'erfolg-' + x.id), ...KOENNEN_TITEL.map((x) => 'koennen-' + x.id)];
  pruefe('Titel: Server kennt genau die Level-, Erfolgs- und Koennen-Titel (kein Erfinder, kein Pionier, kein Freitext)',
    gleich(liste('titel'), jsTitel), { nurSql: liste('titel').filter((x) => !jsTitel.includes(x)), nurJs: jsTitel.filter((x) => !liste('titel').includes(x)) });
  pruefe('Gold-Titel stehen in der Titel-Liste', FAMILIEN.filter((f) => f.gold.titel).every((f) => liste('titel').includes(f.gold.titel)));
  const motive = MOTIVE.filter((m) => !NUR_ERFINDER.includes(m));
  pruefe('Motive gleich, ohne Koenig und Kronli', gleich(liste('motive'), motive) && gleich(KARTE_MOTIVE, motive), liste('motive'));
  pruefe('Hintergruende gleich', gleich(liste('gruende'), GRUENDE), liste('gruende'));
  const rahmen = Object.keys(RAHMEN).filter((r) => !r.startsWith('erfinder') && !['brett', 'drache', 'neon', 'pixel'].includes(r));
  pruefe('Rahmen gleich, ohne Erfinder- und Labor-Rahmen', gleich(liste('rahmen'), rahmen) && gleich(KARTE_RAHMEN, rahmen), liste('rahmen'));
  const liga = liste('liga_banner');
  const gold = FAMILIEN.filter((f) => f.gold.banner).map((f) => f.gold.banner);
  pruefe('Banner der Menschen = Start + Liga + Gold-Erfolge', gleich(MENSCHEN_BANNER, ['start', ...liga, ...gold]), MENSCHEN_BANNER);
  pruefe('Keine Saison-Ende-Vergabe aus dem Kronen-Archiv (Konzept 5a)', !/insert into public\.banner_besitz[^;]*kronen_archiv/.test(sql));
  pruefe('Liga-Banner-Gutschrift ohne Recht fuer das Geraet', /create or replace function public\.karte_banner_gutschreiben\(/.test(sql)
    && !/grant[^;]*karte_banner_gutschreiben/.test(sql));
  const vorrat = JSON.parse(lies('assets/banner/vorrat.json')).banner;
  const art = (id) => (vorrat.find((b) => b.id === id) || {});
  pruefe('Alle diese Banner liegen im Vorrat und sind nicht kaeuflich', [...MENSCHEN_BANNER, ...BOT_BANNER].every((id) => art(id).kaeuflich === false));
  pruefe('Bot-Banner = die Banner der Art bot im Vorrat', gleich(BOT_BANNER, vorrat.filter((b) => b.art === 'bot').map((b) => b.id)));
  pruefe('Kein Bot- oder Shop-Banner in den Listen des Servers', !/'(bot|shop)-/.test(k));
}

// ---------- Rechte, RLS, Rueckweg ----------
{
  const tabellen = ['karte_stufen', 'taler_buchungen', 'banner_besitz', 'karte_wahl'];
  pruefe('RLS an allen vier Tabellen', tabellen.every((t) => new RegExp(`alter table public\\.${t} enable row level security`).test(sql)));
  pruefe('Keine Policy (Zugriff nur ueber Funktionen)', !/create policy/i.test(sql));
  const gruende = [...sql.matchAll(/grant execute on function public\.([a-z_]+)\(/g)].map((m) => m[1]);
  pruefe('Nur vier Funktionen fuer angemeldete Nutzer', gleich(gruende, ['karte_mein_stand', 'karte_melde_stufen', 'karte_waehle', 'karte_der_partie']), gruende);
  pruefe('Kein Recht fuer anon', !/to\s+anon/i.test(sql.replace(/from[^;]*/g, '')));
  const funktionen = [...sql.matchAll(/create or replace function public\.([a-z_]+)\(/g)].map((m) => m[1]);
  const weg = [...zurueck.matchAll(/drop function if exists public\.([a-z_]+)\(/g)].map((m) => m[1]);
  pruefe('Rueckweg entfernt jede Funktion', gleich(funktionen, weg), { funktionen, weg });
  pruefe('Rueckweg entfernt jede Tabelle', tabellen.every((t) => new RegExp(`drop table if exists public\\.${t}`).test(zurueck)));
  pruefe('Jede Funktion mit festem search_path', (sql.match(/create or replace function/g) || []).length === (sql.match(/set search_path = ''/g) || []).length);
  pruefe('Konto loeschen loescht alles mit (on delete cascade)', tabellen.every((t) => new RegExp(`create table if not exists public\\.${t} \\([\\s\\S]*?references auth\\.users \\(id\\) on delete cascade`).test(sql)));
  const daten = ohneKommentare(lies('supabase/daten-schema.sql'));
  pruefe('Datenauskunft (meine_daten) nennt alle vier Tabellen', tabellen.every((t) => daten.includes(`public.${t}`)), tabellen.filter((t) => !daten.includes(`public.${t}`)));
}

// ---------- Erfolge sind nie kaeuflich ----------
{
  const js = (d) => readdirSync(path.join(WURZEL, d), { recursive: true }).filter((f) => String(f).endsWith('.js')).map((f) => path.join(d, String(f)).replace(/\\/g, '/'));
  const alle = [...js('js'), 'sw.js'];
  const melder = alle.filter((d) => /karte_melde_stufen/.test(lies(d)));
  pruefe('Stufen meldet nur js/karte.js an den Server', gleich(melder, ['js/karte.js']), melder);
  const shop = alle.filter((d) => /shop|kauf|abo/i.test(d)).filter((d) => /besitz\.js|abgleichen\(|karte\.js|TALER_JE_STUFE/.test(lies(d)));
  pruefe('Kein Shop-, Kauf- oder Abo-Modul fasst Stufen, Taler oder Besitz an', shop.length === 0, shop);
  const buche = alle.filter((d) => /\babgleichen\(/.test(lies(d)) && d !== 'js/besitz.js');
  pruefe('Stufen bucht nur das Paket sammlung aus dem Spielstand', gleich(buche, ['js/pakete/sammlung/index.js']), buche);
  pruefe('Server bucht Stufen nur aus Meldungen und Kronen, nie aus Zahlungen', !/stripe|abo|kauf/i.test(sql));
}

console.log(`\n${ok}/${gesamt} bestanden`);
process.exit(ok === gesamt ? 0 : 1);
