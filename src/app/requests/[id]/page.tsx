import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {  CheckCircle, XCircle, Package, Play } from "lucide-react"
import Link from "next/link"
import { approveRequestAction, rejectRequestAction, startSeparationAction, cancelRequestAction } from "../actions"
import { CancelRequestButton } from "./cancel-button"
import { BackButton } from "@/components/ui/back-button"
import { requireAnyPermissionPage } from "@/lib/permissions"

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAnyPermissionPage('REQUEST_CREATE', 'REQUEST_APPROVE', 'REQUEST_FULFILL')
  const { id } = await params
  
  const req = await db.materialRequest.findUnique({
    where: { id },
    include: {
      requester: true,
      warehouse: true,
      approvedBy: true,
      items: {
        include: {
          product: { select: { code: true, name: true } },
          unit: true
        }
      }
    }
  })

  if (!req) notFound()

  let statusColor = "default"
  let statusLabel = req.status
  if (req.status === 'DRAFT') { statusColor = "secondary"; statusLabel = "Rascunho" }
  if (req.status === 'PENDING_APPROVAL') { statusColor = "warning"; statusLabel = "Aguardando Aprovação" }
  if (req.status === 'APPROVED') { statusColor = "success"; statusLabel = "Aprovado" }
  if (req.status === 'IN_SEPARATION') { statusColor = "default"; statusLabel = "Em Separação" }
  if (req.status === 'PARTIALLY_FULFILLED') { statusColor = "default"; statusLabel = "Parcialmente Atendido" }
  if (req.status === 'FULFILLED') { statusColor = "outline"; statusLabel = "Atendido" }
  if (req.status === 'REJECTED' || req.status === 'CANCELLED') { statusColor = "destructive"; statusLabel = req.status === 'REJECTED' ? 'Rejeitado' : 'Cancelado' }

  const approveAction = approveRequestAction.bind(null, req.id)
  const rejectAction = rejectRequestAction.bind(null, req.id, "Rejeitado pelo gestor")
  const separationAction = startSeparationAction.bind(null, req.id)
  const cancelAction = cancelRequestAction.bind(null, req.id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight">Requisição {req.requestNumber}</h2>
              {/* @ts-expect-error: variant typing string mismatch */}
              <Badge variant={statusColor}>{statusLabel}</Badge>
            </div>
            <p className="text-muted-foreground">
              Solicitado por {req.requester.name} em {req.requestedAt ? new Date(req.requestedAt).toLocaleDateString('pt-BR') : '-'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {req.status === 'PENDING_APPROVAL' && (
            <>
              <form action={rejectAction}>
                <Button variant="destructive" className="flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Rejeitar
                </Button>
              </form>
              <form action={approveAction}>
                <Button className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <CheckCircle className="h-4 w-4" />
                  Aprovar
                </Button>
              </form>
            </>
          )}
          {req.status === 'APPROVED' && (
            <form action={separationAction}>
              <Button className="flex items-center gap-2 bg-primary hover:bg-primary text-white">
                <Play className="h-4 w-4" />
                Iniciar Separação
              </Button>
            </form>
          )}
          {['IN_SEPARATION', 'PARTIALLY_FULFILLED'].includes(req.status) && (
            <Link href={`/requests/${req.id}/fulfillment`}>
              <Button className="flex items-center gap-2 bg-primary hover:bg-primary text-white">
                <Package className="h-4 w-4" />
                Continuar Separação / Entrega
              </Button>
            </Link>
          )}
          {['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_SEPARATION'].includes(req.status) && (
            <CancelRequestButton cancelAction={cancelAction} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Itens Solicitados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {req.items.map(item => (
                <div key={item.id} className="flex justify-between items-center border p-4 rounded-md">
                  <div>
                    <h4 className="font-medium text-foreground">{item.product.code} - {item.product.name}</h4>
                    <p className="text-sm text-muted-foreground">Unidade: {item.unit.code}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{Number(item.requestedQuantity)}</div>
                    <p className="text-xs text-muted-foreground">Qtd Solicitada</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Detalhes da Requisição</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Almoxarifado Destino</p>
                <p className="font-medium">{req.warehouse.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Prioridade</p>
                <p className="font-medium">
                  {req.priority === 'LOW' ? 'Baixa' : req.priority === 'NORMAL' ? 'Normal' : req.priority === 'HIGH' ? 'Alta' : 'Urgente'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Observações</p>
                <p className="font-medium">{req.notes || '-'}</p>
              </div>
              {req.approvedBy && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">Aprovado por</p>
                  <p className="font-medium">{req.approvedBy.name}</p>
                  <p className="text-xs text-muted-foreground">{req.approvedAt ? new Date(req.approvedAt).toLocaleString('pt-BR') : ''}</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Progresso do Atendimento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {req.items.map(item => (
                  <div key={item.id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="truncate max-w-[150px]">{item.product.code}</span>
                      <span className="font-medium text-emerald-600">{Number(item.deliveredQuantity)} / {Number(item.approvedQuantity)}</span>
                    </div>
                    <div className="w-full bg-accent rounded-full h-2">
                      <div 
                        className="bg-emerald-500 h-2 rounded-full" 
                        style={{ width: `${Number(item.approvedQuantity) > 0 ? (Number(item.deliveredQuantity) / Number(item.approvedQuantity)) * 100 : 0}%` }}
                      ></div>
                    </div>
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
