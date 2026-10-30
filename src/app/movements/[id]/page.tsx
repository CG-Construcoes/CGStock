import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {  Clock, ArrowRight, User, Package, FileText, Link as LinkIcon } from "lucide-react"
import Link from "next/link"
import { BackButton } from "@/components/ui/back-button"
import { getMovementTypeLabel, isInMovement } from "@/lib/movement-labels"
import { requirePermissionPage } from "@/lib/permissions"
import { getValidatedSession } from "@/lib/auth"
import { assertWarehouseAccess } from "@/lib/dal"

export default async function MovementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage('STOCK_VIEW')
  const { id } = await params
  
  const mov = await db.stockMovement.findUnique({
    where: { id },
    include: {
      product: { include: { unit: true, category: true } },
      location: { include: { warehouse: true } },
      performedBy: true,
      recipientUser: true
    }
  })

  if (!mov) notFound()
  await assertWarehouseAccess(mov.warehouseId, (await getValidatedSession())!.userId)

  const isPositive = isInMovement(mov.type)
  const typeLabel = getMovementTypeLabel(mov.type, mov.referenceType)

  // Resolução de link do documento de origem
  let originLink = null
  let originLabel = "Não aplicável / Não registrado"
  
  if (mov.referenceType === 'RECEIPT') {
    originLink = `/receipts/${mov.referenceId}`
    originLabel = "Recebimento de Mercadoria"
  } else if (mov.referenceType === 'MATERIAL_REQUEST') {
    originLink = `/requests/${mov.referenceId}`
    originLabel = "Requisição de Material"
  } else if (mov.referenceType === 'INVENTORY_ADJUSTMENT') {
    originLink = `/inventory/${mov.referenceId}`
    originLabel = "Ajuste de Inventário / Divergência"
  } else if (mov.referenceType === 'TRANSFER') {
    originLink = `/transfers/${mov.referenceId}`
    originLabel = "Transferência entre Almoxarifados"
  } else if (mov.referenceType === 'QUICK_ISSUE') {
    originLabel = "Entrega Rápida (saída por QR/matricula)"
  } else if (mov.referenceType === 'TOOL_LOAN') {
    originLink = `/tool-loans`
    originLabel = "Cautela Diária (empréstimo de ferramenta/material)"
  } else if (mov.referenceType === 'TOOL_LOAN_RETURN') {
    originLink = `/tool-loans`
    originLabel = "Cautela Diária (devolução de ferramenta/material)"
  } else if (mov.referenceType === 'INFORMAKON') {
    originLabel = `Sincronização Informakon (${mov.documentNumber ?? 'documento ERP'})`
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight">Detalhes da Movimentação</h2>
              <Badge variant={isPositive ? 'success' : 'destructive'}>{typeLabel}</Badge>
            </div>
            <p className="text-muted-foreground font-mono text-sm mt-1">{mov.id}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase flex items-center gap-2">
              <Clock className="h-4 w-4" /> Registro Temporal
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="font-semibold text-lg">{new Date(mov.createdAt).toLocaleString('pt-BR')}</p>
            <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
              <User className="h-4 w-4" /> Executado por: <span className="font-medium text-foreground">{mov.performedBy.name}</span>
            </p>
            {mov.recipientUser && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <User className="h-4 w-4" />
                {isPositive ? 'Devolvido por' : 'Entregue para'}:
                <span className="font-medium text-foreground">{mov.recipientUser.name}</span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase flex items-center gap-2">
              <FileText className="h-4 w-4" /> Rastreabilidade (Origem)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Documento Referência</p>
              <p className="font-semibold">{mov.documentNumber || 'S/N'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Processo de Origem</p>
              <div className="flex items-center gap-2">
                <span className="font-medium">{originLabel}</span>
                {originLink && (
                  <Link href={originLink}>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs flex gap-1">
                      <LinkIcon className="h-3 w-3" /> Ver Origem
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 shadow-sm border-l-4 border-l-primary">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase flex items-center gap-2">
              <Package className="h-4 w-4" /> Mercadoria Movimentada
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground">Produto</p>
              <Link href={`/products/${mov.productId}`} className="hover:underline">
                <p className="font-bold text-xl text-primary">{mov.product.code} - {mov.product.name}</p>
              </Link>
              <div className="flex gap-4 mt-2">
                <Badge variant="outline">{mov.product.category.name}</Badge>
                <span className="text-sm text-muted-foreground">Unidade: {mov.product.unit.code}</span>
              </div>
            </div>
            
            <div className="flex flex-col justify-center items-end border-l pl-6">
              <p className="text-sm text-muted-foreground mb-1">Quantidade</p>
              <div className={`text-4xl font-black flex items-center ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                {isPositive ? '+' : '-'}{Math.abs(Number(mov.quantity)).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase flex items-center gap-2">
              <ArrowRight className="h-4 w-4" /> Localização no Estoque
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Almoxarifado / Filial</p>
                <p className="font-semibold text-lg">{mov.location.warehouse.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Localização / Posição</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="font-mono text-sm">{mov.location.code}</Badge>
                  <span className="font-medium">{mov.location.name}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {(mov.reason || mov.notes) && (
          <Card className="md:col-span-2 shadow-sm bg-muted/10">
            <CardContent className="pt-6 space-y-4">
              {mov.reason && (
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Motivo Registrado:</p>
                  <p className="italic text-foreground mt-1">&quot;{mov.reason}&quot;</p>
                </div>
              )}
              {mov.notes && (
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Observações Técnicas:</p>
                  <p className="text-foreground mt-1 whitespace-pre-wrap">{mov.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
