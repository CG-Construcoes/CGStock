"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { togglePermission } from "./actions"
import { toast } from "sonner"

type Role = {
  id: string
  name: string
  permissions: { permissionId: string }[]
}

type Permission = {
  id: string
  key: string
  name: string
}

interface PermissionsTableProps {
  roles: Role[]
  permissions: Permission[]
}

export function PermissionsTable({ roles, permissions }: PermissionsTableProps) {
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({})

  const handleToggle = async (roleId: string, permissionId: string, checked: boolean) => {
    const key = `${roleId}-${permissionId}`
    setLoadingMap(prev => ({ ...prev, [key]: true }))
    
    try {
      await togglePermission(roleId, permissionId, checked)
      toast.success(checked ? "Permissão concedida" : "Permissão removida")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar permissão")
    } finally {
      setLoadingMap(prev => ({ ...prev, [key]: false }))
    }
  }

  return (
    <div className="bg-card rounded-md shadow-sm border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[300px]">Permissão</TableHead>
              {roles.map(role => (
                <TableHead key={role.id} className="text-center font-bold">{role.name}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissions.map(permission => (
              <TableRow key={permission.id} className="hover:bg-muted/20">
                <TableCell>
                  <p className="font-semibold text-foreground">{permission.name}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{permission.key}</p>
                </TableCell>
                {roles.map(role => {
                  const hasPerm = role.permissions.some(rp => rp.permissionId === permission.id)
                  const isAdmin = role.name === 'ADMIN'
                  const key = `${role.id}-${permission.id}`
                  const isLoading = loadingMap[key]

                  return (
                    <TableCell key={key} className="text-center">
                      <Switch 
                        checked={isAdmin || hasPerm} 
                        disabled={isAdmin || isLoading}
                        onChange={(e) => handleToggle(role.id, permission.id, e.target.checked)}
                        aria-label={`Permissão ${permission.key} para ${role.name}`}
                      />
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
