import crypto from "crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { ssoTicketsUsed, users, type User } from "@shared/schema";

// This tool no longer owns identity — the Internal Portal issues a short-lived,
// single-use HS256 ticket that we verify here and exchange for a local session.
// HS256 verification uses Node's crypto directly (no JWT dependency) so the
// verification path is small and auditable.

const AUDIENCE = "ad_tag_tracker";

export interface TicketClaims {
  sub: string; // Portal user ID
  email: string;
  username: string;
  roles: string[];
  aud: string;
  jti: string;
  iat: number;
  exp: number;
}

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

/**
 * Verify a Portal SSO ticket: HS256 signature (algorithm pinned), structural
 * validity, audience, and expiry. Returns the claims or throws on any failure.
 * Does NOT enforce single-use — call consumeTicketJti after this succeeds.
 */
export function verifyTicket(token: string, secret: string): TicketClaims {
  if (!secret) throw new Error("SSO secret not configured");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed token");
  const [headerB64, payloadB64, signatureB64] = parts;

  // Pin the algorithm from the header — reject anything but HS256 (blocks the
  // "alg: none" and algorithm-confusion classes of attack).
  const header = JSON.parse(base64UrlDecode(headerB64).toString("utf8"));
  if (header.alg !== "HS256" || (header.typ && header.typ !== "JWT")) {
    throw new Error("Unexpected token algorithm");
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  const provided = base64UrlDecode(signatureB64);
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    throw new Error("Bad signature");
  }

  const claims = JSON.parse(base64UrlDecode(payloadB64).toString("utf8")) as TicketClaims;
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== "number" || claims.exp < now) {
    throw new Error("Ticket expired");
  }
  if (claims.aud !== AUDIENCE) {
    throw new Error("Wrong audience");
  }
  if (!claims.sub || !claims.email || !claims.jti) {
    throw new Error("Missing required claims");
  }
  return claims;
}

/**
 * Record a ticket's jti so it can't be replayed. Returns false if the jti was
 * already used (i.e. this is a replay). Insert-before-login; the primary-key
 * conflict is the single-use guard.
 */
export async function consumeTicketJti(jti: string, expEpochSeconds: number): Promise<boolean> {
  const [row] = await db
    .insert(ssoTicketsUsed)
    .values({ jti, expiresAt: new Date(expEpochSeconds * 1000) })
    .onConflictDoNothing()
    .returning();
  return !!row;
}

/** Best-effort sweep of expired spent-ticket rows (called opportunistically). */
export async function purgeExpiredTickets(): Promise<void> {
  await db.execute(sql`DELETE FROM sso_tickets_used WHERE expires_at < now()`);
}

/**
 * Create or update the local user profile from verified ticket claims. Matches
 * an existing row first by portalUserId, then by normalized email (so rows that
 * predate SSO keep their site-ownership FKs). Roles come from the Portal.
 */
export async function upsertUserFromTicket(claims: TicketClaims): Promise<User> {
  const email = claims.email.trim().toLowerCase();
  const name = claims.username || email;
  const roles = Array.isArray(claims.roles) ? claims.roles : [];

  const [byPortalId] = await db
    .select()
    .from(users)
    .where(eq(users.portalUserId, claims.sub));
  const existing =
    byPortalId ??
    (await db.select().from(users).where(sql`lower(${users.email}) = ${email}`))[0];

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({ portalUserId: claims.sub, email, name, roles, lastLoginAt: new Date() })
      .where(eq(users.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(users)
    .values({ portalUserId: claims.sub, email, name, roles, lastLoginAt: new Date() })
    .returning();
  return created;
}

/**
 * Validate a post-login redirect target: same-origin relative path only. Blocks
 * open redirects like "//evil.com", "https://evil.com", or CRLF injection.
 */
export function safeNextPath(next: unknown): string {
  if (typeof next === "string" && /^\/(?!\/)[^\r\n]*$/.test(next)) {
    return next;
  }
  return "/";
}
