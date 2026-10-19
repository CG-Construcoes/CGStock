"use client"

import React, { useState, useRef, useEffect } from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SearchableSelectProps {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  name?: string
  required?: boolean
  placeholder?: string
  className?: string
}

export function SearchableSelect({
  options,
  value,
  onChange,
  name,
  required,
  placeholder = "Selecionar...",
  className
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const wrapperRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((opt) => opt.value === value)
  const displayValue = selectedOption ? selectedOption.label : ""

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className={cn("relative w-full", className)} ref={wrapperRef}>
      {name && (
        <input 
          type="hidden" 
          name={name} 
          value={value} 
          required={required} 
        />
      )}
      
      <button
        type="button"
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-md border border-border bg-muted/20 px-4 py-2 text-sm  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary hover:bg-muted/50",
          !value && "text-muted-foreground"
        )}
        onClick={() => {
          setIsOpen(!isOpen)
          if (!isOpen) setSearchTerm("")
        }}
      >
        <span className="truncate">{displayValue || placeholder}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-background/80  md:hidden" 
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen(false)
            }} 
          />
          <div className={cn(
            "z-50 overflow-hidden border bg-popover text-popover-foreground shadow-sm  flex flex-col",
            "fixed inset-x-0 bottom-0 max-h-[80vh] rounded-t-xl sm:rounded-md",
            "md:absolute md:mt-1 md:max-h-60 md:w-full md:inset-auto md:rounded-md md: md:"
          )}>
            <div className="sticky top-0 bg-popover p-3 md:p-2 border-b z-10">
              <div className="flex items-center rounded-md border px-3">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <input
                  className="flex h-10 md:h-9 w-full rounded-md bg-transparent py-3 text-base md:text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Pesquisar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            
            <div className="p-2 md:p-1 overflow-y-auto pb-6 md:pb-1">
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum resultado encontrado.
                </div>
              ) : (
                <>
                  {filteredOptions.slice(0, 80).map((option) => (
                    <div
                      key={option.value}
                      className={cn(
                        "relative flex cursor-pointer select-none items-center rounded-sm py-3 md:py-1.5 pl-10 md:pl-8 pr-4 md:pr-2 text-base md:text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                        value === option.value && "bg-accent/50 text-accent-foreground font-medium"
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        onChange(option.value)
                        setIsOpen(false)
                      }}
                    >
                      <span className="absolute left-3 md:left-2 flex h-5 w-5 md:h-3.5 md:w-3.5 items-center justify-center">
                        {value === option.value && <Check className="h-5 w-5 md:h-4 md:w-4" />}
                      </span>
                      {option.label}
                    </div>
                  ))}
                  {filteredOptions.length > 80 && (
                    <div className="py-2 px-3 text-center text-xs text-muted-foreground border-t border-border/50 mt-1">
                      Mostrando 80 de {filteredOptions.length.toLocaleString("pt-BR")} — digite para filtrar
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
