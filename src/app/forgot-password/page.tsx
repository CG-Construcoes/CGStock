"use client"

import Link from "next/link"
import { useActionState } from "react"
import { ArrowLeft, MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AuthShell } from "@/app/login/auth-shell"
import { authInputClass } from "@/app/login/auth-styles"
import { requestPasswordResetAction } from "./actions"

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(requestPasswordResetAction, null)

  return (
    <AuthShell title="Esqueceu a senha?" description="Informe seu e-mail ou CPF e enviaremos um link para criar uma nova senha.">
      {state?.success ? (
        <div className="space-y-6">
          <div className="flex items-start gap-3 p-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-sm">
            <MailCheck className="h-5 w-5 shrink-0 mt-0.5" />
            <p>{state.success} Verifique também a caixa de spam.</p>
          </div>
          <Link href="/login" className="flex items-center justify-center gap-2 text-sm text-[#ffb597] hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" /> Voltar para o login
          </Link>
        </div>
      ) : (
        <form action={formAction} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300" htmlFor="email">E-mail ou CPF</label>
            <Input id="email" name="email" type="text" autoComplete="username" placeholder="E-mail corporativo ou CPF" required className={authInputClass} />
          </div>

          {state?.error && (
            <div className="p-3 bg-red-500/10 text-red-400 text-sm rounded-md border border-red-500/20 text-center">{state.error}</div>
          )}

          <Button className="w-full h-11 text-sm font-medium bg-[#e95420] hover:bg-[#ff875b] text-[#241f31] transition-colors" disabled={isPending}>
            {isPending ? "Enviando..." : "Enviar link de redefinição"}
          </Button>

          <Link href="/login" className="flex items-center justify-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" /> Voltar para o login
          </Link>
        </form>
      )}
    </AuthShell>
  )
}
