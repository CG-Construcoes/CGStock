"use client"
import { toast } from "sonner"

export function handleAction<Args extends unknown[], R>(action: (...args: Args) => Promise<R>) {
  return async (...args: Args): Promise<R | void> => {
    try {
      return await action(...args)
    } catch (error) {
      const err = error as { message?: string; digest?: string }
      // Allow Next.js redirect errors to propagate naturally
      if (err.message === 'NEXT_REDIRECT' || err.digest?.startsWith('NEXT_REDIRECT')) {
        throw error
      }

      // Extract the message from the standard Error object thrown by server actions
      toast.error(err.message ?? "Ocorreu um erro inesperado.")
    }
  }
}
