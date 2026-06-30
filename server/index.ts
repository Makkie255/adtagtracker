import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { ensureSeed } from "./seed";
import { startScheduler, resetStaleScans } from "./scheduler";

// Fail-fast on missing required env vars in production
if (process.env.NODE_ENV === "production") {
  const required = ["DATABASE_URL", "SESSION_SECRET", "APP_URL"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`\n❌ Missing required production env vars: ${missing.join(", ")}\nSet them in .env and restart.\n`);
    process.exit(1);
  }
}

const app = express();
app.set("trust proxy", 1); // honor X-Forwarded-* behind nginx

// Security headers. CSP is opt-out by default because the Vite dev server
// inlines scripts; we tighten it in production where the bundle is static.
const isHttps = process.env.APP_URL?.startsWith("https://");
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === "production"
        ? {
            useDefaults: false, // manage all directives explicitly so we control upgrade-insecure-requests
            directives: {
              "default-src": ["'self'"],
              "base-uri": ["'self'"],
              "form-action": ["'self'"],
              "frame-ancestors": ["'self'"],
              "object-src": ["'none'"],
              "script-src": ["'self'", "'unsafe-inline'"],
              "script-src-attr": ["'none'"],
              "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
              "img-src": ["'self'", "data:", "https:"],
              "connect-src": ["'self'", "https:"],
              "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
              // only upgrade HTTP→HTTPS when the app is actually served over HTTPS
              ...(isHttps && { "upgrade-insecure-requests": [] }),
            },
          }
        : false,
    crossOriginEmbedderPolicy: false, // allows the runtime-error-modal iframe in dev
  }),
);

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  limit: "1mb",
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await ensureSeed();
  await resetStaleScans();
  const server = await registerRoutes(app);
  startScheduler();

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    if (status >= 500) console.error(err);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    ...(process.platform === "linux" && { reusePort: true }),
  }, () => {
    log(`serving on port ${port}`);
  });
})();
