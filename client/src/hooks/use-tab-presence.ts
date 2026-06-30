import { useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

const HEARTBEAT_MS = 30_000;

/** Ping the server while this browser tab is visible so admins see the user as Online. */
export function useTabPresence(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let interval: ReturnType<typeof setInterval> | undefined;

    const ping = () => {
      if (document.visibilityState !== "visible") return;
      apiRequest("POST", "/api/auth/presence").catch(() => {});
    };

    ping();
    interval = setInterval(ping, HEARTBEAT_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);
}
