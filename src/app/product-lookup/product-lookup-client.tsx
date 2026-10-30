"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  AlertTriangle,
  ArrowRightLeft,
  Box,
  Camera,
  Loader2,
  MapPin,
  Package,
  ScanBarcode,
  ScanSearch,
  WifiOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CameraScannerModal } from "@/components/ui/camera-scanner-modal"
import { cn, formatCurrency, formatNumber } from "@/lib/utils"
import { getMovementTypeLabel, isInMovement } from "@/lib/movement-labels"
import { getOfflineSnapshot, isSnapshotAvailableOffline } from "@/lib/offline-snapshot"
import type { CatalogSnapshotData, StockSnapshotData } from "@/lib/localdb"
import { lookupProductAction, type ProductLookupData } from "./actions"

type LookupState = {
  product: ProductLookupData
  warehouseLabel: string
  offline: boolean
}

export function ProductLookupClient({
  userId,
  activeWarehouseId,
  warehouseLabel,
}: {
  userId: string
  activeWarehouseId: string
  warehouseLabel: string
}) {
  const [code, setCode] = useState("")
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<LookupState | null>(null)
  const [notFound, setNotFound] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sem resultado ainda: foca o campo para leitores de código de barras USB
  // (eles digitam e enviam Enter). Com resultado, o foco vai para "Escanear outro".
  useEffect(() => {
    if (!result) inputRef.current?.focus()
  }, [result])

  const resolveOffline = async (trimmed: string): Promise<LookupState | { error: string }> => {
    const [catSnap, stkSnap] = await Promise.all([
      getOfflineSnapshot<CatalogSnapshotData>("catalog", userId),
      getOfflineSnapshot<StockSnapshotData>("stock", userId),
    ])
    if (!isSnapshotAvailableOffline(catSnap, userId)) {
      return { error: "Sem conexão e sem dados locais. Conecte-se à internet uma vez para sincronizar o catálogo." }
    }

    const catalog = catSnap!.data
    const products = catalog.products ?? []
    const lower = trimmed.toLowerCase()
    const product =
      products.find(
        (p) =>
          p.code.toLowerCase() === lower ||
          (p.barcode && p.barcode.toLowerCase() === lower) ||
          p.id === trimmed
      ) ??
      products
        .filter(
          (p) =>
            p.code.toLowerCase().includes(lower) ||
            (p.barcode && p.barcode.toLowerCase().includes(lower)) ||
            p.name.toLowerCase().includes(lower)
        )
        .sort((a, b) => a.code.localeCompare(b.code))[0]

    if (!product) return { error: "Produto não encontrado no catálogo local deste aparelho." }

    const locationsById = new Map((catalog.locations ?? []).map((l) => [l.id, l]))
    const warehousesById = new Map((catalog.warehouses ?? []).map((w) => [w.id, w]))
    const items = (stkSnap?.data?.items ?? []).filter(
      (s) => s.productId === product.id && (!activeWarehouseId || s.warehouseId === activeWarehouseId)
    )
    const totalQuantity = items.reduce((sum, s) => sum + Number(s.quantity), 0)
    const totalReserved = items.reduce((sum, s) => sum + Number(s.reservedQuantity || 0), 0)
    const averageCost = product.averageCost ?? null

    return {
      offline: true,
      warehouseLabel,
      product: {
        id: product.id,
        code: product.code,
        barcode: product.barcode,
        name: product.name,
        status: product.status ?? "ACTIVE",
        categoryName: product.categoryName ?? "—",
        unitCode: product.unitCode ?? "UN",
        unitName: product.unitCode ?? "UN",
        brand: null,
        model: null,
        notes: null,
        minimumStock: product.minimumStock ?? 0,
        maximumStock: product.maximumStock ?? 0,
        averageCost,
        defaultLocationLabel: null,
        totalQuantity,
        totalReserved,
        available: totalQuantity - totalReserved,
        totalValue: averageCost ? totalQuantity * averageCost : 0,
        locations: items
          .map((s) => ({
            warehouseName: warehousesById.get(s.warehouseId)?.name ?? "Almoxarifado",
            locationCode: locationsById.get(s.locationId)?.code ?? s.locationId,
            locationName: locationsById.get(s.locationId)?.name ?? "",
            quantity: Number(s.quantity),
            reservedQuantity: Number(s.reservedQuantity || 0),
            unitValue: null,
          }))
          .sort((a, b) => b.quantity - a.quantity),
        movements: [],
      },
    }
  }

  const processCode = async (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed || isLoading) return

    setNotFound(null)
    setIsLoading(true)

    if (!navigator.onLine) {
      const offline = await resolveOffline(trimmed)
      setIsLoading(false)
      if ("error" in offline) {
        toast.error(offline.error)
        setNotFound(trimmed)
        setResult(null)
        return
      }
      setResult(offline)
      setCode("")
      toast.info("Consulta feita com dados locais (offline).")
      return
    }

    try {
      const res = await lookupProductAction(trimmed)
      setIsLoading(false)
      if ("error" in res) {
        toast.error(res.error)
        setNotFound(trimmed)
        setResult(null)
        return
      }
      setResult({ product: res.product, warehouseLabel: res.warehouseLabel, offline: false })
      setCode("")
    } catch {
      setIsLoading(false)
      // Queda de conexão no meio da chamada: tenta o banco local
      const offline = await resolveOffline(trimmed)
      if ("error" in offline) {
        toast.error("Falha na consulta. Verifique sua conexão e tente novamente.")
        setNotFound(trimmed)
        setResult(null)
        return
      }
      setResult(offline)
      setCode("")
      toast.info("Consulta feita com dados locais (offline).")
    }
  }

  const reset = () => {
    setResult(null)
    setNotFound(null)
    setCode("")
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 pb-8">
      {/* Barra de consulta: sempre visível para bipar o próximo item rápido */}
      <div className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void processCode(code)
          }}
        >
          <div className="relative flex-1">
            <ScanBarcode className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Digite ou bipare o código do produto"
              enterKeyHint="search"
              autoComplete="off"
              className="h-12 rounded-xl pl-11 text-base"
            />
          </div>
          <Button
            type="button"
            onClick={() => setIsCameraOpen(true)}
            className="h-12 w-12 shrink-0 rounded-xl sm:w-auto sm:px-5 sm:gap-2"
            title="Escanear QR Code com a câmera"
          >
            <Camera className="h-5 w-5" />
            <span className="hidden sm:inline font-semibold">Escanear</span>
          </Button>
        </form>
        {isLoading && (
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Consultando produto...
          </p>
        )}
      </div>

      {result ? (
        <ResultCard key={result.product.id} state={result} onScanAnother={reset} />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center sm:py-20">
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ScanSearch className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Consulta de Produto</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Escaneie o QR Code da etiqueta do produto com a câmera, ou digite o código acima, para ver saldo,
            valor e localização no estoque.
          </p>
          {notFound && (
            <p className="mt-4 flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              Nada encontrado para “{notFound}”
            </p>
          )}
          <Button onClick={() => setIsCameraOpen(true)} className="mt-6 h-12 gap-2 rounded-xl px-6 font-semibold">
            <Camera className="h-5 w-5" />
            Abrir câmera
          </Button>
        </div>
      )}

      <CameraScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScan={(decoded) => {
          setIsCameraOpen(false)
          void processCode(decoded)
        }}
        title="Escanear Etiqueta do Produto"
        subtitle="Aponte a câmera para o QR Code da etiqueta"
      />
    </div>
  )
}

