"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Package } from "lucide-react"
import { useActionState, useEffect } from "react"
import { loginAction } from "./actions"
import { useRouter } from "next/navigation"

export function LoginForm() {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(loginAction, null)

  useEffect(() => {
    if (state?.success) {
      window.location.href = "/dashboard"
    }
  }, [state, router])

  if (state?.success) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background space-y-6">
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 w-24 h-24 border-4 border-primary/20 rounded-full animate-ping"></div>
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin relative z-10"></div>
        </div>
        <h2 className="text-2xl font-bold text-foreground ">Autenticando e carregando o sistema...</h2>
        <p className="text-muted-foreground">Preparando seu ambiente de trabalho.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#2c001e] font-sans">
      <div className="flex flex-col items-center justify-center p-6 sm:p-12 w-full max-w-[480px]">
        
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10 justify-center">
          <Package className="h-8 w-8 text-[#ffb597]" />
          <span className="text-2xl font-black tracking-tight text-[#ffb597]">CGSTOCK</span>
        </div>

        <div className="w-full space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-white">Acesse sua conta</h2>
            <p className="text-zinc-400 text-sm">
              Informe suas credenciais para entrar
            </p>
          </div>

          <Card className="border-0 shadow-none bg-transparent">
            <CardContent className="p-0">
              <form action={formAction} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300" htmlFor="email">
                    E-mail ou CPF
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="text"
                    autoComplete="username"
                    placeholder="E-mail corporativo ou CPF"
                    required
                    className="h-11 bg-[#45364d] border-[#6b4c68] text-white focus-visible:ring-[#ffb597] placeholder:text-zinc-500"
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-zinc-300" htmlFor="password">
                      Senha
                    </label>
                    <a href="#" className="text-xs text-[#ffb597] hover:text-white transition-colors">
                      Esqueceu a senha?
                    </a>
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    className="h-11 bg-[#45364d] border-[#6b4c68] text-white focus-visible:ring-[#ffb597]"
                  />
                </div>

                {state?.error && (
                  <div className="p-3 bg-red-500/10 text-red-400 text-sm rounded-md border border-red-500/20 text-center">
                    {state.error}
                  </div>
                )}

                <Button 
                  className="w-full h-11 text-sm font-medium bg-[#e95420] hover:bg-[#ff875b] text-[#241f31] transition-colors"
                  disabled={isPending || state?.success}
                >
                  {isPending ? "Autenticando..." : "Entrar no Sistema"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
