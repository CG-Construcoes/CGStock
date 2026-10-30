"use client"

import { useState, useRef, useEffect } from "react"
import {
  verifyEmployeeForToolLoan,
  getProductStockForToolLoan,
  confirmToolLoan,
  returnToolLoanItem,
  listOpenToolLoans,
  type OpenLoanItemDTO,
  type OpenEmployeeLoanSummary,
} from "./actions"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CameraScannerModal } from "@/components/ui/camera-scanner-modal"
import { EmployeeTransferModal, type PendingEmployeeTransfer } from "@/components/ui/employee-transfer-modal"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  QrCode,
  Camera,
  User,
  Building,
  Package,
  Plus,
  Minus,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  AlertTriangle,
  Undo2,
  ArrowUpRight,
  Clock,
  HardHat,
  Trash2,
} from "lucide-react"

type EmployeeContext = {
  employee: {
    id: string
    name: string
    email?: string | null
    employeeCode?: string | null
    document?: string | null
  }
  worksite: { id: string; name: string }
  warehouse: { id: string; name: string }
}

type LoanCartItem = {
  productId: string
  code: string
  name: string
  unit: string
  requestedQuantity: number
  availableQuantity: number
}

type DiscrepancyAlert = {
  employeeName: string
  productName: string
  unitCode: string
  loaned: number
  returnedNow: number
  totalReturned: number
  missing: number
  message: string
}

