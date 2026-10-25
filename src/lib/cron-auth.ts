import { timingSafeEqual } from "node:crypto";

/** Constant-time check of `Authorization: Bearer <CRON_SECRET>` for /api/cron/* routes. */
export function authorizedCron(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 16) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header ?? "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
