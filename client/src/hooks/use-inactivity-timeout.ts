import { useEffect, useRef, useCallback } from "react";

/**
 * Calls onTimeout after `minutes` of user inactivity.
 * Listens for: mousemove, keydown, click, touchstart, scroll
 */
export function useInactivityTimeout(onTimeout: () => void, minutes = 15) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ms = minutes * 60 * 1000;

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(onTimeout, ms);
  }, [onTimeout, ms]);

  useEffect(() => {
    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, reset));
    reset();

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [reset]);
}
