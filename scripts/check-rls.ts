/**
 * Proves row-level security against the LIVE database (run after every migration
 * that adds a table or policy, and in the release gate). `npm run db:local-check`
 * runs the same block against a throwaway local Postgres.
 *
 * One DO block creates throwaway users and two organizations, impersonates each
 * user exactly as PostgREST does (`set local role authenticated` + request.jwt.claims),
 * tries to read and write, and finally RAISES its results, so everything rolls back.
 * Nothing is left behind, and no service-role key is needed (Management API only).
 *
 * Sections: foundation (organizations, members, team, audit, bootstrap) always; the
 * example entity between @example markers (removed by `scripts/bootstrap --no-example`);
 * SaaS workspace creation whenever create_organization() exists (`scripts/bootstrap --saas`);
 * SHIFTY (sessions, breaks, locations, events, rewards: own rows only, commit_shift_event rules,
 * reducer ↔ load_shift_state() equality, ms round trip); account deletion last (it removes fixture users).
 * Add a section for every new table: an outsider sees and changes nothing, each role
 * can do exactly what src/lib/permissions.ts says.
 */
import { isDeepStrictEqual } from "node:util";

import { shiftFixture } from "../supabase/local/shift-fixture";

import { lit, sql } from "./sql";


/** Every SHIFTY table (all carry user_id); used to count what someone can see of the owner's data. */
const SHIFT_TABLES = ["shift_sessions", "shift_breaks", "location_snapshots", "session_revisions", "shift_events", "work_projects", "saved_places", "user_settings", "companion_states", "reward_ledger_entries", "user_achievements", "activities"];
const OWNER_ROWS = `(${SHIFT_TABLES.map((t) => `(select count(*) from ${t} where user_id = s_owner)`).join(" + ")})`;
const SHIFT_TABLES_SQL = SHIFT_TABLES.map((t) => `'${t}'`).join(", ");


