"use client";

import {
  ArrowDownToLine,
  Banknote,
  CircleDot,
  FileCheck2,
  Gavel,
  Settings2,
  Tag,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { zafra, type ActivityKind } from "@/lib/zafra";
import { useFmt, useT, type MessageKey } from "@/lib/i18n";
import { useAsyncData } from "@/lib/use-async";
import { ExplorerLink, Notice, Skeleton, cx } from "@/components/ui";

const KIND: Record<ActivityKind, { icon: LucideIcon; label: MessageKey; tile: string }> = {
  initialize: { icon: Settings2, label: "activity.initialize", tile: "bg-tile-lilac text-navy" },
  setPrice: { icon: Tag, label: "activity.setPrice", tile: "bg-tile-amber text-warn" },
  registerWarrant: { icon: FileCheck2, label: "activity.registerWarrant", tile: "bg-tile-sky text-info" },
  depositLiquidity: { icon: ArrowDownToLine, label: "activity.depositLiquidity", tile: "bg-tile-lime text-brand-strong" },
  borrow: { icon: Banknote, label: "activity.borrow", tile: "bg-navy text-brand" },
  repay: { icon: Undo2, label: "activity.repay", tile: "bg-tile-lime text-brand-strong" },
  liquidate: { icon: Gavel, label: "activity.liquidate", tile: "bg-danger/10 text-danger" },
  other: { icon: CircleDot, label: "activity.other", tile: "bg-sunken text-mute" },
};

/** Latest program transactions on devnet, each one linked to the explorer. */
export function ActivityFeed({ limit = 8 }: { limit?: number }) {
  const t = useT();
  const f = useFmt();
  const { data, error, loading } = useAsyncData(() => zafra.getRecentActivity(limit), limit);

  if (error && !data) return <Notice tone="warn">{t("activity.error")}</Notice>;
  if (loading && !data)
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  if (!data?.length) return <p className="text-sm text-mute">{t("activity.empty")}</p>;

  return (
    <ol className="relative space-y-1">
      {data.map((a) => {
        const k = KIND[a.kind];
        const Icon = k.icon;
        return (
          <li key={a.signature} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-sunken">
            <span className={cx("grid size-9 shrink-0 place-items-center rounded-xl", k.tile)}>
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">
                {t(k.label)}
                {a.failed && <span className="ml-2 text-xs font-medium text-danger">{t("activity.failed")}</span>}
              </p>
              <p className="text-xs text-faint">{a.blockTime ? f.ago(a.blockTime) : "—"}</p>
            </div>
            <ExplorerLink kind="tx" value={a.signature} label={`${a.signature.slice(0, 4)}…${a.signature.slice(-4)}`} />
          </li>
        );
      })}
    </ol>
  );
}
