"use client";

import { useEffect, useState } from "react";

const DURATION_MS = 700;

/**
 * Returns the value this tab last showed for a key (or null on first view, a blocked storage,
 * or reduced motion) and records the current one, so a gain animates exactly once.
 */
function takePrevious(storageKey: string, value: number): number | null {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    window.sessionStorage.setItem(storageKey, String(value));
    const previous = raw === null ? NaN : Number(raw);
    return Number.isFinite(previous) && previous !== value ? previous : null;
  } catch {
    // Storage can be blocked (private mode); the figure renders without animation.
    return null;
  }
}

/**
 * A figure that counts from the value this tab last showed to the current one, once, then
 * rests. The server-rendered value is what renders first and what assistive tech reads.
 */
export function CountUp({ value, storageKey }: { value: number; storageKey: string }) {
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const from = takePrevious(storageKey, value) ?? value;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = from === value ? 1 : Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 4);
      setShown(Math.round(from + (value - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [storageKey, value]);

  return <>{shown.toLocaleString("en-US")}</>;
}

/**
 * The XP or goal fill. After a gain it snaps to the width this tab last showed, then grows to
 * the current width with the fill's own transition; on first view it simply renders.
 */
export function BarFill({
  pct,
  storageKey,
  className,
}: {
  pct: number;
  storageKey: string;
  className?: string;
}) {
  const [state, setState] = useState({ width: pct, instant: false });

  useEffect(() => {
    const from = takePrevious(storageKey, pct);
    let second = 0;
    const first = requestAnimationFrame(() => {
      if (from === null) {
        setState({ width: pct, instant: false });
        return;
      }
      setState({ width: from, instant: true });
      second = requestAnimationFrame(() => setState({ width: pct, instant: false }));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [storageKey, pct]);

  return (
    <div
      className={className}
      style={{ width: `${state.width}%`, transition: state.instant ? "none" : undefined }}
    />
  );
}
