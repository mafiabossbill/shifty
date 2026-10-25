import { z } from "zod";

import { ROLES } from "@/lib/permissions";

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
