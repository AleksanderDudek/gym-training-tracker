-- Jawne uprawnienia roli `authenticated` do tabel Sztabu.
--
-- Pierwsza migracja polegała na domyślnych uprawnieniach schematu `public`: lokalny Supabase (CLI)
-- daje `anon` i `authenticated` wszystko na każdą nową tabelę, a nowe projekty w chmurze — nic.
-- Na produkcji prowadzący po zalogowaniu dostawał `42501 permission denied for table coaches`.
--
-- Tu dokładnie te uprawnienia, które lokalna baza (i testy `npm run test:db`) miały dotąd:
-- lokalnie to nic nie zmienia, w chmurze wyrównuje do lokalnej. Kto i które wiersze — dalej
-- decyduje RLS; `anon` do tabel nie ma dostępu wcale (pierwsza migracja), telefon zna tylko RPC.
-- Aktualizacja zaproszeń i zaleceń zostaje ograniczona do jednej kolumny (revoked_at,
-- withdrawn_at) — tych tabel nie dostają UPDATE na całość.
--
-- Nowe tabele: uprawnienia nadawać jawnie w ich migracji, nie liczyć na domyślne.

grant select, insert, update, delete on table public.coaches to authenticated;
grant select, insert, delete on table public.invites to authenticated;
grant select, insert, update, delete on table public.connections to authenticated;
grant select, insert, update, delete on table public.snapshots to authenticated;
grant select, insert, delete on table public.assignments to authenticated;
grant select, insert, update, delete on table public.receipts to authenticated;
grant select, insert, update, delete on table public.library_items to authenticated;
