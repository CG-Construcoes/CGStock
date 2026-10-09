import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Filter, MoreHorizontal, LogOut } from "lucide-react"
import Link from "next/link"
import { db } from "@/lib/db"
import { SearchInput } from "@/components/ui/search-input"

export default async function IssuesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const resolvedParams = await searchParams
  const q = resolvedParams?.q || ''
  const issues = await db.materialRequest.findMany({
    where: {
      status: {
        in: ['PARTIALLY_FULFILLED', 'FULFILLED']
      },
      ...(q ? { OR: [{ requestNumber: { contains: q, mode: 'insensitive' } }, { requester: { name: { contains: q, mode: 'insensitive' } } }] } : {})
    },
    include: {
      requester: true,
      warehouse: true,
      _count: { select: { items: true } },
      items: {
        where: { deliveredQuantity: { gt: 0 } },
        select: { deliveredQuantity: true }
      }
    },
    orderBy: { fulfilledAt: 'desc' }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <LogOut className="h-6 w-6" /> Saídas de Materiais
          </h2>
          <p className="text-muted-foreground">Consulte o histórico de materiais que saíram do almoxarifado via requisição.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-card  p-4 rounded-md border border-border shadow-sm">
        <SearchInput placeholder="Buscar por número da requisição ou solicitante..." />
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
          {issues.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              Nenhuma saída registrada ainda.
            </div>
          ) : (
            issues.map((issue) => {
              const totalDelivered = issue.items.reduce((sum, item) => sum + item.deliveredQuantity, 0)
              
              return (
                <div key={issue.id} className="p-4 space-y-3 bg-card hover:bg-muted/30 ">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-muted-foreground uppercase">
                        Req: {issue.requestNumber}
                      </span>
                      <span className="font-bold text-base text-foreground leading-tight">
                        {issue.requester.name}
                      </span>
                    </div>
                    <Badge variant={issue.status === 'FULFILLED' ? 'success' : 'default'} className="text-[10px]">
                      {issue.status === 'FULFILLED' ? 'Completa' : 'Parcial'}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground block">Data</span>
                      <span className="font-medium text-foreground">
                        {issue.fulfilledAt ? new Date(issue.fulfilledAt).toLocaleDateString('pt-BR') : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Almoxarifado</span>
                      <span className="font-medium text-foreground">
                        {issue.warehouse.name}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-medium text-emerald-600">-{totalDelivered}</span> itens
                    </div>
                    <Link href={`/issues/${issue.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4 text-primary" />
                      </Button>
                    </Link>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número (Origem)</TableHead>
              <TableHead>Data da Saída</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead>Almoxarifado</TableHead>
              <TableHead className="text-center">Total Itens Retirados</TableHead>
              <TableHead>Status Entrega</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {issues.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  Nenhuma saída registrada ainda.
                </TableCell>
              </TableRow>
            ) : (
              issues.map((issue) => {
                const totalDelivered = issue.items.reduce((sum, item) => sum + item.deliveredQuantity, 0)
                
                return (
                  <TableRow key={issue.id}>
                    <TableCell className="font-medium">
                      <Link href={`/requests/${issue.id}`} className="hover:underline text-blue-600">
                        {issue.requestNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{issue.fulfilledAt ? new Date(issue.fulfilledAt).toLocaleDateString('pt-BR') : '-'}</TableCell>
                    <TableCell>{issue.requester.name}</TableCell>
                    <TableCell>{issue.warehouse.name}</TableCell>
                    <TableCell className="text-center font-semibold">{totalDelivered}</TableCell>
                    <TableCell>
                      <Badge variant={issue.status === 'FULFILLED' ? 'success' : 'default'}>
                        {issue.status === 'FULFILLED' ? 'Completa' : 'Parcial'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/issues/${issue.id}`}>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
        </div>
      </div>
    </div>
  )
}
