import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildManifest } from "@/lib/pwa/manifest";

const root = process.cwd();
const sw = readFileSync(path.join(root, "public/sw.js"), "utf8");

function pngInfo(file: string) {
  const data = readFileSync(path.join(root, file));
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20), colorType: data[25] };
}

describe("PWA", () => {
  it("manifest uses relative URLs only (works on any domain)", () => {
    const manifest = buildManifest();
    const urls = [manifest.start_url, manifest.scope, manifest.id, ...(manifest.icons ?? []).map((i) => i.src)];
    for (const url of urls) expect(url?.startsWith("/")).toBe(true);
    expect(JSON.stringify(manifest)).not.toMatch(/https?:\/\//);
    expect(manifest.display).toBe("standalone");
  });

  it("ships any + maskable icons as RGBA PNGs of the declared size", () => {
    for (const icon of buildManifest().icons ?? []) {
      const [w, h] = (icon.sizes ?? "").split("x").map(Number);
      const info = pngInfo(path.join("public", icon.src));
      expect(info).toEqual({ width: w, height: h, colorType: 6 });
    }
    expect((buildManifest().icons ?? []).some((i) => i.purpose === "maskable")).toBe(true);
  });

  it("service worker only handles same-origin navigations and caches nothing else", () => {
    expect(sw).toMatch(/request\.mode !== "navigate"/);
    expect(sw).toMatch(/origin !== self\.location\.origin/);
    expect(sw).not.toMatch(/cache\.put\(/);
    expect(sw).not.toMatch(/\/api\//);
    // Only the offline page and one icon are precached.
    expect(sw).toMatch(/const PRECACHE = \[OFFLINE_URL, "\/icons\/icon-192\.png"\]/);
  });
});
