-- Powiadomienia push od prowadzącego (spec: docs/superpowers/specs/2026-11-25-sztab-powiadomienia-design.md).
--
-- Telefon losuje dla każdej współpracy token powiadomień, rejestruje go na serwerze aplikacji GYM TRACKERa
-- (Worker z kluczem VAPID — tam leży jego subskrypcja push) i podaje go tutaj. Przeglądarka prowadzącego
-- po wysłaniu wiadomości, zalecenia albo zmianie wizyty woła Workera z tym tokenem i samym rodzajem
-- zdarzenia. Treści serwer push nie zna; Supabase nie zna subskrypcji ani urządzenia.
--
-- Token widzi tylko prowadzący tej współpracy (RLS na `connections`); ustawia i kasuje go tylko telefon.
-- Koniec współpracy go kasuje — prowadzący nie powiadomi nikogo po rozstaniu.

alter table public.connections add column notify_token text
  check (notify_token is null or notify_token ~ '^[A-Za-z0-9_-]{43}$');

-- Telefon ustawia (albo kasuje, `null`) token powiadomień swojej współpracy.
create function public.client_set_notify(p_connection uuid, p_token text, p_notify text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.connections;
begin
  c := private.connection_for(p_connection, p_token);
  if c.status <> 'active' then raise exception 'ended' using errcode = 'P0001'; end if;
  if p_notify is not null and p_notify !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'bad_notify' using errcode = 'P0001';
  end if;
  update public.connections set notify_token = p_notify where id = c.id;
end $$;

revoke all on function public.client_set_notify(uuid, text, text) from public;
grant execute on function public.client_set_notify(uuid, text, text) to anon, authenticated;

-- Koniec współpracy kasuje też token powiadomień (reszta bez zmian względem `…_funkcje_prowadzenia`).
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
    set status = 'ended', ended_by = p_by, ended_at = now(), scopes = '{}', notify_token = null
    where id = p_connection and status = 'active';
end $$;

revoke all on function private.end_connection(uuid, text) from public, anon, authenticated;
