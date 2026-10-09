import { redirect } from "next/navigation"
import { SearchResults } from "./search-results"

export const metadata = {
  title: "Busca | CGStock",
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q: string | string[] | undefined }>
}) {
  const resolvedParams = await searchParams
  const q = resolvedParams.q
  const query = Array.isArray(q) ? q[0] : q

  if (!query) {
    redirect("/dashboard")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Resultados da Busca</h1>
        <p className="text-muted-foreground mt-2">
          Mostrando resultados para: <span className="font-bold text-foreground">&quot;{query}&quot;</span>
        </p>
      </div>
      
      <SearchResults query={query} />
    </div>
  )
}
