import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Iniciando seed do banco de dados...')

  // 1. Limpar banco para garantir idempotência (opcional, cuidado em prod)
  // await prisma.product.deleteMany()
  // await prisma.warehouseLocation.deleteMany()
  // await prisma.warehouse.deleteMany()
  // await prisma.productCategory.deleteMany()
  // await prisma.productUnit.deleteMany()
  // await prisma.rolePermission.deleteMany()
  // await prisma.user.deleteMany()
  // await prisma.permission.deleteMany()
  // await prisma.role.deleteMany()

  // 2. Roles
  const roles = [
    { name: 'ADMIN', description: 'Administrador do Sistema' },
    { name: 'GESTOR', description: 'Gestor de Almoxarifado' },
    { name: 'ALMOXARIFE', description: 'Almoxarife' },
    { name: 'CONFERENTE', description: 'Conferente' },
    { name: 'SOLICITANTE', description: 'Solicitante' },
  ]

  for (const r of roles) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: {},
      create: r,
    })
  }

  const roleAdmin = await prisma.role.findUnique({ where: { name: 'ADMIN' } })
  const roleGestor = await prisma.role.findUnique({ where: { name: 'GESTOR' } })
  const roleAlmox = await prisma.role.findUnique({ where: { name: 'ALMOXARIFE' } })
  const roleConf = await prisma.role.findUnique({ where: { name: 'CONFERENTE' } })
  const roleSol = await prisma.role.findUnique({ where: { name: 'SOLICITANTE' } })

  if (!roleAdmin || !roleGestor || !roleAlmox || !roleConf || !roleSol) throw new Error("Roles não encontradas")

  // 3. Permissions (Exemplo inicial)
  const permissions = [
    { key: 'products.read', name: 'Visualizar Produtos' },
    { key: 'products.create', name: 'Criar Produtos' },
    { key: 'products.update', name: 'Atualizar Produtos' },
    { key: 'products.delete', name: 'Deletar Produtos' },
    { key: 'users.read', name: 'Visualizar Usuários' },
  ]

  for (const p of permissions) {
    const perm = await prisma.permission.upsert({
      where: { key: p.key },
      update: {},
      create: p,
    })
    
    // Associar ao ADMIN
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: roleAdmin.id, permissionId: perm.id } },
      update: {},
      create: { roleId: roleAdmin.id, permissionId: perm.id }
    })
  }

  // 4. Usuários
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    throw new Error(
      'Defina a variável de ambiente ADMIN_PASSWORD para executar o seed. ' +
      'Não existe mais senha padrão por motivos de segurança.'
    )
  }
  const passwordHash = await bcrypt.hash(adminPassword, 10)

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@estoka.com'
  const includeDemoUsers = process.env.SEED_DEMO_USERS === 'true'

  const users = [
    { email: adminEmail, name: 'Administrador Sistema', roleId: roleAdmin.id },
    ...(includeDemoUsers ? [
      { email: 'gestor@estoka.com', name: 'Gestor Principal', roleId: roleGestor.id },
      { email: 'almoxarife@estoka.com', name: 'João Almoxarife', roleId: roleAlmox.id },
      { email: 'conferente@estoka.com', name: 'Maria Conferente', roleId: roleConf.id },
      { email: 'solicitante@estoka.com', name: 'Carlos Solicitante', roleId: roleSol.id },
    ] : []),
  ]

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash, mustChangePassword: true },
    })
  }

  // 5. Categorias
  const categories = ['Elétrica', 'Hidráulica', 'Ferragens', 'EPI', 'Materiais Gerais']
  for (const c of categories) {
    await prisma.productCategory.upsert({
      where: { name: c },
      update: {},
      create: { name: c, description: `Categoria de ${c}` },
    })
  }

  // 6. Unidades
  const units = [
    { code: 'UN', name: 'Unidade' },
    { code: 'CX', name: 'Caixa' },
    { code: 'KG', name: 'Quilograma' },
    { code: 'M', name: 'Metro' },
    { code: 'LT', name: 'Litro' },
  ]
  for (const u of units) {
    await prisma.productUnit.upsert({
      where: { code: u.code },
      update: {},
      create: { code: u.code, name: u.name },
    })
  }

  // 7. Warehouse e Locations
  const warehouse = await prisma.warehouse.upsert({
    where: { code: 'ALM-01' },
    update: {},
    create: { name: 'Almoxarifado Central', code: 'ALM-01' }
  })

  const locCodes = ['A01', 'A02', 'A03', 'B01', 'B02', 'B03']
  for (const locCode of locCodes) {
    await prisma.warehouseLocation.upsert({
      where: { code: locCode },
      update: {},
      create: { warehouseId: warehouse.id, code: locCode, name: `Corredor ${locCode.charAt(0)} - Posição ${locCode}` }
    })
  }

  // 8. Produtos (Amostra)
  const catFer = await prisma.productCategory.findUnique({ where: { name: 'Ferragens' } })
  const catEle = await prisma.productCategory.findUnique({ where: { name: 'Elétrica' } })
  const unitUn = await prisma.productUnit.findUnique({ where: { code: 'UN' } })
  const unitM = await prisma.productUnit.findUnique({ where: { code: 'M' } })
  const locA01 = await prisma.warehouseLocation.findUnique({ where: { code: 'A01' } })
  const locB02 = await prisma.warehouseLocation.findUnique({ where: { code: 'B02' } })

  if (catFer && catEle && unitUn && unitM && locA01 && locB02) {
    const products = [
      {
        code: 'MAT-00001',
        name: 'Parafuso 8mm',
        categoryId: catFer.id,
        unitId: unitUn.id,
        defaultLocationId: locA01.id,
        status: 'ACTIVE'
      },
      {
        code: 'MAT-00002',
        name: 'Fita isolante',
        categoryId: catEle.id,
        unitId: unitUn.id,
        defaultLocationId: locA01.id,
        status: 'ACTIVE'
      },
      {
        code: 'MAT-00004',
        name: 'Cabo flexível 2.5mm',
        categoryId: catEle.id,
        unitId: unitM.id,
        defaultLocationId: locB02.id,
        status: 'ACTIVE'
      }
    ]

    for (const p of products) {
      await prisma.product.upsert({
        where: { code: p.code },
        update: {},
        create: p
      })
    }
  }

  // 9. Fornecedores
  const suppliers = [
    { name: 'Fornecedora ABC Ltda', document: '12345678000199', status: 'ACTIVE' },
    { name: 'Distribuidora XYZ', document: '98765432000111', status: 'ACTIVE' },
  ]
  for (const s of suppliers) {
    await prisma.supplier.upsert({
      where: { document: s.document },
      update: {},
      create: s
    })
  }

  // 10. Criar Recebimentos e Estoque
  const supplier1 = await prisma.supplier.findUnique({ where: { document: '12345678000199' } })
  const userAdmin = await prisma.user.findUnique({ where: { email: adminEmail } })
  const prod1 = await prisma.product.findUnique({ where: { code: 'MAT-00001' } })
  const prod2 = await prisma.product.findUnique({ where: { code: 'MAT-00002' } })

  if (supplier1 && userAdmin && prod1 && prod2 && locA01 && warehouse) {
    const existingReceipt = await prisma.stockReceipt.findFirst({ where: { documentNumber: 'NF-100' } })
    if (!existingReceipt) {
      const receipt = await prisma.stockReceipt.create({
        data: {
          supplierId: supplier1.id,
          warehouseId: warehouse.id,
          documentNumber: 'NF-100',
          documentDate: new Date(),
          status: 'COMPLETED',
          createdById: userAdmin.id,
          subtotal: 150.00,
          total: 150.00,
          items: {
            create: [
              {
                productId: prod1.id,
                locationId: locA01.id,
                quantity: 100,
                unitCost: 1.00,
                totalCost: 100.00
              },
              {
                productId: prod2.id,
                locationId: locA01.id,
                quantity: 10,
                unitCost: 5.00,
                totalCost: 50.00
              }
            ]
          }
        },
        include: { items: true }
      })

      // Gerar as Movimentações
      for (const item of receipt.items) {
        await prisma.stockMovement.create({
          data: {
            productId: item.productId,
            warehouseId: receipt.warehouseId,
            locationId: item.locationId,
            type: 'ENTRY',
            quantity: item.quantity,
            unitCost: item.unitCost,
            totalCost: item.totalCost,
            referenceType: 'RECEIPT',
            referenceId: receipt.id,
            documentNumber: receipt.documentNumber,
            performedById: receipt.createdById
          }
        })

        // Atualizar o Estoque
        await prisma.stock.upsert({
          where: {
            productId_locationId: { productId: item.productId, locationId: item.locationId }
          },
          update: {
            quantity: { increment: item.quantity }
          },
          create: {
            productId: item.productId,
            warehouseId: receipt.warehouseId,
            locationId: item.locationId,
            quantity: item.quantity
          }
        })
      }
    }
  }

  // 11. Requisições (Material Requests)
  const userSolicitante = await prisma.user.findUnique({ where: { email: 'solicitante@estoka.com' } })
  const userGestor = await prisma.user.findUnique({ where: { email: 'gestor@estoka.com' } })
  const userAlmox = await prisma.user.findUnique({ where: { email: 'almoxarife@estoka.com' } })

  if (userSolicitante && userGestor && userAlmox && warehouse && prod1 && prod2 && unitUn) {
    const existingReq = await prisma.materialRequest.findFirst({ where: { requestNumber: 'REQ-0001' } })
    if (!existingReq) {
      // DRAFT
      await prisma.materialRequest.create({
        data: {
          requestNumber: 'REQ-0001',
          requesterId: userSolicitante.id,
          warehouseId: warehouse.id,
          status: 'DRAFT',
          priority: 'NORMAL',
          notes: 'Materiais para manutenção elétrica.',
          items: {
            create: [
              { productId: prod1.id, unitId: unitUn.id, requestedQuantity: 5 },
            ]
          }
        }
      })
      
      // PENDING_APPROVAL
      await prisma.materialRequest.create({
        data: {
          requestNumber: 'REQ-0002',
          requesterId: userSolicitante.id,
          warehouseId: warehouse.id,
          status: 'PENDING_APPROVAL',
          priority: 'HIGH',
          requestedAt: new Date(),
          items: {
            create: [
              { productId: prod2.id, unitId: unitUn.id, requestedQuantity: 10 },
            ]
          }
        }
      })

      // FULFILLED (Simulando uma saída completa que já reduziu estoque)
      // Para manter a consistência, não vamos decrementar o estoque no seed para simplificar, apenas simular a requisição, ou então a criaremos e assumiremos que foi entregue.
      await prisma.materialRequest.create({
        data: {
          requestNumber: 'REQ-0003',
          requesterId: userSolicitante.id,
          warehouseId: warehouse.id,
          status: 'FULFILLED',
          priority: 'URGENT',
          requestedAt: new Date(),
          approvedAt: new Date(),
          approvedById: userGestor.id,
          completedAt: new Date(),
          items: {
            create: [
              { productId: prod1.id, unitId: unitUn.id, requestedQuantity: 20, approvedQuantity: 20, separatedQuantity: 20, deliveredQuantity: 20 },
            ]
          }
        }
      })
    }
  }

  // 12. Inventários (KCollector)
  if (warehouse && userGestor && userAlmox && locA01 && locB02 && prod1) {
    const existingInv = await prisma.inventory.findFirst({ where: { code: 'INV-2026-001' } })
    if (!existingInv) {
      const inv = await prisma.inventory.create({
        data: {
          code: 'INV-2026-001',
          name: 'Inventário Geral 2026',
          warehouseId: warehouse.id,
          status: 'IN_PROGRESS',
          type: 'FULL',
          createdById: userGestor.id,
          startedAt: new Date(),
          locations: {
            create: [
              { locationId: locA01.id, status: 'IN_PROGRESS' },
              { locationId: locB02.id, status: 'PENDING' },
            ]
          },
          operators: {
            create: [
              { userId: userGestor.id },
              { userId: userAlmox.id },
            ]
          }
        }
      })

      // Simular uma coleta no locA01
      await prisma.inventoryCollection.create({
        data: {
          inventoryId: inv.id,
          locationId: locA01.id,
          operatorId: userAlmox.id,
          status: 'SUBMITTED',
          startedAt: new Date(),
          finishedAt: new Date(),
          items: {
            create: [
              { productId: prod1.id, quantity: 98 } // No sistema há 100
            ]
          }
        }
      })
    }
  }

  // 13. System Settings
  const defaultSettings = [
    { key: 'SYSTEM_NAME', value: 'Estoka Premium', type: 'STRING' },
    { key: 'COMPANY_NAME', value: 'Empresa Fictícia S/A', type: 'STRING' },
    { key: 'ALLOW_NEGATIVE_STOCK', value: 'false', type: 'BOOLEAN' },
    { key: 'REQUIRE_LOCATION_ON_ENTRY', value: 'true', type: 'BOOLEAN' },
    { key: 'REQUIRE_REQUEST_APPROVAL', value: 'true', type: 'BOOLEAN' },
    { key: 'ALLOW_PARTIAL_FULFILLMENT', value: 'true', type: 'BOOLEAN' },
    { key: 'INVENTORY_BLIND_COUNT', value: 'true', type: 'BOOLEAN' },
    { key: 'SCANNER_DEFAULT_QTY', value: '1', type: 'NUMBER' },
  ]

  for (const s of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {},
      create: { ...s, updatedById: userAdmin!.id }
    })
  }

  // 14. Notifications e Audit Logs sintéticos
  if (userAdmin && userGestor) {
    await prisma.notification.createMany({
      data: [
        { userId: userAdmin.id, title: 'Sistema Atualizado', message: 'Módulos 9 e 10 instalados com sucesso.', type: 'SYSTEM' },
        { userId: userGestor.id, title: 'Inventário Aberto', message: 'O inventário INV-2026-001 foi iniciado.', type: 'ALERT' },
      ],
      skipDuplicates: true
    })

    await prisma.auditLog.create({
      data: {
        userId: userAdmin.id,
        action: 'SYSTEM_SETUP',
        entityType: 'System',
        entityId: 'seed',
        metadata: { info: 'Base de dados populada com dados de amostra' }
      }
    })
  }

  console.log('Seed finalizado com sucesso!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
