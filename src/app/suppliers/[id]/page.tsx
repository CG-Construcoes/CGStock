import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {  Mail, Phone, MapPin, FileText } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BackButton } from "@/components/ui/back-button"
import { formatCurrency } from "@/lib/utils"

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const supplier = await db.supplier.findUnique({
    where: { id },
    include: {
      receipts: {
        orderBy: { createdAt: 'desc' },
        take: 10
      }
    }
  })

  if (!supplier) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{supplier.name}</h2>
            {supplier.tradeName && <p className="text-muted-foreground">{supplier.tradeName}</p>}
          </div>
        </div>
        <Badge variant={supplier.status === 'ACTIVE' ? 'success' : 'secondary'}>
          {supplier.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Informações de Contato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {supplier.document && (
              <div className="flex items-center gap-3 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>{supplier.document}</span>
              </div>
            )}
            {supplier.email && (
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${supplier.email}`} className="text-blue-600 hover:underline">{supplier.email}</a>
              </div>
            )}
            {supplier.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{supplier.phone}</span>
              </div>
            )}
            {(supplier.address || supplier.city) && (
              <div className="flex items-start gap-3 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p>{supplier.address}</p>
                  <p>{supplier.city}{supplier.state ? ` - ${supplier.state}` : ''} {supplier.zipCode}</p>
                </div>
              </div>
            )}
            {supplier.notes && (
              <div className="pt-4 border-t mt-4">
                <p className="text-sm font-medium mb-1">Observações:</p>
                <p className="text-sm text-muted-foreground">{supplier.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Últimos Recebimentos</CardTitle>
          </CardHeader>
          <CardContent>
            {supplier.receipts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum recebimento registrado para este fornecedor.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplier.receipts.map(receipt => (
                    <TableRow key={receipt.id}>
                      <TableCell className="font-medium">
                        {receipt.documentNumber || 'Sem Doc.'}
                      </TableCell>
                      <TableCell>
                        {receipt.documentDate ? new Date(receipt.documentDate).toLocaleDateString('pt-BR') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {receipt.total ? formatCurrency(receipt.total) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={receipt.status === 'COMPLETED' ? 'success' : receipt.status === 'DRAFT' ? 'outline' : 'secondary'}>
                          {receipt.status === 'COMPLETED' ? 'Concluída' : receipt.status === 'DRAFT' ? 'Rascunho' : 'Cancelada'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
