"use client"
import { useRouter } from "next/navigation"
import { Button } from "./button"
import { ArrowLeft } from "lucide-react"

export function BackButton({ onClick, href }: { onClick?: () => void; href?: string } = {}) {
  const router = useRouter()
  
  // No Next.js App Router não temos como saber confiavelmente se há histórico para voltar
  // via SSR, mas no cliente podemos tentar chamar router.back()
  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className="rounded-full shrink-0 hover:bg-black/5 dark:hover:bg-white/10 " 
      onClick={onClick || (() => href ? router.push(href) : router.back())}
      title="Voltar"
    >
      <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground " />
    </Button>
  )
}
