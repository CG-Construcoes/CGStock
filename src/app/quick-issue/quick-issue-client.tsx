"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { verifyEmployeeQR, getProductStockForQuickIssue, confirmQuickIssue } from "./actions"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { QrCode, User, Building, Package, Plus, Minus, CheckCircle2, Loader2, ArrowLeft, Camera } from "lucide-react"
import { queueOfflineOperation } from "@/lib/offline-sync"
import {
  getOfflineSnapshot,
  isSnapshotAvailableOffline,
  resolveEmployeeOffline,
  getProductStockOffline,
} from "@/lib/offline-snapshot"
import type { CatalogSnapshotData, StockSnapshotData, LocalCatalogProduct } from "@/lib/localdb"
import { CameraScannerModal } from "@/components/ui/camera-scanner-modal"

type EmployeeContext = {
  employee: { id: string; name: string; email?: string | null; employeeCode?: string | null; document?: string | null }
  worksite: { id: string; name: string }
  warehouse: { id: string; name: string }
  qrToken?: string
  offline?: boolean
}

type CartItem = {
  productId: string
  code: string
  name: string
  unit: string
  requestedQuantity: number
  availableQuantity: number | null
}

export function QuickIssueClient({ userId, sessionExpiresAt }: { userId: string; sessionExpiresAt: string }) {
  const [context, setContext] = useState<EmployeeContext | null>(null)

  // Scanners
  const [employeeQr, setEmployeeQr] = useState("")
  const [productQr, setProductQr] = useState("")
  const [isCameraScanningEmployee, setIsCameraScanningEmployee] = useState(false)
  const [isCameraScanningProduct, setIsCameraScanningProduct] = useState(false)

  // Loading states
  const [isScanningEmployee, setIsScanningEmployee] = useState(false)
  const [isScanningProduct, setIsScanningProduct] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)

  // Cart & Local Catalog cache for instant suggestions
  const [cart, setCart] = useState<CartItem[]>([])
  const [localCatalog, setLocalCatalog] = useState<CatalogSnapshotData | undefined>(undefined)
  const [localStock, setLocalStock] = useState<StockSnapshotData | undefined>(undefined)

  const employeeInputRef = useRef<HTMLInputElement>(null)
  const productInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const loadLocalData = async () => {
      const [catSnap, stkSnap] = await Promise.all([
        getOfflineSnapshot<CatalogSnapshotData>("catalog", userId),
        getOfflineSnapshot<StockSnapshotData>("stock", userId),
      ])
      if (isSnapshotAvailableOffline(catSnap, userId)) setLocalCatalog(catSnap?.data)
      if (isSnapshotAvailableOffline(stkSnap, userId)) setLocalStock(stkSnap?.data)
    }
    void loadLocalData()
    window.addEventListener("cgstock:offline-data-updated", loadLocalData)
    return () => window.removeEventListener("cgstock:offline-data-updated", loadLocalData)
  }, [userId])

  useEffect(() => {
    if (!context && employeeInputRef.current) {
      employeeInputRef.current.focus()
    } else if (context && productInputRef.current) {
      productInputRef.current.focus()
    }
  }, [context])

  const resolveEmployeeFromLocal = async (trimmed: string) => {
    const catSnap = await getOfflineSnapshot<CatalogSnapshotData>("catalog", userId)
    const catalogData = isSnapshotAvailableOffline(catSnap, userId) ? catSnap?.data : localCatalog
    const resolved = resolveEmployeeOffline(trimmed, catalogData)
    if ("error" in resolved && resolved.error) {
      toast.error(resolved.error)
      setEmployeeQr("")
      return
    }
    if (resolved.success) {
      setContext({
        employee: resolved.employee,
        worksite: resolved.worksite,
        warehouse: resolved.warehouse,
        qrToken: resolved.qrToken || trimmed,
        offline: true,
      })
      setEmployeeQr("")
      if (resolved.unverifiedOffline) {
        toast.info("Sem conexão: colaborador registrado e será validado ao sincronizar.")
      } else {
        toast.success(`Funcionário ${resolved.employee.name} identificado (modo offline)!`)
      }
    }
  }

  const processEmployeeScan = async (code: string) => {
    const trimmed = code.trim()
    if (!trimmed) return

    setIsScanningEmployee(true)
    if (!navigator.onLine) {
      await resolveEmployeeFromLocal(trimmed)
      setIsScanningEmployee(false)
      return
    }

    try {
      const result = await verifyEmployeeQR(trimmed)
      setIsScanningEmployee(false)

      if (result.error) {
        toast.error(result.error)
        setEmployeeQr("")
        return
      }

      setContext({
        employee: result.employee!,
        worksite: result.worksite!,
        warehouse: result.warehouse!,
        qrToken: trimmed,
      })
      setEmployeeQr("")
      toast.success(`Funcionário ${result.employee?.name} identificado com sucesso!`)
    } catch {
      // Queda abrupta de conexão durante a chamada ao servidor: faz fallback transparente para o banco local
      await resolveEmployeeFromLocal(trimmed)
      setIsScanningEmployee(false)
    }
  }

  const handleEmployeeScan = (e: React.FormEvent) => {
    e.preventDefault()
    void processEmployeeScan(employeeQr)
  }

  const resolveProductFromLocal = async (trimmed: string, activeContext: EmployeeContext) => {
    const [catSnap, stkSnap] = await Promise.all([
      getOfflineSnapshot<CatalogSnapshotData>("catalog", userId),
      getOfflineSnapshot<StockSnapshotData>("stock", userId),
    ])
    if (!isSnapshotAvailableOffline(catSnap, userId)) {
      toast.error("Catálogo offline ainda não foi carregado neste aparelho. Conecte-se à internet uma vez para sincronizar.")
      setProductQr("")
      return
    }

    const stkData = isSnapshotAvailableOffline(stkSnap, userId) ? stkSnap?.data : undefined
    const res = getProductStockOffline(catSnap!.data, stkData, activeContext.warehouse.id, trimmed)
    if ("error" in res && res.error) {
      toast.error(res.error)
      setProductQr("")
      return
    }
    if (res.success && res.product) {
      if (cart.find((c) => c.productId === res.product.id)) {
        toast.info("Produto já adicionado. Altere a quantidade na lista.")
        setProductQr("")
        return
      }
      setCart((prev) => [
        ...prev,
        {
          productId: res.product.id,
          code: res.product.code,
          name: res.product.name,
          unit: res.product.unit,
          availableQuantity: res.totalAvailable,
          requestedQuantity: 1,
        },
      ])
      setProductQr("")
      toast.success(`${res.product.name} adicionado.`)
      if (productInputRef.current) productInputRef.current.focus()
    }
  }

  const processProductScan = async (code: string) => {
    const trimmed = code.trim()
    if (!trimmed || !context) return

    if (cart.find((c) => c.code.toLowerCase() === trimmed.toLowerCase())) {
      toast.info("Produto já adicionado. Altere a quantidade na lista.")
      setProductQr("")
      return
    }

    setIsScanningProduct(true)
    if (!navigator.onLine || context.offline) {
      await resolveProductFromLocal(trimmed, context)
      setIsScanningProduct(false)
      return
    }

    try {
      const result = await getProductStockForQuickIssue(context.worksite.id, context.warehouse.id, trimmed)
      setIsScanningProduct(false)

      if (result.error) {
        toast.error(result.error)
        setProductQr("")
        return
      }

      if (cart.find((c) => c.productId === result.product!.id)) {
        toast.info("Produto já adicionado. Altere a quantidade na lista.")
        setProductQr("")
        return
      }

      setCart((prev) => [
        ...prev,
        {
          productId: result.product!.id,
          code: result.product!.code,
          name: result.product!.name,
          unit: result.product!.unit,
          availableQuantity: result.totalAvailable!,
          requestedQuantity: 1,
        },
      ])

      setProductQr("")
      toast.success(`${result.product?.name} adicionado.`)
      if (productInputRef.current) productInputRef.current.focus()
    } catch {
      await resolveProductFromLocal(trimmed, context)
      setIsScanningProduct(false)
    }
  }

  const handleProductScan = (e: React.FormEvent) => {
    e.preventDefault()
    void processProductScan(productQr)
  }

  const productSuggestions = useMemo(() => {
    const clean = productQr.trim().toLowerCase()
    if (!clean || !localCatalog?.products) return []
    return localCatalog.products
      .filter(
        (p) =>
          p.code.toLowerCase().includes(clean) ||
          (p.barcode && p.barcode.toLowerCase().includes(clean)) ||
          p.name.toLowerCase().includes(clean)
      )
      .slice(0, 5)
  }, [productQr, localCatalog])

  const getLocalAvailableForProduct = (prod: LocalCatalogProduct): number | null => {
    if (!localStock?.items || !context?.warehouse.id) return null
    return localStock.items
      .filter((s) => s.productId === prod.id && s.warehouseId === context.warehouse.id && s.quantity > 0)
      .reduce((sum, s) => sum + Number(s.quantity), 0)
  }

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          const newQty = item.requestedQuantity + delta
          if (newQty < 1) return item
          if (item.availableQuantity !== null && newQty > item.availableQuantity) {
            toast.error("Quantidade superior ao estoque disponível.")
            return item
          }
          return { ...item, requestedQuantity: newQty }
        }
        return item
      })
    )
  }

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId))
  }

  const saveOfflineIssue = async (activeContext: EmployeeContext) => {
    const qrToken =
      activeContext.qrToken ||
      activeContext.employee.employeeCode ||
      activeContext.employee.document ||
      activeContext.employee.id
    await queueOfflineOperation(
      "CREATE_QUICK_ISSUE",
      {
        qrToken,
        employeeId: activeContext.employee.id || undefined,
        worksiteId: activeContext.worksite.id || undefined,
        warehouseId: activeContext.warehouse.id || undefined,
        items: cart.map((c) => ({
          productId: c.productId,
          productCode: c.code,
          quantity: c.requestedQuantity,
        })),
      },
      userId
    )
    toast.success("Entrega registrada no dispositivo! Sincronizaremos automaticamente assim que houver conexão.")
    setContext(null)
    setCart([])
  }

  const handleConfirm = async () => {
    if (!context || cart.length === 0) return

    setIsConfirming(true)
    if (!navigator.onLine || context.offline) {
      try {
        await saveOfflineIssue(context)
      } catch (err) {
        toast.error("Erro ao salvar offline: " + (err instanceof Error ? err.message : "Erro desconhecido"))
      } finally {
        setIsConfirming(false)
      }
      return
    }

    if (Date.now() >= new Date(sessionExpiresAt).getTime()) {
      setIsConfirming(false)
      toast.error("Sessão expirada. Conecte-se e entre novamente para confirmar a entrega.")
      return
    }

    const payload = {
      employeeId: context.employee.id,
      worksiteId: context.worksite.id,
      warehouseId: context.warehouse.id,
      items: cart.map((c) => ({
        productId: c.productId,
        requestedQuantity: c.requestedQuantity,
      })),
    }
    try {
      const result = await confirmQuickIssue(payload)
      setIsConfirming(false)

      if (result.error) {
        toast.error(result.error)
      } else {
        const erp = (result as { informakon?: { attempted?: boolean; ok?: boolean; numero?: number; erro?: string } }).informakon
        toast.success(`Entrega confirmada com sucesso! (${result.issueNumber})${erp?.ok ? ` · Informakon: saída #${erp.numero}` : ""}`)
        if (erp?.attempted && !erp.ok) {
          toast.warning(`Entrega salva localmente, mas não refletiu no Informakon: ${erp.erro}`)
        }
        setContext(null)
        setCart([])
      }
    } catch {
      try {
        await saveOfflineIssue(context)
      } catch (err) {
        toast.error("Erro ao salvar offline: " + (err instanceof Error ? err.message : "Erro desconhecido"))
      } finally {
        setIsConfirming(false)
      }
    }
  }

  const totalItems = cart.reduce((sum, item) => sum + item.requestedQuantity, 0)

  if (!context) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex flex-col items-center justify-center p-4 relative overflow-hidden rounded-md">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-sm space-y-6 z-10">
          <div className="text-center space-y-3">
            <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping duration-1000" />
              <div className="relative bg-emerald-100 dark:bg-emerald-900/50 w-20 h-20 rounded-full flex items-center justify-center shadow-sm shadow-emerald-500/20 border border-emerald-200 dark:border-emerald-800">
                <QrCode className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground pb-1">
                Registrar Saída
              </h1>
              <p className="text-muted-foreground mt-1 text-sm font-medium px-2">
                Escaneie o QR Code do capacete com a câmera ou digite a matrícula do colaborador.
              </p>
            </div>
          </div>

          <div className="space-y-4 bg-card p-6 rounded-[2rem] border border-border shadow-sm">
            <Button
              type="button"
              onClick={() => setIsCameraScanningEmployee(true)}
              className="w-full h-14 text-base font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-600/20 active:scale-[0.98] gap-3 transition-all"
            >
              <Camera className="h-5 w-5" />
              Abrir Câmera para Escanear
            </Button>

            <div className="relative flex items-center justify-center my-1">
              <div className="border-t border-border w-full" />
              <span className="bg-card px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold shrink-0">
                ou digite o código
              </span>
            </div>

            <form onSubmit={handleEmployeeScan} className="space-y-3">
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  ref={employeeInputRef}
                  placeholder="Código, matrícula ou CPF..."
                  value={employeeQr}
                  onChange={(e) => setEmployeeQr(e.target.value)}
                  className="pl-12 h-12 text-base bg-background/80 border-border shadow-inner focus-visible:ring-emerald-500 rounded-xl font-medium"
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                className="w-full h-11 text-sm font-semibold rounded-xl border-border hover:bg-muted"
                disabled={isScanningEmployee || !employeeQr}
              >
                {isScanningEmployee ? <Loader2 className="h-4 w-4 animate-spin" /> : "Avançar"}
              </Button>
            </form>
          </div>
        </div>

        <CameraScannerModal
          isOpen={isCameraScanningEmployee}
          onClose={() => setIsCameraScanningEmployee(false)}
          onScan={(code) => {
            setIsCameraScanningEmployee(false)
            void processEmployeeScan(code)
          }}
          title="Escanear Capacete ou Crachá"
          subtitle="Aponte a câmera para o QR Code do funcionário"
        />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto space-y-6 pb-20 px-4">
      <Card className="border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm overflow-hidden">
        <div className="bg-emerald-600 px-4 py-2 flex justify-between items-center text-white">
          <span className="font-semibold text-sm tracking-wide">REGISTRAR SAÍDA</span>
          <button
            onClick={() => {
              setContext(null)
              setCart([])
            }}
            className="text-emerald-100 hover:text-white p-1"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 dark:bg-emerald-900/50 p-2 rounded-full text-emerald-600 dark:text-emerald-400">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-gray-100">{context.employee.name}</p>
              <p className="text-xs text-muted-foreground">Destinatário</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-100 dark:border-emerald-900/30">
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <Building className="h-4 w-4 text-emerald-500" />
              <span className="truncate">{context.worksite.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <Package className="h-4 w-4 text-emerald-500" />
              <span className="truncate">{context.warehouse.name}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleProductScan} className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              ref={productInputRef}
              placeholder="Código do produto, nome ou MAT-XXXX..."
              value={productQr}
              onChange={(e) => setProductQr(e.target.value)}
              className="pl-10 h-12 text-sm bg-background shadow-sm border-border focus-visible:ring-emerald-500 rounded-xl"
              autoFocus
            />
          </div>
          <Button
            type="button"
            onClick={() => setIsCameraScanningProduct(true)}
            className="h-12 px-4 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm shrink-0 active:scale-95 transition-all"
            title="Escanear produto com a câmera"
          >
            <Camera className="h-5 w-5" />
            <span className="hidden sm:inline">Câmera</span>
          </Button>
        </div>

        {productSuggestions.length > 0 && (
          <div className="rounded-xl border border-border bg-card divide-y divide-border shadow-sm max-h-52 overflow-y-auto">
            {productSuggestions.map((prod) => {
              const avail = getLocalAvailableForProduct(prod)
              return (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => void processProductScan(prod.code)}
                  className="w-full p-2.5 flex items-center justify-between gap-2 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-foreground block">{prod.code}</span>
                    <span className="text-xs text-muted-foreground truncate block">{prod.name}</span>
                  </div>
                  {avail !== null && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                      Disp: {avail} {prod.unitCode || "UN"}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        <Button type="submit" variant="outline" className="w-full text-xs" disabled={isScanningProduct || !productQr}>
          {isScanningProduct ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar Item Manualmente"}
        </Button>
      </form>

      <CameraScannerModal
        isOpen={isCameraScanningProduct}
        onClose={() => setIsCameraScanningProduct(false)}
        onScan={(code) => {
          setIsCameraScanningProduct(false)
          void processProductScan(code)
        }}
        title="Escanear Produto / Insumo"
        subtitle="Aponte a câmera para o código de barras ou QR Code do item"
      />

      {cart.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase text-muted-foreground tracking-wider border-b pb-2">
            Itens ({cart.length})
          </h3>

          <div className="space-y-3">
            {cart.map((item) => (
              <div
                key={item.productId}
                className="flex flex-col gap-2 p-3 bg-white dark:bg-zinc-900 rounded-md border border-gray-100 dark:border-zinc-800 shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.code} • Disp: {item.availableQuantity === null ? "—" : item.availableQuantity} {item.unit}
                    </p>
                  </div>
                  <button
                    onClick={() => removeItem(item.productId)}
                    className="text-red-400 hover:text-red-600 text-xs font-medium"
                  >
                    Remover
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-1 bg-gray-50 dark:bg-zinc-950 p-1 rounded-lg border border-gray-200 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.productId, -1)}
                      className="w-8 h-8 flex items-center justify-center rounded-md bg-white dark:bg-zinc-900 shadow-sm text-gray-600 hover:text-red-500 active:scale-95"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <div className="w-12 text-center font-bold text-lg">{item.requestedQuantity}</div>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.productId, 1)}
                      className="w-8 h-8 flex items-center justify-center rounded-md bg-white dark:bg-zinc-900 shadow-sm text-gray-600 hover:text-emerald-600 active:scale-95"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-muted-foreground">Total: </span>
                    <span className="font-bold text-lg">
                      {item.requestedQuantity} {item.unit}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-6">
            <Button
              onClick={handleConfirm}
              disabled={isConfirming}
              className="w-full h-14 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 active:scale-95 "
            >
              {isConfirming ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Processando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 mr-2" /> Confirmar {totalItems} {totalItems === 1 ? "item" : "itens"}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
