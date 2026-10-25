"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import type { Settings } from "@/lib/shifts/profile";
import { useShiftStore } from "@/lib/store/react";
import { cn } from "@/lib/utils";

/** A settings sub-page heading: back link on phones/tablets, the section title everywhere. */
export function SettingsHeader({ title, description }: { title: string; description?: React.ReactNode }) {
  return (
    <header className="grid gap-2">
      <Link href="/settings" className="-ml-1 inline-flex h-10 w-fit items-center gap-1 rounded-lg pr-2 text-sm text-muted-foreground hover:text-foreground focus-ring lg:hidden">
        <ChevronLeftIcon className="size-4" aria-hidden />
        Settings
      </Link>
      <h1 className="type-title lg:type-display">{title}</h1>
      {description ? <p className="max-w-prose text-sm text-muted-foreground">{description}</p> : null}
    </header>
  );
}

/** A titled card of settings rows. */
export function SettingsGroup({ title, description, children, className, id }: { title?: string; description?: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section className={cn("grid gap-2.5", className)} aria-labelledby={title && id ? `${id}-title` : undefined}>
      {title ? (
        <div className="grid gap-0.5 px-1">
          <h2 id={id ? `${id}-title` : undefined} className="font-display text-base font-semibold tracking-tight">
            {title}
          </h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      ) : null}
      <div className="grid divide-y divide-border rounded-card border border-border bg-card px-4 shadow-card sm:px-5">{children}</div>
    </section>
  );
}

/** Label + description on the left, control on the right (stacked on narrow phones). */
export function SettingRow({ label, description, htmlFor, children, stack = false }: { label: React.ReactNode; description?: React.ReactNode; htmlFor?: string; children: React.ReactNode; stack?: boolean }) {
  const Label = htmlFor ? "label" : "div";
  return (
    <div className={cn("flex min-h-14 flex-col gap-3 py-3.5", !stack && "sm:flex-row sm:items-center sm:justify-between sm:gap-6")}>
      <Label {...(htmlFor ? { htmlFor } : {})} className="grid min-w-0 gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        {description ? <span className="text-xs text-muted-foreground">{description}</span> : null}
      </Label>
      <div className={cn("min-w-0", !stack && "sm:shrink-0")}>{children}</div>
    </div>
  );
}

/** Saves a settings patch, showing the store's sentence if it's refused. */
export function useSaveSettings() {
  const store = useShiftStore();
  return React.useCallback(
    async (patch: Partial<Omit<Settings, "updatedAt">>) => {
      try {
        await store.updateSettings(patch);
        return true;
      } catch (e) {
        toast.error((e as Error).message || "Couldn't save that setting. Try again.");
        return false;
      }
    },
    [store],
  );
}

export function SettingsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading settings">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-2.5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="rounded-card" style={{ height: rows * 60 }} />
      </div>
    </div>
  );
}

/** Small toggle chip (aria-pressed), for weekdays and reminder hours. */
export function ToggleChip({ pressed, onPressedChange, children, label }: { pressed: boolean; onPressedChange: (next: boolean) => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      onClick={() => onPressedChange(!pressed)}
      data-touch-target
      className={cn(
        "inline-flex h-10 min-w-11 items-center justify-center rounded-full border px-3 text-sm font-medium transition-colors focus-ring md:h-9",
        pressed ? "border-transparent bg-primary text-primary-foreground" : "border-border-strong bg-transparent text-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}
