const COMMON_PASSWORDS = new Set([
  "1234567890",
  "password10",
  "estoka1234",
  "senha12345",
  "qwerty1234",
  "admin12345",
])

/**
 * Retorna uma mensagem de erro se a senha não atender à política,
 * ou null se for válida.
 */
export function validatePasswordStrength(password: string): string | null {
  if (!password || password.length < 10) {
    return "A senha deve ter no mínimo 10 caracteres."
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "A senha deve conter letras e números."
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return "Esta senha é muito comum. Escolha uma senha mais segura."
  }
  return null
}
