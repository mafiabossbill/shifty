"use client";

import * as React from "react";
import {
  CoffeeIcon,
  FlameIcon,
  HistoryIcon,
  MapPinOffIcon,
  MoreHorizontalIcon,
  PlayIcon,
  PlusIcon,
  RefreshCwIcon,
  SquareIcon,
  TimerIcon,
  Trash2Icon,
  TrophyIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Page, PageHeader, PageSection } from "@/components/shell/page";
import { AccentSetting, MotionSetting, ThemeSetting } from "@/components/theme/theme-setting";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ProgressRing } from "@/components/ui/progress-ring";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { StatTile } from "@/components/ui/stat-tile";
import { Pill, SessionStatusPill, SyncStatePill, TONES, type Tone } from "@/components/ui/status-pill";
import { SwitchRow } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";

const SURFACES = [
  ["background", "bg-background"],
  ["card", "bg-card"],
  ["raised", "bg-raised"],
  ["accent (hover)", "bg-accent"],
  ["border-strong", "bg-border-strong"],
  ["track", "bg-track"],
] as const;

const COLORS = [
  ["brand", "bg-brand"],
  ["brand-strong", "bg-brand-strong"],
  ["brand-soft", "bg-brand-soft"],
  ["primary", "bg-primary"],
  ["success", "bg-success"],
  ["celebrate", "bg-celebrate"],
  ["danger", "bg-danger"],
  ["info", "bg-info"],
  ["warning", "bg-warning"],
] as const;

const RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
] as const;

const MODE_OPTIONS = [
  { value: "allocate", label: "Allocate to days" },
  { value: "start", label: "Group by start date" },
] as const;

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="grid gap-2">
      <div className={`h-14 rounded-[14px] border border-border ${className}`} />
      <code className="truncate font-mono text-2xs text-muted-foreground">{name}</code>
    </div>
  );
}

function Subhead({ children }: { children: React.ReactNode }) {
  return <p className="type-eyebrow text-muted-foreground">{children}</p>;
}

