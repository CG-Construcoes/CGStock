"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireActionPermission } from "@/lib/action-guard"
import { logAudit } from "@/lib/audit"
import { normalizeSupplierSource, type SupplierBatchItem } from "@/lib/supplier-import"

export async function createSupplierAction(formData: FormData) {
  const session = await requireActionPermission('CONFIG_MANAGE')

  const name = formData.get("name") as string
  const tradeName = formData.get("tradeName") as string || null
  const document = formData.get("document") as string || null
  const email = formData.get("email") as string || null
  const phone = formData.get("phone") as string || null
  const status = formData.get("status") as string
  const source = normalizeSupplierSource(formData.get("source"))
  const erpCode = (formData.get("erpCode") as string)?.trim() || null
  const category = (formData.get("category") as string)?.trim() || null

  const supplier = await db.supplier.create({
    data: {
      name, tradeName, document, email, phone, status,
      source, erpCode, category,
      informakonKey: source && erpCode ? `${source}:${erpCode}` : null,
    }
  })

  await logAudit('CREATE', 'Supplier', supplier.id, { name, source }, session.userId)
  
  revalidatePath("/admin/suppliers")
  redirect("/admin/suppliers")
}

export async function updateSupplierAction(formData: FormData) {
  const session = await requireActionPermission('CONFIG_MANAGE')

  const id = formData.get("id") as string
  const name = formData.get("name") as string
  const tradeName = formData.get("tradeName") as string || null
  const document = formData.get("document") as string || null
  const email = formData.get("email") as string || null
  const phone = formData.get("phone") as string || null
  const status = formData.get("status") as string
  const source = normalizeSupplierSource(formData.get("source"))
  const erpCode = (formData.get("erpCode") as string)?.trim() || null
  const category = (formData.get("category") as string)?.trim() || null

  await db.supplier.update({
    where: { id },
    data: {
      name, tradeName, document, email, phone, status,
      source, erpCode, category,
      informakonKey: source && erpCode ? `${source}:${erpCode}` : null,
    }
  })

  await logAudit('UPDATE', 'Supplier', id, { name, status, source }, session.userId)

  revalidatePath("/admin/suppliers")
  revalidatePath(`/admin/suppliers/${id}`)
  redirect("/admin/suppliers")
}

export async function deleteSupplierAction(formData: FormData) {
  const session = await requireActionPermission('CONFIG_MANAGE')

  const id = formData.get("id") as string
  await db.supplier.delete({ where: { id } })

  await logAudit('DELETE', 'Supplier', id, undefined, session.userId)

  revalidatePath("/admin/suppliers")
  redirect("/admin/suppliers")
}

// Importa um lote de fornecedores vindos da planilha do Informakon.
// Dedup por (source, erpCode): existentes são atualizados, novos são criados.
export async function importSuppliersBatchAction(items: SupplierBatchItem[], source: string) {
  const session = await requireActionPermission('CONFIG_MANAGE')
  const src = normalizeSupplierSource(source)
  if (!src) return { error: "Informe a empresa de origem dos fornecedores (MGA ou CV)." }

  const valid = items.filter((i) => i.erpCode?.trim() && i.name?.trim())
  if (valid.length === 0) return { created: 0, updated: 0, skipped: items.length }

  const erpCodes = valid.map((i) => i.erpCode.trim())
  const existing = await db.supplier.findMany({
    where: { source: src, erpCode: { in: erpCodes } },
    select: { erpCode: true },
  })
  const existingSet = new Set(existing.map((e) => e.erpCode))

  const toCreate = valid.filter((i) => !existingSet.has(i.erpCode.trim()))
  const toUpdate = valid.filter((i) => existingSet.has(i.erpCode.trim()))

  const mapData = (i: SupplierBatchItem) => ({
    name: i.name.trim(),
    tradeName: i.tradeName,
    document: i.document,
    category: i.category,
    phone: i.phone,
    state: i.state,
    status: i.status,
    registeredAt: i.registeredAt ? new Date(i.registeredAt) : null,
  })

  if (toCreate.length > 0) {
    await db.supplier.createMany({
      data: toCreate.map((i) => ({
        ...mapData(i),
        source: src,
        erpCode: i.erpCode.trim(),
        informakonKey: `${src}:${i.erpCode.trim()}`,
      })),
      skipDuplicates: true,
    })
  }

  for (const item of toUpdate) {
    await db.supplier.update({
      where: { source_erpCode: { source: src, erpCode: item.erpCode.trim() } },
      data: mapData(item),
    })
  }

  await logAudit('SUPPLIER_IMPORT_BATCH', 'Supplier', src, {
    source: src, created: toCreate.length, updated: toUpdate.length, skipped: items.length - valid.length,
  }, session.userId)

  revalidatePath("/admin/suppliers")
  revalidatePath("/suppliers")
  revalidatePath("/receipts/new")

  return { created: toCreate.length, updated: toUpdate.length, skipped: items.length - valid.length }
}
