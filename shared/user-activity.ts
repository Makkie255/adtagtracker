/** User is online when a tab heartbeat arrived within this window. */
export const USER_TAB_ONLINE_THRESHOLD_MS = 45 * 1000; // 45 seconds (heartbeat every 30s)

export function isUserOnline(lastPresenceAt: string | Date | null | undefined, now = Date.now()): boolean {
  if (!lastPresenceAt) return false;
  const at = lastPresenceAt instanceof Date ? lastPresenceAt.getTime() : new Date(lastPresenceAt).getTime();
  if (Number.isNaN(at)) return false;
  return now - at <= USER_TAB_ONLINE_THRESHOLD_MS;
}
