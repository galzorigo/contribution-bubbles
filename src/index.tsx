import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { fetchContributions, type ContributionDay } from "./data";

/*
  contribution-dots
  A GitHub style contribution chart drawn as bubbles that spill over their neighbours.
  One column per week, one row per weekday. Busier days get bigger, stronger bubbles.

  <ContributionDots username="octocat" />
*/

export { fetchContributions, type ContributionDay };

/** Parts of the chart that take their own class names and inline styles */
export type ContributionDotsPart = "root" | "months" | "month" | "chart" | "total";

export type ContributionDotsProps = {
  // Data. Pass one of these

  /** GitHub username. The chart loads that user's past year by itself */
  username?: string;
  /** Your own days instead, as { date: "YYYY-MM-DD", count }. Takes priority over username */
  data?: ContributionDay[];

  // Size

  /** Width in px. Leave out to fill the parent */
  width?: number;
  /** How many weeks to show. Leave out to fit as many as the width allows */
  weeks?: number;
  /** Width of one week in px, used when weeks is not set. 7.5 fits a year in 400px */
  cellSize?: number;

  // Dots

  /** Dot color. Any CSS color, CSS variables included */
  color?: string;
  /** Opacity of the quietest and the busiest days */
  opacity?: [min: number, max: number];
  /** Opacity levels between those, like GitHub's four. 0 for a smooth fade */
  steps?: number;
  /** Diameter in px of the quietest day's dot */
  minSize?: number;
  /** Diameter in px of the busiest day's dot */
  maxSize?: number;

  // Labels

  /** Month names along the top */
  showMonths?: boolean;
  /** "1,234 contributions in the past year" under the chart */
  showTotal?: boolean;
  /** Font for both labels. Any CSS font-family */
  font?: string;
  /** Font for the month names. Defaults to font */
  monthFont?: string;
  /** Font for the total line. Defaults to font */
  totalFont?: string;
  /** Month name size in px */
  monthSize?: number;
  /** Total line size in px. Defaults to monthSize */
  totalSize?: number;
  /** Labels in capitals */
  uppercase?: boolean;
  /** Label color. Defaults to the surrounding text color */
  labelColor?: string;
  /** Space in px between the month names and the dots */
  monthGap?: number;
  /** Alignment of the total line */
  totalAlign?: "left" | "center" | "right";
  /** Your own wording for the total, e.g. (n) => `${n} commits this year` */
  formatTotal?: (total: number) => React.ReactNode;
  /** Language for month names and numbers, e.g. "de". Defaults to "en-US" */
  locale?: string;

  // States

  /** Shown while a username is loading. Defaults to empty space the size of the chart */
  loading?: React.ReactNode;
  /** Shown when loading fails or there is no activity. Defaults to nothing */
  fallback?: React.ReactNode;
  /** Called when loading a username fails. Without it, the error is logged to the console */
  onError?: (error: Error) => void;

  // Styling

  /** What screen readers announce. Defaults to the total */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Class names per part, for your own CSS or Tailwind */
  classNames?: Partial<Record<ContributionDotsPart, string>>;
  /** Inline styles per part, applied last so they win */
  styles?: Partial<Record<ContributionDotsPart, React.CSSProperties>>;
};

const DAY = 86400000;
const FALLBACK_WIDTH = 400; // first render, before the parent is measured
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// useLayoutEffect warns during server rendering in React 18, so use useEffect there
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type Status = "idle" | "loading" | "ready" | "error";

