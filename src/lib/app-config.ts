/** "company": one organization from `npm run db:configure`, people join by invite.
 * "saas": people create their own workspaces (`scripts/bootstrap --saas` installs create_organization()). */
export type Tenancy = "company" | "saas";

/**
 * Product identity and locale defaults: the one file scripts/bootstrap rewrites
 * for a new app (name, short name, description, brand color, timezone, currency).
 * Everything else reads from here, so a rename is a one-file change.
 */
export const APP_CONFIG = {
  name: "SHIFTY",
  shortName: "SHIFTY",
  description: "A personal, session-first work tracker: clock in, track shifts across midnight, see beautiful reports, and grow a cozy companion.",
  /** Brand accent: used sparingly (logo mark, focus), never as decoration. */
  brandColor: "#6d5dfc",
  /** IANA zone that decides what "today" means for dates. Overridden by APP_TIMEZONE. */
  timezone: "Africa/Dar_es_Salaam",
  /** ISO 4217 code for new records. Stored amounts are never converted. */
  currency: "TZS",
  locale: "en",
  tenancy: "company" as Tenancy,
} as const;

export const APP_TIMEZONE = process.env.APP_TIMEZONE?.trim() || APP_CONFIG.timezone;

/** SaaS tenancy: /onboarding, POST /api/workspaces and "New workspace" in the switcher are on. */
export const SELF_SERVE = APP_CONFIG.tenancy === "saas";