export function DesignSystem() {
  const confirm = useConfirm();
  const [range, setRange] = React.useState<(typeof RANGE_OPTIONS)[number]["value"]>("week");
  const [mode, setMode] = React.useState<(typeof MODE_OPTIONS)[number]["value"]>("allocate");
  const [goal, setGoal] = React.useState(16);
  const [reminders, setReminders] = React.useState(true);
  const [location, setLocation] = React.useState(false);

  return (
    <Page>
      <PageHeader
        title="Design system"
        description="Tokens and primitives in the current theme and accent. Switch them here; every screen follows."
      />

      <div className="grid gap-10 lg:gap-14">
        {/* Appearance */}
        <Card className="gap-5 xl:flex-row xl:items-center xl:gap-10">
          <div className="grid gap-2">
            <Subhead>Theme</Subhead>
            <ThemeSetting />
          </div>
          <div className="grid gap-2">
            <Subhead>Accent</Subhead>
            <AccentSetting />
          </div>
          <div className="xl:ml-auto xl:w-80">
            <MotionSetting />
          </div>
        </Card>

        {/* Hero */}
        <PageSection title="Hero: active session">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card variant="hero" padding="lg" className="items-center gap-6 text-center">
              <div className="flex w-full items-center justify-between gap-2">
                <SessionStatusPill status="active" />
                <span className="text-xs text-muted-foreground">Started Mon 18:02 · Africa/Dar_es_Salaam</span>
              </div>
              <ProgressRing value={0.78} label="Net worked: 12 hours 28 minutes of a 16 hour goal" valueText="78 percent" size={260} halo>
                <span className="type-eyebrow text-muted-foreground">Net worked</span>
                <span className="type-hero mt-1" style={{ fontSize: "clamp(3.5rem, 15vw, 4.5rem)" }}>
                  12:28
                </span>
                <span className="mt-1 text-sm text-muted-foreground">of 16h goal · 3h 32m to go</span>
              </ProgressRing>
              <div className="grid w-full grid-cols-3 gap-2">
                <StatTile variant="raised" label="Elapsed" value="13:04" className="p-3 text-left lg:p-4" />
                <StatTile variant="raised" label="Breaks" value="0:36" className="p-3 text-left lg:p-4" />
                <StatTile variant="raised" label="Finish ≈" value="07:34" className="p-3 text-left lg:p-4" />
              </div>
              <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                  <CoffeeIcon /> Start break
                </Button>
                <Button size="xl" className="w-full sm:w-auto">
                  <SquareIcon className="fill-current" /> Clock out
                </Button>
              </div>
            </Card>

            <div className="grid gap-4">
              <Card className="items-center gap-4 text-center">
                <CardHeader className="w-full text-left">
                  <CardTitle>Goal reached, then some</CardTitle>
                  <CardDescription>Overage is its own arc, shown neutrally.</CardDescription>
                </CardHeader>
                <ProgressRing value={1.19} overage={0.19} label="Net worked: 19 hours 2 minutes, goal 16 hours, 3 hours 2 minutes over" size={180}>
                  <span className="type-stat">19:02</span>
                  <span className="text-xs text-muted-foreground">+3h 02m past goal</span>
                </ProgressRing>
              </Card>
              <Card className="items-center gap-4 text-center">
                <span className="type-eyebrow text-muted-foreground">Ready when you are</span>
                <Button size="xl">
                  <PlayIcon className="fill-current" /> Clock in
                </Button>
                <p className="text-xs text-muted-foreground">Start time is the tap. Location is asked afterwards.</p>
              </Card>
            </div>
          </div>
        </PageSection>

        {/* Colors */}
        <PageSection title="Color tokens">
          <Card className="gap-6">
            <div className="grid gap-3">
              <Subhead>Surfaces</Subhead>
              <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
                {SURFACES.map(([name, cls]) => (
                  <Swatch key={name} name={name} className={cls} />
                ))}
              </div>
            </div>
            <div className="grid gap-3">
              <Subhead>Accent and meaning</Subhead>
              <div className="grid grid-cols-3 gap-3 md:grid-cols-9">
                {COLORS.map(([name, cls]) => (
                  <Swatch key={name} name={name} className={cls} />
                ))}
              </div>
            </div>
          </Card>
        </PageSection>

        {/* Type */}
        <PageSection title="Typography">
          <Card className="gap-5">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <span className="type-hero tabular">16:00</span>
              <code className="font-mono text-2xs text-muted-foreground">type-hero tabular · Outfit 64–88</code>
            </div>
            <div className="grid gap-3">
              <p className="type-display">Good evening, Bill</p>
              <p className="type-title">This week · 41h 20m net</p>
              <p className="type-stat">15h 30m</p>
              <p className="text-base">Body large: the shift continues past midnight and is still one session.</p>
              <p className="text-sm">Body: Mon 6h + Tue 9h 30m. Calendar days are derived from the session.</p>
              <p className="text-sm text-muted-foreground">Muted: started 18:02 in Africa/Dar_es_Salaam.</p>
              <p className="type-eyebrow text-muted-foreground">Eyebrow label</p>
            </div>
          </Card>
        </PageSection>

        {/* Buttons */}
        <PageSection title="Buttons">
          <Card className="gap-6">
            <div className="grid gap-3">
              <Subhead>Variants</Subhead>
              <div className="flex flex-wrap items-center gap-3">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="soft">Soft</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="danger">
                  <Trash2Icon /> Delete
                </Button>
                <Button disabled>Disabled</Button>
              </div>
            </div>
            <div className="grid gap-3">
              <Subhead>Sizes</Subhead>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
                <Button size="xl">
                  <PlayIcon className="fill-current" /> Clock in
                </Button>
              </div>
            </div>
            <div className="grid gap-3">
              <Subhead>Icon</Subhead>
              <div className="flex flex-wrap items-center gap-3">
                <Tooltip content="Sync now">
                  <Button size="icon-sm" variant="ghost" aria-label="Sync now">
                    <RefreshCwIcon />
                  </Button>
                </Tooltip>
                <Button size="icon" variant="secondary" aria-label="More">
                  <MoreHorizontalIcon />
                </Button>
                <Button size="icon-lg" aria-label="Add a session">
                  <PlusIcon />
                </Button>
              </div>
            </div>
          </Card>
        </PageSection>

        {/* Pills + segmented */}
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-6">
          <PageSection title="Pills">
            <Card className="gap-5">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(TONES) as Tone[]).map((tone) => (
                  <Pill key={tone} tone={tone}>
                    {tone}
                  </Pill>
                ))}
              </div>
              <div className="grid gap-2">
                <Subhead>Session</Subhead>
                <div className="flex flex-wrap gap-2">
                  <SessionStatusPill status="active" />
                  <SessionStatusPill status="on_break" />
                  <SessionStatusPill status="completed" />
                </div>
              </div>
              <div className="grid gap-2">
                <Subhead>Sync</Subhead>
                <div className="flex flex-wrap gap-2">
                  <SyncStatePill state="local" />
                  <SyncStatePill state="syncing" />
                  <SyncStatePill state="synced" />
                  <SyncStatePill state="needs_attention" />
                </div>
              </div>
              <div className="grid gap-2">
                <Subhead>Tags</Subhead>
                <div className="flex flex-wrap gap-2">
                  <Pill dot={false} size="sm">
                    night
                  </Pill>
                  <Pill dot={false} size="sm" tone="accent">
                    Site B
                  </Pill>
                  <Pill size="sm" tone="neutral" icon={<MapPinOffIcon />}>
                    Location not captured
                  </Pill>
                </div>
              </div>
            </Card>
          </PageSection>

          <PageSection title="Segmented control">
            <Card className="gap-5">
              <SegmentedControl ariaLabel="Range" value={range} onValueChange={setRange} options={RANGE_OPTIONS} fullWidth />
              <SegmentedControl ariaLabel="Report mode" value={mode} onValueChange={setMode} options={MODE_OPTIONS} size="sm" />
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium text-foreground">{range}</span>,{" "}
                {mode === "allocate" ? "time allocated to calendar days" : "sessions grouped by start date"}.
              </p>
            </Card>
          </PageSection>
        </div>

        {/* Stats */}
        <PageSection title="Stat tiles">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <StatTile label="This week" value="41h 20m" icon={<TimerIcon />} delta={{ value: "+3h 10m", direction: "up", label: "vs last week" }} />
            <StatTile label="Sessions" value="4" icon={<HistoryIcon />} hint="Longest 17h 05m" />
            <StatTile label="Breaks" value="2h 15m" icon={<CoffeeIcon />} delta={{ value: "+40m", direction: "up", sentiment: "positive", label: "vs last week" }} />
            <StatTile label="Streak" value="6" unit="days" icon={<FlameIcon />} delta={{ value: "1 rest day", direction: "flat" }} />
          </div>
        </PageSection>

        {/* Forms */}
        <PageSection title="Form controls">
          <Card className="gap-5 lg:grid lg:grid-cols-2 lg:gap-x-8">
            <Field label="Session note" htmlFor="ds-note" hint="Only you can see notes." optional>
              <Input id="ds-note" placeholder="Night shift at Site B" aria-describedby="ds-note-hint" />
            </Field>
            <Field label="Project" htmlFor="ds-project">
              <Select id="ds-project" defaultValue="site-b">
                <option value="site-a">Site A</option>
                <option value="site-b">Site B</option>
                <option value="office">Office</option>
              </Select>
            </Field>
            <Field label="Reason for the correction" htmlFor="ds-reason" error="Say why you changed the time (at least 3 characters).">
              <Textarea id="ds-reason" aria-invalid aria-describedby="ds-reason-error" placeholder="Forgot to clock out" />
            </Field>
            <div className="grid content-start gap-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium" id="ds-goal-label">
                  Daily goal
                </span>
                <span className="type-stat">{goal}h</span>
              </div>
              <Slider aria-label="Goal in hours" valueText={`${goal} hours`} min={4} max={24} step={0.5} value={goal} onValueChange={setGoal} />
              <p className="text-xs text-muted-foreground">Net hours, breaks excluded. A goal, not a limit.</p>
            </div>
            <div className="grid divide-y divide-border lg:col-span-2">
              <SwitchRow id="ds-reminders" title="Rest reminders" description="At 12h, 14h and 16h of net work." checked={reminders} onCheckedChange={setReminders} />
              <SwitchRow id="ds-location" title="Capture location at clock-in" description="Point-in-time only, never tracked." checked={location} onCheckedChange={setLocation} />
            </div>
          </Card>
        </PageSection>

        {/* Overlays */}
        <PageSection title="Sheets, dialogs, toasts">
          <Card>
            <div className="flex flex-wrap gap-3">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="secondary">Open sheet</Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Mon 24 Oct · 18:02 → 10:14</SheetTitle>
                    <SheetDescription>One session across midnight.</SheetDescription>
                  </SheetHeader>
                  <SheetBody className="grid content-start gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <StatTile variant="raised" label="Mon" value="5h 58m" />
                      <StatTile variant="raised" label="Tue" value="9h 44m" />
                    </div>
                    <Field label="Note" htmlFor="ds-sheet-note" optional>
                      <Textarea id="ds-sheet-note" placeholder="How did it go?" />
                    </Field>
                  </SheetBody>
                  <SheetFooter>
                    <Button variant="secondary">Edit times</Button>
                    <Button>Save note</Button>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary">Open dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Start a break</DialogTitle>
                    <DialogDescription>The break starts now. Net time pauses until you resume.</DialogDescription>
                  </DialogHeader>
                  <SegmentedControl
                    ariaLabel="Break kind"
                    value="rest"
                    onValueChange={() => undefined}
                    options={[
                      { value: "rest", label: "Rest" },
                      { value: "meal", label: "Meal" },
                      { value: "other", label: "Other" },
                    ]}
                    fullWidth
                  />
                  <DialogFooter>
                    <Button variant="secondary">Cancel</Button>
                    <Button>Start break</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button
                variant="danger"
                onClick={async () => {
                  const ok = await confirm({
                    title: "Delete the shift from Mon 24 Oct?",
                    description: "It moves to Trash for 30 days. Insights and XP update straight away.",
                    destructive: true,
                  });
                  if (ok) toast.success("Moved to Trash", { action: { label: "Undo", onClick: () => undefined } });
                }}
              >
                Delete…
              </Button>
              <Button variant="soft" onClick={() => toast.success("Clocked in at 18:02", { description: "Saved on this device." })}>
                Toast
              </Button>
              <Button variant="ghost" onClick={() => toast.error("Couldn't sync 2 changes.", { description: "They're safe on this device. We'll retry when you're online." })}>
                Error toast
              </Button>
            </div>
          </Card>
        </PageSection>

        {/* Loading + empty */}
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-6">
          <PageSection title="Loading">
            <Card className="gap-4" aria-busy="true" aria-label="Loading example">
              <div className="flex items-center gap-4">
                <Skeleton className="size-20 rounded-full" />
                <div className="grid flex-1 gap-2">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-24 rounded-[14px]" />
            </Card>
          </PageSection>
          <PageSection title="Empty">
            <EmptyState
              icon={<TrophyIcon />}
              title="Achievements unlock as you log shifts."
              action={
                <Button variant="soft" size="sm">
                  See how XP works
                </Button>
              }
            />
          </PageSection>
        </div>

        {/* Cards */}
        <PageSection title="Cards">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader action={<Pill tone="success">Synced</Pill>}>
                <CardTitle as="h3">Default</CardTitle>
                <CardDescription>Surface, border, soft shadow; glow in dark.</CardDescription>
              </CardHeader>
            </Card>
            <Card variant="raised">
              <CardHeader>
                <CardTitle as="h3">Raised</CardTitle>
                <CardDescription>An inset well for grouped numbers.</CardDescription>
              </CardHeader>
            </Card>
            <Card interactive tabIndex={0} role="button" aria-label="Interactive card example">
              <CardHeader>
                <CardTitle as="h3">Interactive</CardTitle>
                <CardDescription>Whole card is the target.</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm text-brand">Open session →</span>
              </CardContent>
              <CardFooter />
            </Card>
          </div>
        </PageSection>
      </div>
    </Page>
  );
}
