import { NextResponse } from "next/server"
import { getValidatedSession } from "@/lib/auth"
import { hasPermission } from "@/lib/permissions"

const QWEB_API_URL = process.env.QWEB_API_URL ?? "http://localhost:3085"
const QWEB_API_KEY = process.env.QWEB_API_KEY ?? ""
const PROXY_TIMEOUT_MS = 10_000

async function proxy(path: string, init?: RequestInit) {
  try {
    const res = await fetch(`${QWEB_API_URL}${path}`, {
      ...init,
      headers: { "X-Api-Key": QWEB_API_KEY },
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
      cache: "no-store",
    })
    const body = await res.text()
    try {
      return NextResponse.json(JSON.parse(body), { status: res.status })
    } catch {
      return NextResponse.json({ success: false, error: body }, { status: res.status })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha de conexão"
    return NextResponse.json(
      { success: false, error: `qweb-api indisponível: ${msg}` },
      { status: 502 },
    )
  }
}

async function requireAdmin() {
  const session = await getValidatedSession()
  if (!session) return { error: NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 }) }
  if (!(session.roles?.includes("ADMIN") || await hasPermission("CONFIG_MANAGE"))) {
    return { error: NextResponse.json({ success: false, error: "Sem permissão." }, { status: 403 }) }
  }
  return {}
}

/** GET /api/informakon/sync — status do scheduler e do último ciclo. */
export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error
  return proxy("/sync/status")
}

/** POST /api/informakon/sync — dispara um ciclo de sincronização manual. */
export async function POST() {
  const { error } = await requireAdmin()
  if (error) return error
  return proxy("/sync/run", { method: "POST" })
}
