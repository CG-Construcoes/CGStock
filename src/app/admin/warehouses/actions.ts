"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireActionPermission, requireAdmin } from "@/lib/action-guard"
import { assertWarehouseAccess } from "@/lib/dal"
import { logAudit, logAuditStrict } from "@/lib/audit"

export async function createWarehouseAction(formData: FormData) {
  const session = await requireAdmin()

  const name = (formData.get("name") as string)?.trim()
  const code = (formData.get("code") as string)?.trim().toUpperCase()
  const description = (formData.get("description") as string)?.trim() || null
  const status = (formData.get("status") as string) || "ACTIVE"
  const sourceRaw = (formData.get("source") as string)?.trim().toUpperCase()
  const source = sourceRaw === "MGA" || sourceRaw === "CV" ? sourceRaw : null

  const createInitialLocation = formData.get("createInitialLocation") === "true" || formData.get("createInitialLocation") === "on"
  const initialLocationCode = (formData.get("initialLocationCode") as string)?.trim().toUpperCase()
  const initialLocationName = (formData.get("initialLocationName") as string)?.trim() || "Estoque Geral"

  await db.$transaction(async (tx) => {
    const wh = await tx.warehouse.create({
      data: { name, code, description, status, source }
    })

    if (createInitialLocation) {
      let locCode = initialLocationCode || `${code}-GERAL`
      const existingLoc = await tx.warehouseLocation.findUnique({ where: { code: locCode } })
      if (existingLoc) {
        locCode = `${code}-${Date.now().toString().slice(-4)}`
      }

      await tx.warehouseLocation.create({
        data: {
          warehouseId: wh.id,
          code: locCode,
          name: initialLocationName,
          description: "Localização padrão inicial do almoxarifado",
          status: "ACTIVE"
        }
      })
    }

    await logAuditStrict('CREATE', 'Warehouse', wh.id, { name, code }, session.userId, tx)
    return wh
  })

  revalidatePath("/admin/warehouses")
  revalidatePath("/warehouses")
  revalidatePath("/locations")
  redirect("/admin/warehouses")
}

export async function updateWarehouseAction(formData: FormData) {
  const session = await requireActionPermission('CONFIG_MANAGE')

  const id = formData.get("id") as string
  await assertWarehouseAccess(id, session.userId)
  const name = (formData.get("name") as string)?.trim()
  const code = (formData.get("code") as string)?.trim().toUpperCase()
  const description = (formData.get("description") as string)?.trim() || null
  const status = formData.get("status") as string
  const sourceRaw = (formData.get("source") as string)?.trim().toUpperCase()
  const source = sourceRaw === "MGA" || sourceRaw === "CV" ? sourceRaw : null

  await db.warehouse.update({
    where: { id },
    data: { name, code, description, status, source }
  })

  await logAudit('UPDATE', 'Warehouse', id, { name, code, status, source }, session.userId)

  revalidatePath("/admin/warehouses")
  revalidatePath("/warehouses")
  revalidatePath(`/admin/warehouses/${id}`)
  revalidatePath(`/warehouses/${id}`)
  redirect("/admin/warehouses")
}

