"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { QRCodeBadge } from "@/components/ui/qr-code-badge"
import { STICKER_SHEET, StickerLabel, StickerSheet, stickerText } from "@/components/ui/sticker-sheet"
import PrintButton from "./print-button"

export type PrintUser = {
  id: string
  name: string
  qrToken: string | null
  roleName?: string
}

type Preset = "DEFAULT" | "STICKER"

export function UsersPrintBadgesClient({ users }: { users: PrintUser[] }) {
  const [preset, setPreset] = useState<Preset>("DEFAULT")

  return (
    <div className="min-h-screen bg-white">
      {/* Header - Hidden when printing */}
      <div className="print:hidden p-6 border-b border-gray-200 bg-slate-50 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Imprimir Crachás</h1>
          <p className="text-slate-500">
            {users.length} funcionário(s) selecionado(s) para impressão.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center rounded-lg border border-slate-300 bg-white p-1 text-xs">
            {(
              [
                { id: "DEFAULT", label: "Padrão (Crachá)", title: "Crachás em grade 3 colunas para recortar" },
                { id: "STICKER", label: `${STICKER_SHEET.label} (18)`, title: STICKER_SHEET.description },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                title={p.title}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  preset === p.id ? "bg-slate-900 text-white font-bold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
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
        {preset === "STICKER" ? (
          <StickerSheet
            items={users}
            getKey={(user) => user.id}
            renderLabel={(user) => {
              const qrValue = user.qrToken || user.id
              return (
                <StickerLabel qrValue={qrValue} footerLeft={qrValue} footerRight="CRACHÁ">
                  <span className={stickerText.name}>{user.name}</span>
                  {user.roleName && <span className={stickerText.meta}>{user.roleName}</span>}
                </StickerLabel>
              )
            }}
          />
        ) : (
          <div className="print-grid">
            {users.map((user) => (
              <div key={user.id} className="print-item break-inside-avoid">
                <QRCodeBadge
                  userId={user.id}
                  userName={user.name}
                  qrToken={user.qrToken}
                  roleName={user.roleName}
                />
              </div>
            ))}
          </div>
        )}
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
  )
}
