-- Хозяин леса: общая база игрового мира, профили и защищённая очередь обращений.
-- Этот файл описывает итоговую схему; в рабочем проекте миграции уже применены.

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

-- Единое состояние игрового мира. Активное состояние и имя игрока хранятся отдельно в профилях.
create table if not exists public.lotw_shared_data (
  part text primary key check (part in ('app','military')),
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.lotw_shared_data(part,payload,revision)
values
 ('app','{"version":2,"states":[],"journal":[],"createdAt":"2026-11-08T00:00:00.000Z"}'::jsonb,0),
 ('military','{"version":1,"turn":0,"army_a":{"name":"Армия A","units":[],"siege_engines":[],"fortification":0,"priests":0,"cleric":100,"feudal_loyalty":60,"feudal_count":0,"recruitment_specialists_base":null,"recruitment_rabble_base":null,"craft":0,"linked_state_name":"","race":"Не указана"},"army_b":{"name":"Армия B","units":[],"siege_engines":[],"fortification":0,"priests":0,"cleric":100,"feudal_loyalty":60,"feudal_count":0,"recruitment_specialists_base":null,"recruitment_rabble_base":null,"craft":0,"linked_state_name":"","race":"Не указана"},"order_a":"Атака в лоб","order_b":"Оборона","history":[],"last_report":null}'::jsonb,0)
on conflict (part) do nothing;

create table if not exists public.lotw_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  player_name text not null default '',
  active_state_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lotw_shared_data enable row level security;
alter table public.lotw_profiles enable row level security;
revoke all on public.lotw_shared_data, public.lotw_profiles from public, anon, authenticated;
grant select on public.lotw_shared_data to authenticated;
grant select, insert, update on public.lotw_profiles to authenticated;

drop policy if exists "shared data readable by authenticated users" on public.lotw_shared_data;
create policy "shared data readable by authenticated users" on public.lotw_shared_data
for select to authenticated using (true);

drop policy if exists "profile read by owner" on public.lotw_profiles;
create policy "profile read by owner" on public.lotw_profiles
for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "profile insert by owner" on public.lotw_profiles;
create policy "profile insert by owner" on public.lotw_profiles
for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "profile update by owner" on public.lotw_profiles;
create policy "profile update by owner" on public.lotw_profiles
for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- All shared changes use optimistic revision checks. Direct table updates are disabled.
create or replace function private.lotw_save_shared_data(
  p_part text, p_payload jsonb, p_expected_revision bigint
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $$
declare v_revision bigint;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_part not in ('app','military') then
    raise exception 'Invalid shared data part' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Payload must be a JSON object' using errcode = '22023';
  end if;
  if octet_length(p_payload::text) > 2000000 then
    raise exception 'Payload is larger than 2 MB' using errcode = '22001';
  end if;
  update public.lotw_shared_data
     set payload=p_payload, revision=revision+1,
         updated_by=(select auth.uid()), updated_at=now()
   where part=p_part and revision=p_expected_revision
   returning revision into v_revision;
  if v_revision is null then
    select revision into v_revision from public.lotw_shared_data where part=p_part;
    return jsonb_build_object('ok',false,'conflict',true,'revision',coalesce(v_revision,-1));
  end if;
  return jsonb_build_object('ok',true,'revision',v_revision);
end;
$$;
revoke all on function private.lotw_save_shared_data(text,jsonb,bigint) from public, anon, authenticated;
grant execute on function private.lotw_save_shared_data(text,jsonb,bigint) to authenticated;
grant usage on schema private to authenticated;

create or replace function public.lotw_save_shared_data(
  p_part text, p_payload jsonb, p_expected_revision bigint
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.lotw_save_shared_data(p_part,p_payload,p_expected_revision);
$$;
revoke all on function public.lotw_save_shared_data(text,jsonb,bigint) from public, anon, authenticated;
grant execute on function public.lotw_save_shared_data(text,jsonb,bigint) to authenticated;

