"use client";

import * as React from "react";
import { BanIcon, CheckIcon, LockIcon } from "lucide-react";
import { toast } from "sonner";

import type { CatalogKind } from "@/components/mochi/catalog";
import { WALL_DECOR } from "@/components/mochi/parts";
import { MAX_DECOR, itemsOf, toggleDecor, type ItemView } from "@/lib/settings/companion";
import type { Companion } from "@/lib/shifts/profile";
import { useShiftStore } from "@/lib/store/react";
import { cn } from "@/lib/utils";

import { ItemPreview, type Look } from "./item-preview";
import { achievementName } from "./use-companion";

type Patch = Partial<Omit<Companion, "updatedAt" | "highestLevel">>;

function useEquip() {
  const store = useShiftStore();
  return React.useCallback(
    async (patch: Patch) => {
      try {
        await store.updateCompanion(patch);
      } catch (e) {
        toast.error((e as Error).message || "Couldn't save that. Try again.");
      }
    },
    [store],
  );
}

function Tile({
  view,
  look,
  theme,
  selected,
  onSelect,
  wide,
  note,
}: {
  view: ItemView;
  look: Look;
  theme: "dark" | "light";
  selected: boolean;
  onSelect: () => void;
  wide?: boolean;
  note?: string;
}) {
  const { item, unlocked, hint } = view;
  const body = (
    <>
      <span className={cn("flex w-full items-center justify-center overflow-hidden rounded-[10px] bg-raised", wide ? "aspect-[4/3]" : "h-20")}>
        <span className={cn(wide ? "block w-full" : "", !unlocked && "opacity-55")}>
          <ItemPreview item={item} look={look} theme={theme} size={64} />
        </span>
      </span>
      <span className="grid w-full gap-0.5 text-left">
        <span className="flex items-center gap-1 text-sm font-medium">
          <span className="truncate">{item.name}</span>
          {selected ? <CheckIcon className="size-3.5 shrink-0 text-brand" aria-hidden /> : null}
        </span>
        {unlocked ? (
          <span className="line-clamp-2 text-xs text-muted-foreground">{note ?? item.description}</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-strong">
            <LockIcon className="size-3" aria-hidden />
            {hint}
          </span>
        )}
      </span>
    </>
  );
  const frame = cn(
    "grid content-start justify-items-start gap-2 rounded-xl border p-2 transition-colors",
    selected ? "border-brand bg-brand-soft/40 ring-1 ring-brand" : "border-border bg-card",
  );
  if (!unlocked) {
    return (
      <li className={frame} aria-label={`${item.name}, locked. Unlocks: ${hint}`}>
        {body}
      </li>
    );
  }
  return (
    <li className="contents">
      <button type="button" aria-pressed={selected} onClick={onSelect} className={cn(frame, "cursor-pointer text-left hover:border-border-strong focus-ring")}>
        {body}
      </button>
    </li>
  );
}

function NoneTile({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) {
  return (
    <li className="contents">
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={cn(
          "grid content-start justify-items-start gap-2 rounded-xl border p-2 text-left transition-colors focus-ring",
          selected ? "border-brand bg-brand-soft/40 ring-1 ring-brand" : "border-border bg-card hover:border-border-strong",
        )}
      >
        <span className="flex h-20 w-full items-center justify-center rounded-[10px] bg-raised text-muted-foreground">
          <BanIcon className="size-6" aria-hidden />
        </span>
        <span className="flex items-center gap-1 text-sm font-medium">
          {label}
          {selected ? <CheckIcon className="size-3.5 text-brand" aria-hidden /> : null}
        </span>
      </button>
    </li>
  );
}

function Group({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <div className="grid gap-0.5">
        <h3 className="font-display text-sm font-semibold">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{children}</ul>
    </section>
  );
}

interface GridProps {
  look: Look;
  unlocked: ReadonlySet<string>;
  theme: "dark" | "light";
}

export function Wardrobe({ look, unlocked, theme }: GridProps) {
  const equip = useEquip();
  const kind = (k: CatalogKind, current: string) => itemsOf(k, unlocked, (key) => key === current, achievementName);
  return (
    <div className="grid gap-6">
      <Group title="Colours">
        {kind("palette", look.palette).map((v) => (
          <Tile key={v.item.key} view={v} look={look} theme={theme} selected={v.equipped} onSelect={() => void equip({ palette: v.item.key })} />
        ))}
      </Group>
      <Group title="Hats">
        <NoneTile label="No hat" selected={look.hat === "none"} onSelect={() => void equip({ hat: null })} />
        {kind("hat", look.hat).map((v) => (
          <Tile key={v.item.key} view={v} look={look} theme={theme} selected={v.equipped} onSelect={() => void equip({ hat: v.item.key })} />
        ))}
      </Group>
      <Group title="Accessories">
        <NoneTile label="Nothing" selected={look.accessory === "none"} onSelect={() => void equip({ accessory: null })} />
        {kind("accessory", look.accessory).map((v) => (
          <Tile key={v.item.key} view={v} look={look} theme={theme} selected={v.equipped} onSelect={() => void equip({ accessory: v.item.key })} />
        ))}
      </Group>
    </div>
  );
}

const OUTDOOR = new Set(["starfield", "meadow"]);

export function Room({ look, unlocked, theme }: GridProps) {
  const equip = useEquip();
  const backgrounds = itemsOf("background", unlocked, (key) => key === look.background, achievementName);
  const decor = itemsOf("decor", unlocked, (key) => look.decor.includes(key), achievementName);
  const outdoor = OUTDOOR.has(look.background);
  return (
    <div className="grid gap-6">
      <Group title="Places">
        {backgrounds.map((v) => (
          <Tile key={v.item.key} wide view={v} look={look} theme={theme} selected={v.equipped} onSelect={() => void equip({ background: v.item.key })} />
        ))}
      </Group>
      <Group title="Decor" description={`Up to ${MAX_DECOR} things at once · ${look.decor.length} of ${MAX_DECOR} in the room`}>
        {decor.map((v) => (
          <Tile
            key={v.item.key}
            wide
            view={v}
            look={look}
            theme={theme}
            selected={v.equipped}
            note={outdoor && (WALL_DECOR as readonly string[]).includes(v.item.key) ? "Hangs on a wall — not shown outdoors." : undefined}
            onSelect={() => {
              const next = toggleDecor(look.decor, v.item.key);
              if (next === null) {
                toast(`The room holds ${MAX_DECOR} things. Take one out first.`);
                return;
              }
              void equip({ decor: next });
            }}
          />
        ))}
      </Group>
    </div>
  );
}
