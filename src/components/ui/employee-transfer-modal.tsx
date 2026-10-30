"use client"

import { Button } from "@/components/ui/button"
import { AlertTriangle, ArrowRightLeft, Loader2, X } from "lucide-react"

export type PendingEmployeeTransfer = {
  employee: {
    id: string
    name: string
    employeeCode: string | null
    document: string | null
  }
  currentWarehouse: { id: string; name: string }
  targetWarehouse: { id: string; name: string }
  qrToken: string
}

export function EmployeeTransferModal({
  transfer,
  isTransferring,
  onConfirm,
  onCancel,
}: {
  transfer: PendingEmployeeTransfer | null
  isTransferring: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!transfer) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={isTransferring ? undefined : onCancel}
      />
      <div className="relative w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4 z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg leading-tight">
                Transferir colaborador de almoxarifado?
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {transfer.employee.name}
                {transfer.employee.employeeCode ? ` · Mat. ${transfer.employee.employeeCode}` : ""}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onCancel}
            disabled={isTransferring}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3 text-sm">
          <p className="leading-relaxed text-foreground">
            Este colaborador está vinculado ao almoxarifado{" "}
            <strong className="text-amber-500">{transfer.currentWarehouse.name}</strong>. Deseja fazer a
            transferência dele para{" "}
            <strong className="text-emerald-500">{transfer.targetWarehouse.name}</strong>?
          </p>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <span>
              Se você não realizar a transferência, o sistema <strong>não poderá registrar</strong> que você
              entregou ou emprestou material deste almoxarifado para ele.
            </span>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isTransferring}
            className="h-11 w-full sm:w-auto"
          >
            Não, cancelar
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isTransferring}
            className="h-11 w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            {isTransferring ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Transferindo...
              </>
            ) : (
              <>Sim, transferir para {transfer.targetWarehouse.name}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
