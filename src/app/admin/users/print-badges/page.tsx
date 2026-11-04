import { db } from "@/lib/db";
import { requireAnyPermissionPage } from "@/lib/permissions";
import { UsersPrintBadgesClient } from "./print-badges-client";

export const metadata = {
  title: "Imprimir Crachás QR Code - CGStock",
};

export default async function PrintBadgesPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  await requireAnyPermissionPage('USER_VIEW', 'USER_MANAGE')
  const resolvedParams = await searchParams;
  const userIds = resolvedParams?.ids ? resolvedParams.ids.split(',') : [];

  const users = await db.user.findMany({
    where: userIds.length > 0 ? { id: { in: userIds } } : { status: 'ACTIVE' },
    include: {
      roles: true,
    },
    orderBy: { name: 'asc' },
  });

  return (
    <UsersPrintBadgesClient
      users={users.map((user) => ({
        id: user.id,
        name: user.name,
        qrToken: user.qrToken,
        roleName: user.roles[0]?.name,
      }))}
    />
  );
}
