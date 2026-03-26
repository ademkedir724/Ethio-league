/**
 * Transactional email utility.
 *
 * Uses a configurable HTTP email API (e.g. Resend, Mailgun, SendGrid, or any
 * compatible endpoint) via fetch.  Set the following environment variables:
 *
 *   EMAIL_API_URL   — full URL of the email send endpoint
 *   EMAIL_API_KEY   — bearer token / API key for that endpoint
 *   SMTP_FROM       — sender address shown in the "From" field
 *   NEXT_PUBLIC_APP_URL — base URL of the app (used to build the setup link)
 *
 * If any of these are missing or the request fails, the function throws so
 * callers can catch and log the failure.
 */

export async function sendPasswordSetupEmail(
    to: string,
    token: string
): Promise<void> {
    const apiUrl = process.env.EMAIL_API_URL;
    const apiKey = process.env.EMAIL_API_KEY;
    const from = process.env.SMTP_FROM;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // In development, skip actual sending if email config is not set up.
    // The setup link is returned in the API response instead.
    if (!apiUrl || !apiKey || !from) {
        const setupUrl = `${appUrl}/set-password?token=${token}`;
        console.log(`[DEV] Password setup email skipped (no email config).`);
        console.log(`[DEV] Setup link for ${to}: ${setupUrl}`);
        return; // silently succeed — caller returns the link in the response body
    }

    const setupUrl = `${appUrl}/set-password?token=${token}`;

    const body = JSON.stringify({
        from,
        to,
        subject: "Set up your Ethio League password",
        html: `
      <p>Welcome to Ethio League.</p>
      <p>Click the link below to set your password. This link expires in 1 hour.</p>
      <p><a href="${setupUrl}">${setupUrl}</a></p>
      <p>If you did not expect this email, you can safely ignore it.</p>
    `,
        text: `Welcome to Ethio League.\n\nSet your password here: ${setupUrl}\n\nThis link expires in 1 hour.`,
    });

    const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body,
    });

    if (!response.ok) {
        const detail = await response.text().catch(() => response.statusText);
        throw new Error(
            `Email delivery failed (HTTP ${response.status}): ${detail}`
        );
    }
}
