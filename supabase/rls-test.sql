-- Im Supabase SQL Editor ausfuehren. Alles wird am Ende zurueckgerollt.
begin;

-- Zwei kurzlebige Auth-Nutzer, damit der Fremdschluessel realistisch bleibt.
insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'rls-a@example.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'rls-b@example.invalid');

set local role authenticated;

-- Nutzer A darf nur A anlegen.
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
insert into public.spielstaende (user_id, stand, format_version, geraet)
values ('11111111-1111-4111-8111-111111111111', '{"besitzer":"A"}', 1, 'RLS-Test');

do $$
begin
  begin
    insert into public.spielstaende (user_id, stand, format_version)
    values ('22222222-2222-4222-8222-222222222222', '{"unerlaubt":true}', 1);
    raise exception 'FEHLER: Nutzer A konnte fuer Nutzer B schreiben';
  exception
    when insufficient_privilege then null;
  end;

  if (select count(*) from public.spielstaende) <> 1 then
    raise exception 'FEHLER: Nutzer A sieht nicht genau den eigenen Spielstand';
  end if;
end
$$;

-- Nutzer B sieht A nicht und darf nur B anlegen.
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);

do $$
begin
  if exists (
    select 1 from public.spielstaende
    where user_id = '11111111-1111-4111-8111-111111111111'
  ) then
    raise exception 'FEHLER: Nutzer B kann den Spielstand von A lesen';
  end if;
end
$$;

insert into public.spielstaende (user_id, stand, format_version, geraet)
values ('22222222-2222-4222-8222-222222222222', '{"besitzer":"B"}', 1, 'RLS-Test');

update public.spielstaende
set stand = '{"besitzer":"B","geaendert":true}'
where user_id = '22222222-2222-4222-8222-222222222222';

do $$
begin
  if (select count(*) from public.spielstaende) <> 1 then
    raise exception 'FEHLER: Nutzer B sieht nicht genau den eigenen Spielstand';
  end if;

  if not exists (
    select 1 from public.spielstaende
    where user_id = '22222222-2222-4222-8222-222222222222'
      and stand @> '{"geaendert":true}'
  ) then
    raise exception 'FEHLER: Nutzer B konnte den eigenen Spielstand nicht aendern';
  end if;
end
$$;

-- Das fremde DELETE trifft wegen RLS keine Zeile; A bleibt fuer A vorhanden.
delete from public.spielstaende
where user_id = '11111111-1111-4111-8111-111111111111';

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);

do $$
begin
  if not exists (
    select 1 from public.spielstaende
    where user_id = '11111111-1111-4111-8111-111111111111'
  ) then
    raise exception 'FEHLER: Nutzer B konnte den Spielstand von A loeschen';
  end if;
end
$$;

-- Das Geraet ist nur ein kurzes Kuerzel: hoechstens 120 Zeichen, beim Anlegen wie beim Aendern.
do $$
begin
  update public.spielstaende set geraet = repeat('g', 120)
  where user_id = '11111111-1111-4111-8111-111111111111';
  if not exists (select 1 from public.spielstaende where char_length(geraet) = 120) then
    raise exception 'FEHLER: 120 Zeichen fuer geraet wurden abgelehnt';
  end if;
  begin
    update public.spielstaende set geraet = repeat('g', 121)
    where user_id = '11111111-1111-4111-8111-111111111111';
    raise exception 'FEHLER: Laengengrenze fuer spielstaende.geraet fehlt (aendern)';
  exception
    when check_violation then null;
  end;
end
$$;

-- B legt nach dem Loeschen neu an (eigene Zeile): mit 121 Zeichen abgelehnt, mit dem Kuerzel erlaubt.
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
delete from public.spielstaende where user_id = '22222222-2222-4222-8222-222222222222';
do $$
begin
  begin
    insert into public.spielstaende (user_id, stand, format_version, geraet)
    values ('22222222-2222-4222-8222-222222222222', '{"besitzer":"B"}', 1, repeat('u', 121));
    raise exception 'FEHLER: Laengengrenze fuer spielstaende.geraet fehlt (anlegen)';
  exception
    when check_violation then null;
  end;
  insert into public.spielstaende (user_id, stand, format_version, geraet)
  values ('22222222-2222-4222-8222-222222222222', '{"besitzer":"B"}', 1, 'iOS Safari');
end
$$;

select 'RLS-Test erfolgreich' as ergebnis;
rollback;
