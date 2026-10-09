"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { UploadCloud, FileType, CheckCircle2, Loader2 } from "lucide-react"
import { BackButton } from "@/components/ui/back-button"
import * as XLSX from "xlsx"
import { toast } from "sonner"

export default function ImportPage() {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const [progress, setProgress] = useState(0)

  const processFile = async (file: File) => {
    try {
      setIsProcessing(true)
      setProgress(0)
      
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      
      // Expected headers: 'Material', 'Especificação', 'Unidade', 'Quantidade', 'Valor', 'Pr. Unitário', 'Estq.Mínimo'
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      if (jsonData.length === 0) {
        toast.error("A planilha está vazia.")
        return
      }

      toast.info(`Iniciando importação de ${jsonData.length} registros...`)

      const chunkSize = 100
      let processedTotal = 0

      for (let i = 0; i < jsonData.length; i += chunkSize) {
        const chunk = jsonData.slice(i, i + chunkSize)
        
        const response = await fetch('/api/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename: file.name,
            data: chunk
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `Erro ao importar lote ${i/chunkSize + 1}.`)
        }

        const result = await response.json()
        processedTotal += result.processedCount
        setProgress(Math.round(((i + chunk.length) / jsonData.length) * 100))
      }

      toast.success(`Sucesso! ${processedTotal} produtos importados/atualizados.`)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Erro inesperado ao processar o arquivo.")
    } finally {
      setIsProcessing(false)
      setProgress(0)
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-blue-200 bg-blue-50/50 cursor-pointer hover:border-blue-400 ">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
              <FileType className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-sm">Produtos</p>
              <p className="text-xs text-muted-foreground">Cadastro base</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-blue-600 ml-auto opacity-100" />
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:border-gray-300 ">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 bg-accent text-muted-foreground rounded-full flex items-center justify-center">
              <FileType className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-sm">Estoque</p>
              <p className="text-xs text-muted-foreground">Quantidades e Custos</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-blue-600 ml-auto opacity-100" />
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-gray-300  opacity-50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 bg-accent text-muted-foreground rounded-full flex items-center justify-center">
              <FileType className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-sm">Inventários</p>
              <p className="text-xs text-muted-foreground">Em breve</p>
            </div>
          </CardContent>
        </Card>
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
          {isProcessing ? (
            <div className="w-full max-w-sm mt-4 mb-6 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progresso</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500   ease-out" 
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Suportamos arquivos .xls e .xlsx. A planilha deve conter as colunas: Material, Especificação, Unidade, Quantidade, Pr. Unitário, Estq.Mínimo.
            </p>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".xls,.xlsx" 
            onChange={handleFileChange}
            disabled={isProcessing}
          />
          <Button 
            disabled={isProcessing} 
            onClick={() => fileInputRef.current?.click()}
          >
            Selecionar arquivo do computador
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