export async function deleteWarehouseAction(id: string, confirmationCode?: string) {
  let session
  try {
    session = await requireActionPermission('CONFIG_MANAGE')
  } catch (err: any) {
    return { error: err?.message || "Sem permissão para excluir almoxarifado." }
  }

  await assertWarehouseAccess(id, session.userId)
  const warehouse = await db.warehouse.findUnique({
    where: { id },
    include: {
      locations: { select: { id: true } }
    }
  })

  if (!warehouse) {
    return { error: "Almoxarifado não encontrado." }
  }

  // Validação estrita da confirmação à escrita
  const expectedCode = warehouse.code.trim().toUpperCase()
  if (!confirmationCode || confirmationCode.trim().toUpperCase() !== expectedCode) {
    return { error: `Confirmação incorreta. Digite exatamente "${expectedCode}" para confirmar a exclusão.` }
  }

  try {
    await db.$transaction(async (tx) => {
      const locationIds = warehouse.locations.map(l => l.id)

      // 1. Desvincula localização padrão de produtos
      if (locationIds.length > 0) {
        await tx.product.updateMany({
          where: { defaultLocationId: { in: locationIds } },
          data: { defaultLocationId: null }
        })
      }

      // 2. Desvincula lotes de importação
      await tx.importBatch.updateMany({
        where: { warehouseId: id },
        data: { warehouseId: null }
      })

      // 3. Entregas Rápidas (QuickIssue)
      if (locationIds.length > 0) {
        await tx.quickIssueItem.deleteMany({
          where: { locationId: { in: locationIds } }
        })
      }
      await tx.quickIssue.deleteMany({
        where: { warehouseId: id }
      })

      // 4. Transferências entre almoxarifados ou locais (StockTransfer)
      const transfers = await tx.stockTransfer.findMany({
        where: {
          OR: [
            { sourceWarehouseId: id },
            { destinationWarehouseId: id }
          ]
        },
        select: { id: true }
      })
      if (transfers.length > 0) {
        const transferIds = transfers.map(t => t.id)
        await tx.stockTransferItem.deleteMany({
          where: { transferId: { in: transferIds } }
        })
        await tx.stockTransfer.deleteMany({
          where: { id: { in: transferIds } }
        })
      }

      // 5. Devoluções de Materiais (MaterialReturn)
      if (locationIds.length > 0) {
        await tx.materialReturnItem.deleteMany({
          where: { locationId: { in: locationIds } }
        })
      }
      await tx.materialReturn.deleteMany({
        where: { warehouseId: id }
      })

      // 6. Requisições de Materiais (MaterialRequest)
      const requests = await tx.materialRequest.findMany({
        where: { warehouseId: id },
        select: { id: true }
      })
      if (requests.length > 0) {
        const requestIds = requests.map(r => r.id)
        await tx.materialRequestItem.deleteMany({
          where: { requestId: { in: requestIds } }
        })
        await tx.materialRequest.deleteMany({
          where: { id: { in: requestIds } }
        })
      }

      // 7. Inventários e Auditorias (Inventory)
      const inventories = await tx.inventory.findMany({
        where: { warehouseId: id },
        select: { id: true }
      })
      if (inventories.length > 0) {
        const inventoryIds = inventories.map(inv => inv.id)
        const collections = await tx.inventoryCollection.findMany({
          where: { inventoryId: { in: inventoryIds } },
          select: { id: true }
        })
        if (collections.length > 0) {
          const collectionIds = collections.map(c => c.id)
          await tx.inventoryCollectionItem.deleteMany({
            where: { collectionId: { in: collectionIds } }
          })
        }
        await tx.inventoryCollection.deleteMany({
          where: { inventoryId: { in: inventoryIds } }
        })
        await tx.inventoryDivergence.deleteMany({
          where: { inventoryId: { in: inventoryIds } }
        })
        await tx.inventoryLocation.deleteMany({
          where: { inventoryId: { in: inventoryIds } }
        })
        await tx.inventoryOperator.deleteMany({
          where: { inventoryId: { in: inventoryIds } }
        })
        await tx.inventory.deleteMany({
          where: { id: { in: inventoryIds } }
        })
      }

      // 8. Entradas de Materiais (StockReceipt)
      const receipts = await tx.stockReceipt.findMany({
        where: { warehouseId: id },
        select: { id: true }
      })
      if (receipts.length > 0) {
        const receiptIds = receipts.map(rc => rc.id)
        await tx.stockReceiptItem.deleteMany({
          where: { receiptId: { in: receiptIds } }
        })
        await tx.stockReceipt.deleteMany({
          where: { id: { in: receiptIds } }
        })
      }

      // 9. Histórico de Movimentações (StockMovement)
      await tx.stockMovement.deleteMany({
        where: {
          OR: [
            { warehouseId: id },
            ...(locationIds.length > 0 ? [{ locationId: { in: locationIds } }] : [])
          ]
        }
      })

      // Coleta produtos vinculados a este almoxarifado antes de apagar os saldos
      const warehouseProductIds = "findMany" in tx.product && typeof tx.product.findMany === "function"
        ? (await tx.product.findMany({
            where: {
              OR: [
                { stocks: { some: { warehouseId: id } } },
                ...(locationIds.length > 0 ? [{ defaultLocationId: { in: locationIds } }] : [])
              ]
            },
            select: { id: true }
          })).map(p => p.id)
        : []

      // 10. Saldos em Estoque (Stock)
      await tx.stock.deleteMany({
        where: {
          OR: [
            { warehouseId: id },
            ...(locationIds.length > 0 ? [{ locationId: { in: locationIds } }] : [])
          ]
        }
      })

      // Remove produtos exclusivos deste almoxarifado que ficaram sem vínculo em outros almoxarifados
      if (warehouseProductIds.length > 0 && "deleteMany" in tx.product && typeof tx.product.deleteMany === "function") {
        await tx.product.deleteMany({
          where: {
            id: { in: warehouseProductIds },
            stocks: { none: {} },
            movements: { none: {} }
          }
        })
      }

      // 11. Permissões de Acesso de Usuários (UserWarehouseAccess)
      await tx.userWarehouseAccess.deleteMany({
        where: { warehouseId: id }
      })

      // 12. Localizações Físicas do Almoxarifado (WarehouseLocation)
      await tx.warehouseLocation.updateMany({
        where: { warehouseId: id },
        data: { parentId: null }
      })
      await tx.warehouseLocation.deleteMany({
        where: { warehouseId: id }
      })

      // 13. Exclui o Almoxarifado
      await tx.warehouse.delete({
        where: { id }
      })

      // 14. Registro de auditoria obrigatório
      await logAuditStrict(
        'WAREHOUSE_DELETED_WITH_ALL_DATA',
        'Warehouse',
        id,
        { name: warehouse.name, code: warehouse.code },
        session.userId,
        tx
      )
    }, {
      maxWait: 15000,
      timeout: 60000
    })

    revalidatePath("/admin/warehouses")
    revalidatePath("/warehouses")
    revalidatePath("/locations")
    revalidatePath("/admin/locations")
    revalidatePath("/stock")
    revalidatePath("/movements")
    revalidatePath("/requests")
    revalidatePath("/receipts")

    return { success: true }
  } catch (error) {
    console.error("Erro ao excluir almoxarifado em cascata:", error)
    return { error: "Ocorreu um erro ao excluir o almoxarifado e seus dados vinculados." }
  }
}

