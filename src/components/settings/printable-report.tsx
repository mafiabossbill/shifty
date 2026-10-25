"use client";

import * as React from "react";
import { PrinterIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatDate, formatDuration, formatMonth, formatTime } from "@/lib/format";
import { sessionFacts } from "@/lib/reports";
import { sessionLabel } from "@/lib/settings/locations";
import { monthReport, reportMonths } from "@/lib/settings/report";
import { useNow } from "@/lib/store/react";
import { localDateOf } from "@/lib/time/zone";
import { useReadyShift } from "./use-ready-shift";

/*
 * Print stylesheet scoped to this report: while printing, everything that is neither the report nor one of
 * its ancestors is hidden, ancestors stop clipping (the app shell scrolls inside <main>), colours go to ink
 * on paper. Nothing else in the app is affected.
 */
const PRINT_CSS = `
@media print {
  @page { margin: 14mm; }
  html, body { background: #fff !important; }
  body *:not(:has(.shifty-print)):not(.shifty-print):not(.shifty-print *) { display: none !important; }
  *:has(.shifty-print) { display: block !important; overflow: visible !important; height: auto !important; max-height: none !important; min-height: 0 !important; position: static !important; padding: 0 !important; margin: 0 !important; border: 0 !important; box-shadow: none !important; background: transparent !important; }
  .shifty-print, .shifty-print * { color: #111 !important; background: transparent !important; box-shadow: none !important; border-color: #d4d4d4 !important; }
  .shifty-print { font-size: 11pt; }
  .shifty-print .print-hide { display: none !important; }
  .shifty-print table { page-break-inside: auto; }
  .shifty-print tr { page-break-inside: avoid; }
}`;

export function PrintableReport() {
  const view = useReadyShift();
  const now = useNow(60_000);
  const s = view.profile.settings;
  const today = localDateOf(now, s.reportingTimeZone);
  const facts = React.useMemo(() => sessionFacts(view.sessions, now), [view.sessions, now]);
  const months = React.useMemo(() => reportMonths(facts, today), [facts, today]);
  const [month, setMonth] = React.useState(months[0]);
  const chosen = months.includes(month) ? month : months[0];
  const report = React.useMemo(() => monthReport(facts, chosen, "calendar"), [facts, chosen]);
  const thisYear = today.slice(0, 4);
  const name = s.displayName.trim();

  return (
    <div className="grid gap-4">
      <style>{PRINT_CSS}</style>
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1.5">
          <label htmlFor="report-month" className="text-sm font-medium">
            Month
          </label>
          <Select id="report-month" value={chosen} onChange={(e) => setMonth(e.target.value)} className="w-52">
            {months.map((m) => (
              <option key={m} value={m}>
                {formatMonth(m)}
              </option>
            ))}
          </Select>
        </div>
        <Button variant="secondary" onClick={() => window.print()}>
          <PrinterIcon />
          Print or save as PDF
        </Button>
      </div>

      <article className="shifty-print grid gap-4 rounded-xl border border-border bg-raised p-4 sm:p-5" aria-label={`Report for ${formatMonth(chosen)}`}>
        <header className="grid gap-0.5">
          <p className="type-eyebrow text-muted-foreground">SHIFTY work report</p>
          <h3 className="type-title">{formatMonth(chosen)}</h3>
          <p className="text-xs text-muted-foreground">
            {name ? `${name} · ` : ""}Days split at midnight in each session&apos;s reporting timezone · made {formatDate(today, { thisYear: "" })}
          </p>
        </header>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Net worked", formatDuration(report.netMs)],
            ["Breaks", formatDuration(report.breakMs)],
            ["Days worked", String(report.daysWorked)],
            ["Sessions", String(report.sessionCount)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border p-2.5">
              <dt className="type-eyebrow text-muted-foreground">{label}</dt>
              <dd className="font-display text-lg font-semibold tabular">{value}</dd>
            </div>
          ))}
        </dl>
        {report.sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions in {formatMonth(chosen)}.</p>
        ) : (
          <div className="grid gap-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="pb-2 text-left text-sm font-semibold">By day</caption>
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-1.5 pr-3 font-medium">Date</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Net</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Breaks</th>
                    <th className="py-1.5 text-right font-medium">Sessions</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {report.days.map((d) => (
                    <tr key={d.date} className="border-b border-border/60">
                      <td className="py-1.5 pr-3">{formatDate(d.date, { thisYear })}</td>
                      <td className="py-1.5 pr-3 text-right">{formatDuration(d.netMs)}</td>
                      <td className="py-1.5 pr-3 text-right">{formatDuration(d.breakMs)}</td>
                      <td className="py-1.5 text-right">{d.sessions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <caption className="pb-2 text-left text-sm font-semibold">Sessions</caption>
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-1.5 pr-3 font-medium">Started</th>
                    <th className="py-1.5 pr-3 font-medium">Ended</th>
                    <th className="py-1.5 pr-3 font-medium">Title</th>
                    <th className="py-1.5 text-right font-medium">Net</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {report.sessions.map((f) => {
                    const z = f.session.reportingTimeZone;
                    const end = f.session.endedAt;
                    return (
                      <tr key={f.session.id} className="border-b border-border/60">
                        <td className="py-1.5 pr-3 whitespace-nowrap">
                          {formatDate(f.anchor, { thisYear })}, {formatTime(f.session.startedAt, z, s.clock)}
                        </td>
                        <td className="py-1.5 pr-3 whitespace-nowrap">
                          {end === null ? "Running" : `${localDateOf(end, z) !== f.anchor ? `${formatDate(localDateOf(end, z), { thisYear })}, ` : ""}${formatTime(end, z, s.clock)}`}
                        </td>
                        <td className="max-w-48 truncate py-1.5 pr-3">
                          {sessionLabel(f.session)}
                          {f.session.origin === "manual" ? " (manual)" : ""}
                        </td>
                        <td className="py-1.5 text-right">{formatDuration(f.metrics.netMs)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Sessions crossing into another month count only their hours inside {formatMonth(chosen)} in the totals above.</p>
      </article>
    </div>
  );
}
