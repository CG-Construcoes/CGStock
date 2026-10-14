import { requirePermissionPage } from "@/lib/permissions"
import { AlertTriangle } from "lucide-react"
import { MovementsReportTemplate } from "../components/movements-report-template"

export default async function AdjustmentsReportPage(props: { searchParams: Promise<{ page?: string; warehouseId?: string }> }) {
  await requirePermissionPage('REPORT_VIEW')

  const params = await props.searchParams
  const page = Number(params.page) || 1

  return (
    <MovementsReportTemplate
      page={page}
      warehouseId={params.warehouseId}
      title="Ajustes de Estoque"
      description="Histórico de correções manuais de inventário."
      icon={AlertTriangle}
      typeFilter={{ in: ['ADJUSTMENT_IN', 'ADJUSTMENT_OUT'] }}
      basePath="/reports/adjustments"
    />
  )
}
