"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { Check, ChevronDown, Loader2, Pencil, X, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DecimalInput } from "@/components/ui/decimal-input"
import { cn } from "@/lib/utils"
import { formatDecimalBR } from "@/lib/decimal-br"
import type { ProductQuickField } from "@/lib/quick-edit"
import {
  updateProductFieldAction,
  getProductStockLocationsAction,
  quickSetStockAction,
  type StockLocationOption,
} from "@/app/products/quick-edit-actions"

/* ---------- Popover (desktop) / painel inferior (celular) ---------- */

function QuickPopover({ open, onClose, title, children, anchor, align = "right" }: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  anchor: React.RefObject<HTMLElement | null>
  align?: "left" | "right"
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [pos, setPos] = React.useState<React.CSSProperties | null>(null)

  React.useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect()
      if (!rect || window.innerWidth < 640) return setPos(null)
      const width = 320
      const left = align === "right" ? rect.right - width : rect.left
      const top = rect.bottom + 4
      setPos({ top: Math.min(top, window.innerHeight - 80), left: Math.max(8, Math.min(left, window.innerWidth - width - 8)), width })
    }
    place()
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
    }
  }, [open, anchor, align])

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (ref.current?.contains(target) || anchor.current?.contains(target)) return
      onClose()
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onClick)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onClick)
    }
  }, [open, onClose, anchor])

  if (!open) return null
  return createPortal(
    <>
      <div className="fixed inset-0 z-[90] bg-black/40 sm:hidden" aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-label={title}
        style={pos ?? undefined}
        className={cn(
          "fixed z-[100] bg-card border border-border shadow-xl text-left text-sm text-foreground overflow-y-auto",
          pos ? "rounded-md p-3 max-h-[70vh]" : "inset-x-0 bottom-0 rounded-t-xl p-4 pb-6 max-h-[80vh]"
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold">{title}</p>
          <button type="button" onClick={onClose} className="h-7 w-7 -mr-1 inline-flex items-center justify-center rounded hover:bg-muted" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </>,
    document.body
  )
}

const EditableTrigger = React.forwardRef<HTMLButtonElement, { children: React.ReactNode; onClick: () => void; className?: string; label: string }>(function EditableTrigger({ children, onClick, className, label }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      title={`Editar ${label.toLowerCase()}`}
      className={cn("group/qe inline-flex items-center gap-1 rounded px-1 -mx-1 hover:text-primary hover:bg-primary/5 transition-colors", className)}
    >
      {children}
      <Pencil className="h-3 w-3 opacity-40 group-hover/qe:opacity-100 shrink-0" />
    </button>
  )
})

function useSave() {
  const router = useRouter()
  const [pending, start] = React.useTransition()
  const run = React.useCallback((fn: () => Promise<{ error?: string; success?: string }>, onDone?: () => void) => {
    start(async () => {
      const res = await fn()
      if (res.error) return void toast.error(res.error)
      if (res.success && res.success !== "Sem alterações.") toast.success(res.success)
      onDone?.()
      router.refresh()
    })
  }, [router])
  return { pending, run }
}

/* ---------- Select (unidade, categoria, status) ---------- */

const SELECT_FIELD_TITLES = { unitId: "Unidade", categoryId: "Categoria", status: "Status" } as const

