"use client";

import * as React from "react";
import { CheckIcon, ChevronsUpDownIcon, LocateFixedIcon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { groupZones, runtimeZones, searchZones, zoneDisplay, zoneOptions } from "@/lib/settings/timezones";
import { deviceTimeZone } from "@/lib/time/zone";
import { cn } from "@/lib/utils";

const LIMIT = 120;

/** Searchable timezone picker in a sheet: the device's zone suggested first, then every IANA zone by region. */
export function TimezonePicker({ id, value, onChange, now }: { id: string; value: string; onChange: (zone: string) => void; now: number }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const device = React.useMemo(() => deviceTimeZone(), []);
  // Offsets are read once per open: the list doesn't need to tick.
  const options = React.useMemo(() => (open ? zoneOptions(runtimeZones(), now) : []), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const matches = React.useMemo(() => searchZones(options, query), [options, query]);
  const groups = React.useMemo(() => groupZones(matches.slice(0, LIMIT)), [matches]);

  const choose = (zone: string) => {
    onChange(zone);
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      <Button id={id} variant="secondary" className="w-full justify-between sm:w-80" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className="truncate">{zoneDisplay(value, now)}</span>
        <ChevronsUpDownIcon className="text-muted-foreground" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="md:max-h-none max-md:h-[85dvh]">
          <SheetHeader>
            <SheetTitle>Reporting timezone</SheetTitle>
            <SheetDescription>Where your days begin and end in reports.</SheetDescription>
          </SheetHeader>
          <div className="shrink-0 px-5 pb-3">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <label htmlFor={`${id}-search`} className="sr-only">
                Search timezones
              </label>
              <Input
                id={`${id}-search`}
                type="search"
                placeholder="City, region or GMT+3"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10"
                autoComplete="off"
              />
            </div>
          </div>
          <SheetBody className="grid content-start gap-3">
            {device !== value && !query ? (
              <button
                type="button"
                onClick={() => choose(device)}
                className="flex min-h-12 items-center gap-3 rounded-xl border border-brand/40 bg-brand-soft/40 px-3 text-left text-sm focus-ring"
              >
                <LocateFixedIcon className="size-4 shrink-0 text-brand" aria-hidden />
                <span className="grid">
                  <span className="font-medium">Use this device&apos;s zone</span>
                  <span className="text-xs text-muted-foreground">{zoneDisplay(device, now)}</span>
                </span>
              </button>
            ) : null}
            {matches.length === 0 ? <p className="px-1 py-6 text-center text-sm text-muted-foreground">No timezone matches “{query}”. Try a city name.</p> : null}
            {groups.map((g) => (
              <div key={g.region} className="grid gap-1" role="group" aria-label={g.region}>
                <p className="type-eyebrow sticky top-0 bg-popover/95 px-1 py-1 text-muted-foreground backdrop-blur">{g.region}</p>
                <ul className="grid">
                  {g.zones.map((z) => (
                    <li key={z.id}>
                      <button
                        type="button"
                        onClick={() => choose(z.id)}
                        aria-current={z.id === value ? "true" : undefined}
                        className={cn("flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm hover:bg-accent focus-ring", z.id === value && "font-medium text-brand-strong")}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {z.city}
                          {z.id === device ? <span className="ml-2 text-xs text-muted-foreground">This device</span> : null}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular">{z.offset}</span>
                        {z.id === value ? <CheckIcon className="size-4 shrink-0 text-brand" aria-hidden /> : <span className="size-4 shrink-0" />}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {matches.length > LIMIT ? <p className="px-1 py-2 text-xs text-muted-foreground">Showing {LIMIT} of {matches.length}. Type to narrow it down.</p> : null}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>
  );
}
