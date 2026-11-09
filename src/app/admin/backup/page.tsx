import { getValidatedSession } from "@/lib/auth"
import { requirePermissionPage } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { DatabaseBackup, AlertTriangle } from "lucide-react"
import { BackupClient } from "./backup-client"

export default async function BackupPage() {
  await requirePermissionPage("CONFIG_MANAGE")
  const session = await getValidatedSession()
  const isAdmin = session?.roles?.includes("ADMIN") ?? false

  if (!isAdmin) redirect("/unauthorized")

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2 tracking-tight">
          <DatabaseBackup className="h-7 w-7 text-amber-600 dark:text-amber-500" />
          Backup &amp; Restauração
        </h1>
        <p className="text-muted-foreground mt-2">
          Baixe uma cópia completa do banco de dados ou restaure o sistema a partir de um arquivo de backup.
        </p>
      </div>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="pt-5 flex gap-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>
            O arquivo contém <strong>todos os dados do sistema</strong>, incluindo informações sensíveis.
            Guarde-o em local seguro e não o compartilhe.
          </p>
        </CardContent>
      </Card>

      <BackupClient />
    </div>
  )
}
