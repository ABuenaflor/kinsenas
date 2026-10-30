-- Kinsenas cloud sync. Run once in Supabase → SQL Editor.
-- One row per record (an expense, a To-Buy item, the settings…); deletions are kept as tombstones.

create table if not exists public.kinsenas_records (
  user_id        uuid        not null default auth.uid() references auth.users on delete cascade,
  collection     text        not null,
  id             text        not null,
  data           jsonb,
  deleted        boolean     not null default false,
  schema_version int         not null,
  updated_at     timestamptz not null default clock_timestamp(),
  primary key (user_id, collection, id)
);

create index if not exists kinsenas_records_user_updated on public.kinsenas_records (user_id, updated_at);

-- The server stamps every write, so device clocks don't matter.
create or replace function public.kinsenas_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists kinsenas_touch on public.kinsenas_records;
create trigger kinsenas_touch before insert or update on public.kinsenas_records
  for each row execute function public.kinsenas_touch();

-- Each signed-in user can only see and change their own rows.
alter table public.kinsenas_records enable row level security;

drop policy if exists "own records" on public.kinsenas_records;
create policy "own records" on public.kinsenas_records
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
