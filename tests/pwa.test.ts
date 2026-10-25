import { existsSync, readFileSync } from "node:fs";
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

  it("manifest: shortcuts, launch handling and categories", () => {
    const manifest = buildManifest();
    expect(manifest.id).toBe("/");
    expect(manifest.display_override).toEqual(["standalone"]);
    expect(manifest.launch_handler).toEqual({ client_mode: "navigate-existing" });
    expect(manifest.categories).toEqual(["productivity", "utilities"]);
    const shortcuts = manifest.shortcuts ?? [];
    expect(shortcuts.map((s) => [s.name, s.url])).toEqual([
      ["Clock in", "/?action=clock-in"],
      ["Sessions", "/sessions"],
      ["Insights", "/insights"],
    ]);
    for (const shortcut of shortcuts) {
      expect(shortcut.url.startsWith("/")).toBe(true);
      for (const icon of shortcut.icons ?? []) expect(existsSync(path.join(root, "public", icon.src))).toBe(true);
    }
  });

  it("service worker: versioned caches, never /api, /auth, other origins or non-GET (behaviour in pwa-sw.test.ts)", () => {
    expect(sw).toMatch(/const VERSION = "v\d+"/);
    expect(sw).toMatch(/shifty-shell-\$\{VERSION\}/);
    expect(sw).toMatch(/shifty-static-\$\{VERSION\}/);
    expect(sw).toMatch(/request\.method !== "GET"\) return/);
    expect(sw).toMatch(/url\.origin !== self\.location\.origin\) return/);
    expect(sw).toMatch(/NEVER_INTERCEPT = \[\/\^\\\/api/);
    expect(sw).toMatch(/credentials: "omit"/);
    expect(sw).toMatch(/"SKIP_WAITING"/);
  });

  it("serves /sw.js with no-cache so updates roll out", () => {
    const config = readFileSync(path.join(root, "next.config.ts"), "utf8");
    expect(config).toMatch(/source: "\/sw\.js"[\s\S]*?no-cache/);
  });

  it("offline page is self-contained (no external assets)", () => {
    const html = readFileSync(path.join(root, "public/offline.html"), "utf8");
    expect(html).not.toMatch(/<link[^>]+href=|<script[^>]+src=|<img[^>]+src=|url\(/);
    expect(html).not.toMatch(/https?:\/\//);
  });
});
