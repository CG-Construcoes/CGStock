"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2, AlertTriangle, ShieldAlert, Loader2, X, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { deleteWarehouseAction, inactivateWarehouseAction, clearWarehouseDataAction } from "./actions"
import { toast } from "sonner"

interface WarehouseDeleteDialogProps {
  warehouseId: string
  warehouseName: string
  warehouseCode: string
  redirectAfterDelete?: boolean
  variant?: "button" | "icon"
}

export function WarehouseDeleteDialog({
  warehouseId,
  warehouseName,
  warehouseCode,
  redirectAfterDelete = false,
  variant = "button"
}: WarehouseDeleteDialogProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [typedCode, setTypedCode] = useState("")
  const [isDeleting, startDeleteTransition] = useTransition()
  const [isClearing, startClearTransition] = useTransition()
  const [isInactivating, startInactivateTransition] = useTransition()

  const normalizedExpectedCode = warehouseCode.trim().toUpperCase()
  const isMatch = typedCode.trim().toUpperCase() === normalizedExpectedCode
  const isBusy = isDeleting || isClearing || isInactivating

  const handleDelete = () => {
    if (!isMatch) {
      toast.error(`Digite exatamente "${normalizedExpectedCode}" para confirmar a exclusão.`)
      return
    }

    startDeleteTransition(async () => {
      const res = await deleteWarehouseAction(warehouseId, typedCode.trim().toUpperCase())
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(`Almoxarifado "${warehouseName}" e todos os seus registros foram excluídos definitivamente!`)
        setIsOpen(false)
        setTypedCode("")
        if (redirectAfterDelete) {
          router.push("/admin/warehouses")
        } else {
          router.refresh()
        }
      }
    })
  }

  const handleClearData = () => {
    if (!isMatch) {
      toast.error(`Digite exatamente "${normalizedExpectedCode}" para confirmar a limpeza dos dados.`)
      return
    }

    startClearTransition(async () => {
      const res = await clearWarehouseDataAction(warehouseId, typedCode.trim().toUpperCase())
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(`Todos os saldos e movimentações de "${warehouseName}" foram zerados! O almoxarifado continua ativo.`)
        setIsOpen(false)
        setTypedCode("")
        router.refresh()
      }
    })
  }

  const handleInactivate = () => {
    startInactivateTransition(async () => {
      const res = await inactivateWarehouseAction(warehouseId)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(`Almoxarifado "${warehouseName}" inativado com sucesso!`)
        setIsOpen(false)
        setTypedCode("")
        if (redirectAfterDelete) {
          router.push("/admin/warehouses")
        } else {
          router.refresh()
        }
      }
    })
  }

  const handleClose = () => {
    if (isBusy) return
    setIsOpen(false)
    setTypedCode("")
  }

  return (
    <>
      {variant === "button" ? (
        <Button
          type="button"
          variant="destructive"
          onClick={() => {
            setTypedCode("")
            setIsOpen(true)
          }}
          className="flex items-center gap-2 shadow-xs"
        >
          <Trash2 className="h-4 w-4" />
          Limpar / Excluir Almoxarifado
        </Button>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setTypedCode("")
            setIsOpen(true)
          }}
          className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md transition-colors"
          title="Limpar dados ou excluir almoxarifado"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground border border-border rounded-xl max-w-xl w-full p-6 shadow-2xl space-y-5 overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-full shrink-0">
                  <Trash2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Limpar Dados ou Excluir Almoxarifado</h3>
                  <p className="text-xs text-muted-foreground">
                    {warehouseName} ({normalizedExpectedCode})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={isBusy}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Aviso de Perigo */}
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 space-y-2 text-xs text-red-900 dark:text-red-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <span className="font-semibold uppercase tracking-wider text-[11px]">
                  Escolha o que deseja fazer com {warehouseName}
                </span>
              </div>
              <p className="leading-relaxed">
                <strong>Limpar Base do Almoxarifado:</strong> apaga todo o estoque, movimentações, lotes de importação, requisições e inventários deste almoxarifado, mas <strong>mantém o almoxarifado, suas localizações e acessos criados</strong> para você importar do zero.
              </p>
              <p className="leading-relaxed">
                <strong>Excluir Tudo:</strong> apaga todos os dados acima e também remove o cadastro do almoxarifado do sistema.
              </p>
            </div>

            {/* Confirmação à escrita */}
            <div className="space-y-2 pt-1">
              <Label htmlFor="confirm-code" className="text-xs font-medium text-foreground">
                Para liberar as ações de limpeza/exclusão, digite o código{" "}
                <code className="bg-muted px-2 py-0.5 rounded text-sm font-mono font-bold text-red-600 dark:text-red-400 border border-border select-all">
                  {normalizedExpectedCode}
                </code>{" "}
                abaixo:
              </Label>
              <Input
                id="confirm-code"
                placeholder={`Digite ${normalizedExpectedCode}`}
                value={typedCode}
                onChange={(e) => setTypedCode(e.target.value.toUpperCase())}
                autoFocus
                className="font-mono text-center tracking-widest uppercase font-bold text-base h-11"
              />
              {!isMatch && typedCode.length > 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  O código digitado ainda não confere com o código do almoxarifado.
                </p>
              )}
            </div>

            {/* Ações */}
            <div className="pt-4 border-t border-border flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleInactivate}
                  disabled={isBusy}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 h-9"
                >
                  {isInactivating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                  )}
                  Apenas Inativar
                </Button>

                <div className="flex flex-wrap items-center gap-2 justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClose}
                    disabled={isBusy}
                    className="h-9 px-3"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClearData}
                    disabled={!isMatch || isBusy}
                    className="flex items-center justify-center gap-1.5 h-9 px-3 border-amber-500/50 text-amber-500 hover:bg-amber-500/10 font-semibold"
                  >
                    {isClearing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Limpando Base...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="h-4 w-4" />
                        Limpar Base (Manter Almoxarifado)
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={!isMatch || isBusy}
                    className="flex items-center justify-center gap-1.5 h-9 px-3 font-semibold"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Excluindo...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        Excluir Tudo
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
