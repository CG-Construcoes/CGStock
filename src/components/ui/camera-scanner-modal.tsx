"use client"

import { useEffect, useRef, useState } from "react"
import { Html5Qrcode } from "html5-qrcode"
import { Camera, X, RefreshCw, AlertCircle, Sparkles, SwitchCamera } from "lucide-react"
import { Button } from "./button"

interface CameraScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onScan: (decodedText: string) => void
  title?: string
  subtitle?: string
}

export function CameraScannerModal({
  isOpen,
  onClose,
  onScan,
  title = "Escanear QR Code com Câmera",
  subtitle = "Posicione o QR Code do capacete ou crachá dentro da moldura"
}: CameraScannerModalProps) {
  const [error, setError] = useState<string | null>(null)
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([])
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const isScanningRef = useRef(false)

  // Som de bip usando Web Audio API nativo
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.frequency.setValueAtTime(880, ctx.currentTime) // A5
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12) // A6
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12)

      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.12)

      if (navigator.vibrate) {
        navigator.vibrate([80])
      }
    } catch (e) {
      console.log("Audio feedback failed:", e)
    }
  }

  useEffect(() => {
    if (!isOpen) return

    let isMounted = true
    setError(null)
    setIsInitializing(true)
    isScanningRef.current = false

    const initScanner = async () => {
      try {
        // Obter lista de câmeras
        const devices = await Html5Qrcode.getCameras().catch(() => [])
        if (!isMounted) return

        if (devices && devices.length > 0) {
          setCameras(devices)
          // Preferir câmera traseira (environment) se disponível
          const backCam = devices.find(d => 
            d.label.toLowerCase().includes("back") || 
            d.label.toLowerCase().includes("traseira") ||
            d.label.toLowerCase().includes("environment")
          )
          setActiveCameraId(backCam ? backCam.id : devices[0].id)
        }

        // Aguardar o elemento ser montado no DOM
        await new Promise((r) => setTimeout(r, 150))
        if (!isMounted) return

        const scannerId = "camera-scanner-viewport"
        const element = document.getElementById(scannerId)
        if (!element) return

        const scanner = new Html5Qrcode(scannerId)
        scannerRef.current = scanner

        const config = {
          fps: 15,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
        }

        const cameraChoice = activeCameraId ? { deviceId: { exact: activeCameraId } } : { facingMode: "environment" }

        await scanner.start(
          cameraChoice,
          config,
          (decodedText) => {
            if (!isMounted || isScanningRef.current) return
            isScanningRef.current = true
            playBeep()

            // Parar o leitor antes de emitir o scan
            scanner.stop().then(() => {
              scanner.clear()
              onScan(decodedText.trim())
            }).catch(() => {
              onScan(decodedText.trim())
            })
          },
          () => {
            // Ignorar erros normais de busca por frame
          }
        )

        if (isMounted) {
          setIsInitializing(false)
        }
      } catch (err: any) {
        console.error("Erro ao iniciar câmera:", err)
        if (isMounted) {
          setIsInitializing(false)
          const isPermissionDenied =
            err?.name === "NotAllowedError" ||
            err?.message?.toLowerCase().includes("permission") ||
            err?.message?.toLowerCase().includes("notallowed")

          setError(
            isPermissionDenied
              ? "Permissão da câmera bloqueada. Por favor, autorize o acesso à câmera no seu navegador para escanear."
              : "Não foi possível acessar a câmera. Verifique se o dispositivo possui uma câmera conectada ou tente fechar outros apps que possam estar usando a câmera."
          )
        }
      }
    }

    initScanner()

    return () => {
      isMounted = false
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().then(() => {
          scannerRef.current?.clear()
        }).catch(console.error)
      }
    }
  }, [isOpen, activeCameraId])

  // Alternar entre câmeras (frontal e traseira)
  const handleSwitchCamera = async () => {
    if (cameras.length <= 1 || !scannerRef.current) return

    try {
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop()
        scannerRef.current.clear()
      }
      const currentIndex = cameras.findIndex(c => c.id === activeCameraId)
      const nextIndex = (currentIndex + 1) % cameras.length
      setActiveCameraId(cameras[nextIndex].id)
    } catch (e) {
      console.error("Erro ao alternar câmera:", e)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-background rounded-3xl max-w-md w-full border border-border shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm sm:text-base leading-tight">
                {title}
              </h3>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scanner Viewport */}
        <div className="relative bg-black flex flex-col items-center justify-center min-h-[320px] sm:min-h-[360px] overflow-hidden">
          {error ? (
            <div className="p-6 text-center max-w-sm space-y-4">
              <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-foreground text-sm">Acesso à Câmera</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{error}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="w-full text-xs"
              >
                Digitar Código Manualmente
              </Button>
            </div>
          ) : (
            <>
              {/* O Container do HTML5-QRCode */}
              <div
                id="camera-scanner-viewport"
                className="w-full h-full aspect-square max-h-[360px] overflow-hidden [&_video]:object-cover"
              />

              {/* Viewfinder Overlay com Mira Laser */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-64 h-64 rounded-2xl border-2 border-emerald-500/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                  {/* Cantoneiras Estilizadas */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                  {/* Linha Laser Animada */}
                  <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#10b981] animate-bounce duration-1000 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {isInitializing && (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white gap-2">
                  <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
                  <span className="text-xs font-medium">Iniciando câmera...</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer com Ações */}
        <div className="p-4 border-t border-border bg-muted/30 flex items-center justify-between text-xs">
          {cameras.length > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSwitchCamera}
              className="gap-1.5 text-xs"
            >
              <SwitchCamera className="h-3.5 w-3.5" />
              Trocar Câmera ({cameras.length})
            </Button>
          ) : (
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
              Leitura automática instantânea
            </span>
          )}

          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}
