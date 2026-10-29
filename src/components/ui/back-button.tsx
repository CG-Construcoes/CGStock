"use client"
import { useRouter } from "next/navigation"
import { Button } from "./button"
import { ArrowLeft } from "lucide-react"

export function BackButton({ onClick, href }: { onClick?: () => void; href?: string } = {}) {
  const router = useRouter()

  const handleBack = () => {
    if (onClick) {
      onClick()
      return
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      if (href) {
        window.dispatchEvent(new CustomEvent("cgstock:offline-navigate", { detail: { href } }))
      } else {
        window.history.back()
      }
      return
    }
    if (href) {
      router.push(href)
    } else {
      router.back()
    }
  }

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className="rounded-full shrink-0 hover:bg-black/5 dark:hover:bg-white/10 " 
      onClick={handleBack}
      title="Voltar"
    >
      <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground " />
    </Button>
  )
}
