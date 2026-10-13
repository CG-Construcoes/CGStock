import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, AlertTriangle, ArrowRightLeft, FileText, Smartphone, RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"
import Link from "next/link"
import { DashboardCharts } from "./charts"
import { getValidatedSession, type SessionPayload } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getMovementTypeLabel, isInMovement } from "@/lib/movement-labels"
import { warehouseScopeIds, warehouseIdFilter } from "@/lib/dal"
import { QRCodeBadge } from "@/components/ui/qr-code-badge"
import { Button } from "@/components/ui/button"
import { QrCode, ClipboardList } from "lucide-react"

async function RequesterDashboard({ user, qrToken }: { user: SessionPayload, qrToken: string | null }) {
  const recentRequests = await db.materialRequest.findMany({
    where: { requesterId: user.userId, ...await warehouseIdFilter(user.userId) },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      _count: { select: { items: true } }
    }
  })

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4">
      <div className="text-center space-y-4 mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Olá, {user.name.split(' ')[0]}!
        </h1>
        <p className="text-muted-foreground font-medium">
          Bem-vindo ao seu painel. Mostre o QR Code abaixo ao almoxarife para retiradas rápidas.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* QR Code Card */}
        <Card className="border-primary/20 shadow-sm     dark: dark:">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-lg flex justify-center items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Seu Crachá Digital
            </CardTitle>
            <CardDescription>Para uso na Entrega Rápida</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-6">
            {qrToken ? (
              <QRCodeBadge 
                userId={user.userId} 
                userName={user.name} 
                qrToken={qrToken} 
                className="scale-110 shadow-sm border-none" 
              />
            ) : (
              <div className="text-center p-6 bg-muted/50 rounded-md border border-dashed">
                <p className="text-sm text-muted-foreground">Você ainda não possui um QR Code de retirada.</p>
                <p className="text-xs text-muted-foreground mt-2">Solicite ao gestor.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Requests Card */}
        <div className="space-y-4">
          <Card className="h-full shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
              <div>
                <CardTitle className="text-lg">Minhas Requisições</CardTitle>
                <CardDescription>Acompanhe seus pedidos</CardDescription>
              </div>
              <Link href="/requests/new">
                <Button size="sm" className="bg-primary hover:bg-primary">Nova Requisição</Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {recentRequests.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  Nenhuma requisição recente.
                </div>
              ) : (
                <div className="divide-y">
                  {recentRequests.map(req => (
                    <div key={req.id} className="p-4 flex items-center justify-between hover:bg-muted/30 ">
                      <div className="space-y-1">
                        <Link href={`/requests/${req.id}`} className="font-bold hover:text-primary ">
                          {req.requestNumber}
                        </Link>
                        <div className="flex items-center text-xs text-muted-foreground gap-2">
                          <span className="flex items-center"><ClipboardList className="h-3 w-3 mr-1"/> {req._count.items} itens</span>
                          <span>•</span>
                          <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Badge variant={req.status === 'FULFILLED' ? 'default' : req.status === 'DRAFT' ? 'outline' : 'secondary'}
                        className={req.status === 'FULFILLED' ? 'bg-emerald-500' : req.status === 'PENDING_APPROVAL' ? 'bg-amber-500' : ''}>
                        {req.status === 'PENDING_APPROVAL' ? 'Aguardando' : req.status === 'FULFILLED' ? 'Atendida' : req.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const session = await getValidatedSession()
  if (!session) redirect("/login")
  const roles = session.roles || []
  
  const isRequesterOnly = roles.includes('SOLICITANTE') && !roles.some(r => ['ADMIN', 'GESTOR', 'ALMOXARIFE'].includes(r))
  
  if (isRequesterOnly && session) {
    const user = await db.user.findUnique({ where: { id: session.userId }, select: { qrToken: true } })
    return <RequesterDashboard user={session} qrToken={user?.qrToken || null} />
  }

  // Agrega entradas e saídas dos últimos 30 dias diretamente no banco
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  type ChartRow = { day: Date, type: string, total: number }

  const wFilter = await warehouseIdFilter(session.userId)
  const scopeIds = await warehouseScopeIds(session.userId)

  const divPendingWhere: Prisma.InventoryDivergenceWhereInput = { status: 'PENDING' }
  const divReviewedWhere: Prisma.InventoryDivergenceWhereInput = { status: 'REVIEWED' }
  if (wFilter) {
    divPendingWhere.inventory = { warehouseId: wFilter.warehouseId }
    divReviewedWhere.inventory = { warehouseId: wFilter.warehouseId }
  }

  const trWhere: Prisma.StockTransferWhereInput = { status: 'IN_TRANSIT' }
  if (scopeIds) {
    trWhere.sourceWarehouseId = { in: scopeIds }
    trWhere.destinationWarehouseId = { in: scopeIds }
  }

  let chartQuery
  if (scopeIds?.length === 0) {
    chartQuery = Prisma.sql`SELECT DATE_TRUNC('day', NOW()) AS day, '' AS type, 0::int AS total WHERE FALSE`
  } else if (scopeIds) {
    chartQuery = Prisma.sql`
      SELECT DATE_TRUNC('day', "createdAt") AS day, type, SUM(quantity)::int AS total
      FROM "StockMovement"
      WHERE "createdAt" >= ${thirtyDaysAgo} AND type IN ('ENTRY', 'EXIT') AND "warehouseId" IN (${Prisma.join(scopeIds)})
      GROUP BY 1, 2
      ORDER BY 1
    `
  } else {
    chartQuery = Prisma.sql`
      SELECT DATE_TRUNC('day', "createdAt") AS day, type, SUM(quantity)::int AS total
      FROM "StockMovement"
      WHERE "createdAt" >= ${thirtyDaysAgo} AND type IN ('ENTRY', 'EXIT')
      GROUP BY 1, 2
      ORDER BY 1
    `
  }

  const [
    totalProducts,
    pendingDivergencesCount,
    pendingApprovalsCount,
    inTransitTransfersCount,
    activeInventories,
    recentMovements,
    chartRows
  ] = await Promise.all([
    db.product.count({ where: scopeIds === null ? undefined : { stocks: { some: { warehouseId: { in: scopeIds } } } } }),
    db.inventoryDivergence.count({ where: divPendingWhere }),
    db.inventoryDivergence.count({ where: divReviewedWhere }),
    db.stockTransfer.count({ where: trWhere }),
    db.inventory.findMany({
      where: { status: 'IN_PROGRESS', ...wFilter },
      include: {
        _count: { select: { locations: true } },
        locations: { where: { status: 'COMPLETED' } }
      },
      take: 4
    }),
    db.stockMovement.findMany({
      where: wFilter,
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { product: true }
    }),
    db.$queryRaw<ChartRow[]>(chartQuery)
  ])

  // Prepara dados pro gráfico (os 7 dias mais recentes com movimentação)
  const chartDataMap: Record<string, { name: string, order: number, entradas: number, saidas: number }> = {}
  
  for (const row of chartRows) {
    const d = new Date(row.day)
    const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}`
    
    if (!chartDataMap[dateStr]) {
      chartDataMap[dateStr] = { name: dateStr, order: d.getTime(), entradas: 0, saidas: 0 }
    }
    
    if (row.type === 'ENTRY') {
      chartDataMap[dateStr].entradas += row.total
    } else {
      chartDataMap[dateStr].saidas += Math.abs(row.total)
    }
  }

  const chartData = Object.values(chartDataMap)
    .sort((a, b) => a.order - b.order)
    .slice(-7)
    .map(({ name, entradas, saidas }) => ({ name, entradas, saidas }))

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-md border-border bg-card  shadow-sm  hover:shadow-sm ">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Divergências</CardTitle>
            <div className="bg-amber-100 p-2 rounded-lg">
              <FileText className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{pendingDivergencesCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Pendentes de análise</p>
          </CardContent>
        </Card>
        <Card className="rounded-md border-border bg-card  shadow-sm  hover:shadow-sm ">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Ajustes</CardTitle>
            <div className="bg-blue-100 p-2 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{pendingApprovalsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Aguardando aprovação</p>
          </CardContent>
        </Card>
        <Card className="rounded-md border-border bg-card  shadow-sm  hover:shadow-sm ">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Transferências</CardTitle>
            <div className="bg-emerald-100 p-2 rounded-lg">
              <ArrowRightLeft className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{inTransitTransfersCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Em andamento</p>
          </CardContent>
        </Card>
        <Card className="rounded-md border-border bg-card  shadow-sm  hover:shadow-sm ">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Total de Produtos</CardTitle>
            <div className="bg-slate-100 p-2 rounded-lg">
              <Package className="h-4 w-4 text-slate-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-foreground">{totalProducts}</div>
            <p className="text-xs text-muted-foreground mt-1">Cadastrados na base</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-4 rounded-md border border-border shadow-sm bg-card flex flex-col min-w-0">
          <div className="px-4 sm:px-5 pt-5 pb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/40">
            <div className="flex flex-wrap items-center gap-2 sm:gap-6">
              <h2 className="text-sm font-semibold text-foreground">Entradas vs Saídas</h2>
              <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--chart-entry)]"></span> Entradas
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--chart-exit)]"></span> Saídas
                </div>
              </div>
            </div>
            <Link href="/reports/movements" className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
              Ver relatório →
            </Link>
          </div>
          <div className="px-2 pt-4 pb-4 h-[250px] min-h-[250px] w-full">
            <DashboardCharts data={chartData} />
          </div>
        </Card>

        <Card className="lg:col-span-3 rounded-md border-border shadow-sm flex flex-col min-w-0">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Últimas Movimentações</CardTitle>
            <CardDescription className="mt-1">Entradas, saídas e ajustes recentes no sistema.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="space-y-4">
              {recentMovements.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground bg-muted/30 rounded-md">
                  Nenhuma movimentação.
                </div>
              ) : (
                recentMovements.map(mov => {
                  const isPositive = isInMovement(mov.type)
                  const typeStr = getMovementTypeLabel(mov.type, mov.referenceType)

                  const Icon = mov.type === 'RETURN' ? RotateCcw : ArrowRightLeft

                  return (
                    <div key={mov.id} className="flex min-w-0 items-center justify-between gap-2 border-b border-border pb-4 last:border-0 last:pb-0 hover:bg-muted/20 -mx-2 px-2 rounded-lg py-2">
                      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-md shadow-inner ${
                          isPositive ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                        }`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex min-w-0 flex-col">
                          <span className="break-words text-sm font-bold text-foreground">{mov.product.name}</span>
                          <span className="text-xs font-medium text-muted-foreground mt-0.5">{typeStr} • {new Date(mov.createdAt).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                      <div className={`shrink-0 font-black text-lg ${
                        isPositive ? 'text-success' : 'text-destructive'
                      }`}>
                        {isPositive ? '+' : '-'}{Math.abs(Number(mov.quantity))}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-1">
        <Card className="rounded-md border-border shadow-sm">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-lg font-bold">Inventários Ativos</CardTitle>
                <CardDescription className="mt-1">Acompanhe o progresso das contagens via Coletor.</CardDescription>
              </div>
              <Link href="/inventory" className="text-sm text-primary font-medium hover:underline">
                Ir para Inventários
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeInventories.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground bg-muted/30 rounded-md">
                  Nenhum inventário em andamento no momento.
                </div>
              ) : (
                activeInventories.map(inv => {
                  const completed = inv.locations.length
                  const total = inv._count.locations
                  const progress = total > 0 ? Math.round((completed / total) * 100) : 0

                  return (
                    <div key={inv.id} className="group flex items-center justify-between rounded-md border border-border bg-background/50 p-4   hover:shadow-sm">
                      <div className="flex flex-col space-y-1">
                        <Link href={`/inventory/${inv.id}`} className="font-bold text-foreground group-hover:text-primary ">
                          {inv.name}
                        </Link>
                        <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 mt-1">
                          <Smartphone className="h-3.5 w-3.5 text-primary/70" />
                          Locais: {completed}/{total}
                        </span>
                      </div>
                      <div className="flex flex-col items-end space-y-2">
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">Em Andamento</Badge>
                        <span className="text-sm font-bold text-primary">{progress}% concluído</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
