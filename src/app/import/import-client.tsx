"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { UploadCloud, FileType, CheckCircle2, Loader2 } from "lucide-react"
import { BackButton } from "@/components/ui/back-button"
import * as XLSX from "xlsx"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { createImportBatchAction } from "./actions"

type Warehouse = { id: string, name: string, code: string }

export function ImportClient({ warehouses }: { warehouses: Warehouse[] }) {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [warehouseId, setWarehouseId] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      await processFile(file)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await processFile(file)
    }
  }

  const processFile = async (file: File) => {
    if (!warehouseId) {
      toast.error("Por favor, selecione um almoxarifado de destino primeiro.")
      return
    }

    try {
      setIsProcessing(true)
      
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      
      const jsonData = XLSX.utils.sheet_to_json<any>(worksheet)

      if (jsonData.length === 0) {
        toast.error("A planilha está vazia.")
        return
      }

      toast.info("Analisando arquivo e criando lote...")

      const rows = jsonData.map(row => ({
        productCode: row.Material || row.Código || row.code || '',
        productName: row['Especificação'] || row.Nome || row.name || '',
        quantity: row.Quantidade || row.quantity || 0,
        unitCost: row['Pr. Unitário'] || row['Valor'] || row.unitCost || null
      }))

      const result = await createImportBatchAction(warehouseId, rows)
      
      if (result.success) {
        toast.success("Lote criado com sucesso! Redirecionando...")
        router.push(`/import/batches/${result.batchId}`)
      } else {
        toast.error(result.error || "Erro ao criar lote.")
      }

    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Erro inesperado ao processar o arquivo.")
    } finally {
      setIsProcessing(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Importar Dados</h2>
          <p className="text-muted-foreground">Importe planilhas de estoque e produtos.</p>
        </div>
      </div>

      <div className="flex gap-4 items-end mb-4">
        <div className="w-full max-w-md space-y-2">
          <label className="text-sm font-medium">Almoxarifado de Destino *</label>
          <select 
            value={warehouseId} 
            onChange={(e) => setWarehouseId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Selecione um almoxarifado...</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
            ))}
          </select>
        </div>
      </div>

      <Card>
        <CardContent 
          className={`p-10 flex flex-col items-center justify-center text-center border-2 border-dashed rounded-md m-4  ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-border bg-muted/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="h-16 w-16 bg-card border shadow-sm rounded-full flex items-center justify-center mb-4">
            {isProcessing ? (
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
            ) : (
              <UploadCloud className="h-8 w-8 text-blue-500" />
            )}
          </div>
          <h3 className="text-lg font-semibold mb-1">
            {isProcessing ? 'Processando arquivo...' : 'Arraste seu arquivo para cá'}
          </h3>
          
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            Suportamos arquivos .xls e .xlsx. A planilha deve conter as colunas: Material, Especificação, Unidade, Quantidade, Pr. Unitário, Estq.Mínimo.
          </p>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".xls,.xlsx" 
            onChange={handleFileChange}
            disabled={isProcessing}
          />
          <Button 
            disabled={isProcessing || !warehouseId} 
            onClick={() => fileInputRef.current?.click()}
          >
            Selecionar arquivo do computador
          </Button>
          {!warehouseId && (
            <p className="text-xs text-destructive mt-2">Selecione o almoxarifado acima para habilitar.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
