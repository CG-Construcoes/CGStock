"use client"

import * as React from "react"
import { Input, type InputProps } from "./input"
import { formatDecimalBR, parseDecimalBR } from "@/lib/decimal-br"
import { cn } from "@/lib/utils"

export type DecimalInputProps = Omit<InputProps, "type" | "value" | "defaultValue" | "onChange" | "min" | "max"> & {
  value?: number | null
  defaultValue?: number | null
  onValueChange?: (value: number) => void
  min?: number
  max?: number
  /** Casas decimais exibidas ao sair do campo (padrão 4; use 2 para dinheiro). */
  fractionDigits?: number
  /** Texto curto após o número na prévia (ex.: unidade "M"). */
  suffix?: string
}

/**
 * Campo numérico no padrão brasileiro (aceita "11.000" e "12,5").
 * Envia no FormData (via `name`) o valor normalizado ("11000"), e mostra
 * a prévia de como o número foi entendido enquanto o usuário digita.
 */
export const DecimalInput = React.forwardRef<HTMLInputElement, DecimalInputProps>(
  ({ value, defaultValue, onValueChange, name, min, max, fractionDigits = 4, suffix, className, required, onBlur, onFocus, ...props }, ref) => {
    const initial = value ?? defaultValue
    // 0 controlado aparece vazio (como antes, `value || ''`); defaultValue 0 aparece "0"
    const [text, setText] = React.useState(() => (initial != null && (initial !== 0 || defaultValue === 0) ? formatDecimalBR(initial, fractionDigits) : ""))
    const [focused, setFocused] = React.useState(false)
    const parsed = parseDecimalBR(text)
    const innerRef = React.useRef<HTMLInputElement>(null)
    React.useImperativeHandle(ref, () => innerRef.current!)

    // Sincroniza quando o valor controlado muda por fora (ex.: escolher produto preenche o custo)
    const lastEmitted = React.useRef<number | null | undefined>(initial)
    React.useEffect(() => {
      if (value === undefined || value === lastEmitted.current) return
      lastEmitted.current = value
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setText(value != null && value !== 0 ? formatDecimalBR(value, fractionDigits) : "")
    }, [value, fractionDigits])

    const error = text === ""
      ? (required ? "Informe um número." : "")
      : Number.isNaN(parsed) ? "Número inválido. Use 11.000 ou 12,5."
      : min !== undefined && parsed < min ? `O valor mínimo é ${formatDecimalBR(min)}.`
      : max !== undefined && parsed > max ? `O valor máximo é ${formatDecimalBR(max)}.`
      : ""

    React.useEffect(() => {
      innerRef.current?.setCustomValidity(error)
    }, [error])

    const showPreview = focused && !Number.isNaN(parsed) && /[.,]/.test(text)

    return (
      <div className="relative">
        <Input
          ref={innerRef}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          required={required}
          aria-invalid={!!error && text !== "" ? true : undefined}
          className={cn("tabular-nums", className)}
          onChange={(e) => {
            const next = e.target.value.replace(/[^\d.,-]/g, "")
            setText(next)
            const n = parseDecimalBR(next)
            const emitted = Number.isNaN(n) ? 0 : n
            lastEmitted.current = emitted
            onValueChange?.(emitted)
          }}
          onFocus={(e) => { setFocused(true); onFocus?.(e) }}
          onBlur={(e) => {
            setFocused(false)
            if (!Number.isNaN(parsed) && text !== "") setText(formatDecimalBR(parsed, fractionDigits))
            onBlur?.(e)
          }}
          {...props}
        />
        {name && <input type="hidden" name={name} value={Number.isNaN(parsed) ? "" : String(parsed)} />}
        {showPreview && (
          <span className="pointer-events-none absolute left-1 -bottom-4 z-10 whitespace-nowrap rounded bg-foreground px-1.5 text-[10px] font-semibold leading-4 text-background shadow">
            = {formatDecimalBR(parsed, fractionDigits)}{suffix ? ` ${suffix}` : ""}
          </span>
        )}
      </div>
    )
  }
)
DecimalInput.displayName = "DecimalInput"
