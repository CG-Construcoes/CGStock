import Link from "next/link"
import { AuthShell } from "@/app/login/auth-shell"
import { verifyPasswordResetToken } from "@/lib/password-reset"
import { ResetPasswordForm } from "./reset-password-form"

export default async function ResetPasswordPage(props: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await props.searchParams
  const user = token ? await verifyPasswordResetToken(token) : null

  if (!user) {
    return (
      <AuthShell title="Link inválido ou expirado" description="Este link de redefinição não é mais válido. Ele pode ter expirado ou já ter sido usado.">
        <div className="flex flex-col items-center gap-4">
          <Link href="/forgot-password" className="w-full h-11 inline-flex items-center justify-center rounded-md text-sm font-medium bg-[#e95420] hover:bg-[#ff875b] text-[#241f31] transition-colors">
            Solicitar novo link
          </Link>
          <Link href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors">Voltar para o login</Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Crie sua nova senha" description={`Olá, ${user.name.split(" ")[0]}. Defina uma nova senha para acessar o CGStock.`}>
      <ResetPasswordForm token={token} />
    </AuthShell>
  )
}
