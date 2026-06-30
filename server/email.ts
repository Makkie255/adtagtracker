import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || "Ad Tag Tracker <onboarding@resend.dev>";
const APP_URL = process.env.APP_URL || "http://localhost:5001";

let resend: Resend | null = null;
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
} else {
  console.warn("[email] RESEND_API_KEY not set — emails will be logged to console instead of sent.");
}

async function send(opts: { to: string; subject: string; html: string; text: string }) {
  if (!resend) {
    console.log("\n=== [email:dev] would send ===");
    console.log("to:", opts.to);
    console.log("subject:", opts.subject);
    console.log("text:", opts.text);
    console.log("=== end ===\n");
    return { id: "dev-noop" };
  }
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
  if (error) {
    console.error("[email] send failed:", error);
    throw error;
  }
  return data;
}

const wrap = (innerHtml: string) => `<!doctype html>
<html><body style="background:#f6f7f9;font-family:Inter,system-ui,sans-serif;color:#0b0c0f;margin:0;padding:32px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e4e6eb;">
    <div style="font-size:18px;font-weight:600;margin-bottom:8px;">Ad Tag Tracker</div>
    ${innerHtml}
    <hr style="border:none;border-top:1px solid #e4e6eb;margin:32px 0 16px;"/>
    <div style="font-size:12px;color:#6b7280;">Sent by Ad Tag Tracker · <a href="${APP_URL}" style="color:#6b7280;">${APP_URL}</a></div>
  </div>
</body></html>`;

export async function sendInvitationEmail(opts: {
  to: string;
  name: string;
  token: string;
  invitedByName: string;
}) {
  const link = `${APP_URL}/accept-invite?token=${encodeURIComponent(opts.token)}`;
  const html = wrap(`
    <h2 style="margin:0 0 16px;font-size:22px;">You're invited to Ad Tag Tracker</h2>
    <p style="line-height:1.5;color:#374151;">
      ${escapeHtml(opts.invitedByName)} invited you (${escapeHtml(opts.to)}) to join Ad Tag Tracker.
      Click the button below to set a password and finish creating your account.
    </p>
    <p style="margin:24px 0;">
      <a href="${link}" style="background:#0b0c0f;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:500;">Accept invitation</a>
    </p>
    <p style="font-size:13px;color:#6b7280;">Or paste this link in your browser:<br/><span style="word-break:break-all;">${link}</span></p>
    <p style="font-size:13px;color:#6b7280;">This link expires in 7 days.</p>
  `);
  const text = `${opts.invitedByName} invited you to join Ad Tag Tracker.\n\nAccept here: ${link}\n\nThis link expires in 7 days.`;
  return send({ to: opts.to, subject: "You're invited to Ad Tag Tracker", html, text });
}

export async function sendPasswordResetEmail(opts: {
  to: string;
  name: string;
  token: string;
}) {
  const link = `${APP_URL}/reset-password?token=${encodeURIComponent(opts.token)}`;
  const html = wrap(`
    <h2 style="margin:0 0 16px;font-size:22px;">Reset your password</h2>
    <p style="line-height:1.5;color:#374151;">
      Hi ${escapeHtml(opts.name)} — we received a request to reset the password for your Ad Tag Tracker account.
      Click the button below to choose a new password.
    </p>
    <p style="margin:24px 0;">
      <a href="${link}" style="background:#0b0c0f;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:500;">Reset password</a>
    </p>
    <p style="font-size:13px;color:#6b7280;">Or paste this link in your browser:<br/><span style="word-break:break-all;">${link}</span></p>
    <p style="font-size:13px;color:#6b7280;">This link expires in 1 hour. If you didn't request a reset, you can safely ignore this email.</p>
  `);
  const text = `Reset your Ad Tag Tracker password:\n\n${link}\n\nThis link expires in 1 hour. If you didn't request a reset, ignore this email.`;
  return send({ to: opts.to, subject: "Reset your Ad Tag Tracker password", html, text });
}

export interface ChangeAlertItem {
  tagName: string;
  changeType: "added" | "removed" | "modified";
  identifiedIds?: string[] | null;
  tagUrl?: string | null;
}

