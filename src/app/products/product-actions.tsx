"use client"

import { Button } from "@/components/ui/button"
import { MoreHorizontal, Pencil, QrCode, Printer, Trash2 } from "lucide-react"
import { useState, useRef, useEffect, useSyncExternalStore } from "react"
import Link from "next/link"
import { QRCodeSVG } from "qrcode.react"
import { createPortal } from "react-dom"

export function ProductActions({ productId, productCode, productName, hasUpdate = true, hasDelete = true }: { productId: string, productCode: string, productName: string, hasUpdate?: boolean, hasDelete?: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  const handlePrint = () => {
    setTimeout(() => {
      window.print()
    }, 100)
  }

  const qrModalContent = showQrModal ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60    ">
      <div className="w-full max-w-sm rounded-md bg-white p-8 shadow-sm border border-gray-200    text-black print-exact">
        <div className="text-center mb-6">
          <h2 className="text-lg font-black tracking-tight">{productCode}</h2>
          <p className="text-sm text-gray-500 line-clamp-2 mt-1">{productName}</p>
        </div>
        
        <div className="flex justify-center bg-white p-4 rounded-md border-2 border-dashed border-gray-200">
          <QRCodeSVG 
            value={productCode} 
            size={200}
            bgColor={"#ffffff"}
            fgColor={"#000000"}
            level={"H"}
          />
        </div>
        
        <div className="mt-8 flex justify-between gap-3 print-hidden">
          <Button 
            variant="outline" 
            onClick={() => setShowQrModal(false)}
            className="rounded-md flex-1 text-black border-gray-300 hover:bg-gray-100"
          >
            Fechar
          </Button>
          <Button 
            onClick={handlePrint}
            className="rounded-md flex-1 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm flex items-center justify-center gap-2"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </div>
    </div>
  ) : null

  return (
    <div className="relative flex justify-end" ref={dropdownRef}>
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 w-8 text-muted-foreground hover:bg-muted"
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-10 z-50 w-44 rounded-md border border-border bg-card  p-1.5 shadow-sm    ">
          {hasUpdate && (
            <Link href={`/products/${productId}/edit`}>
              <button className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-foreground hover:bg-muted ">
                <Pencil className="h-4 w-4 text-muted-foreground" />
                Editar
              </button>
            </Link>
          )}
          <button 
            onClick={() => {
              setIsOpen(false)
              setShowQrModal(true)
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-foreground hover:bg-muted  mt-1"
          >
            <QrCode className="h-4 w-4 text-primary" />
            Etiqueta (QR Code)
          </button>
          {hasDelete && (
            <button 
              onClick={async () => {
                if (window.confirm('Tem certeza que deseja excluir este produto?')) {
                  const { deleteProduct } = await import('./actions')
                  await deleteProduct(productId)
                  window.location.reload()
                }
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50  mt-1"
            >
              <Trash2 className="h-4 w-4 text-red-600" />
              Excluir
            </button>
          )}
        </div>
      )}

      {/* MODAL DO QR CODE (Renderizado no Portal) */}
      {mounted && showQrModal && createPortal(qrModalContent, document.body)}
    </div>
  )
}
