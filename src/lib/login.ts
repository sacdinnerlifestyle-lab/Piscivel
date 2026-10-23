export const USERNAME_DOMAIN = "piscivel.local";

export function isEmailLogin(value: string) {
  return value.includes("@");
}

export function normalizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "");
}

/** Converte o que o gestor digitou (e-mail ou usuário) no identificador aceito pelo login. */
export function loginToEmail(value: string) {
  const v = value.trim();
  if (isEmailLogin(v)) return v.toLowerCase();
  return `${normalizeUsername(v)}@${USERNAME_DOMAIN}`;
}

/** Mostra o login de forma amigável: usuário puro quando a conta é interna. */
export function emailToLogin(email?: string | null) {
  if (!email) return "";
  const suffix = `@${USERNAME_DOMAIN}`;
  if (email.toLowerCase().endsWith(suffix)) return email.slice(0, email.length - suffix.length);
  return email;
}

export function isValidLogin(value: string) {
  const v = value.trim();
  if (isEmailLogin(v)) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  return /^[a-zA-Z0-9._-]{3,40}$/.test(v);
}
