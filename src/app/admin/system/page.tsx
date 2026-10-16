import { requirePermissionPage } from "@/lib/permissions"
import { db } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Activity, Server, Database, Cloud } from "lucide-react"
import { BackButton } from "@/components/ui/back-button"

export default async function SystemHealthPage() {
  await requirePermissionPage('CONFIG_MANAGE')

  // Testa conexão com banco
  let dbStatus = "Desconectado"
  let dbLatency = 0
  try {
    // eslint-disable-next-line react-hooks/purity -- medição de latência em Server Component (não é render de cliente)
    const start = Date.now()
    await db.$queryRaw`SELECT 1`
    // eslint-disable-next-line react-hooks/purity
    dbLatency = Date.now() - start
    dbStatus = "Conectado (Neon Serverless)"
  } catch {
    dbStatus = "Erro de Conexão"
  }

  // Estatísticas globais do banco
  const [totalProducts, totalMovements, totalLogs, totalUsers] = await Promise.all([
    db.product.count(),
    db.stockMovement.count(),
    db.auditLog.count(),
    db.user.count()
  ])

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-emerald-600" />
            Saúde do Sistema
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Status da infraestrutura e volume de dados da plataforma.</p>
        </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <Server className="h-8 w-8 text-blue-500 mb-2" />
            <p className="text-sm text-muted-foreground font-medium">Versão da Aplicação</p>
            <p className="text-xl font-bold text-foreground">v0.1.0-beta</p>
            <p className="text-xs text-green-500 mt-1">Online</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <Database className="h-8 w-8 text-primary mb-2" />
            <p className="text-sm text-muted-foreground font-medium">Status do Banco</p>
            <p className="text-lg font-bold text-foreground truncate max-w-full" title={dbStatus}>{dbStatus}</p>
            <p className="text-xs text-muted-foreground mt-1">{dbLatency}ms latência</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <Cloud className="h-8 w-8 text-sky-500 mb-2" />
            <p className="text-sm text-muted-foreground font-medium">Ambiente</p>
            <p className="text-xl font-bold text-foreground">{process.env.NODE_ENV === 'production' ? 'Produção' : 'Desenvolvimento'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex flex-col items-center justify-center text-center">
            <Activity className="h-8 w-8 text-emerald-500 mb-2" />
            <p className="text-sm text-muted-foreground font-medium">Usuários Ativos</p>
            <p className="text-xl font-bold text-foreground">{totalUsers}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Volume de Dados</CardTitle>
          <CardDescription>Quantidade de registros nas tabelas principais para monitoramento de limite.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="font-medium text-gray-700">Produtos Cadastrados</span>
              <span className="font-bold">{totalProducts.toLocaleString("pt-BR")}</span>
            </div>
            <div className="flex items-center justify-between border-b pb-2">
              <span className="font-medium text-gray-700">Movimentações Históricas</span>
              <span className="font-bold">{totalMovements.toLocaleString("pt-BR")}</span>
            </div>
            <div className="flex items-center justify-between pb-2">
              <span className="font-medium text-gray-700">Logs de Auditoria</span>
              <span className="font-bold">{totalLogs.toLocaleString("pt-BR")}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