const checkSql = (fx: unknown) => `
do $check$
declare
  org_a    uuid := gen_random_uuid();
  org_b    uuid := gen_random_uuid();
  admin_a  uuid := gen_random_uuid();
  member_a uuid := gen_random_uuid();
  viewer_a uuid := gen_random_uuid();
  admin_b  uuid := gen_random_uuid();
  boot_ok  uuid := gen_random_uuid();
  boot_no  uuid := gen_random_uuid();
  boot_un  uuid := gen_random_uuid();
  invitee  uuid := gen_random_uuid();
  saas_u   uuid := gen_random_uuid();
  saas_org uuid;
  solo_u   uuid := gen_random_uuid();
  solo_org uuid := gen_random_uuid();
  n        int;
  r        jsonb := '{}'::jsonb;
  s_owner  uuid := gen_random_uuid();
  s_peer   uuid := gen_random_uuid();
  fx       jsonb := ${lit(JSON.stringify(fx))};
  step     jsonb;
  c        jsonb;
  v_res    jsonb;
  v_out    text;
  v_state  text;
  v_con    text;
  v_msg    text;
  v_count  int;
  v_rev    int;
begin
  -- ── Fixtures, written as the owner (rolled back at the end) ──────────────────
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', 'rls-' || u || '@example.test', '', now(), now()
    from unnest(array[admin_a, member_a, viewer_a, admin_b]) as u;
  insert into organizations (id, name, slug) values (org_a, 'RLS A', 'rls-a-' || left(org_a::text, 8)), (org_b, 'RLS B', 'rls-b-' || left(org_b::text, 8));
  insert into organization_members (organization_id, profile_id, role) values
    (org_a, admin_a, 'admin'), (org_a, member_a, 'member'), (org_a, viewer_a, 'viewer'), (org_b, admin_b, 'admin');
  -- Admin bootstrap fixtures: the configured email (confirmed), another email, the configured email unconfirmed; an invitee.
  insert into private.app_settings (key, value) values ('admin_email', 'boot-' || boot_ok || '@example.test'), ('bootstrap_org_slug', 'rls-b-' || left(org_b::text, 8))
  on conflict (key) do update set value = excluded.value;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
    ('00000000-0000-0000-0000-000000000000', boot_ok, 'authenticated', 'authenticated', 'boot-' || boot_ok || '@example.test', '', now(), now(), now()),
    ('00000000-0000-0000-0000-000000000000', boot_no, 'authenticated', 'authenticated', 'other-' || boot_no || '@example.test', '', now(), now(), now()),
    ('00000000-0000-0000-0000-000000000000', boot_un, 'authenticated', 'authenticated', 'BOOT-' || boot_ok || '@example.test', '', null, now(), now()),
    ('00000000-0000-0000-0000-000000000000', invitee, 'authenticated', 'authenticated', 'Invitee-' || invitee || '@Example.test', '', now(), now(), now());
  insert into organization_invites (organization_id, email, role, invited_by) values (org_a, lower('invitee-' || invitee || '@example.test'), 'manager', admin_a);

  -- ── Foundation: another organization's admin sees and changes nothing ───────
  perform set_config('request.jwt.claims', json_build_object('sub', admin_b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from organizations where id = org_a;
  r := r || jsonb_build_object('outsider_organizations', n);
  select count(*) into n from organization_members where organization_id = org_a;
  r := r || jsonb_build_object('outsider_members', n);
  select count(*) into n from audit_logs where organization_id = org_a;
  r := r || jsonb_build_object('outsider_audit', n);
  select count(*) into n from team_directory(org_a);
  r := r || jsonb_build_object('outsider_directory', n);
  update organizations set name = 'hijacked' where id = org_a;
  get diagnostics n = row_count;
  r := r || jsonb_build_object('outsider_org_updated', n);
  begin
    insert into organization_members (organization_id, profile_id, role) values (org_a, admin_b, 'admin');
    r := r || jsonb_build_object('outsider_join', 'allowed');
  exception when others then
    r := r || jsonb_build_object('outsider_join', 'denied');
  end;
  reset role;

  -- ── Foundation: team management is admin-only ────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', member_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from organization_invites where organization_id = org_a;
  r := r || jsonb_build_object('member_invites', n);
  select count(*) into n from team_directory(org_a) where email is not null;
  r := r || jsonb_build_object('member_directory_emails', n);
  select count(*) into n from audit_logs where organization_id = org_a;
  r := r || jsonb_build_object('member_audit', n);
  begin
    insert into organization_invites (organization_id, email, invited_by) values (org_a, 'sneaky@example.test', member_a);
    r := r || jsonb_build_object('member_invite_insert', 'allowed');
  exception when others then
    r := r || jsonb_build_object('member_invite_insert', 'denied');
  end;
  update organization_members set role = 'admin' where organization_id = org_a and profile_id = member_a;
  get diagnostics n = row_count;
  r := r || jsonb_build_object('member_self_promote', n);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', admin_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from team_directory(org_a) where email is not null;
  r := r || jsonb_build_object('admin_directory_emails', n);
  reset role;


  -- ── Foundation: an invited, confirmed address joins with the invited role, once ─
  perform set_config('request.jwt.claims', json_build_object('sub', invitee, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r := r || jsonb_build_object('invite_claimed', coalesce(claim_invite()::text, 'none'));
  r := r || jsonb_build_object('invite_claimed_again', coalesce(claim_invite()::text, 'none'));
  select count(*) into n from organizations where id = org_a;
  r := r || jsonb_build_object('invitee_sees_org', n);
  reset role;

  -- ── Foundation: a deactivated member sees nothing ────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', admin_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update organization_members set deactivated_at = now() where organization_id = org_a and profile_id = member_a;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', member_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from organizations where id = org_a;
  r := r || jsonb_build_object('deactivated_sees_org', n);
  r := r || jsonb_build_object('deactivated_can_manage', has_capability(org_a, 'member:manage'));
  reset role;

  -- ── Foundation: the only admin can't demote themselves ───────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', admin_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update organization_members set role = 'member' where organization_id = org_a and profile_id = admin_a;
    r := r || jsonb_build_object('last_admin_demote', 'allowed');
  exception when others then
    r := r || jsonb_build_object('last_admin_demote', 'denied');
  end;
  reset role;

  -- ── Foundation: admin bootstrap only for the configured, confirmed email, once ─
  perform set_config('request.jwt.claims', json_build_object('sub', boot_no, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r := r || jsonb_build_object('bootstrap_other_email', coalesce(claim_admin_bootstrap()::text, 'none'));
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', boot_un, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r := r || jsonb_build_object('bootstrap_unconfirmed', coalesce(claim_admin_bootstrap()::text, 'none'));
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', boot_ok, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r := r || jsonb_build_object('bootstrap_configured', coalesce(claim_admin_bootstrap()::text, 'none'));
  r := r || jsonb_build_object('bootstrap_second_time', coalesce(claim_admin_bootstrap()::text, 'none'));
  reset role;

  -- ── SaaS tenancy: only when create_organization() is installed ───────────────
  r := r || jsonb_build_object('saas_enabled', to_regprocedure('public.create_organization(text,text,text)') is not null);
  if to_regprocedure('public.create_organization(text,text,text)') is not null then
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
      ('00000000-0000-0000-0000-000000000000', saas_u, 'authenticated', 'authenticated', 'saas-' || saas_u || '@example.test', '', now(), now(), now());
    -- An unconfirmed email can't create a workspace.
    perform set_config('request.jwt.claims', json_build_object('sub', member_a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin
      perform create_organization('Unconfirmed Co');
      r := r || jsonb_build_object('saas_unconfirmed', 'allowed');
    exception when others then
      r := r || jsonb_build_object('saas_unconfirmed', 'denied');
    end;
    reset role;
    -- A confirmed person creates one, becomes its admin and still sees no one else's.
    perform set_config('request.jwt.claims', json_build_object('sub', saas_u, 'role', 'authenticated')::text, true);
    set local role authenticated;
    saas_org := create_organization('Acme & Co', 'Africa/Dar_es_Salaam', 'TZS');
    select count(*) into n from organizations where id = saas_org and slug like 'acme-co-%' and currency = 'TZS';
    r := r || jsonb_build_object('saas_created', n);
    select count(*) into n from organization_members where organization_id = saas_org and profile_id = saas_u and role = 'admin';
    r := r || jsonb_build_object('saas_creator_admin', n);
    select count(*) into n from organizations where id in (org_a, org_b);
    r := r || jsonb_build_object('saas_sees_others', n);
    -- Abuse guard: at most 5 workspaces per person (n counts the ones that succeeded).
    n := 1;
    begin
      for i in 1..5 loop
        perform create_organization('Extra ' || i);
        n := n + 1;
      end loop;
    exception when others then
      null;
    end;
    r := r || jsonb_build_object('saas_workspace_cap', n);
    reset role;
    perform set_config('request.jwt.claims', json_build_object('sub', admin_b, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into n from organizations where id = saas_org;
    r := r || jsonb_build_object('saas_outsider_sees', n);
    reset role;
    set local role anon;
    begin
      perform create_organization('Anon Co');
      r := r || jsonb_build_object('saas_anon', 'allowed');
    exception when others then
      r := r || jsonb_build_object('saas_anon', 'denied');
    end;
    reset role;
  end if;

  -- ── SHIFTY: own rows only (admins included), atomic commits, DB-enforced rules ─
  -- Fixture (fx) is built by the TypeScript reducer in this script; see shiftFixture().
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
    ('00000000-0000-0000-0000-000000000000', s_owner, 'authenticated', 'authenticated', 'shift-owner-' || s_owner || '@example.test', '', now(), now(), now()),
    ('00000000-0000-0000-0000-000000000000', s_peer, 'authenticated', 'authenticated', 'shift-peer-' || s_peer || '@example.test', '', now(), now(), now());
  insert into organization_members (organization_id, profile_id, role) values (org_a, s_owner, 'member'), (org_a, s_peer, 'member');

  -- The owner's profile documents (RLS insert) and a project of the peer's.
  perform set_config('request.jwt.claims', json_build_object('sub', s_peer, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into work_projects (id, organization_id, user_id, name, color, updated_ms) values ((fx ->> 'peerProjectId')::uuid, org_a, s_peer, 'Peer', 'rose', 1);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', s_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into work_projects (id, organization_id, user_id, name, color, archived, updated_ms)
  select x.id, org_a, s_owner, x.name, x.color, x.archived, x."updatedAt"
    from jsonb_to_recordset(fx -> 'profile' -> 'projects') as x(id uuid, name text, color text, archived boolean, "updatedAt" bigint);
  insert into saved_places (id, organization_id, user_id, label, latitude, longitude, radius_m, updated_ms)
  select x.id, org_a, s_owner, x.label, x.latitude, x.longitude, x."radiusM", x."updatedAt"
    from jsonb_to_recordset(fx -> 'profile' -> 'places') as x(id uuid, label text, latitude double precision, longitude double precision, "radiusM" int, "updatedAt" bigint);
  insert into user_settings (user_id, organization_id, settings, updated_ms)
  values (s_owner, org_a, fx -> 'profile' -> 'settings', (fx -> 'profile' -> 'settings' ->> 'updatedAt')::bigint);
  insert into companion_states (user_id, organization_id, state, updated_ms)
  values (s_owner, org_a, fx -> 'profile' -> 'companion', (fx -> 'profile' -> 'companion' ->> 'updatedAt')::bigint);
  insert into activities (user_id, organization_id, id, type, key, at_ms)
  select s_owner, org_a, x.id, x.type, x.key, x.at
    from jsonb_to_recordset(fx -> 'profile' -> 'activities') as x(id text, type text, key text, at bigint);
  insert into reward_ledger_entries (user_id, organization_id, event_key, rule, xp, source_session_id, awarded_ms)
  select s_owner, org_a, x.key, x.rule, x.xp, x."sourceSessionId", x.at
    from jsonb_to_recordset(fx -> 'profile' -> 'ledger') as x(key text, rule text, xp int, "sourceSessionId" uuid, at bigint);
  insert into user_achievements (user_id, organization_id, code, earned_ms, source_session_id)
  select s_owner, org_a, x.code, x."earnedAt", x."sourceSessionId"
    from jsonb_to_recordset(fx -> 'profile' -> 'achievements') as x(code text, "earnedAt" bigint, "sourceSessionId" uuid);

  -- Every reducer step through commit_shift_event, as the owner.
  n := 0;
  begin
    for step in select value from jsonb_array_elements(fx -> 'steps') loop
      v_res := commit_shift_event(step -> 'event', step -> 'session', (step ->> 'sessionId')::uuid, (step ->> 'expected')::int);
      if v_res ->> 'status' <> 'applied' or (v_res ->> 'revision') is distinct from (step -> 'session' ->> 'revision') then
        raise exception 'step % (%) returned %', n, step -> 'event' ->> 'type', v_res;
      end if;
      n := n + 1;
    end loop;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    r := r || jsonb_build_object('shift_steps_error', v_state || ' ' || v_msg);
  end;
  r := r || jsonb_build_object('shift_steps_applied', n);
  reset role;

  -- Rule violations and other people's attempts: each fails, leaving nothing behind.
  for c in select value from jsonb_array_elements(fx -> 'cases') loop
    perform set_config('request.jwt.claims', json_build_object('sub', case c ->> 'as'
      when 'owner' then s_owner when 'peer' then s_peer when 'admin' then admin_a when 'outsider' then admin_b else viewer_a end,
      'role', 'authenticated')::text, true);
    set local role authenticated;
    begin
      v_res := commit_shift_event(c -> 'event', c -> 'session', (c ->> 'sessionId')::uuid, (c ->> 'expected')::int);
      v_out := v_res ->> 'status';
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate, v_con = constraint_name, v_msg = message_text;
      v_out := trim(v_state || ' ' || coalesce(v_con, ''));
      if c ->> 'key' = 'second_active' then
        r := r || jsonb_build_object('shift_active_message_names_index', position('shift_sessions_one_active_idx' in v_msg) > 0);
      end if;
    end;
    reset role;
    r := r || jsonb_build_object('shift_case_' || (c ->> 'key'), v_out);
  end loop;

  -- The owner reads back exactly what the reducer produced; failures stored no events.
  perform set_config('request.jwt.claims', json_build_object('sub', s_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r := r || jsonb_build_object('shift_loaded_state', load_shift_state());
  r := r || jsonb_build_object('shift_loaded_profile', load_profile_state());
  select count(*) into n from shift_events where user_id = s_owner;
  r := r || jsonb_build_object('shift_owner_events', n);
  select ${OWNER_ROWS} into n;
  r := r || jsonb_build_object('shift_owner_sees', n);
  select jsonb_array_length(export_my_shift_data() -> 'sessions') into n;
  r := r || jsonb_build_object('shift_owner_export_sessions', n);
  -- Append-only for the owner too: events, ledger, revisions, achievements can't be changed or removed.
  v_count := 0;
  update shift_events set flags = '{}' where user_id = s_owner;
  get diagnostics n = row_count; v_count := v_count + n;
  delete from shift_events where user_id = s_owner;
  get diagnostics n = row_count; v_count := v_count + n;
  update reward_ledger_entries set xp = 1000 where user_id = s_owner;
  get diagnostics n = row_count; v_count := v_count + n;
  delete from reward_ledger_entries where user_id = s_owner;
  get diagnostics n = row_count; v_count := v_count + n;
  update session_revisions set reason = 'rewritten' where user_id = s_owner;
  get diagnostics n = row_count; v_count := v_count + n;
  delete from session_revisions where user_id = s_owner;
  get diagnostics n = row_count; v_count := v_count + n;
  delete from user_achievements where user_id = s_owner;
  get diagnostics n = row_count; v_count := v_count + n;
  r := r || jsonb_build_object('shift_owner_append_only_changed', v_count);
  begin
    insert into reward_ledger_entries (user_id, organization_id, event_key, rule, xp, awarded_ms) values (s_owner, org_a, 'first_clock_in', 'again', 50, 1);
    r := r || jsonb_build_object('shift_ledger_duplicate_key', 'allowed');
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_con = constraint_name;
    r := r || jsonb_build_object('shift_ledger_duplicate_key', trim(v_state || ' ' || coalesce(v_con, '')));
  end;
  -- Purging C redacted its coordinates from the event log; A's are still there.
  select count(*) into n from shift_events
   where user_id = s_owner and session_id = (fx ->> 'C')::uuid and type = 'location' and payload -> 'fix' ->> 'latitude' is not null;
  r := r || jsonb_build_object('shift_purged_coordinates_left', n);
  select count(*) into n from shift_events
   where user_id = s_owner and session_id = (fx ->> 'A')::uuid and type = 'location' and payload -> 'fix' ->> 'latitude' is not null;
  r := r || jsonb_build_object('shift_kept_coordinates', n);
  -- M1: purged C's events are tombstones (id, type, sessionId, at); its title and notes are gone everywhere.
  select count(*) into n from shift_events
   where user_id = s_owner and session_id = (fx ->> 'C')::uuid and payload - 'id' - 'type' - 'sessionId' - 'at' <> '{}'::jsonb;
  r := r || jsonb_build_object('shift_purged_payload_keys_left', n);
  select count(*) into n from shift_events where user_id = s_owner and session_id = (fx ->> 'C')::uuid and 'purged' = any (flags);
  r := r || jsonb_build_object('shift_purged_events_tombstoned', n);
  select count(*) into n from shift_events
   where user_id = s_owner and (payload::text like '%Private note%' or payload::text like '%Secret client%' or payload::text like '%confidential%');
  r := r || jsonb_build_object('shift_purged_text_left', n);
  -- L1 + M3: deleting fix X of imported session I blanked X inside the import payload; Y still has coordinates.
  select count(*) filter (where l.loc ->> 'id' = fx ->> 'fixX' and l.loc ->> 'latitude' is null and l.loc ->> 'placeLabel' is null)
       + count(*) filter (where l.loc ->> 'id' = fx ->> 'fixY' and l.loc ->> 'latitude' is not null)
    into n
    from shift_events e, jsonb_array_elements(e.payload -> 'session' -> 'locations') l(loc)
   where e.user_id = s_owner and e.session_id = (fx ->> 'I')::uuid and e.type = 'import_session';
  r := r || jsonb_build_object('shift_import_fix_redacted', n);
  -- L3: size caps on documents the owner writes directly.
  begin
    update user_settings set settings = jsonb_build_object('pad', repeat('x', 70000)) where user_id = s_owner;
    r := r || jsonb_build_object('shift_settings_size', 'allowed');
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_con = constraint_name;
    r := r || jsonb_build_object('shift_settings_size', trim(v_state || ' ' || coalesce(v_con, '')));
  end;
  begin
    insert into shift_events (id, organization_id, user_id, type, happened_at, recorded_at, device_time_zone, payload)
    values (gen_random_uuid(), org_a, s_owner, 'annotate', now(), now(), 'UTC', jsonb_build_object('pad', repeat('x', 300000)));
    r := r || jsonb_build_object('shift_event_payload_size', 'allowed');
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_con = constraint_name;
    r := r || jsonb_build_object('shift_event_payload_size', trim(v_state || ' ' || coalesce(v_con, '')));
  end;
  reset role;

  -- Nobody else sees or changes any of it: another member, an admin of the same org, an outsider, a viewer.
  perform set_config('request.jwt.claims', json_build_object('sub', s_peer, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select ${OWNER_ROWS} into n;
  r := r || jsonb_build_object('shift_peer_sees', n);
  r := r || jsonb_build_object('shift_peer_state', load_shift_state());
  r := r || jsonb_build_object('shift_peer_session', load_shift_session((fx ->> 'A')::uuid));
  v_count := 0;
  update shift_sessions set title = 'hijacked' where user_id = s_owner;
  get diagnostics n = row_count; v_count := v_count + n;
  delete from shift_sessions where user_id = s_owner;
  get diagnostics n = row_count; v_count := v_count + n;
  delete from location_snapshots where user_id = s_owner;
  get diagnostics n = row_count; v_count := v_count + n;
  update work_projects set name = 'hijacked' where user_id = s_owner;
  get diagnostics n = row_count; v_count := v_count + n;
  v_count := v_count + delete_location_fixes((fx ->> 'A')::uuid) + redact_location_events(null, null);
  r := r || jsonb_build_object('shift_peer_changed', v_count);
  begin
    insert into shift_breaks (id, organization_id, user_id, session_id, started_at, ended_at)
    values (gen_random_uuid(), org_a, s_owner, (fx ->> 'A')::uuid, now(), null);
    r := r || jsonb_build_object('shift_peer_break_as_owner', 'allowed');
  exception when others then
    r := r || jsonb_build_object('shift_peer_break_as_owner', 'denied');
  end;
  begin
    insert into shift_breaks (id, organization_id, user_id, session_id, started_at, ended_at)
    values (gen_random_uuid(), org_a, s_peer, (fx ->> 'A')::uuid, now(), null);
    r := r || jsonb_build_object('shift_peer_break_into_owner_session', 'allowed');
  exception when others then
    r := r || jsonb_build_object('shift_peer_break_into_owner_session', 'denied');
  end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', admin_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select ${OWNER_ROWS} into n;
  r := r || jsonb_build_object('shift_admin_sees', n);
  select count(*) into n from audit_logs where entity_type in (${SHIFT_TABLES_SQL});
  r := r || jsonb_build_object('shift_admin_audit_rows', n);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', admin_b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select ${OWNER_ROWS} into n;
  r := r || jsonb_build_object('shift_outsider_sees', n);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', viewer_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select ${OWNER_ROWS} into n;
  r := r || jsonb_build_object('shift_viewer_sees', n);
  begin
    insert into work_projects (id, organization_id, user_id, name, color, updated_ms) values (gen_random_uuid(), org_a, viewer_a, 'Mine', 'sky', 1);
    r := r || jsonb_build_object('shift_viewer_insert', 'allowed');
  exception when others then
    r := r || jsonb_build_object('shift_viewer_insert', 'denied');
  end;
  reset role;
  set local role anon;
  begin
    perform load_shift_state();
    r := r || jsonb_build_object('shift_anon_load', 'allowed');
  exception when others then
    r := r || jsonb_build_object('shift_anon_load', 'denied');
  end;
  reset role;
  select ${OWNER_ROWS} into n;
  r := r || jsonb_build_object('shift_owner_rows_total', n);

  -- M2: demoted to viewer, the owner still sees, exports and deletes their own data, but can't add to it.
  update organization_members set role = 'viewer' where organization_id = org_a and profile_id = s_owner;
  perform set_config('request.jwt.claims', json_build_object('sub', s_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from jsonb_object_keys(load_shift_state() -> 'sessions');
  r := r || jsonb_build_object('shift_demoted_sessions', n);
  select jsonb_array_length(export_my_shift_data() -> 'sessions') into n;
  r := r || jsonb_build_object('shift_demoted_export_sessions', n);
  begin
    v_res := commit_shift_event(fx -> 'cases' -> 0 -> 'event', fx -> 'cases' -> 0 -> 'session', (fx -> 'cases' -> 0 ->> 'sessionId')::uuid, 0);
    r := r || jsonb_build_object('shift_demoted_commit', v_res ->> 'status');
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    r := r || jsonb_build_object('shift_demoted_commit', v_state);
  end;
  begin
    insert into work_projects (id, organization_id, user_id, name, color, updated_ms) values (gen_random_uuid(), org_a, s_owner, 'New', 'sky', 1);
    r := r || jsonb_build_object('shift_demoted_insert', 'allowed');
  exception when others then
    r := r || jsonb_build_object('shift_demoted_insert', 'denied');
  end;
  delete from saved_places where user_id = s_owner;
  get diagnostics n = row_count;
  r := r || jsonb_build_object('shift_demoted_deleted_places', n);
  -- M1 through a direct DELETE: B's events become tombstones too.
  delete from shift_sessions where id = (fx ->> 'B')::uuid;
  get diagnostics n = row_count;
  r := r || jsonb_build_object('shift_demoted_deleted_sessions', n);
  select count(*) into n from shift_events
   where user_id = s_owner and session_id = (fx ->> 'B')::uuid and (payload - 'id' - 'type' - 'sessionId' - 'at' <> '{}'::jsonb or not ('purged' = any (flags)));
  r := r || jsonb_build_object('shift_direct_delete_untombstoned', n);
  reset role;
  -- Deactivated: still sees their own data.
  update organization_members set role = 'member', deactivated_at = now() where organization_id = org_a and profile_id = s_owner;
  perform set_config('request.jwt.claims', json_build_object('sub', s_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from jsonb_object_keys(load_shift_state() -> 'sessions');
  r := r || jsonb_build_object('shift_deactivated_sessions', n);
  reset role;
  update organization_members set deactivated_at = null where organization_id = org_a and profile_id = s_owner;

  -- Instants: epoch ms survive timestamptz exactly (every ms of three seconds, both range ends, 200k random).
  select count(*) into n from (
    select ms from (values (946684800000::bigint), (4102444800000), (1761400000123), (1761400000999), (1761400000001)) v(ms)
    union all
    select b + o from unnest(array[946684800000::bigint, 1761400000000, 4102444799000]) b, generate_series(0, 999) o
    union all
    select (946684800000 + floor(random() * 3155760000000))::bigint from generate_series(1, 200000)
  ) x where timestamptz_to_ms(ms_to_timestamptz(x.ms)) <> x.ms;
  r := r || jsonb_build_object('shift_ms_roundtrip_mismatches', n);
  r := r || jsonb_build_object('shift_ms_exact_instant', ms_to_timestamptz(1761400000123) = '2025-10-25 13:46:40.123+00'::timestamptz);

  -- Privacy centre: delete every location point; the session's revision moves on; no coordinates stay in the log.
  perform set_config('request.jwt.claims', json_build_object('sub', s_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select revision into v_rev from shift_sessions where id = (fx ->> 'A')::uuid;
  r := r || jsonb_build_object('shift_location_fixes_deleted', delete_location_fixes());
  select count(*) into n from location_snapshots where user_id = s_owner;
  r := r || jsonb_build_object('shift_location_rows_left', n);
  select count(*) into n from shift_events e
   where e.user_id = s_owner
     and ((e.type = 'location' and e.payload -> 'fix' ->> 'latitude' is not null)
          or (e.type = 'import_session' and exists (
                select 1 from jsonb_array_elements(e.payload -> 'session' -> 'locations') l(loc) where l.loc ->> 'latitude' is not null)));
  r := r || jsonb_build_object('shift_location_coordinates_left', n);
  select revision - v_rev into n from shift_sessions where id = (fx ->> 'A')::uuid;
  r := r || jsonb_build_object('shift_location_delete_revision_step', n);

  -- Deleting the account removes every SHIFTY row of theirs (cascade from profiles).
  perform delete_own_account('shift-owner-' || s_owner || '@example.test');
  reset role;
  select ${OWNER_ROWS} into n;
  r := r || jsonb_build_object('shift_account_rows_left', n);

  -- ── Account deletion (runs last: it removes member_a) ─────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', member_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform delete_own_account('wrong@example.test');
    r := r || jsonb_build_object('account_wrong_email', 'allowed');
  exception when others then
    r := r || jsonb_build_object('account_wrong_email', 'denied');
  end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', admin_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from account_deletion_preview() where outcome = 'blocked';
  r := r || jsonb_build_object('account_last_admin_preview', n);
  begin
    perform delete_own_account('rls-' || admin_a || '@example.test');
    r := r || jsonb_build_object('account_last_admin', 'allowed');
  exception when others then
    r := r || jsonb_build_object('account_last_admin', 'denied');
  end;
  reset role;
  -- A member deletes their account (email typed in capitals): gone, what they wrote stays without their name.
  perform set_config('request.jwt.claims', json_build_object('sub', member_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform delete_own_account(upper('rls-' || member_a || '@example.test'));
  reset role;
  select count(*) into n from auth.users where id = member_a;
  r := r || jsonb_build_object('account_user_left', n);
  select count(*) into n from organization_members where profile_id = member_a;
  r := r || jsonb_build_object('account_memberships_left', n);
  select count(*) into n from audit_logs where actor_id = member_a;
  r := r || jsonb_build_object('account_audit_named', n);
  -- Alone in a workspace: it goes with them.
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
    ('00000000-0000-0000-0000-000000000000', solo_u, 'authenticated', 'authenticated', 'solo-' || solo_u || '@example.test', '', now(), now(), now());
  insert into organizations (id, name, slug) values (solo_org, 'Solo', 'solo-' || left(solo_org::text, 8));
  insert into organization_members (organization_id, profile_id, role) values (solo_org, solo_u, 'admin');
  perform set_config('request.jwt.claims', json_build_object('sub', solo_u, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from account_deletion_preview() where outcome = 'deleted';
  r := r || jsonb_build_object('account_solo_preview', n);
  perform delete_own_account('solo-' || solo_u || '@example.test');
  reset role;
  select count(*) into n from organizations where id = solo_org;
  r := r || jsonb_build_object('account_solo_workspace_left', n);
  set local role anon;
  begin
    perform delete_own_account('anyone@example.test');
    r := r || jsonb_build_object('account_anon', 'allowed');
  exception when others then
    r := r || jsonb_build_object('account_anon', 'denied');
  end;
  reset role;

  raise exception 'RLS_CHECK_RESULT %', r;
end
$check$;`;

