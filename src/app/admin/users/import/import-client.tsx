"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import Papa from "papaparse"
import { importEmployeesAction, EmployeeImportRow } from "./actions"
import { useRouter } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export function ImportUsersClient() {
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<EmployeeImportRow[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number, updated: number, errors: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setResult(null)
      parseFile(e.target.files[0])
    }
  }

  const parseFile = (f: File) => {
    setIsParsing(true)
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedRows = results.data.map((row: any) => ({
          name: row.name || row.Nome || row.nome || '',
          email: row.email || row.Email || row['E-mail'] || '',
          employeeCode: row.employeeCode || row.matricula || row.Matricula || row['Matrícula'] || row.code || ''
        }))
        setRows(parsedRows)
        setIsParsing(false)
      },
      error: (error) => {
        console.error(error)
        setIsParsing(false)
      }
    })
  }

  const handleImport = async () => {
    if (rows.length === 0) return
    setIsImporting(true)
    const res = await importEmployeesAction(rows)
    setIsImporting(false)
    if (res.success) {
      setResult({ imported: res.imported!, updated: res.updated!, errors: res.errors! })
    } else {
      setResult({ imported: 0, updated: 0, errors: [res.message || "Erro desconhecido."] })
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Importar Funcionários</h2>
        <p className="text-muted-foreground">Importe usuários em lote usando um arquivo CSV.</p>
      </div>

      <Card className="border-[#5C3310]/20 shadow-lg overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-[#5C3310]/10">
          <CardTitle>Envio de Arquivo</CardTitle>
          <CardDescription>
            O arquivo CSV deve conter um cabeçalho com as colunas <strong>Nome</strong>, <strong>Email</strong> e <strong>Matrícula</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {!file && (
            <div 
              className="border-2 border-dashed border-primary/30 rounded-lg p-12 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud className="h-10 w-10 text-primary/60 mb-4" />
              <p className="text-sm font-medium mb-1">Clique para selecionar um arquivo CSV</p>
              <p className="text-xs text-muted-foreground">Tamanho máximo: 5MB</p>
            </div>
          )}

          <input 
            type="file" 
            accept=".csv" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
          />

          {file && !result && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 text-primary rounded-full">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {isParsing ? "Analisando..." : `${rows.length} registros encontrados`}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => { setFile(null); setRows([]) }}>
                  Trocar Arquivo
                </Button>
              </div>

              {rows.length > 0 && (
                <div className="space-y-4">
                  <div className="max-h-64 overflow-y-auto border border-border rounded-lg">
                    <Table>
                      <TableHeader className="bg-muted/50 sticky top-0">
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>E-mail</TableHead>
                          <TableHead>Matrícula</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.slice(0, 50).map((row, i) => {
                          const hasError = !row.email && !row.employeeCode;
                          return (
                            <TableRow key={i} className={hasError ? "bg-destructive/10" : ""}>
                              <TableCell className="font-medium">{row.name || '-'}</TableCell>
                              <TableCell>{row.email || '-'}</TableCell>
                              <TableCell>{row.employeeCode || '-'}</TableCell>
                              <TableCell>
                                {hasError ? (
                                  <Badge variant="destructive" className="text-[10px]">Inválido</Badge>
                                ) : (
                                  <Badge variant="success" className="text-[10px]">Ok</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                        {rows.length > 50 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground text-xs py-4">
                              E mais {rows.length - 50} registros ocultos.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-border">
                    <Button variant="outline" onClick={() => router.push('/admin/users')}>Cancelar</Button>
                    <Button onClick={handleImport} disabled={isImporting || rows.length === 0} className="min-w-32">
                      {isImporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      Importar Todos
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {result && (
            <div className="space-y-6">
              <div className="p-6 bg-success/10 border border-success/20 rounded-lg flex flex-col items-center justify-center text-center">
                <CheckCircle2 className="h-12 w-12 text-success mb-3" />
                <h3 className="text-xl font-bold text-success-foreground mb-1">Importação Concluída!</h3>
                <p className="text-muted-foreground">
                  {result.imported} usuários criados e {result.updated} atualizados.
                </p>
              </div>

              {result.errors.length > 0 && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <div className="flex items-center gap-2 text-destructive mb-3">
                    <AlertCircle className="h-5 w-5" />
                    <h4 className="font-bold">Erros Encontrados ({result.errors.length})</h4>
                  </div>
                  <ul className="text-sm text-destructive-foreground space-y-1 list-disc pl-5 max-h-40 overflow-y-auto">
                    {result.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-center pt-4">
                <Button onClick={() => router.push('/admin/users')} size="lg">
                  Voltar para Usuários
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
