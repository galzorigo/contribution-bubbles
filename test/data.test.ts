import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

const ok = (contributions: unknown) =>
  vi.fn(async () => new Response(JSON.stringify({ total: {}, contributions }), { status: 200 }));

describe("fetchContributions", () => {
  it("returns plain days", async () => {
    vi.stubGlobal("fetch", ok([{ date: "2026-10-01", count: 2, level: 1 }]));
    const { fetchContributions } = await import("../src/data");
    expect(await fetchContributions("octocat")).toEqual([{ date: "2026-10-01", count: 2 }]);
  });

  it("shares one request between calls for the same user", async () => {
    const fetch = ok([]);
    vi.stubGlobal("fetch", fetch);
    const { fetchContributions } = await import("../src/data");
    await Promise.all([fetchContributions("Octocat"), fetchContributions("octocat ")]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("explains a missing user and retries next time", async () => {
    const fetch = vi.fn(async () => new Response("", { status: 404 }));
    vi.stubGlobal("fetch", fetch);
    const { fetchContributions } = await import("../src/data");
    await expect(fetchContributions("nobody")).rejects.toThrow(/not found/);
    await expect(fetchContributions("nobody")).rejects.toThrow(/not found/);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("rejects an empty username without a request", async () => {
    const fetch = ok([]);
    vi.stubGlobal("fetch", fetch);
    const { fetchContributions } = await import("../src/data");
    await expect(fetchContributions("  ")).rejects.toThrow(/empty/);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("build output", () => {
  it("marks only the component as client code", () => {
    expect(readFileSync("dist/index.js", "utf8").startsWith('"use client"')).toBe(true);
    expect(readFileSync("dist/server.js", "utf8")).not.toContain("use client");
  });
});
