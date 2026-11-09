import { getValidatedSession } from "@/lib/auth"
import { restoreBackupData } from "@/lib/backup"
import { logAudit } from "@/lib/audit"
import { gunzipSync } from "zlib"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * POST /api/admin/backup/import — restaura um backup completo.
 * ATENÇÃO: substitui todo o conteúdo do banco (somente ADMIN).
 */
export async function POST(req: Request) {
  const session = await getValidatedSession()
  if (!session?.roles?.includes("ADMIN")) {
    return Response.json({ error: "Apenas administradores podem restaurar um backup." }, { status: 403 })
  }

  try {
    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File)) {
      return Response.json({ error: "Selecione o arquivo de backup (.json.gz ou .json)." }, { status: 400 })
    }

    let buf = Buffer.from(await file.arrayBuffer())
    // gzip magic bytes 1f 8b — aceita .json.gz e .json puro
    if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf)

    let payload: unknown
    try {
      payload = JSON.parse(buf.toString("utf8"))
    } catch {
      return Response.json({ error: "Arquivo corrompido ou não é um backup válido." }, { status: 400 })
    }

    const summary = await restoreBackupData(payload)
    const totalRows = Object.values(summary).reduce((s, n) => s + n, 0)

    logAudit("BACKUP_RESTORED", "System", session.userId, {
      fileName: file.name,
      tables: Object.keys(summary).length,
      totalRows,
    }).catch(() => {})

    return Response.json({ success: true, totalRows, summary })
  } catch (err) {
    console.error("Backup restore failed:", err)
    const message = err instanceof Error ? err.message : "Falha ao restaurar o backup."
    return Response.json({ error: message }, { status: 500 })
  }
}
