"use client"

import { Button } from "@/components/ui/button"
import { MoreHorizontal, Pencil, Trash2, Printer, KeyRound, Copy } from "lucide-react"
import { deleteUserAction, softDeleteUserAction, resetPasswordAction } from "./actions"
import { useTransition, useState, useRef, useEffect } from "react"
import Link from "next/link"

export function UserActions({ userId, userName }: { userId: string, userName: string }) {
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null)
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

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteUserAction(userId)
      if (res?.error) {
        if (res.hasHistory) {
          setShowDeleteModal(false)
          setShowHistoryModal(true)
        } else {
          alert(res.error)
          setShowDeleteModal(false)
        }
      } else {
        setShowDeleteModal(false)
      }
      setIsOpen(false)
    })
  }

  const handleSoftDelete = () => {
    startTransition(async () => {
      const res = await softDeleteUserAction(userId)
      if (res?.error) {
        alert(res.error)
      }
      setShowHistoryModal(false)
    })
  }

  const handleResetPassword = () => {
    startTransition(async () => {
      const res = await resetPasswordAction(userId)
      if (res?.error) {
        alert(res.error)
        setShowResetModal(false)
      } else if (res?.success && res.newPassword) {
        setGeneratedPassword(res.newPassword)
      }
    })
  }

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
          <Link href={`/admin/users/print-badges?ids=${userId}`}>
            <button className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-foreground hover:bg-muted ">
              <Printer className="h-4 w-4 text-muted-foreground" />
              Imprimir Crachá
            </button>
          </Link>
          <Link href={`/admin/users/${userId}/edit`}>
            <button className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-foreground hover:bg-muted ">
              <Pencil className="h-4 w-4 text-muted-foreground" />
              Editar
            </button>
          </Link>
          <button 
            onClick={() => {
              setIsOpen(false)
              setShowResetModal(true)
              setGeneratedPassword(null)
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-foreground hover:bg-muted mt-1"
          >
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            Resetar Senha
          </button>
          <button 
            onClick={() => {
              setIsOpen(false)
              setShowDeleteModal(true)
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10  mt-1"
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </button>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60    ">
          <div className="w-full max-w-sm rounded-md bg-card p-6 shadow-sm border border-border   ">
            <h2 className="text-xl font-bold text-foreground">Excluir Usuário?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Você tem certeza que deseja excluir o usuário <span className="font-bold text-foreground">{userName}</span>? 
              Esta ação não poderá ser desfeita.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowDeleteModal(false)}
                disabled={isPending}
                className="rounded-md"
              >
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDelete}
                disabled={isPending}
                className="rounded-md shadow-sm"
              >
                {isPending ? "Excluindo..." : "Sim, Excluir"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60    ">
          <div className="w-full max-w-sm rounded-md bg-card p-6 shadow-sm border border-border   ">
            <h2 className="text-xl font-bold text-foreground">Usuário com Histórico</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Este usuário não pode ser excluído completamente pois possui ações registradas no sistema.
              Podemos <strong>apagar o usuário</strong> de forma lógica, garantindo que ele não acesse mais o sistema, mas mantendo seu histórico salvo.<br/><br/>
              Deseja continuar?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowHistoryModal(false)}
                disabled={isPending}
                className="rounded-md"
              >
                Não
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleSoftDelete}
                disabled={isPending}
                className="rounded-md shadow-sm"
              >
                {isPending ? "Apagando..." : "Sim, Apagar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showResetModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-md bg-card p-6 shadow-sm border border-border">
            <h2 className="text-xl font-bold text-foreground">Resetar Senha</h2>
            
            {generatedPassword ? (
              <div className="mt-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                  A senha foi resetada com sucesso e é válida por 24 horas. O usuário precisará definir uma nova senha no próximo login.
                </p>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-md border border-border">
                  <span className="font-mono text-lg font-bold flex-1">{generatedPassword}</span>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => {
                      navigator.clipboard.writeText(generatedPassword)
                      alert("Senha copiada!")
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={() => setShowResetModal(false)} className="rounded-md">
                    Concluir
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  Ao resetar a senha, as sessões ativas do usuário <span className="font-bold text-foreground">{userName}</span> serão desconectadas e uma nova senha temporária será gerada.
                </p>
                <div className="mt-6 flex justify-end gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowResetModal(false)}
                    disabled={isPending}
                    className="rounded-md"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    variant="default" 
                    onClick={handleResetPassword}
                    disabled={isPending}
                    className="rounded-md shadow-sm bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {isPending ? "Gerando..." : "Confirmar Reset"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
