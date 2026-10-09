"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react"
import { BackButton } from "@/components/ui/back-button"
import { exportToCSV, exportToExcel, exportToPDF } from "@/lib/export-utils"
import { exportProductsData, exportStockData, exportMovementsData, getInventoriesList, exportInventoryData } from "./actions"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type ExportFormat = 'csv' | 'xlsx' | 'pdf'

export default function ExportPage() {
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({})
  const [inventories, setInventories] = useState<{ id: string; name: string }[]>([])
  const [selectedInventory, setSelectedInventory] = useState<string>("")
  const [formatMap, setFormatMap] = useState<Record<string, 'csv' | 'xlsx'>>({
    products: 'xlsx',
    stock: 'xlsx',
    movements: 'xlsx',
    inventory: 'xlsx'
  })

  useEffect(() => {
    getInventoriesList().then(setInventories).catch(console.error)
  }, [])

  const handleExport = async (type: string, format: ExportFormat) => {
    try {
      setLoadingMap(prev => ({ ...prev, [`${type}_${format}`]: true }))
      
      let data: Record<string, unknown>[] = []
      let title = ""
      let filename = ""

      if (type === 'products') {
        data = await exportProductsData()
        title = "CADASTRO DE PRODUTOS"
        filename = `CGSTOCK_Produtos_${new Date().toISOString().split('T')[0]}`
      } else if (type === 'stock') {
        data = await exportStockData()
        title = "POSIÇÃO DE ESTOQUE"
        filename = `CGSTOCK_Estoque_${new Date().toISOString().split('T')[0]}`
      } else if (type === 'movements') {
        data = await exportMovementsData()
        title = "HISTÓRICO DE MOVIMENTAÇÕES"
        filename = `CGSTOCK_Movimentacoes_${new Date().toISOString().split('T')[0]}`
      } else if (type === 'inventory') {
        if (!selectedInventory) throw new Error("Selecione um inventário primeiro.")
        const invData = await exportInventoryData(selectedInventory)
        data = invData.data
        title = `RESULTADOS DE INVENTÁRIO - ${invData.name}`
        filename = `CGSTOCK_Inventario_${invData.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`
      }

      if (!data || data.length === 0) {
        throw new Error("Não há dados para exportar.")
      }

      if (format === 'csv') {
        exportToCSV(data, filename)
      } else if (format === 'xlsx') {
        exportToExcel(data, filename)
      } else if (format === 'pdf') {
        exportToPDF(data, title, filename)
      }
      
      toast.success("Download iniciado com sucesso.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao gerar exportação. Tente novamente.")
    } finally {
      setLoadingMap(prev => ({ ...prev, [`${type}_${format}`]: false }))
    }
  }

  const setFormat = (type: string, f: 'csv' | 'xlsx') => {
    setFormatMap(prev => ({ ...prev, [type]: f }))
  }

  const renderFormatSelector = (type: string) => {
    const isXlsx = formatMap[type] === 'xlsx'
    return (
      <div className="mb-4">
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-widest">Formato da Planilha:</p>
        <div className="flex bg-muted/30 p-1 rounded-md border border-border">
          <button 
            onClick={() => setFormat(type, 'xlsx')}
            className={cn("flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-sm transition-colors", isXlsx ? "bg-background shadow-sm border border-border text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            Excel (.xlsx)
          </button>
          <button 
            onClick={() => setFormat(type, 'csv')}
            className={cn("flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-sm transition-colors", !isXlsx ? "bg-background shadow-sm border border-border text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            CSV (.csv)
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-4 border-b border-border pb-4">
        <BackButton />
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Exportar Dados</h2>
          <p className="text-sm text-muted-foreground mt-1">Gere relatórios completos em PDF ou exporte os dados para planilhas.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* PRODUTOS */}
        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle className="text-lg">Cadastro de Produtos</CardTitle>
            <CardDescription>Catálogo completo com categorias e limites.</CardDescription>
          </CardHeader>
          <CardContent>
            {renderFormatSelector('products')}
            <div className="flex gap-3">
              <Button 
                onClick={() => handleExport('products', formatMap['products'])} 
                disabled={loadingMap[`products_${formatMap['products']}`]} 
                className="flex-1 bg-[#5C3310] hover:bg-[#5C3310]/90 text-[#FDEFD6]"
              >
                {loadingMap[`products_${formatMap['products']}`] ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                Exportar Planilha
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ESTOQUE */}
        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle className="text-lg">Posição de Estoque</CardTitle>
            <CardDescription>Quantidades atuais, locais e almoxarifados.</CardDescription>
          </CardHeader>
          <CardContent>
            {renderFormatSelector('stock')}
            <div className="flex flex-col gap-3">
              <Button 
                onClick={() => handleExport('stock', formatMap['stock'])} 
                disabled={loadingMap[`stock_${formatMap['stock']}`]} 
                className="w-full bg-[#5C3310] hover:bg-[#5C3310]/90 text-[#FDEFD6]"
              >
                {loadingMap[`stock_${formatMap['stock']}`] ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                Exportar Planilha
              </Button>
              <Button 
                onClick={() => handleExport('stock', 'pdf')} 
                disabled={loadingMap['stock_pdf']} 
                variant="outline" 
                className="w-full"
              >
                {loadingMap['stock_pdf'] ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2 text-red-500" />}
                Gerar PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* MOVIMENTACOES */}
        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Movimentações</CardTitle>
            <CardDescription>Todas as entradas, saídas e ajustes.</CardDescription>
          </CardHeader>
          <CardContent>
            {renderFormatSelector('movements')}
            <div className="flex flex-col gap-3">
              <Button 
                onClick={() => handleExport('movements', formatMap['movements'])} 
                disabled={loadingMap[`movements_${formatMap['movements']}`]} 
                className="w-full bg-[#5C3310] hover:bg-[#5C3310]/90 text-[#FDEFD6]"
              >
                {loadingMap[`movements_${formatMap['movements']}`] ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                Exportar Planilha
              </Button>
              <Button 
                onClick={() => handleExport('movements', 'pdf')} 
                disabled={loadingMap['movements_pdf']} 
                variant="outline" 
                className="w-full"
              >
                {loadingMap['movements_pdf'] ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2 text-red-500" />}
                Gerar PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* INVENTARIOS */}
        <Card className="shadow-sm border-border flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg">Resultados de Inventário</CardTitle>
            <CardDescription>Relatório final de contagens com divergências.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-end">
            <div className="mb-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-widest">Selecionar Inventário:</p>
              <select 
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                value={selectedInventory}
                onChange={(e) => setSelectedInventory(e.target.value)}
              >
                <option value="">Selecione...</option>
                {inventories.map(inv => (
                  <option key={inv.id} value={inv.id}>{inv.name}</option>
                ))}
              </select>
            </div>
            
            {renderFormatSelector('inventory')}
            
            <div className="flex flex-col gap-3">
              <Button 
                onClick={() => handleExport('inventory', formatMap['inventory'])} 
                disabled={!selectedInventory || loadingMap[`inventory_${formatMap['inventory']}`]} 
                className="w-full bg-[#5C3310] hover:bg-[#5C3310]/90 text-[#FDEFD6]"
              >
                {loadingMap[`inventory_${formatMap['inventory']}`] ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                Exportar Planilha
              </Button>
              <Button 
                onClick={() => handleExport('inventory', 'pdf')} 
                disabled={!selectedInventory || loadingMap['inventory_pdf']} 
                variant="outline" 
                className="w-full"
              >
                {loadingMap['inventory_pdf'] ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2 text-red-500" />}
                Gerar PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
