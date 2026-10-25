"use client";

import { CheckIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Project } from "@/lib/shifts/profile";
import type { ShiftEvent, ShiftSession } from "@/lib/shifts/types";
import { useShiftStore } from "@/lib/store/react";

import { actionMessage } from "./errors";

type Changes = Extract<ShiftEvent, { type: "annotate" }>["changes"];

const RATINGS = ["1", "2", "3", "4", "5"] as const;
const MOOD_HINT = ["", "Rough", "Low", "Okay", "Good", "Great"];
const ENERGY_HINT = ["", "Drained", "Tired", "Steady", "Fresh", "Charged"];

export function parseTags(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((t) => t.trim().replace(/^#/, ""))
    .filter(Boolean);
}

/**
 * Title, project, tags, notes, mood and energy — each saves in place (text on blur, choices at once).
 * Archived and trashed sessions stay editable only where the reducer allows it.
 */
export function AnnotateFields({ session, projects, disabled }: { session: ShiftSession; projects: Project[]; disabled?: boolean }) {
  const store = useShiftStore();
  const [savedField, setSavedField] = useState<string | null>(null);

  useEffect(() => {
    if (!savedField) return;
    const t = setTimeout(() => setSavedField(null), 1800);
    return () => clearTimeout(t);
  }, [savedField]);

  const save = async (field: string, changes: Changes) => {
    try {
      await store.annotate(session.id, changes);
      setSavedField(field);
    } catch (error) {
      toast.error(actionMessage(error));
    }
  };

  const saved = (field: string) =>
    savedField === field ? (
      <span className="inline-flex items-center gap-1 text-2xs font-medium text-success-ink" role="status">
        <CheckIcon className="size-3" aria-hidden /> Saved
      </span>
    ) : null;

  const usable = projects.filter((p) => !p.archived || p.id === session.projectId);

  return (
    <div className="grid gap-4">
      <TextField
        id="a-title"
        label={<>Title {saved("title")}</>}
        value={session.title}
        placeholder="Give this session a name"
        disabled={disabled}
        maxLength={120}
        onCommit={(v) => save("title", { title: v })}
      />
      <Field label={<>Project {saved("project")}</>} htmlFor="a-project">
        <Select id="a-project" value={session.projectId ?? ""} disabled={disabled} onChange={(e) => save("project", { projectId: e.target.value || null })}>
          <option value="">No project</option>
          {usable.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <TextField
        id="a-tags"
        label={<>Tags {saved("tags")}</>}
        hint="Separate with commas, e.g. night, cover"
        value={session.tags.join(", ")}
        placeholder="night, cover"
        disabled={disabled}
        onCommit={(v) => save("tags", { tags: parseTags(v) })}
      />
      <TextField
        id="a-notes"
        multiline
        label={<>Notes {saved("notes")}</>}
        value={session.notes}
        placeholder="Anything worth remembering about this shift"
        disabled={disabled}
        maxLength={4000}
        onCommit={(v) => save("notes", { notes: v })}
      />
      <Rating id="mood" label="Mood" hints={MOOD_HINT} value={session.mood} disabled={disabled} saved={saved("mood")} onChange={(v) => save("mood", { mood: v })} />
      <Rating id="energy" label="Energy" hints={ENERGY_HINT} value={session.energy} disabled={disabled} saved={saved("energy")} onChange={(v) => save("energy", { energy: v })} />
    </div>
  );
}

function TextField({
  id,
  label,
  hint,
  value,
  placeholder,
  disabled,
  maxLength,
  multiline,
  onCommit,
}: {
  id: string;
  label: ReactNode;
  hint?: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  multiline?: boolean;
  onCommit: (value: string) => void;
}) {
  // null = not editing: show the stored value (another tab or a sync may change it meanwhile).
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft.trim() !== value.trim()) onCommit(draft);
    setDraft(null);
  };
  const common = {
    id,
    value: draft ?? value,
    placeholder,
    disabled,
    maxLength,
    "aria-describedby": hint ? `${id}-hint` : undefined,
    onFocus: () => setDraft(value),
    onBlur: commit,
  };
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      {multiline ? (
        <Textarea {...common} onChange={(e) => setDraft(e.target.value)} />
      ) : (
        <Input
          {...common}
          enterKeyHint="done"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setDraft(value);
          }}
        />
      )}
    </Field>
  );
}

function Rating({
  id,
  label,
  hints,
  value,
  disabled,
  saved,
  onChange,
}: {
  id: string;
  label: string;
  hints: string[];
  value: number | null;
  disabled?: boolean;
  saved: ReactNode;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2 text-sm font-medium" id={`${id}-label`}>
        {label}
        <span className="font-normal text-muted-foreground">{value ? hints[value] : "Not set"}</span>
        {saved}
        {value !== null && !disabled ? (
          <button type="button" className="ml-auto cursor-pointer text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-ring" onClick={() => onChange(null)}>
            Clear
          </button>
        ) : null}
      </div>
      <SegmentedControl<(typeof RATINGS)[number] | "">
        ariaLabel={`${label}, 1 to 5`}
        fullWidth
        size="sm"
        value={value ? (String(value) as (typeof RATINGS)[number]) : ""}
        onValueChange={(v) => v && onChange(Number(v))}
        options={RATINGS.map((r) => ({ value: r, label: r, ariaLabel: `${r} — ${hints[Number(r)]}`, disabled }))}
      />
    </div>
  );
}
