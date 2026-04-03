/** Backend origin (scheme + host + port). Set via VITE_API_URL in Docker / .env */
export const API_ORIGIN = import.meta.env.VITE_API_URL || 'http://localhost:8000';
