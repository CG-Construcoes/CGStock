"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import {
  localDb,
  type CatalogSnapshotData,
  type StockSnapshotData,
  type RequestsSnapshotData,
  type OperationsSnapshotData,
  type CollectorSnapshotData,
  type SyncQueueTask,
} from "@/lib/localdb"
import { getOfflineSnapshot, computeSnapshotExpiry } from "@/lib/offline-snapshot"
import { queueOfflineOperation } from "@/lib/offline-sync"
import { QuickIssueClient } from "@/app/quick-issue/quick-issue-client"
import { CollectorOffline } from "@/app/collector/collector-offline"
import CollectorForm from "@/app/collector/[inventoryId]/[locationId]/collector-form"
import SyncPage from "@/app/collector/sync/page"
import ReceiptForm from "@/app/receipts/new/receipt-form"
import { AdjustmentClient } from "@/app/adjustments/new/client"
import { TransferForm } from "@/app/transfers/new/transfer-form"
import { ReturnForm } from "@/app/returns/new/return-form"
import RequestForm from "@/app/requests/new/request-form"
import InventoryForm from "@/app/inventory/new/inventory-form"
import FulfillmentForm from "@/app/requests/[id]/fulfillment/fulfillment-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatCurrency, formatNumber } from "@/lib/utils"
import { getMovementTypeLabel, getMovementBadgeVariant, isInMovement, isManualAdjustment } from "@/lib/movement-labels"
import {
  Zap,
  PackagePlus,
  Search,
  Smartphone,
  Package,
  Box,
  ArrowRightLeft,
  Plus,
  RotateCcw,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Play,
  Ban,
  HardHat,
  MapPin,
  Tags,
  Ruler,
  CloudOff,
} from "lucide-react"
import { toast } from "sonner"

type OfflineDataBundle = {
  loaded: boolean
  catalog?: CatalogSnapshotData
  stock?: StockSnapshotData
  requests?: RequestsSnapshotData
  operations?: OperationsSnapshotData
  collector?: CollectorSnapshotData
  pendingTasks: SyncQueueTask[]
}