export function ToolLoansClient({
  initialSummaries,
  initialWarehouseName,
}: {
  initialSummaries: OpenEmployeeLoanSummary[]
  initialWarehouseName: string | null
}) {
  const [context, setContext] = useState<EmployeeContext | null>(null)
  const [openItems, setOpenItems] = useState<OpenLoanItemDTO[]>([])
  const [activeTab, setActiveTab] = useState<"LOAN" | "RETURN">("LOAN")

  const [summaries, setSummaries] = useState<OpenEmployeeLoanSummary[]>(initialSummaries)
  const [warehouseLabel, setWarehouseLabel] = useState<string | null>(initialWarehouseName)

  // Inputs & Camera
  const [employeeQr, setEmployeeQr] = useState("")
  const [productQr, setProductQr] = useState("")
  const [returnScanQr, setReturnScanQr] = useState("")
  const [isCameraEmployee, setIsCameraEmployee] = useState(false)
  const [isCameraProduct, setIsCameraProduct] = useState(false)
  const [isCameraReturnProduct, setIsCameraReturnProduct] = useState(false)

  // Loading states
  const [isScanningEmployee, setIsScanningEmployee] = useState(false)
  const [isScanningProduct, setIsScanningProduct] = useState(false)
  const [isConfirmingLoan, setIsConfirmingLoan] = useState(false)
  const [returningItemId, setReturningItemId] = useState<string | null>(null)
  const [pendingTransfer, setPendingTransfer] = useState<PendingEmployeeTransfer | null>(null)
  const [isTransferringEmployee, setIsTransferringEmployee] = useState(false)

  // Carrinho de empréstimo
  const [cart, setCart] = useState<LoanCartItem[]>([])
  const [loanNotes, setLoanNotes] = useState("")

  // Quantidade que o funcionário está devolvendo por itemId
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({})
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null)
  const [discrepancyAlert, setDiscrepancyAlert] = useState<DiscrepancyAlert | null>(null)

  const employeeInputRef = useRef<HTMLInputElement>(null)
  const productInputRef = useRef<HTMLInputElement>(null)
  const returnProductInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const refreshSummaries = async () => {
      const res = await listOpenToolLoans()
      setSummaries(res.summaries)
      setWarehouseLabel(res.activeWarehouseName)
    }
    window.addEventListener("cgstock:warehouse-changed", refreshSummaries)
    return () => window.removeEventListener("cgstock:warehouse-changed", refreshSummaries)
  }, [])

  const refreshOpenSummaries = async () => {
    const res = await listOpenToolLoans()
    setSummaries(res.summaries)
    setWarehouseLabel(res.activeWarehouseName)
  }

  const processEmployeeScan = async (
    rawCode: string,
    options?: { confirmTransfer?: boolean; explicitWarehouseId?: string }
  ) => {
    const trimmed = rawCode.trim()
    if (!trimmed) return

    setIsScanningEmployee(true)
    setDiscrepancyAlert(null)
    try {
      const res = await verifyEmployeeForToolLoan(trimmed, options)
      if ("success" in res && res.success) {
        setPendingTransfer(null)
        setContext({
          employee: res.employee,
          worksite: res.worksite,
          warehouse: res.warehouse,
        })
        setOpenItems(res.openItems)
        setActiveTab(res.openItems.length > 0 ? "RETURN" : "LOAN")
        setEmployeeQr("")
        if (res.transferredFromWarehouseName) {
          toast.success(
            `${res.employee.name} transferido de ${res.transferredFromWarehouseName} para ${res.warehouse.name}!`
          )
        } else if (res.autoLinkedFirstTime) {
          toast.success(`${res.employee.name} vinculado ao almoxarifado ${res.warehouse.name}!`)
        } else {
          toast.success(
            res.openItems.length > 0
              ? `${res.employee.name} identificado — possui ${res.openItems.length} item(ns) para devolver.`
              : `${res.employee.name} identificado!`
          )
        }
        return
      }
      if ("requiresTransfer" in res && res.requiresTransfer) {
        setPendingTransfer({
          employee: res.employee,
          currentWarehouse: res.currentWarehouse,
          targetWarehouse: res.targetWarehouse,
          qrToken: res.qrToken,
        })
        setEmployeeQr("")
        return
      }
      toast.error("error" in res && res.error ? res.error : "Falha ao validar funcionário.")
      setEmployeeQr("")
    } catch {
      toast.error("Erro ao consultar funcionário.")
    } finally {
      setIsScanningEmployee(false)
    }
  }

  const handleConfirmEmployeeTransfer = async () => {
    if (!pendingTransfer) return
    setIsTransferringEmployee(true)
    try {
      await processEmployeeScan(pendingTransfer.qrToken, {
        confirmTransfer: true,
        explicitWarehouseId: pendingTransfer.targetWarehouse.id,
      })
    } finally {
      setIsTransferringEmployee(false)
    }
  }

  const openFromSummary = (summary: OpenEmployeeLoanSummary) => {
    setDiscrepancyAlert(null)
    setContext({
      employee: summary.employee,
      worksite: { id: summary.worksiteId, name: summary.worksiteName },
      warehouse: { id: summary.warehouseId, name: summary.warehouseName },
    })
    setOpenItems(summary.items)
    setActiveTab("RETURN")
  }

  const processProductScanForLoan = async (rawCode: string) => {
    const trimmed = rawCode.trim()
    if (!trimmed || !context) return

    setIsScanningProduct(true)
    try {
      const res = await getProductStockForToolLoan(context.worksite.id, context.warehouse.id, trimmed)
      if ("error" in res && res.error) {
        toast.error(res.error)
        setProductQr("")
        return
      }
      if (res.success && res.product) {
        if (res.totalAvailable <= 0) {
          toast.error(`"${res.product.name}" está sem saldo disponível neste almoxarifado.`)
          setProductQr("")
          return
        }
        setCart((prev) => {
          const existing = prev.find((i) => i.productId === res.product.id)
          if (existing) {
            if (existing.requestedQuantity + 1 > res.totalAvailable) {
              toast.warning(`Saldo máximo disponível atingido (${res.totalAvailable} ${res.product.unit}).`)
              return prev
            }
            toast.success(`+1 ${res.product.name}`)
            return prev.map((i) =>
              i.productId === res.product.id ? { ...i, requestedQuantity: i.requestedQuantity + 1 } : i
            )
          }
          toast.success(`${res.product.name} adicionado!`)
          return [
            ...prev,
            {
              productId: res.product.id,
              code: res.product.code,
              name: res.product.name,
              unit: res.product.unit,
              requestedQuantity: 1,
              availableQuantity: res.totalAvailable,
            },
          ]
        })
        setProductQr("")
      }
    } catch {
      toast.error("Erro ao buscar produto.")
    } finally {
      setIsScanningProduct(false)
    }
  }

  const processProductScanForReturn = (rawCode: string) => {
    const trimmed = rawCode.trim().toUpperCase()
    if (!trimmed) return

    const match = openItems.find(
      (it) =>
        it.productCode.toUpperCase() === trimmed ||
        it.productCode.toUpperCase().startsWith(trimmed) ||
        it.productName.toUpperCase().includes(trimmed)
    )

    setReturnScanQr("")
    if (!match) {
      toast.error(`Nenhum empréstimo em aberto encontrado para "${rawCode}" com este funcionário.`)
      return
    }

    setHighlightedItemId(match.itemId)
    toast.info(`Item localizado: ${match.productName} (emprestado: ${match.quantityLoaned} ${match.unitCode}).`)
    const el = document.getElementById(`loan-item-${match.itemId}`)
    el?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  const updateCartQuantity = (productId: string, newQty: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item
        const clamped = Math.max(1, Math.min(Math.floor(newQty) || 1, item.availableQuantity))
        if (newQty > item.availableQuantity) {
          toast.warning(`Saldo disponível: ${item.availableQuantity} ${item.unit}`)
        }
        return { ...item, requestedQuantity: clamped }
      })
    )
  }

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId))
  }

  const handleConfirmLoan = async () => {
    if (!context || cart.length === 0) return

    setIsConfirmingLoan(true)
    try {
      const res = await confirmToolLoan({
        employeeId: context.employee.id,
        worksiteId: context.worksite.id,
        warehouseId: context.warehouse.id,
        notes: loanNotes,
        items: cart.map((c) => ({
          productId: c.productId,
          requestedQuantity: c.requestedQuantity,
        })),
      })

      if ("error" in res && res.error) {
        toast.error(res.error)
        return
      }

      if (res.success) {
        toast.success(`Cautela ${res.loanNumber} registrada com sucesso!`)
        setCart([])
        setLoanNotes("")
        setOpenItems(res.openItems)
        await refreshOpenSummaries()
        setActiveTab("RETURN")
      }
    } catch {
      toast.error("Erro ao confirmar empréstimo.")
    } finally {
      setIsConfirmingLoan(false)
    }
  }

  const handleReturnItem = async (item: OpenLoanItemDTO) => {
    const qty = Math.floor(Number(returnQuantities[item.itemId] ?? item.quantityPending))
    if (!qty || qty <= 0) {
      toast.error("Informe a quantidade que o funcionário está entregando.")
      return
    }

    setReturningItemId(item.itemId)
    setDiscrepancyAlert(null)
    try {
      const res = await returnToolLoanItem({
        itemId: item.itemId,
        quantityReturning: qty,
      })

      if ("error" in res && res.error) {
        toast.error(res.error)
        return
      }

      if (res.success) {
        setOpenItems(res.openItems)
        setReturnQuantities((prev) => {
          const copy = { ...prev }
          delete copy[item.itemId]
          return copy
        })
        await refreshOpenSummaries()

        if (res.discrepancy) {
          setDiscrepancyAlert(res.discrepancy)
          toast.warning(res.discrepancy.message, { duration: 9000 })
        } else {
          toast.success(
            `Devolução completa de ${item.productName} (${qty} ${item.unitCode}) registrada no estoque!`
          )
        }
      }
    } catch {
      toast.error("Erro ao registrar devolução.")
    } finally {
      setReturningItemId(null)
    }
  }

  const resetSession = () => {
    setContext(null)
    setOpenItems([])
    setCart([])
    setLoanNotes("")
    setEmployeeQr("")
    setProductQr("")
    setReturnScanQr("")
    setDiscrepancyAlert(null)
    void refreshOpenSummaries()
  }

  const totalPendingInContext = openItems.reduce((sum, i) => sum + i.quantityPending, 0)

  return (
    <div className="space-y-5 sm:space-y-6 pb-24 sm:pb-8">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Cautela Diária de Ferramentas</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Empréstimo e devolução do dia a dia por QR Code do capacete e do material.
          </p>
        </div>
        {warehouseLabel && (
          <Badge variant="outline" className="self-start sm:self-auto text-xs px-3 py-1">
            Almoxarifado: {warehouseLabel}
          </Badge>
        )}
      </div>

      {/* PASSO 1: ESCANEAR CAPACETE + PAINEL DE CAUTELAS EM ABERTO */}
      {!context && (
        <>
          <Card className="border-2 border-dashed border-primary/30 bg-muted/40">
            <CardContent className="p-5 sm:p-8 flex flex-col items-center text-center space-y-5">
              <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                <HardHat className="h-8 w-8" />
              </div>
              <div className="space-y-1 max-w-md">
                <h2 className="text-lg sm:text-xl font-bold">1. Identificar Funcionário</h2>
                <p className="text-sm text-muted-foreground">
                  Escaneie o QR Code do capacete/crachá do colaborador para <strong>emprestar</strong> ou{" "}
                  <strong>receber a devolução</strong> do fim do dia.
                </p>
              </div>

              <div className="w-full max-w-md space-y-3">
                <Button
                  type="button"
                  onClick={() => setIsCameraEmployee(true)}
                  disabled={isScanningEmployee}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-sm"
                >
                  <Camera className="h-5 w-5" />
                  Escanear Capacete com Câmera
                </Button>

                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void processEmployeeScan(employeeQr)
                  }}
                  className="flex gap-2"
                >
                  <Input
                    ref={employeeInputRef}
                    placeholder="Ou digite/bipe matrícula, CPF ou QR..."
                    value={employeeQr}
                    onChange={(e) => setEmployeeQr(e.target.value)}
                    className="h-11 bg-card"
                    disabled={isScanningEmployee}
                  />
                  <Button type="submit" variant="outline" className="h-11 px-4" disabled={isScanningEmployee}>
                    {isScanningEmployee ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>

          {/* Painel de funcionários com ferramentas em mãos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Funcionários com ferramentas em mãos ({summaries.length})
              </h3>
            </div>

            {summaries.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  Nenhuma ferramenta pendente de devolução neste momento.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {summaries.map((s) => (
                  <Card
                    key={`${s.employee.id}_${s.warehouseId}`}
                    className={cn(
                      "transition-colors",
                      s.hasPartialDiscrepancy && "border-amber-400 dark:border-amber-600 bg-amber-50/40 dark:bg-amber-950/20"
                    )}
                  >
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-base truncate">{s.employee.name}</span>
                          {s.employee.employeeCode && (
                            <Badge variant="outline" className="font-mono text-xs">
                              {s.employee.employeeCode}
                            </Badge>
                          )}
                          {s.hasPartialDiscrepancy ? (
                            <Badge variant="warning">Devolução incompleta</Badge>
                          ) : (
                            <Badge variant="secondary">{s.totalPending} un. em mãos</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {s.warehouseName} · Desde{" "}
                          {new Date(s.oldestLoanedAt).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {s.items.map((it) => (
                            <span
                              key={it.itemId}
                              className={cn(
                                "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border",
                                it.quantityReturned > 0
                                  ? "bg-amber-100/80 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-medium"
                                  : "bg-muted border-border text-foreground"
                              )}
                            >
                              {it.productName}:{" "}
                              {it.quantityReturned > 0 ? (
                                <strong>
                                  entregou {it.quantityReturned}/{it.quantityLoaned} (faltam {it.quantityPending})
                                </strong>
                              ) : (
                                <strong>
                                  {it.quantityPending} {it.unitCode}
                                </strong>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>

                      <Button
                        type="button"
                        onClick={() => openFromSummary(s)}
                        className="w-full sm:w-auto shrink-0"
                      >
                        <Undo2 className="h-4 w-4 mr-2" />
                        Receber / Ver itens
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* PASSO 2: FUNCIONÁRIO IDENTIFICADO — EMPRESTAR OU DEVOLVER */}
      {context && (
        <div className="space-y-5">
          {/* Card do funcionário */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                  <User className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base sm:text-lg leading-tight">{context.employee.name}</h3>
                    {context.employee.employeeCode && (
                      <Badge variant="outline" className="font-mono text-xs">
                        {context.employee.employeeCode}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1 flex-wrap">
                    <Building className="h-3.5 w-3.5 shrink-0" />
                    <span>Almoxarifado:</span>
                    <span className="font-medium text-foreground">{context.warehouse.name}</span>
                  </p>
                </div>
              </div>

              <Button type="button" variant="outline" size="sm" onClick={resetSession} className="w-full sm:w-auto">
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Trocar Funcionário
              </Button>
            </CardContent>
          </Card>

          {/* Alerta em destaque quando o peão devolveu menos do que pegou */}
          {discrepancyAlert && (
            <div className="rounded-xl border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/50 p-4 text-amber-950 dark:text-amber-100 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <h4 className="font-bold text-base">
                    Atenção: Devolução incompleta de {discrepancyAlert.productName}!
                  </h4>
                  <p className="text-sm font-medium">{discrepancyAlert.message}</p>
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    As {discrepancyAlert.returnedNow} {discrepancyAlert.unitCode} entregues já voltaram para o estoque,
                    e a pendência de{" "}
                    <strong>
                      {discrepancyAlert.missing} {discrepancyAlert.unitCode}
                    </strong>{" "}
                    continua registrada no nome de {discrepancyAlert.employeeName}.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Seletor de Modo: Emprestar x Devolver */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl border">
            <button
              type="button"
              onClick={() => setActiveTab("LOAN")}
              className={cn(
                "flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all",
                activeTab === "LOAN"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowUpRight className="h-4 w-4" />
              <span>Emprestar Material</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("RETURN")}
              className={cn(
                "flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all",
                activeTab === "RETURN"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Undo2 className="h-4 w-4" />
              <span>Devolver ({totalPendingInContext})</span>
            </button>
          </div>

          {/* ABA 1: EMPRESTAR MATERIAL */}
          {activeTab === "LOAN" && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4 sm:p-5 space-y-3">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-primary" />
                    Escanear ou buscar produto para emprestar
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      type="button"
                      onClick={() => setIsCameraProduct(true)}
                      disabled={isScanningProduct || isConfirmingLoan}
                      className="h-11 sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center justify-center gap-2"
                    >
                      <Camera className="h-4 w-4" />
                      Câmera QR
                    </Button>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        void processProductScanForLoan(productQr)
                      }}
                      className="flex gap-2 flex-1"
                    >
                      <Input
                        ref={productInputRef}
                        placeholder="Código, QR ou nome do produto (ex: Martelo)..."
                        value={productQr}
                        onChange={(e) => setProductQr(e.target.value)}
                        className="h-11"
                        disabled={isScanningProduct || isConfirmingLoan}
                      />
                      <Button
                        type="submit"
                        variant="outline"
                        className="h-11 px-4 shrink-0"
                        disabled={isScanningProduct || isConfirmingLoan}
                      >
                        {isScanningProduct ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>

              {/* Lista de itens para emprestar */}
              <Card>
                <CardContent className="p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      Itens que serão emprestados ({cart.length})
                    </h4>
                  </div>

                  {cart.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
                      Escaneie o QR Code do produto ou digite o código acima para adicionar (ex: 20 martelos).
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cart.map((item) => (
                        <div
                          key={item.productId}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border bg-muted/40"
                        >
                          <div className="min-w-0 flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-sm sm:text-base leading-snug break-words">{item.name}</p>
                              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                {item.code} · Disponível: <strong>{item.availableQuantity}</strong> {item.unit}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-red-500 hover:text-red-700 shrink-0 sm:hidden"
                              onClick={() => removeFromCart(item.productId)}
                              disabled={isConfirmingLoan}
                              aria-label="Remover item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between sm:justify-end gap-2">
                            <div className="flex items-center justify-between sm:justify-end gap-1.5">
                              <div className="flex items-center gap-1.5">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-11 w-11 sm:h-9 sm:w-9 shrink-0"
                                  onClick={() => updateCartQuantity(item.productId, item.requestedQuantity - 1)}
                                  disabled={item.requestedQuantity <= 1 || isConfirmingLoan}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  min={1}
                                  max={item.availableQuantity}
                                  value={item.requestedQuantity}
                                  onChange={(e) => updateCartQuantity(item.productId, Number(e.target.value))}
                                  className="h-11 sm:h-9 w-20 text-center font-bold text-base"
                                  disabled={isConfirmingLoan}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-11 w-11 sm:h-9 sm:w-9 shrink-0"
                                  onClick={() => updateCartQuantity(item.productId, item.requestedQuantity + 1)}
                                  disabled={item.requestedQuantity >= item.availableQuantity || isConfirmingLoan}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>

                              {/* Atalhos rápidos para celular (+5, +10) */}
                              <div className="flex items-center gap-1">
                                {item.availableQuantity >= 5 && (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="h-9 px-2.5 text-xs font-semibold"
                                    onClick={() => updateCartQuantity(item.productId, item.requestedQuantity + 5)}
                                    disabled={item.requestedQuantity >= item.availableQuantity || isConfirmingLoan}
                                  >
                                    +5
                                  </Button>
                                )}
                                {item.availableQuantity >= 10 && (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="h-9 px-2.5 text-xs font-semibold"
                                    onClick={() => updateCartQuantity(item.productId, item.requestedQuantity + 10)}
                                    disabled={item.requestedQuantity >= item.availableQuantity || isConfirmingLoan}
                                  >
                                    +10
                                  </Button>
                                )}
                              </div>
                            </div>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="hidden sm:inline-flex h-9 w-9 text-red-500 hover:text-red-700"
                              onClick={() => removeFromCart(item.productId)}
                              disabled={isConfirmingLoan}
                              aria-label="Remover item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      <div className="pt-2 space-y-3">
                        <Input
                          placeholder="Observação opcional (ex: Frente de serviço / Bloco B)..."
                          value={loanNotes}
                          onChange={(e) => setLoanNotes(e.target.value)}
                          disabled={isConfirmingLoan}
                        />

                        <Button
                          type="button"
                          onClick={handleConfirmLoan}
                          disabled={isConfirmingLoan || cart.length === 0}
                          className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base flex items-center justify-center gap-2"
                        >
                          {isConfirmingLoan ? (
                            <>
                              <Loader2 className="h-5 w-5 animate-spin" />
                              Registrando empréstimo...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-5 w-5" />
                              Confirmar Empréstimo para {context.employee.name.split(" ")[0]}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ABA 2: DEVOLVER MATERIAL */}
          {activeTab === "RETURN" && (
            <div className="space-y-4">
              {openItems.length > 0 && (
                <Card>
                  <CardContent className="p-4 sm:p-5 space-y-3">
                    <label className="text-sm font-semibold flex items-center gap-2">
                      <QrCode className="h-4 w-4 text-primary" />
                      Bipar produto que está sendo devolvido (opcional)
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        type="button"
                        onClick={() => setIsCameraReturnProduct(true)}
                        className="h-11 sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center justify-center gap-2"
                      >
                        <Camera className="h-4 w-4" />
                        Escanear Produto
                      </Button>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          processProductScanForReturn(returnScanQr)
                        }}
                        className="flex gap-2 flex-1"
                      >
                        <Input
                          ref={returnProductInputRef}
                          placeholder="Ou digite o código do produto devolvido..."
                          value={returnScanQr}
                          onChange={(e) => setReturnScanQr(e.target.value)}
                          className="h-11"
                        />
                        <Button type="submit" variant="outline" className="h-11 px-4 shrink-0">
                          Localizar
                        </Button>
                      </form>
                    </div>
                  </CardContent>
                </Card>
              )}

              {openItems.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center space-y-3">
                    <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
                    <div className="space-y-1">
                      <h4 className="font-bold text-base">Tudo devolvido!</h4>
                      <p className="text-sm text-muted-foreground">
                        {context.employee.name} não possui nenhum material pendente de devolução neste almoxarifado.
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={() => setActiveTab("LOAN")}>
                      Emprestar novo material
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {openItems.map((item) => {
                    const typedQty = Number(returnQuantities[item.itemId] ?? item.quantityPending)
                    const willRemainMissing = Math.max(0, item.quantityPending - (Number.isFinite(typedQty) ? typedQty : 0))
                    const totalDeliveredIfConfirmed = item.quantityReturned + (Number.isFinite(typedQty) ? typedQty : 0)
                    const isReturningThis = returningItemId === item.itemId

                    return (
                      <Card
                        key={item.itemId}
                        id={`loan-item-${item.itemId}`}
                        className={cn(
                          "transition-all",
                          highlightedItemId === item.itemId && "ring-2 ring-primary",
                          item.quantityReturned > 0 && "border-amber-400 dark:border-amber-600"
                        )}
                      >
                        <CardContent className="p-3.5 sm:p-5 space-y-3.5">
                          <div className="flex flex-col gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm sm:text-base leading-snug break-words">
                                  {item.productName}
                                </span>
                                <Badge variant="outline" className="font-mono text-xs">
                                  {item.productCode}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {item.loanNumber}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Local de origem: <strong>{item.locationCode}</strong> · Retirado em{" "}
                                {new Date(item.loanedAt).toLocaleString("pt-BR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>

                            {/* Indicadores lado a lado no mobile e desktop */}
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="px-2 py-2 rounded-lg bg-muted">
                                <span className="block text-[11px] text-muted-foreground">Emprestado</span>
                                <strong className="text-sm sm:text-base">
                                  {item.quantityLoaned} {item.unitCode}
                                </strong>
                              </div>
                              <div className="px-2 py-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                                <span className="block text-[11px] opacity-80">Já entregue</span>
                                <strong className="text-sm sm:text-base">
                                  {item.quantityReturned} {item.unitCode}
                                </strong>
                              </div>
                              <div className="px-2 py-2 rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-300">
                                <span className="block text-[11px] opacity-90">Falta devolver</span>
                                <strong className="text-sm sm:text-base">
                                  {item.quantityPending} {item.unitCode}
                                </strong>
                              </div>
                            </div>
                          </div>

                          {/* Pré-aviso imediato quando digita menos do que pegou */}
                          {typedQty > 0 && willRemainMissing > 0 && (
                            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs sm:text-sm flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                              <span>
                                <strong>Atenção:</strong> Ele está entregando{" "}
                                <strong>{totalDeliveredIfConfirmed}</strong>, mas você emprestou{" "}
                                <strong>{item.quantityLoaned}</strong> para ele! Ficarão faltando{" "}
                                <strong>
                                  {willRemainMissing} {item.unitCode}
                                </strong>
                                .
                              </span>
                            </div>
                          )}

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t">
                            <div className="flex items-center justify-between sm:justify-start gap-2">
                              <span className="text-xs sm:text-sm font-medium text-muted-foreground">
                                Entregou agora:
                              </span>
                              <div className="flex items-center gap-1.5">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-11 w-11 sm:h-10 sm:w-10 shrink-0"
                                  onClick={() =>
                                    setReturnQuantities((prev) => ({
                                      ...prev,
                                      [item.itemId]: Math.max(1, (prev[item.itemId] ?? item.quantityPending) - 1),
                                    }))
                                  }
                                  disabled={isReturningThis}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  min={1}
                                  max={item.quantityPending}
                                  value={returnQuantities[item.itemId] ?? item.quantityPending}
                                  onChange={(e) =>
                                    setReturnQuantities((prev) => ({
                                      ...prev,
                                      [item.itemId]: Math.max(
                                        0,
                                        Math.min(item.quantityPending, Math.floor(Number(e.target.value) || 0))
                                      ),
                                    }))
                                  }
                                  className="h-11 sm:h-10 w-20 text-center font-bold text-base"
                                  disabled={isReturningThis}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-11 w-11 sm:h-10 sm:w-10 shrink-0"
                                  onClick={() =>
                                    setReturnQuantities((prev) => ({
                                      ...prev,
                                      [item.itemId]: Math.min(
                                        item.quantityPending,
                                        (prev[item.itemId] ?? item.quantityPending) + 1
                                      ),
                                    }))
                                  }
                                  disabled={isReturningThis}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                                {typedQty !== item.quantityPending && (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="h-11 sm:h-10 px-2.5 text-xs font-semibold"
                                    onClick={() =>
                                      setReturnQuantities((prev) => ({
                                        ...prev,
                                        [item.itemId]: item.quantityPending,
                                      }))
                                    }
                                    disabled={isReturningThis}
                                  >
                                    Tudo ({item.quantityPending})
                                  </Button>
                                )}
                              </div>
                            </div>

                            <Button
                              type="button"
                              onClick={() => void handleReturnItem(item)}
                              disabled={isReturningThis || typedQty <= 0}
                              className={cn(
                                "h-12 sm:h-11 font-semibold w-full sm:w-auto text-sm",
                                willRemainMissing > 0
                                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
                              )}
                            >
                              {isReturningThis ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Contabilizando...
                                </>
                              ) : willRemainMissing > 0 ? (
                                <>
                                  <AlertTriangle className="h-4 w-4 mr-2 shrink-0" />
                                  <span>
                                    Receber {typedQty} (faltam {willRemainMissing} {item.unitCode})
                                  </span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-4 w-4 mr-2 shrink-0" />
                                  <span>
                                    Confirmar Devolução ({typedQty} {item.unitCode})
                                  </span>
                                </>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modais de Câmera */}
      <CameraScannerModal
        isOpen={isCameraEmployee}
        onClose={() => setIsCameraEmployee(false)}
        onScan={(decoded) => {
          setIsCameraEmployee(false)
          void processEmployeeScan(decoded)
        }}
        title="Escanear Capacete / Crachá"
        subtitle="Posicione o QR Code do colaborador dentro da moldura"
      />

      <CameraScannerModal
        isOpen={isCameraProduct}
        onClose={() => setIsCameraProduct(false)}
        onScan={(decoded) => {
          setIsCameraProduct(false)
          void processProductScanForLoan(decoded)
        }}
        title="Escanear Produto para Emprestar"
        subtitle="Posicione a etiqueta QR do material dentro da moldura"
      />

      <CameraScannerModal
        isOpen={isCameraReturnProduct}
        onClose={() => setIsCameraReturnProduct(false)}
        onScan={(decoded) => {
          setIsCameraReturnProduct(false)
          processProductScanForReturn(decoded)
        }}
        title="Escanear Produto Devolvido"
        subtitle="Posicione a etiqueta QR do material devolvido dentro da moldura"
      />

      <EmployeeTransferModal
        transfer={pendingTransfer}
        isTransferring={isTransferringEmployee}
        onConfirm={() => void handleConfirmEmployeeTransfer()}
        onCancel={() => {
          setPendingTransfer(null)
          toast.info("Transferência cancelada. Não é possível emprestar sem transferir o colaborador.")
        }}
      />
    </div>
  )
}
