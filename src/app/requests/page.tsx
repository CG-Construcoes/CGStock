import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Filter, MoreHorizontal } from "lucide-react"
import Link from "next/link"
import { db } from "@/lib/db"
import { warehouseIdFilter } from "@/lib/dal"
import { SearchInput } from "@/components/ui/search-input"
import { hasPermission, requireAnyPermissionPage } from "@/lib/permissions"

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAnyPermissionPage('REQUEST_CREATE', 'REQUEST_APPROVE', 'REQUEST_FULFILL')
  const canCreate = await hasPermission('REQUEST_CREATE')
  const resolvedParams = await searchParams
  const q = resolvedParams?.q || ''
  const requests = await db.materialRequest.findMany({
    where: { ...await warehouseIdFilter(), ...(q ? { OR: [{ requestNumber: { contains: q, mode: 'insensitive' } }, { requester: { name: { contains: q, mode: 'insensitive' } } }] } : {}) },
    include: {
      requester: true,
      warehouse: true,
      _count: { select: { items: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Requisições de Material</h2>
          <p className="text-muted-foreground">Gerencie solicitações, separação e entregas de materiais.</p>
        </div>
        {canCreate && (
          <Link href="/requests/new">
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nova Requisição
            </Button>
          </Link>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-card  p-4 rounded-md border border-border shadow-sm">
        <SearchInput placeholder="Buscar por número ou solicitante..." />
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
          {requests.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              Nenhuma requisição encontrada.
            </div>
          ) : (
            requests.map((req) => {
              let statusColor = "default"
              let statusLabel = req.status
              if (req.status === 'DRAFT') { statusColor = "secondary"; statusLabel = "Rascunho" }
              if (req.status === 'PENDING_APPROVAL') { statusColor = "warning"; statusLabel = "Pendente" }
              if (req.status === 'APPROVED') { statusColor = "success"; statusLabel = "Aprovado" }
              if (req.status === 'IN_SEPARATION') { statusColor = "default"; statusLabel = "Em Separação" }
              if (req.status === 'PARTIALLY_FULFILLED') { statusColor = "default"; statusLabel = "Parcial" }
              if (req.status === 'FULFILLED') { statusColor = "outline"; statusLabel = "Atendido" }
              if (req.status === 'REJECTED' || req.status === 'CANCELLED') { statusColor = "destructive"; statusLabel = req.status === 'REJECTED' ? 'Rejeitado' : 'Cancelado' }

              let prioColor = "text-muted-foreground"
              if (req.priority === 'HIGH') prioColor = "text-orange-500 font-semibold"
              if (req.priority === 'URGENT') prioColor = "text-red-600 font-bold"

              return (
                <div key={req.id} className="p-4 space-y-3 bg-card hover:bg-muted/30 ">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-muted-foreground uppercase">
                        Req: {req.requestNumber}
                      </span>
                      <span className="font-bold text-base text-foreground leading-tight">
                        {req.requester.name}
                      </span>
                    </div>
                    {/* @ts-expect-error: Badge variant */}
                    <Badge variant={statusColor} className="text-[10px]">
                      {statusLabel}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground block">Data</span>
                      <span className="font-medium text-foreground">
                        {req.requestedAt ? new Date(req.requestedAt).toLocaleDateString('pt-BR') : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Prioridade</span>
                      <span className={`font-medium ${prioColor}`}>
                        {req.priority === 'LOW' ? 'Baixa' : req.priority === 'NORMAL' ? 'Normal' : req.priority === 'HIGH' ? 'Alta' : 'Urgente'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{req._count.items}</span> itens
                    </div>
                    <Link href={`/requests/${req.id}`}>
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
              <TableHead>Número</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead>Almoxarifado</TableHead>
              <TableHead className="text-center">Itens</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  Nenhuma requisição encontrada.
                </TableCell>
              </TableRow>
            ) : (
              requests.map((req) => {
                let statusColor = "default"
                let statusLabel = req.status
                if (req.status === 'DRAFT') { statusColor = "secondary"; statusLabel = "Rascunho" }
                if (req.status === 'PENDING_APPROVAL') { statusColor = "warning"; statusLabel = "Pendente" }
                if (req.status === 'APPROVED') { statusColor = "success"; statusLabel = "Aprovado" }
                if (req.status === 'IN_SEPARATION') { statusColor = "default"; statusLabel = "Em Separação" }
                if (req.status === 'PARTIALLY_FULFILLED') { statusColor = "default"; statusLabel = "Parcial" }
                if (req.status === 'FULFILLED') { statusColor = "outline"; statusLabel = "Atendido" }
                if (req.status === 'REJECTED' || req.status === 'CANCELLED') { statusColor = "destructive"; statusLabel = req.status === 'REJECTED' ? 'Rejeitado' : 'Cancelado' }

                let prioColor = "text-muted-foreground"
                if (req.priority === 'HIGH') prioColor = "text-orange-500 font-semibold"
                if (req.priority === 'URGENT') prioColor = "text-red-600 font-bold"

                return (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">
                      <Link href={`/requests/${req.id}`} className="hover:underline text-blue-600">
                        {req.requestNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{req.requestedAt ? new Date(req.requestedAt).toLocaleDateString('pt-BR') : '-'}</TableCell>
                    <TableCell>{req.requester.name}</TableCell>
                    <TableCell>{req.warehouse.name}</TableCell>
                    <TableCell className="text-center">{req._count.items}</TableCell>
                    <TableCell>
                      {/* @ts-expect-error: Badge variant accepts dynamic string mapping here although TS complains */}
                      <Badge variant={statusColor}>{statusLabel}</Badge>
                    </TableCell>
                    <TableCell className={prioColor}>
                      {req.priority === 'LOW' ? 'Baixa' : req.priority === 'NORMAL' ? 'Normal' : req.priority === 'HIGH' ? 'Alta' : 'Urgente'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/requests/${req.id}`}>
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
