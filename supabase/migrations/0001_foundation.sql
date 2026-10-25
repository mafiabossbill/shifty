-- Foundation: organizations, profiles, memberships, capabilities, admin bootstrap, audit log.
-- Multi-tenant by organization: every tenant table carries organization_id and RLS.
-- The capability map below MIRRORS src/lib/permissions.ts (tests/permissions.test.ts compares them).
-- Migrations are append-only: never edit an applied file; add a new one.

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ─── Shared helpers ───────────────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─── Organizations & people ───────────────────────────────────────────────────
create type member_role as enum ('admin', 'manager', 'member', 'viewer');

create table organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  slug       text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  timezone   text not null default 'UTC',
  currency   char(3) not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organizations_set_updated_at before update on organizations
  for each row execute function set_updated_at();

create table profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();

create table organization_members (
  organization_id uuid not null references organizations (id) on delete cascade,
  profile_id      uuid not null references profiles (id) on delete cascade,
  role            member_role not null default 'member',
  -- Deactivate, don't delete: history keeps its authors; every helper ignores deactivated members.
  deactivated_at  timestamptz,
  created_at      timestamptz not null default now(),
  primary key (organization_id, profile_id)
);
create index organization_members_profile_idx on organization_members (profile_id) where deactivated_at is null;

-- A profile for every auth user (name from sign-up metadata).
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ─── Capabilities (mirror of src/lib/permissions.ts ROLE_CAPABILITIES) ────────
-- Foundation capabilities only. Each entity migration that adds capabilities REPLACES this
-- function with the full map (e.g. the example entity migration); the last definition is the live one.
create or replace function private.role_capabilities(r member_role) returns text[]
language sql immutable as $$
  select case r
    when 'admin' then array['member:manage', 'settings:manage', 'audit:view']
    when 'manager' then array[]::text[]
    when 'member' then array[]::text[]
    when 'viewer' then array[]::text[]
  end;
$$;

-- Organizations the caller is an active member of. Use as `organization_id in (select my_organization_ids())`
-- in policies: evaluated once per query (initplan) instead of once per row.
create or replace function my_organization_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select organization_id from organization_members
   where profile_id = auth.uid() and deactivated_at is null;
$$;

create or replace function current_member_role(org uuid) returns member_role
language sql stable security definer set search_path = public as $$
  select role from organization_members
   where organization_id = org and profile_id = auth.uid() and deactivated_at is null;
$$;

