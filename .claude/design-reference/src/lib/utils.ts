import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** The type scale and the elevation levels of globals.css. scripts/design-check.ts allows exactly these. */
export const TYPE_SCALE = ["micro", "caption", "body", "title", "prose", "heading", "display"] as const;
export const ELEVATIONS = ["raised", "overlay", "modal"] as const;

/*
 * The merge has to know the scale's own names. Without this it takes `text-body` for a colour
 * and drops it as soon as a real colour follows (`text-body text-muted-foreground`).
 */
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: [...TYPE_SCALE] }], shadow: [{ shadow: [...ELEVATIONS] }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Only same-site relative paths, so `?next=` can't send people elsewhere. */
export function safeNextPath(value: unknown): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}
