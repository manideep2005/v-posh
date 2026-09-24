import React, { useState } from 'react';
import { Download, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { downloadPdf } from '../utils/api';

/**
 * Downloads an auth-protected PDF (acknowledgement / status report).
 * Failures are shown next to the button instead of a blocking alert so the
 * user can see exactly what the server said.
 */
export default function PdfDownloadButton({ url, fallbackName, label, iconSize = 13 }) {
  const [state, setState] = useState('idle'); // idle | loading | done | error
  const [error, setError] = useState('');

  const handleDownload = async () => {
    setState('loading');
    setError('');
    try {
      await downloadPdf(url, fallbackName);
      setState('done');
      setTimeout(() => setState('idle'), 2500);
    } catch (err) {
      setError(err.message || 'Failed to download the document.');
      setState('error');
    }
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={handleDownload}
        disabled={state === 'loading'}
        className="btn btn-primary btn-sm"
        title={error || `Download ${label}`}
      >
        {state === 'loading'
          ? <Loader2 size={iconSize} className="spin-icon" />
          : state === 'done'
            ? <CheckCircle2 size={iconSize} />
            : <Download size={iconSize} />}
        {state === 'loading' ? 'Generating…' : state === 'done' ? 'Downloaded' : label}
      </button>
      {state === 'error' && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--color-crimson-700)', maxWidth: '320px' }}>
          <AlertCircle size={12} /> <span>{error}</span>
        </span>
      )}
    </span>
  );
}
