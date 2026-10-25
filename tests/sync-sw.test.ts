import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

/** Runs public/sw.js against a stand-in worker scope and returns its event listeners. */
function loadWorker() {
  const listeners: Record<string, (event: unknown) => void> = {};
  const shown: { title: string; options: { data: { url: string } } }[] = [];
  const opened: string[] = [];
  const self = {
    location: { origin: "https://shifty.test" },
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      listeners[type] = fn;
    },
    registration: { showNotification: async (title: string, options: { data: { url: string } }) => void shown.push({ title, options }) },
    clients: { matchAll: async () => [], openWindow: async (url: string) => void opened.push(url) },
  };
  vm.runInNewContext(readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8"), { self, URL, console, caches: {}, fetch, setTimeout, clearTimeout });
  const push = async (data: unknown) => {
    let done: Promise<unknown> = Promise.resolve();
    listeners.push({ data: { json: () => data, text: () => "" }, waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
    return shown.at(-1)!.options.data.url;
  };
  const click = async (url: unknown) => {
    let done: Promise<unknown> = Promise.resolve();
    listeners.notificationclick({ notification: { close: () => {}, data: { url } }, waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
    return opened.at(-1);
  };
  return { push, click };
}

describe("service worker notifications", () => {
  it("keeps same-origin paths", async () => {
    const { push, click } = loadWorker();
    expect(await push({ title: "Rest", url: "/sessions/abc?x=1#top" })).toBe("/sessions/abc?x=1#top");
    expect(await click("/insights")).toBe("https://shifty.test/insights");
  });

  it("refuses anything that could leave the site", async () => {
    const { push, click } = loadWorker();
    for (const url of ["//evil.example/x", "/\\evil.example", "/\t/evil.example", "https://evil.example/", "javascript:alert(1)", "sessions", "", 42, null]) {
      expect(await push({ title: "x", url }), String(url)).toBe("/");
      expect(await click(url), String(url)).toBe("https://shifty.test/");
    }
  });
});
