-- Хозяин леса: защищённая общая очередь обращений и роли администраторов.
-- Выполняется в Supabase SQL Editor. В текущем проекте эта схема уже применена через миграции.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.lotw_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','owner')) default 'admin',
  created_at timestamptz not null default now()
);

create table if not exists public.lotw_activity (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  state_id text,
  state_name text not null default 'Без государства',
  player_name text not null default 'Не указано',
  event_type text not null default 'event',
  title text not null,
  details text not null default '',
  cleric_delta numeric not null default 0,
  favor_delta numeric not null default 0,
  status text not null default 'new' check (status in ('new','answered','approved','rejected','needs-info')),
  admin_reply text,
  replied_at timestamptz,
  replied_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists lotw_activity_actor_created_idx on public.lotw_activity(actor_id, created_at desc);
create index if not exists lotw_activity_created_idx on public.lotw_activity(created_at desc);
create index if not exists lotw_activity_replied_by_idx on public.lotw_activity(replied_by);

create or replace function private.lotw_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1 from public.lotw_admins a
    where a.user_id = (select auth.uid()) and a.role in ('admin','owner')
  );
$$;
revoke all on function private.lotw_is_admin() from public, anon, authenticated;
grant execute on function private.lotw_is_admin() to authenticated;

alter table public.lotw_admins enable row level security;
alter table public.lotw_activity enable row level security;

revoke all on public.lotw_admins, public.lotw_activity from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.lotw_admins to authenticated;
grant select, insert, update on public.lotw_activity to authenticated;

drop policy if exists "read own admin role" on public.lotw_admins;
create policy "read own admin role" on public.lotw_admins
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "activity insert by actor" on public.lotw_activity;
create policy "activity insert by actor" on public.lotw_activity
for insert to authenticated with check (
  actor_id = (select auth.uid()) and status = 'new'
  and admin_reply is null and replied_at is null and replied_by is null
);

drop policy if exists "read own activity or admin inbox" on public.lotw_activity;
create policy "read own activity or admin inbox" on public.lotw_activity
for select to authenticated using (
  actor_id = (select auth.uid()) or (select private.lotw_is_admin())
);

drop policy if exists "admin update activity" on public.lotw_activity;
create policy "admin update activity" on public.lotw_activity
for update to authenticated
using ((select private.lotw_is_admin()))
with check ((select private.lotw_is_admin()));

-- После создания аккаунта владельца добавьте его UUID:
-- insert into public.lotw_admins(user_id, role)
-- select id, 'owner' from auth.users where email = 'YOUR_EMAIL'
-- on conflict (user_id) do update set role = 'owner';
