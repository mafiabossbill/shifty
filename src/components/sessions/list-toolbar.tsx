"use client";

import { ListFilterIcon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SwitchRow } from "@/components/ui/switch";
import { formatDate } from "@/lib/format";
import {
  LENGTHS,
  LENGTH_LABELS,
  SORTS,
  SORT_LABELS,
  activeFilterCount,
  clearFilters,
  type LengthKey,
  type OriginKey,
  type SessionQuery,
  type SortKey,
} from "@/lib/sessions/query";
import type { Project } from "@/lib/shifts/profile";
import { cn } from "@/lib/utils";

export interface FilterChoices {
  projects: Project[];
  tags: string[];
  places: { key: string; label: string }[];
}

/** Search (debounced into the URL), sort, and the Filters sheet. */
export function ListToolbar({ query, setQuery, choices }: { query: SessionQuery; setQuery: (q: SessionQuery | ((q: SessionQuery) => SessionQuery)) => void; choices: FilterChoices }) {
  const [text, setText] = useState(query.q);
  const [open, setOpen] = useState(false);
  const typing = useRef(false);
  const count = activeFilterCount(query);

  // URL → field when the query changes from outside (chip cleared, back button).
  useEffect(() => {
    if (!typing.current) setText(query.q);
  }, [query.q]);

  useEffect(() => {
    if (text === query.q) return;
    const t = setTimeout(() => {
      typing.current = false;
      setQuery((q) => ({ ...q, q: text }));
    }, 250);
    return () => clearTimeout(t);
  }, [text, query.q, setQuery]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-0 flex-1 basis-60">
        <span className="sr-only">Search sessions</span>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          placeholder="Search title, notes, tags, place, project"
          value={text}
          onChange={(e) => {
            typing.current = true;
            setText(e.target.value);
          }}
          className="pr-10 pl-10 [&::-webkit-search-cancel-button]:hidden"
        />
        {text ? (
          <button
            type="button"
            data-touch-target
            onClick={() => {
              typing.current = false;
              setText("");
              setQuery((q) => ({ ...q, q: "" }));
            }}
            className="absolute top-1/2 right-2 inline-flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground focus-ring"
          >
            <XIcon className="size-4" />
            <span className="sr-only">Clear search</span>
          </button>
        ) : null}
      </label>
      <div className="flex items-center gap-2 max-sm:w-full">
        <label className="min-w-0 max-sm:flex-1">
          <span className="sr-only">Sort</span>
          <Select value={query.sort} onChange={(e) => setQuery((q) => ({ ...q, sort: e.target.value as SortKey }))} className="sm:w-44">
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </Select>
        </label>
        <Button variant="outline" className="h-11 md:h-10" onClick={() => setOpen(true)} aria-label={count ? `Filters, ${count} on` : "Filters"}>
          <ListFilterIcon />
          Filters
          {count ? <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-2xs font-semibold text-primary-foreground tabular">{count}</span> : null}
        </Button>
      </div>
      <FiltersSheet open={open} onOpenChange={setOpen} query={query} setQuery={setQuery} choices={choices} />
    </div>
  );
}

function FiltersSheet({
  open,
  onOpenChange,
  query,
  setQuery,
  choices,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: SessionQuery;
  setQuery: (q: SessionQuery | ((q: SessionQuery) => SessionQuery)) => void;
  choices: FilterChoices;
}) {
  const patch = (p: Partial<SessionQuery>) => setQuery((q) => ({ ...q, ...p, ids: null }));
  const count = activeFilterCount(query);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Changes apply as you pick. They&apos;re saved in the link, so you can bookmark a view.</SheetDescription>
        </SheetHeader>
        <SheetBody className="grid content-start gap-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" htmlFor="f-from">
              <Input id="f-from" type="date" value={query.from ?? ""} max={query.to ?? undefined} onChange={(e) => patch({ from: e.target.value || null })} />
            </Field>
            <Field label="To" htmlFor="f-to">
              <Input id="f-to" type="date" value={query.to ?? ""} min={query.from ?? undefined} onChange={(e) => patch({ to: e.target.value || null })} />
            </Field>
          </div>
          <Field label="Project" htmlFor="f-project">
            <Select id="f-project" value={query.project ?? ""} onChange={(e) => patch({ project: e.target.value || null })}>
              <option value="">Any project</option>
              {choices.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value="none">No project</option>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tag" htmlFor="f-tag">
              <Select id="f-tag" value={query.tag ?? ""} onChange={(e) => patch({ tag: e.target.value || null })} disabled={choices.tags.length === 0 && !query.tag}>
                <option value="">Any tag</option>
                {[...new Set([...(query.tag ? [query.tag] : []), ...choices.tags])].map((t) => (
                  <option key={t} value={t}>
                    #{t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Place" htmlFor="f-place">
              <Select id="f-place" value={query.place ?? ""} onChange={(e) => patch({ place: e.target.value || null })}>
                <option value="">Anywhere</option>
                {choices.places.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-2">
            <span className="text-sm font-medium">Net length</span>
            <SegmentedControl<LengthKey | "any">
              ariaLabel="Net length"
              fullWidth
              size="sm"
              value={query.length ?? "any"}
              onValueChange={(v) => patch({ length: v === "any" ? null : v })}
              options={[{ value: "any", label: "Any" }, ...LENGTHS.map((l) => ({ value: l, label: LENGTH_LABELS[l] }))]}
            />
          </div>
          <div className="grid gap-2">
            <span className="text-sm font-medium">Recorded with</span>
            <SegmentedControl<OriginKey | "any">
              ariaLabel="Recorded with"
              fullWidth
              size="sm"
              value={query.origin ?? "any"}
              onValueChange={(v) => patch({ origin: v === "any" ? null : v })}
              options={[
                { value: "any", label: "Either" },
                { value: "timer", label: "Timer" },
                { value: "manual", label: "Manual" },
              ]}
            />
          </div>
          <SwitchRow
            id="f-archived"
            title="Include archived"
            description="Archived sessions still count in Insights."
            checked={query.archived}
            onCheckedChange={(v) => patch({ archived: v })}
          />
        </SheetBody>
        <SheetFooter>
          <Button variant="secondary" size="lg" disabled={count === 0} onClick={() => setQuery((q) => clearFilters({ ...q, q: q.q }))}>
            Clear filters
          </Button>
          <Button size="lg" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Removable chips for each active filter, so the list never hides why it's short. */
export function FilterChips({ query, setQuery, choices }: { query: SessionQuery; setQuery: (q: SessionQuery | ((q: SessionQuery) => SessionQuery)) => void; choices: FilterChoices }) {
  const chips: { key: string; label: string; clear: Partial<SessionQuery> }[] = [];
  if (query.from || query.to) {
    const label = query.from && query.to ? `${formatDate(query.from)} – ${formatDate(query.to)}` : query.from ? `From ${formatDate(query.from)}` : `Until ${formatDate(query.to!)}`;
    chips.push({ key: "range", label, clear: { from: null, to: null } });
  }
  if (query.project) chips.push({ key: "project", label: query.project === "none" ? "No project" : (choices.projects.find((p) => p.id === query.project)?.name ?? "A project"), clear: { project: null } });
  if (query.tag) chips.push({ key: "tag", label: `#${query.tag}`, clear: { tag: null } });
  if (query.place) chips.push({ key: "place", label: choices.places.find((p) => p.key === query.place)?.label ?? "A place", clear: { place: null } });
  if (query.length) chips.push({ key: "length", label: LENGTH_LABELS[query.length], clear: { length: null } });
  if (query.origin) chips.push({ key: "origin", label: query.origin === "manual" ? "Manual" : "Timer", clear: { origin: null } });
  if (query.archived) chips.push({ key: "archived", label: "Including archived", clear: { archived: false } });
  if (chips.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Active filters">
      {chips.map((c) => (
        <li key={c.key}>
          <Chip label={c.label} onClear={() => setQuery((q) => ({ ...q, ...c.clear }))} />
        </li>
      ))}
    </ul>
  );
}

export function Chip({ label, onClear, clearLabel, tone = "neutral" }: { label: string; onClear: () => void; clearLabel?: string; tone?: "neutral" | "accent" }) {
  return (
    <span className={cn("inline-flex h-8 items-center gap-1 rounded-full pr-1 pl-3 text-xs font-medium", tone === "accent" ? "bg-brand-soft text-brand-strong" : "bg-raised text-foreground")}>
      {label}
      <button
        type="button"
        data-touch-target
        onClick={onClear}
        className="inline-flex size-6 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground focus-ring"
      >
        <XIcon className="size-3.5" />
        <span className="sr-only">{clearLabel ?? `Remove ${label}`}</span>
      </button>
    </span>
  );
}
