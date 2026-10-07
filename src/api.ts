/**
 * Adres serwera aplikacji (`server/api`): przypomnienia push i wiadomości od użytkowników.
 * Przychodzi z buildu (`VITE_API_URL`). Pusty — aplikacja działa w całości bez serwera,
 * tylko bez przypomnień i bez formularza uwag.
 */
export const API_URL = String(import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

export const apiConfigured = (): boolean => API_URL !== '';
