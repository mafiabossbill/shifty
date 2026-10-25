import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Only same-site relative paths, so `?next=` can't send people elsewhere. Browsers strip tabs/newlines and
 * treat `\` like `/`, so `/%09/evil.example` would become `//evil.example`: refuse control characters and
 * backslashes, then confirm the path resolves to our own origin.
 */
export function safeNextPath(value: unknown): string {
  const next = typeof value === "string" ? value : "";
  // eslint-disable-next-line no-control-regex
  if (!next.startsWith("/") || next.startsWith("//") || /[\u0000-\u001f\u007f\\]/.test(next)) return "/";
  try {
    const base = "https://same.origin.invalid";
    const url = new URL(next, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch {
    return "/";
  }
}
