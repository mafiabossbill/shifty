/**
 * Append-only ledger reconciliation. Rows are `<base>#<n>`; a base key's value is the sum of its rows.
 * Given the targets, we append exactly the rows that move each base to its target — nothing when they
 * already agree, so replays, double runs and two devices with the same history all converge on the same
 * rows. Every row's `at` comes from the history (target instant, or the base's latest row for a key with
 * no target at all), never from the wall clock — that is why there is no `now` parameter.
 */
import type { LedgerEntry } from "@/lib/shifts/profile";

import type { RewardTarget } from "./types";

/** Key prefixes this version understands; anything else (a newer version's rule) is left untouched. */
const KNOWN_PREFIXES = new Set(["complete", "live", "break", "day", "rest", "review", "achievement"]);

export function parseLedgerKey(key: string): { base: string; n: number } {
  const hash = key.lastIndexOf("#");
  if (hash > 0) {
    const suffix = key.slice(hash + 1);
    if (/^\d+$/.test(suffix)) return { base: key.slice(0, hash), n: Number(suffix) };
  }
  return { base: key, n: 0 };
}

interface BaseState {
  net: number;
  maxN: number;
  lastAt: number;
  sourceSessionId: string | null;
}

/** Net XP per base key. */
export function ledgerBalances(existing: readonly LedgerEntry[]): Map<string, BaseState> {
  const out = new Map<string, BaseState>();
  for (const row of existing) {
    const { base, n } = parseLedgerKey(row.key);
    const prior = out.get(base);
    if (!prior) {
      out.set(base, { net: row.xp, maxN: n, lastAt: row.at, sourceSessionId: row.sourceSessionId });
      continue;
    }
    prior.net += row.xp;
    if (n > prior.maxN) prior.maxN = n;
    if (row.at > prior.lastAt) prior.lastAt = row.at;
    if (prior.sourceSessionId === null) prior.sourceSessionId = row.sourceSessionId;
  }
  return out;
}

export function ledgerTotal(existing: readonly LedgerEntry[]): number {
  return existing.reduce((sum, row) => sum + row.xp, 0);
}

/**
 * Rows to append so the ledger nets to the targets. Achievement keys are never reversed (sticky), and keys
 * with an unknown prefix are never touched.
 */
export function reconcileLedger(existing: readonly LedgerEntry[], targets: readonly RewardTarget[]): LedgerEntry[] {
  const balances = ledgerBalances(existing);
  const wanted = new Map<string, RewardTarget>();
  for (const t of targets) {
    const prior = wanted.get(t.key);
    // Duplicate keys: the larger award wins, then the earlier instant (deterministic either way).
    if (!prior || t.xp > prior.xp || (t.xp === prior.xp && t.at < prior.at)) wanted.set(t.key, t);
  }

  const rows: LedgerEntry[] = [];
  for (const t of wanted.values()) {
    const state = balances.get(t.key);
    const delta = t.xp - (state?.net ?? 0);
    if (delta === 0 || (delta < 0 && t.key.startsWith("achievement:"))) continue;
    rows.push({
      key: `${t.key}#${(state?.maxN ?? 0) + 1}`,
      rule: delta < 0 ? "reversal" : t.rule,
      xp: delta,
      sourceSessionId: t.sourceSessionId ?? state?.sourceSessionId ?? null,
      at: t.at,
    });
  }
  for (const [base, state] of balances) {
    if (wanted.has(base) || state.net === 0) continue;
    const prefix = base.slice(0, base.indexOf(":"));
    if (!KNOWN_PREFIXES.has(prefix) || prefix === "achievement") continue;
    rows.push({ key: `${base}#${state.maxN + 1}`, rule: "reversal", xp: -state.net, sourceSessionId: state.sourceSessionId, at: state.lastAt });
  }
  return rows.sort((a, b) => a.at - b.at || a.key.localeCompare(b.key));
}
