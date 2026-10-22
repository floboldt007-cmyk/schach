-- Online gegen Freunde (Stufe 2, Fundament): eine Partie je Zeile, Aenderungen nur ueber Funktionen.
-- Mehrfach ausfuehrbar (Muster: schema.sql). Vorher schema.sql einspielen (gleicher Zeitstempel-Trigger).
--
-- Was der Server prueft: wer am Zug ist, Status der Partie, Form von Zug und Stellung, und er fuehrt die Uhr
-- mit seiner eigenen Zeit. Die Schachregeln selbst prueft er NICHT: Beide Clients rechnen mit chess.js, unter
-- Freunden reicht das. Fuer Partien gegen Fremde kommt spaeter eine Edge Function, die jeden Zug nachrechnet.
--
-- Zuege stehen in `zuege` als UCI ("e2e4 e7e5 g1f3"), durch ein Leerzeichen getrennt, genau wie im Partie-
-- Datensatz von js/storage.js (zuege: [uci]). UCI ist sprachunabhaengig und eindeutig; SAN braeuchte zum Lesen
-- die Stellung und waere je nach Sprache anders geschrieben.
--
-- Uhr: `bedenkzeit_s` null heisst ohne Uhr. Sonst bekommen beide beim Beitritt `bedenkzeit_s * 1000` ms.
-- Der jeweils erste Zug von Weiss und von Schwarz kostet keine Zeit (eine Einladung darf in Ruhe angenommen
-- werden, auch Stunden spaeter). Ab dem dritten Halbzug zieht der Server `clock_timestamp() - letzter_zug_am`
-- von der Uhr des Ziehenden ab und addiert danach `inkrement_s`. Ist die Uhr dabei auf 0 oder darunter, ist die
-- Partie durch Zeitueberschreitung beendet und der Zug wird nicht mehr verbucht.
-- Die Uhr wird nicht nur beim eigenen Zug geprueft: Zug, Remis, Remis-Annahme und Aufgabe pruefen zuerst die
-- laufende Uhr der Seite am Zug (online_uhr_pruefen), und mit online_pruefe_zeit kann jeder der beiden Spieler
-- die Zeit reklamieren, wenn der Gegner einfach nicht mehr zieht. Wer ueber der Zeit ist, verliert also auch,
-- wenn er gar nichts mehr tut, und kann kein Remis mehr annehmen. (Ob der Gegner ueberhaupt noch matt setzen
-- koennte, prueft der Server nicht: Regeln rechnen die Clients.)
--
-- Einladungen gelten 24 Stunden (online_tritt_bei lehnt aeltere ab, online_meine zeigt sie nicht mehr). Der Code
-- kommt aus gen_random_uuid() (kryptografischer Zufall), nicht aus random(). Neue Partien entstehen nur ueber
-- online_erstelle: Ein direktes insert ist fuer authenticated nicht erlaubt.
--
-- Fehler melden die Funktionen als kurze Kennungen (z. B. ONLINE_NICHT_DEIN_ZUG); js/online.js uebersetzt sie
-- in ganze Saetze. Die Kennungen sind ein Vertrag: wer eine aendert, aendert auch js/online.js.
--
-- Hinweis fuer spaetere Aenderungen: `create or replace function` kann weder Parameternamen noch Rueckgabetyp
-- einer bestehenden Funktion aendern. Dann vorher `drop function public.<name>(<typen>)` ausfuehren.

