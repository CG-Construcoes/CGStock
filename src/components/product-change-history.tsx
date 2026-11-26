import Link from "next/link"
import { History } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getProductChangeHistory } from "@/lib/product-changes"

export async function ProductChangeHistory({ productId }: { productId: string }) {
  const history = await getProductChangeHistory(productId)
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Histórico de Alterações</CardTitle>
        <Link href={`/reports/changes?productId=${productId}`} className="text-sm text-primary hover:underline">Ver todas</Link>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-lg">Nenhuma alteração de cadastro registrada.</div>
        ) : (
          <ul className="divide-y divide-border">
            {history.map(h => (
              <li key={h.id} className="py-2.5 first:pt-0 last:pb-0">
                <p className="text-xs text-muted-foreground">
                  {h.timestamp.toLocaleString("pt-BR")} • {h.userName}{h.quick ? " • edição rápida" : ""}
                </p>
                <ul className="mt-0.5 space-y-0.5">
                  {h.changes.map((c, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-medium">{c.label}:</span>{" "}
                      <span className="text-muted-foreground line-through decoration-muted-foreground/50">{c.from}</span>{" → "}
                      <span className="font-semibold">{c.to}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
