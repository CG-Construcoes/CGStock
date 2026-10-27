"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UploadCloud, Loader2, RotateCcw, AlertTriangle, X } from "lucide-react"
import { BackButton } from "@/components/ui/back-button"
import * as XLSX from "xlsx"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { createImportBatchAction } from "./actions"
import { parseImportSheet } from "@/lib/import-parser"
import { clearWarehouseDataAction } from "../admin/warehouses/actions"

type Warehouse = { id: string, name: string, code: string }

export function ImportClient({ warehouses }: { warehouses: Warehouse[] }) {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [warehouseId, setWarehouseId] = useState<string>("")
  const [isClearModalOpen, setIsClearModalOpen] = useState(false)
  const [typedCode, setTypedCode] = useState("")
  const [isClearing, setIsClearing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const selectedWarehouse = warehouses.find(w => w.id === warehouseId)
  const expectedCode = selectedWarehouse?.code.trim().toUpperCase() || ""
  const isCodeMatch = expectedCode !== "" && typedCode.trim().toUpperCase() === expectedCode

  const handleClearWarehouse = async () => {
    if (!selectedWarehouse || !isCodeMatch) return
    setIsClearing(true)
    try {
      const res = await clearWarehouseDataAction(selectedWarehouse.id, typedCode.trim().toUpperCase())
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(`Base de dados do almoxarifado "${selectedWarehouse.name}" limpa com sucesso!`)
        setIsClearModalOpen(false)
        setTypedCode("")
        router.refresh()
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao limpar dados do almoxarifado.")
    } finally {
      setIsClearing(false)
    }
  }

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
      
      const grid = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: null })
      const rows = parseImportSheet(grid)

      if (rows.length === 0) {
        toast.error("Não foi possível ler a planilha. Verifique se há uma linha de cabeçalho com Código e Descrição/Especificação.")
        return
      }

      toast.info("Analisando arquivo e criando lote...")

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

      <div className="flex flex-wrap gap-4 items-end mb-4">
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

        {selectedWarehouse && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setTypedCode("")
              setIsClearModalOpen(true)
            }}
            disabled={isProcessing || isClearing}
            className="h-10 border-destructive/40 text-destructive hover:bg-destructive/10 flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Limpar Dados deste Almoxarifado
          </Button>
        )}
      </div>

      {isClearModalOpen && selectedWarehouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground border border-border rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-5 overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-full shrink-0">
                  <RotateCcw className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Limpar Base do Almoxarifado</h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedWarehouse.name} ({expectedCode})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isClearing && setIsClearModalOpen(false)}
                disabled={isClearing}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <span className="font-semibold uppercase tracking-wider text-[11px]">
                  O almoxarifado será mantido, mas sua base será zerada
                </span>
              </div>
              <p className="leading-relaxed">
                Esta ação vai apagar todos os <strong>saldos em estoque, movimentações, lotes de importação, requisições e inventários</strong> de <strong>{selectedWarehouse.name}</strong>, mantendo o almoxarifado e suas localizações físicas prontos para uma nova importação.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <Label htmlFor="confirm-clear-code" className="text-xs font-medium text-foreground">
                Para confirmar a limpeza, digite o código{" "}
                <code className="bg-muted px-2 py-0.5 rounded text-sm font-mono font-bold text-red-600 dark:text-red-400 border border-border select-all">
                  {expectedCode}
                </code>{" "}
                abaixo:
              </Label>
              <Input
                id="confirm-clear-code"
                placeholder={`Digite ${expectedCode}`}
                value={typedCode}
                onChange={(e) => setTypedCode(e.target.value.toUpperCase())}
                autoFocus
                className="font-mono text-center tracking-widest uppercase font-bold text-base h-11"
              />
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsClearModalOpen(false)}
                disabled={isClearing}
                className="h-9 px-4"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleClearWarehouse}
                disabled={!isCodeMatch || isClearing}
                className="flex items-center justify-center gap-2 h-9 px-4 font-semibold"
              >
                {isClearing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Limpando Base...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    Confirmar Limpeza da Base
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

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
            Suportamos arquivos .xls e .xlsx nos dois formatos: relatório de estoque (Material, Especificação, Unidade, Quantidade, Pr. Unitário, Estq.Mínimo) ou lista/catálogo de materiais (Código, Descrição do Material, Unid., Categoria, Quantidade, Preço Unit.).
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
