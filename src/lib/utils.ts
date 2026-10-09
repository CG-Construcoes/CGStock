import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: unknown): string {
  if (value == null) return "R$ 0,00";
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (isNaN(num)) return "R$ 0,00";
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
}

export function formatNumber(value: unknown, minimumFractionDigits = 0): string {
  if (value == null) return "0";
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (isNaN(num)) return "0";
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits, maximumFractionDigits: 2 }).format(num);
}
