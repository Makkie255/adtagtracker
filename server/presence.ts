import { USER_TAB_ONLINE_THRESHOLD_MS } from "@shared/user-activity";

const lastSeenByUser = new Map<string, number>();

export function markUserPresent(userId: string, at = Date.now()) {
  lastSeenByUser.set(userId, at);
}

export function isUserPresent(userId: string, now = Date.now()): boolean {
  const lastSeen = lastSeenByUser.get(userId);
  if (!lastSeen) return false;
  return now - lastSeen <= USER_TAB_ONLINE_THRESHOLD_MS;
}
