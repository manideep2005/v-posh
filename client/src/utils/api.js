const API_BASE = '/api';

export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('vposh_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Handle FormData (e.g. file uploads) by omitting manual Content-Type header
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  // .catch: empty 2xx bodies (204, etc.) must not crash the caller
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // 429 — rate limited. Surface the server's Retry-After so the UI can
    // show a live "try again in mm:ss" countdown.
    if (response.status === 429) {
      const headerVal = parseInt(response.headers.get('Retry-After') || '', 10);
      const err = new Error(data.message || 'Too many attempts. Please wait a few minutes before trying again.');
      err.isRateLimit = true;
      err.retryAfter = Number.isFinite(headerVal) && headerVal > 0
        ? headerVal
        : (data.retryAfter || 15 * 60); // fall back to the 15-min window default
      throw err;
    }
    // If 401 Unauthorized, notify application context if needed
    if (response.status === 401) {
      // Token might be expired or invalid
    }
    throw new Error(data.message || `HTTP error ${response.status}`);
  }

  return data;
}

export function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Evidence files are private: fetch with the auth token and hand the
// browser a temporary blob URL instead of linking a public path.
export async function openAttachment(attachmentId, originalName) {
  const token = localStorage.getItem('vposh_token');
  const response = await fetch(`${API_BASE}/attachments/${attachmentId}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  if (!response.ok) {
    let message = `Download failed (HTTP ${response.status}).`;
    try {
      const data = await response.json();
      if (data.message) message = data.message;
    } catch {
      // non-JSON error body
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
