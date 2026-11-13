"use client";

import * as React from "react";
import { DownloadIcon, MoreHorizontalIcon, PencilIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { SwitchRow } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";

/* The parts of the system page that hold state or open something. Sample content only. */

const RANGES = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
] as const;

/** Choices that apply at once: one of a few, on/off, a number on a scale, one of many. */
export function ControlsDemo() {
  const [range, setRange] = React.useState<(typeof RANGES)[number]["value"]>("week");
  const [reminders, setReminders] = React.useState(true);
  const [location, setLocation] = React.useState(false);
  const [goal, setGoal] = React.useState(16);
  return (
    <div className="grid max-w-sm gap-4">
      <div className="grid gap-1.5">
        <p className="font-semibold">Range</p>
        <SegmentedControl ariaLabel="Range" value={range} onValueChange={setRange} options={RANGES} />
      </div>
      <div className="divide-y border-y">
        <SwitchRow id="demo-reminders" title="Rest reminders" description="At 12h, 14h and 16h of net work." checked={reminders} onCheckedChange={setReminders} />
        <SwitchRow id="demo-location" title="Save where I clock in" description="One point at clock-in. Never tracked in between." checked={location} onCheckedChange={setLocation} />
      </div>
      <Field label="Goal for a session" hint={`${goal}h net, breaks excluded.`} htmlFor="demo-goal">
        <Slider id="demo-goal" aria-label="Goal for a session" min={4} max={20} step={1} value={goal} onValueChange={setGoal} valueText={`${goal} hours`} aria-describedby="demo-goal-hint" />
      </Field>
      <Field label="Week starts on">
        <Select defaultValue="monday">
          <option value="monday">Monday</option>
          <option value="sunday">Sunday</option>
          <option value="saturday">Saturday</option>
        </Select>
      </Field>
    </div>
  );
}

/** A small form in a dialog: label above each field, primary action last. */
export function SampleDialogContent() {
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add a break</DialogTitle>
        <DialogDescription>Breaks are taken out of net time.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <Field label="Started">
          <Input type="time" defaultValue="02:00" />
        </Field>
        <Field label="Ended" error="Enter an end time after 02:00.">
          <Input type="time" defaultValue="01:30" />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="outline">Cancel</Button>
        <Button>Add break</Button>
      </DialogFooter>
    </DialogContent>
  );
}

/** A record in a sheet: a title, a scrolling body, actions pinned at the bottom. */
export function SampleSheetContent() {
  return (
    <SheetContent>
      <SheetHeader>
        <SheetTitle>Mon 9 Nov, 18:00 – Tue 10:00</SheetTitle>
        <SheetDescription>16h net · 30m break · crosses midnight</SheetDescription>
      </SheetHeader>
      <SheetBody>
        <div className="grid gap-4">
          <Field label="Title" optional>
            <Input defaultValue="Night shift at the depot" />
          </Field>
          <Field label="Note" optional hint="Only you see this.">
            <Textarea defaultValue="Stock count ran late; second break skipped." />
          </Field>
        </div>
      </SheetBody>
      <SheetFooter>
        <Button variant="outline">Cancel</Button>
        <Button>Save session</Button>
      </SheetFooter>
    </SheetContent>
  );
}

export const SAMPLE_CONFIRM = {
  title: "Delete the session from Mon 9 Nov?",
  description: "It moves to Trash and stays there for 30 days. You can restore it until then.",
  confirmLabel: "Delete session",
  cancelLabel: "Keep session",
  destructive: true,
} as const;

/** Things that float over the page: each opens from the control that owns it. */
export function OverlayDemos() {
  const confirm = useConfirm();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">Open a dialog</Button>
        </DialogTrigger>
        <SampleDialogContent />
      </Dialog>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline">Open a sheet</Button>
        </SheetTrigger>
        <SampleSheetContent />
      </Sheet>
      <Button variant="outline" onClick={() => void confirm(SAMPLE_CONFIRM)}>
        Delete session…
      </Button>
      <Button variant="outline" onClick={() => toast("Clocked out at 10:00", { description: "16h net.", action: { label: "Undo", onClick: () => undefined } })}>
        Show a toast
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="More actions">
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem>
            <PencilIcon />
            Edit times
          </DropdownMenuItem>
          <DropdownMenuItem>
            <DownloadIcon />
            Export session
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Delete session…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Tooltip content="Sync now">
        <Button variant="ghost" size="icon" aria-label="Sync now">
          <RefreshCwIcon />
        </Button>
      </Tooltip>
    </div>
  );
}
