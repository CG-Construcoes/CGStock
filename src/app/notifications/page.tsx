import { getValidatedSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { Bell } from "lucide-react"
import { format } from "date-fns"
import { BackButton } from "@/components/ui/back-button"
import { redirect } from "next/navigation"

export default async function NotificationsPage() {
  const session = await getValidatedSession()
  if (!session) redirect("/login")

  const notifications = await db.notification.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
    take: 100
  })

  // Mark all as read when opening the page
  const unreadIds = notifications.filter(n => !n.readAt).map(n => n.id)
  if (unreadIds.length > 0) {
    await db.notification.updateMany({
      where: { id: { in: unreadIds } },
      data: { readAt: new Date() }
    })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Notificações
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Seus alertas e mensagens do sistema.</p>
        </div>
        </div>
      </div>

      <div className="space-y-4">
        {notifications.length === 0 ? (
          <div className="p-8 bg-muted rounded-md text-center text-muted-foreground border border-gray-100">
            Você não possui notificações.
          </div>
        ) : (
          notifications.map((notif) => (
            <div 
              key={notif.id} 
              className={`p-4 rounded-lg border ${!notif.readAt ? 'bg-primary/5 border-primary/10' : 'bg-card border-border'}`}
            >
              <div className="flex justify-between items-start mb-1">
                <h3 className={`font-semibold ${!notif.readAt ? 'text-primary-foreground' : 'text-gray-800'}`}>
                  {notif.title}
                </h3>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                  {format(notif.createdAt, "dd/MM/yyyy HH:mm")}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{notif.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
