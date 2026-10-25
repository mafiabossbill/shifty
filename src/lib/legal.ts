/**
 * Everything the legal pages say about who runs the app, in one place. Fill every [bracketed]
 * value before launch: `npm run legal:check` fails while any remain, and `scripts/factory/release
 * preflight` runs it. The pages (/privacy, /terms, /cookies, /data-deletion) read only from here.
 * Have a lawyer read the pages once per product; this template is a sound default, not legal advice.
 */
export const LEGAL = {
  /** Legal entity that runs the service (the data controller). */
  operator: "[Company legal name]",
  address: "[Registered address]",
  /** Answers privacy and data requests; shown on every legal page. */
  contactEmail: "[privacy@yourdomain.com]",
  /** Law that governs the terms and the regulator people can complain to. */
  jurisdiction: "[Country, e.g. the United Republic of Tanzania]",
  regulator: "[Data protection authority, e.g. the Personal Data Protection Commission (PDPC)]",
  /** Date the current privacy policy and terms took effect (YYYY-MM-DD). Bump it on every material change. */
  effectiveDate: "[YYYY-MM-DD]",
  minimumAge: 18,
  /** Service providers that process personal data for us. Add each integration you turn on (email, SMS, payments). */
  processors: [
    { name: "Vercel Inc.", purpose: "Hosting and content delivery", location: "United States / European Union" },
    { name: "Supabase Inc.", purpose: "Database, sign-in and file storage", location: "[Supabase project region]" },
  ],
  /** Days, shown in the policy. Match them to reality (Supabase backup retention, log drains). */
  retention: { deletionCompletesWithinDays: 30, requestReplyWithinDays: 7, serverLogsDays: 30, backupsDays: 7 },
} as const;

export type LegalConfig = typeof LEGAL;

/** Every value still holding a [placeholder], as dotted paths. Empty means ready to publish. */
export function legalPlaceholders(config: unknown = LEGAL, prefix = ""): string[] {
  if (typeof config === "string") return /\[[^\]]+\]/.test(config) ? [prefix] : [];
  if (Array.isArray(config)) return config.flatMap((v, i) => legalPlaceholders(v, `${prefix}[${i}]`));
  if (config && typeof config === "object") {
    return Object.entries(config).flatMap(([k, v]) => legalPlaceholders(v, prefix ? `${prefix}.${k}` : k));
  }
  return [];
}

/** Version string stored with each sign-up's consent (the effective date of the terms they accepted). */
export const TERMS_VERSION = LEGAL.effectiveDate;

export const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/cookies", label: "Cookies" },
  { href: "/data-deletion", label: "Delete your data" },
] as const;
