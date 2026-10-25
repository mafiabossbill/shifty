-- SHIFTY sessions (src/lib/shifts/types.ts): the canonical entity is a continuous work SESSION; calendar
-- days are derived in code. Children (breaks, location snapshots, revisions) belong to one session of one
-- person through a composite FK, so a row can never cross people or organizations. shift_events is the
-- append-only, idempotent log of device events (id = the device-generated event id).
--
-- Instants: epoch milliseconds in TypeScript, timestamptz here (µs precision, so ms round-trip exactly):
--   ms → ts   ms_to_timestamptz(ms)  = to_timestamp(ms::double precision / 1000)
--   ts → ms   timestamptz_to_ms(ts)  = (extract(epoch from ts) * 1000)::bigint
-- Exactness is proven by scripts/check-rls.ts (shift_ms_roundtrip_mismatches = 0).
--
-- Rules enforced here (docs/SCHEMA.md):
--   · one running session per person          shift_sessions_one_active_idx  (23505)
--   · end after start; goal 1 min … 48 h      CHECKs                         (23514)
--   · breaks of a session never overlap       shift_breaks_no_overlap        (23P01, deferrable)
--   · breaks lie inside their session, at most one open break and only while the session is open
--                                             shift_breaks_within_session / shift_sessions_breaks_within (23514, deferrable)
--   · captured location ⇔ coordinates         location_snapshots CHECK       (23514)
-- Sessions of one person MAY overlap: the reducer allows an explicit, confirmed overlap (allowOverlap),
-- so cross-session overlap is guarded in the domain layer only.
-- No audit_logs trigger (admins read audit_logs; tracking is private). History lives in
-- session_revisions and shift_events, visible to the owner only.

create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

-- ─── Instant conversion (epoch ms ↔ timestamptz) ──────────────────────────────
create or replace function ms_to_timestamptz(ms bigint) returns timestamptz
language sql immutable strict parallel safe as $$
  select to_timestamp(ms::double precision / 1000);
$$;

-- stable, not immutable: extract() on timestamptz is marked stable (epoch itself is zone-independent).
create or replace function timestamptz_to_ms(ts timestamptz) returns bigint
language sql stable strict parallel safe as $$
  select (extract(epoch from ts) * 1000)::bigint;
$$;

-- ─── Closed sets ──────────────────────────────────────────────────────────────
create type shift_origin as enum ('timer', 'manual');
create type shift_break_kind as enum ('rest', 'meal', 'other');
create type location_event_kind as enum ('clock_in', 'clock_out', 'retry');
create type location_status as enum ('captured', 'denied', 'unavailable', 'timeout', 'unsupported', 'off', 'insecure');

