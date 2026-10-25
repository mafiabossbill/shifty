import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { authorizedCron } from "@/lib/cron-auth";

const root = process.cwd();

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : /\.(ts|tsx|mjs)$/.test(name) ? [full] : [];
  });
}

/** Variables the platform sets itself; everything else must be documented. */
const PLATFORM = new Set(["NODE_ENV", "VERCEL_ENV", "VERCEL_GIT_COMMIT_SHA"]);

describe("configuration", () => {
  const example = readFileSync(path.join(root, ".env.example"), "utf8");
  const declared = new Set([...example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]));

  it("documents every environment variable the code reads in .env.example (no hidden config)", () => {
    const used = new Set<string>();
    for (const file of [...files(path.join(root, "src")), ...files(path.join(root, "scripts"))]) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/\b(?:process\.)?env\.([A-Z][A-Z0-9_]+)/g)) used.add(m[1]);
    }
    const missing = [...used].filter((name) => !declared.has(name) && !PLATFORM.has(name));
    expect(missing).toEqual([]);
  });

  it("tags every variable with a class, and never ships a secret to the browser", () => {
    const lines = example.split("\n");
    for (const name of declared) {
      const index = lines.findIndex((line) => line.startsWith(`${name}=`));
      const block = lines.slice(Math.max(0, index - 4), index).join("\n");
      expect(block, name).toMatch(/\[(public|server|secret|scripts)\]/);
      const tag = [...block.matchAll(/\[(public|server|secret|scripts)\]/g)].at(-1)?.[1];
      if (name.startsWith("NEXT_PUBLIC_")) expect(tag, name).toBe("public");
      if (tag === "secret") expect(name.startsWith("NEXT_PUBLIC_"), name).toBe(false);
    }
  });

  it("checks the cron secret in constant time and refuses weak or missing secrets", () => {
    const secret = "a".repeat(32);
    expect(authorizedCron(`Bearer ${secret}`, secret)).toBe(true);
    expect(authorizedCron(`Bearer ${secret}x`, secret)).toBe(false);
    expect(authorizedCron(null, secret)).toBe(false);
    expect(authorizedCron("Bearer short", "short")).toBe(false);
    expect(authorizedCron("Bearer ", undefined)).toBe(false);
  });
});
