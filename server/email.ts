// Transactional email via Brevo (https://developers.brevo.com). Auth emails
// (invite / password reset) were removed with the move to Portal SSO; only
// product notifications (change alerts, scan failures, monthly reports) remain.

const BREVO_API_KEY = process.env.BREVO_API_KEY;
// Sender in "Name <email>" form, e.g. "Ad Tag Tracker <noreply@rallyadmedia.com>".
const FROM = process.env.BREVO_FROM || "Ad Tag Tracker <noreply@rallyadmedia.com>";
const APP_URL = process.env.APP_URL || "http://localhost:5000";
const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

if (!BREVO_API_KEY) {
  console.warn("[email] BREVO_API_KEY not set — emails will be logged to console instead of sent.");
}

/** Parse a "Name <email>" sender string into Brevo's sender object. */
function parseSender(from: string): { name: string; email: string } {
  const match = from.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/);
  if (match) return { name: match[1] || "Ad Tag Tracker", email: match[2] };
  return { name: "Ad Tag Tracker", email: from.trim() };
}

/** Split a single/comma-joined recipient string into Brevo recipient objects. */
function parseRecipients(to: string): { email: string }[] {
  return to
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean)
    .map((email) => ({ email }));
}

async function send(opts: { to: string; subject: string; html: string; text: string }) {
  if (!BREVO_API_KEY) {
    console.log("\n=== [email:dev] would send ===");
    console.log("to:", opts.to);
    console.log("subject:", opts.subject);
    console.log("text:", opts.text);
    console.log("=== end ===\n");
    return { id: "dev-noop" };
  }
  const res = await fetch(BREVO_ENDPOINT, {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: parseSender(FROM),
      to: parseRecipients(opts.to),
      subject: opts.subject,
      htmlContent: opts.html,
      textContent: opts.text,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[email] send failed:", res.status, detail);
    throw new Error(`Brevo send failed: ${res.status}`);
  }
  return res.json().catch(() => ({}));
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
