import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({ db: { userWarehouseAccess: { findMany: vi.fn() } } }))
vi.mock("@/lib/user-context", () => ({ getUserSecurityContext: vi.fn() }))
vi.mock("@/lib/auth", () => ({ getValidatedSession: vi.fn() }))

import { db } from "@/lib/db"
import { getUserSecurityContext } from "@/lib/user-context"
import { assertWarehouseAccess, warehouseIdFilter, warehouseScopeIds } from "@/lib/dal"

const context = (roles: string[], all = false) => ({ roleNames: roles, allWarehouseAccess: all, status: "ACTIVE", sessionVersion: 0, permissionKeys: new Set<string>(), mustChangePassword: false })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(db.userWarehouseAccess.findMany).mockResolvedValue([])
})

describe("escopo individual de almoxarifados", () => {
  it("João não consulta nem opera no almoxarifado alheio", async () => {
    vi.mocked(getUserSecurityContext).mockResolvedValue(context(["ALMOXARIFE"]))
    vi.mocked(db.userWarehouseAccess.findMany).mockResolvedValue([{ warehouseId: "central" }] as never)
    expect(await warehouseScopeIds("joao")).toEqual(["central"])
    await expect(assertWarehouseAccess("obra-a", "joao")).rejects.toThrow("Não autorizado")
    await expect(assertWarehouseAccess("importado-amanha", "joao")).rejects.toThrow("Não autorizado")
  })

  it("Maria acessa seus dois vínculos e não um terceiro", async () => {
    vi.mocked(getUserSecurityContext).mockResolvedValue(context(["GESTOR"]))
    vi.mocked(db.userWarehouseAccess.findMany).mockResolvedValue([{ warehouseId: "central" }, { warehouseId: "obra-a" }] as never)
    expect(await warehouseScopeIds("maria")).toEqual(["central", "obra-a"])
    await expect(assertWarehouseAccess("obra-b", "maria")).rejects.toThrow("Não autorizado")
  })

  it("Pedro acessa almoxarifados futuros sem obter ADMIN", async () => {
    vi.mocked(getUserSecurityContext).mockResolvedValue(context(["ALMOXARIFE"], true))
    expect(await warehouseScopeIds("pedro")).toBeNull()
    await expect(assertWarehouseAccess("importado-amanha", "pedro")).resolves.toBeUndefined()
  })

  it("ADMIN acessa todos independentemente da lista", async () => {
    vi.mocked(getUserSecurityContext).mockResolvedValue(context(["ADMIN"]))
    expect(await warehouseScopeIds("admin")).toBeNull()
    await expect(assertWarehouseAccess("importado-amanha", "admin")).resolves.toBeUndefined()
  })

  it("filtro de consultas nega acesso quando não existem vínculos", async () => {
    vi.mocked(getUserSecurityContext).mockResolvedValue(context(["ALMOXARIFE"]))
    expect(await warehouseIdFilter("sem-acesso")).toEqual({ warehouseId: { in: [] } })
  })

  it("alterações do administrador são refletidas na próxima consulta", async () => {
    vi.mocked(getUserSecurityContext).mockResolvedValue(context(["ALMOXARIFE"]))
    vi.mocked(db.userWarehouseAccess.findMany)
      .mockResolvedValueOnce([{ warehouseId: "central" }] as never)
      .mockResolvedValueOnce([{ warehouseId: "obra-a" }] as never)
    expect(await warehouseScopeIds("joao")).toEqual(["central"])
    expect(await warehouseScopeIds("joao")).toEqual(["obra-a"])
  })

  it("ausência de vínculos não libera todos", async () => {
    vi.mocked(getUserSecurityContext).mockResolvedValue(context(["TI"]))
    expect(await warehouseScopeIds("sem-acesso")).toEqual([])
    await expect(assertWarehouseAccess("central", "sem-acesso")).rejects.toThrow("Não autorizado")
  })
})
