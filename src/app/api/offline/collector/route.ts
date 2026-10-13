import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getValidatedSession } from "@/lib/auth"
import { hasPermission } from "@/lib/permissions"
import { warehouseIdFilter } from "@/lib/dal"

export async function GET() {
  const session = await getValidatedSession()
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 })
  if (!(await hasPermission('INVENTORY_COUNT'))) {
    return NextResponse.json({ error: "Sem permissão de coleta." }, { status: 403 })
  }

  const [inventories, products] = await Promise.all([
    db.inventory.findMany({
      where: {
        status: 'IN_PROGRESS',
        ...await warehouseIdFilter(session.userId),
        ...(session.roles.includes('ADMIN') ? {} : { operators: { some: { userId: session.userId } } })
      },
      include: { locations: { where: { status: { in: ['PENDING', 'IN_PROGRESS'] } }, include: { location: true } } },
      take: 501
    }),
    db.product.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, code: true, barcode: true, name: true },
      orderBy: { id: 'asc' },
      take: 5001
    })
  ])
  if (inventories.length > 500 || products.length > 5000) {
    return NextResponse.json({ error: "Catálogo grande demais para preparar neste dispositivo. Contate o administrador." }, { status: 413 })
  }

  return NextResponse.json({
    userId: session.userId,
    expiresAt: session.expiresAt,
    products,
    inventories: inventories.map(inv => ({
      id: inv.id,
      code: inv.code,
      name: inv.name,
      status: inv.status,
      locations: inv.locations.map(item => ({ id: item.locationId, code: item.location.code }))
    }))
  }, { headers: { 'Cache-Control': 'no-store' } })
}
