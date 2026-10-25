import { z } from "zod";

import { ROLES } from "@/lib/permissions";
import { achievementSchema, activitySchema, companionSchema, ledgerEntrySchema, placeSchema, projectSchema, settingsSchema } from "@/lib/shifts/profile";
import { MAX_PUSH_BATCH } from "@/lib/sync/contract";

/**
 * Zod schemas for every request body. Messages are sentences a person can act on;
 * route handlers return the first one (lib/api firstIssue).
 */

export const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Use a valid date (YYYY-MM-DD)." });
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Keep it under ${max.toLocaleString("en")} characters.` })
    .transform((value) => (value === "" ? null : value))
    .nullable();


// ── Team ──────────────────────────────────────────────────────────────────────

const role = z.enum(ROLES, { error: "Choose a role." });

export const inviteSchema = z.object({
  // Trim and lowercase first, then check the format (z.email() alone would reject " a@b.co").
  email: z.string({ error: "Enter a valid email address." }).trim().toLowerCase().pipe(z.email({ error: "Enter a valid email address." })),
  role: role.default("member"),
});

export const memberPatchSchema = z
  .object({ role, active: z.boolean() })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, { error: "Nothing to update." });

// ── Workspaces (SaaS tenancy) ─────────────────────────────────────────────────

export const workspaceSchema = z
  .object({
    name: z
      .string({ error: "Name your workspace." })
      .trim()
      .min(2, { error: "Workspace names are 2 to 80 characters." })
      .max(80, { error: "Workspace names are 2 to 80 characters." }),
  })
  .strict();

// ── Account ───────────────────────────────────────────────────────────────────

export const accountDeleteSchema = z
  .object({ confirm_email: z.string({ error: "Type your email address to confirm." }).trim().min(1, { error: "Type your email address to confirm." }) })
  .strict();

// ── Sync (src/lib/sync/contract.ts) ───────────────────────────────────────────

/** POST /api/sync/events. Each event is parsed on its own (parseShiftEvent), so one bad event can't block the rest. */
export const syncPushSchema = z
  .object({
    events: z
      .array(z.unknown(), { error: "Send the events as a list." })
      .min(1, { error: "Send at least one event." })
      .max(MAX_PUSH_BATCH, { error: `Send at most ${MAX_PUSH_BATCH} events at a time.` }),
  })
  .strict();

/**
 * PUT /api/sync/profile. Every object is strict: owner fields (user_id, organization_id) come from the session,
 * never from the body, so sending one is refused as an unknown field.
 */
export const profilePutSchema = z
  .object({
    settings: settingsSchema.strict(),
    companion: companionSchema.strict(),
    projects: z.array(projectSchema.strict()).max(500, { error: "Send at most 500 projects at a time." }),
    places: z.array(placeSchema.strict()).max(200, { error: "Send at most 200 places at a time." }),
    activities: z.array(activitySchema.strict()).max(2000, { error: "Send at most 2,000 activities at a time." }),
    ledger: z.array(ledgerEntrySchema.strict()).max(5000, { error: "Send at most 5,000 ledger rows at a time." }),
    achievements: z.array(achievementSchema.strict()).max(200, { error: "Send at most 200 achievements at a time." }),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, { error: "Nothing to save." });
export type ProfilePut = z.infer<typeof profilePutSchema>;
