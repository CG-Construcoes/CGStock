import { db } from "@/lib/db"
import { warehouseIdFilter } from "@/lib/dal"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {  Smartphone, Play, StopCircle, FileText } from "lucide-react"
import Link from "next/link"
import { finishInventoryAction, deleteInventoryAction } from "../actions"
import { BackButton } from "@/components/ui/back-button"
import { DeleteInventoryButton } from "./delete-button"
import { requireAnyPermissionPage } from "@/lib/permissions"

export default async function InventoryDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAnyPermissionPage('INVENTORY_CREATE', 'INVENTORY_COUNT', 'INVENTORY_REVIEW', 'INVENTORY_APPROVE')
  const { id } = await params
  
  const inv = await db.inventory.findFirst({
    where: { id, ...await warehouseIdFilter() },
    include: {
      warehouse: true,
      createdBy: true,
      finishedBy: true,
      locations: {
        include: { location: true }
      },
      operators: {
        include: { user: true }
      },
      collections: {
        include: { operator: true, location: true, _count: { select: { items: true } } }
      }
    }
  })

  if (!inv) notFound()

  let statusVariant = "default"
  let statusLabel = inv.status
  if (inv.status === 'IN_PROGRESS' || inv.status === 'COUNTING') { statusVariant = "default"; statusLabel = "Em Andamento" }
  if (inv.status === 'CONFERENCE') { statusVariant = "warning"; statusLabel = "Conferência (Divergências)" }
  if (inv.status === 'COMPLETED') { statusVariant = "success"; statusLabel = "Concluído" }

  const completedLocs = inv.locations.filter(l => l.status === 'COMPLETED').length
  const totalLocs = inv.locations.length
  const progress = totalLocs > 0 ? Math.round((completedLocs / totalLocs) * 100) : 0

  const finishAction = finishInventoryAction.bind(null, inv.id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight">{inv.code} - {inv.name}</h2>
              {/* @ts-expect-error: Badge dynamic variant */}
              <Badge variant={statusVariant}>{statusLabel}</Badge>
            </div>
            <p className="text-muted-foreground">
              {inv.warehouse.name} • Criado por {inv.createdBy.name}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {inv.status === 'IN_PROGRESS' && (
            <form action={finishAction}>
              <Button className="flex items-center gap-2 bg-primary hover:bg-primary text-white">
                <StopCircle className="h-4 w-4" />
                Encerrar Coletas
              </Button>
            </form>
          )}
          {['CONFERENCE', 'COMPLETED'].includes(inv.status) && (
            <Link href={`/inventory/${inv.id}/divergences`}>
              <Button variant="outline" className="flex items-center gap-2 text-primary border-primary/20 hover:bg-primary/5">
                <FileText className="h-4 w-4" />
                Analisar Divergências
              </Button>
            </Link>
          )}
          <DeleteInventoryButton deleteAction={deleteInventoryAction} invId={inv.id} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground mb-1">Progresso</div>
            <div className="text-3xl font-bold text-foreground mb-2">{progress}%</div>
            <div className="w-full bg-accent rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground mb-1">Locais Concluídos</div>
            <div className="text-3xl font-bold text-foreground">{completedLocs} <span className="text-lg text-muted-foreground">/ {totalLocs}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground mb-1">Coletas Enviadas</div>
            <div className="text-3xl font-bold text-foreground">{inv.collections.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground mb-1">Duração</div>
            <div className="text-3xl font-bold text-foreground">
              {inv.startedAt ? (
                inv.finishedAt 
                  ? `${Math.max(1, Math.round((new Date(inv.finishedAt).getTime() - new Date(inv.startedAt).getTime()) / 60000))} min`
                  : 'Ativo'
              ) : '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Histórico de Coletas</CardTitle>
          </CardHeader>
          <CardContent>
            {inv.collections.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border rounded-md border-dashed">
                Nenhuma coleta enviada pelos operadores ainda.
              </div>
            ) : (
              <div className="space-y-4">
                {inv.collections.map(col => (
                  <div key={col.id} className="flex justify-between items-center border p-4 rounded-md hover:bg-muted">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-primary/5 rounded-full text-primary">
                        <Smartphone className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground">{col.location.code}</h4>
                        <p className="text-sm text-muted-foreground">Operador: {col.operator.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-foreground">{col._count.items} itens</div>
                      <p className="text-xs text-muted-foreground">{col.startedAt ? new Date(col.startedAt).toLocaleTimeString('pt-BR') : '-'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Locais Mapeados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {inv.locations.map(l => (
                  <div key={l.id} className="flex justify-between items-center text-sm">
                    <span className="font-medium">{l.location.code}</span>
                    {l.status === 'COMPLETED' ? (
                      <Badge variant="success" className="text-xs">Concluído</Badge>
                    ) : l.status === 'IN_PROGRESS' ? (
                      <Badge variant="secondary" className="text-xs"><Play className="w-3 h-3 mr-1 inline" /> Em uso</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Pendente</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Operadores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {inv.operators.map(o => (
                  <div key={o.id} className="flex justify-between items-center text-sm">
                    <span className="font-medium">{o.user.name}</span>
                    <span className="text-xs text-muted-foreground">{o.user.email}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
