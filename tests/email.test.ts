import { describe, expect, it, vi } from "vitest";

import { emailConfig, sendEmail } from "@/lib/email";

const message = { to: "person@example.test", subject: "Hello", text: "Hi" };

describe("email modes", () => {
  it("is disabled unless switched on, mock without credentials, live with them", () => {
    expect(emailConfig({}).mode).toBe("disabled");
    expect(emailConfig({ EMAIL_ENABLED: "true" }).mode).toBe("mock");
    expect(emailConfig({ EMAIL_ENABLED: "true", RESEND_API_KEY: "re_x", EMAIL_FROM: "App <app@example.test>" }).mode).toBe("live");
  });

  it("never calls the provider when disabled or in mock mode", async () => {
    const fetchImpl = vi.fn();
    expect(await sendEmail(message, { mode: "disabled" }, fetchImpl)).toEqual({ status: "disabled" });
    expect(await sendEmail(message, { mode: "mock" }, fetchImpl)).toEqual({ status: "mock" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends live with the idempotency key and reports provider errors as failures", async () => {
    const ok = vi.fn<typeof fetch>(async () => Response.json({ id: "em_1" }));
    const live = { mode: "live" as const, apiKey: "re_x", from: "App <app@example.test>" };
    expect(await sendEmail({ ...message, idempotencyKey: "digest:1" }, live, ok)).toEqual({ status: "sent", id: "em_1" });
    const init = ok.mock.calls[0][1] ?? {};
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("digest:1");
    const bad = vi.fn<typeof fetch>(async () => Response.json({ message: "Domain not verified" }, { status: 403 }));
    expect(await sendEmail(message, live, bad)).toEqual({ status: "failed", error: "Domain not verified" });
  });
});
