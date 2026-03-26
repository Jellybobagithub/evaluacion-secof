export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Genera la URL de login con Google OAuth.
 * El origin se pasa como parámetro para que el backend construya el redirect URI correcto.
 */
export const getLoginUrl = () => {
  const origin = window.location.origin;
  return `/api/auth/google?origin=${encodeURIComponent(origin)}`;
};
