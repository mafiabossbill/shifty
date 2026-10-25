-- SHIFTY per-person documents that are not sessions (src/lib/shifts/profile.ts): settings, projects,
-- remembered places, companion, reward ledger, achievements, activities.
-- Every row belongs to ONE person (user_id) inside their organization; RLS shows it to that person only
-- (admins included: nobody sees anyone else's tracking). Version stamps from the device (`updatedAt`,
-- `at`, `earnedAt`) are kept as epoch-millisecond bigints (*_ms): they are last-write-wins markers and
-- ledger keys, not reporting instants. No audit_logs trigger on purpose: audit_logs is readable by
-- `audit:view` (admins), which would leak private tracking data (docs/SCHEMA.md).

-- ─── Projects ─────────────────────────────────────────────────────────────────
create table work_projects (
  id              uuid primary key,
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id         uuid not null references profiles (id) on delete cascade,
  name            text not null check (char_length(trim(name)) between 1 and 60),
  color           text not null check (color in ('lilac', 'indigo', 'teal', 'sage', 'peach', 'rose', 'sky', 'sand')),
  archived        boolean not null default false,
  updated_ms      bigint not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Target of the composite FK from shift_sessions: a session can only name its owner's project.
  constraint work_projects_owner_key unique (organization_id, user_id, id)
);
create index work_projects_user_idx on work_projects (user_id, archived, name);
create trigger work_projects_set_updated_at before update on work_projects
  for each row execute function set_updated_at();

-- ─── Remembered places (labels matched on the device by distance; no geocoding) ─
create table saved_places (
  id              uuid primary key,
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id         uuid not null references profiles (id) on delete cascade,
  label           text not null check (char_length(trim(label)) between 1 and 40),
  latitude        double precision not null check (latitude between -90 and 90),
  longitude       double precision not null check (longitude between -180 and 180),
  radius_m        integer not null check (radius_m between 25 and 5000),
  updated_ms      bigint not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index saved_places_user_idx on saved_places (user_id, label);
create trigger saved_places_set_updated_at before update on saved_places
  for each row execute function set_updated_at();

-- ─── Settings and companion: one JSON document per person (validated by Zod in the API) ─
create table user_settings (
  user_id         uuid primary key references profiles (id) on delete cascade,
  organization_id uuid not null references organizations (id) on delete cascade,
  settings        jsonb not null check (jsonb_typeof(settings) = 'object'),
  updated_ms      bigint not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger user_settings_set_updated_at before update on user_settings
  for each row execute function set_updated_at();

create table companion_states (
  user_id         uuid primary key references profiles (id) on delete cascade,
  organization_id uuid not null references organizations (id) on delete cascade,
  state           jsonb not null check (jsonb_typeof(state) = 'object'),
  updated_ms      bigint not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger companion_states_set_updated_at before update on companion_states
  for each row execute function set_updated_at();

-- ─── Reward ledger: append-only, one row per (person, event key) so replays can't farm XP ─
-- source_session_id has no FK on purpose: a purged session keeps its ledger history (reversals are new rows).
create table reward_ledger_entries (
  user_id           uuid not null references profiles (id) on delete cascade,
  organization_id   uuid not null references organizations (id) on delete cascade,
  event_key         text not null check (char_length(event_key) between 1 and 160),
  rule              text not null check (char_length(rule) <= 40),
  xp                integer not null check (xp between -1000 and 1000),
  source_session_id uuid,
  awarded_ms        bigint not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint reward_ledger_entries_user_key unique (user_id, event_key)
);
create index reward_ledger_entries_user_awarded_idx on reward_ledger_entries (user_id, awarded_ms);
create trigger reward_ledger_entries_set_updated_at before update on reward_ledger_entries
  for each row execute function set_updated_at();

-- ─── Achievements: earned once, never taken away (A07) ────────────────────────
create table user_achievements (
  user_id           uuid not null references profiles (id) on delete cascade,
  organization_id   uuid not null references organizations (id) on delete cascade,
  code              text not null check (char_length(code) between 1 and 40),
  earned_ms         bigint not null,
  source_session_id uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (user_id, code)
);
create trigger user_achievements_set_updated_at before update on user_achievements
  for each row execute function set_updated_at();

-- ─── Activities rewards recognise (weekly reviews, exports, streak freezes) ──
create table activities (
  user_id         uuid not null references profiles (id) on delete cascade,
  organization_id uuid not null references organizations (id) on delete cascade,
  id              text not null check (char_length(id) between 1 and 80),
  type            text not null check (type in ('week_review', 'export', 'streak_freeze_used')),
  key             text not null check (char_length(key) <= 40),
  at_ms           bigint not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (user_id, id)
);
create index activities_user_at_idx on activities (user_id, at_ms desc);
create trigger activities_set_updated_at before update on activities
  for each row execute function set_updated_at();

-- ─── Row-level security: own rows only, and only while holding shift:track ──
alter table work_projects enable row level security;
alter table saved_places enable row level security;
alter table user_settings enable row level security;
alter table companion_states enable row level security;
alter table reward_ledger_entries enable row level security;
alter table user_achievements enable row level security;
alter table activities enable row level security;

-- Editable documents: select / insert / update / delete.
create policy work_projects_select on work_projects for select to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
create policy work_projects_insert on work_projects for insert to authenticated
  with check (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
create policy work_projects_update on work_projects for update to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'))
  with check (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
create policy work_projects_delete on work_projects for delete to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));

create policy saved_places_select on saved_places for select to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
create policy saved_places_insert on saved_places for insert to authenticated
  with check (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
create policy saved_places_update on saved_places for update to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'))
  with check (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
create policy saved_places_delete on saved_places for delete to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));

create policy user_settings_select on user_settings for select to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
create policy user_settings_insert on user_settings for insert to authenticated
  with check (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
create policy user_settings_update on user_settings for update to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'))
  with check (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
create policy user_settings_delete on user_settings for delete to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));

create policy companion_states_select on companion_states for select to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
create policy companion_states_insert on companion_states for insert to authenticated
  with check (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
create policy companion_states_update on companion_states for update to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'))
  with check (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
create policy companion_states_delete on companion_states for delete to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));

create policy activities_select on activities for select to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
create policy activities_insert on activities for insert to authenticated
  with check (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
create policy activities_update on activities for update to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'))
  with check (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
create policy activities_delete on activities for delete to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));

-- Append-only for the person: select + insert. No update/delete policy (rows go only with the account).
create policy reward_ledger_entries_select on reward_ledger_entries for select to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
create policy reward_ledger_entries_insert on reward_ledger_entries for insert to authenticated
  with check (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));

create policy user_achievements_select on user_achievements for select to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
create policy user_achievements_insert on user_achievements for insert to authenticated
  with check (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
