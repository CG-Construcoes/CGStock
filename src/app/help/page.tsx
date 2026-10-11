import { getValidatedSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { HelpContent } from "./help-content"
import { BookOpen } from "lucide-react"

export const metadata = {
  title: "Central de Ajuda | CGStock",
  description: "Manual completo e documentação do sistema",
}

export default async function HelpPage() {
  const session = await getValidatedSession()
  if (!session) redirect("/login")

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            Central de Ajuda e Documentação
          </h2>
          <p className="text-muted-foreground mt-2 text-lg">
            Guia completo de operação, boas práticas e fluxos do sistema CGStock.
          </p>
        </div>
      </div>

      <HelpContent />
    </div>
  )
}
