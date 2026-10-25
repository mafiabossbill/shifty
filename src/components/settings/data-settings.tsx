"use client";

import * as React from "react";
import { FileJsonIcon, FileSpreadsheetIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/ui/switch";
import { allocationsCsv, buildBackup, planImport, sessionsCsv, type ImportPlan } from "@/lib/export";
import { formatDate } from "@/lib/format";
import { sessionLabel } from "@/lib/settings/locations";
import { exportFileName, importEventFor, planSentence, type ExportKind } from "@/lib/settings/data";
import type { ShiftEvent } from "@/lib/shifts/types";
import { newUuid, ShiftActionError } from "@/lib/store/store";
import { useShiftStore } from "@/lib/store/react";
import { deviceTimeZone, localDateOf } from "@/lib/time/zone";

import { SettingsGroup, SettingsHeader, SettingsSkeleton } from "./parts";
import { PrintableReport } from "./printable-report";
import { useReadyShift } from "./use-ready-shift";

function download(name: string, type: string, text: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function DataSettings() {
  const view = useReadyShift();
  const store = useShiftStore();
  const [redact, setRedact] = React.useState(false);
  const [plan, setPlan] = React.useState<{ plan: ImportPlan; events: Map<string, ShiftEvent>; file: string } | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [result, setResult] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  if (!view.ready) return <SettingsSkeleton rows={4} />;
  const all = Object.values(view.state.sessions);
  const today = localDateOf(store.now(), view.profile.settings.reportingTimeZone);
  const thisYear = today.slice(0, 4);

  function exportAs(kind: ExportKind) {
    const now = store.now();
    const opts = { redactLocation: redact, includeTrash: kind === "backup" };
    const projects = new Map(view.profile.projects.map((p) => [p.id, p.name]));
    try {
      if (kind === "backup") download(exportFileName(kind, today), "application/json", JSON.stringify(buildBackup(all, view.profile, now, opts), null, 2));
      else if (kind === "sessions") download(exportFileName(kind, today), "text/csv;charset=utf-8", sessionsCsv(all, now, opts, (id) => (id ? (projects.get(id) ?? "") : "")));
      else download(exportFileName(kind, today), "text/csv;charset=utf-8", allocationsCsv(all, now));
    } catch (e) {
      toast.error((e as Error).message || "The export couldn't be made. Try again.");
      return;
    }
    void store.addActivity({ id: `export:${Date.now()}`, type: "export", key: today }).catch(() => undefined);
  }

  async function readFile(file: File) {
    setResult(null);
    let text: string;
    try {
      text = await file.text();
    } catch {
      toast.error("That file couldn't be read. Try again.");
      return;
    }
    const now = store.now();
    const zone = deviceTimeZone();
    const events = new Map<string, ShiftEvent>();
    const p = planImport(text, view.state, (s) => {
      const event = importEventFor(s, { id: newUuid(), now, deviceTimeZone: zone });
      events.set(s.id, event);
      return event;
    });
    setPlan({ plan: p, events, file: file.name });
  }

  async function confirmImport() {
    if (!plan) return;
    setImporting(true);
    let added = 0;
    const failed: string[] = [];
    for (const s of plan.plan.add) {
      const event = plan.events.get(s.id);
      if (!event) continue;
      try {
        await store.record(event);
        added++;
      } catch (e) {
        failed.push(e instanceof ShiftActionError ? e.message : (e as Error).message);
      }
    }
    setImporting(false);
    setPlan(null);
    if (fileRef.current) fileRef.current.value = "";
    const msg = failed.length ? `Added ${added} session${added === 1 ? "" : "s"}. ${failed.length} couldn't be added: ${failed[0]}` : `Added ${added} session${added === 1 ? "" : "s"}.`;
    setResult(msg);
    if (failed.length) toast.error(msg);
    else toast.success(msg);
  }

  return (
    <div className="grid gap-8">
      <SettingsHeader title="Your data" description="Everything you log is yours. Take a copy any time, or bring a backup in." />

      <SettingsGroup title="Export" description="Times are in UTC with each session's reporting timezone, plus per-day allocations and edit history." id="export">
        <SwitchRow id="redact" title="Leave out precise location" description="Coordinates and accuracy are removed. Place names stay." checked={redact} onCheckedChange={setRedact} />
        <div className="grid gap-2 py-4 sm:grid-cols-3">
          <Button variant="secondary" onClick={() => exportAs("backup")}>
            <FileJsonIcon />
            JSON backup
          </Button>
          <Button variant="secondary" onClick={() => exportAs("sessions")}>
            <FileSpreadsheetIcon />
            Sessions CSV
          </Button>
          <Button variant="secondary" onClick={() => exportAs("allocations")}>
            <FileSpreadsheetIcon />
            Day allocations CSV
          </Button>
        </div>
        <p className="py-3 text-xs text-muted-foreground">The JSON backup is complete (trash included) and can be imported again. CSV opens in Excel or Sheets.</p>
      </SettingsGroup>

      <SettingsGroup title="Import a backup" description="A SHIFTY JSON backup. You'll see exactly what would change before anything does." id="import">
        <div className="grid gap-3 py-4">
          <input
            ref={fileRef}
            id="import-file"
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void readFile(f);
            }}
          />
          <Button asChild variant="secondary" className="w-fit">
            <label htmlFor="import-file" className="cursor-pointer">
              <UploadIcon />
              Choose a backup file
            </label>
          </Button>
          {result ? <p className="text-sm text-muted-foreground">{result}</p> : null}
          {plan ? <ImportPreview plan={plan.plan} file={plan.file} thisYear={thisYear} busy={importing} onCancel={() => setPlan(null)} onConfirm={() => void confirmImport()} /> : null}
          <p className="text-xs text-muted-foreground">Sessions only: your settings, places and Mochi stay as they are here. Sessions already on this device are skipped, never overwritten.</p>
        </div>
      </SettingsGroup>

      <SettingsGroup title="Printable report" description="A one-page summary of a month, for your records or a manager." id="print">
        <div className="py-4">
          <PrintableReport />
        </div>
      </SettingsGroup>
    </div>
  );
}

