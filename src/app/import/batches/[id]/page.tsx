import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { requirePermissionPage } from "@/lib/permissions"
import { PreviewClient } from "./preview-client"

export const metadata = {
  title: "Preview de Importação | CGStock",
}

export default async function ImportPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage('CONFIG_MANAGE')
  const resolvedParams = await params

  const batch = await db.importBatch.findUnique({
    where: { id: resolvedParams.id },
    include: {
      warehouse: true,
      rows: true,
      createdBy: true
    }
  })

  if (!batch) notFound()

  return <PreviewClient batch={batch} />
}
