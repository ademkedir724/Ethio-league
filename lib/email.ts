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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!apiUrl || !apiKey || !from || !appUrl) {
        throw new Error(
            "Email configuration is incomplete. " +
            "Ensure EMAIL_API_URL, EMAIL_API_KEY, SMTP_FROM, and NEXT_PUBLIC_APP_URL are set."
        );
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
