"use client"

import { useEffect, useRef, useState } from "react"
import { Download, Share2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { detectInstallPlatform, type InstallPlatform } from "@/lib/install-platform"

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const storageKey = "cgstock-install-guide-v1"

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function InstallGuide() {
  const [platform, setPlatform] = useState<InstallPlatform>("other")
  const [open, setOpen] = useState(false)
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = detectInstallPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)
      setPlatform(current)
      try {
        if (current !== "other" && !isInstalled() && !window.localStorage.getItem(storageKey)) {
          setOpen(true)
          window.localStorage.setItem(storageKey, "seen")
        }
      } catch {
        if (current !== "other" && !isInstalled()) setOpen(true)
      }
    }, 0)
    const onInstall = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as InstallEvent)
    }
    const onInstalled = () => { setOpen(false); setInstallEvent(null) }
    const onHelp = () => { if (!isInstalled()) setOpen(true) }
    window.addEventListener("beforeinstallprompt", onInstall)
    window.addEventListener("appinstalled", onInstalled)
    window.addEventListener("cgstock:install-help", onHelp)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("beforeinstallprompt", onInstall)
      window.removeEventListener("appinstalled", onInstalled)
      window.removeEventListener("cgstock:install-help", onHelp)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
      if (event.key !== "Tab" || !dialogRef.current) return
      const controls = dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled])")
      if (!controls.length) return
      if (event.shiftKey && document.activeElement === controls[0]) {
        event.preventDefault()
        controls[controls.length - 1].focus()
      } else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) {
        event.preventDefault()
        controls[0].focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => { window.removeEventListener("keydown", onKey); previousFocus?.focus() }
  }, [open])

  if (!open) return null

  const install = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    setInstallEvent(null)
    if (choice.outcome === "accepted") setOpen(false)
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center" role="presentation">
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="install-title" aria-describedby="install-description" className="w-full max-w-md rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-primary/10 p-2 text-primary"><Download className="size-5" aria-hidden="true" /></span>
            <h2 id="install-title" className="text-lg font-bold">Instale o CGStock</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="rounded-md p-2 text-muted-foreground hover:bg-muted" aria-label="Fechar tutorial de instalação"><X className="size-5" /></button>
        </div>
        <p id="install-description" className="mt-4 text-sm text-muted-foreground">Acesse o sistema pela tela inicial do celular, como um aplicativo. É necessário entrar uma vez com internet antes de usar as funções offline disponíveis.</p>
        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4 text-sm leading-relaxed">
          {platform === "ios-safari" ? (
            <p>1. Toque em <Share2 className="inline size-4" aria-label="Compartilhar" /> <strong>Compartilhar</strong> no Safari.<br />2. Selecione <strong>Adicionar à Tela de Início</strong> e confirme.</p>
          ) : platform === "ios-other" ? (
            <p>Abra esta página no <strong>Safari</strong>. Depois toque em <strong>Compartilhar</strong> e em <strong>Adicionar à Tela de Início</strong>.</p>
          ) : (
            <p>Abra o menu do navegador (⋮) e toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>. Confirme a instalação.</p>
          )}
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Agora não</Button>
          {platform === "android" && installEvent && <Button type="button" onClick={() => void install()}>Instalar aplicativo</Button>}
        </div>
      </div>
    </div>
  )
}