export function QuickSelectCell({ productId, field, value, options, canEdit, className, display, align }: {
  productId: string
  field: Extract<ProductQuickField, "unitId" | "categoryId" | "status">
  value: string
  options: { value: string; label: string }[]
  canEdit: boolean
  className?: string
  display?: React.ReactNode
  align?: "left" | "right"
}) {
  const [open, setOpen] = React.useState(false)
  const anchor = React.useRef<HTMLButtonElement>(null)
  const { pending, run } = useSave()
  const close = React.useCallback(() => setOpen(false), [])

  const current = options.find(o => o.value === value)
  if (!canEdit) return <>{display ?? current?.label ?? "—"}</>

  const pick = (v: string) => {
    close()
    if (v !== value) run(() => updateProductFieldAction(productId, field, v))
  }

  return (
    <span className="relative inline-flex items-center max-w-full">
      <button
        ref={anchor}
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        title={`Editar ${SELECT_FIELD_TITLES[field].toLowerCase()}`}
        className={cn("group/qe h-8 max-w-full inline-flex items-center gap-1 rounded-md border border-transparent bg-transparent px-1.5 text-sm hover:border-border hover:bg-primary/5 focus:border-primary focus:outline-none disabled:opacity-50 cursor-pointer", className)}
      >
        {display ?? current?.label ?? "—"}
        {pending
          ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
          : <ChevronDown className="h-3.5 w-3.5 opacity-50 group-hover/qe:opacity-100 shrink-0" />}
      </button>
      <QuickPopover open={open} onClose={close} title={SELECT_FIELD_TITLES[field]} align={align} anchor={anchor}>
        <ul className="space-y-0.5 max-h-64 overflow-y-auto overscroll-contain -mr-1 pr-1">
          {options.map(o => (
            <li key={o.value}>
              <button
                type="button"
                onClick={() => pick(o.value)}
                disabled={pending}
                className={cn("w-full flex items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50", o.value === value && "bg-primary/10 text-primary font-medium")}
              >
                {o.label}
                {o.value === value && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            </li>
          ))}
        </ul>
      </QuickPopover>
    </span>
  )
}

/* ---------- Número (custo médio, mínimo, máximo) ---------- */

export function QuickNumberCell({ productId, fields, canEdit, display, title, align }: {
  productId: string
  fields: { field: Extract<ProductQuickField, "averageCost" | "minimumStock" | "maximumStock">; label: string; value: number; money?: boolean }[]
  canEdit: boolean
  display: React.ReactNode
  title: string
  align?: "left" | "right"
}) {
  const [open, setOpen] = React.useState(false)
  const [values, setValues] = React.useState<number[]>([])
  const anchor = React.useRef<HTMLButtonElement>(null)
  const { pending, run } = useSave()
  const close = React.useCallback(() => setOpen(false), [])

  if (!canEdit) return <>{display}</>

  const save = () => {
    const changed = fields.map((f, i) => ({ ...f, next: values[i] })).filter(f => f.next !== f.value)
    if (!changed.length) return close()
    run(async () => {
      let last: { error?: string; success?: string } = {}
      for (const f of changed) {
        last = await updateProductFieldAction(productId, f.field, f.next)
        if (last.error) return last
      }
      return changed.length > 1 ? { success: `${title} atualizado.` } : last
    }, close)
  }

  return (
    <span className="relative inline-block">
      <EditableTrigger ref={anchor} label={title} onClick={() => { setValues(fields.map(f => f.value)); setOpen(true) }}>{display}</EditableTrigger>
      <QuickPopover open={open} onClose={close} title={title} align={align} anchor={anchor}>
        <form onSubmit={(e) => { e.preventDefault(); save() }} className="space-y-3">
          <div className={cn("grid gap-3", fields.length > 1 && "grid-cols-2")}>
            {fields.map((f, i) => (
              <label key={f.field} className="space-y-1 block">
                <span className="text-xs font-medium text-muted-foreground">{f.label}{f.money ? " (R$)" : ""}</span>
                <DecimalInput
                  autoFocus={i === 0}
                  min={0}
                  fractionDigits={f.money ? 6 : 4}
                  value={values[i]}
                  defaultValue={f.value}
                  onValueChange={(v) => setValues(prev => prev.map((p, j) => (j === i ? v : p)))}
                  disabled={pending}
                />
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={close} disabled={pending}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={pending} className="min-w-20">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
          </div>
        </form>
      </QuickPopover>
    </span>
  )
}

/* ---------- Saldo por localização ---------- */

type Row = StockLocationOption & { next: number; isNew?: boolean }

export function QuickStockCell({ productId, unitCode, canEdit, display, align }: {
  productId: string
  unitCode: string
  canEdit: boolean
  display: React.ReactNode
  align?: "left" | "right"
}) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [rows, setRows] = React.useState<Row[]>([])
  const [locations, setLocations] = React.useState<Omit<StockLocationOption, "quantity" | "reserved">[]>([])
  const [reason, setReason] = React.useState("")
  const anchor = React.useRef<HTMLButtonElement>(null)
  const { pending, run } = useSave()
  const close = React.useCallback(() => setOpen(false), [])

  if (!canEdit) return <>{display}</>

  const openEditor = async () => {
    setOpen(true)
    setReason("")
    setLoading(true)
    const res = await getProductStockLocationsAction(productId)
    setLoading(false)
    if (res.error) return void toast.error(res.error)
    setRows(res.stocks.map(s => ({ ...s, next: s.quantity })))
    setLocations(res.locations)
  }

  const addLocation = (locationId: string) => {
    const loc = locations.find(l => l.locationId === locationId)
    if (!loc || rows.some(r => r.locationId === locationId)) return
    setRows(prev => [...prev, { ...loc, quantity: 0, reserved: 0, next: 0, isNew: true }])
  }

  const save = () => {
    const changed = rows.filter(r => r.next !== r.quantity)
    if (!changed.length) return close()
    run(async () => {
      let last: { error?: string; success?: string } = {}
      for (const r of changed) {
        last = await quickSetStockAction({ productId, locationId: r.locationId, newQuantity: r.next, reason })
        if (last.error) return { error: `${r.locationCode}: ${last.error}` }
      }
      return changed.length > 1 ? { success: `Saldo atualizado em ${changed.length} localizações.` } : last
    }, close)
  }

  const available = locations.filter(l => !rows.some(r => r.locationId === l.locationId))

  return (
    <span className="relative inline-block">
      <EditableTrigger ref={anchor} label="estoque" onClick={openEditor}>{display}</EditableTrigger>
      <QuickPopover open={open} onClose={close} title="Editar saldo" align={align} anchor={anchor}>
        {loading ? (
          <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); save() }} className="space-y-3">
            {rows.length === 0 && <p className="text-xs text-muted-foreground">Sem saldo nos seus almoxarifados. Escolha uma localização abaixo.</p>}
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={r.locationId} className="grid grid-cols-[1fr_7.5rem] items-center gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold truncate">{r.locationCode}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{r.warehouseName}{r.reserved > 0 ? ` · reservado ${formatDecimalBR(r.reserved)}` : ""}</p>
                  </div>
                  <DecimalInput
                    autoFocus={i === 0}
                    min={0}
                    suffix={unitCode}
                    value={r.next}
                    defaultValue={r.quantity}
                    onValueChange={(v) => setRows(prev => prev.map(p => (p.locationId === r.locationId ? { ...p, next: v } : p)))}
                    disabled={pending}
                    className={cn("h-9 text-right", r.next !== r.quantity && "border-primary")}
                  />
                </div>
              ))}
            </div>
            {available.length > 0 && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <select value="" onChange={(e) => addLocation(e.target.value)} disabled={pending} className="h-8 flex-1 min-w-0 rounded-md border border-input bg-background px-2 text-xs">
                  <option value="">Adicionar em outra localização...</option>
                  {available.map(l => <option key={l.locationId} value={l.locationId}>{l.locationCode} — {l.warehouseName}</option>)}
                </select>
              </label>
            )}
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (opcional)" disabled={pending} className="h-9" />
            <p className="text-[11px] text-muted-foreground">A diferença vira uma movimentação &quot;Edição rápida&quot; e aparece nos relatórios.</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={close} disabled={pending}>Cancelar</Button>
              <Button type="submit" size="sm" disabled={pending || rows.length === 0} className="min-w-20">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
            </div>
          </form>
        )}
      </QuickPopover>
    </span>
  )
}
