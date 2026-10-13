import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    // Using a simpler approach than cva for now, maintaining standard shadcn visual feel
    const baseStyles = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-bold   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]"
    
    const variants = {
      default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
      destructive: "bg-red-500 text-white hover:bg-red-600 shadow-sm shadow-red-500/20 hover:shadow-sm hover:shadow-red-500/30",
      outline: "border border-border bg-transparent hover:bg-muted/50 hover:text-foreground",
      secondary: "bg-accent/50 text-foreground hover:bg-accent",
      ghost: "hover:bg-muted/50 hover:text-foreground",
      link: "text-primary underline-offset-4 hover:underline",
    }
    
    const sizes = {
      default: "h-11 px-5 py-2",
      sm: "h-9 rounded-lg px-3 text-xs",
      lg: "h-12 rounded-md px-8",
      icon: "h-11 w-11",
    }
    
    return (
      <Comp
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        disabled={loading || disabled}
        {...props}
      >
        {asChild ? children : (
          <>
            {loading && <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
            {children}
          </>
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button }
