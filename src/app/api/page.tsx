import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Code2, Webhook, Key, ExternalLink } from "lucide-react"
import { BackButton } from "@/components/ui/back-button"
import { requirePermissionPage } from "@/lib/permissions"
import { InformakonSyncCard } from "./informakon-sync-card"

export default async function ApiPage() {
  await requirePermissionPage('CONFIG_MANAGE')
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
          <h2 className="text-2xl font-bold tracking-tight">API / Integrações</h2>
          <p className="text-muted-foreground">Conecte o sistema a outros serviços corporativos e ERPs.</p>
        </div>
        </div>
        <Badge variant="warning" className="px-3 py-1 text-sm">
          Em desenvolvimento
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <InformakonSyncCard />

        <Card className="relative overflow-hidden border-dashed">
          <div className="absolute inset-0 bg-muted/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <Badge className="bg-gray-900">Em Breve</Badge>
          </div>
          <CardHeader>
            <Code2 className="h-8 w-8 text-blue-600 mb-2" />
            <CardTitle>Documentação REST</CardTitle>
            <CardDescription>Acesse os endpoints para listar produtos, sincronizar estoque e mais.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled>Ver Endpoints</Button>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-dashed">
          <div className="absolute inset-0 bg-muted/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <Badge className="bg-gray-900">Em Breve</Badge>
          </div>
          <CardHeader>
            <Webhook className="h-8 w-8 text-purple-600 mb-2" />
            <CardTitle>Webhooks</CardTitle>
            <CardDescription>Receba eventos em tempo real sobre inventários concluídos e coletas.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled>Configurar Webhooks</Button>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-dashed">
          <div className="absolute inset-0 bg-muted/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <Badge className="bg-gray-900">Em Breve</Badge>
          </div>
          <CardHeader>
            <Key className="h-8 w-8 text-emerald-600 mb-2" />
            <CardTitle>Chaves de API</CardTitle>
            <CardDescription>Gerencie seus tokens de acesso seguros (Bearer tokens).</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled>Gerar Nova Chave</Button>
          </CardContent>
        </Card>
      </div>
      
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-blue-900">
          <div>
            <h3 className="font-semibold text-lg mb-1">Integração com Coletores Legados</h3>
            <p className="text-sm opacity-80">A infraestrutura já está sendo preparada para receber requisições do aplicativo de coleta nativo.</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0">
            Ler Documentação <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
