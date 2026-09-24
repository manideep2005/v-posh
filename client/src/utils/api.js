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

// Generated PDFs and CSV exports are auth-protected and streamed as
// attachments. Fetch them as a blob so a failed request shows the server's
// actual message instead of a blank tab, then hand the browser a temporary
// object URL to save.
export async function downloadFile(url, fallbackName = 'V-POSH-Document.pdf', { expectedType = null } = {}) {
  const token = localStorage.getItem('vposh_token');
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    let message = `Could not generate the document (HTTP ${response.status}).`;
    try {
      const data = await response.json();
      if (data && data.message) message = data.message;
    } catch {
      // non-JSON error body — keep the status message above
    }
    if (response.status === 401) message = 'Your session has expired. Please sign in again.';
    throw new Error(message);
  }

  const blob = await response.blob();
  if (!blob.size) throw new Error('The server returned an empty document.');
  if (expectedType && blob.type && !blob.type.includes(expectedType)) {
    throw new Error(`The server did not return the expected ${expectedType} document.`);
  }

  const disposition = response.headers.get('content-disposition') || '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const filename = match ? decodeURIComponent(match[1]) : fallbackName;

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  }, 1500);

  return filename;
}

export function downloadPdf(url, fallbackName = 'V-POSH-Document.pdf') {
  return downloadFile(url, fallbackName, { expectedType: 'application/pdf' });
}

export function downloadCsv(url, fallbackName = 'V-POSH-Export.csv') {
  return downloadFile(url, fallbackName, { expectedType: 'text/csv' });
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
