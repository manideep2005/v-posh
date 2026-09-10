import React, { useState } from 'react';
import { openAttachment } from '../utils/api';
import { Paperclip } from 'lucide-react';

// Shared evidence file list. Downloads go through the authenticated
// attachment endpoint — never a public static path.
export default function AttachmentList({ attachments = [] }) {
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const handleOpen = async (att) => {
    setError('');
    setBusyId(att.id);
    try {
      await openAttachment(att.id, att.originalname);
    } catch (err) {
      setError(err.message || 'Could not open attachment.');
    } finally {
      setBusyId(null);
    }
  };

  if (attachments.length === 0) return null;

  return (
    <div>
      {error && (
        <div className="alert alert-danger" style={{ fontSize: '0.8125rem' }}>
          <span>{error}</span>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {attachments.map(att => (
          <div
            key={att.id}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-slate-50)', border: '1px solid var(--color-slate-200)', padding: '0.65rem 1rem', borderRadius: 'var(--radius-sm)' }}
          >
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-navy-900)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Paperclip size={14} aria-hidden="true" />
              {att.originalname} ({(att.size / 1024).toFixed(1)} KB)
            </span>
            <button
              onClick={() => handleOpen(att)}
              className="btn btn-secondary btn-sm"
              disabled={busyId === att.id}
            >
              {busyId === att.id ? 'Opening…' : 'View File'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
