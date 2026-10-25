-- Team management: invites (nothing is emailed by the app; the person signs up with the invited
-- address and claim_invite() adds them once the email is confirmed), a directory with emails for
-- people who may manage the team, and deactivation (organization_members.deactivated_at, 0001).
-- Admin-created accounts for people who never sign in need the service-role key: see the
-- factory's docs/SUPABASE_STANDARD.md (admin-created people).

create table organization_invites (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  email           text not null check (email = lower(trim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role            member_role not null default 'member',
  invited_by      uuid references profiles (id) on delete set null,
  accepted_at     timestamptz,
  created_at      timestamptz not null default now()
);
-- One pending invite per address per organization.
create unique index organization_invites_pending_idx on organization_invites (organization_id, email) where accepted_at is null;
create index organization_invites_email_idx on organization_invites (email) where accepted_at is null;

create trigger organization_invites_audit after insert or update or delete on organization_invites
  for each row execute function private.audit_row_change();
create trigger organization_members_audit after insert or update or delete on organization_members
  for each row execute function private.audit_row_change();

alter table organization_invites enable row level security;
create policy invites_select on organization_invites for select
  using (has_capability(organization_id, 'member:manage'));
create policy invites_insert on organization_invites for insert
  with check (has_capability(organization_id, 'member:manage') and invited_by = auth.uid());
create policy invites_delete on organization_invites for delete
  using (has_capability(organization_id, 'member:manage') and accepted_at is null);

-- The caller's pending invite for their CONFIRMED email becomes a membership (first match wins).
create or replace function claim_invite() returns member_role
language plpgsql security definer set search_path = public as $$
declare
  caller auth.users;
  inv    organization_invites;
begin
  select * into caller from auth.users where id = auth.uid();
  if caller.id is null or caller.email_confirmed_at is null then return null; end if;
  select * into inv from organization_invites
   where email = lower(caller.email) and accepted_at is null
   order by created_at
   limit 1
   for update;
  if inv.id is null then return null; end if;
  insert into profiles (id) values (caller.id) on conflict (id) do nothing;
  insert into organization_members (organization_id, profile_id, role)
  values (inv.organization_id, caller.id, inv.role)
  on conflict (organization_id, profile_id) do nothing;
  update organization_invites set accepted_at = now() where id = inv.id;
  return inv.role;
end;
$$;
revoke execute on function claim_invite() from public, anon;
grant execute on function claim_invite() to authenticated;

-- Members with emails (auth.users is not exposed to the API). Emails only for member:manage.
create or replace function team_directory(org uuid)
returns table (profile_id uuid, full_name text, email text, role member_role, deactivated_at timestamptz, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.profile_id, p.full_name,
         case when has_capability(org, 'member:manage') then u.email::text end,
         m.role, m.deactivated_at, m.created_at
    from organization_members m
    join profiles p on p.id = m.profile_id
    join auth.users u on u.id = m.profile_id
   where m.organization_id = org
     and org in (select my_organization_ids())
   order by m.deactivated_at nulls first, p.full_name;
$$;
revoke execute on function team_directory(uuid) from public, anon;
grant execute on function team_directory(uuid) to authenticated;
