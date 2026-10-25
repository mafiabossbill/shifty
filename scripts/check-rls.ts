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
 * account deletion last (it removes fixture users).
 * Add a section for every new table: an outsider sees and changes nothing, each role
 * can do exactly what src/lib/permissions.ts says.
 */
import { sql } from "./sql";

const CHECK = `
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

async function main() {
  let results: Record<string, unknown> | null = null;
  try {
    await sql(CHECK);
  } catch (error) {
    const match = (error as Error).message.match(/RLS_CHECK_RESULT (\{[^\n]*\})/);
    if (!match) throw error;
    results = JSON.parse(match[1]) as Record<string, unknown>;
  }
  if (!results) throw new Error("The check block did not report results.");
  const expectations = results.saas_enabled ? [...EXPECTATIONS, ...SAAS_EXPECTATIONS] : EXPECTATIONS;
  let failed = 0;
  for (const [key, ok] of expectations) {
    const pass = ok(results[key]);
    if (!pass) failed++;
    console.log(`${pass ? "PASS" : "FAIL"}  ${key} = ${JSON.stringify(results[key])}`);
  }
  if (failed) {
    console.error(`${failed} RLS check(s) failed.`);
    process.exit(1);
  }
  console.log(`Organization isolation and role rules hold (${expectations.length} checks${results.saas_enabled ? ", incl. SaaS workspaces" : ""}).`);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
