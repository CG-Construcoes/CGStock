const SENDGRID_URL = "https://api.sendgrid.com/v3/mail/send"

export type EmailMessage = {
  to: string | string[]
  subject: string
  html: string
  text: string
}

export function getAppUrl(): string {
  const raw = (process.env.APP_URL || "http://localhost:3000").trim().replace(/\/+$/, "")
  return /^https?:\/\//.test(raw) ? raw : `https://${raw}`
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)
}

/** Envia e-mail via SendGrid (API v3). Lança erro se a API recusar. */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY
  const fromEmail = process.env.SENDGRID_FROM_EMAIL
  if (!apiKey || !fromEmail) throw new Error("SendGrid não configurado (SENDGRID_API_KEY / SENDGRID_FROM_EMAIL).")

  const recipients = (Array.isArray(message.to) ? message.to : [message.to]).map(email => ({ email }))
  const res = await fetch(SENDGRID_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: recipients }],
      from: { email: fromEmail, name: process.env.SENDGRID_FROM_NAME || "CGStock" },
      subject: message.subject,
      content: [
        { type: "text/plain", value: message.text },
        { type: "text/html", value: message.html },
      ],
      tracking_settings: { click_tracking: { enable: false, enable_text: false } },
    }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`SendGrid ${res.status}: ${detail.slice(0, 300)}`)
  }
}