create table if not exists public.partien_online (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  weiss uuid references auth.users (id) on delete cascade,
  schwarz uuid references auth.users (id) on delete cascade,
  erstellt_von uuid not null references auth.users (id) on delete cascade,
  status text not null default 'offen',
  fen text not null,
  zuege text not null default '',
  am_zug text not null default 'w',
  ergebnis text,
  grund text,
  remis_angebot text,
  bedenkzeit_s integer,
  inkrement_s integer,
  uhr_weiss_ms integer,
  uhr_schwarz_ms integer,
  letzter_zug_am timestamptz,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now(),
  constraint partien_online_code_form
    check (char_length(code) = 6 and code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'),
  constraint partien_online_status check (status in ('offen', 'laeuft', 'beendet')),
  constraint partien_online_am_zug check (am_zug in ('w', 'b')),
  constraint partien_online_ergebnis check (ergebnis is null or ergebnis in ('1-0', '0-1', '1/2-1/2')),
  constraint partien_online_remis_angebot check (remis_angebot is null or remis_angebot in ('w', 'b')),
  constraint partien_online_fen_groesse check (char_length(fen) <= 120),
  constraint partien_online_fen_form
    check (fen ~ '^([pnbrqkPNBRQK1-8]{1,8}/){7}[pnbrqkPNBRQK1-8]{1,8} [wb] (-|[KQkq]{1,4}) (-|[a-h][36]) [0-9]+ [0-9]+$'),
  constraint partien_online_zuege_groesse check (char_length(zuege) <= 20000),
  constraint partien_online_grund_groesse check (grund is null or char_length(grund) <= 40),
  constraint partien_online_bedenkzeit check (bedenkzeit_s is null or bedenkzeit_s between 1 and 10800),
  constraint partien_online_inkrement check (inkrement_s is null or inkrement_s between 0 and 600),
  constraint partien_online_spieler_verschieden check (weiss is null or schwarz is null or weiss <> schwarz)
);

create index if not exists partien_online_weiss on public.partien_online (weiss);
create index if not exists partien_online_schwarz on public.partien_online (schwarz);
create index if not exists partien_online_erstellt_von on public.partien_online (erstellt_von);

-- Der Zeitstempel wird bei jeder Aenderung serverseitig erneuert (gleiche Funktion wie in schema.sql; hier noch
-- einmal, damit diese Datei auch allein laeuft). js/online.js fragt ueber aktualisiert_am nach Neuem.
create or replace function public.setze_aktualisiert_am()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.aktualisiert_am = now();
  return new;
end;
$$;

drop trigger if exists partien_online_setze_aktualisiert_am on public.partien_online;
create trigger partien_online_setze_aktualisiert_am
before update on public.partien_online
for each row execute function public.setze_aktualisiert_am();

-- Beim Anlegen entscheidet der Server, nicht der Client: Der Code wird immer hier erzeugt (6 Zeichen ohne
-- 0/O/1/I, damit man ihn am Telefon vorlesen kann), und eine neue Partie ist immer eine leere, offene
-- Einladung mit vollen Uhren aus der Grundstellung. Angelegt wird nur ueber online_erstelle (kein direktes insert).
create or replace function public.online_vor_anlegen()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  zeichen constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  neu text := '';
  zufall bytea := pg_catalog.uuid_send(pg_catalog.gen_random_uuid());
  i integer;
begin
  -- die ersten 6 Bytes einer v4-UUID sind voller Zufall; 256 ist durch 32 teilbar, also gleichverteilt
  for i in 0..5 loop
    neu := neu || substr(zeichen, 1 + (get_byte(zufall, i) % 32), 1);
  end loop;
  new.code := neu;
  new.status := 'offen';
  new.zuege := '';
  new.am_zug := 'w';
  new.ergebnis := null;
  new.grund := null;
  new.remis_angebot := null;
  new.letzter_zug_am := null;
  if new.bedenkzeit_s is null then
    new.inkrement_s := null;
    new.uhr_weiss_ms := null;
    new.uhr_schwarz_ms := null;
  else
    new.inkrement_s := coalesce(new.inkrement_s, 0);
    new.uhr_weiss_ms := new.bedenkzeit_s * 1000;
    new.uhr_schwarz_ms := new.bedenkzeit_s * 1000;
  end if;
  new.fen := 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  new.erstellt_am := now();
  new.aktualisiert_am := now();
  return new;
end;
$$;

drop trigger if exists partien_online_vor_anlegen on public.partien_online;
create trigger partien_online_vor_anlegen
before insert on public.partien_online
for each row execute function public.online_vor_anlegen();

-- Einladung anlegen. farbe 'w' | 'b' | 'zufall' ist die Farbe des Erstellers. Bei einem Code-Zusammenstoss
-- (1 zu einer Milliarde) wird neu gewuerfelt.
create or replace function public.online_erstelle(farbe text, bedenkzeit_s integer default null, inkrement_s integer default null)
returns public.partien_online
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_farbe text := farbe;
  v_bedenkzeit integer := bedenkzeit_s;
  v_inkrement integer := inkrement_s;
  p public.partien_online;
  versuch integer;
begin
  if uid is null then
    raise exception 'ONLINE_NICHT_ANGEMELDET';
  end if;
  if v_farbe is null or v_farbe not in ('w', 'b', 'zufall') then
    raise exception 'ONLINE_FARBE';
  end if;
  if v_bedenkzeit is not null and (v_bedenkzeit < 1 or v_bedenkzeit > 10800) then
    raise exception 'ONLINE_BEDENKZEIT';
  end if;
  if v_bedenkzeit is null then
    v_inkrement := null;
  elsif v_inkrement is null then
    v_inkrement := 0;
  elsif v_inkrement < 0 or v_inkrement > 600 then
    raise exception 'ONLINE_BEDENKZEIT';
  end if;
  if v_farbe = 'zufall' then
    v_farbe := case when random() < 0.5 then 'w' else 'b' end;
  end if;
  for versuch in 1..20 loop
    begin
      insert into public.partien_online (erstellt_von, weiss, schwarz, status, fen, bedenkzeit_s, inkrement_s)
      values (
        uid,
        case when v_farbe = 'w' then uid end,
        case when v_farbe = 'b' then uid end,
        'offen',
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        v_bedenkzeit,
        v_inkrement
      )
      returning * into p;
      return p;
    exception
      when unique_violation then
        null; -- Code schon vergeben: neuer Versuch mit neuem Code
    end;
  end loop;
  raise exception 'ONLINE_KEIN_CODE';
end;
$$;

-- Einer Einladung beitreten. Der Beitretende bekommt die freie Farbe, die Partie laeuft ab jetzt, Weiss am Zug.
create or replace function public.online_tritt_bei(code text)
returns public.partien_online
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
  p public.partien_online;
  neu_weiss uuid;
  neu_schwarz uuid;
begin
  if uid is null then
    raise exception 'ONLINE_NICHT_ANGEMELDET';
  end if;
  if v_code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$' then
    raise exception 'ONLINE_CODE_UNGUELTIG';
  end if;
  select * into p from public.partien_online t where t.code = v_code for update;
  if not found or p.status <> 'offen' then
    raise exception 'ONLINE_CODE_UNGUELTIG';
  end if;
  if p.erstellt_am < now() - interval '24 hours' then
    raise exception 'ONLINE_CODE_ABGELAUFEN';
  end if;
  if p.weiss is null and p.schwarz is null then
    raise exception 'ONLINE_CODE_UNGUELTIG'; -- der Ersteller muss selbst mitspielen
  end if;
  if p.erstellt_von = uid or p.weiss = uid or p.schwarz = uid then
    raise exception 'ONLINE_EIGENE_PARTIE';
  end if;
  if p.weiss is null then
    neu_weiss := uid;
    neu_schwarz := p.schwarz;
  elsif p.schwarz is null then
    neu_weiss := p.weiss;
    neu_schwarz := uid;
  else
    raise exception 'ONLINE_CODE_UNGUELTIG';
  end if;
  update public.partien_online t
  set weiss = neu_weiss,
      schwarz = neu_schwarz,
      status = 'laeuft',
      am_zug = 'w',
      uhr_weiss_ms = case when t.bedenkzeit_s is null then null else t.bedenkzeit_s * 1000 end,
      uhr_schwarz_ms = case when t.bedenkzeit_s is null then null else t.bedenkzeit_s * 1000 end,
      letzter_zug_am = clock_timestamp(),
      remis_angebot = null
  where t.id = p.id
  returning * into p;
  return p;
end;
$$;

-- Gemeinsame Pruefung fuer Zug, Remis und Aufgabe: Partie laden und sperren, Aufrufer muss Spieler sein,
-- Partie muss laufen. Nur intern (kein Recht fuer authenticated).
create or replace function public.online_hole_laufende(partie uuid, uid uuid)
returns public.partien_online
language plpgsql
set search_path = public
as $$
declare
  p public.partien_online;
begin
  if uid is null then
    raise exception 'ONLINE_NICHT_ANGEMELDET';
  end if;
  select * into p from public.partien_online t where t.id = partie for update;
  if not found or (p.weiss is distinct from uid and p.schwarz is distinct from uid) then
    raise exception 'ONLINE_PARTIE_UNBEKANNT';
  end if;
  if p.status = 'offen' then
    raise exception 'ONLINE_PARTIE_NICHT_GESTARTET';
  end if;
  if p.status <> 'laeuft' then
    raise exception 'ONLINE_PARTIE_BEENDET';
  end if;
  return p;
end;
$$;

-- Laufende Uhr der Seite am Zug pruefen (die Zeile muss schon gesperrt sein). Ist sie abgelaufen, endet die Partie
-- hier mit grund 'zeit' und die Funktion gibt die beendete Zeile zurueck; sonst die unveraenderte. Kein raise:
-- eine Ausnahme wuerde die Beendigung wieder zurueckrollen. Nur intern (kein Recht fuer authenticated).
-- Wie in online_zug kostet der jeweils erste Zug von Weiss und Schwarz keine Zeit (weniger als 2 Halbzuege).
create or replace function public.online_uhr_pruefen(p public.partien_online)
returns public.partien_online
language plpgsql
set search_path = public
as $$
declare
  halbzuege integer;
  rest_ms bigint;
begin
  if p.status <> 'laeuft' or p.bedenkzeit_s is null or p.letzter_zug_am is null then
    return p;
  end if;
  halbzuege := case when p.zuege = '' then 0 else array_length(string_to_array(p.zuege, ' '), 1) end;
  if halbzuege < 2 then
    return p;
  end if;
  rest_ms := (case when p.am_zug = 'w' then p.uhr_weiss_ms else p.uhr_schwarz_ms end)
             - floor(extract(epoch from (clock_timestamp() - p.letzter_zug_am)) * 1000);
  if rest_ms > 0 then
    return p;
  end if;
  update public.partien_online t
  set uhr_weiss_ms = case when p.am_zug = 'w' then 0 else t.uhr_weiss_ms end,
      uhr_schwarz_ms = case when p.am_zug = 'b' then 0 else t.uhr_schwarz_ms end,
      status = 'beendet',
      ergebnis = case when p.am_zug = 'w' then '0-1' else '1-0' end,
      grund = 'zeit',
      remis_angebot = null
  where t.id = p.id
  returning * into p;
  return p;
end;
$$;

-- Zeit reklamieren: Jeder der beiden Spieler darf fragen, ob die Uhr der Seite am Zug abgelaufen ist. Dann ist
-- die Partie beendet (grund 'zeit'). Antwort ist immer die aktuelle Zeile, auch wenn nichts abgelaufen ist oder
-- die Partie schon vorbei war, damit der Client danach einfach anzeigt, was zurueckkommt.
create or replace function public.online_pruefe_zeit(partie uuid)
returns public.partien_online
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p public.partien_online;
begin
  if uid is null then
    raise exception 'ONLINE_NICHT_ANGEMELDET';
  end if;
  select * into p from public.partien_online t where t.id = partie for update;
  if not found or (p.weiss is distinct from uid and p.schwarz is distinct from uid) then
    raise exception 'ONLINE_PARTIE_UNBEKANNT';
  end if;
  return public.online_uhr_pruefen(p);
end;
$$;

-- Einen Zug verbuchen. zug: UCI (e2e4, e7e8q). fen_danach und am_zug_danach kommen vom Client (chess.js),
-- der Server prueft nur die Form und dass die Seite am Zug wechselt. ergebnis '1-0' | '0-1' | '1/2-1/2'
-- beendet die Partie (grund z. B. 'matt', 'patt', 'wiederholung', 'material', '50-zuege').
create or replace function public.online_zug(partie uuid, zug text, fen_danach text, am_zug_danach text, ergebnis text default null, grund text default null)
returns public.partien_online
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_ergebnis text := ergebnis;
  v_grund text := grund;
  p public.partien_online;
  farbe text;
  gegner text;
  halbzuege integer;
  jetzt timestamptz := clock_timestamp();
  verbraucht_ms bigint;
  uhr_ms bigint;
begin
  p := public.online_hole_laufende(partie, uid);
  -- zuerst die Uhr der Seite am Zug: ist sie abgelaufen, endet die Partie hier (auch wenn der Gegner ruft)
  p := public.online_uhr_pruefen(p);
  if p.status <> 'laeuft' then
    return p; -- Zeit abgelaufen, bevor der Zug kam: Partie beendet, Zug verfaellt
  end if;
  farbe := case when p.weiss = uid then 'w' else 'b' end;
  gegner := case when farbe = 'w' then 'b' else 'w' end;
  if p.am_zug <> farbe then
    raise exception 'ONLINE_NICHT_DEIN_ZUG';
  end if;
  if zug is null or zug !~ '^[a-h][1-8][a-h][1-8][qrbn]?$' then
    raise exception 'ONLINE_ZUG_FORM';
  end if;
  if fen_danach is null or char_length(fen_danach) > 120
     or fen_danach !~ '^([pnbrqkPNBRQK1-8]{1,8}/){7}[pnbrqkPNBRQK1-8]{1,8} [wb] (-|[KQkq]{1,4}) (-|[a-h][36]) [0-9]+ [0-9]+$' then
    raise exception 'ONLINE_FEN_FORM';
  end if;
  if am_zug_danach is distinct from gegner or split_part(fen_danach, ' ', 2) <> gegner then
    raise exception 'ONLINE_AM_ZUG_FORM';
  end if;
  if v_ergebnis is not null and v_ergebnis not in ('1-0', '0-1', '1/2-1/2') then
    raise exception 'ONLINE_ERGEBNIS_FORM';
  end if;
  if v_grund is not null and char_length(v_grund) > 40 then
    raise exception 'ONLINE_ERGEBNIS_FORM';
  end if;
  if v_ergebnis is null then
    v_grund := null;
  end if;

  halbzuege := case when p.zuege = '' then 0 else array_length(string_to_array(p.zuege, ' '), 1) end;
  uhr_ms := case when farbe = 'w' then p.uhr_weiss_ms else p.uhr_schwarz_ms end;
  if p.bedenkzeit_s is not null and halbzuege >= 2 then
    verbraucht_ms := floor(extract(epoch from (jetzt - coalesce(p.letzter_zug_am, jetzt))) * 1000);
    uhr_ms := uhr_ms - verbraucht_ms;
    if uhr_ms <= 0 then
      -- Zeit abgelaufen, bevor der Zug kam: Partie beendet, Zug verfaellt
      update public.partien_online t
      set uhr_weiss_ms = case when farbe = 'w' then 0 else t.uhr_weiss_ms end,
          uhr_schwarz_ms = case when farbe = 'b' then 0 else t.uhr_schwarz_ms end,
          status = 'beendet',
          ergebnis = case when farbe = 'w' then '0-1' else '1-0' end,
          grund = 'zeit',
          remis_angebot = null
      where t.id = p.id
      returning * into p;
      return p;
    end if;
    uhr_ms := uhr_ms + coalesce(p.inkrement_s, 0) * 1000;
  end if;

  update public.partien_online t
  set zuege = case when t.zuege = '' then zug else t.zuege || ' ' || zug end,
      fen = fen_danach,
      am_zug = am_zug_danach,
      uhr_weiss_ms = case when farbe = 'w' then uhr_ms else t.uhr_weiss_ms end,
      uhr_schwarz_ms = case when farbe = 'b' then uhr_ms else t.uhr_schwarz_ms end,
      letzter_zug_am = jetzt,
      -- ein Remisangebot gilt bis zum naechsten Zug des Gegners (der eigene Zug nimmt es nicht zurueck)
      remis_angebot = case when t.remis_angebot = farbe then t.remis_angebot else null end,
      status = case when v_ergebnis is null then 'laeuft' else 'beendet' end,
      ergebnis = v_ergebnis,
      grund = v_grund
  where t.id = p.id
  returning * into p;
  return p;
end;
$$;

-- Aufgeben. Bei einer noch offenen Einladung zieht der Ersteller sie damit zurueck (grund 'abgebrochen').
create or replace function public.online_gib_auf(partie uuid)
returns public.partien_online
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p public.partien_online;
  farbe text;
begin
  if uid is null then
    raise exception 'ONLINE_NICHT_ANGEMELDET';
  end if;
  select * into p from public.partien_online t where t.id = partie for update;
  if not found or (p.weiss is distinct from uid and p.schwarz is distinct from uid and p.erstellt_von <> uid) then
    raise exception 'ONLINE_PARTIE_UNBEKANNT';
  end if;
  if p.status = 'beendet' then
    raise exception 'ONLINE_PARTIE_BEENDET';
  end if;
  if p.status = 'offen' then
    if p.erstellt_von <> uid then
      raise exception 'ONLINE_PARTIE_UNBEKANNT';
    end if;
    update public.partien_online t
    set status = 'beendet', ergebnis = null, grund = 'abgebrochen', remis_angebot = null
    where t.id = p.id
    returning * into p;
    return p;
  end if;
  if p.weiss is distinct from uid and p.schwarz is distinct from uid then
    raise exception 'ONLINE_PARTIE_UNBEKANNT'; -- nur wer am Brett sitzt, kann aufgeben
  end if;
  p := public.online_uhr_pruefen(p);
  if p.status <> 'laeuft' then
    return p; -- schon vorher auf Zeit entschieden
  end if;
  farbe := case when p.weiss = uid then 'w' else 'b' end;
  update public.partien_online t
  set status = 'beendet',
      ergebnis = case when farbe = 'w' then '0-1' else '1-0' end,
      grund = 'aufgabe',
      remis_angebot = null
  where t.id = p.id
  returning * into p;
  return p;
end;
$$;

-- Remis anbieten. Liegt schon ein Angebot des Gegners vor, ist das die Annahme.
create or replace function public.online_biete_remis(partie uuid)
returns public.partien_online
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p public.partien_online;
  farbe text;
  gegner text;
begin
  p := public.online_hole_laufende(partie, uid);
  p := public.online_uhr_pruefen(p);
  if p.status <> 'laeuft' then
    return p; -- Uhr abgelaufen: kein Remis mehr
  end if;
  farbe := case when p.weiss = uid then 'w' else 'b' end;
  gegner := case when farbe = 'w' then 'b' else 'w' end;
  if p.remis_angebot = gegner then
    update public.partien_online t
    set status = 'beendet', ergebnis = '1/2-1/2', grund = 'remis', remis_angebot = null
    where t.id = p.id
    returning * into p;
    return p;
  end if;
  if p.remis_angebot = farbe then
    return p; -- steht schon
  end if;
  update public.partien_online t
  set remis_angebot = farbe
  where t.id = p.id
  returning * into p;
  return p;
end;
$$;

-- Remisangebot des Gegners annehmen.
create or replace function public.online_nimm_remis_an(partie uuid)
returns public.partien_online
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p public.partien_online;
  gegner text;
begin
  p := public.online_hole_laufende(partie, uid);
  p := public.online_uhr_pruefen(p);
  if p.status <> 'laeuft' then
    return p; -- Uhr abgelaufen: das Angebot zaehlt nicht mehr
  end if;
  gegner := case when p.weiss = uid then 'b' else 'w' end;
  if p.remis_angebot is distinct from gegner then
    raise exception 'ONLINE_KEIN_REMISANGEBOT';
  end if;
  update public.partien_online t
  set status = 'beendet', ergebnis = '1/2-1/2', grund = 'remis', remis_angebot = null
  where t.id = p.id
  returning * into p;
  return p;
end;
$$;

-- Offene und laufende Partien des Aufrufers, zuletzt geaenderte zuerst. Laeuft mit den Rechten des Aufrufers,
-- also unter RLS.
create or replace function public.online_meine()
returns setof public.partien_online
language sql
stable
set search_path = public
as $$
  select *
  from public.partien_online
  where (select auth.uid()) in (weiss, schwarz, erstellt_von)
    and (status = 'laeuft' or (status = 'offen' and erstellt_am >= now() - interval '24 hours'))
  order by aktualisiert_am desc;
$$;

alter table public.partien_online enable row level security;

-- Wiederholbares Einspielen: vorhandene Policies werden gezielt ersetzt.
drop policy if exists "Eigene Online-Partien lesen" on public.partien_online;
create policy "Eigene Online-Partien lesen"
on public.partien_online for select
to authenticated
using ((select auth.uid()) in (weiss, schwarz, erstellt_von));

-- Kein insert, update oder delete fuer authenticated (keine Policy und kein Tabellenrecht): Anlegen, Zuege,
-- Aufgabe und Remis laufen ausschliesslich ueber die Funktionen oben, die als Besitzer der Tabelle arbeiten.
-- (Eine fruehere Fassung erlaubte ein direktes insert; die Policy wird beim erneuten Einspielen entfernt.)
drop policy if exists "Eigene Online-Einladung anlegen" on public.partien_online;
revoke all on table public.partien_online from anon, authenticated, public;
grant select on table public.partien_online to authenticated;

-- Funktionen: nur fuer angemeldete Nutzer, nie fuer anon oder public. Die Helfer bleiben intern.
revoke all on function public.online_vor_anlegen() from anon, authenticated, public;
revoke all on function public.online_hole_laufende(uuid, uuid) from anon, authenticated, public;
revoke all on function public.online_uhr_pruefen(public.partien_online) from anon, authenticated, public;
revoke all on function public.online_pruefe_zeit(uuid) from anon, public;
revoke all on function public.online_erstelle(text, integer, integer) from anon, public;
revoke all on function public.online_tritt_bei(text) from anon, public;
revoke all on function public.online_zug(uuid, text, text, text, text, text) from anon, public;
revoke all on function public.online_gib_auf(uuid) from anon, public;
revoke all on function public.online_biete_remis(uuid) from anon, public;
revoke all on function public.online_nimm_remis_an(uuid) from anon, public;
revoke all on function public.online_meine() from anon, public;
grant execute on function public.online_erstelle(text, integer, integer) to authenticated;
grant execute on function public.online_tritt_bei(text) to authenticated;
grant execute on function public.online_zug(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.online_gib_auf(uuid) to authenticated;
grant execute on function public.online_biete_remis(uuid) to authenticated;
grant execute on function public.online_nimm_remis_an(uuid) to authenticated;
grant execute on function public.online_meine() to authenticated;
grant execute on function public.online_pruefe_zeit(uuid) to authenticated;
