import { Package } from "lucide-react"

export function AuthShell({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#2c001e] font-sans">
      <div className="flex flex-col items-center justify-center p-6 sm:p-12 w-full max-w-[480px]">
        <div className="flex items-center gap-3 mb-10 justify-center">
          <Package className="h-8 w-8 text-[#ffb597]" />
          <span className="text-2xl font-black tracking-tight text-[#ffb597]">CGSTOCK</span>
        </div>
        <div className="w-full space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
            {description && <p className="text-zinc-400 text-sm">{description}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
