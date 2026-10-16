"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Package, ChevronDown } from "lucide-react"
import { getNavSections, isNavItemActive, type NavItem, type NavUser } from "./nav-config"

/** Menu lateral fixo (telas grandes). No celular é usado o MobileMenu. */
export function Sidebar({ user }: { user?: NavUser }) {
  const pathname = usePathname()
  const sections = getNavSections(user)

  // A seção "Mais" já começa aberta se a página atual estiver dentro dela
  const moreHasActive = sections.some((s) => s.collapsible && s.items.some((i) => isNavItemActive(pathname, i.href)))
  const [isMoreOpen, setIsMoreOpen] = useState(moreHasActive)

  const renderItem = (item: NavItem) => {
    const isActive = isNavItemActive(pathname, item.href)

    return (
      <li key={item.href}>
        <Link
          href={item.href}
          title={item.description}
          aria-current={isActive ? "page" : undefined}
          className={cn(
            "group flex items-center gap-3 px-3 py-2.5 text-sm font-medium border-l-2 transition-colors",
            isActive
              ? "border-[#e95420] text-white bg-[#5e2750]"
              : "border-transparent text-[#f6f5f4] hover:bg-[#5e2750]/30 hover:text-[#ffb597]"
          )}
        >
          <item.icon className={cn(
            "h-4 w-4 shrink-0 transition-colors",
            isActive ? "text-[#ffb597]" : "text-[#f49570] group-hover:text-[#ffb597]"
          )} />
          {item.name}
        </Link>
      </li>
    )
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-[#5e2750] bg-[#2c001e]">
      <div className="flex h-16 items-center border-b border-[#5e2750] px-5 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl text-[#ffb597] tracking-tight">
          <Package className="h-5 w-5 text-[#ffb597]" />
          CGSTOCK
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <nav className="space-y-6 px-2" aria-label="Menu principal">
          {sections.map((section) => {
            if (section.collapsible) {
              const open = isMoreOpen || moreHasActive
              return (
                <div key={section.id}>
                  <button
                    type="button"
                    onClick={() => setIsMoreOpen(!open)}
                    aria-expanded={open}
                    className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-[#ffb597] hover:bg-[#5e2750]/20 rounded-md transition-colors"
                  >
                    <span>{section.title}</span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
                  </button>
                  {open && <ul className="space-y-0.5 mt-2">{section.items.map(renderItem)}</ul>}
                </div>
              )
            }

            return (
              <div key={section.id}>
                {section.title && (
                  <h3 className="mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-[#ffb597]">{section.title}</h3>
                )}
                <ul className="space-y-0.5">{section.items.map(renderItem)}</ul>
              </div>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
