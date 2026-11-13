import Link from "next/link";
import { PlusIcon, SlidersHorizontalIcon } from "lucide-react";

import { ControlsDemo, OverlayDemos } from "@/components/design/system-demos";
import { ThemeSetting } from "@/components/theme/theme-setting";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ui/stat-tile";
import { Pill, SessionStatusPill, StatusPill, SyncStatePill } from "@/components/ui/status-pill";
import { Textarea } from "@/components/ui/textarea";
import { AREAS, PUBLIC_PAGES, SYSTEM_PAGES, stateRoute } from "@/lib/design-gallery";

const linkClass = "underline decoration-control underline-offset-4 hover:decoration-foreground";

function Section({ title, rule, children }: { title: string; rule: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4">
      <div className="grid gap-1">
        <h2 className="text-title font-semibold">{title}</h2>
        <p className="max-w-prose text-muted-foreground">{rule}</p>
      </div>
      {children}
    </section>
  );
}

function Row({ name, note, children }: { name: string; note: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-t py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <div>
        <p className="font-mono text-caption">{name}</p>
        <p className="text-caption text-muted-foreground">{note}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const SPACING: Array<[string, string, string]> = [
  ["1", "w-1", "4px · an icon and its label"],
  ["1.5", "w-1.5", "6px · a label and its field"],
  ["2", "w-2", "8px · items in one group"],
  ["3", "w-3", "12px · inside a row or a small box"],
  ["4", "w-4", "16px · between fields; page edge on phones"],
  ["6", "w-6", "24px · between groups; page edge on desktop"],
  ["8", "w-8", "32px · between sections"],
  ["12", "w-12", "48px · between parts of a page"],
];

const SWATCHES: Array<[string, string, string]> = [
  ["text-foreground", "Text, labels, headings", "bg-foreground"],
  ["text-muted-foreground", "Secondary text (4.5:1). Nothing lighter", "bg-muted-foreground"],
  ["bg-primary", "The action colour: the one solid button", "bg-primary"],
  ["border-control", "Edge of a field or outline button (3:1)", "border border-control"],
  ["border", "Divider; may be faint", "border"],
  ["bg-muted", "A quieter surface", "bg-muted"],
  ["bg-card", "A box on the page", "border bg-card"],
];

/** The system on one page: what exists, and the one job each piece has. Screens are listed at the end. */
export default function DesignSystemPage() {
  return (
    <div className="mx-auto grid max-w-3xl gap-12 px-page py-6">
      <header className="grid gap-4">
        <div className="grid gap-1">
          <h1 className="text-heading font-semibold tracking-tight">Design gallery</h1>
          <p className="max-w-prose text-muted-foreground">
            Everything a SHIFTY screen is built from. If a screen needs something that is not here, add it to the system first, then use it.
          </p>
        </div>
        <ThemeSetting />
      </header>

      <Section title="Type" rule="Seven sizes, two weights, one typeface. Rank text with weight and colour before size; titles inside the app stay small.">
        <div>
          <Row name="text-display" note="A key number">
            <p className="text-display font-semibold tracking-tight tabular-nums">9h 12m</p>
          </Row>
          <Row name="text-heading" note="The one headline of a focused page">
            <p className="text-heading font-semibold tracking-tight">Sign in</p>
          </Row>
          <Row name="text-title" note="Page and section titles">
            <p className="text-title font-semibold">This week</p>
          </Row>
          <Row name="text-body" note="Interface text">
            <p>
              <span className="font-semibold">Night shift at the depot</span> <span className="text-muted-foreground">· Mon 9 Nov, 18:00</span>
            </p>
          </Row>
          <Row name="text-prose" note="Text that is read">
            <p className="max-w-prose text-prose">
              Reading text is larger, with more room between lines, and never wider than about seventy characters, so the eye finds the next line.
            </p>
          </Row>
          <Row name="text-caption" note="Meta, hints, table headers">
            <p className="text-caption text-muted-foreground">Synced 3 minutes ago</p>
          </Row>
          <Row name="text-micro" note="Phone tab bar only">
            <p className="text-micro">Home</p>
          </Row>
        </div>
      </Section>

      <Section title="Colour" rule="Greys do the work. Colour means something every time it appears: a status or an error. The action colour is near-black; nothing is tinted for decoration.">
        <div>
          {SWATCHES.map(([name, note, swatch]) => (
            <Row key={name} name={name} note={note}>
              <span className={`block h-8 w-24 rounded-md ${swatch}`} />
            </Row>
          ))}
          <Row name="StatusPill" note="Status: a tint, dark ink, a dot and a word">
            <div className="flex flex-wrap gap-2">
              <StatusPill label="Inactive" tone="neutral" />
              <StatusPill label="In progress" tone="info" />
              <StatusPill label="Waiting" tone="warning" />
              <StatusPill label="Problem" tone="danger" />
              <StatusPill label="Done" tone="success" />
            </div>
          </Row>
          <Row name="SessionStatusPill" note="A session's state">
            <div className="flex flex-wrap gap-2">
              <SessionStatusPill status="active" />
              <SessionStatusPill status="on_break" />
              <SessionStatusPill status="completed" />
            </div>
          </Row>
          <Row name="SyncStatePill" note="Where the data is">
            <div className="flex flex-wrap gap-2">
              <SyncStatePill state="local" />
              <SyncStatePill state="syncing" />
              <SyncStatePill state="synced" />
              <SyncStatePill state="needs_attention" />
            </div>
          </Row>
          <Row name="Pill" note="A plain tag: no dot">
            <div className="flex flex-wrap gap-2">
              <Pill dot={false}>Added by hand</Pill>
              <Pill dot={false}>night</Pill>
            </div>
          </Row>
        </div>
      </Section>

      <Section title="Space" rule="Space shows what belongs together: less inside a group than between groups. Only these steps exist.">
        <div className="grid gap-2">
          {SPACING.map(([step, width, use]) => (
            <div key={step} className="flex items-center gap-3">
              <span className="w-8 font-mono text-caption">{step}</span>
              <span className={`h-3 rounded-sm bg-foreground ${width}`} />
              <span className="text-caption text-muted-foreground">{use}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Depth" rule="Three levels, chosen by where a thing sits above the page. Most things sit flat; a border or a quieter surface separates them.">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-1 rounded-lg border bg-background p-4 shadow-raised">
            <p className="font-mono text-caption">shadow-raised</p>
            <p className="text-caption text-muted-foreground">A control on the page</p>
          </div>
          <div className="grid gap-1 rounded-lg border bg-background p-4 shadow-overlay">
            <p className="font-mono text-caption">shadow-overlay</p>
            <p className="text-caption text-muted-foreground">Menu, popover, toast</p>
          </div>
          <div className="grid gap-1 rounded-lg border bg-background p-4 shadow-modal">
            <p className="font-mono text-caption">shadow-modal</p>
            <p className="text-caption text-muted-foreground">Dialog, sheet</p>
          </div>
        </div>
      </Section>

      <Section title="Actions" rule="Rank, not meaning: one solid button for what the screen is for, outlines for the rest, underlined text for the least. Red appears only when confirming a loss.">
        <div>
          <Row name="default" note="Primary: one per screen">
            <div className="flex flex-wrap items-center gap-2">
              <Button>
                <PlusIcon />
                Add session
              </Button>
              <Button size="lg">Clock in</Button>
            </div>
          </Row>
          <Row name="outline" note="Secondary">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline">Start a break</Button>
              <Button variant="outline">Delete session…</Button>
            </div>
          </Row>
          <Row name="link" note="Tertiary">
            <Button variant="link">Clear filters</Button>
          </Row>
          <Row name="ghost" note="Icon-only, in rows and toolbars">
            <Button variant="ghost" size="icon" aria-label="Filter">
              <SlidersHorizontalIcon />
            </Button>
          </Row>
          <Row name="destructive" note="Only the confirm step">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline">Keep session</Button>
              <Button variant="destructive">Delete session</Button>
            </div>
          </Row>
          <Row name="sizes" note="lg, default, sm, xs">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="lg">
                Clock out
              </Button>
              <Button variant="outline">Save changes</Button>
              <Button variant="outline" size="sm">
                Add filter
              </Button>
              <Button variant="outline" size="xs">
                Open
              </Button>
            </div>
          </Row>
          <Row name="disabled" note="Only while its own request runs">
            <Button disabled>Saving…</Button>
          </Row>
        </div>
      </Section>

      <Section title="Fields" rule="One column. The label sits above its field and is always visible; the hint and the error sit between them. Ask only what is needed.">
        <div className="grid max-w-sm gap-4">
          <Field label="Title">
            <Input defaultValue="Night shift at the depot" />
          </Field>
          <Field label="Started" hint="In the session's own timezone, not this device's.">
            <Input type="datetime-local" />
          </Field>
          <Field label="Ended" error="Enter an end time after the start.">
            <Input type="datetime-local" defaultValue="2026-11-09T17:30" />
          </Field>
          <Field label="Note" optional>
            <Textarea />
          </Field>
          <div className="flex gap-4">
            <Button>Save session</Button>
            <Button variant="link">Cancel</Button>
          </div>
        </div>
      </Section>

      <Section title="Choices" rule="A choice that applies at once is a switch or a segmented control; one that waits for Save is a checkbox. The chosen value is always readable in words.">
        <ControlsDemo />
      </Section>

      <Section title="Figures" rule="A figure answers a question someone has, and links to the rows behind it. Progress toward a goal is a plain bar with the numbers in words: no rings, no gauges.">
        <div className="grid gap-6">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <StatTile label="Net worked" value="41h 20m" delta={{ value: "+2h 10m", direction: "up", label: "vs last week" }} href="/design" />
            <StatTile label="Sessions" value="3" />
            <StatTile label="Breaks taken" value="5" delta={{ value: "−2", direction: "down", sentiment: "negative", label: "vs last week" }} />
            <StatTile label="Earned" value="—" hint="Pay tracking is off" />
          </div>
          <div className="grid max-w-md gap-4">
            <div className="grid gap-1.5">
              <ProgressBar value={0.575} label="Net worked: 9h 12m of 16h goal" valueText="57 percent, 6h 48m to go" />
              <p className="text-caption text-muted-foreground">9h 12m of 16h · 6h 48m to go</p>
            </div>
            <div className="grid gap-1.5">
              <ProgressBar value={1} overage={0.25} label="Net worked: 20h of 16h goal" valueText="Goal reached, 4h past it" />
              <p className="text-caption text-muted-foreground">20h of 16h · 4h past your goal</p>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Boxes" rule="A box is the strongest grouping and the noisiest. One around a distinct object or a main region; never a box inside a box, never one around every group.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader
              action={
                <Button variant="outline" size="sm">
                  Edit times
                </Button>
              }
            >
              <CardTitle>Mon 9 Nov, 18:00 – Tue 10:00</CardTitle>
              <CardDescription>16h net · 30m break</CardDescription>
            </CardHeader>
            <ul className="divide-y border-t text-muted-foreground">
              <li className="flex justify-between py-2">
                <span>Mon 9 Nov</span>
                <span className="text-foreground tabular-nums">6h</span>
              </li>
              <li className="flex justify-between py-2">
                <span>Tue 10 Nov</span>
                <span className="text-foreground tabular-nums">10h</span>
              </li>
            </ul>
          </Card>
          <Card interactive>
            <CardTitle as="p">A card that is one link</CardTitle>
            <CardDescription>The whole box answers to hover and press.</CardDescription>
          </Card>
        </div>
      </Section>

      <Section title="States" rule="Every screen is designed empty, loading and failed, not only full. An empty screen says what will appear and offers the first action.">
        <div className="grid gap-4">
          <EmptyState title="No sessions yet" description="Each shift you clock shows up here." action={<Button>Clock in</Button>} />
          <div className="grid gap-2" aria-label="Loading">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-2/3" />
          </div>
        </div>
      </Section>

      <Section title="Overlays" rule="A menu or a toast floats for a moment; a dialog or a sheet takes over until it is answered. Phones get a bottom sheet. Each opens from the control that owns it.">
        <OverlayDemos />
      </Section>

      <Section title="Shared pages" rule="The shell in its states, overlays held open, and the sign-in forms, each on its own page so it can be photographed.">
        <ul className="grid gap-2">
          {[...SYSTEM_PAGES.filter((route) => route !== "/design"), ...PUBLIC_PAGES].map((route) => (
            <li key={route}>
              {/* A plain link on purpose: each gallery page starts with a fresh store. */}
              <a href={route} className={`font-mono text-caption ${linkClass}`}>
                {route}
              </a>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Screens" rule="Every signed-in screen is shown here with sample data, in each state it can be in, or says why it is not (src/lib/design-gallery).">
        <div className="grid gap-6">
          {AREAS.map((area) => (
            <div key={area.name}>
              <h3 className="pb-2 font-semibold">{area.name}</h3>
              <ul>
                {Object.entries(area.screens).map(([route, entry]) => (
                  <li key={route} className="grid gap-1 border-t py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
                    <span className="font-mono text-caption">{route}</span>
                    {"gallery" in entry ? (
                      <span className="flex flex-wrap gap-3">
                        {entry.states.map((state) => (
                          <a key={state} href={stateRoute(entry.gallery, state)} className={linkClass}>
                            {state}
                          </a>
                        ))}
                      </span>
                    ) : (
                      <span className="text-caption text-muted-foreground">Not shown: {entry.exempt}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <p className="text-caption text-muted-foreground">
        The rules behind this page: docs/factory/docs/UI_UX_STANDARD.md. <Link href="/" className={linkClass}>Open SHIFTY</Link>
      </p>
    </div>
  );
}
