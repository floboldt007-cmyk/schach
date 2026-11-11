-- Prueft supabase/liga-bild-schema.sql im Supabase SQL Editor (als Besitzer, wie dort ueblich), NACH dem Einspielen.
-- Alles wird am Ende zurueckgerollt. Zwei kurzlebige Nutzer A und B in einer Gruppe (Springer, 28 Bots dazu).
-- Geprueft: Menschen bekommen Profilbild (motiv, grund, rahmen) und Banner, ein getragenes Banner ohne Besitz zeigt das
-- Start-Banner, KI-Mitspieler bekommen nichts davon, Titel, Vitrine und Nutzerkennungen bleiben aussen vor.
-- Jeder Fehler bricht mit "FEHLER: ..." ab; ohne Fehler endet der Lauf mit ROLLBACK.
begin;

insert into auth.users (id, email)
values
  ('a7a7a7a7-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'liga-bild-a@example.invalid'),
  ('b7b7b7b7-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'liga-bild-b@example.invalid');

do $$
begin
  perform public.kronen_stand_sichern('a7a7a7a7-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  perform public.kronen_stand_sichern('b7b7b7b7-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  update public.kronen_stand set stufe = 3
    where user_id in ('a7a7a7a7-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'b7b7b7b7-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  perform public.liga_buchen('a7a7a7a7-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 50);
  perform public.liga_buchen('b7b7b7b7-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 40);
  if (select count(distinct gruppe) from public.liga_mitglieder
      where user_id in ('a7a7a7a7-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'b7b7b7b7-bbbb-4bbb-8bbb-bbbbbbbbbbbb')) <> 1 then
    raise exception 'FEHLER: A und B sind nicht in derselben Gruppe';
  end if;
end;
$$;

-- A traegt das Turm-Banner, besitzt es aber nicht (dann zeigt die Gruppe das Start-Banner); Titel und Vitrine gesetzt.
-- B traegt und besitzt das Springer-Banner.
insert into public.karte_wahl (user_id, banner, titel, vitrine, motiv, grund, rahmen)
values
  ('a7a7a7a7-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'saison-gold', 'erfolg-feuertaufe', array['stufe-siege'], 'Q', 'welt-1', 'liga-2'),
  ('b7b7b7b7-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'saison-bronze', null, '{}', 'karo', 'standard', 'ohne');
insert into public.banner_besitz (user_id, banner, quelle) values ('b7b7b7b7-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'saison-bronze', 'liga');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a7a7a7a7-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);

do $$
declare
  g jsonb;
  a jsonb;
  b jsonb;
begin
  g := public.liga_meine_gruppe();
  select e into a from jsonb_array_elements(g->'mitglieder') e where (e->>'ich')::boolean;
  select e into b from jsonb_array_elements(g->'mitglieder') e where not (e->>'ich')::boolean and not (e->>'ki')::boolean;
  if jsonb_array_length(g->'mitglieder') <> 30 or a is null or b is null then
    raise exception 'FEHLER: Gruppe unvollstaendig (%)', g;
  end if;
  if a->>'motiv' <> 'Q' or a->>'grund' <> 'welt-1' or a->>'rahmen' <> 'liga-2' or a->>'banner' <> 'start' then
    raise exception 'FEHLER: eigenes Bild oder Banner falsch (Banner ohne Besitz muss start sein) (%)', a;
  end if;
  if b->>'motiv' <> 'karo' or b->>'grund' <> 'standard' or b->>'rahmen' <> 'ohne' or b->>'banner' <> 'saison-bronze' then
    raise exception 'FEHLER: Bild oder Banner von B falsch (%)', b;
  end if;
  if exists (select 1 from jsonb_array_elements(g->'mitglieder') e
             where (e->>'ki')::boolean and (e ? 'motiv' or e ? 'banner' or e ? 'grund' or e ? 'rahmen')) then
    raise exception 'FEHLER: KI-Mitspieler bekommen Bild oder Banner';
  end if;
  if exists (select 1 from jsonb_array_elements(g->'mitglieder') e where e ? 'titel' or e ? 'vitrine' or e ? 'user_id') then
    raise exception 'FEHLER: Gruppe zeigt Titel, Vitrine oder Kennung';
  end if;
  if g::text ~ '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-' then
    raise exception 'FEHLER: liga_meine_gruppe gibt Nutzerkennungen heraus';
  end if;
end;
$$;
reset role;

rollback;
