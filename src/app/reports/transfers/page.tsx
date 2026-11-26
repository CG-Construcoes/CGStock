import { requirePermissionPage } from "@/lib/permissions"
import { ArrowRightLeft } from "lucide-react"
import { MovementsReportTemplate, type ReportSearchParams } from "../components/movements-report-template"

export default async function TransfersReportPage(props: { searchParams: Promise<ReportSearchParams> }) {
  await requirePermissionPage('REPORT_VIEW')

  const params = await props.searchParams

  return (
    <MovementsReportTemplate
      searchParams={params}
      title="Transferências"
      description="Remanejos internos de mercadorias."
      icon={ArrowRightLeft}
      typeFilter={{ in: ['TRANSFER_IN', 'TRANSFER_OUT'] }}
      basePath="/reports/transfers"
    />
  )
}
