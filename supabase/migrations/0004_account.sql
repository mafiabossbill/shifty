-- Account self-service (privacy law: access and erasure). People download their data in the app
-- (GET /api/account/export) and delete their own account here. What they wrote stays with their name
-- removed: every reference to profiles is `on delete set null`, and audit rows lose the actor.

-- What deleting the caller's account would do, per workspace:
--   deleted  they are its only active member, so the workspace and its data go too
--   blocked  they are its last active admin and others remain (make someone else admin first)
--   kept     the workspace stays; their membership goes
create or replace function account_deletion_preview()
returns table (organization_id uuid, organization_name text, outcome text)
language sql stable security definer set search_path = public as $$
  select o.id, o.name,
    case
      when not exists (
        select 1 from organization_members x
         where x.organization_id = o.id and x.profile_id <> auth.uid() and x.deactivated_at is null
      ) then 'deleted'
      when m.role = 'admin' and m.deactivated_at is null and not exists (
        select 1 from organization_members x
         where x.organization_id = o.id and x.profile_id <> auth.uid() and x.role = 'admin' and x.deactivated_at is null
      ) then 'blocked'
      else 'kept'
    end
  from organization_members m
  join organizations o on o.id = m.organization_id
  where m.profile_id = auth.uid()
  order by o.name;
$$;
revoke execute on function account_deletion_preview() from public, anon;
grant execute on function account_deletion_preview() to authenticated;

-- Deletes the caller's account in one transaction. They confirm by typing their email address.
create or replace function delete_own_account(p_confirm_email text) returns void
language plpgsql security definer set search_path = public as $$
declare
  caller auth.users;
begin
  select * into caller from auth.users where id = auth.uid();
  if caller.id is null then
    raise exception 'Sign in to continue.' using errcode = 'insufficient_privilege';
  end if;
  if lower(trim(coalesce(p_confirm_email, ''))) <> lower(caller.email) then
    raise exception 'Type your email address exactly to confirm.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from account_deletion_preview() where outcome = 'blocked') then
    raise exception 'You''re the last admin of a workspace with other people in it. Make someone else an admin first.'
      using errcode = 'check_violation';
  end if;
  delete from organizations where id in (select organization_id from account_deletion_preview() where outcome = 'deleted');
  -- Cascades to profiles and memberships; Supabase removes sessions and identities with the user.
  delete from auth.users where id = caller.id;
end;
$$;
revoke execute on function delete_own_account(text) from public, anon;
grant execute on function delete_own_account(text) to authenticated;
