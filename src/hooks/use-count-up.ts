"use client";

import * as React from "react";

/**
 * Animated count-up that triggers when the element scrolls into view.
 * Handles numeric values with optional prefix/suffix and decimals.
 */
export function useCountUp(
  target: number,
  opts: { duration?: number; decimals?: number; start?: boolean } = {},
) {
  const { duration = 1600, decimals = 0, start = true } = opts;
  const [value, setValue] = React.useState(0);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;

    const ease = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const tick = (now: number) => {
      if (startTime === null) startTime = now;
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = ease(progress);
      setValue(target * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setValue(target);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, start]);

  return value.toFixed(decimals);
}

/**
 * Wraps children in an IntersectionObserver and exposes `inView`.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(
  options: IntersectionObserverInit = { threshold: 0.3 },
) {
  const ref = React.useRef<T>(null);
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        setInView(true);
        observer.disconnect();
      }
    }, options);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, inView };
}
