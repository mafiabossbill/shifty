-- SHIFTY RPCs. All run as the caller (security invoker) so RLS applies, except redact_location_events(),
-- which must rewrite the caller's own append-only event rows and is scoped to auth.uid() in its WHERE.
-- JSON contract = src/lib/shifts/types.ts ShiftSession / ShiftState, camelCase, instants as epoch ms
-- (docs/SCHEMA.md has the exact shape and error codes).

-- The organization where the caller keeps their shifts: the earliest active membership holding shift:track.
create or replace function shift_organization_id() returns uuid
language sql stable set search_path = public as $$
  select m.organization_id
    from organization_members m
   where m.profile_id = auth.uid()
     and m.deactivated_at is null
     and has_capability(m.organization_id, 'shift:track')
   order by m.created_at, m.organization_id
   limit 1;
$$;

-- One stored session in EXACTLY the ShiftSession JSON shape. Arrays: breaks by startedAt, locations by
-- requestedAt, revisions by at (ties by id). extra_float_digits = 1 keeps float8 output shortest-exact.
create or replace function shift_session_json(s shift_sessions) returns jsonb
language sql stable set search_path = public set extra_float_digits = 1 as $$
  select jsonb_build_object(
    'id', s.id,
    'originEventId', s.origin_event_id,
    'originalStartedAt', timestamptz_to_ms(s.original_started_at),
    'startedAt', timestamptz_to_ms(s.started_at),
    'endedAt', timestamptz_to_ms(s.ended_at),
    'origin', s.origin,
    'reportingTimeZone', s.reporting_time_zone,
    'startTimeZone', s.start_time_zone,
    'endTimeZone', s.end_time_zone,
    'goalSeconds', s.goal_seconds,
    'title', s.title,
    'notes', s.notes,
    'projectId', s.project_id,
    'tags', to_jsonb(s.tags),
    'payRateMinor', s.pay_rate_minor,
    'currency', s.currency,
    'mood', s.mood,
    'energy', s.energy,
    'breaks', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', b.id,
               'startedAt', timestamptz_to_ms(b.started_at),
               'endedAt', timestamptz_to_ms(b.ended_at),
               'kind', b.kind)
             order by b.started_at, b.id)
        from shift_breaks b where b.session_id = s.id), '[]'::jsonb),
    'locations', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', l.id,
               'event', l.event,
               'status', l.status,
               'requestedAt', timestamptz_to_ms(l.requested_at),
               'capturedAt', timestamptz_to_ms(l.captured_at),
               'latitude', l.latitude,
               'longitude', l.longitude,
               'accuracyM', l.accuracy_m,
               'placeLabel', l.place_label)
             order by l.requested_at, l.id)
        from location_snapshots l where l.session_id = s.id), '[]'::jsonb),
    'revisions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', v.id,
               'at', timestamptz_to_ms(v.edited_at),
               'reason', v.reason,
               'previous', v.previous,
               'updated', v.updated)
             order by v.edited_at, v.id)
        from session_revisions v where v.session_id = s.id), '[]'::jsonb),
    'flags', to_jsonb(s.flags),
    'archivedAt', timestamptz_to_ms(s.archived_at),
    'deletedAt', timestamptz_to_ms(s.deleted_at),
    'revision', s.revision,
    'createdAt', timestamptz_to_ms(s.client_created_at),
    'updatedAt', timestamptz_to_ms(s.client_updated_at)
  );
$$;

-- The caller's whole ShiftState: { "sessions": { "<id>": ShiftSession, … } } (trash included).
create or replace function load_shift_state() returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object('sessions', coalesce(jsonb_object_agg(s.id::text, shift_session_json(s)), '{}'::jsonb))
    from shift_sessions s
   where s.user_id = auth.uid();
$$;

-- One of the caller's sessions as ShiftSession JSON, or null when it doesn't exist / isn't theirs.
create or replace function load_shift_session(p_session_id uuid) returns jsonb
language sql stable set search_path = public as $$
  select shift_session_json(s) from shift_sessions s where s.id = p_session_id and s.user_id = auth.uid();
$$;

