import { getValidatedSession } from "@/lib/auth"
import { buildBackupData } from "@/lib/backup"
import { logAudit } from "@/lib/audit"
import { gzipSync } from "zlib"

export const dynamic = "force-dynamic"
export const maxDuration = 120

/** GET /api/admin/backup/export — baixa todas as tabelas em .json.gz (somente ADMIN) */
export async function GET() {
  const session = await getValidatedSession()
  if (!session?.roles?.includes("ADMIN")) {
    return Response.json({ error: "Apenas administradores podem exportar o backup." }, { status: 403 })
  }

  try {
    const data = await buildBackupData()
    const gz = gzipSync(Buffer.from(JSON.stringify(data), "utf8"), { level: 9 })
    const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-")

    logAudit("BACKUP_EXPORTED", "System", session.userId, {
      fileName: `cgstock-backup-${stamp}.json.gz`,
      tables: Object.keys(data.tables).length,
      sizeBytes: gz.length,
    }).catch(() => {})

    return new Response(new Uint8Array(gz), {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="cgstock-backup-${stamp}.json.gz"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    console.error("Backup export failed:", err)
    return Response.json({ error: "Falha ao gerar o backup." }, { status: 500 })
  }
}
