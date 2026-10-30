"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { PasswordInput } from "@/components/ui/password-input"
import { Lock, LogOut } from "lucide-react"
import { toast } from "sonner"
import { changePasswordAction } from "./actions"
import { logoutAction } from "@/app/auth-actions"

export default function ChangePasswordPage() {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(changePasswordAction, null)

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error)
    }
    if (state?.success) {
      toast.success("Senha alterada com sucesso!")
      router.push("/") // full navigation para refletir a nova sessão
    }
  }, [state, router])

  const handleLogout = async () => {
    await logoutAction()
    router.push("/login")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-[2rem] border shadow-sm relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2" />
        
        <div className="text-center relative z-10 space-y-2">
          <div className="mx-auto w-16 h-16 bg-amber-100 dark:bg-amber-900/50 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400 mb-6 border border-amber-200 dark:border-amber-800">
            <Lock className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Defina sua nova senha</h2>
          <p className="text-sm text-muted-foreground px-4">
            Como este é seu primeiro acesso com uma senha temporária, é obrigatório definir uma nova senha para continuar.
          </p>
        </div>

        <form action={formAction} className="space-y-5 relative z-10">
          <div className="space-y-2">
            <label className="text-sm font-medium">Senha Temporária / Atual</label>
            <PasswordInput
              name="currentPassword"
              placeholder="••••••••"
              required
              className="h-12 bg-background/50"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Nova Senha</label>
            <PasswordInput
              name="newPassword"
              placeholder="Mínimo 10 caracteres, com letras e números"
              required
              className="h-12 bg-background/50"
              minLength={10}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Confirme a Nova Senha</label>
            <PasswordInput
              name="confirmPassword"
              placeholder="Repita a nova senha"
              required
              className="h-12 bg-background/50"
              minLength={10}
            />
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-white font-bold"
            disabled={isPending}
          >
            {isPending ? "Salvando..." : "Salvar e Continuar"}
          </Button>

          <div className="pt-4 border-t border-border flex justify-center">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={handleLogout}
              className="text-muted-foreground hover:text-red-500"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
