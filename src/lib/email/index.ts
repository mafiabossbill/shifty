import "server-only";

import { logEvent } from "@/lib/log";

/**
 * Transactional email with the factory's integration modes:
 *   disabled  EMAIL_ENABLED unset/false        → nothing sent, nothing logged as sent
 *   mock      EMAIL_ENABLED=true, no API key   → logged with status "mock", never leaves the server
 *   live      EMAIL_ENABLED=true + RESEND_API_KEY + EMAIL_FROM → sent through Resend's HTTP API
 * Auth emails (confirmations, resets) are Supabase's job: configure SMTP on the company domain there.
 */
export type EmailMode = "disabled" | "mock" | "live";

export interface EmailConfig {
  mode: EmailMode;
  apiKey?: string;
  from?: string;
}

export function emailConfig(env: Record<string, string | undefined> = process.env): EmailConfig {
  if (env.EMAIL_ENABLED?.trim() !== "true") return { mode: "disabled" };
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return { mode: "mock" };
  return { mode: "live", apiKey, from };
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Provider idempotency key (e.g. `digest:<org>:<period>:<user>`): a retried send isn't delivered twice. */
  idempotencyKey?: string;
}

export type EmailResult = { status: "disabled" | "mock" | "sent"; id?: string } | { status: "failed"; error: string };

export async function sendEmail(message: EmailMessage, config = emailConfig(), fetchImpl: typeof fetch = fetch): Promise<EmailResult> {
  if (config.mode === "disabled") return { status: "disabled" };
  if (config.mode === "mock") {
    logEvent("info", "email.mock", { subjectLength: message.subject.length });
    return { status: "mock" };
  }
  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
      },
      body: JSON.stringify({ from: config.from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!response.ok) {
      logEvent("error", "email.failed", { status: response.status });
      return { status: "failed", error: body?.message ?? `HTTP ${response.status}` };
    }
    logEvent("info", "email.sent", { id: body?.id ?? null });
    return { status: "sent", id: body?.id };
  } catch (error) {
    logEvent("error", "email.failed", { reason: (error as Error).name });
    return { status: "failed", error: (error as Error).message };
  }
}
