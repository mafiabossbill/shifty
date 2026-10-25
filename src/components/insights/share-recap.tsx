"use client";

/**
 * L. Shareable recap: an SVG card rendered to PNG in the browser, shared with the system sheet when it
 * accepts files, otherwise downloaded. Never includes coordinates; place names only when ticked.
 */
import * as React from "react";
import { DownloadIcon, Share2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SwitchRow } from "@/components/ui/switch";
import { formatMonth, weekdayShort } from "@/lib/format";
import { rangeLabel, spanLabel } from "@/lib/insights/labels";
import type { InsightsModel } from "@/lib/insights/model";
import type { RangeKind } from "@/lib/insights/params";
import { RECAP_HEIGHT, RECAP_WIDTH, recapSvg, type RecapColors, type RecapInput } from "@/lib/insights/recap";
import type { LocalDate } from "@/lib/time/zone";

function readColors(): RecapColors {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    background: v("--background", "#fbf8f1"),
    card: v("--card", "#ffffff"),
    foreground: v("--foreground", "#1d1a2e"),
    muted: v("--muted-foreground", "#6b6580"),
    brand: v("--brand", "#5b4ff5"),
    brandSoft: v("--brand-soft", "#ecebff"),
    track: v("--track", "#efe8da"),
    border: v("--border", "#e9e2d3"),
  };
}

export function recapInput(model: InsightsModel, kind: RangeKind, today: LocalDate, defaultGoalMs: number, includePlaces: boolean, colors: RecapColors): RecapInput {
  const { bars, summary } = model;
  const label = rangeLabel(model.range, kind, today);
  const n = bars.data.length;
  return {
    eyebrow: kind === "week" ? `Week of ${label}` : kind === "today" ? "Today" : label,
    title: spanLabel(model.range.from, model.range.to, "never"),
    netMs: summary.netMs,
    breakMs: summary.breakMs,
    sessions: summary.sessionIds.length,
    daysWorked: summary.daysWorked,
    modeLabel: model.mode === "calendar" ? "Allocated to calendar days" : "Grouped by session start date",
    bars: bars.data.map((d) => ({
      label: bars.unit === "day" ? (n <= 7 ? weekdayShort(d.from) : String(Number(d.from.slice(8, 10)))) : bars.unit === "month" ? formatMonth(d.key, false).slice(0, 3) : `${Number(d.from.slice(8, 10))}`,
      netMs: d.netMs,
      breakMs: d.breakMs,
      highlight: d.isToday,
    })),
    referenceMs: bars.unit === "day" ? defaultGoalMs : null,
    places: includePlaces ? model.places.rows.filter((p) => p.kind === "place").map((p) => ({ label: p.label, netMs: p.netMs })) : undefined,
    colors,
  };
}

async function svgToPng(svg: string): Promise<Blob> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = RECAP_WIDTH;
  canvas.height = RECAP_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't draw images.");
  ctx.drawImage(img, 0, 0, RECAP_WIDTH, RECAP_HEIGHT);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The image couldn't be created."))), "image/png"));
}

export function ShareRecap({ model, kind, today, defaultGoalMs }: { model: InsightsModel; kind: RangeKind; today: LocalDate; defaultGoalMs: number }) {
  const [open, setOpen] = React.useState(false);
  const [includePlaces, setIncludePlaces] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const hasPlaces = model.places.rows.some((p) => p.kind === "place");
  const svg = React.useMemo(
    () => (open ? recapSvg(recapInput(model, kind, today, defaultGoalMs, includePlaces && hasPlaces, readColors())) : null),
    [open, model, kind, today, defaultGoalMs, includePlaces, hasPlaces],
  );
  const fileName = `shifty-${model.range.from}${model.range.to !== model.range.from ? `-to-${model.range.to}` : ""}.png`;
  const label = kind === "week" ? "Share week" : "Share recap";

  const run = async (how: "share" | "download") => {
    if (!svg) return;
    setBusy(true);
    try {
      const blob = await svgToPng(svg);
      const file = new File([blob], fileName, { type: "image/png" });
      if (how === "share" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "My SHIFTY recap" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        toast.success("Recap image saved to your downloads.");
      }
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return;
      toast.error(`${(error as Error)?.message || "The recap couldn't be shared."} Try Download instead.`);
    } finally {
      setBusy(false);
    }
  };

  const canShareFiles = typeof navigator !== "undefined" && typeof navigator.canShare === "function";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Share2Icon aria-hidden />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>An image of your totals for {rangeLabel(model.range, kind, today)}. It never includes your location.</DialogDescription>
        </DialogHeader>
        {svg ? (
          // eslint-disable-next-line @next/next/no-img-element -- a generated data: URL, nothing to optimise
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
            alt={`Recap card: ${rangeLabel(model.range, kind, today)}`}
            width={RECAP_WIDTH}
            height={RECAP_HEIGHT}
            className="mx-auto h-auto max-h-[46dvh] w-auto rounded-[14px] border border-border"
          />
        ) : null}
        {hasPlaces ? (
          <SwitchRow
            id="recap-places"
            title="Include place names"
            description="Adds your top place labels (like “Office”). Coordinates are never included."
            checked={includePlaces}
            onCheckedChange={setIncludePlaces}
          />
        ) : null}
        <DialogFooter>
          <Button variant="secondary" onClick={() => run("download")} disabled={busy}>
            <DownloadIcon aria-hidden />
            Download
          </Button>
          {canShareFiles ? (
            <Button onClick={() => run("share")} disabled={busy}>
              <Share2Icon aria-hidden />
              Share
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
