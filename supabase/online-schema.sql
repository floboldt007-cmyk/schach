-- Online gegen Freunde (Stufe 2, Fundament): eine Partie je Zeile, Aenderungen nur ueber Funktionen.
-- Mehrfach ausfuehrbar (Muster: schema.sql). Vorher schema.sql einspielen (gleicher Zeitstempel-Trigger).
--
-- Was der Server prueft: wer am Zug ist, Status der Partie, Form von Zug und Stellung, und er fuehrt die Uhr
-- mit seiner eigenen Zeit. Die Schachregeln selbst prueft er NICHT vollstaendig: Beide Clients rechnen mit
-- chess.js, unter Freunden reicht das. Fuer Partien gegen Fremde kommt spaeter eine Edge Function, die jeden Zug
-- nachrechnet (Konzept Anti-Cheat, Etappe 1a).
--
-- Anti-Cheat Etappe 0 (Stand 29.10.2026), eine Zwischenloesung unter Freunden ohne Wertung:
--   * Einladungs-Bremse: hoechstens 5 offene und 50 neue Einladungen je Konto in 24 Stunden
--     (ONLINE_ZU_VIELE_EINLADUNGEN), parallele Aufrufe eines Kontos laufen nacheinander (pg_advisory_xact_lock).
--   * Aufraeumen beim Anlegen und bei online_meine: Einladungen (offen oder zurueckgezogen), die aelter als
--     48 Stunden sind, werden geloescht; haengende Partien enden als 'abgebrochen' (siehe online_haengt).
--   * Fehlversuche beim Beitreten: hoechstens 20 falsche Codes je Konto und Tag (Tabelle online_versuche,
--     ONLINE_ZU_VIELE_VERSUCHE). Ein falscher Code kommt deshalb als jsonb { fehler } zurueck und nicht als
--     raise: Ein raise rollte den Zaehler mit zurueck.
--   * Ergebnis-Regeln: ein Ergebnis nur mit passendem Grund. 'matt' nur als Sieg des Ziehenden, 'patt',
--     'material', 'wiederholung' und '50-zuege' nur als Remis. 'zeit', 'zeit-material', 'aufgabe', 'remis',
--     'abgebrochen' und 'strittig' setzt nur der Server selbst.
--   * Grobe Pruefung der Folgestellung: Die neue Stellung muss aus der alten plus dem Zug (von, nach, mit Rochade,
--     en passant und Umwandlung) entstehen (ONLINE_STELLUNG_FALSCH). Ob der Zug nach den Regeln erlaubt ist, prueft
--     das nicht. Es faengt aber "die gegnerische Dame ist einfach weg".
--   * Ausgang 'strittig' (online_strittig): Ein Spieler beendet eine Partie, deren Stellung nicht zu den Zuegen
--     passt, ohne Ergebnis. Das geht auch, wenn seine eigene Uhr laeuft. Danach entscheidet die Uhr nicht mehr.
--     Ehrlich: Auch ein Verlierer kann so einer Niederlage entgehen. Ohne Wertung ist das tragbar.
--   * Zeitende mit zu wenig Mattmaterial des Gegners ist Remis (grund 'zeit-material', FIDE-Regel 6.9, grob).
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
-- wenn er gar nichts mehr tut, und kann kein Remis mehr annehmen. Kann der Gewinner aber gar nicht mehr matt
-- setzen (nur der Koenig, Koenig und eine Leichtfigur gegen den blanken Koenig, nur gleichfarbige Laeufer), endet
-- die Partie remis mit grund 'zeit-material'.
--
-- Haengende Partien (online_haengt): Partien MIT Uhr, in denen noch keine 2 Halbzuege gespielt sind (die Uhr laeuft
-- also noch nicht), enden nach 10 Minuten ohne Zug als 'abgebrochen', ohne Ergebnis. Ab dem 2. Halbzug entscheidet
-- die Uhr. Partien OHNE Uhr enden erst nach 7 Tagen ohne Zug so (langsame Partien unter Freunden bleiben stehen).
-- Geprueft wird bei jedem Zug, bei Remis, Aufgabe und Zeit-Reklamation (online_uhr_pruefen) und fuer alle beim
-- naechsten Anlegen einer Einladung oder Abruf von online_meine (online_aufraeumen), weil sonst niemand die
-- Pruefung aufruft, wenn beide gegangen sind.
--
-- Einladungen gelten 24 Stunden (online_tritt_bei lehnt aeltere ab, online_meine zeigt sie nicht mehr). Der Code
-- kommt aus gen_random_uuid() (kryptografischer Zufall), nicht aus random(). Neue Partien entstehen nur ueber
-- online_erstelle: Ein direktes insert ist fuer authenticated nicht erlaubt.
--
-- Fehler melden die Funktionen als kurze Kennungen (z. B. ONLINE_NICHT_DEIN_ZUG); js/online.js uebersetzt sie
-- in ganze Saetze. Die Kennungen sind ein Vertrag: wer eine aendert, aendert auch js/online.js.
--
-- Alle Funktionen laufen mit leerem search_path und sprechen Tabellen und Funktionen voll qualifiziert an
-- (public., auth., pg_catalog.). So kann kein Objekt in einem anderen Schema eine Security-Definer-Funktion
-- umlenken (der Supabase-Linter beanstandet einen offenen search_path).
--
-- Hinweis fuer spaetere Aenderungen: `create or replace function` kann weder Parameternamen noch Rueckgabetyp
-- einer bestehenden Funktion aendern. Dann vorher `drop function public.<name>(<typen>)` ausfuehren (so geschehen
-- fuer online_tritt_bei, das seit Etappe 0 jsonb liefert).

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
-- fuer das Aufraeumen (alte Einladungen, haengende Partien) und die Einladungs-Bremse
create index if not exists partien_online_status_erstellt on public.partien_online (status, erstellt_am);
create index if not exists partien_online_status_letzter_zug on public.partien_online (status, letzter_zug_am);
create index if not exists partien_online_ersteller_erstellt on public.partien_online (erstellt_von, erstellt_am);

