"use client";

import * as React from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { SwitchRow } from "@/components/ui/switch";
import { parseGoal, splitGoal } from "@/lib/settings/goal";
import { notificationSupport, requestNotifications } from "@/lib/notify";
import { REMINDER_HOURS } from "@/lib/shifts/profile";
import { useNow, useShift } from "@/lib/store/react";


import { SettingRow, SettingsGroup, SettingsHeader, SettingsSkeleton, ToggleChip, useSaveSettings } from "./parts";
import { TimezonePicker } from "./timezone-picker";

const WEEKDAYS = [
  { day: 1, short: "Mon", long: "Monday" },
  { day: 2, short: "Tue", long: "Tuesday" },
  { day: 3, short: "Wed", long: "Wednesday" },
  { day: 4, short: "Thu", long: "Thursday" },
  { day: 5, short: "Fri", long: "Friday" },
  { day: 6, short: "Sat", long: "Saturday" },
  { day: 0, short: "Sun", long: "Sunday" },
];

const NUDGE_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 60, label: "After 1 hour" },
  { value: 90, label: "After 1½ hours" },
  { value: 120, label: "After 2 hours" },
  { value: 180, label: "After 3 hours" },
  { value: 240, label: "After 4 hours" },
  { value: 300, label: "After 5 hours" },
];

