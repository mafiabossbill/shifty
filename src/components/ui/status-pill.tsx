import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The one tone map. Colour carries meaning, never decoration, and never alone: a pill is a tint,
 * dark ink of the same hue, a dot or icon, and a word. Features map their states to a tone with a
 * `Record<State, Tone>`.
 *   neutral  inactive, or a plain tag     info     in progress
 *   warning  waiting on someone           danger   a problem
 *   success  done
 */
export const TONES = {
  neutral: { pill: "bg-neutral-100 text-neutral-600", dot: "bg-neutral-400" },
  info: { pill: "bg-blue-50 text-blue-700", dot: "bg-blue-500" },
  warning: { pill: "bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  danger: { pill: "bg-red-50 text-red-700", dot: "bg-red-500" },
  success: { pill: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
} as const;
export type Tone = keyof typeof TONES;

export interface PillProps extends React.ComponentProps<"span"> {
  tone?: Tone;
  /** Leading dot (a status). Off for plain tags. */
  dot?: boolean;
  /** An icon instead of the dot (lucide, same set as everywhere). */
  icon?: React.ReactNode;
}

/** Tinted pill: a dot or an icon, then the word. Regular weight, one size. For tags use `dot={false}`. */
export function Pill({ tone = "neutral", dot = true, icon, className, children, ...props }: PillProps) {
  const style = TONES[tone];
  return (
    <span data-slot="pill" className={cn("inline-flex h-5 w-fit shrink-0 items-center gap-1.5 rounded-sm px-1.5 text-caption whitespace-nowrap", style.pill, className)} {...props}>
      {icon ? (
        <span className="[&_svg]:size-3" aria-hidden>
          {icon}
        </span>
      ) : dot ? (
        <span className={cn("size-1.5 shrink-0 rounded-full", style.dot)} aria-hidden />
      ) : null}
      {children}
    </span>
  );
}

/** `<StatusPill label="Active" tone="success" />`. */
export function StatusPill({ label, tone = "neutral", className }: { label: string; tone?: Tone; className?: string }) {
  return (
    <Pill tone={tone} className={className}>
      {label}
    </Pill>
  );
}

/* ---- SHIFTY states → tones (one place, used everywhere) ---- */

export type SessionPillStatus = "active" | "on_break" | "completed";
export const SESSION_STATUS: Record<SessionPillStatus, { label: string; tone: Tone }> = {
  active: { label: "Clocked in", tone: "info" },
  on_break: { label: "On break", tone: "warning" },
  completed: { label: "Completed", tone: "success" },
};

export function SessionStatusPill({ status, className }: { status: SessionPillStatus; className?: string }) {
  const s = SESSION_STATUS[status];
  return (
    <Pill tone={s.tone} className={className}>
      {s.label}
    </Pill>
  );
}

/** Sync state of an event, a session or the whole device: On this device / Syncing / Synced / Needs attention. */
export type SyncPillState = "local" | "syncing" | "synced" | "needs_attention";
export const SYNC_STATE: Record<SyncPillState, { label: string; tone: Tone }> = {
  local: { label: "On this device", tone: "neutral" },
  syncing: { label: "Syncing", tone: "info" },
  synced: { label: "Synced", tone: "success" },
  needs_attention: { label: "Needs attention", tone: "warning" },
};

export function SyncStatePill({ state, label, className }: { state: SyncPillState; label?: string; className?: string }) {
  const s = SYNC_STATE[state];
  return (
    <Pill tone={s.tone} className={className}>
      {label ?? s.label}
    </Pill>
  );
}
