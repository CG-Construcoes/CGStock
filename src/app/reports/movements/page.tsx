import { requirePermissionPage } from "@/lib/permissions"
import { ArrowRightLeft } from "lucide-react"
import { MovementsReportTemplate, type ReportSearchParams } from "../components/movements-report-template"

export default async function MovementsReportPage(props: { searchParams: Promise<ReportSearchParams> }) {
  await requirePermissionPage('REPORT_VIEW')

  const params = await props.searchParams

  return (
    <MovementsReportTemplate
      searchParams={params}
      title="Extrato de Movimentações"
      description="Histórico completo de transações em ordem cronológica."
      icon={ArrowRightLeft}
      basePath="/reports/movements"
    />
  )
}
