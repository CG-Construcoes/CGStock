import { describe, it, expect, vi } from "vitest"
import { Prisma } from "@prisma/client"
import { createWithUniqueNumber } from "@/lib/sequential"

function p2002() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "5.22.0",
  })
}

describe("createWithUniqueNumber", () => {
  it("retorna na primeira tentativa quando não há conflito", async () => {
    const create = vi.fn().mockResolvedValue({ id: "1" })
    const result = await createWithUniqueNumber(async () => "REQ-0001", create)
    expect(result).toEqual({ id: "1" })
    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith("REQ-0001")
  })

  it("tenta novamente com número diferente após violação de unicidade", async () => {
    const numbers: string[] = []
    const computeNumber = vi.fn(async (attempt: number) => `REQ-000${attempt + 1}`)
    const create = vi.fn(async (n: string) => {
      numbers.push(n)
      if (numbers.length < 3) throw p2002()
      return { number: n }
    })

    const result = await createWithUniqueNumber(computeNumber, create)
    expect(result).toEqual({ number: "REQ-0003" })
    expect(create).toHaveBeenCalledTimes(3)
  })

  it("propaga erros que não são de unicidade imediatamente", async () => {
    const create = vi.fn().mockRejectedValue(new Error("connection lost"))
    await expect(createWithUniqueNumber(async () => "REQ-0001", create)).rejects.toThrow("connection lost")
    expect(create).toHaveBeenCalledTimes(1)
  })

  it("desiste após o limite de tentativas com conflito contínuo", async () => {
    const create = vi.fn().mockRejectedValue(p2002())
    await expect(createWithUniqueNumber(async () => "REQ-0001", create)).rejects.toThrow()
    expect(create).toHaveBeenCalledTimes(5)
  })
})
