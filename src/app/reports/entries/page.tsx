import { requirePermissionPage } from "@/lib/permissions"
import { Box } from "lucide-react"
import { MovementsReportTemplate } from "../components/movements-report-template"

export default async function EntriesReportPage(props: { searchParams: Promise<{ page?: string; warehouseId?: string }> }) {
  await requirePermissionPage('REPORT_VIEW')

  const params = await props.searchParams
  const page = Number(params.page) || 1

  return (
    <MovementsReportTemplate
      page={page}
      warehouseId={params.warehouseId}
      title="Entradas de Mercadorias"
      description="Histórico de recebimentos por período."
      icon={Box}
      typeFilter="ENTRY"
      basePath="/reports/entries"
    />
  )
}
