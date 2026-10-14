import { requirePermissionPage } from "@/lib/permissions"
import { Box } from "lucide-react"
import { MovementsReportTemplate } from "../components/movements-report-template"

export default async function ExitsReportPage(props: { searchParams: Promise<{ page?: string; warehouseId?: string }> }) {
  await requirePermissionPage('REPORT_VIEW')

  const params = await props.searchParams
  const page = Number(params.page) || 1

  return (
    <MovementsReportTemplate
      page={page}
      warehouseId={params.warehouseId}
      title="Saídas de Materiais"
      description="Histórico de requisições atendidas."
      icon={Box}
      typeFilter="EXIT"
      basePath="/reports/exits"
    />
  )
}
