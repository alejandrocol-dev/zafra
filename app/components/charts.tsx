"use client";

import type { ReactNode } from "react";

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

/** Receipt-style split: one bar showing the guarantee's value divided into
    what you get, the fee, and the pool's safety margin — no floating bars. */
export function SplitBar({
  total,
  segments,
  className,
  active = true,
}: {
  total: { label: ReactNode; display: ReactNode };
  segments: Array<{ label: ReactNode; value: number; display: ReactNode; kind: "net" | "fee" | "margin" }>;
  className?: string;
  /** When false, segments sit collapsed; flipping to true grows them in sequence. */
  active?: boolean;
}) {
  const sum = segments.reduce((s, x) => s + x.value, 0);
  const bg = {
    net: "var(--color-brand)",
    fee: "var(--color-warn)",
    margin: undefined,
  } as const;
  const marginStyle = { background: "repeating-linear-gradient(135deg, rgba(6,25,61,0.16) 0 6px, rgba(6,25,61,0.08) 6px 12px)" };

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-mute">{total.label}</p>
        <p className="font-display text-xl font-extrabold tabular-nums text-ink">{total.display}</p>
      </div>
      <div className="mt-3 flex h-16 gap-0.5 overflow-hidden rounded-xl sm:h-20">
        {segments.map((s, i) => (
          <div
            key={i}
            className="flex origin-left items-center justify-center text-sm font-extrabold transition-transform duration-700 ease-out sm:text-base"
            style={{
              width: `${(s.value / sum) * 100}%`,
              ...(s.kind === "margin" ? marginStyle : { backgroundColor: bg[s.kind] }),
              transform: active ? "scaleX(1)" : "scaleX(0)",
              transitionDelay: active ? `${i * 320}ms` : "0ms",
            }}
          >
            {s.value / sum > 0.14 && <span className={s.kind === "net" ? "text-navy" : "text-navy/60"}>{s.display}</span>}
          </div>
        ))}
      </div>
      <ul className="mt-5 space-y-2.5">
        {segments.map((s, i) => (
          <li
            key={i}
            className="flex items-center justify-between gap-4 text-sm transition-opacity duration-500"
            style={{ opacity: active ? 1 : 0, transitionDelay: active ? `${i * 320 + 500}ms` : "0ms" }}
          >
            <span className="flex min-w-0 items-center gap-2.5 text-mute">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={s.kind === "margin" ? marginStyle : { backgroundColor: bg[s.kind] }}
              />
              {s.label}
            </span>
            <span className="shrink-0 font-bold tabular-nums text-ink">{s.display}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
