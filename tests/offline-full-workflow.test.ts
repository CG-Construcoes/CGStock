import { describe, expect, it, vi, beforeEach } from "vitest"
import {
  OFFLINE_MIN_TTL_MS,
  computeSnapshotExpiry,
  isSnapshotAvailableOffline,
  isSnapshotStale,
  resolveEmployeeOffline,
  getProductStockOffline,
} from "@/lib/offline-snapshot"
import {
  sortSyncTasksWithDependencies,
  resolveDependentPayload,
  SYNC_ENDPOINT_MAP,
} from "@/lib/offline-sync"
import type { CatalogSnapshotData, StockSnapshotData, SyncQueueTask } from "@/lib/localdb"
import { payloadHash } from "@/lib/sync-idempotency"

const sampleCatalog: CatalogSnapshotData = {
  products: [
    {
      id: "prod-1",
      code: "MAT-001",
      barcode: "7890000111111",
      name: "Capacete de Segurança Branco",
      unitId: "unit-1",
      unitCode: "UN",
      categoryId: "cat-1",
      categoryName: "EPI",
      minimumStock: 5,
      maximumStock: 100,
      averageCost: 45.5,
      status: "ACTIVE",
    },
    {
      id: "prod-2",
      code: "MAT-002",
      barcode: "7890000222222",
      name: "Cimento CP-II 50kg",
      unitId: "unit-2",
      unitCode: "SC",
      categoryId: "cat-2",
      categoryName: "Básico",
      minimumStock: 20,
      maximumStock: 500,
      averageCost: 38.0,
      status: "ACTIVE",
    },
  ],
  warehouses: [
    { id: "wh-1", code: "ALM-01", name: "Almoxarifado Obra Norte", worksiteId: "ws-1", status: "ACTIVE" },
    { id: "wh-2", code: "ALM-02", name: "Almoxarifado Central", worksiteId: "ws-2", status: "ACTIVE" },
  ],
  locations: [
    { id: "loc-1", warehouseId: "wh-1", code: "COR-A1", name: "Corredor A1", status: "ACTIVE" },
    { id: "loc-2", warehouseId: "wh-1", code: "COR-A2", name: "Corredor A2", status: "ACTIVE" },
  ],
  suppliers: [{ id: "sup-1", name: "Fornecedor ABC", document: "12345678000199" }],
  units: [
    { id: "unit-1", code: "UN", name: "Unidade" },
    { id: "unit-2", code: "SC", name: "Saco" },
  ],
  categories: [
    { id: "cat-1", name: "EPI" },
    { id: "cat-2", name: "Básico" },
  ],
  worksites: [
    { id: "ws-1", code: "OBRA-01", name: "Residencial Horizonte", status: "ACTIVE" },
    { id: "ws-2", code: "OBRA-02", name: " Sede Central", status: "ACTIVE" },
  ],
  employees: [
    {
      id: "emp-1",
      name: "Carlos Silva",
      email: "carlos@cg.com.br",
      employeeCode: "1045",
      document: "123.456.789-01",
      qrToken: "EMP-1045-QR",
      qrStatus: "ACTIVE",
      status: "ACTIVE",
      roles: ["SOLICITANTE"],
      worksites: [{ id: "ws-1", code: "OBRA-01", name: "Residencial Horizonte", status: "ACTIVE" }],
    },
    {
      id: "emp-revoked",
      name: "Pedro Revogado",
      email: "pedro@cg.com.br",
      employeeCode: "2099",
      document: "98765432100",
      qrToken: "EMP-2099-QR",
      qrStatus: "REVOKED",
      status: "ACTIVE",
      roles: ["SOLICITANTE"],
      worksites: [{ id: "ws-1", code: "OBRA-01", name: "Residencial Horizonte", status: "ACTIVE" }],
    },
    {
      id: "emp-inactive",
      name: "Marcos Inativo",
      email: "marcos@cg.com.br",
      employeeCode: "3050",
      document: "11122233344",
      qrToken: "EMP-3050-QR",
      qrStatus: "ACTIVE",
      status: "INACTIVE",
      roles: ["SOLICITANTE"],
      worksites: [{ id: "ws-1", code: "OBRA-01", name: "Residencial Horizonte", status: "ACTIVE" }],
    },
  ],
}

