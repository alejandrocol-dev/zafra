"use client";

import type { ReactNode } from "react";
import { cx } from "@/components/ui";

/* Hand-rolled SVG charts: no chart dependency, styled with the design tokens. */

export interface DonutSegment {
  value: number;
  /** Any CSS color, e.g. "var(--color-navy)". */
  color: string;
  label: ReactNode;
  display?: ReactNode;
}

export function Donut({
  segments,
  size = 168,
  thickness = 18,
  center,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  center?: ReactNode;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + Math.max(x.value, 0), 0);
  const gap = segments.filter((s) => s.value > 0).length > 1 ? 3 : 0;
  const lengths = segments.map((s) => (total > 0 ? (Math.max(s.value, 0) / total) * c : 0));
  const offsets = lengths.map((_, i) => lengths.slice(0, i).reduce((a, b) => a + b, 0));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-sunken)" strokeWidth={thickness} />
        {total > 0 &&
          segments.map((s, i) => {
            const dash = Math.max(lengths[i] - gap, 0);
            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offsets[i]}
                strokeLinecap={dash > thickness ? "round" : "butt"}
                className="transition-[stroke-dasharray] duration-700"
              />
            );
          })}
      </svg>
      {center && <div className="absolute inset-0 grid place-items-center text-center">{center}</div>}
    </div>
  );
}

export function Legend({ items }: { items: Array<{ color: string; label: ReactNode; value?: ReactNode }> }) {
  return (
    <ul className="space-y-2.5">
      {items.map((it, i) => (
        <li key={i} className="flex items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-2 text-mute">
            <span className="size-2.5 rounded-full" style={{ background: it.color }} aria-hidden />
            {it.label}
          </span>
          {it.value !== undefined && <span className="font-semibold text-ink tabular-nums">{it.value}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Horizontal bars, one row per item (e.g. tons per warrant). */
export function BarList({
  items,
  max,
}: {
  items: Array<{ label: ReactNode; value: number; display: ReactNode; color: string; tag?: ReactNode }>;
  max?: number;
}) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-3">
      {items.map((it, i) => (
        <li key={i}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate font-mono text-xs font-semibold text-ink">{it.label}</span>
              {it.tag}
            </span>
            <span className="shrink-0 font-semibold text-ink tabular-nums">{it.display}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-sunken">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{ width: `${(it.value / top) * 100}%`, background: it.color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Vertical waterfall: start value, then deltas, ending in a total column. */
export function Waterfall({
  steps,
  height = 220,
  className,
  active = true,
}: {
  steps: Array<{ label: ReactNode; value: number; display: ReactNode; kind: "total" | "delta" | "result" }>;
  height?: number;
  className?: string;
  /** When false, bars sit collapsed; flipping to true grows them in sequence. */
  active?: boolean;
}) {
  const top = Math.max(...steps.map((s) => s.value));
  const bars = steps.reduce<Array<(typeof steps)[number] & { base: number; size: number; end: number }>>((acc, s) => {
    const prev = acc.length ? acc[acc.length - 1].end : 0;
    if (s.kind === "delta") {
      const end = prev + s.value;
      return [...acc, { ...s, base: Math.min(prev, end), size: Math.abs(s.value), end }];
    }
    return [...acc, { ...s, base: 0, size: s.value, end: s.value }];
  }, []);
  const color = {
    total: "var(--color-navy)",
    delta: "repeating-linear-gradient(135deg, rgba(6,25,61,0.16) 0 6px, rgba(6,25,61,0.08) 6px 12px)",
    result: "var(--color-brand)",
  };

  return (
    <div className={cx("grid gap-3", className)} style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {bars.map((b, i) => (
        <div key={i} className="flex flex-col">
          <div className="relative mt-7" style={{ height }}>
            <div
              className="absolute inset-x-1 origin-bottom rounded-lg transition-all duration-700 ease-out"
              style={{
                bottom: `${(b.base / top) * 100}%`,
                height: `max(${(b.size / top) * 100}%, 4px)`,
                background: color[b.kind],
                transform: active ? "scaleY(1)" : "scaleY(0)",
                transitionDelay: active ? `${i * 260}ms` : "0ms",
              }}
            />
            <span
              className="absolute inset-x-0 text-center text-xs font-bold text-ink tabular-nums transition-opacity duration-500 sm:text-sm"
              style={{
                bottom: `calc(${((b.base + b.size) / top) * 100}% + 6px)`,
                opacity: active ? 1 : 0,
                transitionDelay: active ? `${i * 260 + 450}ms` : "0ms",
              }}
            >
              {b.display}
            </span>
          </div>
          <p className="mt-3 border-t border-line pt-2 text-center text-[11px] leading-tight text-mute sm:text-xs">{b.label}</p>
        </div>
      ))}
    </div>
  );
}
