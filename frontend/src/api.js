// Relative by default: nginx (Docker) and the Vite dev proxy both forward
// /api requests to the backend, so the browser never talks to it directly.
export const API_BASE = import.meta.env.VITE_API_BASE ?? '/api/v1';

const REQUEST_TIMEOUT_MS = 5000;

async function request(path, { timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export const fetchVault = () => request('/vault');
export const fetchMonitoring = () => request('/monitoring');
export const fetchInventory = () => request('/inventory');
