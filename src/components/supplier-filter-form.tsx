"use client"

import { useRouter } from "next/navigation"
import { Search, Building2, Tag } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function SupplierFilterForm({
  q,
  source,
  category,
  categories,
  basePath,
}: {
  q: string
  source: string
  category: string
  categories: string[]
  basePath: string
}) {
  const router = useRouter()

  const apply = (formData: FormData) => {
    const params = new URLSearchParams()
    const nq = (formData.get("q") as string)?.trim()
    const ns = formData.get("source") as string
    const nc = (formData.get("category") as string)?.trim()
    if (nq) params.set("q", nq)
    if (ns === "MGA" || ns === "CV") params.set("source", ns)
    if (nc) params.set("category", nc)
    router.push(`${basePath}${params.size ? `?${params.toString()}` : ""}`)
  }

  const selectClass =
    "flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-full"

  return (
    <form action={apply} className="flex flex-col sm:flex-row gap-3 bg-card p-4 rounded-md border border-border shadow-sm">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input name="q" defaultValue={q} placeholder="Buscar por nome, documento ou código..." className="pl-9" />
      </div>
      <div className="relative sm:w-44">
        <Building2 className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
        <select name="source" defaultValue={source} className={`${selectClass} pl-9`}>
          <option value="">Todas as empresas</option>
          <option value="MGA">MGA — CG</option>
          <option value="CV">CV — Conceito</option>
        </select>
      </div>
      <div className="relative sm:w-56">
        <Tag className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
        <select name="category" defaultValue={category} className={`${selectClass} pl-9`}>
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <Button type="submit" className="sm:w-auto">Filtrar</Button>
    </form>
  )
}
