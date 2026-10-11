import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  console.log("Starting migration of UserWorksiteAccess to UserWarehouseAccess...")
  
  const accesses = await db.userWorksiteAccess.findMany({
    include: {
      worksite: {
        include: {
          warehouses: true
        }
      }
    }
  })
  
  console.log(`Found ${accesses.length} UserWorksiteAccess records.`)
  
  let createdCount = 0
  
  for (const access of accesses) {
    for (const warehouse of access.worksite.warehouses) {
      // Check if already exists to avoid duplicates
      const exists = await db.userWarehouseAccess.findUnique({
        where: {
          userId_warehouseId: {
            userId: access.userId,
            warehouseId: warehouse.id
          }
        }
      })
      
      if (!exists) {
        await db.userWarehouseAccess.create({
          data: {
            userId: access.userId,
            warehouseId: warehouse.id,
            // grantedById is optional
          }
        })
        createdCount++
        console.log(`Created access for user ${access.userId} to warehouse ${warehouse.id} (${warehouse.name})`)
      }
    }
  }
  
  console.log(`Migration completed. Created ${createdCount} UserWarehouseAccess records.`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
