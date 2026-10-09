"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react";
import { useCountUp, useInView, useReducedMotion } from "@/lib/use-motion";
import { cx } from "@/components/ui";

/** Fades and lifts its content in when it scrolls into view. */
export function Reveal({
  as: Tag = "div",
  delay = 0,
  className,
  children,
}: {
  as?: "div" | "li";
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const [ref, inView] = useInView<HTMLElement>();
  return (
    <Tag
      ref={ref as Ref<HTMLDivElement & HTMLLIElement>}
      className={cx("av-reveal", inView && "is-in", className)}
      style={{ "--d": `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}

/** A number that counts up from zero the first time it's seen. */
export function CountUp({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const [ref, inView] = useInView<HTMLSpanElement>("0px");
  const v = useCountUp(value, inView);
  return (
    <span ref={ref} className={cx("tabular-nums", className)}>
      {format(inView ? v : value)}
    </span>
  );
}

/** Cycles through `words`, animating each one in. Static under reduced motion. */
export function RotatingWord({ words, every = 2600 }: { words: string[]; every?: number }) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  const count = words.length;
  useEffect(() => {
    if (reduced || count < 2) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % count), every);
    return () => window.clearInterval(id);
  }, [reduced, count, every]);
  return (
    <span key={i} className="av-word inline-block">
      {words[i % count]}
    </span>
  );
}

/** Thin brand-coloured bar at the top that fills as the page scrolls. */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const doc = document.documentElement;
        const max = doc.scrollHeight - doc.clientHeight;
        el.style.transform = `scaleX(${max > 0 ? doc.scrollTop / max : 0})`;
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return <div ref={ref} aria-hidden className="fixed inset-x-0 top-0 z-50 h-[3px] origin-left scale-x-0 bg-brand" />;
}

/** Infinite horizontal scroll. Content is rendered twice; the copy is hidden from AT. */
export function Marquee({ children, className, speed = 40 }: { children: (copy: boolean) => ReactNode; className?: string; speed?: number }) {
  return (
    <div className={cx("group relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]", className)}>
      <div className="av-marquee flex w-max group-hover:[animation-play-state:paused]" style={{ animationDuration: `${speed}s` }}>
        <div className="flex shrink-0 items-center">{children(false)}</div>
        <div className="flex shrink-0 items-center" aria-hidden>
          {children(true)}
        </div>
      </div>
    </div>
  );
}
