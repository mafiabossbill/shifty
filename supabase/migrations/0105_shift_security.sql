-- SHIFTY security review fixes (M1, M2, M3, L1, L2, L3, L7). 0100–0104 are shipped to the lane: never edited.
--
-- M1  Deleting a session (purge via commit_shift_event, or a direct DELETE) turns its events into tombstones:
--     payload keeps only id, type, sessionId, at; flag 'purged'. Titles, notes, tags, pay, mood, times and
--     locations don't survive "delete forever". Trigger shift_sessions_tombstone_events.
-- M2  SELECT and DELETE need only ownership (user_id = auth.uid()): someone demoted or deactivated still sees,
--     exports and deletes their own data. INSERT / UPDATE (and commit_shift_event) still require the org and
--     shift:track. Append-only tables keep no DELETE policy.
-- M3  Fix ids are compared as uuid in redaction.
-- L1  shift_events.type accepts 'import_session'; redaction blanks payload.session.locations[] coordinates too.
-- L2  commit_shift_event: an event id stored by someone else is 23505 shift_events_pkey, never 'duplicate'.
-- L3  Size caps on owner-written jsonb/text: settings and companion state ≤ 64 kB, event payload ≤ 256 kB,
--     revision snapshots ≤ 64 kB, event flags ≤ 16 (session title ≤ 120 / notes ≤ 4000 exist since 0102).
-- L7  redact_location_events runs with search_path = '' and schema-qualified names.

-- ─── M2: ownership is enough to read and delete one's own rows ────────────────
drop policy shift_sessions_select on shift_sessions;
create policy shift_sessions_select on shift_sessions for select to authenticated
  using (user_id = (select auth.uid()));
drop policy shift_sessions_delete on shift_sessions;
create policy shift_sessions_delete on shift_sessions for delete to authenticated
  using (user_id = (select auth.uid()));
drop policy shift_breaks_select on shift_breaks;
create policy shift_breaks_select on shift_breaks for select to authenticated
  using (user_id = (select auth.uid()));
drop policy shift_breaks_delete on shift_breaks;
create policy shift_breaks_delete on shift_breaks for delete to authenticated
  using (user_id = (select auth.uid()));
drop policy location_snapshots_select on location_snapshots;
create policy location_snapshots_select on location_snapshots for select to authenticated
  using (user_id = (select auth.uid()));
drop policy location_snapshots_delete on location_snapshots;
create policy location_snapshots_delete on location_snapshots for delete to authenticated
  using (user_id = (select auth.uid()));
drop policy session_revisions_select on session_revisions;
create policy session_revisions_select on session_revisions for select to authenticated
  using (user_id = (select auth.uid()));
drop policy shift_events_select on shift_events;
create policy shift_events_select on shift_events for select to authenticated
  using (user_id = (select auth.uid()));
drop policy work_projects_select on work_projects;
create policy work_projects_select on work_projects for select to authenticated
  using (user_id = (select auth.uid()));
drop policy work_projects_delete on work_projects;
create policy work_projects_delete on work_projects for delete to authenticated
  using (user_id = (select auth.uid()));
drop policy saved_places_select on saved_places;
create policy saved_places_select on saved_places for select to authenticated
  using (user_id = (select auth.uid()));
drop policy saved_places_delete on saved_places;
create policy saved_places_delete on saved_places for delete to authenticated
  using (user_id = (select auth.uid()));
drop policy user_settings_select on user_settings;
create policy user_settings_select on user_settings for select to authenticated
  using (user_id = (select auth.uid()));
drop policy user_settings_delete on user_settings;
create policy user_settings_delete on user_settings for delete to authenticated
  using (user_id = (select auth.uid()));
drop policy companion_states_select on companion_states;
create policy companion_states_select on companion_states for select to authenticated
  using (user_id = (select auth.uid()));
drop policy companion_states_delete on companion_states;
create policy companion_states_delete on companion_states for delete to authenticated
  using (user_id = (select auth.uid()));
drop policy reward_ledger_entries_select on reward_ledger_entries;
create policy reward_ledger_entries_select on reward_ledger_entries for select to authenticated
  using (user_id = (select auth.uid()));
drop policy user_achievements_select on user_achievements;
create policy user_achievements_select on user_achievements for select to authenticated
  using (user_id = (select auth.uid()));
drop policy activities_select on activities;
create policy activities_select on activities for select to authenticated
  using (user_id = (select auth.uid()));
