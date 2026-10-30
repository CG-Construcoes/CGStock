import { expect, it, vi, beforeEach } from "vitest"

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) }),
}))
vi.mock("@/lib/dal", () => ({
  warehouseScopeIds: vi.fn().mockResolvedValue(null),
}))
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }))

const txUserWarehouseAccess = { deleteMany: vi.fn(), create: vi.fn() }
const txUserWorksiteAccess = { deleteMany: vi.fn() }

vi.mock("@/lib/db", () => ({
  db: {
    user: { findFirst: vi.fn() },
    warehouse: { findFirst: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    worksite: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    userWarehouseAccess: { upsert: vi.fn().mockResolvedValue({}), deleteMany: vi.fn(), create: vi.fn() },
    userWorksiteAccess: { deleteMany: vi.fn() },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
      cb({ userWarehouseAccess: txUserWarehouseAccess, userWorksiteAccess: txUserWorksiteAccess })
    ),
  },
}))

import { db } from "@/lib/db"
import {
  ensureWarehouseWorksite,
  resolveEmployeeForOperatorWarehouse,
} from "@/lib/employee-warehouse"

const asMock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>

const warehouses = {
  "wh-mahay": { id: "wh-mahay", code: "ALM-MAHAY", name: "Mahay", status: "ACTIVE", worksiteId: "ws-mahay" },
  "wh-central": { id: "wh-central", code: "ALM-CENTRAL", name: "Almoxarifado Central", status: "ACTIVE", worksiteId: "ws-central" },
  "wh-sem-obra": { id: "wh-sem-obra", code: "ALM-OUSY", name: "Ousy - Obra", status: "ACTIVE", worksiteId: null },
}

function makeEmployee(overrides: Record<string, unknown> = {}) {
  return {
    id: "emp-1",
    name: "Antonio Carlos",
    email: null,
    employeeCode: "1045",
    document: null,
    status: "ACTIVE",
    qrToken: "EMP-1045-QR",
    qrStatus: "ACTIVE",
    warehouseAccesses: [],
    worksiteAccesses: [],
    ...overrides,
  }
}

function mockWarehouseLookup() {
  asMock(db.warehouse.findFirst).mockImplementation(async (args: { where?: { id?: unknown; status?: string } } | undefined) => {
    const where = args?.where ?? {}
    if (typeof where.id === "string") {
      return (warehouses as Record<string, unknown>)[where.id] ?? null
    }
    return warehouses["wh-mahay"]
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockWarehouseLookup()
  asMock(db.worksite.findUnique).mockImplementation(async (args: { where: { id: string } }) => {
    const id = args.where.id
    return { id, name: id, status: "ACTIVE" }
  })
})

it("vincula automaticamente o colaborador ao almoxarifado na 1ª vez que é escaneado", async () => {
  vi.mocked(db.user.findFirst).mockResolvedValue(makeEmployee() as never)

  const res = await resolveEmployeeForOperatorWarehouse("EMP-1045-QR", "operador-1", {
    explicitWarehouseId: "wh-mahay",
  })

  expect(res.success).toBe(true)
  if (res.success) {
    expect(res.autoLinkedFirstTime).toBe(true)
    expect(res.warehouse.name).toBe("Mahay")
  }
  expect(db.userWarehouseAccess.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      create: expect.objectContaining({ userId: "emp-1", warehouseId: "wh-mahay" }),
    })
  )
})

it("atende direto quando o colaborador já pertence ao almoxarifado atual", async () => {
  vi.mocked(db.user.findFirst).mockResolvedValue(
    makeEmployee({
      warehouseAccesses: [{ warehouse: warehouses["wh-mahay"] }],
    }) as never
  )

  const res = await resolveEmployeeForOperatorWarehouse("EMP-1045-QR", "operador-1", {
    explicitWarehouseId: "wh-mahay",
  })

  expect(res.success).toBe(true)
  expect(db.userWarehouseAccess.upsert).not.toHaveBeenCalled()
  expect(db.$transaction).not.toHaveBeenCalled()
})

it("sinaliza transferência obrigatória quando o colaborador pertence a outro almoxarifado", async () => {
  vi.mocked(db.user.findFirst).mockResolvedValue(
    makeEmployee({
      warehouseAccesses: [{ warehouse: warehouses["wh-mahay"] }],
    }) as never
  )

  const res = await resolveEmployeeForOperatorWarehouse("EMP-1045-QR", "operador-1", {
    explicitWarehouseId: "wh-central",
  })

  expect(res.requiresTransfer).toBe(true)
  if (res.requiresTransfer) {
    expect(res.currentWarehouse.name).toBe("Mahay")
    expect(res.targetWarehouse.name).toBe("Almoxarifado Central")
    expect(res.employee.name).toBe("Antonio Carlos")
  }
  expect(db.userWarehouseAccess.upsert).not.toHaveBeenCalled()
  expect(db.$transaction).not.toHaveBeenCalled()
})

