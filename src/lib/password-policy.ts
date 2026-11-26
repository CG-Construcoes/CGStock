export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_HINT = "Mínimo 8 caracteres, com pelo menos 1 número e 1 caractere especial"

const COMMON_PASSWORDS = new Set([
  "senha@123",
  "senha@1234",
  "senha123!",
  "admin@123",
  "admin123!",
  "12345678!",
  "@12345678",
  "password1!",
  "estoka@123",
  "cgstock@123",
  "qwerty@123",
  "mudar@123",
])

/**
 * Retorna uma mensagem de erro se a senha não atender à política,
 * ou null se for válida.
 */
export function validatePasswordStrength(password: string): string | null {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return `A senha deve ter no mínimo ${PASSWORD_MIN_LENGTH} caracteres.`
  }
  if (!/[0-9]/.test(password) || !/[^A-Za-z0-9\s]/.test(password)) {
    return "A senha deve conter pelo menos um número e um caractere especial (ex: @ # ! $ %)."
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return "Esta senha é muito comum. Escolha uma senha mais segura."
  }
  return null
}
