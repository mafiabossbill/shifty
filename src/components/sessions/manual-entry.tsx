"use client";

import { KeyboardIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Page } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { checkManual, defaultManualTimes, longSessionWarning, resolveDraft, type TimesDraft } from "@/lib/sessions/draft";
import { useNow, useShift, useShiftStore } from "@/lib/store/react";
import { deviceTimeZone } from "@/lib/time/zone";

import { parseTags } from "./annotate-fields";
import { actionMessage } from "./errors";
import { ScreenHeader } from "./screen-header";
import { sessionHref } from "./session-row";
import { TimesFields, TimesPreview, VerdictNotice } from "./times-form";
import { ZoneSelect } from "./zone-select";

/** Add a session you forgot to clock: labelled Manual everywhere, checked for overlaps before saving. */
export function ManualEntryScreen() {
  const view = useShift();
  if (!view.ready) {
    return (
      <Page width="narrow">
        <div className="grid gap-4" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-[28rem] rounded-card" />
        </div>
      </Page>
    );
  }
  return <ManualEntryForm />;
}

function ManualEntryForm() {
  const view = useShift();
  const store = useShiftStore();
  const router = useRouter();
  const confirm = useConfirm();
  const now = useNow(30_000);
  const { settings, projects } = view.profile;
  const deviceZone = useMemo(() => deviceTimeZone(), []);
  const [zone, setZone] = useState(settings.reportingTimeZone);
  const [draft, setDraft] = useState<TimesDraft>(() => ({ ...defaultManualTimes(now, settings.reportingTimeZone), breaks: [] }));
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const resolved = useMemo(() => resolveDraft(draft, zone, { running: false }), [draft, zone]);
  const snapshot = resolved.ok ? resolved.snapshot : null;
  const verdict = useMemo(() => (snapshot ? checkManual(view.state, snapshot, zone, settings.defaultGoalSeconds, now, deviceZone) : null), [snapshot, view.state, zone, settings.defaultGoalSeconds, now, deviceZone]);
  const warning = snapshot ? longSessionWarning(snapshot) : null;
  const other = verdict?.status === "overlap" && verdict.conflictingSessionId ? (view.state.sessions[verdict.conflictingSessionId] ?? null) : null;

  const submit = async (allowOverlap: boolean) => {
    if (!snapshot || !snapshot.endedAt || !verdict) return;
    if (verdict.status === "error" || (verdict.status === "overlap" && !allowOverlap)) return;
    if (allowOverlap) {
      const ok = await confirm({
        title: "Add a session that overlaps another?",
        description: "Both sessions will count for the overlapping time. Only do this if you really worked both.",
        confirmLabel: "Add anyway",
      });
      if (!ok) return;
    }
    setSaving(true);
    setFailure(null);
    try {
      const created = await store.manualCreate({
        startedAt: snapshot.startedAt,
        endedAt: snapshot.endedAt,
        breaks: snapshot.breaks,
        reportingTimeZone: zone,
        title: title.trim() || undefined,
        projectId: projectId || null,
        tags: parseTags(tags),
        notes: notes.trim() || undefined,
        payRateMinor: settings.payTracking ? settings.defaultPayRateMinor : null,
        currency: settings.payTracking ? settings.currency : null,
        ...(allowOverlap ? { allowOverlap: true } : {}),
      });
      toast.success("Session added", { description: "It's labelled Manual in your history." });
      router.push(created ? sessionHref(created.id) : "/sessions");
    } catch (error) {
      setFailure(actionMessage(error));
      setSaving(false);
    }
  };

  return (
    <Page width="narrow">
      <ScreenHeader title="Add missed session" description="For a shift you forgot to clock. It's labelled Manual everywhere, so your history stays honest about how it was recorded." />
      <form
        className="grid gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(false);
        }}
      >
        <Card className="gap-5">
          <Field label="Times are in" htmlFor="m-zone" hint="Days are split at midnight in this timezone.">
            <ZoneSelect id="m-zone" value={zone} onChange={setZone} suggested={[settings.reportingTimeZone, deviceZone]} aria-describedby="m-zone-hint" />
          </Field>
          <TimesFields idPrefix="m" draft={draft} onChange={setDraft} zone={zone} running={false} problem={resolved.ok ? null : resolved} now={now} />
        </Card>

        <TimesPreview snapshot={snapshot} zone={zone} clock={settings.clock} now={now} goalSeconds={settings.defaultGoalSeconds} />
        {warning ? <p className="-mt-2 text-sm font-medium text-warning-ink">{warning}</p> : null}
        {verdict ? <VerdictNotice verdict={verdict} other={other} clock={settings.clock} /> : null}

        <Card className="gap-4">
          <Field label="Title" htmlFor="m-title" optional>
            <Input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Stocktake cover" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Project" htmlFor="m-project" optional>
              <Select id="m-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">No project</option>
                {projects
                  .filter((p) => !p.archived)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Tags" htmlFor="m-tags" optional hint="Separate with commas">
              <Input id="m-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="night, cover" aria-describedby="m-tags-hint" />
            </Field>
          </div>
          <Field label="Notes" htmlFor="m-notes" optional>
            <Textarea id="m-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} className="min-h-20" />
          </Field>
        </Card>

        {failure ? (
          <p role="alert" className="rounded-control bg-danger-soft p-3 text-sm font-medium text-danger-ink">
            {failure}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <p className="mr-auto inline-flex items-center gap-2 text-xs text-muted-foreground">
            <KeyboardIcon className="size-4" aria-hidden /> Saved as Manual, with no location.
          </p>
          <Button asChild variant="secondary" size="lg">
            <Link href="/sessions">Cancel</Link>
          </Button>
          {verdict?.status === "overlap" ? (
            <Button variant="outline" size="lg" disabled={saving} onClick={() => submit(true)}>
              Save anyway (overlap)
            </Button>
          ) : (
            <Button type="submit" size="lg" disabled={saving || verdict?.status !== "ok"}>
              {saving ? "Adding…" : "Add session"}
            </Button>
          )}
        </div>
      </form>
    </Page>
  );
}
