import { requirePermissionPage } from "@/lib/permissions"
import { getValidatedSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ClipboardList, ExternalLink } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { BackButton } from "@/components/ui/back-button"
import { warehouseIdFilter } from "@/lib/dal"

export default async function InventoryReportPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePermissionPage('REPORT_VIEW')
  const wFilter = await warehouseIdFilter((await getValidatedSession())!.userId)
  const params = await searchParams
  const page = Number(params.page) || 1
  const pageSize = 50
  
  const inventories = await db.inventory.findMany({
    where: wFilter,
    take: pageSize,
    skip: (page - 1) * pageSize,
    orderBy: { createdAt: 'desc' },
    include: {
      warehouse: true,
      createdBy: true,
      _count: {
        select: {
          divergences: true,
          locations: true,
          collections: true
        }
      }
    }
  })

  const total = await db.inventory.count({ where: wFilter })
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-emerald-600" />
            Relatório de Inventários
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Acompanhamento e apuração de todos os inventários.</p>
        </div>
        </div>
      </div>

      <div className="bg-card  rounded-md border border-border shadow-sm  overflow-hidden  ">
        {inventories.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Nenhum inventário registrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Cód. Insumo</TableHead>
                  <TableHead>Data Criação</TableHead>
                  <TableHead>Almoxarifado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Locais</TableHead>
                  <TableHead className="text-right">Coletas</TableHead>
                  <TableHead className="text-right">Divergências</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventories.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium text-foreground">{inv.code}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(inv.createdAt, "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{inv.warehouse.name}</TableCell>
                    <TableCell>
                      <Badge variant={inv.status === 'COMPLETED' ? 'success' : 'outline'}>
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{inv._count.locations}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{inv._count.collections}</TableCell>
                    <TableCell className="text-right font-bold text-red-600">{inv._count.divergences}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/inventory/${inv.id}`}>
                        <span className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          Detalhes <ExternalLink className="h-3 w-3" />
                        </span>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <a href={`/reports/inventory?page=${Math.max(1, page - 1)}`} className={`px-4 py-2 border rounded-md ${page === 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}`}>
            Anterior
          </a>
          <span className="px-4 py-2 text-muted-foreground">Página {page} de {totalPages}</span>
          <a href={`/reports/inventory?page=${Math.min(totalPages, page + 1)}`} className={`px-4 py-2 border rounded-md ${page === totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}`}>
            Próxima
          </a>
        </div>
      )}
    </div>
  )
}
