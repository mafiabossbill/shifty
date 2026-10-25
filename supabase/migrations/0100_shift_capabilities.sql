-- SHIFTY capability: "shift:track" lets a person keep their OWN work sessions. It never grants a view of
-- anyone else's: every SHIFTY policy also requires user_id = auth.uid() (admins included, by design).
-- Replaces private.role_capabilities() with the FULL map; mirrors src/lib/permissions.ts
-- (tests/permissions.test.ts compares the last definition with ROLE_CAPABILITIES).

create or replace function private.role_capabilities(r member_role) returns text[]
language sql immutable as $$
  select case r
    when 'admin' then array['member:manage', 'settings:manage', 'audit:view', 'shift:track']
    when 'manager' then array[]::text[]
    when 'member' then array['shift:track']
    when 'viewer' then array[]::text[]
  end;
$$;
