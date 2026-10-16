"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

type SheetProps = {
  open: boolean
  onClose: () => void
  /** Lado de onde o painel aparece */
  side?: "left" | "bottom"
  /** Nome lido por leitores de tela */
  label: string
  className?: string
  children: ReactNode
}

/**
 * Painel deslizante para celular (menu lateral ou folha inferior).
 * Fecha com: toque fora, tecla Esc, ou arrastando o painel para fora.
 */
export function Sheet({ open, onClose, side = "left", label, className, children }: SheetProps) {
  const [mounted, setMounted] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement as HTMLElement | null
    document.body.style.overflow = "hidden"
    panelRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKey)
      previousFocus?.focus?.()
    }
  }, [open, onClose])

  if (!mounted || !open) return null

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (side === "left" && dx < -70 && Math.abs(dx) > Math.abs(dy) * 1.5) onClose()
    if (side === "bottom" && dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.5) {
      // Só fecha arrastando para baixo se o conteúdo já estiver no topo
      const scroller = (e.target as HTMLElement).closest("[data-sheet-scroll]")
      if (!scroller || scroller.scrollTop <= 0) onClose()
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] lg:hidden" role="presentation">
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px] animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className={cn(
          "absolute flex flex-col bg-background text-foreground shadow-2xl outline-none animate-in duration-250 ease-out",
          side === "left" &&
            "inset-y-0 left-0 w-[88vw] max-w-[360px] slide-in-from-left",
          side === "bottom" &&
            "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-3xl slide-in-from-bottom",
          className
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
