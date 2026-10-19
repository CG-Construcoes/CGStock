"use server"

import { db } from "@/lib/db"
import { requirePermission } from "@/lib/permissions"
import { getValidatedSession } from "@/lib/auth"
import bcrypt from "bcryptjs"
import { logAudit } from "@/lib/audit"

export type EmployeeImportRow = {
  name: string
  email: string
  employeeCode: string
}

export async function importEmployeesAction(rows: EmployeeImportRow[]) {
  await requirePermission('CONFIG_MANAGE')
  const session = await getValidatedSession()
  if (!session) return { success: false, message: "Não autorizado." }
  
  if (!rows || rows.length === 0) return { success: false, message: "Nenhum usuário para importar." }

  let imported = 0
  let updated = 0
  let errors = []

  const defaultPasswordHash = await bcrypt.hash("123456", 10)

  // O perfil padrão de usuário básico (role normal)
  const defaultRole = await db.role.findFirst({
    where: { name: { contains: 'user', mode: 'insensitive' } }
  })

  for (const [index, row] of rows.entries()) {
    try {
      if (!row.email && !row.employeeCode) {
         errors.push(`Linha ${index + 1}: E-mail ou Matrícula obrigatórios.`)
         continue
      }
      
      const searchWhere = row.employeeCode 
         ? { employeeCode: row.employeeCode } 
         : { email: row.email }

      const existingUser = await db.user.findFirst({
         where: searchWhere
      })

      if (existingUser) {
         await db.user.update({
            where: { id: existingUser.id },
            data: {
               name: row.name || existingUser.name,
               email: row.email || existingUser.email,
               employeeCode: row.employeeCode || existingUser.employeeCode,
               loginEnabled: true
            }
         })
         updated++
      } else {
         if (!row.email) {
             errors.push(`Linha ${index + 1}: E-mail é obrigatório para novos usuários.`)
             continue
         }
         
         const createData: any = {
            name: row.name,
            email: row.email,
            employeeCode: row.employeeCode || null,
            passwordHash: defaultPasswordHash,
            mustChangePassword: true,
            loginEnabled: true
         }
         
         if (defaultRole) {
            createData.roles = { connect: { id: defaultRole.id } }
         }
         
         await db.user.create({
            data: createData
         })
         imported++
      }
    } catch (err: any) {
      errors.push(`Linha ${index + 1} (${row.name}): ${err.message}`)
    }
  }

  await logAudit("USER_IMPORT", "User", "bulk", { imported, updated, errors: errors.length }, session.userId)

  return { success: true, imported, updated, errors }
}
