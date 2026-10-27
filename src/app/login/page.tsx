import { redirect } from "next/navigation"
import { getValidatedSession } from "@/lib/auth"
import { LoginForm } from "./login-form"

// A decisão "sessão válida → dashboard" precisa validar o usuário no banco
// (getValidatedSession), não só a assinatura do JWT como faz o proxy.
// Um cookie válido de outro banco/ambiente faria o proxy mandar para
// /dashboard e a página devolver para /login — loop infinito de redirects.
export default async function LoginPage() {
  const session = await getValidatedSession()
  if (session) redirect("/dashboard")
  return <LoginForm />
}
