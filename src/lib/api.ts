import { NextResponse } from "next/server";
import type { z } from "zod";

/** Every error response has the same shape: { error: "Human sentence." }. */
export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** Parses a JSON body, returning undefined when it is missing or malformed. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/** The first validation problem as a sentence a person can act on. */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid request.";
  if (issue.code === "unrecognized_keys") return `Unknown field: ${issue.keys.join(", ")}.`;
  return issue.message;
}

export type RepoError = "not_found" | "invalid" | "forbidden" | "conflict";

/** `replayed`: a create that matched an earlier request's client_id returned the original row. */
export type RepoResult<T> = { ok: true; value: T; replayed?: boolean } | { ok: false; error: RepoError; message: string };

/** HTTP status for a failed repository call. */
export function repoErrorStatus(error: RepoError): number {
  switch (error) {
    case "not_found":
      return 404;
    case "forbidden":
      return 403;
    case "conflict":
      return 409;
    default:
      return 400;
  }
}
