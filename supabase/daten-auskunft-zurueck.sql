-- Rueckweg zur Datenauskunft-Erweiterung vom 09.11.2026 (AC-06): stellt meine_daten() auf den Stand von main 7c434c7
-- zurueck (ohne coach, schule, abo_ereignisse und werkstatt.edition_ereignisse). Loescht keine Daten, ersetzt nur die
-- Funktion. Ausfuehren im Supabase SQL Editor, danach: notify pgrst, 'reload schema';

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
  werkstatt jsonb := jsonb_build_object('altersangabe', null, 'besitz', '[]'::jsonb, 'reservierungen', '[]'::jsonb,
    'edition_zustimmungen', '[]'::jsonb, 'sonderstuecke', '[]'::jsonb);
  freunde jsonb := jsonb_build_object('freundschaften', '[]'::jsonb, 'einladung', null, 'wochenpunkte', '[]'::jsonb);
  kronen jsonb := jsonb_build_object('stand', null, 'buchungen', '[]'::jsonb, 'gruppen', '[]'::jsonb,
    'belohnungen', '[]'::jsonb, 'suche', null, 'ki_belege', '[]'::jsonb);
  karte jsonb := jsonb_build_object('stufen', '[]'::jsonb, 'taler', '[]'::jsonb, 'banner', '[]'::jsonb, 'wahl', null);
  duelle jsonb := jsonb_build_object('duelle', '[]'::jsonb, 'suche', null);
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
                 from public.sonderstuecke s where s.user_id = $1), ''[]''::jsonb))'
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
                   ''kronen'', m.kronen, ''beigetreten'', m.beigetreten) order by m.woche)
                 from public.liga_mitglieder m join public.liga_gruppen g on g.id = m.gruppe where m.user_id = $1), ''[]''::jsonb),
               ''belohnungen'', coalesce((select jsonb_agg(to_jsonb(l) - ''user_id'' order by l.woche, l.id)
                 from public.liga_belohnungen l where l.user_id = $1), ''[]''::jsonb),
               ''suche'', (select to_jsonb(q) - ''user_id'' from public.suche_warteschlange q where q.user_id = $1),
               ''ki_belege'', coalesce((select jsonb_agg(to_jsonb(k) - ''user_id'' order by k.erstellt_am)
                 from public.suche_ki_belege k where k.user_id = $1), ''[]''::jsonb))'
      into kronen using uid;
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
    -- Anmeldeprotokoll von Supabase (Zeitpunkt, Art, IP); null, wenn die Funktion es nicht lesen darf
    'anmeldeprotokoll', protokoll
  ) || werkstatt;
end;
$$;

revoke execute on function public.meine_daten() from public, anon;
grant execute on function public.meine_daten() to authenticated;
