import { db } from "@/lib/db"
import { getValidatedSession } from "@/lib/auth"

export async function getUserWorksites() {
  const session = await getValidatedSession()
  if (!session) return []

  // Admins can see everything (optional logic, but usually good. Or require explicit access)
  // To keep it strictly bound to the WorksiteAccess as requested, we only return what's in the table.
  
  const accesses = await db.userWorksiteAccess.findMany({
    where: { userId: session.userId },
    include: { worksite: true }
  })
  
  return accesses.map(a => a.worksite)
}

export async function getAccessibleWorksiteIds() {
  const worksites = await getUserWorksites()
  return worksites.map(w => w.id)
}

export async function hasWorksiteAccess(worksiteId: string) {
  const ids = await getAccessibleWorksiteIds()
  return ids.includes(worksiteId)
}

export async function getUserWorksiteAccess(worksiteId: string) {
  const session = await getValidatedSession()
  if (!session) return null
  
  return db.userWorksiteAccess.findUnique({
    where: { userId_worksiteId: { userId: session.userId, worksiteId } }
  })
}

// Wrapper to get the user's primary worksite (if they only have 1, or their default)
export async function getDefaultWorksite() {
  const worksites = await getUserWorksites()
  return worksites.length > 0 ? worksites[0] : null
}