const sampleStock: StockSnapshotData = {
  items: [
    { productId: "prod-1", warehouseId: "wh-1", locationId: "loc-1", quantity: 10, reservedQuantity: 0 },
    { productId: "prod-1", warehouseId: "wh-1", locationId: "loc-2", quantity: 5, reservedQuantity: 0 },
  ],
}

describe("Cenários Obrigatórios Offline (48h+, QR Code, Entrega Rápida, Dependências e Conflitos)", () => {
  it("garante suporte mínimo superior a 48h (72h+) e não descarta nem bloqueia dados após esse prazo", () => {
    const now = Date.now()
    const expiry = computeSnapshotExpiry(null, now)
    expect(expiry.getTime() - now).toBeGreaterThanOrEqual(48 * 60 * 60 * 1000)
    expect(OFFLINE_MIN_TTL_MS).toBeGreaterThanOrEqual(48 * 60 * 60 * 1000)

    // Simula dispositivo sem internet há 60 horas (> 48h) e há 96 horas (> 72h)
    const snapshot = {
      id: "user-1:catalog",
      userId: "user-1",
      module: "catalog",
      downloadedAt: new Date(now - 96 * 60 * 60 * 1000),
      expiresAt: new Date(now - 24 * 60 * 60 * 1000),
      data: sampleCatalog,
    }

    // O sistema nunca deve apagar dados nem deixar de funcionar offline após 48h/72h
    expect(isSnapshotAvailableOffline(snapshot, "user-1")).toBe(true)
    expect(isSnapshotAvailableOffline(snapshot, "outro-user")).toBe(false)
    expect(isSnapshotStale(snapshot, now)).toBe(true)
  })

  it("resolve QR Code, matrícula e CPF de colaborador 100% offline", () => {
    // 1. Pelo token QR do capacete/crachá
    const byQr = resolveEmployeeOffline("EMP-1045-QR", sampleCatalog)
    expect(byQr.success).toBe(true)
    if (byQr.success) {
      expect(byQr.employee.name).toBe("Carlos Silva")
      // O sistema opera por almoxarifado; a obra é apenas um detalhe interno de FK
      expect(byQr.worksite.id).toBe("ws-1")
      expect(byQr.worksite.name).toBe("Almoxarifado Obra Norte")
      expect(byQr.warehouse.id).toBe("wh-1")
    }

    // 2. Pela matrícula (employeeCode)
    const byCode = resolveEmployeeOffline("1045", sampleCatalog)
    expect(byCode.success).toBe(true)
    if (byCode.success) {
      expect(byCode.employee.id).toBe("emp-1")
    }

    // 3. Pelo CPF com ou sem pontuação
    const byCpf = resolveEmployeeOffline("12345678901", sampleCatalog)
    expect(byCpf.success).toBe(true)
    if (byCpf.success) {
      expect(byCpf.employee.id).toBe("emp-1")
    }

    // 4. Rejeita QR revogado ou funcionário inativo
    expect(resolveEmployeeOffline("EMP-2099-QR", sampleCatalog)).toEqual({ error: "QR Code revogado." })
    expect(resolveEmployeeOffline("3050", sampleCatalog)).toEqual({ error: "Funcionário inativo." })
    expect(resolveEmployeeOffline("INEXISTENTE", sampleCatalog)).toEqual({
      error: "Funcionário não encontrado ou código inválido.",
    })
  })

  it("consulta produtos e saldo por obra/almoxarifado offline na Entrega Rápida", () => {
    // Busca por código exato
    const byCode = getProductStockOffline(sampleCatalog, sampleStock, "wh-1", "MAT-001")
    expect(byCode.success).toBe(true)
    if (byCode.success) {
      expect(byCode.totalAvailable).toBe(15)
      expect(byCode.locations).toHaveLength(2)
      expect(byCode.locations[0]).toEqual({ locationId: "loc-1", locationCode: "COR-A1", quantity: 10 })
    }

    // Busca por código de barras
    const byBarcode = getProductStockOffline(sampleCatalog, sampleStock, "wh-1", "7890000111111")
    expect(byBarcode.success).toBe(true)

    // Produto sem saldo no almoxarifado retorna erro amigável
    const noStock = getProductStockOffline(sampleCatalog, sampleStock, "wh-1", "MAT-002")
    expect(noStock).toEqual({ error: "Este produto não possui estoque disponível neste almoxarifado." })
  })

  it("ordena a fila de sincronização respeitando dependências e resolve IDs temporários", () => {
    const t0 = new Date("2026-10-29T10:00:00.000Z")
    const tasks: SyncQueueTask[] = [
      {
        id: 2,
        operation: "SUBMIT_COLLECTION",
        entityId: "col-1",
        userId: "user-1",
        payload: { inventoryId: "offline-inv-abc", locationId: "loc-1", items: [{ productId: "prod-1", quantity: 8 }] },
        status: "PENDING",
        attempts: 0,
        createdAt: t0,
        dependsOnEntityId: "offline-inv-abc",
      },
      {
        id: 1,
        operation: "CREATE_INVENTORY",
        entityId: "inv-op-1",
        userId: "user-1",
        payload: { name: "Inventário Mensal", warehouseId: "wh-1", locationIds: ["loc-1"], operatorIds: ["user-1"] },
        status: "PENDING",
        attempts: 0,
        createdAt: t0,
        clientTempId: "offline-inv-abc",
      },
      {
        id: 3,
        operation: "CREATE_QUICK_ISSUE",
        entityId: "qi-1",
        userId: "user-1",
        payload: { qrToken: "1045", items: [{ productCode: "MAT-001", quantity: 1 }] },
        status: "PENDING",
        attempts: 0,
        createdAt: t0,
      },
      {
        id: 4,
        operation: "CREATE_RECEIPT",
        entityId: "rec-1",
        userId: "user-1",
        payload: { warehouseId: "wh-1", supplierId: "sup-1", items: [] },
        status: "PENDING",
        attempts: 0,
        createdAt: t0,
      },
    ]

    const sorted = sortSyncTasksWithDependencies(tasks)
    // Entrada (CREATE_RECEIPT) e Criação de Inventário (CREATE_INVENTORY) vêm antes de Coleta (SUBMIT_COLLECTION) e Saída (CREATE_QUICK_ISSUE)
    const opsOrder = sorted.map((t) => t.operation)
    expect(opsOrder.indexOf("CREATE_INVENTORY")).toBeLessThan(opsOrder.indexOf("SUBMIT_COLLECTION"))
    expect(opsOrder.indexOf("CREATE_RECEIPT")).toBeLessThan(opsOrder.indexOf("CREATE_QUICK_ISSUE"))

    // Mapeia o ID temporário criado offline para o ID definitivo retornado pelo servidor
    const idMap = new Map<string, string>([["offline-inv-abc", "server-inv-999"]])
    const resolvedPayload = resolveDependentPayload(tasks[0].payload, idMap)
    expect(resolvedPayload.inventoryId).toBe("server-inv-999")
  })

  it("mapeia todos os tipos de operações offline para seus endpoints de sincronização", () => {
    expect(SYNC_ENDPOINT_MAP.CREATE_QUICK_ISSUE).toBe("/api/sync/quick-issue")
    expect(SYNC_ENDPOINT_MAP.SUBMIT_COLLECTION).toBe("/api/sync")
    expect(SYNC_ENDPOINT_MAP.CREATE_RECEIPT).toBe("/api/sync/receipt")
    expect(SYNC_ENDPOINT_MAP.CONFIRM_RECEIPT).toBe("/api/sync/receipt-confirm")
    expect(SYNC_ENDPOINT_MAP.CREATE_INVENTORY).toBe("/api/sync/inventory")
    expect(SYNC_ENDPOINT_MAP.CREATE_ADJUSTMENT).toBe("/api/sync/adjustment")
    expect(SYNC_ENDPOINT_MAP.CREATE_TRANSFER).toBe("/api/sync/transfer")
    expect(SYNC_ENDPOINT_MAP.CREATE_RETURN).toBe("/api/sync/return")
    expect(SYNC_ENDPOINT_MAP.CREATE_REQUEST).toBe("/api/sync/request")
    expect(SYNC_ENDPOINT_MAP.FULFILL_REQUEST).toBe("/api/sync/fulfill")
    expect(SYNC_ENDPOINT_MAP.REQUEST_STATUS).toBe("/api/sync/request-status")
  })
})