drop policy activities_delete on activities;
create policy activities_delete on activities for delete to authenticated
  using (user_id = (select auth.uid()));

-- ─── L1: imported sessions are a known event type ─────────────────────────────
alter table shift_events drop constraint shift_events_type_check;
alter table shift_events add constraint shift_events_type_check check (type in (
  'clock_in', 'break_start', 'break_end', 'clock_out', 'location', 'location_delete', 'annotate', 'correct',
  'manual_create', 'rezone', 'delete', 'restore', 'purge', 'import_session'));

-- ─── L3: size caps on what owners can write directly ──────────────────────────
alter table user_settings add constraint user_settings_settings_size check (octet_length(settings::text) <= 65536);
alter table companion_states add constraint companion_states_state_size check (octet_length(state::text) <= 65536);
alter table shift_events add constraint shift_events_payload_size check (octet_length(payload::text) <= 262144);
alter table shift_events add constraint shift_events_flags_size check (cardinality(flags) <= 16);
alter table session_revisions add constraint session_revisions_snapshot_size
  check (octet_length(previous::text) <= 65536 and octet_length(updated::text) <= 65536);

-- ─── M3 + L1 + L7: redaction ──────────────────────────────────────────────────
-- A fix id as uuid, or null when the payload holds something that isn't one (never a cast error).
create or replace function private.fix_uuid(v text) returns uuid
language sql immutable set search_path = '' as $$
  select case when v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then v::uuid end;
$$;

-- Removes coordinates from the caller's own events: `location` events (payload.fix) and `import_session`
-- events (payload.session.locations[]), for one session or all, for the given fix ids or all. Returns rows changed.
create or replace function redact_location_events(p_session_id uuid default null, p_fix_ids uuid[] default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := auth.uid();
  blank  constant jsonb := '{"latitude": null, "longitude": null, "accuracyM": null, "placeLabel": null}';
  n      int;
  m      int;
begin
  if v_uid is null then
    raise exception 'Sign in to continue.' using errcode = 'insufficient_privilege';
  end if;
  update public.shift_events e
     set payload = jsonb_set(e.payload, '{fix}', coalesce(e.payload -> 'fix', '{}'::jsonb) || blank),
         flags = case when 'location_redacted' = any (e.flags) then e.flags else array_append(e.flags, 'location_redacted') end
   where e.user_id = v_uid
     and e.type = 'location'
     and (p_session_id is null or e.session_id = p_session_id)
     and (p_fix_ids is null or private.fix_uuid(e.payload -> 'fix' ->> 'id') = any (p_fix_ids))
     and exists (select 1 from jsonb_each(e.payload -> 'fix') f
                  where f.key in ('latitude', 'longitude', 'accuracyM', 'placeLabel') and f.value <> 'null'::jsonb);
  get diagnostics n = row_count;
  update public.shift_events e
     set payload = jsonb_set(e.payload, '{session,locations}', (
           select coalesce(jsonb_agg(
                    case when p_fix_ids is null or private.fix_uuid(l.loc ->> 'id') = any (p_fix_ids)
                         then l.loc || blank else l.loc end
                    order by l.ord), '[]'::jsonb)
             from jsonb_array_elements(e.payload -> 'session' -> 'locations') with ordinality as l(loc, ord))),
         flags = case when 'location_redacted' = any (e.flags) then e.flags else array_append(e.flags, 'location_redacted') end
   where e.user_id = v_uid
     and e.type = 'import_session'
     and jsonb_typeof(e.payload -> 'session' -> 'locations') = 'array'
     and (p_session_id is null or e.session_id = p_session_id)
     and exists (
       select 1 from jsonb_array_elements(e.payload -> 'session' -> 'locations') l(loc), jsonb_each(l.loc) f
        where (p_fix_ids is null or private.fix_uuid(l.loc ->> 'id') = any (p_fix_ids))
          and f.key in ('latitude', 'longitude', 'accuracyM', 'placeLabel') and f.value <> 'null'::jsonb);
  get diagnostics m = row_count;
  return n + m;
end;
$$;
revoke execute on function redact_location_events(uuid, uuid[]) from public, anon;
grant execute on function redact_location_events(uuid, uuid[]) to authenticated;

-- ─── M1: deleting a session leaves only tombstones in the event log ───────────
-- Runs for every deleted session row (purge RPC or direct DELETE). Skipped when the person or the workspace is
-- being deleted: their events go in the same statement anyway.
create or replace function private.tombstone_session_events() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles p where p.id = old.user_id)
     or not exists (select 1 from public.organizations o where o.id = old.organization_id) then
    return null;
  end if;
  update public.shift_events e
     set payload = jsonb_strip_nulls(jsonb_build_object(
           'id', e.payload -> 'id', 'type', e.payload -> 'type',
           'sessionId', e.payload -> 'sessionId', 'at', e.payload -> 'at')),
         flags = case when 'purged' = any (e.flags) then e.flags else array_append(e.flags, 'purged') end
   where e.user_id = old.user_id and e.session_id = old.id;
  return null;
