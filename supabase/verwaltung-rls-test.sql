-- RLS- und Ablauf-Test fuer supabase/verwaltung-schema.sql. Im Supabase SQL Editor ausfuehren (nach dem Schema).
-- Alles laeuft in einer Transaktion und wird am Ende zurueckgerollt: keine Testkonten, keine Verwalter, kein Protokoll
-- bleibt zurueck. Jeder Fehler bricht mit "FEHLER: ..." ab; ohne Fehler meldet der Lauf "Verwaltung-RLS-Test erfolgreich".
begin;

insert into auth.users (id, email)
values
  ('a7777777-7777-4777-8777-777777777777', 'verw-chef@example.invalid'),
  ('b8888888-8888-4888-8888-888888888888', 'verw-konto@example.invalid');
insert into public.verwalter (user_id) values ('a7777777-7777-4777-8777-777777777777');

-- Normales Konto: jede Verwaltungsfunktion verweigert, Tabellen unsichtbar
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b8888888-8888-4888-8888-888888888888","role":"authenticated"}', true);
do $$
declare
  n integer;
begin
  if public.ist_verwalter() then
    raise exception 'FEHLER: normales Konto gilt als Verwalter';
  end if;
  begin
    perform public.verwaltung_konten();
    raise exception 'FEHLER: normales Konto sieht die Kontoliste';
  exception when others then
    if sqlerrm not like '%VERWALTUNG_KEIN_RECHT%' then raise; end if;
  end;
  begin
    perform public.verwaltung_premium('b8888888-8888-4888-8888-888888888888', now() + interval '30 days');
    raise exception 'FEHLER: normales Konto schaltet sich Premium frei';
  exception when others then
    if sqlerrm not like '%VERWALTUNG_KEIN_RECHT%' then raise; end if;
  end;
  begin
    perform public.verwaltung_banner('b8888888-8888-4888-8888-888888888888', 'saison-krone', true);
    raise exception 'FEHLER: normales Konto vergibt sich ein Banner';
  exception when others then
    if sqlerrm not like '%VERWALTUNG_KEIN_RECHT%' then raise; end if;
  end;
  begin
    insert into public.verwalter (user_id) values ('b8888888-8888-4888-8888-888888888888');
    raise exception 'FEHLER: normales Konto traegt sich als Verwalter ein';
  exception when insufficient_privilege then null;
  end;
  begin
    select count(*) into n from public.verwaltung_protokoll;
    if n > 0 then raise exception 'FEHLER: normales Konto liest das Protokoll'; end if;
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

-- Ohne Anmeldung: kein Aufruf
set local role anon;
select set_config('request.jwt.claims', '', true);
do $$
begin
  begin
    perform public.verwaltung_konten();
    raise exception 'FEHLER: anon sieht die Kontoliste';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

-- Verwalter: sieht das Konto, schaltet Premium frei und zurueck, alles steht im Protokoll
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a7777777-7777-4777-8777-777777777777","role":"authenticated"}', true);
do $$
declare
  k jsonb;
begin
  if not public.ist_verwalter() then
    raise exception 'FEHLER: Verwalter wird nicht erkannt';
  end if;
  k := public.verwaltung_konten('verw-konto');
  if jsonb_array_length(k) <> 1 or k -> 0 ->> 'user_id' <> 'b8888888-8888-4888-8888-888888888888' then
    raise exception 'FEHLER: Kontoliste findet das Testkonto nicht: %', k;
  end if;
  perform public.verwaltung_premium('b8888888-8888-4888-8888-888888888888', now() + interval '30 days');
  if not (public.verwaltung_kaeufe('b8888888-8888-4888-8888-888888888888') ->> 'premium')::boolean then
    raise exception 'FEHLER: Premium wurde nicht freigeschaltet';
  end if;
  perform public.verwaltung_premium('b8888888-8888-4888-8888-888888888888', null);
  if (public.verwaltung_kaeufe('b8888888-8888-4888-8888-888888888888') ->> 'premium')::boolean then
    raise exception 'FEHLER: Premium wurde nicht zurueckgenommen';
  end if;
  perform public.verwaltung_name('b8888888-8888-4888-8888-888888888888', 'Verw_Probe');
  perform public.verwaltung_banner('b8888888-8888-4888-8888-888888888888', 'saison-krone', true);
  if (select count(*) from jsonb_array_elements(public.verwaltung_protokoll_lesen(500)) e
      where e ->> 'ziel_user' = 'b8888888-8888-4888-8888-888888888888') <> 4 then
    raise exception 'FEHLER: Protokoll fuehrt nicht alle vier Aenderungen';
  end if;
end
$$;
reset role;

do $$ begin raise notice 'Verwaltung-RLS-Test erfolgreich'; end; $$;
rollback;
