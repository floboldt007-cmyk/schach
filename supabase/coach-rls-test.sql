-- RLS- und Ablauf-Test fuer supabase/coach-schema.sql. Im Supabase SQL Editor ausfuehren (nach schema.sql,
-- abo-schema.sql und coach-schema.sql). Alles laeuft in einer Transaktion und wird am Ende zurueckgerollt: keine
-- Testnutzer und keine Zaehler bleiben zurueck. Am Ende steht "Coach-RLS-Test erfolgreich".
begin;

insert into auth.users (id, email)
values
  ('a1111111-1111-4111-8111-111111111111', 'coach-a@example.invalid'),
  ('b2222222-2222-4222-8222-222222222222', 'coach-b@example.invalid');

-- Als Besitzer: ein alter Tag von A (8 Tage zurueck) und ein Tag von gestern, um das Aufraeumen zu pruefen
insert into public.coach_nutzung (user_id, tag, anzahl)
values
  ('a1111111-1111-4111-8111-111111111111', public.coach_tag() - 8, 12),
  ('a1111111-1111-4111-8111-111111111111', public.coach_tag() - 1, 5);

-- Der Coach-Tag ist Europe/Berlin mit Tagesgrenze 4:00
do $$
begin
  if public.coach_tag() <> ((now() at time zone 'Europe/Berlin') - interval '4 hours')::date then
    raise exception 'FEHLER: coach_tag rechnet nicht Europe/Berlin mit Tagesgrenze 4:00';
  end if;
  begin
    insert into public.coach_nutzung (user_id, tag, anzahl) values ('b2222222-2222-4222-8222-222222222222', public.coach_tag() - 3, -1);
    raise exception 'FEHLER: negative Anzahl wurde angenommen';
  exception when check_violation then null;
  end;
end
$$;

-- ---------- anon: nichts ----------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin
    perform 1 from public.coach_nutzung;
    raise exception 'FEHLER: anon kann coach_nutzung lesen';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.coach_nimm_frage('a1111111-1111-4111-8111-111111111111', 30);
    raise exception 'FEHLER: anon darf coach_nimm_frage aufrufen';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.coach_gib_zurueck('a1111111-1111-4111-8111-111111111111');
    raise exception 'FEHLER: anon darf coach_gib_zurueck aufrufen';
  exception when insufficient_privilege then null;
  end;
end
$$;

-- ---------- Nutzer A: liest nur die eigenen Zeilen, zaehlt und schreibt nie selbst ----------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.coach_nutzung) <> 2
    or exists (select 1 from public.coach_nutzung where user_id <> 'a1111111-1111-4111-8111-111111111111') then
    raise exception 'FEHLER: Nutzer A sieht nicht genau die eigenen Zeilen';
  end if;
  begin
    perform public.coach_nimm_frage('a1111111-1111-4111-8111-111111111111', 1000);
    raise exception 'FEHLER: Nutzer darf coach_nimm_frage aufrufen';
  exception when insufficient_privilege then null;
  end;
  -- Wer sich Fragen zurueckgeben koennte, haette kein Tageslimit mehr
  begin
    perform public.coach_gib_zurueck('a1111111-1111-4111-8111-111111111111');
    raise exception 'FEHLER: Nutzer darf coach_gib_zurueck aufrufen';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.coach_nutzung set anzahl = 0;
    raise exception 'FEHLER: Nutzer kann den eigenen Zaehler aendern';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.coach_nutzung;
    raise exception 'FEHLER: Nutzer kann den eigenen Zaehler loeschen';
  exception when insufficient_privilege then null;
  end;
  begin
    -- festes Datum statt coach_tag(): Nutzer duerfen coach_tag() nicht aufrufen, sonst schluege schon das fehl
    insert into public.coach_nutzung (user_id, tag, anzahl) values ('a1111111-1111-4111-8111-111111111111', date '2030-01-01', 0);
    raise exception 'FEHLER: Nutzer kann Zaehler anlegen';
  exception when insufficient_privilege then null;
  end;
end
$$;

-- ---------- Nutzer B: sieht nichts von A ----------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.coach_nutzung) <> 0 then
    raise exception 'FEHLER: Nutzer B sieht fremde Zaehler';
  end if;
end
$$;

-- ---------- Service-Rolle (Edge Function coach): zaehlen, Grenze, zurueckgeben, aufraeumen ----------
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
declare
  a constant uuid := 'a1111111-1111-4111-8111-111111111111';
  b constant uuid := 'b2222222-2222-4222-8222-222222222222';
