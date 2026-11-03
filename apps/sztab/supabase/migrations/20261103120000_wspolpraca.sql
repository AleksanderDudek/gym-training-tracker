-- GYM TRACKER Sztab: konta prowadzących, zaproszenia, współprace i zaszyfrowane paczki.
--
-- Zasady, których ten schemat pilnuje:
--   * Konto ma tylko prowadzący (auth.users). Podopieczny nie ma konta: telefon rozmawia przez
--     funkcje RPC niżej, a uprawnia go token współpracy (w bazie tylko jego SHA-256).
--   * Dane podopiecznego (paczki) i zalecenia leżą wyłącznie jako szyfrogram AES-256-GCM.
--     Klucza baza nie zna — liczą go telefon i przeglądarka prowadzącego (ECDH).
--   * Żadnych danych kontaktowych podopiecznego: tylko ID (pseudonim) liczony na telefonie.
--   * Zakończenie współpracy (przez którąkolwiek stronę) usuwa od razu paczkę, zalecenia
--     i potwierdzenia — zostaje tylko pusty wiersz z datą i tym, kto zakończył.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ── Prowadzący ────────────────────────────────────────────────────────────────────────

create table public.coaches (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  profession text not null check (profession in ('trainer', 'dietitian', 'physio', 'doctor', 'other')),
  bio text check (char_length(bio) <= 500),
  -- Klucz publiczny ECDH P-256 (JWK: kty, crv, x, y) i jego odcisk z linku zaproszenia.
  public_key jsonb not null check (public_key ->> 'kty' = 'EC' and public_key ->> 'crv' = 'P-256'),
  key_fingerprint text not null check (key_fingerprint ~ '^[A-Za-z0-9_-]{22}$'),
  -- Klucz prywatny zapieczętowany kodem odzyskiwania (PBKDF2 → AES-GCM). Bez kodu bezużyteczny.
  sealed_key text not null check (sealed_key like 'p1.%' and char_length(sealed_key) < 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.coaches enable row level security;
create policy coaches_select_own on public.coaches for select to authenticated using (id = (select auth.uid()));
create policy coaches_insert_own on public.coaches for insert to authenticated with check (id = (select auth.uid()));
create policy coaches_update_own on public.coaches for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ── Zaproszenia ───────────────────────────────────────────────────────────────────────

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  areas text[] not null check (
    cardinality(areas) between 1 and 4 and areas <@ array['training', 'nutrition', 'rehab', 'insight']
  ),
  scopes text[] not null check (scopes <@ array['training', 'movement', 'food', 'body', 'labs']),
  message text check (char_length(message) <= 500),
  -- Prywatna notatka prowadzącego do zaproszenia — NIE dane osobowe; aplikacja to mówi przy polu.
  label text check (char_length(label) <= 40),
  expires_at timestamptz not null default now() + interval '14 days'
    check (expires_at <= created_at + interval '60 days'),
  revoked_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index invites_coach on public.invites (coach_id, created_at desc);

alter table public.invites enable row level security;
create policy invites_select_own on public.invites for select to authenticated using (coach_id = (select auth.uid()));
create policy invites_insert_own on public.invites for insert to authenticated
  with check (coach_id = (select auth.uid()) and accepted_at is null and revoked_at is null);
-- Prowadzący może tylko wycofać zaproszenie (kolumna revoked_at) — reszta jest stała.
create policy invites_update_own on public.invites for update to authenticated
  using (coach_id = (select auth.uid())) with check (coach_id = (select auth.uid()));
revoke update on public.invites from authenticated;
grant update (revoked_at) on public.invites to authenticated;
create policy invites_delete_own on public.invites for delete to authenticated
  using (coach_id = (select auth.uid()) and accepted_at is null);

-- ── Współprace ────────────────────────────────────────────────────────────────────────

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  invite_id uuid not null references public.invites (id) on delete cascade,
  pseudonym text not null check (pseudonym ~ '^[0-9A-HJKMNP-TV-Z]{20}$'),
  areas text[] not null check (
    cardinality(areas) between 1 and 4 and areas <@ array['training', 'nutrition', 'rehab', 'insight']
  ),
  scopes text[] not null check (scopes <@ array['training', 'movement', 'food', 'body', 'labs']),
  client_public_key jsonb not null check (client_public_key ->> 'kty' = 'EC' and client_public_key ->> 'crv' = 'P-256'),
  status text not null default 'active' check (status in ('active', 'ended')),
  ended_by text check (ended_by in ('client', 'coach')),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  last_push_at timestamptz,
  last_pull_at timestamptz,
  check ((status = 'ended') = (ended_at is not null))
);

-- Jedno ID ma u jednego prowadzącego najwyżej jedną trwającą współpracę. Kolizja ID (≈ 4·10⁻¹⁹
-- przy milionie podopiecznych) kończy się odmową `pseudonym_taken`, a telefon liczy ID z licznikiem.
create unique index connections_one_active_pseudonym on public.connections (coach_id, pseudonym) where status = 'active';
create index connections_coach on public.connections (coach_id, status, created_at desc);
create unique index connections_invite on public.connections (invite_id);

alter table public.connections enable row level security;
create policy connections_select_own on public.connections for select to authenticated using (coach_id = (select auth.uid()));

-- Token telefonu osobno: żadna polityka, więc przez API nie widzi go nikt. Czytają go tylko funkcje niżej.
create table private.connection_tokens (
  connection_id uuid primary key references public.connections (id) on delete cascade,
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$')
);

-- ── Paczki, zalecenia, potwierdzenia (szyfrogram) ─────────────────────────────────────

create table public.snapshots (
  connection_id uuid primary key references public.connections (id) on delete cascade,
  ciphertext text not null check (ciphertext like 'v1.%' and char_length(ciphertext) <= 2000000),
  bytes integer not null check (bytes > 0),
  created_at timestamptz not null default now()
);

alter table public.snapshots enable row level security;
create policy snapshots_select_own on public.snapshots for select to authenticated using (
  exists (select 1 from public.connections c where c.id = connection_id and c.coach_id = (select auth.uid()))
);

create table public.assignments (
  -- Numer nadaje przeglądarka prowadzącego: wchodzi do danych dodatkowych szyfru (AAD).
  id uuid primary key,
  connection_id uuid not null references public.connections (id) on delete cascade,
  kind text not null check (kind in ('plan', 'workout', 'targets', 'labs', 'note')),
  area text not null check (area in ('training', 'nutrition', 'rehab', 'insight')),
  ciphertext text not null check (ciphertext like 'v1.%' and char_length(ciphertext) <= 500000),
  created_at timestamptz not null default now(),
  withdrawn_at timestamptz
);

create index assignments_connection on public.assignments (connection_id, created_at desc);

alter table public.assignments enable row level security;
create policy assignments_select_own on public.assignments for select to authenticated using (
  exists (select 1 from public.connections c where c.id = connection_id and c.coach_id = (select auth.uid()))
);
-- Wysłać można tylko do trwającej współpracy i tylko w jej obszarze.
create policy assignments_insert_own on public.assignments for insert to authenticated with check (
  withdrawn_at is null and exists (
    select 1 from public.connections c
    where c.id = connection_id and c.coach_id = (select auth.uid()) and c.status = 'active' and area = any (c.areas)
  )
);
create policy assignments_update_own on public.assignments for update to authenticated using (
  exists (select 1 from public.connections c where c.id = connection_id and c.coach_id = (select auth.uid()))
);
revoke update on public.assignments from authenticated;
grant update (withdrawn_at) on public.assignments to authenticated;

create table public.receipts (
  assignment_id uuid primary key references public.assignments (id) on delete cascade,
  connection_id uuid not null references public.connections (id) on delete cascade,
  ciphertext text not null check (ciphertext like 'v1.%' and char_length(ciphertext) <= 20000),
  updated_at timestamptz not null default now()
);

alter table public.receipts enable row level security;
create policy receipts_select_own on public.receipts for select to authenticated using (
  exists (select 1 from public.connections c where c.id = connection_id and c.coach_id = (select auth.uid()))
);

-- ── Biblioteka prowadzącego (jawna: to jego treści, nie dane podopiecznych) ──────────

create table public.library_items (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  kind text not null check (kind in ('plan', 'workout', 'targets', 'labs', 'note')),
  title text not null check (char_length(title) between 1 and 120),
  body jsonb not null check (pg_column_size(body) <= 200000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index library_items_coach on public.library_items (coach_id, kind, updated_at desc);

alter table public.library_items enable row level security;
create policy library_all_own on public.library_items for all to authenticated
  using (coach_id = (select auth.uid())) with check (coach_id = (select auth.uid()));

create function private.touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger coaches_touch before update on public.coaches for each row execute function private.touch();
create trigger library_touch before update on public.library_items for each row execute function private.touch();

-- ── Funkcje dla telefonu (bez konta, token zamiast logowania) ─────────────────────────

-- Współpraca, do której pasuje token — albo błąd `bad_token`. Wiersz zablokowany do końca transakcji.
create function private.connection_for(p_connection uuid, p_token text) returns public.connections
language plpgsql security definer set search_path = '' as $$
declare
  c public.connections;
begin
  select co.* into c from public.connections co
    join private.connection_tokens t on t.connection_id = co.id
    where co.id = p_connection
      and t.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
    for update of co;
  if not found then
    raise exception 'bad_token' using errcode = 'P0001';
  end if;
  return c;
end $$;

-- Usuwa wszystko, co współpraca niosła. Wiersz zostaje jako ślad: kiedy i kto zakończył.
create function private.end_connection(p_connection uuid, p_by text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.snapshots where connection_id = p_connection;
  delete from public.assignments where connection_id = p_connection;
  delete from private.connection_tokens where connection_id = p_connection;
  update public.connections
    set status = 'ended', ended_by = p_by, ended_at = now(), scopes = '{}'
    where id = p_connection and status = 'active';
end $$;

create function public.invite_preview(p_invite uuid) returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'id', i.id,
    'status', case
      when i.accepted_at is not null then 'accepted'
      when i.revoked_at is not null then 'revoked'
      when i.expires_at < now() then 'expired'
      else 'open' end,
    'coachId', c.id,
    'coachName', c.display_name,
    'profession', c.profession,
    'bio', c.bio,
    'publicKey', c.public_key,
    'areas', i.areas,
    'scopes', i.scopes,
    'message', i.message,
    'expiresAt', i.expires_at
  )
  from public.invites i join public.coaches c on c.id = i.coach_id
  where i.id = p_invite
$$;

create function public.invite_accept(
  p_invite uuid,
  p_pseudonym text,
  p_public_key jsonb,
  p_token text,
  p_areas text[],
  p_scopes text[]
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invites;
  new_id uuid;
begin
  select * into inv from public.invites where id = p_invite for update;
  if not found then raise exception 'invite_missing' using errcode = 'P0001'; end if;
  if inv.accepted_at is not null then raise exception 'invite_used' using errcode = 'P0001'; end if;
  if inv.revoked_at is not null then raise exception 'invite_revoked' using errcode = 'P0001'; end if;
  if inv.expires_at < now() then raise exception 'invite_expired' using errcode = 'P0001'; end if;
  if p_areas is null or cardinality(p_areas) = 0 or not (p_areas <@ inv.areas) then
    raise exception 'bad_areas' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_token, '')) < 40 then raise exception 'bad_token' using errcode = 'P0001'; end if;
  if exists (
    select 1 from public.connections
    where coach_id = inv.coach_id and pseudonym = p_pseudonym and status = 'active'
  ) then
    raise exception 'pseudonym_taken' using errcode = 'P0001';
  end if;

  insert into public.connections (coach_id, invite_id, pseudonym, areas, scopes, client_public_key)
    values (inv.coach_id, inv.id, p_pseudonym, p_areas, coalesce(p_scopes, '{}'), p_public_key)
    returning id into new_id;
  insert into private.connection_tokens (connection_id, token_hash)
    values (new_id, encode(extensions.digest(p_token, 'sha256'), 'hex'));
  update public.invites set accepted_at = now() where id = inv.id;
  return new_id;
end $$;

-- Paczka danych od telefonu. Najwyżej jedna na 30 s — telefon i tak wysyła rzadziej.
create function public.client_push(p_connection uuid, p_token text, p_ciphertext text, p_bytes integer)
returns json
language plpgsql security definer set search_path = '' as $$
declare
  c public.connections;
begin
  c := private.connection_for(p_connection, p_token);
  if c.status <> 'active' then return json_build_object('ok', false, 'ended', true); end if;
  if c.last_push_at > now() - interval '30 seconds' then
    return json_build_object('ok', false, 'retryAfter', 30);
  end if;
  insert into public.snapshots (connection_id, ciphertext, bytes, created_at)
    values (c.id, p_ciphertext, p_bytes, now())
    on conflict (connection_id) do update set ciphertext = excluded.ciphertext, bytes = excluded.bytes, created_at = now();
  update public.connections set last_push_at = now() where id = c.id;
  return json_build_object('ok', true);
end $$;

-- Stan współpracy i zalecenia dla telefonu.
create function public.client_pull(p_connection uuid, p_token text) returns json
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
        'createdAt', a.created_at, 'withdrawnAt', a.withdrawn_at
      ) order by a.created_at desc)
      from (select * from public.assignments where connection_id = c.id order by created_at desc limit 200) a
    ), '[]'::json)
  );