create or replace function has_capability(org uuid, capability text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(capability = any (private.role_capabilities(current_member_role(org))), false);
$$;

revoke execute on function my_organization_ids() from public, anon;
revoke execute on function current_member_role(uuid) from public, anon;
revoke execute on function has_capability(uuid, text) from public, anon;
grant execute on function my_organization_ids() to authenticated;
grant execute on function current_member_role(uuid) to authenticated;
grant execute on function has_capability(uuid, text) to authenticated;

-- ─── Admin bootstrap (no hardcoded credentials, no service-role key) ─────────
-- `npm run db:configure` stores ADMIN_EMAIL and creates the first organization.
-- The first sign-in with that CONFIRMED email becomes its admin; everyone else gets nothing.
create table private.app_settings (
  key   text primary key,
  value text not null
);

create or replace function claim_admin_bootstrap() returns member_role
language plpgsql security definer set search_path = public as $$
declare
  admin_email text;
  org_slug    text;
  org         uuid;
  caller      auth.users;
begin
  select value into admin_email from private.app_settings where key = 'admin_email';
  select value into org_slug from private.app_settings where key = 'bootstrap_org_slug';
  select * into caller from auth.users where id = auth.uid();
  if admin_email is null or org_slug is null or caller.id is null then return null; end if;
  if caller.email_confirmed_at is null or lower(caller.email) <> lower(admin_email) then return null; end if;
  if exists (select 1 from organization_members where profile_id = caller.id) then return null; end if;
  select id into org from organizations where slug = org_slug;
  if org is null then return null; end if;
  insert into profiles (id) values (caller.id) on conflict (id) do nothing;
  insert into organization_members (organization_id, profile_id, role) values (org, caller.id, 'admin');
  return 'admin';
end;
$$;
revoke execute on function claim_admin_bootstrap() from public, anon;
grant execute on function claim_admin_bootstrap() to authenticated;

-- Never remove or demote the last active admin of an organization.
create or replace function guard_last_admin() returns trigger
language plpgsql as $$
declare
  org uuid := coalesce(old.organization_id, new.organization_id);
begin
  if old.role = 'admin' and old.deactivated_at is null
     and (tg_op = 'DELETE' or new.role <> 'admin' or new.deactivated_at is not null)
     and not exists (
       select 1 from organization_members
        where organization_id = org and role = 'admin' and deactivated_at is null and profile_id <> old.profile_id
     )
     and exists (select 1 from organizations where id = org) then
    raise exception 'An organization needs at least one active admin.' using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger organization_members_guard_last_admin
  before update or delete on organization_members
  for each row execute function guard_last_admin();

-- ─── Audit log (append-only, written by triggers) ─────────────────────────────
create table audit_logs (
  id              bigint generated always as identity primary key,
  organization_id uuid not null references organizations (id) on delete cascade,
  actor_id        uuid references profiles (id) on delete set null,
  entity_type     text not null,
  entity_id       uuid,
  action          text not null check (action in ('insert', 'update', 'delete')),
  changes         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index audit_logs_org_created_idx on audit_logs (organization_id, created_at desc);
create index audit_logs_entity_idx on audit_logs (entity_type, entity_id);

-- Generic row audit: attach to any org-scoped table with `id` and `organization_id`.
-- Records changed columns only (old → new); ignores updated_at.
create or replace function private.audit_row_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  diff jsonb := '{}'::jsonb;
  k    text;
  o    jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n    jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
begin
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(n) loop
      if k <> 'updated_at' and (o -> k) is distinct from (n -> k) then
        diff := diff || jsonb_build_object(k, jsonb_build_array(o -> k, n -> k));
      end if;
    end loop;
    if diff = '{}'::jsonb then return new; end if;
  elsif tg_op = 'INSERT' then
    diff := n;
  else
    diff := o;
  end if;
  -- A workspace being deleted takes its log with it: nothing to record.
  if not exists (select 1 from public.organizations where id = coalesce(n ->> 'organization_id', o ->> 'organization_id')::uuid) then
    return coalesce(new, old);
  end if;
  insert into public.audit_logs (organization_id, actor_id, entity_type, entity_id, action, changes)
  values (
    coalesce(n ->> 'organization_id', o ->> 'organization_id')::uuid,
    -- null while the actor's own account is being deleted (their rows are anonymized in that statement)
    (select p.id from public.profiles p where p.id = auth.uid()),
    tg_table_name,
    coalesce(n ->> 'id', o ->> 'id')::uuid,
    lower(tg_op),
    diff
  );
  return coalesce(new, old);
end;
$$;

-- ─── Row-level security ───────────────────────────────────────────────────────
alter table organizations        enable row level security;
alter table profiles             enable row level security;
alter table organization_members enable row level security;
alter table audit_logs           enable row level security;

create policy organizations_select on organizations for select
  using (id in (select my_organization_ids()));
create policy organizations_update on organizations for update
  using (has_capability(id, 'settings:manage')) with check (has_capability(id, 'settings:manage'));

-- Profiles are visible to anyone sharing an organization with them.
create policy profiles_select on profiles for select using (
  id = auth.uid() or exists (
    select 1 from organization_members theirs
     where theirs.profile_id = profiles.id
       and theirs.organization_id in (select my_organization_ids())
  )
);
create policy profiles_update_self on profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy members_select on organization_members for select
  using (organization_id in (select my_organization_ids()) or profile_id = auth.uid());
create policy members_write on organization_members for all
  using (has_capability(organization_id, 'member:manage'))
  with check (has_capability(organization_id, 'member:manage'));

-- Append-only: readable by audit:view, written only by the security-definer trigger.
create policy audit_logs_select on audit_logs for select using (has_capability(organization_id, 'audit:view'));
