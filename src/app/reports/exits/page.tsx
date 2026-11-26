import { requirePermissionPage } from "@/lib/permissions"
import { Box } from "lucide-react"
import { MovementsReportTemplate, type ReportSearchParams } from "../components/movements-report-template"

export default async function ExitsReportPage(props: { searchParams: Promise<ReportSearchParams> }) {
  await requirePermissionPage('REPORT_VIEW')

  const params = await props.searchParams

  return (
    <MovementsReportTemplate
      searchParams={params}
      title="Saídas de Materiais"
      description="Histórico de requisições atendidas."
      icon={Box}
      typeFilter="EXIT"
      basePath="/reports/exits"
    />
  )
}
