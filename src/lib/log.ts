/**
 * Structured one-line JSON logs (Vercel keeps stdout). Pass ids and counts only:
 * never tokens, secrets, emails, phone numbers or message bodies.
 */
export type LogFields = Record<string, string | number | boolean | null | undefined>;

export function logEvent(level: "info" | "warn" | "error", event: string, fields: LogFields = {}): void {
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