export function SessionSettings({ showHeader = true }: { showHeader?: boolean }) {
  const view = useShift();
  const now = useNow(60_000);
  const save = useSaveSettings();
  if (!view.ready) return <SettingsSkeleton rows={8} />;
  const s = view.profile.settings;
  const weekdays = s.weekStart === 0 ? [WEEKDAYS[6], ...WEEKDAYS.slice(0, 6)] : WEEKDAYS;
  const nudges = NUDGE_OPTIONS.some((o) => o.value === s.breakNudgeMinutes) ? NUDGE_OPTIONS : [...NUDGE_OPTIONS, { value: s.breakNudgeMinutes, label: `After ${s.breakNudgeMinutes} minutes` }];

  return (
    <div className="grid gap-8">
      {showHeader ? <SettingsHeader title="Your sessions" description="How new sessions start and how your days are counted." /> : <h2 className="sr-only">Your sessions</h2>}

      <SettingsGroup title="Goal and time" id="goal">
        <SettingRow label="Default goal" description="Net worked time, breaks excluded. A goal, not a limit." htmlFor="goal-hours">
          <GoalInput seconds={s.defaultGoalSeconds} onSave={(seconds) => save({ defaultGoalSeconds: seconds })} />
        </SettingRow>
        <SettingRow
          label="Reporting timezone"
          description="Changes new sessions. Existing sessions keep their zone — you can rezone one from its page."
          htmlFor="reporting-zone"
          stack
        >
          <TimezonePicker id="reporting-zone" value={s.reportingTimeZone} now={now} onChange={(zone) => void save({ reportingTimeZone: zone })} />
        </SettingRow>
        <SettingRow label="Week starts on">
          <SegmentedControl
            ariaLabel="Week starts on"
            size="sm"
            value={String(s.weekStart) as "0" | "1"}
            onValueChange={(v) => void save({ weekStart: v === "0" ? 0 : 1 })}
            options={[
              { value: "1", label: "Monday" },
              { value: "0", label: "Sunday" },
            ]}
          />
        </SettingRow>
        <SettingRow label="Clock">
          <SegmentedControl
            ariaLabel="Clock format"
            size="sm"
            value={s.clock}
            onValueChange={(v) => void save({ clock: v })}
            options={[
              { value: "24h", label: "24-hour" },
              { value: "12h", label: "12-hour" },
            ]}
          />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Planned workdays" description="The other days are rest days. Rest days never break your rhythm." id="workdays">
        <div className="flex flex-wrap gap-2 py-4" role="group" aria-label="Planned workdays">
          {weekdays.map((d) => {
            const on = s.plannedWeekdays.includes(d.day);
            return (
              <ToggleChip
                key={d.day}
                pressed={on}
                label={d.long}
                onPressedChange={(next) => void save({ plannedWeekdays: next ? [...s.plannedWeekdays, d.day].sort() : s.plannedWeekdays.filter((x) => x !== d.day) })}
              >
                {d.short}
              </ToggleChip>
            );
          })}
        </div>
      </SettingsGroup>

      <SettingsGroup title="Rest reminders" description="Gentle prompts while a session runs. They never stop the timer." id="reminders">
        <SettingRow label="Remind me at" description="Net hours worked." stack>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Reminder hours">
            {REMINDER_HOURS.map((h) => (
              <ToggleChip
                key={h}
                pressed={s.reminderHours.includes(h)}
                label={`${h} hours`}
                onPressedChange={(next) => void save({ reminderHours: next ? [...s.reminderHours, h].sort((a, b) => a - b) : s.reminderHours.filter((x) => x !== h) })}
              >
                {h}h
              </ToggleChip>
            ))}
          </div>
        </SettingRow>
        <SettingRow label="Break nudge" description="Suggests a break after this long without one." htmlFor="break-nudge">
          <Select id="break-nudge" value={String(s.breakNudgeMinutes)} onChange={(e) => void save({ breakNudgeMinutes: Number(e.target.value) })} className="sm:w-52">
            {nudges.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </SettingRow>
        <NotificationsRow enabled={s.notifications} onChange={(on) => save({ notifications: on })} />
      </SettingsGroup>

      <SettingsGroup title="Safety limit" id="safety">
        <SwitchRow
          id="safety-limit"
          title="Clock out automatically"
          description="Off by default. When on, SHIFTY clocks you out at the limit — the end time is the moment the limit was reached."
          checked={s.safetyLimitHours !== null}
          onCheckedChange={(on) => void save({ safetyLimitHours: on ? 20 : null })}
        />
        {s.safetyLimitHours !== null ? (
          <SettingRow label="Limit" description="Net hours worked, 1 to 48." htmlFor="safety-hours">
            <HoursInput id="safety-hours" value={s.safetyLimitHours} onSave={(h) => save({ safetyLimitHours: h })} />
          </SettingRow>
        ) : null}
      </SettingsGroup>
    </div>
  );
}

function GoalInput({ seconds, onSave }: { seconds: number; onSave: (seconds: number) => Promise<boolean> }) {
  const initial = splitGoal(seconds);
  const [h, setH] = React.useState(String(initial.hours));
  const [m, setM] = React.useState(String(initial.minutes));
  const [error, setError] = React.useState<string | null>(null);
  const [synced, setSynced] = React.useState(seconds);
  if (synced !== seconds) {
    // Changed elsewhere (another device or tab): show the new value.
    setSynced(seconds);
    const next = splitGoal(seconds);
    setH(String(next.hours));
    setM(String(next.minutes));
  }
  const commit = async () => {
    const parsed = parseGoal(h, m);
    if (!parsed.ok) return setError(parsed.error);
    setError(null);
    if (parsed.seconds !== seconds && (await onSave(parsed.seconds))) toast.success("Default goal saved. It applies to new sessions.");
  };
  return (
    <div className="grid gap-1.5" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && void commit()}>
      <div className="flex items-center gap-2">
        <Input
          id="goal-hours"
          inputMode="numeric"
          aria-label="Hours"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "goal-error" : undefined}
          value={h}
          onChange={(e) => setH(e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
          onKeyDown={(e) => e.key === "Enter" && void commit()}
          className="w-16 text-center tabular"
        />
        <span className="text-sm text-muted-foreground">h</span>
        <Input
          id="goal-minutes"
          inputMode="numeric"
          aria-label="Minutes"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "goal-error" : undefined}
          value={m}
          onChange={(e) => setM(e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
          onKeyDown={(e) => e.key === "Enter" && void commit()}
          className="w-16 text-center tabular"
        />
        <span className="text-sm text-muted-foreground">m</span>
      </div>
      {error ? (
        <p id="goal-error" role="alert" className="text-xs font-medium text-danger-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function HoursInput({ id, value, onSave }: { id: string; value: number; onSave: (hours: number) => Promise<boolean> }) {
  const [text, setText] = React.useState(String(value));
  const [error, setError] = React.useState<string | null>(null);
  const commit = async () => {
    const n = Number(text);
    if (!Number.isInteger(n) || n < 1 || n > 48) return setError("Enter whole hours from 1 to 48.");
    setError(null);
    if (n !== value) await onSave(n);
  };
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-2">
        <Input
          id={id}
          inputMode="numeric"
          value={text}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => setText(e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
          onBlur={() => void commit()}
          onKeyDown={(e) => e.key === "Enter" && void commit()}
          className="w-20 text-center tabular"
        />
        <span className="text-sm text-muted-foreground">hours</span>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type NotifyState = { supported: boolean; permission: string; needsInstall: boolean };

const NO_EVENTS = () => () => {};
// A string snapshot, so useSyncExternalStore sees a stable value between renders.
const notifyKey = () => {
  const n = notificationSupport();
  return `${n.supported}|${n.permission}|${n.needsInstall}`;
};
const parseNotify = (key: string): NotifyState => {
  const [supported, permission, needsInstall] = key.split("|");
  return { supported: supported === "true", permission, needsInstall: needsInstall === "true" };
};

function NotificationsRow({ enabled, onChange }: { enabled: boolean; onChange: (on: boolean) => Promise<boolean> }) {
  // No browser event exists for permission changes: re-read on every render, null on the server.
  const live = React.useSyncExternalStore(NO_EVENTS, notifyKey, () => null);
  const [asked, setAsked] = React.useState<string | null>(null);
  const n = live === null ? null : { ...parseNotify(live), ...(asked ? { permission: asked } : {}) };
  const description = !n
    ? "Reminders as notifications while SHIFTY is open or recently open."
    : n.needsInstall
      ? "On iPhone, reminder notifications need the home-screen app: Share, then Add to Home Screen (see This device). Reminders still appear inside SHIFTY."
      : !n.supported
        ? "This browser can't show notifications. Reminders still appear inside SHIFTY."
        : n.permission === "denied"
          ? "Notifications are blocked for SHIFTY in your browser settings. Reminders still appear inside the app."
          : "Reminders as notifications while SHIFTY is open or recently open. Otherwise they show inside the app.";
  return (
    <SwitchRow
      id="notifications"
      title="Notifications"
      description={description}
      checked={enabled && n?.permission === "granted"}
      disabled={!n || n.needsInstall || !n.supported || n.permission === "denied"}
      onCheckedChange={async (on) => {
        if (!on) return void onChange(false);
        // Must run inside this tap: browsers only show the prompt for a user gesture.
        const answer = await requestNotifications();
        setAsked(answer);
        if (answer === "granted") await onChange(true);
        else toast("Notifications weren't allowed. Reminders will show inside SHIFTY.");
      }}
    />
  );
}
