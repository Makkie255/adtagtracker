import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "./db";
import { users, type User } from "@shared/schema";

declare global {
  namespace Express {
    // Augment Passport's user type with our schema type
    interface User {
      id: string;
      email: string;
      name: string;
      role: string;
    }
  }
}

const PgStore = connectPgSimple(session);

const SESSION_SECRET = (() => {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production") {
    // index.ts should have already exited; this is belt-and-suspenders.
    throw new Error("SESSION_SECRET is required in production");
  }
  const s = crypto.randomBytes(32).toString("hex");
  console.warn("[auth] SESSION_SECRET not set; generated ephemeral one. Set it in .env to keep sessions across restarts.");
  return s;
})();

export function setupAuth(app: Express) {
  app.use(
    session({
      store: new PgStore({
        pool,
        tableName: "session",
        createTableIfMissing: false,
      }),
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.APP_URL?.startsWith("https://") ?? false,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      },
    }),
  );

  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const [row] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
          if (!row || !row.passwordHash) {
            return done(null, false, { message: "Invalid email or password" });
          }
          const ok = await bcrypt.compare(password, row.passwordHash);
          if (!ok) return done(null, false, { message: "Invalid email or password" });
          return done(null, toPublicUser(row));
        } catch (e) {
          return done(e as Error);
        }
      },
    ),
  );

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const [row] = await db.select().from(users).where(eq(users.id, id));
      if (!row) return done(null, false);
      done(null, toPublicUser(row));
    } catch (e) {
      done(e as Error);
    }
  });

  app.use(passport.initialize());
  app.use(passport.session());
}

export function toPublicUser(u: User) {
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 12);
}

// Middleware helpers
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ message: "Unauthorized" });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated && req.isAuthenticated() && (req.user as any)?.role === "admin") {
    return next();
  }
  return res.status(403).json({ message: "Admin only" });
}

const activityTouchByUser = new Map<string, number>();
const ACTIVITY_TOUCH_INTERVAL_MS = 60_000;

/** Updates lastLoginAt (used as last activity) for authenticated API requests, throttled per user. */
export function touchUserActivity(req: Request, _res: Response, next: NextFunction) {
  if (!req.isAuthenticated?.()) return next();
  const userId = (req.user as Express.User)?.id;
  if (!userId) return next();

  const now = Date.now();
  const lastTouch = activityTouchByUser.get(userId) ?? 0;
  if (now - lastTouch < ACTIVITY_TOUCH_INTERVAL_MS) return next();

  activityTouchByUser.set(userId, now);
  db.update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, userId))
    .catch((err) => console.error("[auth] activity touch failed:", err?.message || err));

  next();
}
