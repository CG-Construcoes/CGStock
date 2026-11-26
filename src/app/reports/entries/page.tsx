import { requirePermissionPage } from "@/lib/permissions"
import { Box } from "lucide-react"
import { MovementsReportTemplate, type ReportSearchParams } from "../components/movements-report-template"

export default async function EntriesReportPage(props: { searchParams: Promise<ReportSearchParams> }) {
  await requirePermissionPage('REPORT_VIEW')

  const params = await props.searchParams

  return (
    <MovementsReportTemplate
      searchParams={params}
      title="Entradas de Mercadorias"
      description="Histórico de recebimentos por período."
      icon={Box}
      typeFilter="ENTRY"
      basePath="/reports/entries"
    />
  )
}
