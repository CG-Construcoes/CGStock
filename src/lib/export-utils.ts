import { format } from 'date-fns'

export async function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (!data || data.length === 0) return
  
  const XLSX = await import('xlsx')
  
  const worksheet = XLSX.utils.json_to_sheet(data)
  const csvOutput = XLSX.utils.sheet_to_csv(worksheet, { FS: ";" })
  
  // UTF-8 BOM
  const blob = new Blob(["\uFEFF" + csvOutput], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export async function exportToExcel(data: Record<string, unknown>[], filename: string) {
  if (!data || data.length === 0) return

  const XLSX = await import('xlsx')

  const worksheet = XLSX.utils.json_to_sheet(data)
  
  // Set basic column widths
  const colWidths = Object.keys(data[0]).map(key => ({
    wch: Math.max(key.length, 10) + 5
  }))
  worksheet['!cols'] = colWidths

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Dados")
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

export async function exportToPDF(data: Record<string, unknown>[], title: string, filename: string, period?: string) {
  if (!data || data.length === 0) return

  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF()
  
  // Title and header
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text("CGSTOCK", 14, 20)
  
  doc.setFontSize(12)
  doc.text(`RELATÓRIO DE ${title.toUpperCase()}`, 14, 30)

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 38)
  
  if (period) {
    doc.text(`Período: ${period}`, 14, 44)
  }

  doc.setLineWidth(0.5)
  doc.line(14, period ? 48 : 42, 196, period ? 48 : 42)

  // Generate table
  const columns = Object.keys(data[0])
  const rows = data.map(obj => columns.map(col => obj[col] !== null && obj[col] !== undefined ? String(obj[col]) : ''))

  autoTable(doc, {
    startY: period ? 52 : 46,
    head: [columns],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [92, 51, 16], textColor: [253, 239, 214], fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 3 },
    margin: { top: 20 },
    didDrawPage: (data) => {
      // Footer
      const pageHeight = doc.internal.pageSize.getHeight()
      const str = "Página " + doc.getNumberOfPages()
      doc.setFontSize(8)
      doc.text(str, data.settings.margin.left, pageHeight - 10)
      doc.text(
        "CGSTOCK - Documento gerado automaticamente",
        196 - doc.getTextWidth("CGSTOCK - Documento gerado automaticamente"),
        pageHeight - 10
      )
    }
  })

  doc.save(`${filename}.pdf`)
}

const INFORMAKON_TEXT_COLUMNS = new Set([
  "Cód Centro de Negócio", "Cód. Tipo de Movimento", "Tipo Doc.", "Nº Documento", "Cód. Sub-Insumo",
  "Observação", "Destinatário", "Origem Equip.", "O.S do Equipamento",
])

/** DD/MM/AAAA → número serial do Excel (sem depender do fuso do navegador). */
function brDateToExcelSerial(value: string): number | null {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  return (Date.UTC(+m[3], +m[2] - 1, +m[1]) - Date.UTC(1899, 11, 30)) / 86_400_000
}

/**
 * Gera a planilha .xls (Excel 97-2003) no layout exato dos modelos de importação
 * do Informakon: mesma aba, mesmos cabeçalhos e mesma ordem de colunas.
 */
export async function exportInformakonXls(
  rows: Record<string, string | number | null>[],
  headers: readonly string[],
  sheetName: "Entradas" | "Saidas",
  filename: string
) {
  const XLSX = await import('xlsx')
  const worksheet: import('xlsx').WorkSheet = {}

  headers.forEach((header, c) => {
    worksheet[XLSX.utils.encode_cell({ r: 0, c })] = { t: 's', v: header }
  })
  rows.forEach((row, i) => {
    headers.forEach((header, c) => {
      const value = row[header]
      if (value === null || value === undefined || value === "") return
      const ref = XLSX.utils.encode_cell({ r: i + 1, c })
      if (header === "Data da Movimentação") {
        const serial = brDateToExcelSerial(String(value))
        worksheet[ref] = serial === null ? { t: 's', v: String(value) } : { t: 'n', v: serial, z: 'dd/mm/yyyy' }
      } else if (INFORMAKON_TEXT_COLUMNS.has(header) || typeof value === "string") {
        worksheet[ref] = { t: 's', v: String(value) }
      } else {
        worksheet[ref] = { t: 'n', v: value }
      }
    })
  })
  worksheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: headers.length - 1 } })
  worksheet['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 2, 12) }))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  XLSX.writeFile(workbook, `${filename}.xls`, { bookType: 'biff8' })
}
