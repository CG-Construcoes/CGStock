"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Scan, Plus, Minus, Trash2, Camera, X, Package, RotateCcw, ListFilter } from "lucide-react"
import { useRouter } from "next/navigation"
import { localDb, type LocalProduct } from "@/lib/localdb"
import { queueOfflineOperation } from "@/lib/offline-sync"
import { Html5Qrcode } from "html5-qrcode"
import { BackButton } from "@/components/ui/back-button"
import { toast } from "sonner"
import { formatNumber, cn } from "@/lib/utils"

type CollectedItem = {
  productId: string
  code: string
  name: string
  unitCode: string
  systemQuantity: number
  quantity: number
}

export default function CollectorForm({
  userId,
  sessionExpiresAt,
  inventoryId,
  locationId,
  locationCode,
  products,
  onBack
}: {
  userId: string
  sessionExpiresAt: string
  inventoryId: string
  locationId: string
  locationCode: string
  products: LocalProduct[]
  onBack?: () => void
}) {
  const router = useRouter()
  const [items, setItems] = useState<CollectedItem[]>([])
  const [searchInput, setSearchInput] = useState("")
  const [showScanner, setShowScanner] = useState(false)
  const [showLocationStock, setShowLocationStock] = useState(false)
  const [cameraError, setCameraError] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [draftLoaded, setDraftLoaded] = useState(() => !localDb || !userId)
  const draftKey = `${userId}:${inventoryId}:${locationId}`

  // Restaura rascunho da contagem em andamento caso o app tenha sido fechado/reaberto
  useEffect(() => {
    if (!localDb || !userId) return
    let active = true
    localDb.collectorDrafts
      .get(draftKey)
      .then((draft) => {
        if (!active) return
        if (draft && Array.isArray(draft.items) && draft.items.length > 0) {
          setItems(
            draft.items.map((it) => ({
              productId: it.productId,
              code: it.code,
              name: it.name,
              unitCode: it.unitCode || "un",
              systemQuantity: Number(it.systemQuantity ?? 0),
              quantity: Number(it.quantity ?? 0),
            }))
          )
        }
        setDraftLoaded(true)
      })
      .catch(() => {
        if (active) setDraftLoaded(true)
      })
    return () => {
      active = false
    }
  }, [draftKey, userId])

  // Persiste automaticamente cada alteração da contagem no IndexedDB
  useEffect(() => {
    if (!draftLoaded || !localDb || !userId) return
    if (items.length === 0) {
      void localDb.collectorDrafts.delete(draftKey).catch(() => {})
      return
    }
    void localDb.collectorDrafts
      .put({
        id: draftKey,
        userId,
        inventoryId,
        locationId,
        locationCode,
        updatedAt: new Date(),
        items,
      })
      .catch(() => {})
  }, [draftKey, draftLoaded, inventoryId, items, locationCode, locationId, userId])

  const getSystemQty = useCallback(
    (product: LocalProduct): number => {
      if (product.locationStocks && locationId in product.locationStocks) {
        return Number(product.locationStocks[locationId] || 0)
      }
      return Number(product.systemQuantity || 0)
    },
    [locationId]
  )

  const upsertProduct = useCallback(
    (found: LocalProduct, mode: "add" | "remove" | "inspect" = "add") => {
      const sysQty = getSystemQty(found)
      const unitCode = (found.unitCode || "UN").toLowerCase()

      setItems((prev) => {
        const existing = prev.find((i) => i.productId === found.id)
        if (existing) {
          const delta = mode === "remove" ? -1 : mode === "add" ? 1 : 0
          const nextQty = Math.max(0, Number((existing.quantity + delta).toFixed(4)))
          return prev.map((i) =>
            i.productId === found.id ? { ...i, quantity: nextQty } : i
          )
        }

        let initialQty = sysQty
        if (mode === "remove") {
          initialQty = Math.max(0, sysQty - 1)
        } else if (mode === "add") {
          initialQty = sysQty > 0 ? sysQty + 1 : 1
        } else {
          initialQty = sysQty
        }

        return [
          {
            productId: found.id,
            code: found.code,
            name: found.name,
            unitCode,
            systemQuantity: sysQty,
            quantity: initialQty,
          },
          ...prev,
        ]
      })
      setSearchInput("")
    },
    [getSystemQty]
  )

  const processSearch = useCallback(
    (term: string, mode: "add" | "remove" | "inspect" = "add") => {
      if (!term.trim()) return

      const upperTerm = term.trim().toUpperCase()
      const exactMatch = products.find(
        (p) =>
          p.code.toUpperCase() === upperTerm ||
          p.barcode?.toUpperCase() === upperTerm
      )
      const found =
        exactMatch ||
        products.find(
          (p) =>
            p.code.toUpperCase().includes(upperTerm) ||
            p.barcode?.toUpperCase() === upperTerm ||
            p.name.toUpperCase().includes(upperTerm)
        )

      if (found) {
        upsertProduct(found, mode)
      } else {
        toast.error("Produto não encontrado!")
      }
    },
    [products, upsertProduct]
  )

  const matchingSuggestions = useMemo(() => {
    const clean = searchInput.trim().toUpperCase()
    if (!clean) return []
    return products
      .filter(
        (p) =>
          p.code.toUpperCase().includes(clean) ||
          p.barcode?.toUpperCase().includes(clean) ||
          p.name.toUpperCase().includes(clean)
      )
      .slice(0, 6)
  }, [products, searchInput])

  const productsWithStockInLocation = useMemo(() => {
    return products.filter((p) => getSystemQty(p) > 0)
  }, [products, getSystemQty])

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null

    if (showScanner) {
      html5QrCode = new Html5Qrcode("reader")

      html5QrCode
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            setSearchInput(decodedText)
            setShowScanner(false)
            processSearch(decodedText, "add")
          },
          () => {}
        )
        .catch((err) => {
          console.error("Camera error:", err)
          setCameraError(
            "Não foi possível acessar a câmera. Verifique as permissões do navegador ou se o dispositivo possui uma câmera compatível."
          )
        })
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode
          .stop()
          .then(() => {
            html5QrCode?.clear()
          })
          .catch(console.error)
      }
    }
  }, [showScanner, processSearch])

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault()
    processSearch(searchInput, "add")
  }

  const changeQuantity = (productId: string, delta: number) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.productId === productId) {
          const newQ = Number((i.quantity + delta).toFixed(4))
          return { ...i, quantity: newQ >= 0 ? newQ : 0 }
        }
        return i
      })
    )
  }

  const setExactQuantity = (productId: string, val: string) => {
    if (val === "") {
      setItems((prev) =>
        prev.map((i) => (i.productId === productId ? { ...i, quantity: 0 } : i))
      )
      return
    }
    const num = parseFloat(val)
    if (!isNaN(num) && num >= 0) {
      setItems((prev) =>
        prev.map((i) => (i.productId === productId ? { ...i, quantity: num } : i))
      )
    }
  }

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId))
  }

  const handleFinish = async () => {
    if (items.length === 0 || isSaving) return
    if (navigator.onLine && Date.now() >= new Date(sessionExpiresAt).getTime()) {
      toast.error("Sessão expirada. Conecte-se e entre novamente antes de salvar a coleta.")
      return
    }
    setIsSaving(true)

    const payload = {
      inventoryId,
      locationId,
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    }

    try {
      if (localDb) {
        await queueOfflineOperation("SUBMIT_COLLECTION", payload, userId, {
          entityId: `${inventoryId}_${locationId}`,
          dependsOnEntityId: inventoryId.startsWith("offline-") ? inventoryId : undefined,
        })

        setItems([])
        toast.success("Coleta salva neste dispositivo. Sincronizaremos automaticamente.")
        if (onBack && !navigator.onLine) {
          onBack()
        } else if (navigator.onLine) {
          router.push("/collector/sync")
        }
      } else {
        const response = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operation: "SUBMIT_COLLECTION",
            payload,
            userId,
            idempotencyKey: crypto.randomUUID(),
          }),
        })
        if (!response.ok) throw new Error("Não foi possível enviar a coleta.")
        router.push("/collector")
      }
    } catch {
      alert("Não foi possível salvar a coleta. Confira o armazenamento ou a conexão e tente novamente.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col relative">
      {/* Header */}
      <div className="bg-primary/95 text-primary-foreground p-4 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-3">
          <BackButton onClick={onBack} />
          <div>
            <h1 className="text-xl font-black tracking-tight">{locationCode}</h1>
            <p className="text-primary-foreground/80 text-xs font-medium">Coleta em Andamento</p>
          </div>
        </div>
        <div className="bg-black/20 px-3 py-1 rounded-full text-sm font-bold shadow-inner border border-white/10">
          {items.length} {items.length === 1 ? "item" : "itens"}
        </div>
      </div>

      {/* Scanner Modal */}
      {showScanner && (
        <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-6 right-6 text-white hover:bg-white/20 rounded-full"
            onClick={() => setShowScanner(false)}
          >
            <X className="h-8 w-8" />
          </Button>
          <div className="w-full max-w-sm p-6 bg-card rounded-md shadow-sm mx-4">
            <h3 className="text-xl font-bold text-center mb-4 text-foreground">Leitor de Cód. Barras</h3>

            {cameraError ? (
              <div className="text-center p-4">
                <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-4">
                  <p className="text-sm font-semibold">{cameraError}</p>
                </div>
                <Button variant="outline" onClick={() => setShowScanner(false)} className="w-full rounded-md">
                  Fechar
                </Button>
              </div>
            ) : (
              <>
                <div
                  id="reader"
                  className="w-full overflow-hidden rounded-md bg-black border-2 border-primary/20 aspect-square flex items-center justify-center relative"
                >
                  <div className="absolute inset-0 border-2 border-primary/50 opacity-50 pointer-events-none rounded-md m-4"></div>
                </div>
                <p className="text-center text-sm mt-6 text-muted-foreground font-medium">
                  Aponte a câmera para o código
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Área de Bipagem e Busca */}
      <div className="p-4 bg-card shadow-sm z-10 border-b border-border space-y-2.5">
        <form onSubmit={handleScan} className="flex gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Ler código de barras pela câmera"
            className="h-12 w-12 shrink-0 border-border"
            onClick={() => {
              setCameraError("")
              setShowScanner(true)
            }}
          >
            <Camera className="h-5 w-5 text-muted-foreground" />
          </Button>
          <div className="relative flex-1 min-w-0">
            <Scan className="absolute left-3 top-3.5 h-5 w-5 text-primary/60" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cód. Barras, SKU ou Nome..."
              className="pl-10 h-12 text-sm sm:text-base uppercase font-bold bg-muted/50 border-border focus-visible:ring-primary rounded-md"
              autoFocus
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Tirar 1 unidade do saldo do sistema"
            onClick={() => processSearch(searchInput, "remove")}
            className="h-12 w-11 shrink-0 border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-md transition-transform active:scale-95"
          >
            <Minus className="h-5 w-5" />
          </Button>
          <Button
            type="submit"
            size="icon"
            title="Adicionar 1 unidade"
            className="h-12 w-11 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md shadow-sm transition-transform active:scale-95"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </form>

        {/* Sugestões em tempo real ao digitar */}
        {matchingSuggestions.length > 0 && (
          <div className="rounded-md border border-border bg-background/95 divide-y divide-border shadow-md max-h-60 overflow-y-auto">
            {matchingSuggestions.map((prod) => {
              const sysQty = getSystemQty(prod)
              const unit = (prod.unitCode || "UN").toLowerCase()
              return (
                <div
                  key={prod.id}
                  className="p-2.5 flex items-center justify-between gap-2 hover:bg-muted/40 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => upsertProduct(prod, "inspect")}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-foreground">{prod.code}</span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/20">
                        <Package className="h-2.5 w-2.5" />
                        No sistema: {formatNumber(sysQty)} {unit}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{prod.name}</p>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => upsertProduct(prod, "remove")}
                      className="h-7 px-2 text-xs font-bold border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                    >
                      -1 Tirar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => upsertProduct(prod, "add")}
                      className="h-7 px-2 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      +1 Somar
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Atalho para ver itens com saldo neste local */}
        {productsWithStockInLocation.length > 0 && !searchInput.trim() && (
          <div>
            <button
              type="button"
              onClick={() => setShowLocationStock((prev) => !prev)}
              className="w-full flex items-center justify-between px-3 py-1.5 rounded bg-muted/50 hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="inline-flex items-center gap-1.5">
                <ListFilter className="h-3.5 w-3.5 text-primary" />
                Itens com saldo em {locationCode} ({productsWithStockInLocation.length})
              </span>
              <span className="text-[11px] text-primary font-semibold">
                {showLocationStock ? "Ocultar" : "Selecionar item"}
              </span>
            </button>

            {showLocationStock && (
              <div className="mt-1.5 rounded-md border border-border bg-background divide-y divide-border max-h-52 overflow-y-auto">
                {productsWithStockInLocation.map((prod) => {
                  const sysQty = getSystemQty(prod)
                  const unit = (prod.unitCode || "UN").toLowerCase()
                  return (
                    <div
                      key={prod.id}
                      className="p-2.5 flex items-center justify-between gap-2 hover:bg-muted/40"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          upsertProduct(prod, "inspect")
                          setShowLocationStock(false)
                        }}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-foreground">{prod.code}</span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">
                            Sistema: {formatNumber(sysQty)} {unit}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{prod.name}</p>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            upsertProduct(prod, "remove")
                            setShowLocationStock(false)
                          }}
                          className="h-7 px-2 text-xs font-bold border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                        >
                          -1
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            upsertProduct(prod, "add")
                            setShowLocationStock(false)
                          }}
                          className="h-7 px-2 text-xs font-bold bg-primary text-primary-foreground"
                        >
                          +1
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lista de Itens Coletados */}
      <div className="flex-1 overflow-y-auto p-4 bg-accent">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3 mt-10 px-4">
            <Scan className="h-14 w-14 opacity-50" />
            <p className="text-base font-medium text-center">
              Bipe ou pesquise um produto para adicionar ou remover unidades da contagem
            </p>
            <p className="text-xs text-muted-foreground/80 text-center max-w-xs">
              Você verá a quantidade atual no sistema e poderá tirar (-) ou adicionar (+) itens facilmente.
            </p>
          </div>
        ) : (
          <div className="space-y-3 pb-4">
            {items.map((item) => {
              const diff = Number((item.quantity - item.systemQuantity).toFixed(4))
              const isRemoving = diff < 0
              const isAdding = diff > 0

              return (
                <div
                  key={item.productId}
                  className={cn(
                    "bg-card p-4 rounded-md shadow-sm border transition-colors",
                    isRemoving
                      ? "border-rose-500/40"
                      : isAdding
                      ? "border-emerald-500/40"
                      : "border-border"
                  )}
                >
                  {/* Cabeçalho do Produto */}
                  <div className="flex justify-between items-start gap-2 mb-2.5">
                    <div className="min-w-0">
                      <h3 className="font-bold text-foreground leading-tight">{item.code}</h3>
                      <p className="text-xs text-muted-foreground truncate">{item.name}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.productId)}
                      className="text-red-400 hover:text-red-600 hover:bg-red-500/10 -mt-1 -mr-1 h-8 w-8 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Painel de Saldo no Sistema vs Variação */}
                  <div className="grid grid-cols-2 gap-2 mb-3 p-2.5 rounded-md bg-muted/40 border border-border/60 text-xs">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-semibold">
                        Qtd. no Sistema
                      </span>
                      <span className="text-sm font-black text-foreground">
                        {formatNumber(item.systemQuantity)} {item.unitCode}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-semibold">
                        Diferença / Ajuste
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-black",
                          isRemoving
                            ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                            : isAdding
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                        )}
                      >
                        {diff > 0
                          ? `+${formatNumber(diff)} ${item.unitCode} (Sobra)`
                          : diff < 0
                          ? `${formatNumber(diff)} ${item.unitCode} (Falta)`
                          : "0 (Igual ao sistema)"}
                      </span>
                    </div>
                  </div>

                  {/* Controles de Quantidade (Tirar / Adicionar / Quantidade Final) */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1 bg-accent rounded-lg p-1 border border-border/60">
                      <Button
                        type="button"
                        variant="ghost"
                        title="Tirar 1 unidade"
                        onClick={() => changeQuantity(item.productId, -1)}
                        disabled={item.quantity <= 0}
                        className="h-10 px-2.5 rounded-md bg-card shadow-sm text-rose-400 hover:text-rose-300 hover:bg-rose-500/15 font-bold text-xs gap-1"
                      >
                        <Minus className="h-4 w-4" />
                        Tirar
                      </Button>

                      <div className="flex flex-col items-center px-1">
                        <span className="text-[9px] uppercase font-semibold text-muted-foreground leading-none mb-0.5">
                          Qtd. Final
                        </span>
                        <input
                          type="number"
                          step="0.0001"
                          min="0"
                          name={`qty_${item.productId}`}
                          value={item.quantity}
                          onChange={(e) => setExactQuantity(item.productId, e.target.value)}
                          className="w-16 h-7 text-center font-black text-base bg-transparent border-none focus:ring-0 text-foreground p-0"
                        />
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        title="Adicionar 1 unidade"
                        onClick={() => changeQuantity(item.productId, 1)}
                        className="h-10 px-2.5 rounded-md bg-card shadow-sm text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/15 font-bold text-xs gap-1"
                      >
                        <Plus className="h-4 w-4" />
                        Somar
                      </Button>
                    </div>

                    {/* Atalhos rápidos */}
                    <div className="flex items-center gap-1.5">
                      {item.quantity !== item.systemQuantity && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setExactQuantity(item.productId, String(item.systemQuantity))}
                          className="h-8 px-2 text-[11px] font-medium gap-1"
                          title="Voltar para a quantidade do sistema"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Sistema ({formatNumber(item.systemQuantity)})
                        </Button>
                      )}
                      {item.quantity > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setExactQuantity(item.productId, "0")}
                          className="h-8 px-2 text-[11px] font-medium text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                          title="Zerar contagem deste item"
                        >
                          Zerar (0)
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer / Send */}
      <div className="bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10 sticky bottom-0">
        <Button
          type="button"
          onClick={handleFinish}
          disabled={items.length === 0 || isSaving}
          className="w-full h-14 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md flex items-center justify-center gap-2"
        >
          <Send className="h-6 w-6" />
          {isSaving ? "Salvando Coleta..." : "Finalizar Coleta"}
        </Button>
      </div>
    </div>
  )
}
