import { ShiftActionError } from "@/lib/store/store";

/** The sentence to show for a failed store action. Never swallowed: callers toast or render it. */
export function actionMessage(error: unknown): string {
  if (error instanceof ShiftActionError) {
    if (error.error.code === "revision_mismatch") return "This session changed since you opened it. Review the latest version and try again.";
    return error.error.message;
  }
  if (error instanceof Error && error.message) return `${error.message} Try again.`;
  return "Something went wrong. Try again.";
}

export function conflictOf(error: unknown): string | null {
  return error instanceof ShiftActionError ? (error.error.conflictingSessionId ?? null) : null;
}

export function isRevisionMismatch(error: unknown): boolean {
  return error instanceof ShiftActionError && error.error.code === "revision_mismatch";
}
