import { db } from "@/lib/db"
import { warehouseScopeIds } from "@/lib/dal"
import { notFound } from "next/navigation"
import { requirePermissionPage } from "@/lib/permissions"
import { PreviewClient } from "./preview-client"

export const metadata = {
  title: "Preview de Importação | CGStock",
}

export default async function ImportPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage('CONFIG_MANAGE')
  const resolvedParams = await params

  const scope = await warehouseScopeIds()
  const batch = await db.importBatch.findFirst({
    where: { id: resolvedParams.id, warehouseId: { in: scope ?? undefined } },
    include: {
      warehouse: true,
      rows: true,
      createdBy: true
    }
  })

  if (!batch) notFound()

  return <PreviewClient batch={batch} />
}