end;
$$;
create trigger shift_sessions_tombstone_events after delete on shift_sessions
  for each row execute function private.tombstone_session_events();

-- ─── L2: commit_shift_event (same contract as 0103; see the duplicate branch) ─
create or replace function commit_shift_event(
  p_event             jsonb,
  p_session           jsonb,
  p_session_id        uuid,
  p_expected_revision integer,
  p_flags             text[] default '{}'
) returns jsonb
language plpgsql set search_path = public as $$
declare
  v_uid      uuid := auth.uid();
  v_org      uuid;
  v_sorg     uuid;
  v_row      shift_sessions;
  v_removed  uuid[];
  n          int;
begin
  if v_uid is null then
    raise exception 'Sign in to continue.' using errcode = 'insufficient_privilege';
  end if;
  if p_session = 'null'::jsonb then
    p_session := null; -- a JSON null (purge) counts as SQL null
  end if;
  v_org := shift_organization_id();
  if v_org is null then
    raise exception 'You can''t track shifts in this workspace.' using errcode = 'insufficient_privilege';
  end if;
  if p_event is null or jsonb_typeof(p_event) <> 'object' or p_session_id is null
     or p_expected_revision is null or p_expected_revision < 0
     or (p_session is not null and jsonb_typeof(p_session) <> 'object') then
    raise exception 'invalid_arguments' using errcode = 'invalid_parameter_value';
  end if;
  if (p_event ->> 'sessionId')::uuid is distinct from p_session_id
     or (p_session is not null and (p_session ->> 'id')::uuid is distinct from p_session_id) then
    raise exception 'session_id_mismatch' using errcode = 'invalid_parameter_value';
  end if;

  -- Checked once, at the end of this function (writes below may pass through intermediate states).
  set constraints shift_breaks_no_overlap, shift_breaks_within_session, shift_sessions_breaks_within deferred;

  -- 1. Idempotency: the event id is stored once; a replay changes nothing.
  insert into shift_events (id, organization_id, user_id, session_id, type, happened_at, recorded_at, device_time_zone, payload, flags)
  values (
    (p_event ->> 'id')::uuid, v_org, v_uid, p_session_id, p_event ->> 'type',
    ms_to_timestamptz((p_event ->> 'at')::bigint), ms_to_timestamptz((p_event ->> 'recordedAt')::bigint),
    p_event ->> 'deviceTimeZone', p_event, coalesce(p_flags, '{}')
  )
  on conflict (id) do nothing;
  get diagnostics n = row_count;
  if n = 0 then
    -- The id is taken. Only the caller's own row is a replay; RLS (user_id = auth.uid()) hides anyone else's.
    if not exists (select 1 from shift_events e where e.id = (p_event ->> 'id')::uuid and e.user_id = v_uid) then
      raise exception 'event_id_taken' using errcode = 'unique_violation', constraint = 'shift_events_pkey';
    end if;
    return jsonb_build_object('status', 'duplicate');
  end if;

  -- 2. Purge: the session and its children go; its events become tombstones (shift_sessions_tombstone_events).
  if p_session is null then
    delete from shift_sessions
     where id = p_session_id and user_id = v_uid
       and (p_expected_revision = 0 or revision = p_expected_revision);
    get diagnostics n = row_count;
    if n = 0 and exists (select 1 from shift_sessions where id = p_session_id) then
      raise exception 'revision_conflict' using errcode = '40001';
    end if;
    set constraints shift_breaks_no_overlap, shift_breaks_within_session, shift_sessions_breaks_within immediate;
    return jsonb_build_object('status', 'applied', 'revision', null);
  end if;

  -- 3. The session row, from the reducer's JSON (owner and organization never come from the payload).
  v_row.id                  := p_session_id;
  v_row.organization_id     := v_org;
  v_row.user_id             := v_uid;
  v_row.origin_event_id     := (p_session ->> 'originEventId')::uuid;
  v_row.original_started_at := ms_to_timestamptz((p_session ->> 'originalStartedAt')::bigint);
  v_row.started_at          := ms_to_timestamptz((p_session ->> 'startedAt')::bigint);
  v_row.ended_at            := ms_to_timestamptz((p_session ->> 'endedAt')::bigint);
  v_row.origin              := (p_session ->> 'origin')::shift_origin;
  v_row.reporting_time_zone := p_session ->> 'reportingTimeZone';
  v_row.start_time_zone     := p_session ->> 'startTimeZone';
  v_row.end_time_zone       := p_session ->> 'endTimeZone';
  v_row.goal_seconds        := (p_session ->> 'goalSeconds')::integer;
  v_row.title               := coalesce(p_session ->> 'title', '');
  v_row.notes               := coalesce(p_session ->> 'notes', '');
  v_row.project_id          := (p_session ->> 'projectId')::uuid;
  v_row.tags                := array(select jsonb_array_elements_text(coalesce(p_session -> 'tags', '[]'::jsonb)));
  v_row.pay_rate_minor      := (p_session ->> 'payRateMinor')::bigint;
  v_row.currency            := p_session ->> 'currency';
  v_row.mood                := (p_session ->> 'mood')::smallint;
  v_row.energy              := (p_session ->> 'energy')::smallint;
  v_row.flags               := array(select jsonb_array_elements_text(coalesce(p_session -> 'flags', '[]'::jsonb)));
  v_row.archived_at         := ms_to_timestamptz((p_session ->> 'archivedAt')::bigint);
  v_row.deleted_at          := ms_to_timestamptz((p_session ->> 'deletedAt')::bigint);
  v_row.revision            := (p_session ->> 'revision')::integer;
  v_row.client_created_at   := ms_to_timestamptz((p_session ->> 'createdAt')::bigint);
  v_row.client_updated_at   := ms_to_timestamptz((p_session ->> 'updatedAt')::bigint);
  v_row.created_at          := now();
  v_row.updated_at          := now();

  if p_expected_revision = 0 then
    -- A reused session id fails on the primary key (23505 shift_sessions_pkey); a second running
    -- session fails on shift_sessions_one_active_idx (23505).
    insert into shift_sessions select v_row.*;
    v_sorg := v_org;
  else
    if v_row.revision is null or v_row.revision not in (p_expected_revision, p_expected_revision + 1) then
      raise exception 'revision_must_advance_by_one' using errcode = 'invalid_parameter_value';
    end if;
    update shift_sessions s
       set started_at          = v_row.started_at,
           ended_at            = v_row.ended_at,
           reporting_time_zone = v_row.reporting_time_zone,
           start_time_zone     = v_row.start_time_zone,
           end_time_zone       = v_row.end_time_zone,
           goal_seconds        = v_row.goal_seconds,
           title               = v_row.title,
           notes               = v_row.notes,
           project_id          = v_row.project_id,
           tags                = v_row.tags,
           pay_rate_minor      = v_row.pay_rate_minor,
           currency            = v_row.currency,
           mood                = v_row.mood,
           energy              = v_row.energy,
           flags               = v_row.flags,
           archived_at         = v_row.archived_at,
           deleted_at          = v_row.deleted_at,
           revision            = v_row.revision,
           client_updated_at   = v_row.client_updated_at
     where s.id = p_session_id and s.user_id = v_uid and s.revision = p_expected_revision
    returning s.organization_id into v_sorg;
    if not found then
      if exists (select 1 from shift_sessions where id = p_session_id) then
        raise exception 'revision_conflict' using errcode = '40001',
          detail = 'The session changed since this event was prepared. Reload it and apply the event again.';
      end if;
      raise exception 'session_not_found' using errcode = 'P0002';
    end if;
  end if;

  -- 4a. Breaks: remove the ones gone, update the changed, insert the new (checked together at the end).
  delete from shift_breaks b
   where b.session_id = p_session_id
     and not exists (
       select 1 from jsonb_to_recordset(coalesce(p_session -> 'breaks', '[]'::jsonb)) as x(id uuid) where x.id = b.id);
  update shift_breaks b
     set started_at = ms_to_timestamptz(x."startedAt"),
         ended_at   = ms_to_timestamptz(x."endedAt"),
         kind       = x.kind
    from jsonb_to_recordset(coalesce(p_session -> 'breaks', '[]'::jsonb))
         as x(id uuid, "startedAt" bigint, "endedAt" bigint, kind shift_break_kind)
   where b.id = x.id and b.session_id = p_session_id
     and (b.started_at, b.ended_at, b.kind) is distinct from (ms_to_timestamptz(x."startedAt"), ms_to_timestamptz(x."endedAt"), x.kind);
  insert into shift_breaks (id, organization_id, user_id, session_id, started_at, ended_at, kind)
  select x.id, v_sorg, v_uid, p_session_id, ms_to_timestamptz(x."startedAt"), ms_to_timestamptz(x."endedAt"), x.kind
    from jsonb_to_recordset(coalesce(p_session -> 'breaks', '[]'::jsonb))
         as x(id uuid, "startedAt" bigint, "endedAt" bigint, kind shift_break_kind)
   where not exists (select 1 from shift_breaks b where b.id = x.id and b.session_id = p_session_id);

  -- 4b. Location snapshots: same; coordinates of removed fixes are redacted from the event log too.
  with removed as (
    delete from location_snapshots l
     where l.session_id = p_session_id
       and not exists (
         select 1 from jsonb_to_recordset(coalesce(p_session -> 'locations', '[]'::jsonb)) as x(id uuid) where x.id = l.id)
    returning l.id
  )
  select coalesce(array_agg(id), '{}') into v_removed from removed;
  if cardinality(v_removed) > 0 then
    perform public.redact_location_events(p_session_id, v_removed);
  end if;
  update location_snapshots l
     set event        = x.event,
         status       = x.status,
         requested_at = ms_to_timestamptz(x."requestedAt"),
         captured_at  = ms_to_timestamptz(x."capturedAt"),
         latitude     = x.latitude,
         longitude    = x.longitude,
         accuracy_m   = x."accuracyM",
         place_label  = x."placeLabel"
    from jsonb_to_recordset(coalesce(p_session -> 'locations', '[]'::jsonb))
         as x(id uuid, event location_event_kind, status location_status, "requestedAt" bigint, "capturedAt" bigint,
              latitude double precision, longitude double precision, "accuracyM" double precision, "placeLabel" text)
   where l.id = x.id and l.session_id = p_session_id
     and (l.event, l.status, l.requested_at, l.captured_at, l.latitude, l.longitude, l.accuracy_m, l.place_label)
         is distinct from (x.event, x.status, ms_to_timestamptz(x."requestedAt"), ms_to_timestamptz(x."capturedAt"),
                           x.latitude, x.longitude, x."accuracyM", x."placeLabel");
  insert into location_snapshots (id, organization_id, user_id, session_id, event, status, requested_at, captured_at,
                                  latitude, longitude, accuracy_m, place_label)
  select x.id, v_sorg, v_uid, p_session_id, x.event, x.status, ms_to_timestamptz(x."requestedAt"), ms_to_timestamptz(x."capturedAt"),
         x.latitude, x.longitude, x."accuracyM", x."placeLabel"
    from jsonb_to_recordset(coalesce(p_session -> 'locations', '[]'::jsonb))
         as x(id uuid, event location_event_kind, status location_status, "requestedAt" bigint, "capturedAt" bigint,
              latitude double precision, longitude double precision, "accuracyM" double precision, "placeLabel" text)
   where not exists (select 1 from location_snapshots l where l.id = x.id and l.session_id = p_session_id);

  -- 4c. Revisions are append-only: store the ones not stored yet.
  insert into session_revisions (id, organization_id, user_id, session_id, edited_at, reason, previous, updated)
  select x.id, v_sorg, v_uid, p_session_id, ms_to_timestamptz(x.at), x.reason, x.previous, x.updated
    from jsonb_to_recordset(coalesce(p_session -> 'revisions', '[]'::jsonb))
         as x(id uuid, at bigint, reason text, previous jsonb, updated jsonb)
  on conflict (id) do nothing;

  -- 5. Every deferred rule, now: a violation aborts the whole commit (event included).
  set constraints shift_breaks_no_overlap, shift_breaks_within_session, shift_sessions_breaks_within immediate;
  return jsonb_build_object('status', 'applied', 'revision', v_row.revision);
end;
$$;

revoke execute on function commit_shift_event(jsonb, jsonb, uuid, integer, text[]) from public, anon;
grant execute on function commit_shift_event(jsonb, jsonb, uuid, integer, text[]) to authenticated;
