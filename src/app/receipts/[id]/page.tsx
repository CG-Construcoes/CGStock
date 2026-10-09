import { db } from "@/lib/db"
import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {  Clock, Package, FileText, User, Building, MapPin } from "lucide-react"
import { ConfirmReceiptButton } from "./confirm-button"
import { BackButton } from "@/components/ui/back-button"
import { formatCurrency } from "@/lib/utils"

export default async function ReceiptDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) redirect("/login")

  const { id } = await params

  const receipt = await db.stockReceipt.findUnique({
    where: { id },
    include: {
      supplier: true,
      warehouse: true,
      createdBy: true,
      items: {
        include: {
          product: {
            include: { unit: true }
          },
          location: true
        }
      }
    }
  })

  if (!receipt) {
    redirect("/receipts")
  }

  const isDraft = receipt.status === 'DRAFT'
  const isCompleted = receipt.status === 'COMPLETED'

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
              Entrada {receipt.documentNumber ? `#${receipt.documentNumber}` : 'Sem Número'}
              <Badge variant={isCompleted ? 'success' : isDraft ? 'outline' : 'secondary'} className="text-sm">
                {isCompleted ? 'Concluída' : isDraft ? 'Rascunho' : 'Cancelada'}
              </Badge>
            </h2>
            <p className="text-muted-foreground flex items-center gap-1 mt-1">
              <Clock className="h-3.5 w-3.5" /> Registrada em {new Date(receipt.createdAt).toLocaleString('pt-BR')}
            </p>
          </div>
        </div>
        
        {isDraft && (
          <ConfirmReceiptButton receiptId={receipt.id} />
        )}
      </div>

      {isDraft && (
        <div className="bg-blue-50/50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300 p-4 rounded-lg border border-blue-200 dark:border-blue-900 flex gap-3">
          <AlertCircleIcon className="h-5 w-5 shrink-0" />
          <div>
            <h4 className="font-medium">Esta entrada está em Rascunho</h4>
            <p className="text-sm mt-1">Os itens listados abaixo ainda não foram adicionados ao estoque. Clique em &quot;Confirmar Recebimento&quot; para efetivar a movimentação no almoxarifado.</p>
          </div>
        </div>
      )}

      {isCompleted && (
        <div className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-100 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800 flex gap-3">
          <CheckCircleIcon className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-500 mt-0.5" />
          <div>
            <h4 className="font-bold text-emerald-900 dark:text-emerald-100">Entrada Recebida</h4>
            <p className="text-sm mt-1 text-emerald-800 dark:text-emerald-200/90">Os itens desta entrada já foram processados e o estoque foi devidamente atualizado. Esta ação não pode ser desfeita ou repetida (idempotência).</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase flex items-center gap-2">
              <Building className="h-4 w-4" /> Fornecedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold text-lg">{receipt.supplier.name}</p>
            {receipt.supplier.document && <p className="text-sm text-muted-foreground">{receipt.supplier.document}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Almoxarifado Destino
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold text-lg">{receipt.warehouse.name}</p>
            <p className="text-sm text-muted-foreground">Código: {receipt.warehouse.code}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase flex items-center gap-2">
              <FileText className="h-4 w-4" /> Detalhes do Documento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Número / NF</p>
                <p className="font-medium">{receipt.documentNumber || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data Emissão</p>
                <p className="font-medium">{receipt.documentDate ? new Date(receipt.documentDate).toLocaleDateString('pt-BR') : '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="font-medium">{receipt.total ? formatCurrency(receipt.total) : '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data Recebimento</p>
                <p className="font-medium">{receipt.receivedAt ? new Date(receipt.receivedAt).toLocaleString('pt-BR') : '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase flex items-center gap-2">
              <User className="h-4 w-4" /> Auditoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Criado por</p>
                <p className="font-medium">{receipt.createdBy.name} <span className="text-muted-foreground font-normal text-sm">({receipt.createdBy.email})</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> Itens Recebidos ({receipt.items.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Produto</TableHead>
                <TableHead>Localização Destino</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead>Unid.</TableHead>
                <TableHead className="text-right">Custo Unit.</TableHead>
                <TableHead className="text-right pr-6">Custo Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipt.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="pl-6">
                    <div className="font-medium">{item.product.name}</div>
                    <div className="text-xs text-muted-foreground">Cód: {item.product.code}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono bg-muted/50">{item.location.code}</Badge>
                    <span className="text-sm ml-2">{item.location.name}</span>
                  </TableCell>
                  <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                  <TableCell>{item.product.unit.code}</TableCell>
                  <TableCell className="text-right">{item.unitCost ? formatCurrency(item.unitCost) : '-'}</TableCell>
                  <TableCell className="text-right font-medium pr-6">{item.totalCost ? formatCurrency(item.totalCost) : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function AlertCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  )
}

function CheckCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}
