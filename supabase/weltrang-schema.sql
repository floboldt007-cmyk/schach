-- Weltrangliste nach Online-Elo (G-006 AC-11, 14.11.2026; Flos Regeln aus der Grill-Runde):
--   nur wer selbst zustimmt   eigene Zeile in weltrang_teilnahme, Vorgabe AUS; ohne Zustimmung erscheint niemand
--   nur bestaetigte Elo       kronen_stand.elo_n >= 15 (ab da rechnet kronen_online_buchen mit K 32 statt 40)
--   Start-Elo selbst gesetzt  (kronen_start, kronen_stand.start_gesetzt) erst ab 30 Online-Partien (Flo 14.11.2026): Start
--                             2800 und 15 Niederlagen stehen noch bei 2200 und waeren sonst Platz 1
--   nur mit Benutzername      ohne Zeile in profile kein Eintrag
--   Banner nur im Besitz      sonst 'start', dieselbe Regel wie karte_von (karte-schema.sql)
-- Gezeigt werden Rang, Name, Banner und Elo. Keine Kennung, keine Mail, keine Liga-Stufe, kein Titel.
-- Voraussetzung: schema.sql, kronen-schema.sql und karte-schema.sql sind eingespielt. Diese Datei bringt meine_daten()
-- zeichengleich mit daten-schema.sql mit (ganz unten), damit die Datenauskunft die Zustimmung auch dann nennt, wenn nur diese
-- Datei eingespielt wird (live laeuft die Fassung ohne Weltrangliste). Einspielen: im SQL Editor ausfuehren.
-- Wiederholbar, bestehende Zustimmungen bleiben. Probe: supabase/weltrang-rls-test.sql. Rueckweg: supabase/weltrang-zurueck.sql.
-- NICHT von Claude einspielen: Flo spielt Supabase-Aenderungen selbst ein.

-- Eine Zeile je Konto, das in der Weltrangliste erscheinen will. Zuruecknehmen loescht die Zeile.
create table if not exists public.weltrang_teilnahme (
  user_id uuid primary key references auth.users (id) on delete cascade,
  seit timestamptz not null default now()
);
alter table public.weltrang_teilnahme enable row level security;
-- Keine Policies und keine Tabellenrechte: lesen und schreiben nur ueber die beiden Funktionen unten
revoke all on table public.weltrang_teilnahme from public, anon, authenticated;

-- Die Liste fuer den Reiter "Welt": { ab, ab_start, teilnahme, liste, ich } (ab_start: Grenze mit selbst gesetzter Start-Elo).
--   liste  [{ rang, name, banner, elo, ich }] die besten grenze (1 bis 100, Vorgabe 100) nach Elo; gleiche Elo, gleicher Rang
--   ich    { status } mit status 'dabei' (dazu rang, elo, name, banner), 'zaehlt_noch' (dazu fehlen = Partien bis 15 bzw. 30),
--          'ohne_name' oder 'nicht_dabei'. Die eigene Elo steht nur bei 'dabei' darin.
create or replace function public.weltrang_liste(grenze integer default 100)
returns jsonb
language plpgsql
-- bewusst nicht stable: weltrang_mitmachen ruft sie direkt nach dem eigenen insert/delete auf, eine stable-Funktion
-- saehe noch den Stand vom Beginn der Anfrage
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  ab constant integer := 15;
  ab_start constant integer := 30;
  n integer := least(greatest(coalesce(grenze, 100), 1), 100);
  dabei boolean;
  hat_name boolean;
  partien integer;
  selbst boolean;
  liste jsonb;
  ich jsonb;
