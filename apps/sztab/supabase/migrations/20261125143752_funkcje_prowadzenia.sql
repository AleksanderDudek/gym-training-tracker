-- Funkcje prowadzenia (spec: docs/superpowers/specs/2026-11-25-sztab-funkcje-konkurencji-design.md):
-- nowe rodzaje zaleceń (formularz, nawyki, jadłospis), harmonogram („pokaż od”), programy w bibliotece,
-- wiadomości i zdjęcia sylwetki (szyfrogram jak paczka) oraz kalendarz wizyt (jawne godziny).
--
-- Każda nowa tabela ma jawne uprawnienia: projekt w chmurze nie daje domyślnych (migracja
-- 20261125141223_jawne_uprawnienia.sql).

-- ── Rodzaje i zakres ──────────────────────────────────────────────────────────────────

alter table public.assignments drop constraint assignments_kind_check;
alter table public.assignments add constraint assignments_kind_check
  check (kind in ('plan', 'workout', 'targets', 'labs', 'note', 'form', 'habits', 'meals'));

alter table public.library_items drop constraint library_items_kind_check;
alter table public.library_items add constraint library_items_kind_check
  check (kind in ('plan', 'workout', 'targets', 'labs', 'note', 'form', 'habits', 'meals', 'program'));

-- Zdjęcia sylwetki: osobny zakres zgody.
alter table public.invites drop constraint invites_scopes_check;
alter table public.invites add constraint invites_scopes_check
  check (scopes <@ array['training', 'movement', 'food', 'body', 'labs', 'photos']);
alter table public.connections drop constraint connections_scopes_check;
alter table public.connections add constraint connections_scopes_check
  check (scopes <@ array['training', 'movement', 'food', 'body', 'labs', 'photos']);

-- ── Harmonogram ───────────────────────────────────────────────────────────────────────

-- Zalecenie z datą: telefon nie dostaje go wcześniej (client_pull niżej). Bez daty — od razu.
alter table public.assignments add column visible_from timestamptz;

create or replace function public.client_pull(p_connection uuid, p_token text) returns json
language plpgsql security definer set search_path = '' as $$
declare
  c public.connections;
begin
  -- Zakończona współpraca nie ma już tokenu: telefon dostaje `bad_token` i pyta niżej o stan.
  c := private.connection_for(p_connection, p_token);
  update public.connections set last_pull_at = now() where id = c.id;
  return json_build_object(
    'status', c.status,
    'areas', c.areas,
    'scopes', c.scopes,
    'assignments', coalesce((
      select json_agg(json_build_object(
        'id', a.id, 'kind', a.kind, 'area', a.area, 'ciphertext', a.ciphertext,
        'createdAt', coalesce(a.visible_from, a.created_at), 'withdrawnAt', a.withdrawn_at
      ) order by coalesce(a.visible_from, a.created_at) desc)
      from (
        select * from public.assignments
        where connection_id = c.id and (visible_from is null or visible_from <= now())
        order by coalesce(visible_from, created_at) desc
        limit 200
      ) a
    ), '[]'::json)
  );
end $$;

-- ── Wiadomości ────────────────────────────────────────────────────────────────────────