-- ─── Sessions ─────────────────────────────────────────────────────────────────
create table shift_sessions (
  id                  uuid primary key,
  organization_id     uuid not null references organizations (id) on delete cascade,
  user_id             uuid not null references profiles (id) on delete cascade,
  -- Immutable after insert (shift_sessions_guard_immutable): the creating event and the start it recorded.
  origin_event_id     uuid not null,
  original_started_at timestamptz not null,
  started_at          timestamptz not null,
  ended_at            timestamptz,
  origin              shift_origin not null,
  reporting_time_zone text not null check (char_length(reporting_time_zone) between 1 and 64),
  start_time_zone     text not null check (char_length(start_time_zone) between 1 and 64),
  end_time_zone       text check (end_time_zone is null or char_length(end_time_zone) between 1 and 64),
  goal_seconds        integer not null check (goal_seconds between 60 and 172800),
  title               text not null default '' check (char_length(title) <= 120),
  notes               text not null default '' check (char_length(notes) <= 4000),
  project_id          uuid,
  tags                text[] not null default '{}' check (cardinality(tags) <= 12 and array_position(tags, null) is null),
  pay_rate_minor      bigint check (pay_rate_minor >= 0),
  currency            char(3) check (currency ~ '^[A-Z]{3}$'),
  mood                smallint check (mood between 1 and 5),
  energy              smallint check (energy between 1 and 5),
  flags               text[] not null default '{}'
                      check (flags <@ array['device_clock_ahead', 'device_clock_behind', 'timezone_changed']::text[]),
  archived_at         timestamptz,
  deleted_at          timestamptz,
  -- Optimistic concurrency: +1 per applied event; commit_shift_event updates only the expected revision.
  revision            integer not null check (revision >= 1),
  -- The domain's createdAt / updatedAt (device-recorded event times), distinct from the row timestamps.
  client_created_at   timestamptz not null,
  client_updated_at   timestamptz not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint shift_sessions_chronology check (ended_at is null or ended_at > started_at),
  constraint shift_sessions_owner_key unique (organization_id, user_id, id),
  -- A session names only its owner's project; deleting the project clears just project_id.
  constraint shift_sessions_project_fk foreign key (organization_id, user_id, project_id)
    references work_projects (organization_id, user_id, id) on delete set null (project_id)
);
-- One running session per person (deleted sessions in the trash don't count).
create unique index shift_sessions_one_active_idx on shift_sessions (user_id) where ended_at is null and deleted_at is null;
-- History / timeline (newest first), trash, project filter.
create index shift_sessions_user_started_idx on shift_sessions (user_id, started_at desc);
create index shift_sessions_user_deleted_idx on shift_sessions (user_id, deleted_at) where deleted_at is not null;
create index shift_sessions_project_idx on shift_sessions (organization_id, user_id, project_id) where project_id is not null;
create trigger shift_sessions_set_updated_at before update on shift_sessions
  for each row execute function set_updated_at();

create or replace function private.guard_shift_session_immutable() returns trigger
language plpgsql as $$
begin
  if new.id is distinct from old.id
     or new.organization_id is distinct from old.organization_id
     or new.user_id is distinct from old.user_id
     or new.origin_event_id is distinct from old.origin_event_id
     or new.original_started_at is distinct from old.original_started_at
     or new.origin is distinct from old.origin
     or new.client_created_at is distinct from old.client_created_at then
    raise exception 'A session''s owner, origin and original start never change.'
      using errcode = 'check_violation', constraint = 'shift_sessions_immutable';
  end if;
  return new;
end;
$$;
create trigger shift_sessions_guard_immutable before update on shift_sessions
  for each row execute function private.guard_shift_session_immutable();

-- ─── Breaks ───────────────────────────────────────────────────────────────────
create table shift_breaks (
  id              uuid primary key,
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id         uuid not null references profiles (id) on delete cascade,
  session_id      uuid not null,
  started_at      timestamptz not null,
  ended_at        timestamptz,
  kind            shift_break_kind not null default 'rest',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint shift_breaks_chronology check (ended_at is null or ended_at > started_at),
  constraint shift_breaks_session_fk foreign key (organization_id, user_id, session_id)
    references shift_sessions (organization_id, user_id, id) on delete cascade,
  -- Half-open [start, end): a break may start exactly when the previous one ended. An open break runs to infinity,
  -- so it is necessarily the latest one. Deferrable so one correction can move several breaks.
  constraint shift_breaks_no_overlap exclude using gist (
    session_id with =,
    tstzrange(started_at, coalesce(ended_at, 'infinity'::timestamptz), '[)') with &&
  ) deferrable initially immediate
);
create index shift_breaks_session_idx on shift_breaks (session_id, started_at);
create index shift_breaks_user_idx on shift_breaks (user_id);
create trigger shift_breaks_set_updated_at before update on shift_breaks
  for each row execute function set_updated_at();

-- Every break inside its session [started_at, coalesce(ended_at, infinity)); at most one open break, and only
-- while the session is open. Runs as a deferrable constraint trigger from both sides (break written, session
-- times corrected) and re-reads the current rows, so the order of writes inside one commit doesn't matter.
create or replace function private.check_session_breaks() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  sid       uuid;
  s_start   timestamptz;
  s_end     timestamptz;
  open_n    int;
begin
  -- (an IF, not CASE: PL/pgSQL resolves every field reference of a CASE against NEW)
  if tg_table_name = 'shift_sessions' then
    sid := new.id;
  else
    sid := new.session_id;
  end if;
  select started_at, ended_at into s_start, s_end from public.shift_sessions where id = sid;
  if not found then
    return null; -- the session went in the same transaction (purge): its breaks went with it
  end if;
  if exists (
    select 1 from public.shift_breaks b
     where b.session_id = sid
       and (b.started_at < s_start
            or (s_end is not null and (b.ended_at is null or b.ended_at > s_end)))
  ) then
    raise exception 'A break must lie inside its session, and a finished session can''t have a running break.'
      using errcode = 'check_violation', constraint = 'shift_breaks_within_session';
  end if;
  select count(*) into open_n from public.shift_breaks b where b.session_id = sid and b.ended_at is null;
  if open_n > 1 then
    raise exception 'Only one break can be running.'
      using errcode = 'check_violation', constraint = 'shift_breaks_within_session';
  end if;
  return null;
end;
$$;
create constraint trigger shift_breaks_within_session
  after insert or update on shift_breaks
  deferrable initially immediate
  for each row execute function private.check_session_breaks();
create constraint trigger shift_sessions_breaks_within
  after update of started_at, ended_at on shift_sessions
  deferrable initially immediate
  for each row execute function private.check_session_breaks();

-- ─── Point-in-time location snapshots (never continuous tracking; never made up) ─
create table location_snapshots (
  id              uuid primary key,
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id         uuid not null references profiles (id) on delete cascade,
  session_id      uuid not null,
  event           location_event_kind not null,
  status          location_status not null,
  requested_at    timestamptz not null,
  captured_at     timestamptz,
  latitude        double precision check (latitude between -90 and 90),
  longitude       double precision check (longitude between -180 and 180),
  accuracy_m      double precision check (accuracy_m >= 0),
  place_label     text check (char_length(place_label) <= 80),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Only a captured fix carries coordinates, and a captured fix always does.
  constraint location_snapshots_coordinates check (
    case when status = 'captured' then latitude is not null and longitude is not null
         else latitude is null and longitude is null end
  ),
  constraint location_snapshots_session_fk foreign key (organization_id, user_id, session_id)
    references shift_sessions (organization_id, user_id, id) on delete cascade
);
create index location_snapshots_session_idx on location_snapshots (session_id, requested_at);
create index location_snapshots_user_idx on location_snapshots (user_id, requested_at desc);
create trigger location_snapshots_set_updated_at before update on location_snapshots
  for each row execute function set_updated_at();

-- ─── Corrections (append-only audit of time edits, owner-visible) ─────────────
create table session_revisions (
  id              uuid primary key, -- = the correcting event's id
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id         uuid not null references profiles (id) on delete cascade,
  session_id      uuid not null,
  edited_at       timestamptz not null,
  reason          text not null check (char_length(trim(reason)) between 3 and 500),
  previous        jsonb not null check (jsonb_typeof(previous) = 'object'),
  updated         jsonb not null check (jsonb_typeof(updated) = 'object'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint session_revisions_session_fk foreign key (organization_id, user_id, session_id)
    references shift_sessions (organization_id, user_id, id) on delete cascade
);
create index session_revisions_session_idx on session_revisions (session_id, edited_at);
create index session_revisions_user_idx on session_revisions (user_id);
create trigger session_revisions_set_updated_at before update on session_revisions
  for each row execute function set_updated_at();

-- ─── Event log (append-only; idempotency key = device event id) ───────────────
-- session_id has no FK on purpose: a purged session keeps its events (location coordinates in them are
-- redacted on purge / fix deletion, see redact_location_events()).
create table shift_events (
  id               uuid primary key,
  organization_id  uuid not null references organizations (id) on delete cascade,
  user_id          uuid not null references profiles (id) on delete cascade,
  session_id       uuid,
  type             text not null check (type in (
                     'clock_in', 'break_start', 'break_end', 'clock_out', 'location', 'location_delete',
                     'annotate', 'correct', 'manual_create', 'rezone', 'delete', 'restore', 'purge')),
  happened_at      timestamptz not null, -- event.at
  recorded_at      timestamptz not null, -- event.recordedAt
  received_at      timestamptz not null default now(),
  device_time_zone text not null check (char_length(device_time_zone) between 1 and 64),
  payload          jsonb not null check (jsonb_typeof(payload) = 'object'),
  flags            text[] not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index shift_events_user_recorded_idx on shift_events (user_id, recorded_at desc);
create index shift_events_session_idx on shift_events (session_id, recorded_at) where session_id is not null;
create trigger shift_events_set_updated_at before update on shift_events
  for each row execute function set_updated_at();

-- ─── Row-level security: own rows only, and only while holding shift:track ──
alter table shift_sessions enable row level security;
alter table shift_breaks enable row level security;
alter table location_snapshots enable row level security;
alter table session_revisions enable row level security;
alter table shift_events enable row level security;

create policy shift_sessions_select on shift_sessions for select to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
create policy shift_sessions_insert on shift_sessions for insert to authenticated
  with check (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
create policy shift_sessions_update on shift_sessions for update to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'))
  with check (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
create policy shift_sessions_delete on shift_sessions for delete to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));

create policy shift_breaks_select on shift_breaks for select to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
create policy shift_breaks_insert on shift_breaks for insert to authenticated
  with check (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
create policy shift_breaks_update on shift_breaks for update to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'))
  with check (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
create policy shift_breaks_delete on shift_breaks for delete to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));

create policy location_snapshots_select on location_snapshots for select to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
create policy location_snapshots_insert on location_snapshots for insert to authenticated
  with check (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
create policy location_snapshots_update on location_snapshots for update to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'))
  with check (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
create policy location_snapshots_delete on location_snapshots for delete to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));

-- Append-only for the person: select + insert (rows go with their session or account).
create policy session_revisions_select on session_revisions for select to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
create policy session_revisions_insert on session_revisions for insert to authenticated
  with check (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));

create policy shift_events_select on shift_events for select to authenticated
  using (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
create policy shift_events_insert on shift_events for insert to authenticated
  with check (user_id = (select auth.uid()) and organization_id in (select my_organization_ids()) and has_capability(organization_id, 'shift:track'));