export async function sendChangeAlertEmail(opts: {
  to: string[];
  siteDomain: string;
  siteId: string;
  changes: ChangeAlertItem[];
}) {
  if (!opts.to.length || !opts.changes.length) return;
  const rows = opts.changes
    .slice(0, 25)
    .map((c) => {
      const ids = (c.identifiedIds || []).join(", ");
      const label = c.changeType.toUpperCase();
      const color =
        c.changeType === "added" ? "#16a34a" : c.changeType === "removed" ? "#dc2626" : "#d97706";
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e4e6eb;vertical-align:top;">
          <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px;color:#0b0c0f;">${escapeHtml(c.tagName)}</div>
          ${ids ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;">${escapeHtml(ids)}</div>` : ""}
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #e4e6eb;vertical-align:top;text-align:right;">
          <span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${color}1a;color:${color};font-size:12px;font-weight:500;">${label}</span>
        </td>
      </tr>`;
    })
    .join("");
  const more = opts.changes.length > 25 ? `<p style="font-size:13px;color:#6b7280;text-align:center;">+ ${opts.changes.length - 25} more changes — view in the dashboard.</p>` : "";

  const siteLink = `${APP_URL}/sites/${opts.siteId}`;
  const html = wrap(`
    <h2 style="margin:0 0 8px;font-size:22px;">Tag changes detected on ${escapeHtml(opts.siteDomain)}</h2>
    <p style="line-height:1.5;color:#374151;">
      We just finished a scan and found ${opts.changes.length} tag change${opts.changes.length === 1 ? "" : "s"} on your site.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;border:1px solid #e4e6eb;border-radius:8px;overflow:hidden;">
      <tbody>${rows}</tbody>
    </table>
    ${more}
    <p style="margin-top:24px;">
      <a href="${siteLink}" style="color:#0b0c0f;font-weight:500;">View full change log & evidence →</a>
    </p>
  `);
  const text = `Tag changes on ${opts.siteDomain}:\n${opts.changes
    .slice(0, 25)
    .map((c) => `- ${c.changeType}: ${c.tagName}`)
    .join("\n")}\n\nView at ${siteLink}`;

  return send({
    to: opts.to.join(", "),
    subject: `Tag changes on ${opts.siteDomain} (${opts.changes.length})`,
    html,
    text,
  });
}

export async function sendScanFailureEmail(opts: {
  to: string[];
  siteDomain: string;
  siteId: string;
  error: string;
}) {
  if (!opts.to.length) return;
  const link = `${APP_URL}/sites/${opts.siteId}`;
  const html = wrap(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#dc2626;">Scan failed for ${escapeHtml(opts.siteDomain)}</h2>
    <p style="line-height:1.5;color:#374151;">A scheduled scan didn't complete:</p>
    <div style="background:#fee2e2;border-radius:8px;padding:12px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px;color:#7f1d1d;margin:12px 0;">${escapeHtml(opts.error)}</div>
    <p style="font-size:13px;color:#6b7280;">We'll retry on the next scheduled run. If this keeps failing, check that the site is reachable and not blocking server-side fetches.</p>
    <p style="margin-top:16px;"><a href="${link}" style="color:#0b0c0f;font-weight:500;">Open site → </a></p>
  `);
  const text = `Scan failed for ${opts.siteDomain}: ${opts.error}\n\nWe'll retry on the next scheduled run.\n\n${link}`;
  return send({
    to: opts.to.join(", "),
    subject: `Scan failed: ${opts.siteDomain}`,
    html,
    text,
  });
}

export async function sendMonthlyReportEmail(opts: {
  to: string;
  name: string;
  summary: {
    siteCount: number;
    totalScans: number;
    totalChanges: number;
    notableSites: { domain: string; changes: number }[];
  };
}) {
  const { summary } = opts;
  const rows = summary.notableSites
    .map(
      (s) =>
        `<tr><td style="padding:8px 0;color:#0b0c0f;">${escapeHtml(s.domain)}</td><td style="padding:8px 0;text-align:right;font-weight:500;">${s.changes} change${s.changes === 1 ? "" : "s"}</td></tr>`,
    )
    .join("");
  const html = wrap(`
    <h2 style="margin:0 0 16px;font-size:22px;">Your monthly Ad Tag Tracker report</h2>
    <p style="line-height:1.5;color:#374151;">Hi ${escapeHtml(opts.name)}, here's the activity across your sites this past month.</p>
    <div style="display:flex;gap:12px;margin:24px 0;">
      <div style="flex:1;background:#f6f7f9;border-radius:8px;padding:16px;"><div style="font-size:12px;color:#6b7280;">Sites</div><div style="font-size:22px;font-weight:600;">${summary.siteCount}</div></div>
      <div style="flex:1;background:#f6f7f9;border-radius:8px;padding:16px;"><div style="font-size:12px;color:#6b7280;">Scans</div><div style="font-size:22px;font-weight:600;">${summary.totalScans}</div></div>
      <div style="flex:1;background:#f6f7f9;border-radius:8px;padding:16px;"><div style="font-size:12px;color:#6b7280;">Changes</div><div style="font-size:22px;font-weight:600;">${summary.totalChanges}</div></div>
    </div>
    ${rows ? `<table style="width:100%;border-collapse:collapse;margin-top:16px;"><tbody>${rows}</tbody></table>` : `<p style="color:#6b7280;">No tag changes detected this month.</p>`}
    <p style="margin-top:24px;"><a href="${APP_URL}/reports" style="color:#0b0c0f;">Open full reports →</a></p>
  `);
  const text = `Monthly report — ${summary.siteCount} sites, ${summary.totalScans} scans, ${summary.totalChanges} changes.\n\nView at ${APP_URL}/reports`;
  return send({ to: opts.to, subject: "Your monthly Ad Tag Tracker report", html, text });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