begin
  if uid is null then
    raise exception 'WELTRANG_OHNE_KONTO';
  end if;
  dabei := exists (select 1 from public.weltrang_teilnahme t where t.user_id = uid);
  hat_name := exists (select 1 from public.profile p where p.user_id = uid);
  select coalesce(s.elo_n, 0), s.start_gesetzt into partien, selbst from public.kronen_stand s where s.user_id = uid;
  partien := coalesce(partien, 0);
  selbst := coalesce(selbst, false);

  with wertung as (
    select t.user_id, p.benutzername as name, s.elo,
           case when w.banner is not null and exists (select 1 from public.banner_besitz b
                                                      where b.user_id = t.user_id and b.banner = w.banner)
                then w.banner else 'start' end as banner,
           rank() over (order by s.elo desc) as rang
    from public.weltrang_teilnahme t
    join public.profile p on p.user_id = t.user_id
    join public.kronen_stand s on s.user_id = t.user_id
    left join public.karte_wahl w on w.user_id = t.user_id
    where s.elo_n >= case when s.start_gesetzt then ab_start else ab end
  ),
  oben as (
    select * from wertung order by rang, lower(name), name limit n
  )
  select
    (select coalesce(jsonb_agg(jsonb_build_object('rang', o.rang, 'name', o.name, 'banner', o.banner, 'elo', o.elo,
              'ich', o.user_id = uid) order by o.rang, lower(o.name), o.name), '[]'::jsonb) from oben o),
    (select jsonb_build_object('status', 'dabei', 'rang', x.rang, 'elo', x.elo, 'name', x.name, 'banner', x.banner)
       from wertung x where x.user_id = uid)
    into liste, ich;

  if ich is null then
    ich := case
      when not dabei then jsonb_build_object('status', 'nicht_dabei')
      when not hat_name then jsonb_build_object('status', 'ohne_name')
      else jsonb_build_object('status', 'zaehlt_noch', 'fehlen', greatest(case when selbst then ab_start else ab end - partien, 1))
    end;
  end if;
  return jsonb_build_object('ab', ab, 'ab_start', ab_start, 'teilnahme', dabei, 'liste', liste, 'ich', ich);
end;
$$;