create table public.messages (
  -- Numer nadaje nadawca: wchodzi do danych dodatkowych szyfru (AAD).
  id uuid primary key,
  connection_id uuid not null references public.connections (id) on delete cascade,
  author text not null check (author in ('coach', 'client')),
  ciphertext text not null check (ciphertext like 'v1.%' and char_length(ciphertext) <= 20000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index messages_connection on public.messages (connection_id, created_at);

alter table public.messages enable row level security;
create policy messages_select_own on public.messages for select to authenticated using (
  exists (select 1 from public.connections c where c.id = connection_id and c.coach_id = (select auth.uid()))
);
-- Prowadzący pisze tylko jako prowadzący i tylko w trwającej współpracy.
create policy messages_insert_own on public.messages for insert to authenticated with check (
  author = 'coach' and read_at is null and exists (
    select 1 from public.connections c where c.id = connection_id and c.coach_id = (select auth.uid()) and c.status = 'active'
  )
);
-- …i oznacza jako przeczytane tylko wiadomości od podopiecznego.
create policy messages_update_own on public.messages for update to authenticated
  using (author = 'client' and exists (select 1 from public.connections c where c.id = connection_id and c.coach_id = (select auth.uid())))
  with check (author = 'client' and exists (select 1 from public.connections c where c.id = connection_id and c.coach_id = (select auth.uid())));

-- Najpierw odebrać wszystko (lokalny Supabase daje domyślnie pełne prawa), potem kolumnami: prowadzący
-- nie ustawi `created_at` (przesunąłby telefonowi kursor „od kiedy” i kolejne wiadomości by nie doszły)
-- ani nie przepisze cudzego szyfrogramu.
revoke all on table public.messages from authenticated;
grant select on table public.messages to authenticated;
grant insert (id, connection_id, author, ciphertext) on table public.messages to authenticated;
grant update (read_at) on table public.messages to authenticated;

-- Nowe wiadomości dla telefonu (po chwili `p_since`, najwyżej 200) i do kiedy prowadzący przeczytał.
create function public.client_messages(p_connection uuid, p_token text, p_since timestamptz) returns json
language plpgsql security definer set search_path = '' as $$
declare
  c public.connections;
begin
  c := private.connection_for(p_connection, p_token);
  return json_build_object(
    'messages', coalesce((
      select json_agg(json_build_object(
        'id', m.id, 'author', m.author, 'ciphertext', m.ciphertext, 'createdAt', m.created_at, 'readAt', m.read_at
      ) order by m.created_at)
      from (
        select * from public.messages
        where connection_id = c.id and (p_since is null or created_at > p_since)
        order by created_at
        limit 200
      ) m
    ), '[]'::json),
    'readUpTo', (
      select max(created_at) from public.messages
      where connection_id = c.id and author = 'client' and read_at is not null
    )
  );
end $$;

-- Wiadomość od telefonu. Najwyżej 30 na 10 minut — rozmowa, nie zalew.
create function public.client_message(p_connection uuid, p_token text, p_id uuid, p_ciphertext text) returns json
language plpgsql security definer set search_path = '' as $$
declare
  c public.connections;
  v_at timestamptz;
begin
  c := private.connection_for(p_connection, p_token);
  if c.status <> 'active' then raise exception 'ended' using errcode = 'P0001'; end if;
  if (
    select count(*) from public.messages
    where connection_id = c.id and author = 'client' and created_at > now() - interval '10 minutes'
  ) >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.messages (id, connection_id, author, ciphertext)
    values (p_id, c.id, 'client', p_ciphertext)
    on conflict (id) do nothing
    returning created_at into v_at;
  if v_at is null then
    -- Ta sama wiadomość drugi raz (ponowienie po zerwanym połączeniu) — tylko gdy jest jego.
    select created_at into v_at from public.messages where id = p_id and connection_id = c.id and author = 'client';
    if v_at is null then raise exception 'bad_id' using errcode = 'P0001'; end if;
  end if;
  return json_build_object('createdAt', v_at);
end $$;

-- Telefon przeczytał wiadomości prowadzącego do chwili `p_upto`.
create function public.client_read(p_connection uuid, p_token text, p_upto timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.connections;
begin
  c := private.connection_for(p_connection, p_token);
  update public.messages set read_at = now()
    where connection_id = c.id and author = 'coach' and read_at is null and created_at <= p_upto;
end $$;

-- ── Zdjęcia sylwetki ──────────────────────────────────────────────────────────────────

create table public.photos (
  -- Numer nadaje telefon: wchodzi do AAD.
  id uuid primary key,
  connection_id uuid not null references public.connections (id) on delete cascade,
  ciphertext text not null check (ciphertext like 'v1.%' and char_length(ciphertext) <= 600000),
  created_at timestamptz not null default now()
);

create index photos_connection on public.photos (connection_id, created_at desc);

alter table public.photos enable row level security;
create policy photos_select_own on public.photos for select to authenticated using (
  exists (select 1 from public.connections c where c.id = connection_id and c.coach_id = (select auth.uid()))
);
revoke all on table public.photos from authenticated;
grant select on table public.photos to authenticated;

create function public.client_photo_ids(p_connection uuid, p_token text) returns json
language plpgsql security definer set search_path = '' as $$
declare
  c public.connections;
begin
  c := private.connection_for(p_connection, p_token);
  return coalesce((select json_agg(id order by created_at) from public.photos where connection_id = c.id), '[]'::json);
end $$;

-- Najwyżej 60 zdjęć na współpracę i tylko przy zgodzie `photos`.
create function public.client_photo_put(p_connection uuid, p_token text, p_id uuid, p_ciphertext text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.connections;
begin
  c := private.connection_for(p_connection, p_token);
  if c.status <> 'active' then raise exception 'ended' using errcode = 'P0001'; end if;
  if not ('photos' = any (c.scopes)) then raise exception 'no_scope' using errcode = 'P0001'; end if;
  if exists (select 1 from public.photos where id = p_id and connection_id <> c.id) then
    raise exception 'bad_id' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.photos where id = p_id)
     and (select count(*) from public.photos where connection_id = c.id) >= 60 then
    raise exception 'photo_limit' using errcode = 'P0001';
  end if;
  insert into public.photos (id, connection_id, ciphertext) values (p_id, c.id, p_ciphertext)
    on conflict (id) do update set ciphertext = excluded.ciphertext
    where public.photos.connection_id = excluded.connection_id;
end $$;

create function public.client_photo_delete(p_connection uuid, p_token text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.connections;
begin
  c := private.connection_for(p_connection, p_token);
  delete from public.photos where id = p_id and connection_id = c.id;
end $$;

-- Zmiana zgody: jak dotąd, a do tego zabrana zgoda na zdjęcia kasuje je od razu.
create or replace function public.client_update(p_connection uuid, p_token text, p_areas text[], p_scopes text[])
returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.connections;
begin
  c := private.connection_for(p_connection, p_token);
  if c.status <> 'active' then raise exception 'ended' using errcode = 'P0001'; end if;
  if p_areas is null or cardinality(p_areas) = 0 or not (p_areas <@ c.areas) then
    raise exception 'bad_areas' using errcode = 'P0001';
  end if;
  if not (c.scopes <@ coalesce(p_scopes, '{}')) then
    delete from public.snapshots where connection_id = c.id;
  end if;
  if not ('photos' = any (coalesce(p_scopes, '{}'))) then
    delete from public.photos where connection_id = c.id;
  end if;
  update public.connections set areas = p_areas, scopes = coalesce(p_scopes, '{}') where id = c.id;
end $$;

-- ── Kalendarz wizyt (jawne: godziny i tytuły prowadzącego, bez danych o zdrowiu) ──────

create table public.slots (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null default 1 check (capacity between 1 and 50),
  title text not null check (char_length(title) between 1 and 80),
  -- Adres sali albo link do rozmowy wideo.
  place text check (char_length(place) <= 300),
  note text check (char_length(note) <= 500),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at - starts_at <= interval '12 hours')
);

create index slots_coach on public.slots (coach_id, starts_at);

alter table public.slots enable row level security;
create policy slots_all_own on public.slots for all to authenticated
  using (coach_id = (select auth.uid())) with check (coach_id = (select auth.uid()));
revoke all on table public.slots from authenticated;
grant select, insert, update, delete on table public.slots to authenticated;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.slots (id) on delete cascade,
  connection_id uuid not null references public.connections (id) on delete cascade,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by text check (cancelled_by in ('client', 'coach')),
  check ((cancelled_at is null) = (cancelled_by is null))
);

create unique index bookings_one_active on public.bookings (slot_id, connection_id) where cancelled_at is null;
create index bookings_connection on public.bookings (connection_id);

alter table public.bookings enable row level security;
create policy bookings_select_own on public.bookings for select to authenticated using (
  exists (select 1 from public.slots s where s.id = slot_id and s.coach_id = (select auth.uid()))
);
-- Prowadzący zapisuje swojego podopiecznego na swój termin (także ponad limit — to jego decyzja).
create policy bookings_insert_own on public.bookings for insert to authenticated with check (
  cancelled_at is null
  and exists (select 1 from public.slots s where s.id = slot_id and s.coach_id = (select auth.uid()))
  and exists (select 1 from public.connections c where c.id = connection_id and c.coach_id = (select auth.uid()) and c.status = 'active')
);
create policy bookings_update_own on public.bookings for update to authenticated
  using (exists (select 1 from public.slots s where s.id = slot_id and s.coach_id = (select auth.uid())))
  with check (
    exists (select 1 from public.slots s where s.id = slot_id and s.coach_id = (select auth.uid()))
    and exists (select 1 from public.connections c where c.id = connection_id and c.coach_id = (select auth.uid()))
  );
revoke all on table public.bookings from authenticated;
grant select on table public.bookings to authenticated;
grant insert (slot_id, connection_id) on table public.bookings to authenticated;
grant update (cancelled_at, cancelled_by) on table public.bookings to authenticated;

-- Terminy prowadzącego na 60 dni naprzód — tylko z wolnym miejscem albo zarezerwowane przez ten telefon
-- (pełny termin innego podopiecznego nie zdradza jego linku do rozmowy, notatki ani tego, że ma wizytę)
-- — i rezerwacje tego telefonu (od 14 dni wstecz).
create function public.client_slots(p_connection uuid, p_token text) returns json
language plpgsql security definer set search_path = '' as $$
declare
  c public.connections;
begin
  c := private.connection_for(p_connection, p_token);
  if c.status <> 'active' then raise exception 'ended' using errcode = 'P0001'; end if;
  return json_build_object(
    'slots', coalesce((
      select json_agg(json_build_object(
        'id', s.id, 'startsAt', s.starts_at, 'endsAt', s.ends_at, 'title', s.title, 'place', s.place,
        'note', s.note, 'capacity', s.capacity,
        'taken', (select count(*) from public.bookings b where b.slot_id = s.id and b.cancelled_at is null)
      ) order by s.starts_at)
      from public.slots s
      where s.coach_id = c.coach_id and s.cancelled_at is null
        and s.starts_at > now() and s.starts_at < now() + interval '60 days'
        and (
          (select count(*) from public.bookings b where b.slot_id = s.id and b.cancelled_at is null) < s.capacity
          or exists (select 1 from public.bookings b where b.slot_id = s.id and b.connection_id = c.id and b.cancelled_at is null)
        )
    ), '[]'::json),
    'bookings', coalesce((
      select json_agg(json_build_object(
        'id', b.id, 'slotId', s.id, 'startsAt', s.starts_at, 'endsAt', s.ends_at, 'title', s.title,
        'place', s.place, 'note', s.note, 'cancelledAt', coalesce(b.cancelled_at, s.cancelled_at),
        'cancelledBy', case when b.cancelled_at is not null then b.cancelled_by when s.cancelled_at is not null then 'coach' end
      ) order by s.starts_at)
      from public.bookings b join public.slots s on s.id = b.slot_id
      where b.connection_id = c.id and s.starts_at > now() - interval '14 days'
    ), '[]'::json)
  );
end $$;

-- Rezerwacja z telefonu: termin tego prowadzącego, w przyszłości, z wolnym miejscem, raz.
create function public.client_book(p_connection uuid, p_token text, p_slot uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c public.connections;
  s public.slots;
  new_id uuid;
begin
  c := private.connection_for(p_connection, p_token);
  if c.status <> 'active' then raise exception 'ended' using errcode = 'P0001'; end if;
  select * into s from public.slots where id = p_slot and coach_id = c.coach_id and cancelled_at is null for update;
  if not found then raise exception 'slot_missing' using errcode = 'P0001'; end if;
  if s.starts_at <= now() then raise exception 'slot_past' using errcode = 'P0001'; end if;
  if exists (select 1 from public.bookings where slot_id = s.id and connection_id = c.id and cancelled_at is null) then
    raise exception 'already_booked' using errcode = 'P0001';
  end if;
  if (select count(*) from public.bookings where slot_id = s.id and cancelled_at is null) >= s.capacity then
    raise exception 'slot_full' using errcode = 'P0001';
  end if;
  if (
    select count(*) from public.bookings b join public.slots x on x.id = b.slot_id
    where b.connection_id = c.id and b.cancelled_at is null and x.starts_at > now()
  ) >= 10 then
    raise exception 'too_many' using errcode = 'P0001';
  end if;
  -- Rezerwuj/odwołaj w pętli zostawiałoby bez końca wierszy — 30 nowych rezerwacji na dobę wystarczy każdemu.
  if (select count(*) from public.bookings where connection_id = c.id and created_at > now() - interval '1 day') >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.bookings (slot_id, connection_id) values (s.id, c.id) returning id into new_id;
  return new_id;
end $$;

create function public.client_cancel_booking(p_connection uuid, p_token text, p_booking uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.connections;
begin
  c := private.connection_for(p_connection, p_token);
  update public.bookings b set cancelled_at = now(), cancelled_by = 'client'
    from public.slots s
    where b.id = p_booking and b.connection_id = c.id and b.cancelled_at is null
      and s.id = b.slot_id and s.starts_at > now();
  if not found then raise exception 'booking_missing' using errcode = 'P0001'; end if;
end $$;

-- ── Koniec współpracy kasuje też wiadomości, zdjęcia i przyszłe wizyty ────────────────

create or replace function private.end_connection(p_connection uuid, p_by text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Blokada wiersza współpracy, tak jak w funkcjach telefonu (`connection_for … for update`): wysyłka
  -- zdjęcia czy wiadomości w toku kończy się przed kasowaniem, a nie przeżywa końca współpracy.
  perform 1 from public.connections where id = p_connection for update;
  delete from public.snapshots where connection_id = p_connection;
  delete from public.assignments where connection_id = p_connection;
  delete from public.messages where connection_id = p_connection;
  delete from public.photos where connection_id = p_connection;
  -- Przyszłe wizyty znikają; minione zostają prowadzącemu jako ślad rozliczeń (godziny, bez danych o zdrowiu).
  delete from public.bookings b using public.slots s
    where b.slot_id = s.id and b.connection_id = p_connection and s.starts_at > now();
  delete from private.connection_tokens where connection_id = p_connection;
  update public.connections
    set status = 'ended', ended_by = p_by, ended_at = now(), scopes = '{}'
    where id = p_connection and status = 'active';
end $$;

-- ── Logowanie dwuetapowe egzekwowane w bazie ──────────────────────────────────────────

-- Ekran kodu TOTP w Sztabie to za mało: samo hasło (sesja aal1) dawałoby przez PostgREST te same prawa.
-- Prowadzący z włączonym MFA widzi i zmienia cokolwiek dopiero z sesją aal2; bez MFA — jak dotąd.
-- Schemat `authz` nie jest wystawiony przez API (tylko `public`), a funkcja czyta `auth.mfa_factors`
-- z prawami właściciela.
create schema if not exists authz;
revoke all on schema authz from public;
grant usage on schema authz to authenticated;

create function authz.mfa_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    or not exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified')
$$;
revoke all on function authz.mfa_ok() from public, anon;
grant execute on function authz.mfa_ok() to authenticated;

create policy coaches_mfa on public.coaches as restrictive for all to authenticated using ((select authz.mfa_ok())) with check ((select authz.mfa_ok()));
create policy invites_mfa on public.invites as restrictive for all to authenticated using ((select authz.mfa_ok())) with check ((select authz.mfa_ok()));
create policy connections_mfa on public.connections as restrictive for all to authenticated using ((select authz.mfa_ok())) with check ((select authz.mfa_ok()));
create policy snapshots_mfa on public.snapshots as restrictive for all to authenticated using ((select authz.mfa_ok())) with check ((select authz.mfa_ok()));
create policy assignments_mfa on public.assignments as restrictive for all to authenticated using ((select authz.mfa_ok())) with check ((select authz.mfa_ok()));
create policy receipts_mfa on public.receipts as restrictive for all to authenticated using ((select authz.mfa_ok())) with check ((select authz.mfa_ok()));
create policy library_mfa on public.library_items as restrictive for all to authenticated using ((select authz.mfa_ok())) with check ((select authz.mfa_ok()));
create policy messages_mfa on public.messages as restrictive for all to authenticated using ((select authz.mfa_ok())) with check ((select authz.mfa_ok()));
create policy photos_mfa on public.photos as restrictive for all to authenticated using ((select authz.mfa_ok())) with check ((select authz.mfa_ok()));
create policy slots_mfa on public.slots as restrictive for all to authenticated using ((select authz.mfa_ok())) with check ((select authz.mfa_ok()));
create policy bookings_mfa on public.bookings as restrictive for all to authenticated using ((select authz.mfa_ok())) with check ((select authz.mfa_ok()));

-- Funkcje prowadzącego omijają RLS (SECURITY DEFINER) — ten sam warunek wprost.
create or replace function public.coach_end_connection(p_connection uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not authz.mfa_ok() then raise exception 'mfa_required' using errcode = 'P0001'; end if;
  if not exists (
    select 1 from public.connections where id = p_connection and coach_id = (select auth.uid()) and status = 'active'
  ) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  perform private.end_connection(p_connection, 'coach');
end $$;

create or replace function public.coach_delete_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not_signed_in' using errcode = 'P0001'; end if;
  if not authz.mfa_ok() then raise exception 'mfa_required' using errcode = 'P0001'; end if;
  delete from public.connections where coach_id = me;
  delete from auth.users where id = me;
end $$;

-- ── Uprawnienia funkcji ───────────────────────────────────────────────────────────────

revoke all on function private.end_connection(uuid, text) from public, anon, authenticated;

revoke all on function public.client_messages(uuid, text, timestamptz) from public;
revoke all on function public.client_message(uuid, text, uuid, text) from public;
revoke all on function public.client_read(uuid, text, timestamptz) from public;
revoke all on function public.client_photo_ids(uuid, text) from public;
revoke all on function public.client_photo_put(uuid, text, uuid, text) from public;
revoke all on function public.client_photo_delete(uuid, text, uuid) from public;
revoke all on function public.client_slots(uuid, text) from public;
revoke all on function public.client_book(uuid, text, uuid) from public;
revoke all on function public.client_cancel_booking(uuid, text, uuid) from public;

grant execute on function public.client_messages(uuid, text, timestamptz) to anon, authenticated;
grant execute on function public.client_message(uuid, text, uuid, text) to anon, authenticated;
grant execute on function public.client_read(uuid, text, timestamptz) to anon, authenticated;
grant execute on function public.client_photo_ids(uuid, text) to anon, authenticated;
grant execute on function public.client_photo_put(uuid, text, uuid, text) to anon, authenticated;
grant execute on function public.client_photo_delete(uuid, text, uuid) to anon, authenticated;
grant execute on function public.client_slots(uuid, text) to anon, authenticated;
grant execute on function public.client_book(uuid, text, uuid) to anon, authenticated;
grant execute on function public.client_cancel_booking(uuid, text, uuid) to anon, authenticated;

-- Nowe tabele: anonimowy klient nie widzi żadnej (jak w pierwszej migracji).
revoke all on table public.messages, public.photos, public.slots, public.bookings from anon;
