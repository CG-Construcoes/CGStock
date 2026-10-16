"use client"

import { useState, useTransition } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  Search,
  HardHat,
  Users,
  QrCode,
  FileSpreadsheet,
  Printer,
  Plus,
  CheckCircle2,
  XCircle,
  MoreVertical,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Building2,
  Phone,
  FileText,
  BadgeCheck,
  RefreshCw,
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { QRCodeSVG } from "qrcode.react"
import {
  createEmployeeAction,
  updateEmployeeAction,
  toggleEmployeeStatusAction,
  regenerateEmployeeQrAction
} from "./actions"

type Employee = {
  id: string
  name: string
  employeeCode: string | null
  document: string | null
  phone: string | null
  email: string | null
  status: string
  loginEnabled: boolean
  qrToken: string | null
  qrStatus: string
  createdAt: Date | string
  roles: { id: string; name: string }[]
  worksiteAccesses: {
    worksite: { id: string; name: string; code: string }
  }[]
}

type Worksite = {
  id: string
  name: string
  code: string
}

type Stats = {
  total: number
  activeField: number
  systemUsers: number
  withQrCode: number
}

type Pagination = {
  page: number
  pageSize: number
  totalPages: number
  totalItems: number
}

export function EmployeesClient({
  employees,
  stats,
  worksites,
  pagination,
  currentFilter,
}: {
  employees: Employee[]
  stats: Stats
  worksites: Worksite[]
  pagination: Pagination
  currentFilter: { q: string; type: string }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchValue, setSearchValue] = useState(currentFilter.q)
  const [selectedBadgeEmployee, setSelectedBadgeEmployee] = useState<Employee | null>(null)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Atualizar busca na URL
  const updateQuery = (newQ: string, newType?: string, newPage: number = 1) => {
    const params = new URLSearchParams(searchParams.toString())
    if (newQ.trim()) params.set("q", newQ.trim())
    else params.delete("q")

    const type = newType !== undefined ? newType : currentFilter.type
    if (type && type !== "ALL") params.set("type", type)
    else params.delete("type")

    if (newPage > 1) params.set("page", String(newPage))
    else params.delete("page")

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateQuery(searchValue, currentFilter.type, 1)
  }

  const handleTypeChange = (newType: string) => {
    updateQuery(searchValue, newType, 1)
  }

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(employees.map((emp) => emp.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id])
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id))
    }
  }

  const printSelectedUrl = selectedIds.length > 0
    ? `/admin/employees/print-badges?ids=${selectedIds.join(",")}`
    : `/admin/employees/print-badges`

  // Formatador de CPF para exibição
  const formatDocument = (doc?: string | null) => {
    if (!doc) return "—"
    const clean = doc.replace(/\D/g, "")
    if (clean.length === 11) {
      return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`
    }
    return doc
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <HardHat className="h-6 w-6 text-primary" />
              Funcionários & Equipe de Campo
            </h1>
            <Badge variant="outline" className="text-xs bg-muted/50 border-primary/20 text-primary">
              {stats.total.toLocaleString("pt-BR")} cadastrados
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastros de operários e equipe para entrega rápida via QR Code no capacete. Funcionários criados aqui <strong>não</strong> têm acesso de login ao sistema.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Link href={printSelectedUrl}>
            <Button
              variant="outline"
              className="gap-2 border-border hover:bg-muted active:scale-95 transition-all text-xs sm:text-sm"
            >
              <Printer className="h-4 w-4 text-primary" />
              <span>
                {selectedIds.length > 0
                  ? `Imprimir Etiquetas (${selectedIds.length})`
                  : "Imprimir Etiquetas"}
              </span>
            </Button>
          </Link>

          <Link href="/admin/employees/import">
            <Button
              variant="outline"
              className="gap-2 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 active:scale-95 transition-all text-xs sm:text-sm"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Importar Planilha Excel
            </Button>
          </Link>

          <Button
            onClick={() => setIsNewModalOpen(true)}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm active:scale-95 transition-all text-xs sm:text-sm"
          >
            <Plus className="h-4 w-4" />
            Novo Funcionário
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Total Equipe</span>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground">
            {stats.total.toLocaleString("pt-BR")}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Colaboradores da empresa</p>
        </div>

        <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 shadow-sm">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Equipe de Campo</span>
            <HardHat className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-blue-700 dark:text-blue-300">
            {stats.activeField.toLocaleString("pt-BR")}
          </div>
          <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1">Operários (sem login no sistema)</p>
        </div>

        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Com QR Code</span>
            <QrCode className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300">
            {stats.withQrCode.toLocaleString("pt-BR")}
          </div>
          <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">Prontos para bipe no capacete</p>
        </div>

        <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 shadow-sm">
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Usuários do Sistema</span>
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-purple-700 dark:text-purple-300">
            {stats.systemUsers.toLocaleString("pt-BR")}
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-purple-600/80 dark:text-purple-400/80">Com acesso ao software</p>
            <Link href="/admin/users" className="text-xs font-medium text-purple-600 dark:text-purple-400 hover:underline">
              Ver tela &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Buscar por nome, matrícula, CPF ou telefone..."
            className="pl-9 bg-background text-sm"
          />
        </form>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Button
            size="sm"
            variant={currentFilter.type === "ALL" ? "default" : "outline"}
            onClick={() => handleTypeChange("ALL")}
            className="text-xs"
          >
            Todos ({stats.total})
          </Button>
          <Button
            size="sm"
            variant={currentFilter.type === "FIELD" ? "default" : "outline"}
            onClick={() => handleTypeChange("FIELD")}
            className="text-xs"
          >
            Apenas Campo ({stats.activeField})
          </Button>
          <Button
            size="sm"
            variant={currentFilter.type === "SYSTEM" ? "default" : "outline"}
            onClick={() => handleTypeChange("SYSTEM")}
            className="text-xs"
          >
            Usuários com Login ({stats.systemUsers})
          </Button>
        </div>
      </div>

      {/* Floating Selection Banner */}
      {selectedIds.length > 0 && (
        <div className="sticky top-20 z-20 flex items-center justify-between gap-4 p-3 rounded-lg bg-primary text-primary-foreground shadow-lg animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4" />
            <span>{selectedIds.length} funcionário(s) selecionado(s)</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={printSelectedUrl}>
              <Button size="sm" variant="secondary" className="gap-1.5 text-xs font-semibold">
                <Printer className="h-3.5 w-3.5" />
                Imprimir {selectedIds.length} Etiqueta(s)
              </Button>
            </Link>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds([])}
              className="text-xs text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
            >
              Desmarcar
            </Button>
          </div>
        </div>
      )}

      {/* Table Card */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={employees.length > 0 && selectedIds.length === employees.length}
                    onChange={handleSelectAll}
                    className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                  />
                </th>
                <th className="px-4 py-3 font-semibold">Matrícula</th>
                <th className="px-4 py-3 font-semibold">Nome do Colaborador</th>
                <th className="px-4 py-3 font-semibold">CPF / Documento</th>
                <th className="px-4 py-3 font-semibold">Telefone</th>
                <th className="px-4 py-3 font-semibold">Tipo de Acesso</th>
                <th className="px-4 py-3 font-semibold text-center">Etiqueta Capacete</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <HardHat className="h-8 w-8 text-muted-foreground/50" />
                      <p className="font-medium text-foreground">Nenhum funcionário encontrado.</p>
                      <p className="text-xs text-muted-foreground">
                        {currentFilter.q
                          ? "Tente buscar com outro termo."
                          : "Clique em 'Importar Planilha Excel' para carregar a lista de funcionários."}
                      </p>
                      <Link href="/admin/employees/import" className="mt-2">
                        <Button size="sm" variant="outline" className="gap-2">
                          <FileSpreadsheet className="h-4 w-4" />
                          Importar Planilha
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                employees.map((emp) => {
                  const isSelected = selectedIds.includes(emp.id)
                  const qrCodeValue = emp.qrToken || (emp.employeeCode ? `EMP-${emp.employeeCode}` : emp.id)

                  return (
                    <tr
                      key={emp.id}
                      className={`hover:bg-muted/40 transition-colors ${
                        isSelected ? "bg-primary/5" : ""
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleSelectOne(emp.id, e.target.checked)}
                          className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                        />
                      </td>

                      {/* Matrícula */}
                      <td className="px-4 py-3 font-mono font-medium text-foreground">
                        {emp.employeeCode ? (
                          <Badge variant="outline" className="font-mono text-xs bg-muted/50 border-border">
                            {emp.employeeCode}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>

                      {/* Nome */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground leading-snug">
                          {emp.name}
                        </div>
                        {emp.email && (
                          <div className="text-xs text-muted-foreground font-mono">
                            {emp.email}
                          </div>
                        )}
                      </td>

                      {/* Documento / CPF */}
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {formatDocument(emp.document)}
                      </td>

                      {/* Telefone */}
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {emp.phone ? (
                          <span className="flex items-center gap-1 font-mono">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {emp.phone}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Tipo de Acesso */}
                      <td className="px-4 py-3">
                        {emp.loginEnabled ? (
                          <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[11px] gap-1 font-medium hover:bg-purple-500/20">
                            <ShieldAlert className="h-3 w-3" />
                            Usuário do Sistema
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[11px] gap-1 font-medium hover:bg-blue-500/20">
                            <HardHat className="h-3 w-3" />
                            Apenas Campo
                          </Badge>
                        )}
                      </td>

                      {/* Mini Preview QR Code */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setSelectedBadgeEmployee(emp)}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-background hover:bg-muted text-xs font-mono transition-colors active:scale-95 group"
                          title="Clique para ver o adesivo de capacete"
                        >
                          <QrCode className="h-3.5 w-3.5 text-primary group-hover:scale-110 transition-transform" />
                          <span className="text-[11px] text-muted-foreground group-hover:text-foreground">
                            Ver QR
                          </span>
                        </button>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {emp.status === "ACTIVE" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                            <XCircle className="h-3.5 w-3.5" />
                            Inativo
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedBadgeEmployee(emp)}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Imprimir adesivo de capacete"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditingEmployee(emp)}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Editar dados"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div>
            Mostrando <strong>{employees.length}</strong> de{" "}
            <strong>{pagination.totalItems.toLocaleString("pt-BR")}</strong> colaboradores
            {pagination.totalPages > 1 && (
              <span> (Página {pagination.page} de {pagination.totalPages})</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pagination.page <= 1 || isPending}
              onClick={() => updateQuery(searchValue, currentFilter.type, pagination.page - 1)}
              className="gap-1 text-xs"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <div className="text-xs font-medium px-2">
              {pagination.page} / {pagination.totalPages}
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={pagination.page >= pagination.totalPages || isPending}
              onClick={() => updateQuery(searchValue, currentFilter.type, pagination.page + 1)}
              className="gap-1 text-xs"
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* MODAL 1: PREVIEW DO ADESIVO DE CAPACETE / CRACHÁ */}
      {selectedBadgeEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-background rounded-2xl max-w-md w-full border border-border shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <HardHat className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-foreground">Etiqueta para Capacete</h3>
              </div>
              <button
                onClick={() => setSelectedBadgeEmployee(null)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col items-center">
              {/* O Adesivo Estilizado */}
              <div
                id="helmet-sticker-preview"
                className="w-72 p-4 rounded-xl border-2 border-slate-900 bg-white text-slate-950 shadow-md flex flex-col items-center text-center"
              >
                {/* Header Empresa */}
                <div className="w-full border-b border-slate-200 pb-2 mb-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    CG CONSTRUÇÕES
                  </div>
                  <div className="text-xs font-bold text-slate-800">
                    CONTROLE DE ESTOQUE & EPI
                  </div>
                </div>

                {/* QR Code */}
                <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-xs mb-3">
                  <QRCodeSVG
                    value={
                      selectedBadgeEmployee.qrToken ||
                      (selectedBadgeEmployee.employeeCode
                        ? `EMP-${selectedBadgeEmployee.employeeCode}`
                        : selectedBadgeEmployee.id)
                    }
                    size={140}
                    level="H"
                    includeMargin={false}
                  />
                </div>

                {/* Matrícula em Destaque */}
                {selectedBadgeEmployee.employeeCode && (
                  <div className="font-mono text-sm font-extrabold px-2.5 py-0.5 rounded bg-slate-100 text-slate-900 border border-slate-300 mb-1">
                    MAT: {selectedBadgeEmployee.employeeCode}
                  </div>
                )}

                {/* Nome do Funcionário */}
                <div className="font-bold text-sm leading-tight line-clamp-2 text-slate-950 mt-1">
                  {selectedBadgeEmployee.name}
                </div>

                {/* CPF */}
                {selectedBadgeEmployee.document && (
                  <div className="text-[11px] font-mono text-slate-600 mt-1">
                    CPF: {formatDocument(selectedBadgeEmployee.document)}
                  </div>
                )}

                <div className="text-[9px] text-slate-400 font-mono mt-2 tracking-tighter">
                  {selectedBadgeEmployee.qrToken || `EMP-${selectedBadgeEmployee.employeeCode || selectedBadgeEmployee.id.slice(0, 8)}`}
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-4 text-center">
                Adesivo próprio para colar na lateral do capacete do operário. O almoxarife bipa diretamente na câmera do celular em <strong>Registrar Saída</strong>.
              </p>
            </div>

            <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const res = await regenerateEmployeeQrAction(selectedBadgeEmployee.id)
                  if (res.success && res.qrToken) {
                    setSelectedBadgeEmployee({
                      ...selectedBadgeEmployee,
                      qrToken: res.qrToken,
                    })
                  }
                }}
                className="gap-1.5 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regerar Token
              </Button>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedBadgeEmployee(null)}
                >
                  Fechar
                </Button>
                <Link
                  href={`/admin/employees/print-badges?ids=${selectedBadgeEmployee.id}`}
                  target="_blank"
                >
                  <Button size="sm" className="gap-1.5 bg-primary text-primary-foreground">
                    <Printer className="h-3.5 w-3.5" />
                    Imprimir Adesivo
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: NOVO FUNCIONÁRIO */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-background rounded-2xl max-w-md w-full border border-border shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <HardHat className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-foreground">Novo Funcionário de Campo</h3>
              </div>
              <button
                onClick={() => {
                  setIsNewModalOpen(false)
                  setActionError(null)
                }}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              action={async (formData) => {
                setActionError(null)
                const res = await createEmployeeAction(formData)
                if (res.error) {
                  setActionError(res.error)
                } else {
                  setIsNewModalOpen(false)
                  router.refresh()
                }
              }}
              className="p-6 space-y-4"
            >
              {actionError && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
                  {actionError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                  Nome Completo *
                </label>
                <Input
                  name="name"
                  required
                  placeholder="Ex: Carlos Eduardo de Oliveira"
                  className="bg-background"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                    Matrícula / Código
                  </label>
                  <Input
                    name="employeeCode"
                    placeholder="Ex: 018236"
                    className="font-mono bg-background"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                    CPF
                  </label>
                  <Input
                    name="document"
                    placeholder="000.000.000-00"
                    className="font-mono bg-background"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                  Telefone
                </label>
                <Input
                  name="phone"
                  placeholder="(85) 99999-9999"
                  className="bg-background"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                  Obra Vinculada
                </label>
                <select
                  name="worksiteId"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus:ring-1 focus:ring-primary"
                  defaultValue={worksites[0]?.id || ""}
                >
                  <option value="">Nenhuma / Sem vínculo inicial</option>
                  {worksites.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300">
                <strong>Importante:</strong> Este cadastro é exclusivo para a equipe de campo. Não será criada conta de login e nem exigido e-mail ou senha.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsNewModalOpen(false)
                    setActionError(null)
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="bg-primary text-primary-foreground">
                  Cadastrar Funcionário
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: EDITAR FUNCIONÁRIO */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-background rounded-2xl max-w-md w-full border border-border shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-foreground">Editar Colaborador</h3>
              </div>
              <button
                onClick={() => {
                  setEditingEmployee(null)
                  setActionError(null)
                }}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                setActionError(null)
                const formData = new FormData(e.currentTarget)
                const res = await updateEmployeeAction(editingEmployee.id, {
                  name: String(formData.get("name") || ""),
                  employeeCode: String(formData.get("employeeCode") || "") || null,
                  document: String(formData.get("document") || "") || null,
                  phone: String(formData.get("phone") || "") || null,
                  status: String(formData.get("status") || "ACTIVE"),
                  worksiteId: String(formData.get("worksiteId") || "") || null,
                })
                if (res.error) {
                  setActionError(res.error)
                } else {
                  setEditingEmployee(null)
                  router.refresh()
                }
              }}
              className="p-6 space-y-4"
            >
              {actionError && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
                  {actionError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                  Nome Completo *
                </label>
                <Input
                  name="name"
                  defaultValue={editingEmployee.name}
                  required
                  className="bg-background"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                    Matrícula / Código
                  </label>
                  <Input
                    name="employeeCode"
                    defaultValue={editingEmployee.employeeCode || ""}
                    className="font-mono bg-background"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                    CPF
                  </label>
                  <Input
                    name="document"
                    defaultValue={editingEmployee.document || ""}
                    className="font-mono bg-background"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                  Telefone
                </label>
                <Input
                  name="phone"
                  defaultValue={editingEmployee.phone || ""}
                  className="bg-background"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground uppercase tracking-wider mb-1">
                  Status
                </label>
                <select
                  name="status"
                  defaultValue={editingEmployee.status}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
                >
                  <option value="ACTIVE">Ativo</option>
                  <option value="INACTIVE">Inativo</option>
                </select>
              </div>

              <div className="flex justify-between items-center pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    await toggleEmployeeStatusAction(editingEmployee.id)
                    setEditingEmployee(null)
                    router.refresh()
                  }}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  {editingEmployee.status === "ACTIVE" ? "Inativar" : "Reativar"}
                </Button>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingEmployee(null)
                      setActionError(null)
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-primary text-primary-foreground">
                    Salvar Alterações
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
