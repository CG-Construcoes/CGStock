import { requirePermissionPage } from "@/lib/permissions"
import { ArrowRightLeft } from "lucide-react"
import { MovementsReportTemplate } from "../components/movements-report-template"

export default async function TransfersReportPage(props: { searchParams: Promise<{ page?: string; warehouseId?: string }> }) {
  await requirePermissionPage('REPORT_VIEW')

  const params = await props.searchParams
  const page = Number(params.page) || 1

  return (
    <MovementsReportTemplate
      page={page}
      warehouseId={params.warehouseId}
      title="Transferências"
      description="Remanejos internos de mercadorias."
      icon={ArrowRightLeft}
      typeFilter={{ in: ['TRANSFER_IN', 'TRANSFER_OUT'] }}
      basePath="/reports/transfers"
    />
  )
}