export function OfflineWorkspace({
  userId,
  userName,
  activeWarehouseId: initialWarehouseId,
  pathname,
  search,
  onNavigate,
}: {
  userId: string
  userName?: string
  activeWarehouseId?: string
  pathname: string
  search: string
  onNavigate: (href: string) => void
}) {
  const [bundle, setBundle] = useState<OfflineDataBundle>({ loaded: false, pendingTasks: [] })
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(initialWarehouseId || "")
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock" | "alerts">("all")

  const sessionExpiresIso = useMemo(() => computeSnapshotExpiry().toISOString(), [])

  const loadAll = useCallback(async () => {
    if (!localDb || !userId) return
    const [cat, stk, req, ops, col, tasks] = await Promise.all([
      getOfflineSnapshot<CatalogSnapshotData>("catalog", userId),
      getOfflineSnapshot<StockSnapshotData>("stock", userId),
      getOfflineSnapshot<RequestsSnapshotData>("requests", userId),
      getOfflineSnapshot<OperationsSnapshotData>("operations", userId),
      getOfflineSnapshot<CollectorSnapshotData>("collector", userId),
      localDb.syncQueue.where("userId").equals(userId).toArray(),
    ])
    setBundle({
      loaded: true,
      catalog: cat?.data,
      stock: stk?.data,
      requests: req?.data,
      operations: ops?.data,
      collector: col?.data,
      pendingTasks: tasks.filter((t) => t.status !== "SYNCED"),
    })
  }, [userId])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAll(), 0)
    const reload = () => void loadAll()
    window.addEventListener("cgstock:offline-data-updated", reload)
    window.addEventListener("cgstock:queue-updated", reload)
    window.addEventListener("cgstock:sync-finished", reload)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("cgstock:offline-data-updated", reload)
      window.removeEventListener("cgstock:queue-updated", reload)
      window.removeEventListener("cgstock:sync-finished", reload)
    }
  }, [loadAll])

  useEffect(() => {
    const onWhChange = (e: Event) => {
      const detail = (e as CustomEvent<{ warehouseId?: string }>).detail
      if (detail && typeof detail.warehouseId === "string") {
        setSelectedWarehouseId(detail.warehouseId)
      }
    }
    window.addEventListener("cgstock:warehouse-changed", onWhChange)
    return () => window.removeEventListener("cgstock:warehouse-changed", onWhChange)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(search)
      const q = params.get("q")
      if (q !== null) setSearchTerm(q)
      const wh = params.get("warehouseId")
      if (wh !== null) setSelectedWarehouseId(wh)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [search])

  const catalog = bundle.catalog
  const warehouses = useMemo(() => catalog?.warehouses ?? [], [catalog])
  const locations = useMemo(() => catalog?.locations ?? [], [catalog])
  const products = useMemo(() => catalog?.products ?? [], [catalog])
  const suppliers = useMemo(() => catalog?.suppliers ?? [], [catalog])
  const stockItems = useMemo(() => bundle.stock?.items ?? [], [bundle.stock])
  const operations = bundle.operations
  const requests = useMemo(() => bundle.requests?.items ?? [], [bundle.requests])

  const warehousesWithLocations = useMemo(
    () =>
      warehouses.map((w) => ({
        id: w.id,
        name: w.name,
        code: w.code,
        locations: locations
          .filter((l) => l.warehouseId === w.id)
          .map((l) => ({ id: l.id, code: l.code, name: l.name })),
      })),
    [warehouses, locations]
  )

  const collectorProducts = useMemo(() => {
    if (bundle.collector?.products?.length) return bundle.collector.products
    const byProd = new Map<string, Record<string, number>>()
    for (const s of stockItems) {
      const m = byProd.get(s.productId) ?? {}
      m[s.locationId] = Number(s.quantity)
      byProd.set(s.productId, m)
    }
    return products.map((p) => ({
      id: p.id,
      code: p.code,
      barcode: p.barcode,
      name: p.name,
      unitCode: p.unitCode,
      locationStocks: byProd.get(p.id) ?? {},
    }))
  }, [bundle.collector, products, stockItems])

  // 1. ROTAS DE FORMULÁRIOS E OPERAÇÕES DIRETAS
  if (pathname === "/quick-issue") {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-zinc-50 dark:bg-zinc-950">
        <QuickIssueClient userId={userId} sessionExpiresAt={sessionExpiresIso} />
      </div>
    )
  }

  if (pathname === "/collector/sync") {
    return <SyncPage />
  }

  const collectorMatch = pathname.match(/^\/collector\/([^/]+)\/([^/]+)$/)
  if (collectorMatch) {
    const [, invId, locId] = collectorMatch
    const loc = locations.find((l) => l.id === locId)
    return (
      <div className="min-h-screen bg-accent font-sans max-w-lg mx-auto">
        <CollectorForm
          userId={userId}
          sessionExpiresAt={sessionExpiresIso}
          inventoryId={invId}
          locationId={locId}
          locationCode={loc?.code || locId}
          products={collectorProducts}
          onBack={() => onNavigate("/collector")}
        />
      </div>
    )
  }

  if (pathname === "/collector") {
    return (
      <CollectorOffline userId={userId} sessionExpiresAt={sessionExpiresIso} canPrepare={true}>
        <div />
      </CollectorOffline>
    )
  }

  if (pathname === "/receipts/new") {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <ReceiptForm
          userId={userId}
          sessionExpiresAt={sessionExpiresIso}
          suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, document: s.document ?? null, source: s.source ?? null, erpCode: s.erpCode ?? null, category: s.category ?? null }))}
          warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, source: w.source ?? null }))}
          products={products.map((p) => ({ id: p.id, code: p.code, name: p.name, averageCost: p.averageCost ?? 0 }))}
          locations={locations.map((l) => ({ id: l.id, code: l.code, name: l.name, warehouseId: l.warehouseId }))}
          categories={(catalog?.categories ?? []).map((c) => ({ id: c.id, name: c.name }))}
          units={(catalog?.units ?? []).map((u) => ({ id: u.id, code: u.code, name: u.name }))}
          canCreateProduct={false}
        />
      </div>
    )
  }

  if (pathname === "/adjustments/new") {
    return (
      <AdjustmentClient
        userId={userId}
        sessionExpiresAt={sessionExpiresIso}
        warehouses={warehousesWithLocations}
        products={products.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          category: p.categoryName ? { name: p.categoryName } : null,
        }))}
      />
    )
  }

  if (pathname === "/transfers/new") {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => onNavigate("/transfers")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Nova Transferência</h2>
            <p className="text-muted-foreground">Mova produtos entre localizações ou almoxarifados.</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <TransferForm
              userId={userId}
              sessionExpiresAt={sessionExpiresIso}
              warehouses={warehousesWithLocations}
              products={products.map((p) => ({
                id: p.id,
                code: p.code,
                name: p.name,
                unitId: p.unitId || catalog?.units?.find((u) => u.code === p.unitCode)?.id || null,
              }))}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (pathname === "/returns/new") {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => onNavigate("/returns")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Nova Devolução</h2>
            <p className="text-muted-foreground">Registre materiais devolvidos ao estoque.</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <ReturnForm
              userId={userId}
              sessionExpiresAt={sessionExpiresIso}
              warehouses={warehousesWithLocations}
              products={products.map((p) => ({
                id: p.id,
                code: p.code,
                name: p.name,
                unitId: p.unitId || catalog?.units?.find((u) => u.code === p.unitCode)?.id || null,
              }))}
              requests={requests.map((r) => ({ id: r.id, requestNumber: r.requestNumber }))}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (pathname === "/requests/new") {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <RequestForm
          userId={userId}
          sessionExpiresAt={sessionExpiresIso}
          warehouses={warehouses}
          products={products.map((p) => ({
            id: p.id,
            code: p.code,
            name: p.name,
            unitId: p.unitId || catalog?.units?.find((u) => u.code === p.unitCode)?.id || "",
            unit: { code: p.unitCode || "UN" },
          }))}
        />
      </div>
    )
  }

  if (pathname === "/inventory/new") {
    const operatorsList =
      catalog?.operators && catalog.operators.length > 0
        ? catalog.operators.map((op) => ({
            id: op.id,
            name: op.name,
            roles: op.roles.map((r) => ({ name: r })),
          }))
        : [{ id: userId, name: userName || "Operador Atual", roles: [{ name: "ALMOXARIFE" }] }]

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <InventoryForm userId={userId} warehouses={warehousesWithLocations} users={operatorsList} />
      </div>
    )
  }

  // Atendimento de requisição offline: /requests/[id]/fulfillment
  const fulfillMatch = pathname.match(/^\/requests\/([^/]+)\/fulfillment$/)
  if (fulfillMatch) {
    const reqId = fulfillMatch[1]
    const reqRecord = requests.find((r) => r.id === reqId)
    if (!reqRecord) {
      return (
        <div className="p-6 text-center space-y-4">
          <p className="text-muted-foreground">Requisição não encontrada nos dados locais.</p>
          <Button variant="outline" onClick={() => onNavigate("/requests")}>
            Voltar para Requisições
          </Button>
        </div>
      )
    }
    const hydratedRequest = {
      id: reqRecord.id,
      requestNumber: reqRecord.requestNumber,
      status: reqRecord.status,
      warehouseId: reqRecord.warehouseId || warehouses[0]?.id || "",
      items: (reqRecord.items ?? []).map((it) => ({
        id: it.id,
        approvedQuantity: it.approvedQuantity,
        deliveredQuantity: it.deliveredQuantity,
        unit: { code: it.unitCode || "UN" },
        product: {
          id: it.productId,
          code: it.productCode,
          name: it.productName,
          stocks: stockItems
            .filter((s) => s.productId === it.productId && s.quantity > 0)
            .map((s) => {
              const loc = locations.find((l) => l.id === s.locationId)
              return {
                locationId: s.locationId,
                quantity: s.quantity,
                location: {
                  id: s.locationId,
                  code: loc?.code || s.locationId,
                  warehouseId: s.warehouseId,
                },
              }
            }),
        },
      })),
    }
    return <FulfillmentForm request={hydratedRequest} userId={userId} sessionExpiresAt={sessionExpiresIso} />
  }

  // Detalhe de requisição offline: /requests/[id]
  const reqDetailMatch = pathname.match(/^\/requests\/([^/]+)$/)
  if (reqDetailMatch && reqDetailMatch[1] !== "new") {
    const reqId = reqDetailMatch[1]
    const reqRecord = requests.find((r) => r.id === reqId)
    if (!reqRecord) {
      return (
        <div className="p-6 text-center space-y-4">
          <p className="text-muted-foreground">Requisição não encontrada nos dados locais.</p>
          <Button variant="outline" onClick={() => onNavigate("/requests")}>
            Voltar para Requisições
          </Button>
        </div>
      )
    }

    const handleOfflineReqStatus = async (action: "APPROVE" | "REJECT" | "START_SEPARATION" | "CANCEL") => {
      try {
        await queueOfflineOperation(
          "REQUEST_STATUS",
          {
            requestId: reqRecord.id,
            action,
            reason: action === "REJECT" ? "Rejeitado offline" : undefined,
          },
          userId
        )
        toast.success("Status da requisição atualizado no dispositivo! Sincronizaremos ao reconectar.")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao atualizar requisição offline.")
      }
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => onNavigate("/requests")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold">{reqRecord.requestNumber}</h2>
                <Badge variant="outline">{reqRecord.status}</Badge>
                {reqRecord.offlinePending && <Badge variant="secondary">Pendente de Sync</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {reqRecord.warehouseName || "Almoxarifado"} • Solicitante: {reqRecord.requesterName || "Usuário"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {reqRecord.status === "PENDING_APPROVAL" && (
              <>
                <Button variant="destructive" size="sm" onClick={() => void handleOfflineReqStatus("REJECT")}>
                  <XCircle className="h-4 w-4 mr-1.5" /> Rejeitar
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => void handleOfflineReqStatus("APPROVE")}
                >
                  <CheckCircle className="h-4 w-4 mr-1.5" /> Aprovar
                </Button>
              </>
            )}
            {reqRecord.status === "APPROVED" && (
              <Button size="sm" onClick={() => void handleOfflineReqStatus("START_SEPARATION")}>
                <Play className="h-4 w-4 mr-1.5" /> Iniciar Separação
              </Button>
            )}
            {["IN_SEPARATION", "PARTIALLY_FULFILLED"].includes(reqRecord.status) && (
              <Button size="sm" onClick={() => onNavigate(`/requests/${reqRecord.id}/fulfillment`)}>
                <Package className="h-4 w-4 mr-1.5" /> Atender / Entregar Material
              </Button>
            )}
            {["DRAFT", "PENDING_APPROVAL", "APPROVED", "IN_SEPARATION"].includes(reqRecord.status) && (
              <Button variant="outline" size="sm" onClick={() => void handleOfflineReqStatus("CANCEL")}>
                <Ban className="h-4 w-4 mr-1.5" /> Cancelar
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Itens da Requisição ({reqRecord.items?.length ?? reqRecord.itemCount})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(reqRecord.items ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Itens detalhados disponíveis após sincronização.</p>
            ) : (
              (reqRecord.items ?? []).map((it) => (
                <div key={it.id} className="flex items-center justify-between border p-3 rounded-md">
                  <div>
                    <p className="font-semibold text-sm">
                      {it.productCode} - {it.productName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Aprovado: {it.approvedQuantity} • Entregue: {it.deliveredQuantity} {it.unitCode}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold">
                      {it.requestedQuantity} {it.unitCode}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Detalhe de Inventário offline: /inventory/[id]
  const invDetailMatch = pathname.match(/^\/inventory\/([^/]+)$/)
  if (invDetailMatch && invDetailMatch[1] !== "new") {
    const invId = invDetailMatch[1]
    const inv = operations?.inventories?.find((i) => i.id === invId)
    if (!inv) {
      return (
        <div className="p-6 text-center space-y-4">
          <p className="text-muted-foreground">Inventário não encontrado nos dados locais.</p>
          <Button variant="outline" onClick={() => onNavigate("/inventory")}>
            Voltar para Inventários
          </Button>
        </div>
      )
    }
    const completedLocs = inv.locations.filter((l) => l.status === "COMPLETED").length
    const totalLocs = inv.locations.length
    const progress = totalLocs > 0 ? Math.round((completedLocs / totalLocs) * 100) : 0

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => onNavigate("/inventory")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold">
                  {inv.code} - {inv.name}
                </h2>
                <Badge variant="outline">{inv.status === "IN_PROGRESS" ? "Em Andamento" : inv.status}</Badge>
                {inv.offlinePending && <Badge variant="secondary">Pendente de Sync</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {inv.warehouseName} • Criado por {inv.createdByName}
              </p>
            </div>
          </div>
          <Button onClick={() => onNavigate("/collector")}>
            <Smartphone className="h-4 w-4 mr-2" /> Ir para o Coletor
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Progresso</div>
              <div className="text-2xl font-bold mt-1">{progress}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Locais Concluídos</div>
              <div className="text-2xl font-bold mt-1">
                {completedLocs} / {totalLocs}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Coletas Registradas</div>
              <div className="text-2xl font-bold mt-1">{inv.collections?.length ?? 0}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Locais do Inventário</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {inv.locations.map((l) => (
              <div key={l.id} className="flex items-center justify-between border p-3 rounded-md">
                <span className="font-semibold text-sm">{l.code}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={l.status === "COMPLETED" ? "success" : "outline"}>
                    {l.status === "COMPLETED" ? "Concluído" : "Pendente"}
                  </Badge>
                  {l.status !== "COMPLETED" && inv.status === "IN_PROGRESS" && (
                    <Button size="sm" variant="outline" onClick={() => onNavigate(`/collector/${inv.id}/${l.locationId}`)}>
                      Contar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Detalhe de Entrada / Recebimento offline: /receipts/[id]
  const receiptDetailMatch = pathname.match(/^\/receipts\/([^/]+)$/)
  if (receiptDetailMatch && receiptDetailMatch[1] !== "new") {
    const recId = receiptDetailMatch[1]
    const rec = operations?.receipts?.find((r) => r.id === recId)
    if (!rec) {
      return (
        <div className="p-6 text-center space-y-4">
          <p className="text-muted-foreground">Recebimento não encontrado nos dados locais.</p>
          <Button variant="outline" onClick={() => onNavigate("/receipts")}>
            Voltar para Entradas
          </Button>
        </div>
      )
    }

    const handleConfirmDraftOffline = async () => {
      try {
        await queueOfflineOperation("CONFIRM_RECEIPT", { receiptId: rec.id }, userId)
        toast.success("Recebimento confirmado localmente! O estoque será sincronizado ao reconectar.")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao confirmar recebimento offline.")
      }
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => onNavigate("/receipts")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-2xl font-bold">
                Entrada {rec.documentNumber ? `#${rec.documentNumber}` : "Sem Número"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {rec.supplierName} • {rec.warehouseName}
              </p>
            </div>
          </div>
          {rec.status === "DRAFT" && (
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => void handleConfirmDraftOffline()}>
              <CheckCircle className="h-4 w-4 mr-2" /> Confirmar Recebimento
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Itens ({rec.items?.length ?? rec.itemCount})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(rec.items ?? []).map((it) => (
              <div key={it.id} className="flex items-center justify-between border p-3 rounded-md">
                <div>
                  <p className="font-semibold text-sm">{it.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    {it.productCode} • Local: {it.locationCode}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">
                    {it.quantity} {it.unitCode}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(it.totalCost)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  // 2. CONSULTA DE ESTOQUE E SALDOS (/stock e /stock/[productId])
  if (pathname === "/stock" || pathname.startsWith("/stock/")) {
    const prodDetailId = pathname.startsWith("/stock/") ? pathname.replace("/stock/", "") : null
    if (prodDetailId) {
      const prod = products.find((p) => p.id === prodDetailId)
      const prodStocks = stockItems.filter(
        (s) => s.productId === prodDetailId && (!selectedWarehouseId || s.warehouseId === selectedWarehouseId)
      )
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => onNavigate("/stock")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-2xl font-bold">{prod?.name || "Detalhes do Produto"}</h2>
              <p className="text-sm text-muted-foreground">Código: {prod?.code || prodDetailId}</p>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Saldos por Localização</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {prodStocks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem saldo registrado para este produto.</p>
              ) : (
                prodStocks.map((s) => {
                  const loc = locations.find((l) => l.id === s.locationId)
                  const wh = warehouses.find((w) => w.id === s.warehouseId)
                  return (
                    <div key={`${s.productId}-${s.locationId}`} className="flex items-center justify-between border p-3 rounded-md">
                      <div>
                        <p className="font-semibold text-sm">{loc?.code || s.locationId}</p>
                        <p className="text-xs text-muted-foreground">{wh?.name || s.warehouseId}</p>
                      </div>
                      <span className="text-lg font-bold">
                        {formatNumber(s.quantity)} {prod?.unitCode || "UN"}
                      </span>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>
      )
    }

    const stockByProd = new Map<string, { qty: number; reserved: number; whIds: Set<string> }>()
    for (const s of stockItems) {
      if (selectedWarehouseId && s.warehouseId !== selectedWarehouseId) continue
      const cur = stockByProd.get(s.productId) ?? { qty: 0, reserved: 0, whIds: new Set<string>() }
      cur.qty += Number(s.quantity || 0)
      cur.reserved += Number(s.reservedQuantity || 0)
      cur.whIds.add(s.warehouseId)
      stockByProd.set(s.productId, cur)
    }

    const qLower = searchTerm.trim().toLowerCase()
    const rows = products
      .map((p) => {
        const st = stockByProd.get(p.id)
        const qty = st?.qty ?? 0
        const res = st?.reserved ?? 0
        const min = Number(p.minimumStock ?? 0)
        const isAlert = qty === 0 || (min > 0 && qty <= min)
        return { product: p, qty, reserved: res, available: qty - res, isAlert }
      })
      .filter((r) => {
        if (qLower) {
          const hay = `${r.product.code} ${r.product.name} ${r.product.barcode || ""}`.toLowerCase()
          if (!hay.includes(qLower)) return false
        }
        if (stockFilter === "in_stock" && r.qty <= 0) return false
        if (stockFilter === "alerts" && !r.isAlert) return false
        return true
      })

    const totalSkusInStock = products.filter((p) => (stockByProd.get(p.id)?.qty ?? 0) > 0).length
    const totalValue = products.reduce(
      (sum, p) => sum + (stockByProd.get(p.id)?.qty ?? 0) * Number(p.averageCost ?? 0),
      0
    )

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Estoque e Saldos</h2>
          <p className="text-sm text-muted-foreground">
            Consulta offline atualizada com as movimentações registradas neste aparelho.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card
            className="cursor-pointer"
            onClick={() => setStockFilter("all")}
          >
            <CardContent className="p-4">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Valor em Estoque</span>
              <div className="text-xl font-black mt-1">{formatCurrency(totalValue)}</div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer"
            onClick={() => setStockFilter(stockFilter === "in_stock" ? "all" : "in_stock")}
          >
            <CardContent className="p-4">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Itens com Saldo</span>
              <div className="text-xl font-black mt-1">{formatNumber(totalSkusInStock)} SKUs</div>
            </CardContent>
          </Card>
          <Card
            className="col-span-2 sm:col-span-1 cursor-pointer"
            onClick={() => setStockFilter(stockFilter === "alerts" ? "all" : "alerts")}
          >
            <CardContent className="p-4">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Total Exibido</span>
              <div className="text-xl font-black mt-1">{formatNumber(rows.length)} itens</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 bg-card p-4 rounded-md border border-border">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código, nome ou código de barras..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          {warehouses.length > 1 && (
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Todos os Almoxarifados</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="bg-card rounded-md border border-border divide-y divide-border">
          {rows.slice(0, 150).map(({ product: p, qty, available }) => (
            <div
              key={p.id}
              onClick={() => onNavigate(`/stock/${p.id}`)}
              className="p-4 flex items-center justify-between gap-3 hover:bg-muted/40 cursor-pointer"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary">{p.code}</span>
                  {p.categoryName && <span className="text-xs text-muted-foreground">• {p.categoryName}</span>}
                </div>
                <p className="font-semibold text-sm text-foreground truncate">{p.name}</p>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-lg font-black ${qty > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {formatNumber(available)} {p.unitCode || "UN"}
                </span>
                <span className="block text-[11px] text-muted-foreground">Físico: {formatNumber(qty)}</span>
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">Nenhum produto encontrado para este filtro.</div>
          )}
        </div>
      </div>
    )
  }

  // 3. PRODUTOS (/products)
  if (pathname === "/products") {
    const qLower = searchTerm.trim().toLowerCase()
    const filtered = products.filter((p) => {
      if (!qLower) return true
      return `${p.code} ${p.name} ${p.barcode || ""} ${p.categoryName || ""}`.toLowerCase().includes(qLower)
    })

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 border border-border rounded-md">
          <div>
            <h2 className="text-xl font-bold">Produtos ({filtered.length})</h2>
            <p className="text-xs text-muted-foreground">Catálogo completo disponível offline.</p>
          </div>
          <div className="w-full sm:w-80">
            <Input
              placeholder="Buscar por código, nome ou código de barras..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-card rounded-md border border-border divide-y divide-border">
          {filtered.slice(0, 150).map((p) => {
            const totalStock = stockItems
              .filter((s) => s.productId === p.id && (!selectedWarehouseId || s.warehouseId === selectedWarehouseId))
              .reduce((acc, s) => acc + Number(s.quantity), 0)
            return (
              <div key={p.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-xs font-bold text-primary">{p.code}</span>
                  <p className="font-semibold text-sm text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.categoryName || "Sem categoria"} • Unidade: {p.unitCode || "UN"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-bold text-sm">
                    {formatNumber(totalStock)} {p.unitCode || "UN"}
                  </span>
                  {p.averageCost != null && (
                    <span className="block text-xs text-muted-foreground">{formatCurrency(p.averageCost)}</span>
                  )}
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">Nenhum produto encontrado.</div>
          )}
        </div>
      </div>
    )
  }

  // 4. MOVIMENTAÇÕES (/movements)
  if (pathname === "/movements" || pathname.startsWith("/movements/")) {
    const movs = (operations?.movements ?? []).filter((m) => {
      if (selectedWarehouseId && m.warehouseId !== selectedWarehouseId) return false
      if (typeFilter && m.type !== typeFilter) return false
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase()
        const hay = `${m.productCode} ${m.productName} ${m.documentNumber || ""} ${m.locationCode}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Extrato de Estoque</h2>
            <p className="text-sm text-muted-foreground">
              Histórico de movimentações (incluindo operações registradas offline).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => onNavigate("/quick-issue")}>
              <Zap className="h-4 w-4 mr-1.5" /> Entrega Rápida
            </Button>
            <Button size="sm" variant="outline" onClick={() => onNavigate("/adjustments/new")}>
              <Plus className="h-4 w-4 mr-1.5" /> Ajuste Manual
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 bg-card p-4 rounded-md border border-border">
          <Input
            placeholder="Buscar produto, código ou documento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Todos os tipos</option>
            <option value="ENTRY">Entrada</option>
            <option value="EXIT">Saída</option>
            <option value="ADJUSTMENT_IN">Ajuste Entrada</option>
            <option value="ADJUSTMENT_OUT">Ajuste Saída</option>
            <option value="TRANSFER_IN">Transferência Entrada</option>
            <option value="TRANSFER_OUT">Transferência Saída</option>
            <option value="RETURN">Devolução</option>
          </select>
        </div>

        <div className="bg-card rounded-md border border-border divide-y divide-border">
          {movs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma movimentação encontrada para este filtro.</div>
          ) : (
            movs.map((mov) => {
              const isPos = isInMovement(mov.type)
              const label = getMovementTypeLabel(mov.type, mov.referenceType ?? null)
              const variant = getMovementBadgeVariant(mov.type, isManualAdjustment(mov.referenceType ?? null))
              return (
                <div key={mov.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-muted-foreground">{mov.productCode}</span>
                      <p className="font-bold text-foreground">{mov.productName}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {mov.offlinePending && <Badge variant="secondary">Offline</Badge>}
                      <Badge variant={variant}>{label}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Local: <strong className="text-foreground">{mov.locationCode}</strong> ({mov.warehouseName})
                    </span>
                    <span className={`font-bold ${isPos ? "text-emerald-600" : "text-red-600"}`}>
                      {isPos ? "+" : "-"}
                      {formatNumber(Math.abs(mov.quantity))} {mov.unitCode}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                    <span>{new Date(mov.createdAt).toLocaleString("pt-BR")}</span>
                    <span className="text-right">
                      Por: {mov.performedByName}
                      {mov.recipientName && (
                        <span className="block">
                          {isPos ? "Devolvido por" : "Entregue para"}: {mov.recipientName}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    )
  }

  // 5. INVENTÁRIOS (/inventory)
  if (pathname === "/inventory") {
    const invs = (operations?.inventories ?? []).filter((inv) => {
      if (selectedWarehouseId && inv.warehouseId !== selectedWarehouseId) return false
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase()
        if (!`${inv.code} ${inv.name}`.toLowerCase().includes(q)) return false
      }
      return true
    })

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Inventários</h2>
            <p className="text-muted-foreground">Gerencie contagens, coletas e conferências de estoque offline.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onNavigate("/collector")}>
              <Smartphone className="h-4 w-4 mr-2" /> Abrir Coletor
            </Button>
            <Button onClick={() => onNavigate("/inventory/new")}>
              <Plus className="h-4 w-4 mr-2" /> Novo Inventário
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {invs.length === 0 && (
            <div className="col-span-3 text-center py-12 text-muted-foreground bg-card rounded-md border">
              Nenhum inventário encontrado.
            </div>
          )}
          {invs.map((inv) => {
            const totalLocs = inv.locations.length
            const completedLocs = inv.locations.filter((l) => l.status === "COMPLETED").length
            const progress = totalLocs > 0 ? Math.round((completedLocs / totalLocs) * 100) : 0
            return (
              <Card
                key={inv.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => onNavigate(`/inventory/${inv.id}`)}
              >
                <CardContent className="p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-primary">{inv.code}</span>
                    <div className="flex gap-1">
                      {inv.offlinePending && <Badge variant="secondary">Offline</Badge>}
                      <Badge variant="outline">
                        {inv.status === "IN_PROGRESS" ? "Em Andamento" : inv.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-base">{inv.name}</h3>
                    <p className="text-xs text-muted-foreground">{inv.warehouseName}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span>Progresso</span>
                      <span>
                        {completedLocs}/{totalLocs} ({progress}%)
                      </span>
                    </div>
                    <div className="w-full bg-accent rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  // 6. ENTRADAS DE MATERIAIS (/receipts)
  if (pathname === "/receipts") {
    const recs = (operations?.receipts ?? []).filter((r) => {
      if (selectedWarehouseId && r.warehouseId !== selectedWarehouseId) return false
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase()
        if (!`${r.documentNumber || ""} ${r.supplierName}`.toLowerCase().includes(q)) return false
      }
      return true
    })

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Entradas de Materiais</h2>
            <p className="text-muted-foreground">Acompanhe e registre o recebimento de mercadorias offline.</p>
          </div>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => onNavigate("/receipts/new")}>
            <Plus className="h-4 w-4 mr-2" /> Nova Entrada
          </Button>
        </div>

        <div className="bg-card rounded-md border border-border divide-y divide-border">
          {recs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma entrada registrada.</div>
          ) : (
            recs.map((rec) => (
              <div
                key={rec.id}
                onClick={() => onNavigate(`/receipts/${rec.id}`)}
                className="p-4 flex items-center justify-between gap-3 hover:bg-muted/30 cursor-pointer"
              >
                <div>
                  <span className="text-xs font-semibold text-muted-foreground">
                    Doc: {rec.documentNumber || "S/N"}
                  </span>
                  <p className="font-bold text-foreground">{rec.supplierName}</p>
                  <p className="text-xs text-muted-foreground">
                    {rec.warehouseName} • {rec.itemCount} itens
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <div className="flex items-center justify-end gap-1">
                    {rec.offlinePending && <Badge variant="secondary">Offline</Badge>}
                    <Badge variant={rec.status === "COMPLETED" ? "success" : "outline"}>
                      {rec.status === "COMPLETED" ? "Concluída" : "Rascunho"}
                    </Badge>
                  </div>
                  <p className="text-sm font-bold text-emerald-600">{formatCurrency(rec.total)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // 7. TRANSFERÊNCIAS (/transfers)
  if (pathname === "/transfers") {
    const trfs = operations?.transfers ?? []
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Transferências</h2>
            <p className="text-muted-foreground">Movimentações entre almoxarifados ou localizações.</p>
          </div>
          <Button onClick={() => onNavigate("/transfers/new")}>
            <Plus className="h-4 w-4 mr-2" /> Nova Transferência
          </Button>
        </div>
        <div className="bg-card rounded-md border border-border divide-y divide-border">
          {trfs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma transferência registrada.</div>
          ) : (
            trfs.map((trf) => (
              <div key={trf.id} className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-foreground">{trf.transferNumber}</span>
                    <p className="text-xs text-muted-foreground">
                      {new Date(trf.createdAt).toLocaleDateString("pt-BR")} • {trf.createdByName}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {trf.offlinePending && <Badge variant="secondary">Offline</Badge>}
                    <Badge variant="success">Concluído</Badge>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  De <strong>{trf.sourceLocationCode}</strong> ({trf.sourceWarehouseName}) → Para{" "}
                  <strong>{trf.destinationLocationCode}</strong> ({trf.destinationWarehouseName}) • {trf.itemCount} itens
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // 8. DEVOLUÇÕES (/returns)
  if (pathname === "/returns") {
    const rets = operations?.returns ?? []
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Devoluções</h2>
            <p className="text-muted-foreground">Controle de materiais devolvidos ao estoque.</p>
          </div>
          <Button onClick={() => onNavigate("/returns/new")}>
            <Plus className="h-4 w-4 mr-2" /> Nova Devolução
          </Button>
        </div>
        <div className="bg-card rounded-md border border-border divide-y divide-border">
          {rets.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma devolução registrada.</div>
          ) : (
            rets.map((ret) => (
              <div key={ret.id} className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-primary">{ret.returnNumber}</span>
                  <p className="font-semibold text-sm">{ret.warehouseName}</p>
                  <p className="text-xs text-muted-foreground">
                    {ret.reason || "Devolução"} • {ret.itemCount} itens
                  </p>
                </div>
                <div className="flex gap-1">
                  {ret.offlinePending && <Badge variant="secondary">Offline</Badge>}
                  <Badge variant="success">Recebido</Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // 9. REQUISIÇÕES (/requests) E SAÍDAS (/issues)
  if (pathname === "/requests" || pathname === "/issues") {
    const isIssuesView = pathname === "/issues"
    const list = requests.filter((r) => {
      if (isIssuesView && !["PARTIALLY_FULFILLED", "FULFILLED"].includes(r.status)) return false
      if (selectedWarehouseId && r.warehouseId && r.warehouseId !== selectedWarehouseId) return false
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase()
        if (!`${r.requestNumber} ${r.requesterName || ""}`.toLowerCase().includes(q)) return false
      }
      return true
    })

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {isIssuesView ? "Saídas de Materiais" : "Requisições de Material"}
            </h2>
            <p className="text-muted-foreground">
              {isIssuesView
                ? "Histórico de materiais entregues."
                : "Gerencie solicitações, separação e entregas de materiais offline."}
            </p>
          </div>
          {!isIssuesView && (
            <Button onClick={() => onNavigate("/requests/new")}>
              <Plus className="h-4 w-4 mr-2" /> Nova Requisição
            </Button>
          )}
        </div>

        <div className="bg-card rounded-md border border-border divide-y divide-border">
          {list.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum registro encontrado.</div>
          ) : (
            list.map((req) => (
              <div
                key={req.id}
                onClick={() => onNavigate(`/requests/${req.id}`)}
                className="p-4 flex items-center justify-between hover:bg-muted/30 cursor-pointer"
              >
                <div>
                  <span className="text-xs font-bold text-primary">{req.requestNumber}</span>
                  <p className="font-bold text-sm">{req.requesterName || "Solicitante"}</p>
                  <p className="text-xs text-muted-foreground">
                    {req.warehouseName || "Almoxarifado"} • {req.itemCount} itens •{" "}
                    {new Date(req.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {req.offlinePending && <Badge variant="secondary">Offline</Badge>}
                  <Badge variant="outline">{req.status}</Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // 10. FUNCIONÁRIOS (/admin/employees)
  if (pathname.startsWith("/admin/employees")) {
    const emps = (catalog?.employees ?? []).filter((emp) => {
      if (!searchTerm.trim()) return true
      const q = searchTerm.trim().toLowerCase()
      return `${emp.name} ${emp.employeeCode || ""} ${emp.document || ""} ${emp.qrToken || ""}`
        .toLowerCase()
        .includes(q)
    })
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <HardHat className="h-6 w-6 text-primary" /> Funcionários ({emps.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            Colaboradores habilitados para retirada via QR Code / matrícula no modo offline.
          </p>
        </div>
        <Input
          placeholder="Buscar por nome, matrícula ou CPF..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="bg-card rounded-md border border-border divide-y divide-border">
          {emps.slice(0, 150).map((emp) => (
            <div key={emp.id} className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-sm">{emp.name}</p>
                <p className="text-xs text-muted-foreground">
                  Matrícula: {emp.employeeCode || "—"} • Obra: {emp.worksites?.[0]?.name || "Geral"}
                </p>
              </div>
              <Badge variant={emp.qrStatus === "ACTIVE" ? "success" : "destructive"}>
                QR {emp.qrStatus === "ACTIVE" ? "Ativo" : "Revogado"}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 11. LOCALIZAÇÕES, CATEGORIAS, UNIDADES (/locations, /categories, /units)
  if (pathname === "/locations") {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <MapPin className="h-6 w-6 text-primary" /> Localizações ({locations.length})
        </h2>
        <div className="bg-card rounded-md border border-border divide-y divide-border">
          {locations.map((l) => (
            <div key={l.id} className="p-3.5 flex items-center justify-between">
              <div>
                <span className="font-bold text-sm">{l.code}</span>
                <p className="text-xs text-muted-foreground">{l.name}</p>
              </div>
              <span className="text-xs text-muted-foreground">
                {warehouses.find((w) => w.id === l.warehouseId)?.name || ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (pathname === "/categories") {
    const cats = catalog?.categories ?? []
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Tags className="h-6 w-6 text-primary" /> Categorias ({cats.length})
        </h2>
        <div className="bg-card rounded-md border border-border divide-y divide-border">
          {cats.map((c) => (
            <div key={c.id} className="p-3.5 font-medium text-sm">
              {c.name}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (pathname === "/units") {
    const units = catalog?.units ?? []
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Ruler className="h-6 w-6 text-primary" /> Unidades ({units.length})
        </h2>
        <div className="bg-card rounded-md border border-border divide-y divide-border">
          {units.map((u) => (
            <div key={u.id} className="p-3.5 flex justify-between text-sm">
              <span className="font-bold">{u.code}</span>
              <span className="text-muted-foreground">{u.name}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 12. DASHBOARD / PÁGINA INICIAL OFFLINE (/dashboard, /, /search e demais rotas)
  const activeInvs = (operations?.inventories ?? []).filter((i) => i.status === "IN_PROGRESS")
  const recentMovs = (operations?.movements ?? []).slice(0, 6)

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CloudOff className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-bold text-foreground">Modo Offline Ativo — 100% Operacional</p>
            <p className="text-xs text-muted-foreground">
              Todas as entregas rápidas, coletas de inventário, entradas e movimentações são salvas no dispositivo e sincronizadas automaticamente ao reconectar.
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => onNavigate("/collector/sync")}>
          Fila ({bundle.pendingTasks.length})
        </Button>
      </div>

      {/* Atalhos Principais de Operação */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => onNavigate("/quick-issue")}
          className="flex items-center gap-3 p-4 rounded-xl border border-primary/25 bg-primary/5 hover:bg-primary/10 text-left transition-all"
        >
          <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
            <Zap className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <span className="block text-sm font-bold text-foreground">Entrega Rápida</span>
            <span className="block text-xs text-muted-foreground truncate">QR Code / Matrícula</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate("/collector")}
          className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 text-left transition-all"
        >
          <div className="h-10 w-10 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <span className="block text-sm font-bold text-foreground">Coletor</span>
            <span className="block text-xs text-muted-foreground truncate">Contar inventário</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate("/receipts/new")}
          className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 text-left transition-all"
        >
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <PackagePlus className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <span className="block text-sm font-bold text-foreground">Nova Entrada</span>
            <span className="block text-xs text-muted-foreground truncate">Receber material</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate("/stock")}
          className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 text-left transition-all"
        >
          <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Box className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <span className="block text-sm font-bold text-foreground">Ver Estoque</span>
            <span className="block text-xs text-muted-foreground truncate">Saldos e locais</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate("/movements")}
          className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 text-left transition-all"
        >
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <ArrowRightLeft className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <span className="block text-sm font-bold text-foreground">Movimentações</span>
            <span className="block text-xs text-muted-foreground truncate">Extrato e ajustes</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate("/returns/new")}
          className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 text-left transition-all"
        >
          <div className="h-10 w-10 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <RotateCcw className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <span className="block text-sm font-bold text-foreground">Devolução</span>
            <span className="block text-xs text-muted-foreground truncate">Retorno ao estoque</span>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="cursor-pointer" onClick={() => onNavigate("/products")}>
          <CardContent className="p-4">
            <span className="text-xs font-semibold text-muted-foreground">Produtos no Catálogo</span>
            <div className="text-2xl font-black mt-1">{formatNumber(products.length)}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => onNavigate("/inventory")}>
          <CardContent className="p-4">
            <span className="text-xs font-semibold text-muted-foreground">Inventários Ativos</span>
            <div className="text-2xl font-black mt-1">{activeInvs.length}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => onNavigate("/requests")}>
          <CardContent className="p-4">
            <span className="text-xs font-semibold text-muted-foreground">Requisições</span>
            <div className="text-2xl font-black mt-1">{requests.length}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => onNavigate("/collector/sync")}>
          <CardContent className="p-4">
            <span className="text-xs font-semibold text-muted-foreground">Pendentes de Sync</span>
            <div className="text-2xl font-black mt-1 text-primary">{bundle.pendingTasks.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Inventários em Andamento</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("/inventory")}>
              Ver todos
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeInvs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum inventário ativo no momento.</p>
            ) : (
              activeInvs.slice(0, 4).map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => onNavigate(`/inventory/${inv.id}`)}
                  className="p-3 rounded-md border border-border flex items-center justify-between cursor-pointer hover:bg-muted/40"
                >
                  <div>
                    <p className="font-semibold text-sm">{inv.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {inv.code} • {inv.warehouseName}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {inv.locations.filter((l) => l.status === "COMPLETED").length}/{inv.locations.length} locais
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Movimentações Recentes</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("/movements")}>
              Extrato
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentMovs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma movimentação recente.</p>
            ) : (
              recentMovs.map((m) => {
                const pos = isInMovement(m.type)
                return (
                  <div key={m.id} className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{m.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {getMovementTypeLabel(m.type, m.referenceType ?? null)} • {m.locationCode}
                      </p>
                    </div>
                    <span className={`font-bold shrink-0 ${pos ? "text-emerald-600" : "text-red-600"}`}>
                      {pos ? "+" : "-"}
                      {formatNumber(Math.abs(m.quantity))} {m.unitCode}
                    </span>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
