import * as React from "react"
import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <label className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
    <input
      type="checkbox"
      className={cn(
        "peer sr-only",
        className
      )}
      ref={ref}
      {...props}
    />
    <div className="h-5 w-9 rounded-full bg-muted border border-border peer-checked:bg-primary transition-colors"></div>
    <div className="pointer-events-none absolute left-0 top-0 inline-block h-5 w-5 transform rounded-full bg-card border border-border shadow-sm transition-transform peer-checked:translate-x-4"></div>
  </label>
))
Switch.displayName = "Switch"

export { Switch }
