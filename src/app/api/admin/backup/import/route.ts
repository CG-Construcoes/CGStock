import { getValidatedSession } from "@/lib/auth"
import { restoreBackupData } from "@/lib/backup"
import { logAudit } from "@/lib/audit"
import { gunzipSync } from "zlib"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * POST /api/admin/backup/import — restaura um backup completo.
 * ATENÇÃO: substitui todo o conteúdo do banco (somente ADMIN).
 * Responde em NDJSON streaming: uma linha JSON por evento
 * ({type:"progress"} por etapa, {type:"done"} ou {type:"error"} no fim).
 */
export async function POST(req: Request) {
  const session = await getValidatedSession()
  if (!session?.roles?.includes("ADMIN")) {
    return Response.json({ error: "Apenas administradores podem restaurar um backup." }, { status: 403 })
  }

  let payload: unknown
  let fileName = "backup"
  try {
    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File)) {
      return Response.json({ error: "Selecione o arquivo de backup (.json.gz ou .json)." }, { status: 400 })
    }
    fileName = file.name

    let buf = Buffer.from(await file.arrayBuffer())
    // gzip magic bytes 1f 8b — aceita .json.gz e .json puro
    if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf)

    try {
      payload = JSON.parse(buf.toString("utf8"))
    } catch {
      return Response.json({ error: "Arquivo corrompido ou não é um backup válido." }, { status: 400 })
    }
  } catch {
    return Response.json({ error: "Falha ao ler o arquivo enviado." }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"))
      }
      try {
        const summary = await restoreBackupData(payload, (p) => send({ type: "progress", ...p }))
        const totalRows = Object.values(summary).reduce((s, n) => s + n, 0)

        logAudit("BACKUP_RESTORED", "System", session.userId, {
          fileName,
          tables: Object.keys(summary).length,
          totalRows,
        }).catch(() => {})

        send({ type: "done", success: true, totalRows, tables: Object.keys(summary).length })
      } catch (err) {
        console.error("Backup restore failed:", err)
        send({ type: "error", error: err instanceof Error ? err.message : "Falha ao restaurar o backup." })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  })
}
