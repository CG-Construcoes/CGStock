import { expect, it, vi } from "vitest"

vi.mock("@/lib/auth", () => ({ getValidatedSession: vi.fn().mockResolvedValue({ userId: "pedro", roles: ["ALMOXARIFE"] }) }))
vi.mock("@/lib/user-context", () => ({ getUserSecurityContext: vi.fn().mockResolvedValue({ roleNames: ["ALMOXARIFE"], permissionKeys: new Set(), allWarehouseAccess: true }) }))

import { hasPermission } from "@/lib/permissions"

it("acesso total a almoxarifados não concede gestão de usuários", async () => {
  expect(await hasPermission("USER_MANAGE")).toBe(false)
})
