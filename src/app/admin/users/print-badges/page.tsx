import { db } from "@/lib/db";
import { QRCodeBadge } from "@/components/ui/qr-code-badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import PrintButton from "./print-button";
import { requireAnyPermissionPage } from "@/lib/permissions";

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
    <div className="min-h-screen bg-white">
      {/* Header - Hidden when printing */}
      <div className="print:hidden p-6 border-b border-gray-200 bg-slate-50 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Imprimir Crachás</h1>
          <p className="text-slate-500">
            {users.length} funcionário(s) selecionado(s) para impressão.
          </p>
        </div>
        <div className="flex gap-4">
          <Link href="/admin/users">
            <Button className="gap-2 bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 shadow-sm">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </Link>
          <PrintButton />
        </div>
      </div>

      {/* Print Area */}
      <div className="p-8 print:p-0">
        <div className="print-grid">
          {users.map((user) => (
            <div key={user.id} className="print-item break-inside-avoid">
              <QRCodeBadge
                userId={user.id}
                userName={user.name}
                qrToken={user.qrToken}
                roleName={user.roles[0]?.name}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        .print-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          justify-content: center;
        }
        @media print {
          @page {
            margin: 0 !important;
            size: A4 portrait;
          }
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 0.5cm;
            justify-items: center;
            padding: 8mm !important;
            margin: 0 !important;
            width: 100% !important;
          }
          .print-item {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}} />
    </div>
  );
}
