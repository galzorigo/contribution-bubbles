import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ContributionBubbles, type ContributionDay } from "../src/index";

// A steady year: a few contributions every weekday, quiet weekends
function year(): ContributionDay[] {
  const days: ContributionDay[] = [];
  const end = Date.UTC(2026, 9, 5);
  for (let i = 364; i >= 0; i--) {
    const d = new Date(end - i * 86400000);
    const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    days.push({ date: d.toISOString().slice(0, 10), count: weekend ? 0 : (i % 5) + 1 });
  }
  return days;
}

const render = (props: Parameters<typeof ContributionBubbles>[0]) =>
  renderToString(createElement(ContributionBubbles, props));
const circles = (html: string) => (html.match(/<circle/g) ?? []).length;
const columns = (html: string) => new Set([...html.matchAll(/cx="([^"]+)"/g)].map((m) => m[1])).size;

describe("ContributionBubbles", () => {
  it("draws a dot for every active day and the total", () => {
    const data = year();
    const html = render({ data, width: 400 });
    const active = data.filter((d) => d.count > 0);
    expect(circles(html)).toBe(active.length);
    const total = active.reduce((s, d) => s + d.count, 0);
    expect(html).toContain(`${total.toLocaleString("en-US")} contributions in the past year`);
  });

  it("fits a year in 400px by default", () => {
    expect(columns(render({ data: year(), width: 400 }))).toBe(53);
  });

  it("shows exactly `weeks` columns when set", () => {
    expect(columns(render({ data: year(), width: 400, weeks: 20 }))).toBe(20);
  });

  it("formats months by locale", () => {
    const html = render({ data: year(), width: 400, locale: "de" });
    expect(html).toMatch(/Dez/);
  });

  it("supports custom total wording, alignment and per part styles", () => {
    const html = render({
      data: year(),
      width: 400,
      totalAlign: "center",
      formatTotal: (n) => `${n} commits`,
      classNames: { total: "my-total" },
      styles: { total: { color: "red" } },
    });
    expect(html).toMatch(/class="my-total"[^>]*text-align:center[^>]*color:red/);
    expect(html).toMatch(/\d+ commits</);
  });

  it("hides labels when asked", () => {
    const html = render({ data: year(), width: 400, showMonths: false, showTotal: false });
    expect(html).not.toContain("<p");
    expect(html).not.toMatch(/aria-hidden="true"/);
  });

  it("ignores invalid rows instead of crashing", () => {
    const data = [
      { date: "2026-10-01", count: 3 },
      { date: "not a date", count: 9 },
      { date: "2026-10-02", count: Number.NaN },
      { date: "2026-10-03", count: -4 },
    ] as ContributionDay[];
    expect(circles(render({ data, width: 400 }))).toBe(1);
  });

  it("shows the fallback when there is no activity", () => {
    const html = render({ data: [{ date: "2026-10-01", count: 0 }], fallback: "Nothing yet" });
    expect(html).toContain("Nothing yet");
    expect(circles(html)).toBe(0);
  });

  it("reserves space and shows loading content while a username loads", () => {
    const html = render({ username: "octocat", width: 400, loading: "Loading" });
    expect(html).toContain("Loading");
    expect(html).toContain('aria-busy="true"');
    expect(html).toMatch(/min-height:\d/);
  });
});