-- Zustimmung geben (an = true) oder zuruecknehmen (an = false), nur fuer das eigene Konto. Antwort wie weltrang_liste().
create or replace function public.weltrang_mitmachen(an boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'WELTRANG_OHNE_KONTO';
  end if;
  if an is true then
    insert into public.weltrang_teilnahme (user_id) values (uid) on conflict (user_id) do nothing;
  else
    delete from public.weltrang_teilnahme t where t.user_id = uid;
  end if;
  return public.weltrang_liste();
end;
$$;

revoke all on function public.weltrang_liste(integer) from public, anon, authenticated;
revoke all on function public.weltrang_mitmachen(boolean) from public, anon, authenticated;
grant execute on function public.weltrang_liste(integer) to authenticated;
grant execute on function public.weltrang_mitmachen(boolean) to authenticated;

-- Datenauskunft (Art. 15): meine_daten() zeichengleich mit daten-schema.sql (Wache: tests/server-weltrang.test.mjs). Live laeuft
-- die Fassung ohne Weltrangliste; ohne diese Kopie fehlte die Zustimmung in der Auskunft, wenn nur diese Datei eingespielt
-- wird. Die Bloecke fuer andere Teile pruefen ihre Tabellen mit to_regclass und laufen ohne sie weiter. Wer meine_daten in
-- daten-schema.sql aendert, zieht diese Kopie und die in saison-schema.sql nach.
create or replace function public.meine_daten()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  online jsonb := '[]'::jsonb;
  versuche jsonb := '[]'::jsonb;
  protokoll jsonb := '[]'::jsonb;
  abo jsonb := null;
  abo_ereignisse jsonb := '[]'::jsonb;
  werkstatt jsonb := jsonb_build_object('altersangabe', null, 'besitz', '[]'::jsonb, 'reservierungen', '[]'::jsonb,
    'edition_zustimmungen', '[]'::jsonb, 'sonderstuecke', '[]'::jsonb, 'edition_ereignisse', '[]'::jsonb);
  coach jsonb := jsonb_build_object('nutzung', '[]'::jsonb);
  schule jsonb := jsonb_build_object('geleitete_klassen', '[]'::jsonb, 'mitgliedschaften', '[]'::jsonb,
    'beitrittsversuche', '[]'::jsonb);
  freunde jsonb := jsonb_build_object('freundschaften', '[]'::jsonb, 'einladung', null, 'wochenpunkte', '[]'::jsonb);
  kronen jsonb := jsonb_build_object('stand', null, 'buchungen', '[]'::jsonb, 'gruppen', '[]'::jsonb,
    'belohnungen', '[]'::jsonb, 'suche', null, 'ki_belege', '[]'::jsonb);
  karte jsonb := jsonb_build_object('stufen', '[]'::jsonb, 'taler', '[]'::jsonb, 'banner', '[]'::jsonb, 'wahl', null);
  duelle jsonb := jsonb_build_object('duelle', '[]'::jsonb, 'suche', null);
  saison jsonb := jsonb_build_object('abzeichen', '[]'::jsonb, 'titel', '[]'::jsonb, 'gewaehlt', null);
  raetsel jsonb;
  verwaltung jsonb := jsonb_build_object('verwalter', null, 'protokoll', '[]'::jsonb); -- [verwaltung]
begin
  if uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  -- die eigenen abgelaufenen Eintraege immer (ohne Obergrenze), danach das allgemeine Aufraeumen fuer alle
  delete from public.daten_zaehler z where z.user_id = uid and z.stunde < date_trunc('hour', now()) - interval '48 hours';
  if to_regclass('public.online_versuche') is not null then
    execute 'delete from public.online_versuche v where v.user_id = $1
             and v.tag < (now() at time zone ''Europe/Berlin'')::date - 2' using uid;
  end if;
  perform public.daten_zaehler_aufraeumen();
  if to_regprocedure('public.online_aufraeumen()') is not null then
    execute 'select public.online_aufraeumen()';
  end if;
  if to_regclass('public.partien_online') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(o) order by o.erstellt_am), ''[]''::jsonb)
             from public.partien_online o where $1 in (o.weiss, o.schwarz, o.erstellt_von)'
      into online using uid;
  end if;
  if to_regclass('public.online_versuche') is not null then
    execute 'select coalesce(jsonb_agg(jsonb_build_object(''tag'', v.tag, ''anzahl'', v.anzahl) order by v.tag), ''[]''::jsonb)
             from public.online_versuche v where v.user_id = $1'
      into versuche using uid;
  end if;
  -- Abo (bisher fehlte die eigene Zeile in der Auskunft)
  if to_regclass('public.abos') is not null then
    execute 'select to_jsonb(a) from public.abos a where a.user_id = $1' into abo using uid;
  end if;
  -- Stripe-Ereignisse zum Abo: mit Konto-Verweis oder ueber die eigene Kundennummer (frueh eingegangene haben noch keinen)
  if to_regclass('public.stripe_ereignisse') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(e) order by e.erstellt, e.id), ''[]''::jsonb)
             from public.stripe_ereignisse e where e.user_id = $1
               or e.kunde_id in (select a.kunde_id from public.abos a where a.user_id = $1 and a.kunde_id is not null)'
      into abo_ereignisse using uid;
  end if;
  -- Frag den Coach (coach-schema.sql): Zahl der Fragen je Tag
  if to_regclass('public.coach_nutzung') is not null then
    execute 'select jsonb_build_object(''nutzung'', coalesce((select jsonb_agg(jsonb_build_object(''tag'', c.tag,
               ''anzahl'', c.anzahl) order by c.tag) from public.coach_nutzung c where c.user_id = $1), ''[]''::jsonb))'
      into coach using uid;
  end if;
  -- Schulmodus (schule-schema.sql): selbst geleitete Klassen mit ihren Aufgaben (ohne die Mitglieder, das sind andere
  -- Personen), die eigenen Mitgliedschaften mit dem eigenen Fortschritt und die Fehlversuche beim Beitreten
  if to_regclass('public.klassen') is not null then
    execute 'select jsonb_build_object(
               ''geleitete_klassen'', coalesce((select jsonb_agg((to_jsonb(k) - ''leitung'') || jsonb_build_object(''aufgaben'',
                   coalesce((select jsonb_agg(to_jsonb(a) - ''klasse'' order by a.erstellt_am)
                     from public.klassen_aufgaben a where a.klasse = k.id), ''[]''::jsonb)) order by k.erstellt_am)
                 from public.klassen k where k.leitung = $1), ''[]''::jsonb),
               ''mitgliedschaften'', coalesce((select jsonb_agg(jsonb_build_object(''klasse'', k.name,
                   ''anzeigename'', m.anzeigename, ''beigetreten_am'', m.beigetreten_am,
                   ''fortschritt'', (select to_jsonb(f) - ''mitglied'' - ''klasse'' from public.klassen_fortschritt f
                     where f.mitglied = m.id)) order by m.beigetreten_am)
                 from public.klassen_mitglieder m join public.klassen k on k.id = m.klasse where m.user_id = $1), ''[]''::jsonb),
               ''beitrittsversuche'', coalesce((select jsonb_agg(jsonb_build_object(''tag'', v.tag, ''anzahl'', v.anzahl)
                   order by v.tag) from public.schule_versuche v where v.user_id = $1), ''[]''::jsonb))'
      into schule using uid;
  end if;
  -- Werkstatt: alles zum Konto, auch Zahlungs- und Sitzungskennungen (es sind die eigenen Daten)
  if to_regclass('public.besitz') is not null then
    execute 'select jsonb_build_object(
               ''altersangabe'', (select to_jsonb(a) from public.altersangaben a where a.user_id = $1),
               ''besitz'', coalesce((select jsonb_agg(to_jsonb(b) order by b.erworben_am, b.nummer)
                 from public.besitz b where b.user_id = $1), ''[]''::jsonb),
               ''reservierungen'', coalesce((select jsonb_agg(to_jsonb(r) order by r.erstellt_am)
                 from public.reservierungen r where r.user_id = $1), ''[]''::jsonb),
               ''edition_zustimmungen'', coalesce((select jsonb_agg(to_jsonb(z) order by z.zeitpunkt)
                 from public.edition_zustimmungen z where z.user_id = $1), ''[]''::jsonb),
               ''sonderstuecke'', coalesce((select jsonb_agg(to_jsonb(s) order by s.stueck_id)
                 from public.sonderstuecke s where s.user_id = $1), ''[]''::jsonb),
               ''edition_ereignisse'', coalesce((select jsonb_agg(to_jsonb(e) order by e.erstellt, e.id)
                 from public.edition_ereignisse e join public.reservierungen r on r.id = e.reservierung_id
                 where r.user_id = $1), ''[]''::jsonb))'
      into werkstatt using uid;
  end if;
  -- Freunde (freunde-schema.sql): Freundschaften und Anfragen mit dem Benutzernamen der anderen Seite, der eigene
  -- Einladungscode und die Wochenwertung
  if to_regclass('public.freundschaften') is not null then
    execute 'select jsonb_build_object(
               ''freundschaften'', coalesce((select jsonb_agg(jsonb_build_object(
                   ''mit'', p.benutzername, ''angefragt_von_mir'', f.von = $1, ''status'', f.status,
                   ''erstellt_am'', f.erstellt_am, ''geaendert_am'', f.geaendert_am) order by f.erstellt_am)
                 from public.freundschaften f
                 left join public.profile p on p.user_id = case when f.von = $1 then f.an else f.von end
                 where f.von = $1 or f.an = $1), ''[]''::jsonb),
               ''einladung'', (select to_jsonb(e) - ''von'' from public.freund_einladungen e where e.von = $1),
               ''wochenpunkte'', coalesce((select jsonb_agg(to_jsonb(w) - ''user_id'' order by w.woche)
                 from public.wochenpunkte w where w.user_id = $1), ''[]''::jsonb))'
      into freunde using uid;
  end if;
  -- Liga mit Kronen (kronen-schema.sql): eigener Stand, alle Buchungen, die eigenen Wochen-Gruppen (Woche, Stufe, eigene
  -- Kronen; die anderen Mitglieder nicht), gemerkte Belohnungen, die laufende Gegnersuche und die KI-Belege. Die
  -- Tageszaehler (zaehler_tag) haben keinen Personenbezug und gehoeren nicht hierher.
  if to_regclass('public.kronen_stand') is not null then
    execute 'select jsonb_build_object(
               ''stand'', (select to_jsonb(s) - ''user_id'' from public.kronen_stand s where s.user_id = $1),
               ''buchungen'', coalesce((select jsonb_agg(to_jsonb(b) - ''user_id'' order by b.am, b.id)
                 from public.kronen_buchungen b where b.user_id = $1), ''[]''::jsonb),
               ''gruppen'', coalesce((select jsonb_agg(jsonb_build_object(''woche'', m.woche, ''stufe'', g.stufe,
                   ''kronen'', m.kronen, ''beigetreten'', m.beigetreten,
                   ''liga'', coalesce(to_jsonb(m) ->> ''liga'', ''online'')) order by m.woche)
                 from public.liga_mitglieder m join public.liga_gruppen g on g.id = m.gruppe where m.user_id = $1), ''[]''::jsonb),
               ''belohnungen'', coalesce((select jsonb_agg(to_jsonb(l) - ''user_id'' order by l.woche, l.id)
                 from public.liga_belohnungen l where l.user_id = $1), ''[]''::jsonb),
               ''suche'', (select to_jsonb(q) - ''user_id'' from public.suche_warteschlange q where q.user_id = $1),
               ''ki_belege'', coalesce((select jsonb_agg(to_jsonb(k) - ''user_id'' order by k.erstellt_am)
                 from public.suche_ki_belege k where k.user_id = $1), ''[]''::jsonb))'
      into kronen using uid;
    kronen := kronen || jsonb_build_object('raetsel_stand', null);
  end if;
  -- Zwei Ligen (zwei-ligen-schema.sql): der eigene Stand der Raetsel-Liga (Stufe, Kronen, Raetsel-Elo)
  if to_regclass('public.raetsel_stand') is not null then
    execute 'select to_jsonb(r) - ''user_id'' from public.raetsel_stand r where r.user_id = $1'
      into raetsel using uid;
    kronen := kronen || jsonb_build_object('raetsel_stand', raetsel);
  end if;
  -- Live-Bewertung (zwei-ligen-schema.sql, 11.11.2026): an welchen Tagen welche gewertete Partie live bewertet wurde
  if to_regclass('public.live_bewertung_nutzung') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(b) - ''user_id'' order by b.tag, b.erstellt_am), ''[]''::jsonb)
             from public.live_bewertung_nutzung b where b.user_id = $1'
      into raetsel using uid;
    kronen := kronen || jsonb_build_object('live_bewertung', raetsel);
  end if;
  -- Weltrangliste (weltrang-schema.sql, 14.11.2026): ob und seit wann du in der Weltrangliste gezeigt werden willst
  if to_regclass('public.weltrang_teilnahme') is not null then
    execute 'select jsonb_build_object(''teilnahme'', t.user_id is not null, ''seit'', t.seit)
             from (select 1) x left join public.weltrang_teilnahme t on t.user_id = $1'
      into raetsel using uid;
    kronen := kronen || jsonb_build_object('weltrang', raetsel);
  end if;
  -- Visitenkarte und Erfolge (karte-schema.sql, Etappe 4b): erreichte Stufen, alle Taler-Buchungen, eigene Banner und die
  -- gewaehlte Karte (Banner, Titel, Vitrine, Profilbild)
  if to_regclass('public.karte_stufen') is not null then
    execute 'select jsonb_build_object(
               ''stufen'', coalesce((select jsonb_agg(to_jsonb(s) - ''user_id'' order by s.familie, s.stufe)
                 from public.karte_stufen s where s.user_id = $1), ''[]''::jsonb),
               ''taler'', coalesce((select jsonb_agg(to_jsonb(t) - ''user_id'' order by t.am, t.id)
                 from public.taler_buchungen t where t.user_id = $1), ''[]''::jsonb),
               ''banner'', coalesce((select jsonb_agg(to_jsonb(b) - ''user_id'' order by b.banner)
                 from public.banner_besitz b where b.user_id = $1), ''[]''::jsonb),
               ''wahl'', (select to_jsonb(w) - ''user_id'' from public.karte_wahl w where w.user_id = $1))'
      into karte using uid;
  end if;
  -- Saison (saison-schema.sql, R19): Abzeichen je Saison (hoechste Stufe), verdiente Saison-Titel, der gewaehlte Titel
  if to_regclass('public.saison_abzeichen') is not null then
    execute 'select jsonb_build_object(
               ''abzeichen'', coalesce((select jsonb_agg(jsonb_build_object(''saison'', a.saison, ''stufe'', a.stufe) order by a.saison)
                 from public.saison_abzeichen a where a.user_id = $1), ''[]''::jsonb),
               ''titel'', coalesce((select jsonb_agg(jsonb_build_object(''saison'', t.saison, ''art'', t.art) order by t.saison, t.art)
                 from public.saison_titel t where t.user_id = $1), ''[]''::jsonb),
               ''gewaehlt'', (select w.titel from public.saison_wahl w where w.user_id = $1))'
      into saison using uid;
  end if;
  -- Raetsel-Duell (raetsel-duell-schema.sql): die eigenen Duelle mit dem eigenen Stand darin und die laufende Suche.
  -- Ohne Saat und Raetsel-Folge: beide sind keine Daten ueber das Konto, und waehrend eines laufenden Duells verrieten
  -- sie die kommenden Raetsel (Schummelschutz).
  if to_regclass('public.duell_spieler') is not null then
    execute 'select jsonb_build_object(
               ''duelle'', coalesce((select jsonb_agg((to_jsonb(x) - ''seed'' - ''raetsel'') || jsonb_build_object(''mein_stand'',
                   to_jsonb(s) - ''user_id'' - ''duell'') order by x.erstellt_am)
                 from public.duell_spieler s join public.duelle x on x.id = s.duell where s.user_id = $1), ''[]''::jsonb),
               ''suche'', (select to_jsonb(q) - ''user_id'' from public.duell_warteschlange q where q.user_id = $1))'
      into duelle using uid;
  end if;
  -- [verwaltung] Verwaltung (verwaltung-schema.sql): Aenderungen der Verwaltung an diesem Konto (was, vorher, nachher,
  -- [verwaltung] wann), ohne die Kennung des Verwalters; dazu, seit wann das Konto selbst verwalten darf
  if to_regclass('public.verwaltung_protokoll') is not null then -- [verwaltung]
    execute 'select jsonb_build_object(''verwalter'', (select jsonb_build_object(''seit'', v.seit) from public.verwalter v where v.user_id = $1), ''protokoll'', coalesce((select jsonb_agg(jsonb_build_object(''was'', x.was, ''vorher'', x.vorher, ''nachher'', x.nachher, ''am'', x.am) order by x.am, x.id) from public.verwaltung_protokoll x where x.ziel_user = $1), ''[]''::jsonb))' into verwaltung using uid; -- [verwaltung]
  end if; -- [verwaltung]
  begin
    execute 'select coalesce(jsonb_agg(jsonb_build_object(''am'', e.created_at, ''aktion'', e.payload ->> ''action'',
               ''ip'', e.ip_address) order by e.created_at), ''[]''::jsonb)
             from auth.audit_log_entries e where e.payload ->> ''actor_id'' = $1::text'
      into protokoll using uid;
  exception
    when undefined_table or insufficient_privilege then protokoll := null; -- nicht lesbar: in der Auskunft vermerkt
  end;
  return jsonb_build_object(
    'erstellt_am', now(),
    'konto', (
      select jsonb_build_object(
        'id', u.id, 'email', u.email, 'erstellt_am', u.created_at, 'letzte_anmeldung', u.last_sign_in_at,
        'anbieter', u.raw_app_meta_data -> 'providers',
        -- Angaben des Anmeldeanbieters (bei Google z. B. Name, Bild-Adresse, Google-Kennung)
        'angaben_anbieter', u.raw_user_meta_data)
      from auth.users u where u.id = uid),
    'profil', (select to_jsonb(p) from public.profile p where p.user_id = uid),
    'spielstand', (
      select jsonb_build_object(
        'format_version', s.format_version, 'geraet', s.geraet, 'aktualisiert_am', s.aktualisiert_am,
        'groesse_bytes', pg_column_size(s.stand))
      from public.spielstaende s where s.user_id = uid),
    'partien_archiv', coalesce(
      (select jsonb_agg(to_jsonb(a) order by a.gespielt_am, a.erstellt_am) from public.partien_archiv a where a.user_id = uid),
      '[]'::jsonb),
    'nutzung', coalesce(
      (select jsonb_agg(to_jsonb(n) order by n.erstellt_am) from public.nutzung n where n.user_id = uid),
      '[]'::jsonb),
    'freigabe_widerruf', (select to_jsonb(w) from public.freigabe_widerrufe w where w.user_id = uid),
    -- Freunde: Freundschaften und Anfragen (mit Benutzername der anderen Seite), Einladungscode, Wochenwertung
    'freunde', freunde,
    -- Liga mit Kronen: Stand, Buchungen, Wochen-Gruppen, Belohnungen, laufende Gegnersuche, KI-Belege (leer ohne kronen-schema.sql)
    'kronen', kronen,
    -- Visitenkarte und Erfolge: Stufen, Taler-Buchungen, Banner, gewaehlte Karte (leer ohne karte-schema.sql)
    'karte', karte,
    -- Saison: Abzeichen, Saison-Titel, gewaehlter Titel (leer ohne saison-schema.sql)
    'saison', saison,
    -- Raetsel-Duell: eigene Duelle mit eigenem Stand, laufende Suche (leer ohne raetsel-duell-schema.sql)
    'raetsel_duell', duelle,
    'partien_online', online,
    -- Fehlversuche beim Beitreten zu Online-Partien (Zahl je Tag; leer, wenn online-schema.sql fehlt)
    'online_versuche', versuche,
    -- Zaehler der Mengenbremse (Zahl der geteilten Zeilen je Tabelle und Stunde, ohne Inhalte; aeltere als 48 Stunden
    -- hat das Aufraeumen oben schon entfernt)
    'mengenzaehler', coalesce(
      (select jsonb_agg(jsonb_build_object('tabelle', z.tabelle, 'stunde', z.stunde, 'anzahl', z.anzahl)
                        order by z.stunde, z.tabelle)
       from public.daten_zaehler z where z.user_id = uid),
      '[]'::jsonb),
    'abo', abo,
    -- Stripe-Ereignisse zum Abo (leer ohne abo-schema.sql)
    'abo_ereignisse', abo_ereignisse,
    -- Frag den Coach: Fragen je Tag (leer ohne coach-schema.sql)
    'coach', coach,
    -- Schulmodus: geleitete Klassen mit Aufgaben, eigene Mitgliedschaften mit Fortschritt, Beitrittsversuche
    'schule', schule,
    -- [verwaltung] Aenderungen der Verwaltung an diesem Konto (leer ohne verwaltung-schema.sql)
    'verwaltung', verwaltung, -- [verwaltung]
    -- Anmeldeprotokoll von Supabase (Zeitpunkt, Art, IP); null, wenn die Funktion es nicht lesen darf
    'anmeldeprotokoll', protokoll
  ) || werkstatt;
end;
$$;

revoke execute on function public.meine_daten() from public, anon;
grant execute on function public.meine_daten() to authenticated;
