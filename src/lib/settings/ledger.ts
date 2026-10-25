/** XP log wording: each ledger row as one plain line ("+20 Completed a session · Mon 26 Oct"). */
import { formatDate } from "@/lib/format";
import { parseLedgerKey } from "@/lib/rewards/ledger";
import type { LedgerEntry } from "@/lib/shifts/profile";
import { localDateOf, type LocalDate } from "@/lib/time/zone";

export interface XpLogRow {
  key: string;
  xp: number;
  /** "+20" / "−20" (U+2212) */
  amount: string;
  text: string;
  date: LocalDate;
  dateLabel: string;
  sourceSessionId: string | null;
  adjustment: boolean;
}

const WORDS: Record<string, string> = {
  complete: "Completed a session",
  live: "Logged live with the timer",
  break: "Took a healthy break",
  day: "Showed up for the day",
  rest: "Rested on a rest day",
  review: "Reviewed your week",
};

/** Session-based keys are adjusted by edits; the rest by history or settings changes. */
const SESSION_PREFIXES = new Set(["complete", "live", "break", "day"]);

export function ledgerLine(row: Pick<LedgerEntry, "key" | "rule" | "xp">, achievementName: (code: string) => string | undefined): { text: string; adjustment: boolean } {
  const { base } = parseLedgerKey(row.key);
  const colon = base.indexOf(":");
  const prefix = colon > 0 ? base.slice(0, colon) : base;
  if (row.xp < 0 || row.rule === "reversal") {
    return { text: SESSION_PREFIXES.has(prefix) ? "Adjusted after an edit" : "Adjusted after a change", adjustment: true };
  }
  if (prefix === "achievement") {
    const name = achievementName(base.slice(colon + 1));
    return { text: name ? `Earned ${name}` : "Earned an achievement", adjustment: false };
  }
  return { text: WORDS[prefix] ?? "XP", adjustment: false };
}

export function signedXp(xp: number): string {
  return xp < 0 ? `−${Math.abs(xp)}` : `+${xp}`;
}

/** Newest first; same instant → higher row number first (stable across devices). */
export function xpLog(ledger: readonly LedgerEntry[], timeZone: string, today: LocalDate, achievementName: (code: string) => string | undefined): XpLogRow[] {
  const thisYear = today.slice(0, 4);
  return [...ledger]
    .filter((row) => row.xp !== 0)
    .sort((a, b) => b.at - a.at || b.key.localeCompare(a.key))
    .map((row) => {
      const { text, adjustment } = ledgerLine(row, achievementName);
      const date = localDateOf(row.at, timeZone);
      return { key: row.key, xp: row.xp, amount: signedXp(row.xp), text, date, dateLabel: formatDate(date, { thisYear }), sourceSessionId: row.sourceSessionId, adjustment };
    });
}