end $$;

-- Czy współpraca trwa — bez tokenu, bo po zakończeniu przez prowadzącego tokenu już nie ma.
-- Zdradza tylko stan i to, kto zakończył; numer współpracy zna wyłącznie telefon i prowadzący.
create function public.client_status(p_connection uuid) returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object('status', status, 'endedBy', ended_by, 'endedAt', ended_at)
  from public.connections where id = p_connection
$$;

create function public.client_receipt(p_connection uuid, p_token text, p_assignment uuid, p_ciphertext text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.connections;
begin
  c := private.connection_for(p_connection, p_token);
  if c.status <> 'active' then raise exception 'ended' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.assignments where id = p_assignment and connection_id = c.id) then
    raise exception 'assignment_missing' using errcode = 'P0001';
  end if;
  insert into public.receipts (assignment_id, connection_id, ciphertext, updated_at)
    values (p_assignment, c.id, p_ciphertext, now())
    on conflict (assignment_id) do update set ciphertext = excluded.ciphertext, updated_at = now();
end $$;

-- Zmiana zgody: obszary mogą tylko ubywać, zakres — dowolnie w obrębie znanych wartości.
-- Węższy zakres kasuje paczkę od razu: odwołana zgoda działa teraz, nie przy następnej wysyłce.
create function public.client_update(p_connection uuid, p_token text, p_areas text[], p_scopes text[])
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
  update public.connections set areas = p_areas, scopes = coalesce(p_scopes, '{}') where id = c.id;