const syncMocks = vi.hoisted(() => ({
  session: vi.fn(),
  permission: vi.fn(),
  warehouseAccess: vi.fn(),
  warehouseScope: vi.fn(),
  replayFind: vi.fn(),
  userFindFirst: vi.fn(),
  warehouseFindFirst: vi.fn(),
  productFindMany: vi.fn(),
  issueCount: vi.fn(),
  locationCount: vi.fn(),
  inventoryFindFirst: vi.fn(),
  receiptFindUnique: vi.fn(),
  transaction: vi.fn(),
  stockMovement: vi.fn(),
}))

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>()
  return { ...actual, getValidatedSession: syncMocks.session }
})
vi.mock("@/lib/permissions", () => ({ hasPermission: syncMocks.permission }))
vi.mock("@/lib/dal", () => ({
  assertWarehouseAccess: syncMocks.warehouseAccess,
  warehouseScopeIds: syncMocks.warehouseScope,
}))
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }))
vi.mock("@/lib/stock", () => ({ createStockMovement: syncMocks.stockMovement }))
vi.mock("@/lib/db", () => ({
  db: {
    offlineSyncOperation: { findUnique: syncMocks.replayFind },
    user: { findFirst: syncMocks.userFindFirst, findUnique: syncMocks.userFindFirst },
    warehouse: { findFirst: syncMocks.warehouseFindFirst },
    warehouseLocation: { count: syncMocks.locationCount },
    product: { findMany: syncMocks.productFindMany },
    quickIssue: { count: syncMocks.issueCount },
    inventory: { findFirst: syncMocks.inventoryFindFirst },
    stockReceipt: { findUnique: syncMocks.receiptFindUnique },
    $transaction: syncMocks.transaction,
  },
}))

