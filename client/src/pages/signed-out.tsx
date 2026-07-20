// Shown when someone reaches the app without a session. There is no local
// login — access is granted only by opening the tool from the Internal Portal,
// which hands off an SSO ticket. The Portal URL is injected at build time via
// VITE_PORTAL_URL (optional).
const PORTAL_URL = (import.meta.env.VITE_PORTAL_URL as string | undefined)?.replace(/\/$/, "");

export default function SignedOut() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center px-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Ad Tag Tracker</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Sign in through the Internal Portal to access Ad Tag Tracker. Open the
          portal and choose <span className="font-medium">Ad Tag Tracker</span> from
          the Tools menu.
        </p>
        {PORTAL_URL ? (
          <a
            href={PORTAL_URL}
            className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Go to the Internal Portal
          </a>
        ) : null}
      </div>
    </div>
  );
}
