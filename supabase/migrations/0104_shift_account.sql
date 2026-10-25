-- SHIFTY data in account self-service (0004_account.sql).
--
-- Deletion: delete_own_account() needs no change. It deletes auth.users → profiles, and every SHIFTY table
-- has `user_id … references profiles (id) on delete cascade` (children also cascade from their session and
-- organization), so a person's sessions, breaks, locations, revisions, events, ledger, achievements,
-- settings, companion, projects, places and activities all go in that same transaction. A workspace that
-- is deleted with them (outcome 'deleted') cascades through organization_id as well.
-- scripts/check-rls.ts proves it (shift_account_rows_left = 0).
--
-- Export: GET /api/account/export (src/lib/data/account.ts) adds `shifty: export_my_shift_data()`.

-- The caller's profile documents in the ProfileState shape (src/lib/shifts/profile.ts):
-- settings/companion are null until first saved; lists ordered for stable output.
create or replace function load_profile_state() returns jsonb
language sql stable set search_path = public set extra_float_digits = 1 as $$
  select jsonb_build_object(
    'settings', (select u.settings from user_settings u where u.user_id = auth.uid()),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'color', p.color, 'archived', p.archived, 'updatedAt', p.updated_ms)
             order by p.name, p.id)
        from work_projects p where p.user_id = auth.uid()), '[]'::jsonb),
    'places', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'label', p.label, 'latitude', p.latitude, 'longitude', p.longitude,
                                          'radiusM', p.radius_m, 'updatedAt', p.updated_ms)
             order by p.label, p.id)
        from saved_places p where p.user_id = auth.uid()), '[]'::jsonb),
    'activities', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'type', a.type, 'key', a.key, 'at', a.at_ms) order by a.at_ms, a.id)
        from activities a where a.user_id = auth.uid()), '[]'::jsonb),
    'companion', (select c.state from companion_states c where c.user_id = auth.uid()),
    'ledger', coalesce((
      select jsonb_agg(jsonb_build_object('key', r.event_key, 'rule', r.rule, 'xp', r.xp,
                                          'sourceSessionId', r.source_session_id, 'at', r.awarded_ms)
             order by r.awarded_ms, r.event_key)
        from reward_ledger_entries r where r.user_id = auth.uid()), '[]'::jsonb),
    'achievements', coalesce((
      select jsonb_agg(jsonb_build_object('code', a.code, 'earnedAt', a.earned_ms, 'sourceSessionId', a.source_session_id)
             order by a.earned_ms, a.code)
        from user_achievements a where a.user_id = auth.uid()), '[]'::jsonb)
  );
$$;

-- Everything SHIFTY holds about the caller, for "Download my data": sessions (ShiftSession JSON, oldest
-- first, trash included), the event log as received, and the profile documents.
create or replace function export_my_shift_data() returns jsonb
language sql stable set search_path = public set extra_float_digits = 1 as $$
  select jsonb_build_object(
    'sessions', coalesce((
      select jsonb_agg(shift_session_json(s) order by s.started_at, s.id)
        from shift_sessions s where s.user_id = auth.uid()), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'type', e.type, 'sessionId', e.session_id,
               'at', timestamptz_to_ms(e.happened_at), 'recordedAt', timestamptz_to_ms(e.recorded_at),
               'receivedAt', timestamptz_to_ms(e.received_at), 'deviceTimeZone', e.device_time_zone,
               'flags', to_jsonb(e.flags), 'payload', e.payload)
             order by e.recorded_at, e.id)
        from shift_events e where e.user_id = auth.uid()), '[]'::jsonb),
    'profile', load_profile_state()
  );
$$;

revoke execute on function load_profile_state() from public, anon;
revoke execute on function export_my_shift_data() from public, anon;
grant execute on function load_profile_state() to authenticated;
grant execute on function export_my_shift_data() to authenticated;
