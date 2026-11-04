"use client"

import { useSyncExternalStore, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { QRCodeSVG } from "qrcode.react"

// Folha adesiva Pimaco A4361 / A4261: A4, 3 colunas x 6 linhas, etiquetas de 63,5 x 46,5 mm
export const STICKER_SHEET = {
  label: "Papel Adesivo",
  description: "Folha adesiva A4 · 18 etiquetas (3x6) de 63,5 x 46,5 mm · Pimaco A4361/A4261",
  columns: 3,
  rows: 6,
  perPage: 18,
  labelWidthMm: 63.5,
  labelHeightMm: 46.5,
  marginTopMm: 9.1,
  marginLeftMm: 7.2,
  columnGapMm: 2.6,
} as const

export function StickerSheet<T>({
  items,
  getKey,
  renderLabel,
}: {
  items: T[]
  getKey: (item: T, index: number) => string
  renderLabel: (item: T, index: number) => ReactNode
}) {
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false)
  const pages: T[][] = []
  for (let i = 0; i < items.length; i += STICKER_SHEET.perPage) {
    pages.push(items.slice(i, i + STICKER_SHEET.perPage))
  }

  const renderPages = (printMode: boolean) =>
    pages.map((page, pageIdx) => (
      <div
        key={pageIdx}
        className={`sticker-sheet-page grid bg-white text-slate-950 ${printMode ? "" : "shadow-md ring-1 ring-slate-300"}`}
        style={{
          width: "210mm",
          height: "297mm",
          boxSizing: "border-box",
          overflow: "hidden",
          paddingTop: `${STICKER_SHEET.marginTopMm}mm`,
          paddingLeft: `${STICKER_SHEET.marginLeftMm}mm`,
          gridTemplateColumns: `repeat(${STICKER_SHEET.columns}, ${STICKER_SHEET.labelWidthMm}mm)`,
          gridAutoRows: `${STICKER_SHEET.labelHeightMm}mm`,
          columnGap: `${STICKER_SHEET.columnGapMm}mm`,
          alignContent: "start",
        }}
      >
        {page.map((item, i) => {
          const index = pageIdx * STICKER_SHEET.perPage + i
          return (
            <div
              key={getKey(item, index)}
              className={`relative overflow-hidden ${
                printMode ? "" : "rounded-[2mm] outline-1 outline-dashed -outline-offset-1 outline-slate-300"
              }`}
            >
              {renderLabel(item, index)}
            </div>
          )
        })}
      </div>
    ))

  return (
    <>
      <div className="print:hidden">
        <div className="mx-auto mb-4 max-w-[210mm] rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          <strong>{STICKER_SHEET.label}:</strong> {STICKER_SHEET.description}. Na janela de impressão use{" "}
          <strong>Escala 100% / Tamanho real</strong> e <strong>Margens: Nenhuma</strong>. Faça o primeiro teste em folha
          comum e sobreponha à folha adesiva contra a luz para conferir o alinhamento.
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="flex w-max flex-col items-center gap-6 mx-auto">{renderPages(false)}</div>
        </div>
      </div>

      {/* Cópia exclusiva para impressão, montada direto no <body>: nenhum elemento do layout
          (shell, min-h-screen, toasts) entra no fluxo impresso e gera folha em branco */}
      {mounted && createPortal(<div className="sticker-print-root">{renderPages(true)}</div>, document.body)}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .sticker-print-root { display: none; }
        @media print {
          @page { size: A4 portrait; margin: 0 !important; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 0 !important;
          }
          body:has(.sticker-print-root) > *:not(.sticker-print-root) { display: none !important; }
          .sticker-print-root { display: block !important; }
          .sticker-print-root .sticker-sheet-page {
            height: 290mm !important;
            break-after: page;
            page-break-after: always;
            break-inside: avoid;
          }
          .sticker-print-root .sticker-sheet-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }
        }
      `,
        }}
      />
    </>
  )
}

export function StickerLabel({
  qrValue,
  children,
  footerLeft,
  footerRight,
}: {
  qrValue: string
  children: ReactNode
  footerLeft?: ReactNode
  footerRight?: ReactNode
}) {
  return (
    <div className="flex h-full w-full flex-col px-[3mm] py-[2.5mm] text-slate-950">
      <div className="flex items-center justify-between border-b border-slate-300 pb-[0.6mm] leading-none">
        <span className="text-[7pt] font-black uppercase tracking-wider text-slate-800">CG CONSTRUÇÕES</span>
        <span className="font-mono text-[6.5pt] font-bold text-slate-600">CGSTOCK</span>
      </div>

      <div className="flex min-h-0 flex-1 items-center gap-[2.5mm] py-[1mm]">
        <QRCodeSVG
          value={qrValue}
          size={128}
          level="M"
          includeMargin={false}
          style={{ width: "27mm", height: "27mm", flexShrink: 0 }}
        />
        <div className="flex min-w-0 flex-1 flex-col justify-center overflow-hidden">{children}</div>
      </div>

      {(footerLeft || footerRight) && (
        <div className="flex items-center justify-between gap-[1.5mm] border-t border-slate-200 pt-[0.6mm] font-mono text-[6pt] leading-none text-slate-600">
          <span className="truncate font-bold">{footerLeft}</span>
          {footerRight && <span className="shrink-0 font-bold uppercase text-slate-700">{footerRight}</span>}
        </div>
      )}
    </div>
  )
}

export const stickerText = {
  code: "mb-[0.8mm] self-start whitespace-nowrap rounded bg-slate-900 px-[1.2mm] py-[0.5mm] font-mono text-[7.5pt] font-black leading-none tracking-wide text-white",
  name: "break-words text-[8pt] font-bold leading-tight text-slate-950 line-clamp-3",
  meta: "mt-[0.6mm] truncate text-[6.5pt] font-medium leading-tight text-slate-600",
}