export async function clearWarehouseDataAction(id: string, confirmationCode?: string) {
  let session
  try {
    session = await requireActionPermission('CONFIG_MANAGE')
  } catch (err: any) {
    return { error: err?.message || "Sem permissão para limpar dados do almoxarifado." }
  }

  await assertWarehouseAccess(id, session.userId)
  const warehouse = await db.warehouse.findUnique({
    where: { id },
    include: {
      locations: { select: { id: true } }
    }
  })

  if (!warehouse) {
    return { error: "Almoxarifado não encontrado." }
  }

  const expectedCode = warehouse.code.trim().toUpperCase()
  if (!confirmationCode || confirmationCode.trim().toUpperCase() !== expectedCode) {
    return { error: `Confirmação incorreta. Digite exatamente "${expectedCode}" para confirmar a limpeza.` }
  }

  try {
    await db.$transaction(async (tx) => {
      const locationIds = warehouse.locations.map(l => l.id)

      // 1. Lotes de importação deste almoxarifado
      await tx.importBatch.deleteMany({
        where: { warehouseId: id }
      })

      // 2. Entregas Rápidas (QuickIssue)
      if (locationIds.length > 0) {
        await tx.quickIssueItem.deleteMany({
          where: { locationId: { in: locationIds } }
        })
      }
      await tx.quickIssue.deleteMany({
        where: { warehouseId: id }
      })

      // 3. Transferências entre almoxarifados ou locais (StockTransfer)
      const transfers = await tx.stockTransfer.findMany({
        where: {
          OR: [
            { sourceWarehouseId: id },
            { destinationWarehouseId: id }
          ]
        },
        select: { id: true }
      })
      if (transfers.length > 0) {
        const transferIds = transfers.map(t => t.id)
        await tx.stockTransferItem.deleteMany({
          where: { transferId: { in: transferIds } }
        })
        await tx.stockTransfer.deleteMany({
          where: { id: { in: transferIds } }
        })
      }

      // 4. Devoluções de Materiais (MaterialReturn)
      if (locationIds.length > 0) {
        await tx.materialReturnItem.deleteMany({
          where: { locationId: { in: locationIds } }
        })
      }
      await tx.materialReturn.deleteMany({
        where: { warehouseId: id }
      })

      // 5. Requisições de Materiais (MaterialRequest)
      const requests = await tx.materialRequest.findMany({
        where: { warehouseId: id },
        select: { id: true }
      })
      if (requests.length > 0) {
        const requestIds = requests.map(r => r.id)
        await tx.materialRequestItem.deleteMany({
          where: { requestId: { in: requestIds } }
        })
        await tx.materialRequest.deleteMany({
          where: { id: { in: requestIds } }
        })
      }

      // 6. Inventários e Auditorias (Inventory)
      const inventories = await tx.inventory.findMany({
        where: { warehouseId: id },
        select: { id: true }
      })
      if (inventories.length > 0) {
        const inventoryIds = inventories.map(inv => inv.id)
        const collections = await tx.inventoryCollection.findMany({
          where: { inventoryId: { in: inventoryIds } },
          select: { id: true }
        })
        if (collections.length > 0) {
          const collectionIds = collections.map(c => c.id)
          await tx.inventoryCollectionItem.deleteMany({
            where: { collectionId: { in: collectionIds } }
          })
        }
        await tx.inventoryCollection.deleteMany({
          where: { inventoryId: { in: inventoryIds } }
        })
        await tx.inventoryDivergence.deleteMany({
          where: { inventoryId: { in: inventoryIds } }
        })
        await tx.inventoryLocation.deleteMany({
          where: { inventoryId: { in: inventoryIds } }
        })
        await tx.inventoryOperator.deleteMany({
          where: { inventoryId: { in: inventoryIds } }
        })
        await tx.inventory.deleteMany({
          where: { id: { in: inventoryIds } }
        })
      }

      // 7. Entradas de Materiais (StockReceipt)
      const receipts = await tx.stockReceipt.findMany({
        where: { warehouseId: id },
        select: { id: true }
      })
      if (receipts.length > 0) {
        const receiptIds = receipts.map(rc => rc.id)
        await tx.stockReceiptItem.deleteMany({
          where: { receiptId: { in: receiptIds } }
        })
        await tx.stockReceipt.deleteMany({
          where: { id: { in: receiptIds } }
        })
      }

      // 8. Histórico de Movimentações (StockMovement)
      await tx.stockMovement.deleteMany({
        where: {
          OR: [
            { warehouseId: id },
            ...(locationIds.length > 0 ? [{ locationId: { in: locationIds } }] : [])
          ]
        }
      })

      // Coleta produtos vinculados a este almoxarifado antes de apagar os saldos
      const warehouseProductIds = "findMany" in tx.product && typeof tx.product.findMany === "function"
        ? (await tx.product.findMany({
            where: {
              OR: [
                { stocks: { some: { warehouseId: id } } },
                ...(locationIds.length > 0 ? [{ defaultLocationId: { in: locationIds } }] : [])
              ]
            },
            select: { id: true }
          })).map(p => p.id)
        : []

      // 9. Saldos em Estoque (Stock)
      await tx.stock.deleteMany({
        where: {
          OR: [
            { warehouseId: id },
            ...(locationIds.length > 0 ? [{ locationId: { in: locationIds } }] : [])
          ]
        }
      })

      // 10. Remove produtos exclusivos deste almoxarifado para zerar completamente sua base de itens
      if (warehouseProductIds.length > 0 && "deleteMany" in tx.product && typeof tx.product.deleteMany === "function") {
        await tx.product.deleteMany({
          where: {
            id: { in: warehouseProductIds },
            stocks: { none: {} },
            movements: { none: {} }
          }
        })
      }

      // Mantém o almoxarifado, suas localizações físicas e permissões de usuários intactos!
      await logAuditStrict(
        'WAREHOUSE_DATA_CLEARED',
        'Warehouse',
        id,
        { name: warehouse.name, code: warehouse.code },
        session.userId,
        tx
      )
    }, {
      maxWait: 15000,
      timeout: 60000
    })

    revalidatePath("/admin/warehouses")
    revalidatePath(`/admin/warehouses/${id}`)
    revalidatePath("/warehouses")
    revalidatePath(`/warehouses/${id}`)
    revalidatePath("/locations")
    revalidatePath("/admin/locations")
    revalidatePath("/stock")
    revalidatePath("/products")
    revalidatePath("/movements")
    revalidatePath("/requests")
    revalidatePath("/receipts")
    revalidatePath("/import")

    return { success: true, name: warehouse.name }
  } catch (error) {
    console.error("Erro ao limpar dados do almoxarifado:", error)
    return { error: "Ocorreu um erro ao limpar os dados do almoxarifado." }
  }
}

