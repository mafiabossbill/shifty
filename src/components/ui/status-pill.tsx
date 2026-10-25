import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The one tone map. Color carries meaning, never decoration: every pill, dot and badge in the app
 * picks a tone from here. Features map their states to tones with a `Record<State, Tone>`.
 */
export const TONES = {
  neutral: { pill: "bg-raised text-muted-foreground", dot: "bg-muted-foreground/70" },
  accent: { pill: "bg-brand-soft text-brand-strong", dot: "bg-brand" },
  success: { pill: "bg-success-soft text-success-ink", dot: "bg-success" },
  celebrate: { pill: "bg-celebrate-soft text-celebrate-ink", dot: "bg-celebrate" },
  info: { pill: "bg-info-soft text-info-ink", dot: "bg-info" },
  warning: { pill: "bg-warning-soft text-warning-ink", dot: "bg-warning" },
  danger: { pill: "bg-danger-soft text-danger-ink", dot: "bg-danger" },
} as const;
export type Tone = keyof typeof TONES;

export interface PillProps extends React.ComponentProps<"span"> {
  tone?: Tone;
  /** Leading dot (status). Off for plain tags. */
  dot?: boolean;
  /** Slow pulse on the dot for live states (active session, syncing). Off when motion is reduced. */
  live?: boolean;
  icon?: React.ReactNode;
  size?: "sm" | "md";
}

/** Tinted pill: optional dot or icon + label. For tags use `dot={false}`. */
export function Pill({ tone = "neutral", dot = true, live = false, icon, size = "md", className, children, ...props }: PillProps) {
  const style = TONES[tone];
  return (
    <span
      data-slot="pill"
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
        size === "sm" ? "h-6 px-2 text-2xs" : "h-7 px-2.5 text-xs",
        style.pill,
        className,
      )}
      {...props}
    >
      {icon ? (
        <span className="[&_svg]:size-3.5" aria-hidden>
          {icon}
        </span>
      ) : dot ? (
        <span className={cn("size-1.5 shrink-0 rounded-full", style.dot, live && "motion-safe:animate-live")} aria-hidden />
      ) : null}
      {children}
    </span>
  );
}

/** Template API: `<StatusPill label="Active" tone="success" />`. */
export function StatusPill({ label, tone = "neutral", live, className }: { label: string; tone?: Tone; live?: boolean; className?: string }) {
  return (
    <Pill tone={tone} live={live} className={className}>
      {label}
    </Pill>
  );
}

/* ---- SHIFTY states → tones (one place, used everywhere) ---- */

export type SessionPillStatus = "active" | "on_break" | "completed";
export const SESSION_STATUS: Record<SessionPillStatus, { label: string; tone: Tone; live: boolean }> = {
  active: { label: "Clocked in", tone: "accent", live: true },
  on_break: { label: "On break", tone: "celebrate", live: true },
  completed: { label: "Completed", tone: "success", live: false },
};

export function SessionStatusPill({ status, className, size }: { status: SessionPillStatus; className?: string; size?: "sm" | "md" }) {
  const s = SESSION_STATUS[status];
  return (
    <Pill tone={s.tone} live={s.live} size={size} className={className}>
      {s.label}
    </Pill>
  );
}

/** Sync state of an event, a session or the whole device (brief: Local / Syncing / Synced / Needs attention). */
export type SyncPillState = "local" | "syncing" | "synced" | "needs_attention";
export const SYNC_STATE: Record<SyncPillState, { label: string; tone: Tone; live: boolean }> = {
  local: { label: "On this device", tone: "neutral", live: false },
  syncing: { label: "Syncing", tone: "info", live: true },
  synced: { label: "Synced", tone: "success", live: false },
  needs_attention: { label: "Needs attention", tone: "warning", live: false },
};

export function SyncStatePill({ state, label, className, size }: { state: SyncPillState; label?: string; className?: string; size?: "sm" | "md" }) {
  const s = SYNC_STATE[state];
  return (
    <Pill tone={s.tone} live={s.live} size={size} className={className}>
      {label ?? s.label}
    </Pill>
  );
}