export function ContributionDots({
  username,
  data,
  width: fixedWidth,
  weeks: fixedWeeks,
  cellSize = 7.5,
  color = "#30a14e",
  opacity = [0.3, 0.9],
  steps = 4,
  minSize = 2.4,
  maxSize = 14.3,
  showMonths = true,
  showTotal = true,
  font = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  monthFont = font,
  totalFont = font,
  monthSize = 10,
  totalSize = monthSize,
  uppercase = true,
  labelColor,
  monthGap = 2,
  totalAlign = "left",
  formatTotal,
  locale = "en-US",
  loading,
  fallback = null,
  onError,
  label,
  className,
  style,
  classNames = {},
  styles = {},
}: ContributionDotsProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState(FALLBACK_WIDTH);
  const [loaded, setLoaded] = useState<ContributionDay[] | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const width = fixedWidth ?? measured;

  // Fill the parent when no width is given
  useIsomorphicLayoutEffect(() => {
    if (fixedWidth !== undefined) return;
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setMeasured(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fixedWidth]);

  // Load from GitHub when only a username is given
  useEffect(() => {
    if (data || !username) return;
    let cancelled = false;
    setStatus("loading");
    fetchContributions(username)
      .then((days) => {
        if (cancelled) return;
        setLoaded(days);
        setStatus("ready");
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setStatus("error");
        if (onErrorRef.current) onErrorRef.current(error);
        else console.warn(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [username, data]);

  // Clean input: valid dates only, counts as whole non-negative numbers
  const days = (data ?? loaded ?? []).filter(
    (d) => d && typeof d.date === "string" && DATE.test(d.date) && Number.isFinite(d.count),
  );

  const weeks = Math.max(1, Math.floor(fixedWeeks ?? width / cellSize));
  const step = width / weeks;
  const maxR = maxSize / 2;
  const minR = Math.min(minSize / 2, maxR);
  const pad = Math.max(0, maxR - step / 2); // room so edge bubbles aren't clipped
  const monthLine = Math.round(monthSize * 1.4);
  const totalLine = Math.round(totalSize * 1.4);
  const chartHeight = 7 * step + pad * 2;

  const rootStyle: React.CSSProperties = { width: fixedWidth ?? "100%", color: labelColor, ...style, ...styles.root };
  const rootClass = [className, classNames.root].filter(Boolean).join(" ") || undefined;
  const text: React.CSSProperties = { textTransform: uppercase ? "uppercase" : "none", letterSpacing: "normal" };

  const waiting = !data && username && (status === "idle" || status === "loading");
  const counts = days.map((d) => Math.max(0, d.count)).filter((n) => n > 0).sort((a, b) => a - b);

  // Loading: keep the chart's space so the page doesn't jump when it appears
  if (waiting) {
    const reserved = (showMonths ? monthLine + monthGap : 0) + chartHeight + (showTotal ? 8 + totalLine : 0);
    return (
      <div ref={ref} className={rootClass} style={{ ...rootStyle, minHeight: reserved }} aria-busy="true">
        {loading}
      </div>
    );
  }

  // Failed, or nothing to show
  if (status === "error" || counts.length === 0) {
    return (
      <div ref={ref} className={rootClass} style={rootStyle}>
        {fallback}
      </div>
    );
  }

  // Scale against the 98th percentile so one freak day can't flatten the rest
  const busy = counts[Math.floor((counts.length - 1) * 0.98)];

  // Weeks start on Sunday. Keep the most recent `weeks` columns, ending at the last day
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const last = toTime(sorted[sorted.length - 1].date);
  const firstSunday = last - new Date(last).getUTCDay() * DAY - (weeks - 1) * 7 * DAY;
  const cells = sorted
    .map((d) => {
      const t = toTime(d.date);
      return {
        ...d,
        count: Math.max(0, d.count),
        t,
        week: Math.floor((t - firstSunday) / (7 * DAY)),
        weekday: new Date(t).getUTCDay(),
      };
    })
    .filter((c) => c.t >= firstSunday);

  // Month labels at equal gaps, each within days of its month's real start
  const monthName = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
  const months: { key: string; x: number; text: string }[] = [];
  if (showMonths) {
    for (const c of cells) {
      if (!c.date.endsWith("-01")) continue;
      const x = ((c.week * 7 + c.weekday + 0.5) / (weeks * 7)) * width;
      if (x > width * 0.94) continue; // a label needs about 6% of the width before the edge
      months.push({ key: c.date, x, text: monthName.format(c.t) });
    }
    if (months.length > 2) {
      const first = months[0].x;
      const gap = (months[months.length - 1].x - first) / (months.length - 1);
      months.forEach((m, i) => (m.x = first + gap * i));
    }
  }

  const total = cells.reduce((sum, c) => sum + c.count, 0);
  const totalText = formatTotal
    ? formatTotal(total)
    : `${total.toLocaleString(locale)} contributions in the past year`;

  return (
    <div ref={ref} className={rootClass} style={rootStyle}>
      {showMonths && (
        <div
          aria-hidden
          className={classNames.months}
          style={{
            ...text,
            position: "relative",
            fontFamily: monthFont,
            fontSize: monthSize,
            lineHeight: `${monthLine}px`,
            height: monthLine,
            marginBottom: monthGap,
            ...styles.months,
          }}
        >
          {months.map((m) => (
            <span
              key={m.key}
              className={classNames.month}
              style={{ position: "absolute", top: 0, left: m.x, whiteSpace: "nowrap", ...styles.month }}
            >
              {m.text}
            </span>
          ))}
        </div>
      )}
      <svg
        width={width}
        height={chartHeight}
        viewBox={`0 ${-pad} ${width} ${chartHeight}`}
        role="img"
        aria-label={label ?? `${total.toLocaleString(locale)} contributions`}
        className={classNames.chart}
        style={{ display: "block", overflow: "visible", ...styles.chart }}
      >
        {cells
          .filter((c) => c.count > 0)
          .map((c) => {
            const share = Math.min(c.count / busy, 1);
            // Size grows close to linearly (power 0.9), so busy days read clearly bigger
            const r = Math.max(minR, maxR * share ** 0.9);
            // Opacity in GitHub style levels (quarters of a busy day by default)
            const level = steps > 0 ? Math.min(steps, Math.max(1, Math.ceil(share * steps))) : 0;
            const fade = steps > 1 ? (level - 1) / (steps - 1) : steps === 1 ? 1 : share;
            return (
              <circle
                key={c.date}
                cx={c.week * step + step / 2}
                cy={c.weekday * step + step / 2}
                r={r}
                fill={color}
                fillOpacity={opacity[0] + (opacity[1] - opacity[0]) * fade}
              />
            );
          })}
      </svg>
      {showTotal && (
        <p
          className={classNames.total}
          style={{
            ...text,
            margin: "8px 0 0",
            fontFamily: totalFont,
            fontSize: totalSize,
            lineHeight: `${totalLine}px`,
            textAlign: totalAlign,
            ...styles.total,
          }}
        >
          {totalText}
        </p>
      )}
    </div>
  );
}

function toTime(date: string) {
  return new Date(`${date}T00:00:00Z`).getTime();
}
