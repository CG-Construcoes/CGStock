"use client"

import React, { useState, useRef, useEffect, useMemo } from "react"
import { Check, ChevronsUpDown, Search, ChevronRight, ArrowLeft, Tag, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SupplierSelectOption {
  id: string
  name: string
  document?: string | null
  erpCode?: string | null
  category?: string | null
  source?: string | null
}

export interface SupplierCategoryGroup {
  key: string
  label: string
  count: number
}

export interface SupplierSelectProps {
  /** Modo local: lista já carregada (catálogo offline). Se omitido, usa loadCategories/loadSuppliers */
  suppliers?: SupplierSelectOption[]
  /** Modo servidor: busca categorias sob demanda */
  loadCategories?: () => Promise<SupplierCategoryGroup[]>
  /** Modo servidor: busca fornecedores por categoria ou termo de pesquisa */
  loadSuppliers?: (params: { search?: string; category?: string | null }) => Promise<SupplierSelectOption[]>
  value: string
  onChange: (value: string) => void
  /** Chamado quando o usuário escolhe um fornecedor (recebe o objeto completo, ex.: para validar empresa) */
  onSelectOption?: (option: SupplierSelectOption | null) => void
  name?: string
  required?: boolean
  placeholder?: string
  className?: string
}

const UNCATEGORIZED = "__sem_categoria__"
const MAX_ITEMS = 80

function normalize(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

export function SupplierSelect({
  suppliers,
  loadCategories,
  loadSuppliers,
  value,
  onChange,
  onSelectOption,
  name,
  required,
  placeholder = "Selecione o fornecedor...",
  className
}: SupplierSelectProps) {
  const isAsync = !!(loadCategories && loadSuppliers)

  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [picked, setPicked] = useState<SupplierSelectOption | null>(null)
  const [remoteCategories, setRemoteCategories] = useState<SupplierCategoryGroup[] | null>(null)
  const [remoteSuppliers, setRemoteSuppliers] = useState<SupplierSelectOption[]>([])
  const [loading, setLoading] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const requestSeq = useRef(0)

  const localSelected = !isAsync ? (suppliers ?? []).find((s) => s.id === value) : undefined
  const shown = picked && picked.id === value ? picked : localSelected
  const displayValue = shown ? `${shown.erpCode ? `${shown.erpCode} · ` : ""}${shown.name}` : ""

  const localCategories = useMemo(() => {
    if (isAsync || !suppliers) return []
    const counts = new Map<string, number>()
    for (const s of suppliers) {
      const key = s.category?.trim() || UNCATEGORIZED
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([key, count]) => ({ key, label: key === UNCATEGORIZED ? "Sem categoria" : key, count }))
      .sort((a, b) => {
        if (a.key === UNCATEGORIZED) return 1
        if (b.key === UNCATEGORIZED) return -1
        return a.label.localeCompare(b.label, "pt-BR")
      })
  }, [isAsync, suppliers])

  const categories = isAsync ? (remoteCategories ?? []) : localCategories

  const query = normalize(searchTerm.trim())
  const searching = query.length > 0

  const localSuppliers = useMemo(() => {
    if (isAsync || !suppliers) return []
    if (searching) {
      return suppliers.filter((s) =>
        normalize(`${s.name} ${s.erpCode ?? ""} ${s.document ?? ""}`).includes(query)
      )
    }
    if (activeCategory) {
      return suppliers.filter((s) => (s.category?.trim() || UNCATEGORIZED) === activeCategory)
    }
    return []
  }, [isAsync, suppliers, searching, query, activeCategory])

  // Modo servidor: categorias na abertura e fornecedores por categoria/busca (com debounce na busca)
  useEffect(() => {
    if (!isAsync || !isOpen || !loadCategories || !loadSuppliers) return

    if (remoteCategories === null) {
      const seq = ++requestSeq.current
      loadCategories()
        .then((cats) => { if (seq === requestSeq.current) setRemoteCategories(cats) })
        .catch(() => { if (seq === requestSeq.current) setRemoteCategories([]) })
    }

    if (!searching && !activeCategory) return

    const seq = ++requestSeq.current
    const fetchPage = () => {
      setLoading(true)
      loadSuppliers(searching ? { search: searchTerm } : { category: activeCategory })
        .then((rows) => { if (seq === requestSeq.current) setRemoteSuppliers(rows) })
        .catch(() => { if (seq === requestSeq.current) setRemoteSuppliers([]) })
        .finally(() => { if (seq === requestSeq.current) setLoading(false) })
    }

    const timer = setTimeout(fetchPage, searching ? 300 : 0)
    return () => clearTimeout(timer)
  }, [isAsync, isOpen, remoteCategories, searching, searchTerm, activeCategory, loadCategories, loadSuppliers])

  const visibleSuppliers = isAsync ? remoteSuppliers : localSuppliers
  const activeCategoryLabel = categories.find((c) => c.key === activeCategory)?.label ?? ""

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const openPicker = () => {
    setIsOpen(true)
    setSearchTerm("")
    // Ao abrir mostra as categorias; se já houver fornecedor com categoria, abre nela
    setActiveCategory(shown?.category?.trim() || null)
  }

  const renderSupplier = (s: SupplierSelectOption) => (
    <div
      key={s.id}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-sm py-3 md:py-2 pl-10 md:pl-8 pr-4 md:pr-2 text-base md:text-sm outline-none hover:bg-accent hover:text-accent-foreground",
        value === s.id && "bg-accent/50 text-accent-foreground font-medium"
      )}
      onClick={(e) => {
        e.stopPropagation()
        onChange(s.id)
        setPicked(s)
        onSelectOption?.(s)
        setIsOpen(false)
      }}
    >
      <span className="absolute left-3 md:left-2 flex h-5 w-5 md:h-3.5 md:w-3.5 items-center justify-center">
        {value === s.id && <Check className="h-5 w-5 md:h-4 md:w-4" />}
      </span>
      <span className="min-w-0">
        <span className="block truncate">{s.name}</span>
        {(s.erpCode || s.document) && (
          <span className="block truncate text-xs text-muted-foreground">
            {[s.erpCode, s.document].filter(Boolean).join(" · ")}
          </span>
        )}
      </span>
    </div>
  )

  const supplierList = (
    <>
      {visibleSuppliers.slice(0, isAsync ? visibleSuppliers.length : MAX_ITEMS).map(renderSupplier)}
      {!isAsync && visibleSuppliers.length > MAX_ITEMS && (
        <div className="py-2 px-3 text-center text-xs text-muted-foreground border-t border-border/50 mt-1">
          Mostrando {MAX_ITEMS} de {visibleSuppliers.length.toLocaleString("pt-BR")} — digite para filtrar
        </div>
      )}
      {isAsync && !loading && visibleSuppliers.length >= MAX_ITEMS && (
        <div className="py-2 px-3 text-center text-xs text-muted-foreground border-t border-border/50 mt-1">
          Mostrando os {MAX_ITEMS} primeiros — refine a busca
        </div>
      )}
    </>
  )

  return (
    <div className={cn("relative w-full", className)} ref={wrapperRef}>
      {name && (
        <input
          type="hidden"
          name={name}
          value={value}
          required={required}
        />
      )}

      <button
        type="button"
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-md border border-border bg-muted/20 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary hover:bg-muted/50",
          !value && "text-muted-foreground"
        )}
        onClick={() => (isOpen ? setIsOpen(false) : openPicker())}
      >
        <span className="truncate">{displayValue || placeholder}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-background/80 md:hidden"
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen(false)
            }}
          />
          <div className={cn(
            "z-50 overflow-hidden border bg-popover text-popover-foreground shadow-sm flex flex-col",
            "fixed inset-x-0 bottom-0 max-h-[80vh] rounded-t-xl sm:rounded-md",
            "md:absolute md:mt-1 md:max-h-80 md:w-full md:inset-auto md:rounded-md"
          )}>
            <div className="sticky top-0 bg-popover p-3 md:p-2 border-b z-10 space-y-2">
              <div className="flex items-center rounded-md border px-3">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <input
                  className="flex h-10 md:h-9 w-full rounded-md bg-transparent py-3 text-base md:text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Nome, código ou CNPJ/CPF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
                {loading && <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />}
              </div>
              {!searching && activeCategory && (
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveCategory(null)
                  }}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Categorias <span className="text-muted-foreground font-normal">/ {activeCategoryLabel}</span>
                </button>
              )}
            </div>

            <div className="p-2 md:p-1 overflow-y-auto pb-6 md:pb-1">
              {searching || activeCategory ? (
                loading && visibleSuppliers.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Carregando fornecedores...
                  </div>
                ) : visibleSuppliers.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Nenhum fornecedor encontrado.
                  </div>
                ) : (
                  supplierList
                )
              ) : (
                <>
                  {categories.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      {isAsync && remoteCategories === null ? "Carregando categorias..." : "Nenhum fornecedor disponível."}
                    </div>
                  ) : (
                    categories.map((cat) => (
                      <div
                        key={cat.key}
                        className="relative flex cursor-pointer select-none items-center gap-2 rounded-sm py-3 md:py-2 px-3 md:px-2 text-base md:text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveCategory(cat.key)
                        }}
                      >
                        <Tag className="h-4 w-4 shrink-0 opacity-50" />
                        <span className="flex-1 truncate">{cat.label}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {cat.count.toLocaleString("pt-BR")}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
                      </div>
                    ))
                  )}
                  <div className="py-2 px-3 text-center text-xs text-muted-foreground border-t border-border/50 mt-1">
                    Escolha uma categoria ou digite nome, código ou CNPJ/CPF
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
