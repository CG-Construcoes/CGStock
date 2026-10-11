"use client"

import React, { useState } from "react"
import { CircleHelp } from "lucide-react"
import { cn } from "@/lib/utils"

interface InfoTooltipProps {
  title?: string
  text: string
  className?: string
  iconClassName?: string
  side?: "top" | "bottom"
}

export function InfoTooltip({
  title,
  text,
  className,
  iconClassName,
  side = "top",
}: InfoTooltipProps) {
  const [open, setOpen] = useState(false)
  const fullText = title ? `${title}: ${text}` : text

  return (
    <span
      className={cn("relative inline-flex items-center align-middle group/tip ml-1", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        title={fullText}
        aria-label={fullText}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((prev) => !prev)
        }}
        className="inline-flex items-center justify-center text-muted-foreground/60 hover:text-primary transition-colors focus:outline-none cursor-help p-0.5 rounded-full hover:bg-muted/50"
      >
        <CircleHelp className={cn("h-3.5 w-3.5", iconClassName)} />
      </button>

      {open && (
        <span
          role="tooltip"
          className={cn(
            "absolute left-1/2 -translate-x-1/2 z-50 w-56 sm:w-64 p-2.5 rounded-md border border-border bg-popover text-popover-foreground text-xs shadow-xl backdrop-blur-md pointer-events-none transition-all duration-150 animate-in fade-in-0 zoom-in-95",
            side === "top" ? "bottom-full mb-2" : "top-full mt-2"
          )}
        >
          {title && (
            <span className="block font-semibold text-foreground text-xs mb-1">
              {title}
            </span>
          )}
          <span className="block text-muted-foreground text-[11px] leading-relaxed font-normal normal-case text-left">
            {text}
          </span>
          {/* Arrow */}
          <span
            className={cn(
              "absolute left-1/2 -translate-x-1/2 border-4 border-transparent",
              side === "top"
                ? "top-full border-t-popover"
                : "bottom-full border-b-popover"
            )}
          />
        </span>
      )}
    </span>
  )
}
