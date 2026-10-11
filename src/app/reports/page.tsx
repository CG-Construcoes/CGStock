import { requirePermissionPage } from "@/lib/permissions"
import { getValidatedSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { format } from "date-fns"
import Link from "next/link"
import { ArrowLeft, FileText, Search } from "lucide-react"
import { DashboardCharts } from "@/app/dashboard/charts"

import { ReportsHeaderControls, ReportsFilterControls } from "./client-controls"
import { getMovementTypeLabel, isInMovement } from "@/lib/movement-labels"
import { warehouseIdFilter } from "@/lib/dal"

export default async function ReportsHubPage(props: { searchParams: Promise<{ from?: string, to?: string }> }) {
  await requirePermissionPage('REPORT_VIEW')
  const wFilter = await warehouseIdFilter((await getValidatedSession())!.userId)
  const searchParams = await props.searchParams
  const defaultThirtyDaysAgo = new Date()
  defaultThirtyDaysAgo.setDate(defaultThirtyDaysAgo.getDate() - 30)

  const fromDateStr = searchParams.from || defaultThirtyDaysAgo.toISOString().split('T')[0]
  const toDateStr = searchParams.to || new Date().toISOString().split('T')[0]

  const fromDate = new Date(fromDateStr + "T00:00:00")
  const toDate = new Date(toDateStr + "T23:59:59")

  const entradas = await db.stockMovement.count({ where: { type: 'ENTRY', createdAt: { gte: fromDate, lte: toDate }, ...wFilter } })
  const saidas = await db.stockMovement.count({ where: { type: 'EXIT', createdAt: { gte: fromDate, lte: toDate }, ...wFilter } })
  const totalMovements = await db.stockMovement.count({ where: { createdAt: { gte: fromDate, lte: toDate }, ...wFilter } })
  
  const recentMovementsForChart = await db.stockMovement.findMany({
    where: {
      createdAt: { gte: fromDate, lte: toDate },
      type: { in: ['ENTRY', 'EXIT'] },
      ...wFilter
    },
    select: { type: true, quantity: true, createdAt: true }
  })
  
  const chartDataMap: Record<string, { name: string, entradas: number, saidas: number }> = {}
  recentMovementsForChart.forEach(m => {
    const d = new Date(m.createdAt)
    const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}`
    if (!chartDataMap[dateStr]) chartDataMap[dateStr] = { name: dateStr, entradas: 0, saidas: 0 }
    if (m.type === 'ENTRY') chartDataMap[dateStr].entradas += Math.abs(Number(m.quantity))
    else chartDataMap[dateStr].saidas += Math.abs(Number(m.quantity))
  })
  const chartData = Object.values(chartDataMap).slice(-7)

  const recentMovements = await db.stockMovement.findMany({
    where: { createdAt: { gte: fromDate, lte: toDate }, ...wFilter },
    take: 15,
    orderBy: { createdAt: 'desc' },
    include: {
      product: true,
      warehouse: true,
      performedBy: true
    }
  })

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      <div className="flex items-start justify-between border-b border-border pb-4">
        <div>
          <Link href="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-2 cursor-pointer w-fit">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Voltar</span>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-sm text-muted-foreground mt-1">Consulte e gere relatórios detalhados do estoque.</p>
        </div>
        <ReportsHeaderControls initialFrom={fromDateStr} initialTo={toDateStr} />
      </div>

      <ReportsFilterControls initialFrom={fromDateStr} initialTo={toDateStr} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card border border-border rounded-md p-4 shadow-sm">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Resumo do Período</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xl font-bold text-foreground leading-none mb-1">{entradas}</p>
                <p className="text-[11px] font-medium text-muted-foreground">Entradas realizadas</p>
              </div>
              <div className="w-full h-px bg-border/50"></div>
              <div>
                <p className="text-xl font-bold text-foreground leading-none mb-1">{saidas}</p>
                <p className="text-[11px] font-medium text-muted-foreground">Saídas realizadas</p>
              </div>
              <div className="w-full h-px bg-border/50"></div>
              <div>
                <p className="text-xl font-bold text-foreground leading-none mb-1">{totalMovements}</p>
                <p className="text-[11px] font-medium text-muted-foreground">Total de movimentações</p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-md p-4 shadow-sm">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Relatórios Disponíveis</h3>
            <div className="space-y-1">
              <Link href="/reports/movements" className="block p-2 rounded-sm hover:bg-muted transition-colors border border-transparent hover:border-border/50">
                <span className="text-xs font-bold text-foreground block">Movimentações</span>
                <span className="text-[10px] text-muted-foreground mt-0.5 block leading-tight">Entradas e saídas no período.</span>
              </Link>
              <Link href="/reports/stock" className="block p-2 rounded-sm hover:bg-muted transition-colors border border-transparent hover:border-border/50">
                <span className="text-xs font-bold text-foreground block">Estoque Atual</span>
                <span className="text-[10px] text-muted-foreground mt-0.5 block leading-tight">Posição de produtos e qtds.</span>
              </Link>
              <Link href="/reports/inventory" className="block p-2 rounded-sm hover:bg-muted transition-colors border border-transparent hover:border-border/50">
                <span className="text-xs font-bold text-foreground block">Inventários</span>
                <span className="text-[10px] text-muted-foreground mt-0.5 block leading-tight">Resultados e divergências.</span>
              </Link>
              <Link href="/reports/consumption" className="block p-2 rounded-sm hover:bg-muted transition-colors border border-transparent hover:border-border/50">
                <span className="text-xs font-bold text-foreground block">Consumo</span>
                <span className="text-[10px] text-muted-foreground mt-0.5 block leading-tight">Itens mais requisitados.</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          
          <div className="bg-card border border-border rounded-md shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-3 flex items-center justify-between border-b border-border/40 bg-muted/10">
              <div className="flex items-center gap-6">
                <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">Entradas vs Saídas</h2>
                <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#5C3310]"></span> Entradas</div>
                  <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#C9832B]"></span> Saídas</div>
                </div>
              </div>
            </div>
            <div className="p-2 h-[160px] w-full">
              <DashboardCharts data={chartData} />
            </div>
          </div>

          <div className="bg-card border border-border rounded-md shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between bg-muted/20">
              <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" /> Detalhamento
              </h2>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <input type="text" placeholder="Buscar registros..." className="text-[11px] font-medium border border-border rounded-sm pl-7 pr-2 py-1.5 bg-input text-foreground outline-none focus:border-ring w-56" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Data</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tipo</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Produto</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">Qtd</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Local</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Usuário</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {recentMovements.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-xs font-medium text-muted-foreground">Nenhum dado encontrado.</td>
                    </tr>
                  ) : (
                    recentMovements.map((mov) => {
                      const isPositive = isInMovement(mov.type)
                      const typeLabel = getMovementTypeLabel(mov.type, mov.referenceType)

                      return (
                        <tr key={mov.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2 text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                            {format(mov.createdAt, "dd/MM/yyyy HH:mm")}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm ${isPositive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                              {typeLabel}
                            </span>
                          </td>
                          <td className="px-4 py-2 font-semibold text-xs text-foreground">
                            {mov.product.code} - {mov.product.name}
                          </td>
                          <td className={`px-4 py-2 text-xs font-bold text-right ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {isPositive ? '+' : '-'}{Math.abs(Number(mov.quantity))}
                          </td>
                          <td className="px-4 py-2 text-[11px] font-medium text-muted-foreground">
                            {mov.warehouse.name}
                          </td>
                          <td className="px-4 py-2 text-[11px] font-medium text-muted-foreground">
                            {mov.performedBy.name.split(' ')[0]}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            {recentMovements.length > 0 && (
              <div className="px-4 py-2.5 border-t border-border/40 bg-muted/10 text-center">
                <Link href="/reports/movements" className="text-[11px] font-bold uppercase tracking-widest text-[#C9832B] hover:text-[#5C3310] dark:hover:text-[#E5A94F] transition-colors">
                  Ver todas as movimentações →
                </Link>
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  )
}