const EXPECTATIONS: [string, (v: unknown) => boolean][] = [
  ["outsider_organizations", (v) => v === 0],
  ["outsider_members", (v) => v === 0],
  ["outsider_audit", (v) => v === 0],
  ["outsider_directory", (v) => v === 0],
  ["outsider_org_updated", (v) => v === 0],
  ["outsider_join", (v) => v === "denied"],
  ["member_invites", (v) => v === 0],
  ["member_directory_emails", (v) => v === 0],
  ["member_audit", (v) => v === 0],
  ["member_invite_insert", (v) => v === "denied"],
  ["member_self_promote", (v) => v === 0],
  ["admin_directory_emails", (v) => v === 3],
  ["invite_claimed", (v) => v === "manager"],
  ["invite_claimed_again", (v) => v === "none"],
  ["invitee_sees_org", (v) => v === 1],
  ["deactivated_sees_org", (v) => v === 0],
  ["deactivated_can_manage", (v) => v === false],
  ["last_admin_demote", (v) => v === "denied"],
  ["bootstrap_other_email", (v) => v === "none"],
  ["bootstrap_unconfirmed", (v) => v === "none"],
  ["bootstrap_configured", (v) => v === "admin"],
  ["bootstrap_second_time", (v) => v === "none"],
  ["account_wrong_email", (v) => v === "denied"],
  ["account_last_admin_preview", (v) => v === 1],
  ["account_last_admin", (v) => v === "denied"],
  ["account_user_left", (v) => v === 0],
  ["account_memberships_left", (v) => v === 0],
  ["account_audit_named", (v) => v === 0],
  ["account_solo_preview", (v) => v === 1],
  ["account_solo_workspace_left", (v) => v === 0],
  ["account_anon", (v) => v === "denied"],
];