export async function inactivateWarehouseAction(id: string) {
  let session
  try {
    session = await requireActionPermission('CONFIG_MANAGE')
  } catch (err: any) {
    return { error: err?.message || "Sem permissão para inativar almoxarifado." }
  }

  await assertWarehouseAccess(id, session.userId)
  try {
    const updated = await db.$transaction(async (tx) => {
      const wh = await tx.warehouse.update({
        where: { id },
        data: { status: 'INACTIVE' }
      })

      await logAuditStrict(
        'WAREHOUSE_DEACTIVATED',
        'Warehouse',
        id,
        { name: wh.name, code: wh.code },
        session.userId,
        tx
      )

      return wh
    })

    revalidatePath("/admin/warehouses")
    revalidatePath("/warehouses")
    revalidatePath(`/admin/warehouses/${id}`)
    revalidatePath(`/warehouses/${id}`)
    revalidatePath("/locations")
    revalidatePath("/stock")

    return { success: true, name: updated.name }
  } catch (error) {
    console.error("Erro ao inativar almoxarifado:", error)
    return { error: "Ocorreu um erro ao inativar o almoxarifado." }
  }
}

export async function activateWarehouseAction(id: string) {
  let session
  try {
    session = await requireActionPermission('CONFIG_MANAGE')
  } catch (err: any) {
    return { error: err?.message || "Sem permissão para ativar almoxarifado." }
  }

  await assertWarehouseAccess(id, session.userId)
  try {
    const updated = await db.$transaction(async (tx) => {
      const wh = await tx.warehouse.update({
        where: { id },
        data: { status: 'ACTIVE' }
      })

      await logAuditStrict(
        'WAREHOUSE_ACTIVATED',
        'Warehouse',
        id,
        { name: wh.name, code: wh.code },
        session.userId,
        tx
      )

      return wh
    })

    revalidatePath("/admin/warehouses")
    revalidatePath("/warehouses")
    revalidatePath(`/admin/warehouses/${id}`)
    revalidatePath(`/warehouses/${id}`)
    revalidatePath("/locations")
    revalidatePath("/stock")

    return { success: true, name: updated.name }
  } catch (error) {
    console.error("Erro ao ativar almoxarifado:", error)
    return { error: "Ocorreu um erro ao ativar o almoxarifado." }
  }
}