begin
  if public.coach_nimm_frage(a, 3) <> 2 then raise exception 'FEHLER: erste Frage meldet nicht 2 frei'; end if;
  -- die erste Frage des Tages raeumt Tage auf, die aelter als eine Woche sind; gestern bleibt
  if exists (select 1 from public.coach_nutzung where user_id = a and tag = public.coach_tag() - 8)
    or not exists (select 1 from public.coach_nutzung where user_id = a and tag = public.coach_tag() - 1 and anzahl = 5) then
    raise exception 'FEHLER: Aufraeumen alter Tage falsch';
  end if;
  if public.coach_nimm_frage(a, 3) <> 1 then raise exception 'FEHLER: zweite Frage meldet nicht 1 frei'; end if;
  if public.coach_nimm_frage(a, 3) <> 0 then raise exception 'FEHLER: dritte Frage meldet nicht 0 frei'; end if;
  if public.coach_nimm_frage(a, 3) <> -1 then raise exception 'FEHLER: vierte Frage ueber der Grenze angenommen'; end if;
  if (select anzahl from public.coach_nutzung where user_id = a and tag = public.coach_tag()) <> 3 then
    raise exception 'FEHLER: Frage ueber der Grenze wurde trotzdem gezaehlt';
  end if;
  -- KI hat nicht geantwortet: Frage zurueck, danach geht wieder genau eine
  if public.coach_gib_zurueck(a) <> 2 then raise exception 'FEHLER: coach_gib_zurueck liefert nicht 2'; end if;
  if public.coach_nimm_frage(a, 3) <> 0 then raise exception 'FEHLER: nach dem Zurueckgeben keine Frage frei'; end if;
  if public.coach_nimm_frage(a, 3) <> -1 then raise exception 'FEHLER: Grenze nach dem Zurueckgeben falsch'; end if;
  -- eine hoehere Grenze (Flo stellt COACH_TAGESLIMIT um) gilt sofort
  if public.coach_nimm_frage(a, 5) <> 1 then raise exception 'FEHLER: hoehere Grenze gilt nicht sofort'; end if;
  -- Nutzer B ist unabhaengig, Zurueckgeben ohne Zeile tut nichts
  if public.coach_gib_zurueck(b) <> -1 then raise exception 'FEHLER: coach_gib_zurueck ohne Zeile'; end if;
  if public.coach_nimm_frage(b, 30) <> 29 then raise exception 'FEHLER: Nutzer B haengt an A'; end if;
  -- einzeln nacheinander (in einem "or" legt SQL die Reihenfolge der Aufrufe nicht fest)
  if public.coach_gib_zurueck(b) <> 0 then raise exception 'FEHLER: coach_gib_zurueck liefert nicht 0'; end if;
  if public.coach_gib_zurueck(b) <> -1 then raise exception 'FEHLER: coach_gib_zurueck bei 0 liefert nicht -1'; end if;
  if (select anzahl from public.coach_nutzung where user_id = b and tag = public.coach_tag()) <> 0 then
    raise exception 'FEHLER: coach_gib_zurueck geht unter 0';
  end if;
  -- Fehler-Kennungen
  begin
    perform public.coach_nimm_frage(a, 0);
    raise exception 'FEHLER: Grenze 0 angenommen';
  exception when raise_exception then
    if sqlerrm <> 'COACH_GRENZE_UNGUELTIG' then raise; end if;
  end;
  begin
    perform public.coach_nimm_frage(a, 1001);
    raise exception 'FEHLER: Grenze 1001 angenommen';
  exception when raise_exception then
    if sqlerrm <> 'COACH_GRENZE_UNGUELTIG' then raise; end if;
  end;
  begin
    perform public.coach_nimm_frage(null, 30);
    raise exception 'FEHLER: Nutzer null angenommen';
  exception when raise_exception then
    if sqlerrm <> 'COACH_NUTZER_FEHLT' then raise; end if;
  end;
end
$$;

-- Nutzer A sieht danach den eigenen Stand von heute (Datenauskunft), weiter nichts von B
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
do $$
begin
  if (select anzahl from public.coach_nutzung where tag = ((now() at time zone 'Europe/Berlin') - interval '4 hours')::date) <> 4
    or (select count(*) from public.coach_nutzung) <> 2 then
    raise exception 'FEHLER: Nutzer A sieht den eigenen Stand nicht richtig';
  end if;
end
$$;

-- Konto loeschen nimmt die Zaehler mit
reset role;
delete from auth.users where id = 'a1111111-1111-4111-8111-111111111111';
do $$
begin
  if exists (select 1 from public.coach_nutzung where user_id = 'a1111111-1111-4111-8111-111111111111') then
    raise exception 'FEHLER: Zaehler bleiben nach dem Loeschen des Kontos';
  end if;
end
$$;

select 'Coach-RLS-Test erfolgreich' as ergebnis;
rollback;