const is = (expected: unknown) => (v: unknown) => v === expected;
/** SHIFTY: each commit_shift_event case → "<SQLSTATE> <constraint>" (or the returned status). */
const SHIFT_EXPECTATIONS: [string, (v: unknown) => boolean][] = [
  ["shift_steps_error", is(undefined)],
  ["shift_case_duplicate", is("duplicate")],
  ["shift_case_second_active", is("23505 shift_sessions_one_active_idx")],
  ["shift_active_message_names_index", is(true)],
  ["shift_case_break_overlap", is("23P01 shift_breaks_no_overlap")],
  ["shift_case_break_outside", is("23514 shift_breaks_within_session")],
  ["shift_case_open_break_finished", is("23514 shift_breaks_within_session")],
  ["shift_case_chronology", is("23514 shift_sessions_chronology")],
  ["shift_case_stale_revision", is("40001")],
  ["shift_case_captured_without_coordinates", is("23514 location_snapshots_coordinates")],
  ["shift_case_foreign_project", is("23503 shift_sessions_project_fk")],
  ["shift_case_not_found", is("P0002")],
  ["shift_case_peer_update", is("P0002")],
  ["shift_case_admin_update", is("P0002")],
  ["shift_case_outsider_update", is("P0002")],
  ["shift_case_viewer_commit", is("42501")],
  ["shift_case_foreign_event_id", is("23505 shift_events_pkey")],
  ["shift_purged_payload_keys_left", is(0)],
  ["shift_purged_events_tombstoned", is(4)],
  ["shift_purged_text_left", is(0)],
  ["shift_import_fix_redacted", is(2)],
  ["shift_settings_size", is("23514 user_settings_settings_size")],
  ["shift_event_payload_size", is("23514 shift_events_payload_size")],
  ["shift_demoted_sessions", is(4)],
  ["shift_demoted_export_sessions", is(4)],
  ["shift_demoted_commit", is("42501")],
  ["shift_demoted_insert", is("denied")],
  ["shift_demoted_deleted_places", is(1)],
  ["shift_demoted_deleted_sessions", is(1)],
  ["shift_direct_delete_untombstoned", is(0)],
  ["shift_deactivated_sessions", is(3)],
  ["shift_owner_append_only_changed", is(0)],
  ["shift_ledger_duplicate_key", is("23505 reward_ledger_entries_user_key")],
  ["shift_purged_coordinates_left", is(0)],
  ["shift_kept_coordinates", is(1)],
  ["shift_owner_export_sessions", is(4)],
  ["shift_peer_sees", is(0)],
  ["shift_peer_state", (v) => isDeepStrictEqual(v, { sessions: {} })],
  ["shift_peer_session", is(null)],
  ["shift_peer_changed", is(0)],
  ["shift_peer_break_as_owner", is("denied")],
  ["shift_peer_break_into_owner_session", is("denied")],
  ["shift_admin_sees", is(0)],
  ["shift_admin_audit_rows", is(0)],
  ["shift_outsider_sees", is(0)],
  ["shift_viewer_sees", is(0)],
  ["shift_viewer_insert", is("denied")],
  ["shift_anon_load", is("denied")],
  ["shift_ms_roundtrip_mismatches", is(0)],
  ["shift_ms_exact_instant", is(true)],
  ["shift_location_fixes_deleted", is(2)],
  ["shift_location_rows_left", is(0)],
  ["shift_location_coordinates_left", is(0)],
  ["shift_location_delete_revision_step", is(1)],
  ["shift_account_rows_left", is(0)],
];