-- Removes coordinates from the caller's own `location` events (append-only log): after a fix is deleted
-- or its session purged, nothing precise about where they were stays behind. Returns rows redacted.
create or replace function redact_location_events(p_session_id uuid default null, p_fix_ids uuid[] default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  if auth.uid() is null then
    raise exception 'Sign in to continue.' using errcode = 'insufficient_privilege';
  end if;
  update shift_events e
     set payload = jsonb_set(e.payload, '{fix}',
           coalesce(e.payload -> 'fix', '{}'::jsonb)
           || '{"latitude": null, "longitude": null, "accuracyM": null, "placeLabel": null}'::jsonb),
         flags = array_append(e.flags, 'location_redacted')
   where e.user_id = auth.uid()
     and e.type = 'location'
     and (p_session_id is null or e.session_id = p_session_id)
     and (p_fix_ids is null or (e.payload -> 'fix' ->> 'id') = any (p_fix_ids::text[]))
     and not ('location_redacted' = any (e.flags));
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Atomically records one device event and the session state the reducer produced for it.
--   p_event             the ShiftEvent JSON (stored verbatim; id = idempotency key)
--   p_session           the ShiftSession JSON after the event, or null when the event purged the session
--   p_session_id        the session the event is about (= p_event.sessionId = p_session.id)
--   p_expected_revision 0 = create; otherwise the stored revision the reducer ran against
--   p_flags             server-side flags for the event (e.g. device_clock_ahead)
-- Returns {"status":"duplicate"} (event id already stored, nothing changed) or
--         {"status":"applied","revision":<int|null>}.
-- Errors: 42501 not allowed · 22023 bad arguments · 40001 revision_conflict · P0002 session_not_found ·
--         23505 shift_sessions_one_active_idx (a session is already running) or a reused id ·
--         23P01 shift_breaks_no_overlap · 23514 chronology / within-session / location coordinates ·
--         23503 project not found for this person.
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
    return jsonb_build_object('status', 'duplicate');
  end if;

  -- 2. Purge: the session and its children go; the event log stays, with coordinates redacted.
  if p_session is null then
    delete from shift_sessions
     where id = p_session_id and user_id = v_uid
       and (p_expected_revision = 0 or revision = p_expected_revision);
    get diagnostics n = row_count;
    if n = 0 and exists (select 1 from shift_sessions where id = p_session_id) then
      raise exception 'revision_conflict' using errcode = '40001';
    end if;
    perform redact_location_events(p_session_id, null);
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
    perform redact_location_events(p_session_id, v_removed);
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

-- "Delete all location points" (privacy centre): the caller's fixes, of one session or all of them.
-- Bumps the revision of every session it changed (the device reloads instead of re-sending old fixes)
-- and redacts the coordinates from the event log. Returns the number of fixes deleted.
create or replace function delete_location_fixes(p_session_id uuid default null) returns integer
language plpgsql set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  n     int;
begin
  if v_uid is null then
    raise exception 'Sign in to continue.' using errcode = 'insufficient_privilege';
  end if;
  with removed as (
    delete from location_snapshots l
     where l.user_id = v_uid and (p_session_id is null or l.session_id = p_session_id)
    returning l.session_id
  ), touched as (
    update shift_sessions s
       set revision = s.revision + 1,
           client_updated_at = date_trunc('milliseconds', now())
     where s.id in (select distinct session_id from removed) and s.user_id = v_uid
    returning s.id
  )
  select count(*) into n from removed;
  perform redact_location_events(p_session_id, null);
  return n;
end;
$$;

revoke execute on function shift_organization_id() from public, anon;
revoke execute on function shift_session_json(shift_sessions) from public, anon;
revoke execute on function load_shift_state() from public, anon;
revoke execute on function load_shift_session(uuid) from public, anon;
revoke execute on function redact_location_events(uuid, uuid[]) from public, anon;
revoke execute on function commit_shift_event(jsonb, jsonb, uuid, integer, text[]) from public, anon;
revoke execute on function delete_location_fixes(uuid) from public, anon;
grant execute on function shift_organization_id() to authenticated;
grant execute on function shift_session_json(shift_sessions) to authenticated;
grant execute on function load_shift_state() to authenticated;
grant execute on function load_shift_session(uuid) to authenticated;
grant execute on function redact_location_events(uuid, uuid[]) to authenticated;
grant execute on function commit_shift_event(jsonb, jsonb, uuid, integer, text[]) to authenticated;
grant execute on function delete_location_fixes(uuid) to authenticated;
