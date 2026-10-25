"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDownIcon, PlayIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDuration, smartTitle } from "@/lib/format";
import { parseTags } from "@/lib/home/view-model";
import type { Project } from "@/lib/shifts/profile";
import type { SessionDetails } from "@/lib/shifts/types";
import { cn } from "@/lib/utils";

export interface ClockInHeroProps {
  goalSeconds: number;
  zone: string;
  localHour: number;
  projects: readonly Project[];
  /** Opened from the home-screen shortcut: ask, focus the button, never clock in by itself. */
  prompt: boolean;
  /** First run: nothing recorded yet. */
  firstRun: boolean;
  busy: boolean;
  onClockIn: (details: SessionDetails | null) => void;
  onDismissPrompt: () => void;
  /** Mochi, drawn above the button on first run. */
  mochi?: React.ReactNode;
}

/** The big round CLOCK IN inside a glowing ring. One tap; details are optional and folded away. */
export function ClockInHero({ goalSeconds, zone, localHour, projects, prompt, firstRun, busy, onClockIn, onDismissPrompt, mochi }: ClockInHeroProps) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(() => smartTitle(localHour));
  const [projectId, setProjectId] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const liveProjects = projects.filter((p) => !p.archived);

  useEffect(() => {
    if (prompt) buttonRef.current?.focus();
  }, [prompt]);

  const submit = () => {
    if (!open) return onClockIn(null);
    onClockIn({
      title: title.trim(),
      projectId: projectId || null,
      tags: parseTags(tags),
      notes: notes.trim(),
    });
  };

  const eyebrow = prompt ? "Clock in now?" : firstRun ? "One tap starts your first shift" : "Ready when you are";

  return (
    <Card variant="hero" padding="lg" className="items-center gap-6 text-center lg:min-h-[560px] lg:justify-center">
      <HeroGlow />
      {mochi}
      <div className="relative grid gap-1">
        {prompt ? <h2 className="type-title">{eyebrow}</h2> : <p className={cn(firstRun ? "type-title" : "type-eyebrow text-muted-foreground")}>{eyebrow}</p>}
        {firstRun ? <p className="text-sm text-muted-foreground">The start time is the moment you tap. Location is asked afterwards.</p> : null}
      </div>

      {/* Glowing ring around the one button. Decorative: the button carries the meaning. */}
      <div className="relative grid place-items-center">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-10 rounded-full"
          style={{
            background: "radial-gradient(closest-side, var(--glow), transparent 75%)",
          }}
        />
        <div aria-hidden className="absolute inset-0 rounded-full border-[10px] border-track" />
        <div aria-hidden className="absolute inset-0 rounded-full border-[3px] border-brand/50 dark:shadow-[0_0_28px_var(--glow),inset_0_0_28px_var(--glow)]" />
        <div className="relative grid size-60 place-items-center sm:size-64">
          <Button
            ref={buttonRef}
            size="xl"
            disabled={busy}
            onClick={submit}
            className="size-44 min-w-0 flex-col gap-1.5 px-0 text-xl tracking-[0.12em] uppercase md:size-48"
            aria-describedby={`${id}-goal`}
          >
            <PlayIcon className="size-7 fill-current" aria-hidden />
            Clock in
          </Button>
        </div>
      </div>

      <p id={`${id}-goal`} className="relative text-sm text-muted-foreground">
        Goal {formatDuration(goalSeconds * 1000)} net · {zone}
      </p>

      {prompt ? (
        <Button variant="ghost" size="sm" onClick={onDismissPrompt} className="relative -mt-3">
          Not now
        </Button>
      ) : null}

      <div className="relative grid w-full max-w-md gap-4 text-left">
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={open}
          aria-controls={`${id}-details`}
          onClick={() => setOpen((o) => !o)}
          className="justify-self-center text-muted-foreground"
        >
          {open ? "Hide details" : "Add details"}
          <ChevronDownIcon className={cn("motion-safe:transition-transform", open && "rotate-180")} aria-hidden />
        </Button>
        {open ? (
          <div id={`${id}-details`} className="grid gap-4 rounded-card bg-raised/60 p-4">
            <Field label="Title" htmlFor={`${id}-title`}>
              <Input id={`${id}-title`} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            {liveProjects.length > 0 ? (
              <Field label="Project" htmlFor={`${id}-project`} optional>
                <Select id={`${id}-project`} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">No project</option>
                  {liveProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="Tags" htmlFor={`${id}-tags`} hint="Separate with commas" optional>
              <Input id={`${id}-tags`} value={tags} onChange={(e) => setTags(e.target.value)} aria-describedby={`${id}-tags-hint`} placeholder="client, on-call" />
            </Field>
            <Field label="Note" htmlFor={`${id}-notes`} optional>
              <Textarea id={`${id}-notes`} value={notes} maxLength={4000} onChange={(e) => setNotes(e.target.value)} className="min-h-20" />
            </Field>
            <p className="text-xs text-muted-foreground">Clock in uses these details. You can change them later.</p>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/** One soft violet glow at the top of a hero card (the reference's glass look), not a gradient fill. */
export function HeroGlow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-2/3 opacity-80 dark:opacity-100"
      style={{
        background: "radial-gradient(60% 55% at 50% 0%, var(--glow), transparent 70%)",
      }}
    />
  );
}
