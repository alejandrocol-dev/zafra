"use client";

import {
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import {
  Check,
  CircleCheck,
  CircleHelp,
  CircleX,
  Copy,
  ExternalLink,
  Info,
  LoaderCircle,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { explorerAddressUrl, explorerTxUrl, shortenAddress, shortenSignature } from "@/lib/format";
import { useT } from "@/lib/i18n";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export type Tone = "brand" | "warn" | "danger" | "info" | "neutral";

const toneText: Record<Tone, string> = {
  brand: "text-brand-strong",
  warn: "text-warn",
  danger: "text-danger",
  info: "text-info",
  neutral: "text-mute",
};
const toneSoft: Record<Tone, string> = {
  brand: "border-brand/30 bg-brand/10 text-brand-strong",
  warn: "border-warn/30 bg-warn/10 text-warn",
  danger: "border-danger/30 bg-danger/10 text-danger",
  info: "border-info/30 bg-info/10 text-info",
  neutral: "border-line-strong bg-ink/[0.03] text-mute",
};
const toneBar: Record<Tone, string> = {
  brand: "bg-brand",
  warn: "bg-warn",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-faint",
};
export { toneText, toneSoft, toneBar };

/* ---------------------------------- layout --------------------------------- */

export function Card({
  title,
  subtitle,
  actions,
  children,
  className,
  tone,
  tour,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  tone?: Tone;
  /** Anchor for the guided tour (`data-tour`). */
  tour?: string;
}) {
  return (
    <section
      data-tour={tour}
      className={cx(
        "rounded-(--radius-card) border bg-surface p-5 shadow-(--shadow-card) sm:p-6",
        tone === "warn" ? "border-warn/40" : tone === "danger" ? "border-danger/40" : "border-line",
        className,
      )}
    >
      {(title || actions) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="text-[15px] font-bold text-ink">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-sm text-mute">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div data-tour="page-header" className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm text-mute sm:text-base">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
  tip,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  tip?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-4 shadow-(--shadow-card)">
      <p className="flex items-center gap-1.5 text-xs font-medium text-mute">
        {label}
        {tip && <InfoTip text={tip} />}
      </p>
      <p className={cx("mt-1.5 font-display text-lg font-bold leading-tight tracking-tight xl:text-xl", tone ? toneText[tone] : "text-ink")}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-faint">{hint}</p>}
    </div>
  );
}

export function StatGrid({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  return (
    <div
      className={cx(
        "grid grid-cols-2 gap-3",
        cols === 3 && "sm:grid-cols-3",
        cols === 4 && "sm:grid-cols-4",
      )}
    >
      {children}
    </div>
  );
}

/** Label / value rows used in review dialogs and summaries. */
export function Rows({
  rows,
}: {
  rows: Array<{
    label: ReactNode;
    value: ReactNode;
    emphasis?: boolean;
    tone?: Tone;
    hint?: ReactNode;
  }>;
}) {
  return (
    <dl className="divide-y divide-line rounded-xl border border-line bg-sunken">
      {rows.map((r, i) => (
        <div key={i} className="flex items-start justify-between gap-4 px-4 py-2.5">
          <dt className="text-sm text-mute">{r.label}</dt>
          <dd className="text-right">
            <span
              className={cx(
                "text-sm tabular-nums",
                r.emphasis ? "text-base font-semibold" : "font-medium",
                r.tone ? toneText[r.tone] : "text-ink",
              )}
            >
              {r.value}
            </span>
            {r.hint && <span className="mt-0.5 block text-xs text-faint">{r.hint}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------------------------------- forms ---------------------------------- */

export function Field({
  label,
  hint,
  error,
  right,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="block">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink">{label}</span>
        {right}
      </div>
      {children}
      {error ? (
        <span className="mt-1.5 block text-xs text-danger">{error}</span>
      ) : (
        hint && <span className="mt-1.5 block text-xs text-faint">{hint}</span>
      )}
    </div>
  );
}

const inputClasses =
  "w-full rounded-xl border border-line-strong bg-sunken px-3.5 py-2.5 text-sm text-ink " +
  "placeholder:text-faint focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/30 " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger/60";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputClasses, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputClasses, "pr-8", props.className)} />;
}

export function AmountInput({
  suffix,
  onMax,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { suffix?: string; onMax?: () => void }) {
  const t = useT();
  return (
    <div className="relative">
      <input
        inputMode="decimal"
        {...props}
        className={cx(inputClasses, "pr-28 text-lg font-semibold", props.className)}
      />
      <div className="absolute inset-y-0 right-2 flex items-center gap-2">
        {onMax && (
          <button
            type="button"
            onClick={onMax}
            className="rounded-md bg-ink/[0.06] px-2 py-1 text-xs font-semibold text-ink hover:bg-ink/10"
          >
            {t("common.max")}
          </button>
        )}
        {suffix && <span className="pr-1 text-sm font-medium text-mute">{suffix}</span>}
      </div>
    </div>
  );
}

/* --------------------------------- buttons --------------------------------- */

type ButtonVariant = "primary" | "lime" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-navy text-white hover:bg-navy-soft font-semibold shadow-[0_1px_2px_rgba(6,25,61,0.2)]",
  lime: "bg-brand text-brand-ink hover:brightness-95 font-semibold shadow-[0_1px_2px_rgba(6,25,61,0.15)]",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-sunken font-medium",
  danger: "bg-danger text-white hover:bg-danger/85 font-semibold",
  ghost: "text-mute hover:text-ink hover:bg-ink/5 font-medium",
};
const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs rounded-lg",
  md: "h-10 px-4 text-sm rounded-xl",
  lg: "h-12 px-6 text-base rounded-xl",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button
      type={type}
      {...props}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/* --------------------------------- badges ---------------------------------- */

export function Badge({
  tone = "neutral",
  children,
  icon,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneSoft[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/* --------------------------------- notices --------------------------------- */

const noticeIcon: Record<Tone, ReactNode> = {
  brand: <CircleCheck className="size-4" aria-hidden />,
  warn: <TriangleAlert className="size-4" aria-hidden />,
  danger: <CircleX className="size-4" aria-hidden />,
  info: <Info className="size-4" aria-hidden />,
  neutral: <Info className="size-4" aria-hidden />,
};

export function Notice({
  tone = "info",
  title,
  children,
  action,
  className,
  tour,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  tour?: string;
}) {
  return (
    <div
      data-tour={tour}
      role={tone === "danger" || tone === "warn" ? "alert" : "status"}
      className={cx("flex gap-3 rounded-xl border px-4 py-3", toneSoft[tone], className)}
    >
      <span className="mt-0.5 shrink-0">{noticeIcon[tone]}</span>
      <div className="min-w-0 flex-1 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx("text-ink/80", !!title && "mt-0.5")}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

/* --------------------------------- icon tile ------------------------------- */

export type IconTileTone = "lime" | "sky" | "amber" | "lilac" | "navy" | "danger" | "brand";

const TILE_STYLE: Record<IconTileTone, string> = {
  brand: "bg-gradient-to-br from-brand to-[#57ad04] text-navy ring-white/25",
  lime: "bg-gradient-to-br from-[#f7fdea] to-tile-lime text-brand-strong ring-brand/25",
  sky: "bg-gradient-to-br from-[#f0f8fe] to-tile-sky text-info ring-info/25",
  amber: "bg-gradient-to-br from-[#fef9ea] to-tile-amber text-warn ring-warn/25",
  lilac: "bg-gradient-to-br from-[#f5f3fe] to-tile-lilac text-[#5b4bb3] ring-[#8b7bd8]/30",
  navy: "bg-gradient-to-br from-navy-soft to-navy text-brand ring-white/10",
  danger: "bg-gradient-to-br from-rose-50 to-rose-100/80 text-danger ring-danger/25",
};

const TILE_SIZE = { sm: "size-9 rounded-xl", md: "size-11 rounded-2xl", lg: "size-14 rounded-2xl" } as const;
const TILE_ICON = { sm: "size-[18px]", md: "size-5", lg: "size-6" } as const;

export function IconTile({
  icon: Icon,
  tone = "lime",
  size = "md",
  className,
  style,
}: {
  icon: LucideIcon;
  tone?: IconTileTone;
  size?: keyof typeof TILE_SIZE;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span style={style} className={cx("grid shrink-0 place-items-center shadow-sm ring-1 ring-inset", TILE_STYLE[tone], TILE_SIZE[size], className)}>
      <Icon className={TILE_ICON[size]} strokeWidth={2.1} aria-hidden />
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-(--radius-card) border border-dashed border-line-strong bg-surface/60 px-6 py-12 text-center">
      {icon && (
        <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-[#f7fdea] to-tile-lime text-brand-strong shadow-sm ring-1 ring-inset ring-brand/25">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {body && <p className="mt-1.5 max-w-md text-sm text-mute">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ------------------------------- skeleton / bar ---------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("av-skeleton rounded-lg", className)} />;
}

export function ProgressBar({ value, tone = "brand" }: { value: number; tone?: Tone }) {
  const pct = Math.min(Math.max(value, 0), 1) * 100;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-ink/[0.07]">
      <div className={cx("h-full rounded-full transition-all duration-500", toneBar[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

export type StepState = "done" | "active" | "todo";

export function Steps({ steps }: { steps: Array<{ label: string; state: StepState }> }) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((s, i) => (
        <li key={i} className="flex flex-1 items-center gap-2 last:flex-none">
          <span
            className={cx(
              "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold",
              s.state === "done" && "border-brand bg-brand text-brand-ink",
              s.state === "active" && "border-brand text-brand-strong",
              s.state === "todo" && "border-line-strong text-faint",
            )}
          >
            {s.state === "done" ? <Check className="size-3.5" aria-hidden /> : i + 1}
          </span>
          <span
            className={cx(
              "text-xs font-medium",
              s.state === "todo" ? "text-faint" : "text-ink",
            )}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <span className={cx("h-px flex-1", s.state === "done" ? "bg-brand/60" : "bg-line-strong")} />
          )}
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------ small helpers ------------------------------ */

export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={text}
        className="text-faint hover:text-mute focus-visible:text-mute"
      >
        <CircleHelp className="size-3.5" aria-hidden />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-56 -translate-x-1/2 rounded-lg border border-line-strong bg-elevated px-3 py-2 text-xs font-normal leading-snug text-ink shadow-lg group-focus-within:block group-hover:block"
      >
        {text}
      </span>
    </span>
  );
}

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 text-xs font-medium text-mute hover:text-ink"
      aria-label={label ?? t("common.copy")}
    >
      {copied ? <Check className="size-3.5 text-brand-strong" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {copied ? t("common.copied") : (label ?? t("common.copy"))}
    </button>
  );
}

export function ExplorerLink({
  kind,
  value,
  label,
}: {
  kind: "tx" | "address";
  value: string;
  label?: string;
}) {
  return (
    <a
      href={kind === "tx" ? explorerTxUrl(value) : explorerAddressUrl(value)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-mono text-xs font-medium text-brand-strong hover:underline"
    >
      {label ?? (kind === "tx" ? shortenSignature(value) : shortenAddress(value))}
      <ExternalLink className="size-3" aria-hidden />
    </a>
  );
}
