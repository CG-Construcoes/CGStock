import crypto from "crypto"
import { SignJWT, jwtVerify } from "jose"
import { jwtKey } from "./auth-secret"
import { db } from "./db"
import { escapeHtml, getAppUrl, sendEmail } from "./email"

const PURPOSE = "password-reset"
export const SELF_RESET_TTL_MINUTES = 60
export const ADMIN_RESET_TTL_MINUTES = 24 * 60

/**
 * Impressão digital do estado de credenciais do usuário. Muda sempre que a
 * senha é trocada ou as sessões são revogadas — o que torna o link de uso
 * único sem precisar de tabela de tokens.
 */
function credentialFingerprint(user: { passwordHash: string | null; sessionVersion: number }) {
  return crypto.createHash("sha256").update(`${user.passwordHash ?? ""}|${user.sessionVersion}`).digest("hex").slice(0, 24)
}

export async function createPasswordResetToken(
  user: { id: string; passwordHash: string | null; sessionVersion: number },
  ttlMinutes = SELF_RESET_TTL_MINUTES
) {
  return new SignJWT({ purpose: PURPOSE, fp: credentialFingerprint(user) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${ttlMinutes}m`)
    .sign(jwtKey)
}

/** Retorna o usuário dono do token, ou null se inválido/expirado/já utilizado. */
export async function verifyPasswordResetToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, jwtKey, { algorithms: ["HS256"] })
    if (payload.purpose !== PURPOSE || !payload.sub) return null
    const user = await db.user.findUnique({ where: { id: payload.sub }, include: { roles: true } })
    if (!user || user.status !== "ACTIVE" || !user.loginEnabled || !user.email) return null
    if (payload.fp !== credentialFingerprint(user)) return null
    return user
  } catch {
    return null
  }
}

export async function sendPasswordResetEmail(
  user: { id: string; name: string; email: string; passwordHash: string | null; sessionVersion: number },
  ttlMinutes = SELF_RESET_TTL_MINUTES
) {
  const token = await createPasswordResetToken(user, ttlMinutes)
  const link = `${getAppUrl()}/reset-password?token=${encodeURIComponent(token)}`
  const validity = ttlMinutes >= 60 ? `${Math.round(ttlMinutes / 60)} hora${ttlMinutes >= 120 ? "s" : ""}` : `${ttlMinutes} minutos`
  const firstName = escapeHtml(user.name.split(" ")[0])

  await sendEmail({
    to: user.email,
    subject: "CGStock — Redefinição de senha",
    text: `Olá, ${user.name.split(" ")[0]}.\n\nRecebemos uma solicitação para redefinir sua senha no CGStock.\nAcesse o link abaixo para criar uma nova senha (válido por ${validity}):\n\n${link}\n\nSe você não solicitou, ignore este e-mail — sua senha atual continua valendo.`,
    html: `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:8px;border:1px solid #e4e4e7">
<tr><td style="padding:24px 28px;background:#2c001e;border-radius:8px 8px 0 0;color:#ffb597;font-size:20px;font-weight:bold;letter-spacing:.5px">CGSTOCK</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 12px;font-size:16px">Olá, ${firstName}.</p>
<p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#3f3f46">Recebemos uma solicitação para redefinir sua senha no CGStock. Clique no botão abaixo para criar uma nova senha.</p>
<p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#e95420;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 22px;border-radius:6px">Redefinir minha senha</a></p>
<p style="margin:0 0 8px;font-size:12px;color:#71717a">O link é válido por ${validity} e só pode ser usado uma vez.</p>
<p style="margin:0;font-size:12px;color:#71717a">Se você não solicitou, ignore este e-mail — sua senha atual continua valendo.</p>
</td></tr></table></td></tr></table></body></html>`,
  })
}
