"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

const REDUCED = "(prefers-reduced-motion: reduce)";

/** True when the user asked the OS for less motion. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(REDUCED);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
}

/** Flips to true (once) when the element scrolls into view. */
export function useInView<T extends Element>(margin = "0px 0px -10% 0px"): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return [ref, inView];
}

/** Eases a number from 0 to `target` once `active` turns true. */
export function useCountUp(target: number, active: boolean, ms = 1600): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = reduced ? 1 : Math.min(1, (now - start) / ms);
      setValue(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // rAF is throttled in background tabs; make sure we always land on the real value.
    const done = window.setTimeout(() => setValue(target), ms + 150);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(done);
    };
  }, [target, active, ms, reduced]);
  return active ? value : 0;
}
