"use client";
import { useEffect, useRef } from "react";
export function RecordOnView({ record }: { record: () => Promise<void> }) {
  const sent = useRef(false);
  useEffect(() => {
    function visible() {
      if (document.visibilityState === "visible" && !sent.current) {
        sent.current = true;
        void record().catch(() => {
          sent.current = false;
        });
      }
    }
    visible();
    document.addEventListener("visibilitychange", visible);
    return () => document.removeEventListener("visibilitychange", visible);
  }, [record]);
  return null;
}
