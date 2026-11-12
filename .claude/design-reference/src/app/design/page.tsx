import Link from "next/link";
import { PlusIcon, SlidersHorizontalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { Textarea } from "@/components/ui/textarea";
import { SCREENS, stateRoute } from "@/lib/design-gallery";

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
    <div className="grid gap-1 border-t py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
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

/** The system on one page: what exists, and the one job each piece has. Screens are listed at the end. */
export default function DesignSystemPage() {
  return (
    <div className="mx-auto grid max-w-3xl gap-12 p-4 md:p-6">
      <header className="grid gap-1">
        <h1 className="text-heading font-semibold tracking-tight">Design gallery</h1>
        <p className="max-w-prose text-muted-foreground">
          Everything a screen is built from. If a screen needs something that is not here, add it to the system first, then use it.
        </p>
      </header>

      <Section title="Type" rule="Seven sizes, two weights. Rank text with weight and colour before size; titles inside the app stay small.">
        <div>
          <Row name="text-display" note="A key number">
            <p className="text-display font-semibold tabular-nums">1,284</p>
          </Row>
          <Row name="text-heading" note="The one headline of a focused page">
            <p className="text-heading font-semibold tracking-tight">Sign in to your workspace</p>
          </Row>
          <Row name="text-title" note="Page and section titles">
            <p className="text-title font-semibold">Pending invites</p>
          </Row>
          <Row name="text-body" note="Interface text">
            <p>
              <span className="font-semibold">Invoice 1042</span> <span className="text-muted-foreground">· due 28 Nov 2026</span>
            </p>
          </Row>
          <Row name="text-prose" note="Text that is read">
            <p className="max-w-prose text-prose">
              Reading text is larger, with more room between lines, and never wider than about seventy characters, so the eye finds the next line.
            </p>
          </Row>
          <Row name="text-caption" note="Meta, hints, table headers">
            <p className="text-caption text-muted-foreground">Updated 3 hours ago by Amina</p>
          </Row>
          <Row name="text-micro" note="Phone tab bar only">
            <p className="text-micro">Home</p>
          </Row>
        </div>
      </Section>

      <Section title="Colour" rule="Greys do the work. Colour means something every time it appears: an action, a status, an error. It never decorates.">
        <div>
          <Row name="text-foreground" note="Text, labels, the primary button">
            <span className="block h-8 w-24 rounded-md bg-foreground" />
          </Row>
          <Row name="text-muted-foreground" note="Secondary text (4.5:1)">
            <span className="block h-8 w-24 rounded-md bg-muted-foreground" />
          </Row>
          <Row name="border-control" note="Edge of a field (3:1)">
            <span className="block h-8 w-24 rounded-md border border-control" />
          </Row>
          <Row name="border" note="Divider; may be faint">
            <span className="block h-8 w-24 rounded-md border" />
          </Row>
          <Row name="bg-muted" note="A quieter surface">
            <span className="block h-8 w-24 rounded-md bg-muted" />
          </Row>
          <Row name="StatusPill" note="Status: colour, dot and word">
            <div className="flex flex-wrap gap-2">
              <StatusPill label="Planned" tone="neutral" />
              <StatusPill label="Active" tone="info" />
              <StatusPill label="On hold" tone="warning" />
              <StatusPill label="Overdue" tone="danger" />
              <StatusPill label="Done" tone="success" />
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

      <Section title="Actions" rule="Rank, not meaning: one solid button for what the screen is for, outlines for the rest, underlined text for the least. Red appears only when confirming.">
        <div>
          <Row name="default" note="Primary: one per screen">
            <Button>
              <PlusIcon />
              Create invoice
            </Button>
          </Row>
          <Row name="outline" note="Secondary">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline">Export list</Button>
              <Button variant="outline">Delete invoice…</Button>
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
              <Button variant="destructive">Delete invoice</Button>
              <Button variant="outline">Keep invoice</Button>
            </div>
          </Row>
          <Row name="sizes" note="default, sm, xs">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline">Save changes</Button>
              <Button variant="outline" size="sm">
                Add filter
              </Button>
              <Button variant="outline" size="xs">
                Open
              </Button>
            </div>
          </Row>
        </div>
      </Section>

      <Section title="Fields" rule="One column. The label sits above its field and is always visible; the hint and the error sit between them. Ask only what is needed.">
        <div className="grid max-w-sm gap-4">
          <Field label="Customer name">
            <Input defaultValue="Kilimanjaro Traders" />
          </Field>
          <Field label="Due date" hint="The day the work must be finished, not the day it starts.">
            <Input type="date" />
          </Field>
          <Field label="Email" error="Enter an email address, like name@company.com">
            <Input type="email" defaultValue="amina@" />
          </Field>
          <Field label="Notes" optional>
            <Textarea rows={3} />
          </Field>
          <div className="flex gap-2">
            <Button>Save invoice</Button>
            <Button variant="link">Cancel</Button>
          </div>
        </div>
      </Section>

      <Section title="States" rule="Every screen is designed empty, loading and failed, not only full. An empty screen says what will appear and offers the first action.">
        <div className="grid gap-4">
          <EmptyState title="No invoices yet" description="Invoices you create show up here." action={<Button>Create invoice</Button>} />
          <div className="grid gap-2" aria-label="Loading">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-2/3" />
          </div>
        </div>
      </Section>

      <Section title="Screens" rule="Every signed-in screen is shown here with sample data, in each state it can be in, or says why it is not (src/lib/design-gallery.ts).">
        <ul className="grid gap-2">
          {Object.entries(SCREENS).map(([route, entry]) => (
            <li key={route} className="grid gap-1 border-t py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
              <span className="font-mono text-caption">{route}</span>
              {"gallery" in entry ? (
                <span className="flex flex-wrap gap-3">
                  {entry.states.map((state) => (
                    <Link key={state} href={stateRoute(entry.gallery, state)} className="underline decoration-control underline-offset-4 hover:decoration-foreground">
                      {state}
                    </Link>
                  ))}
                </span>
              ) : (
                <span className="text-caption text-muted-foreground">Not shown: {entry.exempt}</span>
              )}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