/** Only when the app uses SaaS tenancy (create_organization() installed). */
const SAAS_EXPECTATIONS: [string, (v: unknown) => boolean][] = [
  ["saas_unconfirmed", (v) => v === "denied"],
  ["saas_created", (v) => v === 1],
  ["saas_creator_admin", (v) => v === 1],
  ["saas_sees_others", (v) => v === 0],
  ["saas_workspace_cap", (v) => v === 5],
  ["saas_outsider_sees", (v) => v === 0],
  ["saas_anon", (v) => v === "denied"],
];

/** Keys whose values are large documents: compared below, not printed. */
const DOCUMENT_KEYS = new Set(["shift_loaded_state", "shift_loaded_profile", "shift_peer_state"]);

async function main() {
  const fixture = shiftFixture();
  let results: Record<string, unknown> | null = null;
  try {
    await sql(checkSql(fixture.sql));
  } catch (error) {
    const match = (error as Error).message.match(/RLS_CHECK_RESULT (\{[^\n]*\})/);
    if (!match) throw error;
    results = JSON.parse(match[1]) as Record<string, unknown>;
  }
  if (!results) throw new Error("The check block did not report results.");
  const data = results;
  const expectations: [string, (v: unknown) => boolean][] = [
    ...EXPECTATIONS,
    ...(data.saas_enabled ? SAAS_EXPECTATIONS : []),
    ...SHIFT_EXPECTATIONS,
    ["shift_steps_applied", is(fixture.sql.steps.length)],
    ["shift_owner_events", is(fixture.sql.steps.length)],
    ["shift_owner_sees", (v) => typeof v === "number" && v > 20 && v === data.shift_owner_rows_total],
    // load_shift_state() returns exactly the reducer's ShiftState (trash included, purged session absent).
    ["shift_loaded_state", (v) => isDeepStrictEqual(v, JSON.parse(JSON.stringify(fixture.expectedState)))],
    ["shift_loaded_profile", (v) => isDeepStrictEqual(v, JSON.parse(JSON.stringify(fixture.expectedProfile)))],
  ];
  let failed = 0;
  for (const [key, ok] of expectations) {
    const pass = ok(results[key]);
    if (!pass) failed++;
    const shown = DOCUMENT_KEYS.has(key) && pass ? "(deep-equal to the expected document)" : JSON.stringify(results[key]);
    console.log(`${pass ? "PASS" : "FAIL"}  ${key} = ${shown}`);
    if (!pass && (key === "shift_loaded_state" || key === "shift_loaded_profile")) console.log(`      expected ${JSON.stringify(key === "shift_loaded_profile" ? fixture.expectedProfile : fixture.expectedState)}`);
  }
  if (failed) {
    console.error(`${failed} RLS check(s) failed.`);
    process.exit(1);
  }
  console.log(`Organization isolation and role rules hold (${expectations.length} checks${data.saas_enabled ? ", incl. SaaS workspaces" : ""}, incl. SHIFTY).`);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