function ImportPreview({ plan, file, thisYear, busy, onCancel, onConfirm }: { plan: ImportPlan; file: string; thisYear: string; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const date = (ms: number, zone: string) => formatDate(localDateOf(ms, zone), { thisYear });
  return (
    <div className="grid gap-3 rounded-xl border border-border bg-raised p-4" role="region" aria-label="Import preview" aria-live="polite">
      <div className="grid gap-0.5">
        <p className="text-xs text-muted-foreground">{file}</p>
        <p className={plan.ok ? "font-medium" : "font-medium text-danger-ink"} role={plan.ok ? undefined : "alert"}>
          {planSentence(plan)}
        </p>
      </div>
      {plan.ok ? (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["To add", plan.add.length],
            ["Already here", plan.alreadyHere.length],
            ["Conflicts", plan.conflicts.length],
            ["Unreadable", plan.invalid.length],
          ].map(([label, n]) => (
            <div key={label} className="rounded-lg bg-card p-2.5">
              <dt className="type-eyebrow text-muted-foreground">{label}</dt>
              <dd className="type-title tabular">{n}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {plan.conflicts.length > 0 ? (
        <div className="grid gap-1">
          <p className="text-sm font-medium">Won&apos;t be added</p>
          <ul className="grid gap-1 text-sm text-muted-foreground">
            {plan.conflicts.slice(0, 10).map((c) => (
              <li key={c.session.id}>
                {date(c.session.startedAt, c.session.reportingTimeZone)} · {sessionLabel(c.session)} — {c.reason}
              </li>
            ))}
            {plan.conflicts.length > 10 ? <li>…and {plan.conflicts.length - 10} more.</li> : null}
          </ul>
        </div>
      ) : null}
      {plan.invalid.length > 0 ? (
        <ul className="grid gap-1 text-sm text-muted-foreground">
          {plan.invalid.slice(0, 5).map((i) => (
            <li key={i.index}>
              Entry {i.index + 1}: {i.reason}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        {plan.ok ? (
          <Button onClick={onConfirm} disabled={busy || plan.add.length === 0}>
            {busy ? "Adding…" : plan.add.length === 0 ? "Nothing to add" : `Add ${plan.add.length} session${plan.add.length === 1 ? "" : "s"}`}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