end $$;

create function public.client_end(p_connection uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.connections;
begin
  c := private.connection_for(p_connection, p_token);
  perform private.end_connection(c.id, 'client');
end $$;

-- ── Funkcje prowadzącego ──────────────────────────────────────────────────────────────

create function public.coach_end_connection(p_connection uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.connections where id = p_connection and coach_id = (select auth.uid()) and status = 'active'
  ) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  perform private.end_connection(p_connection, 'coach');
end $$;

-- Usunięcie konta: znika prowadzący, jego zaproszenia, współprace, paczki i biblioteka (kaskada).
create function public.coach_delete_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not_signed_in' using errcode = 'P0001'; end if;
  delete from public.connections where coach_id = me;
  delete from auth.users where id = me;
end $$;

-- ── Uprawnienia funkcji ───────────────────────────────────────────────────────────────

revoke all on function private.connection_for(uuid, text) from public, anon, authenticated;
revoke all on function private.end_connection(uuid, text) from public, anon, authenticated;
revoke all on function private.touch() from public, anon, authenticated;

revoke all on function public.invite_preview(uuid) from public;
revoke all on function public.invite_accept(uuid, text, jsonb, text, text[], text[]) from public;
revoke all on function public.client_push(uuid, text, text, integer) from public;
revoke all on function public.client_pull(uuid, text) from public;
revoke all on function public.client_status(uuid) from public;
revoke all on function public.client_receipt(uuid, text, uuid, text) from public;
revoke all on function public.client_update(uuid, text, text[], text[]) from public;
revoke all on function public.client_end(uuid, text) from public;
revoke all on function public.coach_end_connection(uuid) from public;
revoke all on function public.coach_delete_account() from public;

grant execute on function public.invite_preview(uuid) to anon, authenticated;
grant execute on function public.invite_accept(uuid, text, jsonb, text, text[], text[]) to anon, authenticated;
grant execute on function public.client_push(uuid, text, text, integer) to anon, authenticated;
grant execute on function public.client_pull(uuid, text) to anon, authenticated;
grant execute on function public.client_status(uuid) to anon, authenticated;
grant execute on function public.client_receipt(uuid, text, uuid, text) to anon, authenticated;
grant execute on function public.client_update(uuid, text, text[], text[]) to anon, authenticated;
grant execute on function public.client_end(uuid, text) to anon, authenticated;
grant execute on function public.coach_end_connection(uuid) to authenticated;
grant execute on function public.coach_delete_account() to authenticated;

-- Tabele: anonimowy klient nie widzi żadnej. Prowadzący — tylko przez polityki wyżej.
revoke all on all tables in schema public from anon;
