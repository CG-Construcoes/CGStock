"use client"

import { useState, useRef, useEffect } from "react"
import { verifyEmployeeQR, getProductStockForQuickIssue, confirmQuickIssue } from "./actions"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { QrCode, User, Building, Package, Plus, Minus, CheckCircle2, Loader2, ArrowLeft } from "lucide-react"

type EmployeeContext = {
  employee: { id: string, name: string, email: string }
  worksite: { id: string, name: string }
  warehouse: { id: string, name: string }
}

type CartItem = {
  productId: string
  code: string
  name: string
  unit: string
  requestedQuantity: number
  availableQuantity: number
}

export function QuickIssueClient() {
  const [context, setContext] = useState<EmployeeContext | null>(null)
  
  // Scanners
  const [employeeQr, setEmployeeQr] = useState("")
  const [productQr, setProductQr] = useState("")
  
  // Loading states
  const [isScanningEmployee, setIsScanningEmployee] = useState(false)
  const [isScanningProduct, setIsScanningProduct] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  
  // Cart
  const [cart, setCart] = useState<CartItem[]>([])
  
  // Input ref to keep focus for scanner
  const employeeInputRef = useRef<HTMLInputElement>(null)
  const productInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!context && employeeInputRef.current) {
      employeeInputRef.current.focus()
    } else if (context && productInputRef.current) {
      productInputRef.current.focus()
    }
  }, [context])

  const handleEmployeeScan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!employeeQr) return
    
    setIsScanningEmployee(true)
    const result = await verifyEmployeeQR(employeeQr)
    setIsScanningEmployee(false)
    
    if (result.error) {
      toast.error(result.error)
      setEmployeeQr("")
      return
    }
    
    setContext({
      employee: result.employee!,
      worksite: result.worksite!,
      warehouse: result.warehouse!
    })
    setEmployeeQr("")
    toast.success(`Funcionário ${result.employee?.name} identificado.`)
  }

  const handleProductScan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!productQr || !context) return
    
    // Evitar bipar o mesmo produto duas vezes seguidas
    if (cart.find(c => c.code === productQr)) {
      toast.info("Produto já adicionado. Altere a quantidade na lista.")
      setProductQr("")
      return
    }

    setIsScanningProduct(true)
    const result = await getProductStockForQuickIssue(context.worksite.id, context.warehouse.id, productQr)
    setIsScanningProduct(false)
    
    if (result.error) {
      toast.error(result.error)
      setProductQr("")
      return
    }
    
    // Adiciona ao carrinho com quantidade 1 inicialmente
    setCart(prev => [...prev, {
      productId: result.product!.id,
      code: result.product!.code,
      name: result.product!.name,
      unit: result.product!.unit,
      availableQuantity: result.totalAvailable!,
      requestedQuantity: 1
    }])
    
    setProductQr("")
    toast.success(`${result.product?.name} adicionado.`)
    
    // Manter foco no scanner
    if (productInputRef.current) productInputRef.current.focus()
  }

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = item.requestedQuantity + delta
        if (newQty < 1) return item
        if (newQty > item.availableQuantity) {
          toast.error("Quantidade superior ao estoque disponível.")
          return item
        }
        return { ...item, requestedQuantity: newQty }
      }
      return item
    }))
  }

  const removeItem = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId))
  }

  const handleConfirm = async () => {
    if (!context || cart.length === 0) return
    
    setIsConfirming(true)
    const payload = {
      employeeId: context.employee.id,
      worksiteId: context.worksite.id,
      warehouseId: context.warehouse.id,
      items: cart.map(c => ({
        productId: c.productId,
        requestedQuantity: c.requestedQuantity
      }))
    }
    
    const result = await confirmQuickIssue(payload)
    setIsConfirming(false)
    
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`Entrega confirmada com sucesso! (${result.issueNumber})`)
      // Resetar tela para a próxima entrega
      setContext(null)
      setCart([])
    }
  }

  const totalItems = cart.reduce((sum, item) => sum + item.requestedQuantity, 0)

  if (!context) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex flex-col items-center justify-center p-4     relative overflow-hidden rounded-md">
        {/* Background decorative elements */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="w-full max-w-sm space-y-8 z-10">
          <div className="text-center space-y-4">
            <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping duration-1000" />
              <div className="relative bg-emerald-100 dark:bg-emerald-900/50 w-20 h-20 rounded-full flex items-center justify-center shadow-sm shadow-emerald-500/20 border border-emerald-200 dark:border-emerald-800">
                <QrCode className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight    bg-clip-text text-transparent pb-1">
                Entrega Rápida
              </h1>
              <p className="text-muted-foreground mt-2 text-sm font-medium px-4">
                Aproxime o crachá ou capacete do funcionário para identificar e iniciar.
              </p>
            </div>
          </div>
          
          <form onSubmit={handleEmployeeScan} className="space-y-4 bg-card  p-6 rounded-[2rem] border border-border shadow-sm">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                ref={employeeInputRef}
                placeholder="Código do funcionário..." 
                value={employeeQr}
                onChange={e => setEmployeeQr(e.target.value)}
                className="pl-12 h-14 text-lg bg-background/80 border-border shadow-inner focus-visible:ring-emerald-500 rounded-md font-medium"
                autoFocus
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-14 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow-sm shadow-emerald-600/20  active:scale-[0.98]" 
              disabled={isScanningEmployee || !employeeQr}
            >
              {isScanningEmployee ? <Loader2 className="h-6 w-6 animate-spin" /> : "Avançar"}
            </Button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto space-y-6 pb-20 px-4">
      {/* HEADER: INFO DO FUNCIONÁRIO */}
      <Card className="border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm overflow-hidden">
        <div className="bg-emerald-600 px-4 py-2 flex justify-between items-center text-white">
          <span className="font-semibold text-sm tracking-wide">ENTREGA RÁPIDA</span>
          <button onClick={() => { setContext(null); setCart([]) }} className="text-emerald-100 hover:text-white p-1">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 dark:bg-emerald-900/50 p-2 rounded-full text-emerald-600 dark:text-emerald-400">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-gray-100">{context.employee.name}</p>
              <p className="text-xs text-muted-foreground">Destinatário</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-100 dark:border-emerald-900/30">
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <Building className="h-4 w-4 text-emerald-500" />
              <span className="truncate">{context.worksite.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <Package className="h-4 w-4 text-emerald-500" />
              <span className="truncate">{context.warehouse.name}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SCANNER DE PRODUTO */}
      <form onSubmit={handleProductScan} className="space-y-3">
        <div className="relative">
          <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input 
            ref={productInputRef}
            placeholder="Escanear Cód. Insumo do Produto (MAT-XXXX)" 
            value={productQr}
            onChange={e => setProductQr(e.target.value)}
            className="pl-10 py-6 text-center text-lg bg-white dark:bg-zinc-900 shadow-sm border-gray-200 dark:border-zinc-800 focus-visible:ring-emerald-500"
            autoFocus
          />
        </div>
        <Button type="submit" variant="outline" className="w-full" disabled={isScanningProduct || !productQr}>
          {isScanningProduct ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar Item manualmente"}
        </Button>
      </form>

      {/* CART */}
      {cart.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase text-muted-foreground tracking-wider border-b pb-2">
            Itens ({cart.length})
          </h3>
          
          <div className="space-y-3">
            {cart.map(item => (
              <div key={item.productId} className="flex flex-col gap-2 p-3 bg-white dark:bg-zinc-900 rounded-md border border-gray-100 dark:border-zinc-800 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.code} • Disp: {item.availableQuantity} {item.unit}</p>
                  </div>
                  <button onClick={() => removeItem(item.productId)} className="text-red-400 hover:text-red-600 text-xs font-medium">
                    Remover
                  </button>
                </div>
                
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-1 bg-gray-50 dark:bg-zinc-950 p-1 rounded-lg border border-gray-200 dark:border-zinc-800">
                    <button 
                      type="button"
                      onClick={() => updateQuantity(item.productId, -1)}
                      className="w-8 h-8 flex items-center justify-center rounded-md bg-white dark:bg-zinc-900 shadow-sm text-gray-600 hover:text-red-500 active:scale-95"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <div className="w-12 text-center font-bold text-lg">
                      {item.requestedQuantity}
                    </div>
                    <button 
                      type="button"
                      onClick={() => updateQuantity(item.productId, 1)}
                      className="w-8 h-8 flex items-center justify-center rounded-md bg-white dark:bg-zinc-900 shadow-sm text-gray-600 hover:text-emerald-600 active:scale-95"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-muted-foreground">Total: </span>
                    <span className="font-bold text-lg">{item.requestedQuantity} {item.unit}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-6">
            <Button 
              onClick={handleConfirm}
              disabled={isConfirming}
              className="w-full h-14 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 active:scale-95 "
            >
              {isConfirming ? (
                <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Processando...</>
              ) : (
                <><CheckCircle2 className="h-5 w-5 mr-2" /> Confirmar {totalItems} {totalItems === 1 ? 'item' : 'itens'}</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
