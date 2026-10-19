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
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <BookOpen className="h-7 w-7 sm:h-8 sm:w-8 text-primary shrink-0" />
            Central de Ajuda e Tutorial do Sistema
          </h2>
          <p className="text-muted-foreground mt-1.5 text-sm sm:text-base">
            Pesquise qualquer dúvida, siga o passo a passo das operações e consulte as perguntas frequentes (FAQ).
          </p>
        </div>
      </div>

      <HelpContent />
    </div>
  )
}
