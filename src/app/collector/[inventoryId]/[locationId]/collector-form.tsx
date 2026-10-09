"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {  Send, Scan, Plus, Minus, Trash2, Camera, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { localDb, type LocalProduct } from "@/lib/localdb"
import { Html5Qrcode } from "html5-qrcode"
import { BackButton } from "@/components/ui/back-button"

type CollectedItem = {
  productId: string
  code: string
  name: string
  quantity: number
}

export default function CollectorForm({
  inventoryId,
  locationId,
  locationCode,
  products
}: {
  inventoryId: string
  locationId: string
  locationCode: string
  products: LocalProduct[]
}) {
  const router = useRouter()
  const [items, setItems] = useState<CollectedItem[]>([])
  const [searchInput, setSearchInput] = useState("")
  const [showScanner, setShowScanner] = useState(false)
  const [cameraError, setCameraError] = useState("")

  const processSearch = useCallback((term: string) => {
    if (!term.trim()) return

    const upperTerm = term.trim().toUpperCase()
    const found = products.find((p) =>
      p.code.toUpperCase().includes(upperTerm) ||
      p.barcode?.toUpperCase() === upperTerm ||
      p.name.toUpperCase().includes(upperTerm)
    )

    if (found) {
      setItems(prev => {
        const existing = prev.find(i => i.productId === found.id)
        if (existing) {
          return prev.map(i => i.productId === found.id ? { ...i, quantity: i.quantity + 1 } : i)
        } else {
          return [{ productId: found.id, code: found.code, name: found.name, quantity: 1 }, ...prev]
        }
      })
      setSearchInput("")
    } else {
      alert("Produto não encontrado!")
    }
  }, [products])

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null

    if (showScanner) {
      html5QrCode = new Html5Qrcode("reader")

      html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          setSearchInput(decodedText)
          setShowScanner(false)
          processSearch(decodedText)
        },
        () => {
          // Ignorar erros de leitura de frame (muito comuns)
        }
      ).catch(err => {
        console.error("Camera error:", err)
        setCameraError("Não foi possível acessar a câmera. Verifique as permissões do navegador ou se o dispositivo possui uma câmera compatível.")
      })
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
          html5QrCode?.clear()
        }).catch(console.error)
      }
    }
  }, [showScanner, processSearch])

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault()
    processSearch(searchInput)
  }

  const changeQuantity = (productId: string, delta: number) => {
    setItems(items.map(i => {
      if (i.productId === productId) {
        const newQ = i.quantity + delta
        return { ...i, quantity: newQ > 0 ? newQ : 1 }
      }
      return i
    }))
  }

  const setExactQuantity = (productId: string, val: string) => {
    const num = parseInt(val, 10)
    if (!isNaN(num) && num > 0) {
      setItems(items.map(i => i.productId === productId ? { ...i, quantity: num } : i))
    }
  }

  const removeItem = (productId: string) => {
    setItems(items.filter(i => i.productId !== productId))
  }

  const handleFinish = async () => {
    if (items.length === 0) return

    const payload = {
      inventoryId,
      locationId,
      items: items.map(i => ({ productId: i.productId, quantity: i.quantity }))
    }

    if (localDb) {
      // Salva offline no Dexie na fila de sincronização
      await localDb.syncQueue.add({
        operation: 'SUBMIT_COLLECTION',
        entityId: `${inventoryId}_${locationId}`,
        payload,
        status: 'PENDING',
        attempts: 0,
        createdAt: new Date()
      })

      // Redireciona para a tela de sync que tentará processar
      router.push('/collector/sync')
    } else {
      // Fallback pra envio normal se IndexedDB não rolar (improvável em PWA)
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'SUBMIT_COLLECTION', payload })
      }).then(() => {
        router.push('/collector')
      })
    }
  }

  return (
    <div className="flex flex-col h-screen relative">
      {/* Header */}
      <div className="bg-primary/95  text-primary-foreground p-4 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="text-xl font-black tracking-tight">{locationCode}</h1>
            <p className="text-primary-foreground/80 text-xs font-medium">Coleta em Andamento</p>
          </div>
        </div>
        <div className="bg-black/20 px-3 py-1 rounded-full text-sm font-bold shadow-inner border border-white/10">
          {items.length} itens
        </div>
      </div>

      {/* Scanner Modal */}
      {showScanner && (
        <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center">
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-6 right-6 text-white hover:bg-white/20 rounded-full"
            onClick={() => setShowScanner(false)}
          >
            <X className="h-8 w-8" />
          </Button>
          <div className="w-full max-w-sm p-6 bg-card rounded-md shadow-sm mx-4">
            <h3 className="text-xl font-bold text-center mb-4 text-foreground">Leitor de Cód. Barras</h3>
            
            {cameraError ? (
              <div className="text-center p-4">
                <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-4">
                  <p className="text-sm font-semibold">{cameraError}</p>
                </div>
                <Button variant="outline" onClick={() => setShowScanner(false)} className="w-full rounded-md">
                  Fechar
                </Button>
              </div>
            ) : (
              <>
                <div id="reader" className="w-full overflow-hidden rounded-md bg-black border-2 border-primary/20 aspect-square flex items-center justify-center relative">
                  {/* Overlay for aesthetic scanning */}
                  <div className="absolute inset-0 border-2 border-primary/50 opacity-50 pointer-events-none rounded-md m-4"></div>
                </div>
                <p className="text-center text-sm mt-6 text-muted-foreground font-medium">
                  Aponte a câmera para o código
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Área de Bipagem */}
      <div className="p-4 bg-card shadow-sm z-10">
        <form onSubmit={handleScan} className="flex gap-2">
          <Button 
            type="button"
            variant="outline"
            size="icon"
            className="h-12 w-12 border-gray-300"
            onClick={() => { setCameraError(""); setShowScanner(true) }}
          >
            <Camera className="h-6 w-6 text-muted-foreground" />
          </Button>
          <div className="relative flex-1">
            <Scan className="absolute left-3 top-3 h-6 w-6 text-primary/60" />
            <Input 
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Cód. Barras ou SKU..." 
              className="pl-12 h-12 text-lg uppercase font-bold bg-muted/50 border-border focus-visible:ring-primary rounded-md "
              autoFocus
            />
          </div>
          <Button type="submit" size="icon" className="h-12 w-12 bg-primary hover:bg-muted/50 rounded-md shadow-sm transition-transform active:scale-95">
            <Plus className="h-6 w-6" />
          </Button>
        </form>
      </div>

      {/* Lista de Itens */}
      <div className="flex-1 overflow-y-auto p-4 bg-accent">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4 mt-10">
            <Scan className="h-16 w-16 opacity-50" />
            <p className="text-lg font-medium text-center">Bipe um produto ou<br/>leia com a câmera</p>
          </div>
        ) : (
          <div className="space-y-3 pb-24">
            {items.map((item) => (
              <div key={item.productId} className="bg-card p-4 rounded-md shadow-sm border border-border">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-foreground leading-tight">{item.code}</h3>
                    <p className="text-sm text-muted-foreground truncate max-w-[200px]">{item.name}</p>
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => removeItem(item.productId)}
                    className="text-red-400 hover:text-red-600 hover:bg-red-50 -mt-2 -mr-2"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 bg-accent rounded-lg p-1">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => changeQuantity(item.productId, -1)}
                      className="h-10 w-10 p-0 rounded-md bg-card shadow-sm text-muted-foreground active:bg-gray-200"
                    >
                      <Minus className="h-5 w-5" />
                    </Button>
                    
                    <input 
                      type="number" 
                      name={`qty_${item.productId}`}
                      value={item.quantity}
                      onChange={(e) => setExactQuantity(item.productId, e.target.value)}
                      className="w-16 h-10 text-center font-bold text-lg bg-transparent border-none focus:ring-0"
                    />

                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => changeQuantity(item.productId, 1)}
                      className="h-10 w-10 p-0 rounded-md bg-card shadow-sm text-primary hover:text-primary active:bg-primary/10 "
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer / Send */}
      <div className="bg-card p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10 absolute bottom-0 left-0 right-0">
        <Button 
          type="button" 
          onClick={handleFinish}
          disabled={items.length === 0}
          className="w-full h-14 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md flex items-center justify-center gap-2"
        >
          <Send className="h-6 w-6" />
          Finalizar Coleta
        </Button>
      </div>
    </div>
  )
}
