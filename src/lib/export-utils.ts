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
