"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { confirmReceiptAction } from "../actions"

export function ConfirmReceiptButton({ receiptId }: { receiptId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleConfirm = async () => {
    if (!confirm("Tem certeza que deseja confirmar este recebimento? O estoque será atualizado imediatamente e a ação não pode ser desfeita.")) {
      return
    }

    setLoading(true)
    setError("")

    try {
      const formData = new FormData()
      formData.append("receiptId", receiptId)
      await confirmReceiptAction(formData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocorreu um erro ao confirmar o recebimento.")
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm border border-red-200 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}
      <Button 
        onClick={handleConfirm} 
        disabled={loading}
        className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
        {loading ? "Atualizando Estoque..." : "Confirmar Recebimento"}
      </Button>
    </div>
  )
}