it("transfere o vínculo do colaborador quando o operador confirma a transferência", async () => {
  vi.mocked(db.user.findFirst).mockResolvedValue(
    makeEmployee({
      warehouseAccesses: [{ warehouse: warehouses["wh-mahay"] }],
    }) as never
  )

  const res = await resolveEmployeeForOperatorWarehouse("EMP-1045-QR", "operador-1", {
    explicitWarehouseId: "wh-central",
    confirmTransfer: true,
  })

  expect(res.success).toBe(true)
  if (res.success) {
    expect(res.transferredFromWarehouseName).toBe("Mahay")
    expect(res.warehouse.name).toBe("Almoxarifado Central")
  }
  expect(db.$transaction).toHaveBeenCalled()
  expect(txUserWarehouseAccess.deleteMany).toHaveBeenCalledWith({ where: { userId: "emp-1" } })
  expect(txUserWarehouseAccess.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ userId: "emp-1", warehouseId: "wh-central" }),
    })
  )
})

it("funciona com almoxarifado sem obra configurada (worksiteId nulo) criando espelho interno", async () => {
  vi.mocked(db.user.findFirst).mockResolvedValue(makeEmployee() as never)
  vi.mocked(db.worksite.findUnique).mockResolvedValue(null as never)
  vi.mocked(db.worksite.findFirst).mockResolvedValue(null as never)
  vi.mocked(db.worksite.create).mockResolvedValue({ id: "ws-mirror", name: "Ousy - Obra", status: "ACTIVE" } as never)

  const res = await resolveEmployeeForOperatorWarehouse("EMP-1045-QR", "operador-1", {
    explicitWarehouseId: "wh-sem-obra",
  })

  expect(res.success).toBe(true)
  if (res.success) {
    expect(res.warehouse.name).toBe("Ousy - Obra")
    expect(res.worksite.id).toBe("ws-mirror")
  }
  expect(db.worksite.create).toHaveBeenCalled()
  expect(db.warehouse.update).toHaveBeenCalledWith({
    where: { id: "wh-sem-obra" },
    data: { worksiteId: "ws-mirror" },
  })
})

it("não usa a obra do funcionário como autorização — só o almoxarifado", async () => {
  // Colaborador com obra legada inexistente em qualquer almoxarifado: não pode bloquear
  vi.mocked(db.user.findFirst).mockResolvedValue(
    makeEmployee({
      worksiteAccesses: [{ worksite: { id: "ws-aleatoria", name: "Obra Sem Almoxarifado", status: "ACTIVE" } }],
    }) as never
  )

  const res = await resolveEmployeeForOperatorWarehouse("EMP-1045-QR", "operador-1", {
    explicitWarehouseId: "wh-mahay",
  })

  expect(res.success).toBe(true)
  expect("error" in res && res.error).toBeFalsy()
})

it("rejeita funcionário inativo, QR revogado ou código inexistente", async () => {
  vi.mocked(db.user.findFirst).mockResolvedValue(null as never)
  expect(await resolveEmployeeForOperatorWarehouse("XXX", "operador-1")).toEqual({
    error: "Funcionário não encontrado ou código inválido.",
  })

  vi.mocked(db.user.findFirst).mockResolvedValue(makeEmployee({ status: "INACTIVE" }) as never)
  expect(await resolveEmployeeForOperatorWarehouse("EMP-1045-QR", "operador-1")).toEqual({
    error: "Funcionário inativo.",
  })

  vi.mocked(db.user.findFirst).mockResolvedValue(makeEmployee({ qrStatus: "REVOKED" }) as never)
  expect(await resolveEmployeeForOperatorWarehouse("EMP-1045-QR", "operador-1")).toEqual({
    error: "QR Code revogado.",
  })
})

it("ensureWarehouseWorksite reutiliza worksite existente do almoxarifado", async () => {
  const ws = await ensureWarehouseWorksite({
    id: "wh-mahay",
    code: "ALM-MAHAY",
    name: "Mahay",
    worksiteId: "ws-mahay",
  })

  expect(ws.id).toBe("ws-mahay")
  expect(ws.name).toBe("Mahay")
  expect(db.worksite.create).not.toHaveBeenCalled()
  expect(db.warehouse.update).not.toHaveBeenCalled()
})
