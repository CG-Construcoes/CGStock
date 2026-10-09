import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Filter, MoreHorizontal } from "lucide-react"
import Link from "next/link"
import { db } from "@/lib/db"
import { SearchInput } from "@/components/ui/search-input"
import { formatCurrency } from "@/lib/utils"

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const resolvedParams = await searchParams
  const q = resolvedParams?.q || ''
  const receipts = await db.stockReceipt.findMany({
    where: q ? { OR: [{ documentNumber: { contains: q, mode: 'insensitive' } }, { supplier: { name: { contains: q, mode: 'insensitive' } } }] } : undefined,
    include: {
      supplier: true,
      warehouse: true,
      _count: { select: { items: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Entradas de Materiais</h2>
          <p className="text-muted-foreground">Acompanhe e registre o recebimento de mercadorias no estoque.</p>
        </div>
        <Link href="/receipts/new">
          <Button className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4" />
            Nova Entrada
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-card  p-4 rounded-md border border-border shadow-sm">
        <SearchInput placeholder="Buscar por número do documento ou fornecedor..." />
        <div className="flex gap-2">
          <Button variant="outline" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </Button>
        </div>
      </div>

      <div className="bg-card  rounded-md border border-[#5C3310]/50 shadow-sm  overflow-hidden  ">
        {/* Mobile View: Cards */}
        <div className="md:hidden divide-y divide-[#5C3310]/50">
          {receipts.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              Nenhuma entrada registrada ainda.
            </div>
          ) : (
            receipts.map((receipt) => (
              <div key={receipt.id} className="p-4 space-y-3 bg-card hover:bg-muted/30 ">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Num: {receipt.documentNumber || 'S/N'}
                    </span>
                    <span className="font-bold text-base text-foreground leading-tight">
                      {receipt.supplier.name}
                    </span>
                  </div>
                  <Badge variant={receipt.status === 'COMPLETED' ? 'success' : receipt.status === 'DRAFT' ? 'outline' : 'secondary'} className="text-[10px]">
                    {receipt.status === 'COMPLETED' ? 'Concluída' : receipt.status === 'DRAFT' ? 'Rascunho' : 'Cancelada'}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground block">Data</span>
                    <span className="font-medium text-foreground">
                      {receipt.documentDate ? new Date(receipt.documentDate).toLocaleDateString('pt-BR') : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Valor</span>
                    <span className="font-medium text-emerald-600">
                      {receipt.total ? formatCurrency(receipt.total) : '-'}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{receipt._count.items}</span> itens
                  </div>
                  <Link href={`/receipts/${receipt.id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4 text-primary" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Almoxarifado</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-center">Itens</TableHead>
              <TableHead className="text-right">Valor Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receipts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  Nenhuma entrada registrada ainda.
                </TableCell>
              </TableRow>
            ) : (
              receipts.map((receipt) => (
                <TableRow key={receipt.id}>
                  <TableCell className="font-medium text-foreground">{receipt.documentNumber || 'Sem Num.'}</TableCell>
                  <TableCell>{receipt.supplier.name}</TableCell>
                  <TableCell className="text-muted-foreground">{receipt.warehouse.name}</TableCell>
                  <TableCell>
                    {receipt.documentDate ? new Date(receipt.documentDate).toLocaleDateString('pt-BR') : '-'}
                  </TableCell>
                  <TableCell className="text-center">{receipt._count.items}</TableCell>
                  <TableCell className="text-right font-medium">
                    {receipt.total ? formatCurrency(receipt.total) : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={receipt.status === 'COMPLETED' ? 'success' : receipt.status === 'DRAFT' ? 'outline' : 'secondary'}>
                      {receipt.status === 'COMPLETED' ? 'Concluída' : receipt.status === 'DRAFT' ? 'Rascunho' : 'Cancelada'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/receipts/${receipt.id}`}>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </div>
    </div>
  )
}
