import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server"
import { SignJWT } from "jose"

vi.mock("@/lib/auth-secret", () => ({ jwtKey: new TextEncoder().encode("test-secret-for-proxy-regression-only") }))
import proxy, { config } from "@/proxy"
import { jwtKey } from "@/lib/auth-secret"

const origin = "https://cgstock.example.com"
let session: string

beforeEach(async () => {
  vi.stubEnv("APP_URL", origin)
  session = await new SignJWT({ userId: "u1", roles: ["ADMIN"] })
    .setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(jwtKey)
})
afterEach(() => vi.unstubAllEnvs())

function request(headers: Record<string, string> = {}, method = "POST") {
  return new NextRequest(`${origin}/api/sync/receipt`, {
    method, headers: { cookie: `session=${session}`, ...headers },
  })
}

describe("proteção das rotas de API", () => {
  it("bloqueia POST de outro site mesmo com cookie válido", async () => {
    expect((await proxy(request({ origin: "https://attacker.example" }))).status).toBe(403)
    expect((await proxy(request({ origin: "null" }))).status).toBe(403)
  })

  it("bloqueia formulário de subdomínio e Fetch Metadata sem Origin", async () => {
    expect((await proxy(request({ origin: "https://other.example.com" }))).status).toBe(403)
    expect((await proxy(request({ "sec-fetch-site": "cross-site" }))).status).toBe(403)
    expect((await proxy(request({ "sec-fetch-site": "same-site" }))).status).toBe(403)
  })

  it("aceita o domínio público atrás do proxy da hospedagem", async () => {
    const req = new NextRequest("http://localhost:3000/api/sync/receipt", {
      method: "POST", headers: { cookie: `session=${session}`, origin },
    })
    expect((await proxy(req)).status).toBe(200)
  })

  it("mantém sincronização same-origin e clientes sem Origin", async () => {
    const cases: Record<string, string>[] = [{ origin }, { "sec-fetch-site": "same-origin" }, {}]
    for (const headers of cases) {
      const response = await proxy(request(headers))
      expect(response.status).toBe(200)
      expect(response.headers.get("Cache-Control")).toBe("private, no-store")
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff")
    }
  })

  it("não aceita token de redefinição como cookie de sessão", async () => {
    session = await new SignJWT({ purpose: "password-reset", sub: "u1" })
      .setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(jwtKey)
    expect((await proxy(request({}, "GET"))).status).toBe(401)
  })

  it("protege API mesmo quando o caminho termina em extensão", () => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: "/api/admin/backup/export.json" })).toBe(true)
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: "/_next/static/chunk.js" })).toBe(false)
  })
})