describe("Sincronização de Entrega Rápida (/api/sync/quick-issue): Idempotência e Conflitos de Estoque", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    syncMocks.session.mockResolvedValue({ userId: "op-1", roles: ["ALMOXARIFE"] })
    syncMocks.permission.mockResolvedValue(true)
    syncMocks.warehouseAccess.mockResolvedValue(undefined)
    syncMocks.warehouseScope.mockResolvedValue(["wh-1"])
    syncMocks.replayFind.mockResolvedValue(null)
    syncMocks.userFindFirst.mockResolvedValue({
      id: "emp-1",
      status: "ACTIVE",
      qrStatus: "ACTIVE",
      qrToken: "EMP-1045-QR",
      worksiteAccesses: [{ worksite: { id: "ws-1", status: "ACTIVE" } }],
    })
    syncMocks.warehouseFindFirst.mockResolvedValue({ id: "wh-1", worksiteId: "ws-1", status: "ACTIVE" })
    syncMocks.productFindMany.mockResolvedValue([{ id: "prod-1", code: "MAT-001", barcode: "7890000111111" }])
    syncMocks.issueCount.mockResolvedValue(10)
    syncMocks.stockMovement.mockResolvedValue({ movement: { id: "mov-1" } })
  })

  it("processa entrega rápida offline por matrícula/QR, debita estoque e evita duplicação em reenvio (idempotência)", async () => {
    const { POST } = await import("@/app/api/sync/quick-issue/route")
    const payload = {
      qrToken: "1045",
      employeeId: "emp-1",
      worksiteId: "ws-1",
      warehouseId: "wh-1",
      items: [{ productId: "prod-1", productCode: "MAT-001", quantity: 3 }],
    }

    syncMocks.transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        offlineSyncOperation: {
          create: vi.fn().mockResolvedValue({ id: "op-rec-1" }),
          update: vi.fn().mockResolvedValue({}),
        },
        quickIssue: { create: vi.fn().mockResolvedValue({ id: "issue-11" }) },
        stock: { findMany: vi.fn().mockResolvedValue([{ locationId: "loc-1", warehouseId: "wh-1", quantity: 10 }]) },
        quickIssueItem: { create: vi.fn().mockResolvedValue({}) },
        stockMovement: { update: vi.fn().mockResolvedValue({}) },
      })
    )

    const req1 = { json: async () => ({ payload, idempotencyKey: "qi-key-0001", userId: "op-1" }) } as never
    const res1 = await POST(req1)
    expect(res1.status).toBe(200)
    const body1 = await res1.json()
    expect(body1.success).toBe(true)
    expect(body1.issueNumber).toBe("ENT-000011")

    // Simula queda de conexão antes da resposta chegar ao celular e reenvio automático da mesma operação
    syncMocks.replayFind.mockResolvedValue({ payloadHash: payloadHash(payload) })
    syncMocks.transaction.mockClear()

    const req2 = { json: async () => ({ payload, idempotencyKey: "qi-key-0001", userId: "op-1" }) } as never
    const res2 = await POST(req2)
    expect(res2.status).toBe(200)
    const body2 = await res2.json()
    expect(body2.alreadyProcessed).toBe(true)
    expect(syncMocks.transaction).not.toHaveBeenCalled()
  })

  it("retorna conflito 409 explícito quando o estoque do produto foi consumido no servidor enquanto o almoxarife estava offline", async () => {
    const { POST } = await import("@/app/api/sync/quick-issue/route")
    const payload = {
      qrToken: "1045",
      items: [{ productCode: "MAT-001", quantity: 20 }],
    }

    // No servidor restam apenas 2 unidades (outro usuário retirou enquanto estava offline)
    syncMocks.transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        offlineSyncOperation: {
          create: vi.fn().mockResolvedValue({ id: "op-rec-2" }),
          update: vi.fn().mockResolvedValue({}),
        },
        quickIssue: { create: vi.fn().mockResolvedValue({ id: "issue-12" }) },
        stock: { findMany: vi.fn().mockResolvedValue([{ locationId: "loc-1", warehouseId: "wh-1", quantity: 2 }]) },
      })
    )

    const req = { json: async () => ({ payload, idempotencyKey: "qi-key-conflict", userId: "op-1" }) } as never
    const res = await POST(req)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/Estoque insuficiente/i)
  })

  it("sincroniza criação de inventário offline (/api/sync/inventory) e retorna o ID real para coletas dependentes", async () => {
    const { POST } = await import("@/app/api/sync/inventory/route")
    syncMocks.locationCount.mockResolvedValue(2)
    syncMocks.inventoryFindFirst.mockResolvedValue({ code: "INV-2026-005" })
    syncMocks.transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        offlineSyncOperation: {
          create: vi.fn().mockResolvedValue({ id: "op-inv-1" }),
          update: vi.fn().mockResolvedValue({}),
        },
        inventory: { create: vi.fn().mockResolvedValue({ id: "real-inv-006" }) },
      })
    )

    const payload = {
      name: "Contagem Semanal Offline",
      warehouseId: "wh-1",
      type: "PARTIAL",
      locationIds: ["loc-1", "loc-2"],
      operatorIds: ["op-1"],
    }

    const req = { json: async () => ({ payload, idempotencyKey: "inv-key-0001", userId: "op-1" }) } as never
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.inventoryId).toBe("real-inv-006")
    expect(body.code).toBe("INV-2026-006")
  })

  it("sincroniza confirmação de recebimento em rascunho (/api/sync/receipt-confirm) com idempotência", async () => {
    const { POST } = await import("@/app/api/sync/receipt-confirm/route")
    syncMocks.receiptFindUnique.mockResolvedValue({
      id: "rec-draft-1",
      warehouseId: "wh-1",
      status: "DRAFT",
      documentNumber: "NF-900",
      items: [{ productId: "prod-1", locationId: "loc-1", quantity: 5, unitCost: 10, totalCost: 50 }],
    })
    syncMocks.transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        offlineSyncOperation: {
          create: vi.fn().mockResolvedValue({ id: "op-rc-1" }),
          update: vi.fn().mockResolvedValue({}),
        },
        stockReceipt: { update: vi.fn().mockResolvedValue({}) },
      })
    )

    const req = {
      json: async () => ({ payload: { receiptId: "rec-draft-1" }, idempotencyKey: "rc-key-0001", userId: "op-1" }),
    } as never
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(syncMocks.stockMovement).toHaveBeenCalledOnce()
  })

  it("retorna conflito 409 em ajuste manual de saída quando o saldo foi alterado no servidor", async () => {
    const { POST } = await import("@/app/api/sync/adjustment/route")
    syncMocks.transaction.mockImplementation(async () => {
      throw new Error("Estoque insuficiente na localização COR-A1. Saldo atual: 0")
    })

    const payload = {
      warehouseId: "wh-1",
      locationId: "loc-1",
      productId: "prod-1",
      type: "ADJUSTMENT_OUT",
      quantity: 5,
      reason: "Avaria identificada no campo",
    }

    const req = { json: async () => ({ payload, idempotencyKey: "adj-key-conflict", userId: "op-1" }) } as never
    const res = await POST(req)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/Estoque insuficiente/i)
  })
})
