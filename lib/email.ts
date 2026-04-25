/**
 * Transactional email utility — works with Resend (recommended) or any
 * compatible HTTP email API.
 *
 * Environment variables:
 *   RESEND_API_KEY          — Resend API key (get one free at resend.com)
 *   SMTP_FROM               — sender address, e.g. "Ethio League <noreply@yourdomain.com>"
 *   NEXT_PUBLIC_APP_URL     — base URL of the app (used to build links)
 *
 * For local dev without email config, all functions log the link to the
 * console and return silently — the API response includes the link as a
 * fallback so the dev dropbox still works.
 */

const RESEND_API = "https://api.resend.com/emails";

function getConfig() {
  return {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.SMTP_FROM || "Ethio League <noreply@ethioleague.com>",
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  };
}

async function sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
  const { apiKey, from } = getConfig();

  if (!apiKey) {
    console.log(`[DEV] Email skipped (no RESEND_API_KEY). Subject: "${subject}" → ${to}`);
    return;
  }

  const response = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new Error(`Email delivery failed (HTTP ${response.status}): ${detail}`);
  }
}

export async function sendPasswordSetupEmail(to: string, token: string): Promise<void> {
  const { appUrl } = getConfig();
  const setupUrl = `${appUrl}/set-password?token=${token}`;

  console.log(`[email] Password setup link for ${to}: ${setupUrl}`);

  await sendEmail(
    to,
    "Set up your Ethio League password",
    `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#111">Welcome to Ethio League</h2>
          <p>Click the button below to set your password. This link expires in <strong>1 hour</strong>.</p>
          <p style="margin:24px 0">
            <a href="${setupUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
              Set Password
            </a>
          </p>
          <p style="color:#666;font-size:13px">Or copy this link: ${setupUrl}</p>
          <p style="color:#999;font-size:12px">If you did not expect this email, you can safely ignore it.</p>
        </div>
        `,
    `Welcome to Ethio League.\n\nSet your password here: ${setupUrl}\n\nThis link expires in 1 hour.`
  );
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const { appUrl } = getConfig();
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  console.log(`[email] Password reset link for ${to}: ${resetUrl}`);

  await sendEmail(
    to,
    "Reset your Ethio League password",
    `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#111">Password Reset</h2>
          <p>We received a request to reset your password. Click the button below. This link expires in <strong>1 hour</strong>.</p>
          <p style="margin:24px 0">
            <a href="${resetUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
              Reset Password
            </a>
          </p>
          <p style="color:#666;font-size:13px">Or copy this link: ${resetUrl}</p>
          <p style="color:#999;font-size:12px">If you did not request a password reset, you can safely ignore this email.</p>
        </div>
        `,
    `Reset your Ethio League password here: ${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you did not request this, ignore this email.`
  );
}
