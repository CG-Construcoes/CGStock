import { requirePermissionPage } from "@/lib/permissions"
import { db } from "@/lib/db"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Shield, Search } from "lucide-react"
import { BackButton } from "@/components/ui/back-button"

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string, action?: string, userId?: string }> }) {
  await requirePermissionPage('AUDIT_VIEW')

  const params = await searchParams
  const page = Number(params.page) || 1
  const pageSize = 50
  
  const whereClause: any = {}
  if (params.action) {
    whereClause.action = { contains: params.action, mode: 'insensitive' }
  }
  if (params.userId) {
    whereClause.userId = params.userId
  }

  const logs = await db.auditLog.findMany({
    where: whereClause,
    take: pageSize,
    skip: (page - 1) * pageSize,
    orderBy: { timestamp: 'desc' },
    include: {
      user: true
    }
  })

  const total = await db.auditLog.count({ where: whereClause })
  const totalPages = Math.ceil(total / pageSize)

  const users = await db.user.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } })

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Trilha de Auditoria
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Registro imutável de operações e eventos do sistema.</p>
          </div>
        </div>
      </div>

      <div className="bg-card p-4 rounded-md border border-border shadow-sm flex flex-col sm:flex-row gap-4">
        <form className="flex w-full gap-4 items-end">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium">Ação (Ex: LOGIN_FAILED, STOCK_ADJUSTMENT)</label>
            <input 
              name="action" 
              defaultValue={params.action || ''} 
              placeholder="Buscar por ação..." 
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium">Usuário</label>
            <select 
              name="userId" 
              defaultValue={params.userId || ''} 
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todos</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="h-10 px-4 py-2 bg-primary text-primary-foreground rounded-md flex items-center gap-2 font-medium hover:bg-primary/90">
            <Search className="h-4 w-4" />
            Filtrar
          </button>
        </form>
      </div>

      <div className="bg-card rounded-md border border-border shadow-sm overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Nenhum log de auditoria encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>ID Entidade</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {log.timestamp.toLocaleString()}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {log.user?.name || 'Sistema'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs font-bold text-gray-700 bg-accent">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{log.entityType}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[120px]" title={log.entityId}>
                      {log.entityId}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.ip || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <a href={`/admin/audit?page=${Math.max(1, page - 1)}&action=${params.action||''}&userId=${params.userId||''}`} className={`px-4 py-2 border rounded-md ${page === 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}`}>
            Anterior
          </a>
          <span className="px-4 py-2 text-muted-foreground">Página {page} de {totalPages}</span>
          <a href={`/admin/audit?page=${Math.min(totalPages, page + 1)}&action=${params.action||''}&userId=${params.userId||''}`} className={`px-4 py-2 border rounded-md ${page === totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}`}>
            Próxima
          </a>
        </div>
      )}
    </div>
  )
}