export async function addLocationToWarehouseAction(data: {
  warehouseId: string
  code: string
  name: string
  description?: string
  status?: string
}) {
  let session
  try {
    session = await requireActionPermission('LOCATION_CREATE')
  } catch (err: any) {
    return { error: err?.message || "Sem permissão para criar localizações." }
  }

  const warehouseId = data.warehouseId
  await assertWarehouseAccess(warehouseId, session.userId)
  const code = data.code?.trim().toUpperCase()
  const name = data.name?.trim()
  const description = data.description?.trim() || null
  const status = data.status || "ACTIVE"

  if (!warehouseId || !code || !name) {
    return { error: "Código e Nome da localização são obrigatórios." }
  }

  const existing = await db.warehouseLocation.findUnique({ where: { code } })
  if (existing) {
    return { error: `Já existe uma localização cadastrada com o código "${code}". Por favor, escolha outro código.` }
  }

  try {
    const location = await db.warehouseLocation.create({
      data: { warehouseId, code, name, description, status }
    })

    await logAudit('CREATE', 'WarehouseLocation', location.id, { warehouseId, code, name }, session.userId)

    revalidatePath(`/admin/warehouses/${warehouseId}`)
    revalidatePath(`/warehouses/${warehouseId}`)
    revalidatePath("/locations")
    revalidatePath("/admin/locations")

    return { success: true, location }
  } catch (error) {
    console.error("Erro ao adicionar localização:", error)
    return { error: "Ocorreu um erro ao salvar a localização." }
  }
}

