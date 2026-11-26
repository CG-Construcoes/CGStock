"use client"

import Link from "next/link"
import { useActionState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { PasswordInput } from "@/components/ui/password-input"
import { authInputClass, authToggleClass } from "@/app/login/auth-styles"
import { PASSWORD_HINT, PASSWORD_MIN_LENGTH } from "@/lib/password-policy"
import { resetPasswordWithTokenAction } from "./actions"

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(resetPasswordWithTokenAction, null)

  useEffect(() => {
    // Navegação completa para o app carregar com a nova sessão
    if (state?.success) window.location.href = "/dashboard"
  }, [state])

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-300" htmlFor="newPassword">Nova senha</label>
        <PasswordInput id="newPassword" name="newPassword" autoComplete="new-password" required minLength={PASSWORD_MIN_LENGTH} className={authInputClass} toggleClassName={authToggleClass} />
        <p className="text-xs text-zinc-500">{PASSWORD_HINT}.</p>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-300" htmlFor="confirmPassword">Confirme a nova senha</label>
        <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" required minLength={PASSWORD_MIN_LENGTH} className={authInputClass} toggleClassName={authToggleClass} />
      </div>

      {state?.error && (
        <div className="p-3 bg-red-500/10 text-red-400 text-sm rounded-md border border-red-500/20 text-center">
          {state.error}
          {state.expired && <> <Link href="/forgot-password" className="underline text-[#ffb597]">Solicitar novo link</Link></>}
        </div>
      )}

      <Button className="w-full h-11 text-sm font-medium bg-[#e95420] hover:bg-[#ff875b] text-[#241f31] transition-colors" disabled={isPending || state?.success}>
        {isPending || state?.success ? "Salvando e entrando..." : "Salvar e entrar no sistema"}
      </Button>
    </form>
  )
}
