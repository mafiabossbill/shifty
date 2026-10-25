"use client";

import * as React from "react";
import { CheckIcon, PencilIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Habitat } from "@/components/mochi/habitat";
import { Mochi } from "@/components/mochi/mochi";
import type { MoodResult } from "@/components/mochi/mood";
import type { AccessoryKey, BackgroundKey, DecorKey, HatKey, PaletteKey } from "@/components/mochi/parts";
import { useTheme } from "@/components/theme/theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { timeOfDayFor } from "@/lib/settings/companion";
import { useShiftStore } from "@/lib/store/react";

import type { Look } from "./item-preview";

/** Mochi in their room, with their name (editable) and what they're saying. */
export function CompanionHero({ name, look, mood, localHour, level }: { name: string; look: Look; mood: MoodResult; localHour: number; level: number }) {
  const { resolvedTheme, reducedMotion } = useTheme();
  return (
    <div className="relative flex flex-col overflow-hidden rounded-card border border-border bg-card shadow-card">
      <Habitat
        background={look.background as BackgroundKey}
        decor={look.decor as DecorKey[]}
        theme={resolvedTheme}
        timeOfDay={timeOfDayFor(localHour)}
        animate={!reducedMotion}
        className="max-h-[460px] min-h-[300px] lg:max-h-none lg:min-h-[380px] lg:flex-1 lg:!aspect-auto"
      >
        <Mochi
          size={170}
          mood={mood.mood}
          palette={look.palette as PaletteKey}
          hat={look.hat as HatKey}
          accessory={look.accessory as AccessoryKey}
          animate={!reducedMotion}
          title={`${name}, feeling ${mood.mood}`}
        />
      </Habitat>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto min-w-0">
          <NameEditor name={name} />
        </div>
        <span className="pointer-events-auto shrink-0 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-semibold text-foreground backdrop-blur-md dark:border-white/15 dark:bg-black/35 dark:text-white">
          Level <span className="tabular">{level}</span>
        </span>
      </div>
      <div className="shrink-0 border-t border-border px-4 py-3 sm:px-5">
        <p className="text-sm" aria-live="polite">
          <span className="font-medium">{name}:</span> <span className="text-muted-foreground">“{mood.line}”</span>
        </p>
      </div>
    </div>
  );
}

function NameEditor({ name }: { name: string }) {
  const store = useShiftStore();
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(name);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    const next = value.trim();
    if (next.length === 0) return setError("Give Mochi a name (1–24 characters).");
    if (next.length > 24) return setError("Keep it to 24 characters.");
    try {
      if (next !== name) await store.updateCompanion({ name: next });
      setEditing(false);
      setError(null);
    } catch (e) {
      toast.error((e as Error).message || "Couldn't save the name. Try again.");
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1 rounded-full border border-border bg-card/80 py-0.5 pr-0.5 pl-3.5 text-foreground backdrop-blur-md dark:border-white/15 dark:bg-black/35 dark:text-white">
        <h2 className="truncate font-display text-base font-semibold">{name}</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Rename ${name}`}
          className="rounded-full text-current hover:bg-foreground/10 dark:hover:bg-white/15"
          onClick={() => {
            setValue(name);
            setEditing(true);
          }}
        >
          <PencilIcon className="size-3.5" />
        </Button>
      </div>
    );
  }
  return (
    <form
      className="grid gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="flex items-center gap-1 rounded-control bg-card/95 p-1 shadow-raised backdrop-blur">
        <label htmlFor="companion-name" className="sr-only">
          Companion name
        </label>
        <Input
          id="companion-name"
          value={value}
          maxLength={24}
          autoFocus
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "companion-name-error" : undefined}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
          className="h-10 w-40 sm:w-48"
        />
        <Button type="submit" size="icon-sm" aria-label="Save name">
          <CheckIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Cancel" onClick={() => setEditing(false)}>
          <XIcon />
        </Button>
      </div>
      {error ? (
        <p id="companion-name-error" role="alert" className="rounded-md bg-card/95 px-2 py-1 text-xs font-medium text-danger-ink">
          {error}
        </p>
      ) : null}
    </form>
  );
}