function ResultCard({ state, onScanAnother }: { state: LookupState; onScanAnother: () => void }) {
  const { product: p, offline } = state
  const isLow = p.minimumStock > 0 && p.available <= p.minimumStock
  const isEmpty = p.available <= 0

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {/* Cabeçalho do produto */}
        <div className="flex items-start gap-3 border-b border-border p-4 sm:p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Package className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold leading-tight text-foreground sm:text-lg">{p.name}</h2>
              <Badge variant={p.status === "ACTIVE" ? "success" : "secondary"}>
                {p.status === "ACTIVE" ? "Ativo" : "Inativo"}
              </Badge>
              {isEmpty ? (
                <Badge variant="destructive">Sem estoque</Badge>
              ) : (
                isLow && <Badge variant="warning">Estoque baixo</Badge>
              )}
              {offline && (
                <Badge variant="outline" className="gap-1">
                  <WifiOff className="h-3 w-3" /> Offline
                </Badge>
              )}
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {p.code}
              {p.barcode ? ` • EAN ${p.barcode}` : ""}
            </p>
          </div>
        </div>

        {/* Saldos — informação principal */}
        <div className="grid grid-cols-3 divide-x divide-border border-b border-border bg-muted/30">
          <StockStat
            label="Disponível"
            value={p.available}
            unit={p.unitCode}
            className={cn(
              isEmpty
                ? "text-destructive"
                : isLow
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-emerald-600 dark:text-emerald-400"
            )}
          />
          <StockStat label="Físico" value={p.totalQuantity} unit={p.unitCode} />
          <StockStat label="Reservado" value={p.totalReserved} unit={p.unitCode} />
        </div>
        <p className="border-b border-border bg-muted/30 px-4 pb-3 text-[11px] text-muted-foreground">
          Saldos de: <span className="font-semibold text-foreground">{state.warehouseLabel}</span>
        </p>

        {/* Valores */}
        <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
          <div className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Custo médio</p>
            <p className="mt-1 text-lg font-bold text-foreground">
              {p.averageCost ? formatCurrency(p.averageCost) : "—"}
              <span className="ml-1 text-xs font-normal text-muted-foreground">/{p.unitCode}</span>
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Valor em estoque</p>
            <p className="mt-1 text-lg font-bold text-foreground">{formatCurrency(p.totalValue)}</p>
          </div>
        </div>

        {/* Ficha do produto */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-border p-4 sm:grid-cols-3 sm:p-5">
          <Detail label="Categoria" value={p.categoryName} />
          <Detail label="Unidade" value={`${p.unitName} (${p.unitCode})`} />
          <Detail label="Marca / Modelo" value={[p.brand, p.model].filter(Boolean).join(" · ") || "—"} />
          <Detail label="Localização padrão" value={p.defaultLocationLabel ?? "—"} />
          <Detail
            label="Estoque mín / máx"
            value={`${formatNumber(p.minimumStock)} / ${p.maximumStock > 0 ? formatNumber(p.maximumStock) : "—"}`}
          />
          <Detail label="Cód. de barras" value={p.barcode ?? "—"} mono />
        </dl>
        {p.notes && (
          <div className="border-b border-border px-4 pb-4 sm:px-5">
            <p className="text-xs font-medium text-muted-foreground">Observações</p>
            <p className="mt-1 text-sm text-foreground">{p.notes}</p>
          </div>
        )}

        {/* Onde está */}
        <div className="border-b border-border">
          <div className="flex items-center gap-2 px-4 pt-4 sm:px-5">
            <MapPin className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Onde está</h3>
          </div>
          {p.locations.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted-foreground sm:px-5">
              Sem saldo registrado em nenhuma localização.
            </p>
          ) : (
            <ul className="divide-y divide-border px-4 pb-2 sm:px-5">
              {p.locations.map((loc, i) => (
                <li key={`${loc.locationCode}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{loc.locationCode}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {loc.warehouseName}
                      {loc.locationName && loc.locationName !== loc.locationCode ? ` · ${loc.locationName}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums text-foreground">
                      {formatNumber(loc.quantity)} <span className="text-xs font-normal text-muted-foreground">{p.unitCode}</span>
                    </p>
                    {loc.reservedQuantity > 0 && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        {formatNumber(loc.reservedQuantity)} reserv.
                      </p>
                    )}
                    {loc.unitValue !== null && (
                      <p className="text-[11px] text-muted-foreground">{formatCurrency(loc.unitValue)}/un</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Últimas movimentações */}
        {!offline && (
          <div>
            <div className="flex items-center gap-2 px-4 pt-4 sm:px-5">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Últimas movimentações</h3>
            </div>
            {p.movements.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground sm:px-5">Nenhuma movimentação registrada.</p>
            ) : (
              <ul className="divide-y divide-border px-4 pb-2 sm:px-5">
                {p.movements.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={isInMovement(m.type) ? "success" : "destructive"} className="px-1.5 py-0 text-[10px]">
                          {getMovementTypeLabel(m.type, m.referenceType)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(m.createdAt).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {m.locationCode} · por {m.performedByName.split(" ")[0]}
                        {m.recipientName ? ` · ${isInMovement(m.type) ? "devolvido por" : "entregue para"} ${m.recipientName.split(" ")[0]}` : ""}
                        {m.documentNumber ? ` · Doc ${m.documentNumber}` : ""}
                      </p>
                    </div>
                    <p
                      className={cn(
                        "shrink-0 text-sm font-bold tabular-nums",
                        isInMovement(m.type) ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                      )}
                    >
                      {isInMovement(m.type) ? "+" : "−"}
                      {formatNumber(Math.abs(m.quantity))}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Ações */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button onClick={onScanAnother} className="h-12 gap-2 rounded-xl font-semibold">
          <ScanSearch className="h-5 w-5" />
          Consultar outro
        </Button>
        {!offline && (
          <>
            <Link href={`/stock/${p.id}`} className="block">
              <Button variant="outline" className="h-12 w-full gap-2 rounded-xl">
                <Box className="h-4 w-4" />
                Ver estoque
              </Button>
            </Link>
            <Link href={`/products/${p.id}`} className="block">
              <Button variant="outline" className="h-12 w-full gap-2 rounded-xl">
                <Package className="h-4 w-4" />
                Ficha completa
              </Button>
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

function StockStat({ label, value, unit, className }: { label: string; value: number; unit: string; className?: string }) {
  return (
    <div className="px-2 py-4 text-center sm:py-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-black tabular-nums text-foreground sm:text-3xl", className)}>
        {formatNumber(value)}
      </p>
      <p className="text-[11px] text-muted-foreground">{unit}</p>
    </div>
  )
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 truncate text-sm font-semibold text-foreground", mono && "font-mono")} title={value}>
        {value}
      </dd>
    </div>
  )
}
