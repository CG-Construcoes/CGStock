"use server"

import { cookies } from "next/headers"
import { deleteSession } from "@/lib/auth"
import { ACTIVE_WAREHOUSE_COOKIE, assertWarehouseAccess, requireUser } from "@/lib/dal"
import { redirect } from "next/navigation"

export async function logoutAction() {
  const cookieStore = await cookies()
  cookieStore.delete(ACTIVE_WAREHOUSE_COOKIE)
  await deleteSession()
  redirect("/login")
}

export async function setActiveWarehouseAction(warehouseId: string) {
  const user = await requireUser()
  const cookieStore = await cookies()

  if (!warehouseId || warehouseId === "ALL") {
    cookieStore.delete(ACTIVE_WAREHOUSE_COOKIE)
    return { success: true, warehouseId: "" }
  }

  await assertWarehouseAccess(warehouseId, user.session.userId)
  cookieStore.set(ACTIVE_WAREHOUSE_COOKIE, warehouseId, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 dias
  })

  return { success: true, warehouseId }
}
