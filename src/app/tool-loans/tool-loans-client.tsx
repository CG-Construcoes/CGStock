"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import Link from "next/link"
import { QRCodeSVG } from "qrcode.react"
import {
  verifyEmployeeForToolLoan,
  lookupToolForLoan,
  confirmToolLoan,
  returnToolLoanItem,
  listToolRoomData,
  createToolAssetAction,
  updateToolAssetAction,
  type OpenLoanItemDTO,
  type OpenEmployeeLoanSummary,
  type ToolAssetDTO,
  type ToolTrackingType,
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
  Wrench,
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
  Printer,
  Search,
  Edit,
  X,
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
  toolAssetId: string
  code: string
  name: string
  category: string | null
  brand: string | null
  trackingType: ToolTrackingType
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

const SUGGESTED_CATEGORIES = [
  "Equipamento Elétrico",
  "Ferramenta Manual",
  "Solda e Corte",
  "Escavação e Alvenaria",
  "Medição e Nível",
  "EPI / Segurança",
  "Outros",
]

export function ToolLoansClient({
  initialSummaries,
  initialTools,
  initialWarehouses,
  initialWarehouseId,
  initialWarehouseName,
}: {
  initialSummaries: OpenEmployeeLoanSummary[]
  initialTools: ToolAssetDTO[]
  initialWarehouses: { id: string; code: string; name: string }[]
  initialWarehouseId: string | null
  initialWarehouseName: string | null
}) {
  // Navegação principal da Ferramentaria
  const [mainView, setMainView] = useState<"OPERATIONS" | "INVENTORY">("OPERATIONS")

  const [context, setContext] = useState<EmployeeContext | null>(null)
  const [openItems, setOpenItems] = useState<OpenLoanItemDTO[]>([])
  const [activeTab, setActiveTab] = useState<"LOAN" | "RETURN">("LOAN")

  const [summaries, setSummaries] = useState<OpenEmployeeLoanSummary[]>(initialSummaries)
  const [tools, setTools] = useState<ToolAssetDTO[]>(initialTools)
  const [warehouses, setWarehouses] = useState(initialWarehouses)
  const [activeWarehouseId, setActiveWarehouseId] = useState<string | null>(initialWarehouseId)
  const [warehouseLabel, setWarehouseLabel] = useState<string | null>(initialWarehouseName)

  // Inputs & Camera
  const [employeeQr, setEmployeeQr] = useState("")
  const [toolQr, setToolQr] = useState("")
  const [returnScanQr, setReturnScanQr] = useState("")
  const [isCameraEmployee, setIsCameraEmployee] = useState(false)
  const [isCameraTool, setIsCameraTool] = useState(false)
  const [isCameraReturnTool, setIsCameraReturnTool] = useState(false)

  // Loading states
  const [isScanningEmployee, setIsScanningEmployee] = useState(false)
  const [isScanningTool, setIsScanningTool] = useState(false)
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

  // Filtros e Modal do Inventário de Ferramentas
  const [inventorySearch, setInventorySearch] = useState("")
  const [inventoryFilter, setInventoryFilter] = useState<"ALL" | "AVAILABLE" | "LOANED" | "MAINTENANCE">("ALL")
  const [selectedToolIdsForPrint, setSelectedToolIdsForPrint] = useState<Set<string>>(new Set())

  const [isToolModalOpen, setIsToolModalOpen] = useState(false)
  const [editingTool, setEditingTool] = useState<ToolAssetDTO | null>(null)
  const [isSavingTool, setIsSavingTool] = useState(false)
  const [qrPreviewTool, setQrPreviewTool] = useState<ToolAssetDTO | null>(null)

  // Form states de cadastro/edição de ferramenta
  const [formWarehouseId, setFormWarehouseId] = useState(
    initialWarehouseId || initialWarehouses[0]?.id || ""
  )
  const [formCode, setFormCode] = useState("")
  const [formName, setFormName] = useState("")
  const [formCategory, setFormCategory] = useState("")
  const [formBrand, setFormBrand] = useState("")
  const [formSerialNumber, setFormSerialNumber] = useState("")
  const [formTotalQuantity, setFormTotalQuantity] = useState(1)
  const [formUnit, setFormUnit] = useState("UN")
  const [formCondition, setFormCondition] = useState("GOOD")
  const [formStatus, setFormStatus] = useState("ACTIVE")
  const [formNotes, setFormNotes] = useState("")

  const employeeInputRef = useRef<HTMLInputElement>(null)
  const toolInputRef = useRef<HTMLInputElement>(null)
  const returnToolInputRef = useRef<HTMLInputElement>(null)

  const refreshAllData = async () => {
    const res = await listToolRoomData()
    setSummaries(res.summaries)
    setTools(res.tools)
    setWarehouses(res.warehouses)
    setActiveWarehouseId(res.activeWarehouseId)
    setWarehouseLabel(res.activeWarehouseName)
  }

  useEffect(() => {
    const handler = () => {
      refreshAllData()
    }
    window.addEventListener("cgstock:warehouse-changed", handler)
    return () => window.removeEventListener("cgstock:warehouse-changed", handler)
  }, [])

  const openCreateToolModal = () => {
    setEditingTool(null)
    setFormWarehouseId(activeWarehouseId || warehouses[0]?.id || "")
    setFormCode("")
    setFormName("")
    setFormCategory("")
    setFormBrand("")
    setFormSerialNumber("")
    setFormTotalQuantity(1)
    setFormUnit("UN")
    setFormCondition("GOOD")
    setFormStatus("ACTIVE")
    setFormNotes("")
    setIsToolModalOpen(true)
  }

  const openEditToolModal = (tool: ToolAssetDTO) => {
    setEditingTool(tool)
    setFormWarehouseId(tool.warehouseId)
    setFormCode(tool.code)
    setFormName(tool.name)
    setFormCategory(tool.category || "")
    setFormBrand(tool.brand || "")
    setFormSerialNumber(tool.serialNumber || "")
    setFormTotalQuantity(tool.totalQuantity)
    setFormUnit(tool.unit || "UN")
    setFormCondition(tool.condition || "GOOD")
    setFormStatus(tool.status || "ACTIVE")
    setFormNotes(tool.notes || "")
    setIsToolModalOpen(true)
  }

  const handleSaveTool = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingTool(true)
    try {
      const effectiveQty = Math.max(1, Math.floor(Number(formTotalQuantity) || 1))
      const derivedType: ToolTrackingType = effectiveQty > 1 ? "QUANTITY" : "ASSET"
      if (editingTool) {
        const res = await updateToolAssetAction({
          id: editingTool.id,
          code: formCode,
          name: formName,
          category: formCategory,
          brand: formBrand,
          serialNumber: formSerialNumber,
          trackingType: derivedType,
          totalQuantity: effectiveQty,
          unit: formUnit,
          condition: formCondition,
          status: formStatus,
          notes: formNotes,
        })
        if ("error" in res && res.error) {
          toast.error(res.error)
          return
        }
        toast.success("Ferramenta atualizada com sucesso!")
      } else {
        const res = await createToolAssetAction({
          warehouseId: formWarehouseId,
          code: formCode,
          name: formName,
          category: formCategory,
          brand: formBrand,
          serialNumber: formSerialNumber,
          trackingType: derivedType,
          totalQuantity: effectiveQty,
          unit: formUnit,
          condition: formCondition,
          notes: formNotes,
        })
        if ("error" in res && res.error) {
          toast.error(res.error)
          return
        }
        toast.success(`Ferramenta "${formName}" (${formCode.toUpperCase()}) cadastrada na Ferramentaria!`)
      }
      setIsToolModalOpen(false)
      await refreshAllData()
    } catch {
      toast.error("Erro ao salvar ferramenta.")
    } finally {
      setIsSavingTool(false)
    }
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
              ? `${res.employee.name} identificado — possui ${res.openItems.length} ferramenta(s) para devolver.`
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
    setMainView("OPERATIONS")
  }

  const addToolToCart = (tool: {
    id: string
    code: string
    name: string
    category: string | null
    brand: string | null
    trackingType: ToolTrackingType
    unit: string
    availableQuantity: number
  }) => {
    if (tool.availableQuantity <= 0) {
      toast.error(`"${tool.name}" (${tool.code}) não está disponível no momento.`)
      return
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.toolAssetId === tool.id)
      if (existing) {
        if (tool.trackingType === "ASSET") {
          toast.info(`Patrimônio ${tool.code} já está na lista de entrega.`)
          return prev
        }
        if (existing.requestedQuantity + 1 > tool.availableQuantity) {
          toast.warning(`Quantidade máxima disponível atingida (${tool.availableQuantity} ${tool.unit}).`)
          return prev
        }
        toast.success(`+1 ${tool.name}`)
        return prev.map((i) =>
          i.toolAssetId === tool.id ? { ...i, requestedQuantity: i.requestedQuantity + 1 } : i
        )
      }
      toast.success(`${tool.name} (${tool.code}) adicionado!`)
      return [
        ...prev,
        {
          toolAssetId: tool.id,
          code: tool.code,
          name: tool.name,
          category: tool.category,
          brand: tool.brand,
          trackingType: tool.trackingType,
          unit: tool.unit,
          requestedQuantity: 1,
          availableQuantity: tool.availableQuantity,
        },
      ]
    })
  }

  const processToolScanForLoan = async (rawCode: string) => {
    const trimmed = rawCode.trim()
    if (!trimmed || !context) return

    setIsScanningTool(true)
    try {
      const res = await lookupToolForLoan(context.warehouse.id, trimmed)
      if ("error" in res && res.error) {
        toast.error(res.error)
        setToolQr("")
        return
      }
      if ("success" in res && res.success && res.tool) {
        addToolToCart(res.tool)
        setToolQr("")
      }
    } catch {
      toast.error("Erro ao buscar ferramenta.")
    } finally {
      setIsScanningTool(false)
    }
  }

  const processToolScanForReturn = (rawCode: string) => {
    const trimmed = rawCode.trim().toUpperCase()
    if (!trimmed) return

    const match = openItems.find(
      (it) =>
        (it.toolQrToken && it.toolQrToken.toUpperCase() === trimmed) ||
        it.toolCode.toUpperCase() === trimmed ||
        it.toolCode.toUpperCase().startsWith(trimmed) ||
        it.toolName.toUpperCase().includes(trimmed)
    )

    setReturnScanQr("")
    if (!match) {
      toast.error(`Nenhuma ferramenta em aberto encontrada para "${rawCode}" com este funcionário.`)
      return
    }

    setHighlightedItemId(match.itemId)
    toast.info(`Ferramenta localizada: ${match.toolName} (${match.toolCode}).`)
    const el = document.getElementById(`loan-item-${match.itemId}`)
    el?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  const updateCartQuantity = (toolAssetId: string, newQty: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.toolAssetId !== toolAssetId) return item
        const clamped = Math.max(1, Math.min(Math.floor(newQty) || 1, item.availableQuantity))
        if (newQty > item.availableQuantity) {
          toast.warning(`Disponível na Ferramentaria: ${item.availableQuantity} ${item.unit}`)
        }
        return { ...item, requestedQuantity: clamped }
      })
    )
  }

  const removeFromCart = (toolAssetId: string) => {
    setCart((prev) => prev.filter((i) => i.toolAssetId !== toolAssetId))
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
          toolAssetId: c.toolAssetId,
          requestedQuantity: c.requestedQuantity,
        })),
      })

      if ("error" in res && res.error) {
        toast.error(res.error)
        return
      }

      if ("success" in res && res.success) {
        toast.success(`Entrega ${res.loanNumber} registrada na Ferramentaria!`)
        setCart([])
        setLoanNotes("")
        setOpenItems(res.openItems)
        await refreshAllData()
        setActiveTab("RETURN")
      }
    } catch {
      toast.error("Erro ao confirmar empréstimo.")
    } finally {
      setIsConfirmingLoan(false)
    }
  }

  const getReturnQty = (item: OpenLoanItemDTO) => {
    const val = returnQuantities[item.itemId]
    if (typeof val === "number" && Number.isFinite(val)) return val
    return item.quantityPending
  }

  const setReturnQty = (item: OpenLoanItemDTO, qty: number) => {
    const clamped = Math.max(1, Math.min(Math.floor(qty) || 1, item.quantityPending))
    setReturnQuantities((prev) => ({ ...prev, [item.itemId]: clamped }))
  }

  const handleReturnItem = async (item: OpenLoanItemDTO) => {
    const qty = item.trackingType === "ASSET" ? 1 : getReturnQty(item)
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

      if ("success" in res && res.success) {
        setOpenItems(res.openItems)
        setReturnQuantities((prev) => {
          const next = { ...prev }
          delete next[item.itemId]
          return next
        })
        await refreshAllData()

        if (res.discrepancy) {
          setDiscrepancyAlert(res.discrepancy)
          toast.warning(res.discrepancy.message)
        } else {
          toast.success(`Devolução de "${item.toolName}" (${item.toolCode}) confirmada!`)
        }
      }
    } catch {
      toast.error("Erro ao registrar devolução.")
    } finally {
      setReturningItemId(null)
    }
  }

  const resetAll = () => {
    setContext(null)
    setOpenItems([])
    setCart([])
    setLoanNotes("")
    setDiscrepancyAlert(null)
    setHighlightedItemId(null)
    setEmployeeQr("")
    setToolQr("")
    setReturnScanQr("")
  }

  // Ferramentas disponíveis (priorizando o almoxarifado atual, mas incluindo qualquer ferramenta ativa disponível)
  const warehouseAvailableTools = useMemo(() => {
    if (!context) return []
    return tools
      .filter((t) => t.status === "ACTIVE" && t.condition === "GOOD" && t.availableQuantity > 0)
      .sort((a, b) => {
        const aSame = a.warehouseId === context.warehouse.id ? 0 : 1
        const bSame = b.warehouseId === context.warehouse.id ? 0 : 1
        if (aSame !== bSame) return aSame - bSame
        return a.name.localeCompare(b.name, "pt-BR")
      })
  }, [tools, context])

  // Lista filtrada na aba Inventário de Ferramentas
  const filteredInventoryTools = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase()
    return tools.filter((t) => {
      if (inventoryFilter === "AVAILABLE" && (t.availableQuantity <= 0 || t.condition !== "GOOD")) return false
      if (inventoryFilter === "LOANED" && t.loanedQuantity <= 0) return false
      if (inventoryFilter === "MAINTENANCE" && t.condition === "GOOD") return false
      if (!q) return true
      return (
        t.code.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        (t.category && t.category.toLowerCase().includes(q)) ||
        (t.brand && t.brand.toLowerCase().includes(q)) ||
        t.currentHolders.some((h) => h.employeeName.toLowerCase().includes(q))
      )
    })
  }, [tools, inventorySearch, inventoryFilter])

  const totalToolsCount = tools.filter((t) => t.status === "ACTIVE").length
  const totalLoanedUnits = tools.reduce((sum, t) => sum + t.loanedQuantity, 0)
  const totalAvailableUnits = tools
    .filter((t) => t.status === "ACTIVE" && t.condition === "GOOD")
    .reduce((sum, t) => sum + t.availableQuantity, 0)

  const togglePrintSelection = (toolId: string) => {
    setSelectedToolIdsForPrint((prev) => {
      const next = new Set(prev)
      if (next.has(toolId)) next.delete(toolId)
      else next.add(toolId)
      return next
    })
  }

  const printLabelsHref = useMemo(() => {
    const params = new URLSearchParams()
    if (activeWarehouseId) params.set("warehouseId", activeWarehouseId)
    if (selectedToolIdsForPrint.size > 0) {
      params.set("ids", Array.from(selectedToolIdsForPrint).join(","))
    }
    const qs = params.toString()
    return `/tool-loans/print-labels${qs ? `?${qs}` : ""}`
  }, [activeWarehouseId, selectedToolIdsForPrint])

  return (
    <div className="space-y-6 pb-20">
      {/* Cabeçalho e Abas Principais */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {context && mainView === "OPERATIONS" && (
            <Button variant="ghost" size="icon" onClick={resetAll} title="Trocar funcionário">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
                <Wrench className="h-6 w-6 text-primary shrink-0" />
                Ferramentaria
              </h1>
              {warehouseLabel && (
                <Badge variant="outline" className="text-xs">
                  {warehouseLabel}
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Inventário próprio de ferramentas e equipamentos com patrimônio e QR Code (separado do estoque de materiais).
            </p>
          </div>
        </div>

        {/* Seletor de Modo: Atendimento QR vs Inventário de Ferramentas */}
        <div className="grid grid-cols-2 sm:flex rounded-xl border border-border bg-muted/40 p-1 gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setMainView("OPERATIONS")}
            className={cn(
              "flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all",
              mainView === "OPERATIONS"
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <QrCode className="h-4 w-4" />
            Entregar / Devolver
            {summaries.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[11px] bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                {summaries.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMainView("INVENTORY")}
            className={cn(
              "flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all",
              mainView === "INVENTORY"
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Wrench className="h-4 w-4" />
            Ferramentas ({totalToolsCount})
          </button>
        </div>
      </div>

      {/* =========================================================
          VISÃO 2: INVENTÁRIO DE FERRAMENTAS (CADASTRO + QR CODES)
         ========================================================= */}
      {mainView === "INVENTORY" && (
        <div className="space-y-4 sm:space-y-5">
          {/* Resumo compacto em 3 colunas mesmo no celular */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Card className="border-border">
              <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase truncate">
                    Cadastradas
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-foreground mt-0.5">{totalToolsCount}</p>
                </div>
                <div className="hidden sm:flex h-10 w-10 rounded-lg bg-primary/10 text-primary items-center justify-center shrink-0">
                  <Wrench className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase truncate">
                    Disponíveis
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-emerald-600 mt-0.5">{totalAvailableUnits}</p>
                </div>
                <div className="hidden sm:flex h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-600 items-center justify-center shrink-0">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase truncate">
                    Emprestadas
                  </p>
                  <p className="text-lg sm:text-2xl font-bold text-amber-600 mt-0.5">{totalLoanedUnits}</p>
                </div>
                <div className="hidden sm:flex h-10 w-10 rounded-lg bg-amber-500/10 text-amber-600 items-center justify-center shrink-0">
                  <HardHat className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Barra de Busca, Filtros e Botões Cadastrar / Imprimir QR */}
          <Card className="border-border">
            <CardContent className="p-3.5 sm:p-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 justify-between">
                <div className="relative flex-1">
                  <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    placeholder="Buscar patrimônio (CV-360), nome ou funcionário..."
                    className="pl-9 h-11 text-base sm:text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 sm:flex items-center gap-2">
                  <Link href={printLabelsHref} className="w-full sm:w-auto">
                    <Button type="button" variant="outline" className="w-full h-11 sm:h-10 gap-1.5 text-xs sm:text-sm px-3">
                      <Printer className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {selectedToolIdsForPrint.size > 0
                          ? `QR (${selectedToolIdsForPrint.size})`
                          : "Imprimir QR"}
                      </span>
                    </Button>
                  </Link>
                  <Button
                    type="button"
                    onClick={openCreateToolModal}
                    className="w-full sm:w-auto h-11 sm:h-10 gap-1.5 text-xs sm:text-sm px-3"
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    <span className="truncate">Cadastrar</span>
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 overflow-x-auto pb-1">
                <div className="flex items-center gap-1.5 shrink-0">
                  {(
                    [
                      { key: "ALL", label: "Todas" },
                      { key: "AVAILABLE", label: "Disponíveis" },
                      { key: "LOANED", label: "Emprestadas" },
                      { key: "MAINTENANCE", label: "Manutenção" },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setInventoryFilter(f.key)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
                        inventoryFilter === f.key
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                {selectedToolIdsForPrint.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedToolIdsForPrint(new Set())}
                    className="text-xs text-muted-foreground hover:text-foreground underline shrink-0"
                  >
                    Limpar ({selectedToolIdsForPrint.size})
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Lista de Ferramentas */}
          {filteredInventoryTools.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center space-y-3">
                <Wrench className="h-10 w-10 text-muted-foreground/50 mx-auto" />
                <div>
                  <p className="font-semibold text-foreground">Nenhuma ferramenta encontrada</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cadastre equipamentos com patrimônio (ex.: Furadeira DeWalt CV-360) ou ferramentas por quantidade (ex.: Pá de Bico, Marreta).
                  </p>
                </div>
                <Button type="button" onClick={openCreateToolModal} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Cadastrar Primeira Ferramenta
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredInventoryTools.map((tool) => {
                const isSelected = selectedToolIdsForPrint.has(tool.id)
                const isLoanedOut = tool.availableQuantity <= 0 && tool.loanedQuantity > 0
                return (
                  <Card
                    key={tool.id}
                    className={cn(
                      "border transition-colors",
                      tool.status === "INACTIVE" && "opacity-60",
                      isSelected ? "border-primary bg-primary/5" : "border-border"
                    )}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => togglePrintSelection(tool.id)}
                            className="mt-1 h-4 w-4 rounded border-border"
                            title="Selecionar para imprimir etiqueta QR"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                                Patrimônio {tool.code}
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                Qtd: {tool.totalQuantity} {tool.unit}
                              </Badge>
                              {tool.category && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {tool.category}
                                </Badge>
                              )}
                            </div>
                            <p className="font-semibold text-sm sm:text-base text-foreground mt-1 break-words">
                              {tool.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {[tool.brand, tool.serialNumber ? `S/N: ${tool.serialNumber}` : null, tool.warehouseName]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => setQrPreviewTool(tool)}
                            title="Ver / Imprimir QR Code"
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => openEditToolModal(tool)}
                            title="Editar ferramenta"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Status de disponibilidade e com quem está */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-2 border-t border-border/60 text-xs">
                        <div>
                          {tool.condition !== "GOOD" ? (
                            <Badge variant="destructive" className="text-[11px]">
                              {tool.condition === "MAINTENANCE" ? "Em Manutenção" : "Danificada"}
                            </Badge>
                          ) : isLoanedOut ? (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[11px]">
                              Emprestada ({tool.loanedQuantity}/{tool.totalQuantity})
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[11px]">
                              Disponível: {tool.availableQuantity} de {tool.totalQuantity} {tool.unit}
                            </Badge>
                          )}
                        </div>

                        {tool.currentHolders.length > 0 && (
                          <span className="text-xs text-amber-700 dark:text-amber-300 font-medium break-words">
                            Com:{" "}
                            {tool.currentHolders
                              .map((h) =>
                                tool.trackingType === "ASSET"
                                  ? h.employeeName
                                  : `${h.employeeName} (${h.quantityPending})`
                              )
                              .join(", ")}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================
          VISÃO 1: ATENDIMENTO QR (ENTREGAR E DEVOLVER FERRAMENTAS)
         ========================================================= */}
      {mainView === "OPERATIONS" && (
        <>
          {/* Passo 1: Identificar Funcionário */}
          {!context && (
            <div className="space-y-6">
              <Card className="border-2 border-primary/20 shadow-sm">
                <CardContent className="p-5 sm:p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <QrCode className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-base sm:text-lg">
                        1. Escanear QR Code do Funcionário
                      </h2>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Leia o crachá/capacete do colaborador para entregar ou receber ferramentas da Ferramentaria
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      processEmployeeScan(employeeQr)
                    }}
                    className="flex flex-col sm:flex-row gap-2"
                  >
                    <Input
                      ref={employeeInputRef}
                      value={employeeQr}
                      onChange={(e) => setEmployeeQr(e.target.value)}
                      placeholder="Escaneie o QR, matrícula ou CPF do funcionário..."
                      className="flex-1 h-11 text-base"
                      disabled={isScanningEmployee}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 px-4 gap-2 flex-1 sm:flex-initial"
                        onClick={() => setIsCameraEmployee(true)}
                        disabled={isScanningEmployee}
                      >
                        <Camera className="h-4 w-4" />
                        <span>Câmera</span>
                      </Button>
                      <Button
                        type="submit"
                        className="h-11 px-5 gap-2 flex-1 sm:flex-initial"
                        disabled={isScanningEmployee || !employeeQr.trim()}
                      >
                        {isScanningEmployee ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Painel de Ferramentas Emprestadas em Aberto */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                    <Clock className="h-5 w-5 text-amber-500" />
                    Funcionários com Ferramentas em Aberto
                    {warehouseLabel && (
                      <span className="text-xs font-normal text-muted-foreground">({warehouseLabel})</span>
                    )}
                  </h2>
                  <Badge variant={summaries.length > 0 ? "warning" : "secondary"}>
                    {summaries.length} {summaries.length === 1 ? "funcionário" : "funcionários"}
                  </Badge>
                </div>

                {summaries.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="p-8 text-center text-muted-foreground space-y-2">
                      <CheckCircle2 className="h-9 w-9 text-emerald-500 mx-auto" />
                      <p className="font-medium text-foreground">Nenhuma ferramenta pendente de devolução</p>
                      <p className="text-xs">
                        Todas as ferramentas emprestadas neste almoxarifado já foram devolvidas.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {summaries.map((s) => (
                      <Card
                        key={`${s.employee.id}_${s.warehouseId}`}
                        className={cn(
                          "cursor-pointer transition-colors hover:border-primary/50",
                          s.hasPartialDiscrepancy
                            ? "border-red-500/40 bg-red-500/5"
                            : "border-amber-500/30 bg-amber-500/5"
                        )}
                        onClick={() => openFromSummary(s)}
                      >
                        <CardContent className="p-4 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "h-10 w-10 rounded-full flex items-center justify-center shrink-0 font-bold",
                                  s.hasPartialDiscrepancy
                                    ? "bg-red-500/15 text-red-600"
                                    : "bg-amber-500/15 text-amber-600"
                                )}
                              >
                                <HardHat className="h-5 w-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-semibold text-sm sm:text-base">{s.employee.name}</p>
                                  {s.employee.employeeCode && (
                                    <Badge variant="outline" className="text-[10px]">
                                      Mat. {s.employee.employeeCode}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">{s.warehouseName}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center">
                              {s.hasPartialDiscrepancy && (
                                <Badge variant="destructive" className="gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Devolução Parcial
                                </Badge>
                              )}
                              <Badge variant="warning">Faltam {s.totalPending} un.</Badge>
                              <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                                Receber <Undo2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          <div className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card/80 text-xs">
                            {s.items.map((it) => (
                              <div key={it.itemId} className="px-3 py-2 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <span className="font-mono font-bold text-primary">{it.toolCode}</span>{" "}
                                  <span className="font-medium text-foreground">{it.toolName}</span>
                                  {it.status === "PARTIAL" && (
                                    <span className="ml-2 text-red-600 font-semibold">
                                      (Devolveu {it.quantityReturned} de {it.quantityLoaned} — faltam{" "}
                                      {it.quantityPending})
                                    </span>
                                  )}
                                </div>
                                <span className="font-semibold shrink-0 text-amber-600">
                                  {it.trackingType === "ASSET"
                                    ? "Patrimônio"
                                    : `${it.quantityPending}/${it.quantityLoaned} ${it.unitCode}`}
                                </span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Passo 2: Funcionário Identificado — Abas Entregar vs Devolver */}
          {context && (
            <div className="space-y-5">
              {/* Card do Funcionário */}
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-base">{context.employee.name}</p>
                        {context.employee.employeeCode && (
                          <Badge variant="outline" className="text-xs">
                            Mat. {context.employee.employeeCode}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <Building className="h-3.5 w-3.5" />
                        Almoxarifado: <strong className="text-foreground">{context.warehouse.name}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {openItems.length > 0 && (
                      <Badge variant="warning" className="text-xs">
                        {openItems.length} {openItems.length === 1 ? "ferramenta pendente" : "ferramentas pendentes"}
                      </Badge>
                    )}
                    <Button variant="outline" size="sm" onClick={resetAll}>
                      Trocar Funcionário
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Alerta de divergência na devolução parcial */}
              {discrepancyAlert && (
                <div className="rounded-xl border-2 border-red-500/60 bg-red-500/10 p-4 flex items-start gap-3">
                  <AlertTriangle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <p className="font-bold text-sm sm:text-base text-red-700 dark:text-red-400">
                      Atenção: Devolução Incompleta!
                    </p>
                    <p className="text-xs sm:text-sm text-foreground">
                      <strong>{discrepancyAlert.employeeName}</strong> devolveu{" "}
                      <strong>
                        {discrepancyAlert.totalReturned} {discrepancyAlert.unitCode}
                      </strong>{" "}
                      de <strong>{discrepancyAlert.productName}</strong>, mas você entregou{" "}
                      <strong>
                        {discrepancyAlert.loaned} {discrepancyAlert.unitCode}
                      </strong>{" "}
                      para ele! Ainda faltam{" "}
                      <strong className="text-red-600 underline">
                        {discrepancyAlert.missing} {discrepancyAlert.unitCode}
                      </strong>
                      .
                    </p>
                  </div>
                </div>
              )}

              {/* Seletor de Aba: Entregar vs Devolver */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab("LOAN")}
                  className={cn(
                    "flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all",
                    activeTab === "LOAN"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ArrowUpRight className="h-4 w-4 text-primary" />
                  Entregar Ferramenta
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("RETURN")}
                  className={cn(
                    "flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all",
                    activeTab === "RETURN"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Undo2 className="h-4 w-4 text-emerald-600" />
                  Devolver ({openItems.length})
                </button>
              </div>

              {/* ABA ENTREGAR FERRAMENTA */}
              {activeTab === "LOAN" && (
                <div className="space-y-4">
                  <Card>
                    <CardContent className="p-4 sm:p-5 space-y-4">
                      <label className="text-xs sm:text-sm font-semibold flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-primary" />
                        Escanear QR Code ou digitar Patrimônio da Ferramenta
                      </label>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          processToolScanForLoan(toolQr)
                        }}
                        className="flex flex-col sm:flex-row gap-2"
                      >
                        <Input
                          ref={toolInputRef}
                          value={toolQr}
                          onChange={(e) => setToolQr(e.target.value)}
                          placeholder="Ex: CV-360, Furadeira, Pá de Bico..."
                          className="flex-1 h-11"
                          disabled={isScanningTool}
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-11 px-4 gap-2 flex-1 sm:flex-initial"
                            onClick={() => setIsCameraTool(true)}
                            disabled={isScanningTool}
                          >
                            <Camera className="h-4 w-4" />
                            <span>Escanear QR</span>
                          </Button>
                          <Button
                            type="submit"
                            className="h-11 px-4 gap-2 flex-1 sm:flex-initial"
                            disabled={isScanningTool || !toolQr.trim()}
                          >
                            {isScanningTool ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Plus className="h-4 w-4" /> Adicionar
                              </>
                            )}
                          </Button>
                        </div>
                      </form>

                      {/* Seleção rápida das ferramentas disponíveis neste almoxarifado */}
                      {warehouseAvailableTools.length > 0 && (
                        <div className="pt-2 border-t border-border/60 space-y-2">
                          <p className="text-[11px] font-medium text-muted-foreground uppercase">
                            Disponíveis na Ferramentaria ({warehouseAvailableTools.length}) — toque para adicionar:
                          </p>
                          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                            {warehouseAvailableTools.map((t) => {
                              const inCart = cart.some((c) => c.toolAssetId === t.id)
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => addToolToCart(t)}
                                  className={cn(
                                    "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors",
                                    inCart
                                      ? "border-primary bg-primary/10 text-primary font-semibold"
                                      : "border-border bg-muted/30 hover:bg-muted text-foreground"
                                  )}
                                >
                                  <span className="font-mono font-bold">{t.code}</span>
                                  <span className="truncate max-w-[160px]">{t.name}</span>
                                  {t.trackingType === "QUANTITY" && (
                                    <span className="text-[10px] text-muted-foreground">
                                      ({t.availableQuantity})
                                    </span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {cart.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="p-8 text-center text-muted-foreground text-sm">
                        Escaneie o QR Code da ferramenta (ou toque em uma ferramenta disponível acima) para entregar a{" "}
                        <strong>{context.employee.name}</strong>.
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="p-4 sm:p-5 space-y-4">
                        <h3 className="font-semibold text-sm sm:text-base">
                          Ferramentas para Entregar ({cart.length})
                        </h3>

                        <div className="divide-y divide-border">
                          {cart.map((item) => (
                            <div
                              key={item.toolAssetId}
                              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                                    {item.code}
                                  </span>
                                  <p className="font-semibold text-sm">{item.name}</p>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {item.trackingType === "ASSET"
                                    ? "Equipamento com Patrimônio Único (1 un.)"
                                    : `Disponível na Ferramentaria: ${item.availableQuantity} ${item.unit}`}
                                </p>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-2">
                                {item.trackingType === "QUANTITY" ? (
                                  <div className="flex items-center gap-1.5">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="h-9 w-9"
                                      onClick={() => updateCartQuantity(item.toolAssetId, item.requestedQuantity - 1)}
                                    >
                                      <Minus className="h-4 w-4" />
                                    </Button>
                                    <Input
                                      type="number"
                                      min={1}
                                      max={item.availableQuantity}
                                      value={item.requestedQuantity}
                                      onChange={(e) => updateCartQuantity(item.toolAssetId, Number(e.target.value))}
                                      className="w-16 h-9 text-center font-bold"
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="h-9 w-9"
                                      onClick={() => updateCartQuantity(item.toolAssetId, item.requestedQuantity + 1)}
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="text-xs">
                                    1 UN (Patrimônio {item.code})
                                  </Badge>
                                )}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 text-red-500 hover:text-red-600"
                                  onClick={() => removeFromCart(item.toolAssetId)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <Input
                          value={loanNotes}
                          onChange={(e) => setLoanNotes(e.target.value)}
                          placeholder="Observação opcional (ex: serviço no subsolo, frente A)..."
                        />

                        <Button
                          type="button"
                          className="w-full h-11 text-base font-semibold gap-2"
                          onClick={handleConfirmLoan}
                          disabled={isConfirmingLoan}
                        >
                          {isConfirmingLoan ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-5 w-5" />
                          )}
                          Confirmar Entrega na Ferramentaria
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* ABA DEVOLVER FERRAMENTA */}
              {activeTab === "RETURN" && (
                <div className="space-y-4">
                  {openItems.length > 0 && (
                    <Card>
                      <CardContent className="p-4 space-y-3">
                        <label className="text-xs sm:text-sm font-semibold flex items-center gap-2">
                          <QrCode className="h-4 w-4 text-emerald-600" />
                          Escanear QR Code da ferramenta que está sendo devolvida
                        </label>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault()
                            processToolScanForReturn(returnScanQr)
                          }}
                          className="flex flex-col sm:flex-row gap-2"
                        >
                          <Input
                            ref={returnToolInputRef}
                            value={returnScanQr}
                            onChange={(e) => setReturnScanQr(e.target.value)}
                            placeholder="Escaneie o QR ou digite o patrimônio da ferramenta..."
                            className="flex-1 h-10"
                          />
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="h-10 px-3 gap-1.5 flex-1 sm:flex-initial"
                              onClick={() => setIsCameraReturnTool(true)}
                            >
                              <Camera className="h-4 w-4" />
                              Escanear QR
                            </Button>
                            <Button type="submit" variant="secondary" className="h-10 px-4">
                              Localizar
                            </Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                  )}

                  {openItems.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="p-8 text-center space-y-2">
                        <CheckCircle2 className="h-9 w-9 text-emerald-500 mx-auto" />
                        <p className="font-semibold">
                          {context.employee.name} não possui ferramentas pendentes de devolução.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Use a aba &ldquo;Entregar Ferramenta&rdquo; para registrar uma nova retirada.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {openItems.map((it) => {
                        const qty = getReturnQty(it)
                        const willRemain = it.quantityPending - qty
                        const isHighlighted = highlightedItemId === it.itemId

                        return (
                          <Card
                            key={it.itemId}
                            id={`loan-item-${it.itemId}`}
                            className={cn(
                              "transition-all",
                              isHighlighted && "ring-2 ring-emerald-500 border-emerald-500",
                              it.status === "PARTIAL" && "border-red-500/40 bg-red-500/5"
                            )}
                          >
                            <CardContent className="p-4 space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                                      {it.toolCode}
                                    </span>
                                    <Badge variant="outline" className="text-[10px]">
                                      {it.loanNumber}
                                    </Badge>
                                    {it.status === "PARTIAL" && (
                                      <Badge variant="destructive" className="text-[10px]">
                                        Devolução Parcial Anterior
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="font-semibold text-sm sm:text-base mt-1">{it.toolName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Retirado: <strong>{it.quantityLoaned} {it.unitCode}</strong> · Já devolvido:{" "}
                                    <strong>{it.quantityReturned} {it.unitCode}</strong> · Falta devolver:{" "}
                                    <strong className="text-amber-600">{it.quantityPending} {it.unitCode}</strong>
                                  </p>
                                </div>

                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                                  {it.trackingType === "QUANTITY" && it.quantityPending > 1 && (
                                    <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-muted/30 p-1 rounded-lg border border-border">
                                      <span className="text-xs text-muted-foreground pl-2 sm:hidden">Qtd a devolver:</span>
                                      <div className="flex items-center gap-1">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="icon"
                                          className="h-9 w-9"
                                          onClick={() => setReturnQty(it, qty - 1)}
                                        >
                                          <Minus className="h-4 w-4" />
                                        </Button>
                                        <Input
                                          type="number"
                                          min={1}
                                          max={it.quantityPending}
                                          value={qty}
                                          onChange={(e) => setReturnQty(it, Number(e.target.value))}
                                          className="w-16 h-9 text-center font-bold text-base sm:text-sm"
                                        />
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="icon"
                                          className="h-9 w-9"
                                          onClick={() => setReturnQty(it, qty + 1)}
                                        >
                                          <Plus className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  )}

                                  <Button
                                    type="button"
                                    onClick={() => handleReturnItem(it)}
                                    disabled={returningItemId === it.itemId}
                                    className={cn(
                                      "h-10 sm:h-9 gap-1.5 w-full sm:w-auto",
                                      willRemain > 0 ? "bg-amber-600 hover:bg-amber-700" : ""
                                    )}
                                  >
                                    {returningItemId === it.itemId ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Undo2 className="h-4 w-4" />
                                    )}
                                    {it.trackingType === "ASSET"
                                      ? "Confirmar Devolução"
                                      : willRemain > 0
                                      ? `Receber ${qty} (Faltam ${willRemain})`
                                      : `Devolver Tudo (${qty})`}
                                  </Button>
                                </div>
                              </div>

                              {willRemain > 0 && (
                                <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 shrink-0" />
                                  <span>
                                    Ele está devolvendo <strong>{qty}</strong> de{" "}
                                    <strong>{it.quantityPending}</strong> pendente(s). O sistema manterá{" "}
                                    <strong>{willRemain} {it.unitCode}</strong> em aberto no nome dele.
                                  </span>
                                </div>
                              )}
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
        </>
      )}

      {/* =========================================================
          MODAL DE CADASTRO / EDIÇÃO DE FERRAMENTA (Bottom-sheet no mobile)
         ========================================================= */}
      {isToolModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card text-card-foreground border border-border rounded-t-2xl sm:rounded-xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-primary shrink-0" />
                <h3 className="font-bold text-sm sm:text-base">
                  {editingTool ? `Editar Ferramenta (${editingTool.code})` : "Cadastrar Ferramenta na Ferramentaria"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsToolModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-md"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTool} className="space-y-3.5 sm:space-y-4">
              {!editingTool && warehouses.length > 1 && (
                <div className="space-y-1">
                  <label className="text-xs font-medium">Almoxarifado *</label>
                  <select
                    value={formWarehouseId}
                    onChange={(e) => setFormWarehouseId(e.target.value)}
                    required
                    className="flex h-11 sm:h-10 w-full rounded-md border border-border bg-muted/20 px-3 py-2 text-base sm:text-sm"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Patrimônio *</label>
                  <Input
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="Ex: CV-360"
                    className="h-11 sm:h-10 text-base sm:text-sm"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">Quantidade *</label>
                  <Input
                    type="number"
                    min={1}
                    value={formTotalQuantity}
                    onChange={(e) => setFormTotalQuantity(Math.max(1, Number(e.target.value) || 1))}
                    placeholder="Ex: 1"
                    className="h-11 sm:h-10 text-base sm:text-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Nome / Ferramenta *</label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Furadeira DeWalt, Pá de Bico, Marreta..."
                  className="h-11 sm:h-10 text-base sm:text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Modelo / Marca</label>
                  <Input
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    placeholder="Ex: DeWalt 220V, Bosch, Tramontina"
                    className="h-11 sm:h-10 text-base sm:text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">Categoria</label>
                  <Input
                    list="tool-category-suggestions"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="Ex: Equipamento Elétrico"
                    className="h-11 sm:h-10 text-base sm:text-sm"
                  />
                  <datalist id="tool-category-suggestions">
                    {SUGGESTED_CATEGORIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Condição</label>
                  <select
                    value={formCondition}
                    onChange={(e) => setFormCondition(e.target.value)}
                    className="flex h-11 sm:h-10 w-full rounded-md border border-border bg-muted/20 px-3 py-2 text-base sm:text-sm"
                  >
                    <option value="GOOD">Boa (Disponível para uso)</option>
                    <option value="MAINTENANCE">Em Manutenção</option>
                    <option value="DAMAGED">Danificada / Baixada</option>
                  </select>
                </div>

                {editingTool && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Status</label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value)}
                      className="flex h-11 sm:h-10 w-full rounded-md border border-border bg-muted/20 px-3 py-2 text-base sm:text-sm"
                    >
                      <option value="ACTIVE">Ativa</option>
                      <option value="INACTIVE">Inativa</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Observação</label>
                <Input
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Observações da ferramenta..."
                  className="h-11 sm:h-10 text-base sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 sm:h-10 w-full sm:w-auto"
                  onClick={() => setIsToolModalOpen(false)}
                  disabled={isSavingTool}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSavingTool} className="h-11 sm:h-10 w-full sm:w-auto gap-2">
                  {isSavingTool && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingTool ? "Salvar Alterações" : "Cadastrar Ferramenta"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal rápido de visualização/impressão de QR individual */}
      {qrPreviewTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card text-card-foreground border border-border rounded-xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="font-bold text-sm">Etiqueta QR — {qrPreviewTool.code}</span>
              <button
                type="button"
                onClick={() => setQrPreviewTool(null)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="bg-white p-4 rounded-xl inline-flex flex-col items-center border border-slate-200 mx-auto">
              <QRCodeSVG value={qrPreviewTool.qrToken} size={156} level="M" includeMargin={false} />
              <p className="mt-2 font-mono font-black text-slate-900 text-sm">{qrPreviewTool.code}</p>
              <p className="text-xs font-semibold text-slate-700 max-w-[200px] truncate">
                {qrPreviewTool.name}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setQrPreviewTool(null)}
              >
                Fechar
              </Button>
              <Link
                href={`/tool-loans/print-labels?ids=${encodeURIComponent(qrPreviewTool.id)}`}
                className="flex-1"
              >
                <Button type="button" className="w-full gap-1.5">
                  <Printer className="h-4 w-4" />
                  Imprimir Etiqueta
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Modais de Câmera */}
      <CameraScannerModal
        isOpen={isCameraEmployee}
        onClose={() => setIsCameraEmployee(false)}
        onScan={(code) => processEmployeeScan(code)}
        title="Escanear Crachá / Capacete do Funcionário"
      />
      <CameraScannerModal
        isOpen={isCameraTool}
        onClose={() => setIsCameraTool(false)}
        onScan={(code) => processToolScanForLoan(code)}
        title="Escanear QR Code da Ferramenta (Entrega)"
      />
      <CameraScannerModal
        isOpen={isCameraReturnTool}
        onClose={() => setIsCameraReturnTool(false)}
        onScan={(code) => processToolScanForReturn(code)}
        title="Escanear QR Code da Ferramenta (Devolução)"
      />

      {/* Modal de confirmação de transferência de colaborador entre almoxarifados */}
      <EmployeeTransferModal
        transfer={pendingTransfer}
        isTransferring={isTransferringEmployee}
        onCancel={() => setPendingTransfer(null)}
        onConfirm={handleConfirmEmployeeTransfer}
      />
    </div>
  )
}
