const secretKey = process.env.JWT_SECRET

if (!secretKey) {
  throw new Error(
    "JWT_SECRET não definida. Defina a variável de ambiente JWT_SECRET antes de iniciar a aplicação."
  )
}

export const jwtKey = new TextEncoder().encode(secretKey)
