"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Search, Plus, Edit, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { saveCategoryAction } from "./actions"

export type CategoryItem = { id: string; name: string; description: string | null; status: string; productCount: number }

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

function StatusBadge({ status }: { status: string }) {
  return status === "ACTIVE" ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs font-medium">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Ativo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-500/10 text-zinc-600 border border-zinc-500/20 text-xs font-medium">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" /> Inativo
    </span>
  )
}

export function CategoriesClient({ categories, canCreate, canUpdate }: { categories: CategoryItem[]; canCreate: boolean; canUpdate: boolean }) {
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<CategoryItem | "new" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return categories
    return categories.filter(c => normalize(c.name).includes(q) || normalize(c.description ?? "").includes(q))
  }, [categories, query])

  const open = (target: CategoryItem | "new") => {
    setError(null)
    setEditing(target)
  }

  const handleSubmit = (formData: FormData) => {
    const current = editing === "new" ? null : editing
    startTransition(async () => {
      const res = await saveCategoryAction({
        id: current?.id,
        name: String(formData.get("name") || ""),
        description: String(formData.get("description") || ""),
        status: String(formData.get("status") || "ACTIVE"),
      })
      if (res.error) return setError(res.error)
      toast.success(current ? "Categoria atualizada." : "Categoria criada.")
      setEditing(null)
      router.refresh()
    })
  }

  const current = editing && editing !== "new" ? editing : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Categorias</h2>
          <p className="text-muted-foreground">Gerencie as categorias de produtos do sistema.</p>
        </div>
        {canCreate && (
          <Button className="flex items-center gap-2" onClick={() => open("new")}>
            <Plus className="h-4 w-4" />
            Nova Categoria
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-card p-4 rounded-md border border-border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome ou descrição..." className="pl-9" />
        </div>
        <p className="text-sm text-muted-foreground self-center whitespace-nowrap">{filtered.length} de {categories.length}</p>
      </div>

      <div className="bg-card rounded-md border border-border shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-base font-medium text-foreground mb-1">Nenhuma categoria encontrada</p>
            <p className="text-sm text-muted-foreground">{query ? "Tente outro termo de busca." : "Você ainda não possui categorias cadastradas."}</p>
          </div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-border/50">
              {filtered.map((category) => (
                <div key={category.id} className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground leading-tight">{category.name}</p>
                    <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{category.description || "Sem descrição"}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <StatusBadge status={category.status} />
                      <Link href={`/products?category=${category.id}`} className="hover:underline">{category.productCount} produtos</Link>
                    </div>
                  </div>
                  {canUpdate && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => open(category)} aria-label={`Editar ${category.name}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <Table className="w-full">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-12 px-6 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Nome</TableHead>
                    <TableHead className="h-12 px-6 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Descrição</TableHead>
                    <TableHead className="h-12 px-6 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-center">Qtd. Produtos</TableHead>
                    <TableHead className="h-12 px-6 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Status</TableHead>
                    <TableHead className="h-12 px-6 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((category) => (
                    <TableRow key={category.id} className="border-b border-border">
                      <TableCell className="px-6 py-3 font-semibold text-foreground">{category.name}</TableCell>
                      <TableCell className="px-6 py-3">
                        {category.description ? <span className="text-muted-foreground line-clamp-1">{category.description}</span> : <span className="text-muted-foreground/50 italic">Sem descrição</span>}
                      </TableCell>
                      <TableCell className="px-6 py-3 text-center">
                        <Link href={`/products?category=${category.id}`} className="inline-flex min-w-[2.5rem] justify-center px-3 py-1 rounded-full bg-secondary/60 border border-border text-sm font-semibold text-foreground hover:border-primary" title="Ver produtos desta categoria">
                          {category.productCount}
                        </Link>
                      </TableCell>
                      <TableCell className="px-6 py-3"><StatusBadge status={category.status} /></TableCell>
                      <TableCell className="px-6 py-3 text-right">
                        {canUpdate && (
                          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => open(category)}>
                            <Edit className="h-4 w-4" /> Editar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={() => !isPending && setEditing(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="category-dialog-title" className="w-full max-w-md rounded-md bg-card p-6 shadow-sm border border-border" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h3 id="category-dialog-title" className="text-lg font-bold text-foreground">{current ? "Editar categoria" : "Nova categoria"}</h3>
              <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-1" onClick={() => setEditing(null)} disabled={isPending} aria-label="Fechar">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <form action={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="category-name" className="text-sm font-medium">Nome *</label>
                <Input id="category-name" name="name" defaultValue={current?.name} placeholder="Ex: Elétrica" required autoFocus disabled={isPending} />
              </div>
              <div className="space-y-2">
                <label htmlFor="category-description" className="text-sm font-medium">Descrição</label>
                <Input id="category-description" name="description" defaultValue={current?.description ?? ""} placeholder="Opcional" disabled={isPending} />
              </div>
              {current && (
                <div className="space-y-2">
                  <label htmlFor="category-status" className="text-sm font-medium">Status</label>
                  <select id="category-status" name="status" defaultValue={current.status} disabled={isPending} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="ACTIVE">Ativo</option>
                    <option value="INACTIVE">Inativo</option>
                  </select>
                </div>
              )}
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={isPending}>Cancelar</Button>
                <Button type="submit" disabled={isPending} className="min-w-28">
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
