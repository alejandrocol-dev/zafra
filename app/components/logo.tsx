import Image from "next/image";
import { cx } from "@/components/ui";

/** Wheat-and-circuit mark (brand kit in public/brand). `white` = for dark backgrounds. */
export function ZafraMark({ className, white = false }: { className?: string; white?: boolean }) {
  return (
    <Image
      src={white ? "/brand/zafra-mark-white.png" : "/brand/zafra-mark.png"}
      alt=""
      aria-hidden
      width={320}
      height={320}
      priority
      className={cx("select-none", className)}
    />
  );
}

/** Horizontal lockup: mark + ZAFRA wordmark. */
export function ZafraLockup({ white = false, className }: { white?: boolean; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <ZafraMark white={white} className="size-9" />
      <Image
        src={white ? "/brand/zafra-wordmark-white.png" : "/brand/zafra-wordmark.png"}
        alt="Zafra"
        width={470}
        height={77}
        priority
        className="h-[15px] w-auto select-none"
      />
    </span>
  );
}
