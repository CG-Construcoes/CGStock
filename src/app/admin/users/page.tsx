import { db } from "@/lib/db"
import { UsersClient } from "./users-client"
import { requireAnyPermissionPage } from "@/lib/permissions"

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAnyPermissionPage('USER_VIEW', 'USER_MANAGE')
  const resolvedParams = await searchParams
  const q = resolvedParams?.q || ''
  const users = await db.user.findMany({
    where: {
      loginEnabled: true,
      ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] } : {})
    },
    include: {
      roles: true,
      warehouseAccesses: { select: { warehouse: { select: { name: true, code: true } } } }
    },
    orderBy: { createdAt: 'desc' }
  })

  return <UsersClient users={users} />
}