-- Fehlversuche beim Beitreten je Konto und Tag (Europe/Berlin), gegen das Durchprobieren von Codes. Nur intern:
-- kein Recht fuer angemeldete Nutzer (geschrieben wird nur in online_tritt_bei). Tage aelter als 2 Tage raeumt
-- online_tritt_bei selbst weg. Mit dem Konto verschwinden die Zeilen (on delete cascade).
create table if not exists public.online_versuche (
  user_id uuid not null references auth.users (id) on delete cascade,
  tag date not null,
  anzahl integer not null default 0,
  primary key (user_id, tag)
);

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

-- ---------------------------------------------------------------------------
-- Reine Hilfen ohne Tabellenzugriff (nur intern, kein Recht fuer angemeldete Nutzer)
-- ---------------------------------------------------------------------------

-- Brett-Teil einer FEN als 64 Zeichen (Reihe 8 bis 1, Linie a bis h, '.' = leer). Ein Brett, das nicht genau 64
-- Felder ergibt (z. B. "8p/..."), liefert eine andere Laenge; die Aufrufer pruefen das.
create or replace function public.online_brett(fen text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  teil text := split_part(coalesce(fen, ''), ' ', 1);
  brett text := '';
  z text;
  i integer;
begin
  for i in 1..char_length(teil) loop
    z := substr(teil, i, 1);
    if z = '/' then
      continue;
    elsif z ~ '^[1-8]$' then
      brett := brett || repeat('.', z::integer);
    else
      brett := brett || z;
    end if;
  end loop;
  return brett;
end;
$$;

-- Grobe Pruefung der Folgestellung: Entsteht das Brett von fen_danach aus dem Brett von fen_vorher, wenn man den
-- Zug (UCI) ausfuehrt? Beachtet Rochade (der Turm springt mit), en passant (der geschlagene Bauer verschwindet) und
-- Umwandlung. Der Stein auf dem Startfeld muss der Seite am Zug gehoeren, geschlagen wird nie ein eigener Stein und
-- nie ein Koenig. Ob der Zug nach den Schachregeln erlaubt ist (Gangart, Schach, Wege frei), prueft das NICHT.
create or replace function public.online_folge_passt(fen_vorher text, zug text, fen_danach text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  brett text := public.online_brett(fen_vorher);
  ziel text := public.online_brett(fen_danach);
  seite text := split_part(coalesce(fen_vorher, ''), ' ', 2);
  von_linie integer;
  von_reihe integer;
  nach_linie integer;
  nach_reihe integer;
  von integer;
  nach integer;
  stein text;
  geschlagen text;
  umwandlung text;
  weiss_zieht boolean;
  feld integer;
  turm text;
begin
  if char_length(brett) <> 64 or char_length(ziel) <> 64 or seite not in ('w', 'b')
     or zug is null or zug !~ '^[a-h][1-8][a-h][1-8][qrbn]?$' then
    return false;
  end if;
  weiss_zieht := seite = 'w';
  von_linie := ascii(substr(zug, 1, 1)) - 96;
  von_reihe := substr(zug, 2, 1)::integer;
  nach_linie := ascii(substr(zug, 3, 1)) - 96;
  nach_reihe := substr(zug, 4, 1)::integer;
  umwandlung := substr(zug, 5, 1);
  von := (8 - von_reihe) * 8 + von_linie;
  nach := (8 - nach_reihe) * 8 + nach_linie;
  stein := substr(brett, von, 1);
  geschlagen := substr(brett, nach, 1);
  -- eigener Stein auf dem Startfeld (Grossbuchstaben: Weiss)
  if stein = '.' or (stein ~ '^[A-Z]$') <> weiss_zieht then
    return false;
  end if;
  -- auf dem Zielfeld: leer oder ein gegnerischer Stein, nie ein Koenig
  if geschlagen <> '.' and ((geschlagen ~ '^[A-Z]$') = weiss_zieht or lower(geschlagen) = 'k') then
    return false;
  end if;
  brett := overlay(brett placing '.' from von for 1);
  if lower(stein) = 'p' then
    if nach_reihe = (case when weiss_zieht then 8 else 1 end) then
      if umwandlung = '' then
        return false;
      end if;
      stein := case when weiss_zieht then upper(umwandlung) else umwandlung end;
    elsif umwandlung <> '' then
      return false;
    end if;
    if von_linie <> nach_linie and geschlagen = '.' then
      -- en passant: der geschlagene Bauer steht neben dem Startfeld, auf der Linie des Zielfelds
      feld := (8 - von_reihe) * 8 + nach_linie;
      if substr(brett, feld, 1) <> (case when weiss_zieht then 'p' else 'P' end) then
        return false;
      end if;
      brett := overlay(brett placing '.' from feld for 1);
    end if;
  elsif umwandlung <> '' then
    return false;
  elsif lower(stein) = 'k' and von_linie = 5 and von_reihe = nach_reihe
        and von_reihe = (case when weiss_zieht then 1 else 8 end) and nach_linie in (3, 7) then
    -- Rochade: Koenig zwei Felder, der Turm aus der Ecke springt neben ihn
    turm := case when weiss_zieht then 'R' else 'r' end;
    feld := (8 - von_reihe) * 8 + (case when nach_linie = 7 then 8 else 1 end);
    if substr(brett, feld, 1) <> turm then
      return false;
    end if;
    brett := overlay(brett placing '.' from feld for 1);
    brett := overlay(brett placing turm from (8 - von_reihe) * 8 + (case when nach_linie = 7 then 6 else 4 end) for 1);
  end if;
  brett := overlay(brett placing stein from nach for 1);
  return brett = ziel;
end;
$$;

-- Kann `farbe` ('w' | 'b') in dieser Stellung den Gegner gar nicht mehr matt setzen? Bewusst vorsichtig (nur sichere
-- Faelle, im Zweifel false): nur der Koenig; Koenig und genau eine Leichtfigur gegen den blanken Koenig; auf beiden
-- Seiten nur Laeufer, alle auf Feldern derselben Farbe. Grundlage fuer das Zeitende als Remis (FIDE-Regel 6.9).
create or replace function public.online_kann_nicht_matt_setzen(fen text, farbe text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  brett text := public.online_brett(fen);
  eigene text;
  fremde text;
  feldfarbe integer := null;
  i integer;
begin
  if char_length(brett) <> 64 or farbe not in ('w', 'b') then
    return false;
  end if;
  eigene := regexp_replace(brett, case when farbe = 'w' then '[^PNBRQ]' else '[^pnbrq]' end, '', 'g');
  fremde := regexp_replace(brett, case when farbe = 'w' then '[^pnbrq]' else '[^PNBRQ]' end, '', 'g');
  if eigene = '' then
    return true;
  end if;
  if char_length(eigene) = 1 and lower(eigene) in ('n', 'b') and fremde = '' then
    return true;
  end if;
  if lower(eigene) ~ '^b+$' and (fremde = '' or lower(fremde) ~ '^b+$') then
    for i in 1..64 loop
      if lower(substr(brett, i, 1)) = 'b' then
        if feldfarbe is null then
          feldfarbe := ((i - 1) / 8 + (i - 1) % 8) % 2;
        elsif feldfarbe <> ((i - 1) / 8 + (i - 1) % 8) % 2 then
          return false;
        end if;
      end if;
    end loop;
    return true;
  end if;
  return false;
end;
$$;

-- Haengt die Partie? MIT Uhr: noch keine 2 Halbzuege (die Uhr laeuft noch nicht) und seit 10 Minuten kein Zug.
-- OHNE Uhr: seit 7 Tagen kein Zug. (letzter_zug_am setzt auch der Beitritt.)
create or replace function public.online_haengt(p public.partien_online)
returns boolean
language sql
volatile
set search_path = ''
as $$
  select p.status = 'laeuft' and p.letzter_zug_am is not null and (
    (p.bedenkzeit_s is not null and position(' ' in p.zuege) = 0
      and p.letzter_zug_am < pg_catalog.clock_timestamp() - interval '10 minutes')
    or (p.bedenkzeit_s is null and p.letzter_zug_am < pg_catalog.clock_timestamp() - interval '7 days'));
$$;

-- Aufraeumen fuer alle (nur intern): Einladungen, die nie zu einer Partie wurden (offen oder zurueckgezogen) und
-- aelter als 48 Stunden sind, werden geloescht; haengende Partien enden als 'abgebrochen' ohne Ergebnis. Zeilen, die
-- gerade ein anderer Aufruf sperrt, bleiben fuer das naechste Mal (skip locked). Hoechstens 1000 Zeilen je Art und
-- Aufruf, damit kein einzelner Aufruf lange dauert.
create or replace function public.online_aufraeumen()
returns void
language plpgsql
set search_path = ''
as $$
begin
  delete from public.partien_online t
  where t.id in (
    select e.id from public.partien_online e
    where (e.status = 'offen' or (e.status = 'beendet' and e.grund = 'abgebrochen' and (e.weiss is null or e.schwarz is null)))
      and e.erstellt_am < now() - interval '48 hours'
    limit 1000
    for update skip locked);
  update public.partien_online t
  set status = 'beendet', ergebnis = null, grund = 'abgebrochen', remis_angebot = null
  where t.id in (
    select h.id from public.partien_online h
    where h.status = 'laeuft' and public.online_haengt(h)
    limit 1000
    for update skip locked);
end;
$$;

-- Einladung anlegen. farbe 'w' | 'b' | 'zufall' ist die Farbe des Erstellers. Bei einem Code-Zusammenstoss
-- (1 zu einer Milliarde) wird neu gewuerfelt. Bremse: hoechstens 5 offene (noch gueltige) und 50 neue Einladungen
-- je Konto in 24 Stunden; zurueckgezogene zaehlen bei den neuen mit.
create or replace function public.online_erstelle(farbe text, bedenkzeit_s integer default null, inkrement_s integer default null)
returns public.partien_online
language plpgsql
security definer
set search_path = ''
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
  -- Einladungen eines Kontos nacheinander zaehlen (Sperre je Nutzer bis zum Ende der Transaktion): parallele
  -- Aufrufe saehen sonst alle denselben Zaehlerstand
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('online_erstelle:' || uid::text, 0));
  perform public.online_aufraeumen();
  if (select count(*) from public.partien_online t
      where t.erstellt_von = uid and t.status = 'offen' and t.erstellt_am >= now() - interval '24 hours') >= 5
     or (select count(*) from public.partien_online t
         where t.erstellt_von = uid and t.erstellt_am > now() - interval '24 hours') >= 50 then
    raise exception 'ONLINE_ZU_VIELE_EINLADUNGEN';
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
-- Antwort (jsonb): bei Erfolg die Zeile aus partien_online (gleiche Felder wie bisher), bei einem falschen oder
-- abgelaufenen Code { "fehler": "ONLINE_CODE_UNGUELTIG" | "ONLINE_CODE_ABGELAUFEN" }. Dieser Fehlversuch wird
-- gezaehlt; deshalb kein raise (das rollte den Zaehler zurueck). Nach 20 Fehlversuchen am Tag kommt
-- ONLINE_ZU_VIELE_VERSUCHE (raise), auch fuer einen richtigen Code.
-- Bis Etappe 0 lieferte die Funktion die Zeile als partien_online: anderer Rueckgabetyp, also drop function vorweg.
drop function if exists public.online_tritt_bei(text);
create or replace function public.online_tritt_bei(code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_tag date := (now() at time zone 'Europe/Berlin')::date;
  v_fehler text;
  p public.partien_online;
  neu_weiss uuid;
  neu_schwarz uuid;
begin
  if uid is null then
    raise exception 'ONLINE_NICHT_ANGEMELDET';
  end if;
  -- Fehlversuche eines Kontos nacheinander zaehlen (Sperre je Nutzer bis zum Ende der Transaktion): parallele
  -- Anfragen saehen sonst alle einen Zaehler unter 20
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('online_versuche:' || uid::text, 0));
  if coalesce((select v.anzahl from public.online_versuche v where v.user_id = uid and v.tag = v_tag), 0) >= 20 then
    raise exception 'ONLINE_ZU_VIELE_VERSUCHE';
  end if;
  if v_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$' then
    select * into p from public.partien_online t where t.code = v_code for update;
  end if;
  if p.id is null or p.status <> 'offen' then
    v_fehler := 'ONLINE_CODE_UNGUELTIG';
  elsif p.erstellt_am < now() - interval '24 hours' then
    v_fehler := 'ONLINE_CODE_ABGELAUFEN';
  elsif (p.weiss is null) = (p.schwarz is null) then
    v_fehler := 'ONLINE_CODE_UNGUELTIG'; -- der Ersteller muss selbst mitspielen, und ein Platz muss frei sein
  end if;
  if v_fehler is not null then
    -- Fehlversuch zaehlen (kein raise: das rollte den Zaehler zurueck); alte Tage raeumen
    delete from public.online_versuche v where v.tag < v_tag - 2;
    insert into public.online_versuche as v (user_id, tag, anzahl) values (uid, v_tag, 1)
    on conflict (user_id, tag) do update set anzahl = v.anzahl + 1;
    return jsonb_build_object('fehler', v_fehler);
  end if;
  if p.erstellt_von = uid or p.weiss = uid or p.schwarz = uid then
    raise exception 'ONLINE_EIGENE_PARTIE';
  end if;
  if p.weiss is null then
    neu_weiss := uid;
    neu_schwarz := p.schwarz;
  else
    neu_weiss := p.weiss;
    neu_schwarz := uid;
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
  return to_jsonb(p);
end;
$$;

-- Gemeinsame Pruefung fuer Zug, Remis, Aufgabe und "strittig": Partie laden und sperren, Aufrufer muss Spieler
-- sein, Partie muss laufen. Nur intern (kein Recht fuer authenticated).
create or replace function public.online_hole_laufende(partie uuid, uid uuid)
returns public.partien_online
language plpgsql
set search_path = ''
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

-- Zeitende der Seite am Zug verbuchen (die Zeile muss schon gesperrt sein): Ihre Uhr steht auf 0, der Gegner gewinnt
-- ('zeit'). Kann der Gegner aber gar nicht mehr matt setzen, ist es Remis ('zeit-material'). Nur intern.
create or replace function public.online_zeitende(p public.partien_online)
returns public.partien_online
language plpgsql
set search_path = ''
as $$
declare
  remis boolean := public.online_kann_nicht_matt_setzen(p.fen, case when p.am_zug = 'w' then 'b' else 'w' end);
begin
  update public.partien_online t
  set uhr_weiss_ms = case when p.am_zug = 'w' then 0 else t.uhr_weiss_ms end,
      uhr_schwarz_ms = case when p.am_zug = 'b' then 0 else t.uhr_schwarz_ms end,
      status = 'beendet',
      ergebnis = case when remis then '1/2-1/2' when p.am_zug = 'w' then '0-1' else '1-0' end,
      grund = case when remis then 'zeit-material' else 'zeit' end,
      remis_angebot = null
  where t.id = p.id
  returning * into p;
  return p;
end;
$$;

-- Laufende Uhr der Seite am Zug pruefen (die Zeile muss schon gesperrt sein). Ist sie abgelaufen, endet die Partie
-- hier auf Zeit (online_zeitende) und die Funktion gibt die beendete Zeile zurueck; sonst die unveraenderte. Eine
-- haengende Partie (online_haengt) endet hier als 'abgebrochen'. Kein raise: eine Ausnahme wuerde die Beendigung
-- wieder zurueckrollen. Nur intern (kein Recht fuer authenticated).
-- Wie in online_zug kostet der jeweils erste Zug von Weiss und Schwarz keine Zeit (weniger als 2 Halbzuege).
-- Nach einer strittigen Meldung (grund 'strittig') entscheidet die Uhr nicht mehr.
create or replace function public.online_uhr_pruefen(p public.partien_online)
returns public.partien_online
language plpgsql
set search_path = ''
as $$
declare
  halbzuege integer;
  rest_ms bigint;
begin
  if p.status <> 'laeuft' or p.grund is not distinct from 'strittig' then
    return p;
  end if;
  if public.online_haengt(p) then
    update public.partien_online t
    set status = 'beendet', ergebnis = null, grund = 'abgebrochen', remis_angebot = null
    where t.id = p.id
    returning * into p;
    return p;
  end if;
  if p.bedenkzeit_s is null or p.letzter_zug_am is null then
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
  return public.online_zeitende(p);
end;
$$;

-- Zeit reklamieren: Jeder der beiden Spieler darf fragen, ob die Uhr der Seite am Zug abgelaufen ist. Dann ist
-- die Partie beendet (grund 'zeit' oder 'zeit-material'). Haengt die Partie (online_haengt), endet sie als
-- 'abgebrochen'. Antwort ist immer die aktuelle Zeile, auch wenn nichts abgelaufen ist oder die Partie schon vorbei
-- war, damit der Client danach einfach anzeigt, was zurueckkommt.
create or replace function public.online_pruefe_zeit(partie uuid)
returns public.partien_online
language plpgsql
security definer
set search_path = ''
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

-- Einen Zug verbuchen. zug: UCI (e2e4, e7e8q). fen_danach und am_zug_danach kommen vom Client (chess.js). Der
-- Server prueft die Form, dass die Seite am Zug wechselt und grob, ob das neue Brett aus dem alten plus dem Zug
-- entsteht (online_folge_passt). Ein Ergebnis braucht einen passenden Grund: 'matt' nur als Sieg des Ziehenden,
-- 'patt', 'material', 'wiederholung' und '50-zuege' nur als '1/2-1/2'. Andere Gruende setzt nur der Server.
create or replace function public.online_zug(partie uuid, zug text, fen_danach text, am_zug_danach text, ergebnis text default null, grund text default null)
returns public.partien_online
language plpgsql
security definer
set search_path = ''
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
    return p; -- Zeit abgelaufen oder Partie abgebrochen, bevor der Zug kam: Partie beendet, Zug verfaellt
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
  -- Ergebnis-Regeln: ein Grund ohne Ergebnis faellt still weg (wie bisher), ein Ergebnis braucht den passenden Grund
  if v_ergebnis is null then
    v_grund := null;
  elsif v_grund = 'matt' then
    if v_ergebnis <> (case when farbe = 'w' then '1-0' else '0-1' end) then
      raise exception 'ONLINE_ERGEBNIS_FORM';
    end if;
  elsif v_grund in ('patt', 'material', 'wiederholung', '50-zuege') then
    if v_ergebnis <> '1/2-1/2' then
      raise exception 'ONLINE_ERGEBNIS_FORM';
    end if;
  else
    raise exception 'ONLINE_ERGEBNIS_FORM'; -- kein Grund, oder einer, den nur der Server setzt
  end if;
  if not public.online_folge_passt(p.fen, zug, fen_danach) then
    raise exception 'ONLINE_STELLUNG_FALSCH';
  end if;

  halbzuege := case when p.zuege = '' then 0 else array_length(string_to_array(p.zuege, ' '), 1) end;
  uhr_ms := case when farbe = 'w' then p.uhr_weiss_ms else p.uhr_schwarz_ms end;
  if p.bedenkzeit_s is not null and halbzuege >= 2 then
    verbraucht_ms := floor(extract(epoch from (jetzt - coalesce(p.letzter_zug_am, jetzt))) * 1000);
    uhr_ms := uhr_ms - verbraucht_ms;
    if uhr_ms <= 0 then
      -- Zeit abgelaufen, bevor der Zug kam: Partie beendet, Zug verfaellt (die Seite am Zug ist der Ziehende)
      return public.online_zeitende(p);
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

-- Partie als strittig beenden: Ein Spieler meldet, dass die Stellung auf dem Server nicht zu den Zuegen passt. Die
-- Partie endet ohne Ergebnis (grund 'strittig'). Das geht bewusst auch, wenn die eigene Uhr laeuft oder schon
-- abgelaufen ist (keine Uhr-Pruefung vorweg): Sonst wartete ein Schummler mit einer erfundenen Stellung einfach,
-- bis die Uhr des Opfers ablaeuft. Danach entscheidet die Uhr nicht mehr (die Partie ist beendet).
create or replace function public.online_strittig(partie uuid)
returns public.partien_online
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  p public.partien_online;
begin
  p := public.online_hole_laufende(partie, uid);
  update public.partien_online t
  set status = 'beendet', ergebnis = null, grund = 'strittig', remis_angebot = null
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
set search_path = ''
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
    return p; -- schon vorher auf Zeit entschieden oder abgebrochen
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
set search_path = ''
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
set search_path = ''
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

-- Offene und laufende Partien des Aufrufers, zuletzt geaenderte zuerst. Raeumt vorher fuer alle auf
-- (online_aufraeumen) und laeuft deshalb als Besitzer der Tabelle; die Zeilen filtert sie selbst auf den Aufrufer
-- (wie die Lese-Policy: Weiss, Schwarz oder Ersteller).
create or replace function public.online_meine()
returns setof public.partien_online
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;
  perform public.online_aufraeumen();
  return query
    select t.*
    from public.partien_online t
    where uid in (t.weiss, t.schwarz, t.erstellt_von)
      and (t.status = 'laeuft' or (t.status = 'offen' and t.erstellt_am >= now() - interval '24 hours'))
    order by t.aktualisiert_am desc;
end;
$$;

alter table public.partien_online enable row level security;
alter table public.online_versuche enable row level security;

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
-- Fehlversuche: weder lesen noch schreiben (keine Policy, kein Tabellenrecht); nur online_tritt_bei schreibt.
revoke all on table public.online_versuche from anon, authenticated, public;

-- Funktionen: nur fuer angemeldete Nutzer, nie fuer anon oder public. Die Helfer bleiben intern.
revoke all on function public.online_vor_anlegen() from anon, authenticated, public;
revoke all on function public.online_brett(text) from anon, authenticated, public;
revoke all on function public.online_folge_passt(text, text, text) from anon, authenticated, public;
revoke all on function public.online_kann_nicht_matt_setzen(text, text) from anon, authenticated, public;
revoke all on function public.online_haengt(public.partien_online) from anon, authenticated, public;
revoke all on function public.online_aufraeumen() from anon, authenticated, public;
revoke all on function public.online_hole_laufende(uuid, uuid) from anon, authenticated, public;
revoke all on function public.online_zeitende(public.partien_online) from anon, authenticated, public;
revoke all on function public.online_uhr_pruefen(public.partien_online) from anon, authenticated, public;
revoke all on function public.online_pruefe_zeit(uuid) from anon, public;
revoke all on function public.online_erstelle(text, integer, integer) from anon, public;
revoke all on function public.online_tritt_bei(text) from anon, public;
revoke all on function public.online_zug(uuid, text, text, text, text, text) from anon, public;
revoke all on function public.online_strittig(uuid) from anon, public;
revoke all on function public.online_gib_auf(uuid) from anon, public;
revoke all on function public.online_biete_remis(uuid) from anon, public;
revoke all on function public.online_nimm_remis_an(uuid) from anon, public;
revoke all on function public.online_meine() from anon, public;
grant execute on function public.online_erstelle(text, integer, integer) to authenticated;
grant execute on function public.online_tritt_bei(text) to authenticated;
grant execute on function public.online_zug(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.online_strittig(uuid) to authenticated;
grant execute on function public.online_gib_auf(uuid) to authenticated;
grant execute on function public.online_biete_remis(uuid) to authenticated;
grant execute on function public.online_nimm_remis_an(uuid) to authenticated;
grant execute on function public.online_meine() to authenticated;
grant execute on function public.online_pruefe_zeit(uuid) to authenticated;
