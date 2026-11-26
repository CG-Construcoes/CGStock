import { requirePermissionPage } from "@/lib/permissions"
import { RotateCcw } from "lucide-react"
import { MovementsReportTemplate, type ReportSearchParams } from "../components/movements-report-template"

export default async function ReturnsReportPage(props: { searchParams: Promise<ReportSearchParams> }) {
  await requirePermissionPage('REPORT_VIEW')

  const params = await props.searchParams

  return (
    <MovementsReportTemplate
      searchParams={params}
      title="Devoluções"
      description="Histórico de materiais retornados."
      icon={RotateCcw}
      typeFilter="RETURN"
      basePath="/reports/returns"
    />
  )
}