export async function createDefaultWarehouseLocationAction(warehouseId: string) {
  let session
  try {
    session = await requireActionPermission('LOCATION_CREATE')
  } catch (err: any) {
    return { error: err?.message || "Sem permissão para criar localizações." }
  }

  await assertWarehouseAccess(warehouseId, session.userId)
  const warehouse = await db.warehouse.findUnique({ where: { id: warehouseId } })
  if (!warehouse) return { error: "Almoxarifado não encontrado." }

  let code = `${warehouse.code}-GERAL`
  const existing = await db.warehouseLocation.findUnique({ where: { code } })
  if (existing) {
    code = `${warehouse.code}-GERAL-${Date.now().toString().slice(-4)}`
  }

  try {
    const location = await db.warehouseLocation.create({
      data: {
        warehouseId,
        code,
        name: "Estoque Geral",
        description: "Localização padrão para armazenagem e importação",
        status: "ACTIVE"
      }
    })

    await logAudit('CREATE', 'WarehouseLocation', location.id, { warehouseId, code, name: location.name }, session.userId)

    revalidatePath(`/admin/warehouses/${warehouseId}`)
    revalidatePath(`/warehouses/${warehouseId}`)
    revalidatePath("/locations")
    revalidatePath("/admin/locations")

    return { success: true, location }
  } catch (error) {
    console.error("Erro ao criar localização padrão:", error)
    return { error: "Ocorreu um erro ao criar a localização padrão." }
  }
}

export async function deleteWarehouseLocationAction(locationId: string, warehouseId: string) {
  let session
  try {
    session = await requireActionPermission('CONFIG_MANAGE')
  } catch (err: any) {
    return { error: err?.message || "Sem permissão para excluir localização." }
  }

  const location = await db.warehouseLocation.findUnique({
    where: { id: locationId },
    include: {
      _count: {
        select: { stocks: true, movements: true, products: true, children: true }
      }
    }
  })

  if (!location) return { error: "Localização não encontrada." }
  if (location.warehouseId !== warehouseId) return { error: "Localização inválida para este almoxarifado." }
  await assertWarehouseAccess(location.warehouseId, session.userId)

  const activeStock = await db.stock.count({
    where: { locationId, quantity: { gt: 0 } }
  })

  if (activeStock > 0 || location._count.movements > 0) {
    return { error: "Esta localização possui movimentações ou saldo em estoque e não pode ser excluída. Recomendamos inativá-la." }
  }

  if (location._count.children > 0) {
    return { error: "Esta localização possui sublocalizações vinculadas. Remova ou altere o vínculo delas antes de excluir." }
  }

  try {
    await db.stock.deleteMany({ where: { locationId } })
    await db.warehouseLocation.delete({ where: { id: locationId } })

    await logAudit('DELETE', 'WarehouseLocation', locationId, { code: location.code }, session.userId)

    revalidatePath(`/admin/warehouses/${warehouseId}`)
    revalidatePath(`/warehouses/${warehouseId}`)
    revalidatePath("/locations")
    revalidatePath("/admin/locations")

    return { success: true }
  } catch (error) {
    console.error("Erro ao excluir localização:", error)
    return { error: "Ocorreu um erro ao excluir a localização." }
  }
}
